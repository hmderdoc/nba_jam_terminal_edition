// lib/ui/menus.js
// Menu and selection screens for NBA JAM

// ============================================================================
// INTRO SCREEN
// ============================================================================

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

// ============================================================================
// MAIN MENU
// ============================================================================

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
    courtFrame.center("\1h\1y4\1n. Play LORB\r\n");
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
        } else if (key === '4') {
            return "lorb"; // Play LORB
        }
        // Invalid key, loop again
    }
}

// ============================================================================
// PLAYER SELECTION
// ============================================================================

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

// ============================================================================
// TEAMMATE SELECTION
// ============================================================================

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

// ============================================================================
// TEAM SELECTION
// ============================================================================

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
        teamATeam: userTeamKey,
        teamBTeam: opponentTeamKey,
        teamAPlayers: {
            player1: userTeamPlayers[0],    // Human controlled (main player)
            player2: userTeamPlayers[1]     // AI teammate (selected teammate)
        },
        teamBPlayers: {
            player1: opponentPlayers[0],  // AI opponent 1
            player2: opponentPlayers[1]   // AI opponent 2
        }
    };
}

// ============================================================================
// SPLASH SCREEN
// ============================================================================

function showSplashScreen(systems, mpScreenCoordinator, myPlayerId) {
    var isMultiplayer = !!(mpScreenCoordinator);
    var isCoordinator = !!(mpScreenCoordinator && mpScreenCoordinator.coordinator && mpScreenCoordinator.coordinator.isCoordinator);

    console.clear();

    var splashLoaded = false;

    var binPath = js.exec_dir + "assets/nba_jam.bin";
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
        var ansiFile = new File(js.exec_dir + "assets/nba_jam.ans");
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

    // COORDINATOR: Enter screen state for multiplayer
    if (isMultiplayer && isCoordinator && splashLoaded) {
        mpScreenCoordinator.enterScreen("splash", {}, 10000); // 10-second timeout
        debugLog("[SPLASH] Coordinator entered screen state");
    }

    // Wait for keypress (coordinated in multiplayer)
    if (splashLoaded) {
        if (isMultiplayer) {
            // Non-blocking wait with coordination
            var localReady = false;
            var startTime = Date.now();

            while (Date.now() - startTime < 10000) {
                // Check for dismissal signal
                if (systems && systems.stateManager) {
                    var mpScreenAction = systems.stateManager.get("mpScreenAction");

                    if (mpScreenAction && mpScreenAction.action === "dismiss" && mpScreenAction.screen === "splash") {
                        debugLog("[SPLASH] Received dismissal signal");
                        systems.stateManager.set("mpScreenAction", null, "splash_dismiss_handled");
                        break;
                    }
                }

                // Coordinator: Check if can dismiss
                if (isCoordinator && mpScreenCoordinator.canDismiss()) {
                    debugLog("[SPLASH] Coordinator dismissing screen");
                    mpScreenCoordinator.dismissScreen();
                    break;
                }

                // Handle input
                var key = console.inkey(K_NONE, 100);
                if (key && !localReady) {
                    debugLog("[SPLASH] Key pressed, voting ready");
                    mpScreenCoordinator.setReady(myPlayerId);
                    localReady = true;
                }

                // Coordinator: Keep state sync active
                if (isCoordinator && mpCoordinator && mpCoordinator.update) {
                    mpCoordinator.update();
                }
            }
        } else {
            // Single-player: immediate
            console.getkey();
        }
    }

    if (isMultiplayer && isCoordinator && mpScreenCoordinator && mpScreenCoordinator.isScreenActive("splash")) {
        debugLog("[SPLASH] Coordinator forcing dismissal on exit");
        mpScreenCoordinator.dismissScreen();
    }

    // Clear input buffer
    while (console.inkey(K_NONE, 0)) { }

    // Clean up and reset attributes/screen
    console.print("\1n");
    console.clear();
}

// ============================================================================
// MATCHUP SCREEN
// ============================================================================

function showMatchupScreen(allowBetting, systems, mpScreenCoordinator, myPlayerId) {
    if (typeof console === "undefined" || typeof Sprite === "undefined") return null;
    if (!systems || !systems.stateManager) return null;

    var stateManager = systems.stateManager;
    var isMultiplayer = !!(mpScreenCoordinator);
    var isCoordinator = !!(mpScreenCoordinator && mpScreenCoordinator.coordinator && mpScreenCoordinator.coordinator.isCoordinator);
    var teamBPlayer1 = spriteRegistry.get(spriteRegistry.IDS.TEAM_B_PLAYER_1);
    var teamBPlayer2 = spriteRegistry.get(spriteRegistry.IDS.TEAM_B_PLAYER_2);
    var teamAPlayer1 = spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_1);
    var teamAPlayer2 = spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_2);

    if (!teamBPlayer1 || !teamBPlayer2 || !teamAPlayer1 || !teamAPlayer2) return null;

    var screenCols = (typeof console.screen_columns === "number") ? console.screen_columns : 80;
    var screenRows = (typeof console.screen_rows === "number") ? console.screen_rows : 24;
    if (screenCols < 80 || screenRows < 24) return;

    var binPath = js.exec_dir + "assets/nba_jam.bin";
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
        var teamColors = stateManager.get('teamColors');
        var colors = teamColors[teamKey] || {};
        var fg = (typeof colors.fg === "number") ? (colors.fg & FG_MASK) : WHITE;
        return (fg & FG_MASK) | BG_BLACK;
    }

    function teamAccentAttr(teamKey) {
        var teamColors = stateManager.get('teamColors');
        var colors = teamColors[teamKey] || {};
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

    var leftTeamKey = "teamA";
    var rightTeamKey = "teamB";
    var teamNames = stateManager.get('teamNames');
    var leftTeamName = (teamNames && teamNames.teamA) ? teamNames.teamA : "RED";
    var rightTeamName = (teamNames && teamNames.teamB) ? teamNames.teamB : "BLUE";

    var leftPlayers = [teamAPlayer1 && teamAPlayer1.playerData || null, teamAPlayer2 && teamAPlayer2.playerData || null];
    var rightPlayers = [teamBPlayer1 && teamBPlayer1.playerData || null, teamBPlayer2 && teamBPlayer2.playerData || null];

    var leftSprites = [teamAPlayer1 || null, teamAPlayer2 || null];
    var rightSprites = [teamBPlayer1 || null, teamBPlayer2 || null];

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
        { sprite: teamAPlayer1, originalBearing: teamAPlayer1 ? teamAPlayer1.bearing : null, teamKey: leftTeamKey },
        { sprite: teamAPlayer2, originalBearing: teamAPlayer2 ? teamAPlayer2.bearing : null, teamKey: leftTeamKey },
        { sprite: teamBPlayer1, originalBearing: teamBPlayer1 ? teamBPlayer1.bearing : null, teamKey: rightTeamKey },
        { sprite: teamBPlayer2, originalBearing: teamBPlayer2 ? teamBPlayer2.bearing : null, teamKey: rightTeamKey }
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

    // COORDINATOR: Enter screen state for multiplayer
    if (isMultiplayer && isCoordinator) {
        var teamNames = stateManager.get('teamNames');
        mpScreenCoordinator.enterScreen("matchup", {
            teamAName: teamNames.teamA,
            teamBName: teamNames.teamB
        }, 15000); // 15-second timeout
        debugLog("[MATCHUP] Coordinator entered screen state");
    }

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
    var localReady = false;

    while (Date.now() - startTime < durationMs) {
        // Check for multiplayer dismissal signal
        if (isMultiplayer) {
            var mpScreenAction = stateManager.get("mpScreenAction");

            if (mpScreenAction && mpScreenAction.action === "dismiss" && mpScreenAction.screen === "matchup") {
                debugLog("[MATCHUP] Received dismissal signal from coordinator");
                stateManager.set("mpScreenAction", null, "matchup_dismiss_handled");
                break;
            }

            // Coordinator: Check if can dismiss
            if (isCoordinator && mpScreenCoordinator.canDismiss()) {
                debugLog("[MATCHUP] Coordinator dismissing screen");
                mpScreenCoordinator.dismissScreen();
                break;
            }
        }

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

        // Handle ready vote for multiplayer
        if (key && key.length > 0 && isMultiplayer && !localReady) {
            debugLog("[MATCHUP] Key pressed, voting ready");
            mpScreenCoordinator.setReady(myPlayerId);
            localReady = true;
        }

        // Check for betting mode ('B' key) if betting is allowed (single-player only)
        if (key && allowBetting && !isMultiplayer && (key.toUpperCase() === 'B')) {
            // Prepare matchup data for betting interface
            if (keyUpper === 'B' && allowBetting) {
                var teamColors = stateManager.get('teamColors');
                var matchupData = {
                    teamATeam: leftTeamName,
                    teamBTeam: rightTeamName,
                    teamAPlayers: leftPlayers,
                    teamBPlayers: rightPlayers,
                    odds: oddsDisplay ? oddsDisplay.matchup : getMatchupOdds(leftPlayers, rightPlayers),
                    spread: calculateSpread(leftPlayers, rightPlayers),
                    total: calculateOverUnder(leftPlayers, rightPlayers),
                    teamColors: teamColors,
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

        // Single-player: any key breaks immediately
        // Multiplayer: key already handled above as ready vote
        if (key && !isMultiplayer) break;

        // Coordinator: Keep updating state
        if (isCoordinator && mpCoordinator && mpCoordinator.update) {
            mpCoordinator.update();
        }

        mswait(20);
    }

    for (var r = 0; r < turnInfo.length; r++) {
        var entry = turnInfo[r];
        if (entry.sprite && entry.originalBearing && entry.sprite.turnTo) {
            entry.sprite.turnTo(entry.originalBearing);
        }
    }
    Sprite.cycle();

    if (isMultiplayer && isCoordinator && mpScreenCoordinator && mpScreenCoordinator.isScreenActive("matchup")) {
        debugLog("[MATCHUP] Coordinator forcing dismissal on exit");
        mpScreenCoordinator.dismissScreen();
    }

    if (leftFrame) leftFrame.close();
    if (rightFrame) rightFrame.close();
    console.print("\1n");
    console.clear();
    return null;
}
