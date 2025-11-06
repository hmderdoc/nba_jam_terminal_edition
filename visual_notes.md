- games pauses when shot is in air, can we make it so the ball is still live and players can still move while shot is active or why not?  would be good if defenders could block those shots potentially.

- rebound clusterfuck: 4 rebounders stack and drain turbo on top of each other.  at the very least we should try to limit this battle to 1 player per team while the other player does something else useful, such as get open, or maybe hedge against the fast break.

- alternate jersey colors: when both teams have the same jersey background color, one of them should use an alternate jersey color set which we will specify with new parameters in our rosters.ini file  if you want to prepopulate our rosters.ini file with these parameters feel free and I will tweak as I see fit.

- dynamic light gray jersey: we can build a dynamic light gray jersey if need be for most teams by using a light gray background and the teams main background color used as a foreground color for jersey #'s

- try to optimize jerseys so that they don't conflict with the other team, but also blend into player skin tones.  we can swap player-magenta and player-lightgray palettes if need be for a team (I'm using lightgray skin tones for lighter skin players who are on teams with magenta backgrounds is why they exist in the first place for instance)

- can we also have fallback deduplication logic so that team labels for the scoreboard and nametag are unique per team and match up with the uniform they picked?   maybe we also need adaptive baseline graphics so everything feels consistently themed.  if we need more params feel free to prepopulate rosters.ini and i can tweak as needed.

- (Character override) color overides:
set player eye color in rosters.ini

- (Character override) eyebrow character:
place a character between the players eyes, can have a custom foreground color and one character.

- custom sprite:
use a custom sprite that will not be transformed by the masking, including jersey colors and numbers

- On fire name stylization should also be reflected in the on court player's name tag doing the "fire" animation as well.

- When the player is one fire, we should use something besides GRAY for the shot trail and dunk jump trail.  We should use fire like colors: RED, LIGHTRED, YELLOW, WHITE

- when we put players short nicks into the nametag / label frame above their sprite, we should use frame.center instead of frame.putmsg();  I'm not sure if there's a quick way to make it so when the ball handlers nametag is highlighted with a new background color, if we can restrict the background colors to just the letters of the nickname.  For instance if the nickname is "MJ" and the highlighted background is red with a black foreground, I want to see "MJ" centered, with only "MJ" having a red background, and the other positions in the frame should have a BG_BLACK property.

- we need to look at how turbo works relative to the cpu and the player. player turbo can't pulse like cpu turbo and zips down the screen.  needs to be sort of a limit or a pulse mode perhaps to gate what's happening to a manageable level especially with multiplayer.  

- do we have an overtime mechanic?  overtime should be 1/4 the time as the game.  games should not end in a tie.  can have double, triple overtime, etc.

- dribbling animation when the ball carrier faces down is too far down on the y-axis, looks disconnected from player.  maybe we should just limit the animation to left and right since that is where players hands will be.

- rebound positioning and freezing for shot attempts.  we have a very awkward rebound and shot attempt pattern.  the player shoots, and no movement happens with the other players (movement is paused during shots, even though we want to enable it).  rebounders should be picking positions while the shot is in the air and move there.  as it is, there is sort of a teleport once the shot hits the rim sometimes and bounces back.  