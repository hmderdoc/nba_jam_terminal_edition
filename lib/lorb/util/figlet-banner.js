/**
 * figlet-banner.js - Dynamic TDF font banner rendering for LORB
 * 
 * Renders club/bar names using TheDraw fonts that fit within
 * the 80x4 banner dimensions. Uses a pre-computed list of short fonts.
 */
(function() {
    
    // Load the TDF fonts library
    var tdf = null;
    try {
        tdf = load("tdfonts_lib.js");
    } catch (e) {
        log(LOG_ERR, "[FIGLET-BANNER] Failed to load tdfonts_lib.js: " + e);
    }
    
    // Banner dimensions
    var BANNER_WIDTH = 80;
    var BANNER_HEIGHT = 4;
    
    // Pre-computed list of fonts with height <= 4
    // Generated via scan of all TDF fonts - DO NOT dynamically scan at runtime!
    var SHORT_FONTS = [
        "cryptic.tdf",
        "kevin4.tdf",
        "rod.tdf",
        "rusty.tdf",
        "scd-line.tdf"
    ];
    
    // Single cached font object (we only need one at a time)
    var cachedFont = null;
    var cachedFontPath = null;
    
    /**
     * Load a font (with simple single-entry cache)
     */
    function loadFont(fontName) {
        if (!tdf) return null;
        
        // Return cached if same font
        if (cachedFontPath === fontName && cachedFont) {
            return cachedFont;
        }
        
        try {
            tdf.opt = {};
            cachedFont = tdf.loadfont(fontName);
            cachedFontPath = fontName;
            return cachedFont;
        } catch (e) {
            return null;
        }
    }
    
    /**
     * Check if text fits within maxWidth using the given font
     */
    function textFits(text, font, maxWidth) {
        if (!tdf || !font) return false;
        
        try {
            var width = tdf.getwidth(text, font);
            return width <= maxWidth;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Render text using a random fitting font
     * Returns the rendered string (with color codes) or null if none fit
     */
    function renderRandom(text, maxWidth, maxHeight) {
        if (!tdf) return null;
        
        maxWidth = maxWidth || BANNER_WIDTH;
        
        // Shuffle the font list
        var shuffled = SHORT_FONTS.slice();
        for (var i = shuffled.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
        }
        
        // Try fonts until one fits
        for (var i = 0; i < shuffled.length; i++) {
            var font = loadFont(shuffled[i]);
            if (font && textFits(text, font, maxWidth)) {
                try {
                    tdf.opt = {
                        width: maxWidth,
                        justify: 2 // CENTER_JUSTIFY
                    };
                    return tdf.output(text, font);
                } catch (e) {
                    continue;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Render text to a Frame object for RichView integration
     */
    function renderToFrame(frame, text, fgColor, bgColor, maxWidth, maxHeight) {
        if (!frame) return false;
        
        maxWidth = maxWidth || frame.width || BANNER_WIDTH;
        maxHeight = maxHeight || frame.height || BANNER_HEIGHT;
        
        var rendered = renderRandom(text, maxWidth, maxHeight);
        
        if (!rendered) {
            // Fallback: just center the text plainly
            frame.clear();
            var padding = Math.floor((maxWidth - text.length) / 2);
            var paddedText = "";
            for (var i = 0; i < padding; i++) paddedText += " ";
            paddedText += text;
            
            frame.gotoxy(1, Math.floor(maxHeight / 2) + 1);
            frame.putmsg("\1h\1c" + paddedText + "\1n");
            return false;
        }
        
        // Clear frame and write rendered text
        frame.clear();
        frame.gotoxy(1, 1);
        frame.putmsg(rendered);
        
        return true;
    }
    
    /**
     * Get a simple fallback banner (no figlet)
     */
    function getFallbackBanner(text, width, height) {
        width = width || BANNER_WIDTH;
        height = height || BANNER_HEIGHT;
        
        var lines = [];
        var padding = Math.floor((width - text.length) / 2);
        var paddedText = "";
        for (var i = 0; i < padding; i++) paddedText += " ";
        paddedText += text;
        
        var topPad = Math.floor((height - 1) / 2);
        for (var i = 0; i < topPad; i++) {
            lines.push("");
        }
        lines.push(paddedText);
        while (lines.length < height) {
            lines.push("");
        }
        
        return lines;
    }
    
    // Export to LORB namespace
    if (typeof LORB === "undefined") {
        this.FigletBanner = {
            renderRandom: renderRandom,
            renderToFrame: renderToFrame,
            getFallbackBanner: getFallbackBanner,
            BANNER_WIDTH: BANNER_WIDTH,
            BANNER_HEIGHT: BANNER_HEIGHT
        };
    } else {
        if (!LORB.Util) LORB.Util = {};
        LORB.Util.FigletBanner = {
            renderRandom: renderRandom,
            renderToFrame: renderToFrame,
            getFallbackBanner: getFallbackBanner,
            BANNER_WIDTH: BANNER_WIDTH,
            BANNER_HEIGHT: BANNER_HEIGHT
        };
    }
    
})();
