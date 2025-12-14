/**
 * Debug Logger
 * 
 * Writes detailed logs to /sbbs/xtrn/nba_jam/debug.log
 * Can be enabled/disabled via DEBUG_LOGGING_ENABLED flag
 */

var DEBUG_LOGGING_ENABLED = false;
var DEBUG_LOG_FILE = "/sbbs/xtrn/nba_jam/debug.log";

function debugLog(message) {
    if (!DEBUG_LOGGING_ENABLED) return;

    try {
        var f = new File(DEBUG_LOG_FILE);
        if (!f.open("a")) {
            // Fail silently if can't open
            return;
        }

        var timestamp = new Date().toISOString();
        f.writeln("[" + timestamp + "] " + message);
        f.close();
    } catch (e) {
        // Fail silently
    }
}

function debugLogObject(label, obj) {
    if (!DEBUG_LOGGING_ENABLED) return;

    try {
        var f = new File(DEBUG_LOG_FILE);
        if (!f.open("a")) return;

        var timestamp = new Date().toISOString();
        f.writeln("[" + timestamp + "] " + label + ":");

        for (var key in obj) {
            var value = obj[key];
            if (typeof value === "object" && value !== null) {
                f.writeln("  " + key + ": [object]");
            } else {
                f.writeln("  " + key + ": " + value);
            }
        }

        f.close();
    } catch (e) {
        // Fail silently
    }
}

function clearDebugLog() {
    try {
        var f = new File(DEBUG_LOG_FILE);
        if (f.open("w")) {
            f.writeln("=== NBA Jam Debug Log Started ===");
            f.close();
        }
    } catch (e) {
        // Fail silently
    }
}

// Export functions
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        debugLog: debugLog,
        debugLogObject: debugLogObject,
        clearDebugLog: clearDebugLog
    };
}
