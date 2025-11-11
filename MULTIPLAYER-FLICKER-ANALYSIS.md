# Multiplayer Non-Coordinator Flicker Analysis

## Problem Statement

**Symptom**: Non-coordinator sees constant sprite flicker/judder during multiplayer gameplay  
**Observation**: Coordinator's view is flawless, non-coordinator experience is degraded  
**Impact**: Makes game uncomfortable to play as non-coordinator client  
**Age**: Old debt from pre-Wave23 blocking architecture  

---

## Root Cause Analysis

### Timing Mismatch: Game Loop vs State Updates

**Game Loop (Non-Coordinator)**:
- Frame Rate: 20 FPS (50ms per frame) - Line 883 in nba_jam.js
- Every frame: `runGameFrame()` → `playerClient.update()` → reconciliation

**State Broadcast (Coordinator)**:
- Broadcast Rate: 20 Hz (50ms interval) - Line 39 in mp_coordinator.js  
- Every 50ms: `coordinator.update()` → `broadcastState()` via Queue

**State Consumption (Non-Coordinator)**:
- Check Interval: 20 Hz (50ms) - Line 116 in mp_client.js
- Throttled reconciliation: `if (now - this.lastStateCheck >= 50ms)`

### The Problem: Perfect Alignment = Guaranteed Jitter

```
Frame Timeline (Non-Coordinator):
T=0ms    : Frame 1 starts, reads state (0ms old)
T=50ms   : Frame 2 starts, reads state (might be 0ms or 50ms old)
T=100ms  : Frame 3 starts, reads state (might be 0ms or 50ms old)

State Broadcast Timeline (Coordinator):
T=0ms    : State broadcast 1
T=50ms   : State broadcast 2
T=100ms  : State broadcast 3

The Problem:
- If frame reads state at T=49ms, it gets 49ms-old data (smooth)
- If frame reads state at T=51ms, it gets 1ms-old data (snap/jump)
- Next frame at T=101ms gets 1ms-old data again (smooth)
- Then T=149ms gets 49ms-old data (snap/jump back)

Result: Constant back-and-forth between "smooth interpolation" and "snap to latest"
```

### Smoothing Factor Amplifies Jitter

From `mp_client.js:398`:
```javascript
var smoothFactor = 0.95; // High value for less visible jumping
```

**What it does**:
```javascript
nextX = currentX + deltaX * 0.95;
```

**The paradox**:
- Smooth factor tries to reduce jumping by interpolating slowly
- BUT this creates MORE visible jitter because:
  1. Small deltas (< 2 units) get smoothed → slow drift
  2. Large deltas (≥ 2 units) snap immediately → sudden jump
  3. Alternating between smooth/snap every frame = flicker

**Example**:
```
Server says: X=10
Client at X=8
Delta = 2 units

Frame 1: nextX = 8 + (2 * 0.95) = 9.9 ≈ 10 (rounds, snaps)
Frame 2: Server still says X=10, client now at X=10, delta=0 (smooth)
Frame 3: Server updated to X=11, delta=1 (smoothed to 10.95 ≈ 11)
Frame 4: Server at X=12, client at X=11, delta=1 (smoothed to 11.95 ≈ 12)

Visual: Smooth, smooth, SNAP, smooth, smooth, SNAP... = flicker
```

---

## Contributing Factors

### 1. Integer Rounding

Sprites use integer coordinates, but interpolation uses floats:
```javascript
var nextX = currentX + deltaX * 0.95;  // Float
sprite.moveTo(Math.round(nextX), Math.round(nextY));  // Rounds to int
```

**Problem**: 
- `nextX = 9.9` rounds to 10 (snap)
- `nextX = 9.4` rounds to 9 (stays)
- Creates visible "pop" when crossing .5 threshold

### 2. Threshold Logic Inconsistency

From `mp_client.js:452-469`:
```javascript
if (absDx < 0.001 && absDy < 0.001) {
    // Already there, snap
    nextX = targetX;
} else if (absDx >= 2 || absDy >= 2) {
    // Large delta, snap immediately
    nextX = targetX;
} else if (lastAuthX === targetX && lastAuthY === targetY) {
    // Server hasn't moved, snap to stop drift
    nextX = targetX;
} else {
    // Small delta, interpolate
    nextX = currentX + deltaX * smoothFactor;
}
```

**Problem**:
- Threshold at 2 units is arbitrary
- At basketball court scale (80x18), 2 units = 2.5% of court width
- Players moving at 1.5 units/frame get smoothed
- Players moving at 2.1 units/frame snap
- Creates visual "gear shift" effect

### 3. Frame Rate Parity Creates Resonance

- Non-coordinator: 20 FPS (50ms frame time)
- Coordinator broadcast: 20 Hz (50ms interval)
- **Perfect alignment** means phase relationship varies:
  - Sometimes frame reads right after broadcast (fresh data)
  - Sometimes frame reads right before broadcast (stale data)
  - Creates oscillating behavior

### 4. No Prediction for Other Players

Non-coordinator uses **pure reconciliation** for other sprites:
- Waits for server state
- Interpolates toward last known position
- No extrapolation or prediction

**Contrast with own sprite**:
- Non-coordinator predicts own movement locally
- Smooth because prediction fills gaps between updates
- Other sprites don't get this treatment

---

## Why Coordinator is Flawless

1. **Authority**: Coordinator runs game logic locally (no reconciliation)
2. **Immediate**: Sprites move as soon as logic runs (no network delay)
3. **Consistent**: No state broadcast affects local sprites
4. **No Smoothing**: Direct position updates, no interpolation

---

## Proposed Solutions

### Option A: Client-Side Prediction for All Sprites (4-6 hours)

**Concept**: Non-coordinator predicts movement for all sprites between state updates

**Implementation**:
```javascript
// Store velocity for each sprite
sprite.predictedVelocity = { dx: 0, dy: 0 };

// On state update, calculate velocity
var velocity = {
    dx: (newX - oldX) / timeDelta,
    dy: (newY - oldY) / timeDelta
};

// Every frame between updates, extrapolate
if (timeSinceLastUpdate < 100ms) {
    sprite.x += velocity.dx * frameDelta;
    sprite.y += velocity.dy * frameDelta;
}

// When new state arrives, blend prediction with truth
```

**Pros**:
- Smooth movement between state updates
- Handles variable network latency
- Industry-standard technique (Source engine, etc.)

**Cons**:
- Complex implementation
- Can overshoot if player suddenly stops
- Requires velocity tracking per sprite
- May predict wrong direction during rapid turns

**Risk**: High complexity, potential for new artifacts

---

### Option B: Reduce Reconciliation Frequency (1 hour) ⭐ **RECOMMENDED**

**Concept**: Update less often, but commit fully to each update

**Current**: Check every 50ms, interpolate with 0.95 smoothing  
**Proposed**: Check every 100ms (10 Hz), snap immediately (no smoothing)

**Implementation**:
```javascript
// mp_client.js line 116
this.stateCheckInterval = 100; // Was 50ms, now 100ms (10 Hz)

// mp_client.js line 398
var smoothFactor = 1.0; // Was 0.95, now instant snap
```

**Why this works**:
- Fewer updates = less frequent judder
- Immediate snap = no oscillating interpolation
- 10 Hz still feels responsive (many games use 10-15 Hz)
- Simple change, low risk

**Trade-off**:
- Slightly less smooth during fast movement
- More "steppy" appearance
- But eliminates constant micro-jitter

**Pros**:
- 5-minute change
- Low risk
- Proven approach (many MP games use 10-15 Hz)

**Cons**:
- Sacrifices some smoothness for stability
- May feel slightly more "networked"

---

### Option C: Adaptive Smoothing Based on Delta (2-3 hours)

**Concept**: Use different smoothing for different movement speeds

**Implementation**:
```javascript
// Calculate speed-based smoothing
var deltaDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

var smoothFactor;
if (deltaDistance < 0.5) {
    smoothFactor = 1.0; // Tiny delta, snap immediately
} else if (deltaDistance < 1.5) {
    smoothFactor = 0.8; // Small delta, moderate smoothing
} else if (deltaDistance < 3) {
    smoothFactor = 0.6; // Medium delta, light smoothing
} else {
    smoothFactor = 1.0; // Large delta, snap immediately
}

nextX = currentX + deltaX * smoothFactor;
```

**Pros**:
- Smooth during constant-speed movement
- Snap during rapid changes
- No prediction complexity

**Cons**:
- Still has rounding artifacts
- More complex than Option B
- May still have gear-shift effect

---

### Option D: Dead Reckoning with Steering (3-4 hours)

**Concept**: Extrapolate linearly, steer toward truth

**Implementation**:
```javascript
// Dead reckon every frame
sprite.x += sprite.lastVelocity.dx;
sprite.y += sprite.lastVelocity.dy;

// When state arrives, steer toward it over next 100ms
var errorX = serverX - sprite.x;
var errorY = serverY - sprite.y;
sprite.x += errorX * 0.1; // Correct 10% per frame
sprite.y += errorY * 0.1;
```

**Pros**:
- Smooth between updates
- Gradual error correction
- Handles acceleration

**Cons**:
- Requires velocity tracking
- Can drift during stops/turns
- Complex state management

---

### Option E: Increase Broadcast Rate (30 minutes) ⚠️ **NOT RECOMMENDED**

**Concept**: Broadcast state more often (40 Hz instead of 20 Hz)

**Why not**:
- Doubles network bandwidth
- May saturate slow connections
- Doesn't fix fundamental problem
- Just makes jitter faster (less visible but still present)

**Only viable if**: Network capacity is abundant

---

## Recommended Approach

### Phase 1: Quick Win (1 hour)
**Implement Option B**: Reduce reconciliation frequency to 100ms, remove smoothing

**Changes**:
1. `mp_client.js` line 116: `stateCheckInterval = 100`
2. `mp_client.js` line 398: `smoothFactor = 1.0`
3. Test in multiplayer

**Expected result**: Less frequent but more stable position updates

### Phase 2: If Still Problematic (2-3 hours)
**Implement Option C**: Adaptive smoothing based on movement speed

### Phase 3: If Perfect Smoothness Required (4-6 hours)
**Implement Option A**: Full client-side prediction with dead reckoning

---

## Testing Plan

### Baseline Test (Current State)
1. Start multiplayer game
2. Non-coordinator: Watch opposing sprites during movement
3. **Measure**: Count visible "pops" per 10 seconds
4. **Current**: Likely 5-10 pops/10sec

### Option B Test (100ms reconciliation)
1. Apply changes (2 lines)
2. Restart multiplayer game
3. **Measure**: Count visible pops per 10 seconds
4. **Expected**: 1-2 pops/10sec (80% reduction)

### Success Criteria
- Non-coordinator gameplay feels comfortable
- Sprites move without constant micro-adjustments
- Fast movement still feels responsive
- Network lag doesn't cause rubber-banding

---

## Architecture Notes

### Why This Wasn't Fixed Pre-Wave23

Old blocking architecture had different problems:
- Entire game loop blocked on network I/O
- Frame rate varied wildly based on network
- Jitter was masked by other performance issues
- Non-blocking refactor exposed the reconciliation issue

### Wave 23 Non-Blocking Benefits

- Consistent 20 FPS on both clients
- Network delays don't freeze game
- Clean separation of authority/prediction
- **Trade-off**: Now we see reconciliation artifacts clearly

### Future Enhancements

If Option B doesn't fully solve it:
1. Add velocity smoothing (Option D)
2. Implement full prediction (Option A)
3. Add lag compensation for hit detection
4. Smart reconciliation (only update when meaningful change)

---

## Estimated Time Investment

- **Option B** (Recommended): 1 hour (30 min implementation + 30 min testing)
- **Option C** (Fallback): 2-3 hours  
- **Option A** (Nuclear): 4-6 hours
- **Analysis complete**: Already done ✅

**Next Step**: Try Option B, evaluate, iterate if needed.
