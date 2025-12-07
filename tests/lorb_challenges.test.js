// Unit-style test for LORB live challenges using an in-memory JSONClient mock.
// Run with: /sbbs/exec/jsexec tests/lorb_challenges.test.js

var store = {};

function resetStore() { store = {}; }

// Minimal LORB + JSONClient mock
if (typeof LORB === "undefined") LORB = {};
LORB.Persist = {
    getGlobalPlayerId: function (u) { return "bbs_" + (u && u.number); }
};
LORB.Multiplayer = {};

// JSONClient mock (read/write/remove)
LORB._JsonClientMock = {
    connected: true,
    read: function (scope, path) {
        var parts = path.split(".");
        var cur = store;
        for (var i = 0; i < parts.length; i++) {
            if (cur === undefined || cur === null) return null;
            cur = cur[parts[i]];
        }
        return cur;
    },
    write: function (scope, path, data) {
        var parts = path.split(".");
        var cur = store;
        for (var i = 0; i < parts.length - 1; i++) {
            if (cur[parts[i]] === undefined) cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = data;
        return true;
    },
    remove: function (scope, path) {
        var parts = path.split(".");
        var cur = store;
        for (var i = 0; i < parts.length - 1; i++) {
            if (cur[parts[i]] === undefined) return false;
            cur = cur[parts[i]];
        }
        delete cur[parts[parts.length - 1]];
        return true;
    },
    disconnect: function () { return true; }
};

// Quiet debugLog
function debugLog(msg) { /* no-op for tests */ }

// Load module under test
load("../lib/lorb/multiplayer/challenges.js");

var Challenges = LORB.Multiplayer.Challenges;

function assert(cond, msg) {
    if (!cond) throw new Error(msg || "assertion failed");
}

function runTest(name, fn) {
    try {
        resetStore();
        fn();
        print("[PASS] " + name);
    } catch (e) {
        print("[FAIL] " + name + " :: " + e);
    }
}

var ctxA = { _user: { number: 1 }, name: "A" };
var ctxB = { _user: { number: 2 }, name: "B" };

runTest("create persists to both buckets", function () {
    var ch = Challenges.createChallenge(ctxA, { globalId: "bbs_2", name: "B" }, { mode: "live" });
    assert(ch && ch.id, "challenge not created");
    assert(LORB._JsonClientMock.read("nba_jam", "lorb.challenges.bbs_1." + ch.id), "missing in from bucket");
    assert(LORB._JsonClientMock.read("nba_jam", "lorb.challenges.bbs_2." + ch.id), "missing in to bucket");
});

runTest("listIncoming/listOutgoing see created challenge", function () {
    var ch = Challenges.createChallenge(ctxA, { globalId: "bbs_2", name: "B" }, { mode: "live" });
    var out = Challenges.listOutgoing(ctxA);
    var incoming = Challenges.listIncoming(ctxB);
    assert(out.length === 1 && out[0].id === ch.id, "outgoing missing");
    assert(incoming.length === 1 && incoming[0].id === ch.id, "incoming missing");
});

runTest("accept updates status in store", function () {
    var ch = Challenges.createChallenge(ctxA, { globalId: "bbs_2", name: "B" }, { mode: "live" });
    Challenges.markAccepted(ch.id, ctxB);
    var stored = LORB._JsonClientMock.read("nba_jam", "lorb.challenges.bbs_2." + ch.id);
    assert(stored && stored.status === "accepted", "status not accepted");
});

runTest("ready flags persist", function () {
    var ch = Challenges.createChallenge(ctxA, { globalId: "bbs_2", name: "B" }, { mode: "live" });
    Challenges.markReady(ch.id, ctxA, true);
    Challenges.markReady(ch.id, ctxB, true);
    var stored = LORB._JsonClientMock.read("nba_jam", "lorb.challenges.bbs_1." + ch.id);
    assert(stored && stored.lobby && stored.lobby.ready["bbs_1"] === true, "ready not set for A");
    assert(stored.lobby.ready["bbs_2"] === true, "ready not set for B");
});
