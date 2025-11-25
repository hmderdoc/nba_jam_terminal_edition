/**
 * stats-tracker.js
 * 
 * Player statistics tracking and assist management.
 * Handles recording of turnovers, assist tracking, stat attribution, and stat trail overlays.
 */

var STAT_TRAIL_LABELS = {
    points: "PTS",
    rebounds: "REB",
    assists: "AST",
    steals: "STL",
    blocks: "BLK",
    turnovers: "TO"
};

function ensurePlayerStats(player) {
    if (!player || !player.playerData) return null;
    var stats = player.playerData.stats;
    if (!stats) {
        stats = {};
        player.playerData.stats = stats;
    }
    return stats;
}

function recordStatDelta(player, statKey, amount, systems, options) {
    if (!player || !player.playerData || !statKey || !amount) {
        return 0;
    }

    var stats = ensurePlayerStats(player);
    if (!stats) return 0;

    var current = (typeof stats[statKey] === "number") ? stats[statKey] : 0;
    var updated = current + amount;
    stats[statKey] = updated;

    var opts = options || {};
    var enableTrail = (typeof opts.enableTrail === "boolean") ? opts.enableTrail : STAT_TRAIL_LABELS.hasOwnProperty(statKey);

    if (enableTrail && systems && systems.statTrailSystem && typeof systems.statTrailSystem.queueStatTrail === "function") {
        var statType = (opts.statType || statKey || "").toString().toLowerCase();
        var label = opts.trailLabel || STAT_TRAIL_LABELS[statKey] || statKey.toUpperCase();
        var text;
        if (opts.trailText) {
            text = opts.trailText;
        } else {
            var prefix = amount >= 0 ? "+" : "";
            text = prefix + amount + " " + label;
        }
        if (text) {
            systems.statTrailSystem.queueStatTrail({
                text: text,
                player: player,
                teamKey: opts.teamKey || (typeof getPlayerTeamName === "function" ? getPlayerTeamName(player) : null),
                statType: statType,
                attr: opts.attr,
                fg: opts.fg,
                bg: opts.bg
            });
        }
    }

    if (typeof opts.onAfterUpdate === "function") {
        opts.onAfterUpdate(updated, stats);
    }

    return updated;
}

/**
 * Clear the current potential assist tracking
 */
function clearPotentialAssist(systems) {
    var stateManager = systems.stateManager;
    stateManager.set("potentialAssist", null, "assist_cleared");
}

/**
 * Record a turnover for a player
 * @param {Sprite} player - Player who committed the turnover
 * @param {string} reason - Optional reason/description of the turnover
 */
function recordTurnover(player, reason, systems) {
    if (!player || !player.playerData) return;
    recordStatDelta(player, "turnovers", 1, systems, {
        trailLabel: "TO"
    });
    if (reason) {
        player.playerData.lastTurnoverReason = reason;
    } else {
        player.playerData.lastTurnoverReason = null;
    }
}

/**
 * Set up a potential assist when a pass is made
 * Tracks the passer and receiver for potential assist attribution
 * @param {Sprite} passer - Player making the pass
 * @param {Sprite} receiver - Player receiving the pass
 */
function setPotentialAssist(passer, receiver, systems) {
    var stateManager = systems.stateManager;
    var inbounding = stateManager.get('inbounding');

    if (inbounding) {
        clearPotentialAssist(systems);
        return;
    }
    if (!passer || !receiver || !passer.playerData || !receiver.playerData) {
        clearPotentialAssist(systems);
        return;
    }
    stateManager.set("potentialAssist", {
        passer: passer,
        receiver: receiver,
        team: getPlayerTeamName(passer),
        timestamp: getTimeMs()
    }, "assist_tracked");
}

/**
 * Award an assist to the passer if conditions are met
 * Called when a player scores - checks if there was a recent pass
 * @param {Sprite} scorer - Player who scored
 */
function maybeAwardAssist(scorer, systems) {
    var stateManager = systems.stateManager;
    var potential = stateManager.get('potentialAssist');
    if (!potential || !potential.passer || !potential.receiver) return;
    if (!scorer) return;
    if (potential.receiver !== scorer) return;
    if (potential.passer === scorer) return;

    var passerData = potential.passer.playerData;
    if (!passerData) return;

    var scorerTeam = getPlayerTeamName(scorer);
    if (!scorerTeam || potential.team !== scorerTeam) return;

    var now = getTimeMs();
    if (potential.timestamp && now && now - potential.timestamp > 6000) return;

    recordStatDelta(potential.passer, "assists", 1, systems);
}
