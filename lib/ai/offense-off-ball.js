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

/**
 * AI logic for offensive player without the ball
 * @param {Object} player - Sprite with playerData
 * @param {string} teamName - "teamA" or "teamB"
 * @param {GameContext} context - Dependency injection context
 * @param {Object} systems - Systems object for dependency injection
 */
function aiOffenseNoBall(player, teamName, context, systems) {
    var playerData = player.playerData;
    if (!playerData) return;

    var ballCarrier = context.getBallCarrier();
    if (!ballCarrier) return;

    var spots = getTeamSpots(teamName);
    var defenderDist = getClosestDefenderDistance(player, teamName);
    var basket = getOffensiveBasket(teamName);
    var closestDefender = getClosestPlayer(player.x, player.y, getOpposingTeam(teamName));

    // PRIORITY 0: EXPLOIT SHOVE - My defender was shoved, CUT TO BASKET!
    if (closestDefender && closestDefender.playerData && closestDefender.playerData.shoveCooldown > 0) {
        var exploitWindow = closestDefender.playerData.shoveCooldown > 20; // Fresh shove

        if (exploitWindow) {
            var distToBasket = distanceBetweenPoints(player.x, player.y, basket.x, basket.y);

            // CUT HARD to the basket - this is an open opportunity
            playerData.aiLastAction = "exploit_shove_cut";

            // Use turbo if available to maximize advantage
            var cutSpeed = 3;
            if (playerData.turbo > 15) {
                playerData.turboActive = true;
                playerData.useTurbo(TURBO_DRAIN_RATE * 0.8);
                cutSpeed = 5;
            }

            steerToward(player, basket.x, basket.y, cutSpeed);

            // Request pass if close enough and ball handler can see us
            if (distToBasket < 20 && ballCarrier && ballCarrier.playerData) {
                var distToBallCarrier = getSpriteDistance(player, ballCarrier);
                if (distToBallCarrier < GAME_BALANCE.AI.MAX_CLOSE_PASS_DISTANCE - 5 && Math.random() < GAME_BALANCE.AI.CUT_TO_BASKET_PROB) {
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
    if (isInBackcourt(ballCarrier, teamName)) {
        playerData.aiLastAction = "sprint_frontcourt";

        // Pick target spot if don't have one or reached current one
        if (!playerData.aiTargetSpot || hasReachedSpot(player, playerData.aiTargetSpot, 3)) {
            playerData.aiTargetSpot = pickOffBallSpot(player, ballCarrier, teamName);
        }

        // Only use turbo if have good reserves and clear path
        var speed = 2;
        if (playerData.turbo > 25 && defenderDist > 4) {
            playerData.turboActive = true;
            playerData.useTurbo(TURBO_DRAIN_RATE * 0.5); // Lower drain for off-ball
            speed = 4;
        }

        steerToward(player, playerData.aiTargetSpot.x, playerData.aiTargetSpot.y, speed);
        return;
    }

    // PRIORITY 2: Defender sleeping -> BACKDOOR CUT
    if (defenderDist > GAME_BALANCE.AI.WIDE_OPEN_DISTANCE + 2 && Math.random() < GAME_BALANCE.AI.SPONTANEOUS_CUT_PROB) {
        playerData.aiLastAction = "backdoor_cut";
        steerToward(player, basket.x, basket.y, 3);
        return;
    }

    // PRIORITY 2.5: ACTIVE CUTTING - Make real cuts instead of just spacing
    // Check if we've been at our spot too long (wobbling)
    var hasSpot = playerData.aiTargetSpot != null;
    var atSpot = hasSpot && hasReachedSpot(player, playerData.aiTargetSpot, 2);
    var timeAtSpot = atSpot ? (playerData.aiTimeAtSpot || 0) + 1 : 0;
    playerData.aiTimeAtSpot = timeAtSpot;

    // Been standing/wobbling for too long - make a cut!
    if (timeAtSpot > 20) { // About 330ms of wobbling
        var cutOptions = [];
        var distToBallCarrier = getSpriteDistance(player, ballCarrier);
        var distToBasket = distanceBetweenPoints(player.x, player.y, basket.x, basket.y);

        // V-cut: Go away then cut back toward ball
        if (distToBallCarrier < 15 && defenderDist < 6) {
            var awayX = player.x + (player.x - ballCarrier.x) * 0.5;
            var awayY = player.y + (player.y - ballCarrier.y) * 0.5;
            cutOptions.push({ type: "vcut", x: awayX, y: awayY });
        }

        // Basket cut: Cut toward rim
        if (distToBasket > 10 && defenderDist < 8) {
            cutOptions.push({ type: "basket_cut", x: basket.x, y: basket.y });
        }

        // Wing cut: Cut to opposite wing
        var attackDirection = teamName === "teamA" ? 1 : -1;
        var oppositeWingY = player.y > basket.y ? basket.y - 8 : basket.y + 8;
        var wingX = basket.x - attackDirection * 12;
        cutOptions.push({ type: "wing_cut", x: clampToCourtX(wingX), y: clampToCourtY(oppositeWingY) });

        if (cutOptions.length > 0) {
            var cutChoice = cutOptions[Math.floor(Math.random() * cutOptions.length)];
            playerData.aiLastAction = "active_cut_" + cutChoice.type;
            playerData.aiTargetSpot = { x: cutChoice.x, y: cutChoice.y };
            playerData.aiTimeAtSpot = 0; // Reset wobble timer

            var cutSpeed = 3;
            if (playerData.turbo > 20 && cutChoice.type === "basket_cut") {
                playerData.turboActive = true;
                playerData.useTurbo(TURBO_DRAIN_RATE * 0.6);
                cutSpeed = 4.5;
            }

            steerToward(player, cutChoice.x, cutChoice.y, cutSpeed);
            return;
        }
    }

    // PRIORITY 3: SPACE THE FLOOR
    // Pick new spot if we don't have one or reached it
    if (!playerData.aiTargetSpot || hasReachedSpot(player, playerData.aiTargetSpot, 2)) {
        playerData.aiTargetSpot = pickOffBallSpot(player, ballCarrier, teamName);
    }

    playerData.aiLastAction = "spacing";
    steerToward(player, playerData.aiTargetSpot.x, playerData.aiTargetSpot.y, 2);

    // PRIORITY 4: SHOVE DEFENDERS BLOCKING PASSING LANES (tactical space creation)
    // Off-ball offensive players shove defenders blocking passing lanes
    if (playerData.shoveCooldown <= 0) {
        var powerAttr = getEffectiveAttribute(playerData, ATTR_POWER) || 5;
        var shoveChance = 0.35 * (powerAttr / 5); // Much higher for visibility (was 0.08)

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
        var laneIsBlocked = passingLaneClearance < 6; // Lane blocked if clearance < 6 (increased from 3 to trigger more often)

        if (laneIsBlocked) {
            // Find the defender blocking the passing lane (closest to lane)
            var bestShoveTarget = null;
            var bestBlockingScore = -999;

            for (var i = 0; i < defenders.length; i++) {
                var defender = defenders[i];
                var dist = getSpriteDistance(player, defender);

                // Only consider defenders within shove range (increased from 2.5 to 4.0)
                if (dist > 4.0) continue;

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
                var blockingScore = (5 - distToLane) + (4 - dist);

                if (blockingScore > bestBlockingScore) {
                    bestBlockingScore = blockingScore;
                    bestShoveTarget = defender;
                }
            }

            // Attempt shove on the defender blocking the passing lane
            if (bestShoveTarget && Math.random() < shoveChance) {
                attemptShove(player, bestShoveTarget);
            }
        }
    }
}
