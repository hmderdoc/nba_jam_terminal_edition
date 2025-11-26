/**
 * AI: Defense - Help (Off-Ball Defender)
 * 
 * Controls AI decision-making for the help defender (not guarding ball)
 * Strategy: Protect paint when ball close, deny passing lanes when ball far
 */

load("sbbsdefs.js");

var AI_DEFENSE_HELP = (typeof AI_CONSTANTS === "object" && AI_CONSTANTS.DEFENSE_HELP)
    ? AI_CONSTANTS.DEFENSE_HELP
    : null;

function aiDefenseHelpValue(path, fallback) {
    if (!AI_DEFENSE_HELP) return fallback;
    var node = AI_DEFENSE_HELP;
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
 * AI logic for help defender (off-ball defense)
 * @param {Object} player - Sprite with playerData
 * @param {string} teamName - "teamA" or "teamB"
 * @param {Object} ballCarrier - Sprite of player with ball
 * @param {GameContext} context - Dependency injection context (unused currently)
 * @param {Object} systems - Systems object for dependency injection
 */
function aiDefenseHelp(player, teamName, ballCarrier, context, systems) {
    var playerData = player.playerData;
    if (!playerData || !ballCarrier) return;

    var dribbleDead = isBallHandlerDribbleDead(systems);
    var ourBasket = teamName === "teamA"
        ? { x: BASKET_LEFT_X, y: BASKET_LEFT_Y }
        : { x: BASKET_RIGHT_X, y: BASKET_RIGHT_Y };

    // Calculate paint help spot
    var paintOffsetX = aiDefenseHelpValue("paintOffsetX", 10);
    var paintX = ourBasket.x + (teamName === "teamA" ? paintOffsetX : -paintOffsetX);
    var paintY = BASKET_LEFT_Y;
    var paintJitter = aiDefenseHelpValue("paintJitter", 2);

    var distBallToBasket = distanceBetweenPoints(ballCarrier.x, ballCarrier.y, ourBasket.x, ourBasket.y);

    // If ball carrier is driving (close to basket), help in paint
    if (distBallToBasket < aiDefenseHelpValue("ballCloseDistance", 15)) {
        playerData.aiLastAction = "help_paint";
        var helpTargetX = paintX + (Math.random() - 0.5) * paintJitter;
        var helpTargetY = paintY + (Math.random() - 0.5) * paintJitter;
        var response = aiDefenseHelpValue("responseBase", 0.22) +
            (getEffectiveAttribute(playerData, ATTR_SPEED) * aiDefenseHelpValue("responseAttrFactor", 0.03));
        if (dribbleDead) response *= aiDefenseHelpValue("dribbleDeadResponseScale", 0.7);
        var momentum = applyDefenderMomentum(player, helpTargetX, helpTargetY, response, false);
        var paintSpeed = dribbleDead
            ? aiDefenseHelpValue("paintSpeedDead", 1.8)
            : aiDefenseHelpValue("paintSpeedActive", 2.5);
        steerToward(player, momentum.x, momentum.y, paintSpeed, systems);
    } else {
        // Otherwise, deny passing lane to my man
        // Find the offensive player I should be guarding
        var myMan = null;
        var offensivePlayers = getOpposingTeam(teamName);

        // Guard whoever is NOT the ball carrier
        for (var i = 0; i < offensivePlayers.length; i++) {
            if (offensivePlayers[i] !== ballCarrier) {
                myMan = offensivePlayers[i];
                break;
            }
        }

        if (myMan) {
            // Position between my man and ball carrier to deny pass
            // NERFED: Add reaction delay and positional error so cuts can get open
            var reactionDelayBase = aiDefenseHelpValue("denyReactionDelayBase", 0.3);
            var reactionDelayRange = aiDefenseHelpValue("denyReactionDelayRange", 0.2);
            var reactionDelay = reactionDelayBase + Math.random() * reactionDelayRange;
            var positionErrorBase = aiDefenseHelpValue("denyPositionErrorBase", 2);
            var positionErrorRange = aiDefenseHelpValue("denyPositionErrorRange", 3);
            var positionError = positionErrorBase + Math.random() * positionErrorRange;

            var denyX = (myMan.x + ballCarrier.x) / 2 + (Math.random() - 0.5) * positionError;
            var denyY = (myMan.y + ballCarrier.y) / 2 + (Math.random() - 0.5) * positionError;

            playerData.aiLastAction = "deny_pass";
            if (dribbleDead) {
                denyX = (denyX * 0.6) + (myMan.x * 0.4);
                denyY = (denyY * 0.6) + (myMan.y * 0.4);
            }

            // Reduced response rate (was 0.2 + speed*0.03, now further reduced)
            var denyResponse = (aiDefenseHelpValue("denyResponseBase", 0.15) +
                (getEffectiveAttribute(playerData, ATTR_SPEED) * aiDefenseHelpValue("denyResponseAttrFactor", 0.02))) * reactionDelay;
            if (dribbleDead) denyResponse *= aiDefenseHelpValue("denyDribbleDeadScale", 0.6);
            var denyMomentum = applyDefenderMomentum(player, denyX, denyY, denyResponse, false);
            var denySpeed = dribbleDead
                ? aiDefenseHelpValue("denySpeedDead", 1.6)
                : aiDefenseHelpValue("denySpeedActive", 2);
            steerToward(player, denyMomentum.x, denyMomentum.y, denySpeed, systems);
        } else {
            // Fallback: protect paint
            playerData.aiLastAction = "fallback_paint";
            var fallbackX = paintX + (Math.random() - 0.5) * paintJitter;
            var fallbackY = paintY + (Math.random() - 0.5) * paintJitter;
            var fallbackResponse = dribbleDead
                ? aiDefenseHelpValue("fallbackResponseDead", 0.12)
                : aiDefenseHelpValue("fallbackResponseActive", 0.2);
            var fallbackMomentum = applyDefenderMomentum(player, fallbackX, fallbackY, fallbackResponse, false);
            var fallbackSpeed = dribbleDead
                ? aiDefenseHelpValue("fallbackSpeedDead", 1.5)
                : aiDefenseHelpValue("fallbackSpeedActive", 2);
            steerToward(player, fallbackMomentum.x, fallbackMomentum.y, fallbackSpeed, systems);
        }
    }
}
