/**
 * game-interface.js
 * 
 * LORB <-> NBA JAM Interface
 * 
 * This module provides the bridge between LORB RPG logic and the NBA JAM
 * arcade game engine. LORB calls these functions to start games with
 * dynamically generated players and receives results back.
 * 
 * Usage from LORB:
 * 
 *   var gameInterface = load(js.exec_dir + "lib/lorb_shared/game-interface.js");
 *   
 *   var results = gameInterface.playStreetGame({
 *       lorbPlayer: myCharacter,
 *       opponent: scoutedOpponent,
 *       gameTime: 60
 *   });
 *   
 *   if (results.winner === "teamA") {
 *       // Player won! Apply rewards
 *   }
 */

/**
 * Convert a LORB character to NBA JAM player format
 * @param {Object} lorbChar - LORB character definition
 * @returns {Object} - NBA JAM player definition
 */
function lorbCharToPlayer(lorbChar) {
    if (!lorbChar) {
        return {
            name: "Unknown",
            speed: 5,
            threePt: 5,
            dunks: 5,
            power: 5,
            defense: 5,
            blocks: 5,
            skin: "brown",
            jersey: 0,
            lorbId: null
        };
    }
    
    // Map LORB stats to NBA JAM attributes
    // LORB might have different stat names - adapt as needed
    return {
        name: lorbChar.name || "Street Baller",
        speed: lorbChar.speed || lorbChar.agility || 6,
        threePt: lorbChar.shooting || lorbChar.threePt || 5,
        dunks: lorbChar.dunks || lorbChar.athletics || 5,
        power: lorbChar.power || lorbChar.strength || 5,
        defense: lorbChar.defense || lorbChar.steal || 5,
        blocks: lorbChar.blocks || lorbChar.defense || 5,
        skin: lorbChar.skin || "brown",
        jersey: lorbChar.jersey || Math.floor(Math.random() * 99),
        jerseyString: lorbChar.jerseyString || null,
        shortNick: lorbChar.nickname || null,
        position: lorbChar.position || "",
        customSprite: lorbChar.customSprite || null,
        lorbId: lorbChar.id || lorbChar.lorbId || null,
        lorbData: lorbChar  // Pass through full character for results
    };
}

/**
 * Generate a random street opponent
 * @param {number} difficulty - 1-10 difficulty scale
 * @returns {Object} - Generated opponent player definition
 */
function generateStreetOpponent(difficulty) {
    var diff = Math.max(1, Math.min(10, difficulty || 5));
    
    // Base stats scale with difficulty
    var baseAttr = 3 + Math.floor(diff * 0.5);
    var variance = 2;
    
    function randAttr() {
        var val = baseAttr + Math.floor(Math.random() * variance * 2) - variance;
        return Math.max(1, Math.min(10, val));
    }
    
    var names = [
        "Streetball Steve", "Downtown Dave", "Crossover Chris",
        "Slam Sam", "Three-Point Terry", "Brick Barry",
        "Fast Break Fred", "Alley-Oop Al", "Dunk Master D",
        "The Professor", "Hot Sauce", "Skip To My Lou"
    ];
    
    var skins = ["brown", "lightgray", "magenta"];
    
    return {
        name: names[Math.floor(Math.random() * names.length)],
        speed: randAttr(),
        threePt: randAttr(),
        dunks: randAttr(),
        power: randAttr(),
        defense: randAttr(),
        blocks: randAttr(),
        skin: skins[Math.floor(Math.random() * skins.length)],
        jersey: Math.floor(Math.random() * 99),
        lorbId: "street_opponent_" + Date.now()
    };
}

/**
 * Play a street game (human vs AI)
 * 
 * @param {Object} options
 * @param {Object} options.lorbPlayer - LORB player character
 * @param {Object} options.teammate - Optional LORB teammate (or auto-generate)
 * @param {Object} options.opponent1 - First opponent (or auto-generate)
 * @param {Object} options.opponent2 - Second opponent (or auto-generate)
 * @param {number} options.difficulty - 1-10 difficulty for auto-generated opponents
 * @param {number} options.gameTime - Game duration in seconds (default 60)
 * @param {boolean} options.showMatchup - Show matchup screen (default true)
 * @param {boolean} options.showGameOver - Show game over screen (default true)
 * @param {Object} options.lorbContext - Context to pass through to results
 * @returns {Object} - Game results
 */
function playStreetGame(options) {
    var opts = options || {};
    var difficulty = opts.difficulty || 5;
    
    // Build player team
    var player1 = lorbCharToPlayer(opts.lorbPlayer);
    player1.isHuman = true;
    
    var player2 = opts.teammate 
        ? lorbCharToPlayer(opts.teammate)
        : generateStreetOpponent(Math.max(1, difficulty - 2));  // Teammate slightly weaker
    
    // Build opponent team
    var opponent1 = opts.opponent1 
        ? lorbCharToPlayer(opts.opponent1)
        : generateStreetOpponent(difficulty);
    
    var opponent2 = opts.opponent2
        ? lorbCharToPlayer(opts.opponent2)
        : generateStreetOpponent(difficulty);
    
    // Build game config
    var config = {
        teamA: {
            name: player1.name + "'s Squad",
            abbr: "PLYR",
            players: [player1, player2],
            colors: {
                fg: "WHITE",
                bg: "BG_RED"
            }
        },
        teamB: {
            name: "Street Challengers",
            abbr: "OPPS",
            players: [opponent1, opponent2],
            colors: {
                fg: "WHITE", 
                bg: "BG_BLUE"
            }
        },
        options: {
            gameTime: opts.gameTime || 60,
            mode: "play",
            humanTeam: "teamA",
            humanPlayerIndex: 0,
            showMatchupScreen: (opts.showMatchup !== false),
            showGameOverScreen: (opts.showGameOver !== false)
        },
        lorbContext: opts.lorbContext || null
    };
    
    // Run the game
    return runExternalGame(config);
}

/**
 * Watch/bet on an AI vs AI game (spectate mode)
 * 
 * @param {Object} options
 * @param {Array} options.teamAPlayers - Array of 2 player definitions for team A
 * @param {Array} options.teamBPlayers - Array of 2 player definitions for team B
 * @param {string} options.teamAName - Team A display name
 * @param {string} options.teamBName - Team B display name
 * @param {number} options.gameTime - Game duration in seconds (default 90)
 * @param {boolean} options.showMatchup - Show matchup screen (default true)
 * @param {boolean} options.showGameOver - Show game over screen (default true)
 * @param {Object} options.lorbContext - Context to pass through (e.g., betting info)
 * @returns {Object} - Game results
 */
function watchGame(options) {
    var opts = options || {};
    
    // Build team A
    var teamAPlayers = [];
    if (opts.teamAPlayers && opts.teamAPlayers.length > 0) {
        for (var i = 0; i < Math.min(2, opts.teamAPlayers.length); i++) {
            teamAPlayers.push(lorbCharToPlayer(opts.teamAPlayers[i]));
        }
    }
    while (teamAPlayers.length < 2) {
        teamAPlayers.push(generateStreetOpponent(5));
    }
    
    // Build team B
    var teamBPlayers = [];
    if (opts.teamBPlayers && opts.teamBPlayers.length > 0) {
        for (var i = 0; i < Math.min(2, opts.teamBPlayers.length); i++) {
            teamBPlayers.push(lorbCharToPlayer(opts.teamBPlayers[i]));
        }
    }
    while (teamBPlayers.length < 2) {
        teamBPlayers.push(generateStreetOpponent(5));
    }
    
    var config = {
        teamA: {
            name: opts.teamAName || "Home Team",
            abbr: opts.teamAAbbr || "HOME",
            players: teamAPlayers
        },
        teamB: {
            name: opts.teamBName || "Away Team", 
            abbr: opts.teamBAbbr || "AWAY",
            players: teamBPlayers
        },
        options: {
            gameTime: opts.gameTime || 90,
            mode: "spectate",
            showMatchupScreen: (opts.showMatchup !== false),
            showGameOverScreen: (opts.showGameOver !== false)
        },
        lorbContext: opts.lorbContext || null
    };
    
    return runExternalGame(config);
}

/**
 * Quick helper to check if external game API is available
 */
function isAvailable() {
    return (typeof runExternalGame === "function");
}

// Export interface
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        playStreetGame: playStreetGame,
        watchGame: watchGame,
        lorbCharToPlayer: lorbCharToPlayer,
        generateStreetOpponent: generateStreetOpponent,
        isAvailable: isAvailable
    };
}
