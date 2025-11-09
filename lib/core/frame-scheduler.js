// Frame Scheduler - Centralized game loop timing
// Wave 23D Phase 2: Replaces scattered mswait() calls with unified frame timing

/**
 * Creates a frame scheduler for managing game loop timing
 * Provides consistent frame rate control across all game modes
 * 
 * @returns {Object} Frame scheduler with timing control methods
 */
function createFrameScheduler() {
    var frameStart = 0;
    var frameCount = 0;
    var lastFPSCheck = 0;
    var fpsHistory = [];
    var maxFPSHistory = 10; // Track last 10 seconds

    return {
        /**
         * Mark the start of a new frame
         * Call this at the beginning of each game loop iteration
         */
        startFrame: function () {
            frameStart = Date.now();
            frameCount++;
        },

        /**
         * Wait for the next frame to maintain target frame rate
         * Replaces mswait() with centralized timing logic
         * 
         * @param {number} targetFrameTime - Target frame duration in milliseconds
         */
        waitForNextFrame: function (targetFrameTime) {
            var elapsed = Date.now() - frameStart;
            var remaining = targetFrameTime - elapsed;

            // Only wait if we're ahead of schedule
            if (remaining > 0) {
                mswait(remaining);
            }

            // Prepare for next frame
            this.startFrame();
        },

        /**
         * Get the actual time taken by the current frame
         * Useful for performance monitoring and debugging
         * 
         * @returns {number} Frame time in milliseconds
         */
        getFrameTime: function () {
            return Date.now() - frameStart;
        },

        /**
         * Get average FPS over the last measurement period
         * Updates every second with historical smoothing
         * 
         * @returns {number} Average frames per second
         */
        getAverageFPS: function () {
            var now = Date.now();

            // Update FPS counter every second
            if (now - lastFPSCheck >= 1000) {
                var fps = frameCount;

                // Add to history
                fpsHistory.push(fps);
                if (fpsHistory.length > maxFPSHistory) {
                    fpsHistory.shift();
                }

                // Reset for next second
                frameCount = 0;
                lastFPSCheck = now;
            }

            // Return smoothed average
            if (fpsHistory.length === 0) return 0;

            var sum = 0;
            for (var i = 0; i < fpsHistory.length; i++) {
                sum += fpsHistory[i];
            }
            return Math.round(sum / fpsHistory.length);
        },

        /**
         * Get current FPS (instantaneous, not smoothed)
         * 
         * @returns {number} Current frames per second
         */
        getCurrentFPS: function () {
            var now = Date.now();
            var elapsed = now - lastFPSCheck;

            if (elapsed === 0) return 0;
            return Math.round((frameCount * 1000) / elapsed);
        },

        /**
         * Reset frame counter and history
         * Call this when starting a new game or after major state changes
         */
        reset: function () {
            frameStart = Date.now();
            frameCount = 0;
            lastFPSCheck = Date.now();
            fpsHistory = [];
        },

        /**
         * Get frame timing statistics for debugging
         * 
         * @returns {Object} Stats object with current metrics
         */
        getStats: function () {
            return {
                currentFPS: this.getCurrentFPS(),
                averageFPS: this.getAverageFPS(),
                frameTime: this.getFrameTime(),
                frameCount: frameCount,
                historySize: fpsHistory.length
            };
        }
    };
}

// Export for use in system initialization
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createFrameScheduler: createFrameScheduler };
}
