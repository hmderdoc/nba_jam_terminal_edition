# Wave 23 Migration Status & Next Steps

**Date**: November 8, 2025  
**Current State**: Systems parameter refactor complete, architectural issues blocking gameplay

## What We've Accomplished

### ✅ Wave 23D - Systems Parameter Migration (COMPLETE)
- Fixed 30+ function signatures to accept `systems` parameter
- All callers updated to pass `systems`
- No more "systems is undefined" crashes
- Game runs from tipoff through halftime to second half
- Error handling with circular reference safety
- Test infrastructure separated (test_wrapper.js)

**Result**: Game is stable, no more crashes from missing dependencies.

### ✅ Dependency Injection Infrastructure (COMPLETE)
- `system-init.js` - Centralized system creation
- `state-manager.js` - Mutation tracking
- `event-bus.js` - Cross-system communication
- `shooting-system.js`, `passing-system.js`, `possession-system.js` - Domain systems
- Debug logging integrated

**Result**: Solid architectural foundation in place.

## What's NOT Working

### 🐛 Shooting/Dunking Broken
**Symptom**: Shots never happen, `shotInProgress` flag stuck  
**Root Cause**: **ARCHITECTURAL** - Not a simple bug

**The Real Problem**:
```javascript
// shooting.js line 216 - OLD BLOCKING CODE STILL IN USE
function animateShot(startX, startY, targetX, targetY, made, systems) {
    // ... 150 lines of code with mswait() calls ...
    mswait(msPerStep);  // ❌ BLOCKS THE ENTIRE GAME LOOP
    // ...
}
```

This is called from the **old synchronous path**, not the new async animation system.

### 🐛 Animation System Incomplete
**What Exists**:
- `lib/core/animation-system.js` - Has non-blocking ball animation infrastructure
- Phase handler checks for `animationSystem.queueShotAnimation()`

**What's Missing**:
- `queueShotAnimation()` method doesn't exist!
- Phase handler falls back to blocking code
- Shot animations never complete asynchronously
- `shotInProgress` never clears because animation never "finishes"

### 🐛 Game Loop Still Using mswait()
**From GAME-LOOP-ANALYSIS.md**:
```javascript
// nba_jam.js - THREE game loops, all blocking
mswait(frameDelay);  // ❌ Blocks entire thread
```

**Impact**:
- Can't process events during waits
- Animation system can't run asynchronously
- Network sync issues in multiplayer
- Unresponsive to input during animations

## Why We Can't "Just Fix" Shooting

The shooting issue is a **symptom** of deeper architectural problems:

1. **Old blocking code paths still exist** alongside new async systems
2. **Animation system is incomplete** - missing shot animation queue
3. **Game loop is synchronous** - can't support async animations
4. **Three separate game loops** with 80-90% duplicate code

**Trying to patch shooting now = Band-aid on structural issue**

## The Right Path Forward

### Phase 1: Complete Animation System (Wave 23E)
**Goal**: Make shooting/dunking truly non-blocking

**Tasks**:
1. ✅ Already have: Ball animation state machine
2. ❌ Add: `queueShotAnimation()` method to animation-system.js
3. ❌ Add: `queueDunkAnimation()` method
4. ❌ Remove: All `mswait()` calls from shooting.js
5. ❌ Remove: All `mswait()` calls from dunks.js
6. ❌ Test: Shots complete without blocking

**Files to Modify**:
- `lib/core/animation-system.js` - Add shot/dunk queue methods
- `lib/game-logic/shooting.js` - Remove animateShot(), delegate to system
- `lib/game-logic/dunks.js` - Remove blocking dunk animation
- `lib/game-logic/phase-handler.js` - Already set up, should work once animations exist

**Estimated Effort**: 4-6 hours

### Phase 2: Unify Game Loops (Wave 23F - From GAME-LOOP-ANALYSIS)
**Goal**: Single game loop core, eliminate duplication

**Tasks**:
1. Create `lib/core/game-loop-core.js` with `runGameFrame(systems, config)`
2. Extract shared logic (~150 lines) from gameLoop and runMultiplayerGameLoop
3. Create mode-specific wrappers (SP, MP, Demo)
4. Test all three modes use unified core
5. Eliminate 80-90% code duplication

**Files to Create**:
- `lib/core/game-loop-core.js` - Unified frame logic

**Files to Modify**:
- `nba_jam.js` - gameLoop() becomes thin wrapper
- `nba_jam.js` - runMultiplayerGameLoop() becomes thin wrapper
- `nba_jam.js` - runCPUDemo() already wraps, minimal change

**Estimated Effort**: 6-8 hours

### Phase 3: Non-Blocking Timing (Wave 23G - Wave 23C from original plan)
**Goal**: Replace all mswait() with EventTimer-based scheduler

**Tasks**:
1. Create `lib/core/frame-scheduler.js` using EventTimer
2. Add `systems.frameScheduler` to system-init.js
3. Replace `mswait(frameDelay)` in game loop wrappers
4. Test frame rate stability
5. Verify game speed consistency

**Files to Create**:
- `lib/core/frame-scheduler.js` - Non-blocking frame timing

**Files to Modify**:
- `lib/core/system-init.js` - Add frameScheduler to systems
- `nba_jam.js` - Replace mswait in all three loops

**Estimated Effort**: 3-4 hours

## Recommended Approach

### Option A: Do It Right (Recommended)
**Follow the three phases above in order**

**Pros**:
- Fixes root causes, not symptoms
- Future-proof architecture
- No technical debt accumulation
- Matches original Wave 23 design goals

**Cons**:
- Takes 13-18 hours total
- No immediate gameplay fix

**Timeline**: 2-3 work sessions

### Option B: Quick Hack (Not Recommended)
**Just make animateShot() non-blocking inline**

**Pros**:
- Might get shooting working today

**Cons**:
- Doesn't fix dunks (same problem)
- Doesn't fix game loop blocking
- Doesn't fix 80% code duplication
- Creates more technical debt
- Will need full refactor later anyway

**Verdict**: **False economy - doubles work**

## Current Position

We're at the **architectural crossroads**:

```
                    ┌─────────────────┐
                    │ Systems Refactor│
                    │   ✅ COMPLETE   │
                    └────────┬────────┘
                             │
                             v
                   ┌─────────────────┐
                   │  Can we proceed │
                   │  with gameplay? │
                   └────────┬────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
         ❌ NO (current)          ✅ YES (after Phase 1)
                │                       │
    ┌───────────v──────────┐  ┌────────v─────────┐
    │ Blocking animations  │  │ Async animations │
    │ Stuck shotInProgress │  │ Smooth gameplay  │
    │ mswait() everywhere  │  │ Event-driven     │
    └──────────────────────┘  └──────────────────┘
```

**We're 80% to stable gameplay** - just need to complete the animation system.

## Immediate Next Step

**I recommend**: Start Phase 1 (Complete Animation System)

**Why**:
- Unblocks shooting/dunking
- Aligns with original architecture vision
- Required for Phases 2 & 3 anyway
- Relatively self-contained (one system)

**Alternative**: If gameplay testing is urgent, we could try the quick hack, but acknowledge we'll need to redo it properly later.

**Your call**: Which path do you want to take?

## Success Criteria

### Phase 1 Complete When:
- [ ] `animationSystem.queueShotAnimation()` exists and works
- [ ] `animationSystem.queueDunkAnimation()` exists and works
- [ ] No `mswait()` in shooting.js
- [ ] No `mswait()` in dunks.js
- [ ] Shots complete asynchronously
- [ ] `shotInProgress` clears properly
- [ ] Dunks work without blocking

### Phase 2 Complete When:
- [ ] `runGameFrame()` in game-loop-core.js
- [ ] All three loops use runGameFrame()
- [ ] 0 duplicate game logic between loops
- [ ] All modes tested and working

### Phase 3 Complete When:
- [ ] 0 `mswait()` calls anywhere
- [ ] EventTimer-based frame scheduler working
- [ ] Consistent FPS across all modes
- [ ] No input lag during animations

## Files That Need Work

### High Priority (Phase 1)
- `lib/core/animation-system.js` - Add shot/dunk animation queue
- `lib/game-logic/shooting.js` - Remove blocking animateShot()
- `lib/game-logic/dunks.js` - Remove blocking animation
- `lib/game-logic/phase-handler.js` - Minor adjustments

### Medium Priority (Phase 2)
- `lib/core/game-loop-core.js` - NEW FILE
- `nba_jam.js` - Refactor three loops to use core

### Lower Priority (Phase 3)
- `lib/core/frame-scheduler.js` - NEW FILE
- `lib/core/system-init.js` - Add frameScheduler
- `nba_jam.js` - Replace mswait() calls

## Related Documentation

- `docs/architecture/GAME-LOOP-ANALYSIS.md` - Detailed loop comparison
- `docs/architecture/WAVE-23-ARCHITECTURE.md` - Systems design
- `docs/waves/WAVE-23-PLAN.md` - Original migration plan

---

**Bottom Line**: We have a solid foundation. Now we need to finish the animation system to unblock gameplay, then complete the game loop unification we already planned.
