/**
 * NBA JAM - Sprite Initialization
 * 
 * Handles creation and initialization of player sprites for both teams
 */

// Skins that are custom streetball sprites and should NOT have jersey masks applied
var NO_JERSEY_SKINS = ["barney", "shrek", "airbud", "sonic", "donatello", "satan", "iceman"];

function initSprites(teamATeamName, teamBTeamName, redPlayerIndices, bluePlayerIndices, allCPUMode, systems) {
    var stateManager = systems.stateManager;

    // Get team rosters
    teamATeamName = teamATeamName || "lakers";
    teamBTeamName = teamBTeamName || "celtics";
    allCPUMode = allCPUMode || false;
    stateManager.set("allCPUMode", allCPUMode, "init_sprites");

    var teamATeam = NBATeams[teamATeamName];
    var teamBTeam = NBATeams[teamBTeamName];

    // Set team names and colors in game state
    var teamNames = stateManager.get('teamNames') || {};
    teamNames.teamA = teamATeam.name || teamATeamName;
    teamNames.teamB = teamBTeam.name || teamBTeamName;
    stateManager.set("teamNames", teamNames, "init_sprites");

    var teamAbbrs = stateManager.get('teamAbbrs') || {};
    teamAbbrs.teamA = (teamATeam && teamATeam.abbr) ? String(teamATeam.abbr).toUpperCase() : teamATeamName.substring(0, 3).toUpperCase();
    teamAbbrs.teamB = (teamBTeam && teamBTeam.abbr) ? String(teamBTeam.abbr).toUpperCase() : teamBTeamName.substring(0, 3).toUpperCase();
    stateManager.set("teamAbbrs", teamAbbrs, "init_sprites");

    // Set team colors (convert string names to actual color constants)
    var teamColors = stateManager.get('teamColors') || {};
    if (teamATeam.colors) {
        var redFgName = teamATeam.colors.fg || "WHITE";
        var redFgAccentName = teamATeam.colors.fg_accent || redFgName;
        var redAltFgName = teamATeam.colors.alt_fg || null;
        var redAltBgName = teamATeam.colors.alt_bg || null;
        teamColors.teamA = {
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
        debugLog("[SPRITE INIT] teamA colors: fg=" + teamColors.teamA.fg + " (from '" + teamATeam.colors.fg + "'), bg=" + teamColors.teamA.bg + " (from '" + teamATeam.colors.bg + "')");
    } else {
        debugLog("[SPRITE INIT] teamA has NO colors defined in rosters.ini!");
    }
    if (teamBTeam.colors) {
        var blueFgName = teamBTeam.colors.fg || "WHITE";
        var blueFgAccentName = teamBTeam.colors.fg_accent || blueFgName;
        var blueAltFgName = teamBTeam.colors.alt_fg || null;
        var blueAltBgName = teamBTeam.colors.alt_bg || null;
        teamColors.teamB = {
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
        debugLog("[SPRITE INIT] teamB colors: fg=" + teamColors.teamB.fg + " (from '" + teamBTeam.colors.fg + "'), bg=" + teamColors.teamB.bg + " (from '" + teamBTeam.colors.bg + "')");
    } else {
        debugLog("[SPRITE INIT] teamB has NO colors defined in rosters.ini!");
    }
    stateManager.set("teamColors", teamColors, "init_sprites");

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
        
        // Check if this skin should skip jersey application (custom streetball sprites)
        var skinName = playerInfo.skin ? String(playerInfo.skin).toLowerCase() : "";
        var skipJersey = NO_JERSEY_SKINS.indexOf(skinName) !== -1;

        if (!usingCustomSprite && !skipJersey) {
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
    var teamColors = stateManager.get('teamColors'); // Get latest after color updates
    var redInfo1 = getPlayerInfo(teamATeam.players, redPlayerIndices.player1);
    teamAPlayer1 = createSpriteForPlayer(redInfo1, 18, 7, "e", teamColors.teamA, !allCPUMode, BG_RED);
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
    teamAPlayer2 = createSpriteForPlayer(redInfo2, 18, 12, "e", teamColors.teamA, false, BG_RED);
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
    teamBPlayer1 = createSpriteForPlayer(blueInfo1, 58, 7, "w", teamColors.teamB, false, BG_BLUE);
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
    teamBPlayer2 = createSpriteForPlayer(blueInfo2, 58, 12, "w", teamColors.teamB, false, BG_BLUE);
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

    stateManager.set("ballCarrier", null, "init_sprites");
    stateManager.set("currentTeam", null, "init_sprites");
    if (teamAPlayer1.playerData) teamAPlayer1.playerData.hasDribble = true;
    if (teamAPlayer2.playerData) teamAPlayer2.playerData.hasDribble = true;
    if (teamBPlayer1.playerData) teamBPlayer1.playerData.hasDribble = true;
    if (teamBPlayer2.playerData) teamBPlayer2.playerData.hasDribble = true;

    stateManager.set("firstHalfStartTeam", null, "init_sprites");
    stateManager.set("secondHalfInitDone", false, "init_sprites");
    stateManager.set("pendingSecondHalfInbound", false, "init_sprites");

    // Initialize substitution system - populate bench from full roster
    var teamABench = [];
    var teamBBench = [];
    
    // Build bench arrays with all players NOT currently active
    // teamA bench: all players in roster except active indices
    if (teamATeam && teamATeam.players) {
        for (var i = 0; i < teamATeam.players.length; i++) {
            if (i !== redPlayerIndices.player1 && i !== redPlayerIndices.player2) {
                teamABench.push({
                    rosterIndex: i,
                    playerInfo: teamATeam.players[i],
                    inGame: false  // Not currently on court
                });
            }
        }
    }
    
    // teamB bench: all players in roster except active indices
    if (teamBTeam && teamBTeam.players) {
        for (var j = 0; j < teamBTeam.players.length; j++) {
            if (j !== bluePlayerIndices.player1 && j !== bluePlayerIndices.player2) {
                teamBBench.push({
                    rosterIndex: j,
                    playerInfo: teamBTeam.players[j],
                    inGame: false
                });
            }
        }
    }
    
    stateManager.set("availablePlayers", {
        teamA: teamABench,
        teamB: teamBBench
    }, "init_sprites_bench");
    
    stateManager.set("activePlayerIndices", {
        teamA: [redPlayerIndices.player1, redPlayerIndices.player2],
        teamB: [bluePlayerIndices.player1, bluePlayerIndices.player2]
    }, "init_sprites_active");
    
    debugLog("[SPRITE-INIT] Substitution bench initialized: teamA=" + teamABench.length + " available, teamB=" + teamBBench.length + " available");
}

/**
 * Initialize sprites from dynamic team definitions (for LORB/external games)
 * 
 * This bypasses NBATeams lookup and creates sprites directly from provided definitions.
 * Used by runExternalGame() to support dynamically generated players.
 * 
 * @param {Object} teamADef - Team A definition { name, abbr, players[], colors }
 * @param {Object} teamBDef - Team B definition { name, abbr, players[], colors }
 * @param {Object} options - Game options { mode, humanTeam, humanPlayerIndex }
 * @param {Object} systems - Game systems
 */
function initSpritesFromDynamic(teamADef, teamBDef, options, systems) {
    var stateManager = systems.stateManager;
    var allCPUMode = (options.mode === "spectate");
    
    stateManager.set("allCPUMode", allCPUMode, "init_sprites_dynamic");
    
    // Set team names
    var teamNames = stateManager.get('teamNames') || {};
    teamNames.teamA = teamADef.name || "Street Team A";
    teamNames.teamB = teamBDef.name || "Street Team B";
    stateManager.set("teamNames", teamNames, "init_sprites_dynamic");
    
    // Set team abbreviations
    var teamAbbrs = stateManager.get('teamAbbrs') || {};
    teamAbbrs.teamA = teamADef.abbr || teamADef.name.substring(0, 4).toUpperCase();
    teamAbbrs.teamB = teamBDef.abbr || teamBDef.name.substring(0, 4).toUpperCase();
    stateManager.set("teamAbbrs", teamAbbrs, "init_sprites_dynamic");
    
    // Set team colors (use provided or defaults)
    var teamColors = stateManager.get('teamColors') || {};
    
    if (teamADef.colors) {
        teamColors.teamA = resolveTeamColors(teamADef.colors, "RED");
    } else {
        teamColors.teamA = {
            fg: WHITE,
            bg: BG_RED,
            fg_accent: WHITE,
            bg_alt: BG_RED,
            fg_code: "\1h\1w",
            fg_accent_code: "\1h\1w"
        };
    }
    
    if (teamBDef.colors) {
        teamColors.teamB = resolveTeamColors(teamBDef.colors, "BLUE");
    } else {
        teamColors.teamB = {
            fg: WHITE,
            bg: BG_BLUE,
            fg_accent: WHITE,
            bg_alt: BG_BLUE,
            fg_code: "\1h\1w",
            fg_accent_code: "\1h\1w"
        };
    }
    
    stateManager.set("teamColors", teamColors, "init_sprites_dynamic");
    
    resetShoePaletteAssignments();
    
    // Helper to determine if a player slot is human-controlled
    function isHumanSlot(team, playerIndex) {
        if (allCPUMode) return false;
        if (options.humanTeam !== team) return false;
        return options.humanPlayerIndex === playerIndex;
    }
    
    // Reuse helper functions from initSprites
    function sanitizeAccentColor(color) {
        if (color === undefined || color === null) return WHITE;
        var masked = color & 0x8F;
        if (masked === 0) return WHITE;
        return masked;
    }
    
    function resolveJerseyBackground(tc, fallback) {
        if (tc && typeof tc.bg_alt === "number") return tc.bg_alt;
        if (tc && typeof tc.bg === "number") return tc.bg;
        return fallback;
    }
    
    function createSpriteForDynamicPlayer(playerInfo, startX, startY, bearing, tc, isHuman, fallbackBg) {
        var usingCustomSprite = !!(playerInfo && playerInfo.customSprite);
        var spriteBase = usingCustomSprite
            ? playerInfo.customSprite
            : resolveSpriteBaseBySkin(playerInfo.skin);
        
        debugLog("[SPRITE-INIT] createSpriteForDynamicPlayer: name=" + (playerInfo ? playerInfo.name : "null") +
            ", skin=" + (playerInfo ? playerInfo.skin : "null") +
            ", spriteBase=" + spriteBase +
            ", isHuman=" + isHuman);
        
        var sprite = new Sprite.Aerial(
            spriteBase,
            courtFrame,
            startX,
            startY,
            bearing,
            "normal"
        );
        
        var shoePalette = null;
        
        // Check if this skin should skip jersey application (custom streetball sprites)
        var skinName = playerInfo.skin ? String(playerInfo.skin).toLowerCase() : "";
        var skipJersey = NO_JERSEY_SKINS.indexOf(skinName) !== -1;
        
        if (!usingCustomSprite && !skipJersey) {
            var jerseyBgColor = resolveJerseyBackground(tc, fallbackBg);
            var accentColor = sanitizeAccentColor(tc && tc.fg_accent);
            shoePalette = assignShoePalette(tc);
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
            sprite.__jerseyConfig = jerseyConfig;
        } else {
            sprite.assignedShoePalette = null;
        }
        
        scrubSpriteTransparency(sprite);
        sprite.moveTo(startX, startY);
        sprite.frame.open();
        sprite.isHuman = !!isHuman;
        sprite.initialShoeColor = shoePalette ? shoePalette.high : null;
        
        mergeShovedBearingsIntoSprite(sprite);
        
        return sprite;
    }
    
    // Create Team A sprites
    var redInfo1 = teamADef.players[0];
    if (typeof debugLog === "function") {
        debugLog("[SPRITE-INIT] Team A Player 1: name=" + (redInfo1 ? redInfo1.name : "null") + ", skin=" + (redInfo1 ? redInfo1.skin : "null"));
    }
    teamAPlayer1 = createSpriteForDynamicPlayer(redInfo1, 18, 7, "e", teamColors.teamA, isHumanSlot("teamA", 0), BG_RED);
    spriteRegistry.register(spriteRegistry.IDS.TEAM_A_PLAYER_1, teamAPlayer1);
    var teamAPlayer1Data = new Player(redInfo1.name, redInfo1.jersey, redInfo1.attributes, teamAPlayer1, redInfo1.shortNick);
    teamAPlayer1Data.team = "teamA";
    teamAPlayer1Data.skin = redInfo1.skin || "brown";
    teamAPlayer1Data.jerseyString = redInfo1.jerseyString !== undefined ? String(redInfo1.jerseyString) : String(teamAPlayer1Data.jersey);
    teamAPlayer1Data.position = (redInfo1.position || "").toUpperCase();
    teamAPlayer1Data.hasDribble = true;
    teamAPlayer1Data.lorbId = redInfo1.lorbId || null;
    teamAPlayer1Data.lorbData = redInfo1.lorbData || null;
    applyShoePaletteToPlayer(teamAPlayer1);
    
    var redInfo2 = teamADef.players[1];
    if (typeof debugLog === "function") {
        debugLog("[SPRITE-INIT] Team A Player 2: name=" + (redInfo2 ? redInfo2.name : "null") + ", skin=" + (redInfo2 ? redInfo2.skin : "null"));
    }
    teamAPlayer2 = createSpriteForDynamicPlayer(redInfo2, 18, 12, "e", teamColors.teamA, isHumanSlot("teamA", 1), BG_RED);
    spriteRegistry.register(spriteRegistry.IDS.TEAM_A_PLAYER_2, teamAPlayer2);
    var teamAPlayer2Data = new Player(redInfo2.name, redInfo2.jersey, redInfo2.attributes, teamAPlayer2, redInfo2.shortNick);
    teamAPlayer2Data.team = "teamA";
    teamAPlayer2Data.skin = redInfo2.skin || "brown";
    teamAPlayer2Data.jerseyString = redInfo2.jerseyString !== undefined ? String(redInfo2.jerseyString) : String(teamAPlayer2Data.jersey);
    teamAPlayer2Data.position = (redInfo2.position || "").toUpperCase();
    teamAPlayer2Data.hasDribble = true;
    teamAPlayer2Data.lorbId = redInfo2.lorbId || null;
    teamAPlayer2Data.lorbData = redInfo2.lorbData || null;
    applyShoePaletteToPlayer(teamAPlayer2);
    
    // Create Team B sprites
    var blueInfo1 = teamBDef.players[0];
    if (typeof debugLog === "function") {
        debugLog("[SPRITE-INIT] Team B Player 1: name=" + (blueInfo1 ? blueInfo1.name : "null") + ", skin=" + (blueInfo1 ? blueInfo1.skin : "null"));
    }
    teamBPlayer1 = createSpriteForDynamicPlayer(blueInfo1, 58, 7, "w", teamColors.teamB, isHumanSlot("teamB", 0), BG_BLUE);
    spriteRegistry.register(spriteRegistry.IDS.TEAM_B_PLAYER_1, teamBPlayer1);
    var teamBPlayer1Data = new Player(blueInfo1.name, blueInfo1.jersey, blueInfo1.attributes, teamBPlayer1, blueInfo1.shortNick);
    teamBPlayer1Data.team = "teamB";
    teamBPlayer1Data.skin = blueInfo1.skin || "brown";
    teamBPlayer1Data.jerseyString = blueInfo1.jerseyString !== undefined ? String(blueInfo1.jerseyString) : String(teamBPlayer1Data.jersey);
    teamBPlayer1Data.position = (blueInfo1.position || "").toUpperCase();
    teamBPlayer1Data.hasDribble = true;
    teamBPlayer1Data.lorbId = blueInfo1.lorbId || null;
    teamBPlayer1Data.lorbData = blueInfo1.lorbData || null;
    applyShoePaletteToPlayer(teamBPlayer1);
    
    var blueInfo2 = teamBDef.players[1];
    if (typeof debugLog === "function") {
        debugLog("[SPRITE-INIT] Team B Player 2: name=" + (blueInfo2 ? blueInfo2.name : "null") + ", skin=" + (blueInfo2 ? blueInfo2.skin : "null"));
    }
    teamBPlayer2 = createSpriteForDynamicPlayer(blueInfo2, 58, 12, "w", teamColors.teamB, isHumanSlot("teamB", 1), BG_BLUE);
    spriteRegistry.register(spriteRegistry.IDS.TEAM_B_PLAYER_2, teamBPlayer2);
    var teamBPlayer2Data = new Player(blueInfo2.name, blueInfo2.jersey, blueInfo2.attributes, teamBPlayer2, blueInfo2.shortNick);
    teamBPlayer2Data.team = "teamB";
    teamBPlayer2Data.skin = blueInfo2.skin || "brown";
    teamBPlayer2Data.jerseyString = blueInfo2.jerseyString !== undefined ? String(blueInfo2.jerseyString) : String(teamBPlayer2Data.jersey);
    teamBPlayer2Data.position = (blueInfo2.position || "").toUpperCase();
    teamBPlayer2Data.hasDribble = true;
    teamBPlayer2Data.lorbId = blueInfo2.lorbId || null;
    teamBPlayer2Data.lorbData = blueInfo2.lorbData || null;
    applyShoePaletteToPlayer(teamBPlayer2);
    
    applyDefaultControllerLabels();
    ensureBallFrame();
    
    stateManager.set("ballCarrier", null, "init_sprites_dynamic");
    stateManager.set("currentTeam", null, "init_sprites_dynamic");
    
    if (teamAPlayer1.playerData) teamAPlayer1.playerData.hasDribble = true;
    if (teamAPlayer2.playerData) teamAPlayer2.playerData.hasDribble = true;
    if (teamBPlayer1.playerData) teamBPlayer1.playerData.hasDribble = true;
    if (teamBPlayer2.playerData) teamBPlayer2.playerData.hasDribble = true;
    
    // Apply buffs if configured (for boss battles, special modes, etc.)
    if (typeof debugLog === "function") {
        debugLog("[SPRITE-INIT] Checking for buffs - blueInfo1=" + (blueInfo1 ? blueInfo1.name : "null") + 
                 " hasBuffs=" + !!(blueInfo1 && blueInfo1.buffs));
        debugLog("[SPRITE-INIT] Checking for buffs - blueInfo2=" + (blueInfo2 ? blueInfo2.name : "null") + 
                 " hasBuffs=" + !!(blueInfo2 && blueInfo2.buffs));
        if (blueInfo1 && blueInfo1.buffs) {
            debugLog("[SPRITE-INIT] blueInfo1.buffs = " + JSON.stringify(blueInfo1.buffs));
        }
        if (blueInfo2 && blueInfo2.buffs) {
            debugLog("[SPRITE-INIT] blueInfo2.buffs = " + JSON.stringify(blueInfo2.buffs));
        }
        debugLog("[SPRITE-INIT] BuffSystem available = " + (typeof BuffSystem !== "undefined"));
    }
    if (typeof BuffSystem !== "undefined" && BuffSystem.applyBuffs) {
        if (redInfo1 && redInfo1.buffs) {
            BuffSystem.applyBuffs(teamAPlayer1, redInfo1.buffs);
        }
        if (redInfo2 && redInfo2.buffs) {
            BuffSystem.applyBuffs(teamAPlayer2, redInfo2.buffs);
        }
        if (blueInfo1 && blueInfo1.buffs) {
            BuffSystem.applyBuffs(teamBPlayer1, blueInfo1.buffs);
        }
        if (blueInfo2 && blueInfo2.buffs) {
            BuffSystem.applyBuffs(teamBPlayer2, blueInfo2.buffs);
        }
    }
    
    stateManager.set("firstHalfStartTeam", null, "init_sprites_dynamic");
    stateManager.set("secondHalfInitDone", false, "init_sprites_dynamic");
    stateManager.set("pendingSecondHalfInbound", false, "init_sprites_dynamic");

    // Initialize substitution system for dynamic/LORB games
    // For LORB: bench comes from lorbContext.crew (minus the active teammate)
    // For other dynamic games: bench is empty (only 2 players provided)
    var teamABench = [];
    var teamBBench = [];
    
    // Check for LORB context with crew
    // lorbContext may be passed directly OR nested under lorbContext.playerCtx
    var lorbContext = options.lorbContext || null;
    var crewData = null;
    var contactsData = null;
    
    // Debug: Log what we received
    if (lorbContext) {
        var lorbKeys = [];
        for (var lk in lorbContext) {
            if (lorbContext.hasOwnProperty(lk)) lorbKeys.push(lk);
        }
        debugLog("[SPRITE-INIT] lorbContext keys: " + lorbKeys.join(", "));
        
        if (lorbContext.playerCtx) {
            var ctxKeys = [];
            for (var ck in lorbContext.playerCtx) {
                if (lorbContext.playerCtx.hasOwnProperty(ck)) ctxKeys.push(ck);
            }
            debugLog("[SPRITE-INIT] lorbContext.playerCtx keys: " + ctxKeys.join(", "));
            debugLog("[SPRITE-INIT] playerCtx.crew exists: " + !!(lorbContext.playerCtx.crew));
            debugLog("[SPRITE-INIT] playerCtx.contacts exists: " + !!(lorbContext.playerCtx.contacts));
            if (lorbContext.playerCtx.crew) {
                debugLog("[SPRITE-INIT] playerCtx.crew.length: " + lorbContext.playerCtx.crew.length);
            }
        }
    } else {
        debugLog("[SPRITE-INIT] lorbContext is null/undefined");
    }
    
    // Check for crew/contacts in playerCtx first (how LORB passes it via nba_jam_adapter)
    // Prefer hydratedCrew if available (pre-hydrated by LORB code)
    if (lorbContext && lorbContext.hydratedCrew && Array.isArray(lorbContext.hydratedCrew) && lorbContext.hydratedCrew.length > 0) {
        // Use pre-hydrated crew - these contacts already have name, skin, jersey, etc.
        crewData = lorbContext.hydratedCrew;
        contactsData = lorbContext.hydratedCrew;  // Use same array for lookups
        debugLog("[SPRITE-INIT] Using pre-hydrated crew: " + crewData.length + " members");
    } else if (lorbContext && lorbContext.playerCtx && lorbContext.playerCtx.crew) {
        crewData = lorbContext.playerCtx.crew;
        contactsData = lorbContext.playerCtx.contacts || [];
        debugLog("[SPRITE-INIT] Found LORB crew in playerCtx: " + crewData.length + " members, " + contactsData.length + " contacts");
    } else if (lorbContext && lorbContext.crew && Array.isArray(lorbContext.crew)) {
        // Fallback: directly on lorbContext
        crewData = lorbContext.crew;
        contactsData = lorbContext.contacts || [];
        debugLog("[SPRITE-INIT] Found LORB crew directly on lorbContext: " + crewData.length + " members");
    }
    
    if (crewData && Array.isArray(crewData)) {
        // Get the active teammate's lorbId to exclude from bench
        var activeTeammateLorbId = null;
        if (redInfo2 && redInfo2.lorbId) {
            activeTeammateLorbId = redInfo2.lorbId;
        }
        
        debugLog("[SPRITE-INIT] Active teammate lorbId to exclude: " + activeTeammateLorbId);
        
        // Build bench from crew members who aren't the active teammate
        // Note: Player 1 is always the human player (not substitutable in single-player)
        for (var k = 0; k < crewData.length; k++) {
            var crewMember = crewData[k];
            var crewContact = null;
            
            // crew entries can be { contactId: id } or full contact objects
            if (crewMember.contactId && contactsData) {
                // Look up contact by ID
                for (var m = 0; m < contactsData.length; m++) {
                    if (contactsData[m].id === crewMember.contactId) {
                        crewContact = contactsData[m];
                        break;
                    }
                }
            } else if (crewMember.id) {
                crewContact = crewMember;  // Already a contact object
            }
            
            if (crewContact && crewContact.id !== activeTeammateLorbId) {
                // This crew member is on the bench
                teamABench.push({
                    contactId: crewContact.id,
                    playerInfo: {
                        name: crewContact.name || "Crew Member",
                        jersey: crewContact.jersey || Math.floor(Math.random() * 99),
                        jerseyString: crewContact.jerseyString || String(crewContact.jersey || 0),
                        skin: crewContact.skin || "brown",
                        shortNick: crewContact.shortNick || null,
                        position: crewContact.position || "",
                        attributes: crewContact.attributes || [6, 6, 6, 6, 6, 6],
                        customSprite: crewContact.customSprite || null,
                        lorbId: crewContact.id,
                        lorbData: crewContact
                    },
                    inGame: false
                });
            }
        }
    }
    
    // TeamB (opponent) typically doesn't have substitutes in LORB
    // For future multiplayer: could populate from opponent's crew context
    
    stateManager.set("availablePlayers", {
        teamA: teamABench,
        teamB: teamBBench
    }, "init_sprites_dynamic_bench");
    
    stateManager.set("activePlayerIndices", {
        teamA: [0, 1],  // Dynamic games always use indices 0,1
        teamB: [0, 1]
    }, "init_sprites_dynamic_active");
    
    if (typeof debugLog === "function") {
        debugLog("[SPRITE-INIT] Dynamic substitution bench initialized: teamA=" + teamABench.length + " available");
    }
}

/**
 * Helper to resolve team colors from config
 */
function resolveTeamColors(colorsDef, fallbackName) {
    var fg = colorsDef.fg ? getColorValue(colorsDef.fg) : WHITE;
    var bg = colorsDef.bg ? getColorValue(colorsDef.bg) : (fallbackName === "RED" ? BG_RED : BG_BLUE);
    var fgAccent = colorsDef.fg_accent ? getColorValue(colorsDef.fg_accent) : fg;
    var bgAlt = colorsDef.bg_alt ? getColorValue(colorsDef.bg_alt) : bg;
    
    var fgName = colorsDef.fg || "WHITE";
    var fgAccentName = colorsDef.fg_accent || fgName;
    
    return {
        fg: fg,
        bg: bg,
        fg_accent: fgAccent,
        bg_alt: bgAlt,
        fg_code: getColorCode(fgName),
        fg_accent_code: getColorCode(fgAccentName)
    };
}
/**
 * Perform a player substitution at halftime
 * 
 * Swaps an active player with a bench player, creating new sprite and preserving game stats.
 * 
 * @param {string} teamKey - "teamA" or "teamB"
 * @param {number} activeSlot - Which active slot to substitute (0 or 1)
 * @param {number} benchIndex - Index into availablePlayers[teamKey] array
 * @param {Object} systems - Game systems
 * @returns {Object} - { success: boolean, message: string, newPlayer: Object|null }
 */
function performSubstitution(teamKey, activeSlot, benchIndex, systems) {
    var stateManager = systems.stateManager;
    
    // Validate parameters
    if (teamKey !== "teamA" && teamKey !== "teamB") {
        return { success: false, message: "Invalid team key", newPlayer: null };
    }
    if (activeSlot !== 0 && activeSlot !== 1) {
        return { success: false, message: "Invalid active slot", newPlayer: null };
    }
    
    // Get current bench and validate index
    var availablePlayers = stateManager.get("availablePlayers") || { teamA: [], teamB: [] };
    var bench = availablePlayers[teamKey] || [];
    
    if (benchIndex < 0 || benchIndex >= bench.length) {
        return { success: false, message: "Invalid bench index", newPlayer: null };
    }
    
    var benchEntry = bench[benchIndex];
    if (benchEntry.inGame) {
        return { success: false, message: "Player already in game", newPlayer: null };
    }
    
    // Get current active sprite
    var spriteId = teamKey === "teamA" 
        ? (activeSlot === 0 ? spriteRegistry.IDS.TEAM_A_PLAYER_1 : spriteRegistry.IDS.TEAM_A_PLAYER_2)
        : (activeSlot === 0 ? spriteRegistry.IDS.TEAM_B_PLAYER_1 : spriteRegistry.IDS.TEAM_B_PLAYER_2);
    
    var currentSprite = spriteRegistry.get(spriteId);
    if (!currentSprite) {
        return { success: false, message: "Cannot find active player sprite", newPlayer: null };
    }
    
    // Save current player's stats and state to bench
    var currentPlayerData = currentSprite.playerData || {};
    var currentStats = currentPlayerData.stats ? JSON.parse(JSON.stringify(currentPlayerData.stats)) : {};
    var currentTurbo = currentPlayerData.turbo || 0;
    
    // Add the leaving player to bench
    var leavingPlayer = {
        rosterIndex: null,  // Will be set below if arcade mode
        contactId: currentPlayerData.lorbId || null,
        playerInfo: {
            name: currentPlayerData.name || "Player",
            jersey: currentPlayerData.jersey || 0,
            jerseyString: currentPlayerData.jerseyString || "0",
            skin: currentPlayerData.skin || "brown",
            shortNick: currentPlayerData.shortNick || null,
            position: currentPlayerData.position || "",
            attributes: currentPlayerData.attributes || [6, 6, 6, 6, 6, 6],
            customSprite: null,
            lorbId: currentPlayerData.lorbId || null,
            lorbData: currentPlayerData.lorbData || null
        },
        savedStats: currentStats,
        savedTurbo: currentTurbo,
        inGame: false
    };
    
    // Get team colors for sprite creation
    var teamColors = stateManager.get("teamColors") || {};
    var tc = teamColors[teamKey] || {};
    
    // Get the new player's info
    var newPlayerInfo = benchEntry.playerInfo;
    
    // Determine position and bearing based on team and slot
    var startX, startY, bearing, fallbackBg;
    if (teamKey === "teamA") {
        startX = 18;
        startY = activeSlot === 0 ? 7 : 12;
        bearing = "e";
        fallbackBg = BG_RED;
    } else {
        startX = 58;
        startY = activeSlot === 0 ? 7 : 12;
        bearing = "w";
        fallbackBg = BG_BLUE;
    }
    
    // Remove old sprite from court
    if (currentSprite.frame && typeof currentSprite.frame.close === "function") {
        currentSprite.frame.close();
    }
    
    // Create new sprite using the existing helper pattern
    var usingCustomSprite = !!(newPlayerInfo && newPlayerInfo.customSprite);
    var skinName = newPlayerInfo.skin ? String(newPlayerInfo.skin).toLowerCase() : "";
    var spriteBase = usingCustomSprite
        ? newPlayerInfo.customSprite
        : resolveSpriteBaseBySkin(newPlayerInfo.skin);
    
    var newSprite = new Sprite.Aerial(
        spriteBase,
        courtFrame,
        startX,
        startY,
        bearing,
        "normal"
    );
    
    // Apply jersey mask if needed (not for streetball characters)
    var skipJersey = NO_JERSEY_SKINS.indexOf(skinName) !== -1;
    
    // Debug: Log all relevant values
    log(LOG_DEBUG, "[SUBSTITUTION] Jersey mask check: usingCustom=" + usingCustomSprite + 
             ", skinName='" + skinName + "', skipJersey=" + skipJersey);
    log(LOG_DEBUG, "[SUBSTITUTION] teamColors from state: " + JSON.stringify(teamColors));
    log(LOG_DEBUG, "[SUBSTITUTION] tc for " + teamKey + ": bg=" + tc.bg + ", bg_alt=" + tc.bg_alt + ", fallbackBg=" + fallbackBg);
    log(LOG_DEBUG, "[SUBSTITUTION] newPlayerInfo: jersey=" + newPlayerInfo.jersey + ", jerseyString=" + newPlayerInfo.jerseyString);
    
    if (!usingCustomSprite && !skipJersey) {
        var jerseyBgColor = tc.bg_alt || tc.bg || fallbackBg;
        var accentColor = tc.fg_accent || WHITE;
        var shoePalette = assignShoePalette(tc);
        newSprite.assignedShoePalette = shoePalette ? cloneShoePalette(shoePalette) : null;
        
        var jerseyDigits = newPlayerInfo.jerseyString || String(newPlayerInfo.jersey || 0);
        
        var jerseyConfig = {
            bgColor: jerseyBgColor,
            accentColor: accentColor,
            jerseyDigits: jerseyDigits,
            shoePalette: shoePalette
        };
        log(LOG_DEBUG, "[SUBSTITUTION] Final jersey config: bgColor=" + jerseyBgColor + 
                 ", accentColor=" + accentColor + ", digits='" + jerseyDigits + "'");
        applyUniformMask(newSprite, jerseyConfig);
        newSprite.__jerseyConfig = jerseyConfig;
    }
    
    scrubSpriteTransparency(newSprite);
    newSprite.moveTo(startX, startY);
    newSprite.frame.open();
    newSprite.isHuman = currentSprite.isHuman;  // Preserve human control status
    
    // Merge shoved bearings
    mergeShovedBearingsIntoSprite(newSprite);
    
    // Create playerData for new sprite
    var newPlayerData = new Player(
        newPlayerInfo.name,
        newPlayerInfo.jersey || 0,
        newPlayerInfo.attributes || [6, 6, 6, 6, 6, 6],
        newSprite,
        newPlayerInfo.shortNick
    );
    newPlayerData.team = teamKey;
    newPlayerData.skin = newPlayerInfo.skin || "brown";
    newPlayerData.jerseyString = newPlayerInfo.jerseyString || String(newPlayerInfo.jersey || 0);
    newPlayerData.position = (newPlayerInfo.position || "").toUpperCase();
    newPlayerData.hasDribble = true;
    newPlayerData.lorbId = newPlayerInfo.lorbId || null;
    newPlayerData.lorbData = newPlayerInfo.lorbData || null;
    
    // Fresh player gets restored turbo
    var turboThreshold = (typeof TIMING_CONSTANTS !== "undefined" && TIMING_CONSTANTS.SUBSTITUTION)
        ? TIMING_CONSTANTS.SUBSTITUTION.FRESH_PLAYER_TURBO_PERCENT
        : 0.9;
    var maxTurbo = (typeof TIMING_CONSTANTS !== "undefined" && TIMING_CONSTANTS.TURBO)
        ? TIMING_CONSTANTS.TURBO.MAX
        : 150;
    newPlayerData.turbo = Math.floor(maxTurbo * turboThreshold);
    
    // Register new sprite
    spriteRegistry.register(spriteId, newSprite);
    
    // Update global references (legacy compatibility)
    if (teamKey === "teamA") {
        if (activeSlot === 0) {
            teamAPlayer1 = newSprite;
        } else {
            teamAPlayer2 = newSprite;
        }
    } else {
        if (activeSlot === 0) {
            teamBPlayer1 = newSprite;
        } else {
            teamBPlayer2 = newSprite;
        }
    }
    
    // Update availablePlayers: mark entering player as inGame, add leaving player to bench
    benchEntry.inGame = true;
    bench.push(leavingPlayer);
    
    // Update state
    stateManager.set("availablePlayers", availablePlayers, "substitution_complete");
    
    debugLog("[SUBSTITUTION] " + teamKey + " slot " + activeSlot + ": " + 
             (currentPlayerData.name || "Unknown") + " OUT, " + 
             (newPlayerInfo.name || "Unknown") + " IN (turbo: " + newPlayerData.turbo + ")");
    
    return {
        success: true,
        message: "Substitution successful",
        newPlayer: newPlayerData,
        outgoingPlayer: leavingPlayer
    };
}

/**
 * Get available substitutes for a team (players not currently in game)
 * 
 * @param {string} teamKey - "teamA" or "teamB"
 * @param {Object} systems - Game systems
 * @returns {Array} - Array of bench entries that can be substituted in
 */
function getAvailableSubstitutes(teamKey, systems) {
    var stateManager = systems.stateManager;
    var availablePlayers = stateManager.get("availablePlayers") || { teamA: [], teamB: [] };
    var bench = availablePlayers[teamKey] || [];
    
    var available = [];
    for (var i = 0; i < bench.length; i++) {
        if (!bench[i].inGame) {
            available.push({
                benchIndex: i,
                entry: bench[i]
            });
        }
    }
    return available;
}

/**
 * Get active player info for a team
 * 
 * @param {string} teamKey - "teamA" or "teamB"
 * @param {number} slot - 0 or 1
 * @returns {Object|null} - Player sprite's playerData or null
 */
function getActivePlayerInfo(teamKey, slot) {
    var spriteId = teamKey === "teamA"
        ? (slot === 0 ? spriteRegistry.IDS.TEAM_A_PLAYER_1 : spriteRegistry.IDS.TEAM_A_PLAYER_2)
        : (slot === 0 ? spriteRegistry.IDS.TEAM_B_PLAYER_1 : spriteRegistry.IDS.TEAM_B_PLAYER_2);
    
    var sprite = spriteRegistry.get(spriteId);
    return sprite ? sprite.playerData : null;
}