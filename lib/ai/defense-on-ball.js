/**
 * AI: Defense - On Ball (Primary Defender)
 * 
 * Controls AI decision-making for the defender guarding the ball handler
 * Strategy: Contain (stay between ball and basket), pressure with steals/shoves
 */

load("sbbsdefs.js");

/**
 * AI logic for on-ball defender (guarding ball carrier)
 * @param {Object} player - Sprite with playerData
 * @param {string} teamName - "teamA" or "teamB"
 * @param {Object} ballCarrier - Sprite of player with ball
 * @param {GameContext} context - Dependency injection context (unused currently)
 * @param {Object} systems - Systems object for dependency injection
 */
function aiDefenseOnBall(player, teamName, ballCarrier, context, systems) {
    var playerData = player.playerData;
    if (!playerData || !ballCarrier) return;

    var ourBasket = teamName === "teamA"
        ? { x: BASKET_LEFT_X, y: BASKET_LEFT_Y }
        : { x: BASKET_RIGHT_X, y: BASKET_RIGHT_Y };

    // Calculate contain point: between ball carrier and basket
    var dx = ourBasket.x - ballCarrier.x;
    var dy = ourBasket.y - ballCarrier.y;
    var len = Math.sqrt(dx * dx + dy * dy);

    if (len < 0.1) len = 0.1; // Avoid division by zero
    dx /= len;
    dy /= len;

    // Position 3 units in front of ball carrier toward basket
    var containX = ballCarrier.x + dx * 3 + (Math.random() - 0.5) * 2;
    var containY = ballCarrier.y + dy * 3 + (Math.random() - 0.5) * 2;

    playerData.aiLastAction = "contain";
    steerToward(player, containX, containY, 2.5, systems); // Slightly faster than offense

    // Attempt steal if very close
    var distToBall = distanceBetweenPoints(player.x, player.y, ballCarrier.x, ballCarrier.y);
    if (distToBall <= 1.7) {
        var stealSkill = getEffectiveAttribute(playerData, ATTR_STEAL) || 5;
        var powerSkill = getEffectiveAttribute(playerData, ATTR_POWER) || 5;
        var canSteal = playerData.stealRecoverFrames <= 0;
        var pressureChoice = Math.random();

        if (canSteal && pressureChoice < (0.45 + stealSkill * 0.035)) {
            attemptAISteal(player, ballCarrier, systems);
        } else if (ballCarrier.playerData && ballCarrier.playerData.hasDribble === false &&
            playerData.shoveCooldown <= 0 && pressureChoice < 0.65) {
            attemptShove(player, ballCarrier, systems);
        } else {
            // Retreat slightly to avoid cheap contact
            var away = getBearingVector(player.bearing);
            var retreatX = clampToCourtX(player.x - away.dx * 2);
            var retreatY = clampToCourtY(player.y - away.dy * 2);
            var settleSpeed = powerSkill >= 7 ? 2.2 : 1.6;
            steerToward(player, retreatX, retreatY, settleSpeed, systems);
        }
    }
}
