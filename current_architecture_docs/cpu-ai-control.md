## Overview

CPU decision-making is split across four dedicated AI modules that are loaded from `nba_jam.js` through `lib/core/module-loader.js`:

1. `lib/ai/offense-ball-handler.js` – controls the player with possession.
2. `lib/ai/offense-off-ball.js` – manages the teammate’s positioning, cuts, and passing-lane shoves.
3. `lib/ai/defense-on-ball.js` – handles containment, steals, and shoves against the ball carrier.
4. `lib/ai/defense-help.js` – keeps the off-ball defender in sync with the ball location (paint help vs. deny stance).

All four modules now source their heuristics from `lib/config/ai-constants.js`, which exposes `OFFENSE_BALL`, `OFFENSE_OFF_BALL`, `DEFENSE_ON_BALL`, and `DEFENSE_HELP` blocks. That keeps single-player, demo, and multiplayer authority behavior aligned.

## Offense – Ball Handler (`lib/ai/offense-ball-handler.js`)

- **Decision windows.** When the handler exits a shove battle without a dribble (`ballCarrierNeedsDecision` flag), the module evaluates a pass versus shot within `OFFENSE_BALL.DECISION.QUICK_WINDOW_MS` (200 ms). Pass quality factors in distance, teammate proximity to the basket, “openForPass” hints, and defender tightness.
- **Priority ladder.**
  1. **Exploit shove** – immediate drive/pull-up/shoot using `EXPLOIT_SHOVE` thresholds (distance, dunk skill, turbo reserves).
  2. **Low-turbo finishes** – if within 10 tiles of the rim and turbo < 15, attempt a quick shot or drive using the `FINISH_*` distances.
  3. **Backcourt evacuation** – uses the `BACKCOURT` block to decide when to juke, when to turbo, and when to pass out if the timer stalls.
  4. **Perimeter three** – specialists fire early if spacing, shot clock, and transition timers (from `QUICK_THREE`) line up.
  5. **Lane drives / high-flyer gathers** – `DRIVE` and `HIGH_FLYER` constants decide whether to burn turbo to reach a gather point or simply steer toward the hoop.
  6. **Escape pressure** – when contact distance drops below 1.9, the handler may shake, retreat, or trigger the off-ball teammate to relieve pressure.
  7. **Dead-dribble battles** – `DEAD_DRIBBLE` probabilities model shake/shove attempts once the pivot timer exceeds ~15 frames.
  8. **Shot clock urgency** – when `context.isShotClockUrgent(SHOT_CLOCK_URGENT)` flips, the handler forces a shot regardless of spacing.
- **State hooks.** Each decision writes to `playerData.aiLastAction`, making it easy for HUD overlays or debug tooling to show what the AI attempted that frame.

## Offense – Off Ball (`lib/ai/offense-off-ball.js`)

- **Frontcourt racing.** If the handler is still in the backcourt, the teammate sprints to a spacing spot using `OFFENSE_OFF_BALL.FRONTCOURT` speeds and turbo thresholds. Turbo costs are deliberately lower off ball (`turboCostFactor` = 0.5) to avoid exhausting the CPU teammate.
- **Passing-lane creation.** When `findOpenPassingLaneTarget` returns a seam, the AI sets `playerData.aiLastAction = "passing_lane_cut"` and repositions toward that point. Turbo is only spent if lane clearance is high enough (`PASSING_LANE.clearanceThreshold`).
- **Momentum cuts.** If `evaluateMomentumCutPlan` detects a leaning defender or “bunched up” offense, the module chooses a pre-scripted cut (V-cut, basket cut, or wing cut). Turbo usage is gated by `MOMENTUM_CUT.turboThreshold`.
- **Backdoor triggers.** A defender who drifts more than `BACKDOOR.defenderExtraDistance` beyond the wide-open distance causes an immediate cut to the hoop at the configured speed.
- **Active cut fallback.** Standing on a spot for longer than `ACTIVE_CUT.wobbleFrames` (20 frames) initiates a randomly chosen cut pattern. Basket cuts are allowed to consume turbo using `ACTIVE_CUT.turboSpeed`.
- **Passing-lane shoves.** If the direct lane between handler and teammate is blocked (`clearance < PASS_LANE_SHOVE.clearanceThreshold`), the teammate evaluates which defender is closest to that lane and may shove them if the random roll (scaled by power attribute) passes.

## Defense – On Ball (`lib/ai/defense-on-ball.js`)

- **Containment geometry.** The defender parks `DEFENSE_ON_BALL.containDistance` tiles ahead of the handler along the vector to the defender’s basket, adding a bit of jitter so it doesn’t look perfectly robotic.
- **Pressure vs. retreat.** Within `stealDistance` (1.7 tiles), the AI rolls against the configured steal probability (`stealBaseChance + ATTR * stealAttrFactor`). If the handler has picked up the dribble and the shove cooldown is clear, it will attempt a shove; otherwise it backs up by `retreatStep` tiles at either `settleSpeedHigh` or `settleSpeedLow` depending on power.

## Defense – Help (`lib/ai/defense-help.js`)

- **Paint help.** When the handler is within `DEFENSE_HELP.ballCloseDistance` of the hoop, the helper slides toward a paint coordinate offset by 10 tiles from the basket, with speed scaled by its attribute and reduced if the handler is stuck without a dribble.
- **Deny stance.** Otherwise the helper positions between the handler and “my man,” incorporating a reaction delay (`denyReactionDelayBase + randRange`) and positional error to keep cuts viable. When the handler loses the dribble, support shifts closer to the assignment.
- **Fallback patrol.** If no offensive assignment exists (two-player drills, for example), the helper hovers near the paint coordinates using the slower fallback response/speed values.

## Multiplayer Notes

- The multiplayer coordinator (`lib/multiplayer/mp_coordinator.js`) runs these same AI modules when filling CPU slots or simulating opponents. Because the state manager is shared, the AI’s intent can be serialized and replayed deterministically on every client.
- Clients never guess AI choices—they simply receive authoritative state updates. The only prediction logic lives in `mp_client.js`, and it applies exclusively to human inputs (movement commands). That keeps AI timing consistent regardless of latency.
