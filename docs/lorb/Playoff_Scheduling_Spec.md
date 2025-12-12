# Playoff Scheduling Spec (Option C: Availability-Based Auto-Scheduling)

This document defines the **v1 scheduling system** for LORB playoffs using **player availability**.  
Goal: maximize PvP playoff matches without negotiation loops, while ensuring brackets always complete via fallbacks.

This spec assumes the parallel-playoffs model:
- Season N+1 runs normally while Season N playoffs are active.
- Only **one** playoffs bracket can be active at a time (most recent completed season).
- Cosmetics/titles award immediately; gameplay meta-perks apply next season.

---

## 1. Principles

1. **No negotiation loops in v1**  
   There is no propose/accept/counter cycle. The system *auto-schedules* from availability overlap.

2. **Asynchronous-friendly**  
   Players may log in at different times; scheduling must not require back-and-forth messages.

3. **Soft force, never hard force**  
   When both players are online during a scheduled window, the game should *prompt strongly* to play, but allow a limited defer.

4. **Bracket must always complete**  
   If PvP can’t happen, matches fall back to ghost/sim per existing resolution rules.

---

## 2. Config Constants (put in game-mode-constants.js or equivalent)

Recommended defaults:

- `PLAYOFF_PVP_WINDOW_HOURS = 72`  
  PvP is prioritized during first 72 hours of a round’s matches.

- `PLAYOFF_HARD_DEADLINE_HOURS = 168`  
  After 7 days, unresolved matches must be auto-resolved (CPU sim).

- `PLAYOFF_SCHEDULE_BLOCK_MINUTES = 120`  
  Availability block size (2 hours).

- `PLAYOFF_GRACE_MINUTES = 20`  
  How long to wait after scheduled start for both players to show.

- `PLAYOFF_MAX_DEFERS_PER_MATCH_PER_PLAYER = 1`  
  Each player may defer the scheduled prompt once per match.

---

## 3. Data Model

### 3.1 Player Availability (Persistent)
Store a weekly set of 2-hour blocks, normalized to UTC.

**Conceptual:**
```js
PlayerAvailability = {
  playerId: string,
  tzOffsetMinutesAtSave: number, // optional, for audit
  blocks: [
    // each is a weekly block in UTC space
    // dayOfWeek: 0=Sun..6=Sat
    { dayOfWeek: number, startMinuteUTC: number, durationMinutes: 120 }
  ],
  updatedAt: number
}
```

Notes:
- `startMinuteUTC` is minutes since 00:00 UTC for that day (0..1439).
- Duration is fixed at 120 minutes in v1.

### 3.2 Match Scheduling Fields (Per Playoff Match)
```js
PlayoffMatch = {
  matchId: string,
  seasonId: number,
  round: number,
  playerA: string,
  playerB: string,

  // scheduling
  scheduledStartAtUTC: number | null,
  scheduledEndAtUTC: number | null, // scheduledStart + block
  scheduledBy: "auto" | "fallback" | null,
  graceEndsAtUTC: number | null, // scheduledStart + PLAYOFF_GRACE_MINUTES

  // enforcement / UX
  deferUsed: { [playerId: string]: boolean },

  // timing
  pvpWindowEndsAtUTC: number,
  hardDeadlineAtUTC: number,

  status: "pending" | "scheduled" | "in_progress" | "resolved"
}
```

---

## 4. Availability UX (Minimal v1)

Availability should be requested **only when it matters**:

Trigger:
- first time a player qualifies for playoffs, OR
- first time they open Playoffs menu

UI approach (keep simple):
- Offer a **preset picker** (fast) and optionally “custom blocks”.

### 4.1 Preset picker example
- Weeknights (6–10pm local)
- Weekend mornings (9–12 local)
- Weekend afternoons (12–5 local)
- Weekend nights (6–12 local)
- “Flexible next 24h” (optional flag)

Then allow “Custom” to pick up to N blocks.

### 4.2 Defaults (Important)
If player never configures availability, assign a default profile:
- Weeknights 7–11pm local
- Weekend 12–6pm local

This prevents zero-overlap situations.

---

## 5. Auto-Scheduling Algorithm

Auto-schedule occurs when a playoff match is created (or when the round starts).

### Inputs
- `playerAAvailability.blocks`
- `playerBAvailability.blocks`
- `nowUTC`
- `pvpWindowEndsAtUTC = nowUTC + PLAYOFF_PVP_WINDOW_HOURS`
- `hardDeadlineAtUTC = nowUTC + PLAYOFF_HARD_DEADLINE_HOURS`

### Steps
1. Compute candidate real-world time blocks for each player’s weekly blocks within the next `PLAYOFF_PVP_WINDOW_HOURS`.
2. Compute overlap windows between A and B candidates.
3. Choose the **earliest overlap** that:
   - starts after `nowUTC + 15 minutes` (optional buffer)
   - ends before `pvpWindowEndsAtUTC`
4. Set:
   - `scheduledStartAtUTC`
   - `scheduledEndAtUTC = scheduledStartAtUTC + PLAYOFF_SCHEDULE_BLOCK_MINUTES`
   - `graceEndsAtUTC = scheduledStartAtUTC + PLAYOFF_GRACE_MINUTES`
   - `status = "scheduled"`
   - `scheduledBy = "auto"`

### If no overlap exists
- Leave `scheduledStartAtUTC = null`
- Match remains `pending` and uses opportunistic PvP prompting when both online during PvP window.

---

## 6. Scheduled Match Enforcement (Soft Force)

When the system detects both players are online and:

- `nowUTC` is between `scheduledStartAtUTC` and `graceEndsAtUTC`

Then:

1. Show a strong prompt:
   “Your playoff match is scheduled now. Start the game?”
2. Default selection is **YES** after ~10 seconds.
3. Each player may choose “Defer” at most once per match:
   - If player defers and hasn’t used defer:
     - `deferUsed[playerId] = true`
     - Match remains scheduled.
   - If player already used defer:
     - Defer option is removed; only Start/Exit.

If both accept → start PvP.
If one accepts and one declines:
- Do **not** treat as forfeit.
- Continue trying during grace, and later fall back based on PvP window.

---

## 7. No-Show Handling

At `graceEndsAtUTC`:

### Case A: Both players online
- Start PvP immediately (prompt again if needed)

### Case B: Only one player online
- Do not instantly ghost (prevents abuse).
- After grace ends, allow ghost match if:
  - `nowUTC > pvpWindowEndsAtUTC` OR
  - player manually chooses “Play ghost match” (if your existing rules allow after a timeout)

Recommended v1: require pvp window expiry before ghost, unless you already have a shorter “ghost timeout”.

### Case C: Neither online
- Do nothing; match remains unresolved.
- Opportunistic PvP still possible during PvP window if they overlap later.

---

## 8. Fallback Resolution Integration

This spec does not replace fallback logic; it *improves PvP rate*.

Existing match resolution priority remains:

1. PvP if both present
2. Ghost if only one present (when eligible)
3. CPU sim if none present / hard deadline

### Hard deadline enforcement
At `hardDeadlineAtUTC`:
- Auto-resolve via CPU sim if match unresolved.

Champion detection should occur when final match resolves, even if CPU sim.

---

## 9. Notifications (Minimal)

On login, if a player has a scheduled playoff match within the next 24 hours:
- Display a banner:
  “Playoff match scheduled: TODAY 8–10pm (local).”

If they have a scheduled match currently within grace:
- Display:
  “Your playoff match is scheduled now!”

No need for email/push; BBS messaging is enough.

---

## 10. Minimal Implementation Checklist (For Copilot/Claude)

V1 tasks:

1. Add availability storage (preset + minimal custom)  
2. Add auto-schedule on match creation using overlap algorithm  
3. Add scheduled match fields + grace handling  
4. Prompt both players during scheduled grace window (soft force + defer token)  
5. Keep existing ghost/sim fallback logic; ensure hard deadline auto-sims  
6. Ensure champ + cosmetic rewards apply immediately on finals resolution

**Non-goals for v1:**
- no negotiation UI
- no replay viewer
- no highlight show
- no complex calendar tooling

---

**End of File**
