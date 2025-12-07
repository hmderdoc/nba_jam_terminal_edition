/**
 * external-game.js
 * 
 * External Game Interface for LORB (and other external callers)
 * 
 * Provides a clean API to:
 * 1. Start a game with dynamically defined players (no .ini required)
 * 2. Configure game options (time, rules, display preferences)
 * 3. Return comprehensive results including stats
 * 
 * Game Modes:
 * - "play": Human vs AI (one human player controls a team)
 * - "spectate": Pure AI vs AI (for betting/watching)
 * 
 * MULTIPLAYER CONSIDERATION:
 * Future multiplayer support would use the same lorbId mechanism - each remote
 * player's LORB character would have their lorbId preserved through the game
 * and returned in results. The sprite assignment (teamAPlayer1, etc.) is 
 * separate from identity, so the current design supports this without changes.
 */

/**
 * Default configuration values
 */
var EXTERNAL_GAME_DEFAULTS = {
    gameTime: 120,              // 2 minutes
    shotClock: 24,
    mode: "play",               // "play" or "spectate"
    humanTeam: "teamA",         // Which team human controls
    humanPlayerIndex: 0,        // Which player on team (0 or 1)
    showMatchupScreen: true,    // Show pre-game matchup
    showGameOverScreen: true    // Show post-game screen
};

/**
 * Default player attributes (1-10 scale)
 */
var DEFAULT_PLAYER_ATTRIBUTES = {
    speed: 6,
    shooting: 6,
    threePt: 5,
    dunks: 5,
    defense: 5,
    passing: 5,
    power: 5,
    clutch: 5
};

/**
 * Validate external game configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} - { valid: boolean, errors: string[], config: normalizedConfig }
 */
function validateExternalConfig(config) {
    var errors = [];
    var normalized = {};
    
    if (!config) {
        return { valid: false, errors: ["Config is required"], config: null };
    }
    
    // Validate teamA
    if (!config.teamA) {
        errors.push("teamA is required");
    } else {
        var teamAResult = validateTeamConfig(config.teamA, "teamA");
        if (teamAResult.errors.length > 0) {
            errors = errors.concat(teamAResult.errors);
        }
        normalized.teamA = teamAResult.team;
    }
    
    // Validate teamB
    if (!config.teamB) {
        errors.push("teamB is required");
    } else {
        var teamBResult = validateTeamConfig(config.teamB, "teamB");
        if (teamBResult.errors.length > 0) {
            errors = errors.concat(teamBResult.errors);
        }
        normalized.teamB = teamBResult.team;
    }
    
    // Normalize options with defaults
    var opts = config.options || {};
    normalized.options = {
        gameTime: (typeof opts.gameTime === "number" && opts.gameTime > 0) ? opts.gameTime : EXTERNAL_GAME_DEFAULTS.gameTime,
        shotClock: (typeof opts.shotClock === "number" && opts.shotClock > 0) ? opts.shotClock : EXTERNAL_GAME_DEFAULTS.shotClock,
        mode: (opts.mode === "spectate") ? "spectate" : "play",
        humanTeam: (opts.humanTeam === "teamB") ? "teamB" : "teamA",
        humanPlayerIndex: (opts.humanPlayerIndex === 1) ? 1 : 0,
        showMatchupScreen: (typeof opts.showMatchupScreen === "boolean") ? opts.showMatchupScreen : EXTERNAL_GAME_DEFAULTS.showMatchupScreen,
        showGameOverScreen: (typeof opts.showGameOverScreen === "boolean") ? opts.showGameOverScreen : EXTERNAL_GAME_DEFAULTS.showGameOverScreen,
        recordEvents: (typeof opts.recordEvents === "boolean") ? opts.recordEvents : EXTERNAL_GAME_DEFAULTS.recordEvents
    };
    
    // Pass through LORB context if provided
    if (config.lorbContext) {
        normalized.lorbContext = config.lorbContext;
    }
    
    return {
        valid: errors.length === 0,
        errors: errors,
        config: normalized
    };
}

/**
 * Validate team configuration
 * @param {Object} teamDef - Team definition
 * @param {string} teamLabel - "teamA" or "teamB" for error messages
 * @returns {Object} - { errors: string[], team: normalizedTeam }
 */
function validateTeamConfig(teamDef, teamLabel) {
    var errors = [];
    var team = {
        name: teamDef.name || "Street Team",
        abbr: teamDef.abbr || (teamDef.name ? teamDef.name.substring(0, 4).toUpperCase() : "TEAM"),
        players: [],
        colors: teamDef.colors || null
    };
    
    if (!teamDef.players || !Array.isArray(teamDef.players)) {
        errors.push(teamLabel + ".players must be an array");
        return { errors: errors, team: team };
    }
    
    if (teamDef.players.length < 1) {
        errors.push(teamLabel + " must have at least 1 player");
    }
    
    // Normalize each player
    for (var i = 0; i < Math.min(teamDef.players.length, 2); i++) {
        var p = teamDef.players[i];
        var player = normalizePlayerConfig(p, teamLabel + ".players[" + i + "]");
        team.players.push(player);
    }
    
    // If only one player provided, duplicate for 2v2
    if (team.players.length === 1) {
        var cloned = {};
        for (var key in team.players[0]) {
            if (team.players[0].hasOwnProperty(key)) {
                cloned[key] = team.players[0][key];
            }
        }
        cloned.name = cloned.name + " II";
        cloned.lorbId = cloned.lorbId ? cloned.lorbId + "_clone" : null;
        team.players.push(cloned);
    }
    
    return { errors: errors, team: team };
}

/**
 * Normalize player configuration with defaults
 * @param {Object} playerDef - Player definition from LORB
 * @param {string} label - For error messages
 * @returns {Object} - Normalized player config
 */
function normalizePlayerConfig(playerDef, label) {
    var p = playerDef || {};
    
    // Build attributes array in expected order: [speed, 3pt, dunk, power, steal, block]
    // Map from friendly names to array indices
    var attrs = [
        clampAttribute(p.speed, DEFAULT_PLAYER_ATTRIBUTES.speed),
        clampAttribute(p.threePt || p.shooting, DEFAULT_PLAYER_ATTRIBUTES.threePt),  // 3pt defaults to shooting if not specified
        clampAttribute(p.dunks, DEFAULT_PLAYER_ATTRIBUTES.dunks),
        clampAttribute(p.power, DEFAULT_PLAYER_ATTRIBUTES.power),
        clampAttribute(p.defense || p.steal, DEFAULT_PLAYER_ATTRIBUTES.defense),     // steal/defense are similar
        clampAttribute(p.blocks || p.defense, DEFAULT_PLAYER_ATTRIBUTES.defense)     // blocks default to defense
    ];
    
    return {
        name: p.name || "Street Baller",
        jersey: (typeof p.jersey === "number") ? p.jersey : Math.floor(Math.random() * 99),
        jerseyString: p.jerseyString || null,
        skin: p.skin || "brown",
        shortNick: p.shortNick || null,
        attributes: attrs,
        position: p.position || "",
        customSprite: p.customSprite || null,
        eyeColor: p.eyeColor || null,
        eyebrowChar: p.eyebrowChar || null,
        eyebrowColor: p.eyebrowColor || null,
        isHuman: !!p.isHuman,
        // LORB tracking - passed through to results
        lorbId: p.lorbId || null,
        lorbData: p.lorbData || null
    };
}

/**
 * Clamp attribute to valid range (1-10)
 */
function clampAttribute(value, defaultVal) {
    if (typeof value !== "number") return defaultVal;
    if (value < 1) return 1;
    if (value > 10) return 10;
    return Math.round(value);
}

/**
 * Collect all game results after game ends
 * @param {Object} systems - Game systems
 * @param {Object} config - Original game config (for lorbContext passthrough)
 * @returns {Object} - Complete game results
 */
function collectExternalGameResults(systems, config) {
    var stateManager = systems.stateManager;
    var score = stateManager.get("score") || { teamA: 0, teamB: 0 };
    var gameRunning = stateManager.get("gameRunning");
    var timeRemaining = stateManager.get("timeRemaining") || 0;
    
    // Determine winner
    var winner = "tie";
    if (score.teamA > score.teamB) {
        winner = "teamA";
    } else if (score.teamB > score.teamA) {
        winner = "teamB";
    }
    
    // Determine exit reason
    var exitReason = "completed";
    if (gameRunning === false && timeRemaining > 0) {
        exitReason = "quit";
    }
    
    // Collect player stats
    var playerStats = {};
    var allPlayers = getAllPlayers();
    
    for (var i = 0; i < allPlayers.length; i++) {
        var sprite = allPlayers[i];
        if (!sprite || !sprite.playerData) continue;
        
        var pd = sprite.playerData;
        var stats = pd.stats || {};
        
        // Use lorbId if available, otherwise use position key
        var key = null;
        if (pd.lorbId) {
            key = pd.lorbId;
        } else {
            // Fallback to position-based key
            if (sprite === teamAPlayer1) key = "teamA_player1";
            else if (sprite === teamAPlayer2) key = "teamA_player2";
            else if (sprite === teamBPlayer1) key = "teamB_player1";
            else if (sprite === teamBPlayer2) key = "teamB_player2";
        }
        
        if (key) {
            playerStats[key] = {
                name: pd.name,
                team: pd.team,
                points: stats.points || 0,
                rebounds: stats.rebounds || 0,
                assists: stats.assists || 0,
                steals: stats.steals || 0,
                blocks: stats.blocks || 0,
                turnovers: stats.turnovers || 0,
                fieldGoals: {
                    made: stats.fgm || 0,
                    attempted: stats.fga || 0
                },
                threePointers: {
                    made: stats.tpm || 0,
                    attempted: stats.tpa || 0
                },
                dunks: stats.dunks || 0,
                wasOnFire: !!pd.wasOnFire,
                maxFireStreak: pd.maxFireStreak || 0,
                // Pass through LORB data if present
                lorbData: pd.lorbData || null
            };
        }
    }
    
    return {
        winner: winner,
        score: {
            teamA: score.teamA,
            teamB: score.teamB
        },
        completed: (exitReason === "completed"),
        exitReason: exitReason,
        playerStats: playerStats,
        lorbContext: config.lorbContext || null
    };
}

/**
 * Run an external game with dynamic player definitions
 * 
 * @param {Object} config - Game configuration
 * @param {Object} config.teamA - Team A definition
 * @param {string} config.teamA.name - Display name
 * @param {string} config.teamA.abbr - 4-char abbreviation
 * @param {Array} config.teamA.players - Array of player definitions
 * @param {Object} config.teamA.colors - Optional team colors { fg, bg, fg_accent, bg_alt }
 * @param {Object} config.teamB - Team B definition (same structure)
 * @param {Object} config.options - Game options
 * @param {number} config.options.gameTime - Game duration in seconds (default: 120)
 * @param {number} config.options.shotClock - Shot clock duration (default: 24)
 * @param {string} config.options.mode - "play" (human vs AI) or "spectate" (AI vs AI)
 * @param {string} config.options.humanTeam - "teamA" or "teamB" (which team human controls)
 * @param {number} config.options.humanPlayerIndex - 0 or 1 (which player on team)
 * @param {boolean} config.options.showMatchupScreen - Show pre-game screen
 * @param {boolean} config.options.showGameOverScreen - Show post-game screen
 * @param {Object} config.lorbContext - Pass-through data returned in results
 * 
 * @returns {Object} Game results
 */
function runExternalGame(config) {
    // Validate configuration
    var validation = validateExternalConfig(config);
    if (!validation.valid) {
        return {
            winner: null,
            score: { teamA: 0, teamB: 0 },
            completed: false,
            exitReason: "error",
            error: "Invalid configuration: " + validation.errors.join(", "),
            playerStats: {},
            lorbContext: config ? config.lorbContext : null
        };
    }
    
    var normalizedConfig = validation.config;
    var options = normalizedConfig.options;
    
    // Apply difficulty scaling if lorbContext specifies a difficulty tier
    var difficultyApplied = false;
    if (normalizedConfig.lorbContext && normalizedConfig.lorbContext.difficulty) {
        if (typeof DifficultyScaling !== "undefined" && DifficultyScaling.applyDifficultyScaling) {
            DifficultyScaling.applyDifficultyScaling(normalizedConfig.lorbContext.difficulty);
            difficultyApplied = true;
        }
    }
    
    try {
        // Initialize systems (similar to main() but isolated)
        var systems = initializeSystems({
            gameState: gameState,
            animationSystem: animationSystem,
            getPlayers: function() {
                return {
                    teamAPlayer1: teamAPlayer1,
                    teamAPlayer2: teamAPlayer2,
                    teamBPlayer1: teamBPlayer1,
                    teamBPlayer2: teamBPlayer2
                };
            },
            helpers: {
                getPlayerTeamName: getPlayerTeamName,
                getAllPlayers: getAllPlayers,
                recordTurnover: recordTurnover,
                recordStatDelta: recordStatDelta,
                triggerPossessionBeep: triggerPossessionBeep,
                resetBackcourtState: resetBackcourtState,
                setPotentialAssist: setPotentialAssist,
                clearPotentialAssist: clearPotentialAssist,
                enableScoreFlashRegainCheck: enableScoreFlashRegainCheck,
                primeInboundOffense: primeInboundOffense,
                assignDefensiveMatchups: assignDefensiveMatchups,
                announceEvent: announceEvent
            },
            constants: {
                COURT_WIDTH: COURT_WIDTH,
                COURT_HEIGHT: COURT_HEIGHT,
                PLAYER_BOUNDARIES: typeof PLAYER_BOUNDARIES !== "undefined" ? PLAYER_BOUNDARIES : null,
                MAX_TURBO: typeof MAX_TURBO !== "undefined" ? MAX_TURBO : 100,
                RUBBER_BANDING_CONFIG: typeof RUBBER_BANDING_CONFIG !== "undefined" ? RUBBER_BANDING_CONFIG : {},
                RUBBER_BANDING_PROFILES: typeof RUBBER_BANDING_PROFILES !== "undefined" ? RUBBER_BANDING_PROFILES : {},
                RUBBER_BANDING_DEFAULT_PROFILE: typeof RUBBER_BANDING_DEFAULT_PROFILE !== "undefined" ? RUBBER_BANDING_DEFAULT_PROFILE : null,
                RUBBER_BANDING_PROBABILITY_CAPS: typeof RUBBER_BANDING_PROBABILITY_CAPS !== "undefined" ? RUBBER_BANDING_PROBABILITY_CAPS : {}
            }
        });
        
        var stateManager = systems.stateManager;
        
        // Determine if all CPU mode
        var allCPUMode = (options.mode === "spectate");
        
        // Reset game state
        resetGameState({ allCPUMode: allCPUMode }, systems);
        
        // Store external game config for reference
        stateManager.set("externalGameConfig", normalizedConfig, "external_game_init");
        
        // Initialize sprites from dynamic definitions
        initSpritesFromDynamic(normalizedConfig.teamA, normalizedConfig.teamB, options, systems);
        
        // Apply difficulty-based turbo capacity to AI players
        if (difficultyApplied && typeof DifficultyScaling !== "undefined" && 
            DifficultyScaling.applyTurboCapacityToAI) {
            // Get AI team players (opponent team in "play" mode, both teams in "spectate")
            var aiPlayers = [];
            var humanTeam = options.humanTeam || "teamA";
            
            if (options.mode === "spectate") {
                // All players are AI in spectate mode
                aiPlayers = [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
            } else {
                // Only opponent team is AI in play mode
                if (humanTeam === "teamA") {
                    aiPlayers = [teamBPlayer1, teamBPlayer2];
                } else {
                    aiPlayers = [teamAPlayer1, teamAPlayer2];
                }
            }
            
            DifficultyScaling.applyTurboCapacityToAI(aiPlayers);
        }
        
        // Set game time from options
        stateManager.set("timeRemaining", options.gameTime, "external_game_init");
        stateManager.set("totalGameTime", options.gameTime, "external_game_init");
        stateManager.set("currentHalf", 1, "external_game_init");
        
        // Initialize frames
        initFrames(systems);
        
        // Show matchup screen if enabled
        if (options.showMatchupScreen) {
            showMatchupScreen(allCPUMode, systems, null, null);
        }
        
        // Run the game loop
        gameLoop(systems);
        
        // Collect results
        var results = collectExternalGameResults(systems, normalizedConfig);
        
        // Show game over screen if enabled
        if (options.showGameOverScreen) {
            showGameOver(allCPUMode, systems, null, null, null);
        }
        
        // Cleanup
        cleanupSprites();
        
        // Reset difficulty scaling if it was applied
        if (difficultyApplied && typeof DifficultyScaling !== "undefined" && 
            DifficultyScaling.resetDifficultyScaling) {
            DifficultyScaling.resetDifficultyScaling();
        }
        
        return results;
        
    } catch (e) {
        // Reset difficulty scaling on error
        if (difficultyApplied && typeof DifficultyScaling !== "undefined" && 
            DifficultyScaling.resetDifficultyScaling) {
            DifficultyScaling.resetDifficultyScaling();
        }
        
        // Log error
        if (typeof logError === "function") {
            logError(e, "runExternalGame");
        }
        
        // Return error result
        return {
            winner: null,
            score: { teamA: 0, teamB: 0 },
            completed: false,
            exitReason: "error",
            error: e.toString(),
            playerStats: {},
            lorbContext: config ? config.lorbContext : null
        };
    }
}

// Export for module loading
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        runExternalGame: runExternalGame,
        validateExternalConfig: validateExternalConfig,
        collectExternalGameResults: collectExternalGameResults,
        EXTERNAL_GAME_DEFAULTS: EXTERNAL_GAME_DEFAULTS
    };
}
