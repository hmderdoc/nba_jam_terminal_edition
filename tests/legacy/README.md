# Wave 22A Bug Fix Test Suite

This directory contains unit tests that demonstrate and validate fixes for critical bugs in Wave 22A.

## Test Infrastructure

### test-helpers.js
Provides mocking utilities for unit testing game logic in isolation:
- `createMockGameState()` - Creates minimal game state for testing
- `createMockPlayer()` - Creates test player with stats
- `installMockFunctions()` - Installs no-op mocks for dependencies
- Assertion helpers: `assertEqual()`, `assertTrue()`, `assertFalse()`

### Running Tests

Individual tests:
```bash
cd /sbbs/repo/xtrn/nba_jam/lib/testing
/sbbs/exec/jsexec test_rebound_flow.js
```

## Bug Reproductions

### test_rebound_flow.js
**Purpose**: Validates the complete rebound state machine works correctly.

**Tests**:
1. `createRebound()` activates scramble state
2. `updateReboundScramble()` tracks player distance
3. `secureRebound()` awards possession when player reaches ball
4. Stats increment correctly

**Test Output**:
```
TEST 1: createRebound() should activate scramble state
  ✅ PASSED

TEST 2: updateReboundScramble() with player far away
  ✅ PASSED

TEST 3: updateReboundScramble() with player at ball
  ✅ PASSED
```

## Commits

This test-driven fix is split into two commits:

1. **Test Infrastructure** (commit 461ee44)
   - Adds all test files demonstrating bugs
   - Tests pass and prove bugs exist

2. **Bug Fixes** (commit 29af875)
   - Applies fixes to shooting.js and dunks.js
   - Tests validate fixes work correctly

## Design Principles

1. **Isolation**: Tests use mocks to isolate game logic from rendering/console
2. **Clarity**: Each test clearly states the bug, cause, and fix
3. **Reproducibility**: Tests demonstrate bugs before fixes are applied
4. **Validation**: Same tests validate fixes after they're applied
5. **Reusability**: Test helpers can be used for future unit tests

## Future Improvements

These test patterns can be extended to:
- Test shot timing and accuracy calculations
- Test defensive positioning and blocking
- Test AI decision-making in isolation
- Test multiplayer state synchronization
- Validate game balance changes
