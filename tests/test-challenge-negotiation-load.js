// Test that the challenge negotiation wager functions work correctly

print("========================================");
print("  Challenge Wager Functions Unit Test");
print("========================================");

// Setup minimal LORB namespace for testing
var LORB = { Multiplayer: {}, Persist: {}, JsonClientHelper: {}, Config: {} };
LORB.Persist.getServerConfig = function() { return { host: "localhost", port: 10088 }; };
LORB.Persist.getGlobalPlayerId = function(user) { return user ? "test_gid" : null; };
LORB.JsonClientHelper = { isDisabled: function() { return true; } }; // Disable actual network

// Provide global LORB for the module
this.LORB = LORB;

// Load the challenges module (simple version used in production)
load("../lib/lorb/multiplayer/challenges_simple.js");

var passed = 0;
var failed = 0;

function test(name, condition) {
    if (condition) {
        print("✓ " + name);
        passed++;
    } else {
        print("✗ " + name);
        failed++;
    }
}

// Test module loaded
var Challenges = LORB.Multiplayer.Challenges;
test("Challenges module loaded", !!Challenges);

// Test calculateAbsoluteMax
if (Challenges && Challenges.calculateAbsoluteMax) {
    var ctx1 = { cash: 100, rep: 50 };
    var player1 = { cash: 80, rep: 100 };
    var max1 = Challenges.calculateAbsoluteMax(ctx1, player1);
    test("calculateAbsoluteMax returns object", !!max1);
    test("absoluteMax.cash = min(100, 80) = 80", max1 && max1.cash === 80);
    test("absoluteMax.rep = min(50, 100) = 50", max1 && max1.rep === 50);
    
    var ctx2 = { cash: 50, rep: 200 };
    var player2 = { cash: 200, rep: 75 };
    var max2 = Challenges.calculateAbsoluteMax(ctx2, player2);
    test("absoluteMax.cash = min(50, 200) = 50", max2 && max2.cash === 50);
    test("absoluteMax.rep = min(200, 75) = 75", max2 && max2.rep === 75);
}

// Test isMyTurnToRespond
if (Challenges && Challenges.isMyTurnToRespond) {
    // Note: proposedBy uses "from" or "to" role, not globalId
    var ch1 = { 
        from: { globalId: "playerA" },
        to: { globalId: "playerB" },
        wager: { proposedBy: "from" }  // "from" player made the proposal
    };
    test("isMyTurnToRespond: not my turn if I (from) proposed", !Challenges.isMyTurnToRespond(ch1, "playerA"));
    test("isMyTurnToRespond: my turn if other (to) should respond", Challenges.isMyTurnToRespond(ch1, "playerB"));
    
    var ch2 = { from: { globalId: "x" }, to: { globalId: "y" }, wager: null };
    test("isMyTurnToRespond: no wager = false", !Challenges.isMyTurnToRespond(ch2, "y"));
}

// Test getWagerDetails
if (Challenges && Challenges.getWagerDetails) {
    var ch3 = { 
        wager: { 
            cash: 50, 
            rep: 10, 
            ceiling: { cash: 50, rep: 10, locked: true },
            proposedBy: "playerA",
            revision: 2
        }
    };
    var details = Challenges.getWagerDetails(ch3);
    test("getWagerDetails returns object", !!details);
    test("getWagerDetails.cash", details && details.cash === 50);
    test("getWagerDetails.ceilingLocked", details && details.ceilingLocked === true);
    test("getWagerDetails.revision", details && details.revision === 2);
}

print("");
print("========================================");
print("  Results: " + passed + " passed, " + failed + " failed");
print("========================================");
