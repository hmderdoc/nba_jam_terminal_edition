// input-handler.js - Keyboard input processing for player controls
// Handles all user keyboard input during gameplay including movement, shooting, passing, and special actions

/**
 * Generic action button handler for multiplayer
 * Handles shooting on offense or blocking on defense
 * 
 * @param {Object} player - The player sprite to control
 */
function handleActionButton(player) {
    if (!player || !player.playerData) return;
    if (player.playerData.stealRecoverFrames > 0) return;

    var playerTeam = getPlayerTeamName(player);
    if (!playerTeam) return;

    if (gameState.currentTeam === playerTeam && gameState.ballCarrier === player) {
        // Player has ball - attempt shot
        attemptShot();
    } else if (gameState.currentTeam !== playerTeam) {
        // On defense - attempt block
        var defenderDir = null;
        if (gameState.ballCarrier) {
            defenderDir = gameState.ballCarrier.x >= player.x ? 1 : -1;
        }
        attemptBlock(player, { direction: defenderDir });
    }
}

/**
 * Generic secondary button handler for multiplayer
 * Handles passing on offense or stealing on defense
 * 
 * @param {Object} player - The player sprite to control
 */
function handleSecondaryButton(player) {
    if (!player || !player.playerData) return;
    if (player.playerData.stealRecoverFrames > 0) return;

    var playerTeam = getPlayerTeamName(player);
    if (!playerTeam) return;

    if (gameState.currentTeam === playerTeam) {
        // On offense - pass to teammate
        var teammate = getPlayerTeammate(player);
        if (gameState.ballCarrier === player && teammate) {
            animatePass(player, teammate);
        } else if (gameState.ballCarrier === teammate && teammate) {
            animatePass(teammate, player);
        }
    } else {
        // On defense - attempt steal
        attemptUserSteal(player);
    }
}

/**
 * Generic dribble button handler for multiplayer
 * Handles picking up dribble on offense or shaking on defense
 * 
 * @param {Object} player - The player sprite to control
 */
function handleDribbleButton(player) {
    if (!player || !player.playerData) return;
    if (player.playerData.stealRecoverFrames > 0) return;

    var playerTeam = getPlayerTeamName(player);
    if (!playerTeam) return;

    if (gameState.currentTeam === playerTeam && gameState.ballCarrier === player) {
        pickUpDribble(player);
    } else if (gameState.currentTeam !== playerTeam) {
        attemptShake(player);
    }
}

/**
 * Main keyboard input handler for single-player mode
 * Processes all user keyboard input and translates to game actions
 * 
 * @param {string} key - The key pressed by the user
 */
function handleInput(key) {
    if (key.toUpperCase() === 'Q') {
        gameState.gameRunning = false;
        return;
    }

    var keyUpper = key.toUpperCase();

    if (keyUpper === 'M') {
        togglePossessionBeep();
        return;
    }

    var recovering = (teamAPlayer1 && teamAPlayer1.playerData && teamAPlayer1.playerData.stealRecoverFrames > 0);

    // Space bar - shoot on offense, block on defense
    if (key === ' ') {
        if (recovering) return;
        if (gameState.currentTeam === "teamA" && (gameState.ballCarrier === teamAPlayer1 || gameState.ballCarrier === teamAPlayer2)) {
            attemptShot();
        } else {
            var defenderDir = null;
            if (gameState.ballCarrier) {
                defenderDir = gameState.ballCarrier.x >= teamAPlayer1.x ? 1 : -1;
            }
            attemptBlock(teamAPlayer1, {
                direction: defenderDir
            });
        }
        return;
    }

    // S key - pass to/from teammate OR steal (on defense)
    if (keyUpper === 'S') {
        if (recovering) return;
        if (gameState.currentTeam === "teamA" && gameState.ballCarrier === teamAPlayer1) {
            // Human has ball - pass to teammate
            animatePass(teamAPlayer1, teamAPlayer2);
        } else if (gameState.currentTeam === "teamA" && gameState.ballCarrier === teamAPlayer2) {
            // Teammate has ball - command them to pass back
            animatePass(teamAPlayer2, teamAPlayer1);
        } else if (gameState.currentTeam !== "teamA") {
            // On defense - attempt steal
            attemptUserSteal(teamAPlayer1);
        }
        return;
    }

    if (keyUpper === 'D') {
        if (recovering) return;

        // REBOUND SCRAMBLE: Allow user to shove during rebounds
        if (gameState.reboundActive) {
            // Find closest opponent to shove
            var allPlayers = [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
            var closestOpponent = null;
            var closestDist = 999;

            for (var i = 0; i < allPlayers.length; i++) {
                var other = allPlayers[i];
                if (!other || other === teamAPlayer1) continue;
                var otherTeam = getPlayerTeamName(other);
                if (otherTeam === "teamA") continue; // Skip teammate

                var dist = getSpriteDistance(teamAPlayer1, other);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestOpponent = other;
                }
            }

            if (closestOpponent) {
                attemptShove(teamAPlayer1, closestOpponent);
            }
            return;
        }

        // OFFENSE WITH BALL: Pick up dribble or shake
        if (gameState.currentTeam === "teamA" && gameState.ballCarrier === teamAPlayer1) {
            if (teamAPlayer1.playerData && teamAPlayer1.playerData.hasDribble !== false) {
                pickUpDribble(teamAPlayer1, "user");
            } else {
                attemptShake(teamAPlayer1);
            }
        }
        // OFFENSE WITHOUT BALL: Shove nearby defender to create space
        else if (gameState.currentTeam === "teamA" && gameState.ballCarrier !== teamAPlayer1) {
            // Find closest opponent to shove
            var allPlayers = [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
            var closestOpponent = null;
            var closestDist = 999;

            for (var i = 0; i < allPlayers.length; i++) {
                var other = allPlayers[i];
                if (!other || other === teamAPlayer1) continue;
                var otherTeam = getPlayerTeamName(other);
                if (otherTeam === "teamA") continue; // Skip teammate

                var dist = getSpriteDistance(teamAPlayer1, other);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestOpponent = other;
                }
            }

            if (closestOpponent) {
                attemptShove(teamAPlayer1, closestOpponent);
            }
        }
        // DEFENSE: Shove ball carrier (or nearby opponent if not near ball)
        else {
            // Try to shove ball carrier first, or nearest opponent
            var target = gameState.ballCarrier;
            if (!target || getSpriteDistance(teamAPlayer1, target) > 2.5) {
                // Ball carrier too far - find closest opponent
                var allPlayers = [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
                var closestOpponent = null;
                var closestDist = 999;

                for (var i = 0; i < allPlayers.length; i++) {
                    var other = allPlayers[i];
                    if (!other || other === teamAPlayer1) continue;
                    var otherTeam = getPlayerTeamName(other);
                    if (otherTeam === "teamA") continue; // Skip teammate

                    var dist = getSpriteDistance(teamAPlayer1, other);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestOpponent = other;
                    }
                }

                if (closestOpponent) {
                    target = closestOpponent;
                }
            }

            if (target) {
                attemptShove(teamAPlayer1, target);
            }
        }
        return;
    }

    // Detect turbo (rapid repeated arrow key presses)
    var now = Date.now();
    var isArrowKey = (key == KEY_UP || key == KEY_DOWN || key == KEY_LEFT || key == KEY_RIGHT);

    if (recovering && isArrowKey) {
        return;
    }

    if (isArrowKey) {
        if (gameState.lastKey == key && (now - gameState.lastKeyTime) < TURBO_ACTIVATION_THRESHOLD) {
            // Turbo activated!
            if (teamAPlayer1 && teamAPlayer1.playerData && teamAPlayer1.playerData.turbo > 0) {
                teamAPlayer1.playerData.turboActive = true;
                teamAPlayer1.playerData.useTurbo(TURBO_DRAIN_RATE);
            }
        } else {
            // Turn off turbo
            if (teamAPlayer1 && teamAPlayer1.playerData) {
                teamAPlayer1.playerData.turboActive = false;
            }
        }
        gameState.lastKey = key;
        gameState.lastKeyTime = now;
    }

        // Always control teamAPlayer1 (human) - execute moves based on speed
    if (teamAPlayer1 && isArrowKey) {
        var budget = createMovementCounters(teamAPlayer1);
        if (budget.moves > 0) {
            var counters = {
                horizontal: Math.max(0, budget.horizontal),
                vertical: Math.max(0, budget.vertical),
                diagonalMoves: Math.max(0, budget.diagonalMoves)
            };
            
            // Track current key state for diagonal detection
            if (!gameState.pressedKeys) gameState.pressedKeys = {};
            gameState.pressedKeys[key] = now;
            
            // Clean up old key presses (keys released over 100ms ago)
            for (var k in gameState.pressedKeys) {
                if (gameState.pressedKeys.hasOwnProperty(k)) {
                    if (now - gameState.pressedKeys[k] > 100) {
                        delete gameState.pressedKeys[k];
                    }
                }
            }
            
            // Check for diagonal movement (both horizontal AND vertical keys pressed recently)
            var hasHorizontal = gameState.pressedKeys[KEY_LEFT] || gameState.pressedKeys[KEY_RIGHT];
            var hasVertical = gameState.pressedKeys[KEY_UP] || gameState.pressedKeys[KEY_DOWN];
            var isDiagonal = hasHorizontal && hasVertical;
            
            if (isDiagonal) {
                // Diagonal movement - use normalized diagonal moves counter
                // This limits movement to √2 normalization (about 70.7% of combined speed)
                var horizKey = gameState.pressedKeys[KEY_LEFT] ? KEY_LEFT : KEY_RIGHT;
                var vertKey = gameState.pressedKeys[KEY_UP] ? KEY_UP : KEY_DOWN;
                
                for (var m = 0; m < counters.diagonalMoves; m++) {
                    if (!applyDiagonalMovement(teamAPlayer1, horizKey, vertKey, counters)) break;
                }
            } else {
                // Cardinal (straight) movement - normal speed
                for (var m = 0; m < budget.moves; m++) {
                    if (!applyMovementCommand(teamAPlayer1, key, counters)) break;
                }
            }
        }
    } else if (teamAPlayer1 && !recovering) {
        // Non-movement keys (pass, shoot, etc)
        teamAPlayer1.getcmd(key);
    }
}


}