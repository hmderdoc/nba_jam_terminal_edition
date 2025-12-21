/**
 * bearing-frames.js
 * 
 * Sprite bearing frame injection and animation management.
 * Handles dynamic loading of shoved and shover animation frames into player sprites.
 */

/**
 * Inject a bearing frame from source sprite into target sprite's frame buffer
 * @param {Sprite} targetSprite - Sprite to receive the injected bearing
 * @param {string} newBearing - Name of the new bearing to create
 * @param {Sprite} sourceSprite - Sprite to copy frame data from
 * @param {string} sourceBearing - Bearing to copy from source sprite
 */
function injectBearingFrame(targetSprite, newBearing, sourceSprite, sourceBearing) {
    if (!targetSprite.__injectedBearings) {
        targetSprite.__injectedBearings = {};
    }

    // Store frame data for this bearing
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

/**
 * Apply injected bearing frame data to sprite
 * @param {Sprite} sprite - Sprite to apply bearing to
 * @param {string} bearing - Name of the injected bearing to apply
 * @returns {boolean} True if bearing was applied, false otherwise
 */
function applyInjectedBearing(sprite, bearing) {
    if (!sprite.__injectedBearings || !sprite.__injectedBearings[bearing]) {
        return false;
    }

    var frameData = sprite.__injectedBearings[bearing];
    var height = frameData.length;

    for (var y = 0; y < height; y++) {
        var width = frameData[y].length;
        for (var x = 0; x < width; x++) {
            // Skip jersey number cells (row 2, columns 1 and 3) to preserve customization
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

/**
 * Merge shoved sprite frames into a player sprite at runtime
 * @param {Sprite} sprite - Player sprite to merge shoved bearings into
 * @returns {boolean} True if successful, false otherwise
 */
function mergeShovedBearingsIntoSprite(sprite) {
    if (!sprite || !sprite.ini) {
        return false;
    }
    if (sprite.__shovedBearingsMerged) {
        return true; // Already merged
    }

    try {
        var baseBearings = sprite.ini.bearings || [];
        if (!baseBearings.length) {
            return false;
        }

        // Load the shoved sprite template to get its frame data
        var shovedTemplate;
        try {
            shovedTemplate = new Sprite.Aerial("player-shoved", courtFrame, 1, 2, "e", "normal");
            shovedTemplate.frame.open();
        } catch (e) {
            return false;
        }

        // For each base bearing, extract frame data and inject as shoved_* bearing
        for (var i = 0; i < baseBearings.length; i++) {
            var baseBearing = baseBearings[i];
            var shovedBearing = "shoved_" + baseBearing;

            // Set template to this bearing and extract frame data
            if (typeof shovedTemplate.setBearing === "function") {
                shovedTemplate.setBearing(baseBearing);
                if (typeof shovedTemplate.cycle === "function") {
                    shovedTemplate.cycle();
                }
            }

            // Inject this bearing's frame data into the target sprite
            injectBearingFrame(sprite, shovedBearing, shovedTemplate, baseBearing);
        }

        // Update bearings list to include shoved variants
        var extendedBearings = baseBearings.slice();
        for (var i = 0; i < baseBearings.length; i++) {
            extendedBearings.push("shoved_" + baseBearings[i]);
        }
        sprite.ini.bearings = extendedBearings;

        sprite.__shovedBearingsMerged = true;

        // Clean up template sprite
        if (shovedTemplate.frame) {
            shovedTemplate.frame.close();
        }

        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Merge shover sprite frames into a player sprite at runtime
 * Shows aggressive animation when player initiates a shove
 * @param {Sprite} sprite - Player sprite to merge shover bearings into
 * @returns {boolean} True if successful, false otherwise
 */
function mergeShoverBearingsIntoSprite(sprite) {
    if (!sprite || !sprite.ini || !sprite.frame) {
        return false;
    }
    if (sprite.__shoverBearingsMerged) {
        return true; // Already merged
    }

    try {
        var baseBearings = sprite.ini.bearings || [];
        if (!baseBearings.length) {
            return false;
        }

        // Load shover template sprite
        var shoverTemplate;
        try {
            shoverTemplate = new Sprite.Aerial("player-shover", courtFrame, 1, 2, "e", "normal");
            if (!shoverTemplate || !shoverTemplate.frame) {
                return false;
            }
            shoverTemplate.frame.open();
        } catch (e) {
            return false;
        }

        // For each base bearing, extract frame data and inject as shover_* bearing
        for (var i = 0; i < baseBearings.length; i++) {
            var baseBearing = baseBearings[i];
            var shoverBearing = "shover_" + baseBearing;

            // Set template to this bearing and extract frame data
            if (typeof shoverTemplate.setBearing === "function") {
                shoverTemplate.setBearing(baseBearing);
                if (typeof shoverTemplate.cycle === "function") {
                    shoverTemplate.cycle();
                }
            }

            // Inject this bearing's frame data into the target sprite
            injectBearingFrame(sprite, shoverBearing, shoverTemplate, baseBearing);
        }

        // Update bearings list to include shover variants
        var extendedBearings = sprite.ini.bearings.slice();
        for (var i = 0; i < baseBearings.length; i++) {
            extendedBearings.push("shover_" + baseBearings[i]);
        }
        sprite.ini.bearings = extendedBearings;

        sprite.__shoverBearingsMerged = true;

        // Clean up template sprite
        if (shoverTemplate.frame) {
            shoverTemplate.frame.close();
        }

        return true;
    } catch (e) {
        return false;
    }
}
