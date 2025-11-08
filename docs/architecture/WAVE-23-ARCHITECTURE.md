# NBA Jam - Wave 23 Architecture

**Status**: Complete (as of Nov 8, 2025)  
**Branch**: wave-22b-architecture-refactor

## Overview

Wave 23 completed the dependency injection refactor started in Wave 22. The architecture is now based on **explicit systems passing** with no implicit global dependencies in game logic.

## Core Principles

1. **Explicit Dependencies**: All game logic functions receive `systems` parameter
2. **Centralized State**: Single `stateManager` controls all game state mutations
3. **Event-Driven**: `eventBus` for cross-system communication
4. **Testable**: Pure functions with injected dependencies
5. **No Global State Access**: Game logic must use `systems.stateManager.get()`, never direct `gameState` access

## Systems Object Structure

```javascript
var systems = {
    stateManager: StateManager,      // Centralized state with mutation tracking
    eventBus: EventBus,               // Pub/sub for system communication
    shootingSystem: ShootingSystem,   // Shot probability and mechanics
    possessionSystem: PossessionSystem, // Possession changes and validation
    passingSystem: PassingSystem      // Pass mechanics and validation
};
```

## Initialization Flow

```
1. Load error-handler.js FIRST (for crash recovery)
2. Load core systems (state-manager, event-bus, system-init)
3. Load domain systems (shooting, passing, possession)
4. Call initializeSystems(deps) to create systems object
5. Call resetGameState(options, systems) to initialize state
6. Pass systems to all game logic functions
```

### System Initialization (lib/core/system-init.js)

```javascript
function initializeSystems(deps) {
    // Validate required dependencies
    if (!deps.gameState || !deps.animationSystem || !deps.getPlayers 
        || !deps.helpers || !deps.constants) {
        throw new Error("initializeSystems requires all dependencies");
    }

    // Create state manager
    var stateManager = createStateManager(deps.gameState);

    // Create event bus
    var eventBus = createEventBus();

    // Initialize domain systems
    var shootingSystem = initializeShootingSystem({
        stateManager: stateManager,
        animationSystem: deps.animationSystem,
        getPlayers: deps.getPlayers
    });

    var possessionSystem = initializePossessionSystem({
        stateManager: stateManager,
        eventBus: eventBus
    });

    var passingSystem = initializePassingSystem({
        stateManager: stateManager
    });

    return {
        stateManager: stateManager,
        eventBus: eventBus,
        shootingSystem: shootingSystem,
        possessionSystem: possessionSystem,
        passingSystem: passingSystem
    };
}
```

## State Manager API

### Reading State
```javascript
// Get full state
var gameState = systems.stateManager.get();

// Get specific value by path
var ballCarrier = systems.stateManager.get("ballCarrier");
var teamAScore = systems.stateManager.get("score.teamA");
```

### Mutating State
```javascript
// Set with reason tracking
systems.stateManager.set("ballCarrier", player, "steal_success");
systems.stateManager.set("score.teamA", 23, "scored_3pt");

// Get mutation history
var history = systems.stateManager.getHistory();
```

## Event Bus API

### Publishing Events
```javascript
systems.eventBus.publish("possession_changed", {
    oldTeam: "teamA",
    newTeam: "teamB",
    reason: "steal"
});
```

### Subscribing to Events
```javascript
systems.eventBus.subscribe("possession_changed", function(data) {
    updateDefensiveMatchups(data.newTeam);
});
```

## Function Signature Patterns

### Game Logic Functions
```javascript
// CORRECT: Explicit systems parameter
function handleSteal(defender, ballCarrier, systems) {
    var stateManager = systems.stateManager;
    stateManager.set("ballCarrier", defender, "steal_success");
}

// WRONG: Direct global access
function handleSteal(defender, ballCarrier) {
    gameState.ballCarrier = defender; // ❌ No systems parameter
}
```

### UI Functions
```javascript
// UI functions may still use global gameState (for now)
// Wave 23C+ will refactor these
function drawScore(systems) {
    var gameState = systems.stateManager.get();
    // Render using gameState...
}
```

## Domain Systems

### Shooting System (lib/systems/shooting-system.js)
- Shot probability calculation
- Shot validation
- Make/miss determination
- Fire streak tracking

### Possession System (lib/systems/possession-system.js)
- Team possession tracking
- Possession change validation
- Backcourt violation detection

### Passing System (lib/systems/passing-system.js)
- Pass target selection
- Pass validation
- Interception probability

## Migration Status (Wave 23)

### ✅ Completed
- **Core Systems**: State manager, event bus, system init
- **Domain Systems**: Shooting, passing, possession (223 mutations converted)
- **Game Logic**: All functions accept systems parameter
- **Test Suite**: 58/58 tests passing (32 shooting, 15 possession, 5 passing, 6 core)
- **Error Handling**: Automatic error logging with state snapshots

### 🔄 Partial (Wave 23C+)
- **UI Layer**: 144 direct `gameState` references remain (scoreboard, labels, etc.)
- **Timing System**: 31 mswait() blocking calls need EventTimer conversion
- **Multiplayer Sync**: Some legacy code paths

### ❌ Not Started
- **Animation System**: Still uses some global state
- **AI Systems**: Some functions need systems threading
- **Legacy Features**: Old game modes may have issues

## File Organization (Wave 23B)

```
nba_jam/
├── nba_jam.js              # Main entry, loads systems
├── README.md
├── lib/
│   ├── core/               # Foundation systems
│   │   ├── state-manager.js
│   │   ├── event-bus.js
│   │   └── system-init.js
│   ├── systems/            # Domain systems
│   │   ├── shooting-system.js
│   │   ├── possession-system.js
│   │   └── passing-system.js
│   ├── game-logic/         # Game rules (all use systems)
│   ├── ai/                 # AI behavior
│   ├── rendering/          # Graphics
│   └── ui/                 # UI (partial Wave 23 migration)
├── tests/
│   ├── unit/               # System unit tests
│   ├── integration/        # Full game flow tests
│   ├── wave-23/            # Wave 23 specific tests
│   └── legacy/             # Old POC tests
├── docs/
│   ├── architecture/       # This file
│   ├── waves/              # Wave summaries
│   └── debugging/          # Debug guides
├── scripts/
│   └── view-errors.sh      # Error log viewer
└── data/
    ├── error.log           # Runtime errors
    └── error-snapshots/    # State snapshots on crash
```

## Testing

### Unit Tests
```bash
# Run from Synchronet
cd /sbbs/xtrn/nba_jam
./tests/unit/shooting-system.test.js
./tests/unit/possession-system.test.js
./tests/unit/passing-system.test.js
```

### Integration Tests
```bash
./tests/integration/test-game-flow-integration.js
./tests/wave-23/test-architecture-foundation.js
```

### Test Coverage
- **Shooting System**: 32 tests (probability, validation, fire mechanics)
- **Possession System**: 15 tests (changes, violations, validation)
- **Passing System**: 5 tests (validation, interception)
- **Core Systems**: 6 tests (state manager, event bus)

## Error Handling

Automatic error capture with state snapshots:

```javascript
// Errors automatically logged to data/error.log
// State snapshot saved to data/error-snapshots/snapshot-{timestamp}.json
// Reproduction test generated at data/error-snapshots/test-reproduction-{timestamp}.js
```

View errors:
```bash
./scripts/view-errors.sh
```

## Wave 23C Preview: Timing System

**Problem**: Game blows through immediately (animations don't block)

**Cause**: 31 mswait() calls that used to block now execute instantly

**Solution**: EventTimer-based frame scheduler
```javascript
// Instead of: mswait(30)
// Use: animator.scheduleFrame(30, callback)
```

**Locations**:
- `lib/game-logic/dunks.js`: 8 instances (dunk animations)
- `lib/game-logic/physical-play.js`: ~18 instances (loose ball)
- `lib/multiplayer/mp_lobby.js`: 4 instances (UI delays)

## Design Patterns

### Dependency Injection
All systems are injected, not imported:
```javascript
// ✅ GOOD
function gameLoop(systems) {
    handlePlayerInput(input, systems);
    updateAI(systems);
}

// ❌ BAD
var stateManager = require('./state-manager');
function gameLoop() {
    stateManager.set(...); // Implicit dependency
}
```

### Command Pattern (State Mutations)
```javascript
stateManager.set(path, value, reason);
// Creates: { path, value, reason, timestamp }
// Enables: Undo, replay, debugging
```

### Observer Pattern (Events)
```javascript
eventBus.subscribe("possession_changed", handler);
eventBus.publish("possession_changed", data);
// Decouples systems
```

## Common Pitfalls

### 1. Forgetting Systems Parameter
```javascript
// ❌ WRONG
function myFunction(player) {
    gameState.ballCarrier = player;
}

// ✅ CORRECT
function myFunction(player, systems) {
    systems.stateManager.set("ballCarrier", player, "my_function");
}
```

### 2. Using stateManager.getAll()
```javascript
// ❌ WRONG (doesn't exist)
var state = systems.stateManager.getAll();

// ✅ CORRECT
var state = systems.stateManager.get();
```

### 3. UI Functions Without Systems
```javascript
// ❌ WRONG
function drawScore() {
    var flashInfo = getScoreFlashState(); // Crashes
}

// ✅ CORRECT
function drawScore(systems) {
    var flashInfo = getScoreFlashState(systems);
}
```

## Migration Checklist (for new code)

- [ ] Function accepts `systems` parameter
- [ ] All state reads use `systems.stateManager.get()`
- [ ] All state writes use `systems.stateManager.set(path, value, reason)`
- [ ] Events published via `systems.eventBus.publish()`
- [ ] No direct `gameState.foo = bar` assignments
- [ ] Unit tests written using mock systems
- [ ] Integration tests pass

## Next Steps (Wave 23C+)

1. **Timing System**: Replace mswait() with EventTimer
2. **UI Refactor**: Thread systems through remaining UI functions
3. **Animation System**: Convert to non-blocking with callbacks
4. **Multiplayer Sync**: Update for new architecture
5. **Performance**: Profile and optimize state manager

## References

- **Wave 23 Migration Guide**: docs/waves/WAVE-23-MIGRATION-GUIDE.md
- **Error Handling**: docs/WAVE-23-ERROR-HANDLING.md
- **Cleanup Plan**: docs/WAVE-23B-CLEANUP.md
- **Test Suite**: tests/unit/ and tests/integration/
