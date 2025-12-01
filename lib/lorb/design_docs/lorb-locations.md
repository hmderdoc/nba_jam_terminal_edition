# LORB Locations

Locations are self-contained screens/areas in the LORB career mode. Each location handles its own UI and game logic.

---

## Location Interface

Every location module exports a `run(ctx)` function:

```javascript
LORB.Locations.YourLocation = {
    run: function(ctx) {
        // Display UI, handle input, modify ctx
        // Return when user exits this location
    }
};
```

The location:
1. Receives the player context
2. Modifies it directly (stats, cash, inventory, etc.)
3. Returns when the player chooses to leave
4. Persistence is handled by the caller (hub)

---

## Current Locations

### Hub (`hub.js`)
**Purpose:** Main menu / central hub (Rim City)

- Shows player status (cash, rep, turns)
- Menu to access all other locations
- Handles day reset logic
- Saves after returning from each location

### Courts (`courts.js`)
**Purpose:** Streetball games against AI opponents

Features:
- Multiple courts with different difficulty/rewards
- Courts unlock based on rep
- Random opponent generation (streetballers)
- NBA player encounters (random chance based on court)
- Game simulation or real NBA JAM engine integration
- Rewards: cash, rep, XP

Court Tiers:
| Court | Rep Required | Difficulty | NBA Chance |
|-------|--------------|------------|------------|
| Court 6 | 0 | 1 | 10% |
| Court 9 | 25 | 2 | 25% |
| Dunk District | 75 | 3 | 40% |
| The Arc | 150 | 4 | 60% |
| Court of Airness | 300 | 5 (Boss) | 80% |

### Shop (`shop.js`)
**Purpose:** Buy equipment and consumables

Categories:
- **Sneakers** - Permanent stat bonuses when equipped
- **Drinks** - Temporary boosts for next game

Uses RichView with multiline menu items showing:
- Item name and price
- Stat bonuses
- Owned/equipped status

### Gym (`gym.js`)
**Purpose:** Train stats using attribute points

- Spend attribute points to increase stats
- Stats capped at 10
- Cost increases with current stat level
- Shows current stats with color coding

### Club 23 (`club23.js`)
**Purpose:** Social area, spectate games, betting

Features:
- Watch CPU vs CPU games
- Place bets on outcomes (if enabled)
- Potential for future multiplayer meetup

### Crib (`crib.js`)
**Purpose:** Player's home - crew management and stats

Submenus:
- **Contacts (Rolodex)** - NBA players you've defeated whose number you got
- **Your Crew** - Active roster of players who run with you (max 5)
- **Stats & Records** - Personal stats (moved from hub)

Contact System:
- Defeat NBA players on courts → they give you their number
- Contacts can be signed temporarily (take % cut of winnings) or permanently (one-time fee)
- Signed players join your crew for 2v2 games

Crew Management:
- Max 5 crew members
- Temp players take a cut of game winnings
- Permanently signed players have no per-game cost
- Release players to make room for new ones

Contact Tiers:
| Tier | Sign Cost | Cut % | Examples |
|------|-----------|-------|----------|
| Superstar | $10,000 | 45% | LeBron, Curry, Jordan |
| Star | $5,000 | 35% | Most starters |
| Role | $2,000 | 25% | Role players |
| Rookie | $1,000 | 20% | Rookies, legends past prime |

### Tournaments (`tournaments.js`)
**Purpose:** Multiplayer rankings and ghost match challenges

Features:
- Leaderboard showing all players across BBSes
- Player stats: W-L record, rep, last played, BBS origin
- Challenge other players to ghost matches
- View detailed stats of other players

Ghost Matches:
- Play against a "ghost" of another player (their stats/AI)
- Async - opponent doesn't need to be online
- Wager system: max of 10% opponent's cash OR all your cash (whichever higher)
- Winner takes the pot, gains rep

Leaderboard Columns:
| Column | Description |
|--------|-------------|
| Player | Name (truncated to 28 chars) |
| W-L | Win-Loss record |
| Rep | Reputation score |
| Last On | When they last played |
| BBS | Which BBS they're from |

---

## RichView vs Legacy

Locations can use either UI system:

```javascript
function run(ctx) {
    if (RichView) {
        return runRichView(ctx);
    } else {
        return runLegacy(ctx);
    }
}
```

**RichView** (modern):
- Zone-based layout
- Lightbar menus with callbacks
- Art/sprite support
- Richer formatting

**Legacy** (fallback):
- Simple line-by-line output
- Basic prompt-based menus
- Works on any terminal

---

## Adding a New Location

### 1. Create the file

```javascript
// lib/lorb/locations/casino.js

var _casinoRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _casinoRichView = RichView;
} catch (e) {}

(function() {
    var RichView = _casinoRichView;
    
    function run(ctx) {
        // Your location logic
    }
    
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Casino = {
        run: run
    };
})();
```

### 2. Load it in lorb.js

```javascript
load(js.exec_dir + "locations/casino.js");
```

### 3. Add to hub menu

In `hub.js`, add to the menu items:

```javascript
{ text: "Casino", value: "casino", hotkey: "C" }
```

And handle the choice:

```javascript
if (choice === "casino") {
    LORB.Locations.Casino.run(ctx);
}
```

---

## Location Best Practices

### Always clean up resources
```javascript
function run(ctx) {
    var view = createView();
    try {
        // ... location logic
    } finally {
        view.close();
    }
}
```

### Validate before spending resources
```javascript
if (ctx.streetTurns <= 0) {
    view.warn("No street turns left!");
    return;
}
ctx.streetTurns--;
// ... proceed with action
```

### Use consistent menu patterns
```javascript
var items = [
    { text: "Option 1", value: "opt1", hotkey: "1" },
    { text: "Option 2", value: "opt2", hotkey: "2" },
    { text: "Back", value: "back", hotkey: "Q" }
];
var choice = view.menu(items, { y: 10 });
```

### Provide feedback for actions
```javascript
ctx.cash += reward;
view.line("\1g+$" + reward + " earned!\1n");
```
