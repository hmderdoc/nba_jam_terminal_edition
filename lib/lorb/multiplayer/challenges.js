// Live challenge coordination over JSON-DB (no JSONClient locks).
(function () {
    if (!this.LORB) return;
    if (!this.LORB.Multiplayer) this.LORB.Multiplayer = {};
    
    var DB_SCOPE = "nba_jam";
    var ROOT = "lorb.challenges";
    var DEFAULT_TTL_MS = 5 * 60 * 1000;      // Expire pending challenges after 5 minutes
    var READY_STALE_MS = 90 * 1000;          // Consider ready pings stale after 90s
    var STALE_MAX_AGE_MS = 10 * 60 * 1000;   // Hard cap for lingering records
    
    function nowMs() {
        return Date.now ? Date.now() : (time() * 1000);
    }
    
    function logWarn(msg) {
        if (typeof debugLog === "function") {
            debugLog("[LORB:Challenges][WARN] " + msg);
        }
    }
    function logInfo(msg) {
        if (typeof debugLog === "function") {
            debugLog("[LORB:Challenges] " + msg);
        }
    }
    function logLifecycle(ch, event, extra) {
        var fromId = ch && ch.from ? ch.from.globalId : "?";
        var toId = ch && ch.to ? ch.to.globalId : "?";
        logInfo(event + " id=" + (ch ? ch.id : "?") + " from=" + fromId + " to=" + toId + (extra ? " :: " + extra : ""));
    }
    
    var CONNECT_BACKOFF_MS = 5000;
    var connectBackoffUntil = 0;
    var sharedClient = null;
    
    function ensureClient() {
        var nowTs = nowMs();
        if (connectBackoffUntil && nowTs < connectBackoffUntil) {
            return null;
        }
        if (sharedClient && sharedClient.connected) {
            return sharedClient;
        }
        
        if (typeof JSONClient === "undefined") {
            try { load("json-client.js"); } catch (e) {
                logWarn("json-client.js missing: " + e);
                connectBackoffUntil = nowTs + CONNECT_BACKOFF_MS;
                return null;
            }
        }
        
        var cfg = { addr: "localhost", port: 10088 };
        if (LORB.Persist && typeof LORB.Persist.getServerConfig === "function") {
            cfg = LORB.Persist.getServerConfig() || cfg;
        }
        
        try {
            sharedClient = new JSONClient(cfg.addr, cfg.port);
            if (sharedClient && sharedClient.connected) {
                connectBackoffUntil = 0;
                return sharedClient;
            }
        } catch (e) {
            logWarn("connect failed: " + e);
        }
        connectBackoffUntil = nowTs + CONNECT_BACKOFF_MS;
        sharedClient = null;
        return null;
    }
    
    function withClient(fn) {
        var client = ensureClient();
        if (!client) return null;
        try {
            return fn(client);
        } catch (e) {
            logWarn("client operation failed: " + e);
            return null;
        }
    }
    
    function challengePath(id) {
        return ROOT + "." + id;
    }
    
    function getGlobalIdFromCtx(ctx) {
        if (!ctx || !ctx._user || !LORB.Persist || !LORB.Persist.getGlobalPlayerId) return null;
        return LORB.Persist.getGlobalPlayerId(ctx._user);
    }
    
    function buildPlayerRefFromCtx(ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        return {
            globalId: gid,
            name: (ctx && (ctx.name || ctx.nickname || ctx.userHandle)) || (ctx && ctx._user && (ctx._user.alias || ctx._user.name)) || "Player",
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
    
    function isExpired(challenge, ts) {
        if (!challenge) return true;
        var now = ts || nowMs();
        if (challenge.expiresAt && now > challenge.expiresAt) return true;
        return false;
    }
    
    function cleanupExpired(client, ts) {
        var all = client.read(DB_SCOPE, ROOT);
        if (!all) return;
        for (var id in all) {
            if (!all.hasOwnProperty(id)) continue;
            if (isExpired(all[id], ts)) {
                try { client.remove(DB_SCOPE, challengePath(id), 2); } catch (e) {}
            }
        }
    }
    
    function pruneForPlayer(client, gid, ts) {
        if (!gid) return;
        var all = client.read(DB_SCOPE, ROOT);
        if (!all) return;
        for (var id in all) {
            if (!all.hasOwnProperty(id)) continue;
            var ch = all[id];
            if (!ch) continue;
            var isMine = (ch.from && ch.from.globalId === gid) || (ch.to && ch.to.globalId === gid);
            if (!isMine) continue;
            var age = ts - (ch.createdAt || ts);
            var shouldRemove = isExpired(ch, ts) || age > STALE_MAX_AGE_MS || ch.status === "cancelled" || ch.status === "declined";
            if (shouldRemove) {
                try { client.remove(DB_SCOPE, challengePath(id), 2); } catch (e) {}
            }
        }
    }
    
    function createChallenge(ctx, targetPlayer, meta) {
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
            status: "pending",              // pending | accepted | declined | cancelled | expired
            createdAt: ts,
            updatedAt: ts,
            expiresAt: ts + DEFAULT_TTL_MS,
            lobby: {
                ready: {},
                lastPing: {}
            },
            meta: meta || {}
        };
        
        return withClient(function (client) {
            cleanupExpired(client, ts);
            client.write(DB_SCOPE, challengePath(id), challenge, 2);
            logLifecycle(challenge, "created");
            return challenge;
        });
    }
    
    function getChallenge(id) {
        return withClient(function (client) {
            var ch = client.read(DB_SCOPE, challengePath(id));
            if (isExpired(ch)) {
                try { client.remove(DB_SCOPE, challengePath(id), 2); } catch (e) {}
                return null;
            }
            return ch || null;
        });
    }
    
    function listIncoming(ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return [];
        
        var ts = nowMs();
        return withClient(function (client) {
            cleanupExpired(client, ts);
            pruneForPlayer(client, gid, ts);
            var all = client.read(DB_SCOPE, ROOT) || {};
            var incoming = [];
            for (var id in all) {
                if (!all.hasOwnProperty(id)) continue;
                var ch = all[id];
                if (isExpired(ch, ts)) continue;
                if (ch.to && ch.to.globalId === gid && (ch.status === "pending" || ch.status === "accepted")) {
                    incoming.push(ch);
                }
            }
            incoming.sort(function (a, b) {
                return (a.createdAt || 0) - (b.createdAt || 0);
            });
            return incoming;
        }) || [];
    }
    
    function listOutgoing(ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return [];
        var ts = nowMs();
        return withClient(function (client) {
            cleanupExpired(client, ts);
            pruneForPlayer(client, gid, ts);
            var all = client.read(DB_SCOPE, ROOT) || {};
            var outgoing = [];
            for (var id in all) {
                if (!all.hasOwnProperty(id)) continue;
                var ch = all[id];
                if (isExpired(ch, ts)) continue;
                if (ch.from && ch.from.globalId === gid && (ch.status === "pending" || ch.status === "accepted")) {
                    outgoing.push(ch);
                }
            }
            outgoing.sort(function (a, b) {
                return (a.createdAt || 0) - (b.createdAt || 0);
            });
            return outgoing;
        }) || [];
    }
    
    function updateChallenge(id, updater) {
        return withClient(function (client) {
            var ch = client.read(DB_SCOPE, challengePath(id));
            if (!ch || isExpired(ch)) {
                try { client.remove(DB_SCOPE, challengePath(id), 2); } catch (e) {}
                return null;
            }
            var updated = updater(ch) || ch;
            updated.updatedAt = nowMs();
            client.write(DB_SCOPE, challengePath(id), updated, 2);
            return updated;
        });
    }
    
    function markAccepted(id, ctx) {
        return updateChallenge(id, function (ch) {
            ch.status = "accepted";
            if (!ch.lobby) ch.lobby = { ready: {}, lastPing: {} };
            var gid = getGlobalIdFromCtx(ctx);
            if (gid) {
                ch.lobby.ready[gid] = true;
                ch.lobby.lastPing[gid] = nowMs();
            }
            logLifecycle(ch, "accepted");
            return ch;
        });
    }
    
    function markDeclined(id) {
        return updateChallenge(id, function (ch) {
            ch.status = "declined";
            logLifecycle(ch, "declined");
            return ch;
        });
    }
    
    function markCancelled(id) {
        return updateChallenge(id, function (ch) {
            ch.status = "cancelled";
            logLifecycle(ch, "cancelled");
            return ch;
        });
    }
    
    function markReady(id, ctx, ready) {
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return null;
        return updateChallenge(id, function (ch) {
            if (!ch.lobby) ch.lobby = { ready: {}, lastPing: {} };
            ch.lobby.ready[gid] = !!ready;
            ch.lobby.lastPing[gid] = nowMs();
            logLifecycle(ch, "ready", "ready=" + (!!ready));
            return ch;
        });
    }
    
    function isOtherReady(ch, myGlobalId) {
        if (!ch || !ch.lobby || !ch.lobby.ready) return false;
        var otherId = (ch.from && ch.from.globalId === myGlobalId) ? (ch.to && ch.to.globalId) : (ch.from && ch.from.globalId);
        if (!otherId) return false;
        if (!ch.lobby.ready[otherId]) return false;
        // Ensure readiness is recent
        if (ch.lobby.lastPing && ch.lobby.lastPing[otherId]) {
            return (nowMs() - ch.lobby.lastPing[otherId]) < READY_STALE_MS;
        }
        return true;
    }
    
    function clearForPlayer(ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return 0;
        var ts = nowMs();
        return withClient(function (client) {
            pruneForPlayer(client, gid, ts);
            return true;
        });
    }
    
    function disconnect() {
        if (sharedClient) {
            try { sharedClient.disconnect(); } catch (e) {}
        }
        sharedClient = null;
    }
    
    this.LORB.Multiplayer.Challenges = {
        createChallenge: createChallenge,
        getChallenge: getChallenge,
        listIncoming: listIncoming,
        listOutgoing: listOutgoing,
        markAccepted: markAccepted,
        markDeclined: markDeclined,
        markCancelled: markCancelled,
        markReady: markReady,
        isOtherReady: isOtherReady,
        clearForPlayer: clearForPlayer,
        disconnect: disconnect
    };
    
})();
