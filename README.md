# NBA JAM Terminal Edition

A faithful recreation of NBA JAM for Synchronet BBS terminals, featuring authentic arcade gameplay with terminal-based graphics, multiplayer support, and AI opponents.

Connect your BBS:

`?rlogin futureland.today:4513 -t xtrn=NBA_JAM`
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
- JSON-DB service enabled for multiplayer

### LORB Version Compatibility

LORB (RPG mode) includes automatic version checking to ensure all connected clients are running compatible code. This prevents issues caused by outdated or modified clients connecting to the server.

**How it works:**
- The version is based on the git commit hash of your installation
- When entering LORB, the client checks its version against the server's published version
- The first client to connect establishes the server's version
- Subsequent clients must match this version to connect

**If you see a version mismatch error:**
```
VERSION MISMATCH
Cannot connect to LORB due to version mismatch.
Your version: abc1234
Server version: def5678
Please ask your sysop to update NBA JAM to the latest version.
```

**For sysops:** Update your installation by pulling the latest code:
```bash
cd /sbbs/xtrn/nba_jam
git pull origin main
```

**Note:** If running from a non-git installation (version shows as "unknown"), the version check is skipped to allow development/testing.



## License

This is a fan project for Synchronet BBS systems. NBA JAM is a trademark of Midway Games/Warner Bros. Interactive Entertainment.


