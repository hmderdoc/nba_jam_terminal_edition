# NBA JAM Architecture Refactor Strategy

## Current State: The Problem

### Symptoms
- Impossible to debug without running the full game
- Can't write unit tests (everything depends on globals)
- State mutations happen invisibly across 20+ files
- Functions have hidden dependencies (read/write globals without declaring)
- No way to reason about data flow
- "Fixes" require speculation and manual testing

### Root Causes
1. **Global State Everywhere**: ~50+ global variables (gameState, animationSystem, all sprites, frames, etc)
2. **No Dependency Injection**: Functions don't declare what they need
3. **Implicit Side Effects**: Functions mutate globals without returning values
4. **No Contracts**: No types, no interfaces, no clear APIs
5. **Tangled Responsibilities**: Game logic mixed with rendering, animation, AI, input

### Example of Current Architecture
```javascript
// What parameters does this need? Unknown.
// What does it read? Unknown until you read the code.
// What does it modify? Unknown until you trace every line.
// How do you test it? You can't.
function animatePass(passer, receiver, leadTarget, inboundContext) {
    // Reads: gameState (multiple properties), animationSystem, various helpers
    // Writes: gameState (via callback), calls 5+ other functions
    // Hidden deps: getPlayerTeamName, recordTurnover, clearPotentialAssist, etc.
    // Side effects: Announcements, timers, statistics, possession changes
}
```

## Target State: The Solution

### Design Principles
1. **Explicit Dependencies**: All inputs as parameters, all outputs as return values
2. **Pure Functions Where Possible**: Input → Output, no side effects
3. **Dependency Injection**: Pass in what you need (state, systems, config)
4. **Single Responsibility**: Each module does ONE thing
5. **Testable by Design**: Can instantiate and test any component in isolation

### Example of Target Architecture
```javascript
// Factory function - returns an object with methods
function createPassingSystem(deps) {
    // deps = { state, animations, rules, events }
    
    return {
        // Clear contract: takes objects, returns result
        executePass: function(passer, receiver, options) {
            // All reads from deps (explicit)
            // All writes returned as state changes
            // Side effects handled by event system
            
            var result = {
                success: true,
                stateChanges: {
                    ballCarrier: receiver,
                    currentTeam: deps.state.currentTeam
                },
                events: [{ type: 'pass_complete', passer, receiver }]
            };
            
            if (this._checkInterception(passer, receiver)) {
                result.success = false;
                result.interceptor = /* ... */;
            }
            
            return result;
        },
        
        _checkInterception: function(passer, receiver) {
            // Private helper - testable in isolation
        }
    };
}

// Now testable:
var mockState = { currentTeam: 'teamA', ballCarrier: null };
var mockAnimations = { queue: jest.fn() };
var passing = createPassingSystem({ 
    state: mockState, 
    animations: mockAnimations,
    rules: gameRules,
    events: eventBus
});

var result = passing.executePass(player1, player2, {});
expect(result.success).toBe(true);
expect(result.stateChanges.ballCarrier).toBe(player2);
```

## Refactor Strategy: Incremental Approach

### Phase 1: Create New Architecture Foundation (Wave 23)
**Goal**: Build new systems alongside old ones, no breaking changes yet

#### 1.1: State Management System
Create `lib/core/state-manager.js`:
```javascript
function createStateManager(initialState) {
    var state = JSON.parse(JSON.stringify(initialState)); // deep clone
    var listeners = [];
    
    return {
        get: function(path) {
            // state.get('ballCarrier.x')
        },
        
        set: function(path, value) {
            // state.set('ballCarrier', player)
            // Notify listeners
        },
        
        mutate: function(mutator) {
            // mutator(state) - batch changes
        },
        
        subscribe: function(path, callback) {
            // Listen for changes
        },
        
        getSnapshot: function() {
            return JSON.parse(JSON.stringify(state));
        }
    };
}
```

**Benefits**:
- See all state changes in one place
- Can log state mutations
- Can snapshot/restore state for testing
- Can time-travel debug

#### 1.2: Event System
Create `lib/core/event-bus.js`:
```javascript
function createEventBus() {
    var handlers = {};
    
    return {
        emit: function(eventType, data) {
            // Triggers all registered handlers
            // Can be logged/traced
        },
        
        on: function(eventType, handler) {
            // Register handler
        },
        
        off: function(eventType, handler) {
            // Unregister
        }
    };
}
```

**Benefits**:
- Decouple systems (passing doesn't need to know about announcer)
- Can trace all events
- Can mock events for testing
- Can replay event sequences

#### 1.3: Dependency Container
Create `lib/core/container.js`:
```javascript
function createGameContainer(config) {
    var services = {};
    
    // Register all services
    services.state = createStateManager(config.initialState);
    services.events = createEventBus();
    services.animations = createAnimationSystem(services.events);
    services.rules = createGameRules(config.balance);
    
    // Each system gets what it needs
    services.passing = createPassingSystem({
        state: services.state,
        animations: services.animations,
        events: services.events,
        rules: services.rules
    });
    
    services.shooting = createShootingSystem({
        state: services.state,
        animations: services.animations,
        events: services.events,
        rules: services.rules
    });
    
    return services;
}
```

**Benefits**:
- Single place to see all dependencies
- Easy to swap implementations (mock for tests)
- Clear initialization order
- Can create multiple isolated game instances

### Phase 2: Migrate Systems One-by-One (Wave 24+)

#### 2.1: Passing System (First Target)
Why: Self-contained, clear inputs/outputs, good test case

**Current**: `lib/game-logic/passing.js` (671 lines, global hell)

**New**: `lib/systems/passing-system.js`
```javascript
function createPassingSystem(deps) {
    // deps: { state, animations, events, rules, physics }
    
    return {
        // PUBLIC API
        attemptPass: function(passer, receiver, options) {
            var validation = this._validatePass(passer, receiver);
            if (!validation.valid) {
                return { success: false, reason: validation.reason };
            }
            
            var outcome = this._determinePassOutcome(passer, receiver, options);
            var animation = this._createPassAnimation(passer, receiver, outcome);
            
            deps.animations.queuePass(animation, function(result) {
                // Apply state changes after animation
                deps.state.mutate(function(s) {
                    s.ballCarrier = outcome.receiver;
                    s.currentTeam = outcome.team;
                });
                
                deps.events.emit('pass_complete', outcome);
            });
            
            return { success: true, outcome: outcome };
        },
        
        // PRIVATE HELPERS (testable)
        _validatePass: function(passer, receiver) {
            if (!passer || !receiver) {
                return { valid: false, reason: 'invalid_players' };
            }
            // All validation logic here
            return { valid: true };
        },
        
        _determinePassOutcome: function(passer, receiver, options) {
            var interceptor = this._checkInterception(passer, receiver);
            var target = deps.physics.calculateLeadTarget(receiver, options);
            
            return {
                receiver: interceptor || receiver,
                team: interceptor ? this._getOpposingTeam(passer) : this._getPlayerTeam(passer),
                intercepted: !!interceptor,
                target: target
            };
        },
        
        _checkInterception: function(passer, receiver) {
            // Pure interception logic
            var defenders = deps.state.get('defenders');
            var passLine = deps.physics.calculatePassLine(passer, receiver);
            
            for (var i = 0; i < defenders.length; i++) {
                if (deps.rules.canIntercept(defenders[i], passLine)) {
                    return defenders[i];
                }
            }
            return null;
        }
    };
}
```

**Migration Strategy**:
1. Create new passing-system.js with full tests
2. Add adapter in old passing.js that calls new system
3. Verify behavior identical (run game)
4. Remove old code once proven

**Tests** (`lib/systems/__tests__/passing-system.test.js`):
```javascript
describe('PassingSystem', function() {
    var system, mockState, mockAnimations, mockEvents;
    
    beforeEach(function() {
        mockState = createMockStateManager();
        mockAnimations = createMockAnimationSystem();
        mockEvents = createMockEventBus();
        
        system = createPassingSystem({
            state: mockState,
            animations: mockAnimations,
            events: mockEvents,
            rules: defaultRules,
            physics: createPhysics()
        });
    });
    
    it('should complete successful pass', function() {
        var passer = { x: 10, y: 10, team: 'teamA' };
        var receiver = { x: 20, y: 10, team: 'teamA' };
        
        var result = system.attemptPass(passer, receiver, {});
        
        expect(result.success).toBe(true);
        expect(mockAnimations.queuePass).toHaveBeenCalled();
    });
    
    it('should detect interception when defender in path', function() {
        var passer = { x: 10, y: 10, team: 'teamA' };
        var receiver = { x: 30, y: 10, team: 'teamA' };
        var defender = { x: 20, y: 10, team: 'teamB', stealing: 80 };
        
        mockState.set('defenders', [defender]);
        
        var result = system.attemptPass(passer, receiver, {});
        
        expect(result.outcome.intercepted).toBe(true);
        expect(result.outcome.receiver).toBe(defender);
    });
    
    it('should reject pass with invalid players', function() {
        var result = system.attemptPass(null, null, {});
        
        expect(result.success).toBe(false);
        expect(result.reason).toBe('invalid_players');
    });
});
```

#### 2.2: Priority Order for System Migration
1. **Passing** (most problematic currently)
2. **Shooting** (similar to passing, well-defined)
3. **Possession** (depends on passing/shooting)
4. **Physics/Movement** (pure calculations, easy to test)
5. **AI** (depends on state queries)
6. **Rendering** (depends on state, mostly side effects)

### Phase 3: Eliminate Global State (Wave 25+)

Once all systems migrated to new architecture:

1. Create single game instance in `nba_jam.js`:
```javascript
var game = createGameContainer({
    initialState: getInitialGameState(),
    balance: GAME_BALANCE,
    config: getGameConfig()
});

// Game loop becomes:
function gameLoop() {
    game.input.handleInput(key);
    game.update.tick(deltaTime);
    game.render.draw();
}
```

2. Remove all global variables
3. Pass game instance to any remaining legacy code
4. Complete migration

## Testing Strategy

### Unit Tests (New Systems)
- Test every public method
- Test edge cases (null, undefined, invalid input)
- Test business logic in isolation
- Mock all dependencies

### Integration Tests
- Test system interactions
- Verify event flows
- Test state transitions
- Use real implementations (not mocks)

### Regression Tests
- Capture current behavior as baseline
- Run against both old and new implementations
- Ensure identical results

### Tools Needed
```bash
# Install testing framework
npm init -y
npm install --save-dev jest @types/jest

# Create test runner script
./test.sh
```

## Success Metrics

### Before (Current State)
- ❌ 0 unit tests
- ❌ Cannot test any function in isolation
- ❌ Debugging requires running full game
- ❌ State changes invisible
- ❌ Dependencies unknown
- ❌ Change requires speculation

### After (Target State)
- ✅ 90%+ test coverage on business logic
- ✅ Every system testable in isolation
- ✅ Can debug with unit tests
- ✅ All state changes logged/traceable
- ✅ Dependencies explicit and documented
- ✅ Changes verified by tests before running game

## Timeline Estimate

- **Phase 1** (Foundation): 1-2 weeks
  - State manager: 2 days
  - Event bus: 1 day
  - Container: 2 days
  - Testing setup: 2 days
  
- **Phase 2** (Migration): 4-6 weeks
  - Per system: 3-5 days each
  - 8-10 systems total
  - Includes tests and verification
  
- **Phase 3** (Cleanup): 1 week
  - Remove globals
  - Final integration
  - Documentation

**Total**: 6-9 weeks for complete refactor

## Next Steps

1. **Review this strategy** - Get buy-in on approach
2. **Create Phase 1 branch** (`wave-23-architecture-foundation`)
3. **Implement state manager** with tests
4. **Implement event bus** with tests
5. **Create container** and wire up first system
6. **Migrate passing system** as proof of concept
7. **Iterate** on remaining systems

## Questions to Answer

1. Is incremental migration acceptable? (vs big rewrite)
2. Can we allocate time for this? (not a quick fix)
3. Do we need to support legacy code during migration?
4. What's the testing environment? (Node.js? Browser? Synchronet?)
5. Performance requirements? (state manager overhead)

---

**The key insight**: We're not just fixing bugs. We're fixing the architecture so bugs become impossible and changes become trivial.
