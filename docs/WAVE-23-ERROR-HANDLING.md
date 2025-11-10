# Wave 23 Error Handling System - Summary

## What We Built

A comprehensive error handling and debugging system for NBA JAM that provides:

1. **Automatic Error Logging**: All errors captured with full context
2. **Game State Snapshots**: Capture complete game state when errors occur  
3. **Reproduction Tests**: Auto-generate test cases from errors
4. **Tight Feedback Loop**: Error → Log → Snapshot → Test → Fix

## Components Created

### 1. `/lib/utils/error-handler.js`
- `logError(error, severity, context)` - Log with FATAL/ERROR/WARN levels
- `captureGameStateSnapshot(stateManager)` - Capture state via stateManager.getAll()
- `writeErrorLog(logEntry)` - Append to error.log
- `writeSnapshotFile(logEntry)` - Save detailed JSON snapshot
- `generateReproductionTest(logEntry)` - Auto-create test file
- `wrapWithErrorHandler(fn, name, systems)` - Wrap functions with error capture

### 2. `/lib/utils/safe-game-loop.js`  
- `createSafeGameLoop(gameLoopFn, systems)` - Wrap game loop with error handling

### 3. `/view-errors.sh`
- Shell script to view and summarize error log
- Color-codes FATAL/ERROR/WARN
- Shows error counts and available snapshots

## Integration Points

### nba_jam.js
```javascript
// Load error handler FIRST
load("lib/utils/error-handler.js");
initErrorHandler();

// Wrap gameLoop with try/catch
function gameLoop(systems) {
    try {
        // ... game loop code ...
    } catch (e) {
        logError(e, ErrorSeverity.FATAL, {
            function: "gameLoop",
            systems: systems,  // Pass for state capture
            tick: systems.stateManager.get("tickCounter")
        });
        throw e;
    }
}
```

## Error Log Format

```
[2025-11-08T20:45:56.526Z] FATAL: ReferenceError: systems is undefined
  Context: {"function":"setPhase","file":"game-state.js","line":251}
  Stack: at setPhase (game-state.js:251)
         at resetPhase (game-state.js:323)
         ...

Game State Snapshot:
{
  "phase": {"current": "NORMAL", "frameCounter": 0},
  "currentTeam": "teamA",
  "score": {"teamA": 0, "teamB": 0},
  "ballCarrier": {"id": "teamA_p1", "x": 18, "y": 12},
  ...
}
```

## Workflow

1. **Error Occurs**: Game crashes or error thrown
2. **Auto-Capture**: Error handler captures:
   - Error message & stack trace
   - Full game state via stateManager
   - Context (function, tick, etc.)
3. **Write Logs**:
   - Append to `error.log`
   - Create `error-snapshots/snapshot-{timestamp}.json`
   - Generate `error-snapshots/test-reproduction-{timestamp}.js`
4. **Debug**:
   - Run `./view-errors.sh` to see recent errors
   - Open snapshot JSON to inspect exact state
   - Run reproduction test to recreate error
5. **Fix & Verify**: Run tests to confirm fix

## Current Status

✅ Error handler infrastructure complete
✅ Integrated into main game file  
✅ Wraps gameLoop with error capture
✅ Uses stateManager for state snapshots (Wave 23 compliant)
✅ Fixed resetPhase() systems parameter bug

🔧 **Next Steps**:
1. Test error capture by triggering known error
2. Verify error.log and snapshots are created correctly
3. Create unit test helpers that use error snapshots
4. Document common error patterns and fixes

## Benefits

- **Faster Debugging**: See exact game state when error occurred
- **Reproducible Bugs**: Auto-generated tests capture error conditions
- **Better Logging**: All errors logged automatically, no manual logging needed
- **State Replay**: Can reconstruct game state from snapshots for testing
- **Continuous Improvement**: Error log reveals patterns and frequent issues

## Usage Examples

### View Recent Errors
```bash
./view-errors.sh
```

### Check Specific Error
```bash
cat error.log | grep "FATAL" | tail -1
```

### Replay Error State
```bash
jsexec error-snapshots/test-reproduction-1762636456526.js
```

### Add Error Logging to Function
```javascript
function myGameFunction(systems) {
    try {
        // ... code ...
    } catch (e) {
        logError(e, ErrorSeverity.ERROR, {
            function: "myGameFunction",
            systems: systems
        });
        throw e;
    }
}
```
