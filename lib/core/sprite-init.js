/**
 * NBA JAM - Sprite Initialization
 * 
 * Handles creation and initialization of player sprites for both teams
 */

function initSprites(teamATeamName, teamBTeamName, redPlayerIndices, bluePlayerIndices, allCPUMode) {
    // Get team rosters
    teamATeamName = teamATeamName || "lakers";
    teamBTeamName = teamBTeamName || "celtics";
    allCPUMode = allCPUMode || false;
    gameState.allCPUMode = allCPUMode;

    var teamATeam = NBATeams[teamATeamName];
    var teamBTeam = NBATeams[teamBTeamName];

    // Set team names and colors in game state
    gameState.teamNames.teamA = teamATeam.name || teamATeamName;
    gameState.teamNames.teamB = teamBTeam.name || teamBTeamName;
    gameState.teamAbbrs.teamA = (teamATeam && teamATeam.abbr) ? String(teamATeam.abbr).toUpperCase() : teamATeamName.substring(0, 3).toUpperCase();
    gameState.teamAbbrs.teamB = (teamBTeam && teamBTeam.abbr) ? String(teamBTeam.abbr).toUpperCase() : teamBTeamName.substring(0, 3).toUpperCase();

    // Set team colors (convert string names to actual color constants)
    if (teamATeam.colors) {
        var redFgName = teamATeam.colors.fg || "WHITE";
        var redFgAccentName = teamATeam.colors.fg_accent || redFgName;
        var redAltFgName = teamATeam.colors.alt_fg || null;
        var redAltBgName = teamATeam.colors.alt_bg || null;
        gameState.teamColors.teamA = {
            fg: getColorValue(teamATeam.colors.fg),
            bg: getColorValue(teamATeam.colors.bg),
            fg_accent: getColorValue(teamATeam.colors.fg_accent),
            bg_alt: getColorValue(teamATeam.colors.bg_alt),
            fg_code: getColorCode(redFgName),
            fg_accent_code: getColorCode(redFgAccentName),
            alt_fg: redAltFgName ? getColorValue(redAltFgName) : null,
            alt_bg: redAltBgName ? getColorValue(redAltBgName) : null,
            alt_fg_code: redAltFgName ? getColorCode(redAltFgName) : null,
            alt_bg_code: redAltBgName ? getBackgroundCode(redAltBgName) : null
        };
    }
    if (teamBTeam.colors) {
        var blueFgName = teamBTeam.colors.fg || "WHITE";
        var blueFgAccentName = teamBTeam.colors.fg_accent || blueFgName;
        var blueAltFgName = teamBTeam.colors.alt_fg || null;
        var blueAltBgName = teamBTeam.colors.alt_bg || null;
        gameState.teamColors.teamB = {
            fg: getColorValue(teamBTeam.colors.fg),
            bg: getColorValue(teamBTeam.colors.bg),
            fg_accent: getColorValue(teamBTeam.colors.fg_accent),
            bg_alt: getColorValue(teamBTeam.colors.bg_alt),
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

    // Validate and clamp roster indices to prevent out-of-bounds access
    function validateRosterIndex(index, teamPlayers) {
        var numPlayers = (teamPlayers && teamPlayers.length) || 0;
        if (numPlayers === 0) return 0;

        var idx = parseInt(index, 10);
        if (isNaN(idx) || idx < 0) return 0;
        if (idx >= numPlayers) return numPlayers - 1;
        return idx;
    }

    // Validate all roster indices before sprite creation
    redPlayerIndices.player1 = validateRosterIndex(redPlayerIndices.player1, teamATeam.players);
    redPlayerIndices.player2 = validateRosterIndex(redPlayerIndices.player2, teamATeam.players);
    bluePlayerIndices.player1 = validateRosterIndex(bluePlayerIndices.player1, teamBTeam.players);
    bluePlayerIndices.player2 = validateRosterIndex(bluePlayerIndices.player2, teamBTeam.players);

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
    var redInfo1 = getPlayerInfo(teamATeam.players, redPlayerIndices.player1);
    teamAPlayer1 = createSpriteForPlayer(redInfo1, 18, 7, "e", gameState.teamColors.teamA, !allCPUMode, BG_RED);
    spriteRegistry.register(spriteRegistry.IDS.TEAM_A_PLAYER_1, teamAPlayer1);
    var teamAPlayer1Data = new Player(
        redInfo1.name,
        redInfo1.jersey,
        redInfo1.attributes,
        teamAPlayer1,
        redInfo1.shortNick
    );
    teamAPlayer1Data.team = "teamA";
    teamAPlayer1Data.skin = redInfo1.skin || "brown";
    teamAPlayer1Data.jerseyString = redInfo1.jerseyString !== undefined ? String(redInfo1.jerseyString) : String(teamAPlayer1Data.jersey);
    teamAPlayer1Data.position = (redInfo1.position || "").toUpperCase();
    teamAPlayer1Data.hasDribble = true;
    applyShoePaletteToPlayer(teamAPlayer1);

    var redInfo2 = getPlayerInfo(teamATeam.players, redPlayerIndices.player2);
    teamAPlayer2 = createSpriteForPlayer(redInfo2, 18, 12, "e", gameState.teamColors.teamA, false, BG_RED);
    spriteRegistry.register(spriteRegistry.IDS.TEAM_A_PLAYER_2, teamAPlayer2);
    var teamAPlayer2Data = new Player(
        redInfo2.name,
        redInfo2.jersey,
        redInfo2.attributes,
        teamAPlayer2,
        redInfo2.shortNick
    );
    teamAPlayer2Data.team = "teamA";
    teamAPlayer2Data.skin = redInfo2.skin || "brown";
    teamAPlayer2Data.jerseyString = redInfo2.jerseyString !== undefined ? String(redInfo2.jerseyString) : String(teamAPlayer2Data.jersey);
    teamAPlayer2Data.position = (redInfo2.position || "").toUpperCase();
    teamAPlayer2Data.hasDribble = true;
    applyShoePaletteToPlayer(teamAPlayer2);

    // Create BLUE TEAM (right side)
    var blueInfo1 = getPlayerInfo(teamBTeam.players, bluePlayerIndices.player1);
    teamBPlayer1 = createSpriteForPlayer(blueInfo1, 58, 7, "w", gameState.teamColors.teamB, false, BG_BLUE);
    spriteRegistry.register(spriteRegistry.IDS.TEAM_B_PLAYER_1, teamBPlayer1);
    var teamBPlayer1Data = new Player(
        blueInfo1.name,
        blueInfo1.jersey,
        blueInfo1.attributes,
        teamBPlayer1,
        blueInfo1.shortNick
    );
    teamBPlayer1Data.team = "teamB";
    teamBPlayer1Data.skin = blueInfo1.skin || "brown";
    teamBPlayer1Data.jerseyString = blueInfo1.jerseyString !== undefined ? String(blueInfo1.jerseyString) : String(teamBPlayer1Data.jersey);
    teamBPlayer1Data.position = (blueInfo1.position || "").toUpperCase();
    teamBPlayer1Data.hasDribble = true;
    applyShoePaletteToPlayer(teamBPlayer1);

    var blueInfo2 = getPlayerInfo(teamBTeam.players, bluePlayerIndices.player2);
    teamBPlayer2 = createSpriteForPlayer(blueInfo2, 58, 12, "w", gameState.teamColors.teamB, false, BG_BLUE);
    spriteRegistry.register(spriteRegistry.IDS.TEAM_B_PLAYER_2, teamBPlayer2);
    var teamBPlayer2Data = new Player(
        blueInfo2.name,
        blueInfo2.jersey,
        blueInfo2.attributes,
        teamBPlayer2,
        blueInfo2.shortNick
    );
    teamBPlayer2Data.team = "teamB";
    teamBPlayer2Data.skin = blueInfo2.skin || "brown";
    teamBPlayer2Data.jerseyString = blueInfo2.jerseyString !== undefined ? String(blueInfo2.jerseyString) : String(teamBPlayer2Data.jersey);
    teamBPlayer2Data.position = (blueInfo2.position || "").toUpperCase();
    teamBPlayer2Data.hasDribble = true;
    applyShoePaletteToPlayer(teamBPlayer2);

    applyDefaultControllerLabels();

    ensureBallFrame();

    // Red team starts with ball - player 1 has it
    gameState.ballCarrier = teamAPlayer1;
    gameState.currentTeam = "teamA";
    if (teamAPlayer1.playerData) teamAPlayer1.playerData.hasDribble = true;
    if (teamAPlayer2.playerData) teamAPlayer2.playerData.hasDribble = true;
    if (teamBPlayer1.playerData) teamBPlayer1.playerData.hasDribble = true;
    if (teamBPlayer2.playerData) teamBPlayer2.playerData.hasDribble = true;

    gameState.firstHalfStartTeam = gameState.currentTeam;
    gameState.secondHalfInitDone = false;
    gameState.pendingSecondHalfInbound = false;
}
