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

var AI_OFFENSE_BALL = (typeof AI_CONSTANTS === "object" && AI_CONSTANTS.OFFENSE_BALL) ? AI_CONSTANTS.OFFENSE_BALL : null;

function aiOffenseValue(path, fallback) {
    if (!AI_OFFENSE_BALL) return fallback;
    var parts = path.split(".");
    var node = AI_OFFENSE_BALL;
    for (var i = 0; i < parts.length; i++) {
        if (!node || typeof node !== "object" || !(parts[i] in node)) {
            return fallback;
        }
        node = node[parts[i]];
    }
    return (typeof node === "undefined") ? fallback : node;
}

/**
 * AI logic for player with ball
 * @param {Object} player - Sprite with playerData
 * @param {string} teamName - "teamA" or "teamB"
 * @param {GameContext} context - Dependency injection context
 * @param {Object} systems - Systems object for dependency injection
 */
function aiOffenseBall(player, teamName, context, systems) {
    var playerData = player.playerData;
    if (!playerData) return;

    var playerName = playerData.name || "unknown";
    debugLog("[AI OFFENSE BALL] START: " + playerName + " at x=" + player.x);

    var ballCarrier = context.getBallCarrier();
    if (ballCarrier && ballCarrier !== player) {
        debugLog("[AI MISMATCH!] AI operating on " + playerData.name + " at x=" + player.x + ", but ballCarrier is " + ballCarrier.playerData.name + " at x=" + ballCarrier.x + " - SKIPPING");
        return; // Ball carrier changed, don't execute stale AI
    }

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
    var opponentTeam = getOpposingTeam(teamName);
    var closestDefender = getClosestPlayer(player.x, player.y, opponentTeam);
    var hasDribble = playerData.hasDribble !== false;
    var dribbleDead = !hasDribble;
    var deadElapsed = dribbleDead ? Math.max(0, now - (context.getBallHandlerDeadSince() || now)) : 0;
    var defenderTooTight = (typeof isDefenderPlayingTooTight === "function") ? isDefenderPlayingTooTight(player, opponentTeam) : false;
    var teammate = getTeammate(player, teamName);

    // CRITICAL: Check if ball carrier needs to make decision after shove battle
    // When shove fails, carrier still has ball but needs to decide: shot or pass?
    var stateManager = systems.stateManager;
    var needsDecision = stateManager ? stateManager.get("ballCarrierNeedsDecision") : false;

    // Debug decision check
    if (needsDecision) {
        debugLog("[AI DECISION CHECK] " + playerName + " needsDecision=" + needsDecision + ", dribbleDead=" + dribbleDead + ", hasDribble=" + playerData.hasDribble);
    }

    if (stateManager && needsDecision && dribbleDead) {
        var decisionTime = stateManager.get("ballCarrierDecisionTime") || 0;
        var timeSinceDecision = now - decisionTime;

        // Immediately evaluate shot vs pass (don't wait for forced shot timeout)
        var decisionWindowMs = aiOffenseValue("DECISION.QUICK_WINDOW_MS", 200);
        if (timeSinceDecision < decisionWindowMs) {
            debugLog("[AI DECISION] " + playerName + " evaluating shot vs pass after shove battle");
            stateManager.set("ballCarrierNeedsDecision", false, "decision_evaluated");

            // Evaluate pass first (higher priority than shot when dribble dead)
            var decisionTeammate = teammate || getTeammate(player, teamName);
            if (decisionTeammate) {
                // Simple pass quality: based on distance and if teammate is closer to basket
                var passDistance = getSpriteDistance(player, decisionTeammate);
                var teammateDistToBasket = getSpriteDistanceToBasket(decisionTeammate, teamName);
                var passerDistToBasket = distToBasket;

                // Good pass if: close enough to pass, teammate closer to basket, and random check
                var passQuality = aiOffenseValue("DECISION.PASS_BASE", 0.5);
                if (passDistance < aiOffenseValue("DECISION.PASS_DISTANCE_THRESHOLD", 25)) {
                    passQuality += aiOffenseValue("DECISION.PASS_DISTANCE_BONUS", 0.2);
                }
                if (teammateDistToBasket < passerDistToBasket - aiOffenseValue("DECISION.TEAMMATE_DISTANCE_MARGIN", 5)) {
                    passQuality += aiOffenseValue("DECISION.TEAMMATE_DISTANCE_BONUS", 0.3);
                }
                if (decisionTeammate.playerData && decisionTeammate.playerData.openForPass) {
                    passQuality += aiOffenseValue("DECISION.OPEN_BONUS", 0.2);
                }
                if (defenderTooTight) {
                    passQuality += aiOffenseValue("DECISION.TIGHT_BONUS", 0.2);
                }

                var shotQuality = calculateShotQuality(player, teamName);
                debugLog("[AI DECISION] Pass quality: " + passQuality.toFixed(2) + ", Shot quality: " + shotQuality.toFixed(2));

                // Favor pass when dribble is dead (60% pass threshold vs normal 75%)
                var minPassQuality = aiOffenseValue("DECISION.MIN_PASS_QUALITY", 0.45);
                var passChanceWhenDead = aiOffenseValue("DECISION.PASS_CHANCE_WHEN_DEAD", 0.60);
                if (passQuality > minPassQuality && Math.random() < passChanceWhenDead) {
                    debugLog("[AI DECISION] Choosing PASS (passQuality=" + passQuality.toFixed(2) + ")");
                    playerData.aiLastAction = "decision_pass";
                    var leadTarget = getSmartPassTarget(player, decisionTeammate);
                    animatePass(player, decisionTeammate, leadTarget, null, systems);
                    return;
                }
            }

            // No good pass, take the shot
            debugLog("[AI DECISION] Choosing SHOT (shotQuality=" + shotQuality.toFixed(2) + ")");
            playerData.aiLastAction = "decision_shot";
            attemptShot(systems);
            return;
        }
    }

    var closestDefenderDistToBasket = closestDefender ? getSpriteDistanceToBasket(closestDefender, teamName) : 999;
    var shotQuality = calculateShotQuality(player, teamName);
    var totalScoringAttr = rawThreePointSkill + rawDunkSkill;
    var threeBias = totalScoringAttr > 0 ? (rawThreePointSkill / totalScoringAttr) : 0.5;
    var driveBias = totalScoringAttr > 0 ? (rawDunkSkill / totalScoringAttr) : 0.5;
    var wantsPerimeter = Math.random() < (0.35 + threeBias * 0.55);
    var wantsDrive = Math.random() < (0.3 + driveBias * 0.6);

    // PRIORITY 0: EXPLOIT SHOVE - Defender is knocked back, take advantage immediately!
    if (closestDefender && closestDefender.playerData && closestDefender.playerData.shoveCooldown > 0) {
        var freshCooldownFrames = aiOffenseValue("EXPLOIT_SHOVE.FRESH_COOLDOWN_FRAMES", 20);
        var exploitWindow = closestDefender.playerData.shoveCooldown > freshCooldownFrames;

        if (exploitWindow) {
            if (dribbleDead) {
                playerData.aiLastAction = "exploit_shove_shoot";
                attemptShot(systems);
                return;
            } else if (distToBasket <= aiOffenseValue("EXPLOIT_SHOVE.DRIVE_DISTANCE_MAX", 15) &&
                rawDunkSkill >= aiOffenseValue("EXPLOIT_SHOVE.DRIVE_DUNK_SKILL_MIN", 6)) {
                playerData.aiLastAction = "exploit_shove_drive";
                playerData.turboActive = true;
                playerData.useTurbo(TURBO_DRAIN_RATE);
                steerToward(player, basket.x, basket.y, 5, systems);
                if (distToBasket < aiOffenseValue("EXPLOIT_SHOVE.FINISH_DISTANCE", 6)) {
                    attemptShot(systems);
                }
                return;
            } else if (rawThreePointSkill >= aiOffenseValue("EXPLOIT_SHOVE.PULLUP_THREE_SKILL_MIN", 6) &&
                distToBasket >= aiOffenseValue("EXPLOIT_SHOVE.PULLUP_DISTANCE_MIN", 12)) {
                playerData.aiLastAction = "exploit_shove_pullup";
                attemptShot(systems);
                return;
            } else {
                playerData.aiLastAction = "exploit_shove_attack";
                var attackSpeed = playerData.turbo > aiOffenseValue("EXPLOIT_SHOVE.ATTACK_TURBO_THRESHOLD", 10)
                    ? aiOffenseValue("EXPLOIT_SHOVE.ATTACK_SPEED_TURBO", 4.5)
                    : aiOffenseValue("EXPLOIT_SHOVE.ATTACK_SPEED_BASE", 3);
                if (playerData.turbo > aiOffenseValue("EXPLOIT_SHOVE.ATTACK_TURBO_THRESHOLD", 10)) {
                    playerData.turboActive = true;
                    playerData.useTurbo(TURBO_DRAIN_RATE * aiOffenseValue("EXPLOIT_SHOVE.ATTACK_TURBO_COST_FACTOR", 0.7));
                }
                steerToward(player, basket.x, basket.y, attackSpeed, systems);
                return;
            }
        }
    }

    // PRIORITY 1: CLOSE TO BASKET BUT OUT OF TURBO -> FINISH THE PLAY!
    if (!inBackcourt && distToBasket <= 10 && playerData.turbo < 15) {
        var wideOpen = defenderDist > GAME_BALANCE.AI.WIDE_OPEN_DISTANCE;
        var reasonablyOpen = defenderDist > GAME_BALANCE.AI.REASONABLY_OPEN_DISTANCE;

        if (distToBasket < 6 && reasonablyOpen) {
            playerData.aiLastAction = "finish_no_turbo_close";
            attemptShot(systems);
            return;
        }

        if (distToBasket <= 10 && wideOpen) {
            playerData.aiLastAction = "finish_no_turbo_open";
            attemptShot(systems);
            return;
        }

        if (!dribbleDead && distToBasket < GAME_BALANCE.AI.DRIVE_DISTANCE_THRESHOLD && defenderDist > GAME_BALANCE.AI.DRIVE_DEFENDER_DISTANCE) {
            playerData.aiLastAction = "finish_drive_no_turbo";
            steerToward(player, basket.x, basket.y, 3, systems);
            if (distToBasket < 5.5) {
                attemptShot(systems);
            }
            return;
        }
    }

    // PRIORITY 2: BACKCOURT -> FRONTCOURT (GET OUT OF BACKCOURT ASAP)
    if (inBackcourt && !context.isFrontcourtEstablished()) {
        debugLog("[AI BACKCOURT] ENTERED backcourt block - teamName=" + teamName + ", player.x=" + player.x + ", targetX=" + spots.frontcourt_entry.x);
        playerData.aiLastAction = "push_backcourt";
        var backcourtStuckTicks = aiOffenseValue("BACKCOURT.STUCK_TICKS", 2);
        var isStuck = context.isBallHandlerStuck(backcourtStuckTicks);

        if (isStuck) {
            var teammate = getTeammate(player, teamName);
            if (teammate && teammate.playerData) {
                var teammateInFrontcourt = !isInBackcourt(teammate, teamName);
                var myDistToMid = Math.abs(player.x - COURT_MID_X);
                var teammateDistToMid = Math.abs(teammate.x - COURT_MID_X);

                if (teammateInFrontcourt || teammateDistToMid < myDistToMid) {
                    playerData.aiLastAction = "backcourt_pass_unstuck";
                    var leadTarget = getSmartPassTarget(player, teammate);
                    animatePass(player, teammate, leadTarget, null, systems);
                    return;
                }
            }
        }

        var targetSpot = spots.frontcourt_entry;
        var speed = aiOffenseValue("BACKCOURT.BASE_SPEED", 3);

        if (isStuck) {
            var jukeOffset = aiOffenseValue("BACKCOURT.JUKE_OFFSET", 4);
            var jukeSide = (Math.random() < 0.5) ? -jukeOffset : jukeOffset;
            targetSpot = {
                x: spots.frontcourt_entry.x,
                y: spots.frontcourt_entry.y + jukeSide
            };
        }

        var turboThreshold = aiOffenseValue("BACKCOURT.TURBO_THRESHOLD", 25);
        var safeDefenderDistance = aiOffenseValue("BACKCOURT.SAFE_DEFENDER_DISTANCE", 3);
        if (!isStuck && playerData.turbo > turboThreshold && defenderDist > safeDefenderDistance) {
            playerData.turboActive = true;
            playerData.useTurbo(TURBO_DRAIN_RATE);
            speed = aiOffenseValue("BACKCOURT.TURBO_SPEED", 5);
        }

        debugLog("[AI BACKCOURT STEER] About to call steerToward for " + playerData.name + " to targetSpot.x=" + targetSpot.x + ", speed=" + speed);
        steerToward(player, targetSpot.x, targetSpot.y, speed, systems);
        return;
    }

    // PRIORITY 2A: PERIMETER QUICK THREE (specialists)
    var perimeterMin = aiOffenseValue("QUICK_THREE.PERIMETER_MIN", 17);
    var perimeterMax = aiOffenseValue("QUICK_THREE.PERIMETER_MAX", 22);
    var isPerimeter = distToBasket >= perimeterMin && distToBasket <= perimeterMax;
    if (!inBackcourt && isPerimeter && wantsPerimeter) {
        var earlyAdvanceTicks = aiOffenseValue("QUICK_THREE.EARLY_ADVANCE_TICKS", 1);
        var settledStuckTicks = aiOffenseValue("QUICK_THREE.SETTLED_STUCK_TICKS", 1);
        var settleTurboCooldownMs = aiOffenseValue("QUICK_THREE.SETTLE_TURBO_COOLDOWN_MS", 350);
        var earlyPossession = context.getBallHandlerAdvanceTimer() <= earlyAdvanceTicks;
        var settledFeet = context.isBallHandlerStuck(settledStuckTicks) && timeSinceTurbo > settleTurboCooldownMs;
        var specialistSpacing = aiOffenseValue("QUICK_THREE.SPECIALIST_SPACING", 3);
        var defaultSpacing = aiOffenseValue("QUICK_THREE.DEFAULT_SPACING", 4.5);
        var spacing = defenderDist >= (isThreeSpecialist ? specialistSpacing : defaultSpacing);
        var specialistClockBuffer = aiOffenseValue("QUICK_THREE.SPECIALIST_CLOCK_BUFFER", 4);
        var defaultClockBuffer = aiOffenseValue("QUICK_THREE.DEFAULT_CLOCK_BUFFER", 2);
        var clockComfort = context.getShotClock() > (SHOT_CLOCK_URGENT + (isThreeSpecialist ? specialistClockBuffer : defaultClockBuffer));
        var specialistQualityDelta = aiOffenseValue("QUICK_THREE.SPECIALIST_QUALITY_DELTA", 7);
        var defaultQualityDelta = aiOffenseValue("QUICK_THREE.DEFAULT_QUALITY_DELTA", 3);
        var qualityFloor = SHOT_PROBABILITY_THRESHOLD - (isThreeSpecialist ? specialistQualityDelta : defaultQualityDelta);
        var quickThreeQuality = shotQuality;
        var transitionTurboMs = aiOffenseValue("QUICK_THREE.TRANSITION_TURBO_MS", 1200);
        var isTransition = earlyPossession && timeSinceTurbo < transitionTurboMs;

        if (isTransition) {
            var specialistTransitionPenalty = aiOffenseValue("QUICK_THREE.SPECIALIST_TRANSITION_PENALTY", 4);
            var defaultTransitionPenalty = aiOffenseValue("QUICK_THREE.DEFAULT_TRANSITION_PENALTY", 12);
            quickThreeQuality -= isThreeSpecialist ? specialistTransitionPenalty : defaultTransitionPenalty;
        }
        var distPenaltyStart = aiOffenseValue("QUICK_THREE.DISTANCE_PENALTY_START", 20);
        if (distToBasket > distPenaltyStart) {
            var penaltyScale = aiOffenseValue("QUICK_THREE.DISTANCE_PENALTY_SCALE", 4);
            quickThreeQuality -= (distToBasket - distPenaltyStart) * penaltyScale;
        }

        var hasGreenLight = isThreeSpecialist || skillEdge >= 3 || (threePointSkill >= 7 && !isTransition);

        if (settledFeet && (clockComfort || (earlyPossession && !isTransition)) &&
            spacing && quickThreeQuality >= qualityFloor && hasGreenLight) {
            playerData.aiLastAction = (earlyPossession && isThreeSpecialist)
                ? "transition_three"
                : "quick_three";
            attemptShot(systems);
            return;
        }
    }

    // PRIORITY 3: LANE OPEN + TURBO -> DRIVE
    var highSkillThreshold = aiOffenseValue("DRIVE.HIGH_SKILL_DUNK_THRESHOLD", 7);
    var highSkillTurbo = aiOffenseValue("DRIVE.HIGH_SKILL_TURBO_THRESHOLD", 20);
    var defaultTurboThreshold = aiOffenseValue("DRIVE.DEFAULT_TURBO_THRESHOLD", 30);
    var laneTurboThreshold = rawDunkSkill >= highSkillThreshold ? highSkillTurbo : defaultTurboThreshold;
    var hasEnoughTurbo = playerData.turbo > laneTurboThreshold;
    var alreadyClose = distToBasket < aiOffenseValue("DRIVE.ALREADY_CLOSE_DISTANCE", 12);

    if (!dribbleDead && wantsDrive && isLaneOpen(player, teamName) &&
        (hasEnoughTurbo || alreadyClose) && defenderDist > aiOffenseValue("DRIVE.DEFENDER_BUFFER", 4)) {
        playerData.aiLastAction = hasEnoughTurbo ? "drive_lane" : "drive_lane_no_turbo";
        var driveSpeed = aiOffenseValue("DRIVE.BASE_SPEED", 3);

        if (hasEnoughTurbo) {
            playerData.turboActive = true;
            playerData.useTurbo(TURBO_DRAIN_RATE);
            driveSpeed = aiOffenseValue("DRIVE.TURBO_SPEED", 5);
        }

        steerToward(player, basket.x, basket.y, driveSpeed, systems);

        if (distToBasket < aiOffenseValue("DRIVE.FINISH_DISTANCE", 6)) {
            attemptShot(systems);
        }
        return;
    }

    // High flyer attack rim logic
    var highFlyer = rawDunkSkill >= aiOffenseValue("HIGH_FLYER.MIN_DUNK_SKILL", 8);
    var highFlyerDistance = aiOffenseValue("HIGH_FLYER.MAX_DISTANCE", 12);
    var highFlyerDefender = aiOffenseValue("HIGH_FLYER.MAX_DEFENDER_DISTANCE", 6);
    if (!dribbleDead && highFlyer && distToBasket <= highFlyerDistance && defenderDist <= highFlyerDefender) {
        if (distToBasket > aiOffenseValue("HIGH_FLYER.GATHER_DISTANCE", 6.2)) {
            playerData.aiLastAction = "attack_rim";
            var gatherTarget = basket.x - attackDirection * aiOffenseValue("HIGH_FLYER.GATHER_OFFSET_X", 5);
            var gatherX = clampToCourtX(gatherTarget);
            var gatherYOffset = aiOffenseValue("HIGH_FLYER.GATHER_OFFSET_Y", 2);
            var gatherY = clampToCourtY(basket.y + (player.y < basket.y ? -gatherYOffset : gatherYOffset));
            var turboThreshold = aiOffenseValue("HIGH_FLYER.TURBO_THRESHOLD", 5);
            var burstSpeed = playerData.turbo > turboThreshold
                ? aiOffenseValue("HIGH_FLYER.TURBO_SPEED", 5.4)
                : aiOffenseValue("HIGH_FLYER.BASE_SPEED", 3.8);

            if (playerData.turbo > turboThreshold) {
                playerData.turboActive = true;
                playerData.useTurbo(TURBO_DRAIN_RATE * aiOffenseValue("HIGH_FLYER.TURBO_COST_FACTOR", 0.9));
            }
            steerToward(player, gatherX, gatherY, burstSpeed, systems);
        } else {
            playerData.aiLastAction = "power_rim";
            attemptShot(systems);
        }
        return;
    }

    // Escape pressure
    if (closestDefender) {
        var contactDist = getSpriteDistance(player, closestDefender);
        var escapeContactDistance = aiOffenseValue("ESCAPE_PRESSURE.CONTACT_DISTANCE", 1.9);
        if (contactDist <= escapeContactDistance) {
            if (playerData.shakeCooldown <= 0 && attemptShake(player, systems)) {
                playerData.aiLastAction = "shake_escape";
                return;
            }

            var escapeMultiplier = aiOffenseValue("ESCAPE_PRESSURE.ESCAPE_MULTIPLIER", 1.4);
            var awayX = clampToCourtX(player.x + (player.x - closestDefender.x) * escapeMultiplier);
            var awayY = clampToCourtY(player.y + (player.y - closestDefender.y) * escapeMultiplier);
            var turboThreshold = aiOffenseValue("ESCAPE_PRESSURE.TURBO_THRESHOLD", 5);
            var escapeSpeed = playerData.turbo > turboThreshold
                ? aiOffenseValue("ESCAPE_PRESSURE.TURBO_SPEED", 3.8)
                : aiOffenseValue("ESCAPE_PRESSURE.BASE_SPEED", 2.4);

            if (playerData.turbo > turboThreshold && !playerData.turboActive) {
                playerData.turboActive = true;
                playerData.useTurbo(TURBO_DRAIN_RATE * aiOffenseValue("ESCAPE_PRESSURE.TURBO_COST_FACTOR", 0.6));
            }
            playerData.aiLastAction = "escape_pressure";
            steerToward(player, awayX, awayY, escapeSpeed, systems);
            return;
        }
    }

    // Press break
    var pressBreakDefenderMax = aiOffenseValue("PRESS_BREAK.DEFENDER_DISTANCE_MAX", 4);
    var pressBreakAdvantage = aiOffenseValue("PRESS_BREAK.DEFENDER_ADVANTAGE_DELTA", 2);
    if (!dribbleDead && closestDefender && defenderDist <= pressBreakDefenderMax &&
        closestDefenderDistToBasket >= distToBasket + pressBreakAdvantage) {
        playerData.aiLastAction = "press_break";
        var burstX = clampToCourtX(player.x + attackDirection * aiOffenseValue("PRESS_BREAK.BURST_X_OFFSET", 8));
        var burstYOffset = aiOffenseValue("PRESS_BREAK.BURST_Y_OFFSET", 2);
        var burstY = clampToCourtY(player.y + (Math.random() < 0.5 ? -burstYOffset : burstYOffset));
        var turboThreshold = aiOffenseValue("PRESS_BREAK.TURBO_THRESHOLD", 5);
        var burstSpeed = playerData.turbo > turboThreshold
            ? aiOffenseValue("PRESS_BREAK.TURBO_SPEED", 5)
            : aiOffenseValue("PRESS_BREAK.BASE_SPEED", 3.2);

        if (playerData.turbo > turboThreshold) {
            playerData.turboActive = true;
            playerData.useTurbo(TURBO_DRAIN_RATE * aiOffenseValue("PRESS_BREAK.TURBO_COST_FACTOR", 0.75));
        }
        steerToward(player, burstX, burstY, burstSpeed, systems);
        return;
    }

    // Power rim finish
    if (rawDunkSkill >= aiOffenseValue("POWER_RIM.MIN_DUNK_SKILL", 7) &&
        distToBasket < aiOffenseValue("POWER_RIM.DISTANCE_MAX", 6) &&
        defenderDist <= aiOffenseValue("POWER_RIM.DEFENDER_DISTANCE_MAX", 5)) {
        debugLog("[AI P3.5 SHOT] " + playerName + " POWER RIM (dunk range, distToBasket=" + distToBasket.toFixed(1) + ")");
        playerData.aiLastAction = "power_rim";
        attemptShot(systems);
        return;
    }

    // PRIORITY 4: OPEN SHOT -> SHOOT
    var pullUpRange = isThreeSpecialist
        ? aiOffenseValue("PULL_UP.RANGE_SPECIALIST", 12)
        : aiOffenseValue("PULL_UP.RANGE_DEFAULT", 14);
    var pullUpDefenderMin = aiOffenseValue("PULL_UP.MIN_DEFENDER_DISTANCE", 5);
    debugLog("[AI P4] " + playerName + ": shotQuality=" + shotQuality.toFixed(1) + ", defenderDist=" + defenderDist.toFixed(1) + ", distToBasket=" + distToBasket.toFixed(1) + ", pullUpRange=" + pullUpRange);
    if (shotQuality > SHOT_PROBABILITY_THRESHOLD && defenderDist > pullUpDefenderMin && distToBasket > pullUpRange) {
        debugLog("[AI P4 SHOT] " + playerName + " PULL UP (open shot)");
        playerData.aiLastAction = "pull_up_shot";
        attemptShot(systems);
        return;
    }

    // PRIORITY 5: HELP COLLAPSING -> KICK OUT
    var helpCollapsing = isHelpCollapsing(player, teamName);
    debugLog("[AI P5] " + playerName + ": helpCollapsing=" + helpCollapsing);
    if (helpCollapsing && Math.random() < GAME_BALANCE.AI.PASS_ON_HELP_COLLAPSE_PROB) {
        if (teammate && teammate.playerData) {
            debugLog("[AI P5 PASS] " + playerName + " KICKOUT to " + teammate.playerData.name);
            playerData.aiLastAction = "kickout_pass";
            var leadTarget = getSmartPassTarget(player, teammate);
            animatePass(player, teammate, leadTarget, null, systems);
            return;
        }
    }

    teammate = teammate || getTeammate(player, teamName);

    // PRIORITY 5.5: PASS TO OPEN CUTTER
    var teammateOpen = teammate && teammate.playerData && teammate.playerData.openForPass;
    var tightDefenseRelease = defenderTooTight && teammate;
    debugLog("[AI P5.5] " + playerName + ": teammate=" + (teammate ? teammate.playerData.name : "none") + ", openForPass=" + teammateOpen);
    if (teammate && (teammateOpen || tightDefenseRelease)) {
        var passDistance = getSpriteDistance(player, teammate);
        var teammateDistToBasket = getSpriteDistanceToBasket(teammate, teamName);
        debugLog("[AI P5.5] " + playerName + ": passDistance=" + passDistance.toFixed(1) + ", teammateDistToBasket=" + teammateDistToBasket.toFixed(1));

        var exploitChance = GAME_BALANCE.AI.PASS_CLOSE_TO_BASKET_PROB + (defenderTooTight ? 0.25 : 0);
        var distanceOk = passDistance < GAME_BALANCE.AI.MAX_CLOSE_PASS_DISTANCE;
        var scoringSpot = teammateDistToBasket < GAME_BALANCE.AI.TEAMMATE_TO_BASKET_DISTANCE;

        if (distanceOk && scoringSpot && Math.random() < exploitChance) {
            debugLog("[AI P5.5 PASS] " + playerName + " EXPLOIT PASS to " + teammate.playerData.name);
            playerData.aiLastAction = "exploit_pass_to_cutter";
            var leadTarget = getSmartPassTarget(player, teammate);
            animatePass(player, teammate, leadTarget, null, systems);
            return;
        }
    }

    // PRIORITY 5.7: REWARD ACTIVE CUTS
    if (teammate && teammate.playerData) {
        var teammateAction = teammate.playerData.aiLastAction || "";
        var isCutting = teammateAction.indexOf("cut") >= 0 || teammateAction.indexOf("backdoor") >= 0;
        debugLog("[AI P5.7] " + playerName + ": teammate action=" + teammateAction + ", isCutting=" + isCutting);

        if (isCutting) {
            var passDistance = getSpriteDistance(player, teammate);
            var teammateDefenderDist = getClosestDefenderDistance(teammate, teamName);
            debugLog("[AI P5.7] " + playerName + ": passDistance=" + passDistance.toFixed(1) + ", teammateDefenderDist=" + teammateDefenderDist.toFixed(1));

            if (passDistance < GAME_BALANCE.AI.MAX_NORMAL_PASS_DISTANCE && teammateDefenderDist > GAME_BALANCE.AI.OPEN_TEAMMATE_DISTANCE && Math.random() < GAME_BALANCE.AI.PASS_OPEN_TEAMMATE_PROB) {
                debugLog("[AI P5.7 PASS] " + playerName + " CUTTER PASS to " + teammate.playerData.name);
                playerData.aiLastAction = "pass_to_cutter";
                var leadTarget = getSmartPassTarget(player, teammate);
                animatePass(player, teammate, leadTarget, null, systems);
                return;
            }
        }
    }

    // PRIORITY 6: SHOT CLOCK URGENT -> FORCE SHOT
    var shotClockUrgent = context.isShotClockUrgent(SHOT_CLOCK_URGENT);
    debugLog("[AI P6] " + playerName + ": shotClockUrgent=" + shotClockUrgent + ", shotClock=" + context.getShotClock());
    if (shotClockUrgent) {
        debugLog("[AI P6 SHOT] " + playerName + " FORCE SHOT (clock urgent)");
        playerData.aiLastAction = "force_shot";
        attemptShot(systems);
        return;
    }

    // PRIORITY 7: DEAD DRIBBLE -> PHYSICAL BATTLE
    if (dribbleDead) {
        var deadFrameMs = aiOffenseValue("DEAD_DRIBBLE.FRAME_DURATION_MS", 16);
        var deadElapsedFrames = deadElapsed / deadFrameMs;
        var isStandoff = deadElapsedFrames > aiOffenseValue("DEAD_DRIBBLE.STANDOFF_FRAMES", 15);

        if (closestDefender && defenderDist < aiOffenseValue("DEAD_DRIBBLE.CLOSE_DEFENDER_DISTANCE", 3)) {
            var contactDist = getSpriteDistance(player, closestDefender);
            var shakeChance = isStandoff
                ? aiOffenseValue("DEAD_DRIBBLE.SHAKE_CHANCE_STANDOFF", 0.85)
                : aiOffenseValue("DEAD_DRIBBLE.SHAKE_CHANCE_DEFAULT", 0.60);
            var shoveChance = isStandoff
                ? aiOffenseValue("DEAD_DRIBBLE.SHOVE_CHANCE_STANDOFF", 0.75)
                : aiOffenseValue("DEAD_DRIBBLE.SHOVE_CHANCE_DEFAULT", 0.50);

            if (playerData.shakeCooldown <= 0 && Math.random() < shakeChance) {
                if (attemptShake(player, systems)) {
                    playerData.aiLastAction = "dead_ball_shake";
                    var shakeShotDelta = aiOffenseValue("DEAD_DRIBBLE.SHOOTER_BONUS_DELTA", 10);
                    if (shotQuality > SHOT_PROBABILITY_THRESHOLD - shakeShotDelta &&
                        Math.random() < GAME_BALANCE.AI.SHOOT_AFTER_SHAKE_PROB) {
                        attemptShot(systems);
                    }
                    return;
                }
            }

            if (playerData.shoveCooldown <= 0 && Math.random() < shoveChance) {
                if (attemptShove(player, closestDefender, systems)) {
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
        debugLog("[AI DEFAULT] " + playerName + " PROBE CORNER");
        playerData.aiLastAction = "probe_corner";
        steerToward(player, cornerTarget.x, cornerTarget.y, 2, systems);
    } else {
        debugLog("[AI DEFAULT] " + playerName + " PROBE KEY");
        playerData.aiLastAction = "probe";
        var probeSpot = spots.top_key;
        steerToward(player, probeSpot.x, probeSpot.y, 2, systems);
    }
    debugLog("[AI OFFENSE BALL] END: " + playerName + " action=" + playerData.aiLastAction);
}
