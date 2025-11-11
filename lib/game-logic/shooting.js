/**
 * Shooting System - LEGACY/DEPRECATED CODE
 * 
 * WARNING: Most of this file is NOT USED in Wave 23D+
 * - animateShot() with mswait() is DEAD CODE - shooting-system.js uses phase queue
 * - attemptShot() is a thin wrapper that delegates to systems.shootingSystem
 * 
 * This file is kept for:
 * - calculateShotProbability() - used by AI
 * - autoContestShot() - used by shooting system
 * - isCornerThreePosition() - used by shooting system
 * 
 * TODO Wave 25: Extract active functions to utils, delete this file
 */

load("sbbsdefs.js");
load("lib/utils/debug-logger.js");

/**
 * Calculate shot probability based on distance, defense, and player skill
 * @param {Object} shooter - Player sprite taking shot
 * @param {number} targetX - Basket X coordinate
 * @param {number} targetY - Basket Y coordinate
 * @param {Object} closestDefender - Nearest defender sprite
 * @returns {number} Shot probability (0-100)
 */
function calculateShotProbability(shooter, targetX, targetY, closestDefender) {
    if (!shooter || !shooter.playerData) return 0;

    var playerData = shooter.playerData;
    var distanceToBasket = distanceBetweenPoints(shooter.x, shooter.y, targetX, targetY);
    var dunkSkill = getEffectiveAttribute(playerData, ATTR_DUNK);
    var threePointSkill = getEffectiveAttribute(playerData, ATTR_3PT);
    var rawDunkSkill = getBaseAttribute(playerData, ATTR_DUNK);
    var rawThreeSkill = getBaseAttribute(playerData, ATTR_3PT);
    var skillEdge = threePointSkill - dunkSkill;

    // 1. BASE PROBABILITY FROM DISTANCE (closer = better)
    var baseProbability;
    if (distanceToBasket < 5) {
        // Layup/dunk range
        baseProbability = 85;
    } else if (distanceToBasket < 12) {
        // Close range
        baseProbability = 70;
    } else if (distanceToBasket < 18) {
        // Mid-range
        baseProbability = 55;
    } else if (distanceToBasket < 25) {
        // 3-point range
        baseProbability = 40;
    } else {
        // Deep/half court
        baseProbability = 15;
    }

    // Encourage dunkers to stay aggressive at the rim and penalize bailout twos
    if (distanceToBasket < 12 && rawDunkSkill >= 6 && !playerData.onFire) {
        baseProbability -= (rawDunkSkill - 5) * 4;
        if (distanceToBasket < 8) {
            baseProbability -= (rawDunkSkill - 5) * 3;
        }
    }
    if (distanceToBasket < 10 && rawDunkSkill <= 3) {
        baseProbability += (4 - rawDunkSkill) * 3;
    }
    if (distanceToBasket >= 18 && rawThreeSkill >= 7) {
        baseProbability += 5;
    }
    if (baseProbability < 5) baseProbability = 5;

    // 2. ATTRIBUTE MULTIPLIER (player skill)
    var attributeMultiplier = 1.0;
    if (distanceToBasket < 8) {
        // Close range - use dunk attribute
        attributeMultiplier = 0.7 + (dunkSkill / 10) * 0.6; // 0.7 to 1.3
    } else {
        // Perimeter - use 3point attribute
        attributeMultiplier = 0.7 + (threePointSkill / 10) * 0.6; // 0.7 to 1.3
    }

    if (distanceToBasket >= 18) {
        if (skillEdge >= 3) {
            baseProbability += 6;
        } else if (skillEdge >= 2) {
            baseProbability += 3;
        }
    }

    // 3. DEFENDER PENALTY (proximity to defender)
    var defenderPenalty = 0;
    if (closestDefender) {
        var defenderDistance = getSpriteDistance(shooter, closestDefender);
        if (defenderDistance < GAME_BALANCE.SHOOTING.VERY_TIGHT_DEFENSE_DISTANCE) {
            // Heavily contested
            defenderPenalty = 25;
        } else if (defenderDistance < GAME_BALANCE.SHOOTING.TIGHT_DEFENSE_DISTANCE) {
            // Contested
            defenderPenalty = 15;
        } else if (defenderDistance < GAME_BALANCE.SHOOTING.MODERATE_DEFENSE_DISTANCE) {
            // Lightly guarded
            defenderPenalty = 8;
        }
        // else: wide open (no penalty)

        if (distanceToBasket >= 18 && defenderPenalty > 0) {
            defenderPenalty = Math.max(0, defenderPenalty - 4);
        }
    }

    // COMBINED FORMULA
    var finalProbability = (baseProbability * attributeMultiplier) - defenderPenalty;

    if (distanceToBasket >= 18) {
        if (skillEdge >= 3) {
            finalProbability += 10;
        } else if (skillEdge >= 2) {
            finalProbability += 6;
        } else if (skillEdge >= 1) {
            finalProbability += 3;
        }
    }

    // Clamp to 0-100 range
    if (finalProbability < 0) finalProbability = 0;
    if (finalProbability > 95) finalProbability = 95;

    return finalProbability;
}

/**
 * Auto-contest shot - AI defenders jump to contest
 * @param {Object} shooter - Player taking shot
 * @param {number} targetX - Basket X
 * @param {number} targetY - Basket Y
 * @param {Object} systems - Systems object for dependency injection
 */
function autoContestShot(shooter, targetX, targetY, systems) {
    var teamName = getPlayerTeamName(shooter);
    if (!teamName) return;

    debugLog("[AUTO CONTEST] Shot by " + teamName + " at (" + shooter.x + "," + shooter.y + ")");

    var defenders = getOpposingTeamSprites(teamName);
    var closest = null;
    var closestDist = 999;

    for (var i = 0; i < defenders.length; i++) {
        var defender = defenders[i];
        if (!defender || defender.isHuman) continue;
        var dist = getSpriteDistance(defender, shooter);
        if (dist < closestDist) {
            closest = defender;
            closestDist = dist;
        }
    }

    debugLog("[AUTO CONTEST] Closest defender dist=" + closestDist + ", threshold=" + GAME_BALANCE.SHOOTING.BLOCK_ATTEMPT_DISTANCE);

    if (closest && !closest.isHuman && closestDist < GAME_BALANCE.SHOOTING.BLOCK_ATTEMPT_DISTANCE) {
        debugLog("[AUTO CONTEST] Closest defender attempting block!");
        if (closest.playerData && closest.playerData.turbo > 2) {
            activateAITurbo(closest, 0.7, closestDist);
        }
        var closestBlockBoost = closest.playerData
            ? getEffectiveAttribute(closest.playerData, ATTR_BLOCK) * 0.2
            : 0;
        attemptBlock(closest, {
            duration: BLOCK_JUMP_DURATION + (closestDist < GAME_BALANCE.SHOOTING.BLOCK_CLOSE_BONUS_DISTANCE ? 4 : 2),
            heightBoost: closestBlockBoost,
            direction: shooter.x >= closest.x ? 1 : -1
        }, systems);
    }

    for (var j = 0; j < defenders.length; j++) {
        var helper = defenders[j];
        if (!helper || helper === closest || helper.isHuman) continue;
        var rimDist = distanceBetweenPoints(helper.x, helper.y, targetX, targetY);
        if (rimDist < GAME_BALANCE.SHOOTING.RIM_BONUS_DISTANCE && Math.random() < GAME_BALANCE.SHOOTING.RIM_BONUS_PROBABILITY) {
            debugLog("[AUTO CONTEST] Helper defender attempting block from rim!");
            activateAITurbo(helper, 0.5, rimDist);
            attemptBlock(helper, {
                duration: BLOCK_JUMP_DURATION + 2,
                heightBoost: 0.6,
                direction: shooter.x >= helper.x ? 1 : -1
            }, systems);
            break;
        }
    }
}

/**
 * Check if player is in corner three position
 * @param {Object} player - Player sprite
 * @param {string} teamName - "teamA" or "teamB"
 * @returns {boolean} True if in corner three spot
 */
function isCornerThreePosition(player, teamName) {
    if (!player) return false;
    var corners = getCornerSpots(teamName);
    if (!corners) return false;
    var threshold = 4;
    var px = player.x;
    var py = player.y;
    var best = 999;
    if (corners.top) {
        best = Math.min(best, distanceBetweenPoints(px, py, corners.top.x, corners.top.y));
    }
    if (corners.bottom) {
        best = Math.min(best, distanceBetweenPoints(px, py, corners.bottom.x, corners.bottom.y));
    }
    return best <= threshold;
}

/**
 * Main shot attempt function - handles shot logic, animation, and consequences
 */
function attemptShot(systems) {
    debugLog(">>> shooting.js attemptShot() CALLED");

    var stateManager = systems.stateManager;
    var player = stateManager.get('ballCarrier');
    if (!player) {
        debugLog(">>> attemptShot ABORT: no ballCarrier");
        return;
    }

    var playerData = player.playerData;
    if (!playerData) {
        debugLog(">>> attemptShot ABORT: no playerData");
        return;
    }

    // Wave 23: Delegate to shooting system - REQUIRED
    if (!systems.shootingSystem) {
        throw new Error("ARCHITECTURE ERROR: shootingSystem not initialized. Call initializeSystems() in main() before gameplay.");
    }

    debugLog(">>> Calling systems.shootingSystem.attemptShot for " + playerData.name);
    return systems.shootingSystem.attemptShot(player);
}

