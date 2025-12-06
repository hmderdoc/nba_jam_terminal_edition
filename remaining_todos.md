## DIFFICULTY: Easy

### Visual Defects (rendered wrong)

#### LORB
- ~~When we enter the hub, the lightbar backgrounds are always correct, however if the team uses high ANSI for the foreground, it is being rendered in correctly.  For instance if the teams colors were YELLOW on BG_BLUE, the lightbars are incorrectly rendered as BROWN on BG_BLUE (no color code to toggle to high bit)~~ **FIXED** - Changed YELLOW mapping in cities.js getFgAttrFromName from 6 to 14 (HIGH | BROWN)
- ~~(nitpick) on hub view, there is no horizontal padding/margin between the graphic and where text starts.  If we had a margin of 1 or 2 there it would look better.  Also the [Arrows] Select [ENTER] Confirm prompt is very dull and static with no color distinction to make it pop.  If we could use 3 colors for brackets, Key value and label I think it would look much better.~~ **FIXED** - Added 2-char margin by shifting content zone to x=43, styled prompt with dark brackets, bright keys, dim labels  
- ~~In the Hit the Courts View, we have black on black text: "Difficulty:" "NBA Chance:" are not visible.~~ **FIXED** - Added \1w color prefix to labels
- ~~In the Club23 view, we have quite a few rows of vertical space between the users cash amount and the lightbar menu + hover tips.  We could move the light bar menu up 3 or 4 rows and I think the view would look a lot better and less squeezed.~~ **FIXED** - Moved menu from y=8 to y=4, adjusted info panel from y=14 to y=11
- ~~In the bet view inside Club 23, we may want to put a line between the team names, as I'm seeing wrapping currently for "New Orleans Pelicans vs San Antonio Spurs"  Also, the "vs" text as part of that is Black on black.  would be good if it were "DARKGRAY" i.e. lightblack '\1h\1k`~~ **FIXED** - Changed "vs" to \1h\1k (dark gray)
- ~~in club 23 when they visit the restroom and it gives the user a prompt to type, the users text they enter is black on black in the prompt while they type~~ **FIXED** - Set input color to cyan before getstr
- ~~in our gym view, the labels for our attribute bars are black on black unless they are selected by the light bar, at which they are visible, so "Speed", "3-Point", "Power", etc. are black on black text.~~ **FIXED** - Added \1w color prefix to stat names
- ~~in the gear shop next to the sneakers I own, the name of the sneaker "Cloudwalkers" is invisible.  I can see the cyan "[OWNED]" text thought~~ **FIXED** - Added \1w color prefix to sneaker names
- ~~in the crib,in the contact view table, I can't see any information (black on black) except the green "SIGNED" text in a row that isn't selected by the lightbar.  However the row contains this whole text:"   Sonic              | SIGNED   | --"~~ **FIXED** - Added \1w color prefix to contact names and cost strings
- ~~in the your crew view in the crib, the problem is sort of opposite of the above, if I have a player selected I can only see the "SPD:" label until I see "SIGNED" in green. All this content is black on black "10 3PT:5 PWR:2 STL:7 BLK:2 DNK:2 |"  If I move the lightbar off the row, everything is visible as I'd expect.~~ **FIXED** - Added \1c/\1w color codes to stat labels and values
- ~~in the lightbar menu in the crib, it says "Back to Rim City" since we've gotten rid of the "Rim City" concept it should probably say "Back to City you are in"~~ **FIXED** - Changed to "Back to Hub"
- ~~When we enter a game, I don't think we have all the items rendered properly, I think we sometimes omit some color for nametags, we just want to make sure we're injected the data we have.  HAving custom name tag colors makes it a lot easier to find your player in the game.~~ **FIXED** - Added nametag color passthrough: courts.js ctxToPlayer() for Hit the Courts, lorb_match.js for multiplayer, challenges_simple.js for presence/challenge data, player-labels.js for rendering  
#### NBA JAM ARCADE ENGINE

#### MULTIPLAYER ENGINE

### Visual Improvements
- ~~Main game entry point could be simplified to 3 items, "RPG" (LORB), "Arcade" (NBA Jam exhibition matche, would need a new submenu for Single Player, multiplayer, CPU demo, back / quit), this functionality is really for the "ENTER" key button masher so they wind up in LORB as quickly as possible since it'd be the first option.  I must admit, I am an "ENTER" key button masher myself.~~ **FIXED** - Simplified mainMenu() to 3 items: RPG Mode (first, responds to ENTER), Arcade Mode (submenu with SP/MP/Demo/Back), Quit

#### LORB
- ~~When entering the game, we should treat daily news / recent pvp action as its own view after we present a key to enter.  There is too much on that initial view, the news should get its own view.~~ **FIXED** - Split welcome screen in lorb.js: greeting/stats shown first, then news in separate "DAILY NEWS" view with spacing and up to 5 items
- ~~when we leave the game, we should provide an overview of what the user accomplised today and if they have remaining turns.  If they're out of street turns, we can say "See you tomorrow in {nextCityName}" otherwise we'll say something like "See you soon in {currentCityName}" I'm not married to verbiage, it's just a small example for context awareness.~~ **FIXED** - Enhanced endDay() in hub.js: shows session summary (games, wins/losses, cash, rep), remaining resources, context-aware farewell ("See you soon in X" vs "See you tomorrow in Y")
#### NBA JAM ARCADE ENGINE

#### MULTIPLAYER ENGINE

## DIFFICULTY: Medium

### feature augmentation

#### LORB
- Ghost challenges against other players, currently use a very fake fast simulation, as far as I know it's a coin flip.  I think our ghost challenges should allow for gameplay either via the player controlling their own team versus the challengee's player controlled by AI opponents, or doing a simulation, however the simulation should run in our NBA jam engine, like a CPU demo or a bet.  Also, with regards to these AI ghost challenges and some long term feature development, this is sort of where I want to tie in the boosts that we get from in game relationships and possibly having a spouse.  The spouse would presumably boost the in game AI somehow, and perhaps the spouse could get boosted.

### architectue updates.

### view enhancement
- supporting new PVP stats, when we: a) view player cards either via Tourneys page or Crib Stats and statistics we should have the ability to press a button to toggle showing PvP stats or normal stats.   Also, we should have another table view so we can see player PvP statistic leaderboards in our tourney view.
## DIFFICULTY: Hard

#### MULTIPLAYER ENGINE
- We need to just test and iterate on this a bit.  It's just a bit of a bear to test.  If we could get a better way to test besides just runtime and handling my keyboard inputs maybe we'd work faster, and potentially get ourselves to be able to play replays as a side benefit.  This will take a dedicated effort and should not be tackled casually amongst other changes, it should have its own branch when we tackle it.
### Architecture Changes


## DIFFICULTY : UNDETERMINED

#### LORB
- Live challenge flow and non-static betting.  Player A challenges Player B and at the same time says: "here is what I am willing to maxmimually bet and the terms. $50, 10 rep and using what odds.  Player B sees the challenge, and it should not only show what the player is betting, but also the player who is challenging them's stats so they can make an informed decision.  However Player B can also make a counter offer, it can either be higher or lower than Player A's initial offer, but not higher than the rep or money Player A or Player B have (the lower of the two values - can't bet what you don't have or the person betting doesn't have).  At this point Person A, either accepts the challenge, or maybe is given one more chance at a counter offer given that the last offer gets them to see what Player B wants to risk.  So maybe Player B gets a counter offer, but if they reject it the cancel is challenged.  At any point a player should be able to reject and get out of the multiplayer flow with all cancelled challenges. 
- What unfinished business do we have?  What about our per city boosts?  Do those actually get passed to our game engine?  Same things with drink and shoe boosts, did we knock out all the components of that.
- What really happens at the end game? We can now do multiplayer matches in game, we talked about doing something about like how online chess matches work, having a time when they happen and forfeit structure if there's a no show, or maybe a simulation fallback if both don't show.  Right now the end game is very abstract to me as I'm in the thick of things but it certainly seems like we need to consider it again, right now I think it just simulates the whole playoffs, but as we get closer to completing other tasks we need to figure this out.
- Encounter different NBA players in different NBA cities.  Instead of encountering a random player in any city, make it so players can only be encounted in certain cities, like Pokemon can be caught in certain areas.  We can assume they will be in the city for their team in our rosters.ini, we may want to make another option flag in our rosters.ini per player for additional_appearance_cities for players associated with more than one city.
#### NBA JAM ARCADE ENGINE
- Update sprite orientations to support diagonal movement, we've added diagonal movenet, and our sprites have orientations for SE, NE, NW, SW, but they are not being triggered by our numerical diagonal movements for some reason, so the sprite faces weird directions when using diagonal movements.
#### MULTIPLAYER ENGINE
- Update sprite orientations to support diagonal movement, we've added diagonal movenet, and our sprites have orientations for SE, NE, NW, SW, but they are not being triggered by our numerical diagonal movements for some reason, so the sprite faces weird directions when using diagonal movements.
- I have noticed on occasion certain keys being interpreted as blocks / jumps when they are steals, shoves on one of the players, presumably non-coordinator screen.  basically i press the steal button with these characters, and I see them jump. 