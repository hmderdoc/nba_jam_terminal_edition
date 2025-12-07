/**
 * presence_flow_test.js - Test the actual LORB entry flow
 * 
 * Simulates: Player enters LORB → setPresence → visits tournament → getOnlinePlayers
 */

function debugLog(msg) { print(msg); }

if (typeof LORB === "undefined") LORB = {};
LORB.Multiplayer = LORB.Multiplayer || {};

// Mock the system object if not available
if (typeof system === "undefined") {
    system = { qwk_id: "TEST", name: "TestBBS" };
}

// Load the modules directly
try { load("../lib/lorb/config.js"); } catch (e) {}
load("../lib/lorb/util/persist.js");
load("../lib/lorb/multiplayer/challenges_pubsub.js");

print("=== Presence Flow Test ===\n");

// Create two mock users
var userA = {
    _user: {
        name: "TestPlayerA",
        alias: "PlayerA",
        number: 91001
    },
    system: { qwk_id: "TEST" }
};

var userB = {
    _user: {
        name: "TestPlayerB", 
        alias: "PlayerB",
        number: 91002
    },
    system: { qwk_id: "TEST" }
};

var Challenges = LORB.Multiplayer.Challenges;
var Persist = LORB.Persist;

// 1. Player A enters LORB - setPresence is called
// In the real code, Persist.setPresence(user) is called with raw user object
print("1. Player A enters LORB (setPresence)...");
var resultA = Persist.setPresence(userA);
print("   setPresence result: " + resultA);

// Small delay for network propagation
mswait(100);

// 2. Player A checks online players - should see themselves
print("\n2. Player A checks online players...");
var online = Persist.getOnlinePlayers();
var count = 0;
for (var id in online) {
    if (online.hasOwnProperty(id)) {
        print("   Found: " + id + " = " + JSON.stringify(online[id]));
        count++;
    }
}
print("   Total online: " + count);

// 3. Player B enters LORB
print("\n3. Player B enters LORB (setPresence)...");
var resultB = Persist.setPresence(userB);
print("   setPresence result: " + resultB);

// Small delay for network propagation  
mswait(200);

// 4. Call cycle to process any subscription updates
print("\n4. Processing subscription updates...");
if (Challenges && Challenges.cycle) {
    Challenges.cycle();
}

// 5. Player A checks online players again - should see both
print("\n5. Player A checks online players again...");
online = Persist.getOnlinePlayers();
count = 0;
for (var id in online) {
    if (online.hasOwnProperty(id)) {
        print("   Found: " + id + " = " + JSON.stringify(online[id]));
        count++;
    }
}
print("   Total online: " + count);

// 6. Cleanup
print("\n6. Cleanup...");
if (Challenges && Challenges.disconnect) {
    Challenges.disconnect();
}

print("\n=== Test complete ===");
if (count >= 1) {
    print("SUCCESS: Online players visible");
    exit(0);
} else {
    print("FAILURE: No online players visible");
    exit(1);
}
