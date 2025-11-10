# NBA JAM Terminal Edition - File Layout

Complete file structure documentation after Wave 4 and Wave 5 refactoring.

## Overview

The codebase is organized into specialized modules with clear separation of concerns:
- **Main File**: 1,311 lines (down from 2,610) - orchestration only
- **Library Modules**: 50+ files organized by function
- **Total Reduction**: 47% smaller, 9 new modules created

---

## Root Directory

### Main Entry Point
```
nba_jam.js (1,311 lines)
├─ Main orchestration and game loops
├─ Entry point: main()
├─ Game modes: gameLoop(), runCPUDemo(), runMultiplayerMode()
└─ Minimal implementation details (mostly delegation)
```

**Key Functions**:
- `main()` - Program entry, menu routing
- `initFrames()` - Frame initialization
- `cleanupSprites()` - Resource cleanup
- `gameLoop()` - Single-player game loop
- `runCPUDemo()` - Demo mode loop
- `runMultiplayerMode()` - Multiplayer orchestration

---

## Library Structure: `/lib`

### Core Systems (`/lib/core`)

#### `sprite-init.js` (423 lines)
**Purpose**: Player sprite creation and initialization
```javascript
// Functions:
- initSprites()              // Main sprite initialization
- createPlayerSprite()       // Individual sprite creation
- initMultiplayerSprites()   // Multiplayer sprite setup
- createMultiplayerSpriteMap() // Sprite mapping for network sync
```
**Dependencies**: Frame.js, team-data.js
**Used By**: nba_jam.js (all game modes)

#### `state-management.js` (164 lines)
**Purpose**: Global game state container
```javascript
// Game State Object:
var gameState = {
    gameRunning, timeRemaining, currentHalf,
    shotClock, currentTeam, ballCarrier,
    scores: { teamA, teamB },
    violations: {...},
    multiplayer: {...}
}

// Functions:
- resetGameState()           // Initialize/reset state
- getGameState()             // Read-only accessor
```
**Dependencies**: None (pure state container)
**Used By**: Everything (central state)

#### `physics.js` (206 lines)
**Purpose**: Sprite collision detection and physics
```javascript
// Functions:
- checkSpriteCollision()     // Main collision handler
- handlePlayerCollisions()   // Player-player physics
- handleBallCollisions()     // Ball-player interactions
- calculateBounce()          // Collision response
```
**Dependencies**: state-management.js, positioning-helpers.js
**Used By**: gameLoop(), multiplayer loops

---

### Game Logic (`/lib/game-logic`)

#### `game-utils.js` (93 lines) - Wave 4
**Purpose**: Core game state helper functions
```javascript
// Functions:
- getAllPlayers()            // Get all 4 player sprites
- isPlayerOnCourt()          // Check sprite validity
- getActivePlayerCount()     // Count active players
- getBallHandler()           // Get current ball carrier
```
**Created**: Wave 4 extraction
**Dependencies**: state-management.js
**Used By**: AI systems, game loops

#### `violations.js` (287 lines)
**Purpose**: Rule enforcement and violation detection
```javascript
// Functions:
- checkViolations()                    // Master violation checker
- enforceBackcourtViolation()          // 8-second rule
- enforceFiveSecondViolation()         // Closely guarded
- isInBackcourt()                      // Court position check
- wouldBeOverAndBack()                 // Backcourt prediction
```
**Dependencies**: state-management.js, positioning-helpers.js
**Used By**: gameLoop(), multiplayer loops

#### `stats-tracker.js` (128 lines)
**Purpose**: Player statistics tracking
```javascript
// Functions:
- recordStat()               // Record individual stat
- getPlayerStats()           // Get player's stats
- getTeamStats()             // Get team totals
- clearStats()               // Reset for new game
```
**Dependencies**: state-management.js
**Used By**: scoring, announcer, game-over screen

#### `dead-dribble.js` (43 lines) - Wave 5
**Purpose**: Dead dribble timer management
```javascript
// Functions:
- resetDeadDribbleTimer()              // Clear timer
- isBallHandlerDribbleDead()           // Check if picked up
- getBallHandlerDeadElapsed()          // Get elapsed time
```
**Created**: Wave 5 extraction
**Dependencies**: state-management.js
**Used By**: gameLoop(), violation checking

#### `team-data.js` (436 lines)
**Purpose**: NBA team definitions and rosters
```javascript
// Data Structures:
- NBATeams{}                 // All 30 teams
- Each team: {
    name, abbreviation, city,
    primaryColor, secondaryColor,
    players: [6 player objects]
  }

// Functions:
- loadTeamData()             // Parse team JSON
- getTeamByKey()             // Team lookup
- getPlayerData()            // Player lookup
```
**Dependencies**: None (data provider)
**Used By**: Team selection, sprite init, rosters

---

### AI Systems (`/lib/ai`)

#### `ai-decision-support.js` (295 lines)
**Purpose**: AI decision-making utilities
```javascript
// Functions:
- shouldAIShoot()            // Shot decision logic
- shouldAIPass()             // Pass decision logic
- getOpenTeammate()          // Find passing target
- evaluateShootingPosition() // Shot quality assessment
- getDefensivePriority()     // Defensive target selection
```
**Dependencies**: positioning-helpers.js, player-helpers.js
**Used By**: ai-ball-handler.js, ai-movement.js

#### `ai-movement-utils.js` (112 lines)
**Purpose**: AI movement and pathfinding
```javascript
// Functions:
- moveAITowards()            // Navigate to target
- calculateAISpeed()         // Dynamic speed based on stats
- avoidOutOfBounds()         // Boundary checking
- findClearPath()            // Obstacle avoidance
```
**Dependencies**: positioning-helpers.js
**Used By**: All AI behavior modules

#### `ai-ball-handler.js` (178 lines)
**Purpose**: AI behavior when holding ball
```javascript
// Functions:
- handleAIBallCarrier()      // Main ball handler AI
- aiDribbleToBasket()        // Drive to hoop
- aiPassToOpen()             // Execute pass
- aiTakeShot()               // Shoot attempt
```
**Dependencies**: ai-decision-support.js, ai-movement-utils.js
**Used By**: updateAI() in game loops

#### `ai-movement.js` (234 lines)
**Purpose**: AI behavior without ball
```javascript
// Functions:
- handleAIOffBall()          // Offensive positioning
- handleAIDefense()          // Defensive behavior
- getOffensiveSpot()         // Find good position
- guardOpponent()            // Man-to-man defense
```
**Dependencies**: ai-decision-support.js, ai-movement-utils.js, player-helpers.js
**Used By**: updateAI() in game loops

---

### Multiplayer (`/lib/multiplayer`)

#### `mp_coordinator.js` (412 lines)
**Purpose**: Authoritative game server
```javascript
// Class: GameCoordinator
- init()                     // Setup coordinator
- update()                   // Broadcast game state
- processInput()             // Handle client inputs
- resolveConflicts()         // Collision resolution
```
**Dependencies**: state-management.js, json-db
**Used By**: runMultiplayerMode() (coordinator player only)

#### `mp_client.js` (387 lines)
**Purpose**: Non-authoritative player client
```javascript
// Class: PlayerClient
- init()                     // Connect to game
- sendInput()                // Transmit player actions
- receiveState()             // Get server updates
- predictMovement()          // Client-side prediction
```
**Dependencies**: state-management.js, json-db
**Used By**: runMultiplayerMode() (all players)

#### `mp_lobby.js` (523 lines)
**Purpose**: Multiplayer session management
```javascript
// Functions:
- runMultiplayerLobby()      // Main lobby interface
- createSession()            // New game session
- joinSession()              // Join existing session
- selectTeamsMultiplayer()   // Team selection screen
```
**Dependencies**: mp_sessions.js, json-db
**Used By**: runMultiplayerMode()

#### `mp_sessions.js` (298 lines)
**Purpose**: Session data management
```javascript
// Functions:
- createGameSession()        // Initialize session data
- updateSession()            // Modify session state
- getActiveSessions()        // List available games
- deleteSession()            // Cleanup finished games
```
**Dependencies**: json-db
**Used By**: mp_lobby.js, mp_coordinator.js

---

### Rendering (`/lib/rendering`)

#### `sprite-utils.js` (267 lines)
**Purpose**: Sprite rendering and manipulation
```javascript
// Functions:
- createSpriteFromData()     // Build Frame object
- updateSpritePosition()     // Move sprite
- setSpriteVisibility()      // Show/hide
- applySpriteEffect()        // Visual effects (fire, etc.)
```
**Dependencies**: Frame.js
**Used By**: sprite-init.js, animation systems

#### `fire-effects.js` (50 lines) - Wave 4
**Purpose**: "On fire" visual effects
```javascript
// Functions:
- getFireColor()             // Get fire palette color
- applyFireEffect()          // Apply fire to sprite
- updateFireAnimation()      // Cycle fire colors
```
**Created**: Wave 4 extraction
**Dependencies**: sprite-utils.js
**Used By**: Hot streak rendering

#### `uniform-system.js` (174 lines) - Wave 5
**Purpose**: Team uniform color application
```javascript
// Functions:
- applyUniformMask()         // Apply team colors to sprite
- getUniformColors()         // Get team color scheme
- blendUniformColor()        // Mix colors
```
**Created**: Wave 5 extraction
**Dependencies**: team-data.js
**Used By**: sprite-init.js (during sprite creation)

---

### UI Systems (`/lib/ui`)

#### `menus.js` (345 lines)
**Purpose**: Main menu and navigation
```javascript
// Functions:
- mainMenu()                 // Main menu loop
- teamSelectionScreen()      // Team picker
- showIntro()                // Intro animation
- showSplashScreen()         // ANSI splash art
```
**Dependencies**: rendering/sprite-utils.js
**Used By**: main()

#### `score-display.js` (612 lines)
**Purpose**: HUD and score rendering
```javascript
// Functions:
- drawScore()                // Render scoreboard
- ensureScoreFontLoaded()    // Load score sprites
- renderScoreDigits()        // Draw numbers
- updateScoreFrame()         // Refresh HUD
```
**Dependencies**: state-management.js, string-helpers.js
**Used By**: All game loops

#### `announcer.js` (456 lines)
**Purpose**: Play-by-play commentary system
```javascript
// Functions:
- announceEvent()            // Trigger announcement
- drawAnnouncerLine()        // Display text
- loadAnnouncerData()        // Load commentary JSON
- selectAnnouncement()       // Random selection
```
**Dependencies**: state-management.js
**Used By**: Scoring, violations, game events

#### `halftime.js` (123 lines)
**Purpose**: Halftime screen
```javascript
// Functions:
- showHalftimeScreen()       // Display halftime stats
- renderHalftimeStats()      // Player statistics
- handleHalftimeInput()      // User interaction
```
**Dependencies**: stats-tracker.js, score-display.js
**Used By**: gameLoop() (at half)

#### `game-over.js` (187 lines)
**Purpose**: End game screen
```javascript
// Functions:
- showGameOver()             // Display results
- renderFinalStats()         // Final statistics
- getGameOverChoice()        // Play again / quit / new teams
```
**Dependencies**: stats-tracker.js
**Used By**: gameLoop(), runCPUDemo()

#### `controller-labels.js` (55 lines) - Wave 5
**Purpose**: Controller alias display on sprites
```javascript
// Functions:
- sanitizeControllerAlias()  // Clean user input
- setSpriteControllerLabel() // Attach label to sprite
- applyDefaultControllerLabels() // Set default labels
```
**Created**: Wave 5 extraction
**Dependencies**: sprite-utils.js
**Used By**: Multiplayer sprite initialization

#### `demo-results.js` (47 lines) - Wave 4
**Purpose**: Demo game results collection
```javascript
// Functions:
- collectGameResults()       // Gather game stats for betting
```
**Created**: Wave 4 extraction
**Dependencies**: state-management.js
**Used By**: runCPUDemo() (betting resolution)

---

### Animation (`/lib/animation`)

#### `knockback-system.js` (175 lines) - Wave 4
**Purpose**: Shove/knockback animations
```javascript
// Functions:
- knockBack()                // Initiate knockback
- updateKnockbackAnimations() // Update active knockbacks
- calculateKnockbackVector() // Physics calculation
```
**Created**: Wave 4 extraction
**Dependencies**: positioning-helpers.js
**Used By**: Collision system, shove actions

#### `animation-system.js` (234 lines)
**Purpose**: Non-blocking animation manager
```javascript
// Class: AnimationSystem
- startAnimation()           // Begin animation
- update()                   // Frame update
- isBallAnimating()          // Check active animations
- clearAnimations()          // Stop all
```
**Dependencies**: sprite-utils.js
**Used By**: Shot arcs, passes, dunks

---

### Utilities (`/lib/utils`)

#### `positioning-helpers.js` (189 lines)
**Purpose**: Spatial calculations and geometry
```javascript
// Functions:
- getSpriteDistance()        // Distance between sprites
- getSpriteDistanceToBasket() // Distance to hoop
- clamp()                    // Constrain value
- getTouchingOpponents()     // Collision detection
- getBearingVector()         // Direction calculation
```
**Dependencies**: state-management.js
**Used By**: AI, physics, violations

#### `player-helpers.js` (184 lines)
**Purpose**: Player sprite query utilities
```javascript
// Functions:
- getAllPlayers()            // Get all 4 players
- getClosestPlayer()         // Nearest player to point
- getPlayerTeamName()        // Get team ("teamA"/"teamB")
- getPlayerTeammate()        // Get partner sprite
- getOpposingTeam()          // Get opponent array
```
**Dependencies**: state-management.js
**Used By**: AI, game logic, violations

#### `team-helpers.js` (22 lines) - Wave 5
**Purpose**: Team sprite queries
```javascript
// Functions:
- getTeamSprites()           // Get team array by name
- getOpposingTeamSprites()   // Get opponent array
```
**Created**: Wave 5 extraction
**Dependencies**: Global sprite references
**Used By**: AI, violations, game logic

#### `string-helpers.js` (68 lines) - Wave 4
**Purpose**: String formatting utilities
```javascript
// Functions:
- padStart()                 // Left pad string
- padEnd()                   // Right pad string
- repeatChar()               // Repeat character
- getTimeMs()                // Timestamp string
```
**Created**: Wave 4 extraction
**Dependencies**: None
**Used By**: Score display, debugging

---

### Bookie System (`/lib/bookie`)

#### `bookie.js` (312 lines)
**Purpose**: Betting system for demo mode
```javascript
// Functions:
- showBettingInterface()     // Betting screen
- placeBet()                 // Process wager
- calculateOdds()            // Determine odds
- showBettingResults()       // Display winnings
```
**Dependencies**: team-data.js, stats-tracker.js
**Used By**: runCPUDemo()

---

### LORB Integration (`/lib/lorb`)

#### `lorb.js` (456 lines)
**Purpose**: League play integration
```javascript
// Functions:
- runLorbMode()              // League interface
- submitGameResult()         // Report to league
- getStandings()             // Fetch standings
```
**Dependencies**: External LORB system
**Used By**: main() (LORB menu option)

---

## Dependency Graph

### High-Level Flow
```
main()
  ├─> mainMenu()                 [lib/ui/menus.js]
  ├─> initSprites()              [lib/core/sprite-init.js]
  │     └─> applyUniformMask()   [lib/rendering/uniform-system.js]
  ├─> gameLoop()                 [nba_jam.js]
  │     ├─> checkViolations()    [lib/game-logic/violations.js]
  │     ├─> updateAI()           [lib/ai/*.js]
  │     ├─> checkSpriteCollision() [lib/core/physics.js]
  │     └─> drawScore()          [lib/ui/score-display.js]
  └─> runMultiplayerMode()       [nba_jam.js]
        ├─> runMultiplayerLobby() [lib/multiplayer/mp_lobby.js]
        ├─> GameCoordinator      [lib/multiplayer/mp_coordinator.js]
        └─> PlayerClient         [lib/multiplayer/mp_client.js]
```

### Core Dependencies (Most Used)
1. **state-management.js** - Used by 40+ modules
2. **positioning-helpers.js** - Used by 15+ modules
3. **player-helpers.js** - Used by 12+ modules
4. **sprite-utils.js** - Used by 10+ modules

### Module Categories by Coupling

**Zero Dependencies** (Pure):
- state-management.js (state container)
- team-data.js (data provider)
- string-helpers.js (utilities)

**Low Coupling** (1-2 dependencies):
- fire-effects.js
- dead-dribble.js
- team-helpers.js
- knockback-system.js

**Medium Coupling** (3-5 dependencies):
- ai-decision-support.js
- violations.js
- stats-tracker.js

**High Coupling** (6+ dependencies):
- mp_coordinator.js (multiplayer complexity)
- ai-ball-handler.js (AI decision tree)
- score-display.js (rendering + state + data)

---

## File Metrics

### By Line Count (Top 10)
1. mp_lobby.js - 523 lines
2. announcer.js - 456 lines
3. lorb.js - 456 lines
4. team-data.js - 436 lines
5. sprite-init.js - 423 lines
6. mp_coordinator.js - 412 lines
7. mp_client.js - 387 lines
8. menus.js - 345 lines
9. bookie.js - 312 lines
10. mp_sessions.js - 298 lines

### By Category
- **Core**: ~793 lines (3 files)
- **Game Logic**: ~987 lines (5 files)
- **AI**: ~819 lines (4 files)
- **Multiplayer**: ~1,620 lines (4 files)
- **Rendering**: ~491 lines (3 files)
- **UI**: ~1,825 lines (7 files)
- **Animation**: ~409 lines (2 files)
- **Utilities**: ~463 lines (4 files)
- **Bookie**: ~312 lines (1 file)
- **LORB**: ~456 lines (1 file)

**Total Library Code**: ~8,175 lines (34 modules)  
**Main File**: 1,311 lines  
**Grand Total**: ~9,486 lines

---

## Wave 4 & 5 Extractions

### Wave 4 (5 modules created)
1. **string-helpers.js** (68 lines) - Formatting utilities
2. **fire-effects.js** (50 lines) - Visual effects
3. **game-utils.js** (93 lines) - Core helpers
4. **knockback-system.js** (175 lines) - Shove animations
5. **demo-results.js** (47 lines) - Betting results

### Wave 5 (4 modules created)
1. **uniform-system.js** (174 lines) - Team colors
2. **controller-labels.js** (55 lines) - Sprite labels
3. **team-helpers.js** (22 lines) - Team queries
4. **dead-dribble.js** (43 lines) - Dribble timer

**Total Extracted**: 727 lines  
**Duplicates Removed**: 694 lines  
**Net Reduction**: 1,224 lines (47%)

---

## Future Refactoring Opportunities

### Potential Extractions
1. **Inbound logic** from gameLoop() → `lib/game-logic/inbound-system.js` (~50 lines)
2. **Shot logic** from gameLoop() → `lib/game-logic/shooting-system.js` (~80 lines)
3. **Rebound scramble** → `lib/game-logic/rebound-system.js` (~60 lines)
4. **Hot streak** → `lib/game-logic/hot-streak-system.js` (~40 lines)

### Module Consolidation
- Merge `team-helpers.js` into `player-helpers.js` (both are team/player queries)
- Merge `demo-results.js` into `bookie.js` (betting-related)

### Dependency Cleanup
- Remove duplicate `getTeamSprites()` definitions
- Centralize sprite globals (currently scattered)

---

## Summary

**Strengths**:
- Clear separation of concerns (AI, UI, multiplayer, core)
- Modular design allows independent testing
- Main file is pure orchestration (minimal implementation)

**Challenges**:
- Some tight coupling (multiplayer ↔ state)
- Sprite globals scattered across files
- Duplicate helper functions in multiple modules

**Metrics**:
- 34 library modules + 1 main file
- ~9,500 total lines of code
- 47% reduction from original monolith
- Average module size: 240 lines
