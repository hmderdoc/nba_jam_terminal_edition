// NBA Jam Game Phase Handler
// Wave 22B: Non-blocking state machine for game phases

/**
 * Update current game phase and handle transitions
 * Called every frame from main game loop
 * @param {number} frameDelayMs - Frame delay in ms (for timing calculations)
 */
function updateGamePhase(frameDelayMs) {
    if (!gameState.phase) return;

    var currentPhase = gameState.phase.current;

    switch (currentPhase) {
        case PHASE_NORMAL:
            // Normal gameplay - no special handling needed
            break;

        case PHASE_SHOT_QUEUED:
            handleShotQueued();
            break;

        case PHASE_SHOT_ANIMATING:
            handleShotAnimating(frameDelayMs);
            break;

        case PHASE_SHOT_SCORED:
            handleShotScored(frameDelayMs);
            break;

        case PHASE_SHOT_MISSED:
            handleShotMissed(frameDelayMs);
            break;

        case PHASE_REBOUND_SCRAMBLE:
            handleReboundScramble();
            break;

        case PHASE_INBOUND_SETUP:
            handleInboundSetup(frameDelayMs);
            break;
    }
}

/**
 * PHASE: SHOT_QUEUED
 * Shot has been queued, start animation and transition to SHOT_ANIMATING
 */
function handleShotQueued() {
    var phaseData = getPhaseData();

    // Handle dunks differently from jump shots
    if (phaseData.attemptType === "dunk") {
        // For dunks, we need to use animateDunk() which handles its own animation
        // This is a compromise - dunks still use blocking animation for now
        // TODO Wave 22C: Convert animateDunk() to non-blocking
        var player = phaseData.shooter;
        var dunkResult = animateDunk(player, phaseData.dunkInfo, phaseData.targetX, phaseData.targetY, phaseData.made);

        // Update phase data with dunk result
        phaseData.made = dunkResult.made;
        phaseData.blocked = dunkResult.blocked;
        phaseData.dunkStyle = dunkResult.style;
        phaseData.dunkBlocker = dunkResult.blocker;

        // Clear shot in progress
        gameState.shotInProgress = false;

        // Transition based on result
        if (phaseData.made && !phaseData.blocked) {
            var durationMs = 900;
            setPhase(PHASE_SHOT_SCORED, phaseData, durationMs, 16);
        } else {
            setPhase(PHASE_SHOT_MISSED, phaseData, 200, 16);
        }
        return;
    }

    // Jump shots use non-blocking animation system
    if (animationSystem && typeof animationSystem.queueShotAnimation === "function") {
        animationSystem.queueShotAnimation(
            phaseData.shotStartX,
            phaseData.shotStartY,
            phaseData.targetX,
            phaseData.targetY,
            phaseData.made,
            phaseData.blocked || false,
            phaseData.shooter,
            phaseData.animDuration || 800,
            phaseData.reboundBounces || []
        );
    }

    // Mark shot in progress
    gameState.shotInProgress = true;
    gameState.shotStartX = phaseData.shotStartX;
    gameState.shotStartY = phaseData.shotStartY;

    // Immediately transition to SHOT_ANIMATING
    setPhase(PHASE_SHOT_ANIMATING, phaseData, 0);
}

/**
 * PHASE: SHOT_ANIMATING
 * Shot animation is in progress, wait for completion
 */
function handleShotAnimating(frameDelayMs) {
    var phaseData = getPhaseData();

    // Check if animation is complete
    if (!animationSystem || !animationSystem.isBallAnimating()) {
        // Animation finished
        gameState.shotInProgress = false;

        if (phaseData.made && !phaseData.blocked) {
            // Shot made - transition to SHOT_SCORED
            var durationMs = phaseData.attemptType === "dunk" ? 900 : 800;
            setPhase(PHASE_SHOT_SCORED, phaseData, durationMs, frameDelayMs);
        } else {
            // Shot missed - transition to SHOT_MISSED
            setPhase(PHASE_SHOT_MISSED, phaseData, 200, frameDelayMs);
        }
    }
}

/**
 * PHASE: SHOT_SCORED
 * Made basket, display score flash, wait for duration
 */
function handleShotScored(frameDelayMs) {
    var phaseData = getPhaseData();

    // On first frame, handle scoring logic
    if (gameState.phase.frameCounter === 0) {
        var player = phaseData.shooter;
        var playerData = player ? player.playerData : null;

        if (!playerData) {
            // No player data, skip to inbound
            setPhase(PHASE_INBOUND_SETUP, phaseData, 200, frameDelayMs);
            return;
        }

        // Score!
        var points = phaseData.is3Pointer ? 3 : 2;
        gameState.score[gameState.currentTeam] += points;
        gameState.consecutivePoints[gameState.currentTeam]++;
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
            maybeAwardAssist(player);
        }
        if (typeof clearPotentialAssist === "function") {
            clearPotentialAssist();
        }

        var scoringTeamKey = gameState.currentTeam;
        var inboundTeamKey = (scoringTeamKey === "teamA") ? "teamB" : "teamA";

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
                team: gameState.currentTeam,
                style: phaseData.dunkStyle || null
            });
        } else if (phaseData.is3Pointer && typeof announceEvent === "function") {
            announceEvent("three_pointer", {
                playerName: playerData.name,
                player: player,
                team: gameState.currentTeam
            });
        } else if (typeof announceEvent === "function") {
            announceEvent("shot_made", {
                playerName: playerData.name,
                player: player,
                team: gameState.currentTeam
            });
        }

        // Check for "on fire" status
        if (playerData.fireMakeStreak >= 3 && typeof setPlayerOnFire === "function") {
            setPlayerOnFire(player);
            if (typeof announceEvent === "function") {
                announceEvent("on_fire", {
                    playerName: playerData.name,
                    player: player,
                    team: gameState.currentTeam
                });
            }
        }

        // Reset other team's streak
        gameState.consecutivePoints[inboundTeamKey] = 0;
        if (typeof clearTeamOnFire === "function") {
            clearTeamOnFire(inboundTeamKey);
        }

        // Trigger possession beep and score flash
        if (typeof triggerPossessionBeep === "function") {
            triggerPossessionBeep();
        }
        if (typeof startScoreFlash === "function") {
            startScoreFlash(scoringTeamKey, inboundTeamKey);
        }

        // Draw score to show update
        if (typeof drawScore === "function") {
            drawScore();
        }

        // Store inbound team for next phase
        phaseData.inboundTeamKey = inboundTeamKey;
        phaseData.scoringTeamKey = scoringTeamKey;
    }

    // Advance timer
    if (advancePhaseTimer()) {
        // Duration complete, transition to INBOUND_SETUP
        // Ensure scoringTeamKey and inboundTeamKey are preserved in transition
        var transitionData = getPhaseData();  // Get current phase data with all accumulated keys
        setPhase(PHASE_INBOUND_SETUP, transitionData, 200, frameDelayMs);
    }
}

/**
 * PHASE: SHOT_MISSED
 * Missed shot, brief pause, then create rebound
 */
function handleShotMissed(frameDelayMs) {
    var phaseData = getPhaseData();

    // On first frame, handle miss logic
    if (gameState.phase.frameCounter === 0) {
        var player = phaseData.shooter;
        var playerData = player ? player.playerData : null;

        // Reset streak
        if (playerData) {
            gameState.consecutivePoints[gameState.currentTeam] = 0;
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
                });
            } else if (playerData) {
                announceEvent("shot_missed", {
                    playerName: playerData.name,
                    player: player,
                    team: gameState.currentTeam
                });
            }
        } else if (!phaseData.blocked && playerData && typeof announceEvent === "function") {
            announceEvent("shot_missed", {
                playerName: playerData.name,
                player: player,
                team: gameState.currentTeam
            });
        }

        // Clear potential assist if not a blocked dunk
        if (!phaseData.blocked || phaseData.attemptType !== "dunk") {
            if (typeof clearPotentialAssist === "function") {
                clearPotentialAssist();
            }
        }
    }

    // Advance timer
    if (advancePhaseTimer()) {
        // Brief pause complete, create rebound
        var targetX = phaseData.targetX;
        var targetY = phaseData.targetY;

        if (phaseData.attemptType === "dunk" && phaseData.blocked) {
            // Blocked dunk - rebound at basket
            if (typeof createRebound === "function") {
                createRebound(targetX, targetY);
            }
        } else if (phaseData.blocked && typeof gameState.blockDeflectionX === "number") {
            // Blocked shot - create rebound at deflection point
            if (typeof createRebound === "function") {
                createRebound(gameState.blockDeflectionX, gameState.blockDeflectionY);
            }
            gameState.blockDeflectionX = undefined;
            gameState.blockDeflectionY = undefined;
        } else {
            // Normal miss - create rebound at basket
            if (typeof createRebound === "function") {
                createRebound(targetX, targetY);
            }
        }

        // Transition to REBOUND_SCRAMBLE (or back to NORMAL if someone already secured it)
        if (gameState.reboundScramble && gameState.reboundScramble.active) {
            setPhase(PHASE_REBOUND_SCRAMBLE, {}, 0);
        } else {
            // Rebound already secured, return to normal
            resetPhase();
        }
    }
}

/**
 * PHASE: REBOUND_SCRAMBLE
 * Rebound scramble active, wait for someone to secure it
 */
function handleReboundScramble() {
    // Check if rebound scramble is still active
    if (!gameState.reboundScramble || !gameState.reboundScramble.active) {
        // Rebound secured, return to normal gameplay
        resetPhase();
    }

    // Rebound system is already non-blocking, handled by updateReboundScramble()
    // We just need to detect when it's done
}

/**
 * PHASE: INBOUND_SETUP
 * Setting up for inbound after made basket
 */
function handleInboundSetup(frameDelayMs) {
    var phaseData = getPhaseData();

    // On first frame, setup inbound
    if (gameState.phase.frameCounter === 0) {
        // CRITICAL: scoringTeamKey is the team that SCORED
        // setupInbound() expects scoringTeam and switches possession internally
        var scoringTeamKey = phaseData.scoringTeamKey;
        
        // Debug: Log what we're receiving
        if (typeof debugLog === "function") {
            debugLog("[INBOUND] handleInboundSetup - scoringTeamKey: " + scoringTeamKey + 
                     ", inboundTeamKey: " + phaseData.inboundTeamKey + 
                     ", gameState.currentTeam: " + gameState.currentTeam);
        }
        
        // Fallback: if not set, determine from current team
        // (this shouldn't happen, but safety check)
        if (!scoringTeamKey) {
            if (typeof debugLog === "function") {
                debugLog("[INBOUND ERROR] scoringTeamKey not set! Falling back to gameState.currentTeam");
            }
            scoringTeamKey = gameState.currentTeam;
        }
        
        if (typeof setupInbound === "function") {
            setupInbound(scoringTeamKey);
        }
        
        // setupInbound() contains mswait() calls and blocks for ~300-500ms
        // Mark that we've completed the inbound setup
        phaseData.inboundComplete = true;
        
        // Don't advance timer yet - setupInbound is blocking but will return when done
        // Just return to normal gameplay immediately after setupInbound completes
        resetPhase();
        return;
    }

    // This should never be reached since we resetPhase() immediately
    // But keep the timer logic as a safety fallback
    if (advancePhaseTimer()) {
        resetPhase();
    }
}