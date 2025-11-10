# Wave 23: Architecture Foundation - Migration Guide

## What We're Building

Two new core systems that make the codebase testable:

1. **State Manager** (`lib/core/state-manager.js`) - Centralized state with change tracking
2. **Event Bus** (`lib/core/event-bus.js`) - Decoupled event system

## Why This Matters

### Before (Current)
```javascript
// Hidden dependencies, global mutations, untestable
function animatePass(passer, receiver) {
    // ... logic ...
    gameState.ballCarrier = receiver;  // Direct global mutation
    gameState.currentTeam = receiverTeam;
    announceEvent("pass_complete", data);  // Tight coupling
}
```

**Problems**:
- Can't see what changed or why
- Can't test without running full game
- Can't track state mutations
- Tight coupling between systems

### After (With New Systems)
```javascript
// Explicit dependencies, traceable changes, testable
function animatePass(passer, receiver, deps) {
    // deps = { state, events }
    // ... logic ...
    deps.state.set('ballCarrier', receiver, 'pass_complete');
    deps.state.set('currentTeam', receiverTeam, 'pass_complete');
    deps.events.emit('pass_complete', { passer, receiver, team: receiverTeam });
}
```

**Benefits**:
- Every state change logged with reason
- Can test by mocking state/events
- Can trace all mutations
- Decoupled systems

## How to Use (Incremental Migration)

### Step 1: Load the new systems

In `nba_jam.js`, add after other core loads:
```javascript
load(js.exec_dir + "lib/core/state-manager.js");
load(js.exec_dir + "lib/core/event-bus.js");
```

### Step 2: Create instances at game start

```javascript
// Create wrapped state manager (wraps existing gameState)
var stateManager = createStateManager(gameState);

// Create event bus
var eventBus = createEventBus();

// Hook up announcer to events (example of decoupling)
eventBus.on('pass_complete', function(data) {
    announceEvent('pass', data);
});

eventBus.on('shot_made', function(data) {
    announceEvent('shot_made', data);
});

eventBus.on('steal', function(data) {
    announceEvent('steal', data);
});
```

### Step 3: Migrate one function at a time

**Original code** (in `passing.js`):
```javascript
function animatePass(passer, receiver, leadTarget, inboundContext) {
    // ... lots of logic ...
    
    // Direct state mutations:
    gameState.ballCarrier = receiver;
    gameState.currentTeam = receiverTeam;
    gameState.shotClock = 24;
    
    // Direct announcer call:
    announceEvent("pass_complete", { passer, receiver });
}
```

**Migrated code**:
```javascript
// Add optional deps parameter (backwards compatible)
function animatePass(passer, receiver, leadTarget, inboundContext, deps) {
    // Default to legacy behavior if deps not provided
    if (!deps) {
        deps = {
            state: {
                set: function(path, val) { 
                    // Legacy: directly mutate gameState
                    var keys = path.split('.');
                    var target = gameState;
                    for (var i = 0; i < keys.length - 1; i++) {
                        target = target[keys[i]];
                    }
                    target[keys[keys.length - 1]] = val;
                }
            },
            events: {
                emit: function(type, data) {
                    // Legacy: direct announcer call
                    announceEvent(type, data);
                }
            }
        };
    }
    
    // ... lots of logic ...
    
    // New: Use injected dependencies
    deps.state.set('ballCarrier', receiver, 'pass_complete');
    deps.state.set('currentTeam', receiverTeam, 'pass_complete');
    deps.state.set('shotClock', 24, 'pass_complete');
    
    // New: Emit event instead of direct call
    deps.events.emit('pass_complete', { passer, receiver, team: receiverTeam });
}
```

**Call site** (where you call animatePass):
```javascript
// Old way (still works):
animatePass(passer, receiver, null, inboundContext);

// New way (with dependencies):
animatePass(passer, receiver, null, inboundContext, {
    state: stateManager,
    events: eventBus
});
```

### Step 4: Write tests

Now you can test the function in isolation!

```javascript
// Create mock dependencies
var mockState = {
    values: {},
    set: function(path, value, reason) {
        this.values[path] = value;
        this.reasons[path] = reason;
    },
    reasons: {}
};

var mockEvents = {
    emitted: [],
    emit: function(type, data) {
        this.emitted.push({ type, data });
    }
};

// Test the function
animatePass(testPasser, testReceiver, null, null, {
    state: mockState,
    events: mockEvents
});

// Verify results
assert(mockState.values['ballCarrier'] === testReceiver);
assert(mockState.reasons['ballCarrier'] === 'pass_complete');
assert(mockEvents.emitted.length === 1);
assert(mockEvents.emitted[0].type === 'pass_complete');
```

## Debugging with New Systems

### View all state changes
```javascript
var changes = stateManager.getChangeLog();
for (var i = 0; i < changes.length; i++) {
    console.log(changes[i].timestamp + ": " + 
                changes[i].path + " = " + 
                JSON.stringify(changes[i].newValue) + 
                " (" + changes[i].reason + ")");
}
```

Example output:
```
1699380001234: ballCarrier = {"x":20,"y":10} (pass_complete)
1699380001250: currentTeam = teamB (pass_complete)
1699380001251: shotClock = 24 (pass_complete)
1699380002100: ballCarrier = {"x":30,"y":15} (shot_released)
```

### View all events
```javascript
var events = eventBus.getEventLog();
for (var i = 0; i < events.length; i++) {
    console.log(events[i].timestamp + ": " + 
                events[i].type + " - " + 
                JSON.stringify(events[i].data));
}
```

### Subscribe to changes in real-time
```javascript
// Debug: Log all state changes
stateManager.subscribe('*', function(path, oldVal, newVal) {
    console.log("STATE CHANGE: " + path);
    console.log("  Old:", oldVal);
    console.log("  New:", newVal);
});

// Debug: Log all events
eventBus.on('*', function(data, type) {
    console.log("EVENT:", type, data);
});
```

## Migration Priority

Migrate these systems first (highest value):

1. **Passing system** - Most problematic currently
2. **Possession system** - Sets currentTeam, ballCarrier
3. **Shooting system** - State changes after shot
4. **Announcer** - Should subscribe to events, not be called directly

## Backwards Compatibility

The migration is **fully backwards compatible**:
- Old code continues to work
- New code can call old code
- Old code can call new code (via optional deps param)
- Can migrate incrementally (one function at a time)

## Next Steps

1. **Test the foundation**: Run `jsexec test-architecture-foundation.js`
2. **Add to game**: Load state-manager.js and event-bus.js in nba_jam.js
3. **Create instances**: Wrap gameState with stateManager, create eventBus
4. **Migrate passing**: Add deps param to animatePass, use state.set() and events.emit()
5. **Verify**: Run game, check logs show state changes and events
6. **Iterate**: Migrate next system

## Questions?

- "Will this slow down the game?" - Minimal overhead, only when debugging enabled
- "Do I have to migrate everything?" - No, migrate incrementally
- "Can I use both old and new?" - Yes, fully compatible during migration
- "What if I don't pass deps?" - Falls back to legacy direct mutations

The goal: **Make the implicit explicit. Make the untestable testable.**
