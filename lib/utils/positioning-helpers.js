/**
 * positioning-helpers.js
 * 
 * Court geometry, distance calculations, and positioning utility functions.
 * Provides helper functions for spatial calculations and player positioning.
 */

/**
 * Clamp a value between a minimum and maximum
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

/**
 * Calculate distance from a player sprite to their offensive basket
 * @param {Sprite} player - Player sprite
 * @param {string} teamName - Team name ("teamA" or "teamB")
 * @returns {number} Distance to basket
 */
function getSpriteDistanceToBasket(player, teamName) {
    if (!player) return 0;
    var basket = teamName === "teamA"
        ? { x: BASKET_RIGHT_X, y: BASKET_RIGHT_Y }
        : { x: BASKET_LEFT_X, y: BASKET_LEFT_Y };
    return distanceBetweenPoints(player.x, player.y, basket.x, basket.y);
}

/**
 * Calculate distance between two sprites
 * @param {Sprite} spriteA - First sprite
 * @param {Sprite} spriteB - Second sprite
 * @returns {number} Distance between sprites
 */
function getSpriteDistance(spriteA, spriteB) {
    if (!spriteA || !spriteB) return 999;
    return distanceBetweenPoints(spriteA.x, spriteA.y, spriteB.x, spriteB.y);
}

/**
 * Get all opponent sprites touching (within radius of) the specified player
 * @param {Sprite} player - Player sprite to check around
 * @param {string} teamName - Team name of the player
 * @param {number} radius - Touch radius (default 2.6)
 * @returns {Array<Sprite>} Array of touching opponent sprites
 */
function getTouchingOpponents(player, teamName, radius) {
    if (!player) return [];
    var opponents = getOpposingTeamSprites(teamName || getPlayerTeamName(player));
    if (!opponents || !opponents.length) return [];
    var touchRadius = radius || 2.6;
    var touching = [];
    for (var i = 0; i < opponents.length; i++) {
        var opp = opponents[i];
        if (!opp || !opp.playerData) continue;
        if (getSpriteDistance(player, opp) <= touchRadius) {
            touching.push(opp);
        }
    }
    return touching;
}

/**
 * Convert a bearing string to a direction vector
 * @param {string} bearing - Bearing direction (n, ne, e, se, s, sw, w, nw)
 * @returns {Object} Direction vector with dx and dy properties
 */
function getBearingVector(bearing) {
    switch ((bearing || "").toLowerCase()) {
        case "n": return { dx: 0, dy: -1 };
        case "ne": return { dx: 1, dy: -1 };
        case "e": return { dx: 1, dy: 0 };
        case "se": return { dx: 1, dy: 1 };
        case "s": return { dx: 0, dy: 1 };
        case "sw": return { dx: -1, dy: 1 };
        case "w": return { dx: -1, dy: 0 };
        case "nw": return { dx: -1, dy: -1 };
        default: return { dx: 0, dy: 0 };
    }
}

/**
 * Get base attribute value for a player
 * @param {Object} playerData - Player data object
 * @param {number} attrIndex - Attribute index (0-5)
 * @returns {number} Base attribute value
 */
function getBaseAttribute(playerData, attrIndex) {
    if (!playerData || !playerData.attributes) return 0;
    var value = playerData.attributes[attrIndex];
    return (typeof value === "number") ? value : 0;
}

/**
 * Get effective attribute value for a player (accounts for "on fire" status)
 * @param {Object} playerData - Player data object
 * @param {number} attrIndex - Attribute index (0-5)
 * @returns {number} Effective attribute value (10 if on fire, otherwise base)
 */
function getEffectiveAttribute(playerData, attrIndex) {
    if (!playerData) return 0;
    if (playerData.onFire) return 10;
    return getBaseAttribute(playerData, attrIndex);
}
