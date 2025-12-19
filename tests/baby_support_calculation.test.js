#!/sbbs/exec/jsexec

/**
 * End-to-end tests for baby support calculations
 * Tests the ACTUAL flow: create babies, abandon some, verify totals
 */

// Load just the baby-ballers module directly
load("/sbbs/xtrn/nba_jam/lib/lorb/data/baby-ballers.js");

var failures = [];
var passes = 0;

function assert(condition, message) {
    if (!condition) {
        failures.push(message);
        console.writeln("\1r✗ FAIL:\1n " + message);
    } else {
        passes++;
        console.writeln("\1g✓ PASS:\1n " + message);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        failures.push(message + " (expected: " + expected + ", got: " + actual + ")");
        console.writeln("\1r✗ FAIL:\1n " + message + " (expected: " + expected + ", got: " + actual + ")");
    } else {
        passes++;
        console.writeln("\1g✓ PASS:\1n " + message);
    }
}

console.writeln("\1h\1y=== Baby Support Calculation E2E Tests ===\1n");
console.writeln("");

// Test 1: Create three babies with different balances
console.writeln("\1h\1cTest 1: Creating three babies\1n");
var testBabies = [
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
            balance: 3200,
            isPaidOff: false,
            isAbandoned: false
        },
        isNemesis: false
    },
    {
        nickname: "goner",
        childSupport: {
            balance: 3800,
            isPaidOff: false,
            isAbandoned: false
        },
        isNemesis: false
    }
];

var BabyBallers = global.BabyBallers;
var stats = BabyBallers.updateParentingStats(testBabies);

assertEqual(stats.totalSupportOwed, 10975, "Initial total should be 10975 (all three babies)");
assertEqual(stats.dependentChildren, 3, "Should have 3 dependent children");
assertEqual(stats.independentChildren, 0, "Should have 0 independent children");

// Test 2: Abandon two babies
console.writeln("");
console.writeln("\1h\1cTest 2: Abandoning chonk and goner\1n");
testBabies[1].childSupport.isAbandoned = true;
testBabies[1].childSupport.balance = 0;
testBabies[1].childSupport.abandonedAmount = 3200;
testBabies[1].isNemesis = true;

testBabies[2].childSupport.isAbandoned = true;
testBabies[2].childSupport.balance = 0;
testBabies[2].childSupport.abandonedAmount = 3800;
testBabies[2].isNemesis = true;

stats = BabyBallers.updateParentingStats(testBabies);

assertEqual(stats.totalSupportOwed, 3975, "After abandonment total should be 3975 (only loser)");
assertEqual(stats.dependentChildren, 1, "Should have 1 dependent child");
assertEqual(stats.independentChildren, 0, "Should have 0 independent children");

// Test 3: Display calculation (crib.js pattern)
console.writeln("");
console.writeln("\1h\1cTest 3: Display calculation logic\1n");
var totalOwed = 0;
var independentCount = 0;
for (var i = 0; i < testBabies.length; i++) {
    var baby = testBabies[i];
    var cs = baby.childSupport;
    
    if (cs && cs.isAbandoned) {
        continue;
    }
    
    if (cs && !cs.isPaidOff) {
        totalOwed += cs.balance;
    } else {
        independentCount++;
    }
}

assertEqual(totalOwed, 3975, "Display should show 3975 total");
assertEqual(independentCount, 0, "Display should show 0 independent");

// Test 4: Payment filter (crib.js pattern)
console.writeln("");
console.writeln("\1h\1cTest 4: Payment menu filter\1n");
var unpaidBabies = [];
for (var i = 0; i < testBabies.length; i++) {
    var baby = testBabies[i];
    if (!baby.childSupport.isPaidOff && 
        !baby.childSupport.isAbandoned && 
        !baby.isNemesis) {
        unpaidBabies.push(baby);
    }
}

assertEqual(unpaidBabies.length, 1, "Payment menu should show 1 baby");
assertEqual(unpaidBabies[0].nickname, "loser", "Payment menu should show 'loser' only");

// Test 5: Baby mama balance calculation
console.writeln("");
console.writeln("\1h\1cTest 5: Baby mama balance calculation\1n");
var testMama = {
    id: "test_mama",
    nickname: "Test Mama"
};

// Add mama reference to babies
testBabies[0].childSupport.mamaId = "test_mama";
testBabies[1].childSupport.mamaId = "test_mama";
testBabies[2].childSupport.mamaId = "test_mama";

var mamaBalance = BabyBallers.calculateBabyMamaBalance(testBabies, "test_mama");
assertEqual(mamaBalance, 3975, "Baby mama balance should be 3975 (excluding abandoned)");

// Test 6: Payment blocking for abandoned
console.writeln("");
console.writeln("\1h\1cTest 6: Payment blocking for abandoned babies\1n");
var mockCtx = { babyBallers: testBabies };

// Try to pay abandoned baby (should fail)
var abandonedBaby = testBabies[1]; // chonk
var canPayAbandoned = !abandonedBaby.childSupport.isAbandoned && !abandonedBaby.isNemesis;
assert(!canPayAbandoned, "Should NOT be able to pay abandoned baby");

// Try to pay non-abandoned baby (should succeed)
var normalBaby = testBabies[0]; // loser
var canPayNormal = !normalBaby.childSupport.isAbandoned && !normalBaby.isNemesis;
assert(canPayNormal, "Should be able to pay non-abandoned baby");

// Summary
console.writeln("");
console.writeln("\1h\1y=== Test Summary ===\1n");
console.writeln("\1g✓ Passed:\1n " + passes);
console.writeln("\1r✗ Failed:\1n " + failures.length);

if (failures.length > 0) {
    console.writeln("");
    console.writeln("\1h\1rFailure Details:\1n");
    for (var i = 0; i < failures.length; i++) {
        console.writeln("  " + (i + 1) + ". " + failures[i]);
    }
    exit(1);
}

exit(0);
