# Rubber Banding System (Wave 24 Planning)

This document captures the desired behaviour and integration points for a configurable
rubber banding system. Contributors must read and update this reference before touching
runtime code so that both the authority loop and multiplayer clients stay in sync.

## Goals

- Keep matches exciting by giving trailing teams incremental boosts.
- Let operators disable or heavily tune the system per game mode.
- Preserve determinism across single-player, demo, and multiplayer roles.
- Expose the active tier through announcer cues and diagnostics.

## Feature Flags

A forthcoming `GAME_MODE_CONSTANTS.RUBBER_BANDING` block will provide:

- `enabled` – master toggle. When `false`, all boosts are bypassed.
- `showCue` – when `true`, trigger announcer events when the tier changes.
- `profiles` – map of profile names to tier tables (see below) so different modes can
  opt into different behaviour (e.g., `arcade_default`, `pure_skill`).
- `defaultProfile` – profile name to use when the active mode has not overridden it.
- `probabilityCaps` – per-tier ceiling for post-modifier shot probabilities. Keeps
  stacks such as “on fire” + rubber band from exceeding the intended range.

## Tier Definitions

Each profile will contain an ordered array of tier descriptors. A tier becomes active
when all of its conditions are satisfied; later implementation should always choose
the highest matching tier.

```js
{
    id: "tier_0",            // unique identifier used for logging and announcer cues
    deficitMin: 0,            // inclusive point deficit lower bound
    deficitMax: 4,            // inclusive upper bound; null for open-ended
    clockMaxSeconds: null,    // optional game-clock ceiling (null = any time)
    shotMultiplier: 1.0,      // multiplier applied to base shot odds
    contestBonus: 0.0,        // additive reduction applied to defender contest penalties
    stealBonus: 0.0,          // additive boost to steal chance calculations
    shoveBonus: 0.0,          // additive boost to shove success probability
    blockBonus: 0.0,          // additive boost to block contest odds
    reboundBonus: 0.0,        // additive boost to rebound resolution
    turnoverRelief: 0.0,      // negative values reduce turnover odds
    turboReserveBonus: 0      // extra max turbo granted while tier active
}
```

**Clock awareness:** tiers can add crosstalk between deficit and urgency. For example,
a small deficit with < 10 seconds remaining could activate a mild boost even if the
full-game deficit thresholds are not met.

### Default Profiles

- **`arcade_default`** – Fibonacci-inspired deficit thresholds (5, 8, 13, 21) with a
  clutch sub-tier (`tier_clutch_3`) for late-game scenarios. Boosts escalate from mild
  multipliers to aggressive comeback assistance, and probability caps ramp from 95% up
  to 100% in the extreme tier.
- **`pure_skill`** – Empty tier list used as an opt-out profile for competitive modes.
  Multiplayer hosts can point sessions at this profile when they want zero rubber
  banding even if the global toggle remains enabled for other modes.

## Announcer Events

When `showCue` is true and the tier changes, the authority path will queue
`announceEvent("rubber_band_tier", { tierId, deficit, profile })`. The announcer data
will include quote variants for mild, moderate, severe, and last-ditch swings.
Multiplayer coordinators must serialize these events so clients mirror the cue.

Default quotes live in `assets/announcer.json` under the `rubber_band_tier` entry.
They may reference `${teamName}` and `${tierId}` placeholders; payloads should
include both keys whenever the cue fires. Disable the cue globally by setting
`showCue: false` or per-session via the multiplayer lobby toggle described below.

## Runtime State & Integration

- **System entry point:** `initializeSystems` constructs `rubberBandingSystem` with
  `{ state, events, helpers, config }` and exposes it on the shared `systems`
  bundle. The core game loop calls `systems.rubberBandingSystem.evaluate(now, systems)`
  once per authoritative frame so tier detection stays deterministic.
- **State manager path:** all runtime data lives under `rubberBanding` to keep the
  category visible in snapshots and packets. The system maintains:
  - `rubberBanding.enabled` – boolean derived from config/session overrides.
  - `rubberBanding.profileId` – string id for the active profile.
  - `rubberBanding.activeTierId` – current tier identifier or `null` when disabled.
  - `rubberBanding.trailingTeamId` – `teamA`/`teamB` beneficiary for the active tier.
  - `rubberBanding.lastAnnouncedTierId` – most recent tier sent to the announcer.
  - `rubberBanding.lastDeficit` – latest absolute score deficit when evaluated.
  - `rubberBanding.lastEvaluationAt` – epoch ms used by clients/tests to confirm
    cadence.
- **Active bonuses:** every evaluation writes per-team modifier snapshots so downstream
  systems never guess which boosts apply. The shape is:
  - `rubberBanding.activeBonuses.teamA` / `.teamB` – objects containing
    `{ active, tierId, shotMultiplier, contestBonus, stealBonus, shoveBonus,
       blockBonus, reboundBonus, turnoverRelief, turboReserveBonus, probabilityCap }`.
    Non-beneficiary teams receive the neutral baseline `{ active: false,
    shotMultiplier: 1, contestBonus: 0, stealBonus: 0, shoveBonus: 0, … }`.
  - `rubberBanding.turboCapacity.teamA` / `.teamB` – resolved turbo ceilings in the
    `MAX_TURBO + bonus` domain. These mirror the active tier so UI and physics logic
    clamp to the same value.
- **Player mirrors:** whenever the turbo capacity changes, `evaluate()` updates each
  sprite’s `playerData.turboCapacity` and clips current turbo to the new limit. This
  keeps recharge logic, scoreboard rendering, and jump-ball weightings in sync across
  authority, coordinator, and clients without exposing new globals.
- **Turbo consumers:** helpers that drain, recharge, or render turbo must reference
  `playerData.turboCapacity` (not raw `MAX_TURBO`) when clamping values so rubber
  band boosts are reflected in gameplay and UI.
- **Gameplay consumers:**
  - `shooting-system.js` subtracts `contestBonus` from defender penalties before
    applying tier multipliers and probability caps.
  - `lib/game-logic/defense-actions.js` feeds `stealBonus` into both human and AI
    steal resolvers, keeping caps tier-aware.
  - `lib/game-logic/physical-play.js` adds `shoveBonus` to the shove success window,
    adjusting both the chance and cap per tier.
  - `lib/rendering/animation-system.js` adds `blockBonus` (converted to percentage)
    to the block success roll during shot animations.
- **Reason strings:** state mutations use explicit reasons such as
  `"rubber_band_enabled"`, `"rubber_band_tier_change"`, and
  `"rubber_band_disable"` for auditability.
- **Multiplayer packets:** the coordinator mirrors `rubberBanding.enabled` and
  `rubberBanding.activeTierId` into state snapshots (`rbEnabled`, `rbTier`) so
  prediction paths can respect the same boosts even if announcer cues stay
  client-side.
- **Event emissions:** tier changes publish `[RUBBER BAND]` logs and, when cues are
  enabled, call `announceEvent("rubber_band_tier", payload, systems)` with the
  trailing team name, deficit, profile id, and tier id.
- **System API:** gameplay modules consume a narrow surface so predictions and authority
  stay aligned:
  - `getActiveTier()` – returns `{ id, trailingTeamId, config, probabilityCap }` or `null`.
  - `getProbabilityCap(tierId)` – resolves caps defined in `probabilityCaps`.
  - `getTeamModifiers(teamId)` – merges the tier config with neutral defaults and scales
    probability caps into the 0–100 domain for shot math. Modifier objects expose
    `{ active, tierId, shotMultiplier, contestBonus, stealBonus, shoveBonus, blockBonus,
       reboundBonus, turnoverRelief, turboReserveBonus, probabilityCap }`.
  - `getTurboCapacity(teamId)` – returns the authoritative turbo ceiling (base + bonus).

## Multiplayer Options

The multiplayer lobby will gain a host-only toggle that maps to
`sessionOptions.rubberBanding.enabled` and optionally a profile selector. The
coordinator will persist those values inside the session state and broadcast them in
state packets so prediction paths honour the same configuration.

## Interaction With “On Fire”

Rubber band multipliers stack with the standard "on fire" bonuses, but the combined
shot probability is clamped via `probabilityCaps[tierId]`. The arcade-inspired profile
will likely allow 100% caps for extreme deficits (≥ 21 points), while lower tiers top
out around 95–98% to keep gameplay fair.

## Diagnostics and Logging

- State manager reason strings should include the tier (e.g.,
  `"rubber_band_tier_2"`).
- Structured logs should emit `[RUBBER BAND] tier=tier_2 deficit=8 profile=arcade_default`.
- Multiplayer packets may include `rbTier` and `rbEnabled` flags for debugging clients.

## Testing Expectations

- Add unit tests verifying tier selection across deficit/clock combinations.
- Include integration coverage ensuring boosts apply deterministically in shot,
  steal, block, rebound, and turnover flows.
- Provide a CLI harness that simulates score/time scenarios, returning the tier and
  applied modifiers for manual tuning.
