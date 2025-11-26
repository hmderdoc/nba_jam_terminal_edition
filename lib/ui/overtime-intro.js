// overtime-intro.js - Overtime transition overlay rendering (Wave 24)

function getOvertimeHeading(overtimeNumber) {
    if (overtimeNumber === 1) return "OVERTIME";
    if (overtimeNumber === 2) return "DOUBLE OVERTIME";
    if (overtimeNumber === 3) return "TRIPLE OVERTIME";
    return overtimeNumber + "X OVERTIME";
}

function resolveTeamLabel(teamKey, stateManager) {
    if (!teamKey || !stateManager) return "TEAM";
    var teamNames = stateManager.get("teamNames") || {};
    var raw = teamNames[teamKey];
    if (typeof raw === "string" && raw.trim().length > 0) {
        return raw.trim();
    }
    return teamKey.toUpperCase();
}

function renderOvertimeIntro(systems, context) {
    if (!systems || !systems.stateManager || !courtFrame || !courtFrame.is_open) {
        return;
    }

    var stateManager = systems.stateManager;
    var overtimeNumber = (context && typeof context.overtimeNumber === "number")
        ? context.overtimeNumber
        : (stateManager.get("currentOvertimePeriod") || 1);
    if (overtimeNumber < 1) overtimeNumber = 1;

    var inboundTeamKey = (context && context.inboundTeam) || stateManager.get("pendingOvertimeInboundTeam") || stateManager.get("currentTeam") || "teamA";
    var alternateTeamKey = (context && context.alternateTeam) || (inboundTeamKey === "teamA" ? "teamB" : "teamA");

    var heading = getOvertimeHeading(overtimeNumber);
    var inboundTeamName = resolveTeamLabel(inboundTeamKey, stateManager);
    var alternateTeamName = resolveTeamLabel(alternateTeamKey, stateManager);
    var score = stateManager.get("score") || { teamA: 0, teamB: 0 };
    var teamNames = stateManager.get("teamNames") || {};
    var countdownSeconds = stateManager.get("overtimeIntroRemainingSeconds");
    var countdownText = (typeof countdownSeconds === "number" && countdownSeconds > 0)
        ? ("Tip-off in " + countdownSeconds + "...")
        : "Get ready!";

    courtFrame.clear();
    courtFrame.gotoxy(1, 1);
    courtFrame.center("\r\n\r\n");
    courtFrame.center("\1h\1y " + heading + " \1n\r\n\r\n");
    courtFrame.center("Possession: \1h" + inboundTeamName.toUpperCase() + "\1n\r\n");
    courtFrame.center(countdownText + "\r\n\r\n");
    courtFrame.center((teamNames.teamA || "TEAM A") + " " + score.teamA + "  -  " + (teamNames.teamB || "TEAM B") + " " + score.teamB + "\r\n\r\n");
    courtFrame.center("Next up: " + alternateTeamName.toUpperCase() + " on defense\r\n");

    if (typeof cycleFrame === "function") {
        cycleFrame(courtFrame);
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        renderOvertimeIntro: renderOvertimeIntro
    };
}
