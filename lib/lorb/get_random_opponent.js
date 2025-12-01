// Scans assets/characters for a random opponent sprite and returns metadata.
(function () {
    var SAFE_NAME = /^[A-Za-z0-9_-]+\.(?:bin|ans)$/i;
    var ROOT = (typeof js !== "undefined" && js.exec_dir) ? js.exec_dir : "./";
    var CHAR_DIR = ensureTrailingSlash(ROOT) + "assets/characters/";
    var PLAYER_LOOKUP = null;
    var ROSTERS_PATH = ensureTrailingSlash(ROOT) + "lib/config/rosters.ini";

    function ensureTrailingSlash(dir) {
        if (!dir || dir === ".") return "./";
        return /[\/\\]$/.test(dir) ? dir : dir + "/";
    }

    function logError(message) {
        var prefix = "[LORB:get_random_opponent] ";
        if (typeof log === "function") {
            var level = (typeof LOG_ERR !== "undefined") ? LOG_ERR : 1;
            try { log(level, prefix + message); return; } catch (e) { /* ignore */ }
        }
        if (typeof console !== "undefined" && typeof console.print === "function") {
            console.print(prefix + message + "\r\n");
        }
    }

    function listCandidates() {
        var mask = CHAR_DIR + "*.*";
        var flags = (typeof GLOB !== "undefined" && GLOB.NODOT) ? GLOB.NODOT : null;
        var files = (flags === null) ? directory(mask) : directory(mask, flags);
        files = files || [];
        var out = [];
        for (var i = 0; i < files.length; i++) {
            var path = files[i];
            var name = (typeof file_getname === "function")
                ? file_getname(path)
                : path.substring(path.lastIndexOf("/") + 1);
            if (SAFE_NAME.test(name)) out.push(name);
        }
        return out;
    }

    function validateAndBuild(name) {
        var filePath = CHAR_DIR + name;
        var f = new File(filePath);
        if (!f.open("r", true)) throw new Error("Unable to open opponent asset: " + name);
        var size = f.length;
        f.close();
        if (!size) throw new Error("Opponent asset is empty: " + name);
        var opponent = {
            id: name.replace(/\.[^.]+$/i, ""),
            fileName: name,
            path: filePath,
            size: size
        };
        attachPlayerInfo(opponent);
        return opponent;
    }

    function randomIndex(max) {
        if (!max || max <= 0) throw new Error("No opponents available");
        return max === 1 ? 0 : Math.floor(Math.random() * max);
    }

    function normalizeSlug(value) {
        return (value ? String(value).trim().toLowerCase() : "");
    }

    function normalizeName(value) {
        var slug = normalizeSlug(value);
        if (!slug) return "";
        return slug.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
    }

    function parseStat(value) {
        var n = parseInt(value, 10);
        return isNaN(n) ? undefined : n;
    }

    function ensurePlayerLookup() {
        if (PLAYER_LOOKUP) return PLAYER_LOOKUP;

        var lookup = { bySlug: {}, byName: {} };
        var rosterFile = new File(ROSTERS_PATH);
        if (!rosterFile.open("r", true)) {
            logError("Unable to open rosters file: " + ROSTERS_PATH);
            PLAYER_LOOKUP = lookup;
            return lookup;
        }

        var teamSections = {};
        var playerSections = {};
        var currentSection = null;

        while (!rosterFile.eof) {
            var line = rosterFile.readln();
            if (line === null) break;
            line = line.trim();
            if (line === "" || line[0] === "#" || line[0] === ";") continue;
            if (line[0] === "[" && line[line.length - 1] === "]") {
                currentSection = line.substring(1, line.length - 1).trim();
                continue;
            }
            var eq = line.indexOf("=");
            if (eq <= 0 || !currentSection) continue;
            var key = line.substring(0, eq).trim();
            var value = line.substring(eq + 1).trim();
            if (currentSection.indexOf(".") === -1) {
                if (!teamSections[currentSection]) teamSections[currentSection] = {};
                teamSections[currentSection][key] = value;
            } else {
                if (!playerSections[currentSection]) playerSections[currentSection] = {};
                playerSections[currentSection][key] = value;
            }
        }
        rosterFile.close();

        for (var teamKey in teamSections) {
            if (!teamSections.hasOwnProperty(teamKey)) continue;
            var team = teamSections[teamKey];
            if (!team.roster) continue;
            var rosterList = team.roster.split(",");
            for (var i = 0; i < rosterList.length; i++) {
                var playerKey = rosterList[i].trim();
                if (!playerKey) continue;
                var pdata = playerSections[playerKey];
                if (!pdata) continue;
                var payload = buildPlayerPayload(teamKey, team, playerKey, pdata);
                if (!payload) continue;
                lookup.bySlug[payload.slugKey] = payload;
                if (payload.nameKey) lookup.byName[payload.nameKey] = payload;
            }
        }

        PLAYER_LOOKUP = lookup;
        return lookup;
    }

    function buildPlayerPayload(teamKey, team, playerKey, pdata) {
        var slug = playerKey.indexOf(".") >= 0 ? playerKey.split(".")[1] : playerKey;
        var slugKey = normalizeSlug(slug);
        if (!slugKey) return null;
        var playerName = pdata.player_name || slug.replace(/_/g, " ");
        var nameKey = normalizeName(playerName);
        var stats = {
            speed: parseStat(pdata.speed),
            power: parseStat(pdata.power),
            dunk: parseStat(pdata.dunk),
            steal: parseStat(pdata.steal),
            block: parseStat(pdata.block),
            "3point": parseStat(pdata["3point"])
        };
        
        // Parse short_nicks from rosters.ini (e.g., "Trae,Ice" -> ["Trae", "Ice"])
        var shortNicks = [];
        if (pdata.short_nicks) {
            var parts = String(pdata.short_nicks).split(",");
            for (var i = 0; i < parts.length; i++) {
                var nick = parts[i].trim();
                if (nick) shortNicks.push(nick);
            }
        }
        
        return {
            slug: slug,
            slugKey: slugKey,
            name: playerName,
            nameKey: nameKey,
            teamKey: teamKey,
            teamName: team.team_name || teamKey,
            teamAbbr: team.team_abbr || (teamKey ? teamKey.substring(0, 3).toUpperCase() : "UNK"),
            position: (pdata.position || "").toUpperCase(),
            jersey: pdata.player_number ? String(pdata.player_number).trim() : null,
            stats: stats,
            shortNicks: shortNicks,
            skin: pdata.skin || null
        };
    }

    function attachPlayerInfo(opponent) {
        var lookup = ensurePlayerLookup();
        var slugKey = normalizeSlug(opponent.id);
        var record = lookup.bySlug[slugKey];
        if (!record) {
            record = lookup.byName[normalizeName(opponent.id)];
        }
        if (!record) return;
        opponent.name = record.name;
        opponent.displayName = record.name;
        opponent.team = record.teamName;
        opponent.teamAbbr = record.teamAbbr;
        opponent.position = record.position;
        opponent.jersey = record.jersey;
        opponent.stats = record.stats;
        opponent.shortNicks = record.shortNicks;
        opponent.shortNick = record.shortNicks && record.shortNicks.length > 0 ? record.shortNicks[0] : null;
        opponent.skin = record.skin;
        opponent.playerInfo = record;
    }

    function getRandomOpponent() {
        try {
            var candidates = listCandidates();
            if (!candidates.length) {
                throw new Error("No opponent art files found in " + CHAR_DIR);
            }
            return validateAndBuild(candidates[randomIndex(candidates.length)]);
        } catch (err) {
            logError(err && err.message ? err.message : String(err));
            throw err;
        }
    }

    if (typeof this.LORB !== "object") {
        this.LORB = {};
    }
    this.LORB.getRandomOpponent = getRandomOpponent;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = getRandomOpponent;
    }
})();
