// NBA JAM - Terminal Basketball Arcade Game
// A Synchronet BBS door game using sprite.js

load("sbbsdefs.js");
load("frame.js");
load("sprite.js");

// WAVE 23: Load error handler FIRST for global error capture
load(js.exec_dir + "lib/utils/error-handler.js");
load(js.exec_dir + "lib/utils/safe-game-loop.js");
initErrorHandler();
setupGlobalErrorHandler();

// WAVE 21: Load order guards for critical dependencies
load(js.exec_dir + "lib/utils/constants.js");
if (typeof COURT_WIDTH === "undefined") {
    throw new Error("LOAD ORDER ERROR: constants.js failed to load. Check file path and syntax.");
}

// WAVE 21: Load game balance configuration (centralized magic numbers)
load(js.exec_dir + "lib/config/game-balance.js");
if (typeof GAME_BALANCE === "undefined") {
    throw new Error("LOAD ORDER ERROR: game-balance.js failed to load. This is a critical dependency.");
}

load(js.exec_dir + "lib/utils/helpers.js");
load(js.exec_dir + "lib/utils/validation.js");  // WAVE 21: Input validation utilities

// Wave 23: Architecture Foundation - Load new core systems
load(js.exec_dir + "lib/core/state-manager.js");
load(js.exec_dir + "lib/core/event-bus.js");
load(js.exec_dir + "lib/core/system-init.js");  // Centralized system initialization

// Wave 23: Load new systems (testable architecture)
load(js.exec_dir + "lib/systems/passing-system.js");
load(js.exec_dir + "lib/systems/possession-system.js");
load(js.exec_dir + "lib/systems/shooting-system.js");

load(js.exec_dir + "lib/rendering/sprite-utils.js");
load(js.exec_dir + "lib/rendering/uniform-system.js");
load(js.exec_dir + "lib/rendering/animation-system.js");
load(js.exec_dir + "lib/rendering/player-labels.js");
load(js.exec_dir + "lib/rendering/shoe-colors.js");
load(js.exec_dir + "lib/rendering/ball.js");
load(js.exec_dir + "lib/rendering/court-rendering.js");
load(js.exec_dir + "lib/rendering/jump-indicators.js");
load(js.exec_dir + "lib/game-logic/game-state.js");
load(js.exec_dir + "lib/game-logic/phase-handler.js");  // Wave 22B: State machine phase handler
load(js.exec_dir + "lib/game-logic/player-class.js");
load(js.exec_dir + "lib/game-logic/movement-physics.js");
load(js.exec_dir + "lib/game-logic/passing.js");
load(js.exec_dir + "lib/game-logic/defense-actions.js");
load(js.exec_dir + "lib/game-logic/physical-play.js");
load(js.exec_dir + "lib/game-logic/rebounds.js");
load(js.exec_dir + "lib/game-logic/dunks.js");
load(js.exec_dir + "lib/game-logic/shooting.js");
load(js.exec_dir + "lib/game-logic/possession.js");
load(js.exec_dir + "lib/game-logic/team-data.js");
load(js.exec_dir + "lib/game-logic/input-handler.js");
load(js.exec_dir + "lib/game-logic/violations.js");
load(js.exec_dir + "lib/game-logic/dead-dribble.js");
load(js.exec_dir + "lib/game-logic/stats-tracker.js");
load(js.exec_dir + "lib/game-logic/game-utils.js");
load(js.exec_dir + "lib/game-logic/score-calculator.js");
load(js.exec_dir + "lib/game-logic/hot-streak.js");
load(js.exec_dir + "lib/game-logic/fast-break-detection.js");
load(js.exec_dir + "lib/bookie/bookie.js");
load(js.exec_dir + "lib/utils/player-helpers.js");
load(js.exec_dir + "lib/utils/positioning-helpers.js");
load(js.exec_dir + "lib/utils/string-helpers.js");
load(js.exec_dir + "lib/ui/score-display.js");
load(js.exec_dir + "lib/ui/controller-labels.js");
load(js.exec_dir + "lib/ui/demo-results.js");
load(js.exec_dir + "lib/ui/game-over.js");
load(js.exec_dir + "lib/ai/ai-decision-support.js");
load(js.exec_dir + "lib/ai/ai-difficulty.js");
load(js.exec_dir + "lib/ai/ai-movement-utils.js");
load(js.exec_dir + "lib/ai/ai-corner-escape.js");
load(js.exec_dir + "lib/core/sprite-registry.js");
// WAVE 21: Guard for sprite registry (critical dependency for sprite management)
if (typeof spriteRegistry === "undefined") {
    throw new Error("LOAD ORDER ERROR: sprite-registry.js failed to load. This is a critical dependency.");
}
load(js.exec_dir + "lib/core/sprite-init.js");
load(js.exec_dir + "lib/animation/bearing-frames.js");
load(js.exec_dir + "lib/animation/knockback-system.js");
load(js.exec_dir + "lib/rendering/fire-effects.js");
load(js.exec_dir + "lib/core/event-system.js");
load(js.exec_dir + "lib/core/input-buffer.js");

// Multiplayer modules

// Multiplayer support (optional - loaded on demand)
var multiplayerEnabled = false;
try {
    load(js.exec_dir + "lib/multiplayer/mp_identity.js");
    load(js.exec_dir + "lib/multiplayer/mp_team_data.js");
    load(js.exec_dir + "lib/multiplayer/mp_config.js");
    load(js.exec_dir + "lib/multiplayer/mp_network.js");
    load(js.exec_dir + "lib/multiplayer/mp_sessions.js");
    load(js.exec_dir + "lib/multiplayer/mp_lobby.js");
    load(js.exec_dir + "lib/multiplayer/mp_failover.js");
    load(js.exec_dir + "lib/multiplayer/mp_coordinator.js");
    load(js.exec_dir + "lib/multiplayer/mp_client.js");
    load(js.exec_dir + "lib/multiplayer/mp_input_replay.js");
    multiplayerEnabled = true;
} catch (mpLoadError) {
    log(LOG_WARNING, "NBA JAM: Multiplayer load failed: " + mpLoadError + " (at " + (mpLoadError.fileName || "?") + ":" + (mpLoadError.lineNumber || "?") + ")");
}

load(js.exec_dir + "lib/ai/game-context.js");
// WAVE 21 FIX: Removed duplicate load of ai-decision-support.js (was also at line 44)
// This file is now loaded only once at line 44 to avoid redefining functions
load(js.exec_dir + "lib/ai/offense-ball-handler.js");
load(js.exec_dir + "lib/ai/offense-off-ball.js");
load(js.exec_dir + "lib/ai/defense-on-ball.js");
load(js.exec_dir + "lib/ai/defense-help.js");
load(js.exec_dir + "lib/ai/coordinator.js");
load(js.exec_dir + "lib/ui/announcer.js");
load(js.exec_dir + "lib/ui/scoreboard.js");
load(js.exec_dir + "lib/ui/menus.js");
load(js.exec_dir + "lib/ui/game-over.js");
load(js.exec_dir + "lib/ui/halftime.js");

function initFrames(systems) {
    if (typeof console !== 'undefined' && typeof console.clear === 'function') {
        console.clear();
    }

    announcerFrame = new Frame(1, 1, 80, 1, LIGHTGRAY | BG_BLACK);
    courtFrame = new Frame(1, 2, COURT_WIDTH, COURT_HEIGHT, WHITE | WAS_BROWN);

    // Create transparent trail overlay at same position as courtFrame (not as child)
    trailFrame = new Frame(1, 2, COURT_WIDTH, COURT_HEIGHT, 0);
    trailFrame.transparent = true;

    cleanupScoreFrames();
    scoreFrame = new Frame(1, COURT_HEIGHT + 2, 80, 5, LIGHTGRAY | BG_BLACK);

    announcerFrame.open();
    courtFrame.open();
    trailFrame.open();  // Open trail overlay on top of court
    trailFrame.top();   // Ensure trails are drawn on top
    scoreFrame.open();
    ensureScoreFontLoaded();

    ensureBallFrame(40, 10);
    drawAnnouncerLine(systems);
}

function cleanupSprites() {
    if (teamAPlayer1) {
        if (teamAPlayer1.frame) teamAPlayer1.frame.close();
        if (teamAPlayer1.labelFrame) {
            try { teamAPlayer1.labelFrame.close(); } catch (e) { }
            teamAPlayer1.labelFrame = null;
        }
    }
    if (teamAPlayer2) {
        if (teamAPlayer2.frame) teamAPlayer2.frame.close();
        if (teamAPlayer2.labelFrame) {
            try { teamAPlayer2.labelFrame.close(); } catch (e) { }
            teamAPlayer2.labelFrame = null;
        }
    }
    if (teamBPlayer1) {
        if (teamBPlayer1.frame) teamBPlayer1.frame.close();
        if (teamBPlayer1.labelFrame) {
            try { teamBPlayer1.labelFrame.close(); } catch (e) { }
            teamBPlayer1.labelFrame = null;
        }
    }
    if (teamBPlayer2) {
        if (teamBPlayer2.frame) teamBPlayer2.frame.close();
        if (teamBPlayer2.labelFrame) {
            try { teamBPlayer2.labelFrame.close(); } catch (e) { }
            teamBPlayer2.labelFrame = null;
        }
    }
    if (ballFrame) ballFrame.close();

    teamAPlayer1 = null;
    teamAPlayer2 = null;
    teamBPlayer1 = null;
    teamBPlayer2 = null;
    ballFrame = null;
}

// Violation checking (checkViolations, enforceBackcourtViolation, etc.) loaded from lib/game-logic/violations.js

function gameLoop(systems) {
    // Wave 23: Wrap entire game loop with error handler for automatic logging
    try {
        // Wave 23: Systems are REQUIRED - fail loudly if not provided
        if (!systems || !systems.stateManager) {
            throw new Error("ARCHITECTURE ERROR: gameLoop requires systems parameter with stateManager");
        }

        var stateManager = systems.stateManager;

        // Use state manager for all state changes
        stateManager.set("gameRunning", true, "game_loop_start");
        stateManager.set("lastUpdateTime", Date.now(), "game_loop_start");
        stateManager.set("lastSecondTime", Date.now(), "game_loop_start");
        stateManager.set("lastAIUpdateTime", Date.now(), "game_loop_start");
        clearPotentialAssist(systems);

        var tempo = getSinglePlayerTempo();
        var frameDelay = tempo.frameDelayMs;
        var aiInterval = tempo.aiIntervalMs;

        // Initial draw
        drawCourt(systems);
        drawScore(systems);
        var teamNames = stateManager.get("teamNames");
        announceEvent("game_start", {
            teamA: (teamNames.teamA || "TEAM A").toUpperCase(),
            teamB: (teamNames.teamB || "TEAM B").toUpperCase()
        }, systems);

        while (stateManager.get("gameRunning") && stateManager.get("timeRemaining") > 0) {
            var now = Date.now();
            var violationTriggeredThisFrame = false;
            var tickCounter = stateManager.get("tickCounter");
            stateManager.set("tickCounter", (tickCounter + 1) % 1000000, "game_tick");

            var recoveryList = getAllPlayers();
            for (var r = 0; r < recoveryList.length; r++) {
                decrementStealRecovery(recoveryList[r]);
            }

            // Update timer
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
                    showHalftimeScreen(systems);
                    if (!stateManager.get("gameRunning")) break; // User quit during halftime

                    // Reset for second half
                    if (stateManager.get("pendingSecondHalfInbound")) {
                        startSecondHalfInbound(systems);
                    }
                    drawCourt(systems);
                    drawScore(systems);
                    stateManager.set("lastUpdateTime", Date.now(), "halftime_reset");
                    stateManager.set("lastSecondTime", Date.now(), "halftime_reset");
                    stateManager.set("lastAIUpdateTime", Date.now(), "halftime_reset");
                    continue;
                }

                // Shot clock violation
                shotClock = stateManager.get("shotClock"); // Get updated value
                if (shotClock <= 0) {
                    var currentTeam = stateManager.get("currentTeam");
                    announceEvent("shot_clock_violation", { team: currentTeam }, systems);
                    mswait(1000);
                    switchPossession(systems);
                    stateManager.set("shotClock", 24, "shot_clock_reset"); // Reset for new possession
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

                    // If ball handler barely moved (less than 3 units), increment stuck timer
                    currentTeam = stateManager.get("currentTeam");
                    var opponentTeamName = (currentTeam === "teamA") ? "teamB" : "teamA";
                    var closestDefender = getClosestPlayer(ballHandler.x, ballHandler.y, opponentTeamName);
                    var guardDistance = closestDefender ? getSpriteDistance(ballHandler, closestDefender) : 999;
                    var closelyGuarded = guardDistance <= 4;

                    if (distanceMoved < 3) {
                        var ballHandlerStuckTimer = stateManager.get("ballHandlerStuckTimer");
                        stateManager.set("ballHandlerStuckTimer", ballHandlerStuckTimer + 1, "stuck_timer_increment");
                        // AI picks up dribble when stuck
                        if (!ballHandler.isHuman &&
                            ballHandler.playerData &&
                            ballHandler.playerData.hasDribble !== false &&
                            closelyGuarded &&
                            stateManager.get("ballHandlerStuckTimer") >= 3) {
                            pickUpDribble(ballHandler, "stuck", systems);
                        }
                    } else {
                        // Ball handler is moving, reset timer
                        stateManager.set("ballHandlerStuckTimer", 0, "ball_handler_moving");
                    }

                    // Update last position
                    stateManager.set("ballHandlerLastX", ballHandler.x, "ball_handler_track");
                    stateManager.set("ballHandlerLastY", ballHandler.y, "ball_handler_track");

                    if (ballHandler.playerData && ballHandler.playerData.hasDribble === false) {
                        if (!closelyGuarded) {
                            stateManager.set("ballHandlerDeadSince", null, "dead_dribble_clear");
                            stateManager.set("ballHandlerDeadFrames", 0, "dead_dribble_clear");
                            stateManager.set("ballHandlerDeadForcedShot", false, "dead_dribble_clear");
                        } else if (!stateManager.get("ballHandlerDeadSince")) {
                            stateManager.set("ballHandlerDeadSince", now, "dead_dribble_start");
                            stateManager.set("ballHandlerDeadFrames", 1, "dead_dribble_start");
                        } else {
                            var ballHandlerDeadFrames = stateManager.get("ballHandlerDeadFrames");
                            stateManager.set("ballHandlerDeadFrames", ballHandlerDeadFrames + 1, "dead_dribble_frames");

                            // MULTIPLAYER: Broadcast dead dribble timer every 30 frames
                            if (mpCoordinator && mpCoordinator.isCoordinator) {
                                tickCounter = stateManager.get("tickCounter");
                                if (tickCounter - mpSyncState.lastDeadDribbleBroadcast >= 30) {
                                    ballHandlerDeadFrames = stateManager.get("ballHandlerDeadFrames");
                                    var ballHandlerDeadSince = stateManager.get("ballHandlerDeadSince");
                                    var ballHandlerDeadForcedShot = stateManager.get("ballHandlerDeadForcedShot");
                                    mpCoordinator.broadcastGameState({
                                        type: 'deadDribbleUpdate',
                                        frames: ballHandlerDeadFrames,
                                        since: ballHandlerDeadSince,
                                        forced: ballHandlerDeadForcedShot,
                                        timestamp: Date.now()
                                    });
                                    mpSyncState.lastDeadDribbleBroadcast = tickCounter;
                                }
                            }

                            var deadElapsed = now - stateManager.get("ballHandlerDeadSince");
                            if (!stateManager.get("ballHandlerDeadForcedShot") && deadElapsed >= 4500) {
                                if (ballHandler && !ballHandler.isHuman) {
                                    stateManager.set("ballHandlerDeadForcedShot", true, "dead_dribble_force_shot");
                                    attemptShot(systems);
                                    stateManager.set("ballHandlerDeadSince", now, "dead_dribble_reset");
                                    stateManager.set("ballHandlerDeadFrames", 0, "dead_dribble_reset");
                                    continue;
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

                    // Track frontcourt progress for smarter passing
                    currentTeam = stateManager.get("currentTeam");
                    var attackDir = (currentTeam === "teamA") ? 1 : -1;
                    var ballHandlerProgressOwner = stateManager.get("ballHandlerProgressOwner");
                    if (ballHandlerProgressOwner !== ballHandler) {
                        stateManager.set("ballHandlerProgressOwner", ballHandler, "progress_owner_change");
                        stateManager.set("ballHandlerFrontcourtStartX", ballHandler.x, "progress_owner_change");
                        stateManager.set("ballHandlerAdvanceTimer", 0, "progress_owner_change");
                    }

                    var handlerInBackcourt = isInBackcourt(ballHandler, currentTeam);

                    if (!stateManager.get("frontcourtEstablished") || handlerInBackcourt) {
                        stateManager.set("ballHandlerFrontcourtStartX", ballHandler.x, "backcourt_progress");
                        stateManager.set("ballHandlerAdvanceTimer", 0, "backcourt_progress");
                    } else {
                        var ballHandlerFrontcourtStartX = stateManager.get("ballHandlerFrontcourtStartX");
                        var forwardDelta = (ballHandler.x - ballHandlerFrontcourtStartX) * attackDir;
                        if (forwardDelta < -1) {
                            stateManager.set("ballHandlerFrontcourtStartX", ballHandler.x, "retreat_reset");
                            forwardDelta = 0;
                        }
                        if (forwardDelta < 4) {
                            var ballHandlerAdvanceTimer = stateManager.get("ballHandlerAdvanceTimer");
                            stateManager.set("ballHandlerAdvanceTimer", ballHandlerAdvanceTimer + 1, "advance_timer_increment");
                        } else {
                            stateManager.set("ballHandlerFrontcourtStartX", ballHandler.x, "advance_progress");
                            stateManager.set("ballHandlerAdvanceTimer", 0, "advance_progress");
                        }
                    }
                } else {
                    stateManager.set("ballHandlerAdvanceTimer", 0, "no_ball_carrier");
                    stateManager.set("ballHandlerProgressOwner", null, "no_ball_carrier");
                    resetDeadDribbleTimer(systems);
                }

                // Unified violation checking (extracted to shared function)
                violationTriggeredThisFrame = checkViolations(violationTriggeredThisFrame, systems);
            }

            if (violationTriggeredThisFrame) {
                stateManager.set("lastAIUpdateTime", now, "violation_triggered");
                stateManager.set("lastUpdateTime", now, "violation_triggered");
                continue;
            }

            // Handle block jump animation
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

            // Store previous positions before movement
            var allPlayers = getAllPlayers();
            for (var p = 0; p < allPlayers.length; p++) {
                allPlayers[p].prevX = allPlayers[p].x;
                allPlayers[p].prevY = allPlayers[p].y;
                if (allPlayers[p] && allPlayers[p].playerData) {
                    var pdata = allPlayers[p].playerData;
                    if (pdata.shakeCooldown && pdata.shakeCooldown > 0) pdata.shakeCooldown--;
                    if (pdata.shoveCooldown && pdata.shoveCooldown > 0) pdata.shoveCooldown--;
                    if (pdata.shoveAttemptCooldown && pdata.shoveAttemptCooldown > 0) pdata.shoveAttemptCooldown--;
                    if (pdata.shoverCooldown && pdata.shoverCooldown > 0) pdata.shoverCooldown--;
                    if (pdata.shoveFailureStun && pdata.shoveFailureStun > 0) pdata.shoveFailureStun--;
                    if (allPlayers[p].isHuman && pdata.knockdownTimer && pdata.knockdownTimer > 0) {
                        pdata.knockdownTimer--;
                        if (pdata.knockdownTimer < 0) pdata.knockdownTimer = 0;
                    }
                }
            }

            // MULTIPLAYER: Broadcast cooldown batch every 60 frames (~1 second)
            if (mpCoordinator && mpCoordinator.isCoordinator) {
                tickCounter = stateManager.get("tickCounter");
                if (tickCounter - mpSyncState.lastCooldownBroadcast >= 60) {
                    var cooldownData = {};
                    for (var p = 0; p < allPlayers.length; p++) {
                        var player = allPlayers[p];
                        if (player && player.playerData) {
                            var playerId = getPlayerGlobalId(player);
                            if (playerId) {
                                cooldownData[playerId] = {
                                    shake: player.playerData.shakeCooldown || 0,
                                    shove: player.playerData.shoveCooldown || 0,
                                    shoveAttempt: player.playerData.shoveAttemptCooldown || 0,
                                    shover: player.playerData.shoverCooldown || 0,
                                    stun: player.playerData.shoveFailureStun || 0,
                                    knockdown: player.playerData.knockdownTimer || 0
                                };
                            }
                        }
                    }
                    mpCoordinator.broadcastGameState({
                        type: 'cooldownSync',
                        cooldowns: cooldownData,
                        timestamp: Date.now()
                    });
                    mpSyncState.lastCooldownBroadcast = tickCounter;
                }
            }

            ballCarrier = stateManager.get("ballCarrier");
            inbounding = stateManager.get("inbounding");
            var frontcourtEstablished = stateManager.get("frontcourtEstablished");
            if (ballCarrier && !inbounding && !frontcourtEstablished) {
                currentTeam = stateManager.get("currentTeam");
                if (!isInBackcourt(ballCarrier, currentTeam)) {
                    setFrontcourtEstablished(currentTeam, systems);
                    stateManager.set("backcourtTimer", 0, "frontcourt_established");
                }
            }

            // Get input
            var key = console.inkey(K_NONE, 50);
            if (key) {
                handleInput(key, systems);
            }

            // Update AI (slower than rendering)
            var lastAIUpdateTime = stateManager.get("lastAIUpdateTime");
            if (now - lastAIUpdateTime >= aiInterval) {
                updateAI(systems);
                stateManager.set("lastAIUpdateTime", now, "ai_update");
            }

            // Update turbo for all players
            for (var p = 0; p < allPlayers.length; p++) {
                var player = allPlayers[p];
                if (player.playerData) {
                    // Recharge turbo if not active
                    if (!player.playerData.turboActive) {
                        player.playerData.rechargeTurbo(TURBO_RECHARGE_RATE);
                    }
                }
            }

            // Update announcer timer
            updateAnnouncer(systems);

            // Check collisions and boundaries
            checkSpriteCollision();
            for (var p = 0; p < allPlayers.length; p++) {
                checkBoundaries(allPlayers[p]);
            }

            // Cycle sprites more frequently for smoother animation
            Sprite.cycle();

            // Update non-blocking animations
            animationSystem.update();

            // Wave 22B: Update game phase (handles shot animations, scoring, rebounds, inbound)
            updateGamePhase(frameDelay, systems);

            // Update non-blocking rebound scramble
            updateReboundScramble(systems);

            // Update non-blocking knockback animations
            updateKnockbackAnimations();

            // Redraw court and score less frequently to balance performance
            // Skip during active animations to allow trails to accumulate
            var lastUpdateTime = stateManager.get("lastUpdateTime");
            if (now - lastUpdateTime >= 60 && !animationSystem.isBallAnimating()) {
                drawCourt(systems);
                drawScore(systems);
                stateManager.set("lastUpdateTime", now, "render_update");
            }

            // Cycle trail frame AFTER drawCourt so trails appear on top
            if (trailFrame) {
                cycleFrame(trailFrame);
                // Keep ball on top of trail layer
                if (ballFrame && ballFrame.is_open) {
                    ballFrame.top();
                }
            }

            mswait(frameDelay);
        }

        stateManager.set("gameRunning", false, "game_loop_end");

    } catch (e) {
        // Log error with full game state context
        if (typeof logError === "function") {
            logError(e, ErrorSeverity.FATAL, {
                function: "gameLoop",
                systems: systems,
                tick: systems.stateManager ? systems.stateManager.get("tickCounter") : "unknown"
            });
        }

        // Show error to user
        console.print("\r\n\1r\1hFATAL ERROR in game loop\1n\r\n");
        console.print("Error: " + e.toString() + "\r\n");
        console.print("Check error.log for details and state snapshot\r\n\r\n");
        console.pause();

        // Set game as not running
        if (systems && systems.stateManager) {
            systems.stateManager.set("gameRunning", false, "game_loop_error");
        }

        // Re-throw
        throw e;
    }
}

function runCPUDemo(systems) {
    if (!systems || !systems.stateManager) {
        throw new Error("ARCHITECTURE ERROR: runCPUDemo requires systems parameter");
    }
    var stateManager = systems.stateManager;
    while (true) {
        // Pick random teams for demo
        var teamKeys = Object.keys(NBATeams);
        var randomTeam1 = teamKeys[Math.floor(Math.random() * teamKeys.length)];
        var randomTeam2 = teamKeys[Math.floor(Math.random() * teamKeys.length)];

        // Make sure they're different teams
        while (randomTeam1 === randomTeam2) {
            randomTeam2 = teamKeys[Math.floor(Math.random() * teamKeys.length)];
        }

        var redTeamKey = randomTeam1;
        var blueTeamKey = randomTeam2;

        // Use random player indices (pick 2 random players from each 6-player roster)
        var teamATeam = NBATeams[redTeamKey];
        var teamBTeam = NBATeams[blueTeamKey];

        var redAvailablePlayers = [];
        var blueAvailablePlayers = [];

        // Get available players for each team using actual players array
        for (var i = 0; i < teamATeam.players.length; i++) {
            redAvailablePlayers.push(i);
        }
        for (var i = 0; i < teamBTeam.players.length; i++) {
            blueAvailablePlayers.push(i);
        }

        // Safety check - ensure we have at least 2 players per team
        if (redAvailablePlayers.length < 2) {
            // Fallback to default players (0 and 1, or 0 and 0 if only 1 player)
            redAvailablePlayers = [0, teamATeam.players.length > 1 ? 1 : 0];
        }
        if (blueAvailablePlayers.length < 2) {
            blueAvailablePlayers = [0, teamBTeam.players.length > 1 ? 1 : 0];
        }

        // Randomly select 2 players from each team
        var redPlayerIndices = {
            player1: redAvailablePlayers[Math.floor(Math.random() * redAvailablePlayers.length)],
            player2: redAvailablePlayers[Math.floor(Math.random() * redAvailablePlayers.length)]
        };

        // Make sure red players are different
        while (redPlayerIndices.player1 === redPlayerIndices.player2 && redAvailablePlayers.length > 1) {
            redPlayerIndices.player2 = redAvailablePlayers[Math.floor(Math.random() * redAvailablePlayers.length)];
        }

        var bluePlayerIndices = {
            player1: blueAvailablePlayers[Math.floor(Math.random() * blueAvailablePlayers.length)],
            player2: blueAvailablePlayers[Math.floor(Math.random() * blueAvailablePlayers.length)]
        };

        // Make sure blue players are different
        while (bluePlayerIndices.player1 === bluePlayerIndices.player2 && blueAvailablePlayers.length > 1) {
            bluePlayerIndices.player2 = blueAvailablePlayers[Math.floor(Math.random() * blueAvailablePlayers.length)];
        }

        // Reset state and initialize sprites with ALL CPU mode
        var systems = initializeSystems({
            gameState: gameState,
            animationSystem: animationSystem,
            getPlayers: function () {
                return {
                    teamAPlayer1: teamAPlayer1,
                    teamAPlayer2: teamAPlayer2,
                    teamBPlayer1: teamBPlayer1,
                    teamBPlayer2: teamBPlayer2
                };
            },
            helpers: {
                getPlayerTeamName: getPlayerTeamName,
                getAllPlayers: getAllPlayers,
            },
            constants: {
                COURT_WIDTH: COURT_WIDTH,
                COURT_HEIGHT: COURT_HEIGHT
            }
        });
        resetGameState({ allCPUMode: true }, systems);
        initSprites(redTeamKey, blueTeamKey, redPlayerIndices, bluePlayerIndices, true, systems);

        // Match player game length for demo as well
        stateManager.set("timeRemaining", DEMO_GAME_SECONDS, "demo_init");
        stateManager.set("totalGameTime", DEMO_GAME_SECONDS, "demo_init");
        stateManager.set("currentHalf", 1, "demo_init");

        // Show matchup screen with betting enabled
        var bettingSlip = showMatchupScreen(true);

        // Display "DEMO MODE" message
        announce("DEMO MODE - Press Q to exit", YELLOW, systems);
        mswait(1500);

        // Run the game loop (all AI controlled)
        gameLoop(systems);

        // After game ends, show betting results if user placed bets
        if (bettingSlip && typeof showBettingResults === "function") {
            var gameResults = collectGameResults(redTeamKey, blueTeamKey);
            showBettingResults(bettingSlip, gameResults);
        }

        // After game ends, check what user wants to do
        var choice = showGameOver(true, systems); // Pass true for demo mode

        if (choice === "quit") {
            break; // Exit demo loop
        }
        // choice === "newdemo" continues the loop for a new demo

        // Clean up sprites before starting new demo
        cleanupSprites();
        resetGameState({ allCPUMode: true }, systems);
    }
}

/**
 * Setup event subscriptions (Observer pattern)
 * Connects game logic events to UI/announcer
 */
function setupEventSubscriptions(systems) {
    // Subscribe to violation events
    onGameEvent("violation", function (data) {
        if (data.type === "backcourt") {
            announceEvent("violation_backcourt", { team: data.team }, systems);
        } else if (data.type === "five_seconds") {
            announceEvent("violation_five_seconds", { team: data.team }, systems);
        }
    });

    // Future: Can add more event subscriptions here
    // - onGameEvent("score", ...) for stats tracking
    // - onGameEvent("steal", ...) for multiplayer sync
    // - onGameEvent("turnover", ...) for analytics
}

function main() {
    // Wave 23: Initialize architecture foundation systems FIRST
    // Wave 23: Initialize all game systems with dependency injection
    var systems = initializeSystems({
        gameState: gameState,
        animationSystem: animationSystem,
        getPlayers: function () {
            // Lazy evaluation - returns current player references
            return {
                teamAPlayer1: teamAPlayer1,
                teamAPlayer2: teamAPlayer2,
                teamBPlayer1: teamBPlayer1,
                teamBPlayer2: teamBPlayer2
            };
        },
        helpers: {
            getPlayerTeamName: getPlayerTeamName,
            getAllPlayers: getAllPlayers,
            recordTurnover: recordTurnover,
            triggerPossessionBeep: triggerPossessionBeep,
            resetBackcourtState: resetBackcourtState,
            setPotentialAssist: setPotentialAssist,
            clearPotentialAssist: clearPotentialAssist,
            enableScoreFlashRegainCheck: enableScoreFlashRegainCheck,
            primeInboundOffense: primeInboundOffense,
            assignDefensiveMatchups: assignDefensiveMatchups,
            announceEvent: announceEvent
        },
        constants: {
            COURT_WIDTH: COURT_WIDTH,
            COURT_HEIGHT: COURT_HEIGHT
        }
    });

    // Now reset gameState with systems available
    resetGameState(null, systems);

    // Subscribe to game events (Observer pattern)
    setupEventSubscriptions(systems);

    // Show ANSI splash screen first
    showSplashScreen();

    // Load team data first
    loadTeamData();
    loadAnnouncerData();

    initFrames(systems);
    showIntro();

    // Main menu - choose play or demo
    var menuChoice = mainMenu();

    if (!menuChoice) {
        // User chose to quit
        return;
    }

    if (menuChoice === "demo") {
        // Run CPU vs CPU demo
        runCPUDemo(systems);
    } else if (menuChoice === "multiplayer") {
        // Run multiplayer
        if (multiplayerEnabled) {
            runMultiplayerMode();
        } else {
            console.clear();
            console.print("\r\n\1r\1hMultiplayer not available!\1n\r\n\r\n");
            console.print("Multiplayer files not found. This installation may be incomplete.\r\n\r\n");
            console.print("Press any key to continue...");
            console.getkey();
        }
    } else if (menuChoice === "lorb") {
        // Run LORB
        try {
            load(js.exec_dir + "lib/lorb/lorb.js");
        } catch (e) {
            console.clear();
            console.print("\r\n\1r\1hLORB not available!\1n\r\n\r\n");
            console.print("Error loading LORB: " + e + "\r\n\r\n");
            console.print("Press any key to continue...");
            console.getkey();
        }
    } else if (menuChoice === "play") {
        var playAgain = true;
        var useNewTeams = false;
        var selection = null;

        while (playAgain) {
            if (!selection || useNewTeams) {
                // Team selection screen
                selection = teamSelectionScreen();
                if (!selection) {
                    // User quit during selection
                    return;
                }
                useNewTeams = false;
            }

            // Clear screen before starting game to remove selection artifacts
            console.clear();

            resetGameState({ allCPUMode: false }, systems);
            initSprites(
                selection.teamATeam,
                selection.teamBTeam,
                selection.teamAPlayers,
                selection.teamBPlayers,
                false,  // Not demo mode - player1 is human
                systems
            );

            showMatchupScreen();

            gameLoop(systems);
            var choice = showGameOver(false, systems); // Pass false for player mode

            if (choice === "quit") {
                playAgain = false;
            } else if (choice === "newteams") {
                useNewTeams = true;
                cleanupSprites(); // Clean up before new team selection
                resetGameState(null, systems);
            } else if (choice === "playagain") {
                cleanupSprites(); // Clean up before restarting
                resetGameState(null, systems);
            }
        }
    }

    function runMultiplayerMode() {
        // Run the lobby
        var lobbyResult = runMultiplayerLobby();

        if (!lobbyResult) {
            // User cancelled or connection failed
            return;
        }

        // Extract session info from lobby
        var sessionId = lobbyResult.sessionId;
        var session = lobbyResult.session;
        var client = lobbyResult.client;
        var myId = lobbyResult.myId;
        var serverConfig = lobbyResult.serverConfig;

        // Initialize coordinator
        var coordinator = new GameCoordinator(sessionId, client, serverConfig);
        coordinator.init();
        mpCoordinator = coordinator; // Set global reference for event broadcasting

        // Initialize client
        var playerClient = new PlayerClient(sessionId, client, myId.globalId, serverConfig);
        playerClient.init();

        // Sync coordinator status to client (so client knows if it's authoritative)
        playerClient.isCoordinator = coordinator.isCoordinator;
        playerClient.disablePrediction = coordinator.isCoordinator;

        // Reset game state for multiplayer
        resetGameState({ allCPUMode: false }, systems);

        // Refresh session data from game namespace to capture final team assignments
        var liveSession = client.read("nba_jam", "game." + sessionId + ".meta", 1);
        if (!liveSession) {
            // Fallback to lobby snapshot in case the game meta hasn't been written yet
            liveSession = client.read("nba_jam", "lobby.sessions." + sessionId, 1);
        }
        if (liveSession) {
            session = liveSession;
            ensureTeamContainers(session);
        }

        // Determine player assignments from session
        var playerAssignments = assignMultiplayerPlayers(session, myId);

        // Initialize sprites for multiplayer
        initMultiplayerSprites(session, playerAssignments, myId);

        // Create sprite map (global player ID -> sprite)
        var spriteMap = createMultiplayerSpriteMap(playerAssignments);
        coordinator.setPlayerSpriteMap(spriteMap);

        // Debug: Log sprite map
        debugLog("=== Sprite Map Created ===");
        debugLog("My ID: " + myId.globalId);
        debugLog("Is Coordinator: " + (coordinator.isCoordinator ? "YES" : "NO"));
        for (var gid in spriteMap) {
            if (spriteMap.hasOwnProperty(gid)) {
                var sprite = spriteMap[gid];
                var spriteName = sprite ? (sprite.playerData ? sprite.playerData.name : "unnamed") : "NULL";
                debugLog("  " + gid + " -> " + spriteName);
            }
        }

        // Set my sprite for client prediction
        var mySprite = spriteMap[myId.globalId];
        if (mySprite) {
            playerClient.setMySprite(mySprite);
            debugLog("SUCCESS: My sprite found: " + mySprite.playerData.name);
        } else {
            debugLog("ERROR: My sprite NOT FOUND for globalId: " + myId.globalId);
        }

        // Set sprite map so client can update remote player positions
        playerClient.setSpriteMap(spriteMap);

        // Tell client if we're coordinator (disables prediction to avoid double input)
        playerClient.setCoordinatorStatus(coordinator.isCoordinator);

        // Show matchup screen
        showMatchupScreen();

        // Run multiplayer game loop
        runMultiplayerGameLoop(coordinator, playerClient, myId, systems);

        // Cleanup
        mpCoordinator = null; // Clear global reference
        if (coordinator && typeof coordinator.cleanup === "function") {
            coordinator.cleanup();
        }
        if (playerClient && typeof playerClient.cleanup === "function") {
            playerClient.cleanup();
        }
        cleanupSprites();

        // Show game over screen
        showGameOver(false, systems);
    }

    function assignMultiplayerPlayers(session, myId) {
        var assignments = {
            teamAPlayer1: null,
            teamAPlayer2: null,
            teamBPlayer1: null,
            teamBPlayer2: null
        };

        if (!session || !session.teams) {
            return assignments;
        }

        // Assign players based on team selections
        var teamAPlayers = session.teams.teamA.players || [];
        var teamBPlayers = session.teams.teamB.players || [];

        if (teamAPlayers.length > 0) {
            assignments.teamAPlayer1 = teamAPlayers[0];
        }
        if (teamAPlayers.length > 1) {
            assignments.teamAPlayer2 = teamAPlayers[1];
        }

        if (teamBPlayers.length > 0) {
            assignments.teamBPlayer1 = teamBPlayers[0];
        }
        if (teamBPlayers.length > 1) {
            assignments.teamBPlayer2 = teamBPlayers[1];
        }

        return assignments;
    }

    function clampRosterIndexForGame(index, teamDef) {
        if (!teamDef || !teamDef.players || teamDef.players.length === 0)
            return 0;
        var value = parseInt(index, 10);
        if (isNaN(value)) value = 0;
        if (value < 0) value = 0;
        if (value >= teamDef.players.length) value = teamDef.players.length - 1;
        return value;
    }

    function findAvailableRosterIndexForGame(teamDef, used) {
        if (!teamDef || !teamDef.players || teamDef.players.length === 0)
            return 0;
        for (var i = 0; i < teamDef.players.length; i++) {
            if (!used[i])
                return i;
        }
        return 0;
    }

    function resolveTeamPlayerIndices(teamSideData, teamDef) {
        var indices = { player1: 0, player2: 1 };
        var rosterChoices = (teamSideData && teamSideData.roster) || {};
        var playersList = (teamSideData && teamSideData.players) || [];
        var used = {};

        if (playersList.length > 0) {
            var choice = rosterChoices[playersList[0]];
            if (choice && typeof choice.index === "number") {
                indices.player1 = clampRosterIndexForGame(choice.index, teamDef);
            }
            used[indices.player1] = true;
        }

        if (playersList.length > 1) {
            var choice2 = rosterChoices[playersList[1]];
            if (choice2 && typeof choice2.index === "number") {
                var idx2 = clampRosterIndexForGame(choice2.index, teamDef);
                if (used[idx2])
                    idx2 = findAvailableRosterIndexForGame(teamDef, used);
                indices.player2 = idx2;
            } else {
                indices.player2 = findAvailableRosterIndexForGame(teamDef, used);
            }
            used[indices.player2] = true;
        } else {
            var cpuIdx = (teamSideData && typeof teamSideData.cpuIndex === "number") ? clampRosterIndexForGame(teamSideData.cpuIndex, teamDef) : null;
            if (cpuIdx === null || used[cpuIdx]) {
                cpuIdx = findAvailableRosterIndexForGame(teamDef, used);
            }
            indices.player2 = cpuIdx;
        }

        indices.player1 = clampRosterIndexForGame(indices.player1, teamDef);
        indices.player2 = clampRosterIndexForGame(indices.player2, teamDef);
        return indices;
    }

    function getSessionPlayerAlias(session, playerId) {
        if (!session || !session.players || !playerId)
            return null;
        var profile = session.players[playerId];
        if (!profile)
            return null;
        return profile.displayName || profile.userName || profile.nick || profile.name || profile.alias || playerId;
    }

    function applyMultiplayerControllerLabels(session, assignments) {
        function applyLabel(sprite, playerId) {
            if (!sprite || !sprite.playerData)
                return;
            if (playerId) {
                var alias = getSessionPlayerAlias(session, playerId);
                if (alias)
                    setSpriteControllerLabel(sprite, alias, true);
                else
                    setSpriteControllerLabel(sprite, "CPU", false);
            } else {
                setSpriteControllerLabel(sprite, "CPU", false);
            }
        }

        applyLabel(teamAPlayer1, assignments.teamAPlayer1);
        applyLabel(teamAPlayer2, assignments.teamAPlayer2);
        applyLabel(teamBPlayer1, assignments.teamBPlayer1);
        applyLabel(teamBPlayer2, assignments.teamBPlayer2);
    }

    function initMultiplayerSprites(session, assignments, myId) {
        // Use team names from session
        var redSideData = (session.teams && session.teams.teamA) || { name: "lakers", players: [], roster: {} };
        var blueSideData = (session.teams && session.teams.teamB) || { name: "celtics", players: [], roster: {} };
        var teamATeamName = redSideData.name || "lakers";
        var teamBTeamName = blueSideData.name || "celtics";
        var teamATeamDef = NBATeams[teamATeamName];
        var teamBTeamDef = NBATeams[teamBTeamName];

        var redPlayerIndices = resolveTeamPlayerIndices(redSideData, teamATeamDef);
        var bluePlayerIndices = resolveTeamPlayerIndices(blueSideData, teamBTeamDef);

        // Determine if we're a human player
        var isRedHuman = (assignments.teamAPlayer1 === myId.globalId || assignments.teamAPlayer2 === myId.globalId);

        // Initialize sprites (same as single-player, but mark human/AI appropriately)
        initSprites(
            teamATeamName,
            teamBTeamName,
            redPlayerIndices,
            bluePlayerIndices,
            false, // allCPUMode = false, at least one human
            systems
        );

        // Set controller types based on assignments
        // controllerType: "local" = controlled by this client
        //                 "remote" = controlled by another client
        //                 "ai" = CPU controlled
        // NOTE: Remote players are HUMAN (controlled by another human), not AI!
        if (teamAPlayer1) {
            if (assignments.teamAPlayer1 === myId.globalId) {
                teamAPlayer1.controllerType = "local";
                teamAPlayer1.isHuman = true;
            } else if (assignments.teamAPlayer1) {
                teamAPlayer1.controllerType = "remote";
                teamAPlayer1.isHuman = true; // Remote = human controlled, just not by me
            } else {
                teamAPlayer1.controllerType = "ai";
                teamAPlayer1.isHuman = false;
            }
            teamAPlayer1.controlledBy = assignments.teamAPlayer1 || null;
        }
        if (teamAPlayer2) {
            if (assignments.teamAPlayer2 === myId.globalId) {
                teamAPlayer2.controllerType = "local";
                teamAPlayer2.isHuman = true;
            } else if (assignments.teamAPlayer2) {
                teamAPlayer2.controllerType = "remote";
                teamAPlayer2.isHuman = true; // Remote = human controlled, just not by me
            } else {
                teamAPlayer2.controllerType = "ai";
                teamAPlayer2.isHuman = false;
            }
            teamAPlayer2.controlledBy = assignments.teamAPlayer2 || null;
        }
        if (teamBPlayer1) {
            if (assignments.teamBPlayer1 === myId.globalId) {
                teamBPlayer1.controllerType = "local";
                teamBPlayer1.isHuman = true;
            } else if (assignments.teamBPlayer1) {
                teamBPlayer1.controllerType = "remote";
                teamBPlayer1.isHuman = true; // Remote = human controlled, just not by me
            } else {
                teamBPlayer1.controllerType = "ai";
                teamBPlayer1.isHuman = false;
            }
            teamBPlayer1.controlledBy = assignments.teamBPlayer1 || null;
        }
        if (teamBPlayer2) {
            if (assignments.teamBPlayer2 === myId.globalId) {
                teamBPlayer2.controllerType = "local";
                teamBPlayer2.isHuman = true;
            } else if (assignments.teamBPlayer2) {
                teamBPlayer2.controllerType = "remote";
                teamBPlayer2.isHuman = true; // Remote = human controlled, just not by me
            } else {
                teamBPlayer2.controllerType = "ai";
                teamBPlayer2.isHuman = false;
            }
            teamBPlayer2.controlledBy = assignments.teamBPlayer2 || null;
        }

        applyMultiplayerControllerLabels(session, assignments);
    }

    function createMultiplayerSpriteMap(assignments) {
        var map = {};
        var debugInfo = [];

        // Add ALL sprites to map, using synthetic IDs for AI-controlled sprites
        // This ensures AI sprites can be synced across clients

        if (teamAPlayer1) {
            var red1Id = assignments.teamAPlayer1 || "AI_RED_1";
            map[red1Id] = teamAPlayer1;
            debugInfo.push("Red1: " + red1Id + " -> " + (teamAPlayer1.controllerType || "?"));
        }

        if (teamAPlayer2) {
            var red2Id = assignments.teamAPlayer2 || "AI_RED_2";
            map[red2Id] = teamAPlayer2;
            debugInfo.push("Red2: " + red2Id + " -> " + (teamAPlayer2.controllerType || "?"));
        }

        if (teamBPlayer1) {
            var blue1Id = assignments.teamBPlayer1 || "AI_BLUE_1";
            map[blue1Id] = teamBPlayer1;
            debugInfo.push("Blue1: " + blue1Id + " -> " + (teamBPlayer1.controllerType || "?"));
        }

        if (teamBPlayer2) {
            var blue2Id = assignments.teamBPlayer2 || "AI_BLUE_2";
            map[blue2Id] = teamBPlayer2;
            debugInfo.push("Blue2: " + blue2Id + " -> " + (teamBPlayer2.controllerType || "?"));
        }

        // Verify no duplicate sprite objects in map
        var spriteValues = [];
        var duplicateFound = false;
        for (var gid in map) {
            if (map.hasOwnProperty(gid)) {
                var sprite = map[gid];
                for (var i = 0; i < spriteValues.length; i++) {
                    if (spriteValues[i] === sprite) {
                        log(LOG_ERR, "NBA JAM: DUPLICATE SPRITE IN MAP! GlobalID " + gid + " maps to same sprite as another player");
                        duplicateFound = true;
                    }
                }
                spriteValues.push(sprite);
            }
        }

        log(LOG_DEBUG, "NBA JAM: Sprite map created - " + debugInfo.join(", "));

        return map;
    }

    function runMultiplayerGameLoop(coordinator, playerClient, myId, systems) {
        // Wave 23: Systems are REQUIRED
        if (!systems || !systems.stateManager) {
            throw new Error("ARCHITECTURE ERROR: runMultiplayerGameLoop requires systems parameter");
        }

        var stateManager = systems.stateManager;
        var frameNumber = 0;
        stateManager.set("gameRunning", true, "mp_game_start");
        var lastSecond = Date.now();

        while (stateManager.get("gameRunning") && !js.terminated) {
            var frameStart = Date.now();

            var tickCounter = stateManager.get("tickCounter");
            stateManager.set("tickCounter", (tickCounter + 1) % 1000000, "mp_game_tick");

            // Handle input
            var key = console.inkey(K_NONE, 0);

            // Handle quit menu (non-blocking to prevent multiplayer desync)
            if (stateManager.get("quitMenuOpen")) {
                if (key) {
                    var upperKey = key.toUpperCase();
                    if (upperKey === 'Y') {
                        break;  // Quit game
                    } else if (upperKey === 'N' || upperKey === 'Q') {
                        stateManager.set("quitMenuOpen", false, "mp_quit_cancel");
                    }
                }
                // Draw quit confirmation overlay (will be rendered after game frame)
            } else if (key) {
                if (key.toUpperCase() === 'Q') {
                    stateManager.set("quitMenuOpen", true, "mp_quit_open");
                } else {
                    // Send input to client for prediction
                    playerClient.handleInput(key, frameNumber);
                }
            }

            // Coordinator processes inputs and runs game logic
            if (coordinator && coordinator.isCoordinator) {
                var recoveryList = getAllPlayers();
                for (var r = 0; r < recoveryList.length; r++) {
                    decrementStealRecovery(recoveryList[r]);
                }
                coordinator.update();

                // Game clock management (only coordinator advances authoritative timers)
                var now = Date.now();
                if (now - lastSecond >= 1000) {
                    var timeRemaining = stateManager.get("timeRemaining");
                    var shotClock = stateManager.get("shotClock");
                    stateManager.set("timeRemaining", timeRemaining - 1, "mp_timer_tick");
                    stateManager.set("shotClock", shotClock - 1, "mp_shot_clock_tick");
                    lastSecond = now;

                    // Handle halftime transition
                    var currentHalf = stateManager.get("currentHalf");
                    var totalGameTime = stateManager.get("totalGameTime");
                    timeRemaining = stateManager.get("timeRemaining"); // Get updated value
                    if (currentHalf === 1 && timeRemaining <= totalGameTime / 2) {
                        stateManager.set("currentHalf", 2, "mp_halftime");
                        showHalftimeScreen(systems);
                        if (!stateManager.get("gameRunning")) {
                            break;
                        }

                        if (stateManager.get("pendingSecondHalfInbound")) {
                            startSecondHalfInbound(systems);
                        }
                        drawCourt(systems);
                        drawScore(systems);
                        lastSecond = Date.now();
                    }
                }

                var violationTriggeredThisFrame = false;

                // Shot clock violation handling (authoritative on coordinator)
                shotClock = stateManager.get("shotClock");
                if (shotClock <= 0) {
                    var currentTeam = stateManager.get("currentTeam");
                    announceEvent("shot_clock_violation", { team: currentTeam }, systems);
                    switchPossession(systems);
                    stateManager.set("shotClock", 24, "shot_clock_violation");
                }

                // Track ball handler movement / five-second logic
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
                        stateManager.set("ballHandlerStuckTimer", ballHandlerStuckTimer + 1, "mp_stuck_timer_increment");
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

                    if (ballHandler.playerData && ballHandler.playerData.hasDribble === false) {
                        // Store closely guarded distance for multiplayer synchronization
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
                            stateManager.set("ballHandlerDeadFrames", ballHandlerDeadFrames + 1, "mp_dead_dribble_frames");
                            var deadElapsed = now - stateManager.get("ballHandlerDeadSince");
                            if (!stateManager.get("ballHandlerDeadForcedShot") && deadElapsed >= 4500) {
                                if (ballHandler && !ballHandler.isHuman) {
                                    stateManager.set("ballHandlerDeadForcedShot", true, "forced_shot_triggered");
                                    attemptShot(systems);
                                    stateManager.set("ballHandlerDeadSince", now, "forced_shot_reset");
                                    stateManager.set("ballHandlerDeadFrames", 0, "forced_shot_reset");
                                    continue;
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
                            stateManager.set("ballHandlerAdvanceTimer", ballHandlerAdvanceTimer + 1, "mp_advance_timer_increment");
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

                // Unified violation checking (extracted to shared function)
                violationTriggeredThisFrame = checkViolations(violationTriggeredThisFrame, systems);

                // Skip rest of frame if violation occurred (prevents re-triggering)
                if (violationTriggeredThisFrame) {
                    lastSecond = Date.now();
                    frameNumber++;
                    continue;
                }

                // Run core game logic (physics, AI, collisions) - coordinator only
                checkSpriteCollision();

                // Update AI for non-player-controlled sprites
                updateAI(systems);
            }

            // Client reconciles with server state
            playerClient.update(frameNumber);

            // Update visuals (all clients render)
            updateAnnouncer(systems);

            // Only redraw court when no animations are active (allows trails to accumulate)
            if (!animationSystem.isBallAnimating()) {
                drawCourt(systems);
            }

            drawScore(systems);

            // Draw network quality HUD
            drawMultiplayerNetworkHUD(playerClient);

            // Sprite cycle
            Sprite.cycle();

            // Update non-blocking animations
            animationSystem.update();

            // Update non-blocking rebound scramble
            updateReboundScramble();

            // Draw quit confirmation overlay if open
            if (stateManager.get("quitMenuOpen")) {
                drawQuitMenuOverlay();
            }

            // Cycle trail frame to display animation trails
            if (trailFrame) {
                cycleFrame(trailFrame);
                // Keep ball on top of trail layer
                if (ballFrame && ballFrame.is_open) {
                    ballFrame.top();
                }
            }

            // Check game end conditions
            if (stateManager.get("timeRemaining") <= 0) {
                stateManager.set("gameRunning", false, "game_ended");
            }

            // Frame timing (20 FPS - appropriate for terminal gameplay)
            var frameTime = Date.now() - frameStart;
            var targetFrameTime = 50; // ~20 FPS
            if (frameTime < targetFrameTime) {
                mswait(targetFrameTime - frameTime);
            }

            frameNumber++;
        }
    }

    function drawMultiplayerNetworkHUD(playerClient) {
        if (!playerClient || !scoreFrame) return;

        var display = playerClient.getNetworkDisplay();
        if (!display) return;

        // Draw in top-right corner of score frame
        scoreFrame.gotoxy(60, 1);
        scoreFrame.putmsg(format("NET: %s%s %dms\1n",
            display.color,
            display.bars,
            display.latency), WHITE | BG_BLACK);
    }

    function drawQuitMenuOverlay() {
        // Draw overlay box in center of screen (non-blocking)
        var centerY = Math.floor(console.screen_rows / 2);
        var centerX = Math.floor(console.screen_columns / 2);

        // Build strings without .repeat() (not available in this JS engine)
        var equals = "";
        for (var i = 0; i < 40; i++) equals += "=";
        var spaces38 = "";
        for (var i = 0; i < 38; i++) spaces38 += " ";

        console.gotoxy(centerX - 20, centerY - 3);
        console.print("\1h\1w" + equals + "\1n");

        console.gotoxy(centerX - 20, centerY - 2);
        console.print("\1h\1w|\1n" + spaces38 + "\1h\1w|\1n");

        console.gotoxy(centerX - 20, centerY - 1);
        console.print("\1h\1w|\1n     \1h\1yQuit multiplayer game?\1n          \1h\1w|\1n");

        console.gotoxy(centerX - 20, centerY);
        console.print("\1h\1w|\1n" + spaces38 + "\1h\1w|\1n");

        console.gotoxy(centerX - 20, centerY + 1);
        console.print("\1h\1w|\1n  This will disconnect from session.  \1h\1w|\1n");

        console.gotoxy(centerX - 20, centerY + 2);
        console.print("\1h\1w|\1n" + spaces38 + "\1h\1w|\1n");

        console.gotoxy(centerX - 20, centerY + 3);
        console.print("\1h\1w|\1n      \1h\1wY\1n\1kes / \1h\1wN\1n\1ko / \1h\1wQ\1n\1k=Cancel      \1h\1w|\1n");

        console.gotoxy(centerX - 20, centerY + 4);
        console.print("\1h\1w" + "=".repeat(40) + "\1n");
    }

    // Cleanup
    if (ballFrame) ballFrame.close();
    if (teamAPlayer1) teamAPlayer1.remove();
    if (teamAPlayer2) teamAPlayer2.remove();
    if (teamBPlayer1) teamBPlayer1.remove();
    if (teamBPlayer2) teamBPlayer2.remove();
    if (courtFrame) courtFrame.close();
    cleanupScoreFrames();
    if (scoreFrame) scoreFrame.close();
    if (announcerFrame) announcerFrame.close();
}

// Wrap main() with error handler for automatic error logging
var wrappedMain = wrapWithErrorHandler(main, "main");

// Execute wrapped main
try {
    wrappedMain();
} catch (e) {
    // Error already logged by wrapper, show user-friendly message
    if (typeof console !== 'undefined' && console.print) {
        console.print("\r\n\1r\1hFATAL ERROR: Game crashed. Check error.log for details.\1n\r\n");
        console.print("Error: " + e.toString() + "\r\n");
        console.pause();
    } else {
        print("\r\nFATAL ERROR: Game crashed. Check error.log for details.\r\n");
        print("Error: " + e.toString() + "\r\n");
    }
}
