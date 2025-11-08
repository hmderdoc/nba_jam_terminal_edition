// Event Bus - Decoupled event system
// Wave 23: Architecture Foundation

/**
 * Creates an event bus for decoupled communication between systems
 * Allows systems to emit events without knowing who handles them
 */
function createEventBus() {
    var handlers = {}; // eventType -> [callbacks]
    var eventLog = [];
    var logEnabled = true;

    /**
     * Emit an event
     * @param {string} eventType - Type of event (e.g., 'pass_complete')
     * @param {*} data - Event data
     */
    function emit(eventType, data) {
        // Log event (safely handle circular refs)
        if (logEnabled) {
            var event = {
                timestamp: Date.now(),
                type: eventType,
                data: data
            };
            eventLog.push(event);

            // Keep log size manageable
            if (eventLog.length > 100) {
                eventLog.shift();
            }

            if (typeof log === "function" && typeof LOG_DEBUG !== "undefined") {
                // Safely stringify event data (avoid circular refs)
                var dataStr = eventType;
                try {
                    // Try to extract useful info without full JSON.stringify
                    if (data && typeof data === 'object') {
                        if (data.player && data.player.playerData && data.player.playerData.name) {
                            dataStr += " player=" + data.player.playerData.name;
                        }
                        if (data.passer && data.passer.playerData && data.passer.playerData.name) {
                            dataStr += " passer=" + data.passer.playerData.name;
                        }
                        if (data.receiver && data.receiver.playerData && data.receiver.playerData.name) {
                            dataStr += " receiver=" + data.receiver.playerData.name;
                        }
                        if (data.interceptor && data.interceptor.playerData && data.interceptor.playerData.name) {
                            dataStr += " interceptor=" + data.interceptor.playerData.name;
                        }
                        if (data.team) {
                            dataStr += " team=" + data.team;
                        }
                        if (data.type) {
                            dataStr += " type=" + data.type;
                        }
                    }
                } catch (e) {
                    dataStr = eventType + " (stringify error)";
                }
                log(LOG_DEBUG, "[EVENT] " + dataStr);
            }
        }

        // Call all registered handlers
        if (handlers[eventType]) {
            for (var i = 0; i < handlers[eventType].length; i++) {
                try {
                    handlers[eventType][i](data, eventType);
                } catch (e) {
                    if (typeof log === "function") {
                        log(LOG_ERR, "Event handler error for " + eventType + ": " + e);
                    }
                }
            }
        }

        // Call wildcard handlers
        if (handlers['*']) {
            for (var j = 0; j < handlers['*'].length; j++) {
                try {
                    handlers['*'][j](data, eventType);
                } catch (e) {
                    if (typeof log === "function") {
                        log(LOG_ERR, "Wildcard event handler error: " + e);
                    }
                }
            }
        }
    }

    /**
     * Register an event handler
     * @param {string} eventType - Type of event to listen for (or '*' for all)
     * @param {function} callback - Handler function(data, eventType)
     * @returns {function} Unsubscribe function
     */
    function on(eventType, callback) {
        if (!handlers[eventType]) {
            handlers[eventType] = [];
        }
        handlers[eventType].push(callback);

        // Return unsubscribe function
        return function off() {
            var index = handlers[eventType].indexOf(callback);
            if (index > -1) {
                handlers[eventType].splice(index, 1);
            }
        };
    }

    /**
     * Remove an event handler
     * @param {string} eventType - Type of event
     * @param {function} callback - Handler to remove
     */
    function off(eventType, callback) {
        if (handlers[eventType]) {
            var index = handlers[eventType].indexOf(callback);
            if (index > -1) {
                handlers[eventType].splice(index, 1);
            }
        }
    }

    /**
     * Remove all handlers for an event type
     * @param {string} eventType - Type of event (or omit to clear all)
     */
    function clear(eventType) {
        if (eventType) {
            handlers[eventType] = [];
        } else {
            handlers = {};
        }
    }

    /**
     * Get event log
     * @returns {Array} Array of event records
     */
    function getEventLog() {
        return eventLog.slice(); // Return copy
    }

    /**
     * Clear event log
     */
    function clearEventLog() {
        eventLog = [];
    }

    /**
     * Enable/disable event logging
     */
    function setLogging(enabled) {
        logEnabled = enabled;
    }

    // Public API
    return {
        emit: emit,
        on: on,
        off: off,
        clear: clear,
        getEventLog: getEventLog,
        clearEventLog: clearEventLog,
        setLogging: setLogging
    };
}

// Example usage:
// var events = createEventBus();
// 
// // Announcer subscribes to events
// events.on('pass_complete', function(data) {
//     announceEvent('pass', data);
// });
//
// // Passing system emits events
// events.emit('pass_complete', {
//     passer: player1,
//     receiver: player2,
//     team: 'teamA'
// });
