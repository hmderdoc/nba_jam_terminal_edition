# Live Challenge Betting Negotiation — Design Document

## Overview

This document specifies the betting negotiation flow for live PvP challenges. Currently, live challenges are simple accept/decline prompts with no wager. This design adds a negotiation phase where players agree on stakes before the match begins.

---

## Goals

1. **Allow wagering on live matches** — cash and/or rep at stake
2. **Negotiation flow** — back-and-forth until both agree or someone cancels
3. **Fair limits** — neither player can bet more than they or their opponent can cover
4. **Informed decisions** — show opponent stats before committing
5. **Graceful exit** — either party can cancel at any point

---

## Current State (Reference)

### Challenge Record Shape (challenges.js)
```javascript
{
    id: "ch_<fromGid>_<toGid>_<timestamp>_<rand>",
    from: { globalId, name, bbsName, appearance, activeTeammate, stats, ... },
    to: { globalId, name, bbsName, appearance, activeTeammate, stats, ... },
    status: "pending" | "accepted" | "declined" | "cancelled",
    createdAt: <ms>,
    updatedAt: <ms>,
    expiresAt: <ms>,  // 5 minute TTL
    lobby: { ready: { gid: bool }, lastPing: { gid: ms } },
    meta: {}
}
```

### Current Flows
- **Challenger** (tournaments.js `startLiveChallenge`): sendChallenge → waitForReady → launchLorbMatch
- **Challengee** (hub.js `handleIncomingChallenge`): see prompt → accept/decline → waitForReady → launchLorbMatch

### Ghost Challenge Betting (tournaments.js `challengePlayer`)
Already has wager input with validation:
- Max wager = min(player's cash, max(10% of opponent's cash, player's cash))
- Wager deducted upfront, returned + winnings on victory

---

## Proposed Data Shape Changes

### Challenge Record — Add `wager` Object
```javascript
{
    // ... existing fields ...
    wager: {
        // Current offer (mutated during negotiation)
        cash: 0,           // Cash amount currently proposed
        rep: 0,            // Rep amount currently proposed
        
        // Absolute max (what both players can afford)
        absoluteMax: {
            cash: 500,     // min(A's cash, B's cash)
            rep: 100       // min(A's rep, B's rep)
        },
        
        // Negotiation ceiling (locked after first counter)
        ceiling: {
            cash: 200,     // Max anyone can propose for cash
            rep: 50,       // Max anyone can propose for rep
            locked: false  // Becomes true after challengee's first counter
        },
        
        // Negotiation state
        proposedBy: "from" | "to",   // Who made the current offer
        revision: 0,                  // Increment on each counter-offer
        history: [                    // Audit trail for UI display
            { by: "from", cash: 200, rep: 50, ts: <ms> },
            { by: "to", cash: 300, rep: 75, ts: <ms> }  // raised ceiling
        ]
    }
}
```

### New Challenge Statuses
Extend `status` enum:
- `"pending"` — initial state, challenger's max wager proposed, waiting for challengee
- `"negotiating"` — both players exchanging counter-offers (ceiling locked)
- `"accepted"` — both parties agreed on wager, entering lobby ready phase
- `"declined"` — challengee rejected outright
- `"cancelled"` — either player withdrew
- `"expired"` — TTL hit without resolution

---

## Negotiation Flow — State Machine

```
    ┌───────────┐
    │   IDLE    │
    └─────┬─────┘
          │ A sends challenge with their MAX wager (cash + rep)
          v
    ┌─────────────────┐
    │ PENDING         │  (B's turn — first response)
    │ ceiling = A.max │
    └───────┬─────────┘
            │
            ├── B declines ──────────────────────────> [DECLINED]
            │
            ├── B accepts A's offer ─────────────────> [ACCEPTED] ──> lobby ──> game
            │
            └── B counters (higher or lower)
                      │
                      │  If B's counter > A's offer (for cash or rep):
                      │    ceiling.cash = max(A.cash, B.cash)
                      │    ceiling.rep  = max(A.rep, B.rep)
                      │    (each capped by absolute max)
                      │  Else:
                      │    ceiling stays at A's offer
                      │
                      v
                ┌─────────────────────────────────────────────────────┐
                │                 NEGOTIATING                         │
                │  ceiling locked — offers can only go ≤ ceiling      │
                │  unlimited counters until accept or cancel          │
                └───────┬─────────────────────────────────────────────┘
                        │
                        │ Either player can:
                        │   • Accept current offer ──────> [ACCEPTED] ──> lobby ──> game
                        │   • Counter (≤ ceiling) ──────> stays in NEGOTIATING
                        │   • Cancel ───────────────────> [CANCELLED]
                        │
                        └── Timeout (2 min total) ──────> [EXPIRED]
```

### Rules

1. **Challenger sets their MAX first** — "I'll bet up to $X cash and Y rep"
   - This becomes the initial ceiling for both cash and rep

2. **Challengee's first counter can raise the ceiling** (one-time opportunity):
   - If they counter higher (cash or rep), the higher value becomes the new ceiling for that resource
   - If they counter lower or equal, ceiling stays at Challenger's original
   - This is the ONLY time anyone can raise the stakes
   - Cash and rep ceilings are tracked independently

3. **After first counter, ceiling is locked:**
   - Unlimited counter-offers allowed
   - All subsequent offers must be ≤ ceiling (for both cash AND rep)
   - Forces negotiation to converge toward agreement

4. **Absolute cap always applies:** Neither player can ever propose more than `min(A's resources, B's resources)` for each resource type

5. **Cancel always available:** Either party can exit at any point

6. **Timeout:** 45s to respond to any offer, 2 min total negotiation timeout

---

## UI Mockups (ANSI Text)

### Challenger: Initial Offer Screen
```
═══════════════════════════════════════════════════════════════════════════════
                            CHALLENGE: SHADOWBALLER
═══════════════════════════════════════════════════════════════════════════════

  Opponent Stats:
  ───────────────
  Record: 15-8 (65%)    Rep: 450    Level: 12
  PPG: 18.2   APG: 4.1   SPG: 2.3

  Their Cash: $1,250    Their Rep: 450
  Your Cash:  $800      Your Rep:  120

  Maximum Wager Possible: $800 cash, 120 rep
  (Limited by your resources)

  Set Your MAXIMUM Wager:
  ────────────────────────
  Cash: $____    (You're willing to bet UP TO this amount)
  Rep:  ____     (Opponent may counter for less or more, up to the max)

  [ENTER] Send Challenge    [Q] Cancel
═══════════════════════════════════════════════════════════════════════════════
```

### Challengee: Incoming Challenge Screen (First Response)
```
═══════════════════════════════════════════════════════════════════════════════
                         INCOMING CHALLENGE!
═══════════════════════════════════════════════════════════════════════════════

  From: HOOPMASTER
  ────────────────
  Record: 22-10 (69%)    Rep: 890    Level: 18
  PPG: 21.5   APG: 5.2   SPG: 1.8

  Their Proposed MAX Wager:
  ─────────────────────────
  Cash: $200    Rep: 25

  Your Cash: $450    Your Rep: 120
  Absolute Max: $200 cash, 120 rep (limited by what both players have)

  Options:
    [A] Accept $200 / 25 rep (play for their proposed amount)
    [C] Counter-Offer (propose different stakes — can go higher or lower)
    [D] Decline (cancel challenge)

  NOTE: This is your only chance to raise the stakes above $200 / 25 rep!
═══════════════════════════════════════════════════════════════════════════════
```

### Challengee: First Counter Screen (Can Raise)
```
═══════════════════════════════════════════════════════════════════════════════
                         COUNTER-OFFER (First)
═══════════════════════════════════════════════════════════════════════════════

  Their Proposed MAX: $200 cash, 25 rep
  Absolute Max: $200 cash, 120 rep (what both players can afford)
  
  Your Counter:
  ─────────────
  Cash: $____    (Can go higher up to $200, or lower)
  Rep:  ____     (Can go higher up to 120, or lower)

  This is your ONLY chance to raise the stakes!
  After this, all offers must stay at or below your counter.
  
  [ENTER] Send Counter    [Q] Decline Challenge
═══════════════════════════════════════════════════════════════════════════════
```

### Negotiating: Counter-Offer Screen (Ceiling Locked)
```
═══════════════════════════════════════════════════════════════════════════════
                            COUNTER-OFFER
═══════════════════════════════════════════════════════════════════════════════

  Negotiation Ceiling: $350 cash, 75 rep (locked)
  Current Offer: $300 cash, 60 rep
  
  Your Counter:
  ─────────────
  Cash: $____    (Max: $350)
  Rep:  ____     (Max: 75)

  [ENTER] Send Counter    [A] Accept $300 / 60 rep    [X] Cancel
═══════════════════════════════════════════════════════════════════════════════
```

### Waiting for Response Screen
```
═══════════════════════════════════════════════════════════════════════════════
                         WAITING FOR RESPONSE...
═══════════════════════════════════════════════════════════════════════════════

  Challenge to: SHADOWBALLER
  Your Offer: $300 cash, 60 rep
  Ceiling: $350 cash, 75 rep

  Waiting for their response... (45s timeout)

  [X] Cancel Challenge
═══════════════════════════════════════════════════════════════════════════════
```═══════════════════════════════════════════════════════════════════════════════
```

### Waiting Screens
```
═══════════════════════════════════════════════════════════════════════════════
                         WAITING FOR RESPONSE...
═══════════════════════════════════════════════════════════════════════════════

  Challenge sent to SHADOWBALLER
  Wager: $200 cash, 25 rep

  Waiting for them to respond...  (45s timeout)

  [Q] Cancel Challenge
═══════════════════════════════════════════════════════════════════════════════
```

---

## Implementation Plan

### Phase 1: Data Layer (challenges.js)
1. Add `wager` field to challenge creation with `ceiling` and `absoluteMax`
2. Add `calculateAbsoluteMax(fromCtx, toPlayer)` helper
3. Add `counterOffer(id, ctx, offer, isFirstCounter)` function:
   - If `isFirstCounter`: can raise ceiling up to absoluteMax, then lock
   - Otherwise: validate offer ≤ ceiling
4. Update `acceptChallenge` to validate wager is agreed
5. Add `isOfferValid(wager, offer)` validation helper

### Phase 2: Challenger UI (tournaments.js)
1. Add `showWagerInput(ctx, opponent)` → returns `{ cash, rep }` or null
2. Modify `startLiveChallenge` to:
   - Show opponent stats before wager input
   - Include wager with ceiling in `sendChallenge`
   - Enter negotiation loop: poll for responses, handle counters
3. Add `showNegotiationScreen(challenge, ctx)` for counter-offer flow

### Phase 3: Challengee UI (hub.js)
1. Modify `handleIncomingChallenge` to:
   - Display challenger stats and wager
   - Explain this is their only chance to raise stakes
   - Offer Accept / Counter / Decline options
2. Add `showFirstCounterInput(challenge, ctx)` — can raise ceiling
3. Add `showCounterInput(challenge, ctx)` — ceiling locked version
4. Enter negotiation loop after first counter

### Phase 4: Post-Match Wager Settlement
1. Modify `processPvpMatchResults` in hub.js to:
   - Read agreed wager from challenge record
   - Apply cash/rep changes based on outcome
   - Winner gets: their stake back + opponent's stake
   - Loser loses: their stake (already deducted)
2. Handle ties: both get stakes returned

### Phase 5: Edge Cases & Polish
1. Disconnect during negotiation → auto-cancel after timeout
2. Both players go offline → challenge expires, stakes returned
3. Wager validation on both ends (prevent tampering)
4. Show negotiation history in UI

---

## Constants (to add in timing-constants.js or game-mode-constants.js)

```javascript
LORB_CHALLENGE_BETTING: {
    offerTimeoutMs: 45000,            // 45s to respond to any offer
    totalNegotiationTimeoutMs: 120000, // 2 min total negotiation window
    minWager: 0,                       // Allow $0 "for honor" matches
    allowRepWager: true,               // Enable rep wagering
    escrowOnAccept: true               // Lock funds only after acceptance (not during negotiation)
}
```

---

## Validation Rules

### Absolute Max — What Both Players Can Afford
```javascript
function calculateAbsoluteMax(myCtx, opponentData) {
    return {
        cash: Math.min(myCtx.cash || 0, opponentData.cash || 0),
        rep: Math.min(myCtx.rep || 0, opponentData.rep || 0)
    };
}
```

### Ceiling Logic
```javascript
function updateCeiling(wager, newOffer, isFirstCounter) {
    if (!isFirstCounter) {
        // After first counter, ceiling is locked — can only go equal or lower
        return {
            valid: newOffer.cash <= wager.ceiling.cash && 
                   newOffer.rep <= wager.ceiling.rep,
            ceiling: wager.ceiling
        };
    }
    
    // First counter from challengee — can raise ceiling up to absolute max
    var newCeiling = {
        cash: Math.min(
            Math.max(wager.ceiling.cash, newOffer.cash),
            wager.absoluteMax.cash
        ),
        rep: Math.min(
            Math.max(wager.ceiling.rep, newOffer.rep),
            wager.absoluteMax.rep
        ),
        locked: true  // Lock after first counter
    };
    
    return { valid: true, ceiling: newCeiling };
}
```

### Example Negotiation
```
Player A has $800 cash, 120 rep
Player B has $500 cash, 200 rep

Absolute Max: $500 cash (limited by B), 120 rep (limited by A)

1. A proposes: $200 cash, 50 rep
   → ceiling = { cash: 200, rep: 50, locked: false }

2. B counters: $400 cash, 100 rep (wants higher stakes)
   → ceiling = { cash: 400, rep: 100, locked: true }
   (B raised both, now locked)

3. A counters: $350 cash, 80 rep
   → valid (both ≤ ceiling), ceiling unchanged

4. B counters: $375 cash, 90 rep
   → valid (both ≤ ceiling), ceiling unchanged

5. A counters: $450 cash, 90 rep
   → INVALID (cash 450 > ceiling 400)

6. A counters: $370 cash, 85 rep
   → valid

7. B accepts $370 cash, 85 rep
   → [ACCEPTED] → lobby → game
```

### Edge Case: Challengee Counters Lower
```
1. A proposes: $300 cash, 75 rep
   → ceiling = { cash: 300, rep: 75, locked: false }

2. B counters: $150 cash, 25 rep (wants lower stakes)
   → ceiling = { cash: 300, rep: 75, locked: true }
   (B didn't raise, ceiling stays at A's original, now locked)

3. Now both must negotiate between $0-300 cash, 0-75 rep
```

### Settlement Math
```javascript
function settleWager(wager, iWon, isTie) {
    if (isTie) {
        return { cashDelta: 0, repDelta: 0 };  // Stakes returned
    }
    if (iWon) {
        // Winner gets opponent's stake (their own was deducted upfront)
        return {
            cashDelta: wager.cash * 2,  // Get back mine + win theirs
            repDelta: wager.rep * 2
        };
    } else {
        // Loser already had stake deducted, no further action
        return { cashDelta: 0, repDelta: 0 };
    }
}
```

---

## Testing Plan

### Unit Tests (mock JSONClient)
1. `test_createChallengeWithWager` — wager included in record with ceiling
2. `test_firstCounter_canRaiseCeiling` — challengee's first counter can raise ceiling
3. `test_firstCounter_locksCeiling` — ceiling.locked becomes true after first counter
4. `test_subsequentCounter_cannotExceedCeiling` — validation rejects offers above ceiling
5. `test_absoluteMax_limitsAll` — no offer can exceed absolute max
6. `test_settleWager_win` — winner gets double
7. `test_settleWager_tie` — both get stakes back
8. `test_settleWager_loss` — loser gets nothing back

### Integration Tests (real JSON service)
1. Full negotiation flow: send → counter (raise) → counter → accept → ready → match
2. Counter lower flow: send → counter (lower) → accept
3. Timeout scenarios: pending expires, offer expires
4. Cancel scenarios: challenger cancels, challengee declines mid-negotiation

### Manual Testing Checklist
- [ ] Challenger can set max wager and send
- [ ] Challengee sees stats and wager, can accept/counter/decline
- [ ] Challengee's first counter can raise ceiling (up to absolute max)
- [x] Ceiling locks after first counter
- [x] Subsequent counters cannot exceed ceiling
- [x] Unlimited counter-offers allowed within ceiling
- [x] Either player can accept or cancel at any time
- [x] Match completion settles wager correctly
- [x] Tie returns stakes to both (no exchange on tie)
- [ ] Cancel at any point returns stakes (TODO: verify escrow behavior)
- [ ] Timeout returns stakes (TODO: verify escrow behavior)

---

## Implementation Status

### Completed
- **Phase 1**: Data layer in `challenges_simple.js` (production module)
  - `calculateAbsoluteMax(ctx, targetPlayer)` - min of both players' resources
  - `createWagerObject(initialOffer, absoluteMax)` - creates wager with ceiling
  - `applyCounterOffer(wager, offer, by)` - validates and applies counter, handles first-counter ceiling raise
  - `createChallenge()` now accepts optional `wagerOffer` parameter
  - `submitCounterOffer(id, ctx, offer)` - submit counter via updateChallenge
  - `acceptWager(id, ctx)` - accept current wager offer
  - `isMyTurnToRespond(ch, myGlobalId)` - check whose turn to respond
  - `getWagerDetails(challenge)` - get formatted wager details

- **Phase 2/3**: Integrated UI module `challenge_negotiation_v2.js`
  - Single-view approach - no screen switching during negotiation
  - Live countdown timer displayed in same view
  - Clear status messaging about what we're waiting for
  - Challenger flow: `showChallengerWagerInput()` handles input + waiting + counter-offers
  - Challengee flow: `showIncomingChallenge()` handles response + waiting
  - Polling loops with inline status updates

- **Phase 4**: Integration
  - `tournaments.js startLiveChallenge()` - calls new integrated negotiation UI
  - `hub.js handleIncomingChallenge()` - calls new negotiation UI
  - `hub.js processPvpMatchResults()` - settles wager after match

### Files Modified
| File | Changes |
|------|---------|
| `lib/lorb/boot.js` | Loads `challenge_negotiation_v2.js` |
| `lib/lorb/multiplayer/challenges_simple.js` | Added wager helpers, createChallenge wager param, counter/accept/turn functions |
| `lib/lorb/multiplayer/challenge_negotiation_v2.js` | **NEW** - Integrated single-view UI for wager negotiation |
| `lib/lorb/locations/tournaments.js` | Updated `startLiveChallenge` to use new integrated UI |
| `lib/lorb/locations/hub.js` | Updated `handleIncomingChallenge` to use new UI, added wager settlement |

### Deprecated
- `challenge_negotiation.js` - Original implementation with view-switching (replaced by v2)

---

## Open Questions

1. **Should odds be adjustable?** Initial design uses even money (1:1). Could add handicap betting later.

2. **Rep wagering optional?** Could make rep-only or cash-only wagers possible. Design allows `0` for either.

3. **Minimum wager?** Allow $0 "for honor" matches? Current design allows it.

4. **Escrow during negotiation?** Should wager be locked immediately when proposed, or only after acceptance?
   - **Recommendation**: Lock on proposal, refund on cancel/decline/timeout

5. **Wager history visible?** Should players see past wager history with an opponent?
   - **Recommendation**: Defer to future, focus on core flow first

---

## Files to Modify

| File | Changes |
|------|---------|
| `lib/lorb/multiplayer/challenges.js` | ✓ Add wager field, updateWager, counterOffer, validation helpers |
| `lib/lorb/multiplayer/challenge_negotiation.js` | ✓ NEW - RichView UI module |
| `lib/lorb/locations/tournaments.js` | ✓ Wager input UI, counter-offer handling, update startLiveChallenge |
| `lib/lorb/locations/hub.js` | ✓ Update handleIncomingChallenge with stats/wager display, counter option |
| `lib/lorb/locations/hub.js` | ✓ Modify processPvpMatchResults to settle wager |
| `lib/config/timing-constants.js` | Defer - using existing LORB_CHALLENGES constants |
| `docs/lorb/challenges.md` | TODO - Update with new wager fields and flow |

---

## Revision History

| Date | Author | Notes |
|------|--------|-------|
| 2024-12-05 | Copilot | Initial design document |
| 2024-12-05 | Copilot | Implementation complete: data layer, UI, integration |
