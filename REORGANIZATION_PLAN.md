# NBA Jam Code Reorganization Plan

## Status: In Progress
**Started:** 2025-01-06
**Original File Size:** 13,347 lines in nba_jam.js

## Completed Tasks

### 1. Directory Structure ✅
Created the following subdirectories under `/lib`:
- `lib/ai/` - AI systems (offense, defense, rebounds)
- `lib/rendering/` - Visual rendering and sprite management
- `lib/game-logic/` - Core game mechanics (shooting, passing, etc.)
- `lib/utils/` - Utility functions and constants
- `lib/text/` - Documentation and text files
- `lib/testing/` - Test harnesses
- `lib/ui/` - Menu and UI systems

### 2. File Cleanup ✅
- Moved 7 uppercase .md files to `lib/text/`:
  - MULTIPLAYER_DESIGN.md
  - MULTIPLAYER_QUICKSTART.md
  - MULTIPLAYER_REFERENCE.md
  - SPRITE_MERGE_INSTRUCTIONS.md
  - INTEGRATION_COMPLETE.md
  - MULTIPLAYER_INTEGRATION.md
  - shove_documentation.md
  
- Moved 5 test files to `lib/testing/`:
  - test_connection.js
  - test_jsonclient.js
  - test_multiplayer_system.js
  - test_queue.js
  - test_socket.js

### 3. Constants Extraction ✅
Created `lib/utils/constants.js` containing:
- Display & visual configuration
- Shoe color configuration
- Game timing (SINGLEPLAYER_TEMPO, DEMO_GAME_SECONDS)
- Court dimensions (COURT_WIDTH, COURT_HEIGHT, basket positions)
- Player movement & speed constants
- Dunk mechanics constants
- Player attributes (ATTR_SPEED, ATTR_3PT, etc.)
- Turbo mechanics (MAX_TURBO, drain/recharge rates)
- Shove system constants
- Passing mechanics constants
- Block animation constants
- AI decision constants
- Court spots (waypoints for AI positioning)
- AI states enum (AI_STATE)
- Global state declarations (gameState, mpCoordinator, mpSyncState)
- Utility: getSinglePlayerTempo()

## Remaining Tasks (In Priority Order)

### Phase 1: Utilities & Rendering (Foundation)
These modules have minimal dependencies on game logic, extract them first.

4. **lib/utils/helpers.js** - Extract utility functions:
   - debugLog() (line 11)
   - buryCursor() (line 313)
   - cycleFrame() (line 320)
   - getPlayerGlobalId() (line 1194)
   - bgToFg() (line 96)
   - composeAttrWithColor() (line 327)
   - Frame.prototype.drawBorder() (lines 680-751)
   - Math.sign polyfill (lines 676-679)

5. **lib/rendering/sprite-utils.js** - Sprite manipulation:
   - scrubSpriteTransparency() (line 624)
   - applyShoeColorToSprite() (line 335)
   - getCourtScreenOffsetY() (line 284)
   - Sprite.Aerial.prototype.moveTo/cycle patch (lines 134-283)

6. **lib/rendering/animation-system.js** - Animation class:
   - computeShotAnimationTiming() (line 878)
   - computePassAnimationTiming() (line 892)
   - AnimationSystem constructor and methods (lines 911-1191)
   - Global: animationSystem instance

7. **lib/rendering/shoe-colors.js** - Shoe palette system:
   - cloneShoePalette() (line 77)
   - buildShoePalettePool() (line 86)
   - paletteConflictsWithTeam() (line 101)
   - resetShoePaletteAssignments() (line 118)
   - assignShoePalette() (line 122)
   - getPlayerShoePalette() (line 349)
   - getPlayerTurboColor() (line 354)
   - updatePlayerShoeColor() (line 366)
   - applyShoePaletteToPlayer() (line 489)

8. **lib/rendering/player-labels.js** - Player label rendering:
   - ensurePlayerLabelFrame() (line 502)
   - renderPlayerLabel() (line 516)
   - getDunkLabelText() (line 601)
   - getDunkFlashPalette() (line 612)

9. **lib/rendering/court-rendering.js** - Court drawing:
   - resolveBaselineBackground() (line 291)
   - getTeamBaselineColors() (line 301)
   - drawCourt() (line 2285 - large function)
   - Court sprite initialization

### Phase 2: Game Logic Core
Extract individual game mechanic systems.

10. **lib/game-logic/player-class.js** - Player constructor:
    - Player() constructor (line 1403)
    - Player.prototype methods
    - useTurbo() method (line 1470)

11. **lib/game-logic/game-state.js** - State management:
    - createDefaultGameState() (line 1207)
    - resetGameState() (line 1318)

12. **lib/game-logic/movement.js** - Movement system:
    - distance() calculations
    - steerToward() function
    - Movement helper functions (lines 5008-5314)

13. **lib/game-logic/shove-system.js** - Shove mechanics:
    - attemptShove() (line 9242)
    - updatePlayerShovedAppearance() (line 378)
    - updatePlayerShoverAppearance() (line 434)
    - Shove-related sprite functions

14. **lib/game-logic/rebound-system.js** - Rebound mechanics:
    - createRebound() (line 9609)
    - updateReboundScramble() (line 9708)
    - secureRebound() (line 9757)
    - Rebound timeout/resolution logic

15. **lib/game-logic/steal-system.js** - Steal mechanics:
    - attemptSteal() (line 8225)
    - Steal probability calculation

16. **lib/game-logic/block-system.js** - Block mechanics:
    - attemptBlock() (line 9423)
    - Block jump animation

17. **lib/game-logic/shooting.js** - Shooting system:
    - attemptShot() (line 11044)
    - Shot probability calculation
    - Shot arc/animation setup
    - Dunk detection and execution

18. **lib/game-logic/passing.js** - Passing system:
    - attemptPass() function
    - Pass lane analysis
    - Intercept detection
    - Pass animation setup

### Phase 3: AI Systems
Extract AI behavior modules (most complex, interdependent).

19. **lib/ai/ai-helpers.js** - AI utility functions:
    - Lines 4242-5314 (marked "===== NEW AI HELPER FUNCTIONS =====")
    - AI decision support functions

20. **lib/ai/ai-rebound.js** - Rebound AI:
    - handleAIRebound() (line 6176)
    - Rebound positioning logic

21. **lib/ai/ai-offense-ballhandler.js** - Ball handling AI:
    - Extract from updateAI() (line 6054)
    - Offensive decision tree for ball carrier
    - Shoot/pass/drive decisions

22. **lib/ai/ai-offense-offball.js** - Off-ball offense AI:
    - Extract from updateAI()
    - Offensive positioning without ball
    - Spot selection and movement

23. **lib/ai/ai-defense-onball.js** - On-ball defense AI:
    - Extract from updateAI()
    - Tight defense positioning
    - Steal attempts
    - Ball handler pressure

24. **lib/ai/ai-defense-help.js** - Help defense AI:
    - Extract from updateAI()
    - Double team logic
    - Help positioning
    - Defensive rotations

### Phase 4: UI & Integration

25. **lib/ui/menus.js** - Menu systems:
    - mainMenu() (line 11808)
    - playerSelectionScreen() (line 11846)
    - Team selection screens

26. **Create nba_jam_main.js** - New entry point:
    - Load all lib/ modules via load()
    - Declare main() function
    - Game loop
    - Keep original nba_jam.js as nba_jam.js.backup (already done)

27. **Update all load() dependencies**:
    - Add proper load() statements to each module
    - Ensure correct loading order
    - Handle circular dependencies if any

28. **Test & Validate**:
    - Run game in single-player mode
    - Test multiplayer sync (coordinator/client)
    - Verify no regressions

## File Extraction Strategy

### For Each Module:
1. Read relevant section from nba_jam.js
2. Create new file in appropriate lib/ subdirectory
3. Add load() statements at top for dependencies
4. Copy function code with minimal modifications
5. Mark functions that need to remain in main file (game loop, initialization)
6. Update original nba_jam.js by removing extracted code (do this at the end)

### Dependency Management:
- Constants should be loaded first (already extracted)
- Utilities next (helpers, sprite-utils)
- Rendering systems (depend on utilities)
- Game logic (depends on rendering + utilities)
- AI systems (depend on game logic)
- UI (depends on everything)
- Main orchestrator loads all modules

### Testing Checkpoints:
After extracting each **phase**, test the game:
- Phase 1 complete → test rendering
- Phase 2 complete → test basic gameplay
- Phase 3 complete → test AI behavior
- Phase 4 complete → full integration test

## Notes

### Multiplayer Preservation:
- Keep all Option B sync code intact
- mp_*.js files remain separate (already well-organized)
- Don't break existing broadcasts or event handlers

### Known Issues to Address (After Reorganization):
- Rebound resolution bug in multiplayer (ball never awarded)
- Missing dunk animation sync
- Animation timing parity between single/multiplayer

### Files to Keep in Root:
- nba_jam.js.backup (original monolith backup)
- nba_jam_main.js (new entry point)
- mp_*.js (multiplayer modules - already organized)
- bookie.js (separate system)
- json-chat.js (separate system)
- nba_jam.ans, nba_jam.bin (assets)
- Roster files and configuration

## Estimated Time:
- Phase 1: 2-3 hours
- Phase 2: 3-4 hours
- Phase 3: 4-5 hours (AI is complex)
- Phase 4: 1-2 hours
- **Total: 10-14 hours of focused work**

## Progress Tracking:
Use `manage_todo_list` tool to track completion as work proceeds.
