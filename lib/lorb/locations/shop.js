/**
 * shop.js - Rim City Gear Shop
 * 
 * Buy sneakers and consumables that modify stats.
 */
(function() {
    
    // Equipment slots
    var SLOTS = {
        feet: "Sneakers",
        drink: "Drink"
    };
    
    // Sneaker inventory (permanent stat mods while equipped)
    var SNEAKERS = {
        rim_grinders: {
            id: "rim_grinders",
            name: "Rim Grinders",
            description: "Heavy, ugly, unstoppable inside.",
            price: 300,
            mods: { power: 2, dunk: 1, speed: -1 }
        },
        cloudwalkers: {
            id: "cloudwalkers",
            name: "Cloudwalkers",
            description: "Rumored to give mid-air control.",
            price: 400,
            mods: { speed: 2, dunk: 1, power: -1 }
        },
        high_tops: {
            id: "high_tops",
            name: "High Tops",
            description: "Old school ankle protection.",
            price: 250,
            mods: { block: 2, speed: -1 }
        },
        arc_specials: {
            id: "arc_specials",
            name: "Arc Specials",
            description: "Made for snipers.",
            price: 350,
            mods: { threePt: 2, steal: 1, dunk: -1 }
        },
        street_classics: {
            id: "street_classics",
            name: "Street Classics",
            description: "Balanced. Reliable. Respected.",
            price: 200,
            mods: { speed: 1, steal: 1 }
        }
    };
    
    // Consumable drinks (temporary buffs, one-time use)
    var DRINKS = {
        red_bull_classic: {
            id: "red_bull_classic",
            name: "Red Bull Classic",
            description: "Gives you wings (temporarily).",
            price: 50,
            effect: { stat: "speed", bonus: 2, duration: "next_game" }
        },
        mystery_mix: {
            id: "mystery_mix",
            name: "Mystery Mix",
            description: "Who knows what's in it?",
            price: 30,
            effect: { type: "random", bonus: 3, duration: "next_game" }
        },
        focus_shot: {
            id: "focus_shot",
            name: "Focus Shot",
            description: "Pure concentration.",
            price: 40,
            effect: { stat: "threePt", bonus: 2, duration: "next_game" }
        },
        power_shake: {
            id: "power_shake",
            name: "Power Shake",
            description: "Feel the strength.",
            price: 45,
            effect: { stat: "power", bonus: 2, duration: "next_game" }
        }
    };
    
    /**
     * Get effective stats with equipment mods applied
     */
    function getEffectiveStats(ctx) {
        var stats = {};
        
        // Copy base stats
        if (ctx.stats) {
            for (var s in ctx.stats) {
                if (ctx.stats.hasOwnProperty(s)) {
                    stats[s] = ctx.stats[s];
                }
            }
        }
        
        // Apply equipment mods
        if (ctx.equipment && ctx.equipment.feet) {
            var sneaker = SNEAKERS[ctx.equipment.feet];
            if (sneaker && sneaker.mods) {
                for (var m in sneaker.mods) {
                    if (sneaker.mods.hasOwnProperty(m)) {
                        stats[m] = (stats[m] || 4) + sneaker.mods[m];
                        stats[m] = Math.max(1, Math.min(10, stats[m]));
                    }
                }
            }
        }
        
        // Apply temporary buffs
        if (ctx.tempBuffs) {
            for (var b in ctx.tempBuffs) {
                if (ctx.tempBuffs.hasOwnProperty(b)) {
                    stats[b] = (stats[b] || 4) + ctx.tempBuffs[b];
                    stats[b] = Math.max(1, Math.min(12, stats[b]));  // Temp buffs can exceed 10
                }
            }
        }
        
        return stats;
    }
    
    /**
     * Buy and equip sneakers
     */
    function buySneakers(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("SNEAKERS");
            LORB.View.line("");
            LORB.View.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
            
            // Show current equipment
            var currentSneaker = ctx.equipment && ctx.equipment.feet ? 
                SNEAKERS[ctx.equipment.feet] : null;
            if (currentSneaker) {
                LORB.View.line("Wearing: \1c" + currentSneaker.name + "\1n");
            } else {
                LORB.View.line("Wearing: \1kNothing special\1n");
            }
            LORB.View.line("");
            
            var menuNum = 1;
            var menuMap = {};
            
            for (var id in SNEAKERS) {
                if (SNEAKERS.hasOwnProperty(id)) {
                    var sneaker = SNEAKERS[id];
                    var owned = ctx.inventory && ctx.inventory.sneakers && 
                                ctx.inventory.sneakers.indexOf(id) >= 0;
                    var equipped = ctx.equipment && ctx.equipment.feet === id;
                    
                    var modStr = formatMods(sneaker.mods);
                    
                    if (equipped) {
                        LORB.View.line("\1g[" + menuNum + "] " + sneaker.name + " [EQUIPPED]\1n");
                    } else if (owned) {
                        LORB.View.line("\1w[" + menuNum + "]\1n " + sneaker.name + " \1c[OWNED]\1n  " + modStr);
                    } else {
                        var canAfford = (ctx.cash || 0) >= sneaker.price;
                        var priceColor = canAfford ? "\1y" : "\1r";
                        LORB.View.line("\1w[" + menuNum + "]\1n " + sneaker.name + "  " + 
                                       priceColor + "$" + sneaker.price + "\1n  " + modStr);
                    }
                    
                    menuMap[menuNum] = { id: id, sneaker: sneaker, owned: owned, equipped: equipped };
                    menuNum++;
                }
            }
            
            LORB.View.line("");
            LORB.View.line("\1w[Q]\1n Back");
            LORB.View.line("");
            
            var choice = LORB.View.prompt("Choice: ").toUpperCase();
            
            if (choice === "Q") {
                return;
            }
            
            var idx = parseInt(choice, 10);
            if (menuMap[idx]) {
                var item = menuMap[idx];
                
                if (item.equipped) {
                    LORB.View.line("\1kAlready wearing these.\1n");
                } else if (item.owned) {
                    // Equip owned item
                    if (!ctx.equipment) ctx.equipment = {};
                    ctx.equipment.feet = item.id;
                    LORB.View.line("\1gEquipped " + item.sneaker.name + "!\1n");
                } else {
                    // Try to buy
                    if ((ctx.cash || 0) >= item.sneaker.price) {
                        ctx.cash -= item.sneaker.price;
                        if (!ctx.inventory) ctx.inventory = {};
                        if (!ctx.inventory.sneakers) ctx.inventory.sneakers = [];
                        ctx.inventory.sneakers.push(item.id);
                        
                        // Auto-equip
                        if (!ctx.equipment) ctx.equipment = {};
                        ctx.equipment.feet = item.id;
                        
                        LORB.View.line("\1gPurchased and equipped " + item.sneaker.name + "!\1n");
                    } else {
                        LORB.View.warn("Not enough cash!");
                    }
                }
                console.getkey();
            }
        }
    }
    
    /**
     * Buy consumable drinks
     */
    function buyDrinks(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("DRINKS");
            LORB.View.line("");
            LORB.View.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
            LORB.View.line("");
            LORB.View.line("Consumables give temporary boosts for your next game.");
            LORB.View.line("");
            
            var menuNum = 1;
            var menuMap = {};
            
            for (var id in DRINKS) {
                if (DRINKS.hasOwnProperty(id)) {
                    var drink = DRINKS[id];
                    var canAfford = (ctx.cash || 0) >= drink.price;
                    var priceColor = canAfford ? "\1y" : "\1r";
                    
                    var effectStr = formatEffect(drink.effect);
                    
                    LORB.View.line("\1w[" + menuNum + "]\1n " + drink.name + "  " +
                                   priceColor + "$" + drink.price + "\1n  " + effectStr);
                    LORB.View.line("    \1k" + drink.description + "\1n");
                    
                    menuMap[menuNum] = { id: id, drink: drink };
                    menuNum++;
                }
            }
            
            LORB.View.line("");
            LORB.View.line("\1w[Q]\1n Back");
            LORB.View.line("");
            
            var choice = LORB.View.prompt("Choice: ").toUpperCase();
            
            if (choice === "Q") {
                return;
            }
            
            var idx = parseInt(choice, 10);
            if (menuMap[idx]) {
                var item = menuMap[idx];
                
                if ((ctx.cash || 0) >= item.drink.price) {
                    ctx.cash -= item.drink.price;
                    
                    // Apply effect
                    applyDrinkEffect(ctx, item.drink);
                    
                    LORB.View.line("\1gYou drink the " + item.drink.name + "...\1n");
                    LORB.View.line("The effect will last until your next game.");
                } else {
                    LORB.View.warn("Not enough cash!");
                }
                console.getkey();
            }
        }
    }
    
    /**
     * Apply a drink's temporary effect
     */
    function applyDrinkEffect(ctx, drink) {
        if (!ctx.tempBuffs) ctx.tempBuffs = {};
        
        var effect = drink.effect;
        
        if (effect.type === "random") {
            // Random stat boost
            var stats = ["speed", "threePt", "power", "steal", "block", "dunk"];
            var randomStat = stats[Math.floor(Math.random() * stats.length)];
            ctx.tempBuffs[randomStat] = (ctx.tempBuffs[randomStat] || 0) + effect.bonus;
        } else if (effect.stat) {
            ctx.tempBuffs[effect.stat] = (ctx.tempBuffs[effect.stat] || 0) + effect.bonus;
        }
    }
    
    /**
     * Format stat mods for display
     */
    function formatMods(mods) {
        if (!mods) return "";
        
        var parts = [];
        var statNames = {
            speed: "SPD", threePt: "3PT", power: "PWR",
            steal: "STL", block: "BLK", dunk: "DNK"
        };
        
        for (var s in mods) {
            if (mods.hasOwnProperty(s)) {
                var val = mods[s];
                var name = statNames[s] || s;
                if (val > 0) {
                    parts.push("\1g+" + val + " " + name + "\1n");
                } else {
                    parts.push("\1r" + val + " " + name + "\1n");
                }
            }
        }
        
        return parts.join(" ");
    }
    
    /**
     * Format drink effect for display
     */
    function formatEffect(effect) {
        var statNames = {
            speed: "SPD", threePt: "3PT", power: "PWR",
            steal: "STL", block: "BLK", dunk: "DNK"
        };
        
        if (effect.type === "random") {
            return "\1m+? Random Stat\1n";
        } else if (effect.stat) {
            var name = statNames[effect.stat] || effect.stat;
            return "\1g+" + effect.bonus + " " + name + "\1n";
        }
        return "";
    }
    
    /**
     * Draw main shop menu
     */
    function drawMenu(ctx) {
        LORB.View.clear();
        LORB.View.header("RIM CITY GEAR SHOP");
        LORB.View.line("");
        LORB.View.line("\"Looking for an edge? You came to the right place.\"");
        LORB.View.line("");
        LORB.View.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
        LORB.View.line("");
        LORB.View.line("\1w[1]\1n Sneakers");
        LORB.View.line("\1w[2]\1n Drinks & Consumables");
        LORB.View.line("\1w[Q]\1n Leave Shop");
        LORB.View.line("");
    }
    
    /**
     * Main shop loop
     */
    function run(ctx) {
        while (true) {
            drawMenu(ctx);
            
            var choice = LORB.View.prompt("Choice: ").toUpperCase();
            
            switch (choice) {
                case "1":
                    buySneakers(ctx);
                    break;
                    
                case "2":
                    buyDrinks(ctx);
                    break;
                    
                case "Q":
                    return;
            }
        }
    }
    
    // Export to LORB namespace
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Shop = {
        run: run,
        SNEAKERS: SNEAKERS,
        DRINKS: DRINKS,
        getEffectiveStats: getEffectiveStats
    };
    
})();
