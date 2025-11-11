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

    // Network monitor
    this.networkMonitor = new NetworkMonitor(client, sessionId);

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
                ? createMovementCounters(this.mySprite, turboIntent, this.systems)
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

        // 4. Record in replay buffer for lag compensation
        if (typeof recordInput === "function") {
            recordInput({
                key: key,
                playerId: this.myPlayerId,
                turbo: !!turboIntent
            }, frameNumber);
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

        // Reconcile my position
        this.reconcileMyPosition(serverState);

        // Replay inputs since server frame for lag compensation
        if (typeof replayInputsSince === "function" && !this.disablePrediction) {
            var self = this;
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
                                if (!applyMovementCommand(self.mySprite, inputRecord.key, counters)) break;
                            }
                        } else if (!budget) {
                            applyMovementCommand(self.mySprite, inputRecord.key);
                        }
                    }
                }
            });
        }

        // Process events
        this.processEvents();
    };

    // Update other players' positions
    this.updateOtherPlayers = function (positions, indexMap) {
        if (!positions || !Array.isArray(positions)) return;
        if (!indexMap) return; // Need the mapping to apply positions correctly

        // Immediate snap (no smoothing) to eliminate oscillation flicker
        // With 10 Hz updates, instant position changes feel more stable than slow drift + snap
        var smoothFactor = 1.0; // Instant snap - was 0.95 (caused drift → snap oscillation)

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

            // WAVE 21: Validate position data from network
            var posCheck = validatePlayerPosition(pos.x, pos.y);
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
        var stateManager = this.systems.stateManager;
        if (!ballState) return;

        // Draw trail dot at old position if ball moved
        if (typeof courtFrame !== "undefined" && courtFrame) {
            var oldX = stateManager.get('ballX') || 0;
            var oldY = stateManager.get('ballY') || 0;
            var newX = ballState.x || 0;
            var newY = ballState.y || 0;

            if ((oldX !== newX || oldY !== newY) && oldX > 0 && oldY > 0) {
                // Draw trail dot at old ball position
                courtFrame.gotoxy(oldX, oldY);
                courtFrame.putmsg(".", LIGHTGRAY | WAS_BROWN);
            }
        }

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
            stateManager.set("currentTeam", state.ct, "mp_team_update");
        }

        if (typeof state.ib === "boolean") {
            stateManager.set("inbounding", state.ib, "mp_inbound_update");
        }

        if (typeof state.fc === "boolean") {
            stateManager.set("frontcourtEstablished", state.fc, "mp_frontcourt_update");
        }

        if (typeof state.sp === "boolean") {
            stateManager.set("shotInProgress", state.sp, "mp_shot_progress");
        }

        if (typeof state.h === "number") {
            stateManager.set("currentHalf", state.h, "mp_half_update");
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
                this.systems.stateManager.set('courtNeedsRedraw', true, 'mp_bf_redraw');
            } catch (e) {
                if (typeof log === 'function') log(LOG_WARNING, 'MP CLIENT: failed to apply basketFlash: ' + e);
            }
        }

        // courtNeedsRedraw no longer synced - each client manages their own
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
            if (data.createdLooseBall) {
                stateManager.set("ballCarrier", null, "mp_loose_ball");
                if (typeof data.ballPos === "object") {
                    stateManager.set("ballX", data.ballPos.x, "mp_loose_ball_pos");
                    stateManager.set("ballY", data.ballPos.y, "mp_loose_ball_pos");
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

            // Trigger halftime screen on client (with systems parameter)
            if (typeof showHalftimeScreen === "function") {
                debugLog("[MP HALFTIME] Non-coordinator showing halftime screen");
                showHalftimeScreen(this.systems);
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

        // Clear input replay history
        if (typeof clearInputHistory === "function") {
            clearInputHistory();
        }

        // Clean up Queue objects
        this.stateQueue = null;
        this.inputQueue = null;
        this.processedEventSignatures = [];

        // Event system disabled (Bug #27) - all sync via Queues
    };
}

var clientGlobal = (typeof global !== "undefined") ? global : this;
if (clientGlobal) {
    clientGlobal.PlayerClient = PlayerClient;
}
