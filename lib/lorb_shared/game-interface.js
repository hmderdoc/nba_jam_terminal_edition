/**
 * game-interface.js
 * 
 * Thin wrapper exposing runExternalGame to LORB.
 * All LORB-specific character conversion and game setup logic belongs in
 * lib/lorb/engines/nba_jam_adapter.js, not here.
 * 
 * This file exists to decouple LORB from direct NBA JAM internal dependencies.
 */

/**
 * Check if the external game API is available
 */
function isAvailable() {
    return (typeof runExternalGame === "function");
}

/**
 * Run an external game with the provided config.
 * See external-game.js for full config documentation.
 * 
 * @param {Object} config - Full game configuration
 * @returns {Object} - Game results
 */
function startGame(config) {
    if (!isAvailable()) {
        return {
            winner: null,
            score: { teamA: 0, teamB: 0 },
            completed: false,
            exitReason: "error",
            error: "External game API not available",
            playerStats: {}
        };
    }
    return runExternalGame(config);
}

// Export interface
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        startGame: startGame,
        isAvailable: isAvailable
    };
}
