// halftime.js - Halftime and Substitution Screen functionality
// Handles mid-game break, statistics display, and player substitution interface

/**
 * Apply a remote substitution directly to sprites.
 * Used by coordinator when receiving subs from clients (no PlayerClient available).
 * Mirrors the logic in PlayerClient.applyRemoteSubstitutions().
 * 
 * @param {Object} sub - Substitution data {teamKey, slot, playerInfo, turbo}
 * @param {Object} stateManager - State manager for team colors
 */
function applyRemoteSubDirectly(sub, stateManager) {
    if (!sub || !sub.teamKey || sub.slot === undefined || !sub.playerInfo) {
        debugLog("[HALFTIME] Invalid remote sub data");
        return;
    }
    
    var teamKey = sub.teamKey;
    var slot = sub.slot;
    var playerInfo = sub.playerInfo;
    var teamColors = stateManager.get("teamColors") || {};
    
    // Determine sprite ID
    var spriteId;
    if (teamKey === "teamA") {
        spriteId = slot === 0 ? spriteRegistry.IDS.TEAM_A_PLAYER_1 : spriteRegistry.IDS.TEAM_A_PLAYER_2;
    } else {
        spriteId = slot === 0 ? spriteRegistry.IDS.TEAM_B_PLAYER_1 : spriteRegistry.IDS.TEAM_B_PLAYER_2;
    }
    
    var currentSprite = spriteRegistry.get(spriteId);
    if (!currentSprite) {
        debugLog("[HALFTIME] Cannot find sprite " + spriteId + " for remote sub");
        return;
    }
    
    // Get position/bearing from current sprite
    var startX = currentSprite.x || (teamKey === "teamA" ? 18 : 58);
    var startY = currentSprite.y || (slot === 0 ? 7 : 12);
    var bearing = currentSprite.bearing || (teamKey === "teamA" ? "e" : "w");
    var wasHuman = currentSprite.isHuman;
    
    // Remove old sprite frame
    if (currentSprite.frame && typeof currentSprite.frame.close === "function") {
        currentSprite.frame.close();
    }
    
    // Create new sprite
    var usingCustomSprite = !!(playerInfo && playerInfo.customSprite);
    var skinName = playerInfo.skin ? String(playerInfo.skin).toLowerCase() : "";
    var spriteBase = usingCustomSprite
        ? playerInfo.customSprite
        : (typeof resolveSpriteBaseBySkin === "function" 
            ? resolveSpriteBaseBySkin(playerInfo.skin)
            : js.exec_dir + "sprites/player-" + skinName + ".ini");
    
    var newSprite = new Sprite.Aerial(
        spriteBase,
        courtFrame,
        startX,
        startY,
        bearing,
        "normal"
    );
    
    // Apply jersey mask if needed
    var NO_JERSEY_SKINS = ["barney", "shrek", "airbud", "sonic", "donatello", "satan", "iceman"];
    var skipJersey = NO_JERSEY_SKINS.indexOf(skinName) !== -1;
    
    if (!usingCustomSprite && !skipJersey) {
        var tc = teamColors[teamKey] || {};
        var fallbackBg = teamKey === "teamA" ? BG_RED : BG_BLUE;
        var jerseyBgColor = (tc.bg_alt !== undefined) ? tc.bg_alt : ((tc.bg !== undefined) ? tc.bg : fallbackBg);
        var accentColor = (tc.fg_accent !== undefined) ? tc.fg_accent : WHITE;
        
        var jerseyDigits = playerInfo.jerseyString || String(playerInfo.jersey || 0);
        
        var jerseyConfig = {
            jerseyBg: jerseyBgColor,
            accentFg: accentColor,
            jerseyNumber: jerseyDigits,
            shoePalette: typeof assignShoePalette === "function" ? assignShoePalette(tc) : null
        };
        
        if (typeof applyUniformMask === "function") {
            applyUniformMask(newSprite, jerseyConfig);
        }
        newSprite.__jerseyConfig = jerseyConfig;
    }
    
    if (typeof scrubSpriteTransparency === "function") {
        scrubSpriteTransparency(newSprite);
    }
    
    // Position and display sprite
    newSprite.moveTo(startX, startY);
    newSprite.frame.open();
    newSprite.isHuman = wasHuman;
    
    // Merge shoved bearings
    if (typeof mergeShovedBearingsIntoSprite === "function") {
        mergeShovedBearingsIntoSprite(newSprite);
    }
    
    // Create playerData
    var newPlayerData;
    if (typeof Player === "function") {
        newPlayerData = new Player(
            playerInfo.name,
            playerInfo.jersey || 0,
            playerInfo.attributes || [6, 6, 6, 6, 6, 6],
            newSprite,
            playerInfo.shortNick
        );
        newPlayerData.team = teamKey;
        newPlayerData.skin = playerInfo.skin || "brown";
        newPlayerData.jerseyString = playerInfo.jerseyString || String(playerInfo.jersey || 0);
        newPlayerData.position = (playerInfo.position || "").toUpperCase();
        newPlayerData.hasDribble = true;
        newPlayerData.lorbId = playerInfo.lorbId || null;
        newPlayerData.turbo = sub.turbo || 135;
    } else {
        newPlayerData = {
            name: playerInfo.name,
            jersey: playerInfo.jersey || 0,
            team: teamKey,
            skin: playerInfo.skin || "brown",
            turbo: sub.turbo || 135
        };
    }
    newSprite.playerData = newPlayerData;
    
    // Register new sprite
    spriteRegistry.register(spriteId, newSprite);
    
    // Update global references (legacy compatibility)
    if (teamKey === "teamA") {
        if (slot === 0) {
            teamAPlayer1 = newSprite;
        } else {
            teamAPlayer2 = newSprite;
        }
    } else {
        if (slot === 0) {
            teamBPlayer1 = newSprite;
        } else {
            teamBPlayer2 = newSprite;
        }
    }
    
    debugLog("[HALFTIME] Coordinator applied remote sub directly: " + teamKey + " slot " + slot + " -> " + playerInfo.name + " (skin=" + skinName + ")");
    
    // Request court redraw
    stateManager.set("courtNeedsRedraw", true, "halftime_remote_sub_applied");
}

/**
 * Determine which team a player controls based on sprite controlledBy
 * @param {string} playerId - Player's global ID
 * @returns {string|null} "teamA", "teamB", or null if not controlling any sprite
 */
function getPlayerTeam(playerId) {
    if (!playerId) return null;
    
    var sprites = [
        { sprite: spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_1), team: "teamA" },
        { sprite: spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_2), team: "teamA" },
        { sprite: spriteRegistry.get(spriteRegistry.IDS.TEAM_B_PLAYER_1), team: "teamB" },
        { sprite: spriteRegistry.get(spriteRegistry.IDS.TEAM_B_PLAYER_2), team: "teamB" }
    ];
    
    for (var i = 0; i < sprites.length; i++) {
        var s = sprites[i];
        if (s.sprite && s.sprite.controlledBy === playerId) {
            return s.team;
        }
    }
    
    return null;
}

/**
 * Hide all player sprites and ball for clean screen rendering
 * Used during halftime/substitution screens
 */
function hideGameSprites() {
    var sprites = [
        spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_1),
        spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_2),
        spriteRegistry.get(spriteRegistry.IDS.TEAM_B_PLAYER_1),
        spriteRegistry.get(spriteRegistry.IDS.TEAM_B_PLAYER_2)
    ];
    
    for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        if (sprite && sprite.frame && typeof sprite.frame.close === "function") {
            sprite.frame.close();
        }
        // Also hide label frames if present
        if (sprite && sprite.labelFrame && typeof sprite.labelFrame.close === "function") {
            try { sprite.labelFrame.close(); } catch (e) {}
        }
    }
    
    // Hide ball
    if (typeof ballFrame !== "undefined" && ballFrame && typeof ballFrame.close === "function") {
        ballFrame.close();
    }
}

/**
 * Show all player sprites and ball after screen rendering
 */
function showGameSprites() {
    var sprites = [
        spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_1),
        spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_2),
        spriteRegistry.get(spriteRegistry.IDS.TEAM_B_PLAYER_1),
        spriteRegistry.get(spriteRegistry.IDS.TEAM_B_PLAYER_2)
    ];
    
    for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        if (sprite && sprite.frame && typeof sprite.frame.open === "function") {
            sprite.frame.open();
        }
        // Reopen label frames too
        if (sprite && sprite.labelFrame && typeof sprite.labelFrame.open === "function") {
            try { sprite.labelFrame.open(); } catch (e) {}
        }
    }
    
    // Show ball
    if (typeof ballFrame !== "undefined" && ballFrame && typeof ballFrame.open === "function") {
        ballFrame.open();
    }
}

/**
 * Display halftime screen with current score and team statistics
 * Wave 24: Non-blocking with multiplayer screen coordination
 * 
 * @param {Object} systems - Systems object for state management
 * @param {Object} mpScreenCoordinator - Screen coordinator for multiplayer (optional)
 * @param {string} myPlayerId - Current player's global ID for voting (optional)
 * @param {Object} coordinator - Full coordinator object for state broadcasting (coordinator only)
 * @param {Object} playerClient - Player client for state sync (non-coordinator only)
 * @returns {string} Action taken: "continue" or "quit"
 */
function showHalftimeScreen(systems, mpScreenCoordinator, myPlayerId, coordinator, playerClient) {
    debugLog("[HALFTIME] === showHalftimeScreen() CALLED ===");
    debugLog("[HALFTIME] Parameters: mpScreenCoordinator=" + (mpScreenCoordinator ? "EXISTS" : "NULL") + ", myPlayerId=" + myPlayerId);
    var stateManager = systems.stateManager;
    var allCPUMode = stateManager.get('allCPUMode');
    var isMultiplayer = !!(mpScreenCoordinator);
    var isCoordinator = !!(mpScreenCoordinator && mpScreenCoordinator.coordinator && mpScreenCoordinator.coordinator.isCoordinator);

    debugLog("[HALFTIME] isMultiplayer=" + isMultiplayer + " isCoordinator=" + isCoordinator + " allCPUMode=" + allCPUMode);

    // CRITICAL: Clear any active shot state before halftime
    // This prevents the bug where a shot that was in progress at halftime
    // leaves shotInProgress=true and blocks shooting after halftime
    var shotInProgress = stateManager.get("shotInProgress");
    var pendingHalftime = stateManager.get("pendingHalftime");
    if (shotInProgress) {
        debugLog("[HALFTIME] Clearing shotInProgress flag left over from pre-halftime shot");
        stateManager.set("shotInProgress", false, "halftime_clear_shot");
    }
    if (pendingHalftime) {
        debugLog("[HALFTIME] Clearing pendingHalftime flag");
        stateManager.set("pendingHalftime", false, "halftime_clear_pending");
    }

    // CRITICAL: Clear any active rebound/scramble state before halftime
    // This prevents state bugs where halftime interrupts a rebound scramble
    var reboundActive = stateManager.get("reboundActive");
    var reboundScramble = stateManager.get("reboundScramble");
    if (reboundActive || (reboundScramble && reboundScramble.active)) {
        debugLog("[HALFTIME] Clearing active rebound state before halftime");
        stateManager.set("reboundActive", false, "halftime_clear_rebound");
        stateManager.set("reboundScramble", null, "halftime_clear_rebound");
    }
    // Reset phase to NORMAL to avoid phase state bugs after halftime
    if (typeof setPhase === "function") {
        setPhase(PHASE_NORMAL, {}, 0, null, systems);
        debugLog("[HALFTIME] Reset phase to NORMAL before halftime");
    }

    // COORDINATOR: Enter screen state
    if (isMultiplayer && isCoordinator) {
        var score = stateManager.get('score');
        var teamNames = stateManager.get('teamNames');
        
        // Get halftime timeout from MP_CONSTANTS or use sensible defaults
        var halftimeTimeout = (typeof MP_CONSTANTS === "object" && MP_CONSTANTS.SCREEN_TIMEOUTS && MP_CONSTANTS.SCREEN_TIMEOUTS.HALFTIME_MS)
            ? MP_CONSTANTS.SCREEN_TIMEOUTS.HALFTIME_MS
            : 20000;  // Default 20s (reduced from 60s)

        mpScreenCoordinator.enterScreen("halftime", {
            teamAName: teamNames.teamA,
            teamBName: teamNames.teamB,
            teamAScore: score.teamA,
            teamBScore: score.teamB
        }, allCPUMode ? 10000 : halftimeTimeout);

        debugLog("[HALFTIME] Coordinator entered screen state");
    }

    // Render halftime screen
    renderHalftimeDisplay(systems, isMultiplayer);

    // Input loop (non-blocking in multiplayer)
    var halftimeStart = Date.now();
    var autoAdvance = !!allCPUMode;
    var localReady = false;
    var lastRender = 0;

    debugLog("[HALFTIME] Entering input loop");

    while (true) {
        // Check for dismissal signal in multiplayer
        if (isMultiplayer) {
            var mpScreenAction = stateManager.get("mpScreenAction");

            if (mpScreenAction && mpScreenAction.action === "dismiss" && mpScreenAction.screen === "halftime") {
                debugLog("[HALFTIME] Received dismissal signal from coordinator");
                stateManager.set("mpScreenAction", null, "halftime_dismiss_handled");
                break;
            }

            // Coordinator: Check if can dismiss
            if (isCoordinator && mpScreenCoordinator.canDismiss()) {
                debugLog("[HALFTIME] Coordinator dismissing screen");
                mpScreenCoordinator.dismissScreen();
                break;
            }

            // Re-render ready indicators periodically
            if (Date.now() - lastRender >= 500) {
                renderHalftimeReadyIndicators(systems, mpScreenCoordinator, localReady);
                lastRender = Date.now();
            }
        }

        // Handle input
        var key = console.inkey(K_NONE, 100);

        if (key && key.length > 0) {
            var keyUpper = key.toUpperCase();

            if (keyUpper === 'S') {
                // Substitutions - determine which team this player controls
                var myTeam = isMultiplayer ? getPlayerTeam(myPlayerId) : "teamA";
                if (myTeam) {
                    if (showSubstitutionScreen(systems, myTeam)) {
                        // In multiplayer, re-render halftime after substitution
                        if (isMultiplayer) {
                            renderHalftimeDisplay(systems, isMultiplayer);
                            renderHalftimeReadyIndicators(systems, mpScreenCoordinator, localReady);
                        } else {
                            break;
                        }
                    }
                }
            } else if (key === ' ' || keyUpper === '\r') {
                // Ready to continue
                if (isMultiplayer && !localReady) {
                    debugLog("[HALFTIME] Local player voting ready");
                    mpScreenCoordinator.setReady(myPlayerId);
                    localReady = true;
                    renderHalftimeReadyIndicators(systems, mpScreenCoordinator, localReady);
                } else if (!isMultiplayer) {
                    // Single-player: exit immediately
                    break;
                }
            } else if (keyUpper === 'Q') {
                debugLog("[HALFTIME] Q pressed, quitting game");
                stateManager.set('gameRunning', false, 'user_quit_halftime');
                return "quit";
            }
        } else if (autoAdvance && (Date.now() - halftimeStart) >= 10000) {
            // Auto-advance for CPU games
            debugLog("[HALFTIME] Auto-advance triggered");
            if (isMultiplayer && isCoordinator) {
                mpScreenCoordinator.dismissScreen();
            }
            break;
        }

        // Coordinator: Force state broadcast to keep clients updated
        if (isCoordinator && coordinator && coordinator.update) {
            coordinator.update();
            
            // Coordinator: Check for incoming substitutions from clients
            try {
                var sessionId = coordinator.sessionId || (coordinator.session && coordinator.session.id);
                if (sessionId) {
                    var subQueue = new Queue("nba_jam.game." + sessionId + ".subs");
                    while (subQueue.data_waiting) {
                        var remoteSub = subQueue.read();
                        if (remoteSub && remoteSub.teamKey && remoteSub.slot !== undefined && remoteSub.playerInfo) {
                            var pendingSubs = stateManager.get("pendingSubstitutions") || [];
                            pendingSubs.push(remoteSub);
                            stateManager.set("pendingSubstitutions", pendingSubs, "remote_substitution_received");
                            debugLog("[HALFTIME] Coordinator received remote sub: " + remoteSub.teamKey + " slot " + remoteSub.slot + " -> " + (remoteSub.playerInfo.name || "?"));
                            
                            // Coordinator must also apply the sub locally to update its own sprites
                            // Use dedicated helper since coordinator has no PlayerClient
                            applyRemoteSubDirectly(remoteSub, stateManager);
                        }
                    }
                }
            } catch (e) {
                // Queue may not exist yet, that's OK
            }
        }

        // Non-coordinator: Update state from coordinator
        if (!isCoordinator && playerClient && playerClient.update) {
            playerClient.update(0); // Frame number not critical for state sync
        }
    }

    debugLog("[HALFTIME] Exiting halftime screen");

    // WAVE 24 FLICKER FIX: Hard reset the client's prediction state to prevent
    // post-halftime desync and flicker. This forces the client back to the "good"
    // startup state.
    if (playerClient && typeof playerClient.resetPredictionState === 'function') {
        playerClient.resetPredictionState("halftime_end");
    }

    // Prepare for second half
    stateManager.set("isHalftime", false, "halftime_end");
    stateManager.set("pendingSecondHalfInbound", true, "halftime_end");
    stateManager.set("secondHalfInitDone", false, "halftime_end");
    
    // Clear pending substitutions after halftime - coordinator has broadcast them
    // and clients have applied them (or will apply on next state sync)
    stateManager.set("pendingSubstitutions", [], "halftime_clear_subs");
    debugLog("[HALFTIME] Cleared pendingSubstitutions for next halftime cycle");

    // Restore reboundScramble object structure (was set to null for halftime cleanup)
    stateManager.set("reboundScramble", {
        active: false,
        startTime: 0,
        maxDuration: 2000,
        reboundX: 0,
        reboundY: 0,
        bounceAnimComplete: false,
        anticipating: false,
        anticipatedX: 0,
        anticipatedY: 0
    }, "halftime_restore_rebound_state");

    // CPU substitutions (pass systems for state access)
    performCPUSubstitutions(systems);
    
    // Re-show sprites before returning to game
    showGameSprites();
    courtFrame.clear();  // Clear halftime text before game resumes

    var teamNames = stateManager.get('teamNames');
    var currentTeam = stateManager.get('currentTeam');
    announceEvent("tipoff", {
        teamA: (teamNames.teamA || "TEAM A").toUpperCase(),
        teamB: (teamNames.teamB || "TEAM B").toUpperCase(),
        team: currentTeam
    }, systems);

    if (!isCoordinator) {
        mswait(1500);
    }

    return "continue";
}

/**
 * Render halftime display (separated for re-rendering with indicators)
 * @param {Object} systems - Systems object
 * @param {boolean} isMultiplayer - Whether this is a multiplayer game (optional)
 */
function renderHalftimeDisplay(systems, isMultiplayer) {
    var stateManager = systems.stateManager;

    // Hide sprites to prevent them from appearing over halftime text
    hideGameSprites();
    
    courtFrame.clear();
    courtFrame.gotoxy(1, 1);

    var teamNames = stateManager.get('teamNames');
    var teamColors = stateManager.get('teamColors');
    var teamAName = teamNames.teamA;
    var teamBName = teamNames.teamB;
    var teamAColorCode = teamColors.teamA.fg_accent_code || teamColors.teamA.fg_code || "\1h\1w";
    var teamBColorCode = teamColors.teamB.fg_accent_code || teamColors.teamB.fg_code || "\1h\1w";
    var whiteCode = "\1h\1w";

    courtFrame.center("\r\n\r\n");
    courtFrame.center("\1h\1y HALFTIME \1n\r\n\r\n");

    // Show current score
    var score = stateManager.get('score');
    courtFrame.center(
        whiteCode + "Halftime Score: " +
        teamAColorCode + teamAName + " " + score.teamA +
        whiteCode + " - " +
        teamBColorCode + teamBName + " " + score.teamB +
        "\1n\r\n\r\n"
    );

    // Show halftime stats
    renderTeamBoxScore("teamA", teamAName, { halftime: true }, systems);
    courtFrame.center("\r\n");
    renderTeamBoxScore("teamB", teamBName, { halftime: true }, systems);

    // Show instructions - include [S] for substitutions in both modes
    if (!isMultiplayer) {
        courtFrame.center("\r\n\1h[S]\1n Subs  \1h[SPACE]\1n Continue  \1h[Q]\1n Quit\r\n");
    } else {
        courtFrame.center("\r\n\1h[S]\1n Subs  \1h[SPACE]\1n Ready\r\n");
    }

    if (typeof Sprite !== "undefined" && typeof Sprite.cycle === "function") {
        Sprite.cycle();
    }
    cycleFrame(courtFrame);
}

/**
 * Render ready indicators for multiplayer (fixed position in scoreboard frame)
 * WAVE 24: Rewritten to use scoreboard frame instead of scrolling courtFrame output
 * @param {Object} systems - Systems object
 * @param {Object} mpScreenCoordinator - Screen coordinator
 * @param {boolean} localReady - Whether local player has pressed SPACE
 */
function renderHalftimeReadyIndicators(systems, mpScreenCoordinator, localReady) {
    if (!mpScreenCoordinator || !mpScreenCoordinator.isScreenActive("halftime")) return;

    var timeRemaining = mpScreenCoordinator.getTimeRemaining();
    
    // Use scoreboard frame (below the court) for status display
    var scoreboardFrame = (typeof FrameManager !== "undefined") ? FrameManager.get("scoreboard") : null;
    if (!scoreboardFrame) return;
    
    // Clear scoreboard and render status
    scoreboardFrame.clear();
    
    // Line 1: Ready prompt or waiting message
    scoreboardFrame.gotoxy(1, 2);
    if (localReady) {
        scoreboardFrame.center("\1h\1gWaiting for others...\1n");
    } else {
        scoreboardFrame.center("\1h\1y[SPACE]\1n Ready    \1h\1r[Q]\1n Quit");
    }
    
    // Line 2: Countdown timer
    scoreboardFrame.gotoxy(1, 3);
    scoreboardFrame.center("\1h\1c" + timeRemaining + "s\1n");

    if (typeof cycleFrame === "function") {
        cycleFrame(scoreboardFrame);
    }
}

/**
 * Display substitution screen interface
 * Shows current active players and available substitutes for the specified team
 * 
 * @param {Object} systems - Systems object for state management
 * @param {string} teamKey - Which team to show substitutions for ("teamA" or "teamB"), defaults to "teamA"
 * @returns {boolean} True if user wants to continue, false if quitting
 */
function showSubstitutionScreen(systems, teamKey) {
    var stateManager = systems.stateManager;
    teamKey = teamKey || "teamA";
    
    // Get available substitutes for the specified team
    var availableSubs = getAvailableSubstitutes(teamKey, systems);
    
    // Get current active players
    var activePlayer1 = getActivePlayerInfo(teamKey, 0);
    var activePlayer2 = getActivePlayerInfo(teamKey, 1);
    
    // If no substitutes available, show message and return
    if (availableSubs.length === 0) {
        courtFrame.clear();
        courtFrame.center("\r\n\r\n\r\n");
        courtFrame.center("\1h\1y SUBSTITUTIONS \1n\r\n\r\n");
        courtFrame.center("\1wNo substitutes available.\1n\r\n\r\n");
        courtFrame.center("\1h[SPACE]\1n Continue to 2nd Half\r\n");
        cycleFrame(courtFrame);
        
        while (true) {
            var key = console.getkey();
            if (key === ' ') {
                return true;
            } else if (key.toUpperCase() === 'Q') {
                stateManager.set('gameRunning', false, 'user_quit_substitution');
                return false;
            }
        }
    }
    
    // State for substitution selection
    var selectedActiveSlot = 1;  // Default to teammate (slot 1), not the human player (slot 0)
    var selectedBenchIndex = 0;
    var phase = "select_active";  // "select_active" or "select_bench"
    var madeSubstitution = false;
    
    // Detect LORB mode: bench entries from LORB will have lorbData
    // In LORB mode, player 1 (slot 0) is the player's character and cannot be substituted
    var isLorbMode = availableSubs.length > 0 && availableSubs[0].entry && availableSubs[0].entry.playerInfo && availableSubs[0].entry.playerInfo.lorbData;
    if (isLorbMode) {
        // Lock to slot 1 only - can only substitute the CPU teammate
        selectedActiveSlot = 1;
    }
    
    var maxTurbo = (typeof TIMING_CONSTANTS !== "undefined" && TIMING_CONSTANTS.TURBO)
        ? TIMING_CONSTANTS.TURBO.MAX
        : 150;
    
    function renderSubstitutionScreen() {
        courtFrame.clear();
        courtFrame.center("\r\n");
        courtFrame.center("\1h\1y=== SUBSTITUTIONS ===\1n\r\n\r\n");
        
        // Show active players with turbo levels
        courtFrame.center("\1h\1cActive Players:\1n\r\n");
        
        var p1Name = activePlayer1 ? (activePlayer1.name || "Player 1") : "Player 1";
        var p1Turbo = activePlayer1 ? (activePlayer1.turbo || 0) : 0;
        var p1TurboPct = Math.round((p1Turbo / maxTurbo) * 100);
        var p1TurboColor = p1TurboPct < 30 ? "\1h\1r" : (p1TurboPct < 60 ? "\1h\1y" : "\1h\1g");
        
        var p2Name = activePlayer2 ? (activePlayer2.name || "Teammate") : "Teammate";
        var p2Turbo = activePlayer2 ? (activePlayer2.turbo || 0) : 0;
        var p2TurboPct = Math.round((p2Turbo / maxTurbo) * 100);
        var p2TurboColor = p2TurboPct < 30 ? "\1h\1r" : (p2TurboPct < 60 ? "\1h\1y" : "\1h\1g");
        
        // In LORB mode, slot 0 (player's character) is locked and cannot be subbed
        if (isLorbMode) {
            // Show player 1 as locked (no selection possible)
            courtFrame.putmsg("  \1h\1k1. " + padRight(p1Name, 16) + " " + p1TurboColor + "Turbo: " + p1TurboPct + "% \1h\1k(you)\1n\r\n");
            // Player 2 (teammate) is always selected for substitution
            var p2Highlight = (phase === "select_active") ? "\1h\1w>\1n " : "  ";
            courtFrame.putmsg(p2Highlight + "\1w2. " + padRight(p2Name, 16) + " " + p2TurboColor + "Turbo: " + p2TurboPct + "%\1n\r\n");
        } else {
            // Arcade mode: allow selecting either slot
            var p1Highlight = (phase === "select_active" && selectedActiveSlot === 0) ? "\1h\1w>\1n " : "  ";
            var p2Highlight = (phase === "select_active" && selectedActiveSlot === 1) ? "\1h\1w>\1n " : "  ";
            courtFrame.putmsg(p1Highlight + "\1w1. " + padRight(p1Name, 16) + " " + p1TurboColor + "Turbo: " + p1TurboPct + "%\1n\r\n");
            courtFrame.putmsg(p2Highlight + "\1w2. " + padRight(p2Name, 16) + " " + p2TurboColor + "Turbo: " + p2TurboPct + "%\1n\r\n");
        }
        
        courtFrame.center("\r\n");
        
        // Show bench
        courtFrame.center("\1h\1gBench:\1n\r\n");
        
        // Refresh available subs in case one was marked inGame
        var currentSubs = getAvailableSubstitutes(teamKey, systems);
        
        if (currentSubs.length === 0) {
            courtFrame.center("\1h\1k(no substitutes remaining)\1n\r\n");
        } else {
            for (var i = 0; i < currentSubs.length; i++) {
                var sub = currentSubs[i];
                var subInfo = sub.entry.playerInfo || {};
                var subName = subInfo.name || "Sub " + (i + 1);
                var subHighlight = (phase === "select_bench" && selectedBenchIndex === i) ? "\1h\1w>\1n " : "  ";
                courtFrame.putmsg(subHighlight + "\1w" + (i + 1) + ". " + padRight(subName, 20) + "\1n\r\n");
            }
        }
        
        courtFrame.center("\r\n");
        
        // Show instructions based on phase
        if (phase === "select_active") {
            if (isLorbMode) {
                // In LORB mode, only the teammate can be substituted
                courtFrame.center("\1h\1y[ENTER]\1n Substitute teammate    \1h\1r[Q]\1n Cancel\r\n");
            } else {
                courtFrame.center("\1h\1y[W/S or Arrows]\1n Select player to substitute out\r\n");
                courtFrame.center("\1h\1y[ENTER]\1n Confirm    \1h\1r[Q]\1n Cancel\r\n");
            }
        } else {
            courtFrame.center("\1h\1y[W/S or Arrows]\1n Select substitute    \1h\1y[ENTER]\1n Confirm\r\n");
            courtFrame.center("\1h\1r[ESC/Q]\1n Go back\r\n");
        }
        
        courtFrame.center("\r\n\1h[SPACE]\1n Continue to 2nd Half\r\n");
        
        cycleFrame(courtFrame);
    }
    
    // Helper for padding
    function padRight(str, len) {
        str = String(str || "");
        while (str.length < len) str += " ";
        return str.substring(0, len);
    }
    
    // Initial render
    renderSubstitutionScreen();
    
    while (true) {
        var key = console.getkey();
        var keyUpper = key.toUpperCase();
        
        if (key === ' ') {
            // Continue to 2nd half
            return true;
        } else if (keyUpper === 'Q') {
            if (phase === "select_bench") {
                // Go back to active selection
                phase = "select_active";
                renderSubstitutionScreen();
            } else {
                // Quit game
                stateManager.set('gameRunning', false, 'user_quit_substitution');
                return false;
            }
        } else if (key === '\x1b' || key === '\b') {  // ESC or Backspace
            if (phase === "select_bench") {
                phase = "select_active";
                renderSubstitutionScreen();
            }
        } else if (key === KEY_UP || keyUpper === 'W' || keyUpper === '8') {  // Up: KEY_UP constant, W, or numpad 8
            if (phase === "select_active") {
                // In LORB mode, cannot change from slot 1 (teammate only)
                if (!isLorbMode) {
                    selectedActiveSlot = (selectedActiveSlot === 0) ? 1 : 0;
                }
            } else {
                var currentSubs = getAvailableSubstitutes(teamKey, systems);
                if (currentSubs.length > 0) {
                    selectedBenchIndex = (selectedBenchIndex - 1 + currentSubs.length) % currentSubs.length;
                }
            }
            renderSubstitutionScreen();
        } else if (key === KEY_DOWN || keyUpper === 'S' || keyUpper === '2') {  // Down: KEY_DOWN constant, S, or numpad 2
            if (phase === "select_active") {
                // In LORB mode, cannot change from slot 1 (teammate only)
                if (!isLorbMode) {
                    selectedActiveSlot = (selectedActiveSlot === 0) ? 1 : 0;
                }
            } else {
                var currentSubs2 = getAvailableSubstitutes(teamKey, systems);
                if (currentSubs2.length > 0) {
                    selectedBenchIndex = (selectedBenchIndex + 1) % currentSubs2.length;
                }
            }
            renderSubstitutionScreen();
        } else if (key === '\r' || key === '\n') {  // Enter
            if (phase === "select_active") {
                // Move to bench selection
                var currentSubs3 = getAvailableSubstitutes(teamKey, systems);
                if (currentSubs3.length > 0) {
                    phase = "select_bench";
                    selectedBenchIndex = 0;
                    renderSubstitutionScreen();
                }
            } else {
                // Perform substitution
                var currentSubs4 = getAvailableSubstitutes(teamKey, systems);
                if (selectedBenchIndex < currentSubs4.length) {
                    var benchEntry = currentSubs4[selectedBenchIndex];
                    var result = performSubstitution(teamKey, selectedActiveSlot, benchEntry.benchIndex, systems);
                    
                    if (result.success) {
                        madeSubstitution = true;
                        
                        // MULTIPLAYER SYNC: Send substitution to coordinator if we're a client
                        // The coordinator will add this to its pendingSubstitutions for broadcast
                        if (typeof mpCoordinator !== "undefined" && mpCoordinator && !mpCoordinator.isCoordinator) {
                            var pendingSubs = stateManager.get("pendingSubstitutions") || [];
                            if (pendingSubs.length > 0) {
                                var latestSub = pendingSubs[pendingSubs.length - 1];
                                try {
                                    // Get session ID from coordinator
                                    var sessionId = mpCoordinator.sessionId || mpCoordinator.session && mpCoordinator.session.id;
                                    if (sessionId) {
                                        var subQueue = new Queue("nba_jam.game." + sessionId + ".subs");
                                        subQueue.write(latestSub);
                                        debugLog("[HALFTIME] Sent substitution to coordinator: " + latestSub.teamKey + " slot " + latestSub.slot);
                                    }
                                } catch (e) {
                                    debugLog("[HALFTIME] Failed to send substitution to coordinator: " + e);
                                }
                            }
                        }
                        
                        // Refresh active player info after substitution
                        activePlayer1 = getActivePlayerInfo(teamKey, 0);
                        activePlayer2 = getActivePlayerInfo(teamKey, 1);
                        
                        // Show confirmation
                        courtFrame.clear();
                        courtFrame.center("\r\n\r\n\r\n");
                        courtFrame.center("\1h\1g" + (result.newPlayer ? result.newPlayer.name : "New player") + " enters the game!\1n\r\n\r\n");
                        cycleFrame(courtFrame);
                        mswait(1000);
                        
                        // Go back to active selection in case they want another sub
                        phase = "select_active";
                        renderSubstitutionScreen();
                    } else {
                        // Show error briefly
                        courtFrame.center("\1h\1r" + (result.message || "Substitution failed") + "\1n\r\n");
                        cycleFrame(courtFrame);
                        mswait(500);
                        renderSubstitutionScreen();
                    }
                }
            }
        }
    }
}

/**
 * Perform automatic CPU player substitutions at halftime
 * Uses turbo-based threshold to decide when to substitute
 * 
 * @param {Object} systems - Game systems for state access
 */
function performCPUSubstitutions(systems) {
    // Get substitution threshold from constants
    var turboThreshold = (typeof TIMING_CONSTANTS !== "undefined" && TIMING_CONSTANTS.SUBSTITUTION)
        ? TIMING_CONSTANTS.SUBSTITUTION.CPU_TURBO_THRESHOLD
        : 30;
    
    var maxTurbo = (typeof TIMING_CONSTANTS !== "undefined" && TIMING_CONSTANTS.TURBO)
        ? TIMING_CONSTANTS.TURBO.MAX
        : 150;
    
    // Check teamB (CPU team) for substitution opportunities
    var availableSubs = getAvailableSubstitutes("teamB", systems);
    
    if (availableSubs.length === 0) {
        debugLog("[CPU SUBS] No substitutes available for CPU team");
        return;
    }
    
    var teamBSprites = getTeamSprites("teamB");
    
    for (var slot = 0; slot < teamBSprites.length && availableSubs.length > 0; slot++) {
        var player = teamBSprites[slot];
        if (!player || !player.playerData) continue;
        
        var playerTurbo = player.playerData.turbo || 0;
        
        // Substitute if turbo is below threshold
        if (playerTurbo < turboThreshold) {
            // Pick the first available substitute
            var benchEntry = availableSubs[0];
            
            debugLog("[CPU SUBS] Substituting " + (player.playerData.name || "CPU Player") + 
                     " (turbo: " + playerTurbo + ") with bench index " + benchEntry.benchIndex);
            
            var result = performSubstitution("teamB", slot, benchEntry.benchIndex, systems);
            
            if (result.success) {
                debugLog("[CPU SUBS] Substitution successful: " + 
                         (result.newPlayer ? result.newPlayer.name : "New player") + " enters");
                
                // Refresh available subs list since one was used
                availableSubs = getAvailableSubstitutes("teamB", systems);
            } else {
                debugLog("[CPU SUBS] Substitution failed: " + result.message);
            }
        }
    }
    
    // Also reset heat streaks for remaining players (legacy behavior)
    for (var i = 0; i < teamBSprites.length; i++) {
        var p = teamBSprites[i];
        if (p && p.playerData) {
            p.playerData.heatStreak = 0;
            p.playerData.fireMakeStreak = 0;
        }
    }
}

