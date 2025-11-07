/**
 * NBA JAM - AI Difficulty Settings
 * 
 * Configurable AI difficulty levels with different behavior parameters
 * Affects reaction time, shot accuracy, defensive positioning, and decision-making
 */

/**
 * AI Difficulty Levels
 * 
 * Each difficulty adjusts multiple aspects of AI behavior:
 * - reactionTimeMs: Delay before AI processes inputs (higher = slower response)
 * - shotAccuracyMultiplier: Multiplier applied to base shot probability
 * - shotThreshold: Minimum shot quality required to take shot (higher = more selective)
 * - defenseAggressiveness: How tight AI plays defense (0-1, higher = tighter)
 * - passAccuracyMultiplier: Multiplier for pass interception avoidance
 * - turnoverProbability: Base chance of unforced turnovers
 * - stealSuccessMultiplier: Multiplier for steal attempt success rate
 * - blockSuccessMultiplier: Multiplier for block attempt success rate
 */
var aiDifficultySettings = {
    easy: {
        name: "Easy",
        reactionTimeMs: 500,           // 0.5 second delay
        shotAccuracyMultiplier: 0.7,   // 30% worse shooting
        shotThreshold: 0.9,             // Very selective (only wide open shots)
        defenseAggressiveness: 0.5,     // Loose defense
        passAccuracyMultiplier: 0.6,    // Poor pass decisions
        turnoverProbability: 0.15,      // 15% chance of unforced turnover
        stealSuccessMultiplier: 0.5,    // Half steal success rate
        blockSuccessMultiplier: 0.5,    // Half block success rate
        description: "AI makes poor decisions, slow reactions, weak defense"
    },
    
    medium: {
        name: "Medium",
        reactionTimeMs: 250,            // 0.25 second delay
        shotAccuracyMultiplier: 1.0,    // Normal shooting
        shotThreshold: 0.7,              // Moderate selectivity
        defenseAggressiveness: 0.75,     // Moderate defense
        passAccuracyMultiplier: 1.0,     // Normal passing
        turnoverProbability: 0.05,       // 5% chance of unforced turnover
        stealSuccessMultiplier: 1.0,     // Normal steal rate
        blockSuccessMultiplier: 1.0,     // Normal block rate
        description: "Balanced AI with realistic basketball decisions"
    },
    
    hard: {
        name: "Hard",
        reactionTimeMs: 100,            // 0.1 second delay
        shotAccuracyMultiplier: 1.2,    // 20% better shooting
        shotThreshold: 0.5,              // Takes contested shots
        defenseAggressiveness: 0.95,     // Very tight defense
        passAccuracyMultiplier: 1.3,     // Excellent passing
        turnoverProbability: 0.01,       // 1% chance of unforced turnover
        stealSuccessMultiplier: 1.5,     // 50% better steal rate
        blockSuccessMultiplier: 1.5,     // 50% better block rate
        description: "AI plays near-perfect basketball with quick reactions"
    },
    
    arcade: {
        name: "Arcade (NBA JAM Style)",
        reactionTimeMs: 150,            // 0.15 second delay
        shotAccuracyMultiplier: 1.1,    // Slightly better shooting
        shotThreshold: 0.6,              // Moderate selectivity
        defenseAggressiveness: 0.85,     // Aggressive but fair
        passAccuracyMultiplier: 1.1,     // Good passing
        turnoverProbability: 0.03,       // 3% chance of unforced turnover
        stealSuccessMultiplier: 1.2,     // 20% better steal rate
        blockSuccessMultiplier: 1.3,     // 30% better block rate
        description: "Arcade-style AI matching original NBA JAM feel"
    }
};

/**
 * Current AI difficulty level (global setting)
 * Default to 'arcade' for authentic NBA JAM experience
 */
var currentAIDifficulty = "arcade";

/**
 * Get current AI difficulty settings
 * @returns {Object} Current difficulty settings object
 */
function getAIDifficulty() {
    return aiDifficultySettings[currentAIDifficulty] || aiDifficultySettings.medium;
}

/**
 * Set AI difficulty level
 * @param {string} level - Difficulty level ('easy', 'medium', 'hard', 'arcade')
 * @returns {boolean} True if level was valid and set
 */
function setAIDifficulty(level) {
    if (!aiDifficultySettings[level]) {
        log(LOG_WARNING, "NBA JAM: Invalid AI difficulty level: " + level);
        return false;
    }
    
    currentAIDifficulty = level;
    log(LOG_INFO, "NBA JAM: AI difficulty set to " + aiDifficultySettings[level].name);
    return true;
}

/**
 * Get adjusted shot probability based on difficulty
 * @param {number} baseProbability - Base shot probability (0-1)
 * @returns {number} Adjusted probability
 */
function getAdjustedShotProbability(baseProbability) {
    var difficulty = getAIDifficulty();
    var adjusted = baseProbability * difficulty.shotAccuracyMultiplier;
    return Math.max(0, Math.min(1, adjusted));
}

/**
 * Check if AI should take shot based on quality and difficulty threshold
 * @param {number} shotQuality - Shot quality (0-1)
 * @returns {boolean} True if AI should shoot
 */
function shouldAIShoot(shotQuality) {
    var difficulty = getAIDifficulty();
    return shotQuality >= difficulty.shotThreshold;
}

/**
 * Get AI reaction delay in milliseconds
 * @returns {number} Reaction delay in ms
 */
function getAIReactionDelay() {
    var difficulty = getAIDifficulty();
    return difficulty.reactionTimeMs;
}

/**
 * Get AI defense aggressiveness (0-1)
 * Higher values mean tighter defense
 * @returns {number} Aggressiveness factor
 */
function getAIDefenseAggressiveness() {
    var difficulty = getAIDifficulty();
    return difficulty.defenseAggressiveness;
}

/**
 * Get adjusted steal success probability
 * @param {number} baseProb - Base steal probability
 * @returns {number} Adjusted probability
 */
function getAdjustedStealProbability(baseProb) {
    var difficulty = getAIDifficulty();
    var adjusted = baseProb * difficulty.stealSuccessMultiplier;
    return Math.max(0, Math.min(1, adjusted));
}

/**
 * Get adjusted block success probability
 * @param {number} baseProb - Base block probability
 * @returns {number} Adjusted probability
 */
function getAdjustedBlockProbability(baseProb) {
    var difficulty = getAIDifficulty();
    var adjusted = baseProb * difficulty.blockSuccessMultiplier;
    return Math.max(0, Math.min(1, adjusted));
}

/**
 * Check if AI should commit unforced turnover (difficulty variance)
 * @returns {boolean} True if AI should turnover
 */
function shouldAICommitUnforcedTurnover() {
    var difficulty = getAIDifficulty();
    return Math.random() < difficulty.turnoverProbability;
}

/**
 * Get pass accuracy multiplier for AI
 * Higher values mean better pass decisions and less interceptions
 * @returns {number} Pass accuracy multiplier
 */
function getAIPassAccuracyMultiplier() {
    var difficulty = getAIDifficulty();
    return difficulty.passAccuracyMultiplier;
}

/**
 * Get all available difficulty levels
 * @returns {Array} Array of difficulty level names
 */
function getAvailableDifficulties() {
    return Object.keys(aiDifficultySettings);
}

/**
 * Get difficulty description
 * @param {string} level - Difficulty level name
 * @returns {string} Description text
 */
function getDifficultyDescription(level) {
    var settings = aiDifficultySettings[level];
    return settings ? settings.description : "";
}

/**
 * Self-test function
 */
function runAIDifficultyTests() {
    var results = [];
    
    // Test 1: Default difficulty
    var defaultDiff = getAIDifficulty();
    results.push({
        test: "Default difficulty should be 'arcade'",
        passed: defaultDiff.name === "Arcade (NBA JAM Style)"
    });
    
    // Test 2: Set difficulty
    var setResult = setAIDifficulty("hard");
    results.push({
        test: "Should be able to set difficulty to 'hard'",
        passed: setResult === true && currentAIDifficulty === "hard"
    });
    
    // Test 3: Adjusted shot probability
    var baseProb = 0.5;
    var hardProb = getAdjustedShotProbability(baseProb);
    results.push({
        test: "Hard difficulty should increase shot probability",
        passed: hardProb > baseProb
    });
    
    // Test 4: Easy difficulty
    setAIDifficulty("easy");
    var easyProb = getAdjustedShotProbability(baseProb);
    results.push({
        test: "Easy difficulty should decrease shot probability",
        passed: easyProb < baseProb
    });
    
    // Test 5: Shot threshold
    var easyDiff = getAIDifficulty();
    results.push({
        test: "Easy difficulty should have high shot threshold",
        passed: easyDiff.shotThreshold >= 0.9
    });
    
    // Reset to default
    setAIDifficulty("arcade");
    
    // Print results
    if (typeof console !== "undefined" && typeof console.print === "function") {
        for (var i = 0; i < results.length; i++) {
            var r = results[i];
            console.print("AI Difficulty Test " + (i + 1) + ": " + r.test + " - " + 
                         (r.passed ? "PASS" : "FAIL") + "\n");
        }
    }
    
    return results.every(function(r) { return r.passed; });
}
