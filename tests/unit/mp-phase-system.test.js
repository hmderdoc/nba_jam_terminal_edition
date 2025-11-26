#!/usr/bin/env jsexec
// Multiplayer Phase System Tests
// Run with: jsexec tests/unit/mp-phase-system.test.js

// Provide minimal console implementation for test execution environments
if (typeof console === "undefined") {
    console = {
        log: function () {
            var args = Array.prototype.slice.call(arguments);
            print(args.join(" "));
        }
    };
}
if (typeof console.print !== "function") console.print = function (msg) { print(msg); };
if (typeof console.clear !== "function") console.clear = function () { };
if (typeof console.getnum !== "function") console.getnum = function () { return 1; };
if (typeof console.getstr !== "function") console.getstr = function (fallback) { return fallback || ""; };
if (typeof console.gotoxy !== "function") console.gotoxy = function () { };
if (typeof console.putmsg !== "function") console.putmsg = function (msg) { print(msg); };
if (typeof console.top !== "function") console.top = function () { };

if (typeof user === "undefined") {
    user = { number: 1 };
}

var basePath = js.exec_dir;
if (/tests\/unit\/?$/.test(basePath)) {
    basePath = basePath.replace(/tests\/unit\/?$/, "");
} else if (/tests\/?$/.test(basePath)) {
    basePath = basePath.replace(/tests\/?$/, "");
} else {
    var marker = "/tests/unit/";
    var markerPos = basePath.indexOf(marker);
    if (markerPos !== -1) {
        basePath = basePath.substring(0, markerPos);
    }
    var winMarker = "\\tests\\unit\\";
    var winPos = basePath.indexOf(winMarker);
    if (winPos !== -1) {
        basePath = basePath.substring(0, winPos);
    }
}
if (basePath.slice(-1) !== '/') {
    basePath += '/';
}

var runtimeBasePath = basePath;
if (runtimeBasePath.indexOf('/repo/') !== -1) {
    runtimeBasePath = runtimeBasePath.replace('/repo/', '/');
}
if (runtimeBasePath.slice(-1) !== '/') {
    runtimeBasePath += '/';
}

var originalExecDir = js.exec_dir;
try {
    Object.defineProperty(js, "exec_dir", {
        value: runtimeBasePath,
        configurable: true,
        writable: true
    });
} catch (execDirError) {
    js.exec_dir = runtimeBasePath;
}

function tryLoad(path) {
    if (!path) return false;
    try {
        load(path);
        return true;
    } catch (e) {
        return false;
    }
}

var sbbsDefsLoaded = false;
var sbbsDefsCandidates = [
    "/sbbs/exec/load/sbbsdefs.js",
    "/sbbs/exec/sbbsdefs.js"
];

function addExecCandidate(fromPath) {
    if (!fromPath) return;
    var unixIdx = fromPath.indexOf("/xtrn/");
    if (unixIdx !== -1) {
        var base = fromPath.substring(0, unixIdx);
        sbbsDefsCandidates.push(base + "/exec/load/sbbsdefs.js");
        sbbsDefsCandidates.push(base + "/exec/sbbsdefs.js");
    }
    var winIdx = fromPath.indexOf("\\xtrn\\");
    if (winIdx !== -1) {
        var winBase = fromPath.substring(0, winIdx);
        sbbsDefsCandidates.push(winBase + "\\exec\\load\\sbbsdefs.js");
        sbbsDefsCandidates.push(winBase + "\\exec\\sbbsdefs.js");
    }
}

addExecCandidate(runtimeBasePath);
addExecCandidate(basePath);

for (var c = 0; c < sbbsDefsCandidates.length && !sbbsDefsLoaded; c++) {
    sbbsDefsLoaded = tryLoad(sbbsDefsCandidates[c]);
}

if (!sbbsDefsLoaded) {
    if (!tryLoad("sbbsdefs.js")) {
        throw new Error("Unable to load sbbsdefs.js for Synchronet constants");
    }
}

load("lib/utils/constants.js");

// Silence debug logging during tests to keep output clean
if (typeof debugLog !== "function") {
    debugLog = function () { };
} else {
    debugLog = function () { };
}

load("lib/multiplayer/mp_coordinator.js");
load("lib/multiplayer/mp_client.js");

// Provide minimal helpers referenced by multiplayer modules
function getScoreFlashState(systems) {
    var flash = systems.stateManager.get('scoreFlash');
    if (!flash) {
        flash = {
            active: false,
            activeTeam: null,
            stopTeam: null,
            startedTick: 0,
            regainCheckEnabled: false
        };
        systems.stateManager.set('scoreFlash', flash, 'init_score_flash_test');
    }
    return flash;
}

function drawAnnouncerLine() { }

function createStubClient() {
    return {
        read: function () { return null; },
        write: function () { },
        subscribe: function () { },
        lock: function () { },
        unlock: function () { }
    };
}

function createMockStateManager(overrides) {
    var defaults = {
        score: { red: 0, blue: 0 },
        shotClock: 24,
        timeRemaining: 720,
        currentTeam: 'teamA',
        inbounding: false,
        inboundPositioning: null,
        inboundPassData: null,
        frontcourtEstablished: false,
        shotInProgress: false,
        currentHalf: 1,
        isHalftime: false,
        ballHandlerProgressOwner: null,
        inboundGracePeriod: 0,
        backcourtTimer: 0,
        ballHandlerStuckTimer: 0,
        ballHandlerAdvanceTimer: 0,
        ballHandlerDeadSince: null,
        ballHandlerDeadFrames: 0,
        closelyGuardedDistance: 999,
        onFire: { teamA: false, teamB: false },
        mpScreen: null,
        scoreFlash: null,
        basketFlash: null,
        announcer: null,
        tickCounter: 0,
        reboundActive: false,
        ballCarrier: { id: 'placeholder' }
    };

    var data = {};
    for (var key in defaults) {
        if (defaults.hasOwnProperty(key)) {
            var value = defaults[key];
            if (value && typeof value === 'object') {
                if (Array.isArray(value)) {
                    data[key] = value.slice();
                } else {
                    var clone = {};
                    for (var inner in value) {
                        if (value.hasOwnProperty(inner)) {
                            clone[inner] = value[inner];
                        }
                    }
                    data[key] = clone;
                }
            } else {
                data[key] = value;
            }
        }
    }

    if (overrides) {
        for (var overrideKey in overrides) {
            if (overrides.hasOwnProperty(overrideKey)) {
                data[overrideKey] = overrides[overrideKey];
            }
        }
    }

    return {
        store: data,
        get: function (key) {
            return this.store.hasOwnProperty(key) ? this.store[key] : undefined;
        },
        set: function (key, value) {
            this.store[key] = value;
        }
    };
}

function createCoordinatorEnv(stateOverrides) {
    var stateManager = createMockStateManager(stateOverrides || {});
    var coordinator = new GameCoordinator(
        "session",
        createStubClient(),
        { tuning: { stateUpdateInterval: 50 } },
        { stateManager: stateManager }
    );
    if (typeof coordinator.collectAnimationSyncPayload !== "function") {
        coordinator.collectAnimationSyncPayload = function () { return []; };
    }
    return { coordinator: coordinator, stateManager: stateManager };
}

function createPlayerClientEnv(stateOverrides) {
    var stateManager = createMockStateManager(stateOverrides || {});
    var systems = { stateManager: stateManager };
    var playerClient = new PlayerClient(
        "session",
        createStubClient(),
        "player1",
        { tuning: { stateUpdateInterval: 50 } },
        systems
    );
    playerClient.mpScreenCoordinator = null;
    return { client: playerClient, stateManager: stateManager };
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

function testSerializeGameStateIncludesPhase() {
    var env = createCoordinatorEnv({ tickCounter: 123 });
    var state = env.coordinator.serializeGameState();
    assert(state.phase === "NORMAL_PLAY", "Expected NORMAL_PLAY but got " + state.phase);
    assert(state.phaseTick === 123, "Expected phaseTick to align with tickCounter");
}

function testInboundWalkPhase() {
    var env = createCoordinatorEnv({
        tickCounter: 10,
        inbounding: true,
        inboundPositioning: { inbounder: { id: 'p1' }, ready: false },
        inboundPassData: null
    });
    var state = env.coordinator.serializeGameState();
    assert(state.phase === "INBOUND_WALK", "Expected INBOUND_WALK during inbound positioning");
}

function testInboundReadyPhase() {
    var env = createCoordinatorEnv({
        tickCounter: 20,
        inbounding: true,
        inboundPositioning: { inbounder: { id: 'p1' }, ready: true },
        inboundPassData: { inbounder: { id: 'p1' } }
    });
    var state = env.coordinator.serializeGameState();
    assert(state.phase === "INBOUND_READY", "Expected INBOUND_READY when inbounder set");
}

function testReboundScramblePhase() {
    var env = createCoordinatorEnv({
        tickCounter: 30,
        reboundActive: true,
        inbounding: false
    });
    var state = env.coordinator.serializeGameState();
    assert(state.phase === "REBOUND_SCRAMBLE", "Expected REBOUND_SCRAMBLE when reboundActive true");
}

function testPostSnapRecoveryPhase() {
    var env = createCoordinatorEnv({ tickCounter: 100 });
    env.coordinator.recordDriftSnap();
    env.stateManager.set('tickCounter', 103);
    var state = env.coordinator.serializeGameState();
    assert(state.phase === "POST_SNAP_RECOVERY", "Expected POST_SNAP_RECOVERY immediately after drift snap");
    assert(state.phaseTick === 103, "Phase tick should track current tick value");
}

function testClientApplyPhaseSettings() {
    var env = createPlayerClientEnv({ tickCounter: 200 });
    var client = env.client;

    client.applyPhaseSettings("INBOUND_WALK");
    assert(client.currentPhase === "INBOUND_WALK", "Client should record current phase");
    assert(client.disablePrediction === true, "Inbound walk should disable prediction");
    assert(Math.abs(client.currentReconciliationStrength - 1.0) < 0.0001, "Inbound walk should snap to authority");
    assert(client.inputTaperingActive === false, "Inbound walk should not activate tapering");

    client.applyPhaseSettings("POST_SNAP_RECOVERY");
    assert(client.currentPhase === "POST_SNAP_RECOVERY", "Phase should update to POST_SNAP_RECOVERY");
    assert(client.disablePrediction === false, "Post snap recovery keeps prediction enabled");
    assert(client.inputTaperingActive === true, "Post snap recovery should enable tapering");
    assert(client.inputTaperingFramesRemaining === (MP_CONSTANTS.GAME_PHASES.POST_SNAP_RECOVERY.taperingFrames || 0),
        "Tapering frames should match configuration");
    assert(Math.abs(client.inputTaperingFactor - (MP_CONSTANTS.GAME_PHASES.POST_SNAP_RECOVERY.taperingFactor || 0)) < 0.0001,
        "Tapering factor should match configuration");

    client.applyPhaseSettings("REBOUND_SCRAMBLE");
    assert(client.currentPhase === "REBOUND_SCRAMBLE", "Phase should update to REBOUND_SCRAMBLE");
    assert(client.disablePrediction === false, "Rebound scramble keeps prediction enabled");
    assert(Math.abs(client.currentReconciliationStrength - MP_CONSTANTS.GAME_PHASES.REBOUND_SCRAMBLE.reconciliationStrength) < 0.0001,
        "Rebound scramble strength should match constants");
    assert(client.inputTaperingActive === false, "Rebound scramble should disable tapering");
}

function testClientUpdateGameStateAppliesPhase() {
    var env = createPlayerClientEnv({ tickCounter: 300 });
    var client = env.client;
    client.updateGameState({ phase: "REBOUND_SCRAMBLE" });

    assert(client.currentPhase === "REBOUND_SCRAMBLE", "updateGameState should pass phase to applyPhaseSettings");
    assert(client.disablePrediction === false, "Rebound scramble keeps prediction enabled after update");
    assert(Math.abs(client.currentReconciliationStrength - MP_CONSTANTS.GAME_PHASES.REBOUND_SCRAMBLE.reconciliationStrength) < 0.0001,
        "Reconciliation strength should match phase constants");

    client.updateGameState({ phase: "INBOUND_WALK", ib: true });
    assert(client.currentPhase === "INBOUND_WALK", "Client should reflect inbound phase");
    assert(client.disablePrediction === true, "Inbound walk should disable prediction after update");
}

function runTests() {
    print("=== Multiplayer Phase System Tests ===\n");

    testSerializeGameStateIncludesPhase();
    print("✓ Phase serialized as NORMAL_PLAY by default");

    testInboundWalkPhase();
    print("✓ Inbound walk phase detected");

    testInboundReadyPhase();
    print("✓ Inbound ready phase detected");

    testReboundScramblePhase();
    print("✓ Rebound scramble phase detected");

    testPostSnapRecoveryPhase();
    print("✓ Post snap recovery phase detected");

    testClientApplyPhaseSettings();
    print("✓ Client phase settings applied correctly");

    testClientUpdateGameStateAppliesPhase();
    print("✓ Client updateGameState applies phase settings\n");

    print("All multiplayer phase system tests passed!\n");
}

runTests();

if (typeof originalExecDir === 'string') {
    try {
        Object.defineProperty(js, "exec_dir", {
            value: originalExecDir,
            configurable: true,
            writable: true
        });
    } catch (restoreError) {
        js.exec_dir = originalExecDir;
    }
}
