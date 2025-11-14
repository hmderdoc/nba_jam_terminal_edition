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

    // Store per-team frontcourt status
    var frontcourtStatus = stateManager.get('frontcourtEstablishedByTeam') || {};
    if (frontcourtStatus[teamName]) return; // Already established for this team

    frontcourtStatus[teamName] = true;
    stateManager.set("frontcourtEstablishedByTeam", frontcourtStatus, "frontcourt_established");

    // Also set global flag for current team (for backward compatibility)
    stateManager.set("frontcourtEstablished", true, "frontcourt_established");

    var state = stateManager.get('scoreFlash');
    if (state && state.active && state.stopTeam === teamName) {
        stopScoreFlash(state.activeTeam, systems);
    }
}

/**
 * Reset all backcourt-related state
 */
function resetBackcourtState(systems) {
    var stateManager = systems.stateManager;
    var ballCarrier = stateManager.get('ballCarrier');
    var currentTeam = stateManager.get('currentTeam');

    stateManager.set("backcourtTimer", 0, "backcourt_reset");
    stateManager.set("frontcourtEstablished", false, "backcourt_reset");

    // Clear per-team frontcourt status for current team only
    var frontcourtStatus = stateManager.get('frontcourtEstablishedByTeam') || {};
    if (currentTeam) {
        frontcourtStatus[currentTeam] = false;
        stateManager.set("frontcourtEstablishedByTeam", frontcourtStatus, "backcourt_reset");
    }

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
 * Check if frontcourt is clearly established (more generous threshold)
 * Requires player to be further into frontcourt before establishing
 */
function isClearlyInFrontcourt(player, teamName) {
    if (!player) return false;
    var midCourt = Math.floor(COURT_WIDTH / 2);
    // Require 5 pixels into frontcourt to establish (prevents edge case violations)
    if (teamName === "teamA") {
        return player.x >= midCourt + 5;  // x >= 45 for teamA
    }
    return player.x <= midCourt - 5;  // x <= 35 for teamB
}

/**
 * Setup inbound after violation with animated player movement
 * Ball teleports to inbounder, players walk to positions at natural pace
 */
function setupViolationInbound(violatingTeam, systems) {
    var stateManager = systems.stateManager;

    // Opposing team gets the ball
    var inboundTeam = violatingTeam === "teamA" ? "teamB" : "teamA";

    debugLog("[VIOLATION INBOUND] violatingTeam=" + violatingTeam + ", inboundTeam=" + inboundTeam);

    if (systems.animationSystem && typeof systems.animationSystem.clearBallAnimations === "function") {
        systems.animationSystem.clearBallAnimations("violation_inbound");
    }

    stateManager.set("shotInProgress", false, "violation_reset_shot");

    // Clear violation-related state
    stateManager.set("ballCarrier", null, "violation_clear_ball");
    stateManager.set("reboundActive", false, "violation_inbound");
    stateManager.set("shotClock", 24, "violation_inbound");

    // Switch to inbounding team
    stateManager.set("currentTeam", inboundTeam, "violation_inbound");

    // Reset backcourt/frontcourt state for new possession
    resetBackcourtState(systems);
    stateManager.set("ballHandlerStuckTimer", 0, "violation_inbound");
    stateManager.set("ballHandlerAdvanceTimer", 0, "violation_inbound");

    // Get team players
    var inboundAltIndex = stateManager.get("inboundAlternateIndex") || { teamA: 0, teamB: 0 };
    var inboundIndex = inboundAltIndex[inboundTeam] || 0;
    var teamPlayers = inboundTeam === "teamA" ? [teamAPlayer1, teamAPlayer2] : [teamBPlayer1, teamBPlayer2];
    var inbounder = teamPlayers[inboundIndex] || teamPlayers[0];
    var receiver = teamPlayers[1 - inboundIndex] || teamPlayers[1] || inbounder;

    // Calculate target positions - sideline inbound near midcourt
    var attackDir = inboundTeam === "teamA" ? 1 : -1;
    var midX = Math.floor(COURT_WIDTH / 2);
    var midY = Math.floor(COURT_HEIGHT / 2);

    // Inbounder at sideline in backcourt
    var inboundX = clampToCourtX(midX - attackDir * 20);
    var inboundY = midY - 2;

    // Receiver nearby in backcourt
    var receiverX = clampToCourtX(midX - attackDir * 14);
    var receiverY = midY + 2;

    // Store positioning for animation (similar to score inbound but different locations)
    var positioning = {
        inbounder: {
            sprite: inbounder,
            targetX: inboundX,
            targetY: inboundY,
            startX: inbounder ? inbounder.x : inboundX,
            startY: inbounder ? inbounder.y : inboundY
        },
        receiver: {
            sprite: receiver,
            targetX: receiverX,
            targetY: receiverY,
            startX: receiver ? receiver.x : receiverX,
            startY: receiver ? receiver.y : receiverY
        },
        ballStartX: null,  // No ball pickup needed - ball teleports
        ballStartY: null,
        skipBallPickup: true  // Flag to skip frames 0-24 ball pickup animation
    };

    // Position defenders
    var defenderSprites = inboundTeam === "teamA" ? [teamBPlayer1, teamBPlayer2] : [teamAPlayer1, teamAPlayer2];
    var defenderBaseX = clampToCourtX(midX + attackDir * 12);
    positioning.defenders = [
        {
            sprite: defenderSprites[0],
            targetX: defenderBaseX,
            targetY: midY - 3,
            startX: defenderSprites[0] ? defenderSprites[0].x : defenderBaseX,
            startY: defenderSprites[0] ? defenderSprites[0].y : midY - 3
        },
        {
            sprite: defenderSprites[1],
            targetX: clampToCourtX(defenderBaseX + attackDir * 4),
            targetY: midY + 3,
            startX: defenderSprites[1] ? defenderSprites[1].x : clampToCourtX(defenderBaseX + attackDir * 4),
            startY: defenderSprites[1] ? defenderSprites[1].y : midY + 3
        }
    ];

    stateManager.set("inboundPositioning", positioning, "violation_inbound");

    // Ball teleports to inbounder immediately (no pickup needed)
    stateManager.set("ballCarrier", inbounder, "violation_inbound_ball_teleport");
    stateManager.set("inboundPasser", inbounder, "violation_inbound");

    // Store pass data for after positioning completes
    stateManager.set("inboundPassData", {
        inbounder: inbounder,
        inbounderX: inboundX,
        inbounderY: inboundY,
        receiver: receiver,
        team: inboundTeam
    }, "violation_inbound");

    if (typeof moveBallFrameTo === "function" && inbounder) {
        var inboundBallX = clampToCourtX(Math.round(inboundX));
        var inboundBallY = Math.max(1, Math.min(COURT_HEIGHT, Math.round(inboundY)));
        moveBallFrameTo(inboundBallX, inboundBallY);
    }

    // Alternate inbounder for next time
    inboundAltIndex[inboundTeam] = 1 - inboundIndex;
    stateManager.set("inboundAlternateIndex", inboundAltIndex, "violation_inbound");

    // Trigger possession beep
    triggerPossessionBeep(systems);

    // Transition to INBOUND_SETUP phase for animated player movement
    transitionToViolationInbound(inboundTeam, systems);

    debugLog("[VIOLATION INBOUND] Starting animated positioning for " + inboundTeam);
}

/**
 * Enforce backcourt violation and change possession
 */
function enforceBackcourtViolation(message, systems) {
    var stateManager = systems.stateManager;
    var currentTeam = stateManager.get('currentTeam');
    var ballCarrier = stateManager.get('ballCarrier');

    var violatingTeam = currentTeam;

    // DEBUG: Track violation enforcement
    debugLog(">>> BACKCOURT VIOLATION ENFORCED <<<");
    debugLog(">>> Message: " + message);
    debugLog(">>> Violating Team: " + violatingTeam);
    debugLog(">>> Ball Carrier: " + (ballCarrier ? (ballCarrier.playerData ? ballCarrier.playerData.name : "no-name") : "NULL"));
    debugLog(">>> Carrier Position: " + (ballCarrier ? ("x=" + ballCarrier.x + ", y=" + ballCarrier.y) : "N/A"));

    if (ballCarrier) {
        recordTurnover(ballCarrier, message || "backcourt");
    }

    // Emit event instead of calling UI directly
    emitGameEvent("violation", {
        type: "backcourt",
        team: violatingTeam,
        message: message || "backcourt"
    });

    resetDeadDribbleTimer(systems);
    clearPotentialAssist(systems);

    // Use violation-specific inbound (no ball pickup animation)
    setupViolationInbound(violatingTeam, systems);
}/**
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

    resetDeadDribbleTimer(systems);
    clearPotentialAssist(systems);

    // Use violation-specific inbound (no ball pickup animation)
    setupViolationInbound(violatingTeam, systems);
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

    // VERSION CHECK v1.1.0
    if (!stateManager.get('violationsVersionLogged')) {
        log(LOG_INFO, "NBA JAM: violations.js v1.1.0 - isClearlyInFrontcourt fix loaded");
        stateManager.set('violationsVersionLogged', true, 'version_check');
    }

    // Backcourt violation checks
    if (ballCarrier && !inbounding) {
        // DEFENSIVE FIX: Verify ballCarrier is on the current team
        var carrierTeam = getPlayerTeamName(ballCarrier);
        if (carrierTeam !== currentTeam) {
            // Data corruption - ballCarrier points to wrong team or possession changed without reset
            log(LOG_WARNING, "NBA JAM: TEAM MISMATCH DETECTED! " +
                "currentTeam=" + currentTeam + " but carrier is on " + carrierTeam +
                ", frontcourtEstablished=" + frontcourtEstablished +
                ", carrier.x=" + ballCarrier.x);

            // Reset backcourt state to prevent false violations
            resetBackcourtState(systems);
            stateManager.set("ballCarrier", null, "team_mismatch_fix");
            return violationTriggeredThisFrame;
        }

        var inBackcourt = isInBackcourt(ballCarrier, currentTeam);

        // Check per-team frontcourt status
        var frontcourtStatus = stateManager.get('frontcourtEstablishedByTeam') || {};
        var frontcourtEstablished = frontcourtStatus[currentTeam] || false;

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
            // Decrement grace period if active (regardless of position)
            if (inboundGracePeriod > 0) {
                stateManager.set("inboundGracePeriod", inboundGracePeriod - 1, "grace_period_decrement");
                inboundGracePeriod = inboundGracePeriod - 1; // Update local variable
            }

            // Use more generous threshold for establishing frontcourt
            var clearlyInFrontcourt = isClearlyInFrontcourt(ballCarrier, currentTeam);
            if (clearlyInFrontcourt && inboundGracePeriod === 0) {
                // Only establish frontcourt after grace period expires AND clearly in frontcourt
                log(LOG_INFO, "NBA JAM: Establishing frontcourt for " + currentTeam +
                    " at x=" + ballCarrier.x);
                debugLog("[BACKCOURT] Establishing frontcourt for " + currentTeam);
                setFrontcourtEstablished(currentTeam, systems);
                stateManager.set("backcourtTimer", 0, "frontcourt_established");
            } else if (inBackcourt) {
                // Only count 10-second timer if ACTUALLY in backcourt (not in transition zone)
                var midCourt = Math.floor(COURT_WIDTH / 2);
                var distanceToMidcourt = Math.abs(ballCarrier.x - midCourt);
                var nearHalfCourt = distanceToMidcourt < 6;

                var backcourtTimer = stateManager.get('backcourtTimer');
                stateManager.set("backcourtTimer", backcourtTimer + 1, "backcourt_timer_increment");

                // Increased from 200 to 210 frames (adds 500ms buffer for network latency)
                // Also pause timer increment if player is near half court line
                if (backcourtTimer + 1 >= 210 && !nearHalfCourt) {  // 10.5 seconds at 20 FPS
                    log(LOG_WARNING, "NBA JAM: 10-SECOND BACKCOURT VIOLATION! " +
                        "Team=" + currentTeam +
                        ", carrier.x=" + ballCarrier.x +
                        ", backcourtTimer=" + (backcourtTimer + 1));
                    enforceBackcourtViolation("10-SECOND BACKCOURT VIOLATION!", systems);
                    violationTriggeredThisFrame = true;
                } else if (nearHalfCourt && backcourtTimer + 1 >= 205) {
                    // Near half court - cap timer at 205 frames to give grace period
                    stateManager.set("backcourtTimer", 205, "half_court_grace");
                }
            }
        } else if (inBackcourt) {
            // Frontcourt already established, but player is back in backcourt (over-and-back)
            // Check grace period before enforcing violation
            if (inboundGracePeriod > 0) {
                // Grace period still active - don't enforce violation yet
                // (grace period already decremented above, no need to decrement again)
            } else {
                // Grace period expired - enforce over-and-back violation
                var carrierName = ballCarrier.playerData ? ballCarrier.playerData.name : "unknown";
                log(LOG_WARNING, "NBA JAM: OVER-AND-BACK VIOLATION! " +
                    "Team=" + currentTeam +
                    ", carrier=" + carrierName +
                    ", x=" + ballCarrier.x +
                    ", frontcourtEstablished=" + frontcourtEstablished +
                    ", inBackcourt=" + inBackcourt +
                    ", inboundGracePeriod=" + inboundGracePeriod);
                enforceBackcourtViolation("OVER AND BACK!", systems);
                violationTriggeredThisFrame = true;
            }
        }
    } else if (!inbounding) {
        stateManager.set("backcourtTimer", 0, "no_ball_carrier");
    }

    return violationTriggeredThisFrame;
}
