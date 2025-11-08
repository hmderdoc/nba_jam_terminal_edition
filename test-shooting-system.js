/**
 * Wave 23: Shooting System Tests
 * Run with: jsexec test-shooting-system.js
 */

// Mock console for Synchronet
if (typeof console === "undefined") {
    console = {
        log: function () {
            var args = Array.prototype.slice.call(arguments);
            print(args.join(" "));
        }
    };
}

// Mock Synchronet log function
if (typeof log === "undefined") {
    log = function (level, msg) {
        console.log("[" + level + "] " + msg);
    };
    LOG_DEBUG = 7;
    LOG_ERR = 3;
}

// Load dependencies
load("lib/core/state-manager.js");
load("lib/core/event-bus.js");
load("lib/systems/shooting-system.js");

// Test counter
var testCount = 0;
var passCount = 0;

function assert(condition, message) {
    testCount++;
    if (!condition) {
        console.log("✗ FAIL: " + message);
        throw new Error("Assertion failed: " + message);
    } else {
        passCount++;
        console.log("  ✓ " + message);
    }
}

// Mock helpers
function createMockHelpers() {
    return {
        getPlayerTeamName: function (player) {
            return player._teamName || "teamA";
        },
        calculateDistance: function (x1, y1, x2, y2) {
            var dx = x2 - x1;
            var dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        },
        getSpriteDistance: function (sprite1, sprite2) {
            return this.calculateDistance(sprite1.x, sprite1.y, sprite2.x, sprite2.y);
        },
        getEffectiveAttribute: function (playerData, attr) {
            if (!playerData || !playerData.attributes) return 5;
            return playerData.attributes[attr] || 5;
        },
        getBaseAttribute: function (playerData, attr) {
            if (!playerData || !playerData.attributes) return 5;
            return playerData.attributes[attr] || 5;
        },
        getOpposingTeamSprites: function (teamName) {
            return [];
        },
        getTeamSprites: function (teamName) {
            return [];
        },
        getClosestPlayer: function (x, y, players) {
            if (!players || players.length === 0) return null;
            var closest = players[0];
            var closestDist = this.calculateDistance(x, y, closest.x, closest.y);
            for (var i = 1; i < players.length; i++) {
                var dist = this.calculateDistance(x, y, players[i].x, players[i].y);
                if (dist < closestDist) {
                    closest = players[i];
                    closestDist = dist;
                }
            }
            return closest;
        },
        clampSpriteFeetToCourt: function (player) {
            // No-op for testing
        },
        updateBallPosition: function () {
            // No-op for testing
        },
        getCornerSpots: function (teamName) {
            return {
                top: { x: 10, y: 5 },
                bottom: { x: 10, y: 35 }
            };
        },
        evaluateDunkOpportunity: function (player, team, targetX, targetY, distance) {
            // Return dunk info if close enough
            if (distance < 8) {
                return {
                    canDunk: true,
                    distance: distance,
                    style: "normal"
                };
            }
            return null;
        },
        calculateDunkChance: function (playerData, dunkInfo, defender, team) {
            return 75; // Default dunk chance
        },
        setPhase: function (phaseName, data, delay) {
            // Mock phase setter
        },
        activateAITurbo: function (player, strength, distance) {
            // Mock AI turbo
        },
        attemptBlock: function (player, options) {
            // Mock block attempt
        },
        broadcastMultiplayerEvent: function (eventType, data) {
            // Mock multiplayer broadcast
        },
        getPlayerGlobalId: function (player) {
            return player.id || "player_1";
        }
    };
}

// Mock animations
function createMockAnimations() {
    return {
        autoContestShot: function (shooter, targetX, targetY) {
            // No-op for testing
        },
        animateShotArc: function (options) {
            // Return mock result
            return {
                blocked: false,
                deflectionX: null,
                deflectionY: null
            };
        },
        flashBasket: function (x, y) {
            // No-op for testing
        }
    };
}

// Mock rules
function createMockRules() {
    return {
        COURT_WIDTH: 66,
        COURT_HEIGHT: 40,
        THREE_POINT_RADIUS: 19,
        BASKET_RIGHT_X: 64,
        BASKET_RIGHT_Y: 20,
        BASKET_LEFT_X: 2,
        BASKET_LEFT_Y: 20,
        BLOCK_JUMP_DURATION: 12,
        SHOOTING: {
            VERY_TIGHT_DEFENSE_DISTANCE: 4,
            TIGHT_DEFENSE_DISTANCE: 6,
            MODERATE_DEFENSE_DISTANCE: 10,
            BLOCK_ATTEMPT_DISTANCE: 12,
            BLOCK_CLOSE_BONUS_DISTANCE: 5,
            RIM_BONUS_DISTANCE: 8,
            RIM_BONUS_PROBABILITY: 0.4
        }
    };
}

// Create mock player
function createMockPlayer(x, y, attributes, teamName) {
    return {
        x: x,
        y: y,
        _teamName: teamName || "teamA",
        playerData: {
            name: "Test Player",
            attributes: attributes || {
                "dunk": 5,
                "3pt": 5,
                "block": 5
            },
            stats: {
                fga: 0,
                tpa: 0,
                dunkAttempts: 0
            },
            hasDribble: true,
            heatStreak: 0,
            onFire: false
        }
    };
}

function testSystemCreation() {
    console.log("\n=== Test 1: System Creation ===");
    
    var state = createStateManager({ shotInProgress: false });
    var events = createEventBus();
    var animations = createMockAnimations();
    var rules = createMockRules();
    var helpers = createMockHelpers();
    
    var system = createShootingSystem({
        state: state,
        events: events,
        animations: animations,
        rules: rules,
        helpers: helpers
    });
    
    assert(typeof system.calculateShotProbability === "function", "Should have calculateShotProbability");
    assert(typeof system.attemptShot === "function", "Should have attemptShot");
    assert(typeof system.animateShot === "function", "Should have animateShot");
    assert(typeof system.autoContestShot === "function", "Should have autoContestShot");
    assert(typeof system.isCornerThreePosition === "function", "Should have isCornerThreePosition");
}

function testShotProbabilityCalculation() {
    console.log("\n=== Test 2: Shot Probability Calculation ===");
    
    var state = createStateManager({});
    var events = createEventBus();
    var animations = createMockAnimations();
    var rules = createMockRules();
    var helpers = createMockHelpers();
    
    var system = createShootingSystem({
        state: state,
        events: events,
        animations: animations,
        rules: rules,
        helpers: helpers
    });
    
    // Test close range shot (high probability)
    var shooter = createMockPlayer(60, 20, { "dunk": 8, "3pt": 5, "block": 5 });
    var prob1 = system.calculateShotProbability(shooter, 64, 20, null);
    assert(prob1 > 60, "Close range shot should have high probability: " + prob1);
    
    // Test long range shot (lower probability)
    var shooter2 = createMockPlayer(40, 20, { "dunk": 5, "3pt": 8, "block": 5 });
    var prob2 = system.calculateShotProbability(shooter2, 64, 20, null);
    assert(prob2 < prob1, "Long range shot should have lower probability than close range");
    
    // Test with tight defense
    var defender = createMockPlayer(61, 20, { "dunk": 5, "3pt": 5, "block": 8 });
    var prob3 = system.calculateShotProbability(shooter, 64, 20, defender);
    assert(prob3 < prob1, "Tight defense should reduce probability");
}

function testCornerThreeDetection() {
    console.log("\n=== Test 3: Corner Three Detection ===");
    
    var state = createStateManager({});
    var events = createEventBus();
    var animations = createMockAnimations();
    var rules = createMockRules();
    var helpers = createMockHelpers();
    
    var system = createShootingSystem({
        state: state,
        events: events,
        animations: animations,
        rules: rules,
        helpers: helpers
    });
    
    // Test corner position
    var cornerPlayer = createMockPlayer(10, 5, {}, "teamA");
    var isCorner = system.isCornerThreePosition(cornerPlayer, "teamA");
    assert(isCorner === true, "Should detect corner three position");
    
    // Test non-corner position
    var midPlayer = createMockPlayer(30, 20, {}, "teamA");
    var isNotCorner = system.isCornerThreePosition(midPlayer, "teamA");
    assert(isNotCorner === false, "Should not detect corner three for mid-court");
}

function testShotAttemptValidation() {
    console.log("\n=== Test 4: Shot Attempt Validation ===");
    
    var state = createStateManager({
        shotInProgress: false,
        ballX: 30,
        ballY: 20,
        currentTeam: "teamA"
    });
    var events = createEventBus();
    var animations = createMockAnimations();
    var rules = createMockRules();
    var helpers = createMockHelpers();
    
    var system = createShootingSystem({
        state: state,
        events: events,
        animations: animations,
        rules: rules,
        helpers: helpers
    });
    
    // Test normal shot attempt
    var shooter = createMockPlayer(30, 20, { "dunk": 5, "3pt": 7, "block": 5 }, "teamA");
    var result = system.attemptShot(shooter);
    assert(result.success === true, "Should allow normal shot attempt");
    assert(result.attemptType === "shot" || result.attemptType === "dunk", "Should have attempt type");
    
    // Test duplicate shot prevention
    state.set("shotInProgress", true);
    var result2 = system.attemptShot(shooter);
    assert(result2.success === false, "Should prevent duplicate shot");
    assert(result2.reason === "shot_in_progress", "Should have correct reason");
}

function testOutOfBoundsShotPrevention() {
    console.log("\n=== Test 5: Out of Bounds Shot Prevention ===");
    
    var state = createStateManager({
        shotInProgress: false,
        ballX: 1,
        ballY: 1,
        currentTeam: "teamA"
    });
    var events = createEventBus();
    var animations = createMockAnimations();
    var rules = createMockRules();
    var helpers = createMockHelpers();
    
    var system = createShootingSystem({
        state: state,
        events: events,
        animations: animations,
        rules: rules,
        helpers: helpers
    });
    
    // Test out of bounds shot (x = 1, margin = 2)
    var shooter = createMockPlayer(1, 1, { "dunk": 5, "3pt": 5, "block": 5 }, "teamA");
    var result = system.attemptShot(shooter);
    assert(result.success === false, "Should prevent out of bounds shot");
    assert(result.reason === "out_of_bounds", "Should have correct reason");
}

function test3PointerDetection() {
    console.log("\n=== Test 6: 3-Pointer Detection ===");
    
    var state = createStateManager({
        shotInProgress: false,
        ballX: 40,
        ballY: 20,
        currentTeam: "teamA"
    });
    var events = createEventBus();
    var animations = createMockAnimations();
    var rules = createMockRules();
    var helpers = createMockHelpers();
    
    var shotAttempts = [];
    events.on("shot_attempt", function (data) {
        shotAttempts.push(data);
    });
    
    var system = createShootingSystem({
        state: state,
        events: events,
        animations: animations,
        rules: rules,
        helpers: helpers
    });
    
    // Test 3-pointer (far from basket)
    var shooter = createMockPlayer(40, 20, { "dunk": 5, "3pt": 8, "block": 5 }, "teamA");
    var result = system.attemptShot(shooter);
    
    assert(shotAttempts.length > 0, "Should emit shot_attempt event");
    var attemptData = shotAttempts[0];
    assert(attemptData.is3Pointer === true, "Should detect 3-pointer");
    
    // Verify stats updated
    assert(shooter.playerData.stats.fga === 1, "Should increment FGA");
    assert(shooter.playerData.stats.tpa === 1, "Should increment 3PA");
}

function testDunkDetection() {
    console.log("\n=== Test 7: Dunk Detection ===");
    
    var state = createStateManager({
        shotInProgress: false,
        ballX: 62,
        ballY: 20,
        currentTeam: "teamA"
    });
    var events = createEventBus();
    var animations = createMockAnimations();
    var rules = createMockRules();
    var helpers = createMockHelpers();
    
    var shotAttempts = [];
    events.on("shot_attempt", function (data) {
        shotAttempts.push(data);
    });
    
    var system = createShootingSystem({
        state: state,
        events: events,
        animations: animations,
        rules: rules,
        helpers: helpers
    });
    
    // Test dunk (very close to basket)
    var dunker = createMockPlayer(62, 20, { "dunk": 9, "3pt": 3, "block": 5 }, "teamA");
    var result = system.attemptShot(dunker);
    
    assert(shotAttempts.length > 0, "Should emit shot_attempt event");
    var attemptData = shotAttempts[0];
    assert(attemptData.attemptType === "dunk", "Should detect dunk attempt");
    assert(attemptData.is3Pointer === false, "Dunk should not be 3-pointer");
    
    // Verify dunk stats updated
    assert(dunker.playerData.stats.dunkAttempts === 1, "Should increment dunk attempts");
}

function testShotAnimation() {
    console.log("\n=== Test 8: Shot Animation ===");
    
    var state = createStateManager({
        shotInProgress: false
    });
    var events = createEventBus();
    var animations = createMockAnimations();
    var rules = createMockRules();
    var helpers = createMockHelpers();
    
    var system = createShootingSystem({
        state: state,
        events: events,
        animations: animations,
        rules: rules,
        helpers: helpers
    });
    
    var shooter = createMockPlayer(30, 20, { "dunk": 5, "3pt": 7, "block": 5 }, "teamA");
    
    // Test successful shot animation
    var result = system.animateShot(30, 20, 64, 20, true, shooter);
    assert(result.made === true, "Should return made shot");
    assert(result.blocked === false, "Should not be blocked");
    assert(state.get("shotInProgress") === false, "Should clear shotInProgress after animation");
}

function testBlockedShot() {
    console.log("\n=== Test 9: Blocked Shot ===");
    
    var state = createStateManager({
        shotInProgress: false
    });
    var events = createEventBus();
    
    // Mock animations that returns blocked shot
    var animations = {
        autoContestShot: function () {},
        animateShotArc: function (options) {
            return {
                blocked: true,
                deflectionX: 32,
                deflectionY: 22
            };
        },
        flashBasket: function () {}
    };
    var rules = createMockRules();
    var helpers = createMockHelpers();
    
    var system = createShootingSystem({
        state: state,
        events: events,
        animations: animations,
        rules: rules,
        helpers: helpers
    });
    
    var shooter = createMockPlayer(30, 20, {}, "teamA");
    
    // Test blocked shot
    var result = system.animateShot(30, 20, 64, 20, true, shooter);
    assert(result.made === false, "Blocked shot should not be made");
    assert(result.blocked === true, "Should return blocked = true");
    assert(result.deflectionX === 32, "Should return deflection X");
    assert(result.deflectionY === 22, "Should return deflection Y");
}

function testHotStreakBonus() {
    console.log("\n=== Test 10: Hot Streak Bonus ===");
    
    var state = createStateManager({
        shotInProgress: false,
        ballX: 40,
        ballY: 20,
        currentTeam: "teamA"
    });
    var events = createEventBus();
    var animations = createMockAnimations();
    var rules = createMockRules();
    var helpers = createMockHelpers();
    
    var shotAttempts = [];
    events.on("shot_attempt", function (data) {
        shotAttempts.push(data);
    });
    
    var system = createShootingSystem({
        state: state,
        events: events,
        animations: animations,
        rules: rules,
        helpers: helpers
    });
    
    // Test normal player
    var normalPlayer = createMockPlayer(40, 20, { "dunk": 5, "3pt": 5, "block": 5 }, "teamA");
    normalPlayer.playerData.heatStreak = 0;
    system.attemptShot(normalPlayer);
    var normalChance = shotAttempts[0].chance;
    
    // Test hot player
    shotAttempts = [];
    // Create new event bus instead of trying to clear
    events = createEventBus();
    events.on("shot_attempt", function (data) {
        shotAttempts.push(data);
    });
    
    var hotPlayer = createMockPlayer(40, 20, { "dunk": 5, "3pt": 5, "block": 5 }, "teamA");
    hotPlayer.playerData.heatStreak = 3;
    
    // Need to recreate system with new event bus
    var hotState = createStateManager({
        shotInProgress: false,
        ballX: 40,
        ballY: 20,
        currentTeam: "teamA"
    });
    var hotSystem = createShootingSystem({
        state: hotState,
        events: events,
        animations: animations,
        rules: rules,
        helpers: helpers
    });
    hotSystem.attemptShot(hotPlayer);
    var hotChance = shotAttempts[0].chance;
    
    assert(hotChance > normalChance, "Hot streak should increase shot chance");
}

// Run all tests
function runAllTests() {
    console.log("=== Wave 23: Shooting System Tests ===");
    console.log("Running tests...\n");
    
    try {
        testSystemCreation();
        testShotProbabilityCalculation();
        testCornerThreeDetection();
        testShotAttemptValidation();
        testOutOfBoundsShotPrevention();
        test3PointerDetection();
        testDunkDetection();
        testShotAnimation();
        testBlockedShot();
        testHotStreakBonus();
        
        console.log("\n=== All Tests Passed! ===");
        console.log("Tests run: " + testCount);
        console.log("Tests passed: " + passCount);
        console.log("Success rate: 100%");
    } catch (e) {
        console.log("\n=== Tests Failed ===");
        console.log("Error: " + e.message);
        console.log("Tests run: " + testCount);
        console.log("Tests passed: " + passCount);
        console.log("Success rate: " + Math.round((passCount / testCount) * 100) + "%");
        throw e;
    }
}

// Run tests if executed directly
runAllTests();
