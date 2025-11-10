# Dead Code Audit - Wave 23D

**See `docs/DEAD_CODE_ANALYSIS.md` for detailed pre-Wave23 comparison and porting analysis.**

## Summary
After Wave 23 refactoring to systems-based architecture, several legacy functions are no longer called.

## Wave 23 Architecture Pattern
The NEW architecture (per copilot-instructions.md) uses:
- **Wrapper functions** in `lib/game-logic/*.js` that take `(systems)` parameter
- **System implementations** in `lib/systems/*.js` with dependency injection
- Example: `attemptShot(systems)` in shooting.js → delegates to `systems.shootingSystem.attemptShot()`

## Confirmed Dead Code

### lib/game-logic/passing.js

1. **`executePass(passer, receiver, leadTarget)`** - Lines 52-187
   - **Status**: DEAD - 0 calls found
   - **Reason**: Orphaned multiplayer coordinator code (see TODO comment line 49)
   - **Comment says**: "TODO: RESTORE FOR MULTIPLAYER - Lost during refactor"
   - **Reality**: Multiplayer doesn't call this anymore, uses `animatePass()` wrapper instead
   - **Safe to remove**: Yes (multiplayer refactor needed it to use new pattern)
   - **Size**: ~135 lines

2. **`isDefenderPlayingTooTight(ballHandler, opponentTeam)`** - Lines 310-329
   - **Status**: DEAD - 0 calls found  
   - **Reason**: Not used by AI decision-making systems
   - **Safe to remove**: Yes
   - **Size**: ~20 lines

### Duplicated Code

3. **`computePassAnimationTiming(startX, startY, endX, endY)`**
   - **Locations**: 
     - `lib/game-logic/passing.js` (lines 28-48) ❌ DUPLICATE/UNUSED
     - `lib/rendering/animation-system.js` (lines 22-38) ✅ ACTIVE
   - **Status**: Duplicate in passing.js is never called (animatePass uses systems.passingSystem)
   - **Reason**: Animation system version is the authoritative implementation
   - **Action**: Remove from passing.js, keep in animation-system.js
   - **Size**: ~21 lines

## Architecture Clarification - NOT Dead Code

### lib/game-logic/shooting.js

4. **`attemptShot(systems)`** - Line 406+
   - **Status**: ACTIVE - This is the NEW Wave 23 wrapper ✅
   - **Pattern**: Takes `systems` parameter, delegates to `systems.shootingSystem.attemptShot()`
   - **Called by**: AI (offense-ball-handler.js), input handlers, game loop
   - **This is CORRECT architecture** per copilot-instructions.md

### lib/game-logic/passing.js

5. **`animatePass(passer, receiver, leadTarget, inboundContext, systems)`** - Line 195
   - **Status**: ACTIVE - This is the NEW Wave 23 wrapper ✅
   - **Pattern**: Delegates to `systems.passingSystem.attemptPass()`
   - **This is CORRECT architecture** per copilot-instructions.md

### lib/game-logic/possession.js

6. **Possession beep functions**
   - `canPlayPossessionBeep(systems)` - Line 182
   - `triggerPossessionBeep(systems)` - Line 194  
   - `togglePossessionBeep(systems)` - Line 205
   - **Status**: Likely ACTIVE (need to verify with search)
   - **Action**: Check if called by game logic

## Cleanup Recommendation

### Phase 1: Safe Removals (Immediate - Can Do Now)
Remove confirmed dead code from `lib/game-logic/passing.js`:
- ❌ `executePass()` (~135 lines) - Orphaned multiplayer code
- ❌ `isDefenderPlayingTooTight()` (~20 lines) - Never called
- ❌ Duplicate `computePassAnimationTiming()` (~21 lines) - Animation system has active version

**Total removal**: ~176 lines

### Phase 2: Keep These (They're NEW architecture)
DO NOT REMOVE - These are the Wave 23 wrappers:
- ✅ `attemptShot(systems)` in shooting.js
- ✅ `animatePass()` in passing.js  
- ✅ `setupInbound(systems)` in possession.js

## Testing Strategy

1. Remove dead code (Phase 1 only)
2. Run game in all modes:
   - Single-player human vs AI ✓
   - Single-player human vs human ✓
   - CPU demo mode ✓
   - Multiplayer (if available)
3. Verify no undefined function errors
4. Test edge cases:
   - Passes (normal, inbound, interception)
   - Shots (normal, contested, fire mode)
   - Possession changes

## Conclusion

**Safe to remove immediately**: 176 lines across 3 functions in passing.js

The confusion was around NEW vs OLD architecture:
- **NEW (Wave 23)**: Functions taking `(systems)` param that delegate to system implementations
- **OLD (pre-Wave 23)**: Direct implementation functions (these were moved to `/lib/systems/`)

The refactoring preserved wrapper functions in `/lib/game-logic/` for backward compatibility with existing call sites, while moving core logic to testable `/lib/systems/` modules with dependency injection.
