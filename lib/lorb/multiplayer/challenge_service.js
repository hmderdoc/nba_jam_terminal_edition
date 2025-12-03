// Background service to poll/maintain live challenges without blocking UI loops.
(function () {
    if (!this.LORB || !this.LORB.Multiplayer || !this.LORB.Multiplayer.Challenges) return;
    var Challenges = this.LORB.Multiplayer.Challenges;
    
    var POLL_INTERVAL_MS = 5000;
    var CYCLE_INTERVAL_MS = 1000;
    var MAX_LOG_GAP_MS = 30000; // throttle summary logs
    var MAX_CONSEC_FAILS = 3;   // disable polling after this many back-to-back timeouts/errors
    
    // Load event timer if available
    if (typeof Timer === "undefined") {
        try { load("/sbbs/exec/load/event-timer.js"); } catch (e) {}
    }
    
    var timer = null;
    var cycleHandle = null;
    var pollEvent = null;
    var serviceCtx = null;
    var lastLogTs = 0;
    var polling = false;
    var consecutiveFails = 0;
    var disabled = false;
    
    var state = {
        incoming: [],
        outgoing: [],
        lastPoll: 0
    };
    
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
        polling = true;
        try {
            if (!serviceCtx) return;
            var now = Date.now ? Date.now() : (time() * 1000);
            state.incoming = Challenges.listIncoming(serviceCtx) || [];
            state.outgoing = Challenges.listOutgoing(serviceCtx) || [];
            state.lastPoll = now;
            
            consecutiveFails = 0;
            if (typeof debugLog === "function" && (lastLogTs === 0 || (now - lastLogTs) > MAX_LOG_GAP_MS)) {
                lastLogTs = now;
                logInfo("poll ok incoming=" + state.incoming.length + " outgoing=" + state.outgoing.length + " gid=" + getGlobalId());
            }
        } catch (e) {
            consecutiveFails++;
            logWarn("poll failed (count=" + consecutiveFails + "): " + e);
            if (consecutiveFails >= MAX_CONSEC_FAILS) {
                disabled = true;
                logWarn("polling disabled after " + consecutiveFails + " consecutive failures (gid=" + getGlobalId() + ")");
            }
        } finally {
            polling = false;
        }
    }
    
    function start(ctx) {
        if (!LORB.Config || !LORB.Config.ENABLE_LIVE_CHALLENGES) return false;
        serviceCtx = ctx;
        disabled = false;
        consecutiveFails = 0;
        if (!timer && typeof Timer !== "undefined") {
            timer = new Timer();
        }
        if (timer && !pollEvent) {
            pollEvent = timer.addEvent(POLL_INTERVAL_MS, true, poll, [], this);
        }
        if (!cycleHandle && timer && timer.cycle) {
            cycleHandle = js.setInterval(function () {
                try { timer.cycle(); } catch (e) { logWarn("timer.cycle failed: " + e); }
            }, CYCLE_INTERVAL_MS);
        }
        if (!timer) {
            // Fallback: use plain setInterval to poll if event-timer unavailable
            cycleHandle = js.setInterval(function () {
                poll();
            }, POLL_INTERVAL_MS);
        }
        logInfo("service started for gid=" + getGlobalId());
        return true;
    }
    
    function stop() {
        if (cycleHandle) {
            try { js.clearInterval(cycleHandle); } catch (e) {}
            cycleHandle = null;
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
        consecutiveFails = 0;
        disabled = false;
        if (LORB.Multiplayer.Challenges && LORB.Multiplayer.Challenges.disconnect) {
            LORB.Multiplayer.Challenges.disconnect();
        }
        logInfo("service stopped for gid=" + gid);
    }
    
    function getIncoming() { return state.incoming; }
    function getOutgoing() { return state.outgoing; }
    function getLastPollTs() { return state.lastPoll; }
    function pollNow() { poll(); }
    
    this.LORB.Multiplayer.ChallengeService = {
        start: start,
        stop: stop,
        getIncoming: getIncoming,
        getOutgoing: getOutgoing,
        getLastPollTs: getLastPollTs,
        pollNow: pollNow
    };
    
})();
