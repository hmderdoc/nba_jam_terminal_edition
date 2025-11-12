# Wave 24 Post-Merge Investigation Summary

## Investigation Completed

**Duration**: ~1 hour of architectural analysis  
**Documents Created**:
1. `MULTIPLAYER-FLICKER-ANALYSIS.md` - Root cause analysis of non-coordinator sprite flicker
2. **Status**: Halftime synchronization issues resolved ✅

---

## Update: Collision Detection Improvements ✅

### Issue Resolved: Movement Restriction

**Problem**: Collision guard was too restrictive, causing players to get stuck or unable to move around defenders

**Root Causes Fixed**:
1. **Key code handling bug** - `calculateNextCoords()` wasn't properly handling KEY_LEFT, KEY_RIGHT, etc.
2. **Wrong data source** - Collision guard was looking for non-existent player data instead of actual sprites
3. **Threshold too strict** - `dx < 2 && dy < 2` was blocking legitimate movement
4. **Missing team filtering** - Should only check opponent collisions, not teammates

**Implementation Changes**:
```javascript
// lib/multiplayer/mp_client.js

// Fixed key handling in calculateNextCoords()
if (typeof KEY_LEFT !== 'undefined' && direction === KEY_LEFT) {
    nx -= speed;
} // etc.

// Use actual sprite positions instead of phantom player data
var allPlayers = spriteRegistry.getAllPlayers();

// Reduced threshold from 2.0 to 1.5 units
if (dx < 1.5 && dy < 1.5) {

// Added team filtering - only check opponents
if (localTeam && otherTeam && localTeam === otherTeam) continue;
```

**Result**: ✅ **Movement feel improved** - Players can now move around defenders naturally

### Issue Resolved: Human vs Human Collision Parity ✅

**Problem**: Collision detection worked for AI vs AI and AI vs Human, but Human vs Human players could walk through each other

**Root Cause**: Timing issue in coordinator's input processing
- Human inputs processed in `coordinator.processInputs()` 
- Collision detection ran later in `runGameFrame()`
- By then, both human players had already moved through each other

**Solution**: Added collision detection directly in coordinator's `applyInput()` function
```javascript
// Check collision before applying human movement
var dx = Math.abs(other.x - plannedX);
var dy = Math.abs(other.y - plannedY);
if (dx < 2 && dy < 2) {
    // Block movement - same threshold as authority collision
    moveBlocked = true;
}
```

**Result**: ✅ **Human vs Human collision now works** - Both players blocked from walking through opponents

---

## Remaining Issue: Visual Flicker

### Root Cause Analysis

**Problem**: Non-coordinator sprite flicker during multiplayer

**Technical Details**:
- Perfect timing alignment creates resonance jitter
- Coordinator broadcasts at ~20 Hz, client reconciles at ~12 Hz (83ms)  
- Visual guard helps but doesn't eliminate all flicker

**The Mechanism**:
```
T=0ms:   Client predicts movement
T=83ms:  Server correction arrives, visual guard may suppress
T=166ms: Large corrections still visible as flicker
```

**Contributing Factors**:
1. Court redraws every frame in multiplayer vs rarely in single-player
2. Sprite z-order and frame cycling timing issues
3. Partial sprite flickering suggests frame overlap problems

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

---

## Action Plan

### Immediate Focus: Flicker Issue Only

**Current Status**: Halftime bug resolved ✅

**Remaining Work**: Address multiplayer sprite flicker for non-coordinator players

### Testing Sequence

1. **Analyze Current Flicker State**:
   - Review existing Wave 24 fixes (timing jitter, visual guards, adaptive smoothing)
   - Identify what reverted changes need to be re-examined
   - Test current flicker severity in multiplayer

2. **Regression Test**:
   - Single-player (should be unaffected)
   - Multiplayer coordinator (should be smooth)
   - Multiplayer non-coordinator (experiencing flicker)
   - AI behavior during flicker
   - Network lag impact on flicker

### Fallback Plans

**If current sophisticated fixes aren't working**:
- May need fundamental architectural approach
- Consider alternative reconciliation strategies
- Examine prediction vs authority timing gaps

---

## Estimated Time Focus

**Focused on flicker only**:
- Analysis of current state: 1 hour
- Testing and measurement: 1 hour  
- Implementation of refined fix: 2-4 hours
- **Total: 4-6 hours**

---

## Recommendation to User

**Focus entirely on flicker** - Halftime is resolved, so all energy can go toward the sprite synchronization issue.

**Approach**: Start with measuring current flicker severity, then work systematically through the existing Wave 24 fixes to see what's not working as intended.

**Defer to Wave 25**:
- Trail animations (4-6 hours)
- Overtime system (6-10 hours)
