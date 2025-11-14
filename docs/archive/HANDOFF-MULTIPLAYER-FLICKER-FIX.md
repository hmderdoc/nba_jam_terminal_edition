# HANDOFF: Multiplayer Sprite Flickering Fix
**Date**: November 12, 2025  
**Branch**: wave24-multiplayer-flicker-fix  
**Handoff Reason**: Need architectural expertise for logical rendering sequence  

## 🎯 CORE DISCOVERY (HUGE)

**ROOT CAUSE IDENTIFIED**: Excessive `courtFrame.clear()` calls within `drawCourt()` function causing sprite flickering in multiplayer scenarios.

**USER'S EXPERT INSIGHT**: "flickering frames is usually the result of something happening multiple times in the draw cycle that only needs to happen once" - **This was the key breakthrough**

**EVIDENCE**: Debug logs showed 18,000+ court redraw calls during normal gameplay sessions.

## 🔍 TECHNICAL CONTEXT

### Synchronet BBS Framework
- Uses `frame.js` rendering system with layered transparent frames
- Terminal-based rendering with ANSI color codes
- Frame cycling (`cycleFrame()`) required to display changes
- Transparent frames overlay on base court frame

### NBA Jam Architecture
- Multiplayer: coordinator/non-coordinator client model
- Sprite rendering: Players move over static court background
- Collision detection: dx<2 && dy<2 thresholds with guard conditions
- Animation system: Basket flash, player movements, ball physics

## 📊 PROBLEM ANALYSIS

### Original Issue
- **Symptom**: Non-coordinator players flickering during movement
- **Trigger**: Multiplayer scenarios with rapid sprite updates
- **Pattern**: Something clearing court background repeatedly during draw cycle

### Investigation Trail
1. **Collision Detection**: Fixed 3 collision bugs (completed ✅)
   - Movement restriction guards
   - Coordinator parity issues  
   - Human vs human detection
2. **Sprite Flickering**: Identified excessive court redraws as root cause
3. **Frame Architecture**: Attempted layered frame solution (overcomplicated ❌)

### Files Modified in This Session

#### lib/multiplayer/mp_client.js
- **Fixed**: Collision guard key handling, removed `mp_bf_redraw` triggers
- **Key Change**: Removed court redraw calls from collision reconciliation
- **Status**: Collision detection working correctly ✅

#### lib/rendering/court-rendering.js  
- **Attempted**: Layered frame architecture with separate basket/backboard frames
- **Problem**: Created gray rectangles/visual artifacts
- **Status**: Overcomplicated solution, needs simpler approach ❌

#### nba_jam.js
- **Added**: Comprehensive frame initialization and cycling
- **Problem**: May be excessive for simple fix needed
- **Status**: Working but potentially over-engineered ❌

## 🚨 KEY INSIGHT: THE REAL SOLUTION

**User's Realization**: "the root cause was the excessive calls to `courtFrame.clear()` within `drawCourt()`"

**What We Need**: **"a logical rendering sequence not just band-aid the issue with lots of hacks"**

## 🎯 RECOMMENDED APPROACH

### Simple Solution Path
1. **Identify** where `courtFrame.clear()` is being called excessively within `drawCourt()`
2. **Restructure** so court clearing happens ONCE per frame cycle, not multiple times
3. **Maintain** proper render order: court background → sprites → overlays
4. **Test** that sprite flickering is eliminated without visual artifacts

### Anti-Pattern to Avoid
- ❌ Complex layered frame systems with multiple transparent overlays
- ❌ Removing `courtFrame.clear()` entirely (may cause other issues)
- ❌ Adding more frame management code without understanding current flow

### Pattern to Follow  
- ✅ Single court clear per render cycle
- ✅ Logical sequence: clear → draw background → draw dynamic elements → cycle
- ✅ Minimal changes to existing architecture
- ✅ Test in both single-player and multiplayer scenarios

## 🔧 SPECIFIC TECHNICAL GUIDANCE

### Current Code Location
**File**: `/sbbs/xtrn/nba_jam/lib/rendering/court-rendering.js`  
**Function**: `drawCourt()`  
**Problem Area**: Multiple `courtFrame.clear()` calls or calls from wrong contexts

### Debug Commands Used
```bash
# Count court redraw frequency
grep "COURT REDRAW.*TRUE" /sbbs/xtrn/nba_jam/debug.log | wc -l

# Monitor court clear calls
grep "courtFrame.clear" /sbbs/xtrn/nba_jam/debug.log | tail -10
```

### Testing Scenarios
1. **Single-player**: Human vs AI (should work fine)
2. **Multiplayer**: 2+ clients with rapid movement (where flickering occurs)
3. **Demo mode**: Automated gameplay (good for consistent testing)

## 📋 CURRENT STATE

### What's Working ✅
- Collision detection completely fixed
- Root cause of flickering identified
- Debug logging infrastructure in place
- Clear understanding of problem scope

### What's Broken ❌  
- Layered frame implementation causing gray rectangles
- Overcomplicated rendering architecture
- Visual artifacts from transparent frame clearing

### What's Needed 🎯
- **Simple fix**: Logical rendering sequence that clears court once per cycle
- **Architecture insight**: How to properly structure Synchronet frame.js rendering
- **Clean implementation**: Minimal changes, maximum impact

## 🧠 USER'S DOMAIN EXPERTISE

**Critical Quote**: "flickering frames is usually the result of something happening multiple times in the draw cycle that only needs to happen once"

**User has deep Synchronet BBS knowledge** - their diagnosis was 100% accurate and led to the breakthrough. Listen to their architectural guidance.

## 🎯 SUCCESS CRITERIA

1. **No sprite flickering** in multiplayer scenarios
2. **Clean court rendering** without gray rectangles or visual artifacts  
3. **Minimal code changes** - surgical fix, not architectural overhaul
4. **Works across all modes** - single-player, multiplayer, demo

## 📞 HANDOFF RECOMMENDATION

**Approach**: Focus on the simple solution - find where `courtFrame.clear()` is being called excessively and restructure for once-per-cycle clearing.

**Avoid**: Getting caught in complex layered frame architectures or over-engineering.

**Key**: The user figured out the root cause. Build on their insight with clean implementation.

---

**Bottom Line**: We have the answer. Just need the right architectural implementation of the logical rendering sequence.