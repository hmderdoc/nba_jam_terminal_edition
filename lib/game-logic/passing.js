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

