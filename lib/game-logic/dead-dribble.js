/**
 * NBA JAM - Dead Dribble Timer
 * 
 * Manages the "dead dribble" mechanic where ball handler loses dribble ability
 */

/**
 * Reset the dead dribble timer and restore dribble ability to all players
 */
function resetDeadDribbleTimer(systems) {
    var stateManager = systems.stateManager;

    stateManager.set("ballHandlerDeadSince", null, "dead_dribble_reset");
    stateManager.set("ballHandlerDeadFrames", 0, "dead_dribble_reset");
    stateManager.set("ballHandlerDeadForcedShot", false, "dead_dribble_reset");

    var gameState = stateManager.get();
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
function isBallHandlerDribbleDead(systems) {
    var stateManager = systems.stateManager;
    var gameState = stateManager.get();
    var handler = gameState.ballCarrier;
    return !!(handler && handler.playerData && handler.playerData.hasDribble === false);
}

/**
 * Get elapsed time since ball handler lost dribble
 * @returns {number} Milliseconds elapsed
 */
function getBallHandlerDeadElapsed(systems) {
    var stateManager = systems.stateManager;
    var gameState = stateManager.get();
    if (!gameState.ballHandlerDeadSince) return 0;
    var now = getTimeMs();
    return Math.max(0, now - gameState.ballHandlerDeadSince);
}
