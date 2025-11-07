/**
 * NBA JAM - Demo and Results Display Utilities
 * 
 * Functions for collecting game statistics and displaying results
 */

/**
 * Collect comprehensive game results for betting resolution and stats display
 * 
 * @param {string} redTeamKey - Team key for teamA (red/away team)
 * @param {string} blueTeamKey - Team key for teamB (blue/home team)
 * @returns {Object} Game results with scores, winner, and stat leaders
 */
function collectGameResults(redTeamKey, blueTeamKey) {
    var teamAScore = gameState.score.teamA || 0;
    var teamBScore = gameState.score.teamB || 0;
    var winner = teamAScore > teamBScore ? "teamA" : "teamB";

    // Find stat leaders
    var allPlayers = [];
    if (teamAPlayer1 && teamAPlayer1.playerData) allPlayers.push(teamAPlayer1.playerData);
    if (teamAPlayer2 && teamAPlayer2.playerData) allPlayers.push(teamAPlayer2.playerData);
    if (teamBPlayer1 && teamBPlayer1.playerData) allPlayers.push(teamBPlayer1.playerData);
    if (teamBPlayer2 && teamBPlayer2.playerData) allPlayers.push(teamBPlayer2.playerData);

    var leaders = {
        points: null,
        assists: null,
        rebounds: null,
        steals: null,
        blocks: null
    };

    // Find leader for each stat
    var stats = ['points', 'assists', 'rebounds', 'steals', 'blocks'];
    for (var s = 0; s < stats.length; s++) {
        var stat = stats[s];
        var maxValue = -1;
        var leader = null;

        for (var p = 0; p < allPlayers.length; p++) {
            var player = allPlayers[p];
            var value = (player.stats && typeof player.stats[stat] === "number") ? player.stats[stat] : 0;
            if (value > maxValue) {
                maxValue = value;
                leader = player.name;
            }
        }

        leaders[stat] = leader;
    }

    return {
        teamATeam: gameState.teamNames.teamA || redTeamKey,
        teamBTeam: gameState.teamNames.teamB || blueTeamKey,
        teamAScore: teamAScore,
        teamBScore: teamBScore,
        winner: winner,
        leaders: leaders
    };
}
