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
    
    // Get config values with fallbacks
    function getConfig(key, fallback) {
        if (LORB.Config && typeof LORB.Config[key] !== "undefined") {
            return LORB.Config[key];
        }
        return fallback;
    }
    
    // Art file paths and dimensions
    var ART_HEADER = "/sbbs/xtrn/nba_jam/assets/lorb/hub_header.bin";
    var ART_HEADER_W = 80;
    var ART_HEADER_H = 4;
    
    var ART_SIDE = "/sbbs/xtrn/nba_jam/assets/lorb/hub_art.bin";
    var ART_SIDE_W = 40;
    var ART_SIDE_H = 20;
    
    /**
     * Calculate the current "game day number" based on timestamp and config.
     * Uses DAY_DURATION_MS to determine day boundaries.
     * 
     * For 24-hour days with DAILY_RESET_HOUR_UTC, aligns to that hour.
     * For other durations, uses epoch-based calculation.
     */
    function calculateGameDay(timestampMs) {
        var dayDuration = getConfig("DAY_DURATION_MS", 86400000);
        var resetHour = getConfig("DAILY_RESET_HOUR_UTC", 0);
        
        if (dayDuration === 86400000) {
            // Standard 24-hour day - align to reset hour
            var resetOffsetMs = resetHour * 3600000;
            var adjustedTime = timestampMs - resetOffsetMs;
            return Math.floor(adjustedTime / dayDuration);
        } else {
            // Custom day duration - simple epoch division
            return Math.floor(timestampMs / dayDuration);
        }
    }
    
    /**
     * Calculate how many "days" have passed between two timestamps.
     */
    function daysBetween(oldTimestampMs, newTimestampMs) {
        var oldDay = calculateGameDay(oldTimestampMs);
        var newDay = calculateGameDay(newTimestampMs);
        return Math.max(0, newDay - oldDay);
    }
    
    /**
     * Get time remaining until next day reset (in ms).
     */
    function timeUntilNextDay(timestampMs) {
        var dayDuration = getConfig("DAY_DURATION_MS", 86400000);
        var resetHour = getConfig("DAILY_RESET_HOUR_UTC", 0);
        
        if (dayDuration === 86400000) {
            // Standard 24-hour day
            var resetOffsetMs = resetHour * 3600000;
            var adjustedTime = timestampMs - resetOffsetMs;
            var dayProgress = adjustedTime % dayDuration;
            return dayDuration - dayProgress;
        } else {
            // Custom day duration
            var dayProgress = timestampMs % dayDuration;
            return dayDuration - dayProgress;
        }
    }
    
    /**
     * Check for incoming live challenges and prompt the player.
     */
    function checkIncomingChallenges(ctx) {
        if (!LORB.Config || !LORB.Config.ENABLE_LIVE_CHALLENGES) return;
        if (!LORB.Multiplayer || !LORB.Multiplayer.Challenges) return;
        var incoming = [];
        if (LORB.Multiplayer.ChallengeService && LORB.Multiplayer.ChallengeService.getIncoming) {
            incoming = LORB.Multiplayer.ChallengeService.getIncoming() || [];
            // If service hasn't polled yet or data is stale, force a poll
            var lastPoll = LORB.Multiplayer.ChallengeService.getLastPollTs ? LORB.Multiplayer.ChallengeService.getLastPollTs() : 0;
            var now = Date.now ? Date.now() : (time() * 1000);
            if (!lastPoll || (now - lastPoll) > 10000) {
                LORB.Multiplayer.ChallengeService.pollNow();
                incoming = LORB.Multiplayer.ChallengeService.getIncoming() || [];
            }
        } else {
            incoming = LORB.Multiplayer.Challenges.listIncoming(ctx);
        }
        if (!incoming || incoming.length === 0) return;
        
        var challenge = incoming[0];
        var accept = false;
        if (LORB.Multiplayer.ChallengeLobbyUI && LORB.Multiplayer.ChallengeLobbyUI.showIncomingPrompt) {
            accept = LORB.Multiplayer.ChallengeLobbyUI.showIncomingPrompt(challenge);
        } else {
            LORB.View.init();
            LORB.View.clear();
            LORB.View.header("LIVE CHALLENGE");
            LORB.View.line("");
            LORB.View.line("From: " + (challenge.from && challenge.from.name ? challenge.from.name : "Unknown"));
            LORB.View.line("");
            accept = LORB.View.confirm("Accept (Y/N)? ");
        }
        
        if (accept) {
            var updated = LORB.Multiplayer.Challenges.markAccepted(challenge.id, ctx);
            if (!updated) return;
            if (LORB.Multiplayer.ChallengeLobbyUI && LORB.Multiplayer.ChallengeLobbyUI.showLobbyWaiting) {
                LORB.Multiplayer.ChallengeLobbyUI.showLobbyWaiting(updated, "Waiting for opponent to confirm...");
            }
            var result = LORB.Multiplayer.ChallengeLobby && LORB.Multiplayer.ChallengeLobby.waitForReady ?
                LORB.Multiplayer.ChallengeLobby.waitForReady(updated.id, ctx, { tickMs: 1200 }) :
                { status: "timeout" };
            if (LORB.Multiplayer.ChallengeLobbyUI && LORB.Multiplayer.ChallengeLobbyUI.showOutcome) {
                LORB.Multiplayer.ChallengeLobbyUI.showOutcome(result.status);
            } else {
                LORB.View.line("");
                if (result.status === "ready") {
                    LORB.View.line("\1gOpponent is ready. Launch your multiplayer game now.\1n");
                } else {
                    LORB.View.warn("Challenge " + result.status + ".");
                }
                LORB.View.line("Press any key...");
                console.getkey();
            }
            if (result.status !== "ready" && LORB.Multiplayer.Challenges && LORB.Multiplayer.Challenges.markCancelled) {
                LORB.Multiplayer.Challenges.markCancelled(updated.id);
            }
        } else {
            LORB.Multiplayer.Challenges.markDeclined(challenge.id);
        }
    }
    
    /**
     * Format milliseconds as a human-readable duration.
     */
    function formatDuration(ms) {
        var seconds = Math.floor(ms / 1000);
        var minutes = Math.floor(seconds / 60);
        var hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            var remainingMins = minutes % 60;
            return hours + "h " + remainingMins + "m";
        } else if (minutes > 0) {
            return minutes + "m";
        } else {
            return seconds + "s";
        }
    }
    
    /**
     * Initialize or refresh daily resources based on time elapsed.
     * This is the core day-tracking logic.
     */
    function initDailyResources(ctx) {
        var now = Date.now();
        var lastPlayed = ctx.lastPlayedTimestamp || now;
        var daysPassed = daysBetween(lastPlayed, now);
        
        // Get config values
        var maxBankedDays = getConfig("MAX_BANKED_DAYS", 1);
        var dailyStreetTurns = getConfig("DAILY_STREET_TURNS", 5);
        var dailyGymSessions = getConfig("DAILY_GYM_SESSIONS", 3);
        var dailyBarActions = getConfig("DAILY_BAR_ACTIONS", 3);
        var maxStreetTurns = getConfig("MAX_STREET_TURNS", 15);
        var maxGymSessions = getConfig("MAX_GYM_SESSIONS", 9);
        var maxBarActions = getConfig("MAX_BAR_ACTIONS", 9);
        
        // Initialize day counter if not present
        if (typeof ctx.day !== "number") ctx.day = 1;
        
        // Initialize resources if not present (first time setup)
        if (typeof ctx.streetTurns !== "number") ctx.streetTurns = dailyStreetTurns;
        if (typeof ctx.gymSessions !== "number") ctx.gymSessions = dailyGymSessions;
        if (typeof ctx.barActions !== "number") ctx.barActions = dailyBarActions;
        
        // If days have passed, grant resources
        if (daysPassed > 0) {
            // Cap banked days
            var effectiveDays = Math.min(daysPassed, maxBankedDays);
            
            // Increment day counter by actual days passed
            ctx.day += daysPassed;
            
            // Add resources for effective banked days
            ctx.streetTurns = Math.min(ctx.streetTurns + (effectiveDays * dailyStreetTurns), maxStreetTurns);
            ctx.gymSessions = Math.min(ctx.gymSessions + (effectiveDays * dailyGymSessions), maxGymSessions);
            ctx.barActions = Math.min(ctx.barActions + (effectiveDays * dailyBarActions), maxBarActions);
            
            // Clear daily flags
            ctx.restUsedToday = false;
            if (ctx.tempBuffs) ctx.tempBuffs = {};
            
            // Store info about banked days for display
            ctx._daysPassed = daysPassed;
            ctx._effectiveDays = effectiveDays;
        }
        
        // Update last played timestamp
        ctx.lastPlayedTimestamp = now;
    }
    
    /**
     * Legacy newDay function - now just adds one day's worth of resources.
     * Kept for compatibility but shouldn't be needed with time-based system.
     */
    function newDay(ctx) {
        var dailyStreetTurns = getConfig("DAILY_STREET_TURNS", 5);
        var dailyGymSessions = getConfig("DAILY_GYM_SESSIONS", 3);
        var maxStreetTurns = getConfig("MAX_STREET_TURNS", 15);
        var maxGymSessions = getConfig("MAX_GYM_SESSIONS", 9);
        
        ctx.day = (ctx.day || 0) + 1;
        ctx.streetTurns = Math.min((ctx.streetTurns || 0) + dailyStreetTurns, maxStreetTurns);
        ctx.gymSessions = Math.min((ctx.gymSessions || 0) + dailyGymSessions, maxGymSessions);
        ctx.restUsedToday = false;
        if (ctx.tempBuffs) ctx.tempBuffs = {};
        ctx.lastPlayedTimestamp = Date.now();
    }
    
    function run(ctx) {
        // Note: initDailyResources is called in lorb.js before entering hub
        // Do NOT call it again here to avoid double-processing
        if (RichView) {
            return runRichView(ctx);
        } else {
            return runLegacy(ctx);
        }
    }
    
    function runRichView(ctx) {
        // Get config for display
        var dailyStreetTurns = getConfig("DAILY_STREET_TURNS", 5);
        var dailyGymSessions = getConfig("DAILY_GYM_SESSIONS", 3);
        
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
            
            // Show day info with time until reset
            var timeLeft = timeUntilNextDay(Date.now());
            view.line("Day: " + ctx.day + "  \1n\1k(\1nResets in " + formatDuration(timeLeft) + "\1k)\1n");
            view.blank();
            view.line("Street Turns: " + ctx.streetTurns + "/" + dailyStreetTurns);
            view.line("Gym Sessions: " + ctx.gymSessions + "/" + dailyGymSessions);
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
        LORB.View.header("LEAVING RIM CITY");
        LORB.View.line("");
        LORB.View.line("The streetlights flicker on as you head home.");
        LORB.View.line("See you next time...");
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
        // NOTE: Day advancement is now purely timestamp-based in initDailyResources()
        // Do NOT call newDay() here - it would force day increment on every quit
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
        calculateGameDay: calculateGameDay,
        daysBetween: daysBetween,
        timeUntilNextDay: timeUntilNextDay,
        formatDuration: formatDuration
    };
    
})();
