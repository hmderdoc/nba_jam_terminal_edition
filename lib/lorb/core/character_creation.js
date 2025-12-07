/**
 * character_creation.js - LORB Character Creation Flow
 * 
 * LoRD-style character creation for Legend of the Red Bull.
 * Handles: intro, archetype selection, stat allocation, background, and finalization.
 * 
 * Uses RichView for appearance customization with live sprite preview.
 */

// Load RichView for appearance customization
var _ccRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _ccRichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[CHAR_CREATE] Failed to load RichView: " + e);
}

// Load BinLoader for sprite preview
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
        log(LOG_WARNING, "[CHAR_CREATE] Failed to load BinLoader: " + e);
    }
}

(function() {
    
    var RichView = _ccRichView;
    
    // Base stats before any modifications
    var BASE_STATS = {
        speed: 4,
        threePt: 4,
        power: 4,
        steal: 4,
        block: 4,
        dunk: 4
    };
    
    var STARTING_POINTS = 12;
    var MAX_STAT = 10;
    var MIN_STAT = 1;
    var BASE_CASH = 1000;
    var BASE_REP = 0;
    
    // Character art paths
    var CHARACTERS_DIR = "/sbbs/xtrn/nba_jam/assets/characters/";
    var BARNEY_ART = CHARACTERS_DIR + "barney_dinosaur.bin";
    var BARNEY_W = 40;
    var BARNEY_H = 20;
    
    // Appearance options for character customization (CP437 characters)
    var APPEARANCE_OPTIONS = {
        skinColors: [
            { id: "brown", name: "\1wBrown\1n", preview: "\1" + String.fromCharCode(2) + "\xDB\1n" },
            { id: "lightgray", name: "\1wLight\1n", preview: "\1w\xDB\1n" },
            { id: "magenta", name: "\1wDark\1n", preview: "\1m\xDB\1n" }
        ],
        eyeColors: [
            { id: "BROWN", name: "\1wBrown\1n", preview: "\1" + String.fromCharCode(2) + "\xDB\1n" },
            { id: "BLUE", name: "\1wBlue\1n", preview: "\1b\xDB\1n" },
            { id: "GREEN", name: "\1wGreen\1n", preview: "\1g\xDB\1n" },
            { id: "LIGHTGRAY", name: "\1wGray\1n", preview: "\1w\xDB\1n" },
            { id: "BLACK", name: "\1wBlack\1n", preview: "\1k\1h\xDB\1n" }
        ],
        jerseyColors: [
            { id: "RED", name: "\1wRed\1n", preview: "\1r\xDB\1n" },
            { id: "BLUE", name: "\1wBlue\1n", preview: "\1b\xDB\1n" },
            { id: "GREEN", name: "\1wGreen\1n", preview: "\1g\xDB\1n" },
            { id: "YELLOW", name: "\1wYellow\1n", preview: "\1y\xDB\1n" },
            { id: "CYAN", name: "\1wCyan\1n", preview: "\1c\xDB\1n" },
            { id: "MAGENTA", name: "\1wPurple\1n", preview: "\1m\xDB\1n" },
            { id: "WHITE", name: "\1wWhite\1n", preview: "\1h\1w\xDB\1n" },
            { id: "BLACK", name: "\1wBlack\1n", preview: "\1k\1h\xDB\1n" }
        ],
        letteringColors: [
            { id: "WHITE", name: "\1wWhite\1n", preview: "\1h\1w\xDB\1n" },
            { id: "LIGHTGRAY", name: "\1wLight Gray\1n", preview: "\1w\xDB\1n" },
            { id: "DARKGRAY", name: "\1wDark Gray\1n", preview: "\1h\1k\xDB\1n" },
            { id: "BLACK", name: "\1wBlack\1n", preview: "\1k\xDB\1n" },
            { id: "RED", name: "\1wRed\1n", preview: "\1r\xDB\1n" },
            { id: "YELLOW", name: "\1wYellow\1n", preview: "\1h\1y\xDB\1n" }
        ]
    };
    
    /**
     * Repeat a character n times
     */
    function repeatChar(ch, n) {
        var result = "";
        for (var i = 0; i < n; i++) result += ch;
        return result;
    }
    
    /**
     * Display the intro narrative
     */
    function showIntro() {
        LORB.View.clear();
        
        var lines = [
            "",
            "\1h\1rL E G E N D   O F   T H E   R E D   B U L L\1n",
            "",
            "\1cThe city never sleeps. Neither do its courts.\1n",
            "",
            "They say there's a place where ballers go to become legends.",
            "Where the concrete burns and the rims never rust.",
            "Where a can of Red Bull can change your fate.",
            "",
            "\1yRim City.\1n",
            "",
            "The courts here have seen everything. Ankle-breakers.",
            "Poster dunks. Careers made and ended in a single possession.",
            "",
            "And at the center of it all... \1rThe Court of Airness.\1n",
            "Where \1rThe Red Bull\1n waits.",
            "",
            "No one has beaten it. Not yet.",
            "",
            "\1wBut first, you need to prove you belong here.\1n",
            ""
        ];
        
        for (var i = 0; i < lines.length; i++) {
            LORB.View.line(lines[i]);
        }
        
        LORB.View.line("\1h\1wPress any key to begin your journey...\1n");
        console.getkey();
    }
    
    /**
     * Get player name
     */
    function getPlayerName(defaultName) {
        LORB.View.clear();
        LORB.View.header("WHAT DO THEY CALL YOU?");
        LORB.View.line("");
        LORB.View.line("Every legend needs a name. What's yours?");
        LORB.View.line("");
        LORB.View.line("\1kDefault: " + defaultName + "\1n");
        LORB.View.line("");
        
        var name = LORB.View.prompt("Your name (or Enter for default): ");
        if (!name || name.trim() === "") {
            name = defaultName;
        }
        
        // Sanitize: max 20 chars, alphanumeric and spaces only
        name = name.substring(0, 20).replace(/[^a-zA-Z0-9 _-]/g, "");
        if (!name || name.trim() === "") {
            name = defaultName;
        }
        
        return name.trim();
    }
    
    /**
     * Choose archetype
     */
    function chooseArchetype() {
        var archetypes = LORB.Data.getArchetypeList();
        
        while (true) {
            LORB.View.clear();
            LORB.View.header("CHOOSE YOUR PLAYSTYLE - How do you dominate on the court?");
            LORB.View.line("");
            
            for (var i = 0; i < archetypes.length; i++) {
                var arch = archetypes[i];
                
                // Build stat mods inline with title
                var mods = [];
                for (var stat in arch.statMods) {
                    if (arch.statMods.hasOwnProperty(stat)) {
                        var val = arch.statMods[stat];
                        var prefix = val > 0 ? "\1g+" : "\1r";
                        mods.push(prefix + val + " " + stat.toUpperCase() + "\1n");
                    }
                }
                var modStr = mods.length > 0 ? " " + mods.join(", ") : "";
                
                // Title + stats on one line
                LORB.View.line("\1h\1w" + (i + 1) + ")\1n \1y" + arch.name + "\1n" + modStr);
                LORB.View.line("   " + arch.description);
                LORB.View.line("   \1cSpecial:\1n " + arch.special.name + " - " + arch.special.description);
            }
            
            LORB.View.line("");
            var choice = LORB.View.prompt("Choose (1-" + archetypes.length + "): ");
            var idx = parseInt(choice, 10) - 1;
            
            if (idx >= 0 && idx < archetypes.length) {
                // Confirm selection
                LORB.View.clear();
                var selected = archetypes[idx];
                LORB.View.header(selected.name.toUpperCase());
                LORB.View.line("");
                LORB.View.line(selected.flavorText);
                LORB.View.line("");
                
                if (LORB.View.confirm("Choose " + selected.name + "? (Y/N) ")) {
                    return selected;
                }
            }
        }
    }
    
    /**
     * Allocate stat points
     */
    function allocateStats(archetype) {
        // Start with base stats + archetype mods
        var stats = {};
        for (var stat in BASE_STATS) {
            if (BASE_STATS.hasOwnProperty(stat)) {
                stats[stat] = BASE_STATS[stat];
                if (archetype.statMods && archetype.statMods[stat]) {
                    stats[stat] += archetype.statMods[stat];
                }
                // Clamp to valid range
                stats[stat] = Math.max(MIN_STAT, Math.min(MAX_STAT, stats[stat]));
            }
        }
        
        var pointsRemaining = STARTING_POINTS;
        var statKeys = ["speed", "threePt", "power", "steal", "block", "dunk"];
        var statLabels = {
            speed: "Speed",
            threePt: "3PT Shooting",
            power: "Power",
            steal: "Steal",
            block: "Block",
            dunk: "Dunk"
        };
        var statHotkeys = {
            "S": "speed",
            "3": "threePt",
            "P": "power",
            "T": "steal",
            "B": "block",
            "D": "dunk"
        };
        
        while (true) {
            LORB.View.clear();
            LORB.View.header("ALLOCATE YOUR ATTRIBUTES");
            LORB.View.line("");
            LORB.View.line("Distribute " + STARTING_POINTS + " points among your stats.");
            LORB.View.line("Stats range from " + MIN_STAT + " to " + MAX_STAT + ".");
            LORB.View.line("");
            LORB.View.line("\1h\1yPoints Remaining: " + pointsRemaining + "\1n");
            LORB.View.line("");
            
            for (var i = 0; i < statKeys.length; i++) {
                var key = statKeys[i];
                var hotkey = Object.keys(statHotkeys).find(function(k) { 
                    return statHotkeys[k] === key; 
                }) || key[0].toUpperCase();
                
                var bar = "";
                for (var b = 0; b < stats[key]; b++) bar += "\1g\xFE\1n";
                for (var b = stats[key]; b < MAX_STAT; b++) bar += "\1h\1k\xFE\1n";
                
                var label = statLabels[key];
                while (label.length < 14) label += " ";
                
                LORB.View.line("[\1w" + hotkey + "\1n] " + label + " " + bar + " \1w" + stats[key] + "\1n");
            }
            
            LORB.View.line("");
            LORB.View.line("[\1wR\1n] Reset all points");
            LORB.View.line("[\1wQ\1n] Finish allocation");
            LORB.View.line("");
            
            var input = LORB.View.prompt("Add point to (S/3/P/T/B/D) or command: ");
            if (!input) continue;
            
            var cmd = input.toUpperCase();
            
            if (cmd === "Q") {
                if (pointsRemaining > 0) {
                    LORB.View.warn("You still have " + pointsRemaining + " points to spend!");
                    if (!LORB.View.confirm("Continue anyway? (Y/N) ")) {
                        continue;
                    }
                }
                return stats;
            }
            
            if (cmd === "R") {
                // Reset to base + archetype
                pointsRemaining = STARTING_POINTS;
                for (var stat in BASE_STATS) {
                    if (BASE_STATS.hasOwnProperty(stat)) {
                        stats[stat] = BASE_STATS[stat];
                        if (archetype.statMods && archetype.statMods[stat]) {
                            stats[stat] += archetype.statMods[stat];
                        }
                        stats[stat] = Math.max(MIN_STAT, Math.min(MAX_STAT, stats[stat]));
                    }
                }
                continue;
            }
            
            // Check if it's a stat hotkey
            if (statHotkeys[cmd]) {
                var targetStat = statHotkeys[cmd];
                
                if (pointsRemaining <= 0) {
                    LORB.View.warn("No points remaining! Press R to reset.");
                    console.getkey();
                    continue;
                }
                
                if (stats[targetStat] >= MAX_STAT) {
                    LORB.View.warn(statLabels[targetStat] + " is already at maximum!");
                    console.getkey();
                    continue;
                }
                
                stats[targetStat]++;
                pointsRemaining--;
            }
            
            // Allow minus with shift (lowercase letter followed by -)
            if (cmd.length === 2 && cmd[1] === "-") {
                var minusKey = cmd[0];
                if (statHotkeys[minusKey]) {
                    var targetStat = statHotkeys[minusKey];
                    var baseVal = BASE_STATS[targetStat] + (archetype.statMods[targetStat] || 0);
                    baseVal = Math.max(MIN_STAT, Math.min(MAX_STAT, baseVal));
                    
                    if (stats[targetStat] <= baseVal) {
                        LORB.View.warn("Can't reduce below base value!");
                        console.getkey();
                        continue;
                    }
                    
                    stats[targetStat]--;
                    pointsRemaining++;
                }
            }
        }
    }
    
    /**
     * Choose background
     */
    function chooseBackground() {
        var backgrounds = LORB.Data.getBackgroundList();
        
        while (true) {
            LORB.View.clear();
            LORB.View.header("WHERE DID YOU COME FROM?");
            LORB.View.line("");
            LORB.View.line("Every legend has an origin story.");
            LORB.View.line("");
            
            for (var i = 0; i < backgrounds.length; i++) {
                var bg = backgrounds[i];
                LORB.View.line("\1h\1w" + (i + 1) + ")\1n \1y" + bg.name + "\1n");
                LORB.View.line("   " + bg.description);
                
                // Show resource mods
                var mods = [];
                if (bg.resourceMods.cash !== 0) {
                    var prefix = bg.resourceMods.cash > 0 ? "\1g+" : "\1r";
                    mods.push(prefix + "$" + bg.resourceMods.cash + "\1n");
                }
                if (bg.resourceMods.rep !== 0) {
                    var prefix = bg.resourceMods.rep > 0 ? "\1g+" : "\1r";
                    mods.push(prefix + bg.resourceMods.rep + " Rep\1n");
                }
                
                // Show stat mods if any
                if (bg.statMods && !bg.statMods._random) {
                    for (var stat in bg.statMods) {
                        if (bg.statMods.hasOwnProperty(stat)) {
                            var val = bg.statMods[stat];
                            var prefix = val > 0 ? "\1g+" : "\1r";
                            mods.push(prefix + val + " " + stat.toUpperCase() + "\1n");
                        }
                    }
                }
                if (bg.statMods && bg.statMods._random) {
                    mods.push("\1m?? Random stats\1n");
                }
                
                if (mods.length > 0) {
                    LORB.View.line("   " + mods.join(", "));
                }
                LORB.View.line("");
            }
            
            var choice = LORB.View.prompt("Choose (1-" + backgrounds.length + "): ");
            var idx = parseInt(choice, 10) - 1;
            
            if (idx >= 0 && idx < backgrounds.length) {
                // Confirm selection
                LORB.View.clear();
                var selected = backgrounds[idx];
                LORB.View.header(selected.name.toUpperCase());
                LORB.View.line("");
                LORB.View.line(selected.flavorText);
                LORB.View.line("");
                
                if (LORB.View.confirm("Choose " + selected.name + "? (Y/N) ")) {
                    return selected;
                }
            }
        }
    }
    
    /**
     * Apply background modifications and randomize if needed
     */
    function applyBackground(stats, background, ctx) {
        // Apply resource mods
        ctx.cash = BASE_CASH + (background.resourceMods.cash || 0);
        ctx.rep = BASE_REP + (background.resourceMods.rep || 0);
        
        // Apply stat mods
        if (background.statMods) {
            if (background.statMods._random) {
                // Mystery lab creation: random spike and dump
                var statKeys = Object.keys(stats);
                var spike = statKeys[Math.floor(Math.random() * statKeys.length)];
                var dump = statKeys[Math.floor(Math.random() * statKeys.length)];
                while (dump === spike) {
                    dump = statKeys[Math.floor(Math.random() * statKeys.length)];
                }
                
                stats[spike] = Math.min(MAX_STAT, stats[spike] + 3);
                stats[dump] = Math.max(MIN_STAT, stats[dump] - 2);
                
                LORB.View.line("");
                LORB.View.line("\1mThe Red Bull surges through you...\1n");
                LORB.View.line("\1g+" + 3 + " " + spike.toUpperCase() + "\1n");
                LORB.View.line("\1r-" + 2 + " " + dump.toUpperCase() + "\1n");
                console.getkey();
            } else {
                for (var stat in background.statMods) {
                    if (background.statMods.hasOwnProperty(stat) && stats[stat] !== undefined) {
                        stats[stat] += background.statMods[stat];
                        stats[stat] = Math.max(MIN_STAT, Math.min(MAX_STAT, stats[stat]));
                    }
                }
            }
        }
        
        // Store perks
        ctx.perks = background.perks || [];
    }
    
    // =========================================================================
    // Helper functions for sprite preview (adapted from crib.js)
    // =========================================================================
    
    /**
     * Find option in list by ID
     */
    function findOption(optionList, id) {
        for (var i = 0; i < optionList.length; i++) {
            if (optionList[i].id === id) return optionList[i];
        }
        return null;
    }
    
    /**
     * Get index of option in list
     */
    function getOptionIndex(optionList, id) {
        for (var i = 0; i < optionList.length; i++) {
            if (optionList[i].id === id) return i;
        }
        return 0;
    }
    
    /**
     * Build display string for option with < > indicators
     */
    function buildPickerDisplay(optionList, currentId) {
        var idx = getOptionIndex(optionList, currentId);
        var leftArrow = (idx > 0) ? "\1w< \1n" : "\1h\1k< \1n";
        var rightArrow = (idx < optionList.length - 1) ? "\1w >\1n" : "\1h\1k >\1n";
        
        var opt = findOption(optionList, currentId);
        var display = opt ? (opt.preview + " " + opt.name) : ("\1w" + currentId + "\1n");
        return leftArrow + display + rightArrow;
    }
    
    /**
     * Get BG color constant from color name for jersey
     */
    function getJerseyBgColorForPreview(colorName) {
        if (!colorName) return BG_RED;
        var map = {
            "RED": BG_RED,
            "BLUE": BG_BLUE,
            "GREEN": BG_GREEN,
            "YELLOW": BG_BROWN,
            "CYAN": BG_CYAN,
            "MAGENTA": BG_MAGENTA,
            "WHITE": BG_LIGHTGRAY,
            "BLACK": BG_BLACK,
            "BROWN": BG_BROWN
        };
        return map[colorName.toUpperCase()] || BG_RED;
    }
    
    /**
     * Get FG color constant from color name for jersey lettering
     */
    function getLetteringFgColorForPreview(colorName) {
        if (!colorName) return WHITE | HIGH;
        var map = {
            "WHITE": WHITE | HIGH,
            "LIGHTGRAY": LIGHTGRAY,
            "DARKGRAY": DARKGRAY | HIGH,
            "BLACK": BLACK,
            "RED": RED,
            "LIGHTRED": RED | HIGH,
            "GREEN": GREEN,
            "LIGHTGREEN": GREEN | HIGH,
            "BLUE": BLUE,
            "LIGHTBLUE": BLUE | HIGH,
            "CYAN": CYAN,
            "LIGHTCYAN": CYAN | HIGH,
            "MAGENTA": MAGENTA,
            "LIGHTMAGENTA": MAGENTA | HIGH,
            "BROWN": BROWN,
            "YELLOW": YELLOW | HIGH
        };
        return map[colorName.toUpperCase()] || (WHITE | HIGH);
    }
    
    /**
     * Get FG color constant from color name for eye color
     */
    function getEyeFgColorForPreview(colorName) {
        if (!colorName) return BROWN;
        var map = {
            "BROWN": BROWN,
            "BLACK": BLACK,
            "BLUE": BLUE | HIGH,
            "GREEN": GREEN | HIGH,
            "LIGHTGRAY": LIGHTGRAY,
            "DARKGRAY": DARKGRAY | HIGH
        };
        return map[colorName.toUpperCase()] || BROWN;
    }
    
    /**
     * Draw the player sprite preview in the art zone
     */
    function drawPlayerPreview(view, ctx) {
        var artFrame = view.getZone("art");
        if (!artFrame) return;
        
        var NBA_JAM_ROOT = "/sbbs/xtrn/nba_jam/";
        var SPRITE_WIDTH = 5;
        var SPRITE_HEIGHT = 4;
        
        // Draw border and title
        artFrame.gotoxy(1, 1);
        artFrame.putmsg("\1n\1h\1c\xDA" + repeatChar("\xC4", 36) + "\xBF\1n");
        artFrame.gotoxy(1, 2);
        artFrame.putmsg("\1n\1h\1c\xB3\1n\1h\1w           PREVIEW              \1n\1h\1c\xB3\1n");
        artFrame.gotoxy(1, 3);
        artFrame.putmsg("\1n\1h\1c\xC3" + repeatChar("\xC4", 36) + "\xB4\1n");
        
        for (var y = 4; y < 22; y++) {
            artFrame.gotoxy(1, y);
            artFrame.putmsg("\1n\1h\1c\xB3\1n");
            artFrame.gotoxy(38, y);
            artFrame.putmsg("\1n\1h\1c\xB3\1n");
        }
        
        artFrame.gotoxy(1, 22);
        artFrame.putmsg("\1n\1h\1c\xC0" + repeatChar("\xC4", 36) + "\xD9\1n");
        
        // Sprite position in art zone
        var spriteX = 17;
        var spriteY = 8;
        
        // Load sprite using BinLoader
        var spriteLoaded = false;
        if (typeof BinLoader !== "undefined") {
            try {
                var skin = (ctx.appearance.skin || "brown").toLowerCase();
                var binPath = NBA_JAM_ROOT + "sprites/player-" + skin + ".bin";
                
                var binData = BinLoader.loadBinFile(binPath);
                if (binData) {
                    // Parse the first 5x4 frame from bin data into a 2D array
                    var pixels = [];
                    var offset = 0;
                    for (var py = 0; py < SPRITE_HEIGHT; py++) {
                        pixels[py] = [];
                        for (var px = 0; px < SPRITE_WIDTH; px++) {
                            if (offset + 1 < binData.length) {
                                var ch = binData.charAt(offset++);
                                var attr = binData.charCodeAt(offset++);
                                pixels[py][px] = { ch: ch, attr: attr };
                            } else {
                                pixels[py][px] = { ch: ' ', attr: BG_BLACK };
                            }
                        }
                    }
                    
                    // Apply jersey mask to specific cells
                    var jerseyBg = getJerseyBgColorForPreview(ctx.appearance.jerseyColor);
                    var jerseyNum = ctx.appearance.jerseyNumber || "";
                    var digits = jerseyNum.replace(/[^0-9]/g, "");
                    var leftDigit = digits.length >= 2 ? digits.charAt(0) : "#";
                    var rightDigit = digits.length >= 1 ? digits.charAt(digits.length - 1) : "#";
                    if (digits.length === 1) leftDigit = "#";
                    
                    var letteringFg = getLetteringFgColorForPreview(ctx.appearance.jerseyLettering || "WHITE");
                    var digitsAttr = letteringFg | jerseyBg;
                    
                    // Row 2 (0-indexed), cols 1,2,3: jersey number area
                    pixels[2][1] = { ch: leftDigit, attr: digitsAttr };
                    var neckCell = pixels[2][2];
                    var skinFg = neckCell.attr & 0x0F;
                    pixels[2][2] = { ch: String.fromCharCode(223), attr: skinFg | jerseyBg };
                    pixels[2][3] = { ch: rightDigit, attr: digitsAttr };
                    
                    // Row 3 (0-indexed), cols 1,3: shorts/legs
                    var shortsChar = String.fromCharCode(220);
                    var leftLeg = pixels[3][1];
                    var shoeFg = leftLeg.attr & 0x0F;
                    pixels[3][1] = { ch: shortsChar, attr: shoeFg | jerseyBg };
                    var rightLeg = pixels[3][3];
                    shoeFg = rightLeg.attr & 0x0F;
                    pixels[3][3] = { ch: shortsChar, attr: shoeFg | jerseyBg };
                    
                    // Row 0 (0-indexed): Apply eye color to O/o/0 characters
                    var eyeFg = getEyeFgColorForPreview(ctx.appearance.eyeColor);
                    for (var ex = 0; ex < SPRITE_WIDTH; ex++) {
                        var eyeCell = pixels[0][ex];
                        var eyeCh = eyeCell.ch;
                        if (eyeCh === 'O' || eyeCh === 'o' || eyeCh === '0') {
                            var eyeBg = eyeCell.attr & 0xF0;
                            pixels[0][ex] = { ch: eyeCh, attr: eyeFg | eyeBg };
                        }
                    }
                    
                    // Render pixels to frame
                    for (var ry = 0; ry < SPRITE_HEIGHT; ry++) {
                        for (var rx = 0; rx < SPRITE_WIDTH; rx++) {
                            var cell = pixels[ry][rx];
                            var ch = cell.ch;
                            var attr = cell.attr;
                            if (!ch || ch === '\0' || ch === ' ') {
                                ch = ' ';
                                attr = BG_BLACK;
                            }
                            artFrame.gotoxy(spriteX + rx, spriteY + ry);
                            try {
                                artFrame.setData(spriteX + rx - 1, spriteY + ry - 1, ch, attr, false);
                            } catch (e) {
                                artFrame.putmsg(ch);
                            }
                        }
                    }
                    
                    spriteLoaded = true;
                    
                    // Show jersey number below sprite
                    artFrame.gotoxy(spriteX + 1, spriteY + SPRITE_HEIGHT + 1);
                    artFrame.putmsg("\1w#\1h\1w" + jerseyNum + "\1n");
                }
            } catch (e) {
                log(LOG_WARNING, "[CHAR_CREATE] Sprite preview failed: " + e);
            }
        }
        
        if (!spriteLoaded) {
            artFrame.gotoxy(12, 10);
            artFrame.putmsg("\1y[No Preview]\1n");
        }
        
        // Show appearance summary at bottom
        var skinOpt = findOption(APPEARANCE_OPTIONS.skinColors, ctx.appearance.skin);
        var eyeOpt = findOption(APPEARANCE_OPTIONS.eyeColors, ctx.appearance.eyeColor);
        var jerseyOpt = findOption(APPEARANCE_OPTIONS.jerseyColors, ctx.appearance.jerseyColor);
        
        artFrame.gotoxy(3, 15);
        artFrame.putmsg("\1wSkin: " + (skinOpt ? skinOpt.preview + skinOpt.name : ctx.appearance.skin) + "\1n");
        artFrame.gotoxy(3, 16);
        artFrame.putmsg("\1wEyes: " + (eyeOpt ? eyeOpt.preview + eyeOpt.name : ctx.appearance.eyeColor) + "\1n");
        artFrame.gotoxy(3, 17);
        artFrame.putmsg("\1wJersey: " + (jerseyOpt ? jerseyOpt.preview + jerseyOpt.name : ctx.appearance.jerseyColor) + "\1n");
        
        view.render();
    }
    
    /**
     * Customize character appearance
     * Uses RichView with live sprite preview on left, options on right
     */
    function customizeAppearance(ctx) {
        // Initialize appearance with defaults
        ctx.appearance = ctx.appearance || {};
        ctx.appearance.skin = ctx.appearance.skin || "brown";
        ctx.appearance.eyeColor = ctx.appearance.eyeColor || "BROWN";
        ctx.appearance.jerseyColor = ctx.appearance.jerseyColor || "RED";
        ctx.appearance.jerseyLettering = ctx.appearance.jerseyLettering || "WHITE";
        ctx.appearance.jerseyNumber = ctx.appearance.jerseyNumber || String(Math.floor(Math.random() * 99) + 1);
        ctx.nickname = ctx.nickname || "";
        
        // Check if RichView is available
        if (!RichView) {
            // Fallback to simple legacy mode
            return customizeAppearanceLegacy(ctx);
        }
        
        var selectedField = 0;
        
        while (true) {
            var view = new RichView({
                zones: [
                    { name: "art", x: 1, y: 1, width: 40, height: 24 },
                    { name: "content", x: 41, y: 1, width: 40, height: 24 }
                ],
                theme: "lorb"
            });
            
            // Draw sprite preview in art zone
            drawPlayerPreview(view, ctx);
            
            // Content zone - appearance options
            view.setContentZone("content");
            view.setCursorY(0);
            
            view.line("\1h\1cCUSTOMIZE YOUR LOOK\1n");
            view.line("\1c" + repeatChar("\xC4", 38) + "\1n");
            view.blank();
            view.line("Stand out on the court.");
            view.line("Make them remember you.");
            view.blank();
            
            // Build menu items for appearance options with < > indicators
            var menuItems = [
                { 
                    text: "\1wSkin Tone:  " + buildPickerDisplay(APPEARANCE_OPTIONS.skinColors, ctx.appearance.skin),
                    value: "skin",
                    hotkey: "1"
                },
                { 
                    text: "\1wEye Color:  " + buildPickerDisplay(APPEARANCE_OPTIONS.eyeColors, ctx.appearance.eyeColor),
                    value: "eyes",
                    hotkey: "2"
                },
                { 
                    text: "\1wJersey:     " + buildPickerDisplay(APPEARANCE_OPTIONS.jerseyColors, ctx.appearance.jerseyColor),
                    value: "jersey",
                    hotkey: "3"
                },
                { 
                    text: "\1wLettering:  " + buildPickerDisplay(APPEARANCE_OPTIONS.letteringColors, ctx.appearance.jerseyLettering),
                    value: "lettering",
                    hotkey: "4"
                },
                { 
                    text: "\1wJersey #:   \1h\1c" + ctx.appearance.jerseyNumber + "\1n",
                    value: "number",
                    hotkey: "5"
                },
                { 
                    text: "\1wNickname:   \1c" + (ctx.nickname || "(none)") + "\1n",
                    value: "nickname",
                    hotkey: "6"
                },
                { text: "", value: null, disabled: true },
                { text: "\1gDone - Continue\1n", value: "done", hotkey: "D" }
            ];
            
            view.info("\1w[Up/Dn]\1n Select  \1w[Lt/Rt]\1n Change  \1w[D]\1none");
            
            // Custom theme: WHITE on BLUE highlight
            var menuTheme = {
                fg: LIGHTGRAY,
                bg: BG_BLACK,
                hfg: WHITE | HIGH,
                hbg: BG_BLUE,
                kfg: YELLOW,
                khfg: YELLOW | HIGH,
                dfg: DARKGRAY,
                dbg: BG_BLACK
            };
            
            // Handler for left/right arrow cycling
            var cycleOption = function(item, index, direction, richView, lb) {
                var optList = null;
                var currentVal = null;
                var setter = null;
                
                if (item.value === "skin") {
                    optList = APPEARANCE_OPTIONS.skinColors;
                    currentVal = ctx.appearance.skin;
                    setter = function(v) { ctx.appearance.skin = v; };
                } else if (item.value === "eyes") {
                    optList = APPEARANCE_OPTIONS.eyeColors;
                    currentVal = ctx.appearance.eyeColor;
                    setter = function(v) { ctx.appearance.eyeColor = v; };
                } else if (item.value === "jersey") {
                    optList = APPEARANCE_OPTIONS.jerseyColors;
                    currentVal = ctx.appearance.jerseyColor;
                    setter = function(v) { ctx.appearance.jerseyColor = v; };
                } else if (item.value === "lettering") {
                    optList = APPEARANCE_OPTIONS.letteringColors;
                    currentVal = ctx.appearance.jerseyLettering;
                    setter = function(v) { ctx.appearance.jerseyLettering = v; };
                }
                
                if (optList && setter) {
                    var idx = getOptionIndex(optList, currentVal);
                    if (direction < 0) {
                        if (idx > 0) {
                            idx--;
                            setter(optList[idx].id);
                            return { action: "cycle", field: item.value, index: index };
                        }
                    } else {
                        if (idx < optList.length - 1) {
                            idx++;
                            setter(optList[idx].id);
                            return { action: "cycle", field: item.value, index: index };
                        }
                    }
                }
                return false;
            };
            
            var choice = view.menu(menuItems, { 
                y: 9, 
                selected: selectedField, 
                theme: menuTheme,
                onLeftRight: cycleOption
            });
            view.close();
            
            // Handle cycle action - redraw with same selection
            if (choice && typeof choice === "object" && choice.action === "cycle") {
                selectedField = choice.index;
                continue;
            }
            
            if (choice === "done" || choice === null) {
                // Ensure nickname defaults to something if not set
                if (!ctx.nickname || ctx.nickname.trim() === "") {
                    var nameParts = (ctx.name || "PLAYER").toUpperCase().split(" ");
                    ctx.nickname = nameParts[0].substring(0, 8);
                }
                return;
            }
            
            // Handle option cycling on Enter
            if (choice === "skin") {
                selectedField = 0;
                var idx = getOptionIndex(APPEARANCE_OPTIONS.skinColors, ctx.appearance.skin);
                idx = (idx + 1) % APPEARANCE_OPTIONS.skinColors.length;
                ctx.appearance.skin = APPEARANCE_OPTIONS.skinColors[idx].id;
            } else if (choice === "eyes") {
                selectedField = 1;
                var idx = getOptionIndex(APPEARANCE_OPTIONS.eyeColors, ctx.appearance.eyeColor);
                idx = (idx + 1) % APPEARANCE_OPTIONS.eyeColors.length;
                ctx.appearance.eyeColor = APPEARANCE_OPTIONS.eyeColors[idx].id;
            } else if (choice === "jersey") {
                selectedField = 2;
                var idx = getOptionIndex(APPEARANCE_OPTIONS.jerseyColors, ctx.appearance.jerseyColor);
                idx = (idx + 1) % APPEARANCE_OPTIONS.jerseyColors.length;
                ctx.appearance.jerseyColor = APPEARANCE_OPTIONS.jerseyColors[idx].id;
            } else if (choice === "lettering") {
                selectedField = 3;
                var idx = getOptionIndex(APPEARANCE_OPTIONS.letteringColors, ctx.appearance.jerseyLettering);
                idx = (idx + 1) % APPEARANCE_OPTIONS.letteringColors.length;
                ctx.appearance.jerseyLettering = APPEARANCE_OPTIONS.letteringColors[idx].id;
            } else if (choice === "number") {
                selectedField = 4;
                // Show input prompt in content zone
                LORB.View.init();
                LORB.View.clear();
                LORB.View.line("");
                LORB.View.line("Enter jersey number/text (1-2 chars):");
                var numInput = LORB.View.prompt("> ");
                if (numInput && numInput.length > 0) {
                    ctx.appearance.jerseyNumber = numInput.substring(0, 2).replace(/[^a-zA-Z0-9]/g, "");
                    if (!ctx.appearance.jerseyNumber) {
                        ctx.appearance.jerseyNumber = String(Math.floor(Math.random() * 99) + 1);
                    }
                }
            } else if (choice === "nickname") {
                selectedField = 5;
                // Show input prompt
                LORB.View.init();
                LORB.View.clear();
                LORB.View.line("");
                LORB.View.line("Your nickname appears above your player.");
                LORB.View.line("Keep it short (8 chars max) for best display.");
                LORB.View.line("");
                var nickInput = LORB.View.prompt("Nickname: ");
                if (nickInput) {
                    ctx.nickname = nickInput.substring(0, 8).replace(/[^a-zA-Z0-9_\-!]/g, "").toUpperCase();
                }
            }
        }
    }
    
    /**
     * Legacy appearance customization (fallback when RichView not available)
     */
    function customizeAppearanceLegacy(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("CUSTOMIZE YOUR LOOK");
            LORB.View.line("");
            LORB.View.line("Stand out on the court. Make them remember you.");
            LORB.View.line("");
            
            var skinOpt = findOption(APPEARANCE_OPTIONS.skinColors, ctx.appearance.skin);
            var eyeOpt = findOption(APPEARANCE_OPTIONS.eyeColors, ctx.appearance.eyeColor);
            var jerseyOpt = findOption(APPEARANCE_OPTIONS.jerseyColors, ctx.appearance.jerseyColor);
            
            LORB.View.line("\1w1)\1n Skin Tone:    " + (skinOpt ? skinOpt.preview + " " + skinOpt.name : ctx.appearance.skin));
            LORB.View.line("\1w2)\1n Eye Color:    " + (eyeOpt ? eyeOpt.preview + " " + eyeOpt.name : ctx.appearance.eyeColor));
            LORB.View.line("\1w3)\1n Jersey Color: " + (jerseyOpt ? jerseyOpt.preview + " " + jerseyOpt.name : ctx.appearance.jerseyColor));
            LORB.View.line("\1w4)\1n Jersey #:     \1h" + ctx.appearance.jerseyNumber + "\1n");
            LORB.View.line("\1w5)\1n Nickname:     \1c" + (ctx.nickname || "(none)") + "\1n");
            LORB.View.line("");
            LORB.View.line("\1w6)\1n \1gDone - Continue\1n");
            LORB.View.line("");
            
            var input = LORB.View.prompt("Choose option (1-6): ");
            if (!input) continue;
            
            var choice = parseInt(input, 10);
            
            if (choice === 1) {
                var idx = getOptionIndex(APPEARANCE_OPTIONS.skinColors, ctx.appearance.skin);
                idx = (idx + 1) % APPEARANCE_OPTIONS.skinColors.length;
                ctx.appearance.skin = APPEARANCE_OPTIONS.skinColors[idx].id;
            } else if (choice === 2) {
                var idx = getOptionIndex(APPEARANCE_OPTIONS.eyeColors, ctx.appearance.eyeColor);
                idx = (idx + 1) % APPEARANCE_OPTIONS.eyeColors.length;
                ctx.appearance.eyeColor = APPEARANCE_OPTIONS.eyeColors[idx].id;
            } else if (choice === 3) {
                var idx = getOptionIndex(APPEARANCE_OPTIONS.jerseyColors, ctx.appearance.jerseyColor);
                idx = (idx + 1) % APPEARANCE_OPTIONS.jerseyColors.length;
                ctx.appearance.jerseyColor = APPEARANCE_OPTIONS.jerseyColors[idx].id;
            } else if (choice === 4) {
                LORB.View.line("");
                var numInput = LORB.View.prompt("Enter jersey number/text (1-2 chars): ");
                if (numInput && numInput.length > 0) {
                    ctx.appearance.jerseyNumber = numInput.substring(0, 2).replace(/[^a-zA-Z0-9]/g, "");
                    if (!ctx.appearance.jerseyNumber) {
                        ctx.appearance.jerseyNumber = String(Math.floor(Math.random() * 99) + 1);
                    }
                }
            } else if (choice === 5) {
                LORB.View.line("");
                LORB.View.line("Your nickname appears above your player on the court.");
                LORB.View.line("Keep it short (8 chars max) for best display.");
                var nickInput = LORB.View.prompt("Enter nickname: ");
                if (nickInput) {
                    ctx.nickname = nickInput.substring(0, 8).replace(/[^a-zA-Z0-9_\-!]/g, "").toUpperCase();
                }
            } else if (choice === 6) {
                if (!ctx.nickname || ctx.nickname.trim() === "") {
                    var nameParts = (ctx.name || "PLAYER").toUpperCase().split(" ");
                    ctx.nickname = nameParts[0].substring(0, 8);
                }
                return;
            }
        }
    }
    
    /**
     * Show final character summary and confirm
     */
    function showSummary(name, archetype, background, stats, ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("YOUR LEGEND BEGINS");
            LORB.View.line("");
            LORB.View.line("\1wName:\1n        " + name);
            LORB.View.line("\1wArchetype:\1n   " + archetype.name);
            if (ctx.positionName) {
                LORB.View.line("\1wPosition:\1n    " + ctx.positionName);
            }
            LORB.View.line("\1wBackground:\1n  " + background.name);
            LORB.View.line("");
            LORB.View.line("\1h\1ySTATS:\1n");
            
            var statLabels = {
                speed: "Speed",
                threePt: "3PT",
                power: "Power",
                steal: "Steal",
                block: "Block",
                dunk: "Dunk"
            };
            
            for (var stat in stats) {
                if (stats.hasOwnProperty(stat) && statLabels[stat]) {
                    var label = statLabels[stat];
                    while (label.length < 8) label += " ";
                    
                    var bar = "";
                    for (var b = 0; b < stats[stat]; b++) bar += "\1g\xFE\1n";
                    for (var b = stats[stat]; b < MAX_STAT; b++) bar += "\1h\1k\xFE\1n";
                    
                    LORB.View.line("  " + label + " " + bar + " \1w" + stats[stat] + "\1n");
                }
            }
            
            LORB.View.line("");
            LORB.View.line("\1h\1yRESOURCES:\1n");
            LORB.View.line("  Cash:  \1g$" + ctx.cash + "\1n");
            LORB.View.line("  Rep:   " + ctx.rep);
            LORB.View.line("");
            
            // Show appearance
            LORB.View.line("\1h\1yAPPEARANCE:\1n");
            if (ctx.appearance) {
                var skinOpt = findOption(APPEARANCE_OPTIONS.skinColors, ctx.appearance.skin);
                var eyeOpt = findOption(APPEARANCE_OPTIONS.eyeColors, ctx.appearance.eyeColor);
                var jerseyOpt = findOption(APPEARANCE_OPTIONS.jerseyColors, ctx.appearance.jerseyColor);
                LORB.View.line("  Skin: " + (skinOpt ? skinOpt.preview + " " + skinOpt.name : ctx.appearance.skin) +
                    "  Eyes: " + (eyeOpt ? eyeOpt.preview + " " + eyeOpt.name : ctx.appearance.eyeColor));
                LORB.View.line("  Jersey: " + (jerseyOpt ? jerseyOpt.preview : "") + " #" + ctx.appearance.jerseyNumber);
            }
            LORB.View.line("  Nickname: \1c" + (ctx.nickname || "none") + "\1n");
            LORB.View.line("");
            
            // Show starter companion
            if (ctx._starterCompanionName) {
                LORB.View.line("\1h\1ySTARTER TEAMMATE:\1n " + ctx._starterCompanionName);
            }
            LORB.View.line("");
            
            LORB.View.line("\1h\1ySPECIAL:\1n " + archetype.special.name);
            LORB.View.line("  " + archetype.special.description);
            LORB.View.line("");
            
            if (ctx.perks && ctx.perks.length > 0) {
                LORB.View.line("\1h\1yPERKS:\1n " + ctx.perks.join(", "));
                LORB.View.line("");
            }
            
            LORB.View.line("\1wProceed into Rim City? (Y/N/R=Restart)\1n");
            var choice = LORB.View.prompt("");
            
            if (!choice) continue;
            choice = choice.toUpperCase();
            
            if (choice === "Y") {
                return true;
            } else if (choice === "R") {
                return false;  // Signal to restart creation
            }
        }
    }
    
    /**
     * Show welcome screen with companion graphic using RichView
     * Displays the assigned starter companion based on player's archetype
     */
    function showCompanionWelcome(playerName, ctx) {
        var companionName = ctx._starterCompanionName || "Barney Dinosaur";
        var companionIntro = ctx._starterCompanionIntro || "";
        var companionSkin = "barney";
        
        // Determine companion art file based on active teammate
        if (ctx.activeTeammate) {
            var teammate = null;
            for (var i = 0; i < ctx.contacts.length; i++) {
                if (ctx.contacts[i].id === ctx.activeTeammate) {
                    teammate = ctx.contacts[i];
                    break;
                }
            }
            if (teammate && teammate.skin) {
                companionSkin = teammate.skin;
            }
        }
        
        // Map skin to art file
        var artFiles = {
            barney: { path: CHARACTERS_DIR + "barney_dinosaur.bin", w: 40, h: 20 },
            shrek: { path: CHARACTERS_DIR + "shrek.bin", w: 40, h: 20 },
            airbud: { path: CHARACTERS_DIR + "airbud.bin", w: 40, h: 20 },
            sonic: { path: CHARACTERS_DIR + "sonic.bin", w: 40, h: 20 },
            donatello: { path: CHARACTERS_DIR + "donatello.bin", w: 40, h: 20 }
        };
        
        var artConfig = artFiles[companionSkin] || artFiles.barney;
        
        // Try to show with RichView and companion graphic
        if (RichView && typeof BinLoader !== "undefined") {
            try {
                var view = new RichView({
                    zones: [
                        { name: "art", x: 1, y: 1, width: 40, height: 24 },
                        { name: "content", x: 41, y: 1, width: 40, height: 24 }
                    ],
                    theme: "lorb"
                });
                
                // Try to load companion art into art zone
                var artFrame = view.getZone("art");
                var artLoaded = false;
                
                if (artFrame) {
                    try {
                        var binData = BinLoader.loadBinFile(artConfig.path);
                        if (binData) {
                            // Draw border
                            artFrame.gotoxy(1, 1);
                            artFrame.putmsg("\1n\1h\1m\xDA" + repeatChar("\xC4", 36) + "\xBF\1n");
                            
                            for (var y = 2; y < 23; y++) {
                                artFrame.gotoxy(1, y);
                                artFrame.putmsg("\1n\1h\1m\xB3\1n");
                                artFrame.gotoxy(38, y);
                                artFrame.putmsg("\1n\1h\1m\xB3\1n");
                            }
                            
                            artFrame.gotoxy(1, 23);
                            artFrame.putmsg("\1n\1h\1m\xC0" + repeatChar("\xC4", 36) + "\xD9\1n");
                            
                            // Render companion art (40x20 .bin file)
                            var offset = 0;
                            var artStartY = 2;
                            var artStartX = 2;
                            var artWidth = Math.min(artConfig.w, 35);
                            var artHeight = Math.min(artConfig.h, 20);
                            
                            for (var ay = 0; ay < artHeight; ay++) {
                                for (var ax = 0; ax < artConfig.w; ax++) {
                                    if (offset + 1 < binData.length) {
                                        var ch = binData.charAt(offset++);
                                        var attr = binData.charCodeAt(offset++);
                                        
                                        if (ax < artWidth) {
                                            try {
                                                artFrame.setData(artStartX + ax - 1, artStartY + ay - 1, ch, attr, false);
                                            } catch (e) {
                                                // Ignore rendering errors
                                            }
                                        }
                                    } else {
                                        break;
                                    }
                                }
                            }
                            artLoaded = true;
                        }
                    } catch (e) {
                        log(LOG_WARNING, "[CHAR_CREATE] Failed to load companion art: " + e);
                    }
                }
                
                if (!artLoaded && artFrame) {
                    // Draw placeholder
                    artFrame.gotoxy(1, 1);
                    artFrame.putmsg("\1n\1h\1m\xDA" + repeatChar("\xC4", 36) + "\xBF\1n");
                    for (var y = 2; y < 23; y++) {
                        artFrame.gotoxy(1, y);
                        artFrame.putmsg("\1n\1h\1m\xB3\1n");
                        artFrame.gotoxy(38, y);
                        artFrame.putmsg("\1n\1h\1m\xB3\1n");
                    }
                    artFrame.gotoxy(1, 23);
                    artFrame.putmsg("\1n\1h\1m\xC0" + repeatChar("\xC4", 36) + "\xD9\1n");
                    artFrame.gotoxy(10, 10);
                    artFrame.putmsg("\1m\1h" + companionName.toUpperCase() + "\1n");
                    artFrame.gotoxy(12, 12);
                    artFrame.putmsg("\1m\"Sup, rook.\"\1n");
                }
                
                // Content zone - welcome message
                view.setContentZone("content");
                view.setCursorY(0);
                
                view.line("\1h\1yWELCOME TO RIM CITY\1n");
                view.line("\1y" + repeatChar("\xC4", 38) + "\1n");
                view.blank();
                view.line("\1h\1w" + playerName + "\1n enters the city.");
                view.blank();
                view.line("The courts never sleep here.");
                view.line("Neither do the legends.");
                view.blank();
                
                // Show companion intro message
                if (companionIntro) {
                    var introLines = companionIntro.split("\n");
                    for (var li = 0; li < introLines.length; li++) {
                        view.line(introLines[li]);
                    }
                } else {
                    view.line("\1m\1h" + companionName + "\1n is waiting at the");
                    view.line("courts. He's your first teammate on the");
                    view.line("path to greatness.");
                }
                
                view.blank();
                view.blank();
                view.line("\1h\1cThe legends are watching.\1n");
                view.blank();
                view.blank();
                view.info("\1wPress any key to begin...\1n");
                
                view.render();
                console.getkey();
                view.close();
                return;
            } catch (e) {
                log(LOG_WARNING, "[CHAR_CREATE] RichView welcome failed: " + e);
            }
        }
        
        // Fallback to simple text welcome
        LORB.View.clear();
        LORB.View.line("");
        LORB.View.line("\1h\1y" + playerName + " enters Rim City.\1n");
        LORB.View.line("");
        
        if (companionIntro) {
            var introLines = companionIntro.split("\n");
            for (var li = 0; li < introLines.length; li++) {
                LORB.View.line(introLines[li]);
            }
        } else {
            LORB.View.line("\1m" + companionName + "\1n is waiting at the courts.");
            LORB.View.line("He's your first teammate on the path to greatness.");
        }
        
        LORB.View.line("");
        LORB.View.line("The legends are watching.");
        LORB.View.line("");
        LORB.View.line("\1wPress any key to begin...\1n");
        console.getkey();
    }
    
    /**
     * Main character creation flow
     * Returns a fully initialized character context, or null if user quits
     */
    function runCharacterCreation(user, systemObj) {
        while (true) {
            // Initialize a fresh context
            var ctx = {
                _user: user,
                seed: (systemObj.timer ^ (Date.now ? Date.now() : time())) & 0x7fffffff,
                userHandle: user && user.alias ? user.alias : "PLAYER",
                dayTurns: LORB.Config.DEFAULT_TURNS,
                flags: {},
                xp: 0,
                level: 1,
                gamesPlayed: 0,
                wins: 0,
                losses: 0
            };
            
            // Show intro
            showIntro();
            
            // Get player name
            var defaultName = ctx.userHandle;
            var name = getPlayerName(defaultName);
            ctx.name = name;
            
            // Choose archetype
            var archetype = chooseArchetype();
            ctx.archetype = archetype.id;
            ctx.special = archetype.special.id;
            
            // Allocate stats
            var stats = allocateStats(archetype);
            
            // Choose background
            var background = chooseBackground();
            ctx.background = background.id;
            
            // Apply background effects
            applyBackground(stats, background, ctx);
            
            // Store final stats
            ctx.stats = stats;
            
            // Customize appearance (skin, eyes, jersey, nickname)
            customizeAppearance(ctx);
            
            // Add starter teammate (Barney Dinosaur)
            if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.createStarterTeammate) {
                LORB.Util.Contacts.createStarterTeammate(ctx);
            }
            
            // Show summary
            var confirmed = showSummary(name, archetype, background, stats, ctx);
            
            if (confirmed) {
                // Save the new character
                LORB.Persist.save(ctx);
                
                // Show welcome message with companion graphic
                showCompanionWelcome(name, ctx);
                
                return ctx;
            }
            // If not confirmed (user chose restart), loop continues
        }
    }
    
    // Export to LORB namespace
    LORB.CharacterCreation = {
        run: runCharacterCreation,
        BASE_STATS: BASE_STATS,
        STARTING_POINTS: STARTING_POINTS,
        MAX_STAT: MAX_STAT,
        MIN_STAT: MIN_STAT
    };
    
})();
