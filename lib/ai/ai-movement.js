/**
 * NBA JAM - AI Movement Handlers
 * 
 * Off-ball offensive movement and defensive positioning logic
 */

/**
 * NEW AI - Off-Ball Offensive Movement
 * Based on design principles:
 * - Always be moving when not in good position
 * - Cut to paint, rotate perimeter, maintain spacing
 * - Get open for teammate when stuck
 * - Don't bunch up with ball handler
 */
function handleAIOffBallOffense(player, teamName, systems) {
    var ballCarrier = gameState.ballCarrier;
    if (!ballCarrier) return;

    var playerData = player.playerData;
    if (!playerData) return;

    // Setup
    var targetBasketX = teamName === "teamA" ? BASKET_RIGHT_X : BASKET_LEFT_X;
    var attackDirection = teamName === "teamA" ? 1 : -1;
    var courtMidX = Math.floor(COURT_WIDTH / 2);

    // === AI SHOVE EVALUATION (Offensive) ===
    var shoveOpportunity = evaluateOffensiveShoveOpportunity(player, teamName, systems);
    if (shoveOpportunity && Math.random() * 100 < shoveOpportunity.score) {
        attemptShove(player, shoveOpportunity.target, systems);
        try {
            log(LOG_DEBUG, "AI off-ball offensive shove: " + shoveOpportunity.reason + " (score: " + shoveOpportunity.score + ")");
        } catch (e) { }
    }

    // Check positions
    var inBackcourt = isInBackcourt(player, teamName);
    var ballCarrierInBackcourt = isInBackcourt(ballCarrier, teamName);
    var myDistToBasket = Math.abs(player.x - targetBasketX);
    var ballCarrierDistToBasket = Math.abs(ballCarrier.x - targetBasketX);
    var distToBallCarrier = getSpriteDistance(player, ballCarrier);

    // Am I ahead of ball carrier (closer to basket)?
    var amAhead = myDistToBasket < ballCarrierDistToBasket - 4;

    // Check my defender
    var myDefender = getClosestPlayer(player.x, player.y, getOpposingTeam(teamName));
    var myDefDist = myDefender ? getSpriteDistance(player, myDefender) : 999;

    // Check if ball carrier is on fast break (near their own basket in backcourt)
    var myBasketX = teamName === "teamA" ? BASKET_LEFT_X : BASKET_RIGHT_X;
    var ballCarrierDistFromOwnBasket = Math.abs(ballCarrier.x - myBasketX);
    var ballCarrierOnFastBreak = ballCarrierInBackcourt && ballCarrierDistFromOwnBasket < 15;

    // Conditions
    var ballHandlerStuck = gameState.ballHandlerStuckTimer >= 3;
    var bunchedUp = distToBallCarrier < 6;
    var defenderOnTopOfMe = myDefDist < 4 && myDefender && Math.abs(myDefender.x - targetBasketX) > Math.abs(player.x - targetBasketX);
    var shotClockUrgent = gameState.shotClock <= 6;

    var laneOpportunity = null;
    if (!inBackcourt || ballHandlerStuck) {
        laneOpportunity = findOpenPassingLaneTarget(player, ballCarrier, teamName, myDefender);
    }

    var momentumCutDecision = evaluateMomentumCutPlan(player, teamName, attackDirection, {
        inBackcourt: inBackcourt,
        ballCarrierInBackcourt: ballCarrierInBackcourt,
        amAhead: amAhead,
        defender: myDefender,
        ballHandlerStuck: ballHandlerStuck,
        bunchedUp: bunchedUp
    });

    var targetX;
    var targetY;
    var needTurbo = false;

    // PRIORITY 0: FAST BREAK - Ball carrier pushing, I need to run ahead
    if (ballCarrierOnFastBreak) {
        // Sprint to scoring position ahead of ball carrier
        targetX = clampToCourtX(targetBasketX - attackDirection * 8);
        targetY = BASKET_LEFT_Y;
        needTurbo = true;
        // Use max turbo for fast break
        if (playerData.turbo > 5) {
            activateAITurbo(player, 0.9, 999); // Pass 999 to bypass distance check
        }
    }
    // PRIORITY 1: If in backcourt, GET TO FRONTCOURT AHEAD OF BALL CARRIER
    // Off-ball player should ALWAYS be ahead (closer to basket) than ball carrier
    // CRITICAL: Must get deep to avoid both players being stuck in backcourt together
    else if (inBackcourt) {
        // ALWAYS target WAY ahead - don't just cross midcourt, get to the scoring area
        // This prevents both players bunching up in backcourt passing laterally
        targetX = clampToCourtX(targetBasketX - attackDirection * 10);
        targetY = BASKET_LEFT_Y;
        needTurbo = true;
        // Force turbo regardless of distance check - MUST get out of backcourt fast
        if (playerData.turbo > 5) {
            activateAITurbo(player, 0.8, 999); // Pass 999 to bypass distance check
        }
        // Skip normal turbo logic - already activated
        needTurbo = false;
    }
    // PRIORITY 1b: Ball carrier in backcourt, I'm in frontcourt - still get AHEAD
    else if (ballCarrierInBackcourt && !amAhead) {
        // Position WAY ahead of ball carrier to avoid lateral passes
        targetX = clampToCourtX(targetBasketX - attackDirection * 5);
        targetY = BASKET_LEFT_Y;
        needTurbo = true;
    }
    // PRIORITY 2: Ball handler stuck - GET OPEN
    else if (momentumCutDecision) {
        targetX = clampToCourtX(momentumCutDecision.x);
        targetY = clampToCourtY(momentumCutDecision.y);
        needTurbo = !!momentumCutDecision.turbo;
    }
    // PRIORITY 2: Ball handler stuck - GET OPEN
    else if (ballHandlerStuck && myDefDist > 5) {
        if (laneOpportunity) {
            targetX = laneOpportunity.x;
            targetY = laneOpportunity.y;
            needTurbo = laneOpportunity.distance > 1.5;
        } else {
            // Cut toward basket to get open
            targetX = clampToCourtX(targetBasketX - attackDirection * 6);
            targetY = BASKET_LEFT_Y;
            needTurbo = true;
        }
    }
    // PRIORITY 3: Bunched up with ball carrier - CREATE SPACE
    else if (bunchedUp) {
        if (laneOpportunity) {
            targetX = laneOpportunity.x;
            targetY = laneOpportunity.y;
            needTurbo = laneOpportunity.distance > 1.5;
        } else {
            // Move away from ball carrier
            var awayDirection = player.y < ballCarrier.y ? -1 : 1;
            targetX = clampToCourtX(targetBasketX - attackDirection * 12);
            targetY = clampToCourtY(BASKET_LEFT_Y + awayDirection * 6);
        }
    }
    // PRIORITY 4: Defender right on top of me - SLASH/CUT
    else if (defenderOnTopOfMe) {
        // Cut to paint or rotate perimeter (alternate)
        if (!playerData.offBallCutTimer) playerData.offBallCutTimer = 0;
        playerData.offBallCutTimer++;

        if (playerData.offBallCutTimer % 60 < 30) {
            // Cut to paint
            targetX = clampToCourtX(targetBasketX - attackDirection * 5);
            targetY = BASKET_LEFT_Y;
            needTurbo = true;
        } else {
            // Rotate to perimeter
            var perimeterSide = player.y < BASKET_LEFT_Y ? -1 : 1;
            targetX = clampToCourtX(targetBasketX - attackDirection * 15);
            targetY = clampToCourtY(BASKET_LEFT_Y + perimeterSide * 5);
        }
    }
    // PRIORITY 5: Find an open passing lane
    else if (laneOpportunity) {
        targetX = laneOpportunity.x;
        targetY = laneOpportunity.y;
        needTurbo = laneOpportunity.distance > 1.5;
    }
    // PRIORITY 6: Shot clock urgent and I'm not ahead - CUT TO BASKET
    else if (shotClockUrgent && !amAhead) {
        targetX = clampToCourtX(targetBasketX - attackDirection * 5);
        targetY = BASKET_LEFT_Y;
        needTurbo = true;
    }
    // DEFAULT: Position ahead of ball carrier for pass option
    else if (!amAhead) {
        // Get downcourt in front of ball carrier
        targetX = clampToCourtX(ballCarrier.x + attackDirection * 10);
        targetY = BASKET_LEFT_Y;
        needTurbo = true;
    }
    // FALLBACK: Find spot on perimeter
    else {
        var laneOffset = (player === teamAPlayer2 || player === teamBPlayer2) ? 5 : -5;
        targetX = clampToCourtX(targetBasketX - attackDirection * 12);
        targetY = clampToCourtY(BASKET_LEFT_Y + laneOffset);
    }

    // Apply turbo if needed and available (for frontcourt movement)
    // Lower threshold so they keep moving even with low turbo
    if (needTurbo && playerData.turbo > 5) {
        var distanceToTarget = distanceBetweenPoints(player.x, player.y, targetX, targetY);
        activateAITurbo(player, 0.5, distanceToTarget);
    }

    // Move toward target even without turbo
    moveAITowards(player, targetX, targetY);
}

/**
 * NEW AI - Defensive Logic
 * Based on design principles:
 * - Man-to-Man defense (default)
 * - Position between man and basket
 * - React with delay based on speed + steal attributes
 * - Double team when offensive player close to both defenders
 * - Switch when closer to other offensive player
 * - Recover with turbo when beaten
 * - Perimeter limits (don't guard past 3-point line unless they're a shooter)
 */
function handleAIDefense(player, teamName, systems) {
    var ballCarrier = gameState.ballCarrier;
    if (!ballCarrier) return;

    var playerData = player.playerData;
    if (!playerData) return;

    var myBasketX = teamName === "teamA" ? BASKET_LEFT_X : BASKET_RIGHT_X;
    var opponentBasketX = teamName === "teamA" ? BASKET_RIGHT_X : BASKET_LEFT_X;

    // === AI SHOVE EVALUATION (Defensive) ===
    var shoveOpportunity = evaluateDefensiveShoveOpportunity(player, teamName, systems);
    if (shoveOpportunity && Math.random() * 100 < shoveOpportunity.score) {
        attemptShove(player, shoveOpportunity.target, systems);
        try {
            log(LOG_DEBUG, "AI defensive shove: " + shoveOpportunity.reason + " (score: " + shoveOpportunity.score + ")");
        } catch (e) { }
    }

    // TRANSITION DEFENSE - If I'm way out of position (near opponent's basket), sprint back
    var myDistFromMyBasket = Math.abs(player.x - myBasketX);
    var myDistFromOpponentBasket = Math.abs(player.x - opponentBasketX);
    var courtMidX = Math.floor(COURT_WIDTH / 2);

    // If I'm closer to opponent's basket than my own OR in opponent's backcourt, sprint back
    var inOpponentBackcourt = (teamName === "teamA" && player.x > courtMidX + 10) ||
        (teamName === "teamB" && player.x < courtMidX - 10);

    if (inOpponentBackcourt || myDistFromOpponentBasket < myDistFromMyBasket) {
        // SPRINT BACK TO DEFENSE with turbo
        var getBackX = teamName === "teamA" ? courtMidX - 10 : courtMidX + 10;
        var getBackY = BASKET_LEFT_Y;

        if (playerData.turbo > 10) {
            var transitionDist = distanceBetweenPoints(player.x, player.y, getBackX, getBackY);
            activateAITurbo(player, 0.7, transitionDist); // High turbo usage for transition
        }

        moveAITowards(player, getBackX, getBackY);
        return;
    }

    // Special case: Crash boards for rebound when shot in progress
    if (gameState.shotInProgress) {
        var rimX = myBasketX;
        var crashX = clampToCourtX(rimX + (teamName === "teamA" ? 4 : -4));
        var crashY = clampToCourtY(BASKET_LEFT_Y);
        if (playerData.turbo > 10) {
            var crashDistance = distanceBetweenPoints(player.x, player.y, crashX, crashY);
            activateAITurbo(player, 0.4, crashDistance);
        }
        moveAITowards(player, crashX, crashY);
        return;
    }

    // Get all offensive players
    var offensivePlayers = getOpposingTeamSprites(gameState.currentTeam);
    if (!offensivePlayers || offensivePlayers.length < 2) return;

    var offPlayer1 = offensivePlayers[0];
    var offPlayer2 = offensivePlayers[1];
    if (!offPlayer1 || !offPlayer2) return;

    // Get my defensive teammate
    var teammate = getTeammate(player, teamName);
    if (!teammate) return;

    // === ZONE DEFENSE MODE (when both defenders shoved) ===
    if (playerData.playZoneDefense && playerData.playZoneDefense > 0) {
        playerData.playZoneDefense--; // Countdown zone defense timer

        // Simple zone: each defender covers half the court
        var courtMidX = Math.floor(COURT_WIDTH / 2);
        var leftZone = teamName === "teamA";

        // Ball carrier in my zone? Guard them. Otherwise, patrol zone.
        var ballCarrierInMyZone = leftZone ? (ballCarrier.x < courtMidX) : (ballCarrier.x >= courtMidX);

        if (ballCarrierInMyZone) {
            // Guard ball carrier in my zone
            var interceptX = clampToCourtX(ballCarrier.x - (teamName === "teamA" ? 2 : -2));
            var interceptY = clampToCourtY(ballCarrier.y);
            moveAITowards(player, interceptX, interceptY);
        } else {
            // Patrol my zone near basket
            var patrolX = leftZone ? (myBasketX + 8) : (myBasketX - 8);
            var patrolY = BASKET_LEFT_Y;
            moveAITowards(player, patrolX, patrolY);
        }
        return;
    }

    // === INITIAL DEFENSIVE ASSIGNMENT (closest player) ===
    var playerKey = getPlayerKey(player);
    if (!gameState.defensiveAssignments) {
        gameState.defensiveAssignments = {};
    }

    // Assign based on closest offensive player if not yet assigned
    if (!gameState.defensiveAssignments[playerKey]) {
        var distToOff1 = getSpriteDistance(player, offPlayer1);
        var distToOff2 = getSpriteDistance(player, offPlayer2);
        gameState.defensiveAssignments[playerKey] = distToOff1 < distToOff2 ? offPlayer1 : offPlayer2;
    }

    var myMan = gameState.defensiveAssignments[playerKey];
    var distToMyMan = getSpriteDistance(player, myMan);

    // === SWITCH LOGIC ===
    // If I'm closer to the OTHER offensive player AND my teammate has my man covered
    var otherOffensivePlayer = (myMan === offPlayer1) ? offPlayer2 : offPlayer1;
    var distToOtherOffPlayer = getSpriteDistance(player, otherOffensivePlayer);
    var teammateKey = getPlayerKey(teammate);
    var teammateMan = gameState.defensiveAssignments[teammateKey];

    if (distToOtherOffPlayer < distToMyMan - 5 && teammateMan === myMan) {
        // SWITCH - swap assignments
        gameState.defensiveAssignments[playerKey] = otherOffensivePlayer;
        gameState.defensiveAssignments[teammateKey] = myMan;
        myMan = otherOffensivePlayer;
        distToMyMan = distToOtherOffPlayer;
        resetPlayerDefenseMomentum(player);
        resetPlayerDefenseMomentum(teammate);
    }

    // === DOUBLE TEAM LOGIC ===
    // Check if both defenders are close to one offensive player
    var distToBallCarrier = getSpriteDistance(player, ballCarrier);
    var teammateDistToBallCarrier = getSpriteDistance(teammate, ballCarrier);
    var shouldDoubleTeam = (distToBallCarrier < DOUBLE_TEAM_RADIUS && teammateDistToBallCarrier < DOUBLE_TEAM_RADIUS);

    if (shouldDoubleTeam) {
        // Both defenders converge on ball carrier
        myMan = ballCarrier;
        distToMyMan = distToBallCarrier;
        resetPlayerDefenseMomentum(player);
        resetPlayerDefenseMomentum(teammate);
    }

    // === MAN-TO-MAN POSITIONING ===

    var myManDistToMyBasket = Math.abs(myMan.x - myBasketX);
    var myDistToMyBasket = Math.abs(player.x - myBasketX);

    // Check perimeter limit - don't chase too far from basket unless they're a shooter
    var atPerimeterLimit = myManDistToMyBasket > DEFENDER_PERIMETER_LIMIT;
    var shouldSagOff = false;

    if (atPerimeterLimit && myMan.playerData) {
        var threePointSkill = getBaseAttribute(myMan.playerData, ATTR_3PT);
        if (threePointSkill < 7) {
            // Not a good shooter at perimeter - sag off (but still maintain position)
            shouldSagOff = true;
        }
    }

    // Position myself between my man and basket
    // Check if I'm on the correct side (between man and basket)
    var myXFromBasket = Math.abs(player.x - myBasketX);
    var myManXFromBasket = Math.abs(myMan.x - myBasketX);
    var amBetweenManAndBasket = myXFromBasket < myManXFromBasket;

    var targetX;
    var targetY;
    var needTurbo = false;

    // Guard tighter as they get closer to basket
    var tightDefense = myManDistToMyBasket < DEFENDER_TIGHT_RANGE;

    // If I'm BEHIND my man (beaten) OR too far to side - RECOVER
    if (!amBetweenManAndBasket) {
        // I'm behind - sprint to cutoff position between man and basket
        // Position myself 30-40% toward basket from my man
        var cutoffPercent = tightDefense ? 0.4 : 0.3;
        targetX = myMan.x + (myBasketX - myMan.x) * cutoffPercent;
        targetY = myMan.y;
        needTurbo = true; // MUST use turbo to recover
    }
    // Else I'm between man and basket - maintain position
    else {
        var defensePercent;

        if (shouldSagOff) {
            // At perimeter with non-shooter - sag off more, but still between man and basket
            defensePercent = 0.4;
        } else if (tightDefense) {
            // Tight defense - position between them and basket (not ON them)
            defensePercent = 0.15;
        } else {
            // Moderate defense - give a bit more space
            defensePercent = 0.1;
        }

        // Stay between them and basket
        targetX = myMan.x + (myBasketX - myMan.x) * defensePercent;
        targetY = myMan.y;

        // Use turbo if they're driving toward basket and I need to keep up
        if (myMan === ballCarrier && myManDistToMyBasket < 20 && distToMyMan > 4 && !shouldSagOff) {
            needTurbo = true;
        }
    }

    // Apply turbo if needed
    var fullPress = myManDistToMyBasket > DEFENDER_PERIMETER_LIMIT;
    if (needTurbo && playerData.turbo > 10 && !fullPress) {
        var defDistance = distanceBetweenPoints(player.x, player.y, targetX, targetY);
        activateAITurbo(player, 0.6, defDistance);
        applyDefenderMomentum(player, targetX, targetY, 0.6, true);
    } else {
        var speedAttr = getEffectiveAttribute(playerData, ATTR_SPEED);
        var stealAttr = getEffectiveAttribute(playerData, ATTR_STEAL);
        var responsiveness = 0.18 + (speedAttr * 0.035) + (stealAttr * 0.025);
        if (shouldSagOff) responsiveness -= 0.06;
        if (!amBetweenManAndBasket) responsiveness += 0.08;
        if (myManDistToMyBasket > DEFENDER_PERIMETER_LIMIT + 4) responsiveness -= 0.05;
        var momentumPos = applyDefenderMomentum(player, targetX, targetY, responsiveness, false);
        targetX = momentumPos.x;
        targetY = momentumPos.y;
    }

    moveAITowards(player, targetX, targetY);

    // === DEFENSIVE ACTIONS ===

    // STEAL/SHOVE - attempt if guarding ball carrier and close
    if (myMan === ballCarrier && distToMyMan < 5) {
        var stealAttr = getEffectiveAttribute(playerData, ATTR_STEAL);
        var powerAttr = getEffectiveAttribute(playerData, ATTR_POWER);
        var stealChance = STEAL_BASE_CHANCE * (stealAttr / 5); // Higher steal = more attempts
        var shoveChance = 0.35 * (powerAttr / 5); // Increased from 0.15 to match off-ball shoving frequency

        if (ballCarrier.playerData && ballCarrier.playerData.hasDribble === false) {
            // Dribble picked up - prefer shove (easier)
            attemptShove(player);
        } else {
            // Active dribble - balance between steal and shove
            if (myManDistToMyBasket > DEFENDER_PERIMETER_LIMIT) {
                stealChance *= 0.4;
            }

            // Decide between steal and shove (increased shove distance from 3 to 4.0)
            var actionRoll = Math.random();
            if (actionRoll < shoveChance && distToMyMan < 4.0) {
                // Close enough and power-focused - attempt shove even during dribbling
                attemptShove(player, systems);
            } else if (actionRoll < stealChance + shoveChance) {
                // Steal attempt
                attemptAISteal(player, ballCarrier, systems);
            }
        }
    }

    // BLOCK - attempt when shooter is shooting (handled in autoContestShot function)
}
