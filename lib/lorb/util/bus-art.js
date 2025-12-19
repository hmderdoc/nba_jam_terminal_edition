/**
 * bus-art.js - Baller Bus Art Utility
 * 
 * Loads the baller_bus.bin art and dynamically writes the route sign
 * showing origin and destination cities.
 * 
 * The route sign is at line 4, column 7 in the format:
 * "DAL->OKC" where DAL is origin (red) and OKC is destination (yellow)
 * 
 * Usage:
 *   var artFrame = view.getZone("art");
 *   LORB.Util.BusArt.render(artFrame, {
 *       origin: previousCity,      // city object with .id
 *       destination: currentCity   // city object with .id
 *   });
 */
(function() {
    load("sbbsdefs.js");
    
    var BUS_ART_PATH = js.exec_dir + "assets/lorb/baller_bus.bin";
    
    // Route sign position in the art (1-indexed for Frame.gotoxy)
    var SIGN_ORIGIN_X = 7;
    var SIGN_ORIGIN_Y = 4;
    var SIGN_DEST_X = 12;
    var SIGN_DEST_Y = 4;
    
    /**
     * Get 3-letter city code (uppercase)
     * @param {Object|string} city - City object with .id, or string id
     * @returns {string} - Uppercase 3-letter code
     */
    function getCityCode(city) {
        if (!city) return "???";
        var id = (typeof city === "string") ? city : city.id;
        return String(id || "???").toUpperCase().substring(0, 3);
    }
    
    /**
     * Render the baller bus art with dynamic route sign
     * @param {Frame} frame - The frame to render into (should be 40x20)
     * @param {Object} opts - Options
     * @param {Object|string} opts.origin - Origin city (object with .id or string)
     * @param {Object|string} opts.destination - Destination city (object with .id or string)
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
            if (file_exists(BUS_ART_PATH)) {
                frame.clear();
                artLoaded = frame.load(BUS_ART_PATH, 40, 20);
            }
        } catch (e) {
            // Art load failed, continue without it
        }
        
        // Write the dynamic route sign over the art
        var originCode = getCityCode(opts.origin);
        var destCode = getCityCode(opts.destination);
        
        // Position and write origin (bright red)
        frame.gotoxy(SIGN_ORIGIN_X, SIGN_ORIGIN_Y);
        frame.putmsg("\1h\1r" + originCode + "\1n");
        
        // The arrow "->" should already be in the art, but write destination
        frame.gotoxy(SIGN_DEST_X, SIGN_DEST_Y);
        frame.putmsg("\1h\1y" + destCode + "\1n");
        
        return artLoaded;
    }
    
    /**
     * Get the previous city based on game day
     * @param {number} gameDay - Current game day
     * @returns {Object} - Previous city object
     */
    function getPreviousCity(gameDay) {
        if (!LORB.Cities || !LORB.Cities.getCurrent) {
            return { id: "???" };
        }
        // Day 1 wraps to last city (day 30)
        var prevDay = gameDay > 1 ? gameDay - 1 : 30;
        return LORB.Cities.getCurrent(prevDay);
    }
    
    /**
     * Get the next city based on game day
     * @param {number} gameDay - Current game day
     * @returns {Object} - Next city object
     */
    function getNextCity(gameDay) {
        if (!LORB.Cities || !LORB.Cities.getCurrent) {
            return { id: "???" };
        }
        // Day 30 wraps to first city (day 1)
        var nextDay = gameDay < 30 ? gameDay + 1 : 1;
        return LORB.Cities.getCurrent(nextDay);
    }
    
    // Export to LORB namespace
    if (!LORB.Util) LORB.Util = {};
    LORB.Util.BusArt = {
        render: render,
        getCityCode: getCityCode,
        getPreviousCity: getPreviousCity,
        getNextCity: getNextCity,
        BUS_ART_PATH: BUS_ART_PATH
    };
    
})();
