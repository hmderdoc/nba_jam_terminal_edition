# LORB Architecture Overview

**LORB** (Legend of Rim Breaker) is a single-player career mode that wraps the NBA JAM game engine. Players create a character, build stats, earn money, and progress through streetball courts while occasionally encountering real NBA players.

---

## Entry Point

```
lib/lorb/lorb.js
```

This is the main entry point. It initializes all LORB subsystems and manages the main menu flow.

---

## Core Subsystems

### 1. LORB.View
**File:** `lib/lorb/ui/view.js`

The legacy text-based UI system. Provides:
- `clear()`, `header()`, `line()`, `warn()`, `info()`, `prompt()`
- Simple menu rendering
- Used as fallback when RichView is unavailable

### 2. LORB.Persistence
**File:** `lib/lorb/persistence.js`

Handles saving/loading character data. See `lorb-persistence.md` for details.

### 3. LORB.Locations
**Files:** `lib/lorb/locations/*.js`

Each location is a self-contained module with a `run(ctx)` function:
- `hub.js` - Main hub (Rim City) with location menu
- `courts.js` - Streetball courts, opponent encounters
- `shop.js` - Equipment and consumables
- `gym.js` - Stat training
- `club23.js` - Spectate games, betting

### 4. LORB.Character
**File:** `lib/lorb/character.js`

Character creation and management. Handles:
- New character wizard
- Archetype selection (Slasher, Sharpshooter, etc.)
- Appearance customization
- Initial stat allocation

### 5. RichView Integration
**File:** `lib/ui/rich-view.js`

Modern zone-based UI used by newer LORB screens. See `lorb-richview.md` for details.

---

## The Context Object (`ctx`)

All LORB functions receive and modify a context object that represents the player's state:

```javascript
ctx = {
    // Identity
    name: "PlayerName",
    odtuid: "unique_id",
    
    // Progression
    level: 1,
    xp: 0,
    rep: 0,
    cash: 100,
    
    // Stats (1-10 scale)
    stats: {
        speed: 5,
        "3point": 5,
        dunk: 5,
        power: 5,
        steal: 5,
        block: 5
    },
    
    // Appearance
    appearance: {
        skin: "brown",           // brown, lightgray, magenta
        jerseyColor: "RED",
        jerseyNumber: "23",
        eyeColor: "BROWN"
    },
    
    // Archetype
    archetype: "SLASHER",        // Affects stat bonuses and playstyle
    
    // Resources
    streetTurns: 5,              // Actions per day
    attributePoints: 0,          // Unspent stat points
    
    // Inventory
    inventory: {
        sneakers: [],
        drinks: []
    },
    equipped: {
        sneakers: null
    },
    
    // Records
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    
    // Daily tracking
    dayStats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        cashEarned: 0,
        repGained: 0
    }
}
```

---

## Game Integration

LORB connects to the main NBA JAM engine via `runExternalGame()`:

```javascript
// From courts.js
var config = {
    teamA: {
        name: "Player's Squad",
        abbr: "YOU",
        players: [playerData, teammateData],
        colors: { fg: "WHITE", bg: "BG_RED" }
    },
    teamB: {
        name: "Court Crew",
        abbr: "OPP", 
        players: [opponent1, opponent2],
        colors: { fg: "WHITE", bg: "BG_BLUE" }
    },
    options: {
        gameTime: 90,
        mode: "play",
        humanTeam: "teamA",
        humanPlayerIndex: 0,
        showMatchupScreen: true,
        showGameOverScreen: false
    },
    lorbContext: {
        court: "court6",
        difficulty: 1,
        opponent: opponentData
    }
};

var result = runExternalGame(config);
// result = { completed: true, winner: "teamA", score: { teamA: 21, teamB: 15 } }
```

See `lorb-integration.md` for full details on game bridging.

---

## File Structure

```
lib/lorb/
├── lorb.js                 # Main entry point
├── persistence.js          # Save/load system
├── character.js            # Character creation
├── get_random_opponent.js  # NBA player encounters
├── design_docs/            # This documentation
│   ├── lorb-architecture.md
│   ├── lorb-persistence.md
│   ├── lorb-locations.md
│   ├── lorb-richview.md
│   └── lorb-sprite-rendering.md
├── locations/
│   ├── hub.js
│   ├── courts.js
│   ├── shop.js
│   ├── gym.js
│   └── club23.js
└── ui/
    ├── view.js             # Legacy text UI
    └── sprite_preview.js   # Character preview (working sprite example)
```

---

## Adding New Features

### New Location
1. Create `lib/lorb/locations/your_location.js`
2. Export `LORB.Locations.YourLocation = { run: function(ctx) { ... } }`
3. Add menu entry in `hub.js`

### New Stat/Resource
1. Add to context object default in `character.js`
2. Add to save/load in `persistence.js`
3. Update any UI that displays it

### New Item Type
1. Define item structure in relevant location (shop.js)
2. Add inventory slot to context
3. Add application logic where item takes effect
