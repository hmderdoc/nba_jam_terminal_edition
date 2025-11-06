# NBA JAM - Multiplayer Architecture Design

## Overview

NBA JAM multiplayer is designed to support both **same-BBS** and **inter-BBS** play using Synchronet's JSON-Client infrastructure. The architecture prioritizes real-time gameplay while maintaining flexibility for various network conditions.

## Key Design Principles

1. **Real-Time First** - Minimize latency, maximize responsiveness
2. **Inter-BBS Ready** - Works across BBSes from day one
3. **Graceful Degradation** - Adapts to network quality
4. **Secure By Design** - Player isolation, validation, session management
5. **Flexible Hosting** - Local BBS, dedicated server, or peer-to-peer

---

## Architecture Components

### 1. Identity System (`mp_identity.js`)

Handles player identification across BBS boundaries:

```
Player ID Format:
  VERT_1234
  ^^^^  ^^^^
  BBS   User Number
  QWK   on that BBS
  ID
```

**Features**:
- Global player IDs (BBS + UserNum)
- Local vs. remote player detection
- Display name formatting with BBS tags
- Compatible with QWK network IDs

### 2. Configuration System (`mp_config.js`)

Server selection and network tuning:

```
Server Types:
  - Local: localhost (same BBS only)
  - Inter-BBS: Shared JSON server
  - Custom: User-defined server

Configuration:
  - Servers defined in mp_config.ini
  - Auto-detection of best server
  - Latency-based tuning
  - User preferences saved
```

### 3. Network Monitoring (`mp_network.js`)

Real-time quality monitoring and adaptation:

```
Metrics Tracked:
  - Latency (min/avg/max)
  - Jitter (latency variance)
  - Packet loss
  - Bandwidth usage

Adaptive Tuning:
  Excellent (<50ms)  → 30 FPS inputs, 20 FPS state
  Good (50-100ms)    → 20 FPS inputs, 13 FPS state
  Fair (100-200ms)   → 13 FPS inputs, 10 FPS state
  Poor (200-350ms)   → 10 FPS inputs, 6 FPS state
  Unplayable (>350ms)→ Warning displayed
```

### 4. Session Management (`mp_sessions.js`)

Game session lifecycle:

```
Session States:
  WAITING   → Lobby, accepting players
  READY     → All players ready, about to start
  PLAYING   → Game in progress
  PAUSED    → Game paused (player disconnect, etc.)
  FINISHED  → Game completed

Session Discovery:
  - Global session list in JSON-DB
  - Filter by status, player count, etc.
  - Private sessions with passwords
  - Auto-cleanup of old sessions
```

---

## Data Flow Architecture

### Player Input → Coordinator → All Clients

```
Player Node 1              JSON-DB Server           Player Node 2
(Red Team)                                          (Blue Team)
─────────────────────────────────────────────────────────────────

1. Input Phase
   [Keypress]
      ↓
   Buffer inputs (50ms)
      ↓
   Write batch to:
   inputs.VERT_1 ──────→ [inputs.VERT_1]
                                ↓
                         Coordinator reads all
                         input queues:
                           - inputs.VERT_1
                           - inputs.SYNC_5 ────← [inputs.SYNC_5]
                                                      ↑
                                                   Buffer inputs
                                                      ↑
                                                  [Keypress]

2. Simulation Phase (Coordinator Only)
   Process inputs
   Run game logic
   Physics/collisions
   AI updates
      ↓
   Create state delta
      ↓
   Write to shared state
   [game.session.state] ←─

3. Reconciliation Phase
   Read state ──────────→ [game.session.state] ──────→ Read state
      ↓                                                     ↓
   Reconcile position                              Reconcile position
   Smooth interpolation                            Smooth interpolation
      ↓                                                     ↓
   Render frame                                    Render frame
```

---

## Inter-BBS Deployment Scenarios

### Scenario 1: Single Host BBS

```
┌─────────────────────────────┐
│  Vertrauen BBS              │
│  - JSON Service (port 10088)│
│  - Hosts game sessions      │
│  - Players: vert.synchro.net│
└─────────────────────────────┘
            ↑
            │ TCP/IP
    ┌───────┼───────┬───────┐
    │       │       │       │
┌───▼───┐ ┌─▼───┐ ┌─▼───┐ ┌─▼───┐
│ BBS 1 │ │BBS 2│ │BBS 3│ │BBS 4│
│connect│ │conn │ │conn │ │conn │
│  as   │ │ as  │ │ as  │ │ as  │
│client │ │clnt │ │clnt │ │clnt │
└───────┘ └─────┘ └─────┘ └─────┘
```

**Pros**:
- Simple setup
- One admin controls server
- Easy to manage

**Cons**:
- Single point of failure
- Host has latency advantage
- Requires host BBS to be always online

### Scenario 2: Dedicated Server

```
┌──────────────────────────────┐
│  Dedicated VPS/Cloud Server  │
│  - ONLY JSON service         │
│  - No BBS software           │
│  - Neutral location          │
│  - nbajam.synchro.net:10088  │
└──────────────────────────────┘
            ↑
            │ Internet
    ┌───────┼───────┬───────┐
    │       │       │       │
┌───▼───┐ ┌─▼───┐ ┌─▼───┐ ┌─▼───┐
│Vertr. │ │ BBS2│ │ BBS3│ │ BBS4│
│ BBS   │ │     │ │     │ │     │
└───────┘ └─────┘ └─────┘ └─────┘
```

**Pros**:
- Neutral ground (fair latency)
- Dedicated resources
- Professional uptime
- No BBS favoritism

**Cons**:
- Costs money to host
- Needs management
- Extra infrastructure

### Scenario 3: Peer Hosting (Current Recommended)

```
Each BBS can host its own games
Players choose which server to use

┌─────────┐       ┌─────────┐
│  BBS 1  │       │  BBS 2  │
│ hosting │       │ hosting │
│ Game A  │       │ Game B  │
└─────────┘       └─────────┘
     ↑                 ↑
     │                 │
  ┌──┴─┐            ┌──┴─┐
  │P1  │            │P3  │
  │P2  │            │P4  │
  └────┘            └────┘
```

**Pros**:
- Distributed load
- No central dependency
- Each sysop controls their games
- Easy to start

**Cons**:
- Fragmented player base
- Host has latency advantage
- Coordination needed

---

## Security Considerations

### 1. Session Isolation

```javascript
// Each session has unique namespace
"nba_jam.game.VERT_123456_1.state"
           ^^^^^^^^^^^^^^^^^^^
           Session ID (unique)

// Players can only access their session
client.subscribe("nba_jam", "game." + mySessionId + ".state");
```

### 2. Input Validation

```javascript
// Coordinator validates all inputs
function validateInput(input, playerId) {
    // 1. Is this player in the session?
    if (!session.players[playerId]) return false;

    // 2. Is timestamp reasonable?
    var age = Date.now() - input.timestamp;
    if (age < 0 || age > 5000) return false;

    // 3. Is sequence number valid?
    if (input.seq <= lastProcessed[playerId]) return false;

    // 4. Is key code valid?
    var validKeys = [KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, /* ... */];
    if (validKeys.indexOf(input.key) === -1) return false;

    return true;
}
```

### 3. Write Separation

```javascript
// Each player writes to their OWN queue
// No shared write location = no contention

Player 1 writes: "game.session.inputs.VERT_1"
Player 2 writes: "game.session.inputs.SYNC_5"
Player 3 writes: "game.session.inputs.DOBA_9"

Coordinator writes: "game.session.state"  (only coordinator)

// No two players write to same location
```

### 4. Coordinator Authority

```javascript
// Coordinator is authoritative
// Clients predict locally, but server decides

Client says: "I shot a 3-pointer and made it!"
Coordinator: "Actually, defender blocked it. Here's real state."
Client: "OK, correcting my display..."

// Prevents cheating through client modification
```

---

## Network Optimizations

### 1. Input Batching

Instead of:
```
Frame 1: Write input → 30ms
Frame 2: Write input → 30ms
Frame 3: Write input → 30ms
= 90ms total, 3 network calls
```

We do:
```
Frame 1: Buffer input
Frame 2: Buffer input
Frame 3: Buffer input + Flush batch → 30ms
= 30ms total, 1 network call
```

### 2. Delta Compression

Instead of:
```javascript
// Full state (large)
{
    redPlayer1: { x: 45, y: 12, bearing: "e", turbo: 35, ... },
    redPlayer2: { x: 50, y: 15, bearing: "e", turbo: 42, ... },
    ...
    score: { red: 24, blue: 18 },
    clock: 145,
    ...
}
```

We send:
```javascript
// Delta (small)
{
    p: [                    // Player positions only
        { x: 45, y: 12 },   // Red1
        { x: 50, y: 15 },   // Red2
        { x: 30, y: 10 },   // Blue1
        { x: 28, y: 14 }    // Blue2
    ],
    b: { x: 46, y: 13 },   // Ball position
    c: 145                  // Clock (if changed)
}
```

### 3. Adaptive Update Rates

```javascript
// Adjust based on measured latency
if (latency < 50) {
    inputRate = 30;   // 30 FPS
    stateRate = 20;   // 20 FPS
} else if (latency < 150) {
    inputRate = 20;   // 20 FPS
    stateRate = 10;   // 10 FPS
} else {
    inputRate = 10;   // 10 FPS
    stateRate = 6;    // 6 FPS (slideshow mode)
}
```

---

## Client-Side Prediction

### How It Works

```
Frame 10: Player presses RIGHT
          ↓
          Apply input locally (instant response)
          Player sprite moves right on screen
          Buffer input for server
          ↓
Frame 15: Send batched inputs to server
          ↓
Frame 20: Server processes inputs
          Calculates authoritative position
          Sends state update
          ↓
Frame 25: Client receives state update
          Compare: My predicted position vs. Server position
          ↓
          IF close (< 3 units):
              Smooth interpolate to server position
          ELSE:
              Snap to server position (big misprediction)
```

### Why This Matters

**Without prediction**:
```
Player: *presses RIGHT*
... 100ms later ...
Sprite: *finally moves*
Player: "This feels laggy!"
```

**With prediction**:
```
Player: *presses RIGHT*
Sprite: *moves immediately*
... 100ms later ...
Server: "Position confirmed" (or slight correction)
Player: "This feels responsive!"
```

---

## JSON-DB Data Structure

```
nba_jam/
├── lobby/
│   ├── sessions/
│   │   ├── VERT_123456_1/
│   │   │   ├── (session metadata)
│   │   │   └── chat/
│   │   │       └── (array of messages)
│   │   └── SYNC_789012_5/
│   │       └── ...
│   └── players/
│       └── (global player registry)
│
└── game/
    ├── VERT_123456_1/
    │   ├── meta/           (session info)
    │   ├── state/          (current game state)
    │   ├── inputs/
    │   │   ├── VERT_1      (player 1 input queue)
    │   │   ├── SYNC_5      (player 2 input queue)
    │   │   ├── DOBA_9      (player 3 input queue)
    │   │   └── VERT_2      (player 4 input queue)
    │   └── events/         (scores, dunks, etc.)
    └── SYNC_789012_5/
        └── ...
```

---

## Configuration Example

**File: `mp_config.ini`**

```ini
# Local BBS
[local]
name=Local Games Only
addr=localhost
port=10088
description=Play with users on this BBS

# Vertrauen (example inter-BBS host)
[vertrauen]
name=Vertrauen BBS
addr=vert.synchro.net
port=10088
description=Inter-BBS games hosted by Vertrauen

# Dedicated server (future)
[dedicated]
name=NBA JAM Central
addr=nbajam.synchro.net
port=10088
description=Dedicated game server (low latency)
```

---

## Performance Targets

| Network Quality | Latency | Input Rate | State Rate | Playability |
|----------------|---------|------------|------------|-------------|
| Excellent      | < 50ms  | 30 FPS     | 20 FPS     | Perfect     |
| Good           | 50-100  | 20 FPS     | 13 FPS     | Great       |
| Fair           | 100-200 | 13 FPS     | 10 FPS     | Acceptable  |
| Poor           | 200-350 | 10 FPS     | 6 FPS      | Playable    |
| Unplayable     | > 350ms | —          | —          | Warning     |

---

## Future Enhancements

1. **Spectator Mode**
   - Read-only clients watching games
   - Lower bandwidth requirements
   - Chat integration

2. **Replay System**
   - Record all inputs
   - Deterministic replay
   - Share replays between BBSes

3. **Tournaments**
   - Bracket management
   - Scheduled matches
   - Leaderboards across BBSes

4. **Voice Chat Integration**
   - Synchronet voice bridge
   - Push-to-talk
   - Team channels

5. **Anti-Cheat**
   - Input validation
   - State verification
   - Anomaly detection

---

## Testing Strategy

### Phase 1: Local Testing
- Two nodes on same BBS
- Test input sync, state updates
- Measure performance baseline

### Phase 2: LAN Testing
- Two BBSes on local network
- Simulate inter-BBS with low latency
- Test session discovery

### Phase 3: WAN Testing
- BBSes over internet
- Test with real latency (50-200ms)
- Adaptive tuning validation

### Phase 4: Stress Testing
- 4 players from 4 different BBSes
- Multiple concurrent games
- Load testing JSON service

---

## Developer Notes

**Key Files**:
- `mp_identity.js` - Player ID system
- `mp_config.js` - Server configuration
- `mp_network.js` - Quality monitoring
- `mp_sessions.js` - Session management
- `mp_lobby.js` - Lobby UI (TBD)
- `mp_game.js` - Multiplayer game loop (TBD)

**Integration Points**:
- Modify `nba_jam.js` main menu to add multiplayer option
- Create new game loop for multiplayer (parallel to single-player)
- Integrate coordinator/client classes
- Add network HUD to existing scoreboard

**JSON Service Requirements**:
- Must be running (`jsexec json-service.js`)
- Default port: 10088
- Can run on any Synchronet BBS or standalone

---

## Questions & Answers

**Q: Does this work between different BBS software?**
A: No, it requires Synchronet's JSON service. But any Synchronet BBS can participate.

**Q: Can players on dial-up play?**
A: Technically yes, but quality will be "Poor" or "Unplayable". Broadband recommended.

**Q: What if the coordinator disconnects mid-game?**
A: New coordinator is elected from remaining players. Game continues.

**Q: How much bandwidth does this use?**
A: Roughly 5-10 KB/sec per player (both up and down). Very light.

**Q: Can I host my own dedicated server?**
A: Yes! Just run Synchronet with JSON service on a VPS. No BBS required.

**Q: What about cheating?**
A: Coordinator validates all actions. Client prediction is just visual.

**Q: Does this support 1v1, 3v3, etc?**
A: Architecture supports 1-4 players. Game logic is currently 2v2 but can be adapted.

---

*Last Updated: 2025-11-03*
*Version: 1.0 - Initial Design*
