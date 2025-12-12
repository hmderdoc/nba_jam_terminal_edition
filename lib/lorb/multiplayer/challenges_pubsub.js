/**
 * challenges_pubsub.js - Live challenge coordination via pub/sub pattern
 *
 * ARCHITECTURE:
 * - All writes use fire-and-forget mode (TIMEOUT=-1) to avoid blocking
 * - Writes include inline LOCK_WRITE so server does atomic lock→write→unlock
 * - The unlock triggers subscriber notifications automatically
 * - NO client-side lock() calls - all locking is server-side atomic operations
 * - Subscriptions receive updates via callback, processed by cycle()
 * 
 * PRESENCE ROLL CALL:
 * - On subscribe, we broadcast our presence immediately
 * - Other players see our presence via subscription callback
 * - Periodic heartbeat (every 15s) keeps presence fresh for late joiners
 * - Presence expires after 60s of no heartbeat
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
    var PRESENCE_TIMEOUT_MS = PresenceConfig.TIMEOUT_MS || 60000;             // 60s presence expiry
    var HEARTBEAT_INTERVAL_MS = 15000;  // Re-broadcast presence every 15 seconds
    
    // Lock constant for inline atomic writes (server does lock→write→unlock)
    var LOCK_WRITE = 2;
    
    // Check if subscriptions are enabled (default: false to avoid server blocking)
    function useSubscriptions() {
        return LORB.Config && LORB.Config.USE_SUBSCRIPTIONS === true;
    }
    
    // Local cache - updated via subscriptions
    var challengeCache = {};
    var presenceCache = {};
    var myGlobalId = null;
    var myPresenceData = null;  // Cached presence data for heartbeat re-broadcast
    var client = null;
    var subscribed = false;
    var lastCycleTime = 0;
    var lastHeartbeatTime = 0;
    
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
                activeTeammate = ctx.activeTeammate;
            } else if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getContact) {
                // Use hydrated contact lookup
                var contact = LORB.Util.Contacts.getContact(ctx, ctx.activeTeammate);
                if (contact && contact.status === "signed") {
                    activeTeammate = {
                        id: contact.id,
                        name: contact.name,
                        skin: contact.skin || "brown",
                        jersey: contact.jersey,
                        stats: contact.stats || null
                    };
                }
            }
        }
        
        return {
            globalId: gid,
            name: (ctx && (ctx.name || ctx.nickname || ctx.userHandle)) ||
                  (ctx && ctx._user && (ctx._user.alias || ctx._user.name)) || "Player",
            bbsName: (ctx && ctx._bbsName) || (typeof system !== "undefined" ? (system.name || null) : null),
            appearance: (ctx && ctx.appearance) ? ctx.appearance : null,
            activeTeammate: activeTeammate,
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
            appearance: player.appearance || null,
            activeTeammate: player.activeTeammate || null,
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
                        if (!data.lobby.ready) data.lobby.ready = {};
                        if (!data.lobby.lastPing) data.lobby.lastPing = {};
                        
                        for (var rid in existing.lobby.ready) {
                            if (existing.lobby.ready.hasOwnProperty(rid)) {
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
        
        if (client && client.connected) {
            return client;
        }
        
        try {
            load("json-client.js");
            var addr = SERVER_CFG.addr || "localhost";
            var port = SERVER_CFG.port || 10088;
            
            client = new JSONClient(addr, port);
            
            // Set up callback for subscription updates
            client.callback = handleUpdate;
            
            // CRITICAL: Fire-and-forget mode - NEVER wait for responses
            // All writes use inline LOCK_WRITE which server handles atomically
            client.settings.TIMEOUT = -1;
            
            logInfo("connected to " + addr + ":" + port + " (fire-and-forget mode)");
            subscribed = false;
            
        } catch (e) {
            logWarn("connection failed: " + e);
            client = null;
            return null;
        }
        
        return client;
    }
    
    /**
     * Subscribe to relevant paths for a player.
     * When USE_SUBSCRIPTIONS is false, this is a no-op to avoid server blocking.
     * In that case, we poll on-demand instead.
     */
    function subscribeForPlayer(ctx) {
        if (!client || !client.connected) return false;
        
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return false;
        
        myGlobalId = gid;
        
        // When subscriptions are disabled, just set myGlobalId and return
        // This avoids the json-db server blocking issue when sending to subscribers
        if (!useSubscriptions()) {
            logInfo("subscriptions DISABLED (USE_SUBSCRIPTIONS=false), using poll mode");
            subscribed = false;  // Mark as not subscribed so poll-on-demand works
            return true;
        }
        
        if (subscribed) return true;
        
        try {
            // Subscribe to our challenge bucket
            client.subscribe(DB_SCOPE, bucketPath(gid));
            logInfo("subscribed to " + bucketPath(gid));
            
            // Subscribe to presence updates
            client.subscribe(DB_SCOPE, PRESENCE_ROOT);
            logInfo("subscribed to " + PRESENCE_ROOT);
            
            subscribed = true;
            
            // Process any pending packets after subscribe
            processPackets();
            
            return true;
        } catch (e) {
            logWarn("subscribe failed: " + e);
            return false;
        }
    }
    
    /**
     * Process pending packets without blocking.
     * Calls client.cycle() up to 10 times to drain the incoming queue.
     */
    function processPackets() {
        if (!client || !client.connected) return;
        try {
            var count = 0;
            while (client.cycle() && count < 10) {
                count++;
            }
        } catch (e) {
            logWarn("processPackets error: " + e);
        }
    }
    
    // =========================================================
    // POLL-ON-DEMAND (used when subscriptions are disabled)
    // =========================================================
    
    var lastPollTime = 0;
    var POLL_COOLDOWN_MS = 2000;  // Don't poll more than once per 2 seconds
    
    /**
     * Poll for challenges and presence data directly.
     * Used when USE_SUBSCRIPTIONS is false.
     * This does blocking reads with a short timeout.
     */
    function pollOnDemand(ctx) {
        if (!client || !client.connected) return;
        if (useSubscriptions()) return;  // Don't poll if using subscriptions
        
        var now = nowMs();
        if (now - lastPollTime < POLL_COOLDOWN_MS) return;  // Rate limit
        lastPollTime = now;
        
        var gid = myGlobalId || getGlobalIdFromCtx(ctx);
        if (!gid) return;
        
        // Temporarily enable blocking reads with short timeout
        var oldTimeout = client.settings.TIMEOUT;
        client.settings.TIMEOUT = 500;  // 500ms max wait
        
        try {
            // Fetch our challenge bucket
            var challenges = client.read(DB_SCOPE, bucketPath(gid), 1);
            if (challenges && typeof challenges === "object") {
                for (var id in challenges) {
                    if (challenges.hasOwnProperty(id) && id !== "_lock" && id !== "_subscribers") {
                        var ch = challenges[id];
                        if (ch && ch.id) {
                            challengeCache[ch.id] = ch;
                        }
                    }
                }
                logInfo("polled challenges bucket, found " + Object.keys(challenges).length + " entries");
            }
            
            // Fetch presence data
            var presence = client.read(DB_SCOPE, PRESENCE_ROOT, 1);
            if (presence && typeof presence === "object") {
                for (var pid in presence) {
                    if (presence.hasOwnProperty(pid) && pid !== "_lock" && pid !== "_subscribers") {
                        var p = presence[pid];
                        if (p && p.timestamp) {
                            presenceCache[pid] = p;
                        }
                    }
                }
                logInfo("polled presence, found " + Object.keys(presence).length + " entries");
            }
        } catch (e) {
            logWarn("pollOnDemand failed: " + e);
        } finally {
            // Restore fire-and-forget mode
            client.settings.TIMEOUT = oldTimeout;
        }
    }
    
    /**
     * Poll for a specific challenge by ID.
     * Used in waiting loops when subscriptions are disabled.
     * No cooldown - can be called frequently.
     */
    function pollChallenge(challengeId, ctx) {
        if (!client || !client.connected) return null;
        if (useSubscriptions()) {
            // With subscriptions, just call cycle and return from cache
            cycle();
            return challengeCache[challengeId] || null;
        }
        
        var gid = myGlobalId || getGlobalIdFromCtx(ctx);
        if (!gid) return challengeCache[challengeId] || null;
        
        // Temporarily enable blocking reads with short timeout
        var oldTimeout = client.settings.TIMEOUT;
        client.settings.TIMEOUT = 500;  // 500ms max wait
        
        try {
            // Fetch our challenge bucket to see the challenge
            var challenges = client.read(DB_SCOPE, bucketPath(gid), 1);
            if (challenges && typeof challenges === "object") {
                for (var id in challenges) {
                    if (challenges.hasOwnProperty(id) && id !== "_lock" && id !== "_subscribers") {
                        var ch = challenges[id];
                        if (ch && ch.id) {
                            challengeCache[ch.id] = ch;
                        }
                    }
                }
            }
            
            // If the challenge involves another player, poll their bucket too
            var cached = challengeCache[challengeId];
            if (cached) {
                var otherGid = null;
                if (cached.from && cached.from.globalId && cached.from.globalId !== gid) {
                    otherGid = cached.from.globalId;
                } else if (cached.to && cached.to.globalId && cached.to.globalId !== gid) {
                    otherGid = cached.to.globalId;
                }
                
                if (otherGid) {
                    var otherChallenges = client.read(DB_SCOPE, bucketPath(otherGid), 1);
                    if (otherChallenges && typeof otherChallenges === "object") {
                        for (var oid in otherChallenges) {
                            if (otherChallenges.hasOwnProperty(oid) && oid !== "_lock" && oid !== "_subscribers") {
                                var och = otherChallenges[oid];
                                if (och && och.id) {
                                    // Merge: prefer the one with later updatedAt
                                    var existing = challengeCache[och.id];
                                    if (!existing || (och.updatedAt && (!existing.updatedAt || och.updatedAt > existing.updatedAt))) {
                                        challengeCache[och.id] = och;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            logWarn("pollChallenge failed: " + e);
        } finally {
            // Restore fire-and-forget mode
            client.settings.TIMEOUT = oldTimeout;
        }
        
        return challengeCache[challengeId] || null;
    }
    
    /**
     * Non-blocking check for incoming updates + heartbeat re-broadcast.
     * Call this periodically (e.g., in game loop or menu idle).
     */
    function cycle() {
        if (!client || !client.connected) return;
        
        var now = nowMs();
        if (now - lastCycleTime < CYCLE_INTERVAL_MS) return;
        lastCycleTime = now;
        
        // Process incoming packets (for subscription mode)
        processPackets();
        
        // Heartbeat: re-broadcast presence periodically so new subscribers see us
        // When subscriptions are disabled, also poll for updates at the same cadence
        if (myGlobalId && myPresenceData && (now - lastHeartbeatTime) >= HEARTBEAT_INTERVAL_MS) {
            lastHeartbeatTime = now;
            myPresenceData.timestamp = now;
            writePresence(myGlobalId, myPresenceData);
            
            // Poll for updates when subscriptions are disabled (piggyback on heartbeat)
            if (!useSubscriptions()) {
                // Temporarily bypass cooldown for this heartbeat-triggered poll
                lastPollTime = 0;
                pollOnDemand({ _user: { number: 0 } });  // ctx not needed, we have myGlobalId
            }
        }
    }
    
    /**
     * Fire-and-forget write with inline lock.
     * Server handles: LOCK → WRITE → UNLOCK atomically.
     * The UNLOCK triggers subscriber notifications.
     * 
     * This NEVER blocks because TIMEOUT=-1 (no wait for response).
     */
    function fireAndForgetWrite(path, data) {
        if (!client || !client.connected) return false;
        try {
            // Pass LOCK_WRITE as 4th param - server does atomic lock→write→unlock
            client.write(DB_SCOPE, path, data, LOCK_WRITE);
            return true;
        } catch (e) {
            logWarn("fireAndForgetWrite failed: " + e);
            return false;
        }
    }
    
    /**
     * Fire-and-forget remove with inline lock.
     */
    function fireAndForgetRemove(path) {
        if (!client || !client.connected) return false;
        try {
            client.remove(DB_SCOPE, path, LOCK_WRITE);
            return true;
        } catch (e) {
            logWarn("fireAndForgetRemove failed: " + e);
            return false;
        }
    }
    
    /**
     * Write challenge data - fire and forget.
     */
    function writeChallenge(ch) {
        if (!ch) return false;
        
        var start = nowMs();
        var success = true;
        
        // Write to sender's bucket
        if (ch.from && ch.from.globalId) {
            var fromPath = bucketPath(ch.from.globalId) + "." + ch.id;
            if (!fireAndForgetWrite(fromPath, ch)) success = false;
        }
        
        // Write to receiver's bucket (triggers their subscription callback)
        if (ch.to && ch.to.globalId) {
            var toPath = bucketPath(ch.to.globalId) + "." + ch.id;
            if (!fireAndForgetWrite(toPath, ch)) success = false;
        }
        
        // Update local cache immediately (optimistic)
        challengeCache[ch.id] = ch;
        
        logOp("writeChallenge", success ? "sent" : "partial", start, "id=" + ch.id);
        return success;
    }
    
    /**
     * Write presence data - fire and forget.
     * Always updates local cache first so we see ourselves immediately.
     */
    function writePresence(gid, data) {
        if (!gid) return false;
        
        // Always update local cache immediately
        if (data) {
            presenceCache[gid] = data;
        } else {
            delete presenceCache[gid];
        }
        
        if (!client || !client.connected) return false;
        
        var path = PRESENCE_ROOT + "." + gid;
        
        if (data) {
            return fireAndForgetWrite(path, data);
        } else {
            return fireAndForgetRemove(path);
        }
    }
    
    /**
     * Disconnect and cleanup - NEVER BLOCKS
     * 
     * IMPORTANT: We drain pending packets before closing to avoid corrupting
     * the socket state. We also unsubscribe explicitly before disconnect.
     */
    function disconnect() {
        // Stop heartbeat immediately
        myPresenceData = null;
        
        if (client && client.connected) {
            try {
                // Drain any pending incoming packets first
                // This prevents packet buildup that can corrupt socket state
                var drainCount = 0;
                while (client.cycle() && drainCount < 20) {
                    drainCount++;
                }
                
                // Unsubscribe from all paths we subscribed to
                // This tells the server to stop sending us updates
                if (myGlobalId) {
                    try { client.unsubscribe(DB_SCOPE, bucketPath(myGlobalId)); } catch (e) {}
                    try { client.unsubscribe(DB_SCOPE, PRESENCE_ROOT); } catch (e) {}
                }
                
                // Fire-and-forget presence removal
                if (myGlobalId) {
                    var path = PRESENCE_ROOT + "." + myGlobalId;
                    try { 
                        client.remove(DB_SCOPE, path, LOCK_WRITE);
                    } catch (e) {}
                }
                
                // Final drain of any response packets
                drainCount = 0;
                while (client.cycle() && drainCount < 10) {
                    drainCount++;
                }
                
                client.disconnect();
            } catch (e) {
                logWarn("disconnect error: " + e);
            }
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
            wager: wager
        };
        
        if (writeChallenge(challenge)) {
            logOp("create", "ok", ts, "id=" + id);
            
            // Also subscribe to target's bucket so we see their responses
            // (only when subscriptions are enabled)
            if (useSubscriptions()) {
                try {
                    client.subscribe(DB_SCOPE, bucketPath(toRef.globalId));
                } catch (e) {}
            }
            
            return challenge;
        }
        
        return null;
    }
    
    function listIncoming(ctx) {
        var c = ensureClient(ctx);
        if (!c) return [];
        subscribeForPlayer(ctx);
        
        // Poll on demand when subscriptions are disabled
        if (!useSubscriptions()) {
            pollOnDemand(ctx);
        } else {
            cycle();
        }
        
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
        
        // Poll on demand when subscriptions are disabled
        if (!useSubscriptions()) {
            pollOnDemand(ctx);
        } else {
            cycle();
        }
        
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
        // Use pollChallenge which handles both subscription and polling modes
        return pollChallenge(id, ctx);
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
        if (!ch || !ch.lobby || !ch.lobby.ready) {
            return false;
        }
        var otherId = (ch.from && ch.from.globalId === myGid) ? (ch.to && ch.to.globalId) : (ch.from && ch.from.globalId);
        if (!otherId) return false;
        if (!ch.lobby.ready[otherId]) return false;
        if (ch.lobby.lastPing && ch.lobby.lastPing[otherId]) {
            var age = nowMs() - ch.lobby.lastPing[otherId];
            if (age >= READY_STALE_MS) return false;
        }
        return true;
    }
    
    function clearForPlayer(ctx) {
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
        
        var teammate = null;
        if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getActiveTeammate) {
            teammate = LORB.Util.Contacts.getActiveTeammate(ctx);
        }
        
        // getActiveTeammate returns hydrated contact, no fallback needed
        
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
            activeTeammate: extractTeammateData(ctx)
        };
        
        logInfo("setPresence: gid=" + gid + ", name=" + data.name);
        
        // Store for heartbeat re-broadcast
        myPresenceData = data;
        lastHeartbeatTime = nowMs();
        
        return writePresence(gid, data);
    }
    
    function clearPresence(ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return false;
        myPresenceData = null;
        return writePresence(gid, null);
    }
    
    /**
     * Get online players from cache.
     * When subscriptions are disabled, polls on demand first.
     */
    function getOnlinePlayers(ctx) {
        // Poll on demand when subscriptions are disabled
        if (!useSubscriptions() && ctx) {
            pollOnDemand(ctx);
        }
        
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
    
    function isPlayerOnline(globalId, ctx) {
        // Poll on demand when subscriptions are disabled
        if (!useSubscriptions() && ctx) {
            pollOnDemand(ctx);
        } else {
            cycle();
        }
        
        var p = presenceCache[globalId];
        if (!p || !p.timestamp) return false;
        return (nowMs() - p.timestamp) < PRESENCE_TIMEOUT_MS;
    }
    
    // =========================================================
    // WAGER NEGOTIATION FUNCTIONS
    // =========================================================
    
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
        
        if (writeChallenge(ch)) {
            challengeCache[id] = ch;
            return ch;
        }
        return null;
    }
    
    function acceptWager(id, ctx) {
        var ch = getChallenge(id, ctx);
        if (!ch) return null;
        
        ch.status = "accepted";
        if (writeChallenge(ch)) {
            challengeCache[id] = ch;
            return ch;
        }
        return null;
    }
    
    function isMyTurnToRespond(ch, myGlobalId) {
        if (!ch || !ch.wager) return false;
        var myRole = (ch.from && ch.from.globalId === myGlobalId) ? "from" : "to";
        return ch.wager.proposedBy !== myRole;
    }
    
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
