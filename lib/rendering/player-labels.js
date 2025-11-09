// NBA Jam Player Label Rendering
// On-screen player name/jersey labels and dunk flash effects

// ============================================================================
// PLAYER LABEL FRAME MANAGEMENT
// ============================================================================

function ensurePlayerLabelFrame(player) {
    if (!player || !player.frame || !courtFrame) return null;
    if (player.labelFrame && player.labelFrame.__destroyed) {
        try { player.labelFrame.close(); } catch (e) { }
        player.labelFrame = null;
    }
    if (!player.labelFrame) {
        player.labelFrame = new Frame(player.x || 1, player.y || 1, PLAYER_LABEL_WIDTH, 1, WAS_BROWN, courtFrame);
        player.labelFrame.transparent = false;
        player.labelFrame.open();
    }
    return player.labelFrame;
}

// ============================================================================
// PLAYER LABEL RENDERING
// ============================================================================

function renderPlayerLabel(player, options, systems) {
    options = options || {};
    if (!player || !player.playerData || !player.x || !player.y) return null;
    if (!systems || !systems.stateManager) {
        throw new Error("renderPlayerLabel requires systems with stateManager");
    }

    var labelFrame = ensurePlayerLabelFrame(player);
    if (!labelFrame) return null;

    var displayText;
    if (options.forcedText !== undefined && options.forcedText !== null) {
        displayText = String(options.forcedText);
    } else if (player.playerData.shortNick && player.playerData.shortNick.length > 0) {
        displayText = player.playerData.shortNick;
    } else {
        displayText = String(player.playerData.jersey);
    }

    var xPos = player.x;
    var yPos = player.y;
    var stateManager = systems.stateManager;
    var ballCarrier = stateManager.get('ballCarrier');
    var isCarrier = (ballCarrier === player);

    if (yPos <= 0 || yPos > COURT_HEIGHT || xPos <= 0 || xPos > COURT_WIDTH) {
        labelFrame.clear();
        if (typeof labelFrame.bottom === "function") labelFrame.bottom();
        return { frame: labelFrame, isCarrier: isCarrier, visible: false };
    }

    var teamKey = getPlayerTeamName(player);
    var highlightCarrier = options.highlightCarrier !== false;
    var allTeamColors = stateManager.get('teamColors');
    var teamColors = (teamKey && allTeamColors) ? allTeamColors[teamKey] : null;
    var baseFg = (teamColors && typeof teamColors.fg === "number") ? teamColors.fg : WHITE;
    var baseBg = WAS_BROWN;
    var fillAttr = baseFg | baseBg;
    var textFg = baseFg;
    var textBg = baseBg;

    var baselineColors = null;
    if (highlightCarrier && isCarrier && (teamKey === "teamA" || teamKey === "teamB")) {
        baselineColors = getTeamBaselineColors(teamKey, systems);
        if (baselineColors) {
            textFg = baselineColors.fg;
            textBg = baselineColors.bg;
        }
    }

    var usingFlashOverride = options.flashPalette && options.flashPalette.length;

    if (!usingFlashOverride && player.playerData && player.playerData.onFire) {
        textFg = getFireFg(0, systems);
        if (!baselineColors) {
            textBg = baseBg;
        }
    }

    var textAttr = composeAttrWithColor(fillAttr, textFg, textBg);

    if (usingFlashOverride) {
        var palette = options.flashPalette;
        var tickCounter = stateManager.get('tickCounter');
        var tick = (typeof options.flashTick === "number") ? options.flashTick : tickCounter;
        var idx = ((tick % palette.length) + palette.length) % palette.length;
        textAttr = palette[idx];
    }

    var visibleText = displayText;
    if (visibleText.length > labelFrame.width) {
        visibleText = visibleText.slice(0, labelFrame.width);
    }

    var maxLeft = COURT_WIDTH - labelFrame.width + 1;
    var labelX = Math.max(1, Math.min(xPos, maxLeft));

    labelFrame.moveTo(labelX, yPos);
    labelFrame.clear(fillAttr);
    var centeredStart = Math.max(1, Math.floor((labelFrame.width - visibleText.length) / 2) + 1);
    labelFrame.gotoxy(centeredStart, 1);
    labelFrame.putmsg(visibleText, textAttr);

    if (options.forceTop && typeof labelFrame.top === "function") {
        labelFrame.top();
    }

    return { frame: labelFrame, isCarrier: isCarrier, visible: true };
}

// ============================================================================
// DUNK LABEL EFFECTS
// ============================================================================

function getDunkLabelText(style, tick) {
    var words = DUNK_LABEL_WORDS;
    if (style === "hang") {
        words = ["HANG!", "GLIDE", "SOAR!"];
    } else if (style === "power") {
        words = ["POWER", "BOOM!", "CRUSH"];
    }
    var index = ((tick || 0) % words.length + words.length) % words.length;
    return words[index];
}

function getDunkFlashPalette(player) {
    var teamKey = getPlayerTeamName(player);
    var base = getTeamBaselineColors(teamKey) || { fg: WHITE, bg: BG_BLACK };
    var bg = (typeof base.bg === "number") ? base.bg : BG_BLACK;
    return [
        base.fg | bg,
        WHITE | bg,
        YELLOW | bg,
        LIGHTRED | bg
    ];
}
