# Magic Number Audit (Wave 24)

Purpose: surface the most common “floating” constants so we can funnel them into purpose-built config modules instead of leaving `80`, `20`, `0.6`, `7000`, etc. scattered through the codebase. This pass catalogues the constant **families** we keep re-encoding and points to the modules where they currently live.

---

## 1. Proposed Constant Families

| # | Description | Recommended file | Typical contents / examples |
|---|-------------|------------------|-----------------------------|
| 1 | **Dev / Diagnostics** | `lib/config/dev-constants.js` | Feature flags, debug toggles, log paths, `BEEP_DEMO`, throttle multipliers used only during development. |
| 2 | **Gameplay Geometry & Definitions** | `lib/config/gameplay-constants.js` | Court/sprite dimensions, rim positions, key depth, scoreboard layout widths, animation frame sizes. Anything that describes the physical world or HUD layout (e.g., `COURT_WIDTH`, `DUNK_ARC_HEIGHT_MAX`, baseline offsets). |
| 3 | **Speed / Timing / Turbo** | `lib/config/timing-constants.js` | Frame delays, animation durations, violation timers, turbo recharge/drain rates, ms-based cooldowns (`BLOCK_JUMP_DURATION`, `SHOVE_FAILURE_STUN`, `SINGLEPLAYER_TEMPO`). |
| 4 | **AI Behaviour & Difficulty** | `lib/config/ai-constants.js` | Shot thresholds, pass probabilities, spacing tolerances, shove/passing heuristics, “tight defender” tuning. The old `ai-difficulty` sliders can live here as structured presets. |
| 5 | **Game Definition / Modes** | `lib/config/game-mode-constants.js` | Demo-mode lengths, halftime duration, number of periods, scoring bonuses, bookie/betting ranges, dev/test options. |
| 6 | **Multiplayer Networking** | `lib/config/mp-constants.js` | Connection timeouts, lobby intervals, flush intervals, HUD display ranges, screen-sync limits. |
| 7 | **Player Model / Attributes** | `lib/config/player-constants.js` | Attribute indices, base stamina/turbo, height/width defaults, injury thresholds, animation offsets. |
| 8 | **Audio / UI / Presentation** (optional) | `lib/config/presentation-constants.js` | ANSI color codes, text box dimensions, menu padding (`40`-wide overlays, etc.). |

Implementation pattern:
1. Create the small config modules (they can simply export literal objects).
2. Replace direct numeric literals with `CONST_NAME` references.
3. Keep `lib/utils/constants.js` as a bootstrapper that `load()`s the new modules and re-exports them, so existing includes stay stable during the migration.

---

## 2. Current Hotspots & Suggested Ownership

### ✅ Pass 1 (Geometry & Scoreboard Layout)
- Created `lib/config/gameplay-constants.js` and routed court geometry, dunk parameters, and scoreboard layout defaults through it.
- Updated `lib/utils/constants.js`, `lib/rendering/court-rendering.js`, and `lib/ui/scoreboard.js` to reference the shared config (no more ad-hoc `80`, `2`, `6`, etc. in those files).

### ✅ Pass 2 (Timing / Turbo / Animation)
- Added `lib/config/timing-constants.js` covering demo length, single-player tempo, turbo behaviour, shove cooldowns, and block animation durations.
- `lib/utils/constants.js` now sources `DEMO_GAME_SECONDS`, `SINGLEPLAYER_TEMPO`, turbo params, shove stun frames, and block timing from the shared config; other modules continue reading the same global names but automatically benefit from centralized tuning.

### ✅ Pass 3 (AI Base Tuning)
- Added `lib/config/ai-constants.js` and wired `lib/utils/constants.js` to read all of the core AI thresholds (shot probability, shot-clock urgency, backcourt urgency, steal chance, defender ranges). Gameplay code still references the same globals, but the values now live in one place for quick tuning.

### ✅ Pass 4 (Multiplayer networking & tuning)
- Added `lib/config/mp-constants.js` capturing chat channel, server presets, tuning presets, latency ladder, and ping/latency measurement settings.
- Updated `lib/utils/constants.js`, `lib/multiplayer/mp_config.js`, and `lib/multiplayer/mp_network.js` to pull every hard-coded MP constant (flush intervals, network HUD thresholds, ping cadence, adaptive tuning) from the shared config. Multiplayer knobs now live in one file for faster iteration.
- Extended `lib/config/mp-constants.js` with an `ANIMATION_HINTS` surface (TTL, packet ceiling, label defaults) consumed by `lib/utils/constants.js`, `lib/multiplayer/mp_coordinator.js`, `lib/multiplayer/mp_client.js`, and `lib/rendering/court-rendering.js` so the new hint pipeline carries zero inline literals.
- Wave 24 follow-up: added `ANIMATION_HINTS.INBOUND` and `.DRIFT` blocks to centralize tween durations + drift flash timing, eliminating the ad-hoc `25/70/8` literals from multiplayer hint consumers.

### ✅ Pass 5 (Player movement & hitbox defaults)
- Expanded `lib/config/player-constants.js` with movement-speed envelopes, collision thresholds, boundary clamps, sprite defaults, and input-buffer guards.
- `lib/utils/constants.js` now sources all player speed globals (`PLAYER_BASE_SPEED_PER_FRAME`, turbo modifiers, min/max clamps, diagonal normalization, buffer limits) from the config so existing consumers stay stable.
- Refactored `lib/game-logic/movement-physics.js` to replace the remaining `2/5/7/0.707` literals with the shared constants (`PLAYER_BOUNDARIES`, `PLAYER_COLLISION_THRESHOLD`, etc.), keeping collision, boundary clamps, movement budgets, and keyboard flushes centralized.

### ✅ Pass 6 (Bookie odds & betting defaults)
- Introduced `lib/config/game-mode-constants.js` (loaded via `lib/utils/constants.js`) to own bookie odds tuning plus betting UI defaults.
- `lib/bookie/bookie.js` now reads attribute weights, odds scaling/caps, spread math, over/under math, bankroll defaults, and wager defaults from the shared config, eliminating the ad-hoc `1.2 / 110 / 0.5 / 1000 / 100` literals spread across calculation helpers and UI flows.

### ✅ Pass 7 (Menu & splash layouts)
- Expanded `game-mode-constants.js` with a `MENUS` block covering team selection columns, splash layout thresholds, and matchup frame geometry/timing (plus a `promptsEnabled` toggle to keep betting UI hidden).
- `lib/ui/menus.js` now references those layout constants for team selection spacing, splash rendering, and matchup presentation (graphic widths, frame offsets, rotation timers, odds/prompt placement). The betting prompt logic is fully disabled by config, and demo-mode now calls `showMatchupScreen(false, …)` to match that intent.

### ✅ Pass 8 (Core timing & animation)
- Grew `lib/config/timing-constants.js` to cover game-clock cadence, shot-clock defaults, render throttles, shove/shake cooldowns, loose-ball trajectories, and detailed animation timings for shots, passes, rebounds, dunks, and idle bounces.
- `lib/core/game-loop-core.js` now sources its second-by-second tick, shot-clock reset pause, default shot-clock, and render throttle entirely from the shared timing config (no more inline `1000`/`24`/`60`).
- `lib/game-logic/physical-play.js` reads all shake/shove cooldowns, knockdown durations, and loose-ball arc math from the new config so shove physics stay tunable in one place.
- `lib/rendering/animation-system.js` now consumes the structured animation timing presets, covering shot/pass duration curves, rebound bounce cadence, dunk frame defaults, idle-bounce loops, and the debug/log fallbacks.

### ✅ Pass 9 (AI offense-ball heuristics)
- Extended `lib/config/ai-constants.js` with a full `OFFENSE_BALL` surface (decision windows, quick-three spacing, drive/high-fly thresholds, escape/press-break tuning, dead-dribble odds, shove exploits).
- `lib/ai/offense-ball-handler.js` now pulls every probability, timer, and distance gate from that config through helper accessors, retiring the scattered `0.6 / 1.9 / 1200 / 5.4` literals while keeping legacy behaviour via sane fallbacks.

### ✅ Pass 10 (AI off-ball & defense tuning)
- Added `OFFENSE_OFF_BALL`, `DEFENSE_ON_BALL`, and `DEFENSE_HELP` sections to `ai-constants.js` so all cut timers, spacing speeds, contain distances, paint-help responses, and shove odds stay centralized.
- `lib/ai/offense-off-ball.js`, `lib/ai/defense-on-ball.js`, and `lib/ai/defense-help.js` now read their heuristics through the shared config helpers, removing the lingering literals (`timeAtSpot > 20`, `distToBall <= 1.7`, `paint offset 10`, etc.).

### ✅ Pass 11 (Player boundary consumers)
- `lib/utils/constants.js` now exports `PLAYER_BOUNDARIES`, `PLAYER_COLLISION_THRESHOLD`, and `PLAYER_SPRITE_DEFAULTS`, so every module reads the same hitbox/boundary object instead of redeclaring `{ minX: 2, maxYOffset: 5 }` locally.
- `lib/game-logic/movement-physics.js` simply consumes those globals (with guards for standalone tests) rather than constructing its own copies, ensuring one source of truth for clamps and collision cores.
- `lib/systems/passing-system.js` and `lib/game-logic/passing.js` clamp receivers/lead targets via the shared bounds, preserving test fallbacks while eliminating the `Math.max(2, Math.min(COURT_WIDTH - 7, …))` literals.
- `lib/rendering/court-rendering.js` references the same boundary config when offsetting the live ball so dribble animations don’t extend past the defined player footprint near the sideline.

### 2.1 Geometry & UI
- `lib/rendering/court-rendering.js:31-117` – `baselineTop = 2`, `centerLeft = Math.floor(COURT_WIDTH / 2)`, loops from `y = 2`. These belong in **gameplay geometry** (baseline offsets, ASCII art widths).  
- `lib/ui/scoreboard.js:260-330` – Hard-coded frame widths (`80`), column offsets (`60`, `centerColumn = Math.floor(frameWidth / 2)`), turbo bar length `6`. Move to **presentation constants** so HUD tweaks don’t require code edits.  ✅ *(Handled via `GAMEPLAY_CONSTANTS.SCOREBOARD` in Pass 1.)*
- `lib/ui/menus.js:230-260` – ✅ handled in Pass 7 (team selection padding sourced from `GAME_MODE_CONSTANTS.MENUS.TEAM_SELECTION`).  
- `lib/ui/menus.js:420-520` – ✅ handled in Pass 7 (splash minimums/timeouts now read from `MENUS.SPLASH`).  
- `lib/ui/menus.js:520-860` – ✅ handled in Pass 7 (matchup frame geometry, odds offsets, animation cadences centralized in `MENUS.MATCHUP` and betting prompts gated via config).

### 2.2 Timing & Animation
- `lib/core/game-loop-core.js:210-330` – ✅ handled in Pass 8 (clock tick/checks, shot-clock reset delay, and render throttle all read from `TIMING_CONSTANTS.CLOCK/RENDER`).  
- `lib/game-logic/physical-play.js:125-179` – ✅ handled in Pass 8 (shake/shove cooldowns, loose-ball bounce distances, and knockdown frame ranges pulled from `TIMING_CONSTANTS`).  
- `lib/rendering/animation-system.js:250-360` – ✅ handled in Pass 8 (shot/pass/rebound/dunk cadence + idle fallback sourced from `TIMING_CONSTANTS.ANIMATION`).

### 2.3 AI Behaviour
- `lib/ai/offense-ball-handler.js:70-420` – ✅ handled in Pass 9 (decision windows, quick-three spacing, drive/high-fly heuristics, press-break logic, and dead-dribble odds now live in `AI_CONSTANTS.OFFENSE_BALL`).  
- `lib/ai/offense-off-ball.js:60-220` – ✅ handled in Pass 10 (spontaneous cut timing, wobble thresholds, passing-lane shoves, and sprint speeds now sourced from `AI_CONSTANTS.OFFENSE_OFF_BALL`).  
- `lib/ai/defense-on-ball.js` / `lib/ai/defense-help.js` – ✅ handled in Pass 10 (contain distances, steal/shove odds, paint-help responses, and deny positioning now read from `AI_CONSTANTS.DEFENSE_*`).

### 2.4 Multiplayer
- `lib/multiplayer/mp_network.js:188-210` – Connection timeout `10000`, packet sample size `5`, latency bar thresholds.  
- `lib/multiplayer/mp_client.js:600-820` – Input flush intervals, prediction windows (`33`, `50`, `maxInputBatch = 5`).  
- `lib/multiplayer/mp_config.js:160-220` – Reconnection delays (`mswait(100)`), JSON client timeouts. All candidates for **mp-constants.js**.

### 2.5 Player / Attribute Model
- `lib/game-logic/player-class.js` – Uses sprite dimensions and offsets inline.  
- `lib/game-logic/movement-physics.js:140-210` – ✅ handled in Pass 5 (collision thresholds, boundary clamps, movement speed caps are now in `PLAYER_CONSTANTS`).  
- `lib/game-logic/dunks.js` – `spriteHalfWidth = 2`, `absDx > KEY_DEPTH + 4`. These belong in **player constants** so we can retune sprite hitboxes centrally.

### 2.6 Bookie / Game Mode Definitions
- `lib/bookie/bookie.js` – ✅ handled in Pass 6 (attribute weights, bankroll defaults, odds scaling, spread/total rounding now live in `GAME_MODE_CONSTANTS`).  
- `lib/ui/menus.js` – ✅ key layouts handled in Pass 7; remaining timers/options can piggyback on `MENUS` if more tuning is needed later.

---

## 3. Migration Plan

1. **Carve out config modules** (start with the four biggest buckets: gameplay, timing, AI, multiplayer). Each module should export a plain object (or set of consts) that `constants.js` can attach to the global scope.
2. **Phase migrations per subsystem**:
   - Rendering/UI passes rewire to `PRESENTATION.COURT.BASELINE_TOP`, `HUD.SCOREBOARD.WIDTH`.
   - AI passes replace inline values with `AI.THRESHOLDS.SPACING`, `AI.PROBABILITIES.CUT`.
   - Multiplayer passes swap literals for `MP.NETWORK.TIMEOUT_MS`, `MP.INPUT.FLUSH_INTERVAL`.
3. **Lint for stragglers**: run `grep -R "\b[0-9]\{2,\}\b"` (excluding `constants.js` and JSON assets) to spot large numeric literals. Each new constant should originate from the right config file.
4. **Document**: update `README.md` (or a `docs/config/CONSTANTS.md`) describing where to find each family so future contributors don’t reintroduce magic numbers.

Following this audit, editors should rarely see `80`, `12`, `0.6`, or `10000` hard-coded anywhere besides the config modules. That keeps gameplay tuning, AI behaviour, and network performance adjustments fast and predictable.
