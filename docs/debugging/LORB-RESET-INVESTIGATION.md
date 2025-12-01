# LORB Character Reset - Investigation Report

## Problem Statement
The RESET command in LORB's hub.js calls `LORB.Persist.remove(ctx._user)` which reports success but does not actually delete the character data from JSON-DB.

---

## Hypothesis

**The `client.remove()` call is missing the required `LOCK_WRITE` parameter.**

### Evidence from Source Code Analysis

**json-client.js signature:**
```javascript
this.remove = function(scope, location, lock) {
    this.send({
        scope: scope,
        func: "QUERY",
        oper: "DELETE",
        location: location,
        lock: lock,  // <-- CRITICAL
        timeout: this.settings.TIMEOUT
    });
    if(this.settings.TIMEOUT >= 0)
        return this.wait();
}
```

**json-db.js server-side `remove()` method:**
```javascript
this.remove = function(request, record) {
    var client = request.client;
    if(record.data === undefined || !record.data.hasOwnProperty(record.property)) {
        return true;  // Already doesn't exist
    }
    else if(record.shadow[record.property]._lock[client.id] && 
            record.shadow[record.property]._lock[client.id].type == locks.WRITE) {
        delete record.data[record.property];  // SUCCESS - requires WRITE lock
        return true;
    }
    else {
        this.error(client, errors.NOT_LOCKED);  // FAIL - no lock held
        return false;
    }
};
```

**Key insight:** The server requires the client to hold a WRITE lock before it will delete the record.

### Current LORB Code (persist.js line ~237)
```javascript
client.remove(DB_SCOPE, path);  // Missing third parameter!
```

### Working Examples from Other Synchronet Projects

**synchronetris/service.js:**
```javascript
client.remove(game_id, "games." + gameNumber, 2);
```

**synchronetris/lobby.js:**
```javascript
client.remove(game_id, "games." + gnum + ".players." + profile.name, 2);
```

All working examples pass `2` (LOCK_WRITE) as the third parameter.

---

## Failure Sequence

1. `LORB.Persist.remove(user)` is called
2. `client.remove(DB_SCOPE, path)` sends DELETE with `lock: undefined`
3. Server treats undefined lock as `locks.NONE`
4. Server's query handler does NOT acquire a lock
5. Server's `remove()` method checks for WRITE lock - none exists
6. Server returns `NOT_LOCKED` error
7. Client throws exception, caught by try/catch
8. Code continues, thinking operation succeeded (exception was caught)
9. Character data remains in database

---

## Verification Plan

### Step 1: Create Test Script
Create `/sbbs/xtrn/nba_jam/tests/json-remove-test.js`:
```javascript
load("json-client.js");

var LOCK_WRITE = 2;
var client = new JSONClient("localhost", 10088);

// Create test data
client.write("nba_jam", "test.remove_check", { foo: "bar" }, LOCK_WRITE);
print("Created test data");

// Try remove WITHOUT lock (should fail)
try {
    client.remove("nba_jam", "test.remove_check");
    print("Remove without lock: no exception thrown");
} catch (e) {
    print("Remove without lock FAILED: " + e);
}

var check1 = client.read("nba_jam", "test.remove_check", 1);
print("After remove without lock: " + JSON.stringify(check1));

// Try remove WITH lock (should succeed)
try {
    client.remove("nba_jam", "test.remove_check", LOCK_WRITE);
    print("Remove with lock: success");
} catch (e) {
    print("Remove with lock FAILED: " + e);
}

var check2 = client.read("nba_jam", "test.remove_check", 1);
print("After remove with lock: " + JSON.stringify(check2));

client.disconnect();
```

### Step 2: Run Test
```bash
/sbbs/exec/jsexec /sbbs/xtrn/nba_jam/tests/json-remove-test.js
```

### Expected Results
- Remove without lock: Should throw "Record not locked" error, data persists
- Remove with lock: Should succeed, data is deleted (returns undefined)

---

## Fix (Once Hypothesis Verified)

In `/sbbs/xtrn/nba_jam/lib/lorb/util/persist.js`, change:
```javascript
client.remove(DB_SCOPE, path);
```
To:
```javascript
client.remove(DB_SCOPE, path, LOCK_WRITE);
```

Also remove the speculative code I added (write null fallback, verification check).

---

## Code to Revert

The following speculative changes should be reverted:
1. The `client.write(null)` fallback in `remove()`
2. The verification read after remove
3. The extra archetype check in `load()`

These were added without proper investigation and don't address the root cause.
