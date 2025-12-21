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

    var helpers = deps.helpers || {};
    var rules = deps.rules || {};
    var courtWidth = (typeof rules.COURT_WIDTH === "number") ? rules.COURT_WIDTH : 80;
    var courtHeight = (typeof rules.COURT_HEIGHT === "number") ? rules.COURT_HEIGHT : 40;
    var injectedPlayerBounds = rules.PLAYER_BOUNDARIES || null;
    var passAutoClampTolerance = getBoundValue("passAutoClampTolerance", 0);

    function getBoundValue(key, fallback) {
        if (injectedPlayerBounds && typeof injectedPlayerBounds[key] === "number") {
            return injectedPlayerBounds[key];
        }
        return fallback;
    }

    // Private helper: Get player's team name
    function _getPlayerTeam(player) {
        if (helpers.getPlayerTeamName) {
            return helpers.getPlayerTeamName(player);
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
        var minX = getBoundValue("minX", 2);
        var minY = getBoundValue("minY", 2);
        var maxX = courtWidth - getBoundValue("movementMaxXOffset", 7);
        var maxY = courtHeight - getBoundValue("maxYOffset", 5);
        return (player.x >= minX && player.x <= maxX &&
            player.y >= minY && player.y <= maxY);
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
    var stateManager = deps.state;
    var animationSystem = deps.animations;
    var PASS_QUEUE_TIMEOUT_MS = 1500;
    var systemsRef = deps.systems || {};
    if (!systemsRef.stateManager) {
        systemsRef.stateManager = stateManager;
    }
    if (!systemsRef.animationSystem && animationSystem) {
        systemsRef.animationSystem = animationSystem;
    }

    function _getPlayerName(sprite) {
        if (!sprite) return "unknown";
        if (sprite.playerData && sprite.playerData.name) return sprite.playerData.name;
        if (sprite.team) return sprite.team + " player";
        return "unknown";
    }

    function _clampPointToBounds(x, y) {
        var minX = getBoundValue("minX", 2);
        var minY = getBoundValue("minY", 2);
        var maxX = courtWidth - getBoundValue("movementMaxXOffset", 7);
        var maxY = courtHeight - getBoundValue("maxYOffset", 5);
        return {
            x: Math.max(minX, Math.min(maxX, Math.round(x))),
            y: Math.max(minY, Math.min(maxY, Math.round(y)))
        };
    }

    function _sanitizeLeadTarget(target) {
        if (!target) return null;
        var clamped = _clampPointToBounds(target.x, target.y);
        return {
            x: clamped.x,
            y: clamped.y
        };
    }

    function _autoClampReceiver(receiver) {
        if (!receiver) return false;

        var minX = getBoundValue("minX", 2);
        var minY = getBoundValue("minY", 2);
        var maxX = courtWidth - getBoundValue("movementMaxXOffset", 7);
        var maxY = courtHeight - getBoundValue("maxYOffset", 5);

        var clampedX = Math.max(minX, Math.min(maxX, receiver.x));
        var clampedY = Math.max(minY, Math.min(maxY, receiver.y));

        var deltaX = Math.abs(clampedX - receiver.x);
        var deltaY = Math.abs(clampedY - receiver.y);

        if (deltaX === 0 && deltaY === 0) {
            return false;
        }

        if (deltaX > passAutoClampTolerance || deltaY > passAutoClampTolerance) {
            return false;
        }

        if (helpers.clampSpriteFeetToCourt && typeof helpers.clampSpriteFeetToCourt === "function") {
            helpers.clampSpriteFeetToCourt(receiver);
        } else {
            receiver.x = clampedX;
            receiver.y = clampedY;
        }

        return true;
    }

    function _queuePassIntent(passer, receiver, options, existingIntent) {
        if (!stateManager || typeof stateManager.set !== "function") return;

        var sanitizedLead = _sanitizeLeadTarget(options.leadTarget);
        var attempts = 1;

        if (existingIntent && existingIntent.passer === passer && existingIntent.receiver === receiver) {
            attempts = (existingIntent.attempts || 1) + 1;
        }

        stateManager.set('queuedPassIntent', {
            passer: passer,
            receiver: receiver,
            leadTarget: sanitizedLead,
            inboundContext: options.inboundContext || null,
            queuedAt: Date.now(),
            attempts: attempts
        }, 'pass_queue_add');

        if (typeof debugLog === "function") {
            debugLog("[PASS QUEUED] Ball animating; queued pass from " + _getPlayerName(passer) + " to " + _getPlayerName(receiver) +
                " (attempt " + attempts + ")");
        }
    }

    function _attemptPassInternal(passer, receiver, options, isRetry) {
        options = options || {};

        if (!passer || !receiver) {
            return { success: false, reason: 'invalid_players' };
        }

        if (options && options.leadTarget) {
            var originalLead = options.leadTarget;
            var sanitizedLeadTarget = _sanitizeLeadTarget(originalLead);
            if (sanitizedLeadTarget && (sanitizedLeadTarget.x !== originalLead.x || sanitizedLeadTarget.y !== originalLead.y)) {
                options.leadTarget = sanitizedLeadTarget;
                if (typeof debugLog === "function") {
                    debugLog("[PASS TARGET] Clamped lead target to x=" + sanitizedLeadTarget.x + ", y=" + sanitizedLeadTarget.y);
                }
            }
        }

        var animations = animationSystem;
        if (!isRetry && animations && typeof animations.isBallAnimating === "function" && animations.isBallAnimating()) {
            var ballCarrier = stateManager && stateManager.get ? stateManager.get('ballCarrier') : null;
            if (ballCarrier === passer) {
                var existingIntent = stateManager && stateManager.get ? stateManager.get('queuedPassIntent') : null;
                _queuePassIntent(passer, receiver, options, existingIntent);
                return { success: false, reason: 'ball_animating', queued: true };
            }

            if (typeof debugLog === "function") {
                debugLog("[PASS BLOCKED] Cannot pass while ball is animating (shot/pass/dunk in progress)");
            }
            return { success: false, reason: 'ball_animating' };
        }

        if (!_isInBounds(receiver)) {
            var originalX = receiver && typeof receiver.x === "number" ? receiver.x : null;
            var originalY = receiver && typeof receiver.y === "number" ? receiver.y : null;

            var clamped = _autoClampReceiver(receiver);
            if (clamped && _isInBounds(receiver)) {
                if (typeof debugLog === "function") {
                    debugLog("[PASS TARGET] Receiver auto-clamped from x=" + originalX + ", y=" + originalY + " to x=" + receiver.x + ", y=" + receiver.y);
                }
            } else {
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
        var interceptResult = _checkInterception(passer, receiver, targetPoint);
        var interceptor = null;
        var interceptPoint = null;

        if (interceptResult) {
            if (interceptResult.defender) {
                interceptor = interceptResult.defender;
                if (typeof interceptResult.interceptX === "number" && typeof interceptResult.interceptY === "number") {
                    interceptPoint = {
                        x: interceptResult.interceptX,
                        y: interceptResult.interceptY
                    };
                }
            } else {
                interceptor = interceptResult;
            }
        }

        var animEndX = endX;
        var animEndY = endY;

        if (interceptor && interceptPoint) {
            animEndX = interceptPoint.x;
            animEndY = interceptPoint.y;
        } else if (interceptor) {
            animEndX = interceptor.x + 2;
            animEndY = interceptor.y + 2;
        }

        animEndX = Math.max(1, Math.min(courtWidth, Math.round(animEndX)));
        animEndY = Math.max(1, Math.min(courtHeight, Math.round(animEndY)));

        // Determine outcome
        var outcome = {
            passer: passer,
            receiver: interceptor || receiver,
            intercepted: !!interceptor,
            team: interceptor ? _getOpposingTeam(passer) : _getPlayerTeam(passer),
            targetPoint: targetPoint,
            inboundContext: options.inboundContext,
            interceptor: interceptor || null,
            interceptX: interceptor ? animEndX : null,
            interceptY: interceptor ? animEndY : null,
            // Store names for debugging in case sprite references become invalid
            passerName: passer.playerData ? passer.playerData.name : "unknown",
            receiverName: (interceptor || receiver).playerData ? (interceptor || receiver).playerData.name : "unknown"
        };

        // Queue animation with callback for state mutations
        var timing = _calculatePassTiming(startX, startY, animEndX, animEndY);

        deps.animations.queuePassAnimation(
            startX, startY, animEndX, animEndY,
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

    function processQueuedPass() {
        if (!stateManager || typeof stateManager.get !== "function") {
            return null;
        }

        var intent = stateManager.get('queuedPassIntent');
        if (!intent) {
            return null;
        }

        if (animationSystem && typeof animationSystem.isBallAnimating === "function" && animationSystem.isBallAnimating()) {
            return 'waiting';
        }

        var phaseState = stateManager.get('phase');
        var phaseName = null;
        if (phaseState && typeof phaseState === 'object') {
            phaseName = phaseState.current || phaseState.name || null;
        }
        var shotInProgress = stateManager.get('shotInProgress');
        var shouldDefer = false;
        if (phaseName && phaseName !== 'NORMAL') {
            shouldDefer = true;
        }
        if (!shouldDefer && shotInProgress) {
            shouldDefer = true;
        }

        if (shouldDefer) {
            if (typeof debugLog === 'function') {
                debugLog("[PASS QUEUE] Holding queued pass while phase=" + (phaseName || 'unknown') + ", shotInProgress=" + (!!shotInProgress));
            }
            return 'waiting';
        }

        var ballCarrier = stateManager.get('ballCarrier');
        if (!intent.passer || ballCarrier !== intent.passer) {
            stateManager.set('queuedPassIntent', null, 'pass_queue_cancelled');
            if (typeof debugLog === "function") {
                debugLog("[PASS QUEUE] Cancelled queued pass; ball carrier changed before execution");
            }
            return 'cancelled';
        }

        if (intent.queuedAt && (Date.now() - intent.queuedAt) > PASS_QUEUE_TIMEOUT_MS) {
            stateManager.set('queuedPassIntent', null, 'pass_queue_timeout');
            if (typeof debugLog === "function") {
                debugLog("[PASS QUEUE] Dropped queued pass after timeout");
            }
            return 'timeout';
        }

        stateManager.set('queuedPassIntent', null, 'pass_queue_execute');

        if (typeof debugLog === "function") {
            debugLog("[PASS QUEUE] Executing queued pass now that ball is free");
        }

        return _attemptPassInternal(intent.passer, intent.receiver, {
            leadTarget: intent.leadTarget,
            inboundContext: intent.inboundContext
        }, true);
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
        return _attemptPassInternal(passer, receiver, options, false);
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
            var interceptor = stateData.receiver;
            var interceptorTeam = _getPlayerTeam(interceptor);
            var passerTeam = _getPlayerTeam(stateData.passer);
            var opponentTeam = interceptorTeam === "teamA" ? "teamB" : "teamA";

            // Update possession + state
            stateManager.set('ballCarrier', interceptor, 'interception');
            if (typeof trackPossessionChange === "function" && deps.systems) {
                trackPossessionChange(interceptorTeam, "interception", deps.systems);
            }
            stateManager.set('currentTeam', interceptorTeam, 'interception');
            stateManager.set('shotClock', 24, 'interception');
            stateManager.set('reboundActive', false, 'interception');

            if (helpers.resetBackcourtState) {
                helpers.resetBackcourtState(systemsRef);
            } else if (typeof resetBackcourtState === "function") {
                resetBackcourtState(systemsRef);
            }

            var interceptX = (interceptor && typeof interceptor.x === "number") ? interceptor.x : 0;
            var interceptY = (interceptor && typeof interceptor.y === "number") ? interceptor.y : 0;
            stateManager.set('ballHandlerStuckTimer', 0, 'interception');
            stateManager.set('ballHandlerAdvanceTimer', 0, 'interception');
            stateManager.set('ballHandlerLastX', interceptX, 'interception');
            stateManager.set('ballHandlerLastY', interceptY, 'interception');
            stateManager.set('ballHandlerFrontcourtStartX', interceptX, 'interception');
            stateManager.set('ballHandlerProgressOwner', interceptor, 'interception');
            stateManager.set('ballHandlerDeadForcedShot', false, 'interception');
            if (opponentTeam) {
                stateManager.set('consecutivePoints.' + opponentTeam, 0, 'interception');
            }

            if (helpers.clearPotentialAssist) {
                helpers.clearPotentialAssist(systemsRef);
            } else if (typeof clearPotentialAssist === "function") {
                clearPotentialAssist(systemsRef);
            }

            if (helpers.triggerPossessionBeep) {
                helpers.triggerPossessionBeep(systemsRef);
            } else if (typeof triggerPossessionBeep === "function") {
                triggerPossessionBeep(systemsRef);
            }

            if (helpers.assignDefensiveMatchups) {
                helpers.assignDefensiveMatchups(systemsRef);
            } else if (typeof assignDefensiveMatchups === "function") {
                assignDefensiveMatchups(systemsRef);
            }

            if (helpers.recordTurnover) {
                helpers.recordTurnover(stateData.passer, "steal_pass", systemsRef);
            } else if (typeof recordTurnover === "function") {
                recordTurnover(stateData.passer, "steal_pass", systemsRef);
            }

            var recordStatFn = helpers.recordStatDelta || (typeof recordStatDelta === "function" ? recordStatDelta : null);
            if (recordStatFn && interceptor && interceptor.playerData) {
                recordStatFn(interceptor, "steals", 1, systemsRef);
            }

            if (stateData.passer && stateData.passer.playerData) {
                stateData.passer.playerData.hasDribble = false;
            }
            if (interceptor && interceptor.playerData) {
                interceptor.playerData.hasDribble = true;
            }

            if (typeof debugLog === "function") {
                debugLog("[PASS COMPLETE] INTERCEPTION - possession flipped to " + interceptorTeam +
                    ", turnover recorded for " + (stateData.passerName || passerTeam || "unknown"));
            }

            // Emit events
            deps.events.emit('interception', {
                interceptor: interceptor,
                passer: stateData.passer,
                team: interceptorTeam
            });

            deps.events.emit('turnover', {
                type: 'steal_pass',
                player: stateData.passer,
                team: passerTeam
            });

            deps.events.emit('possession_change', {
                from: passerTeam,
                to: interceptorTeam,
                reason: 'interception'
            });

            deps.events.emit('steal', {
                defender: interceptor,
                ballCarrier: stateData.passer,
                team: interceptorTeam
            });

        } else {
            // SUCCESSFUL PASS

            if (!stateData.receiver) {
                // Safety check: if no receiver, this pass shouldn't have completed
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

            // Reset stuck timer for new ball handler
            deps.state.set('ballHandlerStuckTimer', 0, 'pass_complete');
            deps.state.set('ballHandlerLastX', stateData.receiver.x, 'pass_complete');
            deps.state.set('ballHandlerLastY', stateData.receiver.y, 'pass_complete');

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

                // Do not teleport the inbounder; their authoritative court position is already correct.
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
        processQueuedPass: processQueuedPass,

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
