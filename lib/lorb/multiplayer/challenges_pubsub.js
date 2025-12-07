/**
 * challenges_pubsub.js - Live challenge coordination via pub/sub pattern
 *
 * This replaces the lock-based approach with a subscribe/publish pattern:
 * - Subscribe to challenge paths on connect
 * - Fire-and-forget writes (no waiting for response)
 * - Local cache updated via subscription callbacks
 * - Non-blocking cycle() calls to process incoming updates
 * 
 * NO LOCKS ARE USED - this avoids blocking other BBS users.
 */
(function () {
    if (!this.LORB) return;
    if (!this.LORB.Multiplayer) this.LORB.Multiplayer = {};
    
    var SERVER_CFG = (LORB.Persist && LORB.Persist.getServerConfig) ? (LORB.Persist.getServerConfig() || {}) : {};
    var DB_SCOPE = SERVER_CFG.scope || "nba_jam";
    var ROOT = "rimcity.challenges";
    var PRESENCE_ROOT = "rimcity.presence";
    var DEFAULT_TTL_MS = 5 * 60 * 1000;    // 5 minutes
    var READY_STALE_MS = 90 * 1000;        // 90s
    var CYCLE_INTERVAL_MS = 250;           // How often to check for updates
    
    // Lock constants from JSONClient
    var LOCK_READ = 1;
    var LOCK_WRITE = 2;
    var LOCK_UNLOCK = -1;
    
    // Local cache - updated via subscriptions
    var challengeCache = {};
    var presenceCache = {};
    var myGlobalId = null;
    var client = null;
    var subscribed = false;
    var lastCycleTime = 0;
    
    function nowMs() {
        return Date.now ? Date.now() : (time() * 1000);
    }
    
    function logWarn(msg) { if (typeof debugLog === "function") debugLog("[LORB:Challenges:PubSub][WARN] " + msg); }
    function logInfo(msg) { if (typeof debugLog === "function") debugLog("[LORB:Challenges:PubSub] " + msg); }
    function logOp(op, status, startTs, extra) {
        if (typeof debugLog !== "function") return;
        var elapsed = startTs ? (nowMs() - startTs) : 0;
        var msg = "[LORB:Challenges:PubSub] op=" + op + " status=" + status + " ms=" + elapsed;
        if (extra) msg += " " + extra;
        debugLog(msg);
    }
    
    function bucketPath(gid) { return ROOT + "." + gid; }
    
    function getGlobalIdFromCtx(ctx) {
        if (!ctx || !ctx._user || !LORB.Persist || !LORB.Persist.getGlobalPlayerId) return null;
        return LORB.Persist.getGlobalPlayerId(ctx._user);
    }
    
    function buildPlayerRefFromCtx(ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        return {
            globalId: gid,
            name: (ctx && (ctx.name || ctx.nickname || ctx.userHandle)) ||
                  (ctx && ctx._user && (ctx._user.alias || ctx._user.name)) || "Player",
            bbsName: (ctx && ctx._bbsName) || (typeof system !== "undefined" ? (system.name || null) : null)
        };
    }
    
    function buildPlayerRef(player) {
        if (!player) return { globalId: null };
        return {
            globalId: player.globalId || player._globalId || player.id || null,
            name: player.name || player.nickname || player.userHandle || "Player",
            bbsName: player.bbsName || player._bbsName || null
        };
    }
    
    function isExpired(ch, ts) {
        if (!ch) return true;
        var now = ts || nowMs();
        return ch.expiresAt && now > ch.expiresAt;
    }
    
    /**
     * Handle incoming subscription updates from JSON service
     */
    function handleUpdate(packet) {
        if (!packet) return;
        
        try {
            // packet.oper tells us what happened: WRITE, DELETE, etc.
            // packet.location is the path that changed
            // packet.data is the new value
            var loc = packet.location || "";
            var data = packet.data;
            var oper = packet.oper;
            
            logInfo("update: oper=" + oper + " loc=" + loc);
            
            // Challenge update
            if (loc.indexOf(ROOT + ".") === 0) {
                var parts = loc.substring(ROOT.length + 1).split(".");
                var gid = parts[0];
                var chId = parts[1];
                
                if (oper === "DELETE" || data === null || data === undefined) {
                    if (chId && challengeCache[chId]) {
                        delete challengeCache[chId];
                        logInfo("cache: removed challenge " + chId);
                    }
                } else if (chId && data && typeof data === "object") {
                    // Single challenge update
                    challengeCache[chId] = data;
                    logInfo("cache: updated challenge " + chId);
                } else if (!chId && data && typeof data === "object") {
                    // Bucket update - merge all challenges
                    for (var id in data) {
                        if (data.hasOwnProperty(id) && data[id]) {
                            challengeCache[id] = data[id];
                        }
                    }
                    logInfo("cache: merged bucket for " + gid + " count=" + Object.keys(data).length);
                }
            }
            
            // Presence update
            if (loc.indexOf(PRESENCE_ROOT + ".") === 0) {
                var playerId = loc.substring(PRESENCE_ROOT.length + 1);
                if (oper === "DELETE" || data === null || data === undefined) {
                    if (presenceCache[playerId]) {
                        delete presenceCache[playerId];
                        logInfo("presence: removed " + playerId);
                    }
                } else if (data && typeof data === "object") {
                    presenceCache[playerId] = data;
                    logInfo("presence: updated " + playerId);
                }
            }
        } catch (e) {
            logWarn("handleUpdate error: " + e);
        }
    }
    
    /**
     * Ensure client is connected and subscribed
     */
    function ensureClient(ctx) {
        if (typeof LORB !== "undefined" && LORB.Config && LORB.Config.ENABLE_LIVE_CHALLENGES === false) {
            return null;
        }
        
        // Already connected?
        if (client && client.connected) {
            // Process any pending updates
            cycle();
            return client;
        }
        
        // Need to connect
        try {
            load("json-client.js");
            var addr = SERVER_CFG.addr || "localhost";
            var port = SERVER_CFG.port || 10088;
            
            client = new JSONClient(addr, port);
            
            // Set up callback for subscription updates
            client.callback = handleUpdate;
            
            // Fire-and-forget mode - don't wait for responses on writes
            client.settings.TIMEOUT = -1;
            
            logInfo("connected to " + addr + ":" + port);
            subscribed = false;
            
        } catch (e) {
            logWarn("connection failed: " + e);
            client = null;
            return null;
        }
        
        return client;
    }
    
    /**
     * Do initial data fetch (blocking but only once on first connect)
     * This populates the cache with existing data before subscriptions kick in.
     */
    function fetchInitialData(gid) {
        if (!client || !client.connected) return;
        
        var start = nowMs();
        logInfo("fetching initial data...");
        
        // Temporarily enable blocking reads
        var oldTimeout = client.settings.TIMEOUT;
        var oldSockTimeout = client.settings.SOCK_TIMEOUT;
        client.settings.TIMEOUT = 5000;  // 5 second timeout for initial load
        client.settings.SOCK_TIMEOUT = 5000;
        
        try {
            // Fetch my challenge bucket (need lock for blocking read)
            var challengePath = bucketPath(gid);
            try {
                client.lock(DB_SCOPE, challengePath, LOCK_READ);
                var bucket = client.read(DB_SCOPE, challengePath);
                client.unlock(DB_SCOPE, challengePath);
                if (bucket && typeof bucket === "object") {
                    for (var id in bucket) {
                        if (bucket.hasOwnProperty(id) && bucket[id]) {
                            challengeCache[id] = bucket[id];
                        }
                    }
                    logInfo("initial challenges: " + Object.keys(bucket).length);
                }
            } catch (e) {
                logWarn("initial challenge fetch failed: " + e);
                try { client.unlock(DB_SCOPE, challengePath); } catch (e2) {}
            }
            
            // Fetch all presence data
            try {
                client.lock(DB_SCOPE, PRESENCE_ROOT, LOCK_READ);
                var presence = client.read(DB_SCOPE, PRESENCE_ROOT);
                client.unlock(DB_SCOPE, PRESENCE_ROOT);
                if (presence && typeof presence === "object") {
                    for (var pid in presence) {
                        if (presence.hasOwnProperty(pid) && presence[pid]) {
                            presenceCache[pid] = presence[pid];
                        }
                    }
                    logInfo("initial presence: " + Object.keys(presence).length);
                }
            } catch (e) {
                logWarn("initial presence fetch failed: " + e);
                try { client.unlock(DB_SCOPE, PRESENCE_ROOT); } catch (e2) {}
            }
            
            logOp("fetchInitialData", "ok", start, "challenges=" + Object.keys(challengeCache).length + " presence=" + Object.keys(presenceCache).length);
        } finally {
            // Restore fire-and-forget mode
            client.settings.TIMEOUT = oldTimeout;
            client.settings.SOCK_TIMEOUT = oldSockTimeout;
        }
    }
    
    /**
     * Subscribe to relevant paths for a player
     */
    function subscribeForPlayer(ctx) {
        if (!client || !client.connected) return false;
        if (subscribed) return true;
        
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return false;
        
        myGlobalId = gid;
        
        try {
            // Subscribe FIRST so we catch any writes that happen during initial fetch
            client.subscribe(DB_SCOPE, bucketPath(gid));
            logInfo("subscribed to " + bucketPath(gid));
            
            // Subscribe to presence updates
            client.subscribe(DB_SCOPE, PRESENCE_ROOT);
            logInfo("subscribed to " + PRESENCE_ROOT);
            
            subscribed = true;
            
            // NOW fetch initial data - we're already subscribed so we won't miss updates
            fetchInitialData(gid);
            
            // Process any subscription updates that may have arrived during fetch
            cycle();
            
            return true;
        } catch (e) {
            logWarn("subscribe failed: " + e);
            return false;
        }
    }
    
    /**
     * Non-blocking check for incoming updates
     * Call this periodically (e.g., in game loop or menu idle)
     */
    function cycle() {
        if (!client || !client.connected) return;
        
        var now = nowMs();
        if (now - lastCycleTime < CYCLE_INTERVAL_MS) return;
        lastCycleTime = now;
        
        try {
            // Process any pending packets (calls our callback)
            var count = 0;
            while (client.cycle() && count < 10) {
                count++;
            }
        } catch (e) {
            // Connection may have dropped
            logWarn("cycle error: " + e);
        }
    }
    
    /**
     * Fire-and-forget write - no blocking, no locks
     */
    function writeChallenge(ch) {
        if (!client || !client.connected || !ch) return false;
        
        var start = nowMs();
        try {
            // Write to both player buckets
            if (ch.from && ch.from.globalId) {
                var fromPath = bucketPath(ch.from.globalId) + "." + ch.id;
                client.write(DB_SCOPE, fromPath, ch);
            }
            if (ch.to && ch.to.globalId) {
                var toPath = bucketPath(ch.to.globalId) + "." + ch.id;
                client.write(DB_SCOPE, toPath, ch);
            }
            
            // Update local cache immediately (optimistic)
            challengeCache[ch.id] = ch;
            
            logOp("writeChallenge", "sent", start, "id=" + ch.id);
            return true;
        } catch (e) {
            logWarn("writeChallenge error: " + e);
            return false;
        }
    }
    
    /**
     * Fire-and-forget presence update
     */
    function writePresence(gid, data) {
        if (!client || !client.connected || !gid) return false;
        
        try {
            var path = PRESENCE_ROOT + "." + gid;
            if (data) {
                client.write(DB_SCOPE, path, data);
                presenceCache[gid] = data;
            } else {
                client.remove(DB_SCOPE, path);
                delete presenceCache[gid];
            }
            return true;
        } catch (e) {
            logWarn("writePresence error: " + e);
            return false;
        }
    }
    
    /**
     * Disconnect and cleanup
     */
    function disconnect() {
        if (client) {
            try {
                // Clear our presence before disconnecting
                if (myGlobalId) {
                    writePresence(myGlobalId, null);
                }
                client.disconnect();
            } catch (e) {}
            client = null;
        }
        subscribed = false;
        myGlobalId = null;
    }
    
    // =========================================================
    // PUBLIC API - Compatible with old challenges.js interface
    // =========================================================
    
    function createChallenge(ctx, targetPlayer, meta) {
        var c = ensureClient(ctx);
        if (!c) return null;
        subscribeForPlayer(ctx);
        
        var fromRef = buildPlayerRefFromCtx(ctx);
        var toRef = buildPlayerRef(targetPlayer);
        if (!fromRef.globalId || !toRef.globalId) {
            logWarn("missing globalId for challenge");
            return null;
        }
        
        var ts = nowMs();
        var id = "ch_" + fromRef.globalId + "_" + toRef.globalId + "_" + ts + "_" + Math.floor(Math.random() * 1000);
        
        var challenge = {
            id: id,
            from: fromRef,
            to: toRef,
            status: "pending",
            createdAt: ts,
            updatedAt: ts,
            expiresAt: ts + DEFAULT_TTL_MS,
            lobby: { ready: {}, lastPing: {} },
            meta: meta || {}
        };
        
        if (writeChallenge(challenge)) {
            logOp("create", "ok", ts, "id=" + id);
            
            // Also subscribe to target's bucket so we see their responses
            try {
                client.subscribe(DB_SCOPE, bucketPath(toRef.globalId));
            } catch (e) {}
            
            return challenge;
        }
        
        return null;
    }
    
    function listIncoming(ctx) {
        var c = ensureClient(ctx);
        if (!c) return [];
        subscribeForPlayer(ctx);
        cycle(); // Process any pending updates
        
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return [];
        
        var ts = nowMs();
        var incoming = [];
        
        for (var id in challengeCache) {
            if (!challengeCache.hasOwnProperty(id)) continue;
            var ch = challengeCache[id];
            if (!ch || isExpired(ch, ts)) continue;
            if (ch.to && ch.to.globalId === gid && (ch.status === "pending" || ch.status === "accepted")) {
                incoming.push(ch);
            }
        }
        
        incoming.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
        return incoming;
    }
    
    function listOutgoing(ctx) {
        var c = ensureClient(ctx);
        if (!c) return [];
        subscribeForPlayer(ctx);
        cycle();
        
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return [];
        
        var ts = nowMs();
        var outgoing = [];
        
        for (var id in challengeCache) {
            if (!challengeCache.hasOwnProperty(id)) continue;
            var ch = challengeCache[id];
            if (!ch || isExpired(ch, ts)) continue;
            if (ch.from && ch.from.globalId === gid && (ch.status === "pending" || ch.status === "accepted")) {
                outgoing.push(ch);
            }
        }
        
        outgoing.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
        return outgoing;
    }
    
    function getChallenge(id, ctx) {
        cycle();
        return challengeCache[id] || null;
    }
    
    function updateChallenge(ctx, id, updater) {
        var c = ensureClient(ctx);
        if (!c) return null;
        
        var ch = challengeCache[id];
        if (!ch) return null;
        
        var updated = updater(ch) || ch;
        updated.updatedAt = nowMs();
        
        if (writeChallenge(updated)) {
            return updated;
        }
        return null;
    }
    
    function markAccepted(id, ctx) {
        return updateChallenge(ctx, id, function(ch) {
            ch.status = "accepted";
            var gid = getGlobalIdFromCtx(ctx);
            if (gid) {
                if (!ch.lobby) ch.lobby = { ready: {}, lastPing: {} };
                ch.lobby.ready[gid] = true;
                ch.lobby.lastPing[gid] = nowMs();
            }
            logInfo("lifecycle: accepted id=" + id);
            return ch;
        });
    }
    
    function markDeclined(id, ctx) {
        return updateChallenge(ctx, id, function(ch) {
            ch.status = "declined";
            logInfo("lifecycle: declined id=" + id);
            return ch;
        });
    }
    
    function markCancelled(id, ctx) {
        return updateChallenge(ctx, id, function(ch) {
            ch.status = "cancelled";
            logInfo("lifecycle: cancelled id=" + id);
            return ch;
        });
    }
    
    function markReady(id, ctx, ready) {
        return updateChallenge(ctx, id, function(ch) {
            if (!ch.lobby) ch.lobby = { ready: {}, lastPing: {} };
            var gid = getGlobalIdFromCtx(ctx);
            if (gid) {
                ch.lobby.ready[gid] = !!ready;
                ch.lobby.lastPing[gid] = nowMs();
            }
            logInfo("lifecycle: ready=" + ready + " id=" + id);
            return ch;
        });
    }
    
    function isOtherReady(ch, myGid) {
        if (!ch || !ch.lobby || !ch.lobby.ready) return false;
        var otherId = (ch.from && ch.from.globalId === myGid) ? (ch.to && ch.to.globalId) : (ch.from && ch.from.globalId);
        if (!otherId) return false;
        if (!ch.lobby.ready[otherId]) return false;
        if (ch.lobby.lastPing && ch.lobby.lastPing[otherId]) {
            return (nowMs() - ch.lobby.lastPing[otherId]) < READY_STALE_MS;
        }
        return true;
    }
    
    function clearForPlayer(ctx) {
        // Best-effort cleanup - just clear local cache
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return 0;
        
        var count = 0;
        for (var id in challengeCache) {
            var ch = challengeCache[id];
            if (ch && ((ch.from && ch.from.globalId === gid) || (ch.to && ch.to.globalId === gid))) {
                delete challengeCache[id];
                count++;
            }
        }
        return count;
    }
    
    // Presence functions
    function setPresence(ctx) {
        var c = ensureClient(ctx);
        if (!c) return false;
        
        // Subscribe and fetch initial data on first presence set
        subscribeForPlayer(ctx);
        
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return false;
        
        var u = ctx._user || ctx;
        return writePresence(gid, {
            globalId: gid,
            timestamp: nowMs(),
            userName: u.alias || u.name || "Unknown"
        });
    }
    
    function clearPresence(ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return false;
        return writePresence(gid, null);
    }
    
    var lastPresenceRefresh = 0;
    var PRESENCE_REFRESH_COOLDOWN = 30000;  // Only refresh every 30 seconds max
    
    function getOnlinePlayers() {
        cycle();
        
        // If cache is empty or only has ourselves, try a fresh read (with cooldown)
        var now = nowMs();
        var cacheCount = 0;
        for (var k in presenceCache) {
            if (presenceCache.hasOwnProperty(k)) cacheCount++;
        }
        
        if (cacheCount <= 1 && client && client.connected && (now - lastPresenceRefresh) > PRESENCE_REFRESH_COOLDOWN) {
            lastPresenceRefresh = now;
            // Quick blocking read to refresh presence data
            try {
                var oldTimeout = client.settings.TIMEOUT;
                var oldSockTimeout = client.settings.SOCK_TIMEOUT;
                client.settings.TIMEOUT = 2000;  // 2 second timeout
                client.settings.SOCK_TIMEOUT = 2000;
                
                client.lock(DB_SCOPE, PRESENCE_ROOT, LOCK_READ);
                var presence = client.read(DB_SCOPE, PRESENCE_ROOT);
                client.unlock(DB_SCOPE, PRESENCE_ROOT);
                
                client.settings.TIMEOUT = oldTimeout;
                client.settings.SOCK_TIMEOUT = oldSockTimeout;
                
                if (presence && typeof presence === "object") {
                    for (var pid in presence) {
                        if (presence.hasOwnProperty(pid) && presence[pid]) {
                            presenceCache[pid] = presence[pid];
                        }
                    }
                    logInfo("refreshed presence cache: " + Object.keys(presence).length + " entries");
                }
            } catch (e) {
                try { client.unlock(DB_SCOPE, PRESENCE_ROOT); } catch (e2) {}
                client.settings.TIMEOUT = -1;
                client.settings.SOCK_TIMEOUT = -1;
            }
        }
        
        var online = {};
        var timeout = (LORB.Persist && LORB.Persist.PRESENCE_TIMEOUT_MS) || 60000;
        
        for (var id in presenceCache) {
            if (!presenceCache.hasOwnProperty(id)) continue;
            var p = presenceCache[id];
            if (p && p.timestamp && (now - p.timestamp) < timeout) {
                online[id] = p;
            }
        }
        return online;
    }
    
    function isPlayerOnline(globalId) {
        cycle();
        var p = presenceCache[globalId];
        if (!p || !p.timestamp) return false;
        var timeout = (LORB.Persist && LORB.Persist.PRESENCE_TIMEOUT_MS) || 60000;
        return (nowMs() - p.timestamp) < timeout;
    }
    
    // Export
    this.LORB.Multiplayer.Challenges = {
        createChallenge: createChallenge,
        listIncoming: listIncoming,
        listOutgoing: listOutgoing,
        getIncomingChallenges: listIncoming,
        getSentChallenges: listOutgoing,
        markAccepted: markAccepted,
        markDeclined: markDeclined,
        markCancelled: markCancelled,
        markReady: markReady,
        isOtherReady: isOtherReady,
        clearForPlayer: clearForPlayer,
        getChallenge: getChallenge,
        acceptChallenge: markAccepted,
        declineChallenge: markDeclined,
        cancelChallenge: markCancelled,
        sendChallenge: createChallenge,
        disconnect: disconnect,
        cycle: cycle,
        // Presence (can also stay in persist.js, but offered here too)
        setPresence: setPresence,
        clearPresence: clearPresence,
        getOnlinePlayers: getOnlinePlayers,
        isPlayerOnline: isPlayerOnline
    };
})();
