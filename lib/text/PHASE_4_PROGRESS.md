# Phase 4 Progress: Game Logic Systems Extraction

## Current Status

###✅ COMPLETE: Phase 4.1 - Shooting System (672 lines)
**File**: `lib/game-logic/shooting.js`

**Functions Extracted**:
- `calculateShotProbability()` - Shot quality evaluation with distance, defense, skill
- `attemptShot()` - Main shooting logic (dunks vs shots, stats, scoring, possession changes)
- `animateShot()` - Shot animation with arc, blocking detection, deflection
- `autoContestShot()` - AI defenders auto-contest shots
- `isCornerThreePosition()` - Corner three detection helper

**Key Features**:
- Base probability by distance (layup 85%, close 70%, mid 55%, three 40%, deep 15%)
- Attribute multipliers (dunk skill for close, 3PT skill for perimeter)
- Defender penalties (heavily contested -25%, contested -15%, lightly guarded -8%)
- Shot arc animation with blocking windows
- Block deflection physics
- Corner three bonuses
- Rim flash on makes
- Integrated with dunk system via `evaluateDunkOpportunity()`

**Dependencies**: Relies on dunks module (will be extracted next)

---

## Remaining Phases

### 🔄 IN PROGRESS: Phase 4.2 - Dunk System (~900 lines)
**Target**: `lib/game-logic/dunks.js`

**Functions to Extract**:
- `evaluateDunkOpportunity()` - Determine if shot should be dunk
- `calculateDunkChance()` - Dunk success probability
- `selectDunkStyle()` - Choose dunk animation (standard, power, glide, hang, windmill)
- `generateDunkFlight()` - Calculate dunk flight path with arcs
- `animateDunk()` - Dunk animation with blocking
- `autoContestDunk()` - AI defenders contest dunks
- `maybeBlockDunk()` - Block detection during dunk
- `executeShot()` - Multiplayer coordinator non-blocking shot execution
- `isInsideDunkKey()` - Check if player in restricted area
- `getDunkFlashPalette()`, `getDunkLabelText()` - Dunk visual effects
- `computeShotAnimationTiming()` - Shot timing helper

**Estimated Size**: ~900 lines (evaluateDunkOpportunity through executeShot)

---

### Phase 4.3 - Passing System (~400 lines)
**Target**: `lib/game-logic/passing.js`

**Functions to Extract**:
- `animatePass()` - Pass animation
- `checkPassInterception()` - Defender intercept logic
- Pass-related helpers

**Estimated Size**: ~400 lines

---

### Phase 4.4 - Rebound System (~300 lines) 🎯 BUG ISOLATION TARGET
**Target**: `lib/game-logic/rebounds.js`

**Functions to Extract**:
- `updateReboundScramble()` - Rebound positioning logic
- `createRebound()` - Initialize rebound
- `resolveReboundScramble()` - Award rebound to player
- Rebound helpers

**Purpose**: Isolate rebound bug in dedicated module for easier debugging

**Estimated Size**: ~300 lines

---

### Phase 4.5 - Physical Play (~250 lines)
**Target**: `lib/game-logic/physical-play.js`

**Functions to Extract**:
- `attemptShove()` - Shove mechanics
- `attemptShake()` - Shake/juke mechanics
- Shove/shake helpers

**Estimated Size**: ~250 lines

---

### Phase 4.6 - Defense Actions (~200 lines)
**Target**: `lib/game-logic/defense-actions.js`

**Functions to Extract**:
- `attemptSteal()` - Human player steal
- `attemptAISteal()` - AI steal logic
- `attemptBlock()` - Block mechanics
- Block-related helpers

**Estimated Size**: ~200 lines

---

### Phase 4.7 - Possession System (~350 lines)
**Target**: `lib/game-logic/possession.js`

**Functions to Extract**:
- `setupInbound()` - Inbound positioning
- `handleInbounding()` - Inbound mechanics
- Possession change helpers

**Estimated Size**: ~350 lines

---

## Summary

- **Phase 4.1 Complete**: 672 lines extracted (shooting.js)
- **Remaining**: ~2,400 lines across 6 modules
- **Total Phase 4**: ~3,072 lines to extract
- **Load Statement**: Added to nba_jam.js (line 30)

**Combined Progress**:
- Phase 1: 1,100 lines (6 modules) ✅
- Phase 2: 1,526 lines (5 modules) ✅
- Phase 3: 929 lines (5 modules) ✅
- Phase 4: 672 lines so far (1 module) 🔄
- **Total Extracted**: 4,227 lines (17 modules)
- **Target Remaining**: ~7,800 lines

**Main File Status**:
- Original: 13,348 lines
- Current: 13,269 lines (added load statements, removed constants)
- Contains: All duplicate functions still present
- After deletion: ~5,500-6,000 lines remaining (before Phase 5-6)
