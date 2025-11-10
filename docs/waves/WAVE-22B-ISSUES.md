# Wave 22B: Critical Architecture Issues

## Current Status: NOT READY TO MERGE

The non-blocking architecture conversion has fundamental flaws that require significant refactoring.

## Core Problem: State Mutation Timing

### The Issue
When converting from blocking to non-blocking animations, I made a critical error:
- **Blocking model**: Animate → State changes happen after animation completes
- **Current non-blocking**: Queue animation → **State changes happen immediately** → Animation plays later

This creates severe timing bugs where game state is out of sync with visual animations.

### Specific Examples

#### Example 1: Inbound Pass Interception
```javascript
// In animatePass() - happens immediately when queued:
if (interceptor) {
    gameState.ballCarrier = interceptor;           // ← Happens NOW
    gameState.currentTeam = interceptorTeam;       // ← Happens NOW
}
animationSystem.queuePassAnimation(...);           // ← Animation plays LATER
```

**Result**: Ball carrier and possession switch instantly, but animation hasn't even started.

#### Example 2: Made Basket Possession
1. Team A shoots (captures `shooterTeam: "teamA"` in phase data) ✓
2. Animation plays
3. `handleShotScored()` runs → calls `setupInbound("teamA")`
4. `setupInbound()` correctly switches to Team B → calls `animatePass()`
5. `animatePass()` **immediately** sets `gameState.currentTeam = "teamB"` and `gameState.ballCarrier = receiver`
6. Pass animation queued
7. **BUT**: If pass is intercepted, `currentTeam` changes again in step 5!

**Result**: Possession switches multiple times during inbound setup, causing confusion.

## Race Conditions Identified

### Race 1: Duplicate Shot Attempts
**Fixed** (partially) - Added `shotInProgress` guard and moved it before `setPhase()`
- Still at risk if AI calls `attemptShot()` twice in single frame before guard sets

### Race 2: CurrentTeam Modifications
**Not Fixed** - Multiple systems modify `currentTeam` while phases are active:
- `passing.js` (interceptions, out of bounds) - 4 locations
- `defense-actions.js` (steals) - 3 locations
- `rebounds.js` (rebound secured) - 1 location
- `possession.js` (inbound setup) - 2 locations

### Race 3: BallCarrier Modifications
**Not Fixed** - ~15+ locations modify `ballCarrier` including during animations:
- Pass completion sets `ballCarrier` immediately
- Interceptions set `ballCarrier` immediately
- This happens during `INBOUND_SETUP` phase

### Race 4: Phase Data Integrity
**Partially Fixed** - Added `shooterTeam` to phase data to preserve shooting team
- But phase data doesn't account for state changes during pass animations
- No validation that phase data is complete when handlers run

## Required Fixes (Comprehensive List)

### 1. Animation Completion Callbacks ⚠️ HIGH PRIORITY
**Status**: Not implemented
**Effort**: ~200 lines

Add callback system to animation-system.js:
```javascript
this.queuePassAnimation = function(startX, startY, endX, endY, data, onComplete) {
    // Store onComplete callback with animation
    this.animations.push({
        type: "pass",
        // ... existing fields
        onComplete: onComplete,
        stateData: data  // passer, receiver, interceptor info
    });
};

this.completeAnimation = function(anim) {
    // ... existing cleanup
    if (anim.onComplete && typeof anim.onComplete === "function") {
        anim.onComplete(anim.stateData);
    }
};
```

### 2. Defer State Mutations in passing.js ⚠️ HIGH PRIORITY
**Status**: Not implemented
**Effort**: ~100 lines

Refactor `animatePass()` to NOT mutate state immediately:
```javascript
function animatePass(passer, receiver, leadTarget) {
    // Calculate interception
    var interceptor = checkPassInterception(...);
    
    // Queue animation with callback
    animationSystem.queuePassAnimation(startX, startY, endX, endY, {
        passer: passer,
        receiver: receiver,
        interceptor: interceptor
    }, function(data) {
        // State mutations happen HERE, after animation completes
        if (data.interceptor) {
            gameState.ballCarrier = data.interceptor;
            gameState.currentTeam = getPlayerTeamName(data.interceptor);
            // ... all the interception logic
        } else {
            gameState.ballCarrier = data.receiver;
            // ... all the completion logic
        }
    });
    
    // NO state mutations here!
}
```

### 3. Phase Handler Must Wait for Pass Animation ⚠️ HIGH PRIORITY
**Status**: Not implemented  
**Effort**: ~50 lines

`handleInboundSetup()` needs to track pass animation state:
```javascript
function handleInboundSetup(frameDelayMs) {
    var phaseData = getPhaseData();
    
    if (gameState.phase.frameCounter === 0) {
        // Setup inbound - this queues pass animation
        setupInbound(phaseData.scoringTeamKey);
        // Mark that we're waiting for pass
        phaseData.waitingForPass = true;
    }
    
    // Don't transition until pass animation completes
    if (phaseData.waitingForPass && animationSystem.isBallAnimating()) {
        return;  // Keep waiting
    }
    
    if (advancePhaseTimer()) {
        resetPhase();
    }
}
```

### 4. Centralized Possession State Machine 🔶 MEDIUM PRIORITY
**Status**: Not implemented
**Effort**: ~300 lines (new file)

Create `lib/game-logic/possession-state.js`:
```javascript
function setPossession(team, player, reason) {
    // Validate transition is allowed in current phase
    if (gameState.phase.current === PHASE_SHOT_ANIMATING) {
        console.warn("setPossession blocked during shot animation");
        return false;
    }
    
    gameState.currentTeam = team;
    gameState.ballCarrier = player;
    
    // Log for debugging
    debugLog("[POSSESSION] " + reason + ": " + team + " / " + 
        (player ? player.playerData.name : "null"));
    
    return true;
}
```

Replace all direct `gameState.currentTeam =` assignments with calls to this function.

### 5. Shot Animation Completion Handler 🔶 MEDIUM PRIORITY
**Status**: Partially implemented (phase handler checks isBallAnimating)
**Effort**: ~50 lines

Move shot state clearing to callback:
```javascript
this.queueShotAnimation = function(..., onComplete) {
    this.animations.push({
        // ... existing
        onComplete: onComplete
    });
};

// In shooting.js:
setPhase(PHASE_SHOT_QUEUED, {
    // ... existing data
    onAnimationComplete: function() {
        // This runs when animation finishes
        gameState.shotInProgress = false;
        // Any other cleanup
    }
});
```

### 6. Comprehensive State Validation ⏹️ LOW PRIORITY
**Status**: Not implemented
**Effort**: ~200 lines

Add validation system:
```javascript
function validateGameState(context) {
    var errors = [];
    
    if (!gameState.currentTeam) {
        errors.push("currentTeam is null/undefined");
    }
    
    if (gameState.ballCarrier && !gameState.ballCarrier.playerData) {
        errors.push("ballCarrier missing playerData");
    }
    
    // ... many more checks
    
    if (errors.length > 0) {
        debugLog("[STATE ERROR] in " + context + ": " + errors.join(", "));
    }
    
    return errors.length === 0;
}
```

Call after every state mutation.

### 7. Functional Tests ⏹️ LOW PRIORITY
**Status**: One stub test created
**Effort**: ~400 lines

Create comprehensive test suite:
- test-shot-lifecycle.js - Full shot flow
- test-possession-switching.js - All possession scenarios
- test-phase-transitions.js - Validate phase data integrity
- test-race-conditions.js - Deliberately trigger edge cases

## Estimated Total Effort

| Task | Lines of Code | Complexity | Priority |
|------|--------------|------------|----------|
| Animation callbacks | ~200 | High | Critical |
| Defer pass mutations | ~100 | Medium | Critical |
| Phase handler wait | ~50 | Low | Critical |
| Possession state machine | ~300 | High | Medium |
| Shot completion handler | ~50 | Low | Medium |
| State validation | ~200 | Medium | Low |
| Functional tests | ~400 | Medium | Low |
| **TOTAL** | **~1,300** | - | - |

**Time Estimate**: 8-12 hours of focused development + 4-6 hours testing

## Alternative: Hybrid Approach

Given the scope, consider a hybrid model:
1. **Keep dunks blocking** (already done)
2. **Keep passes blocking** (revert my changes to passing.js)
3. **Only make jump shots non-blocking** (simplest case, already working)

This reduces scope by ~600 lines and avoids the complex callback system.

### Hybrid Pros:
- Simpler to implement correctly
- Fewer race conditions
- Easier to test
- Still achieves 70% of the non-blocking goal

### Hybrid Cons:
- Doesn't fully meet "run off ticks" mandate
- Inbound passes still block (~200-400ms)
- Not as clean architecturally

## Recommendation

**Option A: Full Fix** - Implement all 7 tasks above
- Timeline: 2-3 days
- Risk: High (complex, many edge cases)
- Benefit: True non-blocking architecture

**Option B: Hybrid Model** - Revert pass animation changes, keep shot non-blocking
- Timeline: 2-4 hours
- Risk: Low (mostly reverting changes)
- Benefit: Stable, testable, meets most goals

**Option C: Revert Wave 22B** - Go back to main branch
- Timeline: 1 hour
- Risk: None (known working state)
- Benefit: Can rethink architecture with better design

## My Assessment

The user is right - I was being lazy with band-aid fixes. The proper solution requires:
1. Animation completion callback system
2. Deferred state mutations
3. Phase-aware possession state machine
4. Comprehensive testing

This is a **major architectural change** that should have been designed more carefully upfront.

I recommend **Option B (Hybrid)** as the pragmatic path forward:
- Jump shots non-blocking ✓
- Dunks blocking (acceptable - rare)
- Passes blocking (revert - simpler)
- Test thoroughly
- Ship stable version
- Revisit full non-blocking in Wave 22C with proper design

