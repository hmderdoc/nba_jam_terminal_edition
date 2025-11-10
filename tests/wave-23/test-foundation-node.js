#!/usr/bin/env node
// Wave 23 Architecture Foundation - Node.js Compatible Tests
// Run: node test-foundation-node.js

const fs = require('fs');
const path = require('path');

// Mock Synchronet log function
global.log = function (level, msg) {
    console.log("[" + level + "] " + msg);
};
global.LOG_DEBUG = 7;
global.LOG_ERR = 3;

// Simple load() implementation for Node
function load(filepath) {
    const fullPath = path.join(__dirname, filepath);
    const code = fs.readFileSync(fullPath, 'utf8');
    // Use Function constructor to execute in global scope
    const func = new Function(code);
    func.call(global);
}

// Load the modules
load("lib/core/state-manager.js");
load("lib/core/event-bus.js");

function runTests() {
    console.log("=== Testing State Manager ===\n");
    testStateManager();

    console.log("\n=== Testing Event Bus ===\n");
    testEventBus();

    console.log("\n=== All Tests Passed! ===");
}

function testStateManager() {
    // Create state manager with initial state
    var initialState = {
        ballCarrier: null,
        currentTeam: "teamA",
        score: { teamA: 0, teamB: 0 },
        players: []
    };

    var state = createStateManager(initialState);

    // Test 1: Get root value
    console.log("Test 1: Get root state");
    var root = state.get();
    assert(root.currentTeam === "teamA", "Should get root state");

    // Test 2: Get nested value
    console.log("Test 2: Get nested value");
    var scoreA = state.get("score.teamA");
    assert(scoreA === 0, "Should get nested value");

    // Test 3: Set value
    console.log("Test 3: Set value");
    state.set("currentTeam", "teamB", "test_set");
    assert(state.get("currentTeam") === "teamB", "Should set value");

    // Test 4: Set nested value
    console.log("Test 4: Set nested value");
    state.set("score.teamA", 10, "test_score");
    assert(state.get("score.teamA") === 10, "Should set nested value");

    // Test 5: Subscribe to changes
    console.log("Test 5: Subscribe to changes");
    var changeDetected = false;
    var unsubscribe = state.subscribe("currentTeam", function (path, oldVal, newVal) {
        changeDetected = true;
        assert(oldVal === "teamB", "Should have old value");
        assert(newVal === "teamA", "Should have new value");
    });
    state.set("currentTeam", "teamA", "test_subscribe");
    assert(changeDetected, "Should notify subscribers");
    unsubscribe();

    // Test 6: Wildcard subscription
    console.log("Test 6: Wildcard subscription");
    var wildcardCount = 0;
    state.subscribe("*", function () {
        wildcardCount++;
    });
    state.set("score.teamB", 5);
    state.set("ballCarrier", { x: 10, y: 10 });
    assert(wildcardCount === 2, "Should notify wildcard subscribers");

    // Test 7: Batch mutations
    console.log("Test 7: Batch mutations");
    state.mutate(function (s) {
        s.score.teamA = 20;
        s.score.teamB = 15;
        s.currentTeam = "teamB";
    }, "batch_test");
    assert(state.get("score.teamA") === 20, "Should apply batch mutations");
    assert(state.get("currentTeam") === "teamB", "Should apply batch mutations");

    // Test 8: Snapshot and restore
    console.log("Test 8: Snapshot and restore");
    var snapshot = state.getSnapshot();
    state.set("score.teamA", 999);
    assert(state.get("score.teamA") === 999, "Should change value");
    state.restore(snapshot);
    assert(state.get("score.teamA") === 20, "Should restore snapshot");

    // Test 9: Change log
    console.log("Test 9: Change log");
    var changeLog = state.getChangeLog();
    assert(changeLog.length > 0, "Should have change log");
    assert(changeLog[changeLog.length - 1].reason !== undefined, "Changes should have reasons");

    console.log("✓ All state manager tests passed!");
}

function testEventBus() {
    var events = createEventBus();

    // Test 1: Emit and handle event
    console.log("Test 1: Emit and handle event");
    var eventReceived = false;
    events.on("test_event", function (data) {
        eventReceived = true;
        assert(data.value === 42, "Should receive correct data");
    });
    events.emit("test_event", { value: 42 });
    assert(eventReceived, "Should handle event");

    // Test 2: Multiple handlers
    console.log("Test 2: Multiple handlers");
    var count = 0;
    events.on("multi_event", function () { count++; });
    events.on("multi_event", function () { count++; });
    events.on("multi_event", function () { count++; });
    events.emit("multi_event", {});
    assert(count === 3, "Should call all handlers");

    // Test 3: Wildcard handler
    console.log("Test 3: Wildcard handler");
    var wildcardEvents = [];
    events.on("*", function (data, type) {
        wildcardEvents.push(type);
    });
    events.emit("event1", {});
    events.emit("event2", {});
    events.emit("event3", {});
    assert(wildcardEvents.length === 3, "Should catch all events");
    assert(wildcardEvents[0] === "event1", "Should have correct types");

    // Test 4: Unsubscribe
    console.log("Test 4: Unsubscribe");
    var callCount = 0;
    var unsub = events.on("unsub_test", function () { callCount++; });
    events.emit("unsub_test", {});
    assert(callCount === 1, "Should call before unsubscribe");
    unsub();
    events.emit("unsub_test", {});
    assert(callCount === 1, "Should not call after unsubscribe");

    // Test 5: Event log
    console.log("Test 5: Event log");
    events.clearEventLog();
    events.emit("log_test_1", { a: 1 });
    events.emit("log_test_2", { b: 2 });
    var eventLog = events.getEventLog();
    assert(eventLog.length === 2, "Should log events");
    assert(eventLog[0].type === "log_test_1", "Should log correct type");

    console.log("✓ All event bus tests passed!");
}

function assert(condition, message) {
    if (!condition) {
        throw new Error("Assertion failed: " + message);
    }
}

// Run tests
try {
    runTests();
    process.exit(0);
} catch (e) {
    console.error("\n❌ TEST FAILED:", e.message);
    console.error(e.stack);
    process.exit(1);
}
