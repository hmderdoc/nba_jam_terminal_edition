// mp-screen-coordinator.js - Multiplayer Screen Coordination
// Handles synchronized screen transitions (splash, matchup, halftime, game over)
// Implements democratic ready-voting with coordinator-enforced timeouts

/**
 * MPScreenCoordinator - Manages multiplayer screen synchronization
 * 
 * Pattern: Coordinator Authority + Client Acknowledgment
 * - Coordinator enters screen, broadcasts state
 * - All clients receive state, show screen
 * - Players vote ready by pressing appropriate key
 * - Coordinator dismisses when all ready OR timeout expires
 * - All clients exit screen via state sync
 * 
 * @param {Object} systems - Game systems (stateManager, eventBus, etc.)
 * @param {Object} mpCoordinator - Multiplayer coordinator instance (null if non-coordinator)
 * @param {Object} playerClient - Multiplayer client instance
 */
function MPScreenCoordinator(systems, mpCoordinator, playerClient) {
    this.systems = systems;
    this.coordinator = mpCoordinator;
    this.client = playerClient;

    // Current screen state
    this.activeScreen = null;      // "splash" | "matchup" | "halftime" | "game_over" | null
    this.screenData = null;        // Screen-specific data (teams, scores, etc.)
    this.readyVotes = {};          // { playerId: boolean }
    this.playerChoices = {};       // { playerId: "choice" } for game over voting
    this.dismissTimer = null;      // Timeout in milliseconds
    this.dismissTimerStart = null; // When screen was entered (for elapsed calc)

    // Screen timeout configurations (milliseconds)
    this.TIMEOUTS = {
        splash: 10000,      // 10 seconds
        matchup: 15000,     // 15 seconds
        halftime: 60000,    // 60 seconds (1 minute)
        game_over: 120000   // 120 seconds (2 minutes)
    };

    debugLog("[MP SCREEN] Coordinator initialized, isCoordinator=" + !!(mpCoordinator && mpCoordinator.isCoordinator));
}

/**
 * Coordinator enters a screen
 * Only coordinator can call this - broadcasts to all clients via state sync
 * 
 * @param {string} screenType - Screen identifier
 * @param {Object} data - Screen-specific data to broadcast
 * @param {number} timeoutOverride - Optional timeout override (ms)
 */
MPScreenCoordinator.prototype.enterScreen = function (screenType, data, timeoutOverride) {
    if (!this.coordinator || !this.coordinator.isCoordinator) {
        debugLog("[MP SCREEN] ERROR: Only coordinator can call enterScreen");
        return false;
    }

    debugLog("[MP SCREEN] Coordinator entering screen: " + screenType);

    this.activeScreen = screenType;
    this.screenData = data || {};
    this.dismissTimer = timeoutOverride || this.TIMEOUTS[screenType] || 30000;
    this.dismissTimerStart = Date.now();
    this.readyVotes = {};
    this.playerChoices = {};

    // Initialize votes for all players in session
    var session = this.coordinator.session;
    if (session && session.playerList) {
        for (var i = 0; i < session.playerList.length; i++) {
            var playerId = session.playerList[i];
            this.readyVotes[playerId] = false;
            this.playerChoices[playerId] = null;
        }
        debugLog("[MP SCREEN] Initialized votes for " + session.playerList.length + " players");
    }

    // Broadcast immediately so clients can enter screen
    this.broadcastScreenState();

    return true;
};

/**
 * Vote ready to dismiss screen
 * Can be called by coordinator or non-coordinator
 * 
 * @param {string} playerId - Player's global ID
 * @param {string} choice - Optional choice for game over (quit/play_again/new_teams)
 */
MPScreenCoordinator.prototype.setReady = function (playerId, choice) {
    if (!playerId) {
        debugLog("[MP SCREEN] ERROR: setReady called without playerId");
        return;
    }

    if (this.coordinator && this.coordinator.isCoordinator) {
        // Coordinator updates vote directly
        this.readyVotes[playerId] = true;
        if (choice) {
            this.playerChoices[playerId] = choice;
        }
        debugLog("[MP SCREEN] Coordinator recorded ready vote from " + playerId + (choice ? " (choice: " + choice + ")" : ""));
        this.broadcastScreenState();
    } else if (this.client) {
        // Non-coordinator sends vote via coordinator
        debugLog("[MP SCREEN] Non-coordinator sending ready vote");
        this.client.sendScreenReadyVote(playerId, choice);
    }
};

/**
 * Check if screen can be dismissed
 * Coordinator-only: Checks all votes and timeout
 * 
 * @returns {boolean} True if can dismiss
 */
MPScreenCoordinator.prototype.canDismiss = function () {
    if (!this.activeScreen) return true;
    if (!this.coordinator || !this.coordinator.isCoordinator) return false;

    // Check timeout
    var elapsed = Date.now() - this.dismissTimerStart;
    if (elapsed >= this.dismissTimer) {
        debugLog("[MP SCREEN] Auto-dismiss: timeout after " + elapsed + "ms");
        return true;
    }

    // Get currently active players (exclude disconnected)
    var activePlayers = this.getActivePlayers();
    if (activePlayers.length === 0) {
        debugLog("[MP SCREEN] Auto-dismiss: no active players");
        return true;
    }

    // Check if all active players are ready
    var readyCount = 0;
    for (var i = 0; i < activePlayers.length; i++) {
        var playerId = activePlayers[i];
        if (this.readyVotes[playerId]) {
            readyCount++;
        }
    }

    var allReady = (readyCount === activePlayers.length);
    if (allReady) {
        debugLog("[MP SCREEN] All players ready (" + readyCount + "/" + activePlayers.length + ")");
    }

    return allReady;
};

/**
 * Get list of currently active (connected) players
 * Used to exclude disconnected players from vote requirements
 * 
 * @returns {Array} Array of active player IDs
 */
MPScreenCoordinator.prototype.getActivePlayers = function () {
    var active = [];

    if (!this.coordinator || !this.coordinator.session) {
        return active;
    }

    var session = this.coordinator.session;
    if (!session.playerList) return active;

    for (var i = 0; i < session.playerList.length; i++) {
        var playerId = session.playerList[i];

        // Check if player's input queue still exists (indicates connection)
        if (this.coordinator.playerInputQueues && this.coordinator.playerInputQueues[playerId]) {
            active.push(playerId);
        }
    }

    debugLog("[MP SCREEN] Active players: " + active.length + "/" + session.playerList.length);
    return active;
};

/**
 * Dismiss screen (coordinator only)
 * Clears screen state and broadcasts to all clients
 */
MPScreenCoordinator.prototype.dismissScreen = function () {
    if (!this.coordinator || !this.coordinator.isCoordinator) {
        debugLog("[MP SCREEN] ERROR: Only coordinator can dismiss screen");
        return false;
    }

    debugLog("[MP SCREEN] Coordinator dismissing screen: " + this.activeScreen);

    this.activeScreen = null;
    this.screenData = null;
    this.readyVotes = {};
    this.playerChoices = {};
    this.dismissTimer = null;
    this.dismissTimerStart = null;

    this.broadcastScreenState();
    return true;
};

/**
 * Broadcast current screen state via coordinator
 * Integrates with existing state sync mechanism
 */
MPScreenCoordinator.prototype.broadcastScreenState = function () {
    if (!this.coordinator || !this.coordinator.isCoordinator) return;

    var stateManager = this.systems.stateManager;

    var screenState = this.activeScreen ? {
        active: this.activeScreen,
        data: this.screenData,
        votes: this.readyVotes,
        choices: this.playerChoices,
        timeout: this.dismissTimer,
        start: this.dismissTimerStart
    } : null;

    stateManager.set("mpScreen", screenState, "mp_screen_broadcast");

    // Force immediate state broadcast
    if (this.coordinator.broadcastState) {
        this.coordinator.broadcastState();
    }
};

/**
 * Handle screen state update (non-coordinator)
 * Called from mp_client.js updateGameState()
 * Returns action signal for main loop to handle
 * 
 * @param {Object} screenState - Screen state from coordinator
 * @returns {Object} Action signal { action: "enter"|"update"|"dismiss", ... }
 */
MPScreenCoordinator.prototype.handleScreenState = function (screenState) {
    // Screen dismissed
    if (!screenState || !screenState.active) {
        if (this.activeScreen) {
            var previousScreen = this.activeScreen;
            debugLog("[MP SCREEN] Non-coordinator detected screen dismissal: " + previousScreen);

            this.activeScreen = null;
            this.screenData = null;
            this.readyVotes = {};
            this.playerChoices = {};
            this.dismissTimer = null;
            this.dismissTimerStart = null;

            return { action: "dismiss", screen: previousScreen };
        }
        return null;
    }

    // Screen entered (transition from null to active)
    if (!this.activeScreen && screenState.active) {
        debugLog("[MP SCREEN] Non-coordinator entering screen: " + screenState.active);

        this.activeScreen = screenState.active;
        this.screenData = screenState.data || {};
        this.readyVotes = screenState.votes || {};
        this.playerChoices = screenState.choices || {};
        this.dismissTimer = screenState.timeout;
        this.dismissTimerStart = screenState.start;

        return {
            action: "enter",
            screen: screenState.active,
            data: this.screenData
        };
    }

    // Screen state updated (votes changed)
    if (this.activeScreen === screenState.active) {
        this.readyVotes = screenState.votes || {};
        this.playerChoices = screenState.choices || {};

        return {
            action: "update",
            votes: this.readyVotes,
            choices: this.playerChoices
        };
    }

    return null;
};

/**
 * Get time remaining until auto-dismiss (seconds)
 * 
 * @returns {number} Seconds remaining, or 0 if no active screen
 */
MPScreenCoordinator.prototype.getTimeRemaining = function () {
    if (!this.activeScreen || !this.dismissTimerStart || !this.dismissTimer) {
        return 0;
    }

    var elapsed = Date.now() - this.dismissTimerStart;
    var remaining = this.dismissTimer - elapsed;

    return Math.max(0, Math.ceil(remaining / 1000));
};

/**
 * Get ready status for all players
 * 
 * @returns {Object} { readyCount: number, totalPlayers: number, votes: Object }
 */
MPScreenCoordinator.prototype.getReadyStatus = function () {
    var readyCount = 0;
    var totalPlayers = 0;

    for (var playerId in this.readyVotes) {
        if (this.readyVotes.hasOwnProperty(playerId)) {
            totalPlayers++;
            if (this.readyVotes[playerId]) {
                readyCount++;
            }
        }
    }

    return {
        readyCount: readyCount,
        totalPlayers: totalPlayers,
        votes: this.readyVotes
    };
};

/**
 * Tally votes for game over screen (quit/play_again/new_teams)
 * 
 * @returns {string} Winning choice: "quit", "play_again", or "new_teams"
 */
MPScreenCoordinator.prototype.tallyGameOverVotes = function () {
    var votes = {
        quit: 0,
        play_again: 0,
        new_teams: 0
    };

    var coordinatorChoice = null;
    var totalVotes = 0;

    for (var playerId in this.playerChoices) {
        if (this.playerChoices.hasOwnProperty(playerId)) {
            var choice = this.playerChoices[playerId];
            if (choice) {
                totalVotes++;
                votes[choice] = (votes[choice] || 0) + 1;

                // Track coordinator's vote for tiebreaker
                if (this.coordinator && this.coordinator.isCoordinator) {
                    var session = this.coordinator.session;
                    if (session && session.coordinator === playerId) {
                        coordinatorChoice = choice;
                    }
                }
            }
        }
    }

    debugLog("[MP SCREEN] Game over votes - Quit:" + votes.quit + " Play:" + votes.play_again + " NewTeams:" + votes.new_teams);

    // Any quit vote = everyone quits (safety first)
    if (votes.quit > 0) {
        debugLog("[MP SCREEN] Game over decision: QUIT (any quit vote wins)");
        return "quit";
    }

    // Majority wins between play_again and new_teams
    if (votes.play_again > votes.new_teams) {
        debugLog("[MP SCREEN] Game over decision: PLAY_AGAIN (majority)");
        return "play_again";
    }

    if (votes.new_teams > votes.play_again) {
        debugLog("[MP SCREEN] Game over decision: NEW_TEAMS (majority)");
        return "new_teams";
    }

    // Tie: coordinator's vote wins
    if (coordinatorChoice) {
        debugLog("[MP SCREEN] Game over decision: " + coordinatorChoice.toUpperCase() + " (coordinator tiebreaker)");
        return coordinatorChoice;
    }

    // No votes or no coordinator vote: default to quit
    debugLog("[MP SCREEN] Game over decision: QUIT (default)");
    return "quit";
};

/**
 * Check if player is ready
 * 
 * @param {string} playerId - Player's global ID
 * @returns {boolean} True if player has voted ready
 */
MPScreenCoordinator.prototype.isPlayerReady = function (playerId) {
    return !!(this.readyVotes[playerId]);
};

/**
 * Check if screen is currently active
 * 
 * @param {string} screenType - Optional screen type to check
 * @returns {boolean} True if screen is active (and matches type if provided)
 */
MPScreenCoordinator.prototype.isScreenActive = function (screenType) {
    if (!this.activeScreen) return false;
    if (screenType) return this.activeScreen === screenType;
    return true;
};
