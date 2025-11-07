/**
 * AI: Offense with Ball (Ball Handler)
 * 
 * Controls AI decision-making for the player with possession
 * Priority cascade:
 * 0. Exploit shove opportunities (defender knocked back)
 * 1. Finish plays when close to basket (even without turbo)
 * 2. Advance from backcourt
 * 3. Quick perimeter threes (specialists)
 * 4. Drive to basket when lane is open
 * 5. Take open shots
 * 6. Pass when help collapses
 * 7. Force shot on shot clock expiration
 * 8. Handle dead dribble situations
 * 9. Default: probe for openings
 */

load("sbbsdefs.js");

/**
 * AI logic for player with ball
 * @param {Object} player - Sprite with playerData
 * @param {string} teamName - "teamA" or "teamB"
 * @param {GameContext} context - Dependency injection context
 */
function aiOffenseBall(player, teamName, context) {
    var playerData = player.playerData;
    if (!playerData) return;

    var basket = getOffensiveBasket(teamName);
    var spots = getTeamSpots(teamName);
    var attackDirection = teamName === "teamA" ? 1 : -1;
    var inBackcourt = isInBackcourt(player, teamName);
    var defenderDist = getClosestDefenderDistance(player, teamName);
    var distToBasket = distanceBetweenPoints(player.x, player.y, basket.x, basket.y);
    var rawThreePointSkill = getBaseAttribute(playerData, ATTR_3PT);
    var rawDunkSkill = getBaseAttribute(playerData, ATTR_DUNK);
    var threePointSkill = getEffectiveAttribute(playerData, ATTR_3PT);
    var dunkSkill = getEffectiveAttribute(playerData, ATTR_DUNK);
    var skillEdge = threePointSkill - dunkSkill;
    var isThreeSpecialist = (rawThreePointSkill >= 7 && rawDunkSkill <= 5);
    var now = getTimeMs();
    var timeSinceTurbo = playerData.lastTurboUseTime ? (now - playerData.lastTurboUseTime) : Number.POSITIVE_INFINITY;
    var closestDefender = getClosestPlayer(player.x, player.y, teamName === "teamA" ? "teamB" : "teamA");
    var hasDribble = playerData.hasDribble !== false;
    var dribbleDead = !hasDribble;
    var deadElapsed = dribbleDead ? Math.max(0, now - (context.getBallHandlerDeadSince() || now)) : 0;
    var closestDefenderDistToBasket = closestDefender ? getSpriteDistanceToBasket(closestDefender, teamName) : 999;
    var shotQuality = calculateShotQuality(player, teamName);
    var totalScoringAttr = rawThreePointSkill + rawDunkSkill;
    var threeBias = totalScoringAttr > 0 ? (rawThreePointSkill / totalScoringAttr) : 0.5;
    var driveBias = totalScoringAttr > 0 ? (rawDunkSkill / totalScoringAttr) : 0.5;
    var wantsPerimeter = Math.random() < (0.35 + threeBias * 0.55);
    var wantsDrive = Math.random() < (0.3 + driveBias * 0.6);

    // PRIORITY 0: EXPLOIT SHOVE - Defender is knocked back, take advantage immediately!
    if (closestDefender && closestDefender.playerData && closestDefender.playerData.shoveCooldown > 0) {
        var exploitWindow = closestDefender.playerData.shoveCooldown > 20; // Fresh shove

        if (exploitWindow) {
            if (dribbleDead) {
                playerData.aiLastAction = "exploit_shove_shoot";
                attemptShot();
                return;
            } else if (distToBasket <= 15 && rawDunkSkill >= 6) {
                playerData.aiLastAction = "exploit_shove_drive";
                playerData.turboActive = true;
                playerData.useTurbo(TURBO_DRAIN_RATE);
                steerToward(player, basket.x, basket.y, 5);
                if (distToBasket < 6) {
                    attemptShot();
                }
                return;
            } else if (rawThreePointSkill >= 6 && distToBasket >= 12) {
                playerData.aiLastAction = "exploit_shove_pullup";
                attemptShot();
                return;
            } else {
                playerData.aiLastAction = "exploit_shove_attack";
                var attackSpeed = playerData.turbo > 10 ? 4.5 : 3;
                if (playerData.turbo > 10) {
                    playerData.turboActive = true;
                    playerData.useTurbo(TURBO_DRAIN_RATE * 0.7);
                }
                steerToward(player, basket.x, basket.y, attackSpeed);
                return;
            }
        }
    }

    // PRIORITY 1: CLOSE TO BASKET BUT OUT OF TURBO -> FINISH THE PLAY!
    if (!inBackcourt && distToBasket <= 10 && playerData.turbo < 15) {
        var wideOpen = defenderDist > 6;
        var reasonablyOpen = defenderDist > 3.5;

        if (distToBasket < 6 && reasonablyOpen) {
            playerData.aiLastAction = "finish_no_turbo_close";
            attemptShot();
            return;
        }

        if (distToBasket <= 10 && wideOpen) {
            playerData.aiLastAction = "finish_no_turbo_open";
            attemptShot();
            return;
        }

        if (!dribbleDead && distToBasket < 8 && defenderDist > 2.5) {
            playerData.aiLastAction = "finish_drive_no_turbo";
            steerToward(player, basket.x, basket.y, 3);
            if (distToBasket < 5.5) {
                attemptShot();
            }
            return;
        }
    }

    // PRIORITY 2: BACKCOURT -> FRONTCOURT (GET OUT OF BACKCOURT ASAP)
    if (inBackcourt && !context.isFrontcourtEstablished()) {
        playerData.aiLastAction = "push_backcourt";
        var isStuck = context.isBallHandlerStuck(2);

        if (isStuck) {
            var teammate = getTeammate(player);
            if (teammate && teammate.playerData) {
                var teammateInFrontcourt = !isInBackcourt(teammate, teamName);
                var myDistToMid = Math.abs(player.x - COURT_MID_X);
                var teammateDistToMid = Math.abs(teammate.x - COURT_MID_X);

                if (teammateInFrontcourt || teammateDistToMid < myDistToMid) {
                    playerData.aiLastAction = "backcourt_pass_unstuck";
                    animatePass(player, teammate);
                    return;
                }
            }
        }

        var targetSpot = spots.frontcourt_entry;
        var speed = 3;

        if (isStuck) {
            var jukeSide = (Math.random() < 0.5) ? -4 : 4;
            targetSpot = {
                x: spots.frontcourt_entry.x,
                y: spots.frontcourt_entry.y + jukeSide
            };
        }

        if (!isStuck && playerData.turbo > 25 && defenderDist > 3) {
            playerData.turboActive = true;
            playerData.useTurbo(TURBO_DRAIN_RATE);
            speed = 5;
        }

        steerToward(player, targetSpot.x, targetSpot.y, speed);
        return;
    }

    // PRIORITY 2A: PERIMETER QUICK THREE (specialists)
    var isPerimeter = distToBasket >= 17 && distToBasket <= 22;
    if (!inBackcourt && isPerimeter && wantsPerimeter) {
        var earlyPossession = context.getBallHandlerAdvanceTimer() <= 1;
        var settledFeet = context.isBallHandlerStuck(1) && timeSinceTurbo > 350;
        var spacing = defenderDist >= (isThreeSpecialist ? 3 : 4.5);
        var clockComfort = context.getShotClock() > (SHOT_CLOCK_URGENT + (isThreeSpecialist ? 4 : 2));
        var qualityFloor = SHOT_PROBABILITY_THRESHOLD - (isThreeSpecialist ? 7 : 3);
        var quickThreeQuality = shotQuality;
        var isTransition = earlyPossession && timeSinceTurbo < 1200;

        if (isTransition) {
            quickThreeQuality -= isThreeSpecialist ? 4 : 12;
        }
        if (distToBasket > 20) {
            quickThreeQuality -= (distToBasket - 20) * 4;
        }

        var hasGreenLight = isThreeSpecialist || skillEdge >= 3 || (threePointSkill >= 7 && !isTransition);

        if (settledFeet && (clockComfort || (earlyPossession && !isTransition)) &&
            spacing && quickThreeQuality >= qualityFloor && hasGreenLight) {
            playerData.aiLastAction = (earlyPossession && isThreeSpecialist)
                ? "transition_three"
                : "quick_three";
            attemptShot();
            return;
        }
    }

    // PRIORITY 3: LANE OPEN + TURBO -> DRIVE
    var laneTurboThreshold = rawDunkSkill >= 7 ? 20 : 30;
    var hasEnoughTurbo = playerData.turbo > laneTurboThreshold;
    var alreadyClose = distToBasket < 12;

    if (!dribbleDead && wantsDrive && isLaneOpen(player, teamName) && (hasEnoughTurbo || alreadyClose) && defenderDist > 4) {
        playerData.aiLastAction = hasEnoughTurbo ? "drive_lane" : "drive_lane_no_turbo";
        var driveSpeed = 3;

        if (hasEnoughTurbo) {
            playerData.turboActive = true;
            playerData.useTurbo(TURBO_DRAIN_RATE);
            driveSpeed = 5;
        }

        steerToward(player, basket.x, basket.y, driveSpeed);

        if (distToBasket < 6) {
            attemptShot();
        }
        return;
    }

    // High flyer attack rim logic
    var highFlyer = rawDunkSkill >= 8;
    if (!dribbleDead && highFlyer && distToBasket <= 12 && defenderDist <= 6) {
        if (distToBasket > 6.2) {
            playerData.aiLastAction = "attack_rim";
            var gatherTarget = basket.x - attackDirection * 5;
            var gatherX = clampToCourtX(gatherTarget);
            var gatherY = clampToCourtY(basket.y + (player.y < basket.y ? -2 : 2));
            var burstSpeed = playerData.turbo > 5 ? 5.4 : 3.8;

            if (playerData.turbo > 5) {
                playerData.turboActive = true;
                playerData.useTurbo(TURBO_DRAIN_RATE * 0.9);
            }
            steerToward(player, gatherX, gatherY, burstSpeed);
        } else {
            playerData.aiLastAction = "power_rim";
            attemptShot();
        }
        return;
    }

    // Escape pressure
    if (closestDefender) {
        var contactDist = getSpriteDistance(player, closestDefender);
        if (contactDist <= 1.9) {
            if (playerData.shakeCooldown <= 0 && attemptShake(player)) {
                playerData.aiLastAction = "shake_escape";
                return;
            }

            var awayX = clampToCourtX(player.x + (player.x - closestDefender.x) * 1.4);
            var awayY = clampToCourtY(player.y + (player.y - closestDefender.y) * 1.4);
            var escapeSpeed = playerData.turbo > 5 ? 3.8 : 2.4;

            if (playerData.turbo > 5 && !playerData.turboActive) {
                playerData.turboActive = true;
                playerData.useTurbo(TURBO_DRAIN_RATE * 0.6);
            }
            playerData.aiLastAction = "escape_pressure";
            steerToward(player, awayX, awayY, escapeSpeed);
            return;
        }
    }

    // Press break
    if (!dribbleDead && closestDefender && defenderDist <= 4 && closestDefenderDistToBasket >= distToBasket + 2) {
        playerData.aiLastAction = "press_break";
        var burstX = clampToCourtX(player.x + attackDirection * 8);
        var burstY = clampToCourtY(player.y + (Math.random() < 0.5 ? -2 : 2));
        var burstSpeed = playerData.turbo > 5 ? 5 : 3.2;

        if (playerData.turbo > 5) {
            playerData.turboActive = true;
            playerData.useTurbo(TURBO_DRAIN_RATE * 0.75);
        }
        steerToward(player, burstX, burstY, burstSpeed);
        return;
    }

    // Power rim finish
    if (rawDunkSkill >= 7 && distToBasket < 6 && defenderDist <= 5) {
        playerData.aiLastAction = "power_rim";
        attemptShot();
        return;
    }

    // PRIORITY 4: OPEN SHOT -> SHOOT
    var pullUpRange = isThreeSpecialist ? 12 : 14;
    if (shotQuality > SHOT_PROBABILITY_THRESHOLD && defenderDist > 5 && distToBasket > pullUpRange) {
        playerData.aiLastAction = "pull_up_shot";
        attemptShot();
        return;
    }

    // PRIORITY 5: HELP COLLAPSING -> KICK OUT
    if (isHelpCollapsing(player, teamName) && Math.random() < 0.7) {
        var teammate = getTeammate(player);
        if (teammate && teammate.playerData) {
            playerData.aiLastAction = "kickout_pass";
            animatePass(player, teammate);
            return;
        }
    }

    // PRIORITY 5.5: PASS TO OPEN CUTTER
    var teammate = getTeammate(player);
    if (teammate && teammate.playerData && teammate.playerData.openForPass) {
        var passDistance = getSpriteDistance(player, teammate);
        var teammateDistToBasket = getSpriteDistanceToBasket(teammate, teamName);

        if (passDistance < 30 && teammateDistToBasket < 20 && Math.random() < 0.75) {
            playerData.aiLastAction = "exploit_pass_to_cutter";
            animatePass(player, teammate);
            return;
        }
    }

    // PRIORITY 5.7: REWARD ACTIVE CUTS
    if (teammate && teammate.playerData) {
        var teammateAction = teammate.playerData.aiLastAction || "";
        var isCutting = teammateAction.indexOf("cut") >= 0 || teammateAction.indexOf("backdoor") >= 0;

        if (isCutting) {
            var passDistance = getSpriteDistance(player, teammate);
            var teammateDefenderDist = getClosestDefenderDistance(teammate, teamName);

            if (passDistance < 35 && teammateDefenderDist > 2.5 && Math.random() < 0.65) {
                playerData.aiLastAction = "pass_to_cutter";
                animatePass(player, teammate);
                return;
            }
        }
    }

    // PRIORITY 6: SHOT CLOCK URGENT -> FORCE SHOT
    if (context.isShotClockUrgent(SHOT_CLOCK_URGENT)) {
        playerData.aiLastAction = "force_shot";
        attemptShot();
        return;
    }

    // PRIORITY 7: DEAD DRIBBLE -> PHYSICAL BATTLE
    if (dribbleDead) {
        var deadElapsedFrames = deadElapsed / 16;
        var isStandoff = deadElapsedFrames > 15;

        if (closestDefender && defenderDist < 3) {
            var contactDist = getSpriteDistance(player, closestDefender);
            var shakeChance = isStandoff ? 0.85 : 0.60;
            var shoveChance = isStandoff ? 0.75 : 0.50;

            if (playerData.shakeCooldown <= 0 && Math.random() < shakeChance) {
                if (attemptShake(player)) {
                    playerData.aiLastAction = "dead_ball_shake";
                    if (shotQuality > SHOT_PROBABILITY_THRESHOLD - 10 && Math.random() < 0.7) {
                        attemptShot();
                    }
                    return;
                }
            }

            if (playerData.shoveCooldown <= 0 && Math.random() < shoveChance) {
                if (attemptShove(player, closestDefender)) {
                    playerData.aiLastAction = "dead_ball_shove";
                    return;
                }
            }
        }

        playerData.aiLastAction = "hold_pivot";
        return;
    }

    // DEFAULT: PROBE - Move toward best position
    var preferCorner = rawThreePointSkill >= rawDunkSkill;
    var cornerTarget = preferCorner ? selectBestCorner(teamName, player, true) : null;

    if (cornerTarget) {
        playerData.aiLastAction = "probe_corner";
        steerToward(player, cornerTarget.x, cornerTarget.y, 2);
    } else {
        playerData.aiLastAction = "probe";
        var probeSpot = spots.top_key;
        steerToward(player, probeSpot.x, probeSpot.y, 2);
    }
}
