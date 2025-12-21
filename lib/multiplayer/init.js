// NBA Jam Multiplayer Bootstrap
// Attempts to load optional multiplayer modules and exposes a global flag

(function () {
    if (typeof multiplayerEnabled === "undefined") {
        multiplayerEnabled = false;
    }

    if (typeof global !== "undefined") {
        if (global.__NBAJAM_MP_INITIALIZED__) {
            return;
        }
        global.__NBAJAM_MP_INITIALIZED__ = true;
    } else if (typeof this.__NBAJAM_MP_INITIALIZED__ !== "undefined") {
        return;
    } else {
        this.__NBAJAM_MP_INITIALIZED__ = true;
    }

    var basePath = js.exec_dir + "lib/multiplayer/";
    var modules = [
        "mp_identity.js",
        "mp_team_data.js",
        "mp_config.js",
        "mp_network.js",
        "mp_sessions.js",
        "mp_lobby.js",
        "mp_coordinator.js",
        "mp_client.js"
    ];

    try {
        for (var i = 0; i < modules.length; i++) {
            load(basePath + modules[i]);
        }
        multiplayerEnabled = true;
    } catch (mpErr) {
        multiplayerEnabled = false;
        try {
            
        } catch (logErr) {
            // ignore logging failures
        }
    }
})();
