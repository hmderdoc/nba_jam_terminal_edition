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
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = MP_CONSTANTS;
}
