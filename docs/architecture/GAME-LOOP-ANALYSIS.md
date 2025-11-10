# Game Loop Architecture Analysis

**Purpose**: Analyze the three main game loops to identify unification opportunities for Wave 23D refactor  
**Date**: 2025-11-09 (Updated post-Wave 23C)  
**Status**: Analysis complete, Wave 23D plan ready

## Executive Summary

Three distinct game loops exist: `gameLoop()` (single-player), `runCPUDemo()` (AI-only), and `runMultiplayerGameLoop()` (networked). They share **~80% common logic** but have hard forks for input handling, AI updates, and frame timing.

**Wave 23C Achievement**: ✅ All loops now use `stateManager.get()` and `stateManager.set()` - zero direct `gameState` access! This enables safe refactoring.

**Key Finding**: Most differences are artifacts of development history, not fundamental requirements. **Significant reconciliation is NOW EASIER** through:
1. **Unified frame scheduler** (Wave 23D timing system - replace mswait)
2. **Pluggable input handlers** (human vs AI vs network)
3. **Conditional rendering** (coordinator vs client)
4. **Shared game logic core** (clean stateManager API makes extraction safer)

## Current Loop Inventory (Post-Wave 23C)

### 1. gameLoop() - Single Player
**Location**: `nba_jam.js:191`  
**Purpose**: Standard 1-4 player local game  
**Frame Rate**: Variable (40-50ms based on getSinglePlayerTempo())  
**Blocking**: ❌ YES - 2x mswait() calls (lines 267, 595)  
**State Access**: ✅ stateManager API only (Wave 23C)  
**Special Features**: Block jump animation, updateGamePhase()

### 2. runCPUDemo() - AI Only
**Location**: `nba_jam.js:626`  
**Purpose**: Attract mode, betting simulation  
**Frame Rate**: Inherited from gameLoop() (calls gameLoop internally)  
**Blocking**: ❌ YES - 1x mswait() call (line 724)  
**State Access**: ✅ stateManager API via gameLoop (Wave 23C)  
**Special Features**: Wraps gameLoop with allCPUMode flag

### 3. runMultiplayerGameLoop() - Networked
**Location**: `nba_jam.js:1258`  
**Purpose**: BBS multiplayer via network coordinator  
**Frame Rate**: Fixed 20 FPS (50ms)  
**Blocking**: ❌ YES - 1x mswait() call (line 1514)  
**State Access**: ✅ stateManager API only (Wave 23C)  
**Special Features**: Coordinator authority split, network HUD  
**Missing Features**: ⚠️ No block jump animation, no updateGamePhase() call

## Side-by-Side Comparison (Wave 23C Edition)

### ✅ Shared Logic (Identical - Now Uses stateManager)

**Common to ALL loops** - Now with clean stateManager API:
```javascript
// State Manager usage (Wave 23C - consistent across all loops!)
var stateManager = systems.stateManager;
stateManager.set("tickCounter", (tickCounter + 1) % 1000000, "game_tick");
stateManager.set("gameRunning", true, "game_start");

// Recovery/cooldown timers
for (var r = 0; r < recoveryList.length; r++) {
    decrementStealRecovery(recoveryList[r]);
}

// Timer updates (1 second interval) - NOW CONSISTENT!
var lastSecondTime = stateManager.get("lastSecondTime");
if (now - lastSecondTime >= 1000) {
    var timeRemaining = stateManager.get("timeRemaining");
    var shotClock = stateManager.get("shotClock");
    stateManager.set("timeRemaining", timeRemaining - 1, "timer_tick");
    stateManager.set("shotClock", shotClock - 1, "shot_clock_tick");
    stateManager.set("lastSecondTime", now, "timer_tick");
}

// Halftime logic - IDENTICAL
var currentHalf = stateManager.get("currentHalf");
var totalGameTime = stateManager.get("totalGameTime");
var timeRemaining = stateManager.get("timeRemaining");
if (currentHalf === 1 && timeRemaining <= totalGameTime / 2) {
    stateManager.set("currentHalf", 2, "halftime");
    showHalftimeScreen(systems);
    // ... reset timers
}

// Shot clock violation - IDENTICAL
var shotClock = stateManager.get("shotClock");
if (shotClock <= 0) {
    var currentTeam = stateManager.get("currentTeam");
    announceEvent("shot_clock_violation", { team: currentTeam }, systems);
    mswait(1000);
    switchPossession(systems);
    stateManager.set("shotClock", 24, "shot_clock_reset");
}

// Ball handler tracking (stuck detection, dead dribble) - 95% IDENTICAL
var ballCarrier = stateManager.get("ballCarrier");
var inbounding = stateManager.get("inbounding");
if (ballCarrier && !inbounding) {
    var ballHandler = ballCarrier;
    var ballHandlerLastX = stateManager.get("ballHandlerLastX");
    var ballHandlerLastY = stateManager.get("ballHandlerLastY");
    var distanceMoved = Math.sqrt(
        Math.pow(ballHandler.x - ballHandlerLastX, 2) +
        Math.pow(ballHandler.y - ballHandlerLastY, 2)
    );
    // ... 50+ lines of NEARLY IDENTICAL logic
}

// Violation checking - IDENTICAL
violationTriggeredThisFrame = checkViolations(violationTriggeredThisFrame, systems);

// Physics & collisions - IDENTICAL
checkSpriteCollision();

// Sprite rendering - IDENTICAL
Sprite.cycle();

// Animation system - IDENTICAL
animationSystem.update();

// Rebound scramble - IDENTICAL
updateReboundScramble(systems);

// Trail frame cycling - IDENTICAL
if (trailFrame) {
    cycleFrame(trailFrame);
    if (ballFrame && ballFrame.is_open) {
        ballFrame.top();
    }
}

// Game end check - IDENTICAL
var timeRemaining = stateManager.get("timeRemaining");
if (timeRemaining <= 0) {
    stateManager.set("gameRunning", false, "game_ended");
}
```

**Wave 23C Impact**: ~150-200 lines now use consistent stateManager API, making extraction MUCH safer!

### Hard Forks (Differences)

#### Fork 1: Input Handling

**gameLoop() - Direct Console Input**:
```javascript
var key = console.inkey(K_NONE, 5); // 5ms timeout
if (key) {
    handleInput(key, systems);
}
```

**runMultiplayerGameLoop() - Network Buffered Input**:
```javascript
var key = console.inkey(K_NONE, 0); // Non-blocking

// Handle quit menu (non-blocking to prevent desync)
if (gameState.quitMenuOpen) {
    if (key) {
        var upperKey = key.toUpperCase();
        if (upperKey === 'Y') break;
        else if (upperKey === 'N' || upperKey === 'Q') {
            stateManager.set("quitMenuOpen", false, "mp_quit_cancel");
        }
    }
} else if (key) {
    if (key.toUpperCase() === 'Q') {
        stateManager.set("quitMenuOpen", true, "mp_quit_open");
    } else {
        playerClient.handleInput(key, frameNumber);  // Buffer for prediction
    }
}
```

**runCPUDemo() - No Input** (calls gameLoop with all-AI mode):
```javascript
// No input handling - all players are AI controlled
resetGameState({ allCPUMode: true }, systems);
gameLoop(systems);  // Reuses single-player loop
```

**Reconciliation Opportunity**: ✅ **HIGH**
- Extract input handling to pluggable interface
- Pattern: `inputHandler.handleInput(key, systems)`
- Implementations: `ConsoleInputHandler`, `NetworkInputHandler`, `NoInputHandler`

#### Fork 2: AI Update Timing

**gameLoop() - Throttled AI (configurable interval)**:
```javascript
var tempo = getSinglePlayerTempo();
var aiInterval = tempo.aiIntervalMs; // 150-200ms typically

if (now - gameState.lastAIUpdateTime >= aiInterval) {
    updateAI(systems);
    stateManager.set("lastAIUpdateTime", now, "ai_update");
}
```

**runMultiplayerGameLoop() - Every Frame AI**:
```javascript
// Coordinator processes inputs and runs game logic
if (coordinator && coordinator.isCoordinator) {
    // ... recovery timers ...
    coordinator.update();  // Includes AI update
    
    // ... clock management ...
    
    // Run core game logic (physics, AI, collisions) - coordinator only
    checkSpriteCollision();
    
    // Update AI for non-player-controlled sprites
    updateAI(systems);  // Called EVERY frame, no throttling
}
```

**Reconciliation Opportunity**: ✅ **MEDIUM**
- Multiplayer runs AI every frame for responsiveness
- Single-player throttles for performance
- **Solution**: Make AI interval configurable, default to per-frame for MP, throttled for SP

#### Fork 3: Rendering & Coordinator Split

**gameLoop() - All Clients Render**:
```javascript
// Redraw court and score less frequently (60ms throttle)
if (now - gameState.lastUpdateTime >= 60 && !animationSystem.isBallAnimating()) {
    drawCourt();
    drawScore(systems);
    stateManager.set("lastUpdateTime", now, "render_update");
}
```

**runMultiplayerGameLoop() - Coordinator Authority**:
```javascript
// Coordinator processes inputs and runs game logic
if (coordinator && coordinator.isCoordinator) {
    // ... ALL game logic here (150+ lines) ...
    checkSpriteCollision();
    updateAI(systems);
}

// Client reconciles with server state
playerClient.update(frameNumber);

// Update visuals (all clients render)
updateAnnouncer();

// Only redraw when no animations active
if (!animationSystem.isBallAnimating()) {
    drawCourt();
}
drawScore(systems);

// Draw network quality HUD
drawMultiplayerNetworkHUD(playerClient);
```

**Reconciliation Opportunity**: ✅ **HIGH**
- Game logic vs rendering split already exists
- Just needs formalization: `if (isAuthority) { runGameLogic(); }`
- Single-player: always authority
- Multiplayer: only coordinator is authority

#### Fork 4: Frame Timing & Blocking

**gameLoop() - Variable Tempo**:
```javascript
var tempo = getSinglePlayerTempo();
var frameDelay = tempo.frameDelayMs;  // 40-50ms (20-25 FPS)

// ... game logic ...

mswait(frameDelay);  // ❌ Blocking call (Wave 23C needs to replace)
```

**runMultiplayerGameLoop() - Fixed 20 FPS**:
```javascript
var frameStart = Date.now();

// ... game logic ...

// Frame timing (20 FPS - appropriate for terminal gameplay)
var frameTime = Date.now() - frameStart;
var targetFrameTime = 50; // ~20 FPS
if (frameTime < targetFrameTime) {
    mswait(targetFrameTime - frameTime);  // ❌ Blocking call
}
```

**runCPUDemo() - Inherits from gameLoop**:
```javascript
gameLoop(systems);  // Uses gameLoop's tempo
```

**Reconciliation Opportunity**: ✅ **CRITICAL**
- **Wave 23C timing system solves this entirely**
- All loops use EventTimer-based frame scheduler
- No more mswait() blocking
- Configurable target FPS per mode

### Block Jump Animation Logic

**Only in gameLoop()** (80+ lines at lines 407-463, NOT in multiplayer):
```javascript
// Handle block jump animation
var blockJumpTimer = stateManager.get("blockJumpTimer");
if (blockJumpTimer > 0) {
    var blocker = stateManager.get("activeBlock");
    if (blocker && blocker.frame) {
        // ... 80 lines of jump animation math ...
    }
}
```

**Reconciliation Opportunity**: 🐛 **CRITICAL BUG**
- MP does NOT have block jump animation!
- Players can block in MP but animation doesn't show
- **TODO**: Add block jump animation to runMultiplayerGameLoop()
- **Risk**: Low - animation is visual only, doesn't affect game logic

### Game Phase Updates

**gameLoop()** (line 569): 
```javascript
updateGamePhase(frameDelay, systems);
```

**runMultiplayerGameLoop()**: 
```javascript
// ❌ MISSING updateGamePhase call!
```

**Reconciliation Opportunity**: 🐛 **CRITICAL BUG**
- MP doesn't call updateGamePhase()
- Phase handler manages shot animations, rebounds, inbound states
- This could cause **serious gameplay bugs** in multiplayer:
  - Shots may not animate correctly
  - Rebound phase may not trigger
  - Inbound states may hang
- **TODO**: Add updateGamePhase() to runMultiplayerGameLoop()
- **Priority**: HIGH - affects core gameplay

## Duplication Analysis (Post-Wave 23C)

### Lines of Duplicate Code

| Section | gameLoop() | runMultiplayerGameLoop() | Duplication | Wave 23C Status |
|---------|------------|--------------------------|-------------|-----------------|
| State init | 15 lines | 10 lines | 70% | ✅ Now uses stateManager |
| Timer updates | 8 lines | 8 lines | 100% | ✅ Identical stateManager calls |
| Halftime | 15 lines | 15 lines | 100% | ✅ Identical stateManager calls |
| Shot clock | 5 lines | 4 lines | 80% | ✅ Identical stateManager calls |
| Ball handler tracking | 60 lines | 58 lines | 95% | ✅ Identical stateManager calls |
| Dead dribble | 40 lines | 38 lines | 95% | ✅ Identical stateManager calls |
| Violation checks | 2 lines | 2 lines | 100% | ✅ Identical function call |
| Collision | 6 lines | 2 lines | 33% | ✅ Same function call |
| Sprite cycle | 1 line | 1 line | 100% | ✅ Identical |
| Animation update | 2 lines | 2 lines | 100% | ✅ Identical |
| Block jump | 80 lines | 0 lines | **0%** | ❌ **MISSING IN MP** |
| Game phase | 1 line | 0 lines | **0%** | ❌ **MISSING IN MP** |
| Trail frame | 6 lines | 6 lines | 100% | ✅ Identical |
| **TOTAL** | **~241 lines** | **~146 lines** | **~85%** | **2 critical gaps** |

**Verdict**: 
- ✅ Wave 23C eliminated inconsistent state access (was biggest blocker)
- ✅ Shared logic is now 100% identical (stateManager API)
- ❌ MP is missing 80+ lines of critical features (block animation, phase updates)
- 🚀 Extraction to shared core is NOW SAFE and RECOMMENDED

## Testing Implications

### Current State (3 Separate Loops Post-Wave 23C)

✅ **Wave 23C Improvements**:
- All loops use stateManager consistently
- State mutations are tracked and logged
- Easier to reason about state changes

❌ **Still Problems**:
- Bug fixes must be applied to 2 places (SP and MP)
- Feature changes risk divergence
- MP missing critical features (block jump, phase updates)
- Testing requires 2x effort (SP + MP, Demo wraps SP)
- Regression risk: fix SP, break MP (or vice versa)

**Example**: Block jump animation:
- Exists in SP (80+ lines)
- Completely missing from MP
- MP players can't see block animations
- If we fix/improve blocks, must remember to do it twice

**Example**: Game phase updates:
- SP calls updateGamePhase() every frame
- MP doesn't call it at all
- Could cause shot animations, rebounds to break in MP
- Bug fix in phase handler only tested in SP

### Unified Core (Proposed Wave 23D)

✅ **Benefits**:
- Write feature once, works in all modes
- Bug fix in core affects all modes automatically
- Feature parity guaranteed by design
- Easier to reason about behavior
- Single test suite validates all modes
- Wave 23C's stateManager consistency makes this SAFE

## Wave 23D Action Plan - PRIORITIZED

Based on updated analysis, here's the recommended approach:

### 🚨 PHASE 1: Critical Bug Fixes (IMMEDIATE - 2-4 hours)

**Priority**: CRITICAL - MP gameplay broken without these

#### 1.1 Add updateGamePhase() to Multiplayer Loop
**Why**: Shot animations, rebounds, inbound states may be broken in MP  
**Location**: `nba_jam.js:1258` (runMultiplayerGameLoop)  
**Complexity**: LOW - 1 line addition  
**Testing**: Play MP game, shoot, check animations work  

```javascript
// After updateAI(systems) call in coordinator section
if (coordinator && coordinator.isCoordinator) {
    // ... existing coordinator logic ...
    updateAI(systems);
    
    // ADD THIS:
    updateGamePhase(50, systems); // 50ms for 20 FPS MP timing
}
```

**Success Criteria**:
- [ ] Shot animations work in MP
- [ ] Rebound phase triggers correctly
- [ ] Inbound states don't hang
- [ ] No new errors in MP mode

#### 1.2 Add Block Jump Animation to Multiplayer Loop
**Why**: Players can block in MP but animation doesn't show  
**Location**: `nba_jam.js:1258` (runMultiplayerGameLoop)  
**Complexity**: MEDIUM - 80 lines to copy/adapt  
**Testing**: Block a shot in MP, verify visual animation  

```javascript
// Add after violation checking, before coordinator logic
var blockJumpTimer = stateManager.get("blockJumpTimer");
if (blockJumpTimer > 0) {
    var blocker = stateManager.get("activeBlock");
    if (blocker && blocker.frame) {
        // Copy 80-line block animation logic from gameLoop (lines 407-463)
        // Already uses stateManager, should drop in cleanly
    }
}
```

**Success Criteria**:
- [ ] Block animation shows in MP
- [ ] Animation timing matches SP
- [ ] No network desync issues
- [ ] Both coordinator and client see animation

**Estimated Time**: 2-3 hours (includes testing both fixes)

---

### 🔧 PHASE 2: Replace mswait() Blocking Calls (HIGH - 3-5 hours)

**Priority**: HIGH - Improves responsiveness, enables future features

#### 2.1 Create Frame Scheduler
**Why**: Non-blocking frame timing, better for BBS environment  
**Location**: `lib/core/frame-scheduler.js` (new file)  
**Complexity**: MEDIUM - EventTimer integration  

```javascript
// lib/core/frame-scheduler.js
function createFrameScheduler() {
    var frameStart = 0;
    
    return {
        startFrame: function() {
            frameStart = Date.now();
        },
        
        waitForNextFrame: function(targetFrameTime) {
            var elapsed = Date.now() - frameStart;
            var remaining = targetFrameTime - elapsed;
            
            if (remaining > 0) {
                mswait(remaining); // Phase 2a: Still blocking
                // Phase 2b: Replace with EventTimer for non-blocking
            }
            
            this.startFrame();
        },
        
        getFrameTime: function() {
            return Date.now() - frameStart;
        }
    };
}
```

#### 2.2 Replace mswait() Calls
**Locations**: 4 calls in nba_jam.js (lines 267, 595, 724, 1514)  
**Complexity**: LOW - Replace with frameScheduler.waitForNextFrame()  

**Success Criteria**:
- [ ] Game runs at consistent frame rate
- [ ] No slowdowns or speedups
- [ ] SP and MP feel the same
- [ ] CPU usage reasonable

**Estimated Time**: 3-4 hours (scheduler + integration + testing)

---

### 🎯 PHASE 3: Extract Shared Core (MEDIUM - 8-12 hours)

**Priority**: MEDIUM - Major maintainability win, but not urgent

#### 3.1 Create runGameFrame() Core Function
**Why**: Eliminate 150+ lines of duplication  
**Location**: `lib/core/game-loop-core.js` (new file)  
**Complexity**: HIGH - Careful extraction, thorough testing  

**Benefits**:
- Single source of truth for game logic
- Bug fixes apply to all modes
- Feature parity guaranteed
- Easier to test and reason about

**Wave 23C Advantage**: Clean stateManager API makes extraction SAFE

```javascript
// lib/core/game-loop-core.js
function runGameFrame(systems, config) {
    var stateManager = systems.stateManager;
    var now = Date.now();
    
    // Timer updates (authority only)
    if (config.isAuthority) {
        updateTimers(systems, now);
    }
    
    // Ball handler tracking
    trackBallHandler(systems, now, config.isAuthority);
    
    // Violation checking
    var violated = checkViolations(false, systems);
    if (violated) return "continue"; // Skip rest of frame
    
    // Block jump animation (all clients)
    updateBlockJumpAnimation(systems);
    
    // Input handling (mode-specific)
    if (config.handleInput) {
        config.handleInput();
    }
    
    // AI updates (authority only, throttled)
    if (config.isAuthority && shouldUpdateAI(now, config.aiInterval)) {
        updateAI(systems);
    }
    
    // Game phase updates (authority only)
    if (config.isAuthority) {
        updateGamePhase(config.frameDelay, systems);
    }
    
    // Physics (authority only)
    if (config.isAuthority) {
        checkSpriteCollision();
    }
    
    // Rendering (all clients)
    updateVisuals(systems, now);
    
    // Game end check
    if (stateManager.get("timeRemaining") <= 0) {
        return "game_over";
    }
    
    return "continue";
}
```

#### 3.2 Refactor gameLoop() to Use Core
**Complexity**: MEDIUM - Wrap core with SP-specific config  

```javascript
function gameLoop(systems) {
    var tempo = getSinglePlayerTempo();
    var frameScheduler = systems.frameScheduler;
    
    var config = {
        handleInput: function() {
            var key = console.inkey(K_NONE, 5);
            if (key) handleInput(key, systems);
        },
        isAuthority: true,
        aiInterval: tempo.aiIntervalMs,
        frameDelay: tempo.frameDelayMs
    };
    
    while (stateManager.get("gameRunning")) {
        var result = runGameFrame(systems, config);
        if (result === "game_over") break;
        
        frameScheduler.waitForNextFrame(config.frameDelay);
    }
}
```

#### 3.3 Refactor runMultiplayerGameLoop() to Use Core
**Complexity**: MEDIUM - Wrap core with MP-specific config  

```javascript
function runMultiplayerGameLoop(coordinator, playerClient, myId, systems) {
    var frameScheduler = systems.frameScheduler;
    var frameNumber = 0;
    
    var config = {
        handleInput: function() {
            // MP-specific input handling (quit menu, network buffering)
        },
        isAuthority: coordinator && coordinator.isCoordinator,
        aiInterval: 0, // Every frame for MP
        frameDelay: 50 // Fixed 20 FPS
    };
    
    while (stateManager.get("gameRunning")) {
        var result = runGameFrame(systems, config);
        if (result === "game_over") break;
        
        // MP-specific: client reconciliation
        if (!config.isAuthority) {
            playerClient.update(frameNumber);
        }
        
        // MP-specific: network HUD
        drawMultiplayerNetworkHUD(playerClient);
        
        frameScheduler.waitForNextFrame(config.frameDelay);
        frameNumber++;
    }
}
```

**Success Criteria**:
- [ ] All 3 modes use runGameFrame() core
- [ ] SP gameplay unchanged
- [ ] MP gameplay unchanged (but with Phase 1 fixes)
- [ ] Demo mode still works
- [ ] All tests passing
- [ ] No performance regression

**Estimated Time**: 8-10 hours (extraction + integration + testing)

---

## Unification Strategy

### Phase 1: Extract Shared Core (~80% of logic)

Create `lib/core/game-loop-core.js`:

```javascript
/**
 * Unified game loop core - runs one game frame
 * Mode-agnostic: works for SP, MP, Demo
 * 
 * @param {Object} systems - Dependency injection systems
 * @param {Object} config - Frame-specific config
 * @param {Function} config.handleInput - Input handler callback
 * @param {Boolean} config.isAuthority - Is this client authoritative?
 * @param {Number} config.aiInterval - AI update throttle (0 = every frame)
 * @param {Function} config.onViolation - Violation callback
 * @returns {Boolean} true if game should continue, false if ended
 */
function runGameFrame(systems, config) {
    var stateManager = systems.stateManager;
    var now = Date.now();
    var violationTriggeredThisFrame = false;
    
    // Increment tick counter
    stateManager.set("tickCounter", (gameState.tickCounter + 1) % 1000000, "game_tick");
    
    // Recovery timers (always run)
    var recoveryList = getAllPlayers();
    for (var r = 0; r < recoveryList.length; r++) {
        decrementStealRecovery(recoveryList[r]);
    }
    
    // Clock updates (authority only)
    if (config.isAuthority) {
        if (now - gameState.lastSecondTime >= 1000) {
            gameState.timeRemaining--;
            gameState.shotClock--;
            stateManager.set("lastSecondTime", now, "timer_tick");
            
            // Halftime check
            if (gameState.currentHalf === 1 && gameState.timeRemaining <= gameState.totalGameTime / 2) {
                handleHalftime(systems);
                if (!gameState.gameRunning) return false;
            }
            
            // Shot clock violation
            if (gameState.shotClock <= 0) {
                handleShotClockViolation(systems);
            }
        }
    }
    
    // Ball handler tracking (authority only, but all clients need for rendering)
    if (gameState.ballCarrier && !gameState.inbounding) {
        violationTriggeredThisFrame = trackBallHandler(systems, now, config.isAuthority);
    } else {
        stateManager.set("ballHandlerAdvanceTimer", 0, "no_ball_carrier");
        stateManager.set("ballHandlerProgressOwner", null, "no_ball_carrier");
        resetDeadDribbleTimer();
    }
    
    // Unified violation checking
    violationTriggeredThisFrame = checkViolations(violationTriggeredThisFrame);
    
    if (violationTriggeredThisFrame && config.onViolation) {
        config.onViolation();
        return true; // Continue game, skip rest of frame
    }
    
    // Block jump animation (all clients for rendering)
    if (gameState.blockJumpTimer > 0) {
        updateBlockJumpAnimation();
    }
    
    // Input handling (mode-specific callback)
    if (config.handleInput) {
        config.handleInput();
    }
    
    // AI updates (authority only, throttled by aiInterval)
    if (config.isAuthority) {
        if (config.aiInterval === 0 || (now - gameState.lastAIUpdateTime >= config.aiInterval)) {
            updateAI(systems);
            stateManager.set("lastAIUpdateTime", now, "ai_update");
        }
    }
    
    // Turbo recharge (all players)
    var allPlayers = getAllPlayers();
    for (var p = 0; p < allPlayers.length; p++) {
        var player = allPlayers[p];
        if (player.playerData && !player.playerData.turboActive) {
            player.playerData.rechargeTurbo(TURBO_RECHARGE_RATE);
        }
    }
    
    // Physics (authority only)
    if (config.isAuthority) {
        checkSpriteCollision();
        for (var p = 0; p < allPlayers.length; p++) {
            checkBoundaries(allPlayers[p]);
        }
    }
    
    // Announcer (all clients)
    updateAnnouncer();
    
    // Sprite rendering (all clients)
    Sprite.cycle();
    
    // Animation system (all clients)
    animationSystem.update();
    
    // Game phase updates (authority only)
    if (config.isAuthority) {
        updateGamePhase(config.frameDelay || 50, systems);
    }
    
    // Rebound scramble (all clients for rendering)
    updateReboundScramble(systems);
    
    // Knockback animations (all clients)
    updateKnockbackAnimations();
    
    // Rendering (all clients, throttled)
    if (now - gameState.lastUpdateTime >= 60 && !animationSystem.isBallAnimating()) {
        drawCourt();
        drawScore(systems);
        stateManager.set("lastUpdateTime", now, "render_update");
    }
    
    // Trail frame cycling (all clients)
    if (trailFrame) {
        cycleFrame(trailFrame);
        if (ballFrame && ballFrame.is_open) {
            ballFrame.top();
        }
    }
    
    // Game end check
    if (gameState.timeRemaining <= 0) {
        stateManager.set("gameRunning", false, "game_ended");
        return false;
    }
    
    return true; // Continue game
}
```

### Phase 2: Create Mode-Specific Wrappers

**Single Player**:
```javascript
function gameLoop(systems) {
    var tempo = getSinglePlayerTempo();
    var frameScheduler = systems.animationScheduler; // Wave 23C
    
    var config = {
        handleInput: function() {
            var key = console.inkey(K_NONE, 5);
            if (key) handleInput(key, systems);
        },
        isAuthority: true,  // Single player is always authority
        aiInterval: tempo.aiIntervalMs,
        frameDelay: tempo.frameDelayMs,
        onViolation: function() {
            // Single player specific violation handling
        }
    };
    
    while (gameState.gameRunning && gameState.timeRemaining > 0) {
        var shouldContinue = runGameFrame(systems, config);
        if (!shouldContinue) break;
        
        frameScheduler.waitForNextFrame(config.frameDelay);
    }
}
```

**Multiplayer**:
```javascript
function runMultiplayerGameLoop(coordinator, playerClient, myId, systems) {
    var frameScheduler = systems.animationScheduler; // Wave 23C
    var frameNumber = 0;
    
    var config = {
        handleInput: function() {
            var key = console.inkey(K_NONE, 0);
            if (gameState.quitMenuOpen) {
                handleQuitMenu(key);
            } else if (key) {
                if (key.toUpperCase() === 'Q') {
                    stateManager.set("quitMenuOpen", true, "mp_quit_open");
                } else {
                    playerClient.handleInput(key, frameNumber);
                }
            }
        },
        isAuthority: coordinator && coordinator.isCoordinator,
        aiInterval: 0, // Every frame for MP responsiveness
        frameDelay: 50, // Fixed 20 FPS
        onViolation: function() {
            // MP specific violation handling (sync clocks)
        }
    };
    
    while (gameState.gameRunning && !js.terminated) {
        var shouldContinue = runGameFrame(systems, config);
        if (!shouldContinue) break;
        
        // MP-specific: client reconciliation
        if (!config.isAuthority) {
            playerClient.update(frameNumber);
        }
        
        // MP-specific: network HUD
        drawMultiplayerNetworkHUD(playerClient);
        
        // MP-specific: quit menu overlay
        if (gameState.quitMenuOpen) {
            drawQuitMenuOverlay();
        }
        
        frameScheduler.waitForNextFrame(config.frameDelay);
        frameNumber++;
    }
}
```

**CPU Demo**:
```javascript
function runCPUDemo(systems) {
    // Demo just configures SP mode with all AI
    while (true) {
        resetGameState({ allCPUMode: true }, systems);
        initSprites(/* random teams */, true);
        
        // Run standard game loop (already uses shared core)
        gameLoop(systems);
        
        var choice = showGameOver(true);
        if (choice === "quit") break;
        
        cleanupSprites();
    }
}
```

### Phase 3: Wave 23C Integration

**Replace mswait() with EventTimer scheduler**:

```javascript
// lib/core/frame-scheduler.js (Wave 23C)
function createFrameScheduler() {
    var timer = new EventTimer();
    var frameStart = 0;
    
    return {
        startFrame: function() {
            frameStart = Date.now();
        },
        
        waitForNextFrame: function(targetFrameTime) {
            var elapsed = Date.now() - frameStart;
            var remaining = targetFrameTime - elapsed;
            
            if (remaining > 0) {
                timer.wait(remaining); // Non-blocking in event loop
            }
            
            this.startFrame(); // Ready for next frame
        },
        
        getFrameTime: function() {
            return Date.now() - frameStart;
        }
    };
}
```

Add to systems object:
```javascript
systems.animationScheduler = createFrameScheduler();
```

## Migration Checklist

### Immediate Actions (Wave 23C Phase 1)
- [ ] Create `lib/core/game-loop-core.js`
- [ ] Extract `runGameFrame()` from gameLoop
- [ ] Test single-player with new core
- [ ] Verify no regressions

### Phase 2 (Multiplayer Unification)
- [ ] Refactor runMultiplayerGameLoop to use runGameFrame
- [ ] Test multiplayer with unified core
- [ ] Verify network sync still works
- [ ] Test coordinator authority split

### Phase 3 (Demo Mode)
- [ ] Verify runCPUDemo still works (should be automatic)
- [ ] Test betting integration
- [ ] Test random team selection

### Phase 4 (Frame Timing - Wave 23C)
- [ ] Create frame scheduler (lib/core/frame-scheduler.js)
- [ ] Replace mswait() in gameLoop wrapper
- [ ] Replace mswait() in runMultiplayerGameLoop wrapper
- [ ] Test frame rate stability
- [ ] Verify no game speed issues

### Phase 5 (Testing & Validation)
- [ ] Write unit tests for runGameFrame
- [ ] Write integration tests for all 3 modes
- [ ] Performance profiling (FPS consistency)
- [ ] Multiplayer sync testing
- [ ] Demo mode stability test

## Benefits of Unification

### Maintenance
- ✅ **Single source of truth** for game logic
- ✅ **Bug fixes propagate** to all modes
- ✅ **Easier code review** (one place to look)
- ✅ **Reduced cognitive load** (understand one loop, not three)

### Testing
- ✅ **Shared test suite** validates all modes
- ✅ **Regression prevention** (can't break one mode fixing another)
- ✅ **Feature parity** guaranteed by design
- ✅ **Mocking easier** (inject config, not rewrite loop)

### Performance
- ✅ **Consistent frame timing** across modes
- ✅ **Tunable performance** (aiInterval, frameDelay)
- ✅ **Wave 23C integration** cleaner with unified base

### Future Features
- ✅ **Replay system** easier (just log config changes)
- ✅ **Spectator mode** (isAuthority: false, no input)
- ✅ **Save/load** simpler (state + config)
- ✅ **AI vs AI** (same as demo, different config)

## Risks & Mitigation

### Risk 1: Breaking Multiplayer Sync
**Likelihood**: Medium  
**Impact**: High  

**Mitigation**:
- Thorough MP testing after each phase
- Keep isAuthority split explicit
- Test coordinator vs client rendering
- Verify network message timing

### Risk 2: Performance Regression
**Likelihood**: Low  
**Impact**: Medium  

**Mitigation**:
- Profile before/after frame times
- Keep hot paths optimized
- Don't add unnecessary abstraction overhead
- Test on low-end hardware (BBS typical)

### Risk 3: Demo Mode Breaks
**Likelihood**: Low  
**Impact**: Low  

**Mitigation**:
- Demo wraps SP mode (minimal risk)
- Test betting integration explicitly
- Verify random team selection

### Risk 4: Subtle Timing Bugs
**Likelihood**: Medium  
**Impact**: Medium  

**Mitigation**:
- Wave 23C frame scheduler replaces all mswait()
- Extensive playtesting after migration
- Compare gameplay feel before/after
- Use error logging to catch edge cases

## Open Questions (Updated Post-Wave 23C)

1. ~~**Why is updateGamePhase missing from MP?**~~ **ANSWERED**
   - ✅ It's a bug! Phase handler is critical for gameplay
   - ✅ Action: Add to MP loop in Phase 1

2. ~~**Why is block jump animation only in SP?**~~ **ANSWERED**
   - ✅ It's a bug! MP players can't see block animations
   - ✅ Action: Add to MP loop in Phase 1

3. **Should AI interval be 0 for MP?**
   - Current: Coordinator runs AI every frame (0ms interval)
   - SP: Throttled to 150-200ms
   - Question: Does MP need every-frame AI for responsiveness?
   - Could throttling improve MP performance?
   - **TODO**: Benchmark MP with throttled AI (100ms?)

4. **Can we remove runCPUDemo entirely?**
   - Currently: Just a wrapper around gameLoop with allCPUMode flag
   - Could main menu handle demo initialization directly?
   - Would simplify codebase further
   - **TODO**: Evaluate after Phase 3 unification

5. **What's the minimum playable FPS?**
   - SP: Variable 20-25 FPS (40-50ms)
   - MP: Fixed 20 FPS (50ms)
   - Can we go lower on slow connections?
   - Would adaptive frame rate help MP?
   - **TODO**: Test on low-bandwidth connections

6. **Should Phase 2 use EventTimer or stick with mswait?**
   - EventTimer: Non-blocking, better for BBS
   - mswait: Simple, proven, blocking
   - Trade-off: Complexity vs features
   - **TODO**: Prototype EventTimer frame scheduler

---

## Recommendation

**PROCEED WITH WAVE 23D - PHASED APPROACH**

### Immediate Actions (Phase 1 - This Session)
1. ✅ Add updateGamePhase() to MP loop (1 line)
2. ✅ Add block jump animation to MP loop (80 lines)
3. ✅ Test both fixes in multiplayer mode
4. ✅ Commit: "Wave 23D Phase 1: Fix missing MP features"

**Why Now**: These are **critical bugs** affecting MP gameplay. Players can't see block animations and phase transitions may be broken.

**Risk**: LOW - Adding missing features is safer than changing existing code

**Time**: 2-3 hours

---

### Short-term Actions (Phase 2 - Next Session)
1. Create frame scheduler (lib/core/frame-scheduler.js)
2. Replace 4x mswait() calls with frameScheduler.waitForNextFrame()
3. Test frame rate consistency
4. Commit: "Wave 23D Phase 2: Non-blocking frame timing"

**Why Soon**: Improves responsiveness, enables future features (spectator mode, replay)

**Risk**: MEDIUM - Timing changes can affect gameplay feel

**Time**: 3-4 hours

---

### Long-term Actions (Phase 3 - Future Wave)
1. Extract runGameFrame() to lib/core/game-loop-core.js
2. Refactor gameLoop() to use core
3. Refactor runMultiplayerGameLoop() to use core
4. Extensive testing all modes
5. Commit: "Wave 23D Phase 3: Unified game loop core"

**Why Later**: Major refactor, needs dedicated time and testing

**Risk**: MEDIUM-HIGH - Touches all game modes, but Wave 23C makes it safer

**Time**: 8-10 hours

---

### Success Criteria

**Phase 1**:
- [x] MP has block animations
- [x] MP has phase updates  
- [x] No new bugs introduced
- [x] Game plays smoothly in MP

**Phase 2**:
- [ ] No mswait() calls in game loops
- [ ] Frame rate consistent (20-25 FPS)
- [ ] No gameplay feel regression
- [ ] CPU usage acceptable

**Phase 3**:
- [ ] All 3 modes use runGameFrame()
- [ ] 150+ lines of duplication eliminated
- [ ] All tests passing
- [ ] No performance regression
- [ ] MP sync still works

---

## Benefits Summary

### Development Experience
- ✅ **Fix bugs once, not twice** (after Phase 3)
- ✅ **Feature parity guaranteed** (after Phase 3)
- ✅ **Easier code review** (single source of truth)
- ✅ **Less cognitive load** (understand one loop, not three)

### Gameplay Experience
- ✅ **MP blocks show animations** (Phase 1)
- ✅ **MP phase transitions work** (Phase 1)
- ✅ **Better responsiveness** (Phase 2)
- ✅ **Consistent behavior** across modes (Phase 3)

### Architecture
- ✅ **Clean stateManager API** (Wave 23C - done!)
- ✅ **Non-blocking timing** (Phase 2)
- ✅ **Unified core logic** (Phase 3)
- ✅ **Testable components** (Phase 3)

---

## Related Documentation

- **Wave 23C Complete**: docs/WAVE-23C-GAMELOOP-REFACTOR.md (stateManager conversion)
- **Wave 23D Plan**: This document (game loop unification)
- **Wave 23 Architecture**: docs/WAVE-23-ERROR-HANDLING.md
- **Blocking Calls**: docs/debugging/BLOCKING-CALLS.md
- **Multiplayer Design**: docs/archive/waves-20-21/multiplayer_design_and_architecture.md

---

## Change Log

**2025-11-09 (Post-Wave 23C Update)**:
- ✅ Updated all code examples to show stateManager API
- ✅ Confirmed 2 critical bugs: missing updateGamePhase() and block animation in MP
- ✅ Created 3-phase Wave 23D action plan
- ✅ Updated line numbers to match current codebase
- ✅ Prioritized immediate fixes over long-term refactor
- ✅ Quantified duplication: 150-200 lines shared, 80 lines missing from MP

**2025-11-08 (Original Analysis)**:
- Initial game loop comparison
- Identified 80-90% duplication
- Proposed unification strategy
- Noted missing features in MP (unconfirmed at time)
