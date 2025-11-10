# Dead Code Analysis - Pre-Wave23 to Wave23 Comparison

## Methodology
Compared current code against `docs/archive/pre-wave23-nba_jam.js.backup` to determine:
1. Was the function used in the original monolithic file?
2. If yes, what was its purpose?
3. Did we port equivalent functionality or eliminate the need?

---

## Function 1: `executePass(passer, receiver, leadTarget)`

### Original Usage (Pre-Wave23)
**Location**: Line 7854 in pre-wave23-nba_jam.js.backup  
**Called**: YES - Line 7974

**Context**:
```javascript
// Coordinator: Use non-blocking executePass()
if (mpCoordinator && mpCoordinator.isCoordinator) {
    executePass(passer, receiver, leadTarget);
    return;  // Early return - executePass() handled all logic and broadcast event
}
```

**Purpose**: 
- **Multiplayer coordinator path** for non-blocking pass execution
- Updated game state instantly (no animation blocking)
- Broadcast pass event to other players
- Coordinator-only code path (single-player used blocking animation)

### Current State (Wave23)
**Location**: lib/game-logic/passing.js line 52  
**Called**: NO - 0 calls found

**What Replaced It**:
The Wave23 refactoring created `lib/systems/passing-system.js` with:
- `createPassingSystem(deps)` factory function
- `attemptPass(passer, receiver, options)` method
- Handles multiplayer via `deps.animations.queuePassAnimation()` with `stateData` parameter

**Wrapper Function**: `animatePass()` in lib/game-logic/passing.js (line 195)
```javascript
function animatePass(passer, receiver, leadTarget, inboundContext, systems) {
    return systems.passingSystem.attemptPass(passer, receiver, {
        leadTarget: leadTarget,
        inboundContext: inboundContext
    });
}
```

### Analysis
**Status**: ✅ **SAFE TO DELETE**

**Reason**: Functionality fully replaced by Wave23 architecture
- State updates: Now in `passing-system.js` → `_handlePassComplete()` callback
- Animation: Now in `animation-system.js` → `queuePassAnimation()` with Wave22B stateData
- Multiplayer: Now handled by animation system's non-blocking design (all modes are non-blocking in Wave23)

**Porting Status**: ✅ **COMPLETE** - No missing functionality
- Pass state updates: ✓ Ported to passing-system.js
- Interception logic: ✓ Still in checkPassInterception() (still used)
- Multiplayer coordination: ✓ Now handled via animation system callbacks
- Non-blocking design: ✓ Wave23 is non-blocking by default

**TODO Comment Incorrect**: The comment says "TODO: RESTORE FOR MULTIPLAYER" but this is incorrect. Multiplayer doesn't need this function anymore - it uses the new non-blocking architecture like everything else.

---

## Function 2: `isDefenderPlayingTooTight(ballHandler, opponentTeam)`

### Original Usage (Pre-Wave23)
**Location**: Line 8206 in pre-wave23-nba_jam.js.backup  
**Called**: YES - Line 6262

**Context**:
```javascript
// Check if defender is playing too tight (exploitable for passing)
var opponentTeam = teamName === "red" ? "blue" : "red";
var defenderTooTight = isDefenderPlayingTooTight(player, opponentTeam);

// Later in AI logic...
// REASON 0: Defender playing too tight - EXPLOIT weak positioning!
// When defender touches ball handler, their intercept ability drops 85%
if (defenderTooTight && teammateDefDist > 3) {
    shouldPass = true;
    passIntent = "EXPLOIT_TIGHT_DEFENSE";
    try {
        log(LOG_DEBUG, "AI exploiting tight defense with pass - defender touching ball handler!");
    } catch (e) { }
}
```

**Purpose**: 
- **AI decision-making** for offensive ball handler
- Detect when defender is within `TIGHT_DEFENSE_TOUCH_DISTANCE` (≤ 2 units)
- Trigger "exploit tight defense" pass strategy
- Related to the 85% interception penalty applied in `checkPassInterception()`

**Function Implementation**:
```javascript
function isDefenderPlayingTooTight(ballHandler, opponentTeam) {
    if (!ballHandler) return false;
    var opponents = getOpposingTeamSprites(opponentTeam);
    for (var i = 0; i < opponents.length; i++) {
        var defender = opponents[i];
        var dist = getSpriteDistance(ballHandler, defender);
        if (dist <= TIGHT_DEFENSE_TOUCH_DISTANCE) {
            return true; // At least one defender is touching
        }
    }
    return false;
}
```

### Current State (Wave23)
**Location**: lib/game-logic/passing.js line 310  
**Called**: NO - 0 calls found

**What Replaced It**: NOTHING - This AI behavior was lost during refactoring

**Evidence**:
1. ✅ The interception penalty logic STILL EXISTS in `checkPassInterception()`:
   ```javascript
   var isTouchingPasser = distToPasser <= TIGHT_DEFENSE_TOUCH_DISTANCE;
   if (isTouchingPasser) {
       interceptChance *= (1 - TIGHT_DEFENSE_INTERCEPT_PENALTY); // 85% reduction
   }
   ```

2. ❌ The AI logic to EXPLOIT this situation is MISSING:
   - Not found in `lib/ai/offense-ball-handler.js`
   - Not found in AI decision support modules
   - AI doesn't proactively pass when defender is too tight

### Analysis
**Status**: ⚠️ **MISSING FEATURE - DO NOT DELETE YET**

**Reason**: Function is unused BUT represents missing AI behavior

**Porting Status**: ❌ **INCOMPLETE** - AI feature was lost
- Interception penalty: ✓ Still applied in checkPassInterception()
- AI detection: ✗ Function not called by AI coordinator
- AI exploitation: ✗ "EXPLOIT_TIGHT_DEFENSE" pass intent not in Wave23 AI

### Recommended Action
**Option A (Restore Feature)**: 
1. Keep `isDefenderPlayingTooTight()` function
2. Add to `lib/ai/offense-ball-handler.js` pass decision logic
3. Implement "exploit tight defense" pass priority
4. Test that AI passes when defender is touching ball handler

**Option B (Document as Intentional Removal)**:
1. If we decided this AI behavior was too exploitable/unrealistic
2. Delete function
3. Document in CHANGELOG that "tight defense exploitation" was removed

**Option C (Defer Decision)**:
1. Keep function for now (it's only 20 lines)
2. Add TODO comment explaining it's unused AI feature
3. Decide during AI tuning phase whether to restore or remove

---

## Function 3: `computePassAnimationTiming(startX, startY, endX, endY)`

### Original Usage (Pre-Wave23)
**Location**: Line 892 in pre-wave23-nba_jam.js.backup  
**Called**: YES - Lines 947 and 7871

**Context - Call 1** (Line 947 - Animation System):
```javascript
this.queuePassAnimation = function (startX, startY, endX, endY, interceptor, durationMs) {
    var timing = computePassAnimationTiming(startX, startY, endX, endY);
    // ... use timing to create animation
}
```

**Context - Call 2** (Line 7871 - executePass function):
```javascript
function executePass(passer, receiver, leadTarget) {
    // ...
    var passTiming = computePassAnimationTiming(startX, startY, endX, endY);
    // Used for: interception check, timing broadcast
}
```

**Purpose**: 
- Calculate pass animation parameters based on distance
- Returns: `{ steps, msPerStep, durationMs, distance }`
- Used by both animation system AND game logic

### Current State (Wave23)
**Locations**: 
1. `lib/rendering/animation-system.js` line 22 ✅ **ACTIVE**
2. `lib/game-logic/passing.js` line 28 ❌ **DUPLICATE/UNUSED**

**Analysis**: Same function duplicated in two places during refactoring

**Which One Is Used?**:
- `animation-system.js` version: ✓ Called by `queuePassAnimation()` line 88
- `passing.js` version: ✗ Never called (executePass was the only caller, and it's dead)

### Analysis
**Status**: ✅ **SAFE TO DELETE FROM passing.js**

**Reason**: Duplicate code - animation-system.js has the active version

**Porting Status**: ✅ **COMPLETE** - No functionality lost
- Animation timing: ✓ Preserved in animation-system.js
- All callers: ✓ Use animation system version

**Action**: Delete lines 28-48 from lib/game-logic/passing.js (keep animation-system.js version)

---

## Summary Table

| Function | Pre-Wave23 Usage | Current Status | Action | Priority |
|----------|------------------|----------------|--------|----------|
| `executePass()` | ✅ Used (multiplayer coordinator) | ❌ Orphaned | **DELETE** | High |
| `isDefenderPlayingTooTight()` | ✅ Used (AI pass decision) | ❌ Feature lost | **INVESTIGATE** | Medium |
| `computePassAnimationTiming()` (in passing.js) | ✅ Used (by executePass) | ❌ Duplicate | **DELETE** | High |

## Recommendations

### Immediate Actions (PR-Ready)
1. ✅ **DELETE `executePass()`** (~135 lines)
   - Functionality fully ported to passing-system.js
   - No missing features

2. ✅ **DELETE duplicate `computePassAnimationTiming()` from passing.js** (~21 lines)
   - Keep animation-system.js version
   - No functionality lost

**Total safe deletion**: ~156 lines

### Requires Decision Before PR
3. ⚠️ **`isDefenderPlayingTooTight()` - AI Feature Gap** (~20 lines)
   - Function unused BUT represents missing AI behavior
   - Pre-Wave23 AI would exploit tight defense with passes
   - Wave23 AI lost this behavior during refactoring
   
**Questions to answer**:
- Was this intentionally removed as overpowered?
- Should we restore the "exploit tight defense" AI logic?
- Is the interception penalty alone sufficient?

**Recommendation**: Keep function for now, add to AI improvement backlog

## Testing Verification

After removing `executePass()` and duplicate `computePassAnimationTiming()`:

### Test Scenarios
1. ✅ Single-player passes (normal, inbound, interception)
2. ✅ Multiplayer passes (if multiplayer available)
3. ✅ AI offensive passing behavior
4. ⚠️ AI does NOT exploit tight defense (expected - feature missing)

### Expected Results
- No undefined function errors
- Passes work in all modes
- Animation timing unchanged
- Multiplayer coordination works (uses new architecture)

## Conclusion

**Safe to delete immediately**: 156 lines
- `executePass()` - Fully replaced by Wave23 architecture
- Duplicate `computePassAnimationTiming()` - Active copy in animation-system.js

**Needs investigation**: 20 lines
- `isDefenderPlayingTooTight()` - Represents missing AI feature from pre-Wave23
- Decision needed: Restore AI behavior or document as intentional removal
