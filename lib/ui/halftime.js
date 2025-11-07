// halftime.js - Halftime and Substitution Screen functionality
// Handles mid-game break, statistics display, and player substitution interface

/**
 * Display halftime screen with current score and team statistics
 * Provides options for player substitutions or continuing to second half
 * Handles both player-controlled games and CPU-only auto-advance
 */
function showHalftimeScreen() {
    gameState.isHalftime = true;

    // MULTIPLAYER: Broadcast halftime event to all clients
    if (mpCoordinator && mpCoordinator.isCoordinator) {
        mpCoordinator.broadcastGameState({
            type: 'halftime_start',
            currentHalf: gameState.currentHalf,
            teamAScore: gameState.score.teamA,
            teamBScore: gameState.score.teamB,
            timeRemaining: gameState.timeRemaining,
            timestamp: Date.now()
        });
    }

    positionSpritesForBoxScore();
    courtFrame.clear();
    courtFrame.gotoxy(1, 1);

    var teamAName = gameState.teamNames.teamA;
    var teamBName = gameState.teamNames.teamB;
    var teamAColorCode = gameState.teamColors.teamA.fg_accent_code || gameState.teamColors.teamA.fg_code || "\1h\1w";
    var teamBColorCode = gameState.teamColors.teamB.fg_accent_code || gameState.teamColors.teamB.fg_code || "\1h\1w";
    var whiteCode = "\1h\1w";

    courtFrame.center("\r\n\r\n");
    courtFrame.center("\1h\1y HALFTIME \1n\r\n\r\n");

    // Show current score
    courtFrame.center(
        whiteCode + "Halftime Score: " +
        teamAColorCode + teamAName + " " + gameState.score.teamA +
        whiteCode + " - " +
        teamBColorCode + teamBName + " " + gameState.score.teamB +
        "\1n\r\n\r\n"
    );

    // Show halftime stats
    renderTeamBoxScore("teamA", teamAName, { halftime: true });
    courtFrame.center("\r\n");
    renderTeamBoxScore("teamB", teamBName, { halftime: true });

    courtFrame.center("\r\n\1h[S]\1n Substitutions  \1h[SPACE]\1n Continue to 2nd Half\r\n");

    if (typeof Sprite !== "undefined" && typeof Sprite.cycle === "function") {
        Sprite.cycle();
    }
    cycleFrame(courtFrame);

    // Wait for user input (auto-advance for CPU-only games)
    var halftimeStart = Date.now();
    var autoAdvance = !!gameState.allCPUMode;
    while (true) {
        var key = console.inkey(K_NONE, 100);

        if (key && key.length > 0) {
            var keyUpper = key.toUpperCase();
            if (keyUpper === 'S') {
                // Show substitution screen
                if (showSubstitutionScreen()) {
                    break; // User made substitutions and wants to continue
                }
            } else if (key === ' ') {
                break; // Continue to second half
            } else if (keyUpper === 'Q') {
                gameState.gameRunning = false;
                return;
            }
        } else if (autoAdvance && (Date.now() - halftimeStart) >= 10000) {
            break; // Auto-continue for CPU games after 10 seconds
        }
    }

    // Prepare for second half
    gameState.isHalftime = false;
    // Don't reset timeRemaining - let it continue counting down from current time

    gameState.pendingSecondHalfInbound = true;
    gameState.secondHalfInitDone = false;

    // CPU substitutions (simple random)
    performCPUSubstitutions();

    announceEvent("tipoff", {
        teamA: (gameState.teamNames.teamA || "TEAM A").toUpperCase(),
        teamB: (gameState.teamNames.teamB || "TEAM B").toUpperCase(),
        team: gameState.currentTeam
    });

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
 */
function renderHalftimeStats(teamKey) {
    var players = getTeamSprites(teamKey);
    var teamColorInfo = gameState.teamColors[teamKey] || {};
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
 * @returns {boolean} True if user wants to continue, false if quitting
 */
function showSubstitutionScreen() {
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
            gameState.gameRunning = false;
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
