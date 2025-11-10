## Trail animations
- pass and shot animations have virtually no trails.  i'm not sure if trails for pushes are currently showing either.  A lot of this just probably related to our non-blocking changes, and maybe defining what we want, but trails are definitely less in this version.  I actually don't think I've seen a rebound trail in forever either.  animation wise this is the biggest gap we have.

- would it make sense to use a different frame layer for each type of trail?  so if we had a shot trail we needed to clear, we could do shotTrailFrame.clear() and have like a reboundTrailFrame to take the next set of trails.  I'm not sure if that would make things easier.  passTrailFrame blockTrailFrame shoveTrailFrame blockTrailFrame jumpTrailFrame dunkTrailFrame, maybe it makes sense, maybe it just adds complexity to something we just need to adjust for a non-blocking methods.  if we need some guidance on how trails were rendered before, we have the original monolith backed up somewhere we can refer to.  I don't want to overcomplicate things though.  i guess each of those frames / trail type with the exception of shoving and jumping should/could only have one trail active at a time so maybe it helps.  or maybe we just need to toggle alter something that was working with our previous trails when they were blocking.

## Use inbounds method after penalties, don't just give the ball to team whereever they are standing

- this will help clear up what's happening in the game a bunch.  penalties and violations don't trigger an inbounds process, they should so teams can reset.

## Rebounding improvments / Changes?  (Architectural)
- can we keep the ball bouncing until someone picks up now that our animations are non-blocking.  currently ball stops bouncing and a player will reach it, but would look and feel better if ball kept bouncing.

## multiplayer sync across halftime / gameover
- currently only coordinator goes to halftime view in multiplayer, when they hit spacebar gameplay resumes on non-coordinator view.  halftime and game over screens should show at the same time for both players, there should be no state where the game is over and the players are still on the court vs showing the box score.  

