// Player A - sets presence and waits
load("json-client.js");

if (typeof LORB === "undefined") LORB = {};
LORB.Multiplayer = {};
LORB.Persist = { getServerConfig: function() { return {}; } };

load("../lib/lorb/multiplayer/challenges_simple.js");

var C = LORB.Multiplayer.Challenges;
var ctx = { _user: { number: 91001, alias: "PlayerA" } };

print("=== Player A ===");
print("Setting presence...");
C.setPresence(ctx);

print("Waiting 15 seconds for Player B to join...");
print("Run: /sbbs/exec/jsexec tests/player_b.js");
print("");

for (var i = 0; i < 15; i++) {
    mswait(1000);
    var online = C.getOnlinePlayers();
    var names = [];
    for (var id in online) {
        names.push(online[id].userName || id);
    }
    print("  " + (i+1) + "s: " + names.length + " online: " + names.join(", "));
}

print("");
print("Cleaning up...");
C.clearPresence(ctx);
C.disconnect();
print("Done.");
