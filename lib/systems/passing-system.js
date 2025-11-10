// Passing System - Testable Architecture
// Wave 23: System Migration
//
// This module encapsulates all passing logic with explicit dependencies.
// All state reads/writes go through injected dependencies.
// All side effects (events, animations) go through injected services.

/**
 * Creates a passing system with explicit dependencies
 * 
 * @param {Object} deps - Dependencies object
 * @param {Object} deps.state - State manager (read gameState through this)
 * @param {Object} deps.animations - Animation system
 * @param {Object} deps.events - Event bus
 * @param {Object} deps.rules - Game rules/balance config
 * @param {Object} deps.helpers - Helper functions (getPlayerTeamName, etc)
 * @returns {Object} Passing system API
 */
function createPassingSystem(deps) {
    // Validate dependencies
    if (!deps || !deps.state || !deps.animations || !deps.events || !deps.rules || !deps.helpers) {
        throw new Error("PassingSystem: Missing required dependencies");
    }

    // Private helper: Get player's team name
    function _getPlayerTeam(player) {
        if (deps.helpers.getPlayerTeamName) {
            return deps.helpers.getPlayerTeamName(player);
        }
        // Fallback: determine from sprite key
        if (player && player.constructor && player.constructor.name) {
            return player.constructor.name.indexOf('teamA') >= 0 ? 'teamA' : 'teamB';
        }
        return null;
    }

    // Private helper: Get opposing team
    function _getOpposingTeam(player) {
        var team = _getPlayerTeam(player);
        return team === 'teamA' ? 'teamB' : 'teamA';
    }

    // Private helper: Calculate pass timing
    function _calculatePassTiming(startX, startY, endX, endY) {
        var dx = endX - startX;
        var dy = endY - startY;
        var distance = Math.sqrt(dx * dx + dy * dy);
        var steps = Math.max(10, Math.round(distance * 0.8));
        var totalTime = 300 + (distance * 10);
        var msPerStep = Math.max(30, Math.round(totalTime / steps));  // Wave 23D: Slowed from 15ms to 30ms for readability
        return {
            steps: steps,
            msPerStep: msPerStep,
            durationMs: steps * msPerStep,
            distance: distance
        };
    }

    // Private helper: Check if receiver is in bounds
    function _isInBounds(player) {
        if (!player) return false;
        // Get court dimensions from rules
        var COURT_WIDTH = deps.rules.COURT_WIDTH || 80;
        var COURT_HEIGHT = deps.rules.COURT_HEIGHT || 40;
        return (player.x >= 2 && player.x <= COURT_WIDTH - 7 &&
            player.y >= 2 && player.y <= COURT_HEIGHT - 5);
    }


    // Private helper: Check for pass interception
    function _checkInterception(passer, receiver, targetPoint) {
        // Use legacy checkPassInterception if available
        if (typeof checkPassInterception === 'function') {
            return checkPassInterception(passer, receiver, targetPoint);
        }

        // Fallback: no interception (for testing without full game context)
        return null;
    }
    /**
 * PUBLIC API: Attempt a pass from passer to receiver
 * 
 * @param {Object} passer - Player passing the ball
 * @param {Object} receiver - Player receiving the ball
 * @param {Object} options - Pass options
 * @param {Object} options.leadTarget - Lead pass target position
 * @param {Object} options.inboundContext - Inbound-specific data
 * @returns {Object} Result object with success/failure info
 */
    function attemptPass(passer, receiver, options) {
        options = options || {};

        // Validation
        if (!passer || !receiver) {
            return { success: false, reason: 'invalid_players' };
        }

        // CRITICAL: Don't allow passes while ball is already in flight (shot/pass/dunk animation)
        // This prevents the nonsensical situation where a player dunks and passes simultaneously
        if (deps.animations && typeof deps.animations.isBallAnimating === "function" && deps.animations.isBallAnimating()) {
            if (typeof debugLog === "function") {
                debugLog("[PASS BLOCKED] Cannot pass while ball is animating (shot/pass/dunk in progress)");
            }
            return { success: false, reason: 'ball_animating' };
        }

        if (!_isInBounds(receiver)) {
            // Out of bounds - turnover
            var opposingTeam = _getOpposingTeam(passer);

            // Emit events
            deps.events.emit('turnover', {
                type: 'pass_oob',
                player: passer,
                team: _getPlayerTeam(passer)
            });

            deps.events.emit('possession_change', {
                from: _getPlayerTeam(passer),
                to: opposingTeam,
                reason: 'pass_oob'
            });

            // Update state
            deps.state.set('currentTeam', opposingTeam, 'pass_oob');
            deps.state.set('ballCarrier', null, 'pass_oob');
            deps.state.set('inbounding', true, 'pass_oob');

            if (typeof debugLog === "function") {
                debugLog("[PASS OOB] Pass went out of bounds, ballCarrier=null, inbounding=true, opposingTeam=" + opposingTeam);
            }

            return {
                success: false,
                reason: 'out_of_bounds',
                newTeam: opposingTeam
            };
        }

        // Calculate pass details
        var startX = passer.x + 2;
        var startY = passer.y + 2;
        var targetPoint = options.leadTarget ? {
            x: Math.round(options.leadTarget.x),
            y: Math.round(options.leadTarget.y)
        } : null;
        var endX = (targetPoint ? targetPoint.x : receiver.x) + 2;
        var endY = (targetPoint ? targetPoint.y : receiver.y) + 2;

        // Check for interception
        var interceptor = _checkInterception(passer, receiver, targetPoint);

        // Determine outcome
        var outcome = {
            passer: passer,
            receiver: interceptor || receiver,
            intercepted: !!interceptor,
            team: interceptor ? _getOpposingTeam(passer) : _getPlayerTeam(passer),
            targetPoint: targetPoint,
            inboundContext: options.inboundContext,
            // Store names for debugging in case sprite references become invalid
            passerName: passer.playerData ? passer.playerData.name : "unknown",
            receiverName: (interceptor || receiver).playerData ? (interceptor || receiver).playerData.name : "unknown"
        };

        // Queue animation with callback for state mutations
        var timing = _calculatePassTiming(startX, startY, endX, endY);

        deps.animations.queuePassAnimation(
            startX, startY, endX, endY,
            outcome, // stateData
            timing.durationMs,
            function (stateData) {
                // Animation complete - apply state mutations
                _handlePassComplete(stateData);
            }
        );

        return {
            success: true,
            outcome: outcome,
            timing: timing
        };
    }

    /**
     * Private: Handle pass completion (called by animation callback)
     */
    function _handlePassComplete(stateData) {
        // DIAGNOSTIC: Log pass completion details
        if (typeof debugLog === "function") {
            debugLog("[PASS COMPLETE] Callback invoked - " +
                "receiver=" + (stateData.receiver ? (stateData.receiver.playerData ? stateData.receiver.playerData.name : "has-no-playerData") : "NULL") +
                ", receiverName=" + (stateData.receiverName || "unknown") +
                ", passer=" + (stateData.passer ? (stateData.passer.playerData ? stateData.passer.playerData.name : "has-no-playerData") : "NULL") +
                ", passerName=" + (stateData.passerName || "unknown") +
                ", intercepted=" + stateData.intercepted +
                ", team=" + stateData.team);
        }

        // Clear rebound state
        deps.state.set('reboundActive', false, 'pass_complete');

        if (stateData.intercepted && stateData.receiver) {
            // INTERCEPTION
            var interceptorTeam = _getPlayerTeam(stateData.receiver);

            // Update possession
            deps.state.set('ballCarrier', stateData.receiver, 'interception');

            // TRACK POSSESSION CHANGE - for double possession bug detection
            if (typeof trackPossessionChange === "function") {
                trackPossessionChange(interceptorTeam, "interception", deps.systems || {});
            }
            deps.state.set('currentTeam', interceptorTeam, 'interception');
            deps.state.set('shotClock', 24, 'interception');

            if (typeof debugLog === "function") {
                debugLog("[PASS COMPLETE] INTERCEPTION - Set ballCarrier to " +
                    (stateData.receiver.playerData ? stateData.receiver.playerData.name : "unknown") +
                    ", team=" + interceptorTeam);
            }

            // Emit events
            deps.events.emit('interception', {
                interceptor: stateData.receiver,
                passer: stateData.passer,
                team: interceptorTeam
            });

            deps.events.emit('turnover', {
                type: 'steal_pass',
                player: stateData.passer,
                team: _getPlayerTeam(stateData.passer)
            });

        } else {
            // SUCCESSFUL PASS

            if (!stateData.receiver) {
                // Safety check: if no receiver, this pass shouldn't have completed
                log(LOG_ERROR, "NBA JAM: Pass completed but receiver is NULL! " +
                    "passer=" + (stateData.passerName || "unknown") +
                    ", intended receiver=" + (stateData.receiverName || "unknown") +
                    ", team=" + stateData.team +
                    ", intercepted=" + stateData.intercepted);
                deps.state.set('ballCarrier', null, 'pass_error_no_receiver');

                if (typeof debugLog === "function") {
                    debugLog("[PASS ERROR] Pass completed but receiver is NULL! This will cause loose ball freeze. " +
                        "Passer=" + (stateData.passerName || "unknown") +
                        ", IntendedReceiver=" + (stateData.receiverName || "unknown") +
                        ", Intercepted=" + stateData.intercepted);
                }
                return;
            }

            deps.state.set('ballCarrier', stateData.receiver, 'pass_complete');

            if (typeof debugLog === "function") {
                debugLog("[PASS COMPLETE] Set ballCarrier to " +
                    (stateData.receiver.playerData ? stateData.receiver.playerData.name : "unknown") +
                    ", team=" + _getPlayerTeam(stateData.receiver));
            }

            // TRACK INBOUND COMPLETION - for double possession bug detection
            if (stateData.inboundContext && typeof trackInboundComplete === "function") {
                trackInboundComplete(_getPlayerTeam(stateData.receiver), deps.systems || {});
            } else if (typeof trackPossessionChange === "function") {
                trackPossessionChange(_getPlayerTeam(stateData.receiver), "pass_complete", deps.systems || {});
            }

            // Track potential assist (unless this is an inbound pass)
            if (!stateData.inboundContext && typeof setPotentialAssist === 'function') {
                setPotentialAssist(stateData.passer, stateData.receiver, { stateManager: deps.state });
                if (typeof debugLog === "function") {
                    debugLog("[PASS COMPLETE] Tracked potential assist: " +
                        (stateData.passer.playerData ? stateData.passer.playerData.name : "unknown") +
                        " -> " +
                        (stateData.receiver.playerData ? stateData.receiver.playerData.name : "unknown"));
                }
            }

            // Handle inbound-specific logic
            if (stateData.inboundContext) {
                var ctx = stateData.inboundContext;

                // Move inbounder onto court
                if (ctx.inbounder) {
                    ctx.inbounder.x = ctx.inbounderX;
                    ctx.inbounder.y = ctx.inbounderY;
                }

                // Clear inbound state
                deps.state.set('inbounding', false, 'inbound_complete');
                deps.state.set('inboundPasser', null, 'inbound_complete');
                deps.state.set('shotClock', 24, 'inbound_complete');

                // Emit inbound complete event
                deps.events.emit('inbound_complete', {
                    team: ctx.team,
                    receiver: stateData.receiver
                });
            }

            // Emit pass complete event
            deps.events.emit('pass_complete', {
                passer: stateData.passer,
                receiver: stateData.receiver,
                team: _getPlayerTeam(stateData.receiver)
            });
        }
    }

    // Public API
    return {
        attemptPass: attemptPass,

        // Expose for testing
        _test: {
            calculatePassTiming: _calculatePassTiming,
            isInBounds: _isInBounds,
            getPlayerTeam: _getPlayerTeam,
            getOpposingTeam: _getOpposingTeam
        }
    };
}

// Example usage:
// var passingSystem = createPassingSystem({
//     state: stateManager,
//     animations: animationSystem,
//     events: eventBus,
//     rules: { COURT_WIDTH: 66, COURT_HEIGHT: 40 },
//     helpers: { getPlayerTeamName: getPlayerTeamName }
// });
// 
// var result = passingSystem.attemptPass(passer, receiver, {
//     leadTarget: { x: 20, y: 10 },
//     inboundContext: null
// });
