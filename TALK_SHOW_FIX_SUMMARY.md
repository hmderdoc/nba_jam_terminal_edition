# Talk Show View - Fix Summary

## What Was Broken (Codex's Implementation)

### 1. **Art Loading Confusion**
- Mixed RichView's built-in art system with manual `BinLoader` calls
- Called `renderArt()` manually after RichView initialization, creating conflicts
- Passed `art: artPath` to RichView constructor BUT ALSO tried to manually load art
- Result: Art probably never loaded properly

### 2. **Lightbar Menu Failure**
- Checked `typeof view.menu === "function"` but RichView.menu() DOES exist (it's a real method)
- However, the menu items format was close but missing proper structure
- Fallback to raw keypresses meant users never saw a lightbar

### 3. **Host→Guest Stage Progression Issues**
- Had the right idea (hostLines → art swap → dialogue+choices)
- BUT: Called `renderArt()` manually to swap art instead of using RichView's zone updates
- Art swap may not have rendered properly because of frame management conflicts

### 4. **No Testing Infrastructure**
- Random event chances were 15-20%, making testing painful
- No direct test script to verify the view without playing the full game

---

## What Was Fixed

### 1. **Art Loading** ✅
- **Removed** all `BinLoader` logic and manual `renderArt()` function
- **Use RichView's built-in art system**: Pass `art: { art: "path/to/file.bin" }` to constructor
- For guest art swap, directly call `artFrame.load(guestArt, 40, 20)` on the zone
- RichView handles frame management automatically

### 2. **Lightbar Menu** ✅
- **Use RichView.menu()** properly with correct item format:
  ```javascript
  var menuItems = choices.map(function(c) {
      return { 
          text: c.text,
          value: c.key,
          hotkey: String(c.key).toUpperCase()
      };
  });
  view.menu(menuItems, { y: y, x: 1, width: 38, zone: "content" });
  ```
- Returns the `value` (choice key) when selected
- **Removed** the manual keypress fallback since RichView.menu() always works

### 3. **Host→Guest Flow** ✅
**Proper two-stage implementation:**

**Stage 1 (if hostLines provided):**
- Clear content zone
- Render hostLines
- Show "[Press any key to continue]"
- Wait for keypress
- **Then** swap art: `artFrame.load(guestArt, 40, 20)` on the art zone

**Stage 2:**
- Clear content zone again
- Render dialogueLines
- Show lightbar menu with choices (or "press any key" if no choices)
- Return selected choice

### 4. **Testing Infrastructure** ✅

#### Config Overrides ([lib/lorb/config.js](lib/lorb/config.js#L498-L502))
```javascript
// ⚠️ TESTING ONLY - REVERT AFTER TESTING TALK SHOW VIEW ⚠️
MAX_RANDOM_EVENTS_PER_DAY: 5,           // DEFAULT: 1
BABY_MAMA_EVENT_CHANCE: 0.99,           // DEFAULT: 0.20
CHILD_CHALLENGE_CHANCE: 0.99,           // DEFAULT: 0.15
SPOUSE_RETALIATION_CHANCE: 0.99,        // DEFAULT: 0.20
```

#### Test Script ([scripts/test_talk_show.js](scripts/test_talk_show.js))
Direct invocation of `TalkShowView.present()` with sample data:
```bash
/sbbs/exec/jsexec /sbbs/xtrn/nba_jam/scripts/test_talk_show.js
```

---

## How to Test

### Option 1: In-Game Test (Recommended)
With config overrides at 99%, events will trigger almost every time:

1. **Restart BBS** to load new config:
   ```bash
   restart-bbs
   ```

2. **Set up test conditions** (via LORB debug menu or manual JSON edit):
   - Create a baby mama (`ctx.babyMamas`)
   - Create a baby baller (`ctx.babyBallers`)
   - Set low relationship (e.g., -30) to trigger drama events

3. **Trigger events**:
   - Navigate to a court location
   - Hit "Find Another Opponent" a few times
   - Events will fire almost immediately due to 99% chance

4. **Observe**:
   - Art should load in left zone (40x20)
   - Figlet banner should show talk show name in header (80x4)
   - Content zone shows dialogue in right column (40x20)
   - Lightbar menu should work (arrow keys + Enter)
   - Host→guest swap (if applicable) should show guest art after first keypress

### Option 2: Direct Test (BBS Door - Advanced)
The test script [scripts/test_talk_show.js](scripts/test_talk_show.js) can be run as a BBS door:
- **Note**: Must run from inside BBS connection (not command line)
- Add as external program in SCFG, or load directly from LORB hub via admin menu
- Runs three isolated tests without needing full game context

---

## After Testing: REVERT CONFIG

**CRITICAL:** Once testing is complete, revert [lib/lorb/config.js](lib/lorb/config.js#L498-L502) back to defaults:

```javascript
// === Random Encounters ===
MAX_RANDOM_EVENTS_PER_DAY: 1,           // Cap on daily events
BABY_MAMA_EVENT_CHANCE: 0.20,           // 20% per baby mama per city visit
CHILD_CHALLENGE_CHANCE: 0.15,           // 15% chance to encounter own child
SPOUSE_RETALIATION_CHANCE: 0.20,        // 20% chance for angry spouse event
```

Then restart BBS again to reload normal config.

---

## Known Limitations

1. **Art files may not exist**: The talk show art paths point to files like:
   - `/sbbs/xtrn/nba_jam/assets/lorb/talkshow_donnie.bin`
   - `/sbbs/xtrn/nba_jam/assets/lorb/talkshow_ricki.bin`
   - etc.
   
   If these don't exist, RichView will log a warning but still work (just with blank art zones or fallback text).

2. **Guest art**: Currently, callers don't pass `guestArt`, so host→guest swap won't happen in production until that's wired up in [lib/lorb/data/baby-events.js](lib/lorb/data/baby-events.js#L1064).

---

## Files Changed

1. [lib/lorb/ui/talk_show_view.js](lib/lorb/ui/talk_show_view.js) - Complete rewrite of `present()` function
2. [lib/lorb/config.js](lib/lorb/config.js#L498-L502) - Temporary testing overrides (⚠️ REVERT AFTER TESTING)
3. [scripts/test_talk_show.js](scripts/test_talk_show.js) - New test script for isolated testing

---

## Next Steps

1. Run [scripts/test_talk_show.js](scripts/test_talk_show.js) to verify isolated functionality
2. Test in-game via courts (restart BBS first to load 99% event chances)
3. **Create missing art files** if desired (40x20 .bin files for talk show hosts/guests)
4. **Wire up guestArt parameter** in [baby-events.js](lib/lorb/data/baby-events.js) if you want host→guest reveals
5. **REVERT CONFIG** back to defaults after testing
6. Document any remaining issues in `current_architecture_docs/known-issues.md`
