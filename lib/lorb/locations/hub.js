/**
 * hub.js - Rim City Main Hub
 * 
 * The central location where players choose their daily activities.
 * Manages navigation to courts, gym, club, and shop.
 */
(function() {
    
    // Default daily resources
    var DEFAULT_STREET_TURNS = 10;
    var DEFAULT_GYM_SESSIONS = 3;
    
    /**
     * Initialize daily resources if needed
     */
    function initDailyResources(ctx) {
        if (typeof ctx.streetTurns !== "number") {
            ctx.streetTurns = DEFAULT_STREET_TURNS;
        }
        if (typeof ctx.gymSessions !== "number") {
            ctx.gymSessions = DEFAULT_GYM_SESSIONS;
        }
        if (typeof ctx.day !== "number") {
            ctx.day = 1;
        }
    }
    
    /**
     * Reset daily resources for a new day
     */
    function newDay(ctx) {
        ctx.day = (ctx.day || 0) + 1;
        ctx.streetTurns = DEFAULT_STREET_TURNS;
        ctx.gymSessions = DEFAULT_GYM_SESSIONS;
        ctx.restUsedToday = false;
        
        // Clear temporary buffs
        if (ctx.tempBuffs) {
            ctx.tempBuffs = {};
        }
    }
    
    /**
     * Draw the hub header
     */
    function drawHeader(ctx) {
        LORB.View.clear();
        
        // Title box
        LORB.View.line("\1h\1c┌─────────────────────────────┐\1n");
        LORB.View.line("\1h\1c│\1n\1w       R I M   C I T Y       \1h\1c│\1n");
        LORB.View.line("\1h\1c└─────────────────────────────┘\1n");
        LORB.View.line("");
        
        // Resource display
        var turnsColor = ctx.streetTurns > 0 ? "\1g" : "\1r";
        var gymColor = ctx.gymSessions > 0 ? "\1g" : "\1r";
        
        LORB.View.line("Street Turns: " + turnsColor + ctx.streetTurns + "\1n    " +
                       "Gym Sessions: " + gymColor + ctx.gymSessions + "\1n");
        LORB.View.line("Cash: \1y$" + (ctx.cash || 0) + "\1n         " +
                       "Rep: \1c" + (ctx.rep || 0) + "\1n");
        LORB.View.line("");
    }
    
    /**
     * Draw the main menu
     */
    function drawMenu(ctx) {
        LORB.View.line("\1w[\1h1\1n\1w]\1n Hit the Streetball Courts");
        LORB.View.line("\1w[\1h2\1n\1w]\1n Go to Club 23");
        LORB.View.line("\1w[\1h3\1n\1w]\1n Visit the Gym");
        LORB.View.line("\1w[\1h4\1n\1w]\1n Visit the Gear Shop");
        LORB.View.line("\1w[\1h5\1n\1w]\1n View Stats & Records");
        LORB.View.line("\1w[\1hQ\1n\1w]\1n Call it a Night");
        LORB.View.line("");
    }
    
    /**
     * Main hub loop
     * @param {object} ctx - Player context
     * @returns {string} "quit" when player exits
     */
    function run(ctx) {
        initDailyResources(ctx);
        
        while (true) {
            drawHeader(ctx);
            drawMenu(ctx);
            
            var choice = LORB.View.prompt("Choice: ");
            
            switch (choice.toUpperCase()) {
                case "1":
                    // Courts
                    if (LORB.Locations && LORB.Locations.Courts) {
                        LORB.Locations.Courts.run(ctx);
                    } else {
                        LORB.View.warn("Courts not available yet.");
                        console.getkey();
                    }
                    break;
                    
                case "2":
                    // Club 23
                    if (LORB.Locations && LORB.Locations.Club23) {
                        LORB.Locations.Club23.run(ctx);
                    } else {
                        LORB.View.warn("Club 23 not available yet.");
                        console.getkey();
                    }
                    break;
                    
                case "3":
                    // Gym
                    if (LORB.Locations && LORB.Locations.Gym) {
                        LORB.Locations.Gym.run(ctx);
                    } else {
                        LORB.View.warn("Gym not available yet.");
                        console.getkey();
                    }
                    break;
                    
                case "4":
                    // Gear Shop
                    if (LORB.Locations && LORB.Locations.Shop) {
                        LORB.Locations.Shop.run(ctx);
                    } else {
                        LORB.View.warn("Gear Shop not available yet.");
                        console.getkey();
                    }
                    break;
                    
                case "5":
                    // Stats
                    if (LORB.UI && LORB.UI.StatsView) {
                        LORB.UI.StatsView.show(ctx);
                    } else {
                        LORB.View.warn("Stats view not available.");
                        console.getkey();
                    }
                    break;
                    
                case "Q":
                    // End day
                    return endDay(ctx);
                    
                default:
                    // Invalid choice - just redraw
                    break;
            }
        }
    }
    
    /**
     * End the day - show summary and advance
     */
    function endDay(ctx) {
        LORB.View.clear();
        LORB.View.header("DAY " + ctx.day + " COMPLETE");
        LORB.View.line("");
        
        LORB.View.line("The streetlights flicker on as you head home.");
        LORB.View.line("Another day in Rim City done.");
        LORB.View.line("");
        
        // Show day stats if we tracked them
        if (ctx.dayStats) {
            if (ctx.dayStats.gamesPlayed > 0) {
                LORB.View.line("Games today: " + ctx.dayStats.gamesPlayed + 
                    " (" + ctx.dayStats.wins + "W - " + ctx.dayStats.losses + "L)");
            }
            if (ctx.dayStats.cashEarned > 0) {
                LORB.View.line("Cash earned: \1g+$" + ctx.dayStats.cashEarned + "\1n");
            }
            if (ctx.dayStats.repGained > 0) {
                LORB.View.line("Rep gained: \1c+" + ctx.dayStats.repGained + "\1n");
            }
            LORB.View.line("");
        }
        
        LORB.View.line("\1wPress any key to rest...\1n");
        console.getkey();
        
        // Advance to next day
        newDay(ctx);
        
        return "quit";
    }
    
    // Export to LORB namespace
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Hub = {
        run: run,
        newDay: newDay,
        initDailyResources: initDailyResources,
        DEFAULT_STREET_TURNS: DEFAULT_STREET_TURNS,
        DEFAULT_GYM_SESSIONS: DEFAULT_GYM_SESSIONS
    };
    
})();
