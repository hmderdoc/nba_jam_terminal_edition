// Shared lobby wait/handshake helpers for live challenges.
(function () {
    if (!this.LORB || !this.LORB.Multiplayer || !this.LORB.Multiplayer.Challenges) return;
    
    var Challenges = this.LORB.Multiplayer.Challenges;
    var DEFAULT_TIMEOUT_MS = 120000;  // 2 minutes to form up
    var TICK_MS = 1200;
    
    function logWarn(msg) {
        if (typeof debugLog === "function") {
            debugLog("[LORB:ChallengeLobby][WARN] " + msg);
        }
    }
    function logInfo(msg) {
        if (typeof debugLog === "function") {
            debugLog("[LORB:ChallengeLobby] " + msg);
        }
    }
    
    function waitForReady(challengeId, ctx, opts) {
        opts = opts || {};
        var timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
        var autoReady = (opts.autoReady !== false);
        var tickMs = opts.tickMs || TICK_MS;
        var started = Date.now ? Date.now() : (time() * 1000);
        
        // Keep advertising our readiness
        if (autoReady) {
            Challenges.markReady(challengeId, ctx, true);
        }
        
        while (true) {
            var ch = Challenges.getChallenge(challengeId);
            if (!ch) {
                logWarn("waitForReady: challenge missing id=" + challengeId);
                return { status: "missing" };
            }
            
            if (ch.status === "declined" || ch.status === "cancelled" || ch.status === "expired") {
                logWarn("waitForReady: challenge ended status=" + ch.status + " id=" + challengeId);
                return { status: ch.status, challenge: ch };
            }
            
            if (ch.status === "accepted") {
                var myId = LORB.Persist.getGlobalPlayerId ? LORB.Persist.getGlobalPlayerId(ctx._user) : null;
                if (myId && Challenges.isOtherReady(ch, myId)) {
                    logInfo("waitForReady: other ready id=" + challengeId);
                    return { status: "ready", challenge: ch };
                }
            }
            
            if (autoReady) {
                Challenges.markReady(challengeId, ctx, true);
            }
            
            if (opts.onTick) {
                try { opts.onTick(ch); } catch (e) { logWarn("onTick failed: " + e); }
            }
            
            var now = Date.now ? Date.now() : (time() * 1000);
            if ((now - started) >= timeoutMs) {
                logWarn("waitForReady: timeout id=" + challengeId);
                return { status: "timeout", challenge: ch };
            }
            
            mswait(tickMs);
        }
    }
    
    this.LORB.Multiplayer.ChallengeLobby = {
        waitForReady: waitForReady
    };
    
})();
