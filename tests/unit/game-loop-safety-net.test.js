// Game Loop Safety Net Tests
// Run with: /sbbs/exec/jsexec tests/unit/game-loop-safety-net.test.js

if (typeof console === "undefined") {
    console = {
        log: function () {
            var args = Array.prototype.slice.call(arguments);
            print(args.join(" "));
        }
    };
}

var basePath = js.exec_dir;
if (/tests\/unit\/?$/.test(basePath)) {
    basePath = basePath.replace(/tests\/unit\/?$/, "");
}
if (basePath.slice(-1) !== '/') {
    basePath += '/';
}

if (typeof COURT_WIDTH === "undefined") {
    COURT_WIDTH = 66;
}
if (typeof COURT_HEIGHT === "undefined") {
    COURT_HEIGHT = 40;
}
if (typeof PLAYER_BOUNDARIES === "undefined") {
    PLAYER_BOUNDARIES = {
        minX: 2,
        minY: 2,
        maxXOffset: 1,
        maxYOffset: 5,
        movementMaxXOffset: 7
    };
}
if (typeof SAFETY_NET_CONFIG === "undefined") {
    SAFETY_NET_CONFIG = {
        NULL_CARRIER_FRAME_LIMIT: 18,
        OUT_OF_BOUNDS_FRAME_LIMIT: 10,
        STALE_INBOUND_FRAME_LIMIT: 90,
        BALL_OUT_OF_BOUNDS_MARGIN: 1
    };
}
if (typeof PHASE_NORMAL === "undefined") {
    PHASE_NORMAL = "NORMAL";
}
if (typeof PHASE_INBOUND_SETUP === "undefined") {
    PHASE_INBOUND_SETUP = "INBOUND_SETUP";
}

load(basePath + "lib/core/state-manager.js");
load(basePath + "lib/core/game-loop-core.js");

function runTests() {
    console.log("=== Game Loop Safety Net Tests ===\n");

    testNullCarrierTriggersLooseBall();
    testStaleInboundTriggersLooseBall();

    console.log("\n✓ All safety net tests passed!");
}

function testNullCarrierTriggersLooseBall() {
    console.log("Test: Null carrier triggers scramble after threshold");

    var stateManager = createStateManager({
        ballCarrier: null,
        shotInProgress: false,
        reboundActive: false,
        inbounding: false,
        ballX: 30,
        ballY: 12,
        phase: { current: PHASE_NORMAL }
    });

    animationSystem = { animations: [] };

    var systems = { stateManager: stateManager };
    var createReboundCalls = [];
    createRebound = function (x, y, sys, isLooseBall) {
        createReboundCalls.push({ x: x, y: y, isLooseBall: isLooseBall });
    };
    announceEvent = function () { };

    resetLooseBallWatch(stateManager, "test_setup");
    var config = resolveSafetyNetConfig();

    for (var i = 0; i < config.NULL_CARRIER_FRAME_LIMIT - 1; i++) {
        var triggered = evaluateLooseBallSafetyNet(systems, { phaseType: PHASE_NORMAL });
        assert(triggered === false, "Safety net should wait for threshold");
    }

    var finalTrigger = evaluateLooseBallSafetyNet(systems, { phaseType: PHASE_NORMAL });
    assert(finalTrigger === true, "Safety net should trigger on threshold frame");
    assert(createReboundCalls.length === 1, "createRebound should be invoked once");
    assert(createReboundCalls[0].isLooseBall === true, "Scramble should be marked as loose ball");

    var watch = stateManager.get("looseBallSafetyNet");
    assert(watch.framesWithoutCarrier === 0, "Watch should reset after trigger");
}

function testStaleInboundTriggersLooseBall() {
    console.log("Test: Stale inbound clears inbound flag and spawns scramble");

    var stateManager = createStateManager({
        ballCarrier: null,
        shotInProgress: false,
        reboundActive: false,
        inbounding: true,
        ballX: 28,
        ballY: 10,
        phase: { current: PHASE_NORMAL },
        inboundGracePeriod: 0
    });

    animationSystem = { animations: [] };

    var systems = { stateManager: stateManager };
    var scrambleCount = 0;
    createRebound = function (x, y, sys, isLooseBall) {
        scrambleCount++;
    };
    announceEvent = function () { };

    resetLooseBallWatch(stateManager, "test_setup_inbound");
    var config = resolveSafetyNetConfig();

    for (var i = 0; i < config.STALE_INBOUND_FRAME_LIMIT - 1; i++) {
        var triggered = evaluateLooseBallSafetyNet(systems, { phaseType: PHASE_NORMAL });
        assert(triggered === false, "Inbound watchdog should wait for threshold");
    }

    var inboundTrigger = evaluateLooseBallSafetyNet(systems, { phaseType: PHASE_NORMAL });
    assert(inboundTrigger === true, "Inbound watchdog should trigger scramble after threshold");
    assert(scrambleCount === 1, "Scramble should fire once for stale inbound");
    assert(stateManager.get("inbounding") === false, "Inbound flag should clear after scramble");

    var watch = stateManager.get("looseBallSafetyNet");
    assert(watch.staleInboundFrames === 0, "Inbound counter should reset after trigger");
}

runTests();

function assert(condition, message) {
    if (!condition) {
        throw new Error("Assertion failed: " + message);
    }
}
