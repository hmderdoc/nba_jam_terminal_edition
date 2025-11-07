// NBA Jam Scoreboard and HUD Utilities
// Manages score/turbo display frames and associated rendering helpers

var scoreFrame = null;
var leftScoreFrame = null;
var rightScoreFrame = null;

var scoreFontModule = null;
var scoreFontData = null;
var scoreFontInitAttempted = false;
var SCORE_FONT_DEFAULT_JUSTIFY = 2;
var SCORE_FONT_MIN_WIDTH = 6;

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

/**
 * Set frontcourt established and potentially stop score flash
 * NOTE: Uses score flash functions from lib/game-logic/score-calculator.js
 */
function setFrontcourtEstablished(teamName) {
    if (gameState.frontcourtEstablished) return;
    gameState.frontcourtEstablished = true;
    var state = gameState.scoreFlash;
    if (state && state.active && state.stopTeam === teamName) {
        stopScoreFlash(state.activeTeam);
    }
}

/**
 * Get player's jersey display value
 * NOTE: Uses calculateJerseyDisplay from lib/game-logic/score-calculator.js
 */
function getJerseyDisplayValue(player) {
    return calculateJerseyDisplay(player);
}

function getTurboBarWidth(player) {
    if (!player || !player.playerData) return 0;
    var jerseyDisplay = getJerseyDisplayValue(player);
    var prefix = "#" + jerseyDisplay;
    var prefixLength = prefix.length;
    var barLength = 6;
    return prefixLength + 2 + barLength;
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

    var teamBTeamName = (gameState.teamNames.teamB || "BLUE").toUpperCase();
    var teamATeamName = (gameState.teamNames.teamA || "RED").toUpperCase();
    var teamBTeamAbbr = (gameState.teamAbbrs && gameState.teamAbbrs.teamB) ? String(gameState.teamAbbrs.teamB).toUpperCase() : "BLU";
    var teamATeamAbbr = (gameState.teamAbbrs && gameState.teamAbbrs.teamA) ? String(gameState.teamAbbrs.teamA).toUpperCase() : "RED";

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
