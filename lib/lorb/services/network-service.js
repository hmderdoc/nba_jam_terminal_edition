/**
 * LorbNetworkService - Centralized network service for LORB
 * 
 * Handles:
 * - JSONClient connection lifecycle
 * - Presence broadcasting and tracking
 * - Challenge coordination (create, accept, decline)
 * - Multiplayer game sync
 * 
 * Architecture:
 * - Single instance per session, created in lorb.js
 * - Injected into views via options parameter
 * - Views call cycle() in their loops
 * - All network operations are fire-and-forget (TIMEOUT=-1)
 * - Errors are logged but don't surface to users
 * 
 * Usage:
 *   var service = new LorbNetworkService(ctx, config);
 *   service.start();
 *   // In view loops:
 *   service.cycle();
 *   // At session end:
 *   service.stop();
 */
(function() {
    "use strict";
    
    // Ensure LORB namespace exists
    if (typeof LORB === "undefined") {
        this.LORB = {};
    }
    if (!LORB.Services) {
        LORB.Services = {};
    }
    
    // Load JSONClient if not already loaded
    if (typeof JSONClient === "undefined") {
        try {
            load("json-client.js");
        } catch (e) {
            // Will fail gracefully later
        }
    }
    
    // Constants
    var LOCK_WRITE = 2;
    var DEFAULT_SCOPE = "nba_jam";
    var CHALLENGE_ROOT = "rimcity.challenges";
    var PRESENCE_ROOT = "rimcity.presence";
    var CYCLE_INTERVAL_MS = 250;
    var HEARTBEAT_INTERVAL_MS = 15000;
    var PRESENCE_TIMEOUT_MS = 60000;
    var CHALLENGE_TTL_MS = 5 * 60 * 1000;
    var CONNECTION_TIMEOUT_MS = 2000;
    
    /**
     * LorbNetworkService constructor
     * 
     * @param {Object} ctx - Player context (must have _user, _globalId)
     * @param {Object} config - Configuration options
     */
    function LorbNetworkService(ctx, config) {
        // Validate required context
        if (!ctx) {
            throw new Error("LorbNetworkService requires player context");
        }
        
        this._ctx = ctx;
        this._config = config || {};
        
        // Connection state
        this._client = null;
        this._connected = false;
        this._subscribed = false;
        this._started = false;
        this._disabled = false;
        
        // Identity
        this._globalId = this._resolveGlobalId(ctx);
        this._presenceData = null;
        
        // Caches
        this._challengeCache = {};
        this._presenceCache = {};
        
        // Timing
        this._lastCycleTime = 0;
        this._lastHeartbeatTime = 0;
        
        // Server config
        this._serverConfig = this._resolveServerConfig();
        
        this._log("constructed for player: " + this._globalId);
    }
    
    // =========================================================================
    // LIFECYCLE
    // =========================================================================
    
    /**
     * Start the service - connect and subscribe
     * @returns {boolean} True if started successfully
     */
    LorbNetworkService.prototype.start = function() {
        if (this._started) {
            this._log("already started");
            return true;
        }
        
        // Check if live challenges are disabled
        if (this._config.ENABLE_LIVE_CHALLENGES === false) {
            this._log("live challenges disabled by config");
            this._disabled = true;
            this._started = true;
            return true;
        }
        
        // Attempt connection
        if (!this._connect()) {
            this._logError("failed to connect, running in offline mode");
            this._disabled = true;
            this._started = true;
            return true; // Graceful degradation
        }
        
        // Subscribe to relevant paths
        if (!this._subscribe()) {
            this._logError("failed to subscribe, running in offline mode");
            this._disabled = true;
            this._started = true;
            return true; // Graceful degradation
        }
        
        // Broadcast initial presence
        this._broadcastPresence();
        
        this._started = true;
        this._log("started successfully");
        return true;
    };
    
    /**
     * Stop the service - unsubscribe and disconnect
     */
    LorbNetworkService.prototype.stop = function() {
        if (!this._started) {
            return;
        }
        
        this._log("stopping...");
        
        // Clear presence (fire-and-forget)
        if (this._client && this._connected && this._globalId) {
            try {
                this._client.remove(
                    DEFAULT_SCOPE, 
                    PRESENCE_ROOT + "." + this._globalId, 
                    LOCK_WRITE
                );
            } catch (e) {
                // Ignore - we're shutting down
            }
        }
        
        // Disconnect
        this._disconnect();
        
        // Clear state
        this._challengeCache = {};
        this._presenceCache = {};
        this._subscribed = false;
        this._started = false;
        
        this._log("stopped");
    };
    
    /**
     * Cycle the service - process incoming packets, heartbeat
     * Call this frequently from view loops (rate-limited internally)
     */
    LorbNetworkService.prototype.cycle = function() {
        if (!this._started || this._disabled || !this._connected) {
            return;
        }
        
        var now = this._now();
        
        // Rate limit cycling
        if (now - this._lastCycleTime < CYCLE_INTERVAL_MS) {
            return;
        }
        this._lastCycleTime = now;
        
        // Process incoming packets (non-blocking)
        this._processPackets();
        
        // Heartbeat presence
        if (now - this._lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
            this._lastHeartbeatTime = now;
            this._broadcastPresence();
        }
    };
    
    /**
     * Check if service is connected and active
     * @returns {boolean}
     */
    LorbNetworkService.prototype.isActive = function() {
        return this._started && !this._disabled && this._connected;
    };
    
    // =========================================================================
    // CHALLENGE API
    // =========================================================================
    
    /**
     * Get incoming challenges from cache
     * @returns {Array} Array of challenge objects
     */
    LorbNetworkService.prototype.getIncomingChallenges = function() {
        if (!this._globalId) return [];
        
        var now = this._now();
        var incoming = [];
        
        for (var id in this._challengeCache) {
            if (!this._challengeCache.hasOwnProperty(id)) continue;
            var ch = this._challengeCache[id];
            
            // Check if it's to us and pending
            if (ch.to && ch.to.globalId === this._globalId && 
                (ch.status === "pending" || ch.status === "accepted")) {
                // Check expiry
                if (!this._isExpired(ch, now)) {
                    incoming.push(ch);
                }
            }
        }
        
        return incoming;
    };
    
    /**
     * Get outgoing challenges from cache
     * @returns {Array} Array of challenge objects
     */
    LorbNetworkService.prototype.getOutgoingChallenges = function() {
        if (!this._globalId) return [];
        
        var now = this._now();
        var outgoing = [];
        
        for (var id in this._challengeCache) {
            if (!this._challengeCache.hasOwnProperty(id)) continue;
            var ch = this._challengeCache[id];
            
            // Check if it's from us and pending
            if (ch.from && ch.from.globalId === this._globalId && 
                (ch.status === "pending" || ch.status === "accepted")) {
                if (!this._isExpired(ch, now)) {
                    outgoing.push(ch);
                }
            }
        }
        
        return outgoing;
    };
    
    /**
     * Get a specific challenge by ID
     * @param {string} challengeId
     * @returns {Object|null}
     */
    LorbNetworkService.prototype.getChallenge = function(challengeId) {
        return this._challengeCache[challengeId] || null;
    };
    
    /**
     * Create a new challenge to another player
     * @param {Object} toPlayer - Target player { globalId, name, ... }
     * @returns {Object|null} The created challenge, or null on failure
     */
    LorbNetworkService.prototype.createChallenge = function(toPlayer) {
        if (!this._connected || !this._globalId || !toPlayer || !toPlayer.globalId) {
            return null;
        }
        
        var now = this._now();
        var id = "ch_" + this._globalId + "_" + toPlayer.globalId + "_" + now + "_" + Math.floor(Math.random() * 1000);
        
        var fromRef = this._buildPlayerRef(this._ctx);
        var toRef = this._buildPlayerRef(toPlayer);
        
        var challenge = {
            id: id,
            from: fromRef,
            to: toRef,
            status: "pending",
            createdAt: now,
            updatedAt: now,
            expiresAt: now + CHALLENGE_TTL_MS,
            lobby: { ready: {} }
        };
        
        // Write to both players' buckets
        var fromPath = CHALLENGE_ROOT + "." + this._globalId + "." + id;
        var toPath = CHALLENGE_ROOT + "." + toPlayer.globalId + "." + id;
        
        try {
            this._fireAndForgetWrite(fromPath, challenge);
            this._fireAndForgetWrite(toPath, challenge);
            
            // Cache locally
            this._challengeCache[id] = challenge;
            
            // Subscribe to target's bucket to see their response
            this._client.subscribe(DEFAULT_SCOPE, CHALLENGE_ROOT + "." + toPlayer.globalId);
            
            this._log("created challenge: " + id);
            return challenge;
        } catch (e) {
            this._logError("createChallenge failed: " + e);
            return null;
        }
    };
    
    /**
     * Accept a challenge
     * @param {string} challengeId
     * @returns {boolean}
     */
    LorbNetworkService.prototype.acceptChallenge = function(challengeId) {
        return this._updateChallengeStatus(challengeId, "accepted");
    };
    
    /**
     * Decline a challenge
     * @param {string} challengeId
     * @returns {boolean}
     */
    LorbNetworkService.prototype.declineChallenge = function(challengeId) {
        return this._updateChallengeStatus(challengeId, "declined");
    };
    
    /**
     * Cancel an outgoing challenge
     * @param {string} challengeId
     * @returns {boolean}
     */
    LorbNetworkService.prototype.cancelChallenge = function(challengeId) {
        return this._updateChallengeStatus(challengeId, "cancelled");
    };
    
    /**
     * Mark self as ready in challenge lobby
     * @param {string} challengeId
     * @param {boolean} ready
     * @returns {boolean}
     */
    LorbNetworkService.prototype.setReady = function(challengeId, ready) {
        var ch = this._challengeCache[challengeId];
        if (!ch || !this._globalId) return false;
        
        if (!ch.lobby) ch.lobby = { ready: {} };
        ch.lobby.ready[this._globalId] = !!ready;
        ch.updatedAt = this._now();
        
        return this._writeChallengeToBothBuckets(ch);
    };
    
    /**
     * Check if opponent is ready in challenge lobby
     * @param {string} challengeId
     * @returns {boolean}
     */
    LorbNetworkService.prototype.isOpponentReady = function(challengeId) {
        var ch = this._challengeCache[challengeId];
        if (!ch || !ch.lobby || !ch.lobby.ready) return false;
        
        var otherId = this._getOpponentId(ch);
        return !!ch.lobby.ready[otherId];
    };
    
    // =========================================================================
    // PRESENCE API
    // =========================================================================
    
    /**
     * Get online players from cache
     * @returns {Object} Map of globalId -> presence data
     */
    LorbNetworkService.prototype.getOnlinePlayers = function() {
        var now = this._now();
        var online = {};
        
        for (var gid in this._presenceCache) {
            if (!this._presenceCache.hasOwnProperty(gid)) continue;
            var p = this._presenceCache[gid];
            
            // Check if still valid (not expired)
            if (p.timestamp && (now - p.timestamp) < PRESENCE_TIMEOUT_MS) {
                // Don't include self
                if (gid !== this._globalId) {
                    online[gid] = p;
                }
            }
        }
        
        return online;
    };
    
    /**
     * Check if a specific player is online
     * @param {string} globalId
     * @returns {boolean}
     */
    LorbNetworkService.prototype.isPlayerOnline = function(globalId) {
        var p = this._presenceCache[globalId];
        if (!p || !p.timestamp) return false;
        
        var now = this._now();
        return (now - p.timestamp) < PRESENCE_TIMEOUT_MS;
    };
    
    /**
     * Get count of online players (excluding self)
     * @returns {number}
     */
    LorbNetworkService.prototype.getOnlinePlayerCount = function() {
        return Object.keys(this.getOnlinePlayers()).length;
    };
    
    // =========================================================================
    // MULTIPLAYER GAME SYNC
    // =========================================================================
    
    /**
     * Write game sync data for multiplayer coordination
     * @param {string} sessionId
     * @param {Object} syncData
     * @returns {boolean}
     */
    LorbNetworkService.prototype.writeGameSync = function(sessionId, syncData) {
        if (!this._connected) return false;
        
        var path = "game." + sessionId + ".sync";
        return this._fireAndForgetWrite(path, syncData);
    };
    
    /**
     * Subscribe to game sync updates
     * @param {string} sessionId
     * @returns {boolean}
     */
    LorbNetworkService.prototype.subscribeToGame = function(sessionId) {
        if (!this._client || !this._connected) return false;
        
        try {
            this._client.subscribe(DEFAULT_SCOPE, "game." + sessionId);
            return true;
        } catch (e) {
            this._logError("subscribeToGame failed: " + e);
            return false;
        }
    };
    
    /**
     * Unsubscribe from game sync
     * @param {string} sessionId
     * @returns {boolean}
     */
    LorbNetworkService.prototype.unsubscribeFromGame = function(sessionId) {
        if (!this._client || !this._connected) return false;
        
        try {
            this._client.unsubscribe(DEFAULT_SCOPE, "game." + sessionId);
            return true;
        } catch (e) {
            return false;
        }
    };
    
    // =========================================================================
    // PRIVATE METHODS - CONNECTION
    // =========================================================================
    
    LorbNetworkService.prototype._connect = function() {
        if (this._connected) return true;
        
        if (typeof JSONClient === "undefined") {
            this._logError("JSONClient not available");
            return false;
        }
        
        var addr = this._serverConfig.addr || "localhost";
        var port = this._serverConfig.port || 10088;
        
        try {
            this._client = new JSONClient(addr, port);
            
            // CRITICAL: Fire-and-forget mode - never block on responses
            this._client.settings.TIMEOUT = -1;
            this._client.settings.SOCK_TIMEOUT = CONNECTION_TIMEOUT_MS;
            
            // Set callback for subscription updates
            var self = this;
            this._client.callback = function(packet) {
                self._handleUpdate(packet);
            };
            
            this._connected = true;
            this._log("connected to " + addr + ":" + port);
            return true;
            
        } catch (e) {
            this._logError("connection failed: " + e);
            this._client = null;
            return false;
        }
    };
    
    LorbNetworkService.prototype._disconnect = function() {
        if (this._client) {
            try {
                // Unsubscribe from all paths
                if (this._globalId) {
                    this._client.unsubscribe(DEFAULT_SCOPE, CHALLENGE_ROOT + "." + this._globalId);
                }
                this._client.unsubscribe(DEFAULT_SCOPE, PRESENCE_ROOT);
                this._client.disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
            this._client = null;
        }
        this._connected = false;
    };
    
    LorbNetworkService.prototype._subscribe = function() {
        if (!this._client || !this._connected || !this._globalId) {
            return false;
        }
        
        if (this._subscribed) return true;
        
        try {
            // Subscribe to our challenge bucket
            this._client.subscribe(DEFAULT_SCOPE, CHALLENGE_ROOT + "." + this._globalId);
            this._log("subscribed to " + CHALLENGE_ROOT + "." + this._globalId);
            
            // Subscribe to presence
            this._client.subscribe(DEFAULT_SCOPE, PRESENCE_ROOT);
            this._log("subscribed to " + PRESENCE_ROOT);
            
            this._subscribed = true;
            return true;
            
        } catch (e) {
            this._logError("subscribe failed: " + e);
            return false;
        }
    };
    
    // =========================================================================
    // PRIVATE METHODS - PACKET HANDLING
    // =========================================================================
    
    LorbNetworkService.prototype._processPackets = function() {
        if (!this._client || !this._connected) return;
        
        try {
            // client.cycle() is non-blocking - checks data_waiting first
            var count = 0;
            while (this._client.cycle() && count < 10) {
                count++;
            }
            
            // Also drain updates array if callback wasn't invoked
            while (this._client.updates && this._client.updates.length) {
                this._handleUpdate(this._client.updates.shift());
            }
        } catch (e) {
            this._logError("processPackets error: " + e);
        }
    };
    
    LorbNetworkService.prototype._handleUpdate = function(packet) {
        if (!packet || !packet.location) return;
        
        try {
            var loc = packet.location;
            
            // Challenge update
            if (loc.indexOf(CHALLENGE_ROOT) === 0) {
                this._handleChallengeUpdate(packet);
            }
            // Presence update
            else if (loc.indexOf(PRESENCE_ROOT) === 0) {
                this._handlePresenceUpdate(packet);
            }
            // Game sync update
            else if (loc.indexOf("game.") === 0) {
                this._handleGameUpdate(packet);
            }
        } catch (e) {
            this._logError("handleUpdate error: " + e);
        }
    };
    
    LorbNetworkService.prototype._handleChallengeUpdate = function(packet) {
        var data = packet.data;
        if (!data) return;
        
        // Single challenge update
        if (data.id) {
            this._mergeChallenge(data);
        }
        // Bucket update (multiple challenges)
        else if (typeof data === "object") {
            for (var key in data) {
                if (data.hasOwnProperty(key) && key !== "_lock" && key !== "_subscribers") {
                    var ch = data[key];
                    if (ch && ch.id) {
                        this._mergeChallenge(ch);
                    }
                }
            }
        }
    };
    
    LorbNetworkService.prototype._mergeChallenge = function(ch) {
        if (!ch || !ch.id) return;
        
        var existing = this._challengeCache[ch.id];
        
        // Merge: prefer newer data, but preserve lobby.ready entries
        if (existing && existing.updatedAt && ch.updatedAt && existing.updatedAt > ch.updatedAt) {
            // Existing is newer, but merge lobby.ready
            if (ch.lobby && ch.lobby.ready) {
                if (!existing.lobby) existing.lobby = { ready: {} };
                if (!existing.lobby.ready) existing.lobby.ready = {};
                for (var rid in ch.lobby.ready) {
                    if (ch.lobby.ready.hasOwnProperty(rid)) {
                        existing.lobby.ready[rid] = ch.lobby.ready[rid];
                    }
                }
            }
        } else {
            // Incoming is newer or same age
            this._challengeCache[ch.id] = ch;
        }
    };
    
    LorbNetworkService.prototype._handlePresenceUpdate = function(packet) {
        var data = packet.data;
        if (!data) return;
        
        // Single player presence
        if (data.globalId && data.timestamp) {
            this._presenceCache[data.globalId] = data;
        }
        // Bulk presence update
        else if (typeof data === "object") {
            for (var gid in data) {
                if (data.hasOwnProperty(gid) && gid !== "_lock" && gid !== "_subscribers") {
                    var p = data[gid];
                    if (p && p.timestamp) {
                        this._presenceCache[gid] = p;
                    }
                }
            }
        }
    };
    
    LorbNetworkService.prototype._handleGameUpdate = function(packet) {
        // Game sync updates are handled by the caller via getChallenge polling
        // or could emit events if we add that later
    };
    
    // =========================================================================
    // PRIVATE METHODS - WRITES
    // =========================================================================
    
    LorbNetworkService.prototype._fireAndForgetWrite = function(path, data) {
        if (!this._client || !this._connected) return false;
        
        try {
            this._client.write(DEFAULT_SCOPE, path, data, LOCK_WRITE);
            return true;
        } catch (e) {
            this._logError("write failed: " + e);
            return false;
        }
    };
    
    LorbNetworkService.prototype._fireAndForgetRemove = function(path) {
        if (!this._client || !this._connected) return false;
        
        try {
            this._client.remove(DEFAULT_SCOPE, path, LOCK_WRITE);
            return true;
        } catch (e) {
            this._logError("remove failed: " + e);
            return false;
        }
    };
    
    LorbNetworkService.prototype._broadcastPresence = function() {
        if (!this._globalId || !this._connected) return;
        
        this._presenceData = {
            globalId: this._globalId,
            name: this._ctx.name || this._ctx.displayName || "Unknown",
            level: this._ctx.level || 1,
            timestamp: this._now(),
            system: (typeof system !== "undefined") ? (system.qwk_id || system.name) : "unknown"
        };
        
        var path = PRESENCE_ROOT + "." + this._globalId;
        this._fireAndForgetWrite(path, this._presenceData);
    };
    
    LorbNetworkService.prototype._updateChallengeStatus = function(challengeId, newStatus) {
        var ch = this._challengeCache[challengeId];
        if (!ch) return false;
        
        ch.status = newStatus;
        ch.updatedAt = this._now();
        
        return this._writeChallengeToBothBuckets(ch);
    };
    
    LorbNetworkService.prototype._writeChallengeToBothBuckets = function(ch) {
        if (!ch || !ch.from || !ch.to) return false;
        
        var fromPath = CHALLENGE_ROOT + "." + ch.from.globalId + "." + ch.id;
        var toPath = CHALLENGE_ROOT + "." + ch.to.globalId + "." + ch.id;
        
        this._fireAndForgetWrite(fromPath, ch);
        this._fireAndForgetWrite(toPath, ch);
        
        return true;
    };
    
    // =========================================================================
    // PRIVATE METHODS - HELPERS
    // =========================================================================
    
    LorbNetworkService.prototype._resolveGlobalId = function(ctx) {
        if (ctx._globalId) return ctx._globalId;
        
        var sysId = "local";
        if (typeof system !== "undefined") {
            sysId = system.qwk_id || system.name || "local";
        }
        
        var userId = "0";
        if (ctx._user && ctx._user.number) {
            userId = String(ctx._user.number);
        }
        
        return sysId.toLowerCase() + "_" + userId;
    };
    
    LorbNetworkService.prototype._buildPlayerRef = function(player) {
        var ctx = player._ctx || player;
        return {
            globalId: player.globalId || this._resolveGlobalId(ctx),
            name: player.name || ctx.name || ctx.displayName || "Unknown",
            level: player.level || ctx.level || 1,
            system: (typeof system !== "undefined") ? (system.qwk_id || system.name) : "unknown"
        };
    };
    
    LorbNetworkService.prototype._getOpponentId = function(ch) {
        if (ch.from && ch.from.globalId === this._globalId) {
            return ch.to ? ch.to.globalId : null;
        }
        return ch.from ? ch.from.globalId : null;
    };
    
    LorbNetworkService.prototype._isExpired = function(ch, now) {
        if (ch.expiresAt && now > ch.expiresAt) return true;
        if (ch.status === "declined" || ch.status === "cancelled" || ch.status === "completed") return true;
        return false;
    };
    
    LorbNetworkService.prototype._resolveServerConfig = function() {
        // Try LORB.Persist.getServerConfig first
        if (typeof LORB !== "undefined" && LORB.Persist && LORB.Persist.getServerConfig) {
            var cfg = LORB.Persist.getServerConfig();
            if (cfg) return cfg;
        }
        
        // Fallback to config
        if (this._config.JSON_CLIENT) {
            return this._config.JSON_CLIENT;
        }
        
        return { addr: "localhost", port: 10088 };
    };
    
    LorbNetworkService.prototype._now = function() {
        return Date.now ? Date.now() : (new Date()).getTime();
    };
    
    LorbNetworkService.prototype._log = function(msg) {
        if (typeof debugLog === "function") {
            debugLog("[LorbNetworkService] " + msg);
        }
    };
    
    LorbNetworkService.prototype._logError = function(msg) {
        if (typeof debugLog === "function") {
            debugLog("[LorbNetworkService][ERROR] " + msg);
        }
        // Also log to error.log
        if (typeof log === "function") {
            log(LOG_WARNING, "[LorbNetworkService] " + msg);
        }
    };
    
    // Export
    LORB.Services.NetworkService = LorbNetworkService;
    
})();
