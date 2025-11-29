/**
 * nba_jam_adapter.js
 * 
 * Real NBA JAM game adapter for LORB.
 * Converts LORB characters to NBA JAM format and launches actual games.
 * 
 * For simulated/mock games (faster, no rendering), use nba_jam_mock.js instead.
 */
(function() {
    var ROOT = js.exec_dir;
    
    // Load game interface if not already loaded
    // The main game must be loaded first for runExternalGame to be available
    
    /**
     * Convert LORB opponent data (from get_random_opponent.js) to NBA JAM player format
     */
    function opponentToPlayer(opponent) {
        if (!opponent) return createDefaultPlayer("Unknown");
        
        var stats = opponent.stats || {};
        return {
            name: opponent.displayName || opponent.name || opponent.id || "Unknown",
            speed: stats.speed || 5,
            threePt: stats["3point"] || 5,
            dunks: stats.dunk || 5,
            power: stats.power || 5,
            defense: stats.steal || 5,
            blocks: stats.block || 5,
            skin: "brown",  // Could derive from sprite if we had that data
            jersey: opponent.jersey ? parseInt(opponent.jersey, 10) : Math.floor(Math.random() * 99),
            position: opponent.position || "",
            lorbId: opponent.id || ("opp_" + Date.now()),
            lorbData: opponent
        };
    }
    
    /**
     * Convert LORB player context to NBA JAM player format
     */
    function playerCtxToPlayer(ctx) {
        if (!ctx) return createDefaultPlayer("Player");
        
        // LORB context has stats like speed, strength, shooting, etc.
        return {
            name: ctx.name || ctx.alias || "Player",
            speed: ctx.speed || 6,
            threePt: ctx.shooting || 5,
            dunks: ctx.dunks || ctx.athletics || 5,
            power: ctx.strength || ctx.power || 5,
            defense: ctx.defense || ctx.steal || 5,
            blocks: ctx.blocks || 5,
            skin: ctx.skin || "brown",
            jersey: ctx.jersey || 1,
            position: ctx.position || "G",
            lorbId: "player",
            lorbData: ctx
        };
    }
    
    /**
     * Create a default player with given name
     */
    function createDefaultPlayer(name) {
        return {
            name: name,
            speed: 5,
            threePt: 5,
            dunks: 5,
            power: 5,
            defense: 5,
            blocks: 5,
            skin: "brown",
            jersey: Math.floor(Math.random() * 99),
            lorbId: "default_" + Date.now()
        };
    }
    
    /**
     * Generate a random street player scaled by difficulty
     */
    function generateStreetPlayer(difficulty, namePool) {
        var diff = Math.max(1, Math.min(10, difficulty || 5));
        var baseAttr = 3 + Math.floor(diff * 0.5);
        var variance = 2;
        
        function randAttr() {
            var val = baseAttr + Math.floor(Math.random() * variance * 2) - variance;
            return Math.max(1, Math.min(10, val));
        }
        
        var defaultNames = [
            "Streetball Steve", "Downtown Dave", "Crossover Chris",
            "Slam Sam", "Three-Point Terry", "Fast Break Fred"
        ];
        var names = namePool || defaultNames;
        
        return {
            name: names[Math.floor(Math.random() * names.length)],
            speed: randAttr(),
            threePt: randAttr(),
            dunks: randAttr(),
            power: randAttr(),
            defense: randAttr(),
            blocks: randAttr(),
            skin: ["brown", "lightgray"][Math.floor(Math.random() * 2)],
            jersey: Math.floor(Math.random() * 99),
            lorbId: "street_" + Date.now() + "_" + Math.floor(Math.random() * 1000)
        };
    }
    
    /**
     * Run a street battle (human player vs AI opponent)
     * 
     * @param {Object} ctx - LORB player context
     * @param {Object} opponent - Scouted opponent from get_random_opponent
     * @param {Object} opts - Options (gameTime, etc.)
     * @returns {Object} - Game results or null if API unavailable
     */
    function runStreetBattle(ctx, opponent, opts) {
        opts = opts || {};
        
        // Check if real game API is available
        if (typeof runExternalGame !== "function") {
            if (LORB && LORB.View && LORB.View.warn) {
                LORB.View.warn("Real game not available - using mock engine");
            }
            return null; // Caller should fall back to mock
        }
        
        // Convert to NBA JAM format
        var player = playerCtxToPlayer(ctx);
        player.isHuman = true;
        
        var opp1 = opponentToPlayer(opponent);
        
        // Generate teammate and second opponent
        var difficulty = opts.difficulty || 5;
        var teammate = generateStreetPlayer(Math.max(1, difficulty - 1));
        var opp2 = generateStreetPlayer(difficulty);
        
        // Build game config
        var config = {
            teamA: {
                name: (player.name + "'s Squad").substring(0, 20),
                abbr: "YOU",
                players: [player, teammate],
                colors: { fg: "WHITE", bg: "BG_RED" }
            },
            teamB: {
                name: (opp1.name + "'s Crew").substring(0, 20),
                abbr: "OPP",
                players: [opp1, opp2],
                colors: { fg: "WHITE", bg: "BG_BLUE" }
            },
            options: {
                gameTime: opts.gameTime || 60,
                mode: "play",
                humanTeam: "teamA",
                humanPlayerIndex: 0,
                showMatchupScreen: true,
                showGameOverScreen: false  // LORB will show its own results
            },
            lorbContext: {
                battleType: "street",
                opponent: opponent,
                playerCtx: ctx
            }
        };
        
        // Run the actual game
        return runExternalGame(config);
    }
    
    /**
     * Run a spectate game (AI vs AI for betting)
     * 
     * @param {Object} teamA - Team A definition { name, players[] }
     * @param {Object} teamB - Team B definition { name, players[] }
     * @param {Object} opts - Options
     * @returns {Object} - Game results or null if API unavailable
     */
    function runSpectateGame(teamA, teamB, opts) {
        opts = opts || {};
        
        if (typeof runExternalGame !== "function") {
            return null;
        }
        
        // Convert players
        var teamAPlayers = [];
        var teamBPlayers = [];
        
        if (teamA && teamA.players) {
            for (var i = 0; i < teamA.players.length && i < 2; i++) {
                teamAPlayers.push(opponentToPlayer(teamA.players[i]));
            }
        }
        while (teamAPlayers.length < 2) {
            teamAPlayers.push(generateStreetPlayer(5));
        }
        
        if (teamB && teamB.players) {
            for (var i = 0; i < teamB.players.length && i < 2; i++) {
                teamBPlayers.push(opponentToPlayer(teamB.players[i]));
            }
        }
        while (teamBPlayers.length < 2) {
            teamBPlayers.push(generateStreetPlayer(5));
        }
        
        var config = {
            teamA: {
                name: (teamA && teamA.name) || "Home Team",
                abbr: (teamA && teamA.abbr) || "HOME",
                players: teamAPlayers,
                colors: { fg: "WHITE", bg: "BG_RED" }
            },
            teamB: {
                name: (teamB && teamB.name) || "Away Team",
                abbr: (teamB && teamB.abbr) || "AWAY",
                players: teamBPlayers,
                colors: { fg: "WHITE", bg: "BG_BLUE" }
            },
            options: {
                gameTime: opts.gameTime || 90,
                mode: "spectate",
                showMatchupScreen: true,
                showGameOverScreen: false
            },
            lorbContext: opts.lorbContext || null
        };
        
        return runExternalGame(config);
    }
    
    /**
     * Check if real game engine is available
     */
    function isRealEngineAvailable() {
        return (typeof runExternalGame === "function");
    }
    
    // Export to LORB namespace
    if (typeof LORB !== "undefined") {
        LORB.Engines = LORB.Engines || {};
        LORB.Engines.NBAJamReal = {
            runStreetBattle: runStreetBattle,
            runSpectateGame: runSpectateGame,
            opponentToPlayer: opponentToPlayer,
            playerCtxToPlayer: playerCtxToPlayer,
            generateStreetPlayer: generateStreetPlayer,
            isAvailable: isRealEngineAvailable
        };
    }
    
    // Also export for module loading
    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            runStreetBattle: runStreetBattle,
            runSpectateGame: runSpectateGame,
            isAvailable: isRealEngineAvailable
        };
    }
})();
