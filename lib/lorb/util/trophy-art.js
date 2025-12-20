/**
 * trophy-art.js - Playoff Trophy Art Utility
 * 
 * Loads the trophy.bin art and dynamically writes the season number
 * as Roman numerals on the trophy plaque.
 * 
 * The plaque is at line 14, columns 17-24, centered.
 * Text is YELLOW on RED background.
 * 
 * Usage:
 *   var artFrame = view.getZone("art");
 *   LORB.Util.TrophyArt.render(artFrame, {
 *       seasonNumber: 6  // Will display "VI"
 *   });
 */
(function() {
    load("sbbsdefs.js");
    
    var TROPHY_ART_PATH = js.exec_dir + "assets/lorb/trophy.bin";
    
    // Plaque position in the art (1-indexed for Frame.gotoxy)
    var PLAQUE_Y = 14;
    var PLAQUE_X_START = 17;
    var PLAQUE_X_END = 24;
    var PLAQUE_WIDTH = PLAQUE_X_END - PLAQUE_X_START + 1;  // 8 chars
    
    /**
     * Convert a number to Roman numerals
     * @param {number} num - Number to convert (1-3999)
     * @returns {string} - Roman numeral representation
     */
    function toRomanNumerals(num) {
        if (num < 1 || num > 3999) return String(num);
        
        var result = "";
        var values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
        var numerals = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
        
        for (var i = 0; i < values.length; i++) {
            while (num >= values[i]) {
                result += numerals[i];
                num -= values[i];
            }
        }
        
        return result;
    }
    
    /**
     * Center text within a given width
     * @param {string} text - Text to center
     * @param {number} width - Width to center within
     * @returns {string} - Padded text
     */
    function centerText(text, width) {
        if (text.length >= width) return text.substring(0, width);
        var padding = Math.floor((width - text.length) / 2);
        var result = "";
        for (var i = 0; i < padding; i++) result += " ";
        result += text;
        return result;
    }
    
    /**
     * Render the trophy art with dynamic season number
     * @param {Frame} frame - The frame to render into (should be 40x20)
     * @param {Object} opts - Options
     * @param {number} opts.seasonNumber - Season number to display
     * @returns {boolean} - True if art loaded successfully
     */
    function render(frame, opts) {
        opts = opts || {};
        
        if (!frame) {
            return false;
        }
        
        // Load the base art
        var artLoaded = false;
        try {
            if (file_exists(TROPHY_ART_PATH)) {
                frame.clear();
                artLoaded = frame.load(TROPHY_ART_PATH, 40, 20);
            }
        } catch (e) {
            // Art load failed, continue without it
        }
        
        // Write the season number as Roman numerals on the plaque
        var seasonNum = opts.seasonNumber || 1;
        var romanNumeral = toRomanNumerals(seasonNum);
        var displayText = centerText(romanNumeral, PLAQUE_WIDTH);
        
        // Position and write (YELLOW on RED background)
        frame.gotoxy(PLAQUE_X_START, PLAQUE_Y);
        frame.putmsg("\1h\1y\0011" + displayText + "\1n");
        
        return artLoaded;
    }
    
    // Export to LORB namespace
    if (!LORB.Util) LORB.Util = {};
    LORB.Util.TrophyArt = {
        render: render,
        toRomanNumerals: toRomanNumerals,
        TROPHY_ART_PATH: TROPHY_ART_PATH
    };
    
})();
