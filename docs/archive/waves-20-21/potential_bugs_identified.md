# NBA JAM Terminal Edition - Potential Bugs Identified

Comprehensive list of bugs identified through code analysis, categorized by severity and system.

---

## Critical Bugs (Game-Breaking)

### 1. Multiplayer Coordinator Disconnect Crash
**File**: `lib/multiplayer/mp_coordinator.js`  
**Severity**: Critical  
**Impact**: Game becomes unrecoverable if coordinator disconnects  
**Status**: ✅ **FIXED** in Wave 11 (commit e3c0499)

**Issue**:
```javascript
// No failover if coordinator leaves
if (coordinatorDisconnects()) {
    // Game crashes - no new coordinator elected
    // All clients stuck
}
```

**Fix**: Implement coordinator election
```javascript
function electNewCoordinator(session) {
    var players = getActivePlayers(session);
    if (players.length === 0) return null;
    
    players.sort((a, b) => a.globalId.localeCompare(b.globalId));
    var newCoord = players[0];
    
    client.write("nba_jam", "game." + session.id + ".coordinator", newCoord.globalId);
    notifyClients("coordinator_changed", newCoord);
}
```

---

### 2. Undefined Function Call: `getBlueTeam()` / `getRedTeam()`
**File**: `lib/utils/team-helpers.js` (line 13, 22)  
**Severity**: Critical  
**Impact**: Runtime error - functions don't exist

**Issue**:
```javascript
function getTeamSprites(teamName) {
    return teamName === "teamA" ? getRedTeam() : getBlueTeam();  // ReferenceError!
}
```

**Fix**: ✅ **FIXED** - Use direct sprite arrays
```javascript
function getTeamSprites(teamName) {
    return teamName === "teamA"
        ? [teamAPlayer1, teamAPlayer2]
        : [teamBPlayer1, teamBPlayer2];
}
```

---

## High Severity Bugs

### 3. Diagonal Movement Speed Exploit
**File**: `nba_jam.js` (input handling)  
**Severity**: High  
**Impact**: Moving diagonally is 1.41x faster than cardinal directions  
**Status**: ✅ **FIXED** in Wave 13 (commit 340d0dc)

**Issue**:
```javascript
if (key & K_UP) dy = -1;
if (key & K_RIGHT) dx = 1;
// Speed = sqrt(1^2 + 1^2) = 1.41 (40% faster!)
```

**Fix**: Normalize diagonal vectors
```javascript
var magnitude = Math.sqrt(dx * dx + dy * dy);
if (magnitude > 0) {
    dx /= magnitude;
    dy /= magnitude;
}
sprite.x += dx * speed;
sprite.y += dy * speed;
```

---

### 4. AI Gets Stuck in Corners
**File**: `lib/ai/ai-ball-handler.js`  
**Severity**: High  
**Impact**: AI dribbles into corner, can't escape, 5-second violation  
**Status**: ✅ **FIXED** in Wave 13 (commit 92403e9)

**Issue**: No corner detection or escape logic

**Fix**:
```javascript
function isInCorner(player) {
    var margin = 5;
    return (player.x < margin || player.x > COURT_WIDTH - margin) &&
           (player.y < margin || player.y > COURT_HEIGHT - margin);
}

function escapeCorner(player) {
    var centerX = COURT_WIDTH / 2;
    var centerY = COURT_HEIGHT / 2;
    moveAITowards(player, centerX, centerY);
}
```

---

### 5. Multiplayer Rubber-Banding
**File**: `lib/multiplayer/mp_client.js`  
**Severity**: High  
**Impact**: Sprites snap/jump due to incomplete state sync  
**Status**: ✅ **FIXED** in Wave 10 (commit 95b5fa8)

**Issue**: DTO doesn't include velocity or animation state
```javascript
var stateDTO = {
    players: [
        { id: "p1", x: 50, y: 30 }  // Missing: vx, vy, animation
    ]
};
```

**Fix**: Expand DTO
```javascript
var stateDTO = {
    players: [
        {
            id: "p1",
            x: 50,
            y: 30,
            vx: 1.5,        // ADD
            vy: 0.0,        // ADD
            state: "dribbling"  // ADD
        }
    ]
};
```

---

## Medium Severity Bugs

### 6. AI Passes to Out-of-Bounds Teammates
**File**: `lib/ai/ai-decision-support.js`  
**Severity**: Medium  
**Impact**: Turnover, looks broken  
**Status**: ✅ **FIXED** - Bounds checking added in ai-ball-handler.js lines 136-143

**Issue**: No bounds checking before passing
```javascript
function getOpenTeammate(player) {
    var teammate = getPlayerTeammate(player);
    // Missing: if (isOutOfBounds(teammate)) return null;
    return teammate;
}
```

**Fix**: Add bounds check
```javascript
if (teammate && !isOutOfBounds(teammate.x, teammate.y)) {
    return teammate;
}
return null;
```

---

### 7. Shot Clock Violation Not Announced
**File**: `nba_jam.js` (gameLoop)  
**Severity**: Medium  
**Impact**: Confusing to player (no feedback)  
**Status**: ✅ **FIXED** - Announcements present at lines 208 and 1155 in nba_jam.js

**Issue**:
```javascript
if (gameState.shotClock <= 0) {
    announceEvent("shot_clock_violation", {...});  // NOT CALLED
    switchPossession();
}
```

**Fix**: Ensure announcement happens
```javascript
if (gameState.shotClock <= 0) {
    announceEvent("shot_clock_violation", { team: gameState.currentTeam });
    mswait(1000);  // Show message
    switchPossession();
}
```

---

### 8. Quit Confirmation Blocks Game Loop
**File**: `nba_jam.js`  
**Severity**: Medium  
**Impact**: Game freezes while waiting for confirmation  
**Status**: ✅ **FIXED** in Wave 12 (commit a7a0f67)

**Issue**: Blocking `console.getkey()` call
```javascript
if (key === 'Q') {
    var confirm = console.getkey();  // BLOCKS entire game!
}
```

**Fix**: Non-blocking pause menu
```javascript
if (key === 'Q') {
    gameState.pauseMenuOpen = true;
}

if (gameState.pauseMenuOpen) {
    drawPauseMenu();
    var menuKey = console.inkey(K_NONE, 0);  // Non-blocking
    if (menuKey === 'Y') quit();
    if (menuKey === 'N') gameState.pauseMenuOpen = false;
}
```

---

### 9. Hot Streak Logic in UI Module
**File**: `lib/ui/score-display.js`  
**Severity**: Medium  
**Impact**: Game logic in wrong place, hard to test  
**Status**: ✅ **FIXED** in Wave 11 (commit e767932 - created score calculator module)

**Issue**: Hot streak calculation in rendering function
```javascript
function drawScore() {
    // GAME LOGIC (misplaced)
    if (player.consecutiveMakes >= 3) {
        player.hotStreak = true;
    }
    
    // Rendering (correct)
    renderScore();
}
```

**Fix**: Move to `lib/game-logic/hot-streak-system.js`

---

### 10. Duplicate Function Definitions
**Files**: Multiple  
**Severity**: Medium  
**Impact**: Maintenance burden, potential divergence  
**Status**: ✅ **PARTIALLY FIXED** in Wave 10 (commits 9bf4172, 4ab119f - removed team-helpers.js and getTouchingOpponents duplicate)

**Issue**:
- `getTeamSprites()` in `player-helpers.js` AND `team-helpers.js`
- `getTouchingOpponents()` in `positioning-helpers.js` AND `player-helpers.js`

**Fix**: Delete duplicates, use single source

---

## Low Severity Bugs

### 11. No Input Buffering
**File**: Input handling  
**Severity**: Low  
**Impact**: Rapid key presses can be dropped  
**Status**: ✅ **FIXED** in Wave 11 (commit 2a9b155)

**Issue**: Input checked once per frame (50ms window)
```javascript
// If key pressed/released between frames, it's missed
var key = console.inkey(K_NONE, 0);  // Only checks now
```

**Fix**: Implement input buffer
```javascript
var inputBuffer = [];

function captureInput() {
    var key = console.inkey(K_NONE, 0);
    if (key) inputBuffer.push(key);
}

function processBuffer() {
    while (inputBuffer.length > 0) {
        handleInput(inputBuffer.shift());
    }
}
```

---

### 12. Event Duplication in Multiplayer
**File**: `lib/multiplayer/mp_coordinator.js`  
**Severity**: Low  
**Impact**: Announcements shown twice on coordinator  
**Status**: ✅ **FIXED** in Wave 12 (commit 9179e93)

**Issue**: Coordinator fires event locally AND broadcasts
```javascript
if (isCoordinator) {
    announceEvent("score", {...});     // Local
    broadcastEvent("score", {...});     // To clients
    // Coordinator sees it twice!
}
```

**Fix**: Coordinator-only announcement
```javascript
if (isCoordinator) {
    announceEvent("score", {...});
    // Don't broadcast separately - clients pull from state
}
```

---

### 13. No Fast Break Awareness
**File**: `lib/ai/ai-ball-handler.js`  
**Severity**: Low  
**Impact**: AI doesn't push tempo (gameplay feels slow)  
**Status**: ✅ **FIXED** in Wave 12 (commit 5dacbec)

**Issue**: AI always walks ball up court

**Fix**: Detect fast break opportunity
```javascript
function isFastBreak(player) {
    var opponents = getOpposingTeamSprites(player.team);
    // Check if opponents are back on defense
    for (var opp of opponents) {
        if (isInDefensivePosition(opp, player.team)) {
            return false;
        }
    }
    return true;  // Open court!
}
```

---

### 14. String Formatting Duplicates
**File**: `lib/ui/score-display.js`  
**Severity**: Low  
**Impact**: Code duplication  
**Status**: ✅ **FIXED** in Wave 12 (commit 580df48)

**Issue**: Inline `padStart()` implementation instead of using `string-helpers.js`

**Fix**: Use shared helper
```javascript
load(js.exec_dir + "lib/utils/string-helpers.js");

var paddedScore = padStart(String(score), 3, "0");
```

---

### 15. Missing Steal Cooldown
**File**: `lib/ai/ai-movement.js`  
**Severity**: Low  
**Impact**: AI spams steal attempts  
**Status**: ✅ **FIXED** - stealRecoverFrames cooldown exists in defense-on-ball.js line 45

**Issue**: No cooldown between steals
```javascript
if (distance < 2) {
    attemptSteal(defender, ballCarrier);  // Every frame!
}
```

**Fix**: Add cooldown
```javascript
if (distance < 2 && defender.stealCooldown <= 0) {
    attemptSteal(defender, ballCarrier);
    defender.stealCooldown = 20;  // ~1 second
}
```

---

## Visual/Cosmetic Bugs

### 16. Announcer Text Overlaps
**File**: `lib/ui/announcer.js`  
**Severity**: Low  
**Impact**: Text difficult to read

**Issue**: New announcements don't clear old ones

**Fix**: Clear announcer area before new text

---

### 17. Score Display Alignment Issues
**File**: `lib/ui/score-display.js`  
**Severity**: Low  
**Impact**: Numbers not aligned properly

**Issue**: Padding inconsistent for 1-digit vs 2-digit vs 3-digit scores

**Fix**: Fixed-width font rendering

---

## Data/Logic Bugs

### 18. Player Stats Not Persisting
**File**: `lib/game-logic/stats-tracker.js`  
**Severity**: Medium  
**Impact**: Stats lost between games

**Issue**: No persistence to disk/database

**Fix**: Save stats to JSON file or Synchronet user data

---

### 19. Team Selection Validation Missing
**File**: `lib/ui/menus.js`  
**Severity**: Low  
**Impact**: Can select same team twice

**Issue**: No check if team already selected

**Fix**: Validate team selection

---

### 20. Roster Index Out of Bounds
**File**: `lib/core/sprite-init.js`  
**Severity**: Medium  
**Impact**: Crash if invalid roster index  
**Status**: ✅ **FIXED** in Wave 12 (commit 1c4effe)

**Issue**: No clamping of roster selection
```javascript
var playerData = team.players[rosterIndex];  // Might be undefined
```

**Fix**: Clamp index
```javascript
var safeIndex = clamp(rosterIndex, 0, team.players.length - 1);
var playerData = team.players[safeIndex];
```

---

## Multiplayer-Specific Bugs

### 21. Session Cleanup Not Guaranteed
**File**: `lib/multiplayer/mp_sessions.js`  
**Severity**: Medium  
**Impact**: Stale sessions in database

**Issue**: No automatic cleanup of finished sessions

**Fix**: TTL on sessions or periodic cleanup

---

### 22. No Reconnection Support
**File**: Multiplayer modules  
**Severity**: Low  
**Impact**: Temporary disconnect kicks player out

**Issue**: No way to rejoin after brief disconnect

**Fix**: Implement reconnection window (30 seconds)

---

### 23. Input Lag Compensation Incomplete
**File**: `lib/multiplayer/mp_client.js`  
**Severity**: Medium  
**Impact**: High-latency connections feel sluggish  
**Status**: ✅ **FIXED** in Wave 16 (mp_input_replay.js module created, integrated into client)

**Issue**: No input replay after reconciliation

**Details**: When server state corrections occur, client-side predictions are overwritten without replaying inputs that happened during the latency window, causing inputs to feel lost.

**Fix**: Implemented input replay buffer system:
- Created `lib/multiplayer/mp_input_replay.js` with frame-based history (120 frame buffer)
- `recordInput()` called in PlayerClient.handleInput() to store all inputs with frame numbers
- `replayInputsSince()` called in PlayerClient.reconcile() to re-apply inputs after server state
- `pruneOldInputs()` called periodically in update() to manage memory
- `clearInputHistory()` called in cleanup() on disconnect/new game

**Result**: Inputs are preserved and replayed after server reconciliation, eliminating input loss during lag spikes

---

### 24. Network Quality Indicator Incorrect
**File**: Multiplayer HUD  
**Severity**: Low  
**Impact**: Misleading latency display

**Issue**: Shows one-way latency instead of round-trip

**Fix**: Ping-pong measurement for RTT

---

## State Management Bugs

### 25. Global State vs Local State Inconsistency
**File**: `nba_jam.js`  
**Severity**: Medium  
**Impact**: State can diverge between global and local  
**Status**: ✅ **FIXED** in Wave 15 (commit 98dbf8c - moved timing vars to gameState)

**Issue**: Some timing vars local, some global (see architecture_mismatches.md)

**Fix**: Move all game-critical state to `gameState`

---

### 26. Violation Flag Not Reset
**File**: `nba_jam.js` (gameLoop)  
**Severity**: Medium  
**Impact**: Violation can trigger multiple times  
**Status**: ✅ **FIXED** - violationTriggeredThisFrame properly initialized at frame start (lines 173, 1151)

**Issue**: `violationTriggeredThisFrame` might persist

**Fix**: Reset flag at start of each game loop frame

---

### 27. Database Event Broadcasting During Gameplay
**File**: `lib/multiplayer/mp_coordinator.js`, `lib/multiplayer/mp_client.js`  
**Severity**: **CRITICAL**  
**Impact**: JSON overflow crashes in multiplayer games  
**Status**: ✅ **FIXED** in Wave 16 (commit 5147abe - disabled database events entirely)

**Issue**: Event broadcasting system used `client.push()` to write events (turboUpdate, shot_executed, etc.) to database during gameplay. Events accumulated without pruning, causing JSON payloads to exceed parser buffer limits (825+ frames observed). Non-coordinator clients crashed with "SyntaxError: JSON.parse" when trying to read truncated event arrays.

**Architecture Violation**: Database should only be used for lobby/session management. All in-game synchronization must use memory-based Queues.

**Fix**: 
- Disabled `broadcastEvent()` in mp_coordinator.js (now a no-op)
- Disabled `processEvents()` in mp_client.js (no database reads)
- Removed database event subscription in cleanup()
- All game state now syncs exclusively via stateQueues

**Result**: No database I/O during gameplay, no JSON overflow, proper Queue-based architecture

---

**Issue**: `violationTriggeredThisFrame` might persist
```javascript
var violationTriggeredThisFrame = false;
// ... later ...
if (backcourtViolation) {
    violationTriggeredThisFrame = true;
}
// ... frame ends ...
// Flag might not reset properly
```

**Fix**: Explicitly reset at frame start
```javascript
violationTriggeredThisFrame = false;  // Reset every frame
```

---

## Bug Summary by Category

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Multiplayer | 1 | 1 | 4 | 3 | 9 |
| AI | 0 | 2 | 1 | 2 | 5 |
| Input | 0 | 1 | 1 | 1 | 3 |
| State | 0 | 0 | 2 | 0 | 2 |
| UI/Visual | 0 | 0 | 1 | 2 | 3 |
| Logic | 1 | 0 | 2 | 1 | 4 |
| **Total** | **2** | **4** | **11** | **9** | **26** |

---

## Recommended Fix Priority

### Wave 7 (Immediate - Critical/High)
1. ✅ Fix `getBlueTeam()` undefined (DONE)
2. Implement coordinator failover
3. Fix diagonal movement speed
4. Add AI corner escape
5. Expand multiplayer state DTO

### Wave 8 (Short Term - Medium)
6. Add bounds checking for AI passes
7. Fix shot clock announcement
8. Non-blocking quit confirmation
9. Roster index clamping
10. Remove duplicate functions

### Wave 9 (Long Term - Low/Polish)
11. Input buffering
12. Event deduplication
13. Fast break awareness
14. Stats persistence
15. Reconnection support

---

## Testing Recommendations

### Unit Tests Needed
- State management (transitions)
- AI decision-making (shot quality)
- Input normalization (diagonal fix)
- Bounds checking

### Integration Tests Needed
- Multiplayer coordinator failover
- Session lifecycle
- State synchronization
- Event broadcasting

### Manual Testing Needed
- Corner escape behavior
- Network lag compensation
- UI feedback (announcements)
- Game flow (violations)

---

## Conclusion

**Total Bugs Identified**: 26  
**Critical**: 2 (must fix)  
**High**: 4 (should fix soon)  
**Medium**: 11 (plan to fix)  
**Low**: 9 (nice to have)

**Most Impactful Fixes**:
1. Coordinator failover (enables reliable multiplayer)
2. Diagonal movement normalization (fair gameplay)
3. AI corner escape (prevents frustrating AI behavior)
4. Expand DTO (reduces rubber-banding)
5. Remove duplicates (maintenance burden)

**Estimated Fix Effort**: 15-20 hours for critical/high, 25-30 hours total
