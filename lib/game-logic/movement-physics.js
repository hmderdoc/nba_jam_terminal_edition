/**
 * Movement and Physics Module
 * 
 * Handles player movement, collision detection, and boundary enforcement:
 * - Sprite collision detection (opponents only, teammates pass through)
 * - Court boundary clamping
 * - Movement command application with budget system
 * - Movement accumulator for variable speed
 * - Turbo speed calculations with attribute scaling
 * - Keyboard buffer flushing for possession changes
 */

load("sbbsdefs.js");

/**
 * Check for sprite collisions and revert to previous positions
 * 
 * Rules:
 * - Only OPPONENTS collide (teammates pass through each other)
 * - Small core hitbox: dx < 2 && dy < 2
 * - Revert moving player(s) to previous position
 */
function checkSpriteCollision() {
    // Check for overlapping sprites and revert to previous positions
    // Only check collisions between OPPONENTS (teammates can pass through each other)
    var players = getAllPlayers();

    for (var i = 0; i < players.length; i++) {
        for (var j = i + 1; j < players.length; j++) {
            var p1 = players[i];
            var p2 = players[j];

            // Get team names
            var team1 = getPlayerTeamName(p1);
            var team2 = getPlayerTeamName(p2);

            // ONLY check collision if opponents (different teams)
            if (team1 === team2) continue; // Teammates pass through each other

            // Calculate distance between players
            var dx = Math.abs(p1.x - p2.x);
            var dy = Math.abs(p1.y - p2.y);

            // Collision threshold - REDUCED for smaller hitbox
            // Sprites are 5 wide, 4 tall - only collide if very close
            // Old: dx < 4 && dy < 3 (almost full sprite)
            // New: dx < 2 && dy < 2 (small core hitbox)
            if (dx < 2 && dy < 2) {
                // Determine which player moved (or both)
                var p1Moved = (p1.prevX !== undefined && p1.prevY !== undefined &&
                    (p1.x !== p1.prevX || p1.y !== p1.prevY));
                var p2Moved = (p2.prevX !== undefined && p2.prevY !== undefined &&
                    (p2.x !== p2.prevX || p2.y !== p2.prevY));

                // Only revert if actually moved this frame
                if (p1Moved && !p2Moved) {
                    // Only p1 moved, revert p1
                    p1.x = p1.prevX;
                    p1.y = p1.prevY;
                } else if (p2Moved && !p1Moved) {
                    // Only p2 moved, revert p2
                    p2.x = p2.prevX;
                    p2.y = p2.prevY;
                } else if (p1Moved && p2Moved) {
                    // Both moved, revert both (push each other back)
                    p1.x = p1.prevX;
                    p1.y = p1.prevY;
                    p2.x = p2.prevX;
                    p2.y = p2.prevY;
                }
            }
        }
    }
}

/**
 * Keep sprite within court boundaries
 * Clamps X/Y to valid court range and ensures feet stay in bounds
 * 
 * @param {Object} sprite - The sprite to check boundaries for
 */
function checkBoundaries(sprite) {
    // Keep sprites within court boundaries - just clamp the values
    // Don't use moveTo as it can cause flickering
    if (sprite.x < 2) sprite.x = 2;
    if (sprite.x > COURT_WIDTH - 7) sprite.x = COURT_WIDTH - 7;
    if (sprite.y < 2) sprite.y = 2;
    if (sprite.y > COURT_HEIGHT - 5) sprite.y = COURT_HEIGHT - 5;
    clampSpriteFeetToCourt(sprite);
}

/**
 * Clamp sprite's feet (leg columns) to stay within court boundaries
 * Ensures sprite's leg columns (center-ish pixels) don't go out of bounds
 * 
 * @param {Object} sprite - The sprite to clamp
 */
function clampSpriteFeetToCourt(sprite) {
    if (!sprite || !sprite.moveTo) return;
    var width = (sprite.frame && sprite.frame.width) ? sprite.frame.width : 5;
    if (width < 3) return;

    var legCenter = Math.floor(width / 2);
    var legLeftOffset = Math.max(1, legCenter - 1);
    var legRightOffset = Math.min(width - 2, legCenter + 1);

    var legLeft = sprite.x + legLeftOffset;
    var legRight = sprite.x + legRightOffset;
    var shift = 0;

    var legMin = 2;
    var legMax = COURT_WIDTH - 2;

    if (legLeft < legMin) {
        shift = legMin - legLeft;
    } else if (legRight > legMax) {
        shift = legRight - legMax;
        shift = -shift;
    }

    if (shift !== 0) {
        var minX = 2;
        var maxX = Math.min(COURT_WIDTH - width, COURT_WIDTH - 7);
        var newX = clamp(sprite.x + shift, minX, maxX);
        sprite.moveTo(newX, sprite.y);
    }
}

/**
 * Apply a movement command to a sprite using movement counters
 * 
 * @param {Object} sprite - The sprite to move
 * @param {string} key - The key command (KEY_LEFT, KEY_RIGHT, KEY_UP, KEY_DOWN)
 * @param {Object} counters - Movement budget counters { horizontal, vertical }
 * @returns {boolean} True if movement was applied, false if blocked
 */
function applyMovementCommand(sprite, key, counters) {
    if (!sprite || typeof sprite.getcmd !== "function") return false;
    var horizontal = (key === KEY_LEFT || key === KEY_RIGHT);
    var vertical = (key === KEY_UP || key === KEY_DOWN);

    if (counters) {
        if (horizontal && counters.horizontal <= 0) return false;
        if (vertical && counters.vertical <= 0) return false;
    }

    var nextX = sprite.x;
    var nextY = sprite.y;
    switch (key) {
        case KEY_LEFT:
            nextX = sprite.x - 1;
            break;
        case KEY_RIGHT:
            nextX = sprite.x + 1;
            break;
        case KEY_UP:
            nextY = sprite.y - 1;
            break;
        case KEY_DOWN:
            nextY = sprite.y + 1;
            break;
        default:
            break;
    }

    if (nextX < 2 || nextX > COURT_WIDTH - 7 || nextY < 2 || nextY > COURT_HEIGHT - 5) {
        return false;
    }

    if (!counters) {
        sprite.getcmd(key);
        return true;
    }

    if (horizontal) counters.horizontal--;
    if (vertical) counters.vertical--;
    sprite.getcmd(key);
    return true;
}

/**
 * Apply diagonal movement with normalized speed
 * Prevents diagonal movement from being √2 times faster than cardinal movement
 * 
 * @param {Object} sprite - The sprite to move
 * @param {string} horizontalKey - Horizontal key (KEY_LEFT or KEY_RIGHT)
 * @param {string} verticalKey - Vertical key (KEY_UP or KEY_DOWN)
 * @param {Object} counters - Movement budget counters { horizontal, vertical, diagonalMoves }
 * @returns {boolean} True if movement was applied
 */
function applyDiagonalMovement(sprite, horizontalKey, verticalKey, counters) {
    if (!sprite || !counters) return false;

    // Check if we have budget for diagonal movement
    if (counters.horizontal <= 0 || counters.vertical <= 0) return false;
    if (counters.diagonalMoves !== undefined && counters.diagonalMoves <= 0) return false;

    // Apply both movements
    var hMoved = applyMovementCommand(sprite, horizontalKey, counters);
    var vMoved = applyMovementCommand(sprite, verticalKey, counters);

    // Track diagonal moves for proper normalization
    if (hMoved && vMoved && counters.diagonalMoves !== undefined) {
        counters.diagonalMoves--;
    }

    return (hMoved || vMoved);
}

/**
 * Compute movement speed budget for a sprite this frame
 * 
 * Speed calculation:
 * - Base speed: PLAYER_BASE_SPEED_PER_FRAME
 * - Turbo speed: PLAYER_TURBO_SPEED_PER_FRAME (reduced for ball handler)
 * - Speed attribute scaling: +/-10% across 0-10 range
 * - Clamped between 0.2 and PLAYER_MAX_SPEED_PER_FRAME
 * 
 * @param {Object} sprite - The sprite to compute speed for
 * @param {boolean} turboIntent - Whether turbo is intended this frame
 * @returns {Object} { speedPerFrame: number, turbo: boolean }
 */
function computeMovementBudget(sprite, turboIntent) {
    var playerData = (sprite && sprite.playerData) ? sprite.playerData : null;
    var attr = playerData ? getEffectiveAttribute(playerData, ATTR_SPEED) : 5;
    var attrScale = (attr - 5) * 0.02; // +/-10% across range 0-10

    var turboActive = (turboIntent !== undefined) ? !!turboIntent : (playerData ? !!playerData.turboActive : false);
    var speedPerFrame = PLAYER_BASE_SPEED_PER_FRAME;

    if (turboActive && playerData && playerData.turbo > 0) {
        speedPerFrame = PLAYER_TURBO_SPEED_PER_FRAME;
        if (typeof gameState !== "undefined" && sprite === gameState.ballCarrier) {
            speedPerFrame *= PLAYER_TURBO_BALL_HANDLER_FACTOR;
        }
    }

    speedPerFrame *= (1 + attrScale);
    if (speedPerFrame < 0.2) speedPerFrame = 0.2;
    if (speedPerFrame > PLAYER_MAX_SPEED_PER_FRAME) speedPerFrame = PLAYER_MAX_SPEED_PER_FRAME;

    return {
        speedPerFrame: speedPerFrame,
        turbo: turboActive
    };
}

/**
 * Create movement counters for a sprite using movement accumulator
 * 
 * Accumulator system:
 * - Each frame, add speedPerFrame to moveAccumulator
 * - Floor accumulator to get integer steps this frame
 * - Subtract steps from accumulator, leaving fractional part
 * - Capped at 4 steps per frame maximum
 * - Diagonal moves normalized to prevent √2 speed advantage
 * 
 * @param {Object} sprite - The sprite to create counters for
 * @param {boolean} turboIntent - Whether turbo is intended this frame
 * @returns {Object} { moves, horizontal, vertical, diagonalMoves, turbo }
 */
function createMovementCounters(sprite, turboIntent) {
    var playerData = (sprite && sprite.playerData) ? sprite.playerData : null;
    if (!playerData) {
        return {
            moves: 1,
            horizontal: 1,
            vertical: 1,
            diagonalMoves: 1,
            turbo: false
        };
    }

    if (playerData.moveAccumulator === undefined) {
        playerData.moveAccumulator = 0;
    }

    var budget = computeMovementBudget(sprite, turboIntent);
    playerData.moveAccumulator += budget.speedPerFrame;

    var steps = Math.floor(playerData.moveAccumulator);
    playerData.moveAccumulator -= steps;
    if (playerData.moveAccumulator < 0) playerData.moveAccumulator = 0;
    if (steps > 4) steps = 4;
    if (steps < 0) steps = 0;

    // For diagonal movement normalization:
    // Diagonal movement is √2 ≈ 1.414x the distance of cardinal movement
    // To normalize, we limit diagonal moves to steps / √2 ≈ steps * 0.707
    var diagonalMoves = Math.floor(steps * 0.707);
    if (diagonalMoves < 0) diagonalMoves = 0;

    return {
        moves: steps,
        horizontal: steps,
        vertical: steps,
        diagonalMoves: diagonalMoves,
        turbo: budget.turbo
    };
}

/**
 * Flush keyboard buffer to prevent buffered keystrokes from carrying over
 * 
 * Called when possession changes to prevent players from running wrong direction
 * due to buffered keys from previous possession
 */
function flushKeyboardBuffer() {
    if (typeof console === 'undefined' || typeof console.inkey !== 'function') return;

    // Drain all pending keys from buffer (max 50 to prevent infinite loop)
    var maxFlush = 50;
    var flushed = 0;
    while (flushed < maxFlush) {
        var key = console.inkey(K_NONE, 0); // Non-blocking, no wait
        if (!key || key === '') break;
        flushed++;
    }
}

/**
 * Clamp X coordinate to valid court X range
 * @param {number} x - X coordinate to clamp
 * @returns {number} Clamped X coordinate
 */
function clampToCourtX(x) {
    return clamp(x, 2, COURT_WIDTH - 7);
}

/**
 * Clamp Y coordinate to valid court Y range
 * @param {number} y - Y coordinate to clamp
 * @returns {number} Clamped Y coordinate
 */
function clampToCourtY(y) {
    return clamp(y, 2, COURT_HEIGHT - 5);
}

/**
 * Calculate distance between two points
 * @param {number} x1 - First point X
 * @param {number} y1 - First point Y
 * @param {number} x2 - Second point X
 * @param {number} y2 - Second point Y
 * @returns {number} Euclidean distance
 */
function distanceBetweenPoints(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
}
