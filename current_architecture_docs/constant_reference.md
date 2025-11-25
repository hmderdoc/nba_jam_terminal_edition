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
| Dunk defaults | `DUNK.DISTANCE_BASE`, `.DISTANCE_PER_ATTR`, `.MIN_DISTANCE`, `.ARC_HEIGHT_MIN/MAX` | `game-logic/dunk-utils.js`, shooting system. |
| Scoreboard layout | `SCOREBOARD.DEFAULT_WIDTH`, `.ROWS`, `.TURBO_BAR_LENGTH`, etc. | `lib/ui/scoreboard.js`, HUD helpers. |

Use this file for static geometry, UI layout metrics, and anything that should only change when the visual design changes.

---

### `lib/config/timing-constants.js`

Domain | Keys | Notes |
| --- | --- | --- |
| Tempo presets | `DEMO.GAME_SECONDS`, `SINGLEPLAYER_TEMPO.frameDelayMs/aiIntervalMs` | `getSinglePlayerTempo()`, demo timers. |
| Turbo | `TURBO.MAX`, `.DRAIN_RATE`, `.RECHARGE_RATE`, `.SPEED_MULTIPLIER`, `.ACTIVATION_THRESHOLD_MS`, `.SHOE_THRESHOLD` | Player class, HUD, shoe color logic. |
| Shove / shake | `SHOVE.FAILURE_STUN_FRAMES`, `.COOLDOWN_FRAMES`, `SHAKE.*` | Physical play + AI punish logic. |
| Block | `BLOCK.JUMP_DURATION_FRAMES`, `.JUMP_HEIGHT` | Block animations + shooting contest calculations. |
| Clock | `CLOCK.SECOND_MS`, `.SHOT_CLOCK_SECONDS`, `.SHOT_CLOCK_RESET_PAUSE_MS` | `runGameFrame`, violation handlers, scoreboard. |
| Render cadence | `RENDER.COURT_THROTTLE_MS`, `.HUD_INTERVAL_MS` | `runGameFrame` dirty checks, scoreboard throttling. |
| Loose ball | `LOOSE_BALL.horizontalTiles`, `.verticalTiles`, `.arcSteps`, `.arcHeight` | `lib/game-logic/loose-ball.js`. |
| Animation | `ANIMATION.SHOT/PASS/REBOUND/DUNK/GENERIC` | `AnimationSystem` queue timing. |

Timing, cadence, and animation math belong here.

---

### `lib/config/player-constants.js`

Provides the authoritative player-centric numbers and registers friendly global aliases.

| Group | Keys | Consumers |
| --- | --- | --- |
| `COLLISION_THRESHOLD` | `{ dx, dy }` | `movement-physics.js`, `mp_client.js` collision guard. |
| `COURT_BOUNDARIES` | `minX`, `maxXOffset`, `minY`, `maxYOffset`, `movementMaxXOffset`, `feetMinX`, `feetMaxXOffset`, `fallbackWidthClamp` | Boundary clamps + diagonal preview logic. |
| `SPRITE_DEFAULTS` | `width` | `clampSpriteFeetToCourt`. |
| `SPEED` | `basePerFrame`, `turboPerFrame`, `turboBallHandlerFactor`, `min/maxPerFrame`, `attrScalePerPoint`, `maxStepsPerFrame`, `diagonalNormalizationFactor` | Movement physics, AI pathing, multiplayer prediction. |
| `INPUT_BUFFER` | `maxFlush` | Multiplayer client input flushing. |
| `CLIENT_COLLISION_THRESHOLD` | `dx`, `dy` | Prediction guard used before local movement to keep clients in sync. |

Additions that change how sprites move, collide, or buffer input belong here—not in gameplay/timing configs.

---

### `lib/config/ai-constants.js`

Contains tunables for AI state machines. Major sections:

- `SHOT_PROBABILITY_THRESHOLD`, `SHOT_CLOCK_URGENT_SECONDS`, `BACKCOURT_URGENT_SECONDS`.
- `OFFENSE_BALL` (decision weights, backcourt behavior, quick-three, drive/high-flyer/escape/pull-up heuristics).
- `OFFENSE_OFF_BALL` (cuts, spacing, passing-lane behavior).
- `DEFENSE_ON_BALL` / `DEFENSE_HELP`.

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

UI/feature gating constants go here rather than alongside gameplay physics.

---

### `lib/config/game-balance.js`

Legacy balance sheet grouped by subsystem (AI, shooting, dunks, rebounds, defense, physical play, fast break). New work should prefer `ai-constants.js`, `timing-constants.js`, or `player-constants.js`, but this file is still referenced by older modules. If you migrate a section, annotate both this file and `current_architecture_docs/tech-debt.md` so we can retire the duplicate.

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
