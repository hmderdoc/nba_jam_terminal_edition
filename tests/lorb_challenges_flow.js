// Full flow harness using JSONClient mock (no UI, no disk).
// Creates a challenge from A->B, lists incoming for B, accepts, and checks ready flags.
// Run with: /sbbs/exec/jsexec tests/lorb_challenges_flow.js

function debugLog(msg) { /* suppress */ }

if (typeof LORB === "undefined") LORB = {};
if (!LORB.Multiplayer) LORB.Multiplayer = {};

// JSONClient mock
var store = {};
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

// Load modules
load("../lib/lorb/util/persist.js");
load("../lib/lorb/multiplayer/challenges.js");

var Challenges = LORB.Multiplayer.Challenges;

function assert(cond, msg) {
    if (!cond) throw new Error(msg || "assertion failed");
}

// Use test-specific gids; ok to nuke during testing
var ctxA = { _user: { number: 101 }, name: "TesterA" };
var ctxB = { _user: { number: 202 }, name: "TesterB" };
LORB.Persist.getGlobalPlayerId = function (u) { return "flow_" + (u && u.number); };

function log(msg) { print(msg); }

// Clean slate
store = {};

log("Creating challenge A -> B");
var ch = Challenges.createChallenge(ctxA, { globalId: "flow_202", name: "TesterB" }, { mode: "live" });
assert(ch && ch.id, "challenge not created");

log("Listing outgoing for A");
var out = Challenges.listOutgoing(ctxA);
assert(out.length === 1 && out[0].id === ch.id, "outgoing missing");

log("Listing incoming for B");
var incoming = Challenges.listIncoming(ctxB);
assert(incoming.length === 1 && incoming[0].id === ch.id, "incoming missing");

log("Accepting on B");
Challenges.markAccepted(ch.id, ctxB);
var storedB = LORB._JsonClientMock.read("nba_jam", "lorb.challenges.flow_202." + ch.id);
assert(storedB && storedB.status === "accepted", "status not accepted in B bucket");

log("Mark ready both sides");
Challenges.markReady(ch.id, ctxA, true);
Challenges.markReady(ch.id, ctxB, true);
var storedA = LORB._JsonClientMock.read("nba_jam", "lorb.challenges.flow_101." + ch.id);
assert(storedA && storedA.lobby && storedA.lobby.ready["flow_101"] === true, "A ready missing");
assert(storedA.lobby.ready["flow_202"] === true, "B ready missing in A bucket");

log("Flow OK: " + ch.id);

// Cleanup
store = {};
