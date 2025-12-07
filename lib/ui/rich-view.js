/**
 * RichView - Flexible layout manager for menu screens with ANSI art
 * 
 * Creates configurable screen layouts with:
 * - Flexible zone positioning (art, content, banners anywhere)
 * - Sub-banners that can be positioned independently per column
 * - Presets for common layouts
 * - Themed lightbar menus with onSelect/onExecute callbacks
 * - Multiline menu items for shop listings
 * - Dynamic content updates without recreating the view
 */

load("sbbsdefs.js");
load("frame.js");

// Determine lib path - works from any calling location
var _richViewLibPath = js.exec_dir;
if (_richViewLibPath.indexOf("lib/ui") === -1 && _richViewLibPath.indexOf("lib\\ui") === -1) {
    var _idx = _richViewLibPath.indexOf("nba_jam");
    if (_idx !== -1) {
        _richViewLibPath = _richViewLibPath.substring(0, _idx + 8) + "lib/ui/";
    } else {
        _richViewLibPath = "/sbbs/xtrn/nba_jam/lib/ui/";
    }
} else if (!_richViewLibPath.match(/[\/\\]$/)) {
    _richViewLibPath += "/";
}

load(_richViewLibPath + "frame-lightbar.js");
load(_richViewLibPath + "themes.js");

// Layout constants
var SCREEN_WIDTH = 80;
var SCREEN_HEIGHT = 24;
var COLUMN_WIDTH = 40;
var BANNER_HEIGHT = 4;
var MAIN_HEIGHT = 20;

// Preset layouts
var PRESETS = {
    artLeft: [
        { name: "art", x: 1, y: 1, width: 40, height: 20 },
        { name: "content", x: 41, y: 1, width: 40, height: 20 },
        { name: "footer", x: 1, y: 21, width: 80, height: 4 }
    ],
    artRight: [
        { name: "content", x: 1, y: 1, width: 40, height: 20 },
        { name: "art", x: 41, y: 1, width: 40, height: 20 },
        { name: "footer", x: 1, y: 21, width: 80, height: 4 }
    ],
    artLeftHeaderRight: [
        { name: "art", x: 1, y: 1, width: 40, height: 20 },
        { name: "header", x: 41, y: 1, width: 40, height: 4 },
        { name: "content", x: 41, y: 5, width: 40, height: 16 },
        { name: "footer", x: 1, y: 21, width: 80, height: 4 }
    ],
    artRightHeaderLeft: [
        { name: "header", x: 1, y: 1, width: 40, height: 4 },
        { name: "content", x: 1, y: 5, width: 40, height: 16 },
        { name: "art", x: 41, y: 1, width: 40, height: 20 },
        { name: "footer", x: 1, y: 21, width: 80, height: 4 }
    ],
    headerTop: [
        { name: "header", x: 1, y: 1, width: 80, height: 4 },
        { name: "art", x: 1, y: 5, width: 40, height: 16 },
        { name: "content", x: 41, y: 5, width: 40, height: 16 },
        { name: "footer", x: 1, y: 21, width: 80, height: 4 }
    ],
    contentOnly: [
        { name: "header", x: 1, y: 1, width: 80, height: 4 },
        { name: "content", x: 1, y: 5, width: 80, height: 16 },
        { name: "footer", x: 1, y: 21, width: 80, height: 4 }
    ],
    simple: [
        { name: "content", x: 1, y: 1, width: 80, height: 24 }
    ],
    twoColumn: [
        { name: "contentLeft", x: 1, y: 1, width: 40, height: 20 },
        { name: "contentRight", x: 41, y: 1, width: 40, height: 20 },
        { name: "footer", x: 1, y: 21, width: 80, height: 4 }
    ],
    artLeftSubBanner: [
        { name: "art", x: 1, y: 1, width: 40, height: 16 },
        { name: "subBannerLeft", x: 1, y: 17, width: 40, height: 4 },
        { name: "content", x: 41, y: 1, width: 40, height: 20 },
        { name: "footer", x: 1, y: 21, width: 80, height: 4 }
    ]
};

// Debug colors for zones
var DEBUG_COLORS = {
    art: BG_BLUE,
    content: BG_GREEN,
    contentLeft: BG_GREEN,
    contentRight: BG_CYAN,
    header: BG_MAGENTA,
    footer: BG_RED,
    subBannerLeft: BG_BROWN,
    subBannerRight: BG_CYAN
};

function RichView(options) {
    options = options || {};
    
    this._mainFrame = null;
    this._zones = {};
    this._zoneConfigs = [];
    this._isOpen = false;
    this._cursorY = 0;
    this._contentZoneName = "content";
    
    // Theme
    if (typeof options.theme === "string") {
        this._theme = getTheme(options.theme);
    } else if (options.theme) {
        this._theme = mergeTheme(options.theme);
    } else {
        this._theme = getTheme("default");
    }
    
    // Debug mode
    this._debug = options.debug || false;
    
    // Get zone configuration
    if (options.preset && PRESETS[options.preset]) {
        this._zoneConfigs = PRESETS[options.preset];
    } else if (options.zones && Array.isArray(options.zones)) {
        this._zoneConfigs = options.zones;
    } else {
        this._zoneConfigs = PRESETS.artLeft;
    }
    
    this._artFiles = options.art || {};
    this._init();
}

RichView.prototype._init = function() {
    this._mainFrame = new Frame(1, 1, SCREEN_WIDTH, SCREEN_HEIGHT, BG_BLACK);
    this._mainFrame.open();
    
    for (var i = 0; i < this._zoneConfigs.length; i++) {
        var config = this._zoneConfigs[i];
        var zoneBg = this._debug ? (DEBUG_COLORS[config.name] || BG_BLACK) : BG_BLACK;
        
        var frame = new Frame(config.x, config.y, config.width, config.height, zoneBg, this._mainFrame);
        frame.open();
        
        this._zones[config.name] = {
            frame: frame,
            config: config
        };
        
        if (this._artFiles[config.name]) {
            this._loadArt(frame, this._artFiles[config.name]);
        }
    }
    
    // Find primary content zone
    if (this._zones.content) {
        this._contentZoneName = "content";
    } else if (this._zones.contentLeft) {
        this._contentZoneName = "contentLeft";
    } else {
        for (var name in this._zones) {
            if (this._zones.hasOwnProperty(name)) {
                this._contentZoneName = name;
                break;
            }
        }
    }
    
    this._isOpen = true;
    this._cursorY = 0;
    this.render();
};

RichView.prototype._loadArt = function(frame, filepath) {
    if (!frame) return;
    
    try {
        var fullPath = filepath;
        if (filepath.indexOf("/") !== 0) {
            var rootIdx = _richViewLibPath.indexOf("lib/ui");
            if (rootIdx === -1) rootIdx = _richViewLibPath.indexOf("lib\\ui");
            var rootPath = rootIdx !== -1 ? _richViewLibPath.substring(0, rootIdx) : "/sbbs/xtrn/nba_jam/";
            fullPath = rootPath + filepath;
        }
        frame.load(fullPath, frame.width, frame.height);
    } catch (e) {
        log(LOG_WARNING, "RichView: Failed to load art: " + filepath + " - " + e);
    }
};

RichView.prototype.getZone = function(name) {
    return this._zones[name] ? this._zones[name].frame : null;
};

RichView.prototype.getZoneConfig = function(name) {
    return this._zones[name] ? this._zones[name].config : null;
};

RichView.prototype.getContentFrame = function() {
    return this.getZone(this._contentZoneName);
};

RichView.prototype.setContentZone = function(name) {
    if (this._zones[name]) {
        this._contentZoneName = name;
        this._cursorY = 0;
    }
};

RichView.prototype.render = function() {
    if (this._mainFrame) {
        this._mainFrame.cycle();
    }
};

/**
 * Clear a specific zone or the current content zone
 */
RichView.prototype.clear = function(zoneName) {
    var frame = this.getZone(zoneName || this._contentZoneName);
    if (frame) {
        frame.clear();
        if (!zoneName || zoneName === this._contentZoneName) {
            this._cursorY = 0;
        }
    }
    this.render();
};

/**
 * Clear and reset a zone, keeping zone intact
 */
RichView.prototype.clearZone = function(zoneName) {
    var zone = this._zones[zoneName];
    if (zone && zone.frame) {
        zone.frame.clear();
    }
    this.render();
};

/**
 * Update content in a zone without clearing it entirely
 * Useful for dynamic updates like hover effects
 */
RichView.prototype.updateZone = function(zoneName, updateFn) {
    var frame = this.getZone(zoneName);
    if (frame && typeof updateFn === "function") {
        updateFn(frame, this);
        this.render();
    }
};

RichView.prototype.header = function(text) {
    var frame = this.getContentFrame();
    if (!frame) return;
    
    frame.gotoxy(1, this._cursorY + 1);
    frame.putmsg(attrToCtrl(this._theme.headerFg, this._theme.bg) + text + "\1n");
    this._cursorY++;
    this.render();
};

RichView.prototype.line = function(text) {
    var frame = this.getContentFrame();
    if (!frame) return;
    
    frame.gotoxy(1, this._cursorY + 1);
    frame.putmsg(attrToCtrl(this._theme.fg, this._theme.bg) + (text || "") + "\1n");
    this._cursorY++;
    this.render();
};

RichView.prototype.blank = function() {
    this._cursorY++;
};

RichView.prototype.warn = function(text) {
    var frame = this.getContentFrame();
    if (!frame) return;
    
    frame.gotoxy(1, this._cursorY + 1);
    frame.putmsg("\1h\1r" + text + "\1n");
    this._cursorY++;
    this.render();
};

RichView.prototype.info = function(text) {
    var frame = this.getContentFrame();
    if (!frame) return;
    
    frame.gotoxy(1, this._cursorY + 1);
    frame.putmsg("\1c" + text + "\1n");
    this._cursorY++;
    this.render();
};

/**
 * Display a lightbar menu with optional callbacks
 * options.onSelect - called when selection changes (for hover effects)
 * options.onExecute - called when Enter pressed
 * options.multiline - enable multiline items (for shop listings)
 * options.detailIndent - indent for detail lines (default 2)
 * options.height - explicit viewport height (auto-calculated if not specified)
 */
RichView.prototype.menu = function(items, options) {
    options = options || {};
    
    var zoneName = options.zone || this._contentZoneName;
    var frame = this.getZone(zoneName);
    if (!frame) return null;
    
    var zoneConfig = this._zones[zoneName].config;
    var menuX = options.x !== undefined ? options.x : 2;
    var menuY = options.y !== undefined ? options.y : (this._cursorY + 1);
    var menuWidth = options.width || (zoneConfig.width - 4);
    
    // Calculate available height for the menu viewport
    // If not explicitly provided, use remaining space in the zone
    var menuHeight;
    if (options.height !== undefined) {
        menuHeight = options.height;
    } else {
        // Calculate remaining height from menuY to bottom of zone
        menuHeight = zoneConfig.height - menuY + 1;
    }
    
    var self = this;
    
    // Allow theme override for this specific menu
    var menuTheme = options.theme || this._theme;
    
    var menu = new FrameLightbar({
        frame: frame,
        x: menuX,
        y: menuY,
        width: menuWidth,
        height: menuHeight,
        items: items,
        theme: menuTheme,
        align: options.align || 0,
        hotkeys: options.hotkeys || "",
        multiline: options.multiline || false,
        detailIndent: options.detailIndent !== undefined ? options.detailIndent : 2,
        onSelect: options.onSelect ? function(item, index, lb) {
            options.onSelect(item, index, self, lb);
        } : null,
        onExecute: options.onExecute ? function(item, index, lb) {
            return options.onExecute(item, index, self, lb);
        } : null,
        onLeftRight: options.onLeftRight ? function(item, index, direction, lb) {
            return options.onLeftRight(item, index, direction, self, lb);
        } : null
    });
    
    if (options.selected !== undefined) {
        menu.setCurrentIndex(options.selected);
    }
    
    return menu.getval();
};

RichView.prototype.prompt = function(text, maxLen) {
    var frame = this.getContentFrame();
    if (!frame) return "";
    
    frame.gotoxy(1, this._cursorY + 1);
    frame.putmsg(attrToCtrl(this._theme.fg, this._theme.bg) + text);
    this._cursorY++;
    this.render();
    
    return console.getstr("", maxLen || 32);
};

RichView.prototype.confirm = function(text) {
    var frame = this.getContentFrame();
    if (!frame) return false;
    
    frame.gotoxy(1, this._cursorY + 1);
    frame.putmsg(attrToCtrl(this._theme.fg, this._theme.bg) + text);
    this.render();
    
    var key = console.getkeys("YNyn", 0);
    this._cursorY++;
    return (key && key.toUpperCase() === "Y");
};

RichView.prototype.drawAt = function(zoneName, x, y, text, attr) {
    var frame = this.getZone(zoneName);
    if (!frame) return;
    
    frame.gotoxy(x, y);
    if (attr) {
        frame.putmsg(attrToCtrl(attr & 0x0F, attr & 0xF0) + text + "\1n");
    } else {
        frame.putmsg(text);
    }
    this.render();
};

RichView.prototype.fillZone = function(zoneName, char, attr) {
    var frame = this.getZone(zoneName);
    if (!frame) return;
    
    char = char || " ";
    var line = "";
    for (var i = 0; i < frame.width; i++) line += char;
    
    var prefix = attr ? attrToCtrl(attr & 0x0F, attr & 0xF0) : "";
    
    for (var y = 0; y < frame.height; y++) {
        frame.gotoxy(1, y + 1);
        frame.putmsg(prefix + line + "\1n");
    }
    this.render();
};

RichView.prototype.getCursorY = function() {
    return this._cursorY;
};

RichView.prototype.setCursorY = function(y) {
    this._cursorY = y;
};

RichView.prototype.getTheme = function() {
    return this._theme;
};

RichView.prototype.close = function() {
    for (var name in this._zones) {
        if (this._zones.hasOwnProperty(name) && this._zones[name].frame) {
            try { this._zones[name].frame.close(); } catch (e) {}
        }
    }
    this._zones = {};
    
    if (this._mainFrame) {
        try { this._mainFrame.close(); } catch (e) {}
        this._mainFrame = null;
    }
    this._isOpen = false;
};

RichView.prototype.isOpen = function() {
    return this._isOpen;
};

RichView.getPresets = function() {
    var list = [];
    for (var name in PRESETS) {
        if (PRESETS.hasOwnProperty(name)) list.push(name);
    }
    return list;
};

function attrToCtrl(fg, bg) {
    var code = "\1n";
    
    switch (bg) {
        case BG_BLACK:   code += "\1" + "0"; break;
        case BG_BLUE:    code += "\1" + "4"; break;
        case BG_GREEN:   code += "\1" + "2"; break;
        case BG_CYAN:    code += "\1" + "6"; break;
        case BG_RED:     code += "\1" + "1"; break;
        case BG_MAGENTA: code += "\1" + "5"; break;
        case BG_BROWN:   code += "\1" + "3"; break;
        case BG_LIGHTGRAY: code += "\1" + "7"; break;
    }
    
    if (fg & HIGH) {
        code += "\1h";
        fg = fg & ~HIGH;
    }
    
    switch (fg & 0x07) {
        case BLACK:     code += "\1k"; break;
        case BLUE:      code += "\1b"; break;
        case GREEN:     code += "\1g"; break;
        case CYAN:      code += "\1c"; break;
        case RED:       code += "\1r"; break;
        case MAGENTA:   code += "\1m"; break;
        case BROWN:     code += "\1y"; break;
        case LIGHTGRAY: code += "\1w"; break;
    }
    
    return code;
}

// Export
this.RichView = RichView;
this.RICHVIEW_PRESETS = PRESETS;
this.RICHVIEW_CONSTANTS = {
    SCREEN_WIDTH: SCREEN_WIDTH,
    SCREEN_HEIGHT: SCREEN_HEIGHT,
    COLUMN_WIDTH: COLUMN_WIDTH,
    BANNER_HEIGHT: BANNER_HEIGHT,
    MAIN_HEIGHT: MAIN_HEIGHT
};
