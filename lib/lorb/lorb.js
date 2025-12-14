// xtrn/lorb/lorb.js
load("sbbsdefs.js");
(function () {
    // ROOT is the directory where lorb.js lives (relative to main script exec_dir)
    var ROOT = js.exec_dir + "lib/lorb/";
    
    load(ROOT + "boot.js");           // creates global LORB and loads modules
    
    // Optional: load opponent display for ANSI art viewing
    try {
        load(ROOT + "get_random_opponent.js");
        load(js.exec_dir + "lib/lorb_shared/opponent-display.js");
    } catch (e) {
        // Opponent display not critical
    }

    // ========== INITIALIZE SHARED STATE ==========
    // Ensure the shared world state exists (creates if first run)
    LORB.SharedState.initialize();
    
    // ========== VERSION CHECK ==========
    // Attempt to connect to JSON service and verify version compatibility
    // This prevents incompatible clients from connecting to the server
    if (LORB.JsonClientHelper && LORB.JsonClientHelper.getVersionMismatchError && LORB.Config.ENABLE_LIVE_CHALLENGES !== false) {
        var jch = LORB.JsonClientHelper;
        var t0 = Date.now ? Date.now() : (time() * 1000);
        if (typeof debugLog === "function") debugLog("[LORB:VERSION] version check START");
        var testClient = jch.ensureClient ? jch.ensureClient() : null;
        if (typeof debugLog === "function") debugLog("[LORB:VERSION] version check DONE in " + ((Date.now ? Date.now() : (time() * 1000)) - t0) + "ms");
        
        // Check if version mismatch was detected
        var versionError = jch.getVersionMismatchError();
        if (versionError) {
            console.clear();
            console.putmsg("\x01h\x01r=== VERSION MISMATCH ===\x01n\r\n\r\n");
            console.putmsg("\x01y" + versionError.replace(/\n/g, "\r\n") + "\x01n\r\n\r\n");
            console.putmsg("\x01h\x01kPress any key to exit...\x01n");
            console.getkey();
            LORB.JsonClientHelper.disconnect(); // Clean up JSONClient before exit
            return; // Exit LORB
        }
    }
    
    // Get current shared game day and city
    var sharedInfo = LORB.SharedState.getInfo();
    var currentCity = LORB.Cities.getToday();
    
    // ========== SEASON CHECK ==========
    // Check if playoffs should trigger (Day >= SEASON_LENGTH_DAYS)
    var seasonLength = LORB.Config.SEASON_LENGTH_DAYS || 30;
    var daysRemaining = seasonLength - sharedInfo.gameDay;
    var playoffsTriggered = false;
    var parallelPlayoffsStarted = false;
    
    if (LORB.Season && LORB.Season.isSeasonComplete && LORB.Season.isSeasonComplete()) {
        // Season has ended - check if we need to trigger parallel playoffs
        // Only trigger if there's no active bracket for the just-completed season
        var existingBracket = LORB.Playoffs && LORB.Playoffs.loadBracket 
            ? LORB.Playoffs.loadBracket(sharedInfo.seasonNumber) 
            : null;
        
        if (!existingBracket && LORB.Playoffs && LORB.Playoffs.transitionSeason) {
            // This is the first player to log in after season end - trigger parallel playoffs!
            playoffsTriggered = true;
            
            if (typeof log === "function") {
                log(LOG_INFO, "[LORB:SEASON] Season " + sharedInfo.seasonNumber + " complete - triggering parallel playoffs!");
            }
            
            // Run the parallel season transition
            // This creates player snapshots, builds the bracket, and starts a new season
            var transitionResult = LORB.Playoffs.transitionSeason();
            
            if (transitionResult && transitionResult.bracket) {
                parallelPlayoffsStarted = true;
            }
            
            // Refresh shared info after transition (season number has incremented)
            sharedInfo = LORB.SharedState.getInfo();
            currentCity = LORB.Cities.getToday();
        }
    }
    
    // Check for deadline-based auto-resolution of playoff matches
    if (LORB.Playoffs && LORB.Playoffs.checkAndResolveDeadlines) {
        // Auto-migrate old brackets to new round-based deadline system
        if (LORB.Playoffs.autoMigrateIfNeeded) {
            LORB.Playoffs.autoMigrateIfNeeded();
        }
        LORB.Playoffs.checkAndResolveDeadlines();
    }

    // ========== MAIN ENTRY POINT ==========
    
    // Try to load existing character
    var ctx = LORB.Persist.load(user);
    
    if (!ctx || !ctx.archetype) {
        // New player - run character creation
        ctx = LORB.CharacterCreation.run(user, system);
        if (!ctx) {
            // User quit during creation - clean up and exit
            LORB.Persist.disconnect();
            LORB.JsonClientHelper.disconnect(); // Clean up JSONClient before exit
            return;
        }
        
        // Set joinedTimestamp for new players
        ctx.joinedTimestamp = Date.now();
        ctx.joinedOnDay = sharedInfo.gameDay;
        ctx.joinedInCity = currentCity.id;
    } else {
        // Existing player - welcome back
        ctx._user = user;  // Re-attach user object (not persisted)
        
        // Derive position from archetype if not set
        if (!ctx.position && ctx.archetype && LORB.Data && LORB.Data.getPositionFromArchetype) {
            var posInfo = LORB.Data.getPositionFromArchetype(ctx.archetype);
            ctx.position = posInfo.id || "SF";
            ctx.positionName = posInfo.name || "Small Forward";
            ctx.positionCategory = posInfo.category || "Forward";
        }
        
        // Ensure joinedTimestamp exists for legacy players
        if (!ctx.joinedTimestamp) {
            ctx.joinedTimestamp = Date.now();
            ctx.joinedOnDay = sharedInfo.gameDay;
            ctx.joinedInCity = currentCity.id;
        }
        
        // Initialize daily resources based on time elapsed
        // This is the ONLY place day advancement should happen - purely timestamp-based
        LORB.Locations.Hub.initDailyResources(ctx);
        
        // Clear any stale betting data from previous day (games are now watched live)
        var currentGameDay = sharedInfo.gameDay;
        if (ctx.dailyBetting && ctx.dailyBetting.day !== currentGameDay) {
            ctx.dailyBetting = null;
        }
        
        // Get city color for display
        var cityColor = LORB.Cities.getTeamColorCode(currentCity);
        
        LORB.View.clear();
        LORB.View.header("LEGEND OF THE RED BULL");
        LORB.View.line("");
        LORB.View.line("\1cWelcome back, \1h" + (ctx.name || ctx.userHandle) + "\1n\1c.\1n");
        LORB.View.line("");
        LORB.View.line("Today is " + cityColor + "Day " + currentGameDay + "/" + seasonLength + "\1n in " + cityColor + currentCity.cityName + "\1n.");
        LORB.View.line("\1n\1wThe " + currentCity.teamName + " are in town.\1n");
        
        // Show banked days info if applicable
        if (ctx._daysPassed && ctx._daysPassed > 0) {
            LORB.View.line("");
            if (ctx._effectiveDays === ctx._daysPassed) {
                LORB.View.line("\1y" + ctx._daysPassed + " day(s) have passed - resources refreshed!\1n");
            } else {
                LORB.View.line("\1y" + ctx._daysPassed + " day(s) passed, " + ctx._effectiveDays + " banked.\1n");
            }
            // Clear the temp flags after showing
            delete ctx._daysPassed;
            delete ctx._effectiveDays;
        }
        
        LORB.View.line("");
        LORB.View.line("Record: \1g" + (ctx.wins || 0) + "W\1n - \1r" + (ctx.losses || 0) + "L\1n");
        LORB.View.line("Rep: \1c" + (ctx.rep || 0) + "\1n  |  Cash: \1y$" + (ctx.cash || 0) + "\1n");
        
        // Show PvP stats summary if they have any games
        if (ctx.pvpStats && ctx.pvpStats.gamesPlayed > 0) {
            var pvps = ctx.pvpStats;
            LORB.View.line("");
            LORB.View.line("\1h\1mPvP:\1n " + pvps.wins + "W-" + pvps.losses + "L" + 
                          (pvps.ties > 0 ? "-" + pvps.ties + "T" : "") +
                          (pvps.currentStreak > 0 ? " \1g(" + pvps.currentStreak + " streak)\1n" : 
                           pvps.currentStreak < 0 ? " \1r(" + Math.abs(pvps.currentStreak) + " L streak)\1n" : ""));
        }
        
        LORB.View.line("");
        LORB.View.line("\1h\1kPress any key...\1n");
        console.getkey();
        
        // Show recent PvP news as separate view (if any news exists)
        if (LORB.Util && LORB.Util.PvpStats) {
            var recentNews = LORB.Util.PvpStats.getNews(5);  // Get last 5 news items
            if (recentNews && recentNews.length > 0) {
                LORB.View.clear();
                LORB.View.header("DAILY NEWS");
                LORB.View.line("");
                LORB.View.line("\1h\1w--- RECENT PVP ACTION ---\1n");
                LORB.View.line("");
                for (var ni = 0; ni < recentNews.length; ni++) {
                    var headline = LORB.Util.PvpStats.formatNewsHeadline(recentNews[ni]);
                    // Split headline if it has newlines
                    var headlineLines = headline.split("\n");
                    for (var hl = 0; hl < headlineLines.length; hl++) {
                        LORB.View.line(headlineLines[hl]);
                    }
                    if (ni < recentNews.length - 1) {
                        LORB.View.line("");  // Spacing between news items
                    }
                }
                LORB.View.line("");
                LORB.View.line("\1wPress any key to enter " + currentCity.cityName + "...\1n");
                console.getkey();
            }
        }
    }

    // Daily resources already initialized above for returning players
    // For new players, initialize now
    if (!ctx.lastPlayedTimestamp) {
        LORB.Locations.Hub.initDailyResources(ctx);
    }
    
    // Start background challenge service (non-UI) for live challenges
    // This handles presence, subscriptions, and challenge notifications
    if (LORB.Multiplayer && LORB.Multiplayer.ChallengeService) {
        LORB.Multiplayer.ChallengeService.start(ctx);
    }
    
    // Reset day stats for tracking
    ctx.dayStats = { gamesPlayed: 0, wins: 0, losses: 0, cashEarned: 0, repGained: 0 };

    // ========== PLAYOFF TRIGGER ==========
    // If parallel playoffs were triggered, show notification and continue to new season
    if (parallelPlayoffsStarted) {
        var previousSeason = sharedInfo.seasonNumber - 1;
        var bracket = LORB.Playoffs.loadBracket(previousSeason);
        
        LORB.View.clear();
        LORB.View.header("SEASON " + previousSeason + " COMPLETE!");
        LORB.View.line("");
        LORB.View.line("\1h\1yThe regular season has ended!\1n");
        LORB.View.line("");
        LORB.View.line("\1wSeason " + previousSeason + " Playoffs are now \1h\1gACTIVE\1n\1w!\1n");
        
        if (bracket && bracket.seeds) {
            var playerCount = 0;
            for (var i = 0; i < bracket.seeds.length; i++) {
                if (!bracket.seeds[i].isBye) playerCount++;
            }
            LORB.View.line("\1w" + playerCount + " players have qualified for the playoffs.\1n");
        }
        
        LORB.View.line("");
        LORB.View.line("\1cSeason " + sharedInfo.seasonNumber + " begins NOW!\1n");
        LORB.View.line("\1wYou can play regular season games AND playoff matches.\1n");
        
        // Check if current player is in playoffs
        var playerId = ctx._globalId || ctx.name;
        var playoffStatus = LORB.Playoffs.getPlayerPlayoffStatus(playerId);
        
        LORB.View.line("");
        if (playoffStatus.inPlayoffs) {
            LORB.View.line("\1g*** YOU ARE IN THE PLAYOFFS! ***\1n");
            LORB.View.line("\1wCheck the hub menu for your playoff match.\1n");
        } else {
            LORB.View.line("\1yYou did not qualify for Season " + previousSeason + " playoffs.\1n");
            LORB.View.line("\1wBuild your rep this season to qualify next time!\1n");
        }
        
        LORB.View.line("");
        LORB.View.line("\1h\1kPress any key to continue...\1n");
        console.getkey();
        
    } else if (playoffsTriggered && LORB.Season && LORB.Season.runEndOfSeason) {
        // Legacy fallback: synchronous playoffs (if parallel system isn't available)
        LORB.View.clear();
        LORB.View.header("END OF SEASON " + LORB.Season.getSeasonNumber());
        LORB.View.line("");
        LORB.View.line("\1h\1yThe regular season has ended!\1n");
        LORB.View.line("\1wThe playoffs are about to begin...\1n");
        LORB.View.line("");
        LORB.View.line("\1wPress any key to watch the playoffs unfold...\1n");
        console.getkey();
        
        // Run the playoff bracket
        var seasonResults = LORB.Season.runEndOfSeason();
        
        // Display results
        LORB.View.clear();
        LORB.View.header("SEASON " + seasonResults.seasonNumber + " RESULTS");
        LORB.View.line("");
        LORB.View.line("\1h\1cPLAYOFF CHAMPION:\1n");
        LORB.View.line("\1h\1y" + (seasonResults.champion.name || seasonResults.champion.displayName) + "\1n");
        LORB.View.line("");
        
        // Jordan challenge result
        if (seasonResults.jordanResult) {
            LORB.View.line("\1h\1rJORDAN CHALLENGE:\1n");
            if (seasonResults.jordanResult.championWon) {
                LORB.View.line("\1h\1g" + seasonResults.champion.name + " DEFEATED THE RED BULL!\1n");
                LORB.View.line("\1w" + seasonResults.jordanResult.lore + "\1n");
            } else {
                LORB.View.line("\1h\1r" + LORB.Config.JORDAN_BOSS.NAME + " remains undefeated.\1n");
                LORB.View.line("\1w" + seasonResults.jordanResult.lore + "\1n");
            }
        }
        
        LORB.View.line("");
        LORB.View.line("\1h\1cA new season begins...\1n");
        LORB.View.line("\1wAll stats have been reset. Your meta-progression carries on.\1n");
        LORB.View.line("");
        LORB.View.line("\1wPress any key to start Season " + (seasonResults.seasonNumber + 1) + "...\1n");
        console.getkey();
        
        // Refresh shared info after reset
        sharedInfo = LORB.SharedState.getInfo();
        currentCity = LORB.Cities.getToday();
        
        // Player needs to start fresh - reset their in-memory stats
        // (the persistent reset was handled in runEndOfSeason)
        ctx.level = 1;
        ctx.xp = 0;
        ctx.rep = 0;
        ctx.wins = 0;
        ctx.losses = 0;
        ctx.gamesPlayed = 0;
        ctx.winStreak = 0;
        ctx.cash = 1000 + (ctx.meta && ctx.meta.startingCashBonus ? ctx.meta.startingCashBonus : 0);
        ctx.dayStats = { gamesPlayed: 0, wins: 0, losses: 0, cashEarned: 0, repGained: 0 };
        
        // Clear romance
        ctx.romance = null;
    } else if (daysRemaining <= 3 && daysRemaining > 0) {
        // Warn players that playoffs are approaching
        LORB.View.line("");
        LORB.View.line("\1h\1y*** PLAYOFFS IN " + daysRemaining + " DAY" + (daysRemaining === 1 ? "" : "S") + "! ***\1n");
        LORB.View.line("\1wBuild your REP score to qualify!\1n");
    }

    // ========== SPORTS AGENT VIEW ==========
    // Larry Lalyre greets players and shows Ballerdex news
    // First-time: Tutorial about the Ballerdex system
    // Returning: Community news of recent contact acquisitions
    if (LORB.Locations && LORB.Locations.SportsAgent && LORB.Locations.SportsAgent.show) {
        LORB.Locations.SportsAgent.show(ctx);
    }

    // Run the main hub loop
    // ChallengeService handles presence via pubsub subscriptions
    var hubResult = LORB.Locations.Hub.run(ctx);
    
    // Stop challenge service (clears presence, unsubscribes)
    if (LORB.Multiplayer && LORB.Multiplayer.ChallengeService) {
        LORB.Multiplayer.ChallengeService.stop();
    }
    
    // Disconnect JsonClientHelper (used by version check)
    // This is critical - leaving it connected can block other BBS operations
    if (LORB.JsonClientHelper && LORB.JsonClientHelper.disconnect) {
        try { LORB.JsonClientHelper.disconnect(); } catch (e) {}
    }
    
    // Handle exit - don't save if character was reset
    if (hubResult === "reset") {
        LORB.View.close();
        LORB.Persist.disconnect();
        return;
    }
    
    // Save on exit
    LORB.Persist.save(ctx);
    LORB.Persist.disconnect();
    
    // Close the LORB view frame
    LORB.View.close();
})();
