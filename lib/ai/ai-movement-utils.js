/**
 * NBA JAM - AI Movement Utilities
 * 
 * Shared movement helper functions used by all AI state handlers
 * (ball carrier, off-ball offense, defense)
 */

/**
 * Move an AI sprite toward a target position using intelligent pathfinding
 * Handles axis toggling for diagonal movement and budget-based movement
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
        vertical: Math.max(0, movementBudget.vertical)
    };

    for (var m = 0; m < movesPerUpdate; m++) {
        dx = targetX - sprite.x;
        dy = targetY - sprite.y;

        if (movementCounters.horizontal <= 0 && movementCounters.vertical <= 0) break;

        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
            break;
        }

        if (Math.abs(dx) > 1 && Math.abs(dy) > 1) {
            var primaryKey = axisToggle ? (dy < 0 ? KEY_UP : KEY_DOWN) : (dx < 0 ? KEY_LEFT : KEY_RIGHT);
            var moved = applyMovementCommand(sprite, primaryKey, movementCounters);
            if (!moved) {
                var altKey = axisToggle ? (dx < 0 ? KEY_LEFT : KEY_RIGHT) : (dy < 0 ? KEY_UP : KEY_DOWN);
                moved = applyMovementCommand(sprite, altKey, movementCounters);
            }
            axisToggle = !axisToggle;
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
