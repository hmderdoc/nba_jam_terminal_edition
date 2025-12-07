/**
 * NBA JAM - Score Calculator
 * 
 * Pure game logic for score-related calculations
 * Decoupled from UI - returns data, doesn't render
 */

/**
 * Get the team currently leading
 * @returns {string} "teamA", "teamB", or "tie"
 */
function getLeadingTeam(systems) {
    var stateManager = systems.stateManager;
    var score = stateManager.get('score');
    var diff = score.teamA - score.teamB;
    if (diff > 0) return "teamA";
    if (diff < 0) return "teamB";
    return "tie";
}

/**
 * Get the absolute score differential
 * @returns {number} Point difference between teams
 */
function getScoreDifferential(systems) {
    var stateManager = systems.stateManager;
    var score = stateManager.get('score');
    return Math.abs(score.teamA - score.teamB);
}

/**
 * Check if the game is a blowout (20+ point lead)
 * @returns {boolean} True if one team is up by 20 or more
 */
function isBlowout() {
    return getScoreDifferential() >= 20;
}

/**
 * Check if the game is close (5 points or less)
 * @returns {boolean} True if score differential is 5 or less
 */
function isCloseGame() {
    return getScoreDifferential() <= 5;
}

/**
 * Check if the game is very close (1 possession game)
 * @returns {boolean} True if score differential is 3 or less
 */
function isOnePossessionGame() {
    return getScoreDifferential() <= 3;
}

/**
 * Get game situation description
 * @returns {string} Description of game state
 */
function getGameSituation() {
    var leader = getLeadingTeam();
    var diff = getScoreDifferential();

    if (leader === "tie") {
        return "TIED";
    }

    if (diff >= 20) {
        return "BLOWOUT";
    }

    if (diff <= 3) {
        return "CLOSE GAME";
    }

    if (diff <= 10) {
        return "COMPETITIVE";
    }

    return "COMFORTABLE LEAD";
}

/**
 * Check if a comeback is possible (trailing team can win with remaining time)
 * Rough estimate: need at least 15 seconds per 3-point possession
 * @returns {boolean} True if trailing team has realistic comeback potential
 */
function isComebackPossible(systems) {
    var stateManager = systems.stateManager;
    var leader = getLeadingTeam(systems);
    if (leader === "tie") return true; // Game is tied

    var diff = getScoreDifferential(systems);
    var timeLeft = stateManager.get('timeRemaining');

    // Rough formula: Can score ~4 points per 15 seconds (one possession each team)
    // Trailing team needs diff / 4 * 15 seconds minimum
    var secondsNeeded = Math.ceil(diff / 4) * 15;

    return timeLeft >= secondsNeeded;
}

/**
 * Get projected final score (simple linear extrapolation)
 * @returns {Object} { teamA: number, teamB: number }
 */
function getProjectedScore(systems) {
    var stateManager = systems.stateManager;
    var timeRemaining = stateManager.get('timeRemaining');
    var score = stateManager.get('score');
    var totalGameTime = stateManager.get('totalGameTime');

    if (timeRemaining === 0) {
        return {
            teamA: score.teamA,
            teamB: score.teamB
        };
    }

    // Calculate scoring rate (points per second)
    var elapsedTime = totalGameTime - timeRemaining;
    if (elapsedTime === 0) {
        // No time elapsed yet, can't project
        return {
            teamA: score.teamA,
            teamB: score.teamB
        };
    }

    var teamARate = score.teamA / elapsedTime;
    var teamBRate = score.teamB / elapsedTime;

    // Project to end of game
    var projectedA = Math.round(teamARate * totalGameTime);
    var projectedB = Math.round(teamBRate * totalGameTime);

    return {
        teamA: projectedA,
        teamB: projectedB
    };
}

// ============================================================================
// VIEW MODEL FUNCTIONS FOR SCORE DISPLAY UI
// ============================================================================

/**
 * Get or initialize score flash state
 */
function getScoreFlashState(systems) {
    var stateManager = systems.stateManager;
    var scoreFlash = stateManager.get('scoreFlash');

    if (!scoreFlash) {
        stateManager.set("scoreFlash", {
            active: false,
            activeTeam: null,
            stopTeam: null,
            startedTick: 0,
            regainCheckEnabled: false
        }, "init_score_flash");
        scoreFlash = stateManager.get('scoreFlash');
    }
    return scoreFlash;
}

/**
 * Start score flashing after a team scores
 */
function startScoreFlash(scoringTeam, inboundTeam, systems) {
    var stateManager = systems.stateManager;
    var tickCounter = stateManager.get('tickCounter');
    var state = getScoreFlashState(systems);
    state.active = true;
    state.activeTeam = scoringTeam;
    state.stopTeam = inboundTeam;
    state.startedTick = tickCounter || 0;
    state.regainCheckEnabled = false;
}

/**
 * Stop score flashing
 */
function stopScoreFlash(teamName, systems) {
    var state = getScoreFlashState(systems);
    if (!state.active) return;
    if (!teamName || state.activeTeam === teamName) {
        state.active = false;
        state.activeTeam = null;
        state.stopTeam = null;
        state.startedTick = 0;
        state.regainCheckEnabled = false;
    }
}

/**
 * Enable checking for score flash stop condition
 */
// TODO: RESTORE FOR SCORE DISPLAY - Lost during refactor
// Was called once in backup (line 11452) after scoring to enable score flash regain check.
// This controls when the flashing score display should stop after scoring.
// May need to restore for proper score display behavior.
function enableScoreFlashRegainCheck(teamName, systems) {
    var stateManager = systems.stateManager;
    var inbounding = stateManager.get('inbounding');
    var currentTeam = stateManager.get('currentTeam');
    var state = getScoreFlashState(systems);
    if (!state.active) return;
    if (!teamName || state.stopTeam === teamName) {
        state.regainCheckEnabled = true;
        if (!inbounding && state.activeTeam && currentTeam === state.activeTeam) {
            stopScoreFlash(state.activeTeam, systems);
        }
    }
}

/**
 * Calculate jersey display value for a player
 * Shared by scoreboard and stats UI
 */
function calculateJerseyDisplay(player) {
    if (!player || !player.playerData) return "";

    var rawJersey = (player.playerData.jerseyString !== undefined && player.playerData.jerseyString !== null)
        ? player.playerData.jerseyString
        : player.playerData.jersey;

    var jerseyValue = (rawJersey !== undefined && rawJersey !== null) ? String(rawJersey) : "";

    if (jerseyValue.length === 0) return "";
    if (jerseyValue.length < 2) {
        jerseyValue = padStart(jerseyValue, 2, ' ');
    }

    return jerseyValue;
}

/**
 * Resolve scoreboard-ready team abbreviations
 * Ensures both sides remain unique and <=5 characters
 */
function resolveTeamAbbreviations(teamAbbrs) {
    var teamB = (teamAbbrs && teamAbbrs.teamB) ? String(teamAbbrs.teamB) : "TMB";
    var teamA = (teamAbbrs && teamAbbrs.teamA) ? String(teamAbbrs.teamA) : "TMA";
    var cleanB = teamB.toUpperCase().replace(/\s+/g, "");
    var cleanA = teamA.toUpperCase().replace(/\s+/g, "");

    if (!cleanB.length) cleanB = "TEAM1";
    if (!cleanA.length) cleanA = "TEAM2";

    if (cleanB === cleanA) {
        var base = cleanB.length ? cleanB : "TEAM";
        if (base.length > 5) base = base.substring(0, 5);
        return {
            teamB: base + "1",
            teamA: base + "2"
        };
    }

    return {
        teamB: cleanB,
        teamA: cleanA
    };
}

/**
 * Calculate game clock display (minutes, seconds, half label)
 */
function calculateClockDisplay(systems) {
    var stateManager = systems.stateManager;
    var totalGameTime = stateManager.get('totalGameTime') || 0;
    var currentHalf = stateManager.get('currentHalf') || 1;
    var timeRemaining = stateManager.get('timeRemaining') || 0;
    var isOvertime = !!stateManager.get('isOvertime');
    var currentOvertimePeriod = stateManager.get('currentOvertimePeriod') || 0;

    if (isOvertime || currentOvertimePeriod > 0) {
        var overtimeMinutes = Math.floor(timeRemaining / 60);
        var overtimeSeconds = timeRemaining % 60;
        var overtimeLabel = currentOvertimePeriod > 1 ? "OT" + currentOvertimePeriod : "OT";
        return {
            minutes: overtimeMinutes,
            seconds: overtimeSeconds,
            halfLabel: overtimeLabel,
            isOvertime: true
        };
    }

    var halfTime = Math.floor(totalGameTime / 2);
    var rawTime = currentHalf === 1 ? (timeRemaining - halfTime) : timeRemaining;
    if (rawTime < 0) rawTime = 0;

    return {
        minutes: Math.floor(rawTime / 60),
        seconds: rawTime % 60,
        halfLabel: currentHalf === 1 ? "1ST" : "2ND",
        isOvertime: false
    };
}
