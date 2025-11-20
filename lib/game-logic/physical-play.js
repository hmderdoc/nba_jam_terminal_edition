/**
 * NBA JAM - Physical Play System Module
 * 
 * Handles all physical play mechanics including:
 * - Shake (ball-handler clearing defenders)
 * - Shove (offensive and defensive pushing)
 * - Shove opportunity evaluation (AI decision making)
 * - Defensive rotation after shoves
 * - Loose ball creation from successful shoves
 * - Visual appearance updates (shoved/shover sprite states)
 * 
 * Dependencies:
 * - Game state (gameState with ballCarrier, reboundActive, shotClock, etc.)
 * - Player utilities (getPlayerTeamName, getTouchingOpponents, getTeammate, getAllPlayers, getEffectiveAttribute)
 * - Court utilities (getSpriteDistance, distanceBetweenPoints, clampToCourtX, clampToCourtY)
 * - Physical mechanics (knockBack, setPlayerKnockedDown, incrementInjury)
 * - Game flow (recordTurnover, switchPossession, announceEvent, flushKeyboardBuffer)
 * - Rebounds (createRebound, resolveReboundScramble for loose balls)
 * - Ball frame (moveBallFrameTo for loose ball animation)
 * - Shooting (attemptShot, calculateShotProbability)
 * - Passing (animatePass)
 * - Sprite system (Sprite.cycle, applyInjectedBearing, mergeShovedBearingsIntoSprite, mergeShoverBearingsIntoSprite)
 * - Team utilities (getOpposingTeamSprites, getClosestPlayer, getOffensiveBasket)
 * - Defense (assignDefensiveMatchups, getPlayerKey)
 * - Animation (courtFrame, drawScore)
 * - Multiplayer coordinator (event broadcasting)
 * - Constants (ATTR_POWER, TURBO_DRAIN_RATE, DOUBLE_TEAM_RADIUS, SHOVE_FAILURE_STUN, SHOT_PROBABILITY_THRESHOLD, BASKET_*, KEY_DEPTH)
 */

var SHAKE_TIMING_CONFIG = (typeof SHAKE_TIMING === "object" && SHAKE_TIMING) || {
    COOLDOWN_FRAMES: 25,
    deadDribbleGraceMs: 2000,
    knockdown: {
        baseFrames: 32,
        randomAdditionalFrames: 18
    }
};
var SHOVE_COOLDOWNS = (typeof SHOVE_COOLDOWN_CONFIG === "object" && SHOVE_COOLDOWN_CONFIG) || {
    offBall: 20,
    onBall: 35
};
var LOOSE_BALL_SETTINGS = (typeof LOOSE_BALL_TIMING === "object" && LOOSE_BALL_TIMING) || {
    horizontalTiles: 6,
    verticalTiles: 3,
    arcSteps: 8,
    arcHeight: 2
};

/**
 * Attempt shake - ball handler clears nearby defenders
 * Uses power attribute + turbo bonus to knock back multiple defenders
 * Can cause knockdowns based on power differential
 * 
 * Returns: true if shake succeeded, false otherwise
 */
function attemptShake(player, systems) {
    if (!player || !player.playerData) return false;
    var teamName = getPlayerTeamName(player);
    if (!teamName) return false;
    if (player.playerData.shakeCooldown > 0) return false;

    player.playerData.shakeCooldown = SHAKE_TIMING_CONFIG.COOLDOWN_FRAMES;

    var power = getEffectiveAttribute(player.playerData, ATTR_POWER) || 5;
    var turboBonus = (player.playerData.turboActive && player.playerData.turbo > 0) ? 2 : 0;
    var touching = getTouchingOpponents(player, teamName, 2.75);
    if (!touching.length) return false;

    var affected = 0;
    var knockdownCount = 0;

    for (var i = 0; i < touching.length; i++) {
        var defender = touching[i];
        if (!defender || !defender.playerData) continue;
        var defenderPower = getEffectiveAttribute(defender.playerData, ATTR_POWER) || 5;
        var aggressorScore = power + turboBonus;
        var threshold = (aggressorScore + 6) / (aggressorScore + defenderPower + 12);
        threshold = clamp(threshold, 0.15, 0.9);
        if (Math.random() > threshold) continue;

        var push = Math.max(1, Math.min(5, Math.round((aggressorScore - defenderPower) / 2 + 2 + Math.random() * 2)));
        knockBack(defender, player, push);
        incrementInjury(defender, 1);
        affected++;

        var knockdownChance = Math.max(0, (aggressorScore - defenderPower) * 0.08 + Math.random() * 0.1);
        knockdownChance = Math.min(knockdownChance, 0.45);
        if (Math.random() < knockdownChance) {
            var knockdownFrames = SHAKE_TIMING_CONFIG.knockdown ?
                (SHAKE_TIMING_CONFIG.knockdown.baseFrames +
                    Math.round(Math.random() * SHAKE_TIMING_CONFIG.knockdown.randomAdditionalFrames)) :
                (32 + Math.round(Math.random() * 18));
            setPlayerKnockedDown(defender, knockdownFrames);
            knockdownCount++;
        }
    }

    if (affected > 0) {
        player.playerData.hasDribble = true;
        if (player.playerData.turboActive) player.playerData.useTurbo(TURBO_DRAIN_RATE);
        var eventKey = knockdownCount > 0 ? "shake_knockdown" : "shake_break";
        announceEvent(eventKey, {
            player: player,
            team: teamName,
            playerName: player.playerData.name
        }, systems);
        return true;
    }
    return false;
}

/**
 * Handle AI decision after successful shake
 * Evaluates whether to shoot or pass based on shot probability
 * 
 * Returns: true if action taken, false otherwise
 */
function handlePostShakeDecision(player, teamName, systems) {
    if (!player || player.isHuman || !player.playerData) return false;
    var basket = getOffensiveBasket(teamName);
    var opponentTeam = teamName === "teamA" ? "teamB" : "teamA";
    var closestDefender = getClosestPlayer(player.x, player.y, opponentTeam);
    var shotProb = calculateShotProbability(player, basket.x, basket.y, closestDefender);
    if (shotProb >= (SHOT_PROBABILITY_THRESHOLD - 6)) {
        player.playerData.aiLastAction = "shake_shot";
        attemptShot(systems);
        return true;
    }

    var teammate = getTeammate(player);
    if (teammate && teammate.playerData) {
        var teammateClosest = getClosestPlayer(teammate.x, teammate.y, opponentTeam);
        var teammateProb = calculateShotProbability(teammate, basket.x, basket.y, teammateClosest);
        var leadTarget = null;
        if (teammate.playerData.emergencyCut) {
            leadTarget = teammate.playerData.emergencyCut.leadTarget || teammate.playerData.aiTargetSpot;
        }
        if (teammateProb >= (SHOT_PROBABILITY_THRESHOLD - 10) || !closestDefender || getSpriteDistance(player, closestDefender) < 3) {
            player.playerData.aiLastAction = "shake_pass";
            animatePass(player, teammate, leadTarget, null, systems);
            return true;
        }
    }
    return false;
}

/**
 * Attempt shove - shared by AI and user controls
 * @param {Object} defender - Sprite initiating shove
 * @param {Object|null} targetOverride - Optional specific victim (off-ball shove)
 * @param {Object} systems - Systems container (must include stateManager)
 * @returns {boolean} True if shove succeeded
 */
function attemptShove(defender, targetOverride, systems) {
    if (!defender || !defender.playerData) return false;
    if (defender.playerData.shoveAttemptCooldown > 0) return false;
    systems = systems || {};
    var stateManager = systems.stateManager;
    if (!stateManager) {
        throw new Error("attemptShove requires systems.stateManager");
    }

    // Multiplayer: only coordinator performs shove resolution
    if (typeof mpCoordinator !== "undefined" && mpCoordinator && !mpCoordinator.isCoordinator) {
        return false;
    }

    var ballCarrier = stateManager.get('ballCarrier');
    var victim = targetOverride || ballCarrier;
    if (!victim || !victim.playerData) return false;

    var defenderTeam = getPlayerTeamName(defender);
    var victimTeam = getPlayerTeamName(victim);
    if (defenderTeam && victimTeam && defenderTeam === victimTeam) return false;

    var distance = getSpriteDistance(defender, victim);
    if (distance > 4.0) return false;

    var isShake = (victim === ballCarrier && defender === ballCarrier);
    if (isShake && typeof getBallHandlerDeadElapsed === "function") {
        var deadElapsed = getBallHandlerDeadElapsed(systems);
        if (defender.playerData.shakeUsedThisPossession && deadElapsed < SHAKE_TIMING_CONFIG.deadDribbleGraceMs) {
            return false;
        }
    }

    var ballState = "off_ball";
    var isOffBall = true;
    if (victim === ballCarrier) {
        isOffBall = false;
        ballState = (victim.playerData.hasDribble === false) ? "picked_up" : "dribbling";
    }

    var defPower = getEffectiveAttribute(defender.playerData, ATTR_POWER) || 5;
    if (defender.playerData.turboActive && defender.playerData.turbo > 0) {
        defPower += 2;
        defender.playerData.useTurbo(TURBO_DRAIN_RATE * 0.5);
    }
    var victimPower = getEffectiveAttribute(victim.playerData, ATTR_POWER) || 5;

    var successChance = 0.30;
    var powerDiff = defPower - victimPower;
    var skillBonus = Math.max(0, Math.min(0.15, powerDiff * 0.015));
    successChance += skillBonus;

    var dx = victim.x - defender.x;
    var dy = victim.y - defender.y;
    var angleToVictim = Math.atan2(dy, dx);
    var victimFacing = victim.playerData.facing || 0;
    var angleDiff = Math.abs(angleToVictim - victimFacing);
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    angleDiff = Math.abs(angleDiff);
    if (angleDiff > Math.PI / 4) {
        successChance += 0.10;
    }

    if (ballState === "picked_up") {
        successChance *= 1.2;
    } else if (ballState === "dribbling") {
        successChance *= 0.6;
    } else {
        successChance *= 0.8;
    }

    successChance = clamp(successChance, 0.15, 0.75);

    if (Math.random() < successChance) {
        var cooldownFrames = isOffBall ? SHOVE_COOLDOWNS.offBall : SHOVE_COOLDOWNS.onBall;
        defender.playerData.shoveAttemptCooldown = cooldownFrames;
        if (isShake) {
            defender.playerData.shakeUsedThisPossession = true;
        }

        var basePush = 15;
        var powerBonus = (defPower - victimPower) * 2;
        var push = clamp(basePush + powerBonus, 12, 25);
        knockBack(victim, defender, push);

        if (typeof mpCoordinator !== "undefined" && mpCoordinator && mpCoordinator.isCoordinator &&
            typeof mpCoordinator.recordAnimationEvent === "function" && typeof getPlayerGlobalId === "function") {
            var attackerId = getPlayerGlobalId(defender);
            var victimId = getPlayerGlobalId(victim);
            if (attackerId !== null && attackerId !== undefined && victimId !== null && victimId !== undefined) {
                mpCoordinator.recordAnimationEvent("shove_knockback", {
                    attackerId: attackerId,
                    victimId: victimId,
                    pushDistance: push,
                    victimPos: { x: victim.x, y: victim.y }
                });
            }
        }
        incrementInjury(victim, 1);

        if (victim === ballCarrier) {
            victim.playerData.hasDribble = false;
            announceEvent("shove", {
                playerName: defender.playerData.name,
                player: defender,
                team: defenderTeam
            }, systems);
            createLooseBall(defender, victim, systems);
        } else {
            announceEvent("shove_offball", {
                playerName: defender.playerData.name,
                player: defender,
                team: defenderTeam
            }, systems);
        }

        if (typeof mpCoordinator !== "undefined" && mpCoordinator && mpCoordinator.isCoordinator) {
            mpCoordinator.broadcastGameState({
                type: 'shove',
                success: true,
                attackerId: getPlayerGlobalId(defender),
                victimId: getPlayerGlobalId(victim),
                victimPos: { x: victim.x, y: victim.y },
                pushDistance: push,
                cooldowns: {
                    attackerAttempt: defender.playerData.shoveAttemptCooldown,
                    victimShoved: victim.playerData.shoveCooldown
                },
                createdLooseBall: victim === ballCarrier,
                timestamp: Date.now()
            });
        }

        return true;
    }

    defender.playerData.shoveAttemptCooldown = isOffBall ? SHOVE_COOLDOWNS.offBall : SHOVE_COOLDOWNS.onBall;
    defender.playerData.shoveFailureStun = SHOVE_FAILURE_STUN;

    if (typeof mpCoordinator !== "undefined" && mpCoordinator && mpCoordinator.isCoordinator) {
        mpCoordinator.broadcastGameState({
            type: 'shove',
            success: false,
            attackerId: getPlayerGlobalId(defender),
            victimId: getPlayerGlobalId(victim),
            cooldowns: {
                attackerAttempt: defender.playerData.shoveAttemptCooldown,
                attackerStun: defender.playerData.shoveFailureStun
            },
            timestamp: Date.now()
        });
    }

    try {
        log(LOG_DEBUG, defender.playerData.name + " failed shove attempt - stunned for " + SHOVE_FAILURE_STUN + " frames");
    } catch (e) { }

    return false;
}

/**
 * Create loose ball after successful shove
 * Animates ball bouncing away from shove, triggers rebound scramble
 */
function createLooseBall(defender, victim, systems) {
    var stateManager = systems.stateManager;

    var ballX = stateManager.get('ballX');
    var ballY = stateManager.get('ballY');
    var startX = ballX || (victim ? victim.x + 2 : defender.x);
    var startY = ballY || (victim ? victim.y + 2 : defender.y);
    var dirX = victim ? (victim.x - defender.x) : 1;
    var dirY = victim ? (victim.y - defender.y) : 0;
    if (dirX === 0 && dirY === 0) dirX = 1;

    var magnitude = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    dirX /= magnitude;
    dirY /= magnitude;

    var horizontalPush = (typeof LOOSE_BALL_SETTINGS.horizontalTiles === "number") ? LOOSE_BALL_SETTINGS.horizontalTiles : 6;
    var verticalPush = (typeof LOOSE_BALL_SETTINGS.verticalTiles === "number") ? LOOSE_BALL_SETTINGS.verticalTiles : 3;
    var endX = clampToCourtX(Math.round(startX + dirX * horizontalPush));
    var endY = clampToCourtY(Math.round(startY + dirY * verticalPush));

    var skipAnimation = mpCoordinator && mpCoordinator.isCoordinator;
    if (!skipAnimation) {
        // Store the intended bounce path for future animation-system handling.
        var steps = Math.max(1, (typeof LOOSE_BALL_SETTINGS.arcSteps === "number" ? LOOSE_BALL_SETTINGS.arcSteps : 8));
        var arcHeight = (typeof LOOSE_BALL_SETTINGS.arcHeight === "number") ? LOOSE_BALL_SETTINGS.arcHeight : 2;
        var path = [];
        for (var i = 0; i <= steps; i++) {
            var t = i / steps;
            var bx = Math.round(startX + (endX - startX) * t);
            var by = Math.round(startY + (endY - startY) * t - Math.sin(t * Math.PI) * arcHeight);
            path.push({ x: bx, y: by });
        }
        stateManager.set("looseBallPath", path, "loose_ball_path");
        if (moveBallFrameTo && path.length) {
            var finalPoint = path[path.length - 1];
            moveBallFrameTo(finalPoint.x, finalPoint.y);
        }
    } else if (moveBallFrameTo) {
        moveBallFrameTo(endX, endY);
    }

    debugLog("[LOOSE BALL] Shove created loose ball at x=" + endX + ", y=" + endY + ", calling createRebound()");

    // Clear possession and create rebound scramble
    stateManager.set("ballCarrier", null, "loose_ball_created");
    clearPotentialAssist(systems);

    // Use createRebound() to properly initialize reboundScramble state
    // Pass isLooseBall=true to mark this as a loose ball from shove, not an actual rebound
    // Note: "shove" announcement already fired in attemptShove()
    createRebound(endX, endY, systems, true);

    var newCarrier = stateManager.get("ballCarrier");
    debugLog("[LOOSE BALL] After createRebound: ballCarrier=" + (newCarrier ? (newCarrier.playerData ? newCarrier.playerData.name : "no-name") : "NULL (expected - scramble will resolve)"));
}
