if (typeof console === "undefined") {
    console = {
        log: function () {
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
} else if (/lib\/systems\/__tests__\/?$/.test(basePath)) {
    basePath = basePath.replace(/lib\/systems\/__tests__\/?$/, "");
}
if (basePath.slice(-1) !== '/') {
    basePath += '/';
}

load(basePath + "lib/core/state-manager.js");
load(basePath + "lib/core/event-bus.js");

if (typeof PHASE_NORMAL === "undefined") PHASE_NORMAL = "NORMAL";
if (typeof PHASE_INBOUND_SETUP === "undefined") PHASE_INBOUND_SETUP = "INBOUND_SETUP";
if (typeof INBOUND_SETUP_DURATION_MS === "undefined") INBOUND_SETUP_DURATION_MS = 4000;
if (typeof setPhase === "undefined") {
    function setPhase(phase, data, durationMs, frameDelayMs, systems) {
        var sm = systems.stateManager;
        var phaseObj = sm.get('phase');
        if (!phaseObj) {
            phaseObj = {
                current: PHASE_NORMAL,
                data: {},
                frameCounter: 0,
                targetFrames: 0
            };
            sm.set('phase', phaseObj, 'test_phase_init');
        }
        phaseObj.current = phase;
        phaseObj.data = data || {};
        phaseObj.frameCounter = 0;
        if (typeof durationMs === "number" && durationMs > 0) {
            phaseObj.targetFrames = Math.max(1, Math.round(durationMs / 50));
        } else {
            phaseObj.targetFrames = 0;
        }
    }
}

load(basePath + "lib/systems/possession-system.js");
load(basePath + "lib/game-logic/possession.js");

var COURT_WIDTH = 66;
var COURT_HEIGHT = 40;

function clampValue(value, max) {
    return Math.max(0, Math.min(max, Math.round(value)));
}

function ensureGlobals() {
    if (typeof flushKeyboardBuffer === "undefined") flushKeyboardBuffer = function () { };
    if (typeof resetBackcourtState === "undefined") resetBackcourtState = function () { };
    if (typeof clampToCourtX === "undefined") clampToCourtX = function (value) { return clampValue(value, COURT_WIDTH - 1); };
    if (typeof clampToCourtY === "undefined") clampToCourtY = function (value) { return clampValue(value, COURT_HEIGHT - 1); };
    if (typeof clearPotentialAssist === "undefined") clearPotentialAssist = function () { };
    if (typeof resetDeadDribbleTimer === "undefined") resetDeadDribbleTimer = function () { };
    if (typeof primeInboundOffense === "undefined") primeInboundOffense = function () { };
    if (typeof triggerPossessionBeep === "undefined") triggerPossessionBeep = function () { };
    if (typeof resetAllDefenseMomentum === "undefined") resetAllDefenseMomentum = function () { };
}

function createPlayer(name, team, x, y) {
    return {
        team: team,
        x: x,
        y: y,
        ini: { height: 4 },
        frame: { height: 4 },
        playerData: { name: name }
    };
}

function runSecondHalfSetup() {
    ensureGlobals();

    var teamAPlayer1 = createPlayer('A1', 'teamA', 10, 18);
    var teamAPlayer2 = createPlayer('A2', 'teamA', 12, 20);
    var teamBPlayer1 = createPlayer('B1', 'teamB', 50, 18);
    var teamBPlayer2 = createPlayer('B2', 'teamB', 52, 20);

    this.teamAPlayer1 = teamAPlayer1;
    this.teamAPlayer2 = teamAPlayer2;
    this.teamBPlayer1 = teamBPlayer1;
    this.teamBPlayer2 = teamBPlayer2;

    var stateManager = createStateManager({
        inboundAlternateIndex: { teamA: 0, teamB: 0 },
        consecutivePoints: { teamA: 0, teamB: 0 }
    });
    var events = createEventBus();

    var helpers = {
        getPlayerTeamName: function (sprite) { return sprite.team; },
        getAllPlayers: function () { return [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2]; },
        getTeamPlayers: function (team) {
            return team === 'teamA' ? [teamAPlayer1, teamAPlayer2] : [teamBPlayer1, teamBPlayer2];
        }
    };

    var systems = {};
    systems.stateManager = stateManager;
    systems.eventBus = events;
    systems.possessionSystem = createPossessionSystem({
        state: stateManager,
        events: events,
        rules: { COURT_WIDTH: COURT_WIDTH, COURT_HEIGHT: COURT_HEIGHT },
        helpers: helpers
    });

    stateManager.set('firstHalfStartTeam', 'teamA', 'test_init');
    stateManager.set('pendingSecondHalfInbound', true, 'test_init');
    stateManager.set('secondHalfInitDone', false, 'test_init');

    startSecondHalfInbound(systems);

    return {
        stateManager: stateManager,
        teamBPlayer1: teamBPlayer1
    };
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function runTests() {
    console.log('\nTest: Second half inbound fairness');
    var context = runSecondHalfSetup();
    var state = context.stateManager;
    var positioning = state.get('inboundPositioning');
    var phase = state.get('phase');
    var phaseData = phase ? phase.data : null;

    assert(state.get('currentTeam') === 'teamB', 'Second half possession should flip to defensive team');
    assert(state.get('secondHalfInitDone') === true, 'Second half init flag should be set');
    assert(state.get('pendingSecondHalfInbound') === false, 'Pending second-half inbound should clear');
    assert(positioning && positioning.inbounder && positioning.receiver, 'Inbound positioning should exist');
    assert(positioning.defenders && positioning.defenders.length === 2, 'Defender positioning should have two entries');
    assert(phase && phase.current === PHASE_INBOUND_SETUP, 'Phase should switch to inbound setup');
    assert(phaseData && phaseData.reason === 'second_half_start', 'Phase reason should mark second-half start');
    assert(phaseData.inboundTeamKey === 'teamB', 'Phase data should record inbound team');
    assert(phaseData.scoringTeamKey === 'teamA', 'Phase data should record prior offensive team');

    var midX = Math.floor(COURT_WIDTH / 2);
    assert(positioning.inbounder.targetX > midX, 'TeamB inbounder should be in backcourt (right side)');
    assert(positioning.receiver.targetX > midX, 'TeamB receiver should remain in backcourt');
    assert(positioning.defenders[0].targetX < positioning.inbounder.targetX, 'Defenders should be closer to midcourt than offense');
    assert(positioning.inbounder.sprite === context.teamBPlayer1, 'Override should pin Team B player 1 as inbounder');

    var inboundPasser = state.get('inboundPasser');
    assert(inboundPasser == null, 'Inbound passer should defer until inbound setup runs');

    var override = state.get('secondHalfPositioningOverride');
    assert(override && override.inboundTeam === 'teamB', 'Second-half override should persist for inbound setup');
    assert(override.inbounder === context.teamBPlayer1, 'Override inbounder should remain Team B player 1');
    assert(override.consumed === false, 'Override should not be consumed before inbound setup runs');
    assert(override.reason === 'second_half_start', 'Override should record second-half reason');

    console.log('  \u2713 Second half inbound assigns possession and positions correctly');
}

try {
    runTests();
} catch (err) {
    console.error('\n\u274c TEST FAILED:', err.message);
    if (err.stack) {
        console.error(err.stack);
    }
    throw err;
}
