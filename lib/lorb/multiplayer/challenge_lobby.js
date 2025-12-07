// Shared lobby wait/handshake helpers for live challenges.
// Polls every 2 seconds with mswait - no tight loops.
(function () {
    var LORB = this.LORB;
    if (!LORB || !LORB.Multiplayer || !LORB.Multiplayer.Challenges) return;
    
    var Challenges = LORB.Multiplayer.Challenges;
    var challengeTiming = (typeof TIMING_CONSTANTS === "object" && TIMING_CONSTANTS && TIMING_CONSTANTS.LORB_CHALLENGES)
        ? TIMING_CONSTANTS.LORB_CHALLENGES
        : null;
    var DEFAULT_TIMEOUT_MS = (challengeTiming && typeof challengeTiming.lobbyTimeoutMs === "number") ? challengeTiming.lobbyTimeoutMs : 120000;  // 2 minutes
    var TICK_MS = (challengeTiming && typeof challengeTiming.pollTickMs === "number") ? challengeTiming.pollTickMs : 2000;  // Poll cadence (min 2s)
    var PENDING_ACCEPT_GRACE_MS = (challengeTiming && typeof challengeTiming.pendingAcceptanceGraceMs === "number") ? challengeTiming.pendingAcceptanceGraceMs : 45000;  // Grace before declaring timeout while pending
    
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
    
    function nowMs() {
        return Date.now ? Date.now() : (time() * 1000);
    }
    
    function waitForReady(challengeId, ctx, opts) {
        opts = opts || {};
        var timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
        var tickMs = Math.max(opts.tickMs || TICK_MS, 2000); // Minimum 2 seconds
        var started = nowMs();
        var lastPingTs = 0;
        
        // Get my global ID for checking other-ready
        var myGid = null;
        if (LORB.Persist && LORB.Persist.getGlobalPlayerId && ctx && ctx._user) {
            myGid = LORB.Persist.getGlobalPlayerId(ctx._user);
        }
        
        logInfo("waitForReady started id=" + challengeId + " myGid=" + myGid);
        
        var pendingSince = null;
        while (true) {
            var now = nowMs();
            
            // Check timeout first
            if ((now - started) >= timeoutMs) {
                logWarn("waitForReady: timeout id=" + challengeId);
                return { status: "timeout", challenge: null };
            }
            
            // Only ping ready every tick interval - don't spam
            if ((now - lastPingTs) >= tickMs) {
                lastPingTs = now;
                
                // Check challenge state
                var ch = Challenges.getChallenge(challengeId, ctx);
                if (!ch) {
                    logWarn("waitForReady: challenge missing id=" + challengeId);
                    return { status: "missing", challenge: null };
                }
                
                // Track how long we've been pending without acceptance
                if (ch.status === "pending") {
                    if (pendingSince === null) pendingSince = now;
                } else {
                    pendingSince = null;
                }
                
                // Check for declined/cancelled/expired
                if (ch.status !== "pending" && ch.status !== "accepted") {
                    logWarn("waitForReady: ended status=" + ch.status);
                    return { status: ch.status, challenge: ch };
                }
                
                // If still pending too long without the other accepting, bail fast
                if (ch.status === "pending" && pendingSince !== null && (now - pendingSince) > PENDING_ACCEPT_GRACE_MS) {
                    logWarn("waitForReady: pending too long without acceptance");
                    return { status: "timeout", challenge: ch };
                }
                
                // Only mark ready once accepted
                if (ch.status === "accepted" && Challenges.markReady) {
                    Challenges.markReady(challengeId, ctx, true);
                }
                
                // Check if other party is ready
                if (ch.status === "accepted" && Challenges.isOtherReady && myGid) {
                    if (Challenges.isOtherReady(ch, myGid)) {
                        logInfo("waitForReady: other ready id=" + challengeId);
                        return { status: "ready", challenge: ch };
                    }
                }
                
                // Callback if provided
                if (opts.onTick) {
                    try { opts.onTick(ch); } catch (e) {}
                }
            }
            
            // Wait before next iteration - critical to avoid CPU spin
            mswait(500);
        }
    }
    
    LORB.Multiplayer.ChallengeLobby = {
        waitForReady: waitForReady
    };
    
})();
