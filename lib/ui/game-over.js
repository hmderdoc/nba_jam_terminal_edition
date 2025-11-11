// game-over.js - Game Over and Box Score display functionality
// Handles end-of-game presentation including winner announcement and detailed statistics

// Box score column definitions
var BOX_SCORE_COLUMNS = [
    { key: "fgm", label: "FGM" },
    { key: "fga", label: "FGA" },
    { key: "tpm", label: "3PM" },
    { key: "tpa", label: "3PA" },
    { key: "points", label: "PTS" },
    { key: "assists", label: "AST" },
    { key: "steals", label: "STL" },
    { key: "rebounds", label: "REB" },
    { key: "blocks", label: "BLK" },
    { key: "dunks", label: "DNK" },
    { key: "turnovers", label: "TO", skipLeader: true },
    { key: "injuryCount", label: "INJ", isRaw: true, skipLeader: true }
];

/**
 * Position player sprites for box score display
 * Arranges sprites in corners for clean stats presentation
 */
function positionSpritesForBoxScore(systems) {
    var stateManager = systems.stateManager;
    var marginX = 2;
    var spriteWidth = 5;
    var leftX = clampToCourtX(marginX);
    // Move right-side players further right to avoid covering injury stats (no clamping needed for scoreboard)
    var rightX = COURT_WIDTH - spriteWidth;
    var topYPrimary = clampToCourtY(3);
    var topYSecondary = clampToCourtY(6);
    var bottomYPrimary = clampToCourtY(COURT_HEIGHT - 8);
    var bottomYSecondary = clampToCourtY(COURT_HEIGHT - 5);

    var teamAPlayer1 = spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_1);
    var teamAPlayer2 = spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_2);
    var teamBPlayer1 = spriteRegistry.get(spriteRegistry.IDS.TEAM_B_PLAYER_1);
    var teamBPlayer2 = spriteRegistry.get(spriteRegistry.IDS.TEAM_B_PLAYER_2);

    if (teamAPlayer1 && typeof teamAPlayer1.moveTo === "function") {
        teamAPlayer1.moveTo(leftX, topYPrimary);
        renderPlayerLabel(teamAPlayer1, { highlightCarrier: false, forceTop: true }, systems);
    }
    if (teamAPlayer2 && typeof teamAPlayer2.moveTo === "function") {
        teamAPlayer2.moveTo(rightX, topYSecondary);
        renderPlayerLabel(teamAPlayer2, { highlightCarrier: false, forceTop: true }, systems);
    }
    if (teamBPlayer1 && typeof teamBPlayer1.moveTo === "function") {
        teamBPlayer1.moveTo(leftX, bottomYPrimary);
        renderPlayerLabel(teamBPlayer1, { highlightCarrier: false, forceTop: true }, systems);
    }
    if (teamBPlayer2 && typeof teamBPlayer2.moveTo === "function") {
        teamBPlayer2.moveTo(rightX, bottomYSecondary);
        renderPlayerLabel(teamBPlayer2, { highlightCarrier: false, forceTop: true }, systems);
    }
    if (typeof moveBallFrameTo === "function") {
        var ballX = COURT_WIDTH - 2;
        var ballY = 2;
        var safeX = clamp(ballX, 1, COURT_WIDTH);
        var safeY = clamp(ballY, 1, COURT_HEIGHT);
        moveBallFrameTo(safeX, safeY);
        stateManager.set('ballX', safeX, 'game_over_ball_position');
        stateManager.set('ballY', safeY, 'game_over_ball_position');
    }
}

/**
 * Collect global stat leaders across all players
 * Returns object mapping stat keys to max values for highlighting
 */
function collectGlobalStatLeaders() {
    var leaders = {};
    var allPlayers = getAllPlayers();
    for (var c = 0; c < BOX_SCORE_COLUMNS.length; c++) {
        var column = BOX_SCORE_COLUMNS[c];
        var key = column.key;
        var maxValue = -Infinity;

        // For negative stats like turnovers and injuries, we want to track the highest value
        var isNegativeStat = (key === "turnovers" || key === "injuryCount");

        for (var i = 0; i < allPlayers.length; i++) {
            var player = allPlayers[i];
            if (!player || !player.playerData) continue;

            var value;
            if (column.isRaw) {
                value = player.playerData[key] || 0;
            } else {
                var stats = player.playerData.stats || {};
                value = stats[key] || 0;
            }

            if (value > maxValue) {
                maxValue = value;
            }
        }
        leaders[key] = { max: maxValue, isNegative: isNegativeStat };
    }
    return leaders;
}

/**
 * Render box score for a single team
 * Displays detailed statistics for all players on the team with leader highlighting
 * 
 * @param {string} teamKey - "teamA" or "teamB"
 * @param {string} teamLabel - Display name for the team
 * @param {object} options - Display options (currently unused but reserved for future features)
 * @param {Object} systems - Systems object for state management
 */
function renderTeamBoxScore(teamKey, teamLabel, options, systems) {
    var stateManager = systems.stateManager;
    var players = getTeamSprites(teamKey);
    var teamColors = stateManager.get('teamColors');
    var teamColorInfo = teamColors[teamKey] || {};
    var headerColor = teamColorInfo.fg_accent_code || teamColorInfo.fg_code || "\1h\1w";
    var jerseyColor = teamColorInfo.fg_code || "\1h\1w";
    var whiteCode = "\1h\1w";

    var leaders = collectGlobalStatLeaders();

    courtFrame.center(headerColor + teamLabel.toUpperCase() + " BOX SCORE\1n\r\n");
    var headerLine = "PLAYER             ";
    for (var c = 0; c < BOX_SCORE_COLUMNS.length; c++) {
        var col = BOX_SCORE_COLUMNS[c];
        headerLine += padStart(col.label, 4, " ");
    }
    courtFrame.center(whiteCode + headerLine + "\1n\r\n");

    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        if (!player || !player.playerData) continue;

        var data = player.playerData;
        var stats = data.stats || {};
        var jersey = padStart(data.jersey, 2, "0");
        var name = getLastName(data.name || "");
        var nameBase = padEnd(("#" + jersey + " " + name).toUpperCase(), 18, " ");
        var displayName = jerseyColor + nameBase.substring(0, 3) + whiteCode + nameBase.substring(3);
        var line = whiteCode + displayName;

        for (var c = 0; c < BOX_SCORE_COLUMNS.length; c++) {
            var column = BOX_SCORE_COLUMNS[c];
            var key = column.key;
            var rawValue;
            if (column.isRaw) {
                rawValue = data[key] || 0;
            } else {
                rawValue = stats[key] || 0;
            }
            var valueStr = padStart(rawValue, 4, " ");

            var attrCode = whiteCode;
            var leaderInfo = leaders[key];
            if (leaderInfo && rawValue > 0 && rawValue === leaderInfo.max) {
                if (leaderInfo.isNegative) {
                    // Highlight negative stats (turnovers, injuries) in LIGHTRED
                    attrCode = "\1h\1r";
                } else if (!column.skipLeader) {
                    // Highlight positive stats in bright green
                    attrCode = "\1h\1g";
                }
            }

            line += attrCode + valueStr;
        }
        line += "\1n";
        courtFrame.center(line + "\r\n");
    }
}

/**
 * Display game over screen with final box scores and options
 * Wave 24: Non-blocking with multiplayer vote tallying
 * 
 * @param {boolean} isDemoMode - True for demo mode auto-restart, false for player choice
 * @param {object} systems - System dependencies
 * @param {Object} mpScreenCoordinator - Screen coordinator for multiplayer (optional)
 * @param {string} myPlayerId - Current player's global ID for voting (optional)
 * @param {Object} coordinator - Full coordinator object for state broadcasting (optional)
 * @returns {string} User choice: "playagain", "newteams", "quit", or "newdemo"
 */
function showGameOver(isDemoMode, systems, mpScreenCoordinator, myPlayerId, coordinator) {
    debugLog("[GAME OVER] === showGameOver() CALLED ===");
    debugLog("[GAME OVER] Parameters: mpScreenCoordinator=" + (mpScreenCoordinator ? "EXISTS" : "NULL") + ", myPlayerId=" + myPlayerId);
    var stateManager = systems.stateManager;
    var isMultiplayer = !!(mpScreenCoordinator);
    var isCoordinator = !!(mpScreenCoordinator && mpScreenCoordinator.coordinator && mpScreenCoordinator.coordinator.isCoordinator);

    // Render initial display
    renderGameOverDisplay(isDemoMode, isMultiplayer, systems);

    // COORDINATOR: Enter screen state for multiplayer
    if (isMultiplayer && isCoordinator && !isDemoMode) {
        var teamNames = stateManager.get('teamNames');
        var score = stateManager.get('score');

        mpScreenCoordinator.enterScreen("game_over", {
            teamAName: teamNames.teamA,
            teamBName: teamNames.teamB,
            teamAScore: score.teamA,
            teamBScore: score.teamB
        }, 120000); // 120-second timeout (2 minutes)

        debugLog("[GAME OVER] Coordinator entered screen state");
    }

    if (isDemoMode) {
        // Demo mode: wait 15 seconds or until user presses Q
        var startTime = Date.now();
        var timeoutMs = 15000; // 15 seconds

        while (Date.now() - startTime < timeoutMs) {
            var key = console.inkey(K_NONE, 100);
            if (key && key.toUpperCase() === 'Q') {
                return "quit";
            }
        }
        return "newdemo"; // Start new demo
    } else {
        // Player mode: Vote tallying in multiplayer, immediate in single-player
        var localChoice = null;
        var lastRender = 0;

        while (true) {
            // Check for multiplayer dismissal signal
            if (isMultiplayer) {
                var mpScreenAction = stateManager.get("mpScreenAction");

                if (mpScreenAction && mpScreenAction.action === "dismiss" && mpScreenAction.screen === "game_over") {
                    debugLog("[GAME OVER] Received dismissal signal from coordinator");
                    stateManager.set("mpScreenAction", null, "game_over_dismiss_handled");

                    // Tally votes and return winning choice
                    if (isCoordinator) {
                        var winningChoice = mpScreenCoordinator.tallyGameOverVotes();
                        debugLog("[GAME OVER] Winning choice: " + winningChoice);

                        // Map to expected return values
                        if (winningChoice === "quit") return "quit";
                        if (winningChoice === "play_again") return "playagain";
                        if (winningChoice === "new_teams") return "newteams";
                        return "quit"; // Fallback
                    } else {
                        // Non-coordinator: Return local choice (coordinator's tally wins anyway)
                        return localChoice || "quit";
                    }
                }

                // Coordinator: Check if can dismiss
                if (isCoordinator && mpScreenCoordinator.canDismiss()) {
                    debugLog("[GAME OVER] Coordinator dismissing screen");
                    mpScreenCoordinator.dismissScreen();

                    var winningChoice = mpScreenCoordinator.tallyGameOverVotes();
                    debugLog("[GAME OVER] Winning choice: " + winningChoice);

                    if (winningChoice === "quit") return "quit";
                    if (winningChoice === "play_again") return "playagain";
                    if (winningChoice === "new_teams") return "newteams";
                    return "quit";
                }

                // Re-render vote indicators periodically
                if (Date.now() - lastRender >= 500) {
                    renderGameOverVoteIndicators(systems, mpScreenCoordinator);
                    lastRender = Date.now();
                }
            }

            var key = isMultiplayer ? console.inkey(K_NONE, 100) : console.getkey();
            if (!key) continue;

            var keyUpper = key.toUpperCase();

            // Handle vote in multiplayer
            if (isMultiplayer && !localChoice) {
                var choice = null;
                if (key === ' ') {
                    choice = "play_again";
                } else if (keyUpper === 'T' || keyUpper === 'N') {
                    choice = "new_teams";
                } else if (keyUpper === 'Q') {
                    choice = "quit";
                }

                if (choice) {
                    debugLog("[GAME OVER] Local player voting: " + choice);
                    mpScreenCoordinator.setReady(myPlayerId, choice);
                    localChoice = choice;
                    renderGameOverDisplay(isDemoMode, isMultiplayer, systems);
                    renderGameOverVoteIndicators(systems, mpScreenCoordinator);
                }
            } else if (isMultiplayer && localChoice && keyUpper === 'Q') {
                // Emergency exit: Q pressed again after voting (force quit)
                debugLog("[GAME OVER] EMERGENCY EXIT - Q pressed after voting");
                throw new Error("User forced quit from game over screen");
            } else if (!isMultiplayer) {
                // Single-player: immediate return
                if (key === ' ') {
                    return "playagain";
                } else if (keyUpper === 'T') {
                    return "newteams";
                } else if (keyUpper === 'Q') {
                    return "quit";
                }
            }

            // Coordinator: Keep state sync active
            if (isCoordinator && coordinator && coordinator.update) {
                coordinator.update();
            }
        }
    }
}

/**
 * Render game over display (separated for re-rendering with vote indicators)
 * @param {boolean} isDemoMode - Demo mode flag
 * @param {boolean} isMultiplayer - Multiplayer flag
 * @param {Object} systems - Systems object
 */
function renderGameOverDisplay(isDemoMode, isMultiplayer, systems) {
    var stateManager = systems.stateManager;

    courtFrame.clear();
    positionSpritesForBoxScore(systems);
    courtFrame.gotoxy(1, 1);

    courtFrame.center("\r\n\r\n");
    courtFrame.center("\1h\1y GAME OVER\1n\r\n\r\n");

    var teamNames = stateManager.get('teamNames');
    var teamColors = stateManager.get('teamColors');
    var teamAName = teamNames && teamNames.teamA ? teamNames.teamA : "TEAM A";
    var teamBName = teamNames && teamNames.teamB ? teamNames.teamB : "TEAM B";
    var teamAColorCode = teamColors.teamA.fg_accent_code || teamColors.teamA.fg_code || "\1h\1w";
    var teamBColorCode = teamColors.teamB.fg_accent_code || teamColors.teamB.fg_code || "\1h\1w";
    var whiteCode = "\1h\1w";

    var score = stateManager.get('score');
    if (score.teamA > score.teamB) {
        courtFrame.center(teamAColorCode + " " + teamAName.toUpperCase() + " WIN!\1n\r\n");
    } else if (score.teamB > score.teamA) {
        courtFrame.center(teamBColorCode + " " + teamBName.toUpperCase() + " WIN!\1n\r\n");
    } else {
        courtFrame.center("\1h\1yTIE GAME!\1n\r\n");
    }

    courtFrame.center("\r\n");
    courtFrame.center(
        whiteCode + "Final Score: " +
        teamAColorCode + teamAName + " " + score.teamA +
        whiteCode + " - " +
        teamBColorCode + teamBName + " " + score.teamB +
        "\1n\r\n"
    );
    courtFrame.center("\r\n");

    renderTeamBoxScore("teamA", teamAName, { halftime: false }, systems);
    courtFrame.center("\r\n");
    renderTeamBoxScore("teamB", teamBName, { halftime: false }, systems);

    if (isDemoMode) {
        courtFrame.center("\r\n\1hStarting new demo in 15 seconds...\1n\r\n");
        courtFrame.center("\1h[Q]\1n Quit to Menu\r\n");
    } else if (isMultiplayer) {
        courtFrame.center("\r\n\1h[SPACE]\1n Play Again  \1h[N]\1n New Teams  \1h[Q]\1n Quit\r\n");
    } else {
        courtFrame.center("\r\n\1h[SPACE]\1n Play Again  \1h[T]\1n New Teams  \1h[Q]\1n Quit to Menu\r\n");
    }

    if (typeof Sprite !== "undefined" && typeof Sprite.cycle === "function") {
        Sprite.cycle();
    }
    cycleFrame(courtFrame);
}

/**
 * Render vote indicators for multiplayer (vote counts + countdown)
 * @param {Object} systems - Systems object
 * @param {Object} mpScreenCoordinator - Screen coordinator
 */
function renderGameOverVoteIndicators(systems, mpScreenCoordinator) {
    if (!mpScreenCoordinator || !mpScreenCoordinator.isScreenActive("game_over")) return;

    var readyStatus = mpScreenCoordinator.getReadyStatus();
    var timeRemaining = mpScreenCoordinator.getTimeRemaining();

    // Show vote tally
    var choices = mpScreenCoordinator.playerChoices || {};
    var quitVotes = 0;
    var playVotes = 0;
    var teamsVotes = 0;

    for (var playerId in choices) {
        if (choices.hasOwnProperty(playerId)) {
            var choice = choices[playerId];
            if (choice === "quit") quitVotes++;
            else if (choice === "play_again") playVotes++;
            else if (choice === "new_teams") teamsVotes++;
        }
    }

    courtFrame.center("\r\n\1h\1gVotes - Quit:" + quitVotes + " Play:" + playVotes +
        " NewTeams:" + teamsVotes + "  \1h\1yTime: " +
        timeRemaining + "s\1n\r\n");

    cycleFrame(courtFrame);
}
