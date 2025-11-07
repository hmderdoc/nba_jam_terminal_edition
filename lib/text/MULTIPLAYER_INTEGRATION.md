# NBA JAM - Multiplayer Integration Guide

## Overview

This guide explains how to integrate the multiplayer system into the main NBA JAM game.

## Files Created

### Core System Files
- **lib/multiplayer/mp_identity.js** - Player identification across BBSes
- **lib/multiplayer/mp_config.js** - Server selection and configuration
- **lib/multiplayer/mp_network.js** - Network quality monitoring
- **lib/multiplayer/mp_sessions.js** - Session lifecycle management

### Game Files
- **lib/multiplayer/mp_lobby.js** - Multiplayer lobby with chat
- **lib/multiplayer/mp_coordinator.js** - Authoritative game coordinator
- **lib/multiplayer/mp_client.js** - Client-side prediction & reconciliation

### Configuration
- **mp_config.ini** - Server configuration (copy from .example)

### Documentation
- **MULTIPLAYER_DESIGN.md** - Complete architecture documentation
- **MULTIPLAYER_INTEGRATION.md** - This file

---

## Integration Steps

### Step 1: Add Multiplayer Option to Main Menu

Modify the main menu in `nba_jam.js` to add a multiplayer option:

```javascript
// In main menu function
console.print("\1h\1w1.\1n Single Player\r\n");
console.print("\1h\1w2.\1n Multiplayer\r\n");  // <-- ADD THIS
console.print("\1h\1w3.\1n Options\r\n");
console.print("\1h\1wQ.\1n Quit\r\n");

var choice = console.getkey();

switch (choice.toUpperCase()) {
    case '1':
        startSinglePlayer();
        break;

    case '2':  // <-- ADD THIS
        startMultiplayer();
        break;

    case '3':
        showOptions();
        break;

    case 'Q':
        return;
}
```

### Step 2: Create Multiplayer Entry Point

Add this function to `nba_jam.js`:

```javascript
load(js.exec_dir + "lib/multiplayer/mp_lobby.js");
load(js.exec_dir + "lib/multiplayer/mp_coordinator.js");
load(js.exec_dir + "lib/multiplayer/mp_client.js");

function startMultiplayer() {
    // Run lobby
    var lobbyResult = runMultiplayerLobby();

    if (!lobbyResult) {
        // User cancelled or connection failed
        return;
    }

    // Extract session info
    var sessionId = lobbyResult.sessionId;
    var session = lobbyResult.session;
    var client = lobbyResult.client;
    var myId = lobbyResult.myId;
    var serverConfig = lobbyResult.serverConfig;

    // Start multiplayer game
    runMultiplayerGame(sessionId, session, client, myId, serverConfig);
}
```

### Step 3: Create Multiplayer Game Loop

Add this function to `nba_jam.js`:

```javascript
function runMultiplayerGame(sessionId, session, client, myId, serverConfig) {
    // Initialize coordinator
    var coordinator = new GameCoordinator(sessionId, client, serverConfig);
    coordinator.init();

    // Initialize client
    var playerClient = new PlayerClient(sessionId, client, myId.globalId, serverConfig);
    playerClient.init();

    // Initialize game (similar to single-player)
    resetGameState();
    loadTeamData();
    initFrames();

    // Determine player assignments from session
    var playerAssignments = assignPlayersToSprites(session, myId);

    // Initialize sprites
    initMultiplayerSprites(session, playerAssignments);

    // Set up coordinator and client sprite mappings
    var spriteMap = createSpriteMap(session, playerAssignments);
    coordinator.setPlayerSpriteMap(spriteMap);

    // Set my sprite for client
    var mySprite = spriteMap[myId.globalId];
    playerClient.setMySprite(mySprite);

    // Main game loop
    var frameNumber = 0;
    gameState.gameRunning = true;

    while (gameState.gameRunning && !js.terminated) {
        var frameStart = Date.now();

        // Handle input
        var key = console.inkey(K_NONE, 0);
        if (key) {
            // Special keys
            if (key === 'Q' || key === 'q') {
                // Confirm quit
                if (confirmQuit()) {
                    break;
                }
            } else {
                // Send input to client for prediction
                playerClient.handleInput(key, frameNumber);
            }
        }

        // Coordinator processes inputs and updates state
        if (coordinator.isCoordinator) {
            coordinator.update();
        }

        // Client reconciles with server state
        playerClient.update(frameNumber);

        // Run game logic (physics, collisions, AI)
        // NOTE: Only coordinator runs this, but all clients render
        if (coordinator.isCoordinator) {
            updateGameLogic();
        }

        // Update visuals
        updateAnnouncer();
        drawCourt();
        drawScore();

        // Draw network quality HUD
        drawNetworkHUD(playerClient);

        // Sprite cycle
        Sprite.cycle();

        // Frame timing (30 FPS)
        var frameTime = Date.now() - frameStart;
        var targetFrameTime = 33; // ~30 FPS
        if (frameTime < targetFrameTime) {
            mswait(targetFrameTime - frameTime);
        }

        frameNumber++;
    }

    // Cleanup
    coordinator.cleanup();
    playerClient.cleanup();
    cleanupSprites();
}
```

### Step 4: Player Assignment

Add this helper function:

```javascript
function assignPlayersToSprites(session, myId) {
    // Determine which sprite each player controls
    var assignments = {
        redPlayer1: null,
        redPlayer2: null,
        bluePlayer1: null,
        bluePlayer2: null
    };

    // Assign based on team selections from session
    var redPlayers = session.teams.red.players || [];
    var bluePlayers = session.teams.blue.players || [];

    // Red team
    if (redPlayers.length > 0) {
        assignments.redPlayer1 = redPlayers[0];
    }
    if (redPlayers.length > 1) {
        assignments.redPlayer2 = redPlayers[1];
    }

    // Blue team
    if (bluePlayers.length > 0) {
        assignments.bluePlayer1 = bluePlayers[0];
    }
    if (bluePlayers.length > 1) {
        assignments.bluePlayer2 = bluePlayers[1];
    }

    return assignments;
}
```

### Step 5: Sprite Mapping

Add this helper function:

```javascript
function createSpriteMap(session, assignments) {
    var map = {};

    // Map global player IDs to sprite references
    if (assignments.redPlayer1) {
        map[assignments.redPlayer1] = redPlayer1;
    }
    if (assignments.redPlayer2) {
        map[assignments.redPlayer2] = redPlayer2;
    }
    if (assignments.bluePlayer1) {
        map[assignments.bluePlayer1] = bluePlayer1;
    }
    if (assignments.bluePlayer2) {
        map[assignments.bluePlayer2] = bluePlayer2;
    }

    return map;
}
```

### Step 6: Network HUD

Add this to display network quality:

```javascript
function drawNetworkHUD(playerClient) {
    var display = playerClient.getNetworkDisplay();
    if (!display) return;

    // Draw in top-right corner of score frame
    if (scoreFrame) {
        scoreFrame.gotoxy(60, 1);
        scoreFrame.putmsg(format("NET: %s%s %dms\1n",
            display.color,
            display.bars,
            display.latency), WHITE | BG_BLACK);
    }
}
```

### Step 7: Multiplayer Sprite Initialization

Modify `initSprites` or create new version:

```javascript
function initMultiplayerSprites(session, assignments) {
    // Similar to initSprites but:
    // 1. Only initialize sprites that have players assigned
    // 2. Mark sprites as human/AI based on assignments
    // 3. Set isHuman flag for sprites controlled by players

    var myId = createPlayerIdentifier();

    // Red Player 1
    if (assignments.redPlayer1) {
        var isHuman = (assignments.redPlayer1 === myId.globalId);
        // Initialize redPlayer1 sprite
        // redPlayer1.isHuman = isHuman;
    }

    // Repeat for all four players...
}
```

---

## Testing Procedure

### Local Testing (Same BBS)

1. **Start JSON Service** (if not already running):
   ```bash
   cd /sbbs/exec
   jsexec json-service.js &
   ```

2. **Open two terminals to your BBS**:
   - Terminal 1: Log in as User 1
   - Terminal 2: Log in as User 2

3. **Terminal 1**:
   - Run NBA JAM
   - Select "Multiplayer"
   - Select "Local BBS" server
   - Create new game
   - Select team
   - Ready up

4. **Terminal 2**:
   - Run NBA JAM
   - Select "Multiplayer"
   - Select "Local BBS" server
   - Join game created by User 1
   - Select opposite team
   - Ready up

5. **Game should start!**

### Inter-BBS Testing (Two BBSes on LAN)

1. **BBS 1 (Host)**:
   - Make sure JSON service is running
   - Make sure port 10088 is accessible from BBS 2

2. **BBS 2 (Client)**:
   - Create `mp_config.ini`:
     ```ini
     [test_server]
     name=Test Server
     addr=192.168.1.100  # IP of BBS 1
     port=10088
     ```

3. **Follow same testing procedure as local, but**:
   - User on BBS 2 selects "Custom Server" or "test_server"
   - Should connect to BBS 1's JSON service
   - Both users join same session

---

## Configuration

### mp_config.ini

Copy `mp_config.ini.example` to `mp_config.ini` and customize:

```ini
# Local server
[local]
name=Local BBS
addr=localhost
port=10088

# Your BBS as server
[myserver]
name=My BBS
addr=mybbs.synchro.net
port=10088
description=Inter-BBS games hosted by my BBS

# Dedicated server (future)
[dedicated]
name=NBA JAM Central
addr=nbajam.example.com
port=10088
```

---

## Troubleshooting

### "Connection failed"

- Check that JSON service is running: `jsexec json-service.js`
- Check firewall allows port 10088
- Verify server address is correct

### "Game session disappeared"

- Coordinator may have disconnected
- Check coordinator election is working
- Verify session timeout settings

### "High latency / lag"

- Check network connection
- Game will auto-adapt to slower connections
- Consider using different server closer to players

### "Players out of sync"

- Coordinator should reconcile automatically
- Check that state updates are being sent
- Verify both clients are receiving state updates

### "Input not responding"

- Check input buffer is flushing
- Verify coordinator is processing inputs
- Check client-side prediction is enabled

---

## Performance Tuning

### Adjusting Update Rates

In `mp_config.js`, modify tuning values:

```javascript
tuning: {
    local: {
        inputFlushInterval: 33,      // Lower = more responsive
        stateUpdateInterval: 50,     // Lower = smoother sync
        reconciliationStrength: 0.5  // Higher = faster correction
    }
}
```

### Bandwidth Optimization

- State updates are already delta-compressed
- Input batching reduces network calls
- Consider increasing flush intervals for slow connections

---

## Known Limitations

1. **4 Player Maximum** - Current design supports up to 4 players (2v2)
2. **No Mid-Game Join** - Players must join before game starts
3. **No Spectators Yet** - Spectator mode not implemented
4. **CPU Players Not Synced** - AI-controlled players run independently on each client

---

## Future Enhancements

1. **Spectator Mode** - Allow read-only observers
2. **Replay Recording** - Record input stream for replays
3. **Tournament Mode** - Bracket management across BBSes
4. **Better Team Select** - Full roster selection UI
5. **Voice Chat** - Integrate with Synchronet voice bridge

---

## Questions?

Check the main documentation: **MULTIPLAYER_DESIGN.md**

Or reach out to the Synchronet community!
