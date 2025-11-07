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
 * - gameState.onFire[teamKey] (boolean)
 */

/**
 * Set a player as "on fire" (hot streak active)
 * Called when player meets fire criteria (e.g., 3+ consecutive makes)
 */
function setPlayerOnFire(player) {
    if (!player || !player.playerData) return;

    // Initialize fire make streak if not set
    if (typeof player.playerData.fireMakeStreak !== "number") {
        player.playerData.fireMakeStreak = 0;
    }

    player.playerData.onFire = true;

    // Update team-level fire flag
    var team = getPlayerTeamName(player);
    if (team) {
        gameState.onFire[team] = true;
    }
}

/**
 * Clear "on fire" state from a player
 * Called when player misses or commits violation while on fire
 */
function clearPlayerOnFire(player) {
    if (!player || !player.playerData) return;

    player.playerData.onFire = false;
    player.playerData.heatStreak = 0;
    player.playerData.fireMakeStreak = 0;

    // Update team-level fire flag (may still be true if teammate is on fire)
    var team = getPlayerTeamName(player);
    if (team) {
        updateTeamOnFireFlag(team);
    }
}

/**
 * Clear "on fire" state from entire team
 * Called on defensive events like steals/blocks against on-fire team
 */
function clearTeamOnFire(teamKey) {
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

    gameState.onFire[teamKey] = false;
}

/**
 * Update team-level "on fire" flag based on player states
 * Team is on fire if ANY player on team is on fire
 */
function updateTeamOnFireFlag(teamKey) {
    if (!teamKey || !gameState.onFire) return;

    var sprites = getTeamSprites(teamKey) || [];
    var active = false;

    for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        if (sprite && sprite.playerData && sprite.playerData.onFire) {
            active = true;
            break;
        }
    }

    gameState.onFire[teamKey] = active;
}

/**
 * Check if a player is currently on fire
 */
function isPlayerOnFire(player) {
    return !!(player && player.playerData && player.playerData.onFire);
}

/**
 * Check if a team has any players on fire
 */
function isTeamOnFire(teamKey) {
    return !!(gameState.onFire && gameState.onFire[teamKey]);
}

/**
 * Get fire make streak for a player
 */
function getFireMakeStreak(player) {
    if (!player || !player.playerData) return 0;
    return player.playerData.fireMakeStreak || 0;
}

/**
 * Increment fire make streak for a player
 * Returns new streak count
 */
function incrementFireStreak(player) {
    if (!player || !player.playerData) return 0;

    if (typeof player.playerData.fireMakeStreak !== "number") {
        player.playerData.fireMakeStreak = 0;
    }

    player.playerData.fireMakeStreak++;
    return player.playerData.fireMakeStreak;
}
