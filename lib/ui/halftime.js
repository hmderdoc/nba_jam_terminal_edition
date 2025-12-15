// halftime.js - Halftime and Substitution Screen functionality
// Handles mid-game break, statistics display, and player substitution interface

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
                // Substitutions (single-player only for now)
                if (!isMultiplayer && showSubstitutionScreen(systems)) {
                    break;
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

    // Single-player: show instructions in court frame
    // Multiplayer: scoreboard frame handles this with countdown
    if (!isMultiplayer) {
        courtFrame.center("\r\n\1h[SPACE]\1n Continue to 2nd Half  \1h[Q]\1n Quit\r\n");
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
 * Shows current active players and available substitutes for human team (teamA)
 * 
 * @param {Object} systems - Systems object for state management
 * @returns {boolean} True if user wants to continue, false if quitting
 */
function showSubstitutionScreen(systems) {
    var stateManager = systems.stateManager;
    
    // Get available substitutes for human team (teamA)
    var availableSubs = getAvailableSubstitutes("teamA", systems);
    
    // Get current active players
    var activePlayer1 = getActivePlayerInfo("teamA", 0);
    var activePlayer2 = getActivePlayerInfo("teamA", 1);
    
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
        var currentSubs = getAvailableSubstitutes("teamA", systems);
        
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
                var currentSubs = getAvailableSubstitutes("teamA", systems);
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
                var currentSubs2 = getAvailableSubstitutes("teamA", systems);
                if (currentSubs2.length > 0) {
                    selectedBenchIndex = (selectedBenchIndex + 1) % currentSubs2.length;
                }
            }
            renderSubstitutionScreen();
        } else if (key === '\r' || key === '\n') {  // Enter
            if (phase === "select_active") {
                // Move to bench selection
                var currentSubs3 = getAvailableSubstitutes("teamA", systems);
                if (currentSubs3.length > 0) {
                    phase = "select_bench";
                    selectedBenchIndex = 0;
                    renderSubstitutionScreen();
                }
            } else {
                // Perform substitution
                var currentSubs4 = getAvailableSubstitutes("teamA", systems);
                if (selectedBenchIndex < currentSubs4.length) {
                    var benchEntry = currentSubs4[selectedBenchIndex];
                    var result = performSubstitution("teamA", selectedActiveSlot, benchEntry.benchIndex, systems);
                    
                    if (result.success) {
                        madeSubstitution = true;
                        // Refresh active player info after substitution
                        activePlayer1 = getActivePlayerInfo("teamA", 0);
                        activePlayer2 = getActivePlayerInfo("teamA", 1);
                        
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

