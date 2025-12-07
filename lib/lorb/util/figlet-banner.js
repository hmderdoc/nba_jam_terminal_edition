/**
 * figlet-banner.js - Dynamic TDF font banner rendering for LORB
 * 
 * Renders club/bar names using TheDraw fonts that fit within
 * the banner dimensions. Modeled after FigletMessage from canvas-animations.js.
 * Falls back to plain text when figlet doesn't fit.
 * 
 * Features gradient shading for two/three-tone effects using CP437 shade chars.
 */
(function() {
    "use strict";
    
    // Banner dimensions
    var BANNER_WIDTH = 80;
    var BANNER_HEIGHT = 4;
    
    // TDF library singleton (loaded once, reused)
    var _tdf = null;
    
    // CP437 shade character codes for gradient effects
    // ░ = 176 (light), ▒ = 177 (medium), ▓ = 178 (dark), █ = 219 (solid)
    var CHAR_LIGHT_SHADE = 176;
    var CHAR_MED_SHADE = 177;
    var CHAR_DARK_SHADE = 178;
    var CHAR_SOLID = 219;
    
    // CP437 box-drawing character classifications for edge detection
    // Top edge chars: ┌ ┐ ─ ┬ ╔ ╗ ═ ╦ ▀ (tops of letters get highlight)
    var TOP_EDGE_CHARS = [218, 191, 196, 194, 201, 187, 205, 203, 223];
    // Bottom edge chars: └ ┘ ─ ┴ ╚ ╝ ═ ╩ ▄ (bottoms get shadow)
    var BOTTOM_EDGE_CHARS = [192, 217, 196, 193, 200, 188, 205, 202, 220];
    // Vertical chars: │ ║ (sides - neutral)
    var VERTICAL_CHARS = [179, 186];
    
    // Color gradient mappings: base color -> [bright, normal, dim, shadow]
    // Index 0 = brightest (highlights), Index 3 = darkest (shadows)
    var COLOR_GRADIENTS = {
        // Bright colors get full gradient
        15: [15, 15, 7, 8],    // WHITE -> WHITE, WHITE, LIGHTGRAY, DARKGRAY
        14: [15, 14, 6, 8],    // YELLOW -> WHITE, YELLOW, BROWN, DARKGRAY
        13: [15, 13, 5, 8],    // LIGHTMAGENTA -> WHITE, LIGHTMAGENTA, MAGENTA, DARKGRAY
        12: [14, 12, 4, 8],    // LIGHTRED -> YELLOW, LIGHTRED, RED, DARKGRAY
        11: [15, 11, 3, 8],    // LIGHTCYAN -> WHITE, LIGHTCYAN, CYAN, DARKGRAY
        10: [14, 10, 2, 8],    // LIGHTGREEN -> YELLOW, LIGHTGREEN, GREEN, DARKGRAY
        9:  [11, 9, 1, 8],     // LIGHTBLUE -> LIGHTCYAN, LIGHTBLUE, BLUE, DARKGRAY
        // Normal colors - shifted gradient
        7:  [15, 7, 8, 0],     // LIGHTGRAY -> WHITE, LIGHTGRAY, DARKGRAY, BLACK
        6:  [14, 6, 8, 0],     // BROWN -> YELLOW, BROWN, DARKGRAY, BLACK
        5:  [13, 5, 8, 0],     // MAGENTA
        4:  [12, 4, 8, 0],     // RED
        3:  [11, 3, 8, 0],     // CYAN
        2:  [10, 2, 8, 0],     // GREEN
        1:  [9, 1, 8, 0]       // BLUE
    };
    
    // Curated list of TDF fonts with height <= 4 (verified on this system)
    // Prioritizing visually interesting fonts; serpentx is the scoreboard font
    var SHORT_FONTS = [
        // Height 3 - preferred (more headroom)
        "serpentx.tdf",    // Scoreboard font - sleek, readable
        "fbrx.tdf",        // Bold, blocky
        "finestx.tdf",     // Clean
        "headx.tdf",       // Strong headers
        "iceblock.tdf",    // Chunky ice blocks
        "incorpex.tdf",    // Corporate feel
        "dreadlk.tdf",     // Edgy
        "fire.tdf",        // Flame style
        "dragon2x.tdf",    // Dragon theme
        "rusty.tdf",       // Weathered look
        "rod-blue.tdf",    // Rod variants
        "rod-grn.tdf",
        "rod-red.tdf",
        // Height 4 - still fits
        "4maxcol.tdf",     // Colorful blocks
        "cartoon.tdf",     // Fun cartoon style
        "neon.tdf",        // Neon glow effect
        "nirvana.tdf",     // Stylized
        "pepper.tdf",      // Spicy
        "silver2.tdf",     // Metallic
        "revolutx.tdf"     // Revolutionary
    ];
    
    /**
     * Get or initialize the TDF library singleton
     */
    function getTdf() {
        if (!_tdf) {
            _tdf = load("tdfonts_lib.js");
            if (_tdf && !_tdf.opt) _tdf.opt = {};
        }
        return _tdf;
    }
    
    /**
     * Determine gradient index based on character type and position.
     * Returns 0-3: 0=brightest (highlight), 3=darkest (shadow)
     * 
     * @param {string} ch - Character being rendered
     * @param {number} row - Row index (0-based)
     * @param {number} totalRows - Total number of rows
     * @returns {number} - Gradient index 0-3
     */
    function getGradientIndex(ch, row, totalRows) {
        if (!ch) return 1;
        
        var code = ch.charCodeAt(0);
        
        // Shade characters: explicit gradient mapping
        switch (code) {
            case CHAR_SOLID:       return 0;  // █ brightest
            case CHAR_DARK_SHADE:  return 1;  // ▓ 
            case CHAR_MED_SHADE:   return 2;  // ▒
            case CHAR_LIGHT_SHADE: return 3;  // ░ dimmest
        }
        
        // Box-drawing edge detection
        if (TOP_EDGE_CHARS.indexOf(code) !== -1) {
            return 0;  // Top edges get highlight
        }
        if (BOTTOM_EDGE_CHARS.indexOf(code) !== -1) {
            return 2;  // Bottom edges get shadow
        }
        if (VERTICAL_CHARS.indexOf(code) !== -1) {
            return 1;  // Vertical bars are neutral
        }
        
        // For other characters, use vertical position gradient
        // Top rows brighter, bottom rows dimmer (simulates top-down lighting)
        if (totalRows <= 1) return 1;
        
        var position = row / (totalRows - 1);  // 0.0 = top, 1.0 = bottom
        if (position < 0.33) return 0;         // Top third: highlight
        if (position < 0.66) return 1;         // Middle: normal
        return 2;                               // Bottom third: dim
    }
    
    /**
     * Get shaded color attribute based on character, position, and base color.
     * Creates multi-tone gradient effect using shade chars, edges, and row position.
     * 
     * @param {string} ch - The character being rendered
     * @param {number} baseFg - Base foreground color (0-15)
     * @param {number} row - Current row (0-based)
     * @param {number} totalRows - Total rows in the figlet
     * @returns {number} - Color attribute to use
     */
    function getShadedColor(ch, baseFg, row, totalRows) {
        var gradient = COLOR_GRADIENTS[baseFg];
        
        // If no gradient defined for this color, use base
        if (!gradient) return baseFg;
        
        var idx = getGradientIndex(ch, row, totalRows);
        return gradient[idx];
    }
    
    /**
     * Strip ANSI escape sequences and Ctrl-A codes from text
     */
    function sanitize(text) {
        if (!text) return "";
        var plain = text.replace(/\r/g, "");
        plain = plain.replace(/\x1B\[[0-9;]*m/g, "");  // ANSI
        plain = plain.replace(/\x01./g, "");           // Ctrl-A codes
        return plain;
    }
    
    /**
     * Split text into lines and measure dimensions
     */
    function measureLines(text) {
        var clean = sanitize(text);
        var lines = clean.split("\n");
        // Remove trailing empty lines
        while (lines.length && lines[lines.length - 1].trim() === "") {
            lines.pop();
        }
        var maxLen = 0;
        for (var i = 0; i < lines.length; i++) {
            var ln = lines[i].replace(/\s+$/, "");
            if (ln.length > maxLen) maxLen = ln.length;
        }
        return { lines: lines, width: maxLen, height: lines.length };
    }
    
    /**
     * Try to render text with a specific font
     * Returns { lines: [], width: N, height: N } or null on failure
     */
    function tryRenderFont(message, fontName, maxWidth) {
        var tdf = getTdf();
        if (!tdf) return null;
        
        try {
            // Check if font file exists before trying to load
            var fontPath = "/sbbs/ctrl/tdfonts/" + fontName;
            if (typeof file_exists === "function" && !file_exists(fontPath)) {
                return null;
            }
            
            var fontObj = tdf.loadfont(fontName);
            if (!fontObj) return null;
            
            tdf.opt.width = maxWidth;
            tdf.opt.justify = tdf.CENTER_JUSTIFY || 2;
            tdf.opt.margin = 0;
            tdf.opt.wrap = false;
            tdf.opt.blankline = false;
            tdf.opt.ansi = false;
            tdf.opt.random = false;
            
            var output = tdf.output(message, fontObj);
            if (!output) return null;
            
            return measureLines(output);
        } catch (e) {
            // Font load or render failed - return null to try next font
            return null;
        }
    }
    
    /**
     * Create plain text fallback centered in the frame
     */
    function getPlainLines(text, width, height) {
        var padding = Math.max(0, Math.floor((width - text.length) / 2));
        var spaces = "";
        for (var i = 0; i < padding; i++) spaces += " ";
        
        var lines = [];
        var topPad = Math.max(0, Math.floor((height - 1) / 2));
        for (var i = 0; i < topPad; i++) lines.push("");
        lines.push(spaces + text);
        while (lines.length < height) lines.push("");
        
        return lines;
    }
    
    /**
     * Render text to figlet, falling back to plain text if needed.
     * Returns array of sanitized lines (no color codes).
     */
    function renderLines(text, maxWidth, maxHeight) {
        maxWidth = maxWidth || BANNER_WIDTH;
        maxHeight = maxHeight || BANNER_HEIGHT;
        
        // Try fonts from our pre-filtered list
        var shuffled = SHORT_FONTS.slice();
        for (var i = shuffled.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = tmp;
        }
        
        // Try up to 5 random fonts
        var attempts = Math.min(5, shuffled.length);
        for (var a = 0; a < attempts; a++) {
            var result = tryRenderFont(text, shuffled[a], maxWidth);
            if (result && result.height <= maxHeight && result.width <= maxWidth) {
                return result.lines;
            }
        }
        
        // Fallback to plain centered text
        return getPlainLines(text, maxWidth, maxHeight);
    }
    
    /**
     * Render text to a Frame object for RichView integration.
     * Uses team colors from current city if available.
     */
    function renderToFrame(frame, text, fgAttr, bgAttr) {
        if (!frame || !text) return false;
        
        var maxWidth = frame.width || BANNER_WIDTH;
        var maxHeight = frame.height || BANNER_HEIGHT;
        
        // Resolve foreground attribute
        var fg = fgAttr;
        if (typeof fg !== "number") {
            fg = (typeof WHITE === "number") ? WHITE : 7;
            // Try to get team color
            try {
                if (typeof LORB !== "undefined" && LORB.Cities) {
                    var city = LORB.Cities.getToday ? LORB.Cities.getToday() : null;
                    if (city && LORB.Cities.getTeamColors) {
                        var colors = LORB.Cities.getTeamColors(city);
                        if (colors && typeof colors.fgAttr === "number") {
                            fg = colors.fgAttr;
                        }
                    }
                }
            } catch (e) {}
        }
        
        // Get rendered lines
        var lines = renderLines(text, maxWidth, maxHeight);
        
        // Clear frame
        try {
            frame.clear();
        } catch (e) {}
        
        // Background attribute (usually BG_BLACK = 0)
        var bgMask = (typeof BG_BLACK === "number") ? BG_BLACK : 0;
        
        // Count actual content rows for gradient calculation
        var totalRows = lines.length;
        
        // Draw each line using setData for character-by-character control
        // Apply gradient shading based on shade characters, edge detection, and row position
        for (var row = 0; row < lines.length && row < maxHeight; row++) {
            var line = lines[row] || "";
            for (var col = 0; col < line.length && col < maxWidth; col++) {
                var ch = line.charAt(col);
                if (ch && ch !== " ") {
                    // Get shaded color for this character (creates gradient effect)
                    var shadedFg = getShadedColor(ch, fg, row, totalRows);
                    var attr = shadedFg | bgMask;
                    try {
                        frame.setData(col, row, ch, attr, false);
                    } catch (e) {}
                }
            }
        }
        
        // Refresh
        try {
            if (typeof frame.cycle === "function") frame.cycle();
        } catch (e) {}
        
        return lines.length > 0 && lines[0] !== text;  // true if figlet succeeded
    }
    
    // Export to LORB namespace
    if (typeof LORB !== "undefined") {
        if (!LORB.Util) LORB.Util = {};
        LORB.Util.FigletBanner = {
            renderToFrame: renderToFrame,
            renderLines: renderLines,
            getPlainLines: getPlainLines,
            BANNER_WIDTH: BANNER_WIDTH,
            BANNER_HEIGHT: BANNER_HEIGHT
        };
    }
    // Note: When loaded outside LORB context, functions won't be exported
    // This is intentional - figlet-banner is only used within LORB
    
})();
