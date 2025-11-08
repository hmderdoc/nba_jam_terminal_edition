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
    var diff = gameState.score.teamA - gameState.score.teamB;
    if (diff > 0) return "teamA";
    if (diff < 0) return "teamB";
    return "tie";
}

/**
 * Get the absolute score differential
 * @returns {number} Point difference between teams
 */
function getScoreDifferential(systems) {
    return Math.abs(gameState.score.teamA - gameState.score.teamB);
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
    var leader = getLeadingTeam();
    if (leader === "tie") return true; // Game is tied

    var diff = getScoreDifferential();
    var timeLeft = gameState.timeRemaining;

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
    if (gameState.timeRemaining === 0) {
        return {
            teamA: gameState.score.teamA,
            teamB: gameState.score.teamB
        };
    }

    // Calculate scoring rate (points per second)
    var elapsedTime = gameState.totalGameTime - gameState.timeRemaining;
    if (elapsedTime === 0) {
        // No time elapsed yet, can't project
        return {
            teamA: gameState.score.teamA,
            teamB: gameState.score.teamB
        };
    }

    var teamARate = gameState.score.teamA / elapsedTime;
    var teamBRate = gameState.score.teamB / elapsedTime;

    // Project to end of game
    var projectedA = Math.round(teamARate * gameState.totalGameTime);
    var projectedB = Math.round(teamBRate * gameState.totalGameTime);

    return {
        teamA: projectedA,
        teamB: projectedB
    };
}

/**
 * Get score display data (for UI consumption)
 * Pure data - UI decides how to render
 * @returns {Object} Complete score state for display
 */
// DEAD CODE - SAFE TO DELETE
// Not called in current code or backup. Likely superseded by individual score calculator functions.
function getScoreDisplayData() {
    return {
        scores: {
            teamA: gameState.score.teamA,
            teamB: gameState.score.teamB
        },
        teamNames: {
            teamA: gameState.teamNames.teamA || "TEAM A",
            teamB: gameState.teamNames.teamB || "TEAM B"
        },
        leader: getLeadingTeam(),
        differential: getScoreDifferential(),
        situation: getGameSituation(),
        isBlowout: isBlowout(),
        isClose: isCloseGame(),
        isOnePossession: isOnePossessionGame(),
        comebackPossible: isComebackPossible(),
        projected: getProjectedScore(),
        timeRemaining: gameState.timeRemaining,
        shotClock: gameState.shotClock,
        currentHalf: gameState.currentHalf,
        totalGameTime: gameState.totalGameTime
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
    var gameState = stateManager.get();

    if (!gameState.scoreFlash) {
        stateManager.set("scoreFlash", {
            active: false,
            activeTeam: null,
            stopTeam: null,
            startedTick: 0,
            regainCheckEnabled: false
        }, "init_score_flash");
    }
    return gameState.scoreFlash;
}

/**
 * Start score flashing after a team scores
 */
function startScoreFlash(scoringTeam, inboundTeam, systems) {
    var state = getScoreFlashState();
    state.active = true;
    state.activeTeam = scoringTeam;
    state.stopTeam = inboundTeam;
    state.startedTick = gameState.tickCounter || 0;
    state.regainCheckEnabled = false;
}

/**
 * Stop score flashing
 */
function stopScoreFlash(teamName) {
    var state = getScoreFlashState();
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
function enableScoreFlashRegainCheck(teamName) {
    var state = getScoreFlashState();
    if (!state.active) return;
    if (!teamName || state.stopTeam === teamName) {
        state.regainCheckEnabled = true;
        if (!gameState.inbounding && state.activeTeam && gameState.currentTeam === state.activeTeam) {
            stopScoreFlash(state.activeTeam);
        }
    }
}

/**
 * Calculate game clock display data
 */
function calculateClockDisplay(gameState, systems) {
    var halfTime = Math.floor(gameState.totalGameTime / 2);
    var rawTime = (gameState.currentHalf === 1)
        ? (gameState.timeRemaining - halfTime)
        : gameState.timeRemaining;

    if (rawTime < 0) rawTime = 0;

    var mins = Math.floor(rawTime / 60);
    var secs = rawTime % 60;
    var halfLabel = gameState.currentHalf === 1 ? "1ST" : "2ND";

    return {
        minutes: mins,
        seconds: secs,
        halfLabel: halfLabel,
        shotClock: Math.max(0, gameState.shotClock),
        isShotClockUrgent: gameState.shotClock <= 5
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
function calculatePlayerDisplay(player, teamKey, gameState, offset, systems) {
    if (!player || !player.playerData) {
        return null;
    }

    var pd = player.playerData;
    var lastName = getLastName(pd.name).substring(0, 8);
    var jersey = calculateJerseyDisplay(player);
    var turbo = (typeof pd.turbo === "number") ? pd.turbo : 0;
    var fireColor = calculateFireEffect(player, gameState.tickCounter, offset);

    return {
        name: lastName,
        jersey: jersey,
        turbo: turbo,
        isOnFire: !!(pd.onFire),
        fireColor: fireColor,
        hasBall: gameState.ballCarrier === player,
        controllerLabel: pd.controllerLabel || "",
        isHuman: !!(pd.controllerIsHuman)
    };
}

/**
 * Calculate complete score display view model
 * Returns pure data structure for UI rendering
 * No Frame.js or console dependencies - testable in isolation
 */
// DEAD CODE - SAFE TO DELETE
// Not called in current code or backup. Functionality split into smaller functions.
function calculateScoreDisplay(gameState, teamBPlayer1, teamBPlayer2, teamAPlayer1, teamAPlayer2) {
    var clock = calculateClockDisplay(gameState, systems);

    var teamBName = (gameState.teamNames.teamB || "TEAM B").toUpperCase();
    var teamAName = (gameState.teamNames.teamA || "TEAM A").toUpperCase();

    var rawAbbrB = (gameState.teamAbbrs && gameState.teamAbbrs.teamB)
        ? String(gameState.teamAbbrs.teamB)
        : "TEMB";
    var rawAbbrA = (gameState.teamAbbrs && gameState.teamAbbrs.teamA)
        ? String(gameState.teamAbbrs.teamA)
        : "TEMA";

    var abbrs = resolveTeamAbbreviations(rawAbbrB, rawAbbrA);

    return {
        teamB: {
            name: teamBName,
            abbreviation: abbrs.teamB,
            score: gameState.score.teamB,
            colors: gameState.teamColors.teamB || { fg: LIGHTBLUE, bg: BG_BLACK },
            players: [
                calculatePlayerDisplay(teamBPlayer1, "teamB", gameState, 0),
                calculatePlayerDisplay(teamBPlayer2, "teamB", gameState, 3)
            ]
        },
        teamA: {
            name: teamAName,
            abbreviation: abbrs.teamA,
            score: gameState.score.teamA,
            colors: gameState.teamColors.teamA || { fg: LIGHTRED, bg: BG_BLACK },
            players: [
                calculatePlayerDisplay(teamAPlayer1, "teamA", gameState, 0),
                calculatePlayerDisplay(teamAPlayer2, "teamA", gameState, 3)
            ]
        },
        clock: clock,
        flashState: getScoreFlashState()
    };
}

/**
 * Determine which team is leading and by how much
 */
// DEAD CODE - SAFE TO DELETE
// Not called in current code or backup. Replaced by getLeadingTeam() and getScoreDifferential().
function determineLeadingTeam(gameState) {
    var diff = gameState.score.teamA - gameState.score.teamB;

    if (diff > 0) {
        return { leader: "teamA", margin: diff };
    } else if (diff < 0) {
        return { leader: "teamB", margin: Math.abs(diff) };
    } else {
        return { leader: null, margin: 0 };
    }
}
