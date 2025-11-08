/**
 * stats-tracker.js
 * 
 * Player statistics tracking and assist management.
 * Handles recording of turnovers, assist tracking, and stat attribution.
 */

/**
 * Clear the current potential assist tracking
 */
function clearPotentialAssist(systems) {
    var stateManager = systems.stateManager;
    stateManager.set("potentialAssist", null, "assist_cleared");
}

/**
 * Record a turnover for a player
 * @param {Sprite} player - Player who committed the turnover
 * @param {string} reason - Optional reason/description of the turnover
 */
function recordTurnover(player, reason) {
    if (!player || !player.playerData) return;
    var stats = player.playerData.stats;
    if (!stats) {
        stats = {};
        player.playerData.stats = stats;
    }
    if (typeof stats.turnovers !== "number") stats.turnovers = 0;
    stats.turnovers++;
    if (reason) {
        player.playerData.lastTurnoverReason = reason;
    } else {
        player.playerData.lastTurnoverReason = null;
    }
}

/**
 * Set up a potential assist when a pass is made
 * Tracks the passer and receiver for potential assist attribution
 * @param {Sprite} passer - Player making the pass
 * @param {Sprite} receiver - Player receiving the pass
 */
function setPotentialAssist(passer, receiver, systems) {
    var stateManager = systems.stateManager;
    var gameState = stateManager.get();

    if (gameState.inbounding) {
        clearPotentialAssist(systems);
        return;
    }
    if (!passer || !receiver || !passer.playerData || !receiver.playerData) {
        clearPotentialAssist(systems);
        return;
    }
    stateManager.set("potentialAssist", {
        passer: passer,
        receiver: receiver,
        team: getPlayerTeamName(passer),
        timestamp: getTimeMs()
    }, "assist_tracked");
}

/**
 * Award an assist to the passer if conditions are met
 * Called when a player scores - checks if there was a recent pass
 * @param {Sprite} scorer - Player who scored
 */
function maybeAwardAssist(scorer, systems) {
    var stateManager = systems.stateManager;
    var gameState = stateManager.get();
    var potential = gameState.potentialAssist;
    if (!potential || !potential.passer || !potential.receiver) return;
    if (!scorer) return;
    if (potential.receiver !== scorer) return;
    if (potential.passer === scorer) return;

    var passerData = potential.passer.playerData;
    if (!passerData || !passerData.stats) return;

    var scorerTeam = getPlayerTeamName(scorer);
    if (!scorerTeam || potential.team !== scorerTeam) return;

    var now = getTimeMs();
    if (potential.timestamp && now && now - potential.timestamp > 6000) return;

    passerData.stats.assists++;
}
