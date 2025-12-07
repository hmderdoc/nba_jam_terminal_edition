/**
 * UI Themes for RichView and FrameLightbar
 * 
 * Each theme defines colors for:
 * - Menu items (fg, bg)
 * - Highlighted/selected items (hfg, hbg)
 * - Hotkey characters (kfg, khfg)
 * - Disabled items (dfg, dbg)
 * - Borders and accents (borderFg, accentFg)
 */

load("sbbsdefs.js");

var THEMES = {
    
    // Default theme - blue highlight on dark
    default: {
        fg: LIGHTGRAY,
        bg: BG_BLACK,
        hfg: WHITE | HIGH,
        hbg: BG_BLUE,
        kfg: YELLOW,
        khfg: YELLOW | HIGH,
        dfg: DARKGRAY,
        dbg: BG_BLACK,
        borderFg: CYAN,
        accentFg: WHITE | HIGH,
        headerFg: YELLOW | HIGH
    },
    
    // Fire theme - red/orange
    fire: {
        fg: YELLOW,
        bg: BG_BLACK,
        hfg: WHITE | HIGH,
        hbg: BG_RED,
        kfg: RED | HIGH,
        khfg: YELLOW | HIGH,
        dfg: BROWN,
        dbg: BG_BLACK,
        borderFg: RED,
        accentFg: YELLOW | HIGH,
        headerFg: RED | HIGH
    },
    
    // Ice theme - cyan/blue
    ice: {
        fg: CYAN,
        bg: BG_BLACK,
        hfg: WHITE | HIGH,
        hbg: BG_CYAN,
        kfg: CYAN | HIGH,
        khfg: WHITE | HIGH,
        dfg: BLUE,
        dbg: BG_BLACK,
        borderFg: CYAN | HIGH,
        accentFg: WHITE | HIGH,
        headerFg: CYAN | HIGH
    },
    
    // Green/Matrix theme
    matrix: {
        fg: GREEN,
        bg: BG_BLACK,
        hfg: WHITE | HIGH,
        hbg: BG_GREEN,
        kfg: GREEN | HIGH,
        khfg: WHITE | HIGH,
        dfg: DARKGRAY,
        dbg: BG_BLACK,
        borderFg: GREEN,
        accentFg: GREEN | HIGH,
        headerFg: GREEN | HIGH
    },
    
    // Lakers theme - purple/gold
    lakers: {
        fg: YELLOW,
        bg: BG_MAGENTA,
        hfg: WHITE | HIGH,
        hbg: BG_BROWN,  // Gold-ish
        kfg: YELLOW | HIGH,
        khfg: WHITE | HIGH,
        dfg: MAGENTA,
        dbg: BG_MAGENTA,
        borderFg: YELLOW,
        accentFg: YELLOW | HIGH,
        headerFg: YELLOW | HIGH
    },
    
    // Celtics theme - green/white
    celtics: {
        fg: WHITE,
        bg: BG_GREEN,
        hfg: GREEN | HIGH,
        hbg: BG_LIGHTGRAY,
        kfg: WHITE | HIGH,
        khfg: GREEN | HIGH,
        dfg: DARKGRAY,
        dbg: BG_GREEN,
        borderFg: WHITE,
        accentFg: WHITE | HIGH,
        headerFg: WHITE | HIGH
    },
    
    // LORB theme - dark with red accents (Red Bull)
    lorb: {
        fg: LIGHTGRAY,
        bg: BG_BLACK,
        hfg: WHITE | HIGH,
        hbg: BG_RED,
        kfg: RED | HIGH,
        khfg: YELLOW | HIGH,
        dfg: DARKGRAY,
        dbg: BG_BLACK,
        borderFg: RED,
        accentFg: RED | HIGH,
        headerFg: RED | HIGH
    }
};

/**
 * Get a theme by name, with fallback to default
 */
function getTheme(name) {
    return THEMES[name] || THEMES.default;
}

/**
 * Merge a partial theme with defaults
 */
function mergeTheme(partial, baseName) {
    var base = getTheme(baseName || "default");
    var result = {};
    for (var key in base) {
        if (base.hasOwnProperty(key)) {
            result[key] = (partial && partial[key] !== undefined) ? partial[key] : base[key];
        }
    }
    return result;
}

// Export
this.THEMES = THEMES;
this.getTheme = getTheme;
this.mergeTheme = mergeTheme;
