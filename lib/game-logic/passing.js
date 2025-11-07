/**
 * NBA JAM - Passing System Module
 * 
 * Handles all pass mechanics including:
 * - Pass animation with interception detection
 * - Instant pass execution for multiplayer coordinator
 * - Passing lane clearance evaluation
 * - Tight defense interception penalties
 * - Pass timing calculation based on distance
 * 
 * Dependencies:
 * - Game state (gameState, teamAPlayer1, teamAPlayer2)
 * - Court utilities (clampToCourtX, clampToCourtY, getSpriteDistance)
 * - Player utilities (getPlayerGlobalId, getTeamSprites, getOpposingTeamSprites, getEffectiveAttribute)
 * - Game flow (triggerPossessionBeep, resetBackcourtState, recordTurnover, announceEvent)
 * - Stats tracking (stats.steals)
 * - Assist tracking (setPotentialAssist, clearPotentialAssist)
 * - Animation system (AnimationSystem for non-blocking passes)
 * - Multiplayer coordinator (mpCoordinator for event broadcasting)
 * - Frame system (courtFrame for trail rendering)
 * - Constants (ATTR_STEAL, ATTR_POWER, PASS_*, TIGHT_DEFENSE_*, colors)
 */

/**
 * Calculate pass animation timing based on distance
 * Returns steps, duration, and per-step timing for smooth animation
 */
function computePassAnimationTiming(startX, startY, endX, endY) {
    var dx = endX - startX;
    var dy = endY - startY;
    var distance = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(10, Math.round(distance * 0.8));
    var totalTime = 300 + (distance * 10); // 300ms base + 10ms per unit
    var msPerStep = Math.max(15, Math.round(totalTime / steps));
    return {
        steps: steps,
        msPerStep: msPerStep,
        durationMs: steps * msPerStep,
        distance: distance
    };
}

/**
 * Execute pass instantly (no animation)
 * Used by multiplayer coordinator for instant state updates
 * Returns result object with all animation data for broadcasting
 */
function executePass(passer, receiver, leadTarget) {
    if (!passer || !receiver) {
        return { interceptor: null, targetPoint: null };
    }

    // CRITICAL: Validate receiver is in bounds
    var receiverInBounds = (receiver.x >= 2 && receiver.x <= COURT_WIDTH - 7 && 
                           receiver.y >= 2 && receiver.y <= COURT_HEIGHT - 5);
    if (!receiverInBounds) {
        // Receiver out of bounds - treat as turnover
        recordTurnover(passer, "pass_oob");
        var opposingTeam = getOpposingTeamName(passer);
        gameState.currentTeam = opposingTeam;
        gameState.ballCarrier = null;
        gameState.inbounding = true;
        triggerPossessionBeep();
        return { interceptor: null, targetPoint: null, outOfBounds: true };
    }

    var startX = passer.x + 2;
    var startY = passer.y + 2;
    var targetPoint = null;
    if (leadTarget && typeof leadTarget.x === "number" && typeof leadTarget.y === "number") {
        targetPoint = {
            x: clampToCourtX(Math.round(leadTarget.x)),
            y: clampToCourtY(Math.round(leadTarget.y))
        };
    }

    var endX = (targetPoint ? targetPoint.x : receiver.x) + 2;
    var endY = (targetPoint ? targetPoint.y : receiver.y) + 2;
    var passTiming = computePassAnimationTiming(startX, startY, endX, endY);

    // Check for interception
    var interceptor = checkPassInterception(passer, receiver, targetPoint);

    // Update game state instantly
    gameState.reboundActive = false;
    clearPotentialAssist();

    if (interceptor) {
        // Interception - update animation target to interceptor's position
        endX = interceptor.x + 2;
        endY = interceptor.y + 2;

        recordTurnover(passer, "steal_pass");
        gameState.ballCarrier = interceptor;
        var interceptorTeam = (interceptor === teamAPlayer1 || interceptor === teamAPlayer2) ? "teamA" : "teamB";
        gameState.currentTeam = interceptorTeam;
        triggerPossessionBeep();
        resetBackcourtState();
        gameState.ballHandlerStuckTimer = 0;
        gameState.ballHandlerAdvanceTimer = 0;
        gameState.shotClock = 24;
        var otherTeam = interceptorTeam === "teamA" ? "teamB" : "teamA";
        gameState.consecutivePoints[otherTeam] = 0;
        gameState.ballHandlerLastX = interceptor.x;
        gameState.ballHandlerLastY = interceptor.y;
        gameState.ballHandlerFrontcourtStartX = interceptor.x;
        gameState.ballHandlerProgressOwner = interceptor;

        if (interceptor.playerData && interceptor.playerData.stats) {
            interceptor.playerData.stats.steals++;
        }

        if (interceptor.playerData) {
            interceptor.playerData.hasDribble = true;
            announceEvent("steal", {
                playerName: interceptor.playerData.name,
                player: interceptor,
                team: interceptorTeam
            });
        }
        if (receiver && receiver.playerData) receiver.playerData.hasDribble = true;
        if (passer && passer.playerData) passer.playerData.hasDribble = false;
    } else {
        // Pass completed
        gameState.ballCarrier = receiver;
        gameState.ballHandlerAdvanceTimer = 0;
        gameState.ballHandlerFrontcourtStartX = receiver.x;
        gameState.ballHandlerProgressOwner = receiver;
        if (receiver && receiver.playerData) receiver.playerData.hasDribble = true;
        if (passer && passer.playerData) passer.playerData.hasDribble = false;
        setPotentialAssist(passer, receiver);
    }

    // Ensure ball carrier is set
    if (!gameState.ballCarrier) {
        gameState.ballCarrier = receiver;
    }
    if (gameState.ballCarrier) {
        gameState.ballHandlerLastX = gameState.ballCarrier.x;
        gameState.ballHandlerLastY = gameState.ballCarrier.y;
        gameState.ballHandlerFrontcourtStartX = gameState.ballCarrier.x;
        gameState.ballHandlerProgressOwner = gameState.ballCarrier;
    }

    resetDeadDribbleTimer();

    // Broadcast event for animation
    if (mpCoordinator && mpCoordinator.isCoordinator) {
        mpCoordinator.broadcastEvent("pass_executed", {
            passer: getPlayerGlobalId(passer),
            receiver: getPlayerGlobalId(receiver),
            interceptor: interceptor ? getPlayerGlobalId(interceptor) : null,
            leadTarget: leadTarget,
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY,
            durationMs: passTiming.durationMs
        });

        // Queue local animation for coordinator (so coordinator sees it too)
        if (animationSystem) {
            animationSystem.queuePassAnimation(
                startX,
                startY,
                endX,
                endY,
                interceptor,
                passTiming.durationMs
            );
        }
    }

    return { interceptor: interceptor, targetPoint: targetPoint };
}

/**
 * Animate pass with blocking animation and interception detection
 * Renders pass trail with CP437 middle dot character
 * Handles both successful passes and interceptions
 */
function animatePass(passer, receiver, leadTarget) {
    if (!passer || !receiver) return;

    // CRITICAL: Validate receiver is in bounds
    var receiverInBounds = (receiver.x >= 2 && receiver.x <= COURT_WIDTH - 7 && 
                           receiver.y >= 2 && receiver.y <= COURT_HEIGHT - 5);
    if (!receiverInBounds) {
        // Receiver out of bounds - treat as turnover
        recordTurnover(passer, "pass_oob");
        var opposingTeam = getOpposingTeamName(passer);
        gameState.currentTeam = opposingTeam;
        gameState.ballCarrier = null;
        gameState.inbounding = true;
        triggerPossessionBeep();
        return;
    }

    // Coordinator: Use non-blocking executePass()
    if (mpCoordinator && mpCoordinator.isCoordinator) {
        executePass(passer, receiver, leadTarget);
        return;  // Early return - executePass() handled all logic and broadcast event
    }

    var startX = passer.x + 2;
    var startY = passer.y + 2;
    var targetPoint = null;
    if (leadTarget && typeof leadTarget.x === "number" && typeof leadTarget.y === "number") {
        targetPoint = {
            x: clampToCourtX(Math.round(leadTarget.x)),
            y: clampToCourtY(Math.round(leadTarget.y))
        };
    }

    var endX = (targetPoint ? targetPoint.x : receiver.x) + 2;
    var endY = (targetPoint ? targetPoint.y : receiver.y) + 2;

    // Calculate timing
    var passTiming = computePassAnimationTiming(startX, startY, endX, endY);
    var steps = passTiming.steps;
    var msPerStep = passTiming.msPerStep;

    // Check for interception
    var interceptor = checkPassInterception(passer, receiver, targetPoint);

    // If intercepted, update endpoint to interceptor's position
    if (interceptor) {
        endX = interceptor.x + 2;
        endY = interceptor.y + 2;
    }

    // Draw pass trail animation
    for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var x = Math.round(startX + (endX - startX) * t);
        var y = Math.round(startY + (endY - startY) * t);

        if (x >= 1 && x <= COURT_WIDTH && y >= 1 && y <= COURT_HEIGHT && courtFrame) {
            courtFrame.gotoxy(x, y);
            courtFrame.putmsg(ascii(250), LIGHTGRAY); // CP437 middle dot
        }

        if (typeof mswait === "function") {
            mswait(msPerStep);
        } else {
            var start = Date.now();
            while (Date.now() - start < msPerStep) {
                yield(true);
            }
        }
    }

    // Update game state
    gameState.reboundActive = false;
    clearPotentialAssist();

    if (interceptor) {
        // Interception
        recordTurnover(passer, "steal_pass");
        gameState.ballCarrier = interceptor;
        var interceptorTeam = (interceptor === teamAPlayer1 || interceptor === teamAPlayer2) ? "teamA" : "teamB";
        gameState.currentTeam = interceptorTeam;
        triggerPossessionBeep();
        resetBackcourtState();
        gameState.ballHandlerStuckTimer = 0;
        gameState.ballHandlerAdvanceTimer = 0;
        gameState.shotClock = 24;
        var otherTeam = interceptorTeam === "teamA" ? "teamB" : "teamA";
        gameState.consecutivePoints[otherTeam] = 0;
        gameState.ballHandlerLastX = interceptor.x;
        gameState.ballHandlerLastY = interceptor.y;
        gameState.ballHandlerFrontcourtStartX = interceptor.x;
        gameState.ballHandlerProgressOwner = interceptor;

        if (interceptor.playerData && interceptor.playerData.stats) {
            interceptor.playerData.stats.steals++;
        }

        if (interceptor.playerData) {
            interceptor.playerData.hasDribble = true;
            announceEvent("steal", {
                playerName: interceptor.playerData.name,
                player: interceptor,
                team: interceptorTeam
            });
        }
        if (receiver && receiver.playerData) receiver.playerData.hasDribble = true;
        if (passer && passer.playerData) passer.playerData.hasDribble = false;
    } else {
        // Pass completed successfully
        gameState.ballCarrier = receiver;
        gameState.ballHandlerAdvanceTimer = 0;
        gameState.ballHandlerFrontcourtStartX = receiver.x;
        gameState.ballHandlerProgressOwner = receiver;
        if (receiver && receiver.playerData) receiver.playerData.hasDribble = true;
        if (passer && passer.playerData) passer.playerData.hasDribble = false;
        setPotentialAssist(passer, receiver);
    }

    // Ensure ball carrier is set (safety fallback)
    if (!gameState.ballCarrier) {
        gameState.ballCarrier = receiver;
    }
    if (gameState.ballCarrier) {
        gameState.ballHandlerLastX = gameState.ballCarrier.x;
        gameState.ballHandlerLastY = gameState.ballCarrier.y;
        gameState.ballHandlerFrontcourtStartX = gameState.ballCarrier.x;
        gameState.ballHandlerProgressOwner = gameState.ballCarrier;
    }

    resetDeadDribbleTimer();
}

/**
 * Check if any defender can intercept the pass
 * Uses passing lane projection, reaction distance, and steal attributes
 * Applies severe penalty if defender is touching passer (tight defense)
 * 
 * Returns: defender sprite if intercepted, null otherwise
 */
function checkPassInterception(passer, receiver, targetOverride) {
    // Check if any defender is in the passing lane and can intercept
    if (!passer || !receiver) return null;

    var passerTeam = (passer === teamAPlayer1 || passer === teamAPlayer2) ? "teamA" : "teamB";
    var defenders = getOpposingTeamSprites(passerTeam);

    // Calculate pass vector
    var passX1 = passer.x + 2;
    var passY1 = passer.y + 2;
    var passX2;
    var passY2;
    if (targetOverride) {
        passX2 = clampToCourtX(targetOverride.x) + 2;
        passY2 = clampToCourtY(targetOverride.y) + 2;
    } else {
        passX2 = receiver.x + 2;
        passY2 = receiver.y + 2;
    }
    var passVecX = passX2 - passX1;
    var passVecY = passY2 - passY1;
    var passLength = Math.sqrt(passVecX * passVecX + passVecY * passVecY);

    if (passLength < 0.1) return null; // Too short to intercept

    for (var i = 0; i < defenders.length; i++) {
        var defender = defenders[i];
        if (!defender || !defender.playerData) continue;
        var stealAttr = getEffectiveAttribute(defender.playerData, ATTR_STEAL);

        var defX = defender.x + 2;
        var defY = defender.y + 2;

        // Check if defender is touching the ball handler (pressure defense penalty)
        var distToPasser = getSpriteDistance(defender, passer);
        var isTouchingPasser = distToPasser <= TIGHT_DEFENSE_TOUCH_DISTANCE;

        // Vector from passer to defender
        var toDefX = defX - passX1;
        var toDefY = defY - passY1;

        // Project defender onto pass line using dot product
        var projection = (toDefX * passVecX + toDefY * passVecY) / passLength;

        // Check if projection is between passer and receiver
        if (projection < 0 || projection > passLength) {
            continue; // Defender is not between passer and receiver
        }

        var latencyWindow = PASS_INTERCEPT_LATENCY_MIN + Math.random() * (PASS_INTERCEPT_LATENCY_MAX - PASS_INTERCEPT_LATENCY_MIN);
        var reactionDistance = Math.max(1, latencyWindow - (stealAttr * 0.7));
        if (projection < reactionDistance) {
            continue; // Defender reacts too late
        }

        // Calculate closest point on pass line to defender
        var t = projection / passLength;
        var closestX = passX1 + passVecX * t;
        var closestY = passY1 + passVecY * t;

        // Distance from defender to pass line
        var distToLine = Math.sqrt(Math.pow(defX - closestX, 2) + Math.pow(defY - closestY, 2));

        var laneSlack = Math.max(1.5, PASS_LANE_BASE_TOLERANCE + Math.random() * 1.75 - stealAttr * 0.15);

        if (distToLine < laneSlack) {
            // Defender is close to passing lane
            var distanceBonus = Math.max(0, passLength - reactionDistance) * 1.5;
            if (distanceBonus > 25) distanceBonus = 25;
            var anticipation = 0.45 + Math.random() * 0.55; // 0.45 - 1.0
            var interceptChance = (stealAttr * 5 + distanceBonus) * anticipation;
            if (interceptChance > PASS_INTERCEPT_MAX_CHANCE) interceptChance = PASS_INTERCEPT_MAX_CHANCE;

            // Apply SEVERE penalty if defender is touching the passer (too close = bad positioning)
            if (isTouchingPasser) {
                interceptChance *= (1 - TIGHT_DEFENSE_INTERCEPT_PENALTY);
                try {
                    log(LOG_DEBUG, "Tight defense penalty applied: " + Math.round(interceptChance) + "% intercept chance (was " + Math.round(interceptChance / (1 - TIGHT_DEFENSE_INTERCEPT_PENALTY)) + "%)");
                } catch (e) { }
            }

            if (Math.random() * 100 < interceptChance) {
                // Interception!
                return defender;
            }
        }
    }

    return null; // Pass completed successfully
}

/**
 * Check if any defenders are playing too tight on the ball handler
 * Tight defense reduces interception chance (exploitable situation)
 * 
 * Returns: true if at least one defender is within TIGHT_DEFENSE_TOUCH_DISTANCE
 */
function isDefenderPlayingTooTight(ballHandler, opponentTeam) {
    if (!ballHandler) return false;

    var opponents = getOpposingTeamSprites(opponentTeam);
    if (!opponents || opponents.length === 0) return false;

    for (var i = 0; i < opponents.length; i++) {
        var defender = opponents[i];
        if (!defender || !defender.playerData) continue;

        var dist = getSpriteDistance(ballHandler, defender);
        if (dist <= TIGHT_DEFENSE_TOUCH_DISTANCE) {
            return true; // At least one defender is touching
        }
    }

    return false;
}

/**
 * Entry point for human player pass (teamAPlayer1 -> teamAPlayer2)
 * Simple wrapper around animatePass
 */
function passToTeammate() {
    // Animate and check pass
    animatePass(teamAPlayer1, teamAPlayer2);
}
