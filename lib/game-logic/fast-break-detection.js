/**
 * NBA JAM - Fast Break Detection
 * 
 * Detects and evaluates fast break opportunities
 * Helps AI make better transition decisions
 */

/**
 * Detect if a fast break opportunity exists
 * @param {Object} ballCarrier - Player with the ball
 * @param {string} offenseTeam - Offensive team name ("teamA" or "teamB")
 * @returns {Object|null} Fast break info or null
 */
function detectFastBreak(ballCarrier, offenseTeam) {
    if (!ballCarrier) return null;
    
    var defenseTeam = (offenseTeam === "teamA") ? "teamB" : "teamA";
    var targetBasketX = (offenseTeam === "teamA") ? BASKET_RIGHT_X : BASKET_LEFT_X;
    var myBasketX = (offenseTeam === "teamA") ? BASKET_LEFT_X : BASKET_RIGHT_X;
    var courtMidX = Math.floor(COURT_WIDTH / 2);
    
    // Ball carrier must be in backcourt or near midcourt
    var ballCarrierDistFromOwnBasket = Math.abs(ballCarrier.x - myBasketX);
    var inBackcourt = isInBackcourt(ballCarrier, offenseTeam);
    var nearMidcourt = Math.abs(ballCarrier.x - courtMidX) < 10;
    
    if (!inBackcourt && !nearMidcourt) {
        return null; // Already in halfcourt offense
    }
    
    // Get defenders
    var defenders = getOpposingTeamSprites(offenseTeam);
    if (!defenders || defenders.length === 0) return null;
    
    // Count defenders ahead of the ball (between ball and target basket)
    var defendersAhead = 0;
    var closestDefenderDist = 999;
    var attackDirection = (offenseTeam === "teamA") ? 1 : -1;
    
    for (var i = 0; i < defenders.length; i++) {
        var defender = defenders[i];
        if (!defender) continue;
        
        // Check if defender is ahead of ball (closer to target basket)
        var defenderAheadOfBall = (attackDirection > 0) 
            ? (defender.x > ballCarrier.x)
            : (defender.x < ballCarrier.x);
            
        if (defenderAheadOfBall) {
            defendersAhead++;
        }
        
        // Track closest defender to ball carrier
        var dist = getSpriteDistance(ballCarrier, defender);
        if (dist < closestDefenderDist) {
            closestDefenderDist = dist;
        }
    }
    
    // Fast break criteria:
    // 1. Fewer than 2 defenders ahead of the ball (numerical advantage)
    // 2. Closest defender is at least 8 units away (can't contest immediately)
    // 3. Ball carrier in backcourt or transition zone
    
    var isFastBreak = (defendersAhead < 2 && closestDefenderDist > 8);
    
    if (!isFastBreak) return null;
    
    // Calculate fast break quality
    var quality = "standard";
    if (defendersAhead === 0) {
        quality = "wide_open"; // No defenders ahead - clear path
    } else if (closestDefenderDist > 15) {
        quality = "advantage"; // Large spacing advantage
    }
    
    return {
        isFastBreak: true,
        quality: quality,
        defendersAhead: defendersAhead,
        closestDefenderDistance: closestDefenderDist,
        targetBasketX: targetBasketX,
        suggestedSpeed: quality === "wide_open" ? "full_sprint" : "fast_push"
    };
}

/**
 * Get optimal fast break target position
 * @param {Object} fastBreakInfo - Fast break info from detectFastBreak()
 * @param {string} offenseTeam - Offensive team name
 * @returns {Object} { x, y } target coordinates
 */
function getFastBreakTarget(fastBreakInfo, offenseTeam) {
    if (!fastBreakInfo || !fastBreakInfo.isFastBreak) {
        return null;
    }
    
    var targetBasketX = fastBreakInfo.targetBasketX;
    var targetBasketY = BASKET_LEFT_Y;
    
    // If wide open, go straight to basket
    if (fastBreakInfo.quality === "wide_open") {
        return { x: targetBasketX, y: targetBasketY };
    }
    
    // If advantage, push to near paint
    var attackDirection = (offenseTeam === "teamA") ? 1 : -1;
    var paintEdgeX = targetBasketX - (attackDirection * 12);
    
    return { x: paintEdgeX, y: targetBasketY };
}

/**
 * Should AI use turbo on this fast break?
 * @param {Object} fastBreakInfo - Fast break info
 * @param {Object} player - Player sprite
 * @returns {boolean} True if should use turbo
 */
function shouldUseTurboOnFastBreak(fastBreakInfo, player) {
    if (!fastBreakInfo || !fastBreakInfo.isFastBreak) return false;
    if (!player || !player.playerData) return false;
    
    // Always use turbo on wide open fast breaks
    if (fastBreakInfo.quality === "wide_open") return true;
    
    // Use turbo if we have enough and defender is far
    if (player.playerData.turbo > 20 && fastBreakInfo.closestDefenderDistance > 12) {
        return true;
    }
    
    return false;
}
