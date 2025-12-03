/**
 * persist.js - LORB Character Persistence via JSON-DB
 * 
 * Uses Synchronet's JSON-DB for networked character storage.
 * Characters can be accessed from any BBS connected to the same JSON service.
 * 
 * Data is kept in memory during play and written on exit.
 */
(function () {
    // JSONClient should already be loaded by multiplayer modules (mp_lobby.js -> json-chat.js)
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
    var PRESENCE_PATH = "lorb.presence";
    
    // Presence timeout - consider offline if no heartbeat in this time
    var PRESENCE_TIMEOUT_MS = 60000;  // 60 seconds
    
    // Connection state
    var client = null;
    var connected = false;
    var serverConfig = null;
    
    function nowMs() {
        return Date.now ? Date.now() : (time() * 1000);
    }
    
    function logDb(op, path, status, startTs, extra) {
        if (typeof debugLog !== "function") return;
        var elapsed = nowMs() - startTs;
        var msg = "[LORB:PERSIST] op=" + op + " path=" + path + " status=" + status + " ms=" + elapsed;
        if (extra !== undefined && extra !== null) {
            msg += " info=" + extra;
        }
        debugLog(msg);
    }
    
    function logConnect(status, info) {
        if (typeof debugLog !== "function") return;
        debugLog("[LORB:PERSIST] connect status=" + status + (info ? (" info=" + info) : ""));
    }
    
    /**
     * Get server configuration for LORB
     * Follows standard Synchronet convention: server.ini in game root
     * If server.ini exists, connect to that host (inter-BBS play)
     * If not, fall back to localhost (local-only play)
     */
    function getServerConfig() {
        // Standard Synchronet convention: server.ini in game root directory
        // nba_jam root is two levels up from lib/lorb/util/
        var gameRoot = js.exec_dir.replace(/lib[\/\\]lorb[\/\\]util[\/\\]?$/, "").replace(/lib[\/\\]lorb[\/\\]?$/, "");
        var configPath = gameRoot + "server.ini";
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
            
            if (config.host && config.port) {
                log(LOG_INFO, "LORB: Using server.ini - " + config.host + ":" + config.port);
                return {
                    name: config.name || "Remote Server",
                    addr: config.host,
                    port: parseInt(config.port, 10)
                };
            }
        }
        
        // Fall back to local JSON service (local-only mode)
        log(LOG_INFO, "LORB: No server.ini found, using localhost (local-only mode)");
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
        
        var start = nowMs();
        try {
            serverConfig = getServerConfig();
            client = new JSONClient(serverConfig.addr, serverConfig.port);
            
            if (client.connected) {
                connected = true;
                logConnect("ok", serverConfig.addr + ":" + serverConfig.port);
                return true;
            }
        } catch (e) {
            logConnect("error", e);
            log(LOG_ERR, "LORB: Failed to connect to JSON-DB: " + e);
        }
        
        logConnect("fail", "elapsed=" + (nowMs() - start));
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
        var start = nowMs();
        
        try {
            var data = client.read(DB_SCOPE, path, LOCK_READ);
            logDb("read", path, "ok", start, data ? "hasData" : "empty");
            if (data) {
                log(LOG_DEBUG, "LORB: Loaded player " + globalId);
                return data;
            }
        } catch (e) {
            logDb("read", path, "error", start, e);
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
        var start = nowMs();
        
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
            logDb("write", path, "ok", start, "keys=" + Object.keys(saveData).length);
            log(LOG_DEBUG, "LORB: Saved player " + globalId);
            return true;
        } catch (e) {
            logDb("write", path, "error", start, e);
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
        var start = nowMs();
        
        try {
            // JSON-DB requires LOCK_WRITE as third parameter to allow deletion
            client.remove(DB_SCOPE, path, LOCK_WRITE);
            logDb("remove", path, "ok", start);
            log(LOG_DEBUG, "LORB: Removed player " + globalId);
            return true;
        } catch (e) {
            logDb("remove", path, "error", start, e);
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
            var start = nowMs();
            var allPlayers = client.read(DB_SCOPE, PLAYERS_PATH, LOCK_READ);
            logDb("listPlayers", PLAYERS_PATH, "ok", start, allPlayers ? "count=" + Object.keys(allPlayers).length : "none");
            if (!allPlayers) return [];
            
            var players = [];
            for (var id in allPlayers) {
                if (allPlayers.hasOwnProperty(id)) {
                    var p = allPlayers[id];
                    players.push({
                        globalId: p._globalId || id,
                        name: p.name || "Unknown",
                        nickname: p.nickname || null,
                        level: p.level || 1,
                        wins: p.wins || 0,
                        losses: p.losses || 0,
                        rep: p.rep || 0,
                        cash: p.cash || 0,
                        gamesPlayed: p.gamesPlayed || 0,
                        lastSave: p._lastSave || 0,
                        bbsName: p._bbsName || "Unknown",
                        stats: p.stats || {},
                        // Include career stats for league leaders
                        careerStats: p.careerStats || null,
                        records: p.records || null,
                        // Include appearance for sprite rendering
                        appearance: p.appearance || null
                    });
                }
            }
            
            return players;
        } catch (e) {
            logDb("listPlayers", PLAYERS_PATH, "error", nowMs(), e);
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
        if (typeof debugLog === "function") {
            debugLog("[LORB:PERSIST] op=getLeaderboard sort=" + sortBy + " count=" + players.length);
        }
        
        players.sort(function(a, b) {
            return (b[sortBy] || 0) - (a[sortBy] || 0);
        });
        
        return players.slice(0, limit);
    }
    
    /**
     * Set presence (mark player as online)
     * Should be called when entering LORB and periodically during play
     * @param {object} u - Synchronet user object
     */
    function setPresence(u) {
        if (!connect()) return false;
        
        var globalId = getGlobalPlayerId(u);
        if (!globalId) return false;
        
        var path = PRESENCE_PATH + "." + globalId;
        var start = nowMs();
        
        try {
            client.write(DB_SCOPE, path, {
                globalId: globalId,
                timestamp: Date.now(),
                userName: u.alias || u.name || "Unknown"
            }, LOCK_WRITE);
            logDb("presence.set", path, "ok", start);
            return true;
        } catch (e) {
            logDb("presence.set", path, "error", start, e);
            log(LOG_WARNING, "LORB: Error setting presence: " + e);
            return false;
        }
    }
    
    /**
     * Clear presence (mark player as offline)
     * Should be called when exiting LORB
     * @param {object} u - Synchronet user object
     */
    function clearPresence(u) {
        if (!connect()) return false;
        
        var globalId = getGlobalPlayerId(u);
        if (!globalId) return false;
        
        var path = PRESENCE_PATH + "." + globalId;
        var start = nowMs();
        
        try {
            client.remove(DB_SCOPE, path, LOCK_WRITE);
            logDb("presence.clear", path, "ok", start);
            return true;
        } catch (e) {
            // Ignore errors on clear - may not exist
            logDb("presence.clear", path, "error", start, e);
            return false;
        }
    }
    
    /**
     * Check if a player is currently online
     * @param {string} globalId - Player's global ID
     * @returns {boolean}
     */
    function isPlayerOnline(globalId) {
        if (!connect() || !globalId) return false;
        
        var path = PRESENCE_PATH + "." + globalId;
        var start = nowMs();
        
        try {
            var presence = client.read(DB_SCOPE, path, LOCK_READ);
            logDb("presence.check", path, "ok", start, presence ? "age=" + (Date.now() - (presence.timestamp || 0)) : "missing");
            if (!presence || !presence.timestamp) return false;
            
            // Check if presence is recent (within timeout)
            var age = Date.now() - presence.timestamp;
            return age < PRESENCE_TIMEOUT_MS;
        } catch (e) {
            logDb("presence.check", path, "error", start, e);
            return false;
        }
    }
    
    /**
     * Get all online players
     * @returns {Object} Map of globalId -> presence data
     */
    function getOnlinePlayers() {
        if (!connect()) return {};
        
        try {
            var start = nowMs();
            var allPresence = client.read(DB_SCOPE, PRESENCE_PATH, LOCK_READ);
            logDb("presence.list", PRESENCE_PATH, "ok", start, allPresence ? "count=" + Object.keys(allPresence).length : "none");
            if (!allPresence) return {};
            
            var online = {};
            var now = Date.now();
            
            for (var id in allPresence) {
                if (allPresence.hasOwnProperty(id)) {
                    var p = allPresence[id];
                    if (p && p.timestamp && (now - p.timestamp) < PRESENCE_TIMEOUT_MS) {
                        online[id] = p;
                    }
                }
            }
            
            return online;
        } catch (e) {
            logDb("presence.list", PRESENCE_PATH, "error", nowMs(), e);
            return {};
        }
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
        getGlobalPlayerId: getGlobalPlayerId,
        setPresence: setPresence,
        clearPresence: clearPresence,
        isPlayerOnline: isPlayerOnline,
        getOnlinePlayers: getOnlinePlayers,
        PRESENCE_TIMEOUT_MS: PRESENCE_TIMEOUT_MS,
        // Expose server config for other multiplayer helpers (challenge system)
        getServerConfig: getServerConfig
    };
    
})();
