# Wave 23: Architecture Refactor Roadmap

## Current Status (2025-11-08)

### ✅ Completed
1. **State Manager** (lib/core/state-manager.js)
   - Wraps gameState by reference
   - Path-based get/set with change tracking
   - Subscription system for state observers
   - Snapshot/restore for testing
   - **Status**: Working, tested (test-state-ref.js)

2. **Event Bus** (lib/core/event-bus.js)
   - Pub/sub pattern for decoupled communication
   - Event logging and wildcards
   - **Status**: Working

3. **Passing System** (lib/systems/passing-system.js)
   - Testable passing logic with explicit dependencies
   - Test suite: 5/5 passing (testPassingSystemCreation, testSuccessfulPass, testOutOfBoundsPass, testPassTiming, testInboundPass)
   - **Status**: Logic working, integration has side effects from legacy code

4. **Possession System** (lib/systems/possession-system.js)
   - Centralized possession management with explicit dependencies
   - Test suite: 15/15 passing
   - **Status**: Working, integrated

5. **Shooting System** (lib/systems/shooting-system.js)
   - Testable shooting logic with explicit dependencies
   - Handles shot attempts, dunks, 3-pointers, blocking
   - Test suite: 32/32 passing (test-shooting-system.js)
   - Tests cover: shot probability, 3-pointer detection, dunk detection, OOB prevention, hot streak bonus, blocked shots
   - **Status**: Working, integrated via system-init.js

6. **Integration** (nba_jam.js, lib/core/system-init.js)
   - Systems created in main() via initializeSystems()
   - Dependencies injected
   - Exposed via globalThis for legacy code
   - **Status**: Wired up

### 🔄 Known Issues
- Passing system sets ballCarrier correctly, but legacy `switchPossession()` resets it
- Multiple functions directly mutate `gameState.*` outside systems
- Animation callbacks work, but legacy code doesn't expect them
- Test architecture proves systems work; production has side effects

### 📋 Remaining Work

#### Phase 3: Remove Legacy State Mutations (Next)
**Goal**: Eliminate all direct gameState modifications

**Search Pattern**: `gameState\\.\\w+\\s*=` (regex)

**Files to Audit**:
- nba_jam.js (main game loop)
- lib/game-logic/*.js
- lib/ai/*.js
- lib/multiplayer/*.js

**Strategy**:
- Replace with system calls where systems exist
- Use state.set() for remaining cases
- Document any that can't be migrated yet

**Estimated Locations**: 50-100 assignments

**Search Pattern**: `gameState\\.\\w+\\s*=` (regex)

**Files to Audit**:
- nba_jam.js (main game loop)
- lib/game-logic/*.js
- lib/ai/*.js
- lib/multiplayer/*.js

**Strategy**:
- Replace with system calls where systems exist
- Use state.set() for remaining cases
- Document any that can't be migrated yet

**Estimated Locations**: 50-100 assignments

#### Phase 4: Integration & Cleanup
**Goal**: Unified architecture, no legacy hacks

**Tasks**:
1. Remove old callback workarounds
2. Delete commented-out code
3. Verify gameplay: passing, shooting, possession, rebounds
4. Performance check (animation frame rates)
5. Update documentation

---

## Architecture Principles

### State Management
- **Single source of truth**: gameState via stateManager
- **No direct mutations**: All changes via state.set() or system methods
- **Observability**: State changes emit events for logging/debugging

### System Design
- **Explicit dependencies**: Injected at creation, no globals
- **Pure logic**: Business rules separated from I/O
- **Testability**: Mock dependencies, deterministic tests
- **Single responsibility**: Each system owns one domain

### Integration Pattern
```javascript
// In main():
var stateManager = createStateManager(gameState);
var eventBus = createEventBus();

var passingSystem = createPassingSystem({
  state: stateManager,
  animations: animationSystem,
  events: eventBus,
  rules: { /* constants */ },
  helpers: { /* pure functions */ }
});

// Expose for legacy code (temporary)
globalThis.passingSystem = passingSystem;
```

### Testing Strategy
- **Unit tests**: Each system tested in isolation
- **Mock dependencies**: Animation/events/state mocked
- **Deterministic**: No random values in tests
- **Fast**: Run with jsexec, <0.1s per test

---

## Migration Notes

### Why Systems, Not Just Refactoring?
The codebase has pervasive state mutation issues:
- Functions modify gameState directly
- Side effects in unexpected places
- Hard to test, hard to debug
- Circular dependencies

Systems provide:
- Clear boundaries
- Testable units
- State change tracking
- Reduced coupling

### Current Architecture Issues
1. **Direct state mutation everywhere**: ~100+ `gameState.x =` assignments
2. **Side effects in rendering**: drawCourt() sometimes changes game state
3. **Timing issues**: Callbacks fire but legacy code expects immediate state
4. **No single point of control**: State can change from anywhere

### Post-Refactor Architecture
1. **Systems own state changes**: Passing, possession, shooting, etc.
2. **State manager tracks all changes**: Observable, loggable
3. **Event bus for coordination**: Decoupled communication
4. **Legacy code gradually migrates**: Can coexist during transition

---

## Estimated Timeline
- **Possession System**: 2-3 hours (extraction + tests)
- **Shooting System**: 3-4 hours (complex logic)
- **Legacy Cleanup**: 4-6 hours (manual audit)
- **Integration Testing**: 2-3 hours
- **Total**: 11-16 hours

## Risks & Mitigations
**Risk**: Breaking gameplay during migration
**Mitigation**: Keep systems optional, feature-flag new code, gradual rollout

**Risk**: Performance regression from indirection
**Mitigation**: Profile with realistic game load, optimize hot paths

**Risk**: Incomplete migration leaves two systems
**Mitigation**: Track completion in REFACTOR_ROADMAP.md, mark legacy code clearly

---

## Success Criteria
- [ ] All systems have test coverage
- [ ] No direct `gameState.x =` outside main() initialization
- [ ] State changes emit events
- [ ] Gameplay works identically to main branch
- [ ] Code is more maintainable (fewer surprises)
