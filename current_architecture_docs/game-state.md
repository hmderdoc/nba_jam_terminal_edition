## State Manager Fundamentals

- `initializeSystems` (lib/core/system-init.js) creates a `stateManager` wrapper around the mutable `gameState` object. Every mutating call uses `stateManager.set(key, value, reason)` so multiplayer sync and debugging can trace when/why a field changed.
- `game-state.js` seeds the default dictionary. Important root keys include scores, period info, turbo meters, possession flags, inbound alternates, and scoreboard overlays.
- `stateManager.get(key)` always returns the latest value; complex objects (e.g., `frontcourtEstablishedByTeam`, `inboundPositioning`) are stored as plain JS objects.

## High-Value Keys (read/write hot spots)

| Key | Producer(s) | Consumer(s) | Purpose |
| --- | --- | --- | --- |
| `gameRunning` | `gameLoop`, multiplayer coordinator | `runGameFrame`, UI flows | Master flag used to stop the loop gracefully. |
| `timeRemaining` / `totalGameTime` | `resetGameState`, `runGameFrame` | Scoreboard, announcer | Tracks remaining seconds; halved to detect halftime. |
| `shotClock` | `resetGameState`, `runGameFrame`, `setupViolationInbound` | Announcer, AI urgency checks | 24-second shot clock reset on violations and new possessions. |
| `currentTeam` | Possession system, inbound routines | AI, scoreboard, violation logic | Identifies which team currently has the ball. |
| `ballCarrier` | Possession system, rebounds, inbound routines | Input handling, AI, animations | Primary reference for the handler; safety net ensures it never stays null while the ball is live. |
| `frontcourtEstablished`, `frontcourtEstablishedByTeam` | Violations module | Backcourt logic, AI (press/backcourt logic) | Indicates whether the offense has crossed midcourt this possession. |
| `ballHandlerStuckTimer`, `ballHandlerAdvanceTimer` | `runGameFrame`, violations | AI, violation enforcement | Incremented when the handler barely moves; used for five-second counts. |
| `ballCarrierNeedsDecision`, `ballCarrierDecisionTime` | Physical play (shove/ shake outcomes) | AI offense ball handler | Notifies the handler that it must pick pass vs. shot after a contested possession. |
| `scoreFlash`, `scoreFlash.activeTeam` | Scoreboard + events | Violations (stopScoreFlash) | Drives the scoreboard's flashing indicators; automatically stopped when the same team retains possession. |
| `inboundPositioning`, `inboundPassData` | Violations, score routines | Animation system, possession system | Contains scripted positions for inbounders/receivers/defenders when setting up after whistles. |
| `jumpBallPhase` / `jumpBallMeta` | `jumpBallSystem` | Game loop, input handler, announcer | Tracks the non-blocking opening-tip sequence so countdown, jump timing, and possession handoff run without freezing the loop. |
| `jumpIndicators` (per sprite) | Jump indicator module | Rendering cleanup | Keeps track of marker entries so they can be cleared when the animation ends. |

## Lifecycle & Reset Points

1. **Game start (`resetGameState`).** Sets score, period, possession, turbo, shot clocks, and inbound alternates. Clears any persisted scoreboard flashes or inbound data.
2. **Per frame.** `runGameFrame` updates timers (`lastSecondTime`, `lastAIUpdateTime`), toggles flags (e.g., `shotInProgress`, `reboundActive`), and writes new values only through `stateManager.set`.
3. **Violations / turnovers.** `setupViolationInbound` and `switchPossession` handle all resetting logic: shot clock, frontcourt state, inbound data, and ball carrier.
4. **Halftime.** `gameLoop` resets `lastUpdateTime`, `lastSecondTime`, `lastAIUpdateTime`, and redraws the court/UI before continuing with the second half.
5. **Game over.** UI flows read `stateManager` to display stats, then `cleanupSprites` and `resetGameState` prepare for the next match.

## Multiplayer Considerations

- The coordinator shares the same `stateManager`; clients never mutate these keys directly. Instead they receive serialized snapshots (position arrays, turbo meters, possession flags) from the coordinator via `mp_coordinator`.
- Replay and failover modules leverage the `reason` parameter passed to `stateManager.set` to rebuild a frame-by-frame audit log. When adding new keys, choose descriptive reasons (e.g., `"backcourt_reset"`, `"violation_inbound"`) to keep the audit trail readable.

## Adding New State

When introducing a new mechanic:

1. Define its default value in `lib/game-logic/game-state.js`.
2. Update reset helpers (`resetGameState`, `resetBackcourtState`, halftime logic) so the value is cleaned up in all phases.
3. Interact with the state exclusively through `stateManager.get/set` so multiplayer and debugging features see every change.
