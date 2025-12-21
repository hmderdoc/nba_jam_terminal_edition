/**
 * NBA JAM - Passing System Module
 * 
 * Handles all pass mechanics including:
 * - Pass animation with interception detection
 * - Passing lane clearance evaluation
 * - Tight defense interception penalties
 * 
 * Wave 23: Core pass logic moved to lib/systems/passing-system.js
 * This module provides wrapper functions and helper utilities
 * 
 * Dependencies:
 * - Game state (via systems.stateManager)
 * - Court utilities (getSpriteDistance)
 * - Player utilities (getOpposingTeamSprites, getEffectiveAttribute, getPlayerTeamName)
 * - Constants (ATTR_STEAL, PASS_*, TIGHT_DEFENSE_*)
 */

var PASSING_PLAYER_BOUNDS = (typeof PLAYER_BOUNDARIES === "object" && PLAYER_BOUNDARIES) ? PLAYER_BOUNDARIES : {
    minX: 2,
    movementMaxXOffset: 7,
    minY: 2,
    maxYOffset: 5
};

function getPassingBound(key, fallback) {
    var value = PASSING_PLAYER_BOUNDS && typeof PASSING_PLAYER_BOUNDS[key] === "number"
        ? PASSING_PLAYER_BOUNDS[key]
        : undefined;
    return (typeof value === "number") ? value : fallback;
}

/**
 * Animate a pass from passer to receiver
 * Wave 23: Uses new testable passing system
 * @param {Object} inboundContext - Optional context for inbound passes with post-pass setup data
 */
function animatePass(passer, receiver, leadTarget, inboundContext, systems) {
    if (!systems || !systems.passingSystem) {
        throw new Error("passingSystem not initialized - check main() setup");
    }

    return systems.passingSystem.attemptPass(passer, receiver, {
        leadTarget: leadTarget,
        inboundContext: inboundContext
    });
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

    var passerTeam = getPlayerTeamName(passer);
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
                } catch (e) { }
            }

            if (Math.random() * 100 < interceptChance) {
                // Interception!
                return {
                    defender: defender,
                    interceptX: closestX,
                    interceptY: closestY
                };
            }
        }
    }

    return null; // Pass completed successfully
}

/**
 * Check if any defenders are playing too tight on the ball handler
 * Tight defense reduces interception chance (exploitable situation)
 * 
 * TODO WAVE 23: Reconnect to AI - This function exists but is not called
 * Pre-Wave23: AI used this to detect and exploit tight defense with passes
 * Wave23: Function preserved but AI logic needs restoration in lib/ai/offense-ball-handler.js
 * 
 * The interception penalty (85% reduction) still applies in checkPassInterception(),
 * but AI doesn't proactively detect and exploit this situation anymore.
 * 
 * See: docs/DEAD_CODE_ANALYSIS.md for full context
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
 * Calculate receiver's current velocity from position history
 * 
 * @param {Object} receiver - The receiver sprite
 * @returns {Object} Velocity vector { dx, dy } in tiles per frame
 */
function calculateReceiverVelocity(receiver) {
    if (!receiver) return { dx: 0, dy: 0 };

    // Check if we have previous position stored
    if (receiver.prevX === undefined || receiver.prevY === undefined) {
        return { dx: 0, dy: 0 }; // No history, assume stationary
    }

    // Calculate velocity from position delta
    var dx = receiver.x - receiver.prevX;
    var dy = receiver.y - receiver.prevY;

    return { dx: dx, dy: dy };
}

/**
 * Estimate pass flight duration in frames
 * 
 * @param {Object} passer - The passer sprite
 * @param {Object} receiver - The receiver sprite
 * @returns {number} Estimated frames until ball arrives
 */
function estimatePassDuration(passer, receiver) {
    if (!passer || !receiver) return 0;

    // Calculate distance
    var dx = receiver.x - passer.x;
    var dy = receiver.y - passer.y;
    var distance = Math.sqrt(dx * dx + dy * dy);

    // Pass speed constant (tiles per frame)
    // Based on pass animation: ~300ms base + distance*10ms, at 20 FPS = ~6-15 frames
    // Average speed works out to ~1.5 tiles per frame
    var passSpeed = 1.5;

    // Return frames (minimum 1)
    return Math.max(1, Math.round(distance / passSpeed));
}

/**
 * Calculate lead pass target based on receiver velocity
 * Throws to where receiver WILL BE, not where they ARE
 * 
 * @param {Object} receiver - The receiver sprite
 * @param {number} flightTime - Pass flight time in frames
 * @returns {Object} Lead target { x, y } or null if no lead needed
 */
function calculateLeadTarget(receiver, flightTime) {
    if (!receiver || flightTime <= 0) return null;

    // Get receiver velocity
    var velocity = calculateReceiverVelocity(receiver);

    // If stationary, no lead needed
    if (velocity.dx === 0 && velocity.dy === 0) {
        return null;
    }

    // Project where receiver will be
    var leadX = receiver.x + (velocity.dx * flightTime);
    var leadY = receiver.y + (velocity.dy * flightTime);

    // Cap maximum lead distance (prevent absurd leads)
    var maxLeadDistance = 5; // tiles
    var leadDistanceX = leadX - receiver.x;
    var leadDistanceY = leadY - receiver.y;
    var totalLeadDistance = Math.sqrt(leadDistanceX * leadDistanceX + leadDistanceY * leadDistanceY);

    if (totalLeadDistance > maxLeadDistance) {
        var scale = maxLeadDistance / totalLeadDistance;
        leadX = receiver.x + (leadDistanceX * scale);
        leadY = receiver.y + (leadDistanceY * scale);
    }

    var minX = getPassingBound("minX", 2);
    var minY = getPassingBound("minY", 2);
    var maxX = COURT_WIDTH - getPassingBound("movementMaxXOffset", 7);
    var maxY = COURT_HEIGHT - getPassingBound("maxYOffset", 5);

    // Clamp to court bounds
    leadX = clamp(leadX, minX, maxX);
    leadY = clamp(leadY, minY, maxY);

    // Return lead target
    return { x: Math.round(leadX), y: Math.round(leadY) };
}

/**
 * Calculate smart lead pass target (considers receiver movement)
 * Call this before animatePass() to get the leadTarget parameter
 * 
 * @param {Object} passer - The passer sprite
 * @param {Object} receiver - The receiver sprite
 * @returns {Object} Lead target { x, y } or null if no lead needed
 */
function getSmartPassTarget(passer, receiver) {
    if (!passer || !receiver) return null;

    // Estimate pass flight time
    var flightTime = estimatePassDuration(passer, receiver);

    // Calculate lead target
    var leadTarget = calculateLeadTarget(receiver, flightTime);

    // Debug logging
    if (leadTarget && typeof debugLog === "function") {
        var velocity = calculateReceiverVelocity(receiver);
        debugLog("[LEAD PASS] Receiver at (" + receiver.x + "," + receiver.y +
            ") velocity (" + velocity.dx.toFixed(1) + "," + velocity.dy.toFixed(1) +
            ") flight=" + flightTime + " frames" +
            " → target (" + leadTarget.x + "," + leadTarget.y + ")");
    }

    return leadTarget;
}
