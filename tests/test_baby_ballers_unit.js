// Unit-style test for LORB Baby Baller system
// Run with: /sbbs/exec/jsexec tests/test_baby_ballers_unit.js

// Mock LORB namespace (minimal setup)
if (typeof LORB === "undefined") LORB = {};
LORB.Config = {
    BABY_BALLERS: {
        PREGNANCY_CHANCE_NORMAL: 0.10,
        PREGNANCY_CHANCE_MARRIED: 0.15,
        MULTIPLE_CHANCE_TRAVELING_COMPANION: 0.20,
        CHILD_SUPPORT_BASE: 500,
        CHILD_SUPPORT_PER_LEVEL: 50,
        LUMP_SUM_DISCOUNT: 0.25,
        XP_PER_WIN: 100,
        REP_PER_WIN: 10,
        XP_PER_GAME: 25,
        XP_TO_LEVEL: 1000,
        MAX_LEVEL: 20,
        ALIGNMENT_BONUS_THRESHOLD: 50,
        ALIGNMENT_PENALTY_THRESHOLD: -50,
        // Deadline system config
        SUPPORT_DEADLINE_DAYS: 10,
        SUPPORT_WARNING_DAYS: 3,
        OVERDUE_RELATIONSHIP_PENALTY: -50,
        OVERDUE_ALIGNMENT_PENALTY: -30,
        DAILY_OVERDUE_RELATIONSHIP_DECAY: -5,
        DAILY_OVERDUE_ALIGNMENT_DECAY: -2,
        NEMESIS_THRESHOLD: -50,
        NEMESIS_STAT_MULTIPLIER: 1.75,
        NEMESIS_RAGE_BONUS: 20
    }
};
LORB.Data = {};
LORB.Util = { RNG: { pick: function(arr) { return arr[0]; }, percentage: function() { return 50; } } };

// Load baby-ballers module
load("../lib/lorb/data/baby-ballers.js");

var BB = LORB.Data.BabyBallers;

var passed = 0;
var failed = 0;

function test(name, fn) {
    try {
        fn();
        print("✓ " + name);
        passed++;
    } catch(e) {
        print("✗ " + name + ": " + e.message);
        failed++;
    }
}

function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error((msg || "Assertion failed") + ": expected " + expected + ", got " + actual);
    }
}

function assertTrue(value, msg) {
    if (!value) {
        throw new Error((msg || "Assertion failed") + ": expected truthy value");
    }
}

// Tests
print("\n=== Baby Baller Unit Tests ===\n");

test("STAT_NAMES contains expected stats", function() {
    var expected = ["speed", "threePt", "dunk", "block", "power", "steal"];
    for (var i = 0; i < expected.length; i++) {
        assertTrue(BB.STAT_NAMES.indexOf(expected[i]) >= 0, "Missing stat: " + expected[i]);
    }
});

test("COURT_TIER_NAMES has all tiers", function() {
    assertEqual(BB.COURT_TIER_NAMES["1"], "Middle School");
    assertEqual(BB.COURT_TIER_NAMES["5"], "NBA");
});

test("generateBabyStats returns valid stats object", function() {
    var stats = BB.generateBabyStats(50, 60, false);
    assertTrue(typeof stats === "object", "Should return object");
    assertTrue(typeof stats.speed === "number", "Should have speed");
    assertTrue(typeof stats.threePt === "number", "Should have threePt");
    assertTrue(stats.speed >= 1 && stats.speed <= 99, "Speed in valid range");
});

test("calculateTotalStats sums correctly", function() {
    var stats = { speed: 10, threePt: 20, dunk: 30, block: 15, power: 25, steal: 10 };
    var total = BB.calculateTotalStats(stats);
    assertEqual(total, 110);
});

test("rollBabyAppearance returns valid appearance", function() {
    var appearance = BB.rollBabyAppearance({ skin: "light" });
    assertTrue(typeof appearance === "object", "Should return object");
    assertTrue(typeof appearance.skin === "string", "Should have skin");
    assertTrue(typeof appearance.jerseyColor === "string", "Should have jerseyColor");
});

test("generateBabyName returns string", function() {
    var name = BB.generateBabyName("male");
    assertTrue(typeof name === "string", "Should return string");
    assertTrue(name.length > 0, "Name should not be empty");
});

test("generateNickname returns string", function() {
    var nickname = BB.generateNickname("male");
    assertTrue(typeof nickname === "string", "Should return string");
    assertTrue(nickname.length > 0, "Nickname should not be empty");
});

test("calculateChildSupportCost calculates based on stats", function() {
    // API takes stats object, not level
    var stats = { speed: 50, threePt: 50, dunk: 50, block: 50, power: 50, steal: 50 };
    var cost = BB.calculateChildSupportCost(stats);
    // Base 2000 + (300 totalStats * 100 per stat) = 32000
    assertEqual(cost, 32000, "Total cost based on stats");
});

test("calculateLumpSumPrice applies discount", function() {
    var lumpSum = BB.calculateLumpSumPrice(1000);
    assertEqual(lumpSum, 750, "25% discount"); // 1000 * 0.75
});

test("getCourtTierName returns correct names", function() {
    assertEqual(BB.getCourtTierName(1), "Middle School");
    assertEqual(BB.getCourtTierName(2), "High School");
    assertEqual(BB.getCourtTierName(3), "AAU");
    assertEqual(BB.getCourtTierName(4), "College");
    assertEqual(BB.getCourtTierName(5), "NBA");
    assertEqual(BB.getCourtTierName(99), "Unknown");
});

test("createBabyBaller creates valid baby", function() {
    // API takes ctx object as first param
    var mockCtx = {
        baseStats: { speed: 50, threePt: 50, dunk: 50, block: 50, power: 50, steal: 50 },
        appearance: { skin: "light" },
        name: "TestPlayer",
        nickname: "TESTER"
    };
    var baby = BB.createBabyBaller(mockCtx, "mama1", "Mama Name", false, null, null);
    assertTrue(typeof baby === "object", "Should return object");
    assertTrue(baby.id && baby.id.length > 0, "Should have ID");
    assertEqual(baby.motherId, "mama1");
    assertEqual(baby.motherName, "Mama Name");
    assertEqual(baby.level, 1, "Starts at level 1");
    assertEqual(baby.xp, 0, "Starts with 0 XP");
    assertTrue(baby.stats && typeof baby.stats.speed === "number", "Should have stats");
    assertTrue(baby.appearance && typeof baby.appearance.skin === "string", "Should have appearance");
    assertTrue(baby.childSupport && baby.childSupport.balance > 0, "Should have child support debt");
});

test("PARENTING_EFFECTS has all modes", function() {
    // Actual modes: nurture, neglect, abandon
    assertTrue(typeof BB.PARENTING_EFFECTS.nurture === "object", "Should have nurture");
    assertTrue(typeof BB.PARENTING_EFFECTS.neglect === "object", "Should have neglect");
    assertTrue(typeof BB.PARENTING_EFFECTS.abandon === "object", "Should have abandon");
});

test("getSupportStatusString handles various balances", function() {
    // API expects baby object with childSupport.isPaidOff
    var baby = { childSupport: { isPaidOff: true, balance: 0 } };
    var str = BB.getSupportStatusString(baby);
    assertTrue(str.indexOf("INDEPENDENT") >= 0, "Paid in full");
    
    baby = { childSupport: { isPaidOff: false, balance: 500 } };
    str = BB.getSupportStatusString(baby);
    assertTrue(str.indexOf("500") >= 0, "Shows balance");
});

test("getRelationshipString returns appropriate descriptions", function() {
    // API expects baby object with relationship number
    var baby = { relationship: 100, isNemesis: false };
    var str = BB.getRelationshipString(baby);
    assertTrue(str.indexOf("Loving") >= 0, "High alignment");
    
    baby = { relationship: -100, isNemesis: false };
    str = BB.getRelationshipString(baby);
    assertTrue(str.indexOf("Hostile") >= 0, "Very negative alignment");
    
    baby = { relationship: -50, isNemesis: true };
    str = BB.getRelationshipString(baby);
    assertTrue(str.indexOf("NEMESIS") >= 0, "Nemesis flag");
});

// ========== PHASE 2: Child Support Economy Tests ==========

test("makePayment reduces balance and takes cash", function() {
    var mockCtx = {
        cash: 1000,
        babyBallers: [{
            id: "test_baby_1",
            childSupport: { balance: 500, totalOwed: 500, isPaidOff: false }
        }]
    };
    
    var result = BB.makePayment(mockCtx, "test_baby_1", 200);
    assertTrue(result.success, "Payment should succeed");
    assertEqual(result.amountPaid, 200);
    assertEqual(result.remaining, 300);
    assertEqual(mockCtx.cash, 800, "Cash reduced");
    assertEqual(mockCtx.babyBallers[0].childSupport.balance, 300, "Balance reduced");
});

test("makePayment caps at balance", function() {
    var mockCtx = {
        cash: 1000,
        babyBallers: [{
            id: "test_baby_2",
            childSupport: { balance: 200, totalOwed: 200, isPaidOff: false }
        }]
    };
    
    var result = BB.makePayment(mockCtx, "test_baby_2", 500);
    assertTrue(result.success, "Payment should succeed");
    assertEqual(result.amountPaid, 200, "Capped at balance");
    assertEqual(mockCtx.cash, 800, "Only charged actual amount");
    assertTrue(result.paidOff, "Should be paid off");
});

test("makePayment fails with insufficient funds", function() {
    var mockCtx = {
        cash: 50,
        babyBallers: [{
            id: "test_baby_3",
            childSupport: { balance: 500, totalOwed: 500, isPaidOff: false }
        }]
    };
    
    var result = BB.makePayment(mockCtx, "test_baby_3", 200);
    assertTrue(!result.success, "Payment should fail");
    assertEqual(mockCtx.cash, 50, "Cash unchanged");
});

test("payLumpSum applies discount", function() {
    var mockCtx = {
        cash: 1000,
        babyBallers: [{
            id: "test_baby_4",
            childSupport: { balance: 1000, totalOwed: 1000, isPaidOff: false }
        }]
    };
    
    var result = BB.payLumpSum(mockCtx, "test_baby_4");
    assertTrue(result.success, "Lump sum should succeed");
    assertEqual(mockCtx.cash, 250, "Charged 750 (25% off 1000)");
    assertTrue(mockCtx.babyBallers[0].childSupport.isPaidOff, "Should be paid off");
});

test("processStreetballWinnings splits 50/50 when owing", function() {
    var mockCtx = {
        cash: 0,
        babyBallers: [{
            id: "test_baby_5",
            childSupport: { balance: 1000, totalOwed: 1000, isPaidOff: false },
            streetballEarnings: 0,
            earningsToSupport: 0,
            parentingMode: "nurture"
        }]
    };
    
    var result = BB.processStreetballWinnings(mockCtx, "test_baby_5", 100);
    assertEqual(result.toSupport, 50, "50% to support");
    assertEqual(result.babyKept, 50, "50% kept by baby");
    assertEqual(mockCtx.babyBallers[0].childSupport.balance, 950, "Balance reduced");
});

// === DEADLINE / NEMESIS TESTS ===

test("getDeadlineStatus returns 'paid' for paid off baby", function() {
    var baby = {
        childSupport: { isPaidOff: true, balance: 0 }
    };
    var status = BB.getDeadlineStatus(baby, 10);
    assertEqual(status.status, "paid");
});

test("getDeadlineStatus returns 'overdue' for past due baby", function() {
    var baby = {
        childSupport: { isPaidOff: false, isOverdue: true, dueDate: 5 }
    };
    var status = BB.getDeadlineStatus(baby, 10);
    assertEqual(status.status, "overdue");
    assertEqual(status.daysOverdue, 5);
});

test("getDeadlineStatus returns 'warning' when near deadline", function() {
    // Config: SUPPORT_WARNING_DAYS defaults to 3
    var baby = {
        childSupport: { isPaidOff: false, isOverdue: false, dueDate: 12 }
    };
    var status = BB.getDeadlineStatus(baby, 10);  // 2 days remaining
    assertEqual(status.status, "warning");
    assertEqual(status.daysRemaining, 2);
});

test("getDeadlineStatus returns 'ok' when deadline is far", function() {
    var baby = {
        childSupport: { isPaidOff: false, isOverdue: false, dueDate: 20 }
    };
    var status = BB.getDeadlineStatus(baby, 10);  // 10 days remaining
    assertEqual(status.status, "ok");
    assertEqual(status.daysRemaining, 10);
});

test("triggerOverdue sets isOverdue flag", function() {
    var mockCtx = {
        babyBallers: [{
            id: "test_overdue",
            relationship: 75,
            isNemesis: false,
            childSupport: { balance: 500, totalOwed: 500, isPaidOff: false, isOverdue: false }
        }]
    };
    
    var result = BB.triggerOverdue(mockCtx, "test_overdue", 10);
    assertTrue(result.success, "Should succeed");
    assertTrue(mockCtx.babyBallers[0].childSupport.isOverdue, "Should be marked overdue");
    assertEqual(mockCtx.babyBallers[0].childSupport.overdueDay, 10);
    assertTrue(result.relationshipHit < 0, "Should have relationship penalty");
});

test("triggerOverdue converts to nemesis when relationship drops below threshold", function() {
    var mockCtx = {
        babyBallers: [{
            id: "test_nemesis",
            relationship: -30,  // Close to threshold (-50)
            isNemesis: false,
            childSupport: { balance: 500, totalOwed: 500, isPaidOff: false, isOverdue: false }
        }],
        parentingStats: { nemesisChildren: 0 }
    };
    
    var result = BB.triggerOverdue(mockCtx, "test_nemesis", 10);
    assertTrue(result.success, "Should succeed");
    assertTrue(mockCtx.babyBallers[0].isNemesis, "Should become nemesis");
    assertTrue(result.becameNemesis, "Result should indicate nemesis conversion");
});

test("applyDailyOverdueDecay decreases relationship", function() {
    var mockCtx = {
        babyBallers: [{
            id: "test_decay",
            relationship: 0,
            isNemesis: false,
            childSupport: { balance: 500, isPaidOff: false, isOverdue: true }
        }]
    };
    
    var result = BB.applyDailyOverdueDecay(mockCtx, "test_decay");
    assertTrue(result.success, "Should succeed");
    assertTrue(mockCtx.babyBallers[0].relationship < 0, "Relationship should decrease");
});

test("getNemesisStats returns boosted stats for nemesis", function() {
    var baby = {
        isNemesis: true,
        stats: { speed: 5, threePt: 5, dunk: 5, block: 5, power: 5, steal: 5 }
    };
    
    var boosted = BB.getNemesisStats(baby);
    assertTrue(boosted.speed > baby.stats.speed, "Speed should be boosted");
    assertTrue(boosted.threePt > baby.stats.threePt, "ThreePt should be boosted");
});

test("getNemesisStats returns normal stats for non-nemesis", function() {
    var baby = {
        isNemesis: false,
        stats: { speed: 50, threePt: 50, dunk: 50, block: 50, power: 50, steal: 50 }
    };
    
    var result = BB.getNemesisStats(baby);
    assertEqual(result.speed, 50, "Should return unchanged stats for non-nemesis");
});

test("isNemesisMatchup returns true for nemesis child", function() {
    var mockCtx = {
        babyBallers: [
            { id: "normal_kid", isNemesis: false },
            { id: "nemesis_kid", isNemesis: true }
        ]
    };
    
    assertTrue(BB.isNemesisMatchup(mockCtx, "nemesis_kid"), "Should detect nemesis");
    assertTrue(!BB.isNemesisMatchup(mockCtx, "normal_kid"), "Should not detect normal kid");
});

test("getOverdueBabies returns only overdue babies", function() {
    var mockCtx = {
        babyBallers: [
            { id: "paid", childSupport: { isPaidOff: true, isOverdue: false } },
            { id: "owing", childSupport: { isPaidOff: false, isOverdue: false } },
            { id: "overdue", childSupport: { isPaidOff: false, isOverdue: true } }
        ]
    };
    
    var overdue = BB.getOverdueBabies(mockCtx);
    assertEqual(overdue.length, 1);
    assertEqual(overdue[0].id, "overdue");
});

test("processDeadlineChecks processes all babies", function() {
    var mockCtx = {
        babyBallers: [
            { id: "ok", childSupport: { isPaidOff: false, isOverdue: false, dueDate: 30, balance: 500 }, relationship: 75, isNemesis: false },
            { id: "paid", childSupport: { isPaidOff: true, balance: 0 }, relationship: 100, isNemesis: false }
        ]
    };
    
    var result = BB.processDeadlineChecks(mockCtx, 10);
    assertEqual(result.processed, 2);
    assertEqual(result.newOverdue.length, 0);
});

test("makePayment resolves overdue status", function() {
    var mockCtx = {
        cash: 1000,
        babyBallers: [{
            id: "overdue_baby",
            childSupport: { balance: 500, totalOwed: 500, isPaidOff: false, isOverdue: true },
            isNemesis: true
        }]
    };
    
    var result = BB.makePayment(mockCtx, "overdue_baby", 500);
    assertTrue(result.success, "Payment should succeed");
    assertTrue(result.paidOff, "Should be paid off");
    assertTrue(result.overdueResolved, "Overdue should be resolved");
    assertTrue(result.stillNemesis, "Nemesis status should persist");
    assertTrue(!mockCtx.babyBallers[0].childSupport.isOverdue, "isOverdue flag should be cleared");
});

// ============================================================
// ALIGNMENT SYSTEM TESTS
// ============================================================

// Load alignment module
load("../lib/lorb/data/alignment.js");
var Alignment = LORB.Data.Alignment;

test("Alignment module loads successfully", function() {
    assertTrue(Alignment, "Alignment module should exist");
    assertTrue(typeof Alignment.adjust === "function", "adjust function should exist");
    assertTrue(typeof Alignment.getTitle === "function", "getTitle function should exist");
    assertTrue(typeof Alignment.getModifiers === "function", "getModifiers function should exist");
});

test("ensureAlignment initializes alignment to 0", function() {
    var mockCtx = {};
    Alignment.ensureAlignment(mockCtx);
    assertEqual(mockCtx.alignment, 0);
});

test("adjust modifies alignment correctly", function() {
    var mockCtx = { alignment: 0 };
    var result = Alignment.adjust(mockCtx, "test_action", 10);
    assertEqual(mockCtx.alignment, 10);
    assertEqual(result.oldValue, 0);
    assertEqual(result.newValue, 10);
    assertEqual(result.change, 10);
});

test("adjust clamps to -100 minimum", function() {
    var mockCtx = { alignment: 0 };
    Alignment.adjust(mockCtx, "big_penalty", -150);
    assertEqual(mockCtx.alignment, -100);
});

test("adjust clamps to +100 maximum", function() {
    var mockCtx = { alignment: 0 };
    Alignment.adjust(mockCtx, "big_bonus", 150);
    assertEqual(mockCtx.alignment, 100);
});

test("getTitle returns correct title for positive alignment", function() {
    var info = Alignment.getTitle(85);
    assertEqual(info.title, "Saint");
});

test("getTitle returns correct title for negative alignment", function() {
    var info = Alignment.getTitle(-65);
    assertEqual(info.title, "Absent Father");
});

test("getTitle returns neutral for 0 alignment", function() {
    var info = Alignment.getTitle(0);
    assertEqual(info.title, "Neutral");
});

test("getModifiers returns saint modifiers for high alignment", function() {
    var mods = Alignment.getModifiers(80);
    assertEqual(mods.repMultiplier, 1.25);
    assertEqual(mods.flirtBonus, 15);
});

test("getModifiers returns monster modifiers for very low alignment", function() {
    var mods = Alignment.getModifiers(-80);
    assertEqual(mods.repMultiplier, 0.75);
    assertEqual(mods.flirtBonus, -25);
});

test("getModifiers returns neutral modifiers for 0 alignment", function() {
    var mods = Alignment.getModifiers(0);
    assertEqual(mods.repMultiplier, 1.0);
    assertEqual(mods.flirtBonus, 0);
});

test("applyRepModifier applies correct multiplier", function() {
    var mockCtx = { alignment: 80 };  // Saint tier
    var modified = Alignment.applyRepModifier(mockCtx, 100);
    assertEqual(modified, 125);  // 100 * 1.25
});

test("applyRepModifier applies penalty for bad alignment", function() {
    var mockCtx = { alignment: -80 };  // Monster tier
    var modified = Alignment.applyRepModifier(mockCtx, 100);
    assertEqual(modified, 75);  // 100 * 0.75
});

test("applyFlirtModifier adds bonus for good alignment", function() {
    var mockCtx = { alignment: 80 };
    var modified = Alignment.applyFlirtModifier(mockCtx, 50);
    assertEqual(modified, 65);  // 50 + 15
});

test("applyFlirtModifier applies penalty for bad alignment", function() {
    var mockCtx = { alignment: -80 };
    var modified = Alignment.applyFlirtModifier(mockCtx, 50);
    assertEqual(modified, 25);  // 50 - 25
});

test("applyPriceModifier gives discount for good alignment", function() {
    var mockCtx = { alignment: 80 };
    var modified = Alignment.applyPriceModifier(mockCtx, 1000);
    assertEqual(modified, 950);  // 1000 * 0.95 (5% discount)
});

test("applyPriceModifier adds markup for bad alignment", function() {
    var mockCtx = { alignment: -80 };
    var modified = Alignment.applyPriceModifier(mockCtx, 1000);
    assertEqual(modified, 1100);  // 1000 * 1.10 (10% markup)
});

test("getAlignmentBar returns string", function() {
    var bar = Alignment.getAlignmentBar(50);
    assertTrue(typeof bar === "string", "Should return a string");
    assertTrue(bar.length > 0, "Should have content");
});

test("getAlignmentDisplay returns formatted string", function() {
    var mockCtx = { alignment: 50 };
    var display = Alignment.getAlignmentDisplay(mockCtx);
    assertTrue(typeof display === "string", "Should return a string");
    assertTrue(display.indexOf("+50") >= 0 || display.indexOf("50") >= 0, "Should contain alignment value");
});

test("getChildEncounterRate returns 0 for monsters", function() {
    var mockCtx = { alignment: -80 };
    var rate = Alignment.getChildEncounterRate(mockCtx);
    assertEqual(rate, 0);
});

test("getChildEncounterRate returns 0.5 for saints", function() {
    var mockCtx = { alignment: 80 };
    var rate = Alignment.getChildEncounterRate(mockCtx);
    assertEqual(rate, 0.5);
});

// Summary
print("\n=== Results ===");
print("Passed: " + passed);
print("Failed: " + failed);
print("Total:  " + (passed + failed));

if (failed > 0) {
    exit(1);
}
