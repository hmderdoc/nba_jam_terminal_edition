// input-handler.js - Keyboard input processing for player controls
// Handles all user keyboard input during gameplay including movement, shooting, passing, and special actions

/**
 * Generic action button handler for multiplayer
 * Handles shooting on offense or blocking on defense
 * 
 * @param {Object} player - The player sprite to control
 * @param {Object} systems - The core game systems.
 * @param {Object} [options] - Optional parameters.
 * @param {boolean} [options.predictive=false] - If true, execute the action predictively on the client.
 */
function handleActionButton(player, systems, options) {
    if (!player || !player.playerData) return;
    if (player.playerData.stealRecoverFrames > 0) return;

    var stateManager = systems.stateManager;
    var currentTeam = stateManager.get('currentTeam');
    var ballCarrier = stateManager.get('ballCarrier');

    var playerTeam = getPlayerTeamName(player);
    if (!playerTeam) return;

    // DEFENSIVE GUARD: If this player is the ballCarrier, their team MUST be on offense
    // This catches state desync after halftime or other transitions
    if (ballCarrier === player && currentTeam !== playerTeam) {
        if (typeof debugLog === "function") {
            debugLog("[INPUT GUARD] BallCarrier/currentTeam mismatch! Correcting: " +
                "ballCarrier=" + (player.playerData ? player.playerData.name : "?") +
                " playerTeam=" + playerTeam + " currentTeam=" + currentTeam +
                " -> setting currentTeam to " + playerTeam);
        }
        stateManager.set("currentTeam", playerTeam, "ballcarrier_team_correction");
        currentTeam = playerTeam;
    }

    if (currentTeam === playerTeam && ballCarrier === player) {
        // Player has ball - attempt shot
        attemptShot(systems, options);
    } else if (currentTeam !== playerTeam) {
        // On defense - attempt block
        var defenderDir = null;
        if (ballCarrier) {
            defenderDir = ballCarrier.x >= player.x ? 1 : -1;
        }
        attemptBlock(player, { direction: defenderDir }, systems, options);
    }
}

/**
 * Generic secondary button handler for multiplayer
 * Handles passing on offense or stealing on defense
 * 
 * @param {Object} player - The player sprite to control
 */
function handleSecondaryButton(player, systems) {
    if (!player || !player.playerData) return;
    if (player.playerData.stealRecoverFrames > 0) return;

    var stateManager = systems.stateManager;
    var currentTeam = stateManager.get('currentTeam');
    var ballCarrier = stateManager.get('ballCarrier');

    var playerTeam = getPlayerTeamName(player);
    if (!playerTeam) return;

    if (currentTeam === playerTeam) {
        // On offense - pass to teammate
        var teammate = getPlayerTeammate(player);
        if (ballCarrier === player && teammate) {
            var leadTarget = getSmartPassTarget(player, teammate);
            animatePass(player, teammate, leadTarget, null, systems);
        } else if (ballCarrier === teammate && teammate) {
            var leadTarget = getSmartPassTarget(teammate, player);
            animatePass(teammate, player, leadTarget, null, systems);
        }
    } else {
        // On defense - attempt steal
        attemptUserSteal(player, systems);
    }
}

/**
 * Generic dribble button handler for multiplayer
 * Handles picking up dribble on offense or shaking on defense
 * 
 * @param {Object} player - The player sprite to control
 */
function handleDribbleButton(player, systems) {
    if (!player || !player.playerData) return;
    if (player.playerData.stealRecoverFrames > 0) return;

    var stateManager = systems.stateManager;
    var currentTeam = stateManager.get('currentTeam');
    var ballCarrier = stateManager.get('ballCarrier');

    var playerTeam = getPlayerTeamName(player);
    if (!playerTeam) return;

    if (currentTeam === playerTeam && ballCarrier === player) {
        pickUpDribble(player, "button", systems);
    } else if (currentTeam !== playerTeam) {
        attemptShake(player, systems);
    }
}

/**
 * Main keyboard input handler for single-player mode
 * Processes all user keyboard input and translates to game actions
 * 
 * @param {string} key - The key pressed by the user
 */
function handleInput(key, systems) {
    var stateManager = systems.stateManager;
    var gameState = stateManager.get();

    // Wave 24: Handle pause menu input (betting/spectate quit confirmation)
    if (stateManager.get("pauseMenuOpen")) {
        var upperKey = key.toUpperCase();
        if (upperKey === 'Y') {
            // Confirm quit - forfeit bet if applicable
            stateManager.set("pauseMenuOpen", false, "pause_quit_confirmed");
            stateManager.set("gameRunning", false, "user_quit_confirmed");
            stateManager.set("quitForfeited", true, "bet_forfeited");
        } else if (upperKey === 'N' || upperKey === 'Q') {
            // Cancel - resume game
            stateManager.set("pauseMenuOpen", false, "pause_cancelled");
        }
        return;
    }

    if (key.toUpperCase() === 'Q') {
        // Wave 24: If this is a betting/spectate game, show pause confirmation
        // instead of immediate quit (so player can't forfeit accidentally)
        var isBettingGame = stateManager.get("isBettingGame");
        var isSpectateMode = stateManager.get("allCPUMode");
        
        if (isBettingGame) {
            // Show pause menu with forfeit warning
            stateManager.set("pauseMenuOpen", true, "betting_quit_request");
            return;
        }
        
        // Normal quit for non-betting games
        stateManager.set("gameRunning", false, "user_quit");
        return;
    }

    var keyUpper = key.toUpperCase();

    if (keyUpper === 'M') {
        togglePossessionBeep(systems);
        return;
    }

    if (systems.jumpBallSystem && typeof systems.jumpBallSystem.isAwaitingUserJump === "function") {
        if (systems.jumpBallSystem.isAwaitingUserJump()) {
            if (key === ' ') {
                systems.jumpBallSystem.handleUserInput(Date.now(), systems);
            }
            return;
        }
    }

    var teamAPlayer1 = spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_1);
    var teamAPlayer2 = spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_2);
    var recovering = (teamAPlayer1 && teamAPlayer1.playerData && teamAPlayer1.playerData.stealRecoverFrames > 0);
    var stateManager = systems.stateManager;
    var currentTeam = stateManager.get('currentTeam');
    var ballCarrier = stateManager.get('ballCarrier');
    var reboundActive = stateManager.get('reboundActive');

    // DEFENSIVE GUARD: If teamA player is the ballCarrier, teamA MUST be on offense
    // This catches state desync after halftime or other transitions
    if (ballCarrier && (ballCarrier === teamAPlayer1 || ballCarrier === teamAPlayer2) && currentTeam !== "teamA") {
        if (typeof debugLog === "function") {
            debugLog("[KB INPUT GUARD] TeamA ballCarrier but currentTeam=" + currentTeam + " -> correcting to teamA");
        }
        stateManager.set("currentTeam", "teamA", "ballcarrier_team_correction");
        currentTeam = "teamA";
    }

    // Space bar - shoot on offense, block on defense
    if (key === ' ') {
        if (recovering) return;
        if (currentTeam === "teamA" && (ballCarrier === teamAPlayer1 || ballCarrier === teamAPlayer2)) {
            attemptShot(systems);
        } else {
            var defenderDir = null;
            if (ballCarrier) {
                defenderDir = ballCarrier.x >= teamAPlayer1.x ? 1 : -1;
            }
            attemptBlock(teamAPlayer1, {
                direction: defenderDir
            }, systems);
        }
        return;
    }

    // S key - pass to/from teammate OR steal (on defense)
    if (keyUpper === 'S') {
        if (recovering) return;
        if (currentTeam === "teamA" && ballCarrier === teamAPlayer1) {
            // Human has ball - pass to teammate
            var leadTarget = getSmartPassTarget(teamAPlayer1, teamAPlayer2);
            animatePass(teamAPlayer1, teamAPlayer2, leadTarget, null, systems);
        } else if (currentTeam === "teamA" && ballCarrier === teamAPlayer2) {
            // Teammate has ball - command them to pass back
            var leadTarget = getSmartPassTarget(teamAPlayer2, teamAPlayer1);
            animatePass(teamAPlayer2, teamAPlayer1, leadTarget, null, systems);
        } else if (currentTeam !== "teamA") {
            // On defense - attempt steal
            attemptUserSteal(teamAPlayer1, systems);
        }
        return;
    }

    if (keyUpper === 'D') {
        if (recovering) return;

        // REBOUND SCRAMBLE: Allow user to shove during rebounds
        if (reboundActive) {
            // Find closest opponent to shove
            var allPlayers = spriteRegistry.getAllPlayers();
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
                attemptShove(teamAPlayer1, closestOpponent, systems);
            }
            return;
        }

        // OFFENSE WITH BALL: Pick up dribble or shake
        if (currentTeam === "teamA" && ballCarrier === teamAPlayer1) {
            if (teamAPlayer1.playerData && teamAPlayer1.playerData.hasDribble !== false) {
                pickUpDribble(teamAPlayer1, "user", systems);
            } else {
                attemptShake(teamAPlayer1, systems);
            }
        }
        // OFFENSE WITHOUT BALL: Shove nearby defender to create space
        else if (currentTeam === "teamA" && ballCarrier !== teamAPlayer1) {
            // Find closest opponent to shove
            var allPlayers = spriteRegistry.getAllPlayers();
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
                attemptShove(teamAPlayer1, closestOpponent, systems);
            }
        }
        // DEFENSE: Shove ball carrier (or nearby opponent if not near ball)
        else {
            // Try to shove ball carrier first, or nearest opponent
            var target = ballCarrier;
            if (!target || getSpriteDistance(teamAPlayer1, target) > 2.5) {
                // Ball carrier too far - find closest opponent
                var allPlayers = spriteRegistry.getAllPlayers();
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
                attemptShove(teamAPlayer1, target, systems);
            }
        }
        return;
    }

    // Detect turbo (rapid repeated arrow key presses or numpad)
    var now = Date.now();
    
    // Map numpad keys (received as string characters) to movement
    var diagonalKey = null;
    var horizKey = null;
    var vertKey = null;
    var cardinalKey = null;
    
    // Diagonal numpad keys
    if (key === '7') {
        diagonalKey = '7';
        horizKey = KEY_LEFT;
        vertKey = KEY_UP;
    } else if (key === '9') {
        diagonalKey = '9';
        horizKey = KEY_RIGHT;
        vertKey = KEY_UP;
    } else if (key === '1') {
        diagonalKey = '1';
        horizKey = KEY_LEFT;
        vertKey = KEY_DOWN;
    } else if (key === '3') {
        diagonalKey = '3';
        horizKey = KEY_RIGHT;
        vertKey = KEY_DOWN;
    }
    // Cardinal numpad keys (map to arrow keys)
    else if (key === '8') {
        cardinalKey = KEY_UP;
    } else if (key === '2') {
        cardinalKey = KEY_DOWN;
    } else if (key === '4') {
        cardinalKey = KEY_LEFT;
    } else if (key === '6') {
        cardinalKey = KEY_RIGHT;
    }
    
    // Use cardinal numpad key if detected, otherwise use the actual key
    var effectiveKey = cardinalKey || key;
    
    var isArrowKey = (effectiveKey == KEY_UP || effectiveKey == KEY_DOWN || effectiveKey == KEY_LEFT || effectiveKey == KEY_RIGHT);
    var isMovementKey = isArrowKey || diagonalKey !== null;

    if (recovering && isMovementKey) {
        return;
    }
    
    // Debug: Log movement key detection
    if (isMovementKey && typeof debugLog === "function") {
        if (diagonalKey) {
            debugLog("[INPUT] Diagonal: " + diagonalKey);
        } else if (cardinalKey) {
            debugLog("[INPUT] Cardinal numpad: " + key);
        }
    }

    if (isMovementKey) {
        var lastKey = stateManager.get('lastKey');
        var lastKeyTime = stateManager.get('lastKeyTime');
        if (lastKey == key && (now - lastKeyTime) < TURBO_ACTIVATION_THRESHOLD) {
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
        stateManager.set("lastKey", key, "turbo_tracking");
        stateManager.set("lastKeyTime", now, "turbo_tracking");
    }

    // Always control teamAPlayer1 (human) - execute moves based on speed
    if (teamAPlayer1 && isMovementKey) {
        var budget = createMovementCounters(teamAPlayer1, false, systems);
        if (budget.moves > 0) {
            var counters = {
                horizontal: Math.max(0, budget.horizontal),
                vertical: Math.max(0, budget.vertical)
            };

            if (diagonalKey) {
                // Diagonal movement from numpad key
                for (var m = 0; m < budget.moves; m++) {
                    if (!applyDiagonalMovement(teamAPlayer1, horizKey, vertKey, counters)) break;
                }
            } else {
                // Cardinal (straight) movement - use effectiveKey to handle numpad
                for (var m = 0; m < budget.moves; m++) {
                    if (!applyMovementCommand(teamAPlayer1, effectiveKey, counters)) break;
                }
            }
        }
    } else if (teamAPlayer1 && !recovering) {
        // Non-movement keys (pass, shoot, etc)
        teamAPlayer1.getcmd(key);
    }
}