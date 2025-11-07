/**
 * NBA JAM - Player and Team Helper Functions
 * 
 * This module provides utility functions for querying and manipulating
 * player sprites and team arrays.
 */

/**
 * Get all four player sprites as an array
 */
function getAllPlayers() {
    return [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
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
    if (player === teamAPlayer1 || player === teamAPlayer2)
        return "teamA";
    return "teamB";
}

/**
 * Get a player's teammate sprite
 */
function getPlayerTeammate(player) {
    if (player === teamAPlayer1) return teamAPlayer2;
    if (player === teamAPlayer2) return teamAPlayer1;
    if (player === teamBPlayer1) return teamBPlayer2;
    if (player === teamBPlayer2) return teamBPlayer1;
    return null;
}

/**
 * Get team sprites by team name
 */
function getTeamSprites(teamName) {
    return teamName === "teamA"
        ? [teamAPlayer1, teamAPlayer2]
        : [teamBPlayer1, teamBPlayer2];
}

/**
 * Get opposing team sprites by team name
 */
function getOpposingTeamSprites(teamName) {
    return teamName === "teamA"
        ? [teamBPlayer1, teamBPlayer2]
        : [teamAPlayer1, teamAPlayer2];
}

/**
 * Get the player key string (e.g., "teamAPlayer1")
 */
function getPlayerKey(player) {
    if (player === teamAPlayer1) return "teamAPlayer1";
    if (player === teamAPlayer2) return "teamAPlayer2";
    if (player === teamBPlayer1) return "teamBPlayer1";
    if (player === teamBPlayer2) return "teamBPlayer2";
    return null;
}

/**
 * Get opposing team sprites array
 */
function getOpposingTeam(teamName) {
    return teamName === "teamA"
        ? [teamBPlayer1, teamBPlayer2]
        : [teamAPlayer1, teamAPlayer2];
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
