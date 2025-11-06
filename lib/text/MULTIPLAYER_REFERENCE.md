# NBA JAM Multiplayer - Quick Reference Card

## For Players

### How to Play Multiplayer

1. Select **"2. Multiplayer (Online)"** from main menu
2. Choose server (Local BBS for same-BBS play)
3. **Create** game (C) or **Join** existing (arrow keys + J)
4. Chat while waiting
5. **Ready up** (R) when ready to play
6. Game starts when all players ready!

### Lobby Controls

| Key | Action |
|-----|--------|
| **C** | Create new game |
| **J** | Join selected game |
| **↑↓** | Navigate game list |
| **R** | Toggle ready status |
| **T** | Team selection (future) |
| **L** | Leave game |
| **Enter** | Send chat message |
| **Q** | Quit to main menu |

### In-Game

- Same controls as single-player
- **Q** to quit (with confirmation)
- Network quality shown in top-right corner

### Network Quality Indicators

```
●●●●● <50ms   Excellent (arcade-perfect)
●●●●○ 50-80ms  Good (smooth)
●●●○○ 80-150ms Fair (playable)
●●○○○ 150-250ms Poor (noticeable lag)
●○○○○ >250ms   Bad (slideshow)
```

---

## For Sysops

### Quick Setup (Local BBS Only)

1. **Start JSON service**:
   ```bash
   cd /sbbs/exec
   jsexec json-service.js &
   ```

2. **Done!** Players can now play multiplayer locally.

### Quick Setup (Inter-BBS Host)

1. **Start JSON service** (as above)

2. **Open firewall port 10088**:
   ```bash
   # Example for iptables
   iptables -A INPUT -p tcp --dport 10088 -j ACCEPT
   ```

3. **Share your server info**:
   ```
   Server: yourbbs.synchro.net
   Port: 10088
   ```

4. **Other sysops configure mp_config.ini**:
   ```ini
   [your_bbs]
   name=Your BBS Name
   addr=yourbbs.synchro.net
   port=10088
   ```

### Quick Setup (Inter-BBS Client)

1. **Create mp_config.ini**:
   ```bash
   cd /sbbs/xtrn/nba_jam
   cp mp_config.ini.example mp_config.ini
   nano mp_config.ini
   ```

2. **Add remote server**:
   ```ini
   [remote_bbs]
   name=Remote BBS
   addr=remotebbs.synchro.net
   port=10088
   description=Games hosted by Remote BBS
   ```

3. **Done!** Players select remote server in lobby.

### Files Checklist

Required files in `/sbbs/xtrn/nba_jam/`:
```
✓ nba_jam.js             (main game - modified)
✓ mp_identity.js         (player IDs)
✓ mp_config.js           (server config)
✓ mp_network.js          (network monitoring)
✓ mp_sessions.js         (session management)
✓ mp_lobby.js            (lobby UI)
✓ mp_coordinator.js      (game coordinator)
✓ mp_client.js           (client prediction)
```

Optional:
```
□ mp_config.ini          (custom servers)
□ mp_lobby.ans           (custom lobby graphics)
```

### Troubleshooting Commands

**Check JSON service**:
```bash
ps aux | grep json-service
netstat -an | grep 10088
```

**Test connection**:
```bash
telnet localhost 10088
# Should connect (Ctrl+] then quit to exit)
```

**View logs**:
```bash
tail -f /sbbs/data/logs/error.log
```

**Restart JSON service**:
```bash
killall jsexec
cd /sbbs/exec
jsexec json-service.js &
```

---

## For Developers

### Architecture at a Glance

```javascript
// Multiplayer entry point
function runMultiplayerMode() {
    lobbyResult = runMultiplayerLobby();      // 1. Lobby
    coordinator = new GameCoordinator(...);    // 2. Coordinator
    playerClient = new PlayerClient(...);      // 3. Client
    runMultiplayerGameLoop(...);               // 4. Game loop
}

// Game loop structure
while (gameRunning) {
    // Input → Prediction
    playerClient.handleInput(key, frame);

    // Coordinator → Process → Broadcast
    if (isCoordinator) {
        coordinator.update();
    }

    // Client → Reconcile
    playerClient.update(frame);

    // All → Render
    drawCourt();
    drawScore();
}
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `runMultiplayerLobby()` | Entry to lobby, returns session |
| `GameCoordinator.update()` | Collect inputs, process, broadcast |
| `PlayerClient.handleInput()` | Predict + buffer input |
| `PlayerClient.update()` | Reconcile with server state |
| `assignMultiplayerPlayers()` | Map players to sprites |
| `createMultiplayerSpriteMap()` | Global ID → sprite mapping |

### Data Flow

```
Input → Buffer → Flush (50ms) → JSON-DB
                                    ↓
                            Coordinator reads
                                    ↓
                            Process + Physics
                                    ↓
                            Broadcast state (100ms)
                                    ↓
                            JSON-DB → All clients
                                    ↓
                            Reconcile + Render
```

### Extending

**Add new server**:
```javascript
// In mp_config.js
MP_CONFIG.servers.myserver = {
    name: "My Server",
    addr: "myserver.com",
    port: 10088,
    description: "My description"
};
```

**Custom lobby graphics**:
```bash
# Create mp_lobby.ans (80x24 ANSI)
# Lobby will auto-load if exists
```

**Add game events**:
```javascript
// In coordinator
coordinator.broadcastEvent("custom_event", {
    data: "event data"
});

// In client
playerClient.handleEvent = function(event) {
    if (event.type === "custom_event") {
        // Handle it
    }
};
```

---

## Performance Tuning

### Network Settings

Edit tuning in `mp_config.js`:

```javascript
tuning: {
    local: {
        inputFlushInterval: 33,    // Lower = more responsive
        stateUpdateInterval: 50,   // Lower = smoother sync
        reconciliationStrength: 0.5 // Higher = faster correction
    }
}
```

### Recommended Values

| Latency | Input (ms) | State (ms) | Strength |
|---------|-----------|-----------|----------|
| <30ms   | 33 (30fps)| 50 (20fps)| 0.6      |
| 30-100  | 50 (20fps)| 75 (13fps)| 0.4      |
| 100-200 | 75 (13fps)| 100 (10fps)| 0.3     |
| 200+    | 100 (10fps)| 150 (6fps)| 0.2     |

### Bandwidth Usage

Per player (both upload + download):
- Excellent: ~8-10 KB/sec
- Good: ~5-7 KB/sec
- Fair: ~3-5 KB/sec
- Poor: ~2-3 KB/sec

Very light! Works fine on broadband, acceptable on DSL.

---

## Security Notes

✅ **Built-in**:
- Session isolation (players can't access other games)
- Input validation (coordinator checks all inputs)
- Timestamp validation (rejects old/future inputs)
- Write separation (no contention, no race conditions)
- Authoritative server (coordinator has final say)

⚠️ **Recommendations**:
- Run JSON service in sandbox if possible
- Monitor for abuse (session spam, etc.)
- Consider rate limiting at firewall level
- Keep Synchronet updated

---

## FAQ

**Q: Does this work across different BBS software?**
A: No, requires Synchronet. But any Synchronet BBS can join.

**Q: Can dial-up users play?**
A: Technically yes, but quality will be Poor/Bad. Broadband recommended.

**Q: What happens if coordinator disconnects?**
A: New coordinator auto-elected. Game may hiccup but continues.

**Q: How many players?**
A: Currently 2-4 players (2v2). Architecture can support more.

**Q: Can I watch games as spectator?**
A: Not yet implemented, but architecture supports it.

**Q: Does this work with mods?**
A: Yes! As long as game logic is in coordinator.update().

**Q: Can I run dedicated server?**
A: Yes! Just run Synchronet with JSON service on VPS.

---

## Support & Resources

**Documentation**:
- [MULTIPLAYER_DESIGN.md](MULTIPLAYER_DESIGN.md) - Full architecture
- [MULTIPLAYER_INTEGRATION.md](MULTIPLAYER_INTEGRATION.md) - Integration details
- [MULTIPLAYER_QUICKSTART.md](MULTIPLAYER_QUICKSTART.md) - Getting started
- [INTEGRATION_COMPLETE.md](INTEGRATION_COMPLETE.md) - What was done

**Community**:
- Synchronet DOVE-Net
- Synchronet Discord
- GitHub Issues

**Logs**:
- `/sbbs/data/logs/error.log` - Error log
- Console output during execution

---

## Quick Cheat Sheet

### Player Workflow
```
Main Menu → Multiplayer → Select Server →
Lobby (Create/Join) → Ready → Play!
```

### Sysop Workflow
```
Start JSON service → Open port 10088 →
Share server info → Players connect!
```

### Developer Workflow
```
Lobby returns session → Init coordinator & client →
Game loop (coordinator processes, client predicts) →
Reconcile & render → Cleanup
```

---

*Version 1.0 - Multiplayer Integration Complete*
*Last Updated: 2025-11-03*
