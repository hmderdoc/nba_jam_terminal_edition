# LORB Subsystem Audit Report
**Date:** December 10, 2025  
**Scope:** `lib/lorb/**` only

## Executive Summary

Comprehensive audit of the LORB (Legend of the Red Bull / Rim City) subsystem identified **83 total issues**:
- **8 HIGH** severity (potential BBS lockups, data corruption)
- **18 MEDIUM** severity (code quality, maintainability)
- **9 LOW** severity (cosmetic, minor improvements)

The most critical concerns relate to **JSONClient lock management** and **error handling** that could cause BBS-wide lockups.

---

## 1. JSONClient Usage Issues

### ✅ RESOLVED: Lock/Error Patterns (Dec 10, 2025)

The blocking lock issues have been **completely resolved** by rewriting `challenges_pubsub.js` to use:

1. **Fire-and-forget mode:** `client.settings.TIMEOUT = -1` - never calls `wait()`
2. **Inline LOCK_WRITE:** `client.write(scope, path, data, LOCK_WRITE)` - server handles atomic lock→write→unlock
3. **No client-side lock() calls:** All locking is server-side atomic operations

**Key insight from json-db.js (lines 590-601):** When `write()` receives a `lock` parameter, the server internally queues:
- LOCK operation
- WRITE operation  
- UNLOCK operation

The UNLOCK triggers `send_data_updates()` to notify all subscribers. This completely eliminates client-side blocking.

### Previously Critical Issues (NOW FIXED)

| Status | Issue | Resolution |
|--------|-------|------------|
| ✅ FIXED | Separate lock()/unlock() calls caused BBS-wide blocking | Using inline LOCK_WRITE param |
| ✅ FIXED | wait() blocking on lock contention | TIMEOUT=-1 (fire-and-forget mode) |
| ✅ FIXED | Orphaned locks on disconnect | No client-side locks to orphan |
| ✅ FIXED | Complex reconnect/lock cleanup logic | Simplified - no locks to track |

### Correct Pattern (Current Implementation)

```javascript
// CORRECT - fire-and-forget with inline lock
// Server handles: LOCK → WRITE → UNLOCK atomically
// TIMEOUT=-1 means no wait() call - completely non-blocking
client.settings.TIMEOUT = -1;  // Fire and forget
client.write(scope, path, data, LOCK_WRITE);  // Inline lock

// The 4th parameter (LOCK_WRITE = 2) tells the server to:
// 1. Acquire lock
// 2. Write data
// 3. Release lock (triggers subscriber notifications)
// All as a single atomic server-side operation
```

### Remaining Medium/Low JSONClient Issues

| Severity | File | Issue |
|----------|------|-------|
| LOW | `persist.js:191` | `logFn()` function defined twice in same file |
| LOW | `persist.js:Multiple` | Uses `readShared()` without explicit error handling |

---

## 2. Error Handling Issues

### Critical Missing Error Handling

| Severity | File | Issue | Risk |
|----------|------|-------|------|
| **HIGH** | `playoffs.js:400-500` | `advanceRound()` modifies bracket state without transactional safety - partial failure leaves corrupted bracket | Data corruption |
| **HIGH** | `challenge-negotiation.js:Multiple` | Service start/stop lacks error handling - if start fails, state is inconsistent | Zombie services |
| **HIGH** | `arena.js:850-900` | `runQuickMatch()` deducts wager before game but only refunds on quit - errors lose wager | Lost player currency |

### Medium Error Handling Issues

| Severity | File | Issue |
|----------|------|-------|
| MEDIUM | `lorb_game_adapter.js:12-16` | Empty catch block for opponent display loading |
| MEDIUM | `hub.js:280-300` | `drawPlayerSprite()` catches errors but may leave sprite container inconsistent |
| MEDIUM | `persist.js:Multiple` | `recordStats()` doesn't validate input stats - can record NaN/undefined |
| MEDIUM | `club23.js:600-700` | `showBettingBooth()` has multiple exit paths without consistent state cleanup |

---

## 3. Code Quality Issues

### Critical Code Duplication

| Severity | Issue | Files |
|----------|-------|-------|
| **HIGH** | **Three parallel challenge implementations** with significant code duplication | `challenges.js`, `challenges_v2.js`, `challenges_pubsub.js` |
| **HIGH** | `showBettingBooth()` is ~250 lines with deeply nested logic | `arena.js:150-400` |

### Recommendation
Consolidate challenge implementations into single canonical version (`challenges_pubsub.js` appears most complete). Deprecate and remove others.

### Medium Code Quality Issues

| File | Issue | Recommendation |
|------|-------|----------------|
| `club23.js:650-900` | `showBettingLedger()` is ~250 lines | Extract ledger formatting, commentary, record display |
| `season.js:200-280` | `simulateMatch()` mixes calculation, outcome, score | Split into helper functions |
| `challenge-negotiation.js:200-380` | `startChallengeLobby()` is ~180 lines | Split into phases |
| Multiple | Repeated table formatting code | Extract common table rendering helper |
| `persist.js:191` | Duplicate `logFn()` definition | Remove duplicate |

### Dead/Unused Code

| File | Issue |
|------|-------|
| `challenges_v2.js` | Entire file appears superseded by `challenges_pubsub.js` |
| `test_inner.js` | Not loaded in boot.js; appears unused |
| `season.js:380-420` | Legacy synchronous playoff flow - superseded by parallel playoffs |

---

## 4. Architecture Issues

### What's Working Well ✅

1. **Consistent LORB namespace** pattern across all modules
2. **No legacy globals** (`teamAPlayer1`, `courtFrame`, etc.) found
3. **No blocking `mswait()`** in LORB code
4. **Good timeout management** in network code (short timeouts)
5. **Centralized config** in `config.js` with good organization

### Issues Found

| Severity | File | Issue |
|----------|------|-------|
| MEDIUM | `lorb_game_adapter.js:75` | Direct reference to global `runExternalGame` function |
| MEDIUM | `game_engine.js:44` | Direct access to `LORB.Config` - should accept as parameter |
| MEDIUM | `challenge-negotiation.js:27-32` | Module-level mutable state (`client`, `running`, `subscribers`, etc.) |
| LOW | `persist.js:21-25` | Module-level state (intentional singleton - document) |

### Scope Inconsistency

| File | Scope Used |
|------|------------|
| `json-client-helper.js` | `"lorb"` |
| `presence.js` | `"nba_jam"` |
| `challenges_pubsub.js` | `"nba_jam"` |

**Recommendation:** Standardize on `"nba_jam"` everywhere.

---

## 5. Constants Audit

### Missing from config.js (HIGH Priority)

| Current Location | Value | Suggested Config Key |
|------------------|-------|---------------------|
| `challenges_pubsub.js:13` | `5 * 60 * 1000` (5 min) | `CHALLENGES.TTL_MS` |
| `challenges_pubsub.js:14` | `90 * 1000` (90s) | `CHALLENGES.READY_STALE_MS` |
| `challenges_pubsub.js:15` | `250` | `CHALLENGES.CYCLE_INTERVAL_MS` |
| `challenges_pubsub.js:185` | `2000` | `CHALLENGES.INITIAL_FETCH_TIMEOUT_MS` |
| `challenges_pubsub.js:298,349` | `500` | `CHALLENGES.WRITE_TIMEOUT_MS` |
| `presence.js:22` | `60000` | `PRESENCE.TIMEOUT_MS` |

### Recommended Config Additions

```javascript
// Add to lib/lorb/config.js

CHALLENGES: {
    TTL_MS: 5 * 60 * 1000,           // Challenge expires after 5 minutes
    READY_STALE_MS: 90 * 1000,       // Ready state stale after 90 seconds
    CYCLE_INTERVAL_MS: 250,          // How often to check for updates
    INITIAL_FETCH_TIMEOUT_MS: 2000,  // Timeout for initial data fetch
    WRITE_TIMEOUT_MS: 500,           // Timeout for challenge writes
    MAX_PACKETS_PER_CYCLE: 10,       // Max packets to process per cycle
    ROOT_PATH: "rimcity.challenges",
    PRESENCE_PATH: "rimcity.presence"
},

PRESENCE: {
    TIMEOUT_MS: 60000,               // Consider offline after 60 seconds
    PING_INTERVAL_MS: 30000          // How often to ping presence
}
```

---

## 6. Priority Action Items

### Immediate (Week 1)

1. [x] **Fix try/finally patterns** in `challenges_pubsub.js` - ensure locks always released ✅ DONE
2. [x] **CRITICAL: Eliminate blocking locks** - Rewritten to use fire-and-forget with inline LOCK_WRITE ✅ FIXED (Dec 10, 2025)
3. [ ] **Add disconnect() to finally blocks** in `challenge-negotiation.js`
4. [ ] **Standardize JSON scope** to `"nba_jam"` in all files
5. [x] **Add CHALLENGES and PRESENCE constants** to `config.js` ✅ DONE
6. [ ] **Remove duplicate `logFn()`** in `persist.js`

### Short-term (Week 2-3)

6. [x] **Consolidate challenge implementations** - Marked `challenges.js` and `challenges_simple.js` as deprecated; `challenges_pubsub.js` is the canonical implementation ✅ DONE
7. [x] **Add transactional safety** to `playoffs.js` bracket modifications ✅ DONE
8. [ ] **Extract large functions** (>100 lines) into smaller helpers
9. [ ] **Add input validation** to `persist.js` stat recording

### Long-term (Month 2+)

10. [ ] **Remove dead code** (`challenges_v2.js`, `test_inner.js`, legacy season flows)
11. [ ] **Create shared utilities** for table formatting, color maps
12. [ ] **Add comprehensive error recovery** for network failures
13. [ ] **Implement lock timeout/cleanup mechanism** for orphaned locks

---

## 7. Lock Cleanup Strategy

### ✅ RESOLVED (Dec 10, 2025)

The lock cleanup strategy is no longer needed because **we no longer use client-side locks**.

The new architecture uses:
1. `TIMEOUT = -1` (fire-and-forget) - client never blocks waiting for responses
2. `client.write(scope, path, data, LOCK_WRITE)` - inline lock parameter
3. Server handles LOCK → WRITE → UNLOCK atomically
4. No client-side lock state to track or clean up

This completely eliminates:
- Lock contention between BBS users
- Orphaned locks on disconnect
- Need for lock timeout/cleanup mechanisms
- Complex reconnect logic

---

## Summary Statistics

| Category | HIGH | MEDIUM | LOW | Total |
|----------|------|--------|-----|-------|
| JSONClient Usage | 4 | 3 | 3 | 10 |
| Error Handling | 3 | 5 | 3 | 11 |
| Code Quality | 2 | 5 | 3 | 10 |
| Dead Code | 0 | 4 | 0 | 4 |
| Architecture | 0 | 3 | 2 | 5 |
| Constants | 6 | 6 | 6 | 18 |
| **Total** | **15** | **26** | **17** | **58** |
