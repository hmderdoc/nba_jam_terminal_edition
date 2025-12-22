/**
 * mall.js - City Mall (Consolidated Shopping District)
 * 
 * Combines Gear Shop, Gym, and Appearance customization into one location.
 * Mall name is city-specific (pulled from cities.json).
 * 
 * RichView layout with figlet banner, art zone, lightbar menu.
 */

var _mallRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _mallRichView = RichView;
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
    
    var RichView = _mallRichView;
    
    // Art dimensions
    var ART_SIDE_W = 40;
    var ART_SIDE_H = 20;
    
    // Mall art path (falls back to shop art if mall_art.bin doesn't exist)
    var MALL_ART = "/sbbs/xtrn/nba_jam/assets/lorb/mall_art.bin";
    var FALLBACK_ART = "/sbbs/xtrn/nba_jam/assets/lorb/shop_art.bin";
    
    // Walkable zone for wandering sprites (coordinates from user: 1,12 to 25,20)
    var MALL_WALKABLE_ZONE = { x: 1, y: 12, width: 24, height: 8 };
    
    // Lazy-loaded modules for wandering sprites
    var _spriteWandererLoaded = false;
    var _spriteWandererClass = null;
    var _spriteSelectorsLoaded = false;
    var _spriteSelectorsModule = null;
    
    /**
     * Get SpriteWanderer class, loading it lazily if needed
     */
    function getSpriteWanderer() {
        if (_spriteWandererLoaded) {
            return _spriteWandererClass;
        }
        _spriteWandererLoaded = true;
        
        try {
            load("/sbbs/xtrn/nba_jam/lib/lorb/ui/sprite-wanderer.js");
            if (typeof LORB !== "undefined" && LORB.UI && LORB.UI.SpriteWanderer) {
                _spriteWandererClass = LORB.UI.SpriteWanderer;
            }
        } catch (e) {
            // SpriteWanderer is optional - continue without it
        }
        
        return _spriteWandererClass;
    }
    
    /**
     * Get SpriteSelectors module, loading it lazily if needed
     */
    function getSpriteSelectors() {
        if (_spriteSelectorsLoaded) {
            return _spriteSelectorsModule;
        }
        _spriteSelectorsLoaded = true;
        
        try {
            load("/sbbs/xtrn/nba_jam/lib/lorb/util/sprite-selectors.js");
            if (typeof LORB !== "undefined" && LORB.Util && LORB.Util.SpriteSelectors) {
                _spriteSelectorsModule = LORB.Util.SpriteSelectors;
            }
        } catch (e) {
            // SpriteSelectors is optional - continue without it
        }
        
        return _spriteSelectorsModule;
    }
    
    /**
     * Get current city from SharedState
     */
    function getCurrentCity() {
        if (LORB.Cities && LORB.Cities.getToday) {
            return LORB.Cities.getToday();
        }
        return {
            id: "default",
            cityName: "Rim City",
            mallName: "The Mall"
        };
    }
    
    /**
     * Get mall name for current city
     */
    function getMallName() {
        var city = getCurrentCity();
        if (LORB.Cities && LORB.Cities.getMallName) {
            return LORB.Cities.getMallName(city);
        }
        return city.mallName || "The Mall";
    }
    
    /**
     * Get city theme for lightbar styling
     */
    function getCityTheme() {
        var city = getCurrentCity();
        if (LORB.Cities && LORB.Cities.getCityTheme) {
            return LORB.Cities.getCityTheme(city);
        }
        return "lorb";
    }
    
    /**
     * Get team colors for display
     */
    function getTeamColors() {
        var city = getCurrentCity();
        if (LORB.Cities && LORB.Cities.getTeamColors) {
            return LORB.Cities.getTeamColors(city);
        }
        return { fg: "\1h\1c", fgFromBg: "\1b", fgFromBgAlt: "\1y" };
    }
    
    /**
     * Load art into the art zone
     */
    function loadMallArt(view) {
        if (typeof BinLoader === "undefined") return;
        
        var artFrame = view.getZone("art");
        if (!artFrame) return;
        
        // Try city-specific mall art first, then generic mall art, then fallback to shop
        var city = getCurrentCity();
        var cityArtPath = "/sbbs/xtrn/nba_jam/assets/lorb/cities/" + city.id + "_mall.bin";
        var artPath;
        
        if (file_exists(cityArtPath)) {
            artPath = cityArtPath;
        } else if (file_exists(MALL_ART)) {
            artPath = MALL_ART;
        } else {
            artPath = FALLBACK_ART;
        }
        
        if (file_exists(artPath)) {
            BinLoader.loadIntoFrame(artFrame, artPath, ART_SIDE_W, ART_SIDE_H, 1, 1);
        }
        
        view.render();
    }
    
    /**
     * Render the figlet banner with mall name
     */
    function renderMallBanner(view, mallName) {
        var headerFrame = view.getZone("header");
        if (!headerFrame) return;
        
        var city = getCurrentCity();
        var fgAttr = 11; // Default LIGHTCYAN
        
        try {
            if (LORB.Cities && LORB.Cities.getTeamColors) {
                var colors = LORB.Cities.getTeamColors(city);
                if (colors && typeof colors.fgAttr === "number") {
                    fgAttr = colors.fgAttr;
                }
            }
        } catch (e) {
            // Use default
        }
        
        // Use FigletBanner if available
        if (LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
            // Use shorter name for figlet if mall name is long
            var bannerText = mallName.length > 15 ? "THE MALL" : mallName.toUpperCase();
            LORB.Util.FigletBanner.renderToFrame(headerFrame, bannerText, fgAttr);
        } else {
            // Fallback: plain centered text
            headerFrame.clear();
            var padding = Math.floor((80 - mallName.length) / 2);
            headerFrame.gotoxy(padding + 1, 2);
            headerFrame.attr = fgAttr;
            headerFrame.putmsg(mallName.toUpperCase());
        }
    }
    
    /**
     * Helper to repeat a character
     */
    function repeatChar(ch, count) {
        var s = "";
        for (var i = 0; i < count; i++) s += ch;
        return s;
    }
    
    /**
     * Word wrap text into lines
     */
    function wrapText(text, maxWidth) {
        if (!text || text.length <= maxWidth) return [text, ""];
        
        var words = text.split(" ");
        var line1 = "";
        var line2 = "";
        var onLine1 = true;
        
        for (var i = 0; i < words.length; i++) {
            var word = words[i];
            if (onLine1) {
                if ((line1 + " " + word).trim().length <= maxWidth) {
                    line1 = (line1 + " " + word).trim();
                } else {
                    onLine1 = false;
                    line2 = word;
                }
            } else {
                if ((line2 + " " + word).trim().length <= maxWidth) {
                    line2 = (line2 + " " + word).trim();
                }
            }
        }
        
        return [line1, line2];
    }
    
    /**
     * Menu item tooltips
     */
    var TOOLTIPS = {
        gym: "Train your skills. Uses gym sessions.",
        shop: "Buy sneakers and energy drinks.",
        appearance: "Customize your look and jersey.",
        back: "Return to the city hub."
    };
    
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
     * RichView mall hub
     */
    function runRichView(ctx) {
        var mallName = getMallName();
        var cityTheme = getCityTheme();
        var teamColors = getTeamColors();
        
        // Lazy-load sprite modules (once per mall visit)
        var SpriteWanderer = getSpriteWanderer();
        var SpriteSelectors = getSpriteSelectors();
        
        while (true) {
            // Wanderer must be created fresh each iteration since view/artFrame is recreated
            var wanderer = null;
            
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 4 },
                    { name: "art", x: 1, y: 5, width: 40, height: 20 },
                    { name: "content", x: 43, y: 5, width: 38, height: 16 },
                    { name: "tooltip", x: 43, y: 21, width: 38, height: 4 }
                ],
                theme: cityTheme
            });
            
            // Render banner and art
            renderMallBanner(view, mallName);
            loadMallArt(view);
            
            // Initialize wandering sprites after loading art
            if (SpriteWanderer) {
                try {
                    var artFrame = view.getZone("art");
                    if (artFrame) {
                        var shopperSprites;
                        
                        if (SpriteSelectors && SpriteSelectors.getMallSprites) {
                            // Use smart selection: mix of player, crew, and random shoppers
                            shopperSprites = SpriteSelectors.getMallSprites(ctx);
                            SpriteSelectors.applyPositions(shopperSprites, MALL_WALKABLE_ZONE);
                        } else {
                            // Fallback: random skins without nametags
                            var availableSkins = ["brown", "lightgray", "magenta", "sonic", "shrek", "barney"];
                            var shopperCount = 2 + Math.floor(Math.random() * 2);  // 2-3 shoppers
                            shopperSprites = [];
                            for (var i = 0; i < shopperCount; i++) {
                                var skin = availableSkins[Math.floor(Math.random() * availableSkins.length)];
                                shopperSprites.push({
                                    skin: skin,
                                    x: MALL_WALKABLE_ZONE.x + 2 + (i * 8),
                                    y: MALL_WALKABLE_ZONE.y + 2,
                                    bearing: ["e", "w", "s"][Math.floor(Math.random() * 3)]
                                });
                            }
                        }
                        
                        wanderer = new SpriteWanderer({
                            parentFrame: artFrame,
                            sprites: shopperSprites,
                            walkableZones: [MALL_WALKABLE_ZONE],
                            options: {
                                speed: 450,        // Move every 450ms (slightly slower for mall ambiance)
                                pauseChance: 0.45, // 45% chance to idle (shoppers browsing)
                                showNametags: true // Show nametags for known characters
                            }
                        });
                        wanderer.start();
                        view.render();
                    }
                } catch (e) {
                    // Wanderer is optional - continue without it
                    wanderer = null;
                }
            }
            
            // Draw border on content zone - returns inner frame for menu content
            var contentFrame = view.drawBorder("content", {
                color: LIGHTGREEN,
                padding: 0
            });
            
            var labelColor = "\1h" + (teamColors.fgFromBg || "\1b");
            
            var cy = 1;
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg(labelColor + mallName.toUpperCase() + "\1n");
            cy++;  // blank line after title
            
            // Show player's current resources
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1wCash: \1h\1y$" + (ctx.cash || 0) + "\1n");
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1wGym Sessions: \1h\1c" + (ctx.gymSessions || 0) + "\1n");
            
            // Show equipped gear (only if equipped - no "not equipped" messages here)
            if (ctx.equipped && ctx.equipped.feet) {
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1wSneakers: \1c" + ctx.equipped.feet.name + "\1n");
            }
            
            if (ctx.equipped && ctx.equipped.drink) {
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1wDrink: \1c" + ctx.equipped.drink.name + "\1n");
            }
            
            // Single blank line before menu
            cy++;
            
            // Menu starts after the info section
            var menuStartY = cy;
            
            // Build menu items
            var menuItems = [
                { text: "The Gym", value: "gym", hotkey: "1", disabled: ctx.gymSessions <= 0, tooltip: TOOLTIPS.gym },
                { text: "Gear Shop", value: "shop", hotkey: "2", tooltip: TOOLTIPS.shop },
                { text: "Threads & Flair", value: "appearance", hotkey: "3", tooltip: TOOLTIPS.appearance },
                { text: "Back to Hub", value: "back", hotkey: "Q", tooltip: TOOLTIPS.back }
            ];
            
            // Tooltip colors
            var tooltipBorderColor = "\1h" + (teamColors.fgFromBgAlt || teamColors.fg);
            var tooltipTextColor = "\1h" + (teamColors.fgFromBg || teamColors.fg);
            
            // Draw tooltip helper
            function drawTooltip(text) {
                var tooltipFrame = view.getZone("tooltip");
                if (!tooltipFrame) return;
                
                tooltipFrame.clear();
                
                var innerWidth = 36;
                var lines = wrapText(text || "", innerWidth);
                var line1 = lines[0] || "";
                var line2 = lines[1] || "";
                
                var pad1Left = Math.floor((innerWidth - line1.length) / 2);
                var pad1Right = innerWidth - line1.length - pad1Left;
                var pad2Left = Math.floor((innerWidth - line2.length) / 2);
                var pad2Right = innerWidth - line2.length - pad2Left;
                
                tooltipFrame.gotoxy(1, 1);
                tooltipFrame.putmsg(tooltipBorderColor + "\xDA" + repeatChar("\xC4", innerWidth) + "\xBF\1n");
                
                tooltipFrame.gotoxy(1, 2);
                tooltipFrame.putmsg(tooltipBorderColor + "\xB3" + tooltipTextColor + repeatChar(" ", pad1Left) + line1 + repeatChar(" ", pad1Right) + tooltipBorderColor + "\xB3\1n");
                
                tooltipFrame.gotoxy(1, 3);
                tooltipFrame.putmsg(tooltipBorderColor + "\xB3" + tooltipTextColor + repeatChar(" ", pad2Left) + line2 + repeatChar(" ", pad2Right) + tooltipBorderColor + "\xB3\1n");
                
                tooltipFrame.gotoxy(1, 4);
                tooltipFrame.putmsg(tooltipBorderColor + "\xC0" + repeatChar("\xC4", innerWidth) + "\xD9\1n");
                
                view.render();
            }
            
            // onSelect callback
            var onSelectCallback = function(item, index, richView, lb) {
                drawTooltip(item.tooltip || "");
            };
            
            // onIdle callback to animate wandering sprites
            var onIdleCallback = function(richView, lightbar) {
                if (wanderer && wanderer.isRunning()) {
                    wanderer.update();
                    wanderer.cycle();
                    richView.render();
                }
            };
            
            // Draw initial tooltip
            drawTooltip(menuItems[0].tooltip || "");
            
            // Set content zone to the bordered inner frame for menu rendering
            view.setContentZone(contentFrame);
            var choice = view.menu(menuItems, { y: menuStartY, onSelect: onSelectCallback, onIdle: onIdleCallback });
            
            // Stop wanderer before navigating away
            if (wanderer) wanderer.stop();
            view.close();
            
            // Handle choice
            switch (choice) {
                case "gym":
                    if (LORB.Locations && LORB.Locations.Gym) {
                        LORB.Locations.Gym.run(ctx);
                    } else {
                        showUnavailable("The Gym");
                    }
                    break;
                    
                case "shop":
                    if (LORB.Locations && LORB.Locations.Shop) {
                        LORB.Locations.Shop.run(ctx);
                    } else {
                        showUnavailable("Gear Shop");
                    }
                    break;
                    
                case "appearance":
                    // Use the appearance editor from crib.js
                    if (LORB.Locations && LORB.Locations.Crib && LORB.Locations.Crib.runAppearance) {
                        LORB.Locations.Crib.runAppearance(ctx);
                    } else {
                        showUnavailable("Threads & Flair");
                    }
                    break;
                    
                case "back":
                case null:
                    if (wanderer) wanderer.stop();
                    return;
            }
        }
    }
    
    /**
     * Legacy fallback (no RichView)
     */
    function runLegacy(ctx) {
        var mallName = getMallName();
        
        while (true) {
            LORB.View.clear();
            LORB.View.header(mallName.toUpperCase());
            LORB.View.line("");
            LORB.View.line("Cash: $" + (ctx.cash || 0));
            LORB.View.line("Gym Sessions: " + (ctx.gymSessions || 0));
            LORB.View.line("");
            LORB.View.line("[1] The Gym" + (ctx.gymSessions <= 0 ? " (no sessions)" : ""));
            LORB.View.line("[2] Gear Shop");
            LORB.View.line("[3] Threads & Flair");
            LORB.View.line("[Q] Back to Hub");
            LORB.View.line("");
            
            var choice = LORB.View.getKeys("", "123Qq");
            
            switch (choice.toUpperCase()) {
                case "1":
                    if (ctx.gymSessions > 0 && LORB.Locations && LORB.Locations.Gym) {
                        LORB.Locations.Gym.run(ctx);
                    }
                    break;
                case "2":
                    if (LORB.Locations && LORB.Locations.Shop) {
                        LORB.Locations.Shop.run(ctx);
                    }
                    break;
                case "3":
                    if (LORB.Locations && LORB.Locations.Crib && LORB.Locations.Crib.runAppearance) {
                        LORB.Locations.Crib.runAppearance(ctx);
                    }
                    break;
                case "Q":
                    return;
            }
        }
    }
    
    /**
     * Show unavailable message
     */
    function showUnavailable(name) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.warn(name + " not available yet.");
        LORB.View.line("Press any key...");
        console.getkey();
    }
    
    // Export to LORB namespace
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Mall = {
        run: run,
        getMallName: getMallName
    };
    
})();
