## Control Flow Overview

Even in single-player, the codebase treats the main process as an “authority” similar to the multiplayer coordinator. The control surfaces are:

1. **Menus (`lib/ui/menus.js`).** Handles team selection, demo screens, splash screen, and matchup intros. Once teams are picked, the menu returns a structure describing the chosen rosters.
2. **Game setup (`nba_jam.js`).** After receiving the menu selection, `nba_jam.js`:
   - Calls `resetGameState` to seed the state manager with half lengths, scores, turbo meters, etc.
   - Invokes `initSprites` to instantiate player sprites for the selected teams.
   - Calls `initFrames` so all rendering surfaces exist.
   - Builds `systems` via `initializeSystems`.
3. **Authority loop (`gameLoop`).** Single-player always sets `config.isAuthority = true`, so it alone is responsible for:
   - Collecting inputs directly from the console (`console.inkey`).
   - Running AI (`updateAI`) according to the `getSinglePlayerTempo()` preset.
   - Advancing timers, resolving violations, and determining outcomes for shots/rebounds.
4. **UI transitions.**
   - `showHalftimeScreen` is invoked whenever `runGameFrame` returns `"halftime"`.
   - `showGameOver` runs once `runGameFrame` reports `"game_over"` or the player quits.
   - `cleanupSprites` / `resetGameState` prepare for the next match or demo.

## Input Handling

The `handleInput` callback inside `gameLoop` reads raw key codes and passes them to `handleInput(key, systems)`, letting the input handler route commands to the correct sprite (human player vs. CPU). This is intentionally decoupled from AI; if a key is pressed, AI logic is skipped for that sprite in the current frame.

## AI & Authority Separation

- The single-player authority runs the same AI modules that the multiplayer coordinator uses (`offense-ball-handler`, `offense-off-ball`, `defense-on-ball`, `defense-help`). The only difference is where inputs originate (keyboard vs. network queues).
- Because `isAuthority = true`, every result (shot success, foul, turnover) is final when returned from `runGameFrame`. UI layers simply reflect state from the manager; they never re-simulate or override gameplay outcomes.

## Cleanup Responsibilities

- Between matches `cleanupSprites` closes sprite frames and clears label frames.
- `initFrames` is idempotent but will recreate frames if they were closed (e.g., when switching from single-player to demo mode).
- The main script ensures `teamSelectionScreen` can be re-entered without carrying over stale `stateManager` data by calling `resetGameState(null, systems)` whenever the user chooses “New Teams” or “Play Again.”
