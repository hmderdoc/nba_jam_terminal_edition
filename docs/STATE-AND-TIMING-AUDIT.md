# NBA JAM - State and Timing Audit (Wave 23D)
**Created**: 2025-11-09  
**Purpose**: Root cause analysis of possession/violation state bugs  
**Status**: ACTIVE INVESTIGATION

---

## Executive Summary

**CRITICAL BUG FOUND**: `setupInbound()` parameter semantics are inverted for violation calls.

- `setupInbound(scoringTeam)` is designed for **made baskets** where the team that got **scored ON** inbounds
- Violations should call with the team that **should inbound** (the non-violating team)
- Current violation code calls `setupInbound(opposingTeam)` but function inverts it internally → violating team gets ball back!

---

## Architecture Overview (Wave 23D)

### Core Design Pattern
**Unified Game Loop** with **Dependency Injection**

```javascript
// Main entry point for all game modes
function runGameFrame(systems, config) {
    // systems: { stateManager, eventBus, possessionSystem, ... }
    // config: { isAuthority, handleInput, aiInterval, frameDelay }
}
```

### Key Architectural Changes from Pre-Wave23
1. **Blocking → Non-blocking**: Removed `mswait()` blocking during animations
2. **Global state → StateManager**: Centralized state with explicit get/set
3. **Direct calls → Event bus**: Decoupled systems via events
4. **Monolithic → Systems**: Separated concerns into testable modules

### State Management Layers

#### Layer 1: StateManager (Central Authority)
Location: `lib/core/state-manager.js`

```javascript
var stateManager = {
    get: function(key) { ... },
    set: function(key, value, reason) { ... }
}
```

**Key state variables**:
- `currentTeam`: "teamA" | "teamB" (who has possession)
- `ballCarrier`: sprite object (who has the ball)
- `inbounding`: boolean (in inbound state?)
- `frontcourtEstablished`: boolean (for backcourt violation)
- `backcourtTimer`: number (frames in backcourt)
- `shotClock`: number (24-second shot clock)
- `timeRemaining`: number (game time in seconds)

#### Layer 2: Systems (Business Logic)
Location: `lib/systems/*.js`

Systems receive state via dependency injection:
- **PossessionSystem**: Handles possession changes, inbounds
- **PassingSystem**: Handles pass animations and outcomes
- **ShootingSystem**: Handles shot attempts and scoring

#### Layer 3: Game Logic Modules
Location: `lib/game-logic/*.js`

Legacy modules being migrated to systems:
- `violations.js`: Backcourt, 5-second, shot clock
- `possession.js`: Wrapper around PossessionSystem
- `passing.js`: Wrapper around PassingSystem

---

## Timing Model

### Frame Rate
- **Target**: 20 FPS (50ms per frame)
- **Controlled by**: `lib/core/frame-scheduler.js`
- **Authority**: Only authority client runs timer logic

### Timer Types

#### 1. Real-time Timers (Date.now())
```javascript
var lastSecondTime = stateManager.get("lastSecondTime");
if (now - lastSecondTime >= 1000) {
    // Decrement game clock and shot clock
}
```

**Used for**:
- Game clock (timeRemaining)
- Shot clock (24 seconds)
- Animation timing

#### 2. Frame Counters
```javascript
var backcourtTimer = stateManager.get("backcourtTimer");
stateManager.set("backcourtTimer", backcourtTimer + 1);
if (backcourtTimer + 1 >= 210) { // 10.5 seconds at 20 FPS
    // Violation!
}
```

**Used for**:
- Backcourt 10-second timer (210 frames)
- Dead dribble 5-second timer (100 frames)
- Stuck detection (8 frames)
- Grace periods (10-30 frames)

#### 3. Animation Frames
```javascript
var animation = {
    currentStep: 0,
    totalSteps: 10,
    msPerStep: 50
};
```

**Used for**:
- Pass animations (~10 steps, 50ms each)
- Shot animations (~15 steps, 80ms each)
- Dunk animations (~20 steps, 100ms each)

### Timing Issues Identified

1. **Frame counters not reset on possession change**
   - `backcourtTimer` should reset to 0 when inbounding
   - `ballHandlerStuckTimer` should reset on new ballCarrier
   - Currently: relies on `resetBackcourtState()` being called correctly

2. **Grace periods insufficient**
   - Inbound grace period: 30 frames (1.5s)
   - Network latency can exceed this in multiplayer
   - Should be 50-60 frames (2.5-3s)

3. **Animation timing not frame-synchronized**
   - Animations use `Date.now()` but game logic uses frame counter
   - Can cause state desync if animations complete between frames

---

## State Flow Analysis

### Normal Possession Flow

```
INBOUND_SETUP
    ↓
[setupInbound(scoringTeam)]
    ↓ sets currentTeam, ballCarrier, inbounding=true
INBOUND_PASS
    ↓
[animatePass completes]
    ↓ sets inbounding=false, ballCarrier=receiver
NORMAL_PLAY
    ↓
[Movement, passing, shooting, defense]
    ↓
[Shot scored]
    ↓
INBOUND_SETUP (repeat)
```

### Violation Flow (BROKEN)

```
NORMAL_PLAY
    ↓
[Backcourt violation detected]
    ↓
[enforceBackcourtViolation(message, systems)]
    ↓
    var violatingTeam = currentTeam; // "teamA"
    var opposingTeam = "teamB";
    setupInbound(opposingTeam, systems); // ← BUG HERE
    ↓
[setupInbound receives "teamB"]
    ↓
    // Function expects: team that SCORED (to give ball to other team)
    // But receives: team that SHOULD GET BALL
    // So it inverts: inboundTeam = "teamA" (WRONG!)
    ↓
VIOLATING TEAM GETS BALL BACK (BUG!)
```

---

## Root Cause: Parameter Semantic Mismatch

### setupInbound() Design (for made baskets)

```javascript
/**
 * @param {string} scoringTeam - Team that scored (NOT the inbounding team)
 */
function setupInbound(scoringTeam, systems) {
    // Team that got scored ON inbounds the ball
    var inboundTeam = scoringTeam === "teamA" ? "teamB" : "teamA";
    
    possessionSystem.setupInbound(scoringTeam, "score", systems);
}
```

**Expected usage after made basket**:
```javascript
// Team A scores
setupInbound("teamA", systems);
// → inboundTeam = "teamB" (correct - team B inbounds)
```

### Violation Code (INCORRECT)

```javascript
function enforceBackcourtViolation(message, systems) {
    var violatingTeam = currentTeam; // "teamA"
    var opposingTeam = violatingTeam === "teamA" ? "teamB" : "teamA";
    
    // BUG: setupInbound expects "scoring team" but we pass "inbounding team"
    setupInbound(opposingTeam, systems);
    // → receives "teamB"
    // → calculates inboundTeam = "teamA" (INVERTED!)
}
```

### Old Code (Pre-Wave23) - Also Broken!

```javascript
function enforceBackcourtViolation(message) {
    var violatingTeam = gameState.currentTeam;
    
    // Check for OLD team names ("red", "blue")
    if (violatingTeam === "red" || violatingTeam === "blue") {
        setupInbound(violatingTeam);
    } else {
        // Falls through to switchPossession() because teams are now "teamA", "teamB"
        switchPossession();
    }
}
```

**This code NEVER worked after team names changed from red/blue to teamA/teamB!**

The violation "worked" because `switchPossession()` was called instead, which:
1. Switches `currentTeam` to other team
2. Gives ball to player 1 of new team
3. Doesn't set `inbounding=true`
4. Doesn't position players correctly
5. Doesn't reset backcourt state properly

---

## The "Burst" Pattern Explained

User reported: "violations over and over for 30 seconds then stops"

**Root cause**: Violation gives ball back to violating team → they're still in wrong court position → immediate violation → repeat

**Why it stops**: Eventually random movement or a pass gets team to correct court position, breaking the loop

---

## Tech Debt Identified

### Critical (Blocking Progress)

1. **Semantic coupling between scoring and violations**
   - `setupInbound()` assumes "scoring team" semantics
   - Violations need "inbounding team" semantics
   - Should split into two functions or add explicit parameter

2. **Incomplete migration from red/blue to teamA/teamB**
   - Old conditional checks for "red"/"blue" still exist
   - Code silently falls through to wrong behavior

3. **No validation of currentTeam vs ballCarrier consistency**
   - `currentTeam` can desync from `ballCarrier`'s actual team
   - No runtime checks to catch this

### High Priority

4. **Frame counter reset scattered across codebase**
   - `backcourtTimer`, `ballHandlerStuckTimer`, `ballHandlerAdvanceTimer` reset in multiple places
   - Should be centralized in state transition function

5. **Inbounding state not properly enforced**
   - `inbounding=true` should block violation checks
   - Currently: checks happen during inbound state

6. **Grace periods hardcoded**
   - Magic numbers (10, 30, 210 frames) scattered everywhere
   - Should be in `game-balance.js` constants

### Medium Priority

7. **Animation completion doesn't trigger frame advance**
   - Animations complete via `Date.now()` checks
   - Frame counter may not have incremented
   - State mutations happen "between frames"

8. **No possession transition validation**
   - Missing checks that possession change completes correctly
   - No verification that `currentTeam` matches `ballCarrier`'s team after transition

---

## Recommendations

### Immediate Fixes (Wave 23D Completion)

1. **Fix setupInbound parameter semantics**
   ```javascript
   // Option A: Rename parameter to be explicit
   function setupInbound(teamThatGotScoredOn, systems) {
       var inboundTeam = teamThatGotScoredOn;
       // ...
   }
   
   // Option B: Create separate function for violations
   function setupInboundAfterViolation(inboundingTeam, systems) {
       possessionSystem.setupInbound(inboundingTeam, "violation", systems);
   }
   
   // Option C: Add explicit parameter
   function setupInbound(team, systems, options) {
       var inboundTeam = options.teamScored ? 
           (team === "teamA" ? "teamB" : "teamA") : team;
   }
   ```

2. **Add state validation layer**
   ```javascript
   function validatePossessionState(systems) {
       var currentTeam = systems.stateManager.get("currentTeam");
       var ballCarrier = systems.stateManager.get("ballCarrier");
       var carrierTeam = getPlayerTeamName(ballCarrier);
       
       if (carrierTeam !== currentTeam) {
           log(LOG_ERROR, "STATE DESYNC: currentTeam=" + currentTeam + 
               " but ballCarrier is on " + carrierTeam);
           return false;
       }
       return true;
   }
   ```

3. **Centralize frame counter resets**
   ```javascript
   function resetPossessionTimers(systems) {
       systems.stateManager.set("backcourtTimer", 0, "possession_reset");
       systems.stateManager.set("ballHandlerStuckTimer", 0, "possession_reset");
       systems.stateManager.set("ballHandlerAdvanceTimer", 0, "possession_reset");
       systems.stateManager.set("inboundGracePeriod", 30, "possession_reset");
   }
   ```

### Medium-term Refactoring (Wave 24)

4. **Extract possession state machine**
   - Explicit states: INBOUND_SETUP, INBOUND_PASS, NORMAL_PLAY, DEAD_BALL, VIOLATION
   - Clear transitions with validation
   - Entry/exit actions for each state

5. **Consolidate timing into FrameScheduler**
   - All timers use frame counts, not Date.now()
   - Single source of truth for "what frame is it?"
   - Sync animations to frame boundaries

6. **Move constants to game-balance.js**
   ```javascript
   GAME_BALANCE.TIMERS = {
       BACKCOURT_FRAMES: 210,        // 10.5 seconds
       DEAD_DRIBBLE_FRAMES: 100,     // 5 seconds
       STUCK_DETECTION_FRAMES: 8,    // 0.4 seconds
       INBOUND_GRACE_FRAMES: 50,     // 2.5 seconds
       SHOT_GRACE_FRAMES: 10         // 0.5 seconds
   };
   ```

### Long-term Architecture (Wave 25+)

7. **Full event-driven state management**
   - All state changes emit events
   - Systems react to events, not direct calls
   - Easier to debug with event log

8. **Replay/time-travel debugging**
   - Record all state mutations with frame number
   - Ability to replay from any frame
   - Essential for multiplayer debugging

---

## Testing Checklist

Before declaring violations fixed:

- [ ] Team A commits backcourt violation → Team B gets ball
- [ ] Team B commits backcourt violation → Team A gets ball
- [ ] Inbounding team positioned correctly (backcourt)
- [ ] `currentTeam` matches `ballCarrier` team after violation
- [ ] `frontcourtEstablished` reset to false after violation
- [ ] `backcourtTimer` reset to 0 after violation
- [ ] No "burst" pattern (repeated violations)
- [ ] Grace period works (no violation during inbound)
- [ ] Violation announcement shows correct team
- [ ] Stats show turnover for violating team
- [ ] Multiplayer: both clients see same violation

---

## Questions for Next Session

1. Should we split `setupInbound()` into two functions?
   - `setupInboundAfterScore(scoringTeam)`
   - `setupInboundAfterViolation(inboundingTeam)`

2. Do we need a `PossessionStateMachine` class?
   - Explicit states with validation
   - Prevents invalid transitions

3. Should animations block frame advance?
   - Current: animations and game logic run in parallel
   - Alternative: pause frame counter during critical animations

4. How to handle multiplayer state sync during violations?
   - Authority decides violation
   - How to prevent de-sync during inbound setup?

---

## Call Stack Trace: Backcourt Violation

```
[Frame N]
runGameFrame(systems, config)
  ↓ (if config.isAuthority)
  checkViolations(violationTriggeredThisFrame, systems)
    ↓ (if frontcourtEstablished && inBackcourt)
    enforceBackcourtViolation("OVER AND BACK!", systems)
      ↓
      var violatingTeam = currentTeam; // "teamA"
      recordTurnover(ballCarrier, "backcourt");
      announceEvent("violation_backcourt");
      resetBackcourtState(systems);
      resetDeadDribbleTimer(systems);
      clearPotentialAssist(systems);
      ↓
      var opposingTeam = "teamB"; // ← Should get ball
      setupInbound(opposingTeam, systems); // ← BUG: param inverted
        ↓
        // possession.js wrapper
        var inboundTeam = scoringTeam === "teamA" ? "teamB" : "teamA";
        // scoringTeam = "teamB", so inboundTeam = "teamA" ← WRONG!
        ↓
        possessionSystem.setupInbound(scoringTeam, "score", systems);
          ↓
          // possession-system.js
          var inboundTeam = scoringTeam === "teamA" ? "teamB" : "teamA";
          // DOUBLE INVERSION! Back to "teamB" but that's WRONG in wrapper context
          ↓
          stateManager.set("currentTeam", inboundTeam);
          stateManager.set("ballCarrier", inbounder);
          stateManager.set("inbounding", true);
          // VIOLATING TEAM ("teamA") NOW HAS BALL!

[Frame N+1]
runGameFrame(systems, config)
  ↓
  checkViolations(...)
    ↓
    // Ball carrier still in wrong court position
    // IMMEDIATE VIOLATION AGAIN!
    ↓
    "BURST" PATTERN CONTINUES
```

---

## Comparison: Old vs New Flow

### Pre-Wave23 (Blocking Model)

```javascript
function mainGameLoop() {
    while (true) {
        handleInput();
        updatePhysics();
        checkViolations(); // ← Blocks here if violation
        if (violation) {
            announceEvent(...);
            mswait(800); // ← BLOCKS entire game
            setupInbound(...);
            mswait(500);
        }
        updateAI();
        render();
        mswait(50); // Frame delay
    }
}
```

**Characteristics**:
- Simple control flow (sequential)
- Violations block everything
- No desync possible (single-threaded)
- But: Poor UX (game freezes during announcements)

### Wave 23D (Non-blocking Model)

```javascript
function runGameFrame(systems, config) {
    // Returns immediately, no blocking
    var result = checkViolations(...);
    if (result === "violation") {
        // State already changed (setupInbound called)
        // But DON'T block - just return early
        return "violation";
    }
    // Continue with frame...
}

// Caller handles return value
var frameResult = runGameFrame(systems, config);
if (frameResult === "violation") {
    // Can show UI, play animation, etc. without blocking
    frameScheduler.waitForNextFrame(800);
}
```

**Characteristics**:
- Non-blocking (better UX)
- More complex control flow
- State changes during return → potential desync
- Requires careful state validation

---

## Patterns to Reinforce

### 1. Systems Receive Full Context
```javascript
// ✅ GOOD
function someGameLogic(systems) {
    var stateManager = systems.stateManager;
    var eventBus = systems.eventBus;
    var possessionSystem = systems.possessionSystem;
    // ... use systems
}

// ❌ BAD (old code)
function someGameLogic() {
    gameState.currentTeam = "teamA"; // Global mutation
}
```

### 2. State Changes via StateManager
```javascript
// ✅ GOOD
systems.stateManager.set("currentTeam", "teamA", "violation_inbound");

// ❌ BAD
gameState.currentTeam = "teamA"; // Direct mutation
```

### 3. Communication via Events
```javascript
// ✅ GOOD
systems.eventBus.emit("possession_change", { 
    previousTeam: "teamA", 
    newTeam: "teamB" 
});

// ❌ BAD
updateScoreboard(); // Direct coupling
announceEvent(); // Direct coupling
```

### 4. Validation at State Boundaries
```javascript
// ✅ GOOD
function setupInbound(team, systems) {
    if (team !== "teamA" && team !== "teamB") {
        throw new Error("Invalid team: " + team);
    }
    // ... proceed
}

// ❌ BAD
function setupInbound(team, systems) {
    var inboundTeam = team === "teamA" ? "teamB" : "teamA";
    // Silent failure if team is invalid!
}
```

---

## Next Steps

1. ✅ Document architecture and root cause (this file)
2. ⬜ Update `.github/copilot-instructions.md` with Wave 23D patterns
3. ⬜ Fix `setupInbound()` parameter semantics (choose Option A, B, or C)
4. ⬜ Add state validation layer
5. ⬜ Test violation flow thoroughly
6. ⬜ Add logging for state transitions
7. ⬜ Create regression tests for violations
8. ⬜ Address pass receiver null bug (separate issue)

---

**End of Audit**
