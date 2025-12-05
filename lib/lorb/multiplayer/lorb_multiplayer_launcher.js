/**
 * lorb_multiplayer_launcher.js - Launch multiplayer match from LORB challenge
 * 
 * This bridges the LORB challenge lobby to the multiplayer game engine.
 * When both players are ready in the challenge lobby, this module:
 * 1. Converts LORB characters to sprite-compatible player definitions
 * 2. Creates a multiplayer session
 * 3. Initializes coordinator/client roles
 * 4. Runs the multiplayer game loop with LORB rosters
 * 
 * Must be loaded AFTER nba_jam.js multiplayer components are initialized.
 */
(function () {
    if (!this.LORB) return;
    if (!this.LORB.Multiplayer) this.LORB.Multiplayer = {};
    
    function log(msg) {
        if (typeof debugLog === "function") debugLog("[LORB:MPLauncher] " + msg);
    }
    
    function logError(msg) {
        if (typeof debugLog === "function") debugLog("[LORB:MPLauncher][ERROR] " + msg);
        if (typeof LOG_ERR !== "undefined") {
            log(LOG_ERR, msg);
        }
    }
    
    /**
     * Check if multiplayer infrastructure is available
     */
    function isMultiplayerAvailable() {
        // Check for required globals from nba_jam.js
        if (typeof GameCoordinator === "undefined") return false;
        if (typeof PlayerClient === "undefined") return false;
        if (typeof initSpritesFromDynamic === "undefined") return false;
        if (typeof runMultiplayerGameLoop === "undefined") return false;
        if (typeof initializeSystems === "undefined") return false;
        return true;
    }
    
    /**
     * Get server config for JSON connection
     */
    function getServerConfig() {
        // Try to get from mpConfig if available
        if (typeof mpConfig !== "undefined" && mpConfig) {
            return {
                addr: mpConfig.addr || "localhost",
                port: mpConfig.port || 10088
            };
        }
        // Fall back to LORB persist config
        if (LORB.Persist && LORB.Persist.getServerConfig) {
            return LORB.Persist.getServerConfig();
        }
        return { addr: "localhost", port: 10088 };
    }
    
    /**
     * Create a JSON client connection
     */
    function createClient(serverConfig) {
        if (typeof JSONClient === "undefined") {
            load("json-client.js");
        }
        var client = new JSONClient(serverConfig.addr || "localhost", serverConfig.port || 10088);
        if (!client.connected) {
            throw new Error("Failed to connect to " + serverConfig.addr + ":" + serverConfig.port);
        }
        return client;
    }
    
    /**
     * Initialize systems for game
     */
    function createSystems() {
        if (typeof initializeSystems !== "function") {
            throw new Error("initializeSystems not available");
        }
        
        // Create a fresh game state
        var gs = {};
        if (typeof gameState !== "undefined") {
            gs = gameState;
        }
        
        return initializeSystems({
            gameState: gs,
            animationSystem: (typeof animationSystem !== "undefined") ? animationSystem : null,
            getPlayers: function () {
                return {
                    teamAPlayer1: (typeof teamAPlayer1 !== "undefined") ? teamAPlayer1 : null,
                    teamAPlayer2: (typeof teamAPlayer2 !== "undefined") ? teamAPlayer2 : null,
                    teamBPlayer1: (typeof teamBPlayer1 !== "undefined") ? teamBPlayer1 : null,
                    teamBPlayer2: (typeof teamBPlayer2 !== "undefined") ? teamBPlayer2 : null
                };
            },
            helpers: {
                getPlayerTeamName: (typeof getPlayerTeamName !== "undefined") ? getPlayerTeamName : function() { return "unknown"; },
                getAllPlayers: (typeof getAllPlayers !== "undefined") ? getAllPlayers : function() { return []; },
                recordTurnover: (typeof recordTurnover !== "undefined") ? recordTurnover : function() {},
                recordStatDelta: (typeof recordStatDelta !== "undefined") ? recordStatDelta : function() {},
                triggerPossessionBeep: (typeof triggerPossessionBeep !== "undefined") ? triggerPossessionBeep : function() {},
                resetBackcourtState: (typeof resetBackcourtState !== "undefined") ? resetBackcourtState : function() {},
                setPotentialAssist: (typeof setPotentialAssist !== "undefined") ? setPotentialAssist : function() {},
                clearPotentialAssist: (typeof clearPotentialAssist !== "undefined") ? clearPotentialAssist : function() {},
                enableScoreFlashRegainCheck: (typeof enableScoreFlashRegainCheck !== "undefined") ? enableScoreFlashRegainCheck : function() {},
                primeInboundOffense: (typeof primeInboundOffense !== "undefined") ? primeInboundOffense : function() {},
                assignDefensiveMatchups: (typeof assignDefensiveMatchups !== "undefined") ? assignDefensiveMatchups : function() {},
                announceEvent: (typeof announceEvent !== "undefined") ? announceEvent : function() {}
            },
            constants: {
                COURT_WIDTH: (typeof COURT_WIDTH !== "undefined") ? COURT_WIDTH : 80,
                COURT_HEIGHT: (typeof COURT_HEIGHT !== "undefined") ? COURT_HEIGHT : 24
            }
        });
    }
    
    /**
     * Write session to JSON service game namespace
     */
    function writeSessionToServer(client, challengeId, session) {
        var basePath = "game." + challengeId;
        client.write("nba_jam", basePath + ".meta", session, 2);
        client.write("nba_jam", basePath + ".state", {
            t: Date.now(),
            f: 0,
            p: [],
            b: { x: 0, y: 0, c: null, r: false, rx: 0, ry: 0 },
            g: {}
        }, 2);
        client.write("nba_jam", basePath + ".events", [], 2);
    }
    
    /**
     * Build sprite map from players
     */
    function buildSpriteMap(assignments, myGid) {
        var spriteMap = {};
        
        if (typeof teamAPlayer1 !== "undefined" && teamAPlayer1) {
            var id1 = assignments.teamAPlayer1 || "AI_RED_1";
            spriteMap[id1] = teamAPlayer1;
            teamAPlayer1.controllerType = (id1 === myGid) ? "local" : "remote";
            teamAPlayer1.isHuman = !!assignments.teamAPlayer1;
            teamAPlayer1.controlledBy = assignments.teamAPlayer1 || null;
        }
        if (typeof teamAPlayer2 !== "undefined" && teamAPlayer2) {
            spriteMap[assignments.teamAPlayer2 || "AI_RED_2"] = teamAPlayer2;
            teamAPlayer2.controllerType = "ai";
            teamAPlayer2.isHuman = false;
            teamAPlayer2.controlledBy = null;
        }
        if (typeof teamBPlayer1 !== "undefined" && teamBPlayer1) {
            var id3 = assignments.teamBPlayer1 || "AI_BLUE_1";
            spriteMap[id3] = teamBPlayer1;
            teamBPlayer1.controllerType = (id3 === myGid) ? "local" : "remote";
            teamBPlayer1.isHuman = !!assignments.teamBPlayer1;
            teamBPlayer1.controlledBy = assignments.teamBPlayer1 || null;
        }
        if (typeof teamBPlayer2 !== "undefined" && teamBPlayer2) {
            spriteMap[assignments.teamBPlayer2 || "AI_BLUE_2"] = teamBPlayer2;
            teamBPlayer2.controllerType = "ai";
            teamBPlayer2.isHuman = false;
            teamBPlayer2.controlledBy = null;
        }
        
        return spriteMap;
    }
    
    /**
     * Launch a LORB multiplayer match
     * 
     * @param {Object} challenge - The challenge record
     * @param {Object} myCtx - My LORB player context
     * @param {boolean} isChallenger - True if I'm the challenger (coordinator)
     * @returns {Object} Game results
     */
    function launchLorbMatch(challenge, myCtx, isChallenger) {
        log("launchLorbMatch starting: isChallenger=" + isChallenger);
        
        if (!isMultiplayerAvailable()) {
            logError("Multiplayer infrastructure not available");
            return { error: "Multiplayer not available", completed: false };
        }
        
        // Determine my global ID
        var myGid = myCtx._globalId;
        if (!myGid && LORB.Persist && LORB.Persist.getGlobalPlayerId && myCtx._user) {
            myGid = LORB.Persist.getGlobalPlayerId(myCtx._user);
        }
        if (!myGid) {
            logError("Could not determine my global ID");
            return { error: "Missing player ID", completed: false };
        }
        
        // Get opponent info from challenge
        var opponentGid;
        var opponentInfo;
        if (isChallenger) {
            opponentGid = challenge.to && challenge.to.globalId;
            opponentInfo = challenge.to;
        } else {
            opponentGid = challenge.from && challenge.from.globalId;
            opponentInfo = challenge.from;
        }
        
        if (!opponentGid) {
            logError("Could not determine opponent global ID");
            return { error: "Missing opponent ID", completed: false };
        }
        
        log("My GID: " + myGid + ", Opponent GID: " + opponentGid);
        
        // Build game config from LORB characters
        if (!LORB.Multiplayer.LorbMatch) {
            logError("LorbMatch module not loaded");
            return { error: "LorbMatch module missing", completed: false };
        }
        
        // Create contexts for both players
        var challengerCtx = isChallenger ? myCtx : opponentInfo;
        var challengeeCtx = isChallenger ? opponentInfo : myCtx;
        
        var gameConfig = LORB.Multiplayer.LorbMatch.buildLorbGameConfig(challengerCtx, challengeeCtx, challenge);
        log("Game config built: teamA=" + gameConfig.teamA.name + ", teamB=" + gameConfig.teamB.name);
        
        // Create session structure
        var session = LORB.Multiplayer.LorbMatch.createLorbSession(gameConfig, myGid, isChallenger);
        
        // Get server config and connect
        var serverConfig = getServerConfig();
        var client = null;
        var coordinator = null;
        var playerClient = null;
        var systems = null;
        
        try {
            client = createClient(serverConfig);
            log("Connected to JSON service");
            
            // Create systems
            systems = createSystems();
            log("Systems initialized");
            
            // Only coordinator writes session data
            if (isChallenger) {
                writeSessionToServer(client, challenge.id, session);
                log("Session written to server");
            } else {
                // Client waits briefly for coordinator to write session
                mswait(500);
            }
            
            // Initialize coordinator
            coordinator = new GameCoordinator(challenge.id, client, serverConfig, systems);
            coordinator.init();
            
            // Override isCoordinator based on our role
            coordinator.isCoordinator = isChallenger;
            
            if (typeof mpCoordinator !== "undefined") {
                mpCoordinator = coordinator; // Set global reference
            }
            
            // Initialize player client
            playerClient = new PlayerClient(challenge.id, client, myGid, serverConfig, systems);
            playerClient.init();
            
            playerClient.isCoordinator = isChallenger;
            playerClient.disablePrediction = isChallenger;
            
            log("Coordinator/client initialized: isCoordinator=" + isChallenger);
            
            // Initialize screen coordinator
            var mpScreenCoordinator = null;
            if (typeof MPScreenCoordinator !== "undefined") {
                mpScreenCoordinator = new MPScreenCoordinator(
                    systems,
                    isChallenger ? coordinator : null,
                    playerClient
                );
                coordinator.mpScreenCoordinator = mpScreenCoordinator;
                playerClient.mpScreenCoordinator = mpScreenCoordinator;
            }
            
            // Reset game state
            if (typeof resetGameState === "function") {
                resetGameState({ allCPUMode: false }, systems);
            }
            
            // Initialize sprites using LORB team definitions
            var options = {
                mode: "play",
                humanTeam: isChallenger ? "teamA" : "teamB",
                humanPlayerIndex: 0
            };
            
            initSpritesFromDynamic(gameConfig.teamA, gameConfig.teamB, options, systems);
            log("Sprites initialized from LORB rosters");
            
            // Build player assignments and sprite map
            var assignments = LORB.Multiplayer.LorbMatch.buildLorbPlayerAssignments(gameConfig, myGid);
            var spriteMap = buildSpriteMap(assignments, myGid);
            
            coordinator.setPlayerSpriteMap(spriteMap);
            
            // Set my sprite for client prediction
            var mySprite = spriteMap[myGid];
            if (mySprite) {
                playerClient.setMySprite(mySprite);
                log("My sprite set: " + mySprite.playerData.name);
            }
            
            playerClient.setSpriteMap(spriteMap);
            playerClient.setCoordinatorStatus(isChallenger);
            
            // Show matchup screen
            if (typeof showMatchupScreen === "function") {
                showMatchupScreen(false, systems, mpScreenCoordinator, myGid);
            }
            
            // Initialize frames and draw court
            if (typeof initFrames === "function") {
                initFrames(systems);
            }
            if (typeof drawCourt === "function") {
                drawCourt(systems);
            }
            if (typeof drawScore === "function") {
                drawScore(systems);
            }
            
            log("Starting multiplayer game loop");
            
            // Run the game
            runMultiplayerGameLoop(coordinator, playerClient, { globalId: myGid }, systems, mpScreenCoordinator);
            
            log("Game loop ended");
            
            // Collect results
            var score = systems.stateManager.get("score") || { teamA: 0, teamB: 0 };
            var winner = "tie";
            if (score.teamA > score.teamB) winner = "teamA";
            else if (score.teamB > score.teamA) winner = "teamB";
            
            var iWon = (isChallenger && winner === "teamA") || (!isChallenger && winner === "teamB");
            
            // Show game over
            if (typeof showGameOver === "function") {
                showGameOver(false, systems, mpScreenCoordinator, myGid, coordinator);
            }
            
            return {
                completed: true,
                winner: winner,
                score: score,
                iWon: iWon,
                lorbContext: gameConfig.lorbContext
            };
            
        } catch (e) {
            logError("Game error: " + e);
            if (e.stack) logError(e.stack);
            
            return { error: String(e), completed: false };
            
        } finally {
            // Cleanup
            try {
                if (coordinator && coordinator.cleanup) coordinator.cleanup();
            } catch (ce) { log("Coordinator cleanup error: " + ce); }
            
            try {
                if (playerClient && typeof playerClient.cleanup === "function") playerClient.cleanup();
            } catch (pe) { log("PlayerClient cleanup error: " + pe); }
            
            try {
                if (typeof cleanupSprites === "function") cleanupSprites();
            } catch (se) { log("Sprite cleanup error: " + se); }
            
            try {
                if (client) client.disconnect();
            } catch (de) { log("Client disconnect error: " + de); }
        }
    }
    
    // Export
    LORB.Multiplayer.Launcher = {
        isMultiplayerAvailable: isMultiplayerAvailable,
        launchLorbMatch: launchLorbMatch
    };
    
    log("Launcher module loaded");
    
})();
