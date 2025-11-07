// mp_client.js - Multiplayer Client-Side Prediction & Reconciliation
// Handles local input prediction and syncs with server state

load(js.exec_dir + "lib/multiplayer/mp_identity.js");
load(js.exec_dir + "lib/multiplayer/mp_network.js");

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

function PlayerClient(sessionId, client, myPlayerId, serverConfig) {
    this.sessionId = sessionId;
    this.client = client;
    this.myPlayerId = myPlayerId;
    this.serverConfig = serverConfig;

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

    // Network monitor
    this.networkMonitor = new NetworkMonitor(client, sessionId);

    // Last state update
    this.lastState = null;

    // State reconciliation timing (throttle to match coordinator broadcast rate)
    this.stateCheckInterval = 50; // Check every 50ms (20 Hz)
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

        var turboIntent = (this.mySprite.playerData && this.mySprite.playerData.turboActive);
        if (turboIntent && this.mySprite.playerData && typeof this.mySprite.playerData.useTurbo === "function") {
            this.mySprite.playerData.useTurbo(TURBO_DRAIN_RATE);
        }

        // 1. Apply input immediately (client-side prediction)
        // Skip if we're the coordinator (coordinator applies from queue authoritatively)
        if (!this.disablePrediction && typeof applyMovementCommand === "function") {
            var budget = (typeof createMovementCounters === "function")
                ? createMovementCounters(this.mySprite, turboIntent)
                : null;
            if (budget && budget.moves > 0) {
                var counters = {
                    horizontal: Math.max(0, budget.horizontal),
                    vertical: Math.max(0, budget.vertical)
                };
                for (var m = 0; m < budget.moves; m++) {
                    if (!applyMovementCommand(this.mySprite, key, counters)) break;
                }
            } else if (!budget) {
                applyMovementCommand(this.mySprite, key);
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
    };

    // Update (called each frame)
    this.update = function (frameNumber) {
        // Flush input buffer periodically via Queue
        var flushedPacket = this.inputBuffer.flush(this.inputQueue);
        if (flushedPacket && this.isCoordinator && typeof mpCoordinator !== "undefined" && mpCoordinator && typeof mpCoordinator.queueLocalInputPacket === "function") {
            mpCoordinator.queueLocalInputPacket(this.myPlayerId, flushedPacket);
        }

        // Check network quality and adjust
        this.networkMonitor.ping();
        this.adaptToNetworkQuality();

        // Reconcile with server state (no DB overhead with Queue)
        var now = Date.now();
        if (now - this.lastStateCheck >= this.stateCheckInterval) {
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

        // Reconcile my position
        this.reconcileMyPosition(serverState);

        // Process events
        this.processEvents();
    };

    // Update other players' positions
    this.updateOtherPlayers = function (positions, indexMap) {
        if (!positions || !Array.isArray(positions)) return;
        if (!indexMap) return; // Need the mapping to apply positions correctly

        // Smoother interpolation for snappier response
        var smoothFactor = 0.95; // High value for less visible jumping

        // Iterate through each player by global ID
        for (var globalId in indexMap) {
            if (!indexMap.hasOwnProperty(globalId)) continue;

            // Find the sprite for this player
            var sprite = this.findSpriteByGlobalId(globalId);
            if (!sprite) continue;
            if (!sprite.playerData) {
                sprite.playerData = {};
            }

            // Skip updates for sprites we control locally
            if (this.isCoordinator) {
                // Coordinator only updates remote human sprites (other players' inputs)
                // Skip local and AI sprites (coordinator controls these authoritatively)
                if (sprite.controllerType !== "remote") continue;
            } else {
                // Non-coordinator skips own sprite (handled by client prediction)
                if (globalId === this.myPlayerId) continue;
            }

            // Get position index for this player
            var posIndex = indexMap[globalId];
            var pos = positions[posIndex];
            if (!pos) continue;

            var targetX = (typeof pos.x === "number") ? pos.x : sprite.x;
            var targetY = (typeof pos.y === "number") ? pos.y : sprite.y;

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

            var nextX = currentX;
            var nextY = currentY;

            if (absDx < 0.001 && absDy < 0.001) {
                nextX = targetX;
                nextY = targetY;
            } else if (absDx >= 2 || absDy >= 2) {
                nextX = targetX;
                nextY = targetY;
            } else if (lastAuthX === targetX && lastAuthY === targetY) {
                nextX = targetX;
                nextY = targetY;
            } else {
                nextX = currentX + deltaX * smoothFactor;
                nextY = currentY + deltaY * smoothFactor;
            }

            if (pos.b) {
                sprite.bearing = pos.b;
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
        if (!ballState || typeof gameState === "undefined") return;

        // Draw trail dot at old position if ball moved
        if (typeof courtFrame !== "undefined" && courtFrame) {
            var oldX = gameState.ballX || 0;
            var oldY = gameState.ballY || 0;
            var newX = ballState.x || 0;
            var newY = ballState.y || 0;

            if ((oldX !== newX || oldY !== newY) && oldX > 0 && oldY > 0) {
                // Draw trail dot at old ball position
                courtFrame.gotoxy(oldX, oldY);
                courtFrame.putmsg(".", LIGHTGRAY | WAS_BROWN);
            }
        }

        gameState.ballX = ballState.x;
        gameState.ballY = ballState.y;

        if (typeof ballState.r === "boolean") {
            gameState.reboundActive = ballState.r;
        }

        if (typeof ballState.rx === "number") {
            gameState.reboundX = ballState.rx;
        }

        if (typeof ballState.ry === "number") {
            gameState.reboundY = ballState.ry;
        }

        // Ball carrier (by global ID) - authoritative from server
        if (ballState.c !== undefined) {
            if (ballState.c === null) {
                // No carrier (ball is loose/in rebound)
                gameState.ballCarrier = null;
            } else {
                // Map carrier global ID to sprite
                var carrierSprite = this.findSpriteByGlobalId(ballState.c);

                if (carrierSprite) {
                    // ALWAYS trust the coordinator - never reject updates
                    // Rejecting updates causes desync!
                    gameState.ballCarrier = carrierSprite;

                    // Derive currentTeam from carrier's team immediately (ballCarrier is authoritative)
                    // This eliminates timing gap where carrier updates before separate currentTeam sync
                    var carrierTeam = getPlayerTeamName(carrierSprite);
                    if (carrierTeam) {
                        gameState.currentTeam = carrierTeam;
                    }
                } else {
                    // Sprite not found - this is a real problem
                    log(LOG_WARNING, "NBA JAM MP CLIENT: Could not find sprite for ballCarrier globalId " + ballState.c);
                    gameState.ballCarrier = null;
                }
            }
        }
    };

    // Update general game state
    this.updateGameState = function (state) {
        if (!state || typeof gameState === "undefined") return;

        if (state.sc) {
            gameState.score = state.sc;
        }

        if (typeof state.cl === "number") {
            gameState.shotClock = state.cl;
        }

        if (typeof state.tm === "number") {
            gameState.timeRemaining = state.tm;
        }

        if (state.ct) {
            gameState.currentTeam = state.ct;
        }

        if (typeof state.ib === "boolean") {
            gameState.inbounding = state.ib;
        }

        if (typeof state.fc === "boolean") {
            gameState.frontcourtEstablished = state.fc;
        }

        if (typeof state.sp === "boolean") {
            gameState.shotInProgress = state.sp;
        }

        if (typeof state.h === "number") {
            gameState.currentHalf = state.h;
        }

        if (state.sf) {
            var flashState = getScoreFlashState();
            flashState.active = !!state.sf.active;
            flashState.activeTeam = state.sf.activeTeam || null;
            flashState.stopTeam = state.sf.stopTeam || null;
            if (typeof state.sf.startedTick === "number")
                flashState.startedTick = state.sf.startedTick;
            flashState.regainCheckEnabled = !!state.sf.regainCheckEnabled;
        }

        if (state.of) {
            gameState.onFire = {
                red: !!state.of.teamA,
                blue: !!state.of.teamB
            };
        }

        if (state.bp !== undefined) {
            if (state.bp === null) {
                gameState.ballHandlerProgressOwner = null;
            } else {
                gameState.ballHandlerProgressOwner = this.findSpriteByGlobalId(state.bp);
            }
        }

        // Sync violation tracking fields
        if (typeof state.igp === "number") {
            gameState.inboundGracePeriod = state.igp;
        }

        if (typeof state.bct === "number") {
            gameState.backcourtTimer = state.bct;
        }

        if (typeof state.bhst === "number") {
            gameState.ballHandlerStuckTimer = state.bhst;
        }

        if (typeof state.bhat === "number") {
            gameState.ballHandlerAdvanceTimer = state.bhat;
        }

        // Sync dead dribble / 5-second violation state
        if (state.bhds !== undefined) {
            gameState.ballHandlerDeadSince = state.bhds;
        }

        if (typeof state.bhdf === "number") {
            gameState.ballHandlerDeadFrames = state.bhdf;
        }

        if (typeof state.cgd === "number") {
            gameState.closelyGuardedDistance = state.cgd;
        }
    };

    // Reconcile my position with server
    this.reconcileMyPosition = function (serverState) {
        if (!this.mySprite || !serverState.p) return;

        // Find my position in server state using index map
        var myServerPos = this.getMyPositionFromState(serverState.p, serverState.m);
        if (!myServerPos) return;

        // Calculate position difference
        var dx = Math.abs(this.mySprite.x - myServerPos.x);
        var dy = Math.abs(this.mySprite.y - myServerPos.y);

        // Get reconciliation strength from network quality
        var tuning = this.networkMonitor.getAdaptiveTuning();
        var strength = tuning ? tuning.reconciliationStrength : 0.3;

        // Non-coordinator: only reconcile for significant deviations
        // This prevents flicker from fighting with prediction while still catching desyncs
        if (!this.isCoordinator) {
            // Ignore very small differences (< 5 pixels) - trust client prediction
            if (dx < 5 && dy < 5) {
                return;
            }
            // For moderate differences (5-15 pixels), use gentle correction
            if (dx < 15 && dy < 15) {
                strength = 0.05; // Much gentler 5% correction to avoid flicker
            }
            // Large differences (>15 pixels) fall through to snap logic below
        }

        // Small difference - smooth correction
        if (dx < 3 && dy < 3) {
            this.mySprite.x += (myServerPos.x - this.mySprite.x) * strength;
            this.mySprite.y += (myServerPos.y - this.mySprite.y) * strength;
        }
        // Moderate difference - smooth correction with adjusted strength
        else if (dx < 10 || dy < 10) {
            this.mySprite.x += (myServerPos.x - this.mySprite.x) * strength;
            this.mySprite.y += (myServerPos.y - this.mySprite.y) * strength;
        }
        // Large difference - snap to server (misprediction)
        else if (dx > 10 || dy > 10) {
            this.mySprite.x = myServerPos.x;
            this.mySprite.y = myServerPos.y;

            // Clear pending inputs (we're out of sync)
            this.pendingInputs = [];
        }
        // Medium difference - blend
        else {
            this.mySprite.x += (myServerPos.x - this.mySprite.x) * (strength * 1.5);
            this.mySprite.y += (myServerPos.y - this.mySprite.y) * (strength * 1.5);
        }

        // Update bearing from server
        if (myServerPos.b) {
            this.mySprite.bearing = myServerPos.b;
        }

        // Remove inputs that server has confirmed
        this.pendingInputs = this.pendingInputs.filter(function (input) {
            return input.frame > serverState.f;
        });
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
        var events = this.client.slice("nba_jam",
            "game." + this.sessionId + ".events",
            -10,
            undefined,
            1);

        if (!events || !Array.isArray(events)) return;

        for (var i = 0; i < events.length; i++) {
            var event = events[i];
            var signature = this.buildEventSignature(event);
            if (signature && this.processedEventSignatures.indexOf(signature) !== -1)
                continue;

            this.handleEvent(event);

            if (signature) {
                this.processedEventSignatures.push(signature);
                if (this.processedEventSignatures.length > this.maxEventSignatureHistory)
                    this.processedEventSignatures.shift();
            }
        }
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
                        announce(event.data.message, event.data.color);
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
                        interceptorSprite,
                        event.data.durationMs
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
                    announce(event.data.message, event.data.color);
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

        var attacker = this.findSpriteByGlobalId(data.attackerId);
        var victim = this.findSpriteByGlobalId(data.victimId);

        if (!attacker || !victim) return;
        if (!attacker.playerData || !victim.playerData) return;

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
            if (data.createdLooseBall && typeof gameState !== "undefined") {
                gameState.ballCarrier = null;
                if (typeof data.ballPos === "object") {
                    gameState.ballX = data.ballPos.x;
                    gameState.ballY = data.ballPos.y;
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
        if (!data || typeof gameState === "undefined") return;

        var rebounder = this.findSpriteByGlobalId(data.playerId);
        if (!rebounder) return;

        // Clear rebound state
        gameState.reboundActive = false;
        if (gameState.reboundScramble) {
            gameState.reboundScramble.active = false;
        }

        // Award possession
        if (data.newPossession) {
            gameState.currentTeam = data.newPossession;
        }
        gameState.ballCarrier = rebounder;

        // Update shot clock
        if (typeof data.shotClock === "number") {
            gameState.shotClock = data.shotClock;
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
        if (!data || typeof gameState === "undefined") return;

        // Set rebound position
        if (typeof data.reboundPos === "object") {
            gameState.reboundX = data.reboundPos.x;
            gameState.reboundY = data.reboundPos.y;
        }

        // Start scramble state
        gameState.reboundActive = true;
        if (gameState.reboundScramble) {
            gameState.reboundScramble.active = true;
            gameState.reboundScramble.reboundX = data.reboundPos.x;
            gameState.reboundScramble.reboundY = data.reboundPos.y;
            if (typeof data.scrambleStart === "number") {
                gameState.reboundScramble.startTime = data.scrambleStart;
            }
            gameState.reboundScramble.anticipating = false;
        }

        // Queue rebound animation if available
        if (data.bounces && typeof animationSystem !== "undefined" && animationSystem) {
            animationSystem.queueReboundAnimation(data.bounces);
        }
    };

    // OPTION B SYNC: Handle turbo update event
    this.handleTurboUpdateEvent = function (data) {
        if (!data) return;

        var player = this.findSpriteByGlobalId(data.playerId);
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
        if (!data || typeof gameState === "undefined") return;

        // Apply coordinator's dead dribble state
        if (typeof data.frames === "number") {
            gameState.ballHandlerDeadFrames = data.frames;
        }
        if (data.since !== undefined) {
            gameState.ballHandlerDeadSince = data.since;
        }
        if (typeof data.forced === "boolean") {
            gameState.ballHandlerDeadForcedShot = data.forced;
        }
    };

    // OPTION B SYNC: Handle halftime event from coordinator
    this.handleHalftimeEvent = function (data) {
        if (!data || typeof gameState === "undefined") return;

        try {
            // Update game state from coordinator
            if (typeof data.currentHalf === "number") {
                gameState.currentHalf = data.currentHalf;
            }
            if (typeof data.teamAScore === "number") {
                gameState.score.teamA = data.teamAScore;
            }
            if (typeof data.teamBScore === "number") {
                gameState.score.teamB = data.teamBScore;
            }
            if (typeof data.timeRemaining === "number") {
                gameState.timeRemaining = data.timeRemaining;
            }

            // Trigger halftime screen on client
            if (typeof showHalftimeScreen === "function") {
                showHalftimeScreen();
            }
        } catch (e) {
            log(LOG_ERR, "NBA JAM MP: Error handling halftime event: " + e);
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

        // Clean up Queue objects
        this.stateQueue = null;
        this.inputQueue = null;
        this.processedEventSignatures = [];

        // Unsubscribe from events (still using database for non-realtime events)
        this.client.unsubscribe("nba_jam", "game." + this.sessionId + ".events");
    };
}

var clientGlobal = (typeof global !== "undefined") ? global : this;
if (clientGlobal) {
    clientGlobal.PlayerClient = PlayerClient;
}
