# Legend of the Red Bull (LORB) System Guide — Wave 24

This document is the current source of truth for the `lib/lorb` runtime. It replaces the legacy files in `lib/lorb/design_docs/` (they describe a different layout and refer to files that no longer exist).

## Execution Flow
- Entry: `lib/lorb/lorb.js` loads `boot.js`, then attempts to load or create a character (via `LORB.Persist.load` or `LORB.CharacterCreation.run`).
- Daily resources: returning players get `LORB.Locations.Hub.initDailyResources(ctx)` before the hub; new players get the same after creation if no `lastPlayedTimestamp` exists. Day boundaries are purely timestamp-based (see `config.js`).
- Presence: `LORB.Persist.setPresence` heartbeat every 30s while in the hub; cleared on exit.
- Main loop: `LORB.Locations.Hub.run(ctx)` drives all navigation (courts, club, gym, shop, crib, tournaments); the hub returns `"reset"` or `"quit"` to control save/cleanup.
- Save: on normal exit, `LORB.Persist.save(ctx)` persists all non-underscore fields; `_user` is stripped before save and reattached on load.

## Context Model (persisted unless noted)
- Identity: `name`, `nickname`, `userHandle`, `_user` (runtime only), `_globalId`, `_lastSave`, `_bbsId/_bbsName` (write-only metadata).
- Progression: `level`, `xp`, `rep`, `cash`, `wins`, `losses`, `gamesPlayed`, `attributePoints`, `day` counter.
- Stats and appearance: `stats` (speed/threePt/power/steal/block/dunk), `archetype`, `background`, `appearance` (skin/eye/jerseryColor/lettering/jerseyNumber/nametag colors).
- Resources: `streetTurns`, `gymSessions`, `barActions`, `restUsedToday`, `tempBuffs`, `dailyBetting` (club 23 wagers), `dayStats` (session tracking).
- Crew and inventory: `contacts` (rolodex), `crew` (array of `{contactId}`), `activeTeammate`, `equipment` (e.g., `feet`), `inventory` (drinks), flags (`flags` map), `careerStats`, `records`.
- Time markers: `lastPlayedTimestamp` (ms), optional `_daysPassed`/`_effectiveDays` for one-time welcome messaging.

## Load Order and Namespaces (`lib/lorb/boot.js`)
- Establishes global `LORB` namespace with `{ Util, Core, Data, Engines, View }`.
- Loads `config.js`, utilities (`util/*.js`), mock engine (`engines/nba_jam_mock.js`, required) and optional real adapter (`engines/nba_jam_adapter.js`), data (`data/*.js`), core modules, UI, and locations.
- Registers events from `lorb_events.ini` via `LORB.Events.loadFromIni` and wires CPU team definitions (`LORB.Core.registerCpuTeams`).

## Modules and Responsibilities
- **Config:** `config.js` holds day duration/banking, daily resource caps, default team roster, betting odds/spread/total knobs.
- **Data:** `data/archetypes.js`, `backgrounds.js`, `cpu_teams.js`, `data/events.ini` feed character creation, CPU rosters, and random events. `lorb_events.ini` is loaded at runtime.
- **Core:**
  - `state.js`: legacy initializer (not used by `lorb.js`; kept for reference).
  - `economy.js`: simple currency/xp/rep application helpers.
  - `rules.js`: maps mock battle outcomes to xp/rep/money drops.
  - `character_creation.js`: multi-step LoRD-style flow (intro → name → archetype → stat allocation → background → appearance customization with RichView/BinLoader). Seeds starter teammate via `LORB.Util.Contacts.createStarterTeammate`.
  - `battle_adapter.js`: bridges to mock or real engine. Uses `LORB.Engines.NBAJam.runLorbBattle` for simulations; prefers `LORB.Engines.NBAJamReal.runStreetBattle` when available.
  - `events.js`: weighted random events from `lorb_events.ini` (battle/gamble placeholder); `runGamble` is intentionally unimplemented.
- **Engines:** `engines/nba_jam_mock.js` (authoritative mock with `runLorbBattle`), `engines/nba_jam_adapter.js` (adapts LORB ctx/opponents to `runExternalGame`; also supports AI-vs-AI spectate for betting).
- **Utilities:**
  - `util/persist.js`: JSON-DB wrapper (shared `server.ini` config). Handles load/save/remove, presence heartbeat (`lorb.presence` namespace, 60s timeout), leaderboards (`listPlayers/getLeaderboard`), and online status checks. Uses LOCK_READ/LOCK_WRITE; no retry/backoff or partial write protection.
  - `util/contacts.js`: builds crew contacts from NBA players, tracks tiers/cuts, awards contacts on NBA wins, starter teammate (Barney), crew rivalry helpers, and active teammate selection. `checkCrewRivalConflict` exists but is not enforced during awards.
  - `util/daily_matchups.js`: deterministic NBA daily schedule generator (seeded by day number). Reads `lib/config/rosters.ini`, computes odds/spreads/totals, simulates outcomes, and grades wagers. Namespaced under `LORB.Betting`.
  - `util/career-stats.js`: cumulative/stat record tracking, formats stats/averages/records, calculates post-game cash bonuses by stat with difficulty multipliers.
  - `util/rng.js`: tiny LCG helper (seedable).
  - `get_random_opponent.js`: scans `/assets/characters/*.bin` and cross-references `rosters.ini` to attach team/stats metadata; used by courts for NBA encounters.
- **Multiplayer (live challenge handshake):**
  - `multiplayer/challenges.js`: CRUD on `lorb.challenges.*` records in JSON-DB, pending/accepted/declined lifecycle, ready heartbeats, and cleanup of expired invites (no JSONClient locks).
  - `multiplayer/challenge_service.js`: background poll/maintenance loop (event-timer) that keeps challenge data fresh without blocking UI loops; started/stopped from `lorb.js`.
  - `multiplayer/challenge_lobby.js`: waits for both sides to mark ready (keeps own readiness fresh), bounded by timeouts so hub/menu loops don't hang forever.
  - `multiplayer/challenge_lobby_ui.js`: simple prompts for incoming challenges and waiting screens; invoked from hub and tournaments.
- **UI:** `ui/view.js` (Frame-based legacy UI wrapper), `ui/stats_view.js` (RichView player card with sprite rendering and fallback), `ui/sprite_preview.js` (minimal preview helper used during creation).
- **Locations:** (all prefer RichView, fall back to `LORB.View`)
  - `locations/hub.js`: central menu. Owns day calculation (`calculateGameDay/daysBetween/timeUntilNextDay`), resource refresh (`initDailyResources`), quit/reset flows. Does not call `initDailyResources` internally; expects caller to do so to avoid double-granting.
  - `locations/courts.js`: court selection and game flow. Generates opponents (streetball or NBA via `get_random_opponent`), supports reroll, runs real game via `runExternalGame` when available, otherwise mock simulation. Handles teammates (`LORB.Util.Contacts.getActiveTeammate` fallback to generated streetballer), applies rewards, crew cuts, career stat recording/bonuses, level-up, contact awards on NBA wins. Uses `ctx.dayStats` for session metrics.
  - `locations/club23.js`: social hub + betting. Restores resources (bar actions) and leverages `LORB.Betting.generateDailyMatchups` and `nba_jam_adapter.runSpectateGame` for wagers. Builds rumors from static pools plus persisted player stats/records when available. Handles rest/rumor/bookie flows.
  - `locations/gym.js`: stat training with per-session costs scaling by current stat; limited by `ctx.gymSessions` and cash. Shows equipped buffs for context.
  - `locations/shop.js`: gear/consumables. Sneakers apply persistent mods while equipped (`equipment.feet`); drinks apply temp buffs to `ctx.tempBuffs`. `getEffectiveStats` used by UI and courts to show buffs.
  - `locations/crib.js`: home menu for contacts/crew/appearance/stats. Supports character reset (calls `LORB.Persist.remove` and flags `_deleted`). Crew/rolodex operations rely on `LORB.Util.Contacts`. Appearance editor mirrors character creation options.
  - `locations/tournaments.js`: leaderboard/ghost-match lobby. Pulls `LORB.Persist.listPlayers` and `getOnlinePlayers`, computes league leaders/records from persisted `careerStats` and `records`, and lets users view other player cards (`LORB.UI.StatsView.showForPlayer`). Ghost match wagering uses up to 10% of opponent’s balance; actual ghost simulation depends on external game integration.

## Integration Points
- **Real game dependency:** Rich game flow requires `runExternalGame` (from the main NBA Jam runtime). Courts and adapter fall back to mock simulation if absent; presence of `BinLoader`, `RichView`, and sprite utils gates richer UI paths.
- **JSON-DB:** Shares `nba_jam` scope with multiplayer systems. `LORB.Persist` assumes JSONClient availability (autoloads `json-client.js` if missing) and writes under `lorb.players` / `lorb.presence`. No schema migration or versioning exists—new fields simply persist.
- **Assets:** Heavy reliance on `/sbbs/xtrn/nba_jam/assets` for sprites and art; missing files silently degrade to ASCII.

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
