/**
 * Team Data Module
 * 
 * Handles loading and parsing of NBA team rosters:
 * - Load teams from rosters.ini file
 * - Parse INI format with team sections and player sections
 * - Generate default/random teams if file not found
 * - Resolve custom sprite bases and skin tones
 * - Color code conversion (string names to ANSI constants)
 * - Jersey number formatting
 */

load("sbbsdefs.js");

// Global team data object
var NBATeams = {};

/**
 * Load team data from rosters.ini
 * Falls back to generateDefaultTeams() if file not found
 */
function loadTeamData() {
    // Load from rosters.ini
    var rostersFile = new File(js.exec_dir + "rosters.ini");

    if (rostersFile.open("r")) {
        parseRostersINI(rostersFile);
        rostersFile.close();
    } else {
        // Fallback to generated teams if file not found
        generateDefaultTeams();
    }
}

/**
 * Parse rosters.ini file into NBATeams object
 * 
 * Format:
 * [team_key]
 * team_name=Lakers
 * team_abbr=LAL
 * roster=lakers.player1,lakers.player2,...
 * ansi_fg=YELLOW
 * ansi_bg=BG_BLUE
 * 
 * [lakers.player1]
 * player_name=LeBron James
 * player_number=23
 * position=FORWARD
 * speed=9
 * 3point=8
 * dunk=10
 * power=9
 * steal=7
 * block=8
 * skin=brown
 * short_nicks=LEBRON,KING
 * 
 * @param {File} file - Opened File object for rosters.ini
 */
function parseRostersINI(file) {
    var currentSection = null;
    var teamData = {};
    var playerData = {};

    while (!file.eof) {
        var line = file.readln();
        if (line === null) break; // End of file reached
        line = line.trim();

        // Skip empty lines and comments
        if (line === "" || line[0] === "#") continue;

        // Check for section header
        if (line[0] === "[" && line[line.length - 1] === "]") {
            currentSection = line.substring(1, line.length - 1);
            continue;
        }

        // Parse key=value pairs
        var equalsPos = line.indexOf("=");
        if (equalsPos > 0 && currentSection) {
            var key = line.substring(0, equalsPos).trim();
            var value = line.substring(equalsPos + 1).trim();

            // Check if this is a team section or player section
            if (currentSection.indexOf(".") === -1) {
                // Team section
                if (!teamData[currentSection]) {
                    teamData[currentSection] = {};
                }
                teamData[currentSection][key] = value;
            } else {
                // Player section
                if (!playerData[currentSection]) {
                    playerData[currentSection] = {};
                }
                playerData[currentSection][key] = value;
            }
        }
    }

    // Build NBATeams structure
    for (var teamKey in teamData) {
        var team = teamData[teamKey];
        var roster = [];

        if (team.roster) {
            var playerKeys = team.roster.split(",");
            for (var i = 0; i < playerKeys.length; i++) {
                var playerKey = playerKeys[i].trim();
                var player = playerData[playerKey];

                if (player) {
                    // Parse short_nicks - get first nickname from comma-separated list
                    var shortNick = null;
                    if (player.short_nicks && player.short_nicks.trim() !== "") {
                        var nicks = player.short_nicks.split(",");
                        if (nicks.length > 0 && nicks[0].trim() !== "") {
                            shortNick = nicks[0].trim();
                        }
                    }

                    var jerseyNumberString = "";
                    if (player.player_number !== undefined && player.player_number !== null) {
                        jerseyNumberString = String(player.player_number).trim();
                    }

                    var skinTone = null;
                    if (player.skin && player.skin.trim() !== "") {
                        skinTone = player.skin.trim().toLowerCase();
                    }

                    var eyeColor = null;
                    if (player.eye_color && player.eye_color.trim() !== "") {
                        eyeColor = player.eye_color.trim();
                    }

                    var eyebrowChar = null;
                    if (player.eyebrow_char && player.eyebrow_char.trim() !== "") {
                        eyebrowChar = player.eyebrow_char.trim().charAt(0);
                    }

                    var eyebrowColor = null;
                    if (player.eyebrow_color && player.eyebrow_color.trim() !== "") {
                        eyebrowColor = player.eyebrow_color.trim();
                    }

                    roster.push({
                        name: player.player_name || "Unknown",
                        jersey: parseInt(player.player_number) || 0,
                        jerseyString: jerseyNumberString,
                        skin: skinTone,
                        shortNick: shortNick, // Add short nickname property
                        position: (player.position || "").toUpperCase(),
                        teamAbbr: team.team_abbr || teamKey,
                        attributes: [
                            parseInt(player.speed) || 5,
                            parseInt(player["3point"]) || 5,
                            parseInt(player.dunk) || 5,
                            parseInt(player.power) || 5,
                            parseInt(player.steal) || 5,
                            parseInt(player.block) || 5
                        ],
                        eyeColor: eyeColor,
                        eyebrowChar: eyebrowChar,
                        eyebrowColor: eyebrowColor,
                        customSprite: resolveCustomSpriteBase(player.custom_sprite)
                    });
                }
            }
        }

        NBATeams[teamKey] = {
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
}

/**
 * Generate default NBA teams if rosters.ini not found
 * Creates 30 NBA teams with random rosters
 */
function generateDefaultTeams() {
    var nbaTeamNames = [
        "Lakers", "Celtics", "Warriors", "Bulls", "Heat",
        "Nets", "Knicks", "76ers", "Bucks", "Mavericks",
        "Suns", "Nuggets", "Clippers", "Trail Blazers", "Rockets",
        "Spurs", "Jazz", "Thunder", "Pacers", "Cavaliers",
        "Hawks", "Hornets", "Wizards", "Raptors", "Magic",
        "Pistons", "Kings", "Timberwolves", "Pelicans", "Grizzlies"
    ];

    for (var i = 0; i < nbaTeamNames.length; i++) {
        NBATeams[nbaTeamNames[i]] = generateRandomRoster(nbaTeamNames[i]);
    }
}

/**
 * Generate a random roster for a team
 * Creates 2 players with different archetypes (Sharpshooter, High-Flyer, Enforcer, Playmaker)
 * 
 * @param {string} teamName - Name of the team
 * @returns {Object} Team object with name, abbr, and players array
 */
function generateRandomRoster(teamName) {
    var roster = [];

    // Generate 2 players for 2v2
    for (var i = 0; i < 2; i++) {
        var archetype = Math.floor(Math.random() * 4);
        var attributes;
        var playerName;
        var position;

        // Create different archetypes
        switch (archetype) {
            case 0: // Sharpshooter
                attributes = [8, 9, 4, 3, 7, 4];
                playerName = "Guard";
                position = "GUARD";
                break;
            case 1: // High-Flyer
                attributes = [8, 6, 10, 6, 6, 5];
                playerName = "Forward";
                position = "FORWARD";
                break;
            case 2: // Enforcer/Big Man
                attributes = [4, 2, 9, 10, 3, 9];
                playerName = "Center";
                position = "CENTER";
                break;
            case 3: // Playmaker
                attributes = [9, 7, 7, 5, 8, 5];
                playerName = "Point Guard";
                position = "GUARD";
                break;
            default:
                attributes = [6, 6, 6, 6, 6, 6];
                playerName = "Player";
                position = "FORWARD";
        }

        var jerseyNumber = Math.floor(Math.random() * 99) + 1;
        roster.push({
            name: playerName + " " + (i + 1),
            jersey: jerseyNumber,
            jerseyString: String(jerseyNumber),
            skin: "brown",
            attributes: attributes,
            position: position,
            shortNick: playerName.toUpperCase().split(" ")[0]
        });
    }

    return {
        name: teamName,
        abbr: teamName.substring(0, 3).toUpperCase(),
        players: roster
    };
}

/**
 * Extract last name from full name
 * Handles names in parentheses (e.g., "LeBron James (King)")
 * 
 * @param {string} fullName - Full player name
 * @returns {string} Last name
 */
function getLastName(fullName) {
    var nameParts = fullName.split(" ");
    if (nameParts.length === 0) return "";

    var lastPart = nameParts[nameParts.length - 1];

    // If last part is in parentheses, use second to last
    if (lastPart.indexOf("(") !== -1 || lastPart.indexOf(")") !== -1) {
        if (nameParts.length > 1) {
            return nameParts[nameParts.length - 2];
        }
    }

    return lastPart;
}

/**
 * Convert color string name to ANSI color constant value
 * 
 * @param {string} colorStr - Color name (e.g., "LIGHTRED", "BG_BLUE")
 * @returns {number} ANSI color constant
 */
function getColorValue(colorStr) {
    // Map string names to actual color constants
    var colorMap = {
        "BLACK": BLACK,
        "RED": RED,
        "GREEN": GREEN,
        "BROWN": BROWN,
        "BLUE": BLUE,
        "MAGENTA": MAGENTA,
        "CYAN": CYAN,
        "LIGHTGRAY": LIGHTGRAY,
        "DARKGRAY": DARKGRAY,
        "LIGHTRED": LIGHTRED,
        "LIGHTGREEN": LIGHTGREEN,
        "YELLOW": YELLOW,
        "LIGHTBLUE": LIGHTBLUE,
        "LIGHTMAGENTA": LIGHTMAGENTA,
        "LIGHTCYAN": LIGHTCYAN,
        "WHITE": WHITE,
        "WAS_BROWN": WAS_BROWN
    };

    if (!colorStr) return WHITE;
    var upper = colorStr.toUpperCase();

    if (upper === "BG_BLACK") return BG_BLACK;

    if (upper.indexOf("BG_") === 0 && upper.length > 3) {
        var fgValue = getColorValue(upper.substring(3));
        if (fgValue === undefined || fgValue === null) {
            return BG_BLACK;
        }
        return (fgValue & 0x0F) << 4;
    }

    var direct = colorMap[upper];
    if (typeof direct === "number") {
        return direct;
    }

    return WHITE;
}

/**
 * Convert color string to Synchronet CTRL-A color code for console.putmsg
 * 
 * @param {string} colorStr - Color name (e.g., "LIGHTRED")
 * @returns {string} CTRL-A color code sequence
 */
function getColorCode(colorStr) {
    var codeMap = {
        "BLACK": "\1k",
        "RED": "\1r",
        "GREEN": "\1g",
        "BROWN": "\1" + String.fromCharCode(2), // Brown is \1^B
        "BLUE": "\1b",
        "MAGENTA": "\1m",
        "CYAN": "\1c",
        "LIGHTGRAY": "\1w",
        "DARKGRAY": "\1h\1k",
        "LIGHTRED": "\1h\1r",
        "LIGHTGREEN": "\1h\1g",
        "YELLOW": "\1y",
        "LIGHTBLUE": "\1h\1b",
        "LIGHTMAGENTA": "\1h\1m",
        "LIGHTCYAN": "\1h\1c",
        "WHITE": "\1h\1w"
    };

    return codeMap[colorStr] || "\1w";
}

/**
 * Convert background color string to CTRL-A background code
 * 
 * @param {string} bgStr - Background color name (e.g., "BG_BLUE")
 * @returns {string} CTRL-A background code sequence
 */
function getBackgroundCode(bgStr) {
    var ctrl = "\1";
    var map = {
        "BG_BLACK": ctrl + "0",
        "BG_RED": ctrl + "1",
        "BG_GREEN": ctrl + "2",
        "BG_BROWN": ctrl + "3",
        "BG_BLUE": ctrl + "4",
        "BG_MAGENTA": ctrl + "5",
        "BG_CYAN": ctrl + "6",
        "BG_LIGHTGRAY": ctrl + "7"
    };
    return map[bgStr] || "";
}

/**
 * Get menu color codes for a team (foreground and background)
 * 
 * @param {Object} team - Team object with colors property
 * @param {boolean} highlight - Whether to use accent color (highlighted)
 * @returns {string} Combined CTRL-A color code sequence
 */
function getMenuColorCodes(team, highlight) {
    var colors = team && team.colors ? team.colors : {};
    var fgName = highlight
        ? (colors.fg_accent || colors.fg || "WHITE")
        : (colors.fg || "WHITE");
    var bgName = colors.bg_alt || colors.bg || "BG_BLACK";

    var fgCode = getColorCode(fgName);
    var bgCode = getBackgroundCode(bgName);
    var intensity = highlight ? "\1h" : "";

    return bgCode + intensity + fgCode;
}

/**
 * Sanitize sprite base name (remove extensions, invalid characters)
 * 
 * @param {string} input - Raw sprite base name input
 * @returns {string|null} Sanitized sprite base name or null if invalid
 */
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

/**
 * Check if a custom sprite file exists
 * 
 * @param {string} baseName - Sprite base name (without extension)
 * @returns {boolean} True if sprite file exists
 */
function customSpriteExists(baseName) {
    if (!baseName)
        return false;
    try {
        var spriteFile = new File(js.exec_dir + "sprites/" + baseName + ".bin");
        if (spriteFile.exists)
            return true;
    } catch (e) {
        // Ignore file system errors and fall back later
    }
    return false;
}

/**
 * Resolve custom sprite base name (validate it exists)
 * 
 * @param {string} input - Raw custom sprite input from roster
 * @returns {string|null} Validated sprite base name or null if not found
 */
function resolveCustomSpriteBase(input) {
    var base = sanitizeSpriteBaseName(input);
    if (!base)
        return null;
    if (customSpriteExists(base))
        return base;
    return null;
}

/**
 * Resolve sprite base name by skin tone
 * Falls back to "player-brown" if skin-specific sprite not found
 * 
 * @param {string} skin - Skin tone name (e.g., "brown", "light", "dark")
 * @returns {string} Sprite base name
 */
function resolveSpriteBaseBySkin(skin) {
    var fallback = "player-brown";
    if (typeof skin !== "string" || skin.trim() === "") {
        return fallback;
    }
    var cleaned = skin.toLowerCase();
    var candidate = "player-" + cleaned;
    try {
        var testFile = new File(js.exec_dir + "sprites/" + candidate + ".bin");
        if (testFile.exists) {
            return candidate;
        }
    } catch (e) {
        // Ignore and fall back
    }
    return fallback;
}
