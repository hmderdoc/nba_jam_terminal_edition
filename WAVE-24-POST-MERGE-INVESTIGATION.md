# Wave 24 Post-Merge Investigation Summary

## Investigation Completed

**Duration**: ~1 hour of architectural analysis  
**Documents Created**:
1. `MULTIPLAYER-FLICKER-ANALYSIS.md` - Root cause analysis of non-coordinator sprite flicker
2. `COORDINATOR-HALFTIME-BUG.md` - Investigation plan for coordinator halftime issue

---

## Finding #1: Non-Coordinator Sprite Flicker

### Root Cause Identified

**Problem**: Perfect timing alignment creates resonance jitter

**Technical Details**:
- Coordinator broadcasts at 20 Hz (50ms intervals)
- Non-coordinator reconciles at 20 Hz (50ms intervals)
- Non-coordinator renders at 20 FPS (50ms per frame)
- **Perfect sync = phase misalignment oscillation**

**The Mechanism**:
```
T=0ms:   Frame renders, reads fresh state (0ms old)
T=50ms:  Frame renders, reads state (could be 0-50ms old)
T=100ms: Frame renders, reads state (could be 0-50ms old)

Result: Alternating between smooth interpolation and snap corrections
Visual: Constant micro-jitter/judder
```

**Amplifying Factors**:
1. `smoothFactor = 0.95` creates slow drift → sudden snap oscillation
2. Integer rounding on float interpolation creates visible "pops"
3. 2-unit snap threshold at basketball scale (2.5% of court) too sensitive
4. No client-side prediction for other sprites (only own sprite predicted)

### Recommended Solution: Option B (1 hour)

**Change**: Reduce reconciliation frequency, remove interpolation

**Implementation**:
```javascript
// lib/multiplayer/mp_client.js

// Line 116 - Reduce check rate
this.stateCheckInterval = 100; // Was 50ms, now 100ms (10 Hz)

// Line 398 - Remove smoothing
var smoothFactor = 1.0; // Was 0.95, now instant snap
```

**Why This Works**:
- Fewer updates = less frequent judder
- Immediate snap eliminates oscillation
- 10 Hz still responsive (industry standard)
- 5-minute change, low risk

**Trade-off**: Slightly "steppier" movement, but eliminates micro-jitter

**Alternative Options** (if Option B insufficient):
- Option C: Adaptive smoothing (2-3 hours)
- Option D: Dead reckoning (3-4 hours)
- Option A: Full client prediction (4-6 hours)

---

## Finding #2: Coordinator Halftime Mystery

### Current Understanding

**Symptom**: Coordinator doesn't see halftime screen  
**Non-coordinator**: Halftime works correctly (after Wave 24 fix)

### Code Flow Verified

1. `game-loop-core.js:113` - Authority detects halftime, returns "halftime"
2. `nba_jam.js:896` - Main loop receives "halftime", calls `showHalftimeScreen()`
3. `halftime.js:15` - Broadcasts halftime event to clients
4. `halftime.js:36-69` - Renders halftime screen
5. `halftime.js:71-95` - Waits for user input (while loop)

### Eliminated Hypotheses

❌ **Auto-advance**: `allCPUMode` is `false` in multiplayer (line 723 nba_jam.js)  
❌ **Broadcast order**: Broadcast happens first, then render (correct order)  
❌ **Missing function call**: `runGameFrame()` correctly returns "halftime"

### Remaining Hypothesis

**Screen renders but gets immediately overwritten by main loop**

**Theory**: After `showHalftimeScreen()` returns (user presses SPACE), line 899-905 of nba_jam.js continues:
```javascript
if (result === "halftime") {
    showHalftimeScreen(systems);
    if (!stateManager.get("gameRunning")) break; // User quit during halftime

    // Reset for second half
    if (stateManager.get("pendingSecondHalfInbound")) {
        startSecondHalfInbound(systems);
    }
    drawCourt(systems);
    drawScore(systems);
    stateManager.set("lastSecondTime", Date.now(), "halftime_reset");
    continue; // ← Back to main loop
}
```

**Potential Issue**: Maybe coordinator never enters the `showHalftimeScreen()` input loop?

### Debugging Plan

**Step 1: Add Debug Logging** (5 minutes)
```javascript
// lib/ui/halftime.js

function showHalftimeScreen(systems) {
    debugLog("[HALFTIME] === showHalftimeScreen() CALLED ===");
    var stateManager = systems.stateManager;
    
    debugLog("[HALFTIME] mpCoordinator check: " + !!(mpCoordinator && mpCoordinator.isCoordinator));
    debugLog("[HALFTIME] allCPUMode: " + stateManager.get('allCPUMode'));
    
    stateManager.set("isHalftime", true, "halftime_start");

    // Broadcast
    if (mpCoordinator && mpCoordinator.isCoordinator) {
        debugLog("[HALFTIME] Coordinator broadcasting event");
        // ... broadcast code ...
    }

    // Render
    debugLog("[HALFTIME] Rendering screen...");
    // ... render code ...

    // Input loop
    var halftimeStart = Date.now();
    var allCPUMode = stateManager.get('allCPUMode');
    var autoAdvance = !!allCPUMode;
    
    debugLog("[HALFTIME] Entering input loop, autoAdvance=" + autoAdvance);
    
    while (true) {
        var key = console.inkey(K_NONE, 100);
        
        if (key && key.length > 0) {
            debugLog("[HALFTIME] Key pressed: " + key.toUpperCase());
            // ... handle key ...
        } else if (autoAdvance && (Date.now() - halftimeStart) >= 10000) {
            debugLog("[HALFTIME] Auto-advance triggered");
            break;
        }
        
        // Periodic heartbeat log
        if ((Date.now() - halftimeStart) % 5000 < 100) {
            debugLog("[HALFTIME] Still waiting for input, elapsed: " + (Date.now() - halftimeStart) + "ms");
        }
    }
    
    debugLog("[HALFTIME] Exiting halftime screen");
    // ... cleanup ...
}
```

**Step 2: Test with Short Game** (10 minutes)
1. Set game time to 10 seconds: `stateManager.set("totalGameTime", 10, "debug_test");`
2. Run multiplayer as coordinator
3. Wait for halftime (5 seconds)
4. Monitor terminal and `tail -f debug.log`

**Step 3: Analyze Logs** (5 minutes)
- Does `showHalftimeScreen()` get called?
- Does input loop execute?
- What triggers loop exit?
- Check timestamps

**Step 4: Apply Fix** (10-30 minutes based on findings)

---

## Action Plan

### Immediate (Do Now)

**Option 1: Fix Flicker First** (Low-hanging fruit)
- Edit `mp_client.js` lines 116 and 398
- Test in multiplayer
- ~1 hour total

**Option 2: Debug Halftime First** (More mysterious)
- Add logging to `halftime.js`
- Test with short game time
- Analyze and fix
- ~30-60 minutes

**Recommendation**: Start with halftime debug (might be trivial fix), then tackle flicker

### Testing Sequence

1. **Halftime Debug**:
   - Add logs
   - Test coordinator behavior
   - Verify non-coordinator still works
   - Apply fix if needed

2. **Flicker Fix** (Option B):
   - Change 2 lines in mp_client.js
   - Test multiplayer (fast movement)
   - Measure improvement (count pops)
   - If insufficient, try Option C

3. **Regression Test**:
   - Single-player (unaffected)
   - Multiplayer coordinator
   - Multiplayer non-coordinator
   - AI behavior
   - Network lag simulation

### Fallback Plans

**If Option B doesn't fix flicker**:
- Try Option C (adaptive smoothing): 2-3 hours
- Measure again
- If still bad, consider Option D or A

**If halftime bug is deep**:
- May need to refactor halftime/multiplayer interaction
- Estimated: 1-2 hours max

---

## Estimated Total Time

**Optimistic** (both quick fixes work):
- Halftime debug + fix: 30 minutes
- Flicker Option B: 1 hour
- Testing: 30 minutes
- **Total: 2 hours**

**Realistic** (one issue needs iteration):
- Halftime debug + fix: 1 hour
- Flicker Option B → Option C: 3 hours
- Testing: 30 minutes
- **Total: 4.5 hours**

**Pessimistic** (both need deep fixes):
- Halftime refactor: 2 hours
- Flicker full prediction: 6 hours
- Testing: 1 hour
- **Total: 9 hours**

---

## Recommendation to User

**Start with halftime debug** - Add logging first, test, analyze. This is likely a quick fix and will build confidence.

**Then tackle flicker** - Try Option B (simple change). If it works, huge win. If not, we have Options C/D/A ready.

**Total investment**: 2-4 hours for both issues (likely)

**Defer to Wave 25**:
- Trail animations (4-6 hours)
- Overtime system (6-10 hours)

**Next user interaction**: After completing both fixes, report results and move to trails/overtime planning.
