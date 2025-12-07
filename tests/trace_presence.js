// Trace exactly what happens step by step
load("json-client.js");

var client = new JSONClient("localhost", 10088);
var SCOPE = "nba_jam";
var PATH = "LORB_PRESENCE";

print("=== Step by Step Trace ===\n");

print("1. Initial read of " + PATH + "...");
var r1 = client.read(SCOPE, PATH, 1);
print("   Result: " + JSON.stringify(r1));

print("\n2. Write to " + PATH + ".testuser...");
var data = {globalId: "testuser", timestamp: Date.now(), userName: "TestUser"};
print("   Data: " + JSON.stringify(data));
client.write(SCOPE, PATH + ".testuser", data, 2);
print("   Write sent");

print("\n3. Immediate read of " + PATH + "...");
var r2 = client.read(SCOPE, PATH, 1);
print("   Result: " + JSON.stringify(r2));

print("\n4. Read specific path " + PATH + ".testuser...");
var r3 = client.read(SCOPE, PATH + ".testuser", 1);
print("   Result: " + JSON.stringify(r3));

print("\n5. Wait 100ms then read again...");
mswait(100);
var r4 = client.read(SCOPE, PATH, 1);
print("   Result: " + JSON.stringify(r4));

print("\n6. Cleanup - remove testuser...");
client.remove(SCOPE, PATH + ".testuser", 2);
print("   Done");

print("\n7. Final read...");
var r5 = client.read(SCOPE, PATH, 1);
print("   Result: " + JSON.stringify(r5));

client.disconnect();
print("\n=== Done ===");
