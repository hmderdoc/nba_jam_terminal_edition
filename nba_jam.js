// NBA JAM - Terminal Basketball Arcade Game
// A Synchronet BBS door game using sprite.js

load("sbbsdefs.js");
load("frame.js");
load("sprite.js");
load("shoe_colors.js");

var COURT_SCREEN_Y_OFFSET = 1;
var BEEP_DEMO = false;

var ShoeColorConfig = (typeof SHOE_COLOR_CONFIG === "object" && SHOE_COLOR_CONFIG) ? SHOE_COLOR_CONFIG : {
    threshold: 45,
    palettes: [
        { name: "ember", high: LIGHTRED, low: RED },
        { name: "surf", high: LIGHTCYAN, low: CYAN },
        { name: "forest", high: LIGHTGREEN, low: GREEN },
        { name: "solar", high: YELLOW, low: BROWN },
        { name: "amethyst", high: LIGHTMAGENTA, low: MAGENTA },
        { name: "polar", high: WHITE, low: LIGHTGRAY },
        { name: "storm", high: LIGHTBLUE, low: BLUE },
        { name: "charcoal", high: DARKGRAY, low: BLACK }
    ]
};

var SHOE_TURBO_THRESHOLD = (typeof ShoeColorConfig.threshold === "number") ? ShoeColorConfig.threshold : 45;
var shoePalettePool = [];

var DEMO_GAME_SECONDS = 240;

function cloneShoePalette(entry) {
    if (!entry) return null;
    return {
        name: entry.name,
        high: entry.high,
        low: entry.low
    };
}

function buildShoePalettePool() {
    var pool = [];
    if (ShoeColorConfig && ShoeColorConfig.palettes && ShoeColorConfig.palettes.length) {
        for (var i = 0; i < ShoeColorConfig.palettes.length; i++) {
            pool.push(cloneShoePalette(ShoeColorConfig.palettes[i]));
        }
    }
    return pool;
}

function bgToFg(bgValue) {
    if (typeof bgValue !== "number") return null;
    return (bgValue & BG_MASK) >> 4;
}

function paletteConflictsWithTeam(palette, teamColors) {
    if (!palette || !teamColors) return false;
    var blocked = [];
    if (typeof teamColors.fg === "number") blocked.push(teamColors.fg & FG_MASK);
    if (typeof teamColors.fg_accent === "number") blocked.push(teamColors.fg_accent & FG_MASK);
    if (typeof teamColors.bg === "number") blocked.push(bgToFg(teamColors.bg));
    if (typeof teamColors.bg_alt === "number") blocked.push(bgToFg(teamColors.bg_alt));
    for (var i = 0; i < blocked.length; i++) {
        var color = blocked[i];
        if (color === null || color === undefined) continue;
        if (palette.high === color || palette.low === color) {
            return true;
        }
    }
    return false;
}

function resetShoePaletteAssignments() {
    shoePalettePool = buildShoePalettePool();
}

function assignShoePalette(teamColors) {
    if (!shoePalettePool || !shoePalettePool.length) {
        shoePalettePool = buildShoePalettePool();
    }
    var fallbackIndex = -1;
    for (var i = 0; i < shoePalettePool.length; i++) {
        var candidate = shoePalettePool[i];
        if (!candidate) continue;
        if (paletteConflictsWithTeam(candidate, teamColors)) {
            if (fallbackIndex === -1) fallbackIndex = i;
            continue;
        }
        shoePalettePool.splice(i, 1);
        return cloneShoePalette(candidate);
    }
    if (fallbackIndex >= 0) {
        var fallback = shoePalettePool.splice(fallbackIndex, 1)[0];
        return cloneShoePalette(fallback);
    }
    return null;
}

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

        if (finalBearing && finalBearing !== this.bearing && typeof this.turnTo === "function") {
            this.turnTo(finalBearing);
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

function getCourtScreenOffsetY() {
    if (courtFrame && typeof courtFrame.y === "number") {
        return courtFrame.y - 1;
    }
    return COURT_SCREEN_Y_OFFSET;
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
    var isRed = teamKey === "red";
    var fallbackBg = isRed ? BG_RED : BG_BLUE;
    var fallbackFg = isRed ? LIGHTRED : LIGHTBLUE;
    var teamColors = (gameState && gameState.teamColors && gameState.teamColors[teamKey]) ? gameState.teamColors[teamKey] : null;

    return {
        fg: (teamColors && typeof teamColors.fg === "number") ? teamColors.fg : fallbackFg,
        bg: resolveBaselineBackground(teamColors, fallbackBg)
    };
}

function buryCursor() {
    if (typeof console === "undefined") return;
    if (typeof console.gotoxy !== "function") return;
    if (typeof console.screen_columns !== "number" || typeof console.screen_rows !== "number") return;
    console.gotoxy(console.screen_columns, console.screen_rows);
}

function cycleFrame(frame) {
    if (!frame || typeof frame.cycle !== "function") return false;
    var updated = frame.cycle();
    if (updated) buryCursor();
    return updated;
}

function composeAttrWithColor(originalAttr, newFg, newBg) {
    var attr = (typeof originalAttr === "number") ? originalAttr : 0;
    var preserved = attr & ~(FG_MASK | BG_MASK);
    var fgPart = (newFg !== undefined && newFg !== null) ? (newFg & FG_MASK) : (attr & FG_MASK);
    var bgPart = (newBg !== undefined && newBg !== null) ? (newBg & BG_MASK) : (attr & BG_MASK);
    return preserved | fgPart | bgPart;
}

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

function getPlayerShoePalette(player) {
    if (!player || !player.playerData || !player.playerData.shoeColors) return null;
    return player.playerData.shoeColors;
}

function getPlayerTurboColor(player) {
    var palette = getPlayerShoePalette(player);
    if (!palette) return null;
    var turbo = (player && player.playerData && typeof player.playerData.turbo === "number") ? player.playerData.turbo : 0;
    var isFlashing = player && player.playerData && player.playerData.turboActive && turbo > 0;
    if (isFlashing) {
        var tick = (gameState && typeof gameState.tickCounter === "number") ? gameState.tickCounter : 0;
        return (tick % 4 < 2) ? palette.high : palette.low;
    }
    return (turbo >= SHOE_TURBO_THRESHOLD) ? palette.high : palette.low;
}

function updatePlayerShoeColor(player) {
    if (!player || !player.playerData) return;
    var palette = getPlayerShoePalette(player);
    if (!palette) return;
    var desired = getPlayerTurboColor(player);
    if (desired === null) desired = palette.high;
    if (player.playerData.currentShoeColor === desired) return;
    applyShoeColorToSprite(player, desired);
    player.playerData.currentShoeColor = desired;
}

function applyShoePaletteToPlayer(sprite) {
    if (!sprite || !sprite.playerData || !sprite.assignedShoePalette) return;
    var palette = sprite.assignedShoePalette;
    sprite.playerData.shoeColors = {
        high: palette.high,
        low: palette.low,
        name: palette.name
    };
    sprite.playerData.currentShoeColor = palette.high;
}

var PLAYER_LABEL_WIDTH = 5;

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

function renderPlayerLabel(player, options) {
    options = options || {};
    if (!player || !player.playerData || !player.x || !player.y) return null;

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
    var isCarrier = (gameState.ballCarrier === player);

    if (yPos <= 0 || yPos > COURT_HEIGHT || xPos <= 0 || xPos > COURT_WIDTH) {
        labelFrame.clear();
        if (typeof labelFrame.bottom === "function") labelFrame.bottom();
        return { frame: labelFrame, isCarrier: isCarrier, visible: false };
    }

    var teamKey = getPlayerTeamName(player);
    var attr;
    var highlightCarrier = options.highlightCarrier !== false;

    if (highlightCarrier && isCarrier && (teamKey === "red" || teamKey === "blue")) {
        var baselineColors = getTeamBaselineColors(teamKey);
        attr = baselineColors.fg | baselineColors.bg;
    } else {
        var teamColors = (teamKey && gameState.teamColors) ? gameState.teamColors[teamKey] : null;
        var fg = (teamColors && typeof teamColors.fg === "number") ? teamColors.fg : WHITE;
        attr = fg | WAS_BROWN;
    }

    if (options.flashPalette && options.flashPalette.length) {
        var palette = options.flashPalette;
        var tick = (typeof options.flashTick === "number") ? options.flashTick : gameState.tickCounter;
        attr = palette[((tick % palette.length) + palette.length) % palette.length];
    }

    var visibleText = displayText;
    if (visibleText.length > labelFrame.width) {
        visibleText = visibleText.slice(0, labelFrame.width);
    }

    var maxLeft = COURT_WIDTH - labelFrame.width + 1;
    var labelX = Math.max(1, Math.min(xPos, maxLeft));

    labelFrame.moveTo(labelX, yPos);
    labelFrame.clear(attr);
    labelFrame.gotoxy(1, 1);
    labelFrame.putmsg(padEnd(visibleText, labelFrame.width, " "), attr);

    if (options.forceTop && typeof labelFrame.top === "function") {
        labelFrame.top();
    }

    return { frame: labelFrame, isCarrier: isCarrier, visible: true };
}

var DUNK_LABEL_WORDS = ["SLAM!", "BOOM!", "JAM!", "FLY!", "YEAH!"];

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

var WAS_BROWN = BG_BLACK;
var FG_MASK = 0x0F;
var BG_MASK = 0x70;
if (typeof Math.sign !== "function") {
    Math.sign = function (value) {
        var n = Number(value);
        if (isNaN(n) || n === 0) return 0;
        return n > 0 ? 1 : -1;
    };
}
// Add drawBorder method to Frame prototype
Frame.prototype.drawBorder = function (color, opts) {
    var options = opts || {};
    var colorParam = color;
    if (color && typeof color === "object" && !Array.isArray(color)) {
        options = color;
        colorParam = color.color;
    } else if (typeof options === "object" && options.color === undefined) {
        // options already set explicitly
        colorParam = color;
    }
    var theColor = colorParam;
    var sectionLength;
    if (Array.isArray(colorParam)) {
        sectionLength = Math.round(this.width / colorParam.length);
    }
    var borderAttrFallback = (Array.isArray(colorParam) ? colorParam[0] : (colorParam || this.attr));
    this.pushxy();
    for (var y = 1; y <= this.height; y++) {
        for (var x = 1; x <= this.width; x++) {
            if (x > 1 && x < this.width && y > 1 && y < this.height)
                continue;
            var msg;
            this.gotoxy(x, y);
            if (y == 1 && x == 1)
                msg = ascii(218);
            else if (y == 1 && x == this.width)
                msg = ascii(191);
            else if (y == this.height && x == 1)
                msg = ascii(192);
            else if (y == this.height && x == this.width)
                msg = ascii(217);
            else if (x == 1 || x == this.width)
                msg = ascii(179);
            else
                msg = ascii(196);
            if (Array.isArray(colorParam)) {
                if (x == 1)
                    theColor = colorParam[0];
                else if (sectionLength > 0 && x % sectionLength == 0 && x < this.width)
                    theColor = colorParam[x / sectionLength];
                else if (x == this.width)
                    theColor = colorParam[colorParam.length - 1];
            }
            this.putmsg(msg, theColor !== undefined ? theColor : borderAttrFallback);
        }
    }
    if (options && options.title) {
        var title = String(options.title);
        var titleAttr = (options.titleAttr !== undefined) ? options.titleAttr : (Array.isArray(colorParam) ? borderAttrFallback : (colorParam !== undefined ? colorParam : this.attr));
        var maxLen = Math.max(0, this.width - 2);
        if (title.length > maxLen) {
            title = title.substring(0, maxLen);
        }
        if (title.length > 0) {
            var titleStart = Math.max(2, Math.floor((this.width - title.length) / 2) + 1);
            if (titleStart + title.length - 1 >= this.width)
                titleStart = this.width - title.length;
            var prevAtcodes = this.atcodes;
            this.atcodes = false;
            this.gotoxy(titleStart, 1);
            this.putmsg(title, titleAttr);
            this.atcodes = prevAtcodes;
        }
    }
    this.popxy();
}

// Game constants
var COURT_WIDTH = 80;
var COURT_HEIGHT = 18;
var BASKET_LEFT_X = 4;   // Rim center (left basket)
var BASKET_LEFT_Y = 9;
var BASKET_RIGHT_X = COURT_WIDTH - (BASKET_LEFT_X - 1); // Rim center (right basket)
var BASKET_RIGHT_Y = 9;

// Three-point arc radius
var THREE_POINT_RADIUS = 16;
var KEY_DEPTH = 8;
var DUNK_DISTANCE_BASE = 4.2;
var DUNK_DISTANCE_PER_ATTR = 0.95;
var DUNK_MIN_DISTANCE = 2.4;
var DUNK_ARC_HEIGHT_MIN = 2.5;
var DUNK_ARC_HEIGHT_MAX = 5.5;

// Player attribute constants (NBA Jam style)
var ATTR_SPEED = 0;
var ATTR_3PT = 1;
var ATTR_DUNK = 2;
var ATTR_POWER = 3;
var ATTR_STEAL = 4;
var ATTR_BLOCK = 5;

// Turbo constants
var MAX_TURBO = 100;
var TURBO_DRAIN_RATE = 2;
var TURBO_RECHARGE_RATE = 3; // Increased from 1 to 3 for faster recharge
var TURBO_SPEED_MULTIPLIER = 3;
if (SHOE_TURBO_THRESHOLD < 0) SHOE_TURBO_THRESHOLD = 0;
if (SHOE_TURBO_THRESHOLD > MAX_TURBO) SHOE_TURBO_THRESHOLD = MAX_TURBO;
var TURBO_ACTIVATION_THRESHOLD = 200; // ms between same key presses

// Passing balance tweaks
var PASS_INTERCEPT_LATENCY_MIN = 4;
var PASS_INTERCEPT_LATENCY_MAX = 9;
var PASS_LANE_BASE_TOLERANCE = 3.5;
var PASS_INTERCEPT_MAX_CHANCE = 70;
var PASS_LANE_MIN_CLEARANCE = 3.2;
var PASS_LANE_TRAVEL_WEIGHT = 0.55;
var PASS_LANE_SPACING_WEIGHT = 0.35;
var PASS_LANE_LENGTH_WEIGHT = 0.12;

// Block animation constants
var BLOCK_JUMP_DURATION = 12;
var BLOCK_JUMP_HEIGHT = 4;

// AI Decision Constants - Tunable for game balancing
var SHOT_PROBABILITY_THRESHOLD = 40; // Percent - AI shoots if probability > this
var SHOT_CLOCK_URGENT = 3; // Seconds - force shot when clock this low
var BACKCOURT_URGENT = 8; // Seconds - urgency increases at this time
var STEAL_BASE_CHANCE = 0.18; // Base chance for steal attempt per frame
var DEFENDER_PERIMETER_LIMIT = 22; // Don't guard farther than this from basket
var DEFENDER_TIGHT_RANGE = 18; // Guard tightly inside this range
var DOUBLE_TEAM_RADIUS = 8; // Trigger double team when offensive player this close to both defenders
var HELP_DEFENSE_RANGE = 15; // Help defend when ball carrier within this range

// Court midline
var COURT_MID_X = Math.floor(COURT_WIDTH / 2);

// Court Spots (Waypoints) - Named positions for AI positioning
// Red team attacks right (toward BASKET_RIGHT)
// Blue team attacks left (toward BASKET_LEFT)
var COURT_SPOTS = {
    // Red offensive spots (attacking right/east toward x=74)
    red: {
        left_wing: { x: COURT_MID_X + 8, y: 5 },
        right_wing: { x: COURT_MID_X + 8, y: 13 },
        top_key: { x: COURT_MID_X + 12, y: BASKET_LEFT_Y },
        corner_low: { x: BASKET_RIGHT_X - 8, y: 3 },
        corner_high: { x: BASKET_RIGHT_X - 8, y: 15 },
        dunker_low: { x: BASKET_RIGHT_X - 4, y: 6 },
        dunker_high: { x: BASKET_RIGHT_X - 4, y: 12 },
        elbow_low: { x: COURT_MID_X + 16, y: 6 },
        elbow_high: { x: COURT_MID_X + 16, y: 12 },
        backcourt_entry: { x: COURT_MID_X + 3, y: BASKET_LEFT_Y },
        frontcourt_entry: { x: COURT_MID_X + 6, y: BASKET_LEFT_Y }
    },
    // Blue offensive spots (attacking left/west toward x=3)
    blue: {
        left_wing: { x: COURT_MID_X - 8, y: 5 },
        right_wing: { x: COURT_MID_X - 8, y: 13 },
        top_key: { x: COURT_MID_X - 12, y: BASKET_LEFT_Y },
        corner_low: { x: BASKET_LEFT_X + 8, y: 3 },
        corner_high: { x: BASKET_LEFT_X + 8, y: 15 },
        dunker_low: { x: BASKET_LEFT_X + 4, y: 6 },
        dunker_high: { x: BASKET_LEFT_X + 4, y: 12 },
        elbow_low: { x: COURT_MID_X - 16, y: 6 },
        elbow_high: { x: COURT_MID_X - 16, y: 12 },
        backcourt_entry: { x: COURT_MID_X - 3, y: BASKET_LEFT_Y },
        frontcourt_entry: { x: COURT_MID_X - 6, y: BASKET_LEFT_Y }
    }
};

// AI States (FSM)
var AI_STATE = {
    OFFENSE_BALL: "OffenseBall",       // I have the ball
    OFFENSE_NO_BALL: "OffenseNoBall",  // My teammate has the ball
    DEFENSE_ON_BALL: "DefenseOnBall",  // Guarding ball handler
    DEFENSE_HELP: "DefenseHelp",       // Help defense
    REBOUND: "Rebound"                 // Going for rebound
};

// Game state
var gameState = {};

function createDefaultGameState() {
    return {
        gameRunning: false,
        ballCarrier: null,  // Who has the ball
        score: { red: 0, blue: 0 },
        consecutivePoints: { red: 0, blue: 0 },
        onFire: { red: false, blue: false },
        timeRemaining: 360, // 6 minutes total for two halves (3 minutes per half)
        totalGameTime: 360, // 6 minutes total (3 minutes per half)
        currentHalf: 1,     // Track which half we're in (1 or 2)
        isHalftime: false,  // Flag for halftime state
        shotClock: 24,  // 24-second shot clock
        currentTeam: "red",
        ballX: 0,
        ballY: 0,
        reboundActive: false,
        reboundX: 0,
        reboundY: 0,
        inbounding: false,  // True when setting up after a made basket
        inboundPasser: null,  // Player passing the ball in
        teamNames: { red: "RED", blue: "BLUE" },  // Actual team names from rosters
        teamAbbrs: { red: "RED", blue: "BLUE" },
        teamColors: {
            red: {
                fg: WHITE,
                bg: BG_BLACK,
                fg_accent: WHITE,
                bg_alt: BG_BLACK,
                fg_code: "\1h\1w",
                fg_accent_code: "\1h\1w"
            },
            blue: {
                fg: WHITE,
                bg: BG_BLACK,
                fg_accent: WHITE,
                bg_alt: BG_BLACK,
                fg_code: "\1h\1w",
                fg_accent_code: "\1h\1w"
            }
        },
        announcer: {
            text: "",
            color: WHITE,
            timer: 0
        },
        lastKeyTime: 0,
        lastKey: "",
        // 5-second violation tracking
        ballHandlerStuckTimer: 0,
        ballHandlerLastX: 0,
        ballHandlerLastY: 0,
        ballHandlerAdvanceTimer: 0,
        ballHandlerFrontcourtStartX: 0,
        ballHandlerProgressOwner: null,
        inboundAlternateIndex: { red: 0, blue: 0 },
        backcourtTimer: 0,
        frontcourtEstablished: false,
        // Defensive assignments (man-to-man)
        defensiveAssignments: {
            // Maps defender to offensive player they're guarding
            // Will be set during switchPossession/setupInbound
        },
        // Block tracking
        activeBlock: null,  // Player currently attempting a block
        blockJumpTimer: 0,  // Frames remaining in jump animation
        activeBlockDuration: 0,
        lastBlocker: null,  // Player who last blocked/contested the shot
        shotInProgress: false,  // True during shot animation
        shotStartX: 0,
        shotStartY: 0,
        potentialAssist: null,
        // Player roster tracking for substitutions
        availablePlayers: {
            red: [], // Array of all available player indices for red team
            blue: [] // Array of all available player indices for blue team
        },
        activePlayerIndices: {
            red: [0, 1], // Currently active player indices
            blue: [0, 1]
        },
        ballHandlerDeadSince: null,
        ballHandlerDeadFrames: 0,
        ballHandlerDeadForcedShot: false,
        tickCounter: 0,
        allCPUMode: false,
        firstHalfStartTeam: null,
        secondHalfInitDone: false,
        pendingSecondHalfInbound: false,
        scoreFlash: {
            active: false,
            activeTeam: null,
            stopTeam: null,
            startedTick: 0,
            regainCheckEnabled: false
        },
        beepEnabled: true
    };
}

function resetGameState(options) {
    var prevTeams = gameState.teamNames || {};
    var prevColors = gameState.teamColors || {};
    var prevCPU = typeof gameState.allCPUMode === "boolean" ? gameState.allCPUMode : false;

    gameState = createDefaultGameState();

    if (options && options.teamNames) {
        gameState.teamNames = JSON.parse(JSON.stringify(options.teamNames));
    } else if (prevTeams.red || prevTeams.blue) {
        gameState.teamNames = JSON.parse(JSON.stringify(prevTeams));
    }

    if (options && options.teamColors) {
        gameState.teamColors = JSON.parse(JSON.stringify(options.teamColors));
    } else if (prevColors.red || prevColors.blue) {
        gameState.teamColors = JSON.parse(JSON.stringify(prevColors));
    }

    gameState.allCPUMode = (options && typeof options.allCPUMode === "boolean")
        ? options.allCPUMode
        : prevCPU;

    gameState.ballHandlerDeadForcedShot = false;

    gameState.beepEnabled = gameState.allCPUMode ? !!BEEP_DEMO : true;
}

// Frames
var courtFrame;
var scoreFrame;
var announcerFrame;
var ballFrame;
var announcerLibrary = {};
var scoreFontModule = null;
var scoreFontData = null;
var scoreFontInitAttempted = false;
var SCORE_FONT_DEFAULT_JUSTIFY = 2;
var SCORE_FONT_MIN_WIDTH = 6;
var leftScoreFrame = null;
var rightScoreFrame = null;

function ensureBallFrame(x, y) {
    if (!courtFrame) return;
    var startX = (typeof x === "number") ? x : Math.floor(COURT_WIDTH / 2);
    var startY = (typeof y === "number") ? y : Math.floor(COURT_HEIGHT / 2);
    var drawY = (typeof startY === "number") ? startY + getCourtScreenOffsetY() : startY;

    if (ballFrame && ballFrame.is_open && typeof ballFrame.moveTo === "function") {
        ballFrame.moveTo(startX, drawY);
        ballFrame.putmsg("o");
        return;
    }

    if (ballFrame && typeof ballFrame.close === "function") {
        try { ballFrame.close(); } catch (e) { }
    }
    ballFrame = new Frame(startX, drawY, 1, 1, YELLOW | WAS_BROWN, courtFrame);
    ballFrame.putmsg("o");
    ballFrame.open();
}

function moveBallFrameTo(x, y) {
    var clampedX = clamp(Math.round(x), 1, COURT_WIDTH);
    var clampedY = clamp(Math.round(y), 1, COURT_HEIGHT);
    if (!ballFrame || !ballFrame.is_open) {
        ensureBallFrame(clampedX, clampedY);
    } else if (ballFrame.moveTo) {
        var drawY = clampedY + getCourtScreenOffsetY();
        ballFrame.moveTo(clampedX, drawY);
    }
}

// Player sprites (2v2)
var redPlayer1;   // Human controlled
var redPlayer2;   // AI teammate
var bluePlayer1;  // AI opponent
var bluePlayer2;  // AI opponent

// Player class to hold attributes and state
function Player(name, jersey, attributes, sprite, shortNick) {
    this.name = name;
    this.jersey = jersey;
    this.shortNick = shortNick; // Short nickname for display
    this.attributes = attributes; // [speed, 3pt, dunk, power, steal, block]
    this.sprite = sprite;
    this.turbo = MAX_TURBO;
    this.turboActive = false;
    this.heatStreak = 0; // For shooting momentum
    this.onFire = false;
    this.fireMakeStreak = 0;
    this.lastTurboUseTime = 0;
    this.inboundBoostTimer = 0;
    this.lastTurboX = null;
    this.lastTurboY = null;
    this.stats = {
        points: 0,
        assists: 0,
        steals: 0,
        rebounds: 0,
        blocks: 0,
        fgm: 0,
        fga: 0,
        tpm: 0,
        tpa: 0,
        dunks: 0,
        dunkAttempts: 0,
        turnovers: 0
    };
    this.injured = false;
    this.injuryCount = 0;
    this.hasDribble = true;
    this.shakeCooldown = 0;
    this.shoveCooldown = 0;
    this.knockdownTimer = 0;
    this.stealRecoverFrames = 0;

    // AI State Machine
    this.aiState = AI_STATE.OFFENSE_BALL; // Current FSM state
    this.aiTargetSpot = null; // Current waypoint/spot we're moving toward
    this.aiLastAction = ""; // For debugging
    this.aiCooldown = 0; // Frames to wait before next action
    this.axisToggle = false; // For movement alternation (legacy)
    this.offBallCutTimer = 0; // For alternating cut patterns

    // Attach player data to sprite
    sprite.playerData = this;
}

Player.prototype.getSpeed = function () {
    var speedAttr = getEffectiveAttribute(this, ATTR_SPEED);
    var baseSpeed = speedAttr / 10.0;
    if (this.turboActive) {
        return baseSpeed * TURBO_SPEED_MULTIPLIER;
    }
    return baseSpeed;
};

Player.prototype.useTurbo = function (amount) {
    if (this.turbo > 0) {
        this.turbo -= amount;
        if (this.turbo < 0) this.turbo = 0;
        return true;
    }
    return false;
};

Player.prototype.rechargeTurbo = function (amount) {
    this.turbo += amount;
    if (this.turbo > MAX_TURBO) this.turbo = MAX_TURBO;
};

// NBA Teams data structure
var NBATeams = {};

function loadTeamData() {
    // Load from rosters.ini
    var rostersFile = new File(js.exec_dir + "rosters.ini");

    if (rostersFile.open("r")) {
        parseRostersINI(rostersFile);
        rostersFile.close();
    } else {
        // Fallback to generated teams if file not found
        generateDefaultTeams();
    }
}

function parseRostersINI(file) {
    var currentSection = null;
    var teamData = {};
    var playerData = {};

    while (!file.eof) {
        var line = file.readln();
        if (line === null) break; // End of file reached
        line = line.trim();

        // Skip empty lines and comments
        if (line === "" || line[0] === "#") continue;

        // Check for section header
        if (line[0] === "[" && line[line.length - 1] === "]") {
            currentSection = line.substring(1, line.length - 1);
            continue;
        }

        // Parse key=value pairs
        var equalsPos = line.indexOf("=");
        if (equalsPos > 0 && currentSection) {
            var key = line.substring(0, equalsPos).trim();
            var value = line.substring(equalsPos + 1).trim();

            // Check if this is a team section or player section
            if (currentSection.indexOf(".") === -1) {
                // Team section
                if (!teamData[currentSection]) {
                    teamData[currentSection] = {};
                }
                teamData[currentSection][key] = value;
            } else {
                // Player section
                if (!playerData[currentSection]) {
                    playerData[currentSection] = {};
                }
                playerData[currentSection][key] = value;
            }
        }
    }

    // Build NBATeams structure
    for (var teamKey in teamData) {
        var team = teamData[teamKey];
        var roster = [];

        if (team.roster) {
            var playerKeys = team.roster.split(",");
            for (var i = 0; i < playerKeys.length; i++) {
                var playerKey = playerKeys[i].trim();
                var player = playerData[playerKey];

                if (player) {
                    // Parse short_nicks - get first nickname from comma-separated list
                    var shortNick = null;
                    if (player.short_nicks && player.short_nicks.trim() !== "") {
                        var nicks = player.short_nicks.split(",");
                        if (nicks.length > 0 && nicks[0].trim() !== "") {
                            shortNick = nicks[0].trim();
                        }
                    }

                    var jerseyNumberString = "";
                    if (player.player_number !== undefined && player.player_number !== null) {
                        jerseyNumberString = String(player.player_number).trim();
                    }

                    var skinTone = null;
                    if (player.skin && player.skin.trim() !== "") {
                        skinTone = player.skin.trim().toLowerCase();
                    }

                    roster.push({
                        name: player.player_name || "Unknown",
                        jersey: parseInt(player.player_number) || 0,
                        jerseyString: jerseyNumberString,
                        skin: skinTone,
                        shortNick: shortNick, // Add short nickname property
                        position: (player.position || "").toUpperCase(),
                        teamAbbr: team.team_abbr || teamKey,
                        attributes: [
                            parseInt(player.speed) || 5,
                            parseInt(player["3point"]) || 5,
                            parseInt(player.dunk) || 5,
                            parseInt(player.power) || 5,
                            parseInt(player.steal) || 5,
                            parseInt(player.block) || 5
                        ]
                    });
                }
            }
        }

        NBATeams[teamKey] = {
            name: team.team_name || teamKey,
            abbr: team.team_abbr || teamKey.substring(0, 3).toUpperCase(),
            players: roster,
            colors: {
                fg: team.ansi_fg || "WHITE",
                bg: team.ansi_bg || "BG_BLACK",
                fg_accent: team.ansi_fg_accent || "WHITE",
                bg_alt: team.ansi_bg_alt || "BG_BLACK"
            }
        };
    }
}

function generateDefaultTeams() {
    var nbaTeamNames = [
        "Lakers", "Celtics", "Warriors", "Bulls", "Heat",
        "Nets", "Knicks", "76ers", "Bucks", "Mavericks",
        "Suns", "Nuggets", "Clippers", "Trail Blazers", "Rockets",
        "Spurs", "Jazz", "Thunder", "Pacers", "Cavaliers",
        "Hawks", "Hornets", "Wizards", "Raptors", "Magic",
        "Pistons", "Kings", "Timberwolves", "Pelicans", "Grizzlies"
    ];

    for (var i = 0; i < nbaTeamNames.length; i++) {
        NBATeams[nbaTeamNames[i]] = generateRandomRoster(nbaTeamNames[i]);
    }
}

function generateRandomRoster(teamName) {
    var roster = [];

    // Generate 2 players for 2v2
    for (var i = 0; i < 2; i++) {
        var archetype = Math.floor(Math.random() * 4);
        var attributes;
        var playerName;
        var position;

        // Create different archetypes
        switch (archetype) {
            case 0: // Sharpshooter
                attributes = [8, 9, 4, 3, 7, 4];
                playerName = "Guard";
                position = "GUARD";
                break;
            case 1: // High-Flyer
                attributes = [8, 6, 10, 6, 6, 5];
                playerName = "Forward";
                position = "FORWARD";
                break;
            case 2: // Enforcer/Big Man
                attributes = [4, 2, 9, 10, 3, 9];
                playerName = "Center";
                position = "CENTER";
                break;
            case 3: // Playmaker
                attributes = [9, 7, 7, 5, 8, 5];
                playerName = "Point Guard";
                position = "GUARD";
                break;
            default:
                attributes = [6, 6, 6, 6, 6, 6];
                playerName = "Player";
                position = "FORWARD";
        }

        var jerseyNumber = Math.floor(Math.random() * 99) + 1;
        roster.push({
            name: playerName + " " + (i + 1),
            jersey: jerseyNumber,
            jerseyString: String(jerseyNumber),
            skin: "brown",
            attributes: attributes,
            position: position,
            shortNick: playerName.toUpperCase().split(" ")[0]
        });
    }

    return {
        name: teamName,
        abbr: teamName.substring(0, 3).toUpperCase(),
        players: roster
    };
}

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
function getLastName(fullName) {
    var nameParts = fullName.split(" ");
    if (nameParts.length === 0) return "";

    var lastPart = nameParts[nameParts.length - 1];

    // If last part is in parentheses, use second to last
    if (lastPart.indexOf("(") !== -1 || lastPart.indexOf(")") !== -1) {
        if (nameParts.length > 1) {
            return nameParts[nameParts.length - 2];
        }
    }

    return lastPart;
}

// Helper function to convert color string to color constant
function getColorValue(colorStr) {
    // Map string names to actual color constants
    var colorMap = {
        "BLACK": BLACK,
        "RED": RED,
        "GREEN": GREEN,
        "BROWN": BROWN,
        "BLUE": BLUE,
        "MAGENTA": MAGENTA,
        "CYAN": CYAN,
        "LIGHTGRAY": LIGHTGRAY,
        "DARKGRAY": DARKGRAY,
        "LIGHTRED": LIGHTRED,
        "LIGHTGREEN": LIGHTGREEN,
        "YELLOW": YELLOW,
        "LIGHTBLUE": LIGHTBLUE,
        "LIGHTMAGENTA": LIGHTMAGENTA,
        "LIGHTCYAN": LIGHTCYAN,
        "WHITE": WHITE,
        "WAS_BROWN": WAS_BROWN
    };

    if (!colorStr) return WHITE;
    var upper = colorStr.toUpperCase();

    if (upper === "BG_BLACK") return BG_BLACK;

    if (upper.indexOf("BG_") === 0 && upper.length > 3) {
        var fgValue = getColorValue(upper.substring(3));
        if (fgValue === undefined || fgValue === null) {
            return BG_BLACK;
        }
        return (fgValue & 0x0F) << 4;
    }

    var direct = colorMap[upper];
    if (typeof direct === "number") {
        return direct;
    }

    return WHITE;
}

// Convert color string to Synchronet CTRL-A color code for console.putmsg
function getColorCode(colorStr) {
    var codeMap = {
        "BLACK": "\1k",
        "RED": "\1r",
        "GREEN": "\1g",
        "BROWN": "\1" + String.fromCharCode(2), // Brown is \1^B
        "BLUE": "\1b",
        "MAGENTA": "\1m",
        "CYAN": "\1c",
        "LIGHTGRAY": "\1w",
        "DARKGRAY": "\1h\1k",
        "LIGHTRED": "\1h\1r",
        "LIGHTGREEN": "\1h\1g",
        "YELLOW": "\1y",
        "LIGHTBLUE": "\1h\1b",
        "LIGHTMAGENTA": "\1h\1m",
        "LIGHTCYAN": "\1h\1c",
        "WHITE": "\1h\1w"
    };

    return codeMap[colorStr] || "\1w";
}

function getBackgroundCode(bgStr) {
    var ctrl = "\1";
    var map = {
        "BG_BLACK": ctrl + "0",
        "BG_RED": ctrl + "1",
        "BG_GREEN": ctrl + "2",
        "BG_BROWN": ctrl + "3",
        "BG_BLUE": ctrl + "4",
        "BG_MAGENTA": ctrl + "5",
        "BG_CYAN": ctrl + "6",
        "BG_LIGHTGRAY": ctrl + "7"
    };
    return map[bgStr] || "";
}

function getMenuColorCodes(team, highlight) {
    var colors = team && team.colors ? team.colors : {};
    var fgName = highlight
        ? (colors.fg_accent || colors.fg || "WHITE")
        : (colors.fg || "WHITE");
    var bgName = colors.bg_alt || colors.bg || "BG_BLACK";

    var fgCode = getColorCode(fgName);
    var bgCode = getBackgroundCode(bgName);
    var intensity = highlight ? "\1h" : "";

    return bgCode + intensity + fgCode;
}

function resolveSpriteBaseBySkin(skin) {
    var fallback = "player-brown";
    if (typeof skin !== "string" || skin.trim() === "") {
        return fallback;
    }
    var cleaned = skin.toLowerCase();
    var candidate = "player-" + cleaned;
    try {
        var testFile = new File(js.exec_dir + "sprites/" + candidate + ".bin");
        if (testFile.exists) {
            return candidate;
        }
    } catch (e) {
        // Ignore and fall back
    }
    return fallback;
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
        }
    }

    sprite.frame.invalidate();
}

// Announcer system
function announce(text, color) {
    gameState.announcer.text = text;
    gameState.announcer.color = color || WHITE;
    gameState.announcer.timer = 90; // Show for ~3 seconds at 30fps
    if (typeof drawAnnouncerLine === "function") {
        drawAnnouncerLine();
    }
}

function updateAnnouncer() {
    if (gameState.announcer.timer > 0) {
        gameState.announcer.timer--;
        if (gameState.announcer.timer == 0) {
            gameState.announcer.text = "";
        }
    }
    if (typeof drawAnnouncerLine === "function") {
        drawAnnouncerLine();
    }
}

function loadAnnouncerLibrary() {
    var defaultLibrary = {
        generic: [""],
        crowd_reaction: ["The crowd goes wild!"],
        shot_made: ["Count it!"],
        shot_missed: ["No good!"],
        three_pointer: ["From downtown!"],
        dunk: ["Boom-shakalaka!"],
        block: ["Rejected!"],
        steal: ["Picked his pocket!"],
        on_fire: ["He's on fire!"],
        fire_extinguished: ["He's cooled off."],
        shot_clock_violation: ["Shot clock violation!"],
        violation_backcourt: ["Backcourt violation!"],
        violation_five_seconds: ["5-second violation!"],
        dribble_pickup: ["He picked up his dribble!"],
        game_start: ["Welcome to NBA Jam!"],
        tipoff: ["And we're underway!"],
        half_time: ["It's halftime!"],
        win: ["That's the ball game!"],
        lose: ["Better luck next time!"],
        hot_streak: ["He's heating up!"],
        cold_streak: ["He's ice cold!"],
        alley_oop: ["Alley-oop!"],
        buzzer_beater: ["At the buzzer — yes!"],
        injury: ["Ouch!"],
        loose_ball: ["Loose ball!"],
        inbounds: ["Ball in play!"],
        rebound: ["Snags the rebound!"],
        shake_free: ["He shook him loose!"],
        shove: ["He sends him flying!"]
    };

    announcerLibrary = {};

    var annFile = new File(js.exec_dir + "announcer.json");
    if (annFile.open("r")) {
        var content = annFile.read();
        annFile.close();
        try {
            var parsed = JSON.parse(content);
            if (parsed && parsed.length) {
                for (var i = 0; i < parsed.length; i++) {
                    var entry = parsed[i];
                    if (!entry || !entry.event_type || !entry.quotes || !entry.quotes.length) continue;
                    announcerLibrary[entry.event_type] = entry.quotes.slice();
                }
            }
        } catch (err) {
            if (typeof console !== "undefined" && console.print) {
                console.print("\r\nFailed to parse announcer.json: " + err + "\r\n");
            }
        }
    }

    for (var key in defaultLibrary) {
        if (!announcerLibrary[key]) {
            announcerLibrary[key] = defaultLibrary[key].slice();
        }
    }
}

function pickRandomQuote(list) {
    if (!list || !list.length) return "";
    var idx = Math.floor(Math.random() * list.length);
    if (idx < 0 || idx >= list.length) idx = 0;
    return list[idx];
}

function formatAnnouncerQuote(template, context) {
    if (!template) return "";
    if (!context) context = {};
    return template.replace(/\$\{([^}]+)\}/g, function (_, key) {
        if (context.hasOwnProperty(key)) return String(context[key]);
        return "";
    });
}

function getTeamColorValue(teamKey, useAccent) {
    if (!teamKey || !gameState.teamColors) return null;
    var entry = gameState.teamColors[teamKey];
    if (!entry) return null;
    if (useAccent && entry.fg_accent) return entry.fg_accent;
    if (entry.fg) return entry.fg;
    return null;
}

function deriveAnnouncerColor(context) {
    context = context || {};
    if (context.color) return context.color;

    var teamKey = context.team;
    if (!teamKey && context.player) {
        teamKey = getPlayerTeamName(context.player);
    }
    if (!teamKey && context.playerName && context.teamName) {
        teamKey = context.teamName;
    }

    var color = getTeamColorValue(teamKey, true) || getTeamColorValue(teamKey, false);
    if (color !== null) return color;
    return YELLOW;
}

function announceEvent(eventType, context) {
    context = context || {};
    var quotes = announcerLibrary[eventType];
    if (!quotes) {
        quotes = announcerLibrary.generic;
        if (!quotes) return;
    }

    var message = formatAnnouncerQuote(pickRandomQuote(quotes), context);
    if (!message) return;

    announce(message, deriveAnnouncerColor(context));
}

function getAnnouncerText() {
    return gameState.announcer.text;
}

function getAnnouncerColor() {
    return gameState.announcer.color;
}

function drawBaselineTeamNames() {
    // Draw team names vertically on left and right baselines
    var blueTeamName = gameState.teamNames.blue || "BLUE";
    var redTeamName = gameState.teamNames.red || "RED";

    var baselineTop = 2;
    var baselineBottom = COURT_HEIGHT - 1;
    var baselineSpan = baselineBottom - baselineTop + 1;

    // Fill entire column with team background color before placing characters
    function paintBaselineColumn(x, attr) {
        for (var y = baselineTop; y <= baselineBottom; y++) {
            courtFrame.gotoxy(x, y);
            courtFrame.putmsg(" ", attr);
        }
    }

    function paintTeamNameVertically(x, name, fgColor, bgColor) {
        if (!name || name.length === 0) return;
        var attr = fgColor | bgColor;
        var startY = baselineTop;
        if (name.length < baselineSpan) {
            startY += Math.floor((baselineSpan - name.length) / 2);
        }
        for (var i = 0; i < name.length; i++) {
            var currentY = startY + i;
            if (currentY > baselineBottom) break;
            courtFrame.gotoxy(x, currentY);
            courtFrame.putmsg(name.charAt(i), attr);
        }
    }

    var blueBaseline = getTeamBaselineColors("blue");
    var redBaseline = getTeamBaselineColors("red");

    // Left baseline (BLUE team) - vertical text at X=1
    paintBaselineColumn(1, blueBaseline.bg);
    paintTeamNameVertically(1, blueTeamName, blueBaseline.fg, blueBaseline.bg);

    // Right baseline (RED team) - vertical text at X=COURT_WIDTH
    paintBaselineColumn(COURT_WIDTH, redBaseline.bg);
    paintTeamNameVertically(COURT_WIDTH, redTeamName, redBaseline.fg, redBaseline.bg);
}

function drawCourt() {
    // Draw court background (brown wood)
    courtFrame.clear();

    // Draw court border (sidelines and baselines)
    courtFrame.drawBorder(WHITE | WAS_BROWN);

    // Center court divider (two-column half blocks for even split)
    var centerLeft = Math.floor(COURT_WIDTH / 2);
    var useDoubleCenter = (COURT_WIDTH % 2 === 0);
    var centerRight = useDoubleCenter ? centerLeft + 1 : centerLeft;
    for (var y = 2; y < COURT_HEIGHT; y++) {
        courtFrame.gotoxy(centerLeft, y);
        courtFrame.putmsg(useDoubleCenter ? ascii(222) : ascii(179), WHITE | WAS_BROWN); // Right half block or single line
        if (useDoubleCenter) {
            courtFrame.gotoxy(centerRight, y);
            courtFrame.putmsg(ascii(221), WHITE | WAS_BROWN); // Left half block
        }
    }

    // Center circle
    var centerY = Math.floor(COURT_HEIGHT / 2);
    courtFrame.gotoxy(centerLeft - 2, centerY);
    courtFrame.putmsg("\1b(\1h\1rN13A\1n\1b)", WHITE | WAS_BROWN);

    // 3-point arcs (semicircle around each basket) using scaled Y to match gameplay logic
    var radius = THREE_POINT_RADIUS;
    var arcStep = 4;

    function plotArc(centerX, centerY, startAngle, endAngle) {
        var plotted = Object.create(null);
        for (var angle = startAngle; angle <= endAngle; angle += arcStep) {
            var rad = angle * Math.PI / 180;
            var dx = radius * Math.cos(rad);
            var dy = (radius * Math.sin(rad)) / 2; // Half-height cell compensation
            var x = Math.round(centerX + dx);
            var y = Math.round(centerY + dy);
            if (x <= 1 || x >= COURT_WIDTH || y <= 1 || y >= COURT_HEIGHT) continue;
            var key = x + "," + y;
            if (plotted[key]) continue;
            plotted[key] = true;
            courtFrame.gotoxy(x, y);
            courtFrame.putmsg(ascii(250), WHITE | WAS_BROWN);
        }
    }

    // Left basket 3-point arc (using CP437 middle dot character 250)
    plotArc(BASKET_LEFT_X, BASKET_LEFT_Y, -90, 90);

    // Right basket 3-point arc (using CP437 middle dot character 250)
    plotArc(BASKET_RIGHT_X, BASKET_RIGHT_Y, 90, 270);

    // Free throw lines
    var ftLineX_left = BASKET_LEFT_X + 8;
    var ftLineX_right = BASKET_RIGHT_X - 8;
    for (var y = 6; y <= 12; y++) {
        courtFrame.gotoxy(ftLineX_left, y);
        courtFrame.putmsg("-", LIGHTGRAY | WAS_BROWN);
        courtFrame.gotoxy(ftLineX_right, y);
        courtFrame.putmsg("-", LIGHTGRAY | WAS_BROWN);
    }

    // Draw hoops (backboard + rim + net)
    // Left hoop (opens to right)
    var nba = ["N", "B", "A"];
    var letterPos = 0;
    var leftBackboardX = BASKET_LEFT_X - 2;
    for (var bbY = BASKET_LEFT_Y - 1; bbY <= BASKET_LEFT_Y + 1; bbY++) {
        courtFrame.gotoxy(leftBackboardX, bbY);
        courtFrame.putmsg(nba[letterPos], BLUE | BG_LIGHTGRAY);  // Slim backboard
        letterPos++;
    }

    // Rim row (Y)
    courtFrame.gotoxy(BASKET_LEFT_X - 1, BASKET_LEFT_Y);
    courtFrame.putmsg(ascii(201), RED | WAS_BROWN);  // Rim left opening ╔
    courtFrame.gotoxy(BASKET_LEFT_X, BASKET_LEFT_Y);
    courtFrame.putmsg(ascii(205), RED | WAS_BROWN);  // Rim horizontal ═
    courtFrame.gotoxy(BASKET_LEFT_X + 1, BASKET_LEFT_Y);
    courtFrame.putmsg(ascii(187), RED | WAS_BROWN);  // Rim right opening ╗

    // Net row (Y+1) hangs below backboard
    courtFrame.gotoxy(BASKET_LEFT_X - 1, BASKET_LEFT_Y + 1);
    courtFrame.putmsg("\\", WHITE | WAS_BROWN);  // Net outer left
    courtFrame.gotoxy(BASKET_LEFT_X, BASKET_LEFT_Y + 1);
    courtFrame.putmsg("W", WHITE | WAS_BROWN);  // Net inner left
    courtFrame.gotoxy(BASKET_LEFT_X + 1, BASKET_LEFT_Y + 1);
    courtFrame.putmsg("/", WHITE | WAS_BROWN);  // Net inner right
    // courtFrame.gotoxy(BASKET_LEFT_X + 2, BASKET_LEFT_Y + 1);
    // courtFrame.putmsg("/", WHITE | WAS_BROWN);  // Net outer right

    // Right hoop (opens to left)
    var rightBackboardX = BASKET_RIGHT_X + 2;
    letterPos = 0;
    for (var bbY = BASKET_RIGHT_Y - 1; bbY <= BASKET_RIGHT_Y + 1; bbY++) {
        courtFrame.gotoxy(rightBackboardX, bbY);
        courtFrame.putmsg(nba[letterPos], RED | BG_LIGHTGRAY);  // Slim backboard
        letterPos++; // Slim backboard
    }

    // Rim row (Y)
    courtFrame.gotoxy(BASKET_RIGHT_X - 1, BASKET_RIGHT_Y);
    courtFrame.putmsg(ascii(201), RED | WAS_BROWN);  // Rim left opening ╔
    courtFrame.gotoxy(BASKET_RIGHT_X, BASKET_RIGHT_Y);
    courtFrame.putmsg(ascii(205), RED | WAS_BROWN);  // Rim horizontal ═
    courtFrame.gotoxy(BASKET_RIGHT_X + 1, BASKET_RIGHT_Y);
    courtFrame.putmsg(ascii(187), RED | WAS_BROWN);  // Rim right opening ╗

    // Net row (Y+1) hangs below backboard
    // courtFrame.gotoxy(BASKET_RIGHT_X - 2, BASKET_RIGHT_Y + 1);
    // courtFrame.putmsg("\\", WHITE | WAS_BROWN);  // Net outer left
    courtFrame.gotoxy(BASKET_RIGHT_X - 1, BASKET_RIGHT_Y + 1);
    courtFrame.putmsg("\\", WHITE | WAS_BROWN);  // Net left
    courtFrame.gotoxy(BASKET_RIGHT_X, BASKET_RIGHT_Y + 1);
    courtFrame.putmsg("W", WHITE | WAS_BROWN);  // Net right
    courtFrame.gotoxy(BASKET_RIGHT_X + 1, BASKET_RIGHT_Y + 1);
    courtFrame.putmsg("/", WHITE | WAS_BROWN);  // Net outer right
    // courtFrame.gotoxy(BASKET_RIGHT_X + 2, BASKET_RIGHT_Y + 1);
    // courtFrame.putmsg("/", WHITE | WAS_BROWN);  // Net far outer right

    // Draw team names vertically on baselines
    drawBaselineTeamNames();

    // Update ball position beside player based on bearing
    if (gameState.ballCarrier && ballFrame) {
        updateBallPosition();
    }

    // Cycle sprites and frames
    Sprite.cycle();

    // Draw jersey numbers above players
    drawJerseyNumbers();

    // Make sure ball frame is visible and on top
    if (ballFrame && ballFrame.is_open) {
        ballFrame.top();
    }

    // Ensure ball carrier sprite renders on top
    if (gameState.ballCarrier && gameState.ballCarrier.frame && typeof gameState.ballCarrier.frame.top === "function") {
        gameState.ballCarrier.frame.top();
    }

    cycleFrame(courtFrame);
}

function drawJerseyNumbers() {
    var players = getAllPlayers();
    var carrierFrame = null;
    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        var info = renderPlayerLabel(player, { highlightCarrier: true, forceTop: true });
        if (!info || !info.frame || !info.visible) continue;

        if (info.isCarrier) {
            carrierFrame = info.frame;
        }
    }

    if (carrierFrame && typeof carrierFrame.top === "function") {
        carrierFrame.top();
    }
}

function updateBallPosition() {
    // If rebound is active, show ball at rebound position
    if (gameState.reboundActive) {
        if (ballFrame && moveBallFrameTo) {
            moveBallFrameTo(gameState.reboundX, gameState.reboundY);
        }
        return;
    }

    var player = gameState.ballCarrier;
    if (!player || !player.x || !player.y) {
        // If no valid ball carrier, clear rebound state
        gameState.reboundActive = false;
        return;
    }

    var targetBasket = gameState.currentTeam === "red" ? BASKET_RIGHT_X : BASKET_LEFT_X;

    // Get player's bearing or default towards their basket
    var bearing = player.bearing || (gameState.currentTeam === "red" ? "e" : "w");

    // Position ball based on bearing
    var ballOffsetX = 0;
    var ballOffsetY = 0;
    var ballChar = "o";
    var ballAttr = YELLOW | WAS_BROWN;

    var playerData = player.playerData || {};
    var hasDribble = playerData.hasDribble !== false;

    if (bearing.indexOf('e') >= 0) ballOffsetX = 5;
    if (bearing.indexOf('w') >= 0) ballOffsetX = -1;
    if (bearing.indexOf('n') >= 0) ballOffsetY = -1;
    if (bearing.indexOf('s') >= 0) ballOffsetY = 4;

    // Default to basket direction if no horizontal component
    if (ballOffsetX === 0) {
        ballOffsetX = (player.x < targetBasket) ? 5 : -1;
    }

    if (player.x >= COURT_WIDTH - 7 && ballOffsetX > 0) {
        ballOffsetX = Math.max(ballOffsetX - 3, 1);
    }

    if (hasDribble) {
        var period = 12;
        var phase = (gameState.tickCounter % period) / period;
        var bounce = (Math.sin(phase * Math.PI * 2) + 1) / 2; // 0 to 1
        var dribbleAmplitude = 2;
        ballOffsetY += Math.round(bounce * dribbleAmplitude);
        if (bounce > 0.75) {
            ballChar = "*";
        } else if (bounce < 0.25) {
            ballChar = ".";
        }
    } else {
        ballOffsetY -= 2; // Hold ball higher when dribble is dead
        var holdPhase = (gameState.tickCounter % 16) < 8;
        ballChar = holdPhase ? "O" : "o";
        ballAttr = holdPhase ? (LIGHTRED | WAS_BROWN) : (YELLOW | WAS_BROWN);
    }

    var desiredBallX = player.x + ballOffsetX;
    if (desiredBallX > COURT_WIDTH - 2) {
        desiredBallX = COURT_WIDTH - 2;
    }
    gameState.ballX = clamp(desiredBallX, 1, COURT_WIDTH);
    gameState.ballY = clamp(player.y + ballOffsetY + 2, 1, COURT_HEIGHT);

    if (ballFrame && moveBallFrameTo) {
        moveBallFrameTo(gameState.ballX, gameState.ballY);
        if (ballFrame.putmsg) {
            ballFrame.putmsg(ballChar, ballAttr);
        }
    }
}

function updateTeamOnFireFlag(teamKey) {
    if (!teamKey || !gameState.onFire) return;
    var sprites = getTeamSprites(teamKey) || [];
    var active = false;
    for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        if (sprite && sprite.playerData && sprite.playerData.onFire) {
            active = true;
            break;
        }
    }
    gameState.onFire[teamKey] = active;
}

function setPlayerOnFire(player) {
    if (!player || !player.playerData) return;
    if (typeof player.playerData.fireMakeStreak !== "number") {
        player.playerData.fireMakeStreak = 0;
    }
    player.playerData.onFire = true;
    var team = getPlayerTeamName(player);
    if (team) {
        gameState.onFire[team] = true;
    }
}

function clearPlayerOnFire(player) {
    if (!player || !player.playerData) return;
    player.playerData.onFire = false;
    player.playerData.heatStreak = 0;
    player.playerData.fireMakeStreak = 0;
    var team = getPlayerTeamName(player);
    if (team) {
        updateTeamOnFireFlag(team);
    }
}

function clearTeamOnFire(teamKey) {
    if (!teamKey) return;
    var sprites = getTeamSprites(teamKey) || [];
    for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        if (sprite && sprite.playerData) {
            sprite.playerData.onFire = false;
            sprite.playerData.heatStreak = 0;
            sprite.playerData.fireMakeStreak = 0;
        }
    }
    gameState.onFire[teamKey] = false;
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
    var scorePanelAttr = WHITE | BG_BLACK;

    var blueTeamName = (gameState.teamNames.blue || "BLUE").toUpperCase();
    var redTeamName = (gameState.teamNames.red || "RED").toUpperCase();
    var blueTeamAbbr = (gameState.teamAbbrs && gameState.teamAbbrs.blue) ? String(gameState.teamAbbrs.blue).toUpperCase() : "BLU";
    var redTeamAbbr = (gameState.teamAbbrs && gameState.teamAbbrs.red) ? String(gameState.teamAbbrs.red).toUpperCase() : "RED";

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

    renderPlayerSlot(2, bluePlayer1, "blue", 0);
    renderPlayerSlot(14, bluePlayer2, "blue", 3);
    renderPlayerSlot(60, redPlayer1, "red", 0);
    renderPlayerSlot(72, redPlayer2, "red", 3);

    var abbrRow = 4;
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

function canPlayPossessionBeep() {
    if (typeof console === "undefined" || typeof console.beep !== "function") return false;
    if (!gameState || gameState.beepEnabled === false) return false;
    return true;
}

function triggerPossessionBeep() {
    if (!canPlayPossessionBeep()) return;
    try {
        console.beep();
    } catch (beepErr) { }
}

function togglePossessionBeep() {
    if (!gameState) return;
    gameState.beepEnabled = !gameState.beepEnabled;
    if (typeof announce === "function") {
        announce(gameState.beepEnabled ? "Audio cues ON" : "Audio cues OFF", YELLOW);
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
    cleanupScoreFrames();
    scoreFrame = new Frame(1, COURT_HEIGHT + 2, 80, 5, LIGHTGRAY | BG_BLACK);

    announcerFrame.open();
    courtFrame.open();
    scoreFrame.open();
    ensureScoreFontLoaded();

    ensureBallFrame(40, 10);
    drawAnnouncerLine();
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
        gameState.teamColors.red = {
            fg: getColorValue(redTeam.colors.fg),
            bg: getColorValue(redTeam.colors.bg),
            fg_accent: getColorValue(redTeam.colors.fg_accent),
            bg_alt: getColorValue(redTeam.colors.bg_alt),
            fg_code: getColorCode(redFgName),
            fg_accent_code: getColorCode(redFgAccentName)
        };
    }
    if (blueTeam.colors) {
        var blueFgName = blueTeam.colors.fg || "WHITE";
        var blueFgAccentName = blueTeam.colors.fg_accent || blueFgName;
        gameState.teamColors.blue = {
            fg: getColorValue(blueTeam.colors.fg),
            bg: getColorValue(blueTeam.colors.bg),
            fg_accent: getColorValue(blueTeam.colors.fg_accent),
            bg_alt: getColorValue(blueTeam.colors.bg_alt),
            fg_code: getColorCode(blueFgName),
            fg_accent_code: getColorCode(blueFgAccentName)
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
        var spriteBase = resolveSpriteBaseBySkin(playerInfo.skin);
        var sprite = new Sprite.Aerial(
            spriteBase,
            courtFrame,
            startX,
            startY,
            bearing,
            "normal"
        );

        var jerseyBgColor = resolveJerseyBackground(teamColors, fallbackBg);
        var accentColor = sanitizeAccentColor(teamColors && teamColors.fg_accent);
        var shoePalette = assignShoePalette(teamColors);
        sprite.assignedShoePalette = shoePalette ? cloneShoePalette(shoePalette) : null;
        var jerseyDigits = "";
        if (playerInfo.jerseyString !== undefined && playerInfo.jerseyString !== null && String(playerInfo.jerseyString).trim() !== "") {
            jerseyDigits = String(playerInfo.jerseyString);
        } else if (playerInfo.jersey !== undefined && playerInfo.jersey !== null) {
            jerseyDigits = String(playerInfo.jersey);
        }

        applyUniformMask(sprite, {
            jerseyBg: jerseyBgColor,
            accentFg: accentColor,
            jerseyNumber: jerseyDigits,
            shoeColor: shoePalette ? shoePalette.high : undefined
        });

        scrubSpriteTransparency(sprite);

        sprite.moveTo(startX, startY);
        sprite.frame.open();
        sprite.isHuman = !!isHuman;
        sprite.initialShoeColor = shoePalette ? shoePalette.high : null;
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
            if (dx < 2 && dy < 2) {
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

function checkBoundaries(sprite) {
    // Keep sprites within court boundaries - just clamp the values
    // Don't use moveTo as it can cause flickering
    if (sprite.x < 2) sprite.x = 2;
    if (sprite.x > COURT_WIDTH - 7) sprite.x = COURT_WIDTH - 7;
    if (sprite.y < 2) sprite.y = 2;
    if (sprite.y > COURT_HEIGHT - 5) sprite.y = COURT_HEIGHT - 5;
    clampSpriteFeetToCourt(sprite);
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

function clampToCourtX(x) {
    return clamp(x, 2, COURT_WIDTH - 7);
}

function clampToCourtY(y) {
    return clamp(y, 2, COURT_HEIGHT - 5);
}

function distanceBetweenPoints(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
}

function clampSpriteFeetToCourt(sprite) {
    if (!sprite || !sprite.moveTo) return;
    var width = (sprite.frame && sprite.frame.width) ? sprite.frame.width : 5;
    if (width < 3) return;

    var legCenter = Math.floor(width / 2);
    var legLeftOffset = Math.max(1, legCenter - 1);
    var legRightOffset = Math.min(width - 2, legCenter + 1);

    var legLeft = sprite.x + legLeftOffset;
    var legRight = sprite.x + legRightOffset;
    var shift = 0;

    var legMin = 2;
    var legMax = COURT_WIDTH - 2;

    if (legLeft < legMin) {
        shift = legMin - legLeft;
    } else if (legRight > legMax) {
        shift = legRight - legMax;
        shift = -shift;
    }

    if (shift !== 0) {
        var minX = 2;
        var maxX = Math.min(COURT_WIDTH - width, COURT_WIDTH - 7);
        var newX = clamp(sprite.x + shift, minX, maxX);
        sprite.moveTo(newX, sprite.y);
    }
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
 * Calculate shot probability based on distance, defender proximity, and player attributes
 * @param {Object} shooter - The sprite attempting the shot
 * @param {number} targetX - Basket X coordinate
 * @param {number} targetY - Basket Y coordinate
 * @param {Object} closestDefender - Closest defender sprite (or null)
 * @returns {number} Shot probability as percentage (0-100)
 */
function calculateShotProbability(shooter, targetX, targetY, closestDefender) {
    if (!shooter || !shooter.playerData) return 0;

    var playerData = shooter.playerData;
    var distanceToBasket = distanceBetweenPoints(shooter.x, shooter.y, targetX, targetY);
    var dunkSkill = getEffectiveAttribute(playerData, ATTR_DUNK);
    var threePointSkill = getEffectiveAttribute(playerData, ATTR_3PT);
    var rawDunkSkill = getBaseAttribute(playerData, ATTR_DUNK);
    var rawThreeSkill = getBaseAttribute(playerData, ATTR_3PT);
    var skillEdge = threePointSkill - dunkSkill;

    // 1. BASE PROBABILITY FROM DISTANCE (closer = better)
    var baseProbability;
    if (distanceToBasket < 5) {
        // Layup/dunk range
        baseProbability = 85;
    } else if (distanceToBasket < 12) {
        // Close range
        baseProbability = 70;
    } else if (distanceToBasket < 18) {
        // Mid-range
        baseProbability = 55;
    } else if (distanceToBasket < 25) {
        // 3-point range
        baseProbability = 40;
    } else {
        // Deep/half court
        baseProbability = 15;
    }

    // Encourage dunkers to stay aggressive at the rim and penalize bailout twos
    if (distanceToBasket < 12 && rawDunkSkill >= 6 && !playerData.onFire) {
        baseProbability -= (rawDunkSkill - 5) * 4;
        if (distanceToBasket < 8) {
            baseProbability -= (rawDunkSkill - 5) * 3;
        }
    }
    if (distanceToBasket < 10 && rawDunkSkill <= 3) {
        baseProbability += (4 - rawDunkSkill) * 3;
    }
    if (distanceToBasket >= 18 && rawThreeSkill >= 7) {
        baseProbability += 5;
    }
    if (baseProbability < 5) baseProbability = 5;

    // 2. ATTRIBUTE MULTIPLIER (player skill)
    var attributeMultiplier = 1.0;
    if (distanceToBasket < 8) {
        // Close range - use dunk attribute
        attributeMultiplier = 0.7 + (dunkSkill / 10) * 0.6; // 0.7 to 1.3
    } else {
        // Perimeter - use 3point attribute
        attributeMultiplier = 0.7 + (threePointSkill / 10) * 0.6; // 0.7 to 1.3
    }

    if (distanceToBasket >= 18) {
        if (skillEdge >= 3) {
            baseProbability += 6;
        } else if (skillEdge >= 2) {
            baseProbability += 3;
        }
    }

    // 3. DEFENDER PENALTY (proximity to defender)
    var defenderPenalty = 0;
    if (closestDefender) {
        var defenderDistance = getSpriteDistance(shooter, closestDefender);
        if (defenderDistance < 2) {
            // Heavily contested
            defenderPenalty = 25;
        } else if (defenderDistance < 4) {
            // Contested
            defenderPenalty = 15;
        } else if (defenderDistance < 6) {
            // Lightly guarded
            defenderPenalty = 8;
        }
        // else: wide open (no penalty)

        if (distanceToBasket >= 18 && defenderPenalty > 0) {
            defenderPenalty = Math.max(0, defenderPenalty - 4);
        }
    }

    // COMBINED FORMULA
    var finalProbability = (baseProbability * attributeMultiplier) - defenderPenalty;

    if (distanceToBasket >= 18) {
        if (skillEdge >= 3) {
            finalProbability += 10;
        } else if (skillEdge >= 2) {
            finalProbability += 6;
        } else if (skillEdge >= 1) {
            finalProbability += 3;
        }
    }

    // Clamp to 0-100 range
    if (finalProbability < 0) finalProbability = 0;
    if (finalProbability > 95) finalProbability = 95;

    return finalProbability;
}

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
    mswait(800);
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
    mswait(800);
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

function autoContestShot(shooter, targetX, targetY) {
    var teamName = getPlayerTeamName(shooter);
    if (!teamName) return;

    var defenders = getOpposingTeamSprites(teamName);
    var closest = null;
    var closestDist = 999;

    for (var i = 0; i < defenders.length; i++) {
        var defender = defenders[i];
        if (!defender || defender.isHuman) continue;
        var dist = getSpriteDistance(defender, shooter);
        if (dist < closestDist) {
            closest = defender;
            closestDist = dist;
        }
    }

    if (closest && !closest.isHuman && closestDist < 9.5) {
        if (closest.playerData && closest.playerData.turbo > 2) {
            activateAITurbo(closest, 0.7, closestDist);
        }
        var closestBlockBoost = closest.playerData
            ? getEffectiveAttribute(closest.playerData, ATTR_BLOCK) * 0.2
            : 0;
        attemptBlock(closest, {
            duration: BLOCK_JUMP_DURATION + (closestDist < 5 ? 4 : 2),
            heightBoost: closestBlockBoost,
            direction: shooter.x >= closest.x ? 1 : -1
        });
    }

    for (var j = 0; j < defenders.length; j++) {
        var helper = defenders[j];
        if (!helper || helper === closest || helper.isHuman) continue;
        var rimDist = distanceBetweenPoints(helper.x, helper.y, targetX, targetY);
        if (rimDist < 8.5 && Math.random() < 0.5) {
            activateAITurbo(helper, 0.5, rimDist);
            attemptBlock(helper, {
                duration: BLOCK_JUMP_DURATION + 2,
                heightBoost: 0.6,
                direction: shooter.x >= helper.x ? 1 : -1
            });
            break;
        }
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

function isCornerThreePosition(player, teamName) {
    if (!player) return false;
    var corners = getCornerSpots(teamName);
    if (!corners) return false;
    var threshold = 4;
    var px = player.x;
    var py = player.y;
    var best = 999;
    if (corners.top) {
        best = Math.min(best, distanceBetweenPoints(px, py, corners.top.x, corners.top.y));
    }
    if (corners.bottom) {
        best = Math.min(best, distanceBetweenPoints(px, py, corners.bottom.x, corners.bottom.y));
    }
    return best <= threshold;
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
    var dx = targetX - player.x;
    var dy = targetY - player.y;
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1.5) return; // Close enough

    // Normalize direction
    var dirX = dx / distance;
    var dirY = dy / distance;

    // Apply speed
    var moveSpeed = speed || 2; // Default speed

    // Store current position
    var oldX = player.x;
    var oldY = player.y;

    // Try to move toward target
    var newX = player.x + dirX * moveSpeed;
    var newY = player.y + dirY * moveSpeed;

    player.moveTo(Math.round(newX), Math.round(newY));

    // Check if we actually moved (collision detection might have blocked us)
    var didMove = (player.x !== oldX || player.y !== oldY);

    // If blocked, try alternate routes
    if (!didMove && moveSpeed > 1) {
        // Try moving primarily on X-axis (from original position)
        newX = oldX + dirX * moveSpeed;
        newY = oldY;
        player.moveTo(Math.round(newX), Math.round(newY));

        didMove = (player.x !== oldX || player.y !== oldY);

        // Still blocked? Try moving primarily on Y-axis (from original position)
        if (!didMove) {
            newX = oldX;
            newY = oldY + dirY * moveSpeed;
            player.moveTo(Math.round(newX), Math.round(newY));
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

function pickEmergencyCrosscourtSpot(player, teamName) {
    var spots = getTeamSpots(teamName);
    var goOppositeBaseline = player.y < BASKET_LEFT_Y;
    var target = null;
    if (spots) {
        target = goOppositeBaseline ? spots.corner_high : spots.corner_low;
        if (!target) target = goOppositeBaseline ? spots.elbow_high : spots.elbow_low;
        if (!target) target = spots.top_key || spots.left_wing || spots.right_wing;
    }
    if (!target) {
        var destX = teamName === "red"
            ? clampToCourtX(player.x + 10)
            : clampToCourtX(player.x - 10);
        var destY = clampToCourtY(player.y < BASKET_LEFT_Y ? BASKET_LEFT_Y + 6 : BASKET_LEFT_Y - 6);
        target = { x: destX, y: destY };
    }
    return {
        x: clampToCourtX(Math.round(target.x)),
        y: clampToCourtY(Math.round(target.y))
    };
}

function pickEmergencyReliefSpot(player, ballCarrier, teamName) {
    var base = pickOffBallSpot(player, ballCarrier, teamName) || { x: player.x, y: player.y };
    var jitterY = (player.y < BASKET_LEFT_Y ? 1 : -1) * (2 + Math.random() * 2);
    var jitterX = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2);
    return {
        x: clampToCourtX(Math.round(base.x + jitterX)),
        y: clampToCourtY(Math.round(base.y + jitterY))
    };
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
 * AI State: OffenseBall - Player has the ball
 * Priority cascade:
 * 1. If in backcourt -> DRIVE forward (no passing, no shooting)
 * 2. If lane open + turbo -> DRIVE to basket
 * 3. If open shot + good quality -> SHOOT
 * 4. If help collapsing -> PASS to teammate
 * 5. Else -> PROBE (dribble around)
 */
function aiOffenseBall(player, teamName) {
    var playerData = player.playerData;
    if (!playerData) return;

    var basket = getOffensiveBasket(teamName);
    var spots = getTeamSpots(teamName);
    var attackDirection = teamName === "red" ? 1 : -1;
    var inBackcourt = isInBackcourt(player, teamName);
    var defenderDist = getClosestDefenderDistance(player, teamName);
    var distToBasket = distanceBetweenPoints(player.x, player.y, basket.x, basket.y);
    var rawThreePointSkill = getBaseAttribute(playerData, ATTR_3PT);
    var rawDunkSkill = getBaseAttribute(playerData, ATTR_DUNK);
    var threePointSkill = getEffectiveAttribute(playerData, ATTR_3PT);
    var dunkSkill = getEffectiveAttribute(playerData, ATTR_DUNK);
    var skillEdge = threePointSkill - dunkSkill;
    var isThreeSpecialist = (rawThreePointSkill >= 7 && rawDunkSkill <= 5);
    var now = getTimeMs();
    var timeSinceTurbo = playerData.lastTurboUseTime ? (now - playerData.lastTurboUseTime) : Number.POSITIVE_INFINITY;
    var closestDefender = getClosestPlayer(player.x, player.y, teamName === "red" ? "blue" : "red");
    var hasDribble = playerData.hasDribble !== false;
    var dribbleDead = !hasDribble;
    var deadElapsed = dribbleDead ? Math.max(0, now - (gameState.ballHandlerDeadSince || now)) : 0;
    var closestDefenderDistToBasket = closestDefender ? getSpriteDistanceToBasket(closestDefender, teamName) : 999;
    var shotQuality = calculateShotQuality(player, teamName);
    var totalScoringAttr = rawThreePointSkill + rawDunkSkill;
    var threeBias = totalScoringAttr > 0 ? (rawThreePointSkill / totalScoringAttr) : 0.5;
    var driveBias = totalScoringAttr > 0 ? (rawDunkSkill / totalScoringAttr) : 0.5;
    var wantsPerimeter = Math.random() < (0.35 + threeBias * 0.55);
    var wantsDrive = Math.random() < (0.3 + driveBias * 0.6);

    // PRIORITY 1: BACKCOURT - Must advance, no other options
    if (inBackcourt && !gameState.frontcourtEstablished) {
        playerData.aiLastAction = "push_backcourt";

        // Check if we're stuck (position hasn't changed much)
        var isStuck = gameState.ballHandlerStuckTimer >= 2;

        // PRIORITY 1a: If stuck in backcourt, PASS to teammate if they're ahead
        if (isStuck) {
            var teammate = getTeammate(player);
            if (teammate && teammate.playerData) {
                // Check if teammate is in frontcourt or closer to frontcourt
                var teammateInFrontcourt = !isInBackcourt(teammate, teamName);
                var myDistToMid = Math.abs(player.x - COURT_MID_X);
                var teammateDistToMid = Math.abs(teammate.x - COURT_MID_X);

                // Pass if teammate is ahead or in better position
                if (teammateInFrontcourt || teammateDistToMid < myDistToMid) {
                    playerData.aiLastAction = "backcourt_pass_unstuck";
                    animatePass(player, teammate);
                    return;
                }
            }
        }

        // Target: frontcourt entry spot
        var targetSpot = spots.frontcourt_entry;
        var speed = 3; // Fast movement

        // If stuck, try alternate route (move on Y-axis to go around)
        if (isStuck) {
            // Juke to open lane - try high or low side
            var jukeSide = (Math.random() < 0.5) ? -4 : 4;
            targetSpot = {
                x: spots.frontcourt_entry.x,
                y: spots.frontcourt_entry.y + jukeSide
            };
        }

        // Force turbo in backcourt
        if (playerData.turbo > 10) {
            playerData.turboActive = true;
            playerData.useTurbo(TURBO_DRAIN_RATE);
            speed = 5; // Turbo speed
        }

        steerToward(player, targetSpot.x, targetSpot.y, speed);
        return;
    }

    // PRIORITY 2A: PERIMETER QUICK THREE (favor specialists early)
    var isPerimeter = distToBasket >= 17 && distToBasket <= 22;
    if (!inBackcourt && isPerimeter && wantsPerimeter) {
        var earlyPossession = gameState.ballHandlerAdvanceTimer <= 1;
        var settledFeet = (gameState.ballHandlerStuckTimer >= 1) && timeSinceTurbo > 350;
        var spacing = defenderDist >= (isThreeSpecialist ? 3 : 4.5);
        var clockComfort = gameState.shotClock > (SHOT_CLOCK_URGENT + (isThreeSpecialist ? 4 : 2));
        var qualityFloor = SHOT_PROBABILITY_THRESHOLD - (isThreeSpecialist ? 7 : 3);
        var quickThreeQuality = shotQuality;
        var isTransition = earlyPossession && timeSinceTurbo < 1200;
        if (isTransition) {
            quickThreeQuality -= isThreeSpecialist ? 4 : 12;
        }
        if (distToBasket > 20) {
            quickThreeQuality -= (distToBasket - 20) * 4;
        }
        var hasGreenLight = isThreeSpecialist || skillEdge >= 3 || (threePointSkill >= 7 && !isTransition);

        if (settledFeet && (clockComfort || (earlyPossession && !isTransition)) &&
            spacing && quickThreeQuality >= qualityFloor && hasGreenLight) {
            playerData.aiLastAction = (earlyPossession && isThreeSpecialist)
                ? "transition_three"
                : "quick_three";
            attemptShot();
            return;
        }
    }

    // PRIORITY 2: LANE OPEN + TURBO -> DRIVE
    var laneTurboThreshold = rawDunkSkill >= 7 ? 12 : 20;
    if (!dribbleDead && wantsDrive && isLaneOpen(player, teamName) && playerData.turbo > laneTurboThreshold) {
        playerData.aiLastAction = "drive_lane";
        playerData.turboActive = true;
        playerData.useTurbo(TURBO_DRAIN_RATE);

        steerToward(player, basket.x, basket.y, 5); // Turbo speed

        // Dunk if close enough
        if (distToBasket < 6) {
            attemptShot(); // Will trigger dunk animation
        }
        return;
    }

    var highFlyer = rawDunkSkill >= 8;
    if (!dribbleDead && highFlyer && distToBasket <= 12 && defenderDist <= 6) {
        if (distToBasket > 6.2) {
            playerData.aiLastAction = "attack_rim";
            var gatherTarget = basket.x - attackDirection * 5;
            var gatherX = clampToCourtX(gatherTarget);
            var gatherY = clampToCourtY(basket.y + (player.y < basket.y ? -2 : 2));
            var burstSpeed = playerData.turbo > 5 ? 5.4 : 3.8;
            if (playerData.turbo > 5) {
                playerData.turboActive = true;
                playerData.useTurbo(TURBO_DRAIN_RATE * 0.9);
            }
            steerToward(player, gatherX, gatherY, burstSpeed);
        } else {
            playerData.aiLastAction = "power_rim";
            attemptShot();
        }
        return;
    }

    if (closestDefender) {
        var contactDist = getSpriteDistance(player, closestDefender);
        if (contactDist <= 1.9) {
            if (playerData.shakeCooldown <= 0 && attemptShake(player)) {
                playerData.aiLastAction = "shake_escape";
                return;
            }
            var awayX = clampToCourtX(player.x + (player.x - closestDefender.x) * 1.4);
            var awayY = clampToCourtY(player.y + (player.y - closestDefender.y) * 1.4);
            var escapeSpeed = playerData.turbo > 5 ? 3.8 : 2.4;
            if (playerData.turbo > 5 && !playerData.turboActive) {
                playerData.turboActive = true;
                playerData.useTurbo(TURBO_DRAIN_RATE * 0.6);
            }
            playerData.aiLastAction = "escape_pressure";
            steerToward(player, awayX, awayY, escapeSpeed);
            return;
        }
    }

    if (!dribbleDead && closestDefender && defenderDist <= 4 && closestDefenderDistToBasket >= distToBasket + 2) {
        playerData.aiLastAction = "press_break";
        var burstX = clampToCourtX(player.x + attackDirection * 8);
        var burstY = clampToCourtY(player.y + (Math.random() < 0.5 ? -2 : 2));
        var burstSpeed = playerData.turbo > 5 ? 5 : 3.2;
        if (playerData.turbo > 5) {
            playerData.turboActive = true;
            playerData.useTurbo(TURBO_DRAIN_RATE * 0.75);
        }
        steerToward(player, burstX, burstY, burstSpeed);
        return;
    }

    if (rawDunkSkill >= 7 && distToBasket < 6 && defenderDist <= 5) {
        playerData.aiLastAction = "power_rim";
        attemptShot();
        return;
    }

    // PRIORITY 3: OPEN SHOT -> SHOOT
    var pullUpRange = isThreeSpecialist ? 12 : 14;
    if (shotQuality > SHOT_PROBABILITY_THRESHOLD && defenderDist > 5 && distToBasket > pullUpRange) {
        playerData.aiLastAction = "pull_up_shot";
        attemptShot();
        return;
    }

    // PRIORITY 4: HELP COLLAPSING -> KICK OUT
    if (isHelpCollapsing(player, teamName) && Math.random() < 0.7) {
        var teammate = getTeammate(player);
        if (teammate && teammate.playerData) {
            playerData.aiLastAction = "kickout_pass";
            animatePass(player, teammate);
            return;
        }
    }

    // PRIORITY 5: SHOT CLOCK URGENT -> FORCE SHOT
    if (gameState.shotClock <= SHOT_CLOCK_URGENT) {
        playerData.aiLastAction = "force_shot";
        attemptShot();
        return;
    }

    if (dribbleDead) {
        playerData.aiLastAction = "hold_pivot";
        return;
    }

    // DEFAULT: PROBE - Move toward best corner or top of key
    var preferCorner = rawThreePointSkill >= rawDunkSkill;
    var cornerTarget = preferCorner ? selectBestCorner(teamName, player, true) : null;
    if (cornerTarget) {
        playerData.aiLastAction = "probe_corner";
        steerToward(player, cornerTarget.x, cornerTarget.y, 2);
    } else {
        playerData.aiLastAction = "probe";
        var probeSpot = spots.top_key;
        steerToward(player, probeSpot.x, probeSpot.y, 2);
    }
}

/**
 * AI State: OffenseNoBall - Teammate has the ball
 * Priority cascade:
 * 1. If ball carrier in backcourt -> Sprint to frontcourt wing
 * 2. If defender sleeping -> Backdoor cut
 * 3. Else -> Space to best spot
 */
function aiOffenseNoBall(player, teamName) {
    var playerData = player.playerData;
    if (!playerData) return;

    var ballCarrier = gameState.ballCarrier;
    if (!ballCarrier) return;

    var spots = getTeamSpots(teamName);
    var defenderDist = getClosestDefenderDistance(player, teamName);
    var dribbleDead = isBallHandlerDribbleDead();
    var deadElapsed = dribbleDead ? getBallHandlerDeadElapsed() : 0;
    var fiveSecondAlarm = deadElapsed > 2500;

    if (dribbleDead) {
        if (!playerData.emergencyCut) {
            playerData.emergencyCut = { flareCount: 0, forceRepathTick: 0, currentMode: "relief" };
        }

        var tolerance = deadElapsed > 1800 ? 1.3 : 1.8;
        var forceTick = playerData.emergencyCut.forceRepathTick || 0;
        var needsNewTarget = !playerData.aiTargetSpot ||
            hasReachedSpot(player, playerData.aiTargetSpot, tolerance) ||
            (forceTick && gameState.tickCounter >= forceTick);

        if (needsNewTarget) {
            var mustCross = playerData.emergencyCut.flareCount >= 2;
            if (!mustCross && deadElapsed > 2500) mustCross = true;
            if (!mustCross && Math.random() < 0.35) mustCross = true;

            var target;
            if (mustCross) {
                target = pickEmergencyCrosscourtSpot(player, teamName);
                playerData.emergencyCut.flareCount = 0;
                playerData.emergencyCut.currentMode = "cross";
            } else {
                target = pickEmergencyReliefSpot(player, ballCarrier, teamName);
                playerData.emergencyCut.flareCount++;
                playerData.emergencyCut.currentMode = "relief";
            }

            playerData.aiTargetSpot = target;
            var deltaX = (target.x || player.x) - player.x;
            var deltaY = (target.y || player.y) - player.y;
            var dirX = deltaX === 0 ? 0 : (deltaX > 0 ? 1 : -1);
            var dirY = deltaY === 0 ? 0 : (deltaY > 0 ? 1 : -1);
            var leadOffsetX = mustCross ? 2 : 1;
            var leadOffsetY = mustCross ? 1 : 0;
            var lead = {
                x: clampToCourtX(Math.round(target.x + dirX * leadOffsetX)),
                y: clampToCourtY(Math.round(target.y + dirY * leadOffsetY))
            };
            playerData.emergencyCut.leadTarget = lead;
            playerData.emergencyCut.forceRepathTick = gameState.tickCounter + (mustCross ? 10 : 14);
        }

        var mode = playerData.emergencyCut.currentMode || "relief";
        playerData.aiLastAction = mode === "cross" ? "emergency_cross" : "emergency_space";

        var speed = mode === "cross"
            ? (deadElapsed > 3200 ? 5.4 : 4.6)
            : (deadElapsed > 2600 ? 4.2 : 3.2);

        if (playerData.turbo > 3 && (mode === "cross" || fiveSecondAlarm)) {
            playerData.turboActive = true;
            playerData.useTurbo(TURBO_DRAIN_RATE * (mode === "cross" ? 0.85 : 0.6));
            speed = Math.max(speed, mode === "cross" ? 5.6 : 4.4);
        }

        steerToward(player, playerData.aiTargetSpot.x, playerData.aiTargetSpot.y, speed);
        return;
    } else if (playerData.emergencyCut) {
        playerData.emergencyCut.flareCount = 0;
        playerData.emergencyCut.forceRepathTick = 0;
        playerData.emergencyCut.currentMode = "relief";
        playerData.emergencyCut.leadTarget = null;
    }

    // PRIORITY 1: Ball carrier in backcourt -> SPRINT AHEAD
    if (isInBackcourt(ballCarrier, teamName)) {
        playerData.aiLastAction = "sprint_frontcourt";

        // Pick target spot if don't have one or reached current one
        if (!playerData.aiTargetSpot || hasReachedSpot(player, playerData.aiTargetSpot, 3)) {
            playerData.aiTargetSpot = pickOffBallSpot(player, ballCarrier, teamName);
        }

        // Use turbo to get ahead FAST
        var speed = 2;
        if (playerData.turbo > 10) {
            playerData.turboActive = true;
            playerData.useTurbo(TURBO_DRAIN_RATE * 0.5); // Lower drain for off-ball
            speed = 4;
        }

        steerToward(player, playerData.aiTargetSpot.x, playerData.aiTargetSpot.y, speed);
        return;
    }

    // PRIORITY 2: Defender sleeping -> BACKDOOR CUT
    if (defenderDist > 8 && Math.random() < 0.15) {
        playerData.aiLastAction = "backdoor_cut";
        var basket = getOffensiveBasket(teamName);
        steerToward(player, basket.x, basket.y, 3);
        return;
    }

    // PRIORITY 3: SPACE THE FLOOR
    // Pick new spot if we don't have one or reached it
    if (!playerData.aiTargetSpot || hasReachedSpot(player, playerData.aiTargetSpot, 2)) {
        playerData.aiTargetSpot = pickOffBallSpot(player, ballCarrier, teamName);
    }

    playerData.aiLastAction = "spacing";
    steerToward(player, playerData.aiTargetSpot.x, playerData.aiTargetSpot.y, 2);
}

/**
 * AI State: DefenseOnBall - Guarding the ball handler
 * Strategy: Contain (stay between ball and basket)
 */
function aiDefenseOnBall(player, teamName, ballCarrier) {
    var playerData = player.playerData;
    if (!playerData || !ballCarrier) return;

    var ourBasket = teamName === "red"
        ? { x: BASKET_LEFT_X, y: BASKET_LEFT_Y }
        : { x: BASKET_RIGHT_X, y: BASKET_RIGHT_Y };

    // Calculate contain point: between ball carrier and basket
    var dx = ourBasket.x - ballCarrier.x;
    var dy = ourBasket.y - ballCarrier.y;
    var len = Math.sqrt(dx * dx + dy * dy);

    if (len < 0.1) len = 0.1; // Avoid division by zero
    dx /= len;
    dy /= len;

    // Position 3 units in front of ball carrier toward basket
    var containX = ballCarrier.x + dx * 3 + (Math.random() - 0.5) * 2;
    var containY = ballCarrier.y + dy * 3 + (Math.random() - 0.5) * 2;

    playerData.aiLastAction = "contain";
    steerToward(player, containX, containY, 2.5); // Slightly faster than offense

    // Attempt steal if very close
    var distToBall = distanceBetweenPoints(player.x, player.y, ballCarrier.x, ballCarrier.y);
    if (distToBall <= 1.7) {
        var stealSkill = getEffectiveAttribute(playerData, ATTR_STEAL) || 5;
        var powerSkill = getEffectiveAttribute(playerData, ATTR_POWER) || 5;
        var canSteal = playerData.stealRecoverFrames <= 0;
        var pressureChoice = Math.random();
        if (canSteal && pressureChoice < (0.45 + stealSkill * 0.035)) {
            attemptAISteal(player, ballCarrier);
        } else if (ballCarrier.playerData && ballCarrier.playerData.hasDribble === false && playerData.shoveCooldown <= 0 && pressureChoice < 0.65) {
            attemptShove(player);
        } else {
            var away = getBearingVector(player.bearing);
            var retreatX = clampToCourtX(player.x - away.dx * 2);
            var retreatY = clampToCourtY(player.y - away.dy * 2);
            var settleSpeed = powerSkill >= 7 ? 2.2 : 1.6;
            steerToward(player, retreatX, retreatY, settleSpeed);
        }
    }
}

/**
 * AI State: DefenseHelp - Help defense (not guarding ball)
 * Strategy: Protect paint, deny passing lanes
 */
function aiDefenseHelp(player, teamName, ballCarrier) {
    var playerData = player.playerData;
    if (!playerData || !ballCarrier) return;

    var dribbleDead = isBallHandlerDribbleDead();
    var ourBasket = teamName === "red"
        ? { x: BASKET_LEFT_X, y: BASKET_LEFT_Y }
        : { x: BASKET_RIGHT_X, y: BASKET_RIGHT_Y };

    // Calculate paint help spot
    var paintX = ourBasket.x + (teamName === "red" ? 10 : -10); // 10 units from basket
    var paintY = BASKET_LEFT_Y;

    var distBallToBasket = distanceBetweenPoints(ballCarrier.x, ballCarrier.y, ourBasket.x, ourBasket.y);

    // If ball carrier is driving (close to basket), help in paint
    if (distBallToBasket < 15) {
        playerData.aiLastAction = "help_paint";
        var helpTargetX = paintX + (Math.random() - 0.5) * 2;
        var helpTargetY = paintY + (Math.random() - 0.5) * 2;
        var response = 0.22 + (getEffectiveAttribute(playerData, ATTR_SPEED) * 0.03);
        if (dribbleDead) response *= 0.7;
        var momentum = applyDefenderMomentum(player, helpTargetX, helpTargetY, response, false);
        var paintSpeed = dribbleDead ? 1.8 : 2.5;
        steerToward(player, momentum.x, momentum.y, paintSpeed);
    } else {
        // Otherwise, deny passing lane to my man
        // Find the offensive player I should be guarding
        var myMan = null;
        var offensivePlayers = getOpposingTeam(teamName);

        // Guard whoever is NOT the ball carrier
        for (var i = 0; i < offensivePlayers.length; i++) {
            if (offensivePlayers[i] !== ballCarrier) {
                myMan = offensivePlayers[i];
                break;
            }
        }

        if (myMan) {
            // Position between my man and ball carrier to deny pass
            var denyX = (myMan.x + ballCarrier.x) / 2 + (Math.random() - 0.5) * 2;
            var denyY = (myMan.y + ballCarrier.y) / 2 + (Math.random() - 0.5) * 2;

            playerData.aiLastAction = "deny_pass";
            if (dribbleDead) {
                denyX = (denyX * 0.6) + (myMan.x * 0.4);
                denyY = (denyY * 0.6) + (myMan.y * 0.4);
            }
            var denyResponse = 0.2 + (getEffectiveAttribute(playerData, ATTR_SPEED) * 0.03);
            if (dribbleDead) denyResponse *= 0.6;
            var denyMomentum = applyDefenderMomentum(player, denyX, denyY, denyResponse, false);
            var denySpeed = dribbleDead ? 1.6 : 2;
            steerToward(player, denyMomentum.x, denyMomentum.y, denySpeed);
        } else {
            // Fallback: protect paint
            playerData.aiLastAction = "fallback_paint";
            var fallbackX = paintX + (Math.random() - 0.5) * 2;
            var fallbackY = paintY + (Math.random() - 0.5) * 2;
            var fallbackResponse = dribbleDead ? 0.12 : 0.2;
            var fallbackMomentum = applyDefenderMomentum(player, fallbackX, fallbackY, fallbackResponse, false);
            steerToward(player, fallbackMomentum.x, fallbackMomentum.y, dribbleDead ? 1.5 : 2);
        }
    }
}

/**
 * Main AI update function - assigns states and executes logic
 */
function updateAI() {
    var allPlayers = getAllPlayers();
    var ballCarrier = gameState.ballCarrier;

    // First pass: Assign states to all AI players
    for (var i = 0; i < allPlayers.length; i++) {
        var player = allPlayers[i];
        if (!player || player.isHuman || !player.playerData) continue;

        if (player.playerData.knockdownTimer && player.playerData.knockdownTimer > 0) {
            player.playerData.knockdownTimer--;
            if (player.playerData.knockdownTimer > 0) {
                player.playerData.turboActive = false;
                continue;
            }
        }

        if (player.playerData.stealRecoverFrames > 0) {
            player.playerData.turboActive = false;
            continue;
        }

        var teamName = getPlayerTeamName(player);
        if (!teamName) continue;

        // Reset turbo active (will be set by AI logic if needed)
        player.playerData.turboActive = false;

        // Determine AI state
        if (gameState.reboundActive && !gameState.inbounding) {
            player.playerData.aiState = AI_STATE.REBOUND;
        } else if (gameState.currentTeam === teamName) {
            // Offense
            if (player === ballCarrier) {
                player.playerData.aiState = AI_STATE.OFFENSE_BALL;
            } else {
                player.playerData.aiState = AI_STATE.OFFENSE_NO_BALL;
            }
        } else {
            // Defense - determine if on-ball or help
            if (ballCarrier) {
                var distToBallCarrier = distanceBetweenPoints(player.x, player.y, ballCarrier.x, ballCarrier.y);
                var teammates = teamName === "red"
                    ? [redPlayer1, redPlayer2]
                    : [bluePlayer1, bluePlayer2];

                // Find if my teammate is closer to ball carrier
                var teammate = (teammates[0] === player) ? teammates[1] : teammates[0];
                var teammateDist = teammate
                    ? distanceBetweenPoints(teammate.x, teammate.y, ballCarrier.x, ballCarrier.y)
                    : 999;

                // I'm on-ball defender if I'm closer to ball carrier than my teammate
                if (distToBallCarrier < teammateDist) {
                    player.playerData.aiState = AI_STATE.DEFENSE_ON_BALL;
                } else {
                    player.playerData.aiState = AI_STATE.DEFENSE_HELP;
                }
            } else {
                player.playerData.aiState = AI_STATE.DEFENSE_HELP; // Default
            }
        }
    }

    // Second pass: Execute AI logic based on state
    for (var i = 0; i < allPlayers.length; i++) {
        var player = allPlayers[i];
        if (!player || player.isHuman || !player.playerData) continue;

        if (player.playerData.knockdownTimer && player.playerData.knockdownTimer > 0) {
            player.playerData.turboActive = false;
            continue;
        }

        if (player.playerData.stealRecoverFrames > 0) {
            player.playerData.turboActive = false;
            continue;
        }

        var teamName = getPlayerTeamName(player);
        if (!teamName) continue;

        var state = player.playerData.aiState;

        // Execute state-specific logic
        if (state === AI_STATE.REBOUND) {
            handleAIRebound(player); // Keep old rebound logic for now
        } else if (state === AI_STATE.OFFENSE_BALL) {
            aiOffenseBall(player, teamName);
        } else if (state === AI_STATE.OFFENSE_NO_BALL) {
            aiOffenseNoBall(player, teamName);
        } else if (state === AI_STATE.DEFENSE_ON_BALL) {
            aiDefenseOnBall(player, teamName, ballCarrier);
        } else if (state === AI_STATE.DEFENSE_HELP) {
            aiDefenseHelp(player, teamName, ballCarrier);
        }
    }
}

function handleAIRebound(player) {
    if (!gameState.reboundActive) return;

    var targetX = clampToCourtX(gameState.reboundX);
    var targetY = clampToCourtY(gameState.reboundY);
    var dist = distanceBetweenPoints(player.x, player.y, targetX, targetY);

    // Use turbo to get to rebound faster
    var speed = 2;
    if (player.playerData && player.playerData.turbo > 10) {
        player.playerData.turboActive = true;
        player.playerData.useTurbo(TURBO_DRAIN_RATE * 0.5);
        speed = 4; // Turbo speed for rebound
    }

    // Sprint to rebound location using new steering
    steerToward(player, targetX, targetY, speed);
}

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

    // STEAL - attempt if guarding ball carrier and close
    if (myMan === ballCarrier && distToMyMan < 5) {
        var stealAttr = getEffectiveAttribute(playerData, ATTR_STEAL);
        var stealChance = STEAL_BASE_CHANCE * (stealAttr / 5); // Higher steal = more attempts
        if (ballCarrier.playerData && ballCarrier.playerData.hasDribble === false) {
            attemptShove(player);
        } else {
            if (myManDistToMyBasket > DEFENDER_PERIMETER_LIMIT) {
                stealChance *= 0.4;
            }
            if (Math.random() < stealChance) {
                attemptAISteal(player, ballCarrier);
            }
        }
    }

    // BLOCK - attempt when shooter is shooting (handled in autoContestShot function)
    // SHOVE - could be implemented here based on power attribute
}

function moveAITowards(sprite, targetX, targetY) {
    if (!sprite) return;

    var dx = targetX - sprite.x;
    var dy = targetY - sprite.y;
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1.5 || isPlayerKnockedDown(sprite)) return;

    var movesPerUpdate = 2;
    if (sprite.playerData && sprite.playerData.turboActive) {
        movesPerUpdate = 4;
    }

    var startX = sprite.x;
    var startY = sprite.y;
    var axisToggle = sprite.playerData ? (sprite.playerData.axisToggle || false) : false;

    for (var m = 0; m < movesPerUpdate; m++) {
        dx = targetX - sprite.x;
        dy = targetY - sprite.y;

        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
            break;
        }

        if (Math.abs(dx) > 1 && Math.abs(dy) > 1) {
            if (axisToggle) {
                sprite.getcmd(dy < 0 ? KEY_UP : KEY_DOWN);
            } else {
                sprite.getcmd(dx < 0 ? KEY_LEFT : KEY_RIGHT);
            }
            axisToggle = !axisToggle;
        } else {
            if (Math.abs(dx) > 1) {
                sprite.getcmd(dx < 0 ? KEY_LEFT : KEY_RIGHT);
            }
            if (Math.abs(dy) > 1) {
                sprite.getcmd(dy < 0 ? KEY_UP : KEY_DOWN);
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
    mswait(1500);
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

function gameLoop() {
    gameState.gameRunning = true;
    clearPotentialAssist();
    var lastUpdate = Date.now();
    var lastSecond = Date.now();
    var lastAI = Date.now();

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
                if (distanceMoved < 3) {
                    gameState.ballHandlerStuckTimer++;
                    if (ballHandler.playerData && ballHandler.playerData.hasDribble !== false && gameState.ballHandlerStuckTimer >= 4) {
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
            if (!gameState.ballHandlerDeadSince) {
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
                if (!violationTriggeredThisFrame && (now - gameState.ballHandlerDeadSince) >= 5000) {
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

            if (gameState.ballCarrier && !gameState.inbounding) {
                var inBackcourt = isInBackcourt(gameState.ballCarrier, gameState.currentTeam);
                if (!gameState.frontcourtEstablished) {
                    if (!inBackcourt) {
                        setFrontcourtEstablished(gameState.currentTeam);
                        gameState.backcourtTimer = 0;
                    } else {
                        gameState.backcourtTimer++;
                        if (gameState.backcourtTimer >= 10) {
                            enforceBackcourtViolation("10-SECOND BACKCOURT VIOLATION!");
                            violationTriggeredThisFrame = true;
                        }
                    }
                } else if (inBackcourt) {
                    enforceBackcourtViolation("OVER AND BACK!");
                    violationTriggeredThisFrame = true;
                }
            } else if (!gameState.inbounding) {
                gameState.backcourtTimer = 0;
            }
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
                if (allPlayers[p].isHuman && pdata.knockdownTimer && pdata.knockdownTimer > 0) {
                    pdata.knockdownTimer--;
                    if (pdata.knockdownTimer < 0) pdata.knockdownTimer = 0;
                }
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
        if (now - lastAI >= 200) {
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

        // Redraw court and score less frequently to balance performance
        if (now - lastUpdate >= 60) {
            drawCourt();
            drawScore();
            lastUpdate = now;
        }

        mswait(20);
    }

    gameState.gameRunning = false;
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
        if (gameState.currentTeam === "red" && gameState.ballCarrier) {
            if (gameState.ballCarrier === redPlayer1) {
                if (redPlayer1.playerData && redPlayer1.playerData.hasDribble !== false) {
                    pickUpDribble(redPlayer1, "user");
                } else {
                    attemptShake(redPlayer1);
                }
            } else if (gameState.ballCarrier === redPlayer2) {
                attemptShake(redPlayer2);
            }
        } else {
            attemptShove(redPlayer1);
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
        var movesPerInput = 2; // Base speed: 2 moves per input (was 1)

        // Turbo speed boost
        if (redPlayer1.playerData && redPlayer1.playerData.turboActive) {
            movesPerInput = 4; // Turbo speed: 4 moves per input
        }

        // Execute multiple movement commands for increased speed
        for (var m = 0; m < movesPerInput; m++) {
            redPlayer1.getcmd(key);
        }
    } else if (redPlayer1 && !recovering) {
        // Non-movement keys (pass, shoot, etc)
        redPlayer1.getcmd(key);
    }
}

function passToTeammate() {
    // Animate and check pass
    animatePass(redPlayer1, redPlayer2);
}

function animatePass(passer, receiver, leadTarget) {
    if (!passer || !receiver) return;

    var startX = passer.x + 2; // Center of sprite
    var startY = passer.y + 2;
    var targetPoint = null;
    if (leadTarget && typeof leadTarget.x === "number" && typeof leadTarget.y === "number") {
        targetPoint = {
            x: clampToCourtX(Math.round(leadTarget.x)),
            y: clampToCourtY(Math.round(leadTarget.y))
        };
    }

    var endX = (targetPoint ? targetPoint.x : receiver.x) + 2;
    var endY = (targetPoint ? targetPoint.y : receiver.y) + 2;

    // Calculate distance for realistic timing
    var dx = endX - startX;
    var dy = endY - startY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    // Check for interception during animation
    var interceptor = checkPassInterception(passer, receiver, targetPoint);

    if (interceptor) {
        recordTurnover(passer, "steal_pass");
        // Pass was intercepted - animate to interceptor
        endX = interceptor.x + 2;
        endY = interceptor.y + 2;
        // Recalculate for interceptor
        dx = endX - startX;
        dy = endY - startY;
        distance = Math.sqrt(dx * dx + dy * dy);
    }

    // Realistic pass timing based on distance
    // NBA pass speed is about 15-20 mph = ~22-29 feet/second
    // Scale to our court: longer passes take more time
    // Short pass (~10 units): ~300ms, Full court (~70 units): ~1000ms
    var steps = Math.max(10, Math.round(distance * 0.8));
    var totalTime = 300 + (distance * 10); // 300ms base + 10ms per unit
    var msPerStep = Math.round(totalTime / steps);

    for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var x = Math.round(startX + (dx * t));
        var y = Math.round(startY + (dy * t));

        // Move ball to this position
        if (ballFrame && moveBallFrameTo) {
            moveBallFrameTo(x, y);
        }

        // Draw trail (using CP437 middle dot character 250)
        if (i > 0) {
            var prevT = (i - 1) / steps;
            var prevX = Math.round(startX + (dx * prevT));
            var prevY = Math.round(startY + (dy * prevT));
            courtFrame.gotoxy(prevX, prevY);
            courtFrame.putmsg(ascii(250), LIGHTGRAY | WAS_BROWN);
        }

        Sprite.cycle();
        cycleFrame(courtFrame);
        mswait(msPerStep);
    }

    // Clear rebound state and assign possession
    gameState.reboundActive = false;

    clearPotentialAssist();

    if (interceptor) {
        // Interception happened
        gameState.ballCarrier = interceptor;
        var interceptorTeam = (interceptor === redPlayer1 || interceptor === redPlayer2) ? "red" : "blue";
        gameState.currentTeam = interceptorTeam;
        triggerPossessionBeep();
        resetBackcourtState();
        gameState.ballHandlerStuckTimer = 0;
        gameState.ballHandlerAdvanceTimer = 0;
        gameState.shotClock = 24;
        var otherTeam = interceptorTeam === "red" ? "blue" : "red";
        gameState.consecutivePoints[otherTeam] = 0;
        gameState.ballHandlerLastX = interceptor.x;
        gameState.ballHandlerLastY = interceptor.y;
        gameState.ballHandlerFrontcourtStartX = interceptor.x;
        gameState.ballHandlerProgressOwner = interceptor;

        if (interceptor.playerData && interceptor.playerData.stats) {
            interceptor.playerData.stats.steals++;
        }

        if (interceptor.playerData) {
            interceptor.playerData.hasDribble = true;
            announceEvent("steal", {
                playerName: interceptor.playerData.name,
                player: interceptor,
                team: interceptorTeam
            });
        }
        if (receiver && receiver.playerData) receiver.playerData.hasDribble = true;
        if (passer && passer.playerData) passer.playerData.hasDribble = false;
    } else {
        // Pass completed successfully
        gameState.ballCarrier = receiver;
        gameState.ballHandlerAdvanceTimer = 0;
        gameState.ballHandlerFrontcourtStartX = receiver.x;
        gameState.ballHandlerProgressOwner = receiver;
        if (receiver && receiver.playerData) receiver.playerData.hasDribble = true;
        if (passer && passer.playerData) passer.playerData.hasDribble = false;
        setPotentialAssist(passer, receiver);
    }

    // Ensure ball carrier is ALWAYS set
    if (!gameState.ballCarrier) {
        gameState.ballCarrier = receiver; // Fallback to receiver
    }
    if (gameState.ballCarrier) {
        gameState.ballHandlerLastX = gameState.ballCarrier.x;
        gameState.ballHandlerLastY = gameState.ballCarrier.y;
        gameState.ballHandlerFrontcourtStartX = gameState.ballCarrier.x;
        gameState.ballHandlerProgressOwner = gameState.ballCarrier;
    }

    resetDeadDribbleTimer();
}

function checkPassInterception(passer, receiver, targetOverride) {
    // Check if any defender is in the passing lane and can intercept
    if (!passer || !receiver) return null;

    var passerTeam = (passer === redPlayer1 || passer === redPlayer2) ? "red" : "blue";
    var defenders = passerTeam === "red" ? getBlueTeam() : getRedTeam();

    // Calculate pass vector
    var passX1 = passer.x + 2;
    var passY1 = passer.y + 2;
    var passX2;
    var passY2;
    if (targetOverride) {
        passX2 = clampToCourtX(targetOverride.x) + 2;
        passY2 = clampToCourtY(targetOverride.y) + 2;
    } else {
        passX2 = receiver.x + 2;
        passY2 = receiver.y + 2;
    }
    var passVecX = passX2 - passX1;
    var passVecY = passY2 - passY1;
    var passLength = Math.sqrt(passVecX * passVecX + passVecY * passVecY);

    if (passLength < 0.1) return null; // Too short to intercept

    for (var i = 0; i < defenders.length; i++) {
        var defender = defenders[i];
        if (!defender || !defender.playerData) continue;
        var stealAttr = getEffectiveAttribute(defender.playerData, ATTR_STEAL);

        var defX = defender.x + 2;
        var defY = defender.y + 2;

        // Vector from passer to defender
        var toDefX = defX - passX1;
        var toDefY = defY - passY1;

        // Project defender onto pass line using dot product
        var projection = (toDefX * passVecX + toDefY * passVecY) / passLength;

        // Check if projection is between passer and receiver
        if (projection < 0 || projection > passLength) {
            continue; // Defender is not between passer and receiver
        }

        var latencyWindow = PASS_INTERCEPT_LATENCY_MIN + Math.random() * (PASS_INTERCEPT_LATENCY_MAX - PASS_INTERCEPT_LATENCY_MIN);
        var reactionDistance = Math.max(1, latencyWindow - (stealAttr * 0.7));
        if (projection < reactionDistance) {
            continue; // Defender reacts too late
        }

        // Calculate closest point on pass line to defender
        var t = projection / passLength;
        var closestX = passX1 + passVecX * t;
        var closestY = passY1 + passVecY * t;

        // Distance from defender to pass line
        var distToLine = Math.sqrt(Math.pow(defX - closestX, 2) + Math.pow(defY - closestY, 2));

        var laneSlack = Math.max(1.5, PASS_LANE_BASE_TOLERANCE + Math.random() * 1.75 - stealAttr * 0.15);

        if (distToLine < laneSlack) {
            // Defender is close to passing lane
            var distanceBonus = Math.max(0, passLength - reactionDistance) * 1.5;
            if (distanceBonus > 25) distanceBonus = 25;
            var anticipation = 0.45 + Math.random() * 0.55; // 0.45 - 1.0
            var interceptChance = (stealAttr * 5 + distanceBonus) * anticipation;
            if (interceptChance > PASS_INTERCEPT_MAX_CHANCE) interceptChance = PASS_INTERCEPT_MAX_CHANCE;
            if (Math.random() * 100 < interceptChance) {
                // Interception!
                return defender;
            }
        }
    }

    return null; // Pass completed successfully
}

function attemptSteal() {
    // Check if human player is close enough to ball carrier
    var defender = redPlayer1;
    var ballCarrier = gameState.ballCarrier;

    if (!ballCarrier) return;

    var defenderData = defender.playerData;
    var carrierData = ballCarrier.playerData;
    if (!defenderData || !carrierData) return;
    if (defenderData.stealRecoverFrames > 0) return;

    var dx = Math.abs(defender.x - ballCarrier.x);
    var dy = Math.abs(defender.y - ballCarrier.y);
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 6) {
        // Steal chance based on attributes (reduced for more difficulty)
        var stealChance = getEffectiveAttribute(defenderData, ATTR_STEAL) * 4; // Reduced from 8 to 4
        var resistance = getEffectiveAttribute(carrierData, ATTR_POWER) * 4; // Increased from 3 to 4
        var chance = (stealChance - resistance + 10) / 100; // Reduced base from 20 to 10

        if (chance < 0.05) chance = 0.05; // Lowered minimum from 0.1 to 0.05
        if (chance > 0.4) chance = 0.4; // Lowered maximum from 0.7 to 0.4

        if (Math.random() < chance) {
            // Steal successful!
            recordTurnover(ballCarrier, "steal");
            gameState.reboundActive = false; // Clear rebound state
            gameState.ballCarrier = redPlayer1;
            gameState.currentTeam = "red";
            triggerPossessionBeep();
            resetBackcourtState();
            gameState.ballHandlerStuckTimer = 0;
            gameState.ballHandlerAdvanceTimer = 0;
            gameState.consecutivePoints.blue = 0;
            gameState.shotClock = 24; // Reset shot clock on steal
            gameState.ballHandlerLastX = redPlayer1.x;
            gameState.ballHandlerLastY = redPlayer1.y;
            gameState.ballHandlerFrontcourtStartX = redPlayer1.x;
            gameState.ballHandlerProgressOwner = redPlayer1;
            redPlayer1.playerData.hasDribble = true;
            if (ballCarrier.playerData) ballCarrier.playerData.hasDribble = false;
            assignDefensiveMatchups();

            if (defenderData.stats) {
                defenderData.stats.steals++;
            }
            clearPotentialAssist();

            announceEvent("steal", {
                playerName: defenderData.name,
                player: defender,
                team: gameState.currentTeam
            });
        } else {
            beginStealRecovery(defender, ballCarrier);
        }
        // No announcement on failed steal attempt - just keep playing
    }
}

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
            drawIndicatorPattern(data.descent, baseColumn, markerY, pattern, DARKGRAY | WAS_BROWN);
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
            drawIndicatorPattern(data.descent, baseColumn, markerY, pattern, DARKGRAY | WAS_BROWN);
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
                drawIndicatorPattern(data.ascend, baseColumn, markerY, patternAsc, DARKGRAY | WAS_BROWN);
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
    var distance = Math.max(1, Math.min(maxDistance || 1, 5));
    var dx = player.x - (source ? source.x : player.x);
    var dy = player.y - (source ? source.y : player.y);
    if (dx === 0 && dy === 0) {
        dx = (Math.random() < 0.5) ? 1 : -1;
    }
    var stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
    var stepY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
    for (var i = 0; i < distance; i++) {
        var newX = clampToCourtX(player.x + stepX);
        var newY = clampToCourtY(player.y + stepY);
        player.moveTo(newX, newY);
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

function beginStealRecovery(defender, target) {
    if (!defender || !defender.playerData) return;
    var pdata = defender.playerData;
    if (pdata.stealRecoverFrames > 0) return;

    var speedAttr = getEffectiveAttribute(pdata, ATTR_SPEED) || 5;
    var frames = Math.max(8, 22 - (speedAttr * 2));
    pdata.stealRecoverFrames = frames;
    pdata.turboActive = false;

    var dx = 0;
    var dy = 0;
    if (target && typeof target.x === "number" && typeof target.y === "number") {
        dx = Math.sign(defender.x - target.x);
        dy = Math.sign(defender.y - target.y);
    }
    if (dx === 0 && dy === 0) {
        var vec = getBearingVector(defender.bearing);
        dx = -vec.dx;
        dy = -vec.dy;
    }
    if (dx === 0 && dy === 0) {
        dx = defender.x >= Math.floor(COURT_WIDTH / 2) ? 1 : -1;
    }
    var newX = clampToCourtX(defender.x + dx);
    var newY = clampToCourtY(defender.y + dy);
    if (typeof defender.moveTo === "function") {
        defender.moveTo(newX, newY);
    }
}

function decrementStealRecovery(player) {
    if (!player || !player.playerData) return;
    if (player.playerData.stealRecoverFrames > 0) {
        player.playerData.stealRecoverFrames--;
        if (player.playerData.stealRecoverFrames < 0) {
            player.playerData.stealRecoverFrames = 0;
        }
    }
}

function attemptShake(player) {
    if (!player || !player.playerData) return false;
    var teamName = getPlayerTeamName(player);
    if (!teamName) return false;
    if (player.playerData.shakeCooldown > 0) return false;

    player.playerData.shakeCooldown = 25;

    var power = getEffectiveAttribute(player.playerData, ATTR_POWER) || 5;
    var turboBonus = (player.playerData.turboActive && player.playerData.turbo > 0) ? 2 : 0;
    var touching = getTouchingOpponents(player, teamName, 2.75);
    if (!touching.length) return false;

    var affected = 0;
    var knockdownCount = 0;

    for (var i = 0; i < touching.length; i++) {
        var defender = touching[i];
        if (!defender || !defender.playerData) continue;
        var defenderPower = getEffectiveAttribute(defender.playerData, ATTR_POWER) || 5;
        var aggressorScore = power + turboBonus;
        var threshold = (aggressorScore + 6) / (aggressorScore + defenderPower + 12);
        threshold = clamp(threshold, 0.15, 0.9);
        if (Math.random() > threshold) continue;

        var push = Math.max(1, Math.min(5, Math.round((aggressorScore - defenderPower) / 2 + 2 + Math.random() * 2)));
        knockBack(defender, player, push);
        incrementInjury(defender, 1);
        affected++;

        var knockdownChance = Math.max(0, (aggressorScore - defenderPower) * 0.08 + Math.random() * 0.1);
        knockdownChance = Math.min(knockdownChance, 0.45);
        if (Math.random() < knockdownChance) {
            setPlayerKnockedDown(defender, 32 + Math.round(Math.random() * 18));
            knockdownCount++;
        }
    }

    if (affected > 0) {
        player.playerData.hasDribble = true;
        if (player.playerData.turboActive) player.playerData.useTurbo(TURBO_DRAIN_RATE);
        var eventKey = knockdownCount > 0 ? "shake_knockdown" : "shake_break";
        announceEvent(eventKey, {
            player: player,
            team: teamName,
            playerName: player.playerData.name
        });
        return true;
    }
    return false;
}

function handlePostShakeDecision(player, teamName) {
    if (!player || player.isHuman || !player.playerData) return false;
    var basket = getOffensiveBasket(teamName);
    var opponentTeam = teamName === "red" ? "blue" : "red";
    var closestDefender = getClosestPlayer(player.x, player.y, opponentTeam);
    var shotProb = calculateShotProbability(player, basket.x, basket.y, closestDefender);
    if (shotProb >= (SHOT_PROBABILITY_THRESHOLD - 6)) {
        player.playerData.aiLastAction = "shake_shot";
        attemptShot();
        return true;
    }

    var teammate = getTeammate(player);
    if (teammate && teammate.playerData) {
        var teammateClosest = getClosestPlayer(teammate.x, teammate.y, opponentTeam);
        var teammateProb = calculateShotProbability(teammate, basket.x, basket.y, teammateClosest);
        var leadTarget = null;
        if (teammate.playerData.emergencyCut) {
            leadTarget = teammate.playerData.emergencyCut.leadTarget || teammate.playerData.aiTargetSpot;
        }
        if (teammateProb >= (SHOT_PROBABILITY_THRESHOLD - 10) || !closestDefender || getSpriteDistance(player, closestDefender) < 3) {
            player.playerData.aiLastAction = "shake_pass";
            animatePass(player, teammate, leadTarget);
            return true;
        }
    }
    return false;
}

function createLooseBall(defender, victim) {
    var startX = gameState.ballX || (victim ? victim.x + 2 : defender.x);
    var startY = gameState.ballY || (victim ? victim.y + 2 : defender.y);
    var dirX = victim ? (victim.x - defender.x) : 1;
    var dirY = victim ? (victim.y - defender.y) : 0;
    if (dirX === 0 && dirY === 0) dirX = 1;

    var magnitude = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    dirX /= magnitude;
    dirY /= magnitude;

    var endX = clampToCourtX(Math.round(startX + dirX * 6));
    var endY = clampToCourtY(Math.round(startY + dirY * 3));

    var steps = 8;
    for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var bx = Math.round(startX + (endX - startX) * t);
        var by = Math.round(startY + (endY - startY) * t - Math.sin(t * Math.PI) * 2);
        if (moveBallFrameTo) moveBallFrameTo(bx, by);
        Sprite.cycle();
        cycleFrame(courtFrame);
        mswait(25);
    }

    gameState.reboundActive = true;
    gameState.shotInProgress = false;
    gameState.ballCarrier = null;
    gameState.reboundX = endX;
    gameState.reboundY = endY;
    clearPotentialAssist();
    announceEvent("loose_ball", {
        team: defender ? getPlayerTeamName(defender) : null,
        player: defender,
        playerName: defender && defender.playerData ? defender.playerData.name : ""
    });
    resolveReboundScramble();
}

function attemptShove(defender) {
    if (!defender || !defender.playerData) return;
    if (defender.playerData.shoveCooldown > 0) return;
    var victim = gameState.ballCarrier;
    if (!victim || !victim.playerData) return;
    if (victim.playerData.hasDribble !== false) return;

    var distance = getSpriteDistance(defender, victim);
    if (distance > 2.5) return;

    defender.playerData.shoveCooldown = 35;

    var defPower = getEffectiveAttribute(defender.playerData, ATTR_POWER) || 5;
    if (defender.playerData.turboActive && defender.playerData.turbo > 0) {
        defPower += 2;
        defender.playerData.useTurbo(TURBO_DRAIN_RATE * 0.5);
    }
    var victimPower = getEffectiveAttribute(victim.playerData, ATTR_POWER) || 5;
    var rng = Math.random();
    var threshold = (defPower + 6) / (defPower + victimPower + 12);
    if (threshold < 0.2) threshold = 0.2;
    if (threshold > 0.9) threshold = 0.9;

    if (rng < threshold) {
        var push = Math.max(2, Math.min(5, Math.round((defPower - victimPower) / 2 + 3)));
        knockBack(victim, defender, push);
        incrementInjury(victim, 1);
        victim.playerData.hasDribble = false;
        announceEvent("shove", {
            playerName: defender.playerData.name,
            player: defender,
            team: getPlayerTeamName(defender)
        });
        createLooseBall(defender, victim);
    }
}

function attemptBlock(blocker, options) {
    if (!blocker || !blocker.playerData) return;

    // Can only block on defense or during a shot
    var blockerTeam = getPlayerTeamName(blocker);
    if (!blockerTeam) return;

    if (blockerTeam === gameState.currentTeam && !gameState.shotInProgress) {
        announceEvent("crowd_reaction", { team: blockerTeam });
        return;
    }

    // Start block animation
    gameState.activeBlock = blocker;
    var duration = BLOCK_JUMP_DURATION;
    if (options && typeof options.duration === "number") {
        duration = Math.max(6, Math.round(options.duration));
    }
    gameState.activeBlockDuration = duration;
    gameState.blockJumpTimer = duration;
    blocker.blockOriginalY = blocker.y;
    blocker.blockJumpHeightBoost = (options && typeof options.heightBoost === "number") ? options.heightBoost : 0;
    clearJumpIndicator(blocker);
    blocker.prevJumpBottomY = null;

    var suppliedDir = options && typeof options.direction === "number" ? options.direction : null;
    if (suppliedDir === 0) suppliedDir = null;
    if (suppliedDir === null) {
        var shotX = typeof gameState.shotStartX === "number" ? gameState.shotStartX : blocker.x;
        suppliedDir = (blocker.x <= shotX) ? 1 : -1;
    }
    blocker.jumpIndicatorDir = suppliedDir;
}

function attemptUserSteal(defender) {
    var ballCarrier = gameState.ballCarrier;
    if (!defender || !ballCarrier) return;
    if (gameState.currentTeam === "red") return; // Can't steal when you have possession

    var defenderData = defender.playerData;
    var carrierData = ballCarrier.playerData;
    if (!defenderData || !carrierData) return;
    if (defenderData.stealRecoverFrames > 0) return;

    // Check distance
    var dx = Math.abs(defender.x - ballCarrier.x);
    var dy = Math.abs(defender.y - ballCarrier.y);
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 6) {
        return;
    }

    // User steal chance (better than AI)
    var stealChance = getEffectiveAttribute(defenderData, ATTR_STEAL) * 5;
    var resistance = getEffectiveAttribute(carrierData, ATTR_POWER) * 4;
    var chance = (stealChance - resistance + 15) / 100;

    if (chance < 0.1) chance = 0.1;
    if (chance > 0.4) chance = 0.4; // Human can be slightly better

    var defenderTeamName = getPlayerTeamName(defender);
    var carrierDistToBasket = getSpriteDistanceToBasket(ballCarrier, defenderTeamName);
    if (carrierDistToBasket > DEFENDER_PERIMETER_LIMIT) {
        chance *= 0.5;
    }

    if (Math.random() < chance) {
        // Steal successful!
        recordTurnover(ballCarrier, "steal");
        var defenderTeam = (defender === redPlayer1 || defender === redPlayer2) ? "red" : "blue";
        var opponentTeam = defenderTeam === "red" ? "blue" : "red";

        gameState.reboundActive = false;
        gameState.shotClock = 24;
        gameState.currentTeam = defenderTeam;
        triggerPossessionBeep();
        gameState.ballCarrier = defender;
        resetBackcourtState();
        gameState.ballHandlerStuckTimer = 0;
        gameState.ballHandlerAdvanceTimer = 0;

        // Reset opponent's streak
        gameState.consecutivePoints[opponentTeam] = 0;

        gameState.ballHandlerLastX = defender.x;
        gameState.ballHandlerLastY = defender.y;
        gameState.ballHandlerFrontcourtStartX = defender.x;
        gameState.ballHandlerProgressOwner = defender;

        defenderData.hasDribble = true;
        carrierData.hasDribble = false;

        // Reassign defensive matchups since we now have the ball
        assignDefensiveMatchups();

        if (defenderData.stats) {
            defenderData.stats.steals++;
        }
        clearPotentialAssist();

        announceEvent("steal", {
            playerName: defenderData.name,
            player: defender,
            team: defenderTeam
        });
    } else {
        beginStealRecovery(defender, ballCarrier);
    }
}

function attemptAISteal(defender, ballCarrier) {
    if (!defender || !ballCarrier) return;

    var defenderData = defender.playerData;
    var carrierData = ballCarrier.playerData;
    if (!defenderData || !carrierData) return;
    if (defenderData.stealRecoverFrames > 0) return;

    if (carrierData.hasDribble === false) {
        attemptShove(defender);
        return;
    }

    // Check distance one more time to be safe
    var dx = Math.abs(defender.x - ballCarrier.x);
    var dy = Math.abs(defender.y - ballCarrier.y);
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 6) return; // Too far

    // Steal chance based on attributes (reduced for more difficulty)
    var stealChance = getEffectiveAttribute(defenderData, ATTR_STEAL) * 4; // Reduced from 8 to 4
    var resistance = getEffectiveAttribute(carrierData, ATTR_POWER) * 4; // Increased from 3 to 4
    var chance = (stealChance - resistance + 10) / 100; // Reduced base from 20 to 10

    if (chance < 0.05) chance = 0.05; // Lowered minimum
    if (chance > 0.35) chance = 0.35; // AI slightly worse at steals than human

    var defenderTeamName = getPlayerTeamName(defender);
    var carrierDistToBasket = getSpriteDistanceToBasket(ballCarrier, defenderTeamName);
    if (carrierDistToBasket > DEFENDER_PERIMETER_LIMIT) {
        chance *= 0.5;
    }

    if (Math.random() < chance) {
        // Steal successful!
        recordTurnover(ballCarrier, "steal");
        gameState.reboundActive = false;
        gameState.shotClock = 24; // Reset shot clock on steal

        // Figure out which team gets the ball
        var defenderTeam = (defender === redPlayer1 || defender === redPlayer2) ? "red" : "blue";
        gameState.currentTeam = defenderTeam;
        triggerPossessionBeep();
        gameState.ballCarrier = defender;
        resetBackcourtState();
        gameState.ballHandlerStuckTimer = 0;
        gameState.ballHandlerAdvanceTimer = 0;
        gameState.ballHandlerLastX = defender.x;
        gameState.ballHandlerLastY = defender.y;
        gameState.ballHandlerFrontcourtStartX = defender.x;
        gameState.ballHandlerProgressOwner = defender;
        defender.playerData.hasDribble = true;
        carrierData.hasDribble = false;
        assignDefensiveMatchups();

        // Reset opponent's streak
        var otherTeam = defenderTeam === "red" ? "blue" : "red";
        gameState.consecutivePoints[otherTeam] = 0;

        if (defenderData.stats) {
            defenderData.stats.steals++;
        }
        clearPotentialAssist();

        announceEvent("steal", {
            playerName: defenderData.name,
            player: defender,
            team: defenderTeam
        });
    } else {
        beginStealRecovery(defender, ballCarrier);
    }
}

function createRebound(x, y) {
    // Animate ball bouncing off rim before announcing rebound
    // Ball bounces 1-2 times off rim/backboard before settling
    var bounces = Math.random() < 0.5 ? 1 : 2;
    var currentX = x;
    var currentY = y;

    for (var b = 0; b < bounces; b++) {
        // Bounce direction (away from basket)
        var bounceX = currentX + (Math.random() * 8 - 4);
        var bounceY = currentY + (Math.random() * 6 - 3);

        // Clamp to reasonable area near basket
        bounceX = Math.max(x - 8, Math.min(x + 8, bounceX));
        bounceY = Math.max(y - 5, Math.min(y + 5, bounceY));

        // Animate the bounce
        var steps = 6;
        var dx = bounceX - currentX;
        var dy = bounceY - currentY;

        for (var i = 0; i <= steps; i++) {
            var t = i / steps;
            var bx = Math.round(currentX + (dx * t));
            // Parabolic arc for bounce
            var arcHeight = 2;
            var by = Math.round(currentY + (dy * t) - (Math.sin(t * Math.PI) * arcHeight));

            // Move ball
            if (ballFrame && moveBallFrameTo) {
                moveBallFrameTo(bx, by);
            }

            Sprite.cycle();
            cycleFrame(courtFrame);
            mswait(40);
        }

        currentX = bounceX;
        currentY = bounceY;
    }

    // Final resting position for rebound
    gameState.reboundActive = true;
    gameState.reboundX = currentX + (Math.random() * 4 - 2);
    gameState.reboundY = currentY + (Math.random() * 3 - 1);

    // Clamp to court boundaries
    if (gameState.reboundX < 2) gameState.reboundX = 2;
    if (gameState.reboundX > COURT_WIDTH - 2) gameState.reboundX = COURT_WIDTH - 2;
    if (gameState.reboundY < 2) gameState.reboundY = 2;
    if (gameState.reboundY > COURT_HEIGHT - 2) gameState.reboundY = COURT_HEIGHT - 2;

    // Move ball to final rebound position
    if (ballFrame && moveBallFrameTo) {
        moveBallFrameTo(gameState.reboundX, gameState.reboundY);
    }
}

/**
 * Resolve rebound scramble - determine who gets the ball
 * Let players race to the ball for a short time, then award it to closest player
 */
function resolveReboundScramble() {
    if (!gameState.reboundActive) return;

    // Let players scramble for the ball for ~1 second
    // During this time, AI will run toward rebound location
    var scrambleFrames = 50; // About 1 second at 50ms per frame
    var reboundX = gameState.reboundX;
    var reboundY = gameState.reboundY;

    for (var frame = 0; frame < scrambleFrames; frame++) {
        // Update AI to go for rebound
        updateAI();

        // Redraw
        drawCourt();
        drawScore();

        mswait(20);

        // Early exit: if someone is very close, they got it
        var allPlayers = getAllPlayers();
        for (var i = 0; i < allPlayers.length; i++) {
            var player = allPlayers[i];
            if (!player) continue;

            var dist = distanceBetweenPoints(player.x, player.y, reboundX, reboundY);
            if (dist < 3) {
                // This player secured the rebound!
                secureRebound(player);
                return;
            }
        }
    }

    // Time expired - award to closest player
    var closestPlayer = null;
    var closestDist = 999;

    var allPlayers = getAllPlayers();
    for (var i = 0; i < allPlayers.length; i++) {
        var player = allPlayers[i];
        if (!player) continue;

        var dist = distanceBetweenPoints(player.x, player.y, reboundX, reboundY);
        if (dist < closestDist) {
            closestDist = dist;
            closestPlayer = player;
        }
    }

    if (closestPlayer) {
        secureRebound(closestPlayer);
    } else {
        // Fallback: just switch possession normally
        switchPossession();
    }
}

/**
 * Award the rebound to a specific player
 */
function secureRebound(player) {
    if (!player || !player.playerData) {
        switchPossession();
        return;
    }

    // Clear rebound state
    gameState.reboundActive = false;
    if (player.playerData.stats) {
        player.playerData.stats.rebounds++;
    }
    clearPotentialAssist();

    // Determine team
    var teamName = getPlayerTeamName(player);
    var previousTeam = gameState.currentTeam;
    if (!teamName) {
        switchPossession();
        return;
    }

    // Award possession
    gameState.currentTeam = teamName;
    gameState.ballCarrier = player;
    gameState.shotClock = 24; // Reset shot clock
    resetBackcourtState();
    gameState.ballHandlerStuckTimer = 0;
    gameState.ballHandlerAdvanceTimer = 0;
    gameState.ballHandlerLastX = player.x;
    gameState.ballHandlerLastY = player.y;
    gameState.ballHandlerFrontcourtStartX = player.x;
    gameState.ballHandlerProgressOwner = player;
    if (player.playerData) player.playerData.hasDribble = true;

    if (teamName !== previousTeam) {
        triggerPossessionBeep();
    }

    // Announce who got it
    announceEvent("rebound", {
        playerName: player.playerData.name,
        player: player,
        team: teamName
    });

    // Reset heat for opposing team
    var otherTeam = teamName === "red" ? "blue" : "red";
    gameState.consecutivePoints[otherTeam] = 0;

    // Assign defensive matchups
    assignDefensiveMatchups();

    // Brief pause to show who got it
    mswait(500);

    // Now the rebounder needs to bring it up - AI will handle this via normal offense logic
}

function isInsideDunkKey(centerX, targetX, attackDir) {
    if (attackDir > 0) {
        return centerX >= (targetX - KEY_DEPTH);
    }
    return centerX <= (targetX + KEY_DEPTH);
}

function evaluateDunkOpportunity(player, teamName, targetX, targetY, scaledDistance) {
    if (!player || !player.playerData) return null;
    if (scaledDistance > THREE_POINT_RADIUS) return null;

    var attackDir = teamName === "red" ? 1 : -1;
    var playerData = player.playerData;

    var spriteHalfWidth = 2;
    var spriteHalfHeight = 2;
    if (player.frame) {
        if (typeof player.frame.width === "number") {
            spriteHalfWidth = Math.floor(player.frame.width / 2);
        }
        if (typeof player.frame.height === "number") {
            spriteHalfHeight = Math.floor(player.frame.height / 2);
        }
    }

    var centerX = player.x + spriteHalfWidth;
    var centerY = player.y + spriteHalfHeight;

    // Must be attacking toward the rim (not behind it)
    if ((attackDir > 0 && centerX >= targetX) || (attackDir < 0 && centerX <= targetX)) {
        return null;
    }

    var absDx = Math.abs(targetX - centerX);
    if (absDx > KEY_DEPTH + 4) return null;

    var insideKey = isInsideDunkKey(centerX, targetX, attackDir);
    var adjustedDy = Math.abs(targetY - centerY) * (insideKey ? 1 : 2);
    var adjustedDistance = Math.sqrt(absDx * absDx + adjustedDy * adjustedDy);

    var rawDunkSkill = getBaseAttribute(playerData, ATTR_DUNK);
    var effectiveDunkSkill = getEffectiveAttribute(playerData, ATTR_DUNK);
    if (!playerData.onFire && rawDunkSkill <= 2 && !insideKey) {
        return null; // low dunkers must be in the restricted area
    }

    var dunkRange = DUNK_DISTANCE_BASE + effectiveDunkSkill * DUNK_DISTANCE_PER_ATTR;
    if (!playerData.onFire && rawDunkSkill <= 3) {
        dunkRange -= (4 - rawDunkSkill) * 0.4;
    }
    if (dunkRange < DUNK_MIN_DISTANCE) dunkRange = DUNK_MIN_DISTANCE;
    if (adjustedDistance > dunkRange) return null;

    var flightSkillFactor = clamp((effectiveDunkSkill + 1) / 11, 0.4, 1.05);
    var baseSkillFactor = clamp((rawDunkSkill + 1) / 11, 0.3, 1.0);

    return {
        attackDir: attackDir,
        adjustedDistance: adjustedDistance,
        absDx: absDx,
        absDy: Math.abs(targetY - centerY),
        insideKey: insideKey,
        centerX: centerX,
        centerY: centerY,
        spriteHalfWidth: spriteHalfWidth,
        spriteHalfHeight: spriteHalfHeight,
        dunkRange: dunkRange,
        dunkSkill: effectiveDunkSkill,
        rawDunkSkill: rawDunkSkill,
        flightSkillFactor: flightSkillFactor,
        baseSkillFactor: baseSkillFactor
    };
}

function calculateDunkChance(playerData, dunkInfo, closestDefender, teamName) {
    var effectiveDunkSkill = getEffectiveAttribute(playerData, ATTR_DUNK);
    var rawDunkSkill = dunkInfo ? dunkInfo.rawDunkSkill : getBaseAttribute(playerData, ATTR_DUNK);
    var baseChance = 48 + effectiveDunkSkill * 5;

    if (!playerData.onFire && rawDunkSkill <= 2) {
        baseChance -= (3 - rawDunkSkill) * 6;
    }

    if (dunkInfo.adjustedDistance < 3.5) baseChance += 6;
    if (!dunkInfo.insideKey) baseChance -= 4;
    if (dunkInfo.adjustedDistance > (dunkInfo.dunkRange - 0.5)) {
        baseChance -= (dunkInfo.adjustedDistance - (dunkInfo.dunkRange - 0.5)) * 8;
    }

    if (closestDefender) {
        var defenderHalfWidth = 2;
        var defenderHalfHeight = 2;
        if (closestDefender.frame) {
            if (typeof closestDefender.frame.width === "number") {
                defenderHalfWidth = Math.floor(closestDefender.frame.width / 2);
            }
            if (typeof closestDefender.frame.height === "number") {
                defenderHalfHeight = Math.floor(closestDefender.frame.height / 2);
            }
        }
        var defenderCenterX = closestDefender.x + defenderHalfWidth;
        var defenderCenterY = closestDefender.y + defenderHalfHeight;
        var separation = distanceBetweenPoints(defenderCenterX, defenderCenterY, dunkInfo.centerX, dunkInfo.centerY);
        var blockAttr = closestDefender.playerData
            ? getEffectiveAttribute(closestDefender.playerData, ATTR_BLOCK)
            : 0;
        var defensePenalty = Math.max(0, (6 - separation)) * (2 + blockAttr * 0.6);
        baseChance -= defensePenalty;
    }

    baseChance += (playerData.heatStreak || 0) * 4;
    if (playerData && playerData.onFire) {
        baseChance += 10;
    }

    if (baseChance < 25) baseChance = 25;
    if (baseChance > 98) baseChance = 98;
    return baseChance;
}

function selectDunkStyle(playerData, dunkInfo) {
    var dunkSkill = playerData ? getEffectiveAttribute(playerData, ATTR_DUNK) : 0;
    var rawSkill = playerData ? getBaseAttribute(playerData, ATTR_DUNK) : 0;

    var weights = {
        standard: 2.2,
        power: 1.4
    };

    if (rawSkill >= 6 || playerData.onFire) {
        weights.glide = (weights.glide || 0) + (1 + ((dunkSkill) - 5) * 0.45);
    }
    if (rawSkill >= 7 || playerData.onFire) {
        weights.hang = (weights.hang || 0) + (0.8 + ((dunkSkill) - 6) * 0.35);
    }
    if (rawSkill >= 8 || playerData.onFire) {
        weights.windmill = (weights.windmill || 0) + (0.7 + ((dunkSkill) - 7) * 0.3);
    }

    if (!dunkInfo.insideKey) {
        weights.glide = (weights.glide || 0) + 0.9;
        weights.windmill = (weights.windmill || 0) + 0.6;
    }

    if (dunkInfo.adjustedDistance < 3.5) {
        weights.power += 0.6;
    }

    var styles = [];
    var totalWeight = 0;
    for (var key in weights) {
        if (!weights.hasOwnProperty(key)) continue;
        var weight = weights[key];
        if (weight <= 0) continue;
        styles.push({ style: key, weight: weight });
        totalWeight += weight;
    }

    if (!styles.length || totalWeight <= 0) {
        return "standard";
    }

    var roll = Math.random() * totalWeight;
    var cumulative = 0;
    for (var i = 0; i < styles.length; i++) {
        cumulative += styles[i].weight;
        if (roll <= cumulative) {
            return styles[i].style;
        }
    }

    return styles[0].style || "standard";
}

function generateDunkFlight(player, dunkInfo, targetX, targetY, style) {
    var rimCenterX = targetX;
    var rimCenterY = targetY;
    var startX = dunkInfo.centerX;
    var startY = dunkInfo.centerY;
    var dx = rimCenterX - startX;
    var dy = rimCenterY - startY;
    var travel = Math.sqrt(dx * dx + dy * dy);
    var baseSteps = Math.max(12, Math.round(travel * 3));

    var skillFactor = dunkInfo.flightSkillFactor || 1;
    var rawSkillFactor = dunkInfo.baseSkillFactor || skillFactor;

    var stepsFactor = 1;
    var arcBonus = 0;
    var msBase = 30;
    var apexHold = 0;
    var verticalFloat = 0;
    var lateralWaveAmp = 0;
    var lateralWaveFreq = 1;

    switch (style) {
        case "power":
            stepsFactor = 0.85;
            arcBonus = -0.4;
            msBase = 24;
            break;
        case "glide":
            stepsFactor = 1.25;
            arcBonus = 0.7;
            msBase = 30;
            verticalFloat = 0.12;
            break;
        case "hang":
            stepsFactor = 1.35;
            arcBonus = 1.0;
            msBase = 34;
            apexHold = 3;
            verticalFloat = 0.2;
            break;
        case "windmill":
            stepsFactor = 1.15;
            arcBonus = 0.6;
            msBase = 32;
            lateralWaveAmp = 0.9;
            lateralWaveFreq = 2;
            break;
        default:
            stepsFactor = 1.05;
            arcBonus = 0.2;
            msBase = 30;
            break;
    }

    var stepScale = clamp(0.8 + skillFactor * 0.35, 0.7, 1.2);
    var steps = Math.max(10, Math.round(baseSteps * stepsFactor * stepScale));
    var arcScale = clamp(0.6 + skillFactor * 0.6, 0.7, 1.35);
    var minArc = DUNK_ARC_HEIGHT_MIN * clamp(0.65 + rawSkillFactor * 0.5, 0.6, 1.4);
    var rawArc = 1.25 + travel * 0.65 + arcBonus;
    var arcHeight = Math.max(
        minArc,
        Math.min((DUNK_ARC_HEIGHT_MAX + arcBonus) * arcScale, rawArc * arcScale)
    );

    var frames = [];
    var apexIndex = 0;
    var apexY = Infinity;

    for (var i = 1; i <= steps; i++) {
        var t = i / steps;
        var ease;
        if (style === "power") {
            ease = Math.pow(t, 0.78);
        } else if (style === "hang") {
            ease = t - Math.sin(t * Math.PI) * 0.08;
        } else if (style === "glide") {
            ease = t * t * (3 - 2 * t) + Math.sin(t * Math.PI) * 0.03;
        } else {
            ease = t * t * (3 - 2 * t);
        }
        if (ease < 0) ease = 0;
        if (ease > 1) ease = 1;

        var sineFactor = ease;
        if (verticalFloat) {
            sineFactor += verticalFloat * Math.sin(t * Math.PI);
            if (sineFactor > 1) sineFactor = 1;
            if (sineFactor < 0) sineFactor = 0;
        }

        var lateral = 0;
        if (lateralWaveAmp) {
            lateral = lateralWaveAmp * Math.sin(t * Math.PI * lateralWaveFreq);
        }

        var currentX = startX + dx * ease + lateral * dunkInfo.attackDir;
        var currentY = startY + dy * ease - Math.sin(sineFactor * Math.PI) * arcHeight;

        var ms = msBase;
        if (style === "hang" && t > 0.4 && t < 0.8) {
            ms += 12;
        } else if (style === "glide") {
            ms += Math.round(Math.sin(t * Math.PI) * 4);
        } else if (style === "windmill") {
            ms += Math.round(Math.sin(t * Math.PI) * 6);
        }
        if (style === "power" && t > 0.8) {
            ms -= 2;
        }
        if (ms < 18) ms = 18;
        ms = Math.round(ms);

        var frame = {
            centerX: currentX,
            centerY: currentY,
            progress: ease,
            t: t,
            ms: ms,
            ballOffsetX: 0,
            ballOffsetY: 0
        };

        if (style === "windmill") {
            frame.ballOffsetX = Math.sin(t * Math.PI) * dunkInfo.attackDir;
            frame.ballOffsetY = Math.cos(t * Math.PI) * 0.4;
        } else if (style === "hang") {
            frame.ballOffsetY = Math.sin(t * Math.PI) * -0.25;
        }

        frames.push(frame);

        if (currentY < apexY) {
            apexY = currentY;
            apexIndex = frames.length - 1;
        }
    }

    if (apexHold > 0 && frames.length) {
        var apexFrame = frames[apexIndex];
        var holdFrames = [];
        for (var h = 0; h < apexHold; h++) {
            holdFrames.push({
                centerX: apexFrame.centerX,
                centerY: apexFrame.centerY - (h % 2 === 0 ? 0 : 0.1),
                progress: apexFrame.progress,
                t: apexFrame.t,
                ms: Math.max(34, msBase + 10),
                ballOffsetX: apexFrame.ballOffsetX,
                ballOffsetY: apexFrame.ballOffsetY,
                hang: true
            });
        }
        frames = frames.slice(0, apexIndex + 1).concat(holdFrames, frames.slice(apexIndex + 1));
    }

    return {
        style: style,
        frames: frames,
        arcHeight: arcHeight,
        rimX: rimCenterX,
        rimY: rimCenterY
    };
}

function autoContestDunk(dunker, dunkInfo, targetX, targetY, style) {
    var teamName = getPlayerTeamName(dunker);
    if (!teamName) return;

    var defenders = getOpposingTeamSprites(teamName);
    if (!defenders || !defenders.length) return;

    var best = null;
    var bestScore = -Infinity;

    for (var i = 0; i < defenders.length; i++) {
        var defender = defenders[i];
        if (!defender || defender.isHuman || !defender.playerData) continue;
        var distToDunker = getSpriteDistance(defender, dunker);
        var distToRim = distanceBetweenPoints(defender.x, defender.y, targetX, targetY);
        var blockAttr = defender.playerData ? getEffectiveAttribute(defender.playerData, ATTR_BLOCK) : 0;
        var score = (16 - distToDunker) * 1.4 + (12 - distToRim) * 0.9 + blockAttr * 2.1;
        if (defender.playerData.turbo > 6) {
            score += 1.5;
        }
        if (score > bestScore) {
            bestScore = score;
            best = defender;
        }
    }

    if (!best) return;

    var durationBoost = 0;
    var heightBoost = 0;
    if (style === "hang") {
        durationBoost = 6;
        heightBoost = 1.2;
    } else if (style === "glide") {
        durationBoost = 4;
        heightBoost = 0.8;
    } else if (style === "windmill") {
        durationBoost = 3;
        heightBoost = 0.6;
    } else if (style === "power") {
        durationBoost = 2;
    }

    if (best.playerData.turbo > 10) {
        activateAITurbo(best, 0.9, getSpriteDistance(best, dunker));
    } else if (best.playerData.turbo > 4 && Math.random() < 0.5) {
        activateAITurbo(best, 0.75, getSpriteDistance(best, dunker));
    }

    attemptBlock(best, {
        duration: BLOCK_JUMP_DURATION + durationBoost,
        heightBoost: heightBoost,
        direction: dunker.x >= best.x ? 1 : -1
    });
}

function maybeBlockDunk(dunker, frameData, dunkInfo, style) {
    if (!gameState.activeBlock || gameState.blockJumpTimer <= 0) return null;
    var blocker = gameState.activeBlock;
    if (!blocker || !blocker.playerData) return null;

    var blockerWidth = (blocker.frame && blocker.frame.width) ? blocker.frame.width : 4;
    var blockerCenterX = blocker.x + Math.floor(blockerWidth / 2);
    var blockerReachY = blocker.y + 1;
    var separation = distanceBetweenPoints(blockerCenterX, blockerReachY, frameData.handX, frameData.handY);
    if (separation > 3.6) return null;

    var blockAttr = blocker.playerData ? getEffectiveAttribute(blocker.playerData, ATTR_BLOCK) : 0;
    var dunkAttr = dunker.playerData ? getEffectiveAttribute(dunker.playerData, ATTR_DUNK) : 0;

    var baseChance = 34 + blockAttr * 7;
    baseChance += Math.max(0, (3.6 - separation)) * 11;
    if (!dunkInfo.insideKey) baseChance += 5;
    if (frameData.progress > 0.55) baseChance += 6;
    if (style === "power") baseChance += 6;
    if (style === "hang") baseChance -= 7;
    if (style === "glide") baseChance -= 2;

    baseChance -= dunkAttr * 4;
    if (dunker.playerData && dunker.playerData.turboActive && dunker.playerData.turbo > 0) {
        baseChance -= 4;
    }

    baseChance = clamp(baseChance, 12, 92);

    if (Math.random() * 100 < baseChance) {
        gameState.lastBlocker = blocker;
        return { blocker: blocker };
    }

    return null;
}

function animateDunk(player, dunkInfo, targetX, targetY, made) {
    gameState.shotInProgress = true;
    gameState.shotStartX = player.x;
    gameState.shotStartY = player.y;

    var playerData = player.playerData || {};
    var style = selectDunkStyle(playerData, dunkInfo);
    var flightPlan = generateDunkFlight(player, dunkInfo, targetX, targetY, style);
    autoContestDunk(player, dunkInfo, targetX, targetY, style);

    var attackDir = dunkInfo.attackDir;
    var spriteWidth = (player.frame && player.frame.width) ? player.frame.width : 4;
    var spriteHeight = (player.frame && player.frame.height) ? player.frame.height : 4;
    var groundBottom = player.y + spriteHeight;

    clearJumpIndicator(player);
    player.prevJumpBottomY = groundBottom;

    var blocked = false;
    var blockingDefender = null;

    for (var i = 0; i < flightPlan.frames.length; i++) {
        var frame = flightPlan.frames[i];
        var spriteX = clampToCourtX(Math.round(frame.centerX) - dunkInfo.spriteHalfWidth);
        var spriteY = clampToCourtY(Math.round(frame.centerY) - dunkInfo.spriteHalfHeight);
        player.moveTo(spriteX, spriteY);
        if (typeof player.turnTo === "function") {
            player.turnTo(attackDir > 0 ? "e" : "w");
        }

        var flashPalette = getDunkFlashPalette(player);
        var flashText = getDunkLabelText(style, gameState.tickCounter + i);
        renderPlayerLabel(player, {
            highlightCarrier: false,
            forcedText: flashText,
            flashPalette: flashPalette,
            flashTick: gameState.tickCounter + i,
            forceTop: true
        });

        var handOffsetX = attackDir > 0 ? dunkInfo.spriteHalfWidth : -dunkInfo.spriteHalfWidth;
        var handX = clamp(Math.round(frame.centerX + handOffsetX + (frame.ballOffsetX || 0)), 1, COURT_WIDTH);
        var handY = clamp(Math.round(frame.centerY + dunkInfo.spriteHalfHeight - 1 + (frame.ballOffsetY || 0)), 1, COURT_HEIGHT);

        moveBallFrameTo(handX, handY);
        gameState.ballX = handX;
        gameState.ballY = handY;

        var currentBottom = spriteY + spriteHeight;
        var prevBottom = (typeof player.prevJumpBottomY === "number") ? player.prevJumpBottomY : groundBottom;
        var ascending = currentBottom <= prevBottom;
        updateJumpIndicator(player, {
            groundBottom: groundBottom,
            currentBottom: currentBottom,
            ascending: ascending,
            horizontalDir: attackDir,
            spriteWidth: spriteWidth,
            spriteHeight: spriteHeight,
            spriteHalfWidth: dunkInfo.spriteHalfWidth,
            spriteHalfHeight: dunkInfo.spriteHalfHeight,
            flightFrames: flightPlan.frames,
            frameIndex: i
        });
        player.prevJumpBottomY = currentBottom;

        var blockCheck = maybeBlockDunk(player, {
            handX: handX,
            handY: handY,
            centerX: frame.centerX,
            centerY: frame.centerY,
            progress: frame.progress
        }, dunkInfo, style);

        Sprite.cycle();
        cycleFrame(courtFrame);

        if (blockCheck) {
            blocked = true;
            blockingDefender = blockCheck.blocker;
            made = false;
            mswait(frame.ms || 30);
            break;
        }

        mswait(frame.ms || 30);
    }

    clearJumpIndicator(player);
    player.prevJumpBottomY = null;

    if (blocked) {
        if (blockingDefender && blockingDefender.playerData && blockingDefender.playerData.stats) {
            blockingDefender.playerData.stats.blocks = (blockingDefender.playerData.stats.blocks || 0) + 1;
        }

        var knockbackX = clampToCourtX(player.x - attackDir * 2);
        var knockbackY = clampToCourtY(player.y + 1);
        player.moveTo(knockbackX, knockbackY);
        if (typeof player.turnTo === "function") {
            player.turnTo(attackDir > 0 ? "e" : "w");
        }

        renderPlayerLabel(player, { highlightCarrier: true, forceTop: true });

        var deflectX = clamp(targetX - attackDir * (2 + Math.round(Math.random() * 2)), 1, COURT_WIDTH);
        var deflectY = clamp(targetY + 2 + Math.round(Math.random() * 2), 1, COURT_HEIGHT);
        moveBallFrameTo(deflectX, deflectY);
        gameState.ballX = deflectX;
        gameState.ballY = deflectY;
        Sprite.cycle();
        cycleFrame(courtFrame);
        mswait(70);

        gameState.reboundActive = true;
        gameState.ballCarrier = null;
        gameState.reboundX = deflectX;
        gameState.reboundY = deflectY;
        gameState.shotInProgress = false;
        clearPotentialAssist();

        return { made: false, blocked: true, blocker: blockingDefender, style: style, ballX: deflectX, ballY: deflectY };
    }

    var finishX = clampToCourtX(targetX - attackDir * 2 - dunkInfo.spriteHalfWidth + 2);
    var finishY = clampToCourtY(targetY - dunkInfo.spriteHalfHeight);
    player.moveTo(finishX, finishY);
    if (typeof player.turnTo === "function") {
        player.turnTo(attackDir > 0 ? "e" : "w");
    }

    renderPlayerLabel(player, { highlightCarrier: true, forceTop: true });

    if (made) {
        for (var drop = 0; drop < 3; drop++) {
            var dropY = clamp(targetY + drop, 1, COURT_HEIGHT);
            moveBallFrameTo(targetX, dropY);
            gameState.ballX = targetX;
            gameState.ballY = dropY;
            Sprite.cycle();
            cycleFrame(courtFrame);
            mswait(45);
        }
        moveBallFrameTo(targetX, clamp(targetY + 3, 1, COURT_HEIGHT));
        gameState.ballX = targetX;
        gameState.ballY = clamp(targetY + 3, 1, COURT_HEIGHT);
        mswait(80);
    } else {
        moveBallFrameTo(targetX, targetY);
        gameState.ballX = targetX;
        gameState.ballY = targetY;
        Sprite.cycle();
        cycleFrame(courtFrame);
        mswait(60);
        var ricochetX = clamp(targetX - attackDir * 2, 1, COURT_WIDTH);
        var ricochetY = clamp(targetY + 2, 1, COURT_HEIGHT);
        moveBallFrameTo(ricochetX, ricochetY);
        gameState.ballX = ricochetX;
        gameState.ballY = ricochetY;
        Sprite.cycle();
        cycleFrame(courtFrame);
        mswait(80);
        moveBallFrameTo(targetX, targetY + 1);
        gameState.ballX = targetX;
        gameState.ballY = targetY + 1;
    }

    renderPlayerLabel(player, { highlightCarrier: true, forceTop: true });

    gameState.shotInProgress = false;
    return { made: made, blocked: false, style: style };
}

function animateShot(startX, startY, targetX, targetY, made) {
    // Mark shot in progress
    gameState.shotInProgress = true;
    gameState.shotStartX = startX;
    gameState.shotStartY = startY;

    var shooter = gameState.ballCarrier;
    if (shooter) {
        autoContestShot(shooter, targetX, targetY);
    }

    // Calculate distance to determine animation speed
    var dx = targetX - startX;
    var dy = targetY - startY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    // More steps for longer shots, realistic timing
    // NBA shot takes about 0.5-1.5 seconds depending on distance
    var steps = Math.max(15, Math.round(distance * 1.5));
    var msPerStep = Math.round(800 / steps); // Total ~800-1200ms for shot

    // Announce shot is in progress at start
    var blocked = false;

    for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var x = Math.round(startX + (dx * t));
        // Higher arc for longer shots
        var arcHeight = Math.min(5, 3 + (distance / 10));
        var y = Math.round(startY + (dy * t) - (Math.sin(t * Math.PI) * arcHeight));
        var clampedX = clamp(x, 1, COURT_WIDTH);
        var clampedY = clamp(y, 1, COURT_HEIGHT);

        // CHECK FOR BLOCK - if ball is in arc (t > 0.1 && t < 0.5) and blocker is jumping
        if (!blocked && gameState.activeBlock && gameState.blockJumpTimer > 0 && t > 0.1 && t < 0.5) {
            var blocker = gameState.activeBlock;
            // Check if blocker is near ball trajectory
            var blockDist = Math.sqrt(Math.pow(blocker.x - clampedX, 2) + Math.pow(blocker.y - clampedY, 2));

            if (blockDist < 4) { // Blocker must be very close
                // Check block attribute for success
                var blockChance = getEffectiveAttribute(blocker.playerData, ATTR_BLOCK) * 8 + 20; // 20-100%
                if (Math.random() * 100 < blockChance) {
                    blocked = true;
                    if (blocker.playerData && blocker.playerData.stats) {
                        blocker.playerData.stats.blocks++;
                    }
                    announceEvent("block", {
                        playerName: blocker.playerData.name,
                        player: blocker,
                        team: getPlayerTeamName(blocker)
                    });
                    made = false; // Block prevents made shot
                    break; // End shot animation early
                }
            }
        }

        // Draw ball at this position
        moveBallFrameTo(clampedX, clampedY);

        // Draw trail
        if (i > 0) {
            var prevT = (i - 1) / steps;
            var prevX = Math.round(startX + (dx * prevT));
            var prevY = Math.round(startY + (dy * prevT) - (Math.sin(prevT * Math.PI) * arcHeight));
            prevX = clamp(prevX, 1, COURT_WIDTH);
            prevY = clamp(prevY, 1, COURT_HEIGHT);
            courtFrame.gotoxy(prevX, prevY);
            courtFrame.putmsg(".", LIGHTGRAY | WAS_BROWN);
        }

        Sprite.cycle();
        cycleFrame(courtFrame);
        mswait(msPerStep);
    }

    // Clear shot in progress flag
    gameState.shotInProgress = false;

    // Flash basket if made
    if (made && !blocked) {
        for (var flash = 0; flash < 3; flash++) {
            // Flash rim (2 characters wide)
            courtFrame.gotoxy(targetX - 1, targetY);
            courtFrame.putmsg("*", YELLOW | WAS_BROWN);
            courtFrame.gotoxy(targetX + 1, targetY);
            courtFrame.putmsg("*", YELLOW | WAS_BROWN);
            cycleFrame(courtFrame);
            mswait(100);
            drawCourt();
            mswait(100);
        }
    }

    // Return result object
    return { made: made && !blocked, blocked: blocked };
}

function attemptShot() {
    var player = gameState.ballCarrier;
    if (!player) return;

    var playerData = player.playerData;
    if (!playerData) return;
    playerData.hasDribble = false;

    clampSpriteFeetToCourt(player);

    // Sync ball coordinates to the shooter's current position before calculations/animation
    updateBallPosition();
    var shotStartX = (typeof gameState.ballX === "number") ? gameState.ballX : player.x + 2;
    var shotStartY = (typeof gameState.ballY === "number") ? gameState.ballY : player.y + 2;

    var shooterTeam = getPlayerTeamName(player) || gameState.currentTeam;
    var targetX = shooterTeam === "red" ? BASKET_RIGHT_X : BASKET_LEFT_X;
    var targetY = shooterTeam === "red" ? BASKET_RIGHT_Y : BASKET_LEFT_Y;
    var attackDir = shooterTeam === "red" ? 1 : -1;

    // Calculate distances with scaled Y to reflect ANSI half-height cells
    var rawDx = player.x - targetX;
    var rawDy = player.y - targetY;
    var scaledDy = rawDy * 2;
    var scaledDistance = Math.sqrt(rawDx * rawDx + scaledDy * scaledDy);
    var planarDistance = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    var distance = planarDistance;

    // Determine if this is a 3-pointer (outside the 3-point arc)
    var is3Pointer = scaledDistance > THREE_POINT_RADIUS;
    var isCornerThree = isCornerThreePosition(player, shooterTeam);
    var stats = playerData.stats;

    if (stats) {
        stats.fga++;
        if (is3Pointer) stats.tpa++;
    }

    var closestDefender = getClosestPlayer(player.x, player.y, gameState.currentTeam === "red" ? "blue" : "red");
    if (!closestDefender) {
        closestDefender = {
            x: targetX - attackDir * 4,
            y: targetY,
            playerData: null
        };
    }

    var dunkInfo = evaluateDunkOpportunity(player, shooterTeam, targetX, targetY, scaledDistance);
    var attemptType = dunkInfo ? "dunk" : "shot";
    if (dunkInfo && stats) {
        stats.dunkAttempts = (stats.dunkAttempts || 0) + 1;
    }

    var dunkStyle = null;
    var dunkBlocker = null;

    // Base shooting chance from player attributes (more generous)
    var baseChance;
    var chance;
    var made;
    var blocked = false;

    if (attemptType === "dunk") {
        chance = calculateDunkChance(playerData, dunkInfo, closestDefender, shooterTeam);
        made = Math.random() * 100 < chance;
        var dunkResult = animateDunk(player, dunkInfo, targetX, targetY, made);
        made = dunkResult.made;
        blocked = dunkResult.blocked;
        if (dunkResult.style) dunkStyle = dunkResult.style;
        if (dunkResult.blocker) dunkBlocker = dunkResult.blocker;
        distance = dunkInfo.adjustedDistance;
    } else {
        var threeAttr = getEffectiveAttribute(playerData, ATTR_3PT);
        var dunkAttr = getEffectiveAttribute(playerData, ATTR_DUNK);
        if (is3Pointer) {
            baseChance = 40 + (threeAttr * 4);
        } else if (distance < 10) {
            baseChance = 60 + (dunkAttr * 3);
        } else {
            baseChance = 50 + ((dunkAttr + threeAttr) * 2);
        }

        if (isCornerThree) {
            baseChance += 6;
        }

        var distancePenalty = is3Pointer ?
            (scaledDistance - THREE_POINT_RADIUS) * 1.5 :
            (planarDistance - 3) * 0.8;
        if (distancePenalty < 0) distancePenalty = 0;
        if (isCornerThree && is3Pointer) {
            distancePenalty *= 0.6;
        }

        chance = baseChance - distancePenalty;
        if (chance < 20) chance = 20;
        if (chance > 95) chance = 95;

        chance += playerData.heatStreak * 5;

        if (playerData.onFire) {
            chance += 15;
            if (chance > 99) chance = 99;
        }

        var dx = Math.abs(player.x - closestDefender.x);
        var dy = Math.abs(player.y - closestDefender.y);
        var defenseDistance = Math.sqrt(dx * dx + dy * dy);

        if (defenseDistance < 8) {
            var defenderData = closestDefender.playerData;
            var defensePenalty = (8 - defenseDistance) * (2 + (defenderData ? getEffectiveAttribute(defenderData, ATTR_BLOCK) * 0.5 : 2));

            // Reduce penalty if defender is behind or off to the side
            var relX = (closestDefender.x - player.x) * attackDir;
            var relY = Math.abs(closestDefender.y - player.y);
            var directionalFactor;
            if (relX >= 0) {
                directionalFactor = 1; // Defender between shooter and hoop
            } else {
                directionalFactor = Math.max(0.25, 1 + (relX / 6));
            }
            var lateralFactor = Math.max(0.35, 1 - (relY / 10));
            var coverageFactor = Math.max(0.2, Math.min(1, directionalFactor * lateralFactor));
            defensePenalty *= coverageFactor;
            chance -= defensePenalty;
            if (chance < 15) chance = 15;
        }

        made = Math.random() * 100 < chance;

        var shotResult = animateShot(shotStartX, shotStartY, targetX, targetY, made);
        made = shotResult.made;
        blocked = shotResult.blocked;
    }

    if (attemptType === "dunk") {
        is3Pointer = false;
    }

    if (made) {
        // Score!
        var points = is3Pointer ? 3 : 2;
        gameState.score[gameState.currentTeam] += points;
        gameState.consecutivePoints[gameState.currentTeam]++;
        playerData.heatStreak++;
        if (typeof playerData.fireMakeStreak !== "number") playerData.fireMakeStreak = 0;
        playerData.fireMakeStreak++;
        if (stats) {
            stats.points += points;
            stats.fgm++;
            if (is3Pointer) stats.tpm++;
            if (attemptType === "dunk") stats.dunks = (stats.dunks || 0) + 1;
        }
        maybeAwardAssist(player);
        clearPotentialAssist();

        var scoringTeamKey = gameState.currentTeam;
        var inboundTeamKey = (scoringTeamKey === "red") ? "blue" : "red";

        // Refill turbo for entire scoring team on made basket!
        var scoringSprites = scoringTeamKey === "red" ? [redPlayer1, redPlayer2] : [bluePlayer1, bluePlayer2];
        for (var i = 0; i < scoringSprites.length; i++) {
            if (scoringSprites[i] && scoringSprites[i].playerData) {
                scoringSprites[i].playerData.turbo = MAX_TURBO;
            }
        }

        // Announcer callouts
        if (attemptType === "dunk") {
            announceEvent("dunk", {
                playerName: playerData.name,
                player: player,
                team: gameState.currentTeam,
                style: dunkStyle
            });
        } else if (is3Pointer) {
            announceEvent("three_pointer", {
                playerName: playerData.name,
                player: player,
                team: gameState.currentTeam
            });
        } else {
            announceEvent("shot_made", {
                playerName: playerData.name,
                player: player,
                team: gameState.currentTeam
            });
        }

        // Check for ON FIRE
        if (!playerData.onFire && playerData.fireMakeStreak >= 3) {
            setPlayerOnFire(player);
            announceEvent("on_fire", {
                playerName: playerData.name,
                player: player,
                team: gameState.currentTeam
            });
        }

        // Reset other team's streak
        gameState.consecutivePoints[inboundTeamKey] = 0;
        clearTeamOnFire(inboundTeamKey);

        triggerPossessionBeep();
        startScoreFlash(scoringTeamKey, inboundTeamKey);
        drawScore();

        // Set up inbound play after made basket
        mswait(attemptType === "dunk" ? 900 : 800);  // Brief pause to see the score
        setupInbound(scoringTeamKey);
    } else {
        // Miss - reset streak
        gameState.consecutivePoints[gameState.currentTeam] = 0;
        playerData.heatStreak = 0;

        // Brief pause to see the miss
        mswait(200);
        if (attemptType === "dunk") {
            if (blocked) {
                announceEvent("block", {
                    playerName: dunkBlocker && dunkBlocker.playerData ? dunkBlocker.playerData.name : "",
                    player: dunkBlocker,
                    team: dunkBlocker ? getPlayerTeamName(dunkBlocker) : null
                });
            } else {
                announceEvent("shot_missed", {
                    playerName: playerData.name,
                    player: player,
                    team: gameState.currentTeam
                });
            }
        } else if (!blocked) {
            announceEvent("shot_missed", {
                playerName: playerData.name,
                player: player,
                team: gameState.currentTeam
            });
        }
        mswait(200);

        if (!blocked || attemptType !== "dunk") {
            clearPotentialAssist();
        }

        if (attemptType === "dunk" && blocked) {
            if (!gameState.reboundActive) {
                createRebound(targetX, targetY);
            }
        } else {
            // Create rebound opportunity (animated)
            createRebound(targetX, targetY);
        }

        // Let the rebound scramble play out - DON'T immediately switch possession
        // The AI will race for the ball, and we'll resolve who gets it
        resolveReboundScramble();
    }
}

function setupInbound(scoringTeam) {
    // After a made basket, set up inbound play with alternating inbounders
    gameState.reboundActive = false;
    gameState.inbounding = true;

    // The team that got scored ON inbounds the ball
    var inboundTeam = scoringTeam === "red" ? "blue" : "red";
    gameState.currentTeam = inboundTeam;

    if (!gameState.inboundAlternateIndex) {
        gameState.inboundAlternateIndex = { red: 0, blue: 0 };
    }

    var teamSprites = inboundTeam === "red" ? [redPlayer1, redPlayer2] : [bluePlayer1, bluePlayer2];
    var defenderSprites = inboundTeam === "red" ? [bluePlayer1, bluePlayer2] : [redPlayer1, redPlayer2];

    var inboundIndex = gameState.inboundAlternateIndex[inboundTeam];
    if (inboundIndex !== 0 && inboundIndex !== 1) inboundIndex = 0;

    var inbounder = teamSprites[inboundIndex] || teamSprites[0];
    var receiverIndex;
    if (teamSprites.length > 1) {
        receiverIndex = (inbounder === teamSprites[0]) ? 1 : 0;
    } else {
        receiverIndex = 0;
    }
    var receiver = teamSprites[receiverIndex] || inbounder;

    var attackDir = inboundTeam === "red" ? 1 : -1;
    var midX = Math.floor(COURT_WIDTH / 2);
    var inboundHalfOffset = 3;
    var inboundX = clampToCourtX(midX - attackDir * inboundHalfOffset);
    var inboundY = BASKET_LEFT_Y;

    if (inbounder && inbounder.moveTo) inbounder.moveTo(inboundX, inboundY);

    var defendBasketX = inboundTeam === "red" ? BASKET_LEFT_X : BASKET_RIGHT_X;
    var defendBasketY = BASKET_LEFT_Y;
    if (receiver && receiver.moveTo) receiver.moveTo(clampToCourtX(defendBasketX), defendBasketY);

    var defenderBaseX = clampToCourtX(midX + attackDir * 6);
    if (defenderSprites[0] && defenderSprites[0].moveTo) defenderSprites[0].moveTo(defenderBaseX, 7);
    if (defenderSprites[1] && defenderSprites[1].moveTo) defenderSprites[1].moveTo(clampToCourtX(defenderBaseX + attackDir * 4), 11);

    gameState.inboundPasser = inbounder;
    gameState.ballCarrier = inbounder;
    if (inbounder && inbounder.playerData) inbounder.playerData.hasDribble = true;

    resetBackcourtState();
    gameState.ballHandlerStuckTimer = 0;
    gameState.ballHandlerAdvanceTimer = 0;
    if (inbounder) {
        gameState.ballHandlerLastX = inbounder.x;
        gameState.ballHandlerLastY = inbounder.y;
        gameState.ballHandlerFrontcourtStartX = inbounder.x;
        gameState.ballHandlerProgressOwner = inbounder;
    }

    // Toggle inbounder for next possession
    if (teamSprites.length > 1) {
        gameState.inboundAlternateIndex[inboundTeam] = (inbounder === teamSprites[0]) ? 1 : 0;
    } else {
        gameState.inboundAlternateIndex[inboundTeam] = 0;
    }

    // Auto-pass after a brief delay (simulate inbound)
    mswait(300);

    var inboundPasserSprite = gameState.inboundPasser;
    var receiverSprite = receiver;

    if (inboundPasserSprite && receiverSprite && inboundPasserSprite !== receiverSprite) {
        animatePass(inboundPasserSprite, receiverSprite);
    }

    // Inbounder steps onto the court after the pass
    var inbounderPostX = clampToCourtX(midX - attackDir * 6);
    if (inbounder && inbounder.moveTo) inbounder.moveTo(inbounderPostX, inboundY);

    // Make sure possession is set to the receiver after inbound
    if (!gameState.ballCarrier || gameState.ballCarrier === inboundPasserSprite) {
        gameState.ballCarrier = receiverSprite;
    }

    if (inbounder && inbounder.playerData) inbounder.playerData.hasDribble = true;
    if (gameState.ballCarrier && gameState.ballCarrier.playerData) gameState.ballCarrier.playerData.hasDribble = true;

    var teammateAfterInbound = inbounder;
    primeInboundOffense(gameState.ballCarrier, teammateAfterInbound, inboundTeam);

    // Reset ball-handler tracking so the AI doesn't think it's stuck
    gameState.ballHandlerStuckTimer = 0;
    gameState.ballHandlerAdvanceTimer = 0;
    if (gameState.ballCarrier) {
        gameState.ballHandlerLastX = gameState.ballCarrier.x;
        gameState.ballHandlerLastY = gameState.ballCarrier.y;
        gameState.ballHandlerFrontcourtStartX = gameState.ballCarrier.x;
        gameState.ballHandlerProgressOwner = gameState.ballCarrier;
    }

    // Clear inbound state
    gameState.inbounding = false;
    gameState.inboundPasser = null;
    gameState.shotClock = 24; // Reset shot clock after inbound

    enableScoreFlashRegainCheck(inboundTeam);

    // Assign defensive matchups after inbound
    assignDefensiveMatchups();

    announceEvent("inbounds", {
        team: inboundTeam
    });
}

function assignDefensiveMatchups() {
    // Assign man-to-man defensive matchups based on proximity
    gameState.defensiveAssignments = {};
    resetAllDefenseMomentum();

    if (gameState.currentTeam === "red") {
        // Red has ball, blue defends
        // Assign blue defenders to red offensive players
        var dist1to1 = Math.sqrt(Math.pow(bluePlayer1.x - redPlayer1.x, 2) + Math.pow(bluePlayer1.y - redPlayer1.y, 2));
        var dist1to2 = Math.sqrt(Math.pow(bluePlayer1.x - redPlayer2.x, 2) + Math.pow(bluePlayer1.y - redPlayer2.y, 2));

        if (dist1to1 < dist1to2) {
            // Blue1 guards Red1, Blue2 guards Red2
            gameState.defensiveAssignments.bluePlayer1 = redPlayer1;
            gameState.defensiveAssignments.bluePlayer2 = redPlayer2;
        } else {
            // Blue1 guards Red2, Blue2 guards Red1
            gameState.defensiveAssignments.bluePlayer1 = redPlayer2;
            gameState.defensiveAssignments.bluePlayer2 = redPlayer1;
        }
    } else {
        // Blue has ball, red defends
        // Assign red defenders to blue offensive players
        var dist1to1 = Math.sqrt(Math.pow(redPlayer1.x - bluePlayer1.x, 2) + Math.pow(redPlayer1.y - bluePlayer1.y, 2));
        var dist1to2 = Math.sqrt(Math.pow(redPlayer1.x - bluePlayer2.x, 2) + Math.pow(redPlayer1.y - bluePlayer2.y, 2));

        if (dist1to1 < dist1to2) {
            // Red1 guards Blue1, Red2 guards Blue2
            gameState.defensiveAssignments.redPlayer1 = bluePlayer1;
            gameState.defensiveAssignments.redPlayer2 = bluePlayer2;
        } else {
            // Red1 guards Blue2, Red2 guards Blue1
            gameState.defensiveAssignments.redPlayer1 = bluePlayer2;
            gameState.defensiveAssignments.redPlayer2 = bluePlayer1;
        }
    }
}

function switchPossession() {
    // Clear rebound state when possession changes
    gameState.reboundActive = false;
    gameState.shotClock = 24; // Reset shot clock on possession change
    resetBackcourtState();
    gameState.ballHandlerStuckTimer = 0;
    gameState.ballHandlerAdvanceTimer = 0;
    clearPotentialAssist();
    resetDeadDribbleTimer();

    if (gameState.currentTeam === "red") {
        gameState.currentTeam = "blue";
        gameState.ballCarrier = bluePlayer1;
        bluePlayer1.moveTo(58, 9);
        bluePlayer2.moveTo(58, 12);
        primeInboundOffense(gameState.ballCarrier, bluePlayer2, "blue");
    } else {
        gameState.currentTeam = "red";
        gameState.ballCarrier = redPlayer1;
        redPlayer1.moveTo(18, 9);
        redPlayer2.moveTo(18, 12);
        primeInboundOffense(gameState.ballCarrier, redPlayer2, "red");
    }

    triggerPossessionBeep();

    if (gameState.ballCarrier) {
        gameState.ballHandlerLastX = gameState.ballCarrier.x;
        gameState.ballHandlerLastY = gameState.ballCarrier.y;
        gameState.ballHandlerFrontcourtStartX = gameState.ballCarrier.x;
        gameState.ballHandlerProgressOwner = gameState.ballCarrier;
        if (gameState.ballCarrier.playerData) gameState.ballCarrier.playerData.hasDribble = true;
    }

    // Assign defensive matchups
    assignDefensiveMatchups();
}

function positionSpritesForBoxScore() {
    var marginX = 2;
    var spriteWidth = 5;
    var leftX = clampToCourtX(marginX);
    var rightX = clampToCourtX(COURT_WIDTH - spriteWidth - marginX);
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
    { key: "turnovers", label: "TO", skipLeader: true }
];

function collectGlobalStatLeaders() {
    var leaders = {};
    var allPlayers = getAllPlayers();
    for (var c = 0; c < BOX_SCORE_COLUMNS.length; c++) {
        var column = BOX_SCORE_COLUMNS[c];
        if (column.isRaw || column.skipLeader) continue;
        var key = column.key;
        var maxValue = -Infinity;
        for (var i = 0; i < allPlayers.length; i++) {
            var player = allPlayers[i];
            if (!player || !player.playerData || !player.playerData.stats) continue;
            var stats = player.playerData.stats;
            var value = stats[key] || 0;
            if (value > maxValue) {
                maxValue = value;
            }
        }
        leaders[key] = { max: maxValue };
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
            if (!column.isRaw && !column.skipLeader) {
                var leaderInfo = leaders[key];
                if (leaderInfo && rawValue > 0 && rawValue === leaderInfo.max) {
                    attrCode = "\1h\1g";
                }
            }

            line += attrCode + valueStr;
        }
        line += "\1n";
        courtFrame.center(line + "\r\n");
    }
}

function startSecondHalfInbound() {
    if (gameState.secondHalfInitDone) return;
    var startTeam = gameState.firstHalfStartTeam || "red";
    var inboundTeam = startTeam === "red" ? "blue" : "red";
    var scoringTeam = inboundTeam === "red" ? "blue" : "red";
    setupInbound(scoringTeam);
    gameState.secondHalfInitDone = true;
    gameState.pendingSecondHalfInbound = false;
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

    courtFrame.center("\1h\1g1\1n. Play Game\r\n");
    courtFrame.center("\1h\1c2\1n. Watch CPU Demo\r\n");
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

    // STEP 1: Select YOUR team
    var currentSelection = 0;
    var userTeamKey = null;

    while (userTeamKey === null) {
        console.clear();
        console.putmsg("\1h\1y=== NBA JAM - TEAM SELECTION ===\1n\r\n\r\n");
        console.putmsg("\1h\1rYOUR TEAM\1n - Select your team:\r\n\r\n");

        // Display team list
        for (var i = 0; i < teamList.length; i++) {
            var team = NBATeams[teamList[i].key];
            var colorSequence = getMenuColorCodes(team, i === currentSelection);
            var prefix = (i === currentSelection) ? "> " : "  ";
            console.putmsg(colorSequence + prefix + teamList[i].name + "\1n\r\n");
        }

        console.putmsg("\r\n\1h[UP/DOWN]\1n Navigate  \1h[ENTER]\1n Select  \1h[Q]\1n Quit\r\n");

        var key = console.getkey();

        if (key.toUpperCase() === 'Q') {
            return null;
        } else if (key === KEY_UP && currentSelection > 0) {
            currentSelection--;
        } else if (key === KEY_DOWN && currentSelection < teamList.length - 1) {
            currentSelection++;
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
        console.clear();
        console.putmsg("\1h\1y=== NBA JAM - TEAM SELECTION ===\1n\r\n\r\n");
        console.putmsg("\1h\1cOPPONENT TEAM\1n - Select opponent:\r\n\r\n");

        // Display team list
        for (var i = 0; i < teamList.length; i++) {
            var team = NBATeams[teamList[i].key];
            var colorSequence = getMenuColorCodes(team, i === currentSelection);
            var prefix = (i === currentSelection) ? "> " : "  ";
            console.putmsg(colorSequence + prefix + teamList[i].name + "\1n\r\n");
        }

        console.putmsg("\r\n\1h[UP/DOWN]\1n Navigate  \1h[ENTER]\1n Select  \1h[Q]\1n Quit\r\n");

        var key = console.getkey();

        if (key.toUpperCase() === 'Q') {
            return null;
        } else if (key === KEY_UP && currentSelection > 0) {
            currentSelection--;
        } else if (key === KEY_DOWN && currentSelection < teamList.length - 1) {
            currentSelection++;
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

        showMatchupScreen();

        // Display "DEMO MODE" message
        announce("DEMO MODE - Press Q to exit", YELLOW);
        mswait(1500);

        // Run the game loop (all AI controlled)
        gameLoop();

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

function showMatchupScreen() {
    if (typeof console === "undefined" || typeof Sprite === "undefined") return;
    if (!bluePlayer1 || !bluePlayer2 || !redPlayer1 || !redPlayer2) return;

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

    var leftTeamKey = "blue";
    var rightTeamKey = "red";
    var leftTeamName = (gameState.teamNames && gameState.teamNames.blue) ? gameState.teamNames.blue : "BLUE";
    var rightTeamName = (gameState.teamNames && gameState.teamNames.red) ? gameState.teamNames.red : "RED";

    var leftPlayers = [bluePlayer1 && bluePlayer1.playerData || null, bluePlayer2 && bluePlayer2.playerData || null];
    var rightPlayers = [redPlayer1 && redPlayer1.playerData || null, redPlayer2 && redPlayer2.playerData || null];

    var leftSprites = [bluePlayer1 || null, bluePlayer2 || null];
    var rightSprites = [redPlayer1 || null, redPlayer2 || null];

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
        { sprite: bluePlayer1, originalBearing: bluePlayer1 ? bluePlayer1.bearing : null, teamKey: leftTeamKey },
        { sprite: bluePlayer2, originalBearing: bluePlayer2 ? bluePlayer2.bearing : null, teamKey: leftTeamKey },
        { sprite: redPlayer1, originalBearing: redPlayer1 ? redPlayer1.bearing : null, teamKey: rightTeamKey },
        { sprite: redPlayer2, originalBearing: redPlayer2 ? redPlayer2.bearing : null, teamKey: rightTeamKey }
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
