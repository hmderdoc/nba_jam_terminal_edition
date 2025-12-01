# Legend of the Red Bull — Core Game Loop Overview

## 1. Purpose

This document defines what happens **after character creation** in Legend of the Red Bull (LoRB):

- How a **“day”** in Rim City works.
- What the **main menu loop** looks like.
- Which parts of the player state are mutated.
- How to conceptually call into the **NBA Jam battle engine** from the LoRB loop.

This file is intended to guide both human developers and AI coding agents.  
All code below is **pseudocode** unless otherwise stated.

---

## 2. Player State After Character Creation

In addition to the character fields defined in the character-creation design (name, archetype, background, stats, cash, rep, flags), the game loop expects several **day-level fields** on the player context.

Suggested shape (language-agnostic):

```js
PlayerState {
  id: number                // BBS user id
  name: string              // display name / handle

  archetype: string         // "slasher", "sniper", etc.
  background: string        // "streetball", "sponsored", etc.

  stats: {
    speed: number
    three: number
    power: number
    steal: number
    block: number
    dunk: number
  }

  cash: number              // money used for training, items, gambling
  rep: number               // reputation / prestige

  flags: {                  // boolean or small key-value flags
    sponsored_ads?: boolean
    streetball_prodigy?: boolean
    // etc.
  }

  // Daily runtime fields:
  street_turns: number      // “Forest” equivalent — main grinding actions
  gym_sessions: number      // how many training actions per day
  bar_actions: number       // how much you can do at Club 23 (optional)
  stamina: number           // simple fatigue / HP concept (optional)
  injuries: Injury[]        // collection of debuffs (optional)
  day_index: number         // how many in-game days this character has played
}
```

The exact structure in SpiderMonkey / your save files can differ, but this is the **conceptual contract**: these are the knobs the game loop is supposed to touch or update.

---

## 3. Daily Structure

A “day” in LoRB is the atomic play session, analogous to a day’s worth of forest fights + inn visit in LoRD.

High-level steps:

1. **Load or create player**
   - If no save → run character creation → produce `PlayerState`.
   - If save exists → load `PlayerState`.

2. **Reset daily resources (if new day)**
   - Reset `street_turns`, `gym_sessions`, `bar_actions`, and optionally `stamina`.
   - Increment `day_index` if appropriate.

3. **Enter Rim City main menu**
   - Player chooses where to go: Courts, Bar, Gym, Shop, etc.
   - Each choice may consume daily resources and mutate player state.

4. **Repeat menu until:**
   - Player chooses “Call it a night / Quit”  
   **or**
   - Player has no meaningful actions left (out of street turns, gym sessions, etc.).

5. **Save player state and exit**

---

## 4. Rim City Main Menu (Conceptual)

The Rim City main menu is the post-character-creation “home” screen.  
For v1, the recommended options are:

1. **Hit the Streetball Courts**  
   - LoRD “Forest” equivalent.  
   - Core cash/rep grinding and narrative events.

2. **Go to Club 23 (Sports Bar)**  
   - LoRD “Inn” + “Tavern” compressed.  
   - Rest, rumors, and CPU vs CPU gambling.

3. **Visit the Gym / Trainer**  
   - LoRD “Healer” + “Trainer” merged.  
   - Spend cash to improve stats, heal injuries.

4. **Visit the Gear Shop**  
   - LoRD “Shop” equivalent.  
   - Buy sneakers, energy drinks, and simple stat-modifying items.

5. **Check Tournaments / Ladder** (optional / future)  
   - LoRD “Fields” equivalent.  
   - Structured multi-game challenges; can start CPU-only.

6. **View Stats & Records**  
   - Inspect character, stats, records, notable achievements.

7. **Call it a Night / Quit**  
   - End-of-day summary (optional), then save & exit.

Not all options must be implemented at once; it is acceptable to stub Tournaments or advanced Gear features while the core loop (Courts, Bar, Gym, simple Shop) is being implemented.

---

## 5. Pseudocode Warning

> **Important:**  
> All pseudocode below is *conceptual* and **does not guarantee exact function names or namespaces**.  
> For example, the real battle engine may be exposed as:
>
> ```js
> NBAJam.runLorbBattle(rosters, options)
> ```
>
> or under another adapter namespace.  
> Implementations must adapt the pseudocode to the actual signatures and module structure that exists in the codebase.

When in doubt, **prefer the real code** and treat this document as a behavioral reference.

---

## 6. Core Game-Day Loop (Pseudocode)

This pseudocode is meant to describe **behavior and responsibilities**, not exact implementation details.

```js
function runGameDay(player: PlayerState) {
  // 1. Reset daily resources if needed (e.g. if real-world day changed)
  resetDailyIfNeeded(player); // sets street_turns, gym_sessions, etc.

  let done = false;

  while (!done) {
    showMainMenu(player); // prints Rim City options

    const choice = getMenuChoice();  // user input from console

    switch (choice) {
      case "COURTS":
        if (player.street_turns > 0) {
          player.street_turns--;
          handleStreetballEncounter(player);  // see section 7
        } else {
          showMessage("You’re too wiped to hit the courts today.");
        }
        break;

      case "BAR":
        handleClub23(player);  // see Rim City Locations doc
        break;

      case "GYM":
        if (player.gym_sessions > 0) {
          handleGymTraining(player);
        } else {
          showMessage("Coach says you’ve done enough for one day.");
        }
        break;

      case "SHOP":
        handleGearShop(player);
        break;

      case "TOURNAMENTS":
        handleTournaments(player);  // may be stubbed in early versions
        break;

      case "STATS":
        showPlayerStats(player);
        break;

      case "QUIT":
        done = true;
        break;
    }

    // Optional: auto-end day if absolutely nothing is left to do.
    if (!done && noActionsRemaining(player)) {
      showMessage("You’ve done all you can today in Rim City.");
      done = true;
    }
  }

  savePlayerState(player);
}
```

**Key responsibilities:**

- The main loop itself **does not implement** battles, training, or gambling.
- It delegates to helper functions / modules:
  - `handleStreetballEncounter`
  - `handleClub23`
  - `handleGymTraining`
  - `handleGearShop`
  - `handleTournaments`
- These helpers live in other files / namespaces and contain domain logic.

---

## 7. Streetball Courts (Core PvE Loop) — Behavior

The Courts are the LoRB equivalent of LoRD’s **Forest**: the primary grinding location.

High-level behavior of `handleStreetballEncounter(player)`:

1. Choose a **street event**:
   - Common case: pickup game vs a CPU team.
   - Less common: non-game narrative events (hustler, fan, sponsor, omen, etc.).

2. If it’s a **pickup game**:
   - Build `rosters` object for the engine:
     - Player’s team from their stats and/or chosen teammates.
     - CPU team chosen from a library of teams.
   - Build `options` (seed, pace, possessions, etc.).
   - Call into the NBA Jam engine (pseudocode):

     ```js
     const gameResult = NBAJam.runLorbBattle(rosters, options);
     ```

     > Note: actual signature may differ; see the real engine adapter.

   - Pass `gameResult` into the rewards logic:
     - Update `player.cash`, `player.rep`, stat progression flags, injuries, etc.
   - Print a short summary (score, winner, maybe MVP and a couple box-score lines).

3. If it’s a **non-game event**:
   - Use the LoRB event system (e.g., INI-defined events) to:
     - Modify `cash`, `rep`, or flags.
     - Present choices to the player.

This function is the main consumer of **daily street turns** and the primary driver of progression.

---

## 8. Integration With the NBA Jam Engine

The LoRB loop should not care about the internals of the engine.  
It only needs a **single integration point**, typically via an adapter.

Conceptual contract:

```js
// Pseudo-interface for the LoRB battle engine adapter
GameResult runLorbBattle(Rosters rosters, BattleOptions options);
```

Where:

- `Rosters` describes:
  - `home` team: players, stats, team name
  - `away` team: players, stats, team name
- `BattleOptions` describes:
  - `seed`: RNG seed for reproducibility
  - `possessions`: approximate length
  - `pace`: any other tuning values
- `GameResult` returns:
  - `score.home`, `score.away`
  - `winnerTeam` (name/id)
  - `boxScore` (per-player stats)
  - `mvpPlayerId` (optional)

The **actual types and field names** should follow whatever your `nba_jam_mock.js` and real NBA Jam engine already return. The important thing for AI tools is:

- LoRB calls a single adapter method with **rosters + options**.
- It receives a **game result** object.
- It then uses **separate reward logic** to turn that into cash/rep/stat changes.

---

## 9. Implementation Notes for AI Tools

For coding agents and Copilot:

- Treat this document as a **behavioral spec**, not a source of exact function names.
- When generating code, prefer:
  - Existing namespaces (`LORB.*`, `NBAJam.*`, etc.) over inventing new ones.
  - Small, single-responsibility functions (e.g., one per location).
- If the pseudocode function names conflict with existing ones:
  - Preserve existing working code.
  - Wrap or adapt existing functions rather than replacing them outright.
- Use this pattern:
  - `runGameDay(player)` → central loop
  - `handleStreetballEncounter(player)` → courts
  - `handleClub23(player)` → bar
  - `handleGymTraining(player)` → gym
  - `handleGearShop(player)` → shop
  - `handleTournaments(player)` → ladder/tournaments (optional)

The goal is to keep the **entry point small** and to keep logic split into easily-reasoned modules, so the system remains maintainable as features accrete.
