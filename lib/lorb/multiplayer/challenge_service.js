// Background service to poll/maintain live challenges - timer-based, no hammering.
(function () {
    var LORB = this.LORB;
    if (!LORB || !LORB.Multiplayer || !LORB.Multiplayer.Challenges) return;
    var Challenges = LORB.Multiplayer.Challenges;
    
    // Poll every 5 seconds - NOT faster
    var POLL_INTERVAL_MS = 5000;
    var MAX_LOG_GAP_MS = 30000;
    var MAX_CONSEC_FAILS = 3;
    var BACKOFF_MS = 15000;
    
    // Load event timer
    if (typeof Timer === "undefined") {
        try { load("/sbbs/exec/load/event-timer.js"); } catch (e) {}
    }
    
    var timer = null;
    var pollEvent = null;
    var serviceCtx = null;
    var lastLogTs = 0;
    var lastPollTs = 0;
    var polling = false;
    var consecutiveFails = 0;
    var disabled = false;
    var backoffUntil = 0;
    var started = false;
    
    var state = {
        incoming: [],
        outgoing: [],
        lastPoll: 0
    };
    
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
    
    function poll() {
        if (polling || disabled) return;
        
        var now = nowMs();
        if (backoffUntil && now < backoffUntil) return;
        
        // Enforce minimum interval between polls
        if (lastPollTs && (now - lastPollTs) < POLL_INTERVAL_MS) {
            return; // Too soon, skip
        }
        
        polling = true;
        lastPollTs = now;
        var start = nowMs();
        
        try {
            if (!serviceCtx) {
                polling = false;
                return;
            }
            
            state.incoming = Challenges.listIncoming(serviceCtx) || [];
            state.outgoing = Challenges.listOutgoing(serviceCtx) || [];
            state.lastPoll = now;
            
            consecutiveFails = 0;
            backoffUntil = 0;
            
            // Throttled logging
            if (typeof debugLog === "function" && (lastLogTs === 0 || (now - lastLogTs) > MAX_LOG_GAP_MS)) {
                lastLogTs = now;
                logInfo("poll ok incoming=" + state.incoming.length + " outgoing=" + state.outgoing.length + " gid=" + getGlobalId() + " ms=" + (nowMs() - start));
            }
        } catch (e) {
            consecutiveFails++;
            backoffUntil = nowMs() + BACKOFF_MS;
            logWarn("poll failed (count=" + consecutiveFails + ", backoff=" + BACKOFF_MS + "ms): " + e);
            if (Challenges && Challenges.disconnect) {
                Challenges.disconnect();
            }
            if (consecutiveFails >= MAX_CONSEC_FAILS) {
                disabled = true;
                logWarn("polling disabled after " + consecutiveFails + " consecutive failures");
            }
        } finally {
            polling = false;
        }
    }
    
    function start(ctx) {
        if (!LORB.Config || !LORB.Config.ENABLE_LIVE_CHALLENGES) return false;
        if (started) return true;
        serviceCtx = ctx;
        disabled = false;
        consecutiveFails = 0;
        lastPollTs = 0;
        backoffUntil = 0;
        started = true;
        
        // Use event timer for proper scheduling
        if (!timer && typeof Timer !== "undefined") {
            timer = new Timer();
        }
        if (timer && !pollEvent) {
            pollEvent = timer.addEvent(POLL_INTERVAL_MS, true, poll, [], this);
        }
        
        logInfo("service started for gid=" + getGlobalId());
        return true;
    }
    
    function stop() {
        if (timer && pollEvent) {
            pollEvent.abort = true;
        }
        if (timer && timer.events) {
            timer.events.length = 0;
        }
        timer = null;
        pollEvent = null;
        var gid = getGlobalId();
        serviceCtx = null;
        state.incoming = [];
        state.outgoing = [];
        state.lastPoll = 0;
        lastPollTs = 0;
        consecutiveFails = 0;
        disabled = false;
        backoffUntil = 0;
        if (Challenges && Challenges.disconnect) {
            Challenges.disconnect();
        }
        started = false;
        logInfo("service stopped for gid=" + gid);
    }
    
    // Called from hub loop to cycle the timer - MUST be called regularly
    function cycle() {
        if (timer && timer.cycle) {
            try { timer.cycle(); } catch (e) {}
        }
    }
    
    function getIncoming() { return state.incoming; }
    function getOutgoing() { return state.outgoing; }
    function getLastPollTs() { return state.lastPoll; }
    
    // Force poll, but respect minimum interval
    function pollNow() {
        poll();
    }
    
    LORB.Multiplayer.ChallengeService = {
        start: start,
        stop: stop,
        cycle: cycle,
        getIncoming: getIncoming,
        getOutgoing: getOutgoing,
        getLastPollTs: getLastPollTs,
        pollNow: pollNow
    };
    
})();
