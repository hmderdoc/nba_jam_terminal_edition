/**
 * Knockback Animation System
 * Handles player knockback effects when shoved, including trail rendering
 * 
 * Wave 24: Added smart knockback direction that "clears the lane" by pushing
 * victims away from their target basket and toward sidelines.
 */

// Load shove direction config from timing constants
var SHOVE_DIRECTION_CONFIG = (typeof TIMING_CONSTANTS === "object" && TIMING_CONSTANTS.SHOVE && TIMING_CONSTANTS.SHOVE.DIRECTION)
    ? TIMING_CONSTANTS.SHOVE.DIRECTION
    : {
        awayFromBasketWeight: 0.6,
        towardSidelineWeight: 0.4,
        minSidelineComponent: 0.25,
        randomJitter: 0.15
    };

var SHOVE_RECOVERY_CONFIG = (typeof TIMING_CONSTANTS === "object" && TIMING_CONSTANTS.SHOVE && TIMING_CONSTANTS.SHOVE.VICTIM_RECOVERY)
    ? TIMING_CONSTANTS.SHOVE.VICTIM_RECOVERY
    : {
        baseFrames: 6,
        framesPerPushUnit: 0.3,
        turboDrain: 15
    };

/**
 * Calculate smart knockback direction based on basketball context.
 * "Clears the lane" by pushing victim:
 * - Away from their target basket (primary)
 * - Toward nearest sideline (secondary)
 * 
 * @param {Object} victim - The player being knocked back
 * @param {Object} source - The player doing the shoving
 * @param {Object} systems - Systems object with stateManager
 * @returns {Object} Normalized direction vector { dx, dy }
 */
function calculateSmartShoveDirection(victim, source, systems) {
    // Fallback to simple direction if we can't determine context
    var simpleDx = victim.x - (source ? source.x : victim.x);
    var simpleDy = victim.y - (source ? source.y : victim.y);
    
    if (simpleDx === 0 && simpleDy === 0) {
        simpleDx = (Math.random() < 0.5) ? 1 : -1;
    }
    
    // Normalize simple direction
    var simpleMag = Math.sqrt(simpleDx * simpleDx + simpleDy * simpleDy) || 1;
    simpleDx /= simpleMag;
    simpleDy /= simpleMag;
    
    // If no systems/stateManager, fall back to simple direction
    if (!systems || !systems.stateManager) {
        return { dx: simpleDx, dy: simpleDy };
    }
    
    var stateManager = systems.stateManager;
    var possession = stateManager.get('possession');
    var victimTeam = null;
    
    // Determine victim's team
    if (typeof getPlayerTeamName === "function") {
        victimTeam = getPlayerTeamName(victim);
    }
    
    if (!victimTeam) {
        return { dx: simpleDx, dy: simpleDy };
    }
    
    // Determine victim's target basket based on whether they're on offense or defense
    var victimIsOnOffense = (victimTeam === possession);
    var targetBasket;
    
    // Get court geometry
    var courtWidth = (typeof COURT_WIDTH !== "undefined") ? COURT_WIDTH : 80;
    var courtHeight = (typeof COURT_HEIGHT !== "undefined") ? COURT_HEIGHT : 18;
    var basketLeftX = (typeof BASKET_LEFT_X !== "undefined") ? BASKET_LEFT_X : 4;
    var basketLeftY = (typeof BASKET_LEFT_Y !== "undefined") ? BASKET_LEFT_Y : 9;
    var basketRightX = (typeof BASKET_RIGHT_X !== "undefined") ? BASKET_RIGHT_X : (courtWidth - 4);
    var basketRightY = (typeof BASKET_RIGHT_Y !== "undefined") ? BASKET_RIGHT_Y : 9;
    
    if (victimIsOnOffense) {
        // Victim is on offense - push them AWAY from their target basket (toward their defensive end)
        // teamA attacks right, teamB attacks left
        if (victimTeam === "teamA") {
            // teamA's offensive basket is RIGHT, so push them toward LEFT (their defensive basket)
            targetBasket = { x: basketLeftX, y: basketLeftY };
        } else {
            // teamB's offensive basket is LEFT, so push them toward RIGHT (their defensive basket)
            targetBasket = { x: basketRightX, y: basketRightY };
        }
    } else {
        // Victim is on defense - push them away from the action (toward their offensive basket / away from ball)
        // This clears them out of the paint/lane
        if (victimTeam === "teamA") {
            // teamA defends LEFT basket, push toward RIGHT (their offensive basket)
            targetBasket = { x: basketRightX, y: basketRightY };
        } else {
            // teamB defends RIGHT basket, push toward LEFT (their offensive basket)
            targetBasket = { x: basketLeftX, y: basketLeftY };
        }
    }
    
    // COMPONENT 1: Direction toward target basket (we want to push them THIS way)
    var toBasketDx = targetBasket.x - victim.x;
    var toBasketDy = targetBasket.y - victim.y;
    var toBasketMag = Math.sqrt(toBasketDx * toBasketDx + toBasketDy * toBasketDy) || 1;
    toBasketDx /= toBasketMag;
    toBasketDy /= toBasketMag;
    
    // COMPONENT 2: Direction toward nearest sideline (top or bottom of court)
    var courtMidY = courtHeight / 2;
    var toSidelineDy = (victim.y < courtMidY) ? -1 : 1; // Push toward nearest edge
    var toSidelineDx = 0; // Sideline push is purely vertical
    
    // Ensure minimum sideline component
    var minSideline = SHOVE_DIRECTION_CONFIG.minSidelineComponent;
    if (Math.abs(toSidelineDy) < minSideline) {
        toSidelineDy = toSidelineDy >= 0 ? minSideline : -minSideline;
    }
    
    // COMPONENT 3: Small random jitter for unpredictability
    var jitter = SHOVE_DIRECTION_CONFIG.randomJitter;
    var jitterDx = (Math.random() - 0.5) * 2 * jitter;
    var jitterDy = (Math.random() - 0.5) * 2 * jitter;
    
    // Combine components with weights
    var basketWeight = SHOVE_DIRECTION_CONFIG.awayFromBasketWeight;
    var sidelineWeight = SHOVE_DIRECTION_CONFIG.towardSidelineWeight;
    
    var finalDx = (toBasketDx * basketWeight) + (toSidelineDx * sidelineWeight) + jitterDx;
    var finalDy = (toBasketDy * basketWeight) + (toSidelineDy * sidelineWeight) + jitterDy;
    
    // Normalize final direction
    var finalMag = Math.sqrt(finalDx * finalDx + finalDy * finalDy) || 1;
    finalDx /= finalMag;
    finalDy /= finalMag;
    
    // Log for debugging
    if (typeof debugLog === "function") {
        debugLog("[SHOVE DIRECTION] victim=" + (victim.playerData ? victim.playerData.name : "?") +
            " team=" + victimTeam + " onOffense=" + victimIsOnOffense +
            " dir=(" + finalDx.toFixed(2) + "," + finalDy.toFixed(2) + ")");
    }
    
    return { dx: finalDx, dy: finalDy };
}

/**
 * Initiate a knockback animation for a player
 * @param {Object} player - The player being knocked back
 * @param {Object} source - The player doing the shoving
 * @param {number} maxDistance - Maximum knockback distance (12-25 units)
 * @param {Object} systems - Systems object with stateManager (optional, enables smart direction)
 */
function knockBack(player, source, maxDistance, systems) {
    if (!player || !player.moveTo) return;

    // Calculate knockback distance (12-25 units)
    var distance = Math.max(12, Math.min(maxDistance || 12, 25));

    // Calculate direction - use smart direction if systems available
    var direction;
    if (systems && systems.stateManager) {
        direction = calculateSmartShoveDirection(player, source, systems);
    } else {
        // Fallback to simple direction (away from source)
        var dx = player.x - (source ? source.x : player.x);
        var dy = player.y - (source ? source.y : player.y);
        if (dx === 0 && dy === 0) {
            dx = (Math.random() < 0.5) ? 1 : -1;
        }
        var magnitude = Math.sqrt(dx * dx + dy * dy) || 1;
        direction = { dx: dx / magnitude, dy: dy / magnitude };
    }
    
    var dx = direction.dx;
    var dy = direction.dy;

    // Determine primary direction for arrow character
    var arrowChar = "o"; // Default
    var absX = Math.abs(dx);
    var absY = Math.abs(dy);

    if (absX > absY * 1.5) {
        // Primarily horizontal
        arrowChar = dx > 0 ? ">" : "<";
    } else if (absY > absX * 1.5) {
        // Primarily vertical
        arrowChar = dy > 0 ? "v" : "^";
    } else {
        // Diagonal - use strongest component
        if (absX > absY) {
            arrowChar = dx > 0 ? ">" : "<";
        } else {
            arrowChar = dy > 0 ? "v" : "^";
        }
    }

    // Calculate all positions (don't animate yet - non-blocking approach)
    var startX = player.x;
    var startY = player.y;
    var trailPositions = [];
    for (var i = 1; i <= distance; i++) {
        var newX = clampToCourtX(Math.round(startX + dx * i));
        var newY = clampToCourtY(Math.round(startY + dy * i));
        trailPositions.push({ x: newX, y: newY });
    }

    // Store knockback animation data on player for non-blocking animation
    if (!player.knockbackAnim) {
        player.knockbackAnim = {
            active: false,
            positions: [],
            currentStep: 0,
            arrowChar: "o",
            startTime: 0,
            stepDelay: 30,
            shover: null, // Track who did the shoving
            trailPositions: [] // Track where trails are drawn for cleanup
        };
    }

    player.knockbackAnim.active = true;
    player.knockbackAnim.positions = trailPositions;
    player.knockbackAnim.currentStep = 0;
    player.knockbackAnim.arrowChar = arrowChar;
    player.knockbackAnim.startTime = Date.now();
    player.knockbackAnim.stepDelay = 60; // ms per step (slowed from 30ms)
    player.knockbackAnim.shover = source; // Store shover reference
    player.knockbackAnim.trailPositions = []; // Clear old trails

    // Set cooldowns NOW so sprites show during animation
    if (player.playerData) {
        player.playerData.shoveCooldown = 35;
        
        // Apply victim recovery penalty - stun frames based on push distance
        var recoveryFrames = SHOVE_RECOVERY_CONFIG.baseFrames +
            Math.floor(distance * SHOVE_RECOVERY_CONFIG.framesPerPushUnit);
        player.playerData.shoveRecoveryFrames = recoveryFrames;
        
        // Drain victim's turbo as penalty
        if (typeof player.playerData.turbo === "number") {
            player.playerData.turbo = Math.max(0, player.playerData.turbo - SHOVE_RECOVERY_CONFIG.turboDrain);
        }
        
        if (typeof debugLog === "function") {
            debugLog("[SHOVE RECOVERY] " + (player.playerData.name || "victim") +
                " stunned for " + recoveryFrames + " frames, turbo drained by " + SHOVE_RECOVERY_CONFIG.turboDrain);
        }
    }
    if (source && source.playerData) {
        source.playerData.shoverCooldown = 35;
    }

    // Move to first position immediately
    if (trailPositions.length > 0) {
        player.moveTo(trailPositions[0].x, trailPositions[0].y);
    }
}

/**
 * Update all active knockback animations (non-blocking)
 * Called each frame from main game loop
 */
function updateKnockbackAnimations() {
    var allPlayers = getAllPlayers();
    var now = Date.now();

    for (var i = 0; i < allPlayers.length; i++) {
        var player = allPlayers[i];
        if (!player || !player.knockbackAnim || !player.knockbackAnim.active) continue;

        var anim = player.knockbackAnim;
        var elapsed = now - anim.startTime;
        var targetStep = Math.floor(elapsed / anim.stepDelay);

        // Update position if we've reached next step
        if (targetStep > anim.currentStep && targetStep < anim.positions.length) {
            var pos = anim.positions[targetStep];
            player.moveTo(pos.x, pos.y);

            // Draw trail at previous positions (up to 12 trail characters)
            // Use trailFrame for proper layering (prevents court redraw from clearing trails)
            var trailLength = Math.min(12, targetStep);
            for (var t = 1; t <= trailLength; t++) {
                var trailIdx = targetStep - t;
                if (trailIdx >= 0 && trailIdx < anim.positions.length) {
                    var trailPos = anim.positions[trailIdx];
                    // Fade trail based on age (newer = brighter)
                    var trailAttr = t <= 2 ? (LIGHTCYAN | WAS_BROWN) : (CYAN | WAS_BROWN);
                    if (trailFrame && trailFrame.setData) {
                        // Convert game coords (1-based) to frame coords (0-based)
                        var trailX = trailPos.x - 1;
                        var trailY = trailPos.y - 1;
                        trailFrame.setData(trailX, trailY, anim.arrowChar, trailAttr, false);

                        // Track unique positions for cleanup (only on first draw of this step)
                        if (t === 1) {
                            if (!anim.trailPositions) anim.trailPositions = [];
                            anim.trailPositions.push({ x: trailX, y: trailY });
                        }
                    }
                }
            }

            anim.currentStep = targetStep;
        }

        // End animation when complete
        if (targetStep >= anim.positions.length) {
            // Clear all trail positions from overlay frame
            if (trailFrame && anim.trailPositions) {
                var hasClearData = typeof trailFrame.clearData === "function";
                var hasSetData = typeof trailFrame.setData === "function";
                for (var t = 0; t < anim.trailPositions.length; t++) {
                    var pos = anim.trailPositions[t];
                    if (!pos) continue;
                    if (hasClearData) {
                        trailFrame.clearData(pos.x, pos.y, false);
                    } else if (hasSetData) {
                        trailFrame.setData(pos.x, pos.y, undefined, 0, false);
                    }
                }
            }

            anim.active = false;
            anim.currentStep = 0;
            anim.trailPositions = []; // Clear trail tracking

            // Clear cooldowns immediately to restore normal sprites
            // Changed from 3 to 0 - no delay needed since appearance updates happen before sprite movement
            if (player.playerData) {
                player.playerData.shoveCooldown = 0;
            }

            // Also clear shover's cooldown
            if (anim.shover && anim.shover.playerData) {
                anim.shover.playerData.shoverCooldown = 0;
            }

            anim.shover = null; // Clear reference
        }
    }
}
