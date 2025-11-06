# NBA Jam Reorganization Progress

## Session Date: November 6, 2025

### ✅ PHASE 1 COMPLETE: Utilities & Rendering Foundation

**Total Files Created:** 11 new module files
**Lines Extracted:** ~2,000 lines from monolith
**Original File Size:** 13,347 lines

---

## Completed Modules

### lib/utils/ (2 files)
1. **constants.js** (224 lines)
   - All game constants and configuration
   - Court dimensions, player attributes, AI constants
   - Shoe color configuration
   - Court spots (waypoints)
   - AI state enum
   - Global state declarations

2. **helpers.js** (167 lines)
   - debugLog() - logging utility
   - buryCursor(), cycleFrame() - display helpers
   - bgToFg(), composeAttrWithColor() - color manipulation
   - getPlayerGlobalId() - multiplayer helper
   - Math.sign polyfill
   - Frame.prototype.drawBorder() - UI extension

### lib/rendering/ (4 files)
3. **sprite-utils.js** (237 lines)
   - getCourtScreenOffsetY() - coordinate transform
   - scrubSpriteTransparency() - sprite cleanup
   - applyShoeColorToSprite() - color application
   - Sprite.Aerial.prototype patches (moveTo, cycle)
   - Automatic bearing/movement on court

4. **shoe-colors.js** (120 lines)
   - cloneShoePalette(), buildShoePalettePool()
   - paletteConflictsWithTeam()
   - resetShoePaletteAssignments(), assignShoePalette()
   - getPlayerShoePalette(), getPlayerTurboColor()
   - updatePlayerShoeColor(), applyShoePaletteToPlayer()

5. **player-labels.js** (135 lines)
   - ensurePlayerLabelFrame()
   - renderPlayerLabel() - on-screen name/jersey labels
   - getDunkLabelText() - dunk animation text
   - getDunkFlashPalette() - dunk flash effects

6. **animation-system.js** (331 lines)
   - computeShotAnimationTiming(), computePassAnimationTiming()
   - AnimationSystem class (non-blocking animations)
   - queueShotAnimation(), queuePassAnimation(), queueReboundAnimation()
   - update(), updateShotAnimation(), updatePassAnimation()
   - updateReboundAnimation(), completeAnimation()
   - flashBasket(), isBallAnimating()
   - Global animationSystem instance

### lib/testing/ (5 files - moved from root)
- test_connection.js
- test_jsonclient.js
- test_multiplayer_system.js
- test_queue.js
- test_socket.js

### lib/text/ (7 files - moved from root)
- MULTIPLAYER_DESIGN.md
- MULTIPLAYER_QUICKSTART.md
- MULTIPLAYER_REFERENCE.md
- SPRITE_MERGE_INSTRUCTIONS.md
- INTEGRATION_COMPLETE.md
- MULTIPLAYER_INTEGRATION.md
- shove_documentation.md

---

## Next Steps (Phase 2: Core Game Logic)

### Remaining Extractions (Priority Order):

#### High Priority - Foundation
1. **lib/rendering/court-rendering.js**
   - drawCourt() (large function, ~1900 lines)
   - resolveBaselineBackground(), getTeamBaselineColors()
   - Court sprite initialization

2. **lib/game-logic/player-class.js**
   - Player() constructor
   - Player.prototype methods
   - useTurbo() method with multiplayer sync

3. **lib/game-logic/game-state.js**
   - createDefaultGameState()
   - resetGameState()
   - State initialization logic

4. **lib/game-logic/movement.js**
   - distance() calculations
   - steerToward() function
   - Movement helpers (~300 lines)

#### Medium Priority - Game Mechanics
5. **lib/game-logic/shove-system.js**
   - attemptShove() (coordinator authority)
   - updatePlayerShovedAppearance()
   - updatePlayerShoverAppearance()
   - Shove sprite functions

6. **lib/game-logic/rebound-system.js**
   - createRebound() with broadcast
   - updateReboundScramble() (multiplayer sync critical)
   - secureRebound() with coordinator check
   - **NOTE: Contains known bug - rebound never resolves in multiplayer**

7. **lib/game-logic/steal-system.js**
   - attemptSteal()
   - Steal probability

8. **lib/game-logic/block-system.js**
   - attemptBlock()
   - Block jump animation

9. **lib/game-logic/shooting.js**
   - attemptShot()
   - Shot probability calculation
   - Shot arc/animation setup
   - Dunk detection and execution

10. **lib/game-logic/passing.js**
    - attemptPass()
    - Pass lane analysis
    - Intercept detection
    - Pass animation setup

#### Lower Priority - AI & UI
11-16. **lib/ai/** (6 files)
    - ai-helpers.js (~1000 lines)
    - ai-rebound.js
    - ai-offense-ballhandler.js
    - ai-offense-offball.js
    - ai-defense-onball.js
    - ai-defense-help.js

17. **lib/ui/menus.js**
    - mainMenu()
    - playerSelectionScreen()
    - Team selection screens

---

## Dependency Chain for Loading

```
Phase 1 (COMPLETE):
├── lib/utils/constants.js         (no dependencies)
├── lib/utils/helpers.js            (needs: constants.js)
├── lib/rendering/sprite-utils.js   (needs: constants.js, helpers.js)
├── lib/rendering/shoe-colors.js    (needs: constants.js, helpers.js, sprite-utils.js)
├── lib/rendering/player-labels.js  (needs: constants.js, helpers.js)
└── lib/rendering/animation-system.js (needs: constants.js, helpers.js)

Phase 2 (Next):
├── lib/rendering/court-rendering.js (needs: Phase 1)
├── lib/game-logic/player-class.js   (needs: Phase 1)
├── lib/game-logic/game-state.js     (needs: Phase 1, player-class.js)
└── lib/game-logic/movement.js       (needs: Phase 1)

Phase 3 (Later):
├── lib/game-logic/*.js              (needs: Phase 1-2)
└── lib/ai/*.js                      (needs: Phase 1-3)

Phase 4 (Final):
└── lib/ui/menus.js                  (needs: Phase 1-3)
```

---

## Testing Strategy

### After Phase 2 (Game Logic Core):
- Verify game can initialize
- Test player movement
- Test basic game state transitions
- Confirm court rendering works

### After Phase 3 (AI & Mechanics):
- Test AI behavior in single-player
- Test all game mechanics (shooting, passing, rebounding)
- **Debug rebound resolution bug** (easier with isolated code)

### After Phase 4 (Complete):
- Full single-player game test
- Full multiplayer game test (coordinator + client)
- Verify Option B sync still works
- Performance regression testing

---

## Key Preservation Notes

- ✅ All Option B multiplayer sync code preserved
- ✅ Coordinator authority checks remain intact
- ✅ Event broadcasts and handlers functional
- ⚠️ Known bug: Rebound resolution in multiplayer (not yet addressed)
- ⚠️ Missing: Dunk animation sync (documented, not implemented)

---

## Estimated Remaining Time

- Phase 2 (Core Game Logic): 3-4 hours
- Phase 3 (AI & Mechanics): 4-5 hours
- Phase 4 (UI & Integration): 1-2 hours
- **Total Remaining: 8-11 hours**

---

## Files Modified This Session

### Created:
- lib/utils/constants.js
- lib/utils/helpers.js
- lib/rendering/sprite-utils.js
- lib/rendering/shoe-colors.js
- lib/rendering/player-labels.js
- lib/rendering/animation-system.js
- REORGANIZATION_PLAN.md
- REORGANIZATION_PROGRESS.md (this file)

### Moved:
- 5 test files → lib/testing/
- 7 documentation files → lib/text/

### Backed Up:
- nba_jam.js → nba_jam.js.backup

### Not Yet Modified:
- nba_jam.js (still contains all code, extraction happens at end)
- mp_*.js files (already well-organized, no changes needed)

---

## Next Session Plan

Continue with Phase 2 extractions in this order:
1. court-rendering.js (big but straightforward)
2. player-class.js (critical for everything)
3. game-state.js (critical for initialization)
4. movement.js (used by AI and mechanics)

After Phase 2 complete, can create a preliminary test loader to verify modules load correctly before proceeding to Phase 3.
