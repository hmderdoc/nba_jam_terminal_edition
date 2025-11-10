// game-context.js - Dependency Injection Context for AI Modules
// Provides clean interface to game state, decoupling AI from global dependencies

/**
 * GameContext - Wrapper around stateManager providing AI with controlled access
 * 
 * Benefits:
 * - AI modules testable with mock context
 * - Clear interface of what AI can/cannot access
 * - State structure changes don't break AI
 * - Enables AI reuse in different game modes
 */
function GameContext(stateManager) {
    this.stateManager = stateManager;
}

// Clock & Timing
GameContext.prototype.getShotClock = function () {
    return this.stateManager.get('shotClock') || 24;
};

GameContext.prototype.getTimeRemaining = function () {
    return this.stateManager.get('timeRemaining') || 0;
};

// Ball Handler State
GameContext.prototype.getBallCarrier = function () {
    return this.stateManager.get('ballCarrier') || null;
};

GameContext.prototype.getBallHandlerStuckTimer = function () {
    return this.stateManager.get('ballHandlerStuckTimer') || 0;
};

GameContext.prototype.getBallHandlerAdvanceTimer = function () {
    return this.stateManager.get('ballHandlerAdvanceTimer') || 0;
};

GameContext.prototype.getBallHandlerDeadSince = function () {
    return this.stateManager.get('ballHandlerDeadSince') || null;
};

// Court State
GameContext.prototype.isFrontcourtEstablished = function () {
    return this.stateManager.get('frontcourtEstablished') || false;
};

GameContext.prototype.getCurrentTeam = function () {
    return this.stateManager.get('currentTeam') || null;
};

// Rebound State
GameContext.prototype.isReboundActive = function () {
    return this.stateManager.get('reboundActive') || false;
};

GameContext.prototype.isInbounding = function () {
    return this.stateManager.get('inbounding') || false;
};

GameContext.prototype.getReboundScramble = function () {
    return this.stateManager.get('reboundScramble') || { anticipating: false };
};

// Pass Intent (AI coordination)
GameContext.prototype.getPassIntent = function () {
    return this.stateManager.get('passIntent') || {};
};

GameContext.prototype.setPassIntent = function (playerKey, intent) {
    var passIntent = this.stateManager.get('passIntent');
    if (!passIntent) {
        passIntent = {};
    }
    passIntent[playerKey] = intent;
    this.stateManager.set('passIntent', passIntent, 'ai_pass_intent');
};

GameContext.prototype.clearPassIntent = function (playerKey) {
    var passIntent = this.stateManager.get('passIntent');
    if (passIntent && passIntent[playerKey]) {
        delete passIntent[playerKey];
        this.stateManager.set('passIntent', passIntent, 'ai_clear_pass_intent');
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
    // Return current state from stateManager
    // Note: This returns the internal state object, treat as read-only
    return this.stateManager.get();
};

// Factory function for creating context
function createGameContext(stateManager) {
    return new GameContext(stateManager);
}

// Export for global scope (Synchronet compatibility)
if (typeof module !== "undefined" && module.exports) {
    module.exports = { GameContext: GameContext, createGameContext: createGameContext };
}
