/**
 * NBA JAM - Event System
 * 
 * Observer pattern for game events
 * Decouples game logic from UI/multiplayer/stats
 * 
 * Example Usage:
 * ```
 * // Subscribe
 * onGameEvent("violation", function(data) {
 *     announceEvent("backcourt_violation", data);
 * });
 * 
 * // Emit
 * emitGameEvent("violation", { type: "backcourt", team: "teamA" });
 * ```
 */

/**
 * Event listeners registry
 * Structure: { eventType: [callback1, callback2, ...] }
 */
var eventListeners = {};

/**
 * Subscribe to a game event
 * @param {string} eventType - Type of event (e.g., "violation", "score", "steal")
 * @param {Function} callback - Callback function to invoke when event fires
 * @returns {Function} Unsubscribe function
 */
function onGameEvent(eventType, callback) {
    if (!eventListeners[eventType]) {
        eventListeners[eventType] = [];
    }
    
    eventListeners[eventType].push(callback);
    
    // Return unsubscribe function
    return function unsubscribe() {
        var listeners = eventListeners[eventType];
        if (!listeners) return;
        
        var index = listeners.indexOf(callback);
        if (index !== -1) {
            listeners.splice(index, 1);
        }
    };
}

/**
 * Emit a game event to all subscribed listeners
 * @param {string} eventType - Type of event
 * @param {Object} data - Event data payload
 */
function emitGameEvent(eventType, data) {
    var listeners = eventListeners[eventType];
    if (!listeners || listeners.length === 0) return;
    
    // Invoke all listeners with event data
    for (var i = 0; i < listeners.length; i++) {
        try {
            listeners[i](data);
        } catch (e) {
            // Log error but continue processing other listeners
            if (typeof log === "function") {
                log(LOG_ERROR, "NBA JAM: Event listener error for '" + eventType + "': " + e);
            }
        }
    }
}

/**
 * Remove all listeners for a specific event type
 * @param {string} eventType - Event type to clear
 */
function clearGameEventListeners(eventType) {
    if (eventType) {
        delete eventListeners[eventType];
    } else {
        // Clear all listeners if no type specified
        eventListeners = {};
    }
}

/**
 * Get number of listeners for an event type (for testing)
 * @param {string} eventType - Event type
 * @returns {number} Number of listeners
 */
function getEventListenerCount(eventType) {
    var listeners = eventListeners[eventType];
    return listeners ? listeners.length : 0;
}

/**
 * Standard game event types (for reference)
 * These are commonly used event types - not exhaustive
 */
var GameEventTypes = {
    // Scoring
    SCORE: "score",                      // { team, points, player, method }
    ASSIST: "assist",                    // { player, assistedPlayer }
    
    // Violations
    VIOLATION: "violation",              // { type, team, details }
    
    // Turnovers
    TURNOVER: "turnover",                // { type, team, player, cause }
    STEAL: "steal",                      // { defender, ballCarrier }
    
    // Defensive plays
    BLOCK: "block",                      // { defender, shooter }
    DEFLECTION: "deflection",            // { defender, passer }
    
    // Possession changes
    POSSESSION_CHANGE: "possession_change", // { fromTeam, toTeam, reason }
    REBOUND: "rebound",                  // { player, type: "offensive"|"defensive" }
    
    // Shot attempts
    SHOT_ATTEMPT: "shot_attempt",        // { player, distance, contested }
    SHOT_MADE: "shot_made",              // { player, points, distance }
    SHOT_MISSED: "shot_missed",          // { player, reason }
    
    // Game flow
    QUARTER_END: "quarter_end",          // { quarter }
    GAME_END: "game_end",                // { winner, finalScore }
    TIMEOUT: "timeout",                  // { team }
    
    // Multiplayer
    PLAYER_JOINED: "player_joined",      // { playerId, playerName }
    PLAYER_LEFT: "player_left",          // { playerId, reason }
    SYNC_STATE: "sync_state",            // { state }
};
