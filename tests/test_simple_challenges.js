// Test the simple challenges implementation
// Modeled after how oneliners works

load("json-client.js");

// Minimal LORB stub
if (typeof LORB === "undefined") LORB = {};
LORB.Multiplayer = {};
LORB.Persist = { getServerConfig: function() { return {}; } };

// Load the simple implementation
load("../lib/lorb/multiplayer/challenges_simple.js");

var C = LORB.Multiplayer.Challenges;

print("=== Simple Challenges Test ===\n");

// Mock user
var ctx = { _user: { number: 91001, alias: "TestUser" } };

print("1. Set presence...");
var result = C.setPresence(ctx);
print("   Result: " + result);

print("\n2. Get online players...");
var online = C.getOnlinePlayers();
print("   Count: " + Object.keys(online).length);
for (var id in online) {
    print("   - " + id + ": " + JSON.stringify(online[id]));
}

print("\n3. Clear presence...");
result = C.clearPresence(ctx);
print("   Result: " + result);

print("\n4. Get online players again...");
online = C.getOnlinePlayers();
print("   Count: " + Object.keys(online).length);

print("\n5. Disconnect...");
C.disconnect();

print("\n=== Done ===");
