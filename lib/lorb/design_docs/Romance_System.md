# Romance System (Legend of the Red Bull)

This document defines the **romance & marriage system** for *Legend of the Red Bull* (LoRB), inspired loosely by *Legend of the Red Dragon (LORD)* but adapted to:

- Use the new **`bachelorettes`** data in `cities.json`
- Restrict romance encounters to **nightclubs**
- Limit daily flirt interactions (3/day default)
- Allow **exclusive marriages** (NPC can only be married to one player)
- Fit BBS door gameplay constraints (short lines, simple menus, RNG flavor)

This spec is written for a coding agent (Claude Opus) to implement the system cleanly.

---

# 1. High-Level Design

## 1.1 Goals

- Recreate LORD-like flirt progression:
  - Stranger → Acquaintance → Crush → Partner → Fiancé(e) → Spouse
- Keep tone light, humorous, basketball-themed.
- Limit romance activity to **nightclub menu** only.
- Maintain **3 flirts per day** (configurable).
- NPCs have **rarity tiers** and appear based on weighted RNG.
- Marriage is **exclusive globally**:
  - Each NPC can only marry one player.
  - When married, NPC becomes unavailable for others.
- Marriage provides light perks (v1: cosmetic / small buffs).
- All romance state stored in JSON-DB.

---

# 2. Data Model

## 2.1 Static NPC Data (cities.json)

Each city includes:

```
"bachelorettes": [
  { "name": "Amy Poehler", "category": "actress", "rarity": "common" },
  { "name": "Mindy Kaling", "category": "actress", "rarity": "uncommon" },
  { "name": "Eliza Dushku", "category": "actress", "rarity": "rare" }
]
```

This dataset is **static** and not mutated.

---

## 2.2 Player Romance State

Saved in a per-player JSON-DB document:

```
{
  "playerId": "hm_derdoc",
  "dailyFlirtCount": 0,
  "lastFlirtDay": 11,
  "relationships": {
    "Amy Poehler": {
      "affection": 42,
      "status": "crush",
      "cityId": "bos",
      "lastInteractionDay": 11
    }
  },
  "spouseName": null,
  "spouseCityId": null
}
```

### Fields:
- `dailyFlirtCount`: resets daily.
- `lastFlirtDay`: tracks when to reset.
- `spouseName`: name of married NPC.
- `relationships`: dictionary keyed by NPC name.

---

## 2.3 Global NPC Marriage Lock State

Stored in a global JSON-DB:

```
{
  "name": "Amy Poehler",
  "cityId": "bos",
  "spousePlayerId": "hm_derdoc",
  "spouseSinceDay": 22
}
```

### Purpose:
- Prevent NPC from being married twice.
- Provide a global authoritative marriage map.

---

# 3. Daily Limits & Access Rules

## 3.1 Nightclub-Only Romance

The nightclub menu for each city gains:

```
F) Flirt / Socialize
```

All romantic encounters **must happen here**.

---

## 3.2 Daily Flirt Limit

```
MAX_FLIRTS_PER_DAY = 3
```

At nightclub entry:

- If `dailyFlirtCount ≥ MAX_FLIRTS_PER_DAY`  
  → show denial and block flirts.

At beginning of new game day:

```
if player.lastFlirtDay !== currentDay:
    player.dailyFlirtCount = 0
    player.lastFlirtDay = currentDay
```

---

# 4. Picking NPC Encounters

## 4.1 Step 1: Determine Today's City

```
const city = getTodayCity(context);
```

## 4.2 Step 2: Eligible NPCs

```
eligible = city.bachelorettes.filter(npc => !isGloballyMarried(npc))
```

## 4.3 Step 3: Apply Rarity Weighting

- common = 5
- uncommon = 3
- rare = 1

Weighted random selection.

## 4.4 Step 4: Relationship Lookup

If none exists:

```
create relationship with affection = 0, status="stranger"
```

---

# 5. Affection & Status System

## 5.1 Affection Bar

Values: typically 0–100

## 5.2 Status Thresholds

```
0–4    → stranger
5–19   → acquaintance
20–39  → crush
40–69  → partner
70–89  → fiance
90+    → spouse (after proposal)
```

---

# 6. Flirting Mechanics

## 6.1 Flirt Outcomes

- success → +8 to +12
- neutral → +1 to +3
- fail → -2 to -4 (min 0)

## 6.2 Success Chance Factors

- player rep improves chance
- status affects chance
- city bonuses may apply

Pseudo:

```
let base = 0.4;
base += player.rep * 0.01;
if (status === "partner") base += 0.1;
if (status === "stranger") base -= 0.05;
```

---

# 7. Marriage Rules

## 7.1 Proposal Conditions

- Player not married
- NPC not globally married
- Status == "fiance"

## 7.2 Successful Marriage

```
globalLock.spousePlayerId = playerId
player.spouseName = npc.name
player.spouseCityId = npc.cityId
rel.status = "spouse"
```

## 7.3 Rejection (NPC Taken)

If globally locked:

```
print("She is already committed to someone else.")
```

---

# 8. Marriage Perks (Simple v1)

- +5% rep multiplier  
- 1 daily stamina restore  
- Occasional gift events  

Values should be tunable in config.

---

# 9. Integration With Daily & Seasonal Loops

## 9.1 Daily Reset

Reset flirt count daily.

## 9.2 Season Reset

- Clear player romance state
- Clear global marriage locks

Full fresh slate each season.

---

# 10. Pseudocode Overview

*(This pseudocode is illustrative. Agents must adapt it to LoRB namespaces.)*

## 10.1 Nightclub Menu

```
function nightclubMenu(player, context) {
  resetFlirtsIfNewDay(player);
  print("F) Flirt / Socialize");
  print("Q) Quit");

  const key = getkey();
  if (key === 'F') flirtFlow(player, context);
}
```

## 10.2 Flirt Flow

```
function flirtFlow(player, context) {
  if (player.dailyFlirtCount >= MAX) {
     print("You're done flirting for today!");
     return;
  }

  const npc = pickRandomEligibleNPC(context.city);
  if (!npc) {
     print("No one interesting is around tonight.");
     return;
  }

  let rel = getRelationship(player, npc) || createRelationship(player, npc);

  const outcome = resolveFlirt(player, npc, rel, context);

  applyAffection(rel, outcome);
  updateStatus(rel);

  player.dailyFlirtCount++;
}
```

## 10.3 Proposal

```
function proposeMarriage(player, npc) {
  if (npcAlreadyMarried(npc)) {
     print("She is already committed to someone else.");
     return;
  }

  if (rel.status !== 'fiance') {
     print("Your bond is not strong enough yet.");
     return;
  }

  lockNPCGlobally(npc, player.id);
  player.spouseName = npc.name;
  player.spouseCityId = npc.cityId;

  print("She says yes! You are now married.");
}
```

---

# END OF FILE
