# Halftime Screen Bug - Handoff to Fresh AI

**Date**: November 11, 2025  
**Status**: BROKEN - Fix attempted but doesn't work  
**Priority**: HIGH - Blocks multiplayer completion

---

## The Problem (Verified by User - Tested Twice)

**Symptom**: In multiplayer game, after halftime screen, **non-coordinator player doesn't see second half**. Game goes straight to game over or freezes.

**What Works**:
- ✅ Halftime screen DOES appear for both players
- ✅ Both players can press space to vote
- ✅ Coordinator sees "both players ready"
- ✅ Coordinator's game continues to second half

**What's Broken**:
- ❌ Non-coordinator doesn't continue to second half after halftime dismissal
- ❌ Fix was attempted (see below) but **user tested twice - still doesn't work**

---

## Architecture Context

### Wave 24 Multiplayer Screen System

All multiplayer screens (splash, matchup, halftime, game over) use this pattern:

1. **Coordinator** calls `mpScreenCoordinator.enterScreen()` → broadcasts `mpScreen: "halftime"` state
2. **Non-coordinators** receive broadcast via `playerClient.update()` → see `mpScreen` state change
3. All players show screen and can vote (press space)
4. When ready/timeout, **coordinator** calls `mpScreenCoordinator.dismissScreen()` → broadcasts `mpScreen: null`
5. **Non-coordinators** receive dismissal via `playerClient.update()` → check `mpScreenAction` → break from screen loop
6. All synchronized, gameplay continues

**Key insight**: Non-coordinators MUST call `playerClient.update()` inside screen loops to receive state broadcasts.

---

## Previous Agent's Attempted Fix (DOESN'T WORK)

The previous AI identified that `halftime.js` screen loop wasn't calling `playerClient.update()`.

### Changes Made:

#### File: `lib/ui/halftime.js`

**Line 14** - Added `playerClient` parameter:
```javascript
function showHalftimeScreen(systems, mpScreenCoordinator, myPlayerId, coordinator, playerClient) {
```

**Lines 117-121** - Added update call in loop:
```javascript
// Non-coordinator: Update state from coordinator
if (!isCoordinator && playerClient && playerClient.update) {
    playerClient.update(0); // Frame number not critical for state sync
}
```

#### File: `nba_jam.js`

**Line 951** - Non-coordinator passes `playerClient`:
```javascript
var halftimeResult = showHalftimeScreen(systems, mpScreenCoordinator, myId.globalId, null, playerClient);
```

**Line 917** - Coordinator passes `null` as 5th param:
```javascript
var halftimeResult = showHalftimeScreen(systems, mpScreenCoordinator, myId.globalId, coordinator, null);
```

**Line 141** - Single-player passes 5 nulls:
```javascript
var halftimeResult = showHalftimeScreen(systems, null, null, null, null);
```

### Why This Fix Doesn't Work (User Tested - Still Broken)

**Hypothesis 1**: `playerClient.update()` is being called but returns before state is received (async/timing issue)

**Hypothesis 2**: The dismissal broadcast isn't reaching non-coordinator at all (network/queue issue)

**Hypothesis 3**: `mpScreenAction` is being set but not checked correctly in halftime loop

**Hypothesis 4**: The loop breaks but something else prevents second half from starting

**NEED**: Fresh debugging approach - previous AI got tunnel vision on playerClient.update() call.

---

## Code Locations (Where to Look)

### Halftime Screen Loop
**File**: `/sbbs/xtrn/nba_jam/lib/ui/halftime.js` lines 49-114

The while(true) loop that waits for dismissal:
```javascript
while (true) {
    // Check for dismissal signal in multiplayer
    if (isMultiplayer) {
        var mpScreenAction = stateManager.get("mpScreenAction");

        if (mpScreenAction && mpScreenAction.action === "dismiss" && mpScreenAction.screen === "halftime") {
            debugLog("[HALFTIME] Received dismissal signal from coordinator");
            stateManager.set("mpScreenAction", null, "halftime_dismiss_handled");
            break;
        }

        // Coordinator: Check if can dismiss
        if (isCoordinator && mpScreenCoordinator.canDismiss()) {
            debugLog("[HALFTIME] Coordinator dismissing screen");
            mpScreenCoordinator.dismissScreen();
            break;
        }
        
        // ... input handling ...
        
        // Coordinator: Force state broadcast to keep clients updated
        if (isCoordinator && coordinator && coordinator.update) {
            coordinator.update();
        }

        // Non-coordinator: Update state from coordinator
        if (!isCoordinator && playerClient && playerClient.update) {
            playerClient.update(0); // <-- THIS WAS ADDED BUT DOESN'T WORK
        }
    }
    
    // ... rest of loop ...
}
```

### Coordinator Dismissal Logic
**File**: `/sbbs/xtrn/nba_jam/lib/multiplayer/mp-screen-coordinator.js` lines 195-234

```javascript
this.dismissScreen = function () {
    if (!screenState.active) return;
    
    debugLog("[MP SCREEN] Dismissing screen: " + screenState.currentScreen);
    
    var dismissedScreen = screenState.currentScreen;
    screenState.active = false;
    screenState.currentScreen = null;
    
    // Broadcast dismissal
    broadcastScreenState();
    
    // ... cleanup ...
};

function broadcastScreenState() {
    if (!mpCoordinator || !mpCoordinator.isCoordinator) return;
    
    var state = screenState.active ? screenState.currentScreen : null;
    
    debugLog("[MP SCREEN] Broadcasting screen state: " + state);
    systems.stateManager.set("mpScreen", state, "screen_state_broadcast");
    
    // Force immediate state broadcast
    if (mpCoordinator.broadcastState) {
        mpCoordinator.broadcastState();
    }
}
```

### Non-Coordinator Game Loop
**File**: `/sbbs/xtrn/nba_jam/nba_jam.js` lines 945-960

```javascript
var isHalftime = stateManager.get("isHalftime");
var halftimeHandled = stateManager.get("halftimeHandled");

if (isHalftime && !halftimeHandled) {
    debugLog("[MP GAME LOOP] Non-coordinator detected halftime, showing screen");
    stateManager.set("halftimeHandled", true, "mp_halftime_detected");

    var halftimeResult = showHalftimeScreen(systems, mpScreenCoordinator, myId.globalId, null, playerClient);
    if (halftimeResult === "quit" || !stateManager.get("gameRunning")) {
        break;
    }

    // Redraw court after halftime
    drawCourt(systems);
    drawScore(systems);
}

// Clear halftime flag when coordinator clears it
if (!isHalftime && halftimeHandled) {
    stateManager.set("halftimeHandled", false, "mp_halftime_reset");
}
```

### State Reception (Client Side)
**File**: `/sbbs/xtrn/nba_jam/lib/multiplayer/mp_client.js` lines 706-730

```javascript
this.update = function (frameNumber) {
    // ... network read ...
    
    // Read state updates from coordinator
    var stateUpdate = this.coordinator.read(/* ... */);
    if (stateUpdate && stateUpdate.gameState) {
        // ... apply state ...
        
        // Handle screen state
        if (stateUpdate.gameState.mps !== undefined) {
            var screenState = stateUpdate.gameState.mps;
            var action = mpScreenCoordinator.handleScreenState(screenState);
            
            if (action) {
                debugLog("[CLIENT] Screen action: " + action.action + " for screen: " + action.screen);
                systems.stateManager.set("mpScreenAction", action, "client_screen_update");
            }
        }
    }
}
```

---

## Debug Logging Available

Previous AI added extensive debug logging. To view:

```bash
tail -100 /sbbs/xtrn/nba_jam/debug.log
```

Look for these tags:
- `[HALFTIME]` - Halftime screen events
- `[MP SCREEN]` - Screen coordinator events
- `[CLIENT]` - Non-coordinator client events
- `[MP GAME LOOP]` - Game loop events

**What to check**:
1. Does coordinator log `[MP SCREEN] Broadcasting screen state: null` on dismissal?
2. Does non-coordinator log `[CLIENT] Screen action: dismiss for screen: halftime`?
3. Does non-coordinator log `[HALFTIME] Received dismissal signal from coordinator`?
4. Does non-coordinator break from halftime loop or stay stuck?

---

## Testing Environment

- Game time: 10 seconds (5 second halftime)
- Test setup: 2-player multiplayer (coordinator + non-coordinator)
- How to test:
  1. Start multiplayer game
  2. Wait ~5 seconds for halftime
  3. Both players press space
  4. Observe: Does non-coordinator continue to second half?

**Expected**: Both players continue  
**Actual**: Coordinator continues, non-coordinator broken

---

## What Fresh AI Should Do

### Step 1: Verify the Actual Problem
Don't assume previous AI's diagnosis is correct. Add strategic debug logging:

1. In `halftime.js` loop, log EVERY iteration:
   - Is `playerClient.update()` being called?
   - What does `stateManager.get("mpScreenAction")` return?
   - Is loop breaking or staying stuck?

2. In `mp_client.js` update(), log:
   - Is `stateUpdate` received?
   - What is `stateUpdate.gameState.mps`?
   - Is `mpScreenAction` being set?

3. In `mp-screen-coordinator.js`, log:
   - When `dismissScreen()` called
   - When `broadcastScreenState()` called
   - What state is broadcast

### Step 2: Test The Hypothesis
The previous AI assumed `playerClient.update()` wasn't being called. That's been "fixed" but doesn't work.

**New hypotheses to test**:
1. **Timing**: Does `playerClient.update()` need to be called BEFORE checking `mpScreenAction`? (currently checks first, updates after)
2. **Blocking**: Is `console.inkey()` blocking the loop from processing updates?
3. **State overwrite**: Is something clearing `mpScreenAction` before halftime loop checks it?
4. **Loop condition**: Does the break actually execute or is there another exit path?

### Step 3: Consider Alternative Approaches

If `playerClient.update()` approach doesn't work, consider:

**Option A**: Make halftime screen fully non-blocking (return to game loop, check dismissal there)

**Option B**: Use a different signaling mechanism (not mpScreenAction)

**Option C**: Coordinator explicitly tells non-coordinator to exit (push instead of pull)

---

## Files Modified (Previous Attempts)

These files have changes from previous AI's attempted fix:

- `/sbbs/xtrn/nba_jam/lib/ui/halftime.js` - Added playerClient param and update call
- `/sbbs/xtrn/nba_jam/nba_jam.js` - Updated all showHalftimeScreen calls
- `/sbbs/xtrn/nba_jam/lib/core/game-loop-core.js` - Added debug logging (lines 118-121, should be removed)

---

## Important Notes for Fresh AI

1. **Don't trust previous diagnosis blindly** - Previous AI was confidently wrong multiple times
2. **User has tested twice** - The "fix" doesn't work, don't claim it does without verification
3. **Other screens likely have same issue** - game-over.js, matchup, splash screens
4. **Debug logs are your friend** - Use them to verify actual behavior
5. **Test incrementally** - Make small changes, test each one
6. **Ask user for log snippets** - Don't guess what's happening

---

## Success Criteria

Fix is complete when:
- ✅ Non-coordinator continues to second half after halftime dismissal
- ✅ Second half gameplay works normally
- ✅ Game ends properly at 0 seconds
- ✅ Same fix applied to other screens (game over, matchup, splash)
- ✅ Both single-player and multiplayer work

---

## Question for Fresh AI

**What is the actual flow of dismissal signals?** Trace it step-by-step:

1. Coordinator presses space → what happens?
2. When does coordinator call `mpScreenCoordinator.dismissScreen()`?
3. When does `mpScreen: null` get broadcast?
4. When does non-coordinator receive it?
5. When does `mpScreenAction` get set?
6. When does halftime loop check it?
7. What prevents the break from executing?

**Start by answering these questions with debug logs, not assumptions.**

---

Good luck. Previous AI failed because they made assumptions instead of verifying. Don't repeat that mistake.
