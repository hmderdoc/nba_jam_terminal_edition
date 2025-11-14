# Codex Flicker Theories (Wave 24)

This note consolidates everything learned from the existing flicker docs (`FLICKER-FIX-DIAGNOSIS.md`, `GEMINI-FAILURES.md`, `MULTIPLAYER-FLICKER-ANALYSIS.md`, `MULTIPLAYER_ARCHITECTURE_AUDIT.md`) and adds concrete, testable theories that may explain the lingering non‑coordinator flicker. Each theory is tied to observable evidence and includes a proposed validation plan.

---

## 1. Recap of Ground Truth

1. **Flicker Timeline** – Non‑coordinator looks smooth during the initial tipoff, then starts flickering after the first hard reset (basket, violation, halftime). (See `MULTIPLAYER-FLICKER-ANALYSIS.md` and user anecdotes.)
2. **Client Prediction Stack** – `PlayerClient` tracks `pendingInputs`, `visualGuard`, `authoritativeCatchupFrames`, replay buffers, etc. Resetting to the startup state is currently unreliable, leading to corrupted state after an inbound (`MULTIPLAYER-FLICKER-ANALYSIS.md`, §“Core Problem”).
3. **Docs reference `resetPredictionState()`** – Multiple modules call `playerClient.resetPredictionState()` (`phase-handler.js`, `halftime.js`), but **there is no implementation inside `mp_client.js`**. This is not just incomplete; it means every inbound/halftime reset is currently a no‑op.
4. **Renderer layering** – Court/hoop flicker from Wave 23 is already addressed (`FLICKER-FIX-DIAGNOSIS.md`). Current issue is purely multiplayer desync, not frame order.

---

## 2. New Theories & Experiments

### Theory A – “Missing Reset Function = Permanent State Corruption”

**Observation**
- `phase-handler.js:768` and `lib/ui/halftime.js:129` call `systems.playerClient.resetPredictionState()`.
- `grep -R "resetPredictionState" lib/multiplayer/mp_client.js` returns nothing: the function does not exist.
- Therefore every inbound/halftime “reset” silently does nothing. `pendingInputs`, `visualGuard`, `authoritativeCatchupFrames`, etc. accumulate forever, matching the user’s “works at startup, breaks after first inbound” timeline.

**Hypothesis**
- Because the reset hook is undefined, stale prediction buffers survive every authoritative teleport, so the next reconciliation instantly replays pre‑inbound inputs and fights the server snapshot → flicker loop.

**Plan**
1. ✅ Implemented (`lib/multiplayer/mp_client.js:11-311`). The reset now rebuilds drift/guard state, flushes pending inputs, and clears replay history.
2. ✅ Logging is in place when the reset fires.
3. Next: force inbounds/halftime and verify the log shows non‑zero entries being cleared.
4. Re-run multiplayer to see whether flicker still emerges.

**Expected Outcome**
- If flicker disappears (or at least resets cleanly) after a basket, the missing reset was the root cause. Even if not, having a proper reset function is a prerequisite for any deeper fix.

---

### Theory B – “Multi-Writer Sprite Race”

**Observation**
- `mp_client.js` mutates `mySprite.x/y` in at least three places: `handleInput` (prediction), `updateOtherPlayers` (authority snapshot for other players), and the reconciliation block that replays missed inputs.
- These writes can happen within one render slice (prediction moves the sprite, then reconciliation snaps it back, then replay nudges again). `MULTIPLAYER_ARCHITECTURE_AUDIT.md` §4 Hypothesis B describes this race at a high level, but we never instrumented it.

**Hypothesis**
- After an inbound, the server teleports the sprite. The client prediction immediately runs (old pending input), moving the sprite before reconciliation processed the teleport. Reconciliation then snaps back, causing visible flicker. Because this race is ongoing, users perceive continuous jitter.

**Plan**
1. ✅ Authority-side staging implemented in `mp_client.js`. Reconciliation and prediction/replay paths now stage via `_stageSpriteCommit(...)` and commit once per frame (`handleInput`, replay loop, and reconcile all feed the same pipeline).
2. ✅ Added `[MP COMMIT]` logs so we can trace which subsystem produced the final position (`prediction`, `prediction_replay`, `authority_blend`, `drift_snap`, etc.).

**Expected Outcome**
- If committing through a single code path eliminates flicker, the root cause was the write race. Even if flicker persists, the logs will reveal when and why the sprite is toggling between positions.

---

### Theory C – “Visual Guard Never Truly Resets”

**Observation**
- Visual guard fields (`lastPredictionTick`, `suppressedAuthorityFrames`, `pendingAuthority`) live inside `this.visualGuard`. Without `resetPredictionState`, these fields can retain stale tick values (e.g., `lastPredictionTick` from before inbound).
- When `recordPredictionEvent()` runs, it suppresses authority corrections for a fixed number of frames (`suppressedAuthorityFrames++`). If this counter never reinitializes, the guard can end up perpetually suppressing legitimate corrections or vice versa.

**Hypothesis**
- After an inbound, the guard still thinks there’s an outstanding prediction at the old baseline. When the server teleport arrives, the guard either suppresses it (so the sprite stays at the wrong position) or gets overwhelmed and spams corrections every frame, causing flicker.

**Plan**
1. As part of Theory A’s reset implementation, explicitly reset `visualGuard` to the constructor defaults.
2. Add guarded logging whenever `visualGuard` suppresses or applies a correction:
   ```
   debugLog("[MP VIS GUARD] action=%s tick=%d pendingAuthority=%o suppressed=%d")
   ```
3. Trigger baskets/violations and inspect whether suppression counters remain near zero after resets.

**Expected Outcome**
- If suppression counters remain low and corrections no longer thrash the sprite, the guard was the hidden culprit. If counters climb again, instrument the exact scenarios to see whether the guard logic itself needs redesign.

---

### Theory D – “Pending Inputs Survive Halftime/Inbounds”

**Observation**
- `pendingInputs` buffer drives client-side reconciliation and is drained only when acknowledgements arrive. If an inbound teleports the player and pending inputs still reference pre-inbound coordinates, replaying them causes the sprite to race backwards (matching the user’s “snap back” description).
- No code currently clears `pendingInputs` when a massive authoritative jump occurs.

**Hypothesis**
- After every inbound, the client replays stale inputs as soon as the catchup loop runs, undoing the teleport and forcing the server to correct again. This battlefield between “old input replay” and “authority snap” manifests as flicker.

**Plan**
1. ✅ For inbounds and forced snaps we already call `resetPredictionState("inbound_start"|"forced_position")`.
2. ✅ Added drift-based snap (`DRIFT_SNAP_THRESHOLD = 3`) that resets prediction state, flushes pending inputs, and requests catch-up whenever the client diverges too far from authority.
3. Next: validate by scoring back-to-back baskets and watching `[MP DRIFT SNAP]` / `[MP COMMIT source=drift_snap]` entries to ensure the flush occurs only when needed.

**Expected Outcome**
- Stale inputs no longer replay, so post-inbound reconciliation is clean. If flicker still occurs, the problem lies deeper (e.g., stale animation frames), but the buffer flush is still necessary to guarantee determinism.

---

### Theory E – “Authoritative Catchup Stuck in Permanent High-Gain Mode”

**Observation**
- `authoritativeCatchupFrames` is increased whenever the client detects large drift. We never reset it during inbounds; the coordinator teleport counts as a giant drift, so the client may stay in “high gain” smoothing mode indefinitely.
- High gain leads to strong interpolation factors (`maxStrength = 0.35` in `mp_client.js:1388`) which can overshoot and cause oscillation, especially if the sprite is being forcibly teleported.

**Hypothesis**
- After an inbound, catchup mode remains active, so each new prediction is multiplied by an aggressive gain. That, combined with authority snaps, produces the visible “judder” even when pending inputs are empty.

**Plan**
1. Reset `authoritativeCatchupFrames` to `0` inside the new `resetPredictionState()`.
2. Instrument catchup: log when frames enter/exit catchup mode and what the blend factor is.
3. Test whether flicker persists when catchup is disabled for 2–3 frames after inbounds.

**Expected Outcome**
- If disabling catchup around teleports stabilizes the sprite, tune the catchup scheduler to be teleport-aware (e.g., treat `inbounding` as “do not smooth, snap immediately”).

---

## 3. Suggested Debugging Workflow

1. **Implement the missing reset** (Theory A). Without it, the remaining theories are impossible to validate.
2. **Add instrumentation** for visual guard, pending inputs, catchup frames, and sprite commit paths. Use structured logs written once per frame, not spammy `tail` output.
3. **Create a deterministic replay**: record a multiplayer session that triggers a basket every 5 seconds. Feed it through the new instrumentation to confirm whether resets occur and whether buffers stay empty.
4. **If flicker persists**, proceed with Theory B (single writer) and Theory E (catchup tuning) in that order; both can now be reasoned about with the new logs.

---

## 4. Expected Benefits

Implementing these theories (especially A + D) gives us:
- A reliable “back to startup” switch, matching the user’s intuition about the bug.
- Deterministic, loggable behavior when the client experiences major authoritative changes.
- A foundation for further refinements (e.g., smoothing redesign) without guessing.

Once the reset + instrumentation framework is in place, we can analyze any remaining flicker with proof instead of speculation. Until then, every attempt is fighting stale state we know we aren’t clearing.
