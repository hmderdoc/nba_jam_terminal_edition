/**
 * NBA JAM - Module Loader
 * Centralized dependency loading with error handling and validation
 * 
 * This module loads all game dependencies in the correct order with validation checks.
 * Wave 23D: Extracted from nba_jam.js to improve maintainability
 */

/**
 * Load all game modules
 * Returns object with multiplayerEnabled flag
 */
function loadGameModules() {
    var loadErrors = [];

    try {
        // Core BBS dependencies (must be first)
        load("sbbsdefs.js");
        load("frame.js");
        load("sprite.js");

        // Error handling (load first for global error capture)
        load(js.exec_dir + "lib/utils/error-handler.js");
        load(js.exec_dir + "lib/utils/safe-game-loop.js");
        initErrorHandler();
        setupGlobalErrorHandler();

        // Constants and configuration (validate after load)
        load(js.exec_dir + "lib/utils/constants.js");
        if (typeof COURT_WIDTH === "undefined") {
            throw new Error("LOAD ORDER ERROR: constants.js failed to load. Check file path and syntax.");
        }

        load(js.exec_dir + "lib/config/game-balance.js");
        if (typeof GAME_BALANCE === "undefined") {
            throw new Error("LOAD ORDER ERROR: game-balance.js failed to load. This is a critical dependency.");
        }

        // Utilities
        load(js.exec_dir + "lib/utils/helpers.js");
        load(js.exec_dir + "lib/utils/validation.js");

        // Core architecture (Wave 23)
        load(js.exec_dir + "lib/core/state-manager.js");
        load(js.exec_dir + "lib/core/event-bus.js");
        load(js.exec_dir + "lib/core/frame-scheduler.js");
        load(js.exec_dir + "lib/core/game-loop-core.js");
        load(js.exec_dir + "lib/core/system-init.js");

        // Systems (Wave 23 testable architecture)
        load(js.exec_dir + "lib/systems/passing-system.js");
        load(js.exec_dir + "lib/systems/possession-system.js");
        load(js.exec_dir + "lib/systems/shooting-system.js");

        // Rendering
        load(js.exec_dir + "lib/rendering/sprite-utils.js");
        load(js.exec_dir + "lib/rendering/uniform-system.js");
        load(js.exec_dir + "lib/rendering/animation-system.js");
        load(js.exec_dir + "lib/rendering/player-labels.js");
        load(js.exec_dir + "lib/rendering/shoe-colors.js");
        load(js.exec_dir + "lib/rendering/ball.js");
        load(js.exec_dir + "lib/rendering/court-rendering.js");
        load(js.exec_dir + "lib/rendering/jump-indicators.js");

        // Game logic
        load(js.exec_dir + "lib/game-logic/game-state.js");
        load(js.exec_dir + "lib/game-logic/phase-handler.js");
        load(js.exec_dir + "lib/game-logic/player-class.js");
        load(js.exec_dir + "lib/game-logic/movement-physics.js");
        load(js.exec_dir + "lib/game-logic/passing.js");
        load(js.exec_dir + "lib/game-logic/defense-actions.js");
        load(js.exec_dir + "lib/game-logic/physical-play.js");
        load(js.exec_dir + "lib/game-logic/rebounds.js");
        load(js.exec_dir + "lib/game-logic/dunks.js");
        load(js.exec_dir + "lib/game-logic/shooting.js");
        load(js.exec_dir + "lib/game-logic/possession.js");
        load(js.exec_dir + "lib/game-logic/team-data.js");
        load(js.exec_dir + "lib/game-logic/input-handler.js");
        load(js.exec_dir + "lib/game-logic/violations.js");
        load(js.exec_dir + "lib/game-logic/dead-dribble.js");
        load(js.exec_dir + "lib/game-logic/stats-tracker.js");
        load(js.exec_dir + "lib/game-logic/game-utils.js");
        load(js.exec_dir + "lib/game-logic/score-calculator.js");
        load(js.exec_dir + "lib/game-logic/hot-streak.js");
        load(js.exec_dir + "lib/game-logic/fast-break-detection.js");

        // Bookie system
        load(js.exec_dir + "lib/bookie/bookie.js");

        // More utilities
        load(js.exec_dir + "lib/utils/player-helpers.js");
        load(js.exec_dir + "lib/utils/positioning-helpers.js");
        load(js.exec_dir + "lib/utils/string-helpers.js");

        // UI modules
        load(js.exec_dir + "lib/ui/score-display.js");
        load(js.exec_dir + "lib/ui/controller-labels.js");
        load(js.exec_dir + "lib/ui/demo-results.js");
        load(js.exec_dir + "lib/ui/game-over.js");
        load(js.exec_dir + "lib/ui/announcer.js");
        load(js.exec_dir + "lib/ui/scoreboard.js");
        load(js.exec_dir + "lib/ui/menus.js");
        load(js.exec_dir + "lib/ui/halftime.js");

        // AI modules
        load(js.exec_dir + "lib/ai/ai-decision-support.js");
        load(js.exec_dir + "lib/ai/ai-difficulty.js");
        load(js.exec_dir + "lib/ai/ai-movement-utils.js");
        load(js.exec_dir + "lib/ai/ai-corner-escape.js");
        load(js.exec_dir + "lib/ai/game-context.js");
        load(js.exec_dir + "lib/ai/offense-ball-handler.js");
        load(js.exec_dir + "lib/ai/offense-off-ball.js");
        load(js.exec_dir + "lib/ai/defense-on-ball.js");
        load(js.exec_dir + "lib/ai/defense-help.js");
        load(js.exec_dir + "lib/ai/coordinator.js");

        // Sprite management (validate after load)
        load(js.exec_dir + "lib/core/sprite-registry.js");
        if (typeof spriteRegistry === "undefined") {
            throw new Error("LOAD ORDER ERROR: sprite-registry.js failed to load. This is a critical dependency.");
        }
        load(js.exec_dir + "lib/core/sprite-init.js");

        // Animation
        load(js.exec_dir + "lib/animation/bearing-frames.js");
        load(js.exec_dir + "lib/animation/knockback-system.js");

        // Effects
        load(js.exec_dir + "lib/rendering/fire-effects.js");

        // Events and input
        load(js.exec_dir + "lib/core/event-system.js");
        load(js.exec_dir + "lib/core/input-buffer.js");

        // Multiplayer (optional - loaded on demand)
        var multiplayerEnabled = false;
        try {
            load(js.exec_dir + "lib/multiplayer/mp_identity.js");
            load(js.exec_dir + "lib/multiplayer/mp_team_data.js");
            load(js.exec_dir + "lib/multiplayer/mp_config.js");
            load(js.exec_dir + "lib/multiplayer/mp_network.js");
            load(js.exec_dir + "lib/multiplayer/mp_sessions.js");
            load(js.exec_dir + "lib/multiplayer/mp_lobby.js");
            load(js.exec_dir + "lib/multiplayer/mp_failover.js");
            load(js.exec_dir + "lib/multiplayer/mp_coordinator.js");
            load(js.exec_dir + "lib/multiplayer/mp_client.js");
            load(js.exec_dir + "lib/multiplayer/mp-screen-coordinator.js");
            load(js.exec_dir + "lib/multiplayer/mp_input_replay.js");
            multiplayerEnabled = true;
        } catch (mpLoadError) {
            log(LOG_WARNING, "NBA JAM: Multiplayer load failed: " + mpLoadError + " (at " + (mpLoadError.fileName || "?") + ":" + (mpLoadError.lineNumber || "?") + ")");
            loadErrors.push({
                module: "multiplayer",
                error: mpLoadError,
                optional: true
            });
        }

        return {
            success: true,
            multiplayerEnabled: multiplayerEnabled,
            errors: loadErrors
        };

    } catch (e) {
        // Critical load error
        log(LOG_ERROR, "NBA JAM: CRITICAL MODULE LOAD FAILURE: " + e);
        if (e.fileName && e.lineNumber) {
            log(LOG_ERROR, "  at " + e.fileName + ":" + e.lineNumber);
        }

        return {
            success: false,
            multiplayerEnabled: false,
            errors: loadErrors.concat([{
                module: "critical",
                error: e,
                optional: false
            }]),
            criticalError: e
        };
    }
}
