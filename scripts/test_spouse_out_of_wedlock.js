// Quick test harness for the out-of-wedlock spouse event.
// Run with: jsexec /sbbs/xtrn/nba_jam/scripts/test_spouse_out_of_wedlock.js

// Ensure Synchronet defs available
load("sbbsdefs.js");

// Load shared logger directly
load("/sbbs/xtrn/nba_jam/lib/utils/debug-logger.js");

// Minimal LORB stubs needed by spouse-events
if (typeof LORB === "undefined") {
    this.LORB = { Data: {}, View: {} };
}
if (!LORB.View) LORB.View = {};
LORB.View.init = function() {};
LORB.View.clear = function() {};
LORB.View.header = function() {};
LORB.View.line = function() {};

// Minimal console stubs for non-BBS execution
if (typeof console === "undefined") {
    this.console = {};
}
if (typeof console.inkey !== "function") {
    console.inkey = function() { return ""; };
}
if (typeof console.getkey !== "function") {
    console.getkey = function() { return ""; };
}
if (typeof console.putmsg !== "function") {
    console.putmsg = function() {};
}

// Load spouse events directly
try {
    load("/sbbs/xtrn/nba_jam/lib/lorb/data/spouse-events.js");
} catch (e) {
    debugLog("[TEST] Failed to load spouse-events: " + e);
}

if (!LORB.Data || !LORB.Data.SpouseEvents) {
    debugLog("[TEST] SpouseEvents not loaded; aborting.");
    throw new Error("SpouseEvents not loaded");
}

// Stub player context
var ctx = {
    romance: {
        spouseName: "Katherine Heigl"
    }
};

// Simulate babies born with a different mother
var mamaName = "Anna Kendrick";
var babies = [
    { name: "Test Baby", nickname: "T-BABY" }
];

debugLog("[TEST] Invoking out-of-wedlock trigger for mama=" + mamaName + " spouse=" + ctx.romance.spouseName);

// Call trigger
LORB.Data.SpouseEvents.triggerOutOfWedlock(ctx, mamaName, babies);

debugLog("[TEST] Completed out-of-wedlock trigger call");
