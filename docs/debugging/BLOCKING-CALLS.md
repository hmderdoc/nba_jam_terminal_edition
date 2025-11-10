# Blocking Calls Inventory

**Purpose**: Map all `mswait()` calls that need to be replaced with EventTimer-based scheduling  
**Related**: docs/waves/WAVE-23C-TIMING.md  
**Status**: 31 instances identified

## Summary

| File | Count | Type | Priority |
|------|-------|------|----------|
| lib/game-logic/dunks.js | 8 | Animation | Critical |
| lib/game-logic/physical-play.js | ~18 | Animation | Critical |
| lib/multiplayer/mp_lobby.js | 4 | UI Delay | Low |
| lib/multiplayer/mp_config.js | 1 | UI Delay | Low |

## Critical: Game Logic (26 instances)

### lib/game-logic/dunks.js (8 instances)

All in `animateDunk()` function, blocking during dunk animations:

```
Line 683: mswait(30);  // Frame 1
Line 687: mswait(30);  // Frame 2
Line 714: mswait(30);  // Jump ascent
Line 743: mswait(30);  // At rim
Line 748: mswait(30);  // Dunk motion 1
Line 755: mswait(30);  // Dunk motion 2
Line ???: mswait(30);  // Additional frames (verify exact count)
Line ???: mswait(30);  // Additional frames
```

**Impact**: Dunk animations complete instantly, visual effect lost  
**Frequency**: Multiple per game (every dunk attempt)  
**Dependencies**: Sprite updates, score flash timing, crowd reaction

### lib/game-logic/physical-play.js (~18 instances)

Primarily in `createLooseBall()` animation loop:

```javascript
// Approximate location - need to verify exact lines
function createLooseBall(x, y, vx, vy, systems) {
    // Animation loop with multiple mswait() calls
    while (animating) {
        updatePosition();
        checkBounds();
        drawFrame();
        mswait(16); // ~60 FPS animation ❌ Blocks
    }
}
```

**Pattern**: Loop-based animation with mswait() for frame timing  
**Impact**: Loose ball physics animations instant, no visual feedback  
**Frequency**: High (every turnover, steal, rebound conflict)  
**Dependencies**: Ball physics, player collision detection, possession transfer

**TODO**: Get exact line numbers with grep_search

## Low Priority: UI/Menu (5 instances)

### lib/multiplayer/mp_lobby.js (4 instances)

Menu delay for user feedback:

```
Line 409: mswait(500);  // Player joined feedback
Line 420: mswait(300);  // Menu transition
Line 476: mswait(200);  // Selection confirmation  
Line 578: mswait(150);  // Status update delay
```

**Impact**: Menus flash instantly, hard to read  
**Priority**: Low - cosmetic issue, doesn't break gameplay  
**Alternative**: Could use console.pause() or just remove delays

### lib/multiplayer/mp_config.js (1 instance)

```
Line 217: mswait(250);  // Config save confirmation
```

**Impact**: Config screen doesn't pause for confirmation  
**Priority**: Low - nice to have

## Migration Notes

### Conversion Pattern

**Before (Blocking)**:
```javascript
function animateAction(player) {
    for (var i = 0; i < frames.length; i++) {
        drawFrame(player, frames[i]);
        mswait(frameDelay); // ❌ Blocks execution
    }
    onComplete();
}
```

**After (Non-Blocking)**:
```javascript
function animateAction(player, systems, onComplete) {
    var frameIndex = 0;
    var scheduler = systems.animationScheduler;
    
    function nextFrame() {
        if (frameIndex >= frames.length) {
            onComplete();
            return;
        }
        drawFrame(player, frames[frameIndex]);
        frameIndex++;
        scheduler.scheduleFrame(frameDelay, nextFrame);
    }
    
    nextFrame();
}
```

### Key Changes
1. Add `onComplete` callback parameter
2. Replace for/while loops with recursive callback
3. Use scheduler instead of mswait()
4. Preserve frame timing with scheduler delay

### Testing Checklist
- [ ] Animation plays at correct speed
- [ ] Animation can be interrupted
- [ ] No memory leaks from callbacks
- [ ] Multiplayer sync maintained
- [ ] Multiple simultaneous animations work

## Detailed Analysis Needed

### Questions to Answer
1. **Exact line numbers**: Run grep to find all mswait() calls
2. **Frame delays**: What ms values are used? (30ms, 16ms, varies?)
3. **Loop patterns**: How many use for loop vs while?
4. **Nested animations**: Any animations that trigger other animations?
5. **Conditional delays**: Any mswait() in if statements?

### Grep Command
```bash
grep -n "mswait(" lib/game-logic/*.js lib/multiplayer/*.js
```

## Wave 23C Phase Mapping

### Phase 2: Dunks (8 calls)
- Start: Line 683 in dunks.js
- End: Line 755+ in dunks.js
- Strategy: Convert to callback chain
- Test: Verify dunk animations visible

### Phase 3: Loose Ball (18 calls)
- Start: physical-play.js createLooseBall()
- End: All animation loops converted
- Strategy: Refactor loop to scheduler
- Test: Verify ball physics animations

### Phase 4: UI (5 calls - optional)
- Start: mp_lobby.js line 409
- End: mp_config.js line 217
- Strategy: Simple delay conversion
- Test: Verify menus readable

## Performance Considerations

### Current Behavior
- mswait(30) = ~33 FPS animation
- mswait(16) = ~60 FPS animation
- Blocks entire game during wait

### Target Behavior
- EventTimer schedules callbacks
- Game loop continues during animations
- Multiple animations can run concurrently
- Frame rate limited by game loop, not mswait()

### Risks
- **CPU usage**: Infinite loop if no frame limiting
- **Callback bloat**: Too many queued animations
- **Timing drift**: Scheduler delays accumulate

## Success Metrics

- [ ] 0 mswait() calls in game logic files
- [ ] All animations play correctly
- [ ] Game runs at target FPS (60?)
- [ ] No blocking during gameplay
- [ ] Multiplayer sync unaffected

## Related Files

**Core Systems**:
- lib/core/event-timer.js (to be created)
- lib/core/animation-scheduler.js (to be created)

**Animation Consumers**:
- lib/game-logic/dunks.js (8 calls)
- lib/game-logic/physical-play.js (~18 calls)
- lib/game-logic/shots.js (check for any)
- lib/game-logic/rebounds.js (check for any)

**UI**:
- lib/multiplayer/mp_lobby.js (4 calls)
- lib/multiplayer/mp_config.js (1 call)

## Next Steps

1. Run grep to get exact line numbers
2. Verify count in physical-play.js (estimated ~18)
3. Check other game-logic files for missed mswait()
4. Document frame delay patterns (30ms vs 16ms)
5. Identify nested animation dependencies
