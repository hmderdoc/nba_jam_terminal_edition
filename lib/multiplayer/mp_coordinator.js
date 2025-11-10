// mp_coordinator.js - Multiplayer Game Coordinator
// The authoritative game instance that processes inputs and manages state

load(js.exec_dir + "lib/multiplayer/mp_identity.js");
load(js.exec_dir + "lib/multiplayer/mp_network.js");

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
            // Movement command
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

            if (typeof applyMovementCommand === "function") {
                var budget = (typeof createMovementCounters === "function")
                    ? createMovementCounters(sprite, input.turbo, this.systems)
                    : null;
                if (budget && budget.moves > 0) {
                    var counters = {
                        horizontal: Math.max(0, budget.horizontal),
                        vertical: Math.max(0, budget.vertical)
                    };
                    for (var m = 0; m < budget.moves; m++) {
                        if (!applyMovementCommand(sprite, key, counters)) break;
                    }
                } else if (!budget) {
                    applyMovementCommand(sprite, key);
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

        return state;
    };

    // Serialize player positions
    this.serializePlayerPositions = function () {
        var positions = [];

        // Get all players in consistent order
        var players = getAllPlayers ? getAllPlayers() : [];

        for (var i = 0; i < players.length; i++) {
            var player = players[i];

            if (!player) {
                positions.push(null);
                continue;
            }

            var playerData = player.playerData || {};
            var entry = {
                x: player.x || 0,
                y: player.y || 0,
                b: player.bearing || "e",
                d: playerData.hasDribble !== false,
                k: playerData.knockdownTimer || 0,
                s: playerData.stealRecoverFrames || 0,
                t: playerData.turboActive || false,
                T: (typeof playerData.turbo === "number") ? playerData.turbo : 0,
                o: !!playerData.onFire,
                // ADD: Velocity for smoother interpolation (reduces rubber-banding)
                vx: playerData.vx || 0,
                vy: playerData.vy || 0,
                // ADD: Animation state for visual consistency
                anim: playerData.animState || "idle"
            };
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
        return {
            sc: stateManager.get('score') || { red: 0, blue: 0 },
            cl: stateManager.get('shotClock') || 24,
            tm: stateManager.get('timeRemaining') || 0,
            ct: stateManager.get('currentTeam') || "teamA",
            ib: stateManager.get('inbounding') || false,
            fc: stateManager.get('frontcourtEstablished') || false,
            sp: stateManager.get('shotInProgress') || false,
            h: stateManager.get('currentHalf') || 1,
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
            }
        };
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
}

// Helper to check if coordinator is still alive
function checkCoordinatorHealth(client, sessionId) {
    var session = client.read("nba_jam", "game." + sessionId + ".meta", 1);
    if (!session || !session.coordinator) {
        return false;
    }

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
