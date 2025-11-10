# NBA Jam Code Reorganization Progress

## Status: Phase 2 COMPLETE ✅

### Original Codebase
- **nba_jam.js**: 13,348 lines (monolithic)

### Extracted So Far: 2,626 lines across 11 modules

---

## Phase 1: Utilities & Rendering (COMPLETE) ✅
**6 modules, ~1,100 lines**

### lib/utils/
- `constants.js` (237 lines) - Game constants, court dimensions, speeds, AI thresholds, enums
- `helpers.js` (157 lines) - debugLog, tempo config, shoe palettes, team colors, cursor utils

### lib/rendering/
- `sprite-utils.js` (229 lines) - Sprite.Aerial patches, coordinate transforms, transparency
- `shoe-colors.js` (115 lines) - Dynamic shoe colors based on turbo/shoved/shover state
- `player-labels.js` (134 lines) - On-screen player names, jersey numbers, dunk labels
- `animation-system.js` (329 lines) - AnimationSystem class for shot/pass/rebound animations

### Supporting
- `lib/testing/` - 5 test files moved from root
- `lib/text/` - 7 .md documentation files moved from root

---

## Phase 2: Core Game Logic (COMPLETE) ✅
**5 modules, ~1,500 lines**

### lib/game-logic/
- `player-class.js` (113 lines) ✅ - Player constructor, getSpeed(), turbo management
- `game-state.js` (153 lines) ✅ - State initialization, frame variables, reset logic
- `movement-physics.js` (313 lines) ✅ - Collision detection, boundary clamping, movement accumulator
- `team-data.js` (492 lines) ✅ - NBATeams object, rosters.ini parsing, color conversion, sprite resolution

### lib/rendering/
- `court-rendering.js` (354 lines) ✅ - drawCourt(), hoops, lines, arcs, team names, ball positioning

### Status:
✅ All Phase 2 modules extracted
✅ Integration test plan created (see PHASE2_INTEGRATION_TEST.md)
⏳ Ready for Phase 3 (AI systems)

---

## Phase 3-4: Remaining (NOT STARTED)

### AI Systems (Phase 3)
- `ai-offense-ball.js` - Ball handler AI state machine
- `ai-offense-noball.js` - Off-ball offensive positioning
- `ai-defense-onball.js` - On-ball defender logic
- `ai-defense-help.js` - Help defense and switching
- `ai-rebound.js` - Rebound scramble logic

### Game Logic (Phase 4)
- `shooting-system.js` - Shot attempts, probabilities, success checks
- `passing-system.js` - Pass mechanics, interceptions
- `possession-system.js` - Inbounding, possession changes, frontcourt establishment
- `rebound-system.js` - **REBOUND BUG ISOLATION TARGET** 🎯
- `shove-system.js` - Shove mechanics, turbo steal
- `steal-block-system.js` - Steal and block attempts

### UI Systems (Phase 5)
- `score-display.js` - drawScore(), turbo bars, team names
- `menu-system.js` - Team selection, player selection
- `halftime-screen.js` - Stats display
- `announcer-system.js` - Text announcements

---

## Dependency Tree (Completed Modules)

```
nba_jam.js (main file)
├── load("sbbsdefs.js")
├── load("frame.js")
├── load("sprite.js")
├── lib/utils/constants.js
├── lib/utils/helpers.js (depends on: constants.js)
├── lib/rendering/sprite-utils.js (depends on: constants.js)
├── lib/rendering/shoe-colors.js (depends on: constants.js, helpers.js)
├── lib/rendering/player-labels.js (depends on: constants.js, helpers.js)
├── lib/rendering/animation-system.js (depends on: constants.js, helpers.js, sprite-utils.js)
├── lib/game-logic/player-class.js (depends on: constants.js)
├── lib/game-logic/game-state.js (depends on: constants.js)
├── lib/game-logic/movement-physics.js (depends on: constants.js)
└── lib/rendering/court-rendering.js (depends on: constants.js, helpers.js, player-labels.js)
```

---

## Integration Notes

### Preserved Multiplayer Sync
- All Option B coordinator-authoritative sync code remains intact
- Player turbo broadcasts throttled correctly
- No changes to multiplayer event handlers

### Clean Separation Achieved
- No circular dependencies
- Each module has clear purpose
- Helper functions grouped logically
- Constants centralized

### Next Steps
1. Extract `team-data.js` (NBATeams, roster parsing)
2. Run Phase 2 integration test
3. Begin Phase 3 AI extraction (most complex area)
4. Phase 4 game logic (target rebound bug isolation)

---

## Rebound Bug Isolation Plan

Once Phase 4 complete, rebound system will be isolated in `lib/game-logic/rebound-system.js`:
- `initiateRebound()` - Start rebound scramble
- `updateReboundScramble()` - Update scramble each frame
- `resolveRebound()` - Award possession
- Easy to add debug logging
- Easy to test in isolation
- Clear entry/exit points

**Goal**: Transform 13,348-line debugging nightmare into targeted ~200-line module investigation.
