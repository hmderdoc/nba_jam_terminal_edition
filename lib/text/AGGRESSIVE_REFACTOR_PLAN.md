# Aggressive Refactoring Plan - NBA Jam

## Goal: Reduce nba_jam.js from 13,348 lines to ~2,500 lines

### What Should Stay in nba_jam.js (Main Entry Point)
- Multiplayer setup (~50 lines)
- Main menu / team selection (~200 lines)  
- Game initialization / startup (~100 lines)
- **Main game loop only** (~300 lines)
- Player input handling (~200 lines)
- Cleanup / exit (~50 lines)
- **TOTAL: ~900 lines**

### What Must Be Extracted (Priority Order)

#### PHASE 2 COMPLETION (Already Extracted, Need to Delete):
1. ✅ Constants (→ lib/utils/constants.js) - REMOVE ~150 lines
2. ✅ Helper functions (→ lib/utils/helpers.js) - REMOVE ~160 lines
3. ✅ Sprite utilities (→ lib/rendering/sprite-utils.js) - REMOVE ~230 lines
4. ✅ Shoe colors (→ lib/rendering/shoe-colors.js) - REMOVE ~120 lines
5. ✅ Player labels (→ lib/rendering/player-labels.js) - REMOVE ~140 lines
6. ✅ Animation system (→ lib/rendering/animation-system.js) - REMOVE ~330 lines
7. ✅ Player class (→ lib/game-logic/player-class.js) - REMOVE ~120 lines
8. ✅ Game state (→ lib/game-logic/game-state.js) - REMOVE ~230 lines
9. ✅ Team data (→ lib/game-logic/team-data.js) - REMOVE ~420 lines
10. ✅ Movement physics (→ lib/game-logic/movement-physics.js) - REMOVE ~310 lines
11. ✅ Court rendering (→ lib/rendering/court-rendering.js) - REMOVE ~360 lines

**Phase 2 Deletions: ~2,570 lines to remove**

#### PHASE 3 - Extract AI Systems (CREATE NEW + DELETE):
12. AI offense with ball → lib/ai/offense-with-ball.js - REMOVE ~400 lines
13. AI offense without ball → lib/ai/offense-without-ball.js - REMOVE ~300 lines
14. AI defense on-ball → lib/ai/defense-on-ball.js - REMOVE ~350 lines
15. AI defense help → lib/ai/defense-help.js - REMOVE ~250 lines
16. AI rebound → lib/ai/rebound-scramble.js - REMOVE ~200 lines

**Phase 3 Deletions: ~1,500 lines to remove**

#### PHASE 4 - Extract Game Logic Systems (CREATE NEW + DELETE):
17. Shooting system → lib/game-logic/shooting.js - REMOVE ~600 lines
18. Passing system → lib/game-logic/passing.js - REMOVE ~400 lines
19. Rebound system → lib/game-logic/rebounds.js - REMOVE ~300 lines (🎯 BUG TARGET)
20. Shove system → lib/game-logic/shoves.js - REMOVE ~250 lines
21. Steal/block system → lib/game-logic/steal-block.js - REMOVE ~200 lines
22. Possession system → lib/game-logic/possession.js - REMOVE ~350 lines
23. Fire mechanics → lib/game-logic/on-fire.js - REMOVE ~200 lines

**Phase 4 Deletions: ~2,300 lines to remove**

#### PHASE 5 - Extract UI Systems (CREATE NEW + DELETE):
24. Score display → lib/ui/score-display.js - REMOVE ~500 lines
25. Menu system → lib/ui/menus.js - REMOVE ~800 lines
26. Halftime screen → lib/ui/halftime.js - REMOVE ~200 lines
27. Announcer system → lib/ui/announcer.js - REMOVE ~150 lines

**Phase 5 Deletions: ~1,650 lines to remove**

#### PHASE 6 - Extract Sprite Management (CREATE NEW + DELETE):
28. Sprite initialization → lib/rendering/sprite-init.js - REMOVE ~600 lines
29. Uniform/jersey system → lib/rendering/uniforms.js - REMOVE ~400 lines

**Phase 6 Deletions: ~1,000 lines to remove**

---

## Total Lines to Extract/Remove
- Phase 2 (already extracted, just delete): ~2,570 lines
- Phase 3 (AI): ~1,500 lines  
- Phase 4 (Game Logic): ~2,300 lines
- Phase 5 (UI): ~1,650 lines
- Phase 6 (Sprites): ~1,000 lines

**Total: ~9,020 lines to extract**

**Final nba_jam.js: ~4,300 lines** (13,348 - 9,020)
- Can optimize further to ~2,500 lines with careful organization

---

## Immediate Action: Complete Phase 2 Pruning

Need to actually DELETE the ~2,570 lines that are already extracted but still sitting in nba_jam.js as dead code.

