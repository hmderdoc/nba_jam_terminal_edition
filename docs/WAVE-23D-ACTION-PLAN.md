# Wave 23D Action Plan - Game Loop Unification

**Status**: Ready to start Phase 1  
**Date**: 2025-11-09  
**Previous**: Wave 23C (stateManager conversion complete)  
**Goal**: Fix MP bugs, unify game loops, eliminate duplication

---

## Executive Summary

Wave 23C successfully converted all game loops to use stateManager API. This revealed **2 critical bugs** in multiplayer:

1. ❌ **Missing updateGamePhase()** - Shot animations, rebounds may be broken
2. ❌ **Missing block jump animation** - Players can't see block animations

Additionally, 150-200 lines of game logic are duplicated between single-player and multiplayer loops.

**Wave 23D** fixes these issues in 3 phases:
- **Phase 1** (IMMEDIATE): Fix critical MP bugs
- **Phase 2** (SHORT-TERM): Replace blocking mswait() calls
- **Phase 3** (LONG-TERM): Extract shared game loop core

---

## Phase 1: Fix Critical MP Bugs (2-3 hours)

### Priority: 🚨 CRITICAL

**Why**: Multiplayer gameplay is broken without these features

### Task 1.1: Add updateGamePhase() to Multiplayer

**Problem**: MP loop doesn't call updateGamePhase(), which manages:
- Shot animations
- Rebound phase transitions
- Inbound state changes
- Ball possession handoffs

**Location**: `nba_jam.js` line ~1460 (inside coordinator section of runMultiplayerGameLoop)

**Fix**:
```javascript
// After updateAI(systems) call, add:
if (coordinator && coordinator.isCoordinator) {
    // ... existing coordinator logic ...
    updateAI(systems);
    
    // ADD THIS LINE:
    updateGamePhase(50, systems); // 50ms = 20 FPS MP timing
}
```

**Testing**:
1. Start multiplayer game (2 nodes)
2. Shoot a basket
3. Verify shot animation plays
4. Check rebound triggers correctly
5. Verify inbound doesn't hang
6. Check error logs for new issues

**Success Criteria**:
- [ ] Shot animations work in MP
- [ ] Rebounds trigger correctly
- [ ] Inbound states don't hang
- [ ] No new errors in logs

---

### Task 1.2: Add Block Jump Animation to Multiplayer

**Problem**: Block jump animation (80 lines) exists in gameLoop but not runMultiplayerGameLoop. Players can block in MP but see no animation.

**Location**: `nba_jam.js` line ~1450 (after violation checking, before coordinator section)

**Source**: Copy from gameLoop lines 407-463

**Fix**:
```javascript
// Add after violation checking, before coordinator logic:

// Handle block jump animation (visual only, all clients render)
var blockJumpTimer = stateManager.get("blockJumpTimer");
if (blockJumpTimer > 0) {
    var blocker = stateManager.get("activeBlock");
    if (blocker && blocker.frame) {
        var jumpDuration = 30; // ~30 frames at 20 FPS
        var elapsed = jumpDuration - blockJumpTimer;
        var progress = elapsed / jumpDuration;
        
        // Parabolic jump arc (y = -4x^2 + 4x, peaks at x=0.5)
        var jumpHeight = -4 * Math.pow(progress, 2) + 4 * progress;
        var maxJumpPixels = 6;
        var yOffset = Math.floor(jumpHeight * maxJumpPixels);
        
        // Move blocker sprite vertically
        if (blocker.frame && blocker.frame.data) {
            var originalY = blocker.originalY || blocker.y;
            blocker.y = originalY - yOffset;
            
            // Redraw blocker at new position
            blocker.frame.clear();
            blocker.frame.home();
            blocker.draw();
        }
        
        // Decrement timer
        blockJumpTimer = stateManager.get("blockJumpTimer");
        stateManager.set("blockJumpTimer", blockJumpTimer - 1, "block_timer_decrement");
        
        // Landing cleanup
        if (stateManager.get("blockJumpTimer") <= 0) {
            if (blocker.originalY) {
                blocker.y = blocker.originalY;
                delete blocker.originalY;
            }
            stateManager.set("activeBlock", null, "block_animation_complete");
        }
    } else {
        // Invalid blocker, cancel animation
        stateManager.set("blockJumpTimer", 0, "block_invalid");
        stateManager.set("activeBlock", null, "block_invalid");
    }
}
```

**Testing**:
1. Start multiplayer game (2 nodes)
2. Have one player attempt shot
3. Other player presses BLOCK at right time
4. Verify blocker sprite jumps vertically
5. Check animation on both coordinator and client
6. Verify no network desync

**Success Criteria**:
- [ ] Block animation shows in MP
- [ ] Animation timing matches SP (~1.5 seconds)
- [ ] Both coordinator and client see animation
- [ ] No network desync issues

---

### Phase 1 Deliverable

**Commit Message**:
```
Wave 23D Phase 1: Fix critical multiplayer gameplay bugs

BUGS FIXED:
- Added updateGamePhase() to MP loop (shot animations, rebounds, inbound)
- Added block jump animation to MP loop (80 lines, visual parity with SP)

IMPACT:
- MP now has feature parity with SP for core gameplay
- Shot animations work correctly
- Block animations visible to all players
- Phase transitions (rebound, inbound) function properly

TESTING:
- Played full MP game, verified shots animate
- Blocked shots, verified jump animation shows
- Checked both coordinator and client rendering
- No new errors in logs

NEXT:
- Wave 23D Phase 2: Replace mswait() blocking calls
```

**Files Changed**:
- `nba_jam.js` - runMultiplayerGameLoop() function (~81 lines added)

**Estimated Time**: 2-3 hours (implementation + testing)

---

## Phase 2: Replace mswait() Blocking (3-4 hours)

### Priority: 🔧 HIGH

**Why**: Non-blocking frame timing enables future features and improves responsiveness

### Task 2.1: Create Frame Scheduler

**Location**: `lib/core/frame-scheduler.js` (new file)

**Purpose**: Centralize frame timing logic, prepare for non-blocking EventTimer

**Implementation**:
```javascript
// lib/core/frame-scheduler.js

/**
 * Frame Scheduler - Manages game loop timing
 * Phase 2a: Uses mswait (blocking)
 * Phase 2b: Can migrate to EventTimer (non-blocking)
 */

function createFrameScheduler() {
    var frameStart = 0;
    var frameCount = 0;
    var lastFPSCheck = 0;
    var fpsHistory = [];
    
    return {
        /**
         * Mark start of new frame
         */
        startFrame: function() {
            frameStart = Date.now();
            frameCount++;
        },
        
        /**
         * Wait for next frame (blocking for now)
         * @param {number} targetFrameTime - Target frame duration in ms
         */
        waitForNextFrame: function(targetFrameTime) {
            var elapsed = Date.now() - frameStart;
            var remaining = targetFrameTime - elapsed;
            
            if (remaining > 0) {
                mswait(remaining); // TODO Phase 2b: Replace with EventTimer
            }
            
            this.startFrame(); // Prep for next frame
        },
        
        /**
         * Get actual frame time (for performance monitoring)
         * @returns {number} Frame time in ms
         */
        getFrameTime: function() {
            return Date.now() - frameStart;
        },
        
        /**
         * Get average FPS over last second
         * @returns {number} Average FPS
         */
        getAverageFPS: function() {
            var now = Date.now();
            if (now - lastFPSCheck >= 1000) {
                var fps = frameCount;
                fpsHistory.push(fps);
                if (fpsHistory.length > 5) fpsHistory.shift();
                frameCount = 0;
                lastFPSCheck = now;
            }
            
            if (fpsHistory.length === 0) return 0;
            var sum = fpsHistory.reduce(function(a, b) { return a + b; }, 0);
            return Math.round(sum / fpsHistory.length);
        },
        
        /**
         * Reset frame counter (for halftime, etc.)
         */
        reset: function() {
            frameStart = Date.now();
            frameCount = 0;
            lastFPSCheck = Date.now();
            fpsHistory = [];
        }
    };
}

// Export for use in systems initialization
if (typeof module !== 'undefined') {
    module.exports = { createFrameScheduler: createFrameScheduler };
}
```

**Testing**:
- Load file in game
- Create scheduler instance
- Verify functions exist
- Test getAverageFPS() over several seconds

---

### Task 2.2: Add Scheduler to Systems Object

**Location**: `lib/core/system-init.js`

**Implementation**:
```javascript
// Add to system initialization
load(js.exec_dir + "lib/core/frame-scheduler.js");

function initializeSystems() {
    var systems = {
        stateManager: createStateManager(),
        eventBus: createEventBus(),
        animationScheduler: createFrameScheduler(), // ADD THIS
        // ... other systems
    };
    
    return systems;
}
```

---

### Task 2.3: Replace mswait() in gameLoop

**Location**: `nba_jam.js` line 595

**Before**:
```javascript
        mswait(frameDelay);
    }
}
```

**After**:
```javascript
        systems.animationScheduler.waitForNextFrame(frameDelay);
    }
}
```

---

### Task 2.4: Replace mswait() in runMultiplayerGameLoop

**Location**: `nba_jam.js` line 1514

**Before**:
```javascript
            if (frameTime < targetFrameTime) {
                mswait(targetFrameTime - frameTime);
            }
```

**After**:
```javascript
            // Let frame scheduler handle timing
            systems.animationScheduler.waitForNextFrame(targetFrameTime);
```

---

### Task 2.5: Replace mswait() in Shot Clock Violation

**Location**: `nba_jam.js` line 267 (in gameLoop) and similar in MP loop

**Before**:
```javascript
                announceEvent("shot_clock_violation", { team: currentTeam }, systems);
                mswait(1000);
                switchPossession(systems);
```

**After**:
```javascript
                announceEvent("shot_clock_violation", { team: currentTeam }, systems);
                systems.animationScheduler.waitForNextFrame(1000); // Brief pause
                switchPossession(systems);
```

---

### Task 2.6: Replace mswait() in runCPUDemo

**Location**: `nba_jam.js` line 724

**Before**:
```javascript
        if (choice === "quit") {
            mswait(1500);
            break;
        }
```

**After**:
```javascript
        if (choice === "quit") {
            systems.animationScheduler.waitForNextFrame(1500);
            break;
        }
```

---

### Phase 2 Testing

**Test Cases**:
1. **Frame Rate Consistency**
   - Play SP game, verify smooth motion
   - Play MP game, verify 20 FPS steady
   - Check demo mode runs at correct speed

2. **Shot Clock Violation Pause**
   - Trigger violation
   - Verify 1-second pause shows announcement
   - Verify game continues smoothly

3. **Performance**
   - Monitor CPU usage (should be same or better)
   - Check frame times with getFrameTime()
   - Verify no stuttering or lag

4. **Quit Timing**
   - Quit demo mode
   - Verify 1.5 second delay before exit
   - Check clean shutdown

**Success Criteria**:
- [ ] All 4 mswait() calls replaced
- [ ] Frame rate consistent (20-25 FPS)
- [ ] No gameplay feel regression
- [ ] CPU usage acceptable
- [ ] Frame scheduler logs show consistent timing

---

### Phase 2 Deliverable

**Commit Message**:
```
Wave 23D Phase 2: Replace mswait() with frame scheduler

CHANGES:
- Created lib/core/frame-scheduler.js (centralized timing)
- Added animationScheduler to systems object
- Replaced 4x mswait() calls with frameScheduler.waitForNextFrame()
  - gameLoop: 2 calls (line 595 main loop, line 267 violation)
  - runMultiplayerGameLoop: 1 call (line 1514)
  - runCPUDemo: 1 call (line 724)

BENEFITS:
- Centralized frame timing logic
- Performance monitoring (getAverageFPS)
- Prepared for EventTimer non-blocking migration
- Easier to tune frame rates per mode

TESTING:
- Frame rate consistent across all modes
- No gameplay feel regression
- CPU usage normal
- Clean shutdown on quit

NEXT:
- Wave 23D Phase 3: Extract shared game loop core
```

**Files Changed**:
- `lib/core/frame-scheduler.js` (new, ~80 lines)
- `lib/core/system-init.js` (+2 lines)
- `nba_jam.js` (4 replacements, ~8 lines changed)

**Estimated Time**: 3-4 hours (creation + integration + testing)

---

## Phase 3: Extract Shared Core (8-10 hours)

### Priority: 🎯 MEDIUM

**Why**: Eliminate 150-200 lines of duplication, guarantee feature parity

**Note**: This is a major refactor. Recommend doing after Phase 1 and 2 are stable and well-tested.

### Task 3.1: Create game-loop-core.js

**Location**: `lib/core/game-loop-core.js` (new file)

**Purpose**: Single source of truth for per-frame game logic

**Structure**:
```javascript
/**
 * Unified Game Loop Core
 * Shared by single-player, multiplayer, and demo modes
 */

function runGameFrame(systems, config) {
    // config: {
    //   isAuthority: boolean,
    //   handleInput: function,
    //   aiInterval: number (ms),
    //   frameDelay: number (ms)
    // }
    
    var stateManager = systems.stateManager;
    var now = Date.now();
    
    // Phase 1: Timer Updates (authority only)
    if (config.isAuthority) {
        updateGameTimers(systems, now);
        if (checkHalftime(systems)) {
            return "halftime"; // Caller handles halftime screen
        }
    }
    
    // Phase 2: Ball Handler Tracking
    var violated = trackBallHandler(systems, now, config.isAuthority);
    
    // Phase 3: Violation Checking
    if (checkViolations(violated, systems)) {
        return "violation"; // Skip rest of frame
    }
    
    // Phase 4: Block Jump Animation (all clients)
    updateBlockJumpAnimation(systems);
    
    // Phase 5: Input Handling (mode-specific)
    if (config.handleInput) {
        config.handleInput();
    }
    
    // Phase 6: AI Updates (authority only, throttled)
    if (config.isAuthority && shouldUpdateAI(systems, now, config.aiInterval)) {
        updateAI(systems);
        stateManager.set("lastAIUpdateTime", now, "ai_update");
    }
    
    // Phase 7: Physics (authority only)
    if (config.isAuthority) {
        checkSpriteCollision();
        checkBoundaries();
    }
    
    // Phase 8: Game Phase Updates (authority only)
    if (config.isAuthority) {
        updateGamePhase(config.frameDelay, systems);
    }
    
    // Phase 9: Visuals (all clients)
    updateVisuals(systems, now);
    
    // Phase 10: Game End Check
    if (stateManager.get("timeRemaining") <= 0) {
        return "game_over";
    }
    
    return "continue";
}

// Helper: Timer updates
function updateGameTimers(systems, now) {
    var stateManager = systems.stateManager;
    var lastSecondTime = stateManager.get("lastSecondTime");
    
    if (now - lastSecondTime >= 1000) {
        var timeRemaining = stateManager.get("timeRemaining");
        var shotClock = stateManager.get("shotClock");
        stateManager.set("timeRemaining", timeRemaining - 1, "timer_tick");
        stateManager.set("shotClock", shotClock - 1, "shot_clock_tick");
        stateManager.set("lastSecondTime", now, "timer_tick");
        
        // Shot clock violation
        shotClock = stateManager.get("shotClock");
        if (shotClock <= 0) {
            var currentTeam = stateManager.get("currentTeam");
            announceEvent("shot_clock_violation", { team: currentTeam }, systems);
            systems.animationScheduler.waitForNextFrame(1000);
            switchPossession(systems);
            stateManager.set("shotClock", 24, "shot_clock_reset");
        }
    }
}

// Helper: Check for halftime
function checkHalftime(systems) {
    var stateManager = systems.stateManager;
    var currentHalf = stateManager.get("currentHalf");
    var totalGameTime = stateManager.get("totalGameTime");
    var timeRemaining = stateManager.get("timeRemaining");
    
    if (currentHalf === 1 && timeRemaining <= totalGameTime / 2) {
        stateManager.set("currentHalf", 2, "halftime");
        return true; // Caller shows halftime screen
    }
    return false;
}

// Helper: Should AI update this frame?
function shouldUpdateAI(systems, now, aiInterval) {
    if (aiInterval === 0) return true; // Every frame
    var lastUpdate = systems.stateManager.get("lastAIUpdateTime");
    return (now - lastUpdate >= aiInterval);
}

// Helper: Update visuals
function updateVisuals(systems, now) {
    var stateManager = systems.stateManager;
    
    // Announcer
    updateAnnouncer(systems);
    
    // Sprites
    Sprite.cycle();
    
    // Animations
    systems.animationSystem.update();
    
    // Rebound scramble
    updateReboundScramble(systems);
    
    // Rendering (throttled to 60ms)
    var lastUpdateTime = stateManager.get("lastUpdateTime");
    if (now - lastUpdateTime >= 60 && !systems.animationSystem.isBallAnimating()) {
        drawCourt(systems);
        drawScore(systems);
        stateManager.set("lastUpdateTime", now, "render_update");
    }
    
    // Trail frames
    if (trailFrame) {
        cycleFrame(trailFrame);
        if (ballFrame && ballFrame.is_open) {
            ballFrame.top();
        }
    }
}

// Export
if (typeof module !== 'undefined') {
    module.exports = { runGameFrame: runGameFrame };
}
```

**Size**: ~200-250 lines (consolidates 400+ lines of duplication)

---

### Task 3.2: Refactor gameLoop() to Use Core

**Implementation**:
```javascript
function gameLoop(systems) {
    try {
        if (!systems || !systems.stateManager) {
            throw new Error("ARCHITECTURE ERROR: gameLoop requires systems parameter");
        }

        var stateManager = systems.stateManager;
        var tempo = getSinglePlayerTempo();
        
        // Initialize
        stateManager.set("gameRunning", true, "game_loop_start");
        stateManager.set("lastUpdateTime", Date.now(), "game_loop_start");
        stateManager.set("lastSecondTime", Date.now(), "game_loop_start");
        stateManager.set("lastAIUpdateTime", Date.now(), "game_loop_start");
        clearPotentialAssist(systems);

        // Initial draw
        drawCourt(systems);
        drawScore(systems);
        var teamNames = stateManager.get("teamNames");
        announceEvent("game_start", { teamA: teamNames.teamA, teamB: teamNames.teamB }, systems);

        // Configure for single-player mode
        var config = {
            isAuthority: true, // SP is always authority
            handleInput: function() {
                var key = console.inkey(K_NONE, 5);
                if (key) handleInput(key, systems);
            },
            aiInterval: tempo.aiIntervalMs, // Throttled AI
            frameDelay: tempo.frameDelayMs  // Variable frame rate
        };

        // Main game loop
        while (stateManager.get("gameRunning") && stateManager.get("timeRemaining") > 0) {
            var result = runGameFrame(systems, config);
            
            if (result === "halftime") {
                showHalftimeScreen(systems);
                if (!stateManager.get("gameRunning")) break;
                
                // Reset for second half
                if (stateManager.get("pendingSecondHalfInbound")) {
                    startSecondHalfInbound(systems);
                }
                drawCourt(systems);
                drawScore(systems);
                stateManager.set("lastUpdateTime", Date.now(), "halftime_reset");
                stateManager.set("lastSecondTime", Date.now(), "halftime_reset");
                stateManager.set("lastAIUpdateTime", Date.now(), "halftime_reset");
                continue;
            }
            
            if (result === "game_over") {
                break;
            }
            
            // Frame timing
            systems.animationScheduler.waitForNextFrame(config.frameDelay);
        }

    } catch (e) {
        logErrorWithSnapshot(e, "gameLoop", systems);
        throw e;
    }
}
```

**Lines Saved**: ~200 lines (complex logic now in shared core)

---

### Task 3.3: Refactor runMultiplayerGameLoop() to Use Core

**Implementation**:
```javascript
function runMultiplayerGameLoop(coordinator, playerClient, myId, systems) {
    try {
        if (!systems || !systems.stateManager) {
            throw new Error("ARCHITECTURE ERROR: runMultiplayerGameLoop requires systems");
        }

        var stateManager = systems.stateManager;
        var frameNumber = 0;
        
        // Initialize
        stateManager.set("gameRunning", true, "mp_loop_start");
        stateManager.set("lastSecondTime", Date.now(), "mp_loop_start");
        clearPotentialAssist(systems);

        // Configure for multiplayer mode
        var config = {
            isAuthority: coordinator && coordinator.isCoordinator,
            handleInput: function() {
                var key = console.inkey(K_NONE, 0); // Non-blocking
                
                if (stateManager.get("quitMenuOpen")) {
                    if (key) {
                        var upperKey = key.toUpperCase();
                        if (upperKey === 'Y') {
                            stateManager.set("gameRunning", false, "mp_quit_confirmed");
                        } else if (upperKey === 'N' || upperKey === 'Q') {
                            stateManager.set("quitMenuOpen", false, "mp_quit_cancel");
                        }
                    }
                } else if (key) {
                    if (key.toUpperCase() === 'Q') {
                        stateManager.set("quitMenuOpen", true, "mp_quit_open");
                    } else {
                        playerClient.handleInput(key, frameNumber);
                    }
                }
            },
            aiInterval: 0, // MP runs AI every frame
            frameDelay: 50 // Fixed 20 FPS
        };

        // Main multiplayer loop
        while (stateManager.get("gameRunning") && !js.terminated) {
            var result = runGameFrame(systems, config);
            
            if (result === "halftime") {
                // MP halftime (simplified - no screen)
                if (stateManager.get("pendingSecondHalfInbound")) {
                    startSecondHalfInbound(systems);
                }
                stateManager.set("lastSecondTime", Date.now(), "mp_halftime_reset");
            }
            
            if (result === "game_over") {
                break;
            }
            
            // MP-specific: client reconciliation
            if (!config.isAuthority) {
                playerClient.update(frameNumber);
            }
            
            // MP-specific: network HUD
            drawMultiplayerNetworkHUD(playerClient);
            
            // MP-specific: quit menu overlay
            if (stateManager.get("quitMenuOpen")) {
                console.gotoxy(1, console.screen_rows);
                console.print("\x01h\x01yReally quit? (Y/N): \x01w");
            }
            
            // Frame timing
            systems.animationScheduler.waitForNextFrame(config.frameDelay);
            frameNumber++;
        }

    } catch (e) {
        logErrorWithSnapshot(e, "runMultiplayerGameLoop", systems);
        throw e;
    }
}
```

**Lines Saved**: ~150 lines (complex logic now in shared core)

---

### Phase 3 Testing

**Critical Test Matrix**:

| Mode | Test Case | Expected Result |
|------|-----------|----------------|
| SP Human vs AI | Full game | Smooth gameplay, correct winner |
| SP Human vs Human | Full game | Both players control correctly |
| SP CPU Demo | 5 games | Auto-plays, betting works |
| MP 2 players | Full game | Network sync, animations work |
| MP 3 players | Full game | All players sync correctly |
| All | Halftime | Shows screen (SP) or instant (MP) |
| All | Shot clock | Violation triggers, announces |
| All | Game over | Shows stats, returns to menu |
| All | Blocks | Animation shows, timing correct |
| All | Violations | 3-sec, 6-sec, backcourt work |

**Regression Tests**:
1. Frame rate consistent (20-25 FPS)
2. No memory leaks over 10+ games
3. Error logs clean
4. CPU usage normal
5. Network bandwidth reasonable (MP)

**Success Criteria**:
- [ ] All test cases pass
- [ ] No regressions vs pre-refactor
- [ ] Code is DRY (150-200 lines eliminated)
- [ ] Both loops use runGameFrame()
- [ ] Demo mode still works
- [ ] Performance same or better

---

### Phase 3 Deliverable

**Commit Message**:
```
Wave 23D Phase 3: Extract unified game loop core

MAJOR REFACTOR:
- Created lib/core/game-loop-core.js (shared game logic)
- Extracted runGameFrame() (200 lines, used by all modes)
- Refactored gameLoop() to use shared core (-200 lines)
- Refactored runMultiplayerGameLoop() to use shared core (-150 lines)

BENEFITS:
- Single source of truth for game logic
- 350+ lines of duplication eliminated
- Feature parity guaranteed by design
- Bug fixes apply to all modes
- Easier to test and reason about

ARCHITECTURE:
- All loops use stateManager API (Wave 23C foundation)
- Pluggable config (isAuthority, handleInput, aiInterval)
- Clean separation: core logic vs mode-specific wrappers
- Prepared for future modes (spectator, replay)

TESTING:
- All game modes tested extensively
- SP, MP, Demo all function correctly
- No regressions in gameplay feel
- Performance maintained
- Error logs clean

RESULT:
- Codebase: -350 lines, +200 lines = -150 net
- Maintainability: Significantly improved
- Testing: 2x easier (shared core has single test suite)
- Future features: Much easier to add
```

**Files Changed**:
- `lib/core/game-loop-core.js` (new, ~200-250 lines)
- `nba_jam.js` - gameLoop() (~200 lines removed, ~50 added)
- `nba_jam.js` - runMultiplayerGameLoop() (~150 lines removed, ~50 added)
- `lib/core/system-init.js` (+1 line, load game-loop-core.js)

**Net Change**: -350 lines of duplication, +250 lines of shared core = **-100 lines total**

**Estimated Time**: 8-10 hours (extraction + integration + extensive testing)

---

## Risk Assessment

### Phase 1 (Critical Bugs)
**Risk**: LOW  
**Reason**: Adding missing features, not changing existing code  
**Mitigation**: Thorough MP testing

### Phase 2 (Frame Scheduler)
**Risk**: MEDIUM  
**Reason**: Timing changes can affect gameplay feel  
**Mitigation**: Side-by-side comparison, rollback plan

### Phase 3 (Unified Core)
**Risk**: MEDIUM-HIGH  
**Reason**: Major refactor touches all game modes  
**Mitigation**: Wave 23C stateManager consistency, extensive testing, incremental approach

---

## Timeline Estimate

| Phase | Tasks | Time | Priority |
|-------|-------|------|----------|
| Phase 1 | Fix MP bugs | 2-3 hours | CRITICAL |
| Phase 2 | Frame scheduler | 3-4 hours | HIGH |
| Phase 3 | Unified core | 8-10 hours | MEDIUM |
| **TOTAL** | | **13-17 hours** | |

**Recommended Schedule**:
- **This session**: Phase 1 (critical bugs)
- **Next session**: Phase 2 (frame timing)
- **Future wave**: Phase 3 (unification)

---

## Success Metrics

### Developer Experience
- [ ] Bug fixes apply to all modes automatically (Phase 3)
- [ ] New features add once, work everywhere (Phase 3)
- [ ] Testing time reduced by 50% (Phase 3)
- [ ] Code review simpler (single source of truth)

### Player Experience
- [ ] MP blocks show animations (Phase 1)
- [ ] MP shots animate correctly (Phase 1)
- [ ] Smooth consistent frame rate (Phase 2)
- [ ] No gameplay regressions (all phases)

### Architecture
- [ ] 350+ lines duplication eliminated (Phase 3)
- [ ] All loops use stateManager consistently ✅ (Wave 23C)
- [ ] No blocking mswait() calls (Phase 2)
- [ ] Clean separation of concerns (Phase 3)

---

## Next Steps

1. **Review this plan** with user
2. **Start Phase 1** if approved
3. **Test thoroughly** before moving to Phase 2
4. **Document learnings** for future refactors

---

**Last Updated**: 2025-11-09  
**Status**: Ready to execute Phase 1  
**Depends On**: Wave 23C (complete ✅)  
**Blocks**: Future features (spectator mode, replay system)
