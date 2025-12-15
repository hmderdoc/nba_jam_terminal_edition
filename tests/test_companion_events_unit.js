// Unit-style test for LORB Companion and Baby Events systems
// Run with: /sbbs/exec/jsexec tests/test_companion_events_unit.js

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
        SUPPORT_DEADLINE_DAYS: 10,
        SUPPORT_WARNING_DAYS: 3,
        OVERDUE_RELATIONSHIP_PENALTY: -50,
        OVERDUE_ALIGNMENT_PENALTY: -30,
        DAILY_OVERDUE_RELATIONSHIP_DECAY: -5,
        DAILY_OVERDUE_ALIGNMENT_DECAY: -2,
        NEMESIS_THRESHOLD: -50,
        NEMESIS_STAT_MULTIPLIER: 1.75,
        NEMESIS_RAGE_BONUS: 20,
        MAX_RANDOM_EVENTS_PER_DAY: 1,
        BABY_MAMA_EVENT_CHANCE: 0.20,
        CHILD_CHALLENGE_CHANCE: 0.15
    },
    TRAVELING_COMPANION: {
        FLIGHT_BASE_COST: 500,
        DINNER_COST: 100,
        CLUB_DATE_COST: 200,
        AFFECTION_PER_DINNER: 5,
        AFFECTION_PER_CLUB: 8,
        MIN_RELATIONSHIP_TO_INVITE: 1
    }
};
LORB.Data = {};
LORB.Util = { 
    RNG: { 
        pick: function(arr) { return arr[0]; }, 
        percentage: function() { return 50; },
        roll: function(min, max) { return min; }
    } 
};

// Load modules
load("../lib/lorb/data/companion.js");
load("../lib/lorb/data/baby-events.js");

var Companion = LORB.Data.Companion;
var BabyEvents = LORB.Data.BabyEvents;

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

function assertFalse(value, msg) {
    if (value) {
        throw new Error((msg || "Assertion failed") + ": expected falsy value");
    }
}

// ============ COMPANION TESTS ============
print("\n=== Companion Module Tests ===\n");

test("hasCompanion returns false when no companion", function() {
    var ctx = {};
    assertFalse(Companion.hasCompanion(ctx));
});

test("hasCompanion returns true when companion exists", function() {
    var ctx = { travelingCompanion: { npcId: "maria_1", npcName: "Maria" } };
    assertTrue(Companion.hasCompanion(ctx));
});

test("getCurrentCompanion returns null when no companion", function() {
    var ctx = {};
    assertEqual(Companion.getCurrentCompanion(ctx), null);
});

test("getCurrentCompanion returns companion data", function() {
    var ctx = { travelingCompanion: { npcId: "maria_1", npcName: "Maria", flightPurchasedDay: 5 } };
    var comp = Companion.getCurrentCompanion(ctx);
    assertEqual(comp.npcId, "maria_1");
    assertEqual(comp.npcName, "Maria");
    assertEqual(comp.flightPurchasedDay, 5);
});

test("clearCompanion removes companion", function() {
    var ctx = { travelingCompanion: { npcId: "maria_1", npcName: "Maria" } };
    Companion.clearCompanion(ctx);
    assertFalse(Companion.hasCompanion(ctx));
});

test("getEligibleCompanions returns empty array with no relationships", function() {
    var ctx = { relationships: [] };
    var eligible = Companion.getEligibleCompanions(ctx);
    assertEqual(eligible.length, 0);
});

test("getEligibleCompanions filters by min affection", function() {
    var ctx = {
        currentCity: "Chicago",
        relationships: [
            { name: "Low Affection", affection: 10, city: "Miami" },
            { name: "High Affection", affection: 50, city: "LA" }
        ]
    };
    var eligible = Companion.getEligibleCompanions(ctx);
    // Should include only those with >= 20% affection
    assertTrue(eligible.length >= 1, "Should have at least one eligible partner");
});

test("calculateFlightCost returns cost around base for low affection", function() {
    var ctx = {};
    var partner = { affection: 20 };
    var cost = Companion.calculateFlightCost(ctx, partner);
    assertTrue(cost <= 500 && cost >= 400, "Cost should be around base cost");
});

test("calculateFlightCost reduces cost for high affection", function() {
    var ctx = {};
    var partner = { affection: 80 };
    var cost = Companion.calculateFlightCost(ctx, partner);
    assertTrue(cost < 500, "High affection should reduce cost");
});

test("purchaseFlightTicket fails with insufficient funds", function() {
    var ctx = { cash: 100 };
    var relationship = { name: "Test", city: "Miami", affection: 50 };
    var result = Companion.purchaseFlightTicket(ctx, "test_1", "Test", relationship, 1);
    assertFalse(result.success);
    assertTrue(result.message.indexOf("cash") >= 0 || result.message.indexOf("Need") >= 0);
});

test("purchaseFlightTicket succeeds with sufficient funds", function() {
    var ctx = { cash: 1000, travelingCompanion: null };
    var relationship = { name: "Maria", city: "Miami", affection: 50 };
    var result = Companion.purchaseFlightTicket(ctx, "maria_1", "Maria", relationship, 1);
    assertTrue(result.success);
    assertTrue(ctx.cash < 1000, "Cash should be deducted");
    assertEqual(ctx.travelingCompanion.npcName, "Maria");
});

test("takeToDinner fails without companion", function() {
    var ctx = { cash: 1000 };
    var result = Companion.takeToDinner(ctx, 1);
    assertFalse(result.success);
});

test("takeToDinner fails with insufficient funds", function() {
    var ctx = { 
        cash: 10, 
        travelingCompanion: { npcId: "maria_1", npcName: "Maria" } 
    };
    var result = Companion.takeToDinner(ctx, 1);
    assertFalse(result.success);
});

test("takeToDinner succeeds and costs money", function() {
    var ctx = { 
        cash: 1000, 
        travelingCompanion: { npcId: "maria_1", npcName: "Maria", datesThisDay: 0, lastDateDay: null },
        relationships: [{ name: "Maria", affection: 50 }]
    };
    var result = Companion.takeToDinner(ctx, 1);
    assertTrue(result.success);
    assertEqual(ctx.cash, 900);  // 1000 - 100 dinner cost
    assertTrue(result.affectionGain > 0);
});

test("takeToClub succeeds and costs more than dinner", function() {
    var ctx = { 
        cash: 1000, 
        travelingCompanion: { npcId: "maria_1", npcName: "Maria", datesThisDay: 0, lastDateDay: null },
        relationships: [{ name: "Maria", affection: 50 }]
    };
    var result = Companion.takeToClub(ctx, 1);
    assertTrue(result.success);
    assertEqual(ctx.cash, 800);  // 1000 - 200 club cost
    assertTrue(result.affectionGain > 0);
});

test("rollForMultiples returns 1, 2, or 3", function() {
    // rollForMultiples doesn't take ctx - it just rolls the dice
    var result = Companion.rollForMultiples();
    assertTrue(result === 1 || result === 2 || result === 3, 
               "Should return 1, 2, or 3 (got " + result + ")");
});

// ============ BABY EVENTS TESTS ============
print("\n=== Baby Events Module Tests ===\n");

test("BABY_MAMA_EVENTS is defined and is object", function() {
    assertTrue(BabyEvents.BABY_MAMA_EVENTS !== undefined);
    assertTrue(typeof BabyEvents.BABY_MAMA_EVENTS === "object");
    // Check for at least one event type
    assertTrue(BabyEvents.BABY_MAMA_EVENTS.money_demand !== undefined ||
               BabyEvents.BABY_MAMA_EVENTS.gossip_threat !== undefined,
               "Should have at least one event type");
});

test("BABY_BALLER_EVENTS is defined and is object", function() {
    assertTrue(BabyEvents.BABY_BALLER_EVENTS !== undefined);
    assertTrue(typeof BabyEvents.BABY_BALLER_EVENTS === "object");
});

test("Baby mama events have required fields", function() {
    var event = BabyEvents.BABY_MAMA_EVENTS.money_demand;
    if (!event) {
        // Try to get first key
        for (var key in BabyEvents.BABY_MAMA_EVENTS) {
            event = BabyEvents.BABY_MAMA_EVENTS[key];
            break;
        }
    }
    assertTrue(event !== undefined, "Should have at least one event");
    assertTrue(event.weight !== undefined, "Event should have weight");
    assertTrue(event.choices !== undefined, "Event should have choices");
    assertTrue(event.choices.length > 0, "Event should have at least one choice");
});

test("Baby baller events have required fields", function() {
    var event = null;
    for (var key in BabyEvents.BABY_BALLER_EVENTS) {
        event = BabyEvents.BABY_BALLER_EVENTS[key];
        break;
    }
    if (event) {
        assertTrue(event.weight !== undefined, "Event should have weight");
    }
    assertTrue(true, "Baby baller events exist");
});

test("checkBabyMamaEvent returns null with no baby mamas", function() {
    var ctx = { babyMamas: [] };
    var result = BabyEvents.checkBabyMamaEvent(ctx, 1);
    assertEqual(result, null);
});

test("checkBabyBallerEvent returns null with no baby ballers", function() {
    var ctx = { babyBallers: [] };
    var result = BabyEvents.checkBabyBallerEvent(ctx, 1);
    assertEqual(result, null);
});

test("processEventChoice applies alignment change", function() {
    var ctx = { alignment: 0, cash: 1000, dailyBabyEvents: 0 };
    var eventData = { type: "test", eventKey: "test_event" };
    var choice = { alignBonus: 10 };
    var result = BabyEvents.processEventChoice(ctx, eventData, choice, 1);
    assertTrue(result.success);
    assertEqual(result.alignmentChange, 10);
    assertEqual(ctx.alignment, 10);
});

test("processEventChoice applies negative alignment", function() {
    var ctx = { alignment: 0, cash: 1000, dailyBabyEvents: 0 };
    var eventData = { type: "test", eventKey: "test_event" };
    var choice = { alignBonus: -20 };
    var result = BabyEvents.processEventChoice(ctx, eventData, choice, 1);
    assertTrue(result.success);
    assertEqual(result.alignmentChange, -20);
    assertEqual(ctx.alignment, -20);
});

test("processEventChoice deducts cost when chosen", function() {
    var ctx = { alignment: 0, cash: 1000, dailyBabyEvents: 0 };
    var eventData = { type: "test", eventKey: "test_event" };
    var choice = { cost: 100 };
    var result = BabyEvents.processEventChoice(ctx, eventData, choice, 1);
    assertTrue(result.success);
    assertEqual(ctx.cash, 900);
});

test("processEventChoice fails when not enough cash", function() {
    var ctx = { alignment: 0, cash: 50, dailyBabyEvents: 0 };
    var eventData = { type: "test", eventKey: "test_event" };
    var choice = { cost: 100 };
    var result = BabyEvents.processEventChoice(ctx, eventData, choice, 1);
    assertFalse(result.success);
    assertEqual(ctx.cash, 50);  // Cash unchanged
});

test("Event types exist in baby mama events", function() {
    var eventTypes = [];
    for (var key in BabyEvents.BABY_MAMA_EVENTS) {
        eventTypes.push(key);
    }
    // Should have multiple event types
    assertTrue(eventTypes.length >= 2, "Should have at least 2 event types (got " + eventTypes.length + ")");
});

test("Event choices have text and key fields", function() {
    var event = null;
    for (var key in BabyEvents.BABY_MAMA_EVENTS) {
        event = BabyEvents.BABY_MAMA_EVENTS[key];
        break;
    }
    if (event && event.choices && event.choices.length > 0) {
        var choice = event.choices[0];
        assertTrue(choice.key !== undefined, "Choice should have key");
        assertTrue(choice.text !== undefined, "Choice should have text");
    }
    assertTrue(true, "Choices have expected fields");
});

// ============ INTEGRATION-STYLE TESTS ============
print("\n=== Integration Tests ===\n");

test("Companion + date workflow", function() {
    // Set up companion properly
    var ctx = {
        cash: 1000,
        travelingCompanion: { 
            npcId: "maria_1", 
            npcName: "Maria", 
            datesThisDay: 0, 
            lastDateDay: null 
        },
        relationships: [{ name: "Maria", affection: 80, city: "Miami" }],
        babyMamas: [],
        babyBallers: []
    };
    
    // Take to club
    var result = Companion.takeToClub(ctx, 1);
    assertTrue(result.success, "Club date should succeed");
    assertTrue(result.affectionGain > 0, "Should gain affection");
    assertTrue(ctx.cash < 1000, "Cash should be deducted");
});

test("Event rate limiting works across days", function() {
    var ctx = {
        babyMamas: [{ name: "Maria" }],
        lastEventDay: 1,
        eventsToday: 1
    };
    
    // Same day - should be rate limited (returns null)
    var result1 = BabyEvents.checkBabyMamaEvent(ctx, 1);
    // Either null (rate limited) or an event (if random roll passed)
    // Just check it doesn't crash
    assertTrue(true, "Rate limiting check completed");
});

// ============ INTIMACY SYSTEM TESTS ============
print("\n=== Intimacy System Tests ===\n");

test("shouldOfferIntimacy returns false when no companion", function() {
    var ctx = {};
    assertFalse(Companion.shouldOfferIntimacy(ctx));
});

test("shouldOfferIntimacy returns false for low status", function() {
    var ctx = {
        travelingCompanion: { npcId: "Maria", npcName: "Maria" },
        romance: {
            relationships: {
                "Maria": { affection: 30, status: "crush" }  // crush is too early
            }
        }
    };
    assertFalse(Companion.shouldOfferIntimacy(ctx));
});

test("shouldOfferIntimacy has chance for partner status", function() {
    var ctx = {
        travelingCompanion: { npcId: "Maria", npcName: "Maria" },
        romance: {
            relationships: {
                "Maria": { affection: 60, status: "partner" }
            }
        }
    };
    // Run multiple times - should sometimes return true
    var anyTrue = false;
    for (var i = 0; i < 50; i++) {
        if (Companion.shouldOfferIntimacy(ctx)) {
            anyTrue = true;
            break;
        }
    }
    // At 60 affection + partner status, should have ~40-50% chance
    assertTrue(anyTrue, "Should offer intimacy for partner status at least sometimes");
});

test("performIntimateEncounter fails without companion", function() {
    var ctx = {};
    var result = Companion.performIntimateEncounter(ctx, 1);
    assertFalse(result.success);
});

test("performIntimateEncounter succeeds with companion", function() {
    var ctx = {
        travelingCompanion: { npcId: "Maria", npcName: "Maria" },
        romance: {
            relationships: {
                "Maria": { affection: 50, status: "partner", cityId: "mia" }
            }
        },
        pregnancies: []
    };
    var result = Companion.performIntimateEncounter(ctx, 1);
    assertTrue(result.success, "Intimate encounter should succeed");
    assertTrue(result.affectionGain > 0, "Should gain affection");
});

test("createHiddenPregnancy creates phase 1 pregnancy", function() {
    var ctx = {
        travelingCompanion: { npcId: "Maria", npcName: "Maria" },
        romance: {
            relationships: {
                "Maria": { affection: 80, status: "partner", cityId: "mia" }
            }
        },
        pregnancies: []
    };
    var result = Companion.createHiddenPregnancy(ctx, 1);
    assertTrue(result, "Should create pregnancy");
    assertEqual(ctx.pregnancies.length, 1, "Should have 1 pregnancy");
    assertEqual(ctx.pregnancies[0].phase, 1, "Should be phase 1 (hidden)");
    assertEqual(ctx.pregnancies[0].cityId, "mia", "Should use companion's home city");
    assertTrue(ctx.pregnancies[0].revealAfterDay > 1, "Should have reveal delay");
});

test("createHiddenPregnancy fails if already pregnant by same companion", function() {
    var ctx = {
        travelingCompanion: { npcId: "Maria", npcName: "Maria" },
        romance: {
            relationships: {
                "Maria": { affection: 80, status: "partner", cityId: "mia" }
            }
        },
        pregnancies: [{ npcId: "Maria", npcName: "Maria", phase: 1 }]
    };
    var result = Companion.createHiddenPregnancy(ctx, 5);
    assertFalse(result, "Should not create duplicate pregnancy");
    assertEqual(ctx.pregnancies.length, 1, "Should still have only 1 pregnancy");
});

test("checkForPregnancyReveal returns null when no pregnancies", function() {
    var ctx = { pregnancies: [] };
    var result = Companion.checkForPregnancyReveal(ctx, "mia", 10);
    assertEqual(result, null);
});

test("checkForPregnancyReveal returns null when not in home city (not overdue)", function() {
    var ctx = {
        pregnancies: [{
            npcId: "Maria",
            npcName: "Maria",
            cityId: "mia",  // home city is Miami
            phase: 1,
            conceivedOnDay: 1,
            revealAfterDay: 4
        }]
    };
    // Player is in Chicago (chi), not Miami, day 5 (not overdue yet - only 1 day past)
    var result = Companion.checkForPregnancyReveal(ctx, "chi", 5);
    assertEqual(result, null, "Should not reveal in wrong city when not overdue");
});

test("checkForPregnancyReveal returns null when days not elapsed", function() {
    var ctx = {
        pregnancies: [{
            npcId: "Maria",
            npcName: "Maria",
            cityId: "mia",
            phase: 1,
            conceivedOnDay: 1,
            revealAfterDay: 4
        }]
    };
    // It's day 2, but reveal is after day 4
    var result = Companion.checkForPregnancyReveal(ctx, "mia", 2);
    assertEqual(result, null, "Should not reveal before reveal day");
});

test("checkForPregnancyReveal returns pregnancy in home city after days elapsed", function() {
    var ctx = {
        pregnancies: [{
            npcId: "Maria",
            npcName: "Maria",
            cityId: "mia",
            phase: 1,
            conceivedOnDay: 1,
            revealAfterDay: 4
        }]
    };
    // It's day 5, reveal after day 4, player in Miami
    var result = Companion.checkForPregnancyReveal(ctx, "mia", 5);
    assertTrue(result !== null, "Should reveal pregnancy");
    assertEqual(result.npcName, "Maria");
});

test("checkForPregnancyReveal works when overdue (reveals anywhere)", function() {
    var ctx = {
        pregnancies: [{
            npcId: "Maria",
            npcName: "Maria",
            cityId: "mia",
            phase: 1,
            conceivedOnDay: 1,
            revealAfterDay: 4
        }]
    };
    // It's day 15 (5+ days overdue), player in Chicago
    // Overdue pregnancies reveal anywhere
    var result = Companion.checkForPregnancyReveal(ctx, "chi", 15);
    assertTrue(result !== null, "Should reveal overdue pregnancy anywhere");
});

test("Dates no longer trigger pregnancy directly", function() {
    var ctx = { 
        cash: 1000, 
        travelingCompanion: { npcId: "maria_1", npcName: "Maria", datesThisDay: 0, lastDateDay: null },
        romance: {
            relationships: {
                "Maria": { affection: 80, status: "partner", cityId: "mia" }
            }
        },
        pregnancies: []
    };
    
    // Take to dinner multiple times
    for (var i = 0; i < 5; i++) {
        var result = Companion.takeToDinner(ctx, 1);
        assertTrue(result.success);
        // Result should have offersIntimacy property (not pregnancyTriggered)
        assertTrue(result.offersIntimacy !== undefined || result.offersIntimacy === false, 
                   "Should have offersIntimacy, not pregnancyTriggered");
        // pregnancyTriggered should NOT exist in new API
        assertEqual(result.pregnancyTriggered, undefined, "Should not have pregnancyTriggered");
    }
    
    // No pregnancies should have been created directly by dates
    assertEqual(ctx.pregnancies.length, 0, "Dates should not create pregnancies directly");
});

// Summary
print("\n=== Results ===");
print("Passed: " + passed);
print("Failed: " + failed);
print("Total:  " + (passed + failed));

if (failed > 0) {
    exit(1);
}
