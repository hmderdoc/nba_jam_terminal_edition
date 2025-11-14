# Copilot Guidance – NBA JAM (Wave 24+)

**Mission:** ship changes that fit the Wave 24 architecture, keep the codebase testable, and never reintroduce pre‑Wave23 debt. Treat everything in `current_architecture_docs/` as the canonical playbook.

---

## 1. Core Principles

1. **Constants over literals** – Every number/string that describes gameplay, timing, AI, multiplayer, etc. must originate from `lib/config/*.js` and flow through `lib/utils/constants.js`. Never embed `80`, `24`, `1.5`, etc. in source files; if a new value is needed, add/extend the appropriate config module.
2. **State through systems** – Read/write game state only via `systems.stateManager`. Do not touch globals (`gameState`, `teamAPlayer1`, etc.). `current_architecture_docs/tech-debt-plan.md` tracks remaining migrations—follow that roadmap.
3. **Unified game loop** – All gameplay logic runs inside `runGameFrame(systems, config)`:
   - Authority responsibilities (`config.isAuthority === true`): timers, AI, violations, authoritative movement, state broadcasts.
   - Clients (non-authority) handle rendering, animations, prediction, reconciliation.
4. **Non-blocking always** – Never call `mswait`, `frameScheduler.waitForNextFrame` inside logic. Use state flags/timestamps (e.g., `violationPause`) so the loop keeps ticking.
5. **Document first** – When introducing new behavior, update/consult the relevant doc in `current_architecture_docs/` (e.g., `multiplayer-client-architecture-and-gameloop.md`, `tech-debt-plan.md`, `rendering.md`) before writing code.

---

## 2. Good Patterns to Favor

| Area | Preferred Pattern |
|------|------------------|
| **Config** | Extend `lib/config/{gameplay,timing,ai,mp,player}-constants.js`, then surface via `lib/utils/constants.js`. |
| **Frames/UI** | Acquire frames through `FrameManager.get/ensure`; never instantiate anonymous `new Frame()` outside `initFrames`. |
| **State mutations** | `systems.stateManager.set(key, value, reason)` where `reason` explains the trigger. |
| **Events** | Emit through `systems.eventBus` / `emitGameEvent` with structured payloads. |
| **Multiplayer prediction** | Use shared helpers (`previewMovementCommand`, `PLAYER_CLIENT_COLLISION_THRESHOLD`, etc.) so coordinator and clients stay in sync. |
| **Logging** | Use `debugLog()` for verbose tracing, `log(LOG_*, msg)` for operator-facing issues, and keep messages structured (`[MODULE] context`). Guard noisy logs with feature flags or interval checks. |
| **Docs/tests** | Update `current_architecture_docs/*.md` when patterns change; add small harnesses or unit scripts under `tests/` instead of describing manual test steps. |

---

## 3. Bad Practices to Avoid

1. **Magic numbers / inline tuning** – If you see a literal representing timing, geometry, AI heuristics, network behavior, etc., move it into the correct constants module. Never add new literals.
2. **Legacy globals** – No `teamAPlayer1`, `courtFrame`, `announcerFrame`, etc. Use the state manager or FrameManager aliases already in place.
3. **Duplicated logic** – Reuse shared helpers (movement preview, collision checks, animation timing). If the helper doesn’t exist, create it once and import it.
4. **Ad-hoc debugging** – Don’t sprinkle `print()` or partial logging. Instrument all branches of a diagnostic block, and remove/guard temporary logs before finishing.
5. **Speculative fixes** – Do not “try” changes without a reasoned hypothesis. Define the hypothesis, outline how it will be validated, and ensure logs/tests can prove or falsify it.
6. **Manual test instructions** – Never rely on “run the game and watch.” Instead, add harnesses, scripted flows, or deterministic logs/tests so behavior can be verified in isolation.
7. **Legacy patterns** – If you encounter pre-Wave23 fallbacks (blocking waits, direct console writes, raw sprite manipulation), replace them proactively. Don’t extend legacy code.

---

## 4. Reasoning About Modes

| Mode | Authority? | Key Notes |
|------|------------|-----------|
| Single-player | yes | `gameLoop()` creates `config.isAuthority=true`; handle keyboard input via `handleInput`. |
| CPU Demo | yes | Same loop as SP but AI-only; maintain announcer/HUD behavior. |
| Multiplayer Coordinator | yes | Consumes client inputs, runs full authority logic, broadcasts snapshots. |
| Multiplayer Client | no | Predicts locally, reconciles via `updateOtherPlayers` + `reconcileMyPosition`; never mutates authoritative state. |

When making changes, ensure both sides of the authority boundary still compile and run:
- If modifying movement/physics, update prediction helpers (`previewMovementCommand`, client guard).
- If altering UI or rendering cadence, consider both single-player and multiplayer tick paths.

---

## 5. Debugging Workflow

1. **Use `debug.log` and `data/error.log`** – Never ask users to paste logs; instrument code so logs are already comprehensive.
2. **Structured logging** – Prefix entries (e.g., `[RUN_GAME_FRAME]`, `[MP CLIENT]`). Include relevant IDs/coords/state keys.
3. **Repro scripts** – When an error is reported, create a minimal repro under `data/error-snapshots/` or `tests/` to replay the issue. Update docs with findings.
4. **Hypothesis-driven** – Before coding, write down:
   - Observation (from logs/tests)
   - Hypothesis (single sentence, testable)
   - Validation plan (which log/test proves it)
   Copilot should not commit changes until the hypothesis can be validated.
5. **No log spam** – If logging inside tight loops, throttle output or guard behind a flag. Remove or downgrade debug logs once the issue is resolved.

---

## 6. Tech Debt Discipline

1. **Consult `current_architecture_docs/tech-debt-plan.md`** before touching anything. If your change relates to an item, update the status/notes.
2. **Eliminate legacy patterns when encountered** – Don’t extend old APIs; migrate them.
3. **Small, reversible steps** – Prefer multiple small commits (or at least logically separated changes) so we can bisect regressions.
4. **Testing before fixes** – When fixing bugs, create or update tests/log-driven assertions that fail first, then implement the fix.
5. **Documentation parity** – Every architectural or systemic change must include doc updates (flow descriptions, new constants, etc.).

---

## 7. Working With `current_architecture_docs`

1. **Architecture references** – Before editing a subsystem, open the matching doc:
   - Rendering: `rendering.md`, `frame-manager.md`
   - Multiplayer: `multiplayer-client-architecture-and-gameloop.md`, `multiplayer-rendering.md`
   - AI: `ai-overview.md`, `offense/defense` docs
   - Tech debt / roadmap: `tech-debt-plan.md`
2. **Pattern extraction** – If you discover a repeatable solution, document it (e.g., new helper usage, new config surface). Copilot must read and follow these docs instead of inventing new conventions.
3. **Legacy identification** – If you encounter a pattern not represented in the docs, assume it’s legacy. Migrate it or record it in the docs for future removal.

---

## 8. Testing Expectations

1. **Unit-style when possible** – For helpers (movement preview, AI decision thresholds, string formatting), add tests under `tests/` that can run via `jsexec`.
2. **Simulation scripts** – Use `tests/run-all-tests.js`, `test_wrapper.js`, or new harnesses to simulate frames, inbound plays, etc. Don’t rely on manual key presses.
3. **Logged verification** – When a feature can’t be unit-tested easily, emit deterministic logs (with timestamps suppressed) that can be grepped to confirm behavior.
4. **No manual checklists** – Replace “verify manually” with “run script X / inspect log Y for entry Z”. If a script doesn’t exist, write it.

---

## 9. Change Workflow

1. **Plan** – Identify which doc/config/module is affected. Write down the hypothesis and intended tests/logs.
2. **Implement** – Follow existing patterns; introduce helpers before duplication grows.
3. **Test** – Run targeted scripts/log reviews. Ensure announcer/HUD/multiplayer flows are unaffected if touched.
4. **Document** – Update constants files, architecture docs, and audit markdowns reflecting new work.
5. **Review** – Re-read logs/tests to confirm they substantiate the hypothesis. Remove temporary instrumentation.

---

## 10. Quick Reference Checklist

- [ ] All constants sourced from `lib/config/*.js`.
- [ ] No new globals or direct frame instantiations; use FrameManager/state manager.
- [ ] Non-blocking logic preserved; pauses implemented via state/timestamps.
- [ ] Multiplayer coordinator/client kept in sync (shared helpers, thresholds).
- [ ] Debug logs comprehensive but controlled; hypotheses logged/tested.
- [ ] Docs/tests updated alongside code.
- [ ] Legacy patterns replaced, not extended.
- [ ] Changes validated without manual gameplay (scripts/logs/tests).

Adhering to these guidelines keeps Copilot’s contributions aligned with our Wave 24 architecture, prevents regressions, and drives the codebase toward the documented target state. If in doubt, stop and consult the docs—then update them so the next change is easier. ***!
