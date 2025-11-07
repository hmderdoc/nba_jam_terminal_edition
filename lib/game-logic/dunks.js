/**
 * Dunk System - Dunk mechanics, animations, and contest logic
 * 
 * Functions:
 * - evaluateDunkOpportunity() - Determine if shot should be dunk attempt
 * - calculateDunkChance() - Dunk success probability
 * - selectDunkStyle() - Choose dunk animation style
 * - generateDunkFlight() - Calculate dunk flight path with arcs and timing
 * - animateDunk() - Full dunk animation with blocking detection
 * - autoContestDunk() - AI defenders auto-contest dunks
 * - maybeBlockDunk() - Block detection during dunk flight
 * - executeShot() - Multiplayer coordinator instant shot execution
 * - Helper functions for dunk visuals and positioning
 * 
 * Dependencies: game-state, player-class, constants, rendering
 */

load("sbbsdefs.js");

// Dunk label words for visual effects
var DUNK_LABEL_WORDS = ["SLAM!", "BOOM!", "JAM!", "FLY!", "YEAH!"];

/**
 * Get dunk label text based on style
 * @param {string} style - Dunk style (standard, power, hang, etc.)
 * @param {number} tick - Current game tick for animation
 * @returns {string} Label text
 */
function getDunkLabelText(style, tick) {
    var words = DUNK_LABEL_WORDS;
    if (style === "hang") {
        words = ["HANG!", "GLIDE", "SOAR!"];
    } else if (style === "power") {
        words = ["POWER", "BOOM!", "CRUSH"];
    }
    var index = ((tick || 0) % words.length + words.length) % words.length;
    return words[index];
}

/**
 * Get dunk flash color palette for player's team
 * @param {Object} player - Player sprite
 * @returns {Array} Color palette array
 */
function getDunkFlashPalette(player) {
    var teamKey = getPlayerTeamName(player);
    var base = getTeamBaselineColors(teamKey) || { fg: WHITE, bg: BG_BLACK };
    var bg = (typeof base.bg === "number") ? base.bg : BG_BLACK;
    return [
        base.fg | bg,
        WHITE | bg,
        YELLOW | bg,
        LIGHTRED | bg
    ];
}

/**
 * Compute shot animation timing parameters
 * @param {number} startX - Shot start X
 * @param {number} startY - Shot start Y
 * @param {number} targetX - Target X
 * @param {number} targetY - Target Y
 * @returns {Object} Timing parameters
 */
function computeShotAnimationTiming(startX, startY, targetX, targetY) {
    var dx = targetX - startX;
    var dy = targetY - startY;
    var distance = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(15, Math.round(distance * 1.5));
    var msPerStep = Math.max(16, Math.round(800 / steps));
    return {
        steps: steps,
        msPerStep: msPerStep,
        durationMs: steps * msPerStep,
        distance: distance
    };
}

/**
 * Check if player is inside the dunk key (restricted area)
 * @param {number} centerX - Player center X
 * @param {number} targetX - Basket X
 * @param {number} attackDir - Attack direction (1 or -1)
 * @returns {boolean} True if inside key
 */
function isInsideDunkKey(centerX, targetX, attackDir) {
    if (attackDir > 0) {
        return centerX >= (targetX - KEY_DEPTH);
    }
    return centerX <= (targetX + KEY_DEPTH);
}

/**
 * Evaluate if player should attempt a dunk
 * @param {Object} player - Player sprite
 * @param {string} teamName - "teamA" or "teamB"
 * @param {number} targetX - Basket X
 * @param {number} targetY - Basket Y
 * @param {number} scaledDistance - Scaled distance to basket
 * @returns {Object|null} Dunk info object or null if not dunk opportunity
 */
function evaluateDunkOpportunity(player, teamName, targetX, targetY, scaledDistance) {
    if (!player || !player.playerData) return null;
    if (scaledDistance > THREE_POINT_RADIUS) return null;

    var attackDir = teamName === "teamA" ? 1 : -1;
    var playerData = player.playerData;

    var spriteHalfWidth = 2;
    var spriteHalfHeight = 2;
    if (player.frame) {
        if (typeof player.frame.width === "number") {
            spriteHalfWidth = Math.floor(player.frame.width / 2);
        }
        if (typeof player.frame.height === "number") {
            spriteHalfHeight = Math.floor(player.frame.height / 2);
        }
    }

    var centerX = player.x + spriteHalfWidth;
    var centerY = player.y + spriteHalfHeight;

    // Must be attacking toward the rim (not behind it)
    if ((attackDir > 0 && centerX >= targetX) || (attackDir < 0 && centerX <= targetX)) {
        return null;
    }

    var absDx = Math.abs(targetX - centerX);
    if (absDx > KEY_DEPTH + 4) return null;

    var insideKey = isInsideDunkKey(centerX, targetX, attackDir);
    var adjustedDy = Math.abs(targetY - centerY) * (insideKey ? 1 : 2);
    var adjustedDistance = Math.sqrt(absDx * absDx + adjustedDy * adjustedDy);

    var rawDunkSkill = getBaseAttribute(playerData, ATTR_DUNK);
    var effectiveDunkSkill = getEffectiveAttribute(playerData, ATTR_DUNK);
    if (!playerData.onFire && rawDunkSkill <= 2 && !insideKey) {
        return null; // low dunkers must be in the restricted area
    }

    var dunkRange = DUNK_DISTANCE_BASE + effectiveDunkSkill * DUNK_DISTANCE_PER_ATTR;
    if (!playerData.onFire && rawDunkSkill <= 3) {
        dunkRange -= (4 - rawDunkSkill) * 0.4;
    }
    if (dunkRange < DUNK_MIN_DISTANCE) dunkRange = DUNK_MIN_DISTANCE;
    if (adjustedDistance > dunkRange) return null;

    var flightSkillFactor = clamp((effectiveDunkSkill + 1) / 11, 0.4, 1.05);
    var baseSkillFactor = clamp((rawDunkSkill + 1) / 11, 0.3, 1.0);

    return {
        attackDir: attackDir,
        adjustedDistance: adjustedDistance,
        absDx: absDx,
        absDy: Math.abs(targetY - centerY),
        insideKey: insideKey,
        centerX: centerX,
        centerY: centerY,
        spriteHalfWidth: spriteHalfWidth,
        spriteHalfHeight: spriteHalfHeight,
        dunkRange: dunkRange,
        dunkSkill: effectiveDunkSkill,
        rawDunkSkill: rawDunkSkill,
        flightSkillFactor: flightSkillFactor,
        baseSkillFactor: baseSkillFactor
    };
}

/**
 * Calculate dunk success chance
 * @param {Object} playerData - Player data
 * @param {Object} dunkInfo - Dunk opportunity info
 * @param {Object} closestDefender - Nearest defender
 * @param {string} teamName - "teamA" or "teamB"
 * @returns {number} Dunk chance (0-100)
 */
function calculateDunkChance(playerData, dunkInfo, closestDefender, teamName) {
    var effectiveDunkSkill = getEffectiveAttribute(playerData, ATTR_DUNK);
    var rawDunkSkill = dunkInfo ? dunkInfo.rawDunkSkill : getBaseAttribute(playerData, ATTR_DUNK);
    var baseChance = 48 + effectiveDunkSkill * 5;

    if (!playerData.onFire && rawDunkSkill <= 2) {
        baseChance -= (3 - rawDunkSkill) * 6;
    }

    if (dunkInfo.adjustedDistance < GAME_BALANCE.DUNKS.CLOSE_DUNK_DISTANCE) baseChance += 6;
    if (!dunkInfo.insideKey) baseChance -= 4;
    if (dunkInfo.adjustedDistance > (dunkInfo.dunkRange - 0.5)) {
        baseChance -= (dunkInfo.adjustedDistance - (dunkInfo.dunkRange - 0.5)) * 8;
    }

    if (closestDefender) {
        var defenderHalfWidth = 2;
        var defenderHalfHeight = 2;
        if (closestDefender.frame) {
            if (typeof closestDefender.frame.width === "number") {
                defenderHalfWidth = Math.floor(closestDefender.frame.width / 2);
            }
            if (typeof closestDefender.frame.height === "number") {
                defenderHalfHeight = Math.floor(closestDefender.frame.height / 2);
            }
        }
        var defenderCenterX = closestDefender.x + defenderHalfWidth;
        var defenderCenterY = closestDefender.y + defenderHalfHeight;
        var separation = distanceBetweenPoints(defenderCenterX, defenderCenterY, dunkInfo.centerX, dunkInfo.centerY);
        var blockAttr = closestDefender.playerData
            ? getEffectiveAttribute(closestDefender.playerData, ATTR_BLOCK)
            : 0;
        var defensePenalty = Math.max(0, (6 - separation)) * (2 + blockAttr * 0.6);
        baseChance -= defensePenalty;
    }

    baseChance += (playerData.heatStreak || 0) * 4;
    if (playerData && playerData.onFire) {
        baseChance += 10;
    }

    if (baseChance < 25) baseChance = 25;
    if (baseChance > 98) baseChance = 98;
    return baseChance;
}

/**
 * Select dunk style based on player skill and situation
 * @param {Object} playerData - Player data
 * @param {Object} dunkInfo - Dunk opportunity info
 * @returns {string} Dunk style (standard, power, glide, hang, windmill)
 */
function selectDunkStyle(playerData, dunkInfo) {
    var dunkSkill = playerData ? getEffectiveAttribute(playerData, ATTR_DUNK) : 0;
    var rawSkill = playerData ? getBaseAttribute(playerData, ATTR_DUNK) : 0;

    var weights = {
        standard: 2.2,
        power: 1.4
    };

    if (rawSkill >= 6 || playerData.onFire) {
        weights.glide = (weights.glide || 0) + (1 + ((dunkSkill) - 5) * 0.45);
    }
    if (rawSkill >= 7 || playerData.onFire) {
        weights.hang = (weights.hang || 0) + (0.8 + ((dunkSkill) - 6) * 0.35);
    }
    if (rawSkill >= 8 || playerData.onFire) {
        weights.windmill = (weights.windmill || 0) + (0.7 + ((dunkSkill) - 7) * 0.3);
    }

    if (!dunkInfo.insideKey) {
        weights.glide = (weights.glide || 0) + 0.9;
        weights.windmill = (weights.windmill || 0) + 0.6;
    }

    if (dunkInfo.adjustedDistance < 3.5) {
        weights.power += 0.6;
    }

    var styles = [];
    var totalWeight = 0;
    for (var key in weights) {
        if (!weights.hasOwnProperty(key)) continue;
        var weight = weights[key];
        if (weight <= 0) continue;
        styles.push({ style: key, weight: weight });
        totalWeight += weight;
    }

    if (!styles.length || totalWeight <= 0) {
        return "standard";
    }

    var roll = Math.random() * totalWeight;
    var cumulative = 0;
    for (var i = 0; i < styles.length; i++) {
        cumulative += styles[i].weight;
        if (roll <= cumulative) {
            return styles[i].style;
        }
    }

    return styles[0].style || "standard";
}

/**
 * Generate dunk flight path with animation frames
 * @param {Object} player - Player sprite
 * @param {Object} dunkInfo - Dunk opportunity info
 * @param {number} targetX - Basket X
 * @param {number} targetY - Basket Y
 * @param {string} style - Dunk style
 * @returns {Object} Flight plan with frames array
 */
function generateDunkFlight(player, dunkInfo, targetX, targetY, style) {
    var rimCenterX = targetX;
    var rimCenterY = targetY;
    var startX = dunkInfo.centerX;
    var startY = dunkInfo.centerY;
    var dx = rimCenterX - startX;
    var dy = rimCenterY - startY;
    var travel = Math.sqrt(dx * dx + dy * dy);
    var baseSteps = Math.max(12, Math.round(travel * 3));

    var skillFactor = dunkInfo.flightSkillFactor || 1;
    var rawSkillFactor = dunkInfo.baseSkillFactor || skillFactor;

    var stepsFactor = 1;
    var arcBonus = 0;
    var msBase = 30;
    var apexHold = 0;
    var verticalFloat = 0;
    var lateralWaveAmp = 0;
    var lateralWaveFreq = 1;

    switch (style) {
        case "power":
            stepsFactor = 0.85;
            arcBonus = -0.4;
            msBase = 24;
            break;
        case "glide":
            stepsFactor = 1.25;
            arcBonus = 0.7;
            msBase = 30;
            verticalFloat = 0.12;
            break;
        case "hang":
            stepsFactor = 1.35;
            arcBonus = 1.0;
            msBase = 34;
            apexHold = 3;
            verticalFloat = 0.2;
            break;
        case "windmill":
            stepsFactor = 1.15;
            arcBonus = 0.6;
            msBase = 32;
            lateralWaveAmp = 0.9;
            lateralWaveFreq = 2;
            break;
        default:
            stepsFactor = 1.05;
            arcBonus = 0.2;
            msBase = 30;
            break;
    }

    var stepScale = clamp(0.8 + skillFactor * 0.35, 0.7, 1.2);
    var steps = Math.max(10, Math.round(baseSteps * stepsFactor * stepScale));
    var arcScale = clamp(0.6 + skillFactor * 0.6, 0.7, 1.35);
    var minArc = DUNK_ARC_HEIGHT_MIN * clamp(0.65 + rawSkillFactor * 0.5, 0.6, 1.4);
    var rawArc = 1.25 + travel * 0.65 + arcBonus;
    var arcHeight = Math.max(
        minArc,
        Math.min((DUNK_ARC_HEIGHT_MAX + arcBonus) * arcScale, rawArc * arcScale)
    );

    var frames = [];
    var apexIndex = 0;
    var apexY = Infinity;

    for (var i = 1; i <= steps; i++) {
        var t = i / steps;
        var ease;
        if (style === "power") {
            ease = Math.pow(t, 0.78);
        } else if (style === "hang") {
            ease = t - Math.sin(t * Math.PI) * 0.08;
        } else if (style === "glide") {
            ease = t * t * (3 - 2 * t) + Math.sin(t * Math.PI) * 0.03;
        } else {
            ease = t * t * (3 - 2 * t);
        }
        if (ease < 0) ease = 0;
        if (ease > 1) ease = 1;

        var sineFactor = ease;
        if (verticalFloat) {
            sineFactor += verticalFloat * Math.sin(t * Math.PI);
            if (sineFactor > 1) sineFactor = 1;
            if (sineFactor < 0) sineFactor = 0;
        }

        var lateral = 0;
        if (lateralWaveAmp) {
            lateral = lateralWaveAmp * Math.sin(t * Math.PI * lateralWaveFreq);
        }

        var currentX = startX + dx * ease + lateral * dunkInfo.attackDir;
        var currentY = startY + dy * ease - Math.sin(sineFactor * Math.PI) * arcHeight;

        var ms = msBase;
        if (style === "hang" && t > 0.4 && t < 0.8) {
            ms += 12;
        } else if (style === "glide") {
            ms += Math.round(Math.sin(t * Math.PI) * 4);
        } else if (style === "windmill") {
            ms += Math.round(Math.sin(t * Math.PI) * 6);
        }
        if (style === "power" && t > 0.8) {
            ms -= 2;
        }
        if (ms < 18) ms = 18;
        ms = Math.round(ms);

        var frame = {
            centerX: currentX,
            centerY: currentY,
            progress: ease,
            t: t,
            ms: ms,
            ballOffsetX: 0,
            ballOffsetY: 0
        };

        if (style === "windmill") {
            frame.ballOffsetX = Math.sin(t * Math.PI) * dunkInfo.attackDir;
            frame.ballOffsetY = Math.cos(t * Math.PI) * 0.4;
        } else if (style === "hang") {
            frame.ballOffsetY = Math.sin(t * Math.PI) * -0.25;
        }

        frames.push(frame);

        if (currentY < apexY) {
            apexY = currentY;
            apexIndex = frames.length - 1;
        }
    }

    if (apexHold > 0 && frames.length) {
        var apexFrame = frames[apexIndex];
        var holdFrames = [];
        for (var h = 0; h < apexHold; h++) {
            holdFrames.push({
                centerX: apexFrame.centerX,
                centerY: apexFrame.centerY - (h % 2 === 0 ? 0 : 0.1),
                progress: apexFrame.progress,
                t: apexFrame.t,
                ms: Math.max(34, msBase + 10),
                ballOffsetX: apexFrame.ballOffsetX,
                ballOffsetY: apexFrame.ballOffsetY,
                hang: true
            });
        }
        frames = frames.slice(0, apexIndex + 1).concat(holdFrames, frames.slice(apexIndex + 1));
    }

    return {
        style: style,
        frames: frames,
        arcHeight: arcHeight,
        rimX: rimCenterX,
        rimY: rimCenterY
    };
}

/**
 * Auto-contest dunk - AI defenders jump to block
 * @param {Object} dunker - Player attempting dunk
 * @param {Object} dunkInfo - Dunk info
 * @param {number} targetX - Basket X
 * @param {number} targetY - Basket Y
 * @param {string} style - Dunk style
 */
function autoContestDunk(dunker, dunkInfo, targetX, targetY, style) {
    var teamName = getPlayerTeamName(dunker);
    if (!teamName) return;

    var defenders = getOpposingTeamSprites(teamName);
    if (!defenders || !defenders.length) return;

    var best = null;
    var bestScore = -Infinity;

    for (var i = 0; i < defenders.length; i++) {
        var defender = defenders[i];
        if (!defender || defender.isHuman || !defender.playerData) continue;
        var distToDunker = getSpriteDistance(defender, dunker);
        var distToRim = distanceBetweenPoints(defender.x, defender.y, targetX, targetY);
        var blockAttr = defender.playerData ? getEffectiveAttribute(defender.playerData, ATTR_BLOCK) : 0;
        var score = (16 - distToDunker) * 1.4 + (12 - distToRim) * 0.9 + blockAttr * 2.1;
        if (defender.playerData.turbo > 6) {
            score += 1.5;
        }
        if (score > bestScore) {
            bestScore = score;
            best = defender;
        }
    }

    if (!best) return;

    var durationBoost = 0;
    var heightBoost = 0;
    if (style === "hang") {
        durationBoost = 6;
        heightBoost = 1.2;
    } else if (style === "glide") {
        durationBoost = 4;
        heightBoost = 0.8;
    } else if (style === "windmill") {
        durationBoost = 3;
        heightBoost = 0.6;
    } else if (style === "power") {
        durationBoost = 2;
    }

    if (best.playerData.turbo > 10) {
        activateAITurbo(best, 0.9, getSpriteDistance(best, dunker));
    } else if (best.playerData.turbo > GAME_BALANCE.DUNKS.TURBO_DUNK_THRESHOLD && Math.random() < GAME_BALANCE.DUNKS.DUNK_REBOUND_BOUNCE_PROB) {
        activateAITurbo(best, 0.75, getSpriteDistance(best, dunker));
    }

    attemptBlock(best, {
        duration: BLOCK_JUMP_DURATION + durationBoost,
        heightBoost: heightBoost,
        direction: dunker.x >= best.x ? 1 : -1
    });
}

/**
 * Check for block during dunk animation
 * @param {Object} dunker - Player dunking
 * @param {Object} frameData - Current dunk frame data
 * @param {Object} dunkInfo - Dunk info
 * @param {string} style - Dunk style
 * @returns {Object|null} Block result or null
 */
function maybeBlockDunk(dunker, frameData, dunkInfo, style) {
    if (!gameState.activeBlock || gameState.blockJumpTimer <= 0) return null;
    var blocker = gameState.activeBlock;
    if (!blocker || !blocker.playerData) return null;

    var blockerWidth = (blocker.frame && blocker.frame.width) ? blocker.frame.width : 4;
    var blockerCenterX = blocker.x + Math.floor(blockerWidth / 2);
    var blockerReachY = blocker.y + 1;
    var separation = distanceBetweenPoints(blockerCenterX, blockerReachY, frameData.handX, frameData.handY);
    if (separation > 3.6) return null;

    var blockAttr = blocker.playerData ? getEffectiveAttribute(blocker.playerData, ATTR_BLOCK) : 0;
    var dunkAttr = dunker.playerData ? getEffectiveAttribute(dunker.playerData, ATTR_DUNK) : 0;

    var baseChance = 34 + blockAttr * 7;
    baseChance += Math.max(0, (3.6 - separation)) * 11;
    if (!dunkInfo.insideKey) baseChance += 5;
    if (frameData.progress > 0.55) baseChance += 6;
    if (style === "power") baseChance += 6;
    if (style === "hang") baseChance -= 7;
    if (style === "glide") baseChance -= 2;

    baseChance -= dunkAttr * 4;
    if (dunker.playerData && dunker.playerData.turboActive && dunker.playerData.turbo > 0) {
        baseChance -= 4;
    }

    baseChance = clamp(baseChance, 12, 92);

    if (Math.random() * 100 < baseChance) {
        gameState.lastBlocker = blocker;
        return { blocker: blocker };
    }

    return null;
}

/**
 * Animate full dunk with flight path and blocking
 * @param {Object} player - Player dunking
 * @param {Object} dunkInfo - Dunk info
 * @param {number} targetX - Basket X
 * @param {number} targetY - Basket Y
 * @param {boolean} made - Whether dunk succeeds
 * @returns {Object} Dunk result
 */
function animateDunk(player, dunkInfo, targetX, targetY, made) {
    gameState.shotInProgress = true;
    gameState.shotStartX = player.x;
    gameState.shotStartY = player.y;

    var playerData = player.playerData || {};
    var style = selectDunkStyle(playerData, dunkInfo);
    var flightPlan = generateDunkFlight(player, dunkInfo, targetX, targetY, style);
    autoContestDunk(player, dunkInfo, targetX, targetY, style);

    // Broadcast dunk animation to other players (coordinator only)
    if (mpCoordinator && mpCoordinator.isCoordinator) {
        mpCoordinator.broadcastEvent("dunk", {
            player: getPlayerGlobalId(player),
            targetX: targetX,
            targetY: targetY,
            made: made,
            style: style
        });
    }

    var attackDir = dunkInfo.attackDir;
    var spriteWidth = (player.frame && player.frame.width) ? player.frame.width : 4;
    var spriteHeight = (player.frame && player.frame.height) ? player.frame.height : 4;
    var groundBottom = player.y + spriteHeight;

    clearJumpIndicator(player);
    player.prevJumpBottomY = groundBottom;

    var blocked = false;
    var blockingDefender = null;

    for (var i = 0; i < flightPlan.frames.length; i++) {
        var frame = flightPlan.frames[i];
        var spriteX = clampToCourtX(Math.round(frame.centerX) - dunkInfo.spriteHalfWidth);
        var spriteY = clampToCourtY(Math.round(frame.centerY) - dunkInfo.spriteHalfHeight);
        player.moveTo(spriteX, spriteY);
        if (typeof player.turnTo === "function") {
            player.turnTo(attackDir > 0 ? "e" : "w");
        }

        var flashPalette = getDunkFlashPalette(player);
        var flashText = getDunkLabelText(style, gameState.tickCounter + i);
        renderPlayerLabel(player, {
            highlightCarrier: false,
            forcedText: flashText,
            flashPalette: flashPalette,
            flashTick: gameState.tickCounter + i,
            forceTop: true
        });

        var handOffsetX = attackDir > 0 ? dunkInfo.spriteHalfWidth : -dunkInfo.spriteHalfWidth;
        var handX = clamp(Math.round(frame.centerX + handOffsetX + (frame.ballOffsetX || 0)), 1, COURT_WIDTH);
        var handY = clamp(Math.round(frame.centerY + dunkInfo.spriteHalfHeight - 1 + (frame.ballOffsetY || 0)), 1, COURT_HEIGHT);

        moveBallFrameTo(handX, handY);
        gameState.ballX = handX;
        gameState.ballY = handY;

        var currentBottom = spriteY + spriteHeight;
        var prevBottom = (typeof player.prevJumpBottomY === "number") ? player.prevJumpBottomY : groundBottom;
        var ascending = currentBottom <= prevBottom;
        updateJumpIndicator(player, {
            groundBottom: groundBottom,
            currentBottom: currentBottom,
            ascending: ascending,
            horizontalDir: attackDir,
            spriteWidth: spriteWidth,
            spriteHeight: spriteHeight,
            spriteHalfWidth: dunkInfo.spriteHalfWidth,
            spriteHalfHeight: dunkInfo.spriteHalfHeight,
            flightFrames: flightPlan.frames,
            frameIndex: i
        });
        player.prevJumpBottomY = currentBottom;

        var blockCheck = maybeBlockDunk(player, {
            handX: handX,
            handY: handY,
            centerX: frame.centerX,
            centerY: frame.centerY,
            progress: frame.progress
        }, dunkInfo, style);

        Sprite.cycle();
        cycleFrame(courtFrame);

        if (blockCheck) {
            blocked = true;
            blockingDefender = blockCheck.blocker;
            made = false;
            mswait(frame.ms || 30);
            break;
        }

        mswait(frame.ms || 30);
    }

    clearJumpIndicator(player);
    player.prevJumpBottomY = null;

    if (blocked) {
        if (blockingDefender && blockingDefender.playerData && blockingDefender.playerData.stats) {
            blockingDefender.playerData.stats.blocks = (blockingDefender.playerData.stats.blocks || 0) + 1;
        }

        var knockbackX = clampToCourtX(player.x - attackDir * 2);
        var knockbackY = clampToCourtY(player.y + 1);
        player.moveTo(knockbackX, knockbackY);
        if (typeof player.turnTo === "function") {
            player.turnTo(attackDir > 0 ? "e" : "w");
        }

        renderPlayerLabel(player, { highlightCarrier: true, forceTop: true });

        var deflectX = clamp(targetX - attackDir * (2 + Math.round(Math.random() * 2)), 1, COURT_WIDTH);
        var deflectY = clamp(targetY + 2 + Math.round(Math.random() * 2), 1, COURT_HEIGHT);
        moveBallFrameTo(deflectX, deflectY);
        gameState.ballX = deflectX;
        gameState.ballY = deflectY;
        Sprite.cycle();
        cycleFrame(courtFrame);
        mswait(70);

        gameState.reboundActive = true;
        gameState.ballCarrier = null;
        gameState.reboundX = deflectX;
        gameState.reboundY = deflectY;
        gameState.shotInProgress = false;
        clearPotentialAssist();

        return { made: false, blocked: true, blocker: blockingDefender, style: style, ballX: deflectX, ballY: deflectY };
    }

    var finishX = clampToCourtX(targetX - attackDir * 2 - dunkInfo.spriteHalfWidth + 2);
    var finishY = clampToCourtY(targetY - dunkInfo.spriteHalfHeight);
    player.moveTo(finishX, finishY);
    if (typeof player.turnTo === "function") {
        player.turnTo(attackDir > 0 ? "e" : "w");
    }

    renderPlayerLabel(player, { highlightCarrier: true, forceTop: true });

    if (made) {
        for (var drop = 0; drop < 3; drop++) {
            var dropY = clamp(targetY + drop, 1, COURT_HEIGHT);
            moveBallFrameTo(targetX, dropY);
            gameState.ballX = targetX;
            gameState.ballY = dropY;
            Sprite.cycle();
            cycleFrame(courtFrame);
            mswait(45);
        }
        moveBallFrameTo(targetX, clamp(targetY + 3, 1, COURT_HEIGHT));
        gameState.ballX = targetX;
        gameState.ballY = clamp(targetY + 3, 1, COURT_HEIGHT);
        mswait(80);
    } else {
        moveBallFrameTo(targetX, targetY);
        gameState.ballX = targetX;
        gameState.ballY = targetY;
        Sprite.cycle();
        cycleFrame(courtFrame);
        mswait(60);
        var ricochetX = clamp(targetX - attackDir * 2, 1, COURT_WIDTH);
        var ricochetY = clamp(targetY + 2, 1, COURT_HEIGHT);
        moveBallFrameTo(ricochetX, ricochetY);
        gameState.ballX = ricochetX;
        gameState.ballY = ricochetY;
        Sprite.cycle();
        cycleFrame(courtFrame);
        mswait(80);
        moveBallFrameTo(targetX, targetY + 1);
        gameState.ballX = targetX;
        gameState.ballY = targetY + 1;
    }

    renderPlayerLabel(player, { highlightCarrier: true, forceTop: true });

    gameState.shotInProgress = false;
    return { made: made, blocked: false, style: style };
}

/**
 * Execute shot with pure game logic (no rendering/blocking)
 * Used by multiplayer coordinator for instant state updates
 * @param {Object} shooter - Player taking shot
 * @param {number} shotStartX - Shot start X
 * @param {number} shotStartY - Shot start Y
 * @param {number} targetX - Basket X
 * @param {number} targetY - Basket Y
 * @returns {Object} Shot result
 */
function executeShot(shooter, shotStartX, shotStartY, targetX, targetY) {
    if (!shooter || !shooter.playerData) {
        return { made: false, blocked: false, points: 0 };
    }

    var playerData = shooter.playerData;
    var shooterTeam = getPlayerTeamName(shooter) || gameState.currentTeam;
    var attackDir = shooterTeam === "teamA" ? 1 : -1;

    // Calculate distances
    var rawDx = shooter.x - targetX;
    var rawDy = shooter.y - targetY;
    var scaledDy = rawDy * 2;
    var scaledDistance = Math.sqrt(rawDx * rawDx + scaledDy * scaledDy);
    var planarDistance = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    var distance = planarDistance;

    // Determine shot type
    var is3Pointer = scaledDistance > THREE_POINT_RADIUS;
    var isCornerThree = isCornerThreePosition(shooter, shooterTeam);
    var shotTiming = computeShotAnimationTiming(shotStartX, shotStartY, targetX, targetY);

    // Update stats
    if (playerData.stats) {
        playerData.stats.fga++;
        if (is3Pointer) playerData.stats.tpa++;
    }

    // Get closest defender
    var closestDefender = getClosestPlayer(shooter.x, shooter.y, shooterTeam === "teamA" ? "teamB" : "teamA");
    if (!closestDefender) {
        closestDefender = {
            x: targetX - attackDir * 4,
            y: targetY,
            playerData: null
        };
    }

    // Calculate shot chance
    var threeAttr = getEffectiveAttribute(playerData, ATTR_3PT);
    var dunkAttr = getEffectiveAttribute(playerData, ATTR_DUNK);
    var baseChance;

    if (is3Pointer) {
        baseChance = 40 + (threeAttr * 4);
    } else if (distance < 10) {
        baseChance = 60 + (dunkAttr * 3);
    } else {
        baseChance = 50 + ((dunkAttr + threeAttr) * 2);
    }

    if (isCornerThree) {
        baseChance += 6;
    }

    var distancePenalty = is3Pointer ?
        (scaledDistance - THREE_POINT_RADIUS) * 1.5 :
        (planarDistance - 3) * 0.8;
    if (distancePenalty < 0) distancePenalty = 0;
    if (isCornerThree && is3Pointer) {
        distancePenalty *= 0.6;
    }

    var chance = baseChance - distancePenalty;
    if (chance < 20) chance = 20;
    if (chance > 95) chance = 95;

    chance += playerData.heatStreak * 5;

    if (playerData.onFire) {
        chance += 15;
        if (chance > 99) chance = 99;
    }

    // Defender penalty
    var dx = Math.abs(shooter.x - closestDefender.x);
    var dy = Math.abs(shooter.y - closestDefender.y);
    var defenseDistance = Math.sqrt(dx * dx + dy * dy);

    if (defenseDistance < 8) {
        var defenderData = closestDefender.playerData;
        var defensePenalty = (8 - defenseDistance) * (2 + (defenderData ? getEffectiveAttribute(defenderData, ATTR_BLOCK) * 0.5 : 2));

        var relX = (closestDefender.x - shooter.x) * attackDir;
        var relY = Math.abs(closestDefender.y - shooter.y);
        var directionalFactor = relX >= 0 ? 1 : Math.max(0.25, 1 + (relX / 6));
        var lateralFactor = Math.max(0.35, 1 - (relY / 10));
        var coverageFactor = Math.max(0.2, Math.min(1, directionalFactor * lateralFactor));
        defensePenalty *= coverageFactor;
        chance -= defensePenalty;
        if (chance < 15) chance = 15;
    }

    // Determine result
    var made = Math.random() * 100 < chance;
    var blocked = false;

    // Estimate rebound position for AI positioning
    var estimatedReboundX = targetX + (Math.random() * 12 - 6);
    var estimatedReboundY = targetY + (Math.random() * 8 - 4);
    estimatedReboundX = Math.max(3, Math.min(COURT_WIDTH - 3, estimatedReboundX));
    estimatedReboundY = Math.max(3, Math.min(COURT_HEIGHT - 3, estimatedReboundY));

    gameState.reboundScramble.anticipating = true;
    gameState.reboundScramble.anticipatedX = estimatedReboundX;
    gameState.reboundScramble.anticipatedY = estimatedReboundY;

    // Check for block
    if (gameState.activeBlock && gameState.blockJumpTimer > 0) {
        var blocker = gameState.activeBlock;
        var blockDist = Math.sqrt(Math.pow(blocker.x - shotStartX, 2) + Math.pow(blocker.y - shotStartY, 2));

        if (blockDist < 4) {
            var blockChance = getEffectiveAttribute(blocker.playerData, ATTR_BLOCK) * 8 + 20;
            if (Math.random() * 100 < blockChance) {
                blocked = true;
                made = false;
                if (blocker.playerData && blocker.playerData.stats) {
                    blocker.playerData.stats.blocks++;
                }
                announceEvent("block", {
                    playerName: blocker.playerData.name,
                    player: blocker,
                    team: getPlayerTeamName(blocker)
                });
            }
        }
    }

    // Update game state
    gameState.shotInProgress = false;
    gameState.ballCarrier = null;

    if (made && !blocked) {
        // Score!
        var points = is3Pointer ? 3 : 2;
        gameState.score[gameState.currentTeam] += points;
        gameState.consecutivePoints[gameState.currentTeam]++;
        playerData.heatStreak++;
        if (typeof playerData.fireMakeStreak !== "number") playerData.fireMakeStreak = 0;
        playerData.fireMakeStreak++;

        if (playerData.stats) {
            playerData.stats.points += points;
            playerData.stats.fgm++;
            if (is3Pointer) playerData.stats.tpm++;
        }

        maybeAwardAssist(shooter);
        clearPotentialAssist();

        // Refill turbo
        var scoringSprites = spriteRegistry.getByTeam(shooterTeam);
        for (var i = 0; i < scoringSprites.length; i++) {
            if (scoringSprites[i] && scoringSprites[i].playerData) {
                scoringSprites[i].playerData.turbo = MAX_TURBO;
            }
        }
        var inboundTeam = shooterTeam === "teamA" ? "teamB" : "teamA";
        var inboundSprites = spriteRegistry.getByTeam(inboundTeam);
        for (var j = 0; j < inboundSprites.length; j++) {
            if (inboundSprites[j] && inboundSprites[j].playerData) {
                inboundSprites[j].playerData.turbo = MAX_TURBO;
            }
        }

        // Announcer
        if (is3Pointer) {
            announceEvent("three_pointer", {
                playerName: playerData.name,
                player: shooter,
                team: shooterTeam
            });
        } else {
            announceEvent("shot_made", {
                playerName: playerData.name,
                player: shooter,
                team: shooterTeam
            });
        }

        // Check for ON FIRE
        if (!playerData.onFire && playerData.fireMakeStreak >= 3) {
            setPlayerOnFire(shooter);
            announceEvent("on_fire", {
                playerName: playerData.name,
                player: shooter,
                team: shooterTeam
            });
        }

        // Reset opponent streak
        gameState.consecutivePoints[inboundTeam] = 0;
        clearTeamOnFire(inboundTeam);
        gameState.reboundScramble.anticipating = false;

        triggerPossessionBeep();
        startScoreFlash(shooterTeam, inboundTeam);

        // Broadcast animation event
        if (mpCoordinator && mpCoordinator.isCoordinator) {
            mpCoordinator.broadcastEvent("shot_executed", {
                shooter: getPlayerGlobalId(shooter),
                startX: shotStartX,
                startY: shotStartY,
                targetX: targetX,
                targetY: targetY,
                made: true,
                blocked: false,
                is3Pointer: is3Pointer,
                points: points,
                durationMs: shotTiming.durationMs
            });

            if (animationSystem) {
                animationSystem.queueShotAnimation(
                    shotStartX,
                    shotStartY,
                    targetX,
                    targetY,
                    true,
                    false,
                    shooter,
                    shotTiming.durationMs,
                    null
                );
            }
        }

        return { made: true, blocked: false, points: points, is3Pointer: is3Pointer };
    } else {
        // Miss
        gameState.consecutivePoints[gameState.currentTeam] = 0;
        playerData.heatStreak = 0;
        gameState.reboundActive = true;

        if (!blocked) {
            announceEvent("shot_missed", {
                playerName: playerData.name,
                player: shooter,
                team: shooterTeam
            });
            clearPotentialAssist();
        }

        // Calculate rebound bounces for animation
        var reboundBounces = null;
        if (mpCoordinator && mpCoordinator.isCoordinator) {
            var animBounces = [];
            var calcBounces = Math.random() < 0.5 ? 1 : 2;
            var currentX = targetX;
            var currentY = targetY;

            for (var b = 0; b < calcBounces; b++) {
                var bounceX = currentX + (Math.random() * 8 - 4);
                var bounceY = currentY + (Math.random() * 6 - 3);
                bounceX = Math.max(targetX - 8, Math.min(targetX + 8, bounceX));
                bounceY = Math.max(targetY - 5, Math.min(targetY + 5, bounceY));

                animBounces.push({
                    startX: currentX,
                    startY: currentY,
                    endX: bounceX,
                    endY: bounceY
                });

                currentX = bounceX;
                currentY = bounceY;
            }

            var reboundX = currentX + (Math.random() * 4 - 2);
            var reboundY = currentY + (Math.random() * 3 - 1);
            reboundX = Math.max(2, Math.min(COURT_WIDTH - 2, reboundX));
            reboundY = Math.max(2, Math.min(COURT_HEIGHT - 2, reboundY));

            gameState.reboundX = reboundX;
            gameState.reboundY = reboundY;

            animBounces.push({
                startX: currentX,
                startY: currentY,
                endX: reboundX,
                endY: reboundY
            });

            reboundBounces = animBounces;
        }

        // Broadcast animation event
        if (mpCoordinator && mpCoordinator.isCoordinator) {
            mpCoordinator.broadcastEvent("shot_executed", {
                shooter: getPlayerGlobalId(shooter),
                startX: shotStartX,
                startY: shotStartY,
                targetX: targetX,
                targetY: targetY,
                made: false,
                blocked: blocked,
                is3Pointer: is3Pointer,
                points: 0,
                durationMs: shotTiming.durationMs,
                reboundBounces: reboundBounces
            });

            if (animationSystem) {
                animationSystem.queueShotAnimation(
                    shotStartX,
                    shotStartY,
                    targetX,
                    targetY,
                    false,
                    blocked,
                    shooter,
                    shotTiming.durationMs,
                    reboundBounces
                );
            }
        }

        return { made: false, blocked: blocked, points: 0, is3Pointer: is3Pointer };
    }
}
