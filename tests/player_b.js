// Player B - sets presence and checks who's online
load("json-client.js");

if (typeof LORB === "undefined") LORB = {};
LORB.Multiplayer = {};
LORB.Persist = { getServerConfig: function() { return {}; } };

load("../lib/lorb/multiplayer/challenges_simple.js");

var C = LORB.Multiplayer.Challenges;
var ctx = { _user: { number: 91002, alias: "PlayerB" } };

print("=== Player B ===");

print("1. Check who's online BEFORE setting my presence...");
var online = C.getOnlinePlayers();
for (var id in online) {
    print("   - " + id + ": " + online[id].userName);
}
print("   Total: " + Object.keys(online).length);

print("");
print("2. Setting my presence...");
C.setPresence(ctx);

print("");
print("3. Check who's online AFTER setting my presence...");
online = C.getOnlinePlayers();
for (var id in online) {
    print("   - " + id + ": " + online[id].userName);
}
print("   Total: " + Object.keys(online).length);

print("");
print("4. Cleaning up...");
C.clearPresence(ctx);
C.disconnect();
print("Done.");
