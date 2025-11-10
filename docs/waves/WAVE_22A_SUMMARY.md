# Wave 22A: Critical Bug Fixes

## Branch: `wave-22a-rebound-test-fix`

### Issues Fixed

#### 1. ✅ Rebound Scrambles Not Resolving
**Root Cause:** Multiplayer coordinator path called `executeShot()` which set `reboundActive = true` but never called `createRebound()`. The subsequent check `if (!reboundActive)` prevented rebound creation, leaving the ball frozen.

**Fix:** Unconditionally call `createRebound(targetX, targetY)` after missed shots in coordinator path.

**Files:** `lib/game-logic/shooting.js`

---

#### 2. ✅ Dunks Missing 100%
**Root Cause:** Systemic issue where `getClosestPlayer()` was called with team name strings ("teamA"/"teamB") instead of team arrays throughout the codebase. This caused:
- `team[0]` on string returned first character, not player object
- Player coordinates were `undefined`
- `distanceBetweenPoints(undefined, undefined, ...)` returned `NaN`
- `baseChance += NaN` made dunk chance `NaN`
- `roll < NaN` always evaluated to `false` = 0% success rate

**Fix:** 
- Added `getOpposingTeam(teamName)` helper in `lib/utils/player-helpers.js`
- Fixed all `getClosestPlayer()` calls across 9 files to use `getOpposingTeam()`
- Added proper function documentation

**Files:** 
- `lib/utils/player-helpers.js` - New helper function
- `lib/game-logic/shooting.js` 
- `lib/game-logic/dunks.js`
- `lib/ai/ai-ball-handler.js` (2 instances)
- `lib/ai/offense-ball-handler.js`
- `lib/ai/offense-off-ball.js`
- `lib/game-logic/physical-play.js` (3 instances)

---

#### 3. ✅ Dunk Loop (Player Stuck Repeatedly Dunking)
**Root Cause:** `animateDunk()` cleared `shotInProgress` but not `ballCarrier` on missed dunks, leaving player with possession and immediately attempting another dunk.

**Fix:** Clear `gameState.ballCarrier = null` for missed dunks in `animateDunk()`.

**Files:** `lib/game-logic/dunks.js`

---

### Missing Dependencies Added

`lib/game-logic/dunks.js` was missing critical dependencies:
- `lib/utils/constants.js` - For `DUNK_DISTANCE_BASE`, `DUNK_DISTANCE_PER_ATTR`
- `lib/config/game-balance.js` - For `GAME_BALANCE.DUNKS.*` constants
- `lib/game-logic/movement-physics.js` - For `distanceBetweenPoints()` function

These missing dependencies were causing `NaN` propagation in dunk calculations.

---

## Known Issues (Wave 22B Required)

### 🔴 Blocking/Non-Blocking Architecture Conflict

**Problem:** The codebase has incompatible blocking and non-blocking components:

**Non-blocking (animation system):**
- `animationSystem.queueShotAnimation()` - Queues animations for frame-by-frame playback
- `animationSystem.update()` - Progresses animations in game loop
- Designed for smooth, non-blocking animations

**Blocking (game logic):**
- `mswait()` calls freeze the entire game loop
- Blocks during animation window, preventing `animationSystem.update()` from running
- `setupInbound()` called before animations complete
- Results in invisible shot arcs and timing conflicts

**Example:**
```javascript
// Queues non-blocking animation
animationSystem.queueShotAnimation(...); 

// Immediately blocks for 800ms - animation never progresses!
mswait(100);
drawScore();
mswait(700);
setupInbound(); // Moves sprites before animation finishes
```

**Required Fix:** Convert to state machine architecture (Wave 22B)
- Remove all `mswait()` calls
- Implement game phase states (SHOT_IN_PROGRESS, SHOT_ANIMATION, INBOUND, etc.)
- Make timing frame-based in game loop
- Ensure animations complete before state transitions

**Priority:** HIGH - Current architecture causes bugs and technical debt

**Estimated Effort:** 3-4 hours

---

## Testing

### Manual Testing
- [x] Jump shots create rebound scrambles
- [x] Players can secure rebounds  
- [x] Dunks succeed at appropriate rates (80-90% for skilled players close to basket)
- [x] Missed dunks don't loop
- [x] Player controls ball after rebounding missed dunk
- [ ] Shot arcs visible for made shots (Wave 22B issue)

### Test Infrastructure Created
- `lib/testing/test-helpers.js` - Mock utilities
- `lib/testing/test-jumpshot-rebound-bug.js` - Rebound bug reproduction
- `lib/testing/test-dunk-loop-bug.js` - Dunk loop bug reproduction
- `lib/testing/test_rebound_flow.js` - Rebound state machine validation
- `lib/testing/README.md` - Testing documentation

Run tests:
```bash
jsexec lib/testing/test_rebound_flow.js
```

---

## Files Changed

### Core Game Logic
- `lib/game-logic/shooting.js` - Fixed rebound creation, improved coordinator path
- `lib/game-logic/dunks.js` - Fixed ballCarrier clearing, added missing dependencies, fixed getClosestPlayer
- `lib/game-logic/rebounds.js` - (No changes, working correctly)

### AI Systems
- `lib/ai/ai-ball-handler.js` - Fixed getClosestPlayer (2 calls)
- `lib/ai/offense-ball-handler.js` - Fixed getClosestPlayer
- `lib/ai/offense-off-ball.js` - Fixed getClosestPlayer
- `lib/game-logic/physical-play.js` - Fixed getClosestPlayer (3 calls)

### Utilities
- `lib/utils/player-helpers.js` - Added getOpposingTeam() helper, improved docs
- `lib/utils/debug-logger.js` - NEW: File-based debugging system

### Testing
- `lib/testing/test-helpers.js` - NEW: Test mocks and utilities
- `lib/testing/test-jumpshot-rebound-bug.js` - NEW: Bug reproduction test
- `lib/testing/test-dunk-loop-bug.js` - NEW: Dunk loop test
- `lib/testing/test_rebound_flow.js` - NEW: Rebound flow validation
- `lib/testing/README.md` - NEW: Test documentation

### Documentation
- `DEBUGGING.md` - NEW: Debug logging guide
- `WAVE_22A_SUMMARY.md` - This file

---

## Next Steps

### Immediate (Current PR)
- Review and merge this PR
- Validate fixes in production gameplay

### Wave 22B (Next Branch)
- **Goal:** Fix blocking/non-blocking architecture conflict
- **Approach:** State machine for game phases
- **Tasks:**
  1. Remove all `mswait()` calls from game logic
  2. Implement phase-based state machine
  3. Convert timing to frame-based (game loop)
  4. Ensure animations complete before transitions
  5. Test multiplayer synchronization
- **Benefit:** Visible shot animations, better performance, cleaner architecture

### Future Waves
- AI behavior tuning (feels different from backup)
- Dribble pickup timing (Issue #3)
- Multiplayer flicker reduction (Issue #5)
