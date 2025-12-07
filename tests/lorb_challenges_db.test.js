// End-to-end challenge persistence test against the real JSONdb (lorb.json).
// Uses real Persist helpers and cleans up any challenge data it creates.
// Run with: /sbbs/exec/jsexec tests/lorb_challenges_db.test.js

// Quiet debugLog to avoid log noise during tests
function debugLog(msg) { /* no-op */ }

// Ensure globals
if (typeof LORB === "undefined") LORB = {};
if (!LORB.Multiplayer) LORB.Multiplayer = {};

// Point exec_dir so persist computes gameRoot correctly
js.exec_dir = "/sbbs/xtrn/nba_jam/lib/lorb/util/";

// Load Persist (real file-backed lorb.json) and Challenges
load("../lib/lorb/util/persist.js");
var originalChallenges = LORB.Persist.readShared("challenges");
function restoreChallenges() {
    // Deep copy to avoid aliasing
    var copy = originalChallenges ? JSON.parse(JSON.stringify(originalChallenges)) : {};
    LORB.Persist.writeShared("challenges", copy);
}

load("../lib/lorb/multiplayer/challenges.js");
var Challenges = LORB.Multiplayer.Challenges;

function assert(cond, msg) {
    if (!cond) throw new Error(msg || "assertion failed");
}

function runTest(name, fn) {
    try {
        // Clear test gids to start clean
        LORB.Persist.removeShared("challenges.test_101");
        LORB.Persist.removeShared("challenges.test_202");
        fn();
        print("[PASS] " + name);
    } catch (e) {
        print("[FAIL] " + name + " :: " + e);
        if (e && e.stack) print(e.stack);
    } finally {
        // Clean up test data to avoid polluting live challenges
        LORB.Persist.removeShared("challenges.test_101");
        LORB.Persist.removeShared("challenges.test_202");
    }
}

// Test contexts with distinct globalIds
var ctxA = { _user: { number: 101 }, name: "A" };
var ctxB = { _user: { number: 202 }, name: "B" };

// Force predictable global IDs for tests
LORB.Persist.getGlobalPlayerId = function (u) { return "test_" + (u && u.number); };

runTest("create persists to both buckets (real JSONdb)", function () {
    var ch = Challenges.createChallenge(ctxA, { globalId: "test_202", name: "B" }, { mode: "live" });
    assert(ch && ch.id, "challenge not created");
    var fromPath = "challenges.test_101." + ch.id;
    var toPath = "challenges.test_202." + ch.id;
    assert(LORB.Persist.readShared(fromPath), "missing in from bucket");
    assert(LORB.Persist.readShared(toPath), "missing in to bucket");
});

runTest("listIncoming/listOutgoing see created challenge (real JSONdb)", function () {
    var ch = Challenges.createChallenge(ctxA, { globalId: "test_202", name: "B" }, { mode: "live" });
    var out = Challenges.listOutgoing(ctxA);
    var incoming = Challenges.listIncoming(ctxB);
    assert(out.length === 1 && out[0].id === ch.id, "outgoing missing");
    assert(incoming.length === 1 && incoming[0].id === ch.id, "incoming missing");
});

runTest("accept updates status in store (real JSONdb)", function () {
    var ch = Challenges.createChallenge(ctxA, { globalId: "test_202", name: "B" }, { mode: "live" });
    Challenges.markAccepted(ch.id, ctxB);
    var stored = LORB.Persist.readShared("challenges.test_202." + ch.id);
    assert(stored && stored.status === "accepted", "status not accepted");
});

runTest("ready flags persist (real JSONdb)", function () {
    var ch = Challenges.createChallenge(ctxA, { globalId: "test_202", name: "B" }, { mode: "live" });
    Challenges.markReady(ch.id, ctxA, true);
    Challenges.markReady(ch.id, ctxB, true);
    var stored = LORB.Persist.readShared("challenges.test_101." + ch.id);
    assert(stored && stored.lobby && stored.lobby.ready["test_101"] === true, "ready not set for A");
    assert(stored.lobby.ready["test_202"] === true, "ready not set for B");
});

// Restore original challenges tree
restoreChallenges();
