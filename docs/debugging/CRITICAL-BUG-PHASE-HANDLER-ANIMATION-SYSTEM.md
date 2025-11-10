# CRITICAL BUG: Phase Handler Cannot Access Animation System

**Date**: November 9, 2025  
**Severity**: CRITICAL - Game Breaking  
**Impact**: Shooting, passing, dunking all broken

---

## Symptoms

1. **Players cannot shoot** - AI attempts shots but nothing happens
2. **Players cannot pass** - Passing attempts are ignored
3. **No shot animations** - Ball never arcs toward basket
4. **No dunks** - Dunk attempts fail silently
5. **Rebounds never trigger** - Game phase stuck

### Debug Log Evidence

```
[2025-11-09T08:00:14.568Z] >>> shooting.js attemptShot() CALLED
[2025-11-09T08:00:14.568Z] >>> Calling systems.shootingSystem.attemptShot for Dominique Wilkins
[2025-11-09T08:00:14.568Z] === attemptShot CALLED, shooter=yes, shotInProgress=false ===
[2025-11-09T08:00:14.568Z] Shot BLOCKED: phase=shot_queued
```

**Key Finding**: Phase is stuck in `shot_queued` and never transitions forward!

---

## Root Cause

**File**: `lib/game-logic/phase-handler.js`  
**Problem**: Checking for GLOBAL `animationSystem` variable instead of `systems.animationSystem`

### Bug Locations

#### Line 76 (handleShotQueued - Dunks)
```javascript
if (dunkInfo && flightPlan && animationSystem && typeof animationSystem.queueDunkAnimation === "function") {
    //                         ^^^^^^^^^^^^^^^
    // BUG: Should be systems.animationSystem
```

#### Line 128 (handleShotQueued - Jump Shots)
```javascript
if (animationSystem && typeof animationSystem.queueShotAnimation === "function") {
    // ^^^^^^^^^^^^^^^
    // BUG: Should be systems.animationSystem
```

#### Line 163 (handleShotAnimating)
```javascript
if (!animationSystem || !animationSystem.isBallAnimating()) {
    //  ^^^^^^^^^^^^^^^
    // BUG: Should be systems.animationSystem
```

---

## Why This Breaks Everything

### Expected Flow
1. Player attempts shot → `attemptShot()` called
2. Shooting system queues shot → Sets phase to `PHASE_SHOT_QUEUED`
3. `updateGamePhase()` called every frame
4. `handleShotQueued()` should:
   - Queue animation with `animationSystem.queueShotAnimation()`
   - Transition phase to `PHASE_SHOT_ANIMATING`
5. `handleShotAnimating()` waits for animation completion
6. Phase transitions to `PHASE_SHOT_SCORED` or `PHASE_SHOT_MISSED`
7. Game continues

### Actual Broken Flow
1. Player attempts shot → `attemptShot()` called
2. Shooting system queues shot → Sets phase to `PHASE_SHOT_QUEUED`
3. `updateGamePhase()` called every frame
4. `handleShotQueued()` checks:
   - `if (animationSystem && ...)` → **FALSE** (animationSystem is undefined/global scope)
   - Falls through without transitioning phase
5. **Phase remains `PHASE_SHOT_QUEUED` forever**
6. Next shot attempt blocked by shooting-system.js line 376:
   ```javascript
   if (currentPhase === PHASE_SHOT_QUEUED) {
       log("Shot BLOCKED: phase=" + currentPhase);
       return { success: false, reason: 'shot_already_queued' };
   }
   ```
7. **Game completely locked - no shots possible**

---

## Architecture Context

### Wave 23 Changes
During Wave 23, we moved to a **systems object pattern** where all systems are passed via dependency injection:

```javascript
var systems = {
    stateManager: stateManager,
    animationSystem: animationSystem,  // ← System is HERE
    shootingSystem: shootingSystem,
    passingSystem: passingSystem,
    // ... etc
};
```

### Why Global References Broke
- **Before Wave 23**: Many files used global variables (e.g., global `animationSystem`)
- **After Wave 23**: Systems passed via `systems` object for dependency injection
- **Bug**: `phase-handler.js` was partially updated but still has 3 references to global `animationSystem`

---

## Fix Required

### Files to Modify
1. `lib/game-logic/phase-handler.js` (3 locations)

### Changes Needed

#### Change 1: Line 76 (Dunk Animation Check)
```javascript
// BEFORE (BROKEN):
if (dunkInfo && flightPlan && animationSystem && typeof animationSystem.queueDunkAnimation === "function") {

// AFTER (FIXED):
if (dunkInfo && flightPlan && systems.animationSystem && typeof systems.animationSystem.queueDunkAnimation === "function") {
```

**Also fix line 83** (queueDunkAnimation call):
```javascript
// BEFORE (BROKEN):
animationSystem.queueDunkAnimation(

// AFTER (FIXED):
systems.animationSystem.queueDunkAnimation(
```

#### Change 2: Line 128 (Shot Animation Check)
```javascript
// BEFORE (BROKEN):
if (animationSystem && typeof animationSystem.queueShotAnimation === "function") {

// AFTER (FIXED):
if (systems.animationSystem && typeof systems.animationSystem.queueShotAnimation === "function") {
```

**Also fix line 135** (queueShotAnimation call):
```javascript
// BEFORE (BROKEN):
animationSystem.queueShotAnimation(

// AFTER (FIXED):
systems.animationSystem.queueShotAnimation(
```

#### Change 3: Line 163 (Animation Complete Check)
```javascript
// BEFORE (BROKEN):
if (!animationSystem || !animationSystem.isBallAnimating()) {

// AFTER (FIXED):
if (!systems.animationSystem || !systems.animationSystem.isBallAnimating()) {
```

---

## Additional Instances

Search for ALL occurrences in phase-handler.js:

```bash
grep -n "animationSystem" lib/game-logic/phase-handler.js
```

**Expected**: ~5-7 occurrences that need fixing

---

## Testing After Fix

### Minimum Tests
1. **Demo Mode**: Watch CPU vs CPU - verify shots arc and score
2. **Single Player**: Press space - verify shot animation
3. **Single Player**: Press S - verify pass works
4. **Rebounds**: Miss a shot - verify rebound scramble triggers
5. **Dunks**: Drive to basket - verify dunk animation

### Verification
Check debug log after fix - should see:
```
>>> PHASE: handleShotQueued() called
>>> PHASE: Animation queued, transitioning to SHOT_ANIMATING
>>> PHASE: handleShotAnimating() - checking if animation complete
>>> PHASE: Animation complete, clearing shotInProgress flag
>>> PHASE: Shot scored, transitioning to SHOT_SCORED
```

**NOT**:
```
Shot BLOCKED: phase=shot_queued  (← This should NEVER appear after fix)
```

---

## Related Files

### Files That Work Correctly (Already Using systems.*)
- `lib/core/game-loop-core.js` - Uses `systems.animationSystem.update()`
- `lib/systems/shooting-system.js` - Uses `deps.animations`
- `lib/game-logic/shooting.js` - Uses `systems.shootingSystem`

### Files That May Have Similar Bugs
Search for global variable usage:
```bash
grep -rn "animationSystem\." lib/ | grep -v "systems.animationSystem"
```

---

## Prevention

### Going Forward
1. **NO GLOBAL VARIABLES** - All systems accessed via `systems` object
2. **Grep Check** - Before committing, search for bare variable names:
   ```bash
   grep -rn "^\s*animationSystem\." lib/
   grep -rn "^\s*stateManager\." lib/
   ```
3. **Lint Rule** - Consider adding ESLint rule to catch global usage
4. **Code Review** - Check for `systems.` prefix in all system access

---

## Priority

**CRITICAL - FIX IMMEDIATELY**

This bug breaks core gameplay. Game is unplayable. All shooting, passing, dunking disabled.

Estimated fix time: **5 minutes** (3 simple find-replace edits)  
Testing time: **10 minutes** (verify in demo + SP mode)  
Total: **15 minutes to restore gameplay**

---

## Lesson Learned

**Partial Refactoring is Dangerous**

When refactoring globals to dependency injection:
1. Search for ALL occurrences of variable name
2. Update ALL references atomically
3. Test immediately after
4. Automated grep checks prevent this class of bug

This bug was introduced during Wave 23 when we moved to systems object pattern but missed updating phase-handler.js completely.
