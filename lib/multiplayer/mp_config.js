// mp_config.js - Multiplayer Configuration
// Handles server selection and connection settings for local and inter-BBS play

// Multiplayer constants
var MP_CHAT_CHANNEL = MP_CONSTANTS.CHAT_CHANNEL || "nba_jam_lobby";

// Default configuration
var MP_CONFIG = {
    // Server modes
    modes: {
        LOCAL: "local",
        INTERBBS: "interbbs",
        CUSTOM: "custom"
    },

    // Default server preference (first option in legacy menu)
    defaultServerId: "local",

    // Default servers
    servers: MP_CONSTANTS.DEFAULT_SERVERS,

    // Performance tuning based on network conditions
    tuning: MP_CONSTANTS.TUNING_PRESETS
};

// Load custom configuration from file
function loadCustomConfig() {
    // Standard convention: server_multiplayer.ini in game root
    var gameRoot = js.exec_dir.replace(/lib[\/\\]multiplayer[\/\\]?$/, "");
    var configFile = new File(gameRoot + "server_multiplayer.ini");
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

            if (key === "default") {
                var normalized = value.toLowerCase();
                customServers[currentSection]._default =
                    (normalized === "true" || normalized === "1" || normalized === "yes");
            } else {
                customServers[currentSection][key] = value;
            }
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

            if (serverDef._default) {
                MP_CONFIG.defaultServerId = serverId;
            }
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

// Measure latency to server
function measureLatency(client, samples) {
    samples = samples || MP_CONSTANTS.MEASURE_LATENCY_SAMPLES || 5;
    var latencies = [];

    for (var i = 0; i < samples; i++) {
        var start = Date.now();

        // Simple ping - write and read back
        client.write("nba_jam", "ping." + user.number, { t: start }, 2);
        var pong = client.read("nba_jam", "ping." + user.number, 1);

        var latency = Date.now() - start;
        latencies.push(latency);

        mswait(MP_CONSTANTS.MEASURE_LATENCY_MSWAIT || 100);
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
    var ladder = MP_CONSTANTS.LATENCY_INDICATORS;
    if (ladder && ladder.length) {
        for (var i = 0; i < ladder.length; i++) {
            if (latencyMs < ladder[i].threshold) {
                return ladder[i];
            }
        }
        var last = ladder[ladder.length - 1];
        return {
            text: "Bad",
            color: "\1r",
            bars: "●○○○○",
            threshold: last.threshold
        };
    }
    if (latencyMs < 30) {
        return { text: "Excellent", color: "\1g\1h", bars: "●●●●●" };
    } else if (latencyMs < 80) {
        return { text: "Good", color: "\1g", bars: "●●●●○" };
    } else if (latencyMs < 150) {
        return { text: "Fair", color: "\1y", bars: "●●●○○" };
    } else if (latencyMs < 250) {
        return { text: "Poor", color: "\1r\1h", bars: "●●○○○" };
    }
    return { text: "Bad", color: "\1r", bars: "●○○○○" };
}

// Load server preference
function loadServerPreference() {
    var gameRoot = js.exec_dir.replace(/lib[\/\\]multiplayer[\/\\]?$/, "");
    var prefFile = new File(gameRoot + "data/mp_server.pref");
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
