# Wave 22B: State Machine Architecture Design

## Problem Statement

The codebase mixes blocking (`mswait()`) and non-blocking (`animationSystem.update()`) code, causing:
- Shot arcs invisible for made shots (game loop blocked during animation window)
- Technical debt and timing conflicts
- `setupInbound()` called before animations complete

## Current Flow (Blocking)

```
Shot attempted
  ↓
mswait() blocks entire game loop
  ↓
animationSystem.update() never runs (loop is blocked!)
  ↓
Ball sprite updates position (invisible to user)
  ↓
mswait() unblocks
  ↓
setupInbound() moves sprites (animation not seen)
```

## Proposed State Machine

### Game Phase States

```javascript
gameState.phase = {
    current: "NORMAL",  // Current phase
    data: {}            // Phase-specific data
}
```

### States:

1. **NORMAL**
   - Normal gameplay, ball handler dribbling/passing
   - Game loop runs freely
   - Transitions: SHOT_QUEUED

2. **SHOT_QUEUED**
   - Shot attempt triggered, animation queued
   - Set by: `attemptShot()`, `attemptDunk()`
   - Data: `{shooter, startX, startY, targetX, targetY, attemptType, shotRoll}`
   - Duration: 1 frame (immediate transition to SHOT_ANIMATING)
   - Transitions: SHOT_ANIMATING

3. **SHOT_ANIMATING**
   - Shot animation in progress
   - Game loop continues, `animationSystem.update()` runs every frame
   - Check `animationSystem.isBallAnimating()` to detect completion
   - Duration: ~800ms (variable based on distance)
   - Transitions: SHOT_SCORED or SHOT_MISSED

4. **SHOT_SCORED**
   - Made basket, score updated
   - Display score flash (non-blocking visual)
   - Data: `{scoringTeam, points, is3Pointer}`
   - Duration: 900ms (for dunks) or 800ms (for jump shots)
   - Transitions: INBOUND_SETUP

5. **SHOT_MISSED**
   - Missed shot, rebound scramble activated
   - `createRebound()` already called, scramble active
   - Data: `{reboundX, reboundY, blocked}`
   - Duration: 200ms brief pause
   - Transitions: REBOUND_SCRAMBLE (or NORMAL if someone secures it immediately)

6. **REBOUND_SCRAMBLE**
   - Multiple players contesting rebound
   - Existing `reboundScramble` logic already non-blocking
   - Duration: Up to 2000ms (handled by existing system)
   - Transitions: NORMAL (when secured)

7. **INBOUND_SETUP**
   - Setting up for inbound after made basket
   - Position sprites for inbound play
   - Data: `{inboundingTeam, inboundPasser}`
   - Duration: 200ms
   - Transitions: NORMAL

### State Transition Diagram

```
                           ┌──────────────┐
                           │    NORMAL    │ ◄──────────────┐
                           └───────┬──────┘                │
                                   │                       │
                         Shot Attempted                    │
                                   │                       │
                                   ▼                       │
                           ┌──────────────┐                │
                           │SHOT_QUEUED   │                │
                           └───────┬──────┘                │
                                   │                       │
                           Animation queued                │
                                   │                       │
                                   ▼                       │
                           ┌──────────────┐                │
                           │SHOT_ANIMATING│                │
                           └───────┬──────┘                │
                                   │                       │
                         Animation completes               │
                                   │                       │
                      ┌────────────┴────────────┐          │
                      │                         │          │
                   Made                      Missed        │
                      │                         │          │
                      ▼                         ▼          │
              ┌──────────────┐          ┌──────────────┐  │
              │ SHOT_SCORED  │          │ SHOT_MISSED  │  │
              └───────┬──────┘          └───────┬──────┘  │
                      │                         │          │
                 Score flash              Create rebound   │
                      │                         │          │
                      ▼                         ▼          │
              ┌──────────────┐          ┌──────────────┐  │
              │INBOUND_SETUP │          │REBOUND_      │  │
              └───────┬──────┘          │SCRAMBLE      │  │
                      │                 └───────┬──────┘  │
                      │                         │          │
                      │                  Secured rebound   │
                      │                         │          │
                      └─────────────┬───────────┘          │
                                    │                      │
                                    └──────────────────────┘
```

## Frame-Based Timing

Replace `mswait(ms)` with frame counters:

```javascript
gameState.phase.data.frameCounter = 0;
gameState.phase.data.targetFrames = Math.round(ms / frameDelay);

// In game loop:
if (gameState.phase.data.frameCounter < gameState.phase.data.targetFrames) {
    gameState.phase.data.frameCounter++;
    // Continue rendering, updating animations
} else {
    // Transition to next phase
}
```

## Implementation Plan

### Phase 1: Add State Machine to game-state.js
- Add `gameState.phase` object
- Create phase constants
- Add helper functions: `setPhase()`, `getPhase()`, `advancePhaseTimer()`

### Phase 2: Refactor shooting.js
- Remove `mswait()` from `animateShot()`
- Queue shot animation, set phase to SHOT_QUEUED
- Let game loop handle phase transitions
- Move post-shot logic to phase handlers

### Phase 3: Refactor dunks.js
- Remove `mswait()` from `animateDunk()`
- Use non-blocking animation queueing
- Integrate with phase system

### Phase 4: Add Phase Handlers to game loop
- Create `updateGamePhase()` function
- Handle each phase's logic and transitions
- Call from main game loop

### Phase 5: Testing
- Verify shot arcs visible for made shots
- Ensure rebounds still work correctly
- Test multiplayer synchronization
- Validate timing feels correct

## Benefits

✅ Shot animations visible throughout flight  
✅ No blocking code in game logic  
✅ Cleaner separation of concerns  
✅ Easier to debug timing issues  
✅ Better multiplayer synchronization  
✅ More maintainable architecture  

## Risks & Mitigation

**Risk:** Timing feels different  
**Mitigation:** Use same duration values (800ms, 900ms, etc.), just frame-based

**Risk:** Multiplayer desync  
**Mitigation:** Phase state is part of gameState, synchronized via coordinator

**Risk:** Breaking existing features  
**Mitigation:** Test thoroughly, keep rebound/inbound systems mostly unchanged

## Files to Modify

1. `lib/game-logic/game-state.js` - Add phase state machine
2. `lib/game-logic/shooting.js` - Remove blocking, integrate phases
3. `lib/game-logic/dunks.js` - Remove blocking, integrate phases
4. `nba_jam.js` - Add phase update logic to game loop
5. `lib/game-logic/physical-play.js` - Remove `mswait()` from shove animations

## Estimated Effort

- Phase 1: 30 minutes
- Phase 2: 1 hour
- Phase 3: 45 minutes
- Phase 4: 45 minutes
- Phase 5: 30 minutes
**Total: ~3.5 hours**
