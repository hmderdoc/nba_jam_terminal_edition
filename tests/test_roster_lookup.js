/**
 * test_roster_lookup.js - Test the roster_lookup module
 * 
 * Run with: /sbbs/exec/jsexec /sbbs/xtrn/nba_jam/tests/test_roster_lookup.js
 */

// Use absolute path for loading LORB modules
var NBA_JAM_ROOT = "/sbbs/xtrn/nba_jam/";

// Initialize LORB namespace
if (!this.LORB) this.LORB = { Util: {}, Core: {}, Data: {}, Engines: {}, View: {} };

// Load just the modules we need for testing
load(NBA_JAM_ROOT + "lib/lorb/config.js");
load(NBA_JAM_ROOT + "lib/lorb/data/roster_lookup.js");

print("");
print("=== Testing LORB.Data.Roster ===");
print("");

// Test 1: getPlayer by normalized ID
var melo = LORB.Data.Roster.getPlayer("carmelo_anthony");
if (melo) {
    print("✓ Found Carmelo Anthony:");
    print("    Name: " + melo.name);
    print("    Team: " + melo.team);
    print("    Position: " + melo.position + " (" + melo.positionName + ")");
    print("    Stats: SPD=" + melo.stats.speed + " 3PT=" + melo.stats.threePt + " DNK=" + melo.stats.dunk);
    print("    ShortNick: " + melo.shortNick);
    print("    Rivals: " + JSON.stringify(melo.rivals));
} else {
    print("✗ ERROR: Could not find Carmelo Anthony");
}

print("");

// Test 2: getAllPlayers count
var allPlayers = LORB.Data.Roster.getAllPlayers();
var count = Object.keys(allPlayers).length;
print("✓ Total players loaded: " + count);

// Test 3: normalizeId
var normalized = LORB.Data.Roster.normalizeId("LeBron James (2016)");
print("✓ normalizeId('LeBron James (2016)') = '" + normalized + "'");

// Test 4: parsePosition
var pos = LORB.Data.Roster.parsePosition("guard");
print("✓ parsePosition('guard') = " + pos.id + " (" + pos.name + ")");

// Test 5: getTeam
var nuggets = LORB.Data.Roster.getTeam("nuggets");
if (nuggets) {
    print("✓ Found team: " + nuggets.name + " (" + nuggets.abbr + ")");
} else {
    print("✗ Could not find Nuggets team");
}

print("");
print("=== All tests passed ===");
print("");
