/**
 * NBA JAM - Uniform Rendering System
 * 
 * Applies jersey numbers, colors, and customizations to player sprites
 */

/**
 * Apply uniform mask (jersey number, colors, shoes) to a sprite
 * 
 * Modifies sprite frames to display:
 * - Jersey number on chest
 * - Team colors (jersey background)
 * - Accent colors for numbers
 * - Shoe/shorts colors
 * - Custom eye and eyebrow colors
 * 
 * @param {Object} sprite - The sprite to modify
 * @param {Object} options - Uniform customization options
 * @param {number} options.jerseyBg - Jersey background color (e.g., BG_RED)
 * @param {number} options.accentFg - Accent foreground for numbers (default: WHITE)
 * @param {string|number} options.jerseyNumber - Jersey number to display
 * @param {number} options.shoeColor - Initial shoe color
 * @param {number} options.eyeColor - Custom eye color
 * @param {string} options.eyebrowChar - Character for eyebrow
 * @param {number} options.eyebrowColor - Eyebrow color
 */
function applyUniformMask(sprite, options) {
    if (!sprite || !sprite.frame || !sprite.ini || !sprite.ini.width || !sprite.ini.height) {
        return;
    }

    var jerseyBg = options.jerseyBg || BG_RED;
    var accentFg = (options.accentFg !== undefined && options.accentFg !== null) ? options.accentFg : WHITE;
    var jerseyNumber = "";
    if (options.jerseyNumber !== undefined && options.jerseyNumber !== null) {
        jerseyNumber = String(options.jerseyNumber);
    }
    var digits = jerseyNumber.replace(/[^0-9]/g, "");
    var leftDigit;
    var rightDigit;

    if (digits.length >= 2) {
        leftDigit = digits.charAt(0);
        rightDigit = digits.charAt(1);
    } else if (digits.length === 1) {
        leftDigit = "#";
        rightDigit = digits.charAt(0);
    } else {
        leftDigit = "#";
        rightDigit = "#";
    }

    var topNeckChar = ascii(223); // ▀
    var shortsChar = ascii(220);  // ▄
    var digitsAttr = accentFg | jerseyBg;
    var width = parseInt(sprite.ini.width);
    var height = parseInt(sprite.ini.height);
    var bearingCount = (sprite.ini.bearings && sprite.ini.bearings.length) ? sprite.ini.bearings.length : 1;
    var positionCount = (sprite.ini.positions && sprite.ini.positions.length) ? sprite.ini.positions.length : 1;
    var eyeFg = (options.eyeColor !== undefined && options.eyeColor !== null) ? (options.eyeColor & FG_MASK) : null;
    var eyebrowChar = (options.eyebrowChar !== undefined && options.eyebrowChar !== null) ? String(options.eyebrowChar).charAt(0) : null;
    if (eyebrowChar !== null && eyebrowChar.length === 0) eyebrowChar = null;
    var eyebrowFg = (options.eyebrowColor !== undefined && options.eyebrowColor !== null) ? (options.eyebrowColor & FG_MASK) : null;

    function getAttrValue(cell, fallback) {
        if (cell && typeof cell.attr === "number") {
            return cell.attr;
        }
        return fallback;
    }

    sprite.__shoeCells = [];
    sprite.__shoeBg = jerseyBg;
    sprite.__shoeChar = shortsChar;

    for (var bearingIndex = 0; bearingIndex < bearingCount; bearingIndex++) {
        var yOffset = height * bearingIndex;
        for (var positionIndex = 0; positionIndex < positionCount; positionIndex++) {
            var xOffset = width * positionIndex;
            var rowEyes = {};

            // Row 3, col 2 (1-based)
            sprite.frame.setData(xOffset + 1, yOffset + 2, leftDigit, digitsAttr);

            // Row 3, col 3 neckline
            var neckData = sprite.frame.getData(xOffset + 2, yOffset + 2, false);
            var neckAttrRaw = getAttrValue(neckData, digitsAttr);
            var skinFg = neckAttrRaw & FG_MASK;
            var neckAttr = composeAttrWithColor(neckAttrRaw, skinFg, jerseyBg);
            sprite.frame.setData(xOffset + 2, yOffset + 2, topNeckChar, neckAttr);

            // Row 3, col 4 (second digit)
            sprite.frame.setData(xOffset + 3, yOffset + 2, rightDigit, digitsAttr);

            // Row 4, col 2 (left leg/shorts)
            var leftLegData = sprite.frame.getData(xOffset + 1, yOffset + 3, false);
            var leftLegAttrRaw = getAttrValue(leftLegData, jerseyBg);
            var initialShoeColor = (options && typeof options.shoeColor === "number") ? options.shoeColor : (leftLegAttrRaw & FG_MASK);
            var leftLegAttr = composeAttrWithColor(leftLegAttrRaw, initialShoeColor, jerseyBg);
            sprite.frame.setData(xOffset + 1, yOffset + 3, shortsChar, leftLegAttr);
            sprite.__shoeCells.push({ x: xOffset + 1, y: yOffset + 3 });

            // Row 4, col 4 (right leg/shorts)
            var rightLegData = sprite.frame.getData(xOffset + 3, yOffset + 3, false);
            var rightLegAttrRaw = getAttrValue(rightLegData, jerseyBg);
            var rightLegAttr = composeAttrWithColor(rightLegAttrRaw, initialShoeColor, jerseyBg);
            sprite.frame.setData(xOffset + 3, yOffset + 3, shortsChar, rightLegAttr);
            sprite.__shoeCells.push({ x: xOffset + 3, y: yOffset + 3 });

            // Scan cells for eye/eyebrow overrides
            function recordRowEye(rowIndex, globalX, attrValue) {
                var entry = rowEyes[rowIndex];
                if (!entry) {
                    entry = { min: globalX, max: globalX, count: 1 };
                    rowEyes[rowIndex] = entry;
                } else {
                    if (globalX < entry.min) entry.min = globalX;
                    if (globalX > entry.max) entry.max = globalX;
                    entry.count++;
                }
                if (typeof attrValue === "number") {
                    var bgMask = attrValue & BG_MASK;
                    if (bgMask !== 0 || entry.bg === undefined) {
                        entry.bg = bgMask;
                    }
                }
            }

            for (var localY = 0; localY < height; localY++) {
                for (var localX = 0; localX < width; localX++) {
                    var globalX = xOffset + localX;
                    var globalY = yOffset + localY;
                    var cell = sprite.frame.getData(globalX, globalY, false) || {};
                    var ch = cell.ch;
                    if (ch === 'O' || ch === 'o') {
                        var baseAttr = getAttrValue(cell, WHITE | WAS_BROWN);
                        var appliedAttr = baseAttr;
                        if (eyeFg !== null) {
                            appliedAttr = composeAttrWithColor(baseAttr, eyeFg, baseAttr & BG_MASK);
                            sprite.frame.setData(globalX, globalY, ch, appliedAttr);
                        }
                        var finalCell = sprite.frame.getData(globalX, globalY, false) || {};
                        var finalAttr = getAttrValue(finalCell, appliedAttr);
                        recordRowEye(localY, globalX, finalAttr);
                    }
                }
            }

            if (eyebrowChar) {
                for (var rowKey in rowEyes) {
                    if (!rowEyes.hasOwnProperty(rowKey)) continue;
                    var eyeInfo = rowEyes[rowKey];
                    if (!eyeInfo || eyeInfo.count < 2) continue;
                    var browX = Math.round((eyeInfo.min + eyeInfo.max) / 2);
                    var browY = yOffset + parseInt(rowKey, 10);
                    var browCell = sprite.frame.getData(browX, browY, false) || {};
                    var browAttr = getAttrValue(browCell, WHITE | WAS_BROWN);
                    var fgValue = (eyebrowFg !== null) ? eyebrowFg : (browAttr & FG_MASK);
                    var bgValue = (eyeInfo.bg !== undefined && eyeInfo.bg !== null)
                        ? eyeInfo.bg
                        : (browAttr & BG_MASK);
                    var updatedAttr = composeAttrWithColor(browAttr, fgValue, bgValue);
                    sprite.frame.setData(browX, browY, eyebrowChar, updatedAttr);
                }
            }
        }
    }

    sprite.frame.invalidate();
}
