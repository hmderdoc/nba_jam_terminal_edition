/**
 * NBA JAM - Dead Dribble Timer
 * 
 * Manages the "dead dribble" mechanic where ball handler loses dribble ability
 */

/**
 * Reset the dead dribble timer and restore dribble ability to all players
 */
function resetDeadDribbleTimer() {
    gameState.ballHandlerDeadSince = null;
    gameState.ballHandlerDeadFrames = 0;
    gameState.ballHandlerDeadForcedShot = false;
    var everyone = getAllPlayers ? getAllPlayers() : null;
    if (everyone && everyone.length) {
        for (var i = 0; i < everyone.length; i++) {
            var sprite = everyone[i];
            if (sprite && sprite.playerData) {
                sprite.playerData.hasDribble = true;
            }
        }
    } else if (gameState.ballCarrier && gameState.ballCarrier.playerData) {
        gameState.ballCarrier.playerData.hasDribble = true;
    }
}

/**
 * Check if current ball handler has lost their dribble
 * @returns {boolean} True if handler can't dribble
 */
function isBallHandlerDribbleDead() {
    var handler = gameState.ballCarrier;
    return !!(handler && handler.playerData && handler.playerData.hasDribble === false);
}

/**
 * Get elapsed time since ball handler lost dribble
 * @returns {number} Milliseconds elapsed
 */
function getBallHandlerDeadElapsed() {
    if (!gameState.ballHandlerDeadSince) return 0;
    var now = getTimeMs();
    return Math.max(0, now - gameState.ballHandlerDeadSince);
}
