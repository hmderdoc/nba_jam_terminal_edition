# Phase 3 Complete: AI Systems Extraction

## AI Modules Created (5 files, 929 lines total)

### 1. lib/ai/coordinator.js (173 lines)
- **Purpose**: Main AI update loop with two-pass system
- **Functions**: 
  - `updateAI()` - Assigns AI states and executes logic
  - `handleAIRebound()` - Rebound scramble positioning
- **States**: OFFENSE_BALL, OFFENSE_NO_BALL, DEFENSE_ON_BALL, DEFENSE_HELP, REBOUND
- **Architecture**: 
  - Pass 1: Assign states to all AI players
  - Pass 2: Execute state-specific functions
  - Filters out human-controlled players (local and remote)
  - Handles knockdown recovery and steal cooldowns

### 2. lib/ai/offense-ball-handler.js (377 lines)
- **Purpose**: AI logic for player with ball
- **Priority Cascade**:
  0. Exploit shove opportunities (defender knocked back)
  1. Finish plays when close (even without turbo)
  2. Advance from backcourt (with stuck detection)
  3. Perimeter quick threes (specialists)
  4. Drive to basket when lane open
  5. Open shots
  6. Pass when help collapses
  7. Force shot on shot clock expiration
  8. Handle dead dribble (shake/shove battles)
  9. Default probe behavior
- **Key Features**:
  - Dynamic turbo usage based on situation
  - Shot quality evaluation
  - Escape pressure logic
  - Press break logic
  - Power rim finishes for high flyers

### 3. lib/ai/offense-off-ball.js (231 lines)
- **Purpose**: AI logic for offensive player without ball
- **Priority Cascade**:
  0. Exploit shove (defender shoved - CUT TO BASKET!)
  1. Sprint to frontcourt when ball in backcourt
  2. Backdoor cuts when defender sleeping
  3. Active cutting when standing too long (V-cuts, basket cuts, wing cuts)
  4. Space the floor (maintain proper spacing)
  5. Create passing lanes (shove defenders blocking lanes)
- **Key Features**:
  - Wobble timer detection (triggers cuts after 20 frames)
  - V-cut, basket cut, wing cut options
  - Passing lane clearance evaluation
  - Off-ball shove mechanics (clear passing lanes)
  - Signal `openForPass` to ball handler

### 4. lib/ai/defense-on-ball.js (62 lines)
- **Purpose**: Primary defender guarding ball handler
- **Strategy**: Contain (stay between ball and basket)
- **Key Features**:
  - Position 3 units in front of ball carrier
  - Steal attempts based on skill
  - Shove on dead dribble
  - Retreat to avoid cheap contact
  - Speed varies by power skill (2.2 for high power, 1.6 for low)

### 5. lib/ai/defense-help.js (86 lines)
- **Purpose**: Off-ball defender (help defense)
- **Strategy**: Protect paint when ball close, deny passing lanes when ball far
- **Key Features**:
  - Paint help when ball within 15 units of basket
  - Passing lane denial when ball far from basket
  - **NERFED**: Reaction delay (30-50%) and positional error (2-5 units)
  - Momentum-based positioning
  - Dribble-dead awareness (slower, tighter coverage)

## Load Statements Added to nba_jam.js (+5 lines)
```javascript
// === PHASE 3: AI MODULES ===
load(js.exec_dir + "lib/ai/coordinator.js");
load(js.exec_dir + "lib/ai/offense-ball-handler.js");
load(js.exec_dir + "lib/ai/offense-off-ball.js");
load(js.exec_dir + "lib/ai/defense-on-ball.js");
load(js.exec_dir + "lib/ai/defense-help.js");
```

## Progress Summary

### Total Extracted So Far (3 Phases)
- **Phase 1** (Utilities & Rendering): 6 modules, ~1,100 lines
- **Phase 2** (Core Game Logic): 5 modules, ~1,526 lines
- **Phase 3** (AI Systems): 5 modules, ~929 lines
- **Total**: 16 modules, ~3,555 lines extracted to modules

### Main File Status
- **Original Size**: 13,348 lines
- **Current Size**: 13,266 lines (added 6 lines of AI load statements, removed 111 lines of constants)
- **Still Contains**: ALL duplicate functions from Phases 1-3 (~3,555 lines)
- **After Deletion**: Target ~9,700 lines (13,266 - 3,555)

### Remaining Extractions (Phases 4-6)
- **Phase 4 - Game Logic Systems** (~2,300 lines):
  - Shooting (600 lines)
  - Passing (400 lines)
  - Rebounds (300 lines) 🎯 BUG ISOLATION TARGET
  - Shoves (250 lines)
  - Steal/Block (200 lines)
  - Possession (350 lines)
  - On-Fire (200 lines)

- **Phase 5 - UI Systems** (~1,650 lines):
  - Score display (500 lines)
  - Menus (800 lines)
  - Halftime stats (200 lines)
  - Announcer (150 lines)

- **Phase 6 - Sprite Management** (~1,000 lines):
  - Sprite init (600 lines)
  - Uniforms (400 lines)

### Final Target
- **Total to extract**: ~7,500 more lines (3,555 already done + 7,500 remaining = 11,055 total)
- **Target main file size**: ~2,500-3,000 lines (just orchestration/main loop)
- **Current vs Target**: 13,266 lines → 2,500 lines = **81% reduction**

## Next Steps
1. Continue Phase 4: Extract game logic systems (shooting, passing, rebounds, etc.)
2. After all extractions (Phases 4-6), do ONE comprehensive deletion pass
3. Verify game still runs
4. Final main file will be thin orchestration layer

## Benefits of AI Extraction
1. **Modularity**: Each AI role isolated in its own file
2. **Debuggability**: Easy to test ball handler logic without defense interference
3. **Tuning**: Can tweak offense/defense balance without searching monolith
4. **Readability**: Priority cascades documented with clear comments
5. **Maintainability**: Future AI improvements go to specific modules
