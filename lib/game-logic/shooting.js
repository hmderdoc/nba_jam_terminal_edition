/**
 * Shooting System - Core shooting mechanics (non-dunk shots)
 * 
 * Functions:
 * - calculateShotProbability() - Shot quality evaluation
 * - attemptShot() - Main shooting logic
 * - animateShot() - Shot animation with arc and blocking
 * - autoContestShot() - AI defensive contest
 * - isCornerThreePosition() - Corner three detection
 * 
 * Dependencies: game-state, player-class, constants, dunks (for evaluateDunkOpportunity)
 */

load("sbbsdefs.js");

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
 */
function autoContestShot(shooter, targetX, targetY) {
    var teamName = getPlayerTeamName(shooter);
    if (!teamName) return;

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

    if (closest && !closest.isHuman && closestDist < GAME_BALANCE.SHOOTING.BLOCK_ATTEMPT_DISTANCE) {
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
        });
    }

    for (var j = 0; j < defenders.length; j++) {
        var helper = defenders[j];
        if (!helper || helper === closest || helper.isHuman) continue;
        var rimDist = distanceBetweenPoints(helper.x, helper.y, targetX, targetY);
        if (rimDist < GAME_BALANCE.SHOOTING.RIM_BONUS_DISTANCE && Math.random() < GAME_BALANCE.SHOOTING.RIM_BONUS_PROBABILITY) {
            activateAITurbo(helper, 0.5, rimDist);
            attemptBlock(helper, {
                duration: BLOCK_JUMP_DURATION + 2,
                heightBoost: 0.6,
                direction: shooter.x >= helper.x ? 1 : -1
            });
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
 * Animate shot with arc and blocking detection
 * @param {number} startX - Shot start X
 * @param {number} startY - Shot start Y
 * @param {number} targetX - Basket X
 * @param {number} targetY - Basket Y
 * @param {boolean} made - Whether shot goes in
 * @returns {Object} { made: boolean, blocked: boolean }
 */
function animateShot(startX, startY, targetX, targetY, made) {
    // Mark shot in progress
    gameState.shotInProgress = true;
    gameState.shotStartX = startX;
    gameState.shotStartY = startY;

    var shooter = gameState.ballCarrier;
    if (shooter) {
        autoContestShot(shooter, targetX, targetY);
    }

    // Calculate distance to determine animation speed
    var dx = targetX - startX;
    var dy = targetY - startY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    // More steps for longer shots, realistic timing
    // NBA shot takes about 0.5-1.5 seconds depending on distance
    var steps = Math.max(15, Math.round(distance * 1.5));
    var msPerStep = Math.round(800 / steps); // Total ~800-1200ms for shot

    // Broadcast shot animation to other players (coordinator only)
    if (mpCoordinator && mpCoordinator.isCoordinator) {
        mpCoordinator.broadcastEvent("shot", {
            startX: startX,
            startY: startY,
            targetX: targetX,
            targetY: targetY,
            made: made,
            shooter: shooter ? getPlayerGlobalId(shooter) : null
        });
    }

    // Announce shot is in progress at start
    var blocked = false;
    var defaultShotTrailAttr = LIGHTGRAY | WAS_BROWN;

    for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var x = Math.round(startX + (dx * t));
        // Higher arc for longer shots
        var arcHeight = Math.min(5, 3 + (distance / 10));
        var y = Math.round(startY + (dy * t) - (Math.sin(t * Math.PI) * arcHeight));
        var clampedX = clamp(x, 1, COURT_WIDTH);
        var clampedY = clamp(y, 1, COURT_HEIGHT);

        // CHECK FOR BLOCK - if ball is in arc (t > 0.1 && t < 0.5) and blocker is jumping
        if (!blocked && gameState.activeBlock && gameState.blockJumpTimer > 0 && t > 0.1 && t < 0.5) {
            var blocker = gameState.activeBlock;
            // Check if blocker is near ball trajectory
            var blockDist = Math.sqrt(Math.pow(blocker.x - clampedX, 2) + Math.pow(blocker.y - clampedY, 2));

            if (blockDist < 4) { // Blocker must be very close
                // Check block attribute for success
                var blockChance = getEffectiveAttribute(blocker.playerData, ATTR_BLOCK) * 8 + 20; // 20-100%
                if (Math.random() * 100 < blockChance) {
                    blocked = true;
                    if (blocker.playerData && blocker.playerData.stats) {
                        blocker.playerData.stats.blocks++;
                    }
                    announceEvent("block", {
                        playerName: blocker.playerData.name,
                        player: blocker,
                        team: getPlayerTeamName(blocker)
                    });
                    made = false; // Block prevents made shot

                    // Calculate deflection vector - ball bounces away from blocker
                    var deflectDirX = clampedX - blocker.x;
                    var deflectDirY = clampedY - blocker.y;
                    var deflectLen = Math.sqrt(deflectDirX * deflectDirX + deflectDirY * deflectDirY);
                    if (deflectLen > 0.1) {
                        deflectDirX /= deflectLen;
                        deflectDirY /= deflectLen;
                    } else {
                        // Fallback: random deflection if directly on blocker
                        deflectDirX = Math.random() < 0.5 ? -1 : 1;
                        deflectDirY = Math.random() < 0.5 ? -1 : 1;
                    }

                    // Animate deflection path (6-10 units away from block point)
                    var deflectDistance = 6 + Math.floor(Math.random() * 5);
                    var deflectSteps = 8;
                    var deflectStartX = clampedX;
                    var deflectStartY = clampedY;

                    for (var d = 1; d <= deflectSteps; d++) {
                        var deflectT = d / deflectSteps;
                        var deflectX = Math.round(deflectStartX + deflectDirX * deflectDistance * deflectT);
                        var deflectY = Math.round(deflectStartY + deflectDirY * deflectDistance * deflectT);
                        // Add slight downward arc to deflection
                        var deflectArc = Math.sin(deflectT * Math.PI) * 2;
                        deflectY = Math.round(deflectY - deflectArc);

                        var deflectClampedX = clamp(deflectX, 1, COURT_WIDTH);
                        var deflectClampedY = clamp(deflectY, 1, COURT_HEIGHT);

                        moveBallFrameTo(deflectClampedX, deflectClampedY);

                        // Draw deflection trail
                        if (d > 1) {
                            var prevDeflectT = (d - 1) / deflectSteps;
                            var prevDeflectX = Math.round(deflectStartX + deflectDirX * deflectDistance * prevDeflectT);
                            var prevDeflectY = Math.round(deflectStartY + deflectDirY * deflectDistance * prevDeflectT - Math.sin(prevDeflectT * Math.PI) * 2);
                            prevDeflectX = clamp(prevDeflectX, 1, COURT_WIDTH);
                            prevDeflectY = clamp(prevDeflectY, 1, COURT_HEIGHT);
                            courtFrame.gotoxy(prevDeflectX, prevDeflectY);
                            courtFrame.putmsg("*", LIGHTRED | WAS_BROWN); // Red trail for blocked shot
                        }

                        Sprite.cycle();
                        cycleFrame(courtFrame);
                        mswait(msPerStep);
                    }

                    // Store final deflection position for rebound creation
                    gameState.blockDeflectionX = clamp(Math.round(deflectStartX + deflectDirX * deflectDistance), 2, COURT_WIDTH - 2);
                    gameState.blockDeflectionY = clamp(Math.round(deflectStartY + deflectDirY * deflectDistance), 2, COURT_HEIGHT - 2);

                    break; // End shot animation after deflection
                }
            }
        }

        // Draw ball at this position
        moveBallFrameTo(clampedX, clampedY);

        // Draw trail
        if (i > 0) {
            var prevT = (i - 1) / steps;
            var prevX = Math.round(startX + (dx * prevT));
            var prevY = Math.round(startY + (dy * prevT) - (Math.sin(prevT * Math.PI) * arcHeight));
            prevX = clamp(prevX, 1, COURT_WIDTH);
            prevY = clamp(prevY, 1, COURT_HEIGHT);
            courtFrame.gotoxy(prevX, prevY);
            var trailAttr = getOnFireTrailAttr(shooter, i, defaultShotTrailAttr);
            courtFrame.putmsg(".", trailAttr);
        }

        Sprite.cycle();
        cycleFrame(courtFrame);
        mswait(msPerStep);
    }

    // Clear shot in progress flag
    gameState.shotInProgress = false;

    // Flash basket if made
    if (made && !blocked) {
        for (var flash = 0; flash < 3; flash++) {
            // Flash rim (2 characters wide)
            courtFrame.gotoxy(targetX - 1, targetY);
            courtFrame.putmsg("*", YELLOW | WAS_BROWN);
            courtFrame.gotoxy(targetX + 1, targetY);
            courtFrame.putmsg("*", YELLOW | WAS_BROWN);
            cycleFrame(courtFrame);
            mswait(100);
            drawCourt();
            mswait(100);
        }
    }

    // Return result object
    return { made: made && !blocked, blocked: blocked };
}

/**
 * Main shot attempt function - handles shot logic, animation, and consequences
 */
function attemptShot() {
    var player = gameState.ballCarrier;
    if (!player) return;

    var playerData = player.playerData;
    if (!playerData) return;
    playerData.hasDribble = false;

    clampSpriteFeetToCourt(player);

    // === OUT-OF-BOUNDS SHOT PREVENTION ===
    // Check if player is out of bounds before allowing shot
    var margin = 2; // Safety margin from edge
    if (player.x < margin || player.x > COURT_WIDTH - margin ||
        player.y < margin || player.y > COURT_HEIGHT - margin) {
        // Player is out of bounds - no shot allowed
        // Keep possession but deny the shot attempt
        try {
            log(LOG_DEBUG, "Shot blocked: player out of bounds at (" + player.x + ", " + player.y + ")");
        } catch (e) { }
        return;
    }

    // Sync ball coordinates to the shooter's current position before calculations/animation
    updateBallPosition();
    var shotStartX = (typeof gameState.ballX === "number") ? gameState.ballX : player.x + 2;
    var shotStartY = (typeof gameState.ballY === "number") ? gameState.ballY : player.y + 2;

    var shooterTeam = getPlayerTeamName(player) || gameState.currentTeam;
    var targetX = shooterTeam === "teamA" ? BASKET_RIGHT_X : BASKET_LEFT_X;
    var targetY = shooterTeam === "teamA" ? BASKET_RIGHT_Y : BASKET_LEFT_Y;
    var attackDir = shooterTeam === "teamA" ? 1 : -1;

    // Calculate distances with scaled Y to reflect ANSI half-height cells
    var rawDx = player.x - targetX;
    var rawDy = player.y - targetY;
    var scaledDy = rawDy * 2;
    var scaledDistance = Math.sqrt(rawDx * rawDx + scaledDy * scaledDy);
    var planarDistance = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    var distance = planarDistance;

    // Determine if this is a 3-pointer (outside the 3-point arc)
    var is3Pointer = scaledDistance > THREE_POINT_RADIUS;
    var isCornerThree = isCornerThreePosition(player, shooterTeam);
    var stats = playerData.stats;

    if (stats) {
        stats.fga++;
        if (is3Pointer) stats.tpa++;
    }

    var closestDefender = getClosestPlayer(player.x, player.y, gameState.currentTeam === "teamA" ? "teamB" : "teamA");
    if (!closestDefender) {
        closestDefender = {
            x: targetX - attackDir * 4,
            y: targetY,
            playerData: null
        };
    }

    var dunkInfo = evaluateDunkOpportunity(player, shooterTeam, targetX, targetY, scaledDistance);
    var attemptType = dunkInfo ? "dunk" : "shot";
    if (dunkInfo && stats) {
        stats.dunkAttempts = (stats.dunkAttempts || 0) + 1;
    }

    var dunkStyle = null;
    var dunkBlocker = null;

    // Base shooting chance from player attributes (more generous)
    var baseChance;
    var chance;
    var made;
    var blocked = false;

    if (attemptType === "dunk") {
        chance = calculateDunkChance(playerData, dunkInfo, closestDefender, shooterTeam);
        made = Math.random() * 100 < chance;
        var dunkResult = animateDunk(player, dunkInfo, targetX, targetY, made);
        made = dunkResult.made;
        blocked = dunkResult.blocked;
        if (dunkResult.style) dunkStyle = dunkResult.style;
        if (dunkResult.blocker) dunkBlocker = dunkResult.blocker;
        distance = dunkInfo.adjustedDistance;
    } else {
        var threeAttr = getEffectiveAttribute(playerData, ATTR_3PT);
        var dunkAttr = getEffectiveAttribute(playerData, ATTR_DUNK);
        if (is3Pointer) {
            baseChance = 40 + (threeAttr * 4);
        } else if (distance < 10) {
            baseChance = 60 + (dunkAttr * 3);
        } else {
            baseChance = 50 + ((dunkAttr + threeAttr) * 2);
        }

        if (isCornerThree) {
            baseChance += 6;
        }

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

        chance += playerData.heatStreak * 5;

        if (playerData.onFire) {
            chance += 15;
            if (chance > 99) chance = 99;
        }

        var dx = Math.abs(player.x - closestDefender.x);
        var dy = Math.abs(player.y - closestDefender.y);
        var defenseDistance = Math.sqrt(dx * dx + dy * dy);

        if (defenseDistance < 8) {
            var defenderData = closestDefender.playerData;
            var defensePenalty = (8 - defenseDistance) * (2 + (defenderData ? getEffectiveAttribute(defenderData, ATTR_BLOCK) * 0.5 : 2));

            // Reduce penalty if defender is behind or off to the side
            var relX = (closestDefender.x - player.x) * attackDir;
            var relY = Math.abs(closestDefender.y - player.y);
            var directionalFactor;
            if (relX >= 0) {
                directionalFactor = 1; // Defender between shooter and hoop
            } else {
                directionalFactor = Math.max(0.25, 1 + (relX / 6));
            }
            var lateralFactor = Math.max(0.35, 1 - (relY / 10));
            var coverageFactor = Math.max(0.2, Math.min(1, directionalFactor * lateralFactor));
            defensePenalty *= coverageFactor;
            chance -= defensePenalty;
            if (chance < 15) chance = 15;
        }

        made = Math.random() * 100 < chance;

        // DEBUG: Log which path we're taking
        try {
            log(LOG_DEBUG, "[SHOT PATH] mpCoordinator: " + (mpCoordinator ? "exists" : "null") + 
                ", isCoordinator: " + (mpCoordinator && mpCoordinator.isCoordinator ? "true" : "false"));
        } catch(e) {}

        // Coordinator: Use non-blocking executeShot()
        if (mpCoordinator && mpCoordinator.isCoordinator) {
            try {
                log(LOG_DEBUG, "[SHOT PATH] Taking MULTIPLAYER COORDINATOR path");
            } catch(e) {}
            var shotResult = executeShot(player, shotStartX, shotStartY, targetX, targetY);
            made = shotResult.made;
            blocked = shotResult.blocked;
            is3Pointer = shotResult.is3Pointer;

            // Handle post-shot mechanics (executeShot already did game logic)
            if (made) {
                mswait(100);  // Brief pause
                drawScore();
                mswait(700);  // Total 800ms pause (was 800 in original)
                setupInbound(gameState.currentTeam);
            } else {
                mswait(200);  // Brief pause
                // For jump shots, executeShot sets reboundActive but doesn't call createRebound
                // We need to call createRebound to activate the scramble state and queue animations
                try {
                    log(LOG_DEBUG, "[SHOT PATH] Miss - calling createRebound(), reboundActive before: " + gameState.reboundActive);
                } catch(e) {}
                createRebound(targetX, targetY);
                try {
                    log(LOG_DEBUG, "[SHOT PATH] After createRebound(), reboundScramble.active: " + gameState.reboundScramble.active);
                } catch(e) {}
            }
            return;  // Early return - executeShot() already handled all game logic
        } else {
            // Single-player: Use blocking animation (backward compatible)
            try {
                log(LOG_DEBUG, "[SHOT PATH] Taking SINGLE-PLAYER path");
            } catch(e) {}
            var shotResult = animateShot(shotStartX, shotStartY, targetX, targetY, made);
            made = shotResult.made;
            blocked = shotResult.blocked;
        }
    }

    if (attemptType === "dunk") {
        is3Pointer = false;
    }

    if (made) {
        // Score!
        var points = is3Pointer ? 3 : 2;
        gameState.score[gameState.currentTeam] += points;
        gameState.consecutivePoints[gameState.currentTeam]++;
        playerData.heatStreak++;
        if (typeof playerData.fireMakeStreak !== "number") playerData.fireMakeStreak = 0;
        playerData.fireMakeStreak++;
        if (stats) {
            stats.points += points;
            stats.fgm++;
            if (is3Pointer) stats.tpm++;
            if (attemptType === "dunk") stats.dunks = (stats.dunks || 0) + 1;
        }
        maybeAwardAssist(player);
        clearPotentialAssist();

        var scoringTeamKey = gameState.currentTeam;
        var inboundTeamKey = (scoringTeamKey === "teamA") ? "teamB" : "teamA";

        // Refill turbo for both teams on made basket so inbound side can push the pace too
        var scoringSprites = spriteRegistry.getByTeam(scoringTeamKey);
        for (var i = 0; i < scoringSprites.length; i++) {
            if (scoringSprites[i] && scoringSprites[i].playerData) {
                scoringSprites[i].playerData.turbo = MAX_TURBO;
            }
        }
        var inboundSprites = spriteRegistry.getByTeam(inboundTeamKey);
        for (var j = 0; j < inboundSprites.length; j++) {
            if (inboundSprites[j] && inboundSprites[j].playerData) {
                inboundSprites[j].playerData.turbo = MAX_TURBO;
            }
        }

        // Announcer callouts
        if (attemptType === "dunk") {
            announceEvent("dunk", {
                playerName: playerData.name,
                player: player,
                team: gameState.currentTeam,
                style: dunkStyle
            });
        } else if (is3Pointer) {
            announceEvent("three_pointer", {
                playerName: playerData.name,
                player: player,
                team: gameState.currentTeam
            });
        } else {
            announceEvent("shot_made", {
                playerName: playerData.name,
                player: player,
                team: gameState.currentTeam
            });
        }

        // Check for ON FIRE
        if (!playerData.onFire && playerData.fireMakeStreak >= 3) {
            setPlayerOnFire(player);
            announceEvent("on_fire", {
                playerName: playerData.name,
                player: player,
                team: gameState.currentTeam
            });
        }

        // Reset other team's streak
        gameState.consecutivePoints[inboundTeamKey] = 0;
        clearTeamOnFire(inboundTeamKey);

        triggerPossessionBeep();
        startScoreFlash(scoringTeamKey, inboundTeamKey);
        drawScore();

        // Set up inbound play after made basket
        mswait(attemptType === "dunk" ? 900 : 800);  // Brief pause to see the score
        setupInbound(scoringTeamKey);
    } else {
        // Miss - reset streak
        gameState.consecutivePoints[gameState.currentTeam] = 0;
        playerData.heatStreak = 0;

        // Brief pause to see the miss
        mswait(200);
        if (attemptType === "dunk") {
            if (blocked) {
                announceEvent("block", {
                    playerName: dunkBlocker && dunkBlocker.playerData ? dunkBlocker.playerData.name : "",
                    player: dunkBlocker,
                    team: dunkBlocker ? getPlayerTeamName(dunkBlocker) : null
                });
            } else {
                announceEvent("shot_missed", {
                    playerName: playerData.name,
                    player: player,
                    team: gameState.currentTeam
                });
            }
        } else if (!blocked) {
            announceEvent("shot_missed", {
                playerName: playerData.name,
                player: player,
                team: gameState.currentTeam
            });
        }
        mswait(200);

        if (!blocked || attemptType !== "dunk") {
            clearPotentialAssist();
        }

        try {
            log(LOG_DEBUG, "[SHOT PATH] Single-player miss handling - attemptType: " + attemptType + ", blocked: " + blocked);
        } catch(e) {}

        if (attemptType === "dunk" && blocked) {
            if (!gameState.reboundActive) {
                try {
                    log(LOG_DEBUG, "[SHOT PATH] Blocked dunk - calling createRebound()");
                } catch(e) {}
                createRebound(targetX, targetY);
            }
        } else if (blocked && typeof gameState.blockDeflectionX === "number" && typeof gameState.blockDeflectionY === "number") {
            // Blocked shot - create rebound at deflection point
            try {
                log(LOG_DEBUG, "[SHOT PATH] Blocked shot - calling createRebound() at deflection point");
            } catch(e) {}
            createRebound(gameState.blockDeflectionX, gameState.blockDeflectionY);
            // Clear deflection position
            gameState.blockDeflectionX = undefined;
            gameState.blockDeflectionY = undefined;
        } else {
            // Normal miss - create rebound at basket
            try {
                log(LOG_DEBUG, "[SHOT PATH] Normal miss - calling createRebound() at basket");
            } catch(e) {}
            createRebound(targetX, targetY);
        }
    }
}
