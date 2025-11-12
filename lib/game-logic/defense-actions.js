/**
 * NBA JAM - Defense Actions Module
 * 
 * Handles all defensive action mechanics including:
 * - Steal attempts (human player)
 * - AI steal attempts
 * - User steal (multiplayer human defense)
 * - Block attempts and animation
 * - Steal recovery (failed steal penalties)
 * 
 * Dependencies:
 * - Game state (gameState with ballCarrier, currentTeam, shotClock, etc.)
 * - Player utilities (getPlayerTeamName, getEffectiveAttribute)
 * - Distance calculations (getSpriteDistance, getSpriteDistanceToBasket)
 * - Game flow (recordTurnover, triggerPossessionBeep, resetBackcourtState, announceEvent)
 * - Stats tracking (stats.steals)
 * - Assist tracking (clearPotentialAssist)
 * - Defense (assignDefensiveMatchups)
 * - Physical play (attemptShove for dead dribble situations)
 * - Player movement (moveTo, getBearingVector)
 * - Court utilities (clampToCourtX, clampToCourtY, COURT_WIDTH)
 * - Jump indicators (clearJumpIndicator)
 * - Constants (ATTR_STEAL, ATTR_POWER, ATTR_SPEED, BLOCK_JUMP_DURATION, DEFENDER_PERIMETER_LIMIT)
 */

/**
 * Attempt steal - human player steals from ball carrier
 * 
 * Success factors:
 * - Distance must be < 6 units
 * - Steal chance = (ATTR_STEAL * 4 - ATTR_POWER * 4 + 10) / 100
 * - Clamped to 5-40%
 * 
 * Success: Award possession, update stats, announce steal
 * Failure: Enter steal recovery (movement penalty)
 */

/**
 * Begin steal recovery - failed steal penalty
 * Applies movement penalty and disables turbo
 * Recovery frames based on speed attribute (8-22 frames)
 * Moves defender backward slightly
 */
function beginStealRecovery(defender, target) {
    if (!defender || !defender.playerData) return;
    var pdata = defender.playerData;
    if (pdata.stealRecoverFrames > 0) return;

    var speedAttr = getEffectiveAttribute(pdata, ATTR_SPEED) || 5;
    var frames = Math.max(8, 22 - (speedAttr * 2));
    pdata.stealRecoverFrames = frames;
    pdata.turboActive = false;

    var dx = 0;
    var dy = 0;
    if (target && typeof target.x === "number" && typeof target.y === "number") {
        dx = Math.sign(defender.x - target.x);
        dy = Math.sign(defender.y - target.y);
    }
    if (dx === 0 && dy === 0) {
        var vec = getBearingVector(defender.bearing);
        dx = -vec.dx;
        dy = -vec.dy;
    }
    if (dx === 0 && dy === 0) {
        dx = defender.x >= Math.floor(COURT_WIDTH / 2) ? 1 : -1;
    }
    var newX = clampToCourtX(defender.x + dx);
    var newY = clampToCourtY(defender.y + dy);
    if (typeof defender.moveTo === "function") {
        defender.moveTo(newX, newY);
    }
}

/**
 * Decrement steal recovery frames - called per frame
 * Automatically decrements stealRecoverFrames if > 0
 */
function decrementStealRecovery(player) {
    if (!player || !player.playerData) return;
    if (player.playerData.stealRecoverFrames > 0) {
        player.playerData.stealRecoverFrames--;
        if (player.playerData.stealRecoverFrames < 0) {
            player.playerData.stealRecoverFrames = 0;
        }
    }
}

/**
 * Attempt block - start block jump animation
 * Only allowed when on defense or during opponent's shot
 * 
 * Sets up block state:
 * - activeBlock sprite
 * - blockJumpTimer (duration frames)
 * - Jump indicators
 * - Jump direction based on shot position
 */
function attemptBlock(blocker, options, systems) {
    var stateManager = systems.stateManager;
    var currentTeam = stateManager.get('currentTeam');
    var shotInProgress = stateManager.get('shotInProgress');
    var shotStartX = stateManager.get('shotStartX');

    if (!blocker || !blocker.playerData) return;

    // Can only block on defense or during a shot
    var blockerTeam = getPlayerTeamName(blocker);
    if (!blockerTeam) return;

    if (blockerTeam === currentTeam && !shotInProgress) {
        // Predictive block: if the client predicts a block, we need to let them.
        // The server will ultimately decide if it was valid.
        if (!options || !options.predictive) {
            announceEvent("crowd_reaction", { team: blockerTeam }, systems);
            return;
        }
    }

    // Start block animation
    stateManager.set("activeBlock", blocker, "block_start");
    var duration = BLOCK_JUMP_DURATION;
    if (options && typeof options.duration === "number") {
        duration = Math.max(6, Math.round(options.duration));
    }
    stateManager.set("activeBlockDuration", duration, "block_start");
    stateManager.set("blockJumpTimer", duration, "block_start");
    blocker.blockOriginalY = blocker.y;
    blocker.blockJumpHeightBoost = (options && typeof options.heightBoost === "number") ? options.heightBoost : 0;
    clearJumpIndicator(blocker);
    blocker.prevJumpBottomY = null;

    var suppliedDir = options && typeof options.direction === "number" ? options.direction : null;
    if (suppliedDir === 0) suppliedDir = null;
    if (suppliedDir === null) {
        var shotX = typeof shotStartX === "number" ? shotStartX : blocker.x;
        suppliedDir = (blocker.x <= shotX) ? 1 : -1;
    }
    blocker.jumpIndicatorDir = suppliedDir;
}

/**
 * Attempt user steal - multiplayer human player stealing
 * Similar to attemptSteal but works for any human-controlled defender
 * Slightly better success rate than AI (10-40% vs 5-35%)
 * 
 * Perimeter penalty: 50% reduction if ball carrier is beyond perimeter
 */
function attemptUserSteal(defender, systems) {
    var stateManager = systems.stateManager;
    var ballCarrier = stateManager.get('ballCarrier');
    var currentTeam = stateManager.get('currentTeam');

    if (!defender || !ballCarrier) return;
    if (currentTeam === "teamA") return; // Can't steal when you have possession

    var defenderData = defender.playerData;
    var carrierData = ballCarrier.playerData;
    if (!defenderData || !carrierData) return;
    if (defenderData.stealRecoverFrames > 0) return;

    // Check distance
    var dx = Math.abs(defender.x - ballCarrier.x);
    var dy = Math.abs(defender.y - ballCarrier.y);
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > GAME_BALANCE.DEFENSE.STEAL_MAX_DISTANCE) {
        return;
    }

    // User steal chance (better than AI)
    var stealChance = getEffectiveAttribute(defenderData, ATTR_STEAL) * 5;
    var resistance = getEffectiveAttribute(carrierData, ATTR_POWER) * 4;
    var chance = (stealChance - resistance + 15) / 100;

    if (chance < 0.1) chance = 0.1;
    if (chance > 0.4) chance = 0.4; // Human can be slightly better

    var defenderTeamName = getPlayerTeamName(defender);
    var carrierDistToBasket = getSpriteDistanceToBasket(ballCarrier, defenderTeamName);
    if (carrierDistToBasket > DEFENDER_PERIMETER_LIMIT) {
        chance *= 0.5;
    }

    if (Math.random() < chance) {
        // Steal successful!
        recordTurnover(ballCarrier, "steal");
        var defenderTeam = getPlayerTeamName(defender);
        var opponentTeam = defenderTeam === "teamA" ? "teamB" : "teamA";

        stateManager.set("reboundActive", false, "pass_steal_success");
        stateManager.set("shotClock", 24, "pass_steal_success");
        stateManager.set("currentTeam", defenderTeam, "pass_steal_success");
        triggerPossessionBeep(systems);
        stateManager.set("ballCarrier", defender, "pass_steal_success");
        resetBackcourtState(systems);
        stateManager.set("ballHandlerStuckTimer", 0, "pass_steal_success");
        stateManager.set("ballHandlerAdvanceTimer", 0, "pass_steal_success");

        // Reset opponent's streak
        var streakKey = "consecutivePoints." + opponentTeam;
        stateManager.set(streakKey, 0, "pass_steal_success");

        stateManager.set("ballHandlerLastX", defender.x, "pass_steal_success");
        stateManager.set("ballHandlerLastY", defender.y, "pass_steal_success");
        stateManager.set("ballHandlerFrontcourtStartX", defender.x, "pass_steal_success");
        stateManager.set("ballHandlerProgressOwner", defender, "pass_steal_success");

        defenderData.hasDribble = true;
        carrierData.hasDribble = false;

        // Reassign defensive matchups since we now have the ball
        assignDefensiveMatchups(systems);

        if (defenderData.stats) {
            defenderData.stats.steals++;
        }
        clearPotentialAssist(systems);

        announceEvent("steal", {
            playerName: defenderData.name,
            player: defender,
            team: defenderTeam
        }, systems);
    } else {
        beginStealRecovery(defender, ballCarrier);
    }
}

/**
 * Attempt AI steal - computer-controlled defender stealing
 * 
 * Special behavior: If ball carrier has dead dribble, attempts shove instead
 * 
 * Success factors:
 * - Distance must be < 6 units
 * - Steal chance = (ATTR_STEAL * 4 - ATTR_POWER * 4 + 10) / 100
 * - Clamped to 5-35% (slightly worse than human)
 * - Perimeter penalty: 50% reduction if ball carrier is beyond perimeter
 * 
 * Success: Award possession, update stats, announce steal
 * Failure: Enter steal recovery (movement penalty)
 */
function attemptAISteal(defender, ballCarrier, systems) {
    if (!defender || !ballCarrier) return;

    var defenderData = defender.playerData;
    var carrierData = ballCarrier.playerData;
    if (!defenderData || !carrierData) return;
    if (defenderData.stealRecoverFrames > 0) return;

    if (carrierData.hasDribble === false) {
        attemptShove(defender, null, systems);
        return;
    }

    // Check distance one more time to be safe
    var dx = Math.abs(defender.x - ballCarrier.x);
    var dy = Math.abs(defender.y - ballCarrier.y);
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > GAME_BALANCE.DEFENSE.BLOCK_MAX_DISTANCE) return; // Too far

    // Steal chance based on attributes (reduced for more difficulty)
    var stealChance = getEffectiveAttribute(defenderData, ATTR_STEAL) * 4; // Reduced from 8 to 4
    var resistance = getEffectiveAttribute(carrierData, ATTR_POWER) * 4; // Increased from 3 to 4
    var chance = (stealChance - resistance + 10) / 100; // Reduced base from 20 to 10

    if (chance < 0.05) chance = 0.05; // Lowered minimum
    if (chance > 0.35) chance = 0.35; // AI slightly worse at steals than human

    var defenderTeamName = getPlayerTeamName(defender);
    var carrierDistToBasket = getSpriteDistanceToBasket(ballCarrier, defenderTeamName);
    if (carrierDistToBasket > DEFENDER_PERIMETER_LIMIT) {
        chance *= 0.5;
    }

    if (Math.random() < chance) {
        // Steal successful!
        var stateManager = systems.stateManager;
        recordTurnover(ballCarrier, "steal");
        stateManager.set("reboundActive", false, "rebound_steal_success");
        stateManager.set("shotClock", 24, "rebound_steal_success");

        // Figure out which team gets the ball
        var defenderTeam = getPlayerTeamName(defender);
        stateManager.set("currentTeam", defenderTeam, "rebound_steal_success");
        triggerPossessionBeep(systems);
        stateManager.set("ballCarrier", defender, "rebound_steal_success");
        resetBackcourtState(systems);
        stateManager.set("ballHandlerStuckTimer", 0, "rebound_steal_success");
        stateManager.set("ballHandlerAdvanceTimer", 0, "rebound_steal_success");
        stateManager.set("ballHandlerLastX", defender.x, "rebound_steal_success");
        stateManager.set("ballHandlerLastY", defender.y, "rebound_steal_success");
        stateManager.set("ballHandlerFrontcourtStartX", defender.x, "rebound_steal_success");
        stateManager.set("ballHandlerProgressOwner", defender, "rebound_steal_success");
        defender.playerData.hasDribble = true;
        carrierData.hasDribble = false;
        assignDefensiveMatchups(systems);

        // Reset opponent's streak
        var otherTeam = defenderTeam === "teamA" ? "teamB" : "teamA";
        var streakKey = "consecutivePoints." + otherTeam;
        stateManager.set(streakKey, 0, "rebound_steal_success");

        if (defenderData.stats) {
            defenderData.stats.steals++;
        }
        clearPotentialAssist(systems);

        announceEvent("steal", {
            playerName: defenderData.name,
            player: defender,
            team: defenderTeam
        }, systems);
    } else {
        beginStealRecovery(defender, ballCarrier);
    }
}
