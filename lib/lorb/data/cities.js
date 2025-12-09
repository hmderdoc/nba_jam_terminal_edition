/**
 * cities.js - NBA City Data and Rotation System
 * 
 * Loads city definitions from cities.json and provides helpers for:
 * - Getting the current city based on shared gameDay
 * - City-specific buffs, club names, and art paths
 * - City rotation (30 cities cycling every 30 days)
 * - Team color theming from rosters.ini
 */
(function () {
    
    var CITIES_DATA = null;
    var TEAM_COLORS_CACHE = null;
    var CITIES_JSON_PATH = js.exec_dir + "lib/lorb/design_docs/season_concept/cities.json";
    var ROSTERS_INI_PATH = js.exec_dir + "lib/config/rosters.ini";
    var CITY_ART_DIR = "/sbbs/xtrn/nba_jam/assets/lorb/cities/";
    
    // Fallback art paths
    var DEFAULT_BANNER = CITY_ART_DIR + "default_banner.bin";
    var DEFAULT_DETAIL = CITY_ART_DIR + "default_detail.bin";
    
    // Map city IDs to team section names in rosters.ini
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
    
    // ANSI color name to Ctrl-A code mapping
    var ANSI_TO_CTRL = {
        "BLACK": "\1k",
        "RED": "\1r",
        "GREEN": "\1g",
        "YELLOW": "\1y",
        "BROWN": "\1y",
        "BLUE": "\1b",
        "MAGENTA": "\1m",
        "CYAN": "\1c",
        "WHITE": "\1w",
        "LIGHTGRAY": "\1w",
        "DARKGRAY": "\1n\1k",
        "LIGHTRED": "\1h\1r",
        "LIGHTGREEN": "\1h\1g",
        "LIGHTYELLOW": "\1h\1y",
        "LIGHTBLUE": "\1h\1b",
        "LIGHTMAGENTA": "\1h\1m",
        "LIGHTCYAN": "\1h\1c",
        "LIGHTWHITE": "\1h\1w",
        // Background colors
        "BG_BLACK": "\1" + "0",
        "BG_RED": "\1" + "1",
        "BG_GREEN": "\1" + "2",
        "BG_YELLOW": "\1" + "3",
        "BG_BLUE": "\1" + "4",
        "BG_MAGENTA": "\1" + "5",
        "BG_CYAN": "\1" + "6",
        "BG_WHITE": "\1" + "7"
    };
    
    // ANSI color name to numeric attribute mapping (for Frame.setData)
    // These use Synchronet color constants (require conio globals loaded)
    // Foreground: 0-15, Background: 0-7 (shifted left 4 bits when combined)
    function getFgAttrFromName(name) {
        if (!name) return 7; // default WHITE
        var upper = String(name).toUpperCase();
        // Note: YELLOW is high-intensity BROWN (6 | HIGH = 14)
        // BROWN is the low-intensity version (6)
        var attrMap = {
            "BLACK": 0,
            "BLUE": 1,
            "GREEN": 2,
            "CYAN": 3,
            "RED": 4,
            "MAGENTA": 5,
            "BROWN": 6,
            "YELLOW": 14,           // HIGH | BROWN - bright yellow
            "WHITE": 7,
            "LIGHTGRAY": 7,
            "DARKGRAY": 8,
            "LIGHTBLUE": 9,
            "LIGHTGREEN": 10,
            "LIGHTCYAN": 11,
            "LIGHTRED": 12,
            "LIGHTMAGENTA": 13,
            "LIGHTYELLOW": 14,
            "LIGHTWHITE": 15
        };
        // Try to use the global constant if available
        if (typeof global !== "undefined" && global[upper] !== undefined) {
            return global[upper];
        }
        return attrMap[upper] !== undefined ? attrMap[upper] : 7;
    }
    
    // Get background attribute from BG_* name
    // Returns the value shifted for use as hbg (e.g., BG_RED = 64)
    function getBgAttrFromName(name) {
        if (!name) return 0; // default BG_BLACK
        var upper = String(name).toUpperCase();
        
        // Background color map (these are BG_* constants, value = color << 4)
        var bgMap = {
            "BG_BLACK": 0,
            "BG_BLUE": 16,
            "BG_GREEN": 32,
            "BG_CYAN": 48,
            "BG_RED": 64,
            "BG_MAGENTA": 80,
            "BG_BROWN": 96,
            "BG_YELLOW": 96,
            "BG_WHITE": 112,
            "BG_LIGHTGRAY": 112
        };
        
        // Try to use the global constant if available
        if (typeof global !== "undefined" && global[upper] !== undefined) {
            return global[upper];
        }
        return bgMap[upper] !== undefined ? bgMap[upper] : 0;
    }
    
    /**
     * Load team colors from rosters.ini (cached)
     */
    function loadTeamColors() {
        if (TEAM_COLORS_CACHE) return TEAM_COLORS_CACHE;
        
        TEAM_COLORS_CACHE = {};
        
        if (!file_exists(ROSTERS_INI_PATH)) {
            log(LOG_WARNING, "[LORB:CITIES] rosters.ini not found: " + ROSTERS_INI_PATH);
            return TEAM_COLORS_CACHE;
        }
        
        var f = new File(ROSTERS_INI_PATH);
        if (!f.open("r")) return TEAM_COLORS_CACHE;
        
        var currentSection = null;
        var currentColors = {};
        
        while (!f.eof) {
            var line = f.readln();
            if (!line) continue;
            line = line.trim();
            if (!line || line.charAt(0) === ";") continue;
            
            if (line.charAt(0) === "[" && line.charAt(line.length - 1) === "]") {
                // Save previous section if it's a team (no dot in name)
                if (currentSection && currentSection.indexOf(".") === -1) {
                    TEAM_COLORS_CACHE[currentSection] = currentColors;
                }
                currentSection = line.substring(1, line.length - 1).toLowerCase();
                currentColors = {};
                continue;
            }
            
            var eq = line.indexOf("=");
            if (eq > 0) {
                var key = line.substring(0, eq).trim().toLowerCase();
                var val = line.substring(eq + 1).trim();
                
                // Only capture color fields
                if (key === "ansi_fg" || key === "ansi_bg" || 
                    key === "ansi_fg_accent" || key === "ansi_bg_alt") {
                    currentColors[key] = val;
                }
            }
        }
        
        // Save last section
        if (currentSection && currentSection.indexOf(".") === -1) {
            TEAM_COLORS_CACHE[currentSection] = currentColors;
        }
        
        f.close();
        return TEAM_COLORS_CACHE;
    }
    
    /**
     * Load cities from JSON file
     */
    function loadCities() {
        if (CITIES_DATA) return CITIES_DATA;
        
        try {
            var f = new File(CITIES_JSON_PATH);
            if (!f.open("r")) {
                log(LOG_ERR, "[LORB:CITIES] Failed to open cities.json: " + CITIES_JSON_PATH);
                return [];
            }
            
            var content = f.read();
            f.close();
            
            CITIES_DATA = JSON.parse(content);
            
            // Sort by order to ensure consistent rotation
            CITIES_DATA.sort(function(a, b) {
                return (a.order || 0) - (b.order || 0);
            });
            
            log(LOG_DEBUG, "[LORB:CITIES] Loaded " + CITIES_DATA.length + " cities");
            return CITIES_DATA;
        } catch (e) {
            log(LOG_ERR, "[LORB:CITIES] Error loading cities.json: " + e);
            return [];
        }
    }
    
    /**
     * Get all cities
     */
    function getAll() {
        return loadCities();
    }
    
    /**
     * Get city by ID (e.g., "chi", "lal")
     */
    function getById(cityId) {
        var cities = loadCities();
        for (var i = 0; i < cities.length; i++) {
            if (cities[i].id === cityId) {
                return cities[i];
            }
        }
        return null;
    }
    
    /**
     * Get the current city for a given game day.
     * Cities rotate: day 1 = city[0], day 2 = city[1], ..., day 31 = city[0]
     */
    function getCurrent(gameDay) {
        var cities = loadCities();
        if (!cities || cities.length === 0) {
            // Return a fallback city
            return {
                id: "default",
                cityName: "Rim City",
                teamName: "Legends",
                region: "unknown",
                order: 0,
                nightclubName: "Club 23",
                buffs: {},
                notes: "Fallback city"
            };
        }
        
        // 0-based index, cycling through cities
        var index = ((gameDay - 1) % cities.length);
        if (index < 0) index = 0;
        
        return cities[index];
    }
    
    /**
     * Get the current city based on shared state.
     * Convenience wrapper that fetches gameDay from SharedState.
     */
    function getToday() {
        var gameDay = 1;
        if (LORB.SharedState && LORB.SharedState.getGameDay) {
            gameDay = LORB.SharedState.getGameDay();
        }
        return getCurrent(gameDay);
    }
    
    /**
     * Get stat buffs for a city.
     * Returns normalized buffs object.
     */
    function getBuffs(city) {
        if (!city || !city.buffs) {
            return {
                speed: 0,
                three: 0,
                power: 0,
                steal: 0,
                block: 0,
                dunk: 0,
                stamina: 0,
                defense: 0,
                fundamentals: 0,
                clutch: 0,
                luck: 0,
                foulTolerance: 0,
                repMultiplier: 1.0,
                cashMultiplier: 1.0
            };
        }
        
        var buffs = city.buffs;
        return {
            speed: buffs.speed || 0,
            three: buffs.three || 0,
            power: buffs.power || 0,
            steal: buffs.steal || 0,
            block: buffs.block || 0,
            dunk: buffs.dunk || 0,
            stamina: buffs.stamina || 0,
            defense: buffs.defense || 0,
            fundamentals: buffs.fundamentals || 0,
            clutch: buffs.clutch || 0,
            luck: buffs.luck || 0,
            foulTolerance: buffs.foulTolerance || 0,
            repMultiplier: buffs.repMultiplier || 1.0,
            cashMultiplier: buffs.cashMultiplier || 1.0
        };
    }
    
    /**
     * Apply city buffs to player stats (additive bonuses).
     * Returns a new stats object with buffs applied.
     */
    function applyBuffsToStats(baseStats, city) {
        var buffs = getBuffs(city);
        
        return {
            speed: (baseStats.speed || 5) + buffs.speed,
            threePt: (baseStats.threePt || 5) + buffs.three,
            power: (baseStats.power || 5) + buffs.power,
            steal: (baseStats.steal || 5) + buffs.steal,
            block: (baseStats.block || 5) + buffs.block,
            dunk: (baseStats.dunk || 5) + buffs.dunk
        };
    }
    
    /**
     * Get the nightclub name for a city.
     */
    function getClubName(city) {
        if (!city) return "Club 23";
        return city.nightclubName || "Club 23";
    }
    
    /**
     * Get the path to city banner art (80x4).
     * Falls back to default if city-specific doesn't exist.
     */
    function getBannerPath(city) {
        if (!city || !city.bannerBin) {
            return DEFAULT_BANNER;
        }
        
        var path = CITY_ART_DIR + city.bannerBin;
        if (file_exists(path)) {
            return path;
        }
        
        return DEFAULT_BANNER;
    }
    
    /**
     * Get the path to city detail art (40x20).
     * Falls back to default if city-specific doesn't exist.
     */
    function getDetailPath(city) {
        if (!city || !city.detailBin) {
            return DEFAULT_DETAIL;
        }
        
        var path = CITY_ART_DIR + city.detailBin;
        if (file_exists(path)) {
            return path;
        }
        
        return DEFAULT_DETAIL;
    }
    
    /**
     * Get display title for hub header.
     * Format: "CITYNAME - DAY X"
     */
    function getHubTitle(city, gameDay) {
        var cityName = city ? city.cityName.toUpperCase() : "RIM CITY";
        return cityName + " - DAY " + gameDay;
    }
    
    /**
     * Get team colors for a city from rosters.ini.
     * Returns object with:
     *   - fg, bg, fgAccent, bgAlt as Ctrl-A code strings
     *   - fgAttr, bgAttr, fgAccentAttr, bgAltAttr as numeric attributes
     */
    function getTeamColors(city) {
        var defaults = {
            fg: "\1h\1c",
            bg: "\1" + "0",
            fgAccent: "\1h\1w",
            bgAlt: "\1" + "4",
            fgAttr: 11,     // LIGHTCYAN
            bgAttr: 0,      // BG_BLACK
            fgAccentAttr: 15, // WHITE (bright)
            bgAltAttr: 16   // BG_BLUE (1 << 4)
        };
        
        if (!city || !city.id) return defaults;
        
        var teamKey = CITY_TO_TEAM[city.id];
        if (!teamKey) return defaults;
        
        var allColors = loadTeamColors();
        var teamColors = allColors[teamKey];
        if (!teamColors) return defaults;
        
        return {
            fg: ANSI_TO_CTRL[teamColors.ansi_fg] || defaults.fg,
            bg: ANSI_TO_CTRL[teamColors.ansi_bg] || defaults.bg,
            fgAccent: ANSI_TO_CTRL[teamColors.ansi_fg_accent] || defaults.fgAccent,
            bgAlt: ANSI_TO_CTRL[teamColors.ansi_bg_alt] || defaults.bgAlt,
            fgAttr: getFgAttrFromName(teamColors.ansi_fg),
            bgAttr: getBgAttrFromName(teamColors.ansi_bg),
            fgAccentAttr: getFgAttrFromName(teamColors.ansi_fg_accent),
            bgAltAttr: getBgAttrFromName(teamColors.ansi_bg_alt)
        };
    }
    
    /**
     * Get raw team color strings from rosters.ini for game config.
     * Returns the actual color names (e.g., "BG_RED", "WHITE") that can be
     * passed directly to runExternalGame's team.colors config.
     * 
     * @param {Object} city - City object with id property
     * @returns {Object} Object with fg, bg, fg_accent, bg_alt as string names
     */
    function getRawTeamColors(city) {
        var defaults = {
            fg: "WHITE",
            bg: "BG_BLUE",
            fg_accent: "WHITE",
            bg_alt: "BG_BLUE"
        };
        
        if (!city || !city.id) return defaults;
        
        var teamKey = CITY_TO_TEAM[city.id];
        if (!teamKey) return defaults;
        
        var allColors = loadTeamColors();
        var teamColors = allColors[teamKey];
        if (!teamColors) return defaults;
        
        return {
            fg: teamColors.ansi_fg || defaults.fg,
            bg: teamColors.ansi_bg || defaults.bg,
            fg_accent: teamColors.ansi_fg_accent || defaults.fg_accent,
            bg_alt: teamColors.ansi_bg_alt || defaults.bg_alt
        };
    }
    
    /**
     * Get primary team color code for display (simple wrapper).
     * Now uses actual team data from rosters.ini instead of region mapping.
     */
    function getTeamColorCode(city) {
        var colors = getTeamColors(city);
        return colors.fg;
    }
    
    /**
     * Get lightbar/menu colors for a city.
     * Returns object with normal, highlight, hotkey colors.
     */
    function getLightbarColors(city) {
        var teamColors = getTeamColors(city);
        
        return {
            // Normal item: dim version of team color
            normal: "\1n" + teamColors.fg.replace("\1h", ""),
            // Highlighted item: bright team color on alt background
            highlight: teamColors.bgAlt + teamColors.fg,
            // Hotkey: accent color
            hotkey: teamColors.fgAccent,
            // Reset
            reset: "\1n"
        };
    }
    
    /**
     * Get a short description of active city buffs for display.
     */
    function getBuffDescription(city) {
        if (!city || !city.buffs) return "";
        
        var parts = [];
        var b = city.buffs;
        
        if (b.speed) parts.push("SPD+" + b.speed);
        if (b.three) parts.push("3PT+" + b.three);
        if (b.power) parts.push("PWR+" + b.power);
        if (b.steal) parts.push("STL+" + b.steal);
        if (b.block) parts.push("BLK+" + b.block);
        if (b.dunk) parts.push("DNK+" + b.dunk);
        if (b.stamina) parts.push("STA+" + b.stamina);
        if (b.defense) parts.push("DEF+" + b.defense);
        if (b.repMultiplier && b.repMultiplier > 1) {
            parts.push("REP×" + b.repMultiplier.toFixed(2));
        }
        if (b.cashMultiplier && b.cashMultiplier > 1) {
            parts.push("$×" + b.cashMultiplier.toFixed(2));
        }
        
        return parts.join(" ");
    }
    
    /**
     * Get a RichView-compatible theme object for a city.
     * Dynamically builds theme from team colors in rosters.ini.
     * 
     * The highlight bar (selected item) should match how team uniforms are drawn:
     * - hbg = ansi_bg_alt (background color of the highlight bar, e.g., BG_RED for Miami)
     * - hfg = ansi_fg_accent (text on the highlight bar, e.g., BLACK for Miami)
     * 
     * Non-selected items use team colors subtly:
     * - fg = ansi_fg (team primary foreground color)
     * - bg = BG_BLACK (dark background for non-selected)
     * 
     * @param {Object} city - City object
     * @returns {Object} Theme object compatible with RichView/FrameLightbar
     */
    function getCityTheme(city) {
        var teamColors = getTeamColors(city);
        
        // Build a theme object using team colors
        // Selected lightbar: bg_alt background with fg_accent foreground (matches uniform rendering)
        // Normal items: team fg color on black background
        return {
            fg: teamColors.fgAttr,           // Normal text: team primary color (e.g., LIGHTRED)
            bg: 0,                            // Normal bg: BG_BLACK (dark background)
            hfg: teamColors.fgAccentAttr,    // Highlight text: accent color (e.g., BLACK for Miami)
            hbg: teamColors.bgAltAttr,       // Highlight bg: alt background (e.g., BG_RED for Miami)
            kfg: teamColors.fgAccentAttr,    // Hotkey: accent color
            khfg: teamColors.fgAttr,         // Hotkey on highlight: team primary
            dfg: 8,                           // Disabled: DARKGRAY
            dbg: 0,                           // Disabled bg: BG_BLACK
            borderFg: teamColors.fgAttr,     // Border: team primary color
            accentFg: teamColors.fgAccentAttr, // Accent: fg_accent
            headerFg: teamColors.fgAttr      // Header: team primary
        };
    }
    
    // Export to LORB namespace
    if (!LORB.Data) LORB.Data = {};
    LORB.Cities = {
        getAll: getAll,
        getById: getById,
        getCurrent: getCurrent,
        getToday: getToday,
        getBuffs: getBuffs,
        applyBuffsToStats: applyBuffsToStats,
        getClubName: getClubName,
        getBannerPath: getBannerPath,
        getDetailPath: getDetailPath,
        getHubTitle: getHubTitle,
        getTeamColors: getTeamColors,
        getRawTeamColors: getRawTeamColors,
        getTeamColorCode: getTeamColorCode,
        getLightbarColors: getLightbarColors,
        getBuffDescription: getBuffDescription,
        getCityTheme: getCityTheme,
        CITY_ART_DIR: CITY_ART_DIR
    };
    
})();
