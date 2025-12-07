// Integration harness for live challenges using the real JSON service (JSONClient).
// Run with: /sbbs/exec/jsexec tests/lorb_challenges_jsonclient_integration.js
// Exits non-zero if the JSON service cannot be reached or the flow fails.

function debugLog(msg) { print(msg); }

if (typeof LORB === "undefined") LORB = {};
LORB.Multiplayer = LORB.Multiplayer || {};

// JSON service lock constants (fallback to documented values if not loaded)
var LOCK_READ_CONST = (typeof LOCK_READ !== "undefined") ? LOCK_READ : 1;
var LOCK_WRITE_CONST = (typeof LOCK_WRITE !== "undefined") ? LOCK_WRITE : 2;
var LOCK_UNLOCK_CONST = (typeof LOCK_UNLOCK !== "undefined") ? LOCK_UNLOCK : -1;

// Skip entirely when live challenges are disabled (prevents timeouts on boxes
// where the JSON service is unavailable or intentionally turned off).
try {
    load("../lib/lorb/config.js");
} catch (e) { /* optional */ }
if (LORB.Config && LORB.Config.ENABLE_LIVE_CHALLENGES === false) {
    print("SKIP: live challenges disabled via config");
    exit(0);
}

// Do not use the in-memory mock; ensure real JSONClient path.
LORB._JsonClientMock = null;

load("../lib/lorb/util/persist.js");
load("../lib/lorb/multiplayer/challenges.js");

var Challenges = LORB.Multiplayer.Challenges;
var cfg = (LORB.Persist && LORB.Persist.getServerConfig) ? LORB.Persist.getServerConfig() : {};
var scope = (cfg && cfg.scope) || "nba_jam";
var addr = (cfg && cfg.addr) || "localhost";
var port = (cfg && cfg.port) || 10088;

function preflight() {
    var key = "rimcity.probe.integration_" + Date.now();
    var c = (LORB.JsonClientHelper && LORB.JsonClientHelper.ensureClient) ? LORB.JsonClientHelper.ensureClient() : null;
    if (!c) throw new Error("preflight: client unavailable");
    var start = Date.now();
    try {
        // Lock, write, read, unlock per json-client doc
        try { c.lock && c.lock(scope, key, LOCK_WRITE_CONST); } catch (e) {}
        c.write(scope, key, { ts: Date.now(), note: "preflight" });
        try { c.unlock && c.unlock(scope, key); } catch (e) {}

        try { c.lock && c.lock(scope, key, LOCK_READ_CONST); } catch (e) {}
        var written = c.read(scope, key);
        try { c.unlock && c.unlock(scope, key); } catch (e) {}

        try { c.lock && c.lock(scope, key, LOCK_WRITE_CONST); } catch (e) {}
        c.remove(scope, key);
        try { c.unlock && c.unlock(scope, key); } catch (e) {}
        var elapsed = Date.now() - start;
        if (!written) throw new Error("preflight: read returned null");
        print("Preflight ok in " + elapsed + "ms");
    } catch (e) {
        throw e;
    }
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg || "assertion failed");
}

function cleanupChallenge(ch) {
    try {
        var c = (LORB.JsonClientHelper && LORB.JsonClientHelper.ensureClient) ? LORB.JsonClientHelper.ensureClient() : null;
        if (!c || !ch) return;
        var from = ch.from && ch.from.globalId;
        var to = ch.to && ch.to.globalId;
        var ids = [];
        if (from) ids.push(from);
        if (to) ids.push(to);
        for (var i = 0; i < ids.length; i++) {
            try { c.remove(scope, "rimcity.challenges." + ids[i] + "." + ch.id); } catch (e) {}
        }
    } catch (e) {}
}

function run() {
    var client = (LORB.JsonClientHelper && LORB.JsonClientHelper.ensureClient) ? LORB.JsonClientHelper.ensureClient() : null;
    if (!client) {
        throw new Error("JSON service unreachable at " + addr + ":" + port + " scope=" + scope);
    }
    print("Connected to JSON service at " + addr + ":" + port + " scope=" + scope);
    preflight();
    
    // Use isolated gids so we do not collide with real users.
    var ctxA = { _user: { number: 91001, alias: "IntegrationA", name: "IntegrationA" }, name: "IntegrationA" };
    var ctxB = { _user: { number: 91002, alias: "IntegrationB", name: "IntegrationB" }, name: "IntegrationB" };
    LORB.Persist.getGlobalPlayerId = function (u) { return "itest_" + (u && u.number); };
    
    var challenge = Challenges.createChallenge(ctxA, { globalId: "itest_91002", name: "IntegrationB" }, { mode: "integration" });
    assert(challenge && challenge.id, "challenge was not created");
    
    var incoming = Challenges.listIncoming(ctxB);
    var foundIncoming = incoming && incoming.some(function (ch) { return ch && ch.id === challenge.id; });
    assert(foundIncoming, "incoming challenge not visible to target");
    
    Challenges.markAccepted(challenge.id, ctxB);
    var outgoing = Challenges.listOutgoing(ctxA);
    assert(outgoing && outgoing.length > 0, "outgoing list empty after accept");
    assert(outgoing[0].status === "accepted", "status not accepted after markAccepted");
    
    Challenges.markReady(challenge.id, ctxA, true);
    Challenges.markReady(challenge.id, ctxB, true);
    var readyState = Challenges.getChallenge ? Challenges.getChallenge(challenge.id, ctxA) : outgoing[0];
    assert(Challenges.isOtherReady(readyState, LORB.Persist.getGlobalPlayerId(ctxA._user)), "other player not ready");
    
    cleanupChallenge(challenge);
    print("Integration flow succeeded id=" + challenge.id);
}

try {
    run();
    exit(0);
} catch (e) {
    print("FAIL: " + e);
    exit(1);
} finally {
    try {
        if (LORB.JsonClientHelper && LORB.JsonClientHelper.disconnect) {
            LORB.JsonClientHelper.disconnect();
        }
    } catch (e) {}
}
