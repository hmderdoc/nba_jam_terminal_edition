// NBA Jam Game State Management
// State initialization and reset functions

// ============================================================================
// GAME STATE CREATION
// ============================================================================

function createDefaultGameState() {
    return {
        gameRunning: false,
        ballCarrier: null,  // Who has the ball
        score: { teamA: 0, teamB: 0 },
        consecutivePoints: { teamA: 0, teamB: 0 },
        onFire: { teamA: false, teamB: false },
        timeRemaining: 360, // 6 minutes total for two halves (3 minutes per half)
        totalGameTime: 360, // 6 minutes total (3 minutes per half)
        currentHalf: 1,     // Track which half we're in (1 or 2)
        isHalftime: false,  // Flag for halftime state
        shotClock: 24,  // 24-second shot clock
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
        allCPUMode: false,
        firstHalfStartTeam: null,
        secondHalfInitDone: false,
        pendingSecondHalfInbound: false,
        scoreFlash: {
            active: false,
            activeTeam: null,
            stopTeam: null,
            startedTick: 0,
            regainCheckEnabled: false
        },
        beepEnabled: true
    };
}

// ============================================================================
// GAME STATE RESET
// ============================================================================

function resetGameState(options) {
    var existingState = (typeof gameState !== "undefined" && gameState) ? gameState : null;
    var prevTeams = existingState && existingState.teamNames ? existingState.teamNames : {};
    var prevColors = existingState && existingState.teamColors ? existingState.teamColors : {};
    var prevCPU = existingState && typeof existingState.allCPUMode === "boolean" ? existingState.allCPUMode : false;

    gameState = createDefaultGameState();

    if (typeof animationSystem !== "undefined" && animationSystem && animationSystem.animations) {
        animationSystem.animations = [];
    }

    if (options && options.teamNames) {
        gameState.teamNames = JSON.parse(JSON.stringify(options.teamNames));
    } else if (prevTeams.teamA || prevTeams.teamB) {
        gameState.teamNames = JSON.parse(JSON.stringify(prevTeams));
    }

    if (options && options.teamColors) {
        gameState.teamColors = JSON.parse(JSON.stringify(options.teamColors));
    } else if (prevColors.teamA || prevColors.teamB) {
        gameState.teamColors = JSON.parse(JSON.stringify(prevColors));
    }

    gameState.allCPUMode = (options && typeof options.allCPUMode === "boolean")
        ? options.allCPUMode
        : prevCPU;

    gameState.ballHandlerDeadForcedShot = false;

    gameState.beepEnabled = gameState.allCPUMode ? !!BEEP_DEMO : true;
}

if (typeof gameState === "undefined" || !gameState) {
    gameState = createDefaultGameState();
}
