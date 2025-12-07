/**
 * Test that challenge_negotiation_v2.js loads correctly
 */

// Mock LORB environment
var LORB = { Multiplayer: {} };
function debugLog(m) { /* print(m); */ }

// Load the module
load("/sbbs/xtrn/nba_jam/lib/lorb/multiplayer/challenge_negotiation_v2.js");

print("========================================");
print("  Challenge Negotiation v2 Load Test");
print("========================================");

if (LORB.Multiplayer.ChallengeNegotiation) {
    print("PASS: ChallengeNegotiation v2 loaded successfully");
    var exports = Object.keys(LORB.Multiplayer.ChallengeNegotiation);
    print("Exports: " + exports.join(", "));
    
    // Check expected functions
    var expected = ["showChallengerWagerInput", "showIncomingChallenge", "formatWager"];
    var missing = [];
    for (var i = 0; i < expected.length; i++) {
        if (typeof LORB.Multiplayer.ChallengeNegotiation[expected[i]] !== "function") {
            missing.push(expected[i]);
        }
    }
    if (missing.length === 0) {
        print("PASS: All expected functions present");
    } else {
        print("FAIL: Missing functions: " + missing.join(", "));
    }
} else {
    print("FAIL: ChallengeNegotiation not exported");
}

print("========================================");
