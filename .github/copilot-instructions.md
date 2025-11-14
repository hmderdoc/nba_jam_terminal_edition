# Copilot Playbook — Wave 24 Runtime

Copilot must produce changes that respect the Wave 24 architecture, eliminate legacy patterns, and stay aligned with the documentation inside `current_architecture_docs/`. Treat this file plus the docs as the single source of truth when reasoning about the codebase.

---

## 1. Mission & Scope

1. **No magic numbers.** Every tuning value lives in a config module under `lib/config/`. Extend those modules (see `current_architecture_docs/constant_reference.md`) and wire new keys through `lib/utils/constants.js` before touching game logic.
2. **Honor the entry path.** `nba_jam.js` → `module-loader` → `initializeSystems` → `runGameFrame` is sacrosanct. All new work must hook into those layers instead of creating side loops.
3. **Respect the docs.** Before writing code, read the relevant file inside `current_architecture_docs/` (rendering, multiplayer, AI, etc.). When patterns change, update the doc *first* so other contributors stay in sync.
4. **Kill tech debt on sight.** If you encounter a legacy fallback or global, migrate it. Never extend pre-Wave23 code paths.

---

## 2. Architectural Snapshot

- **Systems bundle** (`initializeSystems`) supplies `stateManager`, `eventBus`, `frameScheduler`, `passingSystem`, `possessionSystem`, `shootingSystem`, and `animationSystem`. Always accept a systems parameter instead of reaching for globals.
- **Frames** are owned by `FrameManager`. Define them via `FrameManager.define` in `initFrames`, and access them through `.get(name)` (aliases exist for old globals but should be avoided in new code).
- **State** lives inside `stateManager`. Use `set(path, value, reason)` with a descriptive reason string. Never mutate the raw `gameState` or sprite globals.
- **Game loop** (`lib/core/game-loop-core.js`) governs timers, AI cadence, rendering, and multiplayer sync. Hook in via events or helper functions—do not block or spawn competing loops.
- **Multiplayer**: Coordinators serialize state packets (`captureState`) and clients reconcile via prediction + correction. Authority changes require mirrored updates inside `mp_client.js`.

Refer to `current_architecture_docs/common_type_definitions.md` whenever you need the shape of a packet, sprite, or helper.

---

## 3. Constants Discipline

1. Use the config file that matches the domain:
   - Geometry/UI → `gameplay-constants.js`
   - Timing/animation/turbo → `timing-constants.js`
   - Player movement/collision → `player-constants.js`
   - AI heuristics → `ai-constants.js`
   - Multiplayer/network → `mp-constants.js`
   - Mode/menu/bookie toggles → `game-mode-constants.js`
2. Add the value, require it through `lib/utils/constants.js`, and replace every literal occurrence.
3. Document the change in `MAGIC-NUMBER-AUDIT.md` and, when relevant, `constant_reference.md`.
4. Never hide numbers inside helpers, tests, or logging—config-first always.

---

## 4. Practices to Favor

- **Dependency injection.** Accept `{ systems, helpers, constants }` parameters; avoid tight coupling.
- **Shared helpers.** Before writing new math, look for an existing helper (e.g., `previewMovementCommand`, `clampSpriteFeetToCourt`, `FrameManager.status`). Extend helpers if needed instead of duplicating logic.
- **State Manager reasons.** Provide specific reason strings (`"violation_inbound"`, `"shot_clock_reset"`) so diagnostics and multiplayer logs stay readable.
- **Structured logging.** Use `debugLog()` or `log(LOG_*, message)` with prefixes (`[MP CLIENT]`, `[RUN_GAME_FRAME]`). Include IDs/coords to make grep-friendly logs.
- **Document-first.** Update the relevant `.md` file whenever you create/modify a subsystem, add constants, or change debugging expectations.
- **Feature flags / staged rollout.** When experimenting (e.g., animation hints), gate the behavior and keep the stable path intact.

---

## 5. Practices to Avoid

1. **Legacy globals.** No direct references to `teamAPlayer1`, `courtFrame`, `announcerFrame`, etc. Use the state manager, `system.getPlayers()`, or `FrameManager`.
2. **Blocking waits.** Never call `mswait`, `sleep`, or `frameScheduler.waitForNextFrame` from gameplay logic. Use timestamps stored in state for pauses.
3. **Fallback hacks.** Do not add “just in case” paths that reintroduce the behavior we removed (direct court writes, redundant animation queues, manual sprite rewrites).
4. **Speculative edits.** Every change needs a hypothesis, validation plan, and supporting logs/tests. “Try this to see if it helps” is unacceptable.
5. **Manual testing requests.** Don’t ask a user to “run it and tell me what happens.” Produce logs/tests/scripts so behavior is verifiable without human observation.
6. **Incomplete logging.** When adding debug output, cover *all* branches of the logic and remove/throttle it after validation. Multiple “debug only” commits in a row are not allowed.

---

## 6. Mode Awareness

| Mode | Authority? | Considerations |
| --- | --- | --- |
| Single-player | Yes | Handles keyboard input locally; must keep announcer/HUD responsive. |
| CPU Demo | Yes | Shares the single-player loop; no human input but full announcer/HUD expectations. |
| Multiplayer Coordinator | Yes | Processes remote inputs, broadcasts state packets, records animations. |
| Multiplayer Client | No | Predicts locally (`applyMovementCommand` + `previewMovementCommand`), reconciles via packets, must never mutate authoritative state. |

Changes that affect movement, physics, HUD cadence, or logging must be evaluated for *all* modes. If you touch authoritative code, mirror the necessary changes in prediction (`mp_client.js`) and serialization (`mp_coordinator.js`).

---

## 7. Debugging Protocol

1. **Logs first.** Collect evidence from `data/debug.log` and `data/error.log`. Use `grep` or scripted analyzers instead of asking humans to read logs for you.
2. **Structured messages.** Prefix entries (e.g., `[INBOUND]`, `[PREDICTION]`) and include IDs/coords/state keys so automated tools can parse them.
3. **Comprehensive instrumentation.** When adding logging around a hypothesis, instrument success and failure branches; do not emit half the story.
4. **Cleanup.** Once the issue is validated and fixed, remove or gate the extra logging to avoid noise.

---

## 8. Hypothesis-Driven Workflow

Before making functional changes:

1. **Observation:** Summarize what the logs/tests show.
2. **Hypothesis:** Provide a concise, testable statement (“Inbound flicker occurs because clients render before receiving allowOffcourt flags.”).
3. **Validation plan:** Describe how the hypothesis will be proven or falsified (specific logs, unit tests, or repro scripts).
4. **Execution:** Implement the change, run the validation artifacts, and include results in the PR/response.

If a hypothesis fails, log it in the relevant doc (e.g., `codex-flicker-theories.md`) before starting the next idea. Do not stack blind changes.

---

## 9. Testing & Automation

- **Unit-style harnesses.** For helpers and pure functions, add tests under `tests/` that can run via `jsexec`.
- **Simulation scripts.** When verifying animations, inbound logic, or multiplayer flows, build deterministic scripts/log parsers so validation can happen offline.
- **No manual checklists.** Replace “play a match to confirm” with “run script X and inspect log Y for marker Z.”
- **Logging as tests.** If a behavior can only be observed via gameplay, emit deterministic log entries and parse them automatically to confirm success.

---

## 10. Tech Debt & Documentation

- Check `current_architecture_docs/tech-debt-plan.md` before touching a subsystem. Update the status/notes after progress or when experiments fail (record the lesson).
- Keep `current_architecture_docs/*` synchronized: if you add a type, update `common_type_definitions.md`; if you introduce a constant, update `constant_reference.md`.
- Use `animation_tuneup_ideas.md`, `codex-flicker-theories.md`, and related docs to track hypotheses and outcomes so future work doesn’t repeat mistakes.

---

## 11. Quick Checklist (run before finishing any change)

- [ ] Constants pulled from the appropriate config module; no magic numbers left behind.
- [ ] Systems access follows the dependency-injection pattern; no new globals.
- [ ] Game loop remains non-blocking; frame cadence unaffected.
- [ ] Multiplayer coordinator/client behaviors stay in sync (prediction vs. authority).
- [ ] Debug logs + error logs contain the evidence needed to validate the hypothesis.
- [ ] Tests/log scripts updated or added; no reliance on manual playthroughs.
- [ ] Relevant docs in `current_architecture_docs/` updated.
- [ ] Legacy patterns removed rather than extended.

Following this playbook keeps Copilot aligned with the team’s architecture, ensures fixes are evidence-driven, and prevents tech debt from creeping back into the project. When in doubt, stop, consult the docs, document your plan, and only then touch the code.
