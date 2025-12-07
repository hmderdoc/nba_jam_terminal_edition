// Debug what's actually in the JSON service
load("json-client.js");

var client = new JSONClient("localhost", 10088);

print("=== JSON Service Debug ===\n");

print("1. Read LORB_PRESENCE...");
try {
    var presence = client.read("nba_jam", "LORB_PRESENCE", 1);
    print("   Result: " + JSON.stringify(presence));
} catch (e) {
    print("   Error: " + e);
}

print("\n2. Read rimcity.presence (old path)...");
try {
    var oldPresence = client.read("nba_jam", "rimcity.presence", 1);
    print("   Result: " + JSON.stringify(oldPresence));
} catch (e) {
    print("   Error: " + e);
}

print("\n3. Read root of nba_jam scope...");
try {
    var root = client.read("nba_jam", "", 1);
    print("   Keys: " + (root ? Object.keys(root).join(", ") : "null/empty"));
} catch (e) {
    print("   Error: " + e);
}

print("\n4. Write test to LORB_PRESENCE.test...");
try {
    client.write("nba_jam", "LORB_PRESENCE.test", {ts: Date.now(), name: "test"}, 2);
    print("   Write OK");
} catch (e) {
    print("   Error: " + e);
}

print("\n5. Read LORB_PRESENCE again...");
try {
    var presence2 = client.read("nba_jam", "LORB_PRESENCE", 1);
    print("   Result: " + JSON.stringify(presence2));
} catch (e) {
    print("   Error: " + e);
}

print("\n6. Remove test entry...");
try {
    client.remove("nba_jam", "LORB_PRESENCE.test", 2);
    print("   Remove OK");
} catch (e) {
    print("   Error: " + e);
}

client.disconnect();
print("\n=== Done ===");
