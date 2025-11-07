// mp_sessions.js - Game Session Management
// Handles session creation, joining, team selection, and readiness

load(js.exec_dir + "lib/multiplayer/mp_identity.js");
load(js.exec_dir + "lib/multiplayer/mp_team_data.js");

// Lock constants for JSON-DB operations
var LOCK_READ = 1;
var LOCK_WRITE = 2;

// Session status constants
var SESSION_STATUS = {
    WAITING: "waiting",     // Waiting for players
    READY: "ready",         // All players ready, about to start
    PLAYING: "playing",     // Game in progress
    PAUSED: "paused",       // Game paused
    FINISHED: "finished"    // Game completed
};

function ensureTeamContainers(session) {
    if (!session.teams)
        session.teams = {};

    if (!session.teams.red)
        session.teams.red = { name: null, players: [], abbr: null, roster: {}, cpuIndex: null };
    if (!session.teams.blue)
        session.teams.blue = { name: null, players: [], abbr: null, roster: {}, cpuIndex: null };

    var sides = ["red", "blue"];
    for (var i = 0; i < sides.length; i++) {
        var side = sides[i];
        var sideData = session.teams[side];
        if (!Array.isArray(sideData.players))
            sideData.players = [];
        if (!sideData.roster)
            sideData.roster = {};
        if (typeof sideData.name !== "string")
            sideData.name = sideData.name ? String(sideData.name) : null;
        if (typeof sideData.abbr !== "string")
            sideData.abbr = sideData.abbr ? String(sideData.abbr) : null;
        if (sideData.cpuIndex === undefined)
            sideData.cpuIndex = null;
    }
}

function clampRosterIndex(index, teamDef) {
    if (!teamDef || !teamDef.players || teamDef.players.length === 0)
        return 0;
    var rosterLength = teamDef.players.length;
    var value = parseInt(index, 10);
    if (isNaN(value)) value = 0;
    if (value < 0) value = 0;
    if (value >= rosterLength) value = rosterLength - 1;
    return value;
}

function findAvailableRosterIndex(teamDef, used) {
    if (!teamDef || !teamDef.players || teamDef.players.length === 0)
        return 0;
    for (var i = 0; i < teamDef.players.length; i++) {
        if (!used[i])
            return i;
    }
    return 0;
}

function determineCpuIndexForSide(sideData, teamDef) {
    if (!teamDef || !teamDef.players || teamDef.players.length === 0)
        return null;
    if (sideData.players && sideData.players.length >= 2)
        return null;

    var rosterChoices = sideData.roster || {};
    var used = {};
    for (var pid in rosterChoices) {
        if (!rosterChoices.hasOwnProperty(pid))
            continue;
        var sel = rosterChoices[pid];
        if (sel && typeof sel.index === "number") {
            var idx = clampRosterIndex(sel.index, teamDef);
            used[idx] = true;
        }
    }
    return findAvailableRosterIndex(teamDef, used);
}

function getTeamDefinition(teamKey) {
    if (!teamKey)
        return null;
    return MPTeamData.getTeam(teamKey) || null;
}

function getRosterPlayerName(teamDef, index) {
    if (!teamDef || !teamDef.players)
        return null;
    var idx = clampRosterIndex(index, teamDef);
    var player = teamDef.players[idx];
    return player ? player.name : null;
}

function removePlayerFromTeams(session, playerId) {
    ensureTeamContainers(session);
    var removedSide = null;
    var sides = ["red", "blue"];
    for (var i = 0; i < sides.length; i++) {
        var side = sides[i];
        var sideData = session.teams[side];
        var idx = sideData.players.indexOf(playerId);
        if (idx !== -1) {
            sideData.players.splice(idx, 1);
            if (sideData.roster)
                delete sideData.roster[playerId];
            removedSide = side;

            if (sideData.players.length === 0) {
                sideData.name = null;
                sideData.abbr = null;
                sideData.roster = {};
                sideData.cpuIndex = null;
            } else {
                var def = getTeamDefinition(sideData.name);
                sideData.cpuIndex = determineCpuIndexForSide(sideData, def);
            }
        }
    }
    return removedSide;
}

function playerHasValidSelection(session, playerId) {
    ensureTeamContainers(session);
    var sides = ["red", "blue"];
    for (var i = 0; i < sides.length; i++) {
        var side = sides[i];
        var sideData = session.teams[side];
        if (sideData.players.indexOf(playerId) !== -1) {
            if (!sideData.name)
                return { valid: false, reason: "Select a team first." };
            var rosterEntry = sideData.roster ? sideData.roster[playerId] : null;
            if (!rosterEntry || typeof rosterEntry.index !== "number")
                return { valid: false, reason: "Select your roster player." };
            return { valid: true, side: side, teamKey: sideData.name };
        }
    }
    return { valid: false, reason: "Select a team first." };
}

// Create a new game session
function createGameSession(client, options) {
    options = options || {};

    var myId = createPlayerIdentifier();
    var sessionId = myId.bbsQwkId + "_" + Date.now() + "_" + myId.userNum;

    var initialRedKey = options.redTeam ? MPTeamData.findTeamKey(options.redTeam) : null;
    var initialBlueKey = options.blueTeam ? MPTeamData.findTeamKey(options.blueTeam) : null;
    var initialRedTeam = initialRedKey ? MPTeamData.getTeam(initialRedKey) : null;
    var initialBlueTeam = initialBlueKey ? MPTeamData.getTeam(initialBlueKey) : null;

    var session = {
        // Session identity
        id: sessionId,
        created: Date.now(),
        status: SESSION_STATUS.WAITING,

        // Host info
        host: myId.globalId,
        hostPlayer: myId,

        // Game configuration
        config: {
            maxPlayers: options.maxPlayers || 4,
            minPlayers: options.minPlayers || 2,
            allowSpectators: options.allowSpectators !== false,
            isPrivate: options.isPrivate || false,
            password: options.password || null,
            gameMode: options.gameMode || "2v2"  // "1v1", "2v2", etc.
        },

        // Players
        players: {},
        playerList: [myId.globalId],  // Ordered list
        readyStatus: {},

        // Teams
        teams: {
            red: {
                name: initialRedKey,
                players: [],
                abbr: initialRedTeam ? initialRedTeam.abbr : null,
                roster: {},
                cpuIndex: null
            },
            blue: {
                name: initialBlueKey,
                players: [],
                abbr: initialBlueTeam ? initialBlueTeam.abbr : null,
                roster: {},
                cpuIndex: null
            }
        },

        // Game state
        coordinator: null,  // Will be set when game starts
        lastActivity: Date.now(),

        // Chat history
        chatMessages: []
    };

    // Add host as player
    session.players[myId.globalId] = myId;
    session.readyStatus[myId.globalId] = false;

    // Write to global session list
    client.write("nba_jam", "lobby.sessions." + sessionId, session, LOCK_WRITE);

    // Subscribe to session updates
    client.subscribe("nba_jam", "lobby.sessions." + sessionId);

    return sessionId;
}

// List all available sessions (with filtering)
function listGameSessions(client, filters) {
    filters = filters || {};

    var allSessions = client.read("nba_jam", "lobby.sessions", 1);
    if (!allSessions) return [];

    var sessions = [];
    var now = Date.now();
    var maxAge = 3600000; // 1 hour

    for (var sessionId in allSessions) {
        var session = allSessions[sessionId];
        if (!session) continue;

        // Filter out old/finished sessions
        if (session.status === SESSION_STATUS.FINISHED) continue;
        if (now - session.lastActivity > maxAge) continue;

        // Apply filters
        if (filters.status && session.status !== filters.status) continue;
        if (filters.notFull && session.playerList.length >= session.config.maxPlayers) continue;
        if (filters.hasSpace && session.playerList.length >= session.config.maxPlayers) continue;

        // Skip private sessions without password
        if (session.config.isPrivate && !filters.password) continue;

        sessions.push({
            id: sessionId,
            session: session,
            playerCount: session.playerList.length,
            maxPlayers: session.config.maxPlayers,
            age: now - session.created,
            host: session.hostPlayer.displayName,
            hostBBS: session.hostPlayer.bbsName
        });
    }

    // Sort by creation time (newest first)
    sessions.sort(function (a, b) {
        return b.session.created - a.session.created;
    });

    return sessions;
}

// Join an existing session
function joinGameSession(client, sessionId, password) {
    var myId = createPlayerIdentifier();

    // Lock session for modification
    client.lock("nba_jam", "lobby.sessions." + sessionId, LOCK_WRITE);

    var session = client.read("nba_jam", "lobby.sessions." + sessionId);

    if (!session) {
        client.unlock("nba_jam", "lobby.sessions." + sessionId);
        return { success: false, error: "Session not found" };
    }

    // Validate join conditions
    if (session.status !== SESSION_STATUS.WAITING) {
        client.unlock("nba_jam", "lobby.sessions." + sessionId);
        return { success: false, error: "Game already started" };
    }

    if (session.playerList.length >= session.config.maxPlayers) {
        client.unlock("nba_jam", "lobby.sessions." + sessionId);
        return { success: false, error: "Game is full" };
    }

    if (session.config.isPrivate && session.config.password !== password) {
        client.unlock("nba_jam", "lobby.sessions." + sessionId);
        return { success: false, error: "Invalid password" };
    }

    // Check if already in session
    if (session.players[myId.globalId]) {
        client.unlock("nba_jam", "lobby.sessions." + sessionId);
        return { success: true, rejoined: true };
    }

    // Add player to session
    session.players[myId.globalId] = myId;
    session.playerList.push(myId.globalId);
    session.readyStatus[myId.globalId] = false;
    session.lastActivity = Date.now();

    // Write back (already locked above)
    client.write("nba_jam", "lobby.sessions." + sessionId, session);

    // Post join message to chat (before unlock)
    postSessionChatMessage(client, sessionId, null, myId.displayName + " joined from " + myId.bbsName);

    client.unlock("nba_jam", "lobby.sessions." + sessionId);

    // Subscribe to session
    client.subscribe("nba_jam", "lobby.sessions." + sessionId);

    return { success: true, rejoined: false };
}

// Leave a session
function leaveGameSession(client, sessionId) {
    var myId = createPlayerIdentifier();

    client.lock("nba_jam", "lobby.sessions." + sessionId, LOCK_WRITE);

    var session = client.read("nba_jam", "lobby.sessions." + sessionId);
    if (!session) {
        client.unlock("nba_jam", "lobby.sessions." + sessionId);
        return;
    }

    // Remove player
    delete session.players[myId.globalId];
    delete session.readyStatus[myId.globalId];

    removePlayerFromTeams(session, myId.globalId);

    var index = session.playerList.indexOf(myId.globalId);
    if (index >= 0) {
        session.playerList.splice(index, 1);
    }

    session.lastActivity = Date.now();
    session.status = SESSION_STATUS.WAITING;

    // If host left, assign new host or close session
    if (session.host === myId.globalId) {
        if (session.playerList.length > 0) {
            var newHostId = session.playerList[0];
            session.host = newHostId;
            session.hostPlayer = session.players[newHostId];
        } else {
            // No players left, mark as finished
            session.status = SESSION_STATUS.FINISHED;
        }
    }

    client.write("nba_jam", "lobby.sessions." + sessionId, session);

    // Post leave message (before unlock)
    postSessionChatMessage(client, sessionId, null, myId.displayName + " left");

    client.unlock("nba_jam", "lobby.sessions." + sessionId);

    // Unsubscribe
    client.unsubscribe("nba_jam", "lobby.sessions." + sessionId);
}

function selectTeamAndPlayer(client, sessionId, teamInput, rosterIndex) {
    var myId = createPlayerIdentifier();
    var result = { success: false };

    client.lock("nba_jam", "lobby.sessions." + sessionId, LOCK_WRITE);

    try {
        var session = client.read("nba_jam", "lobby.sessions." + sessionId);
        if (!session) {
            result.error = "Session not found";
            return result;
        }

        ensureTeamContainers(session);

        var input = teamInput ? String(teamInput).trim() : "";
        var normalizedInput = input.toLowerCase();
        var clearingSelection = (normalizedInput === "" || normalizedInput === "none" || normalizedInput === "clear");

        if (clearingSelection) {
            var removedSide = removePlayerFromTeams(session, myId.globalId);
            session.readyStatus[myId.globalId] = false;
            session.status = SESSION_STATUS.WAITING;
            session.lastActivity = Date.now();

            client.write("nba_jam", "lobby.sessions." + sessionId, session);

            result.success = true;
            result.cleared = true;
            result.message = removedSide ? "Selection cleared" : "No team selection to clear";
            return result;
        }

        var teamKey = MPTeamData.findTeamKey(input);
        if (!teamKey) {
            result.error = "Unknown team";
            return result;
        }

        var teamDef = MPTeamData.getTeam(teamKey);
        if (!teamDef) {
            result.error = "Unknown team";
            return result;
        }

        var redData = session.teams.red;
        var blueData = session.teams.blue;

        var targetSide = null;
        if (redData.name && redData.name === teamKey)
            targetSide = "red";
        if (blueData.name && blueData.name === teamKey)
            targetSide = targetSide || "blue";

        if (!targetSide) {
            if (!redData.name || redData.players.length === 0) {
                targetSide = "red";
            } else if (!blueData.name || blueData.players.length === 0) {
                targetSide = "blue";
            } else {
                result.error = "Both teams already selected";
                return result;
            }
        }

        var opponentSide = targetSide === "red" ? "blue" : "red";
        if (session.teams[opponentSide].name === teamKey && session.teams[opponentSide].players.length > 0) {
            result.error = "That team is reserved by the opponents";
            return result;
        }

        // Remove existing assignment prior to re-adding
        removePlayerFromTeams(session, myId.globalId);

        var sideData = session.teams[targetSide];
        if (sideData.players.length >= 2 && sideData.players.indexOf(myId.globalId) === -1) {
            result.error = "Team is full";
            return result;
        }

        var index = clampRosterIndex(rosterIndex, teamDef);

        // Ensure roster slot not already taken
        if (sideData.roster) {
            for (var pid in sideData.roster) {
                if (!sideData.roster.hasOwnProperty(pid))
                    continue;
                if (pid !== myId.globalId && sideData.roster[pid] && sideData.roster[pid].index === index) {
                    result.error = "Teammate already selected that player";
                    return result;
                }
            }
        }

        if (sideData.players.indexOf(myId.globalId) === -1)
            sideData.players.push(myId.globalId);

        sideData.name = teamKey;
        sideData.abbr = teamDef.abbr;
        sideData.roster[myId.globalId] = { index: index };
        sideData.cpuIndex = determineCpuIndexForSide(sideData, teamDef);

        session.readyStatus[myId.globalId] = false;
        session.status = SESSION_STATUS.WAITING;
        session.lastActivity = Date.now();

        client.write("nba_jam", "lobby.sessions." + sessionId, session);

        var playerName = getRosterPlayerName(teamDef, index) || teamDef.name;
        postSessionChatMessage(client, sessionId, null,
            myId.displayName + " selected " + teamDef.name + " as " + playerName);

        result.success = true;
        result.teamKey = teamKey;
        result.teamName = teamDef.name;
        result.playerName = playerName;
        result.side = targetSide;
        result.index = index;
        return result;
    } finally {
        client.unlock("nba_jam", "lobby.sessions." + sessionId);
    }
    return result;
}

// Set ready status
function setPlayerReady(client, sessionId, ready) {
    var myId = createPlayerIdentifier();

    var result = { success: false, allReady: false };

    client.lock("nba_jam", "lobby.sessions." + sessionId, LOCK_WRITE);

    try {
        var session = client.read("nba_jam", "lobby.sessions." + sessionId);
        if (!session) {
            result.error = "Session not found";
            return result;
        }

        ensureTeamContainers(session);

        var validation = null;
        if (ready) {
            validation = playerHasValidSelection(session, myId.globalId);
            if (!validation.valid) {
                ready = false;
                result.error = validation.reason;
            }
        }

        session.readyStatus[myId.globalId] = !!ready;
        session.lastActivity = Date.now();

        var allReady = false;
        if (ready) {
            allReady = checkAllPlayersReady(session);
        }

        if (allReady && session.playerList.length >= session.config.minPlayers) {
            session.status = SESSION_STATUS.READY;
        } else {
            session.status = SESSION_STATUS.WAITING;
        }

        client.write("nba_jam", "lobby.sessions." + sessionId, session);

        result.success = !result.error;
        result.allReady = allReady;
        return result;
    } finally {
        client.unlock("nba_jam", "lobby.sessions." + sessionId);
    }
}

// Check if all players are ready
function checkAllPlayersReady(session) {
    if (!session || !session.playerList || session.playerList.length === 0)
        return false;

    ensureTeamContainers(session);

    for (var i = 0; i < session.playerList.length; i++) {
        var playerId = session.playerList[i];
        if (!session.readyStatus[playerId])
            return false;
        var validation = playerHasValidSelection(session, playerId);
        if (!validation.valid)
            return false;
    }

    if (!session.teams.red.name || !session.teams.blue.name)
        return false;
    if (session.teams.red.name === session.teams.blue.name)
        return false;
    if (session.teams.red.players.length === 0 || session.teams.blue.players.length === 0)
        return false;

    return true;
}

// Post chat message to session
function postSessionChatMessage(client, sessionId, fromPlayer, message) {
    var msg = {
        from: fromPlayer ? fromPlayer.globalId : null,
        fromName: fromPlayer ? fromPlayer.displayName : "System",
        text: message,
        timestamp: Date.now()
    };

    // Append to chat history (no lock - called within locked contexts)
    client.push("nba_jam", "lobby.sessions." + sessionId + ".chatMessages", msg);
}

// Get recent chat messages
function getSessionChatMessages(client, sessionId, limit) {
    limit = limit || 20;

    var messages = client.slice("nba_jam",
        "lobby.sessions." + sessionId + ".chatMessages",
        -limit,
        undefined,
        1);

    return messages || [];
}

// Assign player to team
function assignPlayerToTeam(client, sessionId, playerId, team) {
    if (team !== "red" && team !== "blue") return false;

    client.lock("nba_jam", "lobby.sessions." + sessionId, LOCK_WRITE);

    var session = client.read("nba_jam", "lobby.sessions." + sessionId);
    if (!session) {
        client.unlock("nba_jam", "lobby.sessions." + sessionId);
        return false;
    }

    // Remove from both teams first
    var redIndex = session.teams.red.players.indexOf(playerId);
    if (redIndex >= 0) {
        session.teams.red.players.splice(redIndex, 1);
    }

    var blueIndex = session.teams.blue.players.indexOf(playerId);
    if (blueIndex >= 0) {
        session.teams.blue.players.splice(blueIndex, 1);
    }

    // Add to new team
    session.teams[team].players.push(playerId);
    session.lastActivity = Date.now();

    client.write("nba_jam", "lobby.sessions." + sessionId, session);
    client.unlock("nba_jam", "lobby.sessions." + sessionId);

    return true;
}

// Start game session
function startGameSession(client, sessionId) {
    client.lock("nba_jam", "lobby.sessions." + sessionId, LOCK_WRITE);

    var session = client.read("nba_jam", "lobby.sessions." + sessionId);
    if (!session) {
        client.unlock("nba_jam", "lobby.sessions." + sessionId);
        return false;
    }

    ensureTeamContainers(session);

    // If game already started, return success (idempotent)
    if (session.status === SESSION_STATUS.PLAYING) {
        client.unlock("nba_jam", "lobby.sessions." + sessionId);
        return true;
    }

    // Validate start conditions
    if (session.playerList.length < session.config.minPlayers) {
        client.unlock("nba_jam", "lobby.sessions." + sessionId);
        return false;
    }

    if (!checkAllPlayersReady(session)) {
        client.unlock("nba_jam", "lobby.sessions." + sessionId);
        return false;
    }

    // Assign coordinator (host)
    session.coordinator = session.host;
    session.status = SESSION_STATUS.PLAYING;
    session.lastActivity = Date.now();

    client.write("nba_jam", "lobby.sessions." + sessionId, session);
    client.unlock("nba_jam", "lobby.sessions." + sessionId);

    // Copy session to active game namespace
    client.write("nba_jam", "game." + sessionId + ".meta", session, 2);
    client.write("nba_jam", "game." + sessionId + ".state", {
        t: Date.now(),
        f: 0,
        p: [],
        b: { x: 0, y: 0, c: null, r: false, rx: 0, ry: 0 },
        g: {}
    }, LOCK_WRITE);
    client.write("nba_jam", "game." + sessionId + ".events", [], LOCK_WRITE);

    return true;
}

// Clean up old sessions (call periodically)
function cleanupOldSessions(client, maxAgeMs) {
    maxAgeMs = maxAgeMs || 3600000; // 1 hour default

    if (client.lock("nba_jam", "lobby.sessions", LOCK_WRITE) === false)
        return 0;

    var cleaned = 0;
    try {
        var allSessions = client.read("nba_jam", "lobby.sessions");
        if (!allSessions)
            return cleaned;

        var now = Date.now();

        for (var sessionId in allSessions) {
            var session = allSessions[sessionId];
            if (!session) continue;

            var age = now - session.lastActivity;

            if (age > maxAgeMs || session.status === SESSION_STATUS.FINISHED) {
                delete allSessions[sessionId];
                cleaned++;
            }
        }

        if (cleaned > 0)
            client.write("nba_jam", "lobby.sessions", allSessions);

        return cleaned;
    } finally {
        try {
            client.unlock("nba_jam", "lobby.sessions");
        } catch (ignore) { }
    }
}

var sessionsGlobal = (typeof global !== "undefined") ? global : this;
if (sessionsGlobal) {
    sessionsGlobal.SESSION_STATUS = SESSION_STATUS;
    sessionsGlobal.ensureTeamContainers = ensureTeamContainers;
    sessionsGlobal.listGameSessions = listGameSessions;
    sessionsGlobal.createGameSession = createGameSession;
    sessionsGlobal.joinGameSession = joinGameSession;
    sessionsGlobal.leaveGameSession = leaveGameSession;
    sessionsGlobal.selectTeamAndPlayer = selectTeamAndPlayer;
    sessionsGlobal.setPlayerReady = setPlayerReady;
    sessionsGlobal.startGameSession = startGameSession;
    sessionsGlobal.cleanupOldSessions = cleanupOldSessions;
}
