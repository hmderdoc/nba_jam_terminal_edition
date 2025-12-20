/**
 * spouse-events.js - Angry Spouse Events for LORB
 * 
 * Handles:
 * - Spouse catching player with wrong companion in her city
 * - Spouse catching player flirting in her city
 * - Spouse anger when you have a baby out of wedlock
 * - Other spouse drama/consequences
 * 
 * Events are passive (player acknowledges, consequences already applied).
 */
(function() {
    // NOTE: Do not use "use strict" - Synchronet color codes use octal-like \1 escapes
    
    // ========== EVENT TYPES ==========
    
    /**
     * Angry spouse event when caught arriving with wrong companion
     */
    var EVENT_WRONG_COMPANION = {
        id: "spouse_caught_companion",
        title: "OH NO",
        alignmentPenalty: 20,
        getMessage: function(spouseName, companionName, cityName) {
            return [
                "\1h\1mAs you arrive in " + cityName + " with " + companionName + "...\1n",
                "",
                "\1h\1rYou see " + spouseName + " at the airport terminal.\1n",
                "",
                "\1wHer face goes from confusion to anger in an instant.\1n",
                "",
                "\1h\1r\"WHO IS THIS?!\"\1n",
                "",
                companionName + " looks uncomfortable and makes an excuse to leave.\1n",
                "",
                "\1r" + spouseName + " storms off without another word.\1n",
                "",
                "\1h\1k(Alignment -20)\1n"
            ];
        }
    };
    
    /**
     * Angry spouse event when caught flirting in her city
     */
    var EVENT_CAUGHT_FLIRTING = {
        id: "spouse_caught_flirting",
        title: "BUSTED",
        alignmentPenalty: 20,
        getMessage: function(spouseName, cityName) {
            return [
                "\1h\1rBefore you can make your move...\1n",
                "",
                "\1h\1m" + spouseName + " appears behind you.\1n",
                "",
                "\1h\1r\"REALLY?! In MY hometown?!\"\1n",
                "",
                "\1wThe woman you were talking to quickly excuses herself.\1n",
                "",
                spouseName + " glares at you with a look that could kill.\1n",
                "",
                "\1h\1k(Alignment -20)\1n"
            ];
        }
    };
    
    /**
     * Angry spouse event when player has a child with someone else
     */
    var EVENT_OUT_OF_WEDLOCK = {
        id: "spouse_out_of_wedlock",
        title: "BUSTED AT THE HOSPITAL",
        alignmentPenalty: 25,
        getMessage: function(spouseName, mamaName, babyNames) {
            var kids = babyNames && babyNames.length ? babyNames.join(", ") : "that baby";
            return [
                "\1h\1yAs you leave the hospital with " + mamaName + "...\1n",
                "",
                "\1h\1c" + spouseName + " is waiting in the lobby.\1n",
                "",
                "\1h\1r\"You had " + kids + " with " + mamaName + "? WHILE MARRIED TO ME?!\"\1n",
                "",
                "\1wThe tension is electric. Everyone is staring.\1n",
                "",
                "\1r" + spouseName + " storms out. This is going to get messy.\1n",
                "",
                "\1h\1w(Alignment -25)\1n"
            ];
        }
    };
    
    // ========== DETECTION FUNCTIONS ==========
    
    /**
     * Check if spouse catches player arriving with wrong companion
     * @param {Object} ctx - Player context
     * @param {Object} currentCity - Current city object
     * @returns {Object|null} - Event data or null
     */
    function checkWrongCompanionEvent(ctx, currentCity) {
        if (!ctx || !currentCity) return null;
        if (!ctx.romance || !ctx.romance.spouseName || !ctx.romance.spouseCityId) return null;
        if (ctx.romance.spouseCityId !== currentCity.id) return null;
        
        // Check if player has a traveling companion
        var companion = null;
        if (LORB.Data && LORB.Data.Companion && LORB.Data.Companion.getCompanion) {
            companion = LORB.Data.Companion.getCompanion(ctx);
        }
        
        if (!companion) return null;
        
        // Check if companion is NOT the spouse
        var spouseName = ctx.romance.spouseName;
        if (companion.name === spouseName || companion.npcName === spouseName) {
            return null; // Traveling with spouse - all good
        }
        
        // BUSTED!
        return {
            event: EVENT_WRONG_COMPANION,
            spouseName: spouseName,
            companionName: companion.name || companion.npcName,
            cityName: currentCity.cityName,
            alignmentPenalty: EVENT_WRONG_COMPANION.alignmentPenalty
        };
    }
    
    /**
     * Check if spouse catches player flirting in her city
     * Used by club23.js before flirt attempt
     * @param {Object} ctx - Player context
     * @param {Object} city - Current city object
     * @returns {Object|null} - Event data or null
     */
    function checkFlirtingEvent(ctx, city) {
        if (!ctx || !city) return null;
        if (!ctx.romance || !ctx.romance.spouseName || !ctx.romance.spouseCityId) return null;
        if (ctx.romance.spouseCityId !== city.id) return null;
        
        // Caught!
        return {
            event: EVENT_CAUGHT_FLIRTING,
            spouseName: ctx.romance.spouseName,
            cityName: city.cityName,
            alignmentPenalty: EVENT_CAUGHT_FLIRTING.alignmentPenalty
        };
    }
    
    // ========== DISPLAY FUNCTIONS ==========
    
    /**
     * Show an angry spouse event
     * @param {Object} eventData - Event data from check functions
     * @param {Object} ctx - Player context (to apply penalties)
     */
    function showEvent(eventData, ctx) {
        if (!eventData || !eventData.event) return;

        var event = eventData.event;
        var message = [];
        
        // Generate message lines based on event type
        if (event === EVENT_WRONG_COMPANION) {
            message = event.getMessage(eventData.spouseName, eventData.companionName, eventData.cityName);
        } else if (event === EVENT_CAUGHT_FLIRTING) {
            message = event.getMessage(eventData.spouseName, eventData.cityName);
        } else if (event === EVENT_OUT_OF_WEDLOCK) {
            message = event.getMessage(eventData.spouseName, eventData.mamaName, eventData.babyNames || []);
        }
        
        // Load TalkShowView - this is the ONLY view path, no legacy fallback
        if (!LORB.UI || !LORB.UI.TalkShowView) {
            load("/sbbs/xtrn/nba_jam/lib/lorb/ui/talk_show_view.js");
        }
        
        if (!LORB.UI || !LORB.UI.TalkShowView || !LORB.UI.TalkShowView.present) {
            throw new Error("[SPOUSE] TalkShowView failed to load - this should never happen");
        }
        
        LORB.UI.TalkShowView.present({
            // Event type for host/splash selection
            eventType: "spouse_retaliation",
            eventSubtype: event.id,
            splashText: event.title,  // Use event title as splash (e.g., "BUSTED")
            
            dialogueLines: message,
            choices: []  // press any key
        });
        
        if (eventData.alignmentPenalty) {
            if (ctx.alignment === undefined) ctx.alignment = 0;
            ctx.alignment -= eventData.alignmentPenalty;
        }
        debugLog("[SPOUSE] Event shown id=" + event.id + " spouse=" + (eventData.spouseName || "?") + " mama=" + (eventData.mamaName || "?"));
    }
    
    /**
     * Trigger angry spouse event for out-of-wedlock birth (deterministic)
     * @param {Object} ctx - Player context
     * @param {string} mamaName - Mother of the new child
     * @param {Array} babies - Array of baby records just created
     */
    function triggerOutOfWedlock(ctx, mamaName, babies) {
        if (!ctx || !ctx.romance || !ctx.romance.spouseName) {
            debugLog("[SPOUSE] Out-of-wedlock skip: no spouse on ctx");
            return null;
        }
        if (!mamaName) {
            debugLog("[SPOUSE] Out-of-wedlock skip: mamaName missing");
            return null;
        }
        
        var spouseName = ctx.romance.spouseName;
        // Case-insensitive compare to avoid missing due to formatting
        if (spouseName && mamaName && spouseName.toLowerCase() === mamaName.toLowerCase()) {
            debugLog("[SPOUSE] Out-of-wedlock skip: mama matches spouse (" + spouseName + ")");
            return null;
        }
        
        // Debug trace
        debugLog("[SPOUSE] Out-of-wedlock trigger: spouse=" + spouseName + " mama=" + mamaName);
        
        var babyNames = [];
        if (babies && babies.length) {
            for (var i = 0; i < babies.length; i++) {
                var nm = babies[i].name || babies[i].nickname;
                if (nm) babyNames.push(nm);
            }
        }
        
        var eventData = {
            event: EVENT_OUT_OF_WEDLOCK,
            spouseName: ctx.romance.spouseName,
            mamaName: mamaName,
            babyNames: babyNames,
            alignmentPenalty: EVENT_OUT_OF_WEDLOCK.alignmentPenalty
        };
        
        showEvent(eventData, ctx);
        return eventData;
    }
    
    // ========== MODULE EXPORTS ==========
    
    if (typeof LORB === "undefined") {
        LORB = {};
    }
    if (!LORB.Data) {
        LORB.Data = {};
    }
    
    LORB.Data.SpouseEvents = {
        // Detection
        checkWrongCompanionEvent: checkWrongCompanionEvent,
        checkFlirtingEvent: checkFlirtingEvent,
        triggerOutOfWedlock: triggerOutOfWedlock,
        
        // Display
        showEvent: showEvent,
        
        // Event types (for testing/reference)
        EVENT_WRONG_COMPANION: EVENT_WRONG_COMPANION,
        EVENT_CAUGHT_FLIRTING: EVENT_CAUGHT_FLIRTING,
        EVENT_OUT_OF_WEDLOCK: EVENT_OUT_OF_WEDLOCK
    };
    
})();
