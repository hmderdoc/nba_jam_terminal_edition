## Coordinator Responsibilities (`lib/multiplayer/mp_coordinator.js`)

1. **Session ownership.** `GameCoordinator` checks `game.<session>.meta` for an existing `coordinator` field. If empty, it acquires a write lock and stores its own `globalId`. This prevents split-brain scenarios.
2. **Queue creation.** Once authoritative, it creates:
   - `playerInputQueues[playerId] = new Queue("nba_jam.game.<session>.inputs.<playerId>")`
   - `stateQueues[playerId] = new Queue("nba_jam.game.<session>.state.<playerId>")`
   Every player’s client subscribes to the matching topics.
3. **Input subscription.** The coordinator subscribes to all player input queues and tracks `lastProcessedInputs[playerId]` so late/out-of-order packets can be ignored.
4. **Sprite mapping.** `setPlayerSpriteMap(map)` associates global IDs with actual sprite objects and builds an index map that matches the array order used when serializing positions. That makes state packets compact and deterministic.

## Coordinator Game Loop

- Runs `gameLoop(systems)` from `nba_jam.js`, but the `handleInput` callback is replaced with a function that:
  1. Polls each player’s input queue.
  2. Sorts packets by sequence number.
  3. Injects the inputs into the existing input handler (`handleInput`) on the authoritative sprites.
- Because `isAuthority = true`, the coordinator is the sole source of truth for `runGameFrame`: AI, physics, violations, and rendering decisions all happen exactly once per frame.

## State Broadcasts

- At the end of each frame (or at `stateUpdateInterval`, typically 50 ms), the coordinator serializes authoritative data:
  - Player positions, bearings, and animation states.
  - Turbo meters, shove cooldowns, and relevant timers.
  - Global state snapshots (clock, score, possession flags).
  - Animation hints (`ah` array) carrying animation triggers (e.g., shove knockback payloads). The tracker (`mp_animation_hints.js`) derives them each frame so gameplay never waits on presentation.
- The serialized payload is written to every `stateQueues[playerId]`, so clients can update their local rendering and reconcile predicted positions.

## Local Input Injection

- For the coordinator’s own player, inputs never go through the queue—they are appended to `localInputPackets` and processed immediately. This keeps the host player as responsive as standalone single-player.

## Timing

- `stateUpdateInterval` and `inputCollectionInterval` default to the server preset’s values (`serverConfig.tuning.stateUpdateInterval`). The coordinator updates `lastInputCollection` and `lastStateUpdate` to throttle how often it drains queues or broadcasts state.
- Even if no state update is due, the coordinator still runs `runGameFrame` at the normal `frameDelay`. This decouples rendering/physics cadence from network update cadence.

## Failure & Recovery

- If the coordinator crashes or disconnects, `mp_failover.js` logic (loaded during startup) can promote another client by re-running `attemptClaimCoordinator`. The new coordinator recreates queues and resumes broadcasting state, reusing the shared `gameState`.
- Because every `stateManager.set` includes a reason string, future coordinators (or debug tooling) can rebuild the sequence of events leading up to a failure.
