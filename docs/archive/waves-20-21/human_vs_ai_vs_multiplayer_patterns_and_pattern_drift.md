# NBA JAM Terminal Edition - Pattern Drift Analysis

Analysis of how human player, AI player, and multiplayer patterns have evolved and drifted from each other over time.

---

## Overview

The codebase started as single-player (human vs AI), then added demo mode (AI vs AI), then multiplayer (human vs human). Each mode shares core game logic but has evolved different patterns for input, state management, and synchronization.

---

## Pattern Evolution Timeline

```
Phase 1: Single Player (Initial)
├─ Human input: Direct console.inkey()
├─ AI: Simple behavior tree
└─ State: Global gameState object

Phase 2: Demo Mode (Added)
├─ All AI players
├─ Betting system overlay
└─ Same state management

Phase 3: Multiplayer (Added)
├─ Network input via JSON-DB
├─ Coordinator/client split
├─ Client-side prediction
└─ Dual state systems (local + server)
```

---

## Input Pattern Drift

### Single Player Pattern
```javascript
// Direct input processing
function gameLoop() {
    var key = console.inkey(K_NONE, 0);
    handleHumanPlayer(teamAPlayer1, key);
    updateAI();  // Other 3 players
}
```

### Multiplayer Pattern
```javascript
// Network input with prediction
function multiplayerGameLoop() {
    // Coordinator: Collect network inputs
    if (coordinator.isCoordinator) {
        coordinator.collectInputs();
        coordinator.processInputs();
    }
    
    // Client: Predict + reconcile
    if (!playerClient.isCoordinator) {
        playerClient.predictMovement();
    }
    playerClient.update();
}
```

**Drift**:
- Single-player: Synchronous input → immediate sprite update
- Multiplayer: Asynchronous input → prediction → reconciliation
- **No shared abstraction** for input handling

### Recommended Unification

```javascript
// Unified input interface
class InputSource {
    getInput(player) { /* abstract */ }
}

class LocalInput extends InputSource {
    getInput(player) {
        return console.inkey(K_NONE, 0);
    }
}

class NetworkInput extends InputSource {
    getInput(player) {
        return client.read("input." + player.id);
    }
}

class AIInput extends InputSource {
    getInput(player) {
        return calculateAIAction(player);
    }
}

// Game loop uses interface
function unifiedGameLoop() {
    for (var player in players) {
        var input = player.inputSource.getInput(player);
        applyInput(player, input);
    }
}
```

---

## State Management Drift

### Single Player State
```javascript
// Single global state
var gameState = {
    gameRunning: true,
    ballCarrier: teamAPlayer1,
    scores: { teamA: 0, teamB: 0 },
    // ... everything in one object
};
```

### Multiplayer State
```javascript
// DUAL state systems
var gameState = { /* local state */ };
var serverState = coordinator.getServerState();  // Authority
var clientPrediction = playerClient.getPredictedState();  // Optimistic

// Reconciliation required
playerClient.reconcile(serverState, clientPrediction);
```

**Drift**:
- Single-player: Single source of truth
- Multiplayer: Multiple states (server, client, predicted)
- **Different state lifecycles**

### Pattern Mismatch

| Aspect | Single Player | Multiplayer |
|--------|--------------|-------------|
| Authority | Local | Server (coordinator) |
| State Updates | Immediate | Delayed (network) |
| Prediction | None | Client-side |
| Reconciliation | N/A | Required |
| Rollback | N/A | Potential (not implemented) |

---

## AI Behavior Drift

### Single Player AI
```javascript
// AI has full game state access
function updateAI() {
    var player = teamBPlayer1;
    
    // Direct access to everything
    if (gameState.shotClock < 5) {
        aiTakeShot(player);
    }
    
    if (gameState.ballCarrier === player) {
        handleAIBallCarrier(player);
    }
}
```

### Multiplayer AI
```javascript
// AI runs ONLY on coordinator
function updateMultiplayerAI() {
    if (!coordinator.isCoordinator) {
        return;  // Clients don't run AI
    }
    
    // Coordinator runs AI for CPU players only
    for (var player in cpuPlayers) {
        updateAI(player);
    }
}
```

**Drift**:
- Single-player: AI updates every frame for 3 players
- Multiplayer: AI updates only on coordinator, only for CPU players
- **Different execution contexts**

### Issue: AI Desync Risk

```javascript
// PROBLEM: AI might diverge if coordinator changes
if (originalCoordinator.crashes()) {
    newCoordinator.elected();  // AI state lost!
    
    // AI decisions might differ
    // - Different random seeds
    // - Different timing
    // - Lost intermediate state
}
```

**Solution**: Make AI deterministic or sync AI state

---

## Timing and Frame Rate Drift

### Single Player Timing
```javascript
// Fixed 20 FPS
var frameDelay = 50;  // ms

function gameLoop() {
    while (gameRunning) {
        var start = Date.now();
        
        updateGame();
        render();
        
        var elapsed = Date.now() - start;
        mswait(frameDelay - elapsed);
    }
}
```

### Multiplayer Timing
```javascript
// Variable timing due to network
var targetFrameTime = 50;
var actualFrameTime = 50 + networkLatency;  // 50-300ms

function multiplayerGameLoop() {
    // Coordinator runs at 20 Hz
    if (Date.now() - lastUpdate > 50) {
        coordinator.update();
        lastUpdate = Date.now();
    }
    
    // Clients run as fast as possible (prediction)
    playerClient.update();
    
    mswait(targetFrameTime);  // But limited to 20 FPS
}
```

**Drift**:
- Single-player: Consistent 20 FPS
- Multiplayer: 20 Hz updates, but variable latency
- **Timing assumes** synchronous execution

---

## Event Broadcasting Drift

### Single Player Events
```javascript
// Direct announcer calls
if (shotMade) {
    announceEvent("score", {
        player: shooter,
        points: 2
    });
    
    // Immediate display
    drawAnnouncerLine("HE SCORES!");
}
```

### Multiplayer Events
```javascript
// Coordinator broadcasts, clients display
if (coordinator.isCoordinator && shotMade) {
    // Announce locally
    announceEvent("score", {...});
    
    // Broadcast to clients
    coordinator.broadcastEvent("score", {...});
}

// Clients receive and display
if (!coordinator.isCoordinator) {
    var events = serverState.events;
    for (var event of events) {
        displayEvent(event);  // Don't re-announce
    }
}
```

**Drift**:
- Single-player: Events fire immediately
- Multiplayer: Events batched and broadcast
- **Duplication risk** (coordinator sees event twice)

---

## Code Duplication Due to Drift

### Duplicated Game Loops

**`gameLoop()`** (single-player) - 250+ lines
**`runMultiplayerGameLoop()`** (multiplayer) - 400+ lines

**Overlap**: ~70% shared logic
- Clock updates
- Violation checking
- Physics
- Rendering

**Unique**:
- Single-player: Direct input
- Multiplayer: Network sync

### Opportunity: Extract Shared Logic

```javascript
// REFACTORED: Shared game loop template
function coreGameLogic() {
    updateClock();
    checkViolations();
    checkSpriteCollision();
    updateAnimations();
}

// Single-player wrapper
function singlePlayerLoop() {
    while (running) {
        handleHumanInput();
        updateAI();
        coreGameLogic();
        render();
    }
}

// Multiplayer wrapper
function multiplayerLoop() {
    while (running) {
        if (isCoordinator) {
            collectNetworkInputs();
            processNetworkInputs();
            updateAI();  // CPU players only
            coreGameLogic();
            broadcastState();
        } else {
            predictMovement();
            sendInput();
            receiveState();
            reconcile();
        }
        render();
    }
}
```

**Benefit**: ~200 lines of duplicate code eliminated

---

## Sprite Management Drift

### Single Player Sprites
```javascript
// Global sprite variables
var teamAPlayer1 = createPlayerSprite(...);
var teamAPlayer2 = createPlayerSprite(...);

// Direct access
function getAllPlayers() {
    return [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
}
```

### Multiplayer Sprites
```javascript
// Sprite registry (map)
var spriteMap = {
    "player_abc": teamAPlayer1,
    "player_def": teamAPlayer2,
    "player_ghi": teamBPlayer1,
    "player_jkl": teamBPlayer2
};

// Lookup by ID
function getSpriteById(id) {
    return spriteMap[id];
}
```

**Drift**:
- Single-player: Global references
- Multiplayer: ID-based lookup
- **Dual systems** for same sprites

---

## Pattern Drift Summary

| System | Single Player | Multiplayer | Drift Severity |
|--------|--------------|-------------|----------------|
| Input | Synchronous | Asynchronous + prediction | High |
| State | Single | Dual (local + server) | High |
| Timing | Fixed 20 FPS | Variable (network) | Medium |
| Events | Immediate | Batched + broadcast | Medium |
| Sprites | Globals | Registry | Medium |
| AI | All frames | Coordinator only | Low |
| Game Loop | Simple | Complex (coord/client) | High |

---

## Recommendations

### Phase 1: Unify Input Abstraction
Create `InputSource` interface for local/network/AI inputs

### Phase 2: Extract Shared Game Logic
Move core logic to `coreGameLogic()`, called by both loops

### Phase 3: Migrate to Sprite Registry
Eliminate global sprite variables, use registry everywhere

### Phase 4: Standardize Event System
Use observer pattern consistently for single/multiplayer

### Phase 5: Unify State Management
Create `StateManager` that handles local/server states transparently

---

## Conclusion

**Pattern Drift Impact**:
- **High Code Duplication**: ~30% of game loop code is duplicated
- **Maintenance Burden**: Bugs must be fixed in multiple places
- **Complexity**: Different mental models for each mode
- **Testing Difficulty**: Must test each mode separately

**Root Cause**:
Multiplayer was **bolted on** rather than designed into core architecture from the start.

**Long-Term Solution**:
Refactor to **mode-agnostic core** with mode-specific wrappers.

**Estimated Effort**: 20-30 hours  
**Payoff**: 40% reduction in code duplication, easier maintenance
