// Test two players seeing each other
// Run this, then run it again in another terminal

load("json-client.js");

if (typeof LORB === "undefined") LORB = {};
LORB.Multiplayer = {};
LORB.Persist = { getServerConfig: function() { return {}; } };

load("../lib/lorb/multiplayer/challenges_simple.js");

var C = LORB.Multiplayer.Challenges;

// Generate unique ID for this session
var SESSION = Date.now() + "_" + Math.floor(Math.random() * 1000);
var ctx = { _user: { number: parseInt(SESSION.slice(-4)), alias: "Player_" + SESSION.slice(-4) } };

print("=== Two Player Test ===");
print("Session: " + SESSION);
print("");

print("1. Check who's online BEFORE setting presence...");
var online = C.getOnlinePlayers();
print("   Online count: " + Object.keys(online).length);
for (var id in online) {
    print("   - " + id + ": " + online[id].userName);
}

print("");
print("2. Setting my presence...");
C.setPresence(ctx);

print("");
print("3. Check who's online AFTER setting presence...");
online = C.getOnlinePlayers();
print("   Online count: " + Object.keys(online).length);
for (var id in online) {
    print("   - " + id + ": " + online[id].userName);
}

print("");
print("4. Waiting 10 seconds - run another instance now!");
print("   (Press Ctrl+C to skip)");

var start = Date.now();
while (Date.now() - start < 10000) {
    C.cycle();
    mswait(500);
    
    // Check for new players
    var nowOnline = C.getOnlinePlayers();
    var count = Object.keys(nowOnline).length;
    if (count > Object.keys(online).length) {
        print("   ** NEW PLAYER DETECTED! **");
        online = nowOnline;
        for (var id in online) {
            print("   - " + id + ": " + online[id].userName);
        }
    }
}

print("");
print("5. Final online check...");
online = C.getOnlinePlayers();
print("   Online count: " + Object.keys(online).length);
for (var id in online) {
    print("   - " + id + ": " + online[id].userName);
}

print("");
print("6. Clearing my presence...");
C.clearPresence(ctx);

print("");
print("7. Disconnecting...");
C.disconnect();

print("");
print("=== Done ===");
