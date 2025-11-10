(function (global) {
    if (global.MPTeamData)
        return;

    var teamCache = null;

    function sanitizeSpriteBaseName(input) {
        if (!input && input !== 0)
            return null;
        var base = String(input).trim();
        if (!base.length)
            return null;
        base = base.replace(/\.bin$/i, "").replace(/\.ini$/i, "");
        base = base.replace(/[^a-z0-9_\-]/gi, "");
        if (!base.length)
            return null;
        return base.toLowerCase();
    }

    function customSpriteExists(baseName) {
        if (!baseName)
            return false;
        try {
            var spriteFile = new File(js.exec_dir + "sprites/" + baseName + ".bin");
            if (spriteFile.exists)
                return true;
        } catch (e) {
            // Ignore and fall back to default sprites later
        }
        return false;
    }

    function resolveCustomSpriteBase(input) {
        var base = sanitizeSpriteBaseName(input);
        if (!base)
            return null;
        if (customSpriteExists(base))
            return base;
        return null;
    }

    function parseRostersINI(file) {
        var currentSection = null;
        var teamData = {};
        var playerData = {};

        while (!file.eof) {
            var line = file.readln();
            if (line === null)
                break;
            line = line.trim();
            if (line === "" || line[0] === "#")
                continue;

            if (line[0] === "[" && line[line.length - 1] === "]") {
                currentSection = line.substring(1, line.length - 1).toLowerCase();
                continue;
            }

            var equalsPos = line.indexOf("=");
            if (equalsPos > 0 && currentSection) {
                var key = line.substring(0, equalsPos).trim();
                var value = line.substring(equalsPos + 1).trim();

                if (currentSection.indexOf(".") === -1) {
                    if (!teamData[currentSection])
                        teamData[currentSection] = {};
                    teamData[currentSection][key] = value;
                } else {
                    if (!playerData[currentSection])
                        playerData[currentSection] = {};
                    playerData[currentSection][key] = value;
                }
            }
        }

        var teams = {};

        for (var teamKey in teamData) {
            var team = teamData[teamKey];
            var roster = [];

            if (team.roster) {
                var playerKeys = team.roster.split(",");
                for (var i = 0; i < playerKeys.length; i++) {
                    var playerKey = playerKeys[i].trim().toLowerCase();
                    var player = playerData[playerKey];
                    if (!player)
                        continue;

                    var shortNick = null;
                    if (player.short_nicks && player.short_nicks.trim() !== "") {
                        var nicks = player.short_nicks.split(",");
                        if (nicks.length > 0 && nicks[0].trim() !== "")
                            shortNick = nicks[0].trim();
                    }

                    var jerseyNumberString = "";
                    if (player.player_number !== undefined && player.player_number !== null) {
                        jerseyNumberString = String(player.player_number).trim();
                    }

                    roster.push({
                        name: player.player_name || "Unknown",
                        jersey: parseInt(player.player_number, 10) || 0,
                        jerseyString: jerseyNumberString,
                        shortNick: shortNick,
                        position: (player.position || "").toUpperCase(),
                        customSprite: resolveCustomSpriteBase(player.custom_sprite)
                    });
                }
            }

            teams[teamKey] = {
                key: teamKey,
                name: team.team_name || teamKey,
                abbr: team.team_abbr || teamKey.substring(0, 3).toUpperCase(),
                players: roster,
                colors: {
                    fg: team.ansi_fg || "WHITE",
                    bg: team.ansi_bg || "BG_BLACK",
                    fg_accent: team.ansi_fg_accent || "WHITE",
                    bg_alt: team.ansi_bg_alt || "BG_BLACK",
                    alt_fg: team.alternate_ansi_fg || null,
                    alt_bg: team.alternate_ansi_bg || null
                }
            };
        }

        return teams;
    }

    function generateFallbackTeams() {
        var defaults = ["lakers", "celtics", "bulls", "knicks"];
        var teams = {};
        for (var i = 0; i < defaults.length; i++) {
            var key = defaults[i];
            teams[key] = {
                key: key,
                name: key.charAt(0).toUpperCase() + key.substring(1),
                abbr: key.substring(0, 3).toUpperCase(),
                players: [
                    { name: key + " Star 1", jersey: 23, jerseyString: "23", shortNick: null, position: "GF" },
                    { name: key + " Star 2", jersey: 34, jerseyString: "34", shortNick: null, position: "FC" }
                ],
                colors: {
                    fg: "WHITE",
                    bg: "BG_BLACK",
                    fg_accent: "WHITE",
                    bg_alt: "BG_BLACK"
                }
            };
        }
        return teams;
    }

    function loadTeamsInternal() {
        if (teamCache)
            return teamCache;

        var rosterPath = js.exec_dir + "lib/config/rosters.ini";
        var file = new File(rosterPath);
        var teams = null;

        if (file.open("r")) {
            teams = parseRostersINI(file);
            file.close();
        }

        if (!teams || Object.keys(teams).length === 0)
            teams = generateFallbackTeams();

        teamCache = teams;
        return teamCache;
    }

    function normalizeKey(input) {
        if (!input)
            return "";
        return String(input).trim().toLowerCase();
    }

    function findTeamKey(input) {
        var query = normalizeKey(input);
        if (!query)
            return null;

        var teams = loadTeamsInternal();
        for (var key in teams) {
            var team = teams[key];
            if (key.toLowerCase() === query)
                return key;
            if (team.abbr && team.abbr.toLowerCase() === query)
                return key;
            if (team.name && team.name.toLowerCase() === query)
                return key;
        }
        return null;
    }

    function listTeams() {
        var teams = loadTeamsInternal();
        var list = [];
        for (var key in teams) {
            list.push({
                key: key,
                name: teams[key].name,
                abbr: teams[key].abbr
            });
        }
        list.sort(function (a, b) {
            var nameA = a.name.toLowerCase();
            var nameB = b.name.toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        });
        return list;
    }

    global.MPTeamData = {
        load: function () {
            return loadTeamsInternal();
        },
        reload: function () {
            teamCache = null;
            return loadTeamsInternal();
        },
        listTeams: listTeams,
        getTeam: function (key) {
            if (!key)
                return null;
            var teams = loadTeamsInternal();
            return teams[normalizeKey(key)] || null;
        },
        findTeamKey: findTeamKey,
        getTeamNamesSummary: function () {
            var list = listTeams();
            var abbrs = [];
            for (var i = 0; i < list.length; i++)
                abbrs.push(list[i].abbr);
            return abbrs.join(" ");
        }
    };
})(this);
