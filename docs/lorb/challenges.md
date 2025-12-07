# LORB Live Challenges — JSONClient Flow

Live challenges and presence are **ephemeral** and run against the Synchronet JSON service via **JSONClient**. Durable character data stays in JSONdb. This doc explains the intended split, the data shapes, and how to validate the flow.

## Storage Layers
- **JSONdb (file-backed, `lib/lorb/util/persist.js`)**  \
  Used for: player records, shared state, long-term stats. **Not** used for live challenges or presence.
- **JSONClient (network JSON service, scope `lorb`)**  \
  Used for: presence heartbeats, live challenge buckets, lobby ready/lastPing, and the multiplayer lobby/game sync. **Locks are required** (LOCK_READ/LOCK_WRITE) for presence and challenge paths to avoid JSON service timeouts.

Service config: `localhost:10088`, scope `lorb`, configurable via `LORB.Config.JSON_CLIENT` or `Persist.getServerConfig()`. Helper: `lib/lorb/util/json_client_helper.js` (single shared client, short timeouts/backoff, obeys disable flag).

## Data Shapes
- **Presence** (`presence.<gid>`)  
  `{ globalId, userName, timestamp }` — considered online if fresher than `PRESENCE_TIMEOUT_MS` (60s).
- **Challenge** (`lorb.challenges.<gid>.<challengeId>`)  
  ```
  {
    id, from { globalId, name, bbsName, cash, rep, ... }, to { ... },
    status: "pending" | "negotiating" | "accepted" | "declined" | "cancelled",
    createdAt, updatedAt, expiresAt (5m TTL),
    lobby: { ready: { gid: bool }, lastPing: { gid: ts } },
    meta: {},
    wager: null | <WagerObject>  // See below
  }
  ```
- **Wager Object** (`challenge.wager`) — Optional betting negotiation:
  ```
  {
    cash, rep,                    // Current offer amounts
    absoluteMax: { cash, rep },   // Hard limit (min of both players)
    ceiling: { cash, rep, locked }, // Locks after first counter
    proposedBy: "gid",            // Who made current offer
    revision: <n>,                // Increments each counter
    history: [{ cash, rep, by, at }]  // Audit trail
  }
  ```
  Ceiling rules: Challenger sets initial ceiling → Challengee's first counter can raise it (up to absoluteMax) → Ceiling then locks → Unlimited counters within locked ceiling until accept/cancel.

## Flow (happy path)
1. **Presence**: On enter, `setPresence` writes `presence.<gid>` via JSONClient; `clearPresence` removes on exit. `getOnlinePlayers` reads the same scope/path.
2. **Create challenge**: Challenger writes the record into both buckets (`from` and `to`) under `lorb.challenges.*` via JSONClient. TTL is 5m; stale/declined/cancelled entries are pruned.
3. **Wager negotiation** (optional): Challenger sets max wager → Challengee can accept/counter/decline → Counter-offers flow until accepted or cancelled. See `challenge_negotiation.js` for UI.
4. **Discover**: `ChallengeService` polls JSONClient every 5s (via event-timer). Hub injects an "Incoming Challenge" menu item immediately when a pending record is seen.
4. **Accept/decline/ready**: Status and lobby.ready/lastPing are written back to both buckets. Each JSONClient read/write/remove is wrapped with LOCK_READ/LOCK_WRITE; failed writes trigger backoff.
5. **Handoff**: Once both sides are ready, control moves to the real-time lobby/game sync (also JSONClient, separate modules). Cleanup of expired/abandoned challenges removes the bucket entries.

## Logging to watch
- `[LORB:JsonClient]` connect/backoff details.
- `[LORB:Challenges]` create/read/update/writeBucket messages; warnings indicate JSONClient timeouts.
- `[LORB:PERSIST] presence.*` for presence reads/writes, scope `lorb`.
Timeouts or missing buckets usually mean the JSON service is unreachable or the scope is wrong.

## Tests and Harnesses
- **Unit (mock JSONClient):**  
  - `tests/lorb_challenges.test.js`  
  - `tests/lorb_challenges_flow.js`  
  - `tests/presence_jsonclient.test.js`
- **Integration (real JSON service):**  
  - `tests/lorb_challenges_jsonclient_integration.js` — writes/reads live challenge buckets for two test gids. Run with `/sbbs/exec/jsexec tests/lorb_challenges_jsonclient_integration.js`. Fails fast if the JSON service is unreachable.

## Troubleshooting Checklist
1) JSON service running on `localhost:10088` and reachable.  
2) Scope is `lorb` (presence/challenges both use it).  
3) Locks are taken for presence/challenges (LOCK_READ/LOCK_WRITE) on every JSONClient operation.  
4) Buckets appear under `lorb.challenges.<gid>` within the JSON service.  
5) Debug log shows `[WARN]` only during backoff/expected outages; otherwise create/list/read should be `status=ok` with non-zero counts.
