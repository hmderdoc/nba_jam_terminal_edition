# NBA JAM Terminal Edition - Questions to Answer

Open questions about architecture, design decisions, and implementation details that require clarification or decisions.

---

## Architecture Questions

### Q1: Should we use a sprite registry instead of global variables?
**Context**: Currently using global `teamAPlayer1`, `teamAPlayer2`, etc.

**Options**:
- **A**: Keep globals (simple, works)
- **B**: Implement sprite registry (cleaner, more flexible)

**Trade-offs**:
- Globals: Easier to access, but harder to test, limits flexibility
- Registry: More code, but enables 3v3, spectators, better multiplayer

**Recommendation**: Registry (future-proof)

**Decision Needed**: Yes/No + timeline

---

### Q2: Should AI run client-side in multiplayer?
**Context**: Currently only coordinator runs AI for CPU players

**Options**:
- **A**: Coordinator-only (current) - Authoritative
- **B**: All clients run AI - Reduces coordinator load

**Trade-offs**:
- Coordinator-only: Guaranteed consistency, but high CPU on coordinator
- Distributed: Load balanced, but desync risk if AI non-deterministic

**Recommendation**: Keep coordinator-only, make AI deterministic for future migration

**Decision Needed**: Architecture choice

---

### Q3: Should we separate game loop into mode-agnostic core?
**Context**: gameLoop() and runMultiplayerGameLoop() have ~70% duplicate code

**Options**:
- **A**: Keep separate loops (current)
- **B**: Extract shared core, mode-specific wrappers

**Trade-offs**:
- Separate: Easier to understand, but duplicate code
- Unified: DRY, but more abstraction

**Recommendation**: Extract shared core (Wave 10+)

**Decision Needed**: Refactoring priority

---

### Q4: What frame rate should we target?
**Context**: Currently 20 FPS (50ms frame time)

**Options**:
- **A**: Keep 20 FPS - Terminal rendering limit
- **B**: Increase to 30 FPS - Smoother
- **C**: Decrease to 15 FPS - Lower CPU

**Trade-offs**:
- 20 FPS: Good balance, works well
- 30 FPS: Smoother, but terminal might not keep up
- 15 FPS: Choppy feel

**Recommendation**: Keep 20 FPS (proven)

**Decision Needed**: Performance vs smoothness

---

### Q5: Should we implement coordinator failover?
**Context**: Game crashes if coordinator disconnects

**Priority**: **HIGH** (critical bug)

**Options**:
- **A**: Implement election (deterministic)
- **B**: Session ends on coordinator disconnect (simple)

**Recommendation**: Implement election (required for production)

**Decision Needed**: WHEN (Wave 7 vs later)

---

## Gameplay Questions

### Q6: Is diagonal movement speed a bug or feature?
**Context**: Moving diagonally is 40% faster due to non-normalized vectors

**Options**:
- **A**: Bug - fix it (normalize vectors)
- **B**: Feature - matches arcade feel

**Recommendation**: Fix it (unfair advantage)

**Decision Needed**: Gameplay balance

---

### Q7: Should we enforce fouls?
**Context**: NBA JAM arcade didn't have fouls, but we have shove mechanic

**Options**:
- **A**: No fouls (arcade authentic)
- **B**: Add fouls for excessive shoving

**Recommendation**: No fouls (keep arcade spirit)

**Decision Needed**: Gameplay rules

---

### Q8: What should shot success rate be?
**Context**: Current rates might be too high/low

**Options**:
- **A**: Based on player stats only
- **B**: Stats + defender distance + shot clock
- **C**: Fully arcade (streaky hot/cold)

**Recommendation**: Option B (balanced realism + arcade)

**Decision Needed**: Tuning parameters

---

### Q9: Should AI difficulty be selectable?
**Context**: Currently hardcoded to medium

**Options**:
- **A**: Keep hardcoded (simple)
- **B**: Add difficulty menu (easy/medium/hard/arcade)

**Recommendation**: Add menu (user choice)

**Decision Needed**: Priority

---

### Q10: How long should games be?
**Context**: Current default is 4 minutes (2 minute halves)

**Options**:
- **A**: Keep 4 minutes - Quick games
- **B**: Add length options (2/4/8/12 minutes)

**Recommendation**: Add options in settings

**Decision Needed**: UI change priority

---

## Multiplayer Questions

### Q11: How many players should we support?
**Context**: Currently max 4 (2v2)

**Options**:
- **A**: Keep 2v2 only (current)
- **B**: Support 1v1, 2v2, 3v3
- **C**: Support up to 5v5

**Recommendation**: Add 1v1 support, keep 2v2 max

**Decision Needed**: Scope

---

### Q12: Should we allow spectators?
**Context**: Not currently supported

**Options**:
- **A**: No spectators (simpler)
- **B**: Read-only spectators (view game state)
- **C**: Spectators can chat

**Recommendation**: Option B (low priority)

**Decision Needed**: Feature priority

---

### Q13: How should we handle network lag?
**Context**: Client-side prediction helps, but high lag still noticeable

**Options**:
- **A**: Current (prediction only)
- **B**: Add input replay (better)
- **C**: Add lag compensation (rollback)

**Recommendation**: B for Wave 8, C for future

**Decision Needed**: Implementation timeline

---

### Q14: Should we implement matchmaking?
**Context**: Currently manual session join

**Options**:
- **A**: Manual only (current)
- **B**: Quick match (auto-join)
- **C**: Skill-based matchmaking

**Recommendation**: B (simple auto-join)

**Decision Needed**: Priority

---

### Q15: What happens if session is full?
**Context**: Max 4 players, no queue

**Options**:
- **A**: Reject join (current)
- **B**: Spectator queue
- **C**: Notify when slot opens

**Recommendation**: A for now, B later

**Decision Needed**: Acceptable for v1.0?

---

## UI/UX Questions

### Q16: Should we add sound effects?
**Context**: Terminal doesn't support audio

**Options**:
- **A**: No sound (terminal limitation)
- **B**: ANSI "beeps" via console.beep()
- **C**: External audio (out of scope)

**Recommendation**: B (simple beeps for scores)

**Decision Needed**: Worth the effort?

---

### Q17: How should we handle color terminals?
**Context**: Some terminals have limited color support

**Options**:
- **A**: Require ANSI color (current)
- **B**: Fallback to monochrome
- **C**: Detect and adapt

**Recommendation**: A (most BBS terminals support color)

**Decision Needed**: Accessibility priority

---

### Q18: Should stats be saved?
**Context**: Currently stats are per-session only

**Options**:
- **A**: Session-only (current)
- **B**: Save to user profile
- **C**: Global leaderboards

**Recommendation**: B for single-player, C for multiplayer

**Decision Needed**: Persistence strategy

---

### Q19: Should we show replays?
**Context**: No replay system

**Options**:
- **A**: No replays (simpler)
- **B**: Text-based play-by-play
- **C**: State recording + playback

**Recommendation**: B (low priority)

**Decision Needed**: Feature scope

---

### Q20: How should we handle screen size differences?
**Context**: Different terminals have different dimensions

**Options**:
- **A**: Fixed 80x24 (most common)
- **B**: Detect and scale
- **C**: Configurable

**Recommendation**: A (standard BBS)

**Decision Needed**: Compatibility priority

---

## Implementation Questions

### Q21: Should we use TypeScript?
**Context**: Currently pure JavaScript for Synchronet

**Options**:
- **A**: Keep JavaScript (compatible)
- **B**: Migrate to TypeScript (type safety)

**Recommendation**: Keep JavaScript (Synchronet requirement)

**Decision Needed**: N/A (forced by platform)

---

### Q22: Should we add unit tests?
**Context**: No test coverage currently

**Options**:
- **A**: No tests (current)
- **B**: Add unit tests for core logic
- **C**: Full test suite (unit + integration)

**Recommendation**: B (test game logic, AI, state)

**Decision Needed**: Testing strategy

---

### Q23: How should we handle version updates?
**Context**: No versioning system

**Options**:
- **A**: Manual updates (current)
- **B**: Version file + migration scripts
- **C**: Auto-update from git

**Recommendation**: B (version tracking)

**Decision Needed**: Deployment strategy

---

### Q24: Should we log debug info?
**Context**: Minimal logging currently

**Options**:
- **A**: No logging (current)
- **B**: Debug log file (toggled)
- **C**: Full logging framework

**Recommendation**: B (already partially implemented)

**Decision Needed**: Debugging priority

---

### Q25: How should we handle errors?
**Context**: Many places use bare `try/catch`

**Options**:
- **A**: Keep ad-hoc (current)
- **B**: Centralized error handler
- **C**: Error reporting service

**Recommendation**: B (log + display)

**Decision Needed**: Error handling strategy

---

## Data Questions

### Q26: Where should we store team data?
**Context**: Currently in `lib/game-logic/team-data.js`

**Options**:
- **A**: Keep in JS file (current)
- **B**: Move to JSON file
- **C**: Database

**Recommendation**: B (easier to edit)

**Decision Needed**: Data format

---

### Q27: Should we allow custom teams?
**Context**: Only NBA teams currently

**Options**:
- **A**: NBA teams only (authentic)
- **B**: Allow user-created teams

**Recommendation**: A (keep authentic)

**Decision Needed**: Customization scope

---

### Q28: How should we handle announcer text?
**Context**: Currently in JSON file

**Options**:
- **A**: Keep JSON (current)
- **B**: Move to database
- **C**: Allow custom announcer packs

**Recommendation**: A for now, C later

**Decision Needed**: Extensibility priority

---

## Performance Questions

### Q29: Is 20 FPS enough?
**Context**: Currently targeting 20 FPS

**Answer**: Seems good based on testing

**Follow-up**: Should we make it configurable?

**Decision Needed**: Performance tuning

---

### Q30: How many concurrent multiplayer sessions can we support?
**Context**: JSON-DB limits unknown

**Options**:
- **A**: No limit (trust JSON-DB)
- **B**: Cap at 10 sessions
- **C**: Dynamic based on load

**Recommendation**: B (safe limit)

**Decision Needed**: Capacity planning

---

### Q31: Should we optimize sprite rendering?
**Context**: Currently redrawing entire court every frame

**Options**:
- **A**: Keep full redraw (simple)
- **B**: Dirty rectangle tracking
- **C**: Layer-based rendering

**Recommendation**: A (terminal rendering is slow anyway)

**Decision Needed**: Optimization priority

---

### Q32: Should we profile for bottlenecks?
**Context**: No performance profiling done

**Options**:
- **A**: No profiling (works fine)
- **B**: Basic timing logs
- **C**: Full profiler

**Recommendation**: B (identify slow paths)

**Decision Needed**: Performance analysis priority

---

## Questions Summary by Category

| Category | Count | Priority | Decisions Needed |
|----------|-------|----------|------------------|
| Architecture | 5 | High | 3 |
| Gameplay | 5 | Medium | 4 |
| Multiplayer | 5 | High | 3 |
| UI/UX | 5 | Low | 2 |
| Implementation | 5 | Medium | 3 |
| Data | 3 | Low | 2 |
| Performance | 4 | Low | 2 |
| **Total** | **32** | - | **19** |

---

## Decision-Making Framework

### Must Decide Now (Blocking)
1. Q5: Coordinator failover (blocking multiplayer stability)
2. Q2: AI architecture (affects multiplayer design)
3. Q3: Game loop refactoring (affects Wave 7+)

### Should Decide Soon (Important)
4. Q6: Diagonal movement (gameplay balance)
5. Q13: Network lag handling (multiplayer experience)
6. Q18: Stats persistence (user experience)
7. Q22: Unit tests (code quality)

### Can Decide Later (Nice to Have)
8. Q12: Spectators (feature expansion)
9. Q16: Sound effects (polish)
10. Q27: Custom teams (extensibility)

---

## Recommended Decision Process

1. **Review with stakeholders** (if any)
2. **Prototype controversial options** (e.g., sprite registry)
3. **A/B test gameplay changes** (e.g., diagonal movement)
4. **Document decisions** in `DECISIONS.md`
5. **Update questions list** as answered

---

## Conclusion

**Total Questions**: 32  
**Critical Decisions**: 3  
**Important Decisions**: 4  
**Optional Decisions**: 25

**Next Steps**:
1. Answer Q5 (coordinator failover) → Prioritize for Wave 7
2. Answer Q6 (diagonal movement) → Fix in Wave 7
3. Answer Q22 (unit tests) → Add in Wave 8
4. Document all decisions for future reference

Many questions can be deferred until after core bugs are fixed and multiplayer is stable.
