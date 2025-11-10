# NBA JAM Terminal Edition - AI Player Design

This document describes the AI system architecture, behavior patterns, and decision-making logic.

---

## Table of Contents

1. [AI Architecture Overview](#ai-architecture-overview)
2. [AI Module Structure](#ai-module-structure)
3. [Decision-Making System](#decision-making-system)
4. [Ball Handler AI](#ball-handler-ai)
5. [Off-Ball Offensive AI](#off-ball-offensive-ai)
6. [Defensive AI](#defensive-ai)
7. [AI Difficulty and Tuning](#ai-difficulty-and-tuning)
8. [Known Issues and Limitations](#known-issues-and-limitations)

---

## AI Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────┐
│           updateAI() (Main Loop)            │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴──────────┐
        │ For each AI player │
        └─────────┬──────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
Ball Handler   Off-Ball      Defense
   AI            AI            AI
```

### AI Update Frequency

**Single Player**:
- AI updated every frame (20 FPS)
- Each AI player processed sequentially

**Demo Mode**:
- All 4 players controlled by AI
- Higher difficulty for entertaining matches

**Multiplayer**:
- Only CPU-controlled players use AI
- Human players use network input
- Coordinator runs AI authoritative ly

---

## AI Module Structure

### Core AI Files

#### 1. `lib/ai/ai-decision-support.js` (295 lines)
**Purpose**: Decision-making utilities and evaluation functions

**Key Functions**:
```javascript
- shouldAIShoot(player)                // Evaluate shot decision
- shouldAIPass(player)                 // Evaluate pass decision
- getOpenTeammate(player)              // Find passing target
- evaluateShootingPosition(player)     // Shot quality (0.0-1.0)
- getDefensivePriority(defender)       // Defensive target selection
```

#### 2. `lib/ai/ai-movement-utils.js` (112 lines)
**Purpose**: Movement and pathfinding

**Key Functions**:
```javascript
- moveAITowards(player, targetX, targetY)  // Navigate to point
- calculateAISpeed(player)                  // Speed based on stats
- avoidOutOfBounds(player)                  // Boundary collision
- findClearPath(player, target)             // Obstacle avoidance
```

#### 3. `lib/ai/ai-ball-handler.js` (178 lines)
**Purpose**: Behavior when AI has ball

**Key Functions**:
```javascript
- handleAIBallCarrier(player)          // Main ball handler logic
- aiDribbleToBasket(player)            // Drive to hoop
- aiPassToOpen(player, teammate)       // Execute pass
- aiTakeShot(player)                   // Shoot attempt
```

#### 4. `lib/ai/ai-movement.js` (234 lines)
**Purpose**: Off-ball and defensive behavior

**Key Functions**:
```javascript
- handleAIOffBall(player)              // Offensive positioning
- handleAIDefense(player)              // Defensive behavior
- getOffensiveSpot(player)             // Find good position
- guardOpponent(defender, opponent)    // Man-to-man defense
```

---

## Decision-Making System

### Strategy Pattern

AI behavior is selected based on game context:

```javascript
function updateAI() {
    var allPlayers = getAllPlayers();
    
    for (var i = 0; i < allPlayers.length; i++) {
        var player = allPlayers[i];
        
        if (!player.isHuman) {
            // STRATEGY SELECTION
            if (player === gameState.ballCarrier) {
                handleAIBallCarrier(player);     // Ball handler strategy
            } else if (player.team === gameState.currentTeam) {
                handleAIOffBall(player);         // Offensive strategy
            } else {
                handleAIDefense(player);         // Defensive strategy
            }
        }
    }
}
```

### Decision Tree Structure

Each AI strategy follows a hierarchical decision tree:

```
Ball Handler Decision Tree:
├─ In shooting range?
│  ├─ Yes → Shot quality > 0.7?
│  │  ├─ Yes → SHOOT
│  │  └─ No → Continue evaluation
│  └─ No → Continue evaluation
├─ Closely guarded?
│  ├─ Yes → Open teammate?
│  │  ├─ Yes → PASS
│  │  └─ No → DRIVE TO BASKET
│  └─ No → DRIVE TO BASKET
└─ Shot clock < 3?
    └─ Yes → FORCED SHOT
```

---

## Ball Handler AI

### Main Logic Flow

**File**: `lib/ai/ai-ball-handler.js`

```javascript
function handleAIBallCarrier(player) {
    // 1. Evaluate shooting position
    var shotQuality = evaluateShootingPosition(player);
    
    // 2. Check if closely guarded
    var closestDefender = getClosestPlayer(player.x, player.y, opponentTeam);
    var guardDistance = getSpriteDistance(player, closestDefender);
    var closelyGuarded = guardDistance <= 4;
    
    // 3. Decision tree
    if (shotQuality >= 0.8) {
        // High-quality shot → take it
        return aiTakeShot(player);
    }
    
    if (closelyGuarded) {
        // Guarded → look for pass
        var openTeammate = getOpenTeammate(player);
        
        if (openTeammate) {
            return aiPassToOpen(player, openTeammate);
        } else {
            // No open teammate → drive
            return aiDribbleToBasket(player);
        }
    }
    
    // Not guarded, not in range → drive to basket
    return aiDribbleToBasket(player);
}
```

### Shot Quality Evaluation

```javascript
function evaluateShootingPosition(player) {
    var distanceToBasket = getSpriteDistanceToBasket(player, player.team);
    var closestDefender = getClosestPlayer(player.x, player.y, opponentTeam);
    var defenderDistance = getSpriteDistance(player, closestDefender);
    
    var quality = 0.0;
    
    // Distance factor (closer = better)
    if (distanceToBasket < 5) {
        quality += 0.5;  // Very close (dunk range)
    } else if (distanceToBasket < 10) {
        quality += 0.3;  // Mid-range
    } else if (distanceToBasket < 20) {
        quality += 0.1;  // Long range
    }
    
    // Defender factor (open = better)
    if (defenderDistance > 8) {
        quality += 0.3;  // Wide open
    } else if (defenderDistance > 4) {
        quality += 0.1;  // Somewhat open
    }
    
    // Player stats factor
    quality += (player.playerData.shootingRating / 100) * 0.2;
    
    return Math.min(1.0, quality);
}
```

### Passing Logic

```javascript
function getOpenTeammate(player) {
    var teammate = getPlayerTeammate(player);
    if (!teammate) return null;
    
    // Check if teammate is open
    var closestDefender = getClosestPlayer(teammate.x, teammate.y, opponentTeam);
    var defenderDistance = getSpriteDistance(teammate, closestDefender);
    
    // Teammate is "open" if defender is >6 units away
    if (defenderDistance > 6) {
        return teammate;
    }
    
    return null;
}

function aiPassToOpen(player, teammate) {
    // Calculate pass direction
    var dx = teammate.x - player.x;
    var dy = teammate.y - player.y;
    
    // Execute pass
    passBall(player, teammate, dx, dy);
}
```

### Dribble to Basket

```javascript
function aiDribbleToBasket(player) {
    var basketX = getBasketPosition(player.team);
    var basketY = BASKET_Y;
    
    // Move towards basket
    moveAITowards(player, basketX, basketY);
    
    // Use turbo if not closely guarded
    var closestDefender = getClosestPlayer(player.x, player.y, opponentTeam);
    var guardDistance = getSpriteDistance(player, closestDefender);
    
    if (guardDistance > 5) {
        player.turboActive = true;
    }
}
```

---

## Off-Ball Offensive AI

### Positioning Strategy

**File**: `lib/ai/ai-movement.js`

**Goal**: Find open space to receive pass

```javascript
function handleAIOffBall(player) {
    var ballHandler = gameState.ballCarrier;
    
    if (!ballHandler || ballHandler === player) {
        // No ball carrier, just spread out
        return moveToDefaultPosition(player);
    }
    
    // Find offensive spot
    var offensiveSpot = getOffensiveSpot(player, ballHandler);
    
    // Move to spot
    moveAITowards(player, offensiveSpot.x, offensiveSpot.y);
}
```

### Offensive Spot Selection

```javascript
function getOffensiveSpot(player, ballHandler) {
    var basketX = getBasketPosition(player.team);
    var basketY = BASKET_Y;
    
    // Position near basket but not in ball handler's path
    var offsetX = (Math.random() - 0.5) * 10;
    var offsetY = (Math.random() - 0.5) * 6;
    
    return {
        x: basketX + offsetX,
        y: basketY + offsetY
    };
}
```

### Screen Setting (Not Implemented)

**Potential Feature**:
```javascript
// TODO: Off-ball player sets screens for ball handler
function shouldSetScreen(player, ballHandler) {
    var closestDefender = getClosestPlayer(ballHandler.x, ballHandler.y, opponentTeam);
    
    // If ball handler is guarded, position for screen
    if (getSpriteDistance(ballHandler, closestDefender) < 4) {
        return true;
    }
    
    return false;
}
```

---

## Defensive AI

### Man-to-Man Defense

**File**: `lib/ai/ai-movement.js`

```javascript
function handleAIDefense(player) {
    // 1. Select defensive assignment
    var target = getDefensivePriority(player);
    
    if (!target) {
        // No target, return to default position
        return moveToDefaultPosition(player);
    }
    
    // 2. Guard opponent
    guardOpponent(player, target);
}
```

### Defensive Priority

```javascript
function getDefensivePriority(defender) {
    var opponentTeam = getOpposingTeam(defender.team);
    var opponents = getTeamSprites(opponentTeam);
    
    // Priority 1: Guard ball carrier
    if (gameState.ballCarrier && opponents.includes(gameState.ballCarrier)) {
        return gameState.ballCarrier;
    }
    
    // Priority 2: Guard closest opponent
    var closest = null;
    var minDistance = 999;
    
    for (var i = 0; i < opponents.length; i++) {
        var distance = getSpriteDistance(defender, opponents[i]);
        if (distance < minDistance) {
            minDistance = distance;
            closest = opponents[i];
        }
    }
    
    return closest;
}
```

### Guard Behavior

```javascript
function guardOpponent(defender, opponent) {
    // Position between opponent and basket
    var basketX = getBasketPosition(opponent.team);
    var basketY = BASKET_Y;
    
    // Calculate defensive position (between opponent and basket)
    var guardX = opponent.x + (basketX - opponent.x) * 0.3;
    var guardY = opponent.y + (basketY - opponent.y) * 0.3;
    
    // Move to defensive position
    moveAITowards(defender, guardX, guardY);
    
    // Attempt steal if close enough
    var distance = getSpriteDistance(defender, opponent);
    if (distance < 2 && opponent === gameState.ballCarrier) {
        attemptSteal(defender, opponent);
    }
}
```

### Steal Logic

```javascript
function attemptSteal(defender, ballCarrier) {
    // Check steal recovery timer (can't spam steals)
    if (defender.stealRecovery > 0) {
        return;
    }
    
    // Calculate steal success based on stats
    var stealRating = defender.playerData.stealRating || 50;
    var ballHandlingRating = ballCarrier.playerData.ballHandlingRating || 50;
    
    var stealChance = (stealRating - ballHandlingRating + 50) / 100;
    stealChance = clamp(stealChance, 0.1, 0.9);
    
    // Roll for steal
    if (Math.random() < stealChance) {
        // Successful steal
        transferBall(ballCarrier, defender);
        announceEvent("steal", { player: defender });
    }
    
    // Set recovery timer (prevent spam)
    defender.stealRecovery = 30;  // ~1.5 seconds at 20 FPS
}
```

---

## AI Difficulty and Tuning

### Difficulty Factors

**1. Reaction Time**:
```javascript
// Higher difficulty = faster reactions
var aiDelay = {
    easy: 10,      // 500ms delay
    medium: 5,     // 250ms delay
    hard: 2,       // 100ms delay
    arcade: 0      // Instant
};
```

**2. Shot Accuracy**:
```javascript
function calculateShotAccuracy(player, difficulty) {
    var baseAccuracy = player.playerData.shootingRating / 100;
    
    var difficultyMod = {
        easy: 0.7,      // 70% of rating
        medium: 1.0,    // 100% of rating
        hard: 1.2,      // 120% of rating
        arcade: 1.5     // 150% of rating (NBA JAM AI cheats!)
    };
    
    return baseAccuracy * difficultyMod[difficulty];
}
```

**3. Decision Quality**:
```javascript
function shouldAIShoot(player, difficulty) {
    var shotQuality = evaluateShootingPosition(player);
    
    var threshold = {
        easy: 0.9,      // Only shoot wide open
        medium: 0.7,    // Shoot when reasonably open
        hard: 0.5,      // Shoot contested shots
        arcade: 0.3     // Shoot anything
    };
    
    return shotQuality >= threshold[difficulty];
}
```

### Current Difficulty Settings

**Single Player**: Medium (default)  
**Demo Mode**: Hard (entertaining matches)  
**Multiplayer**: Medium (balanced with human players)

**No User Selection**: Difficulty is hardcoded (could be menu option)

---

## AI Coordination

### Team Play

**Problem**: AI teammates don't coordinate well

**Current State**:
- Ball handler AI makes independent decisions
- Off-ball AI positions randomly
- No play calling or set plays

**Potential Improvements**:

#### 1. Pick and Roll
```javascript
function executePickAndRoll(ballHandler, screener) {
    // Screener moves to set screen
    var screenPos = {
        x: ballHandler.x + 3,
        y: ballHandler.y
    };
    moveAITowards(screener, screenPos.x, screenPos.y);
    
    // Ball handler drives after screen set
    if (isScreenSet(screener, screenPos)) {
        aiDribbleToBasket(ballHandler);
    }
}
```

#### 2. Pass-and-Cut
```javascript
function passThenCut(passer, receiver) {
    // Execute pass
    passBall(passer, receiver);
    
    // Passer cuts to basket after passing
    var basketX = getBasketPosition(passer.team);
    var basketY = BASKET_Y;
    moveAITowards(passer, basketX, basketY);
}
```

**Status**: NOT IMPLEMENTED (future feature)

---

## Known Issues and Limitations

### Issue 1: AI Gets Stuck in Corners

**Symptom**: AI dribbles into corner and can't get out

**Cause**: No corner escape logic

```javascript
// MISSING
function escapeCorner(player) {
    if (isInCorner(player)) {
        // Move away from corner
        var centerX = COURT_WIDTH / 2;
        var centerY = COURT_HEIGHT / 2;
        moveAITowards(player, centerX, centerY);
    }
}
```

**Workaround**: 5-second violation triggers turnover

### Issue 2: AI Passes Out of Bounds

**Symptom**: AI sometimes passes to teammate who is out of bounds

**Cause**: No bounds checking before passing

**Fix Needed**:
```javascript
function getOpenTeammate(player) {
    var teammate = getPlayerTeammate(player);
    if (!teammate) return null;
    
    // ADD: Check if teammate is in bounds
    if (isOutOfBounds(teammate.x, teammate.y)) {
        return null;
    }
    
    // ... rest of logic
}
```

### Issue 3: Defensive AI Too Aggressive

**Symptom**: AI fouls excessively (if fouls were enforced)

**Cause**: Steal attempts every frame when close

**Fix**:
```javascript
// Add cooldown between steal attempts
if (distance < 2 && defender.stealCooldown <= 0) {
    attemptSteal(defender, ballCarrier);
    defender.stealCooldown = 20;  // 1 second
}
```

**Status**: NOT CRITICAL (fouls not enforced in NBA JAM)

### Issue 4: No Fast Break Awareness

**Symptom**: AI doesn't push tempo after steal/rebound

**Current**: AI always walks the ball up  
**Should**: Sprint on fast breaks

**Potential Fix**:
```javascript
function handleAIBallCarrier(player) {
    // Check for fast break opportunity
    if (isFastBreak(player)) {
        player.turboActive = true;
        return aiDribbleToBasket(player);  // Drive hard
    }
    
    // Normal offense
    return normalOffense(player);
}

function isFastBreak(player) {
    var opponents = getOpposingTeamSprites(player.team);
    var ourSide = (player.team === "teamA") ? (x) => x < COURT_WIDTH / 2 : (x) => x > COURT_WIDTH / 2;
    
    // Fast break if no opponents on our offensive side
    for (var i = 0; i < opponents.length; i++) {
        if (ourSide(opponents[i].x)) {
            return false;  // Opponent back on defense
        }
    }
    
    return true;  // Open court!
}
```

**Status**: NOT IMPLEMENTED

---

## Recommendations

### High Priority
1. **Fix corner stuck bug** - Add escape logic
2. **Bounds checking for passes** - Prevent out-of-bounds passes
3. **Fast break awareness** - More dynamic gameplay

### Medium Priority
4. **Difficulty selection menu** - Let user choose AI level
5. **Steal cooldown** - Reduce spam
6. **Better shot selection** - Context-aware shooting

### Low Priority (Future Features)
7. **Team coordination** - Pick and roll, screens
8. **Play calling** - Preset offensive plays
9. **Adaptive AI** - Learn from player behavior

---

## Conclusion

**Strengths**:
- Modular AI system (easy to extend)
- Context-sensitive strategy selection
- Reasonable decision-making

**Weaknesses**:
- Gets stuck in corners
- No team coordination
- No fast break awareness
- Passes to out-of-bounds teammates

**Overall**: AI provides functional opposition and makes game playable, but lacks sophistication of modern game AI. Good foundation for future improvements.

**Next Steps**: Fix corner bug and add bounds checking for passes as priority 1 issues.
