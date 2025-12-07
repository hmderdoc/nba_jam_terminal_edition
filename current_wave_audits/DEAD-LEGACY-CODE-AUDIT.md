# Dead & Legacy Code Audit (Wave 24)

Audit seed: follow every module loaded from `nba_jam.js` and remove/annotate anything that no longer participates in the Wave‑23 architecture.

## Completed cleanup (this pass)
- **Module loader hygiene**
  - Removed `lib/utils/safe-game-loop.js`, `lib/core/input-buffer.js`, and `lib/ui/score-display.js` along with their `module-loader` entries. The only scoreboard now lives in `lib/ui/scoreboard.js`.
- **View/model duplicates**
  - Deleted the unused view-model helpers from `lib/game-logic/score-calculator.js` and the unused padding/format helpers from `lib/utils/string-helpers.js`. Nothing references them anymore.
- **Legacy dunk & shove fallbacks**
  - Purged `animateDunk()` and `executeShot()` from `lib/game-logic/dunks.js` and dropped the legacy `tests/legacy/test-*-bug.js` files that existed solely to exercise those entry points.
  - Rewrote `createLooseBall()` in `lib/game-logic/physical-play.js` to be non-blocking and removed the dead shove helper functions (`evaluateOffensive/DefensiveShoveOpportunity`, `updatePlayerShovedAppearance`, `updatePlayerShoverAppearance`).
- **AI behaviour reintegration**
  - Wired `findOpenPassingLaneTarget()` and `evaluateMomentumCutPlan()` back into `lib/ai/offense-off-ball.js` so cutters actively hunt lanes again, and restored `isDefenderPlayingTooTight()` awareness inside `lib/ai/offense-ball-handler.js`.
  - Removed never-used helper modules (`lib/game-logic/fast-break-detection.js`, `lib/ai/ai-corner-escape.js`, `lib/ai/ai-difficulty.js`) and their loader entries.
- **Multiplayer instrumentation**
  - Deleted the unused HUD/monitor constructors from `lib/multiplayer/mp_network.js`, the unused helpers in `lib/multiplayer/mp_sessions.js`, and the `testConnection() / autoSelectBestServer() / saveServerPreference()` stubs from `lib/multiplayer/mp_config.js`.
- **Odds & ends**
  - Dropped the unused `wouldBeOverAndBack()` helper from `lib/game-logic/violations.js`.
  - Added a persistent `looseBallPath` state for future animation wiring.

## AI helpers intentionally retained (annotated)
The remaining unused helpers will stay documented until the AI overhaul lands:
- `lib/ai/ai-decision-support.js` (`findBestDriveLaneY`, `chooseBackcourtAdvanceTarget`)

Everything else in that list has either been reintegrated (passing-lane targeting, momentum cuts, tight-defense detection) or deleted entirely.

## Still worth reviewing next
- **Scoreboard refinements**: the HUD now reuses helpers from `score-calculator.js`, but there is more view-model consolidation we can do when time allows (controller labels, turbo bars, etc.).

Everything else flagged in the original audit has been removed or annotated, so future passes can focus on the smaller set above (plus the intentional AI backlog).
