# Wave 24 Multiplayer Flicker Investigation

_Date: 2025-11-11_

## 1. Problem Statement
- **Primary symptom:** Non-coordinator clients exhibit visible flicker/snapping of the controlled sprite, most often when an inbound completes or when players bump/shove.
- **Secondary symptom:** Action commands (e.g., dunk attempts) appear to trigger several frames after the local client has initiated them; users perceive this as latency even when network ping is low.
- **Goal:** Eliminate or mask the flicker while keeping gameplay responsive and in sync with the coordinator.

## 2. Environment & Constraints
- Architecture: Wave 23D unified game loop with non-blocking systems and coordinator-authority pattern.
- Frame cadence: 20 FPS (50 ms per frame), coordinator broadcasts authoritative snapshots at ~20 Hz.
- Client responsibilities: Predict local movement, replay buffered inputs, and blend toward authoritative state without blocking the loop.

## 3. Observed Symptoms & Data
- Flicker occurs when local prediction and authoritative correction fight within the same or adjacent frames.
- Large corrections still occur (e.g. `2025-11-12T03:20:31.946Z` logging "`Position drift delta=51.16 (dx=51.00, dy=4.00)`").
- Mid-sized corrections (2–6 px) happen frequently during scrambles and inbound completion (`delta=2.06` through `delta=5.61` on 2025-11-12 03:55–03:56Z).
- Player actions sometimes execute late relative to where the user initiated them, suggesting the coordinator is consuming the input after additional predicted movement rather than at the original frame.

## 4. Timeline of Mitigation Attempts
| Attempt | Changes | Result |
| --- | --- | --- |
| A | **Animation sync & crash fixes** (committed earlier in wave) to eliminate missing animations and coordinator-only effects. | Brought visual parity baseline up to date but did not address flicker. |
| B | **Drift instrumentation & stronger reconciliation tuning** in `lib/multiplayer/mp_client.js` (magnitude thresholds, adaptive strength, drift logging). | Provided visibility into correction sizes; reduced constant jitter but did not eliminate large snaps. |
| C | **Authoritative catch-up windows** (`requestAuthoritativeCatchup`) triggered after inbound completion and shove events. | Reduced some large post-event snaps; logs confirm trigger but flicker persisted in live play. |
| D | **Visual guard** to suppress tiny authoritative corrections when prediction and authority arrive in the same tick, and to defer bearing updates while deltas are tiny. | Mitigated bearing flip-flop and some same-frame tug-of-war, yet mid-sized corrections (3–6 px) and occasional large spikes continued. |
| E | **Local collision guard** (latest change) that blocks client prediction when it would overlap an opponent's last authoritative position. | Prevents the client from walking through opponents (a root cause of big snaps). Early logs confirm guard is firing, but overall flicker reduction still pending evaluation. |

## 5. What Improved
- On-fire graphics, block animations, and other effects now sync across coordinator/non-coordinator clients.
- Authority corrections under ~2 px are often suppressed when prediction and server updates coincide, reducing small flicker instances.
- Shove and inbound transitions no longer cause automatic 10+ px snaps every time due to the catch-up window.
- Local collision guard blocks the client from predicting through opponents, removing one major source of 50+ px corrections.

## 6. What Has Not Worked / Remaining Issues
- Catch-up windows do not fully prevent snaps because the underlying authoritative position may still be far from the predicted position when the window closes.
- Visual guard only masks very small deltas; mid-range corrections (3–6 px) still flash on screen.
- Action latency persists: dunk/jump commands appear to execute after the player sprite has travelled additional frames, indicating prediction replay repositions the sprite before the coordinator processes the original input.
- We have not yet instrumented the rendering pipeline to confirm whether double draws or redraw order amplify the flicker.

## 7. Failed / Incomplete Hypotheses
- **Hypothesis:** Increasing reconciliation strength alone would smooth corrections. → Raising strength caused oscillation; decreasing strength caused late convergence. Net effect insufficient.
- **Hypothesis:** Catch-up windows after inbound/shove would cover all large deltas. → Only partially effective; large deltas still logged outside those windows (see 51.16 px entry).
- **Hypothesis:** Visual guard would eliminate flicker by suppressing small corrections. → Reduced micro flicker but did not address mid/large corrections; flicker still visible to user.

## 8. Architecture Issues Spotted
- Collision resolution is authority-only (`checkSpriteCollision()` runs only when `config.isAuthority`), so clients predict movement unhindered—hence the need for the local guard.
- The coordinator broadcast frequency (≈20 Hz) matches the frame rate, causing phase alignment. Previous tuning introduced jitter, but further decoupling may help.
- Input replay applies commands even when the authoritative state already drifted; there is no check to halt replay if the coordinator already processed the input.
- Ball-handling and animation systems still rely on instantaneous state changes that are not latency-aware; e.g., dunk initiation expects precise positioning from the start frame.

## 9. Refactoring Opportunities
- Extract a shared collision utility usable by both authority and clients to ensure identical thresholds and to track last authoritative update timestamps.
- Encapsulate prediction replay into a module that can reject replays if authority has already advanced beyond a sequence number (requires coordinator to echo back the last processed input sequence).
- Split rendering responsibilities so that authoritative overrides can queue into a dedicated smoothing buffer rather than directly mutating sprite position each frame.
- Introduce an "action initiation" timeline object so that actions triggered locally are stamped and reconciled server-side without being displaced by extra predicted frames.

## 10. Open Hypotheses
1. **Input sequence echo:** Coordinator may execute inputs after additional predicted frames because clients do not halt replay once the authoritative frame catches up. Providing explicit "last processed input" feedback could resolve action latency and some flicker.
2. **Render order contention:** Sprites may redraw twice per frame (prediction then authority) causing visual tearing; instrumentation in `court-rendering.js` may confirm.
3. **Catch-up window tuning:** Instead of a fixed decrementing integer, we may need to base it on delta magnitude (e.g., keep catch-up active until delta < 1 px).
4. **Pending authority queue:** Rather than suppressing small corrections, store them and reapply once prediction stops issuing conflicting movement.
5. **Client-side interpolation buffer:** Rendering from a short (1–2 frame) buffer of authoritative states may smooth corrections without harming responsiveness.

## 11. Work Not Yet Attempted
- Renderer instrumentation to log when sprites are drawn by prediction vs authority, and to verify if the same frame is drawn twice.
- Sequence-aware input acknowledgement from coordinator to client to prevent replaying already-processed inputs.
- Soft collision pushback (nudging to edge of hitbox) rather than hard block, to improve feel without allowing overlap.
- Decaying reconciliation strength based on time since last authoritative update (may reduce mid-sized snaps).
- Latency-aware action queueing so that actions triggered locally are sent immediately with positional context, preventing late firing.

## 12. Plan for Next Steps
1. **Instrument rendering & collision logging**
   - Add logs in `lib/rendering/court-rendering.js` and `lib/rendering/sprite-utils.js` to note prediction draws vs authoritative overrides.
   - Record when the same sprite receives two move operations within a single frame.
2. **Refine local collision guard**
   - Include recency timestamps to avoid blocking against stale positions.
   - Consider soft pushback so the player slides along the defender rather than stopping outright.
3. **Introduce input sequence acknowledgements**
   - Coordinator includes the last processed input sequence number in state packets; client prunes replay accordingly.
   - Should reduce both flicker and action latency.
4. **Catch-up window rework**
   - Switch from frame countdown to delta-based closure (exit when delta < threshold for N frames).
   - Optionally raise thresholds while catch-up active to fully snap without oscillation.
5. **Evaluate buffered rendering**
   - Prototype a 1-frame render delay for authoritative corrections to smooth visible snapping while maintaining input responsiveness.
6. **Validation loop**
   - After each change, run multi-client repro focusing on inbound completion, shove collisions, and baseline dunk attempts to confirm whether flicker and late actions decrease.

## 13. Data References
- `[2025-11-12T03:20:31.946Z] [MP CLIENT] Position drift delta=51.16 (dx=51.00, dy=4.00)` — example of large correction still present.
- `[2025-11-12T03:55:02.773Z] [MP CLIENT] Position drift delta=3.78 (dx=3.35, dy=1.75)` — mid-sized corrections after recent changes.
- `[2025-11-12T03:55:03.175Z] [MP CLIENT] Position drift delta=5.61 (dx=5.04, dy=2.46)` — upper mid-range corrections that remain visible.
- `[2025-11-12T03:56:53.365Z] [MP CLIENT] Position drift delta=2.52 (dx=2.31, dy=1.00)` — suppressed by visual guard but still logged for monitoring.

## 14. Current Status Summary
- **Implemented:** Drift logging, adaptive reconciliation tuning, authoritative catch-up windows, visual guard for small deltas, local collision guard.
- **Improved but unresolved:** Flicker reduced in some scenarios, but mid-size snaps and perceived action latency persist.
- **Next focus:** Instrument rendering path, enhance collision guard with recency awareness, and add input sequence feedback loop to reduce the root causes of the flicker.
