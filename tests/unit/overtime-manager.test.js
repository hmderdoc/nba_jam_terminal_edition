if (typeof console === "undefined") {
    console = {
        log: function () {
            var args = Array.prototype.slice.call(arguments);
            print(args.join(" "));
        },
        error: function () {
            var args = Array.prototype.slice.call(arguments);
            print(args.join(" "));
        }
    };
}
if (typeof console.error !== "function") {
    console.error = function () {
        var args = Array.prototype.slice.call(arguments);
        print(args.join(" "));
    };
}

if (typeof debugLog === "undefined") {
    function debugLog() { }
}

var basePath = js.exec_dir;
if (/tests\/unit\/?$/.test(basePath)) {
    basePath = basePath.replace(/tests\/unit\/?$/, "");
}
if (basePath.slice(-1) !== '/') {
    basePath += '/';
}

if (typeof createStateManager === "undefined") {
    load(basePath + "lib/core/state-manager.js");
}

if (typeof PHASE_OVERTIME_INTRO === "undefined") {
    var PHASE_OVERTIME_INTRO = "OVERTIME_INTRO";
}

var WHITE = 7;
var YELLOW = 14;
var LIGHTCYAN = 11;
var SHOT_CLOCK_DEFAULT = 24;
var REGULATION_PERIOD_SECONDS = 360;
var OVERTIME_PERIOD_SECONDS = 45;
var FAST_OVERTIME_TEST_ENABLED = false;
var FAST_OVERTIME_AUTO_TIE_ENABLED = false;
var FAST_OVERTIME_AUTO_TIE_SECONDS = null;
var FAST_OVERTIME_AUTO_TIE_SCORE = null;
var FAST_OVERTIME_TEST_HAS_TRIGGERED = false;

var resetBackcourtInvocations = 0;
function resetBackcourtState() {
    resetBackcourtInvocations++;
}

var lastOvertimeInbound = null;
function startOvertimeInbound(systems, inboundTeam, context) {
    lastOvertimeInbound = {
        inboundTeam: inboundTeam,
        context: context
    };
}

var lastAnnounceEvent = null;
function announceEvent(type, payload) {
    lastAnnounceEvent = {
        type: type,
        payload: payload
    };
}

if (typeof maybeStartOvertime === "undefined") {
    load(basePath + "lib/game-logic/overtime.js");
}

function createSystems(initialStateOverrides) {
    var initialState = {
        score: { teamA: 0, teamB: 0 },
        timeRemaining: 0,
        totalGameTime: REGULATION_PERIOD_SECONDS,
        overtimeCount: 0,
        currentOvertimePeriod: 0,
        overtimePeriodSeconds: OVERTIME_PERIOD_SECONDS,
        regulationOvertimeAnchorTeam: "teamA",
        overtimeNextPossessionTeam: null,
        frontcourtEstablished: false,
        shotClock: SHOT_CLOCK_DEFAULT,
        pendingSecondHalfInbound: false,
        courtNeedsRedraw: false,
        overtimeIntroActive: false,
        overtimeIntroEndsAt: 0,
        overtimeIntroRemainingSeconds: 0,
        pendingOvertimeInboundTeam: null,
        pendingOvertimeInboundContext: null
    };
    if (initialStateOverrides) {
        for (var key in initialStateOverrides) {
            initialState[key] = initialStateOverrides[key];
        }
    }
    var stateManager = createStateManager(initialState);
    return {
        stateManager: stateManager
    };
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

function approximatelyEqual(value, target) {
    return Math.abs(value - target) <= 100;
}

function resetFastOvertimeGlobals() {
    FAST_OVERTIME_TEST_HAS_TRIGGERED = false;
}

function runOvertimeStartTest() {
    resetFastOvertimeGlobals();
    resetBackcourtInvocations = 0;
    lastOvertimeInbound = null;
    lastAnnounceEvent = null;

    var systems = createSystems({
        score: { teamA: 88, teamB: 88 },
        timeRemaining: 0,
        overtimePeriodSeconds: 30,
        regulationOvertimeAnchorTeam: "teamB",
        overtimeNextPossessionTeam: null,
        totalGameTime: 360
    });

    var result = maybeStartOvertime(systems);
    assert(result === true, "Expected overtime to start");

    var state = systems.stateManager;
    assert(state.get("overtimeCount") === 1, "Overtime count should increment to 1");
    assert(state.get("currentOvertimePeriod") === 1, "Current overtime period should be 1");
    assert(state.get("isOvertime") === true, "isOvertime flag should be true");
    assert(state.get("timeRemaining") === 30, "Overtime clock should reset to configured seconds");
    assert(state.get("shotClock") === SHOT_CLOCK_DEFAULT, "Shot clock should reset to default");
    assert(state.get("overtimeNextPossessionTeam") === "teamA", "Next overtime possession should alternate");
    assert(state.get("ballCarrier") === null, "Ball carrier should clear");
    assert(state.get("courtNeedsRedraw") === true, "Court redraw flag should be set");
    assert(state.get("pendingSecondHalfInbound") === false, "Second-half inbound flag should clear");
    assert(state.get("totalGameTime") === 390, "Total game time should extend by overtime seconds");
    assert(resetBackcourtInvocations === 1, "Backcourt state should reset once");
    assert(state.get("overtimeIntroActive") === true, "Overtime intro should be active before inbound");
    assert(state.get("pendingOvertimeInboundTeam") === "teamB", "Pending inbound team should align with jump-ball winner");
    assert(lastOvertimeInbound === null, "Inbound should not trigger until intro completes");

    finalizePendingOvertimeIntro(systems);

    assert(state.get("overtimeIntroActive") === false, "Overtime intro flag should clear after finalize");
    assert(state.get("pendingOvertimeInboundTeam") === null, "Pending inbound team should clear after finalize");
    assert(lastOvertimeInbound && lastOvertimeInbound.inboundTeam === "teamB", "First overtime inbound should go to jump-ball winner");
    assert(lastOvertimeInbound && lastOvertimeInbound.context && lastOvertimeInbound.context.overtimeNumber === 1, "Inbound context should include overtime number");
    assert(lastAnnounceEvent && lastAnnounceEvent.type === "overtime_start", "Announce event should fire");
    assert(lastAnnounceEvent.payload.inboundTeam === "teamB", "Announce payload should reference inbound team");
    assert(lastAnnounceEvent.payload.alternateTeam === "teamA", "Announce payload should note alternate team");
    var lastSecondTime = systems.stateManager.get("lastSecondTime");
    assert(typeof lastSecondTime === "number" && approximatelyEqual(lastSecondTime, Date.now()), "lastSecondTime should sync to now");
}

function runAlternatingPossessionTest() {
    resetFastOvertimeGlobals();
    resetBackcourtInvocations = 0;
    lastOvertimeInbound = null;

    var systems = createSystems({
        score: { teamA: 101, teamB: 101 },
        timeRemaining: 0,
        overtimeCount: 1,
        currentOvertimePeriod: 1,
        overtimePeriodSeconds: 20,
        regulationOvertimeAnchorTeam: "teamA",
        overtimeNextPossessionTeam: "teamB",
        totalGameTime: 420
    });

    var result = maybeStartOvertime(systems);
    assert(result === true, "Second overtime should start");

    var state = systems.stateManager;
    assert(state.get("overtimeCount") === 2, "Overtime count should be 2");
    assert(state.get("currentOvertimePeriod") === 2, "Current overtime period should be 2");
    assert(state.get("timeRemaining") === 20, "Clock should reset to stored overtime duration");
    assert(state.get("overtimeNextPossessionTeam") === "teamA", "Next possession should alternate back");
    assert(state.get("overtimeIntroActive") === true, "Overtime intro should gate inbound");
    assert(state.get("pendingOvertimeInboundTeam") === "teamB", "Pending overtime inbound should match stored team");
    assert(lastOvertimeInbound === null, "Inbound should wait for intro to complete");

    finalizePendingOvertimeIntro(systems);

    assert(state.get("overtimeIntroActive") === false, "Intro flag should clear after finalize");
    assert(lastOvertimeInbound && lastOvertimeInbound.inboundTeam === "teamB", "Inbound team should match stored next possession");
    assert(resetBackcourtInvocations === 1, "Backcourt reset should trigger once");
}

function runNoOvertimeWhenNotTied() {
    resetFastOvertimeGlobals();
    resetBackcourtInvocations = 0;
    var systems = createSystems({
        score: { teamA: 92, teamB: 90 },
        timeRemaining: 0,
        overtimeNextPossessionTeam: "teamB"
    });
    var result = maybeStartOvertime(systems);
    assert(result === false, "Should not start overtime when scores differ");
    assert(resetBackcourtInvocations === 0, "Backcourt reset should not run");
}

function runNoOvertimeWhenClockActive() {
    resetFastOvertimeGlobals();
    resetBackcourtInvocations = 0;
    var systems = createSystems({
        score: { teamA: 80, teamB: 80 },
        timeRemaining: 12,
        overtimeNextPossessionTeam: "teamB"
    });
    var result = maybeStartOvertime(systems);
    assert(result === false, "Should not start overtime when time remains");
}

function runAutoTieOverrideTest() {
    resetFastOvertimeGlobals();
    resetBackcourtInvocations = 0;
    var previousAutoTieEnabled = FAST_OVERTIME_AUTO_TIE_ENABLED;
    var previousAutoTieScore = FAST_OVERTIME_AUTO_TIE_SCORE;
        var previousOverrideTriggered = FAST_OVERTIME_TEST_HAS_TRIGGERED;
    try {
        FAST_OVERTIME_AUTO_TIE_ENABLED = true;
        FAST_OVERTIME_AUTO_TIE_SCORE = 60;

        var systems = createSystems({
            score: { teamA: 58, teamB: 55 },
            timeRemaining: 0,
            overtimePeriodSeconds: 20,
            overtimeNextPossessionTeam: "teamA"
        });

        var result = maybeStartOvertime(systems);
        assert(result === true, "Fast overtime override should force an overtime start");
        var tiedScore = systems.stateManager.get("score");
        assert(tiedScore.teamA === 60 && tiedScore.teamB === 60, "Scores should auto-tie to configured value");
    } finally {
        FAST_OVERTIME_AUTO_TIE_ENABLED = previousAutoTieEnabled;
        FAST_OVERTIME_AUTO_TIE_SCORE = previousAutoTieScore;
            FAST_OVERTIME_TEST_HAS_TRIGGERED = previousOverrideTriggered;
    }
}

function runAutoTieSingleUseTest() {
    resetFastOvertimeGlobals();
    resetBackcourtInvocations = 0;
    var previousAutoTieEnabled = FAST_OVERTIME_AUTO_TIE_ENABLED;
    var previousAutoTieScore = FAST_OVERTIME_AUTO_TIE_SCORE;
    var previousOverrideTriggered = FAST_OVERTIME_TEST_HAS_TRIGGERED;
    try {
        FAST_OVERTIME_AUTO_TIE_ENABLED = true;
        FAST_OVERTIME_AUTO_TIE_SCORE = 60;

        var firstSystems = createSystems({
            score: { teamA: 55, teamB: 50 },
            timeRemaining: 0,
            overtimePeriodSeconds: 20,
            overtimeNextPossessionTeam: "teamA"
        });

        var firstResult = maybeStartOvertime(firstSystems);
        assert(firstResult === true, "Override should start first overtime");

        var secondSystems = createSystems({
            score: { teamA: 70, teamB: 65 },
            timeRemaining: 0,
            overtimePeriodSeconds: 20,
            overtimeNextPossessionTeam: "teamB"
        });

        var secondResult = maybeStartOvertime(secondSystems);
        assert(secondResult === false, "Override should not force a second overtime once consumed");
    } finally {
        FAST_OVERTIME_AUTO_TIE_ENABLED = previousAutoTieEnabled;
        FAST_OVERTIME_AUTO_TIE_SCORE = previousAutoTieScore;
        FAST_OVERTIME_TEST_HAS_TRIGGERED = previousOverrideTriggered;
    }
}

function runTests() {
    console.log("\nTest: Overtime start primes state correctly");
    runOvertimeStartTest();
    console.log("  \u2713 Overtime start state reset");

    console.log("\nTest: Overtime alternates possessions");
    runAlternatingPossessionTest();
    console.log("  \u2713 Alternating possessions verified");

    console.log("\nTest: Guard rails prevent premature overtime");
    runNoOvertimeWhenNotTied();
    runNoOvertimeWhenClockActive();
    console.log("  \u2713 Guard rails hold");

    console.log("\nTest: Fast-overtime override auto-ties scores");
    runAutoTieOverrideTest();
    console.log("  \u2713 Fast-overtime override forces tie");

        console.log("\nTest: Fast-overtime override is single-use");
        runAutoTieSingleUseTest();
        console.log("  \u2713 Fast-overtime override only triggers once");
}

try {
    runTests();
} catch (err) {
    console.error("\n\u274c TEST FAILED:", err.message);
    if (err.stack) {
        console.error(err.stack);
    }
    throw err;
}
