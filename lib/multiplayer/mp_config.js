// mp_config.js - Multiplayer Configuration
// Handles server selection and connection settings for local and inter-BBS play

// Multiplayer constants
var MP_CHAT_CHANNEL = "nba_jam_lobby";

// Default configuration
var MP_CONFIG = {
    // Server modes
    modes: {
        LOCAL: "local",
        INTERBBS: "interbbs",
        CUSTOM: "custom"
    },

    // Default servers
    servers: {
        local: {
            name: "Local BBS",
            addr: "localhost",
            port: 10088,
            description: "Games with players on this BBS only"
        },
        interbbs: {
            name: "Synchronet Network",
            addr: "services.synchro.net",  // Example - would need real server
            port: 10088,
            description: "Games with players from any BBS"
        }
    },

    // Performance tuning based on network conditions
    tuning: {
        local: {
            inputFlushInterval: 33,      // 30 FPS
            stateUpdateInterval: 50,     // 20 FPS
            maxInputBatch: 5,
            reconciliationStrength: 0.5
        },
        interbbs: {
            inputFlushInterval: 50,      // 20 FPS
            stateUpdateInterval: 100,    // 10 FPS
            maxInputBatch: 10,
            reconciliationStrength: 0.3
        }
    }
};

// Load custom configuration from file
function loadCustomConfig() {
    var configFile = new File(js.exec_dir + "lib/config/mp_config.ini");
    if (!configFile.open("r")) {
        return false;
    }

    var customServers = {};
    var currentSection = null;

    while (!configFile.eof) {
        var line = configFile.readln();
        if (!line) continue;
        line = line.trim();

        // Skip comments and empty lines
        if (line === "" || line[0] === "#" || line[0] === ";") continue;

        // Section header
        if (line[0] === "[" && line[line.length - 1] === "]") {
            currentSection = line.substring(1, line.length - 1).toLowerCase();
            if (!customServers[currentSection]) {
                customServers[currentSection] = {};
            }
            continue;
        }

        // Key=value
        var eqPos = line.indexOf("=");
        if (eqPos > 0 && currentSection) {
            var key = line.substring(0, eqPos).trim().toLowerCase();
            var value = line.substring(eqPos + 1).trim();
            customServers[currentSection][key] = value;
        }
    }

    configFile.close();

    // Merge custom servers into config
    for (var serverId in customServers) {
        var serverDef = customServers[serverId];
        if (serverDef.addr && serverDef.port) {
            MP_CONFIG.servers[serverId] = {
                name: serverDef.name || serverId,
                addr: serverDef.addr,
                port: parseInt(serverDef.port),
                description: serverDef.description || "Custom server"
            };
        }
    }

    return true;
}

// Select server interactively
function selectServer() {
    loadCustomConfig();

    console.clear();
    console.print("\1h\1cNBA JAM - Multiplayer Server Selection\1n\r\n\r\n");

    var servers = [];
    var serverIds = [];

    var index = 1;
    for (var serverId in MP_CONFIG.servers) {
        var server = MP_CONFIG.servers[serverId];
        servers.push(server);
        serverIds.push(serverId);

        console.print(format("\1h\1y%d.\1n \1h\1w%s\1n\r\n", index, server.name));
        console.print(format("   %s:%d\r\n", server.addr, server.port));
        console.print(format("   \1n\1w%s\1n\r\n\r\n", server.description));

        index++;
    }

    console.print(format("\1h\1y%d.\1n \1h\1wCustom Server\1n (enter manually)\r\n\r\n", index));

    console.print("\1h\1gSelect server (1-" + index + "):\1n ");

    var choice = console.getnum(index);
    if (choice < 1 || choice > index) {
        return null;
    }

    // Custom server
    if (choice === index) {
        return promptCustomServer();
    }

    // Pre-configured server
    var selectedId = serverIds[choice - 1];
    return {
        id: selectedId,
        server: MP_CONFIG.servers[selectedId],
        tuning: MP_CONFIG.tuning[selectedId] || MP_CONFIG.tuning.interbbs
    };
}

// Prompt for custom server details
function promptCustomServer() {
    console.print("\r\n\1h\1cCustom Server Configuration\1n\r\n\r\n");

    console.print("Server address: ");
    var addr = console.getstr("", 64, K_LINE);
    if (!addr) return null;

    console.print("Port [10088]: ");
    var portStr = console.getstr("10088", 5, K_LINE | K_NUMBER);
    var port = parseInt(portStr) || 10088;

    return {
        id: "custom",
        server: {
            name: "Custom",
            addr: addr,
            port: port,
            description: "Custom server"
        },
        tuning: MP_CONFIG.tuning.interbbs
    };
}

// Test connection to server
function testConnection(server, timeout) {
    timeout = timeout || 5000;

    console.print("\r\nTesting connection to " + server.addr + ":" + server.port + "... ");

    try {
        var testClient = new JSONClient(server.addr, server.port);
        testClient.settings.CONNECTION_TIMEOUT = timeout / 1000;

        if (!testClient.connect()) {
            console.print("\1r\1hFAILED\1n - Cannot connect\r\n");
            return false;
        }

        // Test basic read
        var testResult = testClient.read("system", "version", 1);

        testClient.disconnect();

        console.print("\1g\1hSUCCESS\1n\r\n");
        return true;

    } catch (e) {
        console.print("\1r\1hERROR\1n - " + e + "\r\n");
        return false;
    }
}

// Measure latency to server
function measureLatency(client, samples) {
    samples = samples || 5;
    var latencies = [];

    for (var i = 0; i < samples; i++) {
        var start = Date.now();

        // Simple ping - write and read back
        client.write("nba_jam", "ping." + user.number, { t: start }, 2);
        var pong = client.read("nba_jam", "ping." + user.number, 1);

        var latency = Date.now() - start;
        latencies.push(latency);

        mswait(100);
    }

    // Calculate average (excluding outliers)
    latencies.sort(function (a, b) { return a - b; });
    var middle = latencies.slice(1, latencies.length - 1);

    var sum = 0;
    for (var i = 0; i < middle.length; i++) {
        sum += middle[i];
    }

    return middle.length > 0 ? Math.round(sum / middle.length) : 0;
}

// Get latency quality indicator
function getLatencyIndicator(latencyMs) {
    if (latencyMs < 30) {
        return { text: "Excellent", color: "\1g\1h", bars: "●●●●●" };
    } else if (latencyMs < 80) {
        return { text: "Good", color: "\1g", bars: "●●●●○" };
    } else if (latencyMs < 150) {
        return { text: "Fair", color: "\1y", bars: "●●●○○" };
    } else if (latencyMs < 250) {
        return { text: "Poor", color: "\1r\1h", bars: "●●○○○" };
    } else {
        return { text: "Bad", color: "\1r", bars: "●○○○○" };
    }
}

// Auto-select best server based on latency
function autoSelectBestServer() {
    loadCustomConfig();

    console.print("\r\n\1h\1cTesting servers...\1n\r\n\r\n");

    var results = [];

    for (var serverId in MP_CONFIG.servers) {
        var server = MP_CONFIG.servers[serverId];

        console.print(format("%-20s ", server.name));

        try {
            var testClient = new JSONClient(server.addr, server.port);
            testClient.settings.CONNECTION_TIMEOUT = 3;

            if (!testClient.connect()) {
                console.print("\1r\1hOFFLINE\1n\r\n");
                continue;
            }

            var latency = measureLatency(testClient, 3);
            testClient.disconnect();

            var indicator = getLatencyIndicator(latency);
            console.print(format("%s%s %dms\1n\r\n",
                indicator.color, indicator.bars, latency));

            results.push({
                id: serverId,
                server: server,
                latency: latency
            });

        } catch (e) {
            console.print("\1r\1hERROR\1n\r\n");
        }
    }

    if (results.length === 0) {
        console.print("\r\n\1r\1hNo servers available\1n\r\n");
        return null;
    }

    // Sort by latency
    results.sort(function (a, b) { return a.latency - b.latency; });

    var best = results[0];
    console.print(format("\r\nBest server: \1h\1w%s\1n (%dms)\r\n",
        best.server.name, best.latency));

    return {
        id: best.id,
        server: best.server,
        tuning: MP_CONFIG.tuning[best.id] || MP_CONFIG.tuning.interbbs,
        latency: best.latency
    };
}

// Save server preference
function saveServerPreference(serverId) {
    var prefFile = new File(js.exec_dir + "lib/config/mp_server.pref");
    if (prefFile.open("w")) {
        prefFile.writeln(serverId);
        prefFile.close();
    }
}

// Load server preference
function loadServerPreference() {
    var prefFile = new File(js.exec_dir + "lib/config/mp_server.pref");
    if (prefFile.open("r")) {
        var serverId = prefFile.readln();
        prefFile.close();

        loadCustomConfig();
        if (MP_CONFIG.servers[serverId]) {
            return {
                id: serverId,
                server: MP_CONFIG.servers[serverId],
                tuning: MP_CONFIG.tuning[serverId] || MP_CONFIG.tuning.interbbs
            };
        }
    }
    return null;
}
