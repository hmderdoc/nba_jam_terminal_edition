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
        
        while (true) {
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
            
            // Content zone - show player resources
            view.setContentZone("content");
            view.setCursorY(0);
            
            var labelColor = "\1h" + (teamColors.fgFromBg || "\1b");
            var dimColor = teamColors.fgFromBg || "\1b";
            
            view.line(labelColor + mallName.toUpperCase() + "\1n");
            view.blank();
            
            // Show player's current resources
            view.line("\1wCash: \1h\1y$" + (ctx.cash || 0) + "\1n");
            view.line("\1wGym Sessions: \1h\1c" + (ctx.gymSessions || 0) + "\1n");
            view.blank();
            
            // Show equipped gear
            if (ctx.equipped && ctx.equipped.feet) {
                view.line("\1wSneakers: \1c" + ctx.equipped.feet.name + "\1n");
            } else {
                view.line(dimColor + "No sneakers equipped\1n");
            }
            
            if (ctx.equipped && ctx.equipped.drink) {
                view.line("\1wDrink: \1c" + ctx.equipped.drink.name + "\1n");
            }
            
            view.blank();
            
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
            
            // Draw initial tooltip
            drawTooltip(menuItems[0].tooltip || "");
            
            var choice = view.menu(menuItems, { y: 9, onSelect: onSelectCallback });
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
