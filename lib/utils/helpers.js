// NBA Jam Utility Helper Functions
// Common utilities used throughout the codebase

// ============================================================================
// POLYFILLS - For older JavaScript engines
// ============================================================================

// Array.prototype.find polyfill (not available in SpiderMonkey 1.8.5)
// CRITICAL: Must be non-enumerable to avoid breaking for-in loops
if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
        value: function (predicate) {
            if (this == null) {
                throw new TypeError('Array.prototype.find called on null or undefined');
            }
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            var list = Object(this);
            var length = list.length >>> 0;
            var thisArg = arguments[1];
            for (var i = 0; i < length; i++) {
                var value = list[i];
                if (predicate.call(thisArg, value, i, list)) {
                    return value;
                }
            }
            return undefined;
        },
        enumerable: false,
        configurable: true,
        writable: true
    });
}

// ============================================================================
// LOGGING
// ============================================================================

// Debug logging - ENABLED for JSONClient timeout investigation
var DEBUG_LOGGING_ENABLED = true;

// Local debug logging function
function debugLog(message) {
    if (!DEBUG_LOGGING_ENABLED) return;
    try {
        var logFile = new File("/sbbs/xtrn/nba_jam/debug.log");
        if (logFile.open("a")) {
            var timestamp = new Date().toISOString();
            logFile.writeln(timestamp + " [Node " + (typeof bbs !== "undefined" && bbs.node_num ? bbs.node_num : "?") + "] " + message);
            logFile.close();
        }
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
// STRING HELPERS (moved to lib/utils/string-helpers.js)
// ============================================================================
// Note: padStart(), padEnd(), and repeatChar() are now in string-helpers.js
// to avoid duplication and consolidate string formatting utilities.

// ============================================================================
// GENERIC HELPERS
// ============================================================================

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

// ============================================================================
// FRAME UTILITIES (Standalone functions - DO NOT modify Frame.prototype!)
// ============================================================================

/**
 * Draw border on a frame (standalone function to avoid prototype pollution)
 * @param {Frame} frame - The frame object to draw border on
 * @param {number|array|object} color - Border color or options object
 * @param {object} opts - Additional options
 */
function drawFrameBorder(frame, color, opts) {
    if (!frame) return;

    var options = opts || {};
    var colorParam = color;
    if (color && typeof color === "object" && !Array.isArray(color)) {
        options = color;
        colorParam = color.color;
    } else if (typeof options === "object" && options.color === undefined) {
        colorParam = color;
    }
    var theColor = colorParam;
    var sectionLength;
    if (Array.isArray(colorParam)) {
        sectionLength = Math.round(frame.width / colorParam.length);
    }
    var borderAttrFallback = (Array.isArray(colorParam) ? colorParam[0] : (colorParam || frame.attr));
    frame.pushxy();
    for (var y = 1; y <= frame.height; y++) {
        for (var x = 1; x <= frame.width; x++) {
            if (x > 1 && x < frame.width && y > 1 && y < frame.height)
                continue;
            var msg;
            frame.gotoxy(x, y);
            if (y == 1 && x == 1)
                msg = ascii(218);
            else if (y == 1 && x == frame.width)
                msg = ascii(191);
            else if (y == frame.height && x == 1)
                msg = ascii(192);
            else if (y == frame.height && x == frame.width)
                msg = ascii(217);
            else if (x == 1 || x == frame.width)
                msg = ascii(179);
            else
                msg = ascii(196);
            if (Array.isArray(colorParam)) {
                if (x == 1)
                    theColor = colorParam[0];
                else if (sectionLength > 0 && x % sectionLength == 0 && x < frame.width)
                    theColor = colorParam[x / sectionLength];
                else if (x == frame.width)
                    theColor = colorParam[colorParam.length - 1];
            }
            frame.putmsg(msg, theColor !== undefined ? theColor : borderAttrFallback);
        }
    }
    if (options && options.title) {
        var title = String(options.title);
        var titleAttr = (options.titleAttr !== undefined) ? options.titleAttr : (Array.isArray(colorParam) ? borderAttrFallback : (colorParam !== undefined ? colorParam : frame.attr));
        var maxLen = Math.max(0, frame.width - 2);
        if (title.length > maxLen) {
            title = title.substring(0, maxLen);
        }
        if (title.length > 0) {
            var titleStart = Math.max(2, Math.floor((frame.width - title.length) / 2) + 1);
            if (titleStart + title.length - 1 >= frame.width)
                titleStart = frame.width - title.length;
            // Save atcodes state (default to false if undefined to avoid restoring undefined)
            var prevAtcodes = (typeof frame.atcodes === "boolean") ? frame.atcodes : false;
            frame.atcodes = false;
            frame.gotoxy(titleStart, 1);
            frame.putmsg(title, titleAttr);
            frame.atcodes = prevAtcodes;
        }
    }
    frame.popxy();
}

// Add as method ONLY if Frame doesn't already have it (backward compatibility)
if (typeof Frame !== 'undefined' && typeof Frame.prototype.drawBorder === 'undefined') {
    Frame.prototype.drawBorder = function (color, opts) {
        drawFrameBorder(this, color, opts);
    };
}
