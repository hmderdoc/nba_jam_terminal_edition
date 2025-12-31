/**
 * mp_lobby_v2.js - NBA JAM Multiplayer Lobby (Redesigned)
 * 
 * Features:
 * - Two-column layout: Games (left) + Chat (right)
 * - TAB toggles active panel focus
 * - FrameLightbar for game list and team/player selection
 * - Team colors in player picker
 * - Sprite preview when selecting players
 * - JSONChat integration with proper cleanup
 */

// Note: sbbsdefs.js, frame.js already loaded by module-loader.js
// load("sbbsdefs.js");
// load("frame.js");
load("json-chat.js"); // Uses stock Synchronet json-chat.js

// Arrow key codes
var KEY_UP = KEY_UP || "\x1b[A";
var KEY_DOWN = KEY_DOWN || "\x1b[B";
var KEY_LEFT = KEY_LEFT || "\x1b[D";
var KEY_RIGHT = KEY_RIGHT || "\x1b[C";

// Determine root path
var _mpLobbyRoot = js.exec_dir;
if (_mpLobbyRoot.indexOf("lib/multiplayer") !== -1 || _mpLobbyRoot.indexOf("lib\\multiplayer") !== -1) {
    _mpLobbyRoot = _mpLobbyRoot.replace(/lib[\/\\]multiplayer[\/\\]?$/, "");
}
if (!_mpLobbyRoot.match(/[\/\\]$/)) {
    _mpLobbyRoot += "/";
}

// Dependencies are typically already loaded by module-loader.js
// Only load if running standalone (for testing)
if (typeof MP_CONSTANTS === "undefined") {
    load(_mpLobbyRoot + "lib/config/mp-constants.js");
}
if (typeof createPlayerIdentifier === "undefined") {
    load(_mpLobbyRoot + "lib/multiplayer/mp_identity.js");
}
if (typeof MPTeamData === "undefined") {
    load(_mpLobbyRoot + "lib/multiplayer/mp_team_data.js");
}
if (typeof MP_CONFIG === "undefined") {
    load(_mpLobbyRoot + "lib/multiplayer/mp_config.js");
}
if (typeof listGameSessions === "undefined") {
    load(_mpLobbyRoot + "lib/multiplayer/mp_sessions.js");
}
if (typeof NetworkMonitor === "undefined") {
    load(_mpLobbyRoot + "lib/multiplayer/mp_network.js");
}

var LOBBY_VERSION = "2.0";

// Layout constants
var SCREEN_WIDTH = 80;
var SCREEN_HEIGHT = 24;
var GAMES_WIDTH = 40;
var CHAT_WIDTH = 40;
var HEADER_HEIGHT = 1;
var FOOTER_HEIGHT = 3;
var CONTENT_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT;

// Panel focus
var PANEL = {
    GAMES: "games",
    CHAT: "chat"
};

// Lobby states
var LOBBY_STATE = {
    SERVER_SELECT: "server_select",
    MAIN_LOBBY: "main_lobby",
    SESSION_LOBBY: "session_lobby",
    TEAM_SELECT: "team_select",
    PLAYER_SELECT: "player_select",
    STARTING: "starting"
};

/**
 * NBAJamLobbyV2 - Redesigned lobby with two-column layout
 */
function NBAJamLobbyV2() {
    var self = this;
    
    // Connection state
    this.serverConfig = null;
    this.client = null;
    this.chat = null;
    this.myId = createPlayerIdentifier();
    this.networkMonitor = null;
    
    // Session state
    this.state = LOBBY_STATE.SERVER_SELECT;
    this.currentSession = null;
    this.sessions = [];
    this.activePanel = PANEL.GAMES;
    
    // Team data
    this.teamMap = MPTeamData.load();
    this.teamList = MPTeamData.listTeams();
    
    // Selection state
    this.selectedTeamKey = null;
    this.selectedPlayerIndex = 0;
    this.mySide = null; // "teamA" or "teamB"
    
    // Menu cursors (manual navigation - not using FrameLightbar's getval())
    this.gamesCursor = 0;
    this.teamCursor = 0;
    this.playerCursor = 0;
    
    // Frames
    this.rootFrame = null;
    this.headerFrame = null;
    this.gamesFrame = null;
    this.chatFrame = null;
    this.footerFrame = null;
    this.previewFrame = null;
    
    // Chat state
    this.chatMessages = [];
    this.chatInput = "";
    this.maxChatMessages = CONTENT_HEIGHT - 4;
    
    // Refresh timers
    this.lastSessionRefresh = 0;
    this.sessionRefreshInterval = 2000;
    this.lastChatUpdate = 0;
    this.chatUpdateInterval = 500;
    
    // Status message
    this.statusMessage = "";
    this.statusExpire = 0;
    
    /**
     * Set a temporary status message
     */
    this.setStatus = function(msg, durationMs) {
        self.statusMessage = msg || "";
        self.statusExpire = Date.now() + (durationMs || 4000);
    };
    
    /**
     * Initialize the lobby
     */
    this.init = function() {
        console.clear();
        
        // Show splash/server select
        if (!self.selectServer()) {
            return false;
        }
        
        // Connect to server
        if (!self.connect()) {
            return false;
        }
        
        // Initialize frames
        self.initFrames();
        self.state = LOBBY_STATE.MAIN_LOBBY;
        
        return true;
    };
    
    /**
     * Server selection - uses same logic as V1 lobby
     * Returns config in format expected by GameCoordinator: { id, server, tuning }
     */
    this.selectServer = function() {
        console.clear();
        console.putmsg("\x01h\x01c NBA JAM MULTIPLAYER \x01n\r\n\r\n");
        
        // First preference: explicit saved choice from previous session
        var config = loadServerPreference();
        if (config) {
            // loadServerPreference already returns { id, server, tuning }
            self.serverConfig = config;
            console.putmsg("Using saved server: \x01h" + config.server.name + "\x01n\r\n");
            mswait(500);
            return true;
        }
        
        // Load custom config
        loadCustomConfig();
        
        // Second preference: default server declared in configuration
        if (MP_CONFIG && MP_CONFIG.defaultServerId && MP_CONFIG.servers[MP_CONFIG.defaultServerId]) {
            var serverId = MP_CONFIG.defaultServerId;
            self.serverConfig = {
                id: serverId,
                server: MP_CONFIG.servers[serverId],
                tuning: (MP_CONFIG.tuning && MP_CONFIG.tuning[serverId]) || 
                        (MP_CONFIG.tuning && MP_CONFIG.tuning.interbbs) || 
                        { stateUpdateInterval: 100, inputFlushInterval: 50 }
            };
            console.putmsg("Connecting to: \x01h" + self.serverConfig.server.name + "\x01n\r\n");
            mswait(500);
            return true;
        }
        
        // Final fallback: first available server entry
        for (var serverId in MP_CONFIG.servers) {
            if (MP_CONFIG.servers.hasOwnProperty(serverId)) {
                self.serverConfig = {
                    id: serverId,
                    server: MP_CONFIG.servers[serverId],
                    tuning: (MP_CONFIG.tuning && MP_CONFIG.tuning[serverId]) || 
                            (MP_CONFIG.tuning && MP_CONFIG.tuning.interbbs) || 
                            { stateUpdateInterval: 100, inputFlushInterval: 50 }
                };
                console.putmsg("Connecting to: \x01h" + self.serverConfig.server.name + "\x01n\r\n");
                mswait(500);
                return true;
            }
        }
        
        // No servers configured
        console.putmsg("\x01r\x01hNo servers configured!\x01n\r\n");
        console.putmsg("Check server_multiplayer.ini\r\n");
        console.pause();
        return false;
    };
    
    /**
     * Connect to JSON-DB server
     */
    this.connect = function() {
        var addr = self.serverConfig.server.addr;
        var port = self.serverConfig.server.port;
        console.putmsg("\r\nConnecting to " + addr + ":" + port + "...\r\n");
        
        try {
            // Use shared singleton if available, otherwise fall back to direct creation
            if (typeof NBA_JAM !== "undefined" && NBA_JAM.JsonClient && NBA_JAM.JsonClient.get) {
                NBA_JAM.JsonClient.configure({ addr: addr, port: port });
                self.client = NBA_JAM.JsonClient.get();
            } else {
                self.client = new JSONClient(addr, port);
            }
            self.networkMonitor = new NetworkMonitor(self.client, "lobby");
            
            // Initialize chat and join lobby channel
            self.chat = new JSONChat(user.number, self.client);
            self.chat.join(MP_CHAT_CHANNEL);
            
            console.putmsg("\x01g\x01hConnected!\x01n\r\n");
            
            // Measure latency
            var latency = measureLatency(self.client, 3);
            self.networkMonitor.addLatencySample(latency);
            console.putmsg("Latency: " + latency + "ms\r\n");
            
            mswait(500);
            return true;
            
        } catch (e) {
            console.putmsg("\x01r\x01hConnection failed: " + e + "\x01n\r\n");
            console.pause();
            return false;
        }
    };
    
    /**
     * Initialize UI frames
     */
    this.initFrames = function() {
        console.clear();
        
        // Root frame
        self.rootFrame = new Frame(1, 1, SCREEN_WIDTH, SCREEN_HEIGHT, BG_BLACK | LIGHTGRAY);
        self.rootFrame.open();
        
        // Header bar
        self.headerFrame = new Frame(1, 1, SCREEN_WIDTH, HEADER_HEIGHT, BG_BLUE | WHITE, self.rootFrame);
        self.headerFrame.open();
        
        // Games panel (left)
        self.gamesFrame = new Frame(1, HEADER_HEIGHT + 1, GAMES_WIDTH, CONTENT_HEIGHT, BG_BLACK | LIGHTGRAY, self.rootFrame);
        self.gamesFrame.open();
        
        // Chat panel (right)
        self.chatFrame = new Frame(GAMES_WIDTH + 1, HEADER_HEIGHT + 1, CHAT_WIDTH, CONTENT_HEIGHT, BG_BLACK | LIGHTGRAY, self.rootFrame);
        self.chatFrame.open();
        
        // Footer
        self.footerFrame = new Frame(1, SCREEN_HEIGHT - FOOTER_HEIGHT + 1, SCREEN_WIDTH, FOOTER_HEIGHT, BG_BLACK | LIGHTGRAY, self.rootFrame);
        self.footerFrame.open();
        
        self.renderHeader();
    };
    
    /**
     * Render header bar
     */
    this.renderHeader = function() {
        self.headerFrame.clear();
        self.headerFrame.gotoxy(1, 1);
        
        var title = " NBA JAM LOBBY ";
        var serverInfo = (self.serverConfig && self.serverConfig.server) ? self.serverConfig.server.name : "";
        var latencyStr = "";
        
        if (self.networkMonitor) {
            var display = self.networkMonitor.getQualityDisplay();
            latencyStr = format("%s%s %dms", display.color, display.bars, display.latency || 0);
        }
        
        var rightInfo = serverInfo + "  " + latencyStr + " ";
        var padding = SCREEN_WIDTH - title.length - rightInfo.length;
        if (padding < 0) padding = 0;
        
        self.headerFrame.putmsg("\x01h\x01y" + title + "\x01n\x01w" + 
            repeatStr(" ", padding) + "\x01n" + rightInfo, BG_BLUE | WHITE);
    };
    
    /**
     * Render footer with controls
     */
    this.renderFooter = function() {
        self.footerFrame.clear();
        self.footerFrame.gotoxy(1, 1);
        
        // Separator line
        self.footerFrame.putmsg("\x01n\x01w" + repeatStr("\xC4", SCREEN_WIDTH) + "\x01n");
        
        // Status message or controls
        self.footerFrame.gotoxy(1, 2);
        
        if (self.statusMessage && Date.now() < self.statusExpire) {
            self.footerFrame.putmsg("\x01h\x01y " + self.statusMessage + "\x01n");
        } else {
            var controls = "";
            
            switch (self.state) {
                case LOBBY_STATE.MAIN_LOBBY:
                    if (self.activePanel === PANEL.GAMES) {
                        controls = " \x01h[TAB]\x01n Chat  \x01h[C]\x01n Create  \x01h[ENTER]\x01n Join  \x01h[R]\x01n Refresh  \x01h[Q]\x01n Quit";
                    } else {
                        controls = " \x01h[TAB]\x01n Games  \x01h[ENTER]\x01n Send  \x01h[Q]\x01n Quit";
                    }
                    break;
                    
                case LOBBY_STATE.SESSION_LOBBY:
                    controls = " \x01h[T]\x01n Select Team  \x01h[SPACE]\x01n Ready  \x01h[L]\x01n Leave  \x01h[Q]\x01n Quit";
                    break;
                    
                case LOBBY_STATE.TEAM_SELECT:
                    controls = " \x01h[\x18\x19]\x01n Navigate  \x01h[ENTER]\x01n Select  \x01h[ESC]\x01n Back";
                    break;
                    
                case LOBBY_STATE.PLAYER_SELECT:
                    controls = " \x01h[\x18\x19]\x01n Navigate  \x01h[ENTER]\x01n Confirm  \x01h[ESC]\x01n Back";
                    break;
            }
            
            self.footerFrame.putmsg(controls);
        }
        
        // Chat input line (if in chat mode)
        self.footerFrame.gotoxy(1, 3);
        if (self.activePanel === PANEL.CHAT && self.state === LOBBY_STATE.MAIN_LOBBY) {
            self.footerFrame.putmsg("\x01n\x01c>\x01n " + self.chatInput + "_");
        }
    };
    
    /**
     * Render the games panel
     */
    this.renderGamesPanel = function() {
        self.gamesFrame.clear();
        self.gamesFrame.gotoxy(1, 1);
        
        // Panel header with focus indicator
        var focusAttr = (self.activePanel === PANEL.GAMES) ? (BG_CYAN | WHITE | HIGH) : (BG_BLACK | CYAN);
        var headerText = " GAMES ";
        
        self.gamesFrame.attr = focusAttr;
        self.gamesFrame.putmsg(headerText);
        self.gamesFrame.attr = BG_BLACK | LIGHTGRAY;
        self.gamesFrame.putmsg(repeatStr(" ", GAMES_WIDTH - headerText.length - 1) + "\r\n");
        
        // Separator
        self.gamesFrame.putmsg("\x01n\x01w" + repeatStr("\xC4", GAMES_WIDTH - 1) + "\x01n\r\n");
        
        switch (self.state) {
            case LOBBY_STATE.MAIN_LOBBY:
                self.renderGamesList();
                break;
            case LOBBY_STATE.SESSION_LOBBY:
                self.renderSessionLobby();
                break;
            case LOBBY_STATE.TEAM_SELECT:
                self.renderTeamSelect();
                break;
            case LOBBY_STATE.PLAYER_SELECT:
                self.renderPlayerSelect();
                break;
        }
    };
    
    /**
     * Render games list
     */
    this.renderGamesList = function() {
        var y = 3;
        
        // Create game option
        self.gamesFrame.gotoxy(2, y++);
        self.gamesFrame.putmsg("\x01h\x01g[C]\x01n Create New Game\r\n");
        y++;
        
        if (self.sessions.length === 0) {
            self.gamesFrame.gotoxy(2, y++);
            self.gamesFrame.putmsg("\x01n\x01kNo games available.\x01n\r\n");
            self.gamesFrame.gotoxy(2, y++);
            self.gamesFrame.putmsg("\x01n\x01kPress C to create one!\x01n\r\n");
        } else {
            // Clamp cursor
            if (self.gamesCursor >= self.sessions.length) {
                self.gamesCursor = self.sessions.length - 1;
            }
            if (self.gamesCursor < 0) self.gamesCursor = 0;
            
            // Calculate visible range
            var maxVisible = CONTENT_HEIGHT - y - 2;
            var startIdx = 0;
            if (self.gamesCursor >= maxVisible) {
                startIdx = self.gamesCursor - maxVisible + 1;
            }
            var endIdx = Math.min(startIdx + maxVisible, self.sessions.length);
            
            for (var i = startIdx; i < endIdx; i++) {
                var sess = self.sessions[i];
                var ageStr = formatAge(sess.age);
                var selected = (i === self.gamesCursor);
                
                self.gamesFrame.gotoxy(2, y++);
                
                if (selected) {
                    self.gamesFrame.attr = BG_BLUE | WHITE | HIGH;
                    self.gamesFrame.putmsg("\x10 ");  // Arrow indicator
                } else {
                    self.gamesFrame.attr = BG_BLACK | LIGHTGRAY;
                    self.gamesFrame.putmsg("  ");
                }
                
                var line = format("%-18s %d/%d %s", 
                    truncate(sess.host, 18), 
                    sess.playerCount, 
                    sess.maxPlayers, 
                    ageStr);
                self.gamesFrame.putmsg(line);
                self.gamesFrame.attr = BG_BLACK | LIGHTGRAY;
                self.gamesFrame.putmsg("\r\n");
            }
            
            // Scroll indicators
            if (startIdx > 0) {
                self.gamesFrame.gotoxy(GAMES_WIDTH - 3, 5);
                self.gamesFrame.putmsg("\x01h\x01c\x18\x01n"); // Up arrow
            }
            if (endIdx < self.sessions.length) {
                self.gamesFrame.gotoxy(GAMES_WIDTH - 3, CONTENT_HEIGHT - 2);
                self.gamesFrame.putmsg("\x01h\x01c\x19\x01n"); // Down arrow
            }
        }
    };
    
    /**
     * Render session lobby (inside a game)
     */
    this.renderSessionLobby = function() {
        var session = self.client.read("nba_jam", "lobby.sessions." + self.currentSession, 1);
        if (!session) {
            self.state = LOBBY_STATE.MAIN_LOBBY;
            return;
        }
        
        var y = 3;
        
        // Session info
        self.gamesFrame.gotoxy(2, y++);
        self.gamesFrame.putmsg("\x01h\x01wHost:\x01n " + truncate(session.hostPlayer.displayName, 25) + "\r\n");
        y++;
        
        // Teams
        var teamA = session.teams && session.teams.teamA;
        var teamB = session.teams && session.teams.teamB;
        var teamAName = teamA && teamA.name ? getTeamDisplayName(teamA.name) : "(Select)";
        var teamBName = teamB && teamB.name ? getTeamDisplayName(teamB.name) : "(Select)";
        
        self.gamesFrame.gotoxy(2, y++);
        self.gamesFrame.putmsg("\x01n\x01wTeam A:\x01h " + teamAName + "\x01n\r\n");
        self.gamesFrame.gotoxy(2, y++);
        self.gamesFrame.putmsg("\x01n\x01wTeam B:\x01h " + teamBName + "\x01n\r\n");
        y++;
        
        // Players
        self.gamesFrame.gotoxy(2, y++);
        self.gamesFrame.putmsg("\x01h\x01w" + repeatStr("\xC4", GAMES_WIDTH - 4) + "\x01n\r\n");
        
        self.gamesFrame.gotoxy(2, y++);
        self.gamesFrame.putmsg("\x01h\x01wPlayers:\x01n\r\n");
        
        if (session.playerList) {
            for (var i = 0; i < session.playerList.length; i++) {
                var playerId = session.playerList[i];
                var player = session.players[playerId];
                var ready = session.readyStatus[playerId];
                
                var nameStr = getDisplayNameWithBBS(player);
                var readyStr = ready ? "\x01g\x01h[READY]" : "\x01r[...]";
                
                self.gamesFrame.gotoxy(3, y++);
                self.gamesFrame.putmsg(format("%-24s %s\x01n", truncate(nameStr, 24), readyStr) + "\r\n");
            }
        }
    };
    
    /**
     * Render team selection
     */
    this.renderTeamSelect = function() {
        var y = 3;
        
        self.gamesFrame.gotoxy(2, y++);
        self.gamesFrame.putmsg("\x01h\x01wSelect Your Team:\x01n\r\n");
        y++;
        
        // Clamp cursor
        if (self.teamCursor >= self.teamList.length) {
            self.teamCursor = self.teamList.length - 1;
        }
        if (self.teamCursor < 0) self.teamCursor = 0;
        
        // Calculate visible range
        var maxVisible = CONTENT_HEIGHT - y - 2;
        var startIdx = 0;
        if (self.teamCursor >= maxVisible) {
            startIdx = self.teamCursor - maxVisible + 1;
        }
        var endIdx = Math.min(startIdx + maxVisible, self.teamList.length);
        
        for (var i = startIdx; i < endIdx; i++) {
            var team = self.teamList[i];
            var teamData = self.teamMap[team.key];
            var colors = teamData && teamData.colors ? teamData.colors : {};
            var selected = (i === self.teamCursor);
            
            self.gamesFrame.gotoxy(2, y++);
            
            if (selected) {
                // Use team colors for highlight
                var hlBg = getColorValue(colors.bg_alt) || BG_BLUE;
                var hlFg = getColorValue(colors.fg) || WHITE;
                self.gamesFrame.attr = hlBg | hlFg | HIGH;
                self.gamesFrame.putmsg("\x10 ");
            } else {
                self.gamesFrame.attr = BG_BLACK | LIGHTGRAY;
                self.gamesFrame.putmsg("  ");
            }
            
            var line = format("%-3s %-28s", team.abbr, team.name);
            self.gamesFrame.putmsg(line);
            self.gamesFrame.attr = BG_BLACK | LIGHTGRAY;
            self.gamesFrame.putmsg("\r\n");
        }
        
        // Scroll indicators
        if (startIdx > 0) {
            self.gamesFrame.gotoxy(GAMES_WIDTH - 3, 5);
            self.gamesFrame.putmsg("\x01h\x01c\x18\x01n");
        }
        if (endIdx < self.teamList.length) {
            self.gamesFrame.gotoxy(GAMES_WIDTH - 3, CONTENT_HEIGHT - 2);
            self.gamesFrame.putmsg("\x01h\x01c\x19\x01n");
        }
    };
    
    /**
     * Render player selection with team colors
     */
    this.renderPlayerSelect = function() {
        var teamData = self.teamMap[self.selectedTeamKey];
        if (!teamData) {
            self.state = LOBBY_STATE.TEAM_SELECT;
            return;
        }
        
        var colors = teamData.colors || {};
        var teamFg = getColorValue(colors.fg) || WHITE;
        var teamBg = getColorValue(colors.bg_alt) || BG_BLACK;
        var players = teamData.players || [];
        
        var y = 3;
        
        // Team header with team colors
        self.gamesFrame.gotoxy(2, y++);
        self.gamesFrame.attr = teamBg | teamFg | HIGH;
        self.gamesFrame.putmsg(" " + teamData.name + " ");
        self.gamesFrame.attr = BG_BLACK | LIGHTGRAY;
        self.gamesFrame.putmsg("\r\n");
        y++;
        
        self.gamesFrame.gotoxy(2, y++);
        self.gamesFrame.putmsg("\x01h\x01wSelect Your Player:\x01n\r\n");
        y++;
        
        // Clamp cursor
        if (self.playerCursor >= players.length) {
            self.playerCursor = players.length - 1;
        }
        if (self.playerCursor < 0) self.playerCursor = 0;
        
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var selected = (i === self.playerCursor);
            
            self.gamesFrame.gotoxy(2, y++);
            
            if (selected) {
                self.gamesFrame.attr = teamBg | teamFg | HIGH;
                self.gamesFrame.putmsg("\x10 ");
            } else {
                self.gamesFrame.attr = BG_BLACK | LIGHTGRAY;
                self.gamesFrame.putmsg("  ");
            }
            
            var line = format("#%-2s %-20s %s", 
                p.jerseyString || String(p.jersey), 
                truncate(p.name, 20), 
                p.position || "");
            self.gamesFrame.putmsg(line);
            self.gamesFrame.attr = BG_BLACK | LIGHTGRAY;
            self.gamesFrame.putmsg("\r\n");
        }
        
        // Update preview when selection changes
        if (players[self.playerCursor]) {
            self.updatePlayerPreview(players[self.playerCursor]);
        }
    };
    
    /**
     * Update player preview sprite
     */
    this.updatePlayerPreview = function(player) {
        // TODO: Implement sprite preview in chat panel area
        // For now just show player info
        if (player) {
            self.setStatus(player.name + " #" + player.jersey, 2000);
        }
    };
    
    /**
     * Render chat panel
     */
    this.renderChatPanel = function() {
        self.chatFrame.clear();
        self.chatFrame.gotoxy(1, 1);
        
        // Panel header with focus indicator
        var focusAttr = (self.activePanel === PANEL.CHAT) ? (BG_CYAN | WHITE | HIGH) : (BG_BLACK | CYAN);
        var headerText = " CHAT ";
        
        self.chatFrame.attr = focusAttr;
        self.chatFrame.putmsg(headerText);
        self.chatFrame.attr = BG_BLACK | LIGHTGRAY;
        self.chatFrame.putmsg(repeatStr(" ", CHAT_WIDTH - headerText.length - 1) + "\r\n");
        
        // Separator
        self.chatFrame.putmsg("\x01n\x01w" + repeatStr("\xC4", CHAT_WIDTH - 1) + "\x01n\r\n");
        
        // Chat messages
        var startY = 3;
        var displayCount = Math.min(self.chatMessages.length, self.maxChatMessages);
        var startIdx = Math.max(0, self.chatMessages.length - displayCount);
        
        for (var i = startIdx; i < self.chatMessages.length; i++) {
            var msg = self.chatMessages[i];
            var y = startY + (i - startIdx);
            
            self.chatFrame.gotoxy(1, y);
            self.chatFrame.putmsg(format("\x01c%s\x01n: %s", 
                truncate(msg.from || "???", 12), 
                truncate(msg.text || "", CHAT_WIDTH - 15)) + "\r\n");
        }
        
        // If no messages, show hint
        if (self.chatMessages.length === 0) {
            self.chatFrame.gotoxy(2, startY);
            self.chatFrame.putmsg("\x01n\x01kNo messages yet.\x01n\r\n");
            self.chatFrame.gotoxy(2, startY + 1);
            self.chatFrame.putmsg("\x01n\x01kPress TAB to chat!\x01n\r\n");
        }
    };
    
    /**
     * Main render loop
     */
    this.render = function() {
        self.renderHeader();
        self.renderGamesPanel();
        self.renderChatPanel();
        self.renderFooter();
        
        self.rootFrame.cycle();
    };
    
    /**
     * Refresh sessions list
     */
    this.refreshSessions = function() {
        if (!self.client) return;
        
        self.sessions = listGameSessions(self.client, {
            status: SESSION_STATUS.WAITING,
            hasSpace: true
        });
        
        // Mark menu for rebuild
        if (self.gamesMenu) {
            self.gamesMenu._needsRebuild = true;
        }
    };
    
    /**
     * Update chat messages
     */
    this.updateChat = function() {
        if (!self.chat) return;
        
        // Note: client.cycle() in main loop handles network updates
        // JSONChat stores messages in channels[key].messages
        
        // Get messages from JSONChat channel
        var channelKey = MP_CHAT_CHANNEL.toUpperCase();
        if (!self.chat.channels || !self.chat.channels[channelKey]) {
            return;
        }
        
        var channel = self.chat.channels[channelKey];
        var messages = channel.messages || [];
        
        // Sync local chatMessages with channel messages
        // (JSONChat manages the message array, we just mirror it for display)
        // Note: Message objects have .nick and .str (not .msg)
        self.chatMessages = [];
        for (var i = 0; i < messages.length; i++) {
            var msg = messages[i];
            self.chatMessages.push({
                from: (msg.nick && msg.nick.name) ? msg.nick.name : "System",
                text: msg.str || ""
            });
        }
        
        // Trim to last 100 messages for display
        if (self.chatMessages.length > 100) {
            self.chatMessages = self.chatMessages.slice(-100);
        }
    };
    
    /**
     * Send chat message
     */
    this.sendChat = function(text) {
        if (!text || !self.chat) return;
        
        try {
            self.chat.submit(MP_CHAT_CHANNEL, text);
            // Message will appear via updateChat() when server echoes it back
        } catch (e) {
            self.setStatus("Failed to send message", 2000);
        }
    };
    
    /**
     * Handle input based on state and panel
     */
    this.handleInput = function(key) {
        // Global keys
        if (key === "\t") {
            self.activePanel = (self.activePanel === PANEL.GAMES) ? PANEL.CHAT : PANEL.GAMES;
            return null;
        }
        
        if (key.toUpperCase() === "Q" && self.state !== LOBBY_STATE.TEAM_SELECT && 
            self.state !== LOBBY_STATE.PLAYER_SELECT) {
            return "quit";
        }
        
        // Chat mode input
        if (self.activePanel === PANEL.CHAT && self.state === LOBBY_STATE.MAIN_LOBBY) {
            return self.handleChatInput(key);
        }
        
        // Games panel input
        switch (self.state) {
            case LOBBY_STATE.MAIN_LOBBY:
                return self.handleMainLobbyInput(key);
            case LOBBY_STATE.SESSION_LOBBY:
                return self.handleSessionLobbyInput(key);
            case LOBBY_STATE.TEAM_SELECT:
                return self.handleTeamSelectInput(key);
            case LOBBY_STATE.PLAYER_SELECT:
                return self.handlePlayerSelectInput(key);
        }
        
        return null;
    };
    
    /**
     * Handle chat input
     */
    this.handleChatInput = function(key) {
        if (key === "\r" || key === "\n") {
            if (self.chatInput.length > 0) {
                self.sendChat(self.chatInput);
                self.chatInput = "";
            }
        } else if (key === "\b" || key === "\x7f") {
            if (self.chatInput.length > 0) {
                self.chatInput = self.chatInput.substring(0, self.chatInput.length - 1);
            }
        } else if (key >= " " && key <= "~") {
            if (self.chatInput.length < 60) {
                self.chatInput += key;
            }
        }
        return null;
    };
    
    /**
     * Handle main lobby input
     */
    this.handleMainLobbyInput = function(key) {
        var upper = key.toUpperCase();
        
        if (upper === "C") {
            // Create game - createGameSession returns session object
            var session = createGameSession(self.client, {});
            
            if (session && session.id) {
                self.currentSession = session.id;
                self.state = LOBBY_STATE.SESSION_LOBBY;
                self.setStatus("Game created!", 2000);
            } else {
                self.setStatus("Failed to create game", 3000);
            }
            return null;
        }
        
        if (upper === "R") {
            self.refreshSessions();
            self.setStatus("Refreshed", 1000);
            return null;
        }
        
        // Navigation
        if (self.sessions.length > 0) {
            if (key === KEY_UP) {
                if (self.gamesCursor > 0) self.gamesCursor--;
            } else if (key === KEY_DOWN) {
                if (self.gamesCursor < self.sessions.length - 1) self.gamesCursor++;
            } else if (key === "\r" || key === "\n") {
                var sess = self.sessions[self.gamesCursor];
                if (sess) {
                    // Join game - joinGameSession takes (client, sessionId, password)
                    var joinResult = joinGameSession(self.client, sess.id, null);
                    if (joinResult && joinResult.success) {
                        self.currentSession = sess.id;
                        self.state = LOBBY_STATE.SESSION_LOBBY;
                        self.setStatus("Joined game!", 2000);
                    } else {
                        var errMsg = (joinResult && joinResult.error) ? joinResult.error : "Failed to join";
                        self.setStatus(errMsg, 3000);
                    }
                }
            }
        }
        
        return null;
    };
    
    /**
     * Handle session lobby input
     */
    this.handleSessionLobbyInput = function(key) {
        var upper = key.toUpperCase();
        
        if (upper === "T") {
            self.state = LOBBY_STATE.TEAM_SELECT;
            self.teamMenu = null; // Rebuild
            return null;
        }
        
        if (upper === " ") {
            // Toggle ready - get current status first, then flip it
            var session = self.client.read("nba_jam", "lobby.sessions." + self.currentSession, 1);
            var currentReady = session && session.readyStatus && session.readyStatus[self.myId.globalId];
            var result = setPlayerReady(self.client, self.currentSession, !currentReady);
            if (result && result.error) {
                self.setStatus(result.error, 3000);
            }
            return null;
        }
        
        if (upper === "L") {
            // Leave game
            leaveGameSession(self.client, self.currentSession);
            self.currentSession = null;
            self.state = LOBBY_STATE.MAIN_LOBBY;
            self.setStatus("Left game", 2000);
            return null;
        }
        
        return null;
    };
    
    /**
     * Handle team selection input
     */
    this.handleTeamSelectInput = function(key) {
        if (key === "\x1b") { // ESC
            self.state = LOBBY_STATE.SESSION_LOBBY;
            return null;
        }
        
        if (key === KEY_UP) {
            if (self.teamCursor > 0) self.teamCursor--;
        } else if (key === KEY_DOWN) {
            if (self.teamCursor < self.teamList.length - 1) self.teamCursor++;
        } else if (key === "\r" || key === "\n") {
            var team = self.teamList[self.teamCursor];
            if (team) {
                self.selectedTeamKey = team.key;
                self.playerCursor = 0;
                self.state = LOBBY_STATE.PLAYER_SELECT;
            }
        }
        
        return null;
    };
    
    /**
     * Handle player selection input
     */
    this.handlePlayerSelectInput = function(key) {
        if (key === "\x1b") { // ESC
            self.state = LOBBY_STATE.TEAM_SELECT;
            return null;
        }
        
        var teamData = self.teamMap[self.selectedTeamKey];
        var players = teamData ? (teamData.players || []) : [];
        
        if (key === KEY_UP) {
            if (self.playerCursor > 0) self.playerCursor--;
        } else if (key === KEY_DOWN) {
            if (self.playerCursor < players.length - 1) self.playerCursor++;
        } else if (key === "\r" || key === "\n") {
            // Confirm selection
            self.confirmTeamPlayerSelection(self.selectedTeamKey, self.playerCursor);
            self.state = LOBBY_STATE.SESSION_LOBBY;
            self.setStatus("Selection confirmed!", 2000);
        }
        
        return null;
    };
    
    /**
     * Confirm team and player selection
     */
    this.confirmTeamPlayerSelection = function(teamKey, playerIndex) {
        if (!self.currentSession || !teamKey) return;
        
        // Determine side (teamA or teamB)
        var session = self.client.read("nba_jam", "lobby.sessions." + self.currentSession, 1);
        if (!session) return;
        
        // Auto-assign to first available side
        var sideKey = "teamA";
        if (session.teams && session.teams.teamA && session.teams.teamA.players && 
            session.teams.teamA.players.length > 0) {
            sideKey = "teamB";
        }
        
        // Update session with selection using selectTeamAndPlayer
        var result = selectTeamAndPlayer(self.client, self.currentSession, teamKey, playerIndex);
        if (result && result.error) {
            self.setStatus(result.error, 3000);
        }
    };
    
    /**
     * Start the game
     */
    this.startGame = function() {
        // Mark session as starting
        var success = startGameSession(self.client, self.currentSession);
        if (!success) {
            return null;
        }
        
        // Refresh session data after start
        var session = self.client.read("nba_jam", "lobby.sessions." + self.currentSession, 1);
        if (!session) return null;
        
        return {
            sessionId: self.currentSession,
            session: session,
            client: self.client,
            myId: self.myId,
            serverConfig: self.serverConfig
        };
    };
    
    /**
     * Cleanup resources
     */
    this.cleanup = function(preserveConnection) {
        // Always disconnect chat
        if (self.chat) {
            try { self.chat.disconnect(); } catch (e) {}
            self.chat = null;
        }
        
        if (!preserveConnection) {
            if (self.currentSession) {
                leaveGameSession(self.client, self.currentSession);
            }
            
            if (self.client) {
                try { self.client.disconnect(); } catch (e) {}
                self.client = null;
            }
        }
        
        if (self.rootFrame) {
            try { self.rootFrame.close(); } catch (e) {}
            self.rootFrame = null;
        }
        
        console.clear();
    };
    
    /**
     * Main run loop
     */
    this.run = function() {
        if (!self.init()) {
            return null;
        }
        
        var running = true;
        var result = null;
        var preserveConnection = false;
        
        while (running && !js.terminated) {
            var now = Date.now();
            
            // Network ping
            if (self.networkMonitor) {
                self.networkMonitor.ping();
            }
            
            // Refresh sessions periodically
            if (self.state === LOBBY_STATE.MAIN_LOBBY && 
                now - self.lastSessionRefresh > self.sessionRefreshInterval) {
                self.refreshSessions();
                self.lastSessionRefresh = now;
            }
            
            // Check for game start
            if (self.state === LOBBY_STATE.SESSION_LOBBY && self.currentSession) {
                var session = self.client.read("nba_jam", "lobby.sessions." + self.currentSession, 1);
                if (session && (session.status === SESSION_STATUS.READY || 
                    session.status === SESSION_STATUS.PLAYING)) {
                    self.state = LOBBY_STATE.STARTING;
                }
            }
            
            // Handle game start
            if (self.state === LOBBY_STATE.STARTING) {
                result = self.startGame();
                if (result) {
                    preserveConnection = true;
                    running = false;
                } else {
                    self.state = LOBBY_STATE.SESSION_LOBBY;
                }
                continue;
            }
            
            // Update chat
            if (now - self.lastChatUpdate > self.chatUpdateInterval) {
                self.updateChat();
                self.lastChatUpdate = now;
            }
            
            // Render
            self.render();
            
            // Handle input
            var key = console.inkey(K_NONE, 50);
            if (key) {
                var action = self.handleInput(key);
                if (action === "quit") {
                    running = false;
                }
            }
            
            // Cycle network - chat.cycle() includes client.cycle() and processes chat updates
            if (self.chat) {
                self.chat.cycle();
            } else if (self.client) {
                self.client.cycle();
            }
            
            mswait(10);
        }
        
        self.cleanup(preserveConnection);
        return result;
    };
}

// ============================================================================
// Helper functions
// ============================================================================

function repeatStr(ch, n) {
    var result = "";
    for (var i = 0; i < n; i++) result += ch;
    return result;
}

function truncate(str, maxLen) {
    if (!str) return "";
    str = String(str);
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 1) + "\x1b[0m";
}

function formatAge(ageMs) {
    var secs = Math.floor(ageMs / 1000);
    if (secs < 60) return secs + "s";
    return Math.floor(secs / 60) + "m";
}

function getTeamDisplayName(teamKey) {
    if (!teamKey) return "(Select)";
    var team = MPTeamData.getTeam(teamKey);
    return team ? team.name : teamKey.toUpperCase();
}

function getDisplayNameWithBBS(player) {
    if (!player) return "Unknown";
    var name = player.displayName || player.name || "Unknown";
    if (player.bbsName && player.bbsName !== system.name) {
        name += "@" + player.bbsName;
    }
    return name;
}

function getColorValue(colorStr) {
    if (!colorStr) return null;
    if (typeof colorStr === "number") return colorStr;
    
    var colorMap = {
        "BLACK": BLACK, "RED": RED, "GREEN": GREEN, "BROWN": BROWN,
        "BLUE": BLUE, "MAGENTA": MAGENTA, "CYAN": CYAN, "LIGHTGRAY": LIGHTGRAY,
        "DARKGRAY": DARKGRAY, "LIGHTRED": LIGHTRED, "LIGHTGREEN": LIGHTGREEN,
        "YELLOW": YELLOW, "LIGHTBLUE": LIGHTBLUE, "LIGHTMAGENTA": LIGHTMAGENTA,
        "LIGHTCYAN": LIGHTCYAN, "WHITE": WHITE,
        "BG_BLACK": BG_BLACK, "BG_RED": BG_RED, "BG_GREEN": BG_GREEN,
        "BG_BROWN": BG_BROWN, "BG_BLUE": BG_BLUE, "BG_MAGENTA": BG_MAGENTA,
        "BG_CYAN": BG_CYAN, "BG_LIGHTGRAY": BG_LIGHTGRAY
    };
    
    return colorMap[colorStr.toUpperCase()] || null;
}

// ============================================================================
// Entry point
// ============================================================================

function runMultiplayerLobbyV2() {
    var lobby = new NBAJamLobbyV2();
    return lobby.run();
}

// Export
var lobbyGlobal = (typeof global !== "undefined") ? global : this;
if (lobbyGlobal) {
    lobbyGlobal.runMultiplayerLobbyV2 = runMultiplayerLobbyV2;
    lobbyGlobal.NBAJamLobbyV2 = NBAJamLobbyV2;
}
