# Wave 23C: Timing & Animation System Refactor

**Status**: Not Started  
**Prerequisites**: Wave 23B Cleanup Complete  
**Estimated Scope**: Large - Core gameplay timing overhaul

## Problem Statement

Game completes instantly on startup. Animations that used to block with `mswait()` now execute immediately, causing the game to blow through all frames and reach game-over screen.

### Root Cause
Wave 22-23 refactored to non-blocking architecture but timing system still assumes blocking calls. When `mswait()` is removed, nothing prevents the game loop from running at infinite speed.

## Blocking Call Inventory (31 instances)

### Critical (Game Loop Blocking)
- **lib/game-logic/dunks.js**: 8 instances
  - Lines: 683, 687, 714, 743, 748, 755 (animation frames)
  - Impact: Dunk animations instant
  
- **lib/game-logic/physical-play.js**: ~18 instances
  - createLooseBall() animation loop
  - Impact: Loose ball animations instant

### UI/Menu Blocking (Low Priority)
- **lib/multiplayer/mp_lobby.js**: 4 instances
  - Lines: 409, 420, 476, 578 (menu delays)
  - Impact: Menus flash instantly
  
- **lib/multiplayer/mp_config.js**: 1 instance
  - Line: 217 (config delay)
  - Impact: Config screen instant

## Proposed Solution: EventTimer-Based Scheduler

### Architecture

```javascript
// New system: lib/core/event-timer.js
function createAnimationScheduler(frameDelayMs) {
    var timer = new EventTimer(frameDelayMs);
    var queue = [];
    
    return {
        scheduleFrame: function(delayMs, callback) {
            queue.push({ delay: delayMs, callback: callback });
        },
        tick: function() {
            // Process queued frames based on elapsed time
        },
        cancel: function() {
            queue = [];
        }
    };
}
```

### Game Loop Integration

```javascript
// Instead of blocking:
function animateDunk(player, systems) {
    for (var i = 0; i < 10; i++) {
        updateSprite(player, i);
        mswait(30); // ❌ Blocks entire game
    }
}

// Use scheduler:
function animateDunk(player, systems, onComplete) {
    var frame = 0;
    var scheduler = systems.animationScheduler;
    
    function nextFrame() {
        if (frame >= 10) {
            onComplete();
            return;
        }
        updateSprite(player, frame);
        frame++;
        scheduler.scheduleFrame(30, nextFrame);
    }
    
    nextFrame();
}
```

## Synchronet EventTimer API

```javascript
// Synchronet provides EventTimer class
var timer = new EventTimer();

// Wait for interval (non-blocking in event loop)
timer.wait(delayMs);

// Check if time elapsed
if (timer.elapsed >= delayMs) {
    // Execute
}
```

## Migration Strategy

### Phase 1: Core Animation Framework
1. Create `lib/core/animation-scheduler.js`
2. Add `animationScheduler` to systems object
3. Integrate with main game loop timing
4. Write unit tests for scheduler

### Phase 2: Convert Dunk Animations
1. Refactor `animateDunk()` to callback-based
2. Convert all 8 mswait() calls in dunks.js
3. Test dunks still animate correctly
4. Verify no blocking

### Phase 3: Convert Loose Ball Animations  
1. Refactor `createLooseBall()` animation loop
2. Convert ~18 mswait() calls in physical-play.js
3. Test loose ball physics
4. Verify multiplayer compatibility

### Phase 4: UI Delays (Optional)
1. Convert menu mswait() calls
2. Use scheduler for UI timing
3. Keep UI responsive

### Phase 5: Integration Testing
1. Full game playthrough
2. Verify all animations play
3. Check multiplayer sync
4. Performance profiling

## Technical Challenges

### Challenge 1: Callback Hell
**Problem**: Nested animations become deeply nested callbacks

**Solution**: Promise-like pattern or async/await equivalent
```javascript
function animateSequence(steps, systems) {
    var current = 0;
    function next() {
        if (current >= steps.length) return;
        steps[current](systems, next);
        current++;
    }
    next();
}
```

### Challenge 2: Multiplayer Sync
**Problem**: Non-blocking animations complicate MP synchronization

**Solution**: Frame-locked updates with deterministic timing
```javascript
// All clients advance in lockstep frames
// Animations don't block game state updates
// State updates wait for frame boundaries
```

### Challenge 3: Game Loop Control
**Problem**: How to prevent infinite loop without mswait()?

**Solution**: Frame rate limiting with EventTimer
```javascript
function gameLoop(systems) {
    var frameTimer = new EventTimer();
    var targetFrameTime = 16.67; // 60 FPS
    
    while (gameRunning) {
        var frameStart = Date.now();
        
        // Game logic update
        updateGame(systems);
        
        // Wait for frame time
        var frameEnd = Date.now();
        var elapsed = frameEnd - frameStart;
        var remaining = targetFrameTime - elapsed;
        
        if (remaining > 0) {
            frameTimer.wait(remaining);
        }
    }
}
```

## Testing Requirements

### Unit Tests
- [ ] AnimationScheduler.scheduleFrame()
- [ ] AnimationScheduler.cancel()
- [ ] Frame timing accuracy
- [ ] Queue management

### Integration Tests
- [ ] Dunk animation completes
- [ ] Loose ball animation completes
- [ ] Multiple simultaneous animations
- [ ] Game loop frame rate stable

### Performance Tests
- [ ] Frame rate consistency
- [ ] No memory leaks from queued callbacks
- [ ] Multiplayer latency acceptable

## Success Criteria

- [ ] Game plays at normal speed (not instant)
- [ ] All animations play correctly
- [ ] No blocking calls (0 mswait in game logic)
- [ ] 60 FPS stable (or configured target)
- [ ] Multiplayer sync maintained
- [ ] No regressions in existing tests

## Risk Assessment

**High Risk**:
- Breaking multiplayer synchronization
- Introducing timing bugs
- Animation glitches

**Medium Risk**:
- Performance degradation
- Callback complexity
- Testing coverage gaps

**Low Risk**:
- UI menu timing (non-critical)
- Single-player only features

## Timeline Estimate

- Phase 1 (Framework): 2-3 commits
- Phase 2 (Dunks): 2-3 commits
- Phase 3 (Loose Ball): 3-4 commits
- Phase 4 (UI): 1-2 commits
- Phase 5 (Testing): 2-3 commits

**Total**: ~12-15 commits, significant refactor

## Related Documentation

- **Blocking Calls Map**: docs/BLOCKING-CALLS.md (to be created)
- **Animation System**: docs/architecture/ANIMATION-SYSTEM.md (to be created)
- **Multiplayer Timing**: docs/archive/waves-20-21/multiplayer_design_and_architecture.md

## Open Questions

1. Should we use Synchronet's EventTimer directly or wrap it?
2. How do we handle animation cancellation (player interrupt)?
3. What's the target frame rate (60 FPS? Configurable)?
4. Do we need animation priority/layering?
5. How to maintain backward compatibility with old game modes?

## Next Actions

1. Review Synchronet EventTimer documentation
2. Create blocking calls detailed map
3. Design AnimationScheduler API
4. Write unit tests for scheduler
5. Begin Phase 1 implementation
