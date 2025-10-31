// NBA JAM - Terminal Basketball Arcade Game
// A Synchronet BBS door game using sprite.js

load("sbbsdefs.js");
load("frame.js");
load("sprite.js");

// Add drawBorder method to Frame prototype
Frame.prototype.drawBorder = function (color) {
    var theColor = color;
    if (Array.isArray(color)) {
        var sectionLength = Math.round(this.width / color.length);
    }
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
            if (Array.isArray(color)) {
                if (x == 1)
                    theColor = color[0];
                else if (sectionLength > 0 && x % sectionLength == 0 && x < this.width)
                    theColor = color[x / sectionLength];
                else if (x == this.width)
                    theColor = color[color.length - 1];
            }
            this.putmsg(msg, theColor);
        }
    }
    this.popxy();
}

// Game constants
var COURT_WIDTH = 78;
var COURT_HEIGHT = 18;
var BASKET_LEFT_X = 3;
var BASKET_LEFT_Y = 9;
var BASKET_RIGHT_X = 74;
var BASKET_RIGHT_Y = 9;

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
var TURBO_ACTIVATION_THRESHOLD = 200; // ms between same key presses

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
var gameState = {
    gameRunning: false,
    ballCarrier: null,  // Who has the ball
    score: { red: 0, blue: 0 },
    consecutivePoints: { red: 0, blue: 0 },
    onFire: { red: false, blue: false },
    timeRemaining: 180,
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
    teamColors: {
        red: { fg: WHITE, bg: BG_BLACK, fg_accent: WHITE, bg_alt: BG_BLACK },
        blue: { fg: WHITE, bg: BG_BLACK, fg_accent: WHITE, bg_alt: BG_BLACK }
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
    backcourtTimer: 0,
    frontcourtEstablished: false,
    debugOverlay: {
        enabled: true,
        last: {}
    },
    // Defensive assignments (man-to-man)
    defensiveAssignments: {
        // Maps defender to offensive player they're guarding
        // Will be set during switchPossession/setupInbound
    },
    // Block tracking
    activeBlock: null,  // Player currently attempting a block
    blockJumpTimer: 0,  // Frames remaining in jump animation
    shotInProgress: false,  // True during shot animation
    shotStartX: 0,
    shotStartY: 0
};

// Frames
var courtFrame;
var scoreFrame;
var ballFrame;

// Player sprites (2v2)
var redPlayer1;   // Human controlled
var redPlayer2;   // AI teammate
var bluePlayer1;  // AI opponent
var bluePlayer2;  // AI opponent

// Player class to hold attributes and state
function Player(name, jersey, attributes, sprite) {
    this.name = name;
    this.jersey = jersey;
    this.attributes = attributes; // [speed, 3pt, dunk, power, steal, block]
    this.sprite = sprite;
    this.turbo = MAX_TURBO;
    this.turboActive = false;
    this.heatStreak = 0; // For shooting momentum
    this.lastTurboUseTime = 0;
    this.inboundBoostTimer = 0;
    this.lastTurboX = null;
    this.lastTurboY = null;

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
    var baseSpeed = this.attributes[ATTR_SPEED] / 10.0;
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
        var line = file.readln().trim();

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
                    roster.push({
                        name: player.player_name || "Unknown",
                        jersey: parseInt(player.player_number) || 0,
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

        // Create different archetypes
        switch (archetype) {
            case 0: // Sharpshooter
                attributes = [8, 9, 4, 3, 7, 4];
                playerName = "Guard";
                break;
            case 1: // High-Flyer
                attributes = [8, 6, 10, 6, 6, 5];
                playerName = "Forward";
                break;
            case 2: // Enforcer/Big Man
                attributes = [4, 2, 9, 10, 3, 9];
                playerName = "Center";
                break;
            case 3: // Playmaker
                attributes = [9, 7, 7, 5, 8, 5];
                playerName = "Point Guard";
                break;
            default:
                attributes = [6, 6, 6, 6, 6, 6];
                playerName = "Player";
        }

        roster.push({
            name: playerName + " " + (i + 1),
            jersey: Math.floor(Math.random() * 99) + 1,
            attributes: attributes
        });
    }

    return {
        name: teamName,
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
        "BG_BLACK": BG_BLACK,
        "BG_RED": BG_RED,
        "BG_GREEN": BG_GREEN,
        "BG_BROWN": BG_BROWN,
        "BG_BLUE": BG_BLUE,
        "BG_MAGENTA": BG_MAGENTA,
        "BG_CYAN": BG_CYAN,
        "BG_LIGHTGRAY": BG_LIGHTGRAY
    };

    return colorMap[colorStr] || WHITE;
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

// Announcer system
function announce(text, color) {
    gameState.announcer.text = text;
    gameState.announcer.color = color || WHITE;
    gameState.announcer.timer = 90; // Show for ~3 seconds at 30fps
}

function updateAnnouncer() {
    if (gameState.announcer.timer > 0) {
        gameState.announcer.timer--;
        if (gameState.announcer.timer == 0) {
            gameState.announcer.text = "";
        }
    }
}

function getAnnouncerText() {
    return gameState.announcer.text;
}

function getAnnouncerColor() {
    return gameState.announcer.color;
}

function drawCourt() {
    // Draw court background (brown wood)
    courtFrame.clear();

    // Draw court lines (white on brown)
    // Sidelines
    for (var y = 1; y <= COURT_HEIGHT; y++) {
        courtFrame.gotoxy(1, y);
        courtFrame.putmsg(ascii(179), WHITE | BG_BROWN);
        courtFrame.gotoxy(COURT_WIDTH, y);
        courtFrame.putmsg(ascii(179), WHITE | BG_BROWN);
    }

    // Baselines
    for (var x = 1; x <= COURT_WIDTH; x++) {
        courtFrame.gotoxy(x, 1);
        courtFrame.putmsg(ascii(196), WHITE | BG_BROWN);
        courtFrame.gotoxy(x, COURT_HEIGHT);
        courtFrame.putmsg(ascii(196), WHITE | BG_BROWN);
    }

    // Center court line
    var centerX = Math.floor(COURT_WIDTH / 2);
    for (var y = 2; y < COURT_HEIGHT; y++) {
        courtFrame.gotoxy(centerX, y);
        courtFrame.putmsg(ascii(179), WHITE | BG_BROWN);
    }

    // Center circle
    var centerY = Math.floor(COURT_HEIGHT / 2);
    courtFrame.gotoxy(centerX - 3, centerY);
    courtFrame.putmsg("(   )", WHITE | BG_BROWN);

    // 3-point arcs (semicircle around each basket)
    var radius = 11; // 3-point arc radius

    // Left basket 3-point arc (using CP437 middle dot character 250)
    for (var angle = -90; angle <= 90; angle += 8) {
        var rad = angle * Math.PI / 180;
        var x = Math.round(BASKET_LEFT_X + radius * Math.cos(rad));
        var y = Math.round(BASKET_LEFT_Y + radius * Math.sin(rad));
        if (x > 1 && x < COURT_WIDTH && y > 1 && y < COURT_HEIGHT) {
            courtFrame.gotoxy(x, y);
            courtFrame.putmsg(ascii(250), WHITE | BG_BROWN);
        }
    }

    // Right basket 3-point arc (using CP437 middle dot character 250)
    for (var angle = 90; angle <= 270; angle += 8) {
        var rad = angle * Math.PI / 180;
        var x = Math.round(BASKET_RIGHT_X + radius * Math.cos(rad));
        var y = Math.round(BASKET_RIGHT_Y + radius * Math.sin(rad));
        if (x > 1 && x < COURT_WIDTH && y > 1 && y < COURT_HEIGHT) {
            courtFrame.gotoxy(x, y);
            courtFrame.putmsg(ascii(250), WHITE | BG_BROWN);
        }
    }

    // Free throw lines
    var ftLineX_left = BASKET_LEFT_X + 8;
    var ftLineX_right = BASKET_RIGHT_X - 8;
    for (var y = 6; y <= 12; y++) {
        courtFrame.gotoxy(ftLineX_left, y);
        courtFrame.putmsg("-", LIGHTGRAY | BG_BROWN);
        courtFrame.gotoxy(ftLineX_right, y);
        courtFrame.putmsg("-", LIGHTGRAY | BG_BROWN);
    }

    // Draw hoops (backboard + rim)
    // Left hoop
    courtFrame.gotoxy(BASKET_LEFT_X, BASKET_LEFT_Y - 1);
    courtFrame.putmsg("|", RED | BG_BROWN);
    courtFrame.gotoxy(BASKET_LEFT_X, BASKET_LEFT_Y);
    courtFrame.putmsg(ascii(200), RED | BG_BROWN);  // Bottom-left corner

    // Right hoop
    courtFrame.gotoxy(BASKET_RIGHT_X, BASKET_RIGHT_Y - 1);
    courtFrame.putmsg("|", RED | BG_BROWN);
    courtFrame.gotoxy(BASKET_RIGHT_X, BASKET_RIGHT_Y);
    courtFrame.putmsg(ascii(188), RED | BG_BROWN);  // Bottom-right corner

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

    drawDebugOverlay();
    courtFrame.cycle();
}

function drawJerseyNumbers() {
    var players = getAllPlayers();
    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        if (player && player.playerData && player.x && player.y) {
            var jersey = String(player.playerData.jersey);
            var xPos = Math.floor(player.x + 2 - (jersey.length / 2)); // Center above sprite
            var yPos = player.y - 1; // One row above sprite

            // Clamp to court boundaries
            if (yPos > 0 && xPos > 0 && xPos < COURT_WIDTH) {
                courtFrame.gotoxy(xPos, yPos);
                // Use team colors from game state (indices 0-1 are red, 2-3 are blue)
                var color = (i < 2) ? gameState.teamColors.red.fg : gameState.teamColors.blue.fg;
                courtFrame.putmsg(jersey, color | BG_BROWN);
            }
        }
    }
}

function updateBallPosition() {
    // If rebound is active, show ball at rebound position
    if (gameState.reboundActive) {
        if (ballFrame && ballFrame.moveTo) {
            ballFrame.moveTo(gameState.reboundX, gameState.reboundY);
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

    if (bearing.indexOf('e') >= 0) ballOffsetX = 5;
    if (bearing.indexOf('w') >= 0) ballOffsetX = -1;
    if (bearing.indexOf('n') >= 0) ballOffsetY = -1;
    if (bearing.indexOf('s') >= 0) ballOffsetY = 4;

    // Default to basket direction if no horizontal component
    if (ballOffsetX === 0) {
        ballOffsetX = (player.x < targetBasket) ? 5 : -1;
    }

    gameState.ballX = player.x + ballOffsetX;
    gameState.ballY = player.y + ballOffsetY + 2;

    if (ballFrame && ballFrame.moveTo) {
        ballFrame.moveTo(gameState.ballX, gameState.ballY);
    }
}

function drawScore() {
    scoreFrame.clear();

    // Use team colors from game state (ON FIRE overrides with yellow)
    var redColor = gameState.onFire.red ? YELLOW : gameState.teamColors.red.fg;
    var blueColor = gameState.onFire.blue ? YELLOW : gameState.teamColors.blue.fg;

    // Blue team score (LEFT side - they attack left basket)
    scoreFrame.gotoxy(2, 1);
    scoreFrame.putmsg(gameState.teamNames.blue.toUpperCase() + ": ", gameState.teamColors.blue.fg | gameState.teamColors.blue.bg);
    scoreFrame.putmsg(padStart(gameState.score.blue, 3, ' '), blueColor | gameState.teamColors.blue.bg);
    if (gameState.onFire.blue) {
        scoreFrame.putmsg(" ON FIRE!", YELLOW | gameState.teamColors.blue.bg);
    }

    // Timer (center)
    var mins = Math.floor(gameState.timeRemaining / 60);
    var secs = gameState.timeRemaining % 60;
    scoreFrame.gotoxy(32, 1);
    scoreFrame.putmsg("TIME: " + String(mins) + ":" + padStart(secs, 2, '0'), LIGHTGREEN | BG_BLACK);

    // Shot clock (below timer)
    var shotClockColor = gameState.shotClock <= 5 ? LIGHTRED : WHITE;
    scoreFrame.gotoxy(34, 2);
    scoreFrame.putmsg("SHOT: " + padStart(gameState.shotClock, 2, ' '), shotClockColor | BG_BLACK);

    // Red team score (RIGHT side - they attack right basket)
    var redTeamText = gameState.teamNames.red.toUpperCase() + ": ";
    var redScoreText = padStart(gameState.score.red, 3, ' ');
    var redXPos = 78 - redTeamText.length - redScoreText.length;
    scoreFrame.gotoxy(redXPos, 1);
    scoreFrame.putmsg(redTeamText, gameState.teamColors.red.fg | gameState.teamColors.red.bg);
    scoreFrame.putmsg(redScoreText, redColor | gameState.teamColors.red.bg);
    if (gameState.onFire.red) {
        scoreFrame.putmsg(" ON FIRE!", YELLOW | gameState.teamColors.red.bg);
    }

    // Draw turbo bars (line 2)
    // Blue team turbo bars (LEFT side - they attack left basket)
    if (bluePlayer1 && bluePlayer1.playerData) {
        scoreFrame.gotoxy(3, 2);
        drawTurboBar(bluePlayer1.playerData.turbo, bluePlayer1.playerData.jersey);
    }
    if (bluePlayer2 && bluePlayer2.playerData) {
        scoreFrame.gotoxy(14, 2);
        drawTurboBar(bluePlayer2.playerData.turbo, bluePlayer2.playerData.jersey);
    }

    // Red team turbo bars (RIGHT side - they attack right basket)
    if (redPlayer1 && redPlayer1.playerData) {
        scoreFrame.gotoxy(56, 2);
        drawTurboBar(redPlayer1.playerData.turbo, redPlayer1.playerData.jersey);
    }
    if (redPlayer2 && redPlayer2.playerData) {
        scoreFrame.gotoxy(67, 2);
        drawTurboBar(redPlayer2.playerData.turbo, redPlayer2.playerData.jersey);
    }

    // Player names (line 3)
    // Blue team names (LEFT side)
    if (bluePlayer1 && bluePlayer1.playerData) {
        scoreFrame.gotoxy(2, 3);
        // Show ball indicator if this player has possession
        if (gameState.ballCarrier === bluePlayer1) {
            scoreFrame.putmsg("o", YELLOW | BG_BLACK);
        } else {
            scoreFrame.putmsg(" ", BG_BLACK);
        }
        scoreFrame.gotoxy(3, 3);
        // Extract last name (handles parentheses)
        var lastName1 = getLastName(bluePlayer1.playerData.name);
        lastName1 = lastName1.substring(0, 8); // Max 8 chars (leave room for indicator)
        scoreFrame.putmsg(lastName1, gameState.teamColors.blue.fg | gameState.teamColors.blue.bg);
    }
    if (bluePlayer2 && bluePlayer2.playerData) {
        scoreFrame.gotoxy(13, 3);
        // Show ball indicator if this player has possession
        if (gameState.ballCarrier === bluePlayer2) {
            scoreFrame.putmsg("o", YELLOW | BG_BLACK);
        } else {
            scoreFrame.putmsg(" ", BG_BLACK);
        }
        scoreFrame.gotoxy(14, 3);
        // Extract last name (handles parentheses)
        var lastName2 = getLastName(bluePlayer2.playerData.name);
        lastName2 = lastName2.substring(0, 8); // Max 8 chars (leave room for indicator)
        scoreFrame.putmsg(lastName2, gameState.teamColors.blue.fg | gameState.teamColors.blue.bg);
    }

    // Red team names (RIGHT side)
    if (redPlayer1 && redPlayer1.playerData) {
        scoreFrame.gotoxy(55, 3);
        // Show ball indicator if this player has possession
        if (gameState.ballCarrier === redPlayer1) {
            scoreFrame.putmsg("o", YELLOW | BG_BLACK);
        } else {
            scoreFrame.putmsg(" ", BG_BLACK);
        }
        scoreFrame.gotoxy(56, 3);
        // Extract last name (handles parentheses)
        var lastName3 = getLastName(redPlayer1.playerData.name);
        lastName3 = lastName3.substring(0, 8); // Max 8 chars (leave room for indicator)
        scoreFrame.putmsg(lastName3, gameState.teamColors.red.fg | gameState.teamColors.red.bg);
    }
    if (redPlayer2 && redPlayer2.playerData) {
        scoreFrame.gotoxy(66, 3);
        // Show ball indicator if this player has possession
        if (gameState.ballCarrier === redPlayer2) {
            scoreFrame.putmsg("o", YELLOW | BG_BLACK);
        } else {
            scoreFrame.putmsg(" ", BG_BLACK);
        }
        scoreFrame.gotoxy(67, 3);
        // Extract last name (handles parentheses)
        var lastName4 = getLastName(redPlayer2.playerData.name);
        lastName4 = lastName4.substring(0, 8); // Max 8 chars (leave room for indicator)
        scoreFrame.putmsg(lastName4, gameState.teamColors.red.fg | gameState.teamColors.red.bg);
    }

    // Announcer text (line 4)
    var announcerText = getAnnouncerText();
    if (announcerText) {
        var xPos = Math.floor((80 - announcerText.length) / 2);
        scoreFrame.gotoxy(xPos, 4);
        scoreFrame.putmsg(announcerText, getAnnouncerColor() | BG_BLACK);
    }

    scoreFrame.cycle();
}

function drawTurboBar(turbo, jersey) {
    // Draw jersey number and turbo bar
    scoreFrame.putmsg("#" + jersey + " ", LIGHTGRAY | BG_BLACK);

    var barLength = 6;
    var filled = Math.floor((turbo / MAX_TURBO) * barLength);

    var color = turbo > 66 ? LIGHTGREEN : (turbo > 33 ? YELLOW : LIGHTRED);

    scoreFrame.putmsg("[", LIGHTGRAY | BG_BLACK);
    for (var i = 0; i < barLength; i++) {
        if (i < filled) {
            scoreFrame.putmsg(ascii(219), color | BG_BLACK);
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

    courtFrame = new Frame(1, 1, COURT_WIDTH, COURT_HEIGHT, WHITE | BG_BROWN);
    scoreFrame = new Frame(1, COURT_HEIGHT + 1, 80, 4, LIGHTGRAY | BG_BLACK);

    courtFrame.open();
    scoreFrame.open();

    // Create ball frame (1x1 animated ball)
    ballFrame = new Frame(40, 10, 1, 1, YELLOW | BG_BROWN, courtFrame);
    ballFrame.putmsg("o");
    ballFrame.open();
}

function initSprites(redTeamName, blueTeamName, redPlayerIndices, bluePlayerIndices, allCPUMode) {
    // Get team rosters
    redTeamName = redTeamName || "lakers";
    blueTeamName = blueTeamName || "celtics";
    allCPUMode = allCPUMode || false;

    var redTeam = NBATeams[redTeamName];
    var blueTeam = NBATeams[blueTeamName];

    // Set team names and colors in game state
    gameState.teamNames.red = redTeam.name || redTeamName;
    gameState.teamNames.blue = blueTeam.name || blueTeamName;

    // Set team colors (convert string names to actual color constants)
    if (redTeam.colors) {
        gameState.teamColors.red = {
            fg: getColorValue(redTeam.colors.fg),
            bg: getColorValue(redTeam.colors.bg),
            fg_accent: getColorValue(redTeam.colors.fg_accent),
            bg_alt: getColorValue(redTeam.colors.bg_alt)
        };
    }
    if (blueTeam.colors) {
        gameState.teamColors.blue = {
            fg: getColorValue(blueTeam.colors.fg),
            bg: getColorValue(blueTeam.colors.bg),
            fg_accent: getColorValue(blueTeam.colors.fg_accent),
            bg_alt: getColorValue(blueTeam.colors.bg_alt)
        };
    }

    // Default to first two players if no indices provided
    if (!redPlayerIndices) {
        redPlayerIndices = { player1: 0, player2: 1 };
    }
    if (!bluePlayerIndices) {
        bluePlayerIndices = { player1: 0, player2: 1 };
    }

    // Create RED TEAM (left side)
    redPlayer1 = new Sprite.Aerial(
        "player-red",
        courtFrame,
        18,
        7,
        "e",
        "normal"
    );
    redPlayer1.frame.open();
    redPlayer1.isHuman = !allCPUMode; // If demo mode, all players are CPU
    // Attach player data
    new Player(
        redTeam.players[redPlayerIndices.player1].name,
        redTeam.players[redPlayerIndices.player1].jersey,
        redTeam.players[redPlayerIndices.player1].attributes,
        redPlayer1
    );

    redPlayer2 = new Sprite.Aerial(
        "player-red",
        courtFrame,
        18,
        12,
        "e",
        "normal"
    );
    redPlayer2.frame.open();
    redPlayer2.isHuman = false;
    new Player(
        redTeam.players[redPlayerIndices.player2].name,
        redTeam.players[redPlayerIndices.player2].jersey,
        redTeam.players[redPlayerIndices.player2].attributes,
        redPlayer2
    );

    // Create BLUE TEAM (right side)
    bluePlayer1 = new Sprite.Aerial(
        "player-blue",
        courtFrame,
        58,
        7,
        "w",
        "normal"
    );
    bluePlayer1.frame.open();
    bluePlayer1.isHuman = false;
    new Player(
        blueTeam.players[bluePlayerIndices.player1].name,
        blueTeam.players[bluePlayerIndices.player1].jersey,
        blueTeam.players[bluePlayerIndices.player1].attributes,
        bluePlayer1
    );

    bluePlayer2 = new Sprite.Aerial(
        "player-blue",
        courtFrame,
        58,
        12,
        "w",
        "normal"
    );
    bluePlayer2.frame.open();
    bluePlayer2.isHuman = false;
    new Player(
        blueTeam.players[bluePlayerIndices.player2].name,
        blueTeam.players[bluePlayerIndices.player2].jersey,
        blueTeam.players[bluePlayerIndices.player2].attributes,
        bluePlayer2
    );

    // Red team starts with ball - player 1 has it
    gameState.ballCarrier = redPlayer1;
    gameState.currentTeam = "red";
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

    // 2. ATTRIBUTE MULTIPLIER (player skill)
    var attributeMultiplier = 1.0;
    if (distanceToBasket < 8) {
        // Close range - use dunk attribute
        var dunkSkill = playerData.attributes[ATTR_DUNK];
        attributeMultiplier = 0.7 + (dunkSkill / 10) * 0.6; // 0.7 to 1.3
    } else {
        // Perimeter - use 3point attribute
        var threePointSkill = playerData.attributes[ATTR_3PT];
        attributeMultiplier = 0.7 + (threePointSkill / 10) * 0.6; // 0.7 to 1.3
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
    }

    // COMBINED FORMULA
    var finalProbability = (baseProbability * attributeMultiplier) - defenderPenalty;

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

function updateDebugInfo(teamKey, info) {
    if (!gameState.debugOverlay) return;
    if (!gameState.debugOverlay.last) {
        gameState.debugOverlay.last = {};
    }
    gameState.debugOverlay.last[teamKey] = info;
}

function buildDebugLine(teamKey) {
    var info = gameState.debugOverlay && gameState.debugOverlay.last ? gameState.debugOverlay.last[teamKey] : null;
    var labelName = (gameState.teamNames && gameState.teamNames[teamKey]) ? gameState.teamNames[teamKey] : teamKey.toUpperCase();
    var role = (teamKey === "red") ? "P1" : "CPU";
    var parts = [];
    if (info) {
        if (info.state) parts.push(info.state);
        if (info.decision) parts.push(info.decision);
        if (info.note) parts.push(info.note);
        if (info.inBackcourt !== undefined) parts.push("bc:" + (info.inBackcourt ? "Y" : "N"));
        if (info.passChance !== undefined) parts.push("pass:" + info.passChance);
        if (info.driveX !== undefined && info.driveY !== undefined) parts.push("tgt:" + info.driveX + "," + info.driveY);
        if (info.distance !== undefined) parts.push("dist:" + info.distance);
        if (info.stuck !== undefined) parts.push("stk:" + info.stuck);
        if (info.turbo !== undefined) parts.push("tu:" + Math.round(info.turbo));
    }
    var text = parts.length ? parts.join(" ") : "--";
    var label = labelName.toUpperCase() + " (" + role + ")" + ": " + text;
    return label;
}

function fitDebugText(text, width) {
    if (text.length > width) {
        return text.substring(0, width);
    }
    if (text.length < width) {
        return text + Array(width - text.length + 1).join(" ");
    }
    return text;
}

function drawDebugOverlay() {
    if (!courtFrame) return;
    var width = COURT_WIDTH - 4;
    var baseY = COURT_HEIGHT - 1;
    if (baseY < 2) return;

    var show = gameState.debugOverlay && gameState.debugOverlay.enabled;
    var redLine = show ? buildDebugLine("red") : "";
    var blueLine = show ? buildDebugLine("blue") : "";

    courtFrame.gotoxy(3, baseY);
    courtFrame.putmsg(fitDebugText(redLine, width), LIGHTGRAY | BG_BROWN);

    if (baseY + 1 <= COURT_HEIGHT) {
        courtFrame.gotoxy(3, baseY + 1);
        courtFrame.putmsg(fitDebugText(blueLine, width), LIGHTGRAY | BG_BROWN);
    }
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
    announce(message, LIGHTRED);
    mswait(800);
    resetBackcourtState();
    switchPossession();
    gameState.ballHandlerStuckTimer = 0;
    if (gameState.ballCarrier) {
        gameState.ballHandlerLastX = gameState.ballCarrier.x;
        gameState.ballHandlerLastY = gameState.ballCarrier.y;
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

    if (closest && closestDist < 8) {
        if (closest.playerData && closest.playerData.turbo > 4) {
            activateAITurbo(closest, 0.6, closestDist);
        }
        attemptBlock(closest);
    }

    for (var j = 0; j < defenders.length; j++) {
        var helper = defenders[j];
        if (!helper || helper === closest || helper.isHuman) continue;
        var rimDist = distanceBetweenPoints(helper.x, helper.y, targetX, targetY);
        if (rimDist < 7 && Math.random() < 0.35) {
            activateAITurbo(helper, 0.4, rimDist);
            attemptBlock(helper);
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

    // PRIORITY 1: If ball carrier in backcourt, GO TO FRONTCOURT WING
    if (inBackcourt) {
        // Pick a wing spot ahead - alternate based on player
        return (player === redPlayer2 || player === bluePlayer1)
            ? spots.left_wing
            : spots.right_wing;
    }

    // PRIORITY 2: Space the floor in frontcourt
    // If ball handler on left side (low Y), go to right wing (high Y)
    if (ballCarrier.y < BASKET_LEFT_Y) {
        return spots.right_wing;
    } else {
        return spots.left_wing;
    }
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
    var baseQuality = player.playerData.attributes[ATTR_3PT] * 5; // 0-50

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
    var inBackcourt = isInBackcourt(player, teamName);
    var defenderDist = getClosestDefenderDistance(player, teamName);

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

    // PRIORITY 2: LANE OPEN + TURBO -> DRIVE
    if (isLaneOpen(player, teamName) && playerData.turbo > 20) {
        playerData.aiLastAction = "drive_lane";
        playerData.turboActive = true;
        playerData.useTurbo(TURBO_DRAIN_RATE);

        steerToward(player, basket.x, basket.y, 5); // Turbo speed

        // Dunk if close enough
        var distToBasket = distanceBetweenPoints(player.x, player.y, basket.x, basket.y);
        if (distToBasket < 6) {
            attemptShot(); // Will trigger dunk animation
        }
        return;
    }

    // PRIORITY 3: OPEN SHOT -> SHOOT
    var shotQuality = calculateShotQuality(player, teamName);
    var distToBasket = distanceBetweenPoints(player.x, player.y, basket.x, basket.y);

    if (shotQuality > SHOT_PROBABILITY_THRESHOLD && defenderDist > 6 && distToBasket > 12) {
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

    // DEFAULT: PROBE - Move toward top of key
    playerData.aiLastAction = "probe";
    var probeSpot = spots.top_key;
    steerToward(player, probeSpot.x, probeSpot.y, 2);
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
    if (distToBall < 2 && Math.random() < (0.01 + 0.02 * playerData.attributes[ATTR_STEAL] / 10)) {
        attemptUserSteal(player); // Try to steal
    }
}

/**
 * AI State: DefenseHelp - Help defense (not guarding ball)
 * Strategy: Protect paint, deny passing lanes
 */
function aiDefenseHelp(player, teamName, ballCarrier) {
    var playerData = player.playerData;
    if (!playerData || !ballCarrier) return;

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
        steerToward(player, paintX + (Math.random() - 0.5) * 2, paintY + (Math.random() - 0.5) * 2, 2.5);
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
            steerToward(player, denyX, denyY, 2);
        } else {
            // Fallback: protect paint
            playerData.aiLastAction = "fallback_paint";
            steerToward(player, paintX + (Math.random() - 0.5) * 2, paintY + (Math.random() - 0.5) * 2, 2);
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

            // REASON 4: Backcourt urgency - must advance
            if (!shouldPass && backcourtUrgent && !teammateInBackcourt) {
                shouldPass = true;
                passIntent = "ADVANCE_BALL";
            }

            if (shouldPass) {
                // Store pass intent for receiver
                if (!gameState.passIntent) gameState.passIntent = {};
                gameState.passIntent[getPlayerKey(teammate)] = passIntent;

                animatePass(player, teammate);
                return;
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
            if (playerData.attributes[ATTR_SPEED] >= 7 || playerData.attributes[ATTR_DUNK] >= 7) {
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

    updateDebugInfo(teamName, {
        state: "handle",
        carrier: player.playerData.name || teamName,
        shotProb: myShotProb.toFixed(1),
        inBackcourt: inBackcourt,
        stuck: gameState.ballHandlerStuckTimer,
        turbo: playerData.turbo.toFixed(0),
        defDist: defenderDist.toFixed(1)
    });
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
    else if (ballHandlerStuck && myDefDist > 5) {
        // Cut toward basket to get open
        targetX = clampToCourtX(targetBasketX - attackDirection * 6);
        targetY = BASKET_LEFT_Y;
        needTurbo = true;
    }
    // PRIORITY 3: Bunched up with ball carrier - CREATE SPACE
    else if (bunchedUp) {
        // Move away from ball carrier
        var awayDirection = player.y < ballCarrier.y ? -1 : 1;
        targetX = clampToCourtX(targetBasketX - attackDirection * 12);
        targetY = clampToCourtY(BASKET_LEFT_Y + awayDirection * 6);
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
    // PRIORITY 5: Shot clock urgent and I'm not ahead - CUT TO BASKET
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
    }

    // === MAN-TO-MAN POSITIONING ===

    var myManDistToMyBasket = Math.abs(myMan.x - myBasketX);

    // Check perimeter limit - don't chase too far from basket unless they're a shooter
    var atPerimeterLimit = myManDistToMyBasket > DEFENDER_PERIMETER_LIMIT;
    var shouldSagOff = false;

    if (atPerimeterLimit && myMan.playerData) {
        var threePointSkill = myMan.playerData.attributes[ATTR_3PT];
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
    if (needTurbo && playerData.turbo > 10) {
        var defDistance = distanceBetweenPoints(player.x, player.y, targetX, targetY);
        activateAITurbo(player, 0.6, defDistance);
    }

    // Move to defensive position
    moveAITowards(player, targetX, targetY);

    // === DEFENSIVE ACTIONS ===

    // STEAL - attempt if guarding ball carrier and close
    if (myMan === ballCarrier && distToMyMan < 5) {
        var stealAttr = playerData.attributes[ATTR_STEAL];
        var stealChance = STEAL_BASE_CHANCE * (stealAttr / 5); // Higher steal = more attempts
        if (Math.random() < stealChance) {
            attemptAISteal(player, ballCarrier);
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

    if (distance < 1.5) return;

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

function gameLoop() {
    gameState.gameRunning = true;
    var lastUpdate = Date.now();
    var lastSecond = Date.now();
    var lastAI = Date.now();

    // Initial draw
    drawCourt();
    drawScore();

    while (gameState.gameRunning && gameState.timeRemaining > 0) {
        var now = Date.now();
        var violationTriggeredThisFrame = false;

        // Update timer
        if (now - lastSecond >= 1000) {
            gameState.timeRemaining--;
            gameState.shotClock--;
            lastSecond = now;

            // Shot clock violation
            if (gameState.shotClock <= 0) {
                announce("SHOT CLOCK VIOLATION!", LIGHTRED);
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
                } else {
                    // Ball handler is moving, reset timer
                    gameState.ballHandlerStuckTimer = 0;
                }

                // Update last position
                gameState.ballHandlerLastX = ballHandler.x;
                gameState.ballHandlerLastY = ballHandler.y;
            }

            if (gameState.ballCarrier && !gameState.inbounding) {
                var inBackcourt = isInBackcourt(gameState.ballCarrier, gameState.currentTeam);
                if (!gameState.frontcourtEstablished) {
                    if (!inBackcourt) {
                        gameState.frontcourtEstablished = true;
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
            if (blocker) {
                // Jump animation - move up quickly then back down
                var jumpProgress = (8 - gameState.blockJumpTimer) / 8; // 0 to 1

                if (jumpProgress < 0.5) {
                    // Going up
                    var jumpY = blocker.blockOriginalY - Math.round(jumpProgress * 6); // Jump up 3 units
                    blocker.moveTo(blocker.x, jumpY);
                } else {
                    // Coming down
                    var jumpY = blocker.blockOriginalY - Math.round((1 - jumpProgress) * 6);
                    blocker.moveTo(blocker.x, jumpY);
                }

                gameState.blockJumpTimer--;

                // Reset when done
                if (gameState.blockJumpTimer === 0) {
                    blocker.moveTo(blocker.x, blocker.blockOriginalY);
                    gameState.activeBlock = null;
                }
            }
        }

        // Store previous positions before movement
        var allPlayers = getAllPlayers();
        for (var p = 0; p < allPlayers.length; p++) {
            allPlayers[p].prevX = allPlayers[p].x;
            allPlayers[p].prevY = allPlayers[p].y;
        }

        if (gameState.ballCarrier && !gameState.inbounding && !gameState.frontcourtEstablished) {
            if (!isInBackcourt(gameState.ballCarrier, gameState.currentTeam)) {
                gameState.frontcourtEstablished = true;
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

        // Redraw
        if (now - lastUpdate >= 80) {
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

    // Space bar - shoot or steal OR command teammate to shoot
    if (key === ' ') {
        if (gameState.currentTeam === "red" && gameState.ballCarrier === redPlayer1) {
            // Human has ball - shoot
            attemptShot();
        } else if (gameState.currentTeam === "red" && gameState.ballCarrier === redPlayer2) {
            // Teammate has ball - command them to shoot
            attemptShot();
        } else if (gameState.currentTeam !== "red") {
            // On defense - attempt steal
            attemptSteal();
        }
        return;
    }

    // S key - pass to/from teammate OR steal (on defense)
    if (keyUpper === 'S') {
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

    if (keyUpper === 'V') {
        gameState.debugOverlay.enabled = !gameState.debugOverlay.enabled;
        if (gameState.debugOverlay.enabled) {
            announce("DEBUG HUD ON", LIGHTGRAY);
        } else {
            announce("DEBUG HUD OFF", LIGHTGRAY);
        }
        return;
    }

    // Spacebar - attempt block
    if (key === ' ') {
        attemptBlock(redPlayer1);
        return;
    }

    // Detect turbo (rapid repeated arrow key presses)
    var now = Date.now();
    var isArrowKey = (key == KEY_UP || key == KEY_DOWN || key == KEY_LEFT || key == KEY_RIGHT);

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
    } else if (redPlayer1) {
        // Non-movement keys (pass, shoot, etc)
        redPlayer1.getcmd(key);
    }
}

function passToTeammate() {
    // Animate and check pass
    animatePass(redPlayer1, redPlayer2);
}

function animatePass(passer, receiver) {
    if (!passer || !receiver) return;

    var startX = passer.x + 2; // Center of sprite
    var startY = passer.y + 2;
    var endX = receiver.x + 2;
    var endY = receiver.y + 2;

    // Calculate distance for realistic timing
    var dx = endX - startX;
    var dy = endY - startY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    // Check for interception during animation
    var interceptor = checkPassInterception(passer, receiver);

    if (interceptor) {
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
        if (ballFrame && ballFrame.moveTo) {
            ballFrame.moveTo(x, y);
        }

        // Draw trail (using CP437 middle dot character 250)
        if (i > 0) {
            var prevT = (i - 1) / steps;
            var prevX = Math.round(startX + (dx * prevT));
            var prevY = Math.round(startY + (dy * prevT));
            courtFrame.gotoxy(prevX, prevY);
            courtFrame.putmsg(ascii(250), LIGHTGRAY | BG_BROWN);
        }

        Sprite.cycle();
        courtFrame.cycle();
        mswait(msPerStep);
    }

    // Clear rebound state and assign possession
    gameState.reboundActive = false;

    if (interceptor) {
        // Interception happened
        gameState.ballCarrier = interceptor;
        var interceptorTeam = (interceptor === redPlayer1 || interceptor === redPlayer2) ? "red" : "blue";
        gameState.currentTeam = interceptorTeam;
        resetBackcourtState();
        gameState.ballHandlerStuckTimer = 0;
        gameState.shotClock = 24;
        var otherTeam = interceptorTeam === "red" ? "blue" : "red";
        gameState.consecutivePoints[otherTeam] = 0;
        gameState.onFire[otherTeam] = false;
        gameState.ballHandlerLastX = interceptor.x;
        gameState.ballHandlerLastY = interceptor.y;

        if (interceptor.playerData) {
            announce(interceptor.playerData.name + " PICKS OFF THE PASS!", YELLOW);
        }
    } else {
        // Pass completed successfully
        gameState.ballCarrier = receiver;
    }

    // Ensure ball carrier is ALWAYS set
    if (!gameState.ballCarrier) {
        gameState.ballCarrier = receiver; // Fallback to receiver
    }
}

function checkPassInterception(passer, receiver) {
    // Check if any defender is in the passing lane and can intercept
    if (!passer || !receiver) return null;

    var passerTeam = (passer === redPlayer1 || passer === redPlayer2) ? "red" : "blue";
    var defenders = passerTeam === "red" ? getBlueTeam() : getRedTeam();

    // Calculate pass vector
    var passX1 = passer.x + 2;
    var passY1 = passer.y + 2;
    var passX2 = receiver.x + 2;
    var passY2 = receiver.y + 2;
    var passVecX = passX2 - passX1;
    var passVecY = passY2 - passY1;
    var passLength = Math.sqrt(passVecX * passVecX + passVecY * passVecY);

    if (passLength < 0.1) return null; // Too short to intercept

    for (var i = 0; i < defenders.length; i++) {
        var defender = defenders[i];
        if (!defender || !defender.playerData) continue;

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

        // Calculate closest point on pass line to defender
        var t = projection / passLength;
        var closestX = passX1 + passVecX * t;
        var closestY = passY1 + passVecY * t;

        // Distance from defender to pass line
        var distToLine = Math.sqrt(Math.pow(defX - closestX, 2) + Math.pow(defY - closestY, 2));

        if (distToLine < 5) {
            // Defender is close to passing lane
            var interceptChance = defender.playerData.attributes[ATTR_STEAL] * 6; // 0-60% based on steal
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

    var dx = Math.abs(defender.x - ballCarrier.x);
    var dy = Math.abs(defender.y - ballCarrier.y);
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 6) {
        // Steal chance based on attributes (reduced for more difficulty)
        var stealChance = defenderData.attributes[ATTR_STEAL] * 4; // Reduced from 8 to 4
        var resistance = carrierData.attributes[ATTR_POWER] * 4; // Increased from 3 to 4
        var chance = (stealChance - resistance + 10) / 100; // Reduced base from 20 to 10

        if (chance < 0.05) chance = 0.05; // Lowered minimum from 0.1 to 0.05
        if (chance > 0.4) chance = 0.4; // Lowered maximum from 0.7 to 0.4

        if (Math.random() < chance) {
            // Steal successful!
            gameState.reboundActive = false; // Clear rebound state
            gameState.ballCarrier = redPlayer1;
            gameState.currentTeam = "red";
            resetBackcourtState();
            gameState.ballHandlerStuckTimer = 0;
            gameState.consecutivePoints.blue = 0;
            gameState.onFire.blue = false;
            gameState.shotClock = 24; // Reset shot clock on steal
            gameState.ballHandlerLastX = redPlayer1.x;
            gameState.ballHandlerLastY = redPlayer1.y;
            assignDefensiveMatchups();

            announce(defenderData.name + " WITH THE STEAL!", LIGHTCYAN);
        }
        // No announcement on failed steal attempt - just keep playing
    }
}

function attemptBlock(blocker) {
    if (!blocker || !blocker.playerData) return;

    // Can only block on defense or during a shot
    if (gameState.currentTeam === "red" && !gameState.shotInProgress) {
        announce("CAN'T BLOCK NOW!", LIGHTGRAY);
        return;
    }

    // Start block animation
    gameState.activeBlock = blocker;
    gameState.blockJumpTimer = 8; // Jump lasts 8 frames (~250ms)

    // Store original position
    if (!blocker.blockOriginalY) {
        blocker.blockOriginalY = blocker.y;
    }
}

function attemptUserSteal(defender) {
    var ballCarrier = gameState.ballCarrier;
    if (!defender || !ballCarrier) return;
    if (gameState.currentTeam === "red") return; // Can't steal when you have possession

    var defenderData = defender.playerData;
    var carrierData = ballCarrier.playerData;
    if (!defenderData || !carrierData) return;

    // Check distance
    var dx = Math.abs(defender.x - ballCarrier.x);
    var dy = Math.abs(defender.y - ballCarrier.y);
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 6) {
        announce("TOO FAR!", LIGHTGRAY);
        return;
    }

    // User steal chance (better than AI)
    var stealChance = defenderData.attributes[ATTR_STEAL] * 5;
    var resistance = carrierData.attributes[ATTR_POWER] * 4;
    var chance = (stealChance - resistance + 15) / 100;

    if (chance < 0.1) chance = 0.1;
    if (chance > 0.4) chance = 0.4; // Human can be slightly better

    if (Math.random() < chance) {
        // Steal successful!
        gameState.reboundActive = false;
        gameState.shotClock = 24;
        gameState.currentTeam = "red";
        gameState.ballCarrier = defender;
        resetBackcourtState();
        gameState.ballHandlerStuckTimer = 0;

        // Reset opponent's streak
        gameState.consecutivePoints.blue = 0;
        gameState.onFire.blue = false;

        // Reassign defensive matchups since we now have the ball
        assignDefensiveMatchups();
        gameState.ballHandlerLastX = defender.x;
        gameState.ballHandlerLastY = defender.y;

        announce(defenderData.name + " STEALS IT!", LIGHTCYAN);
    } else {
        announce("STRIPPED! NO FOUL!", LIGHTGRAY);
    }
}

function attemptAISteal(defender, ballCarrier) {
    if (!defender || !ballCarrier) return;

    var defenderData = defender.playerData;
    var carrierData = ballCarrier.playerData;
    if (!defenderData || !carrierData) return;

    // Check distance one more time to be safe
    var dx = Math.abs(defender.x - ballCarrier.x);
    var dy = Math.abs(defender.y - ballCarrier.y);
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 6) return; // Too far

    // Steal chance based on attributes (reduced for more difficulty)
    var stealChance = defenderData.attributes[ATTR_STEAL] * 4; // Reduced from 8 to 4
    var resistance = carrierData.attributes[ATTR_POWER] * 4; // Increased from 3 to 4
    var chance = (stealChance - resistance + 10) / 100; // Reduced base from 20 to 10

    if (chance < 0.05) chance = 0.05; // Lowered minimum
    if (chance > 0.35) chance = 0.35; // AI slightly worse at steals than human

    if (Math.random() < chance) {
        // Steal successful!
        gameState.reboundActive = false;
        gameState.shotClock = 24; // Reset shot clock on steal

        // Figure out which team gets the ball
        var defenderTeam = (defender === redPlayer1 || defender === redPlayer2) ? "red" : "blue";
        gameState.currentTeam = defenderTeam;
        gameState.ballCarrier = defender;
        resetBackcourtState();
        gameState.ballHandlerStuckTimer = 0;
        gameState.ballHandlerLastX = defender.x;
        gameState.ballHandlerLastY = defender.y;
        assignDefensiveMatchups();

        // Reset opponent's streak
        var otherTeam = defenderTeam === "red" ? "blue" : "red";
        gameState.consecutivePoints[otherTeam] = 0;
        gameState.onFire[otherTeam] = false;

        announce(defenderData.name + " STEALS IT!", LIGHTCYAN);
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
            if (ballFrame && ballFrame.moveTo) {
                ballFrame.moveTo(bx, by);
            }

            Sprite.cycle();
            courtFrame.cycle();
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
    if (ballFrame && ballFrame.moveTo) {
        ballFrame.moveTo(gameState.reboundX, gameState.reboundY);
    }

    announce("REBOUND!", LIGHTMAGENTA);
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

    // Determine team
    var teamName = getPlayerTeamName(player);
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
    gameState.ballHandlerLastX = player.x;
    gameState.ballHandlerLastY = player.y;

    // Announce who got it
    announce(player.playerData.name + " WITH THE REBOUND!", LIGHTCYAN);

    // Reset heat for opposing team
    var otherTeam = teamName === "red" ? "blue" : "red";
    gameState.consecutivePoints[otherTeam] = 0;
    gameState.onFire[otherTeam] = false;

    // Assign defensive matchups
    assignDefensiveMatchups();

    // Brief pause to show who got it
    mswait(500);

    // Now the rebounder needs to bring it up - AI will handle this via normal offense logic
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
    var player = shooter;
    if (player && player.playerData) {
        announce("HE SHOOTS...", YELLOW);
    }

    var blocked = false;

    for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var x = Math.round(startX + (dx * t));
        // Higher arc for longer shots
        var arcHeight = Math.min(5, 3 + (distance / 10));
        var y = Math.round(startY + (dy * t) - (Math.sin(t * Math.PI) * arcHeight));

        // CHECK FOR BLOCK - if ball is in arc (t > 0.1 && t < 0.5) and blocker is jumping
        if (!blocked && gameState.activeBlock && gameState.blockJumpTimer > 0 && t > 0.1 && t < 0.5) {
            var blocker = gameState.activeBlock;
            // Check if blocker is near ball trajectory
            var blockDist = Math.sqrt(Math.pow(blocker.x - x, 2) + Math.pow(blocker.y - y, 2));

            if (blockDist < 4) { // Blocker must be very close
                // Check block attribute for success
                var blockChance = blocker.playerData.attributes[ATTR_BLOCK] * 8 + 20; // 20-100%
                if (Math.random() * 100 < blockChance) {
                    blocked = true;
                    announce(blocker.playerData.name + " BLOCKS IT!", LIGHTRED);
                    made = false; // Block prevents made shot
                    break; // End shot animation early
                }
            }
        }

        // Draw ball at this position
        ballFrame.moveTo(x, y);

        // Draw trail
        if (i > 0) {
            var prevT = (i - 1) / steps;
            var prevX = Math.round(startX + (dx * prevT));
            var prevY = Math.round(startY + (dy * prevT) - (Math.sin(prevT * Math.PI) * arcHeight));
            courtFrame.gotoxy(prevX, prevY);
            courtFrame.putmsg(".", LIGHTGRAY | BG_BROWN);
        }

        Sprite.cycle();
        courtFrame.cycle();
        mswait(msPerStep);
    }

    // Clear shot in progress flag
    gameState.shotInProgress = false;

    // Flash basket if made
    if (made && !blocked) {
        for (var flash = 0; flash < 3; flash++) {
            courtFrame.gotoxy(targetX, targetY);
            courtFrame.putmsg("*", YELLOW | BG_BROWN);
            courtFrame.cycle();
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

    var targetX = gameState.currentTeam === "red" ? BASKET_RIGHT_X : BASKET_LEFT_X;
    var targetY = BASKET_LEFT_Y;

    // Calculate actual 2D distance from player to basket
    var dx = player.x - targetX;
    var dy = player.y - targetY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    // Determine if this is a 3-pointer (outside the 3-point arc, radius ~11)
    var is3Pointer = distance > 11;

    // Base shooting chance from player attributes (more generous)
    var baseChance;
    if (is3Pointer) {
        // 3-pointers: base 40-80% depending on 3PT stat
        baseChance = 40 + (playerData.attributes[ATTR_3PT] * 4);
    } else if (distance < 10) {
        // Close shots: base 60-90% depending on dunk stat
        baseChance = 60 + (playerData.attributes[ATTR_DUNK] * 3);
    } else {
        // Mid-range: average of both stats
        baseChance = 50 + ((playerData.attributes[ATTR_DUNK] + playerData.attributes[ATTR_3PT]) * 2);
    }

    // Distance penalty (reduced)
    var distancePenalty = is3Pointer ?
        (distance - 11) * 1.5 : // Penalty beyond the arc
        (distance - 3) * 0.8; // Penalty for mid-range

    var chance = baseChance - distancePenalty;
    if (chance < 20) chance = 20;
    if (chance > 95) chance = 95;

    // Heat streak bonus
    chance += playerData.heatStreak * 5;

    // Bonus for ON FIRE
    if (gameState.onFire[gameState.currentTeam]) {
        chance += 15;
        if (chance > 99) chance = 99;
    }

    // Defensive pressure penalty - check closest defender
    var closestDefender = getClosestPlayer(player.x, player.y, gameState.currentTeam === "red" ? "blue" : "red");

    var dx = Math.abs(player.x - closestDefender.x);
    var dy = Math.abs(player.y - closestDefender.y);
    var defenseDistance = Math.sqrt(dx * dx + dy * dy);

    if (defenseDistance < 8) {
        // Defender's block attribute matters (reduced penalty)
        var defenderData = closestDefender.playerData;
        var defensePenalty = (8 - defenseDistance) * (2 + (defenderData ? defenderData.attributes[ATTR_BLOCK] * 0.5 : 2));
        chance -= defensePenalty;
        if (chance < 15) chance = 15; // Higher minimum
    }

    var made = Math.random() * 100 < chance;

    // Animate the shot
    var shotResult = animateShot(gameState.ballX, gameState.ballY, targetX, targetY, made);
    made = shotResult.made;
    var blocked = shotResult.blocked;

    if (made) {
        // Score!
        var points = is3Pointer ? 3 : 2;
        gameState.score[gameState.currentTeam] += points;
        gameState.consecutivePoints[gameState.currentTeam]++;
        playerData.heatStreak++;

        // Refill turbo for entire scoring team on made basket!
        var scoringTeam = gameState.currentTeam === "red" ? [redPlayer1, redPlayer2] : [bluePlayer1, bluePlayer2];
        for (var i = 0; i < scoringTeam.length; i++) {
            if (scoringTeam[i] && scoringTeam[i].playerData) {
                scoringTeam[i].playerData.turbo = MAX_TURBO;
            }
        }

        // Announcer callouts
        if (is3Pointer) {
            announce(playerData.name + " FROM DOWNTOWN!", YELLOW);
        } else if (playerData.attributes[ATTR_DUNK] > 7 && distance < 8) {
            announce(playerData.name + " SLAMS IT HOME!", LIGHTRED);
        } else {
            announce(playerData.name + " SCORES " + points + "!", LIGHTGREEN);
        }

        // Check for ON FIRE
        if (gameState.consecutivePoints[gameState.currentTeam] >= 3) {
            gameState.onFire[gameState.currentTeam] = true;
            announce("ON FIRE!!!", YELLOW);
        }

        // Reset other team's streak
        var otherTeam = gameState.currentTeam === "red" ? "blue" : "red";
        gameState.consecutivePoints[otherTeam] = 0;
        gameState.onFire[otherTeam] = false;

        // Set up inbound play after made basket
        mswait(800);  // Brief pause to see the score
        setupInbound(gameState.currentTeam);
    } else {
        // Miss - reset streak
        gameState.consecutivePoints[gameState.currentTeam] = 0;
        gameState.onFire[gameState.currentTeam] = false;
        playerData.heatStreak = 0;

        // Brief pause to see the miss
        mswait(200);
        announce("MISS!", LIGHTGRAY);
        mswait(200);

        // Create rebound opportunity (animated)
        createRebound(targetX, targetY);

        // Let the rebound scramble play out - DON'T immediately switch possession
        // The AI will race for the ball, and we'll resolve who gets it
        resolveReboundScramble();
    }
}

function setupInbound(scoringTeam) {
    // After a made basket, set up inbound play (NBA Jam style)
    gameState.reboundActive = false;
    gameState.inbounding = true;

    // The team that got scored ON inbounds the ball
    var inboundTeam = scoringTeam === "red" ? "blue" : "red";
    gameState.currentTeam = inboundTeam;
    resetBackcourtState();

    if (inboundTeam === "red") {
        // Red team inbounds from left baseline (their defensive basket), attacking right
        redPlayer1.moveTo(2, 9); // Out of bounds position near left sideline
        gameState.inboundPasser = redPlayer1;

        var redReceiverX = clampToCourtX(Math.floor(COURT_WIDTH / 2) - 6);
        redPlayer2.moveTo(redReceiverX, 9);
        gameState.ballCarrier = redPlayer1; // Passer has ball initially

        // Blue defenders retreat toward midcourt on their side to reduce interceptions
        bluePlayer1.moveTo(clampToCourtX(COURT_WIDTH - 16), 7);
        bluePlayer2.moveTo(clampToCourtX(COURT_WIDTH - 12), 11);
    } else {
        // Blue team inbounds from right baseline (their defensive basket), attacking left
        bluePlayer1.moveTo(COURT_WIDTH - 2, 9); // Out of bounds position near right sideline
        gameState.inboundPasser = bluePlayer1;

        var blueReceiverX = clampToCourtX(Math.floor(COURT_WIDTH / 2) + 6);
        bluePlayer2.moveTo(blueReceiverX, 9);
        gameState.ballCarrier = bluePlayer1; // Passer has ball initially

        // Red defenders fall back toward midcourt on their side
        redPlayer1.moveTo(clampToCourtX(16), 7);
        redPlayer2.moveTo(clampToCourtX(12), 11);
    }

    // Auto-pass after a brief delay (simulate inbound)
    mswait(300);

    // Determine receiver
    var receiver = inboundTeam === "red" ? redPlayer2 : bluePlayer2;
    var inboundPasserSprite = gameState.inboundPasser;

    // Animate the inbound pass
    animatePass(inboundPasserSprite, receiver);

    // Inbounder steps onto the court after the pass
    if (inboundTeam === "red") {
        redPlayer1.moveTo(clampToCourtX(Math.floor(COURT_WIDTH / 2) - 10), 9);
    } else {
        bluePlayer1.moveTo(clampToCourtX(Math.floor(COURT_WIDTH / 2) + 10), 9);
    }

    // Make sure possession is set to the receiver after inbound
    if (!gameState.ballCarrier || gameState.ballCarrier === inboundPasserSprite) {
        gameState.ballCarrier = receiver;
    }

    var teammateAfterInbound = inboundTeam === "red" ? redPlayer1 : bluePlayer1;
    primeInboundOffense(gameState.ballCarrier, teammateAfterInbound, inboundTeam);

    // Reset ball-handler tracking so the AI doesn't think it's stuck
    gameState.ballHandlerStuckTimer = 0;
    if (gameState.ballCarrier) {
        gameState.ballHandlerLastX = gameState.ballCarrier.x;
        gameState.ballHandlerLastY = gameState.ballCarrier.y;
    }

    // Clear inbound state
    gameState.inbounding = false;
    gameState.inboundPasser = null;
    gameState.shotClock = 24; // Reset shot clock after inbound

    // Assign defensive matchups after inbound
    assignDefensiveMatchups();

    announce("INBOUNDS!", LIGHTGRAY);
}

function assignDefensiveMatchups() {
    // Assign man-to-man defensive matchups based on proximity
    gameState.defensiveAssignments = {};

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

    if (gameState.ballCarrier) {
        gameState.ballHandlerLastX = gameState.ballCarrier.x;
        gameState.ballHandlerLastY = gameState.ballCarrier.y;
    }

    // Assign defensive matchups
    assignDefensiveMatchups();
}

function showGameOver() {
    courtFrame.clear();
    courtFrame.gotoxy(1, 1);

    courtFrame.center("\r\n\r\n");
    courtFrame.center("\1h\1y GAME OVER\1n\r\n\r\n");

    var redName = gameState.teamNames && gameState.teamNames.red ? gameState.teamNames.red : "RED";
    var blueName = gameState.teamNames && gameState.teamNames.blue ? gameState.teamNames.blue : "BLUE";

    if (gameState.score.red > gameState.score.blue) {
        courtFrame.center("\1h\1r " + redName.toUpperCase() + " WIN!\1n\r\n");
    } else if (gameState.score.blue > gameState.score.red) {
        courtFrame.center("\1h\1c " + blueName.toUpperCase() + " WIN!\1n\r\n");
    } else {
        courtFrame.center("\1h\1yTIE GAME!\1n\r\n");
    }

    courtFrame.center("\r\n");
    courtFrame.center("Final Score: \1h\1r" + redName + " " + gameState.score.red + "\1n - \1h\1c" + blueName + " " + gameState.score.blue + "\1n\r\n");

    courtFrame.cycle();

    if (typeof console !== 'undefined' && typeof console.getkey === 'function') {
        console.getkey();
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
    courtFrame.center("Space: Shoot/Steal  |  P: Pass\r\n");
    courtFrame.center("Q: Quit\r\n\r\n");
    courtFrame.center("\1h Press any key to start...\1n\r\n");

    courtFrame.cycle();

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

    courtFrame.cycle();

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

function playerSelectionScreen(teamKey, teamColor) {
    var team = NBATeams[teamKey];
    if (!team || !team.players || team.players.length === 0) {
        return null;
    }

    var currentSelection = 0;

    while (true) {
        console.clear();
        var colorCode = teamColor === "RED" ? "\1h\1r" : "\1h\1c";
        console.putmsg("\1h\1y=== NBA JAM - PLAYER SELECTION ===\1n\r\n\r\n");
        console.putmsg(colorCode + teamColor + " TEAM: " + team.name + "\1n\r\n\r\n");
        console.putmsg("Select your player:\r\n\r\n");

        // Display players with stats
        for (var i = 0; i < team.players.length; i++) {
            var player = team.players[i];
            var prefix = (i === currentSelection) ? "\1h\1w> " : "  ";

            console.putmsg(prefix + "#" + player.jersey + " " + player.name + "\1n\r\n");

            if (i === currentSelection) {
                // Show detailed stats for selected player
                console.putmsg("     SPD: " + player.attributes[ATTR_SPEED] + "/10  ");
                console.putmsg("3PT: " + player.attributes[ATTR_3PT] + "/10  ");
                console.putmsg("DNK: " + player.attributes[ATTR_DUNK] + "/10\r\n");
                console.putmsg("     PWR: " + player.attributes[ATTR_POWER] + "/10  ");
                console.putmsg("STL: " + player.attributes[ATTR_STEAL] + "/10  ");
                console.putmsg("BLK: " + player.attributes[ATTR_BLOCK] + "/10\r\n");
            }
            console.putmsg("\r\n");
        }

        console.putmsg("\1h[UP/DOWN]\1n Navigate  \1h[ENTER]\1n Select  \1h[Q]\1n Quit\r\n");

        // Get input
        var key = console.getkey();

        if (key.toUpperCase() === 'Q') {
            return null;
        } else if (key === KEY_UP && currentSelection > 0) {
            currentSelection--;
        } else if (key === KEY_DOWN && currentSelection < team.players.length - 1) {
            currentSelection++;
        } else if (key === '\r' || key === '\n') {
            return currentSelection; // Return selected player index
        }
    }
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
            var teamColor = team.colors ? team.colors.fg : "WHITE";
            var colorCode = getColorCode(teamColor);

            if (i === currentSelection) {
                // Selected item: show in bright team color with arrow
                console.putmsg(colorCode + "\1h> " + teamList[i].name + "\1n\r\n");
            } else {
                // Unselected item: show in regular team color
                console.putmsg(colorCode + "  " + teamList[i].name + "\1n\r\n");
            }
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

    // STEP 2: Select YOUR player from your team
    var userPlayerIndex = playerSelectionScreen(userTeamKey, "RED");
    if (userPlayerIndex === null) return null;

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
            var teamColor = team.colors ? team.colors.fg : "WHITE";
            var colorCode = getColorCode(teamColor);

            if (i === currentSelection) {
                // Selected item: show in bright team color with arrow
                console.putmsg(colorCode + "\1h> " + teamList[i].name + "\1n\r\n");
            } else {
                // Unselected item: show in regular team color
                console.putmsg(colorCode + "  " + teamList[i].name + "\1n\r\n");
            }
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

    // Determine teammate index (the OTHER player on user's team)
    var userTeam = NBATeams[userTeamKey];
    var teammateIndex = (userPlayerIndex === 0) ? 1 : 0;

    // Make sure teammate exists
    if (teammateIndex >= userTeam.players.length) {
        teammateIndex = 0; // Fallback
    }

    // Opponent uses both their players (indices 0 and 1)
    return {
        redTeam: userTeamKey,
        blueTeam: opponentTeamKey,
        redPlayers: {
            player1: userPlayerIndex,    // Human controlled
            player2: teammateIndex        // AI teammate
        },
        bluePlayers: {
            player1: 0,  // AI opponent 1
            player2: 1   // AI opponent 2
        }
    };
}

function runCPUDemo() {
    // Pick random or fixed teams for demo
    var teamKeys = Object.keys(NBATeams);
    var randomTeam1 = teamKeys[Math.floor(Math.random() * teamKeys.length)];
    var randomTeam2 = teamKeys[Math.floor(Math.random() * teamKeys.length)];

    // Make sure they're different teams
    while (randomTeam1 === randomTeam2) {
        randomTeam2 = teamKeys[Math.floor(Math.random() * teamKeys.length)];
    }

    var redTeamKey = randomTeam1;
    var blueTeamKey = randomTeam2;

    // Use default player indices (first two players from each team)
    var redPlayerIndices = { player1: 0, player2: 1 };
    var bluePlayerIndices = { player1: 0, player2: 1 };

    // Initialize sprites with ALL CPU mode
    initSprites(redTeamKey, blueTeamKey, redPlayerIndices, bluePlayerIndices, true);

    // Set game time (shorter for demo - 60 seconds)
    gameState.timeRemaining = 60;

    // Display "DEMO MODE" message
    announce("DEMO MODE - Press Q to exit", YELLOW);
    mswait(1500);

    // Run the game loop (all AI controlled)
    gameLoop();

    // After game ends, show score briefly
    showGameOver();
}

function showSplashScreen() {
    console.clear();

    // Load and display ANSI file
    var ansiFile = new File(js.exec_dir + "nba_jam.ans");
    if (ansiFile.open("r")) {
        var content = ansiFile.read();
        ansiFile.close();
        console.print(content);
    }

    // Wait for any keypress
    console.getkey();

    // Clear buffer
    while (console.inkey(K_NONE, 0)) { }
}

function main() {
    // Show ANSI splash screen first
    showSplashScreen();

    // Load team data first
    loadTeamData();

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
        // Team selection screen
        var selection = teamSelectionScreen();
        if (!selection) {
            // User quit during selection
            return;
        }

        // Clear screen before starting game to remove selection artifacts
        console.clear();

        initSprites(
            selection.redTeam,
            selection.blueTeam,
            selection.redPlayers,
            selection.bluePlayers,
            false  // Not demo mode - player1 is human
        );

        gameLoop();
        showGameOver();
    }

    // Cleanup
    if (ballFrame) ballFrame.close();
    if (redPlayer1) redPlayer1.remove();
    if (redPlayer2) redPlayer2.remove();
    if (bluePlayer1) bluePlayer1.remove();
    if (bluePlayer2) bluePlayer2.remove();
    if (courtFrame) courtFrame.close();
    if (scoreFrame) scoreFrame.close();
}

main();
