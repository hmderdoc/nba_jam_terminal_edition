# Legend of the Red Bull (LORB) System Guide — Wave 24

This document is the current source of truth for the `lib/lorb` runtime. It replaces the legacy files in `lib/lorb/design_docs/` (they describe a different layout and refer to files that no longer exist).

## Execution Flow
- Entry: `lib/lorb/lorb.js` loads `boot.js`, then attempts to load or create a character (via `LORB.Persist.load` or `LORB.CharacterCreation.run`).
- Daily resources: returning players get `LORB.Locations.Hub.initDailyResources(ctx)` before the hub; new players get the same after creation if no `lastPlayedTimestamp` exists. Day boundaries are purely timestamp-based (see `config.js`).
- Presence: `LORB.Persist.setPresence` uses locked writes (500ms timeout) to trigger pub/sub notifications; cleared on exit via `clearPresence`. Other players receive presence updates via subscription callbacks, not polling.
- Main loop: `LORB.Locations.Hub.run(ctx)` drives all navigation (courts, club, gym, shop, crib, tournaments); the hub returns `"reset"` or `"quit"` to control save/cleanup.
- Save: on normal exit, `LORB.Persist.save(ctx)` persists all non-underscore fields; `_user` is stripped before save and reattached on load.

## Context Model (persisted unless noted)
- Identity: `name`, `nickname`, `userHandle`, `_user` (runtime only), `_globalId`, `_lastSave`, `_bbsId/_bbsName` (write-only metadata).
- Progression: `level`, `xp`, `rep`, `cash`, `wins`, `losses`, `gamesPlayed`, `attributePoints`, `day` counter.
- Stats and appearance: `stats` (speed/threePt/power/steal/block/dunk), `archetype`, `background`, `appearance` (skin/eye/jerseryColor/lettering/jerseyNumber/nametag colors).
- Resources: `streetTurns`, `gymSessions`, `barActions`, `restUsedToday`, `tempBuffs`, `dailyBetting` (club 23 wagers), `dayStats` (session tracking).
- Crew and inventory: `contacts` (rolodex), `crew` (array of `{contactId}`), `activeTeammate`, `equipment` (e.g., `feet`), `inventory` (drinks), flags (`flags` map), `careerStats`, `records`.
- **PvP tracking**: `pvpStats` (gamesPlayed/wins/losses/ties/currentStreak/longestWinStreak/totals), `pvpRecords` (per-stat single-game bests).
- Time markers: `lastPlayedTimestamp` (ms), optional `_daysPassed`/`_effectiveDays` for one-time welcome messaging.

## Load Order and Namespaces (`lib/lorb/boot.js`)
- Establishes global `LORB` namespace with `{ Util, Core, Data, Engines, View }`.
- Loads `config.js`, utilities (`util/*.js` including `shared-state.js`), mock engine (`engines/nba_jam_mock.js`, required) and optional real adapter (`engines/nba_jam_adapter.js`), data (`data/*.js` including `cities.js`), core modules, UI, and locations.
- Registers events from `lorb_events.ini` via `LORB.Events.loadFromIni` and wires CPU team definitions (`LORB.Core.registerCpuTeams`).
- **SharedState initialization** happens in `lorb.js` after boot but before character load.

## Modules and Responsibilities
- **Config:** `config.js` holds day duration/banking, daily resource caps, default team roster, betting odds/spread/total knobs, and graffiti wall limits (`MAX_GRAFFITI_ENTRIES`, `MAX_GRAFFITI_LINES`, `GRAFFITI_LINE_LENGTH`).
- **Data:** `data/archetypes.js`, `backgrounds.js`, `cpu_teams.js`, `data/events.ini`, `data/cities.js` feed character creation, CPU rosters, city rotation, and random events. `lorb_events.ini` is loaded at runtime. `cities.js` loads `cities.json` and provides city lookup/rotation helpers (see "Shared World State and City Rotation System" section).
- **Core:**
  - `state.js`: legacy initializer (not used by `lorb.js`; kept for reference).
  - `economy.js`: simple currency/xp/rep application helpers.
  - `rules.js`: maps mock battle outcomes to xp/rep/money drops.
  - `character_creation.js`: multi-step LoRD-style flow (intro → name → archetype → stat allocation → background → appearance customization with RichView/BinLoader). Seeds starter teammate via `LORB.Util.Contacts.createStarterTeammate`.
  - `battle_adapter.js`: bridges to mock or real engine. Uses `LORB.Engines.NBAJam.runLorbBattle` for simulations; prefers `LORB.Engines.NBAJamReal.runStreetBattle` when available.
  - `events.js`: weighted random events from `lorb_events.ini` (battle/gamble placeholder); `runGamble` is intentionally unimplemented.
  - `playoffs.js`: **Parallel playoffs system.** Manages end-of-season playoff brackets that run alongside new seasons:
    - `createPlayerSnapshot(player)`: Freezes a player's stats/attributes at season end for playoff use.
    - `createBracket(seasonNumber, snapshotMap, eligibleGlobalIds)`: Builds a flexible bracket (2/4/8/16 players) with BYE handling and seeding.
    - `getPlayerPlayoffStatus(globalId)`: Returns player's current playoff state (upcoming match, bracket status, rewards).
    - `transitionSeason()`: Ends current season, creates snapshots/bracket, starts new season immediately.
    - `finalizeMatch(seasonNumber, matchId, result)`: Records match outcomes; supports PvP, ghost, and CPU_SIM resolution modes.
    - `checkAndResolveDeadlines()`: Auto-resolves matches past soft deadline (ghost) or hard deadline (CPU simulation).
    - `awardPlayoffPrizes(seasonNumber)`: Distributes rewards to winner/runner-up after bracket completion.
    - Bracket status lifecycle: `PENDING` → `ACTIVE` → `COMPLETED`, with `ABANDONED` fallback for hard deadline.
- **Engines:** `engines/nba_jam_mock.js` (authoritative mock with `runLorbBattle`), `engines/nba_jam_adapter.js` (adapts LORB ctx/opponents to `runExternalGame`; also supports AI-vs-AI spectate for betting).
- **Utilities:**
  - `util/persist.js`: JSON-DB wrapper (shared `server.ini` config). Handles load/save/remove, presence heartbeat (`lorb.presence` namespace, 60s timeout), leaderboards (`listPlayers/getLeaderboard`), online status checks, and **graffiti wall** storage (`lorb.graffiti` namespace via `readGraffiti`/`addGraffiti`). Presence/live ops use LOCK_READ/LOCK_WRITE for JSONClient; there is still no multi-attempt retry/backoff for these writes.
  - `util/shared-state.js`: Manages global shared world state (`lorb.sharedState`). Provides `initialize`, `get`, `getGameDay`, `getInfo`, `resetSeason`, `timeUntilNextDay`. Game day is computed from `(now - seasonStart) / DAY_DURATION_MS`. See "Shared World State and City Rotation System" section.
  - `util/contacts.js`: builds crew contacts from NBA players, tracks tiers/cuts, awards contacts on NBA wins, starter teammate (Barney), crew rivalry helpers, and active teammate selection. `checkCrewRivalConflict` exists but is not enforced during awards.
  - `util/daily_matchups.js`: deterministic NBA daily schedule generator (seeded by day number). Reads `lib/config/rosters.ini`, computes odds/spreads/totals, simulates outcomes, and grades wagers. Namespaced under `LORB.Betting`.
  - `util/career-stats.js`: cumulative/stat record tracking, formats stats/averages/records, calculates post-game cash bonuses by stat with difficulty multipliers.
  - `util/pvp-stats.js`: **PvP-specific statistics and news system.** Tracks multiplayer-exclusive stats separately from street/career stats. Provides:
    - `pvpStats` tracking: wins/losses/ties, streak tracking, cumulative game stats
    - `pvpRecords`: single-game PvP bests (points, rebounds, biggest win margin, etc.)
    - **Sports news system** (`lorb.pvpNews` namespace): Records match results with headlines like "Player A defeated Player B 16-13. Barney led scoring with 9 points!"
    - Static PvP wager system: $50 per match, +50 rep on win, -10 rep on loss
  - `util/rng.js`: tiny LCG helper (seedable).
  - `get_random_opponent.js`: scans `/assets/characters/*.bin` and cross-references `rosters.ini` to attach team/stats metadata; used by courts for NBA encounters.
- **Multiplayer (live challenge handshake):**
  - `multiplayer/challenges.js`: CRUD on `lorb.challenges.*` records in JSON-DB, pending/accepted/declined lifecycle, ready heartbeats, and cleanup of expired invites. JSONClient reads/writes/removes are locked (LOCK_READ/LOCK_WRITE) per bucket entry.
  - `multiplayer/challenge_service.js`: background poll/maintenance loop (event-timer) that keeps challenge data fresh without blocking UI loops; started/stopped from `lorb.js`.
  - `multiplayer/challenge_lobby.js`: waits for both sides to mark ready (keeps own readiness fresh), bounded by timeouts so hub/menu loops don't hang forever.
  - `multiplayer/challenge_lobby_ui.js`: simple prompts for incoming challenges and waiting screens; invoked from hub and tournaments.
- **UI:** `ui/view.js` (Frame-based legacy UI wrapper), `ui/stats_view.js` (RichView player card with sprite rendering and fallback), `ui/sprite_preview.js` (minimal preview helper used during creation), `ui/playoff_view.js` (**Playoff bracket and status UI**):
    - `run(ctx)`: Main entry point; routes to bracket view or match flow based on player status.
    - `showBracket(ctx, seasonNumber)`: Displays the current bracket with match status, winners, and player highlighting.
    - `showPlayerStatus(ctx, status)`: Shows the player's current playoff position, upcoming opponent, and rewards info.
    - `playPlayoffMatch(ctx, status)`: Initiates a playoff match (PvP if opponent online, ghost otherwise).
    - `getHubStatusLine(ctx)`: Returns formatted status line for hub display (e.g., "PLAYOFF: Round of 8 vs PlayerName").
    - `hasPlayoffAction(ctx)`: Quick check if player has a pending playoff match.
- **Locations:** (all prefer RichView, fall back to `LORB.View`)
  - `locations/hub.js`: central menu. Owns day calculation (`calculateGameDay/daysBetween/timeUntilNextDay`), resource refresh (`initDailyResources`), quit/reset flows. Does not call `initDailyResources` internally; expects caller to do so to avoid double-granting.
  - `locations/courts.js`: court selection and game flow. Generates opponents (streetball or NBA via `get_random_opponent`), supports reroll, runs real game via `runExternalGame` when available, otherwise mock simulation. Handles teammates (`LORB.Util.Contacts.getActiveTeammate` fallback to generated streetballer), applies rewards, crew cuts, career stat recording/bonuses, level-up, contact awards on NBA wins. Uses `ctx.dayStats` for session metrics.
  - `locations/club23.js`: social hub + betting. Restores resources (bar actions) and leverages `LORB.Betting.generateDailyMatchups` and `nba_jam_adapter.runSpectateGame` for wagers. Builds rumors from static pools plus persisted player stats/records when available. Handles rest/rumor/bookie flows. Includes **graffiti wall** feature in the restroom submenu (read/write persistent messages via `LORB.Persist.readGraffiti`/`addGraffiti`).
  - `locations/gym.js`: stat training with per-session costs scaling by current stat; limited by `ctx.gymSessions` and cash. Shows equipped buffs for context.
  - `locations/shop.js`: gear/consumables. Sneakers apply persistent mods while equipped (`equipment.feet`); drinks apply temp buffs to `ctx.tempBuffs`. `getEffectiveStats` used by UI and courts to show buffs.
  - `locations/crib.js`: home menu for contacts/crew/appearance/stats. Supports character reset (calls `LORB.Persist.remove` and flags `_deleted`). Crew/rolodex operations rely on `LORB.Util.Contacts`. Appearance editor mirrors character creation options.
  - `locations/tournaments.js`: leaderboard/ghost-match lobby. Pulls `LORB.Persist.listPlayers` and `getOnlinePlayers`, computes league leaders/records from persisted `careerStats` and `records`, and lets users view other player cards (`LORB.UI.StatsView.showForPlayer`). **Ghost matches use court-tier based stakes** (mirroring Hit the Streets mechanics) instead of arbitrary wagers:
    - Uses courts from `GHOST_MATCH.COURTS` config (middle_school, high_school, aau, college, nba) with escalating cashBase/repBase/difficulty
    - Available courts limited by **both players' rep** (can only challenge on courts both have unlocked)
    - Opponent must have minimum cash for the court tier (`GHOST_MATCH.MIN_OPPONENT_CASH`)
    - Costs 1 street turn (same as Hit the Streets)
    - Winner gains court's cashReward; loser's balance is debited via `LORB.Persist.updatePlayerBalance`
    - **Ghost matches run through the real game engine** (`runExternalGame`) when available:
      - Player team built from `ctxToPlayer(ctx)` + active teammate via `getMyTeammate(ctx)`
      - Ghost team built from `ghostOpponentToPlayer(opponent)` + opponent's teammate via `getGhostTeammate(opponent)`
      - Falls back to mock 50/50 simulation if engine unavailable
      - Career stats recorded via `LORB.Util.CareerStats.recordGame` on completion
      - Player can quit mid-match (no stat changes)

## Integration Points
- **Real game dependency:** Rich game flow requires `runExternalGame` (from the main NBA Jam runtime). Courts and adapter fall back to mock simulation if absent; presence of `BinLoader`, `RichView`, and sprite utils gates richer UI paths.
- **JSON-DB / JSONClient:** Uses dedicated `lorb` scope for presence and live challenges. `LORB.Persist` assumes JSONClient availability (autoloads `json-client.js` if missing) and writes under `lorb.players` / `lorb.presence` / `lorb.graffiti` / `lorb.sharedState`. JSONClient operations take locks but still lack retry/backoff/validation beyond helper backoff.
- **Assets:** Heavy reliance on `/sbbs/xtrn/nba_jam/assets` for sprites and art; missing files silently degrade to ASCII.

## Shared World State and City Rotation System

### Overview
All players share a global game day that advances based on real time elapsed since "season start." Instead of tracking individual player days, the system uses a single `seasonStart` timestamp stored in `lorb.sharedState` (JSON-DB). This ensures all players experience the same game day and city.

### Key Components
- **`util/shared-state.js`** (`LORB.SharedState`): Manages the global shared state.
  - `initialize()`: Creates `sharedState` if it doesn't exist; sets `seasonStart` to now, `initialized` flag.
  - `get()`: Returns raw shared state object.
  - `getGameDay()`: Computes current day from `(now - seasonStart) / DAY_DURATION_MS`, floored + 1 (1-indexed).
  - `getInfo()`: Returns `{ gameDay, seasonStart, msUntilNextDay, initialized }`.
  - `resetSeason()`: Resets `seasonStart` to now (for admin use).
  - `timeUntilNextDay()`: Milliseconds until next day boundary.

- **`data/cities.js`** (`LORB.Cities`): Loads city definitions from `cities.json` and provides rotation helpers.
  - `getCurrent(gameDay)`: Returns city object for given day (0-indexed mod 30).
  - `getToday()`: Convenience wrapper that fetches gameDay from `SharedState`.
  - `getBuffs(city)`: Normalizes city buff object (defaults all undefined to 0).
  - `applyBuffsToStats(baseStats, city)`: Returns new stats object with buffs applied.
  - `getClubName(city)`: Returns city's nightclub name (fallback: "Club 23").
  - `getBannerPath(city)` / `getDetailPath(city)`: Returns paths to city art files.
  - `getHubTitle(city, gameDay)`: Formatted hub header string.
  - `getTeamColorCode(city)`: Returns Ctrl-A color code based on region.
  - `getBuffDescription(city)`: Short string describing active buffs.

- **`cities.json`** (at `lib/lorb/design_docs/season_concept/cities.json`): 30 NBA city definitions with:
  - `id`, `cityName`, `teamName`, `region`, `order` (1-30)
  - `bannerBin`, `detailBin` (art file names)
  - `nightclubName` (city-specific club name)
  - `buffs` (speed, three, power, steal, block, dunk, stamina, defense, fundamentals, clutch, luck, foulTolerance, repMultiplier, cashMultiplier)
  - `notes` (flavor text)

### City Rotation Logic
- Day 1 = cities[0] (Boston)
- Day 2 = cities[1] (New York)
- ...
- Day 30 = cities[29] (Oklahoma City)
- Day 31 = cities[0] (Boston again)

Formula: `cityIndex = (gameDay - 1) % 30`

### Art Assets
City art files are stored in `/sbbs/xtrn/nba_jam/assets/lorb/cities/`:
- Banners: 80x4 .bin files (e.g., `bos_banner.bin`, `chi_banner.bin`)
- Details: 40x20 .bin files (e.g., `bos_detail.bin`, `chi_detail.bin`)
- Defaults: `default_banner.bin`, `default_detail.bin` (fallbacks)

Generated via `scripts/generate-city-art.js` with city-specific colors and icons.

### Player Context Changes
- `joinedTimestamp`: When player first joined (ms since epoch)
- `joinedOnDay`: Game day when player joined
- `joinedInCity`: City ID where player joined
- Legacy players get these fields set on first load after update

### UI Integration
- **Hub**: Displays current city name, team, buffs, and loads city-specific banner/detail art.
- **Club23**: Uses `LORB.Cities.getClubName()` for dynamic nightclub naming.
- **Welcome Message**: Shows "Day X in CityName" with team info.
- **Exit Message**: Farewell uses current city name.

## Parallel Playoffs System

### Overview
At the end of each 30-day season, the top players are frozen into "snapshots" and seeded into a playoff bracket. The new season starts immediately (Day 1), and the playoffs run in parallel. Players continue their new-season progression while also playing out their playoff matches on their own schedule.

### Key Design Principles
1. **Parallel execution:** Season N+1 starts immediately when Season N ends. No downtime.
2. **Frozen snapshots:** Playoff matches use the player's end-of-season stats, not current stats.
3. **Flexible brackets:** 2, 4, 8, or 16 players depending on eligible pool size.
4. **Deadline-driven resolution:** Soft deadline (72h) triggers ghost match; hard deadline (168h) triggers CPU simulation.
5. **Single codepath:** All match resolutions (PvP, ghost, CPU_SIM) flow through `finalizeMatch()`.

### Data Model
- **Season state** (`lorb.sharedState`): Extended with `currentPlayoffBracket`, `currentPlayoffSnapshots`, and `playoffHistory`.
- **PlayerSeasonSnapshot**: Frozen copy of player at season end (stats, equipment, teammate, rep, etc.).
- **PlayoffBracket**: Contains `seasonNumber`, `status`, `createdAt`, `softDeadline`, `hardDeadline`, `rounds` array, `playerSnapshots` map.
- **PlayoffMatch**: Contains `matchId`, `round`, `position`, `player1Id`, `player2Id` (null for BYE), `winnerId`, `resolvedAt`, `resolution` (PVP/GHOST/CPU_SIM/BYE).

### Status Enums (from `lib/lorb/config.js`)
- **SEASON_STATUS:** `ACTIVE`, `PLAYOFFS_PENDING`, `PLAYOFFS_ACTIVE`, `COMPLETED`
- **BRACKET_STATUS:** `PENDING`, `ACTIVE`, `COMPLETED`, `ABANDONED`
- **MATCH_STATUS:** `PENDING`, `IN_PROGRESS`, `COMPLETED`

### Flow
1. **Season transition** (`transitionSeason()`): Called when game day exceeds season length (30 days).
   - Creates snapshots for eligible players (min 3 games, positive rep).
   - Builds bracket with top N players (2/4/8/16 based on pool size).
   - Sets deadlines (soft: 72h, hard: 168h from transition).
   - Resets `seasonStart` for new season.
2. **Player login check** (`lorb.js`): Calls `checkAndResolveDeadlines()` to auto-resolve expired matches.
3. **Hub display**: Shows playoff status line if player is in active bracket.
4. **Match play** (`PlayoffView.run()`): Player initiates match via hub or tournaments.
   - If opponent online: Attempts live PvP challenge.
   - If opponent offline: Plays ghost match against snapshot.
5. **Match finalization** (`finalizeMatch()`): Records result, advances bracket, checks for completion.
6. **Prize distribution** (`awardPlayoffPrizes()`): Called when bracket completes; awards cash/rep to winner and runner-up.

### Configuration (from `lib/config/game-mode-constants.js`)
```javascript
LORB_PLAYOFFS: {
    SOFT_DEADLINE_HOURS: 72,    // After this, ghost match auto-resolution
    HARD_DEADLINE_HOURS: 168,   // After this, CPU simulation
    MIN_GAMES_TO_QUALIFY: 3,
    MIN_REP_TO_QUALIFY: 0,
    MAX_BRACKET_SIZE: 16,
    PRIZE_WINNER_CASH: 5000,
    PRIZE_WINNER_REP: 500,
    PRIZE_RUNNER_UP_CASH: 2000,
    PRIZE_RUNNER_UP_REP: 200
}
```

### Integration Points
- **Hub** (`locations/hub.js`): Displays playoff status line; adds "Playoff Match Ready!" menu option when player has pending match.
- **Tournaments** (`locations/tournaments.js`): Adds `[O] Playoffs` hotkey to access bracket view from any stats screen.
- **Entry point** (`lorb.js`): Checks deadlines on login; handles season transition when day > 30.

## Strengths
- Clear load order and hard dependency checks in `boot.js` (mock engine enforced).
- Core gameplay loop in `courts.js` cleanly separates opponent generation, game execution, and rewards with crew cut + stat bonus hooks.
- Persistence/leaderboard already multi-BBS aware via `qwk_id` scoping.
- Career stats and crew systems are modularized for reuse (Shop/Gym/StatsView all consume shared helpers).

## Gaps and Risks
- **Docs drift:** `lib/lorb/design_docs/` are outdated (refer to files like `character.js`/`persistence.js`); this file supersedes them.
- **Config discipline:** Many magic numbers remain (rewards, odds multipliers, UI strings). They are not routed through `lib/config/*.js` or `lib/utils/constants.js`, and `config.js` lacks Wave 24 constant wiring.
- **State initializer unused:** `core/state.js` is not called by `lorb.js`; entry directly uses `LORB.Persist`/`CharacterCreation`. If `state.js` is meant to be canonical defaults, flows must be unified.
- **Events/gambling incomplete:** `LORB.Events.runGamble` is a stub; event battle template support is minimal. `lorb_events.ini` content is not validated.
- **Persistence robustness:** JSONClient errors are only logged; there is no reconnect/backoff, partial write protection, or validation of saved schema. Presence heartbeats ignore failures.
- **Crew rivalry enforcement:** `checkCrewRivalConflict` is never invoked when adding contacts/crew; rival metadata from rosters is currently informational only.
- **Testing:** No automated tests for LORB modules; game-critical flows (daily resource grants, betting payouts, crew cuts, stat bonuses) rely on manual verification.
- **Resource timing:** Default `DAY_DURATION_MS` is 1h (testing). Production expectation (24h) is noted in comments but not enforced anywhere; ensure deployments set correct values before live use.

## Working Agreements
- Treat this file as the authoritative LORB guide; update it alongside code changes. Avoid reviving legacy design docs.
- Keep `config.js` and `LORB.Config` in sync with any new tuning knobs; prefer adding to shared config modules (`lib/config/*.js`) if reuse with the main game is required.
- When integrating with the real game loop, ensure `runExternalGame` and result shapes (`playerStats`, `lorbId`) remain compatible with the parsing in `locations/courts.js` and `engines/nba_jam_adapter.js`.
