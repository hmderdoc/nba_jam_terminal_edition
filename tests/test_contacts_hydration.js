/**
 * test_contacts_hydration.js - Test contact hydration from minimal storage
 * 
 * Run with: /sbbs/exec/jsexec /sbbs/xtrn/nba_jam/tests/test_contacts_hydration.js
 */

// Use absolute path for loading LORB modules
var NBA_JAM_ROOT = "/sbbs/xtrn/nba_jam/";

// Initialize LORB namespace
if (!this.LORB) this.LORB = { Util: {}, Core: {}, Data: {}, Engines: {}, View: {} };

// Load required modules
load(NBA_JAM_ROOT + "lib/lorb/config.js");
load(NBA_JAM_ROOT + "lib/lorb/data/roster_lookup.js");
load(NBA_JAM_ROOT + "lib/lorb/util/contacts.js");

print("");
print("=== Testing Contact Hydration ===");
print("");

// Test 1: Create a minimal contact (simulating what's stored in lorb.json)
var minimalContact = {
    id: "carmelo_anthony",
    type: "nba",
    status: "contact",
    dateAcquired: 1765248543870
};

print("Minimal contact stored:");
print("  " + JSON.stringify(minimalContact));
print("");

// Test 2: Hydrate the contact
var hydrated = LORB.Util.Contacts.hydrateContact(minimalContact);

print("Hydrated contact:");
print("  id: " + hydrated.id);
print("  name: " + hydrated.name);
print("  team: " + hydrated.team);
print("  position: " + hydrated.position + " (" + hydrated.positionName + ")");
print("  status: " + hydrated.status);
print("  tier: " + hydrated.tier);
print("  signCost: $" + hydrated.signCost);
print("  cutPercent: " + hydrated.cutPercent + "%");
print("  stats: SPD=" + hydrated.stats.speed + " 3PT=" + hydrated.stats.threePt + " DNK=" + hydrated.stats.dunk);
print("  skin: " + hydrated.skin);
print("  shortNick: " + hydrated.shortNick);
print("  rivals: " + JSON.stringify(hydrated.rivals));
print("  dateAcquired: " + hydrated.dateAcquired);
print("");

// Test 3: Verify key fields are populated
var passed = true;
if (!hydrated.name) { print("✗ FAIL: name is missing"); passed = false; }
if (!hydrated.team) { print("✗ FAIL: team is missing"); passed = false; }
if (!hydrated.stats) { print("✗ FAIL: stats is missing"); passed = false; }
if (!hydrated.shortNick) { print("✗ FAIL: shortNick is missing"); passed = false; }
if (hydrated.status !== "contact") { print("✗ FAIL: status was changed"); passed = false; }
if (hydrated.dateAcquired !== 1765248543870) { print("✗ FAIL: dateAcquired was changed"); passed = false; }

// Test 4: Test starter companion (legend) - should NOT be modified
var starterContact = {
    id: "sonic_hedgehog",
    type: "legend",
    name: "Sonic",
    team: "Green Hill Zone",
    status: "signed",
    isStarter: true,
    stats: { speed: 10, threePt: 5, dunk: 2, block: 2, power: 2, steal: 7 }
};

var starterHydrated = LORB.Util.Contacts.hydrateContact(starterContact);
if (starterHydrated.name !== "Sonic") { print("✗ FAIL: Legend name was modified"); passed = false; }
if (starterHydrated.team !== "Green Hill Zone") { print("✗ FAIL: Legend team was modified"); passed = false; }
print("✓ Starter companion (legend) preserved correctly");

// Test 5: Test unknown player (not in roster) - should return fallback
var unknownContact = {
    id: "unknown_player",
    type: "nba",
    status: "contact",
    dateAcquired: Date.now()
};

var unknownHydrated = LORB.Util.Contacts.hydrateContact(unknownContact);
if (!unknownHydrated.name) { print("✗ FAIL: Unknown player has no fallback name"); passed = false; }
print("✓ Unknown player fallback: " + unknownHydrated.name);

print("");
if (passed) {
    print("=== All tests PASSED ===");
} else {
    print("=== Some tests FAILED ===");
}
print("");
