# Legend of the Red Bull — Development Plan (v1)

## 1. Goal & Scope

This document defines the **v1 development plan** for the Legend of the Red Bull (LoRB) BBS door.

It ties together:

- Character creation  
- Core game loop  
- Rim City locations (Courts, Bar, Gym, Shop)  
- Integration with the NBA Jam battle engine  

and lays out **phased work** so humans and AI coding agents know what to implement next.

> ⚠️ **Note on Pseudocode**  
> Any pseudocode in this repo (including this file) is **behavioral, not API-accurate**.  
> Coding agents must adapt behaviors to real code and prefer existing functions
> (e.g., `NBAJam.runLorbBattle(...)`) over pseudocode names.

---

## 2. v1 Definition (“What We Need for a Playable Game”)

A **v1-complete** Legend of the Red Bull should include:

### ✔️ Character Creation
- Archetype & background selection  
- Stat allocation  
- Initial `PlayerState` persistence  

### ✔️ Daily Game Loop
- Load or create player  
- Reset daily resources (turns, sessions, etc.)  
- Rim City main menu  
- Execute actions  
- Save & exit  

### ✔️ Core Locations (Minimal)
- **Streetball Courts**: primary PvE, cash/rep engine  
- **Club 23 (Sports Bar)**: rest, simple rumors, optional gambling  
- **Gym / Trainer**: stat upgrades, healing (simple)  
- **Gear Shop**: buy basic items  

### ✔️ NBA Jam Battle Engine Integration
- Single adapter entry:
  - Build rosters  
  - Call engine  
  - Apply rewards  

### ✔️ Basic Balancing & Safety
- No soft-locks (player always has path to earn cash)  
- Reasonable stat/upgrade costs  
- Clean input/output handling  

---

## 3. Phased Work Plan

---

### **Phase 0 — Repo & Docs Wiring**
- [ ] Place all design docs in `/docs/`:
  - `lorb_character_creation.md`
  - `lorb_gameloop_overview.md`
  - `lorb_rim_city_locations.md`
  - `Development_plan.md` (this file)
- [ ] Confirm entrypoint flow (lorb.js → boot.js → modules)
- [ ] Do not rewrite working entry logic unless required

---

### **Phase 1 — Character Creation Integration**
- [ ] Implement or refine a character creation module  
- [ ] Ensure flows:
  - Archetype selection  
  - Background selection  
  - Stat allocation  
- [ ] Save completed `PlayerState`

**Decision:** locate creation call during first run (likely in `lorb.js` or `Core.State`).

---

### **Phase 2 — Player State & Persistence Normalization**
- [ ] Define canonical `PlayerState` shape  
- [ ] Migrate saved data / add defaults for new fields  
- [ ] Centralize:
  - `loadPlayerState(user)`  
  - `savePlayerState(player)`  

---

### **Phase 3 — Main Game-Day Loop Skeleton**
- [ ] Implement `runGameDay(player)` (behavior, not details)
- [ ] Show Rim City menu
- [ ] Route choices to handlers:
  - `handleStreetballEncounter(player)`
  - `handleClub23(player)`
  - `handleGymTraining(player)`
  - `handleGearShop(player)`
  - `handleTournaments(player)` (stub)
- [ ] End day on quit or when actions are exhausted

> AI guidance: Keep main loop small; implement details in handlers.

---

### **Phase 4 — Implement Core Locations (Minimal)**

---

#### **4.1 Streetball Courts**
- [ ] Build small Street Event table  
- [ ] Pickup game flow:
  - Build rosters from stats  
  - Choose CPU team  
  - Call battle engine  
  - Apply rewards  
  - Print summary  
- [ ] At least one non-battle event  

---

#### **4.2 Club 23 (Sports Bar)**
- [ ] Implement **Rest**  
- [ ] Implement **Rumors** (static or flag-based)  
- [ ] Optional for v1: **Simple CPU vs CPU bet**  
  - Present matchup  
  - Accept wager  
  - Use battle engine for AI-only sim  

---

#### **4.3 Gym / Trainer**
- [ ] Stat upgrade menu  
- [ ] Cost function (e.g., base + stat * multiplier)  
- [ ] Deduct cash, increment stat, decrement sessions  
- [ ] Implement simple healing (no injuries → flavor text)  

---

#### **4.4 Gear Shop**
- [ ] Define basic items (2–3 sneakers, 1–2 consumables)  
- [ ] Buy flow: check cash → add item → apply modifiers  
- [ ] Store inventory in `PlayerState`  

---

### **Phase 5 — Battle Engine Adapter & Rewards**
- [ ] Wrap LoRB → NBA Jam call in adapter:
  ```js
  BattleEngine.runLorbBattle(rosters, options)
  ```
- [ ] Ensure adapter calls the **real** engine (`NBAJam.runLorbBattle` or equivalent)
- [ ] Implement reward logic:
  - Updates to `cash`, `rep`, flags, etc.  
- [ ] Write helper: `applyBattleRewards(player, gameResult)`

---

### **Phase 6 — Balancing & Guard Rails**
- [ ] Set starting stats/cash to “fun but not trivial” values  
- [ ] Ensure player cannot get stuck without a way to earn money  
- [ ] Log or debug-print key steps (minimal)  

---

### **Phase 7 — Testing & Integration**
- [ ] Launch door from BBS  
- [ ] Create new character → run full day → save  
- [ ] Simulate 2–3 days to test progression  
- [ ] Test stat upgrades & item purchases  
- [ ] Validate at least a few battle sims  
- [ ] Review logs for errors  

---

## 4. Open Decisions (With Safe Defaults)

### **Stamina & Injuries**
- Default: **cosmetic only** in v1  
- Gym healing can be stubbed or simplified  

### **Tournaments**
- v1: `handleTournaments()` prints “Coming Soon”  
- v1.5+: implement multi-game CPU tournaments  

### **Social / PvP Features**
- v1: CPU-only  
- Future: MVP board, async ghost PvP  

---

## 5. AI Coding Agent Guidelines

To any AI agent working inside this project:

- Treat this document as a **behavior spec**, not a rigid API contract  
- Prefer **existing working functions** over pseudocode  
- When pseudocode references:
  ```js
  BattleEngine.runLorbBattle(...)
  ```
  but the real call is:
  ```js
  NBAJam.runLorbBattle(...)
  ```
  **use the real one**, and if needed, create a small adapter  
- Keep modules **small & composable**  
- Add light comments referencing relevant sections of `/docs/`  
- Never rewrite large working modules unless explicitly directed  

---

## 6. Summary

This plan provides:

- Clear scope for v1  
- A phased, implementable workflow  
- Strong boundaries between modules  
- Explicit instructions for AI agents  
- A foundation for iterative expansion (v1.5, v2, etc.)

Legend of the Red Bull v1 will feel like a coherent, funny, basketball-infused reinterpretation of LoRD—while remaining maintainable and extensible.

