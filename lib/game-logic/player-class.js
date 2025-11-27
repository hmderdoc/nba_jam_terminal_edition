// NBA Jam Player Class
// Player object constructor and methods

// ============================================================================
// PLAYER CONSTRUCTOR
// ============================================================================

function Player(name, jersey, attributes, sprite, shortNick) {
    this.name = name;
    this.jersey = jersey;
    this.shortNick = shortNick; // Short nickname for display
    this.attributes = attributes; // [speed, 3pt, dunk, power, steal, block]
    // Don't store sprite reference - causes circular refs that break JSON.stringify
    // Use getPlayerSprite(player) helper instead
    // this.sprite = sprite;
    this.turboCapacity = MAX_TURBO;
    this.turbo = this.turboCapacity;
    this.turboActive = false;
    this.heatStreak = 0; // For shooting momentum
    this.onFire = false;
    this.fireMakeStreak = 0;
    this.lastTurboUseTime = 0;
    this.inboundBoostTimer = 0;
    this.lastTurboX = null;
    this.lastTurboY = null;
    this.moveAccumulator = 0;
    this.stats = {
        points: 0,
        assists: 0,
        steals: 0,
        rebounds: 0,
        blocks: 0,
        fgm: 0,
        fga: 0,
        tpm: 0,
        tpa: 0,
        dunks: 0,
        dunkAttempts: 0,
        turnovers: 0
    };
    this.injured = false;
    this.injuryCount = 0;
    this.hasDribble = true;
    this.shakeCooldown = 0;
    this.shoveCooldown = 0;
    this.shoveAttemptCooldown = 0;
    this.shoverCooldown = 0;
    this.shoveFailureStun = 0;
    this.shakeUsedThisPossession = false; // Track if shake was used this possession
    this.playZoneDefense = 0; // Frames to play zone defense (when both defenders shoved)
    this.shovedFlashPhase = 0;  // Track alternation state for shoved visual effect
    this.knockdownTimer = 0;
    this.stealRecoverFrames = 0;

    // AI State Machine
    this.aiState = AI_STATE.OFFENSE_BALL; // Current FSM state
    this.aiTargetSpot = null; // Current waypoint/spot we're moving toward
    this.aiLastAction = ""; // For debugging
    this.aiCooldown = 0; // Frames to wait before next action
    this.axisToggle = false; // For movement alternation (legacy)
    this.offBallCutTimer = 0; // For alternating cut patterns

    // Controller metadata (for scoreboard)
    this.controllerLabel = "<CPU>";
    this.controllerIsHuman = false;

    // Attach player data to sprite
    sprite.playerData = this;
}

// ============================================================================
// PLAYER PROTOTYPE METHODS
// ============================================================================

Player.prototype.getSpeed = function () {
    var speedAttr = getEffectiveAttribute(this, ATTR_SPEED);
    var baseSpeed = speedAttr / 10.0;
    if (this.turboActive) {
        return baseSpeed * TURBO_SPEED_MULTIPLIER;
    }
    return baseSpeed;
};

Player.prototype.useTurbo = function (amount) {
    if (this.turbo > 0) {
        var capacity = (typeof this.turboCapacity === "number" && this.turboCapacity > 0) ? this.turboCapacity : MAX_TURBO;
        var oldTurbo = this.turbo;
        this.turbo -= amount;
        if (this.turbo < 0) this.turbo = 0;
        if (this.turbo > capacity) this.turbo = capacity;

        // MULTIPLAYER: Throttled turbo broadcast (every 10 points)
        if (mpCoordinator && mpCoordinator.isCoordinator) {
            var playerId = getPlayerGlobalId(this.sprite);
            if (playerId) {
                var lastBroadcast = mpSyncState.lastTurboBroadcast[playerId] || capacity;
                // Broadcast when turbo crosses a 10-point threshold or hits 0
                if (Math.floor(oldTurbo / 10) !== Math.floor(this.turbo / 10) || this.turbo === 0) {
                    mpCoordinator.broadcastGameState({
                        type: 'turboUpdate',
                        playerId: playerId,
                        turbo: this.turbo,
                        timestamp: Date.now()
                    });
                    mpSyncState.lastTurboBroadcast[playerId] = this.turbo;
                }
            }
        }

        return true;
    }
    return false;
};

Player.prototype.rechargeTurbo = function (amount) {
    var capacity = (typeof this.turboCapacity === "number" && this.turboCapacity > 0) ? this.turboCapacity : MAX_TURBO;
    this.turbo += amount;
    if (this.turbo > capacity) this.turbo = capacity;
};
