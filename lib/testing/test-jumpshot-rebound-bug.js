/**
 * Unit Test: Jump Shot Rebound Path (Multiplayer Coordinator)
 * 
 * This test reproduces the bug where jump shots in multiplayer coordinator mode
 * never trigger rebound scrambles, causing 24-second violations.
 * 
 * BUG: executeShot() sets gameState.reboundActive = true but doesn't call createRebound()
 *      The coordinator path in attemptShot() checks "if (!gameState.reboundActive)" which
 *      is now FALSE, so it skips calling createRebound(). This is backwards logic.
 * 
 * EXPECTED: createRebound() should be called after every missed shot to activate
 *           the scramble state and allow players to contest the rebound.
 */

load("test-helpers.js");

// Setup constants needed by game logic
var COURT_WIDTH = 80;
var COURT_HEIGHT = 40;
var ATTR_POWER = 4;
var ATTR_3PT = 3;
var ATTR_DUNK = 2;
var ATTR_BLOCK = 5;
var THREE_POINT_RADIUS = 20;
var BASKET_LEFT_X = 5;
var BASKET_LEFT_Y = 20;
var BASKET_RIGHT_X = 75;
var BASKET_RIGHT_Y = 20;
var MAX_TURBO = 100;

// Install mock functions
installMockFunctions();

// Create mock sprite registry
var spriteRegistry = {
    getByTeam: function() { return []; }
};

// Load the modules we're testing
load("../config/game-balance.js");
load("../game-logic/rebounds.js");
load("../game-logic/dunks.js");

print("=== JUMP SHOT REBOUND BUG TEST ===\n");

// ============================================================================
// TEST 1: executeShot() behavior on miss
// ============================================================================
print("TEST 1: executeShot() sets reboundActive but doesn't call createRebound()");

var gameState = createMockGameState();
var shooter = createMockPlayer({
    x: 60,
    y: 25,
    playerData: {
        name: "SHOOTER",
        team: "teamA",
        stats: {
            rebounds: 0,
            points: 0,
            fgm: 0,
            fga: 0
        },
        turbo: 100,
        heatStreak: 0,
        fireMakeStreak: 0,
        onFire: false
    }
});

// Mock coordinator (this triggers the bug path)
var mpCoordinator = {
    isCoordinator: true,
    broadcastEvent: function() {},
    broadcastGameState: function() {}
};

var animationSystem = {
    queueShotAnimation: function() {},
    queueReboundAnimation: function() {}
};

// Force a miss by setting random high (above chance threshold)
var originalRandom = Math.random;
Math.random = function() { return 0.99; }; // Forces miss (99% > typical shot chance)

print("  Before executeShot():");
print("    reboundActive: " + gameState.reboundActive);
print("    reboundScramble.active: " + gameState.reboundScramble.active);

var result = executeShot(shooter, 60, 25, BASKET_RIGHT_X, BASKET_RIGHT_Y);

print("  After executeShot():");
print("    result.made: " + result.made);
print("    reboundActive: " + gameState.reboundActive);
print("    reboundScramble.active: " + gameState.reboundScramble.active);

Math.random = originalRandom; // Restore

assertTrue(!result.made, "Shot should have missed");
assertTrue(gameState.reboundActive, "reboundActive should be set");
assertFalse(gameState.reboundScramble.active, "❌ BUG: reboundScramble.active is false - executeShot() didn't call createRebound()!");

print("  ✅ Bug reproduced: executeShot() sets reboundActive but not reboundScramble.active\n");

// ============================================================================
// TEST 2: Simulating the coordinator path logic
// ============================================================================
print("TEST 2: Coordinator path logic with current (buggy) code");

gameState = createMockGameState();
shooter = createMockPlayer({ x: 60, y: 25 });

// Simulate what happens in shooting.js lines 528-547
Math.random = function() { return 0.99; }; // Force miss
var shotResult = executeShot(shooter, 60, 25, BASKET_RIGHT_X, BASKET_RIGHT_Y);
Math.random = originalRandom;

print("  After executeShot():");
print("    shotResult.made: " + shotResult.made);
print("    gameState.reboundActive: " + gameState.reboundActive);

// This is the buggy condition from shooting.js line 545
var wouldCallCreateRebound = !gameState.reboundActive;

print("  Buggy condition: if (!gameState.reboundActive)");
print("    Evaluates to: " + wouldCallCreateRebound);
print("    createRebound() would be called: " + wouldCallCreateRebound);

assertFalse(wouldCallCreateRebound, "❌ BUG CONFIRMED: Condition prevents createRebound() call!");

print("  ✅ Bug confirmed: Logic is inverted\n");

// ============================================================================
// TEST 3: What the fix should be
// ============================================================================
print("TEST 3: Demonstrating the fix");

gameState = createMockGameState();
shooter = createMockPlayer({ x: 60, y: 25 });

Math.random = function() { return 0.99; };
shotResult = executeShot(shooter, 60, 25, BASKET_RIGHT_X, BASKET_RIGHT_Y);
Math.random = originalRandom;

print("  After executeShot():");
print("    reboundActive: " + gameState.reboundActive);
print("    reboundScramble.active: " + gameState.reboundScramble.active);

// The fix: unconditionally call createRebound() on miss
print("  Calling createRebound() unconditionally...");
createRebound(BASKET_RIGHT_X, BASKET_RIGHT_Y);

print("  After createRebound():");
print("    reboundActive: " + gameState.reboundActive);
print("    reboundScramble.active: " + gameState.reboundScramble.active);

assertTrue(gameState.reboundScramble.active, "✅ FIX WORKS: reboundScramble.active is now true!");

print("\n=== TEST COMPLETE ===");
print("BUG: Line 545 of shooting.js has inverted logic");
print("  Current: if (!gameState.reboundActive) createRebound(...)");
print("  Fixed:   createRebound(...) // Unconditional call");
print("\nThe condition checked if reboundActive was FALSE, but executeShot()");
print("sets it to TRUE on miss, so createRebound() never gets called.");
