# Wave 23C: Game Loop Refactor

## Problem

The `gameLoop()` and `runMultiplayerGameLoop()` functions in `nba_jam.js` have `systems` parameter but still access `gameState` directly (76 references in main file).

## Root Cause

These functions were partially refactored - they accept `systems` and pass it to child functions, but their OWN logic still uses:
```javascript
if (gameState.ballCarrier && !gameState.inbounding) {
    var ballHandler = gameState.ballCarrier;
    // ...
}
```

Instead of:
```javascript
var stateManager = systems.stateManager;
var ballCarrier = stateManager.get("ballCarrier");
var inbounding = stateManager.get("inbounding");
if (ballCarrier && !inbounding) {
    var ballHandler = ballCarrier;
    // ...
}
```

## Strategy

### Phase 1: Extract gameState at top of functions
```javascript
function gameLoop(systems) {
    var stateManager = systems.stateManager;
    var gameState = stateManager.get(); // Get full state once
    
    // Now existing code can still use gameState.foo for READS
    // But WRITES must use stateManager.set()
}
```

### Phase 2: Convert writes to stateManager.set()
Find all patterns:
- `gameState.timeRemaining--;` → `stateManager.set("timeRemaining", gameState.timeRemaining - 1, "timer_tick");`
- `gameState.shotClock--;` → `stateManager.set("shotClock", gameState.shotClock - 1, "shot_clock_tick");`
- `gameState.ballHandlerStuckTimer++;` → `stateManager.set("ballHandlerStuckTimer", gameState.ballHandlerStuckTimer + 1, "stuck_timer");`

### Phase 3: Convert reads to stateManager.get()
After writes are fixed, convert reads:
- `if (gameState.ballCarrier)` → `if (stateManager.get("ballCarrier"))`
- `var handler = gameState.ballCarrier;` → `var handler = stateManager.get("ballCarrier");`

### Phase 4: Remove gameState variable
Once all access is through stateManager, remove:
```javascript
var gameState = stateManager.get(); // DELETE THIS LINE
```

## Files to Fix

1. **nba_jam.js** - `gameLoop()` function (~76 refs)
2. **nba_jam.js** - `runMultiplayerGameLoop()` function (~40 refs)

## Mutations to Convert

### Timer mutations:
- `gameState.timeRemaining--`
- `gameState.shotClock--`

### Ball handler tracking:
- `gameState.ballHandlerStuckTimer++`
- `gameState.ballHandlerDeadFrames++`
- `gameState.ballHandlerAdvanceTimer++`

### Block mechanics:
- `gameState.blockJumpTimer--`

### Multiplayer sync:
- `mpSyncState.lastDeadDribbleBroadcast = gameState.tickCounter`
- `mpSyncState.lastCooldownBroadcast = gameState.tickCounter`

## Implementation Order

1. **Start with writes** (mutations) - these are critical
2. **Then reads** - safer, just data access
3. **Test after each batch** - verify game still works
4. **Commit frequently** - each function fixed is a checkpoint

## Expected Outcome

After Phase 1 (extract gameState):
- Game works exactly the same
- 0 new bugs introduced
- Ready for Phase 2

After Phase 2 (convert writes):
- All mutations go through stateManager
- Mutation history tracking works
- Still using gameState for reads (safe)

After Phase 3 (convert reads):
- All access through stateManager API
- Can track read patterns
- Still have gameState variable

After Phase 4 (remove gameState):
- ☢️ **gameState is undefined**
- Any remaining direct access crashes immediately
- Forces completion of refactor

## Timeline

- Phase 1: 15 minutes (mechanical, safe)
- Phase 2: 45 minutes (requires careful reason strings)
- Phase 3: 30 minutes (mechanical replacement)
- Phase 4: 5 minutes (delete one line, test)

**Total: ~90 minutes for complete gameLoop refactor**

## Testing Strategy

After each phase:
1. Run CPU demo mode
2. Play to halftime
3. Play to game over
4. Check error logs for crashes

## Success Criteria

- [ ] All gameState mutations use stateManager.set()
- [ ] All gameState reads use stateManager.get()
- [ ] Game runs start → halftime → game over
- [ ] No "gameState is undefined" errors
- [ ] Mutation history shows all state changes

