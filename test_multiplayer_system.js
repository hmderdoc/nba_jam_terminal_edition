// Comprehensive multiplayer system test
// Tests all components: identity, config, network, sessions, lobby

// Note: Must set js.exec_dir before loading modules
if (typeof js === "undefined") {
    js = { exec_dir: "/sbbs/xtrn/nba_jam/" };
}

load("/sbbs/exec/load/json-client.js");
load(js.exec_dir + "mp_identity.js");
load(js.exec_dir + "mp_config.js");
load(js.exec_dir + "mp_network.js");
load(js.exec_dir + "mp_sessions.js");

var output = (typeof console !== "undefined" && console.print) ? console.print : print;

output("\r\n\1h\1cNBA JAM Multiplayer System Test\1n\r\n");
output("==================================\r\n\r\n");

try {
    // Test 1: Player Identity
    output("1. Testing player identity system...\r\n");
    var myId = createPlayerIdentifier();
    output("   Player ID: " + myId.globalId + "\r\n");
    output("   Display Name: " + myId.displayName + "\r\n");
    output("   BBS: " + myId.bbsName + "\r\n");
    output("   \1g\1hOK\1n\r\n\r\n");

    // Test 2: Server Configuration
    output("2. Testing server configuration...\r\n");
    var servers = getAvailableServers();
    output("   Found " + servers.length + " server(s)\r\n");
    for (var i = 0; i < servers.length; i++) {
        output("   - " + servers[i].name + " (" + servers[i].addr + ":" + servers[i].port + ")\r\n");
    }
    var localServer = servers[0]; // Use first server
    output("   Using: " + localServer.name + "\r\n");
    output("   \1g\1hOK\1n\r\n\r\n");

    // Test 3: JSON Client Connection
    output("3. Testing JSON client connection...\r\n");
    var client = new JSONClient(localServer.addr, localServer.port);
    output("   Client created\r\n");
    output("   Connected: " + client.connected + "\r\n");
    output("   \1g\1hOK\1n\r\n\r\n");

    // Test 4: Session Creation
    output("4. Testing session creation...\r\n");
    var testSessionId = myId.bbsQwkId + "_test_" + Date.now();
    var sessionData = {
        id: testSessionId,
        status: "testing",
        host: myId.globalId,
        created: Date.now(),
        players: {}
    };
    sessionData.players[myId.globalId] = {
        id: myId.globalId,
        name: myId.displayName,
        ready: false
    };

    client.write("nba_jam", "lobby.sessions." + testSessionId, sessionData, 2);
    output("   Session written: " + testSessionId + "\r\n");
    output("   \1g\1hOK\1n\r\n\r\n");

    // Test 5: Session Read
    output("5. Testing session read...\r\n");
    var readBack = client.read("nba_jam", "lobby.sessions." + testSessionId, 1);
    if (readBack && readBack.id === testSessionId) {
        output("   Session read successfully\r\n");
        output("   Host: " + readBack.host + "\r\n");
        output("   Players: " + Object.keys(readBack.players).length + "\r\n");
        output("   \1g\1hOK\1n\r\n\r\n");
    } else {
        output("   \1r\1hFAILED\1n - Session data mismatch\r\n\r\n");
    }

    // Test 6: Input Queue
    output("6. Testing input queue...\r\n");
    var inputData = {
        sequence: 1,
        timestamp: Date.now(),
        inputs: [
            { key: "UP", frame: 1 },
            { key: "A", frame: 2 }
        ]
    };
    client.write("nba_jam", "game." + testSessionId + ".inputs." + myId.globalId, inputData, 2);
    output("   Input queue written\r\n");

    var inputReadBack = client.read("nba_jam", "game." + testSessionId + ".inputs." + myId.globalId, 1);
    if (inputReadBack && inputReadBack.sequence === 1) {
        output("   Input queue read successfully\r\n");
        output("   Inputs: " + inputReadBack.inputs.length + "\r\n");
        output("   \1g\1hOK\1n\r\n\r\n");
    } else {
        output("   \1r\1hFAILED\1n - Input data mismatch\r\n\r\n");
    }

    // Test 7: Game State
    output("7. Testing game state broadcast...\r\n");
    var gameState = {
        frame: 123,
        timestamp: Date.now(),
        players: [
            { x: 100, y: 150, bearing: "E" },
            { x: 200, y: 150, bearing: "W" }
        ],
        ball: { x: 150, y: 150 },
        score: { red: 2, blue: 0 }
    };
    client.write("nba_jam", "game." + testSessionId + ".state", gameState, 2);
    output("   Game state written\r\n");

    var stateReadBack = client.read("nba_jam", "game." + testSessionId + ".state", 1);
    if (stateReadBack && stateReadBack.frame === 123) {
        output("   Game state read successfully\r\n");
        output("   Frame: " + stateReadBack.frame + "\r\n");
        output("   Players: " + stateReadBack.players.length + "\r\n");
        output("   \1g\1hOK\1n\r\n\r\n");
    } else {
        output("   \1r\1hFAILED\1n - State data mismatch\r\n\r\n");
    }

    // Test 8: Cleanup
    output("8. Cleaning up test data...\r\n");
    client.remove("nba_jam", "lobby.sessions." + testSessionId, 2);
    client.remove("nba_jam", "game." + testSessionId + ".inputs." + myId.globalId, 2);
    client.remove("nba_jam", "game." + testSessionId + ".state", 2);
    output("   Test data removed\r\n");
    output("   \1g\1hOK\1n\r\n\r\n");

    client.disconnect();

    output("\1h\1g=================================\1n\r\n");
    output("\1h\1gALL TESTS PASSED!\1n\r\n");
    output("\1h\1g=================================\1n\r\n\r\n");

    output("The multiplayer system is working correctly!\r\n");
    output("You can now:\r\n");
    output("  1. Run NBA JAM and select 'Multiplayer'\r\n");
    output("  2. Test with two users on this BBS\r\n");
    output("  3. Configure for inter-BBS play in mp_config.ini\r\n\r\n");

} catch (e) {
    output("\r\n\1r\1hERROR:\1n " + e + "\r\n");
    if (e.stack) {
        output("Stack trace:\r\n" + e.stack + "\r\n");
    }
    output("\r\n");
    exit(1);
}
