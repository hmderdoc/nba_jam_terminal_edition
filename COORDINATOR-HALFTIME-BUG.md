# Coordinator Halftime Bug Analysis

## Problem Statement

**Symptom**: Coordinator doesn't see halftime screen in multiplayer  
**Observation**: Non-coordinator DOES see halftime (after Wave 24 fix)  
**Impact**: Asymmetric multiplayer experience - coordinator plays through halftime  

---

## Root Cause: Broadcast Before Display

### The Flow (Coordinator)

```
1. nba_jam.js:896 - Main loop calls runGameFrame()
2. game-loop-core.js:113 - Detects halftime, returns "halftime"
3. nba_jam.js:896 - if (result === "halftime") { showHalftimeScreen() }
4. halftime.js:15 - showHalftimeScreen() calls mpCoordinator.broadcastGameState()
5. halftime.js:69 - while (true) { ... wait for input ... }
```

### The Problem

**Line 15-27 of halftime.js broadcasts FIRST, then displays screen**:
```javascript
function showHalftimeScreen(systems) {
    stateManager.set("isHalftime", true, "halftime_start");

    // MULTIPLAYER: Broadcast halftime event to all clients
    if (mpCoordinator && mpCoordinator.isCoordinator) {
        mpCoordinator.broadcastGameState({
            type: 'halftime_start',
            currentHalf: currentHalf,
            teamAScore: score.teamA,
            teamBScore: score.teamB,
            timeRemaining: timeRemaining,
            timestamp: Date.now()
        });
    }

    // Then display screen...
    courtFrame.clear();
    courtFrame.gotoxy(1, 1);
    // ... rendering code ...
}
```

**BUT**: There's no immediate issue with this order. The broadcast is asynchronous (writes to Queue), then screen renders. Let me check if there's a conditional that skips display...

### The Real Problem

Looking at line 69-95 of halftime.js:
```javascript
while (true) {
    var key = console.inkey(K_NONE, 100);

    if (key && key.length > 0) {
        var keyUpper = key.toUpperCase();
        if (keyUpper === 'S') {
            // Show substitution screen
            if (showSubstitutionScreen(systems)) {
                break; // User made substitutions and wants to continue
            }
        } else if (key === ' ') {
            break; // Continue to second half
        } else if (keyUpper === 'Q') {
            stateManager.set('gameRunning', false, 'user_quit_halftime');
            return;
        }
    } else if (autoAdvance && (Date.now() - halftimeStart) >= 10000) {
        break; // Auto-continue for CPU games after 10 seconds
    }
}
```

**Wait for input loop should work!** Unless...

### Hypothesis 1: Auto-Advance Triggered

Line 68: `var autoAdvance = !!allCPUMode;`  
Line 93: Auto-advance after 10 seconds if `autoAdvance` is true

**Question**: Is `allCPUMode` somehow set to true in multiplayer coordinator?

### Hypothesis 2: Input Loop Never Entered

Maybe screen renders but immediately exits? Let me check if `gameRunning` gets set to false somehow...

### Hypothesis 3: Screen Renders But Gets Overwritten

Maybe the screen displays for 1 frame, then main loop continues and renders court over it?

---

## Debugging Plan

### Step 1: Add Debug Logging to Halftime.js

Add logs to determine:
1. Does `showHalftimeScreen()` get called?
2. What is the value of `allCPUMode`?
3. Does the input wait loop execute?
4. How long does the loop run?

```javascript
function showHalftimeScreen(systems) {
    debugLog("[HALFTIME] showHalftimeScreen() called");
    var stateManager = systems.stateManager;
    var allCPUMode = stateManager.get('allCPUMode');
    debugLog("[HALFTIME] allCPUMode = " + allCPUMode);
    debugLog("[HALFTIME] mpCoordinator exists: " + !!(mpCoordinator && mpCoordinator.isCoordinator));

    stateManager.set("isHalftime", true, "halftime_start");

    // Broadcast...
    if (mpCoordinator && mpCoordinator.isCoordinator) {
        debugLog("[HALFTIME] Broadcasting halftime event");
        // ... broadcast code ...
    }

    // Render screen...
    debugLog("[HALFTIME] Rendering halftime screen");
    // ... render code ...

    // Wait for input
    var halftimeStart = Date.now();
    var autoAdvance = !!allCPUMode;
    debugLog("[HALFTIME] Entering input loop, autoAdvance=" + autoAdvance);
    
    while (true) {
        var key = console.inkey(K_NONE, 100);
        
        if (key && key.length > 0) {
            debugLog("[HALFTIME] Key pressed: " + key);
            // ... handle key ...
        } else if (autoAdvance && (Date.now() - halftimeStart) >= 10000) {
            debugLog("[HALFTIME] Auto-advance timeout");
            break;
        }
    }
    
    debugLog("[HALFTIME] Exiting halftime screen");
    // ... cleanup ...
}
```

### Step 2: Check allCPUMode State

In multiplayer coordinator setup, verify `allCPUMode` is not set incorrectly:

```bash
grep -n "allCPUMode" nba_jam.js lib/multiplayer/*.js
```

### Step 3: Test Theory

**Theory**: Coordinator's `allCPUMode` is true, causing instant auto-advance

**Test**: 
1. Start multiplayer as coordinator
2. Check `debug.log` for halftime logs
3. Verify if auto-advance triggered

---

## Likely Solutions

### Option A: Skip Auto-Advance for Multiplayer Coordinator

```javascript
// halftime.js line 68
var allCPUMode = stateManager.get('allCPUMode');
var isCoordinator = !!(mpCoordinator && mpCoordinator.isCoordinator);
var autoAdvance = allCPUMode && !isCoordinator; // Don't auto-advance if coordinator
```

**Why**: Coordinator should always wait for human input in multiplayer

### Option B: Check gameRunning Before Auto-Advance

```javascript
else if (autoAdvance && (Date.now() - halftimeStart) >= 10000) {
    if (stateManager.get('gameRunning')) { // Only if still playing
        break;
    }
}
```

### Option C: Disable allCPUMode for Multiplayer

In multiplayer setup (nba_jam.js), ensure:
```javascript
stateManager.set('allCPUMode', false, 'mp_setup');
```

---

## Testing Plan

1. **Add debug logs** to halftime.js
2. **Run multiplayer** as coordinator
3. **Wait for halftime** (set game time to 10 seconds for fast test)
4. **Check debug.log** to see:
   - Was `showHalftimeScreen()` called?
   - What was `allCPUMode` value?
   - Did input loop execute?
   - How long did loop run?
5. **Apply fix** based on findings
6. **Test again** to verify fix

---

## Next Steps

1. Run grep search for `allCPUMode` initialization
2. Add debug logging to halftime.js
3. Test with short game time
4. Analyze debug.log
5. Apply targeted fix
6. Verify both coordinator and non-coordinator see halftime

**Estimated time**: 30-60 minutes
