/**
 * Gameplay constants grouped by subsystem (geometry, scoreboard layout, dunk defaults, etc.)
 * Loaded by lib/utils/constants.js and exposed via global GAMEPLAY_CONSTANTS
 */

var GAMEPLAY_CONSTANTS = {
    COURT: {
        WIDTH: 80,
        HEIGHT: 18,
        BASELINE_TOP: 2,
        BASELINE_BOTTOM_OFFSET: 1,
        BASKET_LEFT_X: 4,
        BASKET_LEFT_Y: 9,
        THREE_POINT_RADIUS: 16,
        KEY_DEPTH: 8
    },
    DUNK: {
        DISTANCE_BASE: 4.2,
        DISTANCE_PER_ATTR: 0.95,
        MIN_DISTANCE: 2.4,
        ARC_HEIGHT_MIN: 2.5,
        ARC_HEIGHT_MAX: 5.5,
        RIM_TARGET_OFFSET_X: 1,
        BALL_SIDE_OFFSET_X: 0,
        BALL_TOP_ROW_OFFSET: 1
    },
    SCOREBOARD: {
        DEFAULT_WIDTH: 80,
        SIDE_MARGIN: 0,
        TURBO_GAP: 0,
        CLOCK_GAP: 1,
        TURBO_BAR_LENGTH: 6,
        ROWS: {
            SHOT_CLOCK: 2,
            TURBO: 2,
            PLAYER: 3,
            CONTROLLER: 4
        }
    },
    JUMP_BALL: {
        CENTER_X: 40,
        CENTER_Y: 9,
        PLAYER_OFFSET_X: 3,
        PLAYER_OFFSET_Y: 0,
        WING_OFFSET_X: 9,
        WING_OFFSET_Y: 4,
        ARC_HEIGHT: 6,
        JUMPER_LIFT: 4
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = GAMEPLAY_CONSTANTS;
}
