# NBA Jam AI Design Discussion

## Current Status
- AI gets shot clock violations constantly
- No recognizable offensive or defensive strategy
- Analysis identified movement bugs and overly complex decision trees

## Design Discussion

### User's Approach
- Focus on how basketball players "think" conceptually
- Not random mathematical guesses
- Structure thought process aligned with game architecture
- User will lead the design structure

---

## Basketball Player Decision Making

### Fundamental State - ALWAYS KNOWN
Every player must know at all times:
- **Am I on offense?**
- **Am I on defense?**

**Key Insight:** These are the fundamental branch points. They don't share much logic beyond basic movement mechanics.

This is the PRIMARY decision tree split - everything else flows from knowing which side of the ball you're on.

---

## Movement System

### Direction System
- **8-directional movement**: 90-degree angles (N/S/E/W) + diagonals (NE/NW/SE/SW)
- **Input methods**:
  - Arrow keys (current)
  - **Numpad support** (add this)

### Movement Mechanics
- **NOT 1:1 with keystrokes** - important architectural change
- Sprites should have:
  - **Vectors** (direction of movement)
  - **Velocities** (speed of movement)
- This allows for momentum, smoother diagonal movement, and better physics

---

## Physical Actions System

### Uppercase 'S' Key - Context-Sensitive Physical Play
**Note:** Distinct from lowercase 's' (pass/steal)

#### SHOVE (Defense)
- Push offensive player
- Based on strength attribute
- Potential outcomes:
  - Force turnover
  - Create injury (rare)
  - Gain defensive positioning

#### SHAKE (Offense - Standing)
- Used when player is stationary or slow
- Push defender to create space
- Based on strength attribute
- Potential outcomes:
  - Create separation for shot
  - Open up driving lane
  - Force defender out of position

#### SLAM (Offense - Moving Fast)
- Only works when player has high velocity toward basket
- Aggressive drive to rim
- Based on:
  - Strength attribute
  - Current velocity/momentum
  - Distance to basket
- Potential outcomes:
  - Dunk attempt (if close enough)
  - Draw foul (maybe)
  - Power through defender

**Key Design Note:** Same key ('S'), different action based on context:
- Defense = Shove
- Offense + Standing/Slow = Shake
- Offense + Fast + Toward Basket = Slam

---

## OFFENSE Decision Tree

### Core Offensive Objective
**CRITICAL - AI Must Always Advance The Ball:**
- **Backcourt → Frontcourt** (cross half court line)
- **Frontcourt → Best Score Position** (take it all the way to the basket)

**Common Bugs to AVOID:**
- ❌ Stopping in backcourt (not entering frontcourt)
- ❌ Pulling up way behind 3-point line for no reason
- ❌ Getting stuck when horizontal progress is blocked

### Violation Avoidance - REQUIRED
**AI must actively avoid these violations:**

#### 10-Second Backcourt Violation
- **Rule:** Must advance ball to frontcourt within 10 seconds
- **AI Behavior:**
  - Track time in backcourt
  - **Urgency increases** as timer approaches 10 seconds
  - Don't get stuck trying to find perfect play - **just advance the ball**

#### Over-and-Back Violation
- **Rule:** Once in frontcourt, cannot pass or dribble back to backcourt
- **AI Behavior:**
  - **Before passing:** Check where teammate is located (frontcourt vs backcourt)
  - **Before moving:** Know which side of half court line you're on
  - Never pass to backcourt once you've crossed half court
  - Never retreat to backcourt with ball

#### 24-Second Shot Clock Violation
- **Rule:** Must attempt a shot within 24 seconds
- **AI Behavior:**
  - Track shot clock constantly
  - **As clock winds down:** Stop worrying about shot probabilities
  - **Under 3 seconds:** FORCE A SHOT (don't let it expire)
  - Better to take a bad shot than no shot

### Turbo Usage - Creating Separation
**CRITICAL: AI must understand how turbo works**

**Current version is WRONG:**
- ❌ AI spins in place while burning turbo
- ❌ Uses turbo without direction
- ❌ Wastes turbo with no purpose

**Correct Turbo Mechanics:**
**Turbo + Direction + Direction Changes = Separation**

**When to use Turbo:**
1. **Breaking free from defender**
   - Pick a direction
   - Use turbo to accelerate in that direction
   - Change direction quickly (diagonal cut, L-shape)
   - Separation created by speed + unpredictability

2. **Advancing ball quickly**
   - Clear path ahead
   - Use turbo to cover ground fast
   - Get to frontcourt / scoring position

3. **Driving to basket**
   - Have the ball
   - Path to basket available
   - Turbo for aggressive drive

**When NOT to use Turbo:**
- ❌ Standing still or spinning in place
- ❌ No clear direction in mind
- ❌ Already have separation
- ❌ Turbo meter empty (obviously)

**Turbo Decision Flow:**
1. **Am I stuck/guarded closely?** → YES → Use turbo with direction change to break free
2. **Do I have clear path to advance?** → YES → Use turbo to move quickly
3. **Am I driving to basket?** → YES → Use turbo for aggressive attack
4. **Otherwise** → Don't waste turbo

**Philosophy:** Turbo is for intentional movement with purpose, not random spinning.

---

### Fast-Paced Decision Making
**Game should be fast-paced with quick decisions**

**When horizontal progress toward frontcourt is blocked:**
1. **Ball Handler:** Don't stay stationary - make aggressive cuts
   - **Diagonal cuts** using turbo boost
   - **L-shaped cuts** using turbo boost
   - Goal: Break free from defenders
   - Direction + Turbo + Direction change = Separation
2. **Off-ball Player:** Get open downcourt immediately
   - Give ball handler a passing option
   - Move to open space in frontcourt
   - Can use turbo to get open faster

**Philosophy:** Quick decisions when stuck - don't let defense lock you down

---

### Pass Decision Logic
**AI must have a REASON to pass - never pass randomly or backwards without purpose**

#### Valid Reasons to Pass:
1. **Advance the ball for better shot probability**
   - Teammate has better shot opportunity than I do
   - Teammate is in better scoring position
   - Teammate's calculated shot probability > mine
   - **Special: Catch-and-Shoot pass**
     - Passer sees teammate is open with good shot
     - Pass includes "intent" or "instruction" to receiver
     - Receiver immediately shoots upon catching (no hesitation)
     - Useful for quick offensive execution

2. **Get out of a jam**
   - Trapped by defenders
   - About to lose ball
   - Need to escape pressure
   - Horizontal progress blocked

3. **Inbounds the ball**
   - After made basket, violation, or out of bounds
   - Required by game rules

#### Passing Restrictions:
- **NEVER pass backwards without reason**
  - Don't pass away from opponent's basket unless:
    - Getting out of trap/jam
    - Avoiding over-and-back violation
    - Resetting for better play
- **Check teammate position before passing**
  - Is teammate in frontcourt or backcourt? (avoid over-and-back)
  - Is teammate's shot probability better?
  - Is teammate open or guarded?

**Philosophy:** Every pass should advance your offensive objective or solve a problem. No aimless passing.

---

### AI-to-AI Communication - Pass Intent System
**Concept:** Passer can communicate intent/instruction to receiver

**How it works:**
1. **Passer evaluates situation:**
   - "My teammate is open"
   - "Teammate has good shot probability from that position"
   - "If I pass now, teammate should shoot immediately"

2. **Pass includes metadata/intent:**
   - Could be a flag on the pass: `passIntent: "CATCH_AND_SHOOT"`
   - Or: `passIntent: "ADVANCE_BALL"`
   - Or: `passIntent: "ESCAPE_JAM"`

3. **Receiver reads intent on catch:**
   - If intent = `CATCH_AND_SHOOT`: Immediately shoot (skip normal decision tree)
   - If intent = `ADVANCE_BALL`: Continue toward basket
   - If intent = `ESCAPE_JAM`: Make decision based on new position

**Benefits:**
- Faster offensive execution
- Coordinated team play
- Passer's reasoning becomes receiver's action
- More realistic basketball flow
- **Avoids decision loops** - receiver doesn't re-evaluate what passer already decided

**Implementation consideration:**
- Pass function could accept optional `intent` parameter
- Receiver AI checks for intent flag when gaining possession
- Intent overrides or influences normal decision tree

### Player Attributes That Drive Decisions
From rosters.ini, each player has:
- **speed**: Movement velocity
- **3point**: Three-point shooting ability
- **dunk**: Dunking/close-range finishing ability
- **power**: Strength (for physical play)
- **steal**: Stealing ability (defense)
- **block**: Shot blocking ability (defense)
- **position**: guard/forward/center (influences natural tendencies)

### Offensive Archetypes & Decision Making

#### ARCHETYPE 1: Fast Dunker (High speed + High dunk)
**Mindset:** "I want to attack the rim"
- When gets open AND finds clear path to basket:
  - **Action:** Drive hard to rim (fewer decisions along the way)
  - Uses speed + dunk attributes
  - Commits to the drive, doesn't hesitate
- If path is blocked:
  - Look to pass or kick out

#### ARCHETYPE 2: Perimeter Shooter (High 3point + Low speed/dunk)
**Mindset:** "I want to get open on the perimeter for a shot"
- Primary goal: Find open spot on perimeter (3-point range)
- When guarded closely:
  - **Action:** Look for teammate cutting to basket
  - Pass to cutter if available
- When open:
  - Take the three-point shot

#### ARCHETYPE 3: Point Guard / Facilitator (Medium on shooting/dunking)
**Mindset:** "Calculate probabilities, make smart plays for team"
- Not excellent at shooting OR dunking
- Functions as facilitator/decision-maker
- **Action:** Constantly evaluating:
  - Teammate's shot probability vs. my shot probability
  - Makes more frequent decisions (doesn't commit to single action)
  - Distributes ball to best scorer

### Universal Offensive Rules (Apply to ALL archetypes)

#### Teammate Stuck Rule
**If I see my teammate hasn't moved for 3 seconds:**
- **Action:** Make a cut to get open
- Purpose: Create movement, give stuck teammate a passing option
- Applies regardless of my archetype

---

### Shot Decision Algorithm
**AI should NOT be hesitant to shoot**

**Shot Probability Threshold:**
- Use a constant (adjustable for game balancing) - **suggested: 40%**
- This threshold determines shooting vs. passing decisions

**Decision Flow:**
1. **Calculate my shot probability**
2. **If my shot probability > 40%:**
   - ✅ **SHOOT IT** (don't hesitate)
3. **Else if my shot probability ≤ 40%:**
   - Calculate teammate's shot probability
   - **If teammate shot probability > 40%:**
     - ✅ **PASS to teammate**
   - **Else (both ≤ 40%):**
     - ✅ **Try to get closer to basket** (improve shot probability)
     - **EXCEPTION:** If shot clock is winding down → **SHOOT anyway** (don't let shot clock expire)

**Key Constants for Tuning:**
```javascript
// Top of file - for game balancing
const SHOT_PROBABILITY_THRESHOLD = 40; // Percent - adjust for difficulty
const SHOT_CLOCK_URGENT = 3; // Seconds - when to force a shot
```

**Philosophy:** Aggressive offense - if you have a decent shot (>40%), take it. Don't overthink.

---

### Probability vs. Outcome - RNG Timing
**IMPORTANT: Separate calculation from execution**

**At Decision Time (when AI decides to shoot/pass/etc):**
- Calculate **probability** based on:
  - Distance to basket
  - Defender proximity
  - Player attributes (3point, dunk, etc.)
  - Game situation
- Use probability to **decide what action to take**
- Example: "I have a 65% shot probability, that's > 40%, so I'll shoot"

**At Action Time (when shot/pass/steal actually happens):**
- Apply **random number generation** to determine **outcome**
- Roll against the calculated probability
- Example: "Shot probability was 65%, roll random... result: made/missed"

**Why This Matters:**
- AI makes **smart decisions** based on calculated odds
- But **outcomes are still variable** (not deterministic)
- Prevents AI from "knowing the future"
- Creates realistic variance in execution

**Example Flow:**
1. AI calculates: "My shot is 65% likely to go in"
2. AI decides: "65% > 40%, I should shoot"
3. AI executes: Shoots the ball
4. **At moment of shot:** RNG rolls 0-100, if ≤ 65 → made, else → miss
5. Same 65% shot might make or miss on different possessions

---

### Shot Probability Calculation - ALGORITHMIC DETAIL

**Formula Components:**
1. **Base probability from distance** (closer = better)
   - Distance to basket is primary factor
   - Layups/dunks (very close): High base probability
   - Mid-range: Medium base probability
   - 3-point range: Lower base probability
   - Way beyond arc: Very low base probability

2. **Penalty for defender proximity** (how close is "guarded")
   - Measure distance from shooter to nearest defender
   - Closer defender = larger penalty to probability
   - **Defender can have levels of guarding:**
     - Wide open (defender far away): No penalty
     - Lightly guarded (defender at medium distance): Small penalty
     - Contested (defender close): Medium penalty
     - Heavily contested (defender right on top): Large penalty
   - This is a gradient, not binary states

3. **Multiplier from player attributes**
   - Use player's shooting attributes:
     - **3point attribute** (for shots beyond arc)
     - **dunk attribute** (for close-range/dunks)
   - Higher attribute = probability multiplier increases
   - Lower attribute = probability multiplier decreases

**Combined Formula:**
```
Shot Probability = Base(distance) × AttributeMultiplier(skill) - DefenderPenalty(proximity)
```

**Important Design Notes:**
- **"Open" vs "Guarded" is NOT binary** - it's a continuous scale
- Defender proximity modifies the probability (doesn't change behavior)
- All three factors combine to give final probability
- This probability is used for decision-making (shoot if > 40%)
- Actual outcome determined by RNG at action time

---

### Clear Path to Basket - Drive Logic
**For Fast Dunker archetype and aggressive drives:**

**Philosophy:** Not human calculators - if they have room to run, they take it until they hit something

**Drive Decision:**
1. **Am I at far end of court from basket?**
   - YES → Try to blow by defenders
   - Use speed + turbo to attack

2. **Do I have some room to run?**
   - YES → Take it (drive toward basket)
   - Keep driving until you run into something

3. **Did I run into a defender?**
   - YES → Pass it (don't force through traffic)
   - Look for open teammate

**Key Point:** Don't pre-calculate entire path - just start driving and react when you encounter obstacles. More realistic basketball instinct.

---

### Off-Ball Movement - Getting Open
**Players without the ball should ALWAYS be moving when they're not in position to do anything**

**When to move off-ball:**
- **Defender right on top of me** between me and basket
- **Bunched up with ball handler** (spacing issue)
- **Standing still for too long** (3+ seconds)
- **Not in good position** to receive pass or help

**Types of off-ball movement:**
1. **Slash and cut into the paint**
   - Attack basket area
   - Look for pass from teammate

2. **Rotate along the perimeter**
   - Maintain spacing
   - Find open spots on outside

3. **Move away from ball handler**
   - Don't bunch up on same spot
   - Creates passing lanes and space

**Critical Rule: Teammate Collision**
- **Players on same team should pass through each other** (no collision)
- Only opponents have collision behavior
- Prevents teammates getting stuck on each other
- Allows natural basketball movement/spacing

---

### Rebounding Logic
**Players should try for rebounds if close to the basket**

**Rebound Attempt Criteria:**
1. **Proximity to basket** - primary factor
   - Close to basket → high chance to get rebound
   - Far from basket → low chance

2. **Angle to basket** - secondary factor
   - Good angle → better positioning
   - Poor angle → harder to get rebound

3. **Rebound skill composite** (minor boost)
   - Formula suggestion: `power + block + dunk` attributes
   - Not the final formula - needs tuning
   - Positioning is more important than attributes
   - This just provides small advantage to stronger/taller players

**Philosophy:** Positioning matters most, attributes provide minor edge

---

### Pace of Play - "Fast" Basketball
**AI should always play fast - recognize scoring opportunities quickly**

**Fast Play Principles:**
1. **Recognize quick scoring opportunities:**
   - Teammate wide open downcourt → pass immediately
   - Fast break situation after steal/rebound → push ball
   - Clear path to basket → attack quickly

2. **Don't force unrealistic speed:**
   - Normal inbounds plays don't need full sprint
   - Not every possession is transition
   - Realistic pace varies by situation

3. **Let logic drive behavior:**
   - Hopefully the shot probability + turbo + pass intent logic naturally creates fast play
   - Don't need separate "fast break mode" if the decision tree already recognizes opportunities
   - Parameters and thresholds should bring out right pace

**Goal:** Fast-paced game emerges from good decision-making, not forced sprinting

---

## DEFENSE Decision Tree

### Defensive Concepts and Modes
**Basketball defensive strategies to implement:**

---

## Man-to-Man Defense (DEFAULT MODE)
**If defender plays good defense, other modes shouldn't be needed**

### Initial Assignment
- **Each defender picks one offensive player to guard**
- Assignment method: **Guard the closest offensive player**
- One defender guards one offensive player
- Other defender guards the other offensive player
- Assignment persists until switch condition met

### Core Man-to-Man Behavior
**Goal: Stand in front of my man, between them and the basket**

**Positioning:**
1. **Identify my man's position**
2. **Position myself between my man and the basket**
   - Stay in front of them
   - Block driving lanes
   - Contest shots

**Movement and Reaction:**
- **When my man moves up/down court:**
  - React on delay based on **speed + steal attributes**
  - Higher speed/steal → faster reaction
  - Lower speed/steal → slower reaction (human has advantage)
- **Move to stay in front of my man**
  - Block them from driving to basket
  - Maintain defensive positioning

### Defensive Positioning Intelligence
**Don't do stupid stuff**

**BAD Defensive Behavior:**
- ❌ Tight guarding at half court (players won't shoot from there anyway)
- ❌ Overcommitting to players far from basket
- ❌ Wasting energy on low-threat positions

**GOOD Defensive Behavior:**
- ✅ Give space when my man is at half court or backcourt
- ✅ Tighten up defense as they approach scoring range
- ✅ Prioritize defending when they're a legitimate threat

**Defensive Perimeter Limits:**
- **Don't come out farther than a little past the 3-point line**
- At the perimeter, check opponent's **3point attribute** (trait lookup, not probability calc):
  - If opponent has HIGH 3point skill → Guard tighter at 3-point line
  - If opponent has LOW 3point skill → Can give more space at perimeter
- This is a simple trait check, not a calculation

**Philosophy:**
- **Defenders DON'T calculate shot probabilities**
- Defenders just do their job: guard their man
- Focus defensive intensity based on:
  1. Court position (closer to basket = tighter)
  2. Opponent's shooting attributes (3point shooters get more attention at perimeter)
- If players make half court shots repeatedly, we'll balance the odds (not defensive behavior)
- Simple rules create realistic defensive behavior

### Recovery When Beat
**If my man gets by me:**
1. **PRIORITY: Recover position immediately**
2. **Goal: Get back between my man and the basket**
3. **Use speed to chase down**
4. **USE TURBO to recover** (essential - can't move slow when beaten)
5. **Don't give up - keep pursuing**

**Philosophy:** If beaten, sprint with turbo to recover. Don't let them have free path to basket. Turbo is critical for gaining back lost ground.

---

### Defensive Actions - Steal, Shove, Block
**Defenders should actively attempt these actions based on their attributes**

#### STEAL
- **When to attempt:**
  - Guarding ball handler closely
  - Ball handler is dribbling/moving
  - Opportunity to poke ball away
- **Aggressiveness based on steal attribute:**
  - High steal → attempt steals frequently (not afraid)
  - Low steal → attempt steals rarely (more cautious)
- **Outcome:** RNG at action time based on steal attribute

#### SHOVE (Uppercase 'S' on defense)
- **When to attempt:**
  - Ball handler driving toward basket
  - Need to disrupt offensive player's movement
  - Create physical pressure
- **Aggressiveness based on power attribute:**
  - High power → shove frequently (not afraid of contact)
  - Low power → shove less often (less physical)
- **Outcome:** Push offensive player, potential turnover, maybe foul

#### BLOCK
- **When to attempt:**
  - Offensive player shooting
  - Close enough to contest shot
  - Can jump to block trajectory
- **Aggressiveness based on block attribute:**
  - High block → attempt blocks frequently (not afraid)
  - Low block → attempt blocks rarely (won't contest much)
- **Outcome:** RNG at action time based on block attribute

**Philosophy:**
- **Defenders are NOT afraid** to use these actions
- Frequency/aggressiveness determined by relevant attribute (steal, power, block)
- High attribute players use actions more often
- Outcomes determined by RNG at action time (like offense)

---

## Double Team (TRIGGERED MODE)
**When:** My man becomes closer in radius to my teammate (the other defender)

**Behavior:**
- **Both defenders focus on the same offensive player**
- Converge on that player
- Try to trap/pressure them
- Force turnover or bad pass

**Trigger Condition:**
- Offensive player gets close to both defenders
- Radius check: Is offensive player closer to my teammate than to me?

**Risk:** Other offensive player is now unguarded (2v1 defense)

---

## Switch (CONDITIONAL MODE)
**When:** One defensive player is within closer radius to the OTHER offensive player

**Condition for Switch:**
- I'm closer to the other offensive player than my assigned man
- AND my teammate has my original man guarded

**Behavior:**
- Swap defensive assignments
- I now guard the player I'm closer to
- Teammate guards the other player
- Prevents offensive player from getting open

**Philosophy:** Only switch when it makes sense - when assignments naturally swap due to positioning

---

### Mode Priority and Flow
1. **Default:** Man-to-Man (guard your assigned man)
2. **If offensive player close to both defenders:** Double Team
3. **If closer to other offensive player AND teammate has my man:** Switch (reassign)
4. **After switch:** Return to Man-to-Man with new assignment

---

## AI Decision Speed & Difficulty Philosophy

### Speed Attribute as Reaction Delay
**Concept:** Speed affects decision-making delay, not just movement
- **Low speed players:** Longer delay between decision and action
  - Gives human player time to react/recover
  - More predictable, easier to defend
- **High speed players:** Minimal delay between decision and action
  - Quick decisions, quick execution
  - Harder for human to react

**Example:**
- Slow player sees open lane → 0.5s delay → starts drive (human has time to recover position)
- Fast player sees open lane → 0.1s delay → starts drive (human caught off guard)

### Difficulty Philosophy
**"Make AI hard first, then make it easier"**
- Start with AI that can perfectly calculate probabilities and execute optimal plays
- AI should be a genuine challenge to beat
- Then dial it back/add handicaps if too difficult
- **NOT** the other way around (don't build weak AI and try to make it smarter)

**Goal:** Create a challenging opponent that forces the human to play well, then we can chip away at difficulty if needed.

**Implication for Design:**
- AI calculations should be accurate and optimal
- AI execution should be crisp (not sloppy)
- AI should make "smart" plays based on attributes
- Then we tune down reaction times, decision frequency, or success rates if too hard

