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
        REGULATION_SECONDS: 360,
        OVERTIME_SECONDS: 90,
        SHOT_CLOCK_SECONDS: 24,
        SHOT_CLOCK_RESET_PAUSE_MS: 1000,
        TEST_OVERRIDES: {
            FAST_OVERTIME: {
                ENABLED: false,
                REGULATION_SECONDS: 60,
                AUTO_TIE: {
                    ENABLED: false,
                    SECONDS_REMAINING: 10,
                    SCORE: 60
                }
            }
        }
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
    },
    INBOUND: {
        SETUP_DURATION_MS: 4000
    },
    JUMP_BALL: {
        COUNTDOWN_MS: 800,
        DROP_DURATION_FRAMES: 24,
        DROP_START_Y: -4,
        CONTEST_WINDOW_FRAMES: 6,
        ARC_MIN_DURATION_MS: 400,
        HANDOFF_DURATION_MS: 400,
        CPU_OFFSET_MAX_RATIO: 0.6,
        CPU_OFFSET_EARLY_RATIO: 0.3,
        JUMP_ANIMATION_DURATION_RATIO: 0.6,
        JUMP_ANIMATION_MIN_MS: 350,
        JUMP_ANIMATION_MAX_MS: 700
    },
    STAT_TRAIL: {
        LIFETIME_FRAMES: 96,
        FADE_FRAMES: 24,
        RISE_PER_FRAME: 0.08,
        RISE_SLOW_PER_FRAME: 0.045,
        RISE_FAST_PER_FRAME: 0.11,
        RISE_ACCELERATION_EXP: 2.4,
        HORIZONTAL_DRIFT_PER_FRAME: 0,
        BLINK_INTERVAL_FRAMES: 3,
        ORIGIN_Y_OFFSET: -2,
        MAX_ACTIVE: 4,
        FLASH_FG_COLOR: WHITE,
        FINAL_FG_COLOR: DARKGRAY,
        FINAL_FADE_FRAMES: 8,
        SIDELINE_MARGIN: 1,
        BASELINE_MARGIN: 1,
        STAT_TYPE_COLORS: {
            "default": LIGHTCYAN,
            points: LIGHTCYAN,
            rebounds: LIGHTGREEN,
            assists: CYAN,
            steals: LIGHTMAGENTA,
            blocks: LIGHTMAGENTA,
            turnovers: LIGHTRED,
            dunks: YELLOW,
            jams:YELLOW
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = TIMING_CONSTANTS;
}
