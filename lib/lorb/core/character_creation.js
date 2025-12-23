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
}

// Load BinLoader for sprite preview
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
    }
}

(function() {
    
    var RichView = _ccRichView;
    
    // ESC key code for quit detection
    var ESC_KEY = '\x1b';
    var QUIT_SIGNAL = "__QUIT__";
    
    /**
     * Get a key, returning QUIT_SIGNAL if ESC is pressed
     */
    function getKeyWithEscape() {
        var key = console.getkey(K_NOSPIN);
        if (key === ESC_KEY) return QUIT_SIGNAL;
        return key;
    }
    
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
    // Full 16-color palette for eye color and jersey lettering
    var APPEARANCE_OPTIONS = {
        skinColors: [
            { id: "brown", name: "\1wBrown\1n", preview: "\1" + String.fromCharCode(2) + "\xDB\1n" },
            { id: "lightgray", name: "\1wLight\1n", preview: "\1w\xDB\1n" },
            { id: "magenta", name: "\1wMagenta\1n", preview: "\1m\xDB\1n" }
        ],
        eyeColors: [
            // Full 16 colors for eyes
            { id: "BLACK", name: "\1wBlack\1n", preview: "\1k\xDB\1n" },
            { id: "BLUE", name: "\1wBlue\1n", preview: "\1b\xDB\1n" },
            { id: "GREEN", name: "\1wGreen\1n", preview: "\1g\xDB\1n" },
            { id: "CYAN", name: "\1wCyan\1n", preview: "\1c\xDB\1n" },
            { id: "RED", name: "\1wRed\1n", preview: "\1r\xDB\1n" },
            { id: "MAGENTA", name: "\1wMagenta\1n", preview: "\1m\xDB\1n" },
            { id: "BROWN", name: "\1wBrown\1n", preview: "\1y\xDB\1n" },
            { id: "LIGHTGRAY", name: "\1wLight Gray\1n", preview: "\1w\xDB\1n" },
            { id: "DARKGRAY", name: "\1wDark Gray\1n", preview: "\1k\1h\xDB\1n" },
            { id: "LIGHTBLUE", name: "\1wLight Blue\1n", preview: "\1b\1h\xDB\1n" },
            { id: "LIGHTGREEN", name: "\1wLight Green\1n", preview: "\1g\1h\xDB\1n" },
            { id: "LIGHTCYAN", name: "\1wLight Cyan\1n", preview: "\1c\1h\xDB\1n" },
            { id: "LIGHTRED", name: "\1wLight Red\1n", preview: "\1r\1h\xDB\1n" },
            { id: "LIGHTMAGENTA", name: "\1wLight Magenta\1n", preview: "\1m\1h\xDB\1n" },
            { id: "YELLOW", name: "\1wYellow\1n", preview: "\1y\1h\xDB\1n" },
            { id: "WHITE", name: "\1wWhite\1n", preview: "\1w\1h\xDB\1n" }
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
            // Full 16 colors for jersey lettering
            { id: "BLACK", name: "\1wBlack\1n", preview: "\1k\xDB\1n" },
            { id: "BLUE", name: "\1wBlue\1n", preview: "\1b\xDB\1n" },
            { id: "GREEN", name: "\1wGreen\1n", preview: "\1g\xDB\1n" },
            { id: "CYAN", name: "\1wCyan\1n", preview: "\1c\xDB\1n" },
            { id: "RED", name: "\1wRed\1n", preview: "\1r\xDB\1n" },
            { id: "MAGENTA", name: "\1wMagenta\1n", preview: "\1m\xDB\1n" },
            { id: "BROWN", name: "\1wBrown\1n", preview: "\1y\xDB\1n" },
            { id: "LIGHTGRAY", name: "\1wLight Gray\1n", preview: "\1w\xDB\1n" },
            { id: "DARKGRAY", name: "\1wDark Gray\1n", preview: "\1k\1h\xDB\1n" },
            { id: "LIGHTBLUE", name: "\1wLight Blue\1n", preview: "\1b\1h\xDB\1n" },
            { id: "LIGHTGREEN", name: "\1wLight Green\1n", preview: "\1g\1h\xDB\1n" },
            { id: "LIGHTCYAN", name: "\1wLight Cyan\1n", preview: "\1c\1h\xDB\1n" },
            { id: "LIGHTRED", name: "\1wLight Red\1n", preview: "\1r\1h\xDB\1n" },
            { id: "LIGHTMAGENTA", name: "\1wLight Magenta\1n", preview: "\1m\1h\xDB\1n" },
            { id: "YELLOW", name: "\1wYellow\1n", preview: "\1y\1h\xDB\1n" },
            { id: "WHITE", name: "\1wWhite\1n", preview: "\1w\1h\xDB\1n" }
        ]
    };
    
    // Art paths for RichView screens
    var GUIDE_ART_PATH = "/sbbs/xtrn/nba_jam/assets/lorb/game_guide.bin";
    var GUIDE_ART_W = 40;
    var GUIDE_ART_H = 20;
    
    /**
     * Repeat a character n times
     */
    function repeatChar(ch, n) {
        var result = "";
        for (var i = 0; i < n; i++) result += ch;
        return result;
    }
    
    /**
     * Display the intro narrative using RichView with art + figlet
     * Returns QUIT_SIGNAL if user presses ESC, otherwise undefined
     */
    function showIntro() {
        // Try RichView with art on left, narrative on right
        if (RichView && typeof BinLoader !== "undefined") {
            try {
                var view = new RichView({
                    zones: [
                        { name: "art", x: 1, y: 1, width: 40, height: 20 },
                        { name: "header", x: 41, y: 1, width: 40, height: 4 },
                        { name: "content", x: 41, y: 5, width: 40, height: 16 },
                        { name: "footer", x: 1, y: 21, width: 80, height: 4 }
                    ],
                    theme: "lorb"
                });
                
                // Load game_guide.bin art into art zone
                var artFrame = view.getZone("art");
                if (artFrame && file_exists(GUIDE_ART_PATH)) {
                    BinLoader.loadIntoFrame(artFrame, GUIDE_ART_PATH, GUIDE_ART_W, GUIDE_ART_H, 1, 1);
                }
                
                // Render Figlet banner "LORB" in header zone
                var headerFrame = view.getZone("header");
                if (headerFrame && LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
                    LORB.Util.FigletBanner.renderToFrame(headerFrame, "LORB", RED | HIGH);
                } else if (headerFrame) {
                    headerFrame.gotoxy(5, 2);
                    headerFrame.putmsg("\1h\1rL E G E N D   O F   T H E   R E D   B U L L\1n");
                }
                
                // Content zone - Mars Blackmon style narrative
                view.setContentZone("content");
                view.setCursorY(0);
                
                view.line("\1cYo yo YO!\1n What's up, rookie?");
                view.blank();
                view.line("You tryna ball? For REAL?");
                view.line("Aight, aight, I see you...");
                view.blank();
                view.line("This right here? This is");
                view.line("\1rThe Court of Airness.\1n");
                view.line("Where \1rThe Red Bull\1n lives.");
                view.blank();
                view.line("Nobody beat him yet.");
                view.line("\1yNOBODY.\1n");
                view.blank();
                view.line("But yo, it's gotta be YOU!");
                
                // Footer zone - prompt
                var footerFrame = view.getZone("footer");
                if (footerFrame) {
                    footerFrame.gotoxy(2, 2);
                    footerFrame.putmsg("\1h\1wFirst things first - let me get to know you.\1n");
                    footerFrame.gotoxy(2, 3);
                    footerFrame.putmsg("\1cHit any key to continue, \1h\1kESC\1n\1c to quit\1n");
                }
                
                view.render();
                var key = getKeyWithEscape();
                view.close();
                if (key === QUIT_SIGNAL) return QUIT_SIGNAL;
                return;
            } catch (e) {
            }
        }
        
        // Fallback to simple text
        LORB.View.clear();
        
        var lines = [
            "",
            "\1h\1rL E G E N D   O F   T H E   R E D   B U L L\1n",
            "",
            "\1cYo yo YO! What's good, rookie?\1n",
            "",
            "You tryna ball? For REAL? Aight, I see you...",
            "",
            "This right here is The Court of Airness.",
            "Where \1rThe Red Bull\1n lives.",
            "",
            "Nobody beat him yet. NOBODY.",
            "",
            "But yo, \1yit's gotta be YOU!\1n",
            "",
            "\1wFirst things first - let me get to know you.\1n",
            ""
        ];
        
        for (var i = 0; i < lines.length; i++) {
            LORB.View.line(lines[i]);
        }
        
        LORB.View.line("\1cHit any key to continue, \1h\1kESC\1n\1c to quit\1n");
        var key = getKeyWithEscape();
        if (key === QUIT_SIGNAL) return QUIT_SIGNAL;
    }
    
    /**
     * Get player name using RichView
     */
    function getPlayerName(defaultName) {
        // Try RichView with art and figlet header
        if (RichView && typeof BinLoader !== "undefined") {
            try {
                var view = new RichView({
                    zones: [
                        { name: "art", x: 1, y: 1, width: 40, height: 20 },
                        { name: "header", x: 41, y: 1, width: 40, height: 4 },
                        { name: "content", x: 41, y: 5, width: 40, height: 16 },
                        { name: "footer", x: 1, y: 21, width: 80, height: 4 }
                    ],
                    theme: "lorb"
                });
                
                // Load art
                var artFrame = view.getZone("art");
                if (artFrame && file_exists(GUIDE_ART_PATH)) {
                    BinLoader.loadIntoFrame(artFrame, GUIDE_ART_PATH, GUIDE_ART_W, GUIDE_ART_H, 1, 1);
                }
                
                // Figlet header
                var headerFrame = view.getZone("header");
                if (headerFrame && LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
                    LORB.Util.FigletBanner.renderToFrame(headerFrame, "NAME", CYAN | HIGH);
                } else if (headerFrame) {
                    headerFrame.gotoxy(5, 2);
                    headerFrame.putmsg("\1h\1cWHAT DO THEY CALL YOU?\1n");
                }
                
                // Content zone - Mars Blackmon style
                view.setContentZone("content");
                view.setCursorY(0);
                
                view.line("\1wAight, what they call you?\1n");
                view.blank();
                view.line("Everybody got a name, right?");
                view.line("Even MJ was just \1yMike\1n once!");
                view.blank();
                view.line("\1kDefault: " + defaultName + "\1n");
                view.blank();
                
                view.render();
                
                // Get input in footer
                var footerFrame = view.getZone("footer");
                if (footerFrame) {
                    footerFrame.gotoxy(2, 2);
                    footerFrame.putmsg("\1wDrop your name (Enter=default): \1n");
                    view.render();
                }
                
                var name = console.getstr("", 20);
                view.close();
                
                if (!name || name.trim() === "") {
                    name = defaultName;
                }
                
                // Sanitize: max 20 chars, alphanumeric and spaces only
                name = name.substring(0, 20).replace(/[^a-zA-Z0-9 _-]/g, "");
                if (!name || name.trim() === "") {
                    name = defaultName;
                }
                
                return name.trim();
            } catch (e) {
            }
        }
        
        // Fallback
        LORB.View.clear();
        LORB.View.header("WHAT THEY CALL YOU?");
        LORB.View.line("");
        LORB.View.line("Aight, what's your name? Everybody got one!");
        LORB.View.line("");
        LORB.View.line("\1kDefault: " + defaultName + "\1n");
        LORB.View.line("");
        
        var name = LORB.View.prompt("Drop your name (Enter=default): ");
        
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
     * Choose archetype using RichView with lightbar and dynamic info display
     */
    function chooseArchetype() {
        var archetypes = LORB.Data.getArchetypeList();
        
        // Try RichView with lightbar
        if (RichView && typeof BinLoader !== "undefined") {
            try {
                while (true) {
                    var view = new RichView({
                        zones: [
                            { name: "art", x: 1, y: 1, width: 40, height: 20 },
                            { name: "header", x: 41, y: 1, width: 40, height: 4 },
                            { name: "content", x: 41, y: 5, width: 40, height: 16 },
                            { name: "footer", x: 1, y: 21, width: 80, height: 4 }
                        ],
                        theme: "lorb"
                    });
                    
                    // Art zone - will show selected archetype details
                    var artFrame = view.getZone("art");
                    if (artFrame && file_exists(GUIDE_ART_PATH)) {
                        BinLoader.loadIntoFrame(artFrame, GUIDE_ART_PATH, GUIDE_ART_W, GUIDE_ART_H, 1, 1);
                    }
                    
                    // Helper to draw archetype details in footer
                    var drawArchetypeDetail = function(arch, showConfirm) {
                        var footerFrame = view.getZone("footer");
                        if (!footerFrame) return;
                        
                        footerFrame.clear();
                        
                        // Build stat mods string
                        var mods = [];
                        for (var stat in arch.statMods) {
                            if (arch.statMods.hasOwnProperty(stat)) {
                                var val = arch.statMods[stat];
                                var prefix = val > 0 ? "\1g+" : "\1r";
                                mods.push(prefix + val + " " + stat.toUpperCase() + "\1n");
                            }
                        }
                        var modStr = mods.length > 0 ? mods.join(", ") : "Balanced stats";
                        
                        if (showConfirm) {
                            // Show confirmation prompt with flavor text - Mars style
                            footerFrame.gotoxy(2, 1);
                            footerFrame.putmsg("\1h\1w" + arch.name + "\1n - " + arch.flavorText.split("\n")[0]);
                            footerFrame.gotoxy(2, 2);
                            var flavor2 = arch.flavorText.split("\n")[1] || "";
                            footerFrame.putmsg("\1k" + flavor2 + "\1n");
                            footerFrame.gotoxy(2, 3);
                            footerFrame.putmsg("\1yThat's YOU? " + arch.name + "? (Y/N)\1n");
                        } else {
                            footerFrame.gotoxy(2, 1);
                            footerFrame.putmsg("\1h\1w" + arch.name + "\1n  " + modStr);
                            footerFrame.gotoxy(2, 2);
                            footerFrame.putmsg("\1c" + arch.description + "\1n");
                            // Truncate special description to fit on one line (max ~74 chars)
                            var specialDesc = arch.special.name + " - " + arch.special.description;
                            if (specialDesc.length > 70) {
                                specialDesc = specialDesc.substring(0, 67) + "...";
                            }
                            footerFrame.gotoxy(2, 3);
                            footerFrame.putmsg("\1ySpecial:\1n " + specialDesc);
                        }
                        
                        view.render();
                    };
                    
                    // Figlet header
                    var headerFrame = view.getZone("header");
                    if (headerFrame && LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
                        LORB.Util.FigletBanner.renderToFrame(headerFrame, "STYLE", YELLOW | HIGH);
                    } else if (headerFrame) {
                        headerFrame.gotoxy(5, 2);
                        headerFrame.putmsg("\1h\1yCHOOSE YOUR PLAYSTYLE\1n");
                    }
                    
                    // Content zone - lightbar menu with Mars Blackmon style
                    view.setContentZone("content");
                    view.setCursorY(0);
                    
                    view.line("How YOU gonna dominate out there?");
                    view.blank();
                    
                    // Build menu items - avoid embedded color codes that confuse lightbar
                    var menuItems = [];
                    for (var i = 0; i < archetypes.length; i++) {
                        var arch = archetypes[i];
                        var pos = LORB.Data.getPositionFromArchetype(arch.id);
                        // Use plain text, let lightbar handle all coloring
                        menuItems.push({
                            text: (i + 1) + ") " + arch.name + " (" + pos.name + ")",
                            value: arch.id,
                            _archetype: arch
                        });
                    }
                    
                    // Draw initial detail for first archetype
                    drawArchetypeDetail(archetypes[0], false);
                    
                    // Menu with onSelect callback
                    var choice = view.menu(menuItems, {
                        y: 3,
                        height: 10,
                        onSelect: function(item, index, richView, lb) {
                            if (item._archetype) {
                                drawArchetypeDetail(item._archetype, false);
                            }
                        }
                    });
                    
                    // ESC pressed - user wants to quit
                    if (choice === null) {
                        view.close();
                        return QUIT_SIGNAL;
                    }
                    
                    if (choice) {
                        // Find selected archetype
                        var selected = null;
                        for (var i = 0; i < archetypes.length; i++) {
                            if (archetypes[i].id === choice) {
                                selected = archetypes[i];
                                break;
                            }
                        }
                        
                        if (selected) {
                            // Show confirmation in footer (same view)
                            drawArchetypeDetail(selected, true);
                            
                            var key = console.getkeys("YNyn\x1b", 0);
                            if (key === ESC_KEY) {
                                view.close();
                                return QUIT_SIGNAL;
                            }
                            if (key && key.toUpperCase() === "Y") {
                                view.close();
                                return selected;
                            }
                            // If N, loop continues (view recreated)
                        }
                    }
                    
                    view.close();
                }
            } catch (e) {
            }
        }
        
        // Fallback to original
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
            // Build valid keys: 1,2,3...N plus ESC
            var validKeys = "";
            for (var k = 1; k <= archetypes.length; k++) validKeys += k;
            validKeys += "\x1b";  // ESC
            var choice = LORB.View.getKeys("Choose (1-" + archetypes.length + ", \1h\1kESC\1n=quit): ", validKeys);
            
            // Check for ESC quit
            if (choice === ESC_KEY) {
                return QUIT_SIGNAL;
            }
            
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
            LORB.View.header("BUILD YOUR GAME");
            LORB.View.line("");
            LORB.View.line("Yo, you got " + STARTING_POINTS + " points to spread around!");
            LORB.View.line("Stats go from " + MIN_STAT + " to " + MAX_STAT + ". Make 'em count!");
            LORB.View.line("");
            LORB.View.line("\1h\1yPoints Left: " + pointsRemaining + "\1n");
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
            LORB.View.line("\1h\1k[ESC] Quit game\1n");
            LORB.View.line("");
            
            // Single-key input for stat allocation
            var input = LORB.View.getKeys("Add point (S/3/P/T/B/D/R/Q): ", "S3PTBDRQs3ptbdrq\x1b");
            
            // Check for ESC quit
            if (input === ESC_KEY) {
                return QUIT_SIGNAL;
            }
            
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
                    console.getkey(K_NOSPIN);
                    continue;
                }
                
                if (stats[targetStat] >= MAX_STAT) {
                    LORB.View.warn(statLabels[targetStat] + " is already at maximum!");
                    console.getkey(K_NOSPIN);
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
                        console.getkey(K_NOSPIN);
                        continue;
                    }
                    
                    stats[targetStat]--;
                    pointsRemaining++;
                }
            }
        }
    }
    
    /**
     * Choose background using RichView with lightbar and dynamic info display
     */
    function chooseBackground() {
        var backgrounds = LORB.Data.getBackgroundList();
        
        // Try RichView with lightbar
        if (RichView && typeof BinLoader !== "undefined") {
            try {
                while (true) {
                    var view = new RichView({
                        zones: [
                            { name: "art", x: 1, y: 1, width: 40, height: 20 },
                            { name: "header", x: 41, y: 1, width: 40, height: 4 },
                            { name: "content", x: 41, y: 5, width: 40, height: 16 },
                            { name: "footer", x: 1, y: 21, width: 80, height: 4 }
                        ],
                        theme: "lorb"
                    });
                    
                    // Art zone
                    var artFrame = view.getZone("art");
                    if (artFrame && file_exists(GUIDE_ART_PATH)) {
                        BinLoader.loadIntoFrame(artFrame, GUIDE_ART_PATH, GUIDE_ART_W, GUIDE_ART_H, 1, 1);
                    }
                    
                    // Helper to draw background details in footer
                    var drawBackgroundDetail = function(bg, showConfirm) {
                        var footerFrame = view.getZone("footer");
                        if (!footerFrame) return;
                        
                        footerFrame.clear();
                        
                        // Build mods string
                        var mods = [];
                        if (bg.resourceMods.cash !== 0) {
                            var prefix = bg.resourceMods.cash > 0 ? "\1g+" : "\1r";
                            mods.push(prefix + "$" + bg.resourceMods.cash + "\1n");
                        }
                        if (bg.resourceMods.rep !== 0) {
                            var prefix = bg.resourceMods.rep > 0 ? "\1g+" : "\1r";
                            mods.push(prefix + bg.resourceMods.rep + " Rep\1n");
                        }
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
                        var modStr = mods.length > 0 ? mods.join(", ") : "Balanced start";
                        
                        if (showConfirm) {
                            // Show confirmation prompt with flavor text - Mars style
                            footerFrame.gotoxy(2, 1);
                            footerFrame.putmsg("\1h\1w" + bg.name + "\1n - " + bg.flavorText.split("\n")[0]);
                            footerFrame.gotoxy(2, 2);
                            var flavor2 = bg.flavorText.split("\n")[1] || "";
                            footerFrame.putmsg("\1k" + flavor2 + "\1n");
                            footerFrame.gotoxy(2, 3);
                            footerFrame.putmsg("\1yThat's your story? " + bg.name + "? (Y/N)\1n");
                        } else {
                            footerFrame.gotoxy(2, 1);
                            footerFrame.putmsg("\1h\1w" + bg.name + "\1n  " + modStr);
                            footerFrame.gotoxy(2, 2);
                            // Truncate description if too long
                            var desc = bg.description;
                            if (desc.length > 74) desc = desc.substring(0, 71) + "...";
                            footerFrame.putmsg("\1c" + desc + "\1n");
                            
                            // Show flavor text snippet on line 3
                            var flavorSnippet = bg.flavorText.split("\n")[0];
                            if (flavorSnippet.length > 72) flavorSnippet = flavorSnippet.substring(0, 69) + "...";
                            footerFrame.gotoxy(2, 3);
                            footerFrame.putmsg("\1k\1h\"" + flavorSnippet + "\"\1n");
                        }
                        
                        view.render();
                    };
                    
                    // Figlet header
                    var headerFrame = view.getZone("header");
                    if (headerFrame && LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
                        LORB.Util.FigletBanner.renderToFrame(headerFrame, "ORIGIN", MAGENTA | HIGH);
                    } else if (headerFrame) {
                        headerFrame.gotoxy(5, 2);
                        headerFrame.putmsg("\1h\1mWHERE YOU FROM?\1n");
                    }
                    
                    // Content zone - lightbar menu Mars Blackmon style
                    view.setContentZone("content");
                    view.setCursorY(0);
                    
                    view.line("Where'd you learn to ball like that?");
                    view.blank();
                    
                    // Build menu items - plain text, let lightbar handle coloring
                    var menuItems = [];
                    for (var i = 0; i < backgrounds.length; i++) {
                        var bg = backgrounds[i];
                        menuItems.push({
                            text: (i + 1) + ") " + bg.name,
                            value: bg.id,
                            _background: bg
                        });
                    }
                    
                    // Draw initial detail for first background
                    drawBackgroundDetail(backgrounds[0], false);
                    
                    // Menu with onSelect callback
                    var choice = view.menu(menuItems, {
                        y: 3,
                        height: 10,
                        onSelect: function(item, index, richView, lb) {
                            if (item._background) {
                                drawBackgroundDetail(item._background, false);
                            }
                        }
                    });
                    
                    // ESC pressed - user wants to quit
                    if (choice === null) {
                        view.close();
                        return QUIT_SIGNAL;
                    }
                    
                    if (choice) {
                        // Find selected background
                        var selected = null;
                        for (var i = 0; i < backgrounds.length; i++) {
                            if (backgrounds[i].id === choice) {
                                selected = backgrounds[i];
                                break;
                            }
                        }
                        
                        if (selected) {
                            // Show confirmation in footer (same view)
                            drawBackgroundDetail(selected, true);
                            
                            var key = console.getkeys("YNyn\x1b", 0);
                            if (key === ESC_KEY) {
                                view.close();
                                return QUIT_SIGNAL;
                            }
                            if (key && key.toUpperCase() === "Y") {
                                view.close();
                                return selected;
                            }
                            // If N, loop continues (view recreated)
                        }
                    }
                    
                    view.close();
                }
            } catch (e) {
            }
        }
        
        // Fallback to original
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
            
            // Build valid keys: 1,2,3...N plus ESC
            var validBgKeys = "";
            for (var bk = 1; bk <= backgrounds.length; bk++) validBgKeys += bk;
            validBgKeys += "\x1b";  // ESC
            var choice = LORB.View.getKeys("Choose (1-" + backgrounds.length + ", \1h\1kESC\1n=quit): ", validBgKeys);
            
            // Check for ESC quit
            if (choice === ESC_KEY) {
                return QUIT_SIGNAL;
            }
            
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
                console.getkey(K_NOSPIN);
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
     * Supports all 16 colors
     */
    function getEyeFgColorForPreview(colorName) {
        if (!colorName) return LIGHTGRAY;
        var map = {
            "BLACK": BLACK,
            "BLUE": BLUE,
            "GREEN": GREEN,
            "CYAN": CYAN,
            "RED": RED,
            "MAGENTA": MAGENTA,
            "BROWN": BROWN,
            "LIGHTGRAY": LIGHTGRAY,
            "DARKGRAY": DARKGRAY | HIGH,
            "LIGHTBLUE": BLUE | HIGH,
            "LIGHTGREEN": GREEN | HIGH,
            "LIGHTCYAN": CYAN | HIGH,
            "LIGHTRED": RED | HIGH,
            "LIGHTMAGENTA": MAGENTA | HIGH,
            "YELLOW": YELLOW | HIGH,
            "WHITE": WHITE | HIGH
        };
        return map[colorName.toUpperCase()] || LIGHTGRAY;
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
        // Use different default skin/eye so eyes are visible
        ctx.appearance = ctx.appearance || {};
        ctx.appearance.skin = ctx.appearance.skin || "brown";
        ctx.appearance.eyeColor = ctx.appearance.eyeColor || "LIGHTGRAY";  // Different from skin so visible
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
            
            // Content zone - appearance options Mars Blackmon style
            view.setContentZone("content");
            view.setCursorY(0);
            
            view.line("\1h\1cFRESH THREADS\1n");
            view.line("\1c" + repeatChar("\xC4", 38) + "\1n");
            view.blank();
            view.line("Gotta look GOOD out there!");
            view.line("Make 'em remember your face.");
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
            
            view.info("\1w[Up/Dn]\1n Select  \1w[Lt/Rt]\1n Change  \1w[D]\1none  \1h\1k[ESC]\1nQuit");
            
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
            
            // ESC pressed - user wants to quit the game
            if (choice === null) {
                return QUIT_SIGNAL;
            }
            
            if (choice === "done") {
                // Ensure nickname defaults to something if not set
                if (!ctx.nickname || ctx.nickname.trim() === "") {
                    var nameParts = (ctx.name || "PLYR").split(" ");
                    ctx.nickname = nameParts[0].substring(0, 5);  // Max 5 chars
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
                LORB.View.line("Keep it short (5 chars max) for best display.");
                LORB.View.line("");
                var nickInput = LORB.View.prompt("Nickname: ");
                if (nickInput) {
                    // Max 5 chars, preserve case (don't uppercase)
                    ctx.nickname = nickInput.substring(0, 5).replace(/[^a-zA-Z0-9_\-!]/g, "");
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
            LORB.View.header("FRESH THREADS");
            LORB.View.line("");
            LORB.View.line("Gotta look GOOD out there! Make 'em remember you.");
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
            LORB.View.line("\1h\1k[ESC] Quit game\1n");
            LORB.View.line("");
            
            // Single-key input for menu selection
            var input = LORB.View.getKeys("Choose option (1-6): ", "123456\x1b");
            
            // Check for ESC quit
            if (input === ESC_KEY) {
                return QUIT_SIGNAL;
            }
            
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
                LORB.View.line("Keep it short (5 chars max) for best display.");
                var nickInput = LORB.View.prompt("Enter nickname: ");
                if (nickInput) {
                    // Max 5 chars, preserve case (don't uppercase)
                    ctx.nickname = nickInput.substring(0, 5).replace(/[^a-zA-Z0-9_\-!]/g, "");
                }
            } else if (choice === 6) {
                if (!ctx.nickname || ctx.nickname.trim() === "") {
                    var nameParts = (ctx.name || "PLYR").split(" ");
                    ctx.nickname = nameParts[0].substring(0, 5);  // Max 5 chars
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
            // Ensure we reset to LORB.View mode after RichView screens
            if (typeof LORB !== "undefined" && LORB.View && LORB.View.init) {
                LORB.View.init();
            }
            LORB.View.clear();
            LORB.View.header("THAT'S YOU!");
            LORB.View.line("");
            LORB.View.line("\1wName:\1n        " + name);
            LORB.View.line("\1wPlaystyle:\1n   " + archetype.name);
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
            
            LORB.View.line("\1wLookin' good! Ready to ball? (\1gY\1w=Yes/\1yN\1w=No/\1cR\1w=Start Over/\1h\1kESC\1n\1w=Quit)\1n");
            // Single-key input for confirmation
            var choice = LORB.View.getKeys("", "YNRynr\x1b");
            
            // Check for ESC quit
            if (choice === ESC_KEY) {
                return QUIT_SIGNAL;
            }
            
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
            if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getContact) {
                teammate = LORB.Util.Contacts.getContact(ctx, ctx.activeTeammate);
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
                
                view.line("\1h\1yYO, YOU MADE IT!\1n");
                view.line("\1y" + repeatChar("\xC4", 38) + "\1n");
                view.blank();
                view.line("\1h\1w" + playerName + "\1n steps onto the courts!");
                view.blank();
                view.line("Welcome to Rim City, baby!");
                view.line("This is where LEGENDS are made!");
                view.blank();
                
                // Show companion intro message
                if (companionIntro) {
                    var introLines = companionIntro.split("\n");
                    for (var li = 0; li < introLines.length; li++) {
                        view.line(introLines[li]);
                    }
                } else {
                    view.line("\1m\1h" + companionName + "\1n is gonna be your");
                    view.line("running mate. Y'all bout to do some");
                    view.line("DAMAGE out there!");
                }
                
                view.blank();
                view.blank();
                view.line("\1h\1cTime to show 'em what you got!\1n");
                view.blank();
                view.blank();
                view.info("\1wHit any key and let's GO!\1n");
                
                view.render();
                console.getkey(K_NOSPIN);
                view.close();
                return;
            } catch (e) {
            }
        }
        
        // Fallback to simple text welcome
        LORB.View.clear();
        LORB.View.line("");
        LORB.View.line("\1h\1y" + playerName + " steps onto the courts!\1n");
        LORB.View.line("");
        
        if (companionIntro) {
            var introLines = companionIntro.split("\n");
            for (var li = 0; li < introLines.length; li++) {
                LORB.View.line(introLines[li]);
            }
        } else {
            LORB.View.line("\1m" + companionName + "\1n is gonna be your running mate.");
            LORB.View.line("Y'all bout to do some DAMAGE out there!");
        }
        
        LORB.View.line("");
        LORB.View.line("Time to show 'em what you got!");
        LORB.View.line("");
        LORB.View.line("\1wHit any key and let's GO!\1n");
        console.getkey(K_NOSPIN);
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
            var introResult = showIntro();
            if (introResult === QUIT_SIGNAL) return null;
            
            // Get player name
            var defaultName = ctx.userHandle;
            var name = getPlayerName(defaultName);
            if (name === QUIT_SIGNAL) return null;
            ctx.name = name;
            
            // Choose archetype
            var archetype = chooseArchetype();
            if (archetype === QUIT_SIGNAL) return null;
            ctx.archetype = archetype.id;
            ctx.special = archetype.special.id;
            
            // Allocate stats
            var stats = allocateStats(archetype);
            if (stats === QUIT_SIGNAL) return null;
            
            // Choose background
            var background = chooseBackground();
            if (background === QUIT_SIGNAL) return null;
            ctx.background = background.id;
            
            // Apply background effects
            applyBackground(stats, background, ctx);
            
            // Store final stats
            ctx.stats = stats;
            
            // Customize appearance (skin, eyes, jersey, nickname)
            var appearanceResult = customizeAppearance(ctx);
            if (appearanceResult === QUIT_SIGNAL) return null;
            
            // Add starter teammate (Barney Dinosaur)
            if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.createStarterTeammate) {
                LORB.Util.Contacts.createStarterTeammate(ctx);
            }
            
            // Show summary
            var confirmed = showSummary(name, archetype, background, stats, ctx);
            if (confirmed === QUIT_SIGNAL) return null;
            
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
