/**
 * NBA JAM - Player and Team Helper Functions
 * 
 * This module provides utility functions for querying and manipulating
 * player sprites and team arrays.
 * 
 * NOTE: Migrated to use spriteRegistry instead of global variables.
 */

/**
 * Get all four player sprites as an array
 */
function getAllPlayers() {
    return spriteRegistry.getAllPlayers();
}

/**
 * Find the closest player to given coordinates from a specific team
 */
function getClosestPlayer(x, y, team) {
    if (!team || !team.length) return null;
    var closest = team[0];
    var closestDist = distanceBetweenPoints(x, y, team[0].x, team[0].y);
    for (var i = 1; i < team.length; i++) {
        var dist = distanceBetweenPoints(x, y, team[i].x, team[i].y);
        if (dist < closestDist) {
            closestDist = dist;
            closest = team[i];
        }
    }
    return closest;
}

/**
 * Get the team name ("teamA" or "teamB") for a player sprite
 */
function getPlayerTeamName(player) {
    if (!player || !player.playerData) return null;
    return player.playerData.team || null;
}

/**
 * Get a player's teammate sprite
 */
function getPlayerTeammate(player) {
    if (!player || !player.playerData) return null;
    var teamName = player.playerData.team;
    var team = spriteRegistry.getByTeam(teamName);
    if (!team || team.length < 2) return null;
    return team[0] === player ? team[1] : team[0];
}

/**
 * Get team sprites by team name
 */
function getTeamSprites(teamName) {
    return spriteRegistry.getByTeam(teamName);
}

/**
 * Get opposing team sprites by team name
 */
function getOpposingTeamSprites(teamName) {
    var opposingTeam = teamName === "teamA" ? "teamB" : "teamA";
    return spriteRegistry.getByTeam(opposingTeam);
}

/**
 * Get the player key string (e.g., "teamAPlayer1")
 */
function getPlayerKey(player) {
    // Search registry for this sprite
    for (var id in spriteRegistry.sprites) {
        if (spriteRegistry.sprites[id] === player) {
            return id;
        }
    }
    return null;
}

/**
 * Get opposing team sprites array
 */
function getOpposingTeam(teamName) {
    return getOpposingTeamSprites(teamName);
}

/**
 * Calculate distance between two sprites
 */
function getSpriteDistance(spriteA, spriteB) {
    if (!spriteA || !spriteB) return 999;
    return distanceBetweenPoints(spriteA.x, spriteA.y, spriteB.x, spriteB.y);
}

/**
 * Get teammate by player and team name
 */
function getTeammate(player, teamName) {
    var team = getTeamSprites(teamName);
    if (!team || team.length < 2) return null;
    return team[0] === player ? team[1] : team[0];
}

/**
 * Convert bearing string to directional vector
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
 * Sanitize and truncate controller alias to max length
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
 * Set controller label on a player sprite
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
 */
function applyDefaultControllerLabels() {
    var alias = (typeof user !== "undefined" && user && user.alias) ? user.alias : "YOU";
    var sprites = spriteRegistry.getAllPlayers();
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
