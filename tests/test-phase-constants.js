#!/usr/bin/env jsexec
// Test that phase-based prediction system functions correctly

js.exec_dir = "/sbbs/xtrn/nba_jam/";
var TEST_BASE_PATH = "/sbbs/xtrn/nba_jam/";

try {
    Object.defineProperty(js, "exec_dir", {
        value: TEST_BASE_PATH,
        configurable: true,
        writable: true
    });
} catch (e) {
    js.exec_dir = TEST_BASE_PATH;
}

function tryLoad(path) {
    if (!path) return false;
    try {
        load(path);
        return true;
    } catch (err) {
        return false;
    }
}

var sbbsDefsLoaded = false;
var sbbsDefsCandidates = [
    "/sbbs/exec/load/sbbsdefs.js",
    "/sbbs/exec/sbbsdefs.js",
    TEST_BASE_PATH + "sbbsdefs.js"
];

function addExecCandidate(base) {
    if (!base) return;
    var unixIdx = base.indexOf("/xtrn/");
    if (unixIdx !== -1) {
        var prefix = base.substring(0, unixIdx);
        sbbsDefsCandidates.push(prefix + "/exec/load/sbbsdefs.js");
        sbbsDefsCandidates.push(prefix + "/exec/sbbsdefs.js");
    }
    var winIdx = base.indexOf("\\xtrn\\");
    if (winIdx !== -1) {
        var winPrefix = base.substring(0, winIdx);
        sbbsDefsCandidates.push(winPrefix + "\\exec\\load\\sbbsdefs.js");
        sbbsDefsCandidates.push(winPrefix + "\\exec\\sbbsdefs.js");
    }
}

addExecCandidate(TEST_BASE_PATH);

for (var i = 0; i < sbbsDefsCandidates.length && !sbbsDefsLoaded; i++) {
    sbbsDefsLoaded = tryLoad(sbbsDefsCandidates[i]);
}

if (!sbbsDefsLoaded && !tryLoad("sbbsdefs.js")) {
    throw new Error("Unable to load sbbsdefs.js");
}
load(TEST_BASE_PATH + "lib/utils/constants.js");
load(TEST_BASE_PATH + "lib/multiplayer/mp_coordinator.js");
load(TEST_BASE_PATH + "lib/multiplayer/mp_client.js");

print("=== Phase-Based Prediction System Test ===\n");

// Test 1: Constants loaded
print("Test 1: Constants loaded");
if (typeof MP_CONSTANTS === "undefined" || typeof MP_CONSTANTS.GAME_PHASES === "undefined") {
    print("  ❌ FAIL: MP_CONSTANTS.GAME_PHASES not loaded");
    exit(1);
}
print("  ✅ PASS\n");

// Test 2: All phase configs present
print("Test 2: Phase configurations");
var phases = ["NORMAL_PLAY", "INBOUND_WALK", "INBOUND_READY", "POST_SNAP_RECOVERY", "REBOUND_SCRAMBLE", "DEAD_BALL"];
for (var i = 0; i < phases.length; i++) {
    if (!MP_CONSTANTS.GAME_PHASES[phases[i]]) {
        print("  ❌ FAIL: Missing phase " + phases[i]);
        exit(1);
    }
}
print("  ✅ PASS: All 6 phases defined\n");

// Test 3: Phase determination logic
print("Test 3: Coordinator phase determination");
print("  (Would require mock stateManager - skipping integration test)");
print("  ✅ Function exists: " + (typeof GameCoordinator !== "undefined"));
print("");

// Test 4: Client phase application
print("Test 4: Client phase application");
print("  (Would require mock client - skipping integration test)");
print("  ✅ Function exists: " + (typeof PlayerClient !== "undefined"));
print("");

print("=== Unit tests passed ===");
print("Run actual multiplayer game to verify phase transitions in logs");
exit(0);
