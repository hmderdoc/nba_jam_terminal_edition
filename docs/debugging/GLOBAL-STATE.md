# Global State References Inventory

**Purpose**: Map all direct `gameState` references that bypass the State Manager  
**Related**: docs/architecture/WAVE-23-ARCHITECTURE.md  
**Status**: 144 instances identified (partial migration)

## Summary

Wave 23 introduced dependency injection with `systems.stateManager` API, but the UI layer still has 144 direct `gameState` references. These work because `gameState` is still in global scope, but they violate the architecture and create coupling.

| Category | Count | Files | Priority |
|----------|-------|-------|----------|
| UI Rendering | ~120 | lib/ui/*.js | Medium |
| Game Logic | ~15 | lib/game-logic/*.js | High |
| Menus | ~9 | lib/menus/*.js | Low |

## Architecture Context

### Wave 23 State Manager API

**Correct Usage**:
```javascript
// Read state
var quarter = systems.stateManager.get('game.quarter');
var score = systems.stateManager.get('players.home.0.score');
var fullState = systems.stateManager.get(); // entire state

// Write state
systems.stateManager.set('game.shotClock', 24, 'reset shot clock');
systems.stateManager.set('ball.possessingPlayer', playerId, 'turnover');
```

**Incorrect (Legacy)**:
```javascript
// Direct global access ❌
var quarter = gameState.game.quarter;
gameState.game.shotClock = 24;
```

### Why This Matters

1. **Testing**: Can't inject mock state for unit tests
2. **Tracking**: State mutations aren't logged with reasons
3. **Debugging**: No visibility into what changed state when
4. **Architecture**: Violates dependency injection principle
5. **Future**: Can't easily move to message-passing or immutable state

## High Priority: Game Logic (15 instances)

These are in game logic files and should use systems.stateManager:

### lib/game-logic/*.js

**TODO**: Run grep to identify exact files and lines

**Expected files**:
- physical-play.js (ball position checks, collision)
- shots.js (player position, shooting state)
- defense-actions.js (defensive player state)
- phase-handler.js (game phase, clock state)

**Pattern to fix**:
```javascript
// Before
function checkCollision(player) {
    if (player.x === gameState.ball.x) { // ❌
        // ...
    }
}

// After
function checkCollision(player, systems) {
    var ball = systems.stateManager.get('ball');
    if (player.x === ball.x) { // ✅
        // ...
    }
}
```

## Medium Priority: UI Layer (120 instances)

Most references are in UI rendering code. These are lower priority because UI code typically just reads state for display.

### lib/ui/scoreboard.js

**Estimated**: ~30 references

```javascript
// Example patterns (exact lines TBD)
var homeScore = gameState.players.home[0].score;
var quarter = gameState.game.quarter;
var shotClock = gameState.game.shotClock;
```

**Migration approach**:
1. Add `systems` parameter to all UI functions
2. Thread systems through call chain (already done for some)
3. Replace gameState with systems.stateManager.get()

### lib/ui/court.js

**Estimated**: ~40 references

Court rendering reads many state properties:
- Player positions (x, y coordinates)
- Ball position
- Player sprites/animations
- Team indicators
- Possession arrows

### lib/ui/stats-display.js

**Estimated**: ~25 references

Stats screen reads:
- Player stats (points, rebounds, assists)
- Team stats
- Game time
- Quarter

### lib/ui/game-over.js

**Estimated**: ~15 references

Game over screen reads:
- Final scores
- Player stats
- Game result
- MVP determination

### Other UI Files

**Estimated**: ~10 references total
- lib/ui/player-sprite.js
- lib/ui/indicators.js
- Any other UI utilities

## Low Priority: Menus (9 instances)

Menu code rarely changes game state, mostly just reads for display.

### lib/menus/team-select.js

**Estimated**: ~5 references

Reads team roster, player names, attributes for selection UI.

### lib/menus/options-menu.js

**Estimated**: ~4 references

Reads/writes game options, settings.

## Migration Strategy

### Phase A: Game Logic (High Priority)

1. Run grep to find exact gameState references in lib/game-logic/
2. For each function with gameState access:
   - Add `systems` parameter if missing
   - Replace `gameState.path.to.value` with `systems.stateManager.get('path.to.value')`
   - Update all call sites to pass systems
3. Test each file after migration
4. Remove any remaining global gameState dependencies

**Estimated effort**: 3-4 commits

### Phase B: UI Layer (Medium Priority)

This is the bulk of the work (120 references).

**Approach 1: Gradual (Recommended)**
- Migrate one UI file at a time
- Start with scoreboard.js (already partially migrated)
- Then court.js, stats-display.js, etc.
- Each file is one commit

**Approach 2: Big Bang**
- Use sed/grep to replace all at once
- Risk: breaks everything if pattern wrong
- Not recommended given complexity

**Estimated effort**: 8-10 commits

### Phase C: Menus (Low Priority)

- Migrate after UI layer is done
- Lowest risk of breaking gameplay
- Can be deferred to later wave if needed

**Estimated effort**: 2-3 commits

## Technical Challenges

### Challenge 1: Deep Property Access

**Problem**: Many UI calls access nested properties
```javascript
var score = gameState.players.home[0].score; // ❌
```

**Solution**: State Manager supports path strings
```javascript
var score = systems.stateManager.get('players.home.0.score'); // ✅
```

### Challenge 2: Frequent Reads

**Problem**: UI code reads same state multiple times per frame
```javascript
function drawCourt(systems) {
    var p1x = systems.stateManager.get('players.home.0.x');
    var p1y = systems.stateManager.get('players.home.0.y');
    var p2x = systems.stateManager.get('players.away.0.x');
    // ... many more reads
}
```

**Solution 1**: Cache state at frame boundary
```javascript
function drawCourt(systems) {
    var state = systems.stateManager.get(); // Get full state once
    var p1x = state.players.home[0].x;
    var p1y = state.players.home[0].y;
    // ... use cached state
}
```

**Solution 2**: Pass state to inner functions
```javascript
function drawCourt(systems) {
    var players = systems.stateManager.get('players');
    drawPlayers(players);
}
```

### Challenge 3: Call Chain Threading

**Problem**: UI functions call other UI functions, systems must thread through
```javascript
// Before
function drawGame() {
    drawCourt();
    drawPlayers();
    drawUI();
}

// After
function drawGame(systems) {
    drawCourt(systems);
    drawPlayers(systems);
    drawUI(systems);
}
```

**Status**: Partially done (scoreboard.js already threaded)  
**Remaining**: Most UI files still need systems parameter added

### Challenge 4: Performance

**Problem**: State Manager has getter overhead vs direct property access

**Impact**: Likely negligible, but worth measuring  
**Mitigation**: Cache full state for hot paths (rendering loop)

## Testing Strategy

### Unit Tests
- Mock stateManager.get() to return test data
- Verify UI functions don't access global gameState
- Test with isolated state (no global pollution)

### Integration Tests
- Full game render test
- Verify all UI elements display correctly
- Check performance (FPS) is acceptable

### Regression Tests
- Visual comparison before/after migration
- Ensure no display bugs introduced
- Verify all stats/scores/indicators work

## Grep Commands for Analysis

```bash
# Find all direct gameState references
grep -rn "gameState\." lib/ --include="*.js" | wc -l

# Game logic files only
grep -rn "gameState\." lib/game-logic/ --include="*.js"

# UI layer files only  
grep -rn "gameState\." lib/ui/ --include="*.js"

# Menu files only
grep -rn "gameState\." lib/menus/ --include="*.js"

# Find files with most references
grep -rh "gameState\." lib/ --include="*.js" | cut -d: -f1 | sort | uniq -c | sort -rn

# Find write operations (mutations)
grep -rn "gameState\.[a-zA-Z.]* =" lib/ --include="*.js"
```

## Success Criteria

- [ ] 0 gameState references in lib/game-logic/
- [ ] <10 gameState references in lib/ui/ (only documented exceptions)
- [ ] All UI renders correctly
- [ ] No performance regression
- [ ] All tests passing
- [ ] gameState can be removed from global scope (stretch goal)

## Migration Checklist

### Per-File Process
1. [ ] Run grep to count references in file
2. [ ] Add systems parameter to all functions needing state
3. [ ] Replace gameState.x with systems.stateManager.get('x')
4. [ ] Update all call sites to pass systems
5. [ ] Run tests for that file
6. [ ] Run full game test
7. [ ] Commit with message "Migrate [file] to State Manager API"

### Per-Function Pattern
```javascript
// 1. Before
function drawSomething() {
    var value = gameState.some.value; // ❌
    console.print(value);
}

// 2. Add systems parameter
function drawSomething(systems) {
    var value = gameState.some.value; // Still wrong
    console.print(value);
}

// 3. Replace global access
function drawSomething(systems) {
    var value = systems.stateManager.get('some.value'); // ✅
    console.print(value);
}

// 4. Update call sites
// Before: drawSomething();
// After:  drawSomething(systems);
```

## Open Questions

1. Should UI layer cache full state or make granular get() calls?
2. What's acceptable performance overhead for State Manager?
3. Can we remove gameState from global scope after migration?
4. Should menus use State Manager or direct state is acceptable?
5. How to handle hot paths (60fps rendering) efficiently?

## Related Documentation

- **Wave 23 Architecture**: docs/architecture/WAVE-23-ARCHITECTURE.md
- **State Manager API**: docs/architecture/WAVE-23-ARCHITECTURE.md#state-manager-api
- **Migration Guide**: docs/waves/WAVE-23-MIGRATION-GUIDE.md

## Deferred Work

This migration is NOT blocking for Wave 23C (timing refactor). The UI can continue using direct gameState references while we fix the timing system.

**Reason**: Timing issues are preventing game from running. UI state access doesn't block gameplay, just violates architecture.

**When to do this**: After Wave 23C completes and game is playable again.

## Performance Baseline

**TODO**: Measure before migration
- FPS during gameplay
- Frame render time
- State access frequency per frame

**After migration**: Compare to ensure no regression
