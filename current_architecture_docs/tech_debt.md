## Rendering & UI

- **Frame lifecycle.** Multiple systems assume frames are globally available (`leftHoopFrame`, `trailFrame`, `scoreFrame`) without null checks. We need a centralized frame manager that can recreate frames after console resets and expose a status API so modules can fail fast rather than silently skipping work.
- **Scoreboard throttling.** HUD redraws are tied to `COURT_RENDER_THROTTLE_MS`. If no court cells are dirtied, the scoreboard can freeze even while turbo meters change. Separating HUD cadence from court redraw cadence would fix the issue.

## Input & Timing

- **Blocking waits.** Shot-clock violations and some UI flows still call `frameScheduler.waitForNextFrame(1000)` (effectively `mswait`). That halts AI, multiplayer state broadcasts, and even keyboard input. Refactoring these pauses into non-blocking timers would keep the loop responsive.
- **Console dependency.** Single-player input handling reads from `console.inkey` directly. Headless modes (automated tests, dedicated coordinator) either need a stub console or a pluggable input provider.

## AI Configuration

- **Duplicated constants.** Client prediction, AI heuristics, and movement physics each have their own hard-coded thresholds (1.5 vs. 2 tile collision checks, various turbo gates). We’ve centralized most AI thresholds in `ai-constants.js`, but physics thresholds still live in code. Exporting them through `PLAYER_CONSTANTS` or `TIMING_CONSTANTS` would reduce divergence.

## Multiplayer

- **Queue assumptions.** The coordinator only creates queues if `session.playerList` exists. There’s no validation or fallback if the lobby fails to populate that field, leading to silent failures. We should either assert the field or allow dynamic queue creation when a new player joins.
- **Prediction hooks.** `mp_client.js` mirrors movement logic manually. As physics evolves, keeping the prediction helper in sync becomes tedious. Ideally, `movement-physics.js` would expose a pure function (no side effects) that both authority and client prediction could call.
- **Failover story.** While `mp_failover.js` exists, there’s no documentation or tooling around rehydrating `playerSpriteMap` or state queues when a new coordinator takes over mid-game.

## Game State Management

- **Reason strings only.** `stateManager.set` records a free-form reason (“backcourt_reset”), but there’s no structured telemetry stream. We need either a debug hook or standardized enums so downstream tools can analyze state changes without parsing arbitrary strings.
- **Large shared globals.** Sprites (`teamAPlayer1`, etc.) remain globals referenced throughout the codebase. Wrapping them in `stateManager` or returning them from `systems.getPlayers()` everywhere would make hot-reload/testing safer.
