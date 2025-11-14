/**
 * Player-centric constants: collision thresholds, boundary clamps, sprite defaults.
 * Loaded by lib/utils/constants.js and available via PLAYER_CONSTANTS plus the derived
 * globals (PLAYER_BOUNDARIES, PLAYER_COLLISION_THRESHOLD, etc.).
 */
(function () {
    function resolveGlobal() {
        if (typeof globalThis !== "undefined") return globalThis;
        if (typeof global !== "undefined") return global;
        if (typeof window !== "undefined") return window;
        if (typeof this !== "undefined") return this;
        try {
            return Function("return this")();
        } catch (e) {
            return {};
        }
    }

    var root = resolveGlobal();

    var PLAYER_CONSTANTS = {
        COLLISION_THRESHOLD: {
            dx: 2,
            dy: 2
        },
        COURT_BOUNDARIES: {
            minX: 2,
            maxXOffset: 1,
            minY: 2,
            maxYOffset: 5,
            movementMaxXOffset: 7,
            feetMinX: 2,
            feetMaxXOffset: 2,
            fallbackWidthClamp: 7
        },
        SPRITE_DEFAULTS: {
            width: 5
        },
        SPEED: {
            basePerFrame: 0.75,
            turboPerFrame: 1.1,
            turboBallHandlerFactor: 0.85,
            minPerFrame: 0.2,
            maxPerFrame: 1.2,
            attrScalePerPoint: 0.02,
            maxStepsPerFrame: 4,
            diagonalNormalizationFactor: 0.707
        },
        INPUT_BUFFER: {
            maxFlush: 50
        },
        CLIENT_COLLISION_THRESHOLD: {
            dx: 1.5,
            dy: 1.5
        }
    };

    root.PLAYER_CONSTANTS = PLAYER_CONSTANTS;
    root.PLAYER_BOUNDARIES = PLAYER_CONSTANTS.COURT_BOUNDARIES;
    root.PLAYER_COLLISION_THRESHOLD = PLAYER_CONSTANTS.COLLISION_THRESHOLD;
    root.PLAYER_SPRITE_DEFAULTS = PLAYER_CONSTANTS.SPRITE_DEFAULTS;
    root.PLAYER_INPUT_BUFFER_MAX_FLUSH = PLAYER_CONSTANTS.INPUT_BUFFER.maxFlush;
    root.PLAYER_CLIENT_COLLISION_THRESHOLD = PLAYER_CONSTANTS.CLIENT_COLLISION_THRESHOLD;

    if (typeof module !== "undefined" && module.exports) {
        module.exports = PLAYER_CONSTANTS;
    }
})();
