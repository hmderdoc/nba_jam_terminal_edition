/**
 * persist.js - LORB Character Persistence via JSON-DB
 * 
 * Uses Synchronet's JSON-DB for networked character storage.
 * Characters can be accessed from any BBS connected to the same JSON service.
 * 
 * Data is kept in memory during play and written on exit.
 */
(function () {
    // JSONClient should already be loaded by multiplayer modules (mp_lobby.js → json-chat.js)
    // Only load if not already defined (matches json-chat.js pattern)
    if (typeof JSONClient === "undefined") {
        load("json-client.js");
    }
    
    // Lock constants (match mp_sessions.js)
    var LOCK_READ = 1;
    var LOCK_WRITE = 2;
    
    // Database paths - uses nba_jam scope (same service as multiplayer)
    var DB_SCOPE = "nba_jam";
    var PLAYERS_PATH = "lorb.players";
    
    // Connection state
    var client = null;
    var connected = false;
    var serverConfig = null;
    
    /**
     * Get server configuration for LORB
     * Uses same server as multiplayer, or falls back to local
     */
    function getServerConfig() {
        // Check if LORB has its own config
        var configPath = js.exec_dir + "lib/config/lorb_server.ini";
        var configFile = new File(configPath);
        
        if (configFile.open("r")) {
            var config = {};
            while (!configFile.eof) {
                var line = configFile.readln();
                if (!line) continue;
                line = line.trim();
                if (line === "" || line[0] === "#" || line[0] === ";") continue;
                
                var eqPos = line.indexOf("=");
                if (eqPos > 0) {
                    var key = line.substring(0, eqPos).trim().toLowerCase();
                    var value = line.substring(eqPos + 1).trim();
                    config[key] = value;
                }
            }
            configFile.close();
            
            if (config.addr && config.port) {
                return {
                    name: config.name || "LORB Server",
                    addr: config.addr,
                    port: parseInt(config.port, 10)
                };
            }
        }
        
        // Fall back to local JSON service
        return {
            name: "Local",
            addr: "localhost",
            port: 10088
        };
    }
    
    /**
     * Connect to JSON-DB service
     */
    function connect() {
        if (connected && client) {
            return true;
        }
        
        try {
            serverConfig = getServerConfig();
            client = new JSONClient(serverConfig.addr, serverConfig.port);
            
            if (client.connected) {
                connected = true;
                log(LOG_DEBUG, "LORB: Connected to JSON-DB at " + 
                    serverConfig.addr + ":" + serverConfig.port);
                return true;
            }
        } catch (e) {
            log(LOG_ERR, "LORB: Failed to connect to JSON-DB: " + e);
        }
        
        connected = false;
        client = null;
        return false;
    }
    
    /**
     * Disconnect from JSON-DB service
     */
    function disconnect() {
        if (client) {
            try {
                client.disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
        }
        client = null;
        connected = false;
    }
    
    /**
     * Generate a global player ID (cross-BBS unique)
     * Format: <bbs_id>_<user_number>
     */
    function getGlobalPlayerId(u) {
        if (!u) return null;
        
        // Use system QWK ID if available (unique per BBS)
        var bbsId = system.qwk_id || system.name || "local";
        // Sanitize for use in JSON path (no dots allowed in property names)
        bbsId = bbsId.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
        
        return bbsId + "_" + u.number;
    }
    
    /**
     * Get the JSON-DB path for a player
     */
    function getPlayerPath(globalId) {
        return PLAYERS_PATH + "." + globalId;
    }
    
    /**
     * Load player data from JSON-DB
     * @param {object} u - Synchronet user object
     * @returns {object|null} Player context or null if not found
     */
    function load(u) {
        if (!connect()) {
            log(LOG_WARNING, "LORB: Cannot load - not connected to JSON-DB");
            return null;
        }
        
        var globalId = getGlobalPlayerId(u);
        if (!globalId) return null;
        
        var path = getPlayerPath(globalId);
        
        try {
            var data = client.read(DB_SCOPE, path, LOCK_READ);
            if (data) {
                log(LOG_DEBUG, "LORB: Loaded player " + globalId);
                return data;
            }
        } catch (e) {
            log(LOG_ERR, "LORB: Error loading player " + globalId + ": " + e);
        }
        
        return null;
    }
    
    /**
     * Save player data to JSON-DB
     * @param {object} ctx - Player context to save
     */
    function save(ctx) {
        if (!connect()) {
            log(LOG_ERR, "LORB: Cannot save - not connected to JSON-DB");
            return false;
        }
        
        if (!ctx || !ctx._user) {
            log(LOG_ERR, "LORB: Cannot save - no user context");
            return false;
        }
        
        var globalId = getGlobalPlayerId(ctx._user);
        if (!globalId) return false;
        
        var path = getPlayerPath(globalId);
        
        // Create a copy without internal properties (except what we need)
        var saveData = {};
        for (var key in ctx) {
            if (ctx.hasOwnProperty(key) && key[0] !== "_") {
                saveData[key] = ctx[key];
            }
        }
        
        // Add metadata
        saveData._globalId = globalId;
        saveData._lastSave = Date.now();
        saveData._bbsId = system.qwk_id || system.name || "local";
        saveData._bbsName = system.name || "Unknown BBS";
        
        try {
            client.write(DB_SCOPE, path, saveData, LOCK_WRITE);
            log(LOG_DEBUG, "LORB: Saved player " + globalId);
            return true;
        } catch (e) {
            log(LOG_ERR, "LORB: Error saving player " + globalId + ": " + e);
            return false;
        }
    }
    
    /**
     * Check if a player exists
     * @param {object} u - Synchronet user object
     * @returns {boolean}
     */
    function exists(u) {
        return load(u) !== null;
    }
    
    /**
     * Delete a player's data
     * @param {object} u - Synchronet user object
     */
    function remove(u) {
        if (!connect()) return false;
        
        var globalId = getGlobalPlayerId(u);
        if (!globalId) return false;
        
        var path = getPlayerPath(globalId);
        
        try {
            // JSON-DB requires LOCK_WRITE as third parameter to allow deletion
            client.remove(DB_SCOPE, path, LOCK_WRITE);
            log(LOG_DEBUG, "LORB: Removed player " + globalId);
            return true;
        } catch (e) {
            log(LOG_ERR, "LORB: Error removing player " + globalId + ": " + e);
            return false;
        }
    }
    
    /**
     * List all players (for leaderboard, etc.)
     * @returns {Array} Array of player summaries
     */
    function listPlayers() {
        if (!connect()) return [];
        
        try {
            var allPlayers = client.read(DB_SCOPE, PLAYERS_PATH, LOCK_READ);
            if (!allPlayers) return [];
            
            var players = [];
            for (var id in allPlayers) {
                if (allPlayers.hasOwnProperty(id)) {
                    var p = allPlayers[id];
                    players.push({
                        globalId: p._globalId || id,
                        name: p.name || "Unknown",
                        level: p.level || 1,
                        wins: p.wins || 0,
                        losses: p.losses || 0,
                        rep: p.rep || 0,
                        bbsName: p._bbsName || "Unknown"
                    });
                }
            }
            
            return players;
        } catch (e) {
            log(LOG_ERR, "LORB: Error listing players: " + e);
            return [];
        }
    }
    
    /**
     * Get top players for leaderboard
     * @param {number} limit - Max players to return
     * @param {string} sortBy - Field to sort by (wins, rep, level)
     * @returns {Array}
     */
    function getLeaderboard(limit, sortBy) {
        limit = limit || 10;
        sortBy = sortBy || "wins";
        
        var players = listPlayers();
        
        players.sort(function(a, b) {
            return (b[sortBy] || 0) - (a[sortBy] || 0);
        });
        
        return players.slice(0, limit);
    }
    
    // Export to LORB namespace
    LORB.Persist = {
        connect: connect,
        disconnect: disconnect,
        load: load,
        save: save,
        exists: exists,
        remove: remove,
        listPlayers: listPlayers,
        getLeaderboard: getLeaderboard,
        getGlobalPlayerId: getGlobalPlayerId
    };
    
})();