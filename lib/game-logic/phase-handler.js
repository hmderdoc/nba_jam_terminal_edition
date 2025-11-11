// NBA Jam Game Phase Handler
// Wave 22B: Non-blocking state machine for game phases

// ==============================================================================
// POSSESSION TRACKING SYSTEM - Detects double possession bugs
// ==============================================================================
var lastScoringSequence = {
    scoringTeam: null,
    scoringPlayer: null,
    timestamp: 0,
    inboundTeamExpected: null,
    inboundCompleted: false,
    nextScoreAllowed: true
};

function logPossessionAnomaly(message, data) {
    debugLog("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    debugLog("!!! POSSESSION ANOMALY DETECTED !!!");
    debugLog("!!! " + message);
    debugLog("!!! Data: " + JSON.stringify(data));
    debugLog("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
}

function trackScoreEvent(scoringTeam, scoringPlayer, inboundTeam, systems) {
    var now = Date.now();

    // Check if this is a double possession bug
    if (!lastScoringSequence.nextScoreAllowed) {
        logPossessionAnomaly("DOUBLE POSSESSION BUG!", {
            previousScorer: lastScoringSequence.scoringTeam,
            previousPlayer: lastScoringSequence.scoringPlayer,
            currentScorer: scoringTeam,
            currentPlayer: scoringPlayer,
            inboundCompleted: lastScoringSequence.inboundCompleted,
            timeSinceLastScore: now - lastScoringSequence.timestamp
        });
    }

    // Check if same team scored twice in a row without inbound
    if (lastScoringSequence.scoringTeam === scoringTeam &&
        !lastScoringSequence.inboundCompleted &&
        lastScoringSequence.timestamp > 0) {
        logPossessionAnomaly("SAME TEAM SCORED TWICE WITHOUT INBOUND!", {
            team: scoringTeam,
            previousPlayer: lastScoringSequence.scoringPlayer,
            currentPlayer: scoringPlayer,
            timeBetweenScores: now - lastScoringSequence.timestamp
        });
    }

    debugLog("[SCORE TRACKING] " + scoringTeam + " scored (player: " + scoringPlayer + "), inbound should go to: " + inboundTeam);

    lastScoringSequence = {
        scoringTeam: scoringTeam,
        scoringPlayer: scoringPlayer,
        timestamp: now,
        inboundTeamExpected: inboundTeam,
        inboundCompleted: false,
        nextScoreAllowed: false  // Must complete inbound before next score
    };
}

function trackInboundComplete(receivingTeam, systems) {
    debugLog("[INBOUND TRACKING] Inbound completed, ball given to: " + receivingTeam);

    if (lastScoringSequence.inboundTeamExpected !== receivingTeam) {
        logPossessionAnomaly("WRONG TEAM GOT INBOUND!", {
            expectedTeam: lastScoringSequence.inboundTeamExpected,
            actualTeam: receivingTeam,
            lastScorer: lastScoringSequence.scoringTeam
        });
    }

    lastScoringSequence.inboundCompleted = true;
    lastScoringSequence.nextScoreAllowed = true;
}

function trackPossessionChange(newTeam, reason, systems) {
    debugLog("[POSSESSION CHANGE] Team " + newTeam + " now has possession (reason: " + reason + ")");

    var ballCarrier = systems.stateManager.get("ballCarrier");
    if (ballCarrier) {
        var carrierTeam = getPlayerTeamName(ballCarrier);
        if (carrierTeam !== newTeam) {
            logPossessionAnomaly("POSSESSION DESYNC!", {
                stateCurrentTeam: newTeam,
                ballCarrierActualTeam: carrierTeam,
                ballCarrierName: ballCarrier.playerData ? ballCarrier.playerData.name : "unknown",
                reason: reason
            });
        }
    }
}

// ==============================================================================
// PHASE HANDLERS
// ==============================================================================

/**
 * Update current game phase and handle transitions
 * Called every frame from main game loop
 * @param {number} frameDelayMs - Frame delay in ms (for timing calculations)
 */
function updateGamePhase(frameDelayMs, systems) {
    debugLog(">>> updateGamePhase() CALLED, frameDelayMs=" + frameDelayMs);
    var stateManager = systems.stateManager;
    var phase = stateManager.get('phase');
    debugLog(">>> updateGamePhase() phase.current=" + (phase ? phase.current : "NULL"));
    if (!phase) return;

    var currentPhase = phase.current;
    debugLog(">>> updateGamePhase() currentPhase=" + currentPhase);

    switch (currentPhase) {
        case PHASE_NORMAL:
            // Normal gameplay - no special handling needed
            break;

        case PHASE_SHOT_QUEUED:
            debugLog(">>> About to call handleShotQueued()");
            handleShotQueued(systems);
            debugLog(">>> Returned from handleShotQueued()");
            break;

        case PHASE_SHOT_ANIMATING:
            handleShotAnimating(frameDelayMs, systems);
            break;

        case PHASE_SHOT_SCORED:
            handleShotScored(frameDelayMs, systems);
            break;

        case PHASE_SHOT_MISSED:
            handleShotMissed(frameDelayMs, systems);
            break;

        case PHASE_REBOUND_SCRAMBLE:
            handleReboundScramble(systems);
            break;

        case PHASE_INBOUND_SETUP:
            handleInboundSetup(frameDelayMs, systems);
            break;
    }
}

/**
 * PHASE: SHOT_QUEUED
 * Shot has been queued, start animation and transition to SHOT_ANIMATING
 */
function handleShotQueued(systems) {
    debugLog(">>> PHASE: handleShotQueued() called");
    var stateManager = systems.stateManager;
    var gameState = stateManager.get();
    var phaseData = getPhaseData(systems);
    debugLog(">>> PHASE: phaseData=" + (phaseData ? "EXISTS" : "NULL"));
    debugLog(">>> PHASE: phaseData.attemptType=" + (phaseData ? phaseData.attemptType : "N/A"));

    // Handle dunks - now using non-blocking animation system
    if (phaseData.attemptType === "dunk") {
        var player = phaseData.shooter;
        debugLog("[PHASE DUNK] Processing dunk for " + (player && player.playerData ? player.playerData.name : "unknown"));

        // Get dunk info and flight plan
        var dunkInfo = phaseData.dunkInfo;
        var flightPlan = phaseData.flightPlan;
        debugLog("[PHASE DUNK] Initial dunkInfo=" + (dunkInfo ? "present" : "null") + ", flightPlan=" + (flightPlan ? "present" : "null"));

        if (!dunkInfo || !flightPlan) {
            // Fallback: if phase data missing dunk details, evaluate now
            debugLog("[PHASE DUNK] Fallback: evaluating dunk opportunity");
            var teamName = phaseData.shooterTeam;
            var distToBasket = Math.sqrt(
                Math.pow(phaseData.targetX - player.x, 2) +
                Math.pow(phaseData.targetY - player.y, 2)
            );
            dunkInfo = evaluateDunkOpportunity(player, teamName, phaseData.targetX, phaseData.targetY, distToBasket);
            if (dunkInfo) {
                debugLog("[PHASE DUNK] Fallback dunkInfo obtained, generating flight plan");
                var style = selectDunkStyle(player.playerData, dunkInfo);
                flightPlan = generateDunkFlight(player, dunkInfo, phaseData.targetX, phaseData.targetY, style);
                debugLog("[PHASE DUNK] Fallback flightPlan=" + (flightPlan ? "generated" : "null"));
            } else {
                debugLog("[PHASE DUNK] Fallback dunkInfo is null - dunk not possible");
            }
        }

        debugLog("[PHASE DUNK] Final check: dunkInfo=" + (dunkInfo ? "yes" : "no") + ", flightPlan=" + (flightPlan ? "yes" : "no") + ", animationSystem=" + (systems.animationSystem ? "yes" : "no"));
        if (dunkInfo && flightPlan && systems.animationSystem && typeof systems.animationSystem.queueDunkAnimation === "function") {
            // Auto-contest dunk
            debugLog("[PHASE DUNK] Queuing dunk animation");
            if (typeof autoContestDunk === "function") {
                autoContestDunk(player, dunkInfo, phaseData.targetX, phaseData.targetY, phaseData.style || "default", systems);
            }

            // Queue non-blocking dunk animation
            systems.animationSystem.queueDunkAnimation(
                player,
                dunkInfo,
                flightPlan,
                phaseData.targetX,
                phaseData.targetY,
                phaseData.made,
                phaseData.style || "default",
                null  // No callback needed, phase handler manages state
            );
            debugLog("[PHASE DUNK] Dunk animation queued successfully");

            // Mark shot in progress
            stateManager.set("shotInProgress", true, "dunk_started");

            // Immediately transition to SHOT_ANIMATING
            setPhase(PHASE_SHOT_ANIMATING, phaseData, 0, null, systems);
            return;
        }

        // If we get here, dunk failed validation - log error and treat as shot
        debugLog("[PHASE DUNK] Dunk validation failed, falling back to shot");
        if (!dunkInfo) {
            debugLog("ERROR: attemptType='dunk' but dunkInfo is null! Bug in shooting-system.js");
        } else if (!flightPlan) {
            debugLog("ERROR: attemptType='dunk' but flightPlan is null! Bug in shooting-system.js");
        } else if (!systems.animationSystem) {
            debugLog("ERROR: attemptType='dunk' but animationSystem not available!");
        }
        debugLog("  -> Falling back to treating dunk as regular shot");
        phaseData.attemptType = "shot";
    }

    // Jump shots use non-blocking animation system
    if (systems.animationSystem && typeof systems.animationSystem.queueShotAnimation === "function") {
        // Auto-contest shot
        var shooter = phaseData.shooter;
        if (shooter && typeof autoContestShot === "function") {
            autoContestShot(shooter, phaseData.targetX, phaseData.targetY, systems);
        }

        systems.animationSystem.queueShotAnimation(
            phaseData.shotStartX,
            phaseData.shotStartY,
            phaseData.targetX,
            phaseData.targetY,
            phaseData.made,
            phaseData.blocked || false,
            phaseData.shooter,
            phaseData.animDuration || 800,
            phaseData.reboundBounces || [],
            null  // No callback needed for shots (state already handled by phase transitions)
        );
    }

    // Mark shot in progress
    stateManager.set("shotInProgress", true, "shot_started");
    stateManager.set("shotStartX", phaseData.shotStartX, "shot_tracking");
    stateManager.set("shotStartY", phaseData.shotStartY, "shot_tracking");

    // Immediately transition to SHOT_ANIMATING
    setPhase(PHASE_SHOT_ANIMATING, phaseData, 0, null, systems);
}

/**
 * PHASE: SHOT_ANIMATING
 * Shot animation is in progress, wait for completion
 */
function handleShotAnimating(frameDelayMs, systems) {
    debugLog(">>> PHASE: handleShotAnimating() - checking if animation complete");
    var stateManager = systems.stateManager;
    var gameState = stateManager.get();
    var phaseData = getPhaseData(systems);

    // Check if animation is complete
    if (!systems.animationSystem || !systems.animationSystem.isBallAnimating()) {
        // Animation finished
        debugLog(">>> PHASE: Animation complete, clearing shotInProgress flag");
        stateManager.set("shotInProgress", false, "shot_completed");

        if (phaseData.made && !phaseData.blocked) {
            // Shot made - transition to SHOT_SCORED
            // Wave 23D: Increased delay to show made basket before inbound (was 800/900)
            var durationMs = phaseData.attemptType === "dunk" ? 1500 : 1200;
            setPhase(PHASE_SHOT_SCORED, phaseData, durationMs, frameDelayMs, systems);
        } else {
            // Shot missed - transition to SHOT_MISSED
            setPhase(PHASE_SHOT_MISSED, phaseData, 200, frameDelayMs, systems);
            setPhase(PHASE_SHOT_MISSED, phaseData, 200, frameDelayMs, systems);
        }
    }
}

/**
 * PHASE: SHOT_SCORED
 * Made basket, display score flash, wait for duration
 */
function handleShotScored(frameDelayMs, systems) {
    var stateManager = systems.stateManager;
    var phase = stateManager.get('phase');
    var currentTeam = stateManager.get('currentTeam');
    var phaseData = getPhaseData(systems);

    debugLog("[SHOT_SCORED HANDLER] frameCounter=" + phase.frameCounter + ", elapsed=" + phase.elapsed + ", duration=" + phase.duration);

    // On first frame, handle scoring logic
    if (phase.frameCounter === 0) {
        var player = phaseData.shooter;
        var playerData = player ? player.playerData : null;

        if (!playerData) {
            // No player data, skip to inbound
            // Wave 23D: Extended to 4000ms (80 frames) for natural player movement - doubled for better pacing
            setPhase(PHASE_INBOUND_SETUP, phaseData, 4000, frameDelayMs, systems);
            return;
        }

        // CRITICAL: Use shooterTeam from phase data, NOT currentTeam
        // currentTeam may have changed between shot attempt and scoring (turnover, violation, etc.)
        var scoringTeamKey = phaseData.shooterTeam || currentTeam;
        var inboundTeamKey = (scoringTeamKey === "teamA") ? "teamB" : "teamA";

        // Debug logging
        if (typeof debugLog === "function") {
            debugLog("[SHOT_SCORED] scoringTeamKey=" + scoringTeamKey +
                " (from phaseData.shooterTeam=" + phaseData.shooterTeam +
                "), currentTeam=" + currentTeam + ", inboundTeamKey=" + inboundTeamKey);
        }

        // Score!
        var points = phaseData.is3Pointer ? 3 : 2;
        var currentScore = stateManager.get("score." + scoringTeamKey);
        stateManager.set("score." + scoringTeamKey, currentScore + points, "basket_scored");

        // TRACK SCORING EVENT - Monitor for double possession bug
        trackScoreEvent(scoringTeamKey, playerData.name, inboundTeamKey, systems);

        // CRITICAL FIX #1: Clear ball carrier immediately after scoring
        // This prevents the scoring player from shooting/passing during SHOT_SCORED and INBOUND_SETUP phases
        stateManager.set("ballCarrier", null, "basket_scored_clear_possession");
        if (player) {
            player.hasBall = false;
        }
        debugLog("[SHOT_SCORED] Cleared ballCarrier to prevent double possession bug");

        // CRITICAL FIX #2: Clear any in-flight pass animations
        // Passes started before the basket was made should not complete during celebration
        if (systems.animationSystem && typeof systems.animationSystem.clearPassAnimations === "function") {
            systems.animationSystem.clearPassAnimations();
        } var currentConsecutive = stateManager.get("consecutivePoints." + scoringTeamKey);
        stateManager.set("consecutivePoints." + scoringTeamKey, currentConsecutive + 1, "consecutive_increment");

        playerData.heatStreak++;
        if (typeof playerData.fireMakeStreak !== "number") playerData.fireMakeStreak = 0;
        playerData.fireMakeStreak++;

        // Update stats
        if (playerData.stats) {
            playerData.stats.points += points;
            playerData.stats.fgm++;
            if (phaseData.is3Pointer) playerData.stats.tpm++;
            if (phaseData.attemptType === "dunk") {
                playerData.stats.dunks = (playerData.stats.dunks || 0) + 1;
            }
        }

        // Award assist if applicable
        if (typeof maybeAwardAssist === "function") {
            maybeAwardAssist(player, systems);
        }
        if (typeof clearPotentialAssist === "function") {
            clearPotentialAssist(systems);
        }

        // Refill turbo for both teams
        var scoringSprites = spriteRegistry.getByTeam(scoringTeamKey);
        for (var i = 0; i < scoringSprites.length; i++) {
            if (scoringSprites[i] && scoringSprites[i].playerData) {
                scoringSprites[i].playerData.turbo = MAX_TURBO;
            }
        }
        var inboundSprites = spriteRegistry.getByTeam(inboundTeamKey);
        for (var j = 0; j < inboundSprites.length; j++) {
            if (inboundSprites[j] && inboundSprites[j].playerData) {
                inboundSprites[j].playerData.turbo = MAX_TURBO;
            }
        }

        // Announcer callouts
        if (phaseData.attemptType === "dunk" && typeof announceEvent === "function") {
            announceEvent("dunk", {
                playerName: playerData.name,
                player: player,
                team: scoringTeamKey,
                style: phaseData.dunkStyle || null
            }, systems);
        } else if (phaseData.is3Pointer && typeof announceEvent === "function") {
            announceEvent("three_pointer", {
                playerName: playerData.name,
                player: player,
                team: scoringTeamKey
            }, systems);
        } else if (typeof announceEvent === "function") {
            announceEvent("shot_made", {
                playerName: playerData.name,
                player: player,
                team: scoringTeamKey
            }, systems);
        }

        // Check for "on fire" status
        if (playerData.fireMakeStreak >= 3 && typeof setPlayerOnFire === "function") {
            setPlayerOnFire(player, systems);
            if (typeof announceEvent === "function") {
                announceEvent("on_fire", {
                    playerName: playerData.name,
                    player: player,
                    team: scoringTeamKey
                }, systems);
            }
        }

        // Reset other team's streak
        stateManager.set("consecutivePoints." + inboundTeamKey, 0, "opponent_scored_reset");
        if (typeof clearTeamOnFire === "function") {
            clearTeamOnFire(inboundTeamKey, systems);
        }

        // Trigger possession beep and score flash
        if (typeof triggerPossessionBeep === "function") {
            triggerPossessionBeep(systems);
        }
        if (typeof startScoreFlash === "function") {
            startScoreFlash(scoringTeamKey, inboundTeamKey, systems);
        }

        // Draw score to show update
        if (typeof drawScore === "function") {
            drawScore(systems);
        }

        // Store inbound team for next phase
        phaseData.inboundTeamKey = inboundTeamKey;
        phaseData.scoringTeamKey = scoringTeamKey;
    }

    // Advance timer
    debugLog("[SHOT_SCORED HANDLER] About to call advancePhaseTimer");
    if (advancePhaseTimer(systems)) {
        debugLog("[SHOT_SCORED HANDLER] advancePhaseTimer returned TRUE, transitioning to INBOUND_SETUP");

        // Clear basket flash before transitioning
        if (systems.animationSystem && typeof systems.animationSystem.clearBasketFlash === 'function') {
            systems.animationSystem.clearBasketFlash();
        }

        // Duration complete, transition to INBOUND_SETUP
        // Ensure scoringTeamKey and inboundTeamKey are preserved in transition
        // Wave 23D: Extended to 4000ms (80 frames) for natural player movement - doubled for better pacing
        var transitionData = getPhaseData(systems);  // Get current phase data with all accumulated keys
        setPhase(PHASE_INBOUND_SETUP, transitionData, 4000, frameDelayMs, systems);
    } else {
        debugLog("[SHOT_SCORED HANDLER] advancePhaseTimer returned FALSE, staying in SHOT_SCORED");
    }
}

/**
 * PHASE: SHOT_MISSED
 * Missed shot, brief pause, then create rebound
 */
function handleShotMissed(frameDelayMs, systems) {
    var stateManager = systems.stateManager;
    var phase = stateManager.get('phase');
    var currentTeam = stateManager.get('currentTeam');
    var phaseData = getPhaseData(systems);

    // On first frame, handle miss logic
    if (phase.frameCounter === 0) {
        var player = phaseData.shooter;
        var playerData = player ? player.playerData : null;

        // Use shooterTeam from phase data, not currentTeam
        var shooterTeamKey = phaseData.shooterTeam || currentTeam;

        // Reset streak
        if (playerData) {
            var consecutivePoints = stateManager.get('consecutivePoints') || { teamA: 0, teamB: 0 };
            consecutivePoints[shooterTeamKey] = 0;
            stateManager.set("consecutivePoints", consecutivePoints, "shot_missed");
            playerData.heatStreak = 0;
        }

        // Announcer callouts
        if (phaseData.attemptType === "dunk" && typeof announceEvent === "function") {
            if (phaseData.blocked && phaseData.dunkBlocker) {
                var blockerData = phaseData.dunkBlocker.playerData;
                announceEvent("block", {
                    playerName: blockerData ? blockerData.name : "",
                    player: phaseData.dunkBlocker,
                    team: getPlayerTeamName(phaseData.dunkBlocker)
                }, systems);
            } else if (playerData) {
                announceEvent("shot_missed", {
                    playerName: playerData.name,
                    player: player,
                    team: shooterTeamKey
                }, systems);
            }
        } else if (!phaseData.blocked && playerData && typeof announceEvent === "function") {
            announceEvent("shot_missed", {
                playerName: playerData.name,
                player: player,
                team: shooterTeamKey
            }, systems);
        }

        // Clear potential assist if not a blocked dunk
        if (!phaseData.blocked || phaseData.attemptType !== "dunk") {
            if (typeof clearPotentialAssist === "function") {
                clearPotentialAssist(systems);
            }
        }
    }

    // Advance timer
    if (advancePhaseTimer(systems)) {
        // Brief pause complete, create rebound
        var targetX = phaseData.targetX;
        var targetY = phaseData.targetY;
        var blockDeflectionX = stateManager.get('blockDeflectionX');
        var blockDeflectionY = stateManager.get('blockDeflectionY');

        if (phaseData.attemptType === "dunk" && phaseData.blocked) {
            // Blocked dunk - rebound at basket
            if (typeof createRebound === "function") {
                createRebound(targetX, targetY, systems);
            }
        } else if (phaseData.blocked && typeof blockDeflectionX === "number") {
            // Blocked shot - create rebound at deflection point
            if (typeof createRebound === "function") {
                createRebound(blockDeflectionX, blockDeflectionY, systems);
            }
            stateManager.set("blockDeflectionX", undefined, "block_deflection_consumed");
            stateManager.set("blockDeflectionY", undefined, "block_deflection_consumed");
        } else {
            // Normal miss - create rebound at basket
            if (typeof createRebound === "function") {
                createRebound(targetX, targetY, systems);
            }
        }

        // Transition to REBOUND_SCRAMBLE (or back to NORMAL if someone already secured it)
        var reboundScramble = stateManager.get('reboundScramble');
        if (reboundScramble && reboundScramble.active) {
            setPhase(PHASE_REBOUND_SCRAMBLE, {}, 0, null, systems);
        } else {
            // Rebound already secured, return to normal
            setPhase(PHASE_NORMAL, {}, 0, null, systems);
        }
    }
}

/**
 * PHASE: REBOUND_SCRAMBLE
 * Rebound scramble active, wait for someone to secure it
 */
function handleReboundScramble(systems) {
    var stateManager = systems.stateManager;
    var reboundScramble = stateManager.get('reboundScramble');
    // Check if rebound scramble is still active
    if (!reboundScramble || !reboundScramble.active) {
        // Rebound secured, return to normal gameplay
        setPhase(PHASE_NORMAL, {}, 0, null, systems);
    }

    // Rebound system is already non-blocking, handled by updateReboundScramble()
    // We just need to detect when it's done
}

/**
 * PHASE: INBOUND_SETUP
 * Wave 24: Natural ball pickup animation added
 * 
 * Timeline:
 * - Frames 0-24: Inbounder walks to ball location (under basket), picks it up
 * - Frames 25-94: Players move to inbound positions (70 frames)
 * - Frames 95-100: Pause with everyone in position (6 frames)
 * - Frame 101+: Queue and wait for inbound pass
 * 
 * Clocks are stopped during this entire phase (ball is out of bounds)
 */
function handleInboundSetup(frameDelayMs, systems) {
    var stateManager = systems.stateManager;
    var phase = stateManager.get('phase');
    var currentTeam = stateManager.get('currentTeam');
    var phaseData = getPhaseData(systems);

    // On first frame, setup inbound (calculates target positions)
    if (phase.frameCounter === 0) {
        var scoringTeamKey = phaseData.scoringTeamKey;

        debugLog("[INBOUND] handleInboundSetup - scoringTeamKey: " + scoringTeamKey +
            ", inboundTeamKey: " + phaseData.inboundTeamKey +
            ", currentTeam: " + currentTeam);

        if (!scoringTeamKey) {
            debugLog("[INBOUND ERROR] scoringTeamKey not set! Falling back to currentTeam");
            scoringTeamKey = currentTeam;
        }

        if (typeof setupInbound === "function") {
            setupInbound(scoringTeamKey, systems);
        }

        // Store ball location (should be at basket from made shot)
        // Wave 24: Ball location stored for pickup animation
        var inboundTeamKey = phaseData.inboundTeamKey || (scoringTeamKey === "teamA" ? "teamB" : "teamA");
        var basketX = (inboundTeamKey === "teamA") ? BASKET_LEFT_X : BASKET_RIGHT_X;
        var basketY = (inboundTeamKey === "teamA") ? BASKET_LEFT_Y : BASKET_RIGHT_Y;
        phaseData.ballPickupX = basketX;
        phaseData.ballPickupY = basketY;
        debugLog("[INBOUND] Ball at basket: (" + basketX + "," + basketY + ")");

        phaseData.passQueued = false;
        phaseData.ballPickedUp = false;
    }

    // Frames 0-24: Inbounder walks to ball, picks it up (25 frames = 1.25 seconds)
    // SIMULTANEOUSLY: All other players start moving toward their final positions
    // EXCEPTION: For violations, skip ball pickup (ball teleports), only animate player movement
    var positioning = stateManager.get("inboundPositioning");
    var skipBallPickup = positioning && positioning.skipBallPickup;
    
    if (positioning && positioning.inbounder && phase.frameCounter < 25) {
        var pickupProgress = phase.frameCounter / 24; // 0.0 to 1.0
        var easePickup = (Math.sin((pickupProgress - 0.5) * Math.PI) + 1) / 2; // Smooth ease

        // INBOUNDER: Walk to ball location (or sideline for violations)
        var inbounder = positioning.inbounder.sprite;
        if (inbounder && inbounder.moveTo) {
            // First frame: store initial positions for all players
            if (phase.frameCounter === 0) {
                phaseData.inbounderPickupStartX = inbounder.x;
                phaseData.inbounderPickupStartY = inbounder.y;

                // Store start positions for other players too
                if (positioning.receiver && positioning.receiver.sprite) {
                    positioning.receiver.startX = positioning.receiver.sprite.x;
                    positioning.receiver.startY = positioning.receiver.sprite.y;
                }
                if (positioning.defenders) {
                    for (var d = 0; d < positioning.defenders.length; d++) {
                        if (positioning.defenders[d] && positioning.defenders[d].sprite) {
                            positioning.defenders[d].startX = positioning.defenders[d].sprite.x;
                            positioning.defenders[d].startY = positioning.defenders[d].sprite.y;
                        }
                    }
                }
            }

            // For violations: move directly to sideline position
            // For scores: move to ball location under basket
            var targetX = skipBallPickup ? positioning.inbounder.targetX : phaseData.ballPickupX;
            var targetY = skipBallPickup ? positioning.inbounder.targetY : phaseData.ballPickupY;
            var currentX = phaseData.inbounderPickupStartX + (targetX - phaseData.inbounderPickupStartX) * easePickup;
            var currentY = phaseData.inbounderPickupStartY + (targetY - phaseData.inbounderPickupStartY) * easePickup;

            inbounder.moveTo(Math.round(currentX), Math.round(currentY));

            // Move ball with inbounder (visual pickup for scores, immediate for violations)
            if (typeof moveBallFrameTo === "function") {
                moveBallFrameTo(Math.round(currentX + 2), Math.round(currentY + 2));
            }
        }

        // SIMULTANEOUSLY: Move receiver toward their position (slower during pickup phase)
        if (positioning.receiver && positioning.receiver.sprite && positioning.receiver.sprite.moveTo) {
            var recProgress = easePickup * 0.35; // Only move 35% of the way during pickup phase
            var recX = positioning.receiver.startX + (positioning.receiver.targetX - positioning.receiver.startX) * recProgress;
            var recY = positioning.receiver.startY + (positioning.receiver.targetY - positioning.receiver.startY) * recProgress;
            positioning.receiver.sprite.moveTo(Math.round(recX), Math.round(recY));
        }

        // SIMULTANEOUSLY: Move defenders toward their positions (they move more since they have farther to go)
        if (positioning.defenders) {
            for (var i = 0; i < positioning.defenders.length; i++) {
                var def = positioning.defenders[i];
                if (def && def.sprite && def.sprite.moveTo) {
                    // Defenders move 40% of the way during pickup phase (they have the most ground to cover)
                    var defProgress = easePickup * 0.4;
                    var defX = def.startX + (def.targetX - def.startX) * defProgress;
                    var defY = def.startY + (def.targetY - def.startY) * defProgress;
                    def.sprite.moveTo(Math.round(defX), Math.round(defY));
                }
            }
        }

        phase.frameCounter++;
        if (phase.frameCounter === 25) {
            debugLog("[INBOUND] Ball picked up at frame 25, all players have started moving");
            phaseData.ballPickedUp = true;

            // Update start positions for continuation phase (inbounder now carries ball to out-of-bounds)
            if (positioning.inbounder && positioning.inbounder.sprite) {
                positioning.inbounder.startX = positioning.inbounder.sprite.x;
                positioning.inbounder.startY = positioning.inbounder.sprite.y;
            }
            if (positioning.receiver && positioning.receiver.sprite) {
                positioning.receiver.startX = positioning.receiver.sprite.x;
                positioning.receiver.startY = positioning.receiver.sprite.y;
            }
            if (positioning.defenders) {
                for (var d = 0; d < positioning.defenders.length; d++) {
                    if (positioning.defenders[d] && positioning.defenders[d].sprite) {
                        positioning.defenders[d].startX = positioning.defenders[d].sprite.x;
                        positioning.defenders[d].startY = positioning.defenders[d].sprite.y;
                    }
                }
            }
        }
        return;
    }

    // Frames 25-94: Animate player positioning (70 frames for natural movement)
    if (positioning && phase.frameCounter >= 25 && phase.frameCounter < 95) {
        var positioningFrame = phase.frameCounter - 25; // 0-69
        var rawProgress = positioningFrame / 69; // 0.0 to 1.0

        // Ease-in-out function for natural acceleration/deceleration
        var easeProgress = (Math.sin((rawProgress - 0.5) * Math.PI) + 1) / 2;

        // Move inbounder (fastest - 1.1x speed, slight curve)
        if (positioning.inbounder && positioning.inbounder.sprite && positioning.inbounder.sprite.moveTo) {
            var inbProgress = Math.min(1.0, easeProgress * 1.1);
            var inbX = positioning.inbounder.startX + (positioning.inbounder.targetX - positioning.inbounder.startX) * inbProgress;
            var inbY = positioning.inbounder.startY + (positioning.inbounder.targetY - positioning.inbounder.startY) * inbProgress;
            // Add slight arc to path (peaks at midpoint)
            var arcOffset = Math.sin(rawProgress * Math.PI) * 0.5;
            positioning.inbounder.sprite.moveTo(Math.round(inbX), Math.round(inbY + arcOffset));

            // Ball follows inbounder
            if (typeof moveBallFrameTo === "function") {
                moveBallFrameTo(Math.round(inbX + 2), Math.round(inbY + arcOffset + 2));
            }
        }

        // Move receiver (medium speed - 0.95x, different arc)
        if (positioning.receiver && positioning.receiver.sprite && positioning.receiver.sprite.moveTo) {
            var recProgress = Math.min(1.0, easeProgress * 0.95);
            var recX = positioning.receiver.startX + (positioning.receiver.targetX - positioning.receiver.startX) * recProgress;
            var recY = positioning.receiver.startY + (positioning.receiver.targetY - positioning.receiver.startY) * recProgress;
            // Opposite arc direction for variety
            var arcOffset = Math.sin(rawProgress * Math.PI) * -0.3;
            positioning.receiver.sprite.moveTo(Math.round(recX + arcOffset), Math.round(recY));
        }

        // Move defenders (slower - 0.85x and 0.9x, varied paths)
        if (positioning.defenders) {
            for (var i = 0; i < positioning.defenders.length; i++) {
                var def = positioning.defenders[i];
                if (def && def.sprite && def.sprite.moveTo) {
                    // Vary speed by defender index
                    var defSpeedMult = i === 0 ? 0.85 : 0.9;
                    var defProgress = Math.min(1.0, easeProgress * defSpeedMult);
                    var defX = def.startX + (def.targetX - def.startX) * defProgress;
                    var defY = def.startY + (def.targetY - def.startY) * defProgress;
                    // Vary arc by defender index
                    var arcOffset = Math.sin(defProgress * Math.PI) * (i === 0 ? 0.4 : -0.2);
                    def.sprite.moveTo(Math.round(defX + arcOffset), Math.round(defY));
                }
            }
        }

        phase.frameCounter++;
        if (phase.frameCounter % 10 === 0) {
            debugLog("[INBOUND POSITIONING] frame " + phase.frameCounter + "/95, posFrame=" + positioningFrame + ", easeProgress=" + easeProgress.toFixed(2));
        }
        return;
    }

    // Frames 95-100: Pause with everyone in position (6 frames = 300ms pause)
    if (phase.frameCounter >= 95 && phase.frameCounter < 101) {
        phase.frameCounter++;
        if (phase.frameCounter === 98) {
            debugLog("[INBOUND] Players positioned, pausing before pass");
        }
        return;
    }

    // Frame 101: Queue the inbound pass
    if (phase.frameCounter === 101 && !phaseData.passQueued) {
        var passData = stateManager.get("inboundPassData");
        if (passData && passData.inbounder && passData.receiver) {
            debugLog("[INBOUND] Queuing pass animation at frame 101");
            var inboundContext = {
                inbounder: passData.inbounder,
                inbounderX: passData.inbounderX,
                inbounderY: passData.inbounderY,
                team: passData.team
            };
            animatePass(passData.inbounder, passData.receiver, null, inboundContext, systems);
            phaseData.passQueued = true;
        }
    }

    // Frames 101+: Wait for pass animation
    var isBallAnimating = systems.animationSystem && systems.animationSystem.isBallAnimating();
    if (phaseData.passQueued && isBallAnimating) {
        phase.frameCounter++;
        debugLog("[INBOUND] Waiting for pass animation, frameCounter=" + phase.frameCounter);
        return;
    }

    // Pass complete or phase expired - return to normal
    if (advancePhaseTimer(systems) || (phaseData.passQueued && !isBallAnimating)) {
        debugLog("[INBOUND] Phase complete, returning to NORMAL");

        // Enable score flash regain check - flash should stop when team crosses half-court
        var inboundTeam = phaseData.inboundTeamKey;
        if (inboundTeam && typeof enableScoreFlashRegainCheck === "function") {
            enableScoreFlashRegainCheck(inboundTeam, systems);
            debugLog("[INBOUND] Enabled score flash regain check for " + inboundTeam);
        }

        stateManager.set("inboundPositioning", null, "cleanup");
        stateManager.set("inboundPassData", null, "cleanup");
        setPhase(PHASE_NORMAL, {}, 0, null, systems);
    }
}