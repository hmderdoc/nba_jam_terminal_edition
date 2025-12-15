# Relationship System & Baby Ballers - Implementation Plan

**Branch:** `relationship_system`  
**Status:** Planning  
**Created:** December 15, 2025  
**Authors:** Implementation Team  

---

## 1. Executive Summary

This document outlines the implementation plan for the Relationship System expansion described in `relationship_and_baby_ballers.md`. The system transforms the existing romance mechanics into a deeper gameplay loop involving:

- **Pregnancy/Child System** - Relationships can result in "Baby Ballers"
- **Baby Mama Management** - Former partners who have your children
- **Child Support Economy** - Financial obligations that affect gameplay
- **Parenting Modes** - How you raise children affects their development
- **Baby Baller Integration** - Children appear in streetball matches
- **Alignment System** - Moral choices around parenting affect your character
- **Traveling Companions** - Fly relationships to your current city

---

## 2. Design Review & Concerns

### 2.1 Strengths of the Proposal

1. **Deep Integration** - Baby Ballers create meaningful connections across multiple systems (economy, streetball, random events, reputation)
2. **Consequences Matter** - Choices have long-term effects (alignment, nemesis system, child support)
3. **Emergent Narratives** - The "Oedipus/Darth Vader" redemption/nemesis arc creates memorable stories
4. **Risk/Reward Balance** - Multiple baby mamas = more drama, monogamy = better outcomes
5. **Replayability** - Alignment paths encourage different playstyles

### 2.2 Design Decisions (Confirmed)

| Topic | Decision |
|-------|----------|
| **Pregnancy Timing** | 3-phase city visit cycle: (1) Trigger pregnancy invisibly during flirt/dinner, (2) Learn at doctor on next visit to partner's city, (3) Birth on visit after that. Baby starts on lowest court tier. |
| **Twins/Triplets** | Traveling companions ONLY can trigger multiples. Twins = rare, Triplets = very rare. Regular flirts = singles only. |
| **Baby Baller Stats** | 30% inherited from parent + randomization + monogamy bonus (can adjust later, not architecturally sensitive) |
| **Child Support** | ALL babies have lifetime balance. While unpaid: 50% of baby's streetball winnings → support, 50% → "spent by baby". Once paid off: can use as teammate (split XP), take to GYM (pay to upgrade). |
| **Court Tiers** | Rename courts to progression: "Middle School" → "High School" → "AAU" → "College" → "NBA". Baby ballers move via rep/skills. |
| **"Dependent" vs "Independent"** | Key distinction is child support status, NOT age. A Middle School player with paid-off support is "independent". |
| **Doctor Visit UX** | RichView: art on left, lightbar + text on right, plus player sprite preview showing what baby will look like |
| **Season Reset** | Baby mamas and children persist PERMANENTLY. Romance ALSO persists (audit existing resets for legacy issues). |
| **Multiple Pregnancies** | Same partner can have multiple children after birth (potential cooldown TBD) |

### 2.3 Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| **Complexity creep** | Phase implementation; core mechanics first |
| **Save file bloat** | Efficient schema; cap max children at 10 |
| **Random event spam** | Rate limiting; player can have max 1 random event per city visit |
| **Balancing nightmare** | Tunable constants in config; iterate based on playtesting |
| **Inappropriate content concerns** | Keep tone comedic/absurdist; no explicit content |

---

## 3. Data Model Expansion

### 3.1 New Context Fields (`ctx`)

```javascript
// Added to player context (saved with character)
{
    // ... existing fields ...
    
    // Hidden Pregnancies (player doesn't see these until Phase 2)
    pregnancies: [
        {
            npcId: "amy_poehler",         // Who is pregnant
            npcName: "Amy Poehler",
            cityId: "bos",                // Her home city
            phase: 1,                     // 1=hidden, 2=discovered, 3=born
            count: 1,                     // 1=single, 2=twins, 3=triplets
            conceivedOnDay: 15,           // When it happened
            discoveredOnDay: null,        // When player found out
            projectedStats: null,         // Set during doctor visit
            projectedAppearance: null,
            projectedCost: null,
            paymentChoice: null           // "abandon" | "installment" | "lump_sum" | "bill_me"
        }
    ],
    
    // Baby Mamas (partners who have given birth)
    babyMamas: [
        {
            id: "amy_poehler",           // NPC identifier
            name: "Amy Poehler",
            cityId: "bos",               // Home city
            relationship: 50,            // Co-parent relationship (-100 to 100)
            childrenIds: ["baby_001"],   // References to babyBallers
            childSupport: {
                totalOwed: 5000,         // Lifetime amount owed
                paidTotal: 2500,         // Lifetime paid
                balance: 2500            // Current outstanding
            },
            isNemesis: false,            // Has relationship soured to enemy?
            lastEventDay: 0              // Rate limiting for random events
        }
    ],
    
    // Children (Baby Ballers)
    babyBallers: [
        {
            id: "baby_001",              // Unique identifier
            name: "Junior",              // Auto-generated, can rename
            nickname: "LIL J",
            motherId: "amy_poehler",     // Reference to babyMama
            bornOnDay: 25,               // Game day of birth
            seasonBorn: 1,               // Which season
            
            // Stats (scale 1-10, start low)
            stats: {
                speed: 3,
                threePt: 2,
                dunk: 4,
                block: 2,
                power: 3,
                steal: 3
            },
            
            // Progression
            level: 1,
            xp: 0,
            rep: 0,
            wins: 0,
            losses: 0,
            
            // Child Support Status
            childSupport: {
                totalOwed: 3000,         // Lifetime cost for THIS child
                balance: 3000,           // Remaining
                isPaidOff: false         // Key: dependent vs independent
            },
            
            // Relationship with parent
            relationship: 75,            // -100 to 100
            isNemesis: false,            // Has become your enemy
            adoptiveFatherId: null,      // If adopted by another player/NPC
            adoptiveFatherName: null,
            
            // Appearance (inherited + random)
            appearance: {
                skin: "brown",
                jerseyColor: "RED",
                jerseyNumber: "1"
            },
            
            // Parenting
            parentingMode: "nurture",    // "nurture" | "neglect" | "abandon"
            monogamyBonus: true,         // Was this a monogamous pregnancy?
            
            // Streetball
            currentCourt: 1,             // 1=Middle School, 5=NBA
            canChallenge: true,
            lastMatchDay: 0,
            streetballEarnings: 0,       // Total won in streetball
            earningsToSupport: 0         // How much went to child support
        }
    ],
    
    // Alignment
    alignment: 0,                        // -100 (evil) to +100 (good)
    alignmentHistory: [],                // Recent changes for display
    
    // Traveling Companion
    travelingCompanion: {
        npcId: null,                     // Currently traveling with you
        npcName: null,
        homeCityId: null,                // Where they're from
        ticketPurchased: false,
        dateCount: 0                     // Dinners/clubs in current city
    },
    
    // Parenting Stats (for crib menu display)
    parentingStats: {
        totalChildren: 0,
        independentChildren: 0,          // Paid off
        dependentChildren: 0,            // Still owe support
        abandonedChildren: 0,
        nemesisChildren: 0,
        totalSupportPaid: 0,
        totalSupportOwed: 0,
        childrenDefeated: 0,             // Oedipus tracker
        defeatedByChildren: 0            // Vader tracker
    }
}
```

### 3.2 Global Shared State Additions

```javascript
// In lorb.sharedState (persistent across all players)
{
    // ... existing fields ...
    
    // Baby Ballers that can be encountered by ANY player
    worldBabyBallers: {
        "baby_001": {
            // Snapshot of baby baller for streetball encounters
            parentId: "vert_123",
            parentName: "Doc",
            name: "Junior",
            stats: { ... },
            level: 3,
            currentCourt: 2,
            rep: 150,
            wins: 5,
            losses: 2
        }
    },
    
    // Baby Baller adoption registry (when kids get "new dads")
    adoptions: {
        "baby_001": {
            adoptedBy: "npc_michael_jordan",
            adoptedByName: "Michael Jordan", 
            adoptedOnDay: 45,
            reason: "parent_abandonment"
        }
    }
}
```

### 3.3 Config Constants (`lib/lorb/config.js`)

```javascript
BABY_BALLERS: {
    // Pregnancy - 3-phase city visit cycle
    PREGNANCY_CHANCE_FLIRT: 0.15,         // 15% per "crib visit" flirt outcome
    PREGNANCY_CHANCE_PARTNER: 0.25,       // Higher if already partner+
    PREGNANCY_CHANCE_COMPANION_DINNER: 0.20, // Traveling companion dinner
    
    // Twins/Triplets (traveling companion only)
    TWINS_CHANCE: 0.08,                   // 8% chance of twins (if pregnant)
    TRIPLETS_CHANCE: 0.01,                // 1% chance of triplets (if pregnant)
    
    // Child Stats
    BASE_STAT_MIN: 1,
    BASE_STAT_MAX: 4,
    INHERITED_STAT_WEIGHT: 0.3,           // 30% from parent
    MONOGAMY_STAT_BONUS: 2,               // +2 to all base stats
    
    // Child Support Economy
    SUPPORT_BASE_AMOUNT: 2000,
    SUPPORT_PER_STAT_POINT: 100,          // Higher stat kids cost more
    SUPPORT_LUMP_SUM_DISCOUNT: 0.25,      // 25% off lump sum
    STREETBALL_WINNINGS_TO_SUPPORT: 0.50, // 50% of baby's wins → support
    STREETBALL_WINNINGS_KEPT: 0.50,       // 50% "spent by baby"
    
    // Paid-Off Benefits
    TEAMMATE_XP_SPLIT: 0.50,              // 50/50 XP split when teammate
    GYM_UPGRADE_COST_MULTIPLIER: 1.5,     // 1.5x normal gym cost for baby
    
    // Alignment
    ALIGNMENT_NURTURE: 10,                // Per positive action
    ALIGNMENT_NEGLECT: -5,                // Per missed payment
    ALIGNMENT_ABANDON: -25,               // Full abandonment
    ALIGNMENT_LUMP_SUM: 15,               // Paying it all off
    
    // Nemesis
    NEMESIS_THRESHOLD: -50,               // Relationship below this = nemesis
    ADOPTION_THRESHOLD: -75,              // Below this, NPC can "adopt" your kid
    
    // Encounters
    MAX_RANDOM_EVENTS_PER_DAY: 1,
    BABY_MAMA_EVENT_CHANCE: 0.20,         // 20% chance per baby mama per city visit
    CHILD_CHALLENGE_CHANCE: 0.15,         // 15% chance to encounter own child
    
    // Parenting Cuts (when child support is PAID OFF)
    NURTURE_EARNINGS_CUT: 0.10,           // 10% of child's winnings to you
    NEGLECT_EARNINGS_CUT: 0.00,           // No cut
    NEMESIS_EARNINGS_PENALTY: 0.05,       // They take 5% FROM you
    
    // Court Tier Names (for display)
    COURT_TIER_NAMES: {
        1: "Middle School",
        2: "High School", 
        3: "AAU",
        4: "College",
        5: "NBA"
    },
    
    // Progression
    CHILD_LEVEL_XP: [0, 100, 250, 500, 1000, 2000, 4000, 7500, 12500, 20000],
    COURT_TIER_BY_REP: { 0: 1, 100: 2, 300: 3, 600: 4, 1000: 5 }
},

TRAVELING_COMPANION: {
    FLIGHT_BASE_COST: 500,
    DINNER_COST: 100,
    CLUB_DATE_COST: 200,
    AFFECTION_PER_DINNER: 5,
    AFFECTION_PER_CLUB: 8,
    MIN_RELATIONSHIP_TO_INVITE: 20        // Must be at least "crush" (affection >= 20)
}
```

---

## 4. Implementation Phases

### Phase 1: Core Pregnancy System (Est. 3-4 days)

**Goals:**
- Implement 3-phase pregnancy city-visit cycle
- Add hidden pregnancy tracking (`pregnancyCount` per relationship)
- Create doctor visit flow with RichView ultrasound preview
- Add baby baller creation on birth
- Support twins/triplets for traveling companions

**The 3-Phase Pregnancy Flow:**

```
PHASE 1: CONCEPTION (Hidden)
┌─────────────────────────────────────────────────────────────┐
│ Player in Club23 (flirt) OR with traveling companion        │
│ → Successful flirt leads to "Go back to your place?" option │
│ → If accepted, roll for pregnancy based on relationship     │
│ → If pregnant: store { npcId, pregnancyCount: 1, phase: 1 } │
│ → Player sees nothing unusual (surprise element)            │
│ → Traveling companion: also roll for twins/triplets         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Next visit to partner's home city)
PHASE 2: DISCOVERY (Doctor Visit)
┌─────────────────────────────────────────────────────────────┐
│ Player enters city where pregnant partner lives             │
│ → Intercept before hub: "Amy Poehler found you!"            │
│ → Forced doctor visit (can't skip)                          │
│ → RichView: ultrasound art left, stats preview right        │
│ → Show: projected stats, appearance preview, support cost   │
│ → Payment options: A) Abandon B) Pay bill C) Lump sum D) Bill me │
│ → Update phase to 2, mark pregnancy acknowledged            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Next visit to partner's home city OR time elapsed)
PHASE 3: BIRTH
┌─────────────────────────────────────────────────────────────┐
│ Player enters city (or season rotation passes city)         │
│ → Birth event triggers                                       │
│ → Baby Baller created with finalized stats                  │
│ → Added to ctx.babyBallers array                            │
│ → Partner becomes "baby_mama" in ctx.babyMamas              │
│ → Baby starts as streetballer on Court 1 (Middle School)    │
│ → Baby added to worldBabyBallers for other players          │
└─────────────────────────────────────────────────────────────┘
```

**Files to Create/Modify:**
- `lib/lorb/data/romance.js` - Add pregnancy trigger logic, phase tracking
- `lib/lorb/data/baby-ballers.js` - **NEW** Core baby baller module
- `lib/lorb/locations/doctor.js` - **NEW** Doctor visit location with RichView
- `lib/lorb/locations/club23.js` - Add "Go to your place?" flirt outcome
- `lib/lorb/locations/hub.js` - Add pregnancy phase checks on city entry
- `lib/lorb/config.js` - Add BABY_BALLERS config section

**Key Functions:**
```javascript
// In romance.js
function checkForPregnancy(ctx, npcId, isTravelingCompanion) { ... }
function rollForMultiples(isTravelingCompanion) { ... } // twins/triplets
function getPregnanciesInPhase(ctx, phase) { ... }
function advancePregnancyPhase(ctx, npcId) { ... }

// In baby-ballers.js  
function createBabyBaller(ctx, babyMamaId, monogamyBonus, count) { ... }
function generateBabyStats(parentStats, monogamyBonus) { ... }
function rollBabyAppearance(parentAppearance) { ... }
function addToWorldBabyBallers(baby, parentCtx) { ... }

// In doctor.js
function runDoctorVisit(ctx, pregnantNpc) { ... }
function showUltrasoundPreview(view, projectedBaby) { ... }
function presentPaymentOptions(ctx, projectedCosts) { ... }

// In hub.js
function checkPregnancyEvents(ctx, currentCity) { ... }
```

### Phase 2: Child Support Economy (Est. 2-3 days)

**Goals:**
- Track child support balances per baby mama
- Implement payment flows (installment, lump sum, bill me)
- Add interest/penalties for unpaid support
- Integrate with daily reset

**Files to Create/Modify:**
- `lib/lorb/core/economy.js` - Add child support functions
- `lib/lorb/locations/hub.js` - Add child support notifications
- `lib/lorb/locations/crib.js` - Add "Baby Mamas & Children" menu

**Key Functions:**
```javascript
// In economy.js
function processChildSupport(ctx) { ... }
function makeChildSupportPayment(ctx, babyMamaId, amount) { ... }
function payLumpSum(ctx, babyMamaId) { ... }
function calculateSupportOwed(babyMama, child) { ... }
```

### Phase 3: Alignment System (Est. 1-2 days)

**Goals:**
- Track alignment based on parenting choices
- Create alignment-based modifiers
- Display alignment in stats/UI

**Files to Create/Modify:**
- `lib/lorb/data/alignment.js` - **NEW** Alignment system
- `lib/lorb/ui/stats_view.js` - Show alignment
- Various locations - Alignment consequences

**Key Functions:**
```javascript
// In alignment.js
function adjustAlignment(ctx, action, amount) { ... }
function getAlignmentTitle(alignment) { ... }  // "Saint", "Deadbeat", etc.
function getAlignmentModifiers(alignment) { ... }
```

### Phase 4: Baby Baller Encounters (Est. 3-4 days)

**Goals:**
- Inject baby ballers into streetball matchmaking
- Implement parent vs child special matches
- Track Oedipus/Vader win records
- Handle earnings cuts based on relationship

**Files to Create/Modify:**
- `lib/lorb/locations/courts.js` - Inject baby ballers as opponents
- `lib/lorb/data/baby-ballers.js` - Add encounter/match logic
- `lib/lorb/core/rules.js` - Add baby baller reward calculations

**Key Functions:**
```javascript
// In courts.js
function getStreetballOpponent(ctx, courtTier) { 
    // Check for baby baller encounters
    var babyOpp = checkBabyBallerEncounter(ctx, courtTier);
    if (babyOpp) return babyOpp;
    // ... existing logic
}

// In baby-ballers.js
function checkBabyBallerEncounter(ctx, courtTier) { ... }
function handleParentChildMatch(ctx, child, result) { ... }
function processChildWinnings(ctx, child, winnings) { ... }
```

### Phase 5: Random Events (Est. 2-3 days)

**Goals:**
- Baby mama random events (money demands, relationship sabotage)
- Baby baller random events (play requests, nemesis challenges)
- Adoption events (kids getting "new dads")

**Files to Create/Modify:**
- `lib/lorb/data/baby-events.js` - **NEW** Baby-related events
- `lib/lorb/lorb_events.ini` - Add new event entries
- `lib/lorb/locations/hub.js` - Trigger random events on entry

**Key Functions:**
```javascript
// In baby-events.js
function checkBabyMamaEvent(ctx) { ... }
function checkChildEvent(ctx) { ... }
function processAdoption(ctx, childId, adopterId) { ... }
function showNemesisReveal(ctx, child) { ... }  // "MJ is my dad now!"
```

### Phase 6: Traveling Companions (Est. 2 days)

**Goals:**
- Buy plane tickets for relationships
- Set traveling companion
- Enable dinner/club dates in any city
- Bonus affection for dedicated partners

**Files to Create/Modify:**
- `lib/lorb/data/companion.js` - **NEW** Traveling companion module  
- `lib/lorb/locations/crib.js` - Add companion management
- `lib/lorb/locations/club23.js` - Add companion date options

**Key Functions:**
```javascript
// In companion.js
function purchaseFlightTicket(ctx, npcId) { ... }
function setTravelingCompanion(ctx, npcId) { ... }
function clearCompanion(ctx) { ... }
function canInviteCompanion(ctx, relationship) { ... }
```

### Phase 7: Crib Menu & Polish (Est. 2-3 days)

**Goals:**
- Full "Baby Ballers & Baby Mamas" crib submenu
- Parent stats dashboard
- Child management (pay support, set parenting mode)
- Family tree visualization

**Files to Create/Modify:**
- `lib/lorb/locations/crib.js` - Major expansion
- `lib/lorb/ui/family_view.js` - **NEW** Family visualization

---

## 5. Testing Strategy

### Unit Tests
- `tests/baby_ballers_creation.test.js` - Stat generation, appearance
- `tests/child_support_economy.test.js` - Payment calculations, interest
- `tests/alignment_system.test.js` - Alignment adjustments, thresholds

### Integration Tests
- `tests/pregnancy_flow.test.js` - Full pregnancy → birth cycle
- `tests/baby_encounter.test.js` - Streetball encounter injection
- `tests/nemesis_arc.test.js` - Relationship decay → nemesis

### Manual Testing Checklist
- [ ] Complete pregnancy cycle (5 days)
- [ ] Pay child support (all methods)
- [ ] Encounter own child in streetball
- [ ] Trigger baby mama random event
- [ ] Achieve nemesis status with child
- [ ] Test adoption trigger
- [ ] Use traveling companion system
- [ ] Verify alignment changes correctly

---

## 6. Migration Plan

### Existing Save Compatibility
- New fields have sensible defaults
- Existing romance relationships preserved
- No breaking changes to existing schema

### Data Migration Script
```javascript
// scripts/migrate_relationship_system.js
function migratePlayer(ctx) {
    if (!ctx.babyMamas) ctx.babyMamas = [];
    if (!ctx.babyBallers) ctx.babyBallers = [];
    if (typeof ctx.alignment === "undefined") ctx.alignment = 0;
    if (!ctx.travelingCompanion) ctx.travelingCompanion = { npcId: null };
    if (!ctx.parentingStats) ctx.parentingStats = { totalChildren: 0, ... };
    return ctx;
}
```

---

## 7. Documentation Updates Required

After implementation:
- [ ] Update `docs/lorb/architecture.md` - Context model, new modules
- [ ] Update `current_architecture_docs/constant_reference.md` - New config values
- [ ] Create `docs/lorb/baby-ballers.md` - System documentation
- [ ] Update `lib/lorb/design_docs/Romance_System.md` - Pregnancy additions

---

## 8. Remaining Open Questions

Most design questions have been resolved. A few minor items remain:

1. **Baby naming:** Auto-generated with option to rename at crib? Or player chooses at birth?
   - *Leaning: Auto-generated, rename later*

2. **Multiple baby mamas hard cap:** Is there a maximum?
   - *Leaning: Soft cap via drama events, maybe hard cap at 5-10*

3. **NPC "adoption" list:** Which NPCs can adopt abandoned children?
   - *Leaning: NBA stars from rosters.ini (Jordan, LeBron, etc.)*

4. **Cross-BBS baby ballers:** Should children appear for other players on same BBS network?
   - *Leaning: Yes, via worldBabyBallers in sharedState*

---

## 9. Pre-Implementation Task: Court Tier Renaming

Before Phase 1, we should rename the court tiers for thematic consistency with baby baller progression.

**Current → New:**
| Current Name | Current Tagline | New Name | New Tagline | Tier |
|--------------|-----------------|----------|-------------|------|
| Court 6 | "Rookie Proving Grounds" | Middle School | "Where Legends Begin" | 1 |
| Court 9 | "Regulars Only" | High School | "Varsity Dreams" | 2 |
| Dunk District | "Dunkers Rule Here" | AAU | "Elite Prospects" | 3 |
| The Arc | "Sniper's Haven" | College | "March Madness" | 4 |
| Court of Airness | "The Red Bull Waits" | NBA | "The Show" | 5 |

**Files to modify:**
- `lib/lorb/locations/courts.js` - `COURTS` object (lines ~75-115)
- `lib/lorb/config.js` - Add `BABY_BALLERS.COURT_TIER_NAMES` constant

**Note:** The boss court (tier 5) may need special handling since it hosts the Red Bull challenge. Consider keeping "Court of Airness" as a subtitle or alternate name for that specific boss encounter.

This is a quick win that sets up the baby baller progression metaphor and makes the progression feel more natural.

---

## 10. Season Reset Audit

Per user request, audit what currently resets on season change. Romance and baby data should **NOT** reset.

### Current Reset Behavior (NEEDS FIX)

**File:** `lib/lorb/core/season.js` - `resetSeasonWorldState()` (lines 510-545)

```javascript
// CURRENT CODE - THIS IS WRONG, NEEDS TO BE REMOVED:
// Clear marriage locks via Persist.writeShared if available
if (LORB.Persist && LORB.Persist.writeShared) {
    LORB.Persist.writeShared("lorb.marriages", {});  // <-- DELETES ALL MARRIAGES!
}

// Clear romance registry
if (LORB.Data && LORB.Data.Romance && LORB.Data.Romance.clearMarriageRegistry) {
    LORB.Data.Romance.clearMarriageRegistry();  // <-- ALSO DELETES ALL MARRIAGES!
}
```

### Required Changes

1. **Remove marriage clearing from season reset** - Delete lines 536-543 in `season.js`
2. **Remove or deprecate `clearMarriageRegistry()`** - Or repurpose for admin-only world wipe
3. **Verify `clearPlayerRomance()` is never called** - Currently only exported, not used (safe)

### Files to Audit:
- [x] `lib/lorb/core/season.js` - **FOUND BUG** - Clears marriages on season reset
- [ ] `lib/lorb/core/playoffs.js` - Check `transitionSeason()` 
- [ ] `lib/lorb/util/shared-state.js` - `resetSeason()` only resets season counter (OK)
- [ ] `lib/lorb/data/romance.js` - Functions exist but aren't called elsewhere (OK)
- [ ] `lib/lorb/locations/hub.js` - Daily reset logic (need to verify)

### Expected Persistence Behavior (GOAL):
| Data | Should Persist? | Current Status |
|------|-----------------|----------------|
| `ctx.romance` | ✅ YES | ❓ Need to verify |
| `ctx.romance.relationships` | ✅ YES | ❓ Need to verify |
| Global marriage registry | ✅ YES | ❌ **CLEARED ON RESET** |
| `ctx.pregnancies` (new) | ✅ YES | N/A (new field) |
| `ctx.babyMamas` (new) | ✅ YES | N/A (new field) |
| `ctx.babyBallers` (new) | ✅ YES | N/A (new field) |
| `ctx.alignment` (new) | ✅ YES | N/A (new field) |
| `ctx.travelingCompanion` (new) | ✅ YES | N/A (new field) |

**Action Item:** Before implementing Phase 1, fix the season reset bug by removing marriage clearing from `resetSeasonWorldState()`.

---

## 11. Next Steps

1. ~~**🔴 FIX CRITICAL BUG:** Remove marriage clearing from `season.js` `resetSeasonWorldState()`~~ ✅ **DONE**
2. ~~**Rename court tiers** - Quick thematic improvement (Middle School → NBA)~~ ✅ **DONE**
3. **Create Phase 1 skeleton** - Core pregnancy 3-phase flow
4. **Iterate** - Playtest, adjust constants, add depth
5. **Complete phases 2-7** - Sequential implementation

---

## Changelog

### December 15, 2025 - Pre-Implementation Tasks

**1. Fixed Season Reset Bug** ([season.js](../core/season.js#L535-L538))
- Removed `LORB.Persist.writeShared("lorb.marriages", {})` call
- Removed `LORB.Data.Romance.clearMarriageRegistry()` call  
- Added comment explaining romance/family data persists across seasons

**2. Renamed Court Tiers** ([courts.js](../locations/courts.js#L77-L122))
| Old Name | New Name | New ID |
|----------|----------|--------|
| Court 6 | Middle School | `middle_school` |
| Court 9 | High School | `high_school` |
| Dunk District | AAU Circuit | `aau` |
| The Arc | College | `college` |
| Court of Airness | The League | `nba` |

**3. Updated Streetball Names** - Now thematically match court tiers (e.g., "Lil' Hoops" for middle school, "Varsity Vic" for high school)

**4. Added COURT_TIERS to config.js** - Central reference for court tier metadata

---

*This document will be updated as implementation progresses.*
