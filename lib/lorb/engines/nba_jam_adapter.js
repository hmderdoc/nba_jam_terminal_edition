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
     * Applies sneaker mods, drink buffs, and city boosts to stats
     */
    function playerCtxToPlayer(ctx) {
        if (!ctx) return createDefaultPlayer("Player");
        
        // Start with base stats, then apply equipment/drink boosts, then city boosts
        var baseStats = ctx.stats || {};
        var stats;
        
        // Apply sneaker mods and drink buffs via Shop.getEffectiveStats
        if (typeof LORB !== "undefined" && LORB.Locations && LORB.Locations.Shop && LORB.Locations.Shop.getEffectiveStats) {
            stats = LORB.Locations.Shop.getEffectiveStats(ctx);
        } else {
            stats = {
                speed: baseStats.speed || 6,
                threePt: baseStats.threePt || baseStats.shooting || 5,
                dunk: baseStats.dunk || ctx.dunks || ctx.athletics || 5,
                power: baseStats.power || ctx.strength || 5,
                steal: baseStats.steal || ctx.defense || 5,
                block: baseStats.block || ctx.blocks || 5
            };
        }
        
        // Apply city buffs on top of equipment/drink boosts
        if (typeof LORB !== "undefined" && LORB.Cities && LORB.Cities.getToday && LORB.Cities.applyBuffsToStats) {
            var city = LORB.Cities.getToday();
            if (city) {
                stats = LORB.Cities.applyBuffsToStats(stats, city);
            }
        }
        
        var appearance = ctx.appearance || {};
        
        // LORB context has stats like speed, threePt, power, steal, block, dunk
        return {
            name: ctx.name || ctx.alias || "Player",
            speed: stats.speed || 6,
            threePt: stats.threePt || stats.shooting || 5,
            dunks: stats.dunk || ctx.dunks || ctx.athletics || 5,
            power: stats.power || ctx.strength || 5,
            defense: stats.steal || ctx.defense || 5,
            blocks: stats.block || ctx.blocks || 5,
            // Appearance fields
            skin: appearance.skin || ctx.skin || "brown",
            jersey: parseInt(appearance.jerseyNumber, 10) || ctx.jersey || 1,
            jerseyString: appearance.jerseyNumber || String(ctx.jersey || "1"),
            jerseyColor: appearance.jerseyColor || null,
            eyeColor: appearance.eyeColor || null,
            shortNick: ctx.nickname || null,
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
        
        // Determine team colors based on player's jersey color choice
        var playerTeamColors = { fg: "WHITE", bg: "BG_RED", fg_accent: "WHITE", bg_alt: "BG_RED" };
        if (player.jerseyColor) {
            playerTeamColors.bg = "BG_" + player.jerseyColor.toUpperCase();
            playerTeamColors.bg_alt = playerTeamColors.bg;
        }
        // Also check ctx.appearance directly for jerseyLettering
        if (ctx && ctx.appearance && ctx.appearance.jerseyLettering) {
            playerTeamColors.fg_accent = ctx.appearance.jerseyLettering.toUpperCase();
        }
        
        // Build game config
        var config = {
            teamA: {
                name: (player.name + "'s Squad").substring(0, 20),
                abbr: "YOU",
                players: [player, teammate],
                colors: playerTeamColors
            },
            teamB: {
                name: (opp1.name + "'s Crew").substring(0, 20),
                abbr: "OPP",
                players: [opp1, opp2],
                colors: { fg: "WHITE", bg: "BG_BLUE", fg_accent: "WHITE" }
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
                playerCtx: ctx,
                hydratedCrew: (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getCrewWithContacts) ? LORB.Util.Contacts.getCrewWithContacts(ctx) : []
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
