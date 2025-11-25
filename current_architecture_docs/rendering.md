## Frame Stack

`initFrames` (in `nba_jam.js`) builds a layered rendering stack:

1. `announcerFrame` (80×1) – displays announcer text at the top of the console.
2. `courtFrame` (COURT_WIDTH × COURT_HEIGHT) – static background art.
3. `trailFrame` – transparent overlay used for jump indicators, ball trails, and temporary highlights.
4. `ballFrame` (1×1, child of `courtFrame`) – dedicated sprite for the basketball. Created via `ensureBallFrame()` so we can move the glyph without repainting the court.
5. Player sprite frames (`team?Player?.frame`) – each sprite is a `Sprite.Aerial` instance created by `createSpriteForPlayer()` with `courtFrame` as its parent. These frames hold the ASCII art, jersey masks, and animation bearings for every player.
6. `leftHoopFrame` / `rightHoopFrame` – small transparent frames for rim/net graphics and basket flashes.
7. `scoreFrame` (80×5) – HUD for scores, turbo meters, fouls, etc.
8. `player.labelFrame` instances – each sprite owns a 1×PLAYER_LABEL_WIDTH frame created by `renderPlayerLabel()`. These frames follow the player and render controller labels/jersey numbers without touching the court art.

Frames are opened in that order and immediately `top()`-ed where necessary (trail, ball, hoop, player sprite, and player label frames) so overlays render above the court art without permanently altering it. `Sprite.cycle()` keeps each player’s frame raised once gameplay starts. Cleanup functions close frames between games to release console resources (`cleanupSprites` tears down each player’s label frame and `ensureBallFrame` recreates the ball overlay as needed).

## Rendering Flow per Frame

Inside `runGameFrame` (lib/core/game-loop-core.js):

1. **Static updates.**
   - `updateAnnouncer(systems)` handles textual cues (violations, turbo tips).
   - `updateGamePhase(frameDelay, systems)` animates scoreboard flashes and inbound scripts.
2. **Sprite refresh.** `updateSpriteRendering(systems)` updates sprite positions/frames regardless of whether the court is redrawn, ensuring animated sprites continue moving during idle frames.
3. **Animation system.** `systems.animationSystem.update()` iterates through queued animations (shots, passes, dunks, rebounds). Each animation entry stores enough data (frames, msPerStep, target points) to re-run deterministically on clients.
4. **Effect systems.** `updateReboundScramble` and `updateKnockbackAnimations` advance secondary VFX.
5. **Throttled redraw.** Every `COURT_RENDER_THROTTLE_MS` (60 ms by default):
   - If `courtNeedsRedraw` is true, `drawCourt(systems)` repaints the background and resets the dirty flag.
   - `drawHoops(systems)` refreshes hoop frames.
   - `drawScore(systems)` redraws the scoreboard HUD.
   - `cycleFrame` is called on court and hoop frames, followed by `Sprite.cycle()` to push all updates to the console.
- Intercepted passes shorten their animation target to the defender's intercept point so the ball stops where the steal occurs (coordinator broadcasts the truncated endpoints for clients).
6. **Trail overlay.** Effects like jump indicators use `trailFrame`. Since the overlay is transparent, painting and erasing entries leaves the underlying court untouched. Wave 24 also introduces a stat trail overlay that renders short-lived text (for example, `+2 PTS`) above the scorer using the same frame so the celebration never dirties the court art.

### Court Redraw Triggers

- `courtNeedsRedraw` flips to `true` whenever we stage an inbound setup. The flag is asserted after inbound positioning is pushed into state so the first post-setup frame guarantees a clean court before overlays redraw.
- Securing any rebound (offensive or defensive) also forces `courtNeedsRedraw=true`. This guards against scramble-era trail residue or rim flashes persisting once the ball is controlled again.

## Animation Timing Sources

`lib/rendering/animation-system.js` reads timing presets from `TIMING_CONSTANTS.ANIMATION`, including:

- Shot animation steps (`SHOT.MIN_STEPS`, `BASE_DURATION_MS`).
- Pass animation speed (`PASS.MIN_STEPS`, `DISTANCE_TIME_FACTOR_MS`).
- Rebound bounce cadence (`REBOUND.STEPS_PER_BOUNCE`).
- Dunk frame durations (`DUNK.DEFAULT_FRAME_MS`).
- Generic fallback speeds (used when animation data is incomplete).

That config-driven approach keeps single-player, demo, and multiplayer animation tempo aligned.

## TrailFrame-Only Effects

- Jump indicators (lib/rendering/jump-indicators.js) now refuse to draw when `trailFrame` is missing. This prevents artifacts on `courtFrame` but means the trail overlay must be created successfully for block arcs to show.
- Fire effects (`lib/rendering/fire-effects.js`) also target overlays, so both modules rely on the same transparent frame.
- Stat trails (lib/animation/stat-trail-system.js) emit celebratory text overlays triggered by `recordStatDelta` (points, rebounds, assists, steals, blocks, turnovers) and any direct `queueStatTrail` call. The effect reads team colors from game state by default, accepts explicit color overrides, floats the text upward for a fixed lifetime, and self-cleans each frame so concurrent animations coexist on the shared overlay. When overlays expire, the system marks `courtNeedsRedraw` so the background refreshes on the next render pass.

## Rendering in Multiplayer

- Clients and coordinators both run the same rendering code. Authoritative state packets (positions, animation payloads) feed into the animation system and sprite renderer; prediction is purely a local visual optimization.
- UI overlays (network latency indicators, player IDs) are layered on top of the existing frames without touching authoritative state.
