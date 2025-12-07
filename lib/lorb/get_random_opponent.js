// Scans assets/characters for a random opponent sprite and returns metadata.
// Supports city-filtered encounters for LORB (Pokemon-style regional spawns).
(function () {
    var SAFE_NAME = /^[A-Za-z0-9_-]+\.(?:bin|ans)$/i;
    var ROOT = (typeof js !== "undefined" && js.exec_dir) ? js.exec_dir : "./";
    var CHAR_DIR = ensureTrailingSlash(ROOT) + "assets/characters/";
    var PLAYER_LOOKUP = null;
    var ROSTERS_PATH = ensureTrailingSlash(ROOT) + "lib/config/rosters.ini";
    
    // Map city IDs to team section names in rosters.ini
    // This mirrors CITY_TO_TEAM in cities.js for standalone use
    var CITY_TO_TEAM = {
        "atl": "hawks",
        "bos": "celtics",
        "bkn": "nets",
        "cha": "hornets",
        "chi": "bulls",
        "cle": "cavaliers",
        "dal": "mavericks",
        "den": "nuggets",
        "det": "pistons",
        "gsw": "warriors",
        "hou": "rockets",
        "ind": "pacers",
        "lac": "clippers",
        "lal": "lakers",
        "mem": "grizzlies",
        "mia": "heat",
        "mil": "bucks",
        "min": "timberwolves",
        "nop": "pelicans",
        "nyk": "knicks",
        "okc": "thunder",
        "orl": "magic",
        "phi": "76ers",
        "phx": "suns",
        "por": "blazers",
        "sac": "kings",
        "sas": "spurs",
        "tor": "raptors",
        "uta": "jazz",
        "was": "wizards"
    };

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
        
        // Parse additional_appearance_cities (e.g., "mia,cle" for LeBron who played in multiple cities)
        var additionalCities = [];
        if (pdata.additional_appearance_cities) {
            var cityParts = String(pdata.additional_appearance_cities).split(",");
            for (var j = 0; j < cityParts.length; j++) {
                var city = cityParts[j].trim().toLowerCase();
                if (city) additionalCities.push(city);
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
            skin: pdata.skin || null,
            additionalCities: additionalCities
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
    
    /**
     * Get a random NBA opponent filtered by city.
     * Only returns players whose home team is in that city, or who have that city
     * in their additional_appearance_cities list.
     * 
     * @param {string} cityId - City ID (e.g., "chi", "lal", "mia")
     * @returns {Object|null} Opponent object or null if no valid candidates
     */
    function getRandomOpponentForCity(cityId) {
        if (!cityId) return getRandomOpponent(); // Fallback to random if no city
        
        try {
            var lookup = ensurePlayerLookup();
            var targetTeam = CITY_TO_TEAM[cityId.toLowerCase()];
            
            if (!targetTeam) {
                // Unknown city, fall back to random
                return getRandomOpponent();
            }
            
            // Get all character art files
            var allCandidates = listCandidates();
            if (!allCandidates.length) {
                throw new Error("No opponent art files found in " + CHAR_DIR);
            }
            
            // Filter candidates to those matching this city
            var cityCandidates = [];
            for (var i = 0; i < allCandidates.length; i++) {
                var fileName = allCandidates[i];
                var playerId = fileName.replace(/\.[^.]+$/i, "");
                var slugKey = normalizeSlug(playerId);
                var record = lookup.bySlug[slugKey];
                
                if (!record) continue;
                
                // Check if player belongs to this city's team
                if (record.teamKey === targetTeam) {
                    cityCandidates.push(fileName);
                    continue;
                }
                
                // Check additional appearance cities
                if (record.additionalCities && record.additionalCities.length > 0) {
                    for (var j = 0; j < record.additionalCities.length; j++) {
                        if (record.additionalCities[j] === cityId.toLowerCase()) {
                            cityCandidates.push(fileName);
                            break;
                        }
                    }
                }
            }
            
            if (cityCandidates.length === 0) {
                // No players for this city, fall back to random
                // This handles cities that might not have art files yet
                return getRandomOpponent();
            }
            
            // Pick a random candidate from the city-filtered list
            return validateAndBuild(cityCandidates[randomIndex(cityCandidates.length)]);
        } catch (err) {
            logError(err && err.message ? err.message : String(err));
            // Fall back to random on error
            try { return getRandomOpponent(); } catch (e) { throw err; }
        }
    }
    
    /**
     * Get list of players available in a specific city (for debugging/display)
     * @param {string} cityId - City ID
     * @returns {Array} Array of player slugs available in that city
     */
    function getPlayersForCity(cityId) {
        if (!cityId) return [];
        
        var lookup = ensurePlayerLookup();
        var targetTeam = CITY_TO_TEAM[cityId.toLowerCase()];
        if (!targetTeam) return [];
        
        var players = [];
        for (var slugKey in lookup.bySlug) {
            if (!lookup.bySlug.hasOwnProperty(slugKey)) continue;
            var record = lookup.bySlug[slugKey];
            
            if (record.teamKey === targetTeam) {
                players.push(record);
                continue;
            }
            
            if (record.additionalCities) {
                for (var j = 0; j < record.additionalCities.length; j++) {
                    if (record.additionalCities[j] === cityId.toLowerCase()) {
                        players.push(record);
                        break;
                    }
                }
            }
        }
        return players;
    }

    if (typeof this.LORB !== "object") {
        this.LORB = {};
    }
    this.LORB.getRandomOpponent = getRandomOpponent;
    this.LORB.getRandomOpponentForCity = getRandomOpponentForCity;
    this.LORB.getPlayersForCity = getPlayersForCity;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            getRandomOpponent: getRandomOpponent,
            getRandomOpponentForCity: getRandomOpponentForCity,
            getPlayersForCity: getPlayersForCity
        };
    }
})();
