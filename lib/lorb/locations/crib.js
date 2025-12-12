/**
 * crib.js - Player's Home (Your Crib)
 * 
 * Home base for managing crew and viewing personal stats.
 * Submenus: Contacts (Rolodex), Your Crew, Stats & Records
 */

var _cribRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _cribRichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[CRIB] Failed to load RichView: " + e);
}

// Load BinLoader for .bin file loading
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
        log(LOG_WARNING, "[CRIB] Failed to load bin-loader.js: " + e);
    }
}

(function() {
    
    var RichView = _cribRichView;
    
    // Art file paths
    var ART_HEADER = "/sbbs/xtrn/nba_jam/assets/lorb/crib_header.bin";
    var ART_HEADER_W = 80;
    var ART_HEADER_H = 4;
    
    var ART_SIDE = "/sbbs/xtrn/nba_jam/assets/lorb/crib_art.bin";
    var ART_SIDE_W = 40;
    var ART_SIDE_H = 20;
    
    var CHARACTERS_DIR = "/sbbs/xtrn/nba_jam/assets/characters/";
    var CHAR_ART_W = 40;
    var CHAR_ART_H = 20;
    
    // Crew constants
    var MAX_CREW_SIZE = 5;
    
    /**
     * Handle character reset - deletes character data and flags for restart
     */
    function handleReset(ctx) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.line("");
        LORB.View.line("\1r\1h*** CHARACTER RESET ***\1n");
        LORB.View.line("");
        LORB.View.line("This will DELETE your character permanently.");
        LORB.View.line("You will need to create a new character next time.");
        LORB.View.line("");
        if (LORB.View.confirm("Are you sure? Type Y to confirm: ")) {
            var removeResult = LORB.Persist.remove(ctx._user);
            LORB.View.line("");
            if (removeResult) {
                LORB.View.line("\1gCharacter deleted successfully.\1n");
            } else {
                LORB.View.line("\1rFailed to delete from database, clearing locally.\1n");
            }
            ctx.archetype = null;
            ctx._deleted = true;
            LORB.View.line("\1yGoodbye. You'll start fresh next time.\1n");
            LORB.View.line("");
            console.getkey();
            return "reset";
        }
        return null;
    }
    
    /**
     * Main entry point
     */
    function run(ctx) {
        // Initialize contacts/crew arrays if missing
        if (!ctx.contacts) ctx.contacts = [];
        if (!ctx.crew) ctx.crew = [];
        
        if (RichView) {
            return runRichView(ctx);
        } else {
            return runLegacy(ctx);
        }
    }
    
    /**
     * RichView main menu
     */
    function runRichView(ctx) {
        while (true) {
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 4 },
                    { name: "art", x: 1, y: 5, width: 40, height: 20 },
                    { name: "content", x: 41, y: 5, width: 40, height: 20 }
                ],
                theme: "lorb"
            });
            
            loadArtWithBinLoader(view);
            
            view.setContentZone("content");
            view.setCursorY(0);
            
            view.blank();
            view.line("\1h\1cYOUR CRIB\1n");
            view.blank();
            view.line("Home sweet home.");
            view.line("Manage your crew and check stats.");
            view.blank();
            view.line("\1wCrew: \1c" + ctx.crew.length + "/" + MAX_CREW_SIZE + "\1n");
            view.line("\1wContacts: \1c" + ctx.contacts.length + "\1n");
            view.blank();
            view.info("[Arrows] Select [ENTER] Confirm");
            
            var menuItems = [
                { text: "Contacts (Rolodex)", value: "contacts", hotkey: "1" },
                { text: "Your Crew", value: "crew", hotkey: "2" },
                { text: "Your Appearance", value: "appearance", hotkey: "3" },
                { text: "Stats & Records", value: "stats", hotkey: "4" },
                { text: "Back to Hub", value: "back", hotkey: "Q" },
                { text: "\1r[Reset Character]\1n", value: "reset", hotkey: "R" }
            ];
            
            // Add boss test menu if debug flag is enabled
            if (LORB.Config.DEBUG_ENABLE_BOSS_TEST) {
                menuItems.splice(4, 0, { text: "\1r[Boss Challenge TEST]\1n", value: "boss_test", hotkey: "B" });
            }
            
            var choice = view.menu(menuItems, { y: 11 });
            view.close();
            
            switch (choice) {
                case "contacts":
                    runContacts(ctx);
                    break;
                case "crew":
                    runCrew(ctx);
                    break;
                case "appearance":
                    runAppearance(ctx);
                    break;
                case "stats":
                    if (LORB.UI && LORB.UI.StatsView) {
                        LORB.UI.StatsView.show(ctx);
                    }
                    break;
                case "boss_test":
                    if (LORB.Locations && LORB.Locations.RedBullChallenge) {
                        LORB.Locations.RedBullChallenge.showTestMenu(ctx);
                    } else {
                        LORB.View.init();
                        LORB.View.clear();
                        LORB.View.warn("Boss Challenge module not loaded.");
                        console.getkey();
                    }
                    break;
                case "reset":
                    var resetResult = handleReset(ctx);
                    if (resetResult === "reset") {
                        return "reset";
                    }
                    break;
                case "back":
                case null:
                    return;
            }
        }
    }
    
    // =========================================================================
    // APPEARANCE OPTIONS - Mirrors character_creation.js but allows editing
    // =========================================================================
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
            { id: "LIGHTRED", name: "\1wLight Red\1n", preview: "\1h\1r\xDB\1n" },
            { id: "GREEN", name: "\1wGreen\1n", preview: "\1g\xDB\1n" },
            { id: "LIGHTGREEN", name: "\1wLight Green\1n", preview: "\1h\1g\xDB\1n" },
            { id: "BLUE", name: "\1wBlue\1n", preview: "\1b\xDB\1n" },
            { id: "LIGHTBLUE", name: "\1wLight Blue\1n", preview: "\1h\1b\xDB\1n" },
            { id: "CYAN", name: "\1wCyan\1n", preview: "\1c\xDB\1n" },
            { id: "LIGHTCYAN", name: "\1wLight Cyan\1n", preview: "\1h\1c\xDB\1n" },
            { id: "MAGENTA", name: "\1wMagenta\1n", preview: "\1m\xDB\1n" },
            { id: "LIGHTMAGENTA", name: "\1wLight Magenta\1n", preview: "\1h\1m\xDB\1n" },
            { id: "BROWN", name: "\1wBrown\1n", preview: "\1y\xDB\1n" },
            { id: "YELLOW", name: "\1wYellow\1n", preview: "\1h\1y\xDB\1n" }
        ],
        // Nametag foreground colors (all 16)
        nametagFgColors: [
            { id: "WHITE", name: "\1wWhite\1n", preview: "\1h\1w\xDB\1n" },
            { id: "LIGHTGRAY", name: "\1wLight Gray\1n", preview: "\1w\xDB\1n" },
            { id: "DARKGRAY", name: "\1wDark Gray\1n", preview: "\1h\1k\xDB\1n" },
            { id: "BLACK", name: "\1wBlack\1n", preview: "\1k\xDB\1n" },
            { id: "RED", name: "\1wRed\1n", preview: "\1r\xDB\1n" },
            { id: "LIGHTRED", name: "\1wLight Red\1n", preview: "\1h\1r\xDB\1n" },
            { id: "GREEN", name: "\1wGreen\1n", preview: "\1g\xDB\1n" },
            { id: "LIGHTGREEN", name: "\1wLight Green\1n", preview: "\1h\1g\xDB\1n" },
            { id: "BLUE", name: "\1wBlue\1n", preview: "\1b\xDB\1n" },
            { id: "LIGHTBLUE", name: "\1wLight Blue\1n", preview: "\1h\1b\xDB\1n" },
            { id: "CYAN", name: "\1wCyan\1n", preview: "\1c\xDB\1n" },
            { id: "LIGHTCYAN", name: "\1wLight Cyan\1n", preview: "\1h\1c\xDB\1n" },
            { id: "MAGENTA", name: "\1wMagenta\1n", preview: "\1m\xDB\1n" },
            { id: "LIGHTMAGENTA", name: "\1wLight Magenta\1n", preview: "\1h\1m\xDB\1n" },
            { id: "BROWN", name: "\1wBrown\1n", preview: "\1y\xDB\1n" },
            { id: "YELLOW", name: "\1wYellow\1n", preview: "\1h\1y\xDB\1n" }
        ],
        // Nametag background colors (8 BG colors)
        nametagBgColors: [
            { id: "BLACK", name: "\1wBlack\1n", preview: "\1" + "0 \1n" },
            { id: "BLUE", name: "\1wBlue\1n", preview: "\1" + "4 \1n" },
            { id: "GREEN", name: "\1wGreen\1n", preview: "\1" + "2 \1n" },
            { id: "CYAN", name: "\1wCyan\1n", preview: "\1" + "6 \1n" },
            { id: "RED", name: "\1wRed\1n", preview: "\1" + "1 \1n" },
            { id: "MAGENTA", name: "\1wMagenta\1n", preview: "\1" + "5 \1n" },
            { id: "BROWN", name: "\1wBrown\1n", preview: "\1" + "3 \1n" },
            { id: "LIGHTGRAY", name: "\1wLight Gray\1n", preview: "\1" + "7 \1n" }
        ]
    };
    
    /**
     * Find option in list by ID
     */
    function findAppearanceOption(optionList, id) {
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
     * Build a picker display with < > indicators showing more options
     * @param {Array} optionList - The list of options
     * @param {string} currentId - Currently selected option ID
     * @returns {string} Formatted display string with indicators
     */
    function buildPickerDisplay(optionList, currentId) {
        var idx = getOptionIndex(optionList, currentId);
        var opt = optionList[idx];
        var hasLeft = idx > 0;
        var hasRight = idx < optionList.length - 1;
        
        var leftArrow = hasLeft ? "\1c<\1n " : "  ";
        var rightArrow = hasRight ? " \1c>\1n" : "  ";
        
        var display = opt ? (opt.preview + " " + opt.name) : ("\1w" + currentId + "\1n");
        return leftArrow + display + rightArrow;
    }
    
    /**
     * Your Appearance view - customize player sprite appearance
     * Uses RichView with live sprite preview on left, options on right
     */
    function runAppearance(ctx) {
        // Ensure appearance object exists with defaults
        if (!ctx.appearance) {
            ctx.appearance = {
                skin: "brown",
                eyeColor: "BROWN",
                jerseyColor: "RED",
                jerseyLettering: "WHITE",
                jerseyNumber: "1",
                // Nametag colors: default state
                nametagFg: "WHITE",
                nametagBg: "BLACK",
                // Nametag colors: ball carrier (highlight) state - defaults to inverted
                nametagHiFg: "BLACK",
                nametagHiBg: "LIGHTGRAY"
            };
        }
        // Ensure jerseyLettering exists for existing characters
        if (!ctx.appearance.jerseyLettering) {
            ctx.appearance.jerseyLettering = "WHITE";
        }
        // Ensure nametag colors exist for existing characters
        if (!ctx.appearance.nametagFg) ctx.appearance.nametagFg = "WHITE";
        if (!ctx.appearance.nametagBg) ctx.appearance.nametagBg = "BLACK";
        if (!ctx.appearance.nametagHiFg) ctx.appearance.nametagHiFg = "BLACK";
        if (!ctx.appearance.nametagHiBg) ctx.appearance.nametagHiBg = "LIGHTGRAY";
        if (!ctx.nickname) {
            ctx.nickname = (ctx.name || "Player").substring(0, 5);
        }
        
        // Ensure BinLoader is available for sprite preview
        if (typeof BinLoader === "undefined") {
            try {
                load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
            } catch (e) {
                log(LOG_WARNING, "[CRIB] Failed to load BinLoader: " + e);
            }
        }
        
        // Track which field is currently selected
        var selectedField = 0;
        var fields = ["skin", "eyes", "jersey", "lettering", "number", "nickname", "tagFg", "tagBg", "tagHiFg", "tagHiBg"];
        
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
            
            view.line("\1h\1cYOUR APPEARANCE\1n");
            view.line("\1c" + repeatChar("\xC4", 38) + "\1n");
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
                { text: "\1c--- Nametag (Normal) ---\1n", value: null, disabled: true },
                { 
                    text: "\1wTag FG:     " + buildPickerDisplay(APPEARANCE_OPTIONS.nametagFgColors, ctx.appearance.nametagFg),
                    value: "tagFg",
                    hotkey: "7"
                },
                { 
                    text: "\1wTag BG:     " + buildPickerDisplay(APPEARANCE_OPTIONS.nametagBgColors, ctx.appearance.nametagBg),
                    value: "tagBg",
                    hotkey: "8"
                },
                { text: "\1c--- Nametag (Ball Carrier) ---\1n", value: null, disabled: true },
                { 
                    text: "\1wTag Hi FG:  " + buildPickerDisplay(APPEARANCE_OPTIONS.nametagFgColors, ctx.appearance.nametagHiFg),
                    value: "tagHiFg",
                    hotkey: "9"
                },
                { 
                    text: "\1wTag Hi BG:  " + buildPickerDisplay(APPEARANCE_OPTIONS.nametagBgColors, ctx.appearance.nametagHiBg),
                    value: "tagHiBg",
                    hotkey: "0"
                },
                { text: "", value: null, disabled: true },
                { text: "\1gSave & Back\1n", value: "save", hotkey: "S" },
                { text: "\1wCancel\1n", value: "cancel", hotkey: "Q" }
            ];
            
            view.info("\1w[Up/Dn]\1n Select  \1w[Lt/Rt]\1n Change  \1w[S]\1nave");
            
            // Custom theme for this menu only: WHITE on BLUE highlight
            var appearanceMenuTheme = {
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
                } else if (item.value === "tagFg") {
                    optList = APPEARANCE_OPTIONS.nametagFgColors;
                    currentVal = ctx.appearance.nametagFg;
                    setter = function(v) { ctx.appearance.nametagFg = v; };
                } else if (item.value === "tagBg") {
                    optList = APPEARANCE_OPTIONS.nametagBgColors;
                    currentVal = ctx.appearance.nametagBg;
                    setter = function(v) { ctx.appearance.nametagBg = v; };
                } else if (item.value === "tagHiFg") {
                    optList = APPEARANCE_OPTIONS.nametagFgColors;
                    currentVal = ctx.appearance.nametagHiFg;
                    setter = function(v) { ctx.appearance.nametagHiFg = v; };
                } else if (item.value === "tagHiBg") {
                    optList = APPEARANCE_OPTIONS.nametagBgColors;
                    currentVal = ctx.appearance.nametagHiBg;
                    setter = function(v) { ctx.appearance.nametagHiBg = v; };
                }
                
                if (optList && setter) {
                    var idx = getOptionIndex(optList, currentVal);
                    if (direction < 0) {
                        // Left - go to previous
                        if (idx > 0) {
                            idx--;
                            setter(optList[idx].id);
                            // Return special value to signal redraw needed
                            return { action: "cycle", field: item.value, index: index };
                        }
                    } else {
                        // Right - go to next
                        if (idx < optList.length - 1) {
                            idx++;
                            setter(optList[idx].id);
                            return { action: "cycle", field: item.value, index: index };
                        }
                    }
                }
                return false; // No change or not a picker field
            };
            
            var choice = view.menu(menuItems, { 
                y: 7, 
                selected: selectedField, 
                theme: appearanceMenuTheme,
                onLeftRight: cycleOption
            });
            view.close();
            
            // Handle cycle action - redraw with same selection
            if (choice && typeof choice === "object" && choice.action === "cycle") {
                selectedField = choice.index;
                continue;  // Redraw menu with updated value
            }
            
            if (choice === "save" || choice === null) {
                // Save changes
                LORB.Persist.save(ctx);
                return;
            }
            
            if (choice === "cancel") {
                // Reload from saved to discard changes
                // For now just return - changes are in memory only until save
                return;
            }
            
            // Handle option cycling
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
                // Prompt for jersey number
                LORB.View.init();
                LORB.View.clear();
                LORB.View.line("");
                LORB.View.line("\1h\1cJERSEY NUMBER\1n");
                LORB.View.line("");
                LORB.View.line("Enter your jersey number (1-2 characters):");
                LORB.View.line("Current: \1h" + ctx.appearance.jerseyNumber + "\1n");
                LORB.View.line("");
                var numInput = LORB.View.prompt("New number: ");
                if (numInput && numInput.length > 0) {
                    ctx.appearance.jerseyNumber = numInput.substring(0, 2).replace(/[^a-zA-Z0-9]/g, "") || "1";
                }
            } else if (choice === "nickname") {
                selectedField = 5;
                // Prompt for nickname
                LORB.View.init();
                LORB.View.clear();
                LORB.View.line("");
                LORB.View.line("\1h\1cNICKNAME\1n");
                LORB.View.line("");
                LORB.View.line("Your nickname appears above your player.");
                LORB.View.line("Keep it short (5 chars max).");
                LORB.View.line("Current: \1c" + (ctx.nickname || "(none)") + "\1n");
                LORB.View.line("");
                var nickInput = LORB.View.prompt("New nickname: ");
                if (nickInput) {
                    ctx.nickname = nickInput.substring(0, 5).replace(/[^a-zA-Z0-9_\-!]/g, "");
                }
            } else if (choice === "tagFg") {
                selectedField = 6;
                var idx = getOptionIndex(APPEARANCE_OPTIONS.nametagFgColors, ctx.appearance.nametagFg);
                idx = (idx + 1) % APPEARANCE_OPTIONS.nametagFgColors.length;
                ctx.appearance.nametagFg = APPEARANCE_OPTIONS.nametagFgColors[idx].id;
            } else if (choice === "tagBg") {
                selectedField = 7;
                var idx = getOptionIndex(APPEARANCE_OPTIONS.nametagBgColors, ctx.appearance.nametagBg);
                idx = (idx + 1) % APPEARANCE_OPTIONS.nametagBgColors.length;
                ctx.appearance.nametagBg = APPEARANCE_OPTIONS.nametagBgColors[idx].id;
            } else if (choice === "tagHiFg") {
                selectedField = 8;
                var idx = getOptionIndex(APPEARANCE_OPTIONS.nametagFgColors, ctx.appearance.nametagHiFg);
                idx = (idx + 1) % APPEARANCE_OPTIONS.nametagFgColors.length;
                ctx.appearance.nametagHiFg = APPEARANCE_OPTIONS.nametagFgColors[idx].id;
            } else if (choice === "tagHiBg") {
                selectedField = 9;
                var idx = getOptionIndex(APPEARANCE_OPTIONS.nametagBgColors, ctx.appearance.nametagHiBg);
                idx = (idx + 1) % APPEARANCE_OPTIONS.nametagBgColors.length;
                ctx.appearance.nametagHiBg = APPEARANCE_OPTIONS.nametagBgColors[idx].id;
            }
        }
    }
    
    /**
     * Draw the player sprite preview in the art zone
     * Uses BinLoader to load raw sprite data and applies jersey mask manually
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
        
        // Show nametag preview above sprite (1 row above sprite, just like in-game)
        // We show both normal and ball-carrier states side by side
        if (ctx.nickname) {
            var nametagFgCtrl = getColorCtrlCode(ctx.appearance.nametagFg || "WHITE");
            var nametagBgCtrl = getBgColorCtrlCode(ctx.appearance.nametagBg || "BLACK");
            var nametagHiFgCtrl = getColorCtrlCode(ctx.appearance.nametagHiFg || "BLACK");
            var nametagHiBgCtrl = getBgColorCtrlCode(ctx.appearance.nametagHiBg || "LIGHTGRAY");
            
            // Normal nametag (left side)
            var normalTag = nametagBgCtrl + nametagFgCtrl + ctx.nickname + "\1n";
            artFrame.gotoxy(3, spriteY - 1);
            artFrame.putmsg("\1wNormal: " + normalTag);
            
            // Ball carrier nametag (right side) 
            var hiTag = nametagHiBgCtrl + nametagHiFgCtrl + ctx.nickname + "\1n";
            artFrame.gotoxy(22, spriteY - 1);
            artFrame.putmsg("\1wCarrier: " + hiTag);
        }
        
        // Load sprite using BinLoader (simpler than Sprite.Aerial)
        var spriteLoaded = false;
        if (typeof BinLoader !== "undefined") {
            try {
                var skin = (ctx.appearance.skin || "brown").toLowerCase();
                var binPath = NBA_JAM_ROOT + "sprites/player-" + skin + ".bin";
                
                // Load raw bin data
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
                    
                    var letteringFg = getLetteringFgColorForPreview(ctx.appearance.jerseyLettering);
                    var digitsAttr = letteringFg | jerseyBg;
                    
                    // Row 2 (0-indexed), cols 1,2,3: jersey number area
                    // Col 1: left digit
                    pixels[2][1] = { ch: leftDigit, attr: digitsAttr };
                    // Col 2: neckline - keep skin fg, change bg to jersey
                    var neckCell = pixels[2][2];
                    var skinFg = neckCell.attr & 0x0F; // FG mask
                    pixels[2][2] = { ch: String.fromCharCode(223), attr: skinFg | jerseyBg }; // ▀
                    // Col 3: right digit
                    pixels[2][3] = { ch: rightDigit, attr: digitsAttr };
                    
                    // Row 3 (0-indexed), cols 1,3: shorts/legs
                    var shortsChar = String.fromCharCode(220); // ▄
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
                            // Keep the background, change the foreground to eye color
                            var eyeBg = eyeCell.attr & 0xF0; // BG mask
                            pixels[0][ex] = { ch: eyeCh, attr: eyeFg | eyeBg };
                        }
                    }
                    
                    // Render pixels to frame
                    for (var ry = 0; ry < SPRITE_HEIGHT; ry++) {
                        for (var rx = 0; rx < SPRITE_WIDTH; rx++) {
                            var cell = pixels[ry][rx];
                            var ch = cell.ch;
                            var attr = cell.attr;
                            // Handle null/transparency - use black background
                            if (!ch || ch === '\0' || ch === ' ') {
                                ch = ' ';
                                attr = BG_BLACK;
                            }
                            artFrame.gotoxy(spriteX + rx, spriteY + ry);
                            // Use setData for proper attribute handling
                            try {
                                artFrame.setData(spriteX + rx - 1, spriteY + ry - 1, ch, attr, false);
                            } catch (e) {
                                // Fallback to putmsg
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
                log(LOG_WARNING, "[CRIB] Sprite preview failed: " + e);
            }
        }
        
        if (!spriteLoaded) {
            artFrame.gotoxy(12, 10);
            artFrame.putmsg("\1y[No Preview]\1n");
        }
        
        // Show appearance summary at bottom
        var skinOpt = findAppearanceOption(APPEARANCE_OPTIONS.skinColors, ctx.appearance.skin);
        var eyeOpt = findAppearanceOption(APPEARANCE_OPTIONS.eyeColors, ctx.appearance.eyeColor);
        var jerseyOpt = findAppearanceOption(APPEARANCE_OPTIONS.jerseyColors, ctx.appearance.jerseyColor);
        var letteringOpt = findAppearanceOption(APPEARANCE_OPTIONS.letteringColors, ctx.appearance.jerseyLettering);
        
        artFrame.gotoxy(3, 15);
        artFrame.putmsg("\1wSkin: " + (skinOpt ? skinOpt.preview + skinOpt.name : ctx.appearance.skin) + "\1n");
        artFrame.gotoxy(3, 16);
        artFrame.putmsg("\1wEyes: " + (eyeOpt ? eyeOpt.preview + eyeOpt.name : ctx.appearance.eyeColor) + "\1n");
        artFrame.gotoxy(3, 17);
        artFrame.putmsg("\1wJersey: " + (jerseyOpt ? jerseyOpt.preview + jerseyOpt.name : ctx.appearance.jerseyColor) + "\1n");
        artFrame.gotoxy(3, 18);
        artFrame.putmsg("\1wLettering: " + (letteringOpt ? letteringOpt.preview + letteringOpt.name : ctx.appearance.jerseyLettering) + "\1n");
        
        view.render();
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
     * Get Ctrl-A color code for foreground color name
     */
    function getColorCtrlCode(colorName) {
        if (!colorName) return "\1h\1w";
        var map = {
            "WHITE": "\1h\1w",
            "LIGHTGRAY": "\1w",
            "DARKGRAY": "\1h\1k",
            "BLACK": "\1k",
            "RED": "\1r",
            "LIGHTRED": "\1h\1r",
            "GREEN": "\1g",
            "LIGHTGREEN": "\1h\1g",
            "BLUE": "\1b",
            "LIGHTBLUE": "\1h\1b",
            "CYAN": "\1c",
            "LIGHTCYAN": "\1h\1c",
            "MAGENTA": "\1m",
            "LIGHTMAGENTA": "\1h\1m",
            "BROWN": "\1y",
            "YELLOW": "\1h\1y"
        };
        return map[colorName.toUpperCase()] || "\1h\1w";
    }
    
    /**
     * Get Ctrl-A background color code for background color name
     */
    function getBgColorCtrlCode(colorName) {
        if (!colorName) return "\1" + "0";
        var map = {
            "BLACK": "\1" + "0",
            "BLUE": "\1" + "4",
            "GREEN": "\1" + "2",
            "CYAN": "\1" + "6",
            "RED": "\1" + "1",
            "MAGENTA": "\1" + "5",
            "BROWN": "\1" + "3",
            "LIGHTGRAY": "\1" + "7"
        };
        return map[colorName.toUpperCase()] || "\1" + "0";
    }
    
    /**
     * Repeat a character n times
     */
    function repeatChar(ch, n) {
        var result = "";
        for (var i = 0; i < n; i++) result += ch;
        return result;
    }
    
    /**
     * Contacts (Rolodex) view - NBA players you've defeated
     */
    function runContacts(ctx) {
        while (true) {
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 3 },
                    { name: "list", x: 1, y: 4, width: 80, height: 18 },
                    { name: "footer", x: 1, y: 22, width: 80, height: 3 }
                ],
                theme: "lorb"
            });
            
            // Header
            var headerFrame = view.getZone("header");
            if (headerFrame) {
                headerFrame.gotoxy(1, 1);
                headerFrame.putmsg("\1h\1c\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\1n");
                headerFrame.gotoxy(1, 2);
                headerFrame.putmsg("\1h\1w  CONTACTS                                                    [" + ctx.contacts.length + " contacts]\1n");
                headerFrame.gotoxy(1, 3);
                headerFrame.putmsg("\1h\1c\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\1n");
            }
            
            // Footer
            var footerFrame = view.getZone("footer");
            if (footerFrame) {
                footerFrame.gotoxy(1, 1);
                footerFrame.putmsg("\1h\1c\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\1n");
                footerFrame.gotoxy(1, 2);
                footerFrame.putmsg("  \1w[ENTER]\1n\1w Call Player    \1w[V]\1n\1w View Stats    \1w[ESC]\1n\1w Back");
            }
            
            view.render();
            
            if (ctx.contacts.length === 0) {
                // No contacts yet
                var listFrame = view.getZone("list");
                if (listFrame) {
                    listFrame.gotoxy(3, 5);
                    listFrame.putmsg("\1kNo contacts yet.\1n");
                    listFrame.gotoxy(3, 7);
                    listFrame.putmsg("\1wDefeat NBA players on the courts to get their number!\1n");
                }
                view.render();
                console.getkey();
                view.close();
                return;
            }
            
            // Build menu items for contacts - use hydrated contacts for display
            var hydratedContacts = LORB.Util.Contacts.getAllContacts(ctx);
            var menuItems = [];
            for (var i = 0; i < hydratedContacts.length; i++) {
                var c = hydratedContacts[i];
                var statusStr = "";
                var costStr = "";
                var rivalWarning = "";
                
                // Check for rival conflicts
                if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.checkCrewRivalConflict) {
                    var conflict = LORB.Util.Contacts.checkCrewRivalConflict(ctx, c);
                    if (conflict && c.status !== "signed") {
                        rivalWarning = " \1r*RIVAL*\1n";
                    }
                }
                
                if (c.status === "signed") {
                    statusStr = "\1gSIGNED\1n";
                    costStr = "--";
                } else if (c.status === "temp") {
                    statusStr = "\1yTEMP\1n";
                    costStr = "$" + c.signCost + " / " + c.cutPercent + "%";
                } else {
                    statusStr = "\1kNot signed\1n";
                    costStr = "$" + c.signCost + " / " + c.cutPercent + "%";
                }
                
                // Format: Name (padded) | Status | Cost/Cut | Rival warning
                var displayName = padRight(c.name, 18);
                var displayStatus = padRight(statusStr, 12);
                
                menuItems.push({
                    text: "\1w" + displayName + "\1n | " + displayStatus + " | \1w" + costStr + "\1n" + rivalWarning,
                    value: i,
                    data: c
                });
            }
            
            menuItems.push({ text: "Back", value: "back", hotkey: "Q" });
            
            // Show lightbar in list zone
            view.setContentZone("list");
            var choice = view.menu(menuItems, { y: 1 });
            view.close();
            
            if (choice === "back" || choice === null) {
                return;
            }
            
            // Selected a contact - show call dialog (use hydrated contact)
            var contact = hydratedContacts[choice];
            if (contact) {
                callPlayerDialog(ctx, contact, choice);
            }
        }
    }
    
    /**
     * Call player dialog - negotiate temp or permanent signing
     * Uses RichView with player art on left, dialog on right
     */
    function callPlayerDialog(ctx, contact, contactIndex) {
        var view = new RichView({
            zones: [
                { name: "art", x: 1, y: 1, width: 40, height: 24 },
                { name: "content", x: 41, y: 1, width: 40, height: 24 }
            ],
            theme: "lorb"
        });
        
        // Load player art if available
        var artPath = getCharacterArtPath(contact);
        if (artPath && typeof BinLoader !== "undefined") {
            var artFrame = view.getZone("art");
            if (artFrame) {
                BinLoader.loadIntoFrame(artFrame, artPath, CHAR_ART_W, CHAR_ART_H, 1, 1);
            }
        } else {
            var artFrame = view.getZone("art");
            if (artFrame) {
                artFrame.gotoxy(15, 10);
                artFrame.putmsg("\1k[No Art]\1n");
            }
        }
        
        // Content zone - dialog
        view.setContentZone("content");
        view.setCursorY(0);
        
        view.line("\1h\1wCALLING...\1n");
        view.line("\1h\1c" + contact.name.toUpperCase() + "\1n");
        view.blank();
        
        if (contact.status === "signed") {
            view.line("\1g" + contact.name + " is\1n");
            view.line("\1galready on your crew!\1n");
            view.blank();
            view.info("Press any key...");
            view.render();
            console.getkey();
            view.close();
            return;
        }
        
        // Check for rival conflicts before showing options
        var rivalConflict = null;
        if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.checkCrewRivalConflict) {
            rivalConflict = LORB.Util.Contacts.checkCrewRivalConflict(ctx, contact);
        }
        
        if (rivalConflict) {
            // Show rival conflict immediately
            view.line("\1r\"Yo... I heard you been runnin'\1n");
            view.line("\1rwith " + rivalConflict.name + ".\"\1n");
            view.blank();
            view.line("\1r\"Nah, I can't roll with that.\1n");
            view.line("\1rYou want me? Lose them first.\"\1n");
            view.blank();
            view.line("\1y" + contact.name + " and " + rivalConflict.name + "\1n");
            view.line("\1yare RIVALS - can't be on same crew!\1n");
            view.blank();
            view.info("Press any key...");
            view.render();
            console.getkey();
            view.close();
            return;
        }
        
        view.line("\1c\"Yo, what's good?\"\1n");
        view.blank();
        
        // Check if already on crew (temp)
        var onCrew = isOnCrew(ctx, contact.id);
        var stats = contact.stats || {};
        
        // Show all 6 stats in a compact format
        view.line("\1wSPD:\1c" + (stats.speed || "?") + " \1w3PT:\1c" + (stats.threePt || "?") + " \1wPWR:\1c" + (stats.power || "?") + "\1n");
        view.line("\1wSTL:\1c" + (stats.steal || "?") + " \1wBLK:\1c" + (stats.block || "?") + " \1wDNK:\1c" + (stats.dunk || "?") + "\1n");
        view.blank();
        
        // Show cash/crew info
        view.line("\1wCash: \1g$" + (ctx.cash || 0) + "\1n  \1wCrew: \1c" + ctx.crew.length + "/" + MAX_CREW_SIZE + "\1n");
        view.blank();
        
        // Build menu items based on status
        var menuItems = [];
        
        if (contact.status === "temp" && onCrew) {
            view.line("\1yStatus: On crew (" + contact.cutPercent + "% cut)\1n");
            view.blank();
            
            menuItems.push({ text: "Sign Permanent ($" + contact.signCost + ")", value: "sign", hotkey: "1" });
            menuItems.push({ text: "Release from Crew", value: "release", hotkey: "2" });
            menuItems.push({ text: "Nevermind", value: "back", hotkey: "Q" });
        } else {
            view.line("\1kStatus: Contact (not on crew)\1n");
            view.blank();
            
            menuItems.push({ text: "Run with me (" + contact.cutPercent + "% cut)", value: "temp", hotkey: "1" });
            menuItems.push({ text: "Sign Permanent ($" + contact.signCost + ")", value: "sign", hotkey: "2" });
            menuItems.push({ text: "Nevermind", value: "back", hotkey: "Q" });
        }
        
        var choice = view.menu(menuItems, { y: 14 });
        view.close();
        
        if (choice === "sign") {
            signPermanent(ctx, contact, contactIndex);
        } else if (choice === "release") {
            releaseFromCrew(ctx, contact);
        } else if (choice === "temp") {
            addToCrew(ctx, contact, "temp");
        }
    }
    
    /**
     * Add contact to crew (temp deal)
     * Now checks for rival conflicts before adding
     */
    function addToCrew(ctx, contact, status) {
        if (ctx.crew.length >= MAX_CREW_SIZE) {
            LORB.View.line("");
            LORB.View.warn("Crew is full! Release someone first.");
            console.getkey();
            return false;
        }
        
        if (isOnCrew(ctx, contact.id)) {
            LORB.View.line("");
            LORB.View.warn(contact.name + " is already on your crew!");
            console.getkey();
            return false;
        }
        
        // Check for rival conflicts
        if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.checkCrewRivalConflict) {
            var conflictingMember = LORB.Util.Contacts.checkCrewRivalConflict(ctx, contact);
            if (conflictingMember) {
                LORB.View.line("");
                LORB.View.line("\1r\"Nah, I ain't runnin' with " + conflictingMember.name + ".\"\1n");
                LORB.View.line("\1r\"You gotta choose - me or them.\"\1n");
                LORB.View.line("");
                LORB.View.warn(contact.name + " and " + conflictingMember.name + " are rivals!");
                console.getkey();
                return false;
            }
        }
        
        contact.status = status || "temp";
        ctx.crew.push({ contactId: contact.id, slot: ctx.crew.length });
        
        LORB.View.line("");
        LORB.View.line("\1g" + contact.name + " joins your crew!\1n");
        if (status === "temp") {
            LORB.View.line("\1y(They'll take " + contact.cutPercent + "% of your winnings)\1n");
        }
        console.getkey();
        return true;
    }
    
    /**
     * Sign player permanently
     * Checks for rival conflicts if not already on crew
     */
    function signPermanent(ctx, contact, contactIndex) {
        if ((ctx.cash || 0) < contact.signCost) {
            LORB.View.line("");
            LORB.View.warn("Not enough cash! Need $" + contact.signCost);
            console.getkey();
            return false;
        }
        
        // Check for rival conflict if not already on crew
        if (!isOnCrew(ctx, contact.id)) {
            if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.checkCrewRivalConflict) {
                var conflictingMember = LORB.Util.Contacts.checkCrewRivalConflict(ctx, contact);
                if (conflictingMember) {
                    LORB.View.line("");
                    LORB.View.line("\1r\"Nah, I ain't signing if " + conflictingMember.name + " is there.\"\1n");
                    LORB.View.line("\1r\"Handle that first.\"\1n");
                    LORB.View.line("");
                    LORB.View.warn(contact.name + " and " + conflictingMember.name + " are rivals!");
                    console.getkey();
                    return false;
                }
            }
        }
        
        ctx.cash -= contact.signCost;
        contact.status = "signed";
        
        // Add to crew if not already there
        if (!isOnCrew(ctx, contact.id)) {
            if (ctx.crew.length < MAX_CREW_SIZE) {
                ctx.crew.push({ contactId: contact.id, slot: ctx.crew.length });
            }
        }
        
        LORB.View.line("");
        LORB.View.line("\1g" + contact.name + " signed! (-$" + contact.signCost + ")\1n");
        LORB.View.line("No more cuts - they're permanent crew now!");
        console.getkey();
        return true;
    }
    
    /**
     * Release player from crew
     */
    function releaseFromCrew(ctx, contact) {
        for (var i = 0; i < ctx.crew.length; i++) {
            if (ctx.crew[i].contactId === contact.id) {
                ctx.crew.splice(i, 1);
                // Clear active teammate if this was them
                if (ctx.activeTeammate === contact.id) {
                    if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.clearActiveTeammate) {
                        LORB.Util.Contacts.clearActiveTeammate(ctx);
                    } else {
                        ctx.activeTeammate = null;
                    }
                }
                // Reindex slots
                for (var j = 0; j < ctx.crew.length; j++) {
                    ctx.crew[j].slot = j;
                }
                LORB.View.line("");
                LORB.View.line("\1y" + contact.name + " released from crew.\1n");
                console.getkey();
                return true;
            }
        }
        return false;
    }
    
    /**
     * Check if contact is on crew
     */
    function isOnCrew(ctx, contactId) {
        for (var i = 0; i < ctx.crew.length; i++) {
            if (ctx.crew[i].contactId === contactId) return true;
        }
        return false;
    }
    
    /**
     * Your Crew view - show active roster
     */
    function runCrew(ctx) {
        while (true) {
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 3 },
                    { name: "list", x: 1, y: 4, width: 80, height: 18 },
                    { name: "footer", x: 1, y: 22, width: 80, height: 3 }
                ],
                theme: "lorb"
            });
            
            // Header
            var headerFrame = view.getZone("header");
            if (headerFrame) {
                headerFrame.gotoxy(1, 1);
                headerFrame.putmsg("\1h\1c\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\1n");
                headerFrame.gotoxy(1, 2);
                headerFrame.putmsg("\1h\1w  YOUR CREW                                                        [" + ctx.crew.length + "/" + MAX_CREW_SIZE + "]\1n");
                headerFrame.gotoxy(1, 3);
                headerFrame.putmsg("\1h\1c\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\1n");
            }
            
            // Footer
            var footerFrame = view.getZone("footer");
            if (footerFrame) {
                footerFrame.gotoxy(1, 1);
                footerFrame.putmsg("\1h\1c\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\1n");
                footerFrame.gotoxy(1, 2);
                footerFrame.putmsg("  \1w[ENTER]\1n\1w Details  \1w[A]\1n\1w Set Active  \1w[R]\1n\1w Release  \1w[ESC]\1n\1w Back");
            }
            
            view.render();
            
            if (ctx.crew.length === 0) {
                var listFrame = view.getZone("list");
                if (listFrame) {
                    listFrame.gotoxy(3, 5);
                    listFrame.putmsg("\1kNo crew members yet.\1n");
                    listFrame.gotoxy(3, 7);
                    listFrame.putmsg("\1wCall your contacts to add them to your crew!\1n");
                }
                view.render();
                console.getkey();
                view.close();
                return;
            }
            
            // Build crew list with stats
            var menuItems = [];
            for (var i = 0; i < ctx.crew.length; i++) {
                var crewMember = ctx.crew[i];
                var contact = getContactById(ctx, crewMember.contactId);
                
                if (!contact) continue;
                
                var stats = contact.stats || {};
                var statLine = "\1cSPD:\1w" + (stats.speed || "?") + " \1c3PT:\1w" + (stats.threePt || "?") + 
                               " \1cPWR:\1w" + (stats.power || "?") + " \1cSTL:\1w" + (stats.steal || "?") + 
                               " \1cBLK:\1w" + (stats.block || "?") + " \1cDNK:\1w" + (stats.dunk || "?") + "\1n";
                
                var statusStr = contact.status === "signed" ? "\1gSIGNED\1n" : "\1yTEMP (" + contact.cutPercent + "%)\1n";
                
                // Check if this is the active teammate
                var isActive = (ctx.activeTeammate === contact.id) || (!ctx.activeTeammate && i === 0);
                var activeMarker = isActive ? "\1h\1g*\1n " : "  ";
                
                menuItems.push({
                    text: activeMarker + "\1w" + padRight(contact.name, 14) + " " + statLine + " | " + statusStr,
                    value: i,
                    data: contact
                });
            }
            
            // Add empty slots
            for (var e = ctx.crew.length; e < MAX_CREW_SIZE; e++) {
                menuItems.push({
                    text: "\1k-- empty slot --\1n",
                    value: "empty",
                    disabled: true
                });
            }
            
            menuItems.push({ text: "Back", value: "back", hotkey: "Q" });
            
            view.setContentZone("list");
            var choice = view.menu(menuItems, { y: 1 });
            view.close();
            
            if (choice === "back" || choice === null || choice === "empty") {
                return;
            }
            
            // Show crew member detail
            var crewMember = ctx.crew[choice];
            if (crewMember) {
                var contact = getContactById(ctx, crewMember.contactId);
                if (contact) {
                    showCrewMemberDetail(ctx, contact, choice);
                }
            }
        }
    }
    
    /**
     * Show detail view for a crew member - RichView with player art
     */
    function showCrewMemberDetail(ctx, contact, crewIndex) {
        var view = new RichView({
            zones: [
                { name: "art", x: 1, y: 1, width: 40, height: 20 },
                { name: "content", x: 41, y: 1, width: 40, height: 20 },
                { name: "footer", x: 1, y: 21, width: 80, height: 4 }
            ],
            theme: "lorb"
        });
        
        // Load player art if available
        var artPath = getCharacterArtPath(contact);
        if (artPath && typeof BinLoader !== "undefined") {
            var artFrame = view.getZone("art");
            if (artFrame) {
                BinLoader.loadIntoFrame(artFrame, artPath, CHAR_ART_W, CHAR_ART_H, 1, 1);
            }
        } else {
            // No art available - show placeholder
            var artFrame = view.getZone("art");
            if (artFrame) {
                artFrame.gotoxy(15, 10);
                artFrame.putmsg("\1k[No Art]\1n");
            }
        }
        
        // Content zone - stats and info
        view.setContentZone("content");
        view.setCursorY(0);
        
        var stats = contact.stats || {};
        var isActive = (ctx.activeTeammate === contact.id) || (!ctx.activeTeammate && crewIndex === 0);
        
        view.line("\1h\1w" + contact.name + "\1n");
        if (contact.team) {
            view.line("\1k" + contact.team + "\1n");
        }
        view.blank();
        
        view.line("\1h\1y\xCD\xCD\xCD STATS \xCD\xCD\xCD\1n");
        view.line("  Speed:   " + formatStatBar(stats.speed || 5));
        view.line("  3-Point: " + formatStatBar(stats.threePt || 5));
        view.line("  Power:   " + formatStatBar(stats.power || 5));
        view.line("  Steal:   " + formatStatBar(stats.steal || 5));
        view.line("  Block:   " + formatStatBar(stats.block || 5));
        view.line("  Dunk:    " + formatStatBar(stats.dunk || 5));
        view.blank();
        
        view.line("\1h\1y\xCD\xCD\xCD STATUS \xCD\xCD\xCD\1n");
        if (contact.status === "signed") {
            view.line("  \1gPermanently signed\1n");
            view.line("  \1gNo cut taken\1n");
        } else {
            view.line("  \1yTemporary\1n");
            view.line("  \1yTakes " + contact.cutPercent + "% cut\1n");
            view.line("  Sign: \1w$" + contact.signCost + "\1n");
        }
        view.blank();
        
        view.line("\1h\1y\xCD\xCD\xCD TEAMMATE \xCD\xCD\xCD\1n");
        if (isActive) {
            view.line("  \1h\1g* ACTIVE *\1n");
        } else {
            view.line("  \1kReserve\1n");
        }
        
        // Footer with options
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.gotoxy(1, 1);
            footerFrame.putmsg("\1h\1c\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\1n");
            footerFrame.gotoxy(1, 2);
            var opts = "  \1w[R]\1n\1w Release  ";
            if (contact.status !== "signed") {
                opts += "\1w[S]\1n\1w Sign ($" + contact.signCost + ")  ";
            }
            if (!isActive) {
                opts += "\1w[A]\1n\1w Set Active  ";
            }
            opts += "\1w[Q]\1n\1w Back";
            footerFrame.putmsg(opts);
        }
        
        view.render();
        
        var choice = console.getkey().toUpperCase();
        view.close();
        
        if (choice === "R") {
            releaseFromCrew(ctx, contact);
        } else if (choice === "S" && contact.status !== "signed") {
            signPermanent(ctx, contact, null);
        } else if (choice === "A" && !isActive) {
            if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.setActiveTeammate) {
                LORB.Util.Contacts.setActiveTeammate(ctx, contact.id);
                LORB.View.clear();
                LORB.View.line("");
                LORB.View.line("\1h\1g" + contact.name + " is now your active teammate!\1n");
                console.getkey();
            }
        }
    }
    
    /**
     * Get contact by ID - uses hydration for full data
     */
    function getContactById(ctx, contactId) {
        return LORB.Util.Contacts.getContact(ctx, contactId);
    }
    
    /**
     * Get character art file path from contact name
     * Converts "Tyrese Halliburton" -> "tyrese_halliburton.bin"
     */
    function getCharacterArtPath(contact) {
        if (!contact || !contact.name) return null;
        var filename = contact.name.toLowerCase().replace(/[^a-z0-9]+/g, "_") + ".bin";
        var path = CHARACTERS_DIR + filename;
        // Check if file exists
        if (file_exists(path)) {
            return path;
        }
        return null;
    }
    
    /**
     * Format a stat bar (1-10 scale)
     */
    function formatStatBar(value) {
        var bar = "";
        var v = Math.min(Math.max(value || 0, 0), 10);
        for (var i = 0; i < v; i++) bar += "\1g\xDB";
        bar += "\1n\1h\1k";
        for (var i = v; i < 10; i++) bar += "\xDB";
        return bar + "\1n \1w" + v + "\1n";
    }
    
    /**
     * Pad string to length
     */
    function padRight(str, len) {
        str = String(str || "");
        while (str.length < len) str += " ";
        return str.substring(0, len);
    }
    
    /**
     * Load art files
     */
    function loadArtWithBinLoader(view) {
        if (typeof BinLoader === "undefined") return;
        
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            BinLoader.loadIntoFrame(headerFrame, ART_HEADER, ART_HEADER_W, ART_HEADER_H, 1, 1);
        }
        
        var artFrame = view.getZone("art");
        if (artFrame) {
            BinLoader.loadIntoFrame(artFrame, ART_SIDE, ART_SIDE_W, ART_SIDE_H, 1, 1);
        }
        
        view.render();
    }
    
    /**
     * Legacy fallback
     */
    function runLegacy(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("YOUR CRIB");
            LORB.View.line("");
            LORB.View.line("Crew: " + ctx.crew.length + "/" + MAX_CREW_SIZE);
            LORB.View.line("Contacts: " + ctx.contacts.length);
            LORB.View.line("");
            LORB.View.line("[1] Contacts  [2] Your Crew  [3] Stats  [Q] Back");
            LORB.View.line("");
            
            var choice = LORB.View.prompt("Choice: ").toUpperCase();
            
            switch (choice) {
                case "1":
                    runContactsLegacy(ctx);
                    break;
                case "2":
                    runCrewLegacy(ctx);
                    break;
                case "3":
                    if (LORB.UI && LORB.UI.StatsView) {
                        LORB.UI.StatsView.show(ctx);
                    }
                    break;
                case "Q":
                    return;
            }
        }
    }
    
    function runContactsLegacy(ctx) {
        LORB.View.clear();
        LORB.View.header("CONTACTS");
        LORB.View.line("");
        
        if (ctx.contacts.length === 0) {
            LORB.View.line("No contacts yet.");
            LORB.View.line("Defeat NBA players to get their number!");
        } else {
            var hydratedContacts = LORB.Util.Contacts.getAllContacts(ctx);
            for (var i = 0; i < hydratedContacts.length; i++) {
                var c = hydratedContacts[i];
                var status = c.status === "signed" ? "[SIGNED]" : 
                             c.status === "temp" ? "[TEMP]" : "";
                LORB.View.line((i + 1) + ". " + c.name + " " + status);
            }
        }
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
    }
    
    function runCrewLegacy(ctx) {
        LORB.View.clear();
        LORB.View.header("YOUR CREW");
        LORB.View.line("");
        
        if (ctx.crew.length === 0) {
            LORB.View.line("No crew members yet.");
        } else {
            for (var i = 0; i < ctx.crew.length; i++) {
                var contact = getContactById(ctx, ctx.crew[i].contactId);
                if (contact) {
                    LORB.View.line((i + 1) + ". " + contact.name);
                }
            }
        }
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
    }
    
    // Export
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Crib = {
        run: run,
        MAX_CREW_SIZE: MAX_CREW_SIZE,
        getContactById: getContactById,
        isOnCrew: isOnCrew
    };
    
})();
