// mp_lobby.js - NBA JAM Multiplayer Lobby
// Players meet, chat, create/join games, select teams

// Note: sbbsdefs.js, frame.js already loaded by main nba_jam.js
// load("sbbsdefs.js");
// load("frame.js");
load("json-chat.js"); // Uses stock Synchronet json-chat.js

load(js.exec_dir + "lib/multiplayer/mp_identity.js");
load(js.exec_dir + "lib/multiplayer/mp_team_data.js");
load(js.exec_dir + "lib/multiplayer/mp_config.js");
load(js.exec_dir + "lib/multiplayer/mp_sessions.js");
load(js.exec_dir + "lib/multiplayer/mp_network.js");

var LOBBY_VERSION = "1.0";

// Lobby state constants
var LOBBY_STATE = {
    SERVER_SELECT: "server_select",
    MAIN_LOBBY: "main_lobby",
    SESSION_LOBBY: "session_lobby",
    TEAM_SELECT: "team_select",
    STARTING: "starting"
};

function NBAJamLobby() {
    this.state = LOBBY_STATE.SERVER_SELECT;
    this.serverConfig = null;
    this.client = null;
    this.chat = null;
    this.myId = createPlayerIdentifier();
    this.currentSession = null;
    this.sessions = [];
    this.selectedSessionIndex = 0;

    // UI Frames
    this.mainFrame = null;
    this.chatFrame = null;
    this.listFrame = null;
    this.statusFrame = null;
    this.inputLine = "";
    this.inputCursor = 0;

    // Display settings
    this.screenWidth = 80;
    this.screenHeight = 24;
    this.chatHeight = 10;
    this.listHeight = 8;

    // Network monitor
    this.networkMonitor = null;

    // Refresh timers
    this.lastSessionRefresh = 0;
    this.sessionRefreshInterval = 2000; // 2 seconds
    this.lastChatUpdate = 0;
    this.chatUpdateInterval = 500; // 0.5 seconds
    this.lastCleanup = 0;
    this.cleanupInterval = 60000; // 1 minute
    this.cleanupMaxAge = 15 * 60 * 1000; // 15 minutes
    this.teamMap = MPTeamData.load();
    this.teamSummary = MPTeamData.getTeamNamesSummary();
    if (this.teamSummary.length > 80)
        this.teamSummary = this.teamSummary.substring(0, 80);
    this.statusMessage = "";
    this.statusMessageExpire = 0;

    this.setStatusMessage = function (message, durationMs) {
        this.statusMessage = message || "";
        var duration = durationMs || 6000;
        this.statusMessageExpire = Date.now() + duration;
    };

    this.teamSelect = {
        active: false,
        index: 0,
        rosterIndex: 0,
        manualRoster: false,
        teamList: MPTeamData.listTeams(),
        selectedTeamKey: null,
        session: null,
        mySide: null
    };

    function clampRosterIndexLocal(teamDef, index) {
        if (!teamDef || !teamDef.players || teamDef.players.length === 0)
            return 0;
        var value = parseInt(index, 10);
        if (isNaN(value)) value = 0;
        if (value < 0) value = 0;
        if (value >= teamDef.players.length) value = teamDef.players.length - 1;
        return value;
    }

    function findAvailableRosterIndexLocal(teamDef, used) {
        if (!teamDef || !teamDef.players || teamDef.players.length === 0)
            return 0;
        for (var i = 0; i < teamDef.players.length; i++) {
            if (!used || !used[i])
                return i;
        }
        return 0;
    }

    this.openTeamSelect = function () {
        if (!this.currentSession) {
            this.setStatusMessage("Join a session before selecting a team.");
            return;
        }
        this.teamSelect.teamList = MPTeamData.listTeams();
        this.inputLine = "";
        if (!this.refreshTeamSelectSession(true))
            return;
        this.teamSelect.active = true;
        this.state = LOBBY_STATE.TEAM_SELECT;
    };

    this.closeTeamSelect = function (message) {
        this.teamSelect.active = false;
        this.state = LOBBY_STATE.SESSION_LOBBY;
        this.lastSessionRefresh = 0;
        this.teamSelect.manualRoster = false;
        if (message)
            this.setStatusMessage(message);
    };

    this.refreshTeamSelectSession = function (forceDefaults) {
        if (!this.currentSession) {
            this.closeTeamSelect();
            return false;
        }
        var session = this.client.read("nba_jam", "lobby.sessions." + this.currentSession, 1);
        if (!session) {
            this.closeTeamSelect("Session unavailable.");
            return false;
        }
        ensureTeamContainers(session);
        this.teamSelect.session = session;
        this.teamSelect.teamList = MPTeamData.listTeams();

        var myId = this.myId.globalId;
        var mySide = null;
        if (session.teams.teamA.players.indexOf(myId) !== -1)
            mySide = "teamA";
        else if (session.teams.teamB.players.indexOf(myId) !== -1)
            mySide = "teamB";
        this.teamSelect.mySide = mySide;

        if (forceDefaults) {
            var defaultKey = null;
            var defaultRoster = 0;
            if (mySide === "teamA" && session.teams.teamA.name) {
                defaultKey = session.teams.teamA.name;
                var redChoice = session.teams.teamA.roster[myId];
                if (redChoice && typeof redChoice.index === "number")
                    defaultRoster = redChoice.index;
            } else if (mySide === "teamB" && session.teams.teamB.name) {
                defaultKey = session.teams.teamB.name;
                var blueChoice = session.teams.teamB.roster[myId];
                if (blueChoice && typeof blueChoice.index === "number")
                    defaultRoster = blueChoice.index;
            }

            if (!defaultKey && this.teamSelect.teamList.length > 0) {
                var opponentSide = mySide === "teamA" ? "teamB" : (mySide === "teamB" ? "teamA" : null);
                for (var i = 0; i < this.teamSelect.teamList.length; i++) {
                    var entry = this.teamSelect.teamList[i];
                    var key = entry.key;
                    var teamACount = (session.teams.teamA.name === key) ? session.teams.teamA.players.length : 0;
                    var teamBCount = (session.teams.teamB.name === key) ? session.teams.teamB.players.length : 0;
                    var total = teamACount + teamBCount;
                    if (total >= 2)
                        continue;
                    if (opponentSide && session.teams[opponentSide].name === key && mySide === null) {
                        // allow joining as teammate
                    }
                    defaultKey = key;
                    break;
                }
                if (!defaultKey)
                    defaultKey = this.teamSelect.teamList[0].key;
            }

            if (defaultKey) {
                for (var idx = 0; idx < this.teamSelect.teamList.length; idx++) {
                    if (this.teamSelect.teamList[idx].key === defaultKey) {
                        this.teamSelect.index = idx;
                        break;
                    }
                }
            } else {
                this.teamSelect.index = 0;
            }

            this.teamSelect.rosterIndex = defaultRoster;
            this.teamSelect.manualRoster = false;
        }

        this.ensureTeamSelectIndices({ preserveManual: !forceDefaults });
        return true;
    };

    this.ensureTeamSelectIndices = function (options) {
        options = options || {};
        var preserveManual = !!options.preserveManual && this.teamSelect.manualRoster;
        var teamList = this.teamSelect.teamList;
        if (!teamList || teamList.length === 0)
            return;
        if (this.teamSelect.index < 0)
            this.teamSelect.index = 0;
        if (this.teamSelect.index >= teamList.length)
            this.teamSelect.index = teamList.length - 1;

        var entry = teamList[this.teamSelect.index];
        if (!entry)
            return;
        var key = entry.key;
        this.teamSelect.selectedTeamKey = key;

        var session = this.teamSelect.session;
        if (!session)
            return;

        var teamDef = MPTeamData.getTeam(key);
        var myId = this.myId.globalId;
        var red = session.teams.teamA;
        var blue = session.teams.teamB;
        var newSide = null;
        var newRosterIndex = this.teamSelect.rosterIndex;

        if (red.name === key && red.players.indexOf(myId) !== -1) {
            newSide = "teamA";
            var redChoice = red.roster[myId];
            if (redChoice && typeof redChoice.index === "number")
                newRosterIndex = clampRosterIndexLocal(teamDef, redChoice.index);
        } else if (blue.name === key && blue.players.indexOf(myId) !== -1) {
            newSide = "teamB";
            var blueChoice = blue.roster[myId];
            if (blueChoice && typeof blueChoice.index === "number")
                newRosterIndex = clampRosterIndexLocal(teamDef, blueChoice.index);
        } else if (!preserveManual) {
            var used = {};
            if (red.name === key && red.roster) {
                for (var pid in red.roster) {
                    if (!red.roster.hasOwnProperty(pid)) continue;
                    var rsel = red.roster[pid];
                    if (rsel && typeof rsel.index === "number")
                        used[clampRosterIndexLocal(teamDef, rsel.index)] = true;
                }
            }
            if (blue.name === key && blue.roster) {
                for (var pid2 in blue.roster) {
                    if (!blue.roster.hasOwnProperty(pid2)) continue;
                    var bsel = blue.roster[pid2];
                    if (bsel && typeof bsel.index === "number")
                        used[clampRosterIndexLocal(teamDef, bsel.index)] = true;
                }
            }
            if (red.name === key && red.cpuIndex !== null)
                used[clampRosterIndexLocal(teamDef, red.cpuIndex)] = true;
            if (blue.name === key && blue.cpuIndex !== null)
                used[clampRosterIndexLocal(teamDef, blue.cpuIndex)] = true;
            newRosterIndex = findAvailableRosterIndexLocal(teamDef, used);
        } else {
            newRosterIndex = clampRosterIndexLocal(teamDef, newRosterIndex);
        }

        this.teamSelect.mySide = newSide;
        this.teamSelect.rosterIndex = clampRosterIndexLocal(teamDef, newRosterIndex);
    };

    this.moveTeamSelection = function (delta) {
        if (!this.teamSelect.active)
            return;
        var teamList = this.teamSelect.teamList;
        if (!teamList || teamList.length === 0)
            return;
        var length = teamList.length;
        var newIndex = (this.teamSelect.index + delta) % length;
        if (newIndex < 0)
            newIndex += length;
        if (newIndex !== this.teamSelect.index) {
            this.teamSelect.index = newIndex;
            this.teamSelect.manualRoster = false;
            this.ensureTeamSelectIndices({ preserveManual: false });
        }
    };

    this.adjustRosterIndex = function (delta) {
        if (!this.teamSelect.active)
            return;
        var entry = this.teamSelect.teamList[this.teamSelect.index];
        if (!entry)
            return;
        var teamDef = MPTeamData.getTeam(entry.key);
        if (!teamDef || !teamDef.players || teamDef.players.length === 0)
            return;
        var length = teamDef.players.length;
        var newIndex = (this.teamSelect.rosterIndex + delta) % length;
        if (newIndex < 0)
            newIndex += length;
        this.teamSelect.rosterIndex = newIndex;
        this.teamSelect.manualRoster = true;
    };

    this.setRosterIndex = function (index) {
        if (!this.teamSelect.active)
            return;
        var entry = this.teamSelect.teamList[this.teamSelect.index];
        if (!entry)
            return;
        var teamDef = MPTeamData.getTeam(entry.key);
        if (!teamDef || !teamDef.players || teamDef.players.length === 0)
            return;
        this.teamSelect.rosterIndex = clampRosterIndexLocal(teamDef, index);
        this.teamSelect.manualRoster = true;
    };

    this.confirmTeamSelection = function () {
        if (!this.teamSelect.active || !this.currentSession)
            return;
        var entry = this.teamSelect.teamList[this.teamSelect.index];
        if (!entry) {
            this.setStatusMessage("Invalid team selection.");
            return;
        }
        var result;
        try {
            result = selectTeamAndPlayer(this.client, this.currentSession, entry.key, this.teamSelect.rosterIndex);
        } catch (err) {
            result = { success: false, error: "Team selection failed." };
        }
        this.lastSessionRefresh = 0;
        if (result && result.success) {
            if (result.cleared) {
                this.closeTeamSelect("Selection cleared.");
            } else {
                var msg = "Joined " + (result.teamName || entry.name) + " as " + (result.playerName || ("Player " + (this.teamSelect.rosterIndex + 1))) + ".";
                this.closeTeamSelect(msg);
            }
        } else {
            var errorMsg = (result && result.error) ? result.error : "Unable to select team.";
            this.setStatusMessage(errorMsg);
            this.refreshTeamSelectSession(false);
        }
    };

    this.clearTeamSelection = function () {
        if (!this.teamSelect.active || !this.currentSession)
            return;
        var result;
        try {
            result = selectTeamAndPlayer(this.client, this.currentSession, "", 0);
        } catch (err) {
            result = { success: false, error: "Unable to clear selection." };
        }
        this.lastSessionRefresh = 0;
        if (result && result.success && result.cleared) {
            this.closeTeamSelect("Selection cleared.");
        } else if (result && result.success) {
            this.closeTeamSelect("Selection updated.");
        } else {
            var errorMsg = (result && result.error) ? result.error : "Unable to clear selection.";
            this.setStatusMessage(errorMsg);
            this.refreshTeamSelectSession(false);
        }
    };

    // Initialize lobby
    this.init = function () {
        console.clear();
        bbs.sys_status |= SS_MOFF; // Disable mouse
        bbs.sys_status |= SS_PAUSEOFF; // Disable pause

        // Show splash screen
        this.showSplash();

        // Server selection
        this.serverConfig = this.selectServerInteractive();
        if (!this.serverConfig) {
            return false; // User cancelled
        }

        // Connect to server
        if (!this.connectToServer()) {
            return false;
        }

        // Initialize frames
        this.initFrames();

        // Join lobby chat
        this.chat.join(MP_CHAT_CHANNEL);

        // Set state
        this.state = LOBBY_STATE.MAIN_LOBBY;

        return true;
    };

    // Show splash screen
    this.showSplash = function () {
        console.clear();

        // Check for custom splash
        var splashFile = new File(js.exec_dir + "mp_lobby.ans");
        if (splashFile.exists) {
            console.printfile(splashFile.name);
            mswait(2000);
            return;
        }

        // Default splash
        console.center("\x01h\x01rN\x01yB\x01wA \x01cJ\x01gA\x01mM\x01n");
        console.crlf();
        console.center("\x01n\x01wMultiplayer Lobby");
        console.crlf();
        console.center("\x01n\x01kVersion " + LOBBY_VERSION);
        console.crlf(2);
        mswait(1500);
    };

    // Interactive server selection
    this.selectServerInteractive = function () {
        // First preference: explicit saved choice from previous session
        var config = loadServerPreference();
        if (config) {
            return config;
        }

        // Second preference: default server declared in configuration
        loadCustomConfig();
        if (MP_CONFIG && MP_CONFIG.defaultServerId && MP_CONFIG.servers[MP_CONFIG.defaultServerId]) {
            return {
                id: MP_CONFIG.defaultServerId,
                server: MP_CONFIG.servers[MP_CONFIG.defaultServerId],
                tuning: MP_CONFIG.tuning[MP_CONFIG.defaultServerId] || MP_CONFIG.tuning.interbbs
            };
        }

        // Final fallback: first available server entry
        for (var serverId in MP_CONFIG.servers) {
            if (MP_CONFIG.servers.hasOwnProperty(serverId)) {
                return {
                    id: serverId,
                    server: MP_CONFIG.servers[serverId],
                    tuning: MP_CONFIG.tuning[serverId] || MP_CONFIG.tuning.interbbs
                };
            }
        }

        // No servers configured - prompt interactively (legacy behaviour)
        return selectServer();
    };

    // Connect to JSON server
    this.connectToServer = function () {
        console.clear();
        console.print("\x01h\x01cConnecting to \x01w" + this.serverConfig.server.name + "\x01c...\x01n\r\n");
        console.print("Server: " + this.serverConfig.server.addr + ":" + this.serverConfig.server.port + "\r\n\r\n");

        try {
            this.client = new JSONClient(
                this.serverConfig.server.addr,
                this.serverConfig.server.port
            );

            // Check if connected (client auto-connects on creation)
            if (!this.client.connected) {
                console.print("\x01r\x01hConnection failed!\x01n\r\n\r\n");
                console.print("Press any key to continue...");
                console.getkey();
                return false;
            }

            // Initialize chat
            this.chat = new JSONChat(user.number, this.client);

            // Initialize network monitor
            this.networkMonitor = new NetworkMonitor(this.client, "lobby");

            console.print("\x01g\x01hConnected!\x01n\r\n");

            // Measure latency
            console.print("Measuring connection quality... ");
            var latency = measureLatency(this.client, 3);
            this.networkMonitor.addLatencySample(latency);

            var display = this.networkMonitor.getQualityDisplay();
            console.print(format("%s%s %dms\x01n\r\n\r\n",
                display.color, display.bars, latency));

            mswait(1000);

            return true;

        } catch (e) {
            console.print("\x01r\x01hError: " + e + "\x01n\r\n\r\n");
            console.print("Press any key to continue...");
            console.getkey();
            return false;
        }
    };

    // Initialize UI frames
    this.initFrames = function () {
        this.mainFrame = new Frame(1, 1, this.screenWidth, this.screenHeight, BG_BLACK | LIGHTGRAY);
        this.mainFrame.open();

        // Title bar
        var titleFrame = new Frame(1, 1, this.screenWidth, 1, BG_BLUE | WHITE, this.mainFrame);
        titleFrame.putmsg(this.centerText("NBA JAM - Multiplayer Lobby", this.screenWidth), BG_BLUE | YELLOW | HIGH);
        titleFrame.open();

        // Chat area
        this.chatFrame = new Frame(1, 2, this.screenWidth, this.chatHeight, BG_BLACK | LIGHTGRAY, this.mainFrame);
        this.chatFrame.open();

        // Session list area
        var listY = 2 + this.chatHeight;
        this.listFrame = new Frame(1, listY, this.screenWidth, this.listHeight, BG_BLACK | LIGHTGRAY, this.mainFrame);
        this.listFrame.open();

        // Status bar
        var statusY = listY + this.listHeight;
        this.statusFrame = new Frame(1, statusY, this.screenWidth, this.screenHeight - statusY + 1, BG_BLACK | LIGHTGRAY, this.mainFrame);
        this.statusFrame.open();

        // Input line (at bottom)
        this.inputY = this.screenHeight;
    };

    // Main lobby loop
    this.run = function () {
        if (!this.init()) {
            return null; // Connection failed or user cancelled
        }

        var running = true;
        var result = null;
        var preserveConnection = false;

        while (running && !js.terminated) {
            // Update network monitor
            if (this.networkMonitor) {
                this.networkMonitor.ping();
            }

            // Update based on state
            switch (this.state) {
                case LOBBY_STATE.MAIN_LOBBY:
                    this.updateMainLobby();
                    break;

                case LOBBY_STATE.SESSION_LOBBY:
                    this.updateSessionLobby();
                    break;

                case LOBBY_STATE.TEAM_SELECT:
                    this.updateTeamSelect();
                    break;

                case LOBBY_STATE.STARTING:
                    result = this.startGame();
                    if (result) {
                        preserveConnection = true;
                        running = false;
                    } else {
                        // If start failed, return to lobby view
                        this.state = LOBBY_STATE.SESSION_LOBBY;
                    }
                    break;
            }

            // Render
            this.render();

            // Handle input
            var key = console.inkey(K_NONE, 50); // 50ms timeout
            if (key) {
                var action = this.handleInput(key);
                if (action === "quit") {
                    running = false;
                }
            }

            // Update chat
            this.updateChat();

            // Cycle client
            if (this.client) {
                this.client.cycle();
            }

            mswait(10);
        }

        this.cleanup(preserveConnection);
        return result;
    };

    // Update main lobby
    this.updateMainLobby = function () {
        var now = Date.now();

        if (now - this.lastSessionRefresh > this.sessionRefreshInterval) {
            this.refreshSessions();
            this.lastSessionRefresh = now;
        }
    };

    // Update session lobby (inside a game session)
    this.updateSessionLobby = function () {
        if (!this.currentSession) {
            this.state = LOBBY_STATE.MAIN_LOBBY;
            return;
        }

        // Refresh session data
        var session = this.client.read("nba_jam", "lobby.sessions." + this.currentSession, 1);

        if (!session) {
            // Session disappeared
            this.currentSession = null;
            this.state = LOBBY_STATE.MAIN_LOBBY;
            return;
        }

        // Check if game is starting or already started
        if (session.status === SESSION_STATUS.READY || session.status === SESSION_STATUS.PLAYING) {
            // All players ready or coordinator already started, transition to starting
            this.state = LOBBY_STATE.STARTING;
        }
    };

    // Update team select
    this.updateTeamSelect = function () {
        // Team selection handled in input
    };

    // Refresh session list
    this.refreshSessions = function () {
        var now = Date.now();
        if (this.client && now - this.lastCleanup > this.cleanupInterval) {
            cleanupOldSessions(this.client, this.cleanupMaxAge);
            this.lastCleanup = now;
        }
        this.sessions = listGameSessions(this.client, {
            status: SESSION_STATUS.WAITING,
            hasSpace: true
        });
    };

    // Update chat display
    this.updateChat = function () {
        var now = Date.now();

        if (now - this.lastChatUpdate < this.chatUpdateInterval) {
            return;
        }

        this.lastChatUpdate = now;

        var channelKey = MP_CHAT_CHANNEL.toUpperCase();
        if (!this.chat || !this.chat.channels || !this.chat.channels[channelKey]) {
            return;
        }

        var channel = this.chat.channels[channelKey];
        var messages = channel.messages || [];

        // Render last N messages
        this.chatFrame.clear();
        this.chatFrame.home();

        var startIndex = Math.max(0, messages.length - (this.chatHeight - 1));

        for (var i = startIndex; i < messages.length; i++) {
            var msg = messages[i];

            if (!msg.nick || !msg.nick.name) {
                // System message
                this.chatFrame.putmsg("\x01n\x01k[" + msg.msg + "]\x01n\r\n");
            } else {
                // Player message
                var displayName = msg.nick.name;
                if (displayName.length > 12) {
                    displayName = displayName.substring(0, 12);
                }

                this.chatFrame.putmsg(format("\x01h\x01c%-12s\x01n\x01w %s\x01n\r\n",
                    displayName,
                    msg.msg));
            }
        }

        this.chatFrame.invalidate();
    };

    // Render UI
    this.render = function () {
        switch (this.state) {
            case LOBBY_STATE.MAIN_LOBBY:
                this.renderMainLobby();
                break;

            case LOBBY_STATE.SESSION_LOBBY:
                this.renderSessionLobby();
                break;

            case LOBBY_STATE.TEAM_SELECT:
                this.renderTeamSelect();
                break;
        }

        this.renderStatusBar();
        this.renderInputLine();

        if (this.mainFrame) {
            this.mainFrame.cycle();
        }
    };

    // Render main lobby
    this.renderMainLobby = function () {
        if (!this.listFrame) return;

        this.listFrame.clear();
        this.listFrame.home();

        // Count total players in sessions
        var totalPlayers = 0;
        for (var i = 0; i < this.sessions.length; i++) {
            totalPlayers += this.sessions[i].playerCount;
        }

        // Header
        this.listFrame.putmsg(format("\x01h\x01w Available Games: \x01c%d\x01w  Players Online: \x01c%d\x01n\r\n",
            this.sessions.length, totalPlayers), WHITE | BG_BLACK);
        this.listFrame.putmsg(format("\x01n\x01w%-4s %-20s %-10s %-8s\x01n\r\n",
            "##", "Host", "Players", "Age"), LIGHTGRAY | BG_BLACK);

        if (this.sessions.length === 0) {
            this.listFrame.putmsg("\x01n\x01k  No games available. Press \x01h\x01wC\x01n\x01k to create one.\x01n\r\n");
        } else {
            var displayCount = Math.min(this.sessions.length, this.listHeight - 3);
            var startIndex = Math.max(0, this.selectedSessionIndex - displayCount + 1);

            for (var i = startIndex; i < Math.min(startIndex + displayCount, this.sessions.length); i++) {
                var game = this.sessions[i];
                var selected = (i === this.selectedSessionIndex);

                var age = Math.floor(game.age / 1000);
                var ageStr = age < 60 ? age + "s" : Math.floor(age / 60) + "m";

                var attr = selected ? (YELLOW | BG_BLUE) : (LIGHTGRAY | BG_BLACK);

                this.listFrame.putmsg(format("%-4d %-20s %-10s %-8s\r\n",
                    i + 1,
                    game.host.substring(0, 20),
                    game.playerCount + "/" + game.maxPlayers,
                    ageStr), attr);
            }
        }

        this.listFrame.invalidate();
    };

    // Render session lobby
    this.renderSessionLobby = function () {
        if (!this.listFrame || !this.currentSession) return;

        var session = this.client.read("nba_jam", "lobby.sessions." + this.currentSession, 1);
        if (!session) return;
        ensureTeamContainers(session);

        this.listFrame.clear();
        this.listFrame.home();

        // Session info
        this.listFrame.putmsg(format("\x01h\x01wGame: \x01c%s\x01n\r\n", this.currentSession.substring(0, 40)), WHITE | BG_BLACK);
        this.listFrame.putmsg(format("\x01n\x01wHost: \x01c%s\x01n\r\n", session.hostPlayer.displayName), LIGHTGRAY | BG_BLACK);
        this.listFrame.putmsg("\x01n\x01w-------------------------------------------------\x01n\r\n", LIGHTGRAY | BG_BLACK);

        var teamATeamData = (session.teams && session.teams.teamA) || { name: null, players: [], roster: {} };
        var teamBTeamData = (session.teams && session.teams.teamB) || { name: null, players: [], roster: {} };
        var teamATeamDef = teamATeamData.name ? MPTeamData.getTeam(teamATeamData.name) : null;
        var teamBTeamDef = teamBTeamData.name ? MPTeamData.getTeam(teamBTeamData.name) : null;
        var teamATeamName = teamATeamDef ? teamATeamDef.name : (teamATeamData.name ? teamATeamData.name.toUpperCase() : "(Select team)");
        var teamBTeamName = teamBTeamDef ? teamBTeamDef.name : (teamBTeamData.name ? teamBTeamData.name.toUpperCase() : "(Select team)");

        this.listFrame.putmsg(format("\x01n\x01wTeams:\x01n Team 1=%s  Team 2=%s\r\n", teamATeamName, teamBTeamName), LIGHTGRAY | BG_BLACK);
        this.listFrame.putmsg("\x01n\x01w-------------------------------------------------\x01n\r\n", LIGHTGRAY | BG_BLACK);

        this.listFrame.putmsg(format("\x01h\x01w%-20s %-24s %-10s\x01n\r\n", "Player", "Selection", "Status"), WHITE | BG_BLACK);

        function clampIndex(index, teamDef) {
            if (!teamDef || !teamDef.players || teamDef.players.length === 0)
                return 0;
            var value = parseInt(index, 10);
            if (isNaN(value)) value = 0;
            if (value < 0) value = 0;
            if (value >= teamDef.players.length) value = teamDef.players.length - 1;
            return value;
        }

        function getRosterName(teamDef, index) {
            if (!teamDef || !teamDef.players || teamDef.players.length === 0)
                return null;
            var idx = clampIndex(index, teamDef);
            var playerEntry = teamDef.players[idx];
            return playerEntry ? playerEntry.name : null;
        }

        var sessionTeams = session.teams || {};

        function getSelectionSummary(playerId) {
            var sides = ["teamA", "teamB"];
            for (var s = 0; s < sides.length; s++) {
                var sideKey = sides[s];
                var sideData = sessionTeams[sideKey];
                if (!sideData || !Array.isArray(sideData.players))
                    continue;
                if (sideData.players.indexOf(playerId) === -1)
                    continue;
                var teamDef = sideData.name ? MPTeamData.getTeam(sideData.name) : null;
                var abbr = teamDef ? teamDef.abbr : (sideData.name ? sideData.name.toUpperCase() : "???");
                var rosterEntry = sideData.roster ? sideData.roster[playerId] : null;
                if (teamDef && rosterEntry && typeof rosterEntry.index === "number") {
                    var playerName = getRosterName(teamDef, rosterEntry.index);
                    if (playerName)
                        return abbr + " - " + playerName;
                }
                if (teamDef)
                    return abbr + " - (Select player)";
                return "(Select team)";
            }
            return "(Select team)";
        }

        function renderCpuPartner(sideLabel, sideData, teamDef) {
            if (!sideData || !teamDef || !teamDef.players || teamDef.players.length === 0)
                return;
            if (Array.isArray(sideData.players) && sideData.players.length >= 2)
                return;
            var used = {};
            if (sideData && sideData.roster) {
                for (var pid in sideData.roster) {
                    if (!sideData.roster.hasOwnProperty(pid))
                        continue;
                    var sel = sideData.roster[pid];
                    if (sel && typeof sel.index === "number") {
                        used[clampIndex(sel.index, teamDef)] = true;
                    }
                }
            }
            var cpuIndex = (sideData && typeof sideData.cpuIndex === "number") ? clampIndex(sideData.cpuIndex, teamDef) : null;
            if (cpuIndex === null || used[cpuIndex]) {
                for (var i = 0; i < teamDef.players.length; i++) {
                    if (!used[i]) {
                        cpuIndex = i;
                        break;
                    }
                }
            }
            if (cpuIndex === null || cpuIndex >= teamDef.players.length)
                return;
            var cpuName = teamDef.players[cpuIndex].name;
            this.listFrame.putmsg(format("  %s CPU Partner: %s\r\n", sideLabel, cpuName), LIGHTGRAY | BG_BLACK);
        }

        for (var i = 0; i < session.playerList.length; i++) {
            var playerId = session.playerList[i];
            var player = session.players[playerId];
            var ready = session.readyStatus[playerId];

            var readyStr = ready ? "\x01g\x01h[READY]\x01n" : "\x01r\x01h[NOT READY]\x01n";
            var nameStr = getDisplayNameWithBBS(player).substring(0, 20);
            var selectionStr = getSelectionSummary(playerId);
            if (selectionStr.length > 24)
                selectionStr = selectionStr.substring(0, 24);

            this.listFrame.putmsg(format("  %-20s %-24s %s\r\n",
                nameStr,
                selectionStr,
                readyStr), LIGHTGRAY | BG_BLACK);
        }

        renderCpuPartner.call(this, "Team 1", teamATeamData, teamATeamDef);
        renderCpuPartner.call(this, "Team 2", teamBTeamData, teamBTeamDef);

        this.listFrame.invalidate();
    };

    // Render team select
    this.renderTeamSelect = function () {
        if (!this.listFrame) return;

        if (!this.teamSelect.active) {
            this.listFrame.clear();
            this.listFrame.home();
            this.listFrame.putmsg("\x01h\x01cTeam Selection Unavailable\x01n\r\n", WHITE | BG_BLACK);
            this.listFrame.invalidate();
            return;
        }

        if (!this.refreshTeamSelectSession(false)) {
            return;
        }

        var session = this.teamSelect.session;
        var teamList = this.teamSelect.teamList;
        if (!teamList || teamList.length === 0) {
            this.listFrame.clear();
            this.listFrame.home();
            this.listFrame.putmsg("\x01h\x01cNo Teams Available\x01n\r\n", WHITE | BG_BLACK);
            this.listFrame.invalidate();
            return;
        }

        this.ensureTeamSelectIndices({ preserveManual: true });

        var myId = this.myId.globalId;
        var mySide = this.teamSelect.mySide;
        var opponentSide = mySide === "teamA" ? "teamB" : (mySide === "teamB" ? "teamA" : null);
        var teamATeamData = session.teams.teamA;
        var teamBTeamData = session.teams.teamB;
        var selectedEntry = teamList[this.teamSelect.index];
        var selectedTeamDef = selectedEntry ? MPTeamData.getTeam(selectedEntry.key) : null;

        this.listFrame.clear();
        this.listFrame.home();
        this.listFrame.putmsg("\x01h\x01wTEAM & PLAYER SELECT\x01n\r\n", WHITE | BG_BLACK);
        this.listFrame.putmsg("Left/Right: Team  Up/Down or 1-6: Player  Enter: Confirm  C: Clear  Esc: Cancel\r\n", LIGHTGRAY | BG_BLACK);
        this.listFrame.putmsg("--------------------------------------------------------------------------\r\n", LIGHTGRAY | BG_BLACK);

        var visibleCount = Math.min(12, teamList.length);
        var startIndex = this.teamSelect.index - Math.floor(visibleCount / 2);
        if (startIndex < 0) startIndex = 0;
        if (startIndex > teamList.length - visibleCount)
            startIndex = Math.max(0, teamList.length - visibleCount);

        for (var i = 0; i < visibleCount; i++) {
            var idx = startIndex + i;
            if (idx >= teamList.length) break;
            var entry = teamList[idx];
            var key = entry.key;
            var teamACount = (teamATeamData.name === key) ? teamATeamData.players.length : 0;
            var teamBCount = (teamBTeamData.name === key) ? teamBTeamData.players.length : 0;
            var total = teamACount + teamBCount;
            var pointer = (idx === this.teamSelect.index) ? "\x01h\x01c>\x01n" : " ";
            var status;
            if (mySide && session.teams[mySide].name === key) {
                status = "[YOURS]";
            } else if (opponentSide && session.teams[opponentSide].name === key && session.teams[opponentSide].players.length > 0) {
                if (mySide === null && total < 2) {
                    status = "[TEAMMATE]";
                } else {
                    status = "[OPP]";
                }
            } else if (total >= 2) {
                status = "[FULL]";
            } else {
                status = "[OPEN]";
            }

            var attr = (idx === this.teamSelect.index) ? (YELLOW | BG_BLUE) : (LIGHTGRAY | BG_BLACK);
            this.listFrame.putmsg(format("%s %-4s %-22s %-8s  (Team 1:%d Team 2:%d)\r\n",
                pointer,
                entry.abbr,
                entry.name.substring(0, 22),
                status,
                teamACount,
                teamBCount), attr);
        }

        this.listFrame.putmsg("--------------------------------------------------------------------------\r\n", LIGHTGRAY | BG_BLACK);

        if (selectedEntry && selectedTeamDef) {
            this.listFrame.putmsg(format("\x01h\x01w%s Roster\x01n\r\n", selectedTeamDef.name), WHITE | BG_BLACK);
            var roster = selectedTeamDef.players || [];
            if (roster.length === 0) {
                this.listFrame.putmsg("  (No roster data available)\r\n", LIGHTGRAY | BG_BLACK);
            } else {
                var selectedIndex = this.teamSelect.rosterIndex;

                function findOwner(sideData, index) {
                    if (!sideData || sideData.name !== selectedEntry.key || !sideData.roster)
                        return null;
                    for (var pid in sideData.roster) {
                        if (!sideData.roster.hasOwnProperty(pid))
                            continue;
                        var choice = sideData.roster[pid];
                        if (!choice || typeof choice.index !== "number")
                            continue;
                        if (clampRosterIndexLocal(selectedTeamDef, choice.index) === index)
                            return pid;
                    }
                    return null;
                }

                for (var r = 0; r < roster.length; r++) {
                    var playerEntry = roster[r];
                    var occupantId = null;
                    var occupantSide = null;
                    var occupantLabel = "(Available)";
                    var occupantAttr = LIGHTGRAY | BG_BLACK;

                    var teamAOwner = findOwner(teamATeamData, r);
                    var teamBOwner = findOwner(teamBTeamData, r);
                    if (teamAOwner) {
                        occupantId = teamAOwner;
                        occupantSide = "teamA";
                    } else if (teamBOwner) {
                        occupantId = teamBOwner;
                        occupantSide = "teamB";
                    }

                    if (occupantId) {
                        if (occupantId === myId) {
                            occupantLabel = "(You)";
                            occupantAttr = YELLOW | BG_BLUE;
                        } else {
                            var occupantProfile = session.players[occupantId];
                            var occName = occupantProfile ? occupantProfile.displayName : occupantId;
                            occupantLabel = "(" + occName.substring(0, 12) + ")";
                            if (mySide && occupantSide === mySide) {
                                occupantAttr = LIGHTGREEN | BG_BLACK;
                            } else {
                                occupantAttr = LIGHTRED | BG_BLACK;
                            }
                        }
                    } else if (teamATeamData.name === selectedEntry.key && teamATeamData.cpuIndex !== null && clampRosterIndexLocal(selectedTeamDef, teamATeamData.cpuIndex) === r) {
                        occupantLabel = "(CPU Partner)";
                        occupantAttr = LIGHTCYAN | BG_BLACK;
                    } else if (teamBTeamData.name === selectedEntry.key && teamBTeamData.cpuIndex !== null && clampRosterIndexLocal(selectedTeamDef, teamBTeamData.cpuIndex) === r) {
                        occupantLabel = "(CPU Partner)";
                        occupantAttr = LIGHTCYAN | BG_BLACK;
                    }

                    var pointer = (selectedIndex === r) ? "\x01h\x01c>\x01n" : " ";
                    this.listFrame.putmsg(format("%s %d) %-24s %s\r\n",
                        pointer,
                        r + 1,
                        playerEntry.name.substring(0, 24),
                        occupantLabel), occupantAttr);
                }
            }
        } else {
            this.listFrame.putmsg("Select a team to view roster details.\r\n", LIGHTGRAY | BG_BLACK);
        }

        this.listFrame.invalidate();
    };

    // Render status bar
    this.renderStatusBar = function () {
        if (!this.statusFrame) return;

        this.statusFrame.clear();
        this.statusFrame.home();

        // Network quality
        if (this.networkMonitor) {
            var display = this.networkMonitor.getQualityDisplay();
            this.statusFrame.putmsg(format("Network: %s%s %dms\x01n  ",
                display.color,
                display.bars,
                display.latency), LIGHTGRAY | BG_BLACK);
        }

        // Help text
        var helpText = "";
        switch (this.state) {
            case LOBBY_STATE.MAIN_LOBBY:
                helpText = "\x01h\x01wC\x01n=Create  \x01h\x01wJ\x01n=Join  \x01h\x01wR\x01n=Refresh  \x01h\x01wQ\x01n=Quit  \x01h\x01wArrows\x01n=Select";
                break;
            case LOBBY_STATE.SESSION_LOBBY:
                helpText = "\x01h\x01wT\x01n=Team Select  \x01h\x01wR\x01n=Ready  \x01h\x01wL\x01n=Leave  \x01h\x01wEnter\x01n=Chat";
                break;
            case LOBBY_STATE.TEAM_SELECT:
                helpText = "\x01h\x01wArrows\x01n=Team  \x01h\x01w1-6\x01n=Player  \x01h\x01wEnter\x01n=Confirm  \x01h\x01wC\x01n=Clear  \x01h\x01wEsc\x01n=Cancel";
                break;
        }

        this.statusFrame.putmsg("\r\n" + helpText, LIGHTGRAY | BG_BLACK);

        if (this.statusMessage && Date.now() < this.statusMessageExpire) {
            this.statusFrame.putmsg("\r\n" + this.statusMessage, YELLOW | BG_BLACK);
        }
        this.statusFrame.invalidate();
    };

    // Render input line
    this.renderInputLine = function () {
        console.gotoxy(1, this.inputY);
        console.clearline(BG_BLUE);
        console.print("\x01n" + BG_BLUE + "\x01h\x01w> \x01n\x01h" + this.inputLine + "\x01n");
    };

    // Handle input
    this.handleInput = function (key) {
        // If we have input in progress, treat most keys as chat input
        var isTyping = this.inputLine.length > 0;

        // Enter - send chat (unless in team select mode)
        if (key === '\r' || key === '\n') {
            // In team select, Enter confirms selection - don't intercept
            if (this.state !== LOBBY_STATE.TEAM_SELECT) {
                if (this.inputLine.length > 0) {
                    this.sendChatMessage(this.inputLine);
                    this.inputLine = "";
                }
                return null;
            }
            // Otherwise fall through to team select handler
        }

        // Backspace - always handle for typing
        if (key === '\b' || key === ascii(127)) {
            if (this.inputLine.length > 0) {
                this.inputLine = this.inputLine.substring(0, this.inputLine.length - 1);
            }
            return null;
        }

        // Check if this is a command key (before adding to input)
        var upperKey = key.toUpperCase();
        var isCommandKey = false;

        switch (this.state) {
            case LOBBY_STATE.MAIN_LOBBY:
                isCommandKey = (upperKey === 'C' || upperKey === 'J' || upperKey === 'R' ||
                    upperKey === 'Q' || key === KEY_UP || key === KEY_DOWN);
                break;
            case LOBBY_STATE.SESSION_LOBBY:
                isCommandKey = (upperKey === 'T' || upperKey === 'R' || upperKey === 'L');
                break;
            case LOBBY_STATE.TEAM_SELECT:
                isCommandKey = true;
                break;
        }

        // If typing and not a command key, add to input
        if (!isCommandKey && key.length === 1 && key >= ' ' && key <= '~') {
            if (this.inputLine.length < 60) {
                this.inputLine += key;
            }
            return null;
        }

        // If we're typing and hit a command key, ignore it (or clear input first)
        if (isTyping && isCommandKey) {
            this.inputLine = ""; // Clear input and process command
        }

        // Process command keys
        switch (this.state) {
            case LOBBY_STATE.MAIN_LOBBY:
                return this.handleMainLobbyInput(upperKey);

            case LOBBY_STATE.SESSION_LOBBY:
                return this.handleSessionLobbyInput(upperKey);

            case LOBBY_STATE.TEAM_SELECT:
                return this.handleTeamSelectInput(upperKey);
        }

        return null;
    };

    // Handle main lobby input
    this.handleMainLobbyInput = function (key) {
        switch (key) {
            case 'C':
                this.createSession();
                break;

            case 'J':
                this.joinSelectedSession();
                break;

            case 'R':
                this.refreshSessions();
                break;

            case 'Q':
                return "quit";

            case KEY_UP:
                if (this.selectedSessionIndex > 0) {
                    this.selectedSessionIndex--;
                }
                break;

            case KEY_DOWN:
                if (this.selectedSessionIndex < this.sessions.length - 1) {
                    this.selectedSessionIndex++;
                }
                break;
        }

        return null;
    };

    // Handle session lobby input
    this.handleSessionLobbyInput = function (key) {
        switch (key) {
            case 'T':
                this.openTeamSelect();
                break;

            case 'R':
                this.toggleReady();
                break;

            case 'L':
                this.leaveCurrentSession();
                break;
        }

        return null;
    };

    // Handle team select input
    this.handleTeamSelectInput = function (key) {
        if (!this.teamSelect.active) {
            this.state = LOBBY_STATE.SESSION_LOBBY;
            return null;
        }

        switch (key) {
            case KEY_LEFT:
                this.moveTeamSelection(-1);
                break;
            case KEY_RIGHT:
                this.moveTeamSelection(1);
                break;
            case KEY_UP:
                this.adjustRosterIndex(-1);
                break;
            case KEY_DOWN:
                this.adjustRosterIndex(1);
                break;
            case 'C':
                this.clearTeamSelection();
                break;
            case '\r':
            case '\n':
            case ' ':
                this.confirmTeamSelection();
                break;
            case '\x1b':
                this.closeTeamSelect();
                break;
            default:
                if (key.length === 1 && key >= '1' && key <= '9') {
                    this.setRosterIndex(parseInt(key, 10) - 1);
                    this.confirmTeamSelection();
                }
                break;
        }

        return null;
    };

    // Create new session
    this.createSession = function () {
        var sessionId = createGameSession(this.client, {
            maxPlayers: 4,
            minPlayers: 2,
            allowSpectators: true
        });

        this.currentSession = sessionId;
        this.state = LOBBY_STATE.SESSION_LOBBY;
        this.openTeamSelect();

        this.sendChatMessage("Created new game!");
    };

    // Join selected session
    this.joinSelectedSession = function () {
        if (this.sessions.length === 0) return;
        if (this.selectedSessionIndex < 0 || this.selectedSessionIndex >= this.sessions.length) return;

        var game = this.sessions[this.selectedSessionIndex];
        var result = joinGameSession(this.client, game.id);

        if (result.success) {
            this.currentSession = game.id;
            this.state = LOBBY_STATE.SESSION_LOBBY;
            this.openTeamSelect();
        }
    };

    // Toggle ready status
    this.toggleReady = function () {
        if (!this.currentSession) return;

        var session = this.client.read("nba_jam", "lobby.sessions." + this.currentSession, 1);
        if (!session) return;

        var currentReady = session.readyStatus[this.myId.globalId] || false;
        var desiredReady = !currentReady;
        var result = setPlayerReady(this.client, this.currentSession, desiredReady);
        if (result && result.error) {
            this.setStatusMessage(result.error);
        }
        this.lastSessionRefresh = 0;
    };

    // Leave current session
    this.leaveCurrentSession = function () {
        if (!this.currentSession) return;

        leaveGameSession(this.client, this.currentSession);
        this.currentSession = null;
        this.state = LOBBY_STATE.MAIN_LOBBY;
        this.refreshSessions();
    };

    // Send chat message
    this.sendChatMessage = function (message) {
        if (!message)
            return;
        if (!this.chat) return;
        this.chat.submit(MP_CHAT_CHANNEL, message);
    };

    // Start game
    this.startGame = function () {
        if (!this.currentSession) return null;

        var success = startGameSession(this.client, this.currentSession);

        if (success) {
            // Return session info for game to use
            var session = this.client.read("nba_jam", "lobby.sessions." + this.currentSession, 1);

            return {
                sessionId: this.currentSession,
                session: session,
                client: this.client,
                myId: this.myId,
                serverConfig: this.serverConfig
            };
        }

        return null;
    };

    // Cleanup
    this.cleanup = function (preserveConnection) {
        preserveConnection = preserveConnection || false;

        this.teamSelect.active = false;
        this.teamSelect.manualRoster = false;

        if (!preserveConnection && this.currentSession) {
            leaveGameSession(this.client, this.currentSession);
        }

        if (!preserveConnection && this.chat) {
            this.chat.disconnect();
        }

        if (!preserveConnection && this.client) {
            this.client.disconnect();
        }

        if (this.mainFrame) {
            this.mainFrame.close();
        }

        console.clear();
    };

    // Helper: Center text
    this.centerText = function (text, width) {
        var padding = Math.floor((width - text.length) / 2);
        var result = "";
        for (var i = 0; i < padding; i++) {
            result += " ";
        }
        result += text;
        return result;
    };
}

// Main entry point for lobby
function runMultiplayerLobby() {
    var lobby = new NBAJamLobby();
    return lobby.run();
}

var lobbyGlobal = (typeof global !== "undefined") ? global : this;
if (lobbyGlobal) {
    lobbyGlobal.runMultiplayerLobby = runMultiplayerLobby;
    lobbyGlobal.NBAJamLobby = NBAJamLobby;
}
