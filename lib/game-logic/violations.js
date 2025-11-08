/**
 * NBA JAM - Violations Module
 * 
 * Handles all rule violations including:
 * - Backcourt violations (10-second and over-and-back)
 * - Five-second violations
 * - Violation state management
 */

/**
 * Set frontcourt as established for a team
 */
function setFrontcourtEstablished(teamName, systems) {
    var stateManager = systems.stateManager;
    var gameState = stateManager.get();

    if (gameState.frontcourtEstablished) return;
    stateManager.set("frontcourtEstablished", true, "frontcourt_established");
    var state = gameState.scoreFlash;
    if (state && state.active && state.stopTeam === teamName) {
        stopScoreFlash(state.activeTeam);
    }
}

/**
 * Reset all backcourt-related state
 */
function resetBackcourtState(systems) {
    var stateManager = systems.stateManager;
    var gameState = stateManager.get();

    stateManager.set("backcourtTimer", 0, "backcourt_reset");
    stateManager.set("frontcourtEstablished", false, "backcourt_reset");
    stateManager.set("ballHandlerAdvanceTimer", 0, "backcourt_reset");
    stateManager.set("ballHandlerFrontcourtStartX", gameState.ballCarrier ? gameState.ballCarrier.x : 0, "backcourt_reset");
    stateManager.set("ballHandlerProgressOwner", gameState.ballCarrier || null, "backcourt_reset");
    stateManager.set("ballHandlerDeadForcedShot", false, "backcourt_reset");
}

/**
 * Check if a player is in their backcourt
 */
function isInBackcourt(player, teamName) {
    if (!player) return false;
    var midCourt = Math.floor(COURT_WIDTH / 2);
    if (teamName === "teamA") {
        return player.x < midCourt - 2;
    }
    return player.x > midCourt + 2;
}

/**
 * Check if a pass would violate over-and-back rule
 */
function wouldBeOverAndBack(passer, receiver, teamName) {
    if (!passer || !receiver) return false;

    var passerInBackcourt = isInBackcourt(passer, teamName);
    var receiverInBackcourt = isInBackcourt(receiver, teamName);

    // If passer is in frontcourt and receiver is in backcourt = violation
    if (!passerInBackcourt && receiverInBackcourt) {
        return true;
    }

    return false;
}

/**
 * Enforce backcourt violation and change possession
 */
function enforceBackcourtViolation(message, systems) {
    var violatingTeam = gameState.currentTeam;
    if (gameState.ballCarrier) {
        recordTurnover(gameState.ballCarrier, message || "backcourt");
    }

    // Emit event instead of calling UI directly
    emitGameEvent("violation", {
        type: "backcourt",
        team: violatingTeam,
        message: message || "backcourt"
    });

    // Coordinator: Skip blocking wait
    if (!(mpCoordinator && mpCoordinator.isCoordinator)) {
        mswait(800);
    }

    resetBackcourtState();
    resetDeadDribbleTimer();
    clearPotentialAssist(systems);
    if (violatingTeam === "teamA" || violatingTeam === "teamB") {
        setupInbound(violatingTeam, systems);
    } else {
        switchPossession(systems);
        stateManager.set("ballHandlerStuckTimer", 0, "possession_switched");
        stateManager.set("ballHandlerAdvanceTimer", 0, "possession_switched");
        if (gameState.ballCarrier) {
            stateManager.set("ballHandlerLastX", gameState.ballCarrier.x, "possession_switched");
            stateManager.set("ballHandlerLastY", gameState.ballCarrier.y, "possession_switched");
            stateManager.set("ballHandlerFrontcourtStartX", gameState.ballCarrier.x, "possession_switched");
            stateManager.set("ballHandlerProgressOwner", gameState.ballCarrier, "possession_switched");
        }
    }
}

/**
 * Enforce five-second violation and change possession
 */
function enforceFiveSecondViolation(systems) {
    var stateManager = systems.stateManager;
    var gameState = stateManager.get();

    var violatingTeam = gameState.currentTeam;
    if (gameState.ballCarrier) {
        recordTurnover(gameState.ballCarrier, "five_seconds");
    }

    // Emit event instead of calling UI directly
    emitGameEvent("violation", {
        type: "five_seconds",
        team: violatingTeam
    });

    // Coordinator: Skip blocking wait
    if (!(mpCoordinator && mpCoordinator.isCoordinator)) {
        mswait(800);
    }

    resetDeadDribbleTimer();
    resetBackcourtState();
    clearPotentialAssist(systems);
    if (violatingTeam === "teamA" || violatingTeam === "teamB") {
        setupInbound(violatingTeam, systems);
    } else {
        switchPossession(systems);
        stateManager.set("ballHandlerStuckTimer", 0, "five_second_violation");
        stateManager.set("ballHandlerAdvanceTimer", 0, "five_second_violation");
    }
}

/**
 * Main violation checking function called each frame
 */
function checkViolations(violationTriggeredThisFrame, systems) {
    var stateManager = systems.stateManager;
    var gameState = stateManager.get();

    // Backcourt violation checks
    if (gameState.ballCarrier && !gameState.inbounding) {
        // DEFENSIVE FIX: Verify ballCarrier is on the current team
        var carrierTeam = getPlayerTeamName(gameState.ballCarrier);
        if (carrierTeam !== gameState.currentTeam) {
            // Data corruption - ballCarrier points to wrong team
            log(LOG_WARNING, "NBA JAM: ballCarrier team mismatch in checkViolations! " +
                "currentTeam=" + gameState.currentTeam + " but carrier is on " + carrierTeam);
            // Reset ballCarrier to prevent false violation
            stateManager.set("ballCarrier", null, "data_corruption_fix");
            return violationTriggeredThisFrame;
        }

        var inBackcourt = isInBackcourt(gameState.ballCarrier, gameState.currentTeam);
        if (!gameState.frontcourtEstablished) {
            if (!inBackcourt && gameState.inboundGracePeriod === 0) {
                // Only establish frontcourt after grace period expires
                setFrontcourtEstablished(gameState.currentTeam);
                stateManager.set("backcourtTimer", 0, "frontcourt_established");
            } else {
                // Check if player is near half court line (within 6 pixels)
                var midCourt = Math.floor(COURT_WIDTH / 2);
                var distanceToMidcourt = Math.abs(gameState.ballCarrier.x - midCourt);
                var nearHalfCourt = distanceToMidcourt < 6;

                gameState.backcourtTimer++;

                // Increased from 200 to 210 frames (adds 500ms buffer for network latency)
                // Also pause timer increment if player is near half court line
                if (gameState.backcourtTimer >= 210 && !nearHalfCourt) {  // 10.5 seconds at 20 FPS
                    enforceBackcourtViolation("10-SECOND BACKCOURT VIOLATION!");
                    violationTriggeredThisFrame = true;
                } else if (nearHalfCourt && gameState.backcourtTimer >= 205) {
                    // Near half court - cap timer at 205 frames to give grace period
                    stateManager.set("backcourtTimer", 205, "half_court_grace");
                }
            }
        } else if (inBackcourt) {
            // Check grace period before enforcing violation
            if (gameState.inboundGracePeriod > 0) {
                gameState.inboundGracePeriod--;
            } else {
                enforceBackcourtViolation("OVER AND BACK!");
                violationTriggeredThisFrame = true;
            }
        }
    } else if (!gameState.inbounding) {
        stateManager.set("backcourtTimer", 0, "no_ball_carrier");
    }

    return violationTriggeredThisFrame;
}
