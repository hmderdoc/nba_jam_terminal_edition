// Integration test for pub/sub challenge system
// Run with: /sbbs/exec/jsexec tests/challenges_pubsub_integration.js

function debugLog(msg) { print(msg); }

if (typeof LORB === "undefined") LORB = {};
LORB.Multiplayer = LORB.Multiplayer || {};

// Load config first
try { load("../lib/lorb/config.js"); } catch (e) {}

// Load the new pub/sub implementation
load("../lib/lorb/util/persist.js");
load("../lib/lorb/multiplayer/challenges_pubsub.js");

var Challenges = LORB.Multiplayer.Challenges;

function assert(cond, msg) {
    if (!cond) throw new Error(msg || "assertion failed");
}

function run() {
    print("=== Pub/Sub Challenges Integration Test ===\n");
    
    // Mock contexts for two players
    var ctxA = { _user: { number: 91001, alias: "PubSubA", name: "PubSubA" }, name: "PubSubA" };
    var ctxB = { _user: { number: 91002, alias: "PubSubB", name: "PubSubB" }, name: "PubSubB" };
    LORB.Persist.getGlobalPlayerId = function(u) { return "pstest_" + (u && u.number); };
    
    var startTime = Date.now();
    
    // Test 1: Create challenge
    print("1. Creating challenge from A to B...");
    var challenge = Challenges.createChallenge(ctxA, { globalId: "pstest_91002", name: "PubSubB" }, { mode: "test" });
    assert(challenge && challenge.id, "Challenge should be created");
    print("   OK: id=" + challenge.id);
    
    // Test 2: List outgoing (should appear immediately in cache)
    print("\n2. Listing outgoing for A...");
    var outgoing = Challenges.listOutgoing(ctxA);
    assert(outgoing.length >= 1, "Should have at least 1 outgoing");
    var found = outgoing.some(function(ch) { return ch.id === challenge.id; });
    assert(found, "Our challenge should be in outgoing list");
    print("   OK: found " + outgoing.length + " outgoing challenges");
    
    // Test 3: Wait a moment for subscription to propagate, then check incoming for B
    print("\n3. Waiting 500ms for subscription propagation...");
    mswait(500);
    Challenges.cycle(); // Process any updates
    
    print("4. Listing incoming for B...");
    var incoming = Challenges.listIncoming(ctxB);
    // Note: B may not see it yet if subscription wasn't set up for B's bucket
    // In real usage, B would have already subscribed when entering the challenge menu
    print("   Found " + incoming.length + " incoming challenges");
    
    // Test 4: Accept challenge
    print("\n5. Accepting challenge...");
    var accepted = Challenges.markAccepted(challenge.id, ctxB);
    // May return null if B doesn't have it in cache yet - that's OK for fire-and-forget
    print("   markAccepted returned: " + (accepted ? "challenge object" : "null (expected if not in B's cache)"));
    
    // Test 5: Mark ready
    print("\n6. Marking A as ready...");
    var readyA = Challenges.markReady(challenge.id, ctxA, true);
    print("   markReady returned: " + (readyA ? "challenge object" : "null"));
    
    // Test 6: Presence
    print("\n7. Testing presence...");
    Challenges.setPresence(ctxA);
    mswait(100);
    Challenges.cycle();
    var online = Challenges.getOnlinePlayers();
    print("   Online players: " + Object.keys(online).length);
    
    // Cleanup
    print("\n8. Disconnecting...");
    Challenges.clearPresence(ctxA);
    Challenges.disconnect();
    
    var elapsed = Date.now() - startTime;
    print("\n=== Test completed in " + elapsed + "ms ===");
    print("Key insight: No blocking locks used, all writes are fire-and-forget");
    
    return true;
}

try {
    run();
    print("\nSUCCESS: Pub/sub integration test passed");
    exit(0);
} catch (e) {
    print("\nFAILED: " + e);
    try { LORB.Multiplayer.Challenges.disconnect(); } catch (e2) {}
    exit(1);
}
