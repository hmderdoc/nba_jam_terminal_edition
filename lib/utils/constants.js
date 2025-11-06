// NBA Jam Constants and Configuration
// This module contains all game constants, configuration, and enums

// ============================================================================
// DISPLAY & VISUAL CONFIGURATION
// ============================================================================

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

var SHOE_TURBO_THRESHOLD = (typeof ShoeColorConfig.threshold === "number") ? ShoeColorConfig.threshold : 45;
var shoePalettePool = [];

// ============================================================================
// GAME TIMING CONFIGURATION
// ============================================================================

var DEMO_GAME_SECONDS = 240;

// Speed tuning for local (single-player + CPU demo) games only
// Multiplayer retains its own frame pacing to stay in sync across nodes.
var SINGLEPLAYER_TEMPO = {
    frameDelayMs: 7,    // Further speed boost for local play (~3x faster than original 20ms)
    aiIntervalMs: 70    // Keep AI decisions responsive to match the tempo
};

// ============================================================================
// COURT DIMENSIONS & GEOMETRY
// ============================================================================

var COURT_WIDTH = 80;
var COURT_HEIGHT = 18;
var BASKET_LEFT_X = 4;   // Rim center (left basket)
var BASKET_LEFT_Y = 9;
var BASKET_RIGHT_X = COURT_WIDTH - (BASKET_LEFT_X - 1); // Rim center (right basket)
var BASKET_RIGHT_Y = 9;

// Court midline
var COURT_MID_X = Math.floor(COURT_WIDTH / 2);

// Three-point arc radius
var THREE_POINT_RADIUS = 16;
var KEY_DEPTH = 8;

// ============================================================================
// PLAYER MOVEMENT & SPEED
// ============================================================================

var PLAYER_BASE_SPEED_PER_FRAME = 0.75;   // tiles per frame without turbo (~15 tiles/sec)
var PLAYER_TURBO_SPEED_PER_FRAME = 1.1;   // tiles per frame with turbo (~22 tiles/sec)
var PLAYER_TURBO_BALL_HANDLER_FACTOR = 0.85; // turbo penalty for ball handler
var PLAYER_MAX_SPEED_PER_FRAME = 1.2;

// ============================================================================
// DUNK MECHANICS
// ============================================================================

var DUNK_DISTANCE_BASE = 4.2;
var DUNK_DISTANCE_PER_ATTR = 0.95;
var DUNK_MIN_DISTANCE = 2.4;
var DUNK_ARC_HEIGHT_MIN = 2.5;
var DUNK_ARC_HEIGHT_MAX = 5.5;

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

var MAX_TURBO = 150;  // Increased by 50% from 100
var TURBO_DRAIN_RATE = 2;
var TURBO_RECHARGE_RATE = 5; // Faster recharge to keep local pacing snappy
var TURBO_SPEED_MULTIPLIER = 3;
if (SHOE_TURBO_THRESHOLD < 0) SHOE_TURBO_THRESHOLD = 0;
if (SHOE_TURBO_THRESHOLD > MAX_TURBO) SHOE_TURBO_THRESHOLD = MAX_TURBO;
var TURBO_ACTIVATION_THRESHOLD = 200; // ms between same key presses

// ============================================================================
// SHOVE SYSTEM
// ============================================================================

var SHOVE_FAILURE_STUN = 10; // Frames attacker can't move after failed shove (tunable)

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

var BLOCK_JUMP_DURATION = 12;
var BLOCK_JUMP_HEIGHT = 4;

// ============================================================================
// AI DECISION CONSTANTS - Tunable for game balancing
// ============================================================================

var SHOT_PROBABILITY_THRESHOLD = 40; // Percent - AI shoots if probability > this
var SHOT_CLOCK_URGENT = 3; // Seconds - force shot when clock this low
var BACKCOURT_URGENT = 8; // Seconds - urgency increases at this time
var STEAL_BASE_CHANCE = 0.18; // Base chance for steal attempt per frame
var DEFENDER_PERIMETER_LIMIT = 22; // Don't guard farther than this from basket
var DEFENDER_TIGHT_RANGE = 18; // Guard tightly inside this range
var DOUBLE_TEAM_RADIUS = 8; // Trigger double team when offensive player this close to both defenders
var HELP_DEFENSE_RANGE = 15; // Help defend when ball carrier within this range

// ============================================================================
// COURT SPOTS (WAYPOINTS) - Named positions for AI positioning
// ============================================================================

// Red team attacks right (toward BASKET_RIGHT)
// Blue team attacks left (toward BASKET_LEFT)
var COURT_SPOTS = {
    // Red offensive spots (attacking right/east toward x=74)
    red: {
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
    // Blue offensive spots (attacking left/west toward x=3)
    blue: {
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

var gameState = {};
var mpCoordinator = null; // Multiplayer coordinator (if in multiplayer mode)

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
