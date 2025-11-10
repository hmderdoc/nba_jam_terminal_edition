# NBA JAM Terminal Edition - Architecture Patterns

This document identifies and describes the architectural patterns used throughout the codebase.

---

## Table of Contents

1. [State Machine Pattern](#state-machine-pattern)
2. [Observer Pattern](#observer-pattern)
3. [Coordinator Pattern](#coordinator-pattern)
4. [Strategy Pattern](#strategy-pattern)
5. [Module Pattern](#module-pattern)
6. [Data Transfer Object (DTO)](#data-transfer-object-dto)
7. [Singleton Pattern](#singleton-pattern)
8. [Template Method Pattern](#template-method-pattern)

---

## 1. State Machine Pattern

### Description
Centralized game state with well-defined transitions and state validation.

### Implementation
**File**: `lib/core/state-management.js`

```javascript
var gameState = {
    // Current state
    gameRunning: false,
    currentHalf: 1,
    timeRemaining: 0,
    shotClock: 24,
    
    // Ball possession
    currentTeam: "teamA",
    ballCarrier: null,
    inbounding: false,
    
    // Violation tracking
    frontcourtEstablished: false,
    ballHandlerStuckTimer: 0,
    ballHandlerDeadSince: null,
    
    // Transitions
    resetGameState: function(options) { ... }
};
```

### States
1. **Pre-Game**: `gameRunning = false`, no ball carrier
2. **In Play**: `gameRunning = true`, ball carrier assigned
3. **Dead Ball**: `inbounding = true`, clock stopped
4. **Halftime**: `currentHalf` transition, special screen
5. **Game Over**: `timeRemaining <= 0`, final state

### Transitions
- **Tip-off** → In Play (possession assigned)
- **Score** → Dead Ball (inbound state)
- **Violation** → Dead Ball (possession change)
- **End of Half** → Halftime → Dead Ball
- **End of Game** → Game Over

### Benefits
- Single source of truth for game state
- Clear state transitions prevent illegal states
- Easy to serialize for multiplayer sync

### Usage
Every game loop iteration checks and updates state:
```javascript
while (gameState.gameRunning && gameState.timeRemaining > 0) {
    // State-dependent logic
    if (gameState.inbounding) { ... }
    if (gameState.ballCarrier) { ... }
}
```

---

## 2. Observer Pattern

### Description
Event-based notifications for game events (scoring, violations, special moves).

### Implementation
**File**: `lib/ui/announcer.js`

```javascript
function announceEvent(eventType, data) {
    // Lookup announcement templates
    var templates = announcerData[eventType];
    
    // Select random announcement
    var announcement = selectRandomAnnouncement(templates, data);
    
    // Broadcast to observers
    drawAnnouncerLine(announcement);
    
    // Optional: record stat
    if (eventType === "score") {
        recordStat(data.player, "points", data.value);
    }
}
```

### Event Types
- `game_start` - Game begins
- `score` - Points scored
- `dunk` - Dunk completion
- `3pointer` - Three-point shot
- `assist` - Assist recorded
- `steal` - Steal attempt
- `block` - Shot blocked
- `shot_clock_violation` - 24-second violation
- `backcourt_violation` - 8-second violation
- `five_second_violation` - Closely guarded

### Observers
1. **Announcer System** - Displays play-by-play text
2. **Stats Tracker** - Records statistics
3. **Multiplayer Coordinator** - Broadcasts events to clients
4. **Hot Streak System** - Tracks consecutive scores

### Benefits
- Decoupled event producers (game logic) from consumers (UI, stats)
- Easy to add new event handlers
- Centralizes event logging/debugging

### Usage Example
```javascript
// Game logic broadcasts event
if (shotSuccessful) {
    announceEvent("score", {
        player: shooter,
        value: pointValue,
        team: teamName
    });
}

// Multiple systems react independently
// - Announcer shows "HE'S ON FIRE!"
// - Stats increment shooter.points
// - Coordinator syncs to clients
```

---

## 3. Coordinator Pattern

### Description
Authoritative server pattern for multiplayer synchronization.

### Implementation
**Files**: 
- `lib/multiplayer/mp_coordinator.js` - Server
- `lib/multiplayer/mp_client.js` - Clients

```javascript
// Coordinator (authoritative)
class GameCoordinator {
    init() {
        this.isCoordinator = true;
        this.frameNumber = 0;
    }
    
    update() {
        // Run game logic
        runGameLogic();
        
        // Broadcast state to all clients
        this.broadcastState(gameState);
    }
}

// Client (non-authoritative)
class PlayerClient {
    update() {
        // Send my input
        this.sendInput(myActions);
        
        // Receive server state
        var serverState = this.receiveState();
        
        // Reconcile (prediction + correction)
        this.reconcileState(serverState);
    }
}
```

### Architecture
```
Player 1 (Coordinator)          Player 2 (Client)
┌──────────────────┐           ┌──────────────────┐
│ Run Game Logic   │           │ Predict Movement │
│ Process Inputs   │           │ Send Input       │
│ Broadcast State  │ ───────>  │ Receive State    │
│                  │           │ Reconcile        │
└──────────────────┘           └──────────────────┘
```

### Responsibilities

**Coordinator**:
- Run authoritative game logic
- Process all player inputs
- Resolve conflicts (collisions, ball possession)
- Broadcast canonical state

**Clients**:
- Capture local player input
- Transmit inputs to coordinator
- Predict movement (reduce latency feel)
- Reconcile with server state

### Benefits
- Single authority prevents desync
- Clients get responsive local prediction
- Conflict resolution centralized

### Challenges
- Coordinator has higher CPU load
- Network latency affects responsiveness
- Prediction errors cause "rubber-banding"

---

## 4. Strategy Pattern

### Description
Interchangeable AI behavior strategies based on game context.

### Implementation
**Files**: `lib/ai/ai-ball-handler.js`, `lib/ai/ai-movement.js`

```javascript
function updateAI() {
    var allPlayers = getAllPlayers();
    
    for (var i = 0; i < allPlayers.length; i++) {
        var player = allPlayers[i];
        
        if (!player.isHuman) {
            // Select strategy based on context
            if (player === gameState.ballCarrier) {
                handleAIBallCarrier(player);  // Ball handler strategy
            } else if (player.team === gameState.currentTeam) {
                handleAIOffBall(player);      // Offensive strategy
            } else {
                handleAIDefense(player);      // Defensive strategy
            }
        }
    }
}
```

### AI Strategies

**1. Ball Handler Strategy** (`ai-ball-handler.js`):
- Drive to basket
- Look for open teammate
- Take shot when in range
- Avoid defenders

**2. Off-Ball Offensive Strategy** (`ai-movement.js`):
- Find open space
- Set screens
- Cut to basket
- Position for rebound

**3. Defensive Strategy** (`ai-movement.js`):
- Guard assigned opponent
- Help defense
- Contest shots
- Steal attempts

### Decision Tree Example
```javascript
function handleAIBallCarrier(player) {
    var shotQuality = evaluateShootingPosition(player);
    var openTeammate = getOpenTeammate(player);
    var pressured = isCloselyGuarded(player);
    
    // Strategy selection
    if (shotQuality > 0.8) {
        return aiTakeShot(player);
    } else if (pressured && openTeammate) {
        return aiPassToOpen(player, openTeammate);
    } else {
        return aiDribbleToBasket(player);
    }
}
```

### Benefits
- AI behavior adapts to game context
- Easy to tune individual strategies
- Strategies are testable in isolation

---

## 5. Module Pattern

### Description
Encapsulation of related functions into cohesive modules with clear interfaces.

### Implementation
Each module exports specific functions, hides internal helpers.

**Example**: `lib/utils/positioning-helpers.js`
```javascript
// Public API
function getSpriteDistance(sprite1, sprite2) {
    return calculateDistance(sprite1.x, sprite1.y, sprite2.x, sprite2.y);
}

function getSpriteDistanceToBasket(player, teamName) {
    var basketX = getBasketPosition(teamName);
    return calculateDistance(player.x, player.y, basketX, BASKET_Y);
}

// Private helper (not directly called from outside)
function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Public helper
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
```

### Module Categories

**Utilities** (stateless):
- `positioning-helpers.js` - Spatial calculations
- `string-helpers.js` - Formatting
- `player-helpers.js` - Player queries

**Systems** (stateful):
- `state-management.js` - Game state
- `stats-tracker.js` - Statistics
- `animation-system.js` - Animations

**UI Components**:
- `announcer.js` - Commentary
- `score-display.js` - HUD
- `menus.js` - Menus

### Benefits
- Clear module boundaries
- Dependencies explicit (via `load()` statements)
- Easy to locate functionality
- Supports independent testing

---

## 6. Data Transfer Object (DTO)

### Description
Plain data objects for transferring game state over network.

### Implementation
**File**: `lib/multiplayer/mp_coordinator.js`

```javascript
// Create serializable state snapshot
function createStateDTO() {
    return {
        frameNumber: gameState.frameNumber,
        timeRemaining: gameState.timeRemaining,
        shotClock: gameState.shotClock,
        scores: {
            teamA: gameState.scores.teamA,
            teamB: gameState.scores.teamB
        },
        players: [
            { id: "teamAPlayer1", x: teamAPlayer1.x, y: teamAPlayer1.y },
            { id: "teamAPlayer2", x: teamAPlayer2.x, y: teamAPlayer2.y },
            { id: "teamBPlayer1", x: teamBPlayer1.x, y: teamBPlayer1.y },
            { id: "teamBPlayer2", x: teamBPlayer2.x, y: teamBPlayer2.y }
        ],
        ballCarrier: gameState.ballCarrier ? getPlayerKey(gameState.ballCarrier) : null
    };
}
```

### Usage
```javascript
// Coordinator broadcasts DTO
var stateDTO = createStateDTO();
client.write("nba_jam", "game." + sessionId + ".state", stateDTO);

// Client receives and applies DTO
var serverState = client.read("nba_jam", "game." + sessionId + ".state", 1);
applyServerState(serverState);
```

### Properties
- **Serializable**: JSON-compatible (no functions, no circular refs)
- **Compact**: Only essential data (not entire sprite objects)
- **Versioned**: `frameNumber` for ordering

### Benefits
- Clean separation between runtime objects and network data
- Easy to version/extend
- Reduces bandwidth (selective fields)

---

## 7. Singleton Pattern

### Description
Global objects with single instance (game state, animation system).

### Implementation

**Example 1: Game State** (`state-management.js`)
```javascript
// Single global state object
var gameState = {
    // ... properties
};

function resetGameState(options) {
    // Reset singleton instance
    gameState.gameRunning = false;
    gameState.timeRemaining = options.timeRemaining || GAME_SECONDS;
    // ...
}
```

**Example 2: Animation System** (`animation-system.js`)
```javascript
// Single global animation manager
var animationSystem = {
    activeAnimations: [],
    
    startAnimation: function(config) {
        this.activeAnimations.push(config);
    },
    
    update: function() {
        for (var i = 0; i < this.activeAnimations.length; i++) {
            // Update each animation
        }
    }
};
```

### Singletons in Codebase
- `gameState` - Game state
- `animationSystem` - Animation manager
- `announcerData` - Commentary templates
- `NBATeams` - Team definitions
- Global sprite references (`teamAPlayer1`, etc.)

### Benefits
- Easy global access
- No need to pass state through every function
- Simplified initialization

### Drawbacks
- Makes testing harder (global state)
- Can hide dependencies
- Risk of tight coupling

---

## 8. Template Method Pattern

### Description
Base structure with customizable steps (game loops).

### Implementation
All game loops follow same template with variations.

**Template**: Game Loop Structure
```javascript
function gameLoopTemplate() {
    // 1. Initialize
    var lastUpdate = Date.now();
    var frameNumber = 0;
    
    // 2. Main loop
    while (gameState.gameRunning && gameState.timeRemaining > 0) {
        // 3. Update timing
        updateGameClock();
        
        // 4. Process input (CUSTOMIZABLE)
        processPlayerInput();
        
        // 5. Update AI (CUSTOMIZABLE)
        updateAI();
        
        // 6. Update physics
        checkSpriteCollision();
        
        // 7. Check violations
        checkViolations();
        
        // 8. Render
        drawCourt();
        drawScore();
        
        // 9. Frame delay
        mswait(frameDelay);
        frameNumber++;
    }
    
    // 10. Cleanup
    cleanupSprites();
}
```

### Variations

**Single Player Loop** (`gameLoop()`):
- Input: Human controls player 1
- AI: Controls other 3 players

**Demo Loop** (`runCPUDemo()`):
- Input: None (all AI)
- AI: Controls all 4 players
- Extra: Betting system

**Multiplayer Loop** (`runMultiplayerGameLoop()`):
- Input: Network inputs for remote players
- AI: Controls CPU players only
- Extra: State synchronization

### Customization Points

```javascript
// Single player
function processPlayerInput() {
    handleHumanPlayer(teamAPlayer1);
}

// Multiplayer
function processPlayerInput() {
    for (var playerId in networkInputs) {
        var sprite = spriteMap[playerId];
        applyNetworkInput(sprite, networkInputs[playerId]);
    }
}
```

### Benefits
- Consistent game loop structure
- Easy to add new game modes
- Shared logic (timing, physics) reused

---

## Pattern Interactions

### How Patterns Work Together

```
┌─────────────────────────────────────────────────────┐
│               GAME LOOP (Template)                  │
│  ┌──────────────────────────────────────────────┐  │
│  │  1. Update State Machine (State Pattern)    │  │
│  │  2. Process Input (Strategy Pattern: AI)    │  │
│  │  3. Run Physics                             │  │
│  │  4. Broadcast Events (Observer Pattern)     │  │
│  │  5. Sync Network (Coordinator Pattern)      │  │
│  │  6. Render (Module Pattern)                 │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Example: Scoring a Basket

1. **Game Logic** detects ball in hoop
2. **State Machine** updates `gameState.scores.teamA += 2`
3. **Observer Pattern** fires `announceEvent("score", {...})`
4. **Stats Tracker** records stat
5. **Announcer** displays text
6. **Coordinator** broadcasts DTO to clients
7. **State Machine** transitions to inbound state

---

## Anti-Patterns Identified

### 1. God Object (Partial)
**Issue**: `gameState` knows about everything  
**Impact**: Tight coupling, hard to test  
**Mitigation**: Break into smaller state objects (e.g., `clockState`, `violationState`)

### 2. Global Variables
**Issue**: Sprite globals (`teamAPlayer1`, etc.)  
**Impact**: Hidden dependencies, testing difficulty  
**Mitigation**: Pass sprites as parameters, use sprite registry

### 3. Mixed Concerns
**Issue**: Some UI modules also handle game logic  
**Example**: `score-display.js` calculates score formatting AND renders it  
**Mitigation**: Separate calculation from rendering

---

## Pattern Usage Summary

| Pattern | Files | Strength | Weakness |
|---------|-------|----------|----------|
| State Machine | 1 (state-management.js) | Central truth | Monolithic |
| Observer | 5 (announcer, stats, etc.) | Decoupled | Event spam potential |
| Coordinator | 2 (mp_coordinator, mp_client) | Prevents desync | Complex |
| Strategy | 4 (AI modules) | Flexible AI | Many modules |
| Module | 34 (all libs) | Organized | Some duplicates |
| DTO | 2 (multiplayer) | Clean network | Serialization overhead |
| Singleton | 5 (state, animations, etc.) | Easy access | Global state |
| Template Method | 3 (game loops) | Consistent | Rigid structure |

---

## Recommendations

### Strengthen Existing Patterns
1. **State Machine**: Add formal state validator to prevent illegal transitions
2. **Observer**: Implement event queue to prevent infinite event loops
3. **Module**: Eliminate duplicate functions (consolidate helpers)

### Apply New Patterns
1. **Factory Pattern**: Create sprite factory to replace scattered `createPlayerSprite()` calls
2. **Command Pattern**: Encapsulate player actions as command objects (better for replay/undo)
3. **Composite Pattern**: Build UI from composable components

### Remove Anti-Patterns
1. Extract sub-states from `gameState` god object
2. Eliminate global sprite variables (use sprite registry)
3. Separate UI rendering from data calculation

---

## Conclusion

**Strengths**:
- Well-defined patterns for core systems (state, events, AI, multiplayer)
- Modular architecture supports refactoring
- Template method makes game modes consistent

**Opportunities**:
- Reduce global state reliance
- Add factories for sprite creation
- Formalize state transitions with validators
- Break up god objects into smaller state containers

The codebase demonstrates strong architectural patterns overall, with room for refinement in state management and dependency injection.
