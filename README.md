# NBA JAM Terminal Edition

A faithful recreation of NBA JAM for Synchronet BBS terminals, featuring authentic arcade gameplay with terminal-based graphics, multiplayer support, and AI opponents.

## Overview

NBA JAM Terminal Edition brings the classic arcade basketball experience to your BBS. Play solo against CPU opponents, watch AI vs AI demo matches, or compete against other users in real-time multiplayer games over the BBS network.

### Features

- **Authentic NBA JAM Gameplay**: 2-on-2 arcade basketball with turbo, shoving, and over-the-top dunks
- **30 NBA Teams**: Complete rosters from the classic era with real player stats
- **Multiple Game Modes**:
  - Single Player vs CPU
  - CPU vs CPU Demo Mode (with betting system)
  - Real-time Multiplayer (up to 4 players)
  - LORB Integration (League play)
- **Advanced AI System**: Intelligent opponents with coordinated team play
- **Betting System**: Place wagers on demo matches
- **Network Multiplayer**: Real-time gameplay using Synchronet's JSON-DB
- **Terminal Graphics**: ANSI/ASCII art with sprite-based rendering

## Installation

### Prerequisites

- Synchronet BBS v3.19 or higher
- `Frame.js` (Synchronet sprite library)
- JSON-DB service enabled for multiplayer

### Setup

1. Copy the `nba_jam` directory to your Synchronet `xtrn` folder:
   ```bash
   cp -r nba_jam /sbbs/xtrn/
   ```

2. Add to `ctrl/xtrn_sec.ini`:
   ```ini
   [NBA JAM]
   name = NBA JAM Terminal Edition
   code = NBAJAM
   cmd = ?nba_jam.js
   ```

3. For multiplayer support, ensure JSON-DB is running:
   ```bash
   # Check ctrl/services.ini
   [JSON-DB]
   Port=10088
   ```

4. Set file permissions:
   ```bash
   chmod -R 755 /sbbs/xtrn/nba_jam
   ```

## Quick Start

### Playing the Game

1. Launch from your BBS main menu or xtrn menu
2. Select game mode:
   - **PLAY** - Play against CPU
   - **DEMO** - Watch CPU vs CPU (with betting)
   - **MULTIPLAYER** - Network play
   - **LORB** - League play (if installed)

### Controls

- **Arrow Keys**: Move player
- **SPACE**: Turbo (sprint/jump/block)
- **ENTER**: Shoot/Pass/Steal
- **S**: Shove opponent
- **Q**: Quit game

### Game Rules

- 4 minute halves (configurable)
- 24 second shot clock
- 5 second closely-guarded violation
- 8 second backcourt violation
- Standard NBA JAM rules (no fouls, no free throws)

## Architecture

The codebase is organized into modular components:

### Core Systems
- **nba_jam.js** - Main orchestrator (1,311 lines)
- **lib/core/** - Core game systems (sprites, state, physics)
- **lib/game-logic/** - Game rules and mechanics

### Player Systems
- **lib/ai/** - AI decision-making and behavior
- **lib/multiplayer/** - Network play coordination

### UI & Rendering
- **lib/ui/** - Menus, HUD, announcer
- **lib/rendering/** - Graphics, sprites, effects

### Utilities
- **lib/utils/** - Helper functions
- **lib/bookie/** - Betting system

See [design_docs/file_layout.md](design_docs/file_layout.md) for complete structure.

## Configuration

Edit global constants at the top of `nba_jam.js`:

```javascript
var GAME_SECONDS = 240;           // Game length (seconds)
var DEMO_GAME_SECONDS = 120;      // Demo game length
var SHOT_CLOCK_SECONDS = 24;      // Shot clock duration
var multiplayerEnabled = true;    // Enable/disable multiplayer
```

## Multiplayer Setup

Multiplayer uses Synchronet's JSON-DB for real-time coordination:

1. **Lobby System**: Players join/create sessions
2. **Team Selection**: Choose teams and roster spots
3. **Coordinator Election**: One player becomes authoritative server
4. **Real-time Sync**: Game state synchronized at 20 FPS

See [design_docs/multiplayer_design_and_architecture.md](design_docs/multiplayer_design_and_architecture.md) for details.

## Development

### Code Organization

After Wave 4 and Wave 5 refactoring:
- Main file reduced from 2,610 to 1,311 lines (50% reduction)
- 9 new specialized modules created
- Clear separation of concerns (AI, rendering, game logic, UI)

### Key Design Patterns

- **State Machine**: Game state management
- **Observer Pattern**: Event broadcasting (announcer, stats)
- **Coordinator Pattern**: Multiplayer synchronization
- **Strategy Pattern**: AI decision-making

See [design_docs/architecture_patterns.md](design_docs/architecture_patterns.md) for details.

### Contributing

Areas for improvement (see design_docs for details):
- **Bug Fixes**: See [potential_bugs_identified.md](design_docs/potential_bugs_identified.md)
- **Missing Features**: See [missing_implementations.md](design_docs/missing_implementations.md)
- **Architecture Cleanup**: See [architecture_mismatches.md](design_docs/architecture_mismatches.md)

## Documentation

Comprehensive design docs available in `design_docs/`:

- **file_layout.md** - Complete file structure
- **architecture_patterns.md** - Design patterns used
- **architecture_mismatches.md** - Technical debt analysis
- **misplaced_functions.md** - Code organization issues
- **human_player_design.md** - Human player input system
- **ai_player_design.md** - AI behavior architecture
- **multiplayer_design_and_architecture.md** - Network play system
- **human_vs_ai_vs_multiplayer_patterns_and_pattern_drift.md** - Pattern evolution
- **potential_bugs_identified.md** - Known issues (26 bugs identified)
- **questions_to_answer.md** - Open design questions (32 items)
- **missing_implementations.md** - Incomplete features (28 items)

## Credits

- **Original NBA JAM**: Midway Games
- **Synchronet BBS**: Rob Swindell (Digital Man)
- **Frame.js**: echicken
- **Development**: [Your credits here]

## License

This is a fan project for Synchronet BBS systems. NBA JAM is a trademark of Midway Games/Warner Bros. Interactive Entertainment.

## Support

For issues, questions, or contributions:
- BBS: [Your BBS details]
- GitHub: [Your repo]
- DOVE-Net: SYNCHRONET echo

---

**Version**: 1.0 (Post Wave 5 Refactoring)  
**Status**: Active Development  
**Last Updated**: November 7, 2025
