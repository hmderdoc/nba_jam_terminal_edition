// Possession System Tests
// Run with: jsexec possession-system.test.js

// Mock console for Synchronet jsexec
if (typeof console === "undefined") {
    console = {
        print: function(msg) {
            print(msg);
        }
    };
}

load("../possession-system.js");

var totalTests = 0;
var passedTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.print("\x1b[32m✓\x1b[0m " + message + "\n");
    } else {
        console.print("\x1b[31m✗\x1b[0m " + message + "\n");
    }
}

// Mock dependencies
function createMockState() {
    var state = {
        currentTeam: "teamA",
        ballCarrier: null,
        shotClock: 24,
        reboundActive: false
    };
    
    return {
        get: function(path) {
            return state[path];
        },
        set: function(path, value, reason) {
            state[path] = value;
        },
        mutate: function(fn, reason) {
            fn(state);
        },
        _internal: state  // For test inspection
    };
}

function createMockEvents() {
    var emitted = [];
    return {
        emit: function(event, data) {
            emitted.push({ event: event, data: data });
        },
        on: function(event, callback) {},
        getEmitted: function() { return emitted; }
    };
}

function createMockPlayer(name, team, x, y) {
    return {
        playerData: { name: name },
        team: team,
        x: x,
        y: y,
        moveTo: function(newX, newY) {
            this.x = newX;
            this.y = newY;
        },
        controllerType: "ai",
        isHuman: false
    };
}

// Create global player references
var teamAPlayer1 = createMockPlayer("Trae Young", "teamA", 18, 9);
var teamAPlayer2 = createMockPlayer("Dominique Wilkins", "teamA", 18, 12);
var teamBPlayer1 = createMockPlayer("Jimmy Butler", "teamB", 58, 9);
var teamBPlayer2 = createMockPlayer("Dwyane Wade", "teamB", 58, 12);

function createMockHelpers() {
    return {
        getPlayerTeamName: function(player) {
            return player ? player.team : null;
        },
        getAllPlayers: function() {
            return [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
        },
        getTeamPlayers: function(team) {
            if (team === "teamA") return [teamAPlayer1, teamAPlayer2];
            if (team === "teamB") return [teamBPlayer1, teamBPlayer2];
            return [];
        }
    };
}

// Helper to find event (since jsexec doesn't have Array.prototype.find)
function findEvent(emitted, eventName) {
    for (var i = 0; i < emitted.length; i++) {
        if (emitted[i].event === eventName) return emitted[i];
    }
    return undefined;
}

// Test 1: System Creation
console.print("\n=== Test 1: Possession System Creation ===\n");
var state = createMockState();
var events = createMockEvents();

var possessionSystem = createPossessionSystem({
    state: state,
    events: events,
    rules: {
        COURT_WIDTH: 76,
        COURT_HEIGHT: 18
    },
    helpers: createMockHelpers()
});

assert(possessionSystem !== null, "System created successfully");
assert(typeof possessionSystem.switchPossession === "function", "Has switchPossession method");
assert(typeof possessionSystem.setupInbound === "function", "Has setupInbound method");

// Test 2: Switch Possession from A to B
console.print("\n=== Test 2: Switch Possession (teamA → teamB) ===\n");
state = createMockState();
state._internal.currentTeam = "teamA";
state._internal.ballCarrier = teamAPlayer1;
events = createMockEvents();

possessionSystem = createPossessionSystem({
    state: state,
    events: events,
    rules: { COURT_WIDTH: 76, COURT_HEIGHT: 18 },
    helpers: createMockHelpers()
});

possessionSystem.switchPossession("turnover");

assert(state._internal.currentTeam === "teamB", "Current team changed to teamB");
assert(state._internal.ballCarrier === teamBPlayer1, "Ball carrier set to teamB player1");
assert(state._internal.shotClock === 24, "Shot clock reset to 24");
var possessionEvent = findEvent(events.getEmitted(), "possession_change");
assert(possessionEvent !== undefined, "Emitted possession_change event");
assert(possessionEvent.data.newTeam === "teamB", "Event has correct team");

// Test 3: Switch Possession Preserves Correct Ball Carrier
console.print("\n=== Test 3: Preserve Ball Carrier on Correct Team ===\n");
state = createMockState();
state._internal.currentTeam = "teamA";
state._internal.ballCarrier = teamBPlayer2;  // Already on teamB
events = createMockEvents();

possessionSystem = createPossessionSystem({
    state: state,
    events: events,
    rules: { COURT_WIDTH: 76, COURT_HEIGHT: 18 },
    helpers: createMockHelpers()
});

possessionSystem.switchPossession("score");

assert(state._internal.currentTeam === "teamB", "Team switched to teamB");
assert(state._internal.ballCarrier === teamBPlayer2, "Ball carrier preserved (Player2)");

// Test 4: Setup Inbound
console.print("\n=== Test 4: Setup Inbound ===\n");
state = createMockState();
state._internal.currentTeam = "teamA";
events = createMockEvents();

possessionSystem = createPossessionSystem({
    state: state,
    events: events,
    rules: { COURT_WIDTH: 76, COURT_HEIGHT: 18 },
    helpers: createMockHelpers()
});

possessionSystem.setupInbound("teamA", "out_of_bounds");

assert(state._internal.ballCarrier !== null, "Ball carrier assigned for inbound");
assert(state._internal.ballCarrier.team === "teamB", "Inbounder is on correct team (teamB got scored on)");
var inboundEvent = findEvent(events.getEmitted(), "inbound_setup");
assert(inboundEvent !== undefined, "Emitted inbound_setup event");

// Test 5: Clear State on Possession Change
console.print("\n=== Test 5: Clear State on Possession Change ===\n");
state = createMockState();
state._internal.currentTeam = "teamA";
state._internal.reboundActive = true;
state._internal.shotClock = 10;
events = createMockEvents();

possessionSystem = createPossessionSystem({
    state: state,
    events: events,
    rules: { COURT_WIDTH: 76, COURT_HEIGHT: 18 },
    helpers: createMockHelpers()
});

possessionSystem.switchPossession("steal");

assert(state._internal.reboundActive === false, "Rebound state cleared");
assert(state._internal.shotClock === 24, "Shot clock reset");

// Summary
console.print("\n=== Summary ===\n");
console.print("Passed: " + passedTests + "/" + totalTests + " tests\n");
if (passedTests === totalTests) {
    console.print("\x1b[32m✓ All tests passed!\x1b[0m\n");
    exit(0);
} else {
    console.print("\x1b[31m✗ Some tests failed\x1b[0m\n");
    exit(1);
}
