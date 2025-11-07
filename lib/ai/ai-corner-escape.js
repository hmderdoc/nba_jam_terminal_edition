/**
 * NBA JAM - AI Corner Detection and Escape
 * 
 * Prevents AI from getting trapped in corners and triggering violations
 */

/**
 * Detect if a player is stuck in a corner
 * @param {Object} player - Player sprite
 * @returns {boolean} True if player is in corner
 */
function isInCorner(player) {
    if (!player) return false;
    
    var margin = 6; // Corner is within 6 units of any edge
    var nearLeftEdge = player.x < margin;
    var nearRightEdge = player.x > (COURT_WIDTH - margin);
    var nearTopEdge = player.y < margin;
    var nearBottomEdge = player.y > (COURT_HEIGHT - margin);
    
    // Corner = near two perpendicular edges
    return (nearLeftEdge || nearRightEdge) && (nearTopEdge || nearBottomEdge);
}

/**
 * Get escape target from corner toward court center
 * @param {Object} player - Player sprite
 * @param {string} teamName - Team name ("teamA" or "teamB")
 * @returns {Object} { x, y } target position
 */
function getCornerEscapeTarget(player, teamName) {
    if (!player) return { x: COURT_WIDTH / 2, y: COURT_HEIGHT / 2 };
    
    var courtCenterX = Math.floor(COURT_WIDTH / 2);
    var courtCenterY = Math.floor(COURT_HEIGHT / 2);
    
    // If ball handler, escape toward offensive basket, not just center
    var targetBasketX = (teamName === "teamA") ? BASKET_RIGHT_X : BASKET_LEFT_X;
    var targetBasketY = BASKET_LEFT_Y;
    
    var isBallHandler = (gameState.ballCarrier === player);
    
    if (isBallHandler) {
        // Ball handler - escape toward offensive basket
        // But don't go too close (leave room for shot)
        var attackDirection = (teamName === "teamA") ? 1 : -1;
        var targetX = targetBasketX - (attackDirection * 10);
        return { x: targetX, y: targetBasketY };
    } else {
        // Non-ball handler - escape toward center
        return { x: courtCenterX, y: courtCenterY };
    }
}

/**
 * Execute corner escape movement for AI
 * @param {Object} player - Player sprite
 * @param {string} teamName - Team name
 */
function executeCornerEscape(player, teamName) {
    if (!player || !player.playerData) return;
    
    var escapeTarget = getCornerEscapeTarget(player, teamName);
    
    // Use turbo if available to escape quickly
    if (player.playerData.turbo > 10) {
        var escapeDistance = distanceBetweenPoints(player.x, player.y, escapeTarget.x, escapeTarget.y);
        activateAITurbo(player, 0.9, escapeDistance); // Aggressive turbo to escape
    }
    
    moveAITowards(player, escapeTarget.x, escapeTarget.y);
}

/**
 * Check if AI ball handler is trapped in corner and needs help
 * @param {Object} player - Player sprite
 * @param {string} teamName - Team name
 * @returns {boolean} True if trapped and should pass/escape immediately
 */
function isTrappedInCorner(player, teamName) {
    if (!player || !isInCorner(player)) return false;
    
    // Check if defenders are nearby (trapped = in corner + defenders close)
    var opponentTeam = (teamName === "teamA") ? "teamB" : "teamA";
    var opponents = getOpposingTeamSprites(teamName);
    
    var nearbyDefenders = 0;
    for (var i = 0; i < opponents.length; i++) {
        if (!opponents[i]) continue;
        var dist = getSpriteDistance(player, opponents[i]);
        if (dist < 8) {
            nearbyDefenders++;
        }
    }
    
    // Trapped if in corner with at least one nearby defender
    return nearbyDefenders > 0;
}
