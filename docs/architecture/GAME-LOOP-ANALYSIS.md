# Game Loop Architecture Analysis

**Purpose**: Analyze the three main game loops to identify unification opportunities for Wave 23C timing refactor  
**Date**: 2025-11-08  
**Status**: Analysis complete, recommendations pending

## Executive Summary

Three distinct game loops exist: `gameLoop()` (single-player), `runCPUDemo()` (AI-only), and `runMultiplayerGameLoop()` (networked). They share **~80% common logic** but have hard forks for input handling, AI updates, and frame timing.

**Key Finding**: Most differences are artifacts of development history, not fundamental requirements. **Significant reconciliation is possible** through:
1. **Unified frame scheduler** (Wave 23C timing system)
2. **Pluggable input handlers** (human vs AI vs network)
3. **Conditional rendering** (coordinator vs client)
4. **Shared game logic core** (already exists, just needs extraction)

## Current Loop Inventory

### 1. gameLoop() - Single Player
**Location**: `nba_jam.js:191`  
**Purpose**: Standard 1-4 player local game  
**Frame Rate**: Variable (40-50ms based on getSinglePlayerTempo())  
**Blocking**: Yes (mswait at end of loop)

### 2. runCPUDemo() - AI Only
**Location**: `nba_jam.js:592`  
**Purpose**: Attract mode, betting simulation  
**Frame Rate**: Inherited from gameLoop() (calls gameLoop internally)  
**Blocking**: Yes (via gameLoop)

### 3. runMultiplayerGameLoop() - Networked
**Location**: `nba_jam.js:1220`  
**Purpose**: BBS multiplayer via network coordinator  
**Frame Rate**: Fixed 20 FPS (50ms)  
**Blocking**: Yes (mswait at end of loop)

## Side-by-Side Comparison

### Shared Logic (Common to All)

✅ **Identical across all loops**:
```javascript
// State Manager usage (Wave 23 dependency injection)
systems.stateManager.set("tickCounter", (gameState.tickCounter + 1) % 1000000, "game_tick");
systems.stateManager.set("gameRunning", true, "game_start");

// Recovery/cooldown timers
for (var r = 0; r < recoveryList.length; r++) {
    decrementStealRecovery(recoveryList[r]);
}

// Timer updates (1 second interval)
if (now - lastSecond >= 1000) {
    gameState.timeRemaining--;
    gameState.shotClock--;
    lastSecond = now;
}

// Halftime logic
if (gameState.currentHalf === 1 && gameState.timeRemaining <= gameState.totalGameTime / 2) {
    stateManager.set("currentHalf", 2, "halftime");
    showHalftimeScreen();
    // ... reset timers
}

// Shot clock violation
if (gameState.shotClock <= 0) {
    announceEvent("shot_clock_violation", { team: gameState.currentTeam });
    switchPossession(systems);
    stateManager.set("shotClock", 24, "shot_clock_reset");
}

// Ball handler tracking (stuck detection, dead dribble)
if (gameState.ballCarrier && !gameState.inbounding) {
    var ballHandler = gameState.ballCarrier;
    var distanceMoved = Math.sqrt(
        Math.pow(ballHandler.x - gameState.ballHandlerLastX, 2) +
        Math.pow(ballHandler.y - gameState.ballHandlerLastY, 2)
    );
    // ... 50+ lines of identical logic
}

// Violation checking
violationTriggeredThisFrame = checkViolations(violationTriggeredThisFrame);

// Physics & collisions
checkSpriteCollision();

// Sprite rendering
Sprite.cycle();

// Animation system
animationSystem.update();

// Rebound scramble
updateReboundScramble(systems);

// Trail frame cycling
if (trailFrame) {
    cycleFrame(trailFrame);
    if (ballFrame && ballFrame.is_open) {
        ballFrame.top();
    }
}

// Game end check
if (gameState.timeRemaining <= 0) {
    stateManager.set("gameRunning", false, "game_ended");
}
```

**Duplication**: ~150-200 lines duplicated between gameLoop and runMultiplayerGameLoop

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

**Only in gameLoop()** (80+ lines, not in multiplayer):
```javascript
// Handle block jump animation
if (gameState.blockJumpTimer > 0) {
    var blocker = gameState.activeBlock;
    if (blocker && blocker.frame) {
        // ... 80 lines of jump animation math ...
    }
}
```

**Reconciliation Opportunity**: ⚠️ **INVESTIGATE**
- Why doesn't MP have this?
- Is it broken in MP or intentionally omitted?
- **TODO**: Test block animations in multiplayer

### Game Phase Updates

**gameLoop()**: 
```javascript
updateGamePhase(frameDelay, systems);
```

**runMultiplayerGameLoop()**: 
```javascript
// Missing updateGamePhase call!
```

**Reconciliation Opportunity**: 🐛 **BUG?**
- MP doesn't call updateGamePhase
- Is this intentional or oversight?
- Phase handler manages shot animations, rebounds, inbound
- **TODO**: Verify if MP phases work correctly

## Duplication Analysis

### Lines of Duplicate Code

| Section | gameLoop() | runMultiplayerGameLoop() | Duplication |
|---------|------------|--------------------------|-------------|
| State init | 15 lines | 10 lines | 70% |
| Timer updates | 8 lines | 8 lines | 100% |
| Halftime | 15 lines | 15 lines | 100% |
| Shot clock | 5 lines | 4 lines | 80% |
| Ball handler tracking | 60 lines | 58 lines | 95% |
| Dead dribble | 40 lines | 38 lines | 95% |
| Violation checks | 2 lines | 2 lines | 100% |
| Collision | 6 lines | 2 lines | 33% |
| Sprite cycle | 1 line | 1 line | 100% |
| Animation update | 2 lines | 2 lines | 100% |
| Trail frame | 6 lines | 6 lines | 100% |
| **TOTAL** | **~160 lines** | **~146 lines** | **~90%** |

**Verdict**: Massive duplication. Most logic is copy-pasted.

## Testing Implications

### Current State (3 Separate Loops)

❌ **Problems**:
- Bug fixes must be applied to 2-3 places
- Feature changes risk divergence
- Testing requires 3x effort (SP, MP, Demo)
- Regression risk: fix SP, break MP (or vice versa)

**Example**: Six-second violation fix from session:
- Had to check both gameLoop AND runMultiplayerGameLoop
- Could have missed MP if only testing SP
- Duplication = maintenance burden

### Unified Core (Proposed)

✅ **Benefits**:
- Write test once, validates all modes
- Bug fix in core affects all modes
- Feature parity guaranteed
- Easier to reason about behavior

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

## Open Questions

1. **Why is updateGamePhase missing from MP?**
   - Intentional or oversight?
   - Does MP handle phases differently?
   - **TODO**: Trace phase handling in MP mode

2. **Why is block jump animation only in SP?**
   - Is it broken in MP?
   - Should it be in shared core?
   - **TODO**: Test block animations in MP

3. **Should AI interval be 0 for MP?**
   - Coordinator runs AI every frame
   - Is this necessary for network responsiveness?
   - Could throttling improve performance?

4. **Can we remove runCPUDemo entirely?**
   - It's just a wrapper around gameLoop
   - Could main menu handle demo initialization?
   - Would simplify further

5. **What's the minimum FPS for playability?**
   - SP uses variable tempo (40-50ms)
   - MP uses fixed 20 FPS (50ms)
   - Can we go lower on slow connections?

## Recommendation

**PROCEED WITH UNIFICATION** as part of Wave 23C.

The benefits far outweigh the risks:
- 80-90% code duplication eliminated
- Testing becomes 3x simpler
- Wave 23C timing refactor needs to touch loops anyway
- Future features (replay, spectator) become trivial

**Suggested Timeline**:
1. **Wave 23C Phase 1**: Create frame scheduler, replace mswait()
2. **Wave 23C Phase 2**: Extract runGameFrame() to shared core
3. **Wave 23C Phase 3**: Migrate SP to use shared core
4. **Wave 23C Phase 4**: Migrate MP to use shared core
5. **Wave 23C Phase 5**: Verify demo mode, full testing

**Success Criteria**:
- [ ] All 3 modes use runGameFrame() core
- [ ] 0 mswait() calls in any loop
- [ ] All tests passing
- [ ] No performance regression
- [ ] MP sync still works
- [ ] Demo/betting works

## Related Documentation

- **Wave 23C Timing**: docs/waves/WAVE-23C-TIMING.md
- **Blocking Calls**: docs/debugging/BLOCKING-CALLS.md
- **Architecture**: docs/architecture/WAVE-23-ARCHITECTURE.md
- **Multiplayer Design**: docs/archive/waves-20-21/multiplayer_design_and_architecture.md
