/**
 * NBA JAM - Shooting System
 * Wave 23: Testable shooting management with explicit dependencies
 * 
 * Responsibilities:
 * - Calculate shot probabilities based on distance, defense, player skill
 * - Handle shot attempts (dunks vs shots)
 * - Animate shots with arc, blocking, deflection
 * - Auto-contest shots (AI defenders)
 * - Emit shooting events (shot_attempt, shot_made, shot_missed, block)
 * 
 * NO direct access to globals - all dependencies injected
 */

/**
 * Create shooting system with explicit dependencies
 * 
 * @param {Object} deps - Dependency object
 * @param {Object} deps.state - State manager for gameState access
 * @param {Object} deps.events - Event bus for communication
 * @param {Object} deps.animations - Animation system for shot arcs
 * @param {Object} deps.rules - Game rules (COURT_WIDTH, THREE_POINT_RADIUS, etc.)
 * @param {Object} deps.helpers - Helper functions (getPlayerTeamName, calculateDistance, etc.)
 * @param {Function} deps.logger - Debug logger function
 * @returns {Object} Shooting system API
 */
function createShootingSystem(deps) {
    // Validate dependencies
    if (!deps || !deps.state || !deps.events || !deps.animations || !deps.rules || !deps.helpers) {
        throw new Error("ShootingSystem requires state, events, animations, rules, and helpers");
    }

    // Unpack dependencies for cleaner code
    var state = deps.state;
    var events = deps.events;
    var animations = deps.animations;
    var rules = deps.rules;
    var helpers = deps.helpers;
    var log = deps.logger || function () { };

    // TEST: Verify logger works
    if (typeof log === 'function') {
        log("=== SHOOTING SYSTEM INITIALIZED ===");
    }

    /**
     * Calculate shot probability based on distance, defense, and player skill
     * 
     * @param {Object} shooter - Player sprite taking shot
     * @param {number} targetX - Basket X coordinate
     * @param {number} targetY - Basket Y coordinate  
     * @param {Object} closestDefender - Nearest defender sprite
     * @returns {number} Shot probability (0-100)
     */
    function calculateShotProbability(shooter, targetX, targetY, closestDefender) {
        if (!shooter || !shooter.playerData) return 0;

        var playerData = shooter.playerData;
        var distanceToBasket = helpers.calculateDistance(shooter.x, shooter.y, targetX, targetY);

        // Get player attributes
        var dunkSkill = helpers.getEffectiveAttribute(playerData, "dunk");
        var threePointSkill = helpers.getEffectiveAttribute(playerData, "3pt");
        var rawDunkSkill = helpers.getBaseAttribute(playerData, "dunk");
        var rawThreeSkill = helpers.getBaseAttribute(playerData, "3pt");
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
            var defenderDistance = helpers.getSpriteDistance(shooter, closestDefender);
            var VERY_TIGHT = rules.SHOOTING && rules.SHOOTING.VERY_TIGHT_DEFENSE_DISTANCE || 4;
            var TIGHT = rules.SHOOTING && rules.SHOOTING.TIGHT_DEFENSE_DISTANCE || 6;
            var MODERATE = rules.SHOOTING && rules.SHOOTING.MODERATE_DEFENSE_DISTANCE || 10;

            if (defenderDistance < VERY_TIGHT) {
                // Heavily contested
                defenderPenalty = 25;
            } else if (defenderDistance < TIGHT) {
                // Contested
                defenderPenalty = 15;
            } else if (defenderDistance < MODERATE) {
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
     * Check if player is in corner three position
     * 
     * @param {Object} player - Player sprite
     * @param {string} teamName - "teamA" or "teamB"
     * @returns {boolean} True if in corner three spot
     */
    function isCornerThreePosition(player, teamName) {
        if (!player || !helpers.getCornerSpots) return false;

        var corners = helpers.getCornerSpots(teamName);
        if (!corners) return false;

        var threshold = 4;
        var px = player.x;
        var py = player.y;
        var best = 999;

        if (corners.top) {
            best = Math.min(best, helpers.calculateDistance(px, py, corners.top.x, corners.top.y));
        }
        if (corners.bottom) {
            best = Math.min(best, helpers.calculateDistance(px, py, corners.bottom.x, corners.bottom.y));
        }

        return best <= threshold;
    }

    /**
     * Auto-contest shot - AI defenders jump to contest
     * 
     * @param {Object} shooter - Player taking shot
     * @param {number} targetX - Basket X
     * @param {number} targetY - Basket Y
     */
    function autoContestShot(shooter, targetX, targetY) {
        var teamName = helpers.getPlayerTeamName(shooter);
        if (!teamName) return;

        var defenders = helpers.getOpposingTeamSprites(teamName);
        var closest = null;
        var closestDist = 999;

        for (var i = 0; i < defenders.length; i++) {
            var defender = defenders[i];
            if (!defender || defender.isHuman) continue;
            var dist = helpers.getSpriteDistance(defender, shooter);
            if (dist < closestDist) {
                closest = defender;
                closestDist = dist;
            }
        }

        var BLOCK_ATTEMPT_DISTANCE = rules.SHOOTING && rules.SHOOTING.BLOCK_ATTEMPT_DISTANCE || 12;
        var BLOCK_CLOSE_BONUS_DISTANCE = rules.SHOOTING && rules.SHOOTING.BLOCK_CLOSE_BONUS_DISTANCE || 5;
        var RIM_BONUS_DISTANCE = rules.SHOOTING && rules.SHOOTING.RIM_BONUS_DISTANCE || 8;
        var RIM_BONUS_PROBABILITY = rules.SHOOTING && rules.SHOOTING.RIM_BONUS_PROBABILITY || 0.4;

        if (closest && !closest.isHuman && closestDist < BLOCK_ATTEMPT_DISTANCE) {
            if (closest.playerData && closest.playerData.turbo > 2 && helpers.activateAITurbo) {
                helpers.activateAITurbo(closest, 0.7, closestDist);
            }
            var closestBlockBoost = closest.playerData
                ? helpers.getEffectiveAttribute(closest.playerData, "block") * 0.2
                : 0;

            if (helpers.attemptBlock) {
                var BLOCK_JUMP_DURATION = rules.BLOCK_JUMP_DURATION || 12;
                helpers.attemptBlock(closest, {
                    duration: BLOCK_JUMP_DURATION + (closestDist < BLOCK_CLOSE_BONUS_DISTANCE ? 4 : 2),
                    heightBoost: closestBlockBoost,
                    direction: shooter.x >= closest.x ? 1 : -1
                });
            }
        }

        for (var j = 0; j < defenders.length; j++) {
            var helper = defenders[j];
            if (!helper || helper === closest || helper.isHuman) continue;
            var rimDist = helpers.calculateDistance(helper.x, helper.y, targetX, targetY);
            if (rimDist < RIM_BONUS_DISTANCE && Math.random() < RIM_BONUS_PROBABILITY) {
                if (helpers.activateAITurbo) {
                    helpers.activateAITurbo(helper, 0.5, rimDist);
                }
                if (helpers.attemptBlock) {
                    var BLOCK_JUMP_DURATION2 = rules.BLOCK_JUMP_DURATION || 12;
                    helpers.attemptBlock(helper, {
                        duration: BLOCK_JUMP_DURATION2 + 2,
                        heightBoost: 0.6,
                        direction: shooter.x >= helper.x ? 1 : -1
                    });
                }
                break;
            }
        }
    }

    /**
     * Animate shot with arc and blocking detection
     * 
     * @param {number} startX - Shot start X
     * @param {number} startY - Shot start Y
     * @param {number} targetX - Basket X
     * @param {number} targetY - Basket Y
     * @param {boolean} made - Whether shot goes in
     * @param {Object} shooter - Player taking the shot
     * @returns {Object} { made: boolean, blocked: boolean, deflectionX: number, deflectionY: number }
     */
    function animateShot(startX, startY, targetX, targetY, made, shooter) {
        // Mark shot in progress
        state.set("shotInProgress", true, "shot_animation_start");
        state.set("shotStartX", startX, "shot_animation_start");
        state.set("shotStartY", startY, "shot_animation_start");

        if (shooter && animations.autoContestShot) {
            autoContestShot(shooter, targetX, targetY);
        }

        // Calculate animation parameters
        var dx = targetX - startX;
        var dy = targetY - startY;
        var distance = Math.sqrt(dx * dx + dy * dy);
        var steps = Math.max(15, Math.round(distance * 1.5));
        var msPerStep = Math.round(800 / steps);

        // Broadcast shot animation to multiplayer if coordinator
        if (helpers.broadcastMultiplayerEvent) {
            helpers.broadcastMultiplayerEvent("shot", {
                startX: startX,
                startY: startY,
                targetX: targetX,
                targetY: targetY,
                made: made,
                shooter: shooter ? helpers.getPlayerGlobalId(shooter) : null
            });
        }

        var blocked = false;
        var deflectionX = null;
        var deflectionY = null;

        // Animate shot arc
        if (animations.animateShotArc) {
            var result = animations.animateShotArc({
                startX: startX,
                startY: startY,
                targetX: targetX,
                targetY: targetY,
                distance: distance,
                steps: steps,
                msPerStep: msPerStep,
                shooter: shooter,
                checkBlock: true
            });

            if (result) {
                blocked = result.blocked || false;
                deflectionX = result.deflectionX;
                deflectionY = result.deflectionY;
                if (blocked) {
                    made = false;
                }
            }
        }

        // Clear shot in progress flag
        state.set("shotInProgress", false, "shot_animation_end");

        // Flash basket if made
        if (made && !blocked && animations.flashBasket) {
            animations.flashBasket(targetX, targetY);
        }

        return {
            made: made && !blocked,
            blocked: blocked,
            deflectionX: deflectionX,
            deflectionY: deflectionY
        };
    }

    /**
     * Main shot attempt function - handles shot logic, determines outcome
     * 
     * @param {Object} shooter - Player taking the shot
     * @param {Object} options - Shot options
     * @param {number} options.targetX - Optional target basket X (auto-calculated if not provided)
     * @param {number} options.targetY - Optional target basket Y (auto-calculated if not provided)
     * @param {boolean} options.animate - Whether to animate the shot (default: true)
     * @returns {Object} Result object with shot outcome
     */
    function attemptShot(shooter, options) {
        options = options || {};

        var currentFlag = state.get("shotInProgress");
        log("=== attemptShot CALLED, shooter=" + (shooter ? "yes" : "NO") + ", shotInProgress=" + currentFlag + " ===");

        // Validation
        if (!shooter || !shooter.playerData) {
            log("Shot FAILED: invalid_shooter");
            return { success: false, reason: 'invalid_shooter' };
        }

        // Prevent multiple simultaneous shot attempts
        if (state.get("shotInProgress")) {
            log("Shot BLOCKED: shotInProgress=true");
            return { success: false, reason: 'shot_in_progress' };
        }        // Check phase state if available
        var currentPhase = state.get("phase.current");
        var PHASE_SHOT_QUEUED = "shot_queued";
        var PHASE_SHOT_ANIMATING = "shot_animating";
        var PHASE_SHOT_SCORED = "shot_scored";
        var PHASE_SHOT_MISSED = "shot_missed";

        if (currentPhase === PHASE_SHOT_QUEUED ||
            currentPhase === PHASE_SHOT_ANIMATING ||
            currentPhase === PHASE_SHOT_SCORED ||
            currentPhase === PHASE_SHOT_MISSED) {
            log("Shot BLOCKED: phase=" + currentPhase);
            return { success: false, reason: 'shot_already_queued' };
        }

        var playerData = shooter.playerData;
        playerData.hasDribble = false;

        // Clamp shooter to court
        if (helpers.clampSpriteFeetToCourt) {
            helpers.clampSpriteFeetToCourt(shooter);
        }

        // OUT-OF-BOUNDS CHECK
        var margin = 2;
        var COURT_WIDTH = rules.COURT_WIDTH || 66;
        var COURT_HEIGHT = rules.COURT_HEIGHT || 40;

        if (shooter.x < margin || shooter.x > COURT_WIDTH - margin ||
            shooter.y < margin || shooter.y > COURT_HEIGHT - margin) {
            // Out of bounds - no shot allowed
            log("SHOT BLOCKED: out of bounds at (" + shooter.x + "," + shooter.y + ")");
            events.emit("shot_blocked_oob", { shooter: shooter });
            return { success: false, reason: 'out_of_bounds' };
        }

        // Sync ball position
        if (helpers.updateBallPosition) {
            helpers.updateBallPosition();
        }

        var shotStartX = state.get("ballX") || (shooter.x + 2);
        var shotStartY = state.get("ballY") || (shooter.y + 2);

        // Determine target basket
        var shooterTeam = helpers.getPlayerTeamName(shooter) || state.get("currentTeam");
        var BASKET_RIGHT_X = rules.BASKET_RIGHT_X || 64;
        var BASKET_RIGHT_Y = rules.BASKET_RIGHT_Y || 20;
        var BASKET_LEFT_X = rules.BASKET_LEFT_X || 2;
        var BASKET_LEFT_Y = rules.BASKET_LEFT_Y || 20;

        var targetX = options.targetX || (shooterTeam === "teamA" ? BASKET_RIGHT_X : BASKET_LEFT_X);
        var targetY = options.targetY || (shooterTeam === "teamA" ? BASKET_RIGHT_Y : BASKET_LEFT_Y);
        var attackDir = shooterTeam === "teamA" ? 1 : -1;

        // Calculate distances
        var rawDx = shooter.x - targetX;
        var rawDy = shooter.y - targetY;
        var scaledDy = rawDy * 2; // ANSI half-height compensation
        var scaledDistance = Math.sqrt(rawDx * rawDx + scaledDy * scaledDy);
        var planarDistance = Math.sqrt(rawDx * rawDx + rawDy * rawDy);

        // Determine shot type and distance
        var THREE_POINT_RADIUS = rules.THREE_POINT_RADIUS || 19;
        var is3Pointer = scaledDistance > THREE_POINT_RADIUS;
        var isCornerThree = isCornerThreePosition(shooter, shooterTeam);

        // Update stats
        var stats = playerData.stats;
        if (stats) {
            stats.fga = (stats.fga || 0) + 1;
            if (is3Pointer) {
                stats.tpa = (stats.tpa || 0) + 1;
            }
        }

        // Get closest defender
        var opposingTeamName = shooterTeam === "teamA" ? "teamB" : "teamA";
        var opposingTeamPlayers = helpers.getTeamSprites(opposingTeamName);
        var closestDefender = helpers.getClosestPlayer(shooter.x, shooter.y, opposingTeamPlayers);

        if (!closestDefender) {
            closestDefender = {
                x: targetX - attackDir * 4,
                y: targetY,
                playerData: null
            };
        }

        // Check for dunk opportunity
        var dunkInfo = null;
        if (helpers.evaluateDunkOpportunity) {
            dunkInfo = helpers.evaluateDunkOpportunity(shooter, shooterTeam, targetX, targetY, scaledDistance);
        }

        var attemptType = dunkInfo ? "dunk" : "shot";
        var made = false;
        var chance = 0;

        // DUNK PATH
        if (attemptType === "dunk") {
            if (stats) {
                stats.dunkAttempts = (stats.dunkAttempts || 0) + 1;
            }

            if (helpers.calculateDunkChance) {
                chance = helpers.calculateDunkChance(playerData, dunkInfo, closestDefender, shooterTeam);
            } else {
                chance = 75; // Fallback
            }

            var roll = Math.random() * 100;
            made = roll < chance;

            // Emit dunk attempt event
            events.emit("shot_attempt", {
                shooter: shooter,
                shooterTeam: shooterTeam,
                attemptType: "dunk",
                chance: chance,
                made: made,
                is3Pointer: false,
                dunkInfo: dunkInfo
            });

            // Queue dunk animation via phase system if available
            if (helpers.setPhase) {
                helpers.setPhase("shot_queued", {
                    shooter: shooter,
                    shooterTeam: shooterTeam,
                    shotStartX: shotStartX,
                    shotStartY: shotStartY,
                    targetX: targetX,
                    targetY: targetY,
                    made: made,
                    blocked: false,
                    is3Pointer: false,
                    attemptType: "dunk",
                    dunkInfo: dunkInfo,
                    flightPlan: flightPlan,
                    style: style,
                    animDuration: flightPlan.totalDurationMs || 600,
                    reboundBounces: []
                }, 0);
            }

            // Clear shotInProgress immediately - phase handler will manage from here
            log("Dunk queued successfully, clearing shotInProgress flag");
            state.set("shotInProgress", false, "dunk_queued_ready_for_next");

            return {
                success: true,
                attemptType: "dunk",
                made: made,
                chance: chance,
                style: style,
                queued: true
            };
        }

        // SHOT PATH (non-dunk)
        var threeAttr = helpers.getEffectiveAttribute(playerData, "3pt");
        var dunkAttr = helpers.getEffectiveAttribute(playerData, "dunk");
        var baseChance = 0;

        if (is3Pointer) {
            baseChance = 40 + (threeAttr * 4);
        } else if (planarDistance < 10) {
            baseChance = 60 + (dunkAttr * 3);
        } else {
            baseChance = 50 + ((dunkAttr + threeAttr) * 2);
        }

        if (isCornerThree) {
            baseChance += 6;
        }

        // Distance penalty
        var distancePenalty = is3Pointer ?
            (scaledDistance - THREE_POINT_RADIUS) * 1.5 :
            (planarDistance - 3) * 0.8;
        if (distancePenalty < 0) distancePenalty = 0;
        if (isCornerThree && is3Pointer) {
            distancePenalty *= 0.6;
        }

        chance = baseChance - distancePenalty;
        if (chance < 20) chance = 20;
        if (chance > 95) chance = 95;

        // Hot streak bonus
        chance += (playerData.heatStreak || 0) * 5;

        // On fire bonus
        if (playerData.onFire) {
            chance += 15;
            if (chance > 99) chance = 99;
        }

        // Defense penalty
        var defenderDistance = helpers.getSpriteDistance(shooter, closestDefender);
        if (defenderDistance < 8) {
            var defenderData = closestDefender.playerData;
            var defensePenalty = (8 - defenderDistance) * (2 + (defenderData ? helpers.getEffectiveAttribute(defenderData, "block") * 0.5 : 2));

            // Reduce penalty if defender is behind/beside
            var relX = (closestDefender.x - shooter.x) * attackDir;
            var relY = Math.abs(closestDefender.y - shooter.y);
            var directionalFactor = relX >= 0 ? 1 : Math.max(0.25, 1 + (relX / 6));
            var lateralFactor = Math.max(0.35, 1 - (relY / 10));
            var coverageFactor = Math.max(0.2, Math.min(1, directionalFactor * lateralFactor));

            defensePenalty *= coverageFactor;
            chance -= defensePenalty;
            if (chance < 15) chance = 15;
        }

        made = Math.random() * 100 < chance;

        // Emit shot attempt event
        events.emit("shot_attempt", {
            shooter: shooter,
            shooterTeam: shooterTeam,
            attemptType: "shot",
            chance: chance,
            made: made,
            is3Pointer: is3Pointer,
            isCornerThree: isCornerThree,
            distance: planarDistance
        });

        // Queue shot animation via phase system if available
        if (helpers.setPhase) {
            helpers.setPhase("shot_queued", {
                shooter: shooter,
                shooterTeam: shooterTeam,
                shotStartX: shotStartX,
                shotStartY: shotStartY,
                targetX: targetX,
                targetY: targetY,
                made: made,
                blocked: false,
                is3Pointer: is3Pointer,
                attemptType: "shot",
                animDuration: 800,
                reboundBounces: []
            }, 0);
        }

        // BUGFIX: Clear shotInProgress immediately since animation system doesn't clear it properly
        // The phase handler will manage shot state from here
        log("Shot queued successfully, clearing shotInProgress flag");
        state.set("shotInProgress", false, "shot_queued_ready_for_next");

        return {
            success: true,
            attemptType: "shot",
            made: made,
            chance: chance,
            is3Pointer: is3Pointer,
            queued: true
        };
    }

    // PUBLIC API
    return {
        calculateShotProbability: calculateShotProbability,
        isCornerThreePosition: isCornerThreePosition,
        autoContestShot: autoContestShot,
        animateShot: animateShot,
        attemptShot: attemptShot
    };
}
