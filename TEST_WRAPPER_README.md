# NBA JAM Test Wrapper

## Purpose
This test wrapper allows you to run NBA JAM in jsexec (command-line) mode for testing and debugging without modifying the main game file or requiring a BBS connection.

## Usage

```bash
# Run the game in test mode (will auto-run demo mode)
jsexec test_wrapper.js

# Run with timeout to prevent hanging
timeout 5 jsexec test_wrapper.js

# Run and check for errors
timeout 5 jsexec test_wrapper.js && echo "No errors!" || echo "Crashed - check data/error.log"
```

## What it does

1. **Mocks the console object** - Provides stub implementations of console methods needed by the game (print, write, getkey, inkey, strlen, etc.)
2. **Skips UI elements** - Automatically skips splash screen, intro, and menu
3. **Auto-runs demo mode** - Automatically selects demo mode to test game loop
4. **Logs errors** - All errors are still logged to `data/error.log` for debugging

## Console Methods Mocked

- `print()`, `write()`, `putmsg()` - Output functions
- `getkey()`, `inkey()` - Input functions (return empty to skip prompts)
- `pause()` - No-op in test mode
- `gotoxy()`, `clear()` - Screen control (no-op)
- `strlen()` - String length calculation
- `attributes` - Text attributes property
- `screen_rows`, `screen_columns` - Screen dimensions

## Limitations

- No actual display (terminal output may be garbled)
- No user input (auto-selects options)
- Frame rendering may not work correctly
- Best used for testing game logic, not visual display

## Testing State Manager Migration

This wrapper is ideal for testing State Manager migration fixes:

```bash
# Test that the game runs without "systems is undefined" errors
timeout 5 jsexec test_wrapper.js > /dev/null 2>&1
if [ $? -eq 124 ]; then
    echo "✅ Game ran successfully (timeout reached)"
else
    echo "❌ Game crashed - check error log"
    tail -20 data/error.log
fi
```

## Note

This is for **testing only**. The main game file (`nba_jam.js`) should never contain test-specific code or environment detection. All test setup is isolated in this wrapper.
