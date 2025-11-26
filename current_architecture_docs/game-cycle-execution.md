### Halftime → Second Half adjustments (Wave 24)

- `startSecondHalfInbound` now derives the inbounding team by flipping `stateManager.get("firstHalfStartTeam")` so the squad that opened on defense receives the second-half possession.
- Before calling `setupInbound`, `prepareSecondHalfPositions` places both offensive players in their own backcourt and pushes defenders toward midcourt, avoiding the legacy “paired with defender” layout.
- The halftime override stays resident through the entire inbound setup so any retries during `PHASE_INBOUND_SETUP` reuse the corrected layout; it is cleared as part of the phase cleanup once the inbound pass queues.
- Shot clock resets to 24, `ballCarrier` clears, `pendingSecondHalfInbound` is set, and fresh positioning + inbound animation kicks off.

### Opening Jump Ball sequence (Wave 24)

- The jump ball is now a fully non-blocking phase (`PHASE_JUMP_BALL`). `jumpBallSystem.startOpeningTipoff()` requests the phase transition, and `runGameFrame` lets the system advance via `jumpBallSystem.update()` every frame.
- Countdown prompts (`Jump Ball in 3…`, `2…`, `1…`, `JUMP!`) are emitted on live frames—no frame scheduler waits—so announcer text and court rendering remain visible while the ball rises.
- Player alignment occurs once at the start of the phase and all `forcePos` flags are cleared before play resumes, preventing the second-half inbound pairing regression.
- The ball animates along a parabolic arc while both centers can jump. Human timing (spacebar) and CPU reaction windows feed into the weighted resolver, which still honors `PLAYER_CONSTANTS.JUMP_BALL` and the deterministic seed.
- The winner tips the ball toward a wing teammate with a short trail, claims possession, and the phase resets to `PHASE_NORMAL`. No inbound animation runs, but control returns instantly with the ball in play at midcourt.

### Overtime sequence (Wave 24)

- `runGameFrame` invokes `maybeStartOvertime(systems)` once regulation time expires and the score is tied. The helper lives in `lib/game-logic/overtime.js` so the entry point stays inside the module-loader path.
- Clock lengths come from `TIMING_CONSTANTS.CLOCK.REGULATION_SECONDS` and `TIMING_CONSTANTS.CLOCK.OVERTIME_SECONDS`. The second value can be tuned independently for testing; when unset it defaults to a quarter of regulation.
- Fast-OT testing lives behind `TIMING_CONSTANTS.CLOCK.TEST_OVERRIDES.FAST_OVERTIME`. When `ENABLED` the regulation clock collapses to the override length, and when `AUTO_TIE.ENABLED` the loop forces both scores to the configured value without skipping the remaining regulation time (default threshold `SECONDS_REMAINING = 0` ties the game exactly as the clock expires). The override is single-use per match—once overtime begins the helper marks it consumed so subsequent periods play out normally. Flip both flags back to `false` to restore the default cadence.
- The first overtime possession belongs to the team that won the opening jump (`stateManager.get("regulationOvertimeAnchorTeam")`). Each subsequent overtime flips via `stateManager.get("overtimeNextPossessionTeam")` so possessions alternate without needing extra jump balls.
- `startOvertimeInbound` mirrors the second-half inbound flow: it queues `PHASE_INBOUND_SETUP` with reason `"overtime_start"`, primes the same backcourt positioning script, resets the shot clock, and clears frontcourt/inbounding flags through the possession system. The helper fires after the overtime intro banner clears so inbound animations do not play underneath the overlay.
- `setPhase(PHASE_OVERTIME_INTRO, …)` drives a short intermission powered by `renderOvertimeIntro`, displaying an overtime banner, possession callout, and a countdown pulled from `CLOCK.OVERTIME_INTRO`. While `overtimeIntroActive` is true the authority loop pauses clock ticks, AI, collision checks, and court redraws so the overlay stays stable.
- Every time overtime triggers the state manager increments `overtimeCount`, bumps `totalGameTime` by the overtime duration (for stat projections), toggles `isOvertime`, and announces `[OVERTIME]` via `announceEvent("overtime_start", { overtimeNumber })` so UI, announcer, and multiplayer coordinators stay synchronized.
- If an overtime period ends with the score still tied, the helper repeats the process, alternating the inbounding team. Otherwise the authority path returns `"game_over"` and the caller transitions to the victory UI.

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
