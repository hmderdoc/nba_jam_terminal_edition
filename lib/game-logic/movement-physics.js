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

if (typeof PLAYER_BOUNDARIES === "undefined") {
    var PLAYER_BOUNDARIES = {
        minX: 2,
        maxXOffset: 1,
        minY: 2,
        maxYOffset: 5,
        movementMaxXOffset: 7,
        feetMinX: 2,
        feetMaxXOffset: 2,
        fallbackWidthClamp: 7
    };
}
if (typeof PLAYER_COLLISION_THRESHOLD === "undefined") {
    var PLAYER_COLLISION_THRESHOLD = { dx: 2, dy: 2 };
}
if (typeof PLAYER_SPRITE_DEFAULTS === "undefined") {
    var PLAYER_SPRITE_DEFAULTS = { width: 5 };
}
if (typeof PLAYER_INPUT_BUFFER_MAX_FLUSH === "undefined") {
    var PLAYER_INPUT_BUFFER_MAX_FLUSH = 50;
}

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
            if (dx < PLAYER_COLLISION_THRESHOLD.dx && dy < PLAYER_COLLISION_THRESHOLD.dy) {
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
    if (!sprite || sprite.__mpHintLock) {
        return;
    }
    // Keep sprites within court boundaries - just clamp the values
    // Don't use moveTo as it can cause flickering
    var minX = PLAYER_BOUNDARIES.minX;
    var maxX = COURT_WIDTH - PLAYER_BOUNDARIES.maxXOffset;
    var minY = PLAYER_BOUNDARIES.minY;
    var maxY = COURT_HEIGHT - PLAYER_BOUNDARIES.maxYOffset;

    if (sprite.x < minX) sprite.x = minX;
    if (sprite.x > maxX) sprite.x = maxX;
    if (sprite.y < minY) sprite.y = minY;
    if (sprite.y > maxY) sprite.y = maxY;
    clampSpriteFeetToCourt(sprite);
}

/**
 * Clamp sprite's feet (leg columns) to stay within court boundaries
 * Ensures sprite's leg columns (center-ish pixels) don't go out of bounds
 * 
 * @param {Object} sprite - The sprite to clamp
 */
function clampSpriteFeetToCourt(sprite) {
    if (!sprite || sprite.__mpHintLock || !sprite.moveTo) return;
    var width = (sprite.frame && sprite.frame.width) ? sprite.frame.width : PLAYER_SPRITE_DEFAULTS.width;
    if (width < 3) return;

    var legCenter = Math.floor(width / 2);
    var legLeftOffset = Math.max(1, legCenter - 1);
    var legRightOffset = Math.min(width - 2, legCenter + 1);

    var legLeft = sprite.x + legLeftOffset;
    var legRight = sprite.x + legRightOffset;
    var shift = 0;

    var legMin = PLAYER_BOUNDARIES.feetMinX;
    var legMax = COURT_WIDTH - PLAYER_BOUNDARIES.feetMaxXOffset;

    if (legLeft < legMin) {
        shift = legMin - legLeft;
    } else if (legRight > legMax) {
        shift = legRight - legMax;
        shift = -shift;
    }

    if (shift !== 0) {
        var minX = PLAYER_BOUNDARIES.minX;
        var maxX = Math.min(COURT_WIDTH - width, COURT_WIDTH - PLAYER_BOUNDARIES.fallbackWidthClamp);
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

    var preview = previewMovementCommand(sprite, key);
    if (!preview || !preview.canMove) {
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
 * Preview a movement command without mutating sprite state.
 * Returns attempted/next positions and whether the move is allowed.
 *
 * @param {Object} sprite - Sprite to preview movement for
 * @param {string} key - Movement key (KEY_LEFT/RIGHT/UP/DOWN)
 * @returns {Object|null} Preview result { canMove, nextX, nextY, attemptedX, attemptedY, dx, dy, blockedByBounds }
 */
function previewMovementCommand(sprite, key) {
    if (!sprite || key === undefined || key === null) {
        return null;
    }

    var dx = 0;
    var dy = 0;

    switch (key) {
        case KEY_LEFT:
            dx = -1;
            break;
        case KEY_RIGHT:
            dx = 1;
            break;
        case KEY_UP:
            dy = -1;
            break;
        case KEY_DOWN:
            dy = 1;
            break;
        default:
            break;
    }

    var attemptedX = sprite.x + dx;
    var attemptedY = sprite.y + dy;
    var minX = PLAYER_BOUNDARIES.minX;
    var maxX = COURT_WIDTH - PLAYER_BOUNDARIES.movementMaxXOffset;
    var minY = PLAYER_BOUNDARIES.minY;
    var maxY = COURT_HEIGHT - PLAYER_BOUNDARIES.maxYOffset;

    var withinBounds = (attemptedX >= minX && attemptedX <= maxX &&
        attemptedY >= minY && attemptedY <= maxY);
    var hasDelta = (dx !== 0 || dy !== 0);

    var recovering = false;
    var nextX = sprite.x;
    var nextY = sprite.y;

    if (withinBounds) {
        nextX = attemptedX;
        nextY = attemptedY;
    } else if (hasDelta) {
        if (dx !== 0) {
            var beyondRight = sprite.x > maxX;
            var beyondLeft = sprite.x < minX;
            var movingTowardCourtX = (dx < 0 && beyondRight) || (dx > 0 && beyondLeft);
            if (movingTowardCourtX) {
                nextX = clamp(attemptedX, minX, maxX);
                recovering = true;
            }
        }

        if (dy !== 0) {
            var beyondBottom = sprite.y > maxY;
            var beyondTop = sprite.y < minY;
            var movingTowardCourtY = (dy < 0 && beyondBottom) || (dy > 0 && beyondTop);
            if (movingTowardCourtY) {
                nextY = clamp(attemptedY, minY, maxY);
                recovering = true;
            }
        }
    }

    var canMove = hasDelta && (withinBounds || recovering);
    var blockedByBounds = hasDelta && !withinBounds && !recovering;

    return {
        canMove: canMove,
        nextX: nextX,
        nextY: nextY,
        attemptedX: attemptedX,
        attemptedY: attemptedY,
        dx: dx,
        dy: dy,
        blockedByBounds: blockedByBounds
    };
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
function computeMovementBudget(sprite, turboIntent, systems) {
    var playerData = (sprite && sprite.playerData) ? sprite.playerData : null;
    var attr = playerData ? getEffectiveAttribute(playerData, ATTR_SPEED) : 5;
    var attrScale = (attr - 5) * PLAYER_ATTR_SPEED_SCALE_FACTOR; // +/-10% across range 0-10

    var turboActive = (turboIntent !== undefined) ? !!turboIntent : (playerData ? !!playerData.turboActive : false);
    var speedPerFrame = PLAYER_BASE_SPEED_PER_FRAME;

    if (turboActive && playerData && playerData.turbo > 0) {
        speedPerFrame = PLAYER_TURBO_SPEED_PER_FRAME;
        var stateManager = systems.stateManager;
        var ballCarrier = stateManager.get('ballCarrier');
        if (ballCarrier && sprite === ballCarrier) {
            speedPerFrame *= PLAYER_TURBO_BALL_HANDLER_FACTOR;
        }
    }

    speedPerFrame *= (1 + attrScale);
    if (speedPerFrame < PLAYER_MIN_SPEED_PER_FRAME) speedPerFrame = PLAYER_MIN_SPEED_PER_FRAME;
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
 * @param {Object} systems - Systems object for state access
 * @returns {Object} { moves, horizontal, vertical, diagonalMoves, turbo }
 */
function createMovementCounters(sprite, turboIntent, systems) {
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

    var budget = computeMovementBudget(sprite, turboIntent, systems);
    playerData.moveAccumulator += budget.speedPerFrame;

    var steps = Math.floor(playerData.moveAccumulator);
    playerData.moveAccumulator -= steps;
    if (playerData.moveAccumulator < 0) playerData.moveAccumulator = 0;
    if (steps > PLAYER_MAX_STEPS_PER_FRAME) steps = PLAYER_MAX_STEPS_PER_FRAME;
    if (steps < 0) steps = 0;

    // For diagonal movement normalization:
    // Diagonal movement is √2 ≈ 1.414x the distance of cardinal movement
    // To normalize, we limit diagonal moves to steps / √2 ≈ steps * 0.707
    var diagonalMoves = Math.floor(steps * PLAYER_DIAGONAL_NORMALIZATION_FACTOR);
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
    var maxFlush = PLAYER_INPUT_BUFFER_MAX_FLUSH;
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
    return clamp(x, PLAYER_BOUNDARIES.minX, COURT_WIDTH - PLAYER_BOUNDARIES.movementMaxXOffset);
}

/**
 * Clamp Y coordinate to valid court Y range
 * @param {number} y - Y coordinate to clamp
 * @returns {number} Clamped Y coordinate
 */
function clampToCourtY(y) {
    return clamp(y, PLAYER_BOUNDARIES.minY, COURT_HEIGHT - PLAYER_BOUNDARIES.maxYOffset);
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
