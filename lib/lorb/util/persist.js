/**
 * persist.js - LORB Character Persistence via Local JSON-DB
 * 
 * Uses Synchronet's local JSONdb (json-db.js) for file-based persistence.
 * Data is stored in nba_jam/data/lorb.json
 */
(function () {
    // Load local JSONdb (file-based, not network client)
    if (typeof JSONdb === "undefined") {
        load("json-db.js");
    }
    
    // Database file path - stored in game data directory
    var gameRoot = js.exec_dir.replace(/lib[\/\\]lorb[\/\\]util[\/\\]?$/, "").replace(/lib[\/\\]lorb[\/\\]?$/, "");
    var DB_FILE = gameRoot + "data/lorb.json";
    var DB_SCOPE = "lorb";           // local JSONdb file scope
    var SERVICE_SCOPE = "nba_jam";   // JSONClient (network) scope - standardized to match challenges
    
    // Ensure data directory exists
    var dataDir = gameRoot + "data";
    if (!file_isdir(dataDir)) {
        mkdir(dataDir);
    }
    
    // Presence timeout - consider offline if no heartbeat in this time
    // Use config value with fallback for backwards compatibility
    var PresenceConfig = (typeof LORB !== "undefined" && LORB.Config && LORB.Config.PRESENCE) || {};
    var PRESENCE_TIMEOUT_MS = PresenceConfig.TIMEOUT_MS || 60000;  // 60 seconds default
    
    // Database instance
    var db = null;
    
    // Load JSONClient helper for ephemeral presence/challenges
    if (!LORB.JsonClientHelper) {
        try { load("/sbbs/xtrn/nba_jam/lib/lorb/util/json_client_helper.js"); } catch (e) {}
    }

    var LOCK_READ_CONST = (typeof LOCK_READ !== "undefined") ? LOCK_READ : 1;
    var LOCK_WRITE_CONST = (typeof LOCK_WRITE !== "undefined") ? LOCK_WRITE : 2;
    
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

    // REMOVED: Lock-based operations cause blocking across BBS users.
    // The new architecture uses fire-and-forget writes via pub/sub in challenges_pubsub.js
    // These stub functions are kept for backwards compatibility but do nothing.
    function lockPath(client, scope, path, lockType) {
        // NO-OP: Locks removed to prevent blocking
    }

    function unlockPath(client, scope, path) {
        // NO-OP: Locks removed to prevent blocking
    }
    
    /**
     * Initialize or get database instance
     */
    function getDb() {
        if (db) return db;
        
        try {
            db = new JSONdb(DB_FILE, DB_SCOPE);
            if (db.settings) {
                db.settings.KEEP_READABLE = true;  // Human-readable JSON
            }
            // Load existing data from file
            db.load();
            log(LOG_INFO, "LORB: Initialized local database: " + DB_FILE);
        } catch (e) {
            log(LOG_ERR, "LORB: Failed to initialize database: " + e);
            db = null;
        }
        
        return db;
    }
    
    /**
     * Save database to disk
     */
    function flush() {
        if (db) {
            try {
                db.save();
                return true;
            } catch (e) {
                log(LOG_ERR, "LORB: Failed to save database: " + e);
            }
        }
        return false;
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
     * Read data from database
     */
    function read(path) {
        var database = getDb();
        if (!database || !database.masterData || !database.masterData.data) {
            return null;
        }
        
        // Reload from disk to see cross-process writes (JSONdb is not shared in memory)
        try { database.load(); } catch (e) {}
        
        // Navigate the path
        var parts = path.split(".");
        var current = database.masterData.data;
        
        for (var i = 0; i < parts.length; i++) {
            if (current === null || current === undefined) return null;
            if (typeof current !== "object") return null;
            current = current[parts[i]];
        }
        
        return current;
    }
    
    /**
     * Write data to database
     */
    function write(path, data) {
        var database = getDb();
        if (!database || !database.masterData) {
            return false;
        }
        
        if (!database.masterData.data) {
            database.masterData.data = {};
        }
        
        // Navigate/create the path
        var parts = path.split(".");
        var current = database.masterData.data;
        
        for (var i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] === undefined || current[parts[i]] === null) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }
        
        // Set the value
        current[parts[parts.length - 1]] = data;
        
        // Mark as updated and save
        database.settings.UPDATES = true;
        flush();
        
        return true;
    }
    
    /**
     * Remove data from database
     */
    function removeData(path) {
        var database = getDb();
        if (!database || !database.masterData || !database.masterData.data) {
            return false;
        }
        
        var parts = path.split(".");
        var current = database.masterData.data;
        
        for (var i = 0; i < parts.length - 1; i++) {
            if (current === null || current === undefined) return false;
            if (typeof current !== "object") return false;
            current = current[parts[i]];
        }
        
        if (current && typeof current === "object") {
            delete current[parts[parts.length - 1]];
            database.settings.UPDATES = true;
            flush();
            return true;
        }
        
        return false;
    }
    
    /**
     * Load player data
     * @param {object} u - Synchronet user object
     * @returns {object|null} Player context or null if not found
     */
    function loadPlayer(u) {
        var globalId = getGlobalPlayerId(u);
        if (!globalId) return null;
        
        var path = "players." + globalId;
        var start = nowMs();
        
        var data = read(path);
        logDb("read", path, data ? "ok" : "empty", start);
        
        if (data) {
            log(LOG_DEBUG, "LORB: Loaded player " + globalId);
        }
        
        return data;
    }
    
    /**
     * Save player data
     * @param {object} ctx - Player context to save
     */
    function savePlayer(ctx) {
        if (!ctx || !ctx._user) {
            log(LOG_ERR, "LORB: Cannot save - no user context");
            return false;
        }
        
        var globalId = getGlobalPlayerId(ctx._user);
        if (!globalId) return false;
        
        var path = "players." + globalId;
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
        
        var ok = write(path, saveData);
        logDb("write", path, ok ? "ok" : "error", start, "keys=" + Object.keys(saveData).length);
        
        if (ok) {
            log(LOG_DEBUG, "LORB: Saved player " + globalId);
        }
        
        return ok;
    }
    
    /**
     * Check if a player exists
     * @param {object} u - Synchronet user object
     * @returns {boolean}
     */
    function exists(u) {
        return loadPlayer(u) !== null;
    }
    
    /**
     * Delete a player's data
     * @param {object} u - Synchronet user object
     */
    function removePlayer(u) {
        var globalId = getGlobalPlayerId(u);
        if (!globalId) return false;
        
        var path = "players." + globalId;
        var start = nowMs();
        
        var ok = removeData(path);
        logDb("remove", path, ok ? "ok" : "error", start);
        
        if (ok) {
            log(LOG_DEBUG, "LORB: Removed player " + globalId);
        }
        
        return ok;
    }
    
    /**
     * List all players (for leaderboard, etc.)
     * @returns {Array} Array of player summaries
     */
    function listPlayers() {
        var start = nowMs();
        var allPlayers = read("players");
        logDb("listPlayers", "players", "ok", start, allPlayers ? "count=" + Object.keys(allPlayers).length : "none");
        
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
                    bbsId: p._bbsId || null,           // QWK ID for avatar lookup
                    userHandle: p.userHandle || null,  // Synchronet alias for avatar lookup
                    stats: p.stats || {},
                    careerStats: p.careerStats || null,
                    records: p.records || null,
                    appearance: p.appearance || null,
                    pvpStats: p.pvpStats || null,
                    pvpRecords: p.pvpRecords || null,
                    // Season-specific stats for historical leaderboards
                    seasonStats: p.seasonStats || null,
                    seasonRecords: p.seasonRecords || null,
                    // Ghost match support: include crew data
                    contacts: p.contacts || [],
                    activeTeammate: p.activeTeammate || null
                });
            }
        }
        
        return players;
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
    
    function getJsonScope() {
        var cfg = getServerConfig();
        if (cfg && cfg.scope) return cfg.scope;
        return SERVICE_SCOPE;
    }
    
    /**
     * Set presence (mark player as online)
     * Delegates to challenges pub/sub implementation for proper subscription setup
     * @param {object} u - Synchronet user object or context
     */
    function setPresence(u) {
        // Delegate to pub/sub implementation which handles subscriptions
        if (LORB.Multiplayer && LORB.Multiplayer.Challenges && LORB.Multiplayer.Challenges.setPresence) {
            // Wrap user in ctx format if needed
            var ctx = u._user ? u : { _user: u };
            return LORB.Multiplayer.Challenges.setPresence(ctx);
        }
        
        // Fallback if pub/sub not loaded
        var globalId = getGlobalPlayerId(u._user || u);
        if (!globalId) return false;
        if (typeof LORB !== "undefined" && LORB.Config && LORB.Config.ENABLE_LIVE_CHALLENGES === false) {
            return false;
        }
        if (!LORB.JsonClientHelper) return false;
        var c = LORB.JsonClientHelper.ensureClient();
        if (!c) return false;
        var start = nowMs();
        var scope = getJsonScope();
        var path = "rimcity.presence." + globalId;
        try {
            // Fire-and-forget write (TIMEOUT=-1 means don't wait for response)
            c.write(scope, path, {
                globalId: globalId,
                timestamp: Date.now(),
                userName: (u._user || u).alias || (u._user || u).name || "Unknown"
            });
            logDb("presence.set", path, "ok", start);
            return true;
        } catch (e) {
            LORB.JsonClientHelper.markFailure && LORB.JsonClientHelper.markFailure();
            logDb("presence.set", path, "error", start, "err=" + e);
            return false;
        }
    }
    
    /**
     * Clear presence (mark player as offline)
     * Fire-and-forget - no locks, no waiting for response
     * @param {object} u - Synchronet user object
     */
    function clearPresence(u) {
        var globalId = getGlobalPlayerId(u);
        if (!globalId) return false;
        if (typeof LORB !== "undefined" && LORB.Config && LORB.Config.ENABLE_LIVE_CHALLENGES === false) {
            return false;
        }
        if (!LORB.JsonClientHelper) return false;
        var c = LORB.JsonClientHelper.ensureClient();
        if (!c) return false;
        var path = "rimcity.presence." + globalId;
        var start = nowMs();
        var scope = getJsonScope();
        try {
            // Fire-and-forget remove
            c.remove(scope, path);
            logDb("presence.clear", path, "ok", start);
            return true;
        } catch (e) {
            LORB.JsonClientHelper.markFailure && LORB.JsonClientHelper.markFailure();
            logDb("presence.clear", path, "error", start, "err=" + e);
            return false;
        }
    }
    
    /**
     * Check if a player is currently online
     * NOTE: This still needs to read from server. Consider using cached presence
     * from challenges_pubsub.js instead for non-blocking behavior.
     * DEPRECATED: Use LORB.Multiplayer.Challenges.isPlayerOnline() instead.
     * @param {string} globalId - Player's global ID
     * @returns {boolean}
     */
    function isPlayerOnline(globalId) {
        // Delegate to pub/sub implementation if available
        if (LORB.Multiplayer && LORB.Multiplayer.Challenges && LORB.Multiplayer.Challenges.isPlayerOnline) {
            return LORB.Multiplayer.Challenges.isPlayerOnline(globalId);
        }
        // Fallback: return false rather than blocking
        return false;
    }
    
    /**
     * Get all online players
     * DEPRECATED: Use LORB.Multiplayer.Challenges.getOnlinePlayers() instead.
     * @returns {Object} Map of globalId -> presence data
     */
    function getOnlinePlayers() {
        // Delegate to pub/sub implementation if available
        if (LORB.Multiplayer && LORB.Multiplayer.Challenges && LORB.Multiplayer.Challenges.getOnlinePlayers) {
            return LORB.Multiplayer.Challenges.getOnlinePlayers();
        }
        // Fallback: return empty rather than blocking
        return {};
    }
    
    // =====================================================
    // GENERIC SHARED DATA ACCESS
    // =====================================================
    
    /**
     * Read shared data from an arbitrary path
     * @param {string} path - Path (e.g., "marriages")
     * @returns {*} Data at path or null
     */
    function readShared(path) {
        var start = nowMs();
        var data = read(path);
        logDb("readShared", path, data ? "ok" : "empty", start);
        return data;
    }
    
    /**
     * Write shared data to an arbitrary path
     * @param {string} path - Path (e.g., "marriages")
     * @param {*} data - Data to write
     * @returns {boolean} Success
     */
    function writeShared(path, data) {
        var start = nowMs();
        var ok = write(path, data);
        logDb("writeShared", path, ok ? "ok" : "error", start);
        return ok;
    }
    
    /**
     * Remove shared data at an arbitrary path
     * @param {string} path - Path (e.g., "challenges.player123")
     * @returns {boolean} Success
     */
    function removeShared(path) {
        var start = nowMs();
        var ok = removeData(path);
        logDb("removeShared", path, ok ? "ok" : "error", start);
        return ok;
    }
    
    // =====================================================
    // GRAFFITI WALL (Club 23 Restroom)
    // =====================================================
    
    /**
     * Read all graffiti entries
     * @returns {Array} Array of graffiti entries (newest first)
     */
    function readGraffiti() {
        var start = nowMs();
        var data = read("graffiti");
        logDb("graffiti.read", "graffiti", "ok", start, data ? "count=" + (data.entries ? data.entries.length : 0) : "empty");
        
        if (!data || !data.entries) return [];
        return data.entries;
    }
    
    /**
     * Add a graffiti entry
     * @param {object} ctx - Player context (for author info)
     * @param {Array<string>} lines - Array of 1-3 lines of text
     * @returns {boolean} Success
     */
    function addGraffiti(ctx, lines) {
        if (!ctx || !lines || lines.length === 0) return false;
        
        var maxEntries = (LORB.Config && LORB.Config.MAX_GRAFFITI_ENTRIES) || 100;
        var maxLines = (LORB.Config && LORB.Config.MAX_GRAFFITI_LINES) || 3;
        var maxLineLen = (LORB.Config && LORB.Config.GRAFFITI_LINE_LENGTH) || 60;
        
        // Sanitize lines
        var sanitized = [];
        for (var i = 0; i < lines.length && i < maxLines; i++) {
            var line = String(lines[i] || "").substring(0, maxLineLen);
            line = line.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
            if (line.length > 0) {
                sanitized.push(line);
            }
        }
        
        if (sanitized.length === 0) return false;
        
        var start = nowMs();
        
        // Read existing entries
        var data = read("graffiti");
        var entries = (data && data.entries) ? data.entries : [];
        
        // Create new entry
        var entry = {
            author: ctx.name || ctx.nickname || "Anonymous",
            authorId: ctx._globalId || null,
            bbsName: (typeof system !== "undefined" && system.name) ? system.name : "Unknown",
            lines: sanitized,
            timestamp: Date.now()
        };
        
        // Add to beginning (newest first)
        entries.unshift(entry);
        
        // Trim to max entries
        if (entries.length > maxEntries) {
            entries = entries.slice(0, maxEntries);
        }
        
        // Write back
        var ok = write("graffiti", { entries: entries });
        logDb("graffiti.add", "graffiti", ok ? "ok" : "error", start, "total=" + entries.length);
        
        if (ok) {
            log(LOG_DEBUG, "LORB: Added graffiti by " + entry.author);
        }
        
        return ok;
    }
    
    /**
     * Disconnect/cleanup (compatibility with old API)
     */
    function disconnect() {
        flush();
    }
    
    /**
     * Connect (compatibility with old API - always succeeds for local db)
     */
    function connect() {
        return getDb() !== null;
    }
    
    /**
     * Get server config for JSON service (used by live challenges).
     * Returns the Synchronet JSON service endpoint on localhost.
     */
    function getServerConfig() {
        return {
            name: "Synchronet JSON Service",
            addr: "localhost",
            port: 10088,
            isLocal: true,
            scope: (LORB.Config && LORB.Config.JSON_CLIENT && LORB.Config.JSON_CLIENT.scope) || "nba_jam"
        };
    }
    
    // Export to LORB namespace
    LORB.Persist = {
        connect: connect,
        disconnect: disconnect,
        load: loadPlayer,
        save: savePlayer,
        exists: exists,
        remove: removePlayer,
        listPlayers: listPlayers,
        getLeaderboard: getLeaderboard,
        getGlobalPlayerId: getGlobalPlayerId,
        setPresence: setPresence,
        clearPresence: clearPresence,
        isPlayerOnline: isPlayerOnline,
        getOnlinePlayers: getOnlinePlayers,
        readShared: readShared,
        writeShared: writeShared,
        readGraffiti: readGraffiti,
        addGraffiti: addGraffiti,
        flush: flush,
        PRESENCE_TIMEOUT_MS: PRESENCE_TIMEOUT_MS,
        getServerConfig: getServerConfig,
        removeShared: removeShared,
        // For debugging
        _getDb: getDb
    };
    
})();
