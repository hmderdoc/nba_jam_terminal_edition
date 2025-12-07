# LORB Crew System

The crew system allows players to recruit defeated NBA players as teammates for 2v2 games.

---

## Overview

After defeating an NBA player on the courts, they give you their contact info. You can then call them to either:
1. **Temp deal** - They run with you but take a percentage of your winnings
2. **Permanent signing** - Pay a one-time fee, they're yours forever

---

## Data Model

### ctx.contacts
Array of contact objects:
```javascript
{
    id: "lebron_james",         // Unique ID (snake_case of name)
    type: "nba",                // Always "nba" for contacts
    name: "LeBron James",       // Display name
    team: "Lakers",             // NBA team (optional)
    status: "contact",          // "contact" | "temp" | "signed"
    signCost: 10000,            // One-time fee to sign permanently
    cutPercent: 45,             // % of winnings if temp
    tier: "superstar",          // "superstar" | "star" | "role" | "rookie"
    stats: {
        speed: 88,
        threePt: 75,
        dunk: 92,
        block: 80,
        power: 85,
        steal: 72
    },
    dateAcquired: 1234567890    // Timestamp when contact was obtained
}
```

### ctx.crew
Array of crew member references:
```javascript
[
    { contactId: "lebron_james", slot: 0 },
    { contactId: "ja_morant", slot: 1 },
    // max 5 members
]
```

---

## Contact Acquisition

Contacts are awarded when defeating NBA players on the courts:

```javascript
// In courts.js after winning vs NBA opponent:
var newContact = LORB.Util.Contacts.awardContactFromVictory(ctx, opponent);
if (newContact) {
    // Show "You got their number!" message
}
```

Only NBA players give contacts. Streetballers do not.

---

## Tier System

Players are categorized by tier which determines sign cost and cut percentage:

| Tier | Sign Cost | Cut % | Detection |
|------|-----------|-------|-----------|
| Superstar | $10,000 | 45% | Name matches known superstar list |
| Star | $5,000 | 35% | Average stat >= 85 |
| Role | $2,000 | 25% | Average stat >= 70 |
| Rookie | $1,000 | 20% | Default tier |

### Superstar List
Known superstars detected by name fragment:
- jordan, lebron, curry, durant, kobe, shaq
- bird, magic, hakeem, kareem, wilt
- giannis, jokic, luka

---

## Crew Management

### Adding to Crew
From Contacts view, call a player:
1. **Temp deal** - Adds to crew immediately, status becomes "temp"
2. **Sign permanent** - Pay signCost, status becomes "signed", adds to crew

### Crew Limits
- Maximum 5 crew members
- Player character counts as the 6th for 2v2 (matches rosters.ini 6-player teams)
- Must release someone before adding if full

### Releasing
Remove a crew member from Your Crew view. They remain in contacts and can be re-added later.

---

## Winnings & Cuts

When winning a game with temp crew members, cuts are calculated:

```javascript
var result = LORB.Util.Contacts.applyCrewCut(ctx, grossWinnings);
// result = {
//     gross: 500,           // Original winnings
//     net: 275,             // After cuts
//     cuts: [
//         { name: "LeBron James", amount: 225, percent: 45 }
//     ],
//     totalCut: 225
// }
```

### Display Flow
After a win in courts.js:
```
You won $500!

Crew cuts:
  LeBron James (45%): -$225

Net earnings: $275
```

---

## Integration Points

### courts.js
1. After defeating NBA player: call `awardContactFromVictory()`
2. After winning any game: call `applyCrewCut()` on winnings
3. Before game: optionally let player select crew member for 2v2

### crib.js
- Contacts view: browse all contacts, call to negotiate
- Crew view: see active crew, release members, view stats

### tournaments.js
- Ghost matches use player's crew data when creating AI opponent

---

## API Reference

### LORB.Util.Contacts

| Function | Description |
|----------|-------------|
| `createContact(nbaPlayer, ctx)` | Create contact object from player data |
| `addContact(ctx, contact)` | Add contact to ctx.contacts |
| `hasContact(ctx, id)` | Check if contact exists |
| `getContact(ctx, id)` | Get contact by ID |
| `getCrewWithContacts(ctx)` | Get crew members with full contact data |
| `calculateCrewCut(ctx)` | Get total % cut from temp members |
| `applyCrewCut(ctx, amount)` | Calculate cuts and return breakdown |
| `getRandomCrewMember(ctx)` | Get random crew member for 2v2 |
| `awardContactFromVictory(ctx, opponent)` | Award contact after win |

---

## Future Enhancements

1. **Crew chemistry** - Bonuses for certain player combinations
2. **Player moods** - Temp players might leave if not played with
3. **Training** - Improve crew member stats over time
4. **Injuries** - Players temporarily unavailable
5. **Trading** - Trade contacts with other players
