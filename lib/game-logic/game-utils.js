/**
 * game-utils.js
 * 
 * General game state utility functions.
 * Handles player state management, dribble control, injury/knockdown mechanics,
 * and UI display helpers.
 */

/**
 * Get formatted jersey number display for a player
 * @param {Sprite} player - Player sprite
 * @returns {string} Formatted jersey number (2 characters, padded)
 */
function getJerseyDisplayValue(player) {
    if (!player || !player.playerData) return "";
    var rawJersey = (player.playerData.jerseyString !== undefined && player.playerData.jerseyString !== null)
        ? player.playerData.jerseyString
        : player.playerData.jersey;
    var jerseyValue = (rawJersey !== undefined && rawJersey !== null) ? String(rawJersey) : "";
    if (jerseyValue.length === 0) return "";
    if (jerseyValue.length < 2) {
        jerseyValue = padStart(jerseyValue, 2, ' ');
    }
    return jerseyValue;
}

/**
 * Calculate the total width needed for turbo bar display
 * @param {Sprite} player - Player sprite
 * @returns {number} Total width in characters
 */
function getTurboBarWidth(player) {
    if (!player || !player.playerData) return 0;
    var jerseyDisplay = getJerseyDisplayValue(player);
    var prefix = "#" + jerseyDisplay;
    var prefixLength = prefix.length;
    var barLength = 6; // Matches drawTurboBar segments
    return prefixLength + 2 + barLength; // prefix + '[' + ']' + segments
}

/**
 * Pick up dead dribble (player can no longer dribble)
 * @param {Sprite} player - Player picking up dribble
 * @param {string} reason - Reason for pickup ("user", "ai", "stuck")
 * @param {Object} systems - Systems object
 */
function pickUpDribble(player, reason, systems) {
    if (!player || !player.playerData) return;
    if (player.playerData.hasDribble === false) return;
    player.playerData.hasDribble = false;
    if (player === teamAPlayer1 && reason === "user" && systems) {
        announceEvent("dribble_pickup", {
            player: player,
            team: getPlayerTeamName(player),
            playerName: player.playerData.name
        }, systems);
    }
}

/**
 * Increment a player's injury counter
 * @param {Sprite} player - Player to injure
 * @param {number} amount - Amount to increment (default 1)
 */
function incrementInjury(player, amount) {
    if (!player || !player.playerData) return;
    if (player.playerData.injuryCount === undefined) {
        player.playerData.injuryCount = 0;
    }
    player.playerData.injuryCount += amount || 1;
    if (player.playerData.injuryCount < 0) {
        player.playerData.injuryCount = 0;
    }
}

/**
 * Set a player to be knocked down for a duration
 * @param {Sprite} player - Player to knock down
 * @param {number} duration - Duration in frames (default 30)
 */
function setPlayerKnockedDown(player, duration) {
    if (!player || !player.playerData) return;
    player.playerData.knockdownTimer = Math.max(duration || 30, 0);
    if (player.playerData.turboActive) player.playerData.turboActive = false;
}

/**
 * Check if a player is currently knocked down
 * @param {Sprite} player - Player to check
 * @returns {boolean} True if player is knocked down
 */
function isPlayerKnockedDown(player) {
    return !!(player && player.playerData && player.playerData.knockdownTimer > 0);
}
