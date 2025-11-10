# Debugging Wave 22A Rebound Issues

This branch includes comprehensive debug logging that writes to `debug.log` in real-time.

## How to Use

### 1. Start the Game
Play NBA Jam normally and reproduce the bug (miss jump shots, attempt dunks, etc.)

### 2. Monitor the Debug Log
In a separate terminal, run:
```bash
tail -f /sbbs/repo/xtrn/nba_jam/debug.log
```

Or to filter for specific events:
```bash
tail -f /sbbs/repo/xtrn/nba_jam/debug.log | grep -E '\[SHOT PATH\]|\[REBOUND\]|\[DUNK\]'
```

### 3. What to Look For

The debug log will show you exactly what's happening:

#### Shot Path Detection
```
[SHOT PATH] mpCoordinator: null, isCoordinator: false
[SHOT PATH] Taking SINGLE-PLAYER path
```
or
```
[SHOT PATH] mpCoordinator: exists, isCoordinator: true
[SHOT PATH] Taking MULTIPLAYER COORDINATOR path
```

#### Miss Handling
```
[SHOT PATH] Miss - calling createRebound(), reboundActive before: true
[SHOT PATH] After createRebound(), reboundScramble.active: true
```
or for single-player:
```
[SHOT PATH] Single-player miss handling - attemptType: shot, blocked: false
[SHOT PATH] Normal miss - calling createRebound() at basket
```

#### Rebound Creation
```
[REBOUND] createRebound() called at (75,20), ballCarrier: null
[REBOUND] Scramble activated - reboundX: 73.2, reboundY: 19.5
```

#### Dunk Handling
```
[DUNK] Dunk missed - clearing ballCarrier
```
or
```
[DUNK] Dunk made - ballCarrier remains: PLAYER_NAME
```

## Diagnosing the Problem

### If createRebound() is NOT called:
- Bug is in the conditional logic in shooting.js
- Check which path is taken (coordinator vs single-player)
- Verify the condition at the miss handling

### If createRebound() IS called but scramble.active stays false:
- Bug is in createRebound() itself (rebounds.js)
- Something is preventing the scramble from activating

### If scramble.active becomes true but nothing happens:
- Bug is in updateReboundScramble() (per-frame update)
- Players may not be reaching the ball
- Timeout may be triggering incorrectly

### If dunk loop occurs:
- Check if `[DUNK] Dunk missed - clearing ballCarrier` appears
- If it doesn't appear, the dunk completion code isn't running
- If it does appear, something else is resetting ballCarrier

## Clearing the Log

To start fresh:
```bash
rm /sbbs/repo/xtrn/nba_jam/debug.log
```

The log will be recreated automatically when the game starts.

## Disabling Debug Logging

Edit `lib/utils/debug-logger.js` and change:
```javascript
var DEBUG_REBOUND_FLOW = true;
```
to:
```javascript
var DEBUG_REBOUND_FLOW = false;
```

## Report Your Findings

After playing and monitoring the log, report:
1. Which path is being taken (coordinator or single-player)?
2. Is createRebound() being called?
3. Is scramble.active being set to true?
4. What's the ballCarrier state at each step?
5. Any unexpected values or missing log entries?

This will pinpoint exactly where the flow breaks down.
