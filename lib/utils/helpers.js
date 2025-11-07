// NBA Jam Utility Helper Functions
// Common utilities used throughout the codebase

// ============================================================================
// LOGGING
// ============================================================================

// Local debug logging function
function debugLog(message) {
    try {
        var logFile = new File(js.exec_dir + "debug.log");
        logFile.open("a");
        var timestamp = new Date().toISOString();
        logFile.writeln(timestamp + " [Node " + (bbs.node_num || "?") + "] " + message);
        logFile.close();
    } catch (e) {
        // Silently fail if logging doesn't work
    }
}

// ============================================================================
// CONSOLE/DISPLAY UTILITIES
// ============================================================================

function buryCursor() {
    if (typeof console === "undefined") return;
    if (typeof console.gotoxy !== "function") return;
    if (typeof console.screen_columns !== "number" || typeof console.screen_rows !== "number") return;
    console.gotoxy(console.screen_columns, console.screen_rows);
}

function cycleFrame(frame) {
    if (!frame || typeof frame.cycle !== "function") return false;
    var updated = frame.cycle();
    if (updated) buryCursor();
    return updated;
}

// ============================================================================
// COLOR & ATTRIBUTE MANIPULATION
// ============================================================================

function bgToFg(bgValue) {
    if (typeof bgValue !== "number") return null;
    return (bgValue & BG_MASK) >> 4;
}

function composeAttrWithColor(originalAttr, newFg, newBg) {
    var attr = (typeof originalAttr === "number") ? originalAttr : 0;
    var preserved = attr & ~(FG_MASK | BG_MASK);
    var fgPart = (newFg !== undefined && newFg !== null) ? (newFg & FG_MASK) : (attr & FG_MASK);
    var bgPart = (newBg !== undefined && newBg !== null) ? (newBg & BG_MASK) : (attr & BG_MASK);
    return preserved | fgPart | bgPart;
}

// ============================================================================
// MULTIPLAYER UTILITIES
// ============================================================================

// Helper function to look up globalId from sprite (for multiplayer event broadcasting)
function getPlayerGlobalId(sprite) {
    if (!mpCoordinator || !mpCoordinator.playerSpriteMap) return null;

    for (var playerId in mpCoordinator.playerSpriteMap) {
        if (mpCoordinator.playerSpriteMap.hasOwnProperty(playerId)) {
            if (mpCoordinator.playerSpriteMap[playerId] === sprite) {
                return playerId;
            }
        }
    }
    return null;
}

// ============================================================================
// POLYFILLS
// ============================================================================

// Math.sign polyfill for older JS environments
if (typeof Math.sign !== "function") {
    Math.sign = function (value) {
        var n = Number(value);
        if (isNaN(n) || n === 0) return 0;
        return n > 0 ? 1 : -1;
    };
}

// ============================================================================
// STRING HELPERS
// ============================================================================

function padStart(str, length, padChar) {
    str = String(str);
    while (str.length < length) {
        str = padChar + str;
    }
    return str;
}

function padEnd(str, length, padChar) {
    str = String(str);
    while (str.length < length) {
        str = str + padChar;
    }
    return str;
}

function repeatChar(ch, count) {
    var out = "";
    for (var i = 0; i < count; i++) out += ch;
    return out;
}

// ============================================================================
// GENERIC HELPERS
// ============================================================================

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

// ============================================================================
// FRAME PROTOTYPE EXTENSIONS
// ============================================================================

log(LOG_INFO, "NBA JAM: About to add Frame.prototype.drawBorder");

// Add drawBorder method to Frame prototype
Frame.prototype.drawBorder = function (color, opts) {
    var options = opts || {};
    var colorParam = color;
    if (color && typeof color === "object" && !Array.isArray(color)) {
        options = color;
        colorParam = color.color;
    } else if (typeof options === "object" && options.color === undefined) {
        // options already set explicitly
        colorParam = color;
    }
    var theColor = colorParam;
    var sectionLength;
    if (Array.isArray(colorParam)) {
        sectionLength = Math.round(this.width / colorParam.length);
    }
    var borderAttrFallback = (Array.isArray(colorParam) ? colorParam[0] : (colorParam || this.attr));
    this.pushxy();
    for (var y = 1; y <= this.height; y++) {
        for (var x = 1; x <= this.width; x++) {
            if (x > 1 && x < this.width && y > 1 && y < this.height)
                continue;
            var msg;
            this.gotoxy(x, y);
            if (y == 1 && x == 1)
                msg = ascii(218);
            else if (y == 1 && x == this.width)
                msg = ascii(191);
            else if (y == this.height && x == 1)
                msg = ascii(192);
            else if (y == this.height && x == this.width)
                msg = ascii(217);
            else if (x == 1 || x == this.width)
                msg = ascii(179);
            else
                msg = ascii(196);
            if (Array.isArray(colorParam)) {
                if (x == 1)
                    theColor = colorParam[0];
                else if (sectionLength > 0 && x % sectionLength == 0 && x < this.width)
                    theColor = colorParam[x / sectionLength];
                else if (x == this.width)
                    theColor = colorParam[colorParam.length - 1];
            }
            this.putmsg(msg, theColor !== undefined ? theColor : borderAttrFallback);
        }
    }
    if (options && options.title) {
        var title = String(options.title);
        var titleAttr = (options.titleAttr !== undefined) ? options.titleAttr : (Array.isArray(colorParam) ? borderAttrFallback : (colorParam !== undefined ? colorParam : this.attr));
        var maxLen = Math.max(0, this.width - 2);
        if (title.length > maxLen) {
            title = title.substring(0, maxLen);
        }
        if (title.length > 0) {
            var titleStart = Math.max(2, Math.floor((this.width - title.length) / 2) + 1);
            if (titleStart + title.length - 1 >= this.width)
                titleStart = this.width - title.length;
            var prevAtcodes = this.atcodes;
            this.atcodes = false;
            this.gotoxy(titleStart, 1);
            this.putmsg(title, titleAttr);
            this.atcodes = prevAtcodes;
        }
    }
    this.popxy();
};
