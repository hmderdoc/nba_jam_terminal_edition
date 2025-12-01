// Rubber Banding System Tests
// Run with: /sbbs/exec/jsexec tests/unit/rubber-banding-system.test.js

if (typeof console === "undefined") {
    console = {
        log: function () {
            var args = Array.prototype.slice.call(arguments);
            print(args.join(" "));
        }
    };
}

if (typeof assert === "undefined") {
    function assert(condition, message) {
        if (!condition) {
            throw new Error(message || "Assertion failed");
        }
    }
}

var basePath = js.exec_dir;
if (/tests\/unit\/?$/.test(basePath)) {
    basePath = basePath.replace(/tests\/unit\/?$/, "");
} else if (/lib\/systems\/__tests__\/?$/.test(basePath)) {
    basePath = basePath.replace(/lib\/systems\/__tests__\/?$/, "");
}
if (basePath.slice(-1) !== '/') {
    basePath += '/';
}

load(basePath + "lib/core/state-manager.js");
load(basePath + "lib/core/event-bus.js");
load(basePath + "lib/systems/rubber-banding-system.js");

function runTests() {
    console.log("=== Rubber Banding System Tests ===\n");

    testInitializationSyncsState();
    testTierSelectionPicksHighestMatchingTier();
    testAnnouncerCueFiresOnTierChange();

    console.log("\n✓ All rubber banding system tests passed!");
}

function createSystemUnderTest(options) {
    options = options || {};

    var state = createStateManager({
        score: { teamA: 0, teamB: 0 },
        timeRemaining: options.timeRemaining !== undefined ? options.timeRemaining : 120,
        teamNames: { teamA: "Team A", teamB: "Team B" },
        rubberBanding: options.initialState || null
    });

    var events = createEventBus();
    var announcerCalls = [];
    var system = createRubberBandingSystem({
        state: state,
        events: events,
        helpers: {
            announceEvent: function (eventType, payload) {
                announcerCalls.push({ eventType: eventType, payload: payload });
            }
        },
        config: {
            enabled: options.enabled !== undefined ? options.enabled : true,
            showCue: options.showCue || false,
            defaultProfile: "arcade_default",
            profiles: {
                arcade_default: {
                    tiers: [
                        {
                            id: "tier_0",
                            deficitMin: 5,
                            deficitMax: 7,
                            clockMaxSeconds: null,
                            shotMultiplier: 1.05,
                            stealBonus: 0.02,
                            blockBonus: 0.01,
                            reboundBonus: 0.02,
                            turnoverRelief: -0.03,
                            turboReserveBonus: 4
                        },
                        {
                            id: "tier_1",
                            deficitMin: 8,
                            deficitMax: 12,
                            clockMaxSeconds: null,
                            shotMultiplier: 1.12,
                            stealBonus: 0.04,
                            blockBonus: 0.03,
                            reboundBonus: 0.04,
                            turnoverRelief: -0.05,
                            turboReserveBonus: 8
                        },
                        {
                            id: "tier_clutch_3",
                            deficitMin: 3,
                            deficitMax: 8,
                            clockMaxSeconds: 10,
                            shotMultiplier: 1.25,
                            stealBonus: 0.05,
                            blockBonus: 0.04,
                            reboundBonus: 0.05,
                            turnoverRelief: -0.06,
                            turboReserveBonus: 10
                        }
                    ]
                }
            },
            probabilityCaps: {
                tier_0: 0.95,
                tier_1: 0.97,
                tier_clutch_3: 0.99
            }
        }
    });

    return {
        system: system,
        state: state,
        events: events,
        announcerCalls: announcerCalls
    };
}

function testInitializationSyncsState() {
    console.log("Test: initialization syncs base state");

    var harness = createSystemUnderTest({ enabled: true });
    var state = harness.state;

    var rubberState = state.get("rubberBanding");
    assert(rubberState !== null, "rubberBanding state should exist");
    assert(rubberState.enabled === true, "enabled flag should mirror config");
    assert(rubberState.profileId === "arcade_default", "profile should default");

    console.log("  ✓ State initialized");
}

function testTierSelectionPicksHighestMatchingTier() {
    console.log("\nTest: tier selection favors clutch when applicable");

    var harness = createSystemUnderTest({ enabled: true, timeRemaining: 8 });
    var state = harness.state;
    var system = harness.system;

    state.set("score", { teamA: 40, teamB: 45 }, "test_set_score");

    var result = system.evaluate(Date.now(), { stateManager: state });
    assert(result !== null, "A tier should be selected");
    assert(result.id === "tier_clutch_3", "Clutch tier should override deficit tiers");
    assert(state.get("rubberBanding.activeTierId") === "tier_clutch_3", "State tracks active tier");

    console.log("  ✓ Highest tier selected correctly");
}

function testAnnouncerCueFiresOnTierChange() {
    console.log("\nTest: announcer cue fires when showCue enabled");

    var harness = createSystemUnderTest({ enabled: true, showCue: true, timeRemaining: 30 });
    var state = harness.state;
    var system = harness.system;
    var announcerCalls = harness.announcerCalls;
    var events = harness.events;
    var emitted = [];

    events.on("rubber_band_tier_change", function (data) {
        emitted.push(data);
    });

    state.set("score", { teamA: 30, teamB: 40 }, "test_set_score");

    system.evaluate(Date.now(), { stateManager: state });

    assert(announcerCalls.length === 1, "Announcer should be invoked once");
    assert(announcerCalls[0].eventType === "rubber_band_tier", "Announcer event type should match");
    assert(announcerCalls[0].payload.tierId === "tier_1", "Payload should reference the new tier");
    assert(emitted.length === 1, "Event bus should emit tier change");
    assert(emitted[0].tierId === "tier_1", "Event payload tier id should match");

    console.log("  ✓ Announcer cue emitted");
}

runTests();
