/**
 * Court Rendering Module
 * 
 * Handles visual rendering of the basketball court including:
 * - Court borders and baselines
 * - Center line and circle
 * - 3-point arcs
 * - Free throw lines
 * - Basketball hoops (backboards, rims, nets)
 * - Team names on baselines
 */

// Load debug logger for troubleshooting
load(js.exec_dir + "lib/utils/debug-logger.js");

load("sbbsdefs.js");

/**
 * Draw team names vertically on left and right baselines
 * LEFT (X=1) = Blue team baseline
 * RIGHT (X=COURT_WIDTH) = Red team baseline
 * @param {Object} systems - Systems object for state management
 */
function drawBaselineTeamNames(systems) {
    var stateManager = systems.stateManager;
    // Draw team names vertically on left and right baselines
    var teamNames = stateManager.get('teamNames');
    var teamBTeamName = teamNames.teamB || "TEAM B";
    var teamATeamName = teamNames.teamA || "TEAM A";

    var baselineTop = GAMEPLAY_CONSTANTS.COURT.BASELINE_TOP;
    var baselineBottom = COURT_HEIGHT - GAMEPLAY_CONSTANTS.COURT.BASELINE_BOTTOM_OFFSET;
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

    var teamBBaseline = getTeamBaselineColors("teamB", systems);
    var teamABaseline = getTeamBaselineColors("teamA", systems);

    // Left baseline (teamB) - vertical text at X=1
    paintBaselineColumn(1, teamBBaseline.bg);
    paintTeamNameVertically(1, teamBTeamName, teamBBaseline.fg, teamBBaseline.bg);

    // Right baseline (teamA) - vertical text at X=COURT_WIDTH
    paintBaselineColumn(COURT_WIDTH, teamABaseline.bg);
    paintTeamNameVertically(COURT_WIDTH, teamATeamName, teamABaseline.fg, teamABaseline.bg);
}

/**
 * Draw the complete basketball court with all markings
 * 
 * Layout:
 * - Brown wood background
 * - White border (sidelines and baselines)
 * - Center court divider (two-column half blocks for even split)
 * - Center circle with "NBA" text
 * - 3-point arcs around each basket (using CP437 middle dot character 250)
 * - Free throw lines
 * - Basketball hoops with backboards, rims, nets
 * - Team names vertically on baselines
 * - Ball positioning relative to carrier
 * - Sprite depth sorting (painter's algorithm)
 * - Jersey numbers above players
 */
function drawCourt(systems) {
    // Guard: Verify courtFrame exists and is open
    if (!courtFrame || !courtFrame.is_open) {
        if (typeof debugLog === "function") {
            debugLog("[drawCourt] ERROR: courtFrame not initialized (exists: " + !!courtFrame + ", open: " + (courtFrame ? courtFrame.is_open : "N/A") + ")");
        }
        return;
    }

    if (typeof debugLog === "function") {
        debugLog("[drawCourt] EXECUTING: Drawing court background and markings");
    }

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

    // NOTE: Hoops (backboard/rim/net) and basket flash now drawn to dedicated hoop frames
    // See drawHoops() function - called separately from rendering loop

    // Draw team names vertically on baselines
    drawBaselineTeamNames(systems);

    // WAVE 24 FLICKER FIX: Per user insight, this is incorrect. The court should always be the bottom-most frame.
    // Sprites are layered on top of it. Calling .top() here is a likely cause of flicker.
    // if (courtFrame.top) {
    //     courtFrame.top();
    // }

    // WAVE 24 FLICKER FIX: Do NOT cycle the frame here.
    // Let the main game loop perform a single, final cycle of all sprites.
    // cycleFrame(courtFrame);

    if (typeof debugLog === "function") {
        debugLog("[drawCourt] COMPLETE: Court background drawn and frame prepared");
    }
}

/**
 * Update sprite rendering and z-ordering (called every frame)
 * Wave 23D: Separated from drawCourt() so sprites update even when court doesn't redraw
 * @param {Object} systems - Systems object for state management
 */
function updateSpriteRendering(systems) {
    var stateManager = systems.stateManager;

    // Update ball position beside player based on bearing
    var ballCarrier = stateManager.get('ballCarrier');
    if (ballCarrier && ballFrame) {
        updateBallPosition(systems);
    }

    // WAVE 24 FLICKER FIX: Removed redundant cycle calls.
    // The main game loop now handles the single, final render cycle.
    // This function is now only for positioning and z-ordering.
    // Sprite.cycle();
    // if (courtFrame && typeof cycleFrame === "function") {
    //     cycleFrame(courtFrame);
    // }

    // NOTE: Basket flash now drawn to dedicated hoop frames via drawHoops()

    // Apply painter's algorithm - order sprites by Y position (depth sorting)
    // This prevents defensive sprites from occluding the ball carrier or other players
    var allPlayers = getAllPlayers();
    var validPlayers = [];
    for (var i = 0; i < allPlayers.length; i++) {
        if (allPlayers[i] && allPlayers[i].frame) {
            validPlayers.push(allPlayers[i]);
        }
    }
    // Sort by Y position (lower Y = further back = drawn first)
    validPlayers.sort(function (a, b) { return a.y - b.y; });
    // Bring each sprite to top in order
    for (var i = 0; i < validPlayers.length; i++) {
        validPlayers[i].frame.top();
    }

    // Draw jersey numbers above players
    drawJerseyNumbers(systems);

    // Make sure ball frame is visible and on top
    if (ballFrame && ballFrame.is_open) {
        ballFrame.top();
    }

    // Ensure ball carrier sprite renders on top of all players
    var ballCarrier = stateManager.get('ballCarrier');
    if (ballCarrier && ballCarrier.frame && typeof ballCarrier.frame.top === "function") {
        ballCarrier.frame.top();
    }
}

/**
 * Draw jersey numbers above all players
 * Ensures ball carrier label renders on top
 * @param {Object} systems - Systems object for state management
 */
function drawJerseyNumbers(systems) {
    var players = getAllPlayers();
    var carrierFrame = null;

    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        var info = renderPlayerLabel(player, { highlightCarrier: true, forceTop: true }, systems);
        if (!info || !info.frame || !info.visible) {
            continue;
        }

        if (info.isCarrier) {
            carrierFrame = info.frame;
        }
    }

    if (carrierFrame && typeof carrierFrame.top === "function") {
        carrierFrame.top();
    }
}

/**
 * Update ball position relative to the ball carrier
 * 
 * Ball positioning rules:
 * - Ball offset determined by player bearing (direction facing)
 * - Dribbling: bouncing animation with period = 12 frames
 * - Dead dribble: ball held high, pulsing O/o effect
 * - Rebound active: ball shows at rebound position
 * - Ball clamped to court boundaries
 * @param {Object} systems - Systems object for state management
 */
function updateBallPosition(systems) {
    var stateManager = systems.stateManager;
    if (typeof animationSystem !== "undefined" && animationSystem && typeof animationSystem.isBallAnimating === "function" && animationSystem.isBallAnimating()) {
        return;
    }

    // If rebound is active, show ball at rebound position
    var reboundActive = stateManager.get('reboundActive');
    if (reboundActive) {
        if (ballFrame && moveBallFrameTo) {
            var reboundX = stateManager.get('reboundX');
            var reboundY = stateManager.get('reboundY');
            moveBallFrameTo(reboundX, reboundY);
        }
        return;
    }

    var player = stateManager.get('ballCarrier');
    if (!player || !player.x || !player.y) {
        // If no valid ball carrier, clear rebound state
        stateManager.set('reboundActive', false, 'clear_rebound_no_carrier');
        return;
    }

    var playerBounds = (typeof PLAYER_BOUNDARIES === "object" && PLAYER_BOUNDARIES) ? PLAYER_BOUNDARIES : null;
    var movementMaxXOffset = (playerBounds && typeof playerBounds.movementMaxXOffset === "number") ? playerBounds.movementMaxXOffset : 7;
    var ballEdgeClamp = (playerBounds && typeof playerBounds.feetMaxXOffset === "number") ? playerBounds.feetMaxXOffset : 2;

    var currentTeam = stateManager.get('currentTeam');
    var targetBasket = currentTeam === "teamA" ? BASKET_RIGHT_X : BASKET_LEFT_X;    // Get player's bearing or default towards their basket
    var bearing = player.bearing || (currentTeam === "teamA" ? "e" : "w");

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

    if (player.x >= COURT_WIDTH - movementMaxXOffset && ballOffsetX > 0) {
        ballOffsetX = Math.max(ballOffsetX - 3, 1);
    }

    if (hasDribble) {
        var period = 12;
        var tickCounter = stateManager.get('tickCounter');
        var phase = (tickCounter % period) / period;
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
        var tickCounter = stateManager.get('tickCounter');
        var holdPhase = (tickCounter % 16) < 8;
        ballChar = holdPhase ? "O" : "o";
        ballAttr = holdPhase ? (LIGHTRED | WAS_BROWN) : (YELLOW | WAS_BROWN);
    }

    var desiredBallX = player.x + ballOffsetX;
    var maxBallX = COURT_WIDTH - ballEdgeClamp;
    if (desiredBallX > maxBallX) {
        desiredBallX = maxBallX;
    }
    var ballX = clamp(desiredBallX, 1, COURT_WIDTH);
    var ballY = clamp(player.y + ballOffsetY + 2, 1, COURT_HEIGHT);
    stateManager.set('ballX', ballX, 'ball_position');
    stateManager.set('ballY', ballY, 'ball_position');

    if (ballFrame && moveBallFrameTo) {
        moveBallFrameTo(ballX, ballY);
        if (ballFrame.putmsg) {
            ballFrame.putmsg(ballChar, ballAttr);
        }
    }
}

/**
 * Draw hoops (backboard + rim + net) to dedicated hoop frames
 * Also handles basket flash animations on hoop frames
 * @param {Object} systems - Systems object with stateManager
 */
function drawHoops(systems) {
    var stateManager = systems ? systems.stateManager : null;
    if (!stateManager) return;

    // Check for basket flash state
    var basketFlash = stateManager.get('basketFlash');
    var flashActive = basketFlash && basketFlash.active;

    // Draw left hoop (opens to right) - Frame coordinates are 1-based
    if (leftHoopFrame && leftHoopFrame.is_open) {
        leftHoopFrame.clear();

        // Backboard (3 chars tall, x=1 in frame coords)
        var nba = ["N", "B", "A"];
        for (var i = 0; i < 3; i++) {
            leftHoopFrame.gotoxy(1, i + 1);
            leftHoopFrame.putmsg(nba[i], BLUE | BG_LIGHTGRAY);
        }

        // Rim (x=2-4, y=2 in frame coords - middle row)
        leftHoopFrame.gotoxy(2, 2);
        leftHoopFrame.putmsg(ascii(201), RED | BG_BLACK);  // ╔
        leftHoopFrame.gotoxy(3, 2);
        leftHoopFrame.putmsg(ascii(205), RED | BG_BLACK);  // ═
        leftHoopFrame.gotoxy(4, 2);
        leftHoopFrame.putmsg(ascii(187), RED | BG_BLACK);  // ╗

        // Net (y=3 in frame coords - bottom row)
        leftHoopFrame.gotoxy(2, 3);
        leftHoopFrame.putmsg("\\", WHITE | BG_BLACK);
        leftHoopFrame.gotoxy(3, 3);
        leftHoopFrame.putmsg("W", WHITE | BG_BLACK);
        leftHoopFrame.gotoxy(4, 3);
        leftHoopFrame.putmsg("/", WHITE | BG_BLACK);

        // Basket flash (if active and this is the left basket)
        if (flashActive && basketFlash.x === BASKET_LEFT_X) {
            leftHoopFrame.gotoxy(2, 2);
            leftHoopFrame.putmsg("*", YELLOW | BG_BLACK);
            leftHoopFrame.gotoxy(4, 2);
            leftHoopFrame.putmsg("*", YELLOW | BG_BLACK);
        }

        // Clear empty positions for true transparency (after drawing)
        // Row 1: Clear everything except backboard at (1,1)
        leftHoopFrame.clearData(5, 1);
        leftHoopFrame.clearData(5, 2);
        leftHoopFrame.clearData(5, 3);
        leftHoopFrame.clearData(2, 0);
        leftHoopFrame.cycle();
    }

    // Draw right hoop (opens to left) - Frame coordinates are 1-based
    if (rightHoopFrame && rightHoopFrame.is_open) {
        rightHoopFrame.clear();

        // Backboard (3 chars tall, x=5 in frame coords)
        for (var i = 0; i < 3; i++) {
            rightHoopFrame.gotoxy(5, i + 1);
            rightHoopFrame.putmsg(nba[i], RED | BG_LIGHTGRAY);
        }

        // Rim (x=2-4, y=2 in frame coords - middle row)
        rightHoopFrame.gotoxy(2, 2);
        rightHoopFrame.putmsg(ascii(201), RED | BG_BLACK);  // ╔
        rightHoopFrame.gotoxy(3, 2);
        rightHoopFrame.putmsg(ascii(205), RED | BG_BLACK);  // ═
        rightHoopFrame.gotoxy(4, 2);
        rightHoopFrame.putmsg(ascii(187), RED | BG_BLACK);  // ╗

        // Net (y=3 in frame coords - bottom row)
        rightHoopFrame.gotoxy(2, 3);
        rightHoopFrame.putmsg("\\", WHITE | BG_BLACK);
        rightHoopFrame.gotoxy(3, 3);
        rightHoopFrame.putmsg("W", WHITE | BG_BLACK);
        rightHoopFrame.gotoxy(4, 3);
        rightHoopFrame.putmsg("/", WHITE | BG_BLACK);

        // Basket flash (if active and this is the right basket)
        if (flashActive && basketFlash.x === BASKET_RIGHT_X) {
            rightHoopFrame.gotoxy(2, 2);
            rightHoopFrame.putmsg("*", YELLOW | BG_BLACK);
            rightHoopFrame.gotoxy(4, 2);
            rightHoopFrame.putmsg("*", YELLOW | BG_BLACK);
        }

        // Clear empty positions for true transparency (after drawing)
        // Row 1: Clear everything except backboard at (5,1)
        rightHoopFrame.clearData(0, 1);
        rightHoopFrame.clearData(0, 2);
        rightHoopFrame.clearData(0, 3);
        rightHoopFrame.clearData(2, 0);
        rightHoopFrame.cycle();

    }
}
