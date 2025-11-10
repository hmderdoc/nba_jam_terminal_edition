// NBA JAM - Terminal Basketball Arcade Game
// A Synchronet BBS door game using sprite.js
//
// Wave 23D: Centralized module loading - see lib/core/module-loader.js

// Load centralized module loader
load(js.exec_dir + "lib/core/module-loader.js");

// Load all game modules with validation
var loadResult = loadGameModules();
if (!loadResult.success) {
    console.print("\n\nCRITICAL ERROR: Failed to load required game modules.\n");
    console.print("Error: " + loadResult.criticalError + "\n");
    console.print("\nPress any key to exit...\n");
    console.getkey();
    exit(1);
}

var multiplayerEnabled = loadResult.multiplayerEnabled;
if (!multiplayerEnabled) {
    log(LOG_INFO, "NBA JAM: Running in single-player mode (multiplayer not available)");
}

function initFrames(systems) {
    if (typeof console !== 'undefined' && typeof console.clear === 'function') {
        console.clear();
    }

    announcerFrame = new Frame(1, 1, 80, 1, LIGHTGRAY | BG_BLACK);
    courtFrame = new Frame(1, 2, COURT_WIDTH, COURT_HEIGHT, WHITE | WAS_BROWN);

    // Create transparent trail overlay at same position as courtFrame (not as child)
    trailFrame = new Frame(1, 2, COURT_WIDTH, COURT_HEIGHT, 0);
    trailFrame.transparent = true;

    cleanupScoreFrames();
    scoreFrame = new Frame(1, COURT_HEIGHT + 2, 80, 5, LIGHTGRAY | BG_BLACK);

    announcerFrame.open();
    courtFrame.open();
    trailFrame.open();  // Open trail overlay on top of court
    trailFrame.top();   // Ensure trails are drawn on top
    scoreFrame.open();
    ensureScoreFontLoaded();

    ensureBallFrame(40, 10);
    drawAnnouncerLine(systems);

    // Wave 23D: Verify trail frame initialized
    if (typeof debugLog === "function") {
        debugLog("[INIT] trailFrame initialized: " + (trailFrame ? "YES" : "NO") +
            ", transparent=" + (trailFrame ? trailFrame.transparent : "N/A") +
            ", open=" + (trailFrame && trailFrame.is_open ? "YES" : "NO"));
    }
}

function cleanupSprites() {
    if (teamAPlayer1) {
        if (teamAPlayer1.frame) teamAPlayer1.frame.close();
        if (teamAPlayer1.labelFrame) {
            try { teamAPlayer1.labelFrame.close(); } catch (e) { }
            teamAPlayer1.labelFrame = null;
        }
    }
    if (teamAPlayer2) {
        if (teamAPlayer2.frame) teamAPlayer2.frame.close();
        if (teamAPlayer2.labelFrame) {
            try { teamAPlayer2.labelFrame.close(); } catch (e) { }
            teamAPlayer2.labelFrame = null;
        }
    }
    if (teamBPlayer1) {
        if (teamBPlayer1.frame) teamBPlayer1.frame.close();
        if (teamBPlayer1.labelFrame) {
            try { teamBPlayer1.labelFrame.close(); } catch (e) { }
            teamBPlayer1.labelFrame = null;
        }
    }
    if (teamBPlayer2) {
        if (teamBPlayer2.frame) teamBPlayer2.frame.close();
        if (teamBPlayer2.labelFrame) {
            try { teamBPlayer2.labelFrame.close(); } catch (e) { }
            teamBPlayer2.labelFrame = null;
        }
    }
    if (ballFrame) ballFrame.close();

    teamAPlayer1 = null;
    teamAPlayer2 = null;
    teamBPlayer1 = null;
    teamBPlayer2 = null;
    ballFrame = null;
}

// Violation checking (checkViolations, enforceBackcourtViolation, etc.) loaded from lib/game-logic/violations.js

// Wave 23D Phase 3: Refactored to use unified game loop core
function gameLoop(systems) {
    try {
        // Validate systems
        if (!systems || !systems.stateManager) {
            throw new Error("ARCHITECTURE ERROR: gameLoop requires systems parameter with stateManager");
        }

        var stateManager = systems.stateManager;

        // Initialize game state
        stateManager.set("gameRunning", true, "game_loop_start");
        stateManager.set("lastUpdateTime", Date.now(), "game_loop_start");
        stateManager.set("lastSecondTime", Date.now(), "game_loop_start");
        stateManager.set("lastAIUpdateTime", Date.now(), "game_loop_start");
        clearPotentialAssist(systems);

        var tempo = getSinglePlayerTempo();

        // Initial draw
        drawCourt(systems);
        drawScore(systems);
        var teamNames = stateManager.get("teamNames");
        announceEvent("game_start", {
            teamA: (teamNames.teamA || "TEAM A").toUpperCase(),
            teamB: (teamNames.teamB || "TEAM B").toUpperCase()
        }, systems);

        // Configure for single-player mode
        var config = {
            isAuthority: true, // SP is always authoritative
            handleInput: function () {
                var key = console.inkey(K_NONE, 5);
                if (key) handleInput(key, systems);
            },
            aiInterval: tempo.aiIntervalMs, // Throttled AI for performance
            frameDelay: tempo.frameDelayMs  // Variable frame rate
        };

        // Main game loop using unified core
        while (stateManager.get("gameRunning") && stateManager.get("timeRemaining") > 0) {
            var result = runGameFrame(systems, config);

            if (result === "halftime") {
                showHalftimeScreen(systems);
                if (!stateManager.get("gameRunning")) break; // User quit during halftime

                // Reset for second half
                if (stateManager.get("pendingSecondHalfInbound")) {
                    startSecondHalfInbound(systems);
                }
                drawCourt(systems);
                drawScore(systems);
                stateManager.set("lastUpdateTime", Date.now(), "halftime_reset");
                stateManager.set("lastSecondTime", Date.now(), "halftime_reset");
                stateManager.set("lastAIUpdateTime", Date.now(), "halftime_reset");
                continue;
            }

            if (result === "game_over") {
                break;
            }

            // Frame timing
            systems.frameScheduler.waitForNextFrame(config.frameDelay);
        }

        stateManager.set("gameRunning", false, "game_loop_end");

    } catch (e) {
        // Log error with full game state context
        if (typeof logError === "function") {
            logError(e, "gameLoop");
        }
        if (typeof logErrorWithSnapshot === "function") {
            logErrorWithSnapshot(e, "gameLoop", systems);
        }
        console.print("\r\n\x01r\x01hFATAL ERROR in game loop\x01n\r\n");
        throw e;
    }
}

// Wave 23D: Removed ~400 lines of duplicated logic - now using unified game-loop-core.js

function runCPUDemo(systems) {
    if (!systems || !systems.stateManager) {
        throw new Error("ARCHITECTURE ERROR: runCPUDemo requires systems parameter");
    }
    var stateManager = systems.stateManager;
    while (true) {
        // Pick random teams for demo
        var teamKeys = Object.keys(NBATeams);
        var randomTeam1 = teamKeys[Math.floor(Math.random() * teamKeys.length)];
        var randomTeam2 = teamKeys[Math.floor(Math.random() * teamKeys.length)];

        // Make sure they're different teams
        while (randomTeam1 === randomTeam2) {
            randomTeam2 = teamKeys[Math.floor(Math.random() * teamKeys.length)];
        }

        var redTeamKey = randomTeam1;
        var blueTeamKey = randomTeam2;

        // Use random player indices (pick 2 random players from each 6-player roster)
        var teamATeam = NBATeams[redTeamKey];
        var teamBTeam = NBATeams[blueTeamKey];

        var redAvailablePlayers = [];
        var blueAvailablePlayers = [];

        // Get available players for each team using actual players array
        for (var i = 0; i < teamATeam.players.length; i++) {
            redAvailablePlayers.push(i);
        }
        for (var i = 0; i < teamBTeam.players.length; i++) {
            blueAvailablePlayers.push(i);
        }

        // Safety check - ensure we have at least 2 players per team
        if (redAvailablePlayers.length < 2) {
            // Fallback to default players (0 and 1, or 0 and 0 if only 1 player)
            redAvailablePlayers = [0, teamATeam.players.length > 1 ? 1 : 0];
        }
        if (blueAvailablePlayers.length < 2) {
            blueAvailablePlayers = [0, teamBTeam.players.length > 1 ? 1 : 0];
        }

        // Randomly select 2 players from each team
        var redPlayerIndices = {
            player1: redAvailablePlayers[Math.floor(Math.random() * redAvailablePlayers.length)],
            player2: redAvailablePlayers[Math.floor(Math.random() * redAvailablePlayers.length)]
        };

        // Make sure red players are different
        while (redPlayerIndices.player1 === redPlayerIndices.player2 && redAvailablePlayers.length > 1) {
            redPlayerIndices.player2 = redAvailablePlayers[Math.floor(Math.random() * redAvailablePlayers.length)];
        }

        var bluePlayerIndices = {
            player1: blueAvailablePlayers[Math.floor(Math.random() * blueAvailablePlayers.length)],
            player2: blueAvailablePlayers[Math.floor(Math.random() * blueAvailablePlayers.length)]
        };

        // Make sure blue players are different
        while (bluePlayerIndices.player1 === bluePlayerIndices.player2 && blueAvailablePlayers.length > 1) {
            bluePlayerIndices.player2 = blueAvailablePlayers[Math.floor(Math.random() * blueAvailablePlayers.length)];
        }

        // Reset state and initialize sprites with ALL CPU mode
        var systems = initializeSystems({
            gameState: gameState,
            animationSystem: animationSystem,
            getPlayers: function () {
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
            },
            constants: {
                COURT_WIDTH: COURT_WIDTH,
                COURT_HEIGHT: COURT_HEIGHT
            }
        });
        resetGameState({ allCPUMode: true }, systems);
        initSprites(redTeamKey, blueTeamKey, redPlayerIndices, bluePlayerIndices, true, systems);

        // Match player game length for demo as well
        stateManager.set("timeRemaining", DEMO_GAME_SECONDS, "demo_init");
        stateManager.set("totalGameTime", DEMO_GAME_SECONDS, "demo_init");
        stateManager.set("currentHalf", 1, "demo_init");

        // Show matchup screen with betting enabled
        var bettingSlip = showMatchupScreen(true);

        // Display "DEMO MODE" message
        announce("DEMO MODE - Press Q to exit", YELLOW, systems);
        systems.frameScheduler.waitForNextFrame(1500);

        // Run the game loop (all AI controlled)
        gameLoop(systems);

        // After game ends, show betting results if user placed bets
        if (bettingSlip && typeof showBettingResults === "function") {
            var gameResults = collectGameResults(redTeamKey, blueTeamKey);
            showBettingResults(bettingSlip, gameResults);
        }

        // After game ends, check what user wants to do
        var choice = showGameOver(true, systems); // Pass true for demo mode

        if (choice === "quit") {
            break; // Exit demo loop
        }
        // choice === "newdemo" continues the loop for a new demo

        // Clean up sprites before starting new demo
        cleanupSprites();
        resetGameState({ allCPUMode: true }, systems);
    }
}

/**
 * Setup event subscriptions (Observer pattern)
 * Connects game logic events to UI/announcer
 */
function setupEventSubscriptions(systems) {
    // Subscribe to violation events
    onGameEvent("violation", function (data) {
        if (data.type === "backcourt") {
            announceEvent("violation_backcourt", { team: data.team }, systems);
        } else if (data.type === "five_seconds") {
            announceEvent("violation_five_seconds", { team: data.team }, systems);
        }
    });

    // Future: Can add more event subscriptions here
    // - onGameEvent("score", ...) for stats tracking
    // - onGameEvent("steal", ...) for multiplayer sync
    // - onGameEvent("turnover", ...) for analytics
}

function main() {
    // Wave 23: Initialize architecture foundation systems FIRST
    // Wave 23: Initialize all game systems with dependency injection
    var systems = initializeSystems({
        gameState: gameState,
        animationSystem: animationSystem,
        getPlayers: function () {
            // Lazy evaluation - returns current player references
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
            COURT_HEIGHT: COURT_HEIGHT
        }
    });

    // Now reset gameState with systems available
    resetGameState(null, systems);

    // Subscribe to game events (Observer pattern)
    setupEventSubscriptions(systems);

    // Show ANSI splash screen first
    showSplashScreen();

    // Load team data first
    loadTeamData();
    loadAnnouncerData();

    initFrames(systems);
    showIntro();

    // Main menu - choose play or demo
    var menuChoice = mainMenu();

    if (!menuChoice) {
        // User chose to quit
        return;
    }

    if (menuChoice === "demo") {
        // Run CPU vs CPU demo
        runCPUDemo(systems);
    } else if (menuChoice === "multiplayer") {
        // Run multiplayer
        if (multiplayerEnabled) {
            runMultiplayerMode(systems);
        } else {
            console.clear();
            console.print("\r\n\1r\1hMultiplayer not available!\1n\r\n\r\n");
            console.print("Multiplayer files not found. This installation may be incomplete.\r\n\r\n");
            console.print("Press any key to continue...");
            console.getkey();
        }
    } else if (menuChoice === "lorb") {
        // Run LORB
        try {
            load(js.exec_dir + "lib/lorb/lorb.js");
        } catch (e) {
            console.clear();
            console.print("\r\n\1r\1hLORB not available!\1n\r\n\r\n");
            console.print("Error loading LORB: " + e + "\r\n\r\n");
            console.print("Press any key to continue...");
            console.getkey();
        }
    } else if (menuChoice === "play") {
        var playAgain = true;
        var useNewTeams = false;
        var selection = null;

        while (playAgain) {
            if (!selection || useNewTeams) {
                // Team selection screen
                selection = teamSelectionScreen();
                if (!selection) {
                    // User quit during selection
                    return;
                }
                useNewTeams = false;
            }

            // Clear screen before starting game to remove selection artifacts
            console.clear();

            resetGameState({ allCPUMode: false }, systems);
            initSprites(
                selection.teamATeam,
                selection.teamBTeam,
                selection.teamAPlayers,
                selection.teamBPlayers,
                false,  // Not demo mode - player1 is human
                systems
            );

            showMatchupScreen();

            gameLoop(systems);
            var choice = showGameOver(false, systems); // Pass false for player mode

            if (choice === "quit") {
                playAgain = false;
            } else if (choice === "newteams") {
                useNewTeams = true;
                cleanupSprites(); // Clean up before new team selection
                resetGameState(null, systems);
            } else if (choice === "playagain") {
                cleanupSprites(); // Clean up before restarting
                resetGameState(null, systems);
            }
        }
    }

    function runMultiplayerMode(systems) {
        // Wave 23D: Systems required for coordinator state serialization
        if (!systems || !systems.stateManager) {
            throw new Error("ARCHITECTURE ERROR: runMultiplayerMode requires systems parameter");
        }

        // Run the lobby
        var lobbyResult = runMultiplayerLobby();

        if (!lobbyResult) {
            // User cancelled or connection failed
            return;
        }

        // Extract session info from lobby
        var sessionId = lobbyResult.sessionId;
        var session = lobbyResult.session;
        var client = lobbyResult.client;
        var myId = lobbyResult.myId;
        var serverConfig = lobbyResult.serverConfig;

        // Initialize coordinator (Wave 23D: Pass systems for state serialization)
        var coordinator = new GameCoordinator(sessionId, client, serverConfig, systems);
        coordinator.init();
        mpCoordinator = coordinator; // Set global reference for event broadcasting

        // Initialize client (Wave 23D: Pass systems for state management)
        var playerClient = new PlayerClient(sessionId, client, myId.globalId, serverConfig, systems);
        playerClient.init();

        // Sync coordinator status to client (so client knows if it's authoritative)
        playerClient.isCoordinator = coordinator.isCoordinator;
        playerClient.disablePrediction = coordinator.isCoordinator;

        // Reset game state for multiplayer
        resetGameState({ allCPUMode: false }, systems);

        // Refresh session data from game namespace to capture final team assignments
        var liveSession = client.read("nba_jam", "game." + sessionId + ".meta", 1);
        if (!liveSession) {
            // Fallback to lobby snapshot in case the game meta hasn't been written yet
            liveSession = client.read("nba_jam", "lobby.sessions." + sessionId, 1);
        }
        if (liveSession) {
            session = liveSession;
            ensureTeamContainers(session);
        }

        // Determine player assignments from session
        var playerAssignments = assignMultiplayerPlayers(session, myId);

        // Initialize sprites for multiplayer
        initMultiplayerSprites(session, playerAssignments, myId);

        // Debug: Log sprite frame states after init
        debugLog("[MP INIT] Sprite frames after initMultiplayerSprites:");
        var allSprites = getAllPlayers();
        for (var i = 0; i < allSprites.length; i++) {
            if (allSprites[i] && allSprites[i].playerData) {
                debugLog("  - " + allSprites[i].playerData.name + ": frame.is_open=" +
                    (allSprites[i].frame ? allSprites[i].frame.is_open : "null"));
            }
        }

        // Create sprite map (global player ID -> sprite)
        var spriteMap = createMultiplayerSpriteMap(playerAssignments);
        coordinator.setPlayerSpriteMap(spriteMap);

        // Debug: Log sprite map
        debugLog("=== Sprite Map Created ===");
        debugLog("My ID: " + myId.globalId);
        debugLog("Is Coordinator: " + (coordinator.isCoordinator ? "YES" : "NO"));
        for (var gid in spriteMap) {
            if (spriteMap.hasOwnProperty(gid)) {
                var sprite = spriteMap[gid];
                var spriteName = sprite ? (sprite.playerData ? sprite.playerData.name : "unnamed") : "NULL";
                debugLog("  " + gid + " -> " + spriteName);
            }
        }

        // Set my sprite for client prediction
        var mySprite = spriteMap[myId.globalId];
        if (mySprite) {
            playerClient.setMySprite(mySprite);
            debugLog("SUCCESS: My sprite found: " + mySprite.playerData.name);
        } else {
            debugLog("ERROR: My sprite NOT FOUND for globalId: " + myId.globalId);
        }

        // Set sprite map so client can update remote player positions
        playerClient.setSpriteMap(spriteMap);

        // Tell client if we're coordinator (disables prediction to avoid double input)
        playerClient.setCoordinatorStatus(coordinator.isCoordinator);

        // Don't draw court before matchup - showMatchupScreen() calls console.clear() 
        // which would wipe it out. Let game loop draw it fresh like single-player does.

        // Show matchup screen
        showMatchupScreen();

        debugLog("[MP INIT] After matchup screen, drawing court before game loop");

        // Draw court AFTER matchup screen ends (like single-player does)
        // matchup screen calls console.clear() which wipes frame content
        drawCourt(systems);
        drawScore(systems);

        debugLog("[MP INIT] Court drawn, starting game loop");

        // Run multiplayer game loop
        runMultiplayerGameLoop(coordinator, playerClient, myId, systems);

        // Cleanup
        mpCoordinator = null; // Clear global reference
        if (coordinator && typeof coordinator.cleanup === "function") {
            coordinator.cleanup();
        }
        if (playerClient && typeof playerClient.cleanup === "function") {
            playerClient.cleanup();
        }
        cleanupSprites();

        // Show game over screen
        showGameOver(false, systems);
    }

    function assignMultiplayerPlayers(session, myId) {
        var assignments = {
            teamAPlayer1: null,
            teamAPlayer2: null,
            teamBPlayer1: null,
            teamBPlayer2: null
        };

        if (!session || !session.teams) {
            return assignments;
        }

        // Assign players based on team selections
        var teamAPlayers = session.teams.teamA.players || [];
        var teamBPlayers = session.teams.teamB.players || [];

        if (teamAPlayers.length > 0) {
            assignments.teamAPlayer1 = teamAPlayers[0];
        }
        if (teamAPlayers.length > 1) {
            assignments.teamAPlayer2 = teamAPlayers[1];
        }

        if (teamBPlayers.length > 0) {
            assignments.teamBPlayer1 = teamBPlayers[0];
        }
        if (teamBPlayers.length > 1) {
            assignments.teamBPlayer2 = teamBPlayers[1];
        }

        return assignments;
    }

    function clampRosterIndexForGame(index, teamDef) {
        if (!teamDef || !teamDef.players || teamDef.players.length === 0)
            return 0;
        var value = parseInt(index, 10);
        if (isNaN(value)) value = 0;
        if (value < 0) value = 0;
        if (value >= teamDef.players.length) value = teamDef.players.length - 1;
        return value;
    }

    function findAvailableRosterIndexForGame(teamDef, used) {
        if (!teamDef || !teamDef.players || teamDef.players.length === 0)
            return 0;
        for (var i = 0; i < teamDef.players.length; i++) {
            if (!used[i])
                return i;
        }
        return 0;
    }

    function resolveTeamPlayerIndices(teamSideData, teamDef) {
        var indices = { player1: 0, player2: 1 };
        var rosterChoices = (teamSideData && teamSideData.roster) || {};
        var playersList = (teamSideData && teamSideData.players) || [];
        var used = {};

        if (playersList.length > 0) {
            var choice = rosterChoices[playersList[0]];
            if (choice && typeof choice.index === "number") {
                indices.player1 = clampRosterIndexForGame(choice.index, teamDef);
            }
            used[indices.player1] = true;
        }

        if (playersList.length > 1) {
            var choice2 = rosterChoices[playersList[1]];
            if (choice2 && typeof choice2.index === "number") {
                var idx2 = clampRosterIndexForGame(choice2.index, teamDef);
                if (used[idx2])
                    idx2 = findAvailableRosterIndexForGame(teamDef, used);
                indices.player2 = idx2;
            } else {
                indices.player2 = findAvailableRosterIndexForGame(teamDef, used);
            }
            used[indices.player2] = true;
        } else {
            var cpuIdx = (teamSideData && typeof teamSideData.cpuIndex === "number") ? clampRosterIndexForGame(teamSideData.cpuIndex, teamDef) : null;
            if (cpuIdx === null || used[cpuIdx]) {
                cpuIdx = findAvailableRosterIndexForGame(teamDef, used);
            }
            indices.player2 = cpuIdx;
        }

        indices.player1 = clampRosterIndexForGame(indices.player1, teamDef);
        indices.player2 = clampRosterIndexForGame(indices.player2, teamDef);
        return indices;
    }

    function getSessionPlayerAlias(session, playerId) {
        if (!session || !session.players || !playerId)
            return null;
        var profile = session.players[playerId];
        if (!profile)
            return null;
        return profile.displayName || profile.userName || profile.nick || profile.name || profile.alias || playerId;
    }

    function applyMultiplayerControllerLabels(session, assignments) {
        function applyLabel(sprite, playerId) {
            if (!sprite || !sprite.playerData)
                return;
            if (playerId) {
                var alias = getSessionPlayerAlias(session, playerId);
                if (alias)
                    setSpriteControllerLabel(sprite, alias, true);
                else
                    setSpriteControllerLabel(sprite, "CPU", false);
            } else {
                setSpriteControllerLabel(sprite, "CPU", false);
            }
        }

        applyLabel(teamAPlayer1, assignments.teamAPlayer1);
        applyLabel(teamAPlayer2, assignments.teamAPlayer2);
        applyLabel(teamBPlayer1, assignments.teamBPlayer1);
        applyLabel(teamBPlayer2, assignments.teamBPlayer2);
    }

    function initMultiplayerSprites(session, assignments, myId) {
        // Use team names from session
        var redSideData = (session.teams && session.teams.teamA) || { name: "lakers", players: [], roster: {} };
        var blueSideData = (session.teams && session.teams.teamB) || { name: "celtics", players: [], roster: {} };
        var teamATeamName = redSideData.name || "lakers";
        var teamBTeamName = blueSideData.name || "celtics";
        var teamATeamDef = NBATeams[teamATeamName];
        var teamBTeamDef = NBATeams[teamBTeamName];

        var redPlayerIndices = resolveTeamPlayerIndices(redSideData, teamATeamDef);
        var bluePlayerIndices = resolveTeamPlayerIndices(blueSideData, teamBTeamDef);

        // Determine if we're a human player
        var isRedHuman = (assignments.teamAPlayer1 === myId.globalId || assignments.teamAPlayer2 === myId.globalId);

        // Initialize sprites (same as single-player, but mark human/AI appropriately)
        initSprites(
            teamATeamName,
            teamBTeamName,
            redPlayerIndices,
            bluePlayerIndices,
            false, // allCPUMode = false, at least one human
            systems
        );

        // Set controller types based on assignments
        // controllerType: "local" = controlled by this client
        //                 "remote" = controlled by another client
        //                 "ai" = CPU controlled
        // NOTE: Remote players are HUMAN (controlled by another human), not AI!
        if (teamAPlayer1) {
            if (assignments.teamAPlayer1 === myId.globalId) {
                teamAPlayer1.controllerType = "local";
                teamAPlayer1.isHuman = true;
            } else if (assignments.teamAPlayer1) {
                teamAPlayer1.controllerType = "remote";
                teamAPlayer1.isHuman = true; // Remote = human controlled, just not by me
            } else {
                teamAPlayer1.controllerType = "ai";
                teamAPlayer1.isHuman = false;
            }
            teamAPlayer1.controlledBy = assignments.teamAPlayer1 || null;
        }
        if (teamAPlayer2) {
            if (assignments.teamAPlayer2 === myId.globalId) {
                teamAPlayer2.controllerType = "local";
                teamAPlayer2.isHuman = true;
            } else if (assignments.teamAPlayer2) {
                teamAPlayer2.controllerType = "remote";
                teamAPlayer2.isHuman = true; // Remote = human controlled, just not by me
            } else {
                teamAPlayer2.controllerType = "ai";
                teamAPlayer2.isHuman = false;
            }
            teamAPlayer2.controlledBy = assignments.teamAPlayer2 || null;
        }
        if (teamBPlayer1) {
            if (assignments.teamBPlayer1 === myId.globalId) {
                teamBPlayer1.controllerType = "local";
                teamBPlayer1.isHuman = true;
            } else if (assignments.teamBPlayer1) {
                teamBPlayer1.controllerType = "remote";
                teamBPlayer1.isHuman = true; // Remote = human controlled, just not by me
            } else {
                teamBPlayer1.controllerType = "ai";
                teamBPlayer1.isHuman = false;
            }
            teamBPlayer1.controlledBy = assignments.teamBPlayer1 || null;
        }
        if (teamBPlayer2) {
            if (assignments.teamBPlayer2 === myId.globalId) {
                teamBPlayer2.controllerType = "local";
                teamBPlayer2.isHuman = true;
            } else if (assignments.teamBPlayer2) {
                teamBPlayer2.controllerType = "remote";
                teamBPlayer2.isHuman = true; // Remote = human controlled, just not by me
            } else {
                teamBPlayer2.controllerType = "ai";
                teamBPlayer2.isHuman = false;
            }
            teamBPlayer2.controlledBy = assignments.teamBPlayer2 || null;
        }

        applyMultiplayerControllerLabels(session, assignments);
    }

    function createMultiplayerSpriteMap(assignments) {
        var map = {};
        var debugInfo = [];

        // Add ALL sprites to map, using synthetic IDs for AI-controlled sprites
        // This ensures AI sprites can be synced across clients

        if (teamAPlayer1) {
            var red1Id = assignments.teamAPlayer1 || "AI_RED_1";
            map[red1Id] = teamAPlayer1;
            debugInfo.push("Red1: " + red1Id + " -> " + (teamAPlayer1.controllerType || "?"));
        }

        if (teamAPlayer2) {
            var red2Id = assignments.teamAPlayer2 || "AI_RED_2";
            map[red2Id] = teamAPlayer2;
            debugInfo.push("Red2: " + red2Id + " -> " + (teamAPlayer2.controllerType || "?"));
        }

        if (teamBPlayer1) {
            var blue1Id = assignments.teamBPlayer1 || "AI_BLUE_1";
            map[blue1Id] = teamBPlayer1;
            debugInfo.push("Blue1: " + blue1Id + " -> " + (teamBPlayer1.controllerType || "?"));
        }

        if (teamBPlayer2) {
            var blue2Id = assignments.teamBPlayer2 || "AI_BLUE_2";
            map[blue2Id] = teamBPlayer2;
            debugInfo.push("Blue2: " + blue2Id + " -> " + (teamBPlayer2.controllerType || "?"));
        }

        // Verify no duplicate sprite objects in map
        var spriteValues = [];
        var duplicateFound = false;
        for (var gid in map) {
            if (map.hasOwnProperty(gid)) {
                var sprite = map[gid];
                for (var i = 0; i < spriteValues.length; i++) {
                    if (spriteValues[i] === sprite) {
                        log(LOG_ERR, "NBA JAM: DUPLICATE SPRITE IN MAP! GlobalID " + gid + " maps to same sprite as another player");
                        duplicateFound = true;
                    }
                }
                spriteValues.push(sprite);
            }
        }

        log(LOG_DEBUG, "NBA JAM: Sprite map created - " + debugInfo.join(", "));

        return map;
    }

    // Wave 23D Phase 3: Refactored to use unified game loop core
    function runMultiplayerGameLoop(coordinator, playerClient, myId, systems) {
        // Wave 23: Systems are REQUIRED
        if (!systems || !systems.stateManager) {
            throw new Error("ARCHITECTURE ERROR: runMultiplayerGameLoop requires systems parameter");
        }

        var stateManager = systems.stateManager;
        var frameNumber = 0;
        stateManager.set("gameRunning", true, "mp_game_start");
        stateManager.set("lastSecondTime", Date.now(), "mp_game_start");
        stateManager.set("lastUpdateTime", Date.now(), "mp_game_start"); // Initialize to now

        debugLog("[MP GAME LOOP] === GAME LOOP START ===");
        debugLog("[MP GAME LOOP] isCoordinator: " + coordinator.isCoordinator);

        // Configure for multiplayer mode
        var config = {
            isAuthority: coordinator && coordinator.isCoordinator, // Only coordinator runs authoritative logic
            handleInput: function () {
                var key = console.inkey(K_NONE, 0);

                // Handle quit menu (non-blocking to prevent multiplayer desync)
                if (stateManager.get("quitMenuOpen")) {
                    if (key) {
                        var upperKey = key.toUpperCase();
                        if (upperKey === 'Y') {
                            stateManager.set("gameRunning", false, "mp_quit_confirmed");
                        } else if (upperKey === 'N' || upperKey === 'Q') {
                            stateManager.set("quitMenuOpen", false, "mp_quit_cancel");
                        }
                    }
                } else if (key) {
                    if (key.toUpperCase() === 'Q') {
                        stateManager.set("quitMenuOpen", true, "mp_quit_open");
                    } else {
                        // Send input to client for prediction
                        playerClient.handleInput(key, frameNumber);
                    }
                }
            },
            aiInterval: 100, // MP always updates AI (coordinator throttles internally)
            frameDelay: 50   // 20 FPS for multiplayer
        };

        // Main multiplayer loop using unified core
        while (stateManager.get("gameRunning") && !js.terminated) {
            // Coordinator updates network coordination
            if (coordinator && coordinator.isCoordinator) {
                coordinator.update();
            }

            // Run unified game frame
            var result = runGameFrame(systems, config);

            if (result === "halftime") {
                showHalftimeScreen(systems);
                if (!stateManager.get("gameRunning")) break; // User quit during halftime

                // Reset for second half
                if (stateManager.get("pendingSecondHalfInbound")) {
                    startSecondHalfInbound(systems);
                }
                drawCourt(systems);
                drawScore(systems);
                stateManager.set("lastSecondTime", Date.now(), "halftime_reset");
                continue;
            }

            if (result === "game_over") {
                break;
            }

            // Client reconciles with server state
            playerClient.update(frameNumber);

            // Draw network quality HUD
            drawMultiplayerNetworkHUD(playerClient);

            // Draw quit confirmation overlay if open
            if (stateManager.get("quitMenuOpen")) {
                drawQuitMenuOverlay();
            }

            // Frame timing
            systems.frameScheduler.waitForNextFrame(config.frameDelay);
            frameNumber++;
        }
    }

    function drawMultiplayerNetworkHUD(playerClient) {
        if (!playerClient || !scoreFrame) return;

        var display = playerClient.getNetworkDisplay();
        if (!display) return;

        // Draw in top-right corner of score frame
        scoreFrame.gotoxy(60, 1);
        scoreFrame.putmsg(format("NET: %s%s %dms\1n",
            display.color,
            display.bars,
            display.latency), WHITE | BG_BLACK);
    }

    function drawQuitMenuOverlay() {
        // Draw overlay box in center of screen (non-blocking)
        var centerY = Math.floor(console.screen_rows / 2);
        var centerX = Math.floor(console.screen_columns / 2);

        // Build strings without .repeat() (not available in this JS engine)
        var equals = "";
        for (var i = 0; i < 40; i++) equals += "=";
        var spaces38 = "";
        for (var i = 0; i < 38; i++) spaces38 += " ";

        console.gotoxy(centerX - 20, centerY - 3);
        console.print("\1h\1w" + equals + "\1n");

        console.gotoxy(centerX - 20, centerY - 2);
        console.print("\1h\1w|\1n" + spaces38 + "\1h\1w|\1n");

        console.gotoxy(centerX - 20, centerY - 1);
        console.print("\1h\1w|\1n     \1h\1yQuit multiplayer game?\1n          \1h\1w|\1n");

        console.gotoxy(centerX - 20, centerY);
        console.print("\1h\1w|\1n" + spaces38 + "\1h\1w|\1n");

        console.gotoxy(centerX - 20, centerY + 1);
        console.print("\1h\1w|\1n  This will disconnect from session.  \1h\1w|\1n");

        console.gotoxy(centerX - 20, centerY + 2);
        console.print("\1h\1w|\1n" + spaces38 + "\1h\1w|\1n");

        console.gotoxy(centerX - 20, centerY + 3);
        console.print("\1h\1w|\1n      \1h\1wY\1n\1kes / \1h\1wN\1n\1ko / \1h\1wQ\1n\1k=Cancel      \1h\1w|\1n");

        console.gotoxy(centerX - 20, centerY + 4);
        console.print("\1h\1w" + equals + "\1n");
    }

    // Cleanup
    if (ballFrame) ballFrame.close();
    if (teamAPlayer1) teamAPlayer1.remove();
    if (teamAPlayer2) teamAPlayer2.remove();
    if (teamBPlayer1) teamBPlayer1.remove();
    if (teamBPlayer2) teamBPlayer2.remove();
    if (courtFrame) courtFrame.close();
    cleanupScoreFrames();
    if (scoreFrame) scoreFrame.close();
    if (announcerFrame) announcerFrame.close();
}

// Wrap main() with error handler for automatic error logging
var wrappedMain = wrapWithErrorHandler(main, "main");

// Execute wrapped main
try {
    wrappedMain();
} catch (e) {
    // Error already logged by wrapper, show user-friendly message
    if (typeof console !== 'undefined' && console.print) {
        console.print("\r\n\1r\1hFATAL ERROR: Game crashed. Check error.log for details.\1n\r\n");
        console.print("Error: " + e.toString() + "\r\n");
        console.pause();
    } else {
        print("\r\nFATAL ERROR: Game crashed. Check error.log for details.\r\n");
        print("Error: " + e.toString() + "\r\n");
    }
}
