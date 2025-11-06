/**
 * AI: Defense - Help (Off-Ball Defender)
 * 
 * Controls AI decision-making for the help defender (not guarding ball)
 * Strategy: Protect paint when ball close, deny passing lanes when ball far
 */

load("sbbsdefs.js");

/**
 * AI logic for help defender (off-ball defense)
 * @param {Object} player - Sprite with playerData
 * @param {string} teamName - "red" or "blue"
 * @param {Object} ballCarrier - Sprite of player with ball
 */
function aiDefenseHelp(player, teamName, ballCarrier) {
    var playerData = player.playerData;
    if (!playerData || !ballCarrier) return;

    var dribbleDead = isBallHandlerDribbleDead();
    var ourBasket = teamName === "red"
        ? { x: BASKET_LEFT_X, y: BASKET_LEFT_Y }
        : { x: BASKET_RIGHT_X, y: BASKET_RIGHT_Y };

    // Calculate paint help spot
    var paintX = ourBasket.x + (teamName === "red" ? 10 : -10); // 10 units from basket
    var paintY = BASKET_LEFT_Y;

    var distBallToBasket = distanceBetweenPoints(ballCarrier.x, ballCarrier.y, ourBasket.x, ourBasket.y);

    // If ball carrier is driving (close to basket), help in paint
    if (distBallToBasket < 15) {
        playerData.aiLastAction = "help_paint";
        var helpTargetX = paintX + (Math.random() - 0.5) * 2;
        var helpTargetY = paintY + (Math.random() - 0.5) * 2;
        var response = 0.22 + (getEffectiveAttribute(playerData, ATTR_SPEED) * 0.03);
        if (dribbleDead) response *= 0.7;
        var momentum = applyDefenderMomentum(player, helpTargetX, helpTargetY, response, false);
        var paintSpeed = dribbleDead ? 1.8 : 2.5;
        steerToward(player, momentum.x, momentum.y, paintSpeed);
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
            var reactionDelay = 0.3 + Math.random() * 0.2; // 30-50% slower reaction
            var positionError = 2 + Math.random() * 3; // Random 2-5 unit error

            var denyX = (myMan.x + ballCarrier.x) / 2 + (Math.random() - 0.5) * positionError;
            var denyY = (myMan.y + ballCarrier.y) / 2 + (Math.random() - 0.5) * positionError;

            playerData.aiLastAction = "deny_pass";
            if (dribbleDead) {
                denyX = (denyX * 0.6) + (myMan.x * 0.4);
                denyY = (denyY * 0.6) + (myMan.y * 0.4);
            }

            // Reduced response rate (was 0.2 + speed*0.03, now further reduced)
            var denyResponse = (0.15 + (getEffectiveAttribute(playerData, ATTR_SPEED) * 0.02)) * reactionDelay;
            if (dribbleDead) denyResponse *= 0.6;
            var denyMomentum = applyDefenderMomentum(player, denyX, denyY, denyResponse, false);
            var denySpeed = dribbleDead ? 1.6 : 2;
            steerToward(player, denyMomentum.x, denyMomentum.y, denySpeed);
        } else {
            // Fallback: protect paint
            playerData.aiLastAction = "fallback_paint";
            var fallbackX = paintX + (Math.random() - 0.5) * 2;
            var fallbackY = paintY + (Math.random() - 0.5) * 2;
            var fallbackResponse = dribbleDead ? 0.12 : 0.2;
            var fallbackMomentum = applyDefenderMomentum(player, fallbackX, fallbackY, fallbackResponse, false);
            steerToward(player, fallbackMomentum.x, fallbackMomentum.y, dribbleDead ? 1.5 : 2);
        }
    }
}
