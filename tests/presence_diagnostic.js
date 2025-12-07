/**
 * presence_diagnostic.js - Run this from TWO terminals simultaneously
 * 
 * This will show exactly what each client sees and when.
 * Run with: /sbbs/exec/jsexec tests/presence_diagnostic.js
 */

// Generate unique ID for this session
var SESSION_ID = "diag_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
var LOG_FILE = "/sbbs/xtrn/nba_jam/data/presence_diag_" + SESSION_ID + ".log";

function log(msg) {
    var ts = new Date().toISOString();
    var line = "[" + ts + "] " + msg;
    print(line);
    
    // Also write to file
    var f = new File(LOG_FILE);
    if (f.open("a")) {
        f.writeln(line);
        f.close();
    }
}

log("=== PRESENCE DIAGNOSTIC ===");
log("Session ID: " + SESSION_ID);
log("Log file: " + LOG_FILE);

// Load JSON client
load("json-client.js");

var SCOPE = "nba_jam";
var PRESENCE_PATH = "rimcity.presence";

log("Connecting to JSON service...");
var client;
try {
    client = new JSONClient("localhost", 10088);
    log("Connected. Client version: " + (client.VERSION || "unknown"));
} catch (e) {
    log("FAILED to connect: " + e);
    exit(1);
}

// Set up subscription callback
var receivedUpdates = [];
client.callback = function(packet) {
    var msg = "CALLBACK received: oper=" + packet.oper + " location=" + packet.location;
    if (packet.data) {
        msg += " data=" + JSON.stringify(packet.data);
    }
    log(msg);
    receivedUpdates.push({ time: Date.now(), packet: packet });
};

log("");
log("Step 1: Read current presence data (before subscribing)...");
try {
    client.settings.TIMEOUT = 5000;
    client.settings.SOCK_TIMEOUT = 5000;
    
    // Lock, read, unlock
    log("  Acquiring read lock...");
    var lockResult = client.lock(SCOPE, PRESENCE_PATH, 1); // LOCK_READ = 1
    log("  Lock result: " + JSON.stringify(lockResult));
    
    log("  Reading...");
    var data = client.read(SCOPE, PRESENCE_PATH);
    log("  Read result: " + JSON.stringify(data));
    
    log("  Unlocking...");
    client.unlock(SCOPE, PRESENCE_PATH);
    log("  Unlocked.");
    
    if (data && typeof data === "object") {
        var keys = Object.keys(data);
        log("  Found " + keys.length + " presence entries: " + keys.join(", "));
    } else {
        log("  No presence data found (empty or null)");
    }
} catch (e) {
    log("  ERROR reading: " + e);
    try { client.unlock(SCOPE, PRESENCE_PATH); } catch (e2) {}
}

log("");
log("Step 2: Subscribe to presence updates...");
try {
    var subResult = client.subscribe(SCOPE, PRESENCE_PATH);
    log("  Subscribe result: " + JSON.stringify(subResult));
} catch (e) {
    log("  ERROR subscribing: " + e);
}

log("");
log("Step 3: Write my presence...");
var myPresencePath = PRESENCE_PATH + "." + SESSION_ID;
var myPresenceData = {
    globalId: SESSION_ID,
    timestamp: Date.now(),
    userName: "DiagUser_" + SESSION_ID.slice(-4)
};
try {
    client.settings.TIMEOUT = 5000;
    log("  Writing to: " + myPresencePath);
    log("  Data: " + JSON.stringify(myPresenceData));
    var writeResult = client.write(SCOPE, myPresencePath, myPresenceData);
    log("  Write result: " + JSON.stringify(writeResult));
} catch (e) {
    log("  ERROR writing: " + e);
}

log("");
log("Step 4: Read presence again (after my write)...");
try {
    client.lock(SCOPE, PRESENCE_PATH, 1);
    var data2 = client.read(SCOPE, PRESENCE_PATH);
    client.unlock(SCOPE, PRESENCE_PATH);
    
    if (data2 && typeof data2 === "object") {
        var keys = Object.keys(data2);
        log("  Found " + keys.length + " presence entries:");
        for (var i = 0; i < keys.length; i++) {
            log("    - " + keys[i] + ": " + JSON.stringify(data2[keys[i]]));
        }
    } else {
        log("  No presence data found");
    }
} catch (e) {
    log("  ERROR reading: " + e);
    try { client.unlock(SCOPE, PRESENCE_PATH); } catch (e2) {}
}

log("");
log("Step 5: Waiting 10 seconds for subscription updates...");
log("  (If another client writes presence, we should see a CALLBACK message)");
log("  Press Ctrl+C to abort early.");

var waitStart = Date.now();
var waitDuration = 10000;
while (Date.now() - waitStart < waitDuration) {
    try {
        // Process any pending subscription updates
        client.cycle();
    } catch (e) {
        log("  cycle error: " + e);
    }
    mswait(100);
}

log("");
log("Step 6: Final read of presence data...");
try {
    client.lock(SCOPE, PRESENCE_PATH, 1);
    var data3 = client.read(SCOPE, PRESENCE_PATH);
    client.unlock(SCOPE, PRESENCE_PATH);
    
    if (data3 && typeof data3 === "object") {
        var keys = Object.keys(data3);
        log("  Found " + keys.length + " presence entries:");
        for (var i = 0; i < keys.length; i++) {
            log("    - " + keys[i] + ": " + JSON.stringify(data3[keys[i]]));
        }
    }
} catch (e) {
    log("  ERROR: " + e);
    try { client.unlock(SCOPE, PRESENCE_PATH); } catch (e2) {}
}

log("");
log("Step 7: Cleanup - removing my presence...");
try {
    client.remove(SCOPE, myPresencePath);
    log("  Removed.");
} catch (e) {
    log("  ERROR removing: " + e);
}

log("");
log("=== SUMMARY ===");
log("Total subscription callbacks received: " + receivedUpdates.length);
for (var i = 0; i < receivedUpdates.length; i++) {
    log("  " + (i+1) + ". " + JSON.stringify(receivedUpdates[i]));
}

log("");
log("=== DIAGNOSTIC COMPLETE ===");
log("Log saved to: " + LOG_FILE);
log("");
log("Please share the contents of the log file for analysis.");

client.disconnect();
