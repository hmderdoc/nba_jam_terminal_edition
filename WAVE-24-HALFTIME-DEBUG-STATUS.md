# Wave 24 Halftime Screen Debug Status

**Date**: November 11, 2025  
**Issue**: Non-coordinator player doesn't see second half after halftime screen, goes straight to game over  
**Branch**: Wave 24 - Multiplayer Screen Coordination

---

## High-Level Description

Wave 24 implements non-blocking screen coordination for multiplayer games. Instead of each player independently showing screens (which causes desyncs), a coordinator-based system was implemented where:

1. **Coordinator** enters screen state, broadcasts to clients
2. **Non-coordinators** receive broadcast, show screen
3. Both players vote (press space)
4. **Coordinator** tallies votes, dismisses when all ready OR timeout
5. **Coordinator** broadcasts dismissal
6. **Non-coordinators** receive dismissal signal, exit screen
7. All players synchronized and continue gameplay

This pattern was implemented for:
- Splash screen (pre-game)
- Matchup screen (team preview)
- Halftime screen (mid-game break)
- Game over screen (post-game with vote tallying)

---

## The Original Problem (User Reported)

**Symptom**: "the second half doesn't start for non-coordinator player and then it goes straight to game over"

**Expected Flow**:
1. Game reaches halftime (5 seconds in 10-second test game)
2. Both players see halftime screen
3. Both press space
4. Screen dismisses
5. Second half starts for BOTH players

**Actual Flow**:
1. Halftime screen shows (this works)
2. Players press space
3. Coordinator continues to second half (works)
4. **Non-coordinator either stays frozen OR goes to game over**

---

## Root Cause Analysis

### Initial Hypothesis (WRONG)
Thought halftime screen itself was setting `isHalftime=false` on non-coordinator, causing state desync.

**What I tried**: Modified `halftime.js` to only clear `isHalftime` flag on coordinator.

**Result**: Didn't fix issue.

---

### Second Hypothesis (WRONG)
Thought non-coordinator needed to wait for coordinator to clear `isHalftime` flag.

**What I tried**: Added wait loop in `nba_jam.js` non-coordinator path (lines 960-967) that polled for `isHalftime=false`.

**Result**: Created blocking loop that never exits because non-coordinator can't receive state updates while blocked.

---

### Third Hypothesis (CORRECT DIAGNOSIS)
**The REAL problem**: Non-coordinator's halftime screen loop never calls `playerClient.update()`, so it never receives the coordinator's `mpScreen=null` broadcast (the dismissal signal).

**Why this matters**:

1. Coordinator dismisses screen → calls `mpScreenCoordinator.dismissScreen()` (halftime.js line 62)
2. This calls `broadcastScreenState()` (mp-screen-coordinator.js line 197)
3. Sets `mpScreen=null` in stateManager and calls `coordinator.broadcastState()` (line 220)
4. Coordinator serializes state including `mps: mpScreen` (mp_coordinator.js line 595)
5. State is broadcast to all clients via Queue
6. **Client receives broadcast in `playerClient.update()`** (mp_client.js line 711)
7. Client calls `mpScreenCoordinator.handleScreenState(screenState)` (line 717)
8. Returns `{action: "dismiss", screen: "halftime"}` (mp-screen-coordinator.js line 249)
9. This gets stored as `mpScreenAction` in stateManager (mp_client.js line 724)
10. Halftime screen loop checks `mpScreenAction` and breaks (halftime.js line 54-58)

**THE BUG**: Non-coordinator's halftime screen loop (lines 49-114 of halftime.js) NEVER calls `playerClient.update()`, so step 6 never happens, so the dismissal signal never arrives.

**Proof**: The while loop only calls:
- `console.inkey()` for input (line 77)
- `coordinator.update()` if coordinator (line 113) - but coordinator param is NULL for non-coordinator!
- NO `playerClient.update()` call anywhere

---

## The Fix Applied

### Change 1: Added `playerClient` parameter to `showHalftimeScreen()`

**File**: `lib/ui/halftime.js` line 14

**Before**:
```javascript
function showHalftimeScreen(systems, mpScreenCoordinator, myPlayerId, coordinator) {
```

**After**:
```javascript
function showHalftimeScreen(systems, mpScreenCoordinator, myPlayerId, coordinator, playerClient) {
```

---

### Change 2: Added `playerClient.update()` call in halftime loop

**File**: `lib/ui/halftime.js` lines 117-121

**Added**:
```javascript
// Non-coordinator: Update state from coordinator
if (!isCoordinator && playerClient && playerClient.update) {
    playerClient.update(0); // Frame number not critical for state sync
}
```

**Location**: Inside the while(true) loop, after coordinator.update() call

---

### Change 3: Pass `playerClient` from non-coordinator game loop

**File**: `nba_jam.js` line 951

**Before**:
```javascript
var halftimeResult = showHalftimeScreen(systems, mpScreenCoordinator, myId.globalId, null);
```

**After**:
```javascript
var halftimeResult = showHalftimeScreen(systems, mpScreenCoordinator, myId.globalId, null, playerClient);
```

---

### Change 4: Removed broken wait loop

**File**: `nba_jam.js` lines 954-970 (removed)

**What was removed**:
```javascript
debugLog("[MP GAME LOOP] Non-coordinator exited halftime screen, waiting for isHalftime clear");

// Wait for coordinator to clear isHalftime flag before continuing
var waitStart = Date.now();
while (stateManager.get("isHalftime") && (Date.now() - waitStart < 5000)) {
    playerClient.update(frameNumber);
    mswait(50);
}
```

**Why removed**: This was a broken band-aid. The real fix is calling `playerClient.update()` INSIDE the halftime screen loop, not after exiting it.

---

### Change 5: Coordinator clears `isHalftime` flag and broadcasts

**File**: `nba_jam.js` lines 920-925

**Already existed, verified working**:
```javascript
// Clear halftime flag for second half
stateManager.set("isHalftime", false, "second_half_start");

// Broadcast halftime clear to clients
if (coordinator && coordinator.isCoordinator) {
    coordinator.broadcastState();
}
```

---

## Other Changes Made (During Debugging Hell)

### Debug Logging Added (NOT THE FIX)

**File**: `lib/core/game-loop-core.js` lines 118-121

```javascript
// Debug every time check
if (timeRemaining <= 8) {
    debugLog("[GAME LOOP] Time check: half=" + currentHalf + " time=" + timeRemaining + " halfTime=" + halfTime + " total=" + totalGameTime);
}
```

**Purpose**: To verify halftime check is being evaluated  
**Status**: Should be REMOVED after debugging complete

---

### Halftime Check Modified (REVERTED)

**File**: `lib/core/game-loop-core.js` line 115

**What I changed**: Added `&& timeRemaining > 0` to prevent halftime trigger at game end

**Before**:
```javascript
if (currentHalf === 1 && timeRemaining <= totalGameTime / 2) {
```

**After**:
```javascript
if (currentHalf === 1 && timeRemaining <= halfTime && timeRemaining > 0) {
```

**Status**: This change is fine, but NOT the fix for the issue

---

### Game Time (NOT CHANGED - Stay at 10 seconds)

**File**: `lib/game-logic/game-state.js` lines 74-75

```javascript
timeRemaining: 10, // TEMPORARY: 10 seconds for halftime debug testing
totalGameTime: 10, // TEMPORARY: 10 seconds for halftime debug testing
```

**Status**: Intentionally kept at 10 seconds for rapid testing  
**Action**: Should be changed to 360 seconds after testing complete

---

## What Has NOT Been Verified

### 1. Does the fix actually work?

**Status**: NOT TESTED YET

**What needs testing**:
- Start multiplayer game
- Wait for halftime (5 seconds)
- BOTH players press space
- Verify both players continue to second half
- Verify second half gameplay works
- Verify game ends properly at 0 seconds

---

### 2. Does coordinator's halftime path still work?

**Status**: ASSUMED WORKING (no changes to coordinator path)

**Coordinator path** (nba_jam.js line 917):
```javascript
var halftimeResult = showHalftimeScreen(systems, mpScreenCoordinator, myId.globalId, coordinator);
```

Coordinator passes `coordinator` object (5th param), non-coordinator passes `playerClient` (5th param).

**Potential issue**: Coordinator now expects 5 params but only gets 4 (no playerClient). This SHOULD be fine because coordinator doesn't use playerClient, but needs verification.

---

### 3. Does single-player halftime still work?

**Status**: UNKNOWN

**Single-player call** (nba_jam.js line 141):
```javascript
var halftimeResult = showHalftimeScreen(systems, null, null, null);
```

**Issue**: Function now expects 5 params, single-player passes 4!

**Fix needed**: Update single-player call:
```javascript
var halftimeResult = showHalftimeScreen(systems, null, null, null, null);
```

---

### 4. Are other screens affected?

**Status**: UNKNOWN

Other screens that might have same issue:
- Game over screen (`lib/ui/game-over.js`)
- Matchup screen (`lib/ui/menus.js` - showMatchupScreen)
- Splash screen (`lib/ui/menus.js` - showSplashScreen)

**Question**: Do these screens also need `playerClient.update()` calls in their loops?

**Answer**: YES - they all have the same pattern! Non-coordinator in these screens also can't receive broadcasts without calling `playerClient.update()`.

---

### 5. Does config.isAuthority actually work?

**Status**: VERIFIED EXISTS, but not verified WORKING

**Config creation** (nba_jam.js lines 870-899):
```javascript
var config = {
    isAuthority: coordinator && coordinator.isCoordinator,
    handleInput: function() { /* ... */ },
    aiInterval: 100,
    frameDelay: 50
};
```

**Question**: Is `coordinator.isCoordinator` actually true for coordinator?

**Evidence from logs**: 
- Debug logs show "Active players: 2/2" which comes from mp-screen-coordinator.js (only coordinator logs this)
- This suggests coordinator IS running authority code

**But**: No timer logs appeared in earlier tests, suggesting `config.isAuthority` might be false

**Action needed**: Add debug logging to verify:
```javascript
debugLog("[MP GAME LOOP] Config: isAuthority=" + config.isAuthority + " isCoordinator=" + coordinator.isCoordinator);
```

---

## What Was Confusing Me (Brain Warp)

### Confusion 1: "Halftime doesn't show"
**Reality**: Halftime DOES show. The issue is what happens AFTER dismissal.

### Confusion 2: "Time check not working"
**Reality**: Time check works fine. Halftime triggers at 5 seconds. The issue is post-halftime flow.

### Confusion 3: "Need to wait for isHalftime clear"
**Reality**: No wait needed. The dismissal signal (`mpScreenAction`) is what matters, not `isHalftime` flag.

### Confusion 4: "Config doesn't exist"
**Reality**: Config DOES exist (lines 870-899). I missed it because I was looking at the wrong part of the file.

### Confusion 5: "Adding logs will help"
**Reality**: Logs don't fix bugs. I wasted time adding debug instead of reading the actual code flow.

---

## Summary For Fresh AI

**The core issue**: Non-coordinator's halftime screen loop is blocking and never calls `playerClient.update()`, so it never receives the dismissal broadcast from the coordinator.

**The fix**: Pass `playerClient` to halftime screen function and call `playerClient.update()` inside the loop.

**What's done**:
1. ✅ Modified halftime.js function signature to accept playerClient
2. ✅ Added playerClient.update() call in halftime loop
3. ✅ Updated non-coordinator call to pass playerClient
4. ✅ Removed broken wait loop

**What's NOT done**:
1. ❌ Test if fix actually works
2. ❌ Fix single-player halftime call (missing 5th param)
3. ❌ Apply same fix to other screens (game-over, matchup, splash)
4. ❌ Remove debug logging added during investigation
5. ❌ Verify config.isAuthority is actually working
6. ❌ Verify coordinator path still works with new signature

**Next steps**:
1. Fix single-player call (add 5th null param)
2. Test multiplayer halftime flow
3. If working, apply same pattern to other screens
4. Remove debug logs
5. Test all screen types
6. Commit with comprehensive message

**Files modified**:
- `lib/ui/halftime.js` - Added playerClient param and update call
- `nba_jam.js` - Updated non-coordinator call, removed wait loop
- `lib/core/game-loop-core.js` - Added debug logging (TEMPORARY)

**Files that need changes**:
- `nba_jam.js` - Fix single-player halftime call
- `lib/ui/game-over.js` - Apply same playerClient.update() pattern
- `lib/ui/menus.js` - Apply same pattern to matchup and splash screens
