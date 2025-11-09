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
 * Calculate game clock display data
 */
function calculateClockDisplay(systems) {
    var stateManager = systems.stateManager;
    var timeRemaining = stateManager.get('timeRemaining');
    var totalGameTime = stateManager.get('totalGameTime');
    var currentHalf = stateManager.get('currentHalf');
    var shotClock = stateManager.get('shotClock');

    var halfTime = Math.floor(totalGameTime / 2);
    var rawTime = (currentHalf === 1)
        ? (timeRemaining - halfTime)
        : timeRemaining;

    if (rawTime < 0) rawTime = 0;

    var mins = Math.floor(rawTime / 60);
    var secs = rawTime % 60;
    var halfLabel = currentHalf === 1 ? "1ST" : "2ND";

    return {
        minutes: mins,
        seconds: secs,
        halfLabel: halfLabel,
        shotClock: Math.max(0, shotClock),
        isShotClockUrgent: shotClock <= 5
    };
}

/**
 * Resolve team abbreviation conflicts
 * If both teams have same abbreviation, append 1/2
 */
function resolveTeamAbbreviations(abbrB, abbrA) {
    var cleanB = (abbrB || "TEMB").toUpperCase().replace(/\s+/g, "");
    var cleanA = (abbrA || "TEMA").toUpperCase().replace(/\s+/g, "");

    if (cleanB === cleanA) {
        var baseAbbr = cleanB;
        if (!baseAbbr.length) baseAbbr = "TEAM";
        var trimmedBase = baseAbbr;
        if (trimmedBase.length > 5) {
            trimmedBase = trimmedBase.substring(0, 5);
        }
        return {
            teamB: trimmedBase + "1",
            teamA: trimmedBase + "2"
        };
    }

    return {
        teamB: cleanB,
        teamA: cleanA
    };
}

/**
 * Calculate fire effect animation for a player
 * Returns color index for fire palette animation
 */
function calculateFireEffect(playerSprite, tickCounter, offset) {
    if (!playerSprite || !playerSprite.playerData || !playerSprite.playerData.onFire) {
        return null;
    }

    var firePalette = [LIGHTRED, YELLOW, WHITE, LIGHTRED];
    var idx = Math.floor((tickCounter + (offset || 0)) / 2) % firePalette.length;
    return firePalette[idx];
}

/**
 * Calculate jersey display value for a player
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
 * Calculate player display data for score view
 */
function calculatePlayerDisplay(player, teamKey, offset, systems) {
    var stateManager = systems.stateManager;
    var tickCounter = stateManager.get('tickCounter');
    var ballCarrier = stateManager.get('ballCarrier');

    if (!player || !player.playerData) {
        return null;
    }

    var pd = player.playerData;
    var lastName = getLastName(pd.name).substring(0, 8);
    var jersey = calculateJerseyDisplay(player);
    var turbo = (typeof pd.turbo === "number") ? pd.turbo : 0;
    var fireColor = calculateFireEffect(player, tickCounter, offset);

    return {
        name: lastName,
        jersey: jersey,
        turbo: turbo,
        isOnFire: !!(pd.onFire),
        fireColor: fireColor,
        hasBall: ballCarrier === player,
        controllerLabel: pd.controllerLabel || "",
        isHuman: !!(pd.controllerIsHuman)
    };
}


/**
 * Determine which team is leading and by how much
 */
// DEAD CODE - SAFE TO DELETE
// Not called in current code or backup. Replaced by getLeadingTeam() and getScoreDifferential().
function determineLeadingTeam(systems) {
    var stateManager = systems.stateManager;
    var score = stateManager.get('score');
    var diff = score.teamA - score.teamB;

    if (diff > 0) {
        return { leader: "teamA", margin: diff };
    } else if (diff < 0) {
        return { leader: "teamB", margin: Math.abs(diff) };
    } else {
        return { leader: null, margin: 0 };
    }
}
