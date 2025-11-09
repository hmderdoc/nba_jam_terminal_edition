// NBA Jam Shoe Color System
// Dynamic shoe color management based on turbo levels

// ============================================================================
// SHOE PALETTE MANAGEMENT
// ============================================================================

function cloneShoePalette(entry) {
    if (!entry) return null;
    return {
        name: entry.name,
        high: entry.high,
        low: entry.low
    };
}

function buildShoePalettePool() {
    var pool = [];
    if (ShoeColorConfig && ShoeColorConfig.palettes && ShoeColorConfig.palettes.length) {
        for (var i = 0; i < ShoeColorConfig.palettes.length; i++) {
            pool.push(cloneShoePalette(ShoeColorConfig.palettes[i]));
        }
    }
    return pool;
}

function paletteConflictsWithTeam(palette, teamColors) {
    if (!palette || !teamColors) return false;
    var blocked = [];
    if (typeof teamColors.fg === "number") blocked.push(teamColors.fg & FG_MASK);
    if (typeof teamColors.fg_accent === "number") blocked.push(teamColors.fg_accent & FG_MASK);
    if (typeof teamColors.bg === "number") blocked.push(bgToFg(teamColors.bg));
    if (typeof teamColors.bg_alt === "number") blocked.push(bgToFg(teamColors.bg_alt));
    for (var i = 0; i < blocked.length; i++) {
        var color = blocked[i];
        if (color === null || color === undefined) continue;
        if (palette.high === color || palette.low === color) {
            return true;
        }
    }
    return false;
}

function resetShoePaletteAssignments() {
    shoePalettePool = buildShoePalettePool();
}

function assignShoePalette(teamColors) {
    if (!shoePalettePool || !shoePalettePool.length) {
        shoePalettePool = buildShoePalettePool();
    }
    var fallbackIndex = -1;
    for (var i = 0; i < shoePalettePool.length; i++) {
        var candidate = shoePalettePool[i];
        if (!candidate) continue;
        if (paletteConflictsWithTeam(candidate, teamColors)) {
            if (fallbackIndex === -1) fallbackIndex = i;
            continue;
        }
        shoePalettePool.splice(i, 1);
        return cloneShoePalette(candidate);
    }
    if (fallbackIndex >= 0) {
        var fallback = shoePalettePool.splice(fallbackIndex, 1)[0];
        return cloneShoePalette(fallback);
    }
    return null;
}

// ============================================================================
// PLAYER SHOE COLOR QUERIES
// ============================================================================

function getPlayerShoePalette(player) {
    if (!player || !player.playerData || !player.playerData.shoeColors) return null;
    return player.playerData.shoeColors;
}

/**
 * Get the color for player's shoe based on turbo level and flash state
 * @param {Object} player - Player sprite
 * @param {Object} systems - Systems object for state access
 * @returns {number|null} Color attribute or null
 */
function getPlayerTurboColor(player, systems) {
    var palette = getPlayerShoePalette(player);
    if (!palette) return null;
    var turbo = (player && player.playerData && typeof player.playerData.turbo === "number") ? player.playerData.turbo : 0;
    var isFlashing = player && player.playerData && player.playerData.turboActive && turbo > 0;
    if (isFlashing) {
        var tick = 0;
        if (systems && systems.stateManager) {
            tick = systems.stateManager.get('tickCounter') || 0;
        }
        return (tick % 4 < 2) ? palette.high : palette.low;
    }
    return (turbo >= SHOE_TURBO_THRESHOLD) ? palette.high : palette.low;
}

// ============================================================================
// SHOE COLOR APPLICATION
// ============================================================================

/**
 * Update player's shoe color based on turbo state
 * @param {Object} player - Player sprite
 * @param {Object} systems - Systems object for state access
 */
function updatePlayerShoeColor(player, systems) {
    if (!player || !player.playerData) return;
    var palette = getPlayerShoePalette(player);
    if (!palette) return;
    var desired = getPlayerTurboColor(player, systems);
    if (desired === null) desired = palette.high;
    if (player.playerData.currentShoeColor === desired) return;
    applyShoeColorToSprite(player, desired);
    player.playerData.currentShoeColor = desired;
}

function applyShoePaletteToPlayer(sprite) {
    if (!sprite || !sprite.playerData || !sprite.assignedShoePalette) return;
    var palette = sprite.assignedShoePalette;
    sprite.playerData.shoeColors = {
        high: palette.high,
        low: palette.low,
        name: palette.name
    };
    sprite.playerData.currentShoeColor = palette.high;
}
