#!/usr/bin/env jsexec
// Multiplayer predictive turbo drain tests

load("sbbsdefs.js");
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

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

var basePath = js.exec_dir;
if (/tests\/(unit|integration)\/?$/.test(basePath)) {
    basePath = basePath.replace(/tests\/(unit|integration)\/?$/, "");
} else if (/tests\/?$/.test(basePath)) {
    basePath = basePath.replace(/tests\/?$/, "");
} else {
    var marker = "/tests/";
    var markerPos = basePath.indexOf(marker);
    if (markerPos !== -1) {
        basePath = basePath.substring(0, markerPos);
    }
    var winMarker = "\\tests\\";
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

if (typeof debugLog !== "function") {
    debugLog = function () { };
} else {
    debugLog = function () { };
}

if (typeof handleActionButton !== "function") {
    handleActionButton = function () { };
}

if (typeof getLatencyIndicator !== "function") {
    getLatencyIndicator = function () {
        return { text: "", color: "", bars: "" };
    };
}

if (typeof measureLatency !== "function") {
    measureLatency = function () { return 0; };
}

var root = (typeof global !== "undefined") ? global : this;
if (typeof root.Queue !== "function") {
    root.Queue = function () {
        this.data_waiting = false;
        this.poll = function () { };
        this.read = function () { return null; };
        this.write = function () { };
    };
}

load("lib/utils/constants.js");
load("lib/multiplayer/mp_client.js");

var fakeClient = {
    read: function () { return null; },
    write: function () { }
};

function createStateManager() {
    return {
        store: {},
        get: function (key) {
            return this.store.hasOwnProperty(key) ? this.store[key] : undefined;
        },
        set: function (key, value) {
            this.store[key] = value;
        }
    };
}

function createPlayerClient() {
    var systems = { stateManager: createStateManager() };
    var client = new PlayerClient(
        "test-session",
        fakeClient,
        "player1",
        { tuning: { stateUpdateInterval: 50 } },
        systems
    );
    client.setCoordinatorStatus(false);
    client.disablePrediction = false;
    client.authoritativeCatchupFrames = 0;
    return client;
}

function createSprite() {
    return {
        controlledBy: "player1",
        __mpHintLock: false,
        playerData: {
            name: "Player One",
            turboActive: true,
            useTurbo: function () { }
        }
    };
}

function approximatelyEqual(actual, expected, epsilon, message) {
    epsilon = epsilon || 1e-6;
    if (Math.abs(actual - expected) > epsilon) {
        throw new Error((message || "Values differ") + ": expected " + expected + ", got " + actual);
    }
}

function testPredictiveDrainFactorDefault() {
    var client = createPlayerClient();
    client.authoritativeCatchupFrames = 0;
    var factor = client._getPredictiveTurboDrainFactor();
    approximatelyEqual(factor, MP_CONSTANTS.PREDICTION.TURBO.DRAIN_FACTOR, 1e-9, "Default predictive factor");
}

function testPredictiveDrainFactorCatchup() {
    var client = createPlayerClient();
    client.authoritativeCatchupFrames = 3;
    var factor = client._getPredictiveTurboDrainFactor();
    approximatelyEqual(factor, MP_CONSTANTS.PREDICTION.TURBO.CATCHUP_FACTOR, 1e-9, "Catch-up predictive factor");
}

function testPredictiveDrainFactorCoordinatorOverride() {
    var client = createPlayerClient();
    client.setCoordinatorStatus(true);
    client.authoritativeCatchupFrames = 0;
    var factor = client._getPredictiveTurboDrainFactor();
    approximatelyEqual(factor, 1, 1e-9, "Coordinator should drain at full rate");
}

function testHandleInputUsesPredictiveDrain() {
    var client = createPlayerClient();
    client.authoritativeCatchupFrames = 0;
    var sprite = createSprite();
    var drains = [];
    sprite.playerData.useTurbo = function (amount) {
        drains.push(amount);
    };
    client.mySprite = sprite;
    client.handleInput('S', 120);

    assert(drains.length === 1, "Predictive drain should trigger once during handleInput");
    approximatelyEqual(
        drains[0],
        TURBO_DRAIN_RATE * MP_CONSTANTS.PREDICTION.TURBO.DRAIN_FACTOR,
        1e-9,
        "Predictive drain amount"
    );
}

function testHandleInputSuppressesDrainDuringCatchup() {
    var client = createPlayerClient();
    client.authoritativeCatchupFrames = 4;
    var sprite = createSprite();
    var drains = [];
    sprite.playerData.useTurbo = function (amount) {
        drains.push(amount);
    };
    client.mySprite = sprite;
    client.handleInput('S', 220);

    assert(drains.length === 0, "Predictive drain should be skipped during catch-up frames");
}

function runTests() {
    print("=== Multiplayer Predictive Turbo Tests ===\n");

    testPredictiveDrainFactorDefault();
    print("✓ Predictive factor defaults to configured drain factor");

    testPredictiveDrainFactorCatchup();
    print("✓ Predictive factor switches to catch-up factor when active");

    testPredictiveDrainFactorCoordinatorOverride();
    print("✓ Coordinators continue draining at full rate");

    testHandleInputUsesPredictiveDrain();
    print("✓ handleInput applies predictive drain scaling");

    testHandleInputSuppressesDrainDuringCatchup();
    print("✓ handleInput skips predictive drain during catch-up\n");

    print("All predictive turbo tests passed!\n");
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
