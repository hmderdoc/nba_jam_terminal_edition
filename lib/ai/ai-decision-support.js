/**
 * NBA JAM - AI Decision Support Functions
 * 
 * Helper functions that support AI decision-making including:
 * - Passing lane analysis and evaluation
 * - Defense momentum tracking
 * - Offensive planning and momentum cuts
 * - Court positioning and spot selection
 * - Movement helpers
 * - Shot quality evaluation
 * - Turbo management
 */

/**
 * Evaluate passing lane clearance between passer and target point
 * Returns clearance score (higher = more open)
 */
function evaluatePassingLaneClearance(passer, targetX, targetY, defenders) {
    if (!passer) return 0;

    var passX1 = passer.x + 2;
    var passY1 = passer.y + 2;
    var passX2 = targetX;
    var passY2 = targetY;
    var passVecX = passX2 - passX1;
    var passVecY = passY2 - passY1;
    var passLength = Math.sqrt(passVecX * passVecX + passVecY * passVecY);

    if (passLength < 0.1) return 0;

    var minClearance = 12;
    var sawDefender = false;

    if (!defenders) defenders = [];

    for (var i = 0; i < defenders.length; i++) {
        var defender = defenders[i];
        if (!defender) continue;

        var defX = defender.x + 2;
        var defY = defender.y + 2;

        var toDefX = defX - passX1;
        var toDefY = defY - passY1;

        var projection = (toDefX * passVecX + toDefY * passVecY) / passLength;
        var outsideSegment = false;

        if (projection < 0) {
            projection = 0;
            outsideSegment = true;
        } else if (projection > passLength) {
            projection = passLength;
            outsideSegment = true;
        }

        var t = passLength ? (projection / passLength) : 0;
        var closestX = passX1 + passVecX * t;
        var closestY = passY1 + passVecY * t;

        var deltaX = defX - closestX;
        var deltaY = defY - closestY;
        var distToLane = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        var stealAttr = defender.playerData
            ? getEffectiveAttribute(defender.playerData, ATTR_STEAL)
            : 0;

        var clearance = distToLane - (stealAttr * 0.45);
        if (outsideSegment) clearance -= 0.5;

        if (clearance < minClearance) {
            minClearance = clearance;
        }

        sawDefender = true;
    }

    if (!sawDefender) {
        minClearance = 8;
    }

    var lengthPenalty = passLength * PASS_LANE_LENGTH_WEIGHT;
    return minClearance - lengthPenalty;
}

/**
 * Find best open passing lane target for off-ball player
 * Evaluates court spots and returns best target with clearance data
 *
 * Legacy helper: currently unused in the live AI rotation, but retained
 * for the upcoming AI pass so we can re-enable smarter off-ball cuts.
 */
function findOpenPassingLaneTarget(player, ballCarrier, teamName, myDefender) {
    if (!player || !ballCarrier) return null;

    var spots = getTeamSpots(teamName);
    if (!spots) return null;

    var defenders = getOpposingTeamSprites(teamName) || [];
    var teammate = getTeammate(player, teamName);
    var attackDirection = teamName === "teamA" ? 1 : -1;
    var aheadBuffer = 2;

    var candidates = [];
    var seen = Object.create(null);

    function addCandidate(spot) {
        if (!spot) return;
        var key = spot.x + "," + spot.y;
        if (seen[key]) return;
        seen[key] = true;
        candidates.push(spot);
    }

    addCandidate(spots.corner_low);
    addCandidate(spots.corner_high);
    addCandidate(spots.left_wing);
    addCandidate(spots.right_wing);
    addCandidate(spots.elbow_low);
    addCandidate(spots.elbow_high);
    addCandidate(spots.dunker_low);
    addCandidate(spots.dunker_high);
    addCandidate(spots.top_key);

    var laneOffset = player.y < ballCarrier.y ? -4 : 4;
    addCandidate({
        x: clampToCourtX(ballCarrier.x + attackDirection * 7),
        y: clampToCourtY(ballCarrier.y + laneOffset)
    });

    var rimSpot = getOffensiveBasket(teamName);
    if (rimSpot) {
        addCandidate({
            x: clampToCourtX(rimSpot.x - attackDirection * 3),
            y: clampToCourtY(BASKET_LEFT_Y)
        });
    }

    var bestSpot = null;
    var bestScore = -Infinity;

    for (var i = 0; i < candidates.length; i++) {
        var spot = candidates[i];
        if (!spot) continue;

        var ahead = attackDirection > 0
            ? spot.x > ballCarrier.x + aheadBuffer
            : spot.x < ballCarrier.x - aheadBuffer;
        if (!ahead) continue;

        if (teammate && distanceBetweenPoints(teammate.x, teammate.y, spot.x, spot.y) < 3) {
            continue;
        }

        var travel = distanceBetweenPoints(player.x, player.y, spot.x, spot.y);
        var clearance = evaluatePassingLaneClearance(ballCarrier, spot.x, spot.y, defenders);
        if (clearance < PASS_LANE_MIN_CLEARANCE) continue;

        var spacing = myDefender
            ? distanceBetweenPoints(myDefender.x, myDefender.y, spot.x, spot.y)
            : 6;

        var score = (clearance * 2.1)
            - (travel * PASS_LANE_TRAVEL_WEIGHT)
            + (Math.min(spacing, 10) * PASS_LANE_SPACING_WEIGHT)
            + (Math.random() * 0.2);

        if (!bestSpot || score > bestScore) {
            bestScore = score;
            bestSpot = {
                x: spot.x,
                y: spot.y,
                distance: travel,
                clearance: clearance,
                score: score
            };
        }
    }

    if (!bestSpot || bestScore < 0.1) {
        return null;
    }

    return bestSpot;
}

/**
 * Apply momentum-based smoothing to defensive positioning
 * Prevents defenders from instantly snapping to new positions
 */
function applyDefenderMomentum(player, targetX, targetY, responsiveness, force) {
    if (!player || !player.playerData) {
        return { x: targetX, y: targetY };
    }

    var data = player.playerData;
    if (force || !data.defenseMomentum) {
        data.defenseMomentum = { x: targetX, y: targetY };
        return { x: targetX, y: targetY };
    }

    var resp = typeof responsiveness === "number" ? responsiveness : 0.3;
    if (resp <= 0) resp = 0.3;
    resp = clamp(resp, 0.05, 0.85);

    data.defenseMomentum.x += (targetX - data.defenseMomentum.x) * resp;
    data.defenseMomentum.y += (targetY - data.defenseMomentum.y) * resp;

    return { x: data.defenseMomentum.x, y: data.defenseMomentum.y };
}

/**
 * Reset a single player's defense momentum
 */
function resetPlayerDefenseMomentum(player) {
    if (player && player.playerData) {
        player.playerData.defenseMomentum = null;
    }
}

/**
 * Reset defense momentum for all players
 */
function resetAllDefenseMomentum() {
    var allPlayers = spriteRegistry.getAllPlayers();
    for (var i = 0; i < allPlayers.length; i++) {
        resetPlayerDefenseMomentum(allPlayers[i]);
    }
}

/**
 * Clone a court spot with clamped coordinates
 */
function cloneCourtSpot(spot) {
    if (!spot) return null;
    return {
        x: clampToCourtX(Math.round(spot.x)),
        y: clampToCourtY(Math.round(spot.y))
    };
}

/**
 * Choose wing spot based on cut direction
 */
function chooseWingSpot(spots, cutToTop) {
    var left = spots.left_wing ? cloneCourtSpot(spots.left_wing) : null;
    var right = spots.right_wing ? cloneCourtSpot(spots.right_wing) : null;
    if (!left) return right;
    if (!right) return left;
    return (cutToTop ? (left.y <= right.y ? left : right) : (left.y >= right.y ? left : right));
}

/**
 * Build a momentum cut plan for off-ball offense
 * Creates a sequence of spots to cut through to exploit defensive momentum
 */
function buildMomentumCutPlan(player, teamName, attackDirection, cutToTop) {
    var spots = getTeamSpots(teamName);
    if (!spots) return null;

    var planSpots = [];
    var turbo = [];

    var slashSpot = cloneCourtSpot(cutToTop ? spots.dunker_low : spots.dunker_high) || cloneCourtSpot(spots.top_key);
    if (slashSpot) {
        slashSpot.x = clampToCourtX(Math.round((slashSpot.x + player.x + attackDirection * 3) / 2));
        slashSpot.y = clampToCourtY(slashSpot.y + (cutToTop ? -1 : 1));
        planSpots.push(slashSpot);
        turbo.push(true);
    }

    var cornerSpot = cloneCourtSpot(cutToTop ? spots.corner_low : spots.corner_high);
    if (!cornerSpot) {
        cornerSpot = cloneCourtSpot(spots.corner_low) || cloneCourtSpot(spots.corner_high);
    }
    if (cornerSpot) {
        cornerSpot.x = clampToCourtX(cornerSpot.x + attackDirection * -1);
        cornerSpot.y = clampToCourtY(cornerSpot.y + (cutToTop ? -1 : 1));
        planSpots.push(cornerSpot);
        turbo.push(true);
    }

    var wingSpot = chooseWingSpot(spots, cutToTop);
    if (wingSpot) {
        wingSpot.x = clampToCourtX(wingSpot.x + attackDirection * 2);
        planSpots.push(wingSpot);
        turbo.push(false);
    }

    if (!planSpots.length) return null;

    return {
        spots: planSpots,
        turbo: turbo,
        index: 0,
        tolerance: 1.7,
        cooldown: 55
    };
}

/**
 * Evaluate and execute momentum cut plan based on defensive positioning
 * Detects when defender is leaning and creates cut in opposite direction
 *
 * Legacy helper: unused today, but kept for the AI overhaul.
 */
function evaluateMomentumCutPlan(player, teamName, attackDirection, context) {
    if (!player || !player.playerData) return null;
    var data = player.playerData;

    if (data.momentumCutCooldown && data.momentumCutCooldown > 0) {
        data.momentumCutCooldown--;
    }

    if (context.inBackcourt || (context.ballCarrierInBackcourt && !context.amAhead)) {
        data.momentumCutPlan = null;
        return null;
    }

    if (context.defender && (!context.defender.playerData || !context.defender.playerData.defenseMomentum)) {
        data.momentumCutPlan = null;
    }

    var plan = data.momentumCutPlan;
    if (plan && plan.spots && plan.spots.length) {
        var target = plan.spots[plan.index];
        if (!target) {
            data.momentumCutPlan = null;
            return null;
        }
        var tolerance = plan.tolerance || 1.7;
        var dist = distanceBetweenPoints(player.x, player.y, target.x, target.y);

        if (dist < tolerance) {
            plan.index++;
            if (plan.index >= plan.spots.length) {
                data.momentumCutPlan = null;
                data.momentumCutCooldown = plan.cooldown || 50;
                return null;
            }
            target = plan.spots[plan.index];
            dist = distanceBetweenPoints(player.x, player.y, target.x, target.y);
        }

        data.momentumCutPlan = plan;
        return {
            x: target.x,
            y: target.y,
            turbo: plan.turbo && plan.turbo[plan.index]
        };
    }

    if (data.momentumCutCooldown && data.momentumCutCooldown > 0) return null;

    var defender = context.defender;
    if (!defender || !defender.playerData || !defender.playerData.defenseMomentum) return null;

    if (!context.ballHandlerStuck && !context.bunchedUp) return null;

    var momentum = defender.playerData.defenseMomentum;
    if (typeof momentum !== "object" || momentum === null) return null;
    if (typeof momentum.x !== "number" || typeof momentum.y !== "number") return null;

    var leanMagnitude = distanceBetweenPoints(momentum.x, momentum.y, player.x, player.y);
    if (leanMagnitude < 2) return null;

    var defenderTravel = distanceBetweenPoints(momentum.x, momentum.y, defender.x, defender.y);
    if (defenderTravel < 1) return null;

    var defToPlayerX = player.x - defender.x;
    var defToPlayerY = player.y - defender.y;
    var defToMomentumX = momentum.x - defender.x;
    var defToMomentumY = momentum.y - defender.y;
    var defToPlayerMag = Math.sqrt(defToPlayerX * defToPlayerX + defToPlayerY * defToPlayerY) || 1;
    var defToMomentumMag = Math.sqrt(defToMomentumX * defToMomentumX + defToMomentumY * defToMomentumY) || 1;
    var alignment = ((defToPlayerX * defToMomentumX) + (defToPlayerY * defToMomentumY)) / (defToPlayerMag * defToMomentumMag);

    if (alignment > 0.6) return null;

    var verticalLean = momentum.y - player.y;
    var cutToTop;
    if (Math.abs(verticalLean) >= 1) {
        cutToTop = verticalLean > 0;
    } else {
        cutToTop = player.y >= BASKET_LEFT_Y;
    }

    var newPlan = buildMomentumCutPlan(player, teamName, attackDirection, cutToTop);
    if (!newPlan) return null;

    data.momentumCutPlan = newPlan;
    return {
        x: newPlan.spots[0].x,
        y: newPlan.spots[0].y,
        turbo: newPlan.turbo && newPlan.turbo[0]
    };
}

/**
 * Find best drive lane Y coordinate to avoid defenders.
 * Legacy helper: currently not invoked, retained for the AI refresh.
 */
function findBestDriveLaneY(player, defenders, targetX) {
    var lanes = [BASKET_LEFT_Y - 3, BASKET_LEFT_Y, BASKET_LEFT_Y + 3];
    var bestLane = clampToCourtY(player.y);
    var bestScore = -999;

    for (var i = 0; i < lanes.length; i++) {
        var laneY = clampToCourtY(lanes[i]);
        var probeX = clampToCourtX(player.x + (targetX - player.x) * 0.4);
        var minDefenderDist = 999;

        for (var d = 0; d < defenders.length; d++) {
            var defender = defenders[d];
            if (!defender) continue;
            var dist = distanceBetweenPoints(probeX, laneY, defender.x, defender.y);
            if (dist < minDefenderDist) {
                minDefenderDist = dist;
            }
        }

        if (minDefenderDist === 999) minDefenderDist = 12;

        // Prefer lanes that are open but not drastically far from current Y
        var alignmentPenalty = Math.abs(laneY - player.y) * 0.3;
        var score = minDefenderDist - alignmentPenalty;

        if (score > bestScore) {
            bestScore = score;
            bestLane = laneY;
        }
    }

    return bestLane;
}

/**
 * Choose best backcourt advance target to avoid defenders.
 * Legacy helper retained for the AI refresh.
 */
function chooseBackcourtAdvanceTarget(player, teamName) {
    var midCourt = Math.floor(COURT_WIDTH / 2);
    var desiredX = teamName === "teamA"
        ? clampToCourtX(Math.max(player.x + 12, midCourt + 10))
        : clampToCourtX(Math.min(player.x - 12, midCourt - 10));

    var opponents = getOpposingTeamSprites(teamName);
    var bestY = clampToCourtY(player.y);
    var bestScore = Infinity;

    for (var offset = -6; offset <= 6; offset += 3) {
        var candidateY = clampToCourtY(player.y + offset);
        var crowdScore = 0;
        for (var i = 0; i < opponents.length; i++) {
            var opp = opponents[i];
            if (!opp) continue;
            var dist = distanceBetweenPoints(desiredX, candidateY, opp.x, opp.y);
            if (dist < 1) dist = 1;
            crowdScore += 1 / dist;
        }
        if (crowdScore < bestScore) {
            bestScore = crowdScore;
            bestY = candidateY;
        }
    }

    return { x: desiredX, y: bestY };
}

/**
 * Activate turbo for AI player with drain rate and distance checks
 */
function activateAITurbo(player, drainMultiplier, distanceToTarget) {
    if (!player || !player.playerData) return false;
    var playerData = player.playerData;

    if (playerData.turbo <= 0) return false;
    if (distanceToTarget !== undefined && distanceToTarget !== 999 && distanceToTarget < 3) return false;

    var now = Date.now();
    if (playerData.lastTurboUseTime && (now - playerData.lastTurboUseTime) < 350) {
        return false;
    }

    if (playerData.lastTurboX !== null && playerData.lastTurboY !== null) {
        if (player.x === playerData.lastTurboX && player.y === playerData.lastTurboY) {
            return false;
        }
    }

    if (playerData.turboActive && playerData.turbo <= 0) {
        return false;
    }

    var drain = TURBO_DRAIN_RATE * (drainMultiplier || 1);
    playerData.turboActive = true;
    if (!playerData.useTurbo(drain)) {
        playerData.turboActive = false;
        return false;
    }

    playerData.lastTurboUseTime = now;
    playerData.lastTurboX = player.x;
    playerData.lastTurboY = player.y;
    return true;
}

/**
 * Prime offense after inbound with movement patterns
 */
function primeInboundOffense(ballHandler, teammate, teamName, systems) {
    var stateManager = systems.stateManager;

    if (ballHandler && ballHandler.playerData) {
        ballHandler.playerData.inboundBoostTimer = 14;
        if (!ballHandler.playerData.offBallPattern) {
            ballHandler.playerData.offBallPattern = { stage: "advance", timer: 0 };
        } else {
            ballHandler.playerData.offBallPattern.stage = "advance";
            ballHandler.playerData.offBallPattern.timer = 0;
        }
    }

    if (teammate && teammate.playerData) {
        if (!teammate.playerData.offBallPattern) {
            teammate.playerData.offBallPattern = { stage: "perimeter", timer: 0 };
        } else {
            teammate.playerData.offBallPattern.stage = "perimeter";
            teammate.playerData.offBallPattern.timer = 0;
        }
        teammate.playerData.inboundBoostTimer = 8;
    }

    stateManager.set('frontcourtEstablished', false, 'inbound_prime');
    stateManager.set('backcourtTimer', 0, 'inbound_prime');
    if (ballHandler) {
        stateManager.set('ballHandlerLastX', ballHandler.x, 'inbound_prime');
        stateManager.set('ballHandlerLastY', ballHandler.y, 'inbound_prime');
    }
}

/**
 * Get the offensive basket for a team
 */
function getOffensiveBasket(teamName) {
    // Red (teamA) attacks right (BASKET_RIGHT), Blue (teamB) attacks left (BASKET_LEFT)
    return teamName === "teamA"
        ? { x: BASKET_RIGHT_X, y: BASKET_RIGHT_Y }
        : { x: BASKET_LEFT_X, y: BASKET_LEFT_Y };
}

/**
 * Get court spots for a team
 */
function getTeamSpots(teamName) {
    return COURT_SPOTS[teamName];
}

/**
 * Get corner spots for a team sorted by Y coordinate
 */
function getCornerSpots(teamName) {
    var spots = getTeamSpots(teamName);
    if (!spots) return null;
    var candidates = [];
    if (spots.corner_low) candidates.push(spots.corner_low);
    if (spots.corner_high) candidates.push(spots.corner_high);
    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return a.y - b.y; });
    return {
        top: candidates[0],
        bottom: candidates[candidates.length - 1]
    };
}

/**
 * Score how open a corner spot is based on defender distance and occupancy
 */
function getCornerOpenScore(teamName, corner, player, teammate) {
    if (!corner) return -Infinity;
    var defenders = getOpposingTeamSprites(teamName);
    var minDef = 25;
    for (var i = 0; i < defenders.length; i++) {
        var defender = defenders[i];
        if (!defender) continue;
        var dist = distanceBetweenPoints(corner.x, corner.y, defender.x, defender.y);
        if (dist < minDef) minDef = dist;
    }

    var travelCost = 0;
    if (player) {
        travelCost = distanceBetweenPoints(player.x, player.y, corner.x, corner.y) * 0.3;
    }

    var occupancyPenalty = 0;
    if (teammate) {
        var teammateDist = distanceBetweenPoints(teammate.x, teammate.y, corner.x, corner.y);
        if (teammateDist < 4) {
            occupancyPenalty = (4 - teammateDist) * 2;
        }
    }

    return minDef - travelCost - occupancyPenalty;
}

/**
 * Select best corner spot avoiding teammate
 */
function selectBestCorner(teamName, player, avoidTeammate) {
    var corners = getCornerSpots(teamName);
    if (!corners) return null;
    var teammate = avoidTeammate ? getTeammate(player, teamName) : null;
    var bestCorner = null;
    var bestScore = -Infinity;
    var list = [];
    if (corners.top) list.push(corners.top);
    if (corners.bottom && corners.bottom !== corners.top) list.push(corners.bottom);
    for (var i = 0; i < list.length; i++) {
        var score = getCornerOpenScore(teamName, list[i], player, teammate);
        if (score > bestScore) {
            bestScore = score;
            bestCorner = list[i];
        }
    }
    return bestCorner;
}

/**
 * Check if player reached their target spot (within tolerance)
 */
function hasReachedSpot(player, spot, tolerance) {
    if (!spot) return true;
    tolerance = tolerance || 2; // Default 2 units
    var dist = distanceBetweenPoints(player.x, player.y, spot.x, spot.y);
    return dist < tolerance;
}

/**
 * Simple steering movement toward a target point with obstacle avoidance
 * @param {Object} player - The player sprite
 * @param {number} targetX - Target X coordinate
 * @param {number} targetY - Target Y coordinate
 * @param {number} speed - Movement speed
 * @param {Object} systems - Systems object for state access
 */
function steerToward(player, targetX, targetY, speed, systems) {
    // Check if stunned from failed shove attempt
    if (player && player.playerData && player.playerData.shoveFailureStun > 0) {
        return; // Can't move during failure stun
    }

    var dx = targetX - player.x;
    var dy = targetY - player.y;
    var distance = Math.sqrt(dx * dx + dy * dy);

    var playerName = (player.playerData && player.playerData.name) ? player.playerData.name : "unknown";
    debugLog("[STEER] player=" + playerName + ", player.x=" + player.x + ", targetX=" + targetX + ", dx=" + dx + ", distance=" + distance);

    if (distance < 1) return; // Close enough

    var turboIntent = false;
    if (speed !== undefined && speed !== null) {
        turboIntent = speed >= (PLAYER_BASE_SPEED_PER_FRAME + 0.1);
    } else if (player.playerData && player.playerData.turboActive) {
        turboIntent = true;
    }

    var actualTurbo = false;
    if (player.playerData) {
        if (turboIntent && player.playerData.turbo > 0) {
            player.playerData.turboActive = true;
            actualTurbo = true;
            if (typeof player.playerData.useTurbo === "function") {
                player.playerData.useTurbo(TURBO_DRAIN_RATE);
            }
        } else {
            player.playerData.turboActive = false;
            actualTurbo = false;
        }
    }

    var budget = createMovementCounters(player, actualTurbo, systems);
    var stepScale = 1;
    if (typeof speed === "number" && !isNaN(speed)) {
        stepScale = speed / 2;
        if (stepScale < 0.4) stepScale = 0.4;
        if (stepScale > 3) stepScale = 3;
    }

    var scaledMoves = Math.round(budget.moves * stepScale);
    if (scaledMoves <= 0) return;
    if (scaledMoves > 4) scaledMoves = 4;

    var counters = {
        horizontal: Math.max(0, Math.min(4, Math.round(budget.horizontal * stepScale))),
        vertical: Math.max(0, Math.min(4, Math.round(budget.vertical * stepScale)))
    };
    if (counters.horizontal === 0 && Math.abs(dx) > Math.abs(dy)) counters.horizontal = 1;
    if (counters.vertical === 0 && Math.abs(dy) >= Math.abs(dx)) counters.vertical = 1;

    for (var step = 0; step < scaledMoves; step++) {
        dx = targetX - player.x;
        dy = targetY - player.y;
        distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 1) break;

        var moveKey;
        if (Math.abs(dx) > Math.abs(dy)) {
            moveKey = dx < 0 ? KEY_LEFT : KEY_RIGHT;
            if (!applyMovementCommand(player, moveKey, counters)) {
                moveKey = dy < 0 ? KEY_UP : KEY_DOWN;
                if (!applyMovementCommand(player, moveKey, counters)) break;
            }
        } else {
            moveKey = dy < 0 ? KEY_UP : KEY_DOWN;
            if (!applyMovementCommand(player, moveKey, counters)) {
                moveKey = dx < 0 ? KEY_LEFT : KEY_RIGHT;
                if (!applyMovementCommand(player, moveKey, counters)) break;
            }
        }
    }
}

/**
 * Pick best off-ball spot for spacing based on ball carrier position
 */
function pickOffBallSpot(player, ballCarrier, teamName) {
    var spots = getTeamSpots(teamName);
    var inBackcourt = isInBackcourt(ballCarrier, teamName);
    var corners = getCornerSpots(teamName);

    // PRIORITY 1: If ball carrier in backcourt, GO TO FRONTCOURT WING
    if (inBackcourt) {
        var teamBPlayer1 = spriteRegistry.get(spriteRegistry.IDS.TEAM_B_PLAYER_1);
        var teamAPlayer2 = spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_2);
        return (player === teamAPlayer2 || player === teamBPlayer1)
            ? spots.left_wing
            : spots.right_wing;
    }

    if (corners) {
        var teammate = getTeammate(player, teamName);
        var ballTopHalf = ballCarrier.y < BASKET_LEFT_Y;
        var primary = ballTopHalf ? corners.bottom : corners.top;
        var secondary = ballTopHalf ? corners.top : corners.bottom;

        function occupied(corner) {
            if (!corner || !teammate) return false;
            return distanceBetweenPoints(teammate.x, teammate.y, corner.x, corner.y) < 3;
        }

        if (primary && !occupied(primary)) return primary;
        if (secondary && !occupied(secondary)) return secondary;

        var bestCorner = selectBestCorner(teamName, player, true);
        if (bestCorner) return bestCorner;
    }

    // Fallback to wing spacing
    if (ballCarrier.y < BASKET_LEFT_Y) {
        return spots.right_wing;
    }
    return spots.left_wing;
}

/**
 * Check if lane is open for drive to basket
 */
function isLaneOpen(player, teamName) {
    var basket = getOffensiveBasket(teamName);
    var defenders = getOpposingTeamSprites(teamName);

    // Simple check: any defender within 8 units of straight line to basket?
    var dirX = basket.x - player.x;
    var dirY = basket.y - player.y;
    var len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len < 0.1) return true;

    dirX /= len;
    dirY /= len;

    // Check 8 units ahead
    var probeX = player.x + dirX * 8;
    var probeY = player.y + dirY * 8;

    for (var i = 0; i < defenders.length; i++) {
        var d = distanceBetweenPoints(defenders[i].x, defenders[i].y, probeX, probeY);
        if (d < 6) return false; // Defender blocking
    }

    return true;
}

/**
 * Check if help defense is collapsing toward basket
 */
function isHelpCollapsing(player, teamName) {
    var defenders = getOpposingTeamSprites(teamName);
    var basket = getOffensiveBasket(teamName);

    // Check if both defenders are close to paint
    var closeCount = 0;
    for (var i = 0; i < defenders.length; i++) {
        var distToBasket = distanceBetweenPoints(defenders[i].x, defenders[i].y, basket.x, basket.y);
        if (distToBasket < 12) closeCount++;
    }

    return closeCount >= 2;
}

/**
 * Calculate shot quality for three-pointer based on distance and defense
 */
function calculateShotQuality(player, teamName) {
    var basket = getOffensiveBasket(teamName);
    var distToBasket = distanceBetweenPoints(player.x, player.y, basket.x, basket.y);
    var defenderDist = getClosestDefenderDistance(player, teamName);

    // Base quality from attributes
    var baseQuality = getEffectiveAttribute(player.playerData, ATTR_3PT) * 5; // 0-50

    // Bonus for being open
    var openBonus = Math.min(defenderDist * 2, 20); // 0-20

    // Penalty for being too far
    var distPenalty = Math.max(0, (distToBasket - 20) * 2); // Penalty if > 20 units

    var quality = baseQuality + openBonus - distPenalty;
    return Math.max(0, Math.min(100, quality)); // Clamp 0-100
}

/**
 * Get closest defender distance to player
 */
function getClosestDefenderDistance(player, teamName) {
    var defenders = getOpposingTeamSprites(teamName);
    var minDist = 999;

    for (var i = 0; i < defenders.length; i++) {
        var d = distanceBetweenPoints(player.x, player.y, defenders[i].x, defenders[i].y);
        if (d < minDist) minDist = d;
    }

    return minDist;
}
