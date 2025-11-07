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
function setFrontcourtEstablished(teamName) {
    if (gameState.frontcourtEstablished) return;
    gameState.frontcourtEstablished = true;
    var state = gameState.scoreFlash;
    if (state && state.active && state.stopTeam === teamName) {
        stopScoreFlash(state.activeTeam);
    }
}

/**
 * Reset all backcourt-related state
 */
function resetBackcourtState() {
    gameState.backcourtTimer = 0;
    gameState.frontcourtEstablished = false;
    gameState.ballHandlerAdvanceTimer = 0;
    gameState.ballHandlerFrontcourtStartX = gameState.ballCarrier ? gameState.ballCarrier.x : 0;
    gameState.ballHandlerProgressOwner = gameState.ballCarrier || null;
    gameState.ballHandlerDeadForcedShot = false;
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
function enforceBackcourtViolation(message) {
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
    clearPotentialAssist();
    if (violatingTeam === "teamA" || violatingTeam === "teamB") {
        setupInbound(violatingTeam);
    } else {
        switchPossession();
        gameState.ballHandlerStuckTimer = 0;
        gameState.ballHandlerAdvanceTimer = 0;
        if (gameState.ballCarrier) {
            gameState.ballHandlerLastX = gameState.ballCarrier.x;
            gameState.ballHandlerLastY = gameState.ballCarrier.y;
            gameState.ballHandlerFrontcourtStartX = gameState.ballCarrier.x;
            gameState.ballHandlerProgressOwner = gameState.ballCarrier;
        }
    }
}

/**
 * Enforce five-second violation and change possession
 */
function enforceFiveSecondViolation() {
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
    clearPotentialAssist();
    if (violatingTeam === "teamA" || violatingTeam === "teamB") {
        setupInbound(violatingTeam);
    } else {
        switchPossession();
        gameState.ballHandlerStuckTimer = 0;
        gameState.ballHandlerAdvanceTimer = 0;
    }
}

/**
 * Main violation checking function called each frame
 */
function checkViolations(violationTriggeredThisFrame) {
    // Backcourt violation checks
    if (gameState.ballCarrier && !gameState.inbounding) {
        // DEFENSIVE FIX: Verify ballCarrier is on the current team
        var carrierTeam = getPlayerTeamName(gameState.ballCarrier);
        if (carrierTeam !== gameState.currentTeam) {
            // Data corruption - ballCarrier points to wrong team
            log(LOG_WARNING, "NBA JAM: ballCarrier team mismatch in checkViolations! " +
                "currentTeam=" + gameState.currentTeam + " but carrier is on " + carrierTeam);
            // Reset ballCarrier to prevent false violation
            gameState.ballCarrier = null;
            return violationTriggeredThisFrame;
        }

        var inBackcourt = isInBackcourt(gameState.ballCarrier, gameState.currentTeam);
        if (!gameState.frontcourtEstablished) {
            if (!inBackcourt && gameState.inboundGracePeriod === 0) {
                // Only establish frontcourt after grace period expires
                setFrontcourtEstablished(gameState.currentTeam);
                gameState.backcourtTimer = 0;
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
                    gameState.backcourtTimer = 205;
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
        gameState.backcourtTimer = 0;
    }

    return violationTriggeredThisFrame;
}
