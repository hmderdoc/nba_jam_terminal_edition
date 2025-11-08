/**
 * Error Handler - Centralized error logging and state capture
 * 
 * Features:
 * - Automatic error logging to error.log
 * - Game state snapshots on errors
 * - Stack trace capture
 * - Auto-generate reproducible test cases
 * - Severity levels (FATAL, ERROR, WARN)
 */

var ERROR_LOG_PATH = "error.log";
var STATE_SNAPSHOT_DIR = "error-snapshots/";

var ErrorSeverity = {
    FATAL: "FATAL",
    ERROR: "ERROR",
    WARN: "WARN"
};

/**
 * Initialize error handler
 * Creates directories and clears old logs if needed
 */
function initErrorHandler() {
    // Ensure snapshot directory exists
    if (!file_isdir(STATE_SNAPSHOT_DIR)) {
        mkdir(STATE_SNAPSHOT_DIR);
    }
}

/**
 * Log error with full context
 * @param {Error|string} error - Error object or message
 * @param {string} severity - ERROR, WARN, or FATAL
 * @param {Object} context - Additional context (function name, systems, etc.)
 */
function logError(error, severity, context) {
    severity = severity || ErrorSeverity.ERROR;
    context = context || {};

    var timestamp = new Date().toISOString();
    var errorMessage = (typeof error === "string") ? error : error.toString();
    var stackTrace = (error && error.stack) ? error.stack : getStackTrace();

    var logEntry = {
        timestamp: timestamp,
        severity: severity,
        message: errorMessage,
        stack: stackTrace,
        context: context,
        gameStateSnapshot: null
    };

    // Capture game state if systems are available in context
    if (context.systems && context.systems.stateManager) {
        logEntry.gameStateSnapshot = captureGameStateSnapshot(context.systems.stateManager);
    }

    // Write to error log
    writeErrorLog(logEntry);

    // If FATAL, also create a detailed snapshot file
    if (severity === ErrorSeverity.FATAL) {
        writeSnapshotFile(logEntry);
        generateReproductionTest(logEntry);
    }

    return logEntry;
}

/**
 * Capture current game state for debugging
 * @param {Object} stateManager - State manager instance
 * @returns {Object} Sanitized game state snapshot
 */
function captureGameStateSnapshot(stateManager) {
    if (!stateManager || typeof stateManager.getAll !== "function") {
        return { error: "StateManager not available" };
    }

    var gameState = stateManager.get();
    if (!gameState) {
        return { error: "Game state not initialized" };
    }

    // Create a safe copy of game state (avoid circular refs)
    var snapshot = {
        phase: gameState.phase ? JSON.parse(JSON.stringify(gameState.phase)) : null,
        currentTeam: gameState.currentTeam,
        currentHalf: gameState.currentHalf,
        timeRemaining: gameState.timeRemaining,
        shotClock: gameState.shotClock,
        score: {
            teamA: gameState.teamAScore,
            teamB: gameState.teamBScore
        },
        ballCarrier: null,
        ballPosition: {
            x: gameState.ballX,
            y: gameState.ballY
        },
        shotInProgress: gameState.shotInProgress,
        reboundActive: gameState.reboundActive,
        inbounding: gameState.inbounding,
        consecutivePoints: gameState.consecutivePoints
    };

    // Safely capture ball carrier info
    if (gameState.ballCarrier) {
        try {
            snapshot.ballCarrier = {
                id: gameState.ballCarrier.id,
                x: gameState.ballCarrier.x,
                y: gameState.ballCarrier.y,
                team: (typeof getPlayerTeamName === "function") ? getPlayerTeamName(gameState.ballCarrier) : "unknown"
            };
        } catch (e) {
            snapshot.ballCarrier = { error: "Could not capture ball carrier: " + e.toString() };
        }
    }

    return snapshot;
}

/**
 * Write error to error.log file
 * @param {Object} logEntry - Error log entry
 */
function writeErrorLog(logEntry) {
    var logFile = new File(ERROR_LOG_PATH);

    // Open in append mode
    if (!logFile.open("a")) {
        print("WARNING: Could not open error log for writing");
        return;
    }

    // Format log entry
    var logLine = format(
        "[%s] %s: %s\n  Context: %s\n  Stack: %s\n\n",
        logEntry.timestamp,
        logEntry.severity,
        logEntry.message,
        JSON.stringify(logEntry.context),
        logEntry.stack
    );

    logFile.write(logLine);
    logFile.close();
}

/**
 * Write detailed snapshot to file
 * @param {Object} logEntry - Error log entry
 */
function writeSnapshotFile(logEntry) {
    var snapshotId = Date.now();
    var filename = STATE_SNAPSHOT_DIR + "snapshot-" + snapshotId + ".json";

    var snapshotFile = new File(filename);
    if (!snapshotFile.open("w")) {
        print("WARNING: Could not write snapshot file");
        return;
    }

    snapshotFile.write(JSON.stringify(logEntry, null, 2));
    snapshotFile.close();

    print("Snapshot saved to: " + filename);
}

/**
 * Generate a reproducible test case from error
 * @param {Object} logEntry - Error log entry
 */
function generateReproductionTest(logEntry) {
    var testId = Date.now();
    var testFilename = STATE_SNAPSHOT_DIR + "test-reproduction-" + testId + ".js";

    var testCode = [
        "/**",
        " * Auto-generated test case for error reproduction",
        " * Generated: " + logEntry.timestamp,
        " * Error: " + logEntry.message,
        " */",
        "",
        "load('lib/utils/test-helpers.js');",
        "",
        "// Captured game state",
        "var capturedState = " + JSON.stringify(logEntry.gameStateSnapshot, null, 2) + ";",
        "",
        "// Reproduction test",
        "function testErrorReproduction() {",
        "    print('=== Reproducing Error: " + logEntry.message.replace(/'/g, "\\'") + " ===');",
        "    ",
        "    // TODO: Set up game state from snapshot",
        "    // TODO: Execute the action that caused the error",
        "    // TODO: Add assertions",
        "    ",
        "    print('Context: " + JSON.stringify(logEntry.context).replace(/'/g, "\\'") + "');",
        "}",
        "",
        "testErrorReproduction();"
    ].join("\n");

    var testFile = new File(testFilename);
    if (testFile.open("w")) {
        testFile.write(testCode);
        testFile.close();
        print("Reproduction test saved to: " + testFilename);
    }
}

/**
 * Get current stack trace
 * @returns {string} Stack trace
 */
function getStackTrace() {
    try {
        throw new Error("Stack trace");
    } catch (e) {
        return e.stack || "Stack trace not available";
    }
}

/**
 * Wrap main game function with error handler
 * @param {Function} mainFn - Main game function to wrap
 * @param {string} functionName - Name of function for logging
 * @param {Object} systems - Systems object to capture in context
 * @returns {Function} Wrapped function
 */
function wrapWithErrorHandler(mainFn, functionName, systems) {
    return function () {
        try {
            return mainFn.apply(this, arguments);
        } catch (e) {
            logError(e, ErrorSeverity.FATAL, {
                function: functionName || "main",
                arguments: Array.prototype.slice.call(arguments),
                systems: systems  // Pass systems for state capture
            });

            // Re-throw after logging
            throw e;
        }
    };
}

/**
 * Set up global error handler
 * Catches uncaught exceptions
 */
function setupGlobalErrorHandler() {
    // Note: JS in Synchronet doesn't have window.onerror
    // We'll wrap key functions instead
    print("Error handler initialized. Logs will be written to: " + ERROR_LOG_PATH);
}
