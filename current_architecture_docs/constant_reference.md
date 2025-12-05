## Constant Reference (Wave 24 Runtime)

The entry path (`nba_jam.js` → `lib/core/module-loader.js`) loads `lib/utils/constants.js`, which in turn imports every module under `lib/config/*.js`. Those modules define plain objects, and `constants.js` maps them to globals (e.g., `COURT_WIDTH`, `TIMING_CONSTANTS`, `PLAYER_BOUNDARIES`). This document explains what lives in each module and how it is consumed so we centralize tuning knobs instead of scattering literals.

---

### Aggregation Flow (`lib/utils/constants.js`)

1. Loads config modules in this order: `gameplay-constants`, `timing-constants`, `ai-constants`, `mp-constants`, `player-constants`, `game-mode-constants`.
2. Projects values onto globals:
   - Geometry: `COURT_WIDTH`, `COURT_HEIGHT`, `BASKET_LEFT_X`, etc.
   - Timing: `SINGLEPLAYER_TEMPO`, `COURT_RENDER_THROTTLE_MS`, `HUD_RENDER_INTERVAL_MS`.
   - Player movement: `PLAYER_BOUNDARIES`, `PLAYER_COLLISION_THRESHOLD`, `PLAYER_BASE_SPEED_PER_FRAME`, etc.
   - AI heuristics: `SHOT_PROBABILITY_THRESHOLD`, `DOUBLE_TEAM_RADIUS`, etc.
   - Multiplayer tuning: `MP_CONSTANTS` plus derived latency helpers.
3. Provides derived helpers (three-point spots, dunk words, shoe palettes) using those base constants.

Any new constant should be added to the appropriate config module, required in `constants.js`, and then referenced via the exported object/global—not via inline literals.

---

### `lib/config/gameplay-constants.js`

Domain | Keys | Consumers |
| --- | --- | --- |
| Court geometry | `COURT.WIDTH`, `.HEIGHT`, `.BASKET_LEFT_X/Y`, `.THREE_POINT_RADIUS`, `.KEY_DEPTH` | `rendering/court-rendering.js`, `game-logic/possession.js`, AI spacing helpers. |
| Dunk defaults | `DUNK.DISTANCE_BASE`, `.DISTANCE_PER_ATTR`, `.MIN_DISTANCE`, `.ARC_HEIGHT_MIN/MAX`, `.RIM_TARGET_OFFSET_X`, `.BALL_SIDE_OFFSET_X`, `.BALL_TOP_ROW_OFFSET` | `game-logic/dunks.js` generates flight plans, `rendering/animation-system.js` positions the dunking player and ball glyph using the shared offsets, and the shooting system pulls the same values when queuing dunks. |
| Jump ball layout | `JUMP_BALL.CENTER_X`, `.CENTER_Y`, `.PLAYER_OFFSET_X`, `.PLAYER_OFFSET_Y`, `.WING_OFFSET_X`, `.WING_OFFSET_Y`, `.ARC_HEIGHT`, `.JUMPER_LIFT` | `jump-ball-system.js` positions jumpers and wing players around the midcourt circle before the opening tip and defines the ball arc height + jumper lift used by the interactive animation. |
| Scoreboard layout | `SCOREBOARD.DEFAULT_WIDTH`, `.ROWS`, `.TURBO_BAR_LENGTH`, etc. | `lib/ui/scoreboard.js`, HUD helpers. |

Use this file for static geometry, UI layout metrics, and anything that should only change when the visual design changes.

---

### `lib/config/timing-constants.js`

Domain | Keys | Notes |
| --- | --- | --- |
| Tempo presets | `DEMO.GAME_SECONDS`, `SINGLEPLAYER_TEMPO.frameDelayMs/aiIntervalMs` | `getSinglePlayerTempo()`, demo timers. |
| Turbo | `TURBO.MAX`, `.DRAIN_RATE`, `.RECHARGE_RATE`, `.SPEED_MULTIPLIER`, `.ACTIVATION_THRESHOLD_MS`, `.SHOE_THRESHOLD` | Player class, HUD, shoe color logic. |
| Shove / shake | `SHOVE.FAILURE_STUN_FRAMES`, `.COOLDOWN_FRAMES`, `SHAKE.*` | Physical play + AI punish logic. |
| Shove direction | `SHOVE.DIRECTION.awayFromBasketWeight`, `.towardSidelineWeight`, `.minSidelineComponent`, `.randomJitter` | `knockback-system.js` calculates smart knockback direction that "clears the lane" by pushing victims away from their target basket + toward sideline. |
| Shove recovery | `SHOVE.VICTIM_RECOVERY.baseFrames`, `.framesPerPushUnit`, `.turboDrain`, `.speedPenalty`, `.turboDisabledFrames` | Victim stun duration (AI skipped), movement speed penalty during recovery, turbo drain on impact, and turbo-disabled period after recovery ends. Used by `knockback-system.js`, `coordinator.js`, `movement-physics.js`. |
| Block | `BLOCK.JUMP_DURATION_FRAMES`, `.JUMP_HEIGHT` | Block animations + shooting contest calculations. |
| Clock | `CLOCK.SECOND_MS`, `.SHOT_CLOCK_SECONDS`, `.SHOT_CLOCK_RESET_PAUSE_MS`, `.REGULATION_SECONDS`, `.OVERTIME_SECONDS`, `.OVERTIME_INTRO.DISPLAY_MS`, `.OVERTIME_INTRO.COUNTDOWN_SECONDS`, `.TEST_OVERRIDES.FAST_OVERTIME` (`ENABLED`, `.REGULATION_SECONDS`, `.AUTO_TIE.ENABLED`, `.AUTO_TIE.SECONDS_REMAINING`, `.AUTO_TIE.SCORE`) | `runGameFrame`, violation handlers, scoreboard, and `maybeStartOvertime` for period resets, overtime length tuning, the overtime intro overlay countdown, and the fast-overtime developer toggle that collapses regulation length and auto-ties scores for testing (consumed after the first overtime start so later periods are authentic). Setting `AUTO_TIE.SECONDS_REMAINING` to the default `0` ties the score as regulation expires without truncating the clock; higher thresholds keep the period running after the auto-tie. |
| Render cadence | `RENDER.COURT_THROTTLE_MS`, `.HUD_INTERVAL_MS` | `runGameFrame` dirty checks, scoreboard throttling. |
| Loose ball | `LOOSE_BALL.horizontalTiles`, `.verticalTiles`, `.arcSteps`, `.arcHeight` | `lib/game-logic/loose-ball.js`. |
| Safety net | `SAFETY_NET.NULL_CARRIER_FRAME_LIMIT`, `.OUT_OF_BOUNDS_FRAME_LIMIT`, `.STALE_INBOUND_FRAME_LIMIT`, `.BALL_OUT_OF_BOUNDS_MARGIN` | `lib/core/game-loop-core.js` monitors stalled possessions and spawns emergency scrambles when the ball is loose for too long. |
| Animation | `ANIMATION.SHOT/PASS/REBOUND/DUNK/GENERIC` | `AnimationSystem` queue timing. |
| Stat trail overlay | `STAT_TRAIL.LIFETIME_FRAMES`, `.FADE_FRAMES`, `.RISE_PER_FRAME`, `.RISE_SLOW_PER_FRAME`, `.RISE_FAST_PER_FRAME`, `.RISE_ACCELERATION_EXP`, `.HORIZONTAL_DRIFT_PER_FRAME`, `.BLINK_INTERVAL_FRAMES`, `.ORIGIN_Y_OFFSET`, `.MAX_ACTIVE`, `.FLASH_FG_COLOR`, `.FINAL_FG_COLOR`, `.FINAL_FADE_FRAMES`, `.SIDELINE_MARGIN`, `.BASELINE_MARGIN`, `.STAT_TYPE_COLORS` | `lib/animation/stat-trail-system.js` controls lifespan, acceleration curve, flashing cadence, fade palette, safe court margins, and stat-type color mapping for celebratory text overlays. |
| Inbound cadence | `INBOUND.SETUP_DURATION_MS` | `lib/game-logic/phase-handler.js` uses it for `PHASE_INBOUND_SETUP` length; `startSecondHalfInbound` references it so halftime restarts share the same animation window as post-score inbounds. |
| Jump ball | `JUMP_BALL.COUNTDOWN_MS`, `.DROP_DURATION_FRAMES`, `.DROP_START_Y`, `.CONTEST_WINDOW_FRAMES`, `.ARC_MIN_DURATION_MS`, `.HANDOFF_DURATION_MS`, `.CPU_OFFSET_MAX_RATIO`, `.CPU_OFFSET_EARLY_RATIO`, `.JUMP_ANIMATION_DURATION_RATIO`, `.JUMP_ANIMATION_MIN_MS`, `.JUMP_ANIMATION_MAX_MS` | `jump-ball-system.js` drives announcer cadence, ball arc timing, CPU jump scheduling, jumper animation bounds, and the handoff-to-wing tween; the same constants are consumed in both authority and client contexts to keep the tipoff deterministic. |
| Live challenge lobby (LORB) | `LORB_CHALLENGES.pendingAcceptanceGraceMs`, `.lobbyTimeoutMs`, `.pollTickMs` | `lib/lorb/multiplayer/challenge_lobby.js` paces lobby polling, extends acceptance grace, and caps total lobby wait to keep invites from timing out before the UI surfaces them. |

Timing, cadence, and animation math belong here.

---

### `lib/config/player-constants.js`

Provides the authoritative player-centric numbers and registers friendly global aliases.

| Group | Keys | Consumers |
| --- | --- | --- |
| `COLLISION_THRESHOLD` | `{ dx, dy }` | `movement-physics.js`, `mp_client.js` collision guard. |
| `COURT_BOUNDARIES` | `minX`, `maxXOffset`, `minY`, `maxYOffset`, `movementMaxXOffset`, `feetMinX`, `feetMaxXOffset`, `fallbackWidthClamp`, `passAutoClampTolerance` | Boundary clamps, diagonal preview logic, and per-system auto-clamp tolerance. |
| `SPRITE_DEFAULTS` | `width` | `clampSpriteFeetToCourt`. |
| `SPEED` | `basePerFrame`, `turboPerFrame`, `turboBallHandlerFactor`, `min/maxPerFrame`, `attrScalePerPoint`, `maxStepsPerFrame`, `diagonalNormalizationFactor` | Movement physics, AI pathing, multiplayer prediction. |
| `INPUT_BUFFER` | `maxFlush` | Multiplayer client input flushing. |
| `CLIENT_COLLISION_THRESHOLD` | `dx`, `dy` | Prediction guard used before local movement to keep clients in sync. |
| `JUMP_BALL` | `ATTRIBUTE_INDEX`, `.ATTRIBUTE_WEIGHT`, `.TURBO_WEIGHT`, `.RANDOM_WEIGHT`, `.RANDOM_MIN`, `.RANDOM_MAX`, `.TIEBREAKER_INCREMENT` | `jump-ball-system.js` resolves the opening tip contest deterministically so coordinator and clients pick the same winner. |

Additions that change how sprites move, collide, or buffer input belong here—not in gameplay/timing configs.

---

### `lib/config/ai-constants.js`

Contains tunables for AI state machines. Major sections:

- `SHOT_PROBABILITY_THRESHOLD`, `SHOT_CLOCK_URGENT_SECONDS`, `BACKCOURT_URGENT_SECONDS`.
- `OFFENSE_BALL` (decision weights, backcourt behavior, quick-three, drive/high-flyer/escape/pull-up heuristics, **bunching detection**).
- `OFFENSE_BALL.BUNCHING` - lane-blocked detection when close to basket, congestion shove triggers, cluster radius for multi-defender situations.
- `OFFENSE_OFF_BALL` (cuts, spacing, passing-lane behavior).
- `DEFENSE_ON_BALL` / `DEFENSE_ON_BALL.BUNCHING` - paint/contact shove triggers.
- `DEFENSE_ON_BALL.COURT_POSITION` - **Wave 24 court-position-aware reaction delays**. Defenders far from their own basket (full court press) react slower, giving offense an advantage to break through backcourt defense. Keys: `frontcourtResponsiveness`, `backcourtResponsiveness`, `midcourtResponsiveness`, `frontcourtMaxDistance`, `midcourtMaxDistance`, `directionChangePenaltyFrames`, `directionChangeReducedResponse`, `blowbySpeedThreshold`, `blowbyChanceBackcourt/Midcourt/Frontcourt`. Consumed by `defense-on-ball.js` via helpers in `ai-decision-support.js` (`calculateDefenderResponsiveness`, `trackDirectionChangePenalty`, `checkBlowbyOpportunity`).
- `DEFENSE_ON_BALL.PRESS_DECISION` - **Wave 24 strategic press vs retreat decision**. Determines whether defender should pursue full-court press or fall back to halfcourt. Keys: `pressThreshold` (0.4), `retreatDistance` (25 tiles), catchup weights (`catchupWeight`, `catchupTurboScale`, `catchupSpeedScale`), game situation weights (`scoreDifferentialWeight`, `trailingUrgencyBonus`, `desperationThreshold/Bonus`, `timeUrgencyThreshold/Weight`, `criticalTimeThreshold/Bonus`), threat assessment (`shooterThreatWeight`, `shooterThreatThreshold`), `rubberBandBonus`, `minPressDistance` (30). Consumed by `defense-on-ball.js` via `evaluatePressDecision()` in `ai-decision-support.js`.
- `DEFENSE_HELP` - help defender paint shove settings (`helpShoveDistance`, `helpShoveChance`, `helpMinTurbo`).

Every AI module (`ai/offense-ball-handler.js`, `ai/defense-on-ball.js`, etc.) should pull from these objects. If a new heuristic is needed, extend this file and document the consumer in a comment.

---

### `lib/config/mp-constants.js`

Networking and tuning knobs for multiplayer:

| Group | Keys | Notes |
| --- | --- | --- |
| Lobby defaults | `CHAT_CHANNEL`, `DEFAULT_SERVERS` | `mp_lobby.js`, UI menus. |
| Interval tuning | `PING_INTERVAL_MS`, `MEASURE_LATENCY_*`, `TUNING_PRESETS`, `ADAPTIVE_TUNING` | `NetworkMonitor`, client input buffer flush intervals, prediction depth. |
| UI | `LATENCY_INDICATORS` | HUD overlays showing connection quality. |
| Animation hints | `ANIMATION_HINTS.TTL_FRAMES`, `.MAX_PER_PACKET` | `mp_coordinator` tracker emits animation payloads (e.g., shove knockback). Clients consume them immediately to mirror authority choreography. |
| Hint choreography | `ANIMATION_HINTS.INBOUND.WALK_FRAMES`, `.READY_FRAMES`, `.TARGET_FRAMES`; `ANIMATION_HINTS.DRIFT.FLASH_FRAMES`, `.LERP_FRAMES` | Client-side animation helpers use these to pace inbound walk/ready/target tweens and drift-snap highlight duration. Keep coordinator + client tuned together. |
| Prediction turbo | `PREDICTION.TURBO.DRAIN_FACTOR`, `.CATCHUP_FACTOR` | `mp_client.js` scales client-side turbo drain and disables it during authoritative catch-up. |

If you need to change how often inputs flush, how reconciliation works, or what latency bars look like, edit this file.

---

### `lib/config/game-mode-constants.js`

Higher-level feature toggles:

- **Bookie system**: attribute weights, odds/spread/over-under scaling, default bankrolls.
- **Betting prompts**: `promptsEnabled`, `hotkeyEnabled` (used by menus + CPU modes).
- **Menus**: widths/heights/timeouts for splash, matchup, team selection flows.
- **Rule enforcement**: `RULE_ENFORCEMENT.BACKCOURT_VIOLATIONS_ENABLED` lets us gate the whistle while keeping the shared timers active for AI decision-making. Default is `false` to match the source game’s behaviour.
- **Rubber banding**: `RUBBER_BANDING` holds the master toggle, announcer cue toggle, default profile, probability caps, and per-profile tier tables (deficit/time thresholds plus gameplay multipliers). See `current_architecture_docs/rubber-banding.md` before altering values.

UI/feature gating constants go here rather than alongside gameplay physics.

---

### `lib/config/game-balance.js`

Legacy balance sheet grouped by subsystem (AI, shooting, dunks, rebounds, defense, physical play, fast break). New work should prefer `ai-constants.js`, `timing-constants.js`, or `player-constants.js`, but this file is still referenced by older modules. If you migrate a section, annotate both this file and `current_architecture_docs/tech-debt.md` so we can retire the duplicate.

---

### `lib/config/difficulty-scaling.js`

Centralizes AI difficulty scaling for LORB (Legend of the Red Bull) and other external game modes. Uses the `DifficultyScaling` global.

| Key | Type | Description |
| --- | --- | --- |
| `DIFFICULTY_PRESETS` | Object | Named presets (1–5 for LORB tiers, plus `playoff` and `jordan`). Each preset defines a package of AI modifiers. |
| `BASE_VALUES` | Object | Original AI constant values captured before scaling (for restoration). |
| `ORIGINAL_VALUES` | Object | Runtime cache of original values before current session's scaling was applied. |

**Preset Keys (per tier):**
- `turboCapacity` – AI turbo tank size (lower = runs out of gas faster).
- `shotThreshold` – Base shot probability threshold (higher = AI takes higher-quality shots).
- `denyReactionDelay` – Frames before help defender reacts (higher = slower help rotation).
- `blowbyChanceMultiplier` – Scales backcourt/midcourt/frontcourt blowby chances.
- `responsivenessMultiplier` – Scales court-position responsiveness values.
- `wobbleFramesMultiplier` – Scales off-ball cut hesitation (higher = more hesitation).
- `decisionDelayMultiplier` – Scales ball-handler decision delays.

**Public API (`DifficultyScaling.*`):**
- `applyDifficultyScaling(tier)` – Patches AI_CONSTANTS with preset multipliers; caches originals.
- `resetDifficultyScaling()` – Restores AI_CONSTANTS to cached originals.
- `applyTurboCapacityToAI(players)` – Sets `playerData.turboCapacity` on CPU players.
- `getDifficultyModifiers(tier)` – Returns the modifier object for a given tier.

**Consumers:**
- `lib/game-logic/external-game.js` – Applies scaling on LORB game start, resets on cleanup.
- `lib/lorb/core/season.js` – `getDifficultyModifiers()` delegates to this module.
- `lib/lorb/locations/courts.js` – Passes `lorbContext.difficulty` (1–5) to `runExternalGame`.

---

### Adding New Constants

1. Pick the module by category:
   - Geometry / UI layout → `gameplay-constants.js`.
   - Timing / animation / turbo → `timing-constants.js`.
   - Player movement / collision → `player-constants.js`.
   - AI heuristics → `ai-constants.js`.
   - Multiplayer networking → `mp-constants.js`.
   - Mode- or feature-specific toggles → `game-mode-constants.js`.
2. Export the value via the config object.
3. Wire it through `lib/utils/constants.js` if the runtime expects a derived global.
4. Replace every literal occurrence in code with the new constant.
5. Update `MAGIC-NUMBER-AUDIT.md` and any relevant architecture doc describing the subsystem.

Following this playbook keeps tuning centralized, prevents coordinator/client drift, and gives Copilot a single place to learn the project’s magic numbers.
