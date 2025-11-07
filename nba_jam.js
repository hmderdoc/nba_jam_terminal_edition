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
load(js.exec_dir + "lib/rendering/jump-indicators.js");
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
load(js.exec_dir + "lib/game-logic/input-handler.js");
load(js.exec_dir + "lib/game-logic/violations.js");
load(js.exec_dir + "lib/game-logic/stats-tracker.js");
load(js.exec_dir + "lib/bookie/bookie.js");
load(js.exec_dir + "lib/utils/player-helpers.js");
load(js.exec_dir + "lib/utils/positioning-helpers.js");
load(js.exec_dir + "lib/ui/score-display.js");
load(js.exec_dir + "lib/ui/game-over.js");
load(js.exec_dir + "lib/ai/ai-decision-support.js");
load(js.exec_dir + "lib/ai/ai-movement-utils.js");
load(js.exec_dir + "lib/ai/ai-ball-handler.js");
load(js.exec_dir + "lib/ai/ai-movement.js");
load(js.exec_dir + "lib/core/sprite-init.js");
load(js.exec_dir + "lib/animation/bearing-frames.js");

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

load(js.exec_dir + "lib/ai/ai-decision-support.js");
load(js.exec_dir + "lib/ai/offense-ball-handler.js");
load(js.exec_dir + "lib/ai/offense-off-ball.js");
load(js.exec_dir + "lib/ai/defense-on-ball.js");
load(js.exec_dir + "lib/ai/defense-help.js");
load(js.exec_dir + "lib/ai/coordinator.js");
load(js.exec_dir + "lib/ui/announcer.js");
load(js.exec_dir + "lib/ui/scoreboard.js");
load(js.exec_dir + "lib/ui/menus.js");
load(js.exec_dir + "lib/ui/game-over.js");
load(js.exec_dir + "lib/ui/halftime.js");

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
    var sprites = [teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2];
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

    var teamBTeamName = (gameState.teamNames.teamB || "TEAM B").toUpperCase();
    var teamATeamName = (gameState.teamNames.teamA || "TEAM A").toUpperCase();
    var teamBTeamAbbr = (gameState.teamAbbrs && gameState.teamAbbrs.teamB) ? String(gameState.teamAbbrs.teamB).toUpperCase() : "TEMB";
    var teamATeamAbbr = (gameState.teamAbbrs && gameState.teamAbbrs.teamA) ? String(gameState.teamAbbrs.teamA).toUpperCase() : "TEAM A";

    if (teamBTeamAbbr && teamATeamAbbr && teamBTeamAbbr.replace(/\s+/g, "") === teamATeamAbbr.replace(/\s+/g, "")) {
        var baseAbbr = teamBTeamAbbr.replace(/\s+/g, "");
        if (!baseAbbr.length) baseAbbr = "TEAM";
        var trimmedBase = baseAbbr;
        if (trimmedBase.length > 5) {
            trimmedBase = trimmedBase.substring(0, 5);
        }
        teamBTeamAbbr = trimmedBase + "1";
        teamATeamAbbr = trimmedBase + "2";
    }

    var teamBScoreValue = String(gameState.score.teamB);
    var teamAScoreValue = String(gameState.score.teamA);
    var teamBScoreText = padStart(teamBScoreValue, 3, ' ');
    var teamAScoreText = padStart(teamAScoreValue, 3, ' ');

    var teamBBg = (gameState.teamColors.teamB && gameState.teamColors.teamB.bg !== undefined) ? gameState.teamColors.teamB.bg : BG_BLACK;
    var teamABg = (gameState.teamColors.teamA && gameState.teamColors.teamA.bg !== undefined) ? gameState.teamColors.teamA.bg : BG_BLACK;
    var teamBNameColor = (gameState.teamColors.teamB ? gameState.teamColors.teamB.fg : LIGHTBLUE) | teamBBg;
    var teamANameColor = (gameState.teamColors.teamA ? gameState.teamColors.teamA.fg : LIGHTRED) | teamABg;
    var panelBgMask = scorePanelAttr & BG_MASK;
    var teamBScoreFg = (gameState.teamColors.teamB ? gameState.teamColors.teamB.fg : WHITE) & FG_MASK;
    var teamAScoreFg = (gameState.teamColors.teamA ? gameState.teamColors.teamA.fg : WHITE) & FG_MASK;

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
    var blueFlashOn = flashOn && flashInfo.activeTeam === "teamB";
    var redFlashOn = flashOn && flashInfo.activeTeam === "teamA";
    var whiteFg = WHITE & FG_MASK;
    var flashFg = LIGHTGRAY & FG_MASK;

    if (blueFlashOn) {
        if (teamBScoreFg === whiteFg) {
            teamBScoreFg = flashFg;
        } else {
            teamBScoreFg = whiteFg;
        }
    }
    if (redFlashOn) {
        if (teamAScoreFg === whiteFg) {
            teamAScoreFg = flashFg;
        } else {
            teamAScoreFg = whiteFg;
        }
    }

    var teamBScorePanelAttr = teamBScoreFg | panelBgMask;
    var teamAScorePanelAttr = teamAScoreFg | panelBgMask;
    var teamBScoreBoardAttr = teamBScoreFg | BG_BLACK;
    var teamAScoreBoardAttr = teamAScoreFg | BG_BLACK;

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
        var leftName = teamBTeamName;
        if (leftName.length > leftAvailable) {
            leftName = leftName.slice(0, leftAvailable);
        }
        if (leftName.length > 0) {
            scoreFrame.gotoxy(leftNameStart, 1);
            scoreFrame.putmsg(leftName, teamBNameColor);
        }
    }

    var rightNameEnd = frameWidth - sideMargin;
    var rightNameStartMin = clockRight + clockGap + 1;
    var rightAvailable = Math.max(0, rightNameEnd - rightNameStartMin + 1);
    if (rightAvailable > 0) {
        var rightName = teamATeamName;
        if (rightName.length > rightAvailable) {
            rightName = rightName.slice(rightName.length - rightAvailable);
        }
        if (rightName.length > 0) {
            var rightNameStart = Math.max(rightNameStartMin, rightNameEnd - rightName.length + 1);
            scoreFrame.gotoxy(rightNameStart, 1);
            scoreFrame.putmsg(rightName, teamANameColor);
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
        { player: teamBPlayer1, x: 1 },
        { player: teamBPlayer2, x: 12 }
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
        { player: teamAPlayer1, x: 59 },
        { player: teamAPlayer2, x: 70 }
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
                leftRendered = renderScoreDigits(leftFrame, teamBScoreValue, teamBScorePanelAttr, scorePanelAttr);
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
        var fallbackLeftStart = Math.max(minLeftStart, maxLeftEnd - teamBScoreText.length + 1);
        var fallbackLeftEnd = fallbackLeftStart + teamBScoreText.length - 1;
        leftPanelStart = fallbackLeftStart;
        leftPanelEnd = fallbackLeftEnd;
        if (leftFrame) {
            renderFallbackScore(leftFrame, teamBScoreText.trim(), teamBScorePanelAttr, scorePanelAttr);
        } else if (fallbackLeftStart <= maxLeftEnd && fallbackLeftEnd <= maxLeftEnd) {
            scoreFrame.gotoxy(fallbackLeftStart, shotClockRow);
            scoreFrame.putmsg(teamBScoreText, teamBScoreBoardAttr);
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
                rightRendered = renderScoreDigits(rightFrame, teamAScoreValue, teamAScorePanelAttr, scorePanelAttr);
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
        var maxRightStart = frameWidth - sideMargin - teamAScoreText.length + 1;
        if (rightFrame) {
            renderFallbackScore(rightFrame, teamAScoreText.trim(), teamAScorePanelAttr, scorePanelAttr);
        } else if (minRightStart <= maxRightStart) {
            var fallbackRightStart = maxRightStart;
            scoreFrame.gotoxy(fallbackRightStart, shotClockRow);
            scoreFrame.putmsg(teamAScoreText, teamAScoreBoardAttr);
            rightPanelStart = fallbackRightStart;
            rightPanelEnd = fallbackRightStart + teamAScoreText.length - 1;
        }
    }

    if (teamBPlayer1 && teamBPlayer1.playerData) {
        updatePlayerShoeColor(teamBPlayer1);
        scoreFrame.gotoxy(1, turboRow);
        drawTurboBar(teamBPlayer1);
    }
    if (teamBPlayer2 && teamBPlayer2.playerData) {
        updatePlayerShoeColor(teamBPlayer2);
        scoreFrame.gotoxy(12, turboRow);
        drawTurboBar(teamBPlayer2);
    }
    if (teamAPlayer1 && teamAPlayer1.playerData) {
        updatePlayerShoeColor(teamAPlayer1);
        scoreFrame.gotoxy(59, turboRow);
        drawTurboBar(teamAPlayer1);
    }
    if (teamAPlayer2 && teamAPlayer2.playerData) {
        updatePlayerShoeColor(teamAPlayer2);
        scoreFrame.gotoxy(70, turboRow);
        drawTurboBar(teamAPlayer2);
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

    renderPlayerSlot(2, teamBPlayer1, "teamB", 0);
    renderPlayerSlot(14, teamBPlayer2, "teamB", 3);
    renderPlayerSlot(60, teamAPlayer1, "teamA", 0);
    renderPlayerSlot(72, teamAPlayer2, "teamA", 3);

    renderControllerSlot(2, teamBPlayer1, "teamB");
    renderControllerSlot(14, teamBPlayer2, "teamB");
    renderControllerSlot(60, teamAPlayer1, "teamA");
    renderControllerSlot(72, teamAPlayer2, "teamA");

    var abbrRow = 5;
    if ((scoreFrame.height || 0) >= abbrRow) {
        var blueAbbrAttr = (gameState.teamColors.teamB ? gameState.teamColors.teamB.fg : WHITE) | BG_BLACK;
        var redAbbrAttr = (gameState.teamColors.teamA ? gameState.teamColors.teamA.fg : WHITE) | BG_BLACK;

        var leftWidth = leftPanelEnd - leftPanelStart + 1;
        if (leftWidth > 0) {
            var leftAbbr = teamBTeamAbbr;
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
            var rightAbbr = teamATeamAbbr;
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

// Bearing frame injection and animation functions loaded from lib/animation/bearing-frames.js

// Cleanup function for sprites
function cleanupSprites() {
    if (teamAPlayer1) {
        if (teamAPlayer1.frame) teamAPlayer1.frame.close();
        if (teamAPlayer1.labelFrame) {
            try { teamAPlayer1.labelFrame.close(); } catch (e) { }
            teamAPlayer1.labelFrame = null;
        }
    }
    if (teamAPlayer2) {
        if (teamAPlayer2.frame) teamAPlayer2.frame.close();
        if (teamAPlayer2.labelFrame) {
            try { teamAPlayer2.labelFrame.close(); } catch (e) { }
            teamAPlayer2.labelFrame = null;
        }
    }
    if (teamBPlayer1) {
        if (teamBPlayer1.frame) teamBPlayer1.frame.close();
        if (teamBPlayer1.labelFrame) {
            try { teamBPlayer1.labelFrame.close(); } catch (e) { }
            teamBPlayer1.labelFrame = null;
        }
    }
    if (teamBPlayer2) {
        if (teamBPlayer2.frame) teamBPlayer2.frame.close();
        if (teamBPlayer2.labelFrame) {
            try { teamBPlayer2.labelFrame.close(); } catch (e) { }
            teamBPlayer2.labelFrame = null;
        }
    }
    if (ballFrame) ballFrame.close();

    teamAPlayer1 = null;
    teamAPlayer2 = null;
    teamBPlayer1 = null;
    teamBPlayer2 = null;
    ballFrame = null;
}

// Load the shoved sprite template once for all players
// initSprites function loaded from lib/core/sprite-init.js
// Helper functions (getAllPlayers, getClosestPlayer, etc.) loaded from lib/utils/player-helpers.js

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

// Stats tracking functions loaded from lib/game-logic/stats-tracker.js
// clearPotentialAssist, recordTurnover, setPotentialAssist, maybeAwardAssist

function getTeamSprites(teamName) {
    return teamName === "teamA" ? getRedTeam() : getBlueTeam();
}

function getOpposingTeamSprites(teamName) {
    return teamName === "teamA" ? getBlueTeam() : getRedTeam();
}

// clamp function loaded from lib/utils/positioning-helpers.js

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

// Positioning helper functions loaded from lib/utils/positioning-helpers.js
// getSpriteDistanceToBasket, getBaseAttribute, getEffectiveAttribute, getSpriteDistance

// ===== NEW AI HELPER FUNCTIONS =====

/**
 * Check if player is in frontcourt or backcourt
 * @param {Object} player - The sprite to check
 * @param {string} teamName - "teamA" or "teamB"
 * @returns {boolean} true if in backcourt
 */
// isInBackcourt and wouldBeOverAndBack are in lib/game-logic/violations.js

// getTeammate is in lib/utils/player-helpers.js as getPlayerTeammate

// AI Decision Support Functions loaded from lib/ai/ai-decision-support.js
// Violations functions loaded from lib/game-logic/violations.js
// All AI helper functions loaded from lib/ai/ai-decision-support.js
// AI Movement utilities loaded from lib/ai/ai-movement-utils.js
// AI Ball Handler loaded from lib/ai/ai-ball-handler.js
// AI Off-Ball and Defense handlers loaded from lib/ai/ai-movement.js

// ============================================================================
// moveAITowards function is in lib/ai/ai-movement-utils.js

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
        teamA: (gameState.teamNames.teamA || "TEAM A").toUpperCase(),
        teamB: (gameState.teamNames.teamB || "TEAM B").toUpperCase()
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
                var opponentTeamName = (gameState.currentTeam === "teamA") ? "teamB" : "teamA";
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
                var attackDir = (gameState.currentTeam === "teamA") ? 1 : -1;
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

// === GAME MECHANICS ===
function pickUpDribble(player, reason) {
    if (!player || !player.playerData) return;
    if (player.playerData.hasDribble === false) return;
    player.playerData.hasDribble = false;
    if (player === teamAPlayer1 && reason === "user") {
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

// getTouchingOpponents and getBearingVector loaded from lib/utils/positioning-helpers.js

/**
 * AI SHOVE DECISION SYSTEM
 * Evaluates offensive and defensive shove opportunities with weighted priorities
 */

// Evaluate offensive shove opportunities per shove_documentation.md
// Evaluate defensive shove opportunities per shove_documentation.md
// Trigger defensive rotation when a defender is shoved (per shove_documentation.md)

// === DEMO MODE ===
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
        var teamATeam = NBATeams[redTeamKey];
        var teamBTeam = NBATeams[blueTeamKey];

        var redAvailablePlayers = [];
        var blueAvailablePlayers = [];

        // Get available players for each team using actual players array
        for (var i = 0; i < teamATeam.players.length; i++) {
            redAvailablePlayers.push(i);
        }
        for (var i = 0; i < teamBTeam.players.length; i++) {
            blueAvailablePlayers.push(i);
        }

        // Safety check - ensure we have at least 2 players per team
        if (redAvailablePlayers.length < 2) {
            // Fallback to default players (0 and 1, or 0 and 0 if only 1 player)
            redAvailablePlayers = [0, teamATeam.players.length > 1 ? 1 : 0];
        }
        if (blueAvailablePlayers.length < 2) {
            blueAvailablePlayers = [0, teamBTeam.players.length > 1 ? 1 : 0];
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
    var teamAScore = gameState.score.teamA || 0;
    var teamBScore = gameState.score.teamB || 0;
    var winner = teamAScore > teamBScore ? "teamA" : "teamB";

    // Find stat leaders
    var allPlayers = [];
    if (teamAPlayer1 && teamAPlayer1.playerData) allPlayers.push(teamAPlayer1.playerData);
    if (teamAPlayer2 && teamAPlayer2.playerData) allPlayers.push(teamAPlayer2.playerData);
    if (teamBPlayer1 && teamBPlayer1.playerData) allPlayers.push(teamBPlayer1.playerData);
    if (teamBPlayer2 && teamBPlayer2.playerData) allPlayers.push(teamBPlayer2.playerData);

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
        teamATeam: gameState.teamNames.teamA || redTeamKey,
        teamBTeam: gameState.teamNames.teamB || blueTeamKey,
        teamAScore: teamAScore,
        teamBScore: teamBScore,
        winner: winner,
        leaders: leaders
    };
}

function main() {
    resetGameState();
    // Show ANSI splash screen first
    showSplashScreen();

    // Load team data first
    loadTeamData();
    loadAnnouncerData();

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
    } else if (menuChoice === "lorb") {
        // Run LORB
        try {
            load(js.exec_dir + "lib/lorb/lorb.js");
        } catch (e) {
            console.clear();
            console.print("\r\n\1r\1hLORB not available!\1n\r\n\r\n");
            console.print("Error loading LORB: " + e + "\r\n\r\n");
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
                selection.teamATeam,
                selection.teamBTeam,
                selection.teamAPlayers,
                selection.teamBPlayers,
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
            teamAPlayer1: null,
            teamAPlayer2: null,
            teamBPlayer1: null,
            teamBPlayer2: null
        };

        if (!session || !session.teams) {
            return assignments;
        }

        // Assign players based on team selections
        var teamAPlayers = session.teams.teamA.players || [];
        var teamBPlayers = session.teams.teamB.players || [];

        if (teamAPlayers.length > 0) {
            assignments.teamAPlayer1 = teamAPlayers[0];
        }
        if (teamAPlayers.length > 1) {
            assignments.teamAPlayer2 = teamAPlayers[1];
        }

        if (teamBPlayers.length > 0) {
            assignments.teamBPlayer1 = teamBPlayers[0];
        }
        if (teamBPlayers.length > 1) {
            assignments.teamBPlayer2 = teamBPlayers[1];
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

        applyLabel(teamAPlayer1, assignments.teamAPlayer1);
        applyLabel(teamAPlayer2, assignments.teamAPlayer2);
        applyLabel(teamBPlayer1, assignments.teamBPlayer1);
        applyLabel(teamBPlayer2, assignments.teamBPlayer2);
    }

    function initMultiplayerSprites(session, assignments, myId) {
        // Use team names from session
        var redSideData = (session.teams && session.teams.teamA) || { name: "lakers", players: [], roster: {} };
        var blueSideData = (session.teams && session.teams.teamB) || { name: "celtics", players: [], roster: {} };
        var teamATeamName = redSideData.name || "lakers";
        var teamBTeamName = blueSideData.name || "celtics";
        var teamATeamDef = NBATeams[teamATeamName];
        var teamBTeamDef = NBATeams[teamBTeamName];

        var redPlayerIndices = resolveTeamPlayerIndices(redSideData, teamATeamDef);
        var bluePlayerIndices = resolveTeamPlayerIndices(blueSideData, teamBTeamDef);

        // Determine if we're a human player
        var isRedHuman = (assignments.teamAPlayer1 === myId.globalId || assignments.teamAPlayer2 === myId.globalId);

        // Initialize sprites (same as single-player, but mark human/AI appropriately)
        initSprites(
            teamATeamName,
            teamBTeamName,
            redPlayerIndices,
            bluePlayerIndices,
            false // allCPUMode = false, at least one human
        );

        // Set controller types based on assignments
        // controllerType: "local" = controlled by this client
        //                 "remote" = controlled by another client
        //                 "ai" = CPU controlled
        // NOTE: Remote players are HUMAN (controlled by another human), not AI!
        if (teamAPlayer1) {
            if (assignments.teamAPlayer1 === myId.globalId) {
                teamAPlayer1.controllerType = "local";
                teamAPlayer1.isHuman = true;
            } else if (assignments.teamAPlayer1) {
                teamAPlayer1.controllerType = "remote";
                teamAPlayer1.isHuman = true; // Remote = human controlled, just not by me
            } else {
                teamAPlayer1.controllerType = "ai";
                teamAPlayer1.isHuman = false;
            }
            teamAPlayer1.controlledBy = assignments.teamAPlayer1 || null;
        }
        if (teamAPlayer2) {
            if (assignments.teamAPlayer2 === myId.globalId) {
                teamAPlayer2.controllerType = "local";
                teamAPlayer2.isHuman = true;
            } else if (assignments.teamAPlayer2) {
                teamAPlayer2.controllerType = "remote";
                teamAPlayer2.isHuman = true; // Remote = human controlled, just not by me
            } else {
                teamAPlayer2.controllerType = "ai";
                teamAPlayer2.isHuman = false;
            }
            teamAPlayer2.controlledBy = assignments.teamAPlayer2 || null;
        }
        if (teamBPlayer1) {
            if (assignments.teamBPlayer1 === myId.globalId) {
                teamBPlayer1.controllerType = "local";
                teamBPlayer1.isHuman = true;
            } else if (assignments.teamBPlayer1) {
                teamBPlayer1.controllerType = "remote";
                teamBPlayer1.isHuman = true; // Remote = human controlled, just not by me
            } else {
                teamBPlayer1.controllerType = "ai";
                teamBPlayer1.isHuman = false;
            }
            teamBPlayer1.controlledBy = assignments.teamBPlayer1 || null;
        }
        if (teamBPlayer2) {
            if (assignments.teamBPlayer2 === myId.globalId) {
                teamBPlayer2.controllerType = "local";
                teamBPlayer2.isHuman = true;
            } else if (assignments.teamBPlayer2) {
                teamBPlayer2.controllerType = "remote";
                teamBPlayer2.isHuman = true; // Remote = human controlled, just not by me
            } else {
                teamBPlayer2.controllerType = "ai";
                teamBPlayer2.isHuman = false;
            }
            teamBPlayer2.controlledBy = assignments.teamBPlayer2 || null;
        }

        applyMultiplayerControllerLabels(session, assignments);
    }

    function createMultiplayerSpriteMap(assignments) {
        var map = {};
        var debugInfo = [];

        // Add ALL sprites to map, using synthetic IDs for AI-controlled sprites
        // This ensures AI sprites can be synced across clients

        if (teamAPlayer1) {
            var red1Id = assignments.teamAPlayer1 || "AI_RED_1";
            map[red1Id] = teamAPlayer1;
            debugInfo.push("Red1: " + red1Id + " -> " + (teamAPlayer1.controllerType || "?"));
        }

        if (teamAPlayer2) {
            var red2Id = assignments.teamAPlayer2 || "AI_RED_2";
            map[red2Id] = teamAPlayer2;
            debugInfo.push("Red2: " + red2Id + " -> " + (teamAPlayer2.controllerType || "?"));
        }

        if (teamBPlayer1) {
            var blue1Id = assignments.teamBPlayer1 || "AI_BLUE_1";
            map[blue1Id] = teamBPlayer1;
            debugInfo.push("Blue1: " + blue1Id + " -> " + (teamBPlayer1.controllerType || "?"));
        }

        if (teamBPlayer2) {
            var blue2Id = assignments.teamBPlayer2 || "AI_BLUE_2";
            map[blue2Id] = teamBPlayer2;
            debugInfo.push("Blue2: " + blue2Id + " -> " + (teamBPlayer2.controllerType || "?"));
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

                    var opponentTeamName = (gameState.currentTeam === "teamA") ? "teamB" : "teamA";
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

                    var attackDir = (gameState.currentTeam === "teamA") ? 1 : -1;
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
    if (teamAPlayer1) teamAPlayer1.remove();
    if (teamAPlayer2) teamAPlayer2.remove();
    if (teamBPlayer1) teamBPlayer1.remove();
    if (teamBPlayer2) teamBPlayer2.remove();
    if (courtFrame) courtFrame.close();
    cleanupScoreFrames();
    if (scoreFrame) scoreFrame.close();
    if (announcerFrame) announcerFrame.close();
}

main();
