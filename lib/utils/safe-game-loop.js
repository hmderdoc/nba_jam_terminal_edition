/**
 * Safe Game Loop Wrapper
 * Wraps the game loop with error handling and state capture
 */

/**
 * Create a safe wrapper around game loop function
 * This captures errors within the game loop and logs them with full state
 * 
 * @param {Function} gameLoopFn - The game loop function to wrap
 * @param {Object} systems - Systems object (stateManager, eventBus, etc.)
 * @returns {Function} Wrapped game loop function
 */
function createSafeGameLoop(gameLoopFn, systems) {
    return function safeGameLoopWrapper() {
        try {
            // Call the actual game loop
            return gameLoopFn.apply(this, arguments);
        } catch (e) {
            // Log error with full context including game state
            if (typeof logError === "function") {
                logError(e, ErrorSeverity.ERROR, {
                    function: "gameLoop",
                    systems: systems,
                    tick: systems.stateManager ? systems.stateManager.get("tick") : "unknown"
                });
            }

            // Show error to user
            console.print("\r\n\1r\1hERROR in game loop: " + e.toString() + "\1n\r\n");
            console.print("Check error.log for details\r\n");
            console.pause();

            // Re-throw to exit game loop
            throw e;
        }
    };
}
