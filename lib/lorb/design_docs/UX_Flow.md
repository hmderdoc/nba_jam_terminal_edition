# Legend of the Red Bull — UX Flow (Terminal UI)

## Overview
This document describes the user experience and terminal flow of LoRB.

It is intended to guide human design choices and help AI tools generate consistent UI across modules.

---

## 1. High-Level Experience

Players interact with LoRB through:
- Character creation
- Rim City daily loop
- Sub-menus (Courts, Gym, Bar, Shop)

Design style:
- Fast input
- Clear choices
- Flavor-rich text
- LoRD-like pacing

---

## 2. Entry Flow

```
Start →
Load or Create Player →
If no player: run Character Creation →
Enter Rim City →
Show Main Menu →
Loop actions until quit →
Save →
Exit
```

---

## 3. Rim City Main Menu UX

Example screen:

```
┌─────────────────────────────┐
│       R I M   C I T Y        │
└─────────────────────────────┘

Street Turns: 9    Gym Sessions: 3
Cash: $550         Rep: 12

[1] Hit the Streetball Courts
[2] Go to Club 23
[3] Visit the Gym
[4] Visit the Gear Shop
[5] View Stats & Records
[Q] Call it a Night

Choice:
```

Clear, legible, ANSI-friendly.

---

## 4. Courts Encounter Flow

Pickup game:

```
You hit Court 6...
A rival baller steps up!

Tip-off...
(game sim)

Final Score: Rim City 42 — Uptown 37
You won! +$120, +3 rep
```

Non-battle event example:

```
A street vendor stops you:
"Try my Mystery Mix? Only $20."

[1] Buy (−$20)
[2] Decline politely
```

---

## 5. Club 23 Flow

```
Welcome to Club 23.

[1] Rest & Recover
[2] Listen for Rumors
[3] Watch a CPU vs CPU Game (Bet)
[Q] Leave
```

---

## 6. Gym Flow

```
Coach nods at you.
"Ready to work?"

Raise stat:
[S] Speed (+1): $150
[3] 3PT (+1):   $180
[P] Power (+1): $160
...

Sessions left: 2
```

---

## 7. Gear Shop Flow

```
Rim City Gear Shop

Sneakers:
[1] Rim Grinders (+1 SPD, -1 3PT) — $300
[2] High Tops (+1 BLK, -1 SPD) — $250

Drinks:
[3] Red Bull Classic (+1 SPD next game) — $40

[Q] Exit
```

---

## 8. Daily Summary (Optional)

```
Day 3 Summary

Cash: +$240
Rep:  +5
Stats: No changes today
```

---

## 9. General UX Guidelines for AI Tools

- Keep screens compact  
- Always show remaining turns/sessions  
- Use ANSI sparingly and consistently  
- Prefer `[1], [2], [3]` style choices  
- Do not stall waiting for long input  
