// Test script to verify baby-ballers.js loads correctly
var NBA_JAM_ROOT = "/sbbs/xtrn/nba_jam/";

try {
    load("sbbsdefs.js");
    var LORB = {};
    LORB.Data = {};
    LORB.Config = {};
    LORB.Persist = { readShared: function() { return null; }, writeShared: function() { return true; } };
    
    load(NBA_JAM_ROOT + "lib/lorb/data/baby-ballers.js");
    
    if (LORB.Data && LORB.Data.BabyBallers) {
        print("baby-ballers.js loaded OK");
        print("Functions available: " + Object.keys(LORB.Data.BabyBallers).join(", "));
    } else {
        print("ERROR: LORB.Data.BabyBallers not defined after load");
    }
} catch(e) {
    print("ERROR loading baby-ballers.js: " + e.message);
    if (e.lineNumber) print("Line: " + e.lineNumber);
    if (e.fileName) print("File: " + e.fileName);
}
