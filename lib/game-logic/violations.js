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

    if (stateManager.get('frontcourtEstablished')) return;
    stateManager.set("frontcourtEstablished", true, "frontcourt_established");
    var state = stateManager.get('scoreFlash');
    if (state && state.active && state.stopTeam === teamName) {
        stopScoreFlash(state.activeTeam);
    }
}

/**
 * Reset all backcourt-related state
 */
function resetBackcourtState(systems) {
    var stateManager = systems.stateManager;
    var ballCarrier = stateManager.get('ballCarrier');

    stateManager.set("backcourtTimer", 0, "backcourt_reset");
    stateManager.set("frontcourtEstablished", false, "backcourt_reset");
    stateManager.set("ballHandlerAdvanceTimer", 0, "backcourt_reset");
    stateManager.set("ballHandlerFrontcourtStartX", ballCarrier ? ballCarrier.x : 0, "backcourt_reset");
    stateManager.set("ballHandlerProgressOwner", ballCarrier || null, "backcourt_reset");
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
    var stateManager = systems.stateManager;
    var currentTeam = stateManager.get('currentTeam');
    var ballCarrier = stateManager.get('ballCarrier');

    var violatingTeam = currentTeam;
    if (ballCarrier) {
        recordTurnover(ballCarrier, message || "backcourt");
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

    resetBackcourtState(systems);
    resetDeadDribbleTimer(systems);
    clearPotentialAssist(systems);
    if (violatingTeam === "teamA" || violatingTeam === "teamB") {
        setupInbound(violatingTeam, systems);
    } else {
        switchPossession(systems);
        stateManager.set("ballHandlerStuckTimer", 0, "possession_switched");
        stateManager.set("ballHandlerAdvanceTimer", 0, "possession_switched");
        var ballCarrier = stateManager.get('ballCarrier');
        if (ballCarrier) {
            stateManager.set("ballHandlerLastX", ballCarrier.x, "possession_switched");
            stateManager.set("ballHandlerLastY", ballCarrier.y, "possession_switched");
            stateManager.set("ballHandlerFrontcourtStartX", ballCarrier.x, "possession_switched");
            stateManager.set("ballHandlerProgressOwner", ballCarrier, "possession_switched");
        }
    }
}

/**
 * Enforce five-second violation and change possession
 */
function enforceFiveSecondViolation(systems) {
    var stateManager = systems.stateManager;
    var currentTeam = stateManager.get('currentTeam');
    var ballCarrier = stateManager.get('ballCarrier');

    var violatingTeam = currentTeam;
    if (ballCarrier) {
        recordTurnover(ballCarrier, "five_seconds");
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

    resetDeadDribbleTimer(systems);
    resetBackcourtState(systems);
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
    var ballCarrier = stateManager.get('ballCarrier');
    var inbounding = stateManager.get('inbounding');
    var currentTeam = stateManager.get('currentTeam');
    var frontcourtEstablished = stateManager.get('frontcourtEstablished');
    var inboundGracePeriod = stateManager.get('inboundGracePeriod');

    // Backcourt violation checks
    if (ballCarrier && !inbounding) {
        // DEFENSIVE FIX: Verify ballCarrier is on the current team
        var carrierTeam = getPlayerTeamName(ballCarrier);
        if (carrierTeam !== currentTeam) {
            // Data corruption - ballCarrier points to wrong team
            log(LOG_WARNING, "NBA JAM: ballCarrier team mismatch in checkViolations! " +
                "currentTeam=" + currentTeam + " but carrier is on " + carrierTeam);
            // Reset ballCarrier to prevent false violation
            stateManager.set("ballCarrier", null, "data_corruption_fix");
            return violationTriggeredThisFrame;
        }

        var inBackcourt = isInBackcourt(ballCarrier, currentTeam);
        
        // DEBUG: Log position checks
        if (typeof debugLog === "function" && ballCarrier) {
            var midCourt = Math.floor(COURT_WIDTH / 2);
            debugLog("[BACKCOURT CHECK] currentTeam=" + currentTeam + 
                    ", carrier.x=" + ballCarrier.x + 
                    ", midCourt=" + midCourt + 
                    ", inBackcourt=" + inBackcourt +
                    ", frontcourtEstablished=" + frontcourtEstablished);
        }
        
        if (!frontcourtEstablished) {
            if (!inBackcourt && inboundGracePeriod === 0) {
                // Only establish frontcourt after grace period expires
                debugLog("[BACKCOURT] Establishing frontcourt for " + currentTeam);
                setFrontcourtEstablished(currentTeam, systems);
                stateManager.set("backcourtTimer", 0, "frontcourt_established");
            } else {
                // Check if player is near half court line (within 6 pixels)
                var midCourt = Math.floor(COURT_WIDTH / 2);
                var distanceToMidcourt = Math.abs(ballCarrier.x - midCourt);
                var nearHalfCourt = distanceToMidcourt < 6;

                var backcourtTimer = stateManager.get('backcourtTimer');
                stateManager.set("backcourtTimer", backcourtTimer + 1, "backcourt_timer_increment");

                // Increased from 200 to 210 frames (adds 500ms buffer for network latency)
                // Also pause timer increment if player is near half court line
                if (backcourtTimer + 1 >= 210 && !nearHalfCourt) {  // 10.5 seconds at 20 FPS
                    enforceBackcourtViolation("10-SECOND BACKCOURT VIOLATION!", systems);
                    violationTriggeredThisFrame = true;
                } else if (nearHalfCourt && backcourtTimer + 1 >= 205) {
                    // Near half court - cap timer at 205 frames to give grace period
                    stateManager.set("backcourtTimer", 205, "half_court_grace");
                }
            }
        } else if (inBackcourt) {
            // Check grace period before enforcing violation
            if (inboundGracePeriod > 0) {
                stateManager.set("inboundGracePeriod", inboundGracePeriod - 1, "grace_period_decrement");
            } else {
                enforceBackcourtViolation("OVER AND BACK!", systems);
                violationTriggeredThisFrame = true;
            }
        }
    } else if (!inbounding) {
        stateManager.set("backcourtTimer", 0, "no_ball_carrier");
    }

    return violationTriggeredThisFrame;
}
