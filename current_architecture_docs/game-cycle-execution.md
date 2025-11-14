## Entry Point

1. `nba_jam.js` loads `lib/core/module-loader.js` and calls `loadGameModules()`, which brings in the entire dependency stack in a controlled order (sbbsdefs → constants → systems → rendering → logic → AI → multiplayer). The loader validates key globals such as `COURT_WIDTH`, `GAME_BALANCE`, and `spriteRegistry`.
2. After module loading, the front-end flow (team selection, demo, multiplayer lobby, etc.) always ends by:
   - Calling `initFrames(systems)` to build/open the announcer, court, trail, hoop, and scoreboard frames.
   - Creating `systems` via `initializeSystems` (`lib/core/system-init.js`), which returns `stateManager`, `eventBus`, `frameScheduler`, and the passing/possession/shooting systems.
   - Resetting `gameState` and spawning player sprites through `resetGameState` + `initSprites`.

## `gameLoop` (single-player authority)

`nba_jam.js` owns the high-level loop:

1. Sets `gameRunning`, `lastUpdateTime`, `lastSecondTime`, `lastAIUpdateTime`, and clears potential assists.
2. Reopens hoop frames (they are closed between games) and draws the initial court + scoreboard.
3. Builds a `config` object for `runGameFrame`, supplying:
   - `isAuthority` (true for single-player).
   - `handleInput` (polls `console.inkey` and forwards keys to `handleInput`).
   - `aiInterval` / `frameDelay` derived from `getSinglePlayerTempo()`.
4. Enters a `while` loop that calls `runGameFrame(systems, config)` until `gameRunning` becomes false or `timeRemaining` hits zero. After each frame it asks `systems.frameScheduler` to `waitForNextFrame(frameDelay)`.
5. Handles halftime by invoking `showHalftimeScreen`, resetting timers, and redrawing the court, and treats `"game_over"` results by breaking out to the game-over UI.

## `runGameFrame` (lib/core/game-loop-core.js)

Each frame consists of:

1. **Position snapshot.** Store `prevX/prevY` on every sprite (used by passing and AI modules).
2. **Ball safety net.** If the ball should be in play but has no carrier, trigger a loose-ball scramble via `createRebound`.
3. **Timer updates (authority only).**
   - Decrement `timeRemaining` and `shotClock` every `GAME_CLOCK_TICK_MS`.
   - Trigger halftime when the first half crosses below its halfway mark.
   - Fire shot-clock violations by announcing the event, pausing 1 s (`SHOT_CLOCK_RESET_PAUSE_MS`), switching possession, and resetting the shot clock.
4. **Violation checks.** Call `checkViolations`, which enforces backcourt timers, five-second counts, and inbound setup timing. A violation short-circuits the frame so the inbound routine can reposition players.
5. **Block animation.** When `blockJumpTimer > 0`, animate the vertical arc, update jump indicators (now rendering on `trailFrame`), and clean up when the timer expires.
6. **Input processing.** Execute `config.handleInput()` (polls keyboard in single-player; in multiplayer the coordinator consumes queued inputs).
7. **AI throttling.** Run `updateAI(systems)` no faster than `config.aiInterval`, skipping celebratory/transition phases listed in `skipAIPhases`.
8. **Turbo recharge & physics.**
   - Recharge turbo for every player not holding the turbo button.
   - When authority is true, call `checkSpriteCollision` and `checkBoundaries` to keep sprites separated and in-bounds.
9. **Rendering & animation.**
   - `updateAnnouncer`, `updateGamePhase`, `updateSpriteRendering`.
   - Step the animation queue (`systems.animationSystem.update()`), then let the passing system clear queued passes once animations end.
   - `updateReboundScramble` and `updateKnockbackAnimations` resolve lingering physics effects.
   - Every `COURT_RENDER_THROTTLE_MS` (default 60 ms), redraw the court if `courtNeedsRedraw` is set, draw hoops, refresh the scoreboard, and call `Sprite.cycle()` on the court/hoop frames.
10. **Game-over detection.** When `timeRemaining <= 0`, the function returns `"game_over"`. A `"halftime"` return value signals the caller to run the halftime UI; otherwise it returns `"continue"` so the caller can schedule the next frame.

## Multiplayer Variants

- The multiplayer coordinator (`lib/multiplayer/mp_coordinator.js`) runs the same `gameLoop`/`runGameFrame`, but `handleInput` consumes packets pulled from per-player queues (`game.<session>.inputs.<playerId>`). Authority remains true on the coordinator only.
- Clients (`lib/multiplayer/mp_client.js`) do not execute the main loop. They predict local movement using trimmed-down versions of the physics helpers and reconcile against state snapshots streamed from the coordinator (`state.<session>.<playerId>` queues).
- Tuning parameters (frame delay, AI interval, flush intervals) come from `MP_CONSTANTS.TUNING_PRESETS` so different network presets can loosen or tighten cadence without touching gameplay code.

## Cleanup & Transition

- When `gameLoop` exits, it sets `gameRunning = false`, closes hoop frames, and returns control to the caller (single-player menu, demo loop, or multiplayer lobby).
- Every new match goes through `cleanupSprites`, `resetGameState`, `initSprites`, and `initFrames` to guarantee that persistent state (`frontcourtEstablishedByTeam`, inbound alternates, turbo meters) starts fresh.
