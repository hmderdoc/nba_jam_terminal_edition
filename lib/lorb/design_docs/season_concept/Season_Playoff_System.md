# Season Playoff System (Legend of the Red Bull)

This document defines the complete **Season → Playoffs → Finals → Jordan Challenge** loop for *Legend of the Red Bull* (LoRB).  
It replaces LORD’s “kill the dragon → world resets” mechanic with a basketball-themed, skill-based, fair, and repeatable season cycle.

This system is designed to work **immediately** using CPU-vs-CPU simulations, and later support optional **scheduled multiplayer matches** if/when multiplayer becomes available.

---

# 1. Overview

A full “season” in LoRB consists of:

1. **Regular Season** (leveling, battles, stat growth, rep accumulation)  
2. **Playoff Qualification** (top players by REP SCORE)  
3. **Playoff Bracket** (CPU-sim or scheduled matches)  
4. **Finals** (determine the Season Champion)  
5. **Jordan Challenge** (Champion faces Michael Jordan)  
6. **Season Reset** (world wipe + meta progression)

The reset only occurs **after** the final Jordan battle, making it fair and narratively meaningful — a full season has been completed.

---

# 2. Regular Season

The season lasts a configurable number of in-game days:

- `30` days (default)  
- `60` days (optional)  
- `90` days (extended season)

One real-world day = one game day (unless sysop modifies pace).

During the regular season, players:

- Gain money  
- Improve stats (gym, items, companions)  
- Battle opponents (streetball courts, club events, random encounters)  
- Build **REP SCORE**  
- Unlock companions and skills  
- Move through cities via the City Rotation System  

There is **no endgame pressure** during the season — it is a growth period.

---

# 3. REP SCORE (Playoff Seeding Metric)

REP SCORE determines:

- Who qualifies for Playoffs  
- Seeding order  
- Tie-breaking  

### 3.1 Suggested REP SCORE formula

This is tunable, but a good starting point:

```text
repScore =
  (reputation * 3)
+ (wins * 2)
+ (bossVictories * 10)
+ (rareEncounters * 5)
+ (streakBonus)
+ (companionSynergyBonus)
```

Where:

- `reputation` = player’s current rep stat  
- `wins` = total PvE + PvP wins this season  
- `bossVictories` = mini-boss or rare-encounter wins  
- `rareEncounters` = how many special events they’ve seen  
- `streakBonus` = small reward for win streaks  
- `companionSynergyBonus` = special combos with certain companions  

**Key property:** REP SCORE rewards both *activity* and *performance*.

---

# 4. Playoff Qualification

At the end of the current season:

1. Compute `repScore` for all active players.  
2. Sort descending.  
3. Select the **top 8** players as playoff participants.

If there are **fewer than 8 humans**, the remaining slots are filled with **ghost players** (see Section 8).

### 4.1 Seeding

Seeds are assigned purely by `repScore`:

```text
Seed 1: Highest REP SCORE  
Seed 2: Next highest  
…  
Seed 8: Lowest qualified
```

The bracket is:

```text
Quarterfinals:
  Match 1: Seed 1 vs Seed 8
  Match 2: Seed 4 vs Seed 5
  Match 3: Seed 3 vs Seed 6
  Match 4: Seed 2 vs Seed 7
```

Winners move to semifinals, then to finals.

---

# 5. Playoff Bracket Format

A standard **single-elimination** bracket:

1. **Quarterfinals** → 4 matches  
2. **Semifinals** → 2 matches  
3. **Finals** → 1 match  

Each match is one **NBA Jam engine battle**, for example:

```js
// PSEUDOCODE: adapt to real LoRB engine
const result = NBAJam.runPlayoffBattle(playerA, playerB);
// result: { winnerId, loserId, boxScore, highlightData }
```

### 5.1 Simulation-Only Mode (works today)

Until real-time multiplayer exists:

- All playoff matches run as CPU simulations.
- Player’s **stats, gear, companions, and buffs** are used as inputs.
- AI behavior can be:
  - Basic (random but weighted)
  - Archetype-based (shooter / slasher / defender)
  - Companion-influenced

This lets you fully implement seasons **right now**.

---

# 6. Finals → Season Champion

After quarterfinals and semifinals:

- The final match is played:
  ```js
  const finalsResult = NBAJam.runPlayoffBattle(seedX, seedY);
  const champion = getPlayerById(finalsResult.winnerId);
  ```
- That player becomes the **Season Champion**.

System broadcasts a global message:

> “🏆 SEASON CHAMPION: [PlayerName] has conquered the LoRB Playoffs!”

The Champion then earns the right to face **Michael Jordan**.

---

# 7. Jordan Challenge (The Red Bull)

Once a Season Champion is determined, they unlock the:

# **JORDAN CHALLENGE**

Michael Jordan (The Red Bull) is the **mythic apex boss**. This fight is intentionally brutal.

### 7.1 Jordan’s Role

- Final test of the season.  
- A high-stakes, high-difficulty match.  
- Thematically: you’re facing a basketball demigod.

### 7.2 Battle Rules

- Single match using the same engine:
  ```js
  const jordanResult = NBAJam.runPlayoffBattle(champion, JordanBoss);
  ```
- No rematch this season.
- No special “do-overs” without sysop intervention.

### 7.3 Outcomes

#### If Champion **loses**:
- Season still ends.
- Jordan remains undefeated in the record.
- Champion still gets “Season Champion” status, but **not** “Bull-Slayer”.

#### If Champion **wins**:
- They gain:
  - “Bull-Slayer” title.
  - Entry in Hall of Fame as “Jordan Conqueror”.
  - Meta perks for next season (see Section 9).
- Season ends with a lore flourish:
  > “The Red Bull has fallen. Time loops, and a new generation rises…”

---

# 8. Ghost Players (CPU Stand-ins)

To ensure playoffs always run, even on a small BBS:

### 8.1 When to use ghosts

- If fewer than 8 human players qualify.
- Fill remaining seeds with **Ghost Slots**.

### 8.2 Ghost Composition

Ghosts can be:

- Snapshots of **real players from earlier in the season**.  
- AI-designed archetypes named like:
  - “Rim City Legend”
  - “Ghost of the Blacktop”
  - “The Neon Gator”
- Or “echoes” of top historical players’ builds.

Each ghost holds:

```js
{
  id: "ghost_1",
  isGhost: true,
  displayName: "Ghost of [OldPlayer]",
  stats: { ... },
  gear: { ... },
  companion: { ... },
  aiProfile: "aggressive_shooter" // or similar
}
```

These ghosts never log in; they exist purely for bracket completeness.

---

# 9. Rewards for Beating Jordan

Beating Jordan should **matter**, but not break future seasons.

### 9.1 Meta Rewards (Persist Across Resets)

Examples:

- **Stat Cap Increase**  
  - e.g., +1 to max Speed, or +1 to any stat cap.
- **Training Efficiency Buff**  
  - e.g., all gym sessions give +10% more stat points next season.
- **Starting Cash**  
  - e.g., start each new season with +$500.
- **Special Companion**  
  - unlock a unique high-flavor companion only Bull-Slayers can choose.
- **Cosmetic Aura**  
  - unique nameplate, border, or icon shown in menus.

These rewards stack **very slowly** (to avoid power creep).

### 9.2 Cosmetic Rewards

- “Bull-Slayer” title string.  
- Golden court frame in UI.  
- Entry in a Hall of Fame board:
  - season number  
  - Champion name  
  - Jordan result (W/L)  
  - date/time  

---

# 10. Season Reset

Once the Jordan match is resolved (win or lose):

### 10.1 What resets

- All players’:
  - Level  
  - Stats  
  - Money  
  - Gear  
  - Companions  
  - City-by-city progress  

- `sharedState.gameDay` set back to `1`.  
- City rotation resets to the first city (e.g., Boston).

### 10.2 What persists

- Meta progression (unlocked caps, training buffs, etc.).
- Cosmetic unlocks (titles, borders, banners).
- Hall of Fame entries.
- Any sysop-defined persistent flags.

This resets the **playing field** while preserving **long-term goals**.

---

# 11. Pseudocode (High-Level Flow)

> ⚠ **Pseudocode Warning**  
> Namespaces and function names are conceptual and must be adapted to the actual LoRB/JSON-DB structure.

```js
function runEndOfSeason() {
  const allPlayers = loadAllPlayers();
  const seeded = getTop8ByRepScore(allPlayers);

  const bracket = buildBracket(seeded); // creates QF/SF/Final structure
  const bracketResults = runBracketSimulations(bracket); // uses NBAJam engine
  const championId = bracketResults.championId;

  const champion = loadPlayer(championId);
  announceSeasonChampion(champion);

  const jordanResult = NBAJam.runPlayoffBattle(champion, JordanBoss);

  if (jordanResult.winnerId === champion.id) {
    grantJordanVictoryMetaRewards(champion);
    recordHallOfFameEntry(champion, "Jordan Defeated");
  } else {
    recordHallOfFameEntry(champion, "Lost to Jordan");
  }

  savePlayer(champion);
  resetSeasonWorldState();
}
```

Core helper responsibilities:

- `getTop8ByRepScore(players)`
- `buildBracket(seeded)`
- `runBracketSimulations(bracket)`
- `announceSeasonChampion(player)`
- `grantJordanVictoryMetaRewards(player)`
- `recordHallOfFameEntry(player, note)`
- `resetSeasonWorldState()`

---

# 12. Future Multiplayer Integration (Optional)

When real-time multiplayer is available:

### 12.1 Scheduling

- Each bracket round has a “play-by” time window.
- If both players appear:
  - They can play a live head-to-head match.
- If only one appears:
  - Non-appearing player forfeits.
- If neither appears:
  - Higher seed advances automatically.

### 12.2 Spectator Mode

Possible future enhancements:

- Other users can “watch” the match logs.  
- Live commentary via chat.  
- Betting system integrated into sports bar.

None of this is required for the Season system to function.

---

# 13. Why This Endgame Model Works for LoRB

- **Respects Skill**: better players do well in playoffs.  
- **Season-Based**: feels like real NBA arcs.  
- **Non-Arbitrary Reset**: only after a full dramatic arc.  
- **Replayable**: meta rewards + fresh seasons.  
- **Small BBS Friendly**: ghost players prevent dead brackets.  
- **Expandable**: multiplayer, spectators, betting, special events.  
- **Fits Tone**: Jordan as mythic boss, city rotation, Rim City lore.

---

# 14. Integration Notes for Coding Agents (Claude, etc.)

When implementing this system:

1. Treat this file as **design, not literal code**.  
2. Hook into:
   - `cities.json` / City Rotation System  
   - existing `NBAJam.runLorbBattle` or similar entry points  
   - JSON-DB for shared state and player data  
3. Keep **playoff logic stateless** where possible, reading/writing from JSON-DB.  
4. Ensure **season reset** is atomic and logged clearly.  
5. Ensure **Hall of Fame** entries are stored in an append-only structure:
   - season index  
   - champion id  
   - champion name  
   - Jordan W/L  
   - timestamp  

---

# END OF FILE
