/**
 * NBA JAM - Coordinator Failover System
 * 
 * Handles coordinator election when current coordinator disconnects
 * Ensures multiplayer games can continue without crashing
 */

/**
 * Elect a new coordinator from active players
 * Uses deterministic selection (alphabetically first by globalId)
 * to ensure all clients elect the same coordinator
 * 
 * @param {Object} session - Game session metadata
 * @param {Object} client - JSON-DB client
 * @returns {string|null} New coordinator's globalId, or null if no players available
 */
function electNewCoordinator(session, client) {
    if (!session || !session.playerList) {
        return null;
    }

    var players = session.playerList || [];
    if (players.length === 0) {
        return null;
    }

    // Sort players deterministically (alphabetically by globalId)
    // All clients will elect the same coordinator this way
    var sortedPlayers = players.slice().sort(function (a, b) {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    });

    var newCoordinator = sortedPlayers[0];


    return newCoordinator;
}

/**
 * Write new coordinator to database and notify clients
 * 
 * @param {string} sessionId - Session ID
 * @param {string} newCoordinatorId - New coordinator's globalId
 * @param {Object} client - JSON-DB client
 * @returns {boolean} True if write succeeded
 */
function promoteToCoordinator(sessionId, newCoordinatorId, client) {
    if (!sessionId || !newCoordinatorId || !client) {
        return false;
    }

    try {
        // Write new coordinator to database
        var key = "game." + sessionId + ".coordinator";
        client.write("nba_jam", key, newCoordinatorId);


        // Emit event for notification
        emitGameEvent("coordinator_changed", {
            sessionId: sessionId,
            newCoordinator: newCoordinatorId
        });

        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Check if current coordinator is still active
 * 
 * @param {string} coordinatorId - Current coordinator's globalId
 * @param {Object} session - Session metadata
 * @returns {boolean} True if coordinator is still in player list
 */
function isCoordinatorActive(coordinatorId, session) {
    if (!coordinatorId || !session || !session.playerList) {
        return false;
    }

    var players = session.playerList || [];
    for (var i = 0; i < players.length; i++) {
        if (players[i] === coordinatorId) {
            return true;
        }
    }

    return false;
}

/**
 * Attempt coordinator failover
 * Called when coordinator disconnect is detected
 * 
 * @param {string} sessionId - Session ID
 * @param {Object} client - JSON-DB client
 * @returns {string|null} New coordinator ID if successful, null otherwise
 */
function attemptCoordinatorFailover(sessionId, client) {
    if (!sessionId || !client) {
        return null;
    }

    try {
        // Re-read session to get current player list
        var sessionKey = "game." + sessionId + ".meta";
        var session = client.read("nba_jam", sessionKey, 1);

        if (!session) {
            return null;
        }

        // Elect new coordinator
        var newCoordinator = electNewCoordinator(session, client);

        if (!newCoordinator) {
            return null;
        }

        // Promote new coordinator
        var success = promoteToCoordinator(sessionId, newCoordinator, client);

        if (success) {
            return newCoordinator;
        } else {
            return null;
        }

    } catch (e) {
        return null;
    }
}

/**
 * Monitor coordinator health and trigger failover if needed
 * Should be called periodically (e.g., every second) by all clients
 * 
 * @param {string} sessionId - Session ID
 * @param {string} myId - This client's globalId  
 * @param {Object} client - JSON-DB client
 * @returns {Object} { needsFailover: boolean, newCoordinator: string|null }
 */
function checkCoordinatorHealth(sessionId, myId, client) {
    var result = {
        needsFailover: false,
        newCoordinator: null
    };

    if (!sessionId || !myId || !client) {
        return result;
    }

    try {
        // Read current coordinator
        var coordKey = "game." + sessionId + ".coordinator";
        var currentCoordinator = client.read("nba_jam", coordKey, 1);

        if (!currentCoordinator) {
            // No coordinator - needs election
            result.needsFailover = true;
            return result;
        }

        // Read session to check if coordinator is still in player list
        var sessionKey = "game." + sessionId + ".meta";
        var session = client.read("nba_jam", sessionKey, 1);

        if (!session) {
            return result; // Session gone, nothing to do
        }

        // Check if coordinator is still active
        if (!isCoordinatorActive(currentCoordinator, session)) {
            // Coordinator disconnected - trigger failover
            result.needsFailover = true;
        }

        return result;

    } catch (e) {
        return result;
    }
}
