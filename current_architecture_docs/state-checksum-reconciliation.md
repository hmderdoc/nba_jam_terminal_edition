# State Checksum Reconciliation (Middle-Ground Animation Sync)

## Problem Statement

**Snapbacks occur when**:
- Client prediction drifts beyond threshold (currently undefined `DRIFT_SNAP_THRESHOLD`)
- Input replay after snaps immediately reintroduces drift
- No graceful transition between "scripted" (inbound) and "predictive" (normal play) modes

**Idea #6 (Animation Hints) tried to solve this by**:
- Coordinator explicitly telling clients what animation to play
- Disabling prediction during hints
- **Failed because**: Timing dependencies, NaN coordinates, CPU AI lockups

## The Middle Ground: Phase-Based Prediction Modes

Instead of micromanaging animations, **synchronize game phases and let clients infer correct behavior**.

### Core Concept

```javascript
// Coordinator adds to state packet:
state.phase = {
    type: "INBOUND_WALK",     // or "NORMAL_PLAY", "REBOUND_SCRAMBLE", etc.
    tick: currentTick,        // When phase started
    checksum: phaseChecksum   // Hash of critical state
};

// Client uses phase to switch prediction mode:
switch (state.phase.type) {
    case "INBOUND_WALK":
        // Disable all prediction, trust authority completely
        this.disablePrediction = true;
        this.reconciliationStrength = 1.0;  // Snap immediately
        break;
        
    case "NORMAL_PLAY":
        // Normal prediction with visual guards
        this.disablePrediction = false;
        this.reconciliationStrength = 0.3;
        break;
        
    case "REBOUND_SCRAMBLE":
        // High prediction, low reconciliation (chaotic movement)
        this.disablePrediction = false;
        this.reconciliationStrength = 0.15;
        break;
}
```

### Key Differences from Idea #6

| Aspect | Animation Hints (Failed) | Phase-Based Modes (Proposed) |
|--------|-------------------------|------------------------------|
| **What's sent** | Explicit animation commands | High-level game phase enum |
| **Prediction** | Disabled per-animation | Tuned per-phase |
| **Timing** | Hints must arrive before position | Phase and position arrive together |
| **Client autonomy** | None (waits for hints) | High (chooses animation based on phase + position delta) |
| **CPU AI** | Broke (hint loops) | Unaffected (CPU is coordinator) |

### Implementation Plan

#### 1. Define Game Phases (New Constant)

```javascript
// lib/config/mp-constants.js
MP_CONSTANTS.GAME_PHASES = {
    NORMAL_PLAY: {
        prediction: true,
        reconciliationStrength: 0.3,
        inputTapering: false
    },
    INBOUND_WALK: {
        prediction: false,           // Coordinator owns movement
        reconciliationStrength: 1.0, // Snap immediately to authority
        inputTapering: false
    },
    REBOUND_SCRAMBLE: {
        prediction: true,
        reconciliationStrength: 0.15, // High tolerance for chaos
        inputTapering: false
    },
    POST_SNAP_RECOVERY: {
        prediction: true,
        reconciliationStrength: 0.5,
        inputTapering: true,          // Dampen first 5 inputs (Idea #5)
        taperingFrames: 5
    }
};

// Add missing drift threshold
MP_CONSTANTS.DRIFT_SNAP_THRESHOLD = 15;  // Units before forced snap
MP_CONSTANTS.VISUAL_GUARD_SMALL_DELTA = 2.25; // Already exists
```

#### 2. Coordinator Tracks Current Phase

```javascript
// lib/multiplayer/mp_coordinator.js - in serializeGameState()
this.serializeGameState = function () {
    var stateManager = this.systems.stateManager;
    
    // Determine current game phase
    var gamePhase = "NORMAL_PLAY";  // Default
    
    if (stateManager.get('inbounding')) {
        // Check if inbounder is being auto-walked
        var positioning = stateManager.get('inboundPositioning');
        if (positioning && positioning.inbounder && !positioning.ready) {
            gamePhase = "INBOUND_WALK";
        } else {
            gamePhase = "INBOUND_READY";  // Standing at spot, waiting for pass
        }
    } else if (stateManager.get('reboundActive')) {
        gamePhase = "REBOUND_SCRAMBLE";
    }
    
    // Check if we just recovered from a large snap
    if (this.lastDriftSnapTick && (currentTick - this.lastDriftSnapTick) < 5) {
        gamePhase = "POST_SNAP_RECOVERY";
    }
    
    var state = {
        // ... existing fields ...
        phase: gamePhase,
        phaseTick: stateManager.get('tickCounter')
    };
    
    return state;
};
```

#### 3. Client Applies Phase-Based Tuning

```javascript
// lib/multiplayer/mp_client.js - in updateGameState()
this.updateGameState = function (state) {
    // ... existing state sync ...
    
    // Apply phase-based prediction tuning
    if (state.phase && typeof state.phase === "string") {
        this.applyPhaseSettings(state.phase);
    }
};

this.applyPhaseSettings = function (phaseName) {
    var phaseConfig = MP_CONSTANTS.GAME_PHASES[phaseName];
    if (!phaseConfig) {
        phaseConfig = MP_CONSTANTS.GAME_PHASES.NORMAL_PLAY;
    }
    
    // Store previous settings for debugging
    var prevPrediction = this.disablePrediction;
    var prevStrength = this.currentReconciliationStrength || 0.3;
    
    // Apply new settings
    this.disablePrediction = !phaseConfig.prediction;
    this.currentReconciliationStrength = phaseConfig.reconciliationStrength;
    this.inputTaperingActive = phaseConfig.inputTapering;
    this.inputTaperingFramesRemaining = phaseConfig.taperingFrames || 0;
    
    // Log phase transitions
    if (prevPrediction !== this.disablePrediction || 
        Math.abs(prevStrength - this.currentReconciliationStrength) > 0.1) {
        debugLog("[MP PHASE] Switched to " + phaseName + 
                 " (prediction=" + !this.disablePrediction + 
                 ", strength=" + this.currentReconciliationStrength + ")");
    }
};
```

#### 4. Use Phase Settings in Reconciliation

```javascript
// lib/multiplayer/mp_client.js - in reconcileMyPosition()
this.reconcileMyPosition = function (serverState) {
    // ... existing setup ...
    
    // Use phase-tuned reconciliation strength instead of fixed values
    var strength = this.currentReconciliationStrength || 0.3;
    
    // Apply input tapering if in recovery mode
    if (this.inputTaperingActive && this.inputTaperingFramesRemaining > 0) {
        strength *= 0.5;  // Cut strength in half during tapering
        this.inputTaperingFramesRemaining--;
        
        if (this.inputTaperingFramesRemaining === 0) {
            this.inputTaperingActive = false;
            debugLog("[MP PHASE] Input tapering complete");
        }
    }
    
    // Rest of reconciliation logic uses `strength` variable...
};
```

### Benefits Over Animation Hints

1. **No Timing Dependencies**: Phase and position arrive in same packet
2. **Client Autonomy**: Clients still choose animations based on position deltas
3. **CPU AI Safe**: Coordinator doesn't need to process its own hints
4. **Gradual Rollout**: Can add phases incrementally without breaking existing code
5. **Addresses Actual Problem**: Snapbacks caused by wrong reconciliation strength, not wrong animations

### What This Solves

✅ **Idea #1 (Inbound Flicker)**: `INBOUND_WALK` phase disables prediction automatically  
✅ **Idea #5 (Input Tapering)**: `POST_SNAP_RECOVERY` phase applies tapering  
✅ **Idea #9 (Catchup Cue)**: Can show phase name in UI  
⚠️ **Idea #2 (Turbo Scaling)**: Still needs separate implementation  
⚠️ **Idea #3 (Bump Animations)**: Client can trigger based on phase + delta  

### What This Doesn't Solve (By Design)

- Cosmetic animations (bump effects, camera shake) → These should be client-side based on snap detection
- Turbo prediction → Needs separate predictive turbo system
- Perfect animation sync → Clients still infer from deltas, which is actually good (no central choreography)

## Migration Path

### Phase 1: Add Constants + Fix Missing DRIFT_SNAP_THRESHOLD (30 min)
- Add game phases to `mp-constants.js`
- Fix undefined `DRIFT_SNAP_THRESHOLD` bug
- No behavior change yet

### Phase 2: Coordinator Phase Detection (1 hour)
- Add phase determination logic to coordinator
- Include phase in state packets
- Clients ignore it for now (backwards compatible)

### Phase 3: Client Phase Tuning (2 hours)
- Implement `applyPhaseSettings()`
- Hook into `updateGameState()`
- Use phase-tuned strength in reconciliation
- Log phase transitions for validation

### Phase 4: Testing & Tuning (2-3 hours)
- Test each phase transition (normal → inbound → normal → snap recovery)
- Tune reconciliation strengths per phase
- Validate no regressions in CPU AI

**Total: ~6-7 hours** vs **10-15 hours** for animation hints (with lower risk)

## Future Extensions

Once phase-based tuning is stable, we can add:

- `CONTESTED_SHOT` phase (different ball physics)
- `FAST_BREAK` phase (looser collision, higher prediction)
- `TIMEOUT` phase (freeze all prediction)
- `CELEBRATION` phase (cosmetic, no gameplay impact)

Each phase becomes a tuning knob for multiplayer feel without breaking the prediction model.
