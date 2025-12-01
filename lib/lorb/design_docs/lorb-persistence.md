# LORB Persistence System

The persistence system uses Synchronet's JSON-DB service for networked character storage. Characters can be accessed from any BBS connected to the same JSON service.

---

## Implementation

**File:** `lib/lorb/util/persist.js`

**Depends on:** `json-client.js` (Synchronet's JSON-DB client)

---

## Connection

LORB connects to the JSON-DB service, using the same infrastructure as multiplayer.

### Server Configuration

Checks for `lib/config/lorb_server.ini` first:
```ini
name=LORB Server
addr=localhost
port=10088
```

Falls back to local JSON service at `localhost:10088` if no config exists.

### Database Paths

- **Scope:** `nba_jam`
- **Players path:** `lorb.players`
- **Individual player:** `lorb.players.<global_id>`

---

## Global Player IDs

Players are identified by a cross-BBS unique ID:

```
<bbs_id>_<user_number>
```

Example: `mybbs_42`

The BBS ID comes from `system.qwk_id` or `system.name`, sanitized to alphanumeric characters.

---

## API

### LORB.Persist.connect()

Establishes connection to JSON-DB. Called automatically by other methods.

```javascript
if (LORB.Persist.connect()) {
    // Connected
}
```

### LORB.Persist.disconnect()

Closes the JSON-DB connection. Call when exiting LORB.

```javascript
LORB.Persist.disconnect();
```

### LORB.Persist.load(user)

Loads player data from JSON-DB.

```javascript
var ctx = LORB.Persist.load(user);
if (!ctx) {
    // New player - run character creation
    ctx = LORB.Character.create();
    ctx._user = user;
}
```

**Parameter:** `user` - Synchronet user object

**Returns:** Player context object or `null` if not found

### LORB.Persist.save(ctx)

Saves player data to JSON-DB.

```javascript
LORB.Persist.save(ctx);
```

**Parameter:** `ctx` - Player context (must have `ctx._user` set)

**Returns:** `true` on success, `false` on failure

**Saved data includes:**
- All context properties (except those starting with `_`)
- `_globalId` - Cross-BBS unique identifier
- `_lastSave` - Timestamp
- `_bbsId` - Source BBS identifier
- `_bbsName` - Source BBS name

### LORB.Persist.exists(user)

Checks if a player save exists.

```javascript
if (LORB.Persist.exists(user)) {
    // Has existing character
}
```

### LORB.Persist.remove(user)

Deletes a player's saved data.

```javascript
LORB.Persist.remove(user);  // Start fresh
```

### LORB.Persist.getGlobalPlayerId(user)

Returns the global ID for a user.

```javascript
var globalId = LORB.Persist.getGlobalPlayerId(user);
// e.g., "mybbs_42"
```

---

## Leaderboard Functions

### LORB.Persist.listPlayers()

Returns array of all player summaries.

```javascript
var players = LORB.Persist.listPlayers();
// Returns: [{ globalId, name, level, wins, losses, rep, bbsName }, ...]
```

### LORB.Persist.getLeaderboard(limit, sortBy)

Returns top players sorted by a field.

```javascript
var topByWins = LORB.Persist.getLeaderboard(10, "wins");
var topByRep = LORB.Persist.getLeaderboard(10, "rep");
var topByLevel = LORB.Persist.getLeaderboard(5, "level");
```

**Parameters:**
- `limit` - Max players to return (default: 10)
- `sortBy` - Field to sort by: `"wins"`, `"rep"`, or `"level"` (default: `"wins"`)

---

## Locking

Uses JSON-DB lock constants:
- `LOCK_READ` (1) - For read operations
- `LOCK_WRITE` (2) - For write/delete operations

---

## Cross-BBS Play

Because player IDs include the BBS identifier, players from different BBSes can:
- Appear on the same leaderboard
- Have their stats compared
- Potentially compete (if multiplayer is implemented)

Each player's `_bbsName` is stored so leaderboards can show where players come from.

---

## Error Handling

All persistence operations are wrapped in try/catch. Failures are logged via `log(LOG_ERR, ...)` but don't crash the game. The context object remains in memory even if saves fail.

---

## When to Save

Save should be called:
- After completing a game (win or loss)
- After purchasing items in the shop
- After training stats at the gym
- Before exiting LORB
- After any significant state change

The hub typically handles the exit save, but locations should save after transactions.
