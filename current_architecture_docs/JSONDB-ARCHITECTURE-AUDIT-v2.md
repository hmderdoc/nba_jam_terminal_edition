# JSON-DB Architecture Audit Report v2
**Date:** December 21, 2025  
**Branch:** `jsondb_architecture_audit`  
**Auditor:** Copilot at user request  
**Reference:** Synchronet's `json-chat.js` as canonical JSONClient usage pattern

---

## Executive Summary

LORB's JSONClient usage is **architecturally wrong**. After studying `json-chat.js` (the canonical reference written by the same author as `json-client.js`), it's clear that LORB is using JSONClient as a request/response polling system when it's designed as a **publish/subscribe system**.

### The Core Problem

| What JSONChat Does (CORRECT) | What LORB Does (WRONG) |
|------------------------------|------------------------|
| Subscribe once, receive updates via callback | Poll repeatedly with blocking reads |
| `cycle()` only drains already-received packets | `cycle()` triggers new network operations |
| Never calls `client.read()` in loops | Calls `client.read()` every 2-15 seconds |
| Data arrives passively via subscriptions | Data is actively fetched, blocking each time |
| `TIMEOUT = -1` (default, fire-and-forget) | `TIMEOUT = 500-2000ms` (blocking) |

### Impact

Every time LORB checks for challenges or presence, it does a **blocking read**. This happens:
- Every 100ms in the input loop (via `onIdle` → `cycle()` → `pollOnDemand()`)
- Rate-limited to every 2 seconds, but still blocks for 500ms each time
- During this 500ms, the input loop cannot process keystrokes

The user experiences this as the BBS being "frozen" or unresponsive.

---

## How JSONClient Is Designed To Work

### The Correct Pattern (from json-chat.js)

```javascript
// 1. SUBSCRIBE ONCE to paths you care about
this.client.subscribe("chat", "channels." + channelName + ".messages");

// 2. SET A CALLBACK to handle incoming updates
this.client.callback = function(packet) {
    // Handle UPDATE packets from subscriptions
    self.update(packet);
};

// 3. CYCLE frequently but NON-BLOCKING - just drains the queue
this.cycle = function() {
    this.client.cycle();  // Processes already-received packets
    while(this.client.updates.length)
        this.update(this.client.updates.shift());
    // ... update views ...
}

// 4. WRITES are fire-and-forget with inline lock
this.client.write("chat", "channels." + chan.name + ".messages", message, 2);
// The '2' is LOCK_WRITE - server does atomic lock→write→unlock→notify subscribers

// 5. READS are rare and only for initial data fetch (e.g., history on join)
var history = this.client.slice("chat", "channels." + target + ".history", index, undefined, 1);
```

### Key Insights

1. **Subscriptions are the data source** - You subscribe to a path, and the server pushes updates to you. You don't poll.

2. **`client.cycle()` is non-blocking** - It just checks if data arrived and dispatches it. It does NOT make network requests.

3. **`client.updates[]` is the queue** - If no callback is set, packets queue here. You drain this queue, not the network.

4. **`client.read()` is blocking and should be rare** - Only use for one-time initial data fetch, not in loops.

5. **`TIMEOUT = -1` is the default** - This means fire-and-forget. Writes don't wait for confirmation.

---

## What LORB Is Doing Wrong

### Problem 1: USE_SUBSCRIPTIONS = false

```javascript
// config.js line ~57
USE_SUBSCRIPTIONS: false  // This defeats the entire architecture!
```

With subscriptions disabled, LORB falls back to **polling mode**, which means it calls `client.read()` repeatedly instead of receiving updates via callbacks.

### Problem 2: pollOnDemand() Does Blocking Reads

```javascript
// challenges_pubsub.js lines 315-350
function pollOnDemand(ctx) {
    // ...
    client.settings.TIMEOUT = 500;  // Set 500ms timeout
    
    // BLOCKING READ - waits up to 500ms for response
    var challenges = client.read(DB_SCOPE, bucketPath(gid), 1);
    
    // ANOTHER BLOCKING READ
    var presence = client.read(DB_SCOPE, PRESENCE_ROOT, 1);
    
    client.settings.TIMEOUT = oldTimeout;  // Restore
}
```

### Problem 3: listIncoming/listOutgoing Trigger Polling

```javascript
// challenges_pubsub.js lines 656-667
function listIncoming(ctx) {
    var c = ensureClient(ctx);
    if (!c) return [];
    subscribeForPlayer(ctx);
    
    // THIS TRIGGERS BLOCKING READS!
    if (!useSubscriptions()) {
        pollOnDemand(ctx);  // 500ms+ blocking
    }
    // ...
}
```

### Problem 4: ChallengeService.getIncoming() Calls listIncoming()

```javascript
// challenge_service.js lines 102-108
function getIncoming() {
    // ...
    var result = Challenges.listIncoming(serviceCtx);  // Triggers poll!
    // ...
}
```

### Problem 5: Hub Input Loop Calls getIncoming() Frequently

```javascript
// hub.js line ~104
function getFirstIncomingChallenge(ctx) {
    // ...
    if (LORB.Multiplayer.ChallengeService.cycle) {
        LORB.Multiplayer.ChallengeService.cycle();  // Triggers poll every 15s
    }
    var incoming = LORB.Multiplayer.ChallengeService.getIncoming();  // Triggers poll!
    // ...
}

// hub.js lines 999-1009 - Called every 100ms when idle!
var onIdleCallback = function(richView, lb) {
    LORB.Multiplayer.ChallengeService.cycle();  // Can trigger poll
    // ...
};
```

### The Chain of Blocking

```
Input Loop (100ms tick)
    → onIdleCallback()
        → ChallengeService.cycle()
            → Challenges.cycle()
                → [every 15s] pollOnDemand()
                    → client.read() [BLOCKS 500ms]
                    → client.read() [BLOCKS 500ms]
                    
Hub Menu Redraw
    → getFirstIncomingChallenge()
        → ChallengeService.getIncoming()
            → Challenges.listIncoming()
                → pollOnDemand()
                    → client.read() [BLOCKS 500ms]
                    → client.read() [BLOCKS 500ms]
```

---

## The Fix: Adopt JSONChat's Pattern

### Phase 1: Enable Subscriptions (Required)

```javascript
// config.js
USE_SUBSCRIPTIONS: true  // Enable the correct architecture
```

### Phase 2: Refactor challenges_pubsub.js

**2a. Subscribe on connect, not on every operation**

```javascript
function ensureClient(ctx) {
    // ... existing connection code ...
    
    if (client && client.connected && !subscribed) {
        // Subscribe ONCE to our paths
        var gid = getGlobalIdFromCtx(ctx);
        if (gid) {
            client.subscribe(DB_SCOPE, bucketPath(gid));
            client.subscribe(DB_SCOPE, PRESENCE_ROOT);
            subscribed = true;
        }
        
        // Set callback for real-time updates
        client.callback = handleUpdate;
    }
    
    return client;
}
```

**2b. Make cycle() truly non-blocking**

```javascript
function cycle() {
    if (!client || !client.connected) return;
    
    // ONLY drain already-received packets - NO network operations
    client.cycle();  // Dispatches to callback or updates[]
    
    // If no callback, drain the queue
    while (client.updates && client.updates.length) {
        handleUpdate(client.updates.shift());
    }
    
    // Heartbeat for presence (fire-and-forget write, no blocking)
    var now = nowMs();
    if (myGlobalId && myPresenceData && (now - lastHeartbeatTime) >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatTime = now;
        myPresenceData.timestamp = now;
        writePresence(myGlobalId, myPresenceData);  // Already fire-and-forget
    }
}
```

**2c. Remove pollOnDemand() entirely**

```javascript
// DELETE THIS FUNCTION - it's the wrong pattern
// function pollOnDemand(ctx) { ... }
```

**2d. listIncoming/listOutgoing just return cached data**

```javascript
function listIncoming(ctx) {
    ensureClient(ctx);  // Ensures subscribed
    
    // NO POLLING - just return cached data
    // Updates arrive via subscription callback
    
    var gid = getGlobalIdFromCtx(ctx);
    if (!gid) return [];
    
    var ts = nowMs();
    var incoming = [];
    
    for (var id in challengeCache) {
        // ... filter logic (unchanged) ...
    }
    
    return incoming;
}
```

### Phase 3: Fix lorb_multiplayer_launcher.js

This file does need to wait for the other player, but it should use subscriptions, not polling:

```javascript
function showSynchronizedCountdown(client, challengeId, myGlobalId, isChallenger, countdownSeconds) {
    var syncPath = "game." + challengeId + ".sync";
    
    // Subscribe to sync path
    client.subscribe("nba_jam", syncPath);
    
    // Write my ready signal (fire-and-forget)
    client.settings.TIMEOUT = -1;
    client.write("nba_jam", syncPath + ".players." + myGlobalId, myReadyData, 2);
    
    // Wait for updates via subscription
    var waitStart = Date.now();
    var bothReady = false;
    var syncData = { players: {} };
    syncData.players[myGlobalId] = myReadyData;
    
    while (!bothReady && (Date.now() - waitStart) < MAX_WAIT_MS) {
        mswait(100);  // Small sleep, not blocking on network
        
        // Check for incoming packets (non-blocking)
        var packet = client.cycle();
        while (client.updates.length) {
            var update = client.updates.shift();
            if (update.location.indexOf(syncPath) === 0) {
                // Merge update into syncData
                if (update.data && update.data.players) {
                    for (var pid in update.data.players) {
                        syncData.players[pid] = update.data.players[pid];
                    }
                }
            }
        }
        
        // Check if both ready
        var readyCount = 0;
        for (var pid in syncData.players) {
            if (syncData.players[pid] && syncData.players[pid].ready) {
                readyCount++;
            }
        }
        if (readyCount >= 2) bothReady = true;
    }
    
    client.unsubscribe("nba_jam", syncPath);
    // ...
}
```

### Phase 4: Fix json_client_helper.js Version Check

```javascript
function checkVersionCompatibility(jsonClient, scope, serverName) {
    // ...
    
    // Option A: Skip blocking read, just write our version (last-writer-wins)
    jsonClient.write(scope, VERSION_PATH, {
        commit: localVersion,
        publishedAt: nowMs(),
        publishedBy: system.qwk_id || system.name || "unknown"
    }, 2);  // LOCK_WRITE, fire-and-forget
    
    // Trust that if versions mismatch, gameplay will fail and we'll know
    VERSION_CHECK_DONE = true;
    return true;
    
    // Option B: If we MUST read, do it once at startup (not in hot path)
    // and accept the brief block
}
```

---

## Implementation Checklist

### Critical (Blocks Input)

- [ ] Set `USE_SUBSCRIPTIONS = true` in config.js
- [ ] Remove/disable `pollOnDemand()` function in challenges_pubsub.js
- [ ] Make `cycle()` only drain `client.updates[]`, no network ops
- [ ] Make `listIncoming()`/`listOutgoing()` return cached data only
- [ ] Set `client.callback = handleUpdate` on connect
- [ ] Refactor lorb_multiplayer_launcher.js to use subscriptions

### High (Data Integrity)

- [ ] Add checkpoint saves after baby creation (doctor.js)
- [ ] Add checkpoint saves after game completion (courts.js, arena.js)
- [ ] Add checkpoint saves after purchases (shop.js)
- [ ] Add periodic auto-save in hub loop

### Medium (Polish)

- [ ] Remove blocking version check or move to startup
- [ ] Add logging to verify subscription-based updates work
- [ ] Test with multiple simultaneous LORB users

---

## Verification Plan

### Test 1: Input Responsiveness

1. Enable debug logging for `[LORB:Challenges:PubSub]`
2. Enter hub, monitor for `pollOnDemand` log entries
3. **Before fix:** Should see `pollOnDemand` with timing logs
4. **After fix:** Should see NO `pollOnDemand` calls, only `handleUpdate` callbacks

### Test 2: Challenge Delivery

1. Two LORB sessions (A and B)
2. A sends challenge to B
3. **Before fix:** B sees challenge after next poll cycle (2-15 seconds)
4. **After fix:** B sees challenge almost immediately (subscription push)

### Test 3: No BBS Freezing

1. LORB session active in hub
2. Open second terminal, use chat or other BBS features
3. **Before fix:** Occasional lag/freezing
4. **After fix:** Responsive at all times

### Test 4: Data Persistence

1. Create baby in doctor.js
2. Force-quit (CTRL+C)
3. Re-enter game
4. **Before fix:** Baby lost
5. **After fix:** Baby persisted (checkpoint save)

---

## Appendix: JSONChat Code Reference

The following patterns from json-chat.js should be adopted:

### Subscribe on Join
```javascript
this.join = function(target) {
    this.client.subscribe("chat", "channels." + target + ".messages");
    // ...
}
```

### Unsubscribe on Part
```javascript
this.part = function(target) {
    this.client.unsubscribe("chat", "channels." + chan.name + ".messages");
    // ...
}
```

### Cycle Just Drains Updates
```javascript
this.cycle = function() {
    this.client.cycle();
    while(this.client.updates.length)
        this.update(this.client.updates.shift());
    // ... sync views ...
    return true;
}
```

### Handle Updates via Callback
```javascript
this.update = function(packet) {
    // Parse packet.location, packet.oper, packet.data
    switch(packet.oper.toUpperCase()) {
    case "SUBSCRIBE":
        // Someone joined
        break;
    case "UNSUBSCRIBE":
        // Someone left
        break;
    case "WRITE":
        // New data
        break;
    }
}
```

### Write with Inline Lock (Fire-and-Forget)
```javascript
this.client.write("chat", "channels." + chan.name + ".messages", message, 2);
// The '2' is LOCK_WRITE - server handles atomically
// No blocking, no waiting for response
```

---

## Conclusion

The fix is not just "add timeouts" - it's a fundamental architectural change:

**FROM:** Polling with blocking reads every 2-15 seconds  
**TO:** Subscriptions with passive callback-based updates

This matches how `json-chat.js` uses `json-client.js` and is the intended design pattern for the Synchronet JSON service.

The changes are significant but well-defined. The data integrity issue (exit-only saves) is separate and should also be addressed but is lower priority than fixing the blocking.

---

## Appendix: JSONClient Singleton Factory (Wave 24)

**Date Added:** January 2025  
**Files:** `lib/utils/json-client-factory.js`

### Problem: Multiple JSONClient Instances

Prior to Wave 24, multiple parts of the codebase created their own JSONClient instances:
- `lib/lorb/util/json_client_helper.js` - LORB's existing helper
- `lib/multiplayer/mp_lobby_v2.js` - Multiplayer lobby v2
- `lib/multiplayer/mp_lobby.js` - Legacy multiplayer lobby
- `lib/lorb/multiplayer/lorb_multiplayer_launcher.js` - LORB match launcher

This caused:
1. Multiple socket connections to the same server
2. Risk of orphaned connections if cleanup was missed
3. Inconsistent timeout/backoff configuration across consumers

### Solution: Unified Singleton Factory

A new singleton factory at `lib/utils/json-client-factory.js` provides:

```javascript
// Get shared client (creates on first call)
var client = NBA_JAM.JsonClient.get();

// Configure before first use (optional)
NBA_JAM.JsonClient.configure({ addr: "localhost", port: 10088 });

// Track subscriptions for cleanup
NBA_JAM.JsonClient.trackSubscription("nba_jam", "challenges.bucket_123");

// Disconnect and cleanup all subscriptions
NBA_JAM.JsonClient.disconnect();
```

### Benefits
- **Single connection**: All consumers share one JSONClient instance
- **Guaranteed cleanup**: `disconnect()` unsubscribes all tracked paths, then closes socket
- **Consistent settings**: Fire-and-forget mode (`TIMEOUT=-1`) by default
- **Backoff handling**: Failed connections trigger exponential backoff, shared across consumers
- **Graceful fallback**: Consumers that can't access the factory still work (create their own client)

### Integration Points
- **Load order**: Factory loaded in `module-loader.js` after `helpers.js`, before multiplayer/LORB
- **Exit cleanup**: `nba_jam.js` calls `NBA_JAM.JsonClient.disconnect()` in cleanup section
- **LORB delegation**: `json_client_helper.js` delegates to factory when available

### Scope Responsibility
The factory manages **connection only**. Callers are responsible for:
- Choosing the appropriate scope (`"nba_jam"` vs `"chat"`)
- Locking semantics per operation
- Subscription management via `trackSubscription()`/`untrackSubscription()`

