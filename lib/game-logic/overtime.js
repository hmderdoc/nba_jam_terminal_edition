/**
 * Overtime helper (Wave 24)
 *
 * Responsibilities:
 * - Detect tied end-of-regulation states and spin up overtime periods
 * - Alternate opening possession between teams without replaying the jump ball
 * - Reset clocks, state flags, and positioning via existing inbound helpers
 */

function maybeStartOvertime(systems) {
    if (!systems || !systems.stateManager) return false;

    var stateManager = systems.stateManager;
    var score = stateManager.get("score") || { teamA: 0, teamB: 0 };
    var teamAScore = typeof score.teamA === "number" ? score.teamA : 0;
    var teamBScore = typeof score.teamB === "number" ? score.teamB : 0;
    var timeRemaining = stateManager.get("timeRemaining");

    if (typeof timeRemaining === "number" && timeRemaining > 0) {
        return false;
    }

    if (teamAScore !== teamBScore) {
        var canForceTie = (typeof FAST_OVERTIME_AUTO_TIE_ENABLED === "boolean" && FAST_OVERTIME_AUTO_TIE_ENABLED) && !FAST_OVERTIME_TEST_HAS_TRIGGERED;
        if (canForceTie) {
            var tieScoreValue = (typeof FAST_OVERTIME_AUTO_TIE_SCORE === "number")
                ? FAST_OVERTIME_AUTO_TIE_SCORE
                : Math.max(teamAScore, teamBScore);
            var tiedScore = { teamA: tieScoreValue, teamB: tieScoreValue };
            stateManager.set("score", tiedScore, "overtime_test_auto_tie_score");
            stateManager.set("fastOvertimeOverrideUsed", true, "overtime_test_auto_tie_consumed");
            FAST_OVERTIME_TEST_HAS_TRIGGERED = true;
            teamAScore = tieScoreValue;
            teamBScore = tieScoreValue;
            if (typeof debugLog === "function") {
                debugLog("[OVERTIME TEST] Auto-tying scores inside maybeStartOvertime for fast repro. score=" + tieScoreValue);
            }
        } else {
            return false;
        }
    }

    var overtimeCount = stateManager.get("overtimeCount") || 0;
    var regulationAnchor = stateManager.get("regulationOvertimeAnchorTeam") || stateManager.get("firstHalfStartTeam") || "teamA";
    var nextPossession = stateManager.get("overtimeNextPossessionTeam");
    if (!nextPossession) {
        nextPossession = regulationAnchor;
        stateManager.set("overtimeNextPossessionTeam", nextPossession, "overtime_anchor_seed");
    }

    var overtimeSeconds = stateManager.get("overtimePeriodSeconds");
    if (typeof overtimeSeconds !== "number" || overtimeSeconds <= 0) {
        overtimeSeconds = (typeof OVERTIME_PERIOD_SECONDS === "number" && OVERTIME_PERIOD_SECONDS > 0)
            ? OVERTIME_PERIOD_SECONDS
            : Math.max(1, Math.round((typeof REGULATION_PERIOD_SECONDS === "number" ? REGULATION_PERIOD_SECONDS : 360) / 4));
        stateManager.set("overtimePeriodSeconds", overtimeSeconds, "overtime_duration_fallback");
    }

    var now = Date.now();
    var inboundTeam = nextPossession;
    var alternateTeam = inboundTeam === "teamA" ? "teamB" : "teamA";
    stateManager.set("overtimeNextPossessionTeam", alternateTeam, "overtime_rotation");

    var newCount = overtimeCount + 1;
    stateManager.set("overtimeCount", newCount, "overtime_start");
    stateManager.set("currentOvertimePeriod", newCount, "overtime_start");
    stateManager.set("isOvertime", true, "overtime_start");
    stateManager.set("timeRemaining", overtimeSeconds, "overtime_clock_reset");
    stateManager.set("shotClock", (typeof SHOT_CLOCK_DEFAULT === "number" ? SHOT_CLOCK_DEFAULT : 24), "overtime_start");
    stateManager.set("totalGameTime", (stateManager.get("totalGameTime") || 0) + overtimeSeconds, "overtime_extension");
    stateManager.set("ballCarrier", null, "overtime_start_clear_possession");
    stateManager.set("inboundPasser", null, "overtime_start_clear_possession");
    stateManager.set("frontcourtEstablished", false, "overtime_start");
    stateManager.set("courtNeedsRedraw", true, "overtime_start_redraw");
    stateManager.set("lastSecondTime", now, "overtime_clock_reset_timestamp");
    stateManager.set("lastUpdateTime", now, "overtime_clock_reset_timestamp");
    stateManager.set("pendingSecondHalfInbound", false, "overtime_start");

    if (typeof FAST_OVERTIME_TEST_HAS_TRIGGERED !== "undefined") {
        FAST_OVERTIME_TEST_HAS_TRIGGERED = true;
    }
    stateManager.set("fastOvertimeOverrideUsed", true, "overtime_start_consumed_override");

    if (typeof resetBackcourtState === "function") {
        resetBackcourtState(systems);
    }

    var introDurationMs = (typeof OVERTIME_INTRO_DISPLAY_MS === "number" && OVERTIME_INTRO_DISPLAY_MS > 0) ? OVERTIME_INTRO_DISPLAY_MS : 4000;
    var introEndsAt = now + introDurationMs;
    stateManager.set("overtimeIntroActive", true, "overtime_intro_start");
    stateManager.set("overtimeIntroEndsAt", introEndsAt, "overtime_intro_schedule");
    var initialCountdown = (typeof OVERTIME_INTRO_COUNTDOWN_SECONDS === "number" && OVERTIME_INTRO_COUNTDOWN_SECONDS >= 0)
        ? OVERTIME_INTRO_COUNTDOWN_SECONDS
        : Math.max(0, Math.ceil(introDurationMs / 1000));
    stateManager.set("overtimeIntroRemainingSeconds", initialCountdown, "overtime_intro_countdown_init");
    stateManager.set("pendingOvertimeInboundTeam", inboundTeam, "overtime_intro_pending_team");
    stateManager.set("pendingOvertimeInboundContext", {
        overtimeNumber: newCount,
        alternateTeam: alternateTeam
    }, "overtime_intro_pending_context");

    if (typeof setPhase === "function") {
        setPhase(PHASE_OVERTIME_INTRO, {
            reason: "overtime_start",
            overtimeNumber: newCount,
            inboundTeam: inboundTeam,
            alternateTeam: alternateTeam
        }, introDurationMs, null, systems);
    } else {
        stateManager.set("phase", {
            current: PHASE_OVERTIME_INTRO,
            name: PHASE_OVERTIME_INTRO,
            data: {
                reason: "overtime_start",
                overtimeNumber: newCount,
                inboundTeam: inboundTeam,
                alternateTeam: alternateTeam
            },
            frameCounter: 0,
            targetFrames: Math.max(1, Math.round(introDurationMs / 50))
        }, "overtime_intro_phase_fallback");
    }

    if (typeof announceEvent === "function") {
        var teamNames = stateManager.get("teamNames") || {};
        var inboundTeamName = teamNames[inboundTeam] || inboundTeam.toUpperCase();
        var alternateTeamName = teamNames[alternateTeam] || alternateTeam.toUpperCase();
        announceEvent("overtime_start", {
            overtimeNumber: newCount,
            inboundTeam: inboundTeam,
            inboundTeamName: inboundTeamName,
            alternateTeam: alternateTeam,
            alternateTeamName: alternateTeamName,
            team: inboundTeam
        }, systems);
    } else if (typeof announce === "function") {
        var announceColor = (typeof YELLOW !== "undefined") ? YELLOW
            : (typeof WHITE !== "undefined") ? WHITE
            : (typeof LIGHTCYAN !== "undefined") ? LIGHTCYAN
            : 7;
        announce("OVERTIME " + newCount + "!", announceColor, systems);
    }

    if (typeof debugLog === "function") {
        debugLog("[OVERTIME] Period " + newCount + " starting. inboundTeam=" + inboundTeam +
            ", alternateTeam=" + alternateTeam + ", duration=" + overtimeSeconds + "s, introMs=" + introDurationMs);
    }

    return true;
}

function finalizePendingOvertimeIntro(systems) {
    if (!systems || !systems.stateManager) return false;

    var stateManager = systems.stateManager;
    var pendingTeam = stateManager.get("pendingOvertimeInboundTeam");
    var pendingContext = stateManager.get("pendingOvertimeInboundContext") || {};

    stateManager.set("overtimeIntroActive", false, "overtime_intro_finalize");
    stateManager.set("overtimeIntroEndsAt", null, "overtime_intro_finalize");
    stateManager.set("overtimeIntroRemainingSeconds", 0, "overtime_intro_finalize");
    stateManager.set("pendingOvertimeInboundTeam", null, "overtime_intro_finalize");
    stateManager.set("pendingOvertimeInboundContext", null, "overtime_intro_finalize");

    if (!pendingTeam) {
        return false;
    }

    stateManager.set("courtNeedsRedraw", true, "overtime_intro_finalize_redraw");

    if (typeof startOvertimeInbound === "function") {
        startOvertimeInbound(systems, pendingTeam, pendingContext);
    }

    return true;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        maybeStartOvertime: maybeStartOvertime,
        finalizePendingOvertimeIntro: finalizePendingOvertimeIntro
    };
}
