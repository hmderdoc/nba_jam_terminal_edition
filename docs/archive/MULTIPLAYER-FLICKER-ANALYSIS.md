# Multiplayer Non-Coordinator Flicker Analysis (Wave 24 Update)

## Problem Statement

**Symptom**: Non-coordinator sees their own sprite flicker/judder, especially after a game state reset (inbound, violation).
**Observation**: The flicker is not present at the start of the game but begins after the first major state reset.
**User Insight**: "When we are in a startup state it doesn't happen, if we can get from our broken state back to that one, the flicker would be gone."
**Impact**: Makes game uncomfortable to play as non-coordinator client.

---

## Root Cause Analysis (Post-Wave 24 Debugging)

The initial analysis (below) focused on reconciliation frequency and smoothing, but extensive debugging has revealed the root cause is more nuanced and relates to **incomplete client state resets**.

### The Core Problem: Corrupted Prediction State

The client-side prediction system (`PlayerClient` in `mp_client.js`) maintains a complex internal state:
- `pendingInputs`: A buffer of inputs applied locally but not yet confirmed by the server.
- `visualGuard`: Logic to prevent small, immediate server corrections from overwriting recent predictions.
- `lastServerFrame`: The last server frame processed.
- And more...

**The Bug**: When the server forces a major game state change (like setting up for an inbound pass), the client's prediction state is not being **fully and perfectly reset**.

**How it happens:**
1.  **Game Start**: The `PlayerClient` is in a clean, "startup state". Prediction and reconciliation work correctly.
2.  **Gameplay**: The player moves, `pendingInputs` accumulates, and `visualGuard` state is actively managed.
3.  **Inbound Play**: The server makes a basket. It authoritatively moves the player sprite to the baseline. It sends a state packet with `inbounding: true` and the player's new `x, y` coordinates.
4.  **Client Receives State**: The client snaps the player sprite to the new position.
5.  **INCOMPLETE RESET**: The `resetPredictionState` function is called, but it fails to clear *all* the latent state from before the inbound. For example, it might not clear `pendingInputs` or fully reset the `visualGuard` object.
6.  **Post-Reset Flicker**: The player tries to move. The client applies a new prediction. However, the reconciliation logic is now operating with corrupted state. It might try to re-apply an old input from *before* the inbound, or the `visualGuard` might incorrectly suppress a valid server correction.
7.  **Result**: The client is now in a permanent desync loop. It predicts a move, the server corrects it, but the correction is either wrong or is fighting with stale prediction data. This causes the sprite to flicker between its predicted position and the server's authoritative position.

**Architectural Analogy**: It's like trying to fix a running engine by just resetting the spark plugs. If the pistons are in the wrong position, the engine will immediately seize again. We need to stop the engine, reset everything to top-dead-center, and then restart. `resetPredictionState` is our attempt to get to top-dead-center, and it's failing.

---

## Previous Analysis (Still Relevant but Not the Root Cause)

The following points describe symptoms of the problem, not the cause. The jitter and smoothing issues are exacerbated by the underlying state corruption.

### Timing Mismatch: Game Loop vs State Updates

**Game Loop (Non-Coordinator)**:
- Frame Rate: 20 FPS (50ms per frame)
- Every frame: `runGameFrame()` → `playerClient.update()` → reconciliation

**State Broadcast (Coordinator)**:
- Broadcast Rate: 20 Hz (50ms interval)
- Every 50ms: `coordinator.update()` → `broadcastState()` via Queue

**State Consumption (Non-Coordinator)**:
- Check Interval: ~12 Hz (83ms)
- Throttled reconciliation: `if (now - this.lastStateCheck >= 83ms)`

### The Problem: Perfect Alignment = Guaranteed Jitter

```
Frame Timeline (Non-Coordinator):
T=0ms    : Frame 1 starts, reads state (0ms old)
T=50ms   : Frame 2 starts, reads state (might be 0ms or 50ms old)
T=100ms  : Frame 3 starts, reads state (might be 0ms or 50ms old)

State Broadcast Timeline (Coordinator):
T=0ms    : State broadcast 1
T=50ms   : State broadcast 2
T=100ms  : State broadcast 3

The Problem:
- If frame reads state at T=49ms, it gets 49ms-old data (smooth)
- If frame reads state at T=51ms, it gets 1ms-old data (snap/jump)
- Next frame at T=101ms gets 1ms-old data again (smooth)
- Then T=149ms gets 49ms-old data (snap/jump back)

Result: Constant back-and-forth between "smooth interpolation" and "snap to latest"
```

---

## Recommended Solution (Based on New Understanding)

The priority is no longer about tuning frequencies, but about ensuring a **perfect, complete, "hard" reset** of the client's prediction state.

### Action Plan: Comprehensive `resetPredictionState` Audit

**Goal**: Make `resetPredictionState` functionally equivalent to creating a `new PlayerClient()`.

**Implementation Steps**:
1.  **Audit `PlayerClient` Constructor**: Go through `mp_client.js` and list every single property initialized in the `PlayerClient` object.
    - `this.pendingInputs = []`
    - `this.lastServerFrame = 0`
    - `this.visualGuard = { ... }` (and all its sub-properties)
    - `this.authoritativeCatchupFrames = 0`
    - `this.lastInbounding = false`
    - etc.
2.  **Audit `resetPredictionState`**: Compare the list from step 1 to the properties currently being reset in `resetPredictionState`.
3.  **Implement Missing Resets**: Add assignments to `resetPredictionState` for every single property that is initialized in the constructor but is not currently being reset. The goal is to make the two identical.
4.  **Test**: Trigger an inbound play in multiplayer and confirm that the flicker is gone *and stays gone* for the rest of the game.

**Why this will work**:
- It directly addresses the user's core insight: "get from our broken state back to [the startup] one".
- It purges any and all latent state that could be corrupting the prediction/reconciliation cycle.
- It creates a reliable mechanism to recover from any potential future desync, not just the current one.

---

## Testing Plan

### Test Case 1: Inbound After Made Basket
1. Start multiplayer game as non-coordinator.
2. Confirm there is no flicker during initial gameplay.
3. Score a basket.
4. After the inbound play starts, move the character.
5. **Expected Result**: The character moves smoothly with no flicker.

### Test Case 2: Inbound After Violation
1. Start multiplayer game as non-coordinator.
2. Commit a backcourt violation.
3. After the inbound play starts, move the character.
4. **Expected Result**: The character moves smoothly with no flicker.

### Success Criteria
- Flicker does not appear after the first, second, or any subsequent game state reset.
- The game feels as smooth in the second half as it does at the start of the first half.
- The `debug.log` shows `[MP CLIENT] Resetting prediction state` at the start of each inbound, and no subsequent reconciliation snap messages for the player's own sprite.
