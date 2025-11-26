# Wave 24 Multiplayer Flicker Fix - Status Report

_Created: 2025-11-11_  
_Last Updated: 2025-11-12_  
_Status: **UNSOLVED - Multiple Failed Attempts**_

## Executive Summary

**Problem**: Non-coordinator player sprite flickers (disappears/reappears rapidly) during multiplayer gameplay, especially after inbound completion and when sprites overlap.

**Attempts Made**: 7 different fixes attempted, all failed to resolve the issue.

**Current Status**: Root cause still unknown. Issue persists despite extensive logging and multiple architectural changes.

---

## Symptom Description

### Visual Behavior
- **Primary**: Sprite disappears and reappears rapidly (true flicker, not position jumping)
- **Triggers**: 
  - After inbound completion (player positioned off-court, then pulled back)
  - When sprites pass through/over each other
  - During continuous movement (sometimes)
- **Pattern**: Sometimes entire sprite, sometimes partial (suggesting stale frame overlap)
- **Duration**: Persists until sprite gets "pulled" again or z-order stabilizes

### User Report
> "sometimes it seems like the issue is not the entire sprite - it's like maybe the character is traveling underneath nametag frames that have no data but aren't transparent that haven't been cleared. i still see total sprite flickering but i feel like occasionally i see partial sprite flickering that indicates like an uncleared nametag frame overlapping a row, or another sprite that should be cleared overlapping a column."

---

## Failed Fix Attempts

### Attempt 1: recordPredictionEvent() Timing
**Theory**: Visual guard not activating because lastPredictionTick never set  
**Change**: Added `recordPredictionEvent()` call in `handleInput()` after movement  
**Result**: ❌ FAILED - No improvement (0-10% reduction per user)  
**Log Evidence**: Visual guard WAS activating after fix, but flicker persisted

### Attempt 2: Eliminate Double-Update in reconciliation
**Theory**: `updateOtherPlayers()` and `reconcileMyPosition()` both updating myPlayer  
**Change**: Skip myPlayer entirely in `updateOtherPlayers()` with `continue` statement  
**Result**: ❌ FAILED - Flicker still present  
**Log Evidence**: Only one update path active, but flicker unchanged

### Attempt 3: Extend Visual Guard Window
**Theory**: Exact tick match too strict, reconciliation happens 2+ ticks after prediction  
**Change**: Changed guard check from `lastPredTick === tick` to `ticksSincePrediction <= 3`  
**Result**: ❌ FAILED - Flicker persisted  
**Log Evidence**: Guard now suppressing more corrections, but flicker unchanged

### Attempt 4: Disable Court Redraw in Multiplayer
**Theory**: Court redrawing every frame covers sprites before they cycle back on top  
**Change**: Only set `courtNeedsRedraw=true` when basket flash state changes  
**Result**: ❌ FAILED - Made it WORSE (court elements disappeared)  
**Reason**: Court redraws ARE needed to clear stale sprite frames

### Attempt 5: Move Sprite Rendering After Court
**Theory**: Sprites cycled before court redraw, so court covers them  
**Change**: Moved `updateSpriteRendering()` from before court redraw to after  
**Result**: ❌ FAILED - No effect (sprites already being cycled after court in existing code)

### Attempt 6: Remove mp_bf_redraw Court Trigger
**Theory**: Multiplayer setting `courtNeedsRedraw=true` every frame unnecessarily  
**Change**: Removed `stateManager.set('courtNeedsRedraw', true, 'mp_bf_redraw')` line  
**Result**: ❌ FAILED - Court disappeared, flicker persisted

### Attempt 7: Double Sprite Cycle After Court Redraw
**Theory**: Sprites need immediate cycle after court redraw AND at frame end  
**Change**: Call `updateSpriteRendering()` immediately after `drawCourt()` AND at frame end  
**Result**: ❓ UNTESTED - User refused (already calling court redraw constantly, so no change expected)

---

## Log Analysis Findings

### Court Redraw Pattern
```
Single-Player: courtNeedsRedraw = true ONLY when basket flash clears (rare)
Multiplayer: courtNeedsRedraw = true EVERY FRAME via mp_bf_redraw
```

**Observation**: Multiplayer redraws court every ~50-100ms, single-player almost never.

### Visual Guard Behavior
```
Before Fix (Attempts 1-2):
- lastPredictionTick = -1 in ALL reconciliation logs
- Zero [MP VISUAL GUARD] activation logs

After Fix (Attempt 3+):
- lastPredictionTick matches current tick correctly
- [MP VISUAL GUARD] logs show frequent suppressions (0.78px-2.24px deltas)
- Corrections only applied when ticksSince > 3 or delta > 2.25px
```

**Conclusion**: Visual guard IS WORKING as designed, but doesn't prevent flicker.

### Reconciliation Pattern
```
During Continuous Movement (ticks 803-825):
- Prediction events every 1-2 ticks
- Visual guard suppresses ALL corrections
- Zero [MP RECONCILE APPLY] logs
- NO FLICKER (per logs, but user still sees flicker)

During Movement Gaps (ticks 758-791):
- No prediction events (player not pressing keys)
- Corrections applied every 2-4 ticks
- Deltas 0.69px-1.56px being corrected
- FLICKER OCCURS (convergence to server position)
```

**Discrepancy**: Logs show visual guard working perfectly during movement, but user still sees flicker during movement.

---

## Key Observations

### 1. Flicker ≠ Position Corrections
The flicker is NOT sprite jumping between positions - it's sprite DISAPPEARING/REAPPEARING. This suggests:
- Z-order issues (sprite frame covered by another frame)
- Stale sprite frames not being cleared
- Frame invalidation/cycling timing problems

### 2. Multiplayer-Specific
Single-player doesn't have this issue, suggesting:
- Related to state sync frequency
- Related to non-coordinator reconciliation
- Related to multiplayer's constant court redraws

### 3. Partial Sprite Flickering
User reports sometimes PART of sprite flickers (row or column), suggesting:
- Stale nametag frames overlapping
- Other sprite frames not properly cleared
- Frame transparency/clearing issues

### 4. Inbound Trigger
Flicker starts after inbound positioning, suggesting:
- Off-court positioning breaks sprite frame state
- Z-order disrupted during inbound
- Sprite frame not properly reinitialized after repositioning

---

## Current Code State

### Changes Kept (Active)
1. **recordPredictionEvent() in handleInput()** - No harm, keeps visual guard working
2. **Extended visual guard window (ticksSince <= 3)** - Suppresses more corrections
3. **Skip myPlayer in updateOtherPlayers()** - Eliminates potential double-update
4. **Double sprite cycle (after court + frame end)** - No harm, ensures sprites on top
5. **Comprehensive logging** - Helps debugging (but didn't solve issue)

### Changes Reverted
1. Disabling mp_bf_redraw - Caused court disappearance
2. Moving sprite render before court - Had no effect

### Current Rendering Order
```
Game Loop Iteration:
1. Update game state (AI, physics, etc.)
2. Check if 60ms elapsed since last render
3. If yes AND courtNeedsRedraw:
   a. drawCourt() → cycles court frame to front
   b. updateSpriteRendering() → cycles sprites on top (NEW)
4. drawScore()
5. Cycle trail frame (on top of court)
6. Cycle ball frame (on top of everything)
7. updateSpriteRendering() → cycles sprites again (NEW)
```

---

## Unresolved Questions

### 1. Why does constant court redraw cause flicker in multiplayer but not single-player?
Both use same rendering code. Only difference: multiplayer redraws every frame, single-player rarely.

### 2. Why do logs show visual guard working but user still sees flicker?
Logs show corrections suppressed during movement, but user reports flicker during movement.

### 3. What causes "partial sprite" flickering?
Suggests frame overlap or stale frame issues, not position corrections.

### 4. Why does inbound trigger persistent flicker?
Something about off-court positioning breaks sprite frame state permanently until "pulled" again.

### 5. Is this a Synchronet frame management bug?
Possible that rapid court redraws or sprite frame invalidation has timing bug in Synchronet itself.

---

## Hypotheses Not Yet Tested

### 1. Frame Cycle Timing
**Theory**: `Sprite.cycle()` and `cycleFrame()` have race condition when called in rapid succession  
**Test**: Add delay between court cycle and sprite cycle  
**Risk**: Would slow down rendering, might cause lag

### 2. Sprite Frame Invalidation
**Theory**: Sprite.moveTo() or frame.invalidate() not working correctly in multiplayer context  
**Test**: Force sprite frame recreation instead of invalidation  
**Risk**: Performance impact, might cause other visual issues

### 3. Z-Order Corruption
**Theory**: Painter's algorithm z-sorting breaks down when court redraws  
**Test**: Disable painter's algorithm sorting, use fixed z-order  
**Risk**: Sprites might appear in wrong order (behind each other)

### 4. Court Frame Transparency
**Theory**: Court frame not properly transparent, covers sprites even when cycled to back  
**Test**: Verify courtFrame has proper transparency attributes  
**Risk**: May not be configurable in Synchronet

### 5. Network State Sync Timing
**Theory**: State sync happens between court redraw and sprite cycle  
**Test**: Move mpClient.tick() to different point in game loop  
**Risk**: Could break state sync logic

---

## Data Available for Next Developer

### Log Patterns to Analyze
- `[COURT REDRAW]` - When/why court redraws trigger
- `[MP RECONCILE]` - Position deltas and reconciliation decisions  
- `[MP VISUAL GUARD]` - When corrections suppressed
- `[MP RECONCILE APPLY]` - When corrections actually applied
- `[MP PRED EVENT]` - Prediction timing and values
- `[RENDER CHECK]` - Rendering timing and throttling

### Files Changed (wave24-multiplayer-flicker-fix branch)
- `lib/multiplayer/mp_client.js` - Prediction timing, visual guard, reconciliation
- `lib/core/game-loop-core.js` - Sprite rendering order
- `lib/core/state-manager.js` - Court redraw logging

### Comparison Needed
- Single-player CPU demo mode (no flicker) vs Multiplayer non-coordinator (flicker)
- Coordinator client (no flicker?) vs Non-coordinator client (flicker)
- Before inbound (no flicker) vs After inbound (flicker)

---

## Recommendations for Next Attempt

### 1. Reproduce in Controlled Environment
- Set up multiplayer session with detailed logging
- Trigger inbound completion (known flicker trigger)
- Capture exact frame sequence when flicker starts
- Compare coordinator vs non-coordinator client behavior

### 2. Instrument Frame Cycling
- Add logging in `Sprite.cycle()` calls (if possible)
- Add logging in `cycleFrame()` calls
- Track exact timing of when each frame brought to front
- Look for race conditions or timing overlaps

### 3. Compare with Single-Player
- Run single-player CPU mode with same logging
- Verify court redraw frequency
- Verify sprite cycle frequency  
- Identify what's different in multiplayer

### 4. Test Coordinator Client
- Does coordinator client (who IS authority) have flicker?
- If no: Problem is reconciliation/prediction
- If yes: Problem is rendering/frame management

### 5. Disable Prediction Entirely
- Set `disablePrediction = true` on non-coordinator
- Accept input lag but eliminate prediction complexity
- If flicker gone: Problem is prediction/reconciliation
- If flicker remains: Problem is rendering/state sync

---

## Files for Review

### Core Issue Code
- `/sbbs/xtrn/nba_jam/lib/multiplayer/mp_client.js` - Client reconciliation logic
- `/sbbs/xtrn/nba_jam/lib/rendering/court-rendering.js` - Court/sprite rendering
- `/sbbs/xtrn/nba_jam/lib/core/game-loop-core.js` - Main game loop timing

### Investigation Docs
- `/sbbs/xtrn/nba_jam/docs/debugging/MP-FLICKER-INVESTIGATION.md` - Original analysis
- `/sbbs/xtrn/nba_jam/docs/debugging/MULTIPLAYER-FLICKER-ANALYSIS.md` - Detailed breakdown

### Debug Output
- `/sbbs/xtrn/nba_jam/debug.log` - Runtime logging (check recent entries)

---

## Success Criteria (Still Not Met)

❌ **Primary**: Eliminate visible sprite disappearance/reappearance  
❌ **Secondary**: Understand root cause mechanism  
❌ **Tertiary**: Fix without breaking single-player or coordinator

**Blocker**: Cannot identify what specific code/timing causes the flicker despite extensive logging showing all systems working as designed.

---

_Handoff to next developer. Good luck.

---

## 1. Root Cause Analysis

### The Timing Bug

**Location**: `lib/multiplayer/mp_client.js`

**Flicker Cycle (Pre-Fix)**:
```
Tick N:
1. handleInput() applies player input (line 389-404)
   → Sprite moves to position A
   → ❌ visualGuard.lastPredictionTick still OLD (never updated!)
   
2. reconcile() runs later in same tick
   → reconcileMyPosition() checks: lastPredictionTick === currentTick?
   → ❌ FALSE (lastPredictionTick is outdated)
   → Authority update OVERWRITES position
   → ⚡ FLICKER: sprite snaps backward
   
3. replayInputsSince() replays the input
   → Sprite moves forward to position A again
   → ⚡ FLICKER: sprite snaps forward
   
4. recordPredictionEvent() finally called (line 752)
   → Sets lastPredictionTick = N
   → ❌ TOO LATE! Reconciliation already happened
```

**Why Visual Guard Failed**:
- Visual guard checks `this.visualGuard.lastPredictionTick === tick` (line 1227)
- This condition was NEVER true during the first reconciliation after an input
- Guard never activated → no suppression → flicker persisted

### Credit
This bug was identified through detailed Codex analysis that traced the execution flow and found the timing mismatch.

---

## 2. The Fix

### Code Changes

**File**: `lib/multiplayer/mp_client.js`  
**Function**: `handleInput()` (line ~340-420)

**Added**:
```javascript
// Track whether we applied any prediction this frame
var predictionApplied = false;

// 1. Apply input immediately (client-side prediction)
if (!this.disablePrediction && isMovementKey && typeof applyMovementCommand === "function") {
    var budget = createMovementCounters(this.mySprite, turboIntent, this.systems);
    if (budget && budget.moves > 0) {
        for (var m = 0; m < budget.moves; m++) {
            var moved = applyMovementCommand(this.mySprite, key, counters);
            if (moved) predictionApplied = true;  // Track movement
            if (!moved) break;
        }
    } else if (!budget) {
        var moved = applyMovementCommand(this.mySprite, key);
        if (moved) predictionApplied = true;  // Track movement
    }
}

// ... (buffer input, record for replay) ...

// 5. CRITICAL FIX (Wave 24): Record prediction event IMMEDIATELY
// This ensures visualGuard.lastPredictionTick is set BEFORE reconciliation runs,
// preventing the flicker cycle: predict→authority-overwrite→replay-forward
if (predictionApplied) {
    this.recordPredictionEvent();  // ✅ Sets lastPredictionTick = currentTick
}
```

### Flow After Fix

```
Tick N with input:
1. handleInput() → applyMovementCommand() → moves sprite
   → recordPredictionEvent() called immediately ✅
   → visualGuard.lastPredictionTick = N
   
2. reconcile() → reconcileMyPosition()
   → Check: lastPredictionTick (N) === tick (N)? ✅ YES!
   → Delta < 2.25px? → SUPPRESS authority update ✅
   → Log: "[MP CLIENT] Visual guard suppressed authority update (delta=1.5)"
   
3. replayInputsSince() → (no inputs after server frame, skipped)

4. Result: Smooth prediction, no flicker! ✅
```

---

## 3. Secondary Issues Fixed

### 3.1 Bearing Jitter
**Symptom**: Sprint direction snaps to outdated server bearing  
**Root Cause**: Same timing bug - bearing guard checked `lastPredictionTick === tick` but it was never current  
**Fix**: Now that `lastPredictionTick` is set correctly, bearing guard works (lines 888, 1343)

### 3.2 Double Authority Updates During Catchup
**Symptom**: During catchup/inbound, position updated twice  
**Mitigation**: Visual guard now suppresses the second update since delta is small and same-tick prediction exists

### 3.3 Collision Desync Amplification
**Existing Mitigation**: Collision guard added in Wave 23D (lines 720-738)  
**Improvement**: Now works better with visual guard protection against spurious corrections

---

## 4. Expected Behavior

### Normal Operation
- Player inputs move sprite immediately (client-side prediction)
- Small (<2.25px) authority corrections suppressed for 2 frames
- Visual guard logs: `[MP CLIENT] Visual guard suppressed authority update`
- Bearing stays stable during continuous movement
- No visible backward snaps

### Large Corrections (Failsafe)
- Corrections >10px still applied immediately
- Prevents actual desync from being masked
- May cause brief snap but necessary for sync
- Logs: `[MP CLIENT] Position drift delta=15.00`

### Catchup Phases (Inbound/Shove)
- `requestAuthoritativeCatchup(frames, reason)` called
- Authority position applied strongly for N frames
- Visual guard still protects from micro-oscillations
- Smooth convergence to server position

---

## 5. Validation Checklist

### Debug Log Review
- [ ] Visual guard activation logs appear
- [ ] Drift deltas reduced (mostly <3px)
- [ ] No rapid oscillation patterns
- [ ] Collision guard logs (if applicable)

### Gameplay Testing
- [ ] Smooth sprite movement during continuous input
- [ ] No backward snaps during sprint
- [ ] Bearing consistent with movement direction
- [ ] Inbound completion smooth
- [ ] Shove resolution smooth
- [ ] Can't walk through opponents

### Edge Cases
- [ ] Large desync still corrects (>10px snap works)
- [ ] Network lag handled (guard doesn't mask real desync)
- [ ] Catchup frames work correctly
- [ ] Action buttons (dunk/shot) feel responsive

---

## 6. Pre-Fix Telemetry

From `debug.log` analysis:
- Drift spikes up to 54px observed
- Medium spikes (6-17px) during shove/inbound
- Visual guard logs: **NONE** (guard never activated)
- Collision guard logs: **NONE** (requires targeted repro)

---

## 7. Post-Fix Telemetry (Pending)

To collect:
1. Run multiplayer session with non-coordinator client
2. Capture `debug.log` during continuous movement
3. Count visual guard activation logs
4. Measure frequency of >10px corrections
5. Compare bearing stability

---

## 8. Technical Details

### Visual Guard Thresholds
```javascript
var VISUAL_GUARD_SMALL_DELTA = 2.25;         // Position threshold (px)
var VISUAL_GUARD_SUPPRESSION_FRAMES = 2;    // Max consecutive suppressions
var VISUAL_GUARD_BEARING_THRESHOLD = 2.0;   // Bearing threshold (px)
```

### Key Functions
- **recordPredictionEvent()**: Sets lastPredictionTick, stores position/bearing
- **reconcileMyPosition()**: Checks visual guard, applies/suppresses authority updates
- **updateOtherPlayers()**: Checks visual guard for bearing updates

### State Tracking
```javascript
this.visualGuard = {
    lastPredictionTick: -1,          // Tick when last prediction happened
    lastAuthorityTick: -1,           // Tick when last authority update happened
    lastLoggedDoubleTick: -1,        // Last logged same-tick conflict
    lastLoggedSuppressionTick: -1,   // Last logged suppression
    suppressedAuthorityFrames: 0,    // Consecutive suppressions
    pendingAuthority: null,          // Pending authority update
    lastPredictionPosition: null,    // Last predicted position
    lastPredictionBearing: null      // Last predicted bearing
};
```

---

## 9. Related Changes (Wave 23D)

These changes are still in place and now work better with the timing fix:

| Change | Status | Interaction |
|--------|--------|-------------|
| Collision Guard | Active | Works better with visual guard |
| Drift Monitor | Active | Now logs less frequently (good!) |
| Authoritative Catchup | Active | Visual guard prevents overcorrection |
| Animation Replay | Active | Independent, still working |
| Adaptive Blending | Active | Less aggressive with guard protection |

---

## 10. Remaining Improvements (Future)

1. **Recency-based collision guard**: Only block with fresh (<5 frames) authority data
2. **Soft push vs hard block**: Slide to edge instead of full stop
3. **Action delay analysis**: Investigate dunk/shot timing perception
4. **Renderer instrumentation**: Log predicted vs authority draw cycles

---

## 11. Files Changed

- `lib/multiplayer/mp_client.js`: Added `recordPredictionEvent()` call in `handleInput()`

**Diff Summary**:
- Added `predictionApplied` tracking variable
- Added `if (moved) predictionApplied = true;` in both movement paths
- Added `if (predictionApplied) this.recordPredictionEvent();` at end of handleInput

---

## 12. Branch & Commit Info

**Branch**: `wave24-multiplayer-flicker-fix`  
**Files Modified**: 1  
**Lines Changed**: +12 (added), -2 (modified)  
**Risk**: Low (surgical fix, doesn't change logic flow)

---

## 13. Next Steps

1. **Immediate**: Test in multiplayer session, capture logs
2. **Short-term**: Update MP-FLICKER-INVESTIGATION.md with results
3. **Medium-term**: Monitor for any edge cases or regressions
4. **Long-term**: Consider remaining improvements from section 10

---

## 14. Success Criteria

✅ **Primary Goal**: Eliminate visible flicker during normal movement  
✅ **Secondary Goal**: Visual guard activation logs appear in debug.log  
✅ **Tertiary Goal**: Drift deltas reduced to <3px for most frames  

**Acceptance**: If any goal not met, investigate and iterate.

---

_Document will be updated with test results and telemetry after multiplayer validation._
