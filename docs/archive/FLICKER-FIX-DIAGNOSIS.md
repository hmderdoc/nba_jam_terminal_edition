# Multiplayer Flicker Fix - Diagnostic Analysis
**Date**: November 12, 2025  
**Branch**: wave24-multiplayer-flicker-fix

## 🔍 CURRENT STATE ANALYSIS

### Question A: Are we still drawing court every cycle?

**Answer: NO** - Court drawing is now **conditional** via `courtNeedsRedraw` flag

**Evidence from game-loop-core.js (lines 430-437)**:
```javascript
if (timeSinceLastUpdate >= 60) {
    if (courtNeedsRedraw) {
        drawCourt(systems);
        stateManager.set("courtNeedsRedraw", false, "court_redrawn");
    }
    drawScore(systems);
    // Frame cycling happens here
}
```

**Finding**: ✅ We've solved the 18K draw calls problem! Court only redraws when `courtNeedsRedraw` flag is true.

---

### Question B: Why doesn't court draw at game start (gray screen)?

**ROOT CAUSE IDENTIFIED**: `drawCourt()` no longer calls `courtFrame.clear()` internally (line 252 in court-rendering.js)

**The Problem**:
1. At game start, `clearCourt()` is called (line 139 nba_jam.js) - clears the frame ✅
2. Then `drawCourt()` is called (line 140) - **but doesn't redraw the brown background** ❌
3. `drawCourt()` only draws borders, lines, arcs, etc. on top of **whatever is already there**
4. Since frame was just cleared, there's no brown background → **GRAY SCREEN**

**From court-rendering.js line 252**:
```javascript
// Draw court background (brown wood) - no clear() to prevent flicker
// courtFrame.clear(); // REMOVED: Causes flicker when called repeatedly during inbound setup
```

**The issue**: Removing `courtFrame.clear()` from `drawCourt()` was correct for preventing flicker during gameplay, BUT we never added code to **paint the brown background** after clearing.

---

### Question C: Why can't we see basket frames?

**ROOT CAUSE**: Basket frames are **never brought to the top of the z-order**

**Evidence from nba_jam.js initialization (lines 51-58)**:
```javascript
announcerFrame.open();
courtFrame.open();
basketFrameLeft.open();    // ← Opened but never .top()
basketFrameRight.open();   // ← Opened but never .top()
trailFrame.open();
trailFrame.top();          // ← Only trailFrame brought to top!
backboardFrameLeft.open(); // ← Opened but never .top()
backboardFrameRight.open(); // ← Opened but never .top()
```

**Frame Z-Order (bottom to top)**:
1. announcerFrame
2. courtFrame
3. basketFrameLeft
4. basketFrameRight
5. trailFrame ← **This is on top, covering baskets!**
6. backboardFrameLeft
7. backboardFrameRight

**The Problem**: Transparent frames opened in order, but only `trailFrame` explicitly brought to top. The basket/backboard frames are **below** trailFrame in z-order, so they're hidden.

---

### Question D: Have we aligned lifecycle properly?

**Partially YES, but missing key steps**:

**What's Working** ✅:
- `clearCourt()` only at transitions (menu→game, halftime→2nd half)
- `drawCourt()` only when `courtNeedsRedraw` flag set
- All frames cycled in game loop (lines 444-456 game-loop-core.js)

**What's Missing** ❌:
1. **No brown background fill** after clearing court
2. **No z-order management** for basket/backboard frames
3. **Basket frames not visible** because covered by trailFrame

---

## 🎯 SOLUTIONS NEEDED

### Solution 1: Fix Brown Background (Gray Screen Issue)

**Option A** (Recommended): Add explicit background fill to `drawCourt()`:
```javascript
function drawCourt(systems) {
    // ... guard checks ...
    
    // Fill court with brown background FIRST
    courtFrame.clear();  // Reset to background color (WHITE | WAS_BROWN)
    
    // Then draw all markings on top
    courtFrame.drawBorder(WHITE | WAS_BROWN);
    // ... rest of drawing code ...
}
```

**Option B**: Separate clear and draw:
```javascript
// clearCourt() already does courtFrame.clear()
// drawCourt() should NOT clear, just draw on existing background
// BUT: Need to ensure brown fill happens after clear
```

**Recommendation**: **Option A** - Put `courtFrame.clear()` back IN `drawCourt()`, but ONLY call `drawCourt()` when needed (which we already do via `courtNeedsRedraw` flag).

---

### Solution 2: Fix Basket Frame Visibility

**Two approaches**:

**Approach A** (Simple): Bring basket/backboard frames to top after opening:
```javascript
announcerFrame.open();
courtFrame.open();
basketFrameLeft.open();
basketFrameLeft.top();      // ← ADD THIS
basketFrameRight.open();
basketFrameRight.top();     // ← ADD THIS
trailFrame.open();
trailFrame.top();
backboardFrameLeft.open();
backboardFrameLeft.top();   // ← ADD THIS
backboardFrameRight.open();
backboardFrameRight.top();  // ← ADD THIS
```

**Approach B** (Better): Order frames correctly, only `.top()` the final one:
```javascript
announcerFrame.open();
courtFrame.open();
trailFrame.open();          // Trails under baskets
basketFrameLeft.open();
basketFrameRight.open();
backboardFrameLeft.open();
backboardFrameRight.open();
backboardFrameRight.top();  // Only top the final layer
```

**Recommendation**: **Approach B** - Proper z-ordering is cleaner than multiple `.top()` calls.

---

### Solution 3: Verify Basket Flash Rendering

**Current code** (court-rendering.js lines 138-145):
```javascript
// Draw basket flash if active and at this basket
var basketFlash = systems.stateManager.get('basketFlash');
if (basketFlash && basketFlash.active && basketFlash.x === BASKET_LEFT_X) {
    basketFrameLeft.gotoxy(basketFlash.x - 1, basketFlash.y);
    basketFrameLeft.putmsg("*", YELLOW | WAS_BROWN);
    basketFrameLeft.gotoxy(basketFlash.x + 1, basketFlash.y);
    basketFrameLeft.putmsg("*", YELLOW | WAS_BROWN);
}
```

**Status**: Code looks correct ✅  
**Issue**: Basket frames not visible due to z-order problem (see Solution 2)

---

## 📋 IMPLEMENTATION CHECKLIST

### Step 1: Fix Brown Background
- [ ] Add `courtFrame.clear()` back to top of `drawCourt()` function
- [ ] Verify `drawCourt()` only called when `courtNeedsRedraw=true` (already done)
- [ ] Test: Court shows brown background at game start

### Step 2: Fix Frame Z-Order
- [ ] Reorder frame `.open()` calls: court → trail → baskets → backboards
- [ ] Remove `.top()` from trailFrame
- [ ] Add `.top()` only to final backboard frame
- [ ] Test: Basket rims visible during gameplay

### Step 3: Verify Basket Flash
- [ ] Score a basket and verify flash animation appears
- [ ] Check that flash uses basketFrame, not courtFrame
- [ ] Test: Flash visible and doesn't cause court redraw

### Step 4: Confirm No Memory Leak
- [ ] Run demo mode for 5+ minutes
- [ ] Check `grep "drawCourt.*EXECUTING" debug.log | wc -l` count
- [ ] Verify count is reasonable (<100 for 5 min session)
- [ ] Test: No excessive court redraws

---

## 🎓 LESSONS LEARNED

1. **Frame.clear() sets to background color** - It doesn't just "erase", it fills with the frame's background attribute (WHITE | WAS_BROWN for courtFrame)

2. **Z-order matters for transparent frames** - Opening frames in order creates z-stack, but `.top()` can reorder. Only use `.top()` when necessary.

3. **Separation of concerns helps** - Having `clearCourt()` separate from `drawCourt()` was good, but we needed to ensure brown background gets painted.

4. **Conditional rendering works** - The `courtNeedsRedraw` flag successfully eliminated 18K+ draw calls.

---

## 🚀 EXPECTED OUTCOME

After implementing Solutions 1-3:
- ✅ Court displays brown background at game start
- ✅ Basket rims and nets visible during gameplay  
- ✅ Basket flash animations work correctly
- ✅ No sprite flickering in multiplayer
- ✅ No excessive court redraws (<100 per 5-min session)
- ✅ Clean visual rendering without gray areas
