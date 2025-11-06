/*	NBA JAM JSON DB module service script
    This is loaded automatically by the JSON service, and runs in the
    background handling multiplayer sessions, lobbies, and game state. */

// Loop forever
js.branch_limit = 0;
js.time_limit = 0;

// The JSON service passes the module's working directory as argv[0]
var root = argv[0];

load("sbbsdefs.js");
load("json-client.js");

// We'll need a JSON client handle in various functions within this script
var jsonClient;

// Database name
var DBNAME = "nba_jam";

// Cleanup interval (5 minutes)
var CLEANUP_INTERVAL = 5 * 60 * 1000;
var lastCleanup = Date.now();

// Session timeout (30 minutes of inactivity)
var SESSION_TIMEOUT = 30 * 60 * 1000;

// Lobby timeout (5 minutes of inactivity)
var LOBBY_TIMEOUT = 5 * 60 * 1000;

function init() {
    jsonClient = new JSONClient("localhost", server.port);
    if (!jsonClient.connect()) {
        log(LOG_ERR, "NBA JAM service: Unable to connect to JSON service");
        exit(1);
    }

    // Initialize database structure if needed
    try {
        var db = jsonClient.read(DBNAME, "", 1);
        if (!db) {
            jsonClient.write(DBNAME, "", {
                lobbies: {},
                sessions: {},
                stats: {}
            }, 2);
        }
    } catch (e) {
        log(LOG_WARNING, "NBA JAM service: Error initializing database: " + e);
    }

    log(LOG_INFO, "NBA JAM service: Started successfully");
}

function cleanup() {
    var now = Date.now();

    try {
        // Clean up stale lobbies
        var lobbies = jsonClient.read(DBNAME, "lobbies", 1);
        if (lobbies && typeof lobbies === "object") {
            for (var lobbyId in lobbies) {
                if (!lobbies.hasOwnProperty(lobbyId)) continue;
                var lobby = lobbies[lobbyId];

                if (lobby && lobby.lastActivity) {
                    var inactiveTime = now - lobby.lastActivity;
                    if (inactiveTime > LOBBY_TIMEOUT) {
                        jsonClient.remove(DBNAME, "lobbies." + lobbyId, 2);
                        log(LOG_INFO, "NBA JAM service: Cleaned up stale lobby: " + lobbyId);
                    }
                }
            }
        }

        // Clean up stale sessions
        var sessions = jsonClient.read(DBNAME, "sessions", 1);
        if (sessions && typeof sessions === "object") {
            for (var sessionId in sessions) {
                if (!sessions.hasOwnProperty(sessionId)) continue;
                var session = sessions[sessionId];

                if (session && session.lastActivity) {
                    var inactiveTime = now - session.lastActivity;
                    if (inactiveTime > SESSION_TIMEOUT) {
                        jsonClient.remove(DBNAME, "sessions." + sessionId, 2);
                        log(LOG_INFO, "NBA JAM service: Cleaned up stale session: " + sessionId);
                    }
                }
            }
        }

    } catch (e) {
        log(LOG_WARNING, "NBA JAM service: Error during cleanup: " + e);
    }

    lastCleanup = now;
}

function handleUpdate(update) {
    // This function is called when the JSON DB receives an update
    // Currently we don't need to handle updates actively, but this
    // is where you'd put logic for real-time notifications, etc.
}

// Initialize the service
init();

// Main service loop
while (!js.terminated) {
    // Check for updates
    jsonClient.cycle();

    // Handle any updates
    while (jsonClient.updates.length > 0) {
        var update = jsonClient.updates.shift();
        handleUpdate(update);
    }

    // Periodic cleanup
    var now = Date.now();
    if (now - lastCleanup > CLEANUP_INTERVAL) {
        cleanup();
    }

    // Sleep briefly to avoid consuming CPU
    mswait(100);
}

// Cleanup on exit
if (jsonClient) {
    jsonClient.disconnect();
}

log(LOG_INFO, "NBA JAM service: Stopped");
