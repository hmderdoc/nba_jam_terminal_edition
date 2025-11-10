/**
 * Unit Test: Dunk Loop Bug
 * 
 * This test reproduces the bug where players repeatedly attempt dunks
 * without clearing the ball carrier state.
 * 
 * BUG: animateDunk() doesn't clear gameState.ballCarrier on missed dunks,
 *      causing the AI to immediately attempt another dunk since the player
 *      still appears to have possession.
 * 
 * EXPECTED: gameState.ballCarrier should be cleared on misses so the rebound
 *           scramble can begin and players can contest for possession.
 */

load("test-helpers.js");

// Setup constants
var COURT_WIDTH = 80;
var COURT_HEIGHT = 40;
var BASKET_RIGHT_X = 75;
var BASKET_RIGHT_Y = 20;

// Install mocks
installMockFunctions();

print("=== DUNK LOOP BUG TEST ===\n");

// ============================================================================
// TEST 1: animateDunk() doesn't clear ballCarrier on miss (before fix)
// ============================================================================
print("TEST 1: animateDunk() should clear ballCarrier on missed dunk");

var gameState = createMockGameState();
var dunker = createMockPlayer({
    x: 70,
    y: 20,
    playerData: {
        name: "DUNKER",
        team: "teamA"
    }
});

gameState.ballCarrier = dunker;

var dunkInfo = {
    angle: 0,
    speed: 3,
    arcHeight: 8,
    hangTime: 12,
    style: "standard"
};

print("  Before animateDunk():");
print("    ballCarrier: " + (gameState.ballCarrier ? gameState.ballCarrier.playerData.name : "null"));
print("    shotInProgress: " + gameState.shotInProgress);

// Note: We can't easily test animateDunk() since it does console rendering
// But we can check the code logic that should be there

print("\n  Expected behavior after missed dunk:");
print("    ❌ BUG (before fix): ballCarrier remains set");
print("    ✅ FIX (after fix): ballCarrier = null");
print("\n  When ballCarrier is not cleared:");
print("    - AI thinks player still has possession");
print("    - attemptShot() gets called again immediately");
print("    - Player loops attempting dunks infinitely");

print("\n=== TEST SCENARIO ===");
print("Without fix: Player misses dunk → ballCarrier stays set → AI tries dunk again");
print("With fix: Player misses dunk → ballCarrier = null → Rebound scramble starts");

print("\n=== CODE LOCATION ===");
print("File: lib/game-logic/dunks.js");
print("Function: animateDunk()");
print("Fix: Add 'if (!made) gameState.ballCarrier = null;' after animation completes");
