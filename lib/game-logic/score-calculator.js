/**
 * NBA JAM - Score Calculator
 * 
 * Pure game logic for score-related calculations
 * Decoupled from UI - returns data, doesn't render
 */

/**
 * Get the team currently leading
 * @returns {string} "teamA", "teamB", or "tie"
 */
function getLeadingTeam() {
    var diff = gameState.scores.teamA - gameState.scores.teamB;
    if (diff > 0) return "teamA";
    if (diff < 0) return "teamB";
    return "tie";
}

/**
 * Get the absolute score differential
 * @returns {number} Point difference between teams
 */
function getScoreDifferential() {
    return Math.abs(gameState.scores.teamA - gameState.scores.teamB);
}

/**
 * Check if the game is a blowout (20+ point lead)
 * @returns {boolean} True if one team is up by 20 or more
 */
function isBlowout() {
    return getScoreDifferential() >= 20;
}

/**
 * Check if the game is close (5 points or less)
 * @returns {boolean} True if score differential is 5 or less
 */
function isCloseGame() {
    return getScoreDifferential() <= 5;
}

/**
 * Check if the game is very close (1 possession game)
 * @returns {boolean} True if score differential is 3 or less
 */
function isOnePossessionGame() {
    return getScoreDifferential() <= 3;
}

/**
 * Get game situation description
 * @returns {string} Description of game state
 */
function getGameSituation() {
    var leader = getLeadingTeam();
    var diff = getScoreDifferential();

    if (leader === "tie") {
        return "TIED";
    }

    if (diff >= 20) {
        return "BLOWOUT";
    }

    if (diff <= 3) {
        return "CLOSE GAME";
    }

    if (diff <= 10) {
        return "COMPETITIVE";
    }

    return "COMFORTABLE LEAD";
}

/**
 * Check if a comeback is possible (trailing team can win with remaining time)
 * Rough estimate: need at least 15 seconds per 3-point possession
 * @returns {boolean} True if trailing team has realistic comeback potential
 */
function isComebackPossible() {
    var leader = getLeadingTeam();
    if (leader === "tie") return true; // Game is tied

    var diff = getScoreDifferential();
    var timeLeft = gameState.timeRemaining;

    // Rough formula: Can score ~4 points per 15 seconds (one possession each team)
    // Trailing team needs diff / 4 * 15 seconds minimum
    var secondsNeeded = Math.ceil(diff / 4) * 15;

    return timeLeft >= secondsNeeded;
}

/**
 * Get projected final score (simple linear extrapolation)
 * @returns {Object} { teamA: number, teamB: number }
 */
function getProjectedScore() {
    if (gameState.timeRemaining === 0) {
        return {
            teamA: gameState.scores.teamA,
            teamB: gameState.scores.teamB
        };
    }

    // Calculate scoring rate (points per second)
    var elapsedTime = gameState.totalGameTime - gameState.timeRemaining;
    if (elapsedTime === 0) {
        // No time elapsed yet, can't project
        return {
            teamA: gameState.scores.teamA,
            teamB: gameState.scores.teamB
        };
    }

    var teamARate = gameState.scores.teamA / elapsedTime;
    var teamBRate = gameState.scores.teamB / elapsedTime;

    // Project to end of game
    var projectedA = Math.round(teamARate * gameState.totalGameTime);
    var projectedB = Math.round(teamBRate * gameState.totalGameTime);

    return {
        teamA: projectedA,
        teamB: projectedB
    };
}

/**
 * Get score display data (for UI consumption)
 * Pure data - UI decides how to render
 * @returns {Object} Complete score state for display
 */
function getScoreDisplayData() {
    return {
        scores: {
            teamA: gameState.scores.teamA,
            teamB: gameState.scores.teamB
        },
        teamNames: {
            teamA: gameState.teamNames.teamA || "TEAM A",
            teamB: gameState.teamNames.teamB || "TEAM B"
        },
        leader: getLeadingTeam(),
        differential: getScoreDifferential(),
        situation: getGameSituation(),
        isBlowout: isBlowout(),
        isClose: isCloseGame(),
        isOnePossession: isOnePossessionGame(),
        comebackPossible: isComebackPossible(),
        projected: getProjectedScore(),
        timeRemaining: gameState.timeRemaining,
        shotClock: gameState.shotClock,
        currentHalf: gameState.currentHalf,
        totalGameTime: gameState.totalGameTime
    };
}
