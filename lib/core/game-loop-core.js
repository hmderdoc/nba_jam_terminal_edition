// Unified Game Loop Core
// Wave 23D Phase 3: Single source of truth for game logic
// Shared by single-player, multiplayer, and demo modes

/**
 * Run a single game frame with mode-specific configuration
 * This is the heart of NBA JAM - all game modes use this core logic
 * 
 * @param {Object} systems - Dependency injection (stateManager, eventBus, etc.)
 * @param {Object} config - Mode-specific configuration
 * @param {boolean} config.isAuthority - Is this client authoritative for game logic?
 * @param {Function} config.handleInput - Input handler callback (mode-specific)
 * @param {number} config.aiInterval - AI update throttle in ms (0 = every frame)
 * @param {number} config.frameDelay - Target frame time in ms
 * @returns {string} Frame result: "continue", "halftime", "violation", "game_over"
 */
function runGameFrame(systems, config) {
    var stateManager = systems.stateManager;
    var now = Date.now();
    var violationTriggeredThisFrame = false;
    var violationPauseInfo = stateManager.get("violationPause");
    var pendingViolationAction = stateManager.get("pendingViolationAction");
    var violationPauseActive = false;

    if (violationPauseInfo && violationPauseInfo.active) {
        var resumeAt = violationPauseInfo.resumeAt || 0;
        if (resumeAt && now >= resumeAt) {
            processPendingViolationAction(pendingViolationAction, systems);
            clearViolationPauseState(stateManager);
        } else {
            violationPauseActive = true;
        }
    } else if (violationPauseInfo) {
        clearViolationPauseState(stateManager);
    }

    var authorityActive = config.isAuthority && !violationPauseActive;
    var overtimeIntroActive = !!stateManager.get("overtimeIntroActive");

    // Store previous positions for ALL players (for lead passing velocity calculation)
    // This must happen BEFORE any movement this frame
    var allPlayers = getAllPlayers();
    for (var p = 0; p < allPlayers.length; p++) {
        var player = allPlayers[p];
        if (player) {
            player.prevX = player.x;
            player.prevY = player.y;
            
            // Refresh buff effects (maintains permanent fire, etc.)
            if (typeof BuffSystem !== "undefined" && BuffSystem.refreshBuffs) {
                BuffSystem.refreshBuffs(player);
            }
        }
    }

    if (systems.jumpBallSystem && typeof systems.jumpBallSystem.update === "function") {
        systems.jumpBallSystem.update(now, systems);
    }

    // Increment tick counter (all clients)
    var tickCounter = stateManager.get("tickCounter");
    stateManager.set("tickCounter", (tickCounter + 1) % 1000000, "game_tick");

    if (authorityActive && systems.rubberBandingSystem && typeof systems.rubberBandingSystem.evaluate === "function") {
        systems.rubberBandingSystem.evaluate(now, systems);
    }

    // SAFETY NET: monitor loose-ball scenarios and trigger emergency scrambles when needed
    if (authorityActive) {
        var currentPhaseForSafetyNet = stateManager.get("phase");
        var safetyNetPhaseType = currentPhaseForSafetyNet ? (currentPhaseForSafetyNet.current || currentPhaseForSafetyNet.name || "NORMAL") : "NORMAL";
        var safetyNetSkipPhases = [PHASE_SHOT_SCORED, PHASE_INBOUND_SETUP, PHASE_SHOT_MISSED, PHASE_REBOUND_SCRAMBLE, PHASE_JUMP_BALL, PHASE_OVERTIME_INTRO];
        var safetyNetShouldSkip = safetyNetSkipPhases.indexOf(safetyNetPhaseType) !== -1;

        if (safetyNetShouldSkip) {
            resetLooseBallWatch(stateManager, "safety_net_phase_skip");
        } else {
            evaluateLooseBallSafetyNet(systems, {
                phaseType: safetyNetPhaseType
            });
        }
    }

    if (authorityActive) {
        var currentPhase = stateManager.get("phase");
        // Wave 24: Stop clocks during dead ball situations (ball is out of bounds)
        // - INBOUND_SETUP: Ball is out of bounds, players moving to positions
        // - SHOT_SCORED: Celebration, ball will go out of bounds for inbound
        var phaseType = currentPhase ? (currentPhase.current || currentPhase.name || "NORMAL") : "NORMAL";
        var clocksShouldRun = (phaseType !== PHASE_INBOUND_SETUP && phaseType !== PHASE_SHOT_SCORED && phaseType !== PHASE_JUMP_BALL && phaseType !== PHASE_OVERTIME_INTRO && phaseType !== PHASE_PAUSED);
        if (overtimeIntroActive) {
            clocksShouldRun = false;
        }
        if (violationPauseActive) {
            clocksShouldRun = false;
        }
        // Wave 24: Pause menu stops clocks (betting games quit confirmation)
        if (stateManager.get("pauseMenuOpen")) {
            clocksShouldRun = false;
        }

        var lastSecondTime = stateManager.get("lastSecondTime");
        // Wave 24: Clock speed multiplier for accelerated games (betting sims use 2x)
        var clockMultiplier = stateManager.get("clockSpeedMultiplier") || 1;
        var effectiveTickMs = Math.max(1, Math.floor(GAME_CLOCK_TICK_MS / clockMultiplier));
        if (clocksShouldRun && now - lastSecondTime >= effectiveTickMs) {
            var timeRemaining = stateManager.get("timeRemaining");
            var shotClock = stateManager.get("shotClock");
            stateManager.set("timeRemaining", timeRemaining - 1, "timer_tick");
            stateManager.set("shotClock", shotClock - 1, "shot_clock_tick");
            stateManager.set("lastSecondTime", now, "timer_tick");

            // Check for halftime (when first half time expires)
            var currentHalf = stateManager.get("currentHalf");
            var totalGameTime = stateManager.get("totalGameTime");
            var halfTime = Math.floor(totalGameTime / 2);
            timeRemaining = stateManager.get("timeRemaining"); // Get updated value

            // Debug every time check
            if (timeRemaining <= 8) {
                debugLog("[GAME LOOP] Time check: half=" + currentHalf + " time=" + timeRemaining + " halfTime=" + halfTime + " total=" + totalGameTime);
            }

            // Check if we've reached halftime threshold
            var halftimeThresholdReached = (currentHalf === 1 && timeRemaining <= halfTime && timeRemaining > 0);
            
            // Check if there's an active shot/ball animation that should complete first
            var shotInProgress = stateManager.get("shotInProgress");
            var ballAnimating = systems.animationSystem && 
                                typeof systems.animationSystem.isBallAnimating === "function" && 
                                systems.animationSystem.isBallAnimating();
            var pendingHalftime = stateManager.get("pendingHalftime");
            
            // If halftime threshold reached and ball is in flight, delay halftime
            if (halftimeThresholdReached && (shotInProgress || ballAnimating)) {
                if (!pendingHalftime) {
                    debugLog("[GAME LOOP] Halftime threshold reached but shot/ball in progress - deferring halftime");
                    stateManager.set("pendingHalftime", true, "halftime_deferred_shot_in_progress");
                }
                // Don't trigger halftime yet - let the shot complete
            } else if (halftimeThresholdReached || pendingHalftime) {
                // Trigger halftime: either fresh threshold OR deferred halftime now ready
                if (pendingHalftime) {
                    debugLog("[GAME LOOP] Deferred halftime now triggering - shot/ball animation complete");
                    stateManager.set("pendingHalftime", false, "halftime_deferred_complete");
                }
                debugLog("[GAME LOOP] HALFTIME TRIGGERED - currentHalf=" + currentHalf + " timeRemaining=" + timeRemaining + " halfTime=" + halfTime);
                stateManager.set("currentHalf", 2, "halftime");
                return "halftime"; // Caller handles halftime screen/logic
            }

            if (FAST_OVERTIME_AUTO_TIE_ENABLED && !FAST_OVERTIME_TEST_HAS_TRIGGERED && currentHalf === 2 && timeRemaining > 0) {
                var inOvertime = !!stateManager.get("isOvertime");
                if (!inOvertime) {
                    var autoTieThreshold = (typeof FAST_OVERTIME_AUTO_TIE_SECONDS === "number" && FAST_OVERTIME_AUTO_TIE_SECONDS >= 0)
                        ? FAST_OVERTIME_AUTO_TIE_SECONDS
                        : 0;
                    if (timeRemaining <= autoTieThreshold) {
                        var scoreState = stateManager.get("score") || { teamA: 0, teamB: 0 };
                        var rawTeamAScore = (typeof scoreState.teamA === "number") ? scoreState.teamA : 0;
                        var rawTeamBScore = (typeof scoreState.teamB === "number") ? scoreState.teamB : 0;
                        if (rawTeamAScore !== rawTeamBScore) {
                            var tieScoreValue = (typeof FAST_OVERTIME_AUTO_TIE_SCORE === "number")
                                ? FAST_OVERTIME_AUTO_TIE_SCORE
                                : Math.max(rawTeamAScore, rawTeamBScore);
                            var tiedScore = { teamA: tieScoreValue, teamB: tieScoreValue };
                            stateManager.set("score", tiedScore, "overtime_test_auto_tie_score");
                            stateManager.set("fastOvertimeOverrideUsed", true, "overtime_test_auto_tie_consumed");
                            FAST_OVERTIME_TEST_HAS_TRIGGERED = true;
                            if (typeof debugLog === "function") {
                                debugLog("[OVERTIME TEST] Auto-tying regulation scores for fast overtime repro (score=" + tieScoreValue + ")");
                            }
                        }
                    }
                }
            }

            // Shot clock violation
            shotClock = stateManager.get("shotClock"); // Get updated value
            if (shotClock <= 0) {
                var currentTeam = stateManager.get("currentTeam");
                announceEvent("shot_clock_violation", { team: currentTeam }, systems);
                var pauseResumeAt = Date.now() + SHOT_CLOCK_RESET_PAUSE_MS;
                stateManager.set("violationPause", {
                    active: true,
                    reason: "shot_clock",
                    resumeAt: pauseResumeAt
                }, "shot_clock_pause_start");
                stateManager.set("pendingViolationAction", {
                    type: "shot_clock",
                    team: currentTeam
                }, "shot_clock_pause_action");
                stateManager.set("shotClock", SHOT_CLOCK_DEFAULT, "shot_clock_reset");
                return "violation";
            }

            // Track ball handler movement to detect stuck AI
            var ballCarrier = stateManager.get("ballCarrier");
            var inbounding = stateManager.get("inbounding");
            if (ballCarrier && !inbounding) {
                var ballHandler = ballCarrier;
                var ballHandlerLastX = stateManager.get("ballHandlerLastX");
                var ballHandlerLastY = stateManager.get("ballHandlerLastY");
                var distanceMoved = Math.sqrt(
                    Math.pow(ballHandler.x - ballHandlerLastX, 2) +
                    Math.pow(ballHandler.y - ballHandlerLastY, 2)
                );

                currentTeam = stateManager.get("currentTeam");
                var opponentTeamName = (currentTeam === "teamA") ? "teamB" : "teamA";
                var opponentTeam = getTeamSprites(opponentTeamName);
                var closestDefender = getClosestPlayer(ballHandler.x, ballHandler.y, opponentTeam);
                var ballHandlerStuckTimer = stateManager.get("ballHandlerStuckTimer");

                // Debug NaN issue
                if (closestDefender && ballHandlerStuckTimer > 0 && ballHandlerStuckTimer % 10 === 0) {
                    debugLog("[STUCK DEBUG] ballHandler coords: (" + ballHandler.x + "," + ballHandler.y +
                        "), closestDefender coords: (" + closestDefender.x + "," + closestDefender.y + ")");
                }

                var guardDistance = closestDefender ? getSpriteDistance(ballHandler, closestDefender) : 999;
                var closelyGuarded = guardDistance !== null && guardDistance !== undefined && !isNaN(guardDistance) && guardDistance <= 4;

                // DIAGNOSTIC: Track stuck timer progression every 5 frames
                if (ballHandlerStuckTimer > 0 && ballHandlerStuckTimer % 5 === 0) {
                    debugLog("[STUCK DIAG] " + (ballHandler.playerData ? ballHandler.playerData.name : "?") +
                        " stuckTimer=" + ballHandlerStuckTimer + 
                        " distMoved=" + distanceMoved.toFixed(2) +
                        " closelyGuarded=" + closelyGuarded +
                        " guardDist=" + (guardDistance ? guardDistance.toFixed(1) : "?") +
                        " hasDribble=" + (ballHandler.playerData ? ballHandler.playerData.hasDribble : "?") +
                        " isHuman=" + ballHandler.isHuman);
                }

                if (distanceMoved < 3) {
                    stateManager.set("ballHandlerStuckTimer", ballHandlerStuckTimer + 1, "stuck_timer_increment");

                    // Debug stuck detection
                    if (ballHandlerStuckTimer > 0 && ballHandlerStuckTimer % 10 === 0) {
                        var defenderInfo = closestDefender ?
                            (closestDefender.playerData ? closestDefender.playerData.name : "no-name") + " at (" + closestDefender.x + "," + closestDefender.y + ")" :
                            "NULL";
                        debugLog("[STUCK DETECT] " + (ballHandler.playerData ? ballHandler.playerData.name : "unknown") +
                            " at (" + ballHandler.x + "," + ballHandler.y + ")" +
                            " stuck for " + ballHandlerStuckTimer + " frames, guarded=" + closelyGuarded +
                            ", guardDist=" + (guardDistance !== null && guardDistance !== undefined ? guardDistance.toFixed(1) : "NULL") +
                            ", defender=" + defenderInfo +
                            ", hasDribble=" + (ballHandler.playerData ? ballHandler.playerData.hasDribble : "?"));
                    }

                    // CLOSELY GUARDED: Pick up dribble after 8 stuck frames
                    if (!ballHandler.isHuman &&
                        ballHandler.playerData &&
                        ballHandler.playerData.hasDribble !== false &&
                        closelyGuarded &&
                        stateManager.get("ballHandlerStuckTimer") >= 8) {
                        debugLog("[STUCK DETECT] Picking up dribble for " + ballHandler.playerData.name + " after " + ballHandlerStuckTimer + " stuck frames (closely guarded)");
                        pickUpDribble(ballHandler, "stuck", systems);

                        // Trigger decision evaluation (same as post-shove)
                        stateManager.set("ballCarrierNeedsDecision", true, "stuck_pickup_decision");
                        stateManager.set("ballCarrierDecisionTime", Date.now(), "stuck_pickup_decision_time");
                        debugLog("[STUCK DETECT] Decision flag set - should evaluate shot vs pass");

                        // Reset stuck timer - we've taken action, don't spam STUCK BLOCKED
                        stateManager.set("ballHandlerStuckTimer", 0, "stuck_pickup_reset");
                    }
                    // NOT CLOSELY GUARDED: After longer stuck period (20 frames), force action without picking up dribble
                    // This handles cases where AI is frozen but defender isn't close enough to trigger pickup
                    else if (!ballHandler.isHuman &&
                             ballHandler.playerData &&
                             ballHandler.playerData.hasDribble !== false &&
                             !closelyGuarded &&
                             stateManager.get("ballHandlerStuckTimer") >= 20) {
                        debugLog("[STUCK DETECT] AI stuck without pressure for " + ballHandlerStuckTimer + " frames - forcing action for " + ballHandler.playerData.name);
                        
                        // Trigger AI to make a move (pass, drive, or shoot) without picking up dribble
                        stateManager.set("ballCarrierNeedsDecision", true, "stuck_no_pressure_decision");
                        stateManager.set("ballCarrierDecisionTime", Date.now(), "stuck_no_pressure_decision_time");
                        stateManager.set("ballHandlerStuckTimer", 0, "stuck_no_pressure_reset");
                    }
                    // ESCALATION: Dribble is dead, no pending decision, still stuck
                    else if (stateManager.get("ballHandlerStuckTimer") >= 8 &&
                               !stateManager.get("ballCarrierNeedsDecision") &&
                               ballHandler.playerData && ballHandler.playerData.hasDribble === false) {
                        // Dribble is dead, no pending decision, and still stuck - escalate!
                        // This means the decision was made but didn't resolve the situation
                        var deadFrames = stateManager.get("ballHandlerDeadFrames") || 0;
                        
                        // Only log periodically to avoid spam (every 10 frames)
                        if (ballHandlerStuckTimer % 10 === 0) {
                            debugLog("[STUCK ESCALATE] Dead dribble stuck:" +
                                " isHuman=" + ballHandler.isHuman +
                                " closelyGuarded=" + closelyGuarded +
                                " guardDist=" + (guardDistance ? guardDistance.toFixed(1) : "?") +
                                " stuckTimer=" + ballHandlerStuckTimer +
                                " deadFrames=" + deadFrames);
                        }
                        
                        // Force decision re-evaluation every 30 stuck frames if prior decision didn't resolve
                        if (ballHandlerStuckTimer > 0 && ballHandlerStuckTimer % 30 === 0) {
                            debugLog("[STUCK ESCALATE] Re-triggering decision for " + 
                                (ballHandler.playerData ? ballHandler.playerData.name : "?") + 
                                " after " + ballHandlerStuckTimer + " frames with dead dribble");
                            stateManager.set("ballCarrierNeedsDecision", true, "stuck_escalate_decision");
                            stateManager.set("ballCarrierDecisionTime", Date.now(), "stuck_escalate_decision_time");
                        }
                    }
                } else {
                    if (ballHandlerStuckTimer > 5) {
                        debugLog("[STUCK DETECT] Timer reset - " + (ballHandler.playerData ? ballHandler.playerData.name : "unknown") +
                            " moved " + distanceMoved.toFixed(1) + " units (was stuck for " + ballHandlerStuckTimer + " frames)");
                    }
                    stateManager.set("ballHandlerStuckTimer", 0, "ball_handler_moving");
                }

                stateManager.set("ballHandlerLastX", ballHandler.x, "ball_handler_tracking");
                stateManager.set("ballHandlerLastY", ballHandler.y, "ball_handler_tracking");

                // Dead dribble detection (closely guarded with no dribble)
                if (ballHandler.playerData && ballHandler.playerData.hasDribble === false) {
                    stateManager.set("closelyGuardedDistance", guardDistance, "closely_guarded_tracking");

                    if (!closelyGuarded) {
                        stateManager.set("ballHandlerDeadSince", null, "not_closely_guarded");
                        stateManager.set("ballHandlerDeadFrames", 0, "not_closely_guarded");
                        stateManager.set("ballHandlerDeadForcedShot", false, "not_closely_guarded");
                    } else if (!stateManager.get("ballHandlerDeadSince")) {
                        stateManager.set("ballHandlerDeadSince", now, "closely_guarded_start");
                        stateManager.set("ballHandlerDeadFrames", 1, "closely_guarded_start");
                    } else {
                        var ballHandlerDeadFrames = stateManager.get("ballHandlerDeadFrames");
                        stateManager.set("ballHandlerDeadFrames", ballHandlerDeadFrames + 1, "dead_dribble_frames");
                        var deadElapsed = now - stateManager.get("ballHandlerDeadSince");
                        if (!stateManager.get("ballHandlerDeadForcedShot") && deadElapsed >= 4500) {
                            if (ballHandler && !ballHandler.isHuman) {
                                stateManager.set("ballHandlerDeadForcedShot", true, "forced_shot_triggered");
                                attemptShot(systems);
                                stateManager.set("ballHandlerDeadSince", now, "forced_shot_reset");
                                stateManager.set("ballHandlerDeadFrames", 0, "forced_shot_reset");
                                return "continue"; // Skip rest of frame
                            }
                        }
                        if (!violationTriggeredThisFrame && deadElapsed >= 5000) {
                            enforceFiveSecondViolation(systems);
                            violationTriggeredThisFrame = true;
                        }
                    }
                } else {
                    resetDeadDribbleTimer(systems);
                }

                // Frontcourt advancement tracking
                currentTeam = stateManager.get("currentTeam");
                var attackDir = (currentTeam === "teamA") ? 1 : -1;
                var ballHandlerProgressOwner = stateManager.get("ballHandlerProgressOwner");
                if (ballHandlerProgressOwner !== ballHandler) {
                    stateManager.set("ballHandlerProgressOwner", ballHandler, "new_ball_handler");
                    stateManager.set("ballHandlerFrontcourtStartX", ballHandler.x, "new_ball_handler");
                    stateManager.set("ballHandlerAdvanceTimer", 0, "new_ball_handler");
                }

                var handlerInBackcourt = isInBackcourt(ballHandler, currentTeam);

                if (!stateManager.get("frontcourtEstablished") || handlerInBackcourt) {
                    stateManager.set("ballHandlerFrontcourtStartX", ballHandler.x, "backcourt_position");
                    stateManager.set("ballHandlerAdvanceTimer", 0, "backcourt_position");
                } else {
                    var ballHandlerFrontcourtStartX = stateManager.get("ballHandlerFrontcourtStartX");
                    var forwardDelta = (ballHandler.x - ballHandlerFrontcourtStartX) * attackDir;
                    if (forwardDelta < -1) {
                        stateManager.set("ballHandlerFrontcourtStartX", ballHandler.x, "backward_movement");
                        forwardDelta = 0;
                    }
                    if (forwardDelta < 4) {
                        var ballHandlerAdvanceTimer = stateManager.get("ballHandlerAdvanceTimer");
                        stateManager.set("ballHandlerAdvanceTimer", ballHandlerAdvanceTimer + 1, "advance_timer_increment");
                    } else {
                        stateManager.set("ballHandlerFrontcourtStartX", ballHandler.x, "forward_progress");
                        stateManager.set("ballHandlerAdvanceTimer", 0, "forward_progress");
                    }
                }
            } else {
                stateManager.set("ballHandlerAdvanceTimer", 0, "no_ball_carrier");
                stateManager.set("ballHandlerProgressOwner", null, "no_ball_carrier");
                resetDeadDribbleTimer(systems);
            }
        }

        // Unified violation checking
        violationTriggeredThisFrame = checkViolations(violationTriggeredThisFrame, systems);

        if (violationTriggeredThisFrame) {
            stateManager.set("lastSecondTime", Date.now(), "violation_reset");
            return "violation"; // Skip rest of frame
        }
    }
    
    // Check for pending halftime (shot/ball was in progress at halftime threshold)
    // This check runs outside the clock tick block in case clocks are stopped
    if (authorityActive) {
        var pendingHalftimeCheck = stateManager.get("pendingHalftime");
        if (pendingHalftimeCheck) {
            var shotStillInProgress = stateManager.get("shotInProgress");
            var ballStillAnimating = systems.animationSystem && 
                                     typeof systems.animationSystem.isBallAnimating === "function" && 
                                     systems.animationSystem.isBallAnimating();
            
            if (!shotStillInProgress && !ballStillAnimating) {
                debugLog("[GAME LOOP] Pending halftime now ready - shot/ball animation complete");
                stateManager.set("pendingHalftime", false, "halftime_deferred_triggered");
                stateManager.set("currentHalf", 2, "halftime");
                return "halftime";
            }
        }
    }

    // Handle block jump animation (all clients for visual consistency)
    var blockJumpTimer = stateManager.get("blockJumpTimer");
    if (blockJumpTimer > 0) {
        var blocker = stateManager.get("activeBlock");
        if (blocker && blocker.frame) {
            var duration = stateManager.get("activeBlockDuration") || BLOCK_JUMP_DURATION;
            if (duration < 1) duration = BLOCK_JUMP_DURATION;
            var elapsed = duration - blockJumpTimer;
            if (elapsed < 0) elapsed = 0;
            var progress = elapsed / duration;
            if (progress > 1) progress = 1;
            var totalHeight = BLOCK_JUMP_HEIGHT + (blocker.blockJumpHeightBoost || 0);
            var jumpHeight = Math.sin(progress * Math.PI) * totalHeight;
            var spriteHeight = (blocker.frame && blocker.frame.height) ? blocker.frame.height : 4;
            var spriteWidth = (blocker.frame && blocker.frame.width) ? blocker.frame.width : 4;
            var jumpY = blocker.blockOriginalY - Math.round(jumpHeight);
            blocker.moveTo(blocker.x, jumpY);

            var groundBottom = blocker.blockOriginalY + spriteHeight;
            var currentBottom = jumpY + spriteHeight;
            var previousBottom = (typeof blocker.prevJumpBottomY === "number") ? blocker.prevJumpBottomY : groundBottom;
            var ascending = currentBottom <= previousBottom;
            var blockPatternAsc = "^   ^";
            var blockPatternDesc = "v   v";
            var patternWidth = blockPatternAsc.length;
            var centerColumn = blocker.x + Math.floor(spriteWidth / 2);
            var minBase = 1;
            var maxBase = Math.max(1, COURT_WIDTH - patternWidth + 1);
            var baseColumn = clamp(centerColumn - Math.floor(patternWidth / 2), minBase, maxBase);
            updateJumpIndicator(blocker, {
                groundBottom: groundBottom,
                currentBottom: currentBottom,
                ascending: ascending,
                horizontalDir: blocker.jumpIndicatorDir,
                spriteWidth: spriteWidth,
                spriteHeight: spriteHeight,
                spriteHalfWidth: Math.floor(spriteWidth / 2),
                spriteHalfHeight: Math.floor(spriteHeight / 2),
                baseColumn: baseColumn,
                patternAscend: blockPatternAsc,
                patternDescend: blockPatternDesc
            });
            blocker.prevJumpBottomY = currentBottom;

            blockJumpTimer = stateManager.get("blockJumpTimer");
            stateManager.set("blockJumpTimer", blockJumpTimer - 1, "block_timer_decrement");

            if (stateManager.get("blockJumpTimer") <= 0) {
                clearJumpIndicator(blocker);
                blocker.moveTo(blocker.x, blocker.blockOriginalY);
                blocker.prevJumpBottomY = null;
                blocker.blockJumpHeightBoost = 0;
                stateManager.set("activeBlock", null, "block_complete");
                stateManager.set("activeBlockDuration", null, "block_complete");
            }
        } else {
            stateManager.set("blockJumpTimer", 0, "block_invalid");
            stateManager.set("activeBlock", null, "block_invalid");
            stateManager.set("activeBlockDuration", null, "block_invalid");
        }
    }

    // Input handling (mode-specific callback)
    if (config.handleInput) {
        config.handleInput();
    }

    // AI updates (authority only, throttled by aiInterval)
    // Wave 23D: Skip AI during celebration/transition phases to prevent premature reactions
    // Wave 24: Skip AI when game is paused (betting quit confirmation)
    if (authorityActive) {
        var currentPhase = stateManager.get("phase");
        var phaseName = currentPhase ? (currentPhase.current || currentPhase.name || "NORMAL") : "NORMAL";
        var skipAIPhases = [PHASE_SHOT_SCORED, PHASE_INBOUND_SETUP, PHASE_SHOT_MISSED, PHASE_JUMP_BALL, PHASE_OVERTIME_INTRO, PHASE_PAUSED];
        var shouldRunAI = skipAIPhases.indexOf(phaseName) === -1 && !overtimeIntroActive && !stateManager.get("pauseMenuOpen");

        if (shouldRunAI) {
            var lastAIUpdateTime = stateManager.get("lastAIUpdateTime");
            if (config.aiInterval === 0 || (now - lastAIUpdateTime >= config.aiInterval)) {
                updateAI(systems);
                stateManager.set("lastAIUpdateTime", now, "ai_update");
            }
        }
    }

    // Turbo recharge (all players, all clients)
    var allPlayers = getAllPlayers();
    for (var p = 0; p < allPlayers.length; p++) {
        var player = allPlayers[p];
        if (player.playerData && !player.playerData.turboActive) {
            player.playerData.rechargeTurbo(TURBO_RECHARGE_RATE);
        }
    }

    // Recovery frame decrement (all players, authority only)
    // This handles human players - AI players are handled by coordinator.js
    // CRITICAL: Without this, human players get stuck in recovery states permanently
    if (authorityActive) {
        for (var p = 0; p < allPlayers.length; p++) {
            var player = allPlayers[p];
            if (!player || !player.playerData || !player.isHuman) continue;

            // Decrement shove recovery (victim stunned after being shoved)
            if (player.playerData.shoveRecoveryFrames && player.playerData.shoveRecoveryFrames > 0) {
                player.playerData.shoveRecoveryFrames--;
                if (player.playerData.shoveRecoveryFrames <= 0) {
                    // Recovery ended - start turbo disabled period
                    var turboDisabledFrames = (typeof TIMING_CONSTANTS === "object" && TIMING_CONSTANTS.SHOVE &&
                        TIMING_CONSTANTS.SHOVE.VICTIM_RECOVERY && TIMING_CONSTANTS.SHOVE.VICTIM_RECOVERY.turboDisabledFrames)
                        ? TIMING_CONSTANTS.SHOVE.VICTIM_RECOVERY.turboDisabledFrames : 12;
                    player.playerData.turboDisabledFrames = turboDisabledFrames;
                }
            }

            // Decrement turbo disabled frames (player can move but not turbo)
            if (player.playerData.turboDisabledFrames && player.playerData.turboDisabledFrames > 0) {
                player.playerData.turboDisabledFrames--;
                player.playerData.turboActive = false;
            }

            // Decrement steal recovery
            if (player.playerData.stealRecoverFrames && player.playerData.stealRecoverFrames > 0) {
                player.playerData.stealRecoverFrames--;
            }

            // Decrement shove failure stun
            if (player.playerData.shoveFailureStun && player.playerData.shoveFailureStun > 0) {
                player.playerData.shoveFailureStun--;
            }
        }
    }

    // Physics (authority only)
    if (authorityActive && !overtimeIntroActive) {
        checkSpriteCollision();
        for (var p = 0; p < allPlayers.length; p++) {
            checkBoundaries(allPlayers[p]);
        }
    }

    // Update visuals (all clients render)
    updateAnnouncer(systems);

    // Game phase updates (authority only)
    if (authorityActive) {
        updateGamePhase(config.frameDelay, systems);
    }

    // Sprite rendering (all clients) - Wave 23D: Always update sprites, even if court not redrawn
    updateSpriteRendering(systems);

    // Animation system (all clients)
    systems.animationSystem.update();

    if (systems.statTrailSystem && typeof systems.statTrailSystem.update === "function") {
        systems.statTrailSystem.update();
    }

    // Process queued pass intents once animations complete (authority only)
    if (authorityActive && systems.passingSystem && typeof systems.passingSystem.processQueuedPass === "function") {
        systems.passingSystem.processQueuedPass();
    }

    // Rebound scramble (all clients for rendering)
    updateReboundScramble(systems);

    // Knockback animations (all clients)
    updateKnockbackAnimations();

    // Rendering (all clients, throttled to 60ms)
    // Wave 23D: Court is static - only redraw when dirty flag set
    var lastUpdateTime = stateManager.get("lastUpdateTime");
    var courtNeedsRedraw = stateManager.get("courtNeedsRedraw");
    var timeSinceLastUpdate = now - lastUpdateTime;

    if (typeof debugLog === "function" && courtNeedsRedraw) {
        debugLog("[RENDER CHECK] timeSinceLastUpdate=" + timeSinceLastUpdate + ", courtNeedsRedraw=" + courtNeedsRedraw);
    }

    if (timeSinceLastUpdate >= COURT_RENDER_THROTTLE_MS) {
        if (!overtimeIntroActive) {
            if (courtNeedsRedraw) {
                if (typeof debugLog === "function") {
                    debugLog("[RENDER] Drawing court due to courtNeedsRedraw=true");
                }
                drawCourt(systems);
                stateManager.set("courtNeedsRedraw", false, "court_redrawn");
            }

            if (typeof drawHoops === "function") {
                drawHoops(systems);
            }

            if (courtFrame && typeof cycleFrame === "function") {
                cycleFrame(courtFrame);
            }

            if (leftHoopFrame && typeof cycleFrame === "function") {
                cycleFrame(leftHoopFrame);
            }
            if (rightHoopFrame && typeof cycleFrame === "function") {
                cycleFrame(rightHoopFrame);
            }

            if (trailFrame && typeof cycleFrame === "function") {
                cycleFrame(trailFrame);
                if (ballFrame && ballFrame.is_open && typeof ballFrame.top === "function") {
                    ballFrame.top();
                }
            }

            Sprite.cycle();
        }

        stateManager.set("lastUpdateTime", now, "render_update");
    }

    var lastHudUpdateTime = stateManager.get("lastHudUpdateTime") || 0;
    if (now - lastHudUpdateTime >= HUD_RENDER_INTERVAL_MS) {
        drawScore(systems);
        if (scoreFrame && typeof cycleFrame === "function") {
            cycleFrame(scoreFrame);
        }
        stateManager.set("lastHudUpdateTime", now, "hud_render_update");
    }

    // A final cycle for any high-frequency updates that happened after the main render block.
    Sprite.cycle();

    // Wave 24: Draw pause menu overlay for betting game quit confirmation
    if (stateManager.get("pauseMenuOpen")) {
        drawPauseMenuOverlay(stateManager);
    }

    // Game end check
    var remaining = stateManager.get("timeRemaining");
    if (remaining <= 0) {
        if (typeof maybeStartOvertime === "function" && maybeStartOvertime(systems)) {
            return "continue";
        }
        stateManager.set("gameRunning", false, "game_ended");
        return "game_over";
    }

    return "continue";
}

var DEFAULT_SAFETY_NET_CONFIG = {
    NULL_CARRIER_FRAME_LIMIT: 18,
    OUT_OF_BOUNDS_FRAME_LIMIT: 10,
    STALE_INBOUND_FRAME_LIMIT: 90,
    BALL_OUT_OF_BOUNDS_MARGIN: 1
};

function evaluateLooseBallSafetyNet(systems, options) {
    options = options || {};
    if (!systems || !systems.stateManager) {
        return false;
    }

    var stateManager = systems.stateManager;
    var config = resolveSafetyNetConfig();
    var watch = getLooseBallWatch(stateManager);
    var updated = false;

    var ballCarrier = stateManager.get("ballCarrier");
    var shotInProgress = stateManager.get("shotInProgress");
    var reboundActive = stateManager.get("reboundActive");
    var inbounding = stateManager.get("inbounding");
    var ballAnimActive = isBallAnimationActive();
    var shouldHaveBallCarrier = !shotInProgress && !reboundActive && !inbounding && !ballAnimActive;

    if (shouldHaveBallCarrier) {
        if (!ballCarrier) {
            watch.framesWithoutCarrier += 1;
            updated = true;
        } else if (watch.framesWithoutCarrier !== 0) {
            watch.framesWithoutCarrier = 0;
            updated = true;
        }
    } else if (watch.framesWithoutCarrier !== 0) {
        watch.framesWithoutCarrier = 0;
        updated = true;
    }

    var ballX = stateManager.get("ballX");
    var ballY = stateManager.get("ballY");
    var ballOutOfBounds = false;
    if (typeof ballX === "number" && typeof ballY === "number" && !isNaN(ballX) && !isNaN(ballY)) {
        ballOutOfBounds = isBallOutOfBounds(ballX, ballY, config.BALL_OUT_OF_BOUNDS_MARGIN);
    }

    if (!ballCarrier && !reboundActive && !shotInProgress && ballOutOfBounds) {
        watch.framesBallOutOfBounds += 1;
        updated = true;
    } else if (watch.framesBallOutOfBounds !== 0) {
        watch.framesBallOutOfBounds = 0;
        updated = true;
    }

    var phaseType = options.phaseType || "NORMAL";
    var queuedPassIntent = stateManager.get("queuedPassIntent");
    var inboundPasser = stateManager.get("inboundPasser");
    var inboundGrace = stateManager.get("inboundGracePeriod");
    var inboundGraceActive = typeof inboundGrace === "number" && inboundGrace > 0;
    var staleInboundCandidate = inbounding && !ballCarrier && !ballAnimActive && phaseType !== PHASE_INBOUND_SETUP;

    if (staleInboundCandidate) {
        var inboundWorkInFlight = !!queuedPassIntent || !!inboundPasser;
        if (!inboundGraceActive && !inboundWorkInFlight) {
            watch.staleInboundFrames += 1;
            updated = true;
        } else if (watch.staleInboundFrames !== 0) {
            watch.staleInboundFrames = 0;
            updated = true;
        }
    } else if (watch.staleInboundFrames !== 0) {
        watch.staleInboundFrames = 0;
        updated = true;
    }

    var triggerReason = null;
    if (watch.framesWithoutCarrier >= config.NULL_CARRIER_FRAME_LIMIT) {
        triggerReason = "null_carrier_timeout";
    } else if (watch.framesBallOutOfBounds >= config.OUT_OF_BOUNDS_FRAME_LIMIT) {
        triggerReason = "ball_out_of_bounds_timeout";
    } else if (watch.staleInboundFrames >= config.STALE_INBOUND_FRAME_LIMIT) {
        triggerReason = "stale_inbound_timeout";
    }

    if (triggerReason) {
        if (typeof debugLog === "function") {
            debugLog("[SAFETY NET] Triggering loose-ball recovery (" + triggerReason + ") counters=" + JSON.stringify(watch) +
                ", phase=" + phaseType + ", inbounding=" + inbounding);
        }
        triggerLooseBallRecovery(stateManager, systems, watch, triggerReason);
        return true;
    }

    if (updated) {
        stateManager.set("looseBallSafetyNet", watch, "safety_net_watch_update");
    }

    return false;
}

function resetLooseBallWatch(stateManager, reason) {
    if (!stateManager) return;
    var existing = stateManager.get("looseBallSafetyNet");
    var needsReset = true;
    if (existing && typeof existing === "object") {
        if ((existing.framesWithoutCarrier || 0) === 0 &&
            (existing.framesBallOutOfBounds || 0) === 0 &&
            (existing.staleInboundFrames || 0) === 0) {
            needsReset = false;
        }
    }

    if (needsReset) {
        stateManager.set("looseBallSafetyNet", {
            framesWithoutCarrier: 0,
            framesBallOutOfBounds: 0,
            staleInboundFrames: 0
        }, reason || "safety_net_reset");
    }
}

function getLooseBallWatch(stateManager) {
    var existing = stateManager.get("looseBallSafetyNet");
    if (!existing || typeof existing !== "object") {
        var initial = {
            framesWithoutCarrier: 0,
            framesBallOutOfBounds: 0,
            staleInboundFrames: 0
        };
        stateManager.set("looseBallSafetyNet", initial, "safety_net_watch_init");
        return initial;
    }

    return {
        framesWithoutCarrier: toNonNegativeInteger(existing.framesWithoutCarrier, 0),
        framesBallOutOfBounds: toNonNegativeInteger(existing.framesBallOutOfBounds, 0),
        staleInboundFrames: toNonNegativeInteger(existing.staleInboundFrames, 0)
    };
}

function triggerLooseBallRecovery(stateManager, systems, countersSnapshot, triggerReason) {
    var ballPosition = getSafeBallPosition(stateManager);
    var reasonTag = "safety_net_trigger_" + triggerReason;

    stateManager.set("inbounding", false, reasonTag);
    stateManager.set("inboundPasser", null, reasonTag);
    stateManager.set("queuedPassIntent", null, reasonTag);

    if (typeof debugLog === "function") {
        debugLog("[SAFETY NET] Emergency scramble at (" + ballPosition.x + "," + ballPosition.y + ") reason=" + triggerReason);
    }

    announceEvent("loose_ball", {
        reason: triggerReason,
        counters: countersSnapshot
    }, systems);
    createRebound(ballPosition.x, ballPosition.y, systems, true);

    resetLooseBallWatch(stateManager, "safety_net_reset_after_trigger");
}

function getSafeBallPosition(stateManager) {
    var ballX = stateManager.get("ballX");
    var ballY = stateManager.get("ballY");
    if (typeof ballX === "number" && typeof ballY === "number" && !isNaN(ballX) && !isNaN(ballY)) {
        return {
            x: Math.round(ballX),
            y: Math.round(ballY)
        };
    }
    return {
        x: Math.floor(COURT_WIDTH / 2),
        y: Math.floor(COURT_HEIGHT / 2)
    };
}

function isBallAnimationActive() {
    if (typeof animationSystem === "undefined" || !animationSystem || !animationSystem.animations) {
        return false;
    }
    for (var i = 0; i < animationSystem.animations.length; i++) {
        if (animationSystem.animations[i].affectsBall) {
            return true;
        }
    }
    return false;
}

function isBallOutOfBounds(ballX, ballY, margin) {
    var bounds = (typeof PLAYER_BOUNDARIES === "object" && PLAYER_BOUNDARIES) ? PLAYER_BOUNDARIES : null;
    var minX = bounds && typeof bounds.minX === "number" ? bounds.minX : 0;
    var minY = bounds && typeof bounds.minY === "number" ? bounds.minY : 0;
    var maxXOffset = bounds && typeof bounds.movementMaxXOffset === "number" ? bounds.movementMaxXOffset : (bounds && typeof bounds.maxXOffset === "number" ? bounds.maxXOffset : 0);
    var maxYOffset = bounds && typeof bounds.maxYOffset === "number" ? bounds.maxYOffset : 0;
    var marginTiles = (typeof margin === "number" && !isNaN(margin)) ? margin : DEFAULT_SAFETY_NET_CONFIG.BALL_OUT_OF_BOUNDS_MARGIN;

    var minLegalX = minX - marginTiles;
    var maxLegalX = COURT_WIDTH - maxXOffset + marginTiles;
    var minLegalY = minY - marginTiles;
    var maxLegalY = COURT_HEIGHT - maxYOffset + marginTiles;

    return (ballX < minLegalX || ballX > maxLegalX || ballY < minLegalY || ballY > maxLegalY);
}

function resolveSafetyNetConfig() {
    var source = (typeof SAFETY_NET_CONFIG === "object" && SAFETY_NET_CONFIG) ? SAFETY_NET_CONFIG : {};
    return {
        NULL_CARRIER_FRAME_LIMIT: toNonNegativeInteger(source.NULL_CARRIER_FRAME_LIMIT, DEFAULT_SAFETY_NET_CONFIG.NULL_CARRIER_FRAME_LIMIT),
        OUT_OF_BOUNDS_FRAME_LIMIT: toNonNegativeInteger(source.OUT_OF_BOUNDS_FRAME_LIMIT, DEFAULT_SAFETY_NET_CONFIG.OUT_OF_BOUNDS_FRAME_LIMIT),
        STALE_INBOUND_FRAME_LIMIT: toNonNegativeInteger(source.STALE_INBOUND_FRAME_LIMIT, DEFAULT_SAFETY_NET_CONFIG.STALE_INBOUND_FRAME_LIMIT),
        BALL_OUT_OF_BOUNDS_MARGIN: toNonNegativeInteger(source.BALL_OUT_OF_BOUNDS_MARGIN, DEFAULT_SAFETY_NET_CONFIG.BALL_OUT_OF_BOUNDS_MARGIN)
    };
}

function toNonNegativeInteger(value, fallback) {
    if (typeof value === "number" && isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return Math.max(0, Math.floor(typeof fallback === "number" ? fallback : 0));
}

// Export for use in game loops
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runGameFrame: runGameFrame,
        __testHooks: {
            evaluateLooseBallSafetyNet: evaluateLooseBallSafetyNet,
            resetLooseBallWatch: resetLooseBallWatch,
            resolveSafetyNetConfig: resolveSafetyNetConfig,
            isBallOutOfBounds: isBallOutOfBounds
        }
    };
}

function clearViolationPauseState(stateManager) {
    stateManager.set("violationPause", null, "violation_pause_clear");
    stateManager.set("pendingViolationAction", null, "violation_pause_clear");
}

function processPendingViolationAction(action, systems) {
    if (!action || !action.type) return;
    switch (action.type) {
        case "shot_clock":
            switchPossession(systems);
            break;
        default:
            break;
    }
}
/**
 * Wave 24: Draw pause menu overlay for betting game quit confirmation
 * Shows a centered dialog asking user to confirm forfeit
 * @param {Object} stateManager - State manager instance
 */
function drawPauseMenuOverlay(stateManager) {
    var centerY = Math.floor(console.screen_rows / 2);
    var centerX = Math.floor(console.screen_columns / 2);
    var boxWidth = 44;
    var boxHalf = Math.floor(boxWidth / 2);

    // Build border strings
    var topBorder = "";
    var bottomBorder = "";
    var midLine = "";
    for (var i = 0; i < boxWidth - 2; i++) {
        topBorder += String.fromCharCode(205); // ═
        bottomBorder += String.fromCharCode(205);
        midLine += " ";
    }

    var isBettingGame = stateManager.get("isBettingGame");
    var forfeitMsg = isBettingGame ? "Quitting forfeits your bet!" : "Quit this game?";

    // Draw box
    console.gotoxy(centerX - boxHalf, centerY - 4);
    console.print("\1h\1y" + String.fromCharCode(201) + topBorder + String.fromCharCode(187) + "\1n");

    console.gotoxy(centerX - boxHalf, centerY - 3);
    console.print("\1h\1y" + String.fromCharCode(186) + "\1n" + midLine + "\1h\1y" + String.fromCharCode(186) + "\1n");

    console.gotoxy(centerX - boxHalf, centerY - 2);
    console.print("\1h\1y" + String.fromCharCode(186) + "\1n       \1h\1w=== GAME PAUSED ===\1n        \1h\1y" + String.fromCharCode(186) + "\1n");

    console.gotoxy(centerX - boxHalf, centerY - 1);
    console.print("\1h\1y" + String.fromCharCode(186) + "\1n" + midLine + "\1h\1y" + String.fromCharCode(186) + "\1n");

    // Forfeit warning line (centered)
    var msgPad = Math.floor((boxWidth - 2 - forfeitMsg.length) / 2);
    var msgPadStr = "";
    for (var p = 0; p < msgPad; p++) msgPadStr += " ";
    var msgLine = msgPadStr + forfeitMsg;
    while (msgLine.length < boxWidth - 2) msgLine += " ";

    console.gotoxy(centerX - boxHalf, centerY);
    console.print("\1h\1y" + String.fromCharCode(186) + "\1n\1r" + msgLine + "\1n\1h\1y" + String.fromCharCode(186) + "\1n");

    console.gotoxy(centerX - boxHalf, centerY + 1);
    console.print("\1h\1y" + String.fromCharCode(186) + "\1n" + midLine + "\1h\1y" + String.fromCharCode(186) + "\1n");

    console.gotoxy(centerX - boxHalf, centerY + 2);
    console.print("\1h\1y" + String.fromCharCode(186) + "\1n    \1h\1gY\1n\1w = Quit    \1h\1cN\1n\1w = Resume Game     \1h\1y" + String.fromCharCode(186) + "\1n");

    console.gotoxy(centerX - boxHalf, centerY + 3);
    console.print("\1h\1y" + String.fromCharCode(186) + "\1n" + midLine + "\1h\1y" + String.fromCharCode(186) + "\1n");

    console.gotoxy(centerX - boxHalf, centerY + 4);
    console.print("\1h\1y" + String.fromCharCode(200) + bottomBorder + String.fromCharCode(188) + "\1n");
}