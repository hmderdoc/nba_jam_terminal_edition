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
    
    // Load config values (with fallbacks for backwards compatibility)
    var ChallengeConfig = (LORB.Config && LORB.Config.CHALLENGES) || {};
    var PresenceConfig = (LORB.Config && LORB.Config.PRESENCE) || {};
    
    var SERVER_CFG = (LORB.Persist && LORB.Persist.getServerConfig) ? (LORB.Persist.getServerConfig() || {}) : {};
    var DB_SCOPE = SERVER_CFG.scope || "nba_jam";
    var ROOT = ChallengeConfig.ROOT_PATH || "rimcity.challenges";
    var PRESENCE_ROOT = ChallengeConfig.PRESENCE_PATH || "rimcity.presence";
    var DEFAULT_TTL_MS = ChallengeConfig.TTL_MS || (5 * 60 * 1000);           // 5 minutes
    var READY_STALE_MS = ChallengeConfig.READY_STALE_MS || (90 * 1000);       // 90s
    var CYCLE_INTERVAL_MS = ChallengeConfig.CYCLE_INTERVAL_MS || 250;         // How often to check for updates
    var INITIAL_FETCH_TIMEOUT_MS = ChallengeConfig.INITIAL_FETCH_TIMEOUT_MS || 2000;
    var CHALLENGE_WRITE_TIMEOUT_MS = ChallengeConfig.WRITE_TIMEOUT_MS || 500;
    var UPDATE_READ_TIMEOUT_MS = ChallengeConfig.UPDATE_READ_TIMEOUT_MS || 1000;
    var PRESENCE_TIMEOUT_MS = PresenceConfig.TIMEOUT_MS || 60000;
    
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
        
        // Extract active teammate info if available
        var activeTeammate = null;
        if (ctx && ctx.activeTeammate) {
            if (typeof ctx.activeTeammate === "object") {
                // Already an object with details
                activeTeammate = ctx.activeTeammate;
            } else if (ctx.contacts && Array.isArray(ctx.contacts)) {
                // It's an ID - look it up in contacts
                for (var i = 0; i < ctx.contacts.length; i++) {
                    var contact = ctx.contacts[i];
                    if (contact && contact.id === ctx.activeTeammate && contact.status === "signed") {
                        activeTeammate = {
                            id: contact.id,
                            name: contact.name,
                            skin: contact.skin || "brown",
                            jersey: contact.jersey,
                            stats: contact.stats || null
                        };
                        break;
                    }
                }
            }
        }
        
        return {
            globalId: gid,
            name: (ctx && (ctx.name || ctx.nickname || ctx.userHandle)) ||
                  (ctx && ctx._user && (ctx._user.alias || ctx._user.name)) || "Player",
            bbsName: (ctx && ctx._bbsName) || (typeof system !== "undefined" ? (system.name || null) : null),
            // Include appearance and teammate for sprite injection
            appearance: (ctx && ctx.appearance) ? ctx.appearance : null,
            activeTeammate: activeTeammate,
            // Include financial info for wager calculations
            cash: (ctx && ctx.cash) || 0,
            rep: (ctx && ctx.rep) || 0
        };
    }
    
    function buildPlayerRef(player) {
        if (!player) return { globalId: null };
        return {
            globalId: player.globalId || player._globalId || player.id || null,
            name: player.name || player.nickname || player.userHandle || "Player",
            bbsName: player.bbsName || player._bbsName || null,
            // Include appearance and teammate for sprite injection
            appearance: player.appearance || null,
            activeTeammate: player.activeTeammate || null,
            // Include financial info for wager calculations  
            cash: player.cash || 0,
            rep: player.rep || 0
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
                    // Single challenge update - MERGE lobby data to preserve both players' ready states
                    var existing = challengeCache[chId];
                    if (existing && existing.lobby && data.lobby) {
                        // Merge ready states from both local and remote
                        if (!data.lobby.ready) data.lobby.ready = {};
                        if (!data.lobby.lastPing) data.lobby.lastPing = {};
                        
                        for (var rid in existing.lobby.ready) {
                            if (existing.lobby.ready.hasOwnProperty(rid)) {
                                // Keep existing ready state if not in incoming data
                                // OR if incoming data's lastPing is older
                                var existingPing = (existing.lobby.lastPing && existing.lobby.lastPing[rid]) || 0;
                                var incomingPing = (data.lobby.lastPing && data.lobby.lastPing[rid]) || 0;
                                if (!data.lobby.ready.hasOwnProperty(rid) || incomingPing < existingPing) {
                                    data.lobby.ready[rid] = existing.lobby.ready[rid];
                                    data.lobby.lastPing[rid] = existingPing;
                                }
                            }
                        }
                    }
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
     * Uses a 2-second timeout to fail fast if JSON service is slow.
     */
    
    function fetchInitialData(gid) {
        if (!client || !client.connected) return;
        
        var start = nowMs();
        logInfo("fetching initial data...");
        
        // Temporarily enable blocking reads with short timeout
        var oldTimeout = client.settings.TIMEOUT;
        var oldSockTimeout = client.settings.SOCK_TIMEOUT;
        client.settings.TIMEOUT = INITIAL_FETCH_TIMEOUT_MS;
        client.settings.SOCK_TIMEOUT = INITIAL_FETCH_TIMEOUT_MS;
        
        try {
            // Fetch my challenge bucket (need lock for blocking read)
            var challengePath = bucketPath(gid);
            var challengeLocked = false;
            try {
                client.lock(DB_SCOPE, challengePath, LOCK_READ);
                challengeLocked = true;
                var bucket = client.read(DB_SCOPE, challengePath);
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
            } finally {
                if (challengeLocked) {
                    try { client.unlock(DB_SCOPE, challengePath); } catch (unlockErr) {
                        logWarn("challenge unlock failed: " + unlockErr);
                    }
                }
            }
            
            // Fetch all presence data
            var presenceLocked = false;
            try {
                client.lock(DB_SCOPE, PRESENCE_ROOT, LOCK_READ);
                presenceLocked = true;
                var presence = client.read(DB_SCOPE, PRESENCE_ROOT);
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
            } finally {
                if (presenceLocked) {
                    try { client.unlock(DB_SCOPE, PRESENCE_ROOT); } catch (unlockErr) {
                        logWarn("presence unlock failed: " + unlockErr);
                    }
                }
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
     * Write challenge with short-timeout lock to trigger subscription callbacks.
     * Uses LOCK_WRITE -> write -> unlock pattern so json-db sends data updates to subscribers.
     * Short timeout (500ms) ensures we don't block for long on contention.
     */
    
    function writeChallenge(ch) {
        if (!client || !client.connected || !ch) return false;
        
        var start = nowMs();
        
        // Save current timeout settings
        var oldTimeout = client.settings.TIMEOUT;
        var oldSockTimeout = client.settings.SOCK_TIMEOUT;
        
        try {
            // Use short timeout for challenge writes - fail fast if contention
            client.settings.TIMEOUT = CHALLENGE_WRITE_TIMEOUT_MS;
            client.settings.SOCK_TIMEOUT = CHALLENGE_WRITE_TIMEOUT_MS;
            
            // Write to sender's bucket (for their outgoing list)
            if (ch.from && ch.from.globalId) {
                var fromPath = bucketPath(ch.from.globalId) + "." + ch.id;
                var fromLocked = false;
                try {
                    client.lock(DB_SCOPE, fromPath, LOCK_WRITE);
                    fromLocked = true;
                    client.write(DB_SCOPE, fromPath, ch);
                } catch (e) {
                    logWarn("writeChallenge from-path error: " + e);
                } finally {
                    if (fromLocked) {
                        try { client.unlock(DB_SCOPE, fromPath); } catch (unlockErr) {
                            logWarn("writeChallenge from-path unlock failed: " + unlockErr);
                        }
                    }
                }
            }
            
            // Write to receiver's bucket (triggers their subscription callback)
            if (ch.to && ch.to.globalId) {
                var toPath = bucketPath(ch.to.globalId) + "." + ch.id;
                var toLocked = false;
                try {
                    client.lock(DB_SCOPE, toPath, LOCK_WRITE);
                    toLocked = true;
                    client.write(DB_SCOPE, toPath, ch);
                } catch (e) {
                    logWarn("writeChallenge to-path error: " + e);
                } finally {
                    if (toLocked) {
                        try { client.unlock(DB_SCOPE, toPath); } catch (unlockErr) {
                            logWarn("writeChallenge to-path unlock failed: " + unlockErr);
                        }
                    }
                }
            }
            
            // Update local cache immediately (optimistic)
            challengeCache[ch.id] = ch;
            
            logOp("writeChallenge", "sent", start, "id=" + ch.id);
            return true;
        } catch (e) {
            logWarn("writeChallenge error: " + e);
            return false;
        } finally {
            // Restore timeout settings
            client.settings.TIMEOUT = oldTimeout;
            client.settings.SOCK_TIMEOUT = oldSockTimeout;
        }
    }
    
    /**
     * Write presence with short-timeout lock to trigger subscription callbacks.
     * Uses LOCK_WRITE -> write -> unlock pattern so json-db sends data updates.
     * Short timeout (500ms) ensures we don't block for long on contention.
     */
    var PRESENCE_WRITE_TIMEOUT_MS = CHALLENGE_WRITE_TIMEOUT_MS;  // Use same timeout as challenges
    
    function writePresence(gid, data) {
        if (!client || !client.connected || !gid) return false;
        
        var path = PRESENCE_ROOT + "." + gid;
        
        // Save current timeout settings
        var oldTimeout = client.settings.TIMEOUT;
        var oldSockTimeout = client.settings.SOCK_TIMEOUT;
        
        var locked = false;
        try {
            // Use short timeout for presence writes - fail fast if contention
            client.settings.TIMEOUT = PRESENCE_WRITE_TIMEOUT_MS;
            client.settings.SOCK_TIMEOUT = PRESENCE_WRITE_TIMEOUT_MS;
            
            // Lock -> write -> unlock triggers send_data_updates() for subscribers
            client.lock(DB_SCOPE, path, LOCK_WRITE);
            locked = true;
            
            if (data) {
                client.write(DB_SCOPE, path, data);
                presenceCache[gid] = data;
            } else {
                client.remove(DB_SCOPE, path);
                delete presenceCache[gid];
            }
            
            // Unlock triggers the subscription notification
            client.unlock(DB_SCOPE, path);
            locked = false;
            
            return true;
        } catch (e) {
            logWarn("writePresence error: " + e);
            return false;
        } finally {
            // Ensure unlock if we still hold the lock
            if (locked) {
                try { client.unlock(DB_SCOPE, path); } catch (unlockErr) {
                    logWarn("writePresence unlock failed: " + unlockErr);
                }
            }
            // Restore timeout settings
            client.settings.TIMEOUT = oldTimeout;
            client.settings.SOCK_TIMEOUT = oldSockTimeout;
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
    
    function createChallenge(ctx, targetPlayer, meta, wagerOffer) {
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
        
        // Build wager object if offer provided
        var wager = null;
        if (wagerOffer && (wagerOffer.cash > 0 || wagerOffer.rep > 0)) {
            var absoluteMax = calculateAbsoluteMax(ctx, targetPlayer);
            wager = createWagerObject(wagerOffer, absoluteMax, "from");
            logInfo("createChallenge: wager created cash=" + wager.cash + " rep=" + wager.rep + 
                    " absoluteMax.cash=" + absoluteMax.cash + " absoluteMax.rep=" + absoluteMax.rep);
        }
        
        var challenge = {
            id: id,
            from: fromRef,
            to: toRef,
            status: "pending",
            createdAt: ts,
            updatedAt: ts,
            expiresAt: ts + DEFAULT_TTL_MS,
            lobby: { ready: {}, lastPing: {} },
            meta: meta || {},
            wager: wager  // null if no wager, object if wagering
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
        
        var cacheSize = Object.keys(challengeCache).length;
        if (cacheSize > 0) {
            logInfo("listIncoming: cache has " + cacheSize + " challenges, checking for gid=" + gid);
        }
        
        for (var id in challengeCache) {
            if (!challengeCache.hasOwnProperty(id)) continue;
            var ch = challengeCache[id];
            if (!ch || isExpired(ch, ts)) continue;
            if (ch.to && ch.to.globalId === gid && (ch.status === "pending" || ch.status === "accepted")) {
                incoming.push(ch);
                logInfo("listIncoming: found match id=" + id + " status=" + ch.status);
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
    
    /**
     * Read fresh challenge data from server (blocking but short timeout).
     * Used before critical updates like markReady to avoid overwriting other player's state.
     */
    
    function readChallengeFromServer(ctx, id) {
        var c = ensureClient(ctx);
        if (!c) return null;
        
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return null;
        
        var path = bucketPath(gid) + "." + id;
        var oldTimeout = client.settings.TIMEOUT;
        var oldSockTimeout = client.settings.SOCK_TIMEOUT;
        
        var locked = false;
        try {
            client.settings.TIMEOUT = UPDATE_READ_TIMEOUT_MS;
            client.settings.SOCK_TIMEOUT = UPDATE_READ_TIMEOUT_MS;
            
            client.lock(DB_SCOPE, path, LOCK_READ);
            locked = true;
            var ch = client.read(DB_SCOPE, path);
            client.unlock(DB_SCOPE, path);
            locked = false;
            
            if (ch && typeof ch === "object") {
                // Merge with local cache to preserve any local state
                var existing = challengeCache[id];
                if (existing && existing.lobby && ch.lobby) {
                    // Merge lobby.ready from both sources
                    if (!ch.lobby.ready) ch.lobby.ready = {};
                    if (!ch.lobby.lastPing) ch.lobby.lastPing = {};
                    for (var rid in existing.lobby.ready) {
                        if (existing.lobby.ready.hasOwnProperty(rid)) {
                            var existingPing = (existing.lobby.lastPing && existing.lobby.lastPing[rid]) || 0;
                            var serverPing = (ch.lobby.lastPing && ch.lobby.lastPing[rid]) || 0;
                            if (existingPing > serverPing) {
                                ch.lobby.ready[rid] = existing.lobby.ready[rid];
                                ch.lobby.lastPing[rid] = existingPing;
                            }
                        }
                    }
                }
                challengeCache[id] = ch;
                return ch;
            }
            return null;
        } catch (e) {
            logWarn("readChallengeFromServer failed: " + e);
            return challengeCache[id] || null;
        } finally {
            // Ensure unlock if we still hold the lock
            if (locked) {
                try { client.unlock(DB_SCOPE, path); } catch (unlockErr) {
                    logWarn("readChallengeFromServer unlock failed: " + unlockErr);
                }
            }
            client.settings.TIMEOUT = oldTimeout;
            client.settings.SOCK_TIMEOUT = oldSockTimeout;
        }
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
    
    /**
     * Update challenge with fresh server read first.
     * Use this for critical updates like markReady where we can't afford to lose other player's state.
     */
    function updateChallengeWithFreshRead(ctx, id, updater) {
        var c = ensureClient(ctx);
        if (!c) return null;
        
        // Read fresh data from server
        var ch = readChallengeFromServer(ctx, id);
        if (!ch) {
            ch = challengeCache[id];
        }
        if (!ch) return null;
        
        var updated = updater(ch) || ch;
        updated.updatedAt = nowMs();
        
        if (writeChallenge(updated)) {
            return updated;
        }
        return null;
    }
    
    function markAccepted(id, ctx) {
        // Use fresh read to avoid overwriting other player's lobby state
        return updateChallengeWithFreshRead(ctx, id, function(ch) {
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
        // Use fresh read to avoid overwriting other player's ready state
        return updateChallengeWithFreshRead(ctx, id, function(ch) {
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
        if (!ch || !ch.lobby || !ch.lobby.ready) {
            logInfo("isOtherReady: no lobby/ready data for " + (ch ? ch.id : "null"));
            return false;
        }
        var otherId = (ch.from && ch.from.globalId === myGid) ? (ch.to && ch.to.globalId) : (ch.from && ch.from.globalId);
        if (!otherId) {
            logInfo("isOtherReady: could not determine otherId, myGid=" + myGid);
            return false;
        }
        if (!ch.lobby.ready[otherId]) {
            logInfo("isOtherReady: otherId=" + otherId + " not ready yet, ready=" + JSON.stringify(ch.lobby.ready));
            return false;
        }
        if (ch.lobby.lastPing && ch.lobby.lastPing[otherId]) {
            var age = nowMs() - ch.lobby.lastPing[otherId];
            if (age >= READY_STALE_MS) {
                logInfo("isOtherReady: otherId=" + otherId + " ready but stale (age=" + age + "ms)");
                return false;
            }
        }
        logInfo("isOtherReady: otherId=" + otherId + " IS READY!");
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
    
    /**
     * Extract teammate data for presence/challenge serialization
     */
    function extractTeammateData(ctx) {
        if (!ctx) return null;
        
        // Try LORB.Util.Contacts.getActiveTeammate first
        var teammate = null;
        if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getActiveTeammate) {
            teammate = LORB.Util.Contacts.getActiveTeammate(ctx);
        }
        
        // Fallback: search contacts directly
        if (!teammate && ctx.contacts && ctx.activeTeammate) {
            for (var i = 0; i < ctx.contacts.length; i++) {
                var c = ctx.contacts[i];
                if (c && c.id === ctx.activeTeammate && c.status === "signed") {
                    teammate = c;
                    break;
                }
            }
        }
        
        if (!teammate) return null;
        
        return {
            id: teammate.id || null,
            name: teammate.name || "Teammate",
            skin: teammate.skin || "brown",
            jersey: teammate.jersey || 0,
            shortNick: teammate.shortNick || null,
            position: teammate.position || "",
            stats: teammate.stats || {},
            type: teammate.type || "contact",
            tier: teammate.tier || "rookie"
        };
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
        var appearance = ctx.appearance || {};
        var stats = ctx.stats || {};
        
        var data = {
            globalId: gid,
            timestamp: nowMs(),
            userName: u.alias || u.name || "Unknown",
            // Include appearance for sprite sync when challenging
            name: ctx.name || u.alias || u.name || "Player",
            nickname: ctx.nickname || null,
            appearance: {
                skin: appearance.skin || null,
                eyeColor: appearance.eyeColor || null,
                jerseyNumber: appearance.jerseyNumber || null,
                jerseyColor: appearance.jerseyColor || null,
                jerseyLettering: appearance.jerseyLettering || null,
                nametagFg: appearance.nametagFg || null,
                nametagBg: appearance.nametagBg || null,
                nametagHiFg: appearance.nametagHiFg || null,
                nametagHiBg: appearance.nametagHiBg || null
            },
            stats: stats,
            position: ctx.position || null,
            level: ctx.level || 1,
            archetype: ctx.archetype || null,
            cash: ctx.cash || 0,
            rep: ctx.rep || 0,
            // Include active teammate for multiplayer sprite sync
            activeTeammate: extractTeammateData(ctx)
        };
        
        logInfo("setPresence: gid=" + gid + ", name=" + data.name + 
            ", skin=" + (data.appearance.skin || "null") +
            ", activeTeammate=" + (data.activeTeammate ? data.activeTeammate.name : "null"));
        
        return writePresence(gid, data);
    }
    
    function clearPresence(ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return false;
        return writePresence(gid, null);
    }
    
    /**
     * Get online players from cache - FULLY NON-BLOCKING.
     * Cache is populated via subscription callbacks when presence is updated.
     * No locks, no blocking reads, no cycle calls - just return what we have in cache.
     */
    function getOnlinePlayers() {
        // DO NOT call cycle() here - that can trigger blocking operations
        // Just return cached data immediately
        
        var online = {};
        var now = nowMs();
        
        for (var id in presenceCache) {
            if (!presenceCache.hasOwnProperty(id)) continue;
            var p = presenceCache[id];
            if (p && p.timestamp && (now - p.timestamp) < PRESENCE_TIMEOUT_MS) {
                online[id] = p;
            }
        }
        return online;
    }
    
    function isPlayerOnline(globalId) {
        cycle();
        var p = presenceCache[globalId];
        if (!p || !p.timestamp) return false;
        return (nowMs() - p.timestamp) < PRESENCE_TIMEOUT_MS;
    }
    
    // =========================================================
    // WAGER NEGOTIATION FUNCTIONS
    // =========================================================
    
    /**
     * Calculate the absolute maximum wager both players can afford
     */
    function calculateAbsoluteMax(fromCtx, toPlayer) {
        var fromCash = fromCtx.cash || 0;
        var fromRep = fromCtx.rep || 0;
        var toCash = toPlayer.cash || 0;
        var toRep = toPlayer.rep || 0;
        
        return {
            cash: Math.min(fromCash, toCash),
            rep: Math.min(fromRep, toRep)
        };
    }
    
    /**
     * Create a wager object from an initial offer
     */
    function createWagerObject(initialOffer, absoluteMax, proposedBy) {
        var cash = Math.min(initialOffer.cash || 0, absoluteMax.cash);
        var rep = Math.min(initialOffer.rep || 0, absoluteMax.rep);
        
        return {
            cash: cash,
            rep: rep,
            absoluteMax: absoluteMax,
            ceiling: {
                cash: cash,
                rep: rep,
                locked: false
            },
            proposedBy: proposedBy || "from",
            revision: 1,
            history: [{ cash: cash, rep: rep, by: proposedBy || "from", at: nowMs() }]
        };
    }
    
    /**
     * Apply a counter-offer to the wager
     */
    function applyCounterOffer(wager, offer, by) {
        if (!wager) return null;
        
        var newCash = Math.min(offer.cash || 0, wager.absoluteMax.cash);
        var newRep = Math.min(offer.rep || 0, wager.absoluteMax.rep);
        
        if (wager.ceiling.locked) {
            newCash = Math.min(newCash, wager.ceiling.cash);
            newRep = Math.min(newRep, wager.ceiling.rep);
        } else {
            wager.ceiling.cash = Math.max(wager.ceiling.cash, newCash);
            wager.ceiling.rep = Math.max(wager.ceiling.rep, newRep);
            wager.ceiling.locked = true;
        }
        
        wager.cash = newCash;
        wager.rep = newRep;
        wager.proposedBy = by;
        wager.revision = (wager.revision || 1) + 1;
        wager.history = wager.history || [];
        wager.history.push({ cash: newCash, rep: newRep, by: by, at: nowMs() });
        
        return wager;
    }
    
    /**
     * Submit a counter-offer to a challenge
     */
    function submitCounterOffer(id, ctx, offer) {
        var ch = getChallenge(id, ctx);
        if (!ch) return null;
        
        var gid = getGlobalIdFromCtx(ctx);
        var myRole = (ch.from && ch.from.globalId === gid) ? "from" : "to";
        
        if (!ch.wager) {
            var absoluteMax = calculateAbsoluteMax(ctx, myRole === "from" ? ch.to : ch.from);
            ch.wager = createWagerObject(offer, absoluteMax, myRole);
        } else {
            applyCounterOffer(ch.wager, offer, myRole);
        }
        
        ch.status = "negotiating";
        
        // Write updated challenge
        if (writeChallenge(ch)) {
            challengeCache[id] = ch;
            return ch;
        }
        return null;
    }
    
    /**
     * Accept the current wager offer
     */
    function acceptWager(id, ctx) {
        // Use fresh read to get latest state including any lobby data
        var ch = readChallengeFromServer(ctx, id);
        if (!ch) ch = getChallenge(id, ctx);
        if (!ch) return null;
        
        ch.status = "accepted";
        if (writeChallenge(ch)) {
            challengeCache[id] = ch;
            return ch;
        }
        return null;
    }
    
    /**
     * Check if it's my turn to respond to a wager
     */
    function isMyTurnToRespond(ch, myGlobalId) {
        if (!ch || !ch.wager) return false;
        var myRole = (ch.from && ch.from.globalId === myGlobalId) ? "from" : "to";
        return ch.wager.proposedBy !== myRole;
    }
    
    /**
     * Get formatted wager details from a challenge
     */
    function getWagerDetails(ch) {
        if (!ch || !ch.wager) return null;
        return {
            cash: ch.wager.cash,
            rep: ch.wager.rep,
            ceiling: ch.wager.ceiling,
            absoluteMax: ch.wager.absoluteMax,
            proposedBy: ch.wager.proposedBy,
            revision: ch.wager.revision,
            ceilingLocked: ch.wager.ceiling && ch.wager.ceiling.locked,
            history: ch.wager.history || []
        };
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
        // Presence
        setPresence: setPresence,
        clearPresence: clearPresence,
        getOnlinePlayers: getOnlinePlayers,
        isPlayerOnline: isPlayerOnline,
        // Wager negotiation
        calculateAbsoluteMax: calculateAbsoluteMax,
        createWagerObject: createWagerObject,
        applyCounterOffer: applyCounterOffer,
        submitCounterOffer: submitCounterOffer,
        acceptWager: acceptWager,
        isMyTurnToRespond: isMyTurnToRespond,
        getWagerDetails: getWagerDetails
    };
})();
