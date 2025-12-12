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
    
    /**
     * Non-blocking check for incoming challenges; returns the first pending challenge
     * (or null). Uses cached data from ChallengeService.
     */
    function getFirstIncomingChallenge(ctx) {
        if (!LORB.Config || !LORB.Config.ENABLE_LIVE_CHALLENGES) return null;
        if (!LORB.Multiplayer || !LORB.Multiplayer.ChallengeService) return null;
        
        // Process any pending subscription updates (non-blocking with pub/sub)
        if (LORB.Multiplayer.ChallengeService.cycle) {
            LORB.Multiplayer.ChallengeService.cycle();
        }
        
        // Get cached incoming challenges (no network call)
        var incoming = LORB.Multiplayer.ChallengeService.getIncoming() || [];
        
        if (!incoming || incoming.length === 0) return null;
        return incoming[0];
    }
    
    /**
     * Get count of other online players (excluding self).
     * Uses cached presence data - populated when hub is entered.
     * @param {Object} ctx - Player context
     * @returns {number} Count of other online players
     */
    function getOtherOnlinePlayerCount(ctx) {
        if (!LORB.Config || !LORB.Config.ENABLE_LIVE_CHALLENGES) return 0;
        if (!LORB.Multiplayer || !LORB.Multiplayer.ChallengeService) return 0;
        if (!LORB.Multiplayer.ChallengeService.getOnlinePlayers) return 0;
        
        var myGlobalId = null;
        if (ctx && ctx._user && LORB.Persist && LORB.Persist.getGlobalPlayerId) {
            myGlobalId = LORB.Persist.getGlobalPlayerId(ctx._user);
        }
        
        var onlinePlayers = LORB.Multiplayer.ChallengeService.getOnlinePlayers(ctx) || {};
        var count = 0;
        
        for (var id in onlinePlayers) {
            if (!onlinePlayers.hasOwnProperty(id)) continue;
            // Don't count self
            if (id === myGlobalId) continue;
            count++;
        }
        
        return count;
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
        
        // Calculate base rewards
        var rewards = PvpStats.calculatePvpRewards(iWon, isTie);
        
        // Apply wager settlement if challenge has a wager
        // Winner gets the full wager amount, loser pays it
        // Ties: no wager exchange (both keep their stakes)
        if (challenge && challenge.wager && (challenge.wager.cash > 0 || challenge.wager.rep > 0)) {
            var wagerCash = challenge.wager.cash || 0;
            var wagerRep = challenge.wager.rep || 0;
            
            if (isTie) {
                // Tie: no wager exchange, but log it
                rewards.wagerCashChange = 0;
                rewards.wagerRepChange = 0;
                rewards.wagerTied = true;
            } else if (iWon) {
                // Winner receives the wagered amounts
                rewards.cashChange += wagerCash;
                rewards.repChange += wagerRep;
                rewards.wagerCashChange = wagerCash;
                rewards.wagerRepChange = wagerRep;
                rewards.wagerWon = true;
            } else {
                // Loser pays the wagered amounts
                rewards.cashChange -= wagerCash;
                rewards.repChange -= wagerRep;
                rewards.wagerCashChange = -wagerCash;
                rewards.wagerRepChange = -wagerRep;
                rewards.wagerLost = true;
            }
        }
        
        // Apply rewards to context (including wager results)
        ctx.cash = Math.max(0, (ctx.cash || 0) + rewards.cashChange);
        ctx.rep = Math.max(0, (ctx.rep || 0) + rewards.repChange);
        
        // Update wins/losses counters on ctx (for compatibility)
        if (isTie) {
            // No change to wins/losses
        } else if (iWon) {
            ctx.wins = (ctx.wins || 0) + 1;
            // Track season wins
            if (LORB.Util && LORB.Util.CareerStats && LORB.Util.CareerStats.recordWinLoss) {
                LORB.Util.CareerStats.recordWinLoss(ctx, true);
            }
        } else {
            ctx.losses = (ctx.losses || 0) + 1;
            // Track season losses
            if (LORB.Util && LORB.Util.CareerStats && LORB.Util.CareerStats.recordWinLoss) {
                LORB.Util.CareerStats.recordWinLoss(ctx, false);
            }
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
                    { name: "content", x: 43, y: 5, width: 38, height: 16 },
                    { name: "tooltip", x: 43, y: 21, width: 38, height: 4 }  // 4-row tooltip below content
                ],
                theme: cityTheme
            });
            
            // Load city-specific art files
            loadCityArt(view, city);
            
            // Draw status in content zone using RichView helpers
            view.setContentZone("content");
            view.setCursorY(0);
            
            // Get team colors for various UI elements
            var teamColors = (LORB.Cities && LORB.Cities.getTeamColors) 
                ? LORB.Cities.getTeamColors(city) 
                : { fg: "\1h\1y", fgFromBg: "\1b", fgFromBgAlt: "\1y" };
            var teamNameColor = "\1h" + (teamColors.fgFromBg || "\1b");  // Bright version for team name
            var labelColor = "\1h" + (teamColors.fgFromBg || "\1b");     // Bright for TURNS/FUNDS labels
            var dimColor = teamColors.fgFromBg || "\1b";                 // Normal intensity for subtle elements
            
            // City header with team name in team color
            view.line(cityColor + city.cityName.toUpperCase() + "\1n \1w- " + teamNameColor + city.teamName + "\1n");
            
            // Show season/day info with time until reset
            var timeLeft = timeUntilNextDay();
            var seasonLength = (LORB.Config && LORB.Config.SEASON_LENGTH_DAYS) || 30;
            var sharedInfo = LORB.SharedState ? LORB.SharedState.getInfo() : { seasonNumber: 1 };
            var seasonNum = sharedInfo.seasonNumber || 1;
            view.line("\1wSeason " + seasonNum + " Day " + gameDay + "/" + seasonLength + "  \1n" + dimColor + "(next " + formatDuration(timeLeft) + ")\1n");
            
            // Show city buffs if any
            if (buffDesc) {
                view.line("\1n\1gCity Buff: " + buffDesc + "\1n");
            }
            
            view.blank();
            // Turns line: Games with optional MAX, Gym sessions
            var gamesMaxed = (ctx.streetTurns >= dailyStreetTurns);
            var gamesLabel = labelColor + "TURNS \1n\1wGames:\1h\1c" + ctx.streetTurns;
            if (gamesMaxed) {
                gamesLabel += "\1w(\1h\1yMAX\1w)";
            }
            gamesLabel += " \1h\1w- \1n\1wGym:\1h\1c" + ctx.gymSessions + "\1n";
            view.line(gamesLabel);
            // Cash and Rep on one line
            view.line("\1n" + labelColor + "FUNDS \1n\1wCash:\1h\1y$" + (ctx.cash || 0) + " \1h\1w- \1n\1wRep:\1h\1c" + (ctx.rep || 0) + "\1n");
            
            // Show playoff status if relevant
            if (LORB.UI && LORB.UI.PlayoffView && LORB.UI.PlayoffView.getHubStatusLine) {
                var playoffLine = LORB.UI.PlayoffView.getHubStatusLine(ctx);
                if (playoffLine) {
                    view.blank();
                    view.line(playoffLine);
                }
            }
            
            // Tooltip descriptions for menu items
            var tooltips = {
                courts: "Play pickup games. Gain $, rep and new contacts.",
                club: "Recharge. Mingle. Gamble. Use the bathroom.",
                gym: "Train to improve your skills. Uses 1 gym session.",
                shop: "Buy gear and equipment to boost your stats.",
                crib: "Manage your crew, check your stats.",
                tournaments: "Leaderboards, live challenges, and playoff brackets.",
                quit: "Save progress and leave for now.",
                incoming_challenge: "Another player wants to ball! Accept or decline.",
                playoffs: "You have a playoff match waiting. Don't miss it!"
            };
            
            // Build Tournaments label with live player count
            var otherPlayersOnline = getOtherOnlinePlayerCount(ctx);
            var lastOnlineCount = otherPlayersOnline;  // Track for live updates
            var tournamentsLabel = "Tournaments";
            if (otherPlayersOnline > 0) {
                var playerWord = otherPlayersOnline === 1 ? "PLAYER" : "PLAYERS";
                tournamentsLabel = teamColors.fg + "Tournaments: \1h\1g(" + otherPlayersOnline + " LIVE " + playerWord + ")\1n";
            }
            
            var menuItems = [
                { text: "Hit the Courts", value: "courts", hotkey: "1", disabled: ctx.streetTurns <= 0, tooltip: tooltips.courts },
                { text: clubName, value: "club", hotkey: "2", tooltip: tooltips.club },
                { text: "The Gym", value: "gym", hotkey: "3", disabled: ctx.gymSessions <= 0, tooltip: tooltips.gym },
                { text: "Gear Shop", value: "shop", hotkey: "4", tooltip: tooltips.shop },
                { text: "Your Crib", value: "crib", hotkey: "5", tooltip: tooltips.crib },
                { text: tournamentsLabel, value: "tournaments", hotkey: "6", tooltip: tooltips.tournaments },
                { text: "Call it a Night", value: "quit", hotkey: "Q", tooltip: tooltips.quit }
            ];
            
            // Track tournaments item index (may shift if items are unshifted)
            var tournamentsItemIndex = 5;
            
            // Inject incoming challenge option at the top if present
            if (incomingChallenge) {
                var fromName = (incomingChallenge.from && incomingChallenge.from.name) || (incomingChallenge.from && incomingChallenge.from.globalId) || "Unknown";
                var challengeLabel = incomingChallenge.mode === "playoff" 
                    ? "\1h\1c⚔ PLAYOFF CHALLENGE from " + fromName + "!\1n"
                    : "\1h\1yIncoming Challenge from " + fromName + "\1n";
                menuItems.unshift({
                    text: challengeLabel,
                    value: "incoming_challenge",
                    hotkey: "I",
                    tooltip: tooltips.incoming_challenge
                });
                tournamentsItemIndex++;
            }
            
            // Inject playoff match option if player has pending playoff match
            if (LORB.UI && LORB.UI.PlayoffView && LORB.UI.PlayoffView.hasPlayoffAction && LORB.UI.PlayoffView.hasPlayoffAction(ctx)) {
                menuItems.unshift({
                    text: "\1h\1cPlayoff Match Ready!\1n",
                    value: "playoffs",
                    hotkey: "P",
                    tooltip: tooltips.playoffs
                });
                tournamentsItemIndex++;
            }
            
            // Helper to build tournaments label
            function buildTournamentsLabel(count) {
                if (count > 0) {
                    var word = count === 1 ? "PLAYER" : "PLAYERS";
                    return teamColors.fg + "Tournaments: \1h\1g(" + count + " LIVE " + word + ")\1n";
                }
                return "Tournaments";
            }
            
            // Create onIdle callback to cycle challenge service and update live player count
            var onIdleCallback = null;
            if (LORB.Multiplayer && LORB.Multiplayer.ChallengeService && LORB.Multiplayer.ChallengeService.cycle) {
                onIdleCallback = function(richView, lb) {
                    LORB.Multiplayer.ChallengeService.cycle();
                    
                    // Check if player count changed
                    var currentCount = getOtherOnlinePlayerCount(ctx);
                    if (currentCount !== lastOnlineCount) {
                        lastOnlineCount = currentCount;
                        var newLabel = buildTournamentsLabel(currentCount);
                        lb.updateItemText(tournamentsItemIndex, newLabel);
                    }
                };
            }
            
            // Tooltip colors - border uses fgFromBgAlt, text uses fgFromBg (both bright)
            // teamColors already defined above
            var tooltipBorderColor = "\1h" + (teamColors.fgFromBgAlt || teamColors.fg);
            var tooltipTextColor = "\1h" + (teamColors.fgFromBg || teamColors.fg);
            
            // Helper to draw tooltip with border in city theme colors
            function drawTooltip(text) {
                var tooltipFrame = view.getZone("tooltip");
                if (!tooltipFrame) return;
                
                tooltipFrame.clear();
                
                var innerWidth = 36;  // 38 - 2 for border chars
                
                // Word wrap text into 2 lines max
                var lines = wrapText(text || "", innerWidth);
                var line1 = lines[0] || "";
                var line2 = lines[1] || "";
                
                // Center each line
                var pad1Left = Math.floor((innerWidth - line1.length) / 2);
                var pad1Right = innerWidth - line1.length - pad1Left;
                var pad2Left = Math.floor((innerWidth - line2.length) / 2);
                var pad2Right = innerWidth - line2.length - pad2Left;
                
                // Draw top border
                tooltipFrame.gotoxy(1, 1);
                tooltipFrame.putmsg(tooltipBorderColor + "\xDA" + repeat("\xC4", innerWidth) + "\xBF\1n");
                
                // Draw line 1
                tooltipFrame.gotoxy(1, 2);
                tooltipFrame.putmsg(tooltipBorderColor + "\xB3" + tooltipTextColor + repeat(" ", pad1Left) + line1 + repeat(" ", pad1Right) + tooltipBorderColor + "\xB3\1n");
                
                // Draw line 2
                tooltipFrame.gotoxy(1, 3);
                tooltipFrame.putmsg(tooltipBorderColor + "\xB3" + tooltipTextColor + repeat(" ", pad2Left) + line2 + repeat(" ", pad2Right) + tooltipBorderColor + "\xB3\1n");
                
                // Draw bottom border
                tooltipFrame.gotoxy(1, 4);
                tooltipFrame.putmsg(tooltipBorderColor + "\xC0" + repeat("\xC4", innerWidth) + "\xD9\1n");
                
                view.render();
            }
            
            // Helper for repeating characters
            function repeat(ch, count) {
                var s = "";
                for (var i = 0; i < count; i++) s += ch;
                return s;
            }
            
            // Word wrap helper - splits text into lines that fit within maxWidth
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
                        // If line2 also full, stop (we only have 2 lines)
                    }
                }
                
                return [line1, line2];
            }
            
            // onSelect callback to update tooltip when selection changes
            var onSelectCallback = function(item, index, richView, lb) {
                drawTooltip(item.tooltip || "");
            };
            
            // Draw initial tooltip for first item
            drawTooltip(menuItems[0].tooltip || "");
            
            var choice = view.menu(menuItems, { y: 9, onIdle: onIdleCallback, onSelect: onSelectCallback });
            view.close();
            
            var result = handleChoice(choice, ctx, incomingChallenge);
            if (result === "quit" || result === "reset") return result;
        }
    }
    
    /**
     * Load city-specific art into the view.
     * Header uses dynamic figlet city name; side art falls back to default if needed.
     */
    function loadCityArt(view, city) {
        // Load header banner with dynamic figlet city name
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            var cityName = (city && city.cityName) ? city.cityName : "Rim City";
            
            // Get team color attribute for this city
            var fgAttr = (typeof WHITE === "number") ? WHITE : 7;
            try {
                if (LORB.Cities && LORB.Cities.getTeamColors) {
                    var colors = LORB.Cities.getTeamColors(city);
                    if (colors && typeof colors.fgAttr === "number") {
                        fgAttr = colors.fgAttr;
                    }
                }
            } catch (e) {
                // Use default color
            }
            
            // Try figlet rendering, falls back to plain text automatically
            if (LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
                LORB.Util.FigletBanner.renderToFrame(headerFrame, cityName, fgAttr);
            } else {
                // Fallback: plain centered text
                headerFrame.clear();
                var padding = Math.floor((ART_HEADER_W - cityName.length) / 2);
                headerFrame.gotoxy(padding + 1, 2);
                headerFrame.attr = fgAttr;
                headerFrame.putmsg(cityName);
            }
        }
        
        // Load side art
        if (typeof BinLoader !== "undefined") {
            var detailPath = LORB.Cities ? LORB.Cities.getDetailPath(city) : null;
            var defaultDetail = "/sbbs/xtrn/nba_jam/assets/lorb/hub_art.bin";
            
            var artFrame = view.getZone("art");
            if (artFrame) {
                var artPath = (detailPath && file_exists(detailPath)) ? detailPath : defaultDetail;
                if (file_exists(artPath)) {
                    BinLoader.loadIntoFrame(artFrame, artPath, ART_SIDE_W, ART_SIDE_H, 1, 1);
                }
            }
        }
        
        view.render();
    }
    
    function handleChoice(choice, ctx, incomingChallenge) {
        switch (choice) {
            case "incoming_challenge":
                return handleIncomingChallenge(incomingChallenge, ctx);
            case "playoffs":
                if (LORB.UI && LORB.UI.PlayoffView) {
                    LORB.UI.PlayoffView.run(ctx);
                } else {
                    showUnavailable("Playoffs");
                }
                break;
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
        
        // Use new integrated negotiation UI if available
        if (LORB.Multiplayer.ChallengeNegotiation && LORB.Multiplayer.ChallengeNegotiation.showIncomingChallenge) {
            // showIncomingChallenge handles the entire flow and returns when ready or cancelled/declined
            var negResult = LORB.Multiplayer.ChallengeNegotiation.showIncomingChallenge(challenge, ctx);
            
            if (!negResult || negResult.status === "declined" || negResult.status === "cancelled" || negResult.status === "timeout") {
                // Already handled by negotiation UI
                return null;
            }
            
            // Got ready status - launch the match
            if (negResult.status === "ready") {
                // Use the updated challenge from result
                var updated = negResult.challenge || challenge;
                
                // Launch the match
                if (LORB.Multiplayer.Launcher && LORB.Multiplayer.Launcher.launchLorbMatch) {
                    LORB.View.init();
                    LORB.View.clear();
                    LORB.View.line("\1c*** Launching LORB Multiplayer Match ***\1n");
                    mswait(1000);
                    
                    // Challengee is NOT the challenger, so pass false
                    var gameResult = LORB.Multiplayer.Launcher.launchLorbMatch(updated, ctx, false);
                    
                    if (gameResult && gameResult.completed) {
                        // Process PvP match results (stats, rewards, news)
                        var pvpProcessed = processPvpMatchResults(ctx, gameResult, updated, false);
                        
                        // If this was a playoff match, record the result
                        if (updated.mode === "playoff" && updated.playoffMatchId && LORB.Playoffs) {
                            var myId = ctx._globalId || ctx.name;
                            var oppId = (updated.from && updated.from.globalId) || null;
                            var winnerId = gameResult.iWon ? myId : oppId;
                            var loserId = gameResult.iWon ? oppId : myId;
                            
                            LORB.Playoffs.finalizeMatch(updated.seasonNumber, updated.playoffMatchId, {
                                winnerId: winnerId,
                                loserId: loserId,
                                winnerScore: gameResult.iWon ? gameResult.score.teamA : gameResult.score.teamB,
                                loserScore: gameResult.iWon ? gameResult.score.teamB : gameResult.score.teamA,
                                resolution: LORB.Playoffs.RESOLUTION.PVP
                            });
                        }
                        
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
                        
                        // Show wager results if wager was present
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
                    LORB.View.line("\1yMultiplayer launcher not available.\1n");
                    LORB.View.line("Press any key...");
                    console.getkey();
                }
            }
            return null;
        }
        
        // Legacy fallback: Simple text-based accept/decline
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
        LORB.View.header("CALLING IT A NIGHT");
        LORB.View.line("");
        
        // Show session accomplishments from dayStats
        var stats = ctx.dayStats || {};
        var gamesPlayed = stats.gamesPlayed || 0;
        var wins = stats.wins || 0;
        var losses = stats.losses || 0;
        var cashEarned = stats.cashEarned || 0;
        var repGained = stats.repGained || 0;
        
        if (gamesPlayed > 0 || cashEarned !== 0 || repGained !== 0) {
            LORB.View.line("\1h\1wToday's Summary:\1n");
            LORB.View.line("");
            
            if (gamesPlayed > 0) {
                LORB.View.line("Games: \1h" + gamesPlayed + "\1n  (\1g" + wins + "W\1n / \1r" + losses + "L\1n)");
            }
            if (cashEarned !== 0) {
                var cashColor = cashEarned >= 0 ? "\1g" : "\1r";
                LORB.View.line("Cash: " + cashColor + (cashEarned >= 0 ? "+" : "") + "$" + cashEarned + "\1n");
            }
            if (repGained !== 0) {
                var repColor = repGained >= 0 ? "\1c" : "\1r";
                LORB.View.line("Rep: " + repColor + (repGained >= 0 ? "+" : "") + repGained + "\1n");
            }
            LORB.View.line("");
        }
        
        // Show remaining resources
        var turnsLeft = ctx.streetTurns || 0;
        var gymLeft = ctx.gymSessions || 0;
        
        if (turnsLeft > 0 || gymLeft > 0) {
            LORB.View.line("\1yRemaining:\1n Street Turns: \1h" + turnsLeft + "\1n  Gym: \1h" + gymLeft + "\1n");
            LORB.View.line("");
            LORB.View.line("See you soon in \1h" + cityName + "\1n!");
        } else {
            // Out of turns - show next city if available
            var nextCity = cityName;
            if (LORB.Cities && LORB.Cities.getForDay) {
                var gameDay = getSharedGameDay();
                var next = LORB.Cities.getForDay(gameDay + 1);
                if (next && next.cityName) {
                    nextCity = next.cityName;
                }
            }
            LORB.View.line("You've used all your turns for today.");
            LORB.View.line("See you tomorrow in \1h" + nextCity + "\1n!");
        }
        
        LORB.View.line("");
        LORB.View.line("The streetlights flicker on as you head to your hotel...");
        LORB.View.line("");
        LORB.View.line("\1h\1kPress any key...\1n");
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
