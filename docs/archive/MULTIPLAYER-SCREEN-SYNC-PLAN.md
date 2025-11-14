# Multiplayer Screen Synchronization - Comprehensive Plan

## Problem Statement

**Current State**: Multiple blocking screens in single-player code lack multiplayer coordination  
**Impact**: Screen desync between clients, soft locks, poor user experience  
**Scope**: All screens that block on user input need multiplayer-aware coordination

---

## Current Blocking Screens Inventory

### Critical (Game-Breaking if Desynced)

1. **Splash Screen** (`lib/ui/menus.js:25-31`)
   - Shows NBA JAM logo, waits for ANY key
   - Blocks: `console.getkey()` - infinite block
   - Issue: If one client dismisses early, other stuck while game tries to start

2. **Matchup Screen** (`lib/ui/menus.js:707`)
   - Shows team lineups, waits for SPACE
   - Blocks: `console.inkey(K_NONE, 100)` loop
   - Issue: One client can dismiss while other still reading

3. **Halftime Screen** (`lib/ui/halftime.js:82-106`) ✅ **PARTIALLY FIXED**
   - Shows stats, waits for SPACE or S (substitutions)
   - Blocks: `console.inkey(K_NONE, 100)` loop
   - Current: Non-coordinator now sees screen via state sync
   - Issue: No coordinated dismissal, no auto-timeout in MP

4. **Game Over Screen** (`lib/ui/game-over.js:240-267`)
   - Shows final stats, waits for selection (Q/SPACE/N)
   - Blocks: `console.inkey(K_NONE, 100)` then `console.getkey()`
   - Issue: No MP coordination at all

5. **Substitution Screen** (`lib/ui/halftime.js:188`)
   - Future feature, already blocking
   - Blocks: `console.getkey()` loop

### Medium (UX Issues)

6. **Team Selection** (`lib/ui/menus.js:58-180`)
   - Handled by lobby pre-game, but could desync if re-entered
   - Blocks: `console.getkey()` loops

7. **Player Assignment** (`lib/ui/menus.js:267-320`)
   - Also handled pre-game
   - Blocks: `console.getkey()` loops

### Low Priority (Single-Player Only)

8. **Roster Selection** (`lib/ui/menus.js:139`)
   - Pre-game only
9. **Bookie Screens** (`lib/bookie/*.js`)
   - Demo mode only

---

## Architectural Principles

### Pattern 1: Coordinator Authority + Client Acknowledgment

**Use for**: Screens where ONE decision affects all (matchup, halftime, game over)

```
Coordinator:
1. Enters screen state
2. Broadcasts "screen_enter" event with data
3. Waits for ALL clients to acknowledge
4. Shows screen, collects local input
5. When ready to dismiss:
   a. Broadcasts "screen_ready_check" 
   b. Collects ready votes from all clients
   c. When all ready OR timeout: broadcasts "screen_dismiss"
6. Exits screen

Non-Coordinator:
1. Receives "screen_enter" event
2. Shows screen
3. Sends "screen_ack" immediately
4. Collects local input (read-only mode)
5. When SPACE pressed: sends "screen_ready_vote"
6. Waits for "screen_dismiss" from coordinator
7. Exits screen
```

**Benefits**:
- All clients see screen simultaneously
- Coordinator controls flow but respects client readiness
- Timeout prevents one slow player blocking others
- Graceful handling of disconnects

### Pattern 2: Shared Ready Counter

**Use for**: Screens where each player indicates readiness

```
State Structure:
{
    screenActive: "halftime" | "game_over" | "matchup" | null,
    screenData: { ... screen-specific data ... },
    playerReadyVotes: { 
        "player1_globalId": false,
        "player2_globalId": false 
    },
    dismissTimer: 30000,  // 30 second max
    dismissTimerStart: 1731290000000
}

Flow:
1. Coordinator sets screenActive + broadcasts state
2. All clients enter screen (via state sync)
3. Each client presses SPACE → sets own ready vote
4. Coordinator monitors votes + timer
5. When ALL ready OR timer expires:
   - Coordinator sets screenActive = null
   - All clients exit via state sync
```

**Benefits**:
- No special events needed (uses state sync)
- Auto-timeout prevents soft locks
- Visual indicator of who's ready
- Democratic dismissal

---

## Proposed Solution: Hybrid Approach

### Phase 1: State-Sync Framework (2-3 hours)

**Create**: `lib/multiplayer/mp-screen-coordinator.js`

```javascript
function MPScreenCoordinator(systems, mpCoordinator, playerClient) {
    this.systems = systems;
    this.coordinator = mpCoordinator;
    this.client = playerClient;
    
    // Screen state management
    this.activeScreen = null;
    this.screenData = null;
    this.readyVotes = {};
    this.dismissTimer = null;
    this.dismissTimerStart = null;
    
    // Configuration
    this.DEFAULT_TIMEOUT = 30000; // 30 seconds
    this.MATCHUP_TIMEOUT = 15000; // 15 seconds
    this.HALFTIME_TIMEOUT = 60000; // 60 seconds
    this.GAMEOVER_TIMEOUT = 120000; // 2 minutes
}

// Coordinator enters screen
MPScreenCoordinator.prototype.enterScreen = function(screenType, data, timeout) {
    if (!this.coordinator || !this.coordinator.isCoordinator) {
        throw new Error("Only coordinator can call enterScreen");
    }
    
    this.activeScreen = screenType;
    this.screenData = data;
    this.dismissTimer = timeout || this.DEFAULT_TIMEOUT;
    this.dismissTimerStart = Date.now();
    
    // Initialize ready votes for all players
    var session = this.coordinator.session;
    if (session && session.playerList) {
        for (var i = 0; i < session.playerList.length; i++) {
            this.readyVotes[session.playerList[i]] = false;
        }
    }
    
    // Broadcast via state sync
    this.broadcastScreenState();
};

// Any client votes ready
MPScreenCoordinator.prototype.setReady = function(playerId) {
    if (this.coordinator && this.coordinator.isCoordinator) {
        // Coordinator updates vote
        this.readyVotes[playerId] = true;
        this.broadcastScreenState();
    } else {
        // Non-coordinator sends vote via input queue
        this.client.sendScreenReadyVote(playerId);
    }
};

// Coordinator checks if can dismiss
MPScreenCoordinator.prototype.canDismiss = function() {
    if (!this.activeScreen) return true;
    
    // Check timeout
    var elapsed = Date.now() - this.dismissTimerStart;
    if (elapsed >= this.dismissTimer) {
        debugLog("[MP SCREEN] Auto-timeout after " + elapsed + "ms");
        return true;
    }
    
    // Check all votes
    var allReady = true;
    for (var playerId in this.readyVotes) {
        if (!this.readyVotes[playerId]) {
            allReady = false;
            break;
        }
    }
    
    return allReady;
};

// Coordinator dismisses screen
MPScreenCoordinator.prototype.dismissScreen = function() {
    this.activeScreen = null;
    this.screenData = null;
    this.readyVotes = {};
    this.dismissTimer = null;
    this.dismissTimerStart = null;
    
    this.broadcastScreenState();
};

// Broadcast screen state (integrate with existing state sync)
MPScreenCoordinator.prototype.broadcastScreenState = function() {
    var stateManager = this.systems.stateManager;
    
    stateManager.set("mpScreen", {
        active: this.activeScreen,
        data: this.screenData,
        votes: this.readyVotes,
        timeout: this.dismissTimer,
        start: this.dismissTimerStart
    }, "mp_screen_update");
};

// Non-coordinator receives screen state (called from mp_client updateGameState)
MPScreenCoordinator.prototype.handleScreenState = function(screenState) {
    if (!screenState) {
        // Screen dismissed
        if (this.activeScreen) {
            this.activeScreen = null;
            // Return "dismissed" signal
            return { action: "dismiss" };
        }
        return null;
    }
    
    // Screen entered
    if (!this.activeScreen && screenState.active) {
        this.activeScreen = screenState.active;
        this.screenData = screenState.data;
        this.readyVotes = screenState.votes || {};
        this.dismissTimer = screenState.timeout;
        this.dismissTimerStart = screenState.start;
        
        // Return "enter" signal with screen type
        return { 
            action: "enter", 
            screen: screenState.active, 
            data: screenState.data 
        };
    }
    
    // Update votes
    if (this.activeScreen === screenState.active) {
        this.readyVotes = screenState.votes || {};
        return { action: "update", votes: this.readyVotes };
    }
    
    return null;
};
```

**Integration Points**:
1. Add to `mp_coordinator.js` serializeGameState(): include screen coordinator state
2. Add to `mp_client.js` updateGameState(): call handleScreenState()
3. Add to main game loop: check for screen transitions

---

### Phase 2: Refactor Halftime Screen (1-2 hours)

**Goal**: Make halftime non-blocking with MP coordination

**Current** (`lib/ui/halftime.js`):
```javascript
function showHalftimeScreen(systems) {
    // ... render ...
    
    while (true) {  // BLOCKING
        var key = console.inkey(K_NONE, 100);
        if (key === ' ') break;
    }
    
    // ... cleanup ...
}
```

**Refactored**:
```javascript
function showHalftimeScreen(systems, mpScreenCoord) {
    var stateManager = systems.stateManager;
    var myGlobalId = stateManager.get("myGlobalId");
    var isCoordinator = (mpCoordinator && mpCoordinator.isCoordinator);
    
    // Coordinator enters screen
    if (isCoordinator && mpScreenCoord) {
        mpScreenCoord.enterScreen("halftime", {
            currentHalf: stateManager.get("currentHalf"),
            score: stateManager.get("score"),
            timeRemaining: stateManager.get("timeRemaining")
        }, mpScreenCoord.HALFTIME_TIMEOUT);
    }
    
    // Render screen
    renderHalftimeStats(systems);
    
    // Show ready indicator
    var startTime = Date.now();
    var myReady = false;
    
    // NON-BLOCKING loop
    while (true) {
        var key = console.inkey(K_NONE, 100);
        
        // Handle input
        if (key && key.length > 0) {
            var keyUpper = key.toUpperCase();
            if (keyUpper === 'S') {
                // Substitutions (future)
            } else if (key === ' ' && !myReady) {
                // Vote ready
                myReady = true;
                if (mpScreenCoord) {
                    mpScreenCoord.setReady(myGlobalId);
                }
                updateReadyIndicator(systems, mpScreenCoord, true);
            } else if (keyUpper === 'Q') {
                stateManager.set('gameRunning', false, 'user_quit_halftime');
                if (isCoordinator && mpScreenCoord) {
                    mpScreenCoord.dismissScreen();
                }
                return;
            }
        }
        
        // Check for dismissal
        if (mpScreenCoord) {
            if (isCoordinator) {
                // Coordinator checks if can dismiss
                if (mpScreenCoord.canDismiss()) {
                    mpScreenCoord.dismissScreen();
                    break;
                }
            } else {
                // Non-coordinator waits for dismiss signal
                if (!mpScreenCoord.activeScreen || mpScreenCoord.activeScreen !== "halftime") {
                    break; // Dismissed by coordinator
                }
            }
            
            // Update ready indicator display
            updateReadyIndicator(systems, mpScreenCoord, myReady);
        } else {
            // Single-player fallback
            if (key === ' ') break;
            
            // Auto-advance after 30 seconds
            if (Date.now() - startTime >= 30000) {
                break;
            }
        }
        
        // Update timer display
        var elapsed = Date.now() - (mpScreenCoord ? mpScreenCoord.dismissTimerStart : startTime);
        var remaining = Math.max(0, (mpScreenCoord ? mpScreenCoord.dismissTimer : 30000) - elapsed);
        updateTimerDisplay(systems, Math.ceil(remaining / 1000));
    }
    
    // Cleanup
    stateManager.set("isHalftime", false, "halftime_end");
    // ... rest of cleanup ...
}

function updateReadyIndicator(systems, mpScreenCoord, myReady) {
    if (!mpScreenCoord) return;
    
    // Show who's ready
    var readyText = "\n\n  Ready: ";
    var readyCount = 0;
    var totalPlayers = 0;
    
    for (var playerId in mpScreenCoord.readyVotes) {
        totalPlayers++;
        if (mpScreenCoord.readyVotes[playerId]) {
            readyCount++;
            readyText += "✓ ";
        } else {
            readyText += "⏳ ";
        }
    }
    
    readyText += "(" + readyCount + "/" + totalPlayers + ")";
    
    // Display at bottom of screen
    courtFrame.gotoxy(1, 20);
    courtFrame.center(readyText);
    cycleFrame(courtFrame);
}

function updateTimerDisplay(systems, secondsRemaining) {
    var timerText = "Auto-continue in: " + secondsRemaining + "s";
    courtFrame.gotoxy(1, 21);
    courtFrame.center(timerText);
    cycleFrame(courtFrame);
}
```

**Key Changes**:
- Non-blocking: Loop checks for dismissal via state sync
- Visual feedback: Shows who's ready, countdown timer
- Democratic: All players vote, coordinator enforces timeout
- Fallback: Single-player mode still works without MP coordinator

---

### Phase 3: Refactor Matchup Screen (1 hour)

**Similar pattern to halftime**:
- Coordinator enters screen with team data
- All clients show lineup
- Players press SPACE when ready
- 15-second timeout (faster than halftime)
- Coordinator dismisses when all ready or timeout

**Changes**: `lib/ui/menus.js:707` → Non-blocking loop with ready votes

---

### Phase 4: Refactor Game Over Screen (1-2 hours)

**More complex**: Has 3 options (Quit, Play Again, New Teams)

**Approach**:
- Coordinator enters screen
- All clients show stats
- Each client votes: Q, SPACE (play again), or N (new teams)
- Coordinator tallies votes
- Majority wins (or coordinator decides on tie)
- 2-minute timeout before auto-quit

**Voting Logic**:
```javascript
{
    votes: {
        "player1": "quit",
        "player2": "play_again",
        "player3": null  // Not voted yet
    }
}

// Tally after all vote or timeout:
// - Quit: any quit vote = game ends
// - Play again vs new teams: majority wins
// - Tie: coordinator's vote wins
```

---

### Phase 5: Splash Screen Fix (30 minutes)

**Simplest case**: No user choices, just "press any key"

**Solution**:
```javascript
function showSplashScreen(mpScreenCoord) {
    // Show graphic
    // ...
    
    if (mpScreenCoord) {
        var myGlobalId = stateManager.get("myGlobalId");
        var isCoordinator = mpScreenCoord.coordinator && mpScreenCoord.coordinator.isCoordinator;
        
        if (isCoordinator) {
            mpScreenCoord.enterScreen("splash", {}, 10000); // 10 sec timeout
        }
        
        // Wait for any key OR coordinator dismissal
        while (mpScreenCoord.activeScreen === "splash") {
            var key = console.inkey(K_NONE, 100);
            if (key && key.length > 0) {
                mpScreenCoord.setReady(myGlobalId);
            }
            
            // Coordinator checks dismissal
            if (isCoordinator && mpScreenCoord.canDismiss()) {
                mpScreenCoord.dismissScreen();
            }
        }
    } else {
        // Single-player: wait for key
        console.getkey();
    }
}
```

---

## Implementation Phases

### Phase 1: Foundation (2-3 hours) ⭐ **START HERE**

**Deliverables**:
1. Create `lib/multiplayer/mp-screen-coordinator.js` (complete implementation)
2. Integrate with `mp_coordinator.js` state serialization
3. Integrate with `mp_client.js` state reconciliation
4. Add to main game loop screen transition detection
5. Unit tests for vote tallying logic

**Files Modified**:
- NEW: `lib/multiplayer/mp-screen-coordinator.js`
- `lib/multiplayer/mp_coordinator.js` - add screen state to broadcast
- `lib/multiplayer/mp_client.js` - add screen state handling
- `nba_jam.js` - instantiate screen coordinator

**Testing**:
- Single-player: Should work unchanged (null coordinator)
- Multiplayer: Screen state syncs between clients
- Vote tallying: Correct with 2, 3, 4 players

---

### Phase 2: Halftime Screen (1-2 hours)

**Deliverables**:
1. Refactor `lib/ui/halftime.js` to use screen coordinator
2. Add ready indicator rendering
3. Add countdown timer rendering
4. Test coordinator dismissal logic
5. Test timeout behavior

**Files Modified**:
- `lib/ui/halftime.js` - complete rewrite of input loop
- `nba_jam.js` - pass screen coordinator to showHalftimeScreen()

**Testing**:
- All players see halftime simultaneously
- Ready votes display correctly
- Coordinator dismisses when all ready
- Timeout works (set to 10 sec for testing)
- One player quit → all exit gracefully

---

### Phase 3: Matchup Screen (1 hour)

**Deliverables**:
1. Refactor `lib/ui/menus.js:707` matchup screen
2. Similar pattern to halftime
3. 15-second timeout

**Files Modified**:
- `lib/ui/menus.js` - refactor showMatchupScreen()

**Testing**:
- All players see matchup simultaneously
- Fast dismiss when all ready
- Timeout works

---

### Phase 4: Game Over Screen (1-2 hours)

**Deliverables**:
1. Refactor `lib/ui/game-over.js` 
2. Implement vote tallying (quit/play/newteams)
3. Show vote status to all players
4. Coordinator applies majority vote

**Files Modified**:
- `lib/ui/game-over.js` - complete rewrite of input handling

**Testing**:
- All players vote
- Majority wins
- Quit vote overrides others
- Tie handling
- Timeout → auto quit

---

### Phase 5: Splash Screen (30 minutes)

**Deliverables**:
1. Refactor `lib/ui/menus.js:25-31` splash screen
2. Simple ready-check pattern

**Files Modified**:
- `lib/ui/menus.js` - refactor showSplashScreen()

**Testing**:
- All players see splash
- First player dismisses → others follow
- 10-second timeout works

---

## Error Handling & Edge Cases

### Player Disconnect During Screen

**Scenario**: Player disconnects while at halftime

**Solution**:
```javascript
// In coordinator's canDismiss() check
MPScreenCoordinator.prototype.canDismiss = function() {
    // ... timeout check ...
    
    // Get active players (exclude disconnected)
    var activePlayers = this.getActivePlayers();
    
    // Check votes only for active players
    var allReady = true;
    for (var i = 0; i < activePlayers.length; i++) {
        var playerId = activePlayers[i];
        if (!this.readyVotes[playerId]) {
            allReady = false;
            break;
        }
    }
    
    return allReady;
};

MPScreenCoordinator.prototype.getActivePlayers = function() {
    // Check which players are still connected
    var active = [];
    var session = this.coordinator.session;
    
    if (session && session.playerList) {
        for (var i = 0; i < session.playerList.length; i++) {
            var playerId = session.playerList[i];
            // Check if player's input queue is still active
            if (this.coordinator.playerInputQueues[playerId]) {
                active.push(playerId);
            }
        }
    }
    
    return active;
};
```

### Coordinator Disconnect

**Scenario**: Coordinator disconnects during screen

**Solution**: Promote new coordinator (out of scope, but coordinator should survive through screen)

**Mitigation**: If coordinator exits screen, force dismiss for all clients

### State Desync

**Scenario**: Non-coordinator misses screen entry event

**Solution**: Already solved via state sync - will catch up on next reconciliation

### Timeout Too Short

**Scenario**: Player reading stats needs more time

**Solution**: 
- Halftime: 60 seconds (generous)
- Game Over: 120 seconds (very generous)
- Can adjust in config

---

## Testing Plan

### Unit Tests

1. **Vote Tallying**:
   - 2 players: both ready → dismiss
   - 2 players: one ready → wait
   - 3 players: 2 ready, 1 timeout → dismiss
   - 4 players: 3 quit, 1 play → quit wins

2. **Timeout**:
   - Enter screen → wait full timeout → auto-dismiss
   - Enter screen → all ready before timeout → early dismiss

3. **Disconnect Handling**:
   - 3 players, 1 disconnects → needs 2 votes to dismiss
   - All disconnect → coordinator auto-dismisses

### Integration Tests

1. **Halftime Flow**:
   - Start MP game, reach halftime
   - Both see screen within 100ms
   - First player presses SPACE
   - Ready indicator updates
   - Second player presses SPACE
   - Both exit within 100ms

2. **Game Over Flow**:
   - Game ends
   - Both see game over
   - P1 votes "play again", P2 votes "quit"
   - Quit wins, both exit to menu

3. **Splash Screen**:
   - Start MP game
   - Both see splash
   - One presses key
   - Both advance to team select

---

## Migration Strategy

### Backward Compatibility

**Goal**: Don't break single-player or existing multiplayer

**Approach**:
```javascript
// All screen functions check for MP coordinator
function showHalftimeScreen(systems, mpScreenCoord) {
    if (mpScreenCoord) {
        // NEW: MP-aware path
        runMPHalftimeScreen(systems, mpScreenCoord);
    } else {
        // OLD: Single-player blocking path
        runSinglePlayerHalftimeScreen(systems);
    }
}
```

**Benefits**:
- No risk to single-player
- Can test MP path independently
- Easy rollback if issues found

### Rollout

1. **Merge Phase 1**: Foundation only, no behavior change
2. **Test**: Verify state sync works
3. **Merge Phase 2**: Halftime only
4. **Test**: Verify halftime coordination
5. **Merge Phases 3-5**: Remaining screens
6. **Test**: Full MP session end-to-end

---

## Estimated Time

- **Phase 1 (Foundation)**: 2-3 hours
- **Phase 2 (Halftime)**: 1-2 hours
- **Phase 3 (Matchup)**: 1 hour
- **Phase 4 (Game Over)**: 1-2 hours
- **Phase 5 (Splash)**: 30 minutes
- **Testing & Polish**: 1-2 hours

**Total**: 7-11 hours

**Recommend**: 2-3 sessions
- Session 1: Phase 1 + 2 (foundation + halftime) - 4 hours
- Session 2: Phases 3 + 4 (matchup + game over) - 3 hours
- Session 3: Phase 5 + testing (splash + polish) - 2 hours

---

## Success Criteria

✅ All players see screens simultaneously (within 200ms)  
✅ Ready indicators work for all screen types  
✅ Timeout prevents soft locks  
✅ Player disconnect handled gracefully  
✅ Single-player unchanged  
✅ Coordinator controls flow but respects client input  
✅ Visual feedback (ready checkmarks, countdown timer)  
✅ No blocking loops in MP mode  

---

## Next Steps

**Immediate**: Decide if we tackle this now or defer

**If Now**: Start Phase 1 (foundation) - create screen coordinator class

**If Defer**: Document as technical debt, continue with:
- Revert temporary 10-second game time
- Merge flicker fix branch to main
- Move to trail animations or overtime

**My Recommendation**: Tackle Phase 1+2 now (4 hours) - it's the most critical (halftime) and establishes the pattern for the rest. The remaining phases can be done incrementally.

Your call! Should we proceed with Phase 1?
