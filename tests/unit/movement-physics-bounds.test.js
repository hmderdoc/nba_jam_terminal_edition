#!/usr/bin/env jsexec
// Movement boundary recovery tests

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
}

if (typeof clamp !== "function") {
    clamp = function (value, min, max) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    };
}

load("lib/utils/constants.js");
load("lib/game-logic/movement-physics.js");

function createSprite(x, y) {
    return {
        x: x,
        y: y
    };
}

function testAllowsRecoveryFromRightEdge() {
    var maxMovementX = COURT_WIDTH - PLAYER_BOUNDARIES.movementMaxXOffset;
    var sprite = createSprite(maxMovementX + 2, 20);
    var preview = previewMovementCommand(sprite, KEY_LEFT);

    assert(preview.canMove === true, "Recovery move should be allowed");
    assert(preview.nextX === maxMovementX, "Recovery move should clamp to movement boundary");
    assert(preview.blockedByBounds === false, "Recovery move should not flag blockedByBounds");
}

function testBlocksFurtherRightEdgeTravel() {
    var maxMovementX = COURT_WIDTH - PLAYER_BOUNDARIES.movementMaxXOffset;
    var sprite = createSprite(maxMovementX + 2, 20);
    var preview = previewMovementCommand(sprite, KEY_RIGHT);

    assert(preview.canMove === false, "Moving farther out of bounds should be blocked");
    assert(preview.nextX === sprite.x, "Blocked move should keep current X");
    assert(preview.blockedByBounds === true, "Blocked move should flag blockedByBounds");
}

function testAllowsRecoveryFromLeftEdge() {
    var sprite = createSprite(PLAYER_BOUNDARIES.minX - 2, 18);
    var preview = previewMovementCommand(sprite, KEY_RIGHT);

    assert(preview.canMove === true, "Recovery from left edge should be allowed");
    assert(preview.nextX === PLAYER_BOUNDARIES.minX, "Recovery move should clamp to min boundary");
    assert(preview.blockedByBounds === false, "Recovery move should report not blocked");
}

function testBlocksLateralMoveWhenVerticalViolationPersists() {
    var sprite = createSprite(40, COURT_HEIGHT - PLAYER_BOUNDARIES.maxYOffset + 3);
    var preview = previewMovementCommand(sprite, KEY_LEFT);

    assert(preview.canMove === false, "Horizontal move should not resolve vertical violation");
    assert(preview.blockedByBounds === true, "Move preserving violation should be blocked");
}

function runTests() {
    testAllowsRecoveryFromRightEdge();
    testBlocksFurtherRightEdgeTravel();
    testAllowsRecoveryFromLeftEdge();
    testBlocksLateralMoveWhenVerticalViolationPersists();
    console.log("movement-physics-bounds: all tests passed");
}

try {
    runTests();
} finally {
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
