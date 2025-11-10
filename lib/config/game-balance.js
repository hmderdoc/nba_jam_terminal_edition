/**
 * NBA JAM - Game Balance Configuration
 * 
 * Centralized configuration for all game balance values.
 * Extracted in Wave 21 to replace magic numbers throughout codebase.
 * 
 * All values here can be tuned to adjust difficulty, AI behavior,
 * physics, and game feel without hunting through code.
 */

var GAME_BALANCE = {

    // ====================
    // AI DECISION MAKING
    // ====================
    AI: {
        // Offense - Ball Handler
        PASS_ON_HELP_COLLAPSE_PROB: 0.7,        // Probability to pass when help defense collapses
        PASS_CLOSE_TO_BASKET_PROB: 0.75,        // Pass when teammate near basket
        PASS_OPEN_TEAMMATE_PROB: 0.65,          // Pass to open teammate
        SHOOT_AFTER_SHAKE_PROB: 0.7,            // Shoot after successful shake move

        // Offense - Off Ball
        CUT_TO_BASKET_PROB: 0.6,                // Cut to basket when ball carrier has it
        SPONTANEOUS_CUT_PROB: 0.15,             // Random cut when defender far away

        // Distance Thresholds
        WIDE_OPEN_DISTANCE: 6,                  // Defender distance for "wide open"
        REASONABLY_OPEN_DISTANCE: 3.5,          // Defender distance for "reasonably open"
        CLOSE_DEFENDER_DISTANCE: 2.5,           // Defender very close

        // Passing Distance Thresholds
        MAX_CLOSE_PASS_DISTANCE: 30,            // Max distance for close pass
        MAX_NORMAL_PASS_DISTANCE: 35,           // Max distance for normal pass
        TEAMMATE_TO_BASKET_DISTANCE: 20,        // Teammate distance to basket for pass
        OPEN_TEAMMATE_DISTANCE: 2.5,            // Min distance between teammate and defender

        // Shot Decision
        DRIVE_DISTANCE_THRESHOLD: 8,            // Distance to basket for drive
        DRIVE_DEFENDER_DISTANCE: 2.5,           // Defender distance needed for drive
    },

    // ====================
    // SHOOTING & SCORING
    // ====================
    SHOOTING: {
        // Defense Pressure Modifiers
        VERY_TIGHT_DEFENSE_DISTANCE: 2,         // Defender < 2 units
        TIGHT_DEFENSE_DISTANCE: 4,              // Defender < 4 units
        MODERATE_DEFENSE_DISTANCE: 6,           // Defender < 6 units

        // Block Mechanics
        BLOCK_ATTEMPT_DISTANCE: 9.5,            // Max distance for block attempt
        BLOCK_CLOSE_BONUS_DISTANCE: 5,          // Distance for bonus block frames
        BLOCK_SUCCESS_DISTANCE: 4,              // Max distance for successful block

        // Rim Checks
        RIM_BONUS_DISTANCE: 8.5,                // Distance for rim bonus probability
        RIM_BONUS_PROBABILITY: 0.5,             // Chance of rim bonus

        // Shot Quality Distance Thresholds
        EXCELLENT_SHOT_DISTANCE: 10,            // Distance for excellent shot quality
        GOOD_DEFENSE_DISTANCE: 8,               // Distance for good defense modifier
    },

    // ====================
    // DUNKS
    // ====================
    DUNKS: {
        // Dunk Distance Thresholds
        CLOSE_DUNK_DISTANCE: 3.5,               // Very close to basket for dunk bonus
        BLOCK_DUNK_DISTANCE: 4,                 // Max distance for dunk block

        // Dunk Turbo Threshold
        TURBO_DUNK_THRESHOLD: 4,                // Min turbo for turbo dunk (50% chance)

        // Dunk Quality
        EXCELLENT_DUNK_DISTANCE: 10,            // Distance for excellent dunk
        GOOD_DUNK_DEFENSE: 8,                   // Distance for good defense on dunk

        // Rebound Bounces
        DUNK_REBOUND_BOUNCE_PROB: 0.5,          // Probability of 1 vs 2 bounces
    },

    // ====================
    // REBOUNDS
    // ====================
    REBOUNDS: {
        // Scramble Mechanics
        SECURE_REBOUND_DISTANCE: 4,             // Max distance to secure rebound
        SHOVE_DISTANCE_THRESHOLD: 2.5,          // Max distance for rebound shove
        SHOVE_RANGE_MAX: 8,                     // Max range to consider rebound shoving

        // Bounce Physics
        BOUNCE_PROBABILITY: 0.5,                // 50% chance of 1 vs 2 bounces

        // Timeouts
        HARD_TIMEOUT_MS: 3000,                  // Hard timeout for rebound resolution
    },

    // ====================
    // DEFENSE
    // ====================
    DEFENSE: {
        // Steal Mechanics
        STEAL_MAX_DISTANCE: 6,                  // Max distance for steal attempt

        // Block Mechanics  
        BLOCK_MAX_DISTANCE: 6,                  // Max distance for block attempt
    },

    // ====================
    // PHYSICAL PLAY
    // ====================
    PHYSICAL: {
        // Shove Mechanics
        SHOVE_MAX_DISTANCE: 4.0,                // Max distance for shove (increased from 2.5)

        // Auto-Shove Conditions
        SURROUNDED_CLOSE_DISTANCE: 3,           // Distance for "surrounded" check
        VERY_CLOSE_DISTANCE: 2.5,               // Very close defender bonus
        TEAMMATE_STRUGGLING_DISTANCE: 3.5,      // Teammate struggling distance
        TIGHT_TEAMMATE_DEFENSE: 2.5,            // Tight defense on teammate
        CLOSE_OPPONENT_BONUS: 2.5,              // Close opponent for shove score
    },

    // ====================
    // FAST BREAK
    // ====================
    FAST_BREAK: {
        // Detection Thresholds
        MAX_DEFENDERS_AHEAD: 2,                 // Max defenders ahead for fast break
        MIN_DEFENDER_DISTANCE: 8,               // Min distance to closest defender

        // Turbo Usage
        WIDE_OPEN_DISTANCE: 15,                 // Distance for "wide open" fast break
        TURBO_THRESHOLD: 20,                    // Min turbo to use on fast break
        TURBO_USE_DISTANCE: 12,                 // Min defender distance to use turbo
    },

    // ====================
    // PASSING
    // ====================
    PASSING: {
        // Distance Thresholds (from passing.js if they exist)
        // TODO: Add after reviewing passing.js for magic numbers
    },

    // ====================
    // RANDOM VARIATION
    // ====================
    RANDOM: {
        // 50/50 Decisions
        COIN_FLIP: 0.5,                         // Used for random 50/50 decisions
    },

    // ====================
    // NOTES
    // ====================
    // All probability values are 0.0 to 1.0 (used with Math.random())
    // All distance values are in court units
    // All time values are in milliseconds (ms) or frames

};

// Make available globally
if (typeof module !== "undefined" && module.exports) {
    module.exports = GAME_BALANCE;
}
