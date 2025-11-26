## Modules Involved

- `lib/game-logic/violations.js` – owns detection/state for backcourt, five-second, and violation-induced inbound logic.
- `lib/core/game-loop-core.js` – calls `checkViolations` every frame and pauses the clock/physics whenever a violation occurs.
- `lib/game-logic/game-state.js` & `stateManager` – store the timers (`backcourtTimer`, `ballHandlerAdvanceTimer`, `ballHandlerStuckTimer`, `shotClock`, etc.) that violations read/write.

## Key Violations

### Backcourt Violations

- **Timers & flags.** `checkViolations` tracks `backcourtTimer`, `ballHandlerAdvanceTimer`, and `frontcourtEstablished`. `isInBackcourt(player, team)` and `isClearlyInFrontcourt` use the court midpoint (`Math.floor(COURT_WIDTH / 2)`) to determine whether possession has crossed the line.
- **Establishing frontcourt.** `setFrontcourtEstablished(teamName, systems)` runs once per team per possession and stops score flashes if the scoring team retains the ball. The timer resets via `resetBackcourtState` whenever possession changes or a violation occurs.
- **Over-and-back detection.** If the handler re-enters the backcourt after frontcourt has been established, `checkViolations` triggers `setupViolationInbound` for the opposing team.
- **Enforcement toggle.** `ENFORCE_BACKCOURT_VIOLATIONS` (sourced from `GAME_MODE_CONSTANTS.RULE_ENFORCEMENT.BACKCOURT_VIOLATIONS_ENABLED`) determines whether `maybeEnforceBackcourtViolation` actually whistles the play. When disabled, timers continue updating so AI logic still respects backcourt urgency, but possession isn’t flipped and the timer is reset quietly.

### Five-Second / Stalled Handler

- `ballHandlerStuckTimer` increments whenever the handler barely moves (`distanceMoved < 3`) while closely guarded (`guardDistance <= 4`). When the timer crosses thresholds checked in `checkViolations`, the game either forces a shake/shove attempt (`aiOffenseBall`) or whistles a violation.

### Shot Clock

- Managed inside `runGameFrame`. Every second, `shotClock` decrements; when it hits zero, the loop:
  1. Announces the event (`announceEvent("shot_clock_violation", …)`).
  2. Waits `SHOT_CLOCK_RESET_PAUSE_MS` (default 1000 ms) via `frameScheduler`.
  3. Calls `switchPossession`.
  4. Resets `shotClock` to `SHOT_CLOCK_DEFAULT` (24 seconds).

### Violation Inbounds

When any violation fires, `setupViolationInbound(violatingTeam, systems)`:

1. Picks the inbounding team (opposite of the violator) and alternates which player inbounds (`inboundAlternateIndex` in `stateManager`).
2. Clears `shotInProgress`, `reboundActive`, `ballCarrier`, and resets the shot clock.
3. Calculates sideline targets near midcourt for the inbounder, receiver, and defenders, storing them in `inboundPositioning`.
4. Teleports the ball to the inbounder, schedules the inbound pass through `inboundPassData`, and plays the possession beep.
5. Calls `resetBackcourtState` so the new possession has a clean timer.

## Data Flow

- All timers and flags live inside the `stateManager`, so multiplayer coordinators and single-player runs share the same logic.
- Rendering (scoreboard/announcer) reacts through `announceEvent` and `stateManager` keys rather than re-deriving rules.

## Implementation Checklist

When introducing new rules or modifying existing ones:

- Add any new timers/flags to `game-state.js` (for initial values) and document them in the state manager comments.
- Update `resetBackcourtState` or create a similar helper so the new rule resets cleanly on possession changes.
- Integrate the violation into `runGameFrame` or `checkViolations`, making sure to short-circuit the frame and play nicely with the inbound setup.
- Keep all geometry math dependent on `COURT_WIDTH`, `COURT_HEIGHT`, and `BASKET_*` constants so court tweaks propagate automatically.
