# NBA JAM Terminal Edition - Multiplayer Design and Architecture

Comprehensive documentation of the multiplayer system, network architecture, and synchronization patterns.

---

## Table of Contents

1. [Multiplayer Overview](#multiplayer-overview)
2. [Network Architecture](#network-architecture)
3. [Coordinator Pattern](#coordinator-pattern)
4. [Session Management](#session-management)
5. [State Synchronization](#state-synchronization)
6. [Input Handling](#input-handling)
7. [Lag Compensation](#lag-compensation)
8. [Network Protocol](#network-protocol)
9. [Lobby System](#lobby-system)

---

## Multiplayer Overview

### Supported Modes

**Network Multiplayer**: 2-4 players over BBS network
- **Players**: 1-4 human players + CPU fill
- **Connection**: Synchronet JSON-DB (shared data store)
- **Topology**: Client-server (one coordinator, multiple clients)
- **Latency**: 50-300ms typical

**Local Multiplayer**: NOT SUPPORTED
- Limitation: Single terminal, single keyboard
- Would require split keyboard or gamepad support

### Key Components

```
┌─────────────────────────────────────────────────┐
│              Multiplayer System                 │
├─────────────────────────────────────────────────┤
│  1. Lobby System     (session creation/join)    │
│  2. Coordinator      (authoritative server)     │
│  3. Client           (non-auth players)         │
│  4. State Sync       (broadcast/reconcile)      │
│  5. Input System     (capture/transmit)         │
└─────────────────────────────────────────────────┘
```

---

## Network Architecture

### System Topology

```
Player 1 (Coordinator)                 JSON-DB Server
┌──────────────────┐                  ┌──────────────┐
│ - Run game logic │ ───── write ──>  │  Game State  │
│ - Process inputs │                  │    Input     │
│ - Broadcast state│ <──── read ────  │   Session    │
└──────────────────┘                  └──────────────┘
         ▲                                    ▲
         │                                    │
    coordinator_flag                     read/write
         │                                    │
         ▼                                    ▼
┌──────────────────┐                  ┌──────────────┐
│  Player 2        │                  │  Player 3    │
│  (Client)        │                  │  (Client)    │
├──────────────────┤                  ├──────────────┤
│ - Predict local  │                  │ - Predict    │
│ - Send input     │                  │ - Send input │
│ - Receive state  │                  │ - Receive    │
│ - Reconcile      │                  │ - Reconcile  │
└──────────────────┘                  └──────────────┘
```

### JSON-DB Backend

**Technology**: Synchronet's JSON-DB service
- **Type**: Shared key-value store (Redis-like)
- **Port**: 10088 (default)
- **Protocol**: TCP with JSON payloads
- **Persistence**: In-memory (optional disk)

**Data Structure**:
```
nba_jam/
├─ lobby/
│  ├─ sessions/
│  │  ├─ [sessionId]/        # Session metadata
│  │  │  ├─ meta
│  │  │  ├─ players
│  │  │  └─ teams
│  └─ active_sessions        # List of session IDs
├─ game/
│  ├─ [sessionId]/
│  │  ├─ state               # Game state (scores, time, etc.)
│  │  ├─ positions           # Player positions
│  │  ├─ events              # Game events
│  │  └─ coordinator_flag    # Who is coordinator
│  └─ input/
│     └─ [sessionId]/
│        ├─ [playerId]        # Player input packets
│        └─ ...
```

---

## Coordinator Pattern

### Coordinator Election

**Election Process**:
1. First player to create session becomes coordinator
2. Coordinator flag stored in JSON-DB
3. If coordinator disconnects, NO re-election (game ends)

```javascript
// Session creation
function createGameSession(client, sessionId, creatorId) {
    // Creator is automatically coordinator
    client.write("nba_jam", "game." + sessionId + ".coordinator", creatorId);
    
    return {
        sessionId: sessionId,
        coordinator: creatorId,
        players: [creatorId]
    };
}

// Coordinator check
function isCoordinator(client, sessionId, myId) {
    var coordId = client.read("nba_jam", "game." + sessionId + ".coordinator", 1);
    return coordId === myId;
}
```

### Coordinator Responsibilities

**GameCoordinator Class** (`lib/multiplayer/mp_coordinator.js` - 659 lines):

```javascript
class GameCoordinator {
    // 1. Run authoritative game logic
    update() {
        this.collectInputs();        // Gather all player inputs
        this.processInputs();        // Apply to sprites
        
        runGameLogic();              // Physics, AI, violations
        
        this.broadcastState();       // Send to all clients
    }
    
    // 2. Process inputs from all players
    processInputs() {
        for (var playerId in this.inputQueues) {
            var inputs = this.inputQueues[playerId];
            var sprite = this.playerSpriteMap[playerId];
            
            for (var i = 0; i < inputs.length; i++) {
                applyInput(sprite, inputs[i]);
            }
        }
    }
    
    // 3. Broadcast game state
    broadcastState() {
        var stateDTO = {
            frame: this.frameNumber,
            timestamp: Date.now(),
            scores: gameState.scores,
            timeRemaining: gameState.timeRemaining,
            players: this.serializePlayerPositions()
        };
        
        this.client.write("nba_jam", "game." + this.sessionId + ".state", stateDTO);
    }
}
```

**Update Frequency**: 20 Hz (50ms intervals)
- Matches game frame rate
- Smooth synchronization
- Reasonable bandwidth usage

---

## Session Management

### Session Lifecycle

```
1. CREATE    →  2. LOBBY    →  3. PLAYING   →  4. FINISHED
   ↓               ↓               ↓               ↓
Host creates   Players join   Game running   Cleanup
session        Select teams   State sync     Delete session
```

### Session Data Structure

**File**: `lib/multiplayer/mp_sessions.js` (298 lines)

```javascript
var session = {
    id: "session_12345",
    status: "lobby",  // "lobby", "starting", "playing", "finished"
    created: 1699305600000,
    host: "player_abc",
    
    players: {
        "player_abc": {
            globalId: "player_abc",
            displayName: "Alice",
            nodeNum: 1,
            team: "teamA",
            ready: true
        },
        "player_def": {
            globalId: "player_def",
            displayName: "Bob",
            nodeNum: 2,
            team: "teamB",
            ready: false
        }
    },
    
    teams: {
        teamA: {
            teamKey: "CHI",  // Chicago Bulls
            players: ["player_abc"],
            roster: {
                "player_abc": { index: 0 }  // Michael Jordan
            }
        },
        teamB: {
            teamKey: "LAL",  // LA Lakers
            players: ["player_def"],
            roster: {
                "player_def": { index: 0 }  // Magic Johnson
            }
        }
    },
    
    settings: {
        gameLength: 240,  // 4 minute halves
        allowSpectators: false
    }
};
```

### Session Management Functions

```javascript
// Create new session
function createGameSession(client, hostId) {
    var sessionId = "session_" + Date.now() + "_" + Math.random();
    
    var session = {
        id: sessionId,
        status: "lobby",
        created: Date.now(),
        host: hostId,
        players: {},
        teams: { teamA: {}, teamB: {} }
    };
    
    client.write("nba_jam", "lobby.sessions." + sessionId, session);
    
    return sessionId;
}

// Join existing session
function joinSession(client, sessionId, playerId) {
    var session = client.read("nba_jam", "lobby.sessions." + sessionId, 1);
    
    if (!session) return false;
    if (session.status !== "lobby") return false;
    if (Object.keys(session.players).length >= 4) return false;  // Full
    
    session.players[playerId] = {
        globalId: playerId,
        ready: false
    };
    
    client.write("nba_jam", "lobby.sessions." + sessionId, session);
    
    return true;
}

// Delete session
function deleteSession(client, sessionId) {
    client.remove("nba_jam", "lobby.sessions." + sessionId);
    client.remove("nba_jam", "game." + sessionId + ".state");
    client.remove("nba_jam", "game." + sessionId + ".coordinator");
}
```

---

## State Synchronization

### State Transfer Objects (DTOs)

**Game State DTO**:
```javascript
var gameStateDTO = {
    // Metadata
    frame: 1234,
    timestamp: 1699305612345,
    
    // Clock
    timeRemaining: 180,
    shotClock: 20,
    currentHalf: 2,
    
    // Scores
    scores: {
        teamA: 42,
        teamB: 38
    },
    
    // Possession
    currentTeam: "teamA",
    ballCarrier: "player_abc",  // globalId
    inbounding: false,
    
    // Players (positions + state)
    players: [
        {
            id: "player_abc",
            x: 50,
            y: 30,
            // Missing: velocity, animation state (bug!)
        },
        // ... other 3 players
    ],
    
    // Events since last frame
    events: [
        { type: "score", player: "player_abc", points: 2 },
        { type: "assist", player: "player_def" }
    ]
};
```

### Synchronization Flow

```
Coordinator (every 50ms):
├─ 1. Collect inputs from all players
├─ 2. Run game logic
├─ 3. Serialize state to DTO
└─ 4. Write to JSON-DB

Clients (every 50ms):
├─ 1. Read state DTO from JSON-DB
├─ 2. Apply server positions
├─ 3. Reconcile with local prediction
└─ 4. Render
```

### Bandwidth Usage

**Per Frame**:
- Game state: ~500 bytes (JSON)
- Input packets: ~100 bytes per player
- Total: ~900 bytes per frame

**Per Second**:
- 20 frames × 900 bytes = ~18 KB/s
- 4 players × 18 KB/s = ~72 KB/s total

**Reasonable** for BBS network connections.

---

## Input Handling

### Input Packet Format

```javascript
var inputPacket = {
    playerId: "player_abc",
    sequence: 1234,  // Monotonic counter
    timestamp: 1699305612345,
    frame: 1234,  // Frame number when input captured
    
    actions: {
        move: true,
        dx: 1,
        dy: 0,
        turbo: false,
        shoot: false,
        pass: false,
        steal: true,
        shove: false
    }
};
```

### Input Capture (Client)

**File**: `lib/multiplayer/mp_client.js` (387 lines)

```javascript
class PlayerClient {
    captureInput() {
        var key = console.inkey(K_NONE, 0);
        var action = parseInput(key, this.mySprite);
        
        var packet = {
            playerId: this.myId,
            sequence: this.inputSequence++,
            timestamp: Date.now(),
            frame: this.frameNumber,
            actions: action
        };
        
        // Send to server
        this.client.write("nba_jam", "game." + this.sessionId + ".input." + this.myId, packet);
        
        // Store for prediction replay
        this.sentInputs.push(packet);
    }
}
```

### Input Processing (Coordinator)

```javascript
class GameCoordinator {
    collectInputs() {
        // Collect inputs from all players
        for (var playerId in this.playerSpriteMap) {
            var inputData = this.client.read("nba_jam", "game." + this.sessionId + ".input." + playerId, 1);
            
            if (inputData && inputData.sequence > this.lastProcessedInputs[playerId]) {
                this.inputQueues[playerId].push(inputData);
                this.lastProcessedInputs[playerId] = inputData.sequence;
            }
        }
    }
    
    processInputs() {
        for (var playerId in this.inputQueues) {
            var inputs = this.inputQueues[playerId];
            var sprite = this.playerSpriteMap[playerId];
            
            for (var i = 0; i < inputs.length; i++) {
                var action = inputs[i].actions;
                
                // Apply movement
                if (action.move) {
                    sprite.x += action.dx * sprite.speed;
                    sprite.y += action.dy * sprite.speed;
                }
                
                // Apply actions
                if (action.shoot) {
                    attemptShot(sprite);
                }
                if (action.steal) {
                    attemptSteal(sprite);
                }
                // ... etc
            }
            
            // Clear processed inputs
            this.inputQueues[playerId] = [];
        }
    }
}
```

---

## Lag Compensation

### Client-Side Prediction

**Problem**: Network latency makes controls feel sluggish

**Solution**: Predict local player movement, reconcile with server

```javascript
class PlayerClient {
    update() {
        // 1. Predict my movement (instant feedback)
        if (!this.isCoordinator) {
            this.predictMyMovement();
        }
        
        // 2. Send input to server
        this.captureInput();
        
        // 3. Receive server state
        var serverState = this.receiveState();
        
        // 4. Reconcile (fix prediction errors)
        if (serverState) {
            this.reconcile(serverState);
        }
    }
    
    predictMyMovement() {
        var key = console.inkey(K_NONE, 0);
        var action = parseInput(key, this.mySprite);
        
        // Apply immediately (don't wait for server)
        if (action.move) {
            this.mySprite.x += action.dx * this.mySprite.speed;
            this.mySprite.y += action.dy * this.mySprite.speed;
        }
    }
    
    reconcile(serverState) {
        var serverPos = serverState.players[this.myId];
        
        // Calculate error
        var dx = serverPos.x - this.mySprite.x;
        var dy = serverPos.y - this.mySprite.y;
        var error = Math.sqrt(dx * dx + dy * dy);
        
        // Large error → snap to server
        if (error > 5) {
            this.mySprite.x = serverPos.x;
            this.mySprite.y = serverPos.y;
        }
        // Small error → smooth interpolation
        else {
            this.mySprite.x += dx * 0.3;
            this.mySprite.y += dy * 0.3;
        }
    }
}
```

### Input Replay (NOT IMPLEMENTED)

**Advanced Lag Compensation**: Replay inputs after reconciliation

```javascript
// POTENTIAL IMPROVEMENT
class PlayerClient {
    reconcile(serverState) {
        // 1. Snap to server position
        this.mySprite.x = serverState.players[this.myId].x;
        this.mySprite.y = serverState.players[this.myId].y;
        
        // 2. Replay inputs sent since server frame
        var serverFrame = serverState.frame;
        var replayInputs = this.sentInputs.filter(input => input.frame > serverFrame);
        
        for (var i = 0; i < replayInputs.length; i++) {
            applyInput(this.mySprite, replayInputs[i].actions);
        }
    }
}
```

**Status**: NOT IMPLEMENTED (would improve high-latency experience)

### Interpolation for Remote Players

```javascript
// Smooth remote player movement
function interpolateRemotePlayer(sprite, targetX, targetY) {
    // Linear interpolation
    sprite.x += (targetX - sprite.x) * 0.5;
    sprite.y += (targetY - sprite.y) * 0.5;
}
```

---

## Network Protocol

### Message Types

| Type | Direction | Frequency | Size | Purpose |
|------|-----------|-----------|------|---------|
| `input` | Client → Server | 20 Hz | ~100 bytes | Player actions |
| `state` | Server → Clients | 20 Hz | ~500 bytes | Game state |
| `event` | Server → Clients | On event | ~200 bytes | Scores, violations |
| `session` | Bidirectional | On change | ~1 KB | Lobby updates |

### Protocol Flow

```
Client connects:
1. Read active sessions (lobby.sessions.*)
2. Create or join session
3. Select team and roster
4. Mark ready

Game starts:
1. Coordinator elected (session creator)
2. All clients initialize sprites
3. Enter game loop

During game:
Every 50ms:
  Client:
    - Capture input
    - Write input packet
    - Read state packet
    - Reconcile position
    - Render
  
  Coordinator:
    - Read all input packets
    - Apply to sprites
    - Run game logic
    - Write state packet
    - Render

Game ends:
1. Coordinator writes final state
2. Clients display results
3. Session marked finished
4. Optional: Delete session
```

---

## Lobby System

### Lobby UI Flow

**File**: `lib/multiplayer/mp_lobby.js` (523 lines)

```
1. MAIN LOBBY
   ├─ Create Session
   ├─ Join Session
   └─ Refresh

2. SESSION LOBBY
   ├─ Team Selection
   ├─ Roster Selection
   ├─ Ready Toggle
   └─ Start Game (host only)

3. TEAM SELECTION
   ├─ Join Team A
   ├─ Join Team B
   ├─ Select Roster Spot
   └─ Back

4. GAME START
   ├─ All players ready?
   │  ├─ Yes → Start
   │  └─ No → Wait
   └─ Coordinator initializes
```

### Lobby Functions

```javascript
// Main lobby loop
function runMultiplayerLobby() {
    while (true) {
        // Display active sessions
        var sessions = getActiveSessions(client);
        displaySessionList(sessions);
        
        // Menu
        var choice = getLobbyChoice();
        
        if (choice === "create") {
            var sessionId = createGameSession(client, myId);
            return enterSessionLobby(sessionId);
        } else if (choice === "join") {
            var sessionId = selectSession(sessions);
            joinSession(client, sessionId, myId);
            return enterSessionLobby(sessionId);
        } else if (choice === "quit") {
            return null;
        }
    }
}

// Session lobby (team selection, ready up)
function enterSessionLobby(sessionId) {
    while (true) {
        var session = client.read("nba_jam", "lobby.sessions." + sessionId, 1);
        
        // Display session info
        displaySessionInfo(session);
        
        // Menu
        var choice = getSessionChoice();
        
        if (choice === "team") {
            selectTeam(session);
        } else if (choice === "ready") {
            toggleReady(session, myId);
        } else if (choice === "start" && isHost(session, myId)) {
            if (allPlayersReady(session)) {
                return startGame(session);
            }
        }
    }
}
```

---

## Performance Considerations

### Scalability

**Current Limits**:
- Max 4 players per session
- Max ~10 concurrent sessions (JSON-DB dependent)
- State update: 20 Hz (50ms)

**Bottlenecks**:
1. JSON-DB read/write latency
2. Terminal rendering speed
3. Network bandwidth

### Optimization Strategies

**1. Delta Compression** (NOT IMPLEMENTED):
```javascript
// Only send changed fields
var deltaState = {
    frame: 1234,
    changed: {
        "teamAPlayer1.x": 51,  // Changed from 50
        "scores.teamA": 43      // Changed from 42
    }
};
```

**2. Input Batching**:
```javascript
// Send multiple inputs in one packet
var batchedInputs = {
    playerId: "player_abc",
    inputs: [
        { seq: 100, frame: 100, actions: {...} },
        { seq: 101, frame: 101, actions: {...} },
        { seq: 102, frame: 102, actions: {...} }
    ]
};
```

**3. Adaptive Update Rate**:
```javascript
// Reduce update frequency on high latency
if (averageLatency > 200) {
    stateUpdateInterval = 100;  // 10 Hz
} else {
    stateUpdateInterval = 50;   // 20 Hz
}
```

---

## Known Issues

### Issue 1: No Coordinator Failover

**Problem**: If coordinator disconnects, game crashes

**Impact**: High (game unrecoverable)

**Solution**: Implement coordinator election
```javascript
function electNewCoordinator(session) {
    var activePlayers = getActivePlayers(session);
    if (activePlayers.length === 0) {
        deleteSession(session.id);
        return null;
    }
    
    // Elect player with lowest globalId (deterministic)
    activePlayers.sort((a, b) => a.globalId.localeCompare(b.globalId));
    var newCoord = activePlayers[0];
    
    client.write("nba_jam", "game." + session.id + ".coordinator", newCoord.globalId);
    
    return newCoord;
}
```

### Issue 2: Incomplete State Synchronization

**Problem**: DTO doesn't include velocity or animation state

**Impact**: Medium (rubber-banding)

**Solution**: Expand DTO
```javascript
var fullStateDTO = {
    // ... existing fields
    players: [
        {
            id: "player_abc",
            x: 50,
            y: 30,
            vx: 1.5,    // ADD: velocity
            vy: 0.5,
            state: "dribbling",  // ADD: animation state
            turboActive: true
        }
    ]
};
```

### Issue 3: Event Duplication

**Problem**: Events announced on all clients, causing spam

**Impact**: Low (cosmetic)

**Solution**: Coordinator-only event broadcasting
```javascript
// Only coordinator announces
if (coordinator.isCoordinator) {
    announceEvent("score", {...});
}

// Clients just display from DTO
var events = serverState.events;
for (var i = 0; i < events.length; i++) {
    displayEvent(events[i]);
}
```

---

## Recommendations

### High Priority
1. **Implement coordinator failover** - Prevent game crashes
2. **Expand state DTO** - Include velocity and animation
3. **Add input replay** - Better lag compensation

### Medium Priority
4. **Delta compression** - Reduce bandwidth
5. **Adaptive update rate** - Handle high latency better
6. **Event deduplication** - Prevent announcement spam

### Low Priority
7. **Spectator mode** - Watch games
8. **Reconnection support** - Handle temporary disconnects
9. **Match history** - Track past games

---

## Conclusion

**Strengths**:
- Clean coordinator pattern
- Client-side prediction works
- Reasonable bandwidth usage
- Scalable to 4 players

**Weaknesses**:
- No coordinator failover (critical)
- Incomplete state sync (causes rubber-banding)
- No input replay (lag compensation could be better)
- Event duplication

**Overall**: Multiplayer system is functional and playable for low-to-medium latency connections (<200ms). Needs coordinator failover for production reliability. Input replay would significantly improve high-latency experience.

**Recommended Next Steps**:
1. Implement coordinator failover
2. Expand state DTO
3. Add input replay buffer
