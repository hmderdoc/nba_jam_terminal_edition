# Phase 2 Integration Test Plan

## Status: Phase 2 COMPLETE ✅
**Total extracted: 2,626 lines across 11 modules**

---

## Module Dependency Tree

```
nba_jam.js (main game file)
│
├── EXTERNAL DEPENDENCIES (Synchronet BBS)
│   ├── load("sbbsdefs.js")      - ANSI color constants, key codes
│   ├── load("frame.js")          - Frame class for UI windows
│   └── load("sprite.js")         - Sprite.Aerial class for player sprites
│
├── PHASE 1: UTILITIES & RENDERING (6 modules)
│   │
│   ├── lib/utils/constants.js
│   │   └── Provides: COURT_WIDTH, COURT_HEIGHT, basket coords, speeds,
│   │                 turbo constants, AI thresholds, enums (AI_STATE, ATTR_*)
│   │
│   ├── lib/utils/helpers.js
│   │   ├── Dependencies: constants.js
│   │   └── Provides: debugLog(), getSinglePlayerTempo(), shoe palette system,
│   │                 getTeamBaselineColors(), buryCursor(), cycleFrame()
│   │
│   ├── lib/rendering/sprite-utils.js
│   │   ├── Dependencies: constants.js
│   │   └── Provides: Sprite.Aerial.prototype patches (moveTo, cycle),
│   │                 getCourtScreenOffsetY(), composeAttrWithColor(),
│   │                 scrubSpriteTransparency(), Frame.drawBorder extension
│   │
│   ├── lib/rendering/shoe-colors.js
│   │   ├── Dependencies: constants.js, helpers.js
│   │   └── Provides: applyShoeColorToSprite(), getPlayerTurboColor(),
│   │                 updatePlayerShoeColor(), shoved/shover appearance
│   │
│   ├── lib/rendering/player-labels.js
│   │   ├── Dependencies: constants.js, helpers.js
│   │   └── Provides: ensurePlayerLabelFrame(), renderPlayerLabel(),
│   │                 getDunkLabelText(), getDunkFlashPalette()
│   │
│   └── lib/rendering/animation-system.js
│       ├── Dependencies: constants.js, helpers.js, sprite-utils.js
│       └── Provides: AnimationSystem class with queueShotAnimation(),
│                     queuePassAnimation(), queueReboundAnimation(), update()
│
└── PHASE 2: CORE GAME LOGIC (5 modules)
    │
    ├── lib/game-logic/player-class.js
    │   ├── Dependencies: constants.js
    │   └── Provides: Player constructor, Player.prototype.getSpeed(),
    │                 useTurbo(), rechargeTurbo()
    │
    ├── lib/game-logic/game-state.js
    │   ├── Dependencies: constants.js
    │   └── Provides: createDefaultGameState(), resetGameState(),
    │                 frame variables (courtFrame, ballFrame, etc.),
    │                 ensureBallFrame(), moveBallFrameTo()
    │
    ├── lib/game-logic/team-data.js
    │   ├── Dependencies: (sbbsdefs.js for color constants)
    │   └── Provides: NBATeams object, loadTeamData(), parseRostersINI(),
    │                 generateDefaultTeams(), generateRandomRoster(),
    │                 getColorValue(), getColorCode(), getBackgroundCode(),
    │                 resolveCustomSpriteBase(), resolveSpriteBaseBySkin()
    │
    ├── lib/game-logic/movement-physics.js
    │   ├── Dependencies: constants.js (COURT_WIDTH, speeds, etc.)
    │   └── Provides: checkSpriteCollision(), checkBoundaries(),
    │                 clampSpriteFeetToCourt(), applyMovementCommand(),
    │                 computeMovementBudget(), createMovementCounters(),
    │                 flushKeyboardBuffer(), distance helpers
    │
    └── lib/rendering/court-rendering.js
        ├── Dependencies: constants.js, helpers.js, player-labels.js
        │                (also needs game-state.js for globals: courtFrame,
        │                 gameState, ballFrame, getAllPlayers(), etc.)
        └── Provides: drawCourt(), drawBaselineTeamNames(),
                      drawJerseyNumbers(), updateBallPosition()
```

---

## Correct Load Order

```javascript
// === EXTERNAL DEPENDENCIES ===
load("sbbsdefs.js");           // Synchronet constants
load("frame.js");              // Frame class
load("sprite.js");             // Sprite.Aerial class

// === PHASE 1: UTILITIES ===
load("lib/utils/constants.js");          // (1) No dependencies
load("lib/utils/helpers.js");            // (2) Depends on: constants.js

// === PHASE 1: RENDERING ===
load("lib/rendering/sprite-utils.js");   // (3) Depends on: constants.js
load("lib/rendering/shoe-colors.js");    // (4) Depends on: constants.js, helpers.js
load("lib/rendering/player-labels.js");  // (5) Depends on: constants.js, helpers.js
load("lib/rendering/animation-system.js");// (6) Depends on: constants.js, helpers.js, sprite-utils.js

// === PHASE 2: GAME LOGIC ===
load("lib/game-logic/player-class.js");  // (7) Depends on: constants.js
load("lib/game-logic/game-state.js");    // (8) Depends on: constants.js
load("lib/game-logic/team-data.js");     // (9) Depends on: (sbbsdefs.js)

// === PHASE 2: PHYSICS & RENDERING ===
load("lib/game-logic/movement-physics.js"); // (10) Depends on: constants.js
load("lib/rendering/court-rendering.js");   // (11) Depends on: constants.js, helpers.js, player-labels.js
                                            //      ALSO NEEDS: game-state.js globals

// === REMAINING MONOLITH ===
// Rest of nba_jam.js (AI, game logic, UI, main loop)
```

---

## Integration Test Checklist

### Pre-Test Setup
- [ ] Ensure all 11 module files exist in lib/ structure
- [ ] Verify rosters.ini exists in nba_jam directory
- [ ] Backup current nba_jam.js before modifying

### Test 1: Load Order Validation
**Objective**: Verify modules load without syntax errors

```javascript
// Add at top of nba_jam.js after existing loads:
try {
    load("lib/utils/constants.js");
    load("lib/utils/helpers.js");
    load("lib/rendering/sprite-utils.js");
    load("lib/rendering/shoe-colors.js");
    load("lib/rendering/player-labels.js");
    load("lib/rendering/animation-system.js");
    load("lib/game-logic/player-class.js");
    load("lib/game-logic/game-state.js");
    load("lib/game-logic/team-data.js");
    load("lib/game-logic/movement-physics.js");
    load("lib/rendering/court-rendering.js");
    console.writeln("✓ All Phase 1+2 modules loaded successfully");
} catch (loadErr) {
    console.writeln("✗ Module load failed: " + loadErr);
    exit(1);
}
```

**Expected Result**: "✓ All Phase 1+2 modules loaded successfully"

**Failure Modes**:
- Syntax error → Check module for typos
- Missing dependency → Verify load order
- File not found → Check file paths

### Test 2: Constants Access
**Objective**: Verify constants are available globally

```javascript
// After module loads, test constant access:
console.writeln("COURT_WIDTH = " + COURT_WIDTH);        // Should print: 76
console.writeln("BASKET_LEFT_X = " + BASKET_LEFT_X);    // Should print: 8
console.writeln("MAX_TURBO = " + MAX_TURBO);            // Should print: 100
console.writeln("AI_STATE.OFFENSE_BALL = " + AI_STATE.OFFENSE_BALL); // Should print: offense_ball
```

**Expected Result**: All values print correctly

### Test 3: Helper Functions
**Objective**: Verify helper functions work

```javascript
// Test debugLog (should not crash)
debugLog("TEST", "Integration test running");

// Test team colors
var blueColors = getTeamBaselineColors("blue");
console.writeln("Blue baseline fg = " + blueColors.fg);  // Should be number
console.writeln("Blue baseline bg = " + blueColors.bg);  // Should be number
```

**Expected Result**: No crashes, values are numbers

### Test 4: Team Data Loading
**Objective**: Verify roster parsing

```javascript
// Load team data
loadTeamData();

// Check NBATeams populated
var teamCount = 0;
for (var key in NBATeams) teamCount++;
console.writeln("Loaded " + teamCount + " teams");  // Should be > 0

// Check a specific team
if (NBATeams["lakers"]) {
    console.writeln("Lakers name: " + NBATeams["lakers"].name);
    console.writeln("Lakers roster size: " + NBATeams["lakers"].players.length);
}
```

**Expected Result**: Teams load, roster has players

### Test 5: Game State Creation
**Objective**: Verify game state initializes

```javascript
// Create game state
var gameState = createDefaultGameState();

// Check properties exist
console.writeln("Score blue = " + gameState.score.blue);    // Should be 0
console.writeln("Score red = " + gameState.score.red);      // Should be 0
console.writeln("Time remaining = " + gameState.timeRemaining); // Should be > 0
console.writeln("Shot clock = " + gameState.shotClock);     // Should be 24
```

**Expected Result**: Game state initialized with correct defaults

### Test 6: Player Class
**Objective**: Verify Player constructor works

```javascript
// Create a test player
var testPlayerData = {
    name: "Test Player",
    jersey: 23,
    attributes: [7, 8, 9, 6, 7, 8],
    sprite: null,  // Can be null for test
    shortNick: "TEST"
};

var testPlayer = new Player(
    testPlayerData.name,
    testPlayerData.jersey,
    testPlayerData.attributes,
    testPlayerData.sprite,
    testPlayerData.shortNick
);

console.writeln("Player name: " + testPlayer.name);
console.writeln("Player turbo: " + testPlayer.turbo);      // Should be 100
console.writeln("Player speed attr: " + testPlayer.attributes[ATTR_SPEED]);
```

**Expected Result**: Player object created, turbo = 100

### Test 7: Movement Physics
**Objective**: Verify movement functions exist

```javascript
// Test distance calculation
var dist = distanceBetweenPoints(0, 0, 3, 4);
console.writeln("Distance (3,4): " + dist);  // Should be 5.0

// Test clamping
var clampedX = clampToCourtX(999);
console.writeln("Clamped X (999): " + clampedX);  // Should be <= COURT_WIDTH-7
```

**Expected Result**: Math functions work correctly

### Test 8: Frame Initialization
**Objective**: Verify frames can be created

```javascript
// Create frames (requires BBS environment)
try {
    initFrames();  // From game-state.js
    console.writeln("✓ Frames initialized");
    
    // Check frame existence
    if (courtFrame && courtFrame.is_open) {
        console.writeln("✓ Court frame opened");
    }
    if (scoreFrame && scoreFrame.is_open) {
        console.writeln("✓ Score frame opened");
    }
} catch (frameErr) {
    console.writeln("✗ Frame init failed: " + frameErr);
}
```

**Expected Result**: Frames created successfully (requires terminal)

### Test 9: Court Rendering
**Objective**: Verify court can be drawn (visual check)

```javascript
// Draw court (requires frames initialized)
try {
    drawCourt();
    console.writeln("✓ Court rendered");
    // Visual check: Court should appear with borders, lines, hoops
} catch (courtErr) {
    console.writeln("✗ Court render failed: " + courtErr);
}
```

**Expected Result**: Court visible on screen

### Test 10: Full Game Loop Snippet
**Objective**: Run minimal game loop for 10 frames

```javascript
// Minimal game loop test
loadTeamData();
var gameState = createDefaultGameState();
initFrames();

// Initialize simple sprites (simplified)
// ... sprite init code ...

// Run 10 frames
for (var testFrame = 0; testFrame < 10; testFrame++) {
    gameState.tickCounter = testFrame;
    drawCourt();
    drawScore();
    mswait(100);  // 100ms delay
}

console.writeln("✓ 10-frame loop completed");
```

**Expected Result**: Game runs for 10 frames without crashing

---

## Known Issues to Watch For

### Issue 1: Missing Global Functions
**Symptom**: "getAllPlayers is not defined"
**Cause**: court-rendering.js needs globals from main file
**Fix**: These functions still in nba_jam.js (not yet extracted)

### Issue 2: Circular Dependencies
**Symptom**: Undefined variables at load time
**Cause**: Module A needs Module B, Module B needs Module A
**Fix**: Reorder loads or break circular reference

### Issue 3: Frame Access Before Init
**Symptom**: "courtFrame is undefined"
**Cause**: Trying to use frames before initFrames() called
**Fix**: Ensure initFrames() called before rendering functions

### Issue 4: Sprite Functions Missing
**Symptom**: "mergeShovedBearingsIntoSprite is not defined"
**Cause**: Some sprite functions still in main file (Phase 3+)
**Fix**: Note for future extraction, currently okay

---

## Success Criteria

Phase 2 integration test PASSES if:
1. ✅ All 11 modules load without syntax errors
2. ✅ Constants accessible from all modules
3. ✅ Helper functions execute without crashes
4. ✅ Team data loads from rosters.ini
5. ✅ Game state initializes with correct defaults
6. ✅ Player class instantiates correctly
7. ✅ Movement functions perform correct math
8. ✅ Frames initialize in BBS environment
9. ✅ Court renders visually correct
10. ✅ Minimal game loop runs 10 frames

If all criteria pass → **Ready for Phase 3 (AI extraction)**

---

## Next Steps After Phase 2 Test Passes

1. Document any workarounds needed
2. Create phase3-extraction-plan.md
3. Begin AI system extraction:
   - AI offense with ball
   - AI offense without ball
   - AI defense on-ball
   - AI defense help
   - AI rebound scramble
4. Target: Isolate rebound bug in Phase 4
