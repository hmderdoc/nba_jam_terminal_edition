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
        
    }
    
    /**
     * Apply controller labels for LORB multiplayer
     * In LORB, both human players need proper labels (shortNick or name)
     * This replaces applyDefaultControllerLabels which only labels the local user
     * @param {Object} gameConfig - Game config with teamA and teamB definitions
     */
    function applyLorbControllerLabels(gameConfig) {
        var sprites = [
            { sprite: teamAPlayer1, info: gameConfig.teamA.players[0] },
            { sprite: teamAPlayer2, info: gameConfig.teamA.players[1] },
            { sprite: teamBPlayer1, info: gameConfig.teamB.players[0] },
            { sprite: teamBPlayer2, info: gameConfig.teamB.players[1] }
        ];
        
        for (var i = 0; i < sprites.length; i++) {
            var s = sprites[i];
            if (!s.sprite || !s.sprite.playerData) continue;
            
            var info = s.info || {};
            var isHuman = info.isHuman || s.sprite.isHuman;
            
            if (isHuman) {
                // Use shortNick if available, otherwise derive from name
                var label = info.shortNick || (info.name ? info.name.substring(0, 7) : "PLAYER");
                if (typeof setSpriteControllerLabel === "function") {
                    setSpriteControllerLabel(s.sprite, label, true);
                }
            } else {
                if (typeof setSpriteControllerLabel === "function") {
                    setSpriteControllerLabel(s.sprite, "CPU", false);
                }
            }
            
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
     * Must include tuning object for GameCoordinator/PlayerClient
     */
    function getServerConfig() {
        // Default tuning preset (matches interbbs from mp-constants.js)
        var defaultTuning = {
            inputFlushInterval: 50,
            stateUpdateInterval: 100,
            maxInputBatch: 10,
            reconciliationStrength: 0.3
        };
        
        // Try to get from mpConfig if available
        if (typeof mpConfig !== "undefined" && mpConfig) {
            return {
                addr: mpConfig.addr || "localhost",
                port: mpConfig.port || 10088,
                tuning: mpConfig.tuning || defaultTuning
            };
        }
        
        // Try to get tuning from MP_CONSTANTS if available
        var tuning = defaultTuning;
        if (typeof MP_CONSTANTS !== "undefined" && MP_CONSTANTS.TUNING_PRESETS) {
            tuning = MP_CONSTANTS.TUNING_PRESETS.interbbs || MP_CONSTANTS.TUNING_PRESETS.local || defaultTuning;
        }
        
        // Fall back to LORB persist config for addr/port
        var baseConfig = { addr: "localhost", port: 10088 };
        if (LORB.Persist && LORB.Persist.getServerConfig) {
            var persistConfig = LORB.Persist.getServerConfig();
            if (persistConfig) {
                baseConfig.addr = persistConfig.addr || baseConfig.addr;
                baseConfig.port = persistConfig.port || baseConfig.port;
            }
        }
        
        baseConfig.tuning = tuning;
        return baseConfig;
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
        // Use lock parameter 2 (LOCK_WRITE) to ensure atomic write
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
     * Synchronized game launch with subscription-based handshaking
     * 
     * PROTOCOL (using subscribe/cycle pattern - no polling):
     * 1. Subscribe to sync path
     * 2. Write my "ready" signal
     * 3. cycle() to receive updates until both ready
     * 4. Coordinator writes startTime once both are ready
     * 5. Both players countdown to startTime
     * 
     * @param {Object} client - JSON client
     * @param {string} challengeId - Challenge ID
     * @param {string} myGlobalId - My global player ID
     * @param {boolean} isChallenger - True if I'm coordinator
     * @param {number} countdownSeconds - Countdown duration (default 5)
     * @returns {boolean} True if sync succeeded, false if timed out
     */
    function showSynchronizedCountdown(client, challengeId, myGlobalId, isChallenger, countdownSeconds) {
        var COUNTDOWN_SECS = countdownSeconds || 5;
        var syncPath = "game." + challengeId + ".sync";
        var MAX_WAIT_MS = 30000; // 30 second max wait for opponent
        
        
        // Screen dimensions for display
        var screenWidth = console.screen_columns || 80;
        var screenHeight = console.screen_rows || 24;
        var centerX = Math.floor(screenWidth / 2);
        var centerY = Math.floor(screenHeight / 2);
        
        // Helper to display status
        function showStatus(line1, line2, line3) {
            console.clear();
            console.gotoxy(centerX - 12, centerY - 2);
            console.print("\1h\1c=== LIVE MATCH SYNC ===\1n");
            if (line1) {
                console.gotoxy(centerX - Math.floor(line1.length / 2), centerY);
                console.print(line1);
            }
            if (line2) {
                console.gotoxy(centerX - Math.floor(line2.length / 2), centerY + 2);
                console.print(line2);
            }
            if (line3) {
                console.gotoxy(centerX - Math.floor(line3.length / 2), centerY + 4);
                console.print(line3);
            }
        }
        
        // =====================================================
        // PHASE 1: Write my ready signal
        // =====================================================
        showStatus("\1yConnecting to match server...\1n", "", "");
        
        var myReadyData = {
            ready: true,
            timestamp: Date.now(),
            globalId: myGlobalId,
            isChallenger: isChallenger
        };
        
        // Read existing sync data first
        var syncData = null;
        try {
            syncData = client.read("nba_jam", syncPath, 1);
        } catch (e) {
        }
        
        if (!syncData || typeof syncData !== "object") {
            syncData = { players: {} };
        }
        if (!syncData.players) {
            syncData.players = {};
        }
        
        // Add my ready signal
        syncData.players[myGlobalId] = myReadyData;
        
        try {
            client.write("nba_jam", syncPath, syncData, 2);
        } catch (e) {
            showStatus("\1rError connecting to match\1n", "\1yRetrying...\1n", "");
            mswait(1000);
            // Retry once
            try {
                client.write("nba_jam", syncPath, syncData, 2);
            } catch (e2) {
                return false;
            }
        }
        
        // =====================================================
        // PHASE 2: Wait for opponent's ready signal (polling)
        // =====================================================
        showStatus("\1yWaiting for opponent...\1n", "", "");
        
        var waitStart = Date.now();
        var bothReady = false;
        var opponentGlobalId = null;
        var lastDotCount = 0;
        
        while (!bothReady && (Date.now() - waitStart) < MAX_WAIT_MS) {
            mswait(500); // Check every 500ms
            
            // Animate waiting dots
            var dotCount = Math.floor((Date.now() - waitStart) / 500) % 4;
            if (dotCount !== lastDotCount) {
                lastDotCount = dotCount;
                var dots = "";
                for (var d = 0; d < dotCount; d++) dots += ".";
                var elapsed = Math.floor((Date.now() - waitStart) / 1000);
                showStatus(
                    "\1yWaiting for opponent" + dots + "\1n",
                    "\1n(" + elapsed + "s elapsed)\1n",
                    ""
                );
            }
            
            // Re-read sync data
            try {
                syncData = client.read("nba_jam", syncPath, 1);
            } catch (e) {
                continue;
            }
            
            if (!syncData || !syncData.players) continue;
            
            // Check how many players are ready
            var readyCount = 0;
            for (var pid in syncData.players) {
                if (syncData.players.hasOwnProperty(pid) && syncData.players[pid] && syncData.players[pid].ready) {
                    readyCount++;
                    if (pid !== myGlobalId) {
                        opponentGlobalId = pid;
                    }
                }
            }
            
            
            if (readyCount >= 2 && opponentGlobalId) {
                bothReady = true;
            }
            
            // Re-write my ready signal periodically to keep it fresh
            if ((Date.now() - waitStart) % 5000 < 500) {
                myReadyData.timestamp = Date.now();
                syncData.players[myGlobalId] = myReadyData;
                try {
                    client.write("nba_jam", syncPath, syncData, 2);
                } catch (e) {}
            }
        }
        
        if (!bothReady) {
            showStatus("\1rTimeout waiting for opponent\1n", "", "");
            mswait(2000);
            return false;
        }
        
        // =====================================================
        // PHASE 3: Coordinator sets start time
        // =====================================================
        var gameStartTime = null;
        
        if (isChallenger) {
            // I'm coordinator - set the start time
            gameStartTime = Date.now() + (COUNTDOWN_SECS * 1000) + 1000; // +1s buffer
            syncData.startTime = gameStartTime;
            syncData.coordinatorSet = true;
            
            try {
                client.write("nba_jam", syncPath, syncData, 2);
            } catch (e) {
            }
        } else {
            // I'm client - wait for startTime
            showStatus("\1yOpponent found!\1n", "\1nWaiting for countdown...\1n", "");
            
            var startWait = Date.now();
            while (!gameStartTime && (Date.now() - startWait) < 10000) {
                mswait(500);
                
                try {
                    syncData = client.read("nba_jam", syncPath, 1);
                } catch (e) {
                    continue;
                }
                
                if (syncData && syncData.startTime && syncData.coordinatorSet) {
                    gameStartTime = syncData.startTime;
                }
            }
            
            if (!gameStartTime) {
                gameStartTime = Date.now() + (COUNTDOWN_SECS * 1000);
            }
        }
        
        // =====================================================
        // PHASE 4: Synchronized countdown
        // =====================================================
        showStatus("\1gOpponent connected!\1n", "\1yStarting countdown...\1n", "");
        mswait(500);
        
        var lastDisplayedSecond = -1;
        
        while (Date.now() < gameStartTime) {
            var msRemaining = gameStartTime - Date.now();
            var secondsRemaining = Math.ceil(msRemaining / 1000);
            
            if (secondsRemaining !== lastDisplayedSecond && secondsRemaining >= 0 && secondsRemaining <= COUNTDOWN_SECS) {
                lastDisplayedSecond = secondsRemaining;
                
                console.clear();
                
                // Title
                console.gotoxy(centerX - 10, centerY - 4);
                console.print("\1h\1c=== LIVE MATCH ===\1n");
                
                // Countdown
                console.gotoxy(centerX - 8, centerY - 1);
                console.print("\1h\1wGame starts in:\1n");
                
                console.gotoxy(centerX - 1, centerY + 1);
                if (secondsRemaining <= 3) {
                    console.print("\1h\1r" + secondsRemaining + "\1n");
                } else {
                    console.print("\1h\1y" + secondsRemaining + "\1n");
                }
                
            }
            
            mswait(100);
        }
        
        // Final "GO!" message
        console.clear();
        console.gotoxy(centerX - 2, centerY);
        console.print("\1h\1gGO!\1n");
        mswait(400);
        
        return true;
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
        
        
        // Log challenge structure for debugging
        
        // Build game config from LORB characters
        if (!LORB.Multiplayer.LorbMatch) {
            logError("LorbMatch module not loaded");
            return { error: "LorbMatch module missing", completed: false };
        }
        
        // CRITICAL: Use challenge data as single source of truth for BOTH players
        // This ensures both sides see identical nicknames, shortNicks, and teammate data.
        // Previously we used myCtx for our own team which caused desync because
        // each side would re-hydrate from their own local contacts.
        var challengerCtx = challenge.from;
        var challengeeCtx = challenge.to;
        
        
        var gameConfig = LORB.Multiplayer.LorbMatch.buildLorbGameConfig(challengerCtx, challengeeCtx, challenge);
        
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
            
            // Create systems
            systems = createSystems();
            
            // Only coordinator writes session data
            if (isChallenger) {
                writeSessionToServer(client, challenge.id, session);
            } else {
                // Client waits for coordinator to write session
                // Simple polling approach (matches main branch)
                var expectedCoordinator = challenge.from && challenge.from.globalId;
                var sessionReady = false;
                var sessionPath = "game." + challenge.id + ".meta";
                var waitStart = Date.now();
                var maxWait = 10000;  // 10 seconds max
                
                
                while (!sessionReady && (Date.now() - waitStart) < maxWait) {
                    mswait(500);  // Poll every 500ms like main branch
                    
                    var sessionCheck = null;
                    try {
                        sessionCheck = client.read("nba_jam", sessionPath, 1);
                    } catch (e) {
                    }
                    
                    if (sessionCheck && sessionCheck.coordinator === expectedCoordinator) {
                        sessionReady = true;
                    }
                }
                
                if (!sessionReady) {
                    logError("Timeout waiting for coordinator to write session");
                    return { error: "Coordinator not ready", completed: false };
                }
            }
            
            // Initialize coordinator
            // Set isCoordinator BEFORE init() to prevent checkRole() from claiming wrong role
            coordinator = new GameCoordinator(challenge.id, client, serverConfig, systems);
            coordinator.isCoordinator = isChallenger;  // Set explicitly before init
            coordinator._isCoordinatorPreset = isChallenger;  // Flag to prevent checkRole override
            coordinator.init();
            
            if (typeof mpCoordinator !== "undefined") {
                mpCoordinator = coordinator; // Set global reference
            }
            
            // Initialize player client
            playerClient = new PlayerClient(challenge.id, client, myGid, serverConfig, systems);
            playerClient.init();
            
            playerClient.isCoordinator = isChallenger;
            playerClient.disablePrediction = isChallenger;
            
            
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
            
            // Reset game state with LORB game time
            if (typeof resetGameState === "function") {
                var gameTime = gameConfig.options && gameConfig.options.gameTime ? gameConfig.options.gameTime : 120;
                resetGameState({ allCPUMode: false, gameTime: gameTime }, systems);
            }
            
            // Initialize sprites using LORB team definitions
            var options = {
                mode: "play",
                humanTeam: isChallenger ? "teamA" : "teamB",
                humanPlayerIndex: 0,
                lorbContext: gameConfig.lorbContext
            };
            
            initSpritesFromDynamic(gameConfig.teamA, gameConfig.teamB, options, systems);
            
            // Apply LORB-specific controller labels
            // In LORB multiplayer, both human players need proper labels (not just local user)
            applyLorbControllerLabels(gameConfig);
            
            // Build player assignments and sprite map
            var assignments = LORB.Multiplayer.LorbMatch.buildLorbPlayerAssignments(gameConfig, myGid);
            var spriteMap = buildSpriteMap(assignments, myGid);
            
            coordinator.setPlayerSpriteMap(spriteMap);
            
            // Set my sprite for client prediction
            var mySprite = spriteMap[myGid];
            if (mySprite) {
                playerClient.setMySprite(mySprite);
            }
            
            playerClient.setSpriteMap(spriteMap);
            playerClient.setCoordinatorStatus(isChallenger);
            
            // Show matchup screen
            if (typeof showMatchupScreen === "function") {
                showMatchupScreen(false, systems, mpScreenCoordinator, myGid);
            }
            
            // ========================================================
            // SYNCHRONIZED COUNTDOWN - ensures both players start together
            // Uses two-way handshaking: both must be ready before countdown
            // ========================================================
            var syncOk = showSynchronizedCountdown(client, challenge.id, myGid, isChallenger, 5);
            if (!syncOk) {
                return { error: "Sync failed - opponent not ready", completed: false };
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
            
            
            // Run the game
            runMultiplayerGameLoop(coordinator, playerClient, { globalId: myGid }, systems, mpScreenCoordinator);
            
            
            // Collect detailed results using external game results collector
            // This gives us full box score data instead of just scores
            var boxScore = null;
            if (typeof collectExternalGameResults === "function") {
                boxScore = collectExternalGameResults(systems, gameConfig);
            }
            
            // Fallback to basic score if collectExternalGameResults unavailable
            var score = (boxScore && boxScore.score) 
                ? boxScore.score 
                : (systems.stateManager.get("score") || { teamA: 0, teamB: 0 });
            var winner = (boxScore && boxScore.winner) ? boxScore.winner : "tie";
            if (!boxScore) {
                if (score.teamA > score.teamB) winner = "teamA";
                else if (score.teamB > score.teamA) winner = "teamB";
            }
            
            var iWon = (isChallenger && winner === "teamA") || (!isChallenger && winner === "teamB");
            
            // LORB: Skip showGameOver voting screen - we return directly to LORB
            // LORB handles post-game rewards, stats recording, and rematch prompts
            
            return {
                completed: true,
                winner: winner,
                score: score,
                iWon: iWon,
                lorbContext: gameConfig.lorbContext,
                // Include full box score for LORB stat tracking
                boxScore: boxScore || null,
                playerStats: (boxScore && boxScore.playerStats) || null
            };
            
        } catch (e) {
            logError("Game error: " + e);
            if (e.stack) logError(e.stack);
            
            return { error: String(e), completed: false };
            
        } finally {
            // Cleanup
            try {
                if (coordinator && coordinator.cleanup) coordinator.cleanup();
            } catch (ce) { ; }
            
            try {
                if (playerClient && typeof playerClient.cleanup === "function") playerClient.cleanup();
            } catch (pe) { ; }
            
            try {
                if (typeof cleanupSprites === "function") cleanupSprites();
            } catch (se) { ; }
            
            try {
                if (client) client.disconnect();
            } catch (de) { ; }
        }
    }
    
    // Export
    LORB.Multiplayer.Launcher = {
        isMultiplayerAvailable: isMultiplayerAvailable,
        launchLorbMatch: launchLorbMatch
    };
    
    
})();
