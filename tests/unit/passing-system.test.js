// Passing System Tests
// Run with: jsexec lib/systems/__tests__/passing-system.test.js

// Mock console for Synchronet
if (typeof console === "undefined") {
    console = {
        log: function () {
            var args = Array.prototype.slice.call(arguments);
            print(args.join(" "));
        }
    };
}

// Determine base path - go up from __tests__ directory
var basePath = js.exec_dir.replace(/lib\/systems\/__tests__\/?$/, "");

// Load dependencies
load(basePath + "lib/core/state-manager.js");
load(basePath + "lib/core/event-bus.js");
load(basePath + "lib/systems/passing-system.js");

function runTests() {
    console.log("=== Passing System Tests ===\n");

    testPassingSystemCreation();
    testSuccessfulPass();
    testOutOfBoundsPass();
    testPassTiming();
    testInboundPass();

    console.log("\n✓ All passing system tests passed!");
}

function testPassingSystemCreation() {
    console.log("Test: System creation with dependencies");

    var mockState = createStateManager({});
    var mockEvents = createEventBus();
    var mockAnimations = {
        queuePassAnimation: function () { }
    };

    var system = createPassingSystem({
        state: mockState,
        animations: mockAnimations,
        events: mockEvents,
        rules: { COURT_WIDTH: 66, COURT_HEIGHT: 40 },
        helpers: {
            getPlayerTeamName: function (p) { return p.team; }
        }
    });

    assert(system !== null, "Should create passing system");
    assert(typeof system.attemptPass === 'function', "Should have attemptPass method");

    console.log("  ✓ System created successfully");
}

function testSuccessfulPass() {
    console.log("\nTest: Successful pass");

    var mockState = createStateManager({
        ballCarrier: null,
        currentTeam: 'teamA'
    });

    var animationQueued = false;
    var mockAnimations = {
        queuePassAnimation: function (sx, sy, ex, ey, stateData, duration, callback) {
            animationQueued = true;
            // Simulate animation completing
            callback(stateData);
        }
    };

    var eventsEmitted = [];
    var mockEvents = createEventBus();
    mockEvents.on('*', function (data, type) {
        eventsEmitted.push(type);
    });

    var system = createPassingSystem({
        state: mockState,
        animations: mockAnimations,
        events: mockEvents,
        rules: { COURT_WIDTH: 66, COURT_HEIGHT: 40 },
        helpers: {
            getPlayerTeamName: function (p) { return p.team; }
        }
    });

    var passer = { x: 10, y: 10, team: 'teamA' };
    var receiver = { x: 20, y: 10, team: 'teamA' };

    var result = system.attemptPass(passer, receiver, {});

    assert(result.success === true, "Pass should succeed");
    assert(animationQueued === true, "Should queue animation");
    assert(mockState.get('ballCarrier') === receiver, "Receiver should have ball");
    assert(eventsEmitted.indexOf('pass_complete') >= 0, "Should emit pass_complete event");

    console.log("  ✓ Successful pass handled correctly");
}

function testOutOfBoundsPass() {
    console.log("\nTest: Out of bounds pass");

    var mockState = createStateManager({
        ballCarrier: null,
        currentTeam: 'teamA',
        inbounding: false
    });

    var eventsEmitted = [];
    var mockEvents = createEventBus();
    mockEvents.on('*', function (data, type) {
        eventsEmitted.push(type);
    });

    var system = createPassingSystem({
        state: mockState,
        animations: { queuePassAnimation: function () { } },
        events: mockEvents,
        rules: { COURT_WIDTH: 66, COURT_HEIGHT: 40 },
        helpers: {
            getPlayerTeamName: function (p) { return p.team; }
        }
    });

    var passer = { x: 10, y: 10, team: 'teamA' };
    var receiver = { x: 1, y: 1, team: 'teamA' }; // Out of bounds

    var result = system.attemptPass(passer, receiver, {});

    assert(result.success === false, "Pass should fail");
    assert(result.reason === 'out_of_bounds', "Should have correct reason");
    assert(mockState.get('currentTeam') === 'teamB', "Should switch possession");
    assert(mockState.get('inbounding') === true, "Should set inbounding");
    assert(eventsEmitted.indexOf('turnover') >= 0, "Should emit turnover event");
    assert(eventsEmitted.indexOf('possession_change') >= 0, "Should emit possession change");

    console.log("  ✓ Out of bounds handled correctly");
}

function testPassTiming() {
    console.log("\nTest: Pass timing calculation");

    var system = createPassingSystem({
        state: createStateManager({}),
        animations: { queuePassAnimation: function () { } },
        events: createEventBus(),
        rules: { COURT_WIDTH: 66, COURT_HEIGHT: 40 },
        helpers: { getPlayerTeamName: function (p) { return p.team; } }
    });

    var timing = system._test.calculatePassTiming(0, 0, 30, 40);

    assert(typeof timing.steps === 'number', "Should have steps");
    assert(typeof timing.durationMs === 'number', "Should have duration");
    assert(timing.durationMs > 0, "Duration should be positive");
    assert(timing.steps >= 10, "Should have minimum steps");

    console.log("  ✓ Pass timing calculated correctly");
}

function testInboundPass() {
    console.log("\nTest: Inbound pass");

    var mockState = createStateManager({
        ballCarrier: null,
        currentTeam: 'teamA',
        inbounding: true,
        inboundPasser: null,
        shotClock: 10
    });

    var mockAnimations = {
        queuePassAnimation: function (sx, sy, ex, ey, stateData, duration, callback) {
            // Simulate animation completing
            callback(stateData);
        }
    };

    var eventsEmitted = [];
    var mockEvents = createEventBus();
    mockEvents.on('*', function (data, type) {
        eventsEmitted.push(type);
    });

    var system = createPassingSystem({
        state: mockState,
        animations: mockAnimations,
        events: mockEvents,
        rules: { COURT_WIDTH: 66, COURT_HEIGHT: 40 },
        helpers: { getPlayerTeamName: function (p) { return p.team; } }
    });

    var inbounder = { x: 0, y: 10, team: 'teamA' };
    var receiver = { x: 10, y: 10, team: 'teamA' };

    var result = system.attemptPass(inbounder, receiver, {
        inboundContext: {
            inbounder: inbounder,
            inbounderX: 5,
            inbounderY: 10,
            team: 'teamA'
        }
    });

    assert(result.success === true, "Inbound pass should succeed");
    assert(mockState.get('inbounding') === false, "Should clear inbounding flag");
    assert(mockState.get('shotClock') === 24, "Should reset shot clock");
    assert(inbounder.x === 5, "Should move inbounder onto court");
    assert(eventsEmitted.indexOf('inbound_complete') >= 0, "Should emit inbound complete");

    console.log("  ✓ Inbound pass handled correctly");
}

function assert(condition, message) {
    if (!condition) {
        throw new Error("Assertion failed: " + message);
    }
}

// Run tests
try {
    runTests();
} catch (e) {
    console.log("\n❌ TEST FAILED: " + e.message);
    if (e.stack) console.log(e.stack);
    throw e;
}
