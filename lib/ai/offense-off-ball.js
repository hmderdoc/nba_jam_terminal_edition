/**
 * AI: Offense without Ball (Off-Ball Movement)
 * 
 * Controls AI decision-making for offensive player without possession
 * Priority cascade:
 * 0. Exploit shove opportunities (defender knocked back - CUT TO BASKET)
 * 1. Sprint to frontcourt when ball carrier in backcourt
 * 2. Backdoor cuts when defender sleeping
 * 3. Active cutting when standing too long (V-cuts, basket cuts, wing cuts)
 * 4. Space the floor (maintain proper spacing)
 * 5. Create passing lanes (shove defenders blocking lanes)
 */

load("sbbsdefs.js");

var AI_OFFENSE_OFF_BALL = (typeof AI_CONSTANTS === "object" && AI_CONSTANTS.OFFENSE_OFF_BALL)
    ? AI_CONSTANTS.OFFENSE_OFF_BALL
    : null;

function aiOffBallConfig(path, fallback) {
    if (!AI_OFFENSE_OFF_BALL) return fallback;
    var node = AI_OFFENSE_OFF_BALL;
    var parts = path.split(".");
    for (var i = 0; i < parts.length; i++) {
        if (!node || typeof node !== "object" || !(parts[i] in node)) {
            return fallback;
        }
        node = node[parts[i]];
    }
    return (typeof node === "undefined") ? fallback : node;
}

/**
 * AI logic for offensive player without the ball
 * @param {Object} player - Sprite with playerData
 * @param {string} teamName - "teamA" or "teamB"
 * @param {GameContext} context - Dependency injection context
 * @param {Object} systems - Systems object for dependency injection
 */
function aiOffenseNoBall(player, teamName, context, systems) {
    var playerData = player.playerData;
    if (!playerData) {
        debugLog("[AI OFF-BALL] " + (player.playerData ? player.playerData.name : "unknown") + " EARLY RETURN: no playerData");
        return;
    }

    var ballCarrier = context.getBallCarrier();
    if (!ballCarrier) {
        debugLog("[AI OFF-BALL] " + playerData.name + " EARLY RETURN: no ballCarrier");
        return;
    }

    debugLog("[AI OFF-BALL] " + playerData.name + " ENTERED function, has ballCarrier: " + ballCarrier.playerData.name);

    var spots = getTeamSpots(teamName);
    var defenderDist = getClosestDefenderDistance(player, teamName);
    var basket = getOffensiveBasket(teamName);
    var closestDefender = getClosestPlayer(player.x, player.y, getOpposingTeam(teamName));
    var attackDirection = teamName === "teamA" ? 1 : -1;
    var inBackcourt = isInBackcourt(player, teamName);
    var ballCarrierInBackcourt = isInBackcourt(ballCarrier, teamName);
    var distToBallCarrier = getSpriteDistance(player, ballCarrier);
    var amAhead = Math.abs(player.x - basket.x) < Math.abs(ballCarrier.x - basket.x) - 4;
    var ballHandlerStuck = context && typeof context.isBallHandlerStuck === "function"
        ? context.isBallHandlerStuck(2)
        : false;
    var bunchedUp = distToBallCarrier < 6;
    var laneOpportunity = null;
    if (!inBackcourt || ballHandlerStuck) {
        laneOpportunity = findOpenPassingLaneTarget(player, ballCarrier, teamName, closestDefender);
    }

    // PRIORITY 0: EXPLOIT SHOVE - My defender was shoved, CUT TO BASKET!
    if (closestDefender && closestDefender.playerData && closestDefender.playerData.shoveCooldown > 0) {
        var exploitWindow = closestDefender.playerData.shoveCooldown >
            aiOffBallConfig("EXPLOIT_SHOVE.cooldownFrames", 20);

        if (exploitWindow) {
            var distToBasket = distanceBetweenPoints(player.x, player.y, basket.x, basket.y);

            // CUT HARD to the basket - this is an open opportunity
            playerData.aiLastAction = "exploit_shove_cut";

            // Use turbo if available to maximize advantage
            var cutSpeed = aiOffBallConfig("EXPLOIT_SHOVE.baseSpeed", 3);
            var turboThreshold = aiOffBallConfig("EXPLOIT_SHOVE.turboThreshold", 15);
            var turboSpeed = aiOffBallConfig("EXPLOIT_SHOVE.turboSpeed", 5);
            var turboCostFactor = aiOffBallConfig("EXPLOIT_SHOVE.turboCostFactor", 0.8);
            if (playerData.turbo > turboThreshold) {
                playerData.turboActive = true;
                playerData.useTurbo(TURBO_DRAIN_RATE * turboCostFactor);
                cutSpeed = turboSpeed;
            }

            steerToward(player, basket.x, basket.y, cutSpeed, systems);

            // Request pass if close enough and ball handler can see us
            var passDistanceMax = aiOffBallConfig("EXPLOIT_SHOVE.passDistanceMax", 20);
            if (distToBasket < passDistanceMax && ballCarrier && ballCarrier.playerData) {
                var distToBallCarrier = getSpriteDistance(player, ballCarrier);
                var passMargin = aiOffBallConfig("EXPLOIT_SHOVE.passDistanceMargin", 5);
                if (distToBallCarrier < GAME_BALANCE.AI.MAX_CLOSE_PASS_DISTANCE - passMargin &&
                    Math.random() < GAME_BALANCE.AI.CUT_TO_BASKET_PROB) {
                    // Signal we're open (AI will check this in aiOffenseBall)
                    playerData.openForPass = true;
                }
            }

            return;
        }
    }

    // Clear open signal if not exploiting shove
    playerData.openForPass = false;

    // PRIORITY 1: Ball carrier in backcourt -> SPRINT AHEAD
    if (ballCarrierInBackcourt) {
        playerData.aiLastAction = "sprint_frontcourt";

        // Pick target spot if don't have one or reached current one
        var frontcourtTolerance = aiOffBallConfig("FRONTCOURT.targetTolerance", 3);
        if (!playerData.aiTargetSpot || hasReachedSpot(player, playerData.aiTargetSpot, frontcourtTolerance)) {
            playerData.aiTargetSpot = pickOffBallSpot(player, ballCarrier, teamName);
        }

        // Only use turbo if have good reserves and clear path
        var speed = aiOffBallConfig("FRONTCOURT.baseSpeed", 2);
        var turboThreshold = aiOffBallConfig("FRONTCOURT.turboThreshold", 25);
        var defenderBuffer = aiOffBallConfig("FRONTCOURT.defenderBuffer", 4);
        if (playerData.turbo > turboThreshold && defenderDist > defenderBuffer) {
            playerData.turboActive = true;
            playerData.useTurbo(TURBO_DRAIN_RATE * aiOffBallConfig("FRONTCOURT.turboCostFactor", 0.5)); // Lower drain for off-ball
            speed = aiOffBallConfig("FRONTCOURT.turboSpeed", 4);
        }

        steerToward(player, playerData.aiTargetSpot.x, playerData.aiTargetSpot.y, speed, systems);
        return;
    }

    // PRIORITY 2a: PASSING LANE CUT (create target for ball handler)
    if (laneOpportunity) {
        playerData.aiLastAction = "passing_lane_cut";
        playerData.aiTargetSpot = { x: laneOpportunity.x, y: laneOpportunity.y };
        playerData.openForPass = true;
        var laneSpeed = laneOpportunity.distance > 8
            ? aiOffBallConfig("PASSING_LANE.farSpeed", 3)
            : aiOffBallConfig("PASSING_LANE.nearSpeed", 2);
        var laneTurboThreshold = aiOffBallConfig("PASSING_LANE.turboThreshold", 12);
        var laneClearanceRequirement = aiOffBallConfig("PASSING_LANE.clearanceThreshold", 4);
        if (playerData.turbo > laneTurboThreshold && laneOpportunity.clearance > laneClearanceRequirement) {
            playerData.turboActive = true;
            playerData.useTurbo(TURBO_DRAIN_RATE * aiOffBallConfig("PASSING_LANE.turboCostFactor", 0.5));
            laneSpeed += aiOffBallConfig("PASSING_LANE.turboCostIncrement", 1);
        }
        steerToward(player, laneOpportunity.x, laneOpportunity.y, laneSpeed, systems);
        return;
    }

    // PRIORITY 2b: MOMENTUM CUT PLAN (defender leaning)
    var momentumCutDecision = evaluateMomentumCutPlan(player, teamName, attackDirection, {
        inBackcourt: inBackcourt,
        ballCarrierInBackcourt: ballCarrierInBackcourt,
        amAhead: amAhead,
        defender: closestDefender,
        ballHandlerStuck: ballHandlerStuck,
        bunchedUp: bunchedUp
    });
    if (momentumCutDecision) {
        playerData.aiLastAction = "momentum_cut";
        playerData.aiTargetSpot = { x: momentumCutDecision.x, y: momentumCutDecision.y };
        playerData.openForPass = true;
        var momentumTurboThreshold = aiOffBallConfig("MOMENTUM_CUT.turboThreshold", 10);
        var momentumSpeed = momentumCutDecision.turbo && playerData.turbo > momentumTurboThreshold
            ? aiOffBallConfig("MOMENTUM_CUT.turboSpeed", 4)
            : aiOffBallConfig("MOMENTUM_CUT.baseSpeed", 3);
        if (momentumCutDecision.turbo && playerData.turbo > momentumTurboThreshold) {
            playerData.turboActive = true;
            playerData.useTurbo(TURBO_DRAIN_RATE * aiOffBallConfig("MOMENTUM_CUT.turboCostFactor", 0.5));
        }
        steerToward(player, momentumCutDecision.x, momentumCutDecision.y, momentumSpeed, systems);
        return;
    }

    // PRIORITY 2: Defender sleeping -> BACKDOOR CUT
    var backdoorExtraDistance = aiOffBallConfig("BACKDOOR.defenderExtraDistance", 2);
    if (defenderDist > GAME_BALANCE.AI.WIDE_OPEN_DISTANCE + backdoorExtraDistance &&
        Math.random() < GAME_BALANCE.AI.SPONTANEOUS_CUT_PROB) {
        playerData.aiLastAction = "backdoor_cut";
        steerToward(player, basket.x, basket.y, aiOffBallConfig("BACKDOOR.cutSpeed", 3), systems);
        return;
    }

    // PRIORITY 2.5: ACTIVE CUTTING - Make real cuts instead of just spacing
    // Check if we've been at our spot too long (wobbling)
    var hasSpot = playerData.aiTargetSpot != null;
    var atSpot = hasSpot && hasReachedSpot(player, playerData.aiTargetSpot, 2);
    var timeAtSpot = atSpot ? (playerData.aiTimeAtSpot || 0) + 1 : 0;
    playerData.aiTimeAtSpot = timeAtSpot;

    // Been standing/wobbling for too long - make a cut!
    var wobbleThreshold = aiOffBallConfig("ACTIVE_CUT.wobbleFrames", 20);
    if (timeAtSpot > wobbleThreshold) { // About 330ms of wobbling
        var cutOptions = [];
        var distToBallCarrierNow = getSpriteDistance(player, ballCarrier);
        var distToBasket = distanceBetweenPoints(player.x, player.y, basket.x, basket.y);

        // V-cut: Go away then cut back toward ball
        if (distToBallCarrierNow < aiOffBallConfig("ACTIVE_CUT.vCutDistanceToBall", 15) &&
            defenderDist < aiOffBallConfig("ACTIVE_CUT.vCutDefenderDistance", 6)) {
            var awayX = player.x + (player.x - ballCarrier.x) * 0.5;
            var awayY = player.y + (player.y - ballCarrier.y) * 0.5;
            cutOptions.push({ type: "vcut", x: awayX, y: awayY });
        }

        // Basket cut: Cut toward rim
        if (distToBasket > aiOffBallConfig("ACTIVE_CUT.basketCutDistanceMin", 10) &&
            defenderDist < aiOffBallConfig("ACTIVE_CUT.basketCutDefenderDistance", 8)) {
            cutOptions.push({ type: "basket_cut", x: basket.x, y: basket.y });
        }

        // Wing cut: Cut to opposite wing
        var attackDirection = teamName === "teamA" ? 1 : -1;
        var wingOffsetY = aiOffBallConfig("ACTIVE_CUT.wingOffsetY", 8);
        var oppositeWingY = player.y > basket.y ? basket.y - wingOffsetY : basket.y + wingOffsetY;
        var wingX = basket.x - attackDirection * aiOffBallConfig("ACTIVE_CUT.wingOffsetX", 12);
        cutOptions.push({ type: "wing_cut", x: clampToCourtX(wingX), y: clampToCourtY(oppositeWingY) });

        if (cutOptions.length > 0) {
            var cutChoice = cutOptions[Math.floor(Math.random() * cutOptions.length)];
            playerData.aiLastAction = "active_cut_" + cutChoice.type;
            playerData.aiTargetSpot = { x: cutChoice.x, y: cutChoice.y };
            playerData.aiTimeAtSpot = 0; // Reset wobble timer

            var cutSpeed = aiOffBallConfig("ACTIVE_CUT.baseSpeed", 3);
            var cutTurboThreshold = aiOffBallConfig("ACTIVE_CUT.turboThreshold", 20);
            if (playerData.turbo > cutTurboThreshold && cutChoice.type === "basket_cut") {
                playerData.turboActive = true;
                playerData.useTurbo(TURBO_DRAIN_RATE * aiOffBallConfig("ACTIVE_CUT.turboCostFactor", 0.6));
                cutSpeed = aiOffBallConfig("ACTIVE_CUT.turboSpeed", 4.5);
            }

            steerToward(player, cutChoice.x, cutChoice.y, cutSpeed, systems);
            return;
        }
    }

    // PRIORITY 3: SPACE THE FLOOR
    // Pick new spot if we don't have one or reached it
    if (!playerData.aiTargetSpot || hasReachedSpot(player, playerData.aiTargetSpot, 2)) {
        playerData.aiTargetSpot = pickOffBallSpot(player, ballCarrier, teamName);
    }

    playerData.aiLastAction = "spacing";
    steerToward(player, playerData.aiTargetSpot.x, playerData.aiTargetSpot.y,
        aiOffBallConfig("SPACING.baseSpeed", 2), systems);

    // PRIORITY 4: SHOVE DEFENDERS BLOCKING PASSING LANES (tactical space creation)
    // Off-ball offensive players shove defenders blocking passing lanes
    if (playerData.shoveCooldown <= 0) {
        var powerAttr = getEffectiveAttribute(playerData, ATTR_POWER) || 5;
        var baseShoveChance = aiOffBallConfig("PASS_LANE_SHOVE.baseChance", 0.35);
        var shoveChance = baseShoveChance * (powerAttr / 5); // Much higher for visibility (was 0.08)

        // Find defenders blocking passing lane from ball carrier
        var allPlayers = spriteRegistry.getAllPlayers();
        var defenders = [];

        for (var i = 0; i < allPlayers.length; i++) {
            var other = allPlayers[i];
            if (!other || other === player) continue;
            var otherTeam = getPlayerTeamName(other);
            if (otherTeam === teamName) continue; // Skip teammates
            defenders.push(other);
        }

        // Evaluate if passing lane from ball carrier to this player is blocked
        var passingLaneClearance = evaluatePassingLaneClearance(ballCarrier, player.x + 2, player.y + 2, defenders);
        var clearanceThreshold = aiOffBallConfig("PASS_LANE_SHOVE.clearanceThreshold", 6);
        var laneIsBlocked = passingLaneClearance < clearanceThreshold;

        if (laneIsBlocked) {
            // Find the defender blocking the passing lane (closest to lane)
            var bestShoveTarget = null;
            var bestBlockingScore = -999;

            for (var i = 0; i < defenders.length; i++) {
                var defender = defenders[i];
                var dist = getSpriteDistance(player, defender);

                // Only consider defenders within shove range (increased from 2.5 to 4.0)
                if (dist > aiOffBallConfig("PASS_LANE_SHOVE.maxDefenderDistance", 4.0)) continue;

                // Calculate how much this defender blocks the lane
                var passX1 = ballCarrier.x + 2;
                var passY1 = ballCarrier.y + 2;
                var passX2 = player.x + 2;
                var passY2 = player.y + 2;
                var defX = defender.x + 2;
                var defY = defender.y + 2;

                // Distance from defender to passing lane
                var passVecX = passX2 - passX1;
                var passVecY = passY2 - passY1;
                var passLength = Math.sqrt(passVecX * passVecX + passVecY * passVecY);

                if (passLength < 0.1) continue;

                var toDefX = defX - passX1;
                var toDefY = defY - passY1;
                var projection = (toDefX * passVecX + toDefY * passVecY) / passLength;

                if (projection < 0) projection = 0;
                if (projection > passLength) projection = passLength;

                var t = projection / passLength;
                var closestX = passX1 + passVecX * t;
                var closestY = passY1 + passVecY * t;
                var distToLane = Math.sqrt((defX - closestX) * (defX - closestX) + (defY - closestY) * (defY - closestY));

                // Prioritize defenders close to lane AND close to this player
                var laneBias = aiOffBallConfig("PASS_LANE_SHOVE.laneBias", 5);
                var distanceBias = aiOffBallConfig("PASS_LANE_SHOVE.distanceBias", 4);
                var blockingScore = (laneBias - distToLane) + (distanceBias - dist);

                if (blockingScore > bestBlockingScore) {
                    bestBlockingScore = blockingScore;
                    bestShoveTarget = defender;
                }
            }

            // Attempt shove on the defender blocking the passing lane
            if (bestShoveTarget && Math.random() < shoveChance) {
                attemptShove(player, bestShoveTarget, systems);
            }
        }
    }
}
