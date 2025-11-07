// NBA JAM - Terminal Basketball Arcade Game
// A Synchronet BBS door game using sprite.js

load("sbbsdefs.js");
load("frame.js");
load("sprite.js");
load(js.exec_dir + "lib/utils/constants.js");
load(js.exec_dir + "lib/utils/helpers.js");
load(js.exec_dir + "lib/rendering/sprite-utils.js");
load(js.exec_dir + "lib/rendering/animation-system.js");
load(js.exec_dir + "lib/rendering/player-labels.js");
load(js.exec_dir + "lib/rendering/shoe-colors.js");
load(js.exec_dir + "lib/rendering/ball.js");
load(js.exec_dir + "lib/rendering/court-rendering.js");
load(js.exec_dir + "lib/game-logic/game-state.js");
load(js.exec_dir + "lib/game-logic/player-class.js");
load(js.exec_dir + "lib/game-logic/movement-physics.js");
load(js.exec_dir + "lib/game-logic/passing.js");
load(js.exec_dir + "lib/game-logic/defense-actions.js");
load(js.exec_dir + "lib/game-logic/physical-play.js");
load(js.exec_dir + "lib/game-logic/rebounds.js");
load(js.exec_dir + "lib/game-logic/dunks.js");
load(js.exec_dir + "lib/game-logic/shooting.js");
load(js.exec_dir + "lib/game-logic/possession.js");
load(js.exec_dir + "lib/game-logic/team-data.js");
load(js.exec_dir + "lib/bookie/bookie.js");

// Multiplayer support (optional - loaded on demand)
var multiplayerEnabled = false;
try {
    load(js.exec_dir + "lib/multiplayer/mp_identity.js");
    load(js.exec_dir + "lib/multiplayer/mp_team_data.js");
    load(js.exec_dir + "lib/multiplayer/mp_config.js");
    load(js.exec_dir + "lib/multiplayer/mp_network.js");
    load(js.exec_dir + "lib/multiplayer/mp_sessions.js");
    load(js.exec_dir + "lib/multiplayer/mp_lobby.js");
    load(js.exec_dir + "lib/multiplayer/mp_coordinator.js");
    load(js.exec_dir + "lib/multiplayer/mp_client.js");
    multiplayerEnabled = true;
} catch (mpLoadError) {
    log(LOG_WARNING, "NBA JAM: Multiplayer load failed: " + mpLoadError + " (at " + (mpLoadError.fileName || "?") + ":" + (mpLoadError.lineNumber || "?") + ")");
}

load(js.exec_dir + "lib/ai/offense-ball-handler.js");
load(js.exec_dir + "lib/ai/offense-off-ball.js");
load(js.exec_dir + "lib/ai/defense-on-ball.js");
load(js.exec_dir + "lib/ai/defense-help.js");
load(js.exec_dir + "lib/ai/coordinator.js");
load(js.exec_dir + "lib/ui/announcer.js");
load(js.exec_dir + "lib/ui/scoreboard.js");

// Helper function to pad strings
function padStart(str, length, padChar) {
    str = String(str);
    while (str.length < length) {
        str = padChar + str;
    }
    return str;
}

function padEnd(str, length, padChar) {
    str = String(str);
    while (str.length < length) {
        str = str + padChar;
    }
    return str;
}

function repeatChar(ch, count) {
    var out = "";
    for (var i = 0; i < count; i++) out += ch;
    return out;
}

// Helper function to extract last name from full name
// Helper function to convert color string to color constant
// Convert color string to Synchronet CTRL-A color code for console.putmsg
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

function sanitizeControllerAlias(alias, maxLen) {
    maxLen = maxLen || 8;
    if (!alias)
        return "";
    var trimmed = String(alias).trim();
    if (trimmed.length > maxLen)
        trimmed = trimmed.substring(0, maxLen);
    return trimmed;
}

function setSpriteControllerLabel(sprite, alias, isHuman) {
    if (!sprite || !sprite.playerData)
        return;
    var clean = sanitizeControllerAlias(alias || "CPU", 7);
    sprite.playerData.controllerLabel = "<" + clean + ">";
    sprite.playerData.controllerIsHuman = !!isHuman;
}

function applyDefaultControllerLabels() {
    var alias = (typeof user !== "undefined" && user && user.alias) ? user.alias : "YOU";
    var sprites = [redPlayer1, redPlayer2, bluePlayer1, bluePlayer2];
    for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        if (!sprite || !sprite.playerData)
            continue;
        if (sprite.isHuman) {
            setSpriteControllerLabel(sprite, alias, true);
        } else {
            setSpriteControllerLabel(sprite, "CPU", false);
        }
    }
}

function drawScore() {
    if (!scoreFrame) return;

    scoreFrame.clear();
    ensureScoreFontLoaded();

    var frameWidth = scoreFrame.width || 80;
    var centerColumn = Math.floor(frameWidth / 2);
    var sideMargin = 0;
    var turboGap = 0;
    var clockGap = 1;
    var shotClockRow = 2;
    var turboRow = 2;
    var playerRow = 3;
    var controllerRow = 4;
    var scorePanelAttr = WHITE | BG_BLACK;

    var blueTeamName = (gameState.teamNames.blue || "BLUE").toUpperCase();
    var redTeamName = (gameState.teamNames.red || "RED").toUpperCase();
    var blueTeamAbbr = (gameState.teamAbbrs && gameState.teamAbbrs.blue) ? String(gameState.teamAbbrs.blue).toUpperCase() : "BLU";
    var redTeamAbbr = (gameState.teamAbbrs && gameState.teamAbbrs.red) ? String(gameState.teamAbbrs.red).toUpperCase() : "RED";

    if (blueTeamAbbr && redTeamAbbr && blueTeamAbbr.replace(/\s+/g, "") === redTeamAbbr.replace(/\s+/g, "")) {
        var baseAbbr = blueTeamAbbr.replace(/\s+/g, "");
        if (!baseAbbr.length) baseAbbr = "TEAM";
        var trimmedBase = baseAbbr;
        if (trimmedBase.length > 5) {
            trimmedBase = trimmedBase.substring(0, 5);
        }
        blueTeamAbbr = trimmedBase + "1";
        redTeamAbbr = trimmedBase + "2";
    }

    var blueScoreValue = String(gameState.score.blue);
    var redScoreValue = String(gameState.score.red);
    var blueScoreText = padStart(blueScoreValue, 3, ' ');
    var redScoreText = padStart(redScoreValue, 3, ' ');

    var blueBg = (gameState.teamColors.blue && gameState.teamColors.blue.bg !== undefined) ? gameState.teamColors.blue.bg : BG_BLACK;
    var redBg = (gameState.teamColors.red && gameState.teamColors.red.bg !== undefined) ? gameState.teamColors.red.bg : BG_BLACK;
    var blueNameColor = (gameState.teamColors.blue ? gameState.teamColors.blue.fg : LIGHTBLUE) | blueBg;
    var redNameColor = (gameState.teamColors.red ? gameState.teamColors.red.fg : LIGHTRED) | redBg;
    var panelBgMask = scorePanelAttr & BG_MASK;
    var blueScoreFg = (gameState.teamColors.blue ? gameState.teamColors.blue.fg : WHITE) & FG_MASK;
    var redScoreFg = (gameState.teamColors.red ? gameState.teamColors.red.fg : WHITE) & FG_MASK;

    var flashInfo = getScoreFlashState();
    if (flashInfo.active && flashInfo.regainCheckEnabled && !gameState.inbounding && gameState.currentTeam === flashInfo.activeTeam) {
        stopScoreFlash(flashInfo.activeTeam);
        flashInfo = getScoreFlashState();
    }

    var flashActive = !!(flashInfo.active && flashInfo.activeTeam);
    var flashTick = gameState.tickCounter || 0;
    var flashPeriod = 8;
    var flashElapsed = flashTick - (flashInfo.startedTick || 0);
    if (flashElapsed < 0) flashElapsed = 0;
    var flashOn = flashActive && ((flashElapsed % flashPeriod) < (flashPeriod / 2));
    var blueFlashOn = flashOn && flashInfo.activeTeam === "blue";
    var redFlashOn = flashOn && flashInfo.activeTeam === "red";
    var whiteFg = WHITE & FG_MASK;
    var flashFg = LIGHTGRAY & FG_MASK;

    if (blueFlashOn) {
        if (blueScoreFg === whiteFg) {
            blueScoreFg = flashFg;
        } else {
            blueScoreFg = whiteFg;
        }
    }
    if (redFlashOn) {
        if (redScoreFg === whiteFg) {
            redScoreFg = flashFg;
        } else {
            redScoreFg = whiteFg;
        }
    }

    var blueScorePanelAttr = blueScoreFg | panelBgMask;
    var redScorePanelAttr = redScoreFg | panelBgMask;
    var blueScoreBoardAttr = blueScoreFg | BG_BLACK;
    var redScoreBoardAttr = redScoreFg | BG_BLACK;

    var halfTime = Math.floor(gameState.totalGameTime / 2);
    var rawTime = (gameState.currentHalf === 1) ? (gameState.timeRemaining - halfTime) : gameState.timeRemaining;
    if (rawTime < 0) rawTime = 0;
    var mins = Math.floor(rawTime / 60);
    var secs = rawTime % 60;
    var halfLabel = gameState.currentHalf === 1 ? "1ST" : "2ND";
    var clockText = halfLabel + " " + mins + ":" + padStart(secs, 2, '0');
    var clockX = clamp(centerColumn - Math.floor(clockText.length / 2), 1, frameWidth - clockText.length + 1);
    clockX = Math.min(clockX + 1, frameWidth - clockText.length + 1);
    var clockRight = clockX + clockText.length - 1;
    scoreFrame.gotoxy(clockX, 1);
    scoreFrame.putmsg(clockText, LIGHTGREEN | BG_BLACK);

    var leftNameStart = Math.max(1 + sideMargin, 1);
    var leftNameEnd = clockX - clockGap - 1;
    var leftAvailable = Math.max(0, leftNameEnd - leftNameStart + 1);
    if (leftAvailable > 0) {
        var leftName = blueTeamName;
        if (leftName.length > leftAvailable) {
            leftName = leftName.slice(0, leftAvailable);
        }
        if (leftName.length > 0) {
            scoreFrame.gotoxy(leftNameStart, 1);
            scoreFrame.putmsg(leftName, blueNameColor);
        }
    }

    var rightNameEnd = frameWidth - sideMargin;
    var rightNameStartMin = clockRight + clockGap + 1;
    var rightAvailable = Math.max(0, rightNameEnd - rightNameStartMin + 1);
    if (rightAvailable > 0) {
        var rightName = redTeamName;
        if (rightName.length > rightAvailable) {
            rightName = rightName.slice(rightName.length - rightAvailable);
        }
        if (rightName.length > 0) {
            var rightNameStart = Math.max(rightNameStartMin, rightNameEnd - rightName.length + 1);
            scoreFrame.gotoxy(rightNameStart, 1);
            scoreFrame.putmsg(rightName, redNameColor);
        }
    }

    var shotClockValue = Math.max(0, gameState.shotClock);
    var shotClockColor = shotClockValue <= 5 ? LIGHTRED : WHITE;
    var shotText = "SHOT " + padStart(String(shotClockValue), 2, ' ');
    var shotX = clamp(centerColumn - Math.floor(shotText.length / 2), 1, frameWidth - shotText.length + 1);
    shotX = Math.min(shotX + 1, frameWidth - shotText.length + 1);
    var shotRight = shotX + shotText.length - 1;
    scoreFrame.gotoxy(shotX, shotClockRow);
    scoreFrame.putmsg(shotText, shotClockColor | BG_BLACK);

    var leftTurboPositions = [
        { player: bluePlayer1, x: 1 },
        { player: bluePlayer2, x: 12 }
    ];
    var leftTurboMax = sideMargin;
    for (var i = 0; i < leftTurboPositions.length; i++) {
        var leftInfo = leftTurboPositions[i];
        var leftWidth = getTurboBarWidth(leftInfo.player);
        if (leftWidth > 0) {
            var leftEnd = leftInfo.x + leftWidth - 1;
            if (leftEnd > leftTurboMax) leftTurboMax = leftEnd;
        }
    }

    var rightTurboPositions = [
        { player: redPlayer1, x: 59 },
        { player: redPlayer2, x: 70 }
    ];
    var rightTurboMin = null;
    for (var j = 0; j < rightTurboPositions.length; j++) {
        var rightInfo = rightTurboPositions[j];
        var rightWidth = getTurboBarWidth(rightInfo.player);
        if (rightWidth > 0) {
            if (rightTurboMin === null || rightInfo.x < rightTurboMin) {
                rightTurboMin = rightInfo.x;
            }
        }
    }

    var leftDigitsStart = Math.max(leftTurboMax + turboGap + 1, sideMargin + 1);
    var leftDigitsEnd = shotX - clockGap - 1;
    var leftPanelStart = leftDigitsStart;
    var leftPanelEnd = leftDigitsEnd;
    var leftDigitsWidth = leftDigitsEnd - leftDigitsStart + 1;
    var leftRendered = false;
    var leftFrame = null;

    if (leftDigitsWidth >= SCORE_FONT_MIN_WIDTH) {
        leftFrame = ensureScoreFrame("left", leftDigitsStart, leftDigitsWidth, scorePanelAttr);
        if (leftFrame) {
            if (ensureScoreFontLoaded()) {
                leftRendered = renderScoreDigits(leftFrame, blueScoreValue, blueScorePanelAttr, scorePanelAttr);
            } else {
                fillFrameBackground(leftFrame, scorePanelAttr);
            }
        }
    } else {
        leftFrame = null;
        ensureScoreFrame("left", 0, 0);
    }

    if (!leftRendered) {
        var maxLeftEnd = shotX - clockGap - 1;
        var minLeftStart = sideMargin + 1;
        var fallbackLeftStart = Math.max(minLeftStart, maxLeftEnd - blueScoreText.length + 1);
        var fallbackLeftEnd = fallbackLeftStart + blueScoreText.length - 1;
        leftPanelStart = fallbackLeftStart;
        leftPanelEnd = fallbackLeftEnd;
        if (leftFrame) {
            renderFallbackScore(leftFrame, blueScoreText.trim(), blueScorePanelAttr, scorePanelAttr);
        } else if (fallbackLeftStart <= maxLeftEnd && fallbackLeftEnd <= maxLeftEnd) {
            scoreFrame.gotoxy(fallbackLeftStart, shotClockRow);
            scoreFrame.putmsg(blueScoreText, blueScoreBoardAttr);
        }
    }

    var rightDigitsStart = shotRight + clockGap;
    var rightDigitsEnd = (rightTurboMin !== null) ? (rightTurboMin - turboGap - 1) : (frameWidth - sideMargin);
    var rightPanelStart = rightDigitsStart;
    var rightPanelEnd = rightDigitsEnd;
    var rightDigitsWidth = rightDigitsEnd - rightDigitsStart + 1;
    var rightRendered = false;
    var rightFrame = null;

    if (rightDigitsWidth >= SCORE_FONT_MIN_WIDTH) {
        rightFrame = ensureScoreFrame("right", rightDigitsStart, rightDigitsWidth, scorePanelAttr);
        if (rightFrame) {
            if (ensureScoreFontLoaded()) {
                rightRendered = renderScoreDigits(rightFrame, redScoreValue, redScorePanelAttr, scorePanelAttr);
            } else {
                fillFrameBackground(rightFrame, scorePanelAttr);
            }
        }
    } else {
        rightFrame = null;
        ensureScoreFrame("right", 0, 0);
    }

    if (!rightRendered) {
        var minRightStart = shotRight + clockGap;
        var maxRightStart = frameWidth - sideMargin - redScoreText.length + 1;
        if (rightFrame) {
            renderFallbackScore(rightFrame, redScoreText.trim(), redScorePanelAttr, scorePanelAttr);
        } else if (minRightStart <= maxRightStart) {
            var fallbackRightStart = maxRightStart;
            scoreFrame.gotoxy(fallbackRightStart, shotClockRow);
            scoreFrame.putmsg(redScoreText, redScoreBoardAttr);
            rightPanelStart = fallbackRightStart;
            rightPanelEnd = fallbackRightStart + redScoreText.length - 1;
        }
    }

    if (bluePlayer1 && bluePlayer1.playerData) {
        updatePlayerShoeColor(bluePlayer1);
        scoreFrame.gotoxy(1, turboRow);
        drawTurboBar(bluePlayer1);
    }
    if (bluePlayer2 && bluePlayer2.playerData) {
        updatePlayerShoeColor(bluePlayer2);
        scoreFrame.gotoxy(12, turboRow);
        drawTurboBar(bluePlayer2);
    }
    if (redPlayer1 && redPlayer1.playerData) {
        updatePlayerShoeColor(redPlayer1);
        scoreFrame.gotoxy(59, turboRow);
        drawTurboBar(redPlayer1);
    }
    if (redPlayer2 && redPlayer2.playerData) {
        updatePlayerShoeColor(redPlayer2);
        scoreFrame.gotoxy(70, turboRow);
        drawTurboBar(redPlayer2);
    }

    var firePalette = [LIGHTRED, YELLOW, WHITE, LIGHTRED];
    function getNameAttr(teamKey, baseFg, baseBg, offset, playerSprite) {
        if (playerSprite && playerSprite.playerData && playerSprite.playerData.onFire) {
            var idx = Math.floor((gameState.tickCounter + (offset || 0)) / 2) % firePalette.length;
            return firePalette[idx] | baseBg;
        }
        return baseFg | baseBg;
    }

    function renderPlayerSlot(x, player, teamKey, offset) {
        if (!player || !player.playerData) return;
        scoreFrame.gotoxy(x, playerRow);
        if (gameState.ballCarrier === player) {
            scoreFrame.putmsg("o", YELLOW | BG_BLACK);
        } else {
            scoreFrame.putmsg(" ", BG_BLACK);
        }
        var last = getLastName(player.playerData.name).substring(0, 8);
        scoreFrame.gotoxy(x + 1, playerRow);
        var baseBg = (gameState.teamColors[teamKey] && gameState.teamColors[teamKey].bg !== undefined)
            ? gameState.teamColors[teamKey].bg
            : BG_BLACK;
        var baseFg = gameState.teamColors[teamKey].fg;
        var attr = getNameAttr(teamKey, baseFg, baseBg, offset, player);
        scoreFrame.putmsg(last, attr);
    }

    function renderControllerSlot(x, player, teamKey) {
        var width = 9;
        var label = "";
        var attr = LIGHTGRAY | BG_BLACK;

        if (player && player.playerData) {
            if (player.playerData.controllerLabel) {
                label = player.playerData.controllerLabel;
            }
            if (player.playerData.controllerIsHuman) {
                var teamColors = gameState.teamColors[teamKey];
                var fg = teamColors ? teamColors.fg : WHITE;
                attr = fg | BG_BLACK;
            }
        }

        var truncated = label;
        if (truncated.length > width)
            truncated = truncated.substring(0, width);
        var padded = format("%-" + width + "s", truncated);
        scoreFrame.gotoxy(x, controllerRow);
        scoreFrame.putmsg(padded, attr);
    }

    renderPlayerSlot(2, bluePlayer1, "blue", 0);
    renderPlayerSlot(14, bluePlayer2, "blue", 3);
    renderPlayerSlot(60, redPlayer1, "red", 0);
    renderPlayerSlot(72, redPlayer2, "red", 3);

    renderControllerSlot(2, bluePlayer1, "blue");
    renderControllerSlot(14, bluePlayer2, "blue");
    renderControllerSlot(60, redPlayer1, "red");
    renderControllerSlot(72, redPlayer2, "red");

    var abbrRow = 5;
    if ((scoreFrame.height || 0) >= abbrRow) {
        var blueAbbrAttr = (gameState.teamColors.blue ? gameState.teamColors.blue.fg : WHITE) | BG_BLACK;
        var redAbbrAttr = (gameState.teamColors.red ? gameState.teamColors.red.fg : WHITE) | BG_BLACK;

        var leftWidth = leftPanelEnd - leftPanelStart + 1;
        if (leftWidth > 0) {
            var leftAbbr = blueTeamAbbr;
            if (leftAbbr.length > leftWidth) {
                leftAbbr = leftAbbr.substring(0, leftWidth);
            }
            var leftCenter = Math.floor((leftPanelStart + leftPanelEnd) / 2);
            var leftStart = clamp(leftCenter - Math.floor(leftAbbr.length / 2), 1, Math.max(1, frameWidth - leftAbbr.length + 1));
            scoreFrame.gotoxy(leftStart, abbrRow);
            scoreFrame.putmsg(leftAbbr, blueAbbrAttr);
        }

        var rightWidth = rightPanelEnd - rightPanelStart + 1;
        if (rightWidth > 0) {
            var rightAbbr = redTeamAbbr;
            if (rightAbbr.length > rightWidth) {
                rightAbbr = rightAbbr.substring(0, rightWidth);
            }
            var rightCenter = Math.floor((rightPanelStart + rightPanelEnd) / 2);
            var rightStart = clamp(rightCenter - Math.floor(rightAbbr.length / 2), 1, Math.max(1, frameWidth - rightAbbr.length + 1));
            scoreFrame.gotoxy(rightStart, abbrRow);
            scoreFrame.putmsg(rightAbbr, redAbbrAttr);
        }
    }

    if (flashActive) {
        var buryX = Math.max(1, Math.min(frameWidth, scoreFrame.width || frameWidth));
        var buryY = scoreFrame.height || 5;
        scoreFrame.gotoxy(buryX, buryY);
    }

    cycleFrame(scoreFrame);
    drawAnnouncerLine();
}

function getScoreFlashState() {
    if (!gameState.scoreFlash) {
        gameState.scoreFlash = {
            active: false,
            activeTeam: null,
            stopTeam: null,
            startedTick: 0,
            regainCheckEnabled: false
        };
    }
    return gameState.scoreFlash;
}

function startScoreFlash(scoringTeam, inboundTeam) {
    var state = getScoreFlashState();
    state.active = true;
    state.activeTeam = scoringTeam;
    state.stopTeam = inboundTeam;
    state.startedTick = gameState.tickCounter || 0;
    state.regainCheckEnabled = false;
}

function stopScoreFlash(teamName) {
    var state = getScoreFlashState();
    if (!state.active) return;
    if (!teamName || state.activeTeam === teamName) {
        state.active = false;
        state.activeTeam = null;
        state.stopTeam = null;
        state.startedTick = 0;
        state.regainCheckEnabled = false;
    }
}

function enableScoreFlashRegainCheck(teamName) {
    var state = getScoreFlashState();
    if (!state.active) return;
    if (!teamName || state.stopTeam === teamName) {
        state.regainCheckEnabled = true;
        if (!gameState.inbounding && state.activeTeam && gameState.currentTeam === state.activeTeam) {
            stopScoreFlash(state.activeTeam);
        }
    }
}

function setFrontcourtEstablished(teamName) {
    if (gameState.frontcourtEstablished) return;
    gameState.frontcourtEstablished = true;
    var state = gameState.scoreFlash;
    if (state && state.active && state.stopTeam === teamName) {
        stopScoreFlash(state.activeTeam);
    }
}

function drawAnnouncerLine() {
    if (!announcerFrame || (announcerFrame.is_open === false)) return;
    announcerFrame.clear();

    var text = getAnnouncerText();
    if (text) {
        var frameWidth = announcerFrame.width || 80;
        if (text.length > frameWidth) {
            text = text.substring(0, frameWidth);
        }
        var startX = clamp(Math.floor((frameWidth - text.length) / 2) + 1, 1, Math.max(1, frameWidth - text.length + 1));
        announcerFrame.gotoxy(startX, 1);
        announcerFrame.putmsg(text, getAnnouncerColor() | BG_BLACK);
    }

    cycleFrame(announcerFrame);
}

function getJerseyDisplayValue(player) {
    if (!player || !player.playerData) return "";
    var rawJersey = (player.playerData.jerseyString !== undefined && player.playerData.jerseyString !== null)
        ? player.playerData.jerseyString
        : player.playerData.jersey;
    var jerseyValue = (rawJersey !== undefined && rawJersey !== null) ? String(rawJersey) : "";
    if (jerseyValue.length === 0) return "";
    if (jerseyValue.length < 2) {
        jerseyValue = padStart(jerseyValue, 2, ' ');
    }
    return jerseyValue;
}

function getTurboBarWidth(player) {
    if (!player || !player.playerData) return 0;
    var jerseyDisplay = getJerseyDisplayValue(player);
    var prefix = "#" + jerseyDisplay;
    var prefixLength = prefix.length;
    var barLength = 6; // Matches drawTurboBar segments
    return prefixLength + 2 + barLength; // prefix + '[' + ']' + segments
}

function drawTurboBar(player) {
    if (!player || !player.playerData) return;
    var turbo = (typeof player.playerData.turbo === "number") ? player.playerData.turbo : 0;
    var jerseyDisplay = getJerseyDisplayValue(player);
    var jerseyText = "\1h\1w#" + jerseyDisplay + "\1n";
    scoreFrame.putmsg(jerseyText, LIGHTGRAY | BG_BLACK);

    var palette = getPlayerShoePalette(player);
    var highColor = palette ? palette.high : LIGHTGREEN;
    var lowColor = palette ? palette.low : LIGHTRED;
    var displayColor = (turbo >= SHOE_TURBO_THRESHOLD) ? highColor : lowColor;

    var barLength = 6;
    var filled = Math.floor((turbo / MAX_TURBO) * barLength);

    scoreFrame.putmsg("[", LIGHTGRAY | BG_BLACK);
    for (var i = 0; i < barLength; i++) {
        if (i < filled) {
            scoreFrame.putmsg(ascii(219), displayColor | BG_BLACK);
        } else {
            scoreFrame.putmsg(" ", BG_BLACK);
        }
    }
    scoreFrame.putmsg("]", LIGHTGRAY | BG_BLACK);
}

function initFrames() {
    if (typeof console !== 'undefined' && typeof console.clear === 'function') {
        console.clear();
    }

    announcerFrame = new Frame(1, 1, 80, 1, LIGHTGRAY | BG_BLACK);
    courtFrame = new Frame(1, 2, COURT_WIDTH, COURT_HEIGHT, WHITE | WAS_BROWN);

    // Create transparent trail overlay at same position as courtFrame (not as child)
    trailFrame = new Frame(1, 2, COURT_WIDTH, COURT_HEIGHT, 0);
    trailFrame.transparent = true;

    cleanupScoreFrames();
    scoreFrame = new Frame(1, COURT_HEIGHT + 2, 80, 5, LIGHTGRAY | BG_BLACK);

    announcerFrame.open();
    courtFrame.open();
    trailFrame.open();  // Open trail overlay on top of court
    trailFrame.top();   // Ensure trails are drawn on top
    scoreFrame.open();
    ensureScoreFontLoaded();

    ensureBallFrame(40, 10);
    drawAnnouncerLine();
}

// Inject a bearing frame from source sprite into target sprite's frame buffer
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

// Apply injected bearing frame data to sprite
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

// Merge shoved sprite frames into a player sprite at runtime
function mergeShovedBearingsIntoSprite(sprite) {
    if (!sprite || !sprite.ini) {
        log(LOG_WARNING, "mergeShovedBearingsIntoSprite: sprite or sprite.ini is null");
        return false;
    }
    if (sprite.__shovedBearingsMerged) {
        return true; // Already merged
    }

    try {
        var baseBearings = sprite.ini.bearings || [];
        if (!baseBearings.length) {
            log(LOG_WARNING, "Cannot merge shoved bearings - no base bearings in sprite");
            return false;
        }

        // Load the shoved sprite template to get its frame data
        var shovedTemplate;
        try {
            shovedTemplate = new Sprite.Aerial("player-shoved", courtFrame, 1, 2, "e", "normal");
            shovedTemplate.frame.open();
            log(LOG_INFO, "Successfully loaded player-shoved template sprite");
        } catch (e) {
            log(LOG_WARNING, "Cannot load player-shoved sprite: " + e);
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

        log(LOG_INFO, "Merged shoved bearings into sprite: " + extendedBearings.join(", "));
        return true;
    } catch (e) {
        log(LOG_ERROR, "Error merging shoved bearings: " + e);
        return false;
    }
}

// Merge shover sprite frames into a player sprite at runtime
// Shows aggressive animation when player initiates a shove
function mergeShoverBearingsIntoSprite(sprite) {
    if (!sprite || !sprite.ini || !sprite.frame) {
        log(LOG_WARNING, "mergeShoverBearingsIntoSprite: Invalid sprite");
        return false;
    }
    if (sprite.__shoverBearingsMerged) {
        return true; // Already merged
    }

    try {
        var baseBearings = sprite.ini.bearings || [];
        if (!baseBearings.length) {
            log(LOG_WARNING, "Cannot merge shover bearings - no base bearings");
            return false;
        }

        // Load shover template sprite
        var shoverTemplate;
        try {
            shoverTemplate = new Sprite.Aerial("player-shover", courtFrame, 1, 2, "e", "normal");
            if (!shoverTemplate || !shoverTemplate.frame) {
                log(LOG_WARNING, "Failed to load player-shover sprite");
                return false;
            }
            shoverTemplate.frame.open();
            log(LOG_INFO, "Successfully loaded player-shover template sprite");
        } catch (e) {
            log(LOG_WARNING, "Cannot load player-shover sprite: " + e);
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

        log(LOG_INFO, "Merged shover bearings into sprite: " + extendedBearings.join(", "));
        return true;
    } catch (e) {
        log(LOG_ERROR, "Error merging shover bearings: " + e);
        return false;
    }
}

// Cleanup function for sprites
function cleanupSprites() {
    if (redPlayer1) {
        if (redPlayer1.frame) redPlayer1.frame.close();
        if (redPlayer1.labelFrame) {
            try { redPlayer1.labelFrame.close(); } catch (e) { }
            redPlayer1.labelFrame = null;
        }
    }
    if (redPlayer2) {
        if (redPlayer2.frame) redPlayer2.frame.close();
        if (redPlayer2.labelFrame) {
            try { redPlayer2.labelFrame.close(); } catch (e) { }
            redPlayer2.labelFrame = null;
        }
    }
    if (bluePlayer1) {
        if (bluePlayer1.frame) bluePlayer1.frame.close();
        if (bluePlayer1.labelFrame) {
            try { bluePlayer1.labelFrame.close(); } catch (e) { }
            bluePlayer1.labelFrame = null;
        }
    }
    if (bluePlayer2) {
        if (bluePlayer2.frame) bluePlayer2.frame.close();
        if (bluePlayer2.labelFrame) {
            try { bluePlayer2.labelFrame.close(); } catch (e) { }
            bluePlayer2.labelFrame = null;
        }
    }
    if (ballFrame) ballFrame.close();

    redPlayer1 = null;
    redPlayer2 = null;
    bluePlayer1 = null;
    bluePlayer2 = null;
    ballFrame = null;
}

// Load the shoved sprite template once for all players
function initSprites(redTeamName, blueTeamName, redPlayerIndices, bluePlayerIndices, allCPUMode) {
    // Get team rosters
    redTeamName = redTeamName || "lakers";
    blueTeamName = blueTeamName || "celtics";
    allCPUMode = allCPUMode || false;
    gameState.allCPUMode = allCPUMode;

    var redTeam = NBATeams[redTeamName];
    var blueTeam = NBATeams[blueTeamName];

    // Set team names and colors in game state
    gameState.teamNames.red = redTeam.name || redTeamName;
    gameState.teamNames.blue = blueTeam.name || blueTeamName;
    gameState.teamAbbrs.red = (redTeam && redTeam.abbr) ? String(redTeam.abbr).toUpperCase() : redTeamName.substring(0, 3).toUpperCase();
    gameState.teamAbbrs.blue = (blueTeam && blueTeam.abbr) ? String(blueTeam.abbr).toUpperCase() : blueTeamName.substring(0, 3).toUpperCase();

    // Set team colors (convert string names to actual color constants)
    if (redTeam.colors) {
        var redFgName = redTeam.colors.fg || "WHITE";
        var redFgAccentName = redTeam.colors.fg_accent || redFgName;
        var redAltFgName = redTeam.colors.alt_fg || null;
        var redAltBgName = redTeam.colors.alt_bg || null;
        gameState.teamColors.red = {
            fg: getColorValue(redTeam.colors.fg),
            bg: getColorValue(redTeam.colors.bg),
            fg_accent: getColorValue(redTeam.colors.fg_accent),
            bg_alt: getColorValue(redTeam.colors.bg_alt),
            fg_code: getColorCode(redFgName),
            fg_accent_code: getColorCode(redFgAccentName),
            alt_fg: redAltFgName ? getColorValue(redAltFgName) : null,
            alt_bg: redAltBgName ? getColorValue(redAltBgName) : null,
            alt_fg_code: redAltFgName ? getColorCode(redAltFgName) : null,
            alt_bg_code: redAltBgName ? getBackgroundCode(redAltBgName) : null
        };
    }
    if (blueTeam.colors) {
        var blueFgName = blueTeam.colors.fg || "WHITE";
        var blueFgAccentName = blueTeam.colors.fg_accent || blueFgName;
        var blueAltFgName = blueTeam.colors.alt_fg || null;
        var blueAltBgName = blueTeam.colors.alt_bg || null;
        gameState.teamColors.blue = {
            fg: getColorValue(blueTeam.colors.fg),
            bg: getColorValue(blueTeam.colors.bg),
            fg_accent: getColorValue(blueTeam.colors.fg_accent),
            bg_alt: getColorValue(blueTeam.colors.bg_alt),
            fg_code: getColorCode(blueFgName),
            fg_accent_code: getColorCode(blueFgAccentName),
            alt_fg: blueAltFgName ? getColorValue(blueAltFgName) : null,
            alt_bg: blueAltBgName ? getColorValue(blueAltBgName) : null,
            alt_fg_code: blueAltFgName ? getColorCode(blueAltFgName) : null,
            alt_bg_code: blueAltBgName ? getBackgroundCode(blueAltBgName) : null
        };
    }

    resetShoePaletteAssignments();

    // Default to first two players if no indices provided
    if (!redPlayerIndices) {
        redPlayerIndices = { player1: 0, player2: 1 };
    }
    if (!bluePlayerIndices) {
        bluePlayerIndices = { player1: 0, player2: 1 };
    }

    function getPlayerInfo(players, index) {
        if (players && players[index]) {
            return players[index];
        }
        return {
            name: "Player",
            jersey: 0,
            jerseyString: "0",
            skin: "brown",
            shortNick: null,
            attributes: [6, 6, 6, 6, 6, 6]
        };
    }

    function sanitizeAccentColor(color) {
        if (color === undefined || color === null) {
            return WHITE;
        }
        var masked = color & 0x8F; // Keep blink/high bits plus foreground nibble
        if (masked === 0) {
            return WHITE;
        }
        return masked;
    }

    function resolveJerseyBackground(teamColors, fallback) {
        if (teamColors && typeof teamColors.bg_alt === "number") {
            return teamColors.bg_alt;
        }
        if (teamColors && typeof teamColors.bg === "number") {
            return teamColors.bg;
        }
        return fallback;
    }

    function createSpriteForPlayer(playerInfo, startX, startY, bearing, teamColors, isHuman, fallbackBg) {
        var usingCustomSprite = !!(playerInfo && playerInfo.customSprite);
        var spriteBase = usingCustomSprite
            ? playerInfo.customSprite
            : resolveSpriteBaseBySkin(playerInfo.skin);
        var sprite = new Sprite.Aerial(
            spriteBase,
            courtFrame,
            startX,
            startY,
            bearing,
            "normal"
        );

        var shoePalette = null;

        if (!usingCustomSprite) {
            var jerseyBgColor = resolveJerseyBackground(teamColors, fallbackBg);
            var accentColor = sanitizeAccentColor(teamColors && teamColors.fg_accent);
            shoePalette = assignShoePalette(teamColors);
            sprite.assignedShoePalette = shoePalette ? cloneShoePalette(shoePalette) : null;

            var jerseyDigits = "";
            if (playerInfo.jerseyString !== undefined && playerInfo.jerseyString !== null && String(playerInfo.jerseyString).trim() !== "") {
                jerseyDigits = String(playerInfo.jerseyString);
            } else if (playerInfo.jersey !== undefined && playerInfo.jersey !== null) {
                jerseyDigits = String(playerInfo.jersey);
            }

            var eyeColorAttr = null;
            if (playerInfo.eyeColor) {
                var eyeValue = getColorValue(playerInfo.eyeColor);
                if (typeof eyeValue === "number") {
                    eyeColorAttr = eyeValue & FG_MASK;
                }
            }

            var eyebrowChar = playerInfo.eyebrowChar ? String(playerInfo.eyebrowChar).charAt(0) : null;
            if (eyebrowChar !== null && eyebrowChar.length === 0) eyebrowChar = null;

            var eyebrowColorAttr = null;
            if (playerInfo.eyebrowColor) {
                var eyebrowValue = getColorValue(playerInfo.eyebrowColor);
                if (typeof eyebrowValue === "number") {
                    eyebrowColorAttr = eyebrowValue & FG_MASK;
                }
            }

            var jerseyConfig = {
                jerseyBg: jerseyBgColor,
                accentFg: accentColor,
                jerseyNumber: jerseyDigits,
                shoeColor: shoePalette ? shoePalette.high : undefined,
                eyeColor: eyeColorAttr,
                eyebrowChar: eyebrowChar,
                eyebrowColor: eyebrowColorAttr
            };
            applyUniformMask(sprite, jerseyConfig);
            // Store config for later restoration (e.g., after shoved animation)
            sprite.__jerseyConfig = jerseyConfig;
        } else {
            sprite.assignedShoePalette = null;
        }

        scrubSpriteTransparency(sprite);

        sprite.moveTo(startX, startY);
        sprite.frame.open();
        sprite.isHuman = !!isHuman;
        sprite.initialShoeColor = shoePalette ? shoePalette.high : null;

        // Merge shoved bearings into the sprite at runtime
        mergeShovedBearingsIntoSprite(sprite);

        return sprite;
    }

    // Create RED TEAM (left side)
    var redInfo1 = getPlayerInfo(redTeam.players, redPlayerIndices.player1);
    redPlayer1 = createSpriteForPlayer(redInfo1, 18, 7, "e", gameState.teamColors.red, !allCPUMode, BG_RED);
    var redPlayer1Data = new Player(
        redInfo1.name,
        redInfo1.jersey,
        redInfo1.attributes,
        redPlayer1,
        redInfo1.shortNick
    );
    redPlayer1Data.skin = redInfo1.skin || "brown";
    redPlayer1Data.jerseyString = redInfo1.jerseyString !== undefined ? String(redInfo1.jerseyString) : String(redPlayer1Data.jersey);
    redPlayer1Data.position = (redInfo1.position || "").toUpperCase();
    redPlayer1Data.hasDribble = true;
    applyShoePaletteToPlayer(redPlayer1);

    var redInfo2 = getPlayerInfo(redTeam.players, redPlayerIndices.player2);
    redPlayer2 = createSpriteForPlayer(redInfo2, 18, 12, "e", gameState.teamColors.red, false, BG_RED);
    var redPlayer2Data = new Player(
        redInfo2.name,
        redInfo2.jersey,
        redInfo2.attributes,
        redPlayer2,
        redInfo2.shortNick
    );
    redPlayer2Data.skin = redInfo2.skin || "brown";
    redPlayer2Data.jerseyString = redInfo2.jerseyString !== undefined ? String(redInfo2.jerseyString) : String(redPlayer2Data.jersey);
    redPlayer2Data.position = (redInfo2.position || "").toUpperCase();
    redPlayer2Data.hasDribble = true;
    applyShoePaletteToPlayer(redPlayer2);

    // Create BLUE TEAM (right side)
    var blueInfo1 = getPlayerInfo(blueTeam.players, bluePlayerIndices.player1);
    bluePlayer1 = createSpriteForPlayer(blueInfo1, 58, 7, "w", gameState.teamColors.blue, false, BG_BLUE);
    var bluePlayer1Data = new Player(
        blueInfo1.name,
        blueInfo1.jersey,
        blueInfo1.attributes,
        bluePlayer1,
        blueInfo1.shortNick
    );
    bluePlayer1Data.skin = blueInfo1.skin || "brown";
    bluePlayer1Data.jerseyString = blueInfo1.jerseyString !== undefined ? String(blueInfo1.jerseyString) : String(bluePlayer1Data.jersey);
    bluePlayer1Data.position = (blueInfo1.position || "").toUpperCase();
    bluePlayer1Data.hasDribble = true;
    applyShoePaletteToPlayer(bluePlayer1);

    var blueInfo2 = getPlayerInfo(blueTeam.players, bluePlayerIndices.player2);
    bluePlayer2 = createSpriteForPlayer(blueInfo2, 58, 12, "w", gameState.teamColors.blue, false, BG_BLUE);
    var bluePlayer2Data = new Player(
        blueInfo2.name,
        blueInfo2.jersey,
        blueInfo2.attributes,
        bluePlayer2,
        blueInfo2.shortNick
    );
    bluePlayer2Data.skin = blueInfo2.skin || "brown";
    bluePlayer2Data.jerseyString = blueInfo2.jerseyString !== undefined ? String(blueInfo2.jerseyString) : String(bluePlayer2Data.jersey);
    bluePlayer2Data.position = (blueInfo2.position || "").toUpperCase();
    bluePlayer2Data.hasDribble = true;
    applyShoePaletteToPlayer(bluePlayer2);

    applyDefaultControllerLabels();

    ensureBallFrame();

    // Red team starts with ball - player 1 has it
    gameState.ballCarrier = redPlayer1;
    gameState.currentTeam = "red";
    if (redPlayer1.playerData) redPlayer1.playerData.hasDribble = true;
    if (redPlayer2.playerData) redPlayer2.playerData.hasDribble = true;
    if (bluePlayer1.playerData) bluePlayer1.playerData.hasDribble = true;
    if (bluePlayer2.playerData) bluePlayer2.playerData.hasDribble = true;

    gameState.firstHalfStartTeam = gameState.currentTeam;
    gameState.secondHalfInitDone = false;
    gameState.pendingSecondHalfInbound = false;
}

function getAllPlayers() {
    return [redPlayer1, redPlayer2, bluePlayer1, bluePlayer2];
}

function getRedTeam() {
    return [redPlayer1, redPlayer2];
}

function getBlueTeam() {
    return [bluePlayer1, bluePlayer2];
}

function getClosestPlayer(x, y, team) {
    var players = team === "red" ? getRedTeam() : getBlueTeam();
    var closest = players[0];
    var closestDist = 9999;

    for (var i = 0; i < players.length; i++) {
        var dx = players[i].x - x;
        var dy = players[i].y - y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
            closestDist = dist;
            closest = players[i];
        }
    }
    return closest;
}

function getPlayerTeamName(player) {
    if (player === redPlayer1 || player === redPlayer2) return "red";
    if (player === bluePlayer1 || player === bluePlayer2) return "blue";
    return null;
}

function getPlayerTeammate(player) {
    if (player === redPlayer1) return redPlayer2;
    if (player === redPlayer2) return redPlayer1;
    if (player === bluePlayer1) return bluePlayer2;
    if (player === bluePlayer2) return bluePlayer1;
    return null;
}

function getTimeMs() {
    if (typeof Date !== "undefined" && Date.now) {
        return Date.now();
    }
    if (typeof time === "function") {
        var t = time();
        if (typeof t === "number") {
            return t * 1000;
        }
    }
    if (typeof system !== "undefined" && typeof system.timer === "number") {
        return system.timer * 1000;
    }
    return 0;
}

function clearPotentialAssist() {
    gameState.potentialAssist = null;
}

function recordTurnover(player, reason) {
    if (!player || !player.playerData) return;
    var stats = player.playerData.stats;
    if (!stats) {
        stats = {};
        player.playerData.stats = stats;
    }
    if (typeof stats.turnovers !== "number") stats.turnovers = 0;
    stats.turnovers++;
    if (reason) {
        player.playerData.lastTurnoverReason = reason;
    } else {
        player.playerData.lastTurnoverReason = null;
    }
}

function setPotentialAssist(passer, receiver) {
    if (gameState.inbounding) {
        clearPotentialAssist();
        return;
    }
    if (!passer || !receiver || !passer.playerData || !receiver.playerData) {
        clearPotentialAssist();
        return;
    }
    gameState.potentialAssist = {
        passer: passer,
        receiver: receiver,
        team: getPlayerTeamName(passer),
        timestamp: getTimeMs()
    };
}

function maybeAwardAssist(scorer) {
    var potential = gameState.potentialAssist;
    if (!potential || !potential.passer || !potential.receiver) return;
    if (!scorer) return;
    if (potential.receiver !== scorer) return;
    if (potential.passer === scorer) return;

    var passerData = potential.passer.playerData;
    if (!passerData || !passerData.stats) return;

    var scorerTeam = getPlayerTeamName(scorer);
    if (!scorerTeam || potential.team !== scorerTeam) return;

    var now = getTimeMs();
    if (potential.timestamp && now && now - potential.timestamp > 6000) return;

    passerData.stats.assists++;
}

function getTeamSprites(teamName) {
    return teamName === "red" ? getRedTeam() : getBlueTeam();
}

function getOpposingTeamSprites(teamName) {
    return teamName === "red" ? getBlueTeam() : getRedTeam();
}

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function ensureScoreFontLoaded() {
    if (scoreFontModule && scoreFontData) return true;

    if (!scoreFontModule) {
        try {
            scoreFontModule = load("tdfonts_lib.js");
        } catch (primaryLoadError) {
            try {
                scoreFontModule = load("exec/load/tdfonts_lib.js");
            } catch (secondaryLoadError) {
                scoreFontInitAttempted = true;
                scoreFontModule = null;
                return false;
            }
        }

        scoreFontInitAttempted = true;
    }

    if (!scoreFontModule) return false;

    if (!scoreFontData) {
        try {
            scoreFontModule.opt = scoreFontModule.opt || {};
            scoreFontModule.opt.blankline = false;
            scoreFontModule.opt.ansi = false;
            scoreFontData = scoreFontModule.loadfont("serpentx");
        } catch (fontError) {
            scoreFontModule = null;
            scoreFontData = null;
            return false;
        }
    }

    return !!(scoreFontModule && scoreFontData);
}

function ensureScoreFrame(which, x, width, attr) {
    if (!scoreFrame) return null;
    var desiredHeight = 3;
    var parentHeight = scoreFrame.height || desiredHeight;
    var height = Math.min(parentHeight, desiredHeight);
    var parentX = scoreFrame.x || 1;
    var parentY = scoreFrame.y || 1;
    var parentWidth = scoreFrame.width || 80;

    if (width <= 0) {
        if (which === "left" && leftScoreFrame) {
            leftScoreFrame.close();
            leftScoreFrame = null;
        }
        if (which === "right" && rightScoreFrame) {
            rightScoreFrame.close();
            rightScoreFrame = null;
        }
        return null;
    }

    var localX = Math.max(1, x);
    var maxWidth = Math.max(0, parentWidth - localX + 1);
    if (width > maxWidth) width = maxWidth;
    if (width <= 0) {
        if (which === "left" && leftScoreFrame) {
            leftScoreFrame.close();
            leftScoreFrame = null;
        }
        if (which === "right" && rightScoreFrame) {
            rightScoreFrame.close();
            rightScoreFrame = null;
        }
        return null;
    }

    var globalX = parentX + localX - 1;
    var globalY = parentY;

    var frameRef = (which === "left") ? leftScoreFrame : rightScoreFrame;
    if (frameRef) {
        if (frameRef.x !== globalX || frameRef.y !== globalY || frameRef.width !== width || frameRef.height !== height) {
            frameRef.close();
            frameRef = null;
        }
    }

    if (!frameRef) {
        var frameAttr = (typeof attr === "number") ? attr : BG_BLACK;
        frameRef = new Frame(globalX, globalY, width, height, frameAttr, scoreFrame);
        frameRef.open();
    }

    if (which === "left") leftScoreFrame = frameRef;
    else rightScoreFrame = frameRef;

    return frameRef;
}

function sanitizeFontLine(line) {
    if (!line) return "";
    return line.replace(/\x01./g, "");
}

function fillFrameBackground(frame, attr) {
    if (!frame) return;
    if (frame.width <= 0 || frame.height <= 0) return;
    var fillAttr = (typeof attr === "number") ? attr : frame.attr;
    var blankLine = Array(frame.width + 1).join(" ");
    frame.home();
    for (var row = 1; row <= frame.height; row++) {
        frame.gotoxy(1, row);
        frame.putmsg(blankLine, fillAttr);
    }
    frame.home();
    frame.top();
}

function renderScoreDigits(frame, scoreText, attr, fillAttr) {
    if (!frame || !scoreFontModule || !scoreFontData) return false;
    scoreText = String(scoreText);
    fillFrameBackground(frame, fillAttr);

    scoreFontModule.opt = scoreFontModule.opt || {};
    scoreFontModule.opt.width = frame.width;
    scoreFontModule.opt.margin = 0;
    var justify = (scoreFontModule && typeof scoreFontModule.CENTER_JUSTIFY === "number")
        ? scoreFontModule.CENTER_JUSTIFY
        : SCORE_FONT_DEFAULT_JUSTIFY;
    scoreFontModule.opt.justify = justify;
    scoreFontModule.opt.blankline = false;

    var rendered;
    try {
        rendered = scoreFontModule.output(scoreText, scoreFontData) || "";
    } catch (renderErr) {
        return false;
    }

    var lines = rendered.split(/\r?\n/).filter(function (line) { return line.length > 0; });
    if (!lines.length) return false;

    var maxWidth = frame.width;
    var tooWide = lines.some(function (line) {
        var clean = sanitizeFontLine(line);
        return clean.length > maxWidth;
    });
    if (tooWide) return false;

    var startRow = Math.max(1, Math.floor((frame.height - lines.length) / 2));
    var colorAttr = attr || (WHITE | BG_BLACK);
    if (typeof fillAttr === "number") {
        colorAttr = (colorAttr & FG_MASK) | (fillAttr & BG_MASK);
    }

    for (var i = 0; i < lines.length && (startRow + i) <= frame.height; i++) {
        var cleanLine = sanitizeFontLine(lines[i]);
        frame.gotoxy(1, startRow + i);
        frame.putmsg(cleanLine, colorAttr);
    }

    frame.top();
    return true;
}

function renderFallbackScore(frame, text, attr, fillAttr) {
    if (!frame) return;
    text = String(text);
    fillFrameBackground(frame, fillAttr);

    var displayAttr = attr || (WHITE | BG_BLACK);
    if (typeof fillAttr === "number") {
        displayAttr = (displayAttr & FG_MASK) | (fillAttr & BG_MASK);
    }

    var startCol = Math.max(1, Math.floor((frame.width - text.length) / 2) + 1);
    var startRow = Math.max(1, Math.floor(frame.height / 2));
    if (startCol + text.length - 1 > frame.width) {
        text = text.substring(0, frame.width);
    }

    frame.gotoxy(startCol, startRow);
    frame.putmsg(text, displayAttr);
    frame.top();
}

function cleanupScoreFrames() {
    if (leftScoreFrame) {
        leftScoreFrame.close();
        leftScoreFrame = null;
    }
    if (rightScoreFrame) {
        rightScoreFrame.close();
        rightScoreFrame = null;
    }
}

function resetDeadDribbleTimer() {
    gameState.ballHandlerDeadSince = null;
    gameState.ballHandlerDeadFrames = 0;
    gameState.ballHandlerDeadForcedShot = false;
    var everyone = getAllPlayers ? getAllPlayers() : null;
    if (everyone && everyone.length) {
        for (var i = 0; i < everyone.length; i++) {
            var sprite = everyone[i];
            if (sprite && sprite.playerData) {
                sprite.playerData.hasDribble = true;
            }
        }
    } else if (gameState.ballCarrier && gameState.ballCarrier.playerData) {
        gameState.ballCarrier.playerData.hasDribble = true;
    }
}

function isBallHandlerDribbleDead() {
    var handler = gameState.ballCarrier;
    return !!(handler && handler.playerData && handler.playerData.hasDribble === false);
}

function getBallHandlerDeadElapsed() {
    if (!gameState.ballHandlerDeadSince) return 0;
    var now = getTimeMs();
    return Math.max(0, now - gameState.ballHandlerDeadSince);
}

function getSpriteDistanceToBasket(player, teamName) {
    if (!player) return 0;
    var basket = teamName === "red"
        ? { x: BASKET_RIGHT_X, y: BASKET_RIGHT_Y }
        : { x: BASKET_LEFT_X, y: BASKET_LEFT_Y };
    return distanceBetweenPoints(player.x, player.y, basket.x, basket.y);
}

function getBaseAttribute(playerData, attrIndex) {
    if (!playerData || !playerData.attributes) return 0;
    var value = playerData.attributes[attrIndex];
    return (typeof value === "number") ? value : 0;
}

function getEffectiveAttribute(playerData, attrIndex) {
    if (!playerData) return 0;
    if (playerData.onFire) return 10;
    return getBaseAttribute(playerData, attrIndex);
}

// ===== NEW AI HELPER FUNCTIONS =====

/**
 * Check if player is in frontcourt or backcourt
 * @param {Object} player - The sprite to check
 * @param {string} teamName - "red" or "blue"
 * @returns {boolean} true if in backcourt
 */
function isInBackcourt(player, teamName) {
    if (!player) return false;
    var courtMidX = Math.floor(COURT_WIDTH / 2);
    if (teamName === "red") {
        return player.x < courtMidX;
    } else {
        return player.x > courtMidX;
    }
}

/**
 * Check if a pass would violate over-and-back rule
 * @param {Object} passer - Player with ball
 * @param {Object} receiver - Teammate to receive pass
 * @param {string} teamName - "red" or "blue"
 * @returns {boolean} true if pass would be over-and-back violation
 */
function wouldBeOverAndBack(passer, receiver, teamName) {
    if (!passer || !receiver) return false;

    var passerInBackcourt = isInBackcourt(passer, teamName);
    var receiverInBackcourt = isInBackcourt(receiver, teamName);

    // If passer is in frontcourt and receiver is in backcourt = violation
    if (!passerInBackcourt && receiverInBackcourt) {
        return true;
    }

    return false;
}

function getSpriteDistance(spriteA, spriteB) {
    if (!spriteA || !spriteB) return 999;
    return distanceBetweenPoints(spriteA.x, spriteA.y, spriteB.x, spriteB.y);
}

function getTeammate(player, teamName) {
    var team = getTeamSprites(teamName);
    if (!team || team.length < 2) return null;
    return team[0] === player ? team[1] : team[0];
}

function evaluatePassingLaneClearance(passer, targetX, targetY, defenders) {
    if (!passer) return 0;

    var passX1 = passer.x + 2;
    var passY1 = passer.y + 2;
    var passX2 = targetX;
    var passY2 = targetY;
    var passVecX = passX2 - passX1;
    var passVecY = passY2 - passY1;
    var passLength = Math.sqrt(passVecX * passVecX + passVecY * passVecY);

    if (passLength < 0.1) return 0;

    var minClearance = 12;
    var sawDefender = false;

    if (!defenders) defenders = [];

    for (var i = 0; i < defenders.length; i++) {
        var defender = defenders[i];
        if (!defender) continue;

        var defX = defender.x + 2;
        var defY = defender.y + 2;

        var toDefX = defX - passX1;
        var toDefY = defY - passY1;

        var projection = (toDefX * passVecX + toDefY * passVecY) / passLength;
        var outsideSegment = false;

        if (projection < 0) {
            projection = 0;
            outsideSegment = true;
        } else if (projection > passLength) {
            projection = passLength;
            outsideSegment = true;
        }

        var t = passLength ? (projection / passLength) : 0;
        var closestX = passX1 + passVecX * t;
        var closestY = passY1 + passVecY * t;

        var deltaX = defX - closestX;
        var deltaY = defY - closestY;
        var distToLane = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        var stealAttr = defender.playerData
            ? getEffectiveAttribute(defender.playerData, ATTR_STEAL)
            : 0;

        var clearance = distToLane - (stealAttr * 0.45);
        if (outsideSegment) clearance -= 0.5;

        if (clearance < minClearance) {
            minClearance = clearance;
        }

        sawDefender = true;
    }

    if (!sawDefender) {
        minClearance = 8;
    }

    var lengthPenalty = passLength * PASS_LANE_LENGTH_WEIGHT;
    return minClearance - lengthPenalty;
}

function findOpenPassingLaneTarget(player, ballCarrier, teamName, myDefender) {
    if (!player || !ballCarrier) return null;

    var spots = getTeamSpots(teamName);
    if (!spots) return null;

    var defenders = getOpposingTeamSprites(teamName) || [];
    var teammate = getTeammate(player, teamName);
    var attackDirection = teamName === "red" ? 1 : -1;
    var aheadBuffer = 2;

    var candidates = [];
    var seen = Object.create(null);

    function addCandidate(spot) {
        if (!spot) return;
        var key = spot.x + "," + spot.y;
        if (seen[key]) return;
        seen[key] = true;
        candidates.push(spot);
    }

    addCandidate(spots.corner_low);
    addCandidate(spots.corner_high);
    addCandidate(spots.left_wing);
    addCandidate(spots.right_wing);
    addCandidate(spots.elbow_low);
    addCandidate(spots.elbow_high);
    addCandidate(spots.dunker_low);
    addCandidate(spots.dunker_high);
    addCandidate(spots.top_key);

    var laneOffset = player.y < ballCarrier.y ? -4 : 4;
    addCandidate({
        x: clampToCourtX(ballCarrier.x + attackDirection * 7),
        y: clampToCourtY(ballCarrier.y + laneOffset)
    });

    var rimSpot = getOffensiveBasket(teamName);
    if (rimSpot) {
        addCandidate({
            x: clampToCourtX(rimSpot.x - attackDirection * 3),
            y: clampToCourtY(BASKET_LEFT_Y)
        });
    }

    var bestSpot = null;
    var bestScore = -Infinity;

    for (var i = 0; i < candidates.length; i++) {
        var spot = candidates[i];
        if (!spot) continue;

        var ahead = attackDirection > 0
            ? spot.x > ballCarrier.x + aheadBuffer
            : spot.x < ballCarrier.x - aheadBuffer;
        if (!ahead) continue;

        if (teammate && distanceBetweenPoints(teammate.x, teammate.y, spot.x, spot.y) < 3) {
            continue;
        }

        var travel = distanceBetweenPoints(player.x, player.y, spot.x, spot.y);
        var clearance = evaluatePassingLaneClearance(ballCarrier, spot.x, spot.y, defenders);
        if (clearance < PASS_LANE_MIN_CLEARANCE) continue;

        var spacing = myDefender
            ? distanceBetweenPoints(myDefender.x, myDefender.y, spot.x, spot.y)
            : 6;

        var score = (clearance * 2.1)
            - (travel * PASS_LANE_TRAVEL_WEIGHT)
            + (Math.min(spacing, 10) * PASS_LANE_SPACING_WEIGHT)
            + (Math.random() * 0.2);

        if (!bestSpot || score > bestScore) {
            bestScore = score;
            bestSpot = {
                x: spot.x,
                y: spot.y,
                distance: travel,
                clearance: clearance,
                score: score
            };
        }
    }

    if (!bestSpot || bestScore < 0.1) {
        return null;
    }

    return bestSpot;
}

function applyDefenderMomentum(player, targetX, targetY, responsiveness, force) {
    if (!player || !player.playerData) {
        return { x: targetX, y: targetY };
    }

    var data = player.playerData;
    if (force || !data.defenseMomentum) {
        data.defenseMomentum = { x: targetX, y: targetY };
        return { x: targetX, y: targetY };
    }

    var resp = typeof responsiveness === "number" ? responsiveness : 0.3;
    if (resp <= 0) resp = 0.3;
    resp = clamp(resp, 0.05, 0.85);

    data.defenseMomentum.x += (targetX - data.defenseMomentum.x) * resp;
    data.defenseMomentum.y += (targetY - data.defenseMomentum.y) * resp;

    return { x: data.defenseMomentum.x, y: data.defenseMomentum.y };
}

function resetPlayerDefenseMomentum(player) {
    if (player && player.playerData) {
        player.playerData.defenseMomentum = null;
    }
}

function resetAllDefenseMomentum() {
    resetPlayerDefenseMomentum(redPlayer1);
    resetPlayerDefenseMomentum(redPlayer2);
    resetPlayerDefenseMomentum(bluePlayer1);
    resetPlayerDefenseMomentum(bluePlayer2);
}

function cloneCourtSpot(spot) {
    if (!spot) return null;
    return {
        x: clampToCourtX(Math.round(spot.x)),
        y: clampToCourtY(Math.round(spot.y))
    };
}

function chooseWingSpot(spots, cutToTop) {
    var left = spots.left_wing ? cloneCourtSpot(spots.left_wing) : null;
    var right = spots.right_wing ? cloneCourtSpot(spots.right_wing) : null;
    if (!left) return right;
    if (!right) return left;
    return (cutToTop ? (left.y <= right.y ? left : right) : (left.y >= right.y ? left : right));
}

function buildMomentumCutPlan(player, teamName, attackDirection, cutToTop) {
    var spots = getTeamSpots(teamName);
    if (!spots) return null;

    var planSpots = [];
    var turbo = [];

    var slashSpot = cloneCourtSpot(cutToTop ? spots.dunker_low : spots.dunker_high) || cloneCourtSpot(spots.top_key);
    if (slashSpot) {
        slashSpot.x = clampToCourtX(Math.round((slashSpot.x + player.x + attackDirection * 3) / 2));
        slashSpot.y = clampToCourtY(slashSpot.y + (cutToTop ? -1 : 1));
        planSpots.push(slashSpot);
        turbo.push(true);
    }

    var cornerSpot = cloneCourtSpot(cutToTop ? spots.corner_low : spots.corner_high);
    if (!cornerSpot) {
        cornerSpot = cloneCourtSpot(spots.corner_low) || cloneCourtSpot(spots.corner_high);
    }
    if (cornerSpot) {
        cornerSpot.x = clampToCourtX(cornerSpot.x + attackDirection * -1);
        cornerSpot.y = clampToCourtY(cornerSpot.y + (cutToTop ? -1 : 1));
        planSpots.push(cornerSpot);
        turbo.push(true);
    }

    var wingSpot = chooseWingSpot(spots, cutToTop);
    if (wingSpot) {
        wingSpot.x = clampToCourtX(wingSpot.x + attackDirection * 2);
        planSpots.push(wingSpot);
        turbo.push(false);
    }

    if (!planSpots.length) return null;

    return {
        spots: planSpots,
        turbo: turbo,
        index: 0,
        tolerance: 1.7,
        cooldown: 55
    };
}

function evaluateMomentumCutPlan(player, teamName, attackDirection, context) {
    if (!player || !player.playerData) return null;
    var data = player.playerData;

    if (data.momentumCutCooldown && data.momentumCutCooldown > 0) {
        data.momentumCutCooldown--;
    }

    if (context.inBackcourt || (context.ballCarrierInBackcourt && !context.amAhead)) {
        data.momentumCutPlan = null;
        return null;
    }

    if (context.defender && (!context.defender.playerData || !context.defender.playerData.defenseMomentum)) {
        data.momentumCutPlan = null;
    }

    var plan = data.momentumCutPlan;
    if (plan && plan.spots && plan.spots.length) {
        var target = plan.spots[plan.index];
        if (!target) {
            data.momentumCutPlan = null;
            return null;
        }
        var tolerance = plan.tolerance || 1.7;
        var dist = distanceBetweenPoints(player.x, player.y, target.x, target.y);

        if (dist < tolerance) {
            plan.index++;
            if (plan.index >= plan.spots.length) {
                data.momentumCutPlan = null;
                data.momentumCutCooldown = plan.cooldown || 50;
                return null;
            }
            target = plan.spots[plan.index];
            dist = distanceBetweenPoints(player.x, player.y, target.x, target.y);
        }

        data.momentumCutPlan = plan;
        return {
            x: target.x,
            y: target.y,
            turbo: plan.turbo && plan.turbo[plan.index]
        };
    }

    if (data.momentumCutCooldown && data.momentumCutCooldown > 0) return null;

    var defender = context.defender;
    if (!defender || !defender.playerData || !defender.playerData.defenseMomentum) return null;

    if (!context.ballHandlerStuck && !context.bunchedUp) return null;

    var momentum = defender.playerData.defenseMomentum;
    if (typeof momentum !== "object" || momentum === null) return null;
    if (typeof momentum.x !== "number" || typeof momentum.y !== "number") return null;

    var leanMagnitude = distanceBetweenPoints(momentum.x, momentum.y, player.x, player.y);
    if (leanMagnitude < 2) return null;

    var defenderTravel = distanceBetweenPoints(momentum.x, momentum.y, defender.x, defender.y);
    if (defenderTravel < 1) return null;

    var defToPlayerX = player.x - defender.x;
    var defToPlayerY = player.y - defender.y;
    var defToMomentumX = momentum.x - defender.x;
    var defToMomentumY = momentum.y - defender.y;
    var defToPlayerMag = Math.sqrt(defToPlayerX * defToPlayerX + defToPlayerY * defToPlayerY) || 1;
    var defToMomentumMag = Math.sqrt(defToMomentumX * defToMomentumX + defToMomentumY * defToMomentumY) || 1;
    var alignment = ((defToPlayerX * defToMomentumX) + (defToPlayerY * defToMomentumY)) / (defToPlayerMag * defToMomentumMag);

    if (alignment > 0.6) return null;

    var verticalLean = momentum.y - player.y;
    var cutToTop;
    if (Math.abs(verticalLean) >= 1) {
        cutToTop = verticalLean > 0;
    } else {
        cutToTop = player.y >= BASKET_LEFT_Y;
    }

    var newPlan = buildMomentumCutPlan(player, teamName, attackDirection, cutToTop);
    if (!newPlan) return null;

    data.momentumCutPlan = newPlan;
    return {
        x: newPlan.spots[0].x,
        y: newPlan.spots[0].y,
        turbo: newPlan.turbo && newPlan.turbo[0]
    };
}

function getPlayerKey(player) {
    if (player === redPlayer1) return "redPlayer1";
    if (player === redPlayer2) return "redPlayer2";
    if (player === bluePlayer1) return "bluePlayer1";
    if (player === bluePlayer2) return "bluePlayer2";
    return null;
}

function findBestDriveLaneY(player, defenders, targetX) {
    var lanes = [BASKET_LEFT_Y - 3, BASKET_LEFT_Y, BASKET_LEFT_Y + 3];
    var bestLane = clampToCourtY(player.y);
    var bestScore = -999;

    for (var i = 0; i < lanes.length; i++) {
        var laneY = clampToCourtY(lanes[i]);
        var probeX = clampToCourtX(player.x + (targetX - player.x) * 0.4);
        var minDefenderDist = 999;

        for (var d = 0; d < defenders.length; d++) {
            var defender = defenders[d];
            if (!defender) continue;
            var dist = distanceBetweenPoints(probeX, laneY, defender.x, defender.y);
            if (dist < minDefenderDist) {
                minDefenderDist = dist;
            }
        }

        if (minDefenderDist === 999) minDefenderDist = 12;

        // Prefer lanes that are open but not drastically far from current Y
        var alignmentPenalty = Math.abs(laneY - player.y) * 0.3;
        var score = minDefenderDist - alignmentPenalty;

        if (score > bestScore) {
            bestScore = score;
            bestLane = laneY;
        }
    }

    return bestLane;
}

function chooseBackcourtAdvanceTarget(player, teamName) {
    var midCourt = Math.floor(COURT_WIDTH / 2);
    var desiredX = teamName === "red"
        ? clampToCourtX(Math.max(player.x + 12, midCourt + 10))
        : clampToCourtX(Math.min(player.x - 12, midCourt - 10));

    var opponents = getOpposingTeamSprites(teamName);
    var bestY = clampToCourtY(player.y);
    var bestScore = Infinity;

    for (var offset = -6; offset <= 6; offset += 3) {
        var candidateY = clampToCourtY(player.y + offset);
        var crowdScore = 0;
        for (var i = 0; i < opponents.length; i++) {
            var opp = opponents[i];
            if (!opp) continue;
            var dist = distanceBetweenPoints(desiredX, candidateY, opp.x, opp.y);
            if (dist < 1) dist = 1;
            crowdScore += 1 / dist;
        }
        if (crowdScore < bestScore) {
            bestScore = crowdScore;
            bestY = candidateY;
        }
    }

    return { x: desiredX, y: bestY };
}

function activateAITurbo(player, drainMultiplier, distanceToTarget) {
    if (!player || !player.playerData) return false;
    var playerData = player.playerData;

    if (playerData.turbo <= 0) return false;
    if (distanceToTarget !== undefined && distanceToTarget < 3) return false;

    var now = Date.now();
    if (playerData.lastTurboUseTime && (now - playerData.lastTurboUseTime) < 350) {
        return false;
    }

    if (playerData.lastTurboX !== null && playerData.lastTurboY !== null) {
        if (player.x === playerData.lastTurboX && player.y === playerData.lastTurboY) {
            return false;
        }
    }

    if (playerData.turboActive && playerData.turbo <= 0) {
        return false;
    }

    var drain = TURBO_DRAIN_RATE * (drainMultiplier || 1);
    playerData.turboActive = true;
    if (!playerData.useTurbo(drain)) {
        playerData.turboActive = false;
        return false;
    }

    playerData.lastTurboUseTime = now;
    playerData.lastTurboX = player.x;
    playerData.lastTurboY = player.y;
    return true;
}

function resetBackcourtState() {
    gameState.backcourtTimer = 0;
    gameState.frontcourtEstablished = false;
    gameState.ballHandlerAdvanceTimer = 0;
    gameState.ballHandlerFrontcourtStartX = gameState.ballCarrier ? gameState.ballCarrier.x : 0;
    gameState.ballHandlerProgressOwner = gameState.ballCarrier || null;
    gameState.ballHandlerDeadForcedShot = false;
}

function isInBackcourt(player, teamName) {
    if (!player) return false;
    var midCourt = Math.floor(COURT_WIDTH / 2);
    if (teamName === "red") {
        return player.x < midCourt - 2;
    }
    return player.x > midCourt + 2;
}

function enforceBackcourtViolation(message) {
    var violatingTeam = gameState.currentTeam;
    if (gameState.ballCarrier) {
        recordTurnover(gameState.ballCarrier, message || "backcourt");
    }
    announceEvent("violation_backcourt", { team: violatingTeam });

    // Coordinator: Skip blocking wait
    if (!(mpCoordinator && mpCoordinator.isCoordinator)) {
        mswait(800);
    }

    resetBackcourtState();
    resetDeadDribbleTimer();
    clearPotentialAssist();
    if (violatingTeam === "red" || violatingTeam === "blue") {
        setupInbound(violatingTeam);
    } else {
        switchPossession();
        gameState.ballHandlerStuckTimer = 0;
        gameState.ballHandlerAdvanceTimer = 0;
        if (gameState.ballCarrier) {
            gameState.ballHandlerLastX = gameState.ballCarrier.x;
            gameState.ballHandlerLastY = gameState.ballCarrier.y;
            gameState.ballHandlerFrontcourtStartX = gameState.ballCarrier.x;
            gameState.ballHandlerProgressOwner = gameState.ballCarrier;
        }
    }
}

function enforceFiveSecondViolation() {
    var violatingTeam = gameState.currentTeam;
    if (gameState.ballCarrier) {
        recordTurnover(gameState.ballCarrier, "five_seconds");
    }
    announceEvent("violation_five_seconds", { team: violatingTeam });

    // Coordinator: Skip blocking wait
    if (!(mpCoordinator && mpCoordinator.isCoordinator)) {
        mswait(800);
    }

    resetDeadDribbleTimer();
    resetBackcourtState();
    clearPotentialAssist();
    if (violatingTeam === "red" || violatingTeam === "blue") {
        setupInbound(violatingTeam);
    } else {
        switchPossession();
        gameState.ballHandlerStuckTimer = 0;
        gameState.ballHandlerAdvanceTimer = 0;
    }
}

function primeInboundOffense(ballHandler, teammate, teamName) {
    if (ballHandler && ballHandler.playerData) {
        ballHandler.playerData.inboundBoostTimer = 14;
        if (!ballHandler.playerData.offBallPattern) {
            ballHandler.playerData.offBallPattern = { stage: "advance", timer: 0 };
        } else {
            ballHandler.playerData.offBallPattern.stage = "advance";
            ballHandler.playerData.offBallPattern.timer = 0;
        }
    }

    if (teammate && teammate.playerData) {
        if (!teammate.playerData.offBallPattern) {
            teammate.playerData.offBallPattern = { stage: "perimeter", timer: 0 };
        } else {
            teammate.playerData.offBallPattern.stage = "perimeter";
            teammate.playerData.offBallPattern.timer = 0;
        }
        teammate.playerData.inboundBoostTimer = 8;
    }

    gameState.frontcourtEstablished = false;
    gameState.backcourtTimer = 0;
    if (ballHandler) {
        gameState.ballHandlerLastX = ballHandler.x;
        gameState.ballHandlerLastY = ballHandler.y;
    }
}

// ============================================================================
// NEW AI SYSTEM - Helper Functions
// ============================================================================

// Get the offensive basket for a team
function getOffensiveBasket(teamName) {
    // Red attacks right (BASKET_RIGHT), Blue attacks left (BASKET_LEFT)
    return teamName === "red"
        ? { x: BASKET_RIGHT_X, y: BASKET_RIGHT_Y }
        : { x: BASKET_LEFT_X, y: BASKET_LEFT_Y };
}

// Get court spots for a team
function getTeamSpots(teamName) {
    return COURT_SPOTS[teamName];
}

function getCornerSpots(teamName) {
    var spots = getTeamSpots(teamName);
    if (!spots) return null;
    var candidates = [];
    if (spots.corner_low) candidates.push(spots.corner_low);
    if (spots.corner_high) candidates.push(spots.corner_high);
    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return a.y - b.y; });
    return {
        top: candidates[0],
        bottom: candidates[candidates.length - 1]
    };
}

function getCornerOpenScore(teamName, corner, player, teammate) {
    if (!corner) return -Infinity;
    var defenders = getOpposingTeam(teamName);
    var minDef = 25;
    for (var i = 0; i < defenders.length; i++) {
        var defender = defenders[i];
        if (!defender) continue;
        var dist = distanceBetweenPoints(corner.x, corner.y, defender.x, defender.y);
        if (dist < minDef) minDef = dist;
    }

    var travelCost = 0;
    if (player) {
        travelCost = distanceBetweenPoints(player.x, player.y, corner.x, corner.y) * 0.3;
    }

    var occupancyPenalty = 0;
    if (teammate) {
        var teammateDist = distanceBetweenPoints(teammate.x, teammate.y, corner.x, corner.y);
        if (teammateDist < 4) {
            occupancyPenalty = (4 - teammateDist) * 2;
        }
    }

    return minDef - travelCost - occupancyPenalty;
}

function selectBestCorner(teamName, player, avoidTeammate) {
    var corners = getCornerSpots(teamName);
    if (!corners) return null;
    var teammate = avoidTeammate ? getTeammate(player) : null;
    var bestCorner = null;
    var bestScore = -Infinity;
    var list = [];
    if (corners.top) list.push(corners.top);
    if (corners.bottom && corners.bottom !== corners.top) list.push(corners.bottom);
    for (var i = 0; i < list.length; i++) {
        var score = getCornerOpenScore(teamName, list[i], player, teammate);
        if (score > bestScore) {
            bestScore = score;
            bestCorner = list[i];
        }
    }
    return bestCorner;
}



// Check if player reached their target spot (within tolerance)
function hasReachedSpot(player, spot, tolerance) {
    if (!spot) return true;
    tolerance = tolerance || 2; // Default 2 units
    var dist = distanceBetweenPoints(player.x, player.y, spot.x, spot.y);
    return dist < tolerance;
}

// Simple steering movement toward a target point with obstacle avoidance
function steerToward(player, targetX, targetY, speed) {
    // Check if stunned from failed shove attempt
    if (player && player.playerData && player.playerData.shoveFailureStun > 0) {
        return; // Can't move during failure stun
    }

    var dx = targetX - player.x;
    var dy = targetY - player.y;
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) return; // Close enough

    var turboIntent = false;
    if (speed !== undefined && speed !== null) {
        turboIntent = speed >= (PLAYER_BASE_SPEED_PER_FRAME + 0.1);
    } else if (player.playerData && player.playerData.turboActive) {
        turboIntent = true;
    }

    var actualTurbo = false;
    if (player.playerData) {
        if (turboIntent && player.playerData.turbo > 0) {
            player.playerData.turboActive = true;
            actualTurbo = true;
            if (typeof player.playerData.useTurbo === "function") {
                player.playerData.useTurbo(TURBO_DRAIN_RATE);
            }
        } else {
            player.playerData.turboActive = false;
            actualTurbo = false;
        }
    }

    var budget = createMovementCounters(player, actualTurbo);
    var stepScale = 1;
    if (typeof speed === "number" && !isNaN(speed)) {
        stepScale = speed / 2;
        if (stepScale < 0.4) stepScale = 0.4;
        if (stepScale > 3) stepScale = 3;
    }

    var scaledMoves = Math.round(budget.moves * stepScale);
    if (scaledMoves <= 0) return;
    if (scaledMoves > 4) scaledMoves = 4;

    var counters = {
        horizontal: Math.max(0, Math.min(4, Math.round(budget.horizontal * stepScale))),
        vertical: Math.max(0, Math.min(4, Math.round(budget.vertical * stepScale)))
    };
    if (counters.horizontal === 0 && Math.abs(dx) > Math.abs(dy)) counters.horizontal = 1;
    if (counters.vertical === 0 && Math.abs(dy) >= Math.abs(dx)) counters.vertical = 1;

    for (var step = 0; step < scaledMoves; step++) {
        dx = targetX - player.x;
        dy = targetY - player.y;
        distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 1) break;

        var moveKey;
        if (Math.abs(dx) > Math.abs(dy)) {
            moveKey = dx < 0 ? KEY_LEFT : KEY_RIGHT;
            if (!applyMovementCommand(player, moveKey, counters)) {
                moveKey = dy < 0 ? KEY_UP : KEY_DOWN;
                if (!applyMovementCommand(player, moveKey, counters)) break;
            }
        } else {
            moveKey = dy < 0 ? KEY_UP : KEY_DOWN;
            if (!applyMovementCommand(player, moveKey, counters)) {
                moveKey = dx < 0 ? KEY_LEFT : KEY_RIGHT;
                if (!applyMovementCommand(player, moveKey, counters)) break;
            }
        }
    }
}

// Pick best off-ball spot for spacing
function pickOffBallSpot(player, ballCarrier, teamName) {
    var spots = getTeamSpots(teamName);
    var inBackcourt = isInBackcourt(ballCarrier, teamName);
    var corners = getCornerSpots(teamName);

    // PRIORITY 1: If ball carrier in backcourt, GO TO FRONTCOURT WING
    if (inBackcourt) {
        return (player === redPlayer2 || player === bluePlayer1)
            ? spots.left_wing
            : spots.right_wing;
    }

    if (corners) {
        var teammate = getTeammate(player);
        var ballTopHalf = ballCarrier.y < BASKET_LEFT_Y;
        var primary = ballTopHalf ? corners.bottom : corners.top;
        var secondary = ballTopHalf ? corners.top : corners.bottom;

        function occupied(corner) {
            if (!corner || !teammate) return false;
            return distanceBetweenPoints(teammate.x, teammate.y, corner.x, corner.y) < 3;
        }

        if (primary && !occupied(primary)) return primary;
        if (secondary && !occupied(secondary)) return secondary;

        var bestCorner = selectBestCorner(teamName, player, true);
        if (bestCorner) return bestCorner;
    }

    // Fallback to wing spacing
    if (ballCarrier.y < BASKET_LEFT_Y) {
        return spots.right_wing;
    }
    return spots.left_wing;
}

// Check if lane is open for drive
function isLaneOpen(player, teamName) {
    var basket = getOffensiveBasket(teamName);
    var defenders = getOpposingTeam(teamName);

    // Simple check: any defender within 8 units of straight line to basket?
    var dirX = basket.x - player.x;
    var dirY = basket.y - player.y;
    var len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len < 0.1) return true;

    dirX /= len;
    dirY /= len;

    // Check 8 units ahead
    var probeX = player.x + dirX * 8;
    var probeY = player.y + dirY * 8;

    for (var i = 0; i < defenders.length; i++) {
        var d = distanceBetweenPoints(defenders[i].x, defenders[i].y, probeX, probeY);
        if (d < 6) return false; // Defender blocking
    }

    return true;
}

// Get opposing team players
function getOpposingTeam(teamName) {
    return teamName === "red"
        ? [bluePlayer1, bluePlayer2]
        : [redPlayer1, redPlayer2];
}

// Get teammate
function getTeammate(player) {
    if (player === redPlayer1) return redPlayer2;
    if (player === redPlayer2) return redPlayer1;
    if (player === bluePlayer1) return bluePlayer2;
    if (player === bluePlayer2) return bluePlayer1;
    return null;
}

// Check if help defense is collapsing
function isHelpCollapsing(player, teamName) {
    var defenders = getOpposingTeam(teamName);
    var basket = getOffensiveBasket(teamName);

    // Check if both defenders are close to paint
    var closeCount = 0;
    for (var i = 0; i < defenders.length; i++) {
        var distToBasket = distanceBetweenPoints(defenders[i].x, defenders[i].y, basket.x, basket.y);
        if (distToBasket < 12) closeCount++;
    }

    return closeCount >= 2;
}

// Calculate shot quality for three-pointer
function calculateShotQuality(player, teamName) {
    var basket = getOffensiveBasket(teamName);
    var distToBasket = distanceBetweenPoints(player.x, player.y, basket.x, basket.y);
    var defenderDist = getClosestDefenderDistance(player, teamName);

    // Base quality from attributes
    var baseQuality = getEffectiveAttribute(player.playerData, ATTR_3PT) * 5; // 0-50

    // Bonus for being open
    var openBonus = Math.min(defenderDist * 2, 20); // 0-20

    // Penalty for being too far
    var distPenalty = Math.max(0, (distToBasket - 20) * 2); // Penalty if > 20 units

    var quality = baseQuality + openBonus - distPenalty;
    return Math.max(0, Math.min(100, quality)); // Clamp 0-100
}

// Get closest defender distance
function getClosestDefenderDistance(player, teamName) {
    var defenders = getOpposingTeam(teamName);
    var minDist = 999;

    for (var i = 0; i < defenders.length; i++) {
        var d = distanceBetweenPoints(player.x, player.y, defenders[i].x, defenders[i].y);
        if (d < minDist) minDist = d;
    }

    return minDist;
}

// ============================================================================
// NEW AI SYSTEM - FSM State Handlers
// ============================================================================

/**
 * NEW AI - Ball Carrier Offensive Logic
 * Based on design principles:
 * - Always advance ball (backcourt -> frontcourt -> basket)
 * - Use shot probability calculation with 40% threshold
 * - Avoid violations (10-sec backcourt, over-and-back, 24-sec shot clock)
 * - Smart passing with intent
 * - Proper turbo usage (direction + turbo + direction change)
 */
function handleAIBallCarrier(player, teamName) {
    var playerData = player.playerData;
    if (!playerData) return;

    // Setup court coordinates
    var targetBasketX = teamName === "red" ? BASKET_RIGHT_X : BASKET_LEFT_X;
    var targetBasketY = BASKET_LEFT_Y;
    var myBasketX = teamName === "red" ? BASKET_LEFT_X : BASKET_RIGHT_X;
    var attackDirection = teamName === "red" ? 1 : -1;

    // Get game situation
    var inBackcourt = isInBackcourt(player, teamName);
    var distanceToBasket = distanceBetweenPoints(player.x, player.y, targetBasketX, targetBasketY);
    var closestDefender = getClosestPlayer(player.x, player.y, teamName === "red" ? "blue" : "red");
    var defenderDist = closestDefender ? getSpriteDistance(player, closestDefender) : 999;
    var closestDefenderDistToBasket = closestDefender ? getSpriteDistanceToBasket(closestDefender, teamName) : 999;
    var teammate = getTeammate(player, teamName);

    // === AI SHOVE EVALUATION (Offensive) ===
    var shoveOpportunity = evaluateOffensiveShoveOpportunity(player, teamName);
    if (shoveOpportunity && Math.random() * 100 < shoveOpportunity.score) {
        attemptShove(player, shoveOpportunity.target);
        try {
            log(LOG_DEBUG, "AI offensive shove: " + shoveOpportunity.reason + " (score: " + shoveOpportunity.score + ")");
        } catch (e) { }
    }

    // TRANSITION OFFENSE - If I just got a rebound near my own basket, push it forward fast
    var myDistFromMyBasket = Math.abs(player.x - myBasketX);
    var courtMidX = Math.floor(COURT_WIDTH / 2);
    var nearMyOwnBasket = myDistFromMyBasket < 15; // Within 15 units of my own basket

    if (nearMyOwnBasket && inBackcourt) {
        // FAST BREAK - push the ball up court aggressively
        var pushTargetX = teamName === "red" ? courtMidX + 15 : courtMidX - 15;
        var pushTargetY = BASKET_LEFT_Y;

        // Always use turbo on fast break
        if (playerData.turbo > 10) {
            var fastBreakDist = distanceBetweenPoints(player.x, player.y, pushTargetX, pushTargetY);
            activateAITurbo(player, 0.8, fastBreakDist); // High turbo for fast break
        }

        moveAITowards(player, pushTargetX, pushTargetY);
        return;
    }

    // Check for trapped (2+ defenders nearby OR very close defender)
    var opponents = getOpposingTeamSprites(teamName);
    var nearbyDefenders = 0;
    for (var d = 0; d < opponents.length; d++) {
        if (!opponents[d]) continue;
        if (getSpriteDistance(player, opponents[d]) < DOUBLE_TEAM_RADIUS) {
            nearbyDefenders++;
        }
    }
    var isTrapped = nearbyDefenders >= 2 || defenderDist < 3;

    // Check if defender is playing too tight (exploitable for passing)
    var opponentTeam = teamName === "red" ? "blue" : "red";
    var defenderTooTight = isDefenderPlayingTooTight(player, opponentTeam);

    // === VIOLATION AVOIDANCE ===

    // 24-Second Shot Clock - FORCE SHOT if urgent
    if (gameState.shotClock <= SHOT_CLOCK_URGENT) {
        attemptShot();
        return;
    }

    // 10-Second Backcourt - increase urgency to advance
    var backcourtUrgent = inBackcourt && gameState.shotClock <= (24 - BACKCOURT_URGENT);

    // === PASS DECISION LOGIC ===

    if (teammate) {
        var teammateDistToBasket = distanceBetweenPoints(teammate.x, teammate.y, targetBasketX, targetBasketY);
        var teammateClosestDef = getClosestPlayer(teammate.x, teammate.y, teamName === "red" ? "blue" : "red");
        var teammateDefDist = teammateClosestDef ? getSpriteDistance(teammate, teammateClosestDef) : 999;

        // Check for over-and-back violation
        if (wouldBeOverAndBack(player, teammate, teamName)) {
            // Don't pass - would be violation
        } else {
            var shouldPass = false;
            var passIntent = "ADVANCE_BALL";

            // REASON 0: Defender playing too tight - EXPLOIT weak positioning!
            // When defender touches ball handler, their intercept ability drops 85%
            if (defenderTooTight && teammateDefDist > 3) {
                shouldPass = true;
                passIntent = "EXPLOIT_TIGHT_DEFENSE";
                try {
                    log(LOG_DEBUG, "AI exploiting tight defense with pass - defender touching ball handler!");
                } catch (e) { }
            }

            // REASON 1: Get out of jam (trapped)
            if (isTrapped && teammateDefDist > 5) {
                shouldPass = true;
                passIntent = "ESCAPE_JAM";
            }

            // REASON 2: Advance ball for better shot probability
            // BUT: Don't pass backwards in backcourt (unless trapped)
            var teammateInBackcourt = isInBackcourt(teammate, teamName);
            var wouldPassBackwards = (inBackcourt && teammateInBackcourt);

            if (!shouldPass && teammateDistToBasket < distanceToBasket - 3 && !wouldPassBackwards) {
                // Calculate teammate's shot probability
                var teammateShotProb = calculateShotProbability(teammate, targetBasketX, targetBasketY, teammateClosestDef);
                if (teammateShotProb > SHOT_PROBABILITY_THRESHOLD) {
                    shouldPass = true;
                    passIntent = "CATCH_AND_SHOOT";
                }
            }

            // REASON 3: Stuck for too long
            // In backcourt: ONLY pass if teammate is in frontcourt (to avoid lateral passing)
            // In frontcourt: Can pass to any open teammate
            if (!shouldPass && gameState.ballHandlerStuckTimer >= 3 && teammateDefDist > 5) {
                if (inBackcourt) {
                    // ONLY pass if teammate is in frontcourt - prevents lateral backcourt passes
                    if (!teammateInBackcourt) {
                        shouldPass = true;
                        passIntent = "ADVANCE_BALL";
                    }
                } else {
                    // In frontcourt - can pass freely
                    shouldPass = true;
                    passIntent = "ADVANCE_BALL";
                }
            }

            // REASON 4: Half-court offense has stalled (no forward progress)
            if (!shouldPass && !inBackcourt && gameState.ballHandlerAdvanceTimer >= 3 && teammateDefDist > 4) {
                shouldPass = true;
                passIntent = "RESET_OFFENSE";
            }

            // REASON 5: Dead dribble urgency - must move the ball
            if (!shouldPass && dribbleDead && deadElapsed > 2000 && teammateDefDist > 3) {
                if (!teammateInBackcourt || !inBackcourt) {
                    shouldPass = true;
                    passIntent = deadElapsed > 3500 ? "ESCAPE_JAM" : "ADVANCE_BALL";
                }
            }

            // REASON 6: Backcourt urgency - must advance
            if (!shouldPass && backcourtUrgent && !teammateInBackcourt) {
                shouldPass = true;
                passIntent = "ADVANCE_BALL";
            }

            if (shouldPass) {
                // Store pass intent for receiver
                if (!gameState.passIntent) gameState.passIntent = {};
                gameState.passIntent[getPlayerKey(teammate)] = passIntent;

                var leadTarget = null;
                if (dribbleDead && teammate && teammate.playerData && teammate.playerData.emergencyCut) {
                    leadTarget = teammate.playerData.emergencyCut.leadTarget || teammate.playerData.aiTargetSpot;
                }
                animatePass(player, teammate, leadTarget);
                return;
            }
        }
    }

    if (playerData.hasDribble !== false && (isTrapped || gameState.ballHandlerStuckTimer >= 4) && !player.isHuman) {
        var pressRisk = closestDefender && (closestDefenderDistToBasket > distToBasket + 1.5);
        if (!pressRisk || distToBasket < 10) {
            pickUpDribble(player, "ai");
        }
    }

    if (playerData.hasDribble === false && playerData.shakeCooldown <= 0) {
        var closeDefenders = getTouchingOpponents(player, teamName, 2.75);
        if (closeDefenders.length || isTrapped || gameState.ballHandlerStuckTimer >= 2) {
            var shakeWon = attemptShake(player);
            if (shakeWon) {
                if (handlePostShakeDecision(player, teamName)) {
                    return;
                }
                if (playerData.hasDribble) {
                    return;
                }
            }
        }
    }

    // === SHOOT DECISION LOGIC ===

    // Calculate my shot probability
    var myShotProb = calculateShotProbability(player, targetBasketX, targetBasketY, closestDefender);

    // Don't shoot from backcourt (unless shot clock desperate)
    if (inBackcourt && gameState.shotClock > SHOT_CLOCK_URGENT) {
        myShotProb = 0;
    }

    var shouldShoot = false;

    // If my shot probability > threshold: SHOOT
    if (myShotProb > SHOT_PROBABILITY_THRESHOLD) {
        shouldShoot = true;
    }
    // Else if shot clock winding down: SHOOT anyway
    else if (gameState.shotClock <= 6 && myShotProb > 20) {
        shouldShoot = true;
    }

    if (shouldShoot) {
        attemptShot();
        return;
    }

    // === DRIVE / ADVANCE LOGIC ===

    // Goal: Get closer to basket for better shot
    var driveTargetX;
    var driveTargetY;
    var needTurbo = false;

    if (inBackcourt) {
        // MUST advance to frontcourt - ALWAYS aggressive
        var courtMidX = Math.floor(COURT_WIDTH / 2);
        driveTargetX = teamName === "red" ? courtMidX + 10 : courtMidX - 10;
        driveTargetY = BASKET_LEFT_Y;

        // ALWAYS use turbo in backcourt to avoid 10-sec violation
        needTurbo = true;

        // Make diagonal/L-cuts if defender blocking OR stuck
        if (defenderDist < 5 || gameState.ballHandlerStuckTimer >= 1) {
            var cutAngle = Math.random() < 0.5 ? 1 : -1;
            // Try to go around defender with aggressive cut
            driveTargetX = clampToCourtX(player.x + attackDirection * 10);
            driveTargetY = clampToCourtY(player.y + cutAngle * 6);
        }

        // Force turbo in backcourt - bypass distance check
        if (playerData.turbo > 5) {
            activateAITurbo(player, 0.8, 999); // Pass 999 to bypass distance check
        }
        // Skip the normal turbo logic below since we already activated it
        needTurbo = false;
    } else {
        // In frontcourt - drive toward basket

        // Check if we have room to run (Fast Dunker logic)
        var hasRoomToRun = defenderDist > 6;

        if (hasRoomToRun && distanceToBasket > 8) {
            // Drive toward basket - keep going until we hit something
            driveTargetX = clampToCourtX(targetBasketX - attackDirection * 4);
            driveTargetY = targetBasketY;

            // Use turbo for aggressive drive
            if (getEffectiveAttribute(playerData, ATTR_SPEED) >= 7 || getEffectiveAttribute(playerData, ATTR_DUNK) >= 7) {
                needTurbo = true;
            }
        } else if (defenderDist < 5) {
            // Defender in my way - make cut to get open
            var cutAngle = Math.random() < 0.5 ? 1 : -1;
            driveTargetX = clampToCourtX(player.x + attackDirection * 6);
            driveTargetY = clampToCourtY(player.y + cutAngle * 5);
            needTurbo = true;
        } else {
            // Move toward basket
            driveTargetX = clampToCourtX(targetBasketX - attackDirection * 8);
            driveTargetY = targetBasketY;
        }
    }

    // Apply turbo if needed and available (for frontcourt movement)
    // Lower threshold so they don't stop moving when turbo is low
    if (needTurbo && playerData.turbo > 5) {
        var driveDistance = distanceBetweenPoints(player.x, player.y, driveTargetX, driveTargetY);
        activateAITurbo(player, 0.6, driveDistance);
    }

    // Move toward target even without turbo
    moveAITowards(player, driveTargetX, driveTargetY);

}

/**
 * NEW AI - Off-Ball Offensive Movement
 * Based on design principles:
 * - Always be moving when not in good position
 * - Cut to paint, rotate perimeter, maintain spacing
 * - Get open for teammate when stuck
 * - Don't bunch up with ball handler
 */
function handleAIOffBallOffense(player, teamName) {
    var ballCarrier = gameState.ballCarrier;
    if (!ballCarrier) return;

    var playerData = player.playerData;
    if (!playerData) return;

    // Setup
    var targetBasketX = teamName === "red" ? BASKET_RIGHT_X : BASKET_LEFT_X;
    var attackDirection = teamName === "red" ? 1 : -1;
    var courtMidX = Math.floor(COURT_WIDTH / 2);

    // === AI SHOVE EVALUATION (Offensive) ===
    var shoveOpportunity = evaluateOffensiveShoveOpportunity(player, teamName);
    if (shoveOpportunity && Math.random() * 100 < shoveOpportunity.score) {
        attemptShove(player, shoveOpportunity.target);
        try {
            log(LOG_DEBUG, "AI off-ball offensive shove: " + shoveOpportunity.reason + " (score: " + shoveOpportunity.score + ")");
        } catch (e) { }
    }

    // Check positions
    var inBackcourt = isInBackcourt(player, teamName);
    var ballCarrierInBackcourt = isInBackcourt(ballCarrier, teamName);
    var myDistToBasket = Math.abs(player.x - targetBasketX);
    var ballCarrierDistToBasket = Math.abs(ballCarrier.x - targetBasketX);
    var distToBallCarrier = getSpriteDistance(player, ballCarrier);

    // Am I ahead of ball carrier (closer to basket)?
    var amAhead = myDistToBasket < ballCarrierDistToBasket - 4;

    // Check my defender
    var myDefender = getClosestPlayer(player.x, player.y, teamName === "red" ? "blue" : "red");
    var myDefDist = myDefender ? getSpriteDistance(player, myDefender) : 999;

    // Check if ball carrier is on fast break (near their own basket in backcourt)
    var myBasketX = teamName === "red" ? BASKET_LEFT_X : BASKET_RIGHT_X;
    var ballCarrierDistFromOwnBasket = Math.abs(ballCarrier.x - myBasketX);
    var ballCarrierOnFastBreak = ballCarrierInBackcourt && ballCarrierDistFromOwnBasket < 15;

    // Conditions
    var ballHandlerStuck = gameState.ballHandlerStuckTimer >= 3;
    var bunchedUp = distToBallCarrier < 6;
    var defenderOnTopOfMe = myDefDist < 4 && myDefender && Math.abs(myDefender.x - targetBasketX) > Math.abs(player.x - targetBasketX);
    var shotClockUrgent = gameState.shotClock <= 6;

    var laneOpportunity = null;
    if (!inBackcourt || ballHandlerStuck) {
        laneOpportunity = findOpenPassingLaneTarget(player, ballCarrier, teamName, myDefender);
    }

    var momentumCutDecision = evaluateMomentumCutPlan(player, teamName, attackDirection, {
        inBackcourt: inBackcourt,
        ballCarrierInBackcourt: ballCarrierInBackcourt,
        amAhead: amAhead,
        defender: myDefender,
        ballHandlerStuck: ballHandlerStuck,
        bunchedUp: bunchedUp
    });

    var targetX;
    var targetY;
    var needTurbo = false;

    // PRIORITY 0: FAST BREAK - Ball carrier pushing, I need to run ahead
    if (ballCarrierOnFastBreak) {
        // Sprint to scoring position ahead of ball carrier
        targetX = clampToCourtX(targetBasketX - attackDirection * 8);
        targetY = BASKET_LEFT_Y;
        needTurbo = true;
        // Use max turbo for fast break
        if (playerData.turbo > 5) {
            activateAITurbo(player, 0.9, 999); // Pass 999 to bypass distance check
        }
    }
    // PRIORITY 1: If in backcourt, GET TO FRONTCOURT AHEAD OF BALL CARRIER
    // Off-ball player should ALWAYS be ahead (closer to basket) than ball carrier
    // CRITICAL: Must get deep to avoid both players being stuck in backcourt together
    else if (inBackcourt) {
        // ALWAYS target WAY ahead - don't just cross midcourt, get to the scoring area
        // This prevents both players bunching up in backcourt passing laterally
        targetX = clampToCourtX(targetBasketX - attackDirection * 10);
        targetY = BASKET_LEFT_Y;
        needTurbo = true;
        // Force turbo regardless of distance check - MUST get out of backcourt fast
        if (playerData.turbo > 5) {
            activateAITurbo(player, 0.8, 999); // Pass 999 to bypass distance check
        }
        // Skip normal turbo logic - already activated
        needTurbo = false;
    }
    // PRIORITY 1b: Ball carrier in backcourt, I'm in frontcourt - still get AHEAD
    else if (ballCarrierInBackcourt && !amAhead) {
        // Position WAY ahead of ball carrier to avoid lateral passes
        targetX = clampToCourtX(targetBasketX - attackDirection * 5);
        targetY = BASKET_LEFT_Y;
        needTurbo = true;
    }
    // PRIORITY 2: Ball handler stuck - GET OPEN
    else if (momentumCutDecision) {
        targetX = clampToCourtX(momentumCutDecision.x);
        targetY = clampToCourtY(momentumCutDecision.y);
        needTurbo = !!momentumCutDecision.turbo;
    }
    // PRIORITY 2: Ball handler stuck - GET OPEN
    else if (ballHandlerStuck && myDefDist > 5) {
        if (laneOpportunity) {
            targetX = laneOpportunity.x;
            targetY = laneOpportunity.y;
            needTurbo = laneOpportunity.distance > 1.5;
        } else {
            // Cut toward basket to get open
            targetX = clampToCourtX(targetBasketX - attackDirection * 6);
            targetY = BASKET_LEFT_Y;
            needTurbo = true;
        }
    }
    // PRIORITY 3: Bunched up with ball carrier - CREATE SPACE
    else if (bunchedUp) {
        if (laneOpportunity) {
            targetX = laneOpportunity.x;
            targetY = laneOpportunity.y;
            needTurbo = laneOpportunity.distance > 1.5;
        } else {
            // Move away from ball carrier
            var awayDirection = player.y < ballCarrier.y ? -1 : 1;
            targetX = clampToCourtX(targetBasketX - attackDirection * 12);
            targetY = clampToCourtY(BASKET_LEFT_Y + awayDirection * 6);
        }
    }
    // PRIORITY 4: Defender right on top of me - SLASH/CUT
    else if (defenderOnTopOfMe) {
        // Cut to paint or rotate perimeter (alternate)
        if (!playerData.offBallCutTimer) playerData.offBallCutTimer = 0;
        playerData.offBallCutTimer++;

        if (playerData.offBallCutTimer % 60 < 30) {
            // Cut to paint
            targetX = clampToCourtX(targetBasketX - attackDirection * 5);
            targetY = BASKET_LEFT_Y;
            needTurbo = true;
        } else {
            // Rotate to perimeter
            var perimeterSide = player.y < BASKET_LEFT_Y ? -1 : 1;
            targetX = clampToCourtX(targetBasketX - attackDirection * 15);
            targetY = clampToCourtY(BASKET_LEFT_Y + perimeterSide * 5);
        }
    }
    // PRIORITY 5: Find an open passing lane
    else if (laneOpportunity) {
        targetX = laneOpportunity.x;
        targetY = laneOpportunity.y;
        needTurbo = laneOpportunity.distance > 1.5;
    }
    // PRIORITY 6: Shot clock urgent and I'm not ahead - CUT TO BASKET
    else if (shotClockUrgent && !amAhead) {
        targetX = clampToCourtX(targetBasketX - attackDirection * 5);
        targetY = BASKET_LEFT_Y;
        needTurbo = true;
    }
    // DEFAULT: Position ahead of ball carrier for pass option
    else if (!amAhead) {
        // Get downcourt in front of ball carrier
        targetX = clampToCourtX(ballCarrier.x + attackDirection * 10);
        targetY = BASKET_LEFT_Y;
        needTurbo = true;
    }
    // FALLBACK: Find spot on perimeter
    else {
        var laneOffset = (player === redPlayer2 || player === bluePlayer2) ? 5 : -5;
        targetX = clampToCourtX(targetBasketX - attackDirection * 12);
        targetY = clampToCourtY(BASKET_LEFT_Y + laneOffset);
    }

    // Apply turbo if needed and available (for frontcourt movement)
    // Lower threshold so they keep moving even with low turbo
    if (needTurbo && playerData.turbo > 5) {
        var distanceToTarget = distanceBetweenPoints(player.x, player.y, targetX, targetY);
        activateAITurbo(player, 0.5, distanceToTarget);
    }

    // Move toward target even without turbo
    moveAITowards(player, targetX, targetY);
}

/**
 * NEW AI - Defensive Logic
 * Based on design principles:
 * - Man-to-Man defense (default)
 * - Position between man and basket
 * - React with delay based on speed + steal attributes
 * - Double team when offensive player close to both defenders
 * - Switch when closer to other offensive player
 * - Recover with turbo when beaten
 * - Perimeter limits (don't guard past 3-point line unless they're a shooter)
 */
function handleAIDefense(player, teamName) {
    var ballCarrier = gameState.ballCarrier;
    if (!ballCarrier) return;

    var playerData = player.playerData;
    if (!playerData) return;

    var myBasketX = teamName === "red" ? BASKET_LEFT_X : BASKET_RIGHT_X;
    var opponentBasketX = teamName === "red" ? BASKET_RIGHT_X : BASKET_LEFT_X;

    // === AI SHOVE EVALUATION (Defensive) ===
    var shoveOpportunity = evaluateDefensiveShoveOpportunity(player, teamName);
    if (shoveOpportunity && Math.random() * 100 < shoveOpportunity.score) {
        attemptShove(player, shoveOpportunity.target);
        try {
            log(LOG_DEBUG, "AI defensive shove: " + shoveOpportunity.reason + " (score: " + shoveOpportunity.score + ")");
        } catch (e) { }
    }

    // TRANSITION DEFENSE - If I'm way out of position (near opponent's basket), sprint back
    var myDistFromMyBasket = Math.abs(player.x - myBasketX);
    var myDistFromOpponentBasket = Math.abs(player.x - opponentBasketX);
    var courtMidX = Math.floor(COURT_WIDTH / 2);

    // If I'm closer to opponent's basket than my own OR in opponent's backcourt, sprint back
    var inOpponentBackcourt = (teamName === "red" && player.x > courtMidX + 10) ||
        (teamName === "blue" && player.x < courtMidX - 10);

    if (inOpponentBackcourt || myDistFromOpponentBasket < myDistFromMyBasket) {
        // SPRINT BACK TO DEFENSE with turbo
        var getBackX = teamName === "red" ? courtMidX - 10 : courtMidX + 10;
        var getBackY = BASKET_LEFT_Y;

        if (playerData.turbo > 10) {
            var transitionDist = distanceBetweenPoints(player.x, player.y, getBackX, getBackY);
            activateAITurbo(player, 0.7, transitionDist); // High turbo usage for transition
        }

        moveAITowards(player, getBackX, getBackY);
        return;
    }

    // Special case: Crash boards for rebound when shot in progress
    if (gameState.shotInProgress) {
        var rimX = myBasketX;
        var crashX = clampToCourtX(rimX + (teamName === "red" ? 4 : -4));
        var crashY = clampToCourtY(BASKET_LEFT_Y);
        if (playerData.turbo > 10) {
            var crashDistance = distanceBetweenPoints(player.x, player.y, crashX, crashY);
            activateAITurbo(player, 0.4, crashDistance);
        }
        moveAITowards(player, crashX, crashY);
        return;
    }

    // Get all offensive players
    var offensivePlayers = getOpposingTeamSprites(gameState.currentTeam);
    if (!offensivePlayers || offensivePlayers.length < 2) return;

    var offPlayer1 = offensivePlayers[0];
    var offPlayer2 = offensivePlayers[1];
    if (!offPlayer1 || !offPlayer2) return;

    // Get my defensive teammate
    var teammate = getTeammate(player, teamName);
    if (!teammate) return;

    // === ZONE DEFENSE MODE (when both defenders shoved) ===
    if (playerData.playZoneDefense && playerData.playZoneDefense > 0) {
        playerData.playZoneDefense--; // Countdown zone defense timer

        // Simple zone: each defender covers half the court
        var courtMidX = Math.floor(COURT_WIDTH / 2);
        var leftZone = teamName === "red";

        // Ball carrier in my zone? Guard them. Otherwise, patrol zone.
        var ballCarrierInMyZone = leftZone ? (ballCarrier.x < courtMidX) : (ballCarrier.x >= courtMidX);

        if (ballCarrierInMyZone) {
            // Guard ball carrier in my zone
            var interceptX = clampToCourtX(ballCarrier.x - (teamName === "red" ? 2 : -2));
            var interceptY = clampToCourtY(ballCarrier.y);
            moveAITowards(player, interceptX, interceptY);
        } else {
            // Patrol my zone near basket
            var patrolX = leftZone ? (myBasketX + 8) : (myBasketX - 8);
            var patrolY = BASKET_LEFT_Y;
            moveAITowards(player, patrolX, patrolY);
        }
        return;
    }

    // === INITIAL DEFENSIVE ASSIGNMENT (closest player) ===
    var playerKey = getPlayerKey(player);
    if (!gameState.defensiveAssignments) {
        gameState.defensiveAssignments = {};
    }

    // Assign based on closest offensive player if not yet assigned
    if (!gameState.defensiveAssignments[playerKey]) {
        var distToOff1 = getSpriteDistance(player, offPlayer1);
        var distToOff2 = getSpriteDistance(player, offPlayer2);
        gameState.defensiveAssignments[playerKey] = distToOff1 < distToOff2 ? offPlayer1 : offPlayer2;
    }

    var myMan = gameState.defensiveAssignments[playerKey];
    var distToMyMan = getSpriteDistance(player, myMan);

    // === SWITCH LOGIC ===
    // If I'm closer to the OTHER offensive player AND my teammate has my man covered
    var otherOffensivePlayer = (myMan === offPlayer1) ? offPlayer2 : offPlayer1;
    var distToOtherOffPlayer = getSpriteDistance(player, otherOffensivePlayer);
    var teammateKey = getPlayerKey(teammate);
    var teammateMan = gameState.defensiveAssignments[teammateKey];

    if (distToOtherOffPlayer < distToMyMan - 5 && teammateMan === myMan) {
        // SWITCH - swap assignments
        gameState.defensiveAssignments[playerKey] = otherOffensivePlayer;
        gameState.defensiveAssignments[teammateKey] = myMan;
        myMan = otherOffensivePlayer;
        distToMyMan = distToOtherOffPlayer;
        resetPlayerDefenseMomentum(player);
        resetPlayerDefenseMomentum(teammate);
    }

    // === DOUBLE TEAM LOGIC ===
    // Check if both defenders are close to one offensive player
    var distToBallCarrier = getSpriteDistance(player, ballCarrier);
    var teammateDistToBallCarrier = getSpriteDistance(teammate, ballCarrier);
    var shouldDoubleTeam = (distToBallCarrier < DOUBLE_TEAM_RADIUS && teammateDistToBallCarrier < DOUBLE_TEAM_RADIUS);

    if (shouldDoubleTeam) {
        // Both defenders converge on ball carrier
        myMan = ballCarrier;
        distToMyMan = distToBallCarrier;
        resetPlayerDefenseMomentum(player);
        resetPlayerDefenseMomentum(teammate);
    }

    // === MAN-TO-MAN POSITIONING ===

    var myManDistToMyBasket = Math.abs(myMan.x - myBasketX);
    var myDistToMyBasket = Math.abs(player.x - myBasketX);

    // Check perimeter limit - don't chase too far from basket unless they're a shooter
    var atPerimeterLimit = myManDistToMyBasket > DEFENDER_PERIMETER_LIMIT;
    var shouldSagOff = false;

    if (atPerimeterLimit && myMan.playerData) {
        var threePointSkill = getBaseAttribute(myMan.playerData, ATTR_3PT);
        if (threePointSkill < 7) {
            // Not a good shooter at perimeter - sag off (but still maintain position)
            shouldSagOff = true;
        }
    }

    // Position myself between my man and basket
    // Check if I'm on the correct side (between man and basket)
    var myXFromBasket = Math.abs(player.x - myBasketX);
    var myManXFromBasket = Math.abs(myMan.x - myBasketX);
    var amBetweenManAndBasket = myXFromBasket < myManXFromBasket;

    var targetX;
    var targetY;
    var needTurbo = false;

    // Guard tighter as they get closer to basket
    var tightDefense = myManDistToMyBasket < DEFENDER_TIGHT_RANGE;

    // If I'm BEHIND my man (beaten) OR too far to side - RECOVER
    if (!amBetweenManAndBasket) {
        // I'm behind - sprint to cutoff position between man and basket
        // Position myself 30-40% toward basket from my man
        var cutoffPercent = tightDefense ? 0.4 : 0.3;
        targetX = myMan.x + (myBasketX - myMan.x) * cutoffPercent;
        targetY = myMan.y;
        needTurbo = true; // MUST use turbo to recover
    }
    // Else I'm between man and basket - maintain position
    else {
        var defensePercent;

        if (shouldSagOff) {
            // At perimeter with non-shooter - sag off more, but still between man and basket
            defensePercent = 0.4;
        } else if (tightDefense) {
            // Tight defense - position between them and basket (not ON them)
            defensePercent = 0.15;
        } else {
            // Moderate defense - give a bit more space
            defensePercent = 0.1;
        }

        // Stay between them and basket
        targetX = myMan.x + (myBasketX - myMan.x) * defensePercent;
        targetY = myMan.y;

        // Use turbo if they're driving toward basket and I need to keep up
        if (myMan === ballCarrier && myManDistToMyBasket < 20 && distToMyMan > 4 && !shouldSagOff) {
            needTurbo = true;
        }
    }

    // Apply turbo if needed
    var fullPress = myManDistToMyBasket > DEFENDER_PERIMETER_LIMIT;
    if (needTurbo && playerData.turbo > 10 && !fullPress) {
        var defDistance = distanceBetweenPoints(player.x, player.y, targetX, targetY);
        activateAITurbo(player, 0.6, defDistance);
        applyDefenderMomentum(player, targetX, targetY, 0.6, true);
    } else {
        var speedAttr = getEffectiveAttribute(playerData, ATTR_SPEED);
        var stealAttr = getEffectiveAttribute(playerData, ATTR_STEAL);
        var responsiveness = 0.18 + (speedAttr * 0.035) + (stealAttr * 0.025);
        if (shouldSagOff) responsiveness -= 0.06;
        if (!amBetweenManAndBasket) responsiveness += 0.08;
        if (myManDistToMyBasket > DEFENDER_PERIMETER_LIMIT + 4) responsiveness -= 0.05;
        var momentumPos = applyDefenderMomentum(player, targetX, targetY, responsiveness, false);
        targetX = momentumPos.x;
        targetY = momentumPos.y;
    }

    moveAITowards(player, targetX, targetY);

    // === DEFENSIVE ACTIONS ===

    // STEAL/SHOVE - attempt if guarding ball carrier and close
    if (myMan === ballCarrier && distToMyMan < 5) {
        var stealAttr = getEffectiveAttribute(playerData, ATTR_STEAL);
        var powerAttr = getEffectiveAttribute(playerData, ATTR_POWER);
        var stealChance = STEAL_BASE_CHANCE * (stealAttr / 5); // Higher steal = more attempts
        var shoveChance = 0.35 * (powerAttr / 5); // Increased from 0.15 to match off-ball shoving frequency

        if (ballCarrier.playerData && ballCarrier.playerData.hasDribble === false) {
            // Dribble picked up - prefer shove (easier)
            attemptShove(player);
        } else {
            // Active dribble - balance between steal and shove
            if (myManDistToMyBasket > DEFENDER_PERIMETER_LIMIT) {
                stealChance *= 0.4;
            }

            // Decide between steal and shove (increased shove distance from 3 to 4.0)
            var actionRoll = Math.random();
            if (actionRoll < shoveChance && distToMyMan < 4.0) {
                // Close enough and power-focused - attempt shove even during dribbling
                attemptShove(player);
            } else if (actionRoll < stealChance + shoveChance) {
                // Steal attempt
                attemptAISteal(player, ballCarrier);
            }
        }
    }

    // BLOCK - attempt when shooter is shooting (handled in autoContestShot function)
}

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

function showHalftimeScreen() {
    gameState.isHalftime = true;

    // MULTIPLAYER: Broadcast halftime event to all clients
    if (mpCoordinator && mpCoordinator.isCoordinator) {
        mpCoordinator.broadcastGameState({
            type: 'halftime_start',
            currentHalf: gameState.currentHalf,
            redScore: gameState.score.red,
            blueScore: gameState.score.blue,
            timeRemaining: gameState.timeRemaining,
            timestamp: Date.now()
        });
    }

    positionSpritesForBoxScore();
    courtFrame.clear();
    courtFrame.gotoxy(1, 1);

    var redName = gameState.teamNames.red;
    var blueName = gameState.teamNames.blue;
    var redColorCode = gameState.teamColors.red.fg_accent_code || gameState.teamColors.red.fg_code || "\1h\1w";
    var blueColorCode = gameState.teamColors.blue.fg_accent_code || gameState.teamColors.blue.fg_code || "\1h\1w";
    var whiteCode = "\1h\1w";

    courtFrame.center("\r\n\r\n");
    courtFrame.center("\1h\1y HALFTIME \1n\r\n\r\n");

    // Show current score
    courtFrame.center(
        whiteCode + "Halftime Score: " +
        redColorCode + redName + " " + gameState.score.red +
        whiteCode + " - " +
        blueColorCode + blueName + " " + gameState.score.blue +
        "\1n\r\n\r\n"
    );

    // Show halftime stats
    renderTeamBoxScore("red", redName, { halftime: true });
    courtFrame.center("\r\n");
    renderTeamBoxScore("blue", blueName, { halftime: true });

    courtFrame.center("\r\n\1h[S]\1n Substitutions  \1h[SPACE]\1n Continue to 2nd Half\r\n");

    if (typeof Sprite !== "undefined" && typeof Sprite.cycle === "function") {
        Sprite.cycle();
    }
    cycleFrame(courtFrame);

    // Wait for user input (auto-advance for CPU-only games)
    var halftimeStart = Date.now();
    var autoAdvance = !!gameState.allCPUMode;
    while (true) {
        var key = console.inkey(K_NONE, 100);

        if (key && key.length > 0) {
            var keyUpper = key.toUpperCase();
            if (keyUpper === 'S') {
                // Show substitution screen
                if (showSubstitutionScreen()) {
                    break; // User made substitutions and wants to continue
                }
            } else if (key === ' ') {
                break; // Continue to second half
            } else if (keyUpper === 'Q') {
                gameState.gameRunning = false;
                return;
            }
        } else if (autoAdvance && (Date.now() - halftimeStart) >= 10000) {
            break; // Auto-continue for CPU games after 10 seconds
        }
    }

    // Prepare for second half
    gameState.isHalftime = false;
    // Don't reset timeRemaining - let it continue counting down from current time

    gameState.pendingSecondHalfInbound = true;
    gameState.secondHalfInitDone = false;

    // CPU substitutions (simple random)
    performCPUSubstitutions();

    announceEvent("tipoff", {
        teamA: (gameState.teamNames.red || "RED").toUpperCase(),
        teamB: (gameState.teamNames.blue || "BLUE").toUpperCase(),
        team: gameState.currentTeam
    });

    // Coordinator: Skip blocking wait
    if (!(mpCoordinator && mpCoordinator.isCoordinator)) {
        mswait(1500);
    }
}

function renderHalftimeStats(teamKey) {
    var players = teamKey === "red" ? getRedTeam() : getBlueTeam();
    var teamColorInfo = gameState.teamColors[teamKey] || {};
    var jerseyColor = teamColorInfo.fg_code || "\1h\1w";
    var whiteCode = "\1h\1w";

    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        if (!player || !player.playerData) continue;

        var data = player.playerData;
        var stats = data.stats || {};
        var name = getLastName(data.name || "");
        var nameDisplay = jerseyColor + "#" + data.jersey + " " + name + whiteCode;

        var statLine = nameDisplay + ": " + (stats.points || 0) + "pts, " +
            (stats.assists || 0) + "ast, " + (stats.rebounds || 0) + "reb";

        courtFrame.center(statLine + "\1n\r\n");
    }
}

function showSubstitutionScreen() {
    // For now, just show a simple message - player substitution coming in future enhancement
    courtFrame.clear();
    courtFrame.center("\r\n\r\n\r\n");
    courtFrame.center("\1h\1y SUBSTITUTIONS \1n\r\n\r\n");
    courtFrame.center("Player substitutions will be available\r\n");
    courtFrame.center("in a future update!\r\n\r\n");
    courtFrame.center("\1h[SPACE]\1n Continue to 2nd Half\r\n");
    cycleFrame(courtFrame);

    while (true) {
        var key = console.getkey();
        if (key === ' ') {
            return true;
        } else if (key.toUpperCase() === 'Q') {
            gameState.gameRunning = false;
            return false;
        }
    }
}

function performCPUSubstitutions() {
    // Simple CPU substitution logic - randomly substitute players with low performance
    var blueTeam = getBlueTeam();
    for (var i = 0; i < blueTeam.length; i++) {
        var player = blueTeam[i];
        if (player && player.playerData && player.playerData.stats) {
            var stats = player.playerData.stats;
            var performance = (stats.points || 0) + (stats.assists || 0) + (stats.rebounds || 0);

            // 30% chance to substitute if performance is low
            if (performance < 5 && Math.random() < 0.3) {
                // For now, just reset their turbo (simulation of fresh legs)
                player.playerData.turbo = MAX_TURBO;
                player.playerData.heatStreak = 0;
                player.playerData.fireMakeStreak = 0;
            }
        }
    }
}

/**
 * Unified violation checking logic
 * Extracted from duplicate code in single-player and multiplayer loops
 * Returns true if a violation was triggered this frame
 */
function checkViolations(violationTriggeredThisFrame) {
    // Backcourt violation checks
    if (gameState.ballCarrier && !gameState.inbounding) {
        // DEFENSIVE FIX: Verify ballCarrier is on the current team
        var carrierTeam = getPlayerTeamName(gameState.ballCarrier);
        if (carrierTeam !== gameState.currentTeam) {
            // Data corruption - ballCarrier points to wrong team
            log(LOG_WARNING, "NBA JAM: ballCarrier team mismatch in checkViolations! " +
                "currentTeam=" + gameState.currentTeam + " but carrier is on " + carrierTeam);
            // Reset ballCarrier to prevent false violation
            gameState.ballCarrier = null;
            return violationTriggeredThisFrame;
        }

        var inBackcourt = isInBackcourt(gameState.ballCarrier, gameState.currentTeam);
        if (!gameState.frontcourtEstablished) {
            if (!inBackcourt && gameState.inboundGracePeriod === 0) {
                // Only establish frontcourt after grace period expires
                setFrontcourtEstablished(gameState.currentTeam);
                gameState.backcourtTimer = 0;
            } else {
                // Check if player is near half court line (within 6 pixels)
                var midCourt = Math.floor(COURT_WIDTH / 2);
                var distanceToMidcourt = Math.abs(gameState.ballCarrier.x - midCourt);
                var nearHalfCourt = distanceToMidcourt < 6;

                gameState.backcourtTimer++;

                // Increased from 200 to 210 frames (adds 500ms buffer for network latency)
                // Also pause timer increment if player is near half court line
                if (gameState.backcourtTimer >= 210 && !nearHalfCourt) {  // 10.5 seconds at 20 FPS
                    enforceBackcourtViolation("10-SECOND BACKCOURT VIOLATION!");
                    violationTriggeredThisFrame = true;
                } else if (nearHalfCourt && gameState.backcourtTimer >= 205) {
                    // Near half court - cap timer at 205 frames to give grace period
                    gameState.backcourtTimer = 205;
                }
            }
        } else if (inBackcourt) {
            // Check grace period before enforcing violation
            if (gameState.inboundGracePeriod > 0) {
                gameState.inboundGracePeriod--;
            } else {
                enforceBackcourtViolation("OVER AND BACK!");
                violationTriggeredThisFrame = true;
            }
        }
    } else if (!gameState.inbounding) {
        gameState.backcourtTimer = 0;
    }

    return violationTriggeredThisFrame;
}

function gameLoop() {
    gameState.gameRunning = true;
    clearPotentialAssist();
    var lastUpdate = Date.now();
    var lastSecond = Date.now();
    var lastAI = Date.now();
    var tempo = getSinglePlayerTempo();
    var frameDelay = tempo.frameDelayMs;
    var aiInterval = tempo.aiIntervalMs;

    // Initial draw
    drawCourt();
    drawScore();
    announceEvent("game_start", {
        teamA: (gameState.teamNames.red || "RED").toUpperCase(),
        teamB: (gameState.teamNames.blue || "BLUE").toUpperCase()
    });

    while (gameState.gameRunning && gameState.timeRemaining > 0) {
        var now = Date.now();
        var violationTriggeredThisFrame = false;
        gameState.tickCounter = (gameState.tickCounter + 1) % 1000000;

        var recoveryList = getAllPlayers();
        for (var r = 0; r < recoveryList.length; r++) {
            decrementStealRecovery(recoveryList[r]);
        }

        // Update timer
        if (now - lastSecond >= 1000) {
            gameState.timeRemaining--;
            gameState.shotClock--;
            lastSecond = now;

            // Check for halftime (when first half time expires)
            if (gameState.currentHalf === 1 && gameState.timeRemaining <= gameState.totalGameTime / 2) {
                gameState.currentHalf = 2;
                showHalftimeScreen();
                if (!gameState.gameRunning) break; // User quit during halftime

                // Reset for second half
                if (gameState.pendingSecondHalfInbound) {
                    startSecondHalfInbound();
                }
                drawCourt();
                drawScore();
                lastUpdate = Date.now();
                lastSecond = Date.now();
                lastAI = Date.now();
                continue;
            }

            // Shot clock violation
            if (gameState.shotClock <= 0) {
                announceEvent("shot_clock_violation", { team: gameState.currentTeam });
                mswait(1000);
                switchPossession();
                gameState.shotClock = 24; // Reset for new possession
            }

            // Track ball handler movement to detect stuck AI
            if (gameState.ballCarrier && !gameState.inbounding) {
                var ballHandler = gameState.ballCarrier;
                var distanceMoved = Math.sqrt(
                    Math.pow(ballHandler.x - gameState.ballHandlerLastX, 2) +
                    Math.pow(ballHandler.y - gameState.ballHandlerLastY, 2)
                );

                // If ball handler barely moved (less than 3 units), increment stuck timer
                var opponentTeamName = (gameState.currentTeam === "red") ? "blue" : "red";
                var closestDefender = getClosestPlayer(ballHandler.x, ballHandler.y, opponentTeamName);
                var guardDistance = closestDefender ? getSpriteDistance(ballHandler, closestDefender) : 999;
                var closelyGuarded = guardDistance <= 4;

                if (distanceMoved < 3) {
                    gameState.ballHandlerStuckTimer++;
                    if (!ballHandler.isHuman &&
                        ballHandler.playerData &&
                        ballHandler.playerData.hasDribble !== false &&
                        closelyGuarded &&
                        gameState.ballHandlerStuckTimer >= 8) {
                        pickUpDribble(ballHandler, "stuck");
                    }
                } else {
                    // Ball handler is moving, reset timer
                    gameState.ballHandlerStuckTimer = 0;
                }

                // Update last position
                gameState.ballHandlerLastX = ballHandler.x;
                gameState.ballHandlerLastY = ballHandler.y;

                if (ballHandler.playerData && ballHandler.playerData.hasDribble === false) {
                    if (!closelyGuarded) {
                        gameState.ballHandlerDeadSince = null;
                        gameState.ballHandlerDeadFrames = 0;
                        gameState.ballHandlerDeadForcedShot = false;
                    } else if (!gameState.ballHandlerDeadSince) {
                        gameState.ballHandlerDeadSince = now;
                        gameState.ballHandlerDeadFrames = 1;
                    } else {
                        gameState.ballHandlerDeadFrames++;

                        // MULTIPLAYER: Broadcast dead dribble timer every 30 frames
                        if (mpCoordinator && mpCoordinator.isCoordinator) {
                            if (gameState.tickCounter - mpSyncState.lastDeadDribbleBroadcast >= 30) {
                                mpCoordinator.broadcastGameState({
                                    type: 'deadDribbleUpdate',
                                    frames: gameState.ballHandlerDeadFrames,
                                    since: gameState.ballHandlerDeadSince,
                                    forced: gameState.ballHandlerDeadForcedShot,
                                    timestamp: Date.now()
                                });
                                mpSyncState.lastDeadDribbleBroadcast = gameState.tickCounter;
                            }
                        }

                        var deadElapsed = now - gameState.ballHandlerDeadSince;
                        if (!gameState.ballHandlerDeadForcedShot && deadElapsed >= 4500) {
                            if (ballHandler && !ballHandler.isHuman) {
                                gameState.ballHandlerDeadForcedShot = true;
                                attemptShot();
                                gameState.ballHandlerDeadSince = now;
                                gameState.ballHandlerDeadFrames = 0;
                                continue;
                            }
                        }
                        if (!violationTriggeredThisFrame && deadElapsed >= 5000) {
                            enforceFiveSecondViolation();
                            violationTriggeredThisFrame = true;
                        }
                    }
                } else {
                    resetDeadDribbleTimer();
                }

                // Track frontcourt progress for smarter passing
                var attackDir = (gameState.currentTeam === "red") ? 1 : -1;
                if (gameState.ballHandlerProgressOwner !== ballHandler) {
                    gameState.ballHandlerProgressOwner = ballHandler;
                    gameState.ballHandlerFrontcourtStartX = ballHandler.x;
                    gameState.ballHandlerAdvanceTimer = 0;
                }

                var handlerInBackcourt = isInBackcourt(ballHandler, gameState.currentTeam);

                if (!gameState.frontcourtEstablished || handlerInBackcourt) {
                    gameState.ballHandlerFrontcourtStartX = ballHandler.x;
                    gameState.ballHandlerAdvanceTimer = 0;
                } else {
                    var forwardDelta = (ballHandler.x - gameState.ballHandlerFrontcourtStartX) * attackDir;
                    if (forwardDelta < -1) {
                        gameState.ballHandlerFrontcourtStartX = ballHandler.x;
                        forwardDelta = 0;
                    }
                    if (forwardDelta < 4) {
                        gameState.ballHandlerAdvanceTimer++;
                    } else {
                        gameState.ballHandlerFrontcourtStartX = ballHandler.x;
                        gameState.ballHandlerAdvanceTimer = 0;
                    }
                }
            } else {
                gameState.ballHandlerAdvanceTimer = 0;
                gameState.ballHandlerProgressOwner = null;
                resetDeadDribbleTimer();
            }

            // Unified violation checking (extracted to shared function)
            violationTriggeredThisFrame = checkViolations(violationTriggeredThisFrame);
        }

        if (violationTriggeredThisFrame) {
            lastAI = now;
            lastUpdate = now;
            continue;
        }

        // Handle block jump animation
        if (gameState.blockJumpTimer > 0) {
            var blocker = gameState.activeBlock;
            if (blocker && blocker.frame) {

                var duration = gameState.activeBlockDuration || BLOCK_JUMP_DURATION;
                if (duration < 1) duration = BLOCK_JUMP_DURATION;
                var elapsed = duration - gameState.blockJumpTimer;
                if (elapsed < 0) elapsed = 0;
                var progress = elapsed / duration;
                if (progress > 1) progress = 1;
                var totalHeight = BLOCK_JUMP_HEIGHT + (blocker.blockJumpHeightBoost || 0);
                var jumpHeight = Math.sin(progress * Math.PI) * totalHeight;
                var spriteHeight = (blocker.frame && blocker.frame.height) ? blocker.frame.height : 4;
                var spriteWidth = (blocker.frame && blocker.frame.width) ? blocker.frame.width : 4;
                var jumpY = blocker.blockOriginalY - Math.round(jumpHeight);
                blocker.moveTo(blocker.x, jumpY);

                var groundBottom = blocker.blockOriginalY + spriteHeight;
                var currentBottom = jumpY + spriteHeight;
                var previousBottom = (typeof blocker.prevJumpBottomY === "number") ? blocker.prevJumpBottomY : groundBottom;
                var ascending = currentBottom <= previousBottom;
                var blockPatternAsc = "^   ^";
                var blockPatternDesc = "v   v";
                var patternWidth = blockPatternAsc.length;
                var centerColumn = blocker.x + Math.floor(spriteWidth / 2);
                var minBase = 1;
                var maxBase = Math.max(1, COURT_WIDTH - patternWidth + 1);
                var baseColumn = clamp(centerColumn - Math.floor(patternWidth / 2), minBase, maxBase);
                updateJumpIndicator(blocker, {
                    groundBottom: groundBottom,
                    currentBottom: currentBottom,
                    ascending: ascending,
                    horizontalDir: blocker.jumpIndicatorDir,
                    spriteWidth: spriteWidth,
                    spriteHeight: spriteHeight,
                    spriteHalfWidth: Math.floor(spriteWidth / 2),
                    spriteHalfHeight: Math.floor(spriteHeight / 2),
                    baseColumn: baseColumn,
                    patternAscend: blockPatternAsc,
                    patternDescend: blockPatternDesc
                });
                blocker.prevJumpBottomY = currentBottom;

                gameState.blockJumpTimer--;

                if (gameState.blockJumpTimer <= 0) {
                    clearJumpIndicator(blocker);
                    blocker.moveTo(blocker.x, blocker.blockOriginalY);
                    blocker.prevJumpBottomY = null;
                    blocker.blockJumpHeightBoost = 0;
                    gameState.activeBlock = null;
                    gameState.activeBlockDuration = null;
                }
            } else {
                gameState.blockJumpTimer = 0;
                gameState.activeBlock = null;
                gameState.activeBlockDuration = null;
            }
        }

        // Store previous positions before movement
        var allPlayers = getAllPlayers();
        for (var p = 0; p < allPlayers.length; p++) {
            allPlayers[p].prevX = allPlayers[p].x;
            allPlayers[p].prevY = allPlayers[p].y;
            if (allPlayers[p] && allPlayers[p].playerData) {
                var pdata = allPlayers[p].playerData;
                if (pdata.shakeCooldown && pdata.shakeCooldown > 0) pdata.shakeCooldown--;
                if (pdata.shoveCooldown && pdata.shoveCooldown > 0) pdata.shoveCooldown--;
                if (pdata.shoveAttemptCooldown && pdata.shoveAttemptCooldown > 0) pdata.shoveAttemptCooldown--;
                if (pdata.shoverCooldown && pdata.shoverCooldown > 0) pdata.shoverCooldown--;
                if (pdata.shoveFailureStun && pdata.shoveFailureStun > 0) pdata.shoveFailureStun--;
                if (allPlayers[p].isHuman && pdata.knockdownTimer && pdata.knockdownTimer > 0) {
                    pdata.knockdownTimer--;
                    if (pdata.knockdownTimer < 0) pdata.knockdownTimer = 0;
                }
            }
        }

        // MULTIPLAYER: Broadcast cooldown batch every 60 frames (~1 second)
        if (mpCoordinator && mpCoordinator.isCoordinator) {
            if (gameState.tickCounter - mpSyncState.lastCooldownBroadcast >= 60) {
                var cooldownData = {};
                for (var p = 0; p < allPlayers.length; p++) {
                    var player = allPlayers[p];
                    if (player && player.playerData) {
                        var playerId = getPlayerGlobalId(player);
                        if (playerId) {
                            cooldownData[playerId] = {
                                shake: player.playerData.shakeCooldown || 0,
                                shove: player.playerData.shoveCooldown || 0,
                                shoveAttempt: player.playerData.shoveAttemptCooldown || 0,
                                shover: player.playerData.shoverCooldown || 0,
                                stun: player.playerData.shoveFailureStun || 0,
                                knockdown: player.playerData.knockdownTimer || 0
                            };
                        }
                    }
                }
                mpCoordinator.broadcastGameState({
                    type: 'cooldownSync',
                    cooldowns: cooldownData,
                    timestamp: Date.now()
                });
                mpSyncState.lastCooldownBroadcast = gameState.tickCounter;
            }
        }

        if (gameState.ballCarrier && !gameState.inbounding && !gameState.frontcourtEstablished) {
            if (!isInBackcourt(gameState.ballCarrier, gameState.currentTeam)) {
                setFrontcourtEstablished(gameState.currentTeam);
                gameState.backcourtTimer = 0;
            }
        }

        // Get input
        var key = console.inkey(K_NONE, 50);
        if (key) {
            handleInput(key);
        }

        // Update AI (slower than rendering)
        if (now - lastAI >= aiInterval) {
            updateAI();
            lastAI = now;
        }

        // Update turbo for all players
        for (var p = 0; p < allPlayers.length; p++) {
            var player = allPlayers[p];
            if (player.playerData) {
                // Recharge turbo if not active
                if (!player.playerData.turboActive) {
                    player.playerData.rechargeTurbo(TURBO_RECHARGE_RATE);
                }
            }
        }

        // Update announcer timer
        updateAnnouncer();

        // Check collisions and boundaries
        checkSpriteCollision();
        for (var p = 0; p < allPlayers.length; p++) {
            checkBoundaries(allPlayers[p]);
        }

        // Cycle sprites more frequently for smoother animation
        Sprite.cycle();

        // Update non-blocking animations
        animationSystem.update();

        // Update non-blocking rebound scramble
        updateReboundScramble();

        // Update non-blocking knockback animations
        updateKnockbackAnimations();

        // Redraw court and score less frequently to balance performance
        // Skip during active animations to allow trails to accumulate
        if (now - lastUpdate >= 60 && !animationSystem.isBallAnimating()) {
            drawCourt();
            drawScore();
            lastUpdate = now;
        }

        // Cycle trail frame AFTER drawCourt so trails appear on top
        if (trailFrame) {
            cycleFrame(trailFrame);
            // Keep ball on top of trail layer
            if (ballFrame && ballFrame.is_open) {
                ballFrame.top();
            }
        }

        mswait(frameDelay);
    }

    gameState.gameRunning = false;
}

// Generic action handlers for multiplayer
function handleActionButton(player) {
    if (!player || !player.playerData) return;
    if (player.playerData.stealRecoverFrames > 0) return;

    var playerTeam = getPlayerTeamName(player);
    if (!playerTeam) return;

    if (gameState.currentTeam === playerTeam && gameState.ballCarrier === player) {
        // Player has ball - attempt shot
        attemptShot();
    } else if (gameState.currentTeam !== playerTeam) {
        // On defense - attempt block
        var defenderDir = null;
        if (gameState.ballCarrier) {
            defenderDir = gameState.ballCarrier.x >= player.x ? 1 : -1;
        }
        attemptBlock(player, { direction: defenderDir });
    }
}

function handleSecondaryButton(player) {
    if (!player || !player.playerData) return;
    if (player.playerData.stealRecoverFrames > 0) return;

    var playerTeam = getPlayerTeamName(player);
    if (!playerTeam) return;

    if (gameState.currentTeam === playerTeam) {
        // On offense - pass to teammate
        var teammate = getPlayerTeammate(player);
        if (gameState.ballCarrier === player && teammate) {
            animatePass(player, teammate);
        } else if (gameState.ballCarrier === teammate && teammate) {
            animatePass(teammate, player);
        }
    } else {
        // On defense - attempt steal
        attemptUserSteal(player);
    }
}

function handleDribbleButton(player) {
    if (!player || !player.playerData) return;
    if (player.playerData.stealRecoverFrames > 0) return;

    var playerTeam = getPlayerTeamName(player);
    if (!playerTeam) return;

    if (gameState.currentTeam === playerTeam && gameState.ballCarrier === player) {
        pickUpDribble(player);
    } else if (gameState.currentTeam !== playerTeam) {
        attemptShake(player);
    }
}

function handleInput(key) {
    if (key.toUpperCase() === 'Q') {
        gameState.gameRunning = false;
        return;
    }

    var keyUpper = key.toUpperCase();

    if (keyUpper === 'M') {
        togglePossessionBeep();
        return;
    }

    var recovering = (redPlayer1 && redPlayer1.playerData && redPlayer1.playerData.stealRecoverFrames > 0);

    // Space bar - shoot on offense, block on defense
    if (key === ' ') {
        if (recovering) return;
        if (gameState.currentTeam === "red" && (gameState.ballCarrier === redPlayer1 || gameState.ballCarrier === redPlayer2)) {
            attemptShot();
        } else {
            var defenderDir = null;
            if (gameState.ballCarrier) {
                defenderDir = gameState.ballCarrier.x >= redPlayer1.x ? 1 : -1;
            }
            attemptBlock(redPlayer1, {
                direction: defenderDir
            });
        }
        return;
    }

    // S key - pass to/from teammate OR steal (on defense)
    if (keyUpper === 'S') {
        if (recovering) return;
        if (gameState.currentTeam === "red" && gameState.ballCarrier === redPlayer1) {
            // Human has ball - pass to teammate
            animatePass(redPlayer1, redPlayer2);
        } else if (gameState.currentTeam === "red" && gameState.ballCarrier === redPlayer2) {
            // Teammate has ball - command them to pass back
            animatePass(redPlayer2, redPlayer1);
        } else if (gameState.currentTeam !== "red") {
            // On defense - attempt steal
            attemptUserSteal(redPlayer1);
        }
        return;
    }

    if (keyUpper === 'D') {
        if (recovering) return;

        // REBOUND SCRAMBLE: Allow user to shove during rebounds
        if (gameState.reboundActive) {
            // Find closest opponent to shove
            var allPlayers = [redPlayer1, redPlayer2, bluePlayer1, bluePlayer2];
            var closestOpponent = null;
            var closestDist = 999;

            for (var i = 0; i < allPlayers.length; i++) {
                var other = allPlayers[i];
                if (!other || other === redPlayer1) continue;
                var otherTeam = getPlayerTeamName(other);
                if (otherTeam === "red") continue; // Skip teammate

                var dist = getSpriteDistance(redPlayer1, other);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestOpponent = other;
                }
            }

            if (closestOpponent) {
                attemptShove(redPlayer1, closestOpponent);
            }
            return;
        }

        // OFFENSE WITH BALL: Pick up dribble or shake
        if (gameState.currentTeam === "red" && gameState.ballCarrier === redPlayer1) {
            if (redPlayer1.playerData && redPlayer1.playerData.hasDribble !== false) {
                pickUpDribble(redPlayer1, "user");
            } else {
                attemptShake(redPlayer1);
            }
        }
        // OFFENSE WITHOUT BALL: Shove nearby defender to create space
        else if (gameState.currentTeam === "red" && gameState.ballCarrier !== redPlayer1) {
            // Find closest opponent to shove
            var allPlayers = [redPlayer1, redPlayer2, bluePlayer1, bluePlayer2];
            var closestOpponent = null;
            var closestDist = 999;

            for (var i = 0; i < allPlayers.length; i++) {
                var other = allPlayers[i];
                if (!other || other === redPlayer1) continue;
                var otherTeam = getPlayerTeamName(other);
                if (otherTeam === "red") continue; // Skip teammate

                var dist = getSpriteDistance(redPlayer1, other);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestOpponent = other;
                }
            }

            if (closestOpponent) {
                attemptShove(redPlayer1, closestOpponent);
            }
        }
        // DEFENSE: Shove ball carrier (or nearby opponent if not near ball)
        else {
            // Try to shove ball carrier first, or nearest opponent
            var target = gameState.ballCarrier;
            if (!target || getSpriteDistance(redPlayer1, target) > 2.5) {
                // Ball carrier too far - find closest opponent
                var allPlayers = [redPlayer1, redPlayer2, bluePlayer1, bluePlayer2];
                var closestOpponent = null;
                var closestDist = 999;

                for (var i = 0; i < allPlayers.length; i++) {
                    var other = allPlayers[i];
                    if (!other || other === redPlayer1) continue;
                    var otherTeam = getPlayerTeamName(other);
                    if (otherTeam === "red") continue; // Skip teammate

                    var dist = getSpriteDistance(redPlayer1, other);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestOpponent = other;
                    }
                }

                if (closestOpponent) {
                    target = closestOpponent;
                }
            }

            if (target) {
                attemptShove(redPlayer1, target);
            }
        }
        return;
    }

    // Detect turbo (rapid repeated arrow key presses)
    var now = Date.now();
    var isArrowKey = (key == KEY_UP || key == KEY_DOWN || key == KEY_LEFT || key == KEY_RIGHT);

    if (recovering && isArrowKey) {
        return;
    }

    if (isArrowKey) {
        if (gameState.lastKey == key && (now - gameState.lastKeyTime) < TURBO_ACTIVATION_THRESHOLD) {
            // Turbo activated!
            if (redPlayer1 && redPlayer1.playerData && redPlayer1.playerData.turbo > 0) {
                redPlayer1.playerData.turboActive = true;
                redPlayer1.playerData.useTurbo(TURBO_DRAIN_RATE);
            }
        } else {
            // Turn off turbo
            if (redPlayer1 && redPlayer1.playerData) {
                redPlayer1.playerData.turboActive = false;
            }
        }
        gameState.lastKey = key;
        gameState.lastKeyTime = now;
    }

    // Always control redPlayer1 (human) - execute moves based on speed
    if (redPlayer1 && isArrowKey) {
        var budget = createMovementCounters(redPlayer1);
        if (budget.moves > 0) {
            var counters = {
                horizontal: Math.max(0, budget.horizontal),
                vertical: Math.max(0, budget.vertical)
            };
            for (var m = 0; m < budget.moves; m++) {
                if (!applyMovementCommand(redPlayer1, key, counters)) break;
            }
        }
    } else if (redPlayer1 && !recovering) {
        // Non-movement keys (pass, shoot, etc)
        redPlayer1.getcmd(key);
    }
}

// Check if any defenders are playing too tight on the ball handler (exploitable situation)
function restoreIndicatorEntry(entry) {
    if (!entry || !courtFrame) return;
    var rx = entry.x;
    var ry = entry.y;
    if (rx < 1 || rx > COURT_WIDTH || ry < 1 || ry > COURT_HEIGHT) return;
    var ch = (entry.origCh !== undefined && entry.origCh !== null) ? entry.origCh : " ";
    var attr = (entry.origAttr !== undefined && entry.origAttr !== null) ? entry.origAttr : (WHITE | WAS_BROWN);
    courtFrame.gotoxy(rx, ry);
    courtFrame.putmsg(ch, attr);
}

function redrawIndicatorEntry(entry) {
    if (!entry || !courtFrame) return;
    var rx = entry.x;
    var ry = entry.y;
    if (rx < 1 || rx > COURT_WIDTH || ry < 1 || ry > COURT_HEIGHT) return;
    courtFrame.gotoxy(rx, ry);
    courtFrame.putmsg(entry.char, entry.color);
}

function addIndicatorEntry(list, x, y, ch, color) {
    if (!courtFrame) return null;
    for (var i = 0; i < list.length; i++) {
        if (list[i].x === x && list[i].y === y && list[i].char === ch) {
            list[i].color = color;
            redrawIndicatorEntry(list[i]);
            return list[i];
        }
    }

    var cell = courtFrame.getData(x - 1, y - 1, false) || {};
    var entry = {
        x: x,
        y: y,
        char: ch,
        color: color,
        origCh: cell.ch,
        origAttr: cell.attr
    };
    list.push(entry);
    redrawIndicatorEntry(entry);
    return entry;
}

function drawIndicatorPattern(list, baseX, y, pattern, color) {
    if (!courtFrame) return;
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

function redrawIndicatorList(list) {
    for (var i = 0; i < list.length; i++) {
        redrawIndicatorEntry(list[i]);
    }
}

function restoreIndicatorList(list) {
    for (var i = 0; i < list.length; i++) {
        restoreIndicatorEntry(list[i]);
    }
    list.length = 0;
}

function computeIndicatorColumn(direction, leftX, rightX, phase) {
    if (!direction) direction = -1; // default lean left
    if (phase === "ascend") {
        return direction > 0 ? clamp(leftX - 1, 1, COURT_WIDTH) : clamp(rightX + 1, 1, COURT_WIDTH);
    }
    return direction > 0 ? clamp(rightX + 1, 1, COURT_WIDTH) : clamp(leftX - 1, 1, COURT_WIDTH);
}

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

function pruneDescentIndicators(data, currentBottom) {
    for (var i = data.descent.length - 1; i >= 0; i--) {
        var entry = data.descent[i];
        if (entry.y <= currentBottom) {
            restoreIndicatorEntry(entry);
            data.descent.splice(i, 1);
        }
    }
}

function updateJumpIndicator(sprite, options) {
    if (!sprite || !courtFrame) return;
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

function pickUpDribble(player, reason) {
    if (!player || !player.playerData) return;
    if (player.playerData.hasDribble === false) return;
    player.playerData.hasDribble = false;
    if (player === redPlayer1 && reason === "user") {
        announceEvent("dribble_pickup", {
            player: player,
            team: getPlayerTeamName(player),
            playerName: player.playerData.name
        });
    }
}

function incrementInjury(player, amount) {
    if (!player || !player.playerData) return;
    if (player.playerData.injuryCount === undefined) {
        player.playerData.injuryCount = 0;
    }
    player.playerData.injuryCount += amount || 1;
    if (player.playerData.injuryCount < 0) {
        player.playerData.injuryCount = 0;
    }
}

function setPlayerKnockedDown(player, duration) {
    if (!player || !player.playerData) return;
    player.playerData.knockdownTimer = Math.max(duration || 30, 0);
    if (player.playerData.turboActive) player.playerData.turboActive = false;
}

function isPlayerKnockedDown(player) {
    return !!(player && player.playerData && player.playerData.knockdownTimer > 0);
}

function knockBack(player, source, maxDistance) {
    if (!player || !player.moveTo) return;

    // Calculate knockback distance (12-25 units)
    var distance = Math.max(12, Math.min(maxDistance || 12, 25));

    // Calculate direction
    var dx = player.x - (source ? source.x : player.x);
    var dy = player.y - (source ? source.y : player.y);
    if (dx === 0 && dy === 0) {
        dx = (Math.random() < 0.5) ? 1 : -1;
    }

    // Normalize direction for consistent speed
    var magnitude = Math.sqrt(dx * dx + dy * dy);
    if (magnitude > 0) {
        dx /= magnitude;
        dy /= magnitude;
    }

    // Determine primary direction for arrow character
    var arrowChar = "o"; // Default
    var absX = Math.abs(dx);
    var absY = Math.abs(dy);

    if (absX > absY * 1.5) {
        // Primarily horizontal
        arrowChar = dx > 0 ? ">" : "<";
    } else if (absY > absX * 1.5) {
        // Primarily vertical
        arrowChar = dy > 0 ? "v" : "^";
    } else {
        // Diagonal - use strongest component
        if (absX > absY) {
            arrowChar = dx > 0 ? ">" : "<";
        } else {
            arrowChar = dy > 0 ? "v" : "^";
        }
    }

    // Calculate all positions (don't animate yet - non-blocking approach)
    var startX = player.x;
    var startY = player.y;
    var trailPositions = [];
    for (var i = 1; i <= distance; i++) {
        var newX = clampToCourtX(Math.round(startX + dx * i));
        var newY = clampToCourtY(Math.round(startY + dy * i));
        trailPositions.push({ x: newX, y: newY });
    }

    // Store knockback animation data on player for non-blocking animation
    if (!player.knockbackAnim) {
        player.knockbackAnim = {
            active: false,
            positions: [],
            currentStep: 0,
            arrowChar: "o",
            startTime: 0,
            stepDelay: 30,
            shover: null, // Track who did the shoving
            trailPositions: [] // Track where trails are drawn for cleanup
        };
    }

    player.knockbackAnim.active = true;
    player.knockbackAnim.positions = trailPositions;
    player.knockbackAnim.currentStep = 0;
    player.knockbackAnim.arrowChar = arrowChar;
    player.knockbackAnim.startTime = Date.now();
    player.knockbackAnim.stepDelay = 60; // ms per step (slowed from 30ms)
    player.knockbackAnim.shover = source; // Store shover reference
    player.knockbackAnim.trailPositions = []; // Clear old trails

    // Set cooldowns NOW so sprites show during animation
    if (player.playerData) {
        player.playerData.shoveCooldown = 35;
    }
    if (source && source.playerData) {
        source.playerData.shoverCooldown = 35;
    }

    // Move to first position immediately
    if (trailPositions.length > 0) {
        player.moveTo(trailPositions[0].x, trailPositions[0].y);
    }
}

/**
 * Update all active knockback animations (non-blocking)
 * Called each frame from main game loop
 */
function updateKnockbackAnimations() {
    var allPlayers = getAllPlayers();
    var now = Date.now();

    for (var i = 0; i < allPlayers.length; i++) {
        var player = allPlayers[i];
        if (!player || !player.knockbackAnim || !player.knockbackAnim.active) continue;

        var anim = player.knockbackAnim;
        var elapsed = now - anim.startTime;
        var targetStep = Math.floor(elapsed / anim.stepDelay);

        // Update position if we've reached next step
        if (targetStep > anim.currentStep && targetStep < anim.positions.length) {
            var pos = anim.positions[targetStep];
            player.moveTo(pos.x, pos.y);

            // Draw trail at previous positions (up to 12 trail characters)
            // Use trailFrame for proper layering (prevents court redraw from clearing trails)
            var trailLength = Math.min(12, targetStep);
            for (var t = 1; t <= trailLength; t++) {
                var trailIdx = targetStep - t;
                if (trailIdx >= 0 && trailIdx < anim.positions.length) {
                    var trailPos = anim.positions[trailIdx];
                    // Fade trail based on age (newer = brighter)
                    var trailAttr = t <= 2 ? (LIGHTCYAN | WAS_BROWN) : (CYAN | WAS_BROWN);
                    if (trailFrame && trailFrame.setData) {
                        // Convert game coords (1-based) to frame coords (0-based)
                        var trailX = trailPos.x - 1;
                        var trailY = trailPos.y - 1;
                        trailFrame.setData(trailX, trailY, anim.arrowChar, trailAttr, false);

                        // Track unique positions for cleanup (only on first draw of this step)
                        if (t === 1) {
                            if (!anim.trailPositions) anim.trailPositions = [];
                            anim.trailPositions.push({ x: trailX, y: trailY });
                        }
                    }
                }
            }

            anim.currentStep = targetStep;
        }

        // End animation when complete
        if (targetStep >= anim.positions.length) {
            // Clear all trail positions from overlay frame
            if (trailFrame && anim.trailPositions) {
                for (var t = 0; t < anim.trailPositions.length; t++) {
                    var pos = anim.trailPositions[t];
                    trailFrame.setData(pos.x, pos.y, undefined, 0, false);
                }
            }

            anim.active = false;
            anim.currentStep = 0;
            anim.trailPositions = []; // Clear trail tracking

            // Clear cooldowns immediately to restore normal sprites
            // Changed from 3 to 0 - no delay needed since appearance updates happen before sprite movement
            if (player.playerData) {
                player.playerData.shoveCooldown = 0;
            }

            // Also clear shover's cooldown
            if (anim.shover && anim.shover.playerData) {
                anim.shover.playerData.shoverCooldown = 0;
            }

            anim.shover = null; // Clear reference
        }
    }
}

function getTouchingOpponents(player, teamName, radius) {
    if (!player) return [];
    var opponents = getOpposingTeamSprites(teamName || getPlayerTeamName(player));
    if (!opponents || !opponents.length) return [];
    var touchRadius = radius || 2.6;
    var touching = [];
    for (var i = 0; i < opponents.length; i++) {
        var opp = opponents[i];
        if (!opp || !opp.playerData) continue;
        if (getSpriteDistance(player, opp) <= touchRadius) {
            touching.push(opp);
        }
    }
    return touching;
}

function getBearingVector(bearing) {
    switch ((bearing || "").toLowerCase()) {
        case "n": return { dx: 0, dy: -1 };
        case "ne": return { dx: 1, dy: -1 };
        case "e": return { dx: 1, dy: 0 };
        case "se": return { dx: 1, dy: 1 };
        case "s": return { dx: 0, dy: 1 };
        case "sw": return { dx: -1, dy: 1 };
        case "w": return { dx: -1, dy: 0 };
        case "nw": return { dx: -1, dy: -1 };
        default: return { dx: 0, dy: 0 };
    }
}

/**
 * AI SHOVE DECISION SYSTEM
 * Evaluates offensive and defensive shove opportunities with weighted priorities
 */

// Evaluate offensive shove opportunities per shove_documentation.md
// Evaluate defensive shove opportunities per shove_documentation.md
// Trigger defensive rotation when a defender is shoved (per shove_documentation.md)
function positionSpritesForBoxScore() {
    var marginX = 2;
    var spriteWidth = 5;
    var leftX = clampToCourtX(marginX);
    // Move right-side players further right to avoid covering injury stats (no clamping needed for scoreboard)
    var rightX = COURT_WIDTH - spriteWidth;
    var topYPrimary = clampToCourtY(3);
    var topYSecondary = clampToCourtY(6);
    var bottomYPrimary = clampToCourtY(COURT_HEIGHT - 8);
    var bottomYSecondary = clampToCourtY(COURT_HEIGHT - 5);

    if (redPlayer1 && typeof redPlayer1.moveTo === "function") {
        redPlayer1.moveTo(leftX, topYPrimary);
        renderPlayerLabel(redPlayer1, { highlightCarrier: false, forceTop: true });
    }
    if (redPlayer2 && typeof redPlayer2.moveTo === "function") {
        redPlayer2.moveTo(rightX, topYSecondary);
        renderPlayerLabel(redPlayer2, { highlightCarrier: false, forceTop: true });
    }
    if (bluePlayer1 && typeof bluePlayer1.moveTo === "function") {
        bluePlayer1.moveTo(leftX, bottomYPrimary);
        renderPlayerLabel(bluePlayer1, { highlightCarrier: false, forceTop: true });
    }
    if (bluePlayer2 && typeof bluePlayer2.moveTo === "function") {
        bluePlayer2.moveTo(rightX, bottomYSecondary);
        renderPlayerLabel(bluePlayer2, { highlightCarrier: false, forceTop: true });
    }
    if (typeof moveBallFrameTo === "function") {
        var ballX = COURT_WIDTH - 2;
        var ballY = 2;
        var safeX = clamp(ballX, 1, COURT_WIDTH);
        var safeY = clamp(ballY, 1, COURT_HEIGHT);
        moveBallFrameTo(safeX, safeY);
        gameState.ballX = safeX;
        gameState.ballY = safeY;
    }
}

function showGameOver(isDemoMode) {
    courtFrame.clear();
    positionSpritesForBoxScore();
    courtFrame.gotoxy(1, 1);

    courtFrame.center("\r\n\r\n");
    courtFrame.center("\1h\1y GAME OVER\1n\r\n\r\n");

    var redName = gameState.teamNames && gameState.teamNames.red ? gameState.teamNames.red : "RED";
    var blueName = gameState.teamNames && gameState.teamNames.blue ? gameState.teamNames.blue : "BLUE";
    var redColorCode = gameState.teamColors.red.fg_accent_code || gameState.teamColors.red.fg_code || "\1h\1w";
    var blueColorCode = gameState.teamColors.blue.fg_accent_code || gameState.teamColors.blue.fg_code || "\1h\1w";
    var whiteCode = "\1h\1w";

    if (gameState.score.red > gameState.score.blue) {
        courtFrame.center(redColorCode + " " + redName.toUpperCase() + " WIN!\1n\r\n");
    } else if (gameState.score.blue > gameState.score.red) {
        courtFrame.center(blueColorCode + " " + blueName.toUpperCase() + " WIN!\1n\r\n");
    } else {
        courtFrame.center("\1h\1yTIE GAME!\1n\r\n");
    }

    courtFrame.center("\r\n");
    courtFrame.center(
        whiteCode + "Final Score: " +
        redColorCode + redName + " " + gameState.score.red +
        whiteCode + " - " +
        blueColorCode + blueName + " " + gameState.score.blue +
        "\1n\r\n"
    );
    courtFrame.center("\r\n");

    renderTeamBoxScore("red", redName, { halftime: false });
    courtFrame.center("\r\n");
    renderTeamBoxScore("blue", blueName, { halftime: false });

    if (isDemoMode) {
        courtFrame.center("\r\n\1hStarting new demo in 15 seconds...\1n\r\n");
        courtFrame.center("\1h[Q]\1n Quit to Menu\r\n");
    } else {
        courtFrame.center("\r\n\1h[SPACE]\1n Play Again  \1h[T]\1n New Teams  \1h[Q]\1n Quit to Menu\r\n");
    }

    if (typeof Sprite !== "undefined" && typeof Sprite.cycle === "function") {
        Sprite.cycle();
    }
    cycleFrame(courtFrame);

    if (isDemoMode) {
        // Demo mode: wait 15 seconds or until user presses Q
        var startTime = Date.now();
        var timeoutMs = 15000; // 15 seconds

        while (Date.now() - startTime < timeoutMs) {
            var key = console.inkey(K_NONE, 100);
            if (key && key.toUpperCase() === 'Q') {
                return "quit";
            }
        }
        return "newdemo"; // Start new demo
    } else {
        // Player mode: wait for choice
        while (true) {
            var key = console.getkey();
            if (!key) continue;

            var keyUpper = key.toUpperCase();
            if (key === ' ') {
                return "playagain"; // Same teams, play again
            } else if (keyUpper === 'T') {
                return "newteams"; // Select new teams
            } else if (keyUpper === 'Q') {
                return "quit"; // Quit to main menu
            }
        }
    }
}

var BOX_SCORE_COLUMNS = [
    { key: "fgm", label: "FGM" },
    { key: "fga", label: "FGA" },
    { key: "tpm", label: "3PM" },
    { key: "tpa", label: "3PA" },
    { key: "points", label: "PTS" },
    { key: "assists", label: "AST" },
    { key: "steals", label: "STL" },
    { key: "rebounds", label: "REB" },
    { key: "blocks", label: "BLK" },
    { key: "dunks", label: "DNK" },
    { key: "turnovers", label: "TO", skipLeader: true },
    { key: "injuryCount", label: "INJ", isRaw: true, skipLeader: true }
];

function collectGlobalStatLeaders() {
    var leaders = {};
    var allPlayers = getAllPlayers();
    for (var c = 0; c < BOX_SCORE_COLUMNS.length; c++) {
        var column = BOX_SCORE_COLUMNS[c];
        var key = column.key;
        var maxValue = -Infinity;

        // For negative stats like turnovers and injuries, we want to track the highest value
        var isNegativeStat = (key === "turnovers" || key === "injuryCount");

        for (var i = 0; i < allPlayers.length; i++) {
            var player = allPlayers[i];
            if (!player || !player.playerData) continue;

            var value;
            if (column.isRaw) {
                value = player.playerData[key] || 0;
            } else {
                var stats = player.playerData.stats || {};
                value = stats[key] || 0;
            }

            if (value > maxValue) {
                maxValue = value;
            }
        }
        leaders[key] = { max: maxValue, isNegative: isNegativeStat };
    }
    return leaders;
}

function renderTeamBoxScore(teamKey, teamLabel, options) {
    var players = teamKey === "red" ? getRedTeam() : getBlueTeam();
    var teamColorInfo = gameState.teamColors[teamKey] || {};
    var headerColor = teamColorInfo.fg_accent_code || teamColorInfo.fg_code || "\1h\1w";
    var jerseyColor = teamColorInfo.fg_code || "\1h\1w";
    var whiteCode = "\1h\1w";

    var leaders = collectGlobalStatLeaders();

    courtFrame.center(headerColor + teamLabel.toUpperCase() + " BOX SCORE\1n\r\n");
    var headerLine = "PLAYER             ";
    for (var c = 0; c < BOX_SCORE_COLUMNS.length; c++) {
        var col = BOX_SCORE_COLUMNS[c];
        headerLine += padStart(col.label, 4, " ");
    }
    courtFrame.center(whiteCode + headerLine + "\1n\r\n");

    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        if (!player || !player.playerData) continue;

        var data = player.playerData;
        var stats = data.stats || {};
        var jersey = padStart(data.jersey, 2, "0");
        var name = getLastName(data.name || "");
        var nameBase = padEnd(("#" + jersey + " " + name).toUpperCase(), 18, " ");
        var displayName = jerseyColor + nameBase.substring(0, 3) + whiteCode + nameBase.substring(3);
        var line = whiteCode + displayName;

        for (var c = 0; c < BOX_SCORE_COLUMNS.length; c++) {
            var column = BOX_SCORE_COLUMNS[c];
            var key = column.key;
            var rawValue;
            if (column.isRaw) {
                rawValue = data[key] || 0;
            } else {
                rawValue = stats[key] || 0;
            }
            var valueStr = padStart(rawValue, 4, " ");

            var attrCode = whiteCode;
            var leaderInfo = leaders[key];
            if (leaderInfo && rawValue > 0 && rawValue === leaderInfo.max) {
                if (leaderInfo.isNegative) {
                    // Highlight negative stats (turnovers, injuries) in LIGHTRED
                    attrCode = "\1h\1r";
                } else if (!column.skipLeader) {
                    // Highlight positive stats in bright green
                    attrCode = "\1h\1g";
                }
            }

            line += attrCode + valueStr;
        }
        line += "\1n";
        courtFrame.center(line + "\r\n");
    }
}

function showIntro() {
    courtFrame.clear();
    courtFrame.drawBorder([YELLOW, YELLOW, YELLOW]);
    courtFrame.gotoxy(1, 1);

    courtFrame.center("\r\n\r\n");
    courtFrame.center("\1h\1y NBA JAM 2v2\1n\r\n");
    courtFrame.center("Terminal Edition\r\n\r\n");
    courtFrame.center("Get 3 in a row to catch \1h\1yON FIRE\1n!\r\n\r\n");
    courtFrame.center("Arrow keys: Move  |  Hold for \1h\1cTURBO\1n!\r\n");
    courtFrame.center("Space: Shoot / Block  |  S: Pass / Steal\r\n");
    courtFrame.center("D: Pick Up / Shake  |  D (Def): Shove\r\n");
    courtFrame.center("Q: Quit\r\n\r\n");
    courtFrame.center("\1h Press any key to start...\1n\r\n");

    cycleFrame(courtFrame);

    if (typeof console !== 'undefined' && typeof console.getkey === 'function') {
        console.getkey();
    }

    // Clear input buffer
    while (console.inkey(K_NONE, 0)) { }
}

function mainMenu() {
    courtFrame.clear();
    courtFrame.drawBorder([YELLOW, YELLOW, YELLOW]);
    courtFrame.gotoxy(1, 1);

    courtFrame.center("\r\n\r\n\r\n");
    courtFrame.center("\1h\1y NBA JAM 2v2\1n\r\n");
    courtFrame.center("Terminal Edition\r\n\r\n\r\n");

    courtFrame.center("\1h\1g1\1n. Play Game (Single Player)\r\n");
    courtFrame.center("\1h\1m2\1n. Multiplayer (Online)\r\n");
    courtFrame.center("\1h\1c3\1n. Watch CPU Demo\r\n");
    courtFrame.center("\1h\1rQ\1n. Quit\r\n\r\n\r\n");

    courtFrame.center("Select an option:\r\n");

    cycleFrame(courtFrame);

    // Wait for user selection
    while (true) {
        var key = console.getkey();
        if (!key) continue;

        var keyUpper = key.toUpperCase();

        if (keyUpper === 'Q') {
            return null; // Quit
        } else if (key === '1') {
            return "play"; // Play game
        } else if (key === '2') {
            return "multiplayer"; // Multiplayer
        } else if (key === '3') {
            return "demo"; // Watch demo
        }
        // Invalid key, loop again
    }
}

function playerSelectionScreen(teamKey, teamColor, selectionType, excludeIndices) {
    var team = NBATeams[teamKey];
    if (!team || !team.players || team.players.length === 0) {
        return null;
    }

    var currentSelection = 0;
    selectionType = selectionType || "main"; // "main" or "teammate"
    excludeIndices = excludeIndices || [];

    // Skip excluded players for initial selection
    while (excludeIndices.indexOf(currentSelection) !== -1 && currentSelection < team.players.length - 1) {
        currentSelection++;
    }

    while (true) {
        console.clear();
        var colorCode = teamColor === "RED" ? "\1h\1r" : "\1h\1c";
        console.putmsg("\1h\1y=== NBA JAM - PLAYER SELECTION ===\1n\r\n\r\n");
        console.putmsg(colorCode + teamColor + " TEAM: " + team.name + "\1n\r\n\r\n");

        if (selectionType === "main") {
            console.putmsg("Select your main player:\r\n\r\n");
        } else {
            console.putmsg("Select your teammate:\r\n\r\n");
        }

        // Display players with stats
        for (var i = 0; i < team.players.length; i++) {
            var player = team.players[i];
            var isExcluded = excludeIndices.indexOf(i) !== -1;
            var prefix;

            if (isExcluded) {
                prefix = "\1h\1k  [SELECTED] ";
                console.putmsg(prefix + "#" + player.jersey + " " + player.name + "\1n\r\n");
            } else if (i === currentSelection) {
                prefix = "\1h\1w> ";
                console.putmsg(prefix + "#" + player.jersey + " " + player.name + "\1n\r\n");

                // Show detailed stats for selected player
                console.putmsg("     SPD: " + player.attributes[ATTR_SPEED] + "/10  ");
                console.putmsg("3PT: " + player.attributes[ATTR_3PT] + "/10  ");
                console.putmsg("DNK: " + player.attributes[ATTR_DUNK] + "/10\r\n");
                console.putmsg("     PWR: " + player.attributes[ATTR_POWER] + "/10  ");
                console.putmsg("STL: " + player.attributes[ATTR_STEAL] + "/10  ");
                console.putmsg("BLK: " + player.attributes[ATTR_BLOCK] + "/10\r\n");
            } else {
                prefix = "  ";
                console.putmsg(prefix + "#" + player.jersey + " " + player.name + "\1n\r\n");
            }
            console.putmsg("\r\n");
        }

        console.putmsg("\1h[UP/DOWN]\1n Navigate  \1h[ENTER]\1n Select  \1h[Q]\1n Quit\r\n");

        // Get input
        var key = console.getkey();

        if (key.toUpperCase() === 'Q') {
            return null;
        } else if (key === KEY_UP) {
            do {
                currentSelection--;
                if (currentSelection < 0) currentSelection = team.players.length - 1;
            } while (excludeIndices.indexOf(currentSelection) !== -1);
        } else if (key === KEY_DOWN) {
            do {
                currentSelection++;
                if (currentSelection >= team.players.length) currentSelection = 0;
            } while (excludeIndices.indexOf(currentSelection) !== -1);
        } else if (key === '\r' || key === '\n') {
            if (excludeIndices.indexOf(currentSelection) === -1) {
                return currentSelection; // Return selected player index
            }
        }
    }
}

function teammateSelectionScreen(teamKey, teamColor, mainPlayerIndex) {
    var team = NBATeams[teamKey];
    if (!team || !team.players || team.players.length < 2) {
        return [mainPlayerIndex]; // Fallback to just main player
    }

    console.clear();
    var colorCode = teamColor === "RED" ? "\1h\1r" : "\1h\1c";
    console.putmsg("\1h\1y=== NBA JAM - TEAMMATE SELECTION ===\1n\r\n\r\n");
    console.putmsg(colorCode + teamColor + " TEAM: " + team.name + "\1n\r\n\r\n");
    console.putmsg("Your main player: #" + team.players[mainPlayerIndex].jersey + " " + team.players[mainPlayerIndex].name + "\r\n\r\n");
    console.putmsg("Select your teammate to play alongside you:\r\n\r\n");

    var teammateIndex = playerSelectionScreen(teamKey, teamColor, "teammate", [mainPlayerIndex]);
    if (teammateIndex === null) {
        return null; // User quit
    }

    return [mainPlayerIndex, teammateIndex];
}

function teamSelectionScreen() {
    console.clear();

    // Get list of all teams
    var teamList = [];
    for (var teamKey in NBATeams) {
        teamList.push({
            key: teamKey,
            name: NBATeams[teamKey].name
        });
    }

    // Sort alphabetically by team name
    teamList.sort(function (a, b) {
        return a.name.localeCompare(b.name);
    });

    var columnRows = Math.ceil(teamList.length / 2);
    var rightColumnRows = teamList.length - columnRows;

    function indexToCoord(index) {
        if (index < columnRows) return { col: 0, row: index };
        return { col: 1, row: index - columnRows };
    }

    function coordToIndex(col, row) {
        return col === 0 ? row : columnRows + row;
    }

    function columnLength(col) {
        return col === 0 ? columnRows : rightColumnRows;
    }

    function renderTeamMenu(currentSelection, title) {
        console.clear();
        console.putmsg("\1h\1y=== NBA JAM - TEAM SELECTION ===\1n\r\n\r\n");
        console.putmsg(title + "\r\n\r\n");

        for (var row = 0; row < columnRows; row++) {
            var line = "";

            var leftIndex = row;
            if (leftIndex < teamList.length) {
                var leftTeam = NBATeams[teamList[leftIndex].key];
                var leftSelected = (currentSelection === leftIndex);
                var leftPrefix = leftSelected ? "> " : "  ";
                var leftColor = getMenuColorCodes(leftTeam, leftSelected);
                line += leftColor + leftPrefix + teamList[leftIndex].name;
                var leftPad = 32 - (leftPrefix.length + teamList[leftIndex].name.length);
                if (leftPad < 2) leftPad = 2;
                line += repeatChar(' ', leftPad);
            } else {
                line += repeatChar(' ', 34);
            }

            var rightIndex = row + columnRows;
            if (rightIndex < teamList.length) {
                var rightTeam = NBATeams[teamList[rightIndex].key];
                var rightSelected = (currentSelection === rightIndex);
                var rightPrefix = rightSelected ? "> " : "  ";
                var rightColor = getMenuColorCodes(rightTeam, rightSelected);
                line += rightColor + rightPrefix + teamList[rightIndex].name;
            }

            line += "\1n\r\n";
            console.putmsg(line);
        }

        console.putmsg("\r\n\1h[UP/DOWN]\1n Navigate  \1h[LEFT/RIGHT]\1n Column  \1h[ENTER]\1n Select  \1h[Q]\1n Quit\r\n");
    }

    // STEP 1: Select YOUR team
    var currentSelection = 0;
    var userTeamKey = null;

    while (userTeamKey === null) {
        renderTeamMenu(currentSelection, "\1h\1rYOUR TEAM\1n - Select your team:");
        var key = console.getkey();

        if (key.toUpperCase() === 'Q') {
            return null;
        } else if (key === KEY_UP) {
            var coordUp = indexToCoord(currentSelection);
            if (coordUp.row > 0) {
                coordUp.row--;
                currentSelection = coordToIndex(coordUp.col, coordUp.row);
            }
        } else if (key === KEY_DOWN) {
            var coordDown = indexToCoord(currentSelection);
            var colLenDown = columnLength(coordDown.col);
            if (coordDown.row + 1 < colLenDown) {
                coordDown.row++;
                currentSelection = coordToIndex(coordDown.col, coordDown.row);
            }
        } else if (key === KEY_LEFT) {
            var coordLeft = indexToCoord(currentSelection);
            if (coordLeft.col === 1) {
                coordLeft.col = 0;
                var leftLen = columnLength(0);
                if (coordLeft.row >= leftLen) coordLeft.row = leftLen - 1;
                currentSelection = coordToIndex(coordLeft.col, coordLeft.row);
            }
        } else if (key === KEY_RIGHT) {
            var coordRight = indexToCoord(currentSelection);
            if (rightColumnRows > 0 && coordRight.col === 0 && coordRight.row < rightColumnRows) {
                coordRight.col = 1;
                currentSelection = coordToIndex(coordRight.col, coordRight.row);
            }
        } else if (key === '\r' || key === '\n') {
            userTeamKey = teamList[currentSelection].key;
        }
    }

    // STEP 2: Select YOUR main player from your team
    var userPlayerIndex = playerSelectionScreen(userTeamKey, "RED", "main");
    if (userPlayerIndex === null) return null;

    // STEP 2.5: Select YOUR teammate(s) from your team  
    var userTeamPlayers = teammateSelectionScreen(userTeamKey, "RED", userPlayerIndex);
    if (userTeamPlayers === null) return null;

    // STEP 3: Select OPPONENT team
    currentSelection = 0;
    var opponentTeamKey = null;

    while (opponentTeamKey === null) {
        renderTeamMenu(currentSelection, "\1h\1cOPPONENT TEAM\1n - Select opponent:");
        var key = console.getkey();

        if (key.toUpperCase() === 'Q') {
            return null;
        } else if (key === KEY_UP) {
            var oCoordUp = indexToCoord(currentSelection);
            if (oCoordUp.row > 0) {
                oCoordUp.row--;
                currentSelection = coordToIndex(oCoordUp.col, oCoordUp.row);
            }
        } else if (key === KEY_DOWN) {
            var oCoordDown = indexToCoord(currentSelection);
            var oLenDown = columnLength(oCoordDown.col);
            if (oCoordDown.row + 1 < oLenDown) {
                oCoordDown.row++;
                currentSelection = coordToIndex(oCoordDown.col, oCoordDown.row);
            }
        } else if (key === KEY_LEFT) {
            var oCoordLeft = indexToCoord(currentSelection);
            if (oCoordLeft.col === 1) {
                oCoordLeft.col = 0;
                var oLeftLen = columnLength(0);
                if (oCoordLeft.row >= oLeftLen) oCoordLeft.row = oLeftLen - 1;
                currentSelection = coordToIndex(oCoordLeft.col, oCoordLeft.row);
            }
        } else if (key === KEY_RIGHT) {
            var oCoordRight = indexToCoord(currentSelection);
            if (rightColumnRows > 0 && oCoordRight.col === 0 && oCoordRight.row < rightColumnRows) {
                oCoordRight.col = 1;
                currentSelection = coordToIndex(oCoordRight.col, oCoordRight.row);
            }
        } else if (key === '\r' || key === '\n') {
            opponentTeamKey = teamList[currentSelection].key;
        }
    }

    // Opponent uses their first two players by default
    var opponentPlayers = [0, 1];

    // Make sure opponent has enough players
    var opponentTeam = NBATeams[opponentTeamKey];
    if (opponentTeam.players.length < 2) {
        opponentPlayers = [0, 0]; // Fallback to duplicate first player
    }

    return {
        redTeam: userTeamKey,
        blueTeam: opponentTeamKey,
        redPlayers: {
            player1: userTeamPlayers[0],    // Human controlled (main player)
            player2: userTeamPlayers[1]     // AI teammate (selected teammate)
        },
        bluePlayers: {
            player1: opponentPlayers[0],  // AI opponent 1
            player2: opponentPlayers[1]   // AI opponent 2
        }
    };
}

function runCPUDemo() {
    while (true) {
        // Pick random teams for demo
        var teamKeys = Object.keys(NBATeams);
        var randomTeam1 = teamKeys[Math.floor(Math.random() * teamKeys.length)];
        var randomTeam2 = teamKeys[Math.floor(Math.random() * teamKeys.length)];

        // Make sure they're different teams
        while (randomTeam1 === randomTeam2) {
            randomTeam2 = teamKeys[Math.floor(Math.random() * teamKeys.length)];
        }

        var redTeamKey = randomTeam1;
        var blueTeamKey = randomTeam2;

        // Use random player indices (pick 2 random players from each 6-player roster)
        var redTeam = NBATeams[redTeamKey];
        var blueTeam = NBATeams[blueTeamKey];

        var redAvailablePlayers = [];
        var blueAvailablePlayers = [];

        // Get available players for each team using actual players array
        for (var i = 0; i < redTeam.players.length; i++) {
            redAvailablePlayers.push(i);
        }
        for (var i = 0; i < blueTeam.players.length; i++) {
            blueAvailablePlayers.push(i);
        }

        // Safety check - ensure we have at least 2 players per team
        if (redAvailablePlayers.length < 2) {
            // Fallback to default players (0 and 1, or 0 and 0 if only 1 player)
            redAvailablePlayers = [0, redTeam.players.length > 1 ? 1 : 0];
        }
        if (blueAvailablePlayers.length < 2) {
            blueAvailablePlayers = [0, blueTeam.players.length > 1 ? 1 : 0];
        }

        // Randomly select 2 players from each team
        var redPlayerIndices = {
            player1: redAvailablePlayers[Math.floor(Math.random() * redAvailablePlayers.length)],
            player2: redAvailablePlayers[Math.floor(Math.random() * redAvailablePlayers.length)]
        };

        // Make sure red players are different
        while (redPlayerIndices.player1 === redPlayerIndices.player2 && redAvailablePlayers.length > 1) {
            redPlayerIndices.player2 = redAvailablePlayers[Math.floor(Math.random() * redAvailablePlayers.length)];
        }

        var bluePlayerIndices = {
            player1: blueAvailablePlayers[Math.floor(Math.random() * blueAvailablePlayers.length)],
            player2: blueAvailablePlayers[Math.floor(Math.random() * blueAvailablePlayers.length)]
        };

        // Make sure blue players are different
        while (bluePlayerIndices.player1 === bluePlayerIndices.player2 && blueAvailablePlayers.length > 1) {
            bluePlayerIndices.player2 = blueAvailablePlayers[Math.floor(Math.random() * blueAvailablePlayers.length)];
        }

        // Reset state and initialize sprites with ALL CPU mode
        resetGameState({ allCPUMode: true });
        initSprites(redTeamKey, blueTeamKey, redPlayerIndices, bluePlayerIndices, true);

        // Match player game length for demo as well
        gameState.timeRemaining = DEMO_GAME_SECONDS;
        gameState.totalGameTime = DEMO_GAME_SECONDS;
        gameState.currentHalf = 1;

        // Show matchup screen with betting enabled
        var bettingSlip = showMatchupScreen(true);

        // Display "DEMO MODE" message
        announce("DEMO MODE - Press Q to exit", YELLOW);
        mswait(1500);

        // Run the game loop (all AI controlled)
        gameLoop();

        // After game ends, show betting results if user placed bets
        if (bettingSlip && typeof showBettingResults === "function") {
            var gameResults = collectGameResults(redTeamKey, blueTeamKey);
            showBettingResults(bettingSlip, gameResults);
        }

        // After game ends, check what user wants to do
        var choice = showGameOver(true); // Pass true for demo mode

        if (choice === "quit") {
            break; // Exit demo loop
        }
        // choice === "newdemo" continues the loop for a new demo

        // Clean up sprites before starting new demo
        cleanupSprites();
        resetGameState({ allCPUMode: true });
    }
}

// Collect game results for betting resolution
function collectGameResults(redTeamKey, blueTeamKey) {
    var redScore = gameState.score.red || 0;
    var blueScore = gameState.score.blue || 0;
    var winner = redScore > blueScore ? "red" : "blue";

    // Find stat leaders
    var allPlayers = [];
    if (redPlayer1 && redPlayer1.playerData) allPlayers.push(redPlayer1.playerData);
    if (redPlayer2 && redPlayer2.playerData) allPlayers.push(redPlayer2.playerData);
    if (bluePlayer1 && bluePlayer1.playerData) allPlayers.push(bluePlayer1.playerData);
    if (bluePlayer2 && bluePlayer2.playerData) allPlayers.push(bluePlayer2.playerData);

    var leaders = {
        points: null,
        assists: null,
        rebounds: null,
        steals: null,
        blocks: null
    };

    // Find leader for each stat
    var stats = ['points', 'assists', 'rebounds', 'steals', 'blocks'];
    for (var s = 0; s < stats.length; s++) {
        var stat = stats[s];
        var maxValue = -1;
        var leader = null;

        for (var p = 0; p < allPlayers.length; p++) {
            var player = allPlayers[p];
            var value = (player.stats && typeof player.stats[stat] === "number") ? player.stats[stat] : 0;
            if (value > maxValue) {
                maxValue = value;
                leader = player.name;
            }
        }

        leaders[stat] = leader;
    }

    return {
        redTeam: gameState.teamNames.red || redTeamKey,
        blueTeam: gameState.teamNames.blue || blueTeamKey,
        redScore: redScore,
        blueScore: blueScore,
        winner: winner,
        leaders: leaders
    };
}

function showSplashScreen() {
    console.clear();

    var splashLoaded = false;

    var binPath = js.exec_dir + "nba_jam.bin";
    var screenCols = (typeof console.screen_columns === "number") ? console.screen_columns : 80;
    var screenRows = (typeof console.screen_rows === "number") ? console.screen_rows : 24;

    if (file_exists(binPath) && screenCols >= 80 && screenRows >= 24) {
        if (typeof Graphic === "undefined") load("graphic.js");
        try {
            var graphicHeight = 25;
            var splashGraphic = new Graphic(80, graphicHeight);
            splashGraphic.load(binPath);
            splashGraphic.autowrap = false;
            var drawHeight = Math.min(graphicHeight, screenRows);
            splashGraphic.draw('center', 'center', 80, drawHeight);
            splashLoaded = true;
        } catch (e) {
            splashLoaded = false;
        }
    }

    if (!splashLoaded) {
        var ansiFile = new File(js.exec_dir + "nba_jam.ans");
        if (ansiFile.open("r")) {
            var content = ansiFile.read();
            ansiFile.close();
            if (typeof Graphic === "undefined") load("graphic.js");
            try {
                var ansiWidth = Math.min(80, screenCols);
                var ansiHeight = Math.min(Math.max(24, screenRows), screenRows);
                var ansiGraphic = new Graphic(ansiWidth, ansiHeight);
                ansiGraphic.autowrap = false;
                ansiGraphic.ANSI = content;
                ansiGraphic.draw('center', 'center', ansiWidth, Math.min(ansiGraphic.height, screenRows));
                splashLoaded = true;
            } catch (err) {
                console.print(content);
                splashLoaded = true;
            }
        }
    }

    // Wait for any keypress if something displayed
    if (splashLoaded) {
        console.getkey();
    }

    // Clear input buffer
    while (console.inkey(K_NONE, 0)) { }

    // Clean up and reset attributes/screen
    console.print("\1n");
    console.clear();
}

function showMatchupScreen(allowBetting) {
    if (typeof console === "undefined" || typeof Sprite === "undefined") return null;
    if (!bluePlayer1 || !bluePlayer2 || !redPlayer1 || !redPlayer2) return null;

    var screenCols = (typeof console.screen_columns === "number") ? console.screen_columns : 80;
    var screenRows = (typeof console.screen_rows === "number") ? console.screen_rows : 24;
    if (screenCols < 80 || screenRows < 24) return;

    var binPath = js.exec_dir + "nba_jam.bin";
    var graphicWidth = 80;
    var graphicHeight = Math.min(25, screenRows);
    var baseX = Math.max(1, Math.floor((screenCols - graphicWidth) / 2) + 1);
    var baseY = Math.max(1, Math.floor((screenRows - graphicHeight) / 2) + 1);

    console.clear();
    if (file_exists(binPath)) {
        if (typeof Graphic === "undefined") load("graphic.js");
        try {
            var backgroundGraphic = new Graphic(graphicWidth, graphicHeight);
            backgroundGraphic.autowrap = false;
            backgroundGraphic.load(binPath);
            backgroundGraphic.draw(baseX, baseY, graphicWidth, Math.min(backgroundGraphic.height, screenRows));
        } catch (e) {
            console.clear();
        }
    }

    var frameWidth = 21;
    var frameHeight = 10;
    var innerOffsetX = 2;
    var innerOffsetY = 2;
    var areaWidth = 9;
    var areaHeight = frameHeight - 2;

    function teamTextAttr(teamKey) {
        var colors = gameState.teamColors[teamKey] || {};
        var fg = (typeof colors.fg === "number") ? (colors.fg & FG_MASK) : WHITE;
        return (fg & FG_MASK) | BG_BLACK;
    }

    function teamAccentAttr(teamKey) {
        var colors = gameState.teamColors[teamKey] || {};
        var fg = (typeof colors.fg_accent === "number") ? (colors.fg_accent & FG_MASK) : (typeof colors.fg === "number" ? colors.fg & FG_MASK : WHITE);
        return fg | BG_BLACK;
    }

    function drawDivider(frame, dividerX, startY, height, attr) {
        var prevAtcodes = frame.atcodes;
        frame.atcodes = false;
        for (var row = 0; row < height; row++) {
            frame.gotoxy(dividerX, startY + row);
            frame.putmsg(ascii(179), attr);
        }
        frame.atcodes = prevAtcodes;
    }

    function renderPlayerArea(frame, areaX, areaY, areaW, areaH, playerData, sprite, teamKey) {
        var textAttr = teamTextAttr(teamKey);
        var accentAttr = teamAccentAttr(teamKey);
        var prevAtcodes = frame.atcodes;
        frame.atcodes = false;

        var blankLine = repeatChar(' ', areaW);
        for (var r = 0; r < areaH; r++) {
            frame.gotoxy(areaX, areaY + r);
            frame.putmsg(blankLine, textAttr);
        }

        if (!playerData) {
            frame.atcodes = prevAtcodes;
            return;
        }

        function centerText(text, row, attr) {
            if (!text) return;
            var str = String(text);
            if (str.length > areaW) str = str.substring(0, areaW);
            var start = areaX + Math.max(0, Math.floor((areaW - str.length) / 2));
            if (start + str.length > areaX + areaW) start = areaX + areaW - str.length;
            frame.gotoxy(start, row);
            frame.putmsg(str, attr);
        }

        var jerseyText = "#" + (playerData.jerseyString || playerData.jersey || "");
        centerText(jerseyText, areaY, accentAttr);

        var positionText = (playerData.position || "").toUpperCase();
        centerText(positionText, areaY + 1, textAttr);

        if (sprite && sprite.frame) {
            var spriteWidth = sprite.frame.width || 5;
            var spriteHeight = sprite.frame.height || 4;
            var spriteStartX = areaX + Math.max(0, Math.floor((areaW - spriteWidth) / 2));
            var spriteStartY = areaY + 2;
            for (var sy = 0; sy < spriteHeight && (spriteStartY + sy) < areaY + areaH - 2; sy++) {
                for (var sx = 0; sx < spriteWidth && (spriteStartX + sx) < areaX + areaW; sx++) {
                    var cell = sprite.frame.getData(sx, sy, false);
                    if (!cell) continue;
                    var ch = cell.ch;
                    var attr = cell.attr;
                    if (!ch || ch === '\0') ch = ' ';
                    if (attr === undefined || attr === null) attr = textAttr;
                    frame.gotoxy(spriteStartX + sx, spriteStartY + sy);
                    frame.putmsg(ch, attr);
                }
            }
        }

        var nickname = (playerData.shortNick || getLastName(playerData.name || "")).toUpperCase();
        centerText(nickname, areaY + areaH - 2, textAttr);

        var lastName = getLastName(playerData.name || "").toUpperCase();
        centerText(lastName, areaY + areaH - 1, textAttr);

        frame.atcodes = prevAtcodes;
    }

    function buildTeamFrame(teamKey, teamName, players, sprites, startX, startY) {
        var borderAttr = teamTextAttr(teamKey);
        var frame = new Frame(startX, startY, frameWidth, frameHeight, borderAttr);
        frame.checkbounds = false;
        frame.atcodes = false;
        frame.open();
        frame.drawBorder({ color: borderAttr, title: teamName.toUpperCase(), titleAttr: borderAttr });

        var innerX = innerOffsetX;
        var innerY = innerOffsetY;
        var innerHeight = frameHeight - 2;
        var dividerX = innerX + areaWidth;
        drawDivider(frame, dividerX, innerY, innerHeight, borderAttr);

        var areaOne = { x: innerX, y: innerY, width: areaWidth, height: areaHeight };
        var areaTwo = { x: dividerX + 1, y: innerY, width: areaWidth, height: areaHeight };
        renderPlayerArea(frame, areaOne.x, areaOne.y, areaOne.width, areaOne.height, players[0], sprites[0], teamKey);
        renderPlayerArea(frame, areaTwo.x, areaTwo.y, areaTwo.width, areaTwo.height, players[1], sprites[1], teamKey);

        cycleFrame(frame);
        return frame;
    }

    var leftTeamKey = "red";
    var rightTeamKey = "blue";
    var leftTeamName = (gameState.teamNames && gameState.teamNames.red) ? gameState.teamNames.red : "RED";
    var rightTeamName = (gameState.teamNames && gameState.teamNames.blue) ? gameState.teamNames.blue : "BLUE";

    var leftPlayers = [redPlayer1 && redPlayer1.playerData || null, redPlayer2 && redPlayer2.playerData || null];
    var rightPlayers = [bluePlayer1 && bluePlayer1.playerData || null, bluePlayer2 && bluePlayer2.playerData || null];

    var leftSprites = [redPlayer1 || null, redPlayer2 || null];
    var rightSprites = [bluePlayer1 || null, bluePlayer2 || null];

    var leftFrameX = baseX + 1; // column 2 relative to graphic (1-based)
    var leftFrameY = baseY + 10; // row 11
    var rightFrameX = baseX + 58; // column 59
    var rightFrameY = baseY + 10; // row 11

    var leftFrame = buildTeamFrame(leftTeamKey, leftTeamName, leftPlayers, leftSprites, leftFrameX, leftFrameY);
    var rightFrame = buildTeamFrame(rightTeamKey, rightTeamName, rightPlayers, rightSprites, rightFrameX, rightFrameY);

    function updateTeamFrames() {
        var innerHeight = frameHeight - 2;
        var dividerX = innerOffsetX + areaWidth;
        drawDivider(leftFrame, dividerX, innerOffsetY, innerHeight, teamTextAttr(leftTeamKey));
        drawDivider(rightFrame, dividerX, innerOffsetY, innerHeight, teamTextAttr(rightTeamKey));
        renderPlayerArea(leftFrame, innerOffsetX, innerOffsetY, areaWidth, areaHeight, leftPlayers[0], leftSprites[0], leftTeamKey);
        renderPlayerArea(leftFrame, innerOffsetX + areaWidth + 1, innerOffsetY, areaWidth, areaHeight, leftPlayers[1], leftSprites[1], leftTeamKey);
        renderPlayerArea(rightFrame, innerOffsetX, innerOffsetY, areaWidth, areaHeight, rightPlayers[0], rightSprites[0], rightTeamKey);
        renderPlayerArea(rightFrame, innerOffsetX + areaWidth + 1, innerOffsetY, areaWidth, areaHeight, rightPlayers[1], rightSprites[1], rightTeamKey);
        cycleFrame(leftFrame);
        cycleFrame(rightFrame);
    }

    var previewSprites = [
        { sprite: redPlayer1, originalBearing: redPlayer1 ? redPlayer1.bearing : null, teamKey: leftTeamKey },
        { sprite: redPlayer2, originalBearing: redPlayer2 ? redPlayer2.bearing : null, teamKey: leftTeamKey },
        { sprite: bluePlayer1, originalBearing: bluePlayer1 ? bluePlayer1.bearing : null, teamKey: rightTeamKey },
        { sprite: bluePlayer2, originalBearing: bluePlayer2 ? bluePlayer2.bearing : null, teamKey: rightTeamKey }
    ];

    var turnInfo = previewSprites.map(function (entry) {
        var bearings = [];
        if (entry.sprite && entry.sprite.ini && entry.sprite.ini.bearings) {
            bearings = entry.sprite.ini.bearings.slice();
        }
        return {
            sprite: entry.sprite,
            originalBearing: entry.originalBearing,
            bearings: bearings,
            nextTurn: Date.now() + 500 + Math.floor(Math.random() * 800)
        };
    });

    updateTeamFrames();

    // Display betting odds using bookie.js
    var oddsDisplay = null;
    if (typeof getOddsDisplayLines === "function") {
        try {
            oddsDisplay = getOddsDisplayLines(leftPlayers, rightPlayers);

            // Position odds text below each team frame
            var oddsY = leftFrameY + frameHeight + 1;
            var leftOddsAttr = teamTextAttr(leftTeamKey);
            var rightOddsAttr = teamTextAttr(rightTeamKey);

            // Left side odds (red team)
            var leftOddsX = leftFrameX + Math.floor((frameWidth - oddsDisplay.leftLine.length) / 2);
            console.gotoxy(leftOddsX, oddsY);
            console.putmsg(oddsDisplay.leftLine, leftOddsAttr);

            // Right side odds (blue team)
            var rightOddsX = rightFrameX + Math.floor((frameWidth - oddsDisplay.rightLine.length) / 2);
            console.gotoxy(rightOddsX, oddsY);
            console.putmsg(oddsDisplay.rightLine, rightOddsAttr);

            // Add betting prompt if betting is enabled
            if (allowBetting) {
                var bettingPrompt = "Press [B] to place bets!";
                var promptX = baseX + Math.floor((graphicWidth - bettingPrompt.length) / 2);
                var promptY = oddsY + 2;
                console.gotoxy(promptX, promptY);
                console.putmsg(bettingPrompt, YELLOW | BG_BLACK);
            }
        } catch (e) {
            // Silently fail if bookie.js not loaded
        }
    }

    var durationMs = 10000;
    var startTime = Date.now();
    while (Date.now() - startTime < durationMs) {
        var now = Date.now();
        var changed = false;
        for (var i = 0; i < turnInfo.length; i++) {
            var info = turnInfo[i];
            var sprite = info.sprite;
            if (!sprite || !info.bearings || info.bearings.length === 0) continue;
            if (now >= info.nextTurn) {
                var newBearing = info.bearings[Math.floor(Math.random() * info.bearings.length)];
                if (newBearing && sprite.turnTo) {
                    if (sprite.bearing !== newBearing) {
                        sprite.turnTo(newBearing);
                        changed = true;
                    }
                }
                info.nextTurn = now + 700 + Math.floor(Math.random() * 900);
            }
        }
        if (changed) {
            Sprite.cycle();
            updateTeamFrames();
        }
        cycleFrame(leftFrame);
        cycleFrame(rightFrame);
        var key = console.inkey(K_NONE, 100);

        // Check for betting mode ('B' key) if betting is allowed
        if (key && allowBetting && (key.toUpperCase() === 'B')) {
            // Prepare matchup data for betting interface
            if (typeof showBettingInterface === "function") {
                var matchupData = {
                    redTeam: leftTeamName,
                    blueTeam: rightTeamName,
                    redPlayers: leftPlayers,
                    bluePlayers: rightPlayers,
                    odds: oddsDisplay ? oddsDisplay.matchup : getMatchupOdds(leftPlayers, rightPlayers),
                    spread: calculateSpread(leftPlayers, rightPlayers),
                    total: calculateOverUnder(leftPlayers, rightPlayers),
                    teamColors: gameState.teamColors,
                    sprites: [leftSprites[0], leftSprites[1], rightSprites[0], rightSprites[1]]
                };

                var bettingSlip = showBettingInterface(matchupData);

                // Restore matchup screen after betting
                if (bettingSlip) {
                    // User placed bets - clean up and return the slip
                    for (var r = 0; r < turnInfo.length; r++) {
                        var entry = turnInfo[r];
                        if (entry.sprite && entry.originalBearing && entry.sprite.turnTo) {
                            entry.sprite.turnTo(entry.originalBearing);
                        }
                    }
                    Sprite.cycle();
                    if (leftFrame) leftFrame.close();
                    if (rightFrame) rightFrame.close();
                    console.print("\1n");
                    console.clear();
                    return bettingSlip;
                }
                // User cancelled - continue showing matchup screen
                continue;
            }
        }

        if (key) break;
        mswait(20);
    }

    for (var r = 0; r < turnInfo.length; r++) {
        var entry = turnInfo[r];
        if (entry.sprite && entry.originalBearing && entry.sprite.turnTo) {
            entry.sprite.turnTo(entry.originalBearing);
        }
    }
    Sprite.cycle();

    if (leftFrame) leftFrame.close();
    if (rightFrame) rightFrame.close();
    console.print("\1n");
    console.clear();
    return null;
}

function main() {
    resetGameState();
    // Show ANSI splash screen first
    showSplashScreen();

    // Load team data first
    loadTeamData();
    loadAnnouncerLibrary();

    initFrames();
    showIntro();

    // Main menu - choose play or demo
    var menuChoice = mainMenu();

    if (!menuChoice) {
        // User chose to quit
        return;
    }

    if (menuChoice === "demo") {
        // Run CPU vs CPU demo
        runCPUDemo();
    } else if (menuChoice === "multiplayer") {
        // Run multiplayer
        if (multiplayerEnabled) {
            runMultiplayerMode();
        } else {
            console.clear();
            console.print("\r\n\1r\1hMultiplayer not available!\1n\r\n\r\n");
            console.print("Multiplayer files not found. This installation may be incomplete.\r\n\r\n");
            console.print("Press any key to continue...");
            console.getkey();
        }
    } else if (menuChoice === "play") {
        var playAgain = true;
        var useNewTeams = false;
        var selection = null;

        while (playAgain) {
            if (!selection || useNewTeams) {
                // Team selection screen
                selection = teamSelectionScreen();
                if (!selection) {
                    // User quit during selection
                    return;
                }
                useNewTeams = false;
            }

            // Clear screen before starting game to remove selection artifacts
            console.clear();

            resetGameState({ allCPUMode: false });
            initSprites(
                selection.redTeam,
                selection.blueTeam,
                selection.redPlayers,
                selection.bluePlayers,
                false  // Not demo mode - player1 is human
            );

            showMatchupScreen();

            gameLoop();
            var choice = showGameOver(false); // Pass false for player mode

            if (choice === "quit") {
                playAgain = false;
            } else if (choice === "newteams") {
                useNewTeams = true;
                cleanupSprites(); // Clean up before new team selection
                resetGameState();
            } else if (choice === "playagain") {
                cleanupSprites(); // Clean up before restarting
                resetGameState();
            }
        }
    }

    function runMultiplayerMode() {
        // Run the lobby
        var lobbyResult = runMultiplayerLobby();

        if (!lobbyResult) {
            // User cancelled or connection failed
            return;
        }

        // Extract session info from lobby
        var sessionId = lobbyResult.sessionId;
        var session = lobbyResult.session;
        var client = lobbyResult.client;
        var myId = lobbyResult.myId;
        var serverConfig = lobbyResult.serverConfig;

        // Initialize coordinator
        var coordinator = new GameCoordinator(sessionId, client, serverConfig);
        coordinator.init();
        mpCoordinator = coordinator; // Set global reference for event broadcasting

        // Initialize client
        var playerClient = new PlayerClient(sessionId, client, myId.globalId, serverConfig);
        playerClient.init();

        // Sync coordinator status to client (so client knows if it's authoritative)
        playerClient.isCoordinator = coordinator.isCoordinator;
        playerClient.disablePrediction = coordinator.isCoordinator;

        // Reset game state for multiplayer
        resetGameState({ allCPUMode: false });

        // Refresh session data from game namespace to capture final team assignments
        var liveSession = client.read("nba_jam", "game." + sessionId + ".meta", 1);
        if (!liveSession) {
            // Fallback to lobby snapshot in case the game meta hasn't been written yet
            liveSession = client.read("nba_jam", "lobby.sessions." + sessionId, 1);
        }
        if (liveSession) {
            session = liveSession;
            ensureTeamContainers(session);
        }

        // Determine player assignments from session
        var playerAssignments = assignMultiplayerPlayers(session, myId);

        // Initialize sprites for multiplayer
        initMultiplayerSprites(session, playerAssignments, myId);

        // Create sprite map (global player ID -> sprite)
        var spriteMap = createMultiplayerSpriteMap(playerAssignments);
        coordinator.setPlayerSpriteMap(spriteMap);

        // Debug: Log sprite map
        debugLog("=== Sprite Map Created ===");
        debugLog("My ID: " + myId.globalId);
        debugLog("Is Coordinator: " + (coordinator.isCoordinator ? "YES" : "NO"));
        for (var gid in spriteMap) {
            if (spriteMap.hasOwnProperty(gid)) {
                var sprite = spriteMap[gid];
                var spriteName = sprite ? (sprite.playerData ? sprite.playerData.name : "unnamed") : "NULL";
                debugLog("  " + gid + " -> " + spriteName);
            }
        }

        // Set my sprite for client prediction
        var mySprite = spriteMap[myId.globalId];
        if (mySprite) {
            playerClient.setMySprite(mySprite);
            debugLog("SUCCESS: My sprite found: " + mySprite.playerData.name);
        } else {
            debugLog("ERROR: My sprite NOT FOUND for globalId: " + myId.globalId);
        }

        // Set sprite map so client can update remote player positions
        playerClient.setSpriteMap(spriteMap);

        // Tell client if we're coordinator (disables prediction to avoid double input)
        playerClient.setCoordinatorStatus(coordinator.isCoordinator);

        // Show matchup screen
        showMatchupScreen();

        // Run multiplayer game loop
        runMultiplayerGameLoop(coordinator, playerClient, myId);

        // Cleanup
        mpCoordinator = null; // Clear global reference
        coordinator.cleanup();
        playerClient.cleanup();
        cleanupSprites();

        // Show game over screen
        showGameOver(false);
    }

    function assignMultiplayerPlayers(session, myId) {
        var assignments = {
            redPlayer1: null,
            redPlayer2: null,
            bluePlayer1: null,
            bluePlayer2: null
        };

        if (!session || !session.teams) {
            return assignments;
        }

        // Assign players based on team selections
        var redPlayers = session.teams.red.players || [];
        var bluePlayers = session.teams.blue.players || [];

        if (redPlayers.length > 0) {
            assignments.redPlayer1 = redPlayers[0];
        }
        if (redPlayers.length > 1) {
            assignments.redPlayer2 = redPlayers[1];
        }

        if (bluePlayers.length > 0) {
            assignments.bluePlayer1 = bluePlayers[0];
        }
        if (bluePlayers.length > 1) {
            assignments.bluePlayer2 = bluePlayers[1];
        }

        return assignments;
    }

    function clampRosterIndexForGame(index, teamDef) {
        if (!teamDef || !teamDef.players || teamDef.players.length === 0)
            return 0;
        var value = parseInt(index, 10);
        if (isNaN(value)) value = 0;
        if (value < 0) value = 0;
        if (value >= teamDef.players.length) value = teamDef.players.length - 1;
        return value;
    }

    function findAvailableRosterIndexForGame(teamDef, used) {
        if (!teamDef || !teamDef.players || teamDef.players.length === 0)
            return 0;
        for (var i = 0; i < teamDef.players.length; i++) {
            if (!used[i])
                return i;
        }
        return 0;
    }

    function resolveTeamPlayerIndices(teamSideData, teamDef) {
        var indices = { player1: 0, player2: 1 };
        var rosterChoices = (teamSideData && teamSideData.roster) || {};
        var playersList = (teamSideData && teamSideData.players) || [];
        var used = {};

        if (playersList.length > 0) {
            var choice = rosterChoices[playersList[0]];
            if (choice && typeof choice.index === "number") {
                indices.player1 = clampRosterIndexForGame(choice.index, teamDef);
            }
            used[indices.player1] = true;
        }

        if (playersList.length > 1) {
            var choice2 = rosterChoices[playersList[1]];
            if (choice2 && typeof choice2.index === "number") {
                var idx2 = clampRosterIndexForGame(choice2.index, teamDef);
                if (used[idx2])
                    idx2 = findAvailableRosterIndexForGame(teamDef, used);
                indices.player2 = idx2;
            } else {
                indices.player2 = findAvailableRosterIndexForGame(teamDef, used);
            }
            used[indices.player2] = true;
        } else {
            var cpuIdx = (teamSideData && typeof teamSideData.cpuIndex === "number") ? clampRosterIndexForGame(teamSideData.cpuIndex, teamDef) : null;
            if (cpuIdx === null || used[cpuIdx]) {
                cpuIdx = findAvailableRosterIndexForGame(teamDef, used);
            }
            indices.player2 = cpuIdx;
        }

        indices.player1 = clampRosterIndexForGame(indices.player1, teamDef);
        indices.player2 = clampRosterIndexForGame(indices.player2, teamDef);
        return indices;
    }

    function getSessionPlayerAlias(session, playerId) {
        if (!session || !session.players || !playerId)
            return null;
        var profile = session.players[playerId];
        if (!profile)
            return null;
        return profile.displayName || profile.userName || profile.nick || profile.name || profile.alias || playerId;
    }

    function applyMultiplayerControllerLabels(session, assignments) {
        function applyLabel(sprite, playerId) {
            if (!sprite || !sprite.playerData)
                return;
            if (playerId) {
                var alias = getSessionPlayerAlias(session, playerId);
                if (alias)
                    setSpriteControllerLabel(sprite, alias, true);
                else
                    setSpriteControllerLabel(sprite, "CPU", false);
            } else {
                setSpriteControllerLabel(sprite, "CPU", false);
            }
        }

        applyLabel(redPlayer1, assignments.redPlayer1);
        applyLabel(redPlayer2, assignments.redPlayer2);
        applyLabel(bluePlayer1, assignments.bluePlayer1);
        applyLabel(bluePlayer2, assignments.bluePlayer2);
    }

    function initMultiplayerSprites(session, assignments, myId) {
        // Use team names from session
        var redSideData = (session.teams && session.teams.red) || { name: "lakers", players: [], roster: {} };
        var blueSideData = (session.teams && session.teams.blue) || { name: "celtics", players: [], roster: {} };
        var redTeamName = redSideData.name || "lakers";
        var blueTeamName = blueSideData.name || "celtics";
        var redTeamDef = NBATeams[redTeamName];
        var blueTeamDef = NBATeams[blueTeamName];

        var redPlayerIndices = resolveTeamPlayerIndices(redSideData, redTeamDef);
        var bluePlayerIndices = resolveTeamPlayerIndices(blueSideData, blueTeamDef);

        // Determine if we're a human player
        var isRedHuman = (assignments.redPlayer1 === myId.globalId || assignments.redPlayer2 === myId.globalId);

        // Initialize sprites (same as single-player, but mark human/AI appropriately)
        initSprites(
            redTeamName,
            blueTeamName,
            redPlayerIndices,
            bluePlayerIndices,
            false // allCPUMode = false, at least one human
        );

        // Set controller types based on assignments
        // controllerType: "local" = controlled by this client
        //                 "remote" = controlled by another client
        //                 "ai" = CPU controlled
        // NOTE: Remote players are HUMAN (controlled by another human), not AI!
        if (redPlayer1) {
            if (assignments.redPlayer1 === myId.globalId) {
                redPlayer1.controllerType = "local";
                redPlayer1.isHuman = true;
            } else if (assignments.redPlayer1) {
                redPlayer1.controllerType = "remote";
                redPlayer1.isHuman = true; // Remote = human controlled, just not by me
            } else {
                redPlayer1.controllerType = "ai";
                redPlayer1.isHuman = false;
            }
            redPlayer1.controlledBy = assignments.redPlayer1 || null;
        }
        if (redPlayer2) {
            if (assignments.redPlayer2 === myId.globalId) {
                redPlayer2.controllerType = "local";
                redPlayer2.isHuman = true;
            } else if (assignments.redPlayer2) {
                redPlayer2.controllerType = "remote";
                redPlayer2.isHuman = true; // Remote = human controlled, just not by me
            } else {
                redPlayer2.controllerType = "ai";
                redPlayer2.isHuman = false;
            }
            redPlayer2.controlledBy = assignments.redPlayer2 || null;
        }
        if (bluePlayer1) {
            if (assignments.bluePlayer1 === myId.globalId) {
                bluePlayer1.controllerType = "local";
                bluePlayer1.isHuman = true;
            } else if (assignments.bluePlayer1) {
                bluePlayer1.controllerType = "remote";
                bluePlayer1.isHuman = true; // Remote = human controlled, just not by me
            } else {
                bluePlayer1.controllerType = "ai";
                bluePlayer1.isHuman = false;
            }
            bluePlayer1.controlledBy = assignments.bluePlayer1 || null;
        }
        if (bluePlayer2) {
            if (assignments.bluePlayer2 === myId.globalId) {
                bluePlayer2.controllerType = "local";
                bluePlayer2.isHuman = true;
            } else if (assignments.bluePlayer2) {
                bluePlayer2.controllerType = "remote";
                bluePlayer2.isHuman = true; // Remote = human controlled, just not by me
            } else {
                bluePlayer2.controllerType = "ai";
                bluePlayer2.isHuman = false;
            }
            bluePlayer2.controlledBy = assignments.bluePlayer2 || null;
        }

        applyMultiplayerControllerLabels(session, assignments);
    }

    function createMultiplayerSpriteMap(assignments) {
        var map = {};
        var debugInfo = [];

        // Add ALL sprites to map, using synthetic IDs for AI-controlled sprites
        // This ensures AI sprites can be synced across clients

        if (redPlayer1) {
            var red1Id = assignments.redPlayer1 || "AI_RED_1";
            map[red1Id] = redPlayer1;
            debugInfo.push("Red1: " + red1Id + " -> " + (redPlayer1.controllerType || "?"));
        }

        if (redPlayer2) {
            var red2Id = assignments.redPlayer2 || "AI_RED_2";
            map[red2Id] = redPlayer2;
            debugInfo.push("Red2: " + red2Id + " -> " + (redPlayer2.controllerType || "?"));
        }

        if (bluePlayer1) {
            var blue1Id = assignments.bluePlayer1 || "AI_BLUE_1";
            map[blue1Id] = bluePlayer1;
            debugInfo.push("Blue1: " + blue1Id + " -> " + (bluePlayer1.controllerType || "?"));
        }

        if (bluePlayer2) {
            var blue2Id = assignments.bluePlayer2 || "AI_BLUE_2";
            map[blue2Id] = bluePlayer2;
            debugInfo.push("Blue2: " + blue2Id + " -> " + (bluePlayer2.controllerType || "?"));
        }

        // Verify no duplicate sprite objects in map
        var spriteValues = [];
        var duplicateFound = false;
        for (var gid in map) {
            if (map.hasOwnProperty(gid)) {
                var sprite = map[gid];
                for (var i = 0; i < spriteValues.length; i++) {
                    if (spriteValues[i] === sprite) {
                        log(LOG_ERR, "NBA JAM: DUPLICATE SPRITE IN MAP! GlobalID " + gid + " maps to same sprite as another player");
                        duplicateFound = true;
                    }
                }
                spriteValues.push(sprite);
            }
        }

        log(LOG_DEBUG, "NBA JAM: Sprite map created - " + debugInfo.join(", "));

        return map;
    }

    function runMultiplayerGameLoop(coordinator, playerClient, myId) {
        var frameNumber = 0;
        gameState.gameRunning = true;
        var lastSecond = Date.now();

        while (gameState.gameRunning && !js.terminated) {
            var frameStart = Date.now();

            gameState.tickCounter = (gameState.tickCounter + 1) % 1000000;

            // Handle input
            var key = console.inkey(K_NONE, 0);
            if (key) {
                if (key.toUpperCase() === 'Q') {
                    // Confirm quit
                    if (confirmMultiplayerQuit()) {
                        break;
                    }
                } else {
                    // Send input to client for prediction
                    playerClient.handleInput(key, frameNumber);
                }
            }

            // Coordinator processes inputs and runs game logic
            if (coordinator.isCoordinator) {
                var recoveryList = getAllPlayers();
                for (var r = 0; r < recoveryList.length; r++) {
                    decrementStealRecovery(recoveryList[r]);
                }
                coordinator.update();

                // Game clock management (only coordinator advances authoritative timers)
                var now = Date.now();
                if (now - lastSecond >= 1000) {
                    gameState.timeRemaining--;
                    gameState.shotClock--;
                    lastSecond = now;

                    // Handle halftime transition
                    if (gameState.currentHalf === 1 && gameState.timeRemaining <= gameState.totalGameTime / 2) {
                        gameState.currentHalf = 2;
                        showHalftimeScreen();
                        if (!gameState.gameRunning) {
                            break;
                        }

                        if (gameState.pendingSecondHalfInbound) {
                            startSecondHalfInbound();
                        }
                        drawCourt();
                        drawScore();
                        lastSecond = Date.now();
                    }
                }

                var violationTriggeredThisFrame = false;

                // Shot clock violation handling (authoritative on coordinator)
                if (gameState.shotClock <= 0) {
                    announceEvent("shot_clock_violation", { team: gameState.currentTeam });
                    switchPossession();
                    gameState.shotClock = 24;
                }

                // Track ball handler movement / five-second logic
                if (gameState.ballCarrier && !gameState.inbounding) {
                    var ballHandler = gameState.ballCarrier;
                    var distanceMoved = Math.sqrt(
                        Math.pow(ballHandler.x - gameState.ballHandlerLastX, 2) +
                        Math.pow(ballHandler.y - gameState.ballHandlerLastY, 2)
                    );

                    var opponentTeamName = (gameState.currentTeam === "red") ? "blue" : "red";
                    var closestDefender = getClosestPlayer(ballHandler.x, ballHandler.y, opponentTeamName);
                    var guardDistance = closestDefender ? getSpriteDistance(ballHandler, closestDefender) : 999;
                    var closelyGuarded = guardDistance <= 4;

                    if (distanceMoved < 3) {
                        gameState.ballHandlerStuckTimer++;
                        if (!ballHandler.isHuman &&
                            ballHandler.playerData &&
                            ballHandler.playerData.hasDribble !== false &&
                            closelyGuarded &&
                            gameState.ballHandlerStuckTimer >= 8) {
                            pickUpDribble(ballHandler, "stuck");
                        }
                    } else {
                        gameState.ballHandlerStuckTimer = 0;
                    }

                    gameState.ballHandlerLastX = ballHandler.x;
                    gameState.ballHandlerLastY = ballHandler.y;

                    if (ballHandler.playerData && ballHandler.playerData.hasDribble === false) {
                        // Store closely guarded distance for multiplayer synchronization
                        gameState.closelyGuardedDistance = guardDistance;

                        if (!closelyGuarded) {
                            gameState.ballHandlerDeadSince = null;
                            gameState.ballHandlerDeadFrames = 0;
                            gameState.ballHandlerDeadForcedShot = false;
                        } else if (!gameState.ballHandlerDeadSince) {
                            gameState.ballHandlerDeadSince = now;
                            gameState.ballHandlerDeadFrames = 1;
                        } else {
                            gameState.ballHandlerDeadFrames++;
                            var deadElapsed = now - gameState.ballHandlerDeadSince;
                            if (!gameState.ballHandlerDeadForcedShot && deadElapsed >= 4500) {
                                if (ballHandler && !ballHandler.isHuman) {
                                    gameState.ballHandlerDeadForcedShot = true;
                                    attemptShot();
                                    gameState.ballHandlerDeadSince = now;
                                    gameState.ballHandlerDeadFrames = 0;
                                    continue;
                                }
                            }
                            if (!violationTriggeredThisFrame && deadElapsed >= 5000) {
                                enforceFiveSecondViolation();
                                violationTriggeredThisFrame = true;
                            }
                        }
                    } else {
                        resetDeadDribbleTimer();
                    }

                    var attackDir = (gameState.currentTeam === "red") ? 1 : -1;
                    if (gameState.ballHandlerProgressOwner !== ballHandler) {
                        gameState.ballHandlerProgressOwner = ballHandler;
                        gameState.ballHandlerFrontcourtStartX = ballHandler.x;
                        gameState.ballHandlerAdvanceTimer = 0;
                    }

                    var handlerInBackcourt = isInBackcourt(ballHandler, gameState.currentTeam);

                    if (!gameState.frontcourtEstablished || handlerInBackcourt) {
                        gameState.ballHandlerFrontcourtStartX = ballHandler.x;
                        gameState.ballHandlerAdvanceTimer = 0;
                    } else {
                        var forwardDelta = (ballHandler.x - gameState.ballHandlerFrontcourtStartX) * attackDir;
                        if (forwardDelta < -1) {
                            gameState.ballHandlerFrontcourtStartX = ballHandler.x;
                            forwardDelta = 0;
                        }
                        if (forwardDelta < 4) {
                            gameState.ballHandlerAdvanceTimer++;
                        } else {
                            gameState.ballHandlerFrontcourtStartX = ballHandler.x;
                            gameState.ballHandlerAdvanceTimer = 0;
                        }
                    }
                } else {
                    gameState.ballHandlerAdvanceTimer = 0;
                    gameState.ballHandlerProgressOwner = null;
                    resetDeadDribbleTimer();
                }

                // Unified violation checking (extracted to shared function)
                violationTriggeredThisFrame = checkViolations(violationTriggeredThisFrame);

                // Skip rest of frame if violation occurred (prevents re-triggering)
                if (violationTriggeredThisFrame) {
                    lastSecond = Date.now();
                    frameNumber++;
                    continue;
                }

                // Run core game logic (physics, AI, collisions) - coordinator only
                checkSpriteCollision();

                // Update AI for non-player-controlled sprites
                updateAI();
            }

            // Client reconciles with server state
            playerClient.update(frameNumber);

            // Update visuals (all clients render)
            updateAnnouncer();

            // Only redraw court when no animations are active (allows trails to accumulate)
            if (!animationSystem.isBallAnimating()) {
                drawCourt();
            }

            drawScore();

            // Draw network quality HUD
            drawMultiplayerNetworkHUD(playerClient);

            // Sprite cycle
            Sprite.cycle();

            // Update non-blocking animations
            animationSystem.update();

            // Update non-blocking rebound scramble
            updateReboundScramble();

            // Cycle trail frame to display animation trails
            if (trailFrame) {
                cycleFrame(trailFrame);
                // Keep ball on top of trail layer
                if (ballFrame && ballFrame.is_open) {
                    ballFrame.top();
                }
            }

            // Check game end conditions
            if (gameState.timeRemaining <= 0) {
                gameState.gameRunning = false;
            }

            // Frame timing (20 FPS - appropriate for terminal gameplay)
            var frameTime = Date.now() - frameStart;
            var targetFrameTime = 50; // ~20 FPS
            if (frameTime < targetFrameTime) {
                mswait(targetFrameTime - frameTime);
            }

            frameNumber++;
        }
    }

    function drawMultiplayerNetworkHUD(playerClient) {
        if (!playerClient || !scoreFrame) return;

        var display = playerClient.getNetworkDisplay();
        if (!display) return;

        // Draw in top-right corner of score frame
        scoreFrame.gotoxy(60, 1);
        scoreFrame.putmsg(format("NET: %s%s %dms\1n",
            display.color,
            display.bars,
            display.latency), WHITE | BG_BLACK);
    }

    function confirmMultiplayerQuit() {
        console.clear();
        console.print("\r\n\r\n\1h\1yQuit multiplayer game?\1n\r\n\r\n");
        console.print("This will disconnect you from the game session.\r\n\r\n");
        console.print("\1h\1wY\1n\1kes / \1h\1wN\1n\1ko: ");

        var key = console.getkey();
        return (key && key.toUpperCase() === 'Y');
    }

    // Cleanup
    if (ballFrame) ballFrame.close();
    if (redPlayer1) redPlayer1.remove();
    if (redPlayer2) redPlayer2.remove();
    if (bluePlayer1) bluePlayer1.remove();
    if (bluePlayer2) bluePlayer2.remove();
    if (courtFrame) courtFrame.close();
    cleanupScoreFrames();
    if (scoreFrame) scoreFrame.close();
    if (announcerFrame) announcerFrame.close();
}

main();
