/**
 * Timing / tempo / turbo constants grouped for easier tuning.
 * Loaded by lib/utils/constants.js and exposed via TIMING_CONSTANTS.
 */

var TIMING_CONSTANTS = {
    DEMO: {
        GAME_SECONDS: 240
    },
    SINGLEPLAYER_TEMPO: {
        frameDelayMs: 7,
        aiIntervalMs: 70
    },
    TURBO: {
        MAX: 150,
        DRAIN_RATE: 2,
        RECHARGE_RATE: 5,
        SPEED_MULTIPLIER: 3,
        ACTIVATION_THRESHOLD_MS: 200,
        SHOE_THRESHOLD: 45
    },
    SHOVE: {
        FAILURE_STUN_FRAMES: 10,
        COOLDOWN_FRAMES: {
            offBall: 20,
            onBall: 35
        }
    },
    BLOCK: {
        JUMP_DURATION_FRAMES: 12,
        JUMP_HEIGHT: 4
    },
    SHAKE: {
        COOLDOWN_FRAMES: 25,
        deadDribbleGraceMs: 2000,
        knockdown: {
            baseFrames: 32,
            randomAdditionalFrames: 18
        }
    },
    CLOCK: {
        SECOND_MS: 1000,
        SHOT_CLOCK_SECONDS: 24,
        SHOT_CLOCK_RESET_PAUSE_MS: 1000
    },
    RENDER: {
        COURT_THROTTLE_MS: 60,
        HUD_INTERVAL_MS: 50
    },
    LOOSE_BALL: {
        horizontalTiles: 6,
        verticalTiles: 3,
        arcSteps: 8,
        arcHeight: 2
    },
    ANIMATION: {
        SHOT: {
            MIN_STEPS: 15,
            DISTANCE_STEP_MULTIPLIER: 1.5,
            BASE_DURATION_MS: 800,
            MIN_MS_PER_STEP: 32,
            OVERRIDE_MIN_MS_PER_STEP: 16
        },
        PASS: {
            MIN_STEPS: 10,
            DISTANCE_STEP_MULTIPLIER: 0.8,
            BASE_DURATION_MS: 300,
            DISTANCE_TIME_FACTOR_MS: 10,
            MIN_MS_PER_STEP: 30,
            OVERRIDE_MIN_MS_PER_STEP: 12
        },
        REBOUND: {
            STEPS_PER_BOUNCE: 6,
            MS_PER_STEP: 40,
            IDLE_MS_PER_STEP: 50,
            IDLE_MAX_STEPS: 8
        },
        DUNK: {
            DEFAULT_FRAME_MS: 30
        },
        GENERIC: {
            FALLBACK_MS_PER_STEP: 50,
            DEBUG_LOG_INTERVAL_MS: 500
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = TIMING_CONSTANTS;
}
