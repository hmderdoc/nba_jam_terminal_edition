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

    // Increment tick counter (all clients)
    var tickCounter = stateManager.get("tickCounter");
    stateManager.set("tickCounter", (tickCounter + 1) % 1000000, "game_tick");

    // Recovery timers (all clients for rendering consistency)
    var recoveryList = getAllPlayers();
    for (var r = 0; r < recoveryList.length; r++) {
        decrementStealRecovery(recoveryList[r]);
    }

    // Timer updates (authority only)
    if (config.isAuthority) {
        var lastSecondTime = stateManager.get("lastSecondTime");
        if (now - lastSecondTime >= 1000) {
            var timeRemaining = stateManager.get("timeRemaining");
            var shotClock = stateManager.get("shotClock");
            stateManager.set("timeRemaining", timeRemaining - 1, "timer_tick");
            stateManager.set("shotClock", shotClock - 1, "shot_clock_tick");
            stateManager.set("lastSecondTime", now, "timer_tick");

            // Check for halftime (when first half time expires)
            var currentHalf = stateManager.get("currentHalf");
            var totalGameTime = stateManager.get("totalGameTime");
            timeRemaining = stateManager.get("timeRemaining"); // Get updated value
            if (currentHalf === 1 && timeRemaining <= totalGameTime / 2) {
                stateManager.set("currentHalf", 2, "halftime");
                return "halftime"; // Caller handles halftime screen/logic
            }

            // Shot clock violation
            shotClock = stateManager.get("shotClock"); // Get updated value
            if (shotClock <= 0) {
                var currentTeam = stateManager.get("currentTeam");
                announceEvent("shot_clock_violation", { team: currentTeam }, systems);
                systems.frameScheduler.waitForNextFrame(1000);
                switchPossession(systems);
                stateManager.set("shotClock", 24, "shot_clock_reset");
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
                var closestDefender = getClosestPlayer(ballHandler.x, ballHandler.y, opponentTeamName);
                var guardDistance = closestDefender ? getSpriteDistance(ballHandler, closestDefender) : 999;
                var closelyGuarded = guardDistance <= 4;

                if (distanceMoved < 3) {
                    var ballHandlerStuckTimer = stateManager.get("ballHandlerStuckTimer");
                    stateManager.set("ballHandlerStuckTimer", ballHandlerStuckTimer + 1, "stuck_timer_increment");
                    if (!ballHandler.isHuman &&
                        ballHandler.playerData &&
                        ballHandler.playerData.hasDribble !== false &&
                        closelyGuarded &&
                        stateManager.get("ballHandlerStuckTimer") >= 8) {
                        pickUpDribble(ballHandler, "stuck", systems);
                    }
                } else {
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
                            enforceFiveSecondViolation();
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
    if (config.isAuthority) {
        var lastAIUpdateTime = stateManager.get("lastAIUpdateTime");
        if (config.aiInterval === 0 || (now - lastAIUpdateTime >= config.aiInterval)) {
            updateAI(systems);
            stateManager.set("lastAIUpdateTime", now, "ai_update");
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

    // Physics (authority only)
    if (config.isAuthority) {
        checkSpriteCollision();
        for (var p = 0; p < allPlayers.length; p++) {
            checkBoundaries(allPlayers[p]);
        }
    }

    // Update visuals (all clients render)
    updateAnnouncer(systems);

    // Game phase updates (authority only)
    if (config.isAuthority) {
        updateGamePhase(config.frameDelay, systems);
    }

    // Sprite rendering (all clients)
    Sprite.cycle();

    // Animation system (all clients)
    systems.animationSystem.update();

    // Rebound scramble (all clients for rendering)
    updateReboundScramble(systems);

    // Knockback animations (all clients)
    updateKnockbackAnimations();

    // Rendering (all clients, throttled to 60ms)
    var lastUpdateTime = stateManager.get("lastUpdateTime");
    if (now - lastUpdateTime >= 60 && !systems.animationSystem.isBallAnimating()) {
        drawCourt(systems);
        drawScore(systems);
        stateManager.set("lastUpdateTime", now, "render_update");
    }

    // Trail frame cycling (all clients)
    if (trailFrame) {
        cycleFrame(trailFrame);
        if (ballFrame && ballFrame.is_open) {
            ballFrame.top();
        }
    }

    // Game end check
    if (stateManager.get("timeRemaining") <= 0) {
        stateManager.set("gameRunning", false, "game_ended");
        return "game_over";
    }

    return "continue";
}

// Export for use in game loops
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runGameFrame: runGameFrame };
}
