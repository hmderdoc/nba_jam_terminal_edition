## Purpose

`lib/multiplayer/mp_client.js` implements everything that runs on a non-authoritative player:

- Reads session metadata (from `mp_identity.js` / lobby).
- Buffers local inputs and flushes them to the coordinator over Synchronet Queues.
- Predicts movement locally so the player receives instant feedback.
- Reconciles against authoritative state snapshots received from the coordinator.

Clients never run the gameplay loop (`runGameFrame`); they simply mirror the coordinator’s authoritative state while keeping the presentation smooth.

## Input Pipeline

1. **InputBuffer.** Each client owns an `InputBuffer(playerId)`:
   - `addInput(key, frameNumber, meta)` appends timestamped inputs.
   - `setFlushInterval(interval)` adjusts how frequently packets are sent (default 50 ms, clamped 10–200 ms).
   - `flush()` writes a packet `{ s: sequence, t: timestamp, i: [inputs...] }` to the player’s Queue.
2. **Adaptive flush.** `shouldFlush()` ensures we don’t send empty packets; `forceFlush()` bypasses the interval (used when joining mid-frame or during disconnect recovery).
3. **Turbo metadata.** Movement packets can include `t` (turbo button) so the coordinator knows when to drain the meter even if the authoritative frame hasn’t caught up yet.

## Prediction & Collision Guard

- **previewMovementCommand(sprite, key)** (from `lib/game-logic/movement-physics.js`) exposes the exact movement math used by the authority. The client calls it to get the attempted coordinate before touching any local sprite state.
- **wouldCollideWithAuthoritativeOthers** compares the predicted location against every other sprite’s latest position. It skips teammates and only blocks a move when `dx < 1.5 && dy < 1.5`, which is slightly stricter than the authoritative 2×2 hitbox so the client doesn’t wander into overlaps the authority would reject.
- The client executes the movement locally unless the guard says it would collide. Later, when the authoritative state arrives, the client reconciles (snap or smooth) to the official coordinates.

## State Sync

- Each player subscribes to `Queue("nba_jam.game.<sessionId>.state.<playerId>")`. Packets typically contain:
  - Player positions/velocities.
  - Turbo, shove cooldowns, and current animations.
  - Game clock snapshots (so the client HUD can stay in sync).
- When the coordinator includes the `ah` array, the client resolves each hint to a local sprite via `findSpriteByGlobalId` and immediately invokes the matching animation helper (e.g., `knockBack` for shove impacts). The hints are transient; nothing is persisted in `stateManager`.
- The client keeps `lastProcessedInputs[playerId]` so it can discard duplicate state updates or detect missed packets.

## Visual Guards

`VISUAL_GUARD_*` constants tune cosmetic helpers:

- `VISUAL_GUARD_SMALL_DELTA`, `VISUAL_GUARD_SUPPRESSION_FRAMES`, `VISUAL_GUARD_BEARING_THRESHOLD` mitigate desync jitter by temporarily hiding predicted animation frames if they deviate significantly from the authoritative bearing.

## Interaction with Systems

- The client still receives the shared `systems` object (state manager, animation system, etc.) so it can call existing rendering helpers. However, it never mutates `stateManager` except when instructed by the coordinator (e.g., applying authoritative snapshots).
- When reconciliation detects a mismatch, the client schedules animation adjustments (e.g., rerunning pass or rebound animations) using the same `animationSystem` API the coordinator uses, ensuring visual parity.

## Failure Modes & Recovery

- If `InputBuffer.flush()` throws (network hiccup), the client logs a warning and keeps the buffer intact so it can resend later.
- `measureLatency` in `mp_config.js` tunes flush intervals. Clients can shrink `flushInterval` on low latency servers and expand it on noisy links.
- Disconnects are handled via lobby/session code, but `mp_client.js` keeps the last known authoritative state so rendering can gracefully freeze rather than crash.
