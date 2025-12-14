# Parallel Playoffs Spec (LORB)

## 1. Purpose

This document defines a *simpler* end-game system for Legend of the Red Bull:

- **Do NOT pause the game world** for playoffs.
- When **Season N** ends:
  - Immediately start **Season N+1** (new regular season).
  - Also start **Season N Playoffs** in parallel.
- Only **one playoffs bracket** can be active at a time (for the most recently completed season).
- Keep v1 focused on *basic playoffs that complete reliably*.
- Clearly separate **v1 features** from **v2+ nice-to-haves** (like full replays, highlight show, etc.)

---

## 2. Core Design Decisions (Non-Negotiable)

1. **How many historical playoffs can be active at once?**  
   → Exactly **one**: the playoffs for the most recently completed season.

2. **Prize timing:**
   - **Cosmetic/title rewards** (trophies, banners, profile flair) are **immediate** when a player wins.
   - Any **gameplay-affecting meta perks** (e.g., small permanent bonuses) only apply **starting next season**, not retroactively in the current one.

3. **No hard “season pause”**  
   - Regular season play should never get locked or blocked because playoffs are running.

---

## 3. High-Level Behavior

### 3.1 When a Season Ends

When Season N regular season finishes:

1. Mark **Season N** as `completed_regular`.
2. Generate the **Season N playoff bracket** based on that season’s standings.
3. Create a **PlayoffBracket** entity for Season N.
4. Immediately start **Season N+1** as the new “current season”.

Result:  
- Players can keep playing the game normally (Season N+1).
- Qualified players can also play **Season N playoffs matches** as a separate flow.

---

## 4. Data Concepts (Conceptual, not strict schemas)

These don’t need to be fully modeled as separate tables/files if that’s overkill, but the *concepts* should exist in code.

### 4.1 Season

Fields (conceptual):

- `id` (e.g., 1, 2, 3…)
- `status`: `"active" | "completed_regular" | "playoffs_active" | "archived"`
- `startDate`
- `endDate` (for regular season)
- `playoffBracketId` (if any)

### 4.2 PlayoffBracket

- `id`
- `seasonId`
- `status`: `"active" | "completed"`
- `matches[]` – minimal list of rounds / pairings
- `winnerPlayerId` (after completion)

### 4.3 PlayerSeasonSnapshot

- `playerId`
- `seasonId`
- **Frozen roster/stats** as they were at the end of Season N regular season.

**Important:**  
Playoff games should use **Season N snapshots**, not the evolving Season N+1 build.

---

## 5. Player Experience

### 5.1 On Login (If no playoffs active)

Player sees normal **current season** menu only.

### 5.2 On Login (If playoffs active AND player qualified)

Player sees something like:

- “Season N Playoffs are in progress.”
- If they have an open playoff match:
  - “You have an active Season N playoff game ready.”

Menu example:

- `[1] Continue Season N+1 (regular play)`
- `[2] Play Season N Playoff Match` (only if applicable)
- `[3] View Season N Playoff Bracket` (if curious)

Players **never lose access** to normal daily activity (streetball, romance, gym, etc.) because of playoffs.

---

## 6. Match Resolution Logic (v1)

We keep the same general resolution priority, but focus on reliability over bells & whistles.

### 6.1 Priority Order

For each playoff match:

1. **Real-Time PvP** (if both players online at the same time)
2. **Ghost Match** (one human vs AI-controlled opponent roster)
3. **CPU Sim** (fully automated sim if no human plays)

Important:  
- **No “forfeit wins”** just for not logging in.  
- If nobody plays, the match **must still be simulated** using both Season N snapshots.

### 6.2 Time / Deadlines (Simplified)

v1 doesn’t need hyper-precise real-world deadlines.

Simplest version:

- When a playoff round is created:
  - Give each match a **soft target window** (e.g., a few days).
  - If a match hasn’t been manually played by then:
    - Run a CPU sim to resolve it.

We don’t need per-round UI timers or big countdowns in v1.

---

## 7. Rewards

When **Season N Playoffs** conclude:

- Mark `PlayoffBracket.status = "completed"`.
- Update `Season N.status = "archived"` (or similar).
- Award:
  - **Cosmetic/title rewards** to finalists/champion → effective immediately.
  - **Meta gameplay perks** (if implemented) → flagged to apply at the **next season reset**, not mid-season.

---

## 8. V1 vs V2 Features

### 8.1 V1 – MUST HAVE

These are the only things that need to be implemented **now** for parallel playoffs:

1. When Season N ends:
   - Start Season N+1 immediately.
   - Generate Season N playoff bracket.
2. Only one playoffs bracket active at a time (the latest season).
3. Basic bracket structure (4/8/16 players).
4. Playoff matches can resolve as:
   - PvP when both players are present
   - Ghost match when one present
   - CPU sim when none present
5. Minimal UI for:
   - Seeing you’re in the playoffs
   - Playing your playoff match
   - Viewing a simple bracket or at least your next opponent.
6. Cosmetics/titles granted right when the bracket ends.
7. Meta perks (if any) applied only on **future season start**, not immediately.

No replay UI required. No highlight TV show required. No rich bracket art required.

---

### 8.2 V1.5 – NICE TO HAVE (Optional)

If time permits but **not required**:

- A simple bracket view (ASCII).
- A “Playoff History” list showing past champions.
- Basic text summary of each playoff game (winner, score).

---

### 8.3 V2 – FUTURE

Do **NOT** implement these yet unless everything else is rock-solid:

- Full event log for each match.
- Replay viewer system (step through game events).
- Sports highlight show / “TV broadcast” format.
- Newsfeed integration with auto-generated narratives.
- Multi-season playoff archive browser.

---

## 9. Implementation Notes for Copilot/Claude

- Stay focused on:
  - **Season transition** (Season N → N+1).
  - **Playoff bracket creation and basic match resolution.**
- Use *existing* game engines for:
  - PvP match
  - AI vs AI sim
- Do not introduce complex timing systems or advanced scheduler UIs in v1.
- Keep things as simple as possible while satisfying the parallel playoffs behavior above.

## 9. Additional Considerations / Clarifications

### 9.1 Bracket Size & Byes

Bracket sizes supported: **2, 4, 8, 16**.

Let Q = number of qualifying players after Season N ends:

- Q <= 1 → no playoffs (or auto-champion, to be decided separately).
- Q == 2 → direct finals (2-player bracket).
- 3 <= Q <= 4 → 4-player bracket.
- 5 <= Q <= 8 → 8-player bracket.
- 9 <= Q <= 16 → 16-player bracket (trim to top 16 if Q > 16).

If Q is not a power of 2 within the chosen bracket size, highest seeds receive BYEs into the next round. BYEs are represented as matches with one empty side and auto-advancement of the higher seed.

Tie-breaking for standings should be:

1. Better season record / score (whatever the core metric is).
2. Higher reputation (if tracked).
3. Random tiebreak as a last resort.

### 9.2 Soft Deadline Configuration

Introduce configuration constants (names flexible) instead of magic numbers:

- `PLAYOFF_ROUND_SOFT_DEADLINE_HOURS = 72`
- `PLAYOFF_ROUND_HARD_DEADLINE_HOURS = 168`

Soft deadline: after this, unresolved matches are eligible for CPU sim.  
Hard deadline: after this, unresolved matches **must** be auto-resolved.

### 9.3 Snapshot Content

A `PlayerSeasonSnapshot` should freeze only gameplay-relevant data:

- Core stats (speed, power, three, dunk, steal, block, stamina, etc.).
- Equipped gear affecting gameplay.
- Active perks/meta modifiers.
- Current companion and their relevant stats.

Do **not** freeze romance, cosmetics, or currency.

### 9.4 Concurrent Access (Season + Playoffs in Same Session)

A single session can play:

- Normal Season N+1 matches; and
- Season N playoff matches (if qualified).

The main menu should allow both paths. Internally, playoff matches use the Season N snapshot; current season games use the live build.

### 9.5 Champion Detection & Rewards

All match resolutions (PvP, ghost, CPU sim) must flow through a shared “finalize playoff match” path that:

1. Stores the result and score.
2. Checks if this was the last unresolved match in the final round.
3. If so:
   - Marks the bracket as completed.
   - Identifies and stores `championPlayerId`.
   - Immediately applies cosmetic/title rewards.
   - Flags any gameplay-affecting meta perks to be applied at the **next season reset**, not mid-season.
**End of File**