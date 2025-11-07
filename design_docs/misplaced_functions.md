# NBA JAM Terminal Edition - Misplaced Functions

This document identifies functions that are defined in modules that don't match their logical purpose, with recommendations for relocation.

---

## Table of Contents

1. [Team/Player Query Duplicates](#1-teamplayer-query-duplicates)
2. [Positioning Logic Scattered](#2-positioning-logic-scattered)
3. [Game Logic in UI Modules](#3-game-logic-in-ui-modules)
4. [UI Code in Game Logic](#4-ui-code-in-game-logic)
5. [State Mutations in Helper Functions](#5-state-mutations-in-helper-functions)

---

## 1. Team/Player Query Duplicates

### Problem
Team and player query functions are defined in multiple overlapping modules.  
**Status**: ✅ **FIXED** in Wave 10 (commit 9bf4172 - removed team-helpers.js duplicate)

### Misplaced Functions

#### `getTeamSprites()` and `getOpposingTeamSprites()`

**Currently in**: 
- ✅ `lib/utils/player-helpers.js` (184 lines) - **CORRECT LOCATION**
- ❌ `lib/utils/team-helpers.js` (22 lines) - **DUPLICATE**

```javascript
// player-helpers.js (KEEP)
function getTeamSprites(teamName) {
    return teamName === "teamA"
        ? [teamAPlayer1, teamAPlayer2]
        : [teamBPlayer1, teamBPlayer2];
}

// team-helpers.js (REMOVE - duplicate)
function getTeamSprites(teamName) {
    return teamName === "teamA"
        ? [teamAPlayer1, teamAPlayer2]
        : [teamBPlayer1, teamBPlayer2];
}
```

### Recommendation

**Action**: Delete `lib/utils/team-helpers.js` entirely

**Reasoning**:
- Only 22 lines (2 functions)
- Both functions are exact duplicates of player-helpers.js
- No unique functionality
- Created in Wave 5 extraction but overlaps with existing player-helpers.js

**Migration**:
```bash
# Update all imports
# FROM:
load(js.exec_dir + "lib/utils/team-helpers.js");

# TO:
load(js.exec_dir + "lib/utils/player-helpers.js");

# Delete file
rm lib/utils/team-helpers.js
```

---

## 2. Positioning Logic Scattered

### Problem
Spatial calculation functions split across multiple modules with duplicates.  
**Status**: ✅ **FIXED** in Wave 10 (commit 4ab119f - removed getTouchingOpponents duplicate)

### Misplaced Functions

#### `getTouchingOpponents()`

**Currently in**:
- ✅ `lib/utils/positioning-helpers.js` - **CORRECT LOCATION** (spatial logic)
- ❌ `lib/utils/player-helpers.js` - **DUPLICATE/MISPLACED** (player queries)

```javascript
// positioning-helpers.js (KEEP - spatial logic)
function getTouchingOpponents(player, teamName, radius) {
    var opponents = getOpposingTeamSprites(teamName);
    var touching = [];
    
    for (var i = 0; i < opponents.length; i++) {
        var distance = getSpriteDistance(player, opponents[i]);
        if (distance <= radius) {
            touching.push(opponents[i]);
        }
    }
    
    return touching;
}

// player-helpers.js (REMOVE - duplicate)
function getTouchingOpponents(player, teamName, radius) {
    // Same implementation
}
```

### Recommendation

**Action**: Remove `getTouchingOpponents()` from `player-helpers.js`

**Reasoning**:
- Performs spatial calculations (distance checks) → belongs in positioning-helpers.js
- player-helpers.js should query players, not calculate distances
- Reduces duplication

**Update Dependencies**:
```javascript
// Files that call getTouchingOpponents() should load positioning-helpers.js
load(js.exec_dir + "lib/utils/positioning-helpers.js");
```

---

## 3. Game Logic in UI Modules

### Problem
UI modules contain business logic that should be in game-logic modules.  
**Status**: ✅ **FIXED** in Wave 11 (commit e767932 - created score calculator module)

### Misplaced Functions

#### Hot Streak Logic in `score-display.js`

**Currently in**: `lib/ui/score-display.js` (612 lines)  
**Should be in**: `lib/game-logic/hot-streak-system.js` (new module)

```javascript
// score-display.js (MISPLACED - UI module contains game logic)
function drawScore() {
    // Rendering (CORRECT - belongs here)
    scoreFrame.clear();
    
    // GAME LOGIC (MISPLACED - doesn't belong in UI)
    if (teamAPlayer1.consecutiveMakes >= 3) {
        teamAPlayer1.hotStreak = true;
        applyFireEffect(teamAPlayer1);
    }
    
    // Rendering (CORRECT)
    renderScoreDigits(gameState.scores.teamA);
}
```

**Recommendation**:

**Action**: Extract hot streak logic to `lib/game-logic/hot-streak-system.js`

```javascript
// NEW FILE: lib/game-logic/hot-streak-system.js
function updateHotStreaks() {
    var allPlayers = getAllPlayers();
    for (var i = 0; i < allPlayers.length; i++) {
        var player = allPlayers[i];
        
        // Game logic: Determine hot streak status
        if (player.consecutiveMakes >= 3) {
            player.hotStreak = true;
        } else {
            player.hotStreak = false;
        }
    }
}

function isPlayerOnFire(player) {
    return player.hotStreak === true;
}
```

**Updated score-display.js**:
```javascript
// lib/ui/score-display.js (UI only)
function drawScore() {
    scoreFrame.clear();
    
    // Query hot streak status (read-only)
    if (isPlayerOnFire(teamAPlayer1)) {
        renderFireSprite(teamAPlayer1);
    }
    
    renderScoreDigits(gameState.scores.teamA);
}
```

**Benefits**:
- Hot streak logic testable without Frame.js
- Can update hot streaks independently of rendering
- UI becomes pure presentation

---

#### Score Calculation in `score-display.js`

**Currently in**: `lib/ui/score-display.js`  
**Should be in**: `lib/game-logic/score-calculator.js` (new module)

```javascript
// score-display.js (MISPLACED)
function calculateLeadingTeam() {
    if (gameState.scores.teamA > gameState.scores.teamB) {
        return "teamA";
    } else if (gameState.scores.teamB > gameState.scores.teamA) {
        return "teamB";
    } else {
        return "tie";
    }
}

function getScoreDifferential() {
    return Math.abs(gameState.scores.teamA - gameState.scores.teamB);
}
```

**Recommendation**:

**Action**: Extract to `lib/game-logic/score-calculator.js`

```javascript
// NEW FILE: lib/game-logic/score-calculator.js
function getLeadingTeam() {
    var diff = gameState.scores.teamA - gameState.scores.teamB;
    if (diff > 0) return "teamA";
    if (diff < 0) return "teamB";
    return "tie";
}

function getScoreDifferential() {
    return Math.abs(gameState.scores.teamA - gameState.scores.teamB);
}

function isBlowout() {
    return getScoreDifferential() >= 20;
}

function isCloseGame() {
    return getScoreDifferential() <= 5;
}
```

**Benefits**:
- Score logic reusable (announcer can use it too)
- Easier to test business rules
- UI just renders data, doesn't calculate it

---

## 4. UI Code in Game Logic

### Problem
Game logic modules trigger UI updates or contain rendering code.

### Misplaced Functions

#### Announcer Calls in `violations.js`

**Currently in**: `lib/game-logic/violations.js` (287 lines)  
**Should be**: Observer pattern - violations emit events, announcer observes

```javascript
// violations.js (MISPLACED - game logic triggers UI directly)
function enforceBackcourtViolation() {
    // Game logic (CORRECT)
    var timeInBackcourt = Date.now() - gameState.backcourt.entryTime;
    
    if (timeInBackcourt > 8000) {
        // UI CODE (MISPLACED - directly calling UI)
        announceEvent("backcourt_violation", {
            team: gameState.currentTeam
        });
        
        // Game logic (CORRECT)
        switchPossession();
        gameState.shotClock = 24;
    }
}
```

**Recommendation**:

**Action**: Use event emission instead of direct UI calls

```javascript
// violations.js (REFACTORED - emit events, don't call UI)
function enforceBackcourtViolation() {
    var timeInBackcourt = Date.now() - gameState.backcourt.entryTime;
    
    if (timeInBackcourt > 8000) {
        // Emit event (game logic)
        emitGameEvent("violation", {
            type: "backcourt",
            team: gameState.currentTeam
        });
        
        // Apply penalty (game logic)
        switchPossession();
        gameState.shotClock = 24;
        
        return true;  // Violation occurred
    }
    
    return false;
}
```

**Event Handler** (in main loop or announcer):
```javascript
// Subscribe to events
onGameEvent("violation", function(data) {
    if (data.type === "backcourt") {
        announceEvent("backcourt_violation", data);
    }
});
```

**Benefits**:
- Game logic doesn't depend on UI
- Can test violations without announcer
- Can add multiple observers (stats, multiplayer sync, etc.)

---

#### Direct Frame Manipulation in `knockback-system.js`

**Currently in**: `lib/animation/knockback-system.js` (175 lines)  
**Issue**: Mixes animation logic with sprite rendering

```javascript
// knockback-system.js (MIXED CONCERNS)
function updateKnockbackAnimations() {
    for (var i = 0; i < activeKnockbacks.length; i++) {
        var kb = activeKnockbacks[i];
        
        // Animation logic (CORRECT - belongs here)
        kb.elapsed += 16;
        var progress = kb.elapsed / kb.duration;
        
        // Direct sprite manipulation (QUESTIONABLE)
        kb.sprite.x = kb.startX + (kb.vectorX * progress);
        kb.sprite.y = kb.startY + (kb.vectorY * progress);
        
        // Frame rendering (MISPLACED - should be in rendering module)
        kb.sprite.frame.moveTo(kb.sprite.x, kb.sprite.y);
    }
}
```

**Recommendation**:

**Action**: Separate animation state from rendering

```javascript
// knockback-system.js (ANIMATION LOGIC ONLY)
function updateKnockbackAnimations() {
    for (var i = 0; i < activeKnockbacks.length; i++) {
        var kb = activeKnockbacks[i];
        
        // Update animation state
        kb.elapsed += 16;
        var progress = kb.elapsed / kb.duration;
        
        // Calculate new position
        kb.sprite.x = kb.startX + (kb.vectorX * progress);
        kb.sprite.y = kb.startY + (kb.vectorY * progress);
        
        // Flag for rendering (don't render directly)
        kb.sprite.dirty = true;
    }
}

// SEPARATE: lib/rendering/sprite-renderer.js
function renderSprites() {
    var allSprites = getAllPlayers();
    for (var i = 0; i < allSprites.length; i++) {
        var sprite = allSprites[i];
        
        if (sprite.dirty) {
            sprite.frame.moveTo(sprite.x, sprite.y);
            sprite.dirty = false;
        }
    }
}
```

**Benefits**:
- Animation system doesn't depend on Frame.js
- Can test animation logic without rendering
- Separation of concerns (calculate vs render)

---

## 5. State Mutations in Helper Functions

### Problem
"Helper" functions that are supposed to be read-only actually mutate game state.

### Misplaced Functions

#### `getAllPlayers()` in `player-helpers.js`

**Currently in**: `lib/utils/player-helpers.js`  
**Issue**: Name implies read-only, but might mutate (check implementation)

```javascript
// player-helpers.js
function getAllPlayers() {
    // CORRECT: Read-only
    return [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
}
```

**Status**: ✅ This one is actually fine (read-only)

---

#### `decrementStealRecovery()` in `game-utils.js`?

**Currently in**: Somewhere in game loops (check implementation)  
**Issue**: "Helper" function that mutates player state

```javascript
// Example of MISPLACED mutation in helper
function decrementStealRecovery(player) {
    // STATE MUTATION (should be explicit, not hidden in "helper")
    if (player.stealRecovery > 0) {
        player.stealRecovery--;
    }
}
```

**Recommendation**:

**Action**: Rename to make mutation explicit, or move to state-management module

**Option 1**: Rename
```javascript
// Clearly indicates mutation
function updateStealRecovery(player) {
    if (player.stealRecovery > 0) {
        player.stealRecovery--;
    }
}
```

**Option 2**: Move to state module
```javascript
// lib/core/state-management.js
function updatePlayerRecoveryTimers() {
    var allPlayers = getAllPlayers();
    for (var i = 0; i < allPlayers.length; i++) {
        if (allPlayers[i].stealRecovery > 0) {
            allPlayers[i].stealRecovery--;
        }
    }
}
```

**Benefits**:
- Clear which functions mutate state
- Easier to track state changes
- Reduces hidden side effects

---

## Relocation Summary Table

| Function | Current Location | Should Be In | Reason | Priority |
|----------|------------------|--------------|--------|----------|
| `getTeamSprites()` | team-helpers.js | player-helpers.js | Duplicate | High (easy) |
| `getOpposingTeamSprites()` | team-helpers.js | player-helpers.js | Duplicate | High (easy) |
| `getTouchingOpponents()` | player-helpers.js | positioning-helpers.js | Spatial logic | Medium |
| Hot streak logic | score-display.js | hot-streak-system.js (new) | Game logic in UI | Medium |
| Score calculation | score-display.js | score-calculator.js (new) | Game logic in UI | Medium |
| `announceEvent()` calls | violations.js | Event emission | UI in game logic | Low |
| Frame rendering | knockback-system.js | sprite-renderer.js (new) | Rendering in logic | Low |

---

## Migration Plan

### Phase 1: Remove Duplicates (1 hour)
1. Delete `lib/utils/team-helpers.js`
2. Update all imports to use `player-helpers.js`
3. Remove duplicate `getTouchingOpponents()` from `player-helpers.js`

### Phase 2: Extract Game Logic from UI (3-4 hours)
1. Create `lib/game-logic/hot-streak-system.js`
2. Create `lib/game-logic/score-calculator.js`
3. Move logic from `score-display.js` to new modules
4. Update `score-display.js` to be pure presentation

### Phase 3: Remove UI from Game Logic (2-3 hours)
1. Implement event emission in `violations.js`
2. Create event subscription system
3. Update announcer to observe events instead of being called directly

### Phase 4: Separate Rendering (4-5 hours)
1. Create `lib/rendering/sprite-renderer.js`
2. Move frame manipulation from `knockback-system.js`
3. Implement dirty flag pattern for sprites

---

## Testing Strategy

After migrations, verify:

1. **No Regressions**: All game modes still work
2. **No Duplicates**: `grep` for duplicate function definitions
3. **Clean Dependencies**: 
   - UI modules don't import game-logic
   - game-logic modules don't import UI
4. **Testability**: Can mock dependencies for unit tests

---

## Expected Benefits

**Code Quality**:
- 22 fewer lines (delete team-helpers.js)
- ~100 lines relocated (better organization)
- Zero duplicates

**Maintainability**:
- Clear separation of concerns
- Easier to locate functions
- Better testability

**Future Development**:
- Can change UI without breaking game logic
- Can add new UIs (web, debug) easily
- Can test game rules independently

---

## Conclusion

**Total Functions to Relocate**: ~12 functions  
**Estimated Effort**: 10-13 hours  
**Impact**: High (improves architecture significantly)

**Recommended Order**:
1. Phase 1 (duplicates) - Quick win, low risk
2. Phase 2 (game logic extraction) - High impact
3. Phase 3 (UI removal) - Medium impact
4. Phase 4 (rendering separation) - Nice to have

Start with Phase 1 in next refactoring wave (Wave 7) as it's low-hanging fruit.
