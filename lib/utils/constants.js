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

// Dunk label flash words
var DUNK_LABEL_WORDS = ["SLAM!", "BOOM!", "JAM!", "FLY!", "YEAH!"];

// ============================================================================
// PLAYER ATTRIBUTES (NBA Jam style)
// ============================================================================

var ATTR_SPEED = 0;
var ATTR_3PT = 1;
var ATTR_DUNK = 2;
var ATTR_POWER = 3;
var ATTR_STEAL = 4;
var ATTR_BLOCK = 5;

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
// GAME CLOCK / RENDER / ANIMATION
// ============================================================================

var GAME_CLOCK_TICK_MS = TIMING_CONSTANTS.CLOCK.SECOND_MS;
var SHOT_CLOCK_DEFAULT = TIMING_CONSTANTS.CLOCK.SHOT_CLOCK_SECONDS;
var SHOT_CLOCK_RESET_PAUSE_MS = TIMING_CONSTANTS.CLOCK.SHOT_CLOCK_RESET_PAUSE_MS;
var COURT_RENDER_THROTTLE_MS = TIMING_CONSTANTS.RENDER.COURT_THROTTLE_MS;
var HUD_RENDER_INTERVAL_MS = (TIMING_CONSTANTS.RENDER.HUD_INTERVAL_MS !== undefined)
    ? TIMING_CONSTANTS.RENDER.HUD_INTERVAL_MS
    : 50;

var LOOSE_BALL_TIMING = TIMING_CONSTANTS.LOOSE_BALL;
var ANIMATION_TIMING_CONFIG = TIMING_CONSTANTS.ANIMATION;
var SHAKE_TIMING = TIMING_CONSTANTS.SHAKE;
var SHOVE_COOLDOWN_CONFIG = TIMING_CONSTANTS.SHOVE.COOLDOWN_FRAMES;

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
