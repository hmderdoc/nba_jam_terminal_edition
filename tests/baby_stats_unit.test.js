#!/sbbs/exec/jsexec

/**
 * Direct unit tests for updateParentingStats calculation
 * No dependencies, just pure logic testing
 */

var failures = [];
var passes = 0;

function assert(condition, message) {
    if (!condition) {
        failures.push(message);
        writeln("\1r✗ FAIL:\1n " + message);
    } else {
        passes++;
        writeln("\1g✓ PASS:\1n " + message);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        failures.push(message + " (expected: " + expected + ", got: " + actual + ")");
        writeln("\1r✗ FAIL:\1n " + message + " (expected: " + expected + ", got: " + actual + ")");
    } else {
        passes++;
        writeln("\1g✓ PASS:\1n " + message);
    }
}

// Recreate the EXACT logic from baby-ballers.js updateParentingStats
function updateParentingStats(babies) {
    var stats = {
        totalBabies: babies.length,
        dependentChildren: 0,
        independentChildren: 0,
        abandonedChildren: 0,
        totalSupportOwed: 0
    };

    for (var i = 0; i < babies.length; i++) {
        var baby = babies[i];
        
        if (baby.childSupport && baby.childSupport.isAbandoned) {
            stats.abandonedChildren++;
        } else if (baby.childSupport && baby.childSupport.isPaidOff) {
            stats.independentChildren++;
        } else {
            stats.dependentChildren++;
            stats.totalSupportOwed += baby.childSupport.balance;
        }
    }

    return stats;
}

writeln("\1h\1y=== Baby Support Unit Tests ===\1n");
writeln("");

// Test 1: All babies active
writeln("\1h\1cTest 1: All babies with active support\1n");
var test1Babies = [
    { nickname: "a", childSupport: { balance: 3975, isPaidOff: false, isAbandoned: false } },
    { nickname: "b", childSupport: { balance: 3200, isPaidOff: false, isAbandoned: false } },
    { nickname: "c", childSupport: { balance: 3800, isPaidOff: false, isAbandoned: false } }
];
var stats1 = updateParentingStats(test1Babies);
assertEqual(stats1.totalSupportOwed, 10975, "All active: total should be 10975");
assertEqual(stats1.dependentChildren, 3, "All active: 3 dependent");
assertEqual(stats1.abandonedChildren, 0, "All active: 0 abandoned");

// Test 2: Two abandoned
writeln("");
writeln("\1h\1cTest 2: Two babies abandoned\1n");
var test2Babies = [
    { nickname: "loser", childSupport: { balance: 3975, isPaidOff: false, isAbandoned: false } },
    { nickname: "chonk", childSupport: { balance: 0, isPaidOff: false, isAbandoned: true, abandonedAmount: 3200 } },
    { nickname: "goner", childSupport: { balance: 0, isPaidOff: false, isAbandoned: true, abandonedAmount: 3800 } }
];
var stats2 = updateParentingStats(test2Babies);
assertEqual(stats2.totalSupportOwed, 3975, "Two abandoned: total should be 3975");
assertEqual(stats2.dependentChildren, 1, "Two abandoned: 1 dependent");
assertEqual(stats2.abandonedChildren, 2, "Two abandoned: 2 abandoned");

// Test 3: One paid off
writeln("");
writeln("\1h\1cTest 3: One baby paid off\1n");
var test3Babies = [
    { nickname: "paid", childSupport: { balance: 0, isPaidOff: true, isAbandoned: false } },
    { nickname: "owes", childSupport: { balance: 5000, isPaidOff: false, isAbandoned: false } }
];
var stats3 = updateParentingStats(test3Babies);
assertEqual(stats3.totalSupportOwed, 5000, "Paid off: total should be 5000");
assertEqual(stats3.dependentChildren, 1, "Paid off: 1 dependent");
assertEqual(stats3.independentChildren, 1, "Paid off: 1 independent");
assertEqual(stats3.abandonedChildren, 0, "Paid off: 0 abandoned");

// Test 4: Mixed scenario
writeln("");
writeln("\1h\1cTest 4: Mixed scenario\1n");
var test4Babies = [
    { nickname: "owes1", childSupport: { balance: 1000, isPaidOff: false, isAbandoned: false } },
    { nickname: "owes2", childSupport: { balance: 2000, isPaidOff: false, isAbandoned: false } },
    { nickname: "paid", childSupport: { balance: 0, isPaidOff: true, isAbandoned: false } },
    { nickname: "abandoned", childSupport: { balance: 0, isPaidOff: false, isAbandoned: true, abandonedAmount: 5000 } }
];
var stats4 = updateParentingStats(test4Babies);
assertEqual(stats4.totalSupportOwed, 3000, "Mixed: total should be 3000");
assertEqual(stats4.dependentChildren, 2, "Mixed: 2 dependent");
assertEqual(stats4.independentChildren, 1, "Mixed: 1 independent");
assertEqual(stats4.abandonedChildren, 1, "Mixed: 1 abandoned");

// Test 5: Edge case - balance added only ONCE per child
writeln("");
writeln("\1h\1cTest 5: Verify no duplicate addition\1n");
var test5Babies = [
    { nickname: "test", childSupport: { balance: 100, isPaidOff: false, isAbandoned: false } }
];
var stats5 = updateParentingStats(test5Babies);
assertEqual(stats5.totalSupportOwed, 100, "Single baby: should be 100, not 200 (no duplicate)");

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
writeln("\1h\1gAll tests passed! Logic is correct.\1n");
exit(0);
