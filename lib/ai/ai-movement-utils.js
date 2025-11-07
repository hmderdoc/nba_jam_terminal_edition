/**
 * NBA JAM - AI Movement Utilities
 * 
 * Shared movement helper functions used by all AI state handlers
 * (ball carrier, off-ball offense, defense)
 */

/**
 * Move an AI sprite toward a target position using intelligent pathfinding
 * Handles axis toggling for diagonal movement and budget-based movement
 * Includes stuck detection and unstuck behavior
 * 
 * @param {Object} sprite - Player sprite to move
 * @param {number} targetX - Target X coordinate
 * @param {number} targetY - Target Y coordinate
 */
function moveAITowards(sprite, targetX, targetY) {
    if (!sprite) return;

    var dx = targetX - sprite.x;
    var dy = targetY - sprite.y;
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1.5 || isPlayerKnockedDown(sprite)) return;

    var startX = sprite.x;
    var startY = sprite.y;
    var axisToggle = sprite.playerData ? (sprite.playerData.axisToggle || false) : false;

    // Stuck detection: track if AI hasn't moved for several frames
    if (!sprite.playerData) sprite.playerData = {};
    if (sprite.playerData.stuckCounter === undefined) sprite.playerData.stuckCounter = 0;
    if (sprite.playerData.lastAIX === undefined) sprite.playerData.lastAIX = sprite.x;
    if (sprite.playerData.lastAIY === undefined) sprite.playerData.lastAIY = sprite.y;

    // Check if stuck (same position for multiple frames)
    if (sprite.x === sprite.playerData.lastAIX && sprite.y === sprite.playerData.lastAIY) {
        sprite.playerData.stuckCounter++;
    } else {
        sprite.playerData.stuckCounter = 0;
    }

    // If stuck for 30+ frames (~1.5 seconds), apply unstuck behavior
    var isStuck = sprite.playerData.stuckCounter > 30;

    // Detect if in corner or against boundary
    var nearLeftBound = sprite.x < 5;
    var nearRightBound = sprite.x > COURT_WIDTH - 12;
    var nearTopBound = sprite.y < 5;
    var nearBottomBound = sprite.y > COURT_HEIGHT - 10;
    var inCorner = (nearLeftBound || nearRightBound) && (nearTopBound || nearBottomBound);

    // If stuck in corner, override target to move toward center
    if (isStuck && inCorner) {
        var centerX = COURT_WIDTH / 2;
        var centerY = COURT_HEIGHT / 2;
        targetX = centerX;
        targetY = centerY;
        dx = targetX - sprite.x;
        dy = targetY - sprite.y;
        // Reset stuck counter after applying unstuck behavior
        sprite.playerData.stuckCounter = 0;
    }

    // Update last position for stuck detection
    sprite.playerData.lastAIX = sprite.x;
    sprite.playerData.lastAIY = sprite.y;

    var elapsedFactor = 1;
    if (typeof sprite.playerData === "object") {
        if (sprite.playerData.__lastAIMove === undefined)
            sprite.playerData.__lastAIMove = Date.now();
        var now = Date.now();
        var deltaMs = now - sprite.playerData.__lastAIMove;
        if (deltaMs < 0 || deltaMs > 1000) deltaMs = 50;
        elapsedFactor = Math.max(1, Math.round(deltaMs / 50));
        sprite.playerData.__lastAIMove = now;
    }

    var movementBudget = createMovementCounters(sprite);
    if (movementBudget.moves > 0 && elapsedFactor > 1) {
        movementBudget.moves = Math.min(4, movementBudget.moves * elapsedFactor);
        movementBudget.horizontal = Math.min(4, movementBudget.horizontal * elapsedFactor);
        movementBudget.vertical = Math.min(4, movementBudget.vertical * elapsedFactor);
    }
    var movesPerUpdate = movementBudget.moves;
    if (movesPerUpdate <= 0) return;
    var movementCounters = {
        horizontal: Math.max(0, movementBudget.horizontal),
        vertical: Math.max(0, movementBudget.vertical),
        diagonalMoves: movementBudget.diagonalMoves !== undefined ? movementBudget.diagonalMoves : Math.max(0, movementBudget.horizontal)
    };

    for (var m = 0; m < movesPerUpdate; m++) {
        dx = targetX - sprite.x;
        dy = targetY - sprite.y;

        if (movementCounters.horizontal <= 0 && movementCounters.vertical <= 0) break;

        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
            break;
        }

        if (Math.abs(dx) > 1 && Math.abs(dy) > 1) {
            // Diagonal movement - use normalized diagonal movement
            var hKey = dx < 0 ? KEY_LEFT : KEY_RIGHT;
            var vKey = dy < 0 ? KEY_UP : KEY_DOWN;

            // Try diagonal movement first (normalized speed)
            if (typeof applyDiagonalMovement === "function") {
                var moved = applyDiagonalMovement(sprite, hKey, vKey, movementCounters);
                if (!moved) {
                    // If diagonal blocked, try alternating axes
                    var primaryKey = axisToggle ? vKey : hKey;
                    moved = applyMovementCommand(sprite, primaryKey, movementCounters);
                    if (!moved) {
                        var altKey = axisToggle ? hKey : vKey;
                        moved = applyMovementCommand(sprite, altKey, movementCounters);
                    }
                    axisToggle = !axisToggle;
                }
            } else {
                // Fallback: alternating axis movement
                var primaryKey = axisToggle ? vKey : hKey;
                var moved = applyMovementCommand(sprite, primaryKey, movementCounters);
                if (!moved) {
                    var altKey = axisToggle ? hKey : vKey;
                    moved = applyMovementCommand(sprite, altKey, movementCounters);
                }
                axisToggle = !axisToggle;
            }
            if (!moved) continue;
        } else {
            if (Math.abs(dx) > 1) {
                applyMovementCommand(sprite, dx < 0 ? KEY_LEFT : KEY_RIGHT, movementCounters);
            }
            if (Math.abs(dy) > 1) {
                applyMovementCommand(sprite, dy < 0 ? KEY_UP : KEY_DOWN, movementCounters);
            }
        }
    }

    if (sprite.playerData) {
        sprite.playerData.axisToggle = axisToggle;
        if (sprite.x !== startX || sprite.y !== startY) {
            sprite.playerData.lastTurboX = null;
            sprite.playerData.lastTurboY = null;
        }
    }
}
