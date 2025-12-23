/**
 * shop.js - Rim City Gear Shop (Refactored)
 * 
 * Buy sneakers and consumables that modify stats.
 * Uses RichView with consistent layout: art zone + bordered content + tooltip zone.
 * Submenus fully take over content zone (no dual-panel confusion).
 */

var _shopRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _shopRichView = RichView;
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
    
    var RichView = _shopRichView;
    
    // Art file paths
    var ART_SIDE = "/sbbs/xtrn/nba_jam/assets/lorb/shop_art.bin";
    var ART_SIDE_W = 40, ART_SIDE_H = 20;
    
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
    
    // Stat name abbreviations
    var STAT_NAMES = {
        speed: "SPD", threePt: "3PT", power: "PWR",
        steal: "STL", block: "BLK", dunk: "DNK"
    };
    
    /**
     * Helper: repeat character
     */
    function repeatChar(ch, n) {
        var s = "";
        for (var i = 0; i < n; i++) s += ch;
        return s;
    }
    
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
                    stats[b] = Math.max(1, Math.min(12, stats[b]));
                }
            }
        }
        
        return stats;
    }
    
    /**
     * Format stat mods for display
     */
    function formatMods(mods) {
        if (!mods) return "";
        var parts = [];
        for (var s in mods) {
            if (mods.hasOwnProperty(s)) {
                var val = mods[s];
                var name = STAT_NAMES[s] || s;
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
        if (effect.type === "random") {
            return "\1m+? Random Stat\1n";
        } else if (effect.stat) {
            var name = STAT_NAMES[effect.stat] || effect.stat;
            return "\1g+" + effect.bonus + " " + name + "\1n";
        }
        return "";
    }
    
    /**
     * Apply drink effect to player context
     */
    function applyDrinkEffect(ctx, drink) {
        if (!ctx.tempBuffs) ctx.tempBuffs = {};
        
        if (drink.effect.type === "random") {
            var stats = ["speed", "threePt", "power", "steal", "block", "dunk"];
            var stat = stats[Math.floor(Math.random() * stats.length)];
            ctx.tempBuffs[stat] = (ctx.tempBuffs[stat] || 0) + drink.effect.bonus;
        } else if (drink.effect.stat) {
            ctx.tempBuffs[drink.effect.stat] = (ctx.tempBuffs[drink.effect.stat] || 0) + drink.effect.bonus;
        }
    }
    
    /**
     * Create a RichView with the standard shop layout
     */
    function createShopView() {
        return new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 43, y: 5, width: 38, height: 16 },
                { name: "tooltip", x: 43, y: 21, width: 38, height: 4 }
            ],
            theme: "lorb"
        });
    }
    
    /**
     * Load shop art into art zone
     */
    function loadArt(view) {
        if (typeof BinLoader === "undefined") return;
        
        var artFrame = view.getZone("art");
        if (artFrame && file_exists(ART_SIDE)) {
            BinLoader.loadIntoFrame(artFrame, ART_SIDE, ART_SIDE_W, ART_SIDE_H, 1, 1);
        }
        view.render();
    }
    
    /**
     * Render figlet banner in header zone
     */
    function renderBanner(view, title) {
        var headerFrame = view.getZone("header");
        if (!headerFrame) return;
        
        if (LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
            LORB.Util.FigletBanner.renderToFrame(headerFrame, title, LIGHTCYAN);
        } else {
            headerFrame.clear();
            headerFrame.gotoxy(2, 2);
            headerFrame.putmsg("\1h\1c" + title + "\1n");
        }
    }
    
    /**
     * Draw tooltip box with centered text
     */
    function drawTooltip(view, lines) {
        var tooltipFrame = view.getZone("tooltip");
        if (!tooltipFrame) return;
        
        tooltipFrame.clear();
        
        var innerWidth = 36;
        var hLine = repeatChar("\xC4", innerWidth);
        
        tooltipFrame.gotoxy(1, 1);
        tooltipFrame.putmsg("\1h\1c\xDA" + hLine + "\xBF\1n");
        
        for (var i = 0; i < 2; i++) {
            var line = (lines && lines[i]) ? lines[i] : "";
            var padLeft = Math.floor((innerWidth - line.length) / 2);
            var padRight = innerWidth - line.length - padLeft;
            tooltipFrame.gotoxy(1, 2 + i);
            tooltipFrame.putmsg("\1h\1c\xB3\1n\1c" + repeatChar(" ", padLeft) + line + repeatChar(" ", padRight) + "\1h\1c\xB3\1n");
        }
        
        tooltipFrame.gotoxy(1, 4);
        tooltipFrame.putmsg("\1h\1c\xC0" + hLine + "\xD9\1n");
        
        view.render();
    }
    
    /**
     * Main shop menu
     */
    function runRichView(ctx) {
        while (true) {
            var view = createShopView();
            renderBanner(view, "Gear Shop");
            loadArt(view);
            
            // Draw bordered content zone
            var contentFrame = view.drawBorder("content", {
                color: LIGHTCYAN,
                padding: 0
            });
            
            var cy = 2;
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1h\1c\"Looking for an edge?\"\1n");
            cy++;
            
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1wCash: \1h\1y$" + (ctx.cash || 0) + "\1n");
            cy++;
            
            // Show equipped gear
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1wEquipped:\1n");
            
            var currentSneaker = ctx.equipment && ctx.equipment.feet ? SNEAKERS[ctx.equipment.feet] : null;
            if (currentSneaker) {
                contentFrame.gotoxy(2, cy++);
                contentFrame.putmsg("\1cSneakers: " + currentSneaker.name + "\1n");
            } else {
                contentFrame.gotoxy(2, cy++);
                contentFrame.putmsg("\1h\1kNo sneakers\1n");
            }
            
            if (ctx.tempBuffs && Object.keys(ctx.tempBuffs).length > 0) {
                contentFrame.gotoxy(2, cy++);
                contentFrame.putmsg("\1mActive drink buff\1n");
            }
            
            cy++;
            
            var menuItems = [
                { text: "\1wSneakers", value: "sneakers", hotkey: "1", tooltip: ["Permanent stat boosts", "Equip anytime you own them"] },
                { text: "\1wDrinks", value: "drinks", hotkey: "2", tooltip: ["One-time consumables", "Boost lasts until next game"] },
                { text: "\1wBack", value: "back", hotkey: "Q", tooltip: ["Return to the mall", ""] }
            ];
            
            // Initial tooltip
            drawTooltip(view, menuItems[0].tooltip);
            
            view.setContentZone(contentFrame);
            var choice = view.menu(menuItems, {
                y: cy,
                onSelect: function(item) {
                    drawTooltip(view, item.tooltip);
                }
            });
            
            view.close();
            
            switch (choice) {
                case "sneakers":
                    runSneakersMenu(ctx);
                    break;
                case "drinks":
                    runDrinksMenu(ctx);
                    break;
                case "back":
                case null:
                    return;
            }
        }
    }
    
    /**
     * Sneakers submenu - fully takes over view
     */
    function runSneakersMenu(ctx) {
        while (true) {
            var view = createShopView();
            renderBanner(view, "Sneakers");
            loadArt(view);
            
            var contentFrame = view.drawBorder("content", {
                color: LIGHTCYAN,
                padding: 0
            });
            
            var cy = 2;
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1wCash: \1h\1y$" + (ctx.cash || 0) + "\1n");
            
            var currentSneaker = ctx.equipment && ctx.equipment.feet ? SNEAKERS[ctx.equipment.feet] : null;
            if (currentSneaker) {
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1wWearing: \1c" + currentSneaker.name + "\1n");
            }
            cy++;
            
            // Build menu items
            var menuItems = [];
            for (var id in SNEAKERS) {
                if (SNEAKERS.hasOwnProperty(id)) {
                    var sneaker = SNEAKERS[id];
                    var owned = ctx.inventory && ctx.inventory.sneakers && ctx.inventory.sneakers.indexOf(id) >= 0;
                    var equipped = ctx.equipment && ctx.equipment.feet === id;
                    
                    var label = "\1w" + sneaker.name;
                    if (equipped) {
                        label += " \1g[EQUIPPED]\1n";
                    } else if (owned) {
                        label += " \1c[OWNED]\1n";
                    } else {
                        var canAfford = (ctx.cash || 0) >= sneaker.price;
                        label += canAfford ? " \1y$" + sneaker.price + "\1n" : " \1r$" + sneaker.price + "\1n";
                    }
                    
                    menuItems.push({
                        text: label,
                        value: id,
                        disabled: equipped,
                        tooltip: [sneaker.description, formatMods(sneaker.mods)],
                        _sneaker: sneaker,
                        _owned: owned,
                        _equipped: equipped
                    });
                }
            }
            
            menuItems.push({
                text: "\1wBack",
                value: "back",
                hotkey: "Q",
                tooltip: ["Return to shop", ""]
            });
            
            // Initial tooltip
            drawTooltip(view, menuItems[0].tooltip);
            
            view.setContentZone(contentFrame);
            var choice = view.menu(menuItems, {
                y: cy,
                onSelect: function(item) {
                    drawTooltip(view, item.tooltip);
                }
            });
            
            view.close();
            
            if (choice === "back" || choice === null) {
                return;
            }
            
            // Find selected item
            var selectedItem = null;
            for (var i = 0; i < menuItems.length; i++) {
                if (menuItems[i].value === choice) {
                    selectedItem = menuItems[i];
                    break;
                }
            }
            
            if (selectedItem && selectedItem._sneaker) {
                handleSneakerAction(ctx, selectedItem);
            }
        }
    }
    
    /**
     * Handle sneaker purchase/equip
     */
    function handleSneakerAction(ctx, item) {
        var sneaker = item._sneaker;
        
        if (item._owned) {
            // Equip owned sneaker
            if (!ctx.equipment) ctx.equipment = {};
            ctx.equipment.feet = sneaker.id;
            
            // Update equipped reference for mall display
            if (!ctx.equipped) ctx.equipped = {};
            ctx.equipped.feet = sneaker;
            
            showMessage("Equipped " + sneaker.name + "!", LIGHTGREEN);
        } else {
            // Try to purchase
            if ((ctx.cash || 0) >= sneaker.price) {
                ctx.cash -= sneaker.price;
                if (!ctx.inventory) ctx.inventory = {};
                if (!ctx.inventory.sneakers) ctx.inventory.sneakers = [];
                ctx.inventory.sneakers.push(sneaker.id);
                
                // Auto-equip
                if (!ctx.equipment) ctx.equipment = {};
                ctx.equipment.feet = sneaker.id;
                if (!ctx.equipped) ctx.equipped = {};
                ctx.equipped.feet = sneaker;
                
                showMessage("Purchased and equipped " + sneaker.name + "!", LIGHTGREEN);
            } else {
                showMessage("Not enough cash!", LIGHTRED);
            }
        }
    }
    
    /**
     * Drinks submenu
     */
    function runDrinksMenu(ctx) {
        while (true) {
            var view = createShopView();
            renderBanner(view, "Drinks");
            loadArt(view);
            
            var contentFrame = view.drawBorder("content", {
                color: LIGHTCYAN,
                padding: 0
            });
            
            var cy = 2;
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1wCash: \1h\1y$" + (ctx.cash || 0) + "\1n");
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1h\1kBoosts last until next game\1n");
            cy++;
            
            var menuItems = [];
            for (var id in DRINKS) {
                if (DRINKS.hasOwnProperty(id)) {
                    var drink = DRINKS[id];
                    var canAfford = (ctx.cash || 0) >= drink.price;
                    
                    var label = "\1w" + drink.name;
                    label += canAfford ? " \1y$" + drink.price + "\1n" : " \1r$" + drink.price + "\1n";
                    
                    menuItems.push({
                        text: label,
                        value: id,
                        disabled: !canAfford,
                        tooltip: [drink.description, formatEffect(drink.effect)],
                        _drink: drink
                    });
                }
            }
            
            menuItems.push({
                text: "\1wBack",
                value: "back",
                hotkey: "Q",
                tooltip: ["Return to shop", ""]
            });
            
            drawTooltip(view, menuItems[0].tooltip);
            
            view.setContentZone(contentFrame);
            var choice = view.menu(menuItems, {
                y: cy,
                onSelect: function(item) {
                    drawTooltip(view, item.tooltip);
                }
            });
            
            view.close();
            
            if (choice === "back" || choice === null) {
                return;
            }
            
            // Find selected item
            var selectedItem = null;
            for (var i = 0; i < menuItems.length; i++) {
                if (menuItems[i].value === choice) {
                    selectedItem = menuItems[i];
                    break;
                }
            }
            
            if (selectedItem && selectedItem._drink) {
                handleDrinkPurchase(ctx, selectedItem);
            }
        }
    }
    
    /**
     * Handle drink purchase
     */
    function handleDrinkPurchase(ctx, item) {
        var drink = item._drink;
        
        if ((ctx.cash || 0) >= drink.price) {
            ctx.cash -= drink.price;
            applyDrinkEffect(ctx, drink);
            showMessage("You drink the " + drink.name + "...", LIGHTGREEN);
        } else {
            showMessage("Not enough cash!", LIGHTRED);
        }
    }
    
    /**
     * Simple message display with keypress
     */
    function showMessage(text, color) {
        var view = createShopView();
        
        var contentFrame = view.drawBorder("content", {
            color: color || LIGHTCYAN,
            padding: 0
        });
        
        contentFrame.gotoxy(2, 6);
        contentFrame.putmsg("\1h\1w" + text + "\1n");
        contentFrame.gotoxy(2, 9);
        contentFrame.putmsg("\1kPress any key...\1n");
        
        view.render();
        console.getkey(K_NOSPIN);
        view.close();
    }
    
    /**
     * Legacy fallback (no RichView)
     */
    function runLegacy(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("GEAR SHOP");
            LORB.View.line("");
            LORB.View.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
            LORB.View.line("");
            LORB.View.line("\1w[1]\1n Sneakers");
            LORB.View.line("\1w[2]\1n Drinks");
            LORB.View.line("\1w[Q]\1n Back");
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
    
    function legacySneakers(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("SNEAKERS");
            LORB.View.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
            LORB.View.line("");
            
            var menuNum = 1;
            var menuMap = {};
            
            for (var id in SNEAKERS) {
                if (SNEAKERS.hasOwnProperty(id)) {
                    var sneaker = SNEAKERS[id];
                    var owned = ctx.inventory && ctx.inventory.sneakers && ctx.inventory.sneakers.indexOf(id) >= 0;
                    var equipped = ctx.equipment && ctx.equipment.feet === id;
                    var modStr = formatMods(sneaker.mods);
                    
                    var line = "\1w[" + menuNum + "]\1n " + sneaker.name;
                    if (equipped) line += " \1g[EQUIPPED]\1n";
                    else if (owned) line += " \1c[OWNED]\1n";
                    else line += " \1y$" + sneaker.price + "\1n";
                    line += " " + modStr;
                    
                    LORB.View.line(line);
                    menuMap[menuNum] = { id: id, sneaker: sneaker, owned: owned, equipped: equipped };
                    menuNum++;
                }
            }
            
            LORB.View.line("");
            LORB.View.line("\1w[Q]\1n Back");
            
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
                    if (!ctx.equipped) ctx.equipped = {};
                    ctx.equipped.feet = item.sneaker;
                    LORB.View.line("\1gEquipped!\1n");
                } else if ((ctx.cash || 0) >= item.sneaker.price) {
                    ctx.cash -= item.sneaker.price;
                    if (!ctx.inventory) ctx.inventory = {};
                    if (!ctx.inventory.sneakers) ctx.inventory.sneakers = [];
                    ctx.inventory.sneakers.push(item.id);
                    if (!ctx.equipment) ctx.equipment = {};
                    ctx.equipment.feet = item.id;
                    if (!ctx.equipped) ctx.equipped = {};
                    ctx.equipped.feet = item.sneaker;
                    LORB.View.line("\1gPurchased and equipped!\1n");
                } else {
                    LORB.View.warn("Not enough cash!");
                }
                console.getkey(K_NOSPIN);
            }
        }
    }
    
    function legacyDrinks(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("DRINKS");
            LORB.View.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
            LORB.View.line("");
            
            var menuNum = 1;
            var menuMap = {};
            
            for (var id in DRINKS) {
                if (DRINKS.hasOwnProperty(id)) {
                    var drink = DRINKS[id];
                    LORB.View.line("\1w[" + menuNum + "]\1n " + drink.name + " \1y$" + drink.price + "\1n " + formatEffect(drink.effect));
                    menuMap[menuNum] = drink;
                    menuNum++;
                }
            }
            
            LORB.View.line("");
            LORB.View.line("\1w[Q]\1n Back");
            
            var choice = LORB.View.prompt("Choice: ").toUpperCase();
            if (choice === "Q") return;
            
            var idx = parseInt(choice, 10);
            if (menuMap[idx]) {
                var drink = menuMap[idx];
                if ((ctx.cash || 0) >= drink.price) {
                    ctx.cash -= drink.price;
                    applyDrinkEffect(ctx, drink);
                    LORB.View.line("\1gYou drink the " + drink.name + "!\1n");
                } else {
                    LORB.View.warn("Not enough cash!");
                }
                console.getkey(K_NOSPIN);
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
    LORB.Locations.Shop = {
        run: run,
        SNEAKERS: SNEAKERS,
        DRINKS: DRINKS,
        getEffectiveStats: getEffectiveStats
    };
    
})();
