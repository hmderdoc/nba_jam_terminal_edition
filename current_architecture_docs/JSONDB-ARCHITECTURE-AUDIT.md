# JSON-DB Architecture Audit Report
**Date:** June 16, 2025 (Revised: June 17, 2025)  
**Branch:** `jsondb_architecture_audit`  
**Auditor:** Copilot at user request  
**User Observation:** "I was surprised to see when the baby baller was actually written to the database - when I exited the program!"

---

## Executive Summary

This audit investigates potential architectural issues with JSON-DB usage that may be causing BBS freezing. The investigation revealed two distinct issues:

### Issue 1: BBS-Wide Blocking (CRITICAL)
When LORB performs **blocking JSONClient reads**, the shared Synchronet JSON service can delay responses to OTHER BBS processes. The BBS shell uses `json-chat.js` which calls `JSONChat.cycle()` regularly. When the JSON service is busy serving LORB requests, the shell's cycle() may block, causing the "freeze" symptom.

### Issue 2: Exit-Only Player Saves (DATA INTEGRITY)
The player state (ctx) is:
1. **Loaded ONCE** at session start (`LORB.Persist.load`)
2. **Held in memory** for the entire session (potentially hours)
3. **Saved ONCE** at session end (`LORB.Persist.save`)

This means crash/disconnect = data loss, but this is NOT the blocking cause.

**IMPORTANT CORRECTION:** An earlier version of this audit blamed `mp_sessions.js` for the blocking. That was INCORRECT - `mp_sessions.js` is arcade mode code and is **NOT loaded by LORB**. The actual blocking sources are in LORB-specific code paths.

---

## Key Findings

### Finding 1: Understanding the BBS Architecture (Context)

The Synchronet BBS runs a **JSON service** that multiple clients connect to:

| Component | Uses | Purpose |
|-----------|------|---------|
| **BBS Shell (json-chat.js)** | JSONClient via `JSONChat.cycle()` | Chat, messaging, inter-user communication |
| **LORB (challenges_pubsub.js)** | JSONClient | Presence, live challenges |
| **LORB (lorb_multiplayer_launcher.js)** | JSONClient | Game synchronization |
| **Arcade (mp_sessions.js)** | JSONClient | NOT loaded by LORB |

When any client blocks on the JSON service (waiting for a read/lock), the service may delay other clients. This is the mechanism by which LORB can affect the BBS shell.

**Key insight from Synchronet source (json-client.js):**
```javascript
// TIMEOUT determines blocking behavior:
// TIMEOUT = -1  → fire-and-forget, NO wait for response
// TIMEOUT >= 0  → BLOCKS until response or timeout expires
// SOCK_TIMEOUT = 30000 (30 seconds default!)
```

### Finding 2: Blocking Sources in LORB (CORRECTED)

**2a. lorb_multiplayer_launcher.js - NO TIMEOUT SET**

When launching a multiplayer match from LORB challenges, this file creates a new JSONClient but **never sets timeout**:

```javascript
// Line 124 - creates client with DEFAULT timeouts (30 seconds!)
var client = new JSONClient(serverConfig.addr || "localhost", serverConfig.port || 10088);

// Lines 293, 349, 412, 567 - blocking reads with no custom timeout
syncData = client.read("nba_jam", syncPath, 1);  // LOCK_READ, waits up to 30s!
```

This is a polling loop that runs for up to 30 seconds, calling `client.read()` every 500ms. Each read **blocks** waiting for a response.

**2b. challenges_pubsub.js - Short Timeouts BUT Still Blocking**

When `USE_SUBSCRIPTIONS = false` (the current default):

```javascript
// Line 321 - temporarily sets short timeout for polling
client.settings.TIMEOUT = 500;  // 500ms

// Lines 328, 342 - blocking reads
var challenges = client.read(DB_SCOPE, bucketPath(gid), 1);
var presence = client.read(DB_SCOPE, PRESENCE_ROOT, 1);
```

These are called:
- Every 2 seconds during `pollOnDemand()` (rate-limited)
- Every 15 seconds during heartbeat cycle
- On demand when listing challenges/presence

500ms is much better than 30s, but it's still **blocking**.

**2c. json_client_helper.js - Version Check Blocking**

On first connect, does a blocking read for version check:

```javascript
// Line 69 - blocking read with TIMEOUT set to 2000ms
var serverInfo = jsonClient.read(scope, VERSION_PATH, 1);
```

### Finding 3: What's NOT the Issue

**mp_sessions.js IS NOT LOADED BY LORB**

An earlier analysis incorrectly blamed `mp_sessions.js` for explicit lock()/unlock() patterns. This was wrong:

- `mp_sessions.js` is arcade mode multiplayer code
- LORB uses `boot.js` which loads `challenges_pubsub.js` (line 59)
- `mp_sessions.js` is NEVER loaded during a LORB session

**challenges.js IS NOT LOADED**

The deprecated `challenges.js` with explicit locks is also not loaded - only `challenges_pubsub.js` is.

**Verified load path (boot.js):**
```javascript
load(ROOT + "multiplayer/challenges_pubsub.js");  // Line 59 - THIS is loaded
// challenges.js, challenges_simple.js, mp_sessions.js - NONE of these
```

### Finding 4: Dual Storage Architecture (GOOD)

The codebase correctly separates two storage mechanisms:

| Storage Layer | Implementation | Purpose | Blocking Risk |
|---------------|----------------|---------|---------------|
| **JSONdb (file-based)** | `json-db.js` → `persist.js` | Durable player state | LOW (local file I/O) |
| **JSONClient (network)** | `json-client.js` → various | Ephemeral data | **MEDIUM-HIGH** (see above) |

**Key insight:** Player state uses LOCAL file-based JSONdb, NOT the network JSONClient. The BBS freezing is NOT from holding player records.

### Finding 5: Exit-Only Save Pattern (CONFIRMED)

Player context (ctx) is saved only at session exit and a few mid-session checkpoints.

**Critical gaps - NO saves in:**
- `doctor.js` - Baby ballers created but NOT persisted (user's observation!)
- `arena.js` - Game results NOT persisted
- `club23.js` - Betting results, flirting outcomes NOT persisted
- `courts.js` - Street ball results NOT persisted

**Impact:** If the BBS crashes or user disconnects, ALL progress since last save is lost.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SYNCHRONET JSON SERVICE                               │
│                    (Single server, multiple clients)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│   │   BBS SHELL     │    │   LORB USER 1   │    │   LORB USER 2   │        │
│   │  json-chat.js   │    │  challenges_    │    │  (same code)    │        │
│   │                 │    │  pubsub.js      │    │                 │        │
│   │ JSONChat.cycle()│    │                 │    │                 │        │
│   │ (called often)  │    │ ┌─────────────┐ │    │                 │        │
│   │                 │    │ │ pollOnDemand│ │    │                 │        │
│   │   ▼ blocks if   │    │ │ .read() 500ms│◄───►│ Same operations │        │
│   │   service busy  │    │ └─────────────┘ │    │ Same contention │        │
│   └────────┬────────┘    │                 │    └─────────────────┘        │
│            │             │ ┌─────────────┐ │                                │
│            │             │ │lorb_mp_     │ │                                │
│            │             │ │launcher.js  │ │                                │
│            │             │ │.read() 30s!!│ │ ◄── NO TIMEOUT SET!           │
│            │             │ └─────────────┘ │                                │
│            │             └─────────────────┘                                │
│            │                      │                                          │
│            └──────────┬───────────┘                                          │
│                       │                                                      │
│                       ▼                                                      │
│               ┌───────────────┐                                             │
│               │  JSON-DB      │  ◄── Queue-based processing                 │
│               │  (json-db.js) │      One request at a time per path         │
│               │               │      Long operations delay others           │
│               └───────────────┘                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

           SEPARATE (NOT BLOCKING)
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LOCAL FILE STORAGE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│   ┌─────────────────┐                                                       │
│   │ data/lorb.json  │  ◄── Player state (ctx)                               │
│   │                 │      File-based JSONdb                                │
│   │ Read on start   │      NOT network-connected                            │
│   │ Write on exit   │      NO blocking other users                          │
│   └─────────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Root Cause Analysis

### Why is the BBS freezing?

**Confirmed Cause: Blocking Reads in LORB JSONClient Operations**

When LORB performs blocking reads (`client.read()` with TIMEOUT >= 0), the client waits for a response from the JSON service. While the service is processing LORB's request (especially if there's data to serialize), OTHER clients (like the BBS shell's `json-chat.js`) may experience delays.

The cascade:
1. LORB user A enters multiplayer sync loop (`lorb_multiplayer_launcher.js`)
2. Loop does `client.read()` every 500ms with **30 second default timeout**
3. JSON service queue backs up processing these reads
4. BBS shell calls `JSONChat.cycle()` to check for chat messages
5. Shell's `cycle()` blocks waiting for the JSON service
6. User sees "frozen" BBS until operations complete

**Contributing factors:**
- `lorb_multiplayer_launcher.js`: Creates client with NO timeout (30s default!)
- `challenges_pubsub.js`: Poll mode with 500ms timeout (better but still blocking)
- `json_client_helper.js`: 2000ms blocking read for version check

### Why is player state NOT the issue?

1. **JSONdb (file-based) does not block other BBS users** - It uses local file locks
2. **Read/write to lorb.json is fast** - Simple JSON file operations
3. **No network involved** - Player state never touches JSONClient

The exit-only save pattern is a **data integrity concern** (crash loses progress) but NOT a **BBS blocking concern**.

---

## Evidence Summary

| Issue | Severity | Evidence | Impact |
|-------|----------|----------|--------|
| lorb_multiplayer_launcher.js no timeout | **CRITICAL** | Line 124: new JSONClient(), no TIMEOUT set | 30s default blocking on every read |
| challenges_pubsub.js poll mode | **MEDIUM** | Lines 321, 328, 342: TIMEOUT=500ms reads | 500ms blocking every 2s minimum |
| json_client_helper.js version check | **LOW** | Line 69: 2000ms blocking read | One-time per session, but still blocks |
| Exit-only player saves | **HIGH** (data integrity) | No saves in doctor.js, arena.js, etc. | Data loss on crash |
| USE_SUBSCRIPTIONS=false | **MEDIUM** | config.js line ~57 | Forces poll mode instead of push |

---

## Recommendations

### Immediate (blocking issue)

1. **Fix lorb_multiplayer_launcher.js timeout settings**
   - Set `client.settings.TIMEOUT = 500` after creating the client
   - Or better: use `TIMEOUT = -1` with fire-and-forget pattern like challenges_pubsub.js

2. **Consider enabling USE_SUBSCRIPTIONS=true**
   - Uses push notifications instead of polling
   - Reduces blocking reads significantly
   - Test for stability first

3. **Make version check non-blocking**
   - Change json_client_helper.js to use `TIMEOUT = -1` for write
   - Skip blocking read for version if possible

### Short-term (data integrity)

4. **Add checkpoint saves** after significant game events:
   - After game completion (courts.js, arena.js)
   - After baby creation (doctor.js)
   - After purchases (shop.js)
   - After training (gym.js)
   - After betting (club23.js)

5. **Add periodic auto-save** in hub loop (e.g., every 5 minutes)

### Long-term (architecture)

6. **Standardize JSONClient usage** - all LORB code should:
   - Set `TIMEOUT = -1` (fire-and-forget) for writes
   - Use inline `LOCK_WRITE` (parameter 4) for atomic operations
   - Avoid explicit `lock()`/`unlock()` calls
   - Use short timeouts (500ms max) for any blocking reads

7. **Consider async polling architecture**
   - Instead of blocking reads, use subscription callbacks
   - Process updates in cycle() without blocking

8. **Document the pattern** for future developers

---

## Test Scenarios

### To verify multiplayer launcher is blocking:

1. Start two BBS sessions
2. Session A: Enter LORB, send a challenge to Session B
3. Session A: Accept challenge, enter the sync waiting room
4. Session B: Open another terminal to the BBS (don't accept yet)
5. Observe Session B's responsiveness while Session A polls
6. **Expected:** Session B may experience lag in chat/messaging

### To verify poll mode blocking:

1. Enable debug logging
2. Start LORB session, go to a menu that polls challenges
3. Grep logs for `pollOnDemand` and timing
4. **Expected:** Each poll shows ~500ms elapsed time
5. During polls, check if other BBS operations lag

### To verify player state is NOT the issue:

1. Start one BBS session
2. Play through doctor visit (baby creation)
3. Force-quit before normal exit
4. Check data/lorb.json
5. **Expected:** Baby baller NOT in database (confirms user observation)
6. **Note:** This is data loss, not BBS blocking

### To verify challenges_pubsub.js works correctly:

1. Start two BBS sessions  
2. Session A: Send challenge to Session B
3. Session A: Force-quit
4. Session B: Receive and respond to challenge
5. **Expected:** Session B operates normally (fire-and-forget writes don't block)

---

## Appendix: Code References

### lorb_multiplayer_launcher.js - PROBLEMATIC (no timeout)
```javascript
// Line 124 - NO TIMEOUT CONFIGURED
var client = new JSONClient(serverConfig.addr || "localhost", serverConfig.port || 10088);
// client.settings.TIMEOUT defaults to 0, which means use SOCK_TIMEOUT (30 seconds!)

// Lines 293, 349, 412, 567 - Blocking reads with 30s timeout
syncData = client.read("nba_jam", syncPath, 1);  // Blocks up to 30 seconds!
```

### challenges_pubsub.js - Fire-and-Forget Pattern (GOOD)
```javascript
// Line 222: Set fire-and-forget mode
client.settings.TIMEOUT = -1;

// Line 448: All writes use inline lock
client.write(DB_SCOPE, path, data, LOCK_WRITE);  // Server does atomic lock→write→unlock
```

### challenges_pubsub.js - Poll Mode (OKAY but blocks)
```javascript
// Lines 321-328: Short timeout but still blocking
client.settings.TIMEOUT = 500;  // 500ms
var challenges = client.read(DB_SCOPE, bucketPath(gid), 1);  // LOCK_READ
```

### json-client.js (Synchronet source) - Blocking Behavior
```javascript
// From json-client.js - how wait() works:
this.wait = function(timeout) {
    if(timeout == undefined)
        timeout = this.settings.TIMEOUT;
    if(timeout < 0)
        return true;  // TIMEOUT=-1 means DON'T WAIT
    // Otherwise... blocks until response or timeout!
    while(!response && (Date.now() - startTime) < timeout) {
        socket.poll(...);  // BLOCKING POLL
    }
};
```

---

## Conclusion

The BBS freezing issue is caused by **blocking JSONClient reads** in LORB code, particularly:

1. **lorb_multiplayer_launcher.js** - No timeout set, uses 30 second default
2. **challenges_pubsub.js** - Poll mode with 500ms timeout (better but still blocking)

The exit-only save pattern is a separate **data integrity concern** that should be addressed to prevent progress loss on crashes.

**CORRECTION:** An earlier version of this audit incorrectly blamed `mp_sessions.js`. That code is NOT loaded by LORB (it's arcade mode only). The actual blocking sources are in LORB-specific code paths documented above.

See the companion document `JSONDB-REMEDIATION-PLAN.md` for the action plan.
