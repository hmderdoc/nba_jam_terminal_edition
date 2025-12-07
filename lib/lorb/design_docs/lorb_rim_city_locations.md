# Legend of the Red Bull — Rim City Locations & Menus

## 1. Purpose

This document defines the **Rim City locations** that appear in the main menu after character creation and describes what each location does, which resources it consumes, and how it ties into the broader game loop.

It is a companion to the **Core Game Loop Overview** document.

---

## 2. Rim City Main Menu (v1)

For the initial version of Legend of the Red Bull, the recommended main menu entries are:

1. **Hit the Streetball Courts** — core PvE / “Forest” equivalent  
2. **Go to Club 23 (Sports Bar)** — rest, rumors, betting  
3. **Visit the Gym / Trainer** — heal and increase stats  
4. **Visit the Gear Shop** — buy items and equipment  
5. **Check Tournaments / Ladder** — optional / future expansion  
6. **View Stats & Records** — inspect your character  
7. **Call it a Night / Quit** — end the day and save

The following sections describe each location in more detail.

---

## 3. Hit the Streetball Courts (Core PvE)

### Role

- Primary analogue to **LoRD’s Forest**.  
- Main source of **cash, rep, and progression**.  
- Drives the narrative through street encounters.

### Resources

- Consumes: `street_turns` (usually 1 per visit).  
- May also impact:
  - `stamina` (fatigue)
  - `injuries` (chance to gain new injury entries)

### Typical Flow (Behavior)

1. Check if `street_turns > 0`.  
   - If not, inform player and return to main menu.

2. Decrement `street_turns`.

3. Roll on a **Street Event Table**:
   - Common: pickup game vs CPU team.
   - Less common: non-battle event (hustler, sponsor, fan, omen, etc.).

4. If **pickup game**:
   - Build player team roster from `PlayerState.stats` and current team rules.
   - Choose a CPU team from a library (could depend on rep, day_index, flags).
   - Construct `rosters` and `options`.
   - Call into the battle engine adapter (pseudocode):

     ```js
     // Conceptual: actual call may be NBAJam.runLorbBattle or via an adapter
     const gameResult = BattleEngine.runLorbBattle(rosters, options);
     ```

   - Pass `gameResult` into rewards logic to update:
     - `cash`
     - `rep`
     - flags and injuries
   - Print a short summary to the player.

5. If **non-battle event**:
   - Use LoRB event system (INI or JS-based) to:
     - Present choices.
     - Apply small rewards or penalties.

### AI Implementation Notes

- Keep `handleStreetballEncounter(player)` self-contained:
  - No direct main-menu logic.
  - It should assume it has already consumed a turn.
- The event table can be data-driven (INI/JSON), so new encounters do not require code changes.

---

## 4. Club 23 (Sports Bar)

### Role

- Combines parts of LoRD’s **Inn** and **Tavern** plus gambling.  
- A place to **rest**, get **rumors**, and **bet** on CPU vs CPU games.

### Resources

- Consumes: 
  - Optionally `bar_actions` per activity (e.g., 1 per Rest, 1 per Rumor, etc.).
- Affects:
  - `stamina` (rest)
  - `cash` (bets and bar fees)
  - `flags` (rumors/quests)

### Menu Structure (Example)

When player chooses Club 23:

1. **Rest & Recover**
   - Restores `stamina` or partially clears fatigue/injury penalties.
   - May cost a small cash fee.

2. **Listen for Rumors**
   - Shows in-world hints:
     - Where tournaments occur.
     - How to unlock certain events or Red Bull encounters.
   - May set flags used later by the Courts or Tournaments.

3. **Watch a CPU vs CPU Game (Gamble)**
   - Player selects or is presented with a matchup between CPU teams.
   - Chooses a team to bet on and a wager amount.
   - The engine simulates a game between CPU teams only.
   - Payout determined by simple odds function and bet amount.

4. **Talk to the Bartender**
   - One-off or chain events:
     - Special quests.
     - Sponsor introductions.
     - Hints about the Red Bull.

### AI Implementation Notes

- Club 23 logic can live in a single handler, e.g. `handleClub23(player)`.
- Gambling should never be **mandatory** for progression; it is a side path for risk-tolerant players.
- Rumor text can be static or keyed off flags and `day_index`.

---

## 5. Gym / Trainer

### Role

- Merges **healing** and **stat progression** into a single location.  
- Directly converts **cash → long-term power**.

### Resources

- Consumes:
  - `gym_sessions` (e.g., 3 per day).
  - `cash` for each upgrade or healing action.
- Affects:
  - `stats.*`
  - `injuries`
  - Possibly small `rep` gains if flavor makes sense.

### Actions

1. **Raise a Stat**
   - Player picks one of the main stats:
     - speed, three, power, steal, block, dunk
   - Cost is a function of current value:
     - Example: `cost = base + (current_stat * factor)`
   - If player has enough `cash` and available `gym_sessions`:
     - Deduct `cash`.
     - Increment chosen stat.
     - Decrement `gym_sessions`.

2. **Heal Injuries**
   - Cost proportional to number or severity of injuries.
   - Clears or reduces entries in `injuries`.

3. **Special Training (Optional / Archetype-Based)**
   - Slasher gets a Dunk-focused camp.
   - Sniper gets a shooting clinic.
   - Underdog gets discounted “grind” sessions.

### AI Implementation Notes

- Keep upgrade logic centralized so costs are consistent:
  - e.g., a `TrainingCostCalculator` or `computeTrainingCost(statName, currentValue)`.
- The Gym is the primary place player stats should be modified outside of rare event rewards.

---

## 6. Gear Shop

### Role

- LoRD “Shop” equivalent for LoRB.  
- Offers items that tweak stats or provide temporary buffs.

### Resources

- Consumes:
  - `cash` to buy items.
- Affects:
  - `player.items`
  - `player.stats` if items have persistent modifiers.

### Item Types

Simplified for v1:

1. **Sneakers (Equipment Slot)**
   - Persistent modifiers, one active pair at a time.
   - Examples:
     - “Rim City Grinders” → `+1 speed`, `-1 three`
     - “Old School High-Tops” → `+1 block`, `-1 speed`

2. **Energy Drinks (Consumables)**
   - One-time effects, often for the next day or next few games.
   - Examples:
     - “Red Bull Classic” → `+1 speed` next Streetball encounter.
     - “Mystery Mix” → random effect.

3. **Accessories**
   - Wristbands, knee braces, headbands, etc.
   - Small, mostly permanent tweaks:
     - Minor rep boost.
     - Reduced injury chance.
     - Small stat bumps.

### AI Implementation Notes

- The item system does not need to be fully general in v1.
- You can model items as records with:
  - `id`, `name`, `type`, `cost`, and `mods` (e.g. `{speed:+1, three:-1}`).
- A simple inventory array on `player` is sufficient:
  - Equip/unequip logic can be as simple as “one sneaker, multiple accessories.”

---

## 7. Tournaments / Ladder (Optional / Future)

### Role

- Medium- to long-term challenge beyond one-off street encounters.  
- Analogue to LoRD’s **Fields** (PvP / ranked combat).

### Resources

- Consumes:
  - Some number of `street_turns` or its own `tournament_tokens` if desired.
- Affects:
  - `rep` heavily.
  - `cash` payouts.
  - Possible unlocks (gear, locations, Red Bull encounters).

### Behavior (Conceptual)

1. Player selects a **tournament tier** or ladder rung.
2. A sequence of 1–N games is simulated:
   - All via the NBA Jam engine adapter.
3. The player’s overall record in the sequence determines:
   - Cash payout.
   - Rep gain.
   - Possible special rewards.

### AI Implementation Notes

- Tournaments can initially be **CPU-only** (no real PvP).
- Later, tournament entries can reference other players’ builds, using:
  - Stored team snapshots.
  - Asynchronous “ghost” matches.

It is acceptable in early versions to stub out tournaments or mark them as “Coming Soon.”

---

## 8. View Stats & Records

### Role

- Non-mutating inspection of player data.  
- Equivalent to a character sheet.

### Content

- Core stats:
  - Archetype, background.
  - speed, three, power, steal, block, dunk.
- Economy:
  - cash, rep.
- History:
  - total games played.
  - win/loss record.
  - highest score in a single game.
  - notable achievements (e.g., “Posterized a Legend”).

### AI Implementation Notes

- This menu item is mainly about formatting and ANSI styling.
- No game logic should live here; it should only read from `PlayerState`.

---

## 9. Call it a Night / Quit

### Role

- Ends the current in-game day.  
- Equivalent to leaving LoRD’s hub and logging out.

### Behavior

- Optional: show a **day summary**:
  - Cash gained/lost.
  - Rep change.
  - Stat changes (if any).
- Save `PlayerState`.
- Return control to BBS / exit script.

---

## 10. v1 vs. Future Features

To keep the initial implementation focused:

- **v1 Core:**
  - Courts (Streetball encounters)
  - Club 23 (basic rest + simple rumors, optional simple gambling)
  - Gym (stat training + basic healing)
  - Gear Shop (small set of items)
  - Stats/Records screen
  - Quit/End-of-day

- **v1.5 and beyond:**
  - Deeper tournaments / ladder system.
  - Advanced gear customization (Sneaker Customizer as a separate location).
  - More complex gambling options.
  - Social / “Locker Room” view of other players and rankings.

By keeping features modular, AI coding agents can safely build and extend individual locations without modifying the core game loop every time.
