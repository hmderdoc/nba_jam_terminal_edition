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
load(basePath + "lib/core/frame-scheduler.js");
load(basePath + "lib/game-logic/jump-ball-system.js");

if (typeof MAX_TURBO === "undefined") MAX_TURBO = 100;
if (typeof COURT_MID_X === "undefined") COURT_MID_X = 40;
if (typeof BASKET_LEFT_Y === "undefined") BASKET_LEFT_Y = 9;
if (typeof PHASE_NORMAL === "undefined") PHASE_NORMAL = "NORMAL";
if (typeof WHITE === "undefined") WHITE = 15;
if (typeof YELLOW === "undefined") YELLOW = 14;
if (typeof clamp === "undefined") {
    function clamp(value, min, max) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function createTestPlayer(name, team, attr, turbo) {
    return {
        team: team,
        x: 0,
        y: 0,
        moveTo: function (nx, ny) {
            this.x = nx;
            this.y = ny;
        },
        turnTo: function () { },
        playerData: {
            name: name,
            turbo: turbo,
            attributes: [0, 0, 0, 0, 0, attr],
            hasDribble: false
        }
    };
}

function runJumpBall() {
    var stateManager = createStateManager({
        announcer: { text: "", color: WHITE, timer: 0 }
    });

    var teamAPlayer1 = createTestPlayer("Ace", "teamA", 9, 90);
    var teamAPlayer2 = createTestPlayer("WingA", "teamA", 3, 60);
    var teamBPlayer1 = createTestPlayer("Challenger", "teamB", 4, 50);
    var teamBPlayer2 = createTestPlayer("WingB", "teamB", 3, 40);

    var players = {
        teamAPlayer1: teamAPlayer1,
        teamAPlayer2: teamAPlayer2,
        teamBPlayer1: teamBPlayer1,
        teamBPlayer2: teamBPlayer2
    };

    var announcerLog = [];
    var moveLog = [];

    var fakeNow = 0;

    var jumpBallSystem = createJumpBallSystem({
        state: stateManager,
        helpers: {
            getPlayers: function () { return players; },
            announce: function (text) { announcerLog.push(text); },
            announceEvent: function () { },
            drawCourt: function () { },
            drawScore: function () { },
            ensureBallFrame: function (x, y) { moveLog.push({ type: "ensure", x: x, y: y }); },
            moveBallFrameTo: function (x, y) { moveLog.push({ type: "move", x: x, y: y }); },
            setPhase: function (phase) {
                stateManager.set('phase', {
                    current: phase,
                    data: {},
                    frameCounter: 0,
                    targetFrames: 0
                }, 'test_set_phase');
            }
        },
        now: function () { return fakeNow; },
        constants: {
            layout: {
                centerX: 40,
                centerY: 10,
                playerOffsetX: 2,
                playerOffsetY: 0,
                wingOffsetX: 6,
                wingOffsetY: 3,
                arcHeight: 5,
                jumperLift: 3
            },
            rules: {
                attributeIndex: 5,
                attributeWeight: 0.8,
                turboWeight: 0.2,
                randomWeight: 0,
                randomMin: 0,
                randomMax: 0,
                tiebreakerIncrement: 1
            },
            countdownMs: 200,
            dropDurationFrames: 4,
            dropStartY: 0,
            contestWindowFrames: 4,
            frameIntervalMs: 50
        }
    });

    var systems = {
        stateManager: stateManager
    };

    jumpBallSystem.startOpeningTipoff(systems);

    var safetyCounter = 0;
    while (jumpBallSystem.isActive()) {
        jumpBallSystem.update(fakeNow, systems);
        if (jumpBallSystem.isAwaitingUserJump()) {
            jumpBallSystem.handleUserInput(fakeNow, systems);
        }
        fakeNow += 200;
        safetyCounter++;
        if (safetyCounter > 50) {
            throw new Error("Jump ball system did not complete within expected iterations");
        }
    }

    return {
        stateManager: stateManager,
        players: players,
        announcerLog: announcerLog,
        moveLog: moveLog
    };
}

function runTests() {
    console.log('\nTest: Jump ball awards first possession');
    var context = runJumpBall();
    var state = context.stateManager;
    var winnerTeam = state.get('firstHalfStartTeam');
    assert(winnerTeam === 'teamA', 'Expected teamA to win opening tip');

    var ballCarrier = state.get('ballCarrier');
    assert(ballCarrier === context.players.teamAPlayer1, 'Winning center should hold the ball');
    assert(state.get('currentTeam') === 'teamA', 'Current team should be the winner');
    assert(state.get('inbounding') === false, 'Game should not enter inbound state');

    var ballX = state.get('ballX');
    var ballY = state.get('ballY');
    assert(ballX === Math.round(context.players.teamAPlayer1.x), 'Ball X should match winner position');
    assert(ballY === Math.round(context.players.teamAPlayer1.y), 'Ball Y should match winner position');

    assert(state.get('jumpBallTiebreakerSeed') !== 0, 'Seed should advance after jump ball');
    assert(state.get('courtNeedsRedraw') === true, 'Jump ball should trigger court redraw');

    var phase = state.get('phase');
    assert(phase && phase.current === PHASE_NORMAL, 'Phase should reset to NORMAL after jump ball');

    var ensureCalls = context.moveLog.filter(function (entry) { return entry.type === 'ensure'; });
    var moveCalls = context.moveLog.filter(function (entry) { return entry.type === 'move'; });
    assert(ensureCalls.length >= 1, 'Ball frame should be ensured during drop');
    assert(moveCalls.length >= 1, 'Ball frame should move during drop/resolution');

    console.log('  \u2713 Opening tip assigns possession to strongest jumper');
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
