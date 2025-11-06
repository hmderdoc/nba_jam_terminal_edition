# Shove / Shake purpose and logic

## Shove description

the general purpose of the shove depends on whether the player is on offense or defense, and whether they have the ball.  If they have the ball, the word "shake" is interchangeable with "shove", and they can only perform the maneuver if they do not have a live dribble.

## Shove purpose

### Offense
on offense, the purpose of the shove is to get yourself or your teammate open.  when you shove, the defense must act accordingly and decisions open up that weren't available pre-shove.  for instance if you are the ball-handler and you pick up your dribble and shake/shove an opponent away, that defender, until they recover will no longer negatively effect shot chances or be able to intercept passes.  shot probabilities should increase.  the defender who was guarding the off-ball player should re-prioritize to guard the man who has shoved his defender into oblivion, and a new passing lane should also open up as the other non-ballhander teammate is available for a pass.  shot chances and pass probabilities all increase after the ball-handler executes a shake/shove and the defense is penalized and has to adjust.  

If the player being controlled does not have the ball, they should look to use their shove either to knock the opponent guarding their passing lane down, or they can opt to help their teammate by shoving the defensive player guarding the ball-handler so they can drive, shoot or kick to the non-ballhandler.  When the offensive player knocks down the player guarding the ball, the other defensive player should come by to help guard the ball as a hard rule.  the other offensive player should spread out as to create a passing lane with the moved defenders.

### Defense

On defense a shove is generally less effective than a steal because it should require a bit of collision detection between offensive and defensive sprites, maybe not the exact same collision detection used for movement (as that's quite small) but maybe increased to be a 3x4 hitbox for executing a shove.  However, shoves cause injury (which will have a downside effect we'll add later) and are also the only way to retrieve the ball when a defender has picked it up.  

A big part of the defensive aspect of the shove AI is knowing how to react when the offense uses it.  Rotations, etc, that should open the game back up.

### Rebounding

During a rebound a player may evaluate whether their team mate has a better chance of a rebound than them, and whether there is a closer player to shove than where the rebound will land, they'll make an effort to get close to that player and shove them to take them out of the rebound equation, which may wind up helping their teammate secure the rebound.  

## Shove Mechanics Details

### Success Factors
- **Base Success Rate**: 30%
- **Skill Modifier**: +0-15% based on attacker's power skill vs victim's power
- **Directional Bonus**: +10% when shoving from behind/side (harder to counter)
- **Failure Penalty** : 10 frames unable to move

### Cooldowns & Limitations
- **Attacker cooldown**: 20-35 frames after attempt (success or fail)
- **Victim recovery**: 35 frames of knockback/stun
- **Ball-handler shake**: Limited to once per possession OR requires 2+ seconds of dead dribble

### AI Decision Weights
**Offensive priorities:**
1. If ball-handler surrounded → shake nearest defender (80% priority)
2. If teammate has ball and struggling → shove their defender (60% priority)
3. If open for pass but defender blocking → shove defender (50% priority)
4. If rebounding and teammate closer to ball → shove nearest opponent (40% priority)

**Defensive priorities:**
1. If opponent has dead dribble near basket → shove to prevent shot (90% priority)
2. If opponent cutting to basket → shove to disrupt (70% priority)
3. If rebounding and opponent closer → shove to box out (60% priority)
4. Never shove if help defender is >8 units away (no rotation available)

### Rotation Rules
- When defender is shoved, help defender must rotate **if within 8 units**
- Help defender evaluates: closest to ball > closest to open man > closest to shover
- Offense should exploit by having non-shover cut opposite direction
- If both defenders shoved, AI switches to zone defense temporarily