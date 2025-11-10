/**
 * fire-effects.js
 * 
 * Visual effects for "on fire" player animations.
 * Handles fire color cycling and trail rendering.
 */

// Fire color animation sequence
var FIRE_COLOR_SEQUENCE = [RED, LIGHTRED, YELLOW, WHITE];

/**
 * Get the current index in the fire color sequence based on game tick
 * @param {number} stepOffset - Optional offset to apply to the tick counter
 * @param {Object} systems - Systems object for state management
 * @returns {number} Index into FIRE_COLOR_SEQUENCE
 */
function getFireColorIndex(stepOffset, systems) {
    var tick = 0;
    if (systems && systems.stateManager) {
        tick = systems.stateManager.get('tickCounter') || 0;
    }
    var total = tick + (stepOffset || 0);
    var len = FIRE_COLOR_SEQUENCE.length;
    var idx = total % len;
    if (idx < 0) idx += len;
    return idx;
}

/**
 * Get the foreground color for the fire effect at current animation step
 * @param {number} stepOffset - Optional offset to apply to the tick counter
 * @param {Object} systems - Systems object for state management
 * @returns {number} Foreground color mask
 */
function getFireFg(stepOffset, systems) {
    return FIRE_COLOR_SEQUENCE[getFireColorIndex(stepOffset, systems)] & FG_MASK;
}

/**
 * Get the attribute for the "on fire" trail effect
 * Returns fire color if player is on fire, otherwise returns default
 * @param {Sprite} player - Player sprite to check
 * @param {number} stepOffset - Animation step offset
 * @param {number} defaultAttr - Default attribute if not on fire
 * @returns {number} Color attribute for trail
 */
function getOnFireTrailAttr(player, stepOffset, defaultAttr) {
    var baseAttr = (typeof defaultAttr === "number") ? defaultAttr : (LIGHTGRAY | WAS_BROWN);
    if (!player || !player.playerData || !player.playerData.onFire)
        return baseAttr;
    var fireFg = getFireFg(stepOffset);
    return composeAttrWithColor(baseAttr, fireFg, baseAttr & BG_MASK);
}
