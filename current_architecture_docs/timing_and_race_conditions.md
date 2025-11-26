## Timing & Race-Condition Hotspots (Wave 24)

Although the game loop runs single-threaded, several subsystems rely on precise timing windows, cooperatively updated state, or delayed effects. When these pieces drift out of sync they present as “race conditions”: desynced animations, frozen inbounds, duplicate whistles, etc. This document captures the sensitive areas so we can preserve the invariants while refactoring.

---

### Game Loop Cadence

**State Fields:** `lastUpdateTime`, `lastSecondTime`, `lastAIUpdateTime`, `lastHudUpdateTime`, `frameDelay`, `aiInterval`, `HUD_RENDER_INTERVAL_MS`, `COURT_RENDER_THROTTLE_MS`.

- `runGameFrame()` uses `Date.now()` deltas to decide whether to advance timers, AI, and HUD redraws. If these timestamps are reset or skipped (e.g., during halftime or violation pauses) the scheduler can stall, causing turbo meters or shot clocks to freeze.
- Multiplayer coordinators share the same cadence; clients derive prediction pacing from `frameDelay`. Divergence here causes rubber-banding or flicker.
- **Watch-outs:** Any patch touching `frameScheduler`, `tempo`, or state resets must update all four timestamps; otherwise the next `runGameFrame` iteration will think time stood still and skip work.
- **Overtime nuance:** `maybeStartOvertime` rewrites `timeRemaining`, bumps `totalGameTime`, and resets the shot clock without blocking the loop. Ensure the function clears/re-initializes `lastSecondTime` along with the clock to avoid an immediate extra tick that would drop the overtime clock to `periodSeconds - 1` on the first frame.
- **Overtime intro banner:** While `overtimeIntroActive` is true the loop pauses timer decrements, AI ticks, collision checks, and court redraws. New code must respect this guard; otherwise the intro overlay will overlap inbound animations or desync multiplayer clocks.

---

### Violation & Phase Pauses

**State Fields:** `violationPauseUntil`, `phase.current`, `phase.frameCounter`, `shotInProgress`, `courtNeedsRedraw`.

- Shot-clock/backcourt pauses no longer block via `mswait`; instead `violationPauseUntil` tells the loop to early-return until a target timestamp is reached. Forgetting to clear or advance that flag leaves the game stuck in a “paused” state.
- Phase transitions (`PHASE_NORMAL`, `PHASE_INBOUND_SETUP`, etc.) depend on `phase.frameCounter` matching `phase.targetFrames`. If an inbound animation fails to increment the frame counter, the system never exits setup, leaving players off-court and the shot clock idle.
- **Surfacing bugs:** Running CPU-only demo or multiplayer coordinator (where no human input wakes the loop) tends to expose pauses that never clear.

---

### Inbound Scripts & Off-Court Sprites

**State Fields:** `inboundPositioning`, `inboundPassData`, `inbounding`, `pendingSecondHalfInbound`.

- Inbound setup stages multiple sprites (off-court inbounder, receiver, defenders) and expects animation callbacks to clear both `inboundPositioning` and `inboundPassData`. If either stays populated, multiplayer serialization will keep allowing “offcourt” positions and clients will accept NaN coordinates.
- The inbounder animation queues a simulated pass once positioning finishes; if `inbounding` flips false before `inboundPassData` is consumed, the pass never fires, leaving the ball in limbo.
- **Surfacing bugs:** Replays of quick-score scenarios (alley-oops, turbo dunks) can double-trigger `setupInbound`, overwriting the pass data before the old one executes.

---

### Rebound Scramble & Ball Ownership

**State Fields:** `reboundScramble`, `reboundActive`, `ballCarrier`, `ballX/Y`, `ballFrame`.

- The rebound system transitions from `shotInProgress -> reboundActive -> possession change`. Timing mistakes (e.g., clearing `shotInProgress` too late) allow both the rebound scramble and possession logic to run, resulting in duplicate whistles or the ball teleporting.
- Multiplayer serialization needs to know who owns the ball on every frame. If `ballCarrier` momentarily goes null while `ballFrame` continues moving, clients render a loose ball while the coordinator still believes someone is dribbling.
- **Surfacing bugs:** Rapid offensive goaltending or multiple defenders cued for rebounds create overlapping animations that stress this state machine.

---

### Multiplayer Prediction vs. Authority

**State Fields / Helpers:** `previewMovementCommand`, `PLAYER_CLIENT_COLLISION_THRESHOLD`, `mp_client.reconcileMyPosition`, `mp_coordinator.captureState`.

- Clients predict by replaying inputs locally until authoritative state arrives. If `previewMovementCommand` or the collision thresholds diverge between client and coordinator, sprites briefly desync (“flicker”) before reconciliation snaps them back.
- Input packets carry frame numbers; if coordinator or client clocks drift (due to inconsistent `frameDelay` handling) reconciliation may replay too many or too few inputs, leading to uncontrolled sprites or frozen players.
- **Surfacing bugs:** High latency or forcing turbo during inbound cutscenes magnifies prediction drift; logs will show alternating “[PREDICTION BLOCKED]” and snap events.

---

### Animation System & Ball Frame

**State Fields:** `animationSystem.animations`, `shotInProgress`, `ballFrame`, `courtNeedsRedraw`.

- Non-blocking animations rely on per-step timers (`startedAt`, `msPerStep`). If the main loop slows down (e.g., due to logging), the animation queue can accumulate stale entries that continue to move the ball after the play ended.
- The ball is rendered in its own `ballFrame`. When `animationSystem.clearBallAnimations()` runs, it must also stop moving `ballFrame`, otherwise the visual ball lags behind the authoritative `ballX/Y`.
- **Surfacing bugs:** Long dunks or blocked shots—where the ball switches between animation-driven and physics-driven movement—highlight inconsistencies between the queue and real state.

---

### State Manager & Reason Strings

**State Fields:** `stateManager.changeLog`, `set(path, value, reason)`.

- Timing-sensitive fixes often rely on `stateManager` change logs to diagnose order-of-operations issues. Forgetting to pass meaningful `reason` strings when mutating timing-related keys makes it difficult to trace race conditions after the fact.
- Subscribers (`stateManager.subscribe`) may run synchronously; if a subscriber sets state that re-enters the same code path, you can get cascading updates in a single frame. Guard subscriptions appropriately.

---

## Recommended Mitigations

1. **Consolidate timing resets.** Whenever the loop is paused/resumed (halftime, violations, inbound scripts), reset all timer fields together.
2. **Guard inbound data.** Validate `inboundPassData` (no NaNs, sprites still alive) before queuing animations; clear it explicitly after use.
3. **Mirror constants.** Keep prediction helpers and authoritative physics on the same constants (`player-constants.js`) to avoid drift.
4. **Instrument transitions.** Add structured logs around `phase` and `violationPauseUntil` changes when debugging; include timestamps and reasons.
5. **Test under stress.** Use the coordinator/client harness or automated inbound/rebound scripts to reproduce racey scenarios instead of relying on manual play.
