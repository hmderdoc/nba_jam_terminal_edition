/**
 * NBA JAM - Multiplayer Input Replay Buffer
 * 
 * Implements client-side input replay for lag compensation.
 * When the server corrects client state, replayed inputs prevent lost actions.
 * 
 * USAGE:
 * 1. recordInput(input, frameNumber) - Store input with frame
 * 2. On server reconciliation: replayInputsSince(serverFrame)
 * 3. pruneOldInputs() - Clean up history periodically
 */

// === INPUT HISTORY BUFFER ===
var inputHistory = [];
var MAX_INPUT_HISTORY = 120; // ~6 seconds at 20 FPS

/**
 * Record an input for potential replay
 * @param {Object} input - Input data (key, playerId, etc)
 * @param {number} frameNumber - Frame when input occurred
 */
function recordInput(input, frameNumber) {
    if (!input || typeof frameNumber !== "number") {
        try {
            log(LOG_WARNING, "recordInput: invalid input or frameNumber");
        } catch (e) { }
        return;
    }

    inputHistory.push({
        input: input,
        frame: frameNumber,
        timestamp: Date.now()
    });

    // Prune old inputs to prevent memory leak
    if (inputHistory.length > MAX_INPUT_HISTORY) {
        inputHistory.shift();
    }
}

/**
 * Replay all inputs that occurred after a given frame
 * Used after server reconciliation to re-apply local inputs
 * 
 * @param {number} serverFrame - Server's authoritative frame number
 * @param {Function} inputHandler - Function to process each input
 * @returns {number} Number of inputs replayed
 */
function replayInputsSince(serverFrame, inputHandler) {
    if (typeof serverFrame !== "number") {
        try {
            log(LOG_WARNING, "replayInputsSince: invalid serverFrame");
        } catch (e) { }
        return 0;
    }

    if (typeof inputHandler !== "function") {
        try {
            log(LOG_WARNING, "replayInputsSince: inputHandler must be a function");
        } catch (e) { }
        return 0;
    }

    var replayedCount = 0;

    // Find all inputs that occurred after the server's frame
    for (var i = 0; i < inputHistory.length; i++) {
        var record = inputHistory[i];

        if (record.frame > serverFrame) {
            try {
                // Re-apply the input
                inputHandler(record.input);
                replayedCount++;

                try {
                    log(LOG_DEBUG, "Replayed input from frame " + record.frame +
                        " (server was at " + serverFrame + ")");
                } catch (e) { }
            } catch (error) {
                try {
                    log(LOG_ERROR, "Error replaying input: " + error);
                } catch (e) { }
            }
        }
    }

    try {
        if (replayedCount > 0) {
            log(LOG_INFO, "Replayed " + replayedCount + " inputs after server reconciliation");
        }
    } catch (e) { }

    return replayedCount;
}

/**
 * Remove inputs older than a certain frame or age
 * Call this periodically to prevent memory bloat
 * 
 * @param {number} oldestFrameToKeep - Discard inputs older than this frame
 */
function pruneOldInputs(oldestFrameToKeep) {
    if (typeof oldestFrameToKeep !== "number") {
        // Fallback: prune by age (older than 10 seconds)
        var cutoffTime = Date.now() - 10000;
        inputHistory = inputHistory.filter(function (record) {
            return record.timestamp > cutoffTime;
        });
        return;
    }

    // Prune by frame number
    inputHistory = inputHistory.filter(function (record) {
        return record.frame >= oldestFrameToKeep;
    });

    try {
        log(LOG_DEBUG, "Pruned input history, kept " + inputHistory.length + " recent inputs");
    } catch (e) { }
}

/**
 * Clear all input history
 * Use when disconnecting or starting new game
 */
function clearInputHistory() {
    inputHistory = [];
    try {
        log(LOG_DEBUG, "Cleared input history");
    } catch (e) { }
}

/**
 * Get current input history size (for debugging/monitoring)
 * @returns {number} Number of inputs in history
 */
function getInputHistorySize() {
    return inputHistory.length;
}

/**
 * Check if input replay is available
 * @returns {boolean} True if there are inputs in history
 */
function hasInputHistory() {
    return inputHistory.length > 0;
}
