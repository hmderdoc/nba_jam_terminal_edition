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
 * - Player sprites (teamAPlayer1/2, teamBPlayer1/2)
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
/**
 * Setup inbound play after a made basket
 * @param {string} scoringTeam - Team that scored (NOT the inbounding team)
 */
function setupInbound(scoringTeam, systems) {
    var stateManager = systems.stateManager;
    var possessionSystem = systems.possessionSystem;

    // Flush keyboard (UI concern)
    flushKeyboardBuffer();

    // Reset timers (UI/input concerns)
    resetBackcourtState(systems);
    stateManager.set("ballHandlerStuckTimer", 0, "inbound_setup");
    stateManager.set("ballHandlerAdvanceTimer", 0, "inbound_setup");

    // Let system handle possession logic (now stores positioning data, doesn't move yet)
    possessionSystem.setupInbound(scoringTeam, "score", systems);

    // Calculate defender positions (will animate in handleInboundSetup)
    var inboundTeam = scoringTeam === "teamA" ? "teamB" : "teamA";
    var attackDir = inboundTeam === "teamA" ? 1 : -1;
    var midX = Math.floor(COURT_WIDTH / 2);
    var defenderSprites = inboundTeam === "teamA" ? [teamBPlayer1, teamBPlayer2] : [teamAPlayer1, teamAPlayer2];

    // Wave 23D: Position defenders back at their 3-point line area (defensive positioning)
    // They should be protecting their own basket, not pressing at midcourt
    var defensiveOffset = 15; // Back in their own half, around 3-point line
    var defenderBaseX = clampToCourtX(midX + attackDir * defensiveOffset);

    // Store defender positioning for animation
    var positioning = stateManager.get("inboundPositioning") || {};
    var midY = Math.floor(COURT_HEIGHT / 2);
    positioning.defenders = [
        { sprite: defenderSprites[0], targetX: defenderBaseX, targetY: midY - 3, startX: defenderSprites[0] ? defenderSprites[0].x : defenderBaseX, startY: defenderSprites[0] ? defenderSprites[0].y : midY - 3 },
        { sprite: defenderSprites[1], targetX: clampToCourtX(defenderBaseX + attackDir * 4), targetY: midY + 3, startX: defenderSprites[1] ? defenderSprites[1].x : clampToCourtX(defenderBaseX + attackDir * 4), startY: defenderSprites[1] ? defenderSprites[1].y : midY + 3 }
    ];
    stateManager.set("inboundPositioning", positioning, "inbound_defenders");

    // Store inbound pass data for handleInboundSetup to trigger after positioning
    var inbounder = stateManager.get('inboundPasser');
    var inboundTeamPlayers = inboundTeam === "teamA" ? [teamAPlayer1, teamAPlayer2] : [teamBPlayer1, teamBPlayer2];
    var receiver = null;
    for (var i = 0; i < inboundTeamPlayers.length; i++) {
        if (inboundTeamPlayers[i] !== inbounder) {
            receiver = inboundTeamPlayers[i];
            break;
        }
    }
    if (!receiver) receiver = inboundTeamPlayers[0];

    if (inbounder && receiver && inbounder !== receiver) {
        // Wave 23D: Position inbounder in backcourt, deep near baseline
        var backcourtOffset = 30;
        var inboundX = clampToCourtX(midX - attackDir * backcourtOffset);
        // Wave 23D: Inbounder is positioned OFF-COURT at Y=-2
        var inboundY = -2;
        var inbounderPostX = clampToCourtX(midX - attackDir * 30); // Match actual position
        var inboundPassData = {
            inbounder: inbounder,
            inbounderX: inbounderPostX,
            inbounderY: inboundY,  // Off-court position for visual clarity
            receiver: receiver,
            team: inboundTeam
        };
        stateManager.set("inboundPassData", inboundPassData, "inbound_pass_queued");
    }
}

/**
 * Assign defensive matchups based on proximity
 * @param {Object} systems - Systems object
 */
function assignDefensiveMatchups(systems) {
    var possessionSystem = systems.possessionSystem;

    possessionSystem.assignDefensiveMatchups(systems);

    // Reset momentum (AI concern, may move to AI module)
    resetAllDefenseMomentum();
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
/**
 * Switch possession to the other team
 * @param {Object} systems - Systems object
 */
function switchPossession(systems) {
    var stateManager = systems.stateManager;
    var possessionSystem = systems.possessionSystem;

    // Flush keyboard and reset timers (UI/input concerns)
    flushKeyboardBuffer();
    resetBackcourtState(systems);
    stateManager.set("ballHandlerStuckTimer", 0, "possession_switched");
    stateManager.set("ballHandlerAdvanceTimer", 0, "possession_switched");
    clearPotentialAssist(systems);
    resetDeadDribbleTimer(systems);

    // Let system handle possession logic
    possessionSystem.switchPossession("legacy_call");

    // Trigger audio cue (UI concern)
    triggerPossessionBeep(systems);

    // Prime AI offense (AI concern, but needs ballCarrier set first)
    var ballCarrier = stateManager.get('ballCarrier');
    var currentTeam = stateManager.get('currentTeam');
    if (ballCarrier) {
        var teammate = currentTeam === "teamA" ? teamAPlayer2 : teamBPlayer2;
        primeInboundOffense(ballCarrier, teammate, currentTeam, systems);
    }
}

/**
 * Start second half inbound
 * Team that did NOT start first half gets the ball
 * Uses setupInbound to handle positioning
 */
function startSecondHalfInbound(systems) {
    var stateManager = systems.stateManager;
    var secondHalfInitDone = stateManager.get('secondHalfInitDone');

    if (secondHalfInitDone) return;
    var startTeam = stateManager.get('firstHalfStartTeam') || "teamA";
    var inboundTeam = startTeam === "teamA" ? "teamB" : "teamA";
    var scoringTeam = inboundTeam === "teamA" ? "teamB" : "teamA";
    setupInbound(scoringTeam, systems);
    stateManager.set("secondHalfInitDone", true, "second_half_start");
    stateManager.set("pendingSecondHalfInbound", false, "second_half_start");
}

/**
 * Check if possession beep can play
 * Requires: console.beep available, stateManager.get('beepEnabled') not false
 */
function canPlayPossessionBeep(systems) {
    var stateManager = systems.stateManager;
    if (typeof console === "undefined" || typeof console.beep !== "function") return false;
    var beepEnabled = stateManager.get('beepEnabled');
    if (beepEnabled === false) return false;
    return true;
}

/**
 * Trigger possession beep audio cue
 * Plays beep sound to indicate possession change
 */
function triggerPossessionBeep(systems) {
    if (!canPlayPossessionBeep(systems)) return;
    try {
        console.beep();
    } catch (beepErr) { }
}

/**
 * Toggle possession beep on/off
 * Updates stateManager beepEnabled flag
 */
function togglePossessionBeep(systems) {
    var stateManager = systems.stateManager;
    var beepEnabled = stateManager.get('beepEnabled');
    var newValue = !beepEnabled;
    stateManager.set("beepEnabled", newValue, "toggle_beep");
    if (typeof announce === "function") {
        announce(newValue ? "Audio cues ON" : "Audio cues OFF", YELLOW, systems);
    }
}
