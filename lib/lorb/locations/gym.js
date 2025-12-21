/**
 * gym.js - Rim City Gym
 * 
 * Where players spend cash to train stats.
 * Limited daily sessions.
 * 
 * RichView layout with art on left, stats/menu on right.
 */

var _gymRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _gymRichView = RichView;
} catch (e) {
}

// Load BinLoader for .bin art files
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
    }
}

(function() {
    
    var RichView = _gymRichView;
    
    // Art file paths
    var ART_HEADER = "/sbbs/xtrn/nba_jam/assets/lorb/gym_header.bin";
    var ART_SIDE = "/sbbs/xtrn/nba_jam/assets/lorb/gym_art.bin";
    var ART_HEADER_W = 80, ART_HEADER_H = 4;
    var ART_SIDE_W = 40, ART_SIDE_H = 20;
    
    // Base cost per stat point
    var BASE_COST = 100;
    
    // Cost multiplier per current stat level
    var COST_MULTIPLIER = 1.5;
    
    // Max stat value
    var MAX_STAT = 10;
    
    // Stat definitions with hotkeys
    var STATS = {
        speed: { key: "S", name: "Speed", description: "Movement and fast breaks" },
        threePt: { key: "3", name: "3-Point", description: "Long range shooting" },
        power: { key: "P", name: "Power", description: "Inside game and rebounding" },
        steal: { key: "T", name: "Steal", description: "Taking the ball" },
        block: { key: "B", name: "Block", description: "Shot rejection" },
        dunk: { key: "D", name: "Dunk", description: "Posterizing opponents" }
    };
    
    // Sneaker data for showing equipped bonuses
    var SNEAKERS = {
        shaq: { name: "Shaq Attaq", mods: { power: 2, dunk: 1, speed: -1 } },
        jordans: { name: "Air Jordan XI", mods: { dunk: 2, speed: 1, power: -1 } },
        ewings: { name: "Ewing 33 Hi", mods: { block: 2, power: 1, threePt: -1 } },
        currys: { name: "Curry 4s", mods: { threePt: 2, steal: 1, dunk: -1 } },
        kobes: { name: "Kobe IVs", mods: { speed: 1, threePt: 1, steal: 1, power: -1 } }
    };
    
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
     * Pad string to the right
     */
    function padRight(str, len) {
        while (str.length < len) str += " ";
        return str;
    }
    
    /**
     * Build stat bar string (CP437 block chars)
     */
    function buildStatBar(currentValue, maxValue) {
        var filled = "";
        var empty = "";
        // Use ASCII 219 (full block) for filled, ASCII 176 (light shade) for empty
        var blockChar = ascii(219);
        var emptyChar = ascii(176);
        for (var b = 0; b < currentValue; b++) filled += blockChar;
        for (var b = currentValue; b < maxValue; b++) empty += emptyChar;
        return "\1g" + filled + "\1k" + empty + "\1n";
    }
    
    /**
     * Get active boosts (equipment + temp buffs)
     */
    function getActiveBoosts(ctx) {
        var boosts = [];
        
        // Check equipped sneakers
        if (ctx.equipment && ctx.equipment.feet) {
            var sneaker = SNEAKERS[ctx.equipment.feet];
            if (sneaker) {
                boosts.push({
                    type: "gear",
                    name: sneaker.name,
                    mods: sneaker.mods
                });
            }
        }
        
        // Check temp buffs (from drinks)
        if (ctx.tempBuffs) {
            for (var stat in ctx.tempBuffs) {
                if (ctx.tempBuffs.hasOwnProperty(stat) && ctx.tempBuffs[stat] !== 0) {
                    boosts.push({
                        type: "buff",
                        stat: stat,
                        value: ctx.tempBuffs[stat]
                    });
                }
            }
        }
        
        return boosts;
    }
    
    /**
     * Format boost mods for display
     */
    function formatMods(mods) {
        var parts = [];
        var statNames = {
            speed: "SPD", threePt: "3PT", power: "PWR",
            steal: "STL", block: "BLK", dunk: "DNK"
        };
        for (var stat in mods) {
            if (mods.hasOwnProperty(stat)) {
                var val = mods[stat];
                var color = val > 0 ? "\1g" : "\1r";
                var sign = val > 0 ? "+" : "";
                parts.push(color + sign + val + " " + (statNames[stat] || stat) + "\1n");
            }
        }
        return parts.join(" ");
    }
    
    /**
     * Load gym art
     */
    function loadArt(view) {
        if (typeof BinLoader === "undefined") return;
        
        var headerFrame = view.getZone("header");
        if (headerFrame && file_exists(ART_HEADER)) {
            BinLoader.loadIntoFrame(headerFrame, ART_HEADER, ART_HEADER_W, ART_HEADER_H, 1, 1);
        }
        
        var artFrame = view.getZone("art");
        if (artFrame && file_exists(ART_SIDE)) {
            BinLoader.loadIntoFrame(artFrame, ART_SIDE, ART_SIDE_W, ART_SIDE_H, 1, 1);
        }
        
        view.render();
    }
    
    /**
     * Create RichView layout
     */
    function createView() {
        return new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 41, y: 5, width: 40, height: 20 }
            ],
            theme: "lorb"
        });
    }
    
    /**
     * RichView gym interface
     */
    function runRichView(ctx) {
        var view = createView();
        loadArt(view);
        
        while (true) {
            view.clearZone("content");
            view.setContentZone("content");
            view.setCursorY(0);
            
            // Resources line
            var sessionsColor = ctx.gymSessions > 0 ? "\1g" : "\1r";
            view.line("Sessions: " + sessionsColor + ctx.gymSessions + "\1n  Cash: \1y$" + (ctx.cash || 0) + "\1n");
            
            if ((ctx.attributePoints || 0) > 0) {
                view.line("\1h\1yFree Points: " + ctx.attributePoints + "\1n");
            }
            view.blank();
            
            // Build menu items for stats
            var menuItems = [];
            var statOrder = ["speed", "threePt", "power", "steal", "block", "dunk"];
            
            for (var i = 0; i < statOrder.length; i++) {
                var statKey = statOrder[i];
                var stat = STATS[statKey];
                var currentValue = (ctx.stats && ctx.stats[statKey]) || 4;
                var cost = getTrainingCost(ctx, statKey);
                var canAfford = (ctx.cash || 0) >= cost;
                var maxed = currentValue >= MAX_STAT;
                var hasFreePoints = (ctx.attributePoints || 0) > 0;
                var hasSession = ctx.gymSessions > 0;
                
                var bar = buildStatBar(currentValue, MAX_STAT);
                var costStr = maxed ? "\1kMAX" : 
                              hasFreePoints ? "\1gFREE" :
                              (canAfford ? "\1y$" + cost : "\1r$" + cost);
                
                var disabled = maxed || (!hasFreePoints && (!canAfford || !hasSession));
                
                menuItems.push({
                    text: "\1w" + padRight(stat.name, 7) + bar + "\1c " + currentValue + " " + costStr + "\1n",
                    value: statKey,
                    hotkey: stat.key,
                    disabled: disabled,
                    _statKey: statKey
                });
            }
            
            menuItems.push({ text: "", value: null, disabled: true });
            menuItems.push({ text: "Leave Gym", value: "leave", hotkey: "Q" });
            
            // Show active boosts section
            var boosts = getActiveBoosts(ctx);
            if (boosts.length > 0) {
                view.updateZone("content", function(frame) {
                    var boostY = 14;
                    frame.gotoxy(1, boostY);
                    frame.putmsg("\1c\1hActive Boosts:\1n");
                    
                    var line = boostY + 1;
                    for (var b = 0; b < boosts.length && line < 19; b++) {
                        var boost = boosts[b];
                        frame.gotoxy(1, line);
                        if (boost.type === "gear") {
                            frame.putmsg("\1w" + boost.name + "\1n");
                            line++;
                            frame.gotoxy(2, line);
                            frame.putmsg(formatMods(boost.mods));
                        } else if (boost.type === "buff") {
                            var statNames = {
                                speed: "Speed", threePt: "3-Point", power: "Power",
                                steal: "Steal", block: "Block", dunk: "Dunk"
                            };
                            var color = boost.value > 0 ? "\1g" : "\1r";
                            var sign = boost.value > 0 ? "+" : "";
                            frame.putmsg(color + sign + boost.value + " " + (statNames[boost.stat] || boost.stat) + "\1n \1k(temp)\1n");
                        }
                        line++;
                    }
                });
            }
            
            view.render();
            
            var choice = view.menu(menuItems, { y: 4, width: 38 });
            
            if (choice === "leave" || choice === null) {
                view.close();
                return;
            }
            
            // Train the selected stat
            if (choice && STATS[choice]) {
                var statKey = choice;
                var success = false;
                var message = "";
                
                if (!canTrain(ctx, statKey)) {
                    message = "\1rThat stat is already maxed!\1n";
                } else if ((ctx.attributePoints || 0) > 0) {
                    // Use free point
                    ctx.attributePoints--;
                    if (!ctx.stats) ctx.stats = {};
                    ctx.stats[statKey] = (ctx.stats[statKey] || 4) + 1;
                    message = "\1g" + STATS[statKey].name + " +1!\1n (Now: " + ctx.stats[statKey] + ")";
                    success = true;
                } else if (ctx.gymSessions > 0) {
                    var cost = getTrainingCost(ctx, statKey);
                    if ((ctx.cash || 0) >= cost) {
                        ctx.cash -= cost;
                        ctx.gymSessions--;
                        if (!ctx.stats) ctx.stats = {};
                        ctx.stats[statKey] = (ctx.stats[statKey] || 4) + 1;
                        message = "\1g" + STATS[statKey].name + " +1!\1n (Now: " + ctx.stats[statKey] + ")";
                        success = true;
                    } else {
                        message = "\1rNot enough cash!\1n";
                    }
                } else {
                    message = "\1rNo sessions left!\1n";
                }
                
                // Show feedback briefly
                if (message) {
                    view.updateZone("content", function(frame) {
                        frame.gotoxy(1, 12);
                        frame.putmsg(message);
                    });
                    view.render();
                    mswait(800);
                }
            }
        }
    }
    
    /**
     * Legacy fallback
     */
    function runLegacy(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("RIM CITY GYM");
            LORB.View.line("");
            
            var sessionsColor = ctx.gymSessions > 0 ? "\1g" : "\1r";
            LORB.View.line("Sessions: " + sessionsColor + ctx.gymSessions + "\1n  |  Cash: \1y$" + (ctx.cash || 0) + "\1n");
            
            if ((ctx.attributePoints || 0) > 0) {
                LORB.View.line("\1h\1yAttribute Points: " + ctx.attributePoints + " (FREE upgrades!)\1n");
            }
            LORB.View.line("");
            
            for (var statKey in STATS) {
                if (STATS.hasOwnProperty(statKey)) {
                    var stat = STATS[statKey];
                    var currentValue = (ctx.stats && ctx.stats[statKey]) || 4;
                    var cost = getTrainingCost(ctx, statKey);
                    var canAfford = (ctx.cash || 0) >= cost;
                    var maxed = currentValue >= MAX_STAT;
                    
                    var bar = buildStatBar(currentValue, MAX_STAT);
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
            
            var choice = LORB.View.prompt("Choice: ").toUpperCase();
            
            if (choice === "Q") {
                return;
            }
            
            var foundStat = null;
            for (var statKey in STATS) {
                if (STATS.hasOwnProperty(statKey) && STATS[statKey].key === choice) {
                    foundStat = statKey;
                    break;
                }
            }
            
            if (foundStat) {
                if ((ctx.attributePoints || 0) > 0) {
                    if (canTrain(ctx, foundStat)) {
                        ctx.attributePoints--;
                        if (!ctx.stats) ctx.stats = {};
                        ctx.stats[foundStat] = (ctx.stats[foundStat] || 4) + 1;
                        LORB.View.line("\1g" + STATS[foundStat].name + " +1!\1n");
                    }
                } else if (ctx.gymSessions > 0) {
                    var cost = getTrainingCost(ctx, foundStat);
                    if ((ctx.cash || 0) >= cost && canTrain(ctx, foundStat)) {
                        ctx.cash -= cost;
                        ctx.gymSessions--;
                        if (!ctx.stats) ctx.stats = {};
                        ctx.stats[foundStat] = (ctx.stats[foundStat] || 4) + 1;
                        LORB.View.line("\1g" + STATS[foundStat].name + " +1!\1n");
                    }
                }
                console.getkey();
            }
        }
    }
    
    /**
     * Main entry point
     */
    function run(ctx) {
        if (RichView) {
            return runRichView(ctx);
        } else {
            return runLegacy(ctx);
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
