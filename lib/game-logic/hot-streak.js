/**
 * NBA JAM - Hot Streak (On Fire) Module
 * 
 * Manages "On Fire" state for players and teams.
 * Separated from UI (announcer.js) to keep game logic independent.
 * 
 * State Management:
 * - player.playerData.onFire (boolean)
 * - player.playerData.fireMakeStreak (number)
 * - player.playerData.heatStreak (number)
 * - stateManager.get('onFire')[teamKey] (boolean)
 */

/**
 * Set a player as "on fire" (hot streak active)
 * Called when player meets fire criteria (e.g., 3+ consecutive makes)
 */
function setPlayerOnFire(player, systems) {
    var stateManager = systems.stateManager;
    var onFire = stateManager.get('onFire');
    if (!player || !player.playerData) return;

    // Initialize fire make streak if not set
    if (typeof player.playerData.fireMakeStreak !== "number") {
        player.playerData.fireMakeStreak = 0;
    }

    player.playerData.onFire = true;

    // Update team-level fire flag
    var team = getPlayerTeamName(player);
    if (team) {
        onFire[team] = true;
    }
}

/**
 * Clear "on fire" state from entire team
 * Called on defensive events like steals/blocks against on-fire team
 */
function clearTeamOnFire(teamKey, systems) {
    var stateManager = systems.stateManager;
    var onFire = stateManager.get('onFire');
    if (!teamKey) return;

    var sprites = getTeamSprites(teamKey) || [];
    for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        if (sprite && sprite.playerData) {
            sprite.playerData.onFire = false;
            sprite.playerData.heatStreak = 0;
            sprite.playerData.fireMakeStreak = 0;
        }
    }

    onFire[teamKey] = false;
}

/**
 * Update team-level "on fire" flag based on player states
 * Team is on fire if ANY player on team is on fire
 */
function updateTeamOnFireFlag(teamKey, systems) {
    var stateManager = systems.stateManager;
    var onFire = stateManager.get('onFire');
    if (!teamKey || !onFire) return;

    var sprites = getTeamSprites(teamKey) || [];
    var active = false;

    for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        if (sprite && sprite.playerData && sprite.playerData.onFire) {
            active = true;
            break;
        }
    }

    onFire[teamKey] = active;
}
