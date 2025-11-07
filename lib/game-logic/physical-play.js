/**
 * NBA JAM - Physical Play System Module
 * 
 * Handles all physical play mechanics including:
 * - Shake (ball-handler clearing defenders)
 * - Shove (offensive and defensive pushing)
 * - Shove opportunity evaluation (AI decision making)
 * - Defensive rotation after shoves
 * - Loose ball creation from successful shoves
 * - Visual appearance updates (shoved/shover sprite states)
 * 
 * Dependencies:
 * - Game state (gameState with ballCarrier, reboundActive, shotClock, etc.)
 * - Player utilities (getPlayerTeamName, getTouchingOpponents, getTeammate, getAllPlayers, getEffectiveAttribute)
 * - Court utilities (getSpriteDistance, distanceBetweenPoints, clampToCourtX, clampToCourtY)
 * - Physical mechanics (knockBack, setPlayerKnockedDown, incrementInjury)
 * - Game flow (recordTurnover, switchPossession, announceEvent, flushKeyboardBuffer)
 * - Rebounds (createRebound, resolveReboundScramble for loose balls)
 * - Ball frame (moveBallFrameTo for loose ball animation)
 * - Shooting (attemptShot, calculateShotProbability)
 * - Passing (animatePass)
 * - Sprite system (Sprite.cycle, applyInjectedBearing, mergeShovedBearingsIntoSprite, mergeShoverBearingsIntoSprite)
 * - Team utilities (getOpposingTeamSprites, getClosestPlayer, getOffensiveBasket)
 * - Defense (assignDefensiveMatchups, getPlayerKey)
 * - Animation (courtFrame, drawScore)
 * - Multiplayer coordinator (event broadcasting)
 * - Constants (ATTR_POWER, TURBO_DRAIN_RATE, DOUBLE_TEAM_RADIUS, SHOVE_FAILURE_STUN, SHOT_PROBABILITY_THRESHOLD, BASKET_*, KEY_DEPTH)
 */

/**
 * Attempt shake - ball handler clears nearby defenders
 * Uses power attribute + turbo bonus to knock back multiple defenders
 * Can cause knockdowns based on power differential
 * 
 * Returns: true if shake succeeded, false otherwise
 */
function attemptShake(player) {
    if (!player || !player.playerData) return false;
    var teamName = getPlayerTeamName(player);
    if (!teamName) return false;
    if (player.playerData.shakeCooldown > 0) return false;

    player.playerData.shakeCooldown = 25;

    var power = getEffectiveAttribute(player.playerData, ATTR_POWER) || 5;
    var turboBonus = (player.playerData.turboActive && player.playerData.turbo > 0) ? 2 : 0;
    var touching = getTouchingOpponents(player, teamName, 2.75);
    if (!touching.length) return false;

    var affected = 0;
    var knockdownCount = 0;

    for (var i = 0; i < touching.length; i++) {
        var defender = touching[i];
        if (!defender || !defender.playerData) continue;
        var defenderPower = getEffectiveAttribute(defender.playerData, ATTR_POWER) || 5;
        var aggressorScore = power + turboBonus;
        var threshold = (aggressorScore + 6) / (aggressorScore + defenderPower + 12);
        threshold = clamp(threshold, 0.15, 0.9);
        if (Math.random() > threshold) continue;

        var push = Math.max(1, Math.min(5, Math.round((aggressorScore - defenderPower) / 2 + 2 + Math.random() * 2)));
        knockBack(defender, player, push);
        incrementInjury(defender, 1);
        affected++;

        var knockdownChance = Math.max(0, (aggressorScore - defenderPower) * 0.08 + Math.random() * 0.1);
        knockdownChance = Math.min(knockdownChance, 0.45);
        if (Math.random() < knockdownChance) {
            setPlayerKnockedDown(defender, 32 + Math.round(Math.random() * 18));
            knockdownCount++;
        }
    }

    if (affected > 0) {
        player.playerData.hasDribble = true;
        if (player.playerData.turboActive) player.playerData.useTurbo(TURBO_DRAIN_RATE);
        var eventKey = knockdownCount > 0 ? "shake_knockdown" : "shake_break";
        announceEvent(eventKey, {
            player: player,
            team: teamName,
            playerName: player.playerData.name
        });
        return true;
    }
    return false;
}

/**
 * Handle AI decision after successful shake
 * Evaluates whether to shoot or pass based on shot probability
 * 
 * Returns: true if action taken, false otherwise
 */
function handlePostShakeDecision(player, teamName) {
    if (!player || player.isHuman || !player.playerData) return false;
    var basket = getOffensiveBasket(teamName);
    var opponentTeam = teamName === "red" ? "blue" : "red";
    var closestDefender = getClosestPlayer(player.x, player.y, opponentTeam);
    var shotProb = calculateShotProbability(player, basket.x, basket.y, closestDefender);
    if (shotProb >= (SHOT_PROBABILITY_THRESHOLD - 6)) {
        player.playerData.aiLastAction = "shake_shot";
        attemptShot();
        return true;
    }

    var teammate = getTeammate(player);
    if (teammate && teammate.playerData) {
        var teammateClosest = getClosestPlayer(teammate.x, teammate.y, opponentTeam);
        var teammateProb = calculateShotProbability(teammate, basket.x, basket.y, teammateClosest);
        var leadTarget = null;
        if (teammate.playerData.emergencyCut) {
            leadTarget = teammate.playerData.emergencyCut.leadTarget || teammate.playerData.aiTargetSpot;
        }
        if (teammateProb >= (SHOT_PROBABILITY_THRESHOLD - 10) || !closestDefender || getSpriteDistance(player, closestDefender) < 3) {
            player.playerData.aiLastAction = "shake_pass";
            animatePass(player, teammate, leadTarget);
            return true;
        }
    }
    return false;
}

/**
 * Create loose ball after successful shove
 * Animates ball bouncing away from shove, triggers rebound scramble
 */
function createLooseBall(defender, victim) {
    var startX = gameState.ballX || (victim ? victim.x + 2 : defender.x);
    var startY = gameState.ballY || (victim ? victim.y + 2 : defender.y);
    var dirX = victim ? (victim.x - defender.x) : 1;
    var dirY = victim ? (victim.y - defender.y) : 0;
    if (dirX === 0 && dirY === 0) dirX = 1;

    var magnitude = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    dirX /= magnitude;
    dirY /= magnitude;

    var endX = clampToCourtX(Math.round(startX + dirX * 6));
    var endY = clampToCourtY(Math.round(startY + dirY * 3));

    var skipAnimation = mpCoordinator && mpCoordinator.isCoordinator;
    if (!skipAnimation) {
        // Single-player: Use blocking animation
        var steps = 8;
        for (var i = 0; i <= steps; i++) {
            var t = i / steps;
            var bx = Math.round(startX + (endX - startX) * t);
            var by = Math.round(startY + (endY - startY) * t - Math.sin(t * Math.PI) * 2);
            if (moveBallFrameTo) moveBallFrameTo(bx, by);
            Sprite.cycle();
            cycleFrame(courtFrame);
            drawScore();  // Update score display to show shoved visual effect
            mswait(25);
        }
    }

    gameState.reboundActive = true;
    gameState.shotInProgress = false;
    gameState.ballCarrier = null;
    gameState.reboundX = endX;
    gameState.reboundY = endY;
    clearPotentialAssist();
    // Note: "shove" announcement already fired in attemptShove(), so skip "loose_ball" here
    resolveReboundScramble();
}

/**
 * AI SHOVE DECISION SYSTEM
 * Evaluates offensive shove opportunities with weighted priorities
 * 
 * Priorities (per shove_documentation.md):
 * 1. Ball-handler surrounded - shake nearest defender (80% weight)
 * 2. Teammate has ball and struggling - shove their defender (60% weight)
 * 3. Open for pass but defender blocking - shove to clear lane (50% weight)
 * 4. Rebounding - shove opponent if teammate closer to ball (40% weight)
 * 
 * Returns: { target, score, reason } or null
 */
function evaluateOffensiveShoveOpportunity(player, teamName) {
    if (!player || !player.playerData) return null;
    if (player.playerData.shoveAttemptCooldown > 0) return null;

    var ballCarrier = gameState.ballCarrier;
    var isBallHandler = (player === ballCarrier);
    var teammate = getTeammate(player, teamName);
    var opponents = getOpposingTeamSprites(teamName);
    if (!opponents || opponents.length === 0) return null;

    var bestTarget = null;
    var bestScore = 0;
    var bestReason = "";

    // PRIORITY 1: Ball-handler surrounded - shake nearest defender (80% weight)
    if (isBallHandler && ballCarrier) {
        var nearbyDefenders = 0;
        var closestDefender = null;
        var closestDefDist = 999;

        for (var i = 0; i < opponents.length; i++) {
            var opp = opponents[i];
            if (!opp) continue;
            var dist = getSpriteDistance(player, opp);
            if (dist < DOUBLE_TEAM_RADIUS) nearbyDefenders++;
            if (dist < closestDefDist) {
                closestDefDist = dist;
                closestDefender = opp;
            }
        }

        // Surrounded = 2+ defenders nearby OR very close single defender
        var surrounded = nearbyDefenders >= 2 || closestDefDist < 3;
        if (surrounded && closestDefender && closestDefDist <= 4.0) {
            var score = 80; // Base 80% priority
            if (closestDefDist < 2.5) score += 10; // Bonus for very close
            if (nearbyDefenders >= 2) score += 10; // Bonus for double team
            if (score > bestScore) {
                bestScore = score;
                bestTarget = closestDefender;
                bestReason = "surrounded_shake";
            }
        }
    }

    // PRIORITY 2: Teammate has ball and struggling - shove their defender (60% weight)
    if (!isBallHandler && teammate === ballCarrier && teammate.playerData) {
        var teammateDefender = getClosestPlayer(teammate.x, teammate.y, teamName === "red" ? "blue" : "red");
        if (teammateDefender) {
            var distToTeammateDefender = getSpriteDistance(player, teammateDefender);
            var teammateDefDist = getSpriteDistance(teammate, teammateDefender);

            // Teammate struggling = defender very close OR ball handler stuck
            var teammateStruggling = teammateDefDist < 3.5 || gameState.ballHandlerStuckTimer >= 2;

            if (teammateStruggling && distToTeammateDefender <= 4.0) {
                var score = 60; // Base 60% priority
                if (gameState.ballHandlerStuckTimer >= 3) score += 15; // Bonus for very stuck
                if (teammateDefDist < 2.5) score += 10; // Bonus for tight defense
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = teammateDefender;
                    bestReason = "help_teammate";
                }
            }
        }
    }

    // PRIORITY 3: Open for pass but defender blocking - shove to clear lane (50% weight)
    if (!isBallHandler && ballCarrier) {
        var myDefender = getClosestPlayer(player.x, player.y, teamName === "red" ? "blue" : "red");
        if (myDefender) {
            var distToMyDef = getSpriteDistance(player, myDefender);
            var distToBallCarrier = getSpriteDistance(player, ballCarrier);

            // Check if defender is between me and ball carrier (blocking pass lane)
            var defenderBlockingLane = false;
            if (distToMyDef < 4 && distToBallCarrier < 15) {
                var dx = ballCarrier.x - player.x;
                var dy = ballCarrier.y - player.y;
                var defDx = myDefender.x - player.x;
                var defDy = myDefender.y - player.y;
                // Dot product to check if defender is in direction of ball carrier
                var dotProduct = (dx * defDx + dy * defDy) / (Math.sqrt(dx * dx + dy * dy) * Math.sqrt(defDx * defDx + defDy * defDy));
                defenderBlockingLane = dotProduct > 0.7; // Similar direction
            }

            if (defenderBlockingLane && distToMyDef <= 4.0) {
                var score = 50; // Base 50% priority
                if (distToMyDef < 2.5) score += 10; // Bonus for close defender
                if (gameState.shotClock <= 10) score += 10; // Urgency bonus
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = myDefender;
                    bestReason = "clear_pass_lane";
                }
            }
        }
    }

    // PRIORITY 4: Rebounding - shove opponent if teammate closer to ball (40% weight)
    if (gameState.reboundActive && gameState.reboundX && gameState.reboundY) {
        var reboundX = gameState.reboundX;
        var reboundY = gameState.reboundY;
        var myDistToRebound = distanceBetweenPoints(player.x, player.y, reboundX, reboundY);
        var teammateDistToRebound = teammate ? distanceBetweenPoints(teammate.x, teammate.y, reboundX, reboundY) : 999;

        // Teammate is closer to rebound - help by boxing out
        if (teammateDistToRebound < myDistToRebound - 3) {
            var closestOpp = null;
            var closestOppDist = 999;
            for (var j = 0; j < opponents.length; j++) {
                var opp2 = opponents[j];
                if (!opp2) continue;
                var distToOpp = getSpriteDistance(player, opp2);
                if (distToOpp < closestOppDist) {
                    closestOppDist = distToOpp;
                    closestOpp = opp2;
                }
            }

            if (closestOpp && closestOppDist <= 4.0) {
                var score = 40; // Base 40% priority
                if (closestOppDist < 2.5) score += 10; // Bonus for close opponent
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = closestOpp;
                    bestReason = "rebound_boxout";
                }
            }
        }
    }

    if (bestTarget && bestScore > 35) { // Minimum threshold
        return {
            target: bestTarget,
            score: bestScore,
            reason: bestReason
        };
    }

    return null;
}

/**
 * Evaluate defensive shove opportunities with weighted priorities
 * 
 * Priorities (per shove_documentation.md):
 * 1. Prevent dead dribble shot near basket (90% weight)
 * 2. Disrupt cuts to basket (70% weight)
 * 3. Rebound box-out (60% weight)
 * 
 * Requires: Help defender within 8 units for rotation
 * 
 * Returns: { target, score, reason } or null
 */
function evaluateDefensiveShoveOpportunity(player, teamName) {
    if (!player || !player.playerData) return null;
    if (player.playerData.shoveAttemptCooldown > 0) return null;

    var ballCarrier = gameState.ballCarrier;
    if (!ballCarrier) return null;

    var opponents = getOpposingTeamSprites(teamName);
    if (!opponents || opponents.length === 0) return null;

    var teammate = getTeammate(player, teamName);
    var bestTarget = null;
    var bestScore = 0;
    var bestReason = "";

    // Check help defender availability (never shove if help >8 units away)
    var helpDefenderAvailable = false;
    if (teammate) {
        var distToTeammate = getSpriteDistance(player, teammate);
        if (distToTeammate <= 8) {
            helpDefenderAvailable = true;
        }
    }

    if (!helpDefenderAvailable) {
        return null; // Don't shove without help rotation available
    }

    // PRIORITY 1: Prevent dead dribble shot near basket (90% weight)
    var isDribbleDead = ballCarrier.playerData && ballCarrier.playerData.hasDribble === false;
    if (isDribbleDead) {
        var myBasketX = teamName === "red" ? BASKET_LEFT_X : BASKET_RIGHT_X;
        var ballCarrierDistToBasket = distanceBetweenPoints(ballCarrier.x, ballCarrier.y, myBasketX, BASKET_LEFT_Y);
        var distToBallCarrier = getSpriteDistance(player, ballCarrier);

        // Dead dribble near basket = high danger
        if (ballCarrierDistToBasket < 15 && distToBallCarrier <= 4.0) {
            var score = 90; // Base 90% priority
            if (ballCarrierDistToBasket < 10) score += 10; // Very close to basket
            if (distToBallCarrier < 2.5) score += 10; // Very close to carrier
            if (score > bestScore) {
                bestScore = score;
                bestTarget = ballCarrier;
                bestReason = "prevent_dead_dribble_shot";
            }
        }
    }

    // PRIORITY 2: Disrupt cuts to basket (70% weight)
    for (var i = 0; i < opponents.length; i++) {
        var opp = opponents[i];
        if (!opp || opp === ballCarrier) continue;

        var myBasket = teamName === "red" ? BASKET_LEFT_X : BASKET_RIGHT_X;
        var oppDistToBasket = distanceBetweenPoints(opp.x, opp.y, myBasket, BASKET_LEFT_Y);
        var distToOpp = getSpriteDistance(player, opp);

        // Check if opponent is cutting (moving toward basket)
        var cuttingToBasket = false;
        if (opp.playerData && opp.playerData.aiTargetSpot) {
            var targetDistToBasket = distanceBetweenPoints(opp.playerData.aiTargetSpot.x, opp.playerData.aiTargetSpot.y, myBasket, BASKET_LEFT_Y);
            cuttingToBasket = targetDistToBasket < oppDistToBasket - 3; // Moving closer to basket
        }

        if (cuttingToBasket && oppDistToBasket < 20 && distToOpp <= 4.0) {
            var score = 70; // Base 70% priority
            if (oppDistToBasket < 12) score += 10; // Close to basket
            if (distToOpp < 2.5) score += 10; // Close to cutter
            if (score > bestScore) {
                bestScore = score;
                bestTarget = opp;
                bestReason = "disrupt_cut";
            }
        }
    }

    // PRIORITY 3: Rebound box-out (60% weight)
    if (gameState.reboundActive && gameState.reboundX && gameState.reboundY) {
        var reboundX = gameState.reboundX;
        var reboundY = gameState.reboundY;

        for (var j = 0; j < opponents.length; j++) {
            var opp2 = opponents[j];
            if (!opp2) continue;

            var oppDistToRebound = distanceBetweenPoints(opp2.x, opp2.y, reboundX, reboundY);
            var myDistToRebound = distanceBetweenPoints(player.x, player.y, reboundX, reboundY);
            var distToOpp2 = getSpriteDistance(player, opp2);

            // Opponent closer to rebound - box them out
            if (oppDistToRebound < myDistToRebound && distToOpp2 <= 4.0) {
                var score = 60; // Base 60% priority
                if (distToOpp2 < 2.5) score += 10; // Close to opponent
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = opp2;
                    bestReason = "defensive_rebound_boxout";
                }
            }
        }
    }

    if (bestTarget && bestScore > 55) { // Minimum threshold for defensive shoves
        return {
            target: bestTarget,
            score: bestScore,
            reason: bestReason
        };
    }

    return null;
}

/**
 * Trigger defensive rotation when a defender is shoved
 * Help defender rotates to cover ball carrier or open man
 * If both defenders shoved, switch to zone defense temporarily
 */
function triggerDefensiveRotation(shovedDefender, defensiveTeam) {
    if (!shovedDefender || !defensiveTeam) return;

    var ballCarrier = gameState.ballCarrier;
    if (!ballCarrier) return;

    // Find help defender (teammate of shoved defender)
    var helpDefender = getTeammate(shovedDefender, defensiveTeam);
    if (!helpDefender || !helpDefender.playerData) return;

    // Check if help defender is within rotation range (8 units)
    var distToHelp = getSpriteDistance(shovedDefender, helpDefender);
    if (distToHelp > 8) {
        // No rotation available - help too far away
        return;
    }

    // Check if both defenders are shoved
    var bothShoved = (shovedDefender.playerData.shoveCooldown > 0 &&
        helpDefender.playerData.shoveCooldown > 0);

    if (bothShoved) {
        // Switch to zone defense temporarily
        try {
            log(LOG_DEBUG, "Both defenders shoved - switching to zone defense");
        } catch (e) { }
        // Set flag on both defenders to play zone
        if (shovedDefender.playerData) shovedDefender.playerData.playZoneDefense = 60; // 60 frames of zone
        if (helpDefender.playerData) helpDefender.playerData.playZoneDefense = 60;
        return;
    }

    // Help defender rotates - priority: ball > open man > shover
    var offensivePlayers = getOpposingTeamSprites(defensiveTeam);
    if (!offensivePlayers || offensivePlayers.length < 2) return;

    var rotationTarget = null;
    var rotationReason = "";

    // PRIORITY 1: Cover ball carrier
    var distToBallCarrier = getSpriteDistance(helpDefender, ballCarrier);
    var otherOffensivePlayer = null;
    for (var i = 0; i < offensivePlayers.length; i++) {
        if (offensivePlayers[i] && offensivePlayers[i] !== ballCarrier) {
            otherOffensivePlayer = offensivePlayers[i];
            break;
        }
    }

    var distToOther = otherOffensivePlayer ? getSpriteDistance(helpDefender, otherOffensivePlayer) : 999;

    // Closest to ball = highest priority
    if (distToBallCarrier < distToOther) {
        rotationTarget = ballCarrier;
        rotationReason = "cover_ball";
    } else if (otherOffensivePlayer) {
        // PRIORITY 2: Cover open man (non-ball carrier)
        rotationTarget = otherOffensivePlayer;
        rotationReason = "cover_open_man";
    }

    // Update defensive assignment
    if (rotationTarget) {
        var helpDefenderKey = getPlayerKey(helpDefender);
        if (!gameState.defensiveAssignments) {
            gameState.defensiveAssignments = {};
        }
        gameState.defensiveAssignments[helpDefenderKey] = rotationTarget;

        try {
            log(LOG_DEBUG, "Defensive rotation: help defender now covering " + rotationReason);
        } catch (e) { }

        // Clear any existing momentum/target so rotation takes effect immediately
        if (helpDefender.playerData) {
            helpDefender.playerData.aiTargetSpot = null;
            helpDefender.playerData.aiCooldown = 0;
        }
    }
}

/**
 * Attempt shove - core mechanic for pushing opponents
 * 
 * Success factors:
 * - Base 30% chance
 * - +0-15% for power differential
 * - +10% for shoving from behind/side
 * - Ball state modifier: +20% dead dribble, -40% active dribble, -20% off-ball
 * - Clamped to 15-75%
 * 
 * Success: Knockback victim, create loose ball (if ball carrier), trigger rotation
 * Failure: Stun attacker for SHOVE_FAILURE_STUN frames
 */
function attemptShove(defender, targetOverride) {
    if (!defender || !defender.playerData) return;
    if (defender.playerData.shoveAttemptCooldown > 0) return;

    // MULTIPLAYER: Only coordinator makes shove decisions
    if (mpCoordinator && !mpCoordinator.isCoordinator) {
        // Clients wait for coordinator's broadcast
        return;
    }

    // Allow targeting specific player (for off-ball shoving) or default to ball carrier
    var victim = targetOverride || gameState.ballCarrier;
    if (!victim || !victim.playerData) return;

    // Don't allow shoving teammates
    var defenderTeam = getPlayerTeamName(defender);
    var victimTeam = getPlayerTeamName(victim);
    if (defenderTeam === victimTeam) return;

    var distance = getSpriteDistance(defender, victim);
    if (distance > 4.0) return;  // Increased from 2.5 to 4.0 for more frequent shoves

    // Ball-handler shake limitation: once per possession OR 2+ seconds of dead dribble
    if (victim === gameState.ballCarrier && defender === gameState.ballCarrier) {
        // This is a "shake" (ball-handler shoving defender)
        var deadElapsed = getBallHandlerDeadElapsed();
        if (defender.playerData.shakeUsedThisPossession && deadElapsed < 2000) {
            // Already used shake this possession and haven't had 2+ seconds of dead dribble
            return;
        }
    }

    // Determine ball state context for success calculation
    var ballState = "none";
    var isOffBall = false;
    if (victim === gameState.ballCarrier) {
        if (victim.playerData.hasDribble === false) {
            ballState = "picked_up";  // Dribble dead - easiest to shove
        } else {
            ballState = "dribbling";  // Active dribble - harder to shove
        }
    } else {
        ballState = "off_ball";  // Not ball carrier - medium difficulty
        isOffBall = true;
    }

    var defPower = getEffectiveAttribute(defender.playerData, ATTR_POWER) || 5;
    if (defender.playerData.turboActive && defender.playerData.turbo > 0) {
        defPower += 2;
        defender.playerData.useTurbo(TURBO_DRAIN_RATE * 0.5);
    }
    var victimPower = getEffectiveAttribute(victim.playerData, ATTR_POWER) || 5;

    // Base success rate: 30% (per shove_documentation.md)
    var successChance = 0.30;

    // Skill modifier: +0-15% based on power difference
    var powerDiff = defPower - victimPower;
    var skillBonus = Math.max(0, Math.min(0.15, powerDiff * 0.015)); // 0-15% based on power difference
    successChance += skillBonus;

    // Directional bonus: +10% when shoving from behind/side
    var dx = victim.x - defender.x;
    var dy = victim.y - defender.y;
    var angleToVictim = Math.atan2(dy, dx);
    var victimFacing = victim.playerData.facing || 0;
    var angleDiff = Math.abs(angleToVictim - victimFacing);
    // Normalize angle difference to 0-PI range
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    angleDiff = Math.abs(angleDiff);
    // If attacking from behind (angle > 90 degrees) or side (angle > 45 degrees), bonus
    if (angleDiff > Math.PI / 4) { // > 45 degrees = side or behind
        successChance += 0.10;
    }

    // Modify based on ball state context
    if (ballState === "picked_up") {
        // High success when dribble picked up
        successChance *= 1.2;
    } else if (ballState === "dribbling") {
        // Reduced success during active dribbling
        successChance *= 0.6;
    } else if (ballState === "off_ball") {
        // Medium success for off-ball shoving
        successChance *= 0.8;
    }

    // Clamp to reasonable bounds
    if (successChance < 0.15) successChance = 0.15;
    if (successChance > 0.75) successChance = 0.75;

    var rng = Math.random();

    if (rng < successChance) {
        // Shove succeeded! Set attack cooldown to prevent spam
        var cooldownFrames = isOffBall ? 20 : 35;
        defender.playerData.shoveAttemptCooldown = cooldownFrames;

        // Mark shake as used this possession if ball-handler shaking
        if (victim === gameState.ballCarrier && defender === gameState.ballCarrier) {
            defender.playerData.shakeUsedThisPossession = true;
        }

        // Start non-blocking knockback animation
        // Cooldowns will be set inside knockBack() when animation starts
        var basePush = 15;
        var powerBonus = (defPower - victimPower) * 2;
        var push = Math.max(12, Math.min(25, basePush + powerBonus));
        knockBack(victim, defender, push); // Sets cooldowns and stores shover reference
        incrementInjury(victim, 1);

        // Defensive rotation logic - if defender (victim) was shoved on defense
        var victimTeam = getPlayerTeamName(victim);
        var defenderTeam = getPlayerTeamName(defender);
        if (victimTeam !== defenderTeam && victimTeam === gameState.currentTeam) {
            // Offensive player shoved a defender - trigger rotation
            triggerDefensiveRotation(victim, victimTeam);
        }

        // Only create loose ball if victim is the ball carrier
        if (victim === gameState.ballCarrier) {
            victim.playerData.hasDribble = false;
            announceEvent("shove", {
                playerName: defender.playerData.name,
                player: defender,
                team: getPlayerTeamName(defender)
            });
            createLooseBall(defender, victim);
        } else {
            // Off-ball shove - just knock back for positioning
            announceEvent("shove_offball", {
                playerName: defender.playerData.name,
                player: defender,
                team: getPlayerTeamName(defender)
            });
        }

        // MULTIPLAYER: Broadcast shove event to clients
        if (mpCoordinator && mpCoordinator.isCoordinator) {
            mpCoordinator.broadcastGameState({
                type: 'shove',
                success: true,
                attackerId: getPlayerGlobalId(defender),
                victimId: getPlayerGlobalId(victim),
                victimPos: { x: victim.x, y: victim.y },
                pushDistance: push,
                cooldowns: {
                    attackerAttempt: defender.playerData.shoveAttemptCooldown,
                    victimShoved: victim.playerData.shoveCooldown
                },
                createdLooseBall: victim === gameState.ballCarrier,
                timestamp: Date.now()
            });
        }
    } else {
        // Shove failed! Apply stun penalty to attacker
        var cooldownFrames = isOffBall ? 20 : 35;
        defender.playerData.shoveAttemptCooldown = cooldownFrames;
        defender.playerData.shoveFailureStun = SHOVE_FAILURE_STUN;

        // MULTIPLAYER: Broadcast shove failure to clients
        if (mpCoordinator && mpCoordinator.isCoordinator) {
            mpCoordinator.broadcastGameState({
                type: 'shove',
                success: false,
                attackerId: getPlayerGlobalId(defender),
                victimId: getPlayerGlobalId(victim),
                cooldowns: {
                    attackerAttempt: defender.playerData.shoveAttemptCooldown,
                    attackerStun: defender.playerData.shoveFailureStun
                },
                timestamp: Date.now()
            });
        }

        try {
            log(LOG_DEBUG, defender.playerData.name + " failed shove attempt - stunned for " + SHOVE_FAILURE_STUN + " frames");
        } catch (e) { }
    }
}

/**
 * Update player's visual appearance when shoved
 * Switches to shoved_* bearing when cooldown > 0
 * Restores normal bearing when cooldown expires
 */
function updatePlayerShovedAppearance(player) {
    if (!player || !player.playerData || !player.frame) return;

    var shoveCooldown = player.playerData.shoveCooldown || 0;
    var isShoved = shoveCooldown > 0;
    var currentBearing = player.bearing || "e";
    var isInShovedState = currentBearing.indexOf("shoved_") === 0;

    // Ensure sprite has shoved bearings merged
    if (!player.__shovedBearingsMerged) {
        if (!mergeShovedBearingsIntoSprite(player)) {
            return; // Failed to merge, can't show shoved state
        }
    }

    if (isShoved && !isInShovedState) {
        // Switch to shoved bearing - strip any existing prefix first
        var baseBearing = currentBearing.replace("shoved_", "").replace("shover_", "");
        var shovedBearing = "shoved_" + baseBearing;

        // Verify bearing exists
        var availableBearings = (player.ini && player.ini.bearings) || [];
        if (availableBearings.indexOf(shovedBearing) === -1) {
            try {
                log(LOG_WARNING, "Shoved bearing not found: " + shovedBearing);
            } catch (e) { }
            return;
        }

        // Apply the injected bearing frame
        if (applyInjectedBearing(player, shovedBearing)) {
            player.bearing = shovedBearing;
            try {
                log(LOG_INFO, "Applied shoved bearing: " + shovedBearing);
            } catch (e) { }
        }
    } else if (!isShoved && isInShovedState) {
        // Restore normal bearing
        var baseBearing = currentBearing.replace("shoved_", "");

        if (typeof player.turnTo === "function") {
            player.turnTo(baseBearing);
        }

        // Re-apply jersey mask to restore customization
        if (player.__jerseyConfig) {
            applyUniformMask(player, player.__jerseyConfig);
        }

        try {
            log(LOG_INFO, "Restored normal bearing: " + baseBearing);
        } catch (e) { }
    }
}

/**
 * Update player's visual appearance when actively shoving another player
 * Switches to shover_* bearing when shoverCooldown > 0
 * Restores normal bearing when cooldown expires
 */
function updatePlayerShoverAppearance(player) {
    if (!player || !player.playerData || !player.frame) return;

    var shoverCooldown = player.playerData.shoverCooldown || 0;
    var isShoving = shoverCooldown > 0;
    var currentBearing = player.bearing || "e";
    var isInShoverState = currentBearing.indexOf("shover_") === 0;

    // Ensure sprite has shover bearings merged
    if (!player.__shoverBearingsMerged) {
        if (!mergeShoverBearingsIntoSprite(player)) {
            return; // Failed to merge, can't show shover state
        }
    }

    if (isShoving && !isInShoverState) {
        // Switch to shover bearing
        var baseBearing = currentBearing.replace("shoved_", "").replace("shover_", "");
        var shoverBearing = "shover_" + baseBearing;

        // Verify bearing exists
        var availableBearings = (player.ini && player.ini.bearings) || [];
        if (availableBearings.indexOf(shoverBearing) === -1) {
            try {
                log(LOG_DEBUG, "Shover bearing not found: " + shoverBearing);
            } catch (e) { }
            return;
        }

        // Apply the injected bearing frame
        if (applyInjectedBearing(player, shoverBearing)) {
            player.bearing = shoverBearing;
            try {
                log(LOG_INFO, "Applied shover bearing: " + shoverBearing);
            } catch (e) { }
        }
    } else if (!isShoving && isInShoverState) {
        // Restore normal bearing
        var baseBearing = currentBearing.replace("shover_", "");

        if (typeof player.turnTo === "function") {
            player.turnTo(baseBearing);
        }

        // Re-apply jersey mask to restore customization
        if (player.__jerseyConfig) {
            applyUniformMask(player, player.__jerseyConfig);
        }

        try {
            log(LOG_INFO, "Restored normal shover bearing: " + baseBearing);
        } catch (e) { }
    }
}
