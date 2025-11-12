// State Manager - Centralized state with change tracking
// Wave 23: Architecture Foundation

/**
 * Creates a state manager that wraps game state with:
 * - Change tracking/logging
 * - Subscription system
 * - Snapshot/restore for testing
 * - Path-based access
 */
function createStateManager(initialState) {
    var state = initialState || {};
    var listeners = {}; // path -> [callbacks]
    var changeLog = [];
    var logEnabled = true;

    /**
     * Get a value from state by path
     * @param {string} path - Dot-notation path (e.g., 'ballCarrier.x')
     * @returns {*} Value at path, or undefined
     */
    function get(path) {
        if (!path) return state;

        var parts = path.split('.');
        var current = state;

        for (var i = 0; i < parts.length; i++) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[parts[i]];
        }

        return current;
    }

    /**
     * Set a value in state by path
     * @param {string} path - Dot-notation path
     * @param {*} value - New value
     * @param {string} reason - Optional reason for change (for logging)
     */
    function set(path, value, reason) {
        var oldValue = get(path);

        // Handle root-level sets
        if (!path || path === '') {
            state = value;
            notify('', oldValue, value);
            logChange('', oldValue, value, reason);
            return;
        }

        var parts = path.split('.');
        var current = state;

        // Navigate to parent
        for (var i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] === undefined) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        // Set value
        var lastKey = parts[parts.length - 1];
        current[lastKey] = value;

        // Diagnostic: capture shotInProgress mutations to trace stuck-state bugs
        if (path === "shotInProgress" && typeof debugLog === "function") {
            try {
                var currentPhase = get("phase.current");
                var inbounding = get("inbounding");
                debugLog("[STATE TRACE] shotInProgress set to " + value + " (was " + oldValue + ")" +
                    (reason ? ", reason=" + reason : ", reason=unknown") +
                    ", phase=" + (currentPhase || "unknown") +
                    ", inbounding=" + (inbounding !== undefined ? inbounding : "unknown"));
            } catch (stateTraceError) {
                debugLog("[STATE TRACE] shotInProgress logging failed: " + stateTraceError);
            }
        }

        // Wave 24: Track courtNeedsRedraw to find source of constant redraws
        if (path === "courtNeedsRedraw" && value === true && typeof debugLog === "function") {
            debugLog("[COURT REDRAW] Set to TRUE, reason=" + (reason || "unknown"));
        }

        // Notify listeners
        notify(path, oldValue, value);
        logChange(path, oldValue, value, reason);
    }    /**
     * Batch multiple state changes
     * @param {function} mutator - Function that receives state and modifies it
     * @param {string} reason - Optional reason for changes
     */
    function mutate(mutator, reason) {
        var snapshot = getSnapshot();

        try {
            mutator(state);
            logChange('*', snapshot, getSnapshot(), reason || 'batch_mutation');
            notify('*', snapshot, state);
        } catch (e) {
            // Rollback on error
            state = snapshot;
            throw e;
        }
    }

    /**
     * Subscribe to changes at a path
     * @param {string} path - Path to watch (or '*' for all changes)
     * @param {function} callback - Called with (path, oldValue, newValue)
     */
    function subscribe(path, callback) {
        if (!listeners[path]) {
            listeners[path] = [];
        }
        listeners[path].push(callback);

        // Return unsubscribe function
        return function unsubscribe() {
            var index = listeners[path].indexOf(callback);
            if (index > -1) {
                listeners[path].splice(index, 1);
            }
        };
    }

    /**
     * Notify all listeners for a path
     */
    function notify(path, oldValue, newValue) {
        // Notify specific path listeners
        if (listeners[path]) {
            for (var i = 0; i < listeners[path].length; i++) {
                try {
                    listeners[path][i](path, oldValue, newValue);
                } catch (e) {
                    if (typeof log === "function") {
                        log(LOG_ERR, "State listener error: " + e);
                    }
                }
            }
        }

        // Notify wildcard listeners
        if (path !== '*' && listeners['*']) {
            for (var j = 0; j < listeners['*'].length; j++) {
                try {
                    listeners['*'][j](path, oldValue, newValue);
                } catch (e) {
                    if (typeof log === "function") {
                        log(LOG_ERR, "State listener error: " + e);
                    }
                }
            }
        }
    }

    /**
     * Log state change for debugging
     */
    function logChange(path, oldValue, newValue, reason) {
        if (!logEnabled) return;

        var change = {
            timestamp: Date.now(),
            path: path,
            oldValue: oldValue,
            newValue: newValue,
            reason: reason || 'unknown'
        };

        changeLog.push(change);

        // Keep log size manageable (last 100 changes)
        if (changeLog.length > 100) {
            changeLog.shift();
        }

        // NO console logging - player objects have circular refs
    }

    /**
     * Get immutable snapshot of current state
     * @returns {Object} Deep clone of state
     */
    function getSnapshot() {
        return JSON.parse(JSON.stringify(state));
    }

    /**
     * Restore state from snapshot
     * @param {Object} snapshot - Previously captured snapshot
     */
    function restore(snapshot) {
        state = JSON.parse(JSON.stringify(snapshot));
        notify('*', null, state);
    }

    /**
     * Get change log
     * @returns {Array} Array of change records
     */
    function getChangeLog() {
        return changeLog.slice(); // Return copy
    }

    /**
     * Clear change log
     */
    function clearChangeLog() {
        changeLog = [];
    }

    /**
     * Enable/disable change logging
     */
    function setLogging(enabled) {
        logEnabled = enabled;
    }

    // Public API
    return {
        get: get,
        set: set,
        mutate: mutate,
        subscribe: subscribe,
        getSnapshot: getSnapshot,
        restore: restore,
        getChangeLog: getChangeLog,
        clearChangeLog: clearChangeLog,
        setLogging: setLogging,

        // Direct access (for migration period)
        // TODO: Remove once all code uses get/set
        raw: state
    };
}

// Example usage:
// var stateMgr = createStateManager(gameState);
// stateMgr.set('ballCarrier', player1, 'pass_complete');
// var carrier = stateMgr.get('ballCarrier');
// stateMgr.subscribe('ballCarrier', function(path, old, new) {
//     console.log('Ball carrier changed from', old, 'to', new);
// });
