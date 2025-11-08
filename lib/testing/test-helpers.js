/**
 * Test Helpers and Mocking Infrastructure
 * 
 * Provides utilities for unit testing game logic in isolation
 */

// ============================================================================
// MOCK GAME STATE
// ============================================================================

function createMockGameState() {
    return {
        reboundActive: false,
        reboundX: 0,
        reboundY: 0,
        reboundScramble: {
            active: false,
            startTime: 0,
            reboundX: 0,
            reboundY: 0,
            maxDuration: 2000,
            bounceAnimComplete: false,
            anticipating: false,
            anticipatedX: 0,
            anticipatedY: 0
        },
        currentTeam: "teamA",
        ballCarrier: null,
        shotClock: 24,
        consecutivePoints: {
            teamA: 0,
            teamB: 0
        },
        shotInProgress: false,
        score: {
            teamA: 0,
            teamB: 0
        },
        activeBlock: null,
        blockJumpTimer: 0
    };
}

// ============================================================================
// MOCK PLAYER
// ============================================================================

function createMockPlayer(overrides) {
    var defaults = {
        x: 50,
        y: 30,
        playerData: {
            name: "TEST_PLAYER",
            team: "teamA",
            stats: {
                rebounds: 0,
                points: 0,
                fgm: 0,
                fga: 0,
                tpm: 0,
                tpa: 0,
                blocks: 0
            },
            hasDribble: false,
            turbo: 100,
            heatStreak: 0,
            fireMakeStreak: 0,
            onFire: false
        }
    };

    if (overrides) {
        for (var key in overrides) {
            if (key === "playerData" && overrides.playerData) {
                for (var pdKey in overrides.playerData) {
                    defaults.playerData[pdKey] = overrides.playerData[pdKey];
                }
            } else {
                defaults[key] = overrides[key];
            }
        }
    }

    return defaults;
}

// ============================================================================
// MOCK FUNCTIONS (No-ops unless overridden)
// ============================================================================

var mockFunctions = {
    getAllPlayers: function () { return []; },
    getPlayerTeamName: function (player) { return player.playerData.team; },
    distanceBetweenPoints: function (x1, y1, x2, y2) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },
    switchPossession: function () { },
    clamp: function (val, min, max) { return Math.max(min, Math.min(max, val)); },
    resetBackcourtState: function () { },
    triggerPossessionBeep: function () { },
    flushKeyboardBuffer: function () { },
    clearPotentialAssist: function () { },
    announceEvent: function () { },
    assignDefensiveMatchups: function () { },
    getPlayerGlobalId: function (player) { return "player_1"; },
    getSpriteDistance: function (a, b) {
        return mockFunctions.distanceBetweenPoints(a.x, a.y, b.x, b.y);
    },
    getEffectiveAttribute: function (playerData, attr) { return 5; },
    updateBallPosition: function () { },
    drawScore: function () { },
    setupInbound: function () { },
    startScoreFlash: function () { },
    clearTeamOnFire: function () { },
    setPlayerOnFire: function () { },
    maybeAwardAssist: function () { },
    getClosestPlayer: function () { return null; },
    isCornerThreePosition: function () { return false; },
    computeShotAnimationTiming: function () { return { durationMs: 500 }; },
    mswait: function () { },
    clampSpriteFeetToCourt: function () { },
    getCornerSpots: function () { return []; },
    animateShot: function () { return { made: false, blocked: false }; },
    animateDunk: function () { return { made: false, blocked: false }; },
    log: function () { },
    renderPlayerLabel: function () { }
};

function installMockFunctions() {
    for (var fnName in mockFunctions) {
        if (typeof global !== "undefined") {
            global[fnName] = mockFunctions[fnName];
        } else {
            this[fnName] = mockFunctions[fnName];
        }
    }
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error("Assertion failed: " + message + "\n  Expected: " + expected + "\n  Actual: " + actual);
    }
}

function assertTrue(condition, message) {
    if (!condition) {
        throw new Error("Assertion failed: " + message);
    }
}

function assertFalse(condition, message) {
    if (condition) {
        throw new Error("Assertion failed: " + message);
    }
}

// ============================================================================
// CALL TRACKING (for verifying function calls)
// ============================================================================

function createCallTracker() {
    var calls = [];

    return {
        track: function (fnName) {
            calls.push(fnName);
        },
        getCalls: function () {
            return calls.slice(); // Return copy
        },
        wasCalled: function (fnName) {
            return calls.indexOf(fnName) !== -1;
        },
        reset: function () {
            calls = [];
        }
    };
}

// ============================================================================
// EXPORTS (for load() system)
// ============================================================================

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        createMockGameState: createMockGameState,
        createMockPlayer: createMockPlayer,
        installMockFunctions: installMockFunctions,
        assertEqual: assertEqual,
        assertTrue: assertTrue,
        assertFalse: assertFalse,
        createCallTracker: createCallTracker
    };
}
