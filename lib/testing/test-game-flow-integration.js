/**
 * Integration Test: Real Game Flow Simulation
 * 
 * This test simulates the ACTUAL game flow to see what path is taken
 * We need to determine if we're hitting the coordinator path or single-player path
 */

load("test-helpers.js");

// Setup constants
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

// Mock functions with tracking
var callLog = [];

function trackCall(name) {
    callLog.push(name);
}

var mockFunctionsWithTracking = {
    getAllPlayers: function() { return []; },
    getPlayerTeamName: function(player) { return player.playerData.team; },
    distanceBetweenPoints: function(x1, y1, x2, y2) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },
    switchPossession: function() { trackCall("switchPossession"); },
    clamp: function(val, min, max) { return Math.max(min, Math.min(max, val)); },
    resetBackcourtState: function() {},
    triggerPossessionBeep: function() {},
    flushKeyboardBuffer: function() {},
    clearPotentialAssist: function() {},
    announceEvent: function() { trackCall("announceEvent"); },
    assignDefensiveMatchups: function() {},
    getPlayerGlobalId: function(player) { return "player_1"; },
    getSpriteDistance: function(a, b) { 
        return mockFunctionsWithTracking.distanceBetweenPoints(a.x, a.y, b.x, b.y);
    },
    getEffectiveAttribute: function(playerData, attr) { return 5; },
    updateBallPosition: function() {},
    drawScore: function() {},
    setupInbound: function() { trackCall("setupInbound"); },
    startScoreFlash: function() {},
    clearTeamOnFire: function() {},
    setPlayerOnFire: function() {},
    maybeAwardAssist: function() {},
    getClosestPlayer: function() { return null; },
    isCornerThreePosition: function() { return false; },
    computeShotAnimationTiming: function() { return { durationMs: 500 }; },
    mswait: function() {},
    clampSpriteFeetToCourt: function() {},
    log: function() {},
    renderPlayerLabel: function() {},
    getCornerSpots: function() { return []; },
    animateShot: function(startX, startY, targetX, targetY, made) {
        trackCall("animateShot");
        return { made: Math.random() > 0.5, blocked: false };
    }
};

// Install mocks
for (var fnName in mockFunctionsWithTracking) {
    this[fnName] = mockFunctionsWithTracking[fnName];
}

var spriteRegistry = {
    getByTeam: function() { return []; }
};

// Load modules
load("../config/game-balance.js");
load("../game-logic/rebounds.js");
load("../game-logic/dunks.js");

print("=== GAME FLOW INTEGRATION TEST ===\n");

// ============================================================================
// TEST 1: What happens in ACTUAL single-player game?
// ============================================================================
print("TEST 1: Single-player jump shot flow (mpCoordinator = null)");

var gameState = createMockGameState();
var shooter = createMockPlayer({
    x: 60,
    y: 25,
    playerData: {
        name: "SHOOTER",
        team: "teamA"
    }
});

gameState.ballCarrier = shooter;

// Single-player mode - no coordinator
var mpCoordinator = null;
var animationSystem = null;

callLog = [];

print("  mpCoordinator: " + mpCoordinator);
print("  gameState.ballCarrier: " + (gameState.ballCarrier ? gameState.ballCarrier.playerData.name : "null"));

// Now try to load and call attemptShot
try {
    load("../game-logic/shooting.js");
    
    print("\n  Calling attemptShot()...");
    
    // Force miss
    var origRandom = Math.random;
    Math.random = function() { return 0.99; };
    
    attemptShot();
    
    Math.random = origRandom;
    
    print("\n  After attemptShot():");
    print("    ballCarrier: " + (gameState.ballCarrier ? gameState.ballCarrier.playerData.name : "null"));
    print("    reboundActive: " + gameState.reboundActive);
    print("    reboundScramble.active: " + gameState.reboundScramble.active);
    print("\n  Function calls made:");
    for (var i = 0; i < callLog.length; i++) {
        print("    - " + callLog[i]);
    }
    
    if (gameState.reboundScramble.active) {
        print("\n  ✅ Rebound scramble activated correctly!");
    } else {
        print("\n  ❌ BUG: Rebound scramble NOT activated!");
    }
    
} catch (e) {
    print("  ERROR: " + e);
    print("  Stack: " + (e.stack || "no stack"));
}

print("\n=== TEST COMPLETE ===");
