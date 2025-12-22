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

    // ========== HELPER FUNCTIONS ==========
    
    /**
     * Handle pregnancy reveal when entering a city
     * Shows announcement and offers doctor visit or proceed to hub
     * 
     * @param {Object} ctx - Player context
     * @param {Object} pregnancy - The hidden pregnancy to reveal
     * @param {Object} currentCity - Current city object
     * @returns {boolean} True if handled
     */
    function handlePregnancyReveal(ctx, pregnancy, currentCity) {
        if (!pregnancy) return false;
        
        // Mark as discovered immediately (prevents re-reveal)
        var gameDay = 1;
        if (LORB.SharedState && LORB.SharedState.getGameDay) {
            gameDay = LORB.SharedState.getGameDay();
        }
        pregnancy.discoveredOnDay = gameDay;
        pregnancy.phase = 2;  // Move to Phase 2 (revealed)
        
        // Run complete doctor flow (ailment reveal → Doc Vitale → ultrasound → stats → birth)
        if (LORB.Locations && LORB.Locations.Doctor && LORB.Locations.Doctor.runDoctorVisit) {
            LORB.Locations.Doctor.runDoctorVisit(ctx, pregnancy);
        }
        
        return true;
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
        var previousCity = LORB.Util.BusArt.getPreviousCity(currentGameDay);
        
        // Create RichView for welcome screen
        var welcomeView = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 41, y: 5, width: 40, height: 20 }
            ],
            theme: "lorb"
        });
        
        // Render Figlet banner in header
        var headerFrame = welcomeView.getZone("header");
        if (LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
            LORB.Util.FigletBanner.renderToFrame(headerFrame, "WELCOME BACK", CYAN | HIGH);
        } else {
            headerFrame.gotoxy(2, 2);
            headerFrame.putmsg("\1h\1c=== WELCOME BACK ===\1n");
        }
        
        // Render bus art with dynamic route sign
        var artFrame = welcomeView.getZone("art");
        LORB.Util.BusArt.render(artFrame, {
            origin: previousCity,
            destination: currentCity
        });
        
        // Draw border on content zone with padding - returns inner frame with word_wrap
        var contentFrame = welcomeView.drawBorder("content", {
            color: CYAN,
            padding: 1
        });
        
        // Write welcome info inside the bordered area (gotoxy is relative to inner frame)
        var cy = 1;
        contentFrame.gotoxy(1, cy++);
        contentFrame.putmsg("\1cWelcome back, \1h\1c" + (ctx.name || ctx.userHandle) + "\1n\1c.\1n");
        cy++;
        contentFrame.gotoxy(1, cy++);
        contentFrame.putmsg("\1cToday is " + cityColor + "Day " + currentGameDay + "/" + seasonLength + "\1n");
        contentFrame.gotoxy(1, cy++);
        contentFrame.putmsg("\1cin " + cityColor + currentCity.cityName + "\1n\1c.\1n");
        contentFrame.gotoxy(1, cy++);
        contentFrame.putmsg("\1cThe " + currentCity.teamName + " are in town.\1n");
        
        // Show banked days info if applicable
        if (ctx._daysPassed && ctx._daysPassed > 0) {
            cy++;
            if (ctx._effectiveDays === ctx._daysPassed) {
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1y" + ctx._daysPassed + " day(s) passed\1n");
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1yResources refreshed!\1n");
            } else {
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1y" + ctx._daysPassed + " day(s) passed,\1n");
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1y" + ctx._effectiveDays + " banked.\1n");
            }
            // Clear the temp flags after showing
            delete ctx._daysPassed;
            delete ctx._effectiveDays;
        }
        
        cy++;
        contentFrame.gotoxy(1, cy++);
        contentFrame.putmsg("\1cRecord: \1g" + (ctx.wins || 0) + "W\1n\1c - \1r" + (ctx.losses || 0) + "L\1n");
        contentFrame.gotoxy(1, cy++);
        contentFrame.putmsg("\1cRep: \1h\1c" + (ctx.rep || 0) + "\1n\1c  |  Cash: \1y$" + (ctx.cash || 0) + "\1n");
        
        // Show PvP stats summary if they have any games
        if (ctx.pvpStats && ctx.pvpStats.gamesPlayed > 0) {
            var pvps = ctx.pvpStats;
            cy++;
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1h\1mPvP:\1n \1c" + pvps.wins + "W-" + pvps.losses + "L" + 
                          (pvps.ties > 0 ? "-" + pvps.ties + "T" : "") + "\1n" +
                          (pvps.currentStreak > 0 ? " \1g(" + pvps.currentStreak + " streak)\1n" : 
                           pvps.currentStreak < 0 ? " \1r(" + Math.abs(pvps.currentStreak) + " L streak)\1n" : ""));
        }
        
        cy++;
        contentFrame.gotoxy(1, cy++);
        contentFrame.putmsg("\1cPress any key...\1n");
        
        welcomeView.render();
        console.getkey();
        welcomeView.close();
        
        // Show recent PvP news as separate RichView (or empty state if no news)
        if (LORB.Util && LORB.Util.PvpStats) {
            var recentNews = LORB.Util.PvpStats.getNews(5);  // Get last 5 news items
            
            // Create RichView with art on left, content on right
            var newsView = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 4 },
                    { name: "art", x: 1, y: 5, width: 40, height: 20 },
                    { name: "content", x: 41, y: 5, width: 40, height: 20 }
                ],
                art: {
                    art: "assets/lorb/baller_alert.bin"
                },
                theme: "lorb"
            });
            
            // Render Figlet banner in header
            var headerFrame = newsView.getZone("header");
            if (LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
                LORB.Util.FigletBanner.renderToFrame(headerFrame, "BALLER ALERT", YELLOW | HIGH);
            } else {
                headerFrame.gotoxy(2, 2);
                headerFrame.putmsg("\1h\1y=== BALLER ALERT ===\1n");
            }
            
            // Draw yellow border on content zone with padding - returns inner frame
            var contentFrame = newsView.drawBorder("content", {
                color: YELLOW,
                padding: 1
            });
            
            var cy = 1;
            
            if (recentNews && recentNews.length > 0) {
                // Show news inside the bordered area (gotoxy is relative to inner frame)
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1h\1w--- RECENT PVP ACTION ---\1n");
                cy++;
                
                for (var ni = 0; ni < recentNews.length; ni++) {
                    var headline = LORB.Util.PvpStats.formatNewsHeadline(recentNews[ni]);
                    var headlineLines = headline.split("\n");
                    for (var hl = 0; hl < headlineLines.length; hl++) {
                        contentFrame.gotoxy(1, cy++);
                        contentFrame.putmsg(headlineLines[hl]);
                    }
                    if (ni < recentNews.length - 1) {
                        cy++;
                    }
                }
                
                cy++;
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1wPress any key to enter\1n");
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1w" + currentCity.cityName + "...\1n");
            } else {
                // No records - show instructions
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1h\1w--- NO ACTION YET ---\1n");
                cy++;
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1cThe courts are quiet...");
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1cfor now.\1n");
                cy++;
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1wWanna make some noise?\1n");
                cy++;
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1y\xFE \1nChallenge another baller");
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("   \1kto a \1h\1cPvP match\1n");
                cy++;
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1y\xFE \1nStep to a \1h\1rLegend\1n at");
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("   \1kthe \1nRed Bull courts");
                cy++;
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1h\1kPress any key...\1n");
            }
            
            newsView.render();
            console.getkey();
            newsView.close();
        }
    }

    // Daily resources already initialized above for returning players
    // For new players, initialize now
    if (!ctx.lastPlayedTimestamp) {
        LORB.Locations.Hub.initDailyResources(ctx);
    }
    
    // ========== NETWORK SERVICE (Wave 24) ==========
    // Create class-based network service that handles all JSONClient operations.
    // This service is instantiated ONCE and injected into views.
    // Views call service.cycle() in their loops.
    // See: docs/JSONDB-ARCHITECTURE-AUDIT-v2.md
    var networkService = null;
    if (LORB.Services && LORB.Services.NetworkService) {
        try {
            networkService = new LORB.Services.NetworkService(ctx, LORB.Config);
            networkService.start();
            if (typeof debugLog === "function") {
                debugLog("[LORB] NetworkService started");
            }
        } catch (e) {
            if (typeof debugLog === "function") {
                debugLog("[LORB][ERROR] NetworkService failed to start: " + e);
            }
            networkService = null;
        }
    }
    
    // Legacy fallback: Start background challenge service if new service failed
    // TODO: Remove this fallback once NetworkService is proven stable
    if (!networkService && LORB.Multiplayer && LORB.Multiplayer.ChallengeService) {
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

    // ========== SPOUSE CAUGHT WITH WRONG COMPANION CHECK ==========
    // Check if spouse sees player arriving with someone other than spouse
    // This happens when entering spouse's home city with a different companion
    var currentCity = LORB.Cities ? LORB.Cities.getToday() : null;
    if (currentCity && LORB.Data && LORB.Data.SpouseEvents) {
        var spouseEvent = LORB.Data.SpouseEvents.checkWrongCompanionEvent(ctx, currentCity);
        if (spouseEvent) {
            LORB.Data.SpouseEvents.showEvent(spouseEvent, ctx);
        }
    }
    
    // ========== COMPANION PREGNANCY REVEAL CHECK ==========
    // Check if a traveling companion pregnancy should be revealed
    // This happens BEFORE entering the hub when:
    // - Player enters the companion's home city
    // - Enough game days have elapsed since conception
    // Player gets the option to visit doctor or proceed to hub
    var pregnancyRevealHandled = false;
    if (LORB.Data && LORB.Data.Companion && LORB.Data.Companion.checkForPregnancyReveal) {
        var gameDay = LORB.SharedState ? LORB.SharedState.getGameDay() : 1;
        var cityId = currentCity ? currentCity.id : null;
        
        var pendingReveal = LORB.Data.Companion.checkForPregnancyReveal(ctx, cityId, gameDay);
        
        if (pendingReveal) {
            pregnancyRevealHandled = handlePregnancyReveal(ctx, pendingReveal, currentCity);
        }
    }
    
    // If no pregnancy reveal, show Doc Vitale birth news in RichView (or empty state)
    if (!pregnancyRevealHandled && LORB.Data && LORB.Data.BabyBallers && LORB.Data.BabyBallers.getBirthNews &&
        LORB.Locations && LORB.Locations.Doctor && LORB.Locations.Doctor.showBirthNews) {
        var birthNews = LORB.Data.BabyBallers.getBirthNews(5);
        if (birthNews && birthNews.length > 0) {
            LORB.Locations.Doctor.showBirthNews(birthNews);
        } else {
            // No baby news - show instructions using Doctor's showEmptyBirthNews
            if (LORB.Locations.Doctor.showEmptyBirthNews) {
                LORB.Locations.Doctor.showEmptyBirthNews();
            }
        }
    }

    // Run the main hub loop
    // Pass networkService so hub can cycle it in its loop
    var hubResult = LORB.Locations.Hub.run(ctx, { networkService: networkService });
    
    // Stop network service (clears presence, disconnects)
    if (networkService) {
        try {
            networkService.stop();
            if (typeof debugLog === "function") {
                debugLog("[LORB] NetworkService stopped");
            }
        } catch (e) {
            if (typeof debugLog === "function") {
                debugLog("[LORB][ERROR] NetworkService stop failed: " + e);
            }
        }
    }
    
    // Legacy fallback: Stop old challenge service if it was used
    if (!networkService && LORB.Multiplayer && LORB.Multiplayer.ChallengeService) {
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
