/**
 * NBA JAM - System Initialization Module
 * Wave 23: Centralized system creation and wiring
 * 
 * Responsibilities:
 * - Create all game systems with proper dependency injection
 * - Wire up cross-system dependencies
 * - Set up event subscriptions
 * - Return initialized systems for use by game logic
 * 
 * Benefits:
 * - Keeps main() clean and focused on game flow
 * - Centralizes all system configuration
 * - Makes dependency graph visible in one place
 * - Easy to add/remove systems without touching main()
 */

// Load debug logger for shooting system
load("lib/utils/debug-logger.js");

/**
 * Initialize all game systems with dependency injection
 * 
 * @param {Object} deps - Required dependencies from main context
 * @param {Object} deps.gameState - The global game state object
 * @param {Object} deps.animationSystem - The animation system
 * @param {Function} deps.getPlayers - Function that returns player sprite references (lazy evaluation)
 * @param {Object} deps.helpers - Helper functions (getPlayerTeamName, getAllPlayers, etc.)
 * @param {Object} deps.constants - Game constants (COURT_WIDTH, COURT_HEIGHT, etc.)
 * @returns {Object} Initialized systems { stateManager, eventBus, passingSystem, possessionSystem }
 */
function initializeSystems(deps) {
    // Validate required dependencies
    if (!deps || !deps.gameState || !deps.animationSystem || !deps.getPlayers || !deps.helpers || !deps.constants) {
        throw new Error("initializeSystems requires gameState, animationSystem, getPlayers, helpers, and constants");
    }

    var gameState = deps.gameState;
    var animationSystem = deps.animationSystem;
    var getPlayers = deps.getPlayers;
    var helpers = deps.helpers;
    var constants = deps.constants;

    // Create systems reference for helpers that need it (will be populated at end)
    var systems = {};

    // Create state manager (wraps gameState by reference)
    var stateManager = createStateManager(gameState);

    // Create event bus for decoupled system communication
    var eventBus = createEventBus();

    // Create frame scheduler for centralized timing control (Wave 23D Phase 2)
    var frameScheduler = createFrameScheduler();

    // Create passing system
    var passingSystem = createPassingSystem({
        state: stateManager,
        animations: animationSystem,
        events: eventBus,
        rules: {
            COURT_WIDTH: constants.COURT_WIDTH,
            COURT_HEIGHT: constants.COURT_HEIGHT
        },
        helpers: {
            getPlayerTeamName: helpers.getPlayerTeamName,
            recordTurnover: helpers.recordTurnover,
            triggerPossessionBeep: helpers.triggerPossessionBeep,
            resetBackcourtState: helpers.resetBackcourtState,
            setPotentialAssist: helpers.setPotentialAssist,
            clearPotentialAssist: helpers.clearPotentialAssist,
            enableScoreFlashRegainCheck: helpers.enableScoreFlashRegainCheck,
            primeInboundOffense: helpers.primeInboundOffense,
            assignDefensiveMatchups: helpers.assignDefensiveMatchups,
            announceEvent: helpers.announceEvent
        }
    });

    // Create possession system
    var possessionSystem = createPossessionSystem({
        state: stateManager,
        events: eventBus,
        rules: {
            COURT_WIDTH: constants.COURT_WIDTH,
            COURT_HEIGHT: constants.COURT_HEIGHT
        },
        helpers: {
            getPlayerTeamName: helpers.getPlayerTeamName,
            getAllPlayers: helpers.getAllPlayers,
            getTeamPlayers: function (team) {
                // Lazy evaluation - players may not exist yet at init time
                var players = getPlayers();
                if (team === "teamA") return [players.teamAPlayer1, players.teamAPlayer2];
                if (team === "teamB") return [players.teamBPlayer1, players.teamBPlayer2];
                return [];
            }
        }
    });

    // Create shooting system
    var shootingSystem = createShootingSystem({
        state: stateManager,
        events: eventBus,
        animations: animationSystem,
        logger: typeof debugLog !== 'undefined' ? debugLog : function (msg) {
            try {
                var f = new File("/sbbs/xtrn/nba_jam/data/shooting-debug.log");
                if (f.open("a")) {
                    f.writeln("[" + new Date().toISOString() + "] " + msg);
                    f.close();
                }
            } catch (e) { }
        },
        rules: {
            COURT_WIDTH: typeof COURT_WIDTH !== 'undefined' ? COURT_WIDTH : 80,
            COURT_HEIGHT: typeof COURT_HEIGHT !== 'undefined' ? COURT_HEIGHT : 40,
            BASKET_LEFT_X: typeof BASKET_LEFT_X !== 'undefined' ? BASKET_LEFT_X : 4,
            BASKET_LEFT_Y: typeof BASKET_LEFT_Y !== 'undefined' ? BASKET_LEFT_Y : 9,
            BASKET_RIGHT_X: typeof BASKET_RIGHT_X !== 'undefined' ? BASKET_RIGHT_X : 77,
            BASKET_RIGHT_Y: typeof BASKET_RIGHT_Y !== 'undefined' ? BASKET_RIGHT_Y : 9,
            THREE_POINT_RADIUS: typeof THREE_POINT_RADIUS !== 'undefined' ? THREE_POINT_RADIUS : 18,
            DUNK_DISTANCE: typeof DUNK_DISTANCE !== 'undefined' ? DUNK_DISTANCE : 8,
            BLOCK_JUMP_DURATION: typeof BLOCK_JUMP_DURATION !== 'undefined' ? BLOCK_JUMP_DURATION : 8
        },
        helpers: {
            getPlayerTeamName: helpers.getPlayerTeamName,
            calculateDistance: typeof distanceBetweenPoints !== 'undefined' ? distanceBetweenPoints : function (x1, y1, x2, y2) {
                var dx = x2 - x1;
                var dy = y2 - y1;
                return Math.sqrt(dx * dx + dy * dy);
            },
            getSpriteDistance: typeof getSpriteDistance !== 'undefined' ? getSpriteDistance : function (s1, s2) {
                var dx = s2.x - s1.x;
                var dy = s2.y - s1.y;
                return Math.sqrt(dx * dx + dy * dy);
            },
            getEffectiveAttribute: typeof getEffectiveAttribute !== 'undefined' ? getEffectiveAttribute : function (pd, attr) {
                return pd && pd.attributes && pd.attributes[attr] ? pd.attributes[attr] : 5;
            },
            getBaseAttribute: typeof getBaseAttribute !== 'undefined' ? getBaseAttribute : function (pd, attr) {
                return pd && pd.attributes && pd.attributes[attr] ? pd.attributes[attr] : 5;
            },
            getOpposingTeamSprites: typeof getOpposingTeamSprites !== 'undefined' ? getOpposingTeamSprites : function () { return []; },
            getTeamSprites: typeof getTeamSprites !== 'undefined' ? getTeamSprites : function () { return []; },
            getClosestPlayer: typeof getClosestPlayer !== 'undefined' ? getClosestPlayer : function () { return null; },
            clampSpriteFeetToCourt: typeof clampSpriteFeetToCourt !== 'undefined' ? clampSpriteFeetToCourt : function () { },
            updateBallPosition: typeof updateBallPosition !== 'undefined' ? function () {
                return updateBallPosition(systems);
            } : function () { },
            getCornerSpots: typeof getCornerSpots !== 'undefined' ? getCornerSpots : function () { return null; },
            evaluateDunkOpportunity: typeof evaluateDunkOpportunity !== 'undefined' ? evaluateDunkOpportunity : function () { return null; },
            calculateDunkChance: typeof calculateDunkChance !== 'undefined' ? calculateDunkChance : function () { return 75; },
            setPhase: typeof setPhase !== 'undefined' ? function (phase, data, durationMs, frameDelayMs) {
                return setPhase(phase, data, durationMs, frameDelayMs, systems);
            } : function () { },
            activateAITurbo: typeof activateAITurbo !== 'undefined' ? activateAITurbo : function () { },
            attemptBlock: typeof attemptBlock !== 'undefined' ? attemptBlock : function () { },
            broadcastMultiplayerEvent: function (eventType, data) {
                if (typeof mpCoordinator !== 'undefined' && mpCoordinator && mpCoordinator.isCoordinator) {
                    mpCoordinator.broadcastEvent(eventType, data);
                }
            },
            getPlayerGlobalId: typeof getPlayerGlobalId !== 'undefined' ? getPlayerGlobalId : function (p) { return p.id || "unknown"; }
        }
    });

    // Set up event subscriptions (cross-system communication)
    _setupEventSubscriptions(eventBus, helpers);

    // Populate systems object for helper closures
    systems.stateManager = stateManager;
    systems.eventBus = eventBus;
    systems.frameScheduler = frameScheduler;  // Wave 23D: Centralized frame timing
    systems.passingSystem = passingSystem;
    systems.possessionSystem = possessionSystem;
    systems.shootingSystem = shootingSystem;
    systems.animationSystem = animationSystem;  // Store reference for rendering functions

    // Wire up circular reference: animationSystem needs systems for renderPlayerLabel calls
    if (typeof animationSystem.setSystems === "function") {
        animationSystem.setSystems(systems);
    }

    // Return all systems
    return systems;
}

/**
 * Set up event subscriptions for cross-system communication
 * @private
 */
function _setupEventSubscriptions(eventBus, helpers) {
    // Example: Announce pass completions
    // eventBus.on('pass_complete', function(data) {
    //     if (helpers.announceEvent) {
    //         helpers.announceEvent('pass', data);
    //     }
    // });

    // Example: Update stats on possession change
    // eventBus.on('possession_change', function(data) {
    //     // Update possession stats
    // });

    // TODO: Wire up announcer, stats tracking, UI updates, etc.
}
