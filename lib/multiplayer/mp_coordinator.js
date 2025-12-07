// mp_coordinator.js - Multiplayer Game Coordinator
// The authoritative game instance that processes inputs and manages state

load(js.exec_dir + "lib/multiplayer/mp_identity.js");
load(js.exec_dir + "lib/multiplayer/mp_network.js");
load(js.exec_dir + "lib/multiplayer/mp_animation_hints.js");

// Local debug logging function
function mpDebugLog(msg) {
    if (!MP_DEBUG) return;
    try {
        var logFile = new File(js.exec_dir + "data/debug.log");
        if (logFile.open("a")) {
            var timestamp = new Date().toISOString();
            logFile.writeln(timestamp + " [Coordinator] " + msg);
            logFile.close();
        }
    } catch (e) {
        // Silently fail
    }
}

// Lock constants for JSON-DB operations
var LOCK_READ = 1;
var LOCK_WRITE = 2;

function GameCoordinator(sessionId, client, serverConfig, systems) {
    this.sessionId = sessionId;
    this.client = client;
    this.serverConfig = serverConfig;
    this.systems = systems;  // Store systems for stateManager access
    this.isCoordinator = false;

    // Frame tracking
    this.frameNumber = 0;
    this.lastStateUpdate = Date.now();

    // Timing (adaptive based on network quality)
    // Increased to 20Hz (50ms) from 10Hz (100ms) for smoother sync
    this.stateUpdateInterval = serverConfig.tuning.stateUpdateInterval || 50;
    this.inputCollectionInterval = this.stateUpdateInterval; // Collect inputs at same rate as state updates
    this.lastInputCollection = 0;

    // Input queues
    this.inputQueues = {}; // playerId -> array of input packets
    this.lastProcessedInputs = {}; // playerId -> last sequence number
    this.localInputPackets = {}; // playerId -> packets injected locally (coordinator client)

    // Player sprite mapping
    this.playerSpriteMap = {}; // globalId -> sprite
    this.playerIndexMap = {}; // globalId -> index in positions array
    this.animationSync = { nextId: 1, buffer: [] };
    this.animationHintTracker = createAnimationHintTracker({
        constants: (typeof MP_CONSTANTS === "object" && MP_CONSTANTS.ANIMATION_HINTS)
            ? MP_CONSTANTS.ANIMATION_HINTS
            : { ENABLED: false },
        stateManager: this.systems ? this.systems.stateManager : null
    });
    this.lastBroadcastPositions = {};

    // Session metadata
    this.session = null;

    // Queue-based messaging (replaces database for real-time gameplay)
    this.stateQueues = {};  // playerId -> Queue for state updates
    this.playerInputQueues = {};  // playerId -> Queue for inputs

    // Initialize coordinator
    this.init = function () {
        this.checkRole();

        if (this.isCoordinator) {
            debugLog("=== I am the coordinator for session " + this.sessionId + " ===");

            // Create Queue objects for real-time gameplay communication
            this.stateQueues = {};

            // Create per-player queues for inputs and state
            if (this.session && this.session.playerList) {
                debugLog("PlayerList has " + this.session.playerList.length + " players: " + this.session.playerList.join(", "));
                for (var i = 0; i < this.session.playerList.length; i++) {
                    var playerId = this.session.playerList[i];
                    this.playerInputQueues[playerId] = new Queue("nba_jam.game." + this.sessionId + ".inputs." + playerId);
                    this.stateQueues[playerId] = new Queue("nba_jam.game." + this.sessionId + ".state." + playerId);
                    debugLog("Created input queue for player: " + playerId);
                }
            }
        }

        // Initialize timing
        this.lastInputCollection = Date.now();
        this.lastStateUpdate = Date.now();

        // Subscribe to all player input queues
        this.subscribeToInputs();

        return true;
    };

    // Check if we are the coordinator
    this.checkRole = function () {
        // If isCoordinator was explicitly set before init(), respect that
        // This supports LORB multiplayer where role is determined by challenge
        // But STILL read the session so we have playerList etc.
        if (typeof this._isCoordinatorPreset !== "undefined") {
            debugLog("checkRole: using preset isCoordinator=" + this._isCoordinatorPreset);
            // Still need to read session for playerList!
            this.session = this.client.read("nba_jam", "game." + this.sessionId + ".meta", 1);
            if (!this.session) {
                debugLog("checkRole: WARNING - session is null even with preset!");
            } else {
                debugLog("checkRole: read session, playerList=" + (this.session.playerList ? this.session.playerList.join(",") : "null"));
            }
            return;
        }
        
        this.session = this.client.read("nba_jam", "game." + this.sessionId + ".meta", 1);

        if (!this.session) {
            // Session doesn't exist yet, try to claim coordinator role
            this.attemptClaimCoordinator();
            return;
        }

        var myId = createPlayerIdentifier();
        this.isCoordinator = (this.session.coordinator === myId.globalId);
    };

    // Attempt to claim coordinator role
    this.attemptClaimCoordinator = function () {
        var myId = createPlayerIdentifier();

        this.client.lock("nba_jam", "game." + this.sessionId + ".meta", LOCK_WRITE);

        // Re-read in case someone else claimed it
        this.session = this.client.read("nba_jam", "game." + this.sessionId + ".meta");

        if (!this.session || !this.session.coordinator) {
            // Still no coordinator, claim it
            if (!this.session) {
                this.session = { coordinator: myId.globalId };
            } else {
                this.session.coordinator = myId.globalId;
            }

            this.client.write("nba_jam", "game." + this.sessionId + ".meta", this.session);
            this.isCoordinator = true;

            log(LOG_INFO, "NBA JAM MP: Claimed coordinator role");
        }

        this.client.unlock("nba_jam", "game." + this.sessionId + ".meta");
    };

    // Subscribe to all player input queues
    this.subscribeToInputs = function () {
        if (!this.session || !this.session.playerList) return;

        for (var i = 0; i < this.session.playerList.length; i++) {
            var playerId = this.session.playerList[i];
            this.client.subscribe("nba_jam", "game." + this.sessionId + ".inputs." + playerId);
            this.lastProcessedInputs[playerId] = -1;
            if (!this.stateQueues[playerId]) {
                this.stateQueues[playerId] = new Queue("nba_jam.game." + this.sessionId + ".state." + playerId);
            }
        }
    };

    // Map player global IDs to sprites
    this.setPlayerSpriteMap = function (map) {
        this.playerSpriteMap = map;

        // Build index map using getAllPlayers() order to match serializePlayerPositions()
        // This ensures indices align with position array
        this.playerIndexMap = {};
        var players = getAllPlayers ? getAllPlayers() : [];

        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            if (!player) continue;

            // Find this player's globalId in the sprite map
            for (var playerId in map) {
                if (map.hasOwnProperty(playerId) && map[playerId] === player) {
                    this.playerIndexMap[playerId] = i;
                    break;
                }
            }
        }

        this.getGlobalIdForSprite = function (sprite) {
            if (!sprite) return null;
            for (var playerId in this.playerSpriteMap) {
                if (!this.playerSpriteMap.hasOwnProperty(playerId)) continue;
                if (this.playerSpriteMap[playerId] === sprite) {
                    return playerId;
                }
            }
            return null;
        };

        this._copyBounceList = function (bounces) {
            if (!Array.isArray(bounces)) return [];
            var copy = [];
            for (var i = 0; i < bounces.length; i++) {
                var bounce = bounces[i];
                if (!bounce) continue;
                copy.push({
                    startX: typeof bounce.startX === "number" ? bounce.startX : 0,
                    startY: typeof bounce.startY === "number" ? bounce.startY : 0,
                    endX: typeof bounce.endX === "number" ? bounce.endX : 0,
                    endY: typeof bounce.endY === "number" ? bounce.endY : 0
                });
            }
            return copy;
        };

        this._copyTargetPoint = function (point) {
            if (!point) return null;
            return {
                x: typeof point.x === "number" ? point.x : 0,
                y: typeof point.y === "number" ? point.y : 0
            };
        };

        if (this.animationHintTracker && typeof this.animationHintTracker.setIdResolver === "function") {
            this.animationHintTracker.setIdResolver(this.getGlobalIdForSprite.bind(this));
        }

        this._copyDunkInfo = function (info) {
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

        this._copyFlightPlan = function (plan) {
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

        this._sanitizeAnimationPayload = function (eventType, payload) {
            if (!payload) return null;
            switch (eventType) {
                case "shot":
                    return {
                        startX: typeof payload.startX === "number" ? payload.startX : 0,
                        startY: typeof payload.startY === "number" ? payload.startY : 0,
                        targetX: typeof payload.targetX === "number" ? payload.targetX : 0,
                        targetY: typeof payload.targetY === "number" ? payload.targetY : 0,
                        made: !!payload.made,
                        blocked: !!payload.blocked,
                        shooter: payload.shooter || null,
                        durationMs: (typeof payload.durationMs === "number" && payload.durationMs > 0) ? Math.round(payload.durationMs) : null,
                        reboundBounces: this._copyBounceList(payload.reboundBounces)
                    };
                case "pass":
                    return {
                        startX: typeof payload.startX === "number" ? payload.startX : 0,
                        startY: typeof payload.startY === "number" ? payload.startY : 0,
                        endX: typeof payload.endX === "number" ? payload.endX : 0,
                        endY: typeof payload.endY === "number" ? payload.endY : 0,
                        durationMs: (typeof payload.durationMs === "number" && payload.durationMs > 0) ? Math.round(payload.durationMs) : null,
                        passer: payload.passer || null,
                        receiver: payload.receiver || null,
                        interceptor: payload.interceptor || null,
                        intercepted: !!payload.intercepted,
                        inbound: !!payload.inbound,
                        targetPoint: this._copyTargetPoint(payload.targetPoint)
                    };
                case "dunk":
                    return {
                        player: payload.player || null,
                        dunkInfo: this._copyDunkInfo(payload.dunkInfo),
                        flightPlan: this._copyFlightPlan(payload.flightPlan),
                        targetX: typeof payload.targetX === "number" ? payload.targetX : 0,
                        targetY: typeof payload.targetY === "number" ? payload.targetY : 0,
                        made: !!payload.made,
                        style: payload.style || "default"
                    };
                case "rebound":
                    return {
                        bounces: this._copyBounceList(payload.bounces)
                    };
                case "clear_ball":
                    return {
                        reason: payload.reason || "external"
                    };
                case "shove_knockback":
                    return {
                        attackerId: (typeof payload.attackerId === "number") ? payload.attackerId : null,
                        victimId: (typeof payload.victimId === "number") ? payload.victimId : null,
                        pushDistance: (typeof payload.pushDistance === "number") ? payload.pushDistance : null,
                        victimPos: (payload.victimPos && typeof payload.victimPos.x === "number" && typeof payload.victimPos.y === "number") ? {
                            x: payload.victimPos.x,
                            y: payload.victimPos.y
                        } : null
                    };
                default:
                    return null;
            }
        };

        this.recordAnimationEvent = function (eventType, payload) {
            if (!this.isCoordinator) return null;
            var sanitized = this._sanitizeAnimationPayload(eventType, payload);
            if (!sanitized) return null;
            if (this.animationHintTracker && typeof this.animationHintTracker.recordEvent === "function") {
                try {
                    this.animationHintTracker.recordEvent(eventType, sanitized, this.frameNumber);
                } catch (recordErr) {
                    if (typeof debugLog === "function") {
                        debugLog("[MP ANIM HINT] recordEvent failed: " + recordErr);
                    }
                }
            }
            var entry = {
                id: this.animationSync.nextId++,
                type: eventType,
                data: sanitized,
                frame: this.frameNumber,
                expires: this.frameNumber + 6
            };
            this.animationSync.buffer.push(entry);
            if (this.animationSync.buffer.length > 64) {
                this.animationSync.buffer.shift();
            }
            return entry.id;
        };

        this.collectAnimationSyncPayload = function () {
            if (!this.isCoordinator) return [];
            var currentFrame = this.frameNumber;
            var payloads = [];
            var survivors = [];
            for (var i = 0; i < this.animationSync.buffer.length; i++) {
                var entry = this.animationSync.buffer[i];
                if (!entry) continue;
                if (entry.expires < currentFrame) {
                    continue;
                }
                payloads.push({
                    id: entry.id,
                    type: entry.type,
                    frame: entry.frame,
                    data: entry.data
                });
                if (entry.expires > currentFrame) {
                    survivors.push(entry);
                }
            }
            this.animationSync.buffer = survivors;
            return payloads;
        };
    };

    // Main coordinator update (called each frame)
    this.update = function () {
        if (!this.isCoordinator) {
            // Not coordinator, don't process
            return;
        }

        // Defensive check: ensure session exists
        if (!this.session || !this.session.playerList) {
            debugLog("WARNING: update() called but session/playerList is null");
            return;
        }

        var now = Date.now();

        // 1. Collect inputs from all players (throttled to reduce DB load)
        if (now - this.lastInputCollection >= this.inputCollectionInterval) {
            this.collectInputs();
            this.lastInputCollection = now;
        }

        // 2. Process inputs in order
        this.processInputs();

        // 2.5. Collect screen ready votes (for multiplayer screen coordination)
        if (this.mpScreenCoordinator && this.mpScreenCoordinator.isScreenActive()) {
            this.collectScreenVotes();
        }

        // 3. Broadcast state periodically
        if (now - this.lastStateUpdate >= this.stateUpdateInterval) {
            this.broadcastState();
            this.lastStateUpdate = now;
        }

        this.frameNumber++;
    };

    this.queueLocalInputPacket = function (playerId, packet) {
        if (!packet) return;
        if (!this.localInputPackets[playerId]) {
            this.localInputPackets[playerId] = [];
        }
        this.localInputPackets[playerId].push(packet);
    };

    this.acceptInputPacket = function (playerId, packet, source) {
        if (!packet) return;

        var readableSource = source || "queue";
        debugLog("collectInputs() - Read packet from " + playerId + " via " + readableSource + " (seq: " + packet.s + ", inputs: " + (packet.i ? packet.i.length : 0) + ")");

        if (!this.validateInputPacket(packet, playerId)) {
            return;
        }

        var lastSeq = this.lastProcessedInputs[playerId];
        if (typeof lastSeq !== "number")
            lastSeq = -1;

        if (packet.s <= lastSeq) {
            return;
        }

        if (!this.inputQueues[playerId]) {
            this.inputQueues[playerId] = [];
        }

        this.inputQueues[playerId].push(packet);
        this.lastProcessedInputs[playerId] = packet.s;
    };

    // Collect inputs from all players
    this.collectInputs = function () {
        if (!this.session || !this.session.playerList) return;

        for (var i = 0; i < this.session.playerList.length; i++) {
            var playerId = this.session.playerList[i];

            // Read from player's input Queue (non-blocking)
            var inputQueue = this.playerInputQueues[playerId];
            if (inputQueue) {
                if (!inputQueue.data_waiting && typeof inputQueue.poll === "function") {
                    inputQueue.poll(0); // Non-blocking pump of any pending writes
                }

                while (inputQueue.data_waiting) {
                    var packet = inputQueue.read();
                    if (!packet)
                        break;

                    this.acceptInputPacket(playerId, packet, "queue");
                }
            }

            // Merge locally injected packets (coordinator's own input)
            var localPackets = this.localInputPackets[playerId];
            if (localPackets && localPackets.length) {
                for (var lp = 0; lp < localPackets.length; lp++) {
                    this.acceptInputPacket(playerId, localPackets[lp], "local");
                }
                this.localInputPackets[playerId] = [];
            }
        }
    };

    // Validate input packet
    this.validateInputPacket = function (packet, playerId) {
        if (!packet) return false;

        // Check sequence number exists
        if (typeof packet.s !== "number") return false;

        // Check timestamp
        if (typeof packet.t !== "number") return false;

        // Check timestamp is reasonable (not too old, not in future)
        var age = Date.now() - packet.t;
        if (age < -1000 || age > 10000) {
            // Packet is from future or more than 10 seconds old
            return false;
        }

        // Check inputs array
        if (!packet.i || !Array.isArray(packet.i)) return false;

        return true;
    };

    // Process all queued inputs
    this.processInputs = function () {
        // Collect all inputs from all players
        var allInputs = [];

        for (var playerId in this.inputQueues) {
            var packets = this.inputQueues[playerId];

            for (var i = 0; i < packets.length; i++) {
                var packet = packets[i];

                for (var j = 0; j < packet.i.length; j++) {
                    var input = packet.i[j];

                    allInputs.push({
                        playerId: playerId,
                        key: input.k,
                        frame: input.f,
                        timestamp: packet.t,
                        sequence: packet.s,
                        turbo: (input.t !== undefined) ? !!input.t : undefined
                    });
                }
            }
        }

        // Sort by frame number (handle timing differences)
        allInputs.sort(function (a, b) {
            return a.frame - b.frame;
        });

        // Apply each input
        for (var i = 0; i < allInputs.length; i++) {
            this.applyInput(allInputs[i]);
        }

        // Clear processed inputs
        this.inputQueues = {};
    };

    // Apply a single input to the appropriate player
    this.applyInput = function (input) {
        var sprite = this.playerSpriteMap[input.playerId];

        if (!sprite) {
            // Player not mapped to a sprite yet
            debugLog("ERROR applyInput() - No sprite found for playerId: " + input.playerId + " (key: " + input.key + ")");
            return;
        }

        debugLog("applyInput() - Applying key '" + input.key + "' to sprite " + (sprite.playerData ? sprite.playerData.name : "unnamed") + " (playerId: " + input.playerId + ")");

        var key = input.key;
        var upperKey = key.toUpperCase();

        // Handle action keys (shoot, pass, dribble)
        if (key === ' ') {
            // Space bar - shoot or block
            if (typeof handleActionButton === "function") {
                handleActionButton(sprite, this.systems);
            }
        } else if (upperKey === 'S') {
            // S key - pass or steal
            if (typeof handleSecondaryButton === "function") {
                handleSecondaryButton(sprite, this.systems);
            }
        } else if (upperKey === 'D') {
            // D key - pick up dribble or shake
            if (typeof handleDribbleButton === "function") {
                handleDribbleButton(sprite, this.systems);
            }
        } else {
            // Movement command - translate numpad keys
            var numpadInfo = (typeof translateNumpadKey === "function") 
                ? translateNumpadKey(key) 
                : { isDiagonal: false, isCardinal: false, effectiveKey: key };
            
            if (sprite.playerData) {
                var turboIntent = (input.turbo !== undefined) ? !!input.turbo : !!sprite.playerData.turboActive;
                if (turboIntent && sprite.playerData.turbo > 0) {
                    sprite.playerData.turboActive = true;
                    if (typeof sprite.playerData.useTurbo === "function") {
                        sprite.playerData.useTurbo(TURBO_DRAIN_RATE);
                    }
                } else {
                    sprite.playerData.turboActive = false;
                }
            }

            // WAVE 24 HUMAN COLLISION FIX: Check collision before applying movement
            var moveBlocked = false;
            var plannedX = sprite.x;
            var plannedY = sprite.y;

            // Calculate where sprite would move (handle diagonal and cardinal numpad keys)
            if (numpadInfo.isDiagonal) {
                // Diagonal movement - apply both horizontal and vertical offsets
                if (numpadInfo.horizKey === KEY_LEFT) plannedX -= 1;
                else if (numpadInfo.horizKey === KEY_RIGHT) plannedX += 1;
                if (numpadInfo.vertKey === KEY_UP) plannedY -= 1;
                else if (numpadInfo.vertKey === KEY_DOWN) plannedY += 1;
            } else {
                // Cardinal movement (including numpad 2,4,6,8)
                var effectiveKey = numpadInfo.isCardinal ? numpadInfo.cardinalKey : key;
                if (effectiveKey == KEY_LEFT) plannedX -= 1;
                else if (effectiveKey == KEY_RIGHT) plannedX += 1;
                else if (effectiveKey == KEY_UP) plannedY -= 1;
                else if (effectiveKey == KEY_DOWN) plannedY += 1;
            }

            // Check collision with opponents at planned position
            var allPlayers = getAllPlayers ? getAllPlayers() : [];
            for (var i = 0; i < allPlayers.length; i++) {
                var other = allPlayers[i];
                if (!other || other === sprite) continue;

                // Only check collision between opponents (same as authority collision logic)
                var spriteTeam = getPlayerTeamName ? getPlayerTeamName(sprite) : null;
                var otherTeam = getPlayerTeamName ? getPlayerTeamName(other) : null;
                if (spriteTeam === otherTeam) continue; // Teammates pass through

                var dx = Math.abs(other.x - plannedX);
                var dy = Math.abs(other.y - plannedY);

                // Use same threshold as authority collision detection
                var collisionDx = (typeof PLAYER_COLLISION_THRESHOLD === "object" && PLAYER_COLLISION_THRESHOLD.dx) ? PLAYER_COLLISION_THRESHOLD.dx : 2;
                var collisionDy = (typeof PLAYER_COLLISION_THRESHOLD === "object" && PLAYER_COLLISION_THRESHOLD.dy) ? PLAYER_COLLISION_THRESHOLD.dy : 2;
                if (dx < collisionDx && dy < collisionDy) {
                    debugLog("[COORDINATOR] Human input blocked by collision - " + (sprite.playerData ? sprite.playerData.name : "player") + " vs " + (other.playerData ? other.playerData.name : "opponent"));
                    moveBlocked = true;
                    break;
                }
            }

            // Only apply movement if no collision detected
            if (!moveBlocked) {
                var budget = (typeof createMovementCounters === "function")
                    ? createMovementCounters(sprite, input.turbo, this.systems)
                    : null;
                if (budget && budget.moves > 0) {
                    var counters = {
                        horizontal: Math.max(0, budget.horizontal),
                        vertical: Math.max(0, budget.vertical)
                    };
                    
                    if (numpadInfo.isDiagonal && typeof applyDiagonalMovement === "function") {
                        // Diagonal movement from numpad
                        for (var m = 0; m < budget.moves; m++) {
                            if (!applyDiagonalMovement(sprite, numpadInfo.horizKey, numpadInfo.vertKey, counters)) break;
                        }
                    } else if (typeof applyMovementCommand === "function") {
                        // Cardinal movement - use effective key for numpad translation
                        var effectiveKey = numpadInfo.isCardinal ? numpadInfo.cardinalKey : key;
                        for (var m = 0; m < budget.moves; m++) {
                            if (!applyMovementCommand(sprite, effectiveKey, counters)) break;
                        }
                    }
                } else if (!budget) {
                    // Fallback when budget system not available
                    if (numpadInfo.isDiagonal && typeof applyDiagonalMovement === "function") {
                        applyDiagonalMovement(sprite, numpadInfo.horizKey, numpadInfo.vertKey);
                    } else if (typeof applyMovementCommand === "function") {
                        var effectiveKey = numpadInfo.isCardinal ? numpadInfo.cardinalKey : key;
                        applyMovementCommand(sprite, effectiveKey);
                    }
                }
            }
        }
    };

    // Broadcast game state to all clients
    this.broadcastState = function () {
        if (!this.isCoordinator) {
            return;
        }

        // Defensive check: ensure we have a valid session
        if (!this.session || !this.session.playerList) {
            debugLog("WARNING: broadcastState() called but session/playerList is null");
            return;
        }

        var state = this.captureState();

        var players = (this.session && this.session.playerList) ? this.session.playerList : [];
        for (var i = 0; i < players.length; i++) {
            var playerId = players[i];
            var queue = this.stateQueues[playerId];
            if (!queue) {
                queue = new Queue("nba_jam.game." + this.sessionId + ".state." + playerId);
                this.stateQueues[playerId] = queue;
            }
            if (!queue)
                continue;

            // Keep only the most recent state packet in each queue
            while (queue.data_waiting)
                queue.read();

            queue.write(state);
        }
    };

    // Capture current game state
    this.captureState = function () {
        var state = {
            f: this.frameNumber,
            t: Date.now(),
            p: this.serializePlayerPositions(),
            b: this.serializeBall(),
            g: this.serializeGameState(),
            m: this.playerIndexMap // Share index mapping with clients
        };

        var animationHints = this.collectAnimationHints();
        if (animationHints && animationHints.length) {
            state.ah = animationHints;
        }

        return state;
    };

    this.collectAnimationHints = function () {
        if (!this.animationHintTracker || !this.systems) {
            return [];
        }
        return this.animationHintTracker.evaluate(this.frameNumber, this.systems.stateManager, this.getGlobalIdForSprite);
    };

    // Serialize player positions
    this.serializePlayerPositions = function () {
        var positions = [];
        var stateManager = (this.systems && this.systems.stateManager) ? this.systems.stateManager : null;
        var inbounding = stateManager ? !!stateManager.get("inbounding") : false;
        var driftThreshold = (typeof DRIFT_SNAP_THRESHOLD === "number" && !isNaN(DRIFT_SNAP_THRESHOLD)) ? DRIFT_SNAP_THRESHOLD : 15;

        // Determine which sprites are allowed to be briefly off-court (inbound setup)
        var offcourtSprites = [];
        if (this.systems && this.systems.stateManager && this.systems.stateManager.get("inbounding")) {
            var positioning = this.systems.stateManager.get("inboundPositioning");
            if (positioning && positioning.inbounder && positioning.inbounder.sprite) {
                offcourtSprites.push(positioning.inbounder.sprite);
            }
            var inboundPassData = this.systems.stateManager.get("inboundPassData");
            if (inboundPassData && inboundPassData.inbounder) {
                if (offcourtSprites.indexOf(inboundPassData.inbounder) === -1) {
                    offcourtSprites.push(inboundPassData.inbounder);
                }
            }
        }

        function spriteIsOffcourt(sprite) {
            if (!sprite) return false;
            for (var i = 0; i < offcourtSprites.length; i++) {
                if (offcourtSprites[i] === sprite) {
                    return true;
                }
            }
            return false;
        }

        // Get all players in consistent order
        var players = getAllPlayers ? getAllPlayers() : [];

        for (var i = 0; i < players.length; i++) {
            var player = players[i];

            if (!player) {
                positions.push(null);
                continue;
            }

            var globalId = this.getGlobalIdForSprite(player);
            if (globalId) {
                var lastPos = this.lastBroadcastPositions[globalId];
                var currentX = player.x || 0;
                var currentY = player.y || 0;
                if (lastPos && !inbounding) {
                    var dx = currentX - lastPos.x;
                    var dy = currentY - lastPos.y;
                    var driftDistance = Math.sqrt(dx * dx + dy * dy);
                    if (driftDistance >= driftThreshold) {
                        if (this.animationHintTracker && typeof this.animationHintTracker.recordEvent === "function") {
                            this.animationHintTracker.recordEvent("drift_snap", {
                                targetId: globalId,
                                authorityX: currentX,
                                authorityY: currentY
                            }, this.frameNumber);
                        }
                        if (typeof this.recordDriftSnap === "function") {
                            this.recordDriftSnap();
                        }
                    }
                }
                this.lastBroadcastPositions[globalId] = { x: currentX, y: currentY };
            }

            var playerData = player.playerData || {};
            var entry = {
                x: player.x || 0,
                y: player.y || 0,
                b: player.bearing || "e",
                d: playerData.hasDribble !== false,
                k: playerData.knockdownTimer || 0,
                s: playerData.stealRecoverFrames || 0,
                sr: playerData.shoveRecoveryFrames || 0, // Shove recovery stun
                td: playerData.turboDisabledFrames || 0, // Turbo disabled after recovery
                t: playerData.turboActive || false,
                T: (typeof playerData.turbo === "number") ? playerData.turbo : 0,
                o: !!playerData.onFire,
                // ADD: Velocity for smoother interpolation (reduces rubber-banding)
                vx: playerData.vx || 0,
                vy: playerData.vy || 0,
                // ADD: Animation state for visual consistency
                anim: playerData.animState || "idle"
            };
            if (spriteIsOffcourt(player)) {
                entry.allowOffcourt = true;
            }
            if (player.forcePos) {
                entry.fp = true;
                player.forcePos = false; // Reset after serializing
            }
            positions.push(entry);
        }

        return positions;
    };

    // Serialize ball state
    this.serializeBall = function () {
        var stateManager = this.systems.stateManager;

        var carrierId = null;
        var ballCarrier = stateManager.get('ballCarrier');
        if (ballCarrier) {
            // Find carrier's global ID by checking sprite map
            for (var playerId in this.playerSpriteMap) {
                if (this.playerSpriteMap[playerId] === ballCarrier) {
                    carrierId = playerId;
                    break;
                }
            }

            // If not found in map, log warning - this indicates desync
            if (!carrierId) {
                var currentTeam = stateManager.get('currentTeam');
                log(LOG_WARNING, "NBA JAM MP: ballCarrier not found in playerSpriteMap! " +
                    "Carrier sprite: " + (ballCarrier ? ballCarrier.toString() : "null") +
                    ", currentTeam: " + currentTeam);
            }
        }

        return {
            x: stateManager.get('ballX') || 0,
            y: stateManager.get('ballY') || 0,
            c: carrierId,
            r: stateManager.get('reboundActive') || false,
            rx: stateManager.get('reboundX') || 0,
            ry: stateManager.get('reboundY') || 0
        };
    };

    // Serialize general game state
    this.serializeGameState = function () {
        var stateManager = this.systems.stateManager;

        // Map ballHandlerProgressOwner sprite to globalId
        var progressOwnerId = null;
        var ballHandlerProgressOwner = stateManager.get('ballHandlerProgressOwner');
        if (ballHandlerProgressOwner) {
            for (var playerId in this.playerSpriteMap) {
                if (this.playerSpriteMap[playerId] === ballHandlerProgressOwner) {
                    progressOwnerId = playerId;
                    break;
                }
            }
        }

        var flash = getScoreFlashState ? getScoreFlashState(this.systems) : stateManager.get('scoreFlash');
        var flashPayload = flash ? {
            active: !!flash.active,
            activeTeam: flash.activeTeam || null,
            stopTeam: flash.stopTeam || null,
            startedTick: (typeof flash.startedTick === "number") ? flash.startedTick : 0,
            regainCheckEnabled: !!flash.regainCheckEnabled
        } : null;

        // Include basket flash (visual-only) so clients can mirror celebratory effects
        var basketFlash = stateManager.get('basketFlash') || null;
        var basketFlashPayload = basketFlash ? {
            active: !!basketFlash.active,
            x: basketFlash.x || 0,
            y: basketFlash.y || 0,
            startTime: basketFlash.startTime || 0
        } : null;

        // Don't sync courtNeedsRedraw - each client manages their own (was causing infinite loop)
        // Basket flash triggers redraws when needed

        // Include announcer state so clients display same announcements as coordinator
        var announcer = stateManager.get('announcer') || null;
        var announcerPayload = announcer ? {
            text: announcer.text || "",
            color: (typeof announcer.color === "number") ? announcer.color : 7,
            timestamp: announcer.timestamp || 0
        } : null;

        var onFire = stateManager.get('onFire');

        // Include multiplayer screen coordination state (for synchronized screens)
        var mpScreen = stateManager.get('mpScreen') || null;

        // WAVE 24 PHASE-BASED PREDICTION: Determine current game phase
        // This tells clients how aggressively to predict vs trust authority
        var gamePhase = this.determineGamePhase(stateManager);
        var currentTick = stateManager.get('tickCounter') || 0;
        debugLog("[MP COORD] Determined phase: " + gamePhase + " at tick " + currentTick);

        // WAVE 24 FIX: During pre-game (tick=0), always report gameRunning=true to prevent
        // clients from interpreting pre-game broadcasts as "game over" signals.
        // Only send gameRunning=false when game has actually ended (tick > 0 and time expired).
        var actualGameRunning = stateManager.get('gameRunning') !== false;
        var gameRunningToSend = (currentTick <= 10) ? true : actualGameRunning;

        var state = {
            sc: stateManager.get('score') || { red: 0, blue: 0 },
            cl: stateManager.get('shotClock') || 24,
            tm: stateManager.get('timeRemaining') || 0,
            gr: gameRunningToSend,  // Game running flag for end detection (fixed for pre-game)
            ct: stateManager.get('currentTeam') || "teamA",
            ib: stateManager.get('inbounding') || false,
            fc: stateManager.get('frontcourtEstablished') || false,
            sp: stateManager.get('shotInProgress') || false,
            h: stateManager.get('currentHalf') || 1,
            ht: stateManager.get('isHalftime') || false, // Halftime flag for client sync
            ot: stateManager.get('isOvertime') || false, // Overtime flag for clock display
            otp: stateManager.get('currentOvertimePeriod') || 0, // OT period (1, 2, 3...)
            oia: stateManager.get('overtimeIntroActive') || false, // Overtime intro graphic active
            bp: progressOwnerId,
            // Additional state fields for violation tracking
            igp: stateManager.get('inboundGracePeriod') || 0,
            bct: stateManager.get('backcourtTimer') || 0,
            bhst: stateManager.get('ballHandlerStuckTimer') || 0,
            bhat: stateManager.get('ballHandlerAdvanceTimer') || 0,
            bhds: stateManager.get('ballHandlerDeadSince') || null,
            bhdf: stateManager.get('ballHandlerDeadFrames') || 0,
            cgd: stateManager.get('closelyGuardedDistance') || 999,
            sf: flashPayload,
            bf: basketFlashPayload,
            an: announcerPayload,
            of: {
                red: !!(onFire && onFire.teamA),
                blue: !!(onFire && onFire.teamB)
            },
            mps: mpScreen, // Multiplayer screen coordination state
            phase: gamePhase,  // WAVE 24: Game phase for prediction tuning
            phaseTick: currentTick  // Tick when this phase started/continued
        };

        var animations = this.collectAnimationSyncPayload();
        if (animations.length > 0) {
            state.anims = animations;
        }

        return state;
    };

    // WAVE 24: Determine current game phase for client prediction tuning
    this.determineGamePhase = function (stateManager) {
        var currentTick = stateManager.get('tickCounter') || 0;

        // Check for recovery from drift snap (highest priority - temporary state)
        if (this.lastDriftSnapTick && (currentTick - this.lastDriftSnapTick) < 5) {
            return "POST_SNAP_RECOVERY";
        }

        // Check for inbound state
        if (stateManager.get('inbounding')) {
            var positioning = stateManager.get('inboundPositioning');
            var inboundPassData = stateManager.get('inboundPassData');

            // Check if inbounder is being auto-walked to position
            if (positioning && positioning.inbounder && !positioning.ready) {
                return "INBOUND_WALK";
            }

            // Check if pass is in progress
            if (inboundPassData && inboundPassData.inbounder) {
                return "INBOUND_READY";
            }

            // Default inbound state
            return "INBOUND_READY";
        }

        // Check for rebound scramble
        if (stateManager.get('reboundActive')) {
            return "REBOUND_SCRAMBLE";
        }

        // Check for dead ball situations
        var shotClock = stateManager.get('shotClock') || 24;
        var ballCarrier = stateManager.get('ballCarrier');
        if (!ballCarrier && !stateManager.get('shotInProgress') && shotClock <= 0) {
            return "DEAD_BALL";
        }

        // Default to normal play
        return "NORMAL_PLAY";
    };

    // Track last drift snap for POST_SNAP_RECOVERY phase detection
    this.lastDriftSnapTick = null;
    this.recordDriftSnap = function () {
        var stateManager = this.systems.stateManager;
        this.lastDriftSnapTick = stateManager.get('tickCounter') || 0;
    };

    // Broadcast game event
    this.broadcastEvent = function (eventType, eventData) {
        // DISABLED: Events now sync via Queue-based state updates only
        // Database event broadcasting caused JSON payload overflow (Bug #27)
        // All game state is synchronized through stateQueues in broadcastState()
        // Events like turboUpdate, shot_executed, etc. are redundant with state sync
        return;
    };

    // Broadcast game state changes (for Option B sync)
    // This is a wrapper around broadcastEvent for state-changing events
    this.broadcastGameState = function (stateEvent) {
        if (!stateEvent || !stateEvent.type) return;
        this.broadcastEvent(stateEvent.type, stateEvent);
    };

    // Cleanup
    this.cleanup = function () {
        // Close Queue objects
        if (this.stateQueues) {
            for (var stateId in this.stateQueues) {
                if (this.stateQueues.hasOwnProperty(stateId)) {
                    this.stateQueues[stateId] = null;
                }
            }
        }
        this.stateQueues = {};

        for (var playerId in this.playerInputQueues) {
            if (this.playerInputQueues.hasOwnProperty(playerId)) {
                this.playerInputQueues[playerId] = null;
            }
        }
        this.playerInputQueues = {};

        // Unsubscribe from inputs (still needed for session management)
        if (this.session && this.session.playerList) {
            for (var i = 0; i < this.session.playerList.length; i++) {
                var playerId = this.session.playerList[i];
                this.client.unsubscribe("nba_jam",
                    "game." + this.sessionId + ".inputs." + playerId);
            }
        }
    };

    // Collect screen ready votes from players (for multiplayer screen coordination)
    this.collectScreenVotes = function () {
        if (!this.mpScreenCoordinator || !this.session) return;

        try {
            // Read from shared screen votes queue
            var voteQueue = new Queue("nba_jam.game." + this.sessionId + ".screen_votes");

            // Collect all pending votes
            while (voteQueue.data_waiting) {
                var votePacket = voteQueue.read();
                if (!votePacket) break;

                var playerId = votePacket.playerId;
                var choice = votePacket.choice;

                if (playerId) {
                    // Update vote in screen coordinator
                    this.mpScreenCoordinator.setReady(playerId, choice);
                    debugLog("[MP COORDINATOR] Received screen vote from " + playerId + (choice ? " (choice: " + choice + ")" : ""));
                }
            }
        } catch (e) {
            // Non-fatal - screen coordination is optional
            debugLog("[MP COORDINATOR] Screen vote collection error: " + e);
        }
    };
}

// Helper to check if coordinator is still alive
function checkCoordinatorHealth(client, sessionId) {
    var session = client.read("nba_jam", "game." + sessionId + ".meta", 1);
    if (!session || !session.coordinator) {
        return false;
    }
    return isCoordinatorAlive(client, sessionId, session);
}

// Helper: Check if coordinator is still alive
function isCoordinatorAlive(client, sessionId, session) {
    if (typeof Queue === "function") {
        try {
            var queueName = "nba_jam.game." + sessionId + ".state." + session.coordinator;
            var queue = new Queue(queueName);
            if (queue && typeof queue.peek === "function") {
                var latest;
                try {
                    latest = queue.peek(-1);
                } catch (ignore) {
                    latest = queue.peek();
                }
                if (latest && typeof latest.t === "number") {
                    return (Date.now() - latest.t) < 5000;
                }
            }
        } catch (err) {
            log(LOG_WARNING, "NBA JAM MP: coordinator queue health check failed (" + err + ")");
        }
    }

    return true;
}

// Elect new coordinator if current one is unresponsive
function electNewCoordinator(client, sessionId) {
    var session = client.read("nba_jam", "game." + sessionId + ".meta", 1);
    if (!session || !session.playerList || session.playerList.length === 0) {
        return false;
    }

    client.lock("nba_jam", "game." + sessionId + ".meta", LOCK_WRITE);

    // Re-read
    session = client.read("nba_jam", "game." + sessionId + ".meta");

    // Pick first available player as new coordinator
    var newCoordinator = session.playerList[0];
    session.coordinator = newCoordinator;

    client.write("nba_jam", "game." + sessionId + ".meta", session);
    client.unlock("nba_jam", "game." + sessionId + ".meta");

    log(LOG_INFO, "NBA JAM MP: Elected new coordinator: " + newCoordinator);

    return true;
}

var coordinatorGlobal = (typeof global !== "undefined") ? global : this;
if (coordinatorGlobal) {
    coordinatorGlobal.GameCoordinator = GameCoordinator;
    coordinatorGlobal.electNewCoordinator = electNewCoordinator;
}
