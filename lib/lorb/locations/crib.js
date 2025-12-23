/**
 * crib.js - Player's Home (Your Crib)
 * 
 * Home base for managing crew and viewing personal stats.
 * Submenus: Ballerdex (Contacts), Your Crew, Stats & Records
 */

var _cribRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _cribRichView = RichView;
} catch (e) {
}

// Load BinLoader for .bin file loading
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
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
    
    var ART_BABY_MAMAS = "/sbbs/xtrn/nba_jam/assets/lorb/baby_mamas_art.bin";
    
    var CHARACTERS_DIR = "/sbbs/xtrn/nba_jam/assets/characters/";
    var BOSSES_DIR = "/sbbs/xtrn/nba_jam/assets/lorb/bosses/";
    var CHAR_ART_W = 40;
    var CHAR_ART_H = 20;
    
    // Crew constants
    var MAX_CREW_SIZE = 5;
    
    // Walkable zone for wandering sprites (within 40x20 art zone)
    // This is the "floor" area where sprites can roam
    var CRIB_WALKABLE_ZONE = { x: 1, y: 15, width: 39, height: 6 };  // Main floor area (1,15 to 40,21)
    var CRIB_WALKABLE_ZONES = [CRIB_WALKABLE_ZONE];
    
    // Lazy-load SpriteWanderer and SpriteSelectors
    var _spriteWandererLoaded = false;
    var _spriteWandererClass = null;
    var _spriteSelectorLoaded = false;
    var _spriteSelectorModule = null;
    
    /**
     * Get SpriteWanderer class, loading it lazily if needed
     */
    function getSpriteWanderer() {
        if (_spriteWandererLoaded) {
            return _spriteWandererClass;
        }
        _spriteWandererLoaded = true;
        try {
            load("/sbbs/xtrn/nba_jam/lib/lorb/ui/sprite-wanderer.js");
            if (typeof LORB !== "undefined" && LORB.UI && LORB.UI.SpriteWanderer) {
                _spriteWandererClass = LORB.UI.SpriteWanderer;
            }
        } catch (e) {
            // SpriteWanderer is optional - continue without it
        }
        return _spriteWandererClass;
    }
    
    /**
     * Get SpriteSelectors module, loading it lazily if needed
     */
    function getSpriteSelectors() {
        if (_spriteSelectorLoaded) {
            return _spriteSelectorModule;
        }
        _spriteSelectorLoaded = true;
        try {
            load("/sbbs/xtrn/nba_jam/lib/lorb/util/sprite-selectors.js");
            if (typeof LORB !== "undefined" && LORB.Util && LORB.Util.SpriteSelectors) {
                _spriteSelectorModule = LORB.Util.SpriteSelectors;
            }
        } catch (e) {
            // SpriteSelectors is optional - continue without it
        }
        return _spriteSelectorModule;
    }
    
    /**
     * Wait for ENTER key specifically (ignores other keys)
     * This prevents mashed gameplay keys from dismissing important screens
     */
    function waitForEnter() {
        var key;
        do {
            key = console.getkey(K_NOSPIN);
        } while (key !== "\r" && key !== "\n");
    }
    
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
            console.getkey(K_NOSPIN);
            return "reset";
        }
        return null;
    }
    
    // =========================================================================
    // CHAMPION'S CHALLENGE - Full Rich End-Game Flow (for testing)
    // =========================================================================
    
    /**
     * Run the Champion's Challenge with full rich presentation.
     * Player only knows about Jordan initially. Red Bull is the twist.
     * 
     * @param {Object} ctx - Player context
     */
    function runChampionChallengeFromCrib(ctx) {
        // Show Jordan intro - player thinks THIS is the final boss
        if (!showJordanChallengeIntro(ctx)) {
            return;  // Player backed out
        }
        
        // Run Jordan match
        var jordanResult = null;
        if (LORB.Locations && LORB.Locations.RedBullChallenge) {
            jordanResult = LORB.Locations.RedBullChallenge.launchJordanChallenge(ctx, { skipIntro: true, skipOutro: true });
        } else {
            jordanResult = { completed: true, won: Math.random() < 0.4, quit: false };
        }
        
        if (!jordanResult || jordanResult.quit) {
            return;
        }
        
        if (!jordanResult.won) {
            showJordanDefeatScreen(ctx);
            return;
        }
        
        // Player beat Jordan! Show victory... then the TWIST
        showJordanVictoryScreen(ctx);
        
        // THE REVEAL - Red Bull appears!
        showRedBullReveal(ctx);
        
        // Run Red Bull match
        var redBullResult = null;
        if (LORB.Locations && LORB.Locations.RedBullChallenge) {
            redBullResult = LORB.Locations.RedBullChallenge.launchRedBullChallenge(ctx, { skipIntro: true, skipOutro: true });
        } else {
            redBullResult = { completed: true, won: Math.random() < 0.2, quit: false };
        }
        
        if (!redBullResult || redBullResult.quit) {
            return;
        }
        
        if (redBullResult.won) {
            showRedBullVictoryScreen(ctx);
        } else {
            showRedBullDefeatScreen(ctx);
        }
    }
    
    /**
     * Jordan intro - Player thinks this is THE challenge
     * Returns true if player proceeds, false if they back out
     */
    function showJordanChallengeIntro(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("THE CHALLENGE");
            LORB.View.line("");
            LORB.View.line("You've proven yourself on the streets.");
            LORB.View.line("But can you beat THE GREATEST?");
            LORB.View.line("");
            LORB.View.line("Michael Jordan awaits.");
            LORB.View.line("");
            LORB.View.line("[ENTER] Accept the Challenge");
            LORB.View.line("[Q] Not ready yet");
            var key = console.getkey(K_NOSPIN);
            return (key !== "Q" && key !== "q");
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art_left", x: 1, y: 5, width: 40, height: 20 },
                { name: "art_right", x: 41, y: 5, width: 40, height: 20 }
            ]
        });
        
        // Jordan sprite on left
        var leftZone = view.getZone("art_left");
        var jordanPath = CHARACTERS_DIR + "michael_jordan.bin";
        if (leftZone && typeof BinLoader !== "undefined" && file_exists(jordanPath)) {
            BinLoader.loadIntoFrame(leftZone, jordanPath, CHAR_ART_W, CHAR_ART_H, 1, 1);
        }
        
        // Pippen sprite on right
        var rightZone = view.getZone("art_right");
        var pippenPath = CHARACTERS_DIR + "scottie_pippen.bin";
        if (rightZone && typeof BinLoader !== "undefined" && file_exists(pippenPath)) {
            BinLoader.loadIntoFrame(rightZone, pippenPath, CHAR_ART_W, CHAR_ART_H, 1, 1);
        }
        
        // Header
        var headerZone = view.getZone("header");
        if (headerZone) {
            headerZone.gotoxy(1, 2);
            headerZone.putmsg("\1h\1r         Michael Jordan and Scottie Pippen challenge you!\1n");
            headerZone.gotoxy(1, 4);
            headerZone.putmsg("\1h\1w[ENTER]\1n \1wAccept   \1h\1w[Q]\1n \1wNot ready\1n");
        }
        
        view.render();
        
        var key = console.getkey(K_NOSPIN);
        view.close();
        
        return (key !== "Q" && key !== "q");
    }
    
    /**
     * Jordan defeat - trash talk
     */
    function showJordanDefeatScreen(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.line("");
            LORB.View.line("Jordan laughs as you walk off.");
            LORB.View.line("\"That's why I'm the GOAT, kid.\"");
            waitForEnter();
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "art", x: 1, y: 1, width: 40, height: 24 },
                { name: "content", x: 42, y: 1, width: 38, height: 24 }
            ]
        });
        
        // Jordan sprite
        var artZone = view.getZone("art");
        var jordanPath = CHARACTERS_DIR + "michael_jordan.bin";
        if (artZone && typeof BinLoader !== "undefined" && file_exists(jordanPath)) {
            BinLoader.loadIntoFrame(artZone, jordanPath, CHAR_ART_W, CHAR_ART_H, 1, 1);
        }
        
        view.setContentZone("content");
        view.blank();
        view.blank();
        view.blank();
        view.line("\1h\1rDEFEAT\1n");
        view.blank();
        view.blank();
        view.line("\1wJordan laughs as you\1n");
        view.line("\1wwalk off the court.\1n");
        view.blank();
        view.line("\1y\"That's why I'm the GOAT, kid.\"\1n");
        view.blank();
        view.line("\1y\"Come back when you've\1n");
        view.line("\1ygot six rings.\"\1n");
        view.blank();
        view.blank();
        view.blank();
        view.line("\1h\1kPress ENTER to continue...\1n");
        
        view.render();
        waitForEnter();
        view.close();
    }
    
    /**
     * Jordan victory - brief celebration before the twist
     */
    function showJordanVictoryScreen(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.line("");
            LORB.View.line("YOU DID IT!");
            LORB.View.line("Michael Jordan has been defeated!");
            LORB.View.line("");
            LORB.View.line("The crowd goes wild...");
            waitForEnter();
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "content", x: 1, y: 1, width: 80, height: 24 }
            ]
        });
        
        view.setContentZone("content");
        view.blank();
        view.blank();
        view.blank();
        view.blank();
        view.line("\1h\1g                            VICTORY!\1n");
        view.blank();
        view.blank();
        view.line("\1w                   Michael Jordan has been defeated!\1n");
        view.blank();
        view.line("\1w                        The crowd goes wild...\1n");
        view.blank();
        view.line("\1w                    You are the TRUE champion!\1n");
        view.blank();
        view.blank();
        view.blank();
        view.line("\1h\1kPress ENTER to continue...\1n");
        
        view.render();
        waitForEnter();
        view.close();
    }
    
    /**
     * THE TWIST - Red Bull reveal after beating Jordan
     */
    function showRedBullReveal(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.line("");
            LORB.View.line("The lights go out...");
            mswait(1500);
            LORB.View.line("");
            LORB.View.line("The court grows cold.");
            LORB.View.line("Flames lick the baseline.");
            LORB.View.line("");
            LORB.View.line("A new challenger appears...");
            waitForEnter();
            return;
        }
        
        // Phase 1: Darkness
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "content", x: 1, y: 1, width: 80, height: 24 }
            ]
        });
        
        view.setContentZone("content");
        view.blank();
        view.blank();
        view.blank();
        view.blank();
        view.blank();
        view.blank();
        view.blank();
        view.line("\1h\1k                           The lights go out...\1n");
        
        view.render();
        mswait(2000);
        view.close();
        
        // Phase 2: The reveal
        view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 5 },
                { name: "art_left", x: 1, y: 6, width: 40, height: 18 },
                { name: "art_right", x: 41, y: 6, width: 40, height: 18 }
            ]
        });
        
        // CHALLENGER! header
        var headerZone = view.getZone("header");
        if (headerZone) {
            headerZone.clear();
            headerZone.gotoxy(1, 1);
            headerZone.putmsg("\1h\1r  ___ _  _   _   _    _    ___ _  _  ___ ___ ___ _ \r\n");
            headerZone.putmsg("\1h\1r / __| || | /_\\ | |  | |  | __| \\| |/ __| __| _ \\ |\r\n");
            headerZone.putmsg("\1h\1y| (__| __ |/ _ \\| |__| |__| _|| .` | (_ | _||   /_|\r\n");
            headerZone.putmsg("\1h\1y \\___|_||_/_/ \\_\\____|____|___|_|\\_|\\___|___|_|_(_)\r\n");
        }
        
        // Satan sprite on left
        var leftZone = view.getZone("art_left");
        var satanPath = BOSSES_DIR + "devil.bin";
        if (leftZone && typeof BinLoader !== "undefined" && file_exists(satanPath)) {
            BinLoader.loadIntoFrame(leftZone, satanPath, CHAR_ART_W, CHAR_ART_H, 1, 1);
        }
        
        // Iceman sprite on right
        var rightZone = view.getZone("art_right");
        var icemanPath = BOSSES_DIR + "iceman.bin";
        if (rightZone && typeof BinLoader !== "undefined" && file_exists(icemanPath)) {
            BinLoader.loadIntoFrame(rightZone, icemanPath, CHAR_ART_W, CHAR_ART_H, 1, 1);
        }
        
        view.render();
        mswait(2000);
        waitForEnter();
        view.close();
    }
    
    /**
     * Red Bull defeat
     */
    function showRedBullDefeatScreen(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.line("Satan laughs. The GOAT remains supreme.");
            waitForEnter();
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "art", x: 1, y: 1, width: 40, height: 24 },
                { name: "content", x: 42, y: 1, width: 38, height: 24 }
            ]
        });
        
        // Satan sprite
        var artZone = view.getZone("art");
        var satanPath = BOSSES_DIR + "devil.bin";
        if (artZone && typeof BinLoader !== "undefined" && file_exists(satanPath)) {
            BinLoader.loadIntoFrame(artZone, satanPath, CHAR_ART_W, CHAR_ART_H, 1, 1);
        }
        
        view.setContentZone("content");
        view.blank();
        view.blank();
        view.blank();
        view.blank();
        view.line("\1h\1rDEFEAT\1n");
        view.blank();
        view.blank();
        view.line("\1wSatan laughs as Iceman\1n");
        view.line("\1wshatters your hopes.\1n");
        view.blank();
        view.line("\1rThe GOAT remains supreme.\1n");
        view.blank();
        view.blank();
        view.blank();
        view.line("\1h\1kPress ENTER to continue...\1n");
        
        view.render();
        waitForEnter();
        view.close();
    }
    
    /**
     * Red Bull victory - LEGENDARY!
     */
    function showRedBullVictoryScreen(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.line("LEGENDARY! Hell freezes over!");
            LORB.View.line("You have conquered the Red Bull!");
            waitForEnter();
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "content", x: 1, y: 1, width: 80, height: 24 }
            ]
        });
        
        view.setContentZone("content");
        view.blank();
        view.blank();
        view.blank();
        view.line("\1h\1y                    ★ ★ ★  LEGENDARY  ★ ★ ★\1n");
        view.blank();
        view.blank();
        view.line("\1h\1r                       HELL FREEZES OVER\1n");
        view.blank();
        view.blank();
        view.line("\1h\1g                    The GOAT has been slain!\1n");
        view.blank();
        view.line("\1w               You are the TRUE champion of Rim City!\1n");
        view.blank();
        view.blank();
        view.line("\1c              Your name now glows in the Hall of Fame.\1n");
        view.blank();
        view.blank();
        view.blank();
        view.line("\1h\1kPress ENTER to continue...\1n");
        
        view.render();
        waitForEnter();
        view.close();
    }
    
    // =========================================================================
    // BABY MAMAS & KIDS - Child Support Management
    // =========================================================================
    
    /**
     * Baby Mamas & Kids menu - view children, pay child support, set parenting mode
     */
    function runBabyMamasAndKids(ctx) {
        if (!RichView) {
            runBabyMamasLegacy(ctx);
            return;
        }
        
        // Lazy-load sprite modules
        var SpriteWanderer = getSpriteWanderer();
        var SpriteSelectors = getSpriteSelectors();
        
        while (true) {
            // Wanderer must be created fresh each iteration since view/artFrame is recreated
            var wanderer = null;
            
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 4 },
                    { name: "art", x: 1, y: 5, width: 40, height: 20 },
                    { name: "content", x: 41, y: 5, width: 40, height: 20 }
                ],
                theme: "lorb"
            });
            
            // Render figlet banner in header
            var headerFrame = view.getZone("header");
            if (headerFrame) {
                if (LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
                    LORB.Util.FigletBanner.renderToFrame(headerFrame, "FAMILY", LIGHTMAGENTA | HIGH);
                } else {
                    headerFrame.putmsg("\1h\1m=== BABY MAMAS & KIDS ===\1n\r\n");
                }
            }
            
            // Load art into art zone
            var artFrame = view.getZone("art");
            
            var babies = ctx.babyBallers || [];
            var babyMamas = ctx.babyMamas || [];
            
            // Load background art (baby_mamas_art.bin) first, wanderer sprites will render on top
            if (artFrame && typeof BinLoader !== "undefined") {
                try {
                    var binData = BinLoader.loadBinFile(ART_BABY_MAMAS);
                    if (binData) {
                        var offset = 0;
                        for (var ay = 0; ay < ART_SIDE_H; ay++) {
                            for (var ax = 0; ax < ART_SIDE_W; ax++) {
                                if (offset + 1 < binData.length) {
                                    var ch = binData.charAt(offset++);
                                    var attr = binData.charCodeAt(offset++);
                                    try {
                                        artFrame.setData(ax, ay, ch, attr, false);
                                    } catch (e) {}
                                } else {
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Art loading is optional
                }
            }
            
            // Initialize wandering baby sprites
            if (SpriteWanderer && babies.length > 0 && artFrame) {
                try {
                    var babySprites;
                    
                    if (SpriteSelectors && SpriteSelectors.getBabySprites) {
                        // Use smart selection: baby ballers from ctx
                        babySprites = SpriteSelectors.getBabySprites(ctx);
                        SpriteSelectors.applyPositions(babySprites, CRIB_WALKABLE_ZONE);
                    } else {
                        // Fallback: random baby sprites
                        var availableSkins = ["brown", "lightgray", "magenta"];
                        var babyCount = Math.min(3, babies.length);
                        babySprites = [];
                        for (var si = 0; si < babyCount; si++) {
                            babySprites.push({
                                skin: availableSkins[Math.floor(Math.random() * availableSkins.length)],
                                x: CRIB_WALKABLE_ZONE.x + 4 + (si * 6),
                                y: CRIB_WALKABLE_ZONE.y + 2,  // Feet at zone.y+2 (middle of zone)
                                bearing: ["e", "w", "s"][Math.floor(Math.random() * 3)]
                            });
                        }
                    }
                    
                    if (babySprites.length > 0) {
                        wanderer = new SpriteWanderer({
                            parentFrame: artFrame,
                            sprites: babySprites,
                            walkableZones: CRIB_WALKABLE_ZONES,
                            options: {
                                speed: 350,        // Move every 350ms (kids are energetic!)
                                pauseChance: 0.30, // 30% chance to idle
                                showNametags: true // Show baby nicknames
                            }
                        });
                        wanderer.start();
                        view.render();
                    }
                } catch (e) {
                    // Wanderer is optional - continue without it
                    wanderer = null;
                }
            }
            
            // Calculate totals
            var totalOwed = 0;
            var independentCount = 0;
            var dependentCount = 0;
            var nemesisCount = 0;
            debugLog("[CRIB-DISPLAY] Calculating display totals for " + babies.length + " babies");
            for (var i = 0; i < babies.length; i++) {
                var baby = babies[i];
                var cs = baby.childSupport;
                
                debugLog("[CRIB-DISPLAY] Baby '" + baby.nickname + "': isAbandoned=" + (cs && cs.isAbandoned) + ", isPaidOff=" + (cs && cs.isPaidOff) + ", isNemesis=" + baby.isNemesis + ", balance=" + (cs ? cs.balance : "N/A"));
                
                // Count nemesis/abandoned separately
                if ((cs && cs.isAbandoned) || baby.isNemesis) {
                    debugLog("[CRIB-DISPLAY]   -> Nemesis/Abandoned");
                    nemesisCount++;
                    continue;
                }
                
                if (cs && !cs.isPaidOff) {
                    debugLog("[CRIB-DISPLAY]   -> Dependent, adding balance: " + cs.balance);
                    dependentCount++;
                    totalOwed += cs.balance;
                } else {
                    debugLog("[CRIB-DISPLAY]   -> Independent (paid off)");
                    independentCount++;
                }
            }
            debugLog("[CRIB-DISPLAY] Final: totalOwed=$" + totalOwed + ", independent=" + independentCount + ", dependent=" + dependentCount + ", nemesis=" + nemesisCount);
            
            // Draw YELLOW border on content zone - returns inner contentFrame
            var contentFrame = view.drawBorder("content", {
                color: YELLOW,
                title: "FAMILY",
                padding: 0
            });
            
            // Write content directly to inner frame using gotoxy/putmsg
            var cy = 1;
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1h\1yFamily Overview\1n");
            cy++;  // blank line
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1wTotal Children: \1c" + babies.length + "\1n");
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1wIndependent: \1g" + independentCount + "\1n");
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1wDependent: \1r" + dependentCount + "\1n");
            if (nemesisCount > 0) {
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg("\1wNemesis: \1h\1k" + nemesisCount + "\1n");
            }
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1wTotal Support Owed: \1y$" + totalOwed + "\1n");
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1wYour Cash: \1y$" + (ctx.cash || 0) + "\1n");
            // blank line before menu
            cy++;
            
            // onIdle callback to animate wandering sprites
            var onIdleCallback = function(richView, lightbar) {
                if (wanderer && wanderer.isRunning()) {
                    wanderer.update();
                    wanderer.cycle();
                    richView.render();
                }
            };
            
            var menuItems = [
                { text: "\1wView Children", value: "children", hotkey: "1" },
                { text: "\1wView Baby Mamas", value: "mamas", hotkey: "2" },
                { text: "\1wCollect Earnings", value: "collect", hotkey: "3" },
                { text: "\1wFamily Tree", value: "tree", hotkey: "4" },
                { text: "\1wMake Payment", value: "pay", hotkey: "5" },
                { text: "\1wBack", value: "back", hotkey: "Q" }
            ];
            
            // Menu y is relative to inner frame (border uses 1 row top/bottom)
            var choice = view.menu(menuItems, { y: 12, onIdle: onIdleCallback });
            
            // Stop wanderer before navigating away
            if (wanderer) wanderer.stop();
            view.close();
            
            switch (choice) {
                case "children":
                    viewChildren(ctx);
                    break;
                case "mamas":
                    viewBabyMamas(ctx);
                    break;
                case "collect":
                    collectBabyEarnings(ctx);
                    break;
                case "tree":
                    showFamilyTree(ctx);
                    break;
                case "pay":
                    makeChildSupportPayment(ctx);
                    break;
                case "back":
                case null:
                    return;
            }
        }
    }
    
    /**
     * Show the family tree visualization
     */
    function showFamilyTree(ctx) {
        // Try to load family_view.js if not already loaded
        if (!LORB.UI || !LORB.UI.FamilyView) {
            try {
                load("/sbbs/xtrn/nba_jam/lib/lorb/ui/family_view.js");
            } catch (e) {
                showMessage("Error", "Could not load family tree view: " + e);
                return;
            }
        }
        
        if (LORB.UI && LORB.UI.FamilyView && LORB.UI.FamilyView.show) {
            LORB.UI.FamilyView.show(ctx);
        } else {
            showMessage("Error", "Family tree view not available.");
        }
    }
    
    /**
     * View list of children with stats
     */
    function viewChildren(ctx) {
        var babies = ctx.babyBallers || [];
        
        if (babies.length === 0) {
            showMessage("No Children", "You don't have any kids yet.\nTry flirting at Club 23...");
            return;
        }
        
        var sortMode = "name";  // name | status | relationship
        
        while (true) {
            // Apply sorting for display
            var sorted = babies.slice(0);
            if (sortMode === "status") {
                sorted.sort(function(a, b) {
                    var aKey = (a.childSupport.isPaidOff ? 0 : a.childSupport.isOverdue ? 1 : a.isNemesis ? 2 : 3);
                    var bKey = (b.childSupport.isPaidOff ? 0 : b.childSupport.isOverdue ? 1 : b.isNemesis ? 2 : 3);
                    if (aKey !== bKey) return aKey - bKey;
                    return (a.nickname || "").localeCompare(b.nickname || "");
                });
            } else if (sortMode === "relationship") {
                sorted.sort(function(a, b) {
                    return (a.relationship || 0) - (b.relationship || 0);
                });
            } else {
                sorted.sort(function(a, b) {
                    return (a.nickname || "").localeCompare(b.nickname || "");
                });
            }
        
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 3 },
                    { name: "list", x: 1, y: 4, width: 40, height: 21 },
                    { name: "detail", x: 41, y: 4, width: 40, height: 21 }
                ],
                theme: "lorb"
            });
            
            var headerFrame = view.getZone("header");
            if (headerFrame) {
                headerFrame.putmsg("\1h\1c=== YOUR CHILDREN ===\1n");
            }
            
            view.setContentZone("list");
            var menuItems = [];
            var gameDay = LORB.Locations.Hub && LORB.Locations.Hub.getSharedGameDay ? LORB.Locations.Hub.getSharedGameDay() : 0;
            for (var i = 0; i < sorted.length; i++) {
                var baby = sorted[i];
                var status;
                if (baby.childSupport.isPaidOff) {
                    status = "\1g[IND]\1n";
                } else if (baby.childSupport.isOverdue) {
                    status = "\1h\1r[OVERDUE!]\1n";
                } else if (baby.isNemesis) {
                    status = "\1h\1r[NEMESIS]\1n";
                } else if (LORB.Data.BabyBallers && LORB.Data.BabyBallers.getDeadlineStatus) {
                    var dStatus = LORB.Data.BabyBallers.getDeadlineStatus(baby, gameDay);
                    if (dStatus.status === "warning") {
                        status = "\1h\1y[" + dStatus.daysRemaining + " DAYS!]\1n";
                    } else if (dStatus.status === "due_today") {
                        status = "\1h\1r[DUE NOW!]\1n";
                    } else {
                        status = "\1r[$]\1n";
                    }
                } else {
                    status = "\1r[$]\1n";
                }
                menuItems.push({
                    text: "\1w" + baby.nickname + "\1n " + status,
                    value: baby.id,
                    hotkey: String(i + 1)
                });
            }
            menuItems.push({ text: "Sort: " + sortMode, value: "sort", hotkey: "S" });
            menuItems.push({ text: "Back", value: "back", hotkey: "Q" });
            
            var choice = view.menu(menuItems, { y: 1, showDetail: function(idx) {
                if (idx === "back" || idx === "sort" || idx === null) return;
                // idx is baby.id; find the record
                for (var b = 0; b < sorted.length; b++) {
                    if (sorted[b].id === idx) {
                        showChildDetail(view, sorted[b]);
                        break;
                    }
                }
            }});
            
            view.close();
            
            if (choice === "back" || choice === null) {
                return;
            }
            if (choice === "sort") {
                sortMode = sortMode === "name" ? "status" : sortMode === "status" ? "relationship" : "name";
                continue;
            }
            
            // Selected a child - show full detail with navigation
            var currentIndex = -1;
            for (var ci = 0; ci < sorted.length; ci++) {
                if (sorted[ci].id === choice) {
                    currentIndex = ci;
                    break;
                }
            }
            if (currentIndex === -1) return;
            while (true) {
                var nav = showChildFullView(ctx, sorted[currentIndex], sorted, currentIndex);
                if (nav === "next") {
                    currentIndex = (currentIndex + 1) % sorted.length;
                } else if (nav === "prev") {
                    currentIndex = (currentIndex - 1 + sorted.length) % sorted.length;
                } else {
                    break;
                }
            }
        }
    }
    
    /**
     * Show child detail in right panel
     */
    function showChildDetail(view, baby) {
        var detailFrame = view.getZone("detail");
        if (detailFrame) {
            detailFrame.clear();
            detailFrame.gotoxy(1, 1);
        }
        view.setContentZone("detail");
        
        view.line("\1h\1y" + baby.name + "\1n");
        view.line("\1waka \1c" + baby.nickname + "\1n");
        view.blank();
        
        view.line("\1wMother: \1c" + (baby.motherName || "Unknown") + "\1n");
        view.line("\1wLevel: \1c" + baby.level + "\1n");
        view.line("\1wCourt: \1c" + (LORB.Data.BabyBallers ? LORB.Data.BabyBallers.getCourtTierName(baby.currentCourt) : baby.currentCourt) + "\1n");
        view.blank();
        
        // Quick status summary
        var gameDay = LORB.Locations.Hub && LORB.Locations.Hub.getSharedGameDay ? LORB.Locations.Hub.getSharedGameDay() : 0;
        var deadline = (LORB.Data.BabyBallers && LORB.Data.BabyBallers.getDeadlineStatus) ? LORB.Data.BabyBallers.getDeadlineStatus(baby, gameDay) : { status: "unknown" };
        var supportTag = "\1gPAID OFF\1n";
        if (baby.childSupport && !baby.childSupport.isPaidOff) {
            if (baby.childSupport.isAbandoned) {
                supportTag = "\1h\1kABANDONED\1n";
            } else if (baby.childSupport.isOverdue) {
                supportTag = "\1h\1rOVERDUE\1n";
            } else if (deadline.status === "warning" || deadline.status === "due_today") {
                supportTag = "\1h\1yDUE SOON\1n";
            } else {
                supportTag = "\1yACTIVE BALANCE\1n";
            }
        }
        var relLabel = baby.isNemesis ? "\1h\1rNEMESIS\1n" : (baby.relationship <= -25 ? "\1rHostile\1n" : (baby.relationship < 25 ? "\1yNeutral\1n" : "\1gWarm\1n"));
        var parentingMode = baby.parentingMode || "nurture";
        var parentingText = {
            nurture: "You’re actively supporting and bonding.",
            neglect: "Minimal effort; support still owed.",
            abandon: "You chose to walk away; support will go overdue and adoption may occur."
        }[parentingMode] || "Unknown stance.";
        
        view.line("\1h\1wStatus: " + relLabel + "  \1wSupport: " + supportTag + "\1n");
        view.line("\1wParenting: \1c" + parentingMode.toUpperCase() + "\1n");
        view.line("\1w" + parentingText + "\1n");
        view.blank();
        
        // Stats
        view.line("\1h\1wStats:\1n");
        if (baby.stats) {
            view.line(" SPD:\1c" + baby.stats.speed + "\1n 3PT:\1c" + baby.stats.threePt + "\1n DNK:\1c" + baby.stats.dunk + "\1n");
            view.line(" BLK:\1c" + baby.stats.block + "\1n PWR:\1c" + baby.stats.power + "\1n STL:\1c" + baby.stats.steal + "\1n");
        }
        view.blank();
        
        // Child support status
        if (baby.childSupport.isPaidOff) {
            view.line("\1h\1g★ INDEPENDENT ★\1n");
        } else if (baby.childSupport.isAbandoned) {
            view.line("\1h\1kABANDONED (Awaiting adoption)\1n");
            view.line("\1wAnother player may adopt if you stay away.\1n");
        } else {
            var supportStatus = "\1wSupport Owed: \1y$" + baby.childSupport.balance + "\1n";
            view.line(supportStatus);
            
            // Show deadline status
            if (baby.childSupport.isOverdue) {
                view.line("\1h\1r[!] PAST DUE!\1n");
                view.line("\1wPay the balance to stop relationship/alignment decay.\1n");
            } else if (LORB.Data.BabyBallers && LORB.Data.BabyBallers.getDeadlineStatus) {
                if (deadline.status === "warning") {
                    view.line("\1h\1y[!] " + deadline.daysRemaining + " days until deadline!\1n");
                } else if (deadline.status === "due_today") {
                    view.line("\1h\1r[!] DUE TODAY!\1n");
                } else if (deadline.daysRemaining > 0) {
                    view.line("\1wDeadline: Day " + baby.childSupport.dueDate + " (" + deadline.daysRemaining + " days)\1n");
                }
                view.line("\1wMeet the deadline to avoid abandonment/adoption.\1n");
            }
        }
        
        // Relationship
        var relStr = LORB.Data.BabyBallers ? LORB.Data.BabyBallers.getRelationshipString(baby) : "Unknown";
        view.line("\1wRelationship: " + relStr);
        
        // Nemesis warning
        if (baby.isNemesis) {
            view.blank();
            view.line("\1h\1r☠ NEMESIS STATUS ☠\1n");
            view.line("\1rThis child hunts you on the courts!\1n");
        }
    }
    
    /**
     * Full view of a child with actions
     */
    function showChildFullView(ctx, baby, allBabies, idx) {
        while (true) {
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 3 },
                    { name: "stats", x: 1, y: 4, width: 40, height: 18 },
                    { name: "actions", x: 41, y: 4, width: 40, height: 18 },
                    { name: "menu", x: 1, y: 22, width: 80, height: 3 }
                ],
                theme: "lorb"
            });
            
            var headerFrame = view.getZone("header");
            if (headerFrame) {
                headerFrame.putmsg("\1h\1c" + baby.name + " (" + baby.nickname + ")\1n");
            }
            
            var gameDay = LORB.Locations.Hub && LORB.Locations.Hub.getSharedGameDay ? LORB.Locations.Hub.getSharedGameDay() : 0;
            var deadline = (LORB.Data.BabyBallers && LORB.Data.BabyBallers.getDeadlineStatus) ? LORB.Data.BabyBallers.getDeadlineStatus(baby, gameDay) : { status: "unknown" };
            var relLabel = LORB.Data.BabyBallers ? LORB.Data.BabyBallers.getRelationshipString(baby) : "Unknown";
            var supportTag = baby.childSupport.isPaidOff ? "\1gPAID OFF\1n"
                : baby.childSupport.isAbandoned ? "\1h\1kABANDONED\1n"
                : baby.childSupport.isOverdue ? "\1h\1rOVERDUE\1n"
                : (deadline.status === "warning" || deadline.status === "due_today") ? "\1h\1yDUE SOON\1n"
                : "\1yACTIVE\1n";
            var parentingMode = baby.parentingMode || "nurture";
            var parentingText = {
                nurture: "You’re actively supporting and bonding.",
                neglect: "Minimal effort; pay before deadlines.",
                abandon: "You walked away; risk abandonment/adoption."
            }[parentingMode] || "Unknown stance.";
            
            view.setContentZone("stats");
            view.line("\1h\1yChild Info\1n");
            view.line("");
            view.line("\1wMother: \1c" + (baby.motherName || "Unknown") + "\1n");
            view.line("\1wBorn: \1cSeason " + baby.seasonBorn + ", Day " + baby.bornOnDay + "\1n");
            view.line("\1wLevel: \1c" + baby.level + " (" + baby.xp + "/" + 1000 + " XP)\1n");
            view.line("\1wRep: \1c" + baby.rep + "\1n");
            view.line("\1wRecord: \1g" + baby.wins + "W\1n / \1r" + baby.losses + "L\1n");
            view.line("\1wCourt: \1c" + (LORB.Data.BabyBallers ? LORB.Data.BabyBallers.getCourtTierName(baby.currentCourt) : baby.currentCourt) + "\1n");
            view.blank();
            view.line("\1h\1wStatus: \1n" + relLabel + "  \1wSupport: " + supportTag);
            view.line("\1wParenting: \1c" + parentingMode.toUpperCase() + "\1n");
            view.line("\1k" + parentingText + "\1n");
            view.blank();
            
            view.line("\1h\1wStats:\1n");
            if (baby.stats) {
                view.line(" Speed:   \1c" + baby.stats.speed + "\1n");
                view.line(" 3-Point: \1c" + baby.stats.threePt + "\1n");
                view.line(" Dunk:    \1c" + baby.stats.dunk + "\1n");
                view.line(" Block:   \1c" + baby.stats.block + "\1n");
                view.line(" Power:   \1c" + baby.stats.power + "\1n");
                view.line(" Steal:   \1c" + baby.stats.steal + "\1n");
            }
            
            view.setContentZone("actions");
            view.line("\1h\1yChild Support\1n");
            view.blank();
            
            if (baby.childSupport.isPaidOff) {
                view.line("\1h\1g★ INDEPENDENT ★\1n");
                view.line("\1wThis child is self-sufficient!");
                view.line("\1wStreetball earnings: \1y$" + (baby.streetballEarnings || 0) + "\1n");
            } else {
                view.line("\1wBalance: \1r$" + baby.childSupport.balance + "\1n");
                view.line("\1wTotal Owed: \1y$" + baby.childSupport.totalOwed + "\1n");
                view.line("\1wPaid: \1g$" + (baby.childSupport.totalOwed - baby.childSupport.balance) + "\1n");
                
                if (baby.childSupport.isAbandoned) {
                    view.blank();
                    view.line("\1h\1kABANDONED\1n");
                    view.line("\1wAnother player can adopt if you don’t intervene.\1n");
                } else if (baby.childSupport.isOverdue) {
                    view.blank();
                    view.line("\1h\1rPAST DUE!\1n");
                    view.line("\1kPay the balance to stop relationship/alignment decay.\1n");
                } else if (deadline.status === "warning") {
                    view.blank();
                    view.line("\1h\1y" + deadline.daysRemaining + " days until deadline.\1n");
                    view.line("\1kPay before it goes overdue (risk abandonment).\1n");
                } else if (deadline.status === "due_today") {
                    view.blank();
                    view.line("\1h\1rDUE TODAY (Day " + baby.childSupport.dueDate + ")\1n");
                    view.line("\1kMiss it and support becomes overdue.\1n");
                }
            }
            view.blank();
            
            view.line("\1h\1yRelationship\1n");
            var relStr = LORB.Data.BabyBallers ? LORB.Data.BabyBallers.getRelationshipString(baby) : "Unknown";
            view.line("\1wStatus: " + relStr);
            view.line("\1wParenting: \1c" + baby.parentingMode + "\1n");
            
            if (baby.isNemesis) {
                view.blank();
                view.line("\1h\1r★★★ NEMESIS ★★★\1n");
                view.line("\1rThis child has turned against you!\1n");
            }
            
            // Menu zone with actions
            view.setContentZone("menu");
            var menuItems = [
                { text: "< Prev Child", value: "prev", hotkey: "P" },
                { text: "Next Child >", value: "next", hotkey: "N" },
                { text: "Rename Child", value: "rename", hotkey: "R" },
                { text: "Change Nickname", value: "nickname", hotkey: "C" },
                { text: "Back", value: "back", hotkey: "Q" }
            ];
            
            var choice = view.menu(menuItems, { inline: true });
            view.close();
            
            if (choice === "back" || choice === null) {
                return;
            }
            
            if (choice === "rename") {
                renameChild(ctx, baby, "name");
            } else if (choice === "nickname") {
                renameChild(ctx, baby, "nickname");
            } else if (choice === "next") {
                return "next";
            } else if (choice === "prev") {
                return "prev";
            }
        }
    }
    
    /**
     * Rename a child's name or nickname
     * @param {Object} ctx - Player context
     * @param {Object} baby - The baby baller object
     * @param {string} field - "name" or "nickname"
     */
    function renameChild(ctx, baby, field) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.line("");
        
        var currentValue = field === "name" ? baby.name : baby.nickname;
        var fieldLabel = field === "name" ? "Name" : "Nickname";
        
        LORB.View.line("\1h\1yRename Child\1n");
        LORB.View.line("");
        LORB.View.line("\1wCurrent " + fieldLabel + ": \1c" + currentValue + "\1n");
        LORB.View.line("");
        
        var newValue = LORB.View.prompt("New " + fieldLabel + " (or blank to cancel): ");
        
        if (!newValue || newValue.trim() === "") {
            LORB.View.line("\1yNo change made.\1n");
            console.getkey(K_NOSPIN);
            return;
        }
        
        // Sanitize input - limit length and strip control codes
        newValue = newValue.trim().substring(0, 20);
        
        // Update the baby baller
        if (field === "name") {
            baby.name = newValue;
        } else {
            baby.nickname = newValue.toUpperCase();
        }
        
        LORB.View.line("");
        LORB.View.line("\1gChild " + fieldLabel.toLowerCase() + " updated to: \1h\1c" + newValue + "\1n");
        LORB.View.line("");
        LORB.View.line("\1wPress any key to continue...\1n");
        console.getkey(K_NOSPIN);
    }
    
    /**
     * Collect pending earnings from baby ballers
     * Shows report of what each baby earned from streetball matches against other players
     */
    function collectBabyEarnings(ctx) {
        var BB = LORB.Data && LORB.Data.BabyBallers;
        if (!BB || !BB.collectPendingEarnings) {
            showMessage("Error", "Baby earnings collection not available.");
            return;
        }
        
        var report = BB.collectPendingEarnings(ctx);
        
        if (report.collected.length === 0) {
            showMessage("No Earnings", "Your babies haven't earned anything yet.\n\nThey need to beat other players in streetball matches!");
            return;
        }
        
        // Show earnings report
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 3 },
                { name: "content", x: 1, y: 4, width: 80, height: 21 }
            ],
            theme: "lorb"
        });
        
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            headerFrame.putmsg("\1h\1g=== BABY BALLER EARNINGS ===\1n");
        }
        
        view.setContentZone("content");
        view.setCursorY(0);
        
        view.line("\1h\1wYour babies have been hustling on the courts!\1n");
        view.blank();
        
        var hLine = "\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4";
        view.line("\1h\1y" + hLine + "\1n");
        
        for (var i = 0; i < report.collected.length; i++) {
            var baby = report.collected[i];
            view.line("\1h\1c" + baby.name + "\1n \1w- Lifetime: " + baby.lifetimeWins + " wins, $" + baby.lifetimeWinnings + " earned\1n");
            view.blank();
            
            view.line("  Wins: \1h\1w" + baby.wins + "\1n");
            view.line("  Total Winnings: \1h\1y$" + baby.totalWinnings + "\1n / \1m" + baby.rep + " rep\1n");
            view.line("  Money Kept (baby): \1r-$" + baby.babyKept + "\1n");
            
            if (baby.toSupport > 0) {
                view.line("  Paid to Child Support: \1r-$" + baby.toSupport + "\1n");
                if (baby.remainingSupport > 0) {
                    view.line("  Remaining Balance: \1y$" + baby.remainingSupport + "\1n");
                } else {
                    view.line("  \1h\1gChild support PAID OFF!\1n");
                }
            } else if (baby.cash > 0) {
                view.line("  Your Cut: \1g+$" + baby.cash + "\1n");
            }
            
            view.blank();
            view.line("  \1h\1wNET: $" + baby.netCash + " / " + baby.netRep + " rep\1n");
            view.blank();
        }
        
        view.line("\1h\1y" + hLine + "\1n");
        view.line("\1h\1wTOTAL COLLECTED:\1n");
        
        if (report.totalCash > 0) {
            view.line("  \1gCash to you: \1h\1g+$" + report.totalCash + "\1n");
        }
        if (report.totalToSupport > 0) {
            view.line("  \1yReduced child support: \1h\1g-$" + report.totalToSupport + "\1n");
        }
        
        view.blank();
        view.line("\1h\1kPress any key to continue...\1n");
        view.render();
        console.getkey(K_NOSPIN);
        view.close();
        
        // Save context with updated cash and support balances
        if (LORB.Persist && LORB.Persist.save) {
            LORB.Persist.save(ctx);
        }
    }
    
    /**
     * View list of baby mamas
     */
    function viewBabyMamas(ctx) {
        var babyMamas = ctx.babyMamas || [];
        
        if (babyMamas.length === 0) {
            showMessage("No Baby Mamas", "You don't have any baby mamas.\nTry flirting at Club 23...");
            return;
        }
        
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 3 },
                { name: "content", x: 1, y: 4, width: 80, height: 21 }
            ],
            theme: "lorb"
        });
        
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            headerFrame.putmsg("\1h\1c=== YOUR BABY MAMAS ===\1n");
        }
        
        view.setContentZone("content");
        
        for (var i = 0; i < babyMamas.length; i++) {
            var mama = babyMamas[i];
            var balance = LORB.Data.BabyBallers ? LORB.Data.BabyBallers.calculateBabyMamaBalance(ctx, mama.id) : 0;
            var childCount = mama.childrenIds ? mama.childrenIds.length : 0;
            
            view.line("\1h\1y" + mama.name + "\1n");
            view.line("  \1wCity: \1c" + (mama.cityId || "Unknown") + "\1n");
            view.line("  \1wChildren: \1c" + childCount + "\1n");
            view.line("  \1wBalance Owed: \1y$" + balance + "\1n");
            view.line("  \1wRelationship: " + (mama.isNemesis ? "\1rNEMESIS\1n" : "\1c" + mama.relationship + "\1n"));
            view.blank();
        }
        
        view.line("\1wPress any key to continue...\1n");
        view.render();
        console.getkey(K_NOSPIN);
        view.close();
    }
    
    /**
     * Make child support payment menu
     */
    function makeChildSupportPayment(ctx) {
        var babies = ctx.babyBallers || [];
        
        // Filter to unpaid babies only (exclude abandoned/nemesis - they can't be paid)
        var unpaidBabies = [];
        debugLog("[PAYMENT-FILTER] Filtering " + babies.length + " babies for payment menu");
        for (var i = 0; i < babies.length; i++) {
            var baby = babies[i];
            debugLog("[PAYMENT-FILTER] Baby '" + baby.nickname + "': isPaidOff=" + baby.childSupport.isPaidOff + ", isAbandoned=" + baby.childSupport.isAbandoned + ", isNemesis=" + baby.isNemesis);
            if (!baby.childSupport.isPaidOff && 
                !baby.childSupport.isAbandoned && 
                !baby.isNemesis) {
                debugLog("[PAYMENT-FILTER]   -> INCLUDED in payment menu");
                unpaidBabies.push(baby);
            } else {
                debugLog("[PAYMENT-FILTER]   -> EXCLUDED from payment menu");
            }
        }
        debugLog("[PAYMENT-FILTER] Final: " + unpaidBabies.length + " payable babies");
        
        if (unpaidBabies.length === 0) {
            showMessage("No Debts", "All your children are independent!\nNo child support payments needed.");
            return;
        }
        
        while (true) {
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 3 },
                    { name: "list", x: 1, y: 4, width: 40, height: 21 },
                    { name: "detail", x: 41, y: 4, width: 40, height: 21 }
                ],
                theme: "lorb"
            });
            
            var headerFrame = view.getZone("header");
            if (headerFrame) {
                headerFrame.putmsg("\1h\1c=== MAKE PAYMENT ===\1n\r\n");
                headerFrame.putmsg("\1wYour Cash: \1y$" + (ctx.cash || 0) + "\1n");
            }
            
            view.setContentZone("list");
            var menuItems = [];
            for (var j = 0; j < unpaidBabies.length; j++) {
                var baby = unpaidBabies[j];
                menuItems.push({
                    text: "\1w" + baby.nickname + " \1r$" + baby.childSupport.balance + "\1n",
                    value: j,
                    hotkey: String(j + 1)
                });
            }
            menuItems.push({ text: "Back", value: "back", hotkey: "Q" });
            
            var choice = view.menu(menuItems, { y: 1 });
            view.close();
            
            if (choice === "back" || choice === null) {
                return;
            }
            
            // Selected a child - show payment options
            showPaymentOptions(ctx, unpaidBabies[choice]);
        }
    }
    
    /**
     * Show payment options for a specific child
     */
    function showPaymentOptions(ctx, baby) {
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 3 },
                { name: "content", x: 1, y: 4, width: 80, height: 21 }
            ],
            theme: "lorb"
        });
        
        var balance = baby.childSupport.balance;
        var lumpSum = LORB.Data.BabyBallers ? LORB.Data.BabyBallers.calculateLumpSumPrice(balance) : Math.floor(balance * 0.75);
        var cash = ctx.cash || 0;
        
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            headerFrame.putmsg("\1h\1cPayment for: " + baby.nickname + "\1n");
        }
        
        view.setContentZone("content");
            view.line("\1wBalance Owed: \1r$" + balance + "\1n");
            view.line("\1wLump Sum (25% off): \1g$" + lumpSum + "\1n");
            view.line("\1wYour Cash: \1y$" + cash + "\1n");
            
            // Deadline visibility
            var gameDay = LORB.Locations.Hub && LORB.Locations.Hub.getSharedGameDay ? LORB.Locations.Hub.getSharedGameDay() : 0;
            if (baby.childSupport.isAbandoned) {
                view.line("\1h\1kStatus: ABANDONED - payments closed until adoption\1n");
            } else if (baby.childSupport.isOverdue) {
                view.line("\1h\1rStatus: PAST DUE! (was due Day " + baby.childSupport.dueDate + ")\1n");
            } else if (LORB.Data.BabyBallers && LORB.Data.BabyBallers.getDeadlineStatus) {
                var dStatus = LORB.Data.BabyBallers.getDeadlineStatus(baby, gameDay);
                if (dStatus.status === "warning") {
                    view.line("\1h\1yDeadline: Day " + baby.childSupport.dueDate + " (" + dStatus.daysRemaining + " days)\1n");
                } else if (dStatus.status === "due_today") {
                    view.line("\1h\1rDeadline: TODAY (Day " + baby.childSupport.dueDate + ")\1n");
                } else if (dStatus.daysRemaining > 0) {
                    view.line("\1wDeadline: Day " + baby.childSupport.dueDate + " (" + dStatus.daysRemaining + " days)\1n");
                }
            }
        view.blank();
        
        var menuItems = [];
        
        // Lump sum option
        if (cash >= lumpSum) {
            menuItems.push({ text: "Pay Lump Sum (\1g$" + lumpSum + "\1n)", value: "lump", hotkey: "L" });
        } else {
            menuItems.push({ text: "\1w(Can't afford lump sum)\1n", value: null });
        }
        
        // Full balance option
        if (cash >= balance) {
            menuItems.push({ text: "Pay Full Balance (\1r$" + balance + "\1n)", value: "full", hotkey: "F" });
        }
        
        // Partial payment options
        var partials = [100, 500, 1000, 5000];
        for (var i = 0; i < partials.length; i++) {
            var amt = partials[i];
            if (amt < balance && cash >= amt) {
                menuItems.push({ text: "Pay $" + amt, value: amt, hotkey: String(i + 1) });
            }
        }
        
        menuItems.push({ text: "Back", value: "back", hotkey: "Q" });
        
        var choice = view.menu(menuItems, { y: 6 });
        view.close();
        
        if (choice === "back" || choice === null) {
            return;
        }
        
        // Process payment
        var paymentAmount = 0;
        var paymentType = "";
        
        if (choice === "lump") {
            paymentAmount = lumpSum;
            paymentType = "lump sum";
            // Pay off entire balance with lump sum
            if (LORB.Data.BabyBallers && LORB.Data.BabyBallers.payLumpSum) {
                LORB.Data.BabyBallers.payLumpSum(ctx, baby.id);
            } else {
                ctx.cash -= lumpSum;
                baby.childSupport.balance = 0;
                baby.childSupport.isPaidOff = true;
            }
        } else if (choice === "full") {
            paymentAmount = balance;
            paymentType = "full balance";
            if (LORB.Data.BabyBallers && LORB.Data.BabyBallers.makePayment) {
                LORB.Data.BabyBallers.makePayment(ctx, baby.id, balance);
            } else {
                ctx.cash -= balance;
                baby.childSupport.balance = 0;
                baby.childSupport.isPaidOff = true;
            }
        } else {
            paymentAmount = choice;
            paymentType = "partial";
            if (LORB.Data.BabyBallers && LORB.Data.BabyBallers.makePayment) {
                LORB.Data.BabyBallers.makePayment(ctx, baby.id, choice);
            } else {
                ctx.cash -= choice;
                baby.childSupport.balance -= choice;
            }
        }
        
        // Show confirmation
        showMessage("Payment Made", 
            "Paid \1g$" + paymentAmount + "\1n toward " + baby.nickname + "'s support.\n\n" +
            (baby.childSupport.isPaidOff 
                ? "\1h\1g★ " + baby.nickname + " is now INDEPENDENT! ★\1n"
                : "Remaining balance: \1y$" + baby.childSupport.balance + "\1n"));
        
        // Relationship bonus for payment
        if (LORB.Data.BabyBallers && LORB.Data.BabyBallers.adjustRelationship) {
            var bonus = paymentType === "lump" ? 10 : (paymentType === "full" ? 5 : 2);
            LORB.Data.BabyBallers.adjustRelationship(baby, bonus, "child support payment");
        }
        
        // Save context
        if (LORB.Persist && LORB.Persist.save) {
            LORB.Persist.save(ctx);
        }
    }
    
    /**
     * Simple message display helper
     */
    function showMessage(title, message) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header(title);
            LORB.View.line("");
            LORB.View.line(message);
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var view = new RichView({
            zones: [
                { name: "content", x: 1, y: 1, width: 80, height: 24 }
            ],
            theme: "lorb"
        });
        
        view.setContentZone("content");
        view.line("\1h\1c" + title + "\1n");
        view.blank();
        
        var lines = message.split("\n");
        for (var i = 0; i < lines.length; i++) {
            view.line(lines[i]);
        }
        
        view.blank();
        view.line("\1wPress any key to continue...\1n");
        view.render();
        console.getkey(K_NOSPIN);
        view.close();
    }
    
    /**
     * Legacy (non-RichView) baby mamas menu
     */
    function runBabyMamasLegacy(ctx) {
        LORB.View.clear();
        LORB.View.header("BABY MAMAS & KIDS");
        LORB.View.line("");
        
        var babies = ctx.babyBallers || [];
        
        if (babies.length === 0) {
            LORB.View.line("You don't have any kids yet.");
            LORB.View.line("Try flirting at Club 23...");
        } else {
            // Calculate totals (exclude abandoned children)
            var totalOwed = 0;
            debugLog("[CRIB-LEGACY] Calculating legacy view for " + babies.length + " babies");
            for (var i = 0; i < babies.length; i++) {
                var baby = babies[i];
                debugLog("[CRIB-LEGACY] Baby '" + baby.nickname + "': isAbandoned=" + (baby.childSupport && baby.childSupport.isAbandoned) + ", isPaidOff=" + (baby.childSupport && baby.childSupport.isPaidOff) + ", isNemesis=" + baby.isNemesis + ", balance=" + (baby.childSupport ? baby.childSupport.balance : "N/A"));
                if (baby.childSupport && !baby.childSupport.isAbandoned && !baby.isNemesis && !baby.childSupport.isPaidOff) {
                    debugLog("[CRIB-LEGACY]   -> Adding: $" + baby.childSupport.balance);
                    totalOwed += baby.childSupport.balance;
                } else {
                    debugLog("[CRIB-LEGACY]   -> Skipping");
                }
            }
            debugLog("[CRIB-LEGACY] Final totalOwed: $" + totalOwed);
            
            LORB.View.line("Total Children: " + babies.length);
            LORB.View.line("Total Support Owed: $" + totalOwed);
            LORB.View.line("");
            
            for (var j = 0; j < babies.length; j++) {
                var baby = babies[j];
                var status = baby.childSupport.isPaidOff ? "[IND]" : "[$" + baby.childSupport.balance + "]";
                LORB.View.line((j + 1) + ". " + baby.nickname + " " + status);
            }
        }
        
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey(K_NOSPIN);
    }
    
    // =========================================================================
    // TRAVELING COMPANION - Fly partner to your city
    // =========================================================================
    
    /**
     * Traveling Companion menu - invite a partner to travel with you
     * Companions enable twins/triplets and date activities in your city
     */
    function runTravelingCompanion(ctx) {
        var Companion = LORB.Data && LORB.Data.Companion;
        if (!Companion) {
            // Module not loaded - show error
            if (RichView) {
                var errView = new RichView({
                    zones: [{ name: "content", x: 1, y: 1, width: 80, height: 24 }],
                    theme: "lorb"
                });
                errView.setContentZone("content");
                errView.line("\1r\1hERROR: Companion system not available.\1n");
                errView.render();
                waitForEnter();
                errView.close();
            } else {
                LORB.View.clear();
                LORB.View.line("ERROR: Companion system not available.");
                console.getkey(K_NOSPIN);
            }
            return;
        }
        
        if (!RichView) {
            runTravelingCompanionLegacy(ctx);
            return;
        }
        
        while (true) {
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 4 },
                    { name: "content", x: 1, y: 5, width: 80, height: 18 }
                ],
                theme: "lorb"
            });
            
            var headerFrame = view.getZone("header");
            if (headerFrame) {
                headerFrame.putmsg("\1h\1m=== TRAVELING COMPANION ===\1n\r\n");
                headerFrame.putmsg("\1wFly a special someone to your city\1n");
            }
            
            var companion = Companion.getCurrentCompanion(ctx);
            var relationships = ctx.relationships || [];
            
            view.setContentZone("content");
            
            // Show current companion status
            view.line("\1h\1yCompanion Status\1n");
            view.line("");
            
            if (companion) {
                view.line("\1wCurrently with you: \1c" + companion.name + "\1n");
                view.line("\1wFrom: \1y" + companion.city + "\1n");
                view.line("\1wAffection: \1m" + companion.affection + "%\1n");
                view.line("");
                view.line("\1gWhile your companion is with you:\1n");
                view.line("  \1w- Take them on dates at Club 23\1n");
                view.line("  \1w- Chance for twins/triplets!\1n");
            } else {
                view.line("\1wNo companion traveling with you.\1n");
                view.line("");
                view.line("\1gInvite someone to your city!\1n");
                view.line("  \1w- Pay for their flight\1n");
                view.line("  \1w- Date them locally\1n");
                view.line("  \1w- Higher chance of multiples\1n");
            }
            
            view.blank();
            view.line("\1wYour Cash: \1y$" + (ctx.cash || 0) + "\1n");
            view.blank();
            
            // Build menu
            var menuItems = [];
            
            if (companion) {
                // Already have companion - can only clear
                menuItems.push({ text: "Send " + companion.name + " Home", value: "clear", hotkey: "1" });
            } else {
                // Can invite eligible partners
                var eligible = Companion.getEligibleCompanions(ctx);
                if (eligible.length > 0) {
                    menuItems.push({ text: "Invite Someone (" + eligible.length + " eligible)", value: "invite", hotkey: "1" });
                } else {
                    menuItems.push({ text: "(No eligible partners)", value: "none", disabled: true });
                }
            }
            
            menuItems.push({ text: "Back", value: "back", hotkey: "0" });
            
            view.render();
            var choice = view.menu(menuItems);
            view.close();
            
            if (!choice || choice === "back") {
                return;
            }
            
            if (choice === "clear") {
                Companion.clearCompanion(ctx);
                showCompanionMessage(companion.name + " has been sent home.", "info");
            } else if (choice === "invite") {
                runInviteCompanion(ctx);
            }
        }
    }
    
    /**
     * Show list of eligible companions to invite
     */
    function runInviteCompanion(ctx) {
        var Companion = LORB.Data.Companion;
        var eligible = Companion.getEligibleCompanions(ctx);
        
        if (eligible.length === 0) {
            showCompanionMessage("No eligible partners to invite!", "error");
            return;
        }
        
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 3 },
                { name: "content", x: 1, y: 4, width: 80, height: 19 }
            ],
            theme: "lorb"
        });
        
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            headerFrame.putmsg("\1h\1m=== INVITE COMPANION ===\1n\r\n");
            headerFrame.putmsg("\1wChoose who to fly to your city\1n");
        }
        
        view.setContentZone("content");
        view.line("\1wYour Cash: \1y$" + (ctx.cash || 0) + "\1n");
        view.blank();
        view.line("\1h\1yEligible Partners:\1n");
        view.blank();
        
        // Build menu of eligible partners with flight costs
        var menuItems = [];
        for (var i = 0; i < eligible.length && i < 8; i++) {
            var partner = eligible[i];
            var flightCost = Companion.calculateFlightCost(ctx, partner);
            var canAfford = (ctx.cash || 0) >= flightCost;
            var costColor = canAfford ? "\1g" : "\1r";
            
            menuItems.push({
                text: partner.name + " (" + partner.city + ") - " + costColor + "$" + flightCost + "\1n",
                value: "partner_" + i,
                hotkey: String(i + 1),
                disabled: !canAfford
            });
        }
        menuItems.push({ text: "Cancel", value: "cancel", hotkey: "0" });
        
        view.render();
        var choice = view.menu(menuItems);
        view.close();
        
        if (!choice || choice === "cancel") {
            return;
        }
        
        // Parse selection
        if (choice.indexOf("partner_") === 0) {
            var index = parseInt(choice.replace("partner_", ""), 10);
            var selected = eligible[index];
            if (selected) {
                // Get gameDay for flight purchase
                var gameDay = 1;
                if (LORB.SharedState && LORB.SharedState.getGameDay) {
                    gameDay = LORB.SharedState.getGameDay();
                }
                
                // purchaseFlightTicket expects: (ctx, npcId, npcName, relationship, gameDay)
                // The 'selected' object from getEligibleCompanions has all relationship data
                var result = Companion.purchaseFlightTicket(ctx, selected.npcId, selected.npcName, selected, gameDay);
                
                if (result.success) {
                    showCompanionMessage(selected.name + " is flying to your city!\nYou paid $" + result.cost + " for their flight.", "success");
                } else {
                    showCompanionMessage(result.message || "Failed to purchase flight.", "error");
                }
            }
        }
    }
    
    /**
     * Show a companion-related message
     */
    function showCompanionMessage(message, type) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.line(message);
            console.getkey(K_NOSPIN);
            return;
        }
        
        var view = new RichView({
            zones: [{ name: "content", x: 1, y: 1, width: 80, height: 24 }],
            theme: "lorb"
        });
        
        view.setContentZone("content");
        
        var color = "\1w";
        if (type === "success") color = "\1g";
        else if (type === "error") color = "\1r";
        else if (type === "info") color = "\1c";
        
        view.blank();
        view.blank();
        var lines = message.split("\n");
        for (var i = 0; i < lines.length; i++) {
            view.line(color + "\1h" + lines[i] + "\1n");
        }
        view.blank();
        view.line("\1w[Press any key]\1n");
        
        view.render();
        console.getkey(K_NOSPIN);
        view.close();
    }
    
    /**
     * Legacy (non-RichView) traveling companion menu
     */
    function runTravelingCompanionLegacy(ctx) {
        var Companion = LORB.Data.Companion;
        
        LORB.View.clear();
        LORB.View.header("TRAVELING COMPANION");
        LORB.View.line("");
        
        var companion = Companion.getCurrentCompanion(ctx);
        
        if (companion) {
            LORB.View.line("Currently with you: " + companion.name);
            LORB.View.line("From: " + companion.city);
            LORB.View.line("Affection: " + companion.affection + "%");
            LORB.View.line("");
            LORB.View.line("1. Send " + companion.name + " Home");
            LORB.View.line("0. Back");
            LORB.View.line("");
            LORB.View.line("Choice: ");
            
            var key = console.getkey(K_NOSPIN);
            if (key === "1") {
                Companion.clearCompanion(ctx);
                LORB.View.line("");
                LORB.View.line(companion.name + " has been sent home.");
                console.getkey(K_NOSPIN);
            }
        } else {
            var eligible = Companion.getEligibleCompanions(ctx);
            
            if (eligible.length === 0) {
                LORB.View.line("No eligible partners to invite.");
                LORB.View.line("Build relationships with 20%+ affection first!");
                LORB.View.line("");
                LORB.View.line("Press any key...");
                console.getkey(K_NOSPIN);
                return;
            }
            
            LORB.View.line("Your Cash: $" + (ctx.cash || 0));
            LORB.View.line("");
            LORB.View.line("Invite someone to your city:");
            LORB.View.line("");
            
            for (var i = 0; i < eligible.length && i < 8; i++) {
                var partner = eligible[i];
                var cost = Companion.calculateFlightCost(ctx, partner);
                LORB.View.line((i + 1) + ". " + partner.name + " (" + partner.city + ") - $" + cost);
            }
            
            LORB.View.line("0. Back");
            LORB.View.line("");
            LORB.View.line("Choice: ");
            
            var choice = console.getkey(K_NOSPIN);
            if (choice === "0") return;
            
            var idx = parseInt(choice, 10) - 1;
            if (idx >= 0 && idx < eligible.length) {
                var selected = eligible[idx];
                
                // Get gameDay for flight purchase
                var gameDay = 1;
                if (LORB.SharedState && LORB.SharedState.getGameDay) {
                    gameDay = LORB.SharedState.getGameDay();
                }
                
                // purchaseFlightTicket expects: (ctx, npcId, npcName, relationship, gameDay)
                var result = Companion.purchaseFlightTicket(ctx, selected.npcId, selected.npcName, selected, gameDay);
                
                LORB.View.line("");
                if (result.success) {
                    LORB.View.line(selected.name + " is flying to your city!");
                } else {
                    LORB.View.line(result.message || "Failed to purchase flight.");
                }
                console.getkey(K_NOSPIN);
            }
        }
    }
    
    // =========================================================================
    // MAIN ENTRY / MENU
    // =========================================================================
    
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
        // Lazy-load sprite modules (once per crib visit)
        var SpriteWanderer = getSpriteWanderer();
        var SpriteSelectors = getSpriteSelectors();
        
        while (true) {
            // Wanderer must be created fresh each iteration since view/artFrame is recreated
            var wanderer = null;
            
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 4 },
                    { name: "art", x: 1, y: 5, width: 40, height: 20 },
                    { name: "content", x: 41, y: 5, width: 40, height: 20 }
                ],
                theme: "lorb"
            });
            
            loadArtWithBinLoader(view);
            
            // Initialize wandering sprites after loading art
            if (SpriteWanderer) {
                try {
                    var artFrame = view.getZone("art");
                    if (artFrame) {
                        var cribSprites;
                        
                        if (SpriteSelectors && SpriteSelectors.getCribSprites) {
                            // Use smart selection: player, teammate, crew
                            cribSprites = SpriteSelectors.getCribSprites(ctx);
                            SpriteSelectors.applyPositions(cribSprites, CRIB_WALKABLE_ZONE);
                        } else {
                            // Fallback: just the player sprite
                            cribSprites = [{
                                skin: (ctx.appearance && ctx.appearance.skin) || "brown",
                                x: CRIB_WALKABLE_ZONE.x + 10,
                                y: CRIB_WALKABLE_ZONE.y + 2,  // Feet at zone.y+2 (middle of zone)
                                bearing: "s"
                            }];
                        }
                        
                        if (cribSprites.length > 0) {
                            wanderer = new SpriteWanderer({
                                parentFrame: artFrame,
                                sprites: cribSprites,
                                walkableZones: CRIB_WALKABLE_ZONES,
                                options: {
                                    speed: 400,        // Move every 400ms
                                    pauseChance: 0.40, // 40% chance to idle
                                    showNametags: true // Show nametags for known characters
                                }
                            });
                            wanderer.start();
                            view.render();
                        }
                    }
                } catch (e) {
                    // Wanderer is optional - continue without it
                    wanderer = null;
                }
            }
            
            // Draw LIGHTCYAN border on content zone - returns inner contentFrame
            var contentFrame = view.drawBorder("content", {
                color: LIGHTCYAN,
                title: "THE CRIB",
                padding: 0
            });
            
            // Write content directly to inner frame using gotoxy/putmsg
            var cy = 1;
            cy++;  // blank line
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1h\1cYOUR CRIB\1n");
            cy++;  // blank line
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("Home sweet home.");
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("Manage your crew and check stats.");
            cy++;  // blank line
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1wCrew: \1c" + ctx.crew.length + "/" + MAX_CREW_SIZE + "\1n");
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1wContacts: \1c" + ctx.contacts.length + "\1n");
            // blank line before menu
            cy++;
            
            // onIdle callback to animate wandering sprites
            var onIdleCallback = function(richView, lightbar) {
                if (wanderer && wanderer.isRunning()) {
                    wanderer.update();
                    wanderer.cycle();
                    richView.render();
                }
            };
            
            var menuItems = [
                { text: "\1wBallerdex", value: "contacts", hotkey: "1" },
                { text: "\1wYour Crew", value: "crew", hotkey: "2" },
                { text: "\1wStats & Records", value: "stats", hotkey: "3" },
                { text: "\1wBaby Mamas & Kids", value: "babies", hotkey: "4" },
                { text: "\1wBack to Hub", value: "back", hotkey: "Q" }
            ];
            
            // Add admin menu for authorized admins only
            if (LORB.Admin && LORB.Admin.isAdmin && LORB.Admin.isAdmin(ctx)) {
                menuItems.push({ text: "\1h\1rAdmin Tools\1n", value: "admin", hotkey: "A" });
            }
            
            // Add boss test menu if debug flag is enabled - uses full rich presentation
            if (LORB.Config.DEBUG_ENABLE_BOSS_TEST) {
                menuItems.splice(4, 0, { text: "\1h\1rChampion's Challenge\1n", value: "boss_test", hotkey: "B" });
            }
            
            // Menu y is relative to inner frame (border uses 1 row top/bottom)
            var choice = view.menu(menuItems, { y: 9, onIdle: onIdleCallback });
            
            // Stop wanderer before navigating away
            if (wanderer) wanderer.stop();
            view.close();
            
            switch (choice) {
                case "contacts":
                    runContacts(ctx);
                    break;
                case "crew":
                    runCrew(ctx);
                    break;
                case "stats":
                    if (LORB.UI && LORB.UI.StatsView) {
                        LORB.UI.StatsView.show(ctx);
                    }
                    break;
                case "babies":
                    runBabyMamasAndKids(ctx);
                    break;
                case "boss_test":
                    // Use the full rich presentation flow from PlayoffView
                    runChampionChallengeFromCrib(ctx);
                    break;
                case "admin":
                    if (LORB.Admin && LORB.Admin.showAdminMenu) {
                        var adminResult = LORB.Admin.showAdminMenu(ctx);
                        if (adminResult === "reset") {
                            return "reset";
                        }
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
     * Ballerdex view - NBA players you've defeated
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
                console.getkey(K_NOSPIN);
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
            console.getkey(K_NOSPIN);
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
            console.getkey(K_NOSPIN);
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
            console.getkey(K_NOSPIN);
            return false;
        }
        
        if (isOnCrew(ctx, contact.id)) {
            LORB.View.line("");
            LORB.View.warn(contact.name + " is already on your crew!");
            console.getkey(K_NOSPIN);
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
                console.getkey(K_NOSPIN);
                return false;
            }
        }
        
        // IMPORTANT: Update the actual contact in ctx.contacts, not just the hydrated copy
        // Find the contact in ctx.contacts by ID and update it
        for (var cidx = 0; cidx < ctx.contacts.length; cidx++) {
            if (ctx.contacts[cidx].id === contact.id) {
                ctx.contacts[cidx].status = status || "temp";
                break;
            }
        }
        contact.status = status || "temp";  // Also update local copy for display
        ctx.crew.push({ contactId: contact.id, slot: ctx.crew.length });
        
        LORB.View.line("");
        LORB.View.line("\1g" + contact.name + " joins your crew!\1n");
        if (status === "temp") {
            LORB.View.line("\1y(They'll take " + contact.cutPercent + "% of your winnings)\1n");
        }
        console.getkey(K_NOSPIN);
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
            console.getkey(K_NOSPIN);
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
                    console.getkey(K_NOSPIN);
                    return false;
                }
            }
        }
        
        ctx.cash -= contact.signCost;
        
        // IMPORTANT: Update the actual contact in ctx.contacts, not just the hydrated copy
        if (typeof contactIndex === "number" && ctx.contacts[contactIndex]) {
            ctx.contacts[contactIndex].status = "signed";
        }
        contact.status = "signed";  // Also update local copy for display
        
        // Add to crew if not already there
        if (!isOnCrew(ctx, contact.id)) {
            if (ctx.crew.length < MAX_CREW_SIZE) {
                ctx.crew.push({ contactId: contact.id, slot: ctx.crew.length });
            }
        }
        
        LORB.View.line("");
        LORB.View.line("\1g" + contact.name + " signed! (-$" + contact.signCost + ")\1n");
        LORB.View.line("No more cuts - they're permanent crew now!");
        console.getkey(K_NOSPIN);
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
                console.getkey(K_NOSPIN);
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
                console.getkey(K_NOSPIN);
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
        
        var choice = console.getkey(K_NOSPIN).toUpperCase();
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
                console.getkey(K_NOSPIN);
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
        console.getkey(K_NOSPIN);
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
        console.getkey(K_NOSPIN);
    }
    
    // Export
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Crib = {
        run: run,
        runAppearance: runAppearance,  // Exposed for Mall location
        MAX_CREW_SIZE: MAX_CREW_SIZE,
        getContactById: getContactById,
        isOnCrew: isOnCrew
    };
    
})();
