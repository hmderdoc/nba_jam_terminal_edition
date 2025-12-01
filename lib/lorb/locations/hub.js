/**
 * hub.js - Rim City Main Hub
 * 
 * Loading .bin art files using BinLoader (setData blit method)
 */

var _hubRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _hubRichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[HUB] Failed to load RichView: " + e);
}

// Load BinLoader for .bin file loading
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
        log(LOG_WARNING, "[HUB] Failed to load bin-loader.js: " + e);
    }
}

(function() {
    
    var RichView = _hubRichView;
    
    var DEFAULT_STREET_TURNS = 10;
    var DEFAULT_GYM_SESSIONS = 3;
    
    // Art file paths and dimensions
    var ART_HEADER = "/sbbs/xtrn/nba_jam/assets/lorb/hub_header.bin";
    var ART_HEADER_W = 80;
    var ART_HEADER_H = 4;
    
    var ART_SIDE = "/sbbs/xtrn/nba_jam/assets/lorb/hub_art.bin";
    var ART_SIDE_W = 40;
    var ART_SIDE_H = 20;
    
    function initDailyResources(ctx) {
        if (typeof ctx.streetTurns !== "number") ctx.streetTurns = DEFAULT_STREET_TURNS;
        if (typeof ctx.gymSessions !== "number") ctx.gymSessions = DEFAULT_GYM_SESSIONS;
        if (typeof ctx.day !== "number") ctx.day = 1;
    }
    
    function newDay(ctx) {
        ctx.day = (ctx.day || 0) + 1;
        ctx.streetTurns = DEFAULT_STREET_TURNS;
        ctx.gymSessions = DEFAULT_GYM_SESSIONS;
        ctx.restUsedToday = false;
        if (ctx.tempBuffs) ctx.tempBuffs = {};
    }
    
    function run(ctx) {
        initDailyResources(ctx);
        if (RichView) {
            return runRichView(ctx);
        } else {
            return runLegacy(ctx);
        }
    }
    
    function runRichView(ctx) {
        while (true) {
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 4 },
                    { name: "art", x: 1, y: 5, width: 40, height: 20 },
                    { name: "content", x: 41, y: 5, width: 40, height: 20 }
                ],
                theme: "lorb"
            });
            
            // Load .bin art files using BinLoader
            loadArtWithBinLoader(view);
            
            // Draw status in content zone using RichView helpers (applies theme colors)
            view.setContentZone("content");
            view.setCursorY(0);
            
            view.blank();
            view.blank();
            view.line("Day: " + ctx.day);
            view.blank();
            view.line("Street Turns: " + ctx.streetTurns + "/" + DEFAULT_STREET_TURNS);
            view.line("Gym Sessions: " + ctx.gymSessions + "/" + DEFAULT_GYM_SESSIONS);
            view.blank();
            view.line("Cash: $" + (ctx.cash || 0));
            view.line("Rep: " + (ctx.rep || 0));
            view.blank();
            view.info("[Arrows] Select [ENTER] Confirm");
            
            var menuItems = [
                { text: "Hit the Courts", value: "courts", hotkey: "1", disabled: ctx.streetTurns <= 0 },
                { text: "Club 23", value: "club", hotkey: "2" },
                { text: "The Gym", value: "gym", hotkey: "3", disabled: ctx.gymSessions <= 0 },
                { text: "Gear Shop", value: "shop", hotkey: "4" },
                { text: "Your Crib", value: "crib", hotkey: "5" },
                { text: "Tournaments", value: "tournaments", hotkey: "6" },
                { text: "Call it a Night", value: "quit", hotkey: "Q" }
            ];
            
            var choice = view.menu(menuItems, { y: 13 });
            view.close();
            
            var result = handleChoice(choice, ctx);
            if (result === "quit" || result === "reset") return result;
        }
    }
    
    function loadArtWithBinLoader(view) {
        if (typeof BinLoader === "undefined") {
            return;
        }
        
        // Load header banner
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            BinLoader.loadIntoFrame(
                headerFrame, 
                ART_HEADER, 
                ART_HEADER_W, 
                ART_HEADER_H, 
                1, 1
            );
        }
        
        // Load side art
        var artFrame = view.getZone("art");
        if (artFrame) {
            BinLoader.loadIntoFrame(
                artFrame, 
                ART_SIDE, 
                ART_SIDE_W, 
                ART_SIDE_H, 
                1, 1
            );
        }
        
        view.render();
    }
    
    function handleChoice(choice, ctx) {
        switch (choice) {
            case "courts":
                if (LORB.Locations && LORB.Locations.Courts) {
                    LORB.Locations.Courts.run(ctx);
                } else {
                    showUnavailable("Courts");
                }
                break;
            case "club":
                if (LORB.Locations && LORB.Locations.Club23) {
                    LORB.Locations.Club23.run(ctx);
                } else {
                    showUnavailable("Club 23");
                }
                break;
            case "gym":
                if (LORB.Locations && LORB.Locations.Gym) {
                    LORB.Locations.Gym.run(ctx);
                } else {
                    showUnavailable("Gym");
                }
                break;
            case "shop":
                if (LORB.Locations && LORB.Locations.Shop) {
                    LORB.Locations.Shop.run(ctx);
                } else {
                    showUnavailable("Gear Shop");
                }
                break;
            case "stats":
                if (LORB.UI && LORB.UI.StatsView) {
                    LORB.UI.StatsView.show(ctx);
                } else {
                    showUnavailable("Stats view");
                }
                break;
            case "crib":
                if (LORB.Locations && LORB.Locations.Crib) {
                    var cribResult = LORB.Locations.Crib.run(ctx);
                    if (cribResult === "reset") {
                        return "reset";
                    }
                } else {
                    showUnavailable("Your Crib");
                }
                break;
            case "tournaments":
                if (LORB.Locations && LORB.Locations.Tournaments) {
                    LORB.Locations.Tournaments.run(ctx);
                } else {
                    showUnavailable("Tournaments");
                }
                break;
            case "quit":
                return endDay(ctx);
            case "reset":
                return handleReset(ctx);
            default:
                if (choice && choice.toUpperCase && choice.toUpperCase() === "RESET") {
                    return handleReset(ctx);
                }
                break;
        }
        return null;
    }
    
    function showUnavailable(name) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.warn(name + " not available yet.");
        LORB.View.line("Press any key...");
        console.getkey();
    }
    
    function handleReset(ctx) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.line("");
        LORB.View.line("\1r\1h*** CHARACTER RESET ***\1n");
        LORB.View.line("");
        LORB.View.line("This will DELETE your character permanently.");
        LORB.View.line("You will need to create a new character next time.");
        LORB.View.line("");
        if (LORB.View.confirm("Are you sure? Type Y to confirm: ")) {
            var removeResult = LORB.Persist.remove(ctx._user);
            LORB.View.line("");
            if (removeResult) {
                LORB.View.line("\1gCharacter deleted successfully.\1n");
            } else {
                LORB.View.line("\1rFailed to delete from database, clearing locally.\1n");
            }
            ctx.archetype = null;
            ctx._deleted = true;
            LORB.View.line("\1yGoodbye. You'll start fresh next time.\1n");
            LORB.View.line("");
            console.getkey();
            return "reset";
        }
        return null;
    }
    
    function endDay(ctx) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("DAY " + ctx.day + " COMPLETE");
        LORB.View.line("");
        LORB.View.line("The streetlights flicker on as you head home.");
        LORB.View.line("Another day in Rim City done.");
        LORB.View.line("");
        LORB.View.line("Press any key to rest...");
        console.getkey();
        newDay(ctx);
        return "quit";
    }
    
    function runLegacy(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.line("\1h\1c R I M   C I T Y \1n");
            LORB.View.line("");
            LORB.View.line("Street Turns: " + ctx.streetTurns + "  Gym: " + ctx.gymSessions);
            LORB.View.line("Cash: $" + (ctx.cash || 0) + "  Rep: " + (ctx.rep || 0));
            LORB.View.line("");
            LORB.View.line("[1] Courts  [2] Club  [3] Gym  [4] Shop  [5] Crib  [6] Tourney  [Q] Quit");
            LORB.View.line("");
            var choice = LORB.View.prompt("Choice: ");
            var map = { "1": "courts", "2": "club", "3": "gym", "4": "shop", "5": "crib", "6": "tournaments", "Q": "quit", "RESET": "reset" };
            var result = handleChoice(map[choice.toUpperCase()] || null, ctx);
            if (result === "quit" || result === "reset") return result;
        }
    }
    
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Hub = {
        run: run,
        newDay: newDay,
        initDailyResources: initDailyResources,
        DEFAULT_STREET_TURNS: DEFAULT_STREET_TURNS,
        DEFAULT_GYM_SESSIONS: DEFAULT_GYM_SESSIONS
    };
    
})();
