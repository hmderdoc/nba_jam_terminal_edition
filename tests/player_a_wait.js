// Player A stays online for 30 seconds
load("json-client.js");

if (typeof LORB === "undefined") LORB = {};
LORB.Multiplayer = {};
LORB.Persist = { getServerConfig: function() { return {}; } };

load("../lib/lorb/multiplayer/challenges_simple.js");

var C = LORB.Multiplayer.Challenges;
var ctx = { _user: { number: 91001, alias: "PlayerA" } };

print("=== Player A (stays online 30s) ===");
print("Setting presence...");
C.setPresence(ctx);
print("I am online. Waiting 30 seconds...");
print("");

for (var i = 0; i < 30; i++) {
    mswait(1000);
    print("  " + (i+1) + "s...");
}

print("");
print("Cleaning up...");
C.clearPresence(ctx);
C.disconnect();
print("Done.");
