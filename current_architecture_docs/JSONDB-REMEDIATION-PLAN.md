# JSON-DB Remediation Plan
**Date:** June 16, 2025 (Revised: June 17, 2025)  
**Branch:** `jsondb_architecture_audit`  
**Prerequisite:** Review [JSONDB-ARCHITECTURE-AUDIT.md](JSONDB-ARCHITECTURE-AUDIT.md) first

---

## Overview

This plan addresses two distinct issues discovered in the audit:

1. **BBS Blocking (CRITICAL):** LORB code uses blocking JSONClient reads without short timeouts
2. **Data Integrity (HIGH):** Exit-only save pattern causes data loss on crashes/disconnects

Each issue has independent fixes. They can be implemented in any order.

**IMPORTANT CORRECTION:** An earlier version of this plan focused on `mp_sessions.js`. That was INCORRECT - `mp_sessions.js` is arcade mode code and is NOT loaded by LORB. The actual blocking sources are in LORB-specific code paths.

---

## Issue 1: LORB JSONClient Blocking Reads

### Problem Statement

LORB code performs blocking JSONClient reads that can delay the BBS-wide JSON service:

| File | Problem | Default Timeout |
|------|---------|-----------------|
| `lorb_multiplayer_launcher.js` | Creates JSONClient with NO timeout set | **30 seconds!** |
| `challenges_pubsub.js` | Poll mode uses 500ms timeout | 500ms (acceptable) |
| `json_client_helper.js` | Version check read | 2000ms |

The most severe is `lorb_multiplayer_launcher.js` which does a polling loop with 30-second-blocking reads.

### Remediation Options

#### Option A: Fix Timeout in lorb_multiplayer_launcher.js (CRITICAL)

**Approach:** Set short timeout immediately after creating the client

**Location:** [lorb_multiplayer_launcher.js](lib/lorb/multiplayer/lorb_multiplayer_launcher.js) line 124

**Current code:**
```javascript
function createClient(serverConfig) {
    if (typeof JSONClient === "undefined") {
        load("json-client.js");
    }
    var client = new JSONClient(serverConfig.addr || "localhost", serverConfig.port || 10088);
    // BUG: No timeout set! Uses 30-second default.
    if (!client.connected) {
        throw new Error("Failed to connect to " + serverConfig.addr + ":" + serverConfig.port);
    }
    return client;
}
```

**Fixed code:**
```javascript
function createClient(serverConfig) {
    if (typeof JSONClient === "undefined") {
        load("json-client.js");
    }
    var client = new JSONClient(serverConfig.addr || "localhost", serverConfig.port || 10088);
    
    // FIX: Set short timeouts to prevent BBS blocking
    if (client && client.settings) {
        client.settings.TIMEOUT = 500;      // 500ms max wait for reads
        client.settings.SOCK_TIMEOUT = 2000; // 2s socket timeout
    }
    
    if (!client.connected) {
        throw new Error("Failed to connect to " + serverConfig.addr + ":" + serverConfig.port);
    }
    return client;
}
```

**Effort:** ~15 minutes  
**Risk:** Low - straightforward timeout fix  
**Files:** `lib/lorb/multiplayer/lorb_multiplayer_launcher.js`

#### Option B: Enable Subscription Mode (MEDIUM-TERM)

**Approach:** Change `USE_SUBSCRIPTIONS` from `false` to `true` in config

**Location:** [config.js](lib/lorb/config.js) line ~57

**Current:**
```javascript
USE_SUBSCRIPTIONS: false  // Forces poll mode with blocking reads
```

**Fixed:**
```javascript
USE_SUBSCRIPTIONS: true   // Uses push notifications, fewer blocking reads
```

**Impact:**
- Challenges/presence updates come via callback instead of polling
- Reduces `pollOnDemand()` calls significantly
- Need to verify server-side subscription stability first

**Effort:** ~5 minutes to change, ~1 hour to test  
**Risk:** Medium - subscriptions may have their own issues  
**Files:** `lib/lorb/config.js`

#### Option C: Make Version Check Fire-and-Forget (LOW PRIORITY)

**Approach:** Skip blocking read for version, just write our version

**Location:** [json_client_helper.js](lib/lorb/util/json_client_helper.js) line 69

The version check does a 2-second blocking read on first connect. This could be:
1. Skipped entirely (just write our version, last-writer-wins)
2. Made non-blocking with TIMEOUT=-1 (but then we don't know if it matches)

**Effort:** ~30 minutes  
**Risk:** Low  
**Files:** `lib/lorb/util/json_client_helper.js`

### Verification Test

```
Test: Multiplayer Launcher Blocking
───────────────────────────────────

Setup:
1. Two terminals open to BBS
2. Two LORB players who can challenge each other

Before Fix:
1. Session A: Send challenge to Session B, enter lobby waiting
2. Session B: Check if chat/messaging is responsive while A waits
Expected BEFORE: Session B may experience lag/delays

After Fix (Option A):
Repeat steps 1-2
Expected AFTER: Session B remains fully responsive
```

### Success Criteria

- [ ] No terminal hangs when LORB users are in multiplayer sync
- [ ] Other BBS areas remain responsive during LORB play
- [ ] Debug logs show short read times (< 500ms)
- [ ] Error logs show no socket timeouts

---

## Issue 2: Exit-Only Save Pattern

### Problem Statement

Player context (ctx) is only saved:
1. On normal program exit
2. In a few specific locations (crib payments, appearance editor)

Many significant events do NOT trigger saves:
- Baby creation (doctor.js)
- Game results (arena.js, courts.js)
- Purchases (shop.js)
- Training (gym.js)
- Betting outcomes (club23.js)

### Remediation Options

#### Option A: Add Checkpoint Saves (RECOMMENDED)

**Approach:** Add `LORB.Persist.save(ctx)` calls after significant state changes

**Locations to add saves:**

| File | Location | Event | Priority |
|------|----------|-------|----------|
| doctor.js | After `addBabyToContext()` | Baby born | HIGH |
| courts.js | After rewards applied | Game completed | HIGH |
| arena.js | After game result | PvP/ghost match | HIGH |
| shop.js | After purchase | Item bought | MEDIUM |
| gym.js | After training | Stats modified | MEDIUM |
| club23.js | After betting payout | Bet resolved | MEDIUM |

**Example (doctor.js):**

```javascript
// After baby is added to context
LORB.Data.BabyBallers.addBabyToContext(ctx, baby);

// ADD THIS: Checkpoint save after baby creation
if (LORB.Persist && LORB.Persist.save) {
    LORB.Persist.save(ctx);
    debugLog("[DOCTOR] Checkpoint save after baby creation: " + baby.nickname);
}
```

**Effort:** ~2 hours  
**Risk:** Low - save function already tested  
**Files:** doctor.js, courts.js, arena.js, shop.js, gym.js, club23.js

#### Option B: Periodic Auto-Save in Hub

**Approach:** Add a timer-based auto-save in the hub loop

**Implementation:**

```javascript
// In hub.js run() function
var lastAutoSave = Date.now();
var AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Inside the menu loop:
if (Date.now() - lastAutoSave > AUTO_SAVE_INTERVAL_MS) {
    LORB.Persist.save(ctx);
    lastAutoSave = Date.now();
    debugLog("[HUB] Auto-save triggered");
}
```

**Effort:** ~30 minutes  
**Risk:** Low  
**Files:** hub.js

#### Option C: Save-on-Return-to-Hub

**Approach:** Save whenever player returns to hub from any location

**Implementation:**

```javascript
// In hub.js after each location visit
case "courts":
    LORB.Locations.Courts.run(ctx);
    LORB.Persist.save(ctx);  // Save on return
    break;
```

**Effort:** ~1 hour  
**Risk:** Low - but more saves than strictly necessary  
**Files:** hub.js

### Verification Test

```
Test: Baby Creation Persistence
───────────────────────────────

Setup:
1. Player with no existing babies
2. Have a pending pregnancy ready to resolve

Before Fix:
1. Enter the game
2. Go through doctor visit (baby created)
3. Force disconnect (CTRL+C / hangup)
4. Re-enter game
Expected BEFORE: No baby exists (data lost)

After Fix:
Repeat steps 1-4
Expected AFTER: Baby exists (checkpoint save worked)
```

### Success Criteria

- [ ] Baby creation persists on disconnect
- [ ] Game results persist on disconnect
- [ ] Purchases persist on disconnect
- [ ] Debug logs show "[CHECKPOINT]" or similar on each save point
- [ ] No noticeable performance impact from additional saves

---

## Implementation Order

### Phase 1: Stop the Bleeding (BBS Blocking)

**Priority:** CRITICAL  
**Timeline:** Immediate

1. Apply Option A - Fix timeout in `lorb_multiplayer_launcher.js`
2. Test BBS responsiveness during LORB multiplayer sync
3. Consider Option B (subscriptions) if polling still causes issues

### Phase 2: Protect User Data

**Priority:** HIGH  
**Timeline:** This week

1. Add checkpoint saves (Option A) to HIGH priority locations
2. Add auto-save (Option B) to hub loop
3. Add MEDIUM priority checkpoint saves

### Phase 3: Architecture Improvement

**Priority:** MEDIUM  
**Timeline:** Next sprint

1. Consider enabling subscription mode (USE_SUBSCRIPTIONS=true)
2. Standardize all JSONClient usage patterns
3. Update architecture documentation

---

## Validation Checklist

### After Phase 1:

- [ ] `grep -n "client.settings.TIMEOUT" lib/lorb/multiplayer/lorb_multiplayer_launcher.js` shows timeout being set
- [ ] Manual test: BBS remains responsive during LORB multiplayer sync
- [ ] No new entries in error.log related to socket timeouts

### After Phase 2:

- [ ] `grep -rn "LORB.Persist.save" lib/lorb/locations/` shows saves in all key locations
- [ ] Manual test: Baby survives force-quit
- [ ] Manual test: Game results survive force-quit
- [ ] Debug log shows checkpoint save entries

### After Phase 3:

- [ ] All JSONClient operations use short timeouts or TIMEOUT=-1
- [ ] Architecture docs updated with new patterns

---

## Rollback Plan

### If Phase 1 causes issues:

1. Revert lorb_multiplayer_launcher.js timeout changes
2. May need longer timeout if network is slow
3. Investigate specific failure before re-attempting

### If Phase 2 causes issues:

1. Revert checkpoint save additions
2. Monitor for performance complaints
3. Consider reducing save frequency if I/O is slow

---

## Documentation Updates Required

After implementation, update:

1. [LORB-AUDIT.md](current_architecture_docs/LORB-AUDIT.md) - Mark blocking issues as resolved
2. [architecture.md](docs/lorb/architecture.md) - Add save points to "Execution Flow" section
3. [challenges.md](docs/lorb/challenges.md) - Reference this as the canonical pattern

---

## Appendix: Full File List

### Files to Modify (Phase 1):
- `lib/lorb/multiplayer/lorb_multiplayer_launcher.js` - Add timeout settings

### Files to Modify (Phase 2):
- `lib/lorb/locations/doctor.js` - Checkpoint save after baby
- `lib/lorb/locations/courts.js` - Checkpoint save after game
- `lib/lorb/locations/arena.js` - Checkpoint save after match
- `lib/lorb/locations/shop.js` - Checkpoint save after purchase
- `lib/lorb/locations/gym.js` - Checkpoint save after training
- `lib/lorb/locations/club23.js` - Checkpoint save after betting
- `lib/lorb/locations/hub.js` - Auto-save timer

### Files to Update (Phase 3):
- `lib/lorb/config.js` - Consider USE_SUBSCRIPTIONS=true
- `current_architecture_docs/LORB-AUDIT.md`
- `docs/lorb/architecture.md`
- `docs/lorb/challenges.md`

---

## Appendix: JSONClient Timeout Reference

From Synchronet json-client.js source:

| Setting | Default | Meaning |
|---------|---------|---------|
| `TIMEOUT` | 0 | Time to wait for response. -1 = no wait (fire-and-forget), 0 = use SOCK_TIMEOUT, >0 = specific ms |
| `SOCK_TIMEOUT` | 30000 | Socket poll timeout in ms (30 seconds!) |
| `PING_TIMEOUT` | varies | Timeout for ping responses |

**Blocking behavior:**
- `TIMEOUT = -1` → `.write()` returns immediately, no response expected
- `TIMEOUT >= 0` → `.read()` and `.write()` call `wait()` which blocks
- `wait()` uses `socket.poll()` which is a blocking call

**Recommended settings for LORB:**
```javascript
client.settings.TIMEOUT = -1;       // Fire-and-forget writes
client.settings.SOCK_TIMEOUT = 2000; // 2s max socket wait
```
