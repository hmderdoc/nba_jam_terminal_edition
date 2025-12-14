# End Game Implementation Priorities (Legend of the Red Bull)

This document tells the coding agent (Copilot/Claude) **what to do first** and what to ignore for now.

Focus: implement a **working parallel playoffs system** with minimal complexity.

---

## 1. Phase 1 – Core Functionality (V1 MUST-HAVES)

Implement these first, in roughly this order:

### 1.1 Season State & Transition

- Add a simple concept of `seasonId` and `seasonStatus`:
  - `"active"`, `"completed_regular"`, `"playoffs_active"`, `"archived"` (names flexible).
- When regular season conditions are met (whatever the game currently considers “end of season”):
  - Mark the current season as `completed_regular`.
  - Increment `seasonId` and start a **new season**.

### 1.2 Playoff Bracket Creation

- When Season N ends:
  - Generate a **playoff bracket** from the final standings / rankings.
  - Store enough info to know:
    - Which players are in the bracket.
    - Who they face in Round 1.
    - What the next rounds would be.

- Create a **PlayoffBracket** structure tied to Season N (conceptual only; can be JSON or whatever is already used in the project).

### 1.3 PlayerSeasonSnapshots

- When Season N ends:
  - For each player in the playoffs, create a **snapshot** of their roster/stats as of end-of-season.
  - Playoff games should use this frozen snapshot, not the evolving Season N+1 build.

### 1.4 Match Resolution Paths

Implement minimal logic for resolving playoff matches:

1. Check if both players are online → allow a real-time PvP match using Season N snapshots.
2. If only one player is present during a “playoff attempt”:
   - Run a **ghost match** (human vs AI for opponent snapshot).
3. If the match has not been played for a while (or when an admin resolves it):
   - Run a **CPU sim** using the two snapshots and store the winner + score.

For v1:
- You **do not** need sophisticated time windows or countdowns.
- You **do not** need full event logs or replay playback.
- Just make sure every match can eventually produce:
  - a winner
  - a final score

### 1.5 Simple UI Hooks

- Add a small piece of UI so that:
  - If the player is in an active playoff bracket:
    - They can see they have a scheduled playoff match.
    - They can choose to play it **separately** from their normal season matches.

- This can be as simple as:
  - A menu option: “Play Season N Playoff Match (if available)”
  - A text status: “You were eliminated from Season N playoffs” or “You are in the semifinals.”

---

## 2. Phase 2 – Quality of Life (V1.5 NICE-TO-HAVES)

Once Phase 1 is solid and tested:

### 2.1 Basic Bracket Display

- Implement a simple ASCII bracket or even just a list:
  - Quarterfinal / Semifinal / Final
  - Matchups and winners.

- It doesn’t have to be fancy; just readable.

### 2.2 Basic Game Summaries

- Store a minimal “summary” per playoff match:
  - Winner name
  - Loser name
  - Final score
  - Match mode: `"pvp" | "ghost" | "sim"`

- Display those summaries when inspecting the bracket or a “Playoff History” menu.

---

## 3. Phase 3 – Future (V2 FEATURE BACKLOG)

Do **not** implement these until everything above is working and stable:

### 3.1 Replay System

- Per-match event logs
- Ability to play back matches after the fact
- Stepping through “ticks” and highlights

### 3.2 Sports Highlight Show

- “TV show” style highlight reels using event logs
- Daily / round-based recap segments

### 3.3 Automated Newsfeed Integration

- Auto-generated articles describing big upsets, buzzer-beaters, etc.

### 3.4 Multi-Season Archive Browser

- Browsing past seasons, past playoffs, full history.

---

## 4. Key Notes for Coding Agent

- Do **not** overbuild the timing system.
- Do **not** block normal season gameplay because of playoffs.
- Do **not** try to invent a complex tournament admin toolset in v1.
- Do **focus** on:
  - Simple season transition.
  - Playoff bracket tied to the previous season.
  - Match resolution (PvP / ghost / sim) that always produces a winner.

**End of File**