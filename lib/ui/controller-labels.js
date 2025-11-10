/**
 * NBA JAM - Controller Label Management
 * 
 * Functions for managing and displaying player controller labels
 */

/**
 * Sanitize controller alias to safe display length
 * @param {string} alias - Raw alias/name
 * @param {number} maxLen - Maximum length (default 8)
 * @returns {string} Sanitized alias
 */
function sanitizeControllerAlias(alias, maxLen) {
    maxLen = maxLen || 8;
    if (!alias)
        return "";
    var trimmed = String(alias).trim();
    if (trimmed.length > maxLen)
        trimmed = trimmed.substring(0, maxLen);
    return trimmed;
}

/**
 * Set controller label on a sprite
 * @param {Object} sprite - Player sprite
 * @param {string} alias - Controller alias/name
 * @param {boolean} isHuman - Whether this is a human-controlled player
 */
function setSpriteControllerLabel(sprite, alias, isHuman) {
    if (!sprite || !sprite.playerData)
        return;
    var clean = sanitizeControllerAlias(alias || "CPU", 7);
    sprite.playerData.controllerLabel = "<" + clean + ">";
    sprite.playerData.controllerIsHuman = !!isHuman;
}

/**
 * Apply default controller labels to all players
 * Sets human player to user alias, CPU players to "CPU"
 */
function applyDefaultControllerLabels() {
    var alias = (typeof user !== "undefined" && user && user.alias) ? user.alias : "YOU";
    var sprites = [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
    for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        if (!sprite || !sprite.playerData)
            continue;
        if (sprite.isHuman) {
            setSpriteControllerLabel(sprite, alias, true);
        } else {
            setSpriteControllerLabel(sprite, "CPU", false);
        }
    }
}
