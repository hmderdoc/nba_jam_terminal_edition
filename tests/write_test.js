// Simple write test
load("json-client.js");
var c = new JSONClient("localhost", 10088);
c.settings.TIMEOUT = 3000;
c.settings.SOCK_TIMEOUT = 3000;

print("Test 1: Simple write to nba_jam.test123");
try {
    c.write("nba_jam", "test123", {t: Date.now()});
    print("  SUCCESS");
} catch(e) {
    print("  FAILED: " + e);
}

print("");
print("Test 2: Read it back");
try {
    c.lock("nba_jam", "test123", 1);
    var d = c.read("nba_jam", "test123");
    c.unlock("nba_jam", "test123");
    print("  Result: " + JSON.stringify(d));
} catch(e) {
    print("  FAILED: " + e);
}

print("");
print("Test 3: Write to rimcity.presence.testuser");
try {
    c.write("nba_jam", "rimcity.presence.testuser", {id: "testuser", ts: Date.now()});
    print("  SUCCESS");
} catch(e) {
    print("  FAILED: " + e);
}

print("");
print("Test 4: Read rimcity.presence");
try {
    c.lock("nba_jam", "rimcity.presence", 1);
    var d = c.read("nba_jam", "rimcity.presence");
    c.unlock("nba_jam", "rimcity.presence");
    print("  Result: " + JSON.stringify(d));
} catch(e) {
    print("  FAILED: " + e);
}

c.disconnect();
print("Done.");
