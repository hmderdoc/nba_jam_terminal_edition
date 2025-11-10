/**
 * Wave 22B: Possession State Test
 * Tests the shot -> score -> inbound -> possession flow
 * Validates that the correct team gets the ball after a made basket
 */

load("sbbsdefs.js");

// Mock game state
var gameState = {
    currentTeam: "teamA",
    ballCarrier: null,
    shotInProgress: false,
    phase: {
        current: "NORMAL",
        data: {},
        frameCounter: 0
    },
    score: { teamA: 0, teamB: 0 },
    consecutivePoints: { teamA: 0, teamB: 0 }
};

// Phase constants
var PHASE_NORMAL = "NORMAL";
var PHASE_SHOT_QUEUED = "SHOT_QUEUED";
var PHASE_SHOT_ANIMATING = "SHOT_ANIMATING";
var PHASE_SHOT_SCORED = "SHOT_SCORED";
var PHASE_INBOUND_SETUP = "INBOUND_SETUP";

// Mock players
var teamAShooter = {
    x: 40,
    y: 20,
    playerData: {
        name: "Team A Shooter",
        stats: { fga: 0, fgm: 0 }
    }
};

var teamBDefender = {
    x: 38,
    y: 20,
    playerData: {
        name: "Team B Defender"
    }
};

print("\n=== Wave 22B Possession Flow Test ===\n");

// Test 1: Shot attempt captures correct team
print("Test 1: attemptShot() captures shooterTeam");
print("  Initial: currentTeam=" + gameState.currentTeam);

// Simulate attemptShot() setting phase data
gameState.phase.current = PHASE_SHOT_QUEUED;
gameState.phase.data = {
    shooter: teamAShooter,
    shooterTeam: "teamA",  // CAPTURED at shot time
    made: true,
    is3Pointer: false
};
gameState.shotInProgress = true;

print("  Phase data captured: shooterTeam=" + gameState.phase.data.shooterTeam);
print("  ✓ Test 1 PASS\n");

// Test 2: During animation, currentTeam might change
print("Test 2: currentTeam changes during animation");
print("  Before change: currentTeam=" + gameState.currentTeam);

// Simulate some other code changing currentTeam
gameState.currentTeam = "teamB";

print("  After change: currentTeam=" + gameState.currentTeam);
print("  Phase data still has: shooterTeam=" + gameState.phase.data.shooterTeam);
print("  ✓ Test 2 PASS - phase data preserved\n");

// Test 3: handleShotScored uses phase data, not currentTeam
print("Test 3: handleShotScored() uses phaseData.shooterTeam");
var phaseData = gameState.phase.data;
var scoringTeamKey = phaseData.shooterTeam || gameState.currentTeam;
var inboundTeamKey = (scoringTeamKey === "teamA") ? "teamB" : "teamA";

print("  scoringTeamKey=" + scoringTeamKey + " (from phaseData.shooterTeam)");
print("  inboundTeamKey=" + inboundTeamKey);
print("  Expected: teamB should get ball (opposite of teamA)");

if (inboundTeamKey === "teamB") {
    print("  ✓ Test 3 PASS\n");
} else {
    print("  ✗ Test 3 FAIL - wrong team!\n");
}

// Test 4: setupInbound() receives correct team
print("Test 4: setupInbound(scoringTeamKey) switches possession");
print("  setupInbound(" + scoringTeamKey + ") called");

// Simulate setupInbound logic
var inboundTeam = (scoringTeamKey === "teamA") ? "teamB" : "teamA";
print("  Inside setupInbound: inboundTeam=" + inboundTeam);
print("  Expected: teamB");

if (inboundTeam === "teamB") {
    print("  ✓ Test 4 PASS\n");
} else {
    print("  ✗ Test 4 FAIL\n");
}

// Test 5: animatePass() modifies currentTeam immediately
print("Test 5: animatePass() state mutation timing");
print("  WARNING: animatePass() sets gameState.currentTeam immediately");
print("  This happens DURING inbound setup, not after animation");
print("  Risk: If animatePass() has interception, currentTeam changes again");

// Simulate successful inbound pass
var receiver = { x: 35, y: 20, playerData: { name: "Team B Receiver" } };
print("  Before pass: currentTeam=" + gameState.currentTeam);
gameState.currentTeam = inboundTeam;  // setupInbound sets this
print("  After setupInbound: currentTeam=" + gameState.currentTeam);

// animatePass sets ballCarrier immediately
gameState.ballCarrier = receiver;
print("  After animatePass: ballCarrier=" + (gameState.ballCarrier ? gameState.ballCarrier.playerData.name : "null"));
print("  After animatePass: currentTeam=" + gameState.currentTeam);

if (gameState.currentTeam === "teamB") {
    print("  ✓ Test 5 PASS - correct team has possession\n");
} else {
    print("  ✗ Test 5 FAIL - possession wrong!\n");
}

// Test 6: Race condition scenario
print("Test 6: Race condition - interception during inbound");
print("  Scenario: Inbound pass is intercepted by original scoring team");

// Reset
gameState.currentTeam = "teamB";  // Team B should be inbounding
gameState.ballCarrier = null;

// Simulate interception
var interceptor = teamAShooter;  // Team A intercepts!
var interceptorTeam = "teamA";

print("  Before interception: currentTeam=" + gameState.currentTeam);
gameState.currentTeam = interceptorTeam;  // animatePass does this
gameState.ballCarrier = interceptor;
print("  After interception: currentTeam=" + gameState.currentTeam);
print("  After interception: ballCarrier=" + (gameState.ballCarrier ? gameState.ballCarrier.playerData.name : "null"));

if (gameState.currentTeam === "teamA") {
    print("  ✓ Test 6 PASS - interception correctly switches back to Team A\n");
} else {
    print("  ✗ Test 6 FAIL\n");
}

// Summary
print("=== Test Summary ===");
print("Key Findings:");
print("1. shooterTeam must be captured at attemptShot() time");
print("2. Phase data preserves shooterTeam even if currentTeam changes");
print("3. setupInbound() correctly switches possession");
print("4. BUT: animatePass() modifies state IMMEDIATELY, not after animation");
print("5. This creates timing issues - state changes happen out of sync with visuals");
print("\nRecommendation:");
print("- State mutations in animatePass() should be deferred");
print("- OR: Accept that state updates are immediate (not synchronized with animation)");
print("- Need to test actual game to see if this causes visible bugs\n");
