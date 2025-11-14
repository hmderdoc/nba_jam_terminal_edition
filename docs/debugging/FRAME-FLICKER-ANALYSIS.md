# Frame Flicker Analysis - Non-Coordinator Sprite Issue

## Problem Description
- **Who**: Non-coordinator players only (coordinator screen is fine)
- **When**: Starts when player becomes inbounder (not at game start)
- **What**: Very noticeable sprite flickering in authoritative position
- **Where**: Player's own sprite flickers on their own screen

## Expert Analysis (User Experience with Synchronet frame.js)

### Root Cause Pattern: Multiple Draw Cycles
Flickering frames in Synchronet are typically caused by:
1. **Something happening multiple times in draw cycle that should happen once**
2. **Unnecessary frame.clear() calls**
3. **Improper frame cycle method usage**
4. **Non-selective view updates (all-at-once approaches)**

### Frame.js Behavior
- Frames have cycle methods that should be called on parent
- Parent cycle calls should handle childFrames automatically
- Redrawing views when unnecessary causes flicker
- Double draw/unnecessary frame cycles are common culprits

### Key Observations
1. **Timing**: Issue starts when non-coordinator becomes inbounder
2. **Scope**: Only affects non-coordinator's own sprite display
3. **Authority**: Happens at authoritative position (not drift-related)
4. **Reconciliation**: Both screens show correct positions, no drift visible

### Not Reconciliation-Related
- Both coordinator and non-coordinator screens show same positions
- No visible drift between screens
- If it were drift, first coordinator correction should eliminate it
- This is a rendering/frame cycle issue, not position sync

## Investigation Strategy

### Primary Suspects
1. **Inbound setup logic** - What happens when player becomes inbounder?
2. **Client-side rendering** - Multiple draw calls on non-coordinator
3. **Frame cycle management** - Improper parent/child cycling
4. **View update logic** - Non-selective updates triggering redraws

### Code Areas to Investigate
1. `setupInbound()` functions - what triggers when becoming inbounder
2. Non-coordinator specific rendering paths
3. Frame.cycle() usage patterns
4. frame.clear() calls in client code
5. View redraw logic in multiplayer client

### Questions to Answer
1. What specific code executes when a player becomes inbounder?
2. Are there different rendering paths for coordinator vs non-coordinator?
3. Where are frame.cycle(), frame.clear(), frame.draw() called?
4. Is there redundant view updating in the client?

## Next Steps
1. Trace inbound setup code execution
2. Audit frame method calls in multiplayer client
3. Look for double-draw patterns
4. Check for unnecessary frame.clear() calls
5. Review view update selectivity

## Technical Notes
- Issue is frame.js specific, not game logic
- Timing suggests event-triggered rendering problem
- Focus on client-side frame management, not position sync