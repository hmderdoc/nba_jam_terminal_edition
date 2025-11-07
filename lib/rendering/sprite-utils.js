// NBA Jam Sprite Utilities
// Functions for sprite manipulation, transparency, and coordinate transforms

// ============================================================================
// COORDINATE TRANSFORMS
// ============================================================================

function getCourtScreenOffsetY() {
    if (courtFrame && typeof courtFrame.y === "number") {
        return courtFrame.y - 1;
    }
    return COURT_SCREEN_Y_OFFSET;
}

// ============================================================================
// SPRITE TRANSPARENCY & CLEANUP
// ============================================================================

function scrubSpriteTransparency(sprite) {
    if (!sprite || !sprite.frame) return;
    var frame = sprite.frame;
    var width = frame.width || (sprite.ini && sprite.ini.width) || 0;
    var height = frame.height || (sprite.ini && sprite.ini.height) || 0;
    if (!width || !height) return;

    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            var cell = frame.getData(x, y, false);
            if (!cell) continue;
            var ch = cell.ch;
            if (ch === undefined || ch === null) continue;

            var code;
            if (typeof ch === "number") {
                code = ch;
            } else if (typeof ch === "string" && ch.length) {
                code = ch.charCodeAt(0);
            } else {
                code = null;
            }

            var isBlank = false;
            if (code === null) {
                isBlank = true;
            } else if (code === 0 || code === 32) {
                isBlank = true;
            } else if (typeof ch === "string" && ch.trim().length === 0) {
                isBlank = true;
            }

            if (!isBlank && typeof cell.attr === "number") {
                var fg = cell.attr & FG_MASK;
                var bg = cell.attr & BG_MASK;
                if ((fg === 0 || fg === null) && (bg === 0 || bg === BG_BLACK)) {
                    if (typeof ch === "string" && ch === "") {
                        isBlank = true;
                    }
                }
            }

            if (isBlank) {
                frame.clearData(x, y, false);
            }
        }
    }
}

// ============================================================================
// SPRITE COLOR APPLICATION
// ============================================================================

function applyShoeColorToSprite(sprite, color) {
    if (!sprite || !sprite.frame || !sprite.__shoeCells || !sprite.__shoeCells.length) return;
    var jerseyBg = (typeof sprite.__shoeBg === "number") ? sprite.__shoeBg : BG_BLACK;
    for (var i = 0; i < sprite.__shoeCells.length; i++) {
        var cell = sprite.__shoeCells[i];
        var data = sprite.frame.getData(cell.x, cell.y, false);
        var ch = (data && data.ch !== undefined) ? data.ch : ascii(220);
        var baseAttr = (data && typeof data.attr === "number") ? data.attr : jerseyBg;
        var updatedAttr = composeAttrWithColor(baseAttr, color, jerseyBg);
        sprite.frame.setData(cell.x, cell.y, ch, updatedAttr);
    }
    sprite.frame.invalidate();
}

// ============================================================================
// FIRE EFFECTS & UNIFORM CUSTOMIZATION
// ============================================================================

var FIRE_COLOR_SEQUENCE = [RED, LIGHTRED, YELLOW, WHITE];

function getFireColorIndex(stepOffset) {
    var tick = (typeof gameState !== "undefined" && gameState && typeof gameState.tickCounter === "number")
        ? gameState.tickCounter
        : 0;
    var total = tick + (stepOffset || 0);
    var len = FIRE_COLOR_SEQUENCE.length;
    var idx = total % len;
    if (idx < 0) idx += len;
    return idx;
}

function getFireFg(stepOffset) {
    return FIRE_COLOR_SEQUENCE[getFireColorIndex(stepOffset)] & FG_MASK;
}

function getOnFireTrailAttr(player, stepOffset, defaultAttr) {
    var baseAttr = (typeof defaultAttr === "number") ? defaultAttr : (LIGHTGRAY | WAS_BROWN);
    if (!player || !player.playerData || !player.playerData.onFire)
        return baseAttr;
    var fireFg = getFireFg(stepOffset);
    return composeAttrWithColor(baseAttr, fireFg, baseAttr & BG_MASK);
}

function resolveBaselineBackground(teamColor, fallback) {
    if (teamColor && typeof teamColor.bg === "number" && teamColor.bg !== BG_BLACK) {
        return teamColor.bg;
    }
    if (teamColor && typeof teamColor.bg_alt === "number" && teamColor.bg_alt !== BG_BLACK) {
        return teamColor.bg_alt;
    }
    return fallback;
}

function getTeamBaselineColors(teamKey) {
    var isRed = teamKey === "teamA";
    var fallbackBg = isRed ? BG_RED : BG_BLUE;
    var fallbackFg = isRed ? LIGHTRED : LIGHTBLUE;
    var teamColors = (gameState && gameState.teamColors && gameState.teamColors[teamKey]) ? gameState.teamColors[teamKey] : null;

    return {
        fg: (teamColors && typeof teamColors.fg === "number") ? teamColors.fg : fallbackFg,
        bg: resolveBaselineBackground(teamColors, fallbackBg)
    };
}

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

            sprite.frame.setData(xOffset + 1, yOffset + 2, leftDigit, digitsAttr);

            var neckData = sprite.frame.getData(xOffset + 2, yOffset + 2, false);
            var neckAttrRaw = getAttrValue(neckData, digitsAttr);
            var skinFg = neckAttrRaw & FG_MASK;
            var neckAttr = composeAttrWithColor(neckAttrRaw, skinFg, jerseyBg);
            sprite.frame.setData(xOffset + 2, yOffset + 2, topNeckChar, neckAttr);

            sprite.frame.setData(xOffset + 3, yOffset + 2, rightDigit, digitsAttr);

            var leftLegData = sprite.frame.getData(xOffset + 1, yOffset + 3, false);
            var leftLegAttrRaw = getAttrValue(leftLegData, jerseyBg);
            var initialShoeColor = (options && typeof options.shoeColor === "number") ? options.shoeColor : (leftLegAttrRaw & FG_MASK);
            var leftLegAttr = composeAttrWithColor(leftLegAttrRaw, initialShoeColor, jerseyBg);
            sprite.frame.setData(xOffset + 1, yOffset + 3, shortsChar, leftLegAttr);
            sprite.__shoeCells.push({ x: xOffset + 1, y: yOffset + 3 });

            var rightLegData = sprite.frame.getData(xOffset + 3, yOffset + 3, false);
            var rightLegAttrRaw = getAttrValue(rightLegData, jerseyBg);
            var rightLegAttr = composeAttrWithColor(rightLegAttrRaw, initialShoeColor, jerseyBg);
            sprite.frame.setData(xOffset + 3, yOffset + 3, shortsChar, rightLegAttr);
            sprite.__shoeCells.push({ x: xOffset + 3, y: yOffset + 3 });

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

// ============================================================================
// SPRITE BEARING INJECTION
// ============================================================================

function injectBearingFrame(targetSprite, newBearing, sourceSprite, sourceBearing) {
    if (!targetSprite.__injectedBearings) {
        targetSprite.__injectedBearings = {};
    }

    var width = sourceSprite.ini && sourceSprite.ini.width ? sourceSprite.ini.width : 5;
    var height = sourceSprite.ini && sourceSprite.ini.height ? sourceSprite.ini.height : 4;

    var frameData = [];
    for (var y = 0; y < height; y++) {
        frameData[y] = [];
        for (var x = 0; x < width; x++) {
            var cellData = sourceSprite.frame.getData(x, y, false);
            if (cellData) {
                frameData[y][x] = {
                    ch: cellData.ch,
                    attr: cellData.attr
                };
            }
        }
    }

    targetSprite.__injectedBearings[newBearing] = frameData;
}

function applyInjectedBearing(sprite, bearing) {
    if (!sprite.__injectedBearings || !sprite.__injectedBearings[bearing]) {
        return false;
    }

    var frameData = sprite.__injectedBearings[bearing];
    var height = frameData.length;

    for (var y = 0; y < height; y++) {
        var width = frameData[y].length;
        for (var x = 0; x < width; x++) {
            if (y === 2 && (x === 1 || x === 3)) {
                continue;
            }

            var cell = frameData[y][x];
            if (cell && cell.ch !== undefined) {
                sprite.frame.setData(x, y, cell.ch, cell.attr, false);
            }
        }
    }

    sprite.frame.invalidate();
    return true;
}

function mergeShovedBearingsIntoSprite(sprite) {
    if (!sprite || !sprite.ini) {
        log(LOG_WARNING, "mergeShovedBearingsIntoSprite: sprite or sprite.ini is null");
        return false;
    }
    if (sprite.__shovedBearingsMerged) {
        return true;
    }

    try {
        var baseBearings = sprite.ini.bearings || [];
        if (!baseBearings.length) {
            log(LOG_WARNING, "Cannot merge shoved bearings - no base bearings in sprite");
            return false;
        }

        var shovedTemplate;
        try {
            shovedTemplate = new Sprite.Aerial("player-shoved", courtFrame, 1, 2, "e", "normal");
            shovedTemplate.frame.open();
            log(LOG_INFO, "Successfully loaded player-shoved template sprite");
        } catch (e) {
            log(LOG_WARNING, "Cannot load player-shoved sprite: " + e);
            return false;
        }

        for (var i = 0; i < baseBearings.length; i++) {
            var baseBearing = baseBearings[i];
            var shovedBearing = "shoved_" + baseBearing;

            if (typeof shovedTemplate.setBearing === "function") {
                shovedTemplate.setBearing(baseBearing);
                if (typeof shovedTemplate.cycle === "function") {
                    shovedTemplate.cycle();
                }
            }

            injectBearingFrame(sprite, shovedBearing, shovedTemplate, baseBearing);
        }

        var extendedBearings = baseBearings.slice();
        for (var j = 0; j < baseBearings.length; j++) {
            extendedBearings.push("shoved_" + baseBearings[j]);
        }
        sprite.ini.bearings = extendedBearings;

        sprite.__shovedBearingsMerged = true;

        if (shovedTemplate.frame) {
            shovedTemplate.frame.close();
        }

        log(LOG_INFO, "Merged shoved bearings into sprite: " + extendedBearings.join(", "));
        return true;
    } catch (mergeErr) {
        log(LOG_ERROR, "Error merging shoved bearings: " + mergeErr);
        return false;
    }
}

function mergeShoverBearingsIntoSprite(sprite) {
    if (!sprite || !sprite.ini || !sprite.frame) {
        log(LOG_WARNING, "mergeShoverBearingsIntoSprite: Invalid sprite");
        return false;
    }
    if (sprite.__shoverBearingsMerged) {
        return true;
    }

    try {
        var baseBearings = sprite.ini.bearings || [];
        if (!baseBearings.length) {
            log(LOG_WARNING, "Cannot merge shover bearings - no base bearings");
            return false;
        }

        var shoverTemplate;
        try {
            shoverTemplate = new Sprite.Aerial("player-shover", courtFrame, 1, 2, "e", "normal");
            if (!shoverTemplate || !shoverTemplate.frame) {
                log(LOG_WARNING, "Failed to load player-shover sprite");
                return false;
            }
            shoverTemplate.frame.open();
            log(LOG_INFO, "Successfully loaded player-shover template sprite");
        } catch (loadErr) {
            log(LOG_WARNING, "Cannot load player-shover sprite: " + loadErr);
            return false;
        }

        for (var i = 0; i < baseBearings.length; i++) {
            var baseBearing = baseBearings[i];
            var shoverBearing = "shover_" + baseBearing;

            if (typeof shoverTemplate.setBearing === "function") {
                shoverTemplate.setBearing(baseBearing);
                if (typeof shoverTemplate.cycle === "function") {
                    shoverTemplate.cycle();
                }
            }

            injectBearingFrame(sprite, shoverBearing, shoverTemplate, baseBearing);
        }

        var extendedBearingsShover = sprite.ini.bearings.slice();
        for (var j = 0; j < baseBearings.length; j++) {
            extendedBearingsShover.push("shover_" + baseBearings[j]);
        }
        sprite.ini.bearings = extendedBearingsShover;

        sprite.__shoverBearingsMerged = true;

        if (shoverTemplate.frame) {
            shoverTemplate.frame.close();
        }

        log(LOG_INFO, "Merged shover bearings into sprite: " + extendedBearingsShover.join(", "));
        return true;
    } catch (err) {
        log(LOG_ERROR, "Error merging shover bearings: " + err);
        return false;
    }
}

// ============================================================================
// SPRITE.AERIAL PROTOTYPE PATCH
// Enhances Sprite.Aerial with automatic bearing/movement on court
// ============================================================================

(function patchAerialBearing() {
    if (typeof Sprite === "undefined" || !Sprite.Aerial || !Sprite.Aerial.prototype || Sprite.__bearingPatched) {
        return;
    }

    var originalMoveTo = Sprite.Aerial.prototype.moveTo;
    var originalCycle = Sprite.Aerial.prototype.cycle;

    Sprite.Aerial.prototype.moveTo = function (x, y) {
        var previousX = this.x;
        var previousY = this.y;

        var drawX = x;
        var drawY = y;
        var useCourtOffset = this.frame && this.frame.parent === courtFrame && typeof y === "number";
        if (useCourtOffset) {
            drawY = y + getCourtScreenOffsetY();
        }

        originalMoveTo.call(this, drawX, drawY);

        if (useCourtOffset) {
            if (typeof x === "number") this.x = x;
            if (typeof y === "number") this.y = y;
        }

        if (typeof previousX !== "number" || typeof previousY !== "number") {
            return;
        }

        var deltaX = this.x - previousX;
        var deltaY = this.y - previousY;

        if (deltaX === 0 && deltaY === 0) {
            return;
        }

        var vertical = deltaY < 0 ? "n" : (deltaY > 0 ? "s" : "");
        var horizontal = deltaX > 0 ? "e" : (deltaX < 0 ? "w" : "");
        var desiredBearing = vertical + horizontal;

        if (!desiredBearing) {
            return;
        }

        var bearings = (this.ini && this.ini.bearings) || [];
        if (typeof bearings.indexOf !== "function") {
            bearings = [];
        }

        var absDeltaX = deltaX < 0 ? -deltaX : deltaX;
        var absDeltaY = deltaY < 0 ? -deltaY : deltaY;
        var finalBearing = desiredBearing;

        if (bearings.length && bearings.indexOf(finalBearing) === -1) {
            var hasHorizontal = horizontal && bearings.indexOf(horizontal) !== -1;
            var hasVertical = vertical && bearings.indexOf(vertical) !== -1;

            if (hasHorizontal && hasVertical) {
                finalBearing = absDeltaX >= absDeltaY ? horizontal : vertical;
            } else if (hasHorizontal) {
                finalBearing = horizontal;
            } else if (hasVertical) {
                finalBearing = vertical;
            } else {
                return;
            }
        }

        // Preserve shoved/shover bearing state - don't change bearing if currently showing injury/aggression
        var currentBearing = this.bearing || "";
        var isInShovedState = currentBearing.indexOf("shoved_") === 0;
        var isInShoverState = currentBearing.indexOf("shover_") === 0;

        if (finalBearing && finalBearing !== this.bearing && typeof this.turnTo === "function") {
            if (isInShovedState) {
                // Convert desired bearing to shoved variant to maintain injury appearance
                var shovedBearing = "shoved_" + finalBearing;
                var availableBearings = (this.ini && this.ini.bearings) || [];
                if (availableBearings.indexOf(shovedBearing) !== -1) {
                    this.turnTo(shovedBearing);
                }
            } else if (isInShoverState) {
                // Convert desired bearing to shover variant to maintain aggression appearance
                var shoverBearing = "shover_" + finalBearing;
                var availableBearingsShover = (this.ini && this.ini.bearings) || [];
                if (availableBearingsShover.indexOf(shoverBearing) !== -1) {
                    this.turnTo(shoverBearing);
                }
            } else {
                this.turnTo(finalBearing);
            }
        }
    };

    Sprite.Aerial.prototype.cycle = function () {
        var useCourtOffset = this.frame && this.frame.parent === courtFrame;
        if (!useCourtOffset) {
            return originalCycle.call(this);
        }

        var ret = false;
        if (this.ini.constantmotion > 0 && this.ini.speed > 0 && system.timer - this.lastMove > this.ini.speed) {
            this.move("forward");
        }

        if (this.bearing !== this.lastBearing || this.position !== this.lastPosition) {
            ret = true;
            this.lastBearing = this.bearing;
            this.lastPosition = this.position;
            this.frame.scrollTo(this.positions[this.position], this.bearings[this.bearing]);
        }

        var offsetY = getCourtScreenOffsetY();
        var expectedX = this.x;
        var expectedY = this.y + offsetY;

        if (this.frame && (this.frame.x !== expectedX || this.frame.y !== expectedY)) {
            ret = true;
            this.frame.moveTo(expectedX, expectedY);
        }

        if (
            this.ini.range > 0 &&
            (
                this.x - this.origin.x >= this.ini.range ||
                this.origin.x - this.x >= this.ini.range ||
                this.y - this.origin.y >= this.ini.range / 2 ||
                this.origin.y - this.y >= this.ini.range / 2
            )
        ) {
            this.frame.close();
            this.open = false;
        }
        return ret;
    };

    Sprite.__bearingPatched = true;
})();
