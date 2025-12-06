/**
 * hub.js - Main Hub (City-based, shared world state)
 * 
 * The hub now displays the current NBA city based on shared gameDay.
 * All players see the same city on the same day.
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
    
    // Default art paths (used as fallback)
    var ART_HEADER_W = 80;
    var ART_HEADER_H = 4;
    var ART_SIDE_W = 40;
    var ART_SIDE_H = 20;
    
    /**
     * Get the current shared game day from SharedState.
     */
    function getSharedGameDay() {
        if (LORB.SharedState && LORB.SharedState.getGameDay) {
            return LORB.SharedState.getGameDay();
        }
        return 1;
    }
    
    /**
     * Get the current city based on shared game day.
     */
    function getCurrentCity() {
        if (LORB.Cities && LORB.Cities.getToday) {
            return LORB.Cities.getToday();
        }
        // Fallback
        return {
            id: "default",
            cityName: "Rim City",
            teamName: "Legends",
            nightclubName: "Club 23",
            buffs: {}
        };
    }
    
    /**
     * Get time remaining until next day reset (in ms).
     * Uses SharedState's calculation if available.
     */
    function timeUntilNextDay() {
        if (LORB.SharedState && LORB.SharedState.timeUntilNextDay) {
            return LORB.SharedState.timeUntilNextDay(Date.now());
        }
        // Fallback calculation
        var dayDuration = getConfig("DAY_DURATION_MS", 86400000);
        var dayProgress = Date.now() % dayDuration;
        return dayDuration - dayProgress;
    }
    
    /**
     * Calculate how many "days" have passed between two timestamps.
     * Used for resource banking.
     */
    function daysBetween(oldTimestampMs, newTimestampMs) {
        var dayDuration = getConfig("DAY_DURATION_MS", 86400000);
        var resetHour = getConfig("DAILY_RESET_HOUR_UTC", 0);
        
        if (dayDuration === 86400000) {
            var resetOffsetMs = resetHour * 3600000;
            var oldDay = Math.floor((oldTimestampMs - resetOffsetMs) / dayDuration);
            var newDay = Math.floor((newTimestampMs - resetOffsetMs) / dayDuration);
            return Math.max(0, newDay - oldDay);
        } else {
            var oldDay = Math.floor(oldTimestampMs / dayDuration);
            var newDay = Math.floor(newTimestampMs / dayDuration);
            return Math.max(0, newDay - oldDay);
        }
    }
    
    // Throttle for direct DB access fallback - don't hit more than once per 5 seconds
    var lastDirectPollTs = 0;
    var DIRECT_POLL_MIN_INTERVAL_MS = 5000;
    
    /**
     * Non-blocking check for incoming challenges; returns the first pending challenge
     * (or null) and keeps polling via the background service. No prompts here.
     */
    function getFirstIncomingChallenge(ctx) {
        if (!LORB.Config || !LORB.Config.ENABLE_LIVE_CHALLENGES) return null;
        if (!LORB.Multiplayer || !LORB.Multiplayer.Challenges) return null;
        
        var now = Date.now ? Date.now() : (time() * 1000);
        var incoming = [];
        
        if (LORB.Multiplayer.ChallengeService && LORB.Multiplayer.ChallengeService.cycle) {
            LORB.Multiplayer.ChallengeService.cycle();
        }
        
        if (LORB.Multiplayer.ChallengeService && LORB.Multiplayer.ChallengeService.getIncoming) {
            incoming = LORB.Multiplayer.ChallengeService.getIncoming() || [];
        } else {
            if (lastDirectPollTs && (now - lastDirectPollTs) < DIRECT_POLL_MIN_INTERVAL_MS) {
                return null;
            }
            lastDirectPollTs = now;
            incoming = LORB.Multiplayer.Challenges.listIncoming(ctx) || [];
        }
        
        if (!incoming || incoming.length === 0) return null;
        return incoming[0];
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
     * Process PvP match results: record stats, apply rewards, generate news entry.
     * 
     * @param {Object} ctx - Player context
     * @param {Object} gameResult - Result from launchLorbMatch
     * @param {Object} challenge - The challenge data (for opponent info)
     * @param {boolean} isChallenger - Whether this player was the challenger
     * @returns {Object} { pvpResult, rewards, newRecords }
     */
    function processPvpMatchResults(ctx, gameResult, challenge, isChallenger) {
        if (!LORB.Util.PvpStats) {
            // Fallback if pvp-stats.js not loaded
            return null;
        }
        
        var PvpStats = LORB.Util.PvpStats;
        var score = gameResult.score || { teamA: 0, teamB: 0 };
        var myTeam = isChallenger ? "teamA" : "teamB";
        var oppTeam = isChallenger ? "teamB" : "teamA";
        
        var myScore = score[myTeam] || 0;
        var oppScore = score[oppTeam] || 0;
        var isTie = (myScore === oppScore);
        var iWon = (myScore > oppScore);
        
        // Get opponent name from challenge data
        var oppData = isChallenger ? challenge.challenged : challenge.from;
        var opponentName = (oppData && oppData.name) || "Opponent";
        
        // Extract my player's game stats from box score
        var myGameStats = {};
        if (gameResult.playerStats) {
            // Find my player's stats (using lorbId if available)
            var myLorbId = ctx._globalId || ctx.name;
            for (var key in gameResult.playerStats) {
                var ps = gameResult.playerStats[key];
                // Check if this is my player (by lorbId or team position)
                if (ps.lorbData && ps.lorbData.lorbId === myLorbId) {
                    myGameStats = {
                        points: ps.points || 0,
                        rebounds: ps.rebounds || 0,
                        assists: ps.assists || 0,
                        steals: ps.steals || 0,
                        blocks: ps.blocks || 0,
                        turnovers: ps.turnovers || 0,
                        fgm: ps.fieldGoals ? ps.fieldGoals.made : 0,
                        fga: ps.fieldGoals ? ps.fieldGoals.attempted : 0,
                        tpm: ps.threePointers ? ps.threePointers.made : 0,
                        tpa: ps.threePointers ? ps.threePointers.attempted : 0,
                        dunks: ps.dunks || 0
                    };
                    break;
                }
            }
        }
        
        // Record the PvP game stats
        var matchInfo = {
            won: iWon,
            tie: isTie,
            opponentName: opponentName,
            myScore: myScore,
            oppScore: oppScore
        };
        
        var pvpResult = PvpStats.recordPvpGame(ctx, myGameStats, matchInfo);
        
        // Calculate rewards
        var rewards = PvpStats.calculatePvpRewards(iWon, isTie);
        
        // Apply rewards to context
        ctx.cash = Math.max(0, (ctx.cash || 0) + rewards.cashChange);
        ctx.rep = Math.max(0, (ctx.rep || 0) + rewards.repChange);
        
        // Update wins/losses counters on ctx (for compatibility)
        if (isTie) {
            // No change to wins/losses
        } else if (iWon) {
            ctx.wins = (ctx.wins || 0) + 1;
        } else {
            ctx.losses = (ctx.losses || 0) + 1;
        }
        ctx.gamesPlayed = (ctx.gamesPlayed || 0) + 1;
        
        // Find top scorer from the match for news headline
        var topScorer = null;
        var topScorerPoints = 0;
        var topScorerTeam = null;
        if (gameResult.playerStats) {
            for (var key in gameResult.playerStats) {
                var ps = gameResult.playerStats[key];
                if ((ps.points || 0) > topScorerPoints) {
                    topScorerPoints = ps.points;
                    topScorer = ps.name;
                    topScorerTeam = ps.team;
                }
            }
        }
        
        // Create and publish news entry
        var gameDay = getSharedGameDay();
        var city = getCurrentCity();
        var winnerName = iWon ? ctx.name : opponentName;
        var loserName = iWon ? opponentName : ctx.name;
        var winnerScore = iWon ? myScore : oppScore;
        var loserScore = iWon ? oppScore : myScore;
        
        var newsEntry = PvpStats.createNewsEntry({
            winnerName: winnerName,
            loserName: loserName,
            winnerScore: winnerScore,
            loserScore: loserScore,
            isTie: isTie,
            topScorer: topScorer,
            topScorerPoints: topScorerPoints,
            topScorerTeam: topScorerTeam,
            timestamp: Date.now(),
            gameDay: gameDay,
            city: city ? city.id : null,
            newRecords: pvpResult.newRecords
        });
        
        // Add to global news feed
        PvpStats.addNews(newsEntry);
        
        return {
            pvpResult: pvpResult,
            rewards: rewards,
            newRecords: pvpResult.newRecords,
            topScorer: topScorer,
            topScorerPoints: topScorerPoints
        };
    }

    /**
     * Initialize or refresh daily resources based on time elapsed.
     * This is the core day-tracking logic for PLAYER resources.
     * Note: The shared gameDay (city rotation) is separate from player resources.
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
        
        // Track the last gameDay the player was on (for detecting day changes)
        var currentGameDay = getSharedGameDay();
        var lastGameDay = ctx._lastGameDay || currentGameDay;
        var gameDayChanged = (lastGameDay !== currentGameDay);
        
        // Initialize resources if not present (first time setup)
        if (typeof ctx.streetTurns !== "number") ctx.streetTurns = dailyStreetTurns;
        if (typeof ctx.gymSessions !== "number") ctx.gymSessions = dailyGymSessions;
        if (typeof ctx.barActions !== "number") ctx.barActions = dailyBarActions;
        
        // If days have passed (time-based) OR game day changed, grant resources
        if (daysPassed > 0 || gameDayChanged) {
            // Cap banked days
            var effectiveDays = Math.min(Math.max(daysPassed, 1), maxBankedDays);
            
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
        
        // Track the game day for next check
        ctx._lastGameDay = currentGameDay;
        
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
        
        var lastIncomingId = null;
        
        while (true) {
            var incomingChallenge = getFirstIncomingChallenge(ctx);
            
            // If a new incoming challenge appeared, prompt immediately
            if (incomingChallenge && incomingChallenge.id !== lastIncomingId) {
                lastIncomingId = incomingChallenge.id;
                handleIncomingChallenge(incomingChallenge, ctx);
                // After handling, recompute incoming for menu display
                incomingChallenge = getFirstIncomingChallenge(ctx);
            } else if (!incomingChallenge) {
                lastIncomingId = null;
            }
            
            // Get current city and game day
            var gameDay = getSharedGameDay();
            var city = getCurrentCity();
            var cityColor = LORB.Cities ? LORB.Cities.getTeamColorCode(city) : "\1h\1c";
            var clubName = LORB.Cities ? LORB.Cities.getClubName(city) : "Club 23";
            var buffDesc = LORB.Cities ? LORB.Cities.getBuffDescription(city) : "";
            
            // Get city-specific theme for lightbars
            var cityTheme = (LORB.Cities && LORB.Cities.getCityTheme) 
                ? LORB.Cities.getCityTheme(city) 
                : "lorb";
            
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 4 },
                    { name: "art", x: 1, y: 5, width: 40, height: 20 },
                    { name: "content", x: 43, y: 5, width: 38, height: 20 }  // 2-char margin from art
                ],
                theme: cityTheme
            });
            
            // Load city-specific art files
            loadCityArt(view, city);
            
            // Draw status in content zone using RichView helpers
            view.setContentZone("content");
            view.setCursorY(0);
            
            view.blank();
            
            // City header with team name
            view.line(cityColor + city.cityName.toUpperCase() + "\1n \1w- " + city.teamName + "\1n");
            
            // Show day info with time until reset
            var timeLeft = timeUntilNextDay();
            var seasonLength = (LORB.Config && LORB.Config.SEASON_LENGTH_DAYS) || 30;
            view.line("\1wDay " + gameDay + "/" + seasonLength + "  \1h\1k(Resets: " + formatDuration(timeLeft) + ")\1n");
            
            // Show city buffs if any
            if (buffDesc) {
                view.line("\1n\1gCity Buff: " + buffDesc + "\1n");
            }
            
            view.blank();
            view.line("Street Turns: \1h" + ctx.streetTurns + "\1n/" + dailyStreetTurns);
            view.line("Gym Sessions: \1h" + ctx.gymSessions + "\1n/" + dailyGymSessions);
            view.blank();
            view.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
            view.line("Rep: \1c" + (ctx.rep || 0) + "\1n");
            view.blank();
            // Styled prompt: dark brackets, bright keys, dim labels
            view.line("\1h\1k[\1h\1wArrows\1h\1k]\1n Select \1h\1k[\1h\1wENTER\1h\1k]\1n Confirm");
            
            var menuItems = [
                { text: "Hit the Courts", value: "courts", hotkey: "1", disabled: ctx.streetTurns <= 0 },
                { text: clubName, value: "club", hotkey: "2" },
                { text: "The Gym", value: "gym", hotkey: "3", disabled: ctx.gymSessions <= 0 },
                { text: "Gear Shop", value: "shop", hotkey: "4" },
                { text: "Your Crib", value: "crib", hotkey: "5" },
                { text: "Tournaments", value: "tournaments", hotkey: "6" },
                { text: "Call it a Night", value: "quit", hotkey: "Q" }
            ];
            
            // Inject incoming challenge option at the top if present
            if (incomingChallenge) {
                var fromName = (incomingChallenge.from && incomingChallenge.from.name) || (incomingChallenge.from && incomingChallenge.from.globalId) || "Unknown";
                menuItems.unshift({
                    text: "\1h\1yIncoming Challenge from " + fromName + "\1n",
                    value: "incoming_challenge",
                    hotkey: "I"
                });
            }
            
            var choice = view.menu(menuItems, { y: 13 });
            view.close();
            
            var result = handleChoice(choice, ctx, incomingChallenge);
            if (result === "quit" || result === "reset") return result;
        }
    }
    
    /**
     * Load city-specific art into the view.
     * Falls back to default art if city-specific doesn't exist.
     */
    function loadCityArt(view, city) {
        if (typeof BinLoader === "undefined") {
            return;
        }
        
        // Get paths from Cities module
        var bannerPath = LORB.Cities ? LORB.Cities.getBannerPath(city) : null;
        var detailPath = LORB.Cities ? LORB.Cities.getDetailPath(city) : null;
        
        // Fallback to legacy hub art if city art not available
        var defaultBanner = "/sbbs/xtrn/nba_jam/assets/lorb/hub_header.bin";
        var defaultDetail = "/sbbs/xtrn/nba_jam/assets/lorb/hub_art.bin";
        
        // Load header banner
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            var headerPath = (bannerPath && file_exists(bannerPath)) ? bannerPath : defaultBanner;
            if (file_exists(headerPath)) {
                BinLoader.loadIntoFrame(headerFrame, headerPath, ART_HEADER_W, ART_HEADER_H, 1, 1);
            }
        }
        
        // Load side art
        var artFrame = view.getZone("art");
        if (artFrame) {
            var artPath = (detailPath && file_exists(detailPath)) ? detailPath : defaultDetail;
            if (file_exists(artPath)) {
                BinLoader.loadIntoFrame(artFrame, artPath, ART_SIDE_W, ART_SIDE_H, 1, 1);
            }
        }
        
        view.render();
    }
    
    function handleChoice(choice, ctx, incomingChallenge) {
        switch (choice) {
            case "incoming_challenge":
                return handleIncomingChallenge(incomingChallenge, ctx);
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
                    showUnavailable("Club");
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

    function handleIncomingChallenge(challenge, ctx) {
        if (!challenge) {
            LORB.View.init();
            LORB.View.clear();
            LORB.View.warn("No incoming challenge available.");
            LORB.View.line("Press any key...");
            console.getkey();
            return null;
        }
        var fromName = (challenge.from && (challenge.from.name || challenge.from.globalId)) || "opponent";
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("INCOMING CHALLENGE");
        LORB.View.line("");
        LORB.View.line("From: " + fromName);
        LORB.View.line("");
        var accept = LORB.View.confirm("Accept (Y/N)? ");
        if (accept) {
            var updated = LORB.Multiplayer.Challenges.acceptChallenge(challenge.id, ctx);
            if (updated) {
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
                        LORB.View.line("\1gOpponent is ready. Launching match...\1n");
                    } else {
                        LORB.View.warn("Challenge " + result.status + ".");
                    }
                    if (result.status !== "ready") {
                        LORB.View.line("Press any key...");
                        console.getkey();
                    }
                }
                
                // If both players are ready, launch the multiplayer match
                if (result.status === "ready") {
                    if (LORB.Multiplayer.Launcher && LORB.Multiplayer.Launcher.launchLorbMatch) {
                        LORB.View.line("\1c*** Launching LORB Multiplayer Match ***\1n");
                        mswait(1000);
                        
                        // Challengee is NOT the challenger, so pass false
                        var gameResult = LORB.Multiplayer.Launcher.launchLorbMatch(updated, ctx, false);
                        
                        if (gameResult && gameResult.completed) {
                            // Process PvP match results (stats, rewards, news)
                            var pvpProcessed = processPvpMatchResults(ctx, gameResult, updated, false);
                            
                            // Display results
                            LORB.View.clear();
                            LORB.View.header("MATCH COMPLETE");
                            LORB.View.line("");
                            LORB.View.line("Final Score: " + (gameResult.score ? (gameResult.score.teamA + " - " + gameResult.score.teamB) : "Unknown"));
                            LORB.View.line("");
                            
                            if (gameResult.iWon) {
                                LORB.View.line("\1g*** VICTORY! ***\1n");
                            } else if (gameResult.winner === "tie") {
                                LORB.View.line("\1yTie game!\1n");
                            } else {
                                LORB.View.line("\1rDefeat\1n");
                            }
                            
                            // Show rewards from PvP processing
                            if (pvpProcessed && pvpProcessed.rewards) {
                                LORB.View.line("");
                                var cashChange = pvpProcessed.rewards.cashChange;
                                var repChange = pvpProcessed.rewards.repChange;
                                if (cashChange !== 0) {
                                    var cashColor = cashChange > 0 ? "\1g" : "\1r";
                                    LORB.View.line(cashColor + "Cash: " + (cashChange > 0 ? "+" : "") + cashChange + "\1n");
                                }
                                if (repChange !== 0) {
                                    var repColor = repChange > 0 ? "\1c" : "\1r";
                                    LORB.View.line(repColor + "Rep: " + (repChange > 0 ? "+" : "") + repChange + "\1n");
                                }
                            }
                            
                            // Show any new records broken
                            if (pvpProcessed && pvpProcessed.newRecords && pvpProcessed.newRecords.length > 0) {
                                LORB.View.line("");
                                LORB.View.line("\1y\1h*** NEW PVP RECORDS! ***\1n");
                                for (var ri = 0; ri < pvpProcessed.newRecords.length; ri++) {
                                    var rec = pvpProcessed.newRecords[ri];
                                    LORB.View.line("\1g" + rec.name + ": " + rec.value + "\1n");
                                }
                            }
                            
                            // Show updated PvP record
                            if (pvpProcessed && pvpProcessed.pvpResult) {
                                LORB.View.line("");
                                LORB.View.line("PvP Record: \1w" + pvpProcessed.pvpResult.wins + "W-" + 
                                              pvpProcessed.pvpResult.losses + "L" + 
                                              (pvpProcessed.pvpResult.ties > 0 ? "-" + pvpProcessed.pvpResult.ties + "T" : "") + "\1n");
                                if (pvpProcessed.pvpResult.currentStreak > 1) {
                                    LORB.View.line("\1g" + pvpProcessed.pvpResult.currentStreak + " game win streak!\1n");
                                }
                            }
                            
                            LORB.View.line("");
                            LORB.View.line("Press any key...");
                            console.getkey();
                            
                            // Save updated context
                            if (LORB.Persist && LORB.Persist.saveContext) {
                                LORB.Persist.saveContext(ctx);
                            }
                        } else if (gameResult && gameResult.error) {
                            LORB.View.warn("Match error: " + gameResult.error);
                            LORB.View.line("Press any key...");
                            console.getkey();
                        }
                    } else {
                        // Fallback if launcher not available
                        LORB.View.line("\1yMultiplayer launcher not available.\1n");
                        LORB.View.line("Press any key...");
                        console.getkey();
                    }
                }
                
                if (result.status !== "ready" && LORB.Multiplayer.Challenges && LORB.Multiplayer.Challenges.cancelChallenge) {
                    LORB.Multiplayer.Challenges.cancelChallenge(updated.id, ctx);
                }
            } else {
                LORB.View.warn("Challenge unavailable.");
                console.getkey();
            }
        } else {
            LORB.Multiplayer.Challenges.declineChallenge(challenge.id, ctx);
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
        var city = getCurrentCity();
        var cityName = city ? city.cityName : "the city";
        
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("LEAVING " + cityName.toUpperCase());
        LORB.View.line("");
        LORB.View.line("The streetlights flicker on as you head to your hotel.");
        LORB.View.line("See you next time...");
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
        return "quit";
    }
    
    function runLegacy(ctx) {
        while (true) {
            var incomingChallenge = getFirstIncomingChallenge(ctx);
            
            var gameDay = getSharedGameDay();
            var city = getCurrentCity();
            var clubName = LORB.Cities ? LORB.Cities.getClubName(city) : "Club 23";
            var seasonLength = (LORB.Config && LORB.Config.SEASON_LENGTH_DAYS) || 30;
            
            LORB.View.clear();
            LORB.View.line("\1h\1c " + city.cityName.toUpperCase() + " - DAY " + gameDay + "/" + seasonLength + " \1n");
            LORB.View.line("");
            LORB.View.line("Street Turns: " + ctx.streetTurns + "  Gym: " + ctx.gymSessions);
            LORB.View.line("Cash: $" + (ctx.cash || 0) + "  Rep: " + (ctx.rep || 0));
            LORB.View.line("");
            if (incomingChallenge) {
                var fromName = (incomingChallenge.from && (incomingChallenge.from.name || incomingChallenge.from.globalId)) || "opponent";
                LORB.View.line("\1h\1y[I]\1n Incoming Challenge from " + fromName);
            }
            LORB.View.line("[1] Courts  [2] " + clubName + "  [3] Gym  [4] Shop  [5] Crib  [6] Tourney  [Q] Quit");
            LORB.View.line("");
            var choice = LORB.View.prompt("Choice: ");
            var map = { "1": "courts", "2": "club", "3": "gym", "4": "shop", "5": "crib", "6": "tournaments", "I": "incoming_challenge", "Q": "quit", "RESET": "reset" };
            var result = handleChoice(map[choice.toUpperCase()] || null, ctx, incomingChallenge);
            if (result === "quit" || result === "reset") return result;
        }
    }
    
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Hub = {
        run: run,
        newDay: newDay,
        initDailyResources: initDailyResources,
        getSharedGameDay: getSharedGameDay,
        getCurrentCity: getCurrentCity,
        daysBetween: daysBetween,
        timeUntilNextDay: timeUntilNextDay,
        formatDuration: formatDuration,
        processPvpMatchResults: processPvpMatchResults
    };
    
})();
