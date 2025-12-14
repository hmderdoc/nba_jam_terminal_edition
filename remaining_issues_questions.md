## Multiple playoffs at the same time
we need a way to move between playoffs for different seasons.  Right now I am in Season 6 and Season 7 playoffs, but I am blocked from seeing season 7 until I'm eliminated from season 7 (or it resolves)

## Playoffs - both players miss scheduled match but within time frame, what happens?  Outside of time frame (EXPIRED) what happens?  
We don't seem to notify the user they or the other person missed a match and we don't seem to try to reschedule, maybe a live PvP match could be triggered if both were online but that is a last resort, really hard to coordinate if our system doesn't help.  it seems like the first person to login should be able to "Reschedule the match" and should be able to look at the other player's availability and set a time.  We have to make sure it's reasonable though or else nerf its authority to create favorable conditions for the user who is scheduling - for instance if the other User misses a match and the Scheduler tries to schedule one for 10 minutes into the future that isn't a reasonable enough notice period that there shouldn't be any punitive measures for the "no show" because there was no due process.    

## Live match availability as a concept in the Crib menu, not just playoffs
we should probably just have this as "my schedule" in the crib, ideally we pre-populate with some values but really we don't want people to have to set these values at the time playoffs start, but ahead of time so once playoffs start matches are scheduled.

## Red Bull Challenge ✓ IMPLEMENTED
Challenge flow is now accessible from:
- **Playoffs menu** - Shows "Challenge the Red Bull (S#)" for any season where you're champion
- **Crib menu** - "Champion's Challenge" option (with DEBUG_ENABLE_BOSS_TEST flag)

The flow includes:
- Rich intro screens with figlet headers (CHALLENGER!, VS AIRNESS, etc.)
- Jordan + Pippen warm-up match
- Victory/defeat transition screens
- Satan + Iceman final boss with full buffs (permanent fire, enhanced stats)
- LEGENDARY! victory screen

Schema tracks in bracket.challengeState: `{ triesUsed, jordanDefeated, redBullDefeated, victories[] }`
getPlayerChampionships() returns completed brackets where player won and has unclaimed challenges.

## End game benefits to beating Red Bull
Can unlock either devil or ice man skin, player picks.  We want to introduce the concept of a player being able to use custom sprites, not just the same basic ones that get masked, but ones like devil, iceman, sonic, barney, etc.  Basically our end of season rollover for now doesn't have any sort of punitive / reset effect for other players for now, just some cool unlocks for the winner.

## Playoffs seeding, who is eligible
If a player hasn't played during the season, they are ineligible for the playoffs.  We might want to come up with some formula to calculate standings that allows better weighting than a raw W-L score or Rep because those things could come from playing more than others.  We'd probably want something that takes into account winning percentage, rep and games played and normalizes it somehow.

## Ballerdex tracking
Our ballerdex being similar to the Pokedex, it might be good to have an overall count of Ballers available.  We have a pretty roundabout way of tracking this currently, .bin files mapping to our rosters.ini which makes the number hard to count without checking a directory and then checking it against rosters.ini ... it may make sense to start adding more metadata in rosters.ini so we're not calculating or inventing on the spot (thinking things like player salary as an example, we're not explicit about that)

## Augmenting relationship system / streetballers
Can get relationship pregnant, get a baby a streetballer to add to players to be met on street.  Add a nursery to crib to level up children.  Children can earn rep and money for their parents and be assigned a court.
