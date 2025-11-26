// jump-indicators.js - Visual jump trajectory indicators
// Displays arrow markers showing where jumping players will land

/**
 * Restore a single indicator entry to its original court appearance
 * Removes the indicator visual and restores the underlying court character
 * 
 * @param {Object} entry - Indicator entry with x, y, origCh, origAttr
 */
function restoreIndicatorEntry(entry) {
    if (!entry || !trailFrame || !trailFrame.is_open) return;
    var rx = entry.x;
    var ry = entry.y;
    if (rx < 1 || rx > COURT_WIDTH || ry < 1 || ry > COURT_HEIGHT) return;
    trailFrame.gotoxy(rx, ry);
    trailFrame.putmsg(" ", 0);
}

/**
 * Redraw a single indicator entry on the court
 * 
 * @param {Object} entry - Indicator entry with x, y, char, color
 */
function redrawIndicatorEntry(entry) {
    if (!entry || !trailFrame || !trailFrame.is_open) return;
    var rx = entry.x;
    var ry = entry.y;
    if (rx < 1 || rx > COURT_WIDTH || ry < 1 || ry > COURT_HEIGHT) return;
    trailFrame.gotoxy(rx, ry);
    trailFrame.putmsg(entry.char, entry.color);
}

/**
 * Add or update an indicator entry in the list
 * Saves the original court character before drawing indicator
 * 
 * @param {Array} list - List of indicator entries
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} ch - Character to display
 * @param {number} color - Color attribute
 * @returns {Object} The indicator entry
 */
function addIndicatorEntry(list, x, y, ch, color) {
    if (!trailFrame || !trailFrame.is_open) return null;
    for (var i = 0; i < list.length; i++) {
        if (list[i].x === x && list[i].y === y && list[i].char === ch) {
            list[i].color = color;
            redrawIndicatorEntry(list[i]);
            return list[i];
        }
    }

    var entry = {
        x: x,
        y: y,
        char: ch,
        color: color
    };
    list.push(entry);
    redrawIndicatorEntry(entry);
    return entry;
}

/**
 * Draw a pattern of indicators at a specific row
 * 
 * @param {Array} list - List of indicator entries
 * @param {number} baseX - Starting X coordinate
 * @param {number} y - Y coordinate
 * @param {string} pattern - Pattern string (e.g., "^" or "v")
 * @param {number} color - Color attribute
 */
function drawIndicatorPattern(list, baseX, y, pattern, color) {
    if (!trailFrame || !trailFrame.is_open) return;
    if (y < 1 || y > COURT_HEIGHT) return;
    if (pattern === undefined || pattern === null || pattern === "") {
        pattern = "^";
    }
    var startX = baseX;
    for (var i = 0; i < pattern.length; i++) {
        var ch = pattern.charAt(i);
        if (ch === " ") continue;
        var drawX = startX + i;
        if (drawX < 1 || drawX > COURT_WIDTH) continue;
        addIndicatorEntry(list, drawX, y, ch, color);
    }
}

/**
 * Redraw all indicators in a list
 * 
 * @param {Array} list - List of indicator entries
 */
function redrawIndicatorList(list) {
    for (var i = 0; i < list.length; i++) {
        redrawIndicatorEntry(list[i]);
    }
}

/**
 * Restore all indicators in a list and clear the list
 * 
 * @param {Array} list - List of indicator entries
 */
function restoreIndicatorList(list) {
    for (var i = 0; i < list.length; i++) {
        restoreIndicatorEntry(list[i]);
    }
    list.length = 0;
}

/**
 * Compute the X column for indicator placement based on direction
 * 
 * @param {number} direction - Horizontal direction (-1 left, 1 right)
 * @param {number} leftX - Left edge of sprite
 * @param {number} rightX - Right edge of sprite
 * @param {string} phase - "ascend" or "descend"
 * @returns {number} X coordinate for indicator column
 */
function computeIndicatorColumn(direction, leftX, rightX, phase) {
    if (!direction) direction = -1; // default lean left
    if (phase === "ascend") {
        return direction > 0 ? clamp(leftX - 1, 1, COURT_WIDTH) : clamp(rightX + 1, 1, COURT_WIDTH);
    }
    return direction > 0 ? clamp(rightX + 1, 1, COURT_WIDTH) : clamp(leftX - 1, 1, COURT_WIDTH);
}

/**
 * Ensure sprite has jump indicator data structure initialized
 * 
 * @param {Object} sprite - The sprite object
 * @returns {Object} The jump indicator data
 */
function ensureJumpIndicatorData(sprite) {
    if (!sprite.jumpIndicatorData) {
        sprite.jumpIndicatorData = {
            ascend: [],
            descent: [],
            apexGenerated: false,
            direction: 0
        };
    }
    return sprite.jumpIndicatorData;
}

/**
 * Prepare descent (landing) indicators at jump apex
 * Shows where the sprite will land with downward arrows
 * 
 * @param {Object} sprite - The jumping sprite
 * @param {Object} data - Jump indicator data
 * @param {Object} options - Configuration options
 */
function prepareDescentIndicators(sprite, data, options) {
    if (data.apexGenerated) return;
    data.apexGenerated = true;
    restoreIndicatorList(data.descent);

    var direction = data.direction || options.horizontalDir || 0;
    var spriteWidth = options.spriteWidth;
    var spriteHeight = options.spriteHeight;
    var spriteHalfWidth = (options.spriteHalfWidth !== undefined) ? options.spriteHalfWidth : Math.floor(spriteWidth / 2);
    var spriteHalfHeight = (options.spriteHalfHeight !== undefined) ? options.spriteHalfHeight : Math.floor(spriteHeight / 2);
    var frames = options.flightFrames;
    var frameIndex = options.frameIndex;
    var added = 0;
    var limit = 8;
    var pattern = options.patternDescend || "v";

    if (frames && typeof frameIndex === "number") {
        var baseAttr = DARKGRAY | WAS_BROWN;
        for (var i = frameIndex + 1; i < frames.length && added < limit; i++) {
            var frame = frames[i];
            var leftX = clamp(Math.round(frame.centerX) - spriteHalfWidth, 1, COURT_WIDTH);
            var rightX = clamp(leftX + spriteWidth - 1, 1, COURT_WIDTH);
            var computedBase = computeIndicatorColumn(direction, leftX, rightX, "descend");
            var baseColumn = (options.baseColumn !== undefined) ? options.baseColumn : computedBase;
            var projectedBottom = Math.round(frame.centerY) + spriteHalfHeight;
            var markerY = projectedBottom + 1;
            if (markerY > options.groundBottom) markerY = options.groundBottom;
            markerY = clamp(markerY, 1, COURT_HEIGHT);
            if (markerY < 1 || markerY > COURT_HEIGHT) continue;
            var trailAttr = getOnFireTrailAttr(sprite, i, baseAttr);
            drawIndicatorPattern(data.descent, baseColumn, markerY, pattern, trailAttr);
            added++;
        }
    }

    if (!added) {
        var currentBottom = options.currentBottom;
        var left = sprite.x;
        var right = sprite.x + spriteWidth - 1;
        var computedBase = computeIndicatorColumn(direction, left, right, "descend");
        var baseColumn = (options.baseColumn !== undefined) ? options.baseColumn : computedBase;
        var steps = Math.min(limit, Math.max(0, options.groundBottom - currentBottom));
        for (var step = 1; step <= steps; step++) {
            var markerY = currentBottom + step;
            if (markerY > options.groundBottom) markerY = options.groundBottom;
            markerY = clamp(markerY, 1, COURT_HEIGHT);
            if (markerY < 1 || markerY > COURT_HEIGHT) break;
            var descendAttr = getOnFireTrailAttr(sprite, step, DARKGRAY | WAS_BROWN);
            drawIndicatorPattern(data.descent, baseColumn, markerY, pattern, descendAttr);
            if (markerY >= options.groundBottom) break;
        }
    }
}

/**
 * Remove descent indicators that the sprite has already passed
 * 
 * @param {Object} data - Jump indicator data
 * @param {number} currentBottom - Current bottom Y position of sprite
 */
function pruneDescentIndicators(data, currentBottom) {
    for (var i = data.descent.length - 1; i >= 0; i--) {
        var entry = data.descent[i];
        if (entry.y <= currentBottom) {
            restoreIndicatorEntry(entry);
            data.descent.splice(i, 1);
        }
    }
}

/**
 * Update jump indicators for a sprite during jump animation
 * Shows upward arrows during ascent, downward arrows during descent
 * 
 * @param {Object} sprite - The jumping sprite
 * @param {Object} options - Configuration options including:
 *   - ascending: boolean - true if jumping up, false if falling
 *   - currentBottom: number - current bottom Y of sprite
 *   - groundBottom: number - ground level Y
 *   - horizontalDir: number - horizontal direction
 *   - spriteWidth/Height: number - sprite dimensions
 *   - patternAscend/Descend: string - indicator patterns
 *   - flightFrames: array - trajectory frames
 *   - frameIndex: number - current frame index
 */
function updateJumpIndicator(sprite, options) {
    if (!sprite || !trailFrame || !trailFrame.is_open) return;
    var data = ensureJumpIndicatorData(sprite);

    if (typeof options.horizontalDir === "number" && options.horizontalDir !== 0) {
        data.direction = options.horizontalDir;
    }

    var spriteWidth = options.spriteWidth;
    if (!spriteWidth) {
        spriteWidth = (sprite.frame && sprite.frame.width) ? sprite.frame.width : 4;
    }
    var spriteHeight = options.spriteHeight;
    if (!spriteHeight) {
        spriteHeight = (sprite.frame && sprite.frame.height) ? sprite.frame.height : 4;
    }
    var spriteHalfWidth = (options.spriteHalfWidth !== undefined) ? options.spriteHalfWidth : Math.floor(spriteWidth / 2);
    var spriteHalfHeight = (options.spriteHalfHeight !== undefined) ? options.spriteHalfHeight : Math.floor(spriteHeight / 2);
    var left = sprite.x;
    var right = sprite.x + spriteWidth - 1;
    var patternAsc = options.patternAscend || "^";
    var patternDesc = options.patternDescend || "v";

    if (options.ascending) {
        data.apexGenerated = false;
        if (options.currentBottom < options.groundBottom) {
            var computedBase = computeIndicatorColumn(data.direction, left, right, "ascend");
            var baseColumn = (options.baseColumn !== undefined) ? options.baseColumn : computedBase;
            var markerY = options.currentBottom + 1;
            if (markerY > options.groundBottom) markerY = options.groundBottom;
            markerY = clamp(markerY, 1, COURT_HEIGHT);
            if (markerY >= 1 && markerY <= COURT_HEIGHT) {
                var ascendAttr = getOnFireTrailAttr(sprite, options.frameIndex || 0, DARKGRAY | WAS_BROWN);
                drawIndicatorPattern(data.ascend, baseColumn, markerY, patternAsc, ascendAttr);
            }
        }
    } else {
        options.spriteWidth = spriteWidth;
        options.spriteHeight = spriteHeight;
        options.spriteHalfWidth = spriteHalfWidth;
        options.spriteHalfHeight = spriteHalfHeight;
        options.patternDescend = patternDesc;
        prepareDescentIndicators(sprite, data, options);
        pruneDescentIndicators(data, options.currentBottom);
    }

    redrawIndicatorList(data.ascend);
    redrawIndicatorList(data.descent);
}

/**
 * Clear all jump indicators for a sprite
 * Restores court to original appearance
 * 
 * @param {Object} sprite - The sprite to clear indicators for
 */
function clearJumpIndicator(sprite) {
    if (!sprite || !sprite.jumpIndicatorData) return;
    if (!courtFrame) {
        sprite.jumpIndicatorData = null;
        return;
    }
    restoreIndicatorList(sprite.jumpIndicatorData.ascend);
    restoreIndicatorList(sprite.jumpIndicatorData.descent);
    sprite.jumpIndicatorData = null;
}
