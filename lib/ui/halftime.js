// halftime.js - Halftime and Substitution Screen functionality
// Handles mid-game break, statistics display, and player substitution interface

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

    // COORDINATOR: Enter screen state
    if (isMultiplayer && isCoordinator) {
        var score = stateManager.get('score');
        var teamNames = stateManager.get('teamNames');

        mpScreenCoordinator.enterScreen("halftime", {
            teamAName: teamNames.teamA,
            teamBName: teamNames.teamB,
            teamAScore: score.teamA,
            teamBScore: score.teamB
        }, allCPUMode ? 10000 : 60000); // 10s for CPU, 60s for player

        debugLog("[HALFTIME] Coordinator entered screen state");
    }

    // Render halftime screen
    renderHalftimeDisplay(systems);

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
                renderHalftimeReadyIndicators(systems, mpScreenCoordinator);
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
                    renderHalftimeDisplay(systems); // Update display
                    renderHalftimeReadyIndicators(systems, mpScreenCoordinator);
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

    // CPU substitutions
    performCPUSubstitutions();

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
 */
function renderHalftimeDisplay(systems) {
    var stateManager = systems.stateManager;

    positionSpritesForBoxScore(systems);
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

    courtFrame.center("\r\n\1h[SPACE]\1n Continue to 2nd Half  \1h[Q]\1n Quit\r\n");

    if (typeof Sprite !== "undefined" && typeof Sprite.cycle === "function") {
        Sprite.cycle();
    }
    cycleFrame(courtFrame);
}

/**
 * Render ready indicators for multiplayer (checkmarks + countdown)
 * @param {Object} systems - Systems object
 * @param {Object} mpScreenCoordinator - Screen coordinator
 */
function renderHalftimeReadyIndicators(systems, mpScreenCoordinator) {
    if (!mpScreenCoordinator || !mpScreenCoordinator.isScreenActive("halftime")) return;

    var readyStatus = mpScreenCoordinator.getReadyStatus();
    var timeRemaining = mpScreenCoordinator.getTimeRemaining();

    // Clear last line and show ready status
    courtFrame.center("\r\n\1h\1gReady: " + readyStatus.readyCount + "/" +
        readyStatus.totalPlayers + "  \1h\1yTime: " +
        timeRemaining + "s\1n\r\n");

    cycleFrame(courtFrame);
}

/**
 * Render halftime statistics for a single team
 * Shows basic stats for each player on the team
 * 
 * @param {string} teamKey - "teamA" or "teamB"
 * @param {Object} systems - Systems object for state management
 */
function renderHalftimeStats(teamKey, systems) {
    var stateManager = systems.stateManager;
    var players = getTeamSprites(teamKey);
    var teamColors = stateManager.get('teamColors');
    var teamColorInfo = teamColors[teamKey] || {};
    var jerseyColor = teamColorInfo.fg_code || "\1h\1w";
    var whiteCode = "\1h\1w";

    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        if (!player || !player.playerData) continue;

        var data = player.playerData;
        var stats = data.stats || {};
        var name = getLastName(data.name || "");
        var nameDisplay = jerseyColor + "#" + data.jersey + " " + name + whiteCode;

        var statLine = nameDisplay + ": " + (stats.points || 0) + "pts, " +
            (stats.assists || 0) + "ast, " + (stats.rebounds || 0) + "reb";

        courtFrame.center(statLine + "\1n\r\n");
    }
}

/**
 * Display substitution screen interface
 * Currently shows placeholder for future player substitution feature
 * 
 * @param {Object} systems - Systems object for state management
 * @returns {boolean} True if user wants to continue, false if quitting
 */
function showSubstitutionScreen(systems) {
    var stateManager = systems.stateManager;
    // For now, just show a simple message - player substitution coming in future enhancement
    courtFrame.clear();
    courtFrame.center("\r\n\r\n\r\n");
    courtFrame.center("\1h\1y SUBSTITUTIONS \1n\r\n\r\n");
    courtFrame.center("Player substitutions will be available\r\n");
    courtFrame.center("in a future update!\r\n\r\n");
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

/**
 * Perform automatic CPU player substitutions at halftime
 * Simple logic: gives fresh legs (turbo reset) to underperforming players
 */
function performCPUSubstitutions() {
    // Simple CPU substitution logic - randomly substitute players with low performance
    var teamBTeam = getTeamSprites("teamB");
    for (var i = 0; i < teamBTeam.length; i++) {
        var player = teamBTeam[i];
        if (player && player.playerData && player.playerData.stats) {
            var stats = player.playerData.stats;
            var performance = (stats.points || 0) + (stats.assists || 0) + (stats.rebounds || 0);

            // 30% chance to substitute if performance is low
            if (performance < 5 && Math.random() < 0.3) {
                // For now, just reset their turbo (simulation of fresh legs)
                player.playerData.turbo = MAX_TURBO;
                player.playerData.heatStreak = 0;
                player.playerData.fireMakeStreak = 0;
            }
        }
    }
}
