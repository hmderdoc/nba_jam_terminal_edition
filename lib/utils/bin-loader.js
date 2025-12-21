/**
 * bin-loader.js - Shared .bin file loading utilities
 * 
 * Loads binary ANSI art files (.bin format) into Synchronet Frames.
 * .bin format: sequential char+attr pairs (2 bytes per cell), row by row
 */

var BinLoader = (function() {
    
    /**
     * Load a .bin file and return raw binary string
     * Automatically strips SAUCE record if present
     * @param {string} path - Absolute path to .bin file
     * @returns {string|null} - Raw binary data or null on failure
     */
    function loadBinFile(path) {
        if (!file_exists(path)) {
            return null;
        }
        
        var f = new File(path);
        if (!f.open("rb")) {
            return null;
        }
        
        var data = f.read();
        f.close();
        
        // Check for SAUCE record (128 bytes at end, starts with "SAUCE")
        // SAUCE record starts 128 bytes from end with signature "SAUCE"
        // Often preceded by EOF marker (0x1A / Ctrl-Z)
        if (data.length >= 128) {
            var sauceOffset = data.length - 128;
            var sauceSig = data.substr(sauceOffset, 5);
            if (sauceSig === "SAUCE") {
                // Strip the SAUCE record
                data = data.substr(0, sauceOffset);
                
                // Also strip EOF marker if present (0x1A)
                if (data.length > 0 && data.charCodeAt(data.length - 1) === 0x1A) {
                    data = data.substr(0, data.length - 1);
                }
            }
        }
        
        return data;
    }
    
    /**
     * Blit binary data directly into a Frame
     * @param {Frame} frame - Target frame
     * @param {string} binData - Raw binary string (char+attr pairs)
     * @param {number} w - Width of source image
     * @param {number} h - Height of source image
     * @param {number} dstX - Destination X in frame (1-based)
     * @param {number} dstY - Destination Y in frame (1-based)
     */
    function blitToFrame(frame, binData, w, h, dstX, dstY) {
        if (!frame || !binData) return false;
        
        dstX = dstX || 1;
        dstY = dstY || 1;
        
        var offset = 0;
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                if (offset + 1 >= binData.length) return true; // Done early
                
                var ch = binData.substr(offset++, 1);
                var attr = ascii(binData.substr(offset++, 1));
                
                try {
                    // setData uses 0-based coordinates internally
                    frame.setData(dstX + x - 1, dstY + y - 1, ch, attr, false);
                } catch (e) {
                    // Ignore out-of-bounds errors
                }
            }
        }
        return true;
    }
    
    /**
     * Load a .bin file directly into a Frame
     * @param {Frame} frame - Target frame
     * @param {string} path - Path to .bin file
     * @param {number} w - Width of the .bin image
     * @param {number} h - Height of the .bin image
     * @param {number} [dstX=1] - Destination X (1-based)
     * @param {number} [dstY=1] - Destination Y (1-based)
     * @returns {boolean} - Success
     */
    function loadIntoFrame(frame, path, w, h, dstX, dstY) {
        var binData = loadBinFile(path);
        if (!binData) return false;
        
        // Verify size: should be w * h * 2 bytes (char + attr per cell)
        var expectedSize = w * h * 2;
        
        
        return blitToFrame(frame, binData, w, h, dstX || 1, dstY || 1);
    }
    
    /**
     * Decode base64 avatar data and blit to frame
     * @param {Frame} frame - Target frame
     * @param {string} base64Data - Base64 encoded bin data
     * @param {number} w - Width
     * @param {number} h - Height
     * @param {number} [dstX=1] - Destination X (1-based)
     * @param {number} [dstY=1] - Destination Y (1-based)
     * @returns {boolean} - Success
     */
    function blitBase64ToFrame(frame, base64Data, w, h, dstX, dstY) {
        if (!base64Data || typeof base64_decode !== 'function') return false;
        
        try {
            var binData = base64_decode(base64Data);
            return blitToFrame(frame, binData, w, h, dstX || 1, dstY || 1);
        } catch (e) {
            return false;
        }
    }
    
    // Public API
    return {
        loadBinFile: loadBinFile,
        blitToFrame: blitToFrame,
        loadIntoFrame: loadIntoFrame,
        blitBase64ToFrame: blitBase64ToFrame
    };
    
})();
