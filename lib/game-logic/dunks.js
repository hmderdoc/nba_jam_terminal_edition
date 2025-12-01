/**
 * Dunk System - LEGACY/DEPRECATED CODE
 * 
 * WARNING: Most of this file is NOT USED in Wave 23D+
 * This file now only contains helper utilities still consumed by the
 * shooting/animation systems (e.g. evaluateDunkOpportunity,
 * selectDunkStyle, generateDunkFlight, autoContestDunk). The old
 * blocking animation entry points (`animateDunk`, `executeShot`) have
 * been removed to prevent accidental use.
 * 
 * TODO Wave 25: Extract active functions to utils.
*/

load("sbbsdefs.js");
load("lib/utils/constants.js");
load("lib/config/game-balance.js");
load("lib/game-logic/movement-physics.js");
load("lib/utils/debug-logger.js");

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
function getDunkFlashPalette(player, systems) {
    var teamKey = getPlayerTeamName(player);
    var base = getTeamBaselineColors(teamKey, systems) || { fg: WHITE, bg: BG_BLACK };
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
    if (!player || !player.playerData) {
        debugLog("[DUNK EVAL] Early return: no player or playerData");
        return null;
    }
    if (scaledDistance > THREE_POINT_RADIUS) {
        debugLog("[DUNK EVAL] Early return: scaledDistance=" + scaledDistance + " > THREE_POINT_RADIUS=" + THREE_POINT_RADIUS);
        return null;
    }

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
    // Allow slight overlap to permit dunks right at the rim
    if ((attackDir > 0 && centerX > targetX + 2) || (attackDir < 0 && centerX < targetX - 2)) {
        debugLog("[DUNK EVAL] " + playerData.name + " Early return: behind rim (centerX=" + centerX + ", targetX=" + targetX + ", attackDir=" + attackDir + ")");
        return null;
    }

    var absDx = Math.abs(targetX - centerX);
    if (absDx > KEY_DEPTH + 4) {
        debugLog("[DUNK EVAL] " + playerData.name + " Early return: absDx=" + absDx + " > KEY_DEPTH+4=" + (KEY_DEPTH + 4));
        return null;
    }

    var insideKey = isInsideDunkKey(centerX, targetX, attackDir);
    var adjustedDy = Math.abs(targetY - centerY) * (insideKey ? 1 : 2);
    var adjustedDistance = Math.sqrt(absDx * absDx + adjustedDy * adjustedDy);

    var rawDunkSkill = getBaseAttribute(playerData, ATTR_DUNK);
    var effectiveDunkSkill = getEffectiveAttribute(playerData, ATTR_DUNK);
    if (!playerData.onFire && rawDunkSkill <= 2 && !insideKey) {
        debugLog("[DUNK EVAL] " + playerData.name + " Early return: rawDunkSkill=" + rawDunkSkill + " too low and not insideKey");
        return null; // low dunkers must be in the restricted area
    }

    var dunkRange = DUNK_DISTANCE_BASE + effectiveDunkSkill * DUNK_DISTANCE_PER_ATTR;
    if (!playerData.onFire && rawDunkSkill <= 3) {
        dunkRange -= (4 - rawDunkSkill) * 0.4;
    }
    if (dunkRange < DUNK_MIN_DISTANCE) dunkRange = DUNK_MIN_DISTANCE;
    if (adjustedDistance > dunkRange) {
        debugLog("[DUNK EVAL] " + playerData.name + " Early return: adjustedDistance=" + adjustedDistance.toFixed(1) + " > dunkRange=" + dunkRange.toFixed(1));
        return null;
    }

    debugLog("[DUNK EVAL] " + playerData.name + " SUCCESS: returning dunkInfo (adjustedDistance=" + adjustedDistance.toFixed(1) + ", dunkRange=" + dunkRange.toFixed(1) + ", rawDunkSkill=" + rawDunkSkill + ")");

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

    if (dunkInfo.adjustedDistance < GAME_BALANCE.DUNKS.CLOSE_DUNK_DISTANCE) {
        baseChance += 6;
    }

    if (!dunkInfo.insideKey) baseChance -= 4;

    if (dunkInfo.adjustedDistance > (dunkInfo.dunkRange - 0.5)) {
        var penalty = (dunkInfo.adjustedDistance - (dunkInfo.dunkRange - 0.5)) * 8;
        baseChance -= penalty;
    }

    if (closestDefender && typeof closestDefender.x === "number" && typeof closestDefender.y === "number") {
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
    var rimOffset = (typeof DUNK_RIM_TARGET_OFFSET_X === "number") ? DUNK_RIM_TARGET_OFFSET_X : 0;
    if (rimOffset && dunkInfo && typeof dunkInfo.attackDir === "number" && dunkInfo.attackDir !== 0) {
        rimCenterX = clamp(rimCenterX - (dunkInfo.attackDir * rimOffset), 1, COURT_WIDTH);
    }
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
    var msBase = 60;  // INCREASED from 30 - dunks need to be slower/more visible
    var apexHold = 0;
    var verticalFloat = 0;
    var lateralWaveAmp = 0;
    var lateralWaveFreq = 1;

    switch (style) {
        case "power":
            stepsFactor = 0.85;
            arcBonus = -0.4;
            msBase = 48;  // INCREASED from 24
            break;
        case "glide":
            stepsFactor = 1.25;
            arcBonus = 0.7;
            msBase = 60;  // INCREASED from 30
            verticalFloat = 0.12;
            break;
        case "hang":
            stepsFactor = 1.35;
            arcBonus = 1.0;
            msBase = 68;  // INCREASED from 34
            apexHold = 3;
            verticalFloat = 0.2;
            break;
        case "windmill":
            stepsFactor = 1.15;
            arcBonus = 0.6;
            msBase = 64;  // INCREASED from 32
            lateralWaveAmp = 0.9;
            lateralWaveFreq = 2;
            break;
        default:
            stepsFactor = 1.05;
            arcBonus = 0.2;
            msBase = 60;  // INCREASED from 30
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
 * @param {Object} systems - Systems object for dependency injection
 */
function autoContestDunk(dunker, dunkInfo, targetX, targetY, style, systems) {
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
    }, systems);
}

/**
 * Check for block during dunk animation
 * @param {Object} dunker - Player dunking
 * @param {Object} frameData - Current dunk frame data
 * @param {Object} dunkInfo - Dunk info
 * @param {string} style - Dunk style
 * @returns {Object|null} Block result or null
 */
function maybeBlockDunk(dunker, frameData, dunkInfo, style, systems) {
    var stateManager = systems.stateManager;
    var activeBlock = stateManager.get('activeBlock');
    var blockJumpTimer = stateManager.get('blockJumpTimer');

    var blocker = frameData.blocker;
    if (!blocker) return null;

    if (!activeBlock || blockJumpTimer <= 0) return null;
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
        stateManager.set("lastBlocker", blocker, "dunk_blocked");
        return { blocker: blocker };
    }

    return null;
}

