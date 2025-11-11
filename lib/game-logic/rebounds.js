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
function createRebound(x, y, systems) {
    var stateManager = systems.stateManager;
    var ballCarrier = stateManager.get('ballCarrier');
    var reboundX = stateManager.get('reboundX');
    var reboundY = stateManager.get('reboundY');
    var reboundScramble = stateManager.get('reboundScramble');

    // Calculate final rebound position
    stateManager.set("shotInProgress", false, "rebound_created");
    stateManager.set("reboundActive", true, "rebound_created");

    debugLog("[REBOUND] createRebound() called at (" + x + "," + y + "), ballCarrier: " +
        (ballCarrier ? ballCarrier.playerData.name : "null"));

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
    var finalReboundX = currentX + (Math.random() * 4 - 2);
    var finalReboundY = currentY + (Math.random() * 3 - 1);

    // Clamp to court boundaries
    finalReboundX = clamp(finalReboundX, 2, COURT_WIDTH - 2);
    finalReboundY = clamp(finalReboundY, 2, COURT_HEIGHT - 2);

    stateManager.set("reboundX", finalReboundX, "rebound_position");
    stateManager.set("reboundY", finalReboundY, "rebound_position");

    // Start non-blocking scramble state
    reboundScramble.active = true;
    reboundScramble.startTime = Date.now();
    reboundScramble.reboundX = finalReboundX;
    reboundScramble.reboundY = finalReboundY;
    reboundScramble.bounceAnimComplete = false;
    reboundScramble.anticipating = false;  // Clear anticipation, actual scramble started
    reboundScramble.isLooseBall = false;  // Default: actual rebound from missed shot

    debugLog("[REBOUND] Scramble activated - reboundX: " + finalReboundX + ", reboundY: " + finalReboundY);

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
        endX: finalReboundX,
        endY: finalReboundY
    });

    // Queue non-blocking rebound animation
    if (animationSystem) {
        animationSystem.queueReboundAnimation(animBounces);
    }

    // Multiplayer coordinator: Broadcast event
    if (mpCoordinator && mpCoordinator.isCoordinator) {
        mpCoordinator.broadcastGameState({
            type: 'reboundCreated',
            reboundPos: { x: finalReboundX, y: finalReboundY },
            bounces: animBounces,
            scrambleStart: reboundScramble.startTime,
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
function resolveReboundScramble(systems) {
    var stateManager = systems.stateManager;
    var reboundActive = stateManager.get('reboundActive');
    if (!reboundActive) {
        debugLog("[REBOUND SCRAMBLE] Called but reboundActive=false, returning early");
        return;
    }

    debugLog("[REBOUND SCRAMBLE] Activated, game loop will call updateReboundScramble() each frame");
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
function updateReboundScramble(systems) {
    var stateManager = systems.stateManager;
    var reboundScramble = stateManager.get('reboundScramble');

    if (!reboundScramble.active) return;

    var reboundX = reboundScramble.reboundX;
    var reboundY = reboundScramble.reboundY;

    // CRITICAL: Update rebound position to track moving ball during idle bounce
    if (animationSystem && typeof animationSystem.getIdleBouncePosition === "function") {
        var ballPos = animationSystem.getIdleBouncePosition();
        if (ballPos) {
            reboundX = ballPos.x;
            reboundY = ballPos.y;
            // Update in state so AI and players chase correct location
            reboundScramble.reboundX = reboundX;
            reboundScramble.reboundY = reboundY;
        }
    }

    var startTime = reboundScramble.startTime;
    var maxDuration = reboundScramble.maxDuration;

    var elapsed = Date.now() - startTime;

    // MULTIPLAYER: Only coordinator resolves who wins, but everyone runs chase/shove logic
    var isCoordinator = !mpCoordinator || mpCoordinator.isCoordinator;

    // HARD TIMEOUT: Force resolution after 3 seconds no matter what
    // BUG CHECK: Is this timeout too short/long? Does it conflict with maxDuration?
    if (isCoordinator && elapsed > GAME_BALANCE.REBOUNDS.HARD_TIMEOUT_MS) {
        reboundScramble.active = false;
        stateManager.set("reboundActive", false, "rebound_timeout");

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
            secureRebound(closestPlayer, systems);
        } else {
            switchPossession(systems);
        }
        return;
    }

    // Check if any player reached the ball (coordinator only resolves)
    // BUG CHECK: Distance threshold (< 4) may need tuning
    if (isCoordinator) {
        var allPlayers = getAllPlayers();
        if (!allPlayers || allPlayers.length === 0) {
            reboundScramble.active = false;
            stateManager.set("reboundActive", false, "no_players");
            switchPossession(systems);
            return;
        }

        for (var i = 0; i < allPlayers.length; i++) {
            var player = allPlayers[i];
            if (!player) continue;

            var dist = distanceBetweenPoints(player.x, player.y, reboundX, reboundY);
            if (dist < GAME_BALANCE.REBOUNDS.SECURE_REBOUND_DISTANCE) {
                // Player secured the rebound!
                // BUG CHECK: Is state properly cleared here?
                reboundScramble.active = false;
                stateManager.set("reboundActive", false, "rebound_secured");
                secureRebound(player, systems);
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
                attemptShove(player, closestOpponent, systems);
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

        reboundScramble.active = false;
        stateManager.set("reboundActive", false, "rebound_timeout_normal");

        if (closestPlayer) {
            secureRebound(closestPlayer, systems);
        } else {
            switchPossession(systems);
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
function secureRebound(player, systems) {
    var stateManager = systems.stateManager;
    var currentTeam = stateManager.get('currentTeam');

    if (!player || !player.playerData) {
        switchPossession(systems);
        return;
    }

    // MULTIPLAYER: Only coordinator awards rebounds
    if (mpCoordinator && !mpCoordinator.isCoordinator) {
        // Clients wait for coordinator's broadcast
        return;
    }

    // Flush keyboard buffer if possession is changing teams
    var teamName = getPlayerTeamName(player);
    if (teamName && teamName !== currentTeam) {
        flushKeyboardBuffer();
    }

    // Clear rebound state
    stateManager.set("reboundActive", false, "rebound_secured_by_player");
    if (player.playerData.stats) {
        player.playerData.stats.rebounds++;
    }
    clearPotentialAssist(systems);

    // Determine team
    var previousTeam = currentTeam;
    if (!teamName) {
        switchPossession(systems);
        return;
    }

    // Award possession
    stateManager.set("currentTeam", teamName, "rebound_possession");
    stateManager.set("ballCarrier", player, "rebound_possession");
    stateManager.set("shotClock", 24, "rebound_possession"); // Reset shot clock

    // CRITICAL: Determine if this is offensive or defensive rebound
    // Both need grace period - rebounds happen near basket (in "backcourt" territory)
    // Player needs time to move away from basket before backcourt rules apply
    var isDefensiveRebound = (teamName !== previousTeam);

    if (isDefensiveRebound) {
        // Defensive rebound: Team just got the ball, reset backcourt tracking
        resetBackcourtState(systems);
        debugLog("[REBOUND] Defensive rebound by " + teamName + " - backcourt state reset");
    } else {
        // Offensive rebound: Same team keeps possession, keep existing frontcourt status
        debugLog("[REBOUND] Offensive rebound by " + teamName + " - keeping frontcourt status");
    }

    // Set grace period for BOTH offensive and defensive rebounds
    // Player is near basket and needs time to establish position without false violations
    // 50 frames = 2.5 seconds at 20 FPS
    stateManager.set("inboundGracePeriod", 50, "rebound_grace_period");
    debugLog("[REBOUND] Grace period set - player can reposition without backcourt violation");

    stateManager.set("ballHandlerStuckTimer", 0, "rebound_possession");
    stateManager.set("ballHandlerAdvanceTimer", 0, "rebound_possession");
    stateManager.set("ballHandlerLastX", player.x, "rebound_possession");
    stateManager.set("ballHandlerLastY", player.y, "rebound_possession");
    stateManager.set("ballHandlerFrontcourtStartX", player.x, "rebound_possession");
    stateManager.set("ballHandlerProgressOwner", player, "rebound_possession");
    if (player.playerData) player.playerData.hasDribble = true;

    if (teamName !== previousTeam) {
        triggerPossessionBeep(systems);
    }

    // Announce who got it - but only if it's an actual rebound, not a loose ball recovery
    var reboundScramble = stateManager.get('reboundScramble');
    if (!reboundScramble || !reboundScramble.isLooseBall) {
        announceEvent("rebound", {
            playerName: player.playerData.name,
            player: player,
            team: teamName
        }, systems);
    } else {
        // Loose ball recovery - announce as loose_ball_secured instead
        announceEvent("loose_ball_secured", {
            playerName: player.playerData.name,
            player: player,
            team: teamName
        }, systems);
    }

    // Reset heat for opposing team
    var otherTeam = teamName === "teamA" ? "teamB" : "teamA";
    var consecutivePoints = stateManager.get('consecutivePoints') || { teamA: 0, teamB: 0 };
    consecutivePoints[otherTeam] = 0;
    stateManager.set("consecutivePoints", consecutivePoints, "rebound_secured");

    // Assign defensive matchups
    assignDefensiveMatchups(systems);

    // MULTIPLAYER: Broadcast rebound resolution to clients
    if (mpCoordinator && mpCoordinator.isCoordinator) {
        var shotClock = stateManager.get('shotClock');
        mpCoordinator.broadcastGameState({
            type: 'reboundSecured',
            playerId: getPlayerGlobalId(player),
            playerPos: { x: player.x, y: player.y },
            newPossession: teamName,
            shotClock: shotClock,
            reboundStats: player.playerData.stats.rebounds,
            timestamp: Date.now()
        });
    }

    // Update ball position to follow the rebounder
    updateBallPosition(systems);

    // Now the rebounder needs to bring it up - AI will handle this via normal offense logic
}
