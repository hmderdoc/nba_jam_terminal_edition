/**
 * bin-loader.js - Shared .bin file loading utilities
 * 
 * Loads binary ANSI art files (.bin format) into Synchronet Frames.
 * .bin format: sequential char+attr pairs (2 bytes per cell), row by row
 */

var BinLoader = (function() {
    
    /**
     * Load a .bin file and return raw binary string
     * @param {string} path - Absolute path to .bin file
     * @returns {string|null} - Raw binary data or null on failure
     */
    function loadBinFile(path) {
        if (!file_exists(path)) {
            log(LOG_WARNING, "[BinLoader] File not found: " + path);
            return null;
        }
        
        var f = new File(path);
        if (!f.open("rb")) {
            log(LOG_WARNING, "[BinLoader] Cannot open: " + path);
            return null;
        }
        
        var data = f.read();
        f.close();
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
        if (binData.length < expectedSize) {
            log(LOG_WARNING, "[BinLoader] File too small: " + path + 
                " (got " + binData.length + ", expected " + expectedSize + ")");
        }
        
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
            log(LOG_WARNING, "[BinLoader] Base64 decode error: " + e);
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
