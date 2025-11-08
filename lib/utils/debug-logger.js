/**
 * Debug Logger for Wave 22A Bug Investigation
 * 
 * Writes detailed logs to /sbbs/repo/xtrn/nba_jam/debug.log
 * Can be enabled/disabled via DEBUG_REBOUND_FLOW flag
 */

var DEBUG_REBOUND_FLOW = true;
var DEBUG_LOG_FILE = "/sbbs/repo/xtrn/nba_jam/debug.log";

function debugLog(message) {
    if (!DEBUG_REBOUND_FLOW) return;
    
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
    if (!DEBUG_REBOUND_FLOW) return;
    
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
