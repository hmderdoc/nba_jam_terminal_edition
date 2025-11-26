// NBA Jam Game State Management
// State initialization and reset functions

// ============================================================================
// GAME PHASE CONSTANTS (Wave 22B State Machine)
// ============================================================================

var PHASE_NORMAL = "NORMAL";              // Normal gameplay
var PHASE_SHOT_QUEUED = "SHOT_QUEUED";    // Shot queued, about to animate
var PHASE_SHOT_ANIMATING = "SHOT_ANIMATING";  // Shot animation in progress
var PHASE_SHOT_SCORED = "SHOT_SCORED";    // Made basket, score flash
var PHASE_SHOT_MISSED = "SHOT_MISSED";    // Missed shot, brief pause
var PHASE_REBOUND_SCRAMBLE = "REBOUND_SCRAMBLE";  // Rebound scramble active
var PHASE_INBOUND_SETUP = "INBOUND_SETUP";  // Setting up inbound play
var PHASE_JUMP_BALL = "JUMP_BALL";          // Opening tipoff sequence
var PHASE_OVERTIME_INTRO = "OVERTIME_INTRO"; // Overtime transition banner

// ============================================================================
// STATE MANAGEMENT GUIDELINES
// ============================================================================
/**
 * This file defines the central gameState object, which serves as the
 * authoritative state for the entire game. In multiplayer, the coordinator
 * maintains the authoritative state and broadcasts updates to clients.
 * 
 * STATE CATEGORIES:
 * 
 * 1. CRITICAL GAME STATE (synchronized in multiplayer):
 *    - gameRunning, timeRemaining, currentHalf, shotClock
 *    - ballCarrier, ballX, ballY, currentTeam
 *    - score, consecutivePoints, onFire
 *    - reboundActive, reboundScramble, inbounding
 *    - These must be consistent across all players
 * 
 * 2. LOOP-LOCAL STATE (coordinator-only, not synchronized):
 *    - ballHandlerStuckTimer, ballHandlerAdvanceTimer
 *    - backcourtTimer, inboundGracePeriod
 *    - ballHandlerDeadSince, ballHandlerDeadFrames
 *    - These drive rule enforcement and only exist on coordinator
 * 
 * 3. PRESENTATION STATE (client-side, not synchronized):
 *    - announcer.text, announcer.timer, announcer.color
 *    - scoreFlash (visual effect only)
 *    - Clients can display different announcements independently
 * 
 * 4. AUXILIARY STATE (derived or cached):
 *    - frontcourtEstablished (computed from player positions)
 *    - defensiveAssignments (rebuilt during possession changes)
 *    - lastKeyTime, lastKey (input handling)
 * 
 * MULTIPLAYER CONSIDERATIONS:
 * - Coordinator advances authoritative timers (timeRemaining, shotClock)
 * - Clients receive state snapshots and render accordingly
 * - Input is sent to coordinator for validation before applying
 * - Violation checks (5-sec, backcourt, shot clock) run coordinator-only
 * - Event system broadcasts important state changes (scores, violations)
 * 
 * MODIFICATION RULES:
 * - Critical game state: Only modify after validation
 * - Loop-local state: Safe to modify on coordinator for rule checks
 * - Presentation state: Safe to modify locally for visual feedback
 * - When adding new state, document which category it belongs to
 */

// ============================================================================
// GAME STATE CREATION
// ============================================================================

function createDefaultGameState() {
    if (typeof FAST_OVERTIME_TEST_HAS_TRIGGERED !== "undefined") {
        FAST_OVERTIME_TEST_HAS_TRIGGERED = false;
    }
    var regulationSeconds = (typeof REGULATION_PERIOD_SECONDS === "number" && REGULATION_PERIOD_SECONDS > 0)
        ? REGULATION_PERIOD_SECONDS
        : 360;
    var overtimeSeconds = (typeof OVERTIME_PERIOD_SECONDS === "number" && OVERTIME_PERIOD_SECONDS > 0)
        ? OVERTIME_PERIOD_SECONDS
        : Math.max(1, Math.round(regulationSeconds / 4));

    return {
        gameRunning: false,
        ballCarrier: null,  // Who has the ball
        score: { teamA: 0, teamB: 0 },
        consecutivePoints: { teamA: 0, teamB: 0 },
        onFire: { teamA: false, teamB: false },
        regulationPeriodSeconds: regulationSeconds,
        overtimePeriodSeconds: overtimeSeconds,
        timeRemaining: regulationSeconds, // default regulation length
        totalGameTime: regulationSeconds,
        currentHalf: 1,     // Track which half we're in (1 or 2)
        isHalftime: false,  // Flag for halftime state
        shotClock: (typeof SHOT_CLOCK_DEFAULT === "number" ? SHOT_CLOCK_DEFAULT : 24),  // Shot clock duration
        currentTeam: "teamA",
        ballX: 0,
        ballY: 0,
        reboundActive: false,
        reboundX: 0,
        reboundY: 0,
        reboundScramble: {
            active: false,
            startTime: 0,
            maxDuration: 2000,  // 2 seconds for normal resolution
            reboundX: 0,
            reboundY: 0,
            bounceAnimComplete: false,
            anticipating: false,  // True when shot is in air, players move toward expected rebound
            anticipatedX: 0,      // Expected rebound position
            anticipatedY: 0
        },
        inbounding: false,  // True when setting up after a made basket
        inboundPasser: null,  // Player passing the ball in
        teamNames: { teamA: "TEAM A", teamB: "TEAM B" },  // Actual team names from rosters
        teamAbbrs: { teamA: "TEMA", teamB: "TEMB" },
        teamColors: {
            teamA: {
                fg: WHITE,
                bg: BG_BLACK,
                fg_accent: WHITE,
                bg_alt: BG_BLACK,
                fg_code: "\1h\1w",
                fg_accent_code: "\1h\1w"
            },
            teamB: {
                fg: WHITE,
                bg: BG_BLACK,
                fg_accent: WHITE,
                bg_alt: BG_BLACK,
                fg_code: "\1h\1w",
                fg_accent_code: "\1h\1w"
            }
        },
        announcer: {
            text: "",
            color: WHITE,
            timer: 0
        },
        lastKeyTime: 0,
        lastKey: "",
        // 5-second violation tracking
        ballHandlerStuckTimer: 0,
        ballHandlerLastX: 0,
        ballHandlerLastY: 0,
        ballHandlerAdvanceTimer: 0,
        ballHandlerFrontcourtStartX: 0,
        ballHandlerProgressOwner: null,
        inboundAlternateIndex: { teamA: 0, teamB: 0 },
        backcourtTimer: 0,
        frontcourtEstablished: false,
        inboundGracePeriod: 0,  // Frames to suppress backcourt checks after inbound
        // Defensive assignments (man-to-man)
        defensiveAssignments: {
            // Maps defender to offensive player they're guarding
            // Will be set during switchPossession/setupInbound
        },
        // Block tracking
        activeBlock: null,  // Player currently attempting a block
        blockJumpTimer: 0,  // Frames remaining in jump animation
        activeBlockDuration: 0,
        lastBlocker: null,  // Player who last blocked/contested the shot
        shotInProgress: false,  // True during shot animation
        shotStartX: 0,
        shotStartY: 0,
        potentialAssist: null,
        // Player roster tracking for substitutions
        availablePlayers: {
            teamA: [], // Array of all available player indices for team A
            teamB: [] // Array of all available player indices for team B
        },
        activePlayerIndices: {
            teamA: [0, 1], // Currently active player indices
            teamB: [0, 1]
        },
        ballHandlerDeadSince: null,
        ballHandlerDeadFrames: 0,
        ballHandlerDeadForcedShot: false,
        tickCounter: 0,
        jumpBallTiebreakerSeed: 0,

        // === LOOP TIMING STATE (for testability and multiplayer sync) ===
        // Moved from local variables in gameLoop() to gameState (Bug #25)
        lastUpdateTime: 0,      // Last frame update timestamp
        lastSecondTime: 0,      // Last second countdown timestamp
        lastAIUpdateTime: 0,    // Last AI update timestamp
        courtNeedsRedraw: true, // Wave 23D: Dirty flag for court rendering (trails fix)

        allCPUMode: false,
        firstHalfStartTeam: null,
        secondHalfInitDone: false,
        pendingSecondHalfInbound: false,
        isOvertime: false,
        currentOvertimePeriod: 0,
        overtimeCount: 0,
        overtimeNextPossessionTeam: null,
        regulationOvertimeAnchorTeam: null,
        overtimeIntroActive: false,
        overtimeIntroEndsAt: 0,
        overtimeIntroRemainingSeconds: 0,
        pendingOvertimeInboundTeam: null,
        pendingOvertimeInboundContext: null,
        scoreFlash: {
            active: false,
            activeTeam: null,
            stopTeam: null,
            startedTick: 0,
            regainCheckEnabled: false
        },
        jumpBallPhase: {
            status: "idle",
            startTime: 0,
            countdownIndex: -1,
            humanJumpAt: null,
            cpuJumpAt: null,
            scheduledJumps: {
                teamA: null,
                teamB: null
            },
            winnerTeam: null
        },
        beepEnabled: true,
        quitMenuOpen: false,  // Non-blocking quit confirmation (prevents multiplayer desync)

        // === WAVE 22B: STATE MACHINE FOR NON-BLOCKING ANIMATIONS ===
        phase: {
            current: PHASE_NORMAL,      // Current game phase
            data: {},                    // Phase-specific data
            frameCounter: 0,             // Frames elapsed in current phase
            targetFrames: 0              // Target frames for phase duration
        }
    };
}

// ============================================================================
// GAME STATE RESET
// ============================================================================

function resetGameState(options, systems) {
    var stateManager = systems.stateManager;
    var gameState = stateManager.get();
    var existingState = (typeof gameState !== "undefined" && gameState) ? gameState : null;
    var prevTeams = existingState && existingState.teamNames ? existingState.teamNames : {};
    var prevColors = existingState && existingState.teamColors ? existingState.teamColors : {};
    var prevCPU = existingState && typeof existingState.allCPUMode === "boolean" ? existingState.allCPUMode : false;

    // Create new default state and replace State Manager's internal state
    var newState = createDefaultGameState();

    // CRITICAL: Copy all properties from newState to existing gameState
    // This preserves the State Manager's reference while resetting values
    var keys = Object.keys(newState);
    for (var i = 0; i < keys.length; i++) {
        gameState[keys[i]] = newState[keys[i]];
    }

    // Delete any keys that were in old state but not in new state
    var oldKeys = Object.keys(gameState);
    for (var j = 0; j < oldKeys.length; j++) {
        if (!newState.hasOwnProperty(oldKeys[j])) {
            delete gameState[oldKeys[j]];
        }
    }

    if (typeof animationSystem !== "undefined" && animationSystem && animationSystem.animations) {
        animationSystem.animations = [];
    }

    if (options && options.teamNames) {
        stateManager.set("teamNames", JSON.parse(JSON.stringify(options.teamNames)), "game_reset");
    } else if (prevTeams.teamA || prevTeams.teamB) {
        stateManager.set("teamNames", JSON.parse(JSON.stringify(prevTeams)), "game_reset");
    }

    if (options && options.teamColors) {
        stateManager.set("teamColors", JSON.parse(JSON.stringify(options.teamColors)), "game_reset");
    } else if (prevColors.teamA || prevColors.teamB) {
        stateManager.set("teamColors", JSON.parse(JSON.stringify(prevColors)), "game_reset");
    }

    var allCPUMode = (options && typeof options.allCPUMode === "boolean")
        ? options.allCPUMode
        : prevCPU;
    stateManager.set("allCPUMode", allCPUMode, "game_reset");

    stateManager.set("ballHandlerDeadForcedShot", false, "game_reset");

    stateManager.set("beepEnabled", allCPUMode ? !!BEEP_DEMO : true, "game_reset");

    // Wave 22B: Reset phase to NORMAL
    if (systems && systems.statTrailSystem && typeof systems.statTrailSystem.reset === "function") {
        systems.statTrailSystem.reset();
    }
    resetPhase(systems);
}

if (typeof gameState === "undefined" || !gameState) {
    gameState = createDefaultGameState();
}

// ============================================================================
// WAVE 22B: STATE MACHINE HELPERS
// ============================================================================

/**
 * Set the current game phase and initialize phase data
 * @param {string} phase - Phase constant (PHASE_NORMAL, PHASE_SHOT_QUEUED, etc.)
 * @param {object} data - Phase-specific data
 * @param {number} durationMs - Duration in milliseconds (converted to frames)
 * @param {number} frameDelayMs - Frame delay in ms (default 16ms for ~60fps)
 */
function setPhase(phase, data, durationMs, frameDelayMs, systems) {
    var stateManager = systems.stateManager;
    var phaseObj = stateManager.get('phase');

    if (!phaseObj) {
        stateManager.set("phase", {
            current: PHASE_NORMAL,
            data: {},
            frameCounter: 0,
            targetFrames: 0
        }, "phase_init");
        phaseObj = stateManager.get('phase');
    }

    phaseObj.current = phase;
    phaseObj.name = phase;
    phaseObj.data = data || {};
    phaseObj.frameCounter = 0;

    // Convert milliseconds to frames using a FIXED frame rate (20 FPS = 50ms per frame)
    // This ensures consistent timing regardless of actual frame delay variations
    var FIXED_FRAME_MS = 50; // 20 FPS standard
    if (typeof durationMs === "number" && durationMs > 0) {
        phaseObj.targetFrames = Math.max(1, Math.round(durationMs / FIXED_FRAME_MS));
    } else {
        phaseObj.targetFrames = 0;
    }

    if (typeof debugLog === "function") {
        debugLog("[SET_PHASE] phase=" + phase + ", durationMs=" + durationMs +
            ", targetFrames=" + phaseObj.targetFrames +
            ", frameCounter=" + phaseObj.frameCounter);
    }
}

/**
 * Get the current game phase
 * @returns {string} Current phase constant
 */
function getPhase(systems) {
    var stateManager = systems.stateManager;
    var phaseObj = stateManager.get('phase');
    if (!phaseObj) return PHASE_NORMAL;
    return phaseObj.current;
}

/**
 * Get phase-specific data
 * @returns {object} Phase data object
 */
function getPhaseData(systems) {
    var stateManager = systems.stateManager;
    var phaseObj = stateManager.get('phase');
    if (!phaseObj) return {};
    return phaseObj.data || {};
}

/**
 * Advance the phase timer by one frame
 * @returns {boolean} True if target frames reached (phase should transition)
 */
function advancePhaseTimer(systems) {
    var stateManager = systems.stateManager;
    var phaseObj = stateManager.get('phase');
    if (!phaseObj) {
        debugLog("[PHASE_TIMER] WARN: advancePhaseTimer called with no phase object. Returning true.");
        return true;
    }

    phaseObj.frameCounter++;

    // If targetFrames is 0, phase transitions immediately after first frame.
    if (phaseObj.targetFrames === 0) {
        debugLog("[PHASE_TIMER] phase=" + phaseObj.current + ", targetFrames=0, returning true.");
        return true;
    }

    var isComplete = phaseObj.frameCounter >= phaseObj.targetFrames;

    // Log verbosely on key frames for easier debugging
    if (phaseObj.frameCounter === 1 || isComplete || phaseObj.frameCounter % 10 === 0) {
        debugLog("[PHASE_TIMER] phase=" + phaseObj.current +
            ", frameCounter=" + phaseObj.frameCounter +
            "/" + phaseObj.targetFrames +
            ", complete=" + isComplete);
    }

    return isComplete;
}

/**
 * Check if phase timer has reached target
 * @returns {boolean} True if target frames reached
 */
function isPhaseComplete(systems) {
    var stateManager = systems.stateManager;
    var phaseObj = stateManager.get('phase');
    if (!phaseObj) return true;
    if (phaseObj.targetFrames === 0) return true;
    return phaseObj.frameCounter >= phaseObj.targetFrames;
}

/**
 * Reset phase to NORMAL
 * @param {Object} systems - Systems object (stateManager, eventBus, etc.)
 */
function resetPhase(systems) {
    setPhase(PHASE_NORMAL, {}, 0, null, systems);
}
