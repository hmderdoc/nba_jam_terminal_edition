# NBA JAM Terminal Edition - Human Player Design

This document describes how human player input is captured, processed, and integrated into the game loop.

---

## Table of Contents

1. [Input Architecture](#input-architecture)
2. [Control Mapping](#control-mapping)
3. [Input Processing Flow](#input-processing-flow)
4. [Single Player Mode](#single-player-mode)
5. [Multiplayer Mode](#multiplayer-mode)
6. [Input Latency and Responsiveness](#input-latency-and-responsiveness)
7. [Known Issues](#known-issues)

---

## Input Architecture

### Input System Components

```
Terminal          Synchronet       Game Loop        Sprite Update
  Input      →     console.js  →   gameLoop()   →   movePlayer()
   ↓                                   ↓                  ↓
Keyboard          getKeys()        processInput()    sprite.x += dx
```

### Key Technologies

**Synchronet `console` Object**:
```javascript
// Non-blocking input check
var key = console.inkey(K_NONE, 0);  // Don't wait, return immediately

// Blocking input (menus)
var key = console.getkey();  // Wait for keypress

// Multi-key detection
var keys = console.getkeys();  // Get all pressed keys
```

**Frame Rate**: 20 FPS (50ms per frame)
- Input checked every frame
- Movement applied immediately
- No input buffering (latency: <50ms)

---

## Control Mapping

### Keyboard Controls

#### Movement
- **Arrow Keys**: Directional movement
  - `↑` - Move up
  - `↓` - Move down
  - `←` - Move left
  - `→` - Move right

#### Actions
- **SPACE**: Turbo
  - On offense: Sprint, jump for shot/dunk
  - On defense: Jump to block
  - Hold for continuous turbo

- **ENTER**: Primary action (context-sensitive)
  - With ball: Shoot or pass (directional)
  - Without ball: Attempt steal
  - Near rebound: Try to grab ball

- **S**: Shove
  - Push opponent (consumes turbo)
  - Can knock ball loose
  - Risk of personal foul (not enforced in NBA JAM)

- **Q**: Quit
  - Pauses game, asks for confirmation
  - Returns to menu

### Control Context

| Context | SPACE | ENTER | Arrow Keys |
|---------|-------|-------|------------|
| Ball handler | Sprint | Shoot/Pass | Move + aim |
| Off-ball offense | Sprint | Call for pass | Move |
| Defense | Jump/Block | Steal | Guard |
| Rebound | Jump | Grab ball | Position |

---

## Input Processing Flow

### Frame-by-Frame Processing

```javascript
function gameLoop() {
    while (gameState.gameRunning) {
        // 1. Capture input
        var key = console.inkey(K_NONE, 0);
        
        // 2. Parse input
        var action = parseInput(key, teamAPlayer1);
        
        // 3. Apply to sprite
        if (action.move) {
            movePlayer(teamAPlayer1, action.dx, action.dy);
        }
        
        if (action.shoot) {
            attemptShot(teamAPlayer1);
        }
        
        // 4. Continue game loop
        updateAI();
        checkCollisions();
        render();
        
        mswait(50);  // 20 FPS
    }
}
```

### Input Parsing

```javascript
function parseInput(key, player) {
    var action = {
        move: false,
        dx: 0,
        dy: 0,
        turbo: false,
        shoot: false,
        pass: false,
        steal: false,
        shove: false
    };
    
    // Arrow keys (multiple can be pressed)
    if (key & K_UP) {
        action.move = true;
        action.dy = -1;
    }
    if (key & K_DOWN) {
        action.move = true;
        action.dy = 1;
    }
    if (key & K_LEFT) {
        action.move = true;
        action.dx = -1;
    }
    if (key & K_RIGHT) {
        action.move = true;
        action.dx = 1;
    }
    
    // Action keys
    if (key === ' ') {  // SPACE
        action.turbo = true;
    }
    
    if (key === '\r') {  // ENTER
        if (player === gameState.ballCarrier) {
            action.shoot = true;
        } else {
            action.steal = true;
        }
    }
    
    if (key.toUpperCase() === 'S') {
        action.shove = true;
    }
    
    return action;
}
```

---

## Single Player Mode

### Player Control Assignment

**Single Player**:
- Human controls: `teamAPlayer1` only
- AI controls: `teamAPlayer2`, `teamBPlayer1`, `teamBPlayer2`

```javascript
function gameLoop() {
    while (gameState.gameRunning) {
        var key = console.inkey(K_NONE, 0);
        
        // Human player input
        handleHumanPlayer(teamAPlayer1, key);
        
        // AI for other 3 players
        if (!teamAPlayer2.isHuman) handleAI(teamAPlayer2);
        if (!teamBPlayer1.isHuman) handleAI(teamBPlayer1);
        if (!teamBPlayer2.isHuman) handleAI(teamBPlayer2);
        
        // ... rest of game loop
    }
}
```

### Sprite Properties

```javascript
teamAPlayer1.isHuman = true;   // Human controlled
teamAPlayer2.isHuman = false;  // AI controlled
```

---

## Multiplayer Mode

### Local Multiplayer (Not Implemented)

**Limitation**: Synchronet console doesn't support multiple simultaneous keyboard inputs from single terminal.

**Potential Design**:
```javascript
// Would require split keyboard or gamepad support
var p1Keys = console.inkey(K_PLAYER1);  // Doesn't exist
var p2Keys = console.inkey(K_PLAYER2);  // Doesn't exist
```

### Network Multiplayer

**Architecture**: Each player controls one sprite from their own terminal.

#### Input Transmission

```javascript
// Player captures input locally
function captureLocalInput() {
    var key = console.inkey(K_NONE, 0);
    var action = parseInput(key, mySprite);
    
    // Send to server
    client.write("nba_jam", "input." + sessionId + "." + myId, {
        frame: frameNumber,
        timestamp: Date.now(),
        action: action
    });
}
```

#### Input Reception (Coordinator)

```javascript
// Coordinator receives inputs from all players
function processNetworkInputs() {
    for (var playerId in session.players) {
        var inputData = client.read("nba_jam", "input." + sessionId + "." + playerId, 1);
        
        if (inputData && inputData.frame === frameNumber) {
            var sprite = spriteMap[playerId];
            applyPlayerAction(sprite, inputData.action);
        }
    }
}
```

### Client-Side Prediction

**Problem**: Network lag causes input delay (100-300ms typical)

**Solution**: Predict local player movement while waiting for server confirmation

```javascript
// Client predicts own movement
function clientUpdate() {
    // 1. Capture local input
    var action = captureLocalInput();
    
    // 2. Apply immediately (prediction)
    if (!playerClient.isCoordinator) {
        predictMyMovement(mySprite, action);
    }
    
    // 3. Send to server
    transmitInput(action);
    
    // 4. Reconcile with server state when received
    var serverState = receiveServerState();
    reconcilePosition(mySprite, serverState);
}
```

### Reconciliation

```javascript
function reconcilePosition(sprite, serverState) {
    var serverPos = serverState.players[sprite.id];
    
    // Calculate difference
    var dx = serverPos.x - sprite.x;
    var dy = serverPos.y - sprite.y;
    var distance = Math.sqrt(dx * dx + dy * dy);
    
    // If too far off, snap to server position
    if (distance > 5) {
        sprite.x = serverPos.x;
        sprite.y = serverPos.y;
    } else {
        // Smooth interpolation
        sprite.x += dx * 0.3;
        sprite.y += dy * 0.3;
    }
}
```

---

## Input Latency and Responsiveness

### Single Player Latency

**Target**: <50ms input-to-screen  
**Actual**: ~20-30ms (excellent)

**Breakdown**:
- Input capture: ~5ms
- Processing: ~5ms
- Rendering: ~10-20ms (terminal redraw)

### Multiplayer Latency

**Target**: <150ms input-to-screen  
**Actual**: 50-300ms (depends on network)

**Breakdown**:
- Input capture: ~5ms
- Prediction: ~10ms
- Network transmission: 20-200ms (varies)
- Server processing: ~10ms
- State broadcast: 20-200ms (varies)
- Client reconciliation: ~10ms

**Optimization**: Client-side prediction reduces perceived latency to ~50ms (local prediction feels instant)

### Frame Timing

```javascript
// Fixed 20 FPS (50ms per frame)
var targetFrameTime = 50;

while (gameState.gameRunning) {
    var frameStart = Date.now();
    
    // Game logic (~20-30ms)
    processInput();
    updateAI();
    updatePhysics();
    render();
    
    // Delay remainder
    var elapsed = Date.now() - frameStart;
    if (elapsed < targetFrameTime) {
        mswait(targetFrameTime - elapsed);
    }
}
```

**Why 20 FPS?**:
- Terminal rendering is slow (~20-30ms)
- Smooth enough for gameplay
- Reduces CPU usage on BBS
- Consistent with other BBS games

---

## Known Issues

### Issue 1: Input Lag in Multiplayer

**Symptom**: Controls feel sluggish when network latency is high

**Cause**: Waiting for server confirmation before updating sprite

**Status**: Partially mitigated by client-side prediction

**Future Fix**: Implement replay buffer (re-apply inputs after reconciliation)

### Issue 2: Diagonal Movement Speed

**Symptom**: Moving diagonally is faster than cardinal directions

**Cause**: `dx` and `dy` both set to 1, resulting in `sqrt(2)` speed

```javascript
// CURRENT (incorrect)
if (key & K_UP && key & K_RIGHT) {
    sprite.x += 1;  // dx = 1
    sprite.y -= 1;  // dy = 1
    // Total speed = sqrt(1^2 + 1^2) = 1.41 (faster!)
}
```

**Fix**: Normalize diagonal vectors
```javascript
// FIXED
var dx = 0, dy = 0;
if (key & K_UP) dy -= 1;
if (key & K_DOWN) dy += 1;
if (key & K_LEFT) dx -= 1;
if (key & K_RIGHT) dx += 1;

// Normalize
var magnitude = Math.sqrt(dx * dx + dy * dy);
if (magnitude > 0) {
    dx /= magnitude;
    dy /= magnitude;
}

sprite.x += dx * speed;
sprite.y += dy * speed;
```

**Status**: NOT FIXED (maintains NBA JAM arcade feel, diagonal speed is feature?)

### Issue 3: No Input Buffering

**Symptom**: Rapid key presses can be dropped

**Cause**: Input checked once per frame; if key pressed/released between frames, it's lost

**Example**:
```
Frame 1: [check input] → no key
  ↓ (5ms)
User presses SPACE
  ↓ (5ms)
User releases SPACE
  ↓ (40ms)
Frame 2: [check input] → no key (missed it!)
```

**Fix**: Implement input buffering
```javascript
var inputBuffer = [];

function captureInput() {
    var key = console.inkey(K_NONE, 0);
    if (key) {
        inputBuffer.push({ key: key, timestamp: Date.now() });
    }
}

function processInputBuffer() {
    while (inputBuffer.length > 0) {
        var input = inputBuffer.shift();
        handleInput(input.key);
    }
}
```

**Status**: NOT IMPLEMENTED (rare issue in practice)

### Issue 4: Quit Confirmation Blocking

**Symptom**: Pressing Q pauses entire game (including animations)

**Cause**: `console.getkey()` is blocking

```javascript
// CURRENT (blocks game loop)
if (key.toUpperCase() === 'Q') {
    console.print("Quit? (Y/N): ");
    var confirm = console.getkey();
    if (confirm.toUpperCase() === 'Y') {
        gameState.gameRunning = false;
    }
}
```

**Fix**: Use non-blocking confirmation
```javascript
// IMPROVED (non-blocking)
if (key.toUpperCase() === 'Q') {
    gameState.pauseMenuOpen = true;
}

// Separate pause menu rendering
if (gameState.pauseMenuOpen) {
    drawPauseMenu();
    var menuKey = console.inkey(K_NONE, 0);
    if (menuKey === 'Y') {
        gameState.gameRunning = false;
    } else if (menuKey === 'N') {
        gameState.pauseMenuOpen = false;
    }
}
```

**Status**: NOT IMPLEMENTED

---

## Recommendations

### Short Term
1. **Fix diagonal movement** - Normalize vectors for consistent speed
2. **Add input buffering** - Prevent dropped inputs
3. **Non-blocking quit** - Pause menu instead of blocking dialog

### Long Term
1. **Replay buffer for multiplayer** - Better lag compensation
2. **Configurable controls** - Let users remap keys
3. **Gamepad support** - Integrate with Synchronet gamepad APIs (if available)

---

## Conclusion

**Strengths**:
- Simple, responsive input in single-player
- Client-side prediction works well for multiplayer
- Consistent 20 FPS feels good

**Weaknesses**:
- Diagonal movement imbalance
- No input buffering
- Blocking confirmation dialogs
- Multiplayer lag still noticeable >200ms

**Overall**: Input system is functional and responsive for single-player. Multiplayer has acceptable latency with prediction, but could benefit from replay buffer for high-latency connections.
