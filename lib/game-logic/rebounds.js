/**
 * NBA JAM - Rebound System Module
 * 
 * Handles all rebound mechanics including:
 * - Rebound creation with bounce physics
 * - Non-blocking scramble state management
 * - Per-frame scramble updates with timeout logic
 * - Automatic shove attempts during scramble
 * - Rebound awards with possession changes
 * 
 * CRITICAL: This module isolates the rebound bug for debugging!
 * The bug appears to be related to scramble state management,
 * specifically around timing/timeout logic or possession assignment.
 * 
 * Key areas to investigate:
 * - Hard timeout (3 seconds) vs normal timeout (maxDuration)
 * - Distance threshold for securing rebound (< 4 units)
 * - Closest player calculation and tie-breaking
 * - Multiplayer coordinator vs client resolution logic
 * - Rebound scramble.active state clearing
 * 
 * Dependencies: game-state, player-class, constants
 */

load("lib/utils/debug-logger.js");

/**
 * Create rebound at specified position
 * Calculates bounce path, queues animation, starts non-blocking scramble state
 * 
 * BUG ZONE: Rebound creation and initial state setup
 * Check if: reboundX/Y are correctly clamped and set
 * Check if: scramble state is properly initialized
 */
function createRebound(x, y) {
    // Calculate final rebound position
    gameState.shotInProgress = false;
    gameState.reboundActive = true;

    debugLog("[REBOUND] createRebound() called at (" + x + "," + y + "), ballCarrier: " +
        (gameState.ballCarrier ? gameState.ballCarrier.playerData.name : "null"));

    var bounces = Math.random() < GAME_BALANCE.REBOUNDS.BOUNCE_PROBABILITY ? 1 : 2;
    var currentX = x;
    var currentY = y;

    for (var b = 0; b < bounces; b++) {
        var bounceX = currentX + (Math.random() * 8 - 4);
        var bounceY = currentY + (Math.random() * 6 - 3);
        bounceX = Math.max(x - 8, Math.min(x + 8, bounceX));
        bounceY = Math.max(y - 5, Math.min(y + 5, bounceY));
        currentX = bounceX;
        currentY = bounceY;
    }

    // Final resting position for rebound
    gameState.reboundX = currentX + (Math.random() * 4 - 2);
    gameState.reboundY = currentY + (Math.random() * 3 - 1);

    // Clamp to court boundaries
    gameState.reboundX = clamp(gameState.reboundX, 2, COURT_WIDTH - 2);
    gameState.reboundY = clamp(gameState.reboundY, 2, COURT_HEIGHT - 2);

    // Start non-blocking scramble state
    gameState.reboundScramble.active = true;
    gameState.reboundScramble.startTime = Date.now();
    gameState.reboundScramble.reboundX = gameState.reboundX;
    gameState.reboundScramble.reboundY = gameState.reboundY;
    gameState.reboundScramble.bounceAnimComplete = false;
    gameState.reboundScramble.anticipating = false;  // Clear anticipation, actual scramble started

    debugLog("[REBOUND] Scramble activated - reboundX: " + gameState.reboundX + ", reboundY: " + gameState.reboundY);

    // Calculate bounce path for animation
    var animBounces = [];
    var calcBounces = Math.random() < GAME_BALANCE.REBOUNDS.BOUNCE_PROBABILITY ? 1 : 2;
    currentX = x;
    currentY = y;

    for (var b = 0; b < calcBounces; b++) {
        var bounceX = currentX + (Math.random() * 8 - 4);
        var bounceY = currentY + (Math.random() * 6 - 3);
        bounceX = Math.max(x - 8, Math.min(x + 8, bounceX));
        bounceY = Math.max(y - 5, Math.min(y + 5, bounceY));

        animBounces.push({
            startX: currentX,
            startY: currentY,
            endX: bounceX,
            endY: bounceY
        });

        currentX = bounceX;
        currentY = bounceY;
    }

    // Final bounce to rebound position
    animBounces.push({
        startX: currentX,
        startY: currentY,
        endX: gameState.reboundX,
        endY: gameState.reboundY
    });

    // Queue non-blocking rebound animation
    if (animationSystem) {
        animationSystem.queueReboundAnimation(animBounces);
    }

    // Multiplayer coordinator: Broadcast event
    if (mpCoordinator && mpCoordinator.isCoordinator) {
        mpCoordinator.broadcastGameState({
            type: 'reboundCreated',
            reboundPos: { x: gameState.reboundX, y: gameState.reboundY },
            bounces: animBounces,
            scrambleStart: gameState.reboundScramble.startTime,
            timestamp: Date.now()
        });
    }

    // Non-blocking - game loop will handle scramble via updateReboundScramble()
}

/**
 * Start the rebound scramble - non-blocking, just activates the state
 * Actual resolution happens in updateReboundScramble() called from game loop
 * 
 * NOTE: This function is effectively a no-op since createRebound() already
 * activates the scramble state. It exists for legacy API compatibility.
 */
function resolveReboundScramble() {
    if (!gameState.reboundActive) return;

    // Already activated by createRebound(), nothing to do
    // Game loop will call updateReboundScramble() each frame
}

/**
 * Update rebound scramble state - non-blocking, called every frame
 * Checks if any player reached the ball or if time expired
 * 
 * BUG ZONE: This is the most complex function and likely source of bugs!
 * 
 * Potential bug sources:
 * 1. Hard timeout (3s) vs normal timeout (maxDuration) conflict
 * 2. Distance check (< 4 units) may be too strict or too loose
 * 3. Closest player calculation may have edge cases (ties, no players)
 * 4. Scramble state may not be properly cleared in all paths
 * 5. Multiplayer coordinator vs client logic may diverge
 * 6. Shove logic during scramble may interfere with resolution
 * 7. Multiple players reaching ball simultaneously
 */
function updateReboundScramble() {
    if (!gameState.reboundScramble.active) return;

    var reboundX = gameState.reboundScramble.reboundX;
    var reboundY = gameState.reboundScramble.reboundY;
    var startTime = gameState.reboundScramble.startTime;
    var maxDuration = gameState.reboundScramble.maxDuration;

    var elapsed = Date.now() - startTime;

    // MULTIPLAYER: Only coordinator resolves who wins, but everyone runs chase/shove logic
    var isCoordinator = !mpCoordinator || mpCoordinator.isCoordinator;

    // HARD TIMEOUT: Force resolution after 3 seconds no matter what
    // BUG CHECK: Is this timeout too short/long? Does it conflict with maxDuration?
    if (isCoordinator && elapsed > GAME_BALANCE.REBOUNDS.HARD_TIMEOUT_MS) {
        gameState.reboundScramble.active = false;
        gameState.reboundActive = false;

        // Award to closest player or just switch possession
        var allPlayers = getAllPlayers();
        var closestPlayer = null;
        var closestDist = 999;

        if (allPlayers && allPlayers.length > 0) {
            for (var i = 0; i < allPlayers.length; i++) {
                var player = allPlayers[i];
                if (!player || !player.playerData) continue;

                var dist = distanceBetweenPoints(player.x, player.y, reboundX, reboundY);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestPlayer = player;
                }
            }
        }

        if (closestPlayer) {
            secureRebound(closestPlayer);
        } else {
            switchPossession();
        }
        return;
    }

    // Check if any player reached the ball (coordinator only resolves)
    // BUG CHECK: Distance threshold (< 4) may need tuning
    if (isCoordinator) {
        var allPlayers = getAllPlayers();
        if (!allPlayers || allPlayers.length === 0) {
            gameState.reboundScramble.active = false;
            gameState.reboundActive = false;
            switchPossession();
            return;
        }

        for (var i = 0; i < allPlayers.length; i++) {
            var player = allPlayers[i];
            if (!player) continue;

            var dist = distanceBetweenPoints(player.x, player.y, reboundX, reboundY);
            if (dist < GAME_BALANCE.REBOUNDS.SECURE_REBOUND_DISTANCE) {
                // Player secured the rebound!
                // BUG CHECK: Is state properly cleared here?
                gameState.reboundScramble.active = false;
                gameState.reboundActive = false;
                secureRebound(player);
                return;
            }
        }
    }

    // ALL CLIENTS + COORDINATOR: Handle rebound shoving during scramble
    // BUG CHECK: Does shove logic interfere with resolution?
    var allPlayers = getAllPlayers();
    for (var i = 0; i < allPlayers.length; i++) {
        var player = allPlayers[i];
        if (!player || !player.playerData) continue;

        // Skip if on cooldown
        if (player.playerData.shoveCooldown > 0) continue;

        // Check distance to rebound location - only shove if pursuing rebound
        var distToRebound = distanceBetweenPoints(player.x, player.y, reboundX, reboundY);
        if (distToRebound > GAME_BALANCE.REBOUNDS.SHOVE_RANGE_MAX) continue;

        // Find closest opponent
        var playerTeam = getPlayerTeamName(player);
        var closestOpponent = null;
        var closestDist = 999;

        for (var j = 0; j < allPlayers.length; j++) {
            var other = allPlayers[j];
            if (!other || other === player) continue;
            var otherTeam = getPlayerTeamName(other);
            if (otherTeam === playerTeam) continue;

            var dist = getSpriteDistance(player, other);
            if (dist < closestDist) {
                closestDist = dist;
                closestOpponent = other;
            }
        }

        // Attempt shove if opponent is very close
        if (closestOpponent && closestDist < GAME_BALANCE.REBOUNDS.SHOVE_DISTANCE_THRESHOLD) {
            var powerAttr = getEffectiveAttribute(player.playerData, ATTR_POWER) || 5;
            var reboundShoveChance = 0.25 * (powerAttr / 5);
            if (Math.random() < reboundShoveChance) {
                attemptShove(player, closestOpponent);
            }
        }
    }

    // Check if normal timeout expired (coordinator only)
    // BUG CHECK: Does this path properly clean up state?
    if (isCoordinator && elapsed > maxDuration) {
        // Award to closest player
        var closestPlayer = null;
        var closestDist = 999;

        for (var i = 0; i < allPlayers.length; i++) {
            var player = allPlayers[i];
            if (!player || !player.playerData) continue;

            var dist = distanceBetweenPoints(player.x, player.y, reboundX, reboundY);
            if (dist < closestDist) {
                closestDist = dist;
                closestPlayer = player;
            }
        }

        gameState.reboundScramble.active = false;
        gameState.reboundActive = false;

        if (closestPlayer) {
            secureRebound(closestPlayer);
        } else {
            switchPossession();
        }
    }
}

/**
 * Award the rebound to a specific player
 * Updates stats, possession, announces event, broadcasts to clients
 * 
 * BUG ZONE: Possession assignment and state cleanup
 * 
 * Check if:
 * - Ball carrier is properly set
 * - Team possession matches player's team
 * - All rebound state is cleared
 * - Multiplayer clients receive correct state
 */
function secureRebound(player) {
    if (!player || !player.playerData) {
        switchPossession();
        return;
    }

    // MULTIPLAYER: Only coordinator awards rebounds
    if (mpCoordinator && !mpCoordinator.isCoordinator) {
        // Clients wait for coordinator's broadcast
        return;
    }

    // Flush keyboard buffer if possession is changing teams
    var teamName = getPlayerTeamName(player);
    if (teamName && teamName !== gameState.currentTeam) {
        flushKeyboardBuffer();
    }

    // Clear rebound state
    gameState.reboundActive = false;
    if (player.playerData.stats) {
        player.playerData.stats.rebounds++;
    }
    clearPotentialAssist();

    // Determine team
    var previousTeam = gameState.currentTeam;
    if (!teamName) {
        switchPossession();
        return;
    }

    // Award possession
    gameState.currentTeam = teamName;
    gameState.ballCarrier = player;
    gameState.shotClock = 24; // Reset shot clock
    resetBackcourtState();
    gameState.ballHandlerStuckTimer = 0;
    gameState.ballHandlerAdvanceTimer = 0;
    gameState.ballHandlerLastX = player.x;
    gameState.ballHandlerLastY = player.y;
    gameState.ballHandlerFrontcourtStartX = player.x;
    gameState.ballHandlerProgressOwner = player;
    if (player.playerData) player.playerData.hasDribble = true;

    if (teamName !== previousTeam) {
        triggerPossessionBeep();
    }

    // Announce who got it
    announceEvent("rebound", {
        playerName: player.playerData.name,
        player: player,
        team: teamName
    });

    // Reset heat for opposing team
    var otherTeam = teamName === "teamA" ? "teamB" : "teamA";
    gameState.consecutivePoints[otherTeam] = 0;

    // Assign defensive matchups
    assignDefensiveMatchups();

    // MULTIPLAYER: Broadcast rebound resolution to clients
    if (mpCoordinator && mpCoordinator.isCoordinator) {
        mpCoordinator.broadcastGameState({
            type: 'reboundSecured',
            playerId: getPlayerGlobalId(player),
            playerPos: { x: player.x, y: player.y },
            newPossession: teamName,
            shotClock: gameState.shotClock,
            reboundStats: player.playerData.stats.rebounds,
            timestamp: Date.now()
        });
    }

    // Now the rebounder needs to bring it up - AI will handle this via normal offense logic
}
