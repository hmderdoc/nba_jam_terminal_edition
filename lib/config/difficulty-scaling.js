/**
 * difficulty-scaling.js - AI Difficulty Scaling System
 * 
 * Provides difficulty presets for LORB courts (tiers 1-5) plus special modes.
 * Scales AI behavior by modifying:
 * 
 * DEFENSE (makes AI harder to score on at higher tiers):
 *   - Responsiveness (frontcourt/midcourt/backcourt reaction speeds)
 *   - Deny reaction delays (how slow help defenders are to react)
 *   - Blowby chances (likelihood of getting past defenders)
 * 
 * OFFENSE (makes AI score better at higher tiers):
 *   - Shot probability threshold (pickier = better shot selection)
 *   - Decision speed (faster reads after shove battles, etc.)
 *   - Cut timing (less standing around = more active offense)
 * 
 * STAMINA:
 *   - AI turbo capacity (less turbo = can't sustain pressure)
 * 
 * Usage:
 *   var modifiers = getDifficultyModifiers(tier);
 *   applyDifficultyScaling(tier);  // Call before game starts
 *   resetDifficultyScaling();      // Call after game ends
 */

// Store original values for reset
var _originalValues = null;

/**
 * Difficulty presets by tier
 * 
 * Tier 1: Court 6 (Rookie)
 * Tier 2: Court 9 (Regular)
 * Tier 3: Dunk District (Pro) - BASELINE
 * Tier 4: The Arc (Elite)
 * Tier 5: Court of Airness (Legend)
 * Special: playoff, jordan
 */
var DIFFICULTY_PRESETS = {
    1: {
        name: "Rookie",
        // Defense - very sluggish reactions, easy to blow by
        defense: {
            responsivenessMultiplier: 0.60,    // 60% of base responsiveness
            denyReactionDelayMultiplier: 1.70, // 70% slower to react
            blowbyChanceMultiplier: 1.50       // 50% more blowby opportunities
        },
        // Offense - chucks bad shots with no game sense
        offense: {
            shotProbabilityThreshold: 12,      // Will shoot at ~12% quality - no shot selection
            decisionSpeedMultiplier: 1.75,     // 75% slower decisions
            cutWobbleMultiplier: 1.75          // Stands around 75% longer
        },
        // Stamina - runs out of gas quickly
        turboCapacity: 60
    },
    
    2: {
        name: "Regular",
        defense: {
            responsivenessMultiplier: 0.80,
            denyReactionDelayMultiplier: 1.35,
            blowbyChanceMultiplier: 1.25
        },
        offense: {
            shotProbabilityThreshold: 22,      // Still takes questionable shots
            decisionSpeedMultiplier: 1.40,
            cutWobbleMultiplier: 1.40
        },
        turboCapacity: 80
    },
    
    3: {
        name: "Pro",
        // BASELINE - all multipliers at 1.0, threshold at 40
        defense: {
            responsivenessMultiplier: 1.00,
            denyReactionDelayMultiplier: 1.00,
            blowbyChanceMultiplier: 1.00
        },
        offense: {
            shotProbabilityThreshold: 40,
            decisionSpeedMultiplier: 1.00,
            cutWobbleMultiplier: 1.00
        },
        turboCapacity: 100
    },
    
    4: {
        name: "Elite",
        defense: {
            responsivenessMultiplier: 1.25,
            denyReactionDelayMultiplier: 0.70,
            blowbyChanceMultiplier: 0.70
        },
        offense: {
            shotProbabilityThreshold: 46,
            decisionSpeedMultiplier: 0.70,
            cutWobbleMultiplier: 0.65
        },
        turboCapacity: 120
    },
    
    5: {
        name: "Legend",
        defense: {
            responsivenessMultiplier: 1.45,
            denyReactionDelayMultiplier: 0.50,
            blowbyChanceMultiplier: 0.55
        },
        offense: {
            shotProbabilityThreshold: 52,
            decisionSpeedMultiplier: 0.50,
            cutWobbleMultiplier: 0.50
        },
        turboCapacity: 140
    },
    
    // Special difficulty for playoff simulations
    playoff: {
        name: "Playoff",
        defense: {
            responsivenessMultiplier: 1.35,
            denyReactionDelayMultiplier: 0.60,
            blowbyChanceMultiplier: 0.65
        },
        offense: {
            shotProbabilityThreshold: 48,
            decisionSpeedMultiplier: 0.60,
            cutWobbleMultiplier: 0.55
        },
        turboCapacity: 130
    },
    
    // Jordan boss fight - very hard
    jordan: {
        name: "His Airness",
        defense: {
            responsivenessMultiplier: 1.60,
            denyReactionDelayMultiplier: 0.35,
            blowbyChanceMultiplier: 0.40
        },
        offense: {
            shotProbabilityThreshold: 55,
            decisionSpeedMultiplier: 0.40,
            cutWobbleMultiplier: 0.35
        },
        turboCapacity: 150
    },
    
    // Red Bull final boss (Satan + Iceman) - maximum difficulty
    red_bull: {
        name: "The Red Bull",
        defense: {
            responsivenessMultiplier: 1.80,        // Ultra-responsive defense
            denyReactionDelayMultiplier: 0.25,     // Near-instant help reactions
            blowbyChanceMultiplier: 0.30           // Very hard to beat off dribble
        },
        offense: {
            shotProbabilityThreshold: 60,          // Only takes great shots
            decisionSpeedMultiplier: 0.30,         // Lightning-fast reads
            cutWobbleMultiplier: 0.25              // Constantly moving, cutting
        },
        turboCapacity: 175                         // Nearly unlimited turbo
    }
};

/**
 * Get difficulty preset by tier or name
 * @param {number|string} tier - Tier number (1-5) or special name ("playoff", "jordan", "red_bull")
 * @returns {Object} Difficulty preset or tier 3 as fallback
 */
function getDifficultyPreset(tier) {
    if (typeof tier === "string") {
        return DIFFICULTY_PRESETS[tier] || DIFFICULTY_PRESETS[3];
    }
    tier = parseInt(tier, 10);
    if (tier < 1) tier = 1;
    if (tier > 5) tier = 5;
    return DIFFICULTY_PRESETS[tier] || DIFFICULTY_PRESETS[3];
}

/**
 * Get the computed modifiers for a difficulty tier
 * Returns the actual values to apply (not multipliers)
 * 
 * @param {number|string} tier - Difficulty tier
 * @returns {Object} Computed difficulty modifiers
 */
function getDifficultyModifiers(tier) {
    var preset = getDifficultyPreset(tier);
    
    // Base values from AI_CONSTANTS (if loaded) or hardcoded defaults
    var baseDefense = {
        frontcourtResponsiveness: 0.35,
        midcourtResponsiveness: 0.25,
        backcourtResponsiveness: 0.12,
        denyReactionDelayBase: 0.30,
        blowbyChanceBackcourt: 0.35,
        blowbyChanceMidcourt: 0.15,
        blowbyChanceFrontcourt: 0.05
    };
    
    var baseOffense = {
        shotProbabilityThreshold: 40,
        quickWindowMs: 200,
        wobbleFrames: 20
    };
    
    // Try to read actual values from AI_CONSTANTS if available
    if (typeof AI_CONSTANTS !== "undefined") {
        if (AI_CONSTANTS.DEFENSE_ON_BALL && AI_CONSTANTS.DEFENSE_ON_BALL.COURT_POSITION) {
            var cp = AI_CONSTANTS.DEFENSE_ON_BALL.COURT_POSITION;
            baseDefense.frontcourtResponsiveness = cp.frontcourtResponsiveness || baseDefense.frontcourtResponsiveness;
            baseDefense.midcourtResponsiveness = cp.midcourtResponsiveness || baseDefense.midcourtResponsiveness;
            baseDefense.backcourtResponsiveness = cp.backcourtResponsiveness || baseDefense.backcourtResponsiveness;
            baseDefense.blowbyChanceBackcourt = cp.blowbyChanceBackcourt || baseDefense.blowbyChanceBackcourt;
            baseDefense.blowbyChanceMidcourt = cp.blowbyChanceMidcourt || baseDefense.blowbyChanceMidcourt;
            baseDefense.blowbyChanceFrontcourt = cp.blowbyChanceFrontcourt || baseDefense.blowbyChanceFrontcourt;
        }
        if (AI_CONSTANTS.DEFENSE_HELP) {
            baseDefense.denyReactionDelayBase = AI_CONSTANTS.DEFENSE_HELP.denyReactionDelayBase || baseDefense.denyReactionDelayBase;
        }
        if (AI_CONSTANTS.SHOT_PROBABILITY_THRESHOLD) {
            baseOffense.shotProbabilityThreshold = AI_CONSTANTS.SHOT_PROBABILITY_THRESHOLD;
        }
        if (AI_CONSTANTS.OFFENSE_BALL && AI_CONSTANTS.OFFENSE_BALL.DECISION) {
            baseOffense.quickWindowMs = AI_CONSTANTS.OFFENSE_BALL.DECISION.QUICK_WINDOW_MS || baseOffense.quickWindowMs;
        }
        if (AI_CONSTANTS.OFFENSE_OFF_BALL && AI_CONSTANTS.OFFENSE_OFF_BALL.ACTIVE_CUT) {
            baseOffense.wobbleFrames = AI_CONSTANTS.OFFENSE_OFF_BALL.ACTIVE_CUT.wobbleFrames || baseOffense.wobbleFrames;
        }
    }
    
    // Apply multipliers to compute final values
    return {
        name: preset.name,
        tier: tier,
        
        // Defense values
        defense: {
            frontcourtResponsiveness: baseDefense.frontcourtResponsiveness * preset.defense.responsivenessMultiplier,
            midcourtResponsiveness: baseDefense.midcourtResponsiveness * preset.defense.responsivenessMultiplier,
            backcourtResponsiveness: baseDefense.backcourtResponsiveness * preset.defense.responsivenessMultiplier,
            denyReactionDelayBase: baseDefense.denyReactionDelayBase * preset.defense.denyReactionDelayMultiplier,
            blowbyChanceBackcourt: baseDefense.blowbyChanceBackcourt * preset.defense.blowbyChanceMultiplier,
            blowbyChanceMidcourt: baseDefense.blowbyChanceMidcourt * preset.defense.blowbyChanceMultiplier,
            blowbyChanceFrontcourt: baseDefense.blowbyChanceFrontcourt * preset.defense.blowbyChanceMultiplier
        },
        
        // Offense values
        offense: {
            shotProbabilityThreshold: preset.offense.shotProbabilityThreshold,
            quickWindowMs: Math.round(baseOffense.quickWindowMs * preset.offense.decisionSpeedMultiplier),
            wobbleFrames: Math.round(baseOffense.wobbleFrames * preset.offense.cutWobbleMultiplier)
        },
        
        // Turbo capacity
        turboCapacity: preset.turboCapacity
    };
}

/**
 * Capture current AI_CONSTANTS values for later restoration
 */
function captureOriginalValues() {
    if (_originalValues) return; // Already captured
    
    _originalValues = {
        SHOT_PROBABILITY_THRESHOLD: null,
        DEFENSE_ON_BALL_COURT_POSITION: null,
        DEFENSE_HELP: null,
        OFFENSE_BALL_DECISION: null,
        OFFENSE_OFF_BALL_ACTIVE_CUT: null
    };
    
    if (typeof AI_CONSTANTS !== "undefined") {
        _originalValues.SHOT_PROBABILITY_THRESHOLD = AI_CONSTANTS.SHOT_PROBABILITY_THRESHOLD;
        
        if (AI_CONSTANTS.DEFENSE_ON_BALL && AI_CONSTANTS.DEFENSE_ON_BALL.COURT_POSITION) {
            _originalValues.DEFENSE_ON_BALL_COURT_POSITION = JSON.parse(
                JSON.stringify(AI_CONSTANTS.DEFENSE_ON_BALL.COURT_POSITION)
            );
        }
        
        if (AI_CONSTANTS.DEFENSE_HELP) {
            _originalValues.DEFENSE_HELP = {
                denyReactionDelayBase: AI_CONSTANTS.DEFENSE_HELP.denyReactionDelayBase,
                denyReactionDelayRange: AI_CONSTANTS.DEFENSE_HELP.denyReactionDelayRange
            };
        }
        
        if (AI_CONSTANTS.OFFENSE_BALL && AI_CONSTANTS.OFFENSE_BALL.DECISION) {
            _originalValues.OFFENSE_BALL_DECISION = {
                QUICK_WINDOW_MS: AI_CONSTANTS.OFFENSE_BALL.DECISION.QUICK_WINDOW_MS
            };
        }
        
        if (AI_CONSTANTS.OFFENSE_OFF_BALL && AI_CONSTANTS.OFFENSE_OFF_BALL.ACTIVE_CUT) {
            _originalValues.OFFENSE_OFF_BALL_ACTIVE_CUT = {
                wobbleFrames: AI_CONSTANTS.OFFENSE_OFF_BALL.ACTIVE_CUT.wobbleFrames
            };
        }
    }
    
    // Also capture global SHOT_PROBABILITY_THRESHOLD if it exists separately
    if (typeof SHOT_PROBABILITY_THRESHOLD !== "undefined") {
        _originalValues.SHOT_PROBABILITY_THRESHOLD_GLOBAL = SHOT_PROBABILITY_THRESHOLD;
    }
}

/**
 * Apply difficulty scaling to AI_CONSTANTS
 * Call this before a game starts
 * 
 * @param {number|string} tier - Difficulty tier
 * @param {Object} options - Optional settings
 * @param {string} options.applyTo - "ai" (opponent team only) or "all" (default: "ai")
 */
function applyDifficultyScaling(tier, options) {
    options = options || {};
    
    // Capture originals first
    captureOriginalValues();
    
    var modifiers = getDifficultyModifiers(tier);
    
    if (typeof log === "function") {
        log(LOG_DEBUG, "[DIFFICULTY] Applying tier " + tier + " (" + modifiers.name + 
            "): shotThreshold=" + modifiers.offense.shotProbabilityThreshold +
            ", turboCapacity=" + modifiers.turboCapacity);
    }
    
    // Apply to AI_CONSTANTS if available
    if (typeof AI_CONSTANTS !== "undefined") {
        // Shot threshold
        AI_CONSTANTS.SHOT_PROBABILITY_THRESHOLD = modifiers.offense.shotProbabilityThreshold;
        
        // Defense responsiveness
        if (AI_CONSTANTS.DEFENSE_ON_BALL && AI_CONSTANTS.DEFENSE_ON_BALL.COURT_POSITION) {
            var cp = AI_CONSTANTS.DEFENSE_ON_BALL.COURT_POSITION;
            cp.frontcourtResponsiveness = modifiers.defense.frontcourtResponsiveness;
            cp.midcourtResponsiveness = modifiers.defense.midcourtResponsiveness;
            cp.backcourtResponsiveness = modifiers.defense.backcourtResponsiveness;
            cp.blowbyChanceBackcourt = modifiers.defense.blowbyChanceBackcourt;
            cp.blowbyChanceMidcourt = modifiers.defense.blowbyChanceMidcourt;
            cp.blowbyChanceFrontcourt = modifiers.defense.blowbyChanceFrontcourt;
        }
        
        // Help defense delays
        if (AI_CONSTANTS.DEFENSE_HELP) {
            AI_CONSTANTS.DEFENSE_HELP.denyReactionDelayBase = modifiers.defense.denyReactionDelayBase;
        }
        
        // Offense decision speed
        if (AI_CONSTANTS.OFFENSE_BALL && AI_CONSTANTS.OFFENSE_BALL.DECISION) {
            AI_CONSTANTS.OFFENSE_BALL.DECISION.QUICK_WINDOW_MS = modifiers.offense.quickWindowMs;
        }
        
        // Off-ball cut timing
        if (AI_CONSTANTS.OFFENSE_OFF_BALL && AI_CONSTANTS.OFFENSE_OFF_BALL.ACTIVE_CUT) {
            AI_CONSTANTS.OFFENSE_OFF_BALL.ACTIVE_CUT.wobbleFrames = modifiers.offense.wobbleFrames;
        }
    }
    
    // Update global SHOT_PROBABILITY_THRESHOLD if it exists
    if (typeof SHOT_PROBABILITY_THRESHOLD !== "undefined") {
        SHOT_PROBABILITY_THRESHOLD = modifiers.offense.shotProbabilityThreshold;
    }
    
    // Store modifiers for turbo capacity application during sprite init
    if (typeof global !== "undefined") {
        global._activeDifficultyModifiers = modifiers;
    }
    
    return modifiers;
}

/**
 * Reset AI_CONSTANTS to original values
 * Call this after a game ends
 */
function resetDifficultyScaling() {
    if (!_originalValues) return;
    
    if (typeof log === "function") {
        log(LOG_DEBUG, "[DIFFICULTY] Resetting to original values");
    }
    
    if (typeof AI_CONSTANTS !== "undefined") {
        // Restore shot threshold
        if (_originalValues.SHOT_PROBABILITY_THRESHOLD !== null) {
            AI_CONSTANTS.SHOT_PROBABILITY_THRESHOLD = _originalValues.SHOT_PROBABILITY_THRESHOLD;
        }
        
        // Restore defense court position
        if (_originalValues.DEFENSE_ON_BALL_COURT_POSITION && 
            AI_CONSTANTS.DEFENSE_ON_BALL && AI_CONSTANTS.DEFENSE_ON_BALL.COURT_POSITION) {
            var orig = _originalValues.DEFENSE_ON_BALL_COURT_POSITION;
            var cp = AI_CONSTANTS.DEFENSE_ON_BALL.COURT_POSITION;
            for (var key in orig) {
                if (orig.hasOwnProperty(key)) {
                    cp[key] = orig[key];
                }
            }
        }
        
        // Restore help defense
        if (_originalValues.DEFENSE_HELP && AI_CONSTANTS.DEFENSE_HELP) {
            AI_CONSTANTS.DEFENSE_HELP.denyReactionDelayBase = _originalValues.DEFENSE_HELP.denyReactionDelayBase;
            AI_CONSTANTS.DEFENSE_HELP.denyReactionDelayRange = _originalValues.DEFENSE_HELP.denyReactionDelayRange;
        }
        
        // Restore offense decision
        if (_originalValues.OFFENSE_BALL_DECISION && 
            AI_CONSTANTS.OFFENSE_BALL && AI_CONSTANTS.OFFENSE_BALL.DECISION) {
            AI_CONSTANTS.OFFENSE_BALL.DECISION.QUICK_WINDOW_MS = _originalValues.OFFENSE_BALL_DECISION.QUICK_WINDOW_MS;
        }
        
        // Restore off-ball
        if (_originalValues.OFFENSE_OFF_BALL_ACTIVE_CUT && 
            AI_CONSTANTS.OFFENSE_OFF_BALL && AI_CONSTANTS.OFFENSE_OFF_BALL.ACTIVE_CUT) {
            AI_CONSTANTS.OFFENSE_OFF_BALL.ACTIVE_CUT.wobbleFrames = _originalValues.OFFENSE_OFF_BALL_ACTIVE_CUT.wobbleFrames;
        }
    }
    
    // Restore global
    if (typeof SHOT_PROBABILITY_THRESHOLD !== "undefined" && 
        _originalValues.SHOT_PROBABILITY_THRESHOLD_GLOBAL !== undefined) {
        SHOT_PROBABILITY_THRESHOLD = _originalValues.SHOT_PROBABILITY_THRESHOLD_GLOBAL;
    }
    
    // Clear active modifiers
    if (typeof global !== "undefined") {
        global._activeDifficultyModifiers = null;
    }
    
    _originalValues = null;
}

/**
 * Get the currently active difficulty modifiers (if any)
 * @returns {Object|null} Active modifiers or null
 */
function getActiveDifficultyModifiers() {
    if (typeof global !== "undefined" && global._activeDifficultyModifiers) {
        return global._activeDifficultyModifiers;
    }
    return null;
}

/**
 * Apply turbo capacity to AI players based on active difficulty
 * Call this after sprites are initialized
 * 
 * @param {Array} aiPlayers - Array of AI player sprites
 */
function applyTurboCapacityToAI(aiPlayers) {
    var modifiers = getActiveDifficultyModifiers();
    if (!modifiers) return;
    
    for (var i = 0; i < aiPlayers.length; i++) {
        var player = aiPlayers[i];
        if (player && player.playerData) {
            player.playerData.turboCapacity = modifiers.turboCapacity;
            // Clip current turbo to new capacity
            if (player.playerData.turbo > modifiers.turboCapacity) {
                player.playerData.turbo = modifiers.turboCapacity;
            }
        }
    }
    
    if (typeof log === "function") {
        log(LOG_DEBUG, "[DIFFICULTY] Applied turboCapacity=" + modifiers.turboCapacity + 
            " to " + aiPlayers.length + " AI players");
    }
}

/**
 * Check if difficulty scaling is currently active
 * @returns {boolean}
 */
function isDifficultyScalingActive() {
    return _originalValues !== null;
}

// Export
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        DIFFICULTY_PRESETS: DIFFICULTY_PRESETS,
        getDifficultyPreset: getDifficultyPreset,
        getDifficultyModifiers: getDifficultyModifiers,
        applyDifficultyScaling: applyDifficultyScaling,
        resetDifficultyScaling: resetDifficultyScaling,
        getActiveDifficultyModifiers: getActiveDifficultyModifiers,
        applyTurboCapacityToAI: applyTurboCapacityToAI,
        isDifficultyScalingActive: isDifficultyScalingActive
    };
}

// Also expose globally for non-module environments
var DifficultyScaling = {
    DIFFICULTY_PRESETS: DIFFICULTY_PRESETS,
    getDifficultyPreset: getDifficultyPreset,
    getDifficultyModifiers: getDifficultyModifiers,
    applyDifficultyScaling: applyDifficultyScaling,
    resetDifficultyScaling: resetDifficultyScaling,
    getActiveDifficultyModifiers: getActiveDifficultyModifiers,
    applyTurboCapacityToAI: applyTurboCapacityToAI,
    isDifficultyScalingActive: isDifficultyScalingActive
};
