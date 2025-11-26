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

// Determine repository base path regardless of test location
var basePath = js.exec_dir;
if (/tests\/unit\/?$/.test(basePath)) {
    basePath = basePath.replace(/tests\/unit\/?$/, "");
} else if (/lib\/systems\/__tests__\/?$/.test(basePath)) {
    basePath = basePath.replace(/lib\/systems\/__tests__\/?$/, "");
}
if (basePath.slice(-1) !== '/') {
    basePath += '/';
}

// Load dependencies
load(basePath + "lib/core/state-manager.js");
load(basePath + "lib/core/event-bus.js");
load(basePath + "lib/systems/passing-system.js");

function runTests() {
    console.log("=== Passing System Tests ===\n");

    testPassingSystemCreation();
    testSuccessfulPass();
    testOutOfBoundsPass();
    testNearBoundaryPassClamped();
    testPassTiming();
    testInboundPass();
    testQueuedPassWhileAnimating();
    testQueuedPassDefersDuringShotPhase();
    testInterceptedPassStopsAtDefender();

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
    var receiver = { x: -10, y: -6, team: 'teamA' }; // Significantly out of bounds

    var result = system.attemptPass(passer, receiver, {});

    assert(result.success === false, "Pass should fail");
    assert(result.reason === 'out_of_bounds', "Should have correct reason");
    assert(mockState.get('currentTeam') === 'teamB', "Should switch possession");
    assert(mockState.get('inbounding') === true, "Should set inbounding");
    assert(eventsEmitted.indexOf('turnover') >= 0, "Should emit turnover event");
    assert(eventsEmitted.indexOf('possession_change') >= 0, "Should emit possession change");

    console.log("  ✓ Out of bounds handled correctly");
}

function testNearBoundaryPassClamped() {
    console.log("\nTest: Near-boundary pass auto-clamps receiver");

    var mockState = createStateManager({
        ballCarrier: null,
        currentTeam: 'teamA'
    });

    var animationQueued = false;
    var mockAnimations = {
        queuePassAnimation: function (sx, sy, ex, ey, stateData, duration, callback) {
            animationQueued = true;
            callback(stateData);
        }
    };

    var eventsEmitted = [];
    var mockEvents = createEventBus();
    mockEvents.on('*', function (data, type) {
        eventsEmitted.push(type);
    });

    var clampCalls = 0;
    var system = createPassingSystem({
        state: mockState,
        animations: mockAnimations,
        events: mockEvents,
        rules: {
            COURT_WIDTH: 80,
            COURT_HEIGHT: 40,
            PLAYER_BOUNDARIES: {
                minX: 2,
                maxXOffset: 1,
                minY: 2,
                maxYOffset: 5,
                movementMaxXOffset: 7,
                feetMinX: 2,
                feetMaxXOffset: 2,
                fallbackWidthClamp: 7,
                passAutoClampTolerance: 2
            }
        },
        helpers: {
            getPlayerTeamName: function (p) { return p.team; },
            clampSpriteFeetToCourt: function (sprite) {
                clampCalls++;
                var clamped = {
                    x: Math.max(2, Math.min(73, sprite.x)),
                    y: Math.max(2, Math.min(35, sprite.y))
                };
                if (typeof sprite.moveTo === 'function') {
                    sprite.moveTo(clamped.x, clamped.y);
                } else {
                    sprite.x = clamped.x;
                    sprite.y = clamped.y;
                }
            }
        }
    });

    var passer = { x: 60, y: 12, team: 'teamA' };
    var receiver = {
        x: 75,
        y: 10,
        team: 'teamA',
        moveTo: function (nx, ny) {
            this.x = nx;
            this.y = ny;
        }
    };

    var result = system.attemptPass(passer, receiver, {});

    assert(result.success === true, "Pass should succeed after auto-clamp near boundary");
    assert(animationQueued === true, "Should queue animation for near-boundary pass");
    assert(mockState.get('ballCarrier') === receiver, "Receiver should gain possession");
    assert(clampCalls === 1, "Clamp helper should run once");
    assert(eventsEmitted.indexOf('turnover') === -1, "Should not emit turnover event");
    assert(receiver.x === 73, "Receiver should be clamped within boundary");

    console.log("  ✓ Near-boundary auto clamp keeps pass alive");
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
    assert(inbounder.x === 0, "Inbounder should retain authoritative position");
    assert(eventsEmitted.indexOf('inbound_complete') >= 0, "Should emit inbound complete");

    console.log("  ✓ Inbound pass handled correctly");
}

function testQueuedPassWhileAnimating() {
    console.log("\nTest: Queued pass executes after animation");

    var passer = { x: 10, y: 10, team: 'teamA', playerData: { name: 'Passer' } };
    var receiver = { x: 18, y: 12, team: 'teamA', playerData: { name: 'Receiver' } };

    var mockState = createStateManager({
        ballCarrier: passer,
        currentTeam: 'teamA'
    });

    var animState = { animating: true };
    var animationQueued = 0;

    var mockAnimations = {
        isBallAnimating: function () {
            return animState.animating;
        },
        queuePassAnimation: function (sx, sy, ex, ey, stateData, duration, callback) {
            animationQueued++;
            callback(stateData);
        }
    };

    var system = createPassingSystem({
        state: mockState,
        animations: mockAnimations,
        events: createEventBus(),
        rules: { COURT_WIDTH: 66, COURT_HEIGHT: 40 },
        helpers: { getPlayerTeamName: function (p) { return p.team; } }
    });

    var firstResult = system.attemptPass(passer, receiver, {});
    assert(firstResult.success === false, "Initial attempt should not succeed while animating");
    assert(firstResult.queued === true, "Initial attempt should queue pass intent");
    assert(animationQueued === 0, "No animation should queue while blocked");

    var queuedIntent = mockState.get('queuedPassIntent');
    assert(queuedIntent !== undefined && queuedIntent !== null, "Queued intent should be stored in state");
    assert(queuedIntent.passer === passer, "Queued intent should reference passer");

    // Animation completes next frame
    animState.animating = false;
    mockState.set('ballCarrier', passer, 'test_queue_flush');

    var processed = system.processQueuedPass();
    assert(processed && processed.success === true, "Queued pass should execute successfully once animations clear");
    assert(animationQueued === 1, "Queued pass should trigger animation exactly once");
    assert(mockState.get('queuedPassIntent') === null, "Queued intent should clear after execution");
    assert(mockState.get('ballCarrier') === receiver, "Receiver should become new ball carrier");

    console.log("  ✓ Queued pass executes after animation");
}

function testQueuedPassDefersDuringShotPhase() {
    console.log("\nTest: Queued pass defers during shot phase");

    var passer = { x: 14, y: 11, team: 'teamA', playerData: { name: 'Passer' } };
    var receiver = { x: 20, y: 12, team: 'teamA', playerData: { name: 'Receiver' } };

    var mockState = createStateManager({
        ballCarrier: passer,
        currentTeam: 'teamA',
        shotInProgress: false,
        phase: {
            current: 'SHOT_SCORED',
            name: 'SHOT_SCORED',
            data: {},
            frameCounter: 0,
            targetFrames: 0
        }
    });

    var animationQueued = 0;
    var mockAnimations = {
        isBallAnimating: function () {
            return false;
        },
        queuePassAnimation: function (sx, sy, ex, ey, stateData, duration, callback) {
            animationQueued++;
            if (typeof callback === 'function') {
                callback(stateData);
            }
        }
    };

    var system = createPassingSystem({
        state: mockState,
        animations: mockAnimations,
        events: createEventBus(),
        rules: { COURT_WIDTH: 66, COURT_HEIGHT: 40 },
        helpers: { getPlayerTeamName: function (p) { return p.team; } }
    });

    mockState.set('queuedPassIntent', {
        passer: passer,
        receiver: receiver,
        leadTarget: null,
        inboundContext: null,
        queuedAt: Date.now(),
        attempts: 1
    }, 'test_setup');

    var waitingResult = system.processQueuedPass();
    assert(waitingResult === 'waiting', "Queued pass should wait while shot phase is active");
    assert(animationQueued === 0, "No animation should queue during shot phase hold");
    assert(mockState.get('queuedPassIntent') !== null, "Queued intent should persist while waiting");

    mockState.set('phase', {
        current: 'NORMAL',
        name: 'NORMAL',
        data: {},
        frameCounter: 0,
        targetFrames: 0
    }, 'test_phase_normal');

    var processedResult = system.processQueuedPass();
    assert(processedResult && processedResult.success === true, "Queued pass should execute once phase returns to NORMAL");
    assert(animationQueued === 1, "Pass animation should queue after phase clears");
    assert(mockState.get('queuedPassIntent') === null, "Queued intent should clear after execution");
    assert(mockState.get('ballCarrier') === receiver, "Receiver should gain possession after queued pass executes");

    console.log("  ✓ Queued pass is deferred during shot phases");
}

function testInterceptedPassStopsAtDefender() {
    console.log("\nTest: Intercepted pass animation stops at defender");

    var passer = { x: 12, y: 12, team: 'teamA', playerData: { name: 'Passer', hasDribble: true } };
    var receiver = { x: 44, y: 10, team: 'teamA', playerData: { name: 'Receiver' } };
    var defender = { x: 28, y: 14, team: 'teamB', playerData: { name: 'Defender', hasDribble: false } };

    var mockState = createStateManager({
        ballCarrier: passer,
        currentTeam: 'teamA',
        consecutivePoints: { teamA: 6, teamB: 4 }
    });

    var queuedEndX = null;
    var queuedEndY = null;
    var queuedStateData = null;

    var mockAnimations = {
        isBallAnimating: function () { return false; },
        queuePassAnimation: function (sx, sy, ex, ey, stateData, duration, callback) {
            queuedEndX = ex;
            queuedEndY = ey;
            queuedStateData = stateData;
            callback(stateData);
        }
    };

    var systemsRef = { stateManager: mockState };
    var helperCalls = {
        recordTurnover: 0,
        recordStatDelta: 0,
        resetBackcourtState: 0,
        clearPotentialAssist: 0,
        triggerPossessionBeep: 0,
        assignDefensiveMatchups: 0
    };
    var capturedStatArgs = null;

    var events = createEventBus();
    var possessionEvents = [];
    var stealEvents = [];
    events.on('possession_change', function (data) {
        possessionEvents.push(data);
    });
    events.on('steal', function (data) {
        stealEvents.push(data);
    });

    var system = createPassingSystem({
        state: mockState,
        animations: mockAnimations,
        events: events,
        systems: systemsRef,
        rules: { COURT_WIDTH: 66, COURT_HEIGHT: 40 },
        helpers: {
            getPlayerTeamName: function (p) { return p.team; },
            recordTurnover: function (player, reason, systems) {
                helperCalls.recordTurnover++;
                assert(player === passer, "recordTurnover should receive passer");
                assert(reason === "steal_pass", "recordTurnover reason should be steal_pass");
                assert(systems === systemsRef, "recordTurnover should receive systemsRef");
            },
            recordStatDelta: function (player, key, amount, systems) {
                helperCalls.recordStatDelta++;
                capturedStatArgs = { player: player, key: key, amount: amount, systems: systems };
                assert(systems === systemsRef, "recordStatDelta should receive systemsRef");
            },
            resetBackcourtState: function (systems) {
                helperCalls.resetBackcourtState++;
                assert(systems === systemsRef, "resetBackcourtState should receive systemsRef");
            },
            clearPotentialAssist: function (systems) {
                helperCalls.clearPotentialAssist++;
                assert(systems === systemsRef, "clearPotentialAssist should receive systemsRef");
            },
            triggerPossessionBeep: function () {
                helperCalls.triggerPossessionBeep++;
            },
            assignDefensiveMatchups: function (systems) {
                helperCalls.assignDefensiveMatchups++;
                assert(systems === systemsRef, "assignDefensiveMatchups should receive systemsRef");
            }
        }
    });

    var hadOriginalCheck = typeof checkPassInterception === 'function';
    var originalCheck = hadOriginalCheck ? checkPassInterception : null;
    checkPassInterception = function () {
        return { defender: defender, interceptX: 35.6, interceptY: 18.2 };
    };

    try {
        var result = system.attemptPass(passer, receiver, {});

        assert(result.success === true, "Intercepted pass should still queue animation");
        assert(result.outcome && result.outcome.intercepted === true, "Outcome should mark interception");
        assert(queuedEndX === Math.round(35.6), "Animation end X should match intercept point");
        assert(queuedEndY === Math.round(18.2), "Animation end Y should match intercept point");
        assert(queuedStateData.interceptor === defender, "State data should include interceptor sprite");
        assert(mockState.get('ballCarrier') === defender, "Defender should become ball carrier after interception");
        assert(mockState.get('currentTeam') === 'teamB', "Possession should flip to interceptor team");
        assert(mockState.get('shotClock') === 24, "Shot clock should reset on interception");
        assert(mockState.get('ballHandlerLastX') === defender.x, "ballHandlerLastX should update to interceptor position");
        assert(mockState.get('ballHandlerLastY') === defender.y, "ballHandlerLastY should update to interceptor position");
        assert(mockState.get('ballHandlerProgressOwner') === defender, "Progress owner should become interceptor");
        assert(mockState.get('ballHandlerStuckTimer') === 0, "ballHandlerStuckTimer should reset");
        assert(mockState.get('ballHandlerAdvanceTimer') === 0, "ballHandlerAdvanceTimer should reset");
        assert(mockState.get('consecutivePoints.teamA') === 0, "Opponent streak should reset");
        assert(helperCalls.recordTurnover === 1, "recordTurnover should run once");
        assert(helperCalls.recordStatDelta === 1, "recordStatDelta should run once");
        assert(helperCalls.resetBackcourtState === 1, "resetBackcourtState should run once");
        assert(helperCalls.clearPotentialAssist === 1, "clearPotentialAssist should run once");
        assert(helperCalls.triggerPossessionBeep === 1, "triggerPossessionBeep should fire once");
        assert(helperCalls.assignDefensiveMatchups === 1, "assignDefensiveMatchups should run once");
        assert(capturedStatArgs && capturedStatArgs.player === defender, "recordStatDelta should target interceptor");
        assert(capturedStatArgs && capturedStatArgs.key === 'steals', "recordStatDelta should increment steals");
        assert(capturedStatArgs && capturedStatArgs.amount === 1, "recordStatDelta should add single steal");
        assert(possessionEvents.length === 1, "possession_change event should emit once");
        assert(possessionEvents[0].from === 'teamA' && possessionEvents[0].to === 'teamB', "possession_change payload should reflect teams");
        assert(possessionEvents[0].reason === 'interception', "possession_change reason should be interception");
        assert(stealEvents.length === 1, "steal event should emit once");
        assert(stealEvents[0].defender === defender, "steal event should include defender");
        assert(passer.playerData.hasDribble === false, "Passer should lose dribble after interception");
        assert(defender.playerData.hasDribble === true, "Interceptor should gain dribble after interception");
        assert(capturedStatArgs.systems === systemsRef, "recordStatDelta should receive systemsRef");
    } finally {
        if (hadOriginalCheck) {
            checkPassInterception = originalCheck;
        } else {
            try {
                delete checkPassInterception;
            } catch (cleanupErr) {
                checkPassInterception = undefined;
            }
        }
    }

    console.log("  ✓ Intercepted pass animation truncated correctly");
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
