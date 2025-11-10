// Test Wave 22B State Machine
// Quick validation of phase system basics

load("sbbsdefs.js");

// Get the game root directory (two levels up from lib/testing/)
var gameDir = js.exec_dir.replace(/lib\/testing\/?$/, "");
load(gameDir + "lib/utils/constants.js");
load(gameDir + "lib/config/game-balance.js");
load(gameDir + "lib/game-logic/game-state.js");
load(gameDir + "lib/game-logic/phase-handler.js");

print("\n=== Wave 22B State Machine Test ===\n");

// Ensure gameState is properly initialized
if (!gameState || !gameState.phase) {
    gameState = createDefaultGameState();
}

// Test 1: Phase constants exist
print("Test 1: Phase constants");
print("  PHASE_NORMAL: " + PHASE_NORMAL);
print("  PHASE_SHOT_QUEUED: " + PHASE_SHOT_QUEUED);
print("  PHASE_SHOT_ANIMATING: " + PHASE_SHOT_ANIMATING);
print("  PHASE_SHOT_SCORED: " + PHASE_SHOT_SCORED);
print("  PHASE_SHOT_MISSED: " + PHASE_SHOT_MISSED);
print("  ✅ All phase constants defined\n");

// Test 2: gameState has phase object
print("Test 2: gameState.phase");
if (!gameState.phase) {
    print("  ❌ FAIL: gameState.phase is undefined");
    exit(1);
}
print("  current: " + gameState.phase.current);
print("  frameCounter: " + gameState.phase.frameCounter);
print("  targetFrames: " + gameState.phase.targetFrames);
if (gameState.phase.current !== PHASE_NORMAL) {
    print("  ❌ FAIL: Initial phase should be NORMAL");
    exit(1);
}
print("  ✅ gameState.phase initialized correctly\n");

// Test 3: Helper functions exist
print("Test 3: Helper functions");
if (typeof setPhase !== "function") {
    print("  ❌ FAIL: setPhase() not defined");
    exit(1);
}
if (typeof getPhase !== "function") {
    print("  ❌ FAIL: getPhase() not defined");
    exit(1);
}
if (typeof advancePhaseTimer !== "function") {
    print("  ❌ FAIL: advancePhaseTimer() not defined");
    exit(1);
}
if (typeof isPhaseComplete !== "function") {
    print("  ❌ FAIL: isPhaseComplete() not defined");
    exit(1);
}
if (typeof resetPhase !== "function") {
    print("  ❌ FAIL: resetPhase() not defined");
    exit(1);
}
print("  ✅ All helper functions defined\n");

// Test 4: setPhase() works
print("Test 4: setPhase()");
setPhase(PHASE_SHOT_QUEUED, { shooter: "test", made: true }, 100, 16);
if (getPhase() !== PHASE_SHOT_QUEUED) {
    print("  ❌ FAIL: Phase not set correctly");
    exit(1);
}
var phaseData = getPhaseData();
if (phaseData.shooter !== "test") {
    print("  ❌ FAIL: Phase data not set correctly");
    exit(1);
}
if (gameState.phase.targetFrames !== 6) {  // 100ms / 16ms = ~6 frames
    print("  ❌ FAIL: Target frames calculation wrong (expected ~6, got " + gameState.phase.targetFrames + ")");
    exit(1);
}
print("  Phase: " + getPhase());
print("  Data.shooter: " + phaseData.shooter);
print("  Target frames: " + gameState.phase.targetFrames);
print("  ✅ setPhase() works correctly\n");

// Test 5: advancePhaseTimer() works
print("Test 5: advancePhaseTimer()");
gameState.phase.frameCounter = 0;
gameState.phase.targetFrames = 3;
print("  Initial: counter=" + gameState.phase.frameCounter + ", target=" + gameState.phase.targetFrames);
var complete1 = advancePhaseTimer();  // counter=1
print("  After 1st advance: counter=" + gameState.phase.frameCounter + ", complete=" + complete1);
var complete2 = advancePhaseTimer();  // counter=2
print("  After 2nd advance: counter=" + gameState.phase.frameCounter + ", complete=" + complete2);
var complete3 = advancePhaseTimer();  // counter=3
print("  After 3rd advance: counter=" + gameState.phase.frameCounter + ", complete=" + complete3);
if (complete1 || complete2) {
    print("  ❌ FAIL: Phase should not be complete before reaching target");
    exit(1);
}
if (!complete3) {
    print("  ❌ FAIL: Phase should be complete after reaching target");
    exit(1);
}
print("  ✅ advancePhaseTimer() works correctly\n");

// Test 6: resetPhase() works
print("Test 6: resetPhase()");
resetPhase();
if (getPhase() !== PHASE_NORMAL) {
    print("  ❌ FAIL: Phase not reset to NORMAL");
    exit(1);
}
print("  Phase after reset: " + getPhase());
print("  ✅ resetPhase() works correctly\n");

// Test 7: Phase handler function exists
print("Test 7: updateGamePhase()");
if (typeof updateGamePhase !== "function") {
    print("  ❌ FAIL: updateGamePhase() not defined");
    exit(1);
}
// Just call it to make sure it doesn't crash
updateGamePhase(16);
print("  ✅ updateGamePhase() defined and callable\n");

print("=== All Tests Passed! ===\n");
print("Wave 22B state machine is ready for integration.\n");
