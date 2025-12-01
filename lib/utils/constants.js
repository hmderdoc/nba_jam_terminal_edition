// NBA Jam Constants and Configuration
// This module contains all game constants, configuration, and enums

// ============================================================================
// DISPLAY & VISUAL CONFIGURATION
// ============================================================================

load(js.exec_dir + "lib/config/gameplay-constants.js");
load(js.exec_dir + "lib/config/timing-constants.js");
load(js.exec_dir + "lib/config/ai-constants.js");
load(js.exec_dir + "lib/config/mp-constants.js");
load(js.exec_dir + "lib/config/player-constants.js");
load(js.exec_dir + "lib/config/game-mode-constants.js");

var COURT_SCREEN_Y_OFFSET = 1;
var BEEP_DEMO = false;

var ENFORCE_BACKCOURT_VIOLATIONS = true;
if (typeof GAME_MODE_CONSTANTS === "object" && GAME_MODE_CONSTANTS &&
    GAME_MODE_CONSTANTS.RULE_ENFORCEMENT &&
    typeof GAME_MODE_CONSTANTS.RULE_ENFORCEMENT.BACKCOURT_VIOLATIONS_ENABLED === "boolean") {
    ENFORCE_BACKCOURT_VIOLATIONS = GAME_MODE_CONSTANTS.RULE_ENFORCEMENT.BACKCOURT_VIOLATIONS_ENABLED;
}

var RUBBER_BANDING_CONFIG = (typeof GAME_MODE_CONSTANTS === "object" && GAME_MODE_CONSTANTS &&
    typeof GAME_MODE_CONSTANTS.RUBBER_BANDING === "object" && GAME_MODE_CONSTANTS.RUBBER_BANDING)
    ? GAME_MODE_CONSTANTS.RUBBER_BANDING
    : {
        enabled: false,
        showCue: false,
        defaultProfile: null,
        probabilityCaps: {},
        profiles: {}
    };
var RUBBER_BANDING_PROFILES = RUBBER_BANDING_CONFIG.profiles || {};
var RUBBER_BANDING_DEFAULT_PROFILE = RUBBER_BANDING_CONFIG.defaultProfile || null;
var RUBBER_BANDING_PROBABILITY_CAPS = RUBBER_BANDING_CONFIG.probabilityCaps || {};

// Color masks for attribute manipulation
var WAS_BROWN = BG_BLACK;
var FG_MASK = 0x0F;
var BG_MASK = 0x70;

// ============================================================================
// SHOE COLOR CONFIGURATION
// ============================================================================

var ShoeColorConfig = (typeof SHOE_COLOR_CONFIG === "object" && SHOE_COLOR_CONFIG) ? SHOE_COLOR_CONFIG : {
    threshold: 45,
    palettes: [
        { name: "ember", high: LIGHTRED, low: RED },
        { name: "surf", high: LIGHTCYAN, low: CYAN },
        { name: "forest", high: LIGHTGREEN, low: GREEN },
        { name: "solar", high: YELLOW, low: BROWN },
        { name: "amethyst", high: LIGHTMAGENTA, low: MAGENTA },
        { name: "polar", high: WHITE, low: LIGHTGRAY },
        { name: "storm", high: LIGHTBLUE, low: BLUE },
        { name: "charcoal", high: DARKGRAY, low: BLACK }
    ]
};

var SHOE_TURBO_THRESHOLD = (typeof ShoeColorConfig.threshold === "number")
    ? ShoeColorConfig.threshold
    : TIMING_CONSTANTS.TURBO.SHOE_THRESHOLD;
var shoePalettePool = [];

// ============================================================================
// GAME TIMING CONFIGURATION
// ============================================================================

var DEMO_GAME_SECONDS = TIMING_CONSTANTS.DEMO.GAME_SECONDS;
var SINGLEPLAYER_TEMPO = TIMING_CONSTANTS.SINGLEPLAYER_TEMPO;

// ============================================================================
// COURT DIMENSIONS & GEOMETRY
// ============================================================================

var COURT_WIDTH = GAMEPLAY_CONSTANTS.COURT.WIDTH;
var COURT_HEIGHT = GAMEPLAY_CONSTANTS.COURT.HEIGHT;
var BASKET_LEFT_X = GAMEPLAY_CONSTANTS.COURT.BASKET_LEFT_X;
var BASKET_LEFT_Y = GAMEPLAY_CONSTANTS.COURT.BASKET_LEFT_Y;
var BASKET_RIGHT_X = COURT_WIDTH - (BASKET_LEFT_X - 1);
var BASKET_RIGHT_Y = GAMEPLAY_CONSTANTS.COURT.BASKET_LEFT_Y;

// Court midline
var COURT_MID_X = Math.floor(COURT_WIDTH / 2);

// Three-point arc radius
var THREE_POINT_RADIUS = GAMEPLAY_CONSTANTS.COURT.THREE_POINT_RADIUS;
var KEY_DEPTH = GAMEPLAY_CONSTANTS.COURT.KEY_DEPTH;

// ============================================================================
// PLAYER MOVEMENT & SPEED
// ============================================================================

var PLAYER_BASE_SPEED_PER_FRAME = PLAYER_CONSTANTS.SPEED.basePerFrame;   // tiles per frame without turbo (~15 tiles/sec)
var PLAYER_TURBO_SPEED_PER_FRAME = PLAYER_CONSTANTS.SPEED.turboPerFrame;   // tiles per frame with turbo (~22 tiles/sec)
var PLAYER_TURBO_BALL_HANDLER_FACTOR = PLAYER_CONSTANTS.SPEED.turboBallHandlerFactor; // turbo penalty for ball handler
var PLAYER_MIN_SPEED_PER_FRAME = PLAYER_CONSTANTS.SPEED.minPerFrame;
var PLAYER_MAX_SPEED_PER_FRAME = PLAYER_CONSTANTS.SPEED.maxPerFrame;
var PLAYER_ATTR_SPEED_SCALE_FACTOR = PLAYER_CONSTANTS.SPEED.attrScalePerPoint;
var PLAYER_MAX_STEPS_PER_FRAME = PLAYER_CONSTANTS.SPEED.maxStepsPerFrame;
var PLAYER_DIAGONAL_NORMALIZATION_FACTOR = PLAYER_CONSTANTS.SPEED.diagonalNormalizationFactor;
var PLAYER_INPUT_BUFFER_MAX_FLUSH = PLAYER_CONSTANTS.INPUT_BUFFER.maxFlush;

// ============================================================================
// DUNK MECHANICS
// ============================================================================

var DUNK_DISTANCE_BASE = GAMEPLAY_CONSTANTS.DUNK.DISTANCE_BASE;
var DUNK_DISTANCE_PER_ATTR = GAMEPLAY_CONSTANTS.DUNK.DISTANCE_PER_ATTR;
var DUNK_MIN_DISTANCE = GAMEPLAY_CONSTANTS.DUNK.MIN_DISTANCE;
var DUNK_ARC_HEIGHT_MIN = GAMEPLAY_CONSTANTS.DUNK.ARC_HEIGHT_MIN;
var DUNK_ARC_HEIGHT_MAX = GAMEPLAY_CONSTANTS.DUNK.ARC_HEIGHT_MAX;
var DUNK_RIM_TARGET_OFFSET_X = (typeof GAMEPLAY_CONSTANTS.DUNK.RIM_TARGET_OFFSET_X === "number") ? GAMEPLAY_CONSTANTS.DUNK.RIM_TARGET_OFFSET_X : 1;
var DUNK_BALL_SIDE_OFFSET_X = (typeof GAMEPLAY_CONSTANTS.DUNK.BALL_SIDE_OFFSET_X === "number") ? GAMEPLAY_CONSTANTS.DUNK.BALL_SIDE_OFFSET_X : 0;
var DUNK_BALL_TOP_ROW_OFFSET = (typeof GAMEPLAY_CONSTANTS.DUNK.BALL_TOP_ROW_OFFSET === "number") ? GAMEPLAY_CONSTANTS.DUNK.BALL_TOP_ROW_OFFSET : 1;

// Dunk label flash words
var DUNK_LABEL_WORDS = ["SLAM!", "BOOM!", "JAM!", "FLY!", "YEAH!"];

var rawJumpBallLayout = (typeof GAMEPLAY_CONSTANTS.JUMP_BALL === "object" && GAMEPLAY_CONSTANTS.JUMP_BALL) ? GAMEPLAY_CONSTANTS.JUMP_BALL : {};
var JUMP_BALL_LAYOUT = {
    centerX: (typeof rawJumpBallLayout.CENTER_X === "number") ? rawJumpBallLayout.CENTER_X : COURT_MID_X,
    centerY: (typeof rawJumpBallLayout.CENTER_Y === "number") ? rawJumpBallLayout.CENTER_Y : BASKET_LEFT_Y,
    playerOffsetX: (typeof rawJumpBallLayout.PLAYER_OFFSET_X === "number") ? rawJumpBallLayout.PLAYER_OFFSET_X : 3,
    playerOffsetY: (typeof rawJumpBallLayout.PLAYER_OFFSET_Y === "number") ? rawJumpBallLayout.PLAYER_OFFSET_Y : 0,
    wingOffsetX: (typeof rawJumpBallLayout.WING_OFFSET_X === "number") ? rawJumpBallLayout.WING_OFFSET_X : 9,
    wingOffsetY: (typeof rawJumpBallLayout.WING_OFFSET_Y === "number") ? rawJumpBallLayout.WING_OFFSET_Y : 4,
    arcHeight: (typeof rawJumpBallLayout.ARC_HEIGHT === "number") ? rawJumpBallLayout.ARC_HEIGHT : 6,
    jumperLift: (typeof rawJumpBallLayout.JUMPER_LIFT === "number") ? rawJumpBallLayout.JUMPER_LIFT : 4
};

// ============================================================================
// PLAYER ATTRIBUTES (NBA Jam style)
// ============================================================================

var ATTR_SPEED = 0;
var ATTR_3PT = 1;
var ATTR_DUNK = 2;
var ATTR_POWER = 3;
var ATTR_STEAL = 4;
var ATTR_BLOCK = 5;

var rawJumpBallRules = (typeof PLAYER_CONSTANTS.JUMP_BALL === "object" && PLAYER_CONSTANTS.JUMP_BALL) ? PLAYER_CONSTANTS.JUMP_BALL : {};
var JUMP_BALL_RULES = {
    attributeIndex: (typeof rawJumpBallRules.ATTRIBUTE_INDEX === "number") ? rawJumpBallRules.ATTRIBUTE_INDEX : ATTR_BLOCK,
    attributeWeight: (typeof rawJumpBallRules.ATTRIBUTE_WEIGHT === "number") ? rawJumpBallRules.ATTRIBUTE_WEIGHT : 0.6,
    turboWeight: (typeof rawJumpBallRules.TURBO_WEIGHT === "number") ? rawJumpBallRules.TURBO_WEIGHT : 0.3,
    randomWeight: (typeof rawJumpBallRules.RANDOM_WEIGHT === "number") ? rawJumpBallRules.RANDOM_WEIGHT : 0.1,
    randomMin: (typeof rawJumpBallRules.RANDOM_MIN === "number") ? rawJumpBallRules.RANDOM_MIN : 0.1,
    randomMax: (typeof rawJumpBallRules.RANDOM_MAX === "number") ? rawJumpBallRules.RANDOM_MAX : 1.0,
    tiebreakerIncrement: (typeof rawJumpBallRules.TIEBREAKER_INCREMENT === "number") ? rawJumpBallRules.TIEBREAKER_INCREMENT : 1
};

// ============================================================================
// TURBO MECHANICS
// ============================================================================

var MAX_TURBO = TIMING_CONSTANTS.TURBO.MAX;
var TURBO_DRAIN_RATE = TIMING_CONSTANTS.TURBO.DRAIN_RATE;
var TURBO_RECHARGE_RATE = TIMING_CONSTANTS.TURBO.RECHARGE_RATE;
var TURBO_SPEED_MULTIPLIER = TIMING_CONSTANTS.TURBO.SPEED_MULTIPLIER;
if (SHOE_TURBO_THRESHOLD < 0) SHOE_TURBO_THRESHOLD = 0;
if (SHOE_TURBO_THRESHOLD > MAX_TURBO) SHOE_TURBO_THRESHOLD = MAX_TURBO;
var TURBO_ACTIVATION_THRESHOLD = TIMING_CONSTANTS.TURBO.ACTIVATION_THRESHOLD_MS;

// ============================================================================
// SHOVE SYSTEM
// ============================================================================

var SHOVE_FAILURE_STUN = TIMING_CONSTANTS.SHOVE.FAILURE_STUN_FRAMES;

// ============================================================================
// PASSING MECHANICS
// ============================================================================

var PASS_INTERCEPT_LATENCY_MIN = 4;
var PASS_INTERCEPT_LATENCY_MAX = 9;
var PASS_LANE_BASE_TOLERANCE = 3.5;
var PASS_INTERCEPT_MAX_CHANCE = 70;
var PASS_LANE_MIN_CLEARANCE = 3.2;
var PASS_LANE_TRAVEL_WEIGHT = 0.55;
var PASS_LANE_SPACING_WEIGHT = 0.35;
var PASS_LANE_LENGTH_WEIGHT = 0.12;

// Pressure defense penalty - defenders touching ball handler lose interception ability
var TIGHT_DEFENSE_TOUCH_DISTANCE = 1.5; // Sprite touching distance
var TIGHT_DEFENSE_INTERCEPT_PENALTY = 0.85; // 85% reduction in intercept chance when touching

// ============================================================================
// BLOCK ANIMATION
// ============================================================================

var BLOCK_JUMP_DURATION = TIMING_CONSTANTS.BLOCK.JUMP_DURATION_FRAMES;
var BLOCK_JUMP_HEIGHT = TIMING_CONSTANTS.BLOCK.JUMP_HEIGHT;

// ============================================================================
// MULTIPLAYER RECONCILIATION (Wave 24)
// ============================================================================

var DRIFT_SNAP_THRESHOLD = (typeof MP_CONSTANTS === "object" && typeof MP_CONSTANTS.DRIFT_SNAP_THRESHOLD === "number")
    ? MP_CONSTANTS.DRIFT_SNAP_THRESHOLD
    : 15;

// ============================================================================
// GAME CLOCK / RENDER / ANIMATION
// ============================================================================

var GAME_CLOCK_TICK_MS = TIMING_CONSTANTS.CLOCK.SECOND_MS;
var CLOCK_TEST_OVERRIDES = (TIMING_CONSTANTS && TIMING_CONSTANTS.CLOCK && TIMING_CONSTANTS.CLOCK.TEST_OVERRIDES)
    ? TIMING_CONSTANTS.CLOCK.TEST_OVERRIDES
    : null;
var FAST_OVERTIME_TEST_CONFIG = (CLOCK_TEST_OVERRIDES && CLOCK_TEST_OVERRIDES.FAST_OVERTIME)
    ? CLOCK_TEST_OVERRIDES.FAST_OVERTIME
    : null;
var FAST_OVERTIME_TEST_ENABLED = !!(FAST_OVERTIME_TEST_CONFIG && FAST_OVERTIME_TEST_CONFIG.ENABLED === true);
var FAST_OVERTIME_TEST_HAS_TRIGGERED = false;

var OVERTIME_INTRO_CONFIG = (TIMING_CONSTANTS && TIMING_CONSTANTS.CLOCK && TIMING_CONSTANTS.CLOCK.OVERTIME_INTRO)
    ? TIMING_CONSTANTS.CLOCK.OVERTIME_INTRO
    : null;
var OVERTIME_INTRO_DISPLAY_MS = (OVERTIME_INTRO_CONFIG && typeof OVERTIME_INTRO_CONFIG.DISPLAY_MS === "number" && OVERTIME_INTRO_CONFIG.DISPLAY_MS > 0)
    ? OVERTIME_INTRO_CONFIG.DISPLAY_MS
    : 4000;
var OVERTIME_INTRO_COUNTDOWN_SECONDS = (OVERTIME_INTRO_CONFIG && typeof OVERTIME_INTRO_CONFIG.COUNTDOWN_SECONDS === "number" && OVERTIME_INTRO_CONFIG.COUNTDOWN_SECONDS >= 0)
    ? OVERTIME_INTRO_CONFIG.COUNTDOWN_SECONDS
    : 3;

var __regulationSeconds = (TIMING_CONSTANTS && TIMING_CONSTANTS.CLOCK && typeof TIMING_CONSTANTS.CLOCK.REGULATION_SECONDS === "number")
    ? TIMING_CONSTANTS.CLOCK.REGULATION_SECONDS
    : 360;
if (FAST_OVERTIME_TEST_ENABLED && typeof FAST_OVERTIME_TEST_CONFIG.REGULATION_SECONDS === "number" && FAST_OVERTIME_TEST_CONFIG.REGULATION_SECONDS > 0) {
    __regulationSeconds = FAST_OVERTIME_TEST_CONFIG.REGULATION_SECONDS;
}
var REGULATION_PERIOD_SECONDS = __regulationSeconds;
var __rawOvertimeSeconds = (TIMING_CONSTANTS && TIMING_CONSTANTS.CLOCK && typeof TIMING_CONSTANTS.CLOCK.OVERTIME_SECONDS === "number")
    ? TIMING_CONSTANTS.CLOCK.OVERTIME_SECONDS
    : null;
if (typeof __rawOvertimeSeconds !== "number" || __rawOvertimeSeconds <= 0) {
    __rawOvertimeSeconds = Math.max(1, Math.round(REGULATION_PERIOD_SECONDS / 4));
}
var OVERTIME_PERIOD_SECONDS = __rawOvertimeSeconds;
var FAST_OVERTIME_AUTO_TIE_CONFIG = (FAST_OVERTIME_TEST_CONFIG && typeof FAST_OVERTIME_TEST_CONFIG.AUTO_TIE === "object")
    ? FAST_OVERTIME_TEST_CONFIG.AUTO_TIE
    : null;
var FAST_OVERTIME_AUTO_TIE_ENABLED = !!(FAST_OVERTIME_TEST_ENABLED && FAST_OVERTIME_AUTO_TIE_CONFIG && FAST_OVERTIME_AUTO_TIE_CONFIG.ENABLED === true);
var FAST_OVERTIME_AUTO_TIE_SECONDS = (FAST_OVERTIME_AUTO_TIE_ENABLED && typeof FAST_OVERTIME_AUTO_TIE_CONFIG.SECONDS_REMAINING === "number" && FAST_OVERTIME_AUTO_TIE_CONFIG.SECONDS_REMAINING >= 0)
    ? FAST_OVERTIME_AUTO_TIE_CONFIG.SECONDS_REMAINING
    : null;
var FAST_OVERTIME_AUTO_TIE_SCORE = (FAST_OVERTIME_AUTO_TIE_ENABLED && typeof FAST_OVERTIME_AUTO_TIE_CONFIG.SCORE === "number")
    ? FAST_OVERTIME_AUTO_TIE_CONFIG.SCORE
    : null;
var SHOT_CLOCK_DEFAULT = TIMING_CONSTANTS.CLOCK.SHOT_CLOCK_SECONDS;
var SHOT_CLOCK_RESET_PAUSE_MS = TIMING_CONSTANTS.CLOCK.SHOT_CLOCK_RESET_PAUSE_MS;
var COURT_RENDER_THROTTLE_MS = TIMING_CONSTANTS.RENDER.COURT_THROTTLE_MS;
var HUD_RENDER_INTERVAL_MS = (TIMING_CONSTANTS.RENDER.HUD_INTERVAL_MS !== undefined)
    ? TIMING_CONSTANTS.RENDER.HUD_INTERVAL_MS
    : 50;
var INBOUND_SETUP_DURATION_MS = (TIMING_CONSTANTS.INBOUND && typeof TIMING_CONSTANTS.INBOUND.SETUP_DURATION_MS === "number")
    ? TIMING_CONSTANTS.INBOUND.SETUP_DURATION_MS
    : 4000;
var JUMP_BALL_COUNTDOWN_MS = (TIMING_CONSTANTS.JUMP_BALL && typeof TIMING_CONSTANTS.JUMP_BALL.COUNTDOWN_MS === "number")
    ? TIMING_CONSTANTS.JUMP_BALL.COUNTDOWN_MS
    : 800;
var JUMP_BALL_DROP_DURATION_FRAMES = (TIMING_CONSTANTS.JUMP_BALL && typeof TIMING_CONSTANTS.JUMP_BALL.DROP_DURATION_FRAMES === "number")
    ? TIMING_CONSTANTS.JUMP_BALL.DROP_DURATION_FRAMES
    : 24;
var JUMP_BALL_DROP_START_Y = (TIMING_CONSTANTS.JUMP_BALL && typeof TIMING_CONSTANTS.JUMP_BALL.DROP_START_Y === "number")
    ? TIMING_CONSTANTS.JUMP_BALL.DROP_START_Y
    : -4;
var JUMP_BALL_CONTEST_WINDOW_FRAMES = (TIMING_CONSTANTS.JUMP_BALL && typeof TIMING_CONSTANTS.JUMP_BALL.CONTEST_WINDOW_FRAMES === "number")
    ? TIMING_CONSTANTS.JUMP_BALL.CONTEST_WINDOW_FRAMES
    : 6;
var JUMP_BALL_ARC_MIN_DURATION_MS = (TIMING_CONSTANTS.JUMP_BALL && typeof TIMING_CONSTANTS.JUMP_BALL.ARC_MIN_DURATION_MS === "number")
    ? TIMING_CONSTANTS.JUMP_BALL.ARC_MIN_DURATION_MS
    : 400;
var JUMP_BALL_HANDOFF_DURATION_MS = (TIMING_CONSTANTS.JUMP_BALL && typeof TIMING_CONSTANTS.JUMP_BALL.HANDOFF_DURATION_MS === "number")
    ? TIMING_CONSTANTS.JUMP_BALL.HANDOFF_DURATION_MS
    : 400;
var JUMP_BALL_CPU_OFFSET_MAX_RATIO = (TIMING_CONSTANTS.JUMP_BALL && typeof TIMING_CONSTANTS.JUMP_BALL.CPU_OFFSET_MAX_RATIO === "number")
    ? TIMING_CONSTANTS.JUMP_BALL.CPU_OFFSET_MAX_RATIO
    : 0.6;
var JUMP_BALL_CPU_OFFSET_EARLY_RATIO = (TIMING_CONSTANTS.JUMP_BALL && typeof TIMING_CONSTANTS.JUMP_BALL.CPU_OFFSET_EARLY_RATIO === "number")
    ? TIMING_CONSTANTS.JUMP_BALL.CPU_OFFSET_EARLY_RATIO
    : 0.3;
var JUMP_BALL_JUMP_ANIMATION_DURATION_RATIO = (TIMING_CONSTANTS.JUMP_BALL && typeof TIMING_CONSTANTS.JUMP_BALL.JUMP_ANIMATION_DURATION_RATIO === "number")
    ? TIMING_CONSTANTS.JUMP_BALL.JUMP_ANIMATION_DURATION_RATIO
    : 0.6;
var JUMP_BALL_JUMP_ANIMATION_MIN_MS = (TIMING_CONSTANTS.JUMP_BALL && typeof TIMING_CONSTANTS.JUMP_BALL.JUMP_ANIMATION_MIN_MS === "number")
    ? TIMING_CONSTANTS.JUMP_BALL.JUMP_ANIMATION_MIN_MS
    : 350;
var JUMP_BALL_JUMP_ANIMATION_MAX_MS = (TIMING_CONSTANTS.JUMP_BALL && typeof TIMING_CONSTANTS.JUMP_BALL.JUMP_ANIMATION_MAX_MS === "number")
    ? TIMING_CONSTANTS.JUMP_BALL.JUMP_ANIMATION_MAX_MS
    : 700;

var LOOSE_BALL_TIMING = TIMING_CONSTANTS.LOOSE_BALL;
var SAFETY_NET_CONFIG = TIMING_CONSTANTS.SAFETY_NET;
var ANIMATION_TIMING_CONFIG = TIMING_CONSTANTS.ANIMATION;
var SHAKE_TIMING = TIMING_CONSTANTS.SHAKE;
var SHOVE_COOLDOWN_CONFIG = TIMING_CONSTANTS.SHOVE.COOLDOWN_FRAMES;
var STAT_TRAIL_CONFIG = (typeof TIMING_CONSTANTS.STAT_TRAIL === "object" && TIMING_CONSTANTS.STAT_TRAIL) ? TIMING_CONSTANTS.STAT_TRAIL : {
    LIFETIME_FRAMES: 96,
    FADE_FRAMES: 24,
    RISE_PER_FRAME: 0.08,
    HORIZONTAL_DRIFT_PER_FRAME: 0,
    BLINK_INTERVAL_FRAMES: 3,
    ORIGIN_Y_OFFSET: -2,
    MAX_ACTIVE: 4,
    FLASH_FG_COLOR: WHITE,
    SIDELINE_MARGIN: 1,
    BASELINE_MARGIN: 1
};

// ============================================================================ 
// AI DECISION CONSTANTS - Tunable for game balancing
// ============================================================================

var SHOT_PROBABILITY_THRESHOLD = AI_CONSTANTS.SHOT_PROBABILITY_THRESHOLD;
var SHOT_CLOCK_URGENT = AI_CONSTANTS.SHOT_CLOCK_URGENT_SECONDS;
var BACKCOURT_URGENT = AI_CONSTANTS.BACKCOURT_URGENT_SECONDS;
var STEAL_BASE_CHANCE = AI_CONSTANTS.STEAL_BASE_CHANCE;
var DEFENDER_PERIMETER_LIMIT = AI_CONSTANTS.DEFENDER_PERIMETER_LIMIT;
var DEFENDER_TIGHT_RANGE = AI_CONSTANTS.DEFENDER_TIGHT_RANGE;
var DOUBLE_TEAM_RADIUS = AI_CONSTANTS.DOUBLE_TEAM_RADIUS;
var HELP_DEFENSE_RANGE = AI_CONSTANTS.HELP_DEFENSE_RANGE;

// ============================================================================
// COURT SPOTS (WAYPOINTS) - Named positions for AI positioning
// ============================================================================

// Team A attacks right (toward BASKET_RIGHT)
// Team B attacks left (toward BASKET_LEFT)
var COURT_SPOTS = {
    // Team A offensive spots (attacking right/east toward x=74)
    teamA: {
        left_wing: { x: COURT_MID_X + 8, y: 5 },
        right_wing: { x: COURT_MID_X + 8, y: 13 },
        top_key: { x: COURT_MID_X + 12, y: BASKET_LEFT_Y },
        corner_low: { x: BASKET_RIGHT_X - 8, y: 3 },
        corner_high: { x: BASKET_RIGHT_X - 8, y: 15 },
        dunker_low: { x: BASKET_RIGHT_X - 4, y: 6 },
        dunker_high: { x: BASKET_RIGHT_X - 4, y: 12 },
        elbow_low: { x: COURT_MID_X + 16, y: 6 },
        elbow_high: { x: COURT_MID_X + 16, y: 12 },
        backcourt_entry: { x: COURT_MID_X + 3, y: BASKET_LEFT_Y },
        frontcourt_entry: { x: COURT_MID_X + 6, y: BASKET_LEFT_Y }
    },
    // Team B offensive spots (attacking left/west toward x=3)
    teamB: {
        left_wing: { x: COURT_MID_X - 8, y: 5 },
        right_wing: { x: COURT_MID_X - 8, y: 13 },
        top_key: { x: COURT_MID_X - 12, y: BASKET_LEFT_Y },
        corner_low: { x: BASKET_LEFT_X + 8, y: 3 },
        corner_high: { x: BASKET_LEFT_X + 8, y: 15 },
        dunker_low: { x: BASKET_LEFT_X + 4, y: 6 },
        dunker_high: { x: BASKET_LEFT_X + 4, y: 12 },
        elbow_low: { x: COURT_MID_X - 16, y: 6 },
        elbow_high: { x: COURT_MID_X - 16, y: 12 },
        backcourt_entry: { x: COURT_MID_X - 3, y: BASKET_LEFT_Y },
        frontcourt_entry: { x: COURT_MID_X - 6, y: BASKET_LEFT_Y }
    }
};

// ============================================================================
// AI STATES (Finite State Machine)
// ============================================================================

var AI_STATE = {
    OFFENSE_BALL: "OffenseBall",       // I have the ball
    OFFENSE_NO_BALL: "OffenseNoBall",  // My teammate has the ball
    DEFENSE_ON_BALL: "DefenseOnBall",  // Guarding ball handler
    DEFENSE_HELP: "DefenseHelp",       // Help defense
    REBOUND: "Rebound"                 // Going for rebound
};

// ============================================================================
// RENDERING CONSTANTS
// ============================================================================

var PLAYER_LABEL_WIDTH = 5;

// ============================================================================
// GLOBAL STATE (initialized elsewhere but declared here)
// ============================================================================

if (typeof gameState === "undefined") {
    gameState = {};
}
if (typeof mpCoordinator === "undefined") {
    mpCoordinator = null;
} // Multiplayer coordinator (if in multiplayer mode)
if (typeof multiplayerEnabled === "undefined") {
    multiplayerEnabled = false;
}

// MULTIPLAYER: Throttled sync state
var mpSyncState = {
    lastTurboBroadcast: {},  // playerId -> last turbo value broadcast
    lastCooldownBroadcast: 0, // last frame we broadcast cooldowns
    lastDeadDribbleBroadcast: 0 // last frame we broadcast dead dribble timer
};

// ============================================================================
// UTILITY FUNCTION: getSinglePlayerTempo()
// ============================================================================

function getSinglePlayerTempo() {
    var tempo = (typeof SINGLEPLAYER_TEMPO === "object" && SINGLEPLAYER_TEMPO) ? SINGLEPLAYER_TEMPO : {};
    var frameDelay = (typeof tempo.frameDelayMs === "number" && tempo.frameDelayMs > 0) ? tempo.frameDelayMs : 20;
    var aiInterval = (typeof tempo.aiIntervalMs === "number" && tempo.aiIntervalMs > 0) ? tempo.aiIntervalMs : 200;
    return {
        frameDelayMs: frameDelay,
        aiIntervalMs: aiInterval
    };
}
