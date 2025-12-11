/**
 * challenges.js - Live challenge coordination (ephemeral) via JSONClient
 *
 * Challenge records live under: <prefix>.challenges.<globalId>.<challengeId> on the
 * JSON service. No JSONdb/disk writes for these ephemeral records.
 * Real-time lobby sync elsewhere also uses JSONClient.
 */
(function () {
    if (!this.LORB) return;
    if (!this.LORB.Multiplayer) this.LORB.Multiplayer = {};
    
    var SERVER_CFG = (LORB.Persist && LORB.Persist.getServerConfig) ? (LORB.Persist.getServerConfig() || {}) : {};
    var DB_SCOPE = SERVER_CFG.scope || "nba_jam";
    // Use a prefix that won't conflict with scope names to avoid JSON service quirks
    var ROOT = "rimcity.challenges";
    var DEFAULT_TTL_MS = 5 * 60 * 1000;    // 5 minutes
    var READY_STALE_MS = 90 * 1000;        // 90s
    var STALE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
    var CONNECT_BACKOFF_MS = 10000;
    var LOCK_READ_CONST = (typeof LOCK_READ !== "undefined") ? LOCK_READ : 1;
    var LOCK_WRITE_CONST = (typeof LOCK_WRITE !== "undefined") ? LOCK_WRITE : 2;
    
    var challengeCache = {};
    
    function nowMs() {
        return Date.now ? Date.now() : (time() * 1000);
    }
    
    function logWarn(msg) { if (typeof debugLog === "function") debugLog("[LORB:Challenges][WARN] " + msg); }
    function logInfo(msg) { if (typeof debugLog === "function") debugLog("[LORB:Challenges] " + msg); }
    function logOp(op, status, startTs, extra) {
        if (typeof debugLog !== "function") return;
        var elapsed = startTs ? (nowMs() - startTs) : 0;
        var msg = "[LORB:Challenges] op=" + op + " status=" + status + " ms=" + elapsed;
        if (extra) msg += " " + extra;
        debugLog(msg);
    }
    
    function bucketPath(gid) { return ROOT + "." + gid; }
    function bucketChallengePath(gid, id) { return bucketPath(gid) + "." + id; }
    
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
            bbsName: player.bbsName || player._bbsName || null,
            // Include financial info for wager calculations
            cash: player.cash || 0,
            rep: player.rep || 0
        };
    }
    
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
     * Create initial wager object for a challenge
     * @param {Object} initialOffer - { cash, rep } challenger's max offer
     * @param {Object} absoluteMax - { cash, rep } from calculateAbsoluteMax
     */
    function createWagerObject(initialOffer, absoluteMax) {
        var offer = initialOffer || { cash: 0, rep: 0 };
        var absMax = absoluteMax || { cash: 0, rep: 0 };
        
        // Cap initial offer at absolute max
        var cappedCash = Math.min(offer.cash || 0, absMax.cash);
        var cappedRep = Math.min(offer.rep || 0, absMax.rep);
        
        return {
            cash: cappedCash,
            rep: cappedRep,
            absoluteMax: {
                cash: absMax.cash,
                rep: absMax.rep
            },
            ceiling: {
                cash: cappedCash,
                rep: cappedRep,
                locked: false  // Becomes true after challengee's first counter
            },
            proposedBy: "from",
            revision: 0,
            history: [
                { by: "from", cash: cappedCash, rep: cappedRep, ts: nowMs() }
            ]
        };
    }
    
    /**
     * Validate and apply a counter-offer to the wager
     * @param {Object} wager - Current wager object
     * @param {Object} offer - { cash, rep } new offer
     * @param {string} by - "from" or "to"
     * @returns {Object} { valid: boolean, wager: updated wager or null, error: string }
     */
    function applyCounterOffer(wager, offer, by) {
        if (!wager || !offer) {
            return { valid: false, wager: null, error: "Missing wager or offer" };
        }
        
        var newCash = Math.max(0, offer.cash || 0);
        var newRep = Math.max(0, offer.rep || 0);
        
        // Always enforce absolute max
        if (newCash > wager.absoluteMax.cash || newRep > wager.absoluteMax.rep) {
            return { 
                valid: false, 
                wager: null, 
                error: "Offer exceeds absolute max ($" + wager.absoluteMax.cash + " / " + wager.absoluteMax.rep + " rep)"
            };
        }
        
        var isFirstCounter = !wager.ceiling.locked && by === "to";
        
        if (isFirstCounter) {
            // First counter from challengee — can raise ceiling up to absolute max
            var newCeiling = {
                cash: Math.min(Math.max(wager.ceiling.cash, newCash), wager.absoluteMax.cash),
                rep: Math.min(Math.max(wager.ceiling.rep, newRep), wager.absoluteMax.rep),
                locked: true  // Lock after first counter
            };
            
            wager.ceiling = newCeiling;
            wager.cash = newCash;
            wager.rep = newRep;
            wager.proposedBy = by;
            wager.revision++;
            wager.history.push({ by: by, cash: newCash, rep: newRep, ts: nowMs() });
            
            logInfo("applyCounterOffer: first counter, ceiling now " + newCeiling.cash + "/" + newCeiling.rep + " (locked)");
            return { valid: true, wager: wager, error: null };
        }
        
        // Ceiling is locked — can only go equal or lower
        if (newCash > wager.ceiling.cash || newRep > wager.ceiling.rep) {
            return { 
                valid: false, 
                wager: null, 
                error: "Offer exceeds ceiling ($" + wager.ceiling.cash + " / " + wager.ceiling.rep + " rep)"
            };
        }
        
        wager.cash = newCash;
        wager.rep = newRep;
        wager.proposedBy = by;
        wager.revision++;
        wager.history.push({ by: by, cash: newCash, rep: newRep, ts: nowMs() });
        
        logInfo("applyCounterOffer: counter #" + wager.revision + " by " + by + " = " + newCash + "/" + newRep);
        return { valid: true, wager: wager, error: null };
    }

    function isExpired(ch, ts) {
        if (!ch) return true;
        var now = ts || nowMs();
        return ch.expiresAt && now > ch.expiresAt;
    }
    
    function ensureClient(opts) {
        if (!LORB.JsonClientHelper) {
            try { load("/sbbs/xtrn/nba_jam/lib/lorb/util/json_client_helper.js"); } catch (e) {}
        }
        if (typeof LORB !== "undefined" && LORB.Config && LORB.Config.ENABLE_LIVE_CHALLENGES === false) {
            return null;
        }
        if (!LORB.JsonClientHelper) return null;
        var c = LORB.JsonClientHelper.ensureClient(opts);
        if (!c && typeof debugLog === "function") {
            debugLog("[LORB:Challenges][WARN] json-client unavailable (backoff/connection)");
        }
        return c;
    }
    
    function disconnect() {
        if (LORB.JsonClientHelper && LORB.JsonClientHelper.disconnect) {
            LORB.JsonClientHelper.disconnect();
        }
    }
    
    function cacheChallenge(ch) { if (ch && ch.id) challengeCache[ch.id] = ch; }
    function dropFromCache(id) { if (id && challengeCache[id]) delete challengeCache[id]; }
    function cacheChallengesFromBucket(bucket) {
        if (!bucket || typeof bucket !== "object") return;
        for (var id in bucket) {
            if (!bucket.hasOwnProperty(id)) continue;
            cacheChallenge(bucket[id]);
        }
    }

    function getCachedOutgoing(gid, ts) {
        var outgoing = [];
        for (var cachedId in challengeCache) {
            if (!challengeCache.hasOwnProperty(cachedId)) continue;
            var cached = challengeCache[cachedId];
            if (!cached || isExpired(cached, ts)) continue;
            if (cached.from && cached.from.globalId === gid && (cached.status === "pending" || cached.status === "accepted")) {
                outgoing.push(cached);
            }
        }
        outgoing.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
        return outgoing;
    }

    function lockPath(c, path, lockType) {
        try { if (c && c.lock) c.lock(DB_SCOPE, path, lockType); } catch (e) {
            logWarn("lockPath failed: " + path + " err=" + e);
        }
    }
    function unlockPath(c, path) {
        try { if (c && c.unlock) c.unlock(DB_SCOPE, path); } catch (e) {
            logWarn("unlockPath failed: " + path + " err=" + e);
        }
    }
    
    function readBucket(c, gid) {
        if (!gid) return {};
        var start = nowMs();
        var path = bucketPath(gid);
        logInfo("readBucket: scope=" + DB_SCOPE + " path=" + path);
        // CRITICAL: Must acquire read lock before reading (JSON service requires it)
        lockPath(c, path, LOCK_READ_CONST);
        var bucket;
        try {
            bucket = c.read(DB_SCOPE, path);
        } finally {
            unlockPath(c, path);
        }
        if (!bucket || typeof bucket !== "object") bucket = {};
        cacheChallengesFromBucket(bucket);
        logOp("readBucket gid=" + gid, "ok", start, "count=" + Object.keys(bucket).length);
        return bucket;
    }
    
    function writeBucketWithRetry(c, gid, ch) {
        var attempts = 0;
        var lastErr = null;
        var bucketRoot = bucketPath(gid);
        while (attempts < 2) {
            var start = nowMs();
            var lockHolder = c; // Track which connection holds the lock
            var didLock = false;
            try {
                // lock() returns undefined on success, throws on failure
                if (lockHolder && lockHolder.lock) {
                    lockHolder.lock(DB_SCOPE, bucketRoot, LOCK_WRITE_CONST);
                    didLock = true;
                }
                var bucket = lockHolder.read(DB_SCOPE, bucketRoot);
                if (!bucket || typeof bucket !== "object") bucket = {};
                bucket[ch.id] = ch;
                lockHolder.write(DB_SCOPE, bucketRoot, bucket);
                logOp("writeBucket", "ok", start, "gid=" + gid + " id=" + ch.id + " attempt=" + (attempts + 1));
                // Unlock before returning (same connection that locked)
                if (didLock) unlockPath(lockHolder, bucketRoot);
                return true;
            } catch (e) {
                lastErr = e;
                logWarn("writeBucket failed gid=" + gid + " id=" + ch.id + " attempt=" + (attempts + 1) + " err=" + e);
                // CRITICAL: Unlock on the SAME connection that acquired the lock BEFORE disconnecting
                if (didLock) {
                    unlockPath(lockHolder, bucketRoot);
                }
                attempts++;
                // Try a reconnect once before giving up
                if (attempts < 2 && LORB.JsonClientHelper && LORB.JsonClientHelper.disconnect) {
                    LORB.JsonClientHelper.disconnect();
                    c = ensureClient();
                    if (!c) break;
                }
            }
        }
        if (LORB.JsonClientHelper && LORB.JsonClientHelper.markFailure) {
            LORB.JsonClientHelper.markFailure();
        }
        return false;
    }
    
    function writeChallengeToBuckets(c, ch) {
        var ok = true;
        if (ch.from && ch.from.globalId) {
            ok = writeBucketWithRetry(c, ch.from.globalId, ch) && ok;
        }
        if (ch.to && ch.to.globalId) {
            ok = writeBucketWithRetry(c, ch.to.globalId, ch) && ok;
        }
        if (ok) cacheChallenge(ch);
        return ok;
    }
    
    // Pruning is disabled during read/list flows to avoid lock contention; cleanup is handled elsewhere when writes occur.
    function pruneBucket() { return; }
    
    function createChallenge(ctx, targetPlayer, meta, wagerOffer) {
        var c = ensureClient({ force: true });
        if (!c) return null;
        
        var fromRef = buildPlayerRefFromCtx(ctx);
        // Enrich fromRef with cash/rep from ctx
        fromRef.cash = ctx.cash || 0;
        fromRef.rep = ctx.rep || 0;
        
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
            wager = createWagerObject(wagerOffer, absoluteMax);
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
        
        var start = nowMs();
        try {
            if (!writeChallengeToBuckets(c, challenge)) {
                throw new Error("write failed");
            }
            logOp("create", "ok", start, "id=" + id + (wager ? " wager=" + wager.cash + "/" + wager.rep : ""));
            return challenge;
        } catch (e) {
            if (LORB.JsonClientHelper && LORB.JsonClientHelper.markFailure) LORB.JsonClientHelper.markFailure();
            disconnect();
            logWarn("createChallenge failed: " + e);
            return null;
        }
    }
    
    function listIncoming(ctx) {
        // Force fresh connection - reused connections seem to hang after lock/unlock ops
        disconnect();
        var c = ensureClient({ force: true });
        if (!c) return [];
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return [];
        var ts = nowMs();
        var bucket;
        try {
            bucket = readBucket(c, gid);
        } catch (e) {
            if (LORB.JsonClientHelper && LORB.JsonClientHelper.markFailure) LORB.JsonClientHelper.markFailure();
            disconnect();
            logWarn("listIncoming failed: " + e);
            return [];
        }
        
        var incoming = [];
        for (var id in bucket) {
            if (!bucket.hasOwnProperty(id)) continue;
            var ch = bucket[id];
            if (!ch || isExpired(ch, ts)) continue;
            if (ch.to && ch.to.globalId === gid && (ch.status === "pending" || ch.status === "accepted")) {
                incoming.push(ch);
            }
        }
        incoming.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
        return incoming;
    }
    
    function listOutgoing(ctx) {
        var c = ensureClient();
        if (!c) return [];
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return [];
        var ts = nowMs();
        var bucket;
        try {
            bucket = readBucket(c, gid);
        } catch (e) {
            if (LORB.JsonClientHelper && LORB.JsonClientHelper.markFailure) LORB.JsonClientHelper.markFailure();
            disconnect();
            logWarn("listOutgoing failed: " + e);
            return getCachedOutgoing(gid, ts);
        }
        
        var outgoing = [];
        for (var id in bucket) {
            if (!bucket.hasOwnProperty(id)) continue;
            var ch = bucket[id];
            if (!ch || isExpired(ch, ts)) continue;
            if (ch.from && ch.from.globalId === gid && (ch.status === "pending" || ch.status === "accepted")) {
                outgoing.push(ch);
            }
        }
        if (outgoing.length === 0) {
            outgoing = getCachedOutgoing(gid, ts);
        }
        outgoing.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
        return outgoing;
    }
    
    function findInBucket(c, gid, id) {
        if (challengeCache[id]) return challengeCache[id];
        try {
            var bucket = readBucket(c, gid);
            return bucket[id] || null;
        } catch (e) {
            return challengeCache[id] || null;
        }
    }
    
    function getChallenge(id, ctx) {
        if (challengeCache[id]) return challengeCache[id];
        var c = ensureClient();
        if (!c || !id) return null;
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return null;
        var start = nowMs();
        try {
            var bucket = readBucket(c, gid);
            var found = bucket[id] || null;
            if (found) cacheChallenge(found);
            logOp("getChallenge", found ? "ok" : "miss", start, "id=" + id + " gid=" + gid);
            return found;
        } catch (e) {
            if (LORB.JsonClientHelper && LORB.JsonClientHelper.markFailure) LORB.JsonClientHelper.markFailure();
            disconnect();
            logWarn("getChallenge failed: " + e);
            return null;
        }
    }
    
    function updateChallenge(ctx, id, updater) {
        var c = ensureClient({ force: true });
        if (!c) return null;
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return null;
        var start = nowMs();
        var ch = findInBucket(c, gid, id);
        if (!ch) {
            logOp("updateChallenge", "miss", start, "id=" + id + " gid=" + gid);
            return null;
        }
        var updated = updater(ch) || ch;
        updated.updatedAt = nowMs();
        try {
            if (!writeChallengeToBuckets(c, updated)) {
                throw new Error("write failed");
            }
            logOp("updateChallenge", "ok", start, "id=" + id + " status=" + updated.status);
            return updated;
        } catch (e) {
            if (LORB.JsonClientHelper && LORB.JsonClientHelper.markFailure) LORB.JsonClientHelper.markFailure();
            disconnect();
            logWarn("updateChallenge failed: " + e);
            return null;
        }
    }
    
    function markAccepted(id, ctx) {
        var updated = updateChallenge(ctx, id, function (ch) {
            ch.status = "accepted";
            var gid = getGlobalIdFromCtx(ctx);
            if (gid) {
                if (!ch.lobby) ch.lobby = { ready: {}, lastPing: {} };
                ch.lobby.ready[gid] = true;
                ch.lobby.lastPing[gid] = nowMs();
            }
            logLifecycle(ch, "accepted");
            return ch;
        });
        if (!updated) {
            logWarn("accept failed for id=" + id + " (updateChallenge returned null)");
        }
        return updated;
    }
    
    function markDeclined(id, ctx) {
        var updated = updateChallenge(ctx, id, function (ch) {
            ch.status = "declined";
            logLifecycle(ch, "declined");
            return ch;
        });
        if (!updated) {
            logWarn("decline failed for id=" + id + " (updateChallenge returned null)");
        }
        return updated;
    }
    
    function markCancelled(id, ctx) {
        var updated = updateChallenge(ctx, id, function (ch) {
            ch.status = "cancelled";
            logLifecycle(ch, "cancelled");
            return ch;
        });
        if (!updated) {
            logWarn("cancel failed for id=" + id + " (updateChallenge returned null)");
        }
        return updated;
    }
    
    function markReady(id, ctx, ready) {
        var updated = updateChallenge(ctx, id, function (ch) {
            if (!ch.lobby) ch.lobby = { ready: {}, lastPing: {} };
            var gid = getGlobalIdFromCtx(ctx);
            if (gid) {
                ch.lobby.ready[gid] = !!ready;
                ch.lobby.lastPing[gid] = nowMs();
                logLifecycle(ch, "ready", "ready=" + (!!ready));
            }
            return ch;
        });
        if (!updated) {
            logWarn("markReady failed for id=" + id + " (updateChallenge returned null)");
        }
        return updated;
    }
    
    function isOtherReady(ch, myGlobalId) {
        if (!ch || !ch.lobby || !ch.lobby.ready) return false;
        var otherId = (ch.from && ch.from.globalId === myGlobalId) ? (ch.to && ch.to.globalId) : (ch.from && ch.from.globalId);
        if (!otherId) return false;
        if (!ch.lobby.ready[otherId]) return false;
        if (ch.lobby.lastPing && ch.lobby.lastPing[otherId]) {
            return (nowMs() - ch.lobby.lastPing[otherId]) < READY_STALE_MS;
        }
        return true;
    }
    
    /**
     * Submit a counter-offer for the wager
     * @param {string} id - Challenge ID
     * @param {Object} ctx - Player context
     * @param {Object} offer - { cash, rep } new offer
     * @returns {Object} { success, challenge, error }
     */
    function submitCounterOffer(id, ctx, offer) {
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) {
            return { success: false, challenge: null, error: "No player ID" };
        }
        
        var updated = updateChallenge(ctx, id, function (ch) {
            if (!ch.wager) {
                // No wager on this challenge
                return null;
            }
            
            // Determine if this is "from" or "to"
            var by = (ch.from && ch.from.globalId === gid) ? "from" : "to";
            
            // Can't counter your own offer
            if (ch.wager.proposedBy === by) {
                logWarn("Cannot counter your own offer");
                return null;
            }
            
            var result = applyCounterOffer(ch.wager, offer, by);
            if (!result.valid) {
                logWarn("Counter-offer invalid: " + result.error);
                return null;
            }
            
            ch.wager = result.wager;
            ch.status = "negotiating";
            logLifecycle(ch, "counter", "cash=" + offer.cash + " rep=" + offer.rep);
            return ch;
        });
        
        if (!updated) {
            return { success: false, challenge: null, error: "Failed to update challenge" };
        }
        
        return { success: true, challenge: updated, error: null };
    }
    
    /**
     * Accept the current wager offer
     * @param {string} id - Challenge ID
     * @param {Object} ctx - Player context
     * @returns {Object} Updated challenge or null
     */
    function acceptWager(id, ctx) {
        var updated = updateChallenge(ctx, id, function (ch) {
            ch.status = "accepted";
            var gid = getGlobalIdFromCtx(ctx);
            if (gid) {
                if (!ch.lobby) ch.lobby = { ready: {}, lastPing: {} };
                ch.lobby.ready[gid] = true;
                ch.lobby.lastPing[gid] = nowMs();
            }
            logLifecycle(ch, "wager_accepted", ch.wager ? ("cash=" + ch.wager.cash + " rep=" + ch.wager.rep) : "no_wager");
            return ch;
        });
        if (!updated) {
            logWarn("acceptWager failed for id=" + id);
        }
        return updated;
    }
    
    /**
     * Check if it's this player's turn to respond in negotiation
     */
    function isMyTurnToRespond(ch, myGlobalId) {
        if (!ch || !ch.wager) return false;
        var myRole = (ch.from && ch.from.globalId === myGlobalId) ? "from" : "to";
        return ch.wager.proposedBy !== myRole;
    }
    
    /**
     * Get the current wager offer details
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

    function clearForPlayer(ctx) {
        // Avoid blocking the JSON service on exit; cleanup is best-effort elsewhere.
        return 1;
    }
    
    function logLifecycle(ch, evt, extra) {
        if (typeof debugLog !== "function" || !ch) return;
        var parts = ["[LORB:Challenges] lifecycle", "id=" + ch.id, "evt=" + evt];
        if (ch.status) parts.push("status=" + ch.status);
        if (ch.from && ch.from.globalId) parts.push("from=" + ch.from.globalId);
        if (ch.to && ch.to.globalId) parts.push("to=" + ch.to.globalId);
        if (extra) parts.push(extra);
        debugLog(parts.join(" "));
    }
    
    this.LORB.Multiplayer.Challenges = {
        createChallenge: createChallenge,
        listIncoming: listIncoming,
        listOutgoing: listOutgoing,
        getIncomingChallenges: listIncoming,   // legacy alias
        getSentChallenges: listOutgoing,       // legacy alias
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
        
        // Wager negotiation functions
        calculateAbsoluteMax: calculateAbsoluteMax,
        submitCounterOffer: submitCounterOffer,
        acceptWager: acceptWager,
        isMyTurnToRespond: isMyTurnToRespond,
        getWagerDetails: getWagerDetails
    };
})();
