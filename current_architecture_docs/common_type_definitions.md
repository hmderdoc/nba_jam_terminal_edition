## Common Type Definitions (Wave 24 Runtime)

This reference captures structural shapes that recur across the Wave 24 code path beginning at `nba_jam.js`. Every entry points to the module that constructs the data so contributors can confirm details in code before touching consumers.

---

### SystemsBundle (`lib/core/system-init.js`)

| Key | Type | Notes |
| --- | --- | --- |
| `stateManager` | `{ get(path), set(path, value, reason), mutate(fn, reason), subscribe(path, cb) }` | Wraps `gameState`. Only sanctioned path for mutating runtime data. |
| `eventBus` | `{ on(event, handler), emit(event, payload) }` | Decouples systems (passing, possession, UI). |
| `frameScheduler` | `{ waitForNextFrame(ms), now(), schedule(fn, delayMs) }` | Central timing utility; replacements for `mswait`. |
| `passingSystem` | Return value of `createPassingSystem` | Validates passes, primes inbound flow, records assists. |
| `possessionSystem` | Return value of `createPossessionSystem` | Handles possession swaps, inbound assignments, defender matchups. |
| `shootingSystem` | Return value of `createShootingSystem` | Governs shot resolution, block checks, rim physics. |
| `animationSystem` | Instance of `AnimationSystem` | Queues non-blocking shot/pass/dunk/rebound animations. |

Every subsystem invoked from `nba_jam.js` receives the bundle instead of cherry-picking globals—new code must follow the same dependency-injection pattern.

---

### Frame Handles (`lib/rendering/frame-manager.js`)

- **Descriptor** – Internally stored `{ factory, frame }` entry created via `FrameManager.define(name, factory)`.
- **Handle** – The live Synchronet `Frame` returned by `FrameManager.ensure(name)` / `.get(name)`.
- **Alias** – Legacy globals (`trailFrame`, `scoreFrame`, `leftHoopFrame`, etc.) wired to the manager through `FrameManager.alias`.

Never instantiate ad-hoc frames. Define them inside `initFrames` so the manager can recreate or close them cleanly after console resets or multiplayer role switches.

---

### PlayerSprite (`lib/core/sprite-init.js`, `lib/game-logic/movement-physics.js`)

| Field | Type | Description |
| --- | --- | --- |
| `x`, `y` | `number` | Tile coordinates, updated every frame. |
| `prevX`, `prevY` | `number` | Saved to support collision rollback. |
| `bearing` | `"n"|"s"|"e"|"w"` | Determines which ASCII art column renders. |
| `frame` | `Frame` | Sprite-specific frame managed by the renderer. |
| `labelFrame` | `Frame` | Optional HUD tag for controller labels. |
| `playerData` | [`PlayerData`](#playerdata) | Back-reference to roster/AI state. |
| `moveTo(x, y)` | `function` | Repositions sprite; clamps handled elsewhere. |
| `getcmd(key)` | `function` | Applies KEY_* commands and drives animation ticks. |
| `forcePos` | `boolean` | Signals that clients must snap to authoritative coords. |

Sprites are transport objects; all gameplay intelligence lives in `playerData` and the systems bundle.

---

### PlayerData (`lib/game-logic/player-class.js`)

Attached to `sprite.playerData` at creation time.

| Field | Type | Notes |
| --- | --- | --- |
| `name`, `jersey`, `shortNick` | `string` | Display metadata used by announcer + HUD. |
| `attributes` | `[speed, threePoint, dunk, power, steal, block]` | 0–10 ratings read from rosters. |
| `turbo`, `turboActive`, `lastTurboUseTime` | `number / boolean` | Synced with HUD + multiplayer turbo broadcasts. |
| `stats` | `{ points, assists, rebounds, ... }` | Box-score accumulation. |
| `heatStreak`, `onFire`, `fireMakeStreak` | `number / boolean` | Drives hot-streak logic. |
| `aiState`, `aiTargetSpot`, `aiCooldown` | `string / object / number` | Finite-state machine inputs consumed by AI modules. |
| `controllerLabel`, `controllerIsHuman` | `string / boolean` | Scoreboard metadata derived from controller assignment. |
| `knockdownTimer`, `shakeCooldown`, `shoveCooldown`, `stealRecoverFrames` | `number` | Physical-play timers used by multiple subsystems. |

Mutate these fields through helpers (`setTurbo`, `resetAllDefenseMomentum`, etc.) so multiplayer broadcasts stay consistent.

---

### GameState (`lib/game-logic/game-state.js`)

Managed exclusively by `stateManager`.

- **Critical fields** (serialized by multiplayer): `gameRunning`, `timeRemaining`, `shotClock`, `score`, `currentTeam`, `ballCarrier`, `ballX/Y`, `phase`, `reboundActive`, `inbounding`.
- **Loop-local timers** (coordinator only): `ballHandlerStuckTimer`, `ballHandlerAdvanceTimer`, `backcourtTimer`, `violationPauseUntil`.
- **Presentation data** (clients may diverge): `announcer`, `scoreFlash`, `jumpIndicators`, HUD overlays.
- **Auxiliary plans**: `inboundPositioning`, `inboundPassData`, `defensiveAssignments`, `reboundScramble`.

Any new field must be seeded in `createDefaultGameState()`, reset in `resetGameState()`, and noted in `game-state.md`.

---

### InboundPassData (`lib/game-logic/possession.js`, `lib/game-logic/violations.js`)

Blueprint used by `phase-handler.js` and multiplayer serialization to run inbound plays without blocking:

```js
{
    inbounder: <PlayerSprite>,
    inbounderX: <number>,
    inbounderY: <number>, // often -2 so the inbounder starts off-screen
    receiver: <PlayerSprite>,
    team: "teamA" | "teamB"
}
```

Stored via `stateManager.set("inboundPassData", ...)` and cleared once the pass animates.

---

### InboundPositioning (`stateManager.get("inboundPositioning")`)

Describes scripted movement targets during whistles:

```js
{
    inbounder: { sprite, startX, startY, targetX, targetY },
    receiver: { sprite, startX, startY, targetX, targetY },
    defenders: [
        { sprite, startX, startY, targetX, targetY },
        ...
    ]
}
```

`phase-handler.handleInboundSetup()` animates these entries; multiplayer uses them to allow temporary off-court sprites.

---

### MovementPreviewResult (`lib/game-logic/movement-physics.js`)

Return shape of `previewMovementCommand(sprite, key)` used by authority and prediction paths.

| Field | Type | Description |
| --- | --- | --- |
| `canMove` | `boolean` | `true` when the move stays inside `PLAYER_BOUNDARIES` **or** reduces an existing boundary violation (re-entry shim). |
| `nextX`, `nextY` | `number` | Coordinates to apply if the move is accepted. Re-entry moves are clamped back onto the valid court strip. |
| `attemptedX`, `attemptedY` | `number` | Raw coordinates before clamping. |
| `dx`, `dy` | `-1, 0, 1` | Direction delta inferred from the key. |
| `blockedByBounds` | `boolean` | Indicates the move was rejected because it would extend or preserve an out-of-bounds violation. |

Clients consult this preview to avoid predicting moves the coordinator will immediately roll back.

---

### AnimationTask (`lib/rendering/animation-system.js`)

Objects stored inside `animationSystem.animations`.

Common fields: `{ type, startX, startY, targetX, targetY, step, steps, msPerStep, durationMs, startedAt, shooter|sprite, made, blocked, style, frames, onComplete }`.

When multiplayer is active, the coordinator mirrors these payloads (see `mp_coordinator.collectAnimationSyncPayload()`) so clients can replay them deterministically.

---

### Multiplayer Packets

**State Packet** (`mp_coordinator.captureState()`):

```js
{
    f: <frameNumber>,
    t: <timestamp>,
    p: [ { x, y, b, d, k, s, t, T, o, vx, vy, anim, allowOffcourt?, fp? }, ... ],
    b: { x, y, c, r },
    g: <serialized subset of gameState>,
    m: <playerIndexMap>,
    anims?: [ <animation payloads> ],
    ah?: [ { type, target, ttl, meta? } ]
}
```

Clients read the most recent packet from `Queue("nba_jam.game.<sessionId>.state.<playerId>")`, update remote sprites via `updateOtherPlayers`, then call `reconcileMyPosition`.

**Input Packet** (`mp_client.inputBuffer.flush()`):

```js
{
    seq: <monotonic integer>,
    f: <frameNumber when flushed>,
    inputs: [
        { key, turbo: <boolean>, time: <timestamp> },
        ...
    ]
}
```

The coordinator replays the buffered inputs against authoritative sprites (using `applyMovementCommand`) before broadcasting the resulting state.

---

** Event Payloads (`systems.eventBus`)

Event bus payloads stay small and predictable:

- `pass_complete` → `{ passerId, receiverId, quality, timestamp }`
- `score` → `{ team, points, shooterId, dunk, assistId }`
- `violation` → `{ type: "shot_clock" | "backcourt" | ..., team, clock, reason }`
- `animation_debug` → `{ type, spriteId, state, frameNumber }`
- `ah` entries represent animation hints broadcast by the coordinator. Each hint includes a `type` string, the target player global ID (`target`), a remaining lifetime in frames (`ttl`), and a `meta` object containing animation payload (e.g., `attackerId`, `pushDistance`). Clients resolve the target to a sprite and invoke the corresponding animation helpers immediately (no stateManager staging).

Document any new event payload here so multiplayer serialization and diagnostics can keep pace.

---

### LORB Season Stats (`lib/lorb/util/career-stats.js`)

Player context (`ctx`) now supports per-season statistics in addition to all-time career stats.

**Career Stats (All-Time)**

```js
ctx.careerStats = {
    gamesPlayed: <number>,
    totals: {
        points: <number>,
        rebounds: <number>,
        assists: <number>,
        steals: <number>,
        blocks: <number>,
        turnovers: <number>,
        fgm: <number>,
        fga: <number>,
        tpm: <number>,
        tpa: <number>,
        dunks: <number>,
        injuries: <number>
    }
}
```

**Season Stats (Per-Season)**

```js
ctx.seasonStats = {
    [seasonNumber]: {
        gamesPlayed: <number>,
        wins: <number>,
        losses: <number>,
        totals: { /* same structure as careerStats.totals */ }
    }
}
```

**Records (Single-Game Bests)**

```js
ctx.records = {
    [statKey]: {
        value: <number>,
        date: <timestamp>,
        opponent: <string|null>,
        court: <string|null>
    }
}

ctx.seasonRecords = {
    [seasonNumber]: {
        [statKey]: { /* same structure as records */ }
    }
}
```

**Key Functions**

- `recordGame(ctx, gameStats, gameInfo)` - Records stats to both career and current season
- `recordWinLoss(ctx, isWin, seasonNumber?)` - Records win/loss to season stats
- `getStatsForSeason(ctx, season)` - Returns stats for specific season or "all" for career
- `getRecordsForSeason(ctx, season)` - Returns records for specific season or "all" for career
- `getCurrentSeason()` - Returns current season number from SharedState
- `getPlayerSeasons(ctx)` - Returns array of season numbers player has data for
