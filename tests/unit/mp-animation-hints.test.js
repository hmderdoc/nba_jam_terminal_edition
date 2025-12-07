#!/usr/bin/env jsexec
// Multiplayer animation hint integration tests

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

// Minimal stubs required by multiplayer client
var root = (typeof global !== "undefined") ? global : this;

if (typeof Queue !== "function") {
    function Queue() {
        this.data_waiting = false;
        this.poll = function () { };
        this.read = function () { return null; };
        this.write = function () { };
    }
    root.Queue = Queue;
}

if (typeof debugLog !== "function") {
    root.debugLog = function () { };
} else {
    root.debugLog = debugLog;
}

if (typeof log !== "function") {
    root.log = function () { };
} else {
    root.log = log;
}

if (typeof getLatencyIndicator !== "function") {
    root.getLatencyIndicator = function () {
        return { text: "", color: "", bars: "" };
    };
} else {
    root.getLatencyIndicator = getLatencyIndicator;
}

if (typeof measureLatency !== "function") {
    root.measureLatency = function () { return 0; };
} else {
    root.measureLatency = measureLatency;
}

// Global constants used by the modules we load
var MP_CONSTANTS = {
    PING_INTERVAL_MS: 3600000,
    TUNING_PRESETS: { interbbs: {} },
    ANIMATION_HINTS: {
        TTL_FRAMES: 6
    }
};

// Track knockBack invocations
var knockBackCalls = [];
function knockBack(player, source, maxDistance) {
    knockBackCalls.push({ player: player, source: source, maxDistance: maxDistance });
    if (player && typeof player.moveTo === "function") {
        player.moveTo(player.x, player.y);
    }
}

aob = (typeof global !== "undefined") ? global : this;
aob.knockBack = knockBack;
aob.MP_CONSTANTS = MP_CONSTANTS;

aob.Queue = Queue;
aob.debugLog = root.debugLog;
aob.log = root.log;
aob.getLatencyIndicator = root.getLatencyIndicator;
aob.measureLatency = root.measureLatency;

aob.Date = Date;

aob.Math = Math;

load(js.exec_dir + "lib/multiplayer/mp_client.js");

function createSprite(id) {
    return {
        id: id,
        x: 10,
        y: 20,
        moveTo: function (nx, ny) {
            this.x = nx;
            this.y = ny;
        },
        playerData: {}
    };
}

var fakeClient = {
    write: function () { },
    read: function () { return null; }
};

var systems = {};
var playerClient = new PlayerClient("test-session", fakeClient, 7, {}, systems);
playerClient.setCoordinatorStatus(false);

var victimSprite = createSprite(101);
var attackerSprite = createSprite(202);

playerClient.setSpriteMap({
    101: victimSprite,
    202: attackerSprite
});

var hintEntries = [{
    type: "shove_knockback",
    target: 101,
    ttl: 4,
    meta: {
        attackerId: 202,
        pushDistance: 18
    }
}];

playerClient.applyAnimationHints(hintEntries, 120);

assert(knockBackCalls.length === 1, "Expected knockBack to be invoked for shove hint");
assert(knockBackCalls[0].player === victimSprite, "Victim sprite mismatch");
assert(knockBackCalls[0].source === attackerSprite, "Attacker sprite mismatch");
assert(knockBackCalls[0].maxDistance === 18, "Knockback distance mismatch");

// Applying the same hint should not trigger a second animation until it reappears
playerClient.applyAnimationHints([], 121);
assert(knockBackCalls.length === 1, "Hint should not replay once processed");

console.print("PASS mp-animation-hints");

try {
    Object.defineProperty(js, "exec_dir", {
        value: originalExecDir,
        configurable: true,
        writable: true
    });
} catch (resetErr) {
    js.exec_dir = originalExecDir;
}
