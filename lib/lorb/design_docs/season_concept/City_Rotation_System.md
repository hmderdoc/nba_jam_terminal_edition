# City Rotation System (Legend of the Red Bull)

This document defines the **City Rotation System** for *Legend of the Red Bull* (LoRB).  
It extends the classic *Legend of the Red Dragon* shared-day mechanic while introducing a modern NBA-themed “road trip” world structure.

Cities rotate **once per game day**, and all players share the same current city.

This file is intended to be AI-friendly (Claude Opus consumable) and to serve as a high-clarity spec for implementation.

---

# 1. Goals of the City Rotation System

The system is designed to:

- Preserve a **global shared game day**, LORD-style.
- Rotate through **all 30 NBA cities** in geographically sensible order.
- Provide per-city:
  - Flavor text
  - Event weighting
  - Nightclub names
  - City-specific buffs
  - Optional `.bin` art (80×4 banner, 40×20 detail)
- Allow the world to feel like a **season road trip**.
- Reset the season back to Day 1 when a player defeats **The Red Bull**.

---

# 2. Global Day Mechanic

LoRB uses a world state:

```
sharedState.gameDay (integer starting at 1)
```

This number increments **once per real-world day**, or whenever the sysop chooses.

All players share:

- The same daily turn reset  
- The same city  
- The same world events  
- The same “season timeline”

When **The Red Bull** (Michael Jordan) is defeated:

1. `gameDay` resets to `1`
2. All player progress resets (except meta rewards or trophies)
3. A new season begins
4. The city loop restarts at city #1 (Boston)

This maintains LORD’s “shared world, shared day” structure.

---

# 3. Data Model (`cities.json`)

See the separate file `cities.json` — it defines all 30 cities.

Each city is represented with:

```json
{
  "id": "chi",
  "cityName": "Chicago",
  "teamName": "Bulls",
  "region": "midwest",
  "order": 8,
  "bannerBin": "chi_banner.bin",
  "detailBin": "chi_detail.bin",
  "nightclubName": "The Madhouse Lounge",
  "buffs": {
    "dunk": 1
  },
  "notes": "Air-obsessed city; slight dunk and rim-attack emphasis."
}
```

## 3.1 Field Definitions

| Field | Description |
|-------|-------------|
| `id` | Short code for filenames and internal references |
| `cityName` | Display name |
| `teamName` | Associated NBA team name |
| `region` | Coarse cluster for travel flavor |
| `order` | Determines rotation order (1–30) |
| `bannerBin` | **80×4** CP437 `.bin` file for rich view |
| `detailBin` | **40×20** CP437 `.bin` file for hub detail panel |
| `nightclubName` | Name of the local club |
| `buffs` | Stat bumps or multipliers |
| `notes` | Human-readable design guidance |

## 3.2 About the `.bin` art

LoRB uses:

- **80×4 banner** `.bin` at top of the hub menu  
- **40×20 detail art** `.bin` in right-side info panel  

If either file is missing, fall back to:

- `default_banner.bin`
- `default_detail.bin`

Claude Opus should **not** assume art exists; it should gracefully degrade.

---

# 4. How Cities Rotate (Pseudocode)

> ⚠ **Pseudocode Warning**  
> Namespaces and function signatures MUST be adapted to match the real LoRB code structure.

```js
// Load at boot
const cities = loadJson("data/cities.json");

// Return city object for a given game day
function getCurrentCity(gameDay) {
  const index = (gameDay - 1) % cities.length; // 0-based
  return cities[index];
}

// Return today's city (main entry point)
function getTodayCity(context) {
  const gameDay = context.sharedState.gameDay;
  return getCurrentCity(gameDay);
}

// Called once per real-world day
function advanceGameDay(context) {
  context.sharedState.gameDay += 1;
  saveSharedState(context.sharedState);
}
```

### When the Red Bull is defeated:

```js
function onRedBullDefeated(context, championPlayerId) {
  recordSeasonResult({
    champion: championPlayerId,
    endedOnDay: context.sharedState.gameDay,
    timestamp: now()
  });

  context.sharedState.gameDay = 1;
  resetWorldStateForNewSeason();
  saveSharedState(context.sharedState);
}
```

---

# 5. Integrating Buffs

Cities provide small bonuses via:

```json
"buffs": {
  "speed": 1,
  "repMultiplier": 1.05
}
```

These should be applied at:

- Daily player stat calculation  
- Battle RNG  
- Gym/training results  
- Gambling payouts  
- Event outcome weights  

### Additive stat bonus:
```
player.stats.dunk += cityBuffs.dunk || 0;
```

### Multipliers:
```
rewardCash = baseCash * (cityBuffs.cashMultiplier || 1);
```

### Optional bespoke flags:
```
if (cityBuffs.clutch) { … }
if (cityBuffs.foulTolerance) { … }
```

Buffs are small on purpose (generally +1 or ×1.05) to avoid imbalance.

---

# 6. Art Integration Details

### 80×4 Rich-View Banner

- Appears at top of the Rim City Hub.
- Stored as `.bin` in:
  ```
  /sbbs/xtrn/nba_jam/art/cities/<cityId>_banner.bin
  ```

### 40×20 Hub Detail Panel

- Shows on right side of hub.
- Stored as `.bin` in:
  ```
  /sbbs/xtrn/nba_jam/art/cities/<cityId>_detail.bin
  ```

### Fallbacks

```
default_banner.bin
default_detail.bin
```

---

# 7. All 30 Cities (Table)

| Order | ID  | City          | Team        | Region     | Nightclub Name            | Core Buffs |
|-------|-----|---------------|-------------|------------|---------------------------|------------|
| 1 | bos | Boston | Celtics | northeast | The Shamrock Social | three+1, rep×1.05 |
| 2 | nyk | New York | Knicks | northeast | Empire After Hours | rep×1.1 |
| 3 | bkn | Brooklyn | Nets | northeast | Bridge & Beats | steal+1 |
| 4 | phi | Philadelphia | 76ers | northeast | The Process Lounge | power+1 |
| 5 | tor | Toronto | Raptors | northeast | Northern Lights Club | stamina+1 |
| 6 | cle | Cleveland | Cavaliers | midwest | Lake Effect Lounge | block+1 |
| 7 | det | Detroit | Pistons | midwest | Motor City Groove | power+1, foulTolerance+1 |
| 8 | chi | Chicago | Bulls | midwest | The Madhouse Lounge | dunk+1 |
| 9 | mil | Milwaukee | Bucks | midwest | Cream City After Dark | stamina+1 |
| 10 | ind | Indianapolis | Pacers | midwest | Hoosier House | three+1 |
| 11 | atl | Atlanta | Hawks | southeast | Peachtree Nights | speed+1 |
| 12 | cha | Charlotte | Hornets | southeast | Buzz City Social | steal+1 |
| 13 | mia | Miami | Heat | southeast | Club Heatwave | dunk+1, rep×1.05 |
| 14 | orl | Orlando | Magic | southeast | Illusion Lounge | steal+1, luck+1 |
| 15 | was | Washington | Wizards | southeast | Capital After Dark | rep×1.05 |
| 16 | mem | Memphis | Grizzlies | southwest | Beale Street Blues Bar | power+1, stamina+1 |
| 17 | nop | New Orleans | Pelicans | southwest | Bayou Bounce Club | cash×1.1 |
| 18 | hou | Houston | Rockets | southwest | Space City Lounge | three+1 |
| 19 | sas | San Antonio | Spurs | southwest | Riverwalk Retreat | fundamentals+1 |
| 20 | dal | Dallas | Mavericks | southwest | Big D Skyline Club | three+1, rep×1.05 |
| 21 | den | Denver | Nuggets | mountain | Altitude 5280 | stamina+1, dunk+1 |
| 22 | uta | Salt Lake City | Jazz | mountain | Wasatch Night Session | defense+1 |
| 23 | phx | Phoenix | Suns | west | Club Sunburn | speed+1, stamina+1 |
| 24 | sac | Sacramento | Kings | west | River City Rhythm | rep×1.05 |
| 25 | gsw | San Francisco | Warriors | west | Bay Area Splash Lounge | three+1, rep×1.1 |
| 26 | lal | Los Angeles | Lakers | west | Hollywood Skyline | rep×1.15 |
| 27 | lac | Los Angeles | Clippers | west | Lob City After Hours | dunk+1 |
| 28 | por | Portland | Trail Blazers | west | Rip City Underground | clutch+1 |
| 29 | min | Minneapolis | Timberwolves | north | Twin Cities Chill | stamina+1, defense+1 |
| 30 | okc | Oklahoma City | Thunder | midwest | Thunder Roadhouse | speed+1, rep×1.05 |

---

# 8. Notes for Claude Opus (Coding Agent)

When implementing this:

1. **Always load from `cities.json`**, not hard-coded tables.
2. Use `getTodayCity(context)` as the single source of truth.
3. Do not assume `.bin` art files exist – use fallbacks.
4. Buffs are lightweight flavor modifiers.
5. Integrate with:
   - daily turn reset  
   - random event tables  
   - court/gym interactions  
   - companion/flirt systems (if present)
6. On Red Bull defeat: reset to Day 1 and restart rotation.

---

# 9. Future Extensions

- Add Vegas All-Star weeks  
- Rival encounters that differ by city  
- Weather-based events  
- City mascots as romance/companion routes  
- Dynamic city-driven meta bonuses  

---

# END OF FILE
