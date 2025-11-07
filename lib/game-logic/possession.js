/**
 * NBA JAM - Possession System Module
 * 
 * Handles all possession management including:
 * - Inbound plays after scoring
 * - Possession changes (turnovers, etc.)
 * - Second half inbound setup
 * - Defensive matchup assignments
 * - Possession beep audio cues
 * 
 * Dependencies:
 * - Game state (gameState with currentTeam, ballCarrier, inbounding, shotClock, etc.)
 * - Player sprites (redPlayer1/2, bluePlayer1/2)
 * - Court utilities (clampToCourtX, clampToCourtY, COURT_WIDTH, COURT_HEIGHT)
 * - Game flow (resetBackcourtState, flushKeyboardBuffer, announceEvent, triggerPossessionBeep)
 * - Passing (animatePass for inbound pass)
 * - AI (primeInboundOffense, resetAllDefenseMomentum)
 * - Assist tracking (clearPotentialAssist)
 * - Player utilities (getAllPlayers)
 * - Dead dribble (resetDeadDribbleTimer)
 * - Audio (console.beep, canPlayPossessionBeep)
 * - Score flash (enableScoreFlashRegainCheck)
 * - Constants (BASKET_LEFT_X, BASKET_LEFT_Y, BASKET_RIGHT_X)
 */

/**
 * Setup inbound play after a made basket
 * 
 * Flow:
 * 1. Team that got scored ON inbounds the ball
 * 2. Inbounders alternate between players
 * 3. Position inbounder at midcourt baseline (backcourt)
 * 4. Position receiver further into backcourt
 * 5. Position defenders at frontcourt
 * 6. Auto-pass after 300ms delay
 * 7. Inbounder steps onto court
 * 8. Prime offense, reset timers, assign matchups
 */
function setupInbound(scoringTeam) {
    // Flush keyboard buffer to prevent buffered commands from previous possession
    flushKeyboardBuffer();

    // After a made basket, set up inbound play with alternating inbounders
    gameState.reboundActive = false;
    gameState.inbounding = true;

    // The team that got scored ON inbounds the ball
    var inboundTeam = scoringTeam === "red" ? "blue" : "red";
    gameState.currentTeam = inboundTeam;

    if (!gameState.inboundAlternateIndex) {
        gameState.inboundAlternateIndex = { red: 0, blue: 0 };
    }

    var teamSprites = inboundTeam === "red" ? [redPlayer1, redPlayer2] : [bluePlayer1, bluePlayer2];
    var defenderSprites = inboundTeam === "red" ? [bluePlayer1, bluePlayer2] : [redPlayer1, redPlayer2];

    var inboundIndex = gameState.inboundAlternateIndex[inboundTeam];
    if (inboundIndex !== 0 && inboundIndex !== 1) inboundIndex = 0;

    var inbounder = teamSprites[inboundIndex] || teamSprites[0];
    var receiverIndex;
    if (teamSprites.length > 1) {
        receiverIndex = (inbounder === teamSprites[0]) ? 1 : 0;
    } else {
        receiverIndex = 0;
    }
    var receiver = teamSprites[receiverIndex] || inbounder;

    var attackDir = inboundTeam === "red" ? 1 : -1;
    var midX = Math.floor(COURT_WIDTH / 2);
    var inboundHalfOffset = 5; // Increased from 3 to 5 to prevent over-and-back on inbound
    var inboundX = clampToCourtX(midX - attackDir * inboundHalfOffset);
    var inboundY = BASKET_LEFT_Y;

    if (inbounder && inbounder.moveTo) inbounder.moveTo(inboundX, inboundY);

    // Position receiver in backcourt (not at defensive basket which would be frontcourt)
    var receiverX = clampToCourtX(midX - attackDir * 8); // Further into backcourt than inbounder
    var receiverY = BASKET_LEFT_Y + 3; // Offset vertically from inbounder
    if (receiver && receiver.moveTo) receiver.moveTo(receiverX, receiverY);

    var defenderBaseX = clampToCourtX(midX + attackDir * 6);
    if (defenderSprites[0] && defenderSprites[0].moveTo) defenderSprites[0].moveTo(defenderBaseX, 7);
    if (defenderSprites[1] && defenderSprites[1].moveTo) defenderSprites[1].moveTo(clampToCourtX(defenderBaseX + attackDir * 4), 11);

    gameState.inboundPasser = inbounder;
    gameState.ballCarrier = inbounder;
    if (inbounder && inbounder.playerData) inbounder.playerData.hasDribble = true;

    resetBackcourtState();
    gameState.ballHandlerStuckTimer = 0;
    gameState.ballHandlerAdvanceTimer = 0;
    if (inbounder) {
        gameState.ballHandlerLastX = inbounder.x;
        gameState.ballHandlerLastY = inbounder.y;
        gameState.ballHandlerFrontcourtStartX = inbounder.x;
        gameState.ballHandlerProgressOwner = inbounder;
    }

    // Toggle inbounder for next possession
    if (teamSprites.length > 1) {
        gameState.inboundAlternateIndex[inboundTeam] = (inbounder === teamSprites[0]) ? 1 : 0;
    } else {
        gameState.inboundAlternateIndex[inboundTeam] = 0;
    }

    // Auto-pass after a brief delay (simulate inbound)
    mswait(300);

    var inboundPasserSprite = gameState.inboundPasser;
    var receiverSprite = receiver;

    if (inboundPasserSprite && receiverSprite && inboundPasserSprite !== receiverSprite) {
        animatePass(inboundPasserSprite, receiverSprite);
    }

    // Inbounder steps onto the court after the pass
    var inbounderPostX = clampToCourtX(midX - attackDir * 6);
    if (inbounder && inbounder.moveTo) inbounder.moveTo(inbounderPostX, inboundY);

    // Make sure possession is set to the receiver after inbound
    if (!gameState.ballCarrier || gameState.ballCarrier === inboundPasserSprite) {
        gameState.ballCarrier = receiverSprite;
    }

    if (inbounder && inbounder.playerData) inbounder.playerData.hasDribble = true;
    if (gameState.ballCarrier && gameState.ballCarrier.playerData) gameState.ballCarrier.playerData.hasDribble = true;

    var teammateAfterInbound = inbounder;
    primeInboundOffense(gameState.ballCarrier, teammateAfterInbound, inboundTeam);

    // Reset ball-handler tracking so the AI doesn't think it's stuck
    gameState.ballHandlerStuckTimer = 0;
    gameState.ballHandlerAdvanceTimer = 0;
    if (gameState.ballCarrier) {
        gameState.ballHandlerLastX = gameState.ballCarrier.x;
        gameState.ballHandlerLastY = gameState.ballCarrier.y;
        gameState.ballHandlerFrontcourtStartX = gameState.ballCarrier.x;
        gameState.ballHandlerProgressOwner = gameState.ballCarrier;
    }

    // Clear inbound state
    gameState.inbounding = false;
    gameState.inboundPasser = null;
    gameState.shotClock = 24; // Reset shot clock after inbound
    // Ensure frontcourt is reset (defense against multiplayer sync issues)
    gameState.frontcourtEstablished = false;
    // Add grace period to prevent immediate over-and-back after inbound
    gameState.inboundGracePeriod = 30; // ~1.5 seconds at 20 FPS

    enableScoreFlashRegainCheck(inboundTeam);

    // Assign defensive matchups after inbound
    assignDefensiveMatchups();

    announceEvent("inbounds", {
        team: inboundTeam
    });
}

/**
 * Assign defensive matchups based on proximity
 * Uses distance calculation to determine which defender guards which offensive player
 * 
 * Stores assignments in gameState.defensiveAssignments:
 * - Key: defender sprite key (e.g., "bluePlayer1")
 * - Value: offensive player sprite to guard
 */
function assignDefensiveMatchups() {
    // Assign man-to-man defensive matchups based on proximity
    gameState.defensiveAssignments = {};
    resetAllDefenseMomentum();

    if (gameState.currentTeam === "red") {
        // Red has ball, blue defends
        // Assign blue defenders to red offensive players
        var dist1to1 = Math.sqrt(Math.pow(bluePlayer1.x - redPlayer1.x, 2) + Math.pow(bluePlayer1.y - redPlayer1.y, 2));
        var dist1to2 = Math.sqrt(Math.pow(bluePlayer1.x - redPlayer2.x, 2) + Math.pow(bluePlayer1.y - redPlayer2.y, 2));

        if (dist1to1 < dist1to2) {
            // Blue1 guards Red1, Blue2 guards Red2
            gameState.defensiveAssignments.bluePlayer1 = redPlayer1;
            gameState.defensiveAssignments.bluePlayer2 = redPlayer2;
        } else {
            // Blue1 guards Red2, Blue2 guards Red1
            gameState.defensiveAssignments.bluePlayer1 = redPlayer2;
            gameState.defensiveAssignments.bluePlayer2 = redPlayer1;
        }
    } else {
        // Blue has ball, red defends
        // Assign red defenders to blue offensive players
        var dist1to1 = Math.sqrt(Math.pow(redPlayer1.x - bluePlayer1.x, 2) + Math.pow(redPlayer1.y - bluePlayer1.y, 2));
        var dist1to2 = Math.sqrt(Math.pow(redPlayer1.x - bluePlayer2.x, 2) + Math.pow(redPlayer1.y - bluePlayer2.y, 2));

        if (dist1to1 < dist1to2) {
            // Red1 guards Blue1, Red2 guards Blue2
            gameState.defensiveAssignments.redPlayer1 = bluePlayer1;
            gameState.defensiveAssignments.redPlayer2 = bluePlayer2;
        } else {
            // Red1 guards Blue2, Red2 guards Blue1
            gameState.defensiveAssignments.redPlayer1 = bluePlayer2;
            gameState.defensiveAssignments.redPlayer2 = bluePlayer1;
        }
    }
}

/**
 * Switch possession to opposing team
 * Used for turnovers, violations, etc.
 * 
 * Flow:
 * 1. Clear rebound state, reset shot clock
 * 2. Reset shake flags for all players
 * 3. Award ball to opposing team
 * 4. Position players in backcourt
 * 5. Prime offense, trigger possession beep
 * 6. Assign defensive matchups
 */
function switchPossession() {
    // Flush keyboard buffer to prevent buffered commands from wrong possession phase
    flushKeyboardBuffer();

    // Clear rebound state when possession changes
    gameState.reboundActive = false;
    gameState.shotClock = 24; // Reset shot clock on possession change
    resetBackcourtState();
    gameState.ballHandlerStuckTimer = 0;
    gameState.ballHandlerAdvanceTimer = 0;
    clearPotentialAssist();
    resetDeadDribbleTimer();

    // Reset shake flags for all players when possession changes
    var allPlayers = getAllPlayers();
    if (allPlayers) {
        for (var i = 0; i < allPlayers.length; i++) {
            if (allPlayers[i] && allPlayers[i].playerData) {
                allPlayers[i].playerData.shakeUsedThisPossession = false;
            }
        }
    }

    if (gameState.currentTeam === "red") {
        gameState.currentTeam = "blue";
        gameState.ballCarrier = bluePlayer1;
        bluePlayer1.moveTo(58, 9);
        bluePlayer2.moveTo(58, 12);
        primeInboundOffense(gameState.ballCarrier, bluePlayer2, "blue");
    } else {
        gameState.currentTeam = "red";
        gameState.ballCarrier = redPlayer1;
        redPlayer1.moveTo(18, 9);
        redPlayer2.moveTo(18, 12);
        primeInboundOffense(gameState.ballCarrier, redPlayer2, "red");
    }

    triggerPossessionBeep();

    if (gameState.ballCarrier) {
        gameState.ballHandlerLastX = gameState.ballCarrier.x;
        gameState.ballHandlerLastY = gameState.ballCarrier.y;
        gameState.ballHandlerFrontcourtStartX = gameState.ballCarrier.x;
        gameState.ballHandlerProgressOwner = gameState.ballCarrier;
        if (gameState.ballCarrier.playerData) gameState.ballCarrier.playerData.hasDribble = true;
    }

    // Assign defensive matchups
    assignDefensiveMatchups();
}

/**
 * Start second half inbound
 * Team that did NOT start first half gets the ball
 * Uses setupInbound to handle positioning
 */
function startSecondHalfInbound() {
    if (gameState.secondHalfInitDone) return;
    var startTeam = gameState.firstHalfStartTeam || "red";
    var inboundTeam = startTeam === "red" ? "blue" : "red";
    var scoringTeam = inboundTeam === "red" ? "blue" : "red";
    setupInbound(scoringTeam);
    gameState.secondHalfInitDone = true;
    gameState.pendingSecondHalfInbound = false;
}

/**
 * Check if possession beep can play
 * Requires: console.beep available, gameState.beepEnabled not false
 */
function canPlayPossessionBeep() {
    if (typeof console === "undefined" || typeof console.beep !== "function") return false;
    if (!gameState || gameState.beepEnabled === false) return false;
    return true;
}

/**
 * Trigger possession beep audio cue
 * Plays beep sound to indicate possession change
 */
function triggerPossessionBeep() {
    if (!canPlayPossessionBeep()) return;
    try {
        console.beep();
    } catch (beepErr) { }
}

/**
 * Toggle possession beep on/off
 * Updates gameState.beepEnabled flag
 */
function togglePossessionBeep() {
    if (!gameState) return;
    gameState.beepEnabled = !gameState.beepEnabled;
    if (typeof announce === "function") {
        announce(gameState.beepEnabled ? "Audio cues ON" : "Audio cues OFF", YELLOW);
    }
}
