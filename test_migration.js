// Quick test to verify State Manager migration fixes
load("lib/core/state-manager.js");
load("lib/game-logic/game-state.js");
load("lib/core/system-init.js");

// Create minimal systems object
var gameState = createDefaultGameState();
var animationSystem = { animations: [] };

var systems = {
    stateManager: createStateManager(gameState),
    eventBus: { on: function() {}, emit: function() {} }
};

// Test resetGameState initializes score
print("Testing resetGameState score initialization...");
resetGameState({ allCPUMode: true }, systems);
var state = systems.stateManager.get();

if (state.score && state.score.teamA === 0 && state.score.teamB === 0) {
    print("✅ Score initialized correctly: { teamA: 0, teamB: 0 }");
} else {
    print("❌ Score NOT initialized: " + JSON.stringify(state.score));
    exit(1);
}

if (state.consecutivePoints && state.consecutivePoints.teamA === 0 && state.consecutivePoints.teamB === 0) {
    print("✅ ConsecutivePoints initialized correctly");
} else {
    print("❌ ConsecutivePoints NOT initialized: " + JSON.stringify(state.consecutivePoints));
    exit(1);
}

print("\n✅ All State Manager migration tests passed!");
