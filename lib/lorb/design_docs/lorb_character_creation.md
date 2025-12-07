# Legend of the Red Bull — Character Creation & Progression Design

## Overview

This document defines the character creation, attribute system, and progression loop for the BBS door game **Legend of the Red Bull** (LoRB). It mirrors the addictive structure of **Legend of the Red Dragon (LoRD)** while reframing the world around surreal basketball mythology, NBA Jam–style battles, and the legendary *Red Bull* (both Michael Jordan and the energy drink).

This file is intended for use by humans **and** AI-assisted code generation (Copilot, ChatGPT agents, etc.). It establishes structure, data shapes, and high‑level flow.

---

## 1. LoRD Elements We Are Reusing

LoRB borrows key gameplay patterns:

1. **Fast daily play**  
   Players get a limited number of daily turns.

2. **Simple but meaningful stats**  
   A small stat set that defines identity and growth.

3. **Long-term goal**  
   In LoRD you kill the Dragon;  
   in LoRB you defeat **The Red Bull**.

4. **Social bragging rights**  
   Builds, stats, and reputation matter to other players.

---

## 2. Core Stats

LoRB uses **6 visible stats** (+optional hidden IQ):

| Stat   | Description | Impact |
|--------|-------------|--------|
| speed  | Movement/agility | Steals, drive success |
| three  | 3‑pt shooting | Long‑range scoring |
| power  | Strength | Blocking, contact finishes |
| steal  | Ball control | Steal chance, special events |
| block  | Rim defense | Reduces opponent scoring |
| dunk   | Flash scoring | Style rewards, bonus payouts |
| iq (hidden) | Situational awareness | XP gain, reduces RNG errors |

Stats generally start between **3 and 7**, with **10 max** during creation.

---

## 3. Archetypes (Primary Identity)

Archetypes define initial stat tendencies and perks.

### The Slasher
- High Speed & Dunk  
- Low 3PT  
- Perk: *Momentum* — bonus XP vs stronger foes

### The Sniper
- High 3PT & IQ  
- Low Power  
- Perk: *Heat Check* — occasional bonus shot in sim

### The Enforcer
- High Power & Block  
- Low Speed  
- Perk: *Intimidation* — reduce opponent scoring RNG

### The Playmaker
- High Steal & IQ  
- Weak Dunk  
- Perk: *Hype Assist* — small bonus cash in well‑played games

### The Underdog
- Lower starting stats  
- But cheaper upgrades and bonus XP  
- Perk: *Chip on Shoulder*

---

## 4. Backgrounds (Secondary Identity)

Backgrounds modify stats and economics.

### Streetball Prodigy
+1 Speed, +1 Dunk, low cash, special street events

### City League Standout
Balanced, medium cash, bonus early XP

### Sponsored Prospect
High cash, ad‑interrupt events, improved cash multipliers

### JuCo Grinder
+XP gain, slightly reduced cash income, slow steady path

### Mystery Lab Creation
One random stat spike and one random dump, thematic oddball

---

## 5. Stat Allocation System

After choosing archetype + background, players receive **12–15 attribute points** to distribute.

Example UI:

```
You have 12 Attribute Points.

Speed:  6
3PT:    4
Power:  5
Steal:  4
Block:  4
Dunk:   6

Points remaining: 12

Choose a stat to increase:
  [S] Speed    [3] 3PT Shooting
  [P] Power    [T] Steal
  [B] Block    [D] Dunk
  [Q] Done
```

Rules:
- Max stat during creation = **10**
- Player may exit early but is encouraged to spend all points

---

## 6. Character Summary Screen

```
Your Build Is Locked In:

Name:        <player>
Archetype:   The Slasher
Background:  Streetball Prodigy

Stats:
  Speed: 7
  3PT:   4
  Power: 6
  Steal: 4
  Block: 4
  Dunk:  7

Starting Cash: $400
Starting Rep:  0

Proceed to Rim City? (Y/N)
```

---

## 7. Economy Loop

The LoRB gameplay loop is analogous to LoRD:

1. Earn **cash** from NBA Jam battles, bets, and events.  
2. Spend cash at **Trainer/Gym** to purchase stat increases.  
3. Higher stats → win bigger games → more cash.  
4. Eventually face **The Red Bull**.

### Stat Upgrade Costs

Simple scaling logic:

```
Cost = 100 + (stat_value * 50)
```

Example Gym UI:

```
Trainer's Gym:

Raise Speed (+1):   $150
Raise 3PT (+1):     $180
Raise Power (+1):   $160
Raise Steal (+1):   $150
Raise Block (+1):   $175
Raise Dunk (+1):    $200
```

Optional features:
- XP for unlocking special moves  
- Rep for social flex and event unlocks  

---

## 8. Data Contracts (For AI Coding Agents)

### Player Object

```js
{
  id: number,
  name: string,
  archetype: string,
  background: string,
  stats: {
    speed: number,
    three: number,
    power: number,
    steal: number,
    block: number,
    dunk: number
  },
  cash: number,
  rep: number,
  flags: {
    sponsored_ads?: boolean,
    streetball_prodigy?: boolean
  }
}
```

### Archetype Table

```js
const ARCHETYPES = {
  slasher: {
    label: "The Slasher",
    baseStats: { speed: 6, three: 3, power: 5, steal: 4, block: 4, dunk: 7 },
    perks: { momentum: true }
  },
  sniper: {
    label: "The Sniper",
    baseStats: { speed: 5, three: 7, power: 4, steal: 4, block: 3, dunk: 5 },
    perks: { heat_check: true }
  }
  // ...
}
```

### Background Table

```js
const BACKGROUNDS = {
  streetball: {
    label: "Streetball Prodigy",
    statMods: { speed:+1, dunk:+1 },
    startingCash: 300,
    flags: { streetball_prodigy: true }
  },
  sponsored: {
    label: "Sponsored Prospect",
    statMods: {},
    startingCash: 800,
    flags: { sponsored_ads: true }
  }
}
```

---

## 9. Optional First-Day Intro Script

```
Welcome to Rim City.

You step off the bus with nothing but a beat‑up pair of sneakers and a dream.
People here don’t chase dragons — they chase legends.

Somewhere out there… the Red Bull waits.
Six rings. Eternal aura. A shadow that still blocks out the sun.

Before you can face him, who are you?
```

---

## 10. Implementation Notes

- Character creation module should live separate from gameplay.  
- Call it only when no saved character exists.  
- Archetypes & backgrounds belong in `/data/` JSON/JS files.  
- Stat purchasing should be handled in a `trainer.js` or equivalent.  
- The creation flow is UI‑driven but data‑table‑powered.

---

## End of Document
