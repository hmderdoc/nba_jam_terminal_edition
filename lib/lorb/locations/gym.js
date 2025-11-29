/**
 * gym.js - Rim City Gym
 * 
 * Where players spend cash to train stats.
 * Limited daily sessions.
 */
(function() {
    
    // Base cost per stat point
    var BASE_COST = 100;
    
    // Cost multiplier per current stat level
    var COST_MULTIPLIER = 1.5;
    
    // Max stat value
    var MAX_STAT = 10;
    
    // Stat definitions
    var STATS = {
        speed: { key: "S", name: "Speed", description: "Movement and fast breaks" },
        threePt: { key: "3", name: "3-Point", description: "Long range shooting" },
        power: { key: "P", name: "Power", description: "Inside game and rebounding" },
        steal: { key: "T", name: "Steal", description: "Taking the ball" },
        block: { key: "B", name: "Block", description: "Shot rejection" },
        dunk: { key: "D", name: "Dunk", description: "Posterizing opponents" }
    };
    
    // Coach lines
    var COACH_GREETINGS = [
        "Coach nods at you. \"Ready to work?\"",
        "\"Sweat is the currency of champions.\"",
        "\"No shortcuts. Just reps.\"",
        "Coach looks you over. \"Let's get after it.\"",
        "\"The greats never stop training.\""
    ];
    
    var COACH_SUCCESS = [
        "\"Good work. I see improvement.\"",
        "\"That's the kind of effort I like.\"",
        "Coach nods approvingly.",
        "\"You're getting there. Keep pushing.\"",
        "\"One step closer to greatness.\""
    ];
    
    /**
     * Calculate training cost for a stat
     */
    function getTrainingCost(ctx, statKey) {
        var currentValue = (ctx.stats && ctx.stats[statKey]) || 4;
        return Math.floor(BASE_COST * Math.pow(COST_MULTIPLIER, currentValue - 4));
    }
    
    /**
     * Check if stat can be trained
     */
    function canTrain(ctx, statKey) {
        var currentValue = (ctx.stats && ctx.stats[statKey]) || 4;
        return currentValue < MAX_STAT;
    }
    
    /**
     * Train a stat
     */
    function trainStat(ctx, statKey) {
        if (!canTrain(ctx, statKey)) {
            LORB.View.warn("That stat is already maxed out!");
            return false;
        }
        
        var cost = getTrainingCost(ctx, statKey);
        if ((ctx.cash || 0) < cost) {
            LORB.View.warn("Not enough cash! You need $" + cost);
            return false;
        }
        
        if (ctx.gymSessions <= 0) {
            LORB.View.warn("No gym sessions left today!");
            return false;
        }
        
        // Perform training
        ctx.cash -= cost;
        ctx.gymSessions--;
        
        if (!ctx.stats) ctx.stats = {};
        ctx.stats[statKey] = (ctx.stats[statKey] || 4) + 1;
        
        // Show success message
        var statDef = STATS[statKey];
        var coachLine = COACH_SUCCESS[Math.floor(Math.random() * COACH_SUCCESS.length)];
        
        LORB.View.line("");
        LORB.View.line("\1g" + statDef.name + " +1!\1n (Now: " + ctx.stats[statKey] + ")");
        LORB.View.line("");
        LORB.View.line("\1c" + coachLine + "\1n");
        
        return true;
    }
    
    /**
     * Use free attribute points (from leveling)
     */
    function useAttributePoint(ctx, statKey) {
        if (!canTrain(ctx, statKey)) {
            LORB.View.warn("That stat is already maxed out!");
            return false;
        }
        
        if ((ctx.attributePoints || 0) <= 0) {
            LORB.View.warn("No attribute points available!");
            return false;
        }
        
        ctx.attributePoints--;
        
        if (!ctx.stats) ctx.stats = {};
        ctx.stats[statKey] = (ctx.stats[statKey] || 4) + 1;
        
        var statDef = STATS[statKey];
        LORB.View.line("");
        LORB.View.line("\1g" + statDef.name + " +1!\1n (Now: " + ctx.stats[statKey] + ")");
        
        return true;
    }
    
    /**
     * Draw the gym menu
     */
    function drawMenu(ctx) {
        LORB.View.clear();
        LORB.View.header("RIM CITY GYM");
        LORB.View.line("");
        
        // Coach greeting
        var greeting = COACH_GREETINGS[Math.floor(Math.random() * COACH_GREETINGS.length)];
        LORB.View.line("\1c" + greeting + "\1n");
        LORB.View.line("");
        
        // Resources
        var sessionsColor = ctx.gymSessions > 0 ? "\1g" : "\1r";
        LORB.View.line("Sessions: " + sessionsColor + ctx.gymSessions + "\1n  |  " +
                       "Cash: \1y$" + (ctx.cash || 0) + "\1n");
        
        if ((ctx.attributePoints || 0) > 0) {
            LORB.View.line("\1h\1yAttribute Points: " + ctx.attributePoints + " (FREE upgrades!)\1n");
        }
        LORB.View.line("");
        
        // Stat training options
        LORB.View.line("\1wTrain a stat:\1n");
        LORB.View.line("");
        
        for (var statKey in STATS) {
            if (STATS.hasOwnProperty(statKey)) {
                var stat = STATS[statKey];
                var currentValue = (ctx.stats && ctx.stats[statKey]) || 4;
                var cost = getTrainingCost(ctx, statKey);
                var canAfford = (ctx.cash || 0) >= cost;
                var maxed = currentValue >= MAX_STAT;
                
                // Build stat bar
                var bar = "";
                for (var b = 0; b < currentValue; b++) bar += "\1g█\1n";
                for (var b = currentValue; b < MAX_STAT; b++) bar += "\1k░\1n";
                
                var costStr = maxed ? "\1kMAX\1n" : 
                              (canAfford ? "\1y$" + cost + "\1n" : "\1r$" + cost + "\1n");
                
                var keyColor = (maxed || !canAfford) ? "\1k" : "\1w";
                
                LORB.View.line(keyColor + "[" + stat.key + "]\1n " + 
                               padRight(stat.name, 8) + " " + bar + " " + currentValue + "  " + costStr);
            }
        }
        
        LORB.View.line("");
        LORB.View.line("\1w[Q]\1n Leave Gym");
        LORB.View.line("");
    }
    
    /**
     * Pad string to the right
     */
    function padRight(str, len) {
        while (str.length < len) str += " ";
        return str;
    }
    
    /**
     * Main gym loop
     */
    function run(ctx) {
        while (true) {
            drawMenu(ctx);
            
            var choice = LORB.View.prompt("Choice: ").toUpperCase();
            
            if (choice === "Q") {
                return;
            }
            
            // Find matching stat
            var foundStat = null;
            for (var statKey in STATS) {
                if (STATS.hasOwnProperty(statKey) && STATS[statKey].key === choice) {
                    foundStat = statKey;
                    break;
                }
            }
            
            if (foundStat) {
                // Prefer attribute points if available
                if ((ctx.attributePoints || 0) > 0) {
                    useAttributePoint(ctx, foundStat);
                } else if (ctx.gymSessions > 0) {
                    trainStat(ctx, foundStat);
                } else {
                    LORB.View.warn("No gym sessions or attribute points left!");
                }
                console.getkey();
            }
        }
    }
    
    // Export to LORB namespace
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Gym = {
        run: run,
        STATS: STATS,
        getTrainingCost: getTrainingCost,
        BASE_COST: BASE_COST
    };
    
})();
