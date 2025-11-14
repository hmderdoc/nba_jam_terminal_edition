/**
 * AI behaviour tuning constants.
 * Loaded by lib/utils/constants.js and exposed via AI_CONSTANTS.
 */

var AI_CONSTANTS = {
    SHOT_PROBABILITY_THRESHOLD: 40,
    SHOT_CLOCK_URGENT_SECONDS: 3,
    BACKCOURT_URGENT_SECONDS: 8,
    STEAL_BASE_CHANCE: 0.18,
    DEFENDER_PERIMETER_LIMIT: 22,
    DEFENDER_TIGHT_RANGE: 18,
    DOUBLE_TEAM_RADIUS: 8,
    HELP_DEFENSE_RANGE: 15,
    OFFENSE_BALL: {
        DECISION: {
            QUICK_WINDOW_MS: 200,
            PASS_BASE: 0.5,
            PASS_DISTANCE_THRESHOLD: 25,
            PASS_DISTANCE_BONUS: 0.2,
            TEAMMATE_DISTANCE_MARGIN: 5,
            TEAMMATE_DISTANCE_BONUS: 0.3,
            OPEN_BONUS: 0.2,
            TIGHT_BONUS: 0.2,
            MIN_PASS_QUALITY: 0.45,
            PASS_CHANCE_WHEN_DEAD: 0.60
        },
        BACKCOURT: {
            STUCK_TICKS: 2,
            JUKE_OFFSET: 4,
            TURBO_THRESHOLD: 25,
            SAFE_DEFENDER_DISTANCE: 3,
            BASE_SPEED: 3,
            TURBO_SPEED: 5
        },
        QUICK_THREE: {
            PERIMETER_MIN: 17,
            PERIMETER_MAX: 22,
            EARLY_ADVANCE_TICKS: 1,
            SETTLED_STUCK_TICKS: 1,
            SETTLE_TURBO_COOLDOWN_MS: 350,
            TRANSITION_TURBO_MS: 1200,
            SPECIALIST_SPACING: 3,
            DEFAULT_SPACING: 4.5,
            SPECIALIST_CLOCK_BUFFER: 4,
            DEFAULT_CLOCK_BUFFER: 2,
            SPECIALIST_QUALITY_DELTA: 7,
            DEFAULT_QUALITY_DELTA: 3,
            DISTANCE_PENALTY_START: 20,
            DISTANCE_PENALTY_SCALE: 4,
            SPECIALIST_TRANSITION_PENALTY: 4,
            DEFAULT_TRANSITION_PENALTY: 12
        },
        DRIVE: {
            HIGH_SKILL_DUNK_THRESHOLD: 7,
            HIGH_SKILL_TURBO_THRESHOLD: 20,
            DEFAULT_TURBO_THRESHOLD: 30,
            ALREADY_CLOSE_DISTANCE: 12,
            FINISH_DISTANCE: 6,
            DEFENDER_BUFFER: 4,
            BASE_SPEED: 3,
            TURBO_SPEED: 5
        },
        HIGH_FLYER: {
            MIN_DUNK_SKILL: 8,
            MAX_DISTANCE: 12,
            MAX_DEFENDER_DISTANCE: 6,
            GATHER_DISTANCE: 6.2,
            GATHER_OFFSET_X: 5,
            GATHER_OFFSET_Y: 2,
            TURBO_THRESHOLD: 5,
            TURBO_SPEED: 5.4,
            BASE_SPEED: 3.8,
            TURBO_COST_FACTOR: 0.9
        },
        ESCAPE_PRESSURE: {
            CONTACT_DISTANCE: 1.9,
            ESCAPE_MULTIPLIER: 1.4,
            TURBO_THRESHOLD: 5,
            BASE_SPEED: 2.4,
            TURBO_SPEED: 3.8,
            TURBO_COST_FACTOR: 0.6
        },
        PRESS_BREAK: {
            DEFENDER_DISTANCE_MAX: 4,
            DEFENDER_ADVANTAGE_DELTA: 2,
            BURST_X_OFFSET: 8,
            BURST_Y_OFFSET: 2,
            TURBO_THRESHOLD: 5,
            BASE_SPEED: 3.2,
            TURBO_SPEED: 5,
            TURBO_COST_FACTOR: 0.75
        },
        POWER_RIM: {
            MIN_DUNK_SKILL: 7,
            DISTANCE_MAX: 6,
            DEFENDER_DISTANCE_MAX: 5
        },
        PULL_UP: {
            RANGE_SPECIALIST: 12,
            RANGE_DEFAULT: 14,
            MIN_DEFENDER_DISTANCE: 5
        },
        DEAD_DRIBBLE: {
            FRAME_DURATION_MS: 16,
            STANDOFF_FRAMES: 15,
            CLOSE_DEFENDER_DISTANCE: 3,
            SHAKE_CHANCE_STANDOFF: 0.85,
            SHAKE_CHANCE_DEFAULT: 0.60,
            SHOVE_CHANCE_STANDOFF: 0.75,
            SHOVE_CHANCE_DEFAULT: 0.50,
            SHOOTER_BONUS_DELTA: 10
        },
        EXPLOIT_SHOVE: {
            FRESH_COOLDOWN_FRAMES: 20,
            DRIVE_DISTANCE_MAX: 15,
            DRIVE_DUNK_SKILL_MIN: 6,
            FINISH_DISTANCE: 6,
            PULLUP_THREE_SKILL_MIN: 6,
            PULLUP_DISTANCE_MIN: 12,
            ATTACK_SPEED_BASE: 3,
            ATTACK_SPEED_TURBO: 4.5,
            ATTACK_TURBO_THRESHOLD: 10,
            ATTACK_TURBO_COST_FACTOR: 0.7
        }
    },
    OFFENSE_OFF_BALL: {
        EXPLOIT_SHOVE: {
            cooldownFrames: 20,
            baseSpeed: 3,
            turboSpeed: 5,
            turboThreshold: 15,
            turboCostFactor: 0.8,
            passDistanceMax: 20,
            passDistanceMargin: 5
        },
        FRONTCOURT: {
            targetTolerance: 3,
            baseSpeed: 2,
            turboSpeed: 4,
            turboThreshold: 25,
            defenderBuffer: 4,
            turboCostFactor: 0.5
        },
        PASSING_LANE: {
            nearSpeed: 2,
            farSpeed: 3,
            turboThreshold: 12,
            clearanceThreshold: 4,
            turboCostIncrement: 1,
            turboCostFactor: 0.5
        },
        MOMENTUM_CUT: {
            turboThreshold: 10,
            baseSpeed: 3,
            turboSpeed: 4,
            turboCostFactor: 0.5
        },
        BACKDOOR: {
            defenderExtraDistance: 2,
            cutSpeed: 3
        },
        ACTIVE_CUT: {
            wobbleFrames: 20,
            vCutDistanceToBall: 15,
            vCutDefenderDistance: 6,
            basketCutDistanceMin: 10,
            basketCutDefenderDistance: 8,
            wingOffsetX: 12,
            wingOffsetY: 8,
            baseSpeed: 3,
            turboThreshold: 20,
            turboSpeed: 4.5,
            turboCostFactor: 0.6
        },
        SPACING: {
            baseSpeed: 2
        },
        PASS_LANE_SHOVE: {
            baseChance: 0.35,
            clearanceThreshold: 6,
            maxDefenderDistance: 4.0,
            laneBias: 5,
            distanceBias: 4
        }
    },
    DEFENSE_ON_BALL: {
        containDistance: 3,
        containJitter: 2,
        containSpeed: 2.5,
        stealDistance: 1.7,
        stealBaseChance: 0.45,
        stealAttrFactor: 0.035,
        shovePreference: 0.65,
        retreatStep: 2,
        powerThreshold: 7,
        settleSpeedHigh: 2.2,
        settleSpeedLow: 1.6
    },
    DEFENSE_HELP: {
        paintOffsetX: 10,
        paintJitter: 2,
        ballCloseDistance: 15,
        paintSpeedActive: 2.5,
        paintSpeedDead: 1.8,
        responseBase: 0.22,
        responseAttrFactor: 0.03,
        dribbleDeadResponseScale: 0.7,
        denyReactionDelayBase: 0.3,
        denyReactionDelayRange: 0.2,
        denyPositionErrorBase: 2,
        denyPositionErrorRange: 3,
        denyResponseBase: 0.15,
        denyResponseAttrFactor: 0.02,
        denyDribbleDeadScale: 0.6,
        denySpeedActive: 2,
        denySpeedDead: 1.6,
        fallbackResponseActive: 0.2,
        fallbackResponseDead: 0.12,
        fallbackSpeedActive: 2,
        fallbackSpeedDead: 1.5
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = AI_CONSTANTS;
}
