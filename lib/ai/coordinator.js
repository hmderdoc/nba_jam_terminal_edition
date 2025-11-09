/**
 * AI: Coordinator (Main Update Loop)
 * 
 * Two-pass system:
 * 1. Assign AI states to all AI-controlled players
 * 2. Execute state-specific logic
 * 
 * States: OFFENSE_BALL, OFFENSE_NO_BALL, DEFENSE_ON_BALL, DEFENSE_HELP, REBOUND
 */

load("sbbsdefs.js");

// AI State constants
var AI_STATE = {
    OFFENSE_BALL: 1,
    OFFENSE_NO_BALL: 2,
    DEFENSE_ON_BALL: 3,
    DEFENSE_HELP: 4,
    REBOUND: 5
};

/**
 * Main AI update function - assigns states and executes logic
 * Called every frame for all AI-controlled players
 * @param {Object} systems - Systems object for dependency injection
 */
function updateAI(systems) {
    var stateManager = systems.stateManager;

    // Create game context for dependency injection
    var context = createGameContext(stateManager);

    var allPlayers = getAllPlayers();
    var ballCarrier = context.getBallCarrier();

    debugLog("[AI COORD] Frame start - ballCarrier: " + (ballCarrier ? ballCarrier.playerData.name + " at x=" + ballCarrier.x : "null"));
    debugLog("[AI COORD] Total players in registry: " + allPlayers.length);

    // First pass: Assign states to all AI players
    for (var i = 0; i < allPlayers.length; i++) {
        var player = allPlayers[i];

        // Skip if not AI-controlled (only process CPU players, not local or remote humans)
        if (!player || !player.playerData) continue;
        debugLog("[AI COORD] Checking player: " + player.playerData.name + " (controllerType=" + player.controllerType + ", isHuman=" + player.isHuman + ")");
        if (player.controllerType && player.controllerType !== "ai") continue;
        if (!player.controllerType && player.isHuman) continue; // Fallback for single-player mode

        // Skip knockdown recovery
        if (player.playerData.knockdownTimer && player.playerData.knockdownTimer > 0) {
            player.playerData.knockdownTimer--;
            if (player.playerData.knockdownTimer > 0) {
                player.playerData.turboActive = false;
                continue;
            }
        }

        // Skip steal recovery
        if (player.playerData.stealRecoverFrames > 0) {
            player.playerData.turboActive = false;
            continue;
        }

        var teamName = getPlayerTeamName(player);
        if (!teamName) continue;

        // Reset turbo active (will be set by AI logic if needed)
        player.playerData.turboActive = false;

        // Determine AI state
        if (context.isReboundActive() && !context.isInbounding()) {
            player.playerData.aiState = AI_STATE.REBOUND;
        } else if (context.getCurrentTeam() === teamName) {
            // Offense
            if (player === ballCarrier) {
                player.playerData.aiState = AI_STATE.OFFENSE_BALL;
                debugLog("[AI COORD] " + player.playerData.name + " assigned OFFENSE_BALL (has ball)");
            } else {
                player.playerData.aiState = AI_STATE.OFFENSE_NO_BALL;
                debugLog("[AI COORD] " + player.playerData.name + " assigned OFFENSE_NO_BALL");
            }
        } else {
            // Defense - determine if on-ball or help
            if (ballCarrier) {
                var distToBallCarrier = distanceBetweenPoints(player.x, player.y, ballCarrier.x, ballCarrier.y);
                var teammates = spriteRegistry.getByTeam(teamName);

                // Find if my teammate is closer to ball carrier
                var teammate = (teammates[0] === player) ? teammates[1] : teammates[0];
                var teammateDist = teammate
                    ? distanceBetweenPoints(teammate.x, teammate.y, ballCarrier.x, ballCarrier.y)
                    : 999;

                // I'm on-ball defender if I'm closer to ball carrier than my teammate
                if (distToBallCarrier < teammateDist) {
                    player.playerData.aiState = AI_STATE.DEFENSE_ON_BALL;
                } else {
                    player.playerData.aiState = AI_STATE.DEFENSE_HELP;
                }
            } else {
                player.playerData.aiState = AI_STATE.DEFENSE_HELP; // Default
            }
        }
    }

    // Second pass: Execute AI logic based on state
    for (var i = 0; i < allPlayers.length; i++) {
        var player = allPlayers[i];

        // Skip if not AI-controlled (only process CPU players, not local or remote humans)
        if (!player || !player.playerData) continue;
        if (player.controllerType && player.controllerType !== "ai") continue;
        if (!player.controllerType && player.isHuman) continue; // Fallback for single-player mode

        // Skip knockdown recovery
        if (player.playerData.knockdownTimer && player.playerData.knockdownTimer > 0) {
            player.playerData.turboActive = false;
            continue;
        }

        // Skip steal recovery
        if (player.playerData.stealRecoverFrames > 0) {
            player.playerData.turboActive = false;
            continue;
        }

        var teamName = getPlayerTeamName(player);
        if (!teamName) continue;

        var state = player.playerData.aiState;

        // Execute state-specific logic (passing systems for dependency injection)
        if (state === AI_STATE.REBOUND) {
            handleAIRebound(player, context, systems);
        } else if (state === AI_STATE.OFFENSE_BALL) {
            aiOffenseBall(player, teamName, context, systems);
        } else if (state === AI_STATE.OFFENSE_NO_BALL) {
            aiOffenseNoBall(player, teamName, context, systems);
        } else if (state === AI_STATE.DEFENSE_ON_BALL) {
            aiDefenseOnBall(player, teamName, ballCarrier, context, systems);
        } else if (state === AI_STATE.DEFENSE_HELP) {
            aiDefenseHelp(player, teamName, ballCarrier, context, systems);
        }
    }
}

/**
 * Handle AI rebound logic - sprint to anticipated/actual rebound position
 * @param {Object} player - Sprite with playerData
 * @param {GameContext} context - Dependency injection context
 * @param {Object} systems - Systems object for dependency injection
 */
function handleAIRebound(player, context, systems) {
    // Check for anticipated rebound (shot in air) OR active rebound (ball bouncing)
    var reboundScramble = context.getReboundScramble();
    if (!context.isReboundActive() && !reboundScramble.anticipating) return;

    var targetX, targetY;
    var stateManager = systems.stateManager;

    // Use anticipated position if shot is still in air, actual position once ball lands
    if (reboundScramble.anticipating && !reboundScramble.active) {
        targetX = clampToCourtX(reboundScramble.anticipatedX);
        targetY = clampToCourtY(reboundScramble.anticipatedY);
    } else {
        targetX = clampToCourtX(stateManager.get('reboundX'));
        targetY = clampToCourtY(stateManager.get('reboundY'));
    }

    var dist = distanceBetweenPoints(player.x, player.y, targetX, targetY);

    // If already at rebound location, stop moving
    if (dist < 2) {
        return; // Don't overshoot - wait for rebound to be awarded
    }

    // Use turbo to get to rebound faster only if far away
    var speed = 2;
    if (dist > 10 && player.playerData && player.playerData.turbo > 10) {
        player.playerData.turboActive = true;
        player.playerData.useTurbo(TURBO_DRAIN_RATE * 0.5);
        speed = 4; // Turbo speed for rebound
    }

    // Sprint to rebound location using new steering
    steerToward(player, targetX, targetY, speed, systems);
}
