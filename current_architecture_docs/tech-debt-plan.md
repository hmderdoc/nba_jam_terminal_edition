# Tech Debt Remediation Plan (Wave 24)

Prioritize the following items ahead of feature work. Each section outlines the goal, approach, and exit criteria so we can track progress.

---

## 1. Frame Lifecycle Manager

- **Problem:** `leftHoopFrame`, `trailFrame`, `scoreFrame`, etc. are global variables created once in `initFrames`. Many modules dereference them without null checks.
- **Plan:** Create `lib/rendering/frame-manager.js` that encapsulates creation, reopening, teardown, and status checks for every frame. Expose APIs like `FrameManager.get('trail')`, `.ensureOpen('score')`, and `.status()`.
- **Exit Criteria:**
  - All frame consumers call `FrameManager.get(name)` instead of touching globals directly.
  - If a frame cannot be opened, FrameManager logs the failure and dependent modules can bail gracefully.

## 2. Scoreboard Redraw Decoupling

- **Problem:** HUD updates depend on `COURT_RENDER_THROTTLE_MS` even when the court isn’t dirty.
- **Plan:** Introduce a separate `HUD_RENDER_INTERVAL_MS` (default 50 ms). Modify `runGameFrame` to track `lastHudUpdateTime` and redraw the scoreboard at that cadence regardless of court dirtiness. Turbo meters and announcer text should hook into this interval.
- **Exit Criteria:** Scoreboard redraws occur on schedule even when the court remains static; turbo meters never freeze while the ball is idle.

## 3. Non-Blocking Violation Pauses

- **Problem:** Shot-clock violations call `frameScheduler.waitForNextFrame(1000)` inside `runGameFrame`, halting AI and multiplayer updates.
- **Plan:** Replace blocking waits with a “violation timeout” state in `stateManager` (e.g., `violationPauseUntil`). When set, `runGameFrame` short-circuits early until `Date.now()` exceeds the timeout, but the loop still ticks, processes input, and broadcasts state.
- **Exit Criteria:** Shot-clock violations no longer block the scheduler; multiplayer clients keep receiving state updates during pauses.

## 4. Physics Constants Unification

- **Problem:** Collision thresholds (e.g., `< 2` hitbox) live in multiple files, and `mp_client.js` uses hard-coded 1.5.
- **Plan:** Expand `lib/config/player-constants.js` or `timing-constants.js` with `COLLISION_CORE.dx/dy` and any other shared numbers (e.g., friction, max step per frame). Update `movement-physics.js`, AI modules, and `mp_client.js` to read from those constants.
- **Exit Criteria:** No physics/movement file contains naked literals for collision/turbo thresholds; everything references the shared config.

## 5. Reusable Movement Step Function

- **Problem:** `mp_client.js` re-implements `applyMovementCommand` for prediction. Changes to the authoritative logic require manual duplication.
- **Plan:** Expose a pure helper in `movement-physics.js` (e.g., `computeNextPosition(sprite, command)`) that performs the math without mutating sprite state. Authority uses the existing mutating functions; clients import the pure helper.
- **Exit Criteria:** `mp_client.js` stops duplicating movement math and relies on the shared helper; unit tests can validate both code paths stay in sync.

## 6. Sprite Globals → State Manager



### Tracking

| Item | Owner | Status | Notes |
|------|-------|--------|-------|
| Frame lifecycle manager | | Completed | FrameManager now owns creation + aliases; legacy globals removed in HUD modules. |
| Scoreboard redraw decoupling | | Completed | Added `HUD_RENDER_INTERVAL_MS` + independent HUD timer so scoreboard/turbo updates no longer depend on court redraw cadence. |
| Non-blocking violation pauses | | Completed | Shot-clock violations schedule a state-managed pause; game loop stays responsive. |
| Physics constants unification | | Completed | Collision thresholds + client guard now live in `player-constants.js`; multiplayer coordinator/client consume them. |
| Shared movement helper | | Completed | `previewMovementCommand()` powers both authority and client prediction; mp_client now consumes it instead of duplicating logic. |
| Sprite globals cleanup | | Not Started |  |
 **Halftime inbound fairness** (Wave 24B): ensure second-half possession flips to the team that opened the game on defense, restore backcourt positioning before inbound animation.

Update the Status/Notes columns as work progresses.


### Notes & Lessons

