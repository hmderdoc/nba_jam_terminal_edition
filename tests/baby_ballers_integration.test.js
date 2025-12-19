#!/sbbs/exec/jsexec

/**
 * Integration test - Load actual baby-ballers module and test it
 */

// Mock the LORB namespace and dependencies
this.LORB = { Util: {}, Core: {}, Data: {}, Engines: {}, View: {} };
this.debugLog = function() {}; // No-op for tests

// Mock bbs
this.bbs = {
    node_num: 999,
    sys_name: "Test System"
};

// Load the actual baby-ballers module
load("/sbbs/xtrn/nba_jam/lib/lorb/data/baby-ballers.js");

var BabyBallers = LORB.Data.BabyBallers;

var failures = [];
var passes = 0;

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        failures.push(message + " (expected: " + expected + ", got: " + actual + ")");
        writeln("\1r✗ FAIL:\1n " + message + " (expected: " + expected + ", got: " + actual + ")");
    } else {
        passes++;
        writeln("\1g✓ PASS:\1n " + message);
    }
}

writeln("\1h\1y=== Baby-Ballers Integration Tests ===\1n");
writeln("");

// Test 1: User's actual scenario
writeln("\1h\1cTest 1: User's exact scenario (loser, chonk abandoned, goner abandoned)\1n");
var userBabies = [
    {
        nickname: "loser",
        childSupport: {
            balance: 3975,
            isPaidOff: false,
            isAbandoned: false
        },
        isNemesis: false
    },
    {
        nickname: "chonk",
        childSupport: {
            balance: 0,
            isPaidOff: false,
            isAbandoned: true,
            abandonedAmount: 3200
        },
        isNemesis: true
    },
    {
        nickname: "goner",
        childSupport: {
            balance: 0,
            isPaidOff: false,
            isAbandoned: true,
            abandonedAmount: 3800
        },
        isNemesis: true
    }
];

// updateParentingStats mutates a context object, doesn't return
var ctx1 = {
    babyBallers: userBabies,
    parentingStats: {}
};

BabyBallers.updateParentingStats(ctx1);
var userStats = ctx1.parentingStats;

assertEqual(userStats.totalSupportOwed, 3975, "User scenario: total should be 3975");
assertEqual(userStats.dependentChildren, 1, "User scenario: 1 dependent");
assertEqual(userStats.abandonedChildren, 0, "User scenario: abandonedChildren not tracked in stats");

// Test 2: calculateBabyMamaBalance with abandoned children
writeln("");
writeln("\1h\1cTest 2: Baby mama balance excluding abandoned\1n");
userBabies[0].motherId = "mama1";
userBabies[1].motherId = "mama1";
userBabies[2].motherId = "mama1";

var mamaBalance = BabyBallers.calculateBabyMamaBalance(ctx1, "mama1");
assertEqual(mamaBalance, 3975, "Mama balance should exclude abandoned children");

// Test 3: All active babies
writeln("");
writeln("\1h\1cTest 3: All babies active\1n");
var allActive = [
    { nickname: "a", childSupport: { balance: 1000, isPaidOff: false, isAbandoned: false } },
    { nickname: "b", childSupport: { balance: 2000, isPaidOff: false, isAbandoned: false } },
    { nickname: "c", childSupport: { balance: 3000, isPaidOff: false, isAbandoned: false } }
];

var ctx3 = { babyBallers: allActive, parentingStats: {} };
BabyBallers.updateParentingStats(ctx3);
var activeStats = ctx3.parentingStats;
assertEqual(activeStats.totalSupportOwed, 6000, "All active: total should be 6000");
assertEqual(activeStats.dependentChildren, 3, "All active: 3 dependent");

// Test 4: All abandoned
writeln("");
writeln("\1h\1cTest 4: All babies abandoned\1n");
var allAbandoned = [
    { nickname: "a", childSupport: { balance: 0, isPaidOff: false, isAbandoned: true, abandonedAmount: 1000 }, isNemesis: true },
    { nickname: "b", childSupport: { balance: 0, isPaidOff: false, isAbandoned: true, abandonedAmount: 2000 }, isNemesis: true }
];

var ctx4 = { babyBallers: allAbandoned, parentingStats: {} };
BabyBallers.updateParentingStats(ctx4);
var abandonedStats = ctx4.parentingStats;
assertEqual(abandonedStats.totalSupportOwed, 0, "All abandoned: total should be 0");
assertEqual(abandonedStats.dependentChildren, 0, "All abandoned: 0 dependent");
assertEqual(abandonedStats.abandonedChildren, 0, "All abandoned: abandonedChildren not tracked");

// Test 5: Mixed with paid off
writeln("");
writeln("\1h\1cTest 5: Mixed with paid off\1n");
var mixed = [
    { nickname: "owes", childSupport: { balance: 5000, isPaidOff: false, isAbandoned: false } },
    { nickname: "paid", childSupport: { balance: 0, isPaidOff: true, isAbandoned: false } },
    { nickname: "abandoned", childSupport: { balance: 0, isPaidOff: false, isAbandoned: true, abandonedAmount: 3000 }, isNemesis: true }
];

var ctx5 = { babyBallers: mixed, parentingStats: {} };
BabyBallers.updateParentingStats(ctx5);
var mixedStats = ctx5.parentingStats;
assertEqual(mixedStats.totalSupportOwed, 5000, "Mixed: total should be 5000");
assertEqual(mixedStats.dependentChildren, 1, "Mixed: 1 dependent");
assertEqual(mixedStats.independentChildren, 1, "Mixed: 1 independent");
assertEqual(mixedStats.abandonedChildren, 0, "Mixed: abandonedChildren not tracked");

// Summary
writeln("");
writeln("\1h\1y=== Test Summary ===\1n");
writeln("\1g✓ Passed:\1n " + passes);
writeln("\1r✗ Failed:\1n " + failures.length);

if (failures.length > 0) {
    writeln("");
    writeln("\1h\1rFailure Details:\1n");
    for (var i = 0; i < failures.length; i++) {
        writeln("  " + (i + 1) + ". " + failures[i]);
    }
    exit(1);
}

writeln("");
writeln("\1h\1gAll integration tests passed! Actual code works correctly.\1n");
exit(0);
