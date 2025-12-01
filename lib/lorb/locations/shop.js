/**
 * shop.js - Rim City Gear Shop
 * 
 * Buy sneakers and consumables that modify stats.
 * Uses RichView with multiline lightbar menus for rich item display.
 */

var _shopRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _shopRichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[SHOP] Failed to load RichView: " + e);
}

// Load BinLoader for .bin art files
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
        log(LOG_WARNING, "[SHOP] Failed to load bin-loader.js: " + e);
    }
}

(function() {
    
    var RichView = _shopRichView;
    
    // Art file paths
    var ART_HEADER = "/sbbs/xtrn/nba_jam/assets/lorb/shop_header.bin";
    var ART_SIDE = "/sbbs/xtrn/nba_jam/assets/lorb/shop_art.bin";
    var ART_HEADER_W = 80, ART_HEADER_H = 4;
    var ART_SIDE_W = 40, ART_SIDE_H = 20;
    
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
    
    // Menu info for hover effects
    var MENU_INFO = {
        sneakers: {
            title: "Sneakers",
            lines: [
                "Equip kicks for permanent",
                "stat bonuses on the court.",
                "",
                "Switch anytime you own them."
            ]
        },
        drinks: {
            title: "Drinks & Consumables",
            lines: [
                "One-time boosts that last",
                "until your next game.",
                "",
                "Stack 'em if you got the cash."
            ]
        },
        leave: {
            title: "Leave Shop",
            lines: [
                "Head back to Rim City.",
                "",
                "Your gear stays with you."
            ]
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
     * Format stat mods for display (returns ctrl-code string)
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
     * Load art into zones (if .bin files exist)
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
     * Draw info panel based on selected menu item
     */
    function drawInfoPanel(view, itemValue) {
        var info = MENU_INFO[itemValue];
        if (!info) return;
        
        view.updateZone("content", function(frame) {
            // Clear info area (below menu)
            var infoStartY = 14;
            for (var y = infoStartY; y <= 20; y++) {
                frame.gotoxy(1, y);
                frame.putmsg("\1n" + repeatSpaces(38));
            }
            
            // Draw info box in right column
            frame.gotoxy(1, infoStartY);
            frame.putmsg("\1h\1y" + info.title + "\1n");
            
            for (var i = 0; i < info.lines.length && (infoStartY + 1 + i) <= 19; i++) {
                frame.gotoxy(2, infoStartY + 1 + i);
                frame.putmsg("\1w" + info.lines[i] + "\1n");
            }
        });
    }
    
    /**
     * Create the Shop RichView
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
     * Build sneaker menu items with multiline format
     */
    function buildSneakerItems(ctx) {
        var items = [];
        var num = 1;
        
        for (var id in SNEAKERS) {
            if (SNEAKERS.hasOwnProperty(id)) {
                var sneaker = SNEAKERS[id];
                var owned = ctx.inventory && ctx.inventory.sneakers && 
                            ctx.inventory.sneakers.indexOf(id) >= 0;
                var equipped = ctx.equipment && ctx.equipment.feet === id;
                
                var modStr = formatMods(sneaker.mods);
                var priceStr;
                var statusTag = "";
                
                if (equipped) {
                    statusTag = " \1g[EQUIPPED]\1n";
                    priceStr = "";
                } else if (owned) {
                    statusTag = " \1c[OWNED]\1n";
                    priceStr = "";
                } else {
                    var canAfford = (ctx.cash || 0) >= sneaker.price;
                    priceStr = canAfford ? "\1y$" + sneaker.price + "\1n" : "\1r$" + sneaker.price + "\1n";
                }
                
                // Build detail line with description + stats
                var detailLine = "\1k\1h" + sneaker.description + "\1n";
                var statsLine = modStr + (priceStr ? "  " + priceStr : "");
                
                items.push({
                    text: sneaker.name + statusTag,
                    detail: [detailLine, statsLine],
                    value: id,
                    hotkey: String(num),
                    disabled: equipped,  // Can't re-equip what's already equipped
                    _sneaker: sneaker,
                    _owned: owned,
                    _equipped: equipped
                });
                num++;
            }
        }
        
        // Add back option
        items.push({
            text: "Back",
            value: "back",
            hotkey: "Q"
        });
        
        return items;
    }
    
    /**
     * Build drink menu items with multiline format
     */
    function buildDrinkItems(ctx) {
        var items = [];
        var num = 1;
        
        for (var id in DRINKS) {
            if (DRINKS.hasOwnProperty(id)) {
                var drink = DRINKS[id];
                var canAfford = (ctx.cash || 0) >= drink.price;
                var priceStr = canAfford ? "\1y$" + drink.price + "\1n" : "\1r$" + drink.price + "\1n";
                var effectStr = formatEffect(drink.effect);
                
                // Build detail lines
                var detailLine = "\1k\1h" + drink.description + "\1n";
                var statsLine = effectStr + "  " + priceStr;
                
                items.push({
                    text: drink.name,
                    detail: [detailLine, statsLine],
                    value: id,
                    hotkey: String(num),
                    disabled: !canAfford,
                    _drink: drink
                });
                num++;
            }
        }
        
        // Add back option
        items.push({
            text: "Back",
            value: "back",
            hotkey: "Q"
        });
        
        return items;
    }
    
    /**
     * Sneaker shop submenu
     */
    function buySneakers(view, ctx) {
        while (true) {
            view.clearZone("content");
            view.setContentZone("content");
            view.setCursorY(0);
            
            view.header("SNEAKERS");
            view.blank();
            view.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
            
            // Show current equipment
            var currentSneaker = ctx.equipment && ctx.equipment.feet ? 
                SNEAKERS[ctx.equipment.feet] : null;
            if (currentSneaker) {
                view.line("Wearing: \1c" + currentSneaker.name + "\1n");
            } else {
                view.line("Wearing: \1kNothing special\1n");
            }
            view.blank();
            
            var items = buildSneakerItems(ctx);
            var choice = view.menu(items, {
                y: 6,
                multiline: true,
                detailIndent: 2,
                onSelect: function(item, index, rv) {
                    // Show sneaker preview in art zone
                    if (item._sneaker) {
                        drawSneakerPreview(rv, item._sneaker, item._owned, item._equipped);
                    }
                    rv.render();
                }
            });
            
            if (!choice || choice === "back") {
                return;
            }
            
            // Find the selected item
            var selectedItem = null;
            for (var i = 0; i < items.length; i++) {
                if (items[i].value === choice) {
                    selectedItem = items[i];
                    break;
                }
            }
            
            if (selectedItem && selectedItem._sneaker) {
                handleSneakerPurchase(view, ctx, selectedItem);
            }
        }
    }
    
    /**
     * Draw sneaker preview in art zone
     */
    function drawSneakerPreview(view, sneaker, owned, equipped) {
        view.updateZone("art", function(frame) {
            // Clear preview area
            var previewY = 14;
            for (var y = previewY; y <= 20; y++) {
                frame.gotoxy(1, y);
                frame.putmsg("\1n" + repeatSpaces(40));
            }
            
            frame.gotoxy(2, previewY);
            frame.putmsg("\1h\1w" + sneaker.name + "\1n");
            
            frame.gotoxy(2, previewY + 1);
            frame.putmsg("\1k\1h" + sneaker.description + "\1n");
            
            frame.gotoxy(2, previewY + 3);
            if (equipped) {
                frame.putmsg("\1gCurrently equipped\1n");
            } else if (owned) {
                frame.putmsg("\1cPress Enter to equip\1n");
            } else {
                frame.putmsg("\1yPress Enter to buy\1n");
            }
        });
    }
    
    /**
     * Handle sneaker purchase/equip
     */
    function handleSneakerPurchase(view, ctx, item) {
        var sneaker = item._sneaker;
        
        view.clearZone("content");
        view.setCursorY(0);
        view.blank();
        
        if (item._owned) {
            // Equip owned item
            if (!ctx.equipment) ctx.equipment = {};
            ctx.equipment.feet = sneaker.id;
            view.line("\1gEquipped " + sneaker.name + "!\1n");
        } else {
            // Try to buy
            if ((ctx.cash || 0) >= sneaker.price) {
                ctx.cash -= sneaker.price;
                if (!ctx.inventory) ctx.inventory = {};
                if (!ctx.inventory.sneakers) ctx.inventory.sneakers = [];
                ctx.inventory.sneakers.push(sneaker.id);
                
                // Auto-equip
                if (!ctx.equipment) ctx.equipment = {};
                ctx.equipment.feet = sneaker.id;
                
                view.line("\1gPurchased and equipped\1n");
                view.line("\1g" + sneaker.name + "!\1n");
                view.blank();
                view.line("\1y-$" + sneaker.price + "\1n");
            } else {
                view.warn("Not enough cash!");
            }
        }
        
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    /**
     * Drinks shop submenu
     */
    function buyDrinks(view, ctx) {
        while (true) {
            view.clearZone("content");
            view.setContentZone("content");
            view.setCursorY(0);
            
            view.header("DRINKS");
            view.blank();
            view.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
            view.info("Boosts last until your next game.");
            view.blank();
            
            var items = buildDrinkItems(ctx);
            var choice = view.menu(items, {
                y: 6,
                multiline: true,
                detailIndent: 2,
                onSelect: function(item, index, rv) {
                    if (item._drink) {
                        drawDrinkPreview(rv, item._drink);
                    }
                    rv.render();
                }
            });
            
            if (!choice || choice === "back") {
                return;
            }
            
            // Find selected item
            var selectedItem = null;
            for (var i = 0; i < items.length; i++) {
                if (items[i].value === choice) {
                    selectedItem = items[i];
                    break;
                }
            }
            
            if (selectedItem && selectedItem._drink) {
                handleDrinkPurchase(view, ctx, selectedItem);
            }
        }
    }
    
    /**
     * Draw drink preview in art zone
     * (Disabled - info already shown in lightbar menu)
     */
    function drawDrinkPreview(view, drink) {
        // No-op: drink details shown in multiline menu
    }
    
    /**
     * Handle drink purchase
     */
    function handleDrinkPurchase(view, ctx, item) {
        var drink = item._drink;
        
        view.clearZone("content");
        view.setCursorY(0);
        view.blank();
        
        if ((ctx.cash || 0) >= drink.price) {
            ctx.cash -= drink.price;
            applyDrinkEffect(ctx, drink);
            
            view.line("\1gYou drink the " + drink.name + "...\1n");
            view.blank();
            view.info("The effect will last until");
            view.info("your next game.");
            view.blank();
            view.line("\1y-$" + drink.price + "\1n");
        } else {
            view.warn("Not enough cash!");
        }
        
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
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
     * Main RichView shop
     */
    function runRichView(ctx) {
        var view = createView();
        loadArt(view);
        
        while (true) {
            view.clearZone("content");
            view.setContentZone("content");
            view.setCursorY(0);
            
            view.blank();
            view.line("\"Looking for an edge?");
            view.line(" You came to the right place.\"");
            view.blank();
            view.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
            view.blank();
            
            var menuItems = [
                { text: "Sneakers", value: "sneakers", hotkey: "1" },
                { text: "Drinks & Consumables", value: "drinks", hotkey: "2" },
                { text: "Leave Shop", value: "leave", hotkey: "Q" }
            ];
            
            var choice = view.menu(menuItems, {
                y: 8,
                onSelect: function(item, index, rv) {
                    drawInfoPanel(rv, item.value);
                    rv.render();
                }
            });
            
            switch (choice) {
                case "sneakers":
                    buySneakers(view, ctx);
                    loadArt(view);  // Reload art after returning
                    break;
                case "drinks":
                    buyDrinks(view, ctx);
                    loadArt(view);
                    break;
                case "leave":
                case null:
                    view.close();
                    return;
            }
        }
    }
    
    /**
     * Legacy fallback (no RichView)
     */
    function runLegacy(ctx) {
        while (true) {
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
            
            var choice = LORB.View.prompt("Choice: ").toUpperCase();
            
            switch (choice) {
                case "1":
                    legacySneakers(ctx);
                    break;
                case "2":
                    legacyDrinks(ctx);
                    break;
                case "Q":
                    return;
            }
        }
    }
    
    /**
     * Legacy sneaker shop
     */
    function legacySneakers(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("SNEAKERS");
            LORB.View.line("");
            LORB.View.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
            
            var currentSneaker = ctx.equipment && ctx.equipment.feet ? 
                SNEAKERS[ctx.equipment.feet] : null;
            if (currentSneaker) {
                LORB.View.line("Wearing: \1c" + currentSneaker.name + "\1n");
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
            
            if (choice === "Q") return;
            
            var idx = parseInt(choice, 10);
            if (menuMap[idx]) {
                var item = menuMap[idx];
                
                if (item.equipped) {
                    LORB.View.line("\1kAlready wearing these.\1n");
                } else if (item.owned) {
                    if (!ctx.equipment) ctx.equipment = {};
                    ctx.equipment.feet = item.id;
                    LORB.View.line("\1gEquipped " + item.sneaker.name + "!\1n");
                } else {
                    if ((ctx.cash || 0) >= item.sneaker.price) {
                        ctx.cash -= item.sneaker.price;
                        if (!ctx.inventory) ctx.inventory = {};
                        if (!ctx.inventory.sneakers) ctx.inventory.sneakers = [];
                        ctx.inventory.sneakers.push(item.id);
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
     * Legacy drinks shop
     */
    function legacyDrinks(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("DRINKS");
            LORB.View.line("");
            LORB.View.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
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
            
            if (choice === "Q") return;
            
            var idx = parseInt(choice, 10);
            if (menuMap[idx]) {
                var item = menuMap[idx];
                
                if ((ctx.cash || 0) >= item.drink.price) {
                    ctx.cash -= item.drink.price;
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
     * Main entry point
     */
    function run(ctx) {
        if (RichView) {
            return runRichView(ctx);
        } else {
            return runLegacy(ctx);
        }
    }
    
    /**
     * Helper: repeat spaces
     */
    function repeatSpaces(n) {
        var s = "";
        for (var i = 0; i < n; i++) s += " ";
        return s;
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
