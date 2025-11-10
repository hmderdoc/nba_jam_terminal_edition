# NBA JAM Terminal Edition - Missing Implementations

Features, systems, and functionality that are partially implemented, stubbed out, or missing entirely.

---

## Core Gameplay Missing Features

### 1. Turbo Meter System
**Status**: Partially implemented  
**Missing**: Visual turbo meter, turbo depletion

**What Exists**:
```javascript
player.turboActive = true;  // Boolean flag
```

**What's Missing**:
- Turbo meter UI (0-100%)
- Gradual turbo depletion
- Turbo recharge rate
- Visual feedback (meter bar)

**Implementation Needed**:
```javascript
player.turboMeter = 100;  // 0-100
player.turboRechargeRate = 2;  // per second
player.turboDepletionRate = 10;  // per second when active

// Drain turbo
if (player.turboActive && player.turboMeter > 0) {
    player.turboMeter -= turboDepletionRate / 20;  // 20 FPS
}

// Recharge turbo
if (!player.turboActive && player.turboMeter < 100) {
    player.turboMeter += turboRechargeRate / 20;
}
```

**Priority**: Medium

---

### 2. Alley-Oop System
**Status**: Not implemented  
**Missing**: Entire feature

**Description**: Player throws ball high, teammate catches and dunks mid-air

**Implementation Needed**:
```javascript
function attemptAlleyOop(passer, receiver) {
    // Check if receiver is near basket
    if (getSpriteDistanceToBasket(receiver) > 5) return false;
    
    // Throw high pass
    var alleyOopAnimation = {
        type: "alley-oop",
        passer: passer,
        receiver: receiver,
        duration: 1000
    };
    
    animationSystem.startAnimation(alleyOopAnimation);
}

// During animation
function completeAlleyOop(animation) {
    if (Math.random() < 0.7) {
        // Success - dunk
        scoreBucket(animation.receiver, 2, "alley-oop");
    } else {
        // Fail - turnover
        turnover(animation.receiver.team);
    }
}
```

**Priority**: Low (feature expansion)

---

### 3. Overtime System
**Status**: Not implemented  
**Missing**: Overtime logic when game tied

**What Happens Now**: Game just ends in tie

**Implementation Needed**:
```javascript
if (gameState.timeRemaining <= 0) {
    if (gameState.scores.teamA === gameState.scores.teamB) {
        // Overtime!
        gameState.timeRemaining = 60;  // 1 minute OT
        gameState.currentHalf = 3;  // OT period
        announceEvent("overtime", {});
        continueGame();
    } else {
        endGame();
    }
}
```

**Priority**: Medium

---

### 4. Substitution System
**Status**: Not implemented  
**Missing**: Ability to swap players mid-game

**Use Case**: Fatigue system, injuries (if implemented)

**Implementation Needed**:
```javascript
function showSubstitutionMenu() {
    var roster = getCurrentTeamRoster();
    var onCourt = getTeamPlayers(currentTeam);
    var bench = roster.filter(p => !onCourt.includes(p));
    
    // Display menu
    console.print("Substitute: (select player to replace)\n");
    // ... menu logic
    
    // Swap
    swapPlayer(playerOut, playerIn);
}
```

**Priority**: Low

---

### 5. Timeout System
**Status**: Not implemented  
**Missing**: Team timeouts to stop clock

**NBA JAM Arcade**: Had limited timeouts

**Implementation Needed**:
```javascript
gameState.timeouts = {
    teamA: 3,
    teamB: 3
};

function callTimeout(team) {
    if (gameState.timeouts[team] <= 0) {
        return false;  // No timeouts left
    }
    
    gameState.timeouts[team]--;
    gameState.gameRunning = false;  // Stop clock
    showTimeoutScreen();
    gameState.gameRunning = true;  // Resume
}
```

**Priority**: Low

---

## AI Missing Features

### 6. AI Play Calling
**Status**: Not implemented  
**Missing**: Coordinated team plays

**Current**: Individual AI decisions, no team coordination

**Implementation Needed**:
```javascript
var plays = {
    pickAndRoll: function(ballHandler, screener) {
        // Screener sets screen
        moveToScreenPosition(screener, ballHandler);
        
        // Ball handler uses screen
        if (screenIsSet(screener)) {
            driveOffScreen(ballHandler);
        }
    },
    
    givePutBack: function(passer, cutter) {
        // Pass to wing
        passBall(passer, cutter);
        
        // Passer cuts to basket
        var basketPos = getBasketPosition(passer.team);
        moveAITowards(passer, basketPos.x, basketPos.y);
    }
};

// AI coordinator calls plays
function selectPlay(team) {
    if (gameState.shotClock < 10) {
        return plays.pickAndRoll;
    } else {
        return plays.givePutBack;
    }
}
```

**Priority**: Medium (improves AI quality)

---

### 7. AI Difficulty Levels
**Status**: Hardcoded to medium  
**Missing**: Selectable difficulty

**Implementation Needed**:
```javascript
var aiDifficulty = {
    easy: {
        reactionTime: 10,  // frames delay
        shotAccuracy: 0.7,  // % of rating
        shootThreshold: 0.9  // only wide open
    },
    medium: {
        reactionTime: 5,
        shotAccuracy: 1.0,
        shootThreshold: 0.7
    },
    hard: {
        reactionTime: 2,
        shotAccuracy: 1.2,
        shootThreshold: 0.5
    }
};

function setAIDifficulty(level) {
    currentDifficulty = aiDifficulty[level];
}
```

**Priority**: High (user experience)

---

### 8. AI Adaptive Learning
**Status**: Not implemented  
**Missing**: AI adapts to player behavior

**Potential Feature**:
```javascript
var playerTendencies = {
    shootFromLeft: 0,
    shootFromRight: 0,
    passFrequency: 0,
    driveFrequency: 0
};

function trackPlayerTendency(action, location) {
    if (action === "shoot" && location.x < CENTER_X) {
        playerTendencies.shootFromLeft++;
    }
    // ... etc
}

function adaptiveDefense(defender, player) {
    // Overplay if player favors left
    if (playerTendencies.shootFromLeft > playerTendencies.shootFromRight) {
        var bias = -2;  // Shift left
        moveAITowards(defender, player.x + bias, player.y);
    }
}
```

**Priority**: Low (advanced feature)

---

## Multiplayer Missing Features

### 9. Spectator Mode
**Status**: Not implemented  
**Missing**: Ability to watch games without playing

**Implementation Needed**:
```javascript
function joinAsSpectator(sessionId, playerId) {
    var session = getSession(sessionId);
    session.spectators.push(playerId);
    
    // Spectator receives state updates but can't send input
    while (session.status === "playing") {
        var state = client.read("game." + sessionId + ".state");
        renderGameState(state);
        mswait(50);
    }
}
```

**Priority**: Low

---

### 10. Chat System
**Status**: Not implemented  
**Missing**: Player communication in lobby/game

**Implementation Needed**:
```javascript
function sendChatMessage(sessionId, playerId, message) {
    var chatMessage = {
        sender: playerId,
        message: message,
        timestamp: Date.now()
    };
    
    client.write("chat." + sessionId, chatMessage);
}

function displayChat(sessionId) {
    var messages = client.read("chat." + sessionId, 10);  // Last 10
    for (var msg of messages) {
        console.print("[" + msg.sender + "]: " + msg.message + "\n");
    }
}
```

**Priority**: Medium (multiplayer UX)

---

### 11. Reconnection Support
**Status**: Not implemented  
**Missing**: Rejoin after disconnect

**Implementation Needed**:
```javascript
function attemptReconnect(sessionId, playerId) {
    var session = getSession(sessionId);
    
    // Check if player was in this session
    if (session.players[playerId] && session.status === "playing") {
        // Rejoin
        var sprite = session.spriteMap[playerId];
        playerClient.init(sprite);
        return true;
    }
    
    return false;
}
```

**Priority**: Medium (prevents frustration)

---

### 12. Match History
**Status**: Not implemented  
**Missing**: Record of past games

**Implementation Needed**:
```javascript
function saveMatchHistory(session, results) {
    var match = {
        sessionId: session.id,
        date: Date.now(),
        players: session.players,
        finalScore: results.scores,
        winner: results.winner,
        stats: results.playerStats
    };
    
    // Save to database or file
    saveToUserHistory(match);
}
```

**Priority**: Low

---

### 13. Skill-Based Matchmaking
**Status**: Not implemented  
**Missing**: Match players by skill level

**Implementation Needed**:
```javascript
function quickMatch(playerId) {
    var playerSkill = getUserSkillRating(playerId);
    
    // Find session with similar skill players
    var sessions = getActiveSessions();
    for (var session of sessions) {
        var avgSkill = getAverageSkillRating(session);
        
        if (Math.abs(avgSkill - playerSkill) < 100) {
            return joinSession(session.id, playerId);
        }
    }
    
    // No match found - create new session
    return createNewSession(playerId);
}
```

**Priority**: Low (advanced feature)

---

## UI/UX Missing Features

### 14. Pause Menu
**Status**: Blocking confirmation only  
**Missing**: Full pause menu with options

**Implementation Needed**:
```javascript
function showPauseMenu() {
    gameState.paused = true;
    
    while (gameState.paused) {
        console.clear();
        console.print("PAUSED\n\n");
        console.print("1. Resume\n");
        console.print("2. Settings\n");
        console.print("3. Quit to Menu\n");
        
        var choice = console.getkey();
        
        if (choice === '1') {
            gameState.paused = false;
        } else if (choice === '2') {
            showSettings();
        } else if (choice === '3') {
            confirmQuit();
        }
    }
}
```

**Priority**: Medium

---

### 15. Settings Menu
**Status**: Not implemented  
**Missing**: Configurable game settings

**What to Configure**:
- Game length
- AI difficulty
- Sound effects on/off
- Control remapping
- Graphics quality (if applicable)

**Implementation Needed**:
```javascript
var gameSettings = {
    gameLength: 240,
    aiDifficulty: "medium",
    soundEffects: true,
    controls: { shoot: '\r', turbo: ' ', shove: 's' }
};

function showSettingsMenu() {
    // Display settings, allow changes
    // Save to user profile
}
```

**Priority**: Medium (user experience)

---

### 16. Help/Tutorial System
**Status**: Not implemented  
**Missing**: In-game help

**Implementation Needed**:
```javascript
function showTutorial() {
    var pages = [
        "NBA JAM TUTORIAL - Movement",
        "Use arrow keys to move your player...",
        
        "NBA JAM TUTORIAL - Shooting",
        "Press ENTER to shoot or pass...",
        
        "NBA JAM TUTORIAL - Turbo",
        "Hold SPACE for turbo boost..."
    ];
    
    for (var page of pages) {
        console.clear();
        console.print(page);
        console.print("\n\nPress any key to continue...");
        console.getkey();
    }
}
```

**Priority**: Low (nice to have)

---

### 17. Leaderboards
**Status**: Not implemented  
**Missing**: Global or local leaderboards

**Implementation Needed**:
```javascript
function updateLeaderboard(playerId, stats) {
    var leaderboard = loadLeaderboard();
    
    leaderboard.push({
        player: playerId,
        wins: stats.wins,
        pointsPerGame: stats.totalPoints / stats.gamesPlayed,
        winRate: stats.wins / stats.gamesPlayed
    });
    
    leaderboard.sort((a, b) => b.wins - a.wins);
    leaderboard = leaderboard.slice(0, 10);  // Top 10
    
    saveLeaderboard(leaderboard);
}
```

**Priority**: Medium (motivation)

---

### 18. Replay System
**Status**: Not implemented  
**Missing**: Save and playback games

**Implementation Needed**:
```javascript
var replayRecorder = {
    frames: [],
    
    recordFrame: function() {
        this.frames.push({
            frame: gameState.frameNumber,
            state: cloneGameState(gameState),
            inputs: cloneInputs(currentInputs)
        });
    },
    
    saveReplay: function(filename) {
        var replay = {
            version: "1.0",
            frames: this.frames
        };
        saveToFile(filename, replay);
    }
};

function playbackReplay(filename) {
    var replay = loadFromFile(filename);
    
    for (var frame of replay.frames) {
        applyGameState(frame.state);
        render();
        mswait(50);
    }
}
```

**Priority**: Low (polish feature)

---

## Statistics & Progression Missing Features

### 19. Career Mode
**Status**: Not implemented  
**Missing**: Long-term progression

**Implementation Needed**:
- Player XP system
- Unlockable teams/players
- Season structure
- Playoffs/championship

**Priority**: Low (major feature)

---

### 20. Achievements
**Status**: Not implemented  
**Missing**: Achievement/trophy system

**Examples**:
- "On Fire" - Get 3 consecutive baskets
- "Buzzer Beater" - Score in last 2 seconds
- "Shut Out" - Win without allowing points
- "Triple Double" - 10+ points, assists, steals

**Implementation Needed**:
```javascript
var achievements = {
    onFire: {
        name: "On Fire!",
        condition: (stats) => stats.consecutiveMakes >= 3,
        unlocked: false
    },
    buzzerBeater: {
        name: "Buzzer Beater",
        condition: (stats) => stats.lastSecondBaskets > 0,
        unlocked: false
    }
};

function checkAchievements(playerStats) {
    for (var key in achievements) {
        var ach = achievements[key];
        if (!ach.unlocked && ach.condition(playerStats)) {
            ach.unlocked = true;
            announceAchievement(ach.name);
        }
    }
}
```

**Priority**: Low

---

### 21. Player Fatigue System
**Status**: Not implemented  
**Missing**: Stamina/fatigue mechanics

**Implementation Needed**:
```javascript
player.stamina = 100;  // 0-100

// Drain stamina
if (player.turboActive) {
    player.stamina -= 0.5;  // per frame
}

// Recharge stamina
if (!player.turboActive) {
    player.stamina += 0.2;  // per frame
}

// Affect stats
function getEffectiveSpeed(player) {
    var baseSpeed = player.playerData.speed;
    var fatigueModifier = player.stamina / 100;
    return baseSpeed * (0.7 + 0.3 * fatigueModifier);  // 70%-100% speed
}
```

**Priority**: Low

---

## Visual/Audio Missing Features

### 22. Court Themes
**Status**: Single court design  
**Missing**: Multiple court designs/themes

**Implementation Needed**:
- Home team court
- Neutral courts
- Special event courts (All-Star, playoffs)

**Priority**: Low (cosmetic)

---

### 23. Player Portraits
**Status**: Not implemented  
**Missing**: Player face/portrait graphics

**Current**: Text-based player representation

**Priority**: Low (nice to have)

---

### 24. Sound Effects
**Status**: Not implemented  
**Missing**: Audio feedback

**Potential Implementation**:
```javascript
function playSound(soundType) {
    // Synchronet has console.beep()
    if (gameSettings.soundEffects) {
        if (soundType === "score") {
            console.beep(800, 100);  // frequency, duration
        } else if (soundType === "buzzer") {
            console.beep(400, 500);
        }
    }
}
```

**Priority**: Low (limited terminal audio)

---

### 25. Particle Effects
**Status**: Fire effect only  
**Missing**: Other visual effects

**Potential Effects**:
- Splash on basket
- Trail behind fast-moving player
- Impact stars on collision
- Sweat drops when fatigued

**Priority**: Low (polish)

---

## Data & Persistence Missing Features

### 26. Cloud Save
**Status**: Local only  
**Missing**: Cross-node save sync

**Implementation Needed**:
- User profile in Synchronet user database
- Stats saved per user
- Accessible from any node

**Priority**: Medium (BBS feature)

---

### 27. Season Statistics
**Status**: Per-game only  
**Missing**: Long-term stat tracking

**Implementation Needed**:
```javascript
var seasonStats = {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    totalPoints: 0,
    totalAssists: 0,
    totalSteals: 0,
    totalBlocks: 0
};

function updateSeasonStats(gameStats) {
    seasonStats.gamesPlayed++;
    if (gameStats.won) seasonStats.wins++;
    else seasonStats.losses++;
    seasonStats.totalPoints += gameStats.points;
    // ... etc
}
```

**Priority**: Medium

---

### 28. Export Stats
**Status**: Not implemented  
**Missing**: Export stats to file/clipboard

**Use Case**: Share stats on forums, social media

**Implementation Needed**:
```javascript
function exportStats(player) {
    var statsText = format(
        "NBA JAM Stats - %s\n" +
        "Games: %d\n" +
        "W-L: %d-%d\n" +
        "PPG: %.1f\n",
        player.name,
        player.gamesPlayed,
        player.wins,
        player.losses,
        player.pointsPerGame
    );
    
    saveToFile("stats.txt", statsText);
    console.print("Stats exported to stats.txt\n");
}
```

**Priority**: Low

---

## Missing Features Summary

| Category | Count | High Priority | Medium Priority | Low Priority |
|----------|-------|---------------|-----------------|--------------|
| Core Gameplay | 5 | 0 | 2 | 3 |
| AI Features | 3 | 1 | 1 | 1 |
| Multiplayer | 5 | 0 | 2 | 3 |
| UI/UX | 5 | 0 | 3 | 2 |
| Stats/Progression | 3 | 0 | 1 | 2 |
| Visual/Audio | 4 | 0 | 0 | 4 |
| Data/Persistence | 3 | 0 | 2 | 1 |
| **Total** | **28** | **1** | **11** | **16** |

---

## Implementation Roadmap

### Wave 7-8: High Priority
1. AI difficulty selection (#7) - User experience

### Wave 9-10: Medium Priority
2. Overtime system (#3) - Complete gameplay
3. Pause menu (#14) - User experience
4. Settings menu (#15) - Configurability
5. Chat system (#10) - Multiplayer UX
6. Reconnection support (#11) - Reliability
7. Leaderboards (#17) - Motivation
8. Season statistics (#27) - Progression
9. Cloud save (#26) - BBS integration

### Wave 11+: Low Priority (Polish)
10. Alley-oop system (#2) - Feature expansion
11. AI play calling (#6) - AI quality
12. Spectator mode (#9) - Multiplayer feature
13. Replay system (#18) - Content creation
14. Achievements (#20) - Gamification
15. Sound effects (#24) - Audio feedback

---

## Conclusion

**Total Missing Features**: 28  
**Must Implement**: 1 (AI difficulty)  
**Should Implement**: 11 (gameplay completion, UX)  
**Nice to Have**: 16 (polish, advanced features)

**Recommended Focus**:
1. Complete core gameplay (overtime, pause, settings)
2. Improve multiplayer (chat, reconnection)
3. Add progression (stats, leaderboards)
4. Polish (achievements, replays, effects)

**Estimated Effort**: 40-60 hours for medium priority features
