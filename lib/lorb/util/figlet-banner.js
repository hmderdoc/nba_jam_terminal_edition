/**
 * figlet-banner.js - Dynamic TDF font banner rendering for LORB
 * 
 * Renders club/bar names using TheDraw fonts that fit within
 * the 80x4 banner dimensions. Uses a single reliable font.
 * Applies team colors from the current city.
 */
(function() {
    
    // Banner dimensions
    var BANNER_WIDTH = 80;
    var BANNER_HEIGHT = 4;
    
    // Use a single known-good font to avoid issues with font switching
    var PREFERRED_FONT = "rod.tdf";
    
    /**
     * Render text using TDF font library
     * Returns the rendered string (with color codes) or null on failure
     */
    function renderWithFont(text, maxWidth, teamColor) {
        var tdf = null;
        var font = null;
        
        try {
            // Load fresh TDF library each time to avoid state issues
            tdf = load("tdfonts_lib.js");
            if (!tdf) return null;
            
            // Reset options
            tdf.opt = {
                width: maxWidth || BANNER_WIDTH,
                justify: 2  // CENTER_JUSTIFY
            };
            
            // Load font
            font = tdf.loadfont(PREFERRED_FONT);
            if (!font) return null;
            
            // Check if text fits
            var width = tdf.getwidth(text, font);
            if (width > (maxWidth || BANNER_WIDTH)) {
                return null;  // Text too wide for this font
            }
            
            // Render
            var rendered = tdf.output(text, font);
            if (!rendered) return null;
            
            // Apply team color if provided
            if (teamColor) {
                var lastChar = teamColor.charAt(teamColor.length - 1);
                if (/[rgybmcwk]/i.test(lastChar)) {
                    var newColor = lastChar.toLowerCase();
                    rendered = rendered.replace(/\x01h\x01[rgybmcwk]/gi, "\x01h\x01" + newColor);
                }
            }
            
            return rendered;
        } catch (e) {
            log(LOG_ERR, "[FIGLET-BANNER] Render error: " + e);
            return null;
        }
    }
    
    /**
     * Render text to a Frame object for RichView integration.
     * Automatically uses current city's team colors if available.
     */
    function renderToFrame(frame, text, fgColor, bgColor, maxWidth, maxHeight) {
        if (!frame || !text) return false;
        
        maxWidth = maxWidth || frame.width || BANNER_WIDTH;
        maxHeight = maxHeight || frame.height || BANNER_HEIGHT;
        
        // Get team color from current city if not specified
        var teamColor = fgColor;
        if (!teamColor) {
            try {
                if (typeof LORB !== "undefined" && LORB.Cities && LORB.Cities.getToday) {
                    var city = LORB.Cities.getToday();
                    if (city && LORB.Cities.getTeamColors) {
                        var colors = LORB.Cities.getTeamColors(city);
                        teamColor = colors ? colors.fg : null;
                    }
                }
            } catch (e) {
                teamColor = null;
            }
        }
        
        // Try to render with TDF font
        var rendered = null;
        try {
            rendered = renderWithFont(text, maxWidth, teamColor);
        } catch (e) {
            rendered = null;
        }
        
        // Clear and position frame
        try {
            frame.clear();
            frame.gotoxy(1, 1);
        } catch (e) {
            return false;
        }
        
        if (rendered) {
            try {
                frame.putmsg(rendered);
                return true;
            } catch (e) {
                // Fall through to plain text
            }
        }
        
        // Fallback: plain centered text
        try {
            var padding = Math.floor((maxWidth - text.length) / 2);
            var paddedText = "";
            for (var i = 0; i < padding; i++) paddedText += " ";
            paddedText += text;
            
            var colorCode = teamColor || "\1h\1c";
            frame.gotoxy(1, Math.floor(maxHeight / 2) + 1);
            frame.putmsg(colorCode + paddedText + "\1n");
        } catch (e) {
            return false;
        }
        
        return false;
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
            renderToFrame: renderToFrame,
            getFallbackBanner: getFallbackBanner,
            BANNER_WIDTH: BANNER_WIDTH,
            BANNER_HEIGHT: BANNER_HEIGHT
        };
    } else {
        if (!LORB.Util) LORB.Util = {};
        LORB.Util.FigletBanner = {
            renderToFrame: renderToFrame,
            getFallbackBanner: getFallbackBanner,
            BANNER_WIDTH: BANNER_WIDTH,
            BANNER_HEIGHT: BANNER_HEIGHT
        };
    }
    
})();
