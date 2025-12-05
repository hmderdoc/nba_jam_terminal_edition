/**
 * challenges_simple.js - Live challenge coordination
 * 
 * Modeled after oneliners/lib.js - a known working pattern.
 * Simple: connect, read, write, subscribe, cycle.
 * No locks. No timeout manipulation. No cleverness.
 */
(function () {
    if (!this.LORB) return;
    if (!this.LORB.Multiplayer) this.LORB.Multiplayer = {};
    
    load("json-client.js");
    
    var SERVER_CFG = (LORB.Persist && LORB.Persist.getServerConfig) ? (LORB.Persist.getServerConfig() || {}) : {};
    var SCOPE = SERVER_CFG.scope || "nba_jam";
    var CHALLENGES = "LORB_CHALLENGES";
    var PRESENCE = "LORB_PRESENCE";
    var DEFAULT_TTL_MS = 5 * 60 * 1000;    // 5 minutes
    var PRESENCE_TIMEOUT_MS = 60000;        // 1 minute
    
    var client = null;
    var myGlobalId = null;
    
    function nowMs() { return Date.now(); }
    function log(msg) { if (typeof debugLog === "function") debugLog("[LORB:Challenges] " + msg); }
    
    function getGlobalIdFromCtx(ctx) {
        if (!ctx) return null;
        var u = ctx._user || ctx;
        if (!u || !u.number) return null;
        var bbsId = (typeof system !== "undefined" && system.qwk_id) || "local";
        bbsId = bbsId.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
        return bbsId + "_" + u.number;
    }
    
    /**
     * Extract active teammate data from context for multiplayer sync
     * Flattens the teammate into a serializable object
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
        
        // Return flattened teammate data for serialization
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
    
    function connect() {
        if (client && client.connected) return client;
        
        try {
            var addr = SERVER_CFG.addr || "localhost";
            var port = SERVER_CFG.port || 10088;
            client = new JSONClient(addr, port);
            log("connected to " + addr + ":" + port);
            return client;
        } catch (e) {
            log("connect failed: " + e);
            client = null;
            return null;
        }
    }
    
    function disconnect() {
        if (client) {
            try { client.disconnect(); } catch (e) {}
            client = null;
        }
        myGlobalId = null;
    }
    
    function cycle() {
        if (!client || !client.connected) return;
        try { client.cycle(); } catch (e) {}
    }
    
    // =====================
    // PRESENCE
    // =====================
    
    function setPresence(ctx) {
        if (!connect()) return false;
        
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return false;
        myGlobalId = gid;
        
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
                jerseyNumber: appearance.jerseyNumber || null
            },
            stats: stats,
            position: ctx.position || null,
            level: ctx.level || 1,
            archetype: ctx.archetype || null,
            // Include active teammate for multiplayer sprite sync
            activeTeammate: extractTeammateData(ctx)
        };
        
        try {
            // Simple write - just like oneliners.post()
            client.write(SCOPE, PRESENCE + "." + gid, data, 2);
            log("presence set for " + gid);
            return true;
        } catch (e) {
            log("setPresence error: " + e);
            return false;
        }
    }
    
    function clearPresence(ctx) {
        if (!client || !client.connected) return false;
        
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return false;
        
        try {
            client.remove(SCOPE, PRESENCE + "." + gid, 2);
            log("presence cleared for " + gid);
            return true;
        } catch (e) {
            log("clearPresence error: " + e);
            return false;
        }
    }
    
    function getOnlinePlayers() {
        if (!connect()) return {};
        cycle();
        
        try {
            // Simple read - just like oneliners.read()
            var all = client.read(SCOPE, PRESENCE, 1);
            if (!all || typeof all !== "object") return {};
            
            var now = nowMs();
            var online = {};
            for (var id in all) {
                if (!all.hasOwnProperty(id)) continue;
                var p = all[id];
                if (p && p.timestamp && (now - p.timestamp) < PRESENCE_TIMEOUT_MS) {
                    online[id] = p;
                }
            }
            log("getOnlinePlayers: " + Object.keys(online).length + " online");
            return online;
        } catch (e) {
            log("getOnlinePlayers error: " + e);
            return {};
        }
    }
    
    function isPlayerOnline(globalId) {
        var online = getOnlinePlayers();
        return !!online[globalId];
    }
    
    // =====================
    // CHALLENGES
    // =====================
    
    function createChallenge(ctx, targetPlayer, meta) {
        if (!connect()) return null;
        
        var fromGid = getGlobalIdFromCtx(ctx);
        var toGid = targetPlayer && (targetPlayer.globalId || targetPlayer._globalId);
        if (!fromGid || !toGid) {
            log("createChallenge: missing gid");
            return null;
        }
        
        var u = ctx._user || ctx;
        var ts = nowMs();
        var id = "ch_" + fromGid + "_" + toGid + "_" + ts;
        
        // Extract appearance data from challenger (ctx)
        var fromAppearance = ctx.appearance || {};
        var fromStats = ctx.stats || {};
        
        // Extract appearance data from target player (if available)
        var toAppearance = targetPlayer.appearance || {};
        var toStats = targetPlayer.stats || {};
        
        // Extract teammate data - from ctx for challenger, from presence data for target
        var fromTeammate = extractTeammateData(ctx);
        var toTeammate = targetPlayer.activeTeammate || null;  // Comes from presence data
        
        var challenge = {
            id: id,
            from: {
                globalId: fromGid,
                name: u.alias || u.name || "Player",
                // Include appearance for sprite rendering
                appearance: {
                    skin: fromAppearance.skin || null,
                    eyeColor: fromAppearance.eyeColor || null,
                    jerseyNumber: fromAppearance.jerseyNumber || null
                },
                stats: fromStats,
                nickname: ctx.nickname || null,
                position: ctx.position || null,
                level: ctx.level || 1,
                archetype: ctx.archetype || null,
                // Include active teammate for sprite sync
                activeTeammate: fromTeammate
            },
            to: {
                globalId: toGid,
                name: targetPlayer.name || targetPlayer.userName || "Player",
                // Include appearance for sprite rendering (may be partial from presence)
                appearance: {
                    skin: toAppearance.skin || null,
                    eyeColor: toAppearance.eyeColor || null,
                    jerseyNumber: toAppearance.jerseyNumber || null
                },
                stats: toStats,
                nickname: targetPlayer.nickname || null,
                position: targetPlayer.position || null,
                level: targetPlayer.level || 1,
                archetype: targetPlayer.archetype || null,
                // Include active teammate from presence data
                activeTeammate: toTeammate
            },
            status: "pending",
            createdAt: ts,
            expiresAt: ts + DEFAULT_TTL_MS,
            meta: meta || {}
        };
        
        try {
            // Write to both player paths
            client.write(SCOPE, CHALLENGES + "." + fromGid + "." + id, challenge, 2);
            client.write(SCOPE, CHALLENGES + "." + toGid + "." + id, challenge, 2);
            log("challenge created: " + id);
            return challenge;
        } catch (e) {
            log("createChallenge error: " + e);
            return null;
        }
    }
    
    function getChallengesForPlayer(gid) {
        if (!connect()) return [];
        cycle();
        
        try {
            var bucket = client.read(SCOPE, CHALLENGES + "." + gid, 1);
            if (!bucket || typeof bucket !== "object") return [];
            
            var now = nowMs();
            var list = [];
            for (var id in bucket) {
                if (!bucket.hasOwnProperty(id)) continue;
                var ch = bucket[id];
                if (ch && ch.expiresAt && ch.expiresAt > now) {
                    list.push(ch);
                }
            }
            return list;
        } catch (e) {
            log("getChallengesForPlayer error: " + e);
            return [];
        }
    }
    
    function listIncoming(ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return [];
        
        return getChallengesForPlayer(gid).filter(function(ch) {
            return ch.to && ch.to.globalId === gid && 
                   (ch.status === "pending" || ch.status === "accepted");
        });
    }
    
    function listOutgoing(ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return [];
        
        return getChallengesForPlayer(gid).filter(function(ch) {
            return ch.from && ch.from.globalId === gid && 
                   (ch.status === "pending" || ch.status === "accepted");
        });
    }
    
    function updateChallenge(id, fromGid, toGid, updates) {
        if (!connect()) return null;
        
        try {
            // Read current
            var ch = client.read(SCOPE, CHALLENGES + "." + fromGid + "." + id, 1);
            if (!ch) return null;
            
            // Apply updates
            for (var k in updates) {
                if (updates.hasOwnProperty(k)) {
                    ch[k] = updates[k];
                }
            }
            
            // Write back to both paths
            client.write(SCOPE, CHALLENGES + "." + fromGid + "." + id, ch, 2);
            client.write(SCOPE, CHALLENGES + "." + toGid + "." + id, ch, 2);
            log("challenge updated: " + id + " " + JSON.stringify(updates));
            return ch;
        } catch (e) {
            log("updateChallenge error: " + e);
            return null;
        }
    }
    
    function getChallenge(id, ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid) return null;
        if (!connect()) return null;
        
        try {
            return client.read(SCOPE, CHALLENGES + "." + gid + "." + id, 1);
        } catch (e) {
            return null;
        }
    }
    
    function markAccepted(id, ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        var ch = getChallenge(id, ctx);
        if (!ch) return null;
        
        var fromGid = ch.from && ch.from.globalId;
        var toGid = ch.to && ch.to.globalId;
        return updateChallenge(id, fromGid, toGid, { status: "accepted" });
    }
    
    function markDeclined(id, ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        var ch = getChallenge(id, ctx);
        if (!ch) return null;
        
        var fromGid = ch.from && ch.from.globalId;
        var toGid = ch.to && ch.to.globalId;
        return updateChallenge(id, fromGid, toGid, { status: "declined" });
    }
    
    function markCancelled(id, ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        var ch = getChallenge(id, ctx);
        if (!ch) return null;
        
        var fromGid = ch.from && ch.from.globalId;
        var toGid = ch.to && ch.to.globalId;
        return updateChallenge(id, fromGid, toGid, { status: "cancelled" });
    }
    
    function markReady(id, ctx, ready) {
        var gid = getGlobalIdFromCtx(ctx);
        var ch = getChallenge(id, ctx);
        if (!ch) return null;
        
        // Initialize lobby structure if needed
        if (!ch.lobby) ch.lobby = { ready: {}, lastPing: {} };
        if (!ch.lobby.ready) ch.lobby.ready = {};
        if (!ch.lobby.lastPing) ch.lobby.lastPing = {};
        
        ch.lobby.ready[gid] = !!ready;
        ch.lobby.lastPing[gid] = nowMs();
        
        var fromGid = ch.from && ch.from.globalId;
        var toGid = ch.to && ch.to.globalId;
        
        log("markReady: " + gid + " = " + ready + " for challenge " + id);
        return updateChallenge(id, fromGid, toGid, { lobby: ch.lobby });
    }
    
    function isOtherReady(ch, myGid) {
        if (!ch || !ch.lobby || !ch.lobby.ready) return false;
        
        // Find the other player's ID
        var otherId = null;
        if (ch.from && ch.from.globalId === myGid) {
            otherId = ch.to && ch.to.globalId;
        } else if (ch.to && ch.to.globalId === myGid) {
            otherId = ch.from && ch.from.globalId;
        }
        
        if (!otherId) return false;
        if (!ch.lobby.ready[otherId]) return false;
        
        // Check if their ping is recent (within 90 seconds)
        if (ch.lobby.lastPing && ch.lobby.lastPing[otherId]) {
            var age = nowMs() - ch.lobby.lastPing[otherId];
            if (age > 90000) {
                log("isOtherReady: " + otherId + " ping too old (" + age + "ms)");
                return false;
            }
        }
        
        log("isOtherReady: " + otherId + " is ready");
        return true;
    }

    function clearForPlayer(ctx) {
        var gid = getGlobalIdFromCtx(ctx);
        if (!gid || !connect()) return 0;
        
        try {
            client.remove(SCOPE, CHALLENGES + "." + gid, 2);
            log("cleared challenges for " + gid);
            return 1;
        } catch (e) {
            return 0;
        }
    }
    
    // Export - compatible API
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
        setPresence: setPresence,
        clearPresence: clearPresence,
        getOnlinePlayers: getOnlinePlayers,
        isPlayerOnline: isPlayerOnline
    };
})();
