# Wave 23B: Repository Cleanup & Housekeeping

**Goal**: Clean up technical debt accumulated during Wave 22-23 refactors. Organize files properly, remove dead code, update documentation, and prepare for Wave 23C timing refactor.

## Current Issues

### 1. Root Directory Clutter (18 files)
The root has become a dumping ground for temporary docs and test files:
```
DEBUGGING.md                    → docs/debugging/
issues.md                       → docs/debugging/
REFACTOR_ROADMAP.md            → docs/waves/
REFACTOR-STRATEGY.md           → docs/waves/
test-architecture-foundation.js → tests/wave-23/
test-foundation-node.js        → tests/wave-23/
test_rebound.js                → tests/legacy/ (or DELETE if obsolete)
test-shooting-system.js        → tests/wave-23/
test-state-ref.js              → tests/wave-23/
view-errors.sh                 → scripts/
visual_notes.md                → docs/debugging/
WAVE_22A_SUMMARY.md            → docs/waves/
WAVE-22B-ISSUES.md             → docs/waves/
WAVE_22B_STATE_MACHINE_DESIGN.md → docs/waves/
WAVE-22B-STATUS.md             → docs/waves/
WAVE_22B_SUMMARY.md            → docs/waves/
WAVE-23-MIGRATION-GUIDE.md     → docs/waves/
```

### 2. Test File Sprawl (25 files across 4 locations)
Tests scattered everywhere:
- **Root level**: 5 test files (should be in tests/)
- **lib/testing/**: 14 test files (mix of integration, POC, and obsolete)
- **lib/systems/__tests__/**: 2 proper unit tests (KEEP)
- **data/error-snapshots/**: 5 auto-generated reproduction tests (KEEP for debugging)

**Action**: Consolidate to organized structure:
```
tests/
  unit/              # Unit tests for systems
    passing-system.test.js
    possession-system.test.js
    shooting-system.test.js
  integration/       # Full game flow tests
    test-game-flow-integration.js
    test-wave-22b-state-machine.js
  legacy/            # Old POC tests (candidate for deletion)
    test_rebound_flow.js
    test_shot_path.js
  wave-23/           # Current wave tests
    test-architecture-foundation.js
    test-foundation-node.js
    test-state-ref.js
  helpers/           # Test utilities
    test-helpers.js
```

### 3. Blocking Calls (31 instances)
**mswait() locations** (for Wave 23C event-timer conversion):
- `lib/game-logic/dunks.js`: 8 instances (animation frames)
- `lib/multiplayer/mp_lobby.js`: 4 instances (UI delays)
- `lib/multiplayer/mp_config.js`: 1 instance
- `lib/game-logic/physical-play.js`: ~18 instances (loose ball animation)

**Strategy for Wave 23C**: Replace with EventTimer-based frame scheduler:
```javascript
// Instead of: mswait(30)
// Use: animator.scheduleFrame(30, callback)
```

### 4. Global gameState References (144 instances in lib/)
Still heavy usage in:
- **UI layer**: `lib/ui/*.js` - scoreboard, score-display, player-labels
- **Rendering**: Some animation functions
- **Legacy**: Old multiplayer sync code

**Strategy**: 
- Wave 23B: Document where they are
- Wave 23C+: Systematic conversion as we refactor each subsystem

### 5. Marked Dead Code (9 blocks)
Clear "SAFE TO DELETE" markers:
```
lib/ai/ai-movement.js:15           - Dead handler
lib/ai/ai-movement.js:214          - Dead function
lib/ai/ai-ball-handler.js:17       - Dead module
lib/game-logic/passing.js:331      - Dead function
lib/game-logic/hot-streak.js:104   - Dead code block
lib/game-logic/score-calculator.js:137  - Dead function
lib/game-logic/score-calculator.js:348  - Dead function
lib/game-logic/score-calculator.js:394  - Dead function
lib/game-logic/defense-actions.js:37    - Dead function
```

### 6. Outdated Documentation
**design_docs/** contains 17 files from Waves 20-21:
- `architecture_mismatches.md` - Pre-Wave 23 (obsolete)
- `missing_implementations.md` - Pre-refactor
- `potential_bugs_identified.md` - Likely fixed in Wave 23
- Wave 21 docs - Historical but no longer accurate

**Action**: 
- Archive Wave 20-21 docs to `docs/archive/waves/`
- Create new `docs/architecture.md` reflecting Wave 23 state
- Update `docs/waves/WAVE-23-COMPLETE.md` when done

### 7. Duplicate/Near-Duplicate Files
```
lib/ui/scoreboard.js vs lib/ui/score-display.js
  - Both implement drawScore()
  - One is active, one might be dead
  
nba_jam.js.backup (13,347 lines) vs nba_jam.js (1,539 lines)
  - Backup useful for diffing what was extracted
  - Could move to docs/archive/pre-wave23-nba_jam.js
```

## Cleanup Plan

### Phase 1: Directory Structure (Non-Breaking)
Create proper structure:
```bash
mkdir -p tests/{unit,integration,legacy,wave-23,helpers}
mkdir -p docs/{waves,debugging,architecture,archive}
mkdir -p scripts/
```

### Phase 2: Move Files (Non-Breaking)
Move files without breaking any `load()` statements:
1. Root docs → docs/waves/ and docs/debugging/
2. Root tests → tests/wave-23/
3. view-errors.sh → scripts/
4. Consolidate lib/testing/ → tests/
5. Archive nba_jam.js.backup → docs/archive/

### Phase 3: Delete Dead Code (Breaking but Safe)
Remove marked dead code:
1. Grep for "DEAD CODE - SAFE TO DELETE"
2. Delete those functions/blocks
3. Run test suite (all 58 tests must pass)
4. Commit

### Phase 4: Update Documentation
1. Create docs/architecture/WAVE-23-ARCHITECTURE.md
2. Archive design_docs/ to docs/archive/waves/20-21/
3. Create docs/TIMING-ANALYSIS.md for Wave 23C prep
4. Update README.md with new structure

### Phase 5: Document Remaining Work
Create tracking docs:
1. `docs/BLOCKING-CALLS.md` - All 31 mswait locations for Wave 23C
2. `docs/GLOBAL-STATE.md` - All 144 gameState refs for future waves
3. `docs/waves/WAVE-23C-TIMING.md` - EventTimer refactor plan

## Success Criteria
- [ ] Root directory has only: README.md, nba_jam.js, LICENSE (if any)
- [ ] All tests in tests/ directory
- [ ] All docs in docs/ directory
- [ ] All scripts in scripts/ directory
- [ ] All marked dead code deleted
- [ ] Test suite still passes (58/58)
- [ ] No broken load() paths
- [ ] Clear documentation for Wave 23C

## Risks
- **Low risk**: File moves (just paths, no code changes)
- **Medium risk**: Dead code deletion (marked safe but needs testing)
- **Zero risk**: Documentation updates

## Timeline
- Phase 1-2: 1 commit (file moves)
- Phase 3: 1 commit (dead code removal + test)
- Phase 4-5: 1 commit (documentation)
- Total: ~3 commits, properly organized repo

## Notes for Wave 23C
After cleanup, we'll tackle timing with:
1. EventTimer-based frame scheduler
2. Replace mswait() with async event system
3. Maintain multiplayer sync
4. Non-blocking animations
