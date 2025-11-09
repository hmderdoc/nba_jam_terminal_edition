// NBA Jam Game Phase Handler
// Wave 22B: Non-blocking state machine for game phases

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

        // Get dunk info and flight plan
        var dunkInfo = phaseData.dunkInfo;
        var flightPlan = phaseData.flightPlan;

        if (!dunkInfo || !flightPlan) {
            // Fallback: if phase data missing dunk details, evaluate now
            var basketY = phaseData.targetY;
            dunkInfo = evaluateDunkOpportunity(player, basketY, phaseData.targetX, phaseData.targetY);
            if (dunkInfo && dunkInfo.canDunk) {
                var style = selectDunkStyle(player, dunkInfo);
                flightPlan = buildDunkFlightPlan(player, dunkInfo, style, phaseData.targetX, phaseData.targetY);
            }
        }

        if (dunkInfo && flightPlan && systems.animationSystem && typeof systems.animationSystem.queueDunkAnimation === "function") {
            // Auto-contest dunk
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

            // Mark shot in progress
            stateManager.set("shotInProgress", true, "dunk_started");

            // Immediately transition to SHOT_ANIMATING
            setPhase(PHASE_SHOT_ANIMATING, phaseData, 0, null, systems);
            return;
        }

        // If we get here, dunk failed validation - log error and treat as shot
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
            var durationMs = phaseData.attemptType === "dunk" ? 900 : 800;
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

    // On first frame, handle scoring logic
    if (phase.frameCounter === 0) {
        var player = phaseData.shooter;
        var playerData = player ? player.playerData : null;

        if (!playerData) {
            // No player data, skip to inbound
            setPhase(PHASE_INBOUND_SETUP, phaseData, 200, frameDelayMs, systems);
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

        var currentConsecutive = stateManager.get("consecutivePoints." + scoringTeamKey);
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
    if (advancePhaseTimer(systems)) {
        // Duration complete, transition to INBOUND_SETUP
        // Ensure scoringTeamKey and inboundTeamKey are preserved in transition
        var transitionData = getPhaseData(systems);  // Get current phase data with all accumulated keys
        setPhase(PHASE_INBOUND_SETUP, transitionData, 200, frameDelayMs, systems);
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
 * Setting up for inbound after made basket
 * Wave 22B: Waits for inbound pass animation to complete before transitioning
 */
function handleInboundSetup(frameDelayMs, systems) {
    var stateManager = systems.stateManager;
    var phase = stateManager.get('phase');
    var currentTeam = stateManager.get('currentTeam');
    var phaseData = getPhaseData(systems);

    // On first frame, setup inbound
    if (phase.frameCounter === 0) {
        // CRITICAL: scoringTeamKey is the team that SCORED
        // setupInbound() expects scoringTeam and switches possession internally
        var scoringTeamKey = phaseData.scoringTeamKey;

        // Debug: Log what we're receiving
        if (typeof debugLog === "function") {
            debugLog("[INBOUND] handleInboundSetup - scoringTeamKey: " + scoringTeamKey +
                ", inboundTeamKey: " + phaseData.inboundTeamKey +
                ", currentTeam: " + currentTeam);
        }

        // Fallback: if not set, determine from current team
        // (this shouldn't happen, but safety check)
        if (!scoringTeamKey) {
            if (typeof debugLog === "function") {
                debugLog("[INBOUND ERROR] scoringTeamKey not set! Falling back to currentTeam");
            }
            scoringTeamKey = currentTeam;
        }

        if (typeof setupInbound === "function") {
            setupInbound(scoringTeamKey, systems);
        }

        // Wave 22B: setupInbound() queues pass animation
        // Mark that we're waiting for the pass to complete
        phaseData.waitingForPassAnimation = true;
    }

    // Wave 22B: Wait for pass animation to complete
    // State mutations (ballCarrier, currentTeam) happen in pass completion callback
    var isBallAnimating = systems.animationSystem && systems.animationSystem.isBallAnimating();
    debugLog("[INBOUND] waitingForPass=" + phaseData.waitingForPassAnimation + ", isBallAnimating=" + isBallAnimating);

    if (phaseData.waitingForPassAnimation && isBallAnimating) {
        // Still animating - MUST increment frameCounter even while waiting
        // Otherwise frameCounter stays at 0 and we queue new pass animation every frame!
        phase.frameCounter++;
        debugLog("[INBOUND] Still waiting for pass animation, frameCounter now " + phase.frameCounter);
        return;
    }

    debugLog("[INBOUND] Pass animation complete, advancing phase");
    // Pass animation complete (or no animation was queued)
    phaseData.waitingForPassAnimation = false;

    // Advance timer - wait for the brief pause, then return to normal
    if (advancePhaseTimer(systems)) {
        setPhase(PHASE_NORMAL, {}, 0, null, systems);
    }
}