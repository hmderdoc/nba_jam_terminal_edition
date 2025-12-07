// Presence tests using JSONClient mock (no disk writes).
// Run with: /sbbs/exec/jsexec tests/presence_jsonclient.test.js

var store = {};
function resetStore() { store = {}; }

// Minimal LORB namespace
if (typeof LORB === "undefined") LORB = {};
LORB.Multiplayer = LORB.Multiplayer || {};

// Mock JSONClient (read/write/remove)
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
function debugLog(msg) { /* no-op */ }

// Load persist (presence now uses JSONClient)
load("../lib/lorb/util/persist.js");

var ctxUser = { number: 1, alias: "TestUser", name: "TestUser" };

function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function runTest(name, fn) {
    try {
        resetStore();
        fn();
        print("[PASS] " + name);
    } catch (e) {
        print("[FAIL] " + name + " :: " + e);
    }
}

runTest("setPresence writes to JSONClient", function () {
    var ok = LORB.Persist.setPresence(ctxUser);
    assert(ok, "setPresence failed");
    var gid = LORB.Persist.getGlobalPlayerId(ctxUser);
    var val = LORB._JsonClientMock.read("nba_jam", "presence." + gid);
    assert(val && val.globalId === gid, "presence not stored");
});

runTest("isPlayerOnline respects timeout", function () {
    LORB.Persist.setPresence(ctxUser);
    var gid = LORB.Persist.getGlobalPlayerId(ctxUser);
    assert(LORB.Persist.isPlayerOnline(gid) === true, "should be online");
    // Age the timestamp
    var entry = LORB._JsonClientMock.read("nba_jam", "presence." + gid);
    entry.timestamp = Date.now() - (LORB.Persist.PRESENCE_TIMEOUT_MS + 1000);
    assert(LORB.Persist.isPlayerOnline(gid) === false, "should be offline after timeout");
});

runTest("getOnlinePlayers lists fresh entries", function () {
    LORB.Persist.setPresence(ctxUser);
    var online = LORB.Persist.getOnlinePlayers();
    var gid = LORB.Persist.getGlobalPlayerId(ctxUser);
    assert(online[gid], "online list missing user");
});
