/**
 * AI: Defense - On Ball (Primary Defender)
 * 
 * Controls AI decision-making for the defender guarding the ball handler
 * Strategy: Contain (stay between ball and basket), pressure with steals/shoves
 */

load("sbbsdefs.js");

var AI_DEFENSE_ON_BALL = (typeof AI_CONSTANTS === "object" && AI_CONSTANTS.DEFENSE_ON_BALL)
    ? AI_CONSTANTS.DEFENSE_ON_BALL
    : null;

function aiDefenseOnBallValue(path, fallback) {
    if (!AI_DEFENSE_ON_BALL) return fallback;
    var node = AI_DEFENSE_ON_BALL;
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

    // Position between ball carrier and basket with slight jitter
    var containDistance = aiDefenseOnBallValue("containDistance", 3);
    var containJitter = aiDefenseOnBallValue("containJitter", 2);
    var containX = ballCarrier.x + dx * containDistance + (Math.random() - 0.5) * containJitter;
    var containY = ballCarrier.y + dy * containDistance + (Math.random() - 0.5) * containJitter;

    playerData.aiLastAction = "contain";
    steerToward(player, containX, containY, aiDefenseOnBallValue("containSpeed", 2.5), systems);

    // Attempt steal if very close
    var distToBall = distanceBetweenPoints(player.x, player.y, ballCarrier.x, ballCarrier.y);
    if (distToBall <= aiDefenseOnBallValue("stealDistance", 1.7)) {
        var stealSkill = getEffectiveAttribute(playerData, ATTR_STEAL) || 5;
        var powerSkill = getEffectiveAttribute(playerData, ATTR_POWER) || 5;
        var canSteal = playerData.stealRecoverFrames <= 0;
        var pressureChoice = Math.random();

        var stealBase = aiDefenseOnBallValue("stealBaseChance", 0.45);
        var stealAttrFactor = aiDefenseOnBallValue("stealAttrFactor", 0.035);
        if (canSteal && pressureChoice < (stealBase + stealSkill * stealAttrFactor)) {
            attemptAISteal(player, ballCarrier, systems);
        } else if (ballCarrier.playerData && ballCarrier.playerData.hasDribble === false &&
            playerData.shoveCooldown <= 0 && pressureChoice < aiDefenseOnBallValue("shovePreference", 0.65)) {
            attemptShove(player, ballCarrier, systems);
        } else {
            // Retreat slightly to avoid cheap contact
            var away = getBearingVector(player.bearing);
            var retreatStep = aiDefenseOnBallValue("retreatStep", 2);
            var retreatX = clampToCourtX(player.x - away.dx * retreatStep);
            var retreatY = clampToCourtY(player.y - away.dy * retreatStep);
            var powerThreshold = aiDefenseOnBallValue("powerThreshold", 7);
            var settleSpeed = powerSkill >= powerThreshold
                ? aiDefenseOnBallValue("settleSpeedHigh", 2.2)
                : aiDefenseOnBallValue("settleSpeedLow", 1.6);
            steerToward(player, retreatX, retreatY, settleSpeed, systems);
        }
    }
}
