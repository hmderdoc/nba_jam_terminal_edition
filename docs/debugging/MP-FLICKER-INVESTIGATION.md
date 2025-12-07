# Wave 24 Multiplayer Flicker Investigation - Updated

_Last updated: 2025-11-12_  
_Status: **UNSOLVED - 7 Attempts Failed**_

## 1. Problem Definition
**Core Issue**: Non-coordinator player sprite DISAPPEARS and REAPPEARS rapidly (true flicker, not position jumping).

**Key Clarification**: This is NOT position oscillation - the sprite literally becomes invisible then visible again in rapid succession.

**Triggers**:
- After inbound completion (player pulled from off-court to on-court)
- When sprites pass through/overlap each other
- During continuous movement (sometimes)
- Pattern sometimes shows PARTIAL flickering (suggesting frame overlap issues, not position corrections)

## 2. Current Symptoms (Refined Understanding)

### Visual Behavior
- **Sprite disappears**: Entire sprite or portions become invisible for 1 frame
- **Rapid reappearance**: Sprite becomes visible again next frame
- **Not position jumping**: Sprite location doesn't change, just visibility
- **Partial flickering**: Sometimes only part of sprite (row/column) flickers, suggesting frame overlap

### User Description
> "sometimes it seems like the issue is not the entire sprite - it's like maybe the character is traveling underneath nametag frames that have no data but aren't transparent that haven't been cleared. i still see total sprite flickering but i feel like occasionally i see partial sprite flickering that indicates like an uncleared nametag frame overlapping a row, or another sprite that should be cleared overlapping a column."

### Timing
- Flicker STARTS after inbound (off-court positioning, then pulled back)
- Flicker PERSISTS during subsequent movement
- Flicker sometimes STOPS when sprite gets "pulled" again or z-order restabilizes

## 3. Failed Fix Attempts (Detailed)

### Attempt 1: recordPredictionEvent() Timing Fix
**Date**: 2025-11-12  
**Theory**: Visual guard not activating because `lastPredictionTick` never set correctly  
**Change**: Added `recordPredictionEvent()` call immediately after movement in `handleInput()`  
**Code**: `lib/multiplayer/mp_client.js` line ~430  
**Result**: ❌ **FAILED** - User reported 0-10% improvement at best  
**Log Evidence**: 
- Before: `lastPredictionTick=-1` in all reconciliation logs, zero visual guard activations
- After: `lastPredictionTick` matches current tick, visual guard activating frequently
- **Conclusion**: Visual guard IS NOW WORKING but doesn't prevent flicker

### Attempt 2: Eliminate Double-Update
**Date**: 2025-11-12  
**Theory**: Both `updateOtherPlayers()` and `reconcileMyPosition()` updating myPlayer sprite  
**Change**: Added `continue` statement in `updateOtherPlayers()` to skip myPlayer entirely  
**Code**: `lib/multiplayer/mp_client.js` line ~819  
**Result**: ❌ **FAILED** - No improvement  
**Log Evidence**: Only one update path active (verified by logs), flicker unchanged  
**Conclusion**: Double-update was not the cause

### Attempt 3: Extended Visual Guard Window
**Date**: 2025-11-12  
**Theory**: Exact tick match (`lastPredTick === tick`) too strict; reconciliation happens 2+ ticks later  
**Change**: Changed guard check to `ticksSincePrediction <= 3` (window instead of exact match)  
**Code**: `lib/multiplayer/mp_client.js` line ~1234  
**Result**: ❌ **FAILED** - Flicker persisted  
**Log Evidence**: More corrections suppressed (good), but flicker unchanged  
**Conclusion**: Suppressing position corrections doesn't prevent visual flicker

### Attempt 4: Disable Court Redraw
**Date**: 2025-11-12  
**Theory**: Court redrawing every frame covers sprites before they cycle back on top  
**Change**: Removed `stateManager.set('courtNeedsRedraw', true)` from mp_client state sync  
**Code**: `lib/multiplayer/mp_client.js` line ~1105  
**Result**: ❌ **FAILED CATASTROPHICALLY** - Court elements disappeared, flicker remained  
**User Feedback**: "made things worse, the court actually starts to disappear"  
**Conclusion**: Court redraws ARE necessary to clear stale sprite frames

### Attempt 5: Reorder Sprite Rendering
**Date**: 2025-11-12  
**Theory**: Sprites cycled BEFORE court redraw, so court covers them  
**Change**: Moved `updateSpriteRendering()` call from before court redraw to after  
**Code**: `lib/core/game-loop-core.js` line ~404  
**Result**: ❌ **FAILED** - No effect  
**Analysis**: Code already had correct order in some paths; reordering didn't help  
**Conclusion**: Rendering order not the issue

### Attempt 6: Restore Court Redraw (Revert #4)
**Date**: 2025-11-12  
**Change**: Restored `courtNeedsRedraw=true` setting in mp_client  
**Result**: Court appearance restored, flicker still present  
**Conclusion**: Back to baseline, no progress

### Attempt 7: Double Sprite Cycle
**Date**: 2025-11-12  
**Theory**: Sprites need to cycle immediately after court AND at frame end  
**Change**: Call `updateSpriteRendering()` right after `drawCourt()` AND after trail frames  
**Code**: `lib/core/game-loop-core.js` lines ~437, ~451  
**Result**: ❓ **NOT TESTED** - User refused: "i doubt that's the fix since that last run we weren't even really calling drawCourt"  
**Status**: Code change committed but not validated

## 4. Log Analysis Findings

### Court Redraw Behavior
**Single-Player** (CPU demo mode):
- `courtNeedsRedraw = true` ONLY when basket flash clears (rare event)
- Court redraws every few seconds at most

**Multiplayer** (non-coordinator):
- `courtNeedsRedraw = true` EVERY FRAME via `mp_bf_redraw` reason
- Court redraws every ~50-100ms (every sync cycle)
- **~100 consecutive redraw logs observed in recent test**

**Discrepancy**: Multiplayer has 50-100x more court redraws than single-player, yet single-player has no flicker.

### Visual Guard Activation (Post-Fix)
```
Example logs from continuous movement (ticks 803-825):
[MP PRED EVENT] Called, tick=803 sprite=(58.99,9)
[MP RECONCILE] tick=803 delta=1.00 lastPredTick=803
[MP VISUAL GUARD] Suppressed - delta=1.00 tick=803 ticksSince=0
[MP PRED EVENT] Called, tick=809 sprite=(56.99,9)
[MP RECONCILE] tick=809 delta=2.00 lastPredTick=809
[MP VISUAL GUARD] Suppressed - delta=2.00 tick=809 ticksSince=0
```

**Pattern**: During continuous movement, visual guard suppresses ALL corrections. Zero `[MP RECONCILE APPLY]` logs during movement.

**Contradiction**: Logs show perfect visual guard operation, but user still sees flicker during movement.

### Reconciliation During Gaps
```
Example logs when player stops (ticks 758-791):
[MP RECONCILE] tick=758 delta=0.69 lastPredTick=753
[MP RECONCILE APPLY] Small correction delta=0.69
[MP RECONCILE] tick=760 delta=1.56 lastPredTick=753
[MP RECONCILE APPLY] Medium correction delta=1.56
```

**Pattern**: When player stops moving (no new predictions), corrections resume. These convergence corrections are EXPECTED and normal.

## 5. Critical Observations

### Observation 1: Flicker ≠ Position Corrections
**Evidence**: Visual guard logs show corrections suppressed during movement, but flicker still occurs.  
**Implication**: Flicker is NOT caused by position reconciliation/corrections.  
**Alternative**: Flicker is sprite VISIBILITY issue (z-order, frame clearing, frame cycling timing).

### Observation 2: Multiplayer Court Redraw Pattern
**Evidence**: Multiplayer redraws court every frame, single-player almost never.  
**Question**: WHY does constant court redraw cause flicker in multiplayer but not affect single-player?  
**Hypothesis**: Single-player doesn't exist (always CPU demo), or multiplayer state sync timing interacts badly with court redraw timing.

### Observation 3: Partial Flickering
**Evidence**: User reports sometimes only PART of sprite flickers (row or column).  
**Implication**: This is NOT position-based - it's FRAME OVERLAP.  
**Possible Causes**:
- Stale nametag frames not cleared
- Other sprite frames overlapping
- Transparency/clearing issues
- Frame invalidation not working correctly

### Observation 4: Inbound Trigger
**Evidence**: Flicker consistently starts after inbound completion.  
**What happens during inbound**:
1. Player positioned off-court (x < 0 or x > COURT_WIDTH)
2. Player pulled back onto court via authoritative catchup
3. Sprite repositioned significantly (>10px)
4. Z-order may be disrupted

**Hypothesis**: Off-court positioning or large repositioning breaks sprite frame state, creating persistent visual artifact.

### Observation 5: Single-Player Comparison Needed
**Gap**: No confirmation whether single-player human-vs-AI has flicker.  
**Critical Test**: Run single-player mode (not CPU demo, actual human player) and verify no flicker.  
**If single-player has flicker**: Problem is rendering/frame management, not multiplayer-specific.  
**If single-player no flicker**: Problem is multiplayer state sync/reconciliation interaction with rendering.

## 6. Current Architecture State

### Active Code Changes (Kept)
1. **recordPredictionEvent() in handleInput()** - Makes visual guard work correctly
2. **Extended visual guard window (ticksSince <= 3)** - Suppresses more corrections
3. **Skip myPlayer in updateOtherPlayers()** - Eliminates potential double-update path
4. **Comprehensive logging** - [MP RECONCILE], [MP VISUAL GUARD], [COURT REDRAW], etc.
5. **Double sprite cycle** - Cycle sprites after court redraw AND at frame end
6. **Reset suppression counter** - On new prediction, reset visual guard frame counter

### Rendering Pipeline (Current)
```
Game Loop (lib/core/game-loop-core.js):
1. Update game state (movement, AI, physics)
2. Update animations
3. Update rebound scramble
4. Update knockback
5. Check if 60ms elapsed since last render
6. IF YES AND courtNeedsRedraw:
   a. drawCourt() → cycles courtFrame to front
   b. stateManager.set('courtNeedsRedraw', false)
   c. updateSpriteRendering() → cycles ALL sprites on top (NEW)
7. drawScore()
8. Cycle trail frame (on top)
9. Cycle ball frame (on top)
10. updateSpriteRendering() → cycles sprites again (NEW)
```

### Multiplayer State Sync (mp_client.js)
```
Reconciliation (every ~83ms):
1. Drain state queue (get latest server state)
2. updateOtherPlayers() → update all sprites EXCEPT myPlayer
3. reconcileMyPosition() → update myPlayer with visual guard protection
4. replayInputsSince() → replay buffered inputs after server frame
5. Set courtNeedsRedraw=true (every frame via bf state sync)
```

## 7. Hypotheses NOT Yet Tested

### Hypothesis A: Frame Cycle Race Condition
**Theory**: Synchronet's `Sprite.cycle()` and `cycleFrame()` have timing bug when called rapidly in succession.  
**Test**: Add 10-50ms delay between court cycle and sprite cycle.  
**Expected**: If race condition, delay might fix flicker.  
**Risk**: Would slow rendering, visible lag.

### Hypothesis B: Sprite Frame Invalidation Failure
**Theory**: `sprite.frame.invalidate()` not working correctly in multiplayer context; stale frame data persists.  
**Test**: Force sprite frame RECREATION instead of invalidation: `sprite.frame.close(); sprite.frame = new Frame(...)`.  
**Expected**: Fresh frames might eliminate stale data.  
**Risk**: Performance impact, might break other things.

### Hypothesis C: Z-Order Corruption
**Theory**: Painter's algorithm (y-sorting) breaks down when court constantly redraws; sprites get stuck in wrong z-order.  
**Test**: Disable painter's algorithm in `updateSpriteRendering()`, use fixed z-order.  
**Expected**: Stable z-order might eliminate flicker.  
**Risk**: Sprites appear in wrong order (behind each other incorrectly).

### Hypothesis D: Court Frame Transparency
**Theory**: Court frame not properly transparent; when brought to front, covers sprites even briefly.  
**Test**: Verify `courtFrame` has proper transparency flags/attributes.  
**Expected**: If transparency missing, fixing it might solve flicker.  
**Risk**: May not be configurable in Synchronet Frame API.

### Hypothesis E: State Sync Between Court and Sprite Cycle
**Theory**: Network state sync (updateOtherPlayers, reconcileMyPosition) happens BETWEEN court redraw and sprite cycle, causing sprite position to change after court drawn but before sprites cycled.  
**Test**: Move `mpClient.tick()` call to different point in game loop, or ensure it only happens AFTER all rendering complete.  
**Expected**: If timing issue, moving sync point might fix.  
**Risk**: Could break state sync logic, cause desync.

### Hypothesis F: Synchronet Bug
**Theory**: This is a Synchronet BBS terminal framework bug related to rapid frame cycling or sprite management.  
**Test**: Reduce court redraw frequency to match single-player (only on basket flash clear).  
**Expected**: If Synchronet bug, reducing redraws might work around it.  
**Risk**: Already tried (Attempt #4), caused court disappearance.

## 8. Remaining Questions

1. **Does single-player human-vs-AI have flicker?** (Not tested)
2. **Does coordinator client have flicker?** (Not tested - if coordinator is authority, may not have flicker)
3. **What exactly happens to sprite frames during inbound?** (Off-court positioning, large movement)
4. **Can we reproduce in controlled test?** (Specific steps to trigger reliably)
5. **Is Sprite.cycle() or cycleFrame() order guaranteed by Synchronet?** (API documentation needed)

## 9. Recommended Next Steps

### Immediate (Next Developer)
1. **Test single-player mode** - Verify if flicker exists in non-multiplayer
2. **Test coordinator client** - Play as coordinator, check for flicker
3. **Controlled reproduction** - Find exact steps to trigger flicker reliably
4. **Instrument frame cycling** - Add logs inside Sprite.cycle() calls (if possible)
5. **Compare frame timing** - Log exact timestamps of court cycle vs sprite cycle

### Short-Term
6. **Test Hypothesis A** - Add small delay between court and sprite cycle
7. **Test Hypothesis C** - Disable painter's algorithm z-sorting
8. **Test Hypothesis E** - Move state sync timing in game loop

### Medium-Term
9. **Reduce court redraws** - Find way to match single-player frequency without breaking court
10. **Review Synchronet docs** - Check Frame API for known issues or best practices
11. **External review** - Share with Synchronet community or BBS dev forums

## 10. Files for Review

### Code
- `/sbbs/xtrn/nba_jam/lib/multiplayer/mp_client.js` - Reconciliation, visual guard
- `/sbbs/xtrn/nba_jam/lib/core/game-loop-core.js` - Main loop, rendering order
- `/sbbs/xtrn/nba_jam/lib/rendering/court-rendering.js` - Court/sprite rendering
- `/sbbs/xtrn/nba_jam/lib/game-logic/game-state.js` - Initial state (courtNeedsRedraw)

### Documentation
- `/sbbs/xtrn/nba_jam/docs/debugging/WAVE-24-FLICKER-FIX.md` - This document
- `/sbbs/xtrn/nba_jam/docs/debugging/MULTIPLAYER-FLICKER-ANALYSIS.md` - Codex analysis

### Logs
- `/sbbs/xtrn/nba_jam/debug.log` - Runtime logs (check recent entries)
- Look for: `[COURT REDRAW]`, `[MP RECONCILE]`, `[MP VISUAL GUARD]`, `[MP RECONCILE APPLY]`

## 11. Data Gaps

- ❌ No single-player flicker test results
- ❌ No coordinator client flicker test results  
- ❌ No frame cycle timing instrumentation
- ❌ No Synchronet Frame API documentation review
- ❌ No controlled reproduction steps
- ❌ No comparison of frame cycle order between single/multi-player

## 12. Success Criteria (Not Met)

❌ **Primary**: Eliminate visible sprite disappearance/reappearance  
❌ **Secondary**: Identify root cause mechanism  
❌ **Tertiary**: Fix without breaking single-player or other systems  

**Blocker**: Cannot identify what causes the VISIBILITY flicker (not position flicker). All position-based fixes have failed. Issue appears to be frame management/z-order/clearing, not game logic.

---

## 13. Summary for Next Developer

**What We Know**:
- Flicker is sprite DISAPPEARING/REAPPEARING, not position jumping
- Visual guard works perfectly (suppresses corrections during movement)
- Multiplayer redraws court every frame, single-player almost never
- Partial flickering suggests frame overlap/clearing issues
- Inbound completion reliably triggers persistent flicker

**What We Don't Know**:
- Why constant court redraws cause flicker in multiplayer but not single-player
- Whether this affects single-player human mode or coordinator client
- What happens to sprite frames during off-court → on-court transition
- If this is Synchronet frame management bug vs our code bug

**What Failed**:
- All position correction suppression attempts (visual guard works but doesn't fix flicker)
- Reordering rendering pipeline
- Eliminating double-updates
- Reducing court redraws (broke court appearance)

**Next Actions**:
1. Test single-player and coordinator to isolate multiplayer-specific vs general issue
2. Instrument frame cycling with detailed timing logs
3. Try small delay between court and sprite cycles (Hypothesis A)
4. Consider disabling prediction entirely as test
5. Review Synchronet Frame API documentation

---

_Handoff complete. Issue remains unsolved after 7 attempts. Good luck.

## 2. Current Symptoms (Observed)
- **Visual Flicker**: Local sprite oscillates between predicted and authoritative positions, especially immediately after inbound passes and shove resolutions.
- **Orientation Jitter**: Sprinting player occasionally snaps to an outdated bearing even when position correction is small.
- **Action Delay Perception**: On non-coordinator, attempting a dunk near the free-throw line often executes when the sprite is already at/under the rim (appears as input delay despite low actual network latency).
- **Collision Mismatch**: User can push through opponents locally; server later snaps position backward.

## 3. Telemetry / Logging Evidence
- **Drift spikes**: `debug.log` shows repeated large corrections.
  - `2025-11-12T02:00:41.755Z` — `Position drift delta=54.15 (dx=54.00, dy=4.00)`
  - Range of medium spikes (6–17 px) around shove/inbound sequences (`02:00:17.353Z`, `02:03:07.530Z`, etc.).
- **Small drift noise**: Frequent 1–3 px corrections still logged outside spike windows.
- **Visual guard logging**: No suppression lines yet in recent runs (indicates guard either not triggered or suppressed before logging; needs validation).
- **New collision guard**: As of latest code, will log `[MP CLIENT] Local prediction blocked by collision guard (...)` when activated — no entries observed yet (requires targeted repro and log capture).

## 4. Changes Attempted So Far
| Area | Change | Outcome |
| --- | --- | --- |
| Animation Sync | Implemented remote animation replay queue (shot/pass/dunk/rebound) | ✅ Eliminated missing animations for non-coordinator clients |
| Drift Instrumentation | Added `driftMonitor` with delta logging | ✅ Quantified severity (saw 15–54 px snaps) |
| Reconciliation Strength | Tuned adaptive blending thresholds, introduced magnitude-aware snap | ⚠️ Reduced micro-oscillation slightly but large spikes remain |
| Authoritative Catch-up | Added `requestAuthoritativeCatchup(frames, reason)` triggered after inbound completion (12 frames) & shove resolution (8 frames) | ⚠️ Reduced immediate post-event spikes subjectively, but logs still show >15 px corrections; no catch-up log entries observed (needs confirmation) |
| Visual Guard | Suppress tiny (<2.25 px) authority corrections when same-tick prediction already moved sprite; guard bearing updates similarly | ⚠️ Minor cosmetic improvement, but flicker persists; guard logs absent -> verify activation |
| Collision Guard (new) | Block local prediction steps that would overlap opponents’ last authoritative positions (dx/dy < 2) | 🆕 Pending validation; expected to prevent "phasing" through opponents, reducing large snapbacks |
| Logging Hygiene | Added todo list & log reviews | ✅ Tracking work items |

## 5. What Improved vs Unchanged
- **Improved**: Animation parity, non-coordinator crash resolved, handshake logs available, micro jitter slightly less aggressive, inbound/shove states now request catch-up windows, remote on-fire visuals render.
- **Unchanged/Persistent**: Large snapbacks still occur, flicker still visually obvious, authority bearing overrides sometimes applied late, dunk input feels delayed, clients can still desync before guard prevents move (guard unverified).

## 6. Failed / Inconclusive Hypotheses
- **Root cause = reconciliation strength too low**: Increasing strength alone did not solve flicker; large spikes persisted and produced more snapping.
- **Visual guard alone can mask flicker**: Guard reduces tiny oscillations, but large corrections still visible; issue not purely cosmetic.
- **Inbound/shove catch-up eliminates spikes**: No clear reduction in >15 px spikes in logs after change; suggests other triggers (e.g., collision mismatch) dominate.

## 7. Architecture Issues Spotted
- **Collision Asymmetry**: `checkSpriteCollision()` lives in `lib/game-logic/movement-physics.js` and only executes on authority (`config.isAuthority`). Clients predict movements without any overlap check, relying on later server correction. This is a core desync source.
- **Event Ordering**: Input replay and authority updates happen in same frame without deterministic ordering guard; visual guard only suppresses tiny deltas, not large ones.
- **State Staleness**: Client guard uses `stateManager.get('players')` snapshots; need to confirm these values update every authoritative frame to avoid stale data blocking movement incorrectly.
- **Action Execution**: Action button handling (dunk/shot) still executed locally but authoritative resolution uses server position -> indicates mismatch in when server confirms action vs client expectation.

## 8. Refactoring / Structural Opportunities
- Extract shared collision utility so both authority and client reuse identical logic (pure function `wouldSpritesOverlap(a,b)` with dependency injection for player list).
- Introduce reconciliation pipeline step order: `applyAuthority → updateState → runPrediction` with guard to prevent same-tick double application (currently rely on visual guard instead of structural ordering).
- Encapsulate inbound/shove catch-up as part of state manager update (e.g., event bus `stateManager` event triggers) to avoid scattering logic.
- Revisit action button flow: create deterministic "action intent" messages so server uses the position captured at input time rather than arrival time.

## 9. Not Yet Tried / New Hypotheses
- **Recency-based collision guard**: Only block predictions if authoritative data is <= N frames old, preventing stale data from freezing movement.
- **Soft Push vs Hard Block**: Instead of cancelling movement, slide predicted position to just outside collision threshold to maintain momentum without phasing.
- **Renderer Instrumentation**: Log when client draws predicted vs authoritative positions (likely in `lib/rendering/court-rendering.js` `updateSpriteRendering()`), to correlate flicker with draw order.
- **Authority Snap Source**: Investigate server’s inbound/shove resolution path to ensure server never teleports sprites >20 px except on actual animations.
- **Input Intent Timestamping**: Capture local action (e.g., dunk) with predicted position and send to server; compare when authoritative event fires to measure systemic delay.

## 10. Planned Next Steps
1. **Validate Collision Guard in Practice**
   - Re-run multiplayer session, confirm guard logs appear, and observe whether large (>15 px) drift entries reduce in frequency/magnitude.
2. **Instrument Renderer and Collision**
   - Add targeted logging around sprite rendering and authority updates to see when flicker occurs relative to draw cycle.
3. **Add Recency Check to Guard**
   - Ensure we only block with fresh authoritative coordinates (e.g., store `lastAuthoritativeTick` per player and compare against `tickCounter`).
4. **Analyze Action Delay**
   - Trace dunk/action pipeline for non-coordinator: log input timestamp, local position, server acknowledgement, and animation start.
5. **Review Authority Shove/Inbounds**
   - Verify server isn’t sending out-of-date positions or double-applying predicted offsets when resolving events.
6. **Document & Plan Refactor**
   - Outline shared collision module design; evaluate moving client prediction into state machine that respects authority constraints each frame.

## 11. Outstanding Data Gaps
- No recent log entries confirming visual guard suppression or collision guard activation post-implementation.
- Lack of comparative metrics (before/after) for frequency of >10 px corrections.
- No instrumentation around action button pipeline to explain dunk delay perception.

## 12. Recommended Test Script (Pending)
- **Scenario**: Multiplayer inbound to non-coordinator, force shove, attempt to walk through opponent, trigger dunk near free-throw line.
- **Capture**: `debug.log` tail, new guard logs, any renderer instrumentation, timestamps for action sequence.

## 13. Coordination Notes
- User expects proactive ownership; next update should include fresh logs and clear impact metrics.
- Consider preparing summary for external review (e.g., Claude Sonnet) once guard validation and instrumentation data are available.

---

_This document will be updated after each investigative pass with new evidence and outcomes._
