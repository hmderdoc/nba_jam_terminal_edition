// game-context.js - Dependency Injection Context for AI Modules
// Provides clean interface to game state, decoupling AI from global dependencies

/**
 * GameContext - Wrapper around gameState providing AI with controlled access
 * 
 * Benefits:
 * - AI modules testable with mock context
 * - Clear interface of what AI can/cannot access
 * - gameState structure changes don't break AI
 * - Enables AI reuse in different game modes
 */
function GameContext(gameState) {
    this.gameState = gameState;
}

// Clock & Timing
GameContext.prototype.getShotClock = function () {
    return this.gameState.shotClock || 24;
};

GameContext.prototype.getTimeRemaining = function () {
    return this.gameState.timeRemaining || 0;
};

// Ball Handler State
GameContext.prototype.getBallCarrier = function () {
    return this.gameState.ballCarrier || null;
};

GameContext.prototype.getBallHandlerStuckTimer = function () {
    return this.gameState.ballHandlerStuckTimer || 0;
};

GameContext.prototype.getBallHandlerAdvanceTimer = function () {
    return this.gameState.ballHandlerAdvanceTimer || 0;
};

GameContext.prototype.getBallHandlerDeadSince = function () {
    return this.gameState.ballHandlerDeadSince || null;
};

// Court State
GameContext.prototype.isFrontcourtEstablished = function () {
    return this.gameState.frontcourtEstablished || false;
};

GameContext.prototype.getCurrentTeam = function () {
    return this.gameState.currentTeam || null;
};

// Rebound State
GameContext.prototype.isReboundActive = function () {
    return this.gameState.reboundActive || false;
};

GameContext.prototype.isInbounding = function () {
    return this.gameState.inbounding || false;
};

GameContext.prototype.getReboundScramble = function () {
    return this.gameState.reboundScramble || { anticipating: false };
};

// Pass Intent (AI coordination)
GameContext.prototype.getPassIntent = function () {
    return this.gameState.passIntent || {};
};

GameContext.prototype.setPassIntent = function (playerKey, intent) {
    if (!this.gameState.passIntent) {
        this.gameState.passIntent = {};
    }
    this.gameState.passIntent[playerKey] = intent;
};

GameContext.prototype.clearPassIntent = function (playerKey) {
    if (this.gameState.passIntent && this.gameState.passIntent[playerKey]) {
        delete this.gameState.passIntent[playerKey];
    }
};

// Query Methods (computed properties)
GameContext.prototype.isShotClockUrgent = function (threshold) {
    threshold = threshold || 5;
    return this.getShotClock() <= threshold;
};

GameContext.prototype.isBackcourtUrgent = function (urgentSeconds) {
    urgentSeconds = urgentSeconds || 8;
    return this.getShotClock() <= (24 - urgentSeconds);
};

GameContext.prototype.isBallHandlerStuck = function (framesThreshold) {
    framesThreshold = framesThreshold || 2;
    return this.getBallHandlerStuckTimer() >= framesThreshold;
};

GameContext.prototype.hasBallHandlerAdvanced = function (framesThreshold) {
    framesThreshold = framesThreshold || 1;
    return this.getBallHandlerAdvanceTimer() >= framesThreshold;
};

// Validation (prevents invalid state modifications)
GameContext.prototype.isValidTeam = function (teamName) {
    return teamName === "teamA" || teamName === "teamB";
};

// Read-only access to full state (for debugging/logging only)
GameContext.prototype.getStateSnapshot = function () {
    // Return shallow copy to prevent direct modification
    var snapshot = {};
    for (var key in this.gameState) {
        if (this.gameState.hasOwnProperty(key)) {
            snapshot[key] = this.gameState[key];
        }
    }
    return snapshot;
};

// Factory function for creating context
function createGameContext(gameState) {
    return new GameContext(gameState);
}

// Export for global scope (Synchronet compatibility)
if (typeof module !== "undefined" && module.exports) {
    module.exports = { GameContext: GameContext, createGameContext: createGameContext };
}
