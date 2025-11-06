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
