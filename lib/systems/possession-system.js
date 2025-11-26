/**
 * NBA JAM - Possession System
 * Wave 23: Testable possession management with explicit dependencies
 * 
 * Responsibilities:
 * - Switch possession between teams
 * - Setup inbound plays after scoring
 * - Assign defensive matchups
 * - Clear possession-related state
 * - Emit possession events
 * 
 * NO direct access to globals - all dependencies injected
 */

/**
 * Create possession system with explicit dependencies
 * 
 * @param {Object} deps - Dependency object
 * @param {Object} deps.state - State manager for gameState access
 * @param {Object} deps.events - Event bus for communication
 * @param {Object} deps.rules - Game rules (COURT_WIDTH, COURT_HEIGHT, etc.)
 * @param {Object} deps.helpers - Helper functions (getPlayerTeamName, getAllPlayers, etc.)
 * @returns {Object} Possession system API
 */
function createPossessionSystem(deps) {
    // Validate dependencies
    if (!deps || !deps.state || !deps.events || !deps.rules || !deps.helpers) {
        throw new Error("PossessionSystem requires state, events, rules, and helpers");
    }

    var state = deps.state;
    var events = deps.events;
    var rules = deps.rules;
    var helpers = deps.helpers;

    /**
     * Switch possession to the other team
     * Called on: turnovers, steals, out of bounds, etc.
     * 
     * @param {string} reason - Why possession changed (turnover, steal, out_of_bounds, etc.)
     */
    function switchPossession(reason) {
        var currentTeam = state.get("currentTeam");
        var newTeam = currentTeam === "teamA" ? "teamB" : "teamA";
        var ballCarrier = state.get("ballCarrier");

        // Check if ball carrier is already on the new team (from successful pass)
        var carrierTeam = ballCarrier ? helpers.getPlayerTeamName(ballCarrier) : null;
        var shouldPreserveCarrier = carrierTeam === newTeam;

        // Get team players
        var newTeamPlayers = helpers.getTeamPlayers(newTeam);
        var newPlayer1 = newTeamPlayers[0];
        var newPlayer2 = newTeamPlayers[1];

        // Clear possession-related state
        state.set("reboundActive", false, "possession_switch");
        state.set("shotClock", 24, "possession_switch");

        // Switch team
        state.set("currentTeam", newTeam, "possession_switch");

        // Set ball carrier (preserve if already on correct team, else default to player1)
        if (!shouldPreserveCarrier) {
            state.set("ballCarrier", newPlayer1, "possession_switch");
        }

        // Position players for inbound (if not preserving carrier from pass)
        if (!shouldPreserveCarrier && newPlayer1 && newPlayer2) {
            var inboundX = newTeam === "teamA" ? 18 : 58;
            if (newPlayer1.moveTo) newPlayer1.moveTo(inboundX, 9);
            if (newPlayer2.moveTo) newPlayer2.moveTo(inboundX, 12);
        }

        // Update ball handler tracking
        var finalCarrier = state.get("ballCarrier");
        if (finalCarrier) {
            state.set("ballHandlerLastX", finalCarrier.x, "possession_switch");
            state.set("ballHandlerLastY", finalCarrier.y, "possession_switch");
            state.set("ballHandlerFrontcourtStartX", finalCarrier.x, "possession_switch");
            state.set("ballHandlerProgressOwner", finalCarrier, "possession_switch");
            if (finalCarrier.playerData) {
                finalCarrier.playerData.hasDribble = true;
            }
        }

        // Reset player-specific state
        var allPlayers = helpers.getAllPlayers();
        if (allPlayers) {
            for (var i = 0; i < allPlayers.length; i++) {
                if (allPlayers[i] && allPlayers[i].playerData) {
                    allPlayers[i].playerData.shakeUsedThisPossession = false;
                }
            }
        }

        // Emit event
        events.emit("possession_change", {
            previousTeam: currentTeam,
            newTeam: newTeam,
            reason: reason,
            ballCarrier: finalCarrier,
            preserved: shouldPreserveCarrier
        });
    }

    /**
     * Setup inbound play after a made basket
     * 
     * @param {string} scoringTeam - Team that scored (NOT the inbounding team)
     * @param {string} reason - Why setting up inbound (score, out_of_bounds, etc.)
     */
    function setupInbound(scoringTeam, reason) {
        var inboundReason = reason || "score";

        // Team that got scored ON inbounds the ball
        var inboundTeam = scoringTeam === "teamA" ? "teamB" : "teamA";

        if (typeof debugLog === "function") {
            debugLog("[SETUP INBOUND] scoringTeam=" + scoringTeam + ", inboundTeam=" + inboundTeam +
                ", SETTING currentTeam to " + inboundTeam);
        }

        // Clear state
        state.set("reboundActive", false, "inbound_setup");
        state.set("inbounding", true, "inbound_setup");
        state.set("currentTeam", inboundTeam, "inbound_setup");

        if (typeof debugLog === "function") {
            var verify = state.get("currentTeam");
            debugLog("[SETUP INBOUND] After set, currentTeam is now: " + verify);
        }

        // Get inbound alternation index
        var inboundAltIndex = state.get("inboundAlternateIndex") || { teamA: 0, teamB: 0 };
        var inboundIndex = inboundAltIndex[inboundTeam] || 0;
        if (inboundIndex !== 0 && inboundIndex !== 1) inboundIndex = 0;

        // Get team sprites
        var teamPlayers = helpers.getTeamPlayers(inboundTeam);
        var inbounder = teamPlayers[inboundIndex] || teamPlayers[0];
        var receiverIndex = teamPlayers.length > 1 ? ((inbounder === teamPlayers[0]) ? 1 : 0) : 0;
        var receiver = teamPlayers[receiverIndex] || inbounder;

        var overrideStateKey = null;
        var override = null;
        var overrideSources = ["secondHalfPositioningOverride", "overtimePositioningOverride"];
        for (var o = 0; o < overrideSources.length; o++) {
            var candidate = state.get(overrideSources[o]);
            if (!candidate) continue;
            if (candidate.inboundTeam !== inboundTeam) continue;
            if (candidate.consumed) continue;
            override = candidate;
            overrideStateKey = candidate.stateKey || overrideSources[o];
            break;
        }
        var useOverride = !!override;
        if (useOverride) {
            inbounder = override.inbounder || inbounder;
            receiver = override.receiver || receiver;
        }

        // Calculate target positions (don't move yet - will animate in handleInboundSetup)
        var attackDir = inboundTeam === "teamA" ? 1 : -1;
        var midX = Math.floor(rules.COURT_WIDTH / 2);

        // Wave 23D: Position inbounder in backcourt near their baseline
        // attackDir determines which side: teamA attacks right (+1), teamB attacks left (-1)
        // Position inbounder closer to their own baseline (behind midcourt)
        var backcourtOffset = 30; // Deep in backcourt, near baseline
        var inboundX = _clamp(midX - attackDir * backcourtOffset, 0, rules.COURT_WIDTH - 1);
        // Place inbounder along the bottom baseline so the full sprite stays visible in-frame
        var inbounderHeight = 4;
        if (inbounder && inbounder.ini && typeof inbounder.ini.height === "number") {
            inbounderHeight = inbounder.ini.height;
        } else if (inbounder && inbounder.frame && typeof inbounder.frame.height === "number") {
            inbounderHeight = inbounder.frame.height;
        }
        var inboundY = Math.max(0, rules.COURT_HEIGHT - inbounderHeight);

        // Wave 23D: Calculate receiver position in backcourt, also pushed back near baseline
        var receiverBackcourtOffset = 22; // Also deep in backcourt, slightly closer to midcourt than inbounder
        var receiverX = _clamp(midX - attackDir * receiverBackcourtOffset, 0, rules.COURT_WIDTH - 1);
        var midY = Math.floor(rules.COURT_HEIGHT / 2); // Center of court vertically
        var receiverY = midY; // Centered on vertical axis

        // WAVE 24 FLICKER FIX: Force client position reset
        if (inbounder) inbounder.forcePos = true;
        if (receiver) receiver.forcePos = true;

        // Store positioning data for handleInboundSetup to animate
        var positioning;
        if (useOverride) {
            positioning = state.get("inboundPositioning") || {};
            if (!positioning.inbounder || !positioning.receiver) {
                positioning.inbounder = { sprite: inbounder, targetX: inboundX, targetY: inboundY };
                positioning.receiver = { sprite: receiver, targetX: receiverX, targetY: receiverY };
            }
            positioning.inbounder.sprite = inbounder;
            if (typeof positioning.inbounder.targetX !== "number") positioning.inbounder.targetX = inboundX;
            if (typeof positioning.inbounder.targetY !== "number") positioning.inbounder.targetY = inboundY;
            positioning.inbounder.startX = inbounder ? inbounder.x : positioning.inbounder.targetX;
            positioning.inbounder.startY = inbounder ? inbounder.y : positioning.inbounder.targetY;
            positioning.receiver.sprite = receiver;
            if (typeof positioning.receiver.targetX !== "number") positioning.receiver.targetX = receiverX;
            if (typeof positioning.receiver.targetY !== "number") positioning.receiver.targetY = receiverY;
            positioning.receiver.startX = receiver ? receiver.x : positioning.receiver.targetX;
            positioning.receiver.startY = receiver ? receiver.y : positioning.receiver.targetY;
        } else {
            positioning = {
                inbounder: { sprite: inbounder, targetX: inboundX, targetY: inboundY, startX: inbounder ? inbounder.x : inboundX, startY: inbounder ? inbounder.y : inboundY },
                receiver: { sprite: receiver, targetX: receiverX, targetY: receiverY, startX: receiver ? receiver.x : receiverX, startY: receiver ? receiver.y : receiverY }
            };
        }
        state.set("inboundPositioning", positioning, useOverride ? "second_half_inbound_setup" : "inbound_setup");

        // Set inbound passer for tracking, but DON'T set ballCarrier yet
        // Ball carrier should remain null until the inbound pass completes
        // This prevents the inbounder from shooting/passing during setup
        state.set("inboundPasser", inbounder, "inbound_setup");
        // CRITICAL FIX: Do NOT set ballCarrier here - it stays null until pass completes
        // state.set("ballCarrier", inbounder, "inbound_setup");  // REMOVED - caused double possession bug
        if (inbounder && inbounder.playerData) {
            inbounder.playerData.hasDribble = false;  // Changed to false - no ball yet
        }

        // Ensure court repaints once inbound positioning completes
        state.set("courtNeedsRedraw", true, "inbound_setup_redraw");

        // Reset ball handler tracking
        if (inbounder) {
            state.set("ballHandlerLastX", inbounder.x, "inbound_setup");
            state.set("ballHandlerLastY", inbounder.y, "inbound_setup");
            state.set("ballHandlerFrontcourtStartX", inbounder.x, "inbound_setup");
            state.set("ballHandlerProgressOwner", inbounder, "inbound_setup");
        }

        // Toggle inbounder for next possession
        inboundAltIndex[inboundTeam] = (inboundIndex === 0) ? 1 : 0;
        state.set("inboundAlternateIndex", inboundAltIndex, "inbound_setup");

        if (useOverride) {
            var consumedReason = override.consumedReason || (overrideStateKey === "overtimePositioningOverride" ? "overtime_positioning_consumed" : "second_half_positioning_consumed");
            var clearedReason = override.clearedReason || (overrideStateKey === "overtimePositioningOverride" ? "overtime_positioning_cleared" : "second_half_positioning_cleared");
            var sourceReason = override.reason || (overrideStateKey === "overtimePositioningOverride" ? "overtime_start" : "second_half_start");

            override.consumed = true;
            override.lastReason = inboundReason;
            state.set(overrideStateKey, override, consumedReason);
            if (inboundReason !== sourceReason) {
                state.set(overrideStateKey, null, clearedReason);
            }
        }

        // Emit event
        events.emit("inbound_setup", {
            inboundTeam: inboundTeam,
            scoringTeam: scoringTeam,
            reason: inboundReason,
            inbounder: inbounder,
            receiver: receiver
        });
    }

    /**
     * Assign defensive matchups
     * Each defender assigned to guard specific offensive player
     */
    function assignDefensiveMatchups() {
        var currentTeam = state.get("currentTeam");
        var offensePlayers = helpers.getTeamPlayers(currentTeam);
        var defensePlayers = helpers.getTeamPlayers(currentTeam === "teamA" ? "teamB" : "teamA");

        if (!offensePlayers || !defensePlayers) return;

        // Simple 1-1 matchup assignment
        for (var i = 0; i < Math.min(offensePlayers.length, defensePlayers.length); i++) {
            var defender = defensePlayers[i];
            var offender = offensePlayers[i];
            if (defender && offender) {
                defender.defensiveTarget = offender;
            }
        }

        events.emit("defensive_matchups_assigned", {
            currentTeam: currentTeam,
            offensePlayers: offensePlayers.length,
            defensePlayers: defensePlayers.length
        });
    }

    // Helper: Clamp value to range
    function _clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    // Public API
    return {
        switchPossession: switchPossession,
        setupInbound: setupInbound,
        assignDefensiveMatchups: assignDefensiveMatchups
    };
}

// Export for tests
if (typeof module !== "undefined" && module.exports) {
    module.exports = { createPossessionSystem: createPossessionSystem };
}
