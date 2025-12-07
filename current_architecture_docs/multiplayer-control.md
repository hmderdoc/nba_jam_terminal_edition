## Lobby & Session Management

- `lib/multiplayer/mp_lobby.js` (loaded via the module loader) handles player matchmaking, collects selected teams, and writes session metadata to Synchronet JSON records (`nba_jam.game.<sessionId>.meta`).
- `mp_identity.js` builds stable `playerId`/`globalId` strings used across queues and state maps.
- `mp_config.js` manages server selection (local/inter-BBS/custom) and latency measurement. Its tuning presets feed both the coordinator and clients, ensuring they agree on frame/update cadence.

## Coordinator Selection

- `mp_coordinator.js` reads `game.<sessionId>.meta`. If no coordinator is recorded, it locks the record and writes its own `globalId` as the coordinator (`attemptClaimCoordinator`).
- Once coordinator status is confirmed, it creates input queues (`nba_jam.game.<session>.inputs.<playerId>`) and state queues (`nba_jam.game.<session>.state.<playerId>`) for every participant and subscribes to their input topics.
- The coordinator runs the same `gameLoop`/`runGameFrame` as single-player but swaps the `handleInput` callback with one that drains player input queues, injects them into the possession system, and records last processed sequence numbers per player.

## Client Responsibilities

- Each client (`mp_client.js`) owns a `PlayerClient` that:
  - Buffers local input and flushes it to its input queue.
  - Listens for state updates from the coordinator and reconciles its copy of the sprites/game state.
  - Predicts local movement in between authoritative updates for responsiveness.
- Clients never mark themselves authoritative. All gameplay decisions (violations, shot outcomes, rebounds) originate from the coordinator’s `runGameFrame`.

## Control Flow Summary

1. **Lobby** builds the session and writes player list + coordinator slot.
2. **Coordinator** claims the slot, spawns queues, and starts the authoritative `gameLoop`.
3. **Clients** connect to the same queues, flushing inputs and consuming state updates.
4. **Network tuning** (from `MP_CONSTANTS`) keeps `stateUpdateInterval`, `inputCollectionInterval`, and client `flushInterval` in sync. Presets also cover guard rails such as max input batch size and prediction horizon.

## Error Handling

- Coordinator logs go to `data/debug.log` via `mpDebugLog`. Clients log through `debugLog` / Synchronet’s `log()` functions.
- If a player disconnects, their queues remain but stop receiving packets. The coordinator detects stale `playerInputQueues` and can either AI-control the slot or end the session (logic not covered here).
- Failover logic (loaded via `mp_failover.js`) can promote another client to coordinator by re-running the claim procedure if the original coordinator disappears.
