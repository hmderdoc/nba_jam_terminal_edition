// ChallengeService - manages presence and challenge subscriptions via pub/sub
// Works with challenges_pubsub.js - uses subscriptions, not polling
(function () {
    var LORB = this.LORB;
    if (!LORB || !LORB.Multiplayer || !LORB.Multiplayer.Challenges) return;
    var Challenges = LORB.Multiplayer.Challenges;
    
    var serviceCtx = null;
    var started = false;
    
    function nowMs() {
        return Date.now ? Date.now() : (time() * 1000);
    }
    
    function logInfo(msg) {
        if (typeof debugLog === "function") {
            debugLog("[LORB:ChallengeService] " + msg);
        }
    }
    function logWarn(msg) {
        if (typeof debugLog === "function") {
            debugLog("[LORB:ChallengeService][WARN] " + msg);
        }
    }
    
    function getGlobalId() {
        if (!serviceCtx || !serviceCtx._user || !LORB.Persist || !LORB.Persist.getGlobalPlayerId) return null;
        return LORB.Persist.getGlobalPlayerId(serviceCtx._user);
    }
    
    /**
     * Start the challenge service for a player context.
     * This subscribes to presence/challenge updates via pub/sub.
     */
    function start(ctx) {
        if (!LORB.Config || !LORB.Config.ENABLE_LIVE_CHALLENGES) return false;
        if (started) return true;
        
        serviceCtx = ctx;
        started = true;
        
        var startTime = nowMs();
        
        // Set presence - this triggers subscription and initial data fetch
        // The pub/sub module handles all the connection, subscription, and caching
        if (Challenges && Challenges.setPresence) {
            try {
                Challenges.setPresence(ctx);
                logInfo("presence set for gid=" + getGlobalId() + " in " + (nowMs() - startTime) + "ms");
            } catch (e) {
                logWarn("setPresence failed: " + e);
            }
        }
        
        logInfo("service started for gid=" + getGlobalId());
        return true;
    }
    
    /**
     * Stop the service and clear presence.
     */
    function stop() {
        var gid = getGlobalId();
        
        // Clear presence - mark player as offline
        if (Challenges && Challenges.clearPresence && serviceCtx) {
            try {
                Challenges.clearPresence(serviceCtx);
                logInfo("presence cleared for gid=" + gid);
            } catch (e) {
                logWarn("clearPresence failed: " + e);
            }
        }
        
        if (Challenges && Challenges.disconnect) {
            try { Challenges.disconnect(); } catch (e) {}
        }
        
        serviceCtx = null;
        started = false;
        logInfo("service stopped for gid=" + gid);
    }
    
    /**
     * Process any pending subscription updates.
     * Should be called periodically (e.g., in menu idle loops).
     * This is NON-BLOCKING - just processes already-received data.
     */
    function cycle() {
        if (Challenges && Challenges.cycle) {
            try { Challenges.cycle(); } catch (e) {
                logWarn("cycle error: " + e);
            }
        }
    }
    
    /**
     * Get incoming challenges from cache.
     * NON-BLOCKING - returns cached data immediately.
     */
    function getIncoming() {
        if (!started || !serviceCtx) {
            logInfo("getIncoming: not started or no ctx");
            return [];
        }
        if (Challenges && Challenges.listIncoming) {
            var result = Challenges.listIncoming(serviceCtx) || [];
            if (result.length > 0) {
                logInfo("getIncoming: found " + result.length + " challenges");
            }
            return result;
        }
        return [];
    }
    
    /**
     * Get outgoing challenges from cache.
     * NON-BLOCKING - returns cached data immediately.
     */
    function getOutgoing() {
        if (!started || !serviceCtx) return [];
        if (Challenges && Challenges.listOutgoing) {
            return Challenges.listOutgoing(serviceCtx) || [];
        }
        return [];
    }
    
    /**
     * Get online players from cache.
     * NON-BLOCKING - returns cached data immediately.
     */
    function getOnlinePlayers() {
        if (Challenges && Challenges.getOnlinePlayers) {
            return Challenges.getOnlinePlayers() || {};
        }
        return {};
    }
    
    /**
     * Check if service is running.
     */
    function isStarted() { 
        return started; 
    }
    
    /**
     * Get last poll timestamp (for compatibility).
     */
    function getLastPollTs() { 
        return nowMs(); // Pub/sub doesn't poll, but return current time for compatibility
    }
    
    /**
     * Force refresh (triggers cycle).
     */
    function pollNow() {
        cycle();
    }
    
    LORB.Multiplayer.ChallengeService = {
        start: start,
        stop: stop,
        cycle: cycle,
        getIncoming: getIncoming,
        getOutgoing: getOutgoing,
        getOnlinePlayers: getOnlinePlayers,
        isStarted: isStarted,
        getLastPollTs: getLastPollTs,
        pollNow: pollNow
    };
    
})();
