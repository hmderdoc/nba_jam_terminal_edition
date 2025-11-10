# Error Handling Patterns

**Created**: Wave 21 - November 7, 2025  
**Purpose**: Standardize error handling across NBA JAM codebase

---

## Overview

This document establishes consistent error handling patterns for the NBA JAM codebase. After analysis, three different error handling patterns were identified in use. This document provides guidelines on when to use each pattern.

---

## Pattern 1: Guard Clauses (PREFERRED for most cases)

**When to use:**
- Function parameters may be invalid
- Object properties may not exist
- Early exit conditions that are not errors

**Example:**
```javascript
function handlePlayerMovement(player) {
    // Guard: Invalid player
    if (!player) return;
    
    // Guard: Missing player data
    if (!player.playerData) return;
    
    // Guard: Game paused (expected condition, not an error)
    if (gameState.paused) return;
    
    // ... actual logic here
}
```

**Advantages:**
- Clean, readable code
- Prevents nested if statements
- Fast execution (no try/catch overhead)

**When to add logging:**
```javascript
function handlePlayerMovement(player) {
    if (!player) {
        log(LOG_DEBUG, "handlePlayerMovement: null player (expected during cleanup)");
        return;
    }
    
    if (!player.playerData) {
        log(LOG_WARNING, "handlePlayerMovement: player missing playerData");
        return;
    }
    
    // ... logic
}
```

**Guidelines:**
- ✅ Use for guard clauses
- ✅ Add comments to distinguish errors from expected conditions
- ✅ Log at DEBUG level for expected cases
- ✅ Log at WARNING level for unexpected cases
- ❌ Don't log every single guard (too noisy)

---

## Pattern 2: Try/Catch Blocks

**When to use:**
- Loading optional modules
- External I/O operations (file, network)
- Code that might throw exceptions
- When you need to recover from errors

**Example:**
```javascript
// Optional module loading
var multiplayerEnabled = false;
try {
    load(js.exec_dir + "lib/multiplayer/mp_client.js");
    multiplayerEnabled = true;
} catch (mpLoadError) {
    log(LOG_WARNING, "Multiplayer load failed: " + mpLoadError);
}

// Network operations
try {
    var response = network.send(packet);
    processResponse(response);
} catch (networkError) {
    log(LOG_ERROR, "Network error: " + networkError);
    // Fallback logic
    handleNetworkFailure();
}
```

**Advantages:**
- Prevents crashes from external failures
- Allows graceful degradation
- Can provide specific error information

**Guidelines:**
- ✅ Always log the caught error
- ✅ Include context (what operation failed)
- ✅ Implement fallback/recovery logic
- ✅ Include error details (fileName, lineNumber if available)
- ❌ Don't use empty catch blocks
- ❌ Don't catch errors you can't handle

---

## Pattern 3: Input Validation (NEW in Wave 21)

**When to use:**
- Network data from multiplayer
- User input from external sources
- Any data from outside the game

**Example:**
```javascript
function handlePlayerUpdate(data) {
    // Validate entire packet
    var validation = validatePlayerUpdate(data);
    
    if (!validation.valid) {
        log(LOG_WARNING, "Invalid player update: " + validation.errors.join(", "));
        return;
    }
    
    // Use validated data
    var validData = validation.data;
    updatePlayer(validData.playerId, validData.x, validData.y);
}
```

**Advantages:**
- Prevents malicious/corrupted data from causing issues
- Provides detailed error information
- Can sanitize/clamp values

**Guidelines:**
- ✅ Always validate network data
- ✅ Log validation failures
- ✅ Use validated/sanitized values, not raw input
- ✅ Clamp numeric values to safe ranges
- ❌ Don't trust external data
- ❌ Don't skip validation for "trusted" sources

---

## Decision Tree

```
Is this external data (network, user input)?
├─ YES → Use Pattern 3 (Input Validation)
└─ NO
    │
    Can this operation throw an exception?
    ├─ YES → Use Pattern 2 (Try/Catch)
    └─ NO
        │
        Is this a guard condition?
        └─ YES → Use Pattern 1 (Guard Clauses)
```

---

## Specific Scenarios

### Scenario: Loading Modules

**Pattern**: Try/Catch (Pattern 2)

```javascript
try {
    load(js.exec_dir + "lib/optional-feature.js");
} catch (loadError) {
    log(LOG_WARNING, "Optional feature load failed: " + loadError + 
        " (at " + (loadError.fileName || "?") + ":" + 
        (loadError.lineNumber || "?") + ")");
}
```

### Scenario: Null/Undefined Checks

**Pattern**: Guard Clauses (Pattern 1)

```javascript
function updatePlayerStats(player, points) {
    if (!player) return;  // Guard: null player
    if (!player.playerData) return;  // Guard: missing data
    if (!player.playerData.stats) {
        player.playerData.stats = {};  // Initialize if missing
    }
    
    player.playerData.stats.points += points;
}
```

### Scenario: Network Operations

**Pattern**: Input Validation + Try/Catch (Patterns 3 + 2)

```javascript
function handleNetworkPacket(rawPacket) {
    // Validate first
    var validation = validatePacket(rawPacket, ["type", "playerId"]);
    if (!validation.valid) {
        log(LOG_WARNING, "Invalid packet: " + validation.error);
        return;
    }
    
    // Then process with try/catch
    try {
        processPacket(rawPacket);
    } catch (processError) {
        log(LOG_ERROR, "Packet processing failed: " + processError);
    }
}
```

### Scenario: Expected Conditions

**Pattern**: Guard Clauses with comments (Pattern 1)

```javascript
function updateAI(player) {
    // Expected: Game paused
    if (gameState.paused) return;
    
    // Expected: Player not controlled by AI
    if (player.controlledBy !== "ai") return;
    
    // Unexpected: Missing AI data
    if (!player.playerData) {
        log(LOG_WARNING, "AI update: player missing playerData");
        return;
    }
    
    // ... AI logic
}
```

---

## Logging Levels

### LOG_DEBUG
- Expected guard conditions
- Verbose operational info
- Only shown when debugging enabled

```javascript
if (!player) {
    log(LOG_DEBUG, "updatePlayer: null player (expected during cleanup)");
    return;
}
```

### LOG_WARNING
- Unexpected but recoverable conditions
- Validation failures
- Degraded functionality

```javascript
if (!posCheck.valid) {
    log(LOG_WARNING, "Invalid position: " + posCheck.error);
}
```

### LOG_ERROR
- Serious issues
- Exception catches
- Data loss or corruption

```javascript
catch (error) {
    log(LOG_ERROR, "Critical failure: " + error);
}
```

---

## Anti-Patterns to Avoid

### ❌ Silent Failures
```javascript
// BAD: No indication something went wrong
function processData(data) {
    if (!data) return;
    // ... logic
}

// GOOD: Log unexpected conditions
function processData(data) {
    if (!data) {
        log(LOG_WARNING, "processData: missing data");
        return;
    }
    // ... logic
}
```

### ❌ Empty Catch Blocks
```javascript
// BAD: Swallows all errors
try {
    riskyOperation();
} catch (e) {
    // Nothing
}

// GOOD: Log and handle
try {
    riskyOperation();
} catch (e) {
    log(LOG_ERROR, "Operation failed: " + e);
    handleFailure();
}
```

### ❌ Catching Everything
```javascript
// BAD: Too broad
try {
    // Hundreds of lines
} catch (e) {
    // Which line failed?
}

// GOOD: Targeted try/catch
var data = prepareData();  // Let this fail if broken

try {
    sendData(data);  // Only protect I/O
} catch (e) {
    log(LOG_ERROR, "Network send failed: " + e);
}
```

### ❌ Trusting External Data
```javascript
// BAD: No validation
function updatePosition(data) {
    sprite.x = data.x;  // What if x is "hacker"?
    sprite.y = data.y;  // What if y is 99999?
}

// GOOD: Validate first
function updatePosition(data) {
    var posCheck = validatePlayerPosition(data.x, data.y);
    sprite.x = posCheck.x;  // Guaranteed valid
    sprite.y = posCheck.y;
}
```

---

## Wave 21 Improvements

### Added:
1. **Input validation module** (`lib/utils/validation.js`)
   - validatePlayerPosition()
   - validatePlayerId()
   - validatePlayerUpdate()
   - sanitizeString()

2. **Load order guards** in `nba_jam.js`
   - Verify critical modules loaded
   - Fail fast with clear error messages

3. **Network validation** in multiplayer
   - All position data validated
   - Coordinates clamped to court bounds
   - Invalid data logged

### Before Wave 21:
```javascript
// No validation
var targetX = pos.x;
var targetY = pos.y;
```

### After Wave 21:
```javascript
// Validated and clamped
var posCheck = validatePlayerPosition(pos.x, pos.y);
if (!posCheck.valid) {
    log(LOG_DEBUG, "Invalid position: " + posCheck.error);
}
var targetX = posCheck.x;  // Safe to use
var targetY = posCheck.y;
```

---

## Summary

**Three patterns, three use cases:**

1. **Guard Clauses** → Parameter validation, early exits
2. **Try/Catch** → External operations, exceptions
3. **Input Validation** → Network data, user input

**Always:**
- ✅ Log unexpected conditions
- ✅ Provide context in error messages
- ✅ Handle or propagate, don't swallow
- ✅ Validate external data
- ✅ Fail fast when critical

**Never:**
- ❌ Empty catch blocks
- ❌ Silent failures on errors
- ❌ Trust external data
- ❌ Over-broad try/catch

---

**End of Error Handling Patterns Guide**
