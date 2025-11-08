/**
 * NBA JAM - AI Ball Handler
 * 
 * Offensive logic for AI player controlling the ball
 * Handles decision-making for passing, shooting, and driving to basket
 */

/**
 * NEW AI - Ball Carrier Offensive Logic
 * Based on design principles:
 * - Always advance ball (backcourt -> frontcourt -> basket)
 * - Use shot probability calculation with 40% threshold
 * - Avoid violations (10-sec backcourt, over-and-back, 24-sec shot clock)
 * - Smart passing with intent
 * - Proper turbo usage (direction + turbo + direction change)
 * 
 * DEAD CODE - SAFE TO DELETE
 * Not called in current code or backup. Replaced by aiOffenseBall() in lib/ai/offense-ball-handler.js.
 */
function handleAIBallCarrier(player, teamName, systems) {
    var playerData = player.playerData;
    if (!playerData) return;

    // Setup court coordinates
    var targetBasketX = teamName === "teamA" ? BASKET_RIGHT_X : BASKET_LEFT_X;
    var targetBasketY = BASKET_LEFT_Y;
    var myBasketX = teamName === "teamA" ? BASKET_LEFT_X : BASKET_RIGHT_X;
    var attackDirection = teamName === "teamA" ? 1 : -1;

    // Get game situation
    var inBackcourt = isInBackcourt(player, teamName);
    var distanceToBasket = distanceBetweenPoints(player.x, player.y, targetBasketX, targetBasketY);
    var closestDefender = getClosestPlayer(player.x, player.y, getOpposingTeam(teamName));
    var defenderDist = closestDefender ? getSpriteDistance(player, closestDefender) : 999;
    var closestDefenderDistToBasket = closestDefender ? getSpriteDistanceToBasket(closestDefender, teamName) : 999;
    var teammate = getTeammate(player, teamName);

    // === AI SHOVE EVALUATION (Offensive) ===
    var shoveOpportunity = evaluateOffensiveShoveOpportunity(player, teamName, systems);
    if (shoveOpportunity && Math.random() * 100 < shoveOpportunity.score) {
        attemptShove(player, shoveOpportunity.target);
        try {
            log(LOG_DEBUG, "AI offensive shove: " + shoveOpportunity.reason + " (score: " + shoveOpportunity.score + ")");
        } catch (e) { }
    }

    // === CORNER TRAP DETECTION ===
    // Check if AI is trapped in corner - high priority escape
    if (typeof isTrappedInCorner === "function" && isTrappedInCorner(player, teamName)) {
        // Trapped in corner with defenders nearby
        // Try to pass out first if teammate available
        if (teammate) {
            var teammateInBounds = (teammate.x >= 2 && teammate.x <= COURT_WIDTH - 7 &&
                teammate.y >= 2 && teammate.y <= COURT_HEIGHT - 5);
            var teammateNotInCorner = !isInCorner(teammate);

            if (teammateInBounds && teammateNotInCorner) {
                // Pass to teammate to escape corner trap
                animatePass(player, teammate);
                return;
            }
        }

        // No safe pass - execute emergency corner escape
        if (typeof executeCornerEscape === "function") {
            executeCornerEscape(player, teamName);
            return;
        }
    }

    // TRANSITION OFFENSE - If I just got a rebound near my own basket, push it forward fast
    var myDistFromMyBasket = Math.abs(player.x - myBasketX);
    var courtMidX = Math.floor(COURT_WIDTH / 2);
    var nearMyOwnBasket = myDistFromMyBasket < 15; // Within 15 units of my own basket

    // === FAST BREAK DETECTION ===
    var fastBreak = (typeof detectFastBreak === "function")
        ? detectFastBreak(player, teamName)
        : null;

    if (fastBreak && fastBreak.isFastBreak) {
        // FAST BREAK OPPORTUNITY - push tempo!
        var fbTarget = getFastBreakTarget(fastBreak, teamName);

        // Use turbo on fast breaks if available
        if (shouldUseTurboOnFastBreak(fastBreak, player) && playerData.turbo > 10) {
            var fbDist = distanceBetweenPoints(player.x, player.y, fbTarget.x, fbTarget.y);
            // Aggressive turbo usage on fast breaks
            activateAITurbo(player, 0.9, fbDist);
        }

        moveAITowards(player, fbTarget.x, fbTarget.y);
        return;
    } else if (nearMyOwnBasket && inBackcourt) {
        // Fallback: Legacy fast break logic if detection module not available
        // FAST BREAK - push the ball up court aggressively
        var pushTargetX = teamName === "teamA" ? courtMidX + 15 : courtMidX - 15;
        var pushTargetY = BASKET_LEFT_Y;

        // Always use turbo on fast break
        if (playerData.turbo > 10) {
            var fastBreakDist = distanceBetweenPoints(player.x, player.y, pushTargetX, pushTargetY);
            activateAITurbo(player, 0.8, fastBreakDist); // High turbo for fast break
        }

        moveAITowards(player, pushTargetX, pushTargetY);
        return;
    }

    // Check for trapped (2+ defenders nearby OR very close defender)
    var opponents = getOpposingTeamSprites(teamName);
    var nearbyDefenders = 0;
    for (var d = 0; d < opponents.length; d++) {
        if (!opponents[d]) continue;
        if (getSpriteDistance(player, opponents[d]) < DOUBLE_TEAM_RADIUS) {
            nearbyDefenders++;
        }
    }
    var isTrapped = nearbyDefenders >= 2 || defenderDist < 3;

    // Check if defender is playing too tight (exploitable for passing)
    var opponentTeam = teamName === "teamA" ? "teamB" : "teamA";
    var defenderTooTight = isDefenderPlayingTooTight(player, opponentTeam);

    // === VIOLATION AVOIDANCE ===

    // 24-Second Shot Clock - FORCE SHOT if urgent
    if (gameState.shotClock <= SHOT_CLOCK_URGENT) {
        attemptShot(systems);
        return;
    }

    // 10-Second Backcourt - increase urgency to advance
    var backcourtUrgent = inBackcourt && gameState.shotClock <= (24 - BACKCOURT_URGENT);

    // === PASS DECISION LOGIC ===

    if (teammate) {
        // CRITICAL: Validate teammate is in bounds before considering pass
        var teammateInBounds = (teammate.x >= 2 && teammate.x <= COURT_WIDTH - 7 &&
            teammate.y >= 2 && teammate.y <= COURT_HEIGHT - 5);

        if (!teammateInBounds) {
            // Teammate out of bounds - DO NOT PASS
            teammate = null;  // Treat as if no teammate available
        }
    }

    if (teammate) {
        var teammateDistToBasket = distanceBetweenPoints(teammate.x, teammate.y, targetBasketX, targetBasketY);
        var teammateClosestDef = getClosestPlayer(teammate.x, teammate.y, getOpposingTeam(teamName));
        var teammateDefDist = teammateClosestDef ? getSpriteDistance(teammate, teammateClosestDef) : 999;

        // Check for over-and-back violation
        if (wouldBeOverAndBack(player, teammate, teamName)) {
            // Don't pass - would be violation
        } else {
            var shouldPass = false;
            var passIntent = "ADVANCE_BALL";

            // REASON 0: Defender playing too tight - EXPLOIT weak positioning!
            // When defender touches ball handler, their intercept ability drops 85%
            if (defenderTooTight && teammateDefDist > 3) {
                shouldPass = true;
                passIntent = "EXPLOIT_TIGHT_DEFENSE";
                try {
                    log(LOG_DEBUG, "AI exploiting tight defense with pass - defender touching ball handler!");
                } catch (e) { }
            }

            // REASON 1: Get out of jam (trapped)
            if (isTrapped && teammateDefDist > 5) {
                shouldPass = true;
                passIntent = "ESCAPE_JAM";
            }

            // REASON 2: Advance ball for better shot probability
            // BUT: Don't pass backwards in backcourt (unless trapped)
            var teammateInBackcourt = isInBackcourt(teammate, teamName);
            var wouldPassBackwards = (inBackcourt && teammateInBackcourt);

            if (!shouldPass && teammateDistToBasket < distanceToBasket - 3 && !wouldPassBackwards) {
                // Calculate teammate's shot probability
                var teammateShotProb = calculateShotProbability(teammate, targetBasketX, targetBasketY, teammateClosestDef);

                // Use difficulty-based threshold if available
                var shotThreshold = (typeof getAIDifficulty === "function")
                    ? getAIDifficulty().shotThreshold
                    : SHOT_PROBABILITY_THRESHOLD;

                if (teammateShotProb > shotThreshold) {
                    shouldPass = true;
                    passIntent = "CATCH_AND_SHOOT";
                }
            }

            // REASON 3: Stuck for too long
            // In backcourt: ONLY pass if teammate is in frontcourt (to avoid lateral passing)
            // In frontcourt: Can pass to any open teammate
            if (!shouldPass && gameState.ballHandlerStuckTimer >= 3 && teammateDefDist > 5) {
                if (inBackcourt) {
                    // ONLY pass if teammate is in frontcourt - prevents lateral backcourt passes
                    if (!teammateInBackcourt) {
                        shouldPass = true;
                        passIntent = "ADVANCE_BALL";
                    }
                } else {
                    // In frontcourt - can pass freely
                    shouldPass = true;
                    passIntent = "ADVANCE_BALL";
                }
            }

            // REASON 4: Half-court offense has stalled (no forward progress)
            if (!shouldPass && !inBackcourt && gameState.ballHandlerAdvanceTimer >= 3 && teammateDefDist > 4) {
                shouldPass = true;
                passIntent = "RESET_OFFENSE";
            }

            // REASON 5: Dead dribble urgency - must move the ball
            if (!shouldPass && dribbleDead && deadElapsed > 2000 && teammateDefDist > 3) {
                if (!teammateInBackcourt || !inBackcourt) {
                    shouldPass = true;
                    passIntent = deadElapsed > 3500 ? "ESCAPE_JAM" : "ADVANCE_BALL";
                }
            }

            // REASON 6: Backcourt urgency - must advance
            if (!shouldPass && backcourtUrgent && !teammateInBackcourt) {
                shouldPass = true;
                passIntent = "ADVANCE_BALL";
            }

            if (shouldPass) {
                // Store pass intent for receiver
                if (!gameState.passIntent) gameState.passIntent = {};
                gameState.passIntent[getPlayerKey(teammate)] = passIntent;

                var leadTarget = null;
                if (dribbleDead && teammate && teammate.playerData && teammate.playerData.emergencyCut) {
                    leadTarget = teammate.playerData.emergencyCut.leadTarget || teammate.playerData.aiTargetSpot;
                }
                animatePass(player, teammate, leadTarget);
                return;
            }
        }
    }

    if (playerData.hasDribble !== false && (isTrapped || gameState.ballHandlerStuckTimer >= 4) && !player.isHuman) {
        var pressRisk = closestDefender && (closestDefenderDistToBasket > distToBasket + 1.5);
        if (!pressRisk || distToBasket < 10) {
            pickUpDribble(player, "ai");
        }
    }

    if (playerData.hasDribble === false && playerData.shakeCooldown <= 0) {
        var closeDefenders = getTouchingOpponents(player, teamName, 2.75);
        if (closeDefenders.length || isTrapped || gameState.ballHandlerStuckTimer >= 2) {
            var shakeWon = attemptShake(player);
            if (shakeWon) {
                if (handlePostShakeDecision(player, teamName, systems)) {
                    return;
                }
                if (playerData.hasDribble) {
                    return;
                }
            }
        }
    }

    // === SHOOT DECISION LOGIC ===

    // Calculate my shot probability
    var myShotProb = calculateShotProbability(player, targetBasketX, targetBasketY, closestDefender);

    // Apply difficulty-based shot accuracy multiplier if available
    if (typeof getAdjustedShotProbability === "function") {
        myShotProb = getAdjustedShotProbability(myShotProb);
    }

    // Don't shoot from backcourt (unless shot clock desperate)
    if (inBackcourt && gameState.shotClock > SHOT_CLOCK_URGENT) {
        myShotProb = 0;
    }

    var shouldShoot = false;

    // Use difficulty-based threshold if available
    var shotThreshold = (typeof getAIDifficulty === "function")
        ? getAIDifficulty().shotThreshold
        : SHOT_PROBABILITY_THRESHOLD;

    // If my shot probability > threshold: SHOOT
    if (myShotProb > shotThreshold) {
        shouldShoot = true;
    }
    // Else if shot clock winding down: SHOOT anyway
    else if (gameState.shotClock <= 6 && myShotProb > 20) {
        shouldShoot = true;
    }

    if (shouldShoot) {
        attemptShot(systems);
        return;
    }

    // === DRIVE / ADVANCE LOGIC ===

    // Goal: Get closer to basket for better shot
    var driveTargetX;
    var driveTargetY;
    var needTurbo = false;

    if (inBackcourt) {
        // MUST advance to frontcourt - ALWAYS aggressive
        var courtMidX = Math.floor(COURT_WIDTH / 2);
        driveTargetX = teamName === "teamA" ? courtMidX + 10 : courtMidX - 10;
        driveTargetY = BASKET_LEFT_Y;

        // ALWAYS use turbo in backcourt to avoid 10-sec violation
        needTurbo = true;

        // Make diagonal/L-cuts if defender blocking OR stuck
        if (defenderDist < 5 || gameState.ballHandlerStuckTimer >= 1) {
            var cutAngle = Math.random() < 0.5 ? 1 : -1;
            // Try to go around defender with aggressive cut
            driveTargetX = clampToCourtX(player.x + attackDirection * 10);
            driveTargetY = clampToCourtY(player.y + cutAngle * 6);
        }

        // Force turbo in backcourt - bypass distance check
        if (playerData.turbo > 5) {
            activateAITurbo(player, 0.8, 999); // Pass 999 to bypass distance check
        }
        // Skip the normal turbo logic below since we already activated it
        needTurbo = false;
    } else {
        // In frontcourt - drive toward basket

        // Check if we have room to run (Fast Dunker logic)
        var hasRoomToRun = defenderDist > 6;

        if (hasRoomToRun && distanceToBasket > 8) {
            // Drive toward basket - keep going until we hit something
            driveTargetX = clampToCourtX(targetBasketX - attackDirection * 4);
            driveTargetY = targetBasketY;

            // Use turbo for aggressive drive
            if (getEffectiveAttribute(playerData, ATTR_SPEED) >= 7 || getEffectiveAttribute(playerData, ATTR_DUNK) >= 7) {
                needTurbo = true;
            }
        } else if (defenderDist < 5) {
            // Defender in my way - make cut to get open
            var cutAngle = Math.random() < 0.5 ? 1 : -1;
            driveTargetX = clampToCourtX(player.x + attackDirection * 6);
            driveTargetY = clampToCourtY(player.y + cutAngle * 5);
            needTurbo = true;
        } else {
            // Move toward basket
            driveTargetX = clampToCourtX(targetBasketX - attackDirection * 8);
            driveTargetY = targetBasketY;
        }
    }

    // Apply turbo if needed and available (for frontcourt movement)
    // Lower threshold so they don't stop moving when turbo is low
    if (needTurbo && playerData.turbo > 5) {
        var driveDistance = distanceBetweenPoints(player.x, player.y, driveTargetX, driveTargetY);
        activateAITurbo(player, 0.6, driveDistance);
    }

    // Move toward target even without turbo
    moveAITowards(player, driveTargetX, driveTargetY);

}
