// halftime.js - Halftime and Substitution Screen functionality
// Handles mid-game break, statistics display, and player substitution interface

/**
 * Display halftime screen with current score and team statistics
 * Provides options for player substitutions or continuing to second half
 * Handles both player-controlled games and CPU-only auto-advance
 * @param {Object} systems - Systems object for state management
 */
function showHalftimeScreen(systems) {
    debugLog("[HALFTIME] === showHalftimeScreen() CALLED ===");
    var stateManager = systems.stateManager;

    debugLog("[HALFTIME] Coordinator check: " + !!(mpCoordinator && mpCoordinator.isCoordinator));
    debugLog("[HALFTIME] allCPUMode: " + stateManager.get('allCPUMode'));

    stateManager.set("isHalftime", true, "halftime_start");

    // MULTIPLAYER: Broadcast halftime event to all clients
    if (mpCoordinator && mpCoordinator.isCoordinator) {
        debugLog("[HALFTIME] Coordinator broadcasting halftime event");
        var currentHalf = stateManager.get('currentHalf');
        var score = stateManager.get('score');
        var timeRemaining = stateManager.get('timeRemaining');
        mpCoordinator.broadcastGameState({
            type: 'halftime_start',
            currentHalf: currentHalf,
            teamAScore: score.teamA,
            teamBScore: score.teamB,
            timeRemaining: timeRemaining,
            timestamp: Date.now()
        });
    }

    debugLog("[HALFTIME] Rendering halftime screen...");
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

    courtFrame.center("\r\n\1h[S]\1n Substitutions  \1h[SPACE]\1n Continue to 2nd Half\r\n");

    if (typeof Sprite !== "undefined" && typeof Sprite.cycle === "function") {
        Sprite.cycle();
    }
    cycleFrame(courtFrame);

    // Wait for user input (auto-advance for CPU-only games)
    var halftimeStart = Date.now();
    var allCPUMode = stateManager.get('allCPUMode');
    var autoAdvance = !!allCPUMode;
    
    debugLog("[HALFTIME] Entering input loop, autoAdvance=" + autoAdvance);
    var lastHeartbeat = Date.now();
    
    while (true) {
        var key = console.inkey(K_NONE, 100);

        if (key && key.length > 0) {
            debugLog("[HALFTIME] Key pressed: " + key.toUpperCase());
            var keyUpper = key.toUpperCase();
            if (keyUpper === 'S') {
                // Show substitution screen
                if (showSubstitutionScreen(systems)) {
                    break; // User made substitutions and wants to continue
                }
            } else if (key === ' ') {
                debugLog("[HALFTIME] SPACE pressed, exiting halftime");
                break; // Continue to second half
            } else if (keyUpper === 'Q') {
                debugLog("[HALFTIME] Q pressed, quitting game");
                stateManager.set('gameRunning', false, 'user_quit_halftime');
                return;
            }
        } else if (autoAdvance && (Date.now() - halftimeStart) >= 10000) {
            debugLog("[HALFTIME] Auto-advance triggered after 10 seconds");
            break; // Auto-continue for CPU games after 10 seconds
        }
        
        // Periodic heartbeat log
        if ((Date.now() - lastHeartbeat) >= 2000) {
            debugLog("[HALFTIME] Still waiting for input, elapsed: " + (Date.now() - halftimeStart) + "ms");
            lastHeartbeat = Date.now();
        }
    }

    debugLog("[HALFTIME] Exiting halftime screen");

    // Prepare for second half
    stateManager.set("isHalftime", false, "halftime_end");
    // Don't reset timeRemaining - let it continue counting down from current time

    stateManager.set("pendingSecondHalfInbound", true, "halftime_end");
    stateManager.set("secondHalfInitDone", false, "halftime_end");

    // CPU substitutions (simple random)
    performCPUSubstitutions();

    var teamNames = stateManager.get('teamNames');
    var currentTeam = stateManager.get('currentTeam');
    announceEvent("tipoff", {
        teamA: (teamNames.teamA || "TEAM A").toUpperCase(),
        teamB: (teamNames.teamB || "TEAM B").toUpperCase(),
        team: currentTeam
    }, systems);

    // Coordinator: Skip blocking wait
    if (!(mpCoordinator && mpCoordinator.isCoordinator)) {
        mswait(1500);
    }
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
