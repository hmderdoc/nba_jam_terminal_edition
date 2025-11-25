/**
 * Multiplayer tuning & networking constants.
 * Loaded by lib/utils/constants.js and shared across mp modules.
 */

var MP_CONSTANTS = {
    CHAT_CHANNEL: "nba_jam_lobby",
    PING_INTERVAL_MS: 2000,
    DEFAULT_SERVERS: {
        local: {
            name: "Local BBS",
            addr: "localhost",
            port: 10088,
            description: "Games with players on this BBS only"
        },
        interbbs: {
            name: "Synchronet Network",
            addr: "services.synchro.net",
            port: 10088,
            description: "Games with players from any BBS"
        }
    },
    TUNING_PRESETS: {
        local: {
            inputFlushInterval: 33,
            stateUpdateInterval: 50,
            maxInputBatch: 5,
            reconciliationStrength: 0.5
        },
        interbbs: {
            inputFlushInterval: 50,
            stateUpdateInterval: 100,
            maxInputBatch: 10,
            reconciliationStrength: 0.3
        }
    },
    LATENCY_INDICATORS: [
        { threshold: 30, text: "Excellent", color: "\1g\1h", bars: "●●●●●" },
        { threshold: 80, text: "Good", color: "\1g", bars: "●●●●○" },
        { threshold: 150, text: "Fair", color: "\1y", bars: "●●●○○" },
        { threshold: 250, text: "Poor", color: "\1r\1h", bars: "●●○○○" }
    ],
    MEASURE_LATENCY_SAMPLES: 5,
    MEASURE_LATENCY_MSWAIT: 100,
    ADAPTIVE_TUNING: {
        excellent: {
            inputFlushInterval: 33,
            stateUpdateInterval: 50,
            reconciliationStrength: 0.6,
            predictionFrames: 2
        },
        good: {
            inputFlushInterval: 50,
            stateUpdateInterval: 75,
            reconciliationStrength: 0.4,
            predictionFrames: 3
        },
        fair: {
            inputFlushInterval: 75,
            stateUpdateInterval: 100,
            reconciliationStrength: 0.3,
            predictionFrames: 5
        },
        poor: {
            inputFlushInterval: 100,
            stateUpdateInterval: 150,
            reconciliationStrength: 0.2,
            predictionFrames: 7
        },
        default: {
            inputFlushInterval: 150,
            stateUpdateInterval: 200,
            reconciliationStrength: 0.1,
            predictionFrames: 10
        }
    },
    // Reconciliation thresholds (Wave 24 flicker fixes)
    DRIFT_SNAP_THRESHOLD: 15,        // Units of position drift before forced snap + reset
    VISUAL_GUARD_SMALL_DELTA: 2.25,  // Small deltas suppressed by visual guard
    VISUAL_GUARD_BEARING_THRESHOLD: 2.0,  // Don't override bearing for tiny movements

    // Phase-based prediction modes (Wave 24 snapback solution)
    // Each phase defines how aggressively the client should predict vs trust authority
    GAME_PHASES: {
        // Normal gameplay - standard prediction with visual guards
        NORMAL_PLAY: {
            prediction: true,
            reconciliationStrength: 0.3,
            inputTapering: false,
            description: "Standard gameplay with client-side prediction"
        },

        // Inbound walk - coordinator scripting player movement to inbound spot
        // Disable prediction entirely, trust authority 100%
        INBOUND_WALK: {
            prediction: false,
            reconciliationStrength: 1.0,  // Snap immediately to authority
            inputTapering: false,
            description: "Auto-walk to inbound position (no prediction)"
        },

        // Inbound ready - player at spot, waiting to pass
        // Light prediction, player might adjust position slightly
        INBOUND_READY: {
            prediction: true,
            reconciliationStrength: 0.5,
            inputTapering: false,
            description: "Standing at inbound spot (light prediction)"
        },

        // Recovery after large snap - prevent immediate drift reintroduction
        // Apply input tapering to dampen first few inputs
        POST_SNAP_RECOVERY: {
            prediction: true,
            reconciliationStrength: 0.5,  // Stronger than normal
            inputTapering: true,
            taperingFrames: 5,
            taperingFactor: 0.5,  // Apply inputs at 50% strength
            description: "Recovering from large correction (dampened input)"
        },

        // Rebound scramble - chaotic multi-player movement
        // High prediction tolerance, low reconciliation (allow more client autonomy)
        REBOUND_SCRAMBLE: {
            prediction: true,
            reconciliationStrength: 0.15,  // Very gentle corrections
            inputTapering: false,
            description: "Rebound scramble (high prediction tolerance)"
        },

        // Dead ball - shot clock violation, out of bounds, etc.
        // Moderate prediction, waiting for inbound setup
        DEAD_BALL: {
            prediction: true,
            reconciliationStrength: 0.4,
            inputTapering: false,
            description: "Dead ball pause (moderate prediction)"
        }
    },

    // Animation hint pipeline (Wave 24 animation triggers)
    ANIMATION_HINTS: {
        TTL_FRAMES: 18,          // Hints remain valid for ~0.9s unless refreshed
        MAX_PER_PACKET: 4,       // Cap outbound hints per state packet to bound payload size
        INBOUND: {
            WALK_FRAMES: 24,     // Matches inbound pickup easing window (frames 0-24)
            READY_FRAMES: 70,    // Matches inbound positioning window (frames 25-94)
            TARGET_FRAMES: 70    // Receiver/defender easing window for inbound setup
        },
        DRIFT: {
            FLASH_FRAMES: 8,     // Highlight duration for client-side drift snap flash
            LERP_FRAMES: 6       // Frames to ease toward authority after a drift snap
        }
    },

    PREDICTION: {
        TURBO: {
            DRAIN_FACTOR: 0.5,           // Client-side prediction drains 50% of the authoritative rate
            CATCHUP_FACTOR: 0.0          // During catch-up blending, skip predictive drain entirely
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = MP_CONSTANTS;
}
