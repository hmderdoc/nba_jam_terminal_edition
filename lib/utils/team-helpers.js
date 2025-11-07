/**
 * NBA JAM - Team Helper Functions
 * 
 * Utility functions for querying team sprites
 */

/**
 * Get all sprites for a team
 * @param {string} teamName - "teamA" or "teamB"
 * @returns {Array} Array of team player sprites
 */
function getTeamSprites(teamName) {
    return teamName === "teamA"
        ? [teamAPlayer1, teamAPlayer2]
        : [teamBPlayer1, teamBPlayer2];
}

/**
 * Get all sprites for the opposing team
 * @param {string} teamName - "teamA" or "teamB"
 * @returns {Array} Array of opposing team player sprites
 */
function getOpposingTeamSprites(teamName) {
    return teamName === "teamA"
        ? [teamBPlayer1, teamBPlayer2]
        : [teamAPlayer1, teamAPlayer2];
}
