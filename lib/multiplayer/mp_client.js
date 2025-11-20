// mp_client.js - Multiplayer Client-Side Prediction & Reconciliation
// Handles local input prediction and syncs with server state

load(js.exec_dir + "lib/multiplayer/mp_identity.js");
load(js.exec_dir + "lib/multiplayer/mp_network.js");

var VISUAL_GUARD_SMALL_DELTA = 2.25;
var VISUAL_GUARD_SUPPRESSION_FRAMES = 2;
var VISUAL_GUARD_BEARING_THRESHOLD = 2.0;

function createDefaultDriftMonitorState() {
    return {
        maxDelta: 0,
        lastLoggedDelta: 0,
        lastLoggedAt: 0
    };
}

function createDefaultVisualGuardState() {
    return {
        lastPredictionTick: -1,
        lastAuthorityTick: -1,
        lastLoggedDoubleTick: -1,
        lastLoggedSuppressionTick: -1,
        suppressedAuthorityFrames: 0,
        pendingAuthority: null,
        lastPredictionPosition: null,
        lastPredictionBearing: null
    };
}

function validatePlayerPosition(x, y, options) {
    options = options || {};
    var allowOffcourt = !!options.allowOffcourt;
    var result = {
        valid: true,
        x: x,
        y: y,
        error: null
    };

    if (typeof x !== "number" || typeof y !== "number" || isNaN(x) || isNaN(y)) {
        result.valid = false;
        result.error = "invalid_coordinates";
        x = (typeof x === "number" && !isNaN(x)) ? x : 0;
        y = (typeof y === "number" && !isNaN(y)) ? y : 0;
    }

    var minX = PLAYER_BOUNDARIES ? PLAYER_BOUNDARIES.minX : 1;
    var maxX = PLAYER_BOUNDARIES ? (COURT_WIDTH - PLAYER_BOUNDARIES.movementMaxXOffset) : COURT_WIDTH;
    var minY = PLAYER_BOUNDARIES ? PLAYER_BOUNDARIES.minY : 1;
    var maxY = PLAYER_BOUNDARIES ? (COURT_HEIGHT - PLAYER_BOUNDARIES.maxYOffset) : COURT_HEIGHT;

    if (!allowOffcourt) {
        var clampedX = clamp(x, minX, maxX);
        var clampedY = clamp(y, minY, maxY);
        if (clampedX !== x || clampedY !== y) {
            result.valid = false;
            result.error = result.error || "out_of_bounds";
        }
        result.x = clampedX;
        result.y = clampedY;
    } else {
        result.x = x;
        result.y = y;
    }

    return result;
}

// Local client-side collision guard. Uses other players' last known
// authoritative positions (if available) to decide whether a predicted
// move would overlap an opponent. This mirrors the authority's small-core
// overlap test (approx dx<2 && dy<2).
function wouldCollideWithAuthoritativeOthers(systems, localSprite, nextPos) {
    try {
        // Get all player sprites to check their current positions
        var allPlayers = spriteRegistry ? spriteRegistry.getAllPlayers() : [];
        if (!allPlayers || allPlayers.length === 0) {
            return false;
        }

        for (var i = 0; i < allPlayers.length; i++) {
            var otherSprite = allPlayers[i];
            if (!otherSprite) continue;

            // Skip self
            if (otherSprite === localSprite) continue;
            if (otherSprite.playerId === localSprite.playerId) continue;

            // Skip teammates (only check collisions between opponents)
            var localTeam = getPlayerTeamName ? getPlayerTeamName(localSprite) : null;
            var otherTeam = getPlayerTeamName ? getPlayerTeamName(otherSprite) : null;
            if (localTeam && otherTeam && localTeam === otherTeam) continue;

            // Use current sprite position (most recent authoritative or predicted)
            var ax = otherSprite.x;
            var ay = otherSprite.y;

            var dx = Math.abs(ax - nextPos.x);
            var dy = Math.abs(ay - nextPos.y);

            var clientThreshold = (typeof PLAYER_CLIENT_COLLISION_THRESHOLD === "object" && PLAYER_CLIENT_COLLISION_THRESHOLD)
                ? PLAYER_CLIENT_COLLISION_THRESHOLD
                : { dx: 1.5, dy: 1.5 };
            // Use a slightly tighter threshold than authority to only block when definitely overlapping
            // This prevents false blocking while still catching obvious collisions
            if (dx < clientThreshold.dx && dy < clientThreshold.dy) {
                if (typeof debugLog === "function") {
                    debugLog("[MP CLIENT] Collision guard would block move - opponent at (" + ax + "," + ay + "), next pos (" + nextPos.x + "," + nextPos.y + "), delta=(" + dx.toFixed(1) + "," + dy.toFixed(1) + ")");
                }
                return true;
            }
        }
    } catch (e) {
        // If anything goes wrong, be conservative and return false (don't block).
        if (typeof debugLog === "function") {
            debugLog("[MP CLIENT] Collision guard exception: " + e);
        }
        return false;
    }

    return false;
}

function InputBuffer(playerId) {
    this.playerId = playerId;
    this.buffer = [];
    this.sequence = 0;
    this.lastFlush = Date.now();
    this.flushInterval = 50; // Default 50ms (20 FPS)

    // Add input to buffer
    this.addInput = function (key, frameNumber, meta) {
        var payload = {
            p: this.playerId,
            k: key,
            f: frameNumber
        };
        if (meta && meta.turbo !== undefined) {
            payload.t = !!meta.turbo;
        }
        this.buffer.push(payload);
    };

    // Set flush interval (adaptive)
    this.setFlushInterval = function (interval) {
        this.flushInterval = Math.max(10, Math.min(interval, 200));
    };

    // Check if should flush
    this.shouldFlush = function () {
        if (this.buffer.length === 0) return false;

        var elapsed = Date.now() - this.lastFlush;
        return elapsed >= this.flushInterval;
    };

    // Flush buffer to server via Queue
    this.flush = function (inputQueue) {
        if (!this.shouldFlush()) return false;
        if (!inputQueue) {
            if (typeof debugLog === "function") {
                debugLog("InputBuffer.flush() - Missing inputQueue for player " + this.playerId + " (buffer length: " + this.buffer.length + ")");
            }
            return false;
        }

        var packet = {
            s: this.sequence++,
            t: Date.now(),
            i: this.buffer.slice() // Copy array
        };

        try {
            inputQueue.write(packet);

            if (typeof debugLog === "function") {
                debugLog("InputBuffer.flush() - Wrote packet for player " + this.playerId + " (seq: " + packet.s + ", inputs: " + packet.i.length + ")");
            }

            this.buffer = [];
            this.lastFlush = Date.now();

            return packet;
        } catch (e) {
            log(LOG_WARNING, "NBA JAM MP: Failed to flush inputs: " + e);
            return false;
        }
    };

    // Force flush (ignore interval)
    this.forceFlush = function (inputQueue) {
        if (this.buffer.length === 0) return false;

        var saved = this.flushInterval;
        this.flushInterval = 0;
        var result = this.flush(inputQueue);
        this.flushInterval = saved;

        return result;
    };
}

function PlayerClient(sessionId, client, myPlayerId, serverConfig, systems) {
    this.sessionId = sessionId;
    this.client = client;
    this.myPlayerId = myPlayerId;
    this.serverConfig = serverConfig;
    this.systems = systems;  // Store systems for stateManager access

    // Input buffer
    this.inputBuffer = new InputBuffer(myPlayerId);

    // Prediction tracking
    this.pendingInputs = [];
    this.lastServerFrame = 0;

    // My sprite
    this.mySprite = null;

    // Sprite mapping (globalId -> sprite object)
    this.globalIdToSprite = {};
    this.playerSpriteMap = this.globalIdToSprite;
    this.processedEventSignatures = [];
    this.maxEventSignatureHistory = 64;
    this.processedAnimations = {};
    this.animationIdHistory = [];
    this.maxAnimationHistory = 96;
    this.driftMonitor = createDefaultDriftMonitorState();
    this.authoritativeCatchupFrames = 0;
    this.lastInbounding = false;
    this.visualGuard = createDefaultVisualGuardState();
    this.pendingSpriteCommit = null;
    this.animationHintCache = null;

    // WAVE 24: Phase-based prediction tuning
    this.currentPhase = "NORMAL_PLAY";
    this.currentReconciliationStrength = 0.3;
    this.inputTaperingActive = false;
    this.inputTaperingFramesRemaining = 0;
    this.inputTaperingFactor = 1.0;

    // Network monitor
    this.networkMonitor = new NetworkMonitor(client, sessionId);

    this.requestAuthoritativeCatchup = function (frames, reason) {
        if (this.isCoordinator) return;
        if (typeof frames !== "number" || frames <= 0) return;

        if (frames > this.authoritativeCatchupFrames) {
            this.authoritativeCatchupFrames = frames;
            if (typeof debugLog === "function" && reason) {
                var tickInfo = "";
                if (typeof this.getCurrentTick === "function") {
                    tickInfo = ", tick=" + this.getCurrentTick();
                }
                debugLog("[MP CLIENT] Authoritative catchup triggered (" + reason + ") frames=" + frames + tickInfo);
            }
        }
    };

    this.getCurrentTick = function () {
        if (this.systems && this.systems.stateManager && typeof this.systems.stateManager.get === "function") {
            var tick = this.systems.stateManager.get('tickCounter');
            if (typeof tick === "number" && !isNaN(tick)) {
                return tick;
            }
        }
        return 0;
    };

    this.recordPredictionEvent = function () {
        var tick = this.getCurrentTick();
        debugLog("[MP PRED EVENT] Called, tick=" + tick + " sprite=" + (this.mySprite ? "(" + this.mySprite.x + "," + this.mySprite.y + ")" : "null"));

        // Reset suppression counter when new prediction starts
        // This allows visual guard to suppress for EACH prediction window
        if (tick !== this.visualGuard.lastPredictionTick) {
            this.visualGuard.suppressedAuthorityFrames = 0;
        }

        this.visualGuard.lastPredictionTick = tick;
        if (this.mySprite) {
            this.visualGuard.lastPredictionPosition = { x: this.mySprite.x, y: this.mySprite.y };
            this.visualGuard.lastPredictionBearing = this.mySprite.bearing || null;
        }
    };

    this._raiseSpriteFrame = function (sprite) {
        if (!sprite || !sprite.frame || typeof sprite.frame.top !== "function") {
            return;
        }
        try {
            sprite.frame.top();
        } catch (e) {
            if (typeof debugLog === "function") {
                debugLog("[MP CLIENT] Failed to raise sprite frame: " + e);
            }
        }
    };

    this._getStagedSpritePosition = function () {
        if (this.pendingSpriteCommit) {
            return {
                x: this.pendingSpriteCommit.x,
                y: this.pendingSpriteCommit.y
            };
        }
        return {
            x: this.mySprite ? this.mySprite.x : 0,
            y: this.mySprite ? this.mySprite.y : 0
        };
    };

    this._stageSpriteCommit = function (source, x, y, extras) {
        if (!this.mySprite) return;
        this.pendingSpriteCommit = {
            x: x,
            y: y,
            bearing: extras && extras.bearing !== undefined ? extras.bearing : undefined,
            source: source || "unspecified",
            tick: this.getCurrentTick()
        };
    };

    this._applyStagedSpriteCommit = function () {
        if (!this.pendingSpriteCommit || !this.mySprite) return;
        var commit = this.pendingSpriteCommit;
        this.mySprite.x = commit.x;
        this.mySprite.y = commit.y;
        if (commit.bearing !== undefined) {
            this.mySprite.bearing = commit.bearing;
        }
        this._raiseSpriteFrame(this.mySprite);
        if (typeof debugLog === "function") {
            debugLog("[MP COMMIT] source=" + commit.source + " tick=" + commit.tick +
                " sprite=(" + this.mySprite.x + "," + this.mySprite.y + ")" +
                (commit.bearing !== undefined ? " bearing=" + commit.bearing : ""));
        }
        this.pendingSpriteCommit = null;
    };

    this.resetPredictionState = function (reason, options) {
        var opts = options || {};
        var previousPending = this.pendingInputs.length;
        var previousCatchup = this.authoritativeCatchupFrames;
        var previousGuardTick = this.visualGuard ? this.visualGuard.lastPredictionTick : null;

        this.pendingInputs = [];
        this.authoritativeCatchupFrames = 0;
        this.driftMonitor = createDefaultDriftMonitorState();
        this.visualGuard = createDefaultVisualGuardState();

        if (this.inputBuffer && Array.isArray(this.inputBuffer.buffer) && this.inputBuffer.buffer.length > 0) {
            this.inputBuffer.buffer = [];
            this.inputBuffer.lastFlush = Date.now();
        }

        if (typeof clearInputHistory === "function") {
            clearInputHistory();
        }

        if (opts.resetServerFrame === true) {
            this.lastServerFrame = 0;
        }

        if (typeof debugLog === "function") {
            debugLog("[MP CLIENT] resetPredictionState reason=" + (reason || "unspecified") +
                " clearedPending=" + previousPending +
                " catchupBefore=" + previousCatchup +
                " lastGuardTick=" + previousGuardTick);
        }
    };

    // Last state update
    this.lastState = null;

    // State reconciliation timing (use prime-like interval to avoid phase resonance)
    // 12Hz (83ms) gives 5:3 ratio with 20Hz broadcast - reduces phase alignment
    // Was 100ms (10Hz = 2:1 ratio) which still caused periodic phase lock
    this.stateCheckInterval = 83; // Check every 83ms (~12 Hz)
    this.lastStateCheck = 0;

    // Disable prediction if coordinator (to avoid double input processing)
    this.isCoordinator = false;
    this.disablePrediction = false;

    // Queue objects for real-time gameplay (replaces database)
    this.stateQueue = null;  // Read state from coordinator
    this.inputQueue = null;  // Write inputs to coordinator

    // Initialize
    this.init = function () {
        // Set initial flush interval from config
        if (serverConfig.tuning && serverConfig.tuning.inputFlushInterval) {
            this.inputBuffer.setFlushInterval(serverConfig.tuning.inputFlushInterval);
        }

        // Initialize timing
        this.lastStateCheck = Date.now();

        // Create Queue objects for real-time communication
        this.stateQueue = new Queue("nba_jam.game." + this.sessionId + ".state." + this.myPlayerId);
        this.inputQueue = new Queue("nba_jam.game." + this.sessionId + ".inputs." + this.myPlayerId);

        // Subscribe to events (still using database for non-realtime events)
        this.client.subscribe("nba_jam", "game." + this.sessionId + ".events");

        return true;
    };

    // Set my sprite
    this.setMySprite = function (sprite) {
        this.mySprite = sprite;
    };

    this.refreshMySprite = function () {
        if (this.mySprite && this.mySprite.controlledBy === this.myPlayerId)
            return;

        var candidateSprite = null;
        var map = this.globalIdToSprite || {};

        for (var key in map) {
            if (!map.hasOwnProperty(key))
                continue;
            var sprite = map[key];
            if (!sprite || !sprite.playerData)
                continue;
            if (sprite.controlledBy === this.myPlayerId) {
                candidateSprite = sprite;
                break;
            }
        }

        if (!candidateSprite && map[this.myPlayerId]) {
            candidateSprite = map[this.myPlayerId];
        }

        if (candidateSprite) {
            candidateSprite.controllerType = "local";
            candidateSprite.isHuman = true;
            this.mySprite = candidateSprite;
        }
    };

    // Set sprite map (globalId -> sprite object)
    this.setSpriteMap = function (map) {
        this.globalIdToSprite = map || {};
        this.playerSpriteMap = this.globalIdToSprite;
        for (var key in this.globalIdToSprite) {
            if (!this.globalIdToSprite.hasOwnProperty(key)) continue;
            var s = this.globalIdToSprite[key];
            if (s) {
                s.playerId = key;
                s.globalId = key;
            }
            if (s && s.playerData) {
                s.playerData.lastAuthoritativeX = s.x;
                s.playerData.lastAuthoritativeY = s.y;
            }
        }
        this.refreshMySprite();
    };

    // Find sprite by global ID
    this.findSpriteByGlobalId = function (globalId) {
        return this.globalIdToSprite[globalId] || null;
    };

    // Set coordinator status (disables prediction to avoid double processing)
    this.setCoordinatorStatus = function (isCoordinator) {
        this.isCoordinator = isCoordinator;
        this.disablePrediction = isCoordinator; // Coordinator doesn't predict, it's authoritative
    };

    // Handle local input (called when player presses key)
    this.handleInput = function (key, frameNumber) {
        if (typeof debugLog === "function") {
            debugLog("PlayerClient.handleInput() - Received key '" + key + "' at frame " + frameNumber + " for player " + this.myPlayerId + " (sprite: " + (this.mySprite ? this.mySprite.playerData && this.mySprite.playerData.name : "null") + ")");
        }
        if (!this.mySprite) {
            if (typeof debugLog === "function") {
                debugLog("PlayerClient.handleInput() - No sprite for player " + this.myPlayerId + ", aborting input '" + key + "'");
            }
            return;
        }
        if (this.mySprite.controlledBy !== this.myPlayerId) {
            if (typeof debugLog === "function") {
                debugLog("PlayerClient.handleInput() - Sprite controller mismatch for player " + this.myPlayerId + " (controlledBy: " + this.mySprite.controlledBy + ")");
            }
            this.refreshMySprite();
            if (!this.mySprite || this.mySprite.controlledBy !== this.myPlayerId) {
                if (typeof debugLog === "function") {
                    var controller = this.mySprite ? this.mySprite.controlledBy : "null";
                    debugLog("PlayerClient.handleInput() - Refresh failed to claim sprite for player " + this.myPlayerId + " (controlledBy: " + controller + ")");
                }
                return;
            }
            if (typeof debugLog === "function") {
                debugLog("PlayerClient.handleInput() - Refresh succeeded; sprite now controlled by " + this.mySprite.controlledBy);
            }
        }

        if (this.mySprite.__mpHintLock) {
            if (typeof debugLog === "function") {
                debugLog("[MP CLIENT] Input ignored due to inbound animation lock (key='" + key + "')");
            }
            return;
        }

        var turboIntent = (this.mySprite.playerData && this.mySprite.playerData.turboActive);
        if (turboIntent && this.mySprite.playerData && typeof this.mySprite.playerData.useTurbo === "function") {
            this.mySprite.playerData.useTurbo(TURBO_DRAIN_RATE);
        }

        var upperKey = (typeof key === "string") ? key.toUpperCase() : key;
        var isMovementKey = !(upperKey === ' ' || upperKey === 'S' || upperKey === 'D');

        // WAVE 24 FLICKER & LAG FIX: Predictively execute actions for non-coordinators
        // This makes shots, dunks, and blocks feel instantaneous. The coordinator will
        // send a correction if the action was invalid.
        if (!this.disablePrediction && !isMovementKey && typeof handleActionButton === "function") {
            handleActionButton(this.mySprite, this.systems, { predictive: true });
        }

        // Track whether we applied any prediction this frame
        var predictionApplied = false;

        // WAVE 24 COLLISION PARITY FIX: Check collisions for ALL players (coordinator and non-coordinator)
        // This ensures both have the same collision behavior
        var inputBlocked = false;
        var previewResult = null;
        if (isMovementKey && typeof previewMovementCommand === "function") {
            previewResult = previewMovementCommand(this.mySprite, key);
            var nextCoords = previewResult ? {
                x: previewResult.attemptedX,
                y: previewResult.attemptedY
            } : {
                x: this.mySprite.x,
                y: this.mySprite.y
            };
            var wouldCollide = wouldCollideWithAuthoritativeOthers(this.systems, this.mySprite, nextCoords);

            if (wouldCollide) {
                var playerType = this.isCoordinator ? "COORDINATOR" : "NON-COORDINATOR";
                debugLog("[MP CLIENT] " + playerType + " input blocked by collision guard (key=" + key + ")");
                inputBlocked = true;
                // Don't process this input at all - it would cause a collision
                return;
            }
        }

        // 1. Apply input immediately (client-side prediction)
        // Skip if we're the coordinator (coordinator applies from queue authoritatively)
        if (!this.disablePrediction && isMovementKey && typeof applyMovementCommand === "function") {
            // Collision already checked above - safe to proceed
            var budget = (typeof createMovementCounters === "function")
                ? createMovementCounters(this.mySprite, turboIntent, this.systems)
                : null;
            if (budget && budget.moves > 0) {
                var counters = {
                    horizontal: Math.max(0, budget.horizontal),
                    vertical: Math.max(0, budget.vertical)
                };
                for (var m = 0; m < budget.moves; m++) {
                    var moved = applyMovementCommand(this.mySprite, key, counters);
                    if (moved) predictionApplied = true;
                    if (!moved) break;
                }
            } else if (!budget) {
                var moved = applyMovementCommand(this.mySprite, key);
                if (moved) predictionApplied = true;
            }
        }

        // 2. Store for reconciliation
        this.pendingInputs.push({
            key: key,
            frame: frameNumber,
            position: {
                x: this.mySprite.x,
                y: this.mySprite.y
            }
        });

        // Limit pending input history
        if (this.pendingInputs.length > 30) {
            this.pendingInputs.shift();
        }

        // 3. Buffer for sending to server
        this.inputBuffer.addInput(key, frameNumber, { turbo: !!turboIntent });

        // 4. Record in replay buffer for lag compensation
        if (typeof recordInput === "function") {
            recordInput({
                key: key,
                playerId: this.myPlayerId,
                turbo: !!turboIntent
            }, frameNumber);
        }

        // 5. CRITICAL FIX (Wave 24): Record prediction event IMMEDIATELY after applying movement
        // This ensures visualGuard.lastPredictionTick is set BEFORE reconciliation runs,
        // preventing the flicker cycle: predict→authority-overwrite→replay-forward
        if (predictionApplied) {
            if (this.mySprite) {
                this._stageSpriteCommit("prediction", this.mySprite.x, this.mySprite.y, {
                    bearing: this.mySprite.bearing
                });
                this._applyStagedSpriteCommit();
            }
            debugLog("[MP HANDLEINPUT] predictionApplied=true, calling recordPredictionEvent()");
            this.recordPredictionEvent();
        } else {
            debugLog("[MP HANDLEINPUT] predictionApplied=false, NOT calling recordPredictionEvent()");
        }
    };

    this._cloneBounceList = function (list) {
        if (!Array.isArray(list)) return [];
        var clone = [];
        for (var i = 0; i < list.length; i++) {
            var bounce = list[i];
            if (!bounce) continue;
            clone.push({
                startX: typeof bounce.startX === "number" ? bounce.startX : 0,
                startY: typeof bounce.startY === "number" ? bounce.startY : 0,
                endX: typeof bounce.endX === "number" ? bounce.endX : 0,
                endY: typeof bounce.endY === "number" ? bounce.endY : 0
            });
        }
        return clone;
    };

    this._cloneDunkInfoData = function (info) {
        if (!info) return null;
        return {
            attackDir: typeof info.attackDir === "number" ? info.attackDir : 0,
            adjustedDistance: typeof info.adjustedDistance === "number" ? info.adjustedDistance : 0,
            absDx: typeof info.absDx === "number" ? info.absDx : 0,
            absDy: typeof info.absDy === "number" ? info.absDy : 0,
            insideKey: !!info.insideKey,
            centerX: typeof info.centerX === "number" ? info.centerX : 0,
            centerY: typeof info.centerY === "number" ? info.centerY : 0,
            spriteHalfWidth: typeof info.spriteHalfWidth === "number" ? info.spriteHalfWidth : 0,
            spriteHalfHeight: typeof info.spriteHalfHeight === "number" ? info.spriteHalfHeight : 0,
            dunkRange: typeof info.dunkRange === "number" ? info.dunkRange : 0,
            dunkSkill: typeof info.dunkSkill === "number" ? info.dunkSkill : 0,
            rawDunkSkill: typeof info.rawDunkSkill === "number" ? info.rawDunkSkill : 0,
            flightSkillFactor: typeof info.flightSkillFactor === "number" ? info.flightSkillFactor : 0,
            baseSkillFactor: typeof info.baseSkillFactor === "number" ? info.baseSkillFactor : 0
        };
    };

    this._cloneFlightPlanData = function (plan) {
        if (!plan || !Array.isArray(plan.frames)) return { frames: [] };
        var frames = [];
        for (var i = 0; i < plan.frames.length; i++) {
            var frame = plan.frames[i];
            if (!frame) continue;
            frames.push({
                centerX: typeof frame.centerX === "number" ? frame.centerX : 0,
                centerY: typeof frame.centerY === "number" ? frame.centerY : 0,
                progress: typeof frame.progress === "number" ? frame.progress : 0,
                t: typeof frame.t === "number" ? frame.t : 0,
                ms: typeof frame.ms === "number" ? frame.ms : 0,
                ballOffsetX: typeof frame.ballOffsetX === "number" ? frame.ballOffsetX : 0,
                ballOffsetY: typeof frame.ballOffsetY === "number" ? frame.ballOffsetY : 0,
                hang: !!frame.hang
            });
        }
        return {
            frames: frames,
            arcHeight: typeof plan.arcHeight === "number" ? plan.arcHeight : 0,
            rimX: typeof plan.rimX === "number" ? plan.rimX : 0,
            rimY: typeof plan.rimY === "number" ? plan.rimY : 0
        };
    };

    this._hasAnimationBeenProcessed = function (id) {
        if (id === null || id === undefined) return false;
        return !!this.processedAnimations[id];
    };

    this._markAnimationProcessed = function (id) {
        if (id === null || id === undefined) return;
        if (!this.processedAnimations[id]) {
            this.processedAnimations[id] = true;
            this.animationIdHistory.push(id);
            if (this.animationIdHistory.length > this.maxAnimationHistory) {
                var stale = this.animationIdHistory.shift();
                if (stale !== undefined && stale !== null) {
                    delete this.processedAnimations[stale];
                }
            }
        }
    };

    this._executeAnimationPayload = function (entry) {
        if (!entry || !entry.type) return false;
        if (typeof animationSystem === "undefined" || !animationSystem) return false;
        var data = entry.data || {};
        switch (entry.type) {
            case "shot":
                var shooterSprite = data.shooter ? this.findSpriteByGlobalId(data.shooter) : null;
                var shotDuration = (typeof data.durationMs === "number" && data.durationMs > 0) ? data.durationMs : null;
                var shotBounces = this._cloneBounceList(data.reboundBounces);
                animationSystem.queueShotAnimation(
                    typeof data.startX === "number" ? data.startX : 0,
                    typeof data.startY === "number" ? data.startY : 0,
                    typeof data.targetX === "number" ? data.targetX : 0,
                    typeof data.targetY === "number" ? data.targetY : 0,
                    !!data.made,
                    !!data.blocked,
                    shooterSprite,
                    shotDuration,
                    shotBounces,
                    null
                );
                return true;
            case "pass":
                var passDuration = (typeof data.durationMs === "number" && data.durationMs > 0) ? data.durationMs : null;
                animationSystem.queuePassAnimation(
                    typeof data.startX === "number" ? data.startX : 0,
                    typeof data.startY === "number" ? data.startY : 0,
                    typeof data.endX === "number" ? data.endX : 0,
                    typeof data.endY === "number" ? data.endY : 0,
                    null,
                    passDuration,
                    null
                );
                return true;
            case "dunk":
                var playerSprite = data.player ? this.findSpriteByGlobalId(data.player) : null;
                if (!playerSprite) {
                    return false;
                }
                var dunkInfo = this._cloneDunkInfoData(data.dunkInfo);
                var flightPlan = this._cloneFlightPlanData(data.flightPlan);
                if (!dunkInfo || !flightPlan || !flightPlan.frames.length) {
                    return false;
                }
                animationSystem.queueDunkAnimation(
                    playerSprite,
                    dunkInfo,
                    flightPlan,
                    typeof data.targetX === "number" ? data.targetX : 0,
                    typeof data.targetY === "number" ? data.targetY : 0,
                    !!data.made,
                    data.style || "default",
                    null
                );
                return true;
            case "rebound":
                var reboundBounces = this._cloneBounceList(data.bounces);
                if (!reboundBounces.length) {
                    return false;
                }
                animationSystem.queueReboundAnimation(reboundBounces);
                return true;
            case "clear_ball":
                animationSystem.clearBallAnimations(data.reason || "external");
                return true;
            default:
                return false;
        }
    };

    this.applyRemoteAnimations = function (entries) {
        if (this.isCoordinator) return;
        if (!Array.isArray(entries) || entries.length === 0) return;
        if (typeof animationSystem === "undefined" || !animationSystem) return;

        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            if (!entry || typeof entry.id !== "number") continue;
            if (this._hasAnimationBeenProcessed(entry.id)) continue;

            var executed = this._executeAnimationPayload(entry);
            if (executed) {
                this._markAnimationProcessed(entry.id);
            }
        }
    };

    // Update (called each frame)
    this.update = function (frameNumber) {
        // Flush input buffer periodically via Queue
        var flushedPacket = this.inputBuffer.flush(this.inputQueue);
        if (flushedPacket && this.isCoordinator && typeof mpCoordinator !== "undefined" && mpCoordinator && typeof mpCoordinator.queueLocalInputPacket === "function") {
            mpCoordinator.queueLocalInputPacket(this.myPlayerId, flushedPacket);
        }

        // Prune old inputs from replay buffer (keep last 120 frames)
        if (typeof pruneOldInputs === "function" && typeof frameNumber === "number") {
            pruneOldInputs(Math.max(0, frameNumber - 120));
        }

        // Check network quality and adjust
        this.networkMonitor.ping();
        this.adaptToNetworkQuality();

        if (!this.isCoordinator) {
            if (typeof updateKnockbackAnimations === "function") {
                updateKnockbackAnimations();
            }
            if (typeof updateAnimationHintEffects === "function") {
                updateAnimationHintEffects();
            }
        }

        // Reconcile with server state (no DB overhead with Queue)
        // Add ±5ms jitter to prevent phase locking with broadcast cycle
        var now = Date.now();
        var jitter = Math.floor(Math.random() * 10) - 5; // -5ms to +5ms
        var effectiveInterval = this.stateCheckInterval + jitter;
        if (now - this.lastStateCheck >= effectiveInterval) {
            this.reconcile();
            this.lastStateCheck = now;
        }
    };

    // Adapt settings based on network quality
    this.adaptToNetworkQuality = function () {
        var tuning = this.networkMonitor.getAdaptiveTuning();

        if (tuning && tuning.inputFlushInterval) {
            this.inputBuffer.setFlushInterval(tuning.inputFlushInterval);
        }
    };

    // Reconcile local state with server state
    this.reconcile = function () {
        // Read latest state from coordinator via Queue (non-blocking)
        if (!this.stateQueue) return;

        // Check if data is waiting before reading
        if (!this.stateQueue.data_waiting) return;

        var serverState = null;
        do {
            var candidate = this.stateQueue.read();
            if (candidate)
                serverState = candidate;
        } while (this.stateQueue.data_waiting);
        if (!serverState) return;

        // Check if this is a new state update
        if (typeof serverState.f !== "number") return;
        if (serverState.f <= this.lastServerFrame) return;

        this.lastServerFrame = serverState.f;
        this.lastState = serverState;

        // Update other players (authoritative) - pass indexMap
        this.updateOtherPlayers(serverState.p, serverState.m);

        // Update ball
        this.updateBall(serverState.b);

        // Update game state
        this.updateGameState(serverState.g);

        // Process animation hints before positional reconciliation so UI reflects authority intent
        this.applyAnimationHints(serverState.ah, serverState.f);

        // Reconcile my position
        this.reconcileMyPosition(serverState);

        // Replay inputs since server frame for lag compensation
        if (typeof replayInputsSince === "function" && !this.disablePrediction) {
            var self = this;
            var replayPredictionApplied = false;
            replayInputsSince(serverState.f, function (inputRecord) {
                // Re-apply the input that occurred after the server's authoritative state
                if (inputRecord && inputRecord.key && self.mySprite) {
                    var turboActive = inputRecord.turbo || false;
                    if (turboActive && self.mySprite.playerData && typeof self.mySprite.playerData.useTurbo === "function") {
                        self.mySprite.playerData.useTurbo(TURBO_DRAIN_RATE);
                    }

                    if (typeof applyMovementCommand === "function") {
                        var budget = (typeof createMovementCounters === "function")
                            ? createMovementCounters(self.mySprite, turboActive, self.systems)
                            : null;
                        if (budget && budget.moves > 0) {
                            var counters = {
                                horizontal: Math.max(0, budget.horizontal),
                                vertical: Math.max(0, budget.vertical)
                            };
                            for (var m = 0; m < budget.moves; m++) {
                                // Before applying the movement command locally, perform a
                                // conservative client-side collision guard against other
                                // players' last authoritative positions to avoid predicting
                                // through opponents (which later causes large authority snaps).
                                var nextX = self.mySprite.x;
                                var nextY = self.mySprite.y;
                                switch (inputRecord.key) {
                                    case KEY_LEFT: nextX = self.mySprite.x - 1; break;
                                    case KEY_RIGHT: nextX = self.mySprite.x + 1; break;
                                    case KEY_UP: nextY = self.mySprite.y - 1; break;
                                    case KEY_DOWN: nextY = self.mySprite.y + 1; break;
                                    default: break;
                                }

                                var blocked = wouldCollideWithAuthoritativeOthers(self.systems, self.mySprite, { x: nextX, y: nextY });
                                if (blocked) {
                                    if (typeof debugLog === "function") {
                                        debugLog("[MP CLIENT] Local prediction blocked by collision guard (key=" + inputRecord.key + ", nextX=" + nextX + ", nextY=" + nextY + ")");
                                    }
                                    // Do not apply movement; treat as not moved and stop
                                    break;
                                }

                                var moved = applyMovementCommand(self.mySprite, inputRecord.key, counters);
                                if (moved) {
                                    replayPredictionApplied = true;
                                }
                                if (!moved) break;
                            }
                        } else if (!budget) {
                            // No budget system available - still apply a single step but
                            // run the same collision guard to avoid through-opponent moves.
                            var nextXb = self.mySprite.x;
                            var nextYb = self.mySprite.y;
                            switch (inputRecord.key) {
                                case KEY_LEFT: nextXb = self.mySprite.x - 1; break;
                                case KEY_RIGHT: nextXb = self.mySprite.x + 1; break;
                                case KEY_UP: nextYb = self.mySprite.y - 1; break;
                                case KEY_DOWN: nextYb = self.mySprite.y + 1; break;
                                default: break;
                            }
                            var blockedBasic = wouldCollideWithAuthoritativeOthers(self.systems, self.mySprite, { x: nextXb, y: nextYb });
                            if (!blockedBasic) {
                                var movedBasic = applyMovementCommand(self.mySprite, inputRecord.key);
                                if (movedBasic) {
                                    replayPredictionApplied = true;
                                }
                            } else {
                                if (typeof debugLog === "function") {
                                    debugLog("[MP CLIENT] Local prediction blocked by collision guard (key=" + inputRecord.key + ", nextX=" + nextXb + ", nextY=" + nextYb + ")");
                                }
                            }
                        }
                    }
                }
            });
            if (replayPredictionApplied) {
                if (this.mySprite) {
                    this._stageSpriteCommit("prediction_replay", this.mySprite.x, this.mySprite.y, {
                        bearing: this.mySprite.bearing
                    });
                    this._applyStagedSpriteCommit();
                }
                this.recordPredictionEvent();
            }
        }

        // Process events
        this.processEvents();
    };

    // Update other players' positions
    this.updateOtherPlayers = function (positions, indexMap) {
        if (!positions || !Array.isArray(positions)) return;
        if (!indexMap) return; // Need the mapping to apply positions correctly

        // Adaptive smoothing based on network quality to reduce snap flicker
        var tuning = this.networkMonitor ? this.networkMonitor.getAdaptiveTuning() : null;
        var baseBlend = tuning && typeof tuning.reconciliationStrength === "number"
            ? tuning.reconciliationStrength
            : 0.3;
        var minBlend = 0.12;   // Lowest blend so sprites still respond quickly
        var maxBlend = 0.9;    // Cap to avoid visible lag trails
        var currentTick = (typeof this.getCurrentTick === "function") ? this.getCurrentTick() : 0;
        var catchupActiveForGuard = this.authoritativeCatchupFrames > 0;

        // Iterate through each player by global ID
        for (var globalId in indexMap) {
            if (!indexMap.hasOwnProperty(globalId)) continue;

            // Find the sprite for this player
            var sprite = this.findSpriteByGlobalId(globalId);
            if (!sprite) continue;
            if (!sprite.playerData) {
                sprite.playerData = {};
            }

            // Determine whether we should apply movement updates from the coordinator
            var shouldApplyMovement = true;
            if (this.isCoordinator) {
                // Coordinator only interpolates remote human sprites; local/AI sprites are already authoritative
                shouldApplyMovement = (sprite.controllerType === "remote");
            } else {
                // Non-coordinator: Skip myPlayer entirely in updateOtherPlayers
                // reconcileMyPosition() is the single source of truth for myPlayer updates
                // (it has visual guard logic and handles catchup/dead-ball correctly)
                if (String(globalId) === String(this.myPlayerId)) {
                    continue; // Skip - let reconcileMyPosition handle myPlayer
                }
            }

            // Get position index for this player
            var posIndex = indexMap[globalId];
            var pos = positions[posIndex];
            if (!pos) continue;

            // WAVE 21: Validate position data from network
            var posCheck = validatePlayerPosition(pos.x, pos.y, {
                allowOffcourt: !!pos.allowOffcourt
            });
            if (!posCheck.valid && typeof log === "function") {
                log(LOG_DEBUG, "MP Client: Invalid position for " + globalId + ": " + posCheck.error);
            }
            var targetX = posCheck.x;
            var targetY = posCheck.y;

            var playerData = sprite.playerData;
            var lastAuthX = playerData.lastAuthoritativeX;
            var lastAuthY = playerData.lastAuthoritativeY;
            playerData.lastAuthoritativeX = targetX;
            playerData.lastAuthoritativeY = targetY;

            var currentX = sprite.x;
            var currentY = sprite.y;
            if (typeof currentX !== "number") currentX = targetX;
            if (typeof currentY !== "number") currentY = targetY;

            var deltaX = targetX - currentX;
            var deltaY = targetY - currentY;
            var absDx = Math.abs(deltaX);
            var absDy = Math.abs(deltaY);
            var distance = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));

            var hintLocked = !!sprite.__mpHintLock;

            if (hintLocked && typeof debugLog === "function") {
                try {
                    debugLog("[MP CLIENT] Authority update skipped for " + globalId + " due to animation lock");
                } catch (e) { }
            }

            if (shouldApplyMovement && !hintLocked) {
                var nextX = currentX;
                var nextY = currentY;

                if (distance < 0.001) {
                    nextX = targetX;
                    nextY = targetY;
                } else if (absDx >= 2 || absDy >= 2) {
                    nextX = targetX;
                    nextY = targetY;
                } else if (lastAuthX === targetX && lastAuthY === targetY) {
                    nextX = targetX;
                    nextY = targetY;
                } else {
                    var adaptiveBlend = baseBlend;

                    if (distance < 0.5) {
                        adaptiveBlend *= 0.6;
                    } else if (distance < 1.0) {
                        adaptiveBlend *= 0.85;
                    } else {
                        adaptiveBlend *= 1.1;
                    }

                    if (tuning && typeof tuning.predictionFrames === "number" && tuning.predictionFrames >= 5) {
                        adaptiveBlend *= 0.85;
                    }

                    adaptiveBlend = Math.max(minBlend, Math.min(maxBlend, adaptiveBlend));

                    nextX = currentX + (deltaX * adaptiveBlend);
                    nextY = currentY + (deltaY * adaptiveBlend);
                }

                if (pos.b) {
                    if (String(globalId) === String(this.myPlayerId) && !catchupActiveForGuard && this.visualGuard && this.visualGuard.lastPredictionTick === currentTick && distance < VISUAL_GUARD_BEARING_THRESHOLD) {
                        // Visual guard: skip redundant bearing overrides in same tick to keep sprint orientation steady
                    } else {
                        sprite.bearing = pos.b;
                    }
                }

                if (sprite.moveTo) {
                    var roundedX = Math.round(nextX);
                    var roundedY = Math.round(nextY);
                    if (roundedX !== sprite.x || roundedY !== sprite.y) {
                        sprite.moveTo(roundedX, roundedY);
                    } else if (sprite.frame && typeof sprite.frame.invalidate === "function") {
                        sprite.frame.invalidate();
                    }
                } else {
                    sprite.x = nextX;
                    sprite.y = nextY;
                    if (sprite.frame && typeof sprite.frame.invalidate === "function") {
                        sprite.frame.invalidate();
                    }
                }
            }

            // Update player state fields
            if (sprite.playerData) {
                if (typeof pos.d === "boolean") {
                    sprite.playerData.hasDribble = pos.d;
                }
                if (typeof pos.k === "number") {
                    sprite.playerData.knockdownTimer = pos.k;
                }
                if (typeof pos.s === "number") {
                    sprite.playerData.stealRecoverFrames = pos.s;
                }
                if (typeof pos.t === "boolean") {
                    sprite.playerData.turboActive = pos.t;
                }
                if (typeof pos.T === "number") {
                    sprite.playerData.turbo = pos.T;
                }
                if (typeof pos.o === "boolean") {
                    sprite.playerData.onFire = pos.o;
                }
            }
        }

    };

    // Update ball state
    this.updateBall = function (ballState) {
        var stateManager = this.systems.stateManager;
        if (!ballState) return;

        // FLICKER FIX: Legacy trail code that writes directly to courtFrame
        // This pollutes the static court background and causes artifacts on non-coordinator
        // Trail system should use dedicated trailFrame overlay instead
        // if (typeof courtFrame !== "undefined" && courtFrame) {
        //     var oldX = stateManager.get('ballX') || 0;
        //     var oldY = stateManager.get('ballY') || 0;
        //     var newX = ballState.x || 0;
        //     var newY = ballState.y || 0;
        //
        //     if ((oldX !== newX || oldY !== newY) && oldX > 0 && oldY > 0) {
        //         // Draw trail dot at old ball position
        //         courtFrame.gotoxy(oldX, oldY);
        //         courtFrame.putmsg(".", LIGHTGRAY | WAS_BROWN);
        //     }
        // }

        stateManager.set("ballX", ballState.x, "mp_ball_update");
        stateManager.set("ballY", ballState.y, "mp_ball_update");

        if (typeof ballState.r === "boolean") {
            stateManager.set("reboundActive", ballState.r, "mp_rebound_update");
        }

        if (typeof ballState.rx === "number") {
            stateManager.set("reboundX", ballState.rx, "mp_rebound_pos");
        }

        if (typeof ballState.ry === "number") {
            stateManager.set("reboundY", ballState.ry, "mp_rebound_pos");
        }

        // Ball carrier (by global ID) - authoritative from server
        if (ballState.c !== undefined) {
            if (ballState.c === null) {
                // No carrier (ball is loose/in rebound)
                stateManager.set("ballCarrier", null, "mp_ball_carrier_clear");
            } else {
                // Map carrier global ID to sprite
                var carrierSprite = this.findSpriteByGlobalId(ballState.c);

                if (carrierSprite) {
                    // ALWAYS trust the coordinator - never reject updates
                    // Rejecting updates causes desync!
                    stateManager.set("ballCarrier", carrierSprite, "mp_ball_carrier_update");

                    // Derive currentTeam from carrier's team immediately (ballCarrier is authoritative)
                    // This eliminates timing gap where carrier updates before separate currentTeam sync
                    var carrierTeam = getPlayerTeamName(carrierSprite);
                    if (carrierTeam) {
                        stateManager.set("currentTeam", carrierTeam, "mp_team_from_carrier");
                    }
                } else {
                    // Sprite not found - this is a real problem
                    log(LOG_WARNING, "NBA JAM MP CLIENT: Could not find sprite for ballCarrier globalId " + ballState.c);
                    stateManager.set("ballCarrier", null, "mp_carrier_not_found");
                }
            }
        }
    };

    // Update general game state
    this.updateGameState = function (state) {
        var stateManager = this.systems.stateManager;
        if (!state) return;

        // Coordinators generate the authoritative snapshot. Re-applying our own
        // broadcasted payload reverts freshly-computed state (e.g. frontcourt
        // flags, timers) back to stale values and causes multiplayer desync. We
        // still drain the queue in reconcile(), but skip mutating state here.
        if (this.isCoordinator) {
            return;
        }

        // Debug: Check if halftime flag is in state
        if (typeof state.ht !== "undefined") {
            debugLog("[MP CLIENT] updateGameState received state.ht = " + state.ht);
        }

        // DEBUG: Check if phase is in state
        debugLog("[MP CLIENT] state.phase = " + (state.phase || "UNDEFINED") + ", typeof=" + typeof state.phase);

        if (state.sc) {
            stateManager.set("score", state.sc, "mp_score_update");
        }

        if (typeof state.cl === "number") {
            stateManager.set("shotClock", state.cl, "mp_shotclock_update");
        }

        if (typeof state.tm === "number") {
            stateManager.set("timeRemaining", state.tm, "mp_time_update");
        }

        if (state.ct) {
            var oldTeam = stateManager.get("currentTeam");
            if (oldTeam !== state.ct) {
                stateManager.set("courtNeedsRedraw", true, "mp_team_change");
            }
            stateManager.set("currentTeam", state.ct, "mp_team_update");
        }

        if (typeof state.ib === "boolean") {
            var inboundingNow = !!state.ib;
            if (this.lastInbounding !== inboundingNow) {
                stateManager.set("courtNeedsRedraw", true, "mp_inbound_change");
            }
            if (!this.isCoordinator) {
                if (!this.lastInbounding && inboundingNow && typeof this.resetPredictionState === "function") {
                    this.resetPredictionState("inbound_start");
                }
                if (this.lastInbounding && !inboundingNow) {
                    this.requestAuthoritativeCatchup(12, "inbound_complete");
                }
            }
            this.lastInbounding = inboundingNow;
            stateManager.set("inbounding", inboundingNow, "mp_inbound_update");
        }

        if (typeof state.fc === "boolean") {
            stateManager.set("frontcourtEstablished", state.fc, "mp_frontcourt_update");
        }

        if (typeof state.sp === "boolean") {
            stateManager.set("shotInProgress", state.sp, "mp_shot_progress");
        }

        if (typeof state.h === "number") {
            var oldHalf = stateManager.get("currentHalf");
            if (oldHalf !== state.h) {
                stateManager.set("courtNeedsRedraw", true, "mp_half_change");
            }
            stateManager.set("currentHalf", state.h, "mp_half_update");
        }

        // Handle halftime transition via state sync
        if (typeof state.ht === "boolean") {
            var wasHalftime = stateManager.get("isHalftime");
            var isHalftime = state.ht;

            debugLog("[MP CLIENT] Halftime state check - wasHalftime:" + wasHalftime + " isHalftime:" + isHalftime);

            // Detect halftime start (transition from false to true)
            if (!wasHalftime && isHalftime) {
                debugLog("[MP CLIENT] Halftime detected via state sync");
                stateManager.set("isHalftime", true, "mp_halftime_start");
                // Note: Halftime screen is now handled in main game loop (Wave 24)
            } else if (wasHalftime && !isHalftime) {
                // Halftime ended
                debugLog("[MP CLIENT] Halftime ended via state sync");
                stateManager.set("isHalftime", false, "mp_halftime_end");
            }
        } else {
            // Debug: log if ht is not in state
            if (typeof state.ht !== "undefined") {
                debugLog("[MP CLIENT] WARNING: state.ht exists but not boolean: " + typeof state.ht + " = " + state.ht);
            }
        }

        if (state.sf) {
            var flashState = getScoreFlashState(this.systems);
            flashState.active = !!state.sf.active;
            flashState.activeTeam = state.sf.activeTeam || null;
            flashState.stopTeam = state.sf.stopTeam || null;
            if (typeof state.sf.startedTick === "number")
                flashState.startedTick = state.sf.startedTick;
            flashState.regainCheckEnabled = !!state.sf.regainCheckEnabled;
        }

        // Apply basket flash (visual-only) from coordinator so clients show the same celebration
        if (state.bf) {
            try {
                var bf = state.bf;
                var basketFlash = this.systems.stateManager.get('basketFlash') || {};
                basketFlash.active = !!bf.active;
                basketFlash.x = bf.x || 0;
                basketFlash.y = bf.y || 0;
                basketFlash.startTime = bf.startTime || Date.now();
                this.systems.stateManager.set('basketFlash', basketFlash, 'mp_basket_flash');
                // Also request a court redraw so the flash is drawn immediately
                // FLICKER FIX: Commenting out - causes excessive redraws every frame
                // this.systems.stateManager.set('courtNeedsRedraw', true, 'mp_bf_redraw');
            } catch (e) {
                if (typeof log === 'function') log(LOG_WARNING, 'MP CLIENT: failed to apply basketFlash: ' + e);
            }
        }        // courtNeedsRedraw no longer synced - each client manages their own
        // (was causing infinite loop where clients kept setting it back to true)

        // Apply announcer state from coordinator so clients display same announcements
        if (state.an) {
            try {
                var announcer = state.an;
                // Only update if this is a new announcement (different timestamp or text)
                var currentAnnouncer = stateManager.get('announcer');
                var isNewAnnouncement = !currentAnnouncer ||
                    currentAnnouncer.timestamp !== announcer.timestamp ||
                    currentAnnouncer.text !== announcer.text;

                if (isNewAnnouncement) {
                    stateManager.set('announcer', {
                        text: announcer.text || "",
                        color: (typeof announcer.color === "number") ? announcer.color : 7,
                        timestamp: announcer.timestamp || 0
                    }, 'mp_announcer');

                    // Redraw announcer line immediately
                    if (typeof drawAnnouncerLine === 'function') {
                        drawAnnouncerLine(this.systems);
                    }
                }
            } catch (e) {
                if (typeof log === 'function') log(LOG_WARNING, 'MP CLIENT: failed to apply announcer: ' + e);
            }
        }

        if (state.of) {
            var onFire = {
                teamA: !!state.of.red,
                teamB: !!state.of.blue
            };
            stateManager.set("onFire", onFire, "mp_onfire_update");
        }

        // Handle multiplayer screen coordination state
        if (state.mps !== undefined) {
            var screenState = state.mps;

            // Pass to screen coordinator if available
            if (this.mpScreenCoordinator) {
                var action = this.mpScreenCoordinator.handleScreenState(screenState);

                if (action) {
                    debugLog("[MP CLIENT] Screen action: " + action.action + " for " + (action.screen || "unknown"));

                    // Store action for main loop to handle
                    // (We can't block here - this is called from reconciliation)
                    stateManager.set("mpScreenAction", action, "mp_screen_action");
                }
            }
        }

        if (state.bp !== undefined) {
            if (state.bp === null) {
                stateManager.set("ballHandlerProgressOwner", null, "mp_progress_clear");
            } else {
                var progressOwner = this.findSpriteByGlobalId(state.bp);
                stateManager.set("ballHandlerProgressOwner", progressOwner, "mp_progress_update");
            }
        }

        // Sync violation tracking fields
        if (typeof state.igp === "number") {
            stateManager.set("inboundGracePeriod", state.igp, "mp_grace_update");
        }

        if (typeof state.bct === "number") {
            stateManager.set("backcourtTimer", state.bct, "mp_backcourt_update");
        }

        if (typeof state.bhst === "number") {
            stateManager.set("ballHandlerStuckTimer", state.bhst, "mp_stuck_update");
        }

        if (typeof state.bhat === "number") {
            stateManager.set("ballHandlerAdvanceTimer", state.bhat, "mp_advance_update");
        }

        // Sync dead dribble / 5-second violation state
        if (state.bhds !== undefined) {
            stateManager.set("ballHandlerDeadSince", state.bhds, "mp_dead_since");
        }

        if (typeof state.bhdf === "number") {
            stateManager.set("ballHandlerDeadFrames", state.bhdf, "mp_dead_frames");
        }

        if (typeof state.cgd === "number") {
            stateManager.set("closelyGuardedDistance", state.cgd, "mp_guarded_dist");
        }

        if (state.anims && state.anims.length) {
            this.applyRemoteAnimations(state.anims);
        }

        // WAVE 24: Apply phase-based prediction tuning
        if (state.phase && typeof state.phase === "string") {
            this.applyPhaseSettings(state.phase);
        }
    };

    this._executeAnimationHint = function (record) {
        if (!record || !record.type) {
            return false;
        }

        var meta = record.meta || {};
        switch (record.type) {
            case 'inbound_walk':
                if (!record.sprite || typeof startInboundWalkAnimation !== 'function') {
                    return false;
                }
                startInboundWalkAnimation(record.sprite, meta, (typeof MP_CONSTANTS === "object") ? MP_CONSTANTS.ANIMATION_HINTS : null);
                return true;
            case 'inbound_ready':
                if (!record.sprite || typeof startInboundReadyAnimation !== 'function') {
                    return false;
                }
                startInboundReadyAnimation(record.sprite, meta, (typeof MP_CONSTANTS === "object") ? MP_CONSTANTS.ANIMATION_HINTS : null);
                return true;
            case 'inbound_target':
                if (!record.sprite || typeof startInboundTargetAnimation !== 'function') {
                    return false;
                }
                startInboundTargetAnimation(record.sprite, meta, (typeof MP_CONSTANTS === "object") ? MP_CONSTANTS.ANIMATION_HINTS : null);
                return true;
            case 'inbound_return':
                // Return phase removed: rely on authoritative position instead of animating back in.
                return true;
            case 'drift_snap':
                if (!record.sprite || typeof startDriftSnapEffect !== 'function') {
                    return false;
                }
                startDriftSnapEffect(record.sprite, meta, (typeof MP_CONSTANTS === "object") ? MP_CONSTANTS.ANIMATION_HINTS : null);
                return true;
            case 'shove_knockback':
                if (typeof knockBack !== 'function') {
                    return false;
                }
                var victimSprite = record.sprite || null;
                if (!victimSprite) {
                    return false;
                }
                var attackerSprite = null;
                if (typeof meta.attackerId === 'number') {
                    attackerSprite = this.findSpriteByGlobalId(meta.attackerId);
                }
                var pushDistance = (typeof meta.pushDistance === 'number') ? meta.pushDistance : null;
                knockBack(victimSprite, attackerSprite, pushDistance);
                return true;
            default:
                return false;
        }
    };

    this.applyAnimationHints = function (entries, serverFrame) {
        if (this.isCoordinator) {
            return;
        }

        var config = (typeof MP_CONSTANTS === "object" && MP_CONSTANTS.ANIMATION_HINTS)
            ? MP_CONSTANTS.ANIMATION_HINTS
            : {};

        if (!this.animationHintCache) {
            this.animationHintCache = { entries: {}, order: [] };
        }

        var cache = this.animationHintCache;
        var defaultTtl = (typeof config.TTL_FRAMES === "number" && config.TTL_FRAMES > 0)
            ? config.TTL_FRAMES
            : 12;
        var referenceFrame = (typeof serverFrame === "number") ? serverFrame : 0;

        for (var i = cache.order.length - 1; i >= 0; i--) {
            var pruneKey = cache.order[i];
            var stale = cache.entries[pruneKey];
            if (!stale || stale.expiresAtFrame <= referenceFrame) {
                cache.order.splice(i, 1);
                delete cache.entries[pruneKey];
            }
        }

        function cloneMeta(meta) {
            if (!meta || typeof meta !== 'object') {
                return {};
            }
            var copy = {};
            for (var metaKey in meta) {
                if (meta.hasOwnProperty(metaKey)) {
                    copy[metaKey] = meta[metaKey];
                }
            }
            return copy;
        }

        if (Array.isArray(entries)) {
            for (var idx = 0; idx < entries.length; idx++) {
                var entry = entries[idx];
                if (!entry || !entry.type || !entry.target) {
                    continue;
                }

                var ttl = (typeof entry.ttl === 'number' && entry.ttl > 0) ? entry.ttl : defaultTtl;
                var expiresAt = referenceFrame + ttl;
                var cacheKey = entry.type + ':' + entry.target;
                var record = cache.entries[cacheKey];
                if (!record) {
                    record = {
                        type: entry.type,
                        targetId: entry.target,
                        meta: cloneMeta(entry.meta),
                        expiresAtFrame: expiresAt,
                        processed: false
                    };
                    cache.entries[cacheKey] = record;
                    cache.order.push(cacheKey);
                } else {
                    record.meta = cloneMeta(entry.meta);
                    record.expiresAtFrame = expiresAt;
                    record.processed = false;
                }
                record.sprite = this.findSpriteByGlobalId(record.targetId);
            }
        }

        for (var j = 0; j < cache.order.length; j++) {
            var lookupKey = cache.order[j];
            var item = cache.entries[lookupKey];
            if (!item || item.expiresAtFrame <= referenceFrame) {
                continue;
            }

            if (item.processed) {
                continue;
            }

            if (!item.sprite || typeof item.sprite.x !== 'number') {
                item.sprite = this.findSpriteByGlobalId(item.targetId);
            }

            if (!item.sprite) {
                continue;
            }

            if (typeof debugLog === "function") {
                try {
                    debugLog("[MP CLIENT] Animation hint type=" + item.type + " target=" + item.targetId);
                } catch (e) { }
            }
            var executed = this._executeAnimationHint(item);
            if (executed) {
                item.processed = true;
            }
        }
    };

    // WAVE 24: Apply phase-based prediction settings
    this.applyPhaseSettings = function (phaseName) {
        // Get phase configuration from constants
        var phaseConfig = null;
        if (typeof MP_CONSTANTS === "object" && MP_CONSTANTS.GAME_PHASES && MP_CONSTANTS.GAME_PHASES[phaseName]) {
            phaseConfig = MP_CONSTANTS.GAME_PHASES[phaseName];
        }

        // Fallback to NORMAL_PLAY if phase not recognized
        if (!phaseConfig && typeof MP_CONSTANTS === "object" && MP_CONSTANTS.GAME_PHASES) {
            phaseConfig = MP_CONSTANTS.GAME_PHASES.NORMAL_PLAY;
            if (typeof debugLog === "function") {
                debugLog("[MP PHASE] Unknown phase '" + phaseName + "', defaulting to NORMAL_PLAY");
            }
        }

        if (!phaseConfig) {
            // No phase constants available, use safe defaults
            return;
        }

        // Store previous settings for transition detection
        var prevPhase = this.currentPhase;
        var prevPrediction = this.disablePrediction;
        var prevStrength = this.currentReconciliationStrength;

        // Apply new phase settings
        this.currentPhase = phaseName;
        this.disablePrediction = !phaseConfig.prediction;
        this.currentReconciliationStrength = phaseConfig.reconciliationStrength;

        // Handle input tapering
        if (phaseConfig.inputTapering) {
            this.inputTaperingActive = true;
            this.inputTaperingFramesRemaining = phaseConfig.taperingFrames || 5;
            this.inputTaperingFactor = phaseConfig.taperingFactor || 0.5;
        } else if (prevPhase !== phaseName) {
            // Phase changed and new phase doesn't use tapering - reset
            this.inputTaperingActive = false;
            this.inputTaperingFramesRemaining = 0;
            this.inputTaperingFactor = 1.0;
        }

        // Log significant phase transitions
        if (prevPhase !== phaseName) {
            if (typeof debugLog === "function") {
                debugLog("[MP PHASE] " + prevPhase + " → " + phaseName +
                    " (prediction=" + !this.disablePrediction +
                    ", strength=" + this.currentReconciliationStrength.toFixed(2) +
                    (this.inputTaperingActive ? ", tapering=" + this.inputTaperingFramesRemaining + "f" : "") +
                    ")");
            }
        }
    };

    // Reconcile my position with server
    this.reconcileMyPosition = function (serverState) {
        if (!this.mySprite || !serverState.p) return;

        // Find my position in server state using index map
        var myServerPos = this.getMyPositionFromState(serverState.p, serverState.m);
        if (!myServerPos) return;

        if (this.mySprite.__mpHintLock) {
            if (typeof debugLog === "function") {
                debugLog("[MP CLIENT] Reconcile skipped due to animation lock (frame=" + (serverState.f || 0) + ")");
            }
            if (this.mySprite.playerData) {
                this.mySprite.playerData.lastAuthoritativeX = myServerPos.x;
                this.mySprite.playerData.lastAuthoritativeY = myServerPos.y;
            }
            this.pendingInputs = this.pendingInputs.filter(function (input) {
                return input.frame > serverState.f;
            });
            return;
        }

        // WAVE 24 FLICKER FIX: Handle forced position reset from server
        if (myServerPos.fp) {
            if (typeof debugLog === "function") {
                debugLog("[MP RECONCILE SNAP] Forced position reset received. Snapping to (" + myServerPos.x + "," + myServerPos.y + ") and clearing inputs.");
            }
            if (typeof this.resetPredictionState === "function") {
                this.resetPredictionState("forced_position");
            } else {
                this.pendingInputs = [];
                this.authoritativeCatchupFrames = 0;
            }
            this._stageSpriteCommit("forced_position", myServerPos.x, myServerPos.y, {
                bearing: myServerPos.b
            });
            this._applyStagedSpriteCommit();

            // We've snapped, so we can skip the rest of the reconciliation logic for this frame.
            return;
        }

        // Calculate position difference
        var dx = Math.abs(this.mySprite.x - myServerPos.x);
        var dy = Math.abs(this.mySprite.y - myServerPos.y);
        var deltaMagnitude = Math.sqrt((dx * dx) + (dy * dy));
        var tick = this.getCurrentTick();
        var catchupActive = this.authoritativeCatchupFrames > 0;
        var skipAuthority = false;

        // Log reconciliation attempts for debugging flicker
        if (typeof debugLog === "function" && deltaMagnitude > 0.5) {
            debugLog("[MP RECONCILE] tick=" + tick + " delta=" + deltaMagnitude.toFixed(2) +
                " catchup=" + catchupActive +
                " lastPredTick=" + this.visualGuard.lastPredictionTick +
                " sprite=(" + this.mySprite.x + "," + this.mySprite.y + ")" +
                " server=(" + myServerPos.x + "," + myServerPos.y + ")");
        }

        if (!this.isCoordinator && !catchupActive && deltaMagnitude <= VISUAL_GUARD_SMALL_DELTA) {
            // WAVE 24 FIX: Check if prediction was RECENT (within 3 ticks), not exact match
            // Reconciliation runs every ~2 ticks (83ms @ 20 FPS), so by the time it runs,
            // tick has already advanced past the prediction tick. Need to suppress for window.
            var ticksSincePrediction = tick - this.visualGuard.lastPredictionTick;
            var recentPrediction = ticksSincePrediction >= 0 && ticksSincePrediction <= 3;

            if (recentPrediction && this.visualGuard.suppressedAuthorityFrames < VISUAL_GUARD_SUPPRESSION_FRAMES) {
                skipAuthority = true;
                this.visualGuard.suppressedAuthorityFrames++;
                this.visualGuard.pendingAuthority = {
                    x: myServerPos.x,
                    y: myServerPos.y,
                    magnitude: deltaMagnitude,
                    frame: serverState.f
                };
                if (typeof debugLog === "function") {
                    debugLog("[MP VISUAL GUARD] Suppressed authority update - delta=" + deltaMagnitude.toFixed(2) +
                        " tick=" + tick + " ticksSince=" + ticksSincePrediction + " suppressCount=" + this.visualGuard.suppressedAuthorityFrames);
                }
                this.visualGuard.lastLoggedSuppressionTick = tick;
            }
        }

        if (skipAuthority) {
            // Keep pending authority data for next frame but still allow drift logging below
        } else {
            this.visualGuard.pendingAuthority = null;
            this.visualGuard.suppressedAuthorityFrames = 0;
        }

        // Track drift metrics for diagnostics
        if (!this.driftMonitor) {
            this.driftMonitor = {
                maxDelta: 0,
                lastLoggedDelta: 0,
                lastLoggedAt: 0
            };
        }
        if (deltaMagnitude > this.driftMonitor.maxDelta) {
            this.driftMonitor.maxDelta = deltaMagnitude;
        }

        if (!this.isCoordinator) {
            var now = Date.now();
            var shouldLog = false;
            if (deltaMagnitude > this.driftMonitor.lastLoggedDelta + 0.75) {
                shouldLog = true;
            } else if (deltaMagnitude > 1.5 && (now - this.driftMonitor.lastLoggedAt) > 5000) {
                shouldLog = true;
            }

            if (shouldLog) {
                if (typeof debugLog === "function") {
                    debugLog("[MP CLIENT] Position drift delta=" + deltaMagnitude.toFixed(2) +
                        " (dx=" + dx.toFixed(2) + ", dy=" + dy.toFixed(2) + ")");
                }
                this.driftMonitor.lastLoggedDelta = deltaMagnitude;
                this.driftMonitor.lastLoggedAt = now;
            }
        }

        // Get reconciliation strength - use phase-based if available, otherwise network quality
        var strength = this.currentReconciliationStrength || 0.3;

        // WAVE 24: Override with network adaptive tuning if it's stronger
        var tuning = this.networkMonitor.getAdaptiveTuning();
        if (tuning && tuning.reconciliationStrength) {
            // Use whichever is more conservative (lower = gentler corrections)
            strength = Math.min(strength, tuning.reconciliationStrength);
        }

        // WAVE 24: Apply input tapering if in recovery mode
        if (this.inputTaperingActive && this.inputTaperingFramesRemaining > 0) {
            strength *= this.inputTaperingFactor;
            this.inputTaperingFramesRemaining--;

            if (this.inputTaperingFramesRemaining === 0) {
                this.inputTaperingActive = false;
                if (typeof debugLog === "function") {
                    debugLog("[MP PHASE] Input tapering complete");
                }
            }
        }

        var forceDriftSnap = !this.isCoordinator && deltaMagnitude >= DRIFT_SNAP_THRESHOLD;
        if (forceDriftSnap) {
            if (typeof debugLog === "function") {
                debugLog("[MP DRIFT SNAP] delta=" + deltaMagnitude.toFixed(2) + " tick=" + tick + " threshold=" + DRIFT_SNAP_THRESHOLD);
            }
            this.pendingInputs = [];
            if (typeof this.resetPredictionState === "function") {
                this.resetPredictionState("drift_snap");
            }
            this.requestAuthoritativeCatchup(15, "drift_snap");
            this.visualGuard.pendingAuthority = null;
            this.visualGuard.suppressedAuthorityFrames = 0;
            this._stageSpriteCommit("drift_snap", myServerPos.x, myServerPos.y, {
                bearing: myServerPos.b
            });
            this._applyStagedSpriteCommit();
            return;
        }

        if (!skipAuthority) {
            // Non-coordinator: only reconcile for significant deviations
            // This prevents flicker from fighting with prediction while still catching desyncs
            if (!this.isCoordinator) {
                var minStrength = 0.12;
                var maxStrength = 0.35;

                if (deltaMagnitude < 1) {
                    maxStrength = 0.20;
                } else if (deltaMagnitude < 3) {
                    maxStrength = 0.25;
                } else if (deltaMagnitude < 6) {
                    maxStrength = 0.30;
                } else if (deltaMagnitude < 15) {
                    maxStrength = 0.35; // Keep moderate corrections to avoid flicker while converging
                } else {
                    maxStrength = 0.65;
                }

                if (catchupActive) {
                    minStrength = Math.max(minStrength, 0.2);
                    maxStrength = Math.max(maxStrength, 0.5);
                }

                strength = Math.min(strength, maxStrength);
                if (strength < minStrength) {
                    strength = minStrength;
                }
                // Large differences (>15 pixels) fall through to snap logic below
            }

            var mediumThreshold = catchupActive ? 3.5 : 5.0;
            var snapThreshold = catchupActive ? 7.0 : 10.0;

            if (!this.isCoordinator && this.visualGuard.lastPredictionTick === tick) {
                if (this.visualGuard.lastLoggedDoubleTick !== tick && typeof debugLog === "function") {
                    debugLog("[MP CLIENT] Visual guard detected same-tick authority+prediction (delta=" + deltaMagnitude.toFixed(2) + ")");
                    this.visualGuard.lastLoggedDoubleTick = tick;
                }
            }

            var basePos = this._getStagedSpritePosition();
            var nextX = basePos.x;
            var nextY = basePos.y;
            var stagedBearing;

            if (deltaMagnitude < 0.75) {
                nextX = basePos.x + (myServerPos.x - basePos.x) * strength;
                nextY = basePos.y + (myServerPos.y - basePos.y) * strength;
                if (typeof debugLog === "function" && deltaMagnitude > 0.1) {
                    debugLog("[MP RECONCILE APPLY] Small correction delta=" + deltaMagnitude.toFixed(2) + " strength=" + strength.toFixed(2));
                }
            } else if (deltaMagnitude < mediumThreshold) {
                nextX = basePos.x + (myServerPos.x - basePos.x) * strength;
                nextY = basePos.y + (myServerPos.y - basePos.y) * strength;
                if (typeof debugLog === "function") {
                    debugLog("[MP RECONCILE APPLY] Medium correction delta=" + deltaMagnitude.toFixed(2) + " strength=" + strength.toFixed(2));
                }
            } else if (deltaMagnitude < snapThreshold) {
                var blendStrength = catchupActive ? Math.max(strength, 0.4) : (strength * 1.25);
                nextX = basePos.x + (myServerPos.x - basePos.x) * blendStrength;
                nextY = basePos.y + (myServerPos.y - basePos.y) * blendStrength;
                if (typeof debugLog === "function") {
                    debugLog("[MP RECONCILE APPLY] Large correction delta=" + deltaMagnitude.toFixed(2) + " blendStrength=" + blendStrength.toFixed(2));
                }
            } else {
                nextX = myServerPos.x;
                nextY = myServerPos.y;

                // Clear pending inputs (we're out of sync)
                this.pendingInputs = [];
                if (typeof debugLog === "function") {
                    debugLog("[MP RECONCILE SNAP] Snap correction delta=" + deltaMagnitude.toFixed(2) + " (cleared pending inputs)");
                }
            }

            // Update bearing from server only when delta is meaningful or we skipped prediction this tick
            if (myServerPos.b) {
                var allowBearingUpdate = catchupActive || (this.visualGuard.lastPredictionTick !== tick) || (deltaMagnitude >= VISUAL_GUARD_BEARING_THRESHOLD);
                if (allowBearingUpdate) {
                    stagedBearing = myServerPos.b;
                }
            }

            this._stageSpriteCommit(deltaMagnitude >= snapThreshold ? "authority_snap" : "authority_blend", nextX, nextY, {
                bearing: stagedBearing
            });

            this.visualGuard.lastAuthorityTick = tick;
        }

        // Remove inputs that server has confirmed
        this.pendingInputs = this.pendingInputs.filter(function (input) {
            return input.frame > serverState.f;
        });

        if (!skipAuthority && this.authoritativeCatchupFrames > 0) {
            this.authoritativeCatchupFrames = Math.max(0, this.authoritativeCatchupFrames - 1);
        }

        this._applyStagedSpriteCommit();
    };

    // Get my position from server state
    this.getMyPositionFromState = function (positions, indexMap) {
        if (!positions || !indexMap) return null;

        // Get my index from the map
        var myIndex = indexMap[this.myPlayerId];
        if (typeof myIndex !== "number") return null;

        // Return my position from the array
        return positions[myIndex] || null;
    };

    this.buildEventSignature = function (event) {
        if (!event)
            return null;
        var parts = [
            event.type || "",
            (typeof event.frame === "number") ? event.frame : "",
            (typeof event.timestamp === "number") ? event.timestamp : ""
        ];
        if (event.data) {
            if (event.data.shooter)
                parts.push("s:" + event.data.shooter);
            if (event.data.player)
                parts.push("p:" + event.data.player);
            if (event.data.team)
                parts.push("t:" + event.data.team);
        }
        return parts.join("|");
    };

    // Process game events
    this.processEvents = function () {
        // DISABLED: Event processing removed in favor of Queue-based state sync
        // Database event broadcasting was causing JSON overflow (Bug #27)
        // All synchronization now handled through stateQueue in reconcile()
        return;
    };

    // Handle a game event
    this.handleEvent = function (event) {
        if (!event || !event.type) return;

        switch (event.type) {
            case "announcer":
                // Display announcer message from coordinator
                // Skip if we ARE the coordinator (already displayed locally in announceEvent)
                if (typeof announce === "function" && event.data) {
                    var isCoordinator = (mpCoordinator && mpCoordinator.isCoordinator);
                    if (!isCoordinator) {
                        announce(event.data.message, event.data.color, this.systems);
                    }
                }
                break;

            case "shot_executed":
                // Queue non-blocking shot animation
                if (typeof animationSystem !== "undefined" && animationSystem && event.data) {
                    var shooterSprite = this.findSpriteByGlobalId(event.data.shooter);
                    animationSystem.queueShotAnimation(
                        event.data.startX,
                        event.data.startY,
                        event.data.targetX,
                        event.data.targetY,
                        event.data.made,
                        event.data.blocked,
                        shooterSprite,
                        event.data.durationMs,
                        event.data.reboundBounces  // Extract rebound data from event
                    );
                }
                break;

            case "pass_executed":
                // Queue non-blocking pass animation
                if (typeof animationSystem !== "undefined" && animationSystem && event.data) {
                    var interceptorSprite = this.findSpriteByGlobalId(event.data.interceptor);
                    animationSystem.queuePassAnimation(
                        event.data.startX,
                        event.data.startY,
                        event.data.endX,
                        event.data.endY,
                        { interceptor: interceptorSprite },  // Wave 22B: stateData param
                        event.data.durationMs,
                        null  // Wave 22B: No callback - multiplayer client doesn't mutate state from animations
                    );
                }
                break;

            case "rebound_executed":
                // Queue non-blocking rebound animation
                if (typeof animationSystem !== "undefined" && animationSystem && event.data) {
                    animationSystem.queueReboundAnimation(event.data.bounces);
                }
                break;

            case "shot":
                // Legacy event (deprecated - use shot_executed)
                break;

            case "pass":
                // Legacy event (deprecated - use pass_executed)
                break;

            case "score":
                // Play score sound, update announcer, etc.
                if (typeof announce === "function" && event.data) {
                    announce(event.data.message, event.data.color, this.systems);
                }
                break;

            case "dunk":
                // Play dunk sound/animation
                break;

            case "block":
                // Play block sound/animation
                break;

            case "steal":
                // Play steal sound
                break;

            // OPTION B SYNC: Coordinator state broadcasts
            case "shove":
                this.handleShoveEvent(event.data);
                break;

            case "reboundSecured":
                this.handleReboundSecuredEvent(event.data);
                break;

            case "reboundCreated":
                this.handleReboundCreatedEvent(event.data);
                break;

            case "turboUpdate":
                this.handleTurboUpdateEvent(event.data);
                break;

            case "cooldownSync":
                this.handleCooldownSyncEvent(event.data);
                break;

            case "deadDribbleUpdate":
                this.handleDeadDribbleUpdateEvent(event.data);
                break;

            case "halftime_start":
                this.handleHalftimeEvent(event.data);
                break;
        }
    };

    // OPTION B SYNC: Handle shove event from coordinator
    this.handleShoveEvent = function (data) {
        if (!data) return;

        var stateManager = this.systems && this.systems.stateManager ? this.systems.stateManager : null;
        var attacker = this.findSpriteByGlobalId(data.attackerId);
        var victim = this.findSpriteByGlobalId(data.victimId);

        if (!attacker || !victim) return;
        if (!attacker.playerData || !victim.playerData) return;

        if (!this.isCoordinator) {
            var involvesLocal = (String(data.attackerId) === String(this.myPlayerId)) ||
                (String(data.victimId) === String(this.myPlayerId));
            if (involvesLocal) {
                this.requestAuthoritativeCatchup(8, "shove_resolution");
            }
        }

        // Apply coordinator's shove result
        if (data.success) {
            // Successful shove: apply knockback
            if (typeof data.victimPos === "object") {
                if (victim.moveTo) {
                    victim.moveTo(Math.round(data.victimPos.x), Math.round(data.victimPos.y));
                } else {
                    victim.x = data.victimPos.x;
                    victim.y = data.victimPos.y;
                }
            }

            // Apply cooldowns
            if (typeof data.attackerCooldown === "number") {
                attacker.playerData.shoveCooldown = data.attackerCooldown;
            }
            if (typeof data.victimCooldown === "number") {
                victim.playerData.shoverCooldown = data.victimCooldown;
            }

            // Handle loose ball creation
            if (data.createdLooseBall) {
                if (stateManager) {
                    stateManager.set("ballCarrier", null, "mp_loose_ball");
                }
                if (typeof data.ballPos === "object") {
                    if (stateManager) {
                        stateManager.set("ballX", data.ballPos.x, "mp_loose_ball_pos");
                        stateManager.set("ballY", data.ballPos.y, "mp_loose_ball_pos");
                    }
                }
            }
        } else {
            // Failed shove: apply stun
            if (typeof data.stunCooldown === "number") {
                attacker.playerData.shoveFailureStun = data.stunCooldown;
            }
        }
    };

    // OPTION B SYNC: Handle rebound secured event
    this.handleReboundSecuredEvent = function (data) {
        var stateManager = this.systems.stateManager;
        if (!data) return;

        // WAVE 21: Validate player ID
        var idCheck = validatePlayerId(data.playerId);
        if (!idCheck.valid) {
            log(LOG_WARNING, "MP: Invalid playerId in rebound event: " + idCheck.error);
            return;
        }

        var rebounder = this.findSpriteByGlobalId(idCheck.playerId);
        if (!rebounder) return;

        // Clear rebound state
        stateManager.set("reboundActive", false, "mp_rebound_secured");
        var reboundScramble = stateManager.get('reboundScramble');
        if (reboundScramble) {
            reboundScramble.active = false;
        }

        // Award possession
        if (data.newPossession) {
            stateManager.set("currentTeam", data.newPossession, "mp_rebound_possession");
        }
        stateManager.set("ballCarrier", rebounder, "mp_rebound_carrier");

        // Update shot clock
        if (typeof data.shotClock === "number") {
            stateManager.set("shotClock", data.shotClock, "mp_rebound_shotclock");
        }

        // Update rebound stats
        if (rebounder.playerData && rebounder.playerData.stats && typeof data.reboundStats === "number") {
            rebounder.playerData.stats.rebounds = data.reboundStats;
        }

        // Update position
        if (typeof data.playerPos === "object") {
            if (rebounder.moveTo) {
                rebounder.moveTo(Math.round(data.playerPos.x), Math.round(data.playerPos.y));
            } else {
                rebounder.x = data.playerPos.x;
                rebounder.y = data.playerPos.y;
            }
        }
    };

    // OPTION B SYNC: Handle rebound created event
    this.handleReboundCreatedEvent = function (data) {
        var stateManager = this.systems.stateManager;
        if (!data) return;

        // Set rebound position
        if (typeof data.reboundPos === "object") {
            stateManager.set("reboundX", data.reboundPos.x, "mp_rebound_created");
            stateManager.set("reboundY", data.reboundPos.y, "mp_rebound_created");
        }

        // Start scramble state
        stateManager.set('reboundActive', true, 'mp_rebound_created');
        var reboundScramble = stateManager.get('reboundScramble');
        if (reboundScramble) {
            reboundScramble.active = true;
            reboundScramble.reboundX = data.reboundPos.x;
            reboundScramble.reboundY = data.reboundPos.y;
            if (typeof data.scrambleStart === "number") {
                reboundScramble.startTime = data.scrambleStart;
            }
            reboundScramble.anticipating = false;
            stateManager.set('reboundScramble', reboundScramble, 'mp_rebound_scramble');
        }

        // Queue rebound animation if available
        if (data.bounces && typeof animationSystem !== "undefined" && animationSystem) {
            animationSystem.queueReboundAnimation(data.bounces);
        }
    };

    // OPTION B SYNC: Handle turbo update event
    this.handleTurboUpdateEvent = function (data) {
        if (!data) return;

        // WAVE 21: Validate player ID
        var idCheck = validatePlayerId(data.playerId);
        if (!idCheck.valid) {
            log(LOG_WARNING, "MP: Invalid playerId in turbo event: " + idCheck.error);
            return;
        }

        var player = this.findSpriteByGlobalId(idCheck.playerId);
        if (!player || !player.playerData) return;

        // Apply coordinator's turbo value
        if (typeof data.turbo === "number") {
            player.playerData.turbo = data.turbo;
        }
    };

    // OPTION B SYNC: Handle cooldown sync event
    this.handleCooldownSyncEvent = function (data) {
        if (!data || !data.cooldowns) return;

        // Apply all cooldown values from coordinator
        for (var playerId in data.cooldowns) {
            if (!data.cooldowns.hasOwnProperty(playerId)) continue;

            var player = this.findSpriteByGlobalId(playerId);
            if (!player || !player.playerData) continue;

            var cooldowns = data.cooldowns[playerId];
            if (typeof cooldowns.shake === "number") {
                player.playerData.shakeCooldown = cooldowns.shake;
            }
            if (typeof cooldowns.shove === "number") {
                player.playerData.shoveCooldown = cooldowns.shove;
            }
            if (typeof cooldowns.shoveAttempt === "number") {
                player.playerData.shoveAttemptCooldown = cooldowns.shoveAttempt;
            }
            if (typeof cooldowns.shover === "number") {
                player.playerData.shoverCooldown = cooldowns.shover;
            }
            if (typeof cooldowns.stun === "number") {
                player.playerData.shoveFailureStun = cooldowns.stun;
            }
            if (typeof cooldowns.knockdown === "number") {
                player.playerData.knockdownTimer = cooldowns.knockdown;
            }
        }
    };

    // OPTION B SYNC: Handle dead dribble timer update
    this.handleDeadDribbleUpdateEvent = function (data) {
        if (!data || typeof stateManager === "undefined") return;

        // Apply coordinator's dead dribble state
        if (typeof data.frames === "number") {
            stateManager.set('ballHandlerDeadFrames', data.frames, 'mp_dead_dribble');
        }
        if (data.since !== undefined) {
            stateManager.set('ballHandlerDeadSince', data.since, 'mp_dead_dribble');
        }
        if (typeof data.forced === "boolean") {
            stateManager.set('ballHandlerDeadForcedShot', data.forced, 'mp_dead_dribble');
        }
    };

    // OPTION B SYNC: Handle halftime event from coordinator
    this.handleHalftimeEvent = function (data) {
        debugLog("[MP CLIENT] handleHalftimeEvent() CALLED, data: " + JSON.stringify(data));

        if (!data || !this.systems || !this.systems.stateManager) {
            debugLog("[MP CLIENT] handleHalftimeEvent() EARLY RETURN - data:" + !!data + " systems:" + !!this.systems + " stateManager:" + !!(this.systems && this.systems.stateManager));
            return;
        }

        try {
            var stateManager = this.systems.stateManager;

            // Update game state from coordinator
            if (typeof data.currentHalf === "number") {
                stateManager.set('currentHalf', data.currentHalf, 'mp_halftime');
            }
            if (typeof data.teamAScore === "number") {
                var score = stateManager.get('score') || {};
                score.teamA = data.teamAScore;
                stateManager.set('score', score, 'mp_halftime_score');
            }
            if (typeof data.teamBScore === "number") {
                var score = stateManager.get('score') || {};
                score.teamB = data.teamBScore;
                stateManager.set('score', score, 'mp_halftime_score');
            }
            if (typeof data.timeRemaining === "number") {
                stateManager.set('timeRemaining', data.timeRemaining, 'mp_halftime');
            }

            // Note: Halftime screen is now handled in main game loop (Wave 24)
            debugLog("[MP HALFTIME] Halftime event received, screen handled by main loop");
        } catch (e) {
            log(LOG_ERR, "NBA JAM MP: Error handling halftime event: " + e);
        }
    };

    // Send screen ready vote to coordinator (via dedicated Queue)
    this.sendScreenReadyVote = function (playerId, choice) {
        if (!playerId || !this.sessionId) {
            debugLog("[MP CLIENT] Cannot send screen vote - missing playerId or sessionId");
            return false;
        }

        try {
            // Write vote to coordinator's screen vote queue
            var voteQueue = new Queue("nba_jam.game." + this.sessionId + ".screen_votes");

            var votePacket = {
                playerId: playerId,
                choice: choice || null, // For game over voting
                timestamp: Date.now()
            };

            voteQueue.write(votePacket);
            debugLog("[MP CLIENT] Sent screen ready vote for " + playerId + (choice ? " (choice: " + choice + ")" : ""));

            return true;
        } catch (e) {
            log(LOG_WARNING, "NBA JAM MP: Failed to send screen vote: " + e);
            return false;
        }
    };

    // Get network quality display for HUD
    this.getNetworkDisplay = function () {
        if (!this.networkMonitor) return null;
        return this.networkMonitor.getQualityDisplay();
    };

    // Cleanup
    this.cleanup = function () {
        // Force flush any remaining inputs via Queue
        this.inputBuffer.forceFlush(this.inputQueue);

        // Clear input replay history
        if (typeof clearInputHistory === "function") {
            clearInputHistory();
        }

        // Clean up Queue objects
        this.stateQueue = null;
        this.inputQueue = null;
        this.processedEventSignatures = [];

        // Event system disabled (Bug #27) - all sync via Queues
        this.animationHintCache = null;
    };
}

var clientGlobal = (typeof global !== "undefined") ? global : this;
if (clientGlobal) {
    clientGlobal.PlayerClient = PlayerClient;
}
