/**
 * doctor.js - Doctor Visit Location for LORB
 * 
 * Handles Phase 2 of the pregnancy system: the discovery/ultrasound scene.
 * Features:
 * - Initial reveal with varied ailments (not directly saying "pregnant")
 * - Doc Vitale character with Dick Vitale catchphrases
 * - Baby sprite preview (dynamic player sprite)
 * - Timed narrative delivery with suspense
 * - Name THEN decide support (not reverse)
 */

var _doctorRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _doctorRichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[DOCTOR] Failed to load RichView: " + e);
}

// Load BinLoader for .bin art files
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
        log(LOG_WARNING, "[DOCTOR] Failed to load bin-loader.js: " + e);
    }
}

// Ensure sprite system is loaded
if (typeof ensureSpriteSystem === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/core/sprite-init.js");
    } catch (e) {
        log(LOG_WARNING, "[DOCTOR] Failed to load sprite-init.js: " + e);
    }
}

(function() {
    // NOTE: Do not use "use strict" - Synchronet color codes use octal-like \1 escapes
    
    var RichView = _doctorRichView;
    
    // Art paths
    var ART_DOC_VITALE = "/sbbs/xtrn/nba_jam/assets/lorb/doc_vitale.bin";
    var ART_WIDTH = 40;
    var ART_HEIGHT = 20;
    
    // Sprite constants
    var SPRITES_DIR = "/sbbs/xtrn/nba_jam/sprites/";
    var SPRITE_WIDTH = 5;
    var SPRITE_HEIGHT = 4;
    
    // ========== AILMENT VARIETY ==========
    
    var AILMENTS = [
        {
            complaint: "feeling really tired lately",
            detail: "Can't keep food down in the mornings..."
        },
        {
            complaint: "been getting dizzy spells",
            detail: "And these weird cravings at 3am..."
        },
        {
            complaint: "not feeling like herself",
            detail: "Says her body feels... different."
        },
        {
            complaint: "feeling nauseous all the time",
            detail: "Especially in the morning. Every morning."
        },
        {
            complaint: "having mood swings",
            detail: "And she's been crying at commercials..."
        }
    ];
    
    // ========== DOC VITALE CATCHPHRASES ==========
    
    var DOC_VITALE_INTRO = [
        "\1h\1c\"Alright baby, let's see what we got here!\"\1n",
        "\1h\1c\"This is awesome baby, AWESOME WITH A CAPITAL A!\"\1n",
        "\1h\1c\"Let me tell you something, this is special!\"\1n",
        "\1h\1c\"Oh baby! We got a DIAPER DANDY in the making!\"\1n"
    ];
    
    var DOC_VITALE_SCAN = [
        "\1w\"Let's fire up the ultrasound baby!\"\1n",
        "\1w\"Ohhhhh baby, look at that!\"\1n",
        "\1w\"This is UNBELIEVABLE!\"\1n",
        "\1w\"You see that right there? That's a future superstar!\"\1n"
    ];
    
    var DOC_VITALE_STATS = [
        "\1w\"These are PTP'er numbers baby! Prime Time Player!\"\1n",
        "\1w\"Look at those genetics! SPECTACULAR!\"\1n",
        "\1w\"This kid's got IT baby, the whole package!\"\1n",
        "\1w\"You're looking at a future DIAPER DANDY right there!\"\1n"
    ];
    
    var DOC_VITALE_TWINS = [
        "\1w\"Wait a minute... WAIT A MINUTE!\"\1n",
        "\1w\"OH BABY! IT'S A DOUBLE DIAPER DANDY!\"\1n",
        "\1w\"TWO! Count 'em, TWO Diaper Dandies coming your way!\"\1n",
        "\1w\"This is UNBELIEVABLE! A twofer! AWESOME BABY!\"\1n"
    ];
    
    var DOC_VITALE_TRIPLETS = [
        "\1w\"Hold on... hold on... HOLD THE PHONE!\"\1n",
        "\1w\"OH MY GOODNESS! THREE! THREE HEARTBEATS!\"\1n",
        "\1w\"TRIPLETS BABY! THIS IS MADNESS! MARCH MADNESS!\"\1n",
        "\1w\"I've never seen anything like this! THREE DIAPER DANDIES!\"\1n"
    ];
    
    var DOC_VITALE_BIRTH = [
        "\1w\"IT'S TIME BABY! THE MOMENT OF TRUTH!\"\1n",
        "\1w\"This is what it's all about baby!\"\1n",
        "\1w\"GET YOUR DIAPERS READY!\"\1n"
    ];
    
    // ========== UTILITY FUNCTIONS ==========
    
    /**
     * Get config value with fallback
     */
    function getConfig(key, fallback) {
        if (LORB.Config && LORB.Config.BABY_BALLERS && typeof LORB.Config.BABY_BALLERS[key] !== "undefined") {
            return LORB.Config.BABY_BALLERS[key];
        }
        return fallback;
    }
    
    /**
     * Replace {var} placeholder in text
     */
    function formatText(text, vars) {
        if (!text) return "";
        for (var key in vars) {
            if (vars.hasOwnProperty(key)) {
                text = text.replace(new RegExp("\\{" + key + "\\}", "g"), vars[key]);
            }
        }
        return text;
    }
    
    /**
     * Pick random from array
     */
    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
    
    /**
     * Display narrative lines with timed pacing
     */
    function showNarrative(view, lines, vars, pauseMs) {
        pauseMs = pauseMs || 800;
        
        for (var i = 0; i < lines.length; i++) {
            var line = formatText(lines[i], vars);
            if (line === "") {
                view.blank();
            } else {
                view.line(line);
            }
            view.render();
            mswait(pauseMs);
        }
    }
    
    /**
     * Pad string to the right
     */
    function padRight(str, len) {
        str = String(str || "");
        while (str.length < len) str += " ";
        return str;
    }
    
    /**
     * Read/write cash helper (ctx historically used money; unify on cash)
     */
    function getCash(ctx) {
        if (typeof ctx.cash === "number") return ctx.cash;
        if (typeof ctx.money === "number") return ctx.money;
        return 0;
    }
    
    function setCash(ctx, amount) {
        ctx.cash = amount;
        // Keep legacy field in sync if it exists
        ctx.money = amount;
    }
    
    /**
     * Get word for baby count
     */
    function getCountWord(count) {
        if (count === 2) return "TWINS";
        if (count === 3) return "TRIPLETS";
        return "";
    }
    
    // ========== BABY SPRITE PREVIEW ==========
    
    /**
     * Draw a dynamic baby sprite preview (5x4 player sprite)
     * Based on appearance system from crib
     */
    function drawBabySpritePreview(view, appearance) {
        if (!ensureSpriteSystem || !ensureSpriteSystem()) return false;
        
        var artFrame = view.getZone("art");
        if (!artFrame) return false;
        
        try {
            var skin = appearance.skin || "brown";
            var spriteBase = "player-" + skin;
            var jersey = appearance.jerseyColor || "WHITE";
            var jerseyNum = appearance.jerseyNumber || 0;
            
            // Calculate positioning (center the 5x4 sprite in the 40x20 art zone)
            var spriteX = 18;  // Center horizontally: (40 - 5) / 2 ≈ 18
            var spriteY = 8;   // Position vertically: middle-ish
            
            // Create sprite container
            var containerFrame = new Frame(spriteX, spriteY, SPRITE_WIDTH, SPRITE_HEIGHT, BG_BLACK, artFrame);
            containerFrame.open();
            
            // Create sprite
            var oldExecDir = js.exec_dir;
            js.exec_dir = "/sbbs/xtrn/nba_jam/";
            
            var sprite = new Sprite.Aerial(
                spriteBase,
                containerFrame,
                0,
                0,
                "s",
                "normal"
            );
            
            js.exec_dir = oldExecDir;
            
            // Apply jersey if available
            if (typeof applyUniformMask === "function") {
                var jerseyBg = BG_BLUE;  // Default
                var accentFg = WHITE;
                
                // Try to match jersey color string to BG constant
                if (jersey && typeof window !== "undefined") {
                    var bgConst = window["BG_" + jersey.toUpperCase()];
                    if (typeof bgConst === "number") {
                        jerseyBg = bgConst;
                    }
                }
                
                var jerseyConfig = {
                    jerseyBg: jerseyBg,
                    accentFg: accentFg,
                    jerseyNumber: String(jerseyNum)
                };
                
                applyUniformMask(sprite, jerseyConfig);
            }
            
            if (typeof scrubSpriteTransparency === "function") {
                scrubSpriteTransparency(sprite);
            }
            
            // Blit sprite into container
            if (sprite.frame) {
                for (var sy = 0; sy < SPRITE_HEIGHT; sy++) {
                    for (var sx = 0; sx < SPRITE_WIDTH; sx++) {
                        var cell = sprite.frame.getData(sx, sy, false);
                        if (!cell) continue;
                        var ch = cell.ch;
                        var attr = cell.attr;
                        if (!ch || ch === '\0') ch = ' ';
                        if (attr === undefined || attr === null) attr = BG_BLACK;
                        // Frame coordinates are 1-based; offset sprite cells accordingly
                        containerFrame.gotoxy(sx + 1, sy + 1);
                        containerFrame.putmsg(ch, attr);
                    }
                }
                sprite.frame.close();
            }
            
            view._spriteContainer = containerFrame;
            
            // Draw baby info below sprite
            artFrame.gotoxy(12, spriteY + SPRITE_HEIGHT + 2);
            artFrame.putmsg("\1h\1c★ BABY PREVIEW ★\1n");
            artFrame.gotoxy(14, spriteY + SPRITE_HEIGHT + 4);
            artFrame.putmsg("\1wSkin: \1c" + skin + "\1n");
            artFrame.gotoxy(13, spriteY + SPRITE_HEIGHT + 5);
            artFrame.putmsg("\1wJersey: \1c#" + jerseyNum + " " + jersey + "\1n");
            
            return true;
        } catch (e) {
            log(LOG_WARNING, "[DOCTOR] Failed to create baby sprite: " + e);
            return false;
        }
    }
    
    /**
     * Clean up sprite resources
     */
    function cleanupSprite(view) {
        if (view._spriteContainer) {
            try {
                view._spriteContainer.close();
            } catch (e) {}
            view._spriteContainer = null;
        }
    }
    
    // ========== STAT/COST PREVIEW ==========
    
    /**
     * Draw stat bars with ANSI blocks (not unicode)
     */
    function drawStatsPreview(view, projection) {
        var contentFrame = view.getZone("content");
        if (!contentFrame) return;
        
        contentFrame.gotoxy(1, 1);
        contentFrame.putmsg("\1h\1y=== BABY SCANS ===\1n\r\n");
        
        var STAT_NAMES = ["speed", "shooting", "dunking", "power", "stealing", "blocking"];
        var STAT_DISPLAY = {
            speed: "SPD",
            shooting: "3PT",
            dunking: "DNK",
            power: "PWR",
            stealing: "STL",
            blocking: "BLK"
        };
        
        for (var i = 0; i < STAT_NAMES.length; i++) {
            var statKey = STAT_NAMES[i];
            var statVal = projection.stats[statKey] || 0;
            var label = STAT_DISPLAY[statKey] || statKey.substr(0, 4).toUpperCase();
            
            // Build bar with █ filled, · empty
            var bar = "";
            for (var j = 0; j < statVal; j++) bar += "\xFE";  // Solid block
            for (var k = statVal; k < 10; k++) bar += "\xFA";  // Middle dot
            
            // Color code: red low, yellow mid, green high
            var statColor = "\1w";
            if (statVal <= 3) statColor = "\1h\1r";
            else if (statVal <= 5) statColor = "\1h\1y";
            else if (statVal <= 7) statColor = "\1h\1g";
            else statColor = "\1h\1w";
            
            contentFrame.putmsg("  \1w" + padRight(label, 4) + " " + statColor + bar + "\1n \1c" + statVal + "\1n\r\n");
        }
        
        // Monogamy bonus indicator
        if (projection.monogamyBonus) {
            contentFrame.putmsg("\r\n\1h\1g  \xFE MONOGAMY BONUS! All stats +1\1n\r\n");
        }
    }
    
    /**
     * Draw payment cost breakdown
     */
    function drawCostBreakdown(view, projection, ctx) {
        var contentFrame = view.getZone("content");
        if (!contentFrame) return;
        
        contentFrame.gotoxy(1, 12);
        contentFrame.putmsg("\1h\1c=== CHILD SUPPORT ===\1n\r\n");
        contentFrame.putmsg("\1w  Base Cost:\1n \1w$" + projection.baseCost + "\1n\r\n");
        contentFrame.putmsg("\1w  Baby Count:\1n \1wx" + projection.count + "\1n\r\n");
        
        if (projection.wedlockDiscount > 0) {
            contentFrame.putmsg("\1g  \xFE Wedlock:\1n -$" + projection.wedlockDiscount + "\r\n");
        }
        
        contentFrame.putmsg("\r\n\1h\1y  TOTAL:\1n \1w$" + projection.totalCost + "\1n\r\n");
    }
    
    // ========== BABY CREATION ==========
    
    /**
     * Create baby baller records from pregnancy
     */
    function createBabies(ctx, pregnancy, babyNames, opts) {
        opts = opts || {};
        var created = [];
        var count = pregnancy.count || 1;
        var stats = pregnancy.projectedStats || {};
        var appearance = pregnancy.projectedAppearance || {};
        
        for (var i = 0; i < count; i++) {
            var nameData = babyNames[i] || { name: null, nickname: null };
            
            // createBabyBaller expects customName.name (full name) and customName.nickname
            var customName = null;
            if (nameData.name || nameData.nickname) {
                customName = {
                    name: nameData.name,
                    nickname: nameData.nickname
                };
            }
            
            var baby = LORB.Data.BabyBallers.createBabyBaller(
                ctx,
                pregnancy.npcId || pregnancy.npcName,
                pregnancy.npcName || pregnancy.partnerName || "Partner",
                pregnancy.monogamyBonus || false,
                stats,
                appearance,
                customName
            );
            
            if (opts.abandoned) {
                baby.childSupport.isAbandoned = true;
                baby.childSupport.isOverdue = true;
                baby.relationship = getConfig("ADOPTION_THRESHOLD", -75);
                baby.isNemesis = true;
                baby.parentingMode = "abandon";
            }
            
            // Add baby to context
            LORB.Data.BabyBallers.addBabyToContext(ctx, baby);
            
            // Ensure baby mama tracking
            LORB.Data.BabyBallers.ensureBabyMama(
                ctx,
                pregnancy.npcId || pregnancy.npcName,
                pregnancy.npcName || pregnancy.partnerName || "Partner",
                pregnancy.cityId,
                baby.id
            );
            
            // Add birth news entry
            if (LORB.Data.BabyBallers.addBirthNews) {
                LORB.Data.BabyBallers.addBirthNews(baby, ctx, opts.abandoned ? "abandoned" : "born", null);
            }
            
            created.push(baby);
        }
        
        // Mark pregnancy as completed (phase 3 for compatibility with romance system)
        pregnancy.phase = 3;
        pregnancy.stage = "complete";
        var gameDay = (LORB.SharedState && LORB.SharedState.getGameDay) ? LORB.SharedState.getGameDay() : (ctx.gameDay || 1);
        pregnancy.discoveredOnDay = gameDay;
        pregnancy.bornOnDay = gameDay;
        
        return created;
    }
    
    /**
     * Generate result text based on payment choice
     */
    function getResultLines(choice, count, vars) {
        var lines = [];
        
        if (choice === "lump") {
            lines.push("\1h\1gYou step up and pay the lump sum.\1n");
            lines.push("\1wThe " + vars.partner + " smiles with relief.");
            lines.push("");
            lines.push("\1h\1y\"Thank you. This means everything.\"\1n");
        } else if (choice === "installments") {
            lines.push("\1h\1yYou agree to monthly payments.\1n");
            lines.push("\1wIt'll take time, but you'll manage.");
            lines.push("");
            lines.push("\1w\"We'll make it work,\" " + vars.partner + " says.");
        } else {
            lines.push("\1h\1rYou walk away.\1n");
            lines.push("");
            lines.push(vars.partner + " clutches " + vars.baby + " tightly.");
            lines.push("\1w\"...I understand,\" she whispers.");
            lines.push("");
            lines.push("\1r(You will not raise " + (count > 1 ? "these babies" : "this baby") + ".)\1n");
        }
        
        return lines;
    }
    
    /**
     * Present payment options and return choice
     */
    function presentPaymentOptions(view, ctx, projection, vars) {
        var contentFrame = view.getZone("content");
        if (!contentFrame) return "abandon";
        
        var cash = getCash(ctx);
        
        contentFrame.gotoxy(1, 16);
        contentFrame.putmsg("\1wYou have: \1h\1g$" + cash + "\1n\r\n");
        contentFrame.putmsg("\1wTotal cost: \1h\1y$" + projection.totalCost + "\1n\r\n\r\n");
        contentFrame.putmsg("\1h\1wWhat will you do?\1n\r\n");
        contentFrame.putmsg("\1g[L]\1w Lump Sum ($" + projection.totalCost + ")" + (cash < projection.totalCost ? " \1r(Can't afford)\1n" : "\1n") + "\r\n");
        contentFrame.putmsg("\1y[I]\1w Installments ($" + Math.floor(projection.totalCost / 10) + "/mo)\r\n");
        contentFrame.putmsg("\1r[A]\1w Abandon\r\n");
        
        view.render();
        
        while (true) {
            var ch = console.getkey().toUpperCase();
            if (ch === "L" && cash >= projection.totalCost) return "lump";
            if (ch === "I") return "installments";
            if (ch === "A") return "abandon";
        }
    }
    
    /**
     * Prompt for baby names (full name and nickname)
     */
    function promptForBabyNames(view, pregnancy, count) {
        var names = [];
        var contentFrame = view.getZone("content");
        if (!contentFrame) {
            // Fallback if no view
            for (var i = 0; i < count; i++) {
                names.push({ name: null, nickname: null });
            }
            return names;
        }
        
        var countWord = getCountWord(count);
        
        contentFrame.clear();
        contentFrame.gotoxy(1, 1);
        
        if (countWord) {
            contentFrame.putmsg("\1h\1y" + countWord + "!\1n\r\n\r\n");
        }
        
        contentFrame.putmsg("\1wTime to name " + (count === 1 ? "your baby" : "your babies") + ".\1n\r\n\r\n");
        view.render();
        
        for (var i = 0; i < count; i++) {
            contentFrame.putmsg("\1cBaby #" + (i + 1) + " full name:\1w ");
            view.render();
            
            var fullName = console.getstr("", 20, K_LINE | K_EDIT);
            if (!fullName || fullName.trim() === "") {
                fullName = null;  // Let system auto-generate
            } else {
                fullName = fullName.trim();
            }
            contentFrame.putmsg("\r\n");
            
            contentFrame.putmsg("\1cBaby #" + (i + 1) + " nickname (5 chars):\1w ");
            view.render();
            
            var nickname = console.getstr("", 5, K_LINE | K_EDIT);
            if (!nickname || nickname.trim() === "") {
                nickname = null;  // Let system auto-generate
            } else {
                nickname = nickname.trim();
            }
            contentFrame.putmsg("\r\n\r\n");
            
            names.push({ name: fullName, nickname: nickname });
        }
        
        return names;
    }
    
    /**
     * Show birth announcement
     */
    function showBirthAnnouncement(view, babies) {
        var contentFrame = view.getZone("content");
        if (!contentFrame) return;
        
        contentFrame.clear();
        contentFrame.gotoxy(1, 1);
        
        if (babies.length === 1) {
            contentFrame.putmsg("\1h\1g*** " + babies[0].name + " is born! ***\1n\r\n");
        } else {
            contentFrame.putmsg("\1h\1g*** THE BABIES ARE BORN! ***\1n\r\n\r\n");
            for (var i = 0; i < babies.length; i++) {
                contentFrame.putmsg("\1c  " + (i + 1) + ". \1w" + babies[i].name + "\1n\r\n");
            }
        }
        
        contentFrame.putmsg("\r\n\1wPress any key...\1n");
        view.render();
        console.getkey();
    }
    
    /**
    * Show birth news list (no active pregnancy) with Doc Vitale RichView
    */
    function showBirthNews(newsEntries) {
        if (!newsEntries || newsEntries.length === 0) return false;
        
        // RichView presentation
        if (RichView) {
            var view = new RichView({
                zones: [
                    { name: "art", x: 1, y: 1, width: 40, height: 20 },
                    { name: "content", x: 41, y: 1, width: 40, height: 24 }
                ],
                theme: "lorb",
                art: { art: ART_DOC_VITALE }
            });
            
            view.setContentZone("content");
            view.line("\1h\1yDOC VITALE'S BABY WIRE\1n");
            view.blank();
            view.line("\1wToday's new diaper dandies:\1n");
            view.blank();
            
            for (var i = 0; i < newsEntries.length; i++) {
                var bn = newsEntries[i];
                var nameStr = "\1h\1c" + (bn.nickname || bn.babyName || "Baby") + "\1n";
                var birthdayStr = "\1n\1c" + formatBirthday(bn) + "\1n";
                view.line(nameStr + "  " + birthdayStr);
                view.line("  Parents: \1w" + (bn.parentName || "Unknown") + " + " + (bn.mother || "Unknown") + "\1n");
                var extra = bn.extra;
                if (bn.status === "abandoned" && (!extra || /abandoned at birth/i.test(extra))) {
                    if (LORB.Data && LORB.Data.BabyBallers && LORB.Data.BabyBallers.randomAbandonmentNote) {
                        extra = LORB.Data.BabyBallers.randomAbandonmentNote(
                            { name: bn.babyName, nickname: bn.nickname },
                            { name: bn.parentName, userHandle: bn.parentName }
                        );
                    }
                } else if (bn.status === "adopted" && !extra && LORB.Data && LORB.Data.BabyBallers && LORB.Data.BabyBallers.randomAdoptionNote) {
                    extra = LORB.Data.BabyBallers.randomAdoptionNote(
                        { name: bn.babyName, nickname: bn.nickname },
                        bn.parentName
                    );
                }
                if (extra) {
                    var noteColor = "\1w";
                    if (bn.status === "abandoned") {
                        noteColor = "\1h\1r";
                    } else if (bn.status === "adopted") {
                        noteColor = "\1h\1g";
                    }
                    view.line("  " + noteColor + extra + "\1n");
                }
                if (i < newsEntries.length - 1) {
                    view.blank();
                }
            }
            
            view.blank();
            view.line("\1h\1wPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
            return true;
        }
        
        // Fallback text view
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("DOC VITALE'S BABY WIRE");
        LORB.View.line("");
        for (var j = 0; j < newsEntries.length; j++) {
            var b = newsEntries[j];
            LORB.View.line((b.nickname || b.babyName || "Baby") + " - Parents: " + (b.parentName || "Unknown") + " + " + (b.mother || "Unknown") + " - Born: " + formatBirthday(b));
            var bExtra = b.extra;
            if (b.status === "abandoned" && (!bExtra || /abandoned at birth/i.test(bExtra))) {
                if (LORB.Data && LORB.Data.BabyBallers && LORB.Data.BabyBallers.randomAbandonmentNote) {
                    bExtra = LORB.Data.BabyBallers.randomAbandonmentNote(
                        { name: b.babyName, nickname: b.nickname },
                        { name: b.parentName, userHandle: b.parentName }
                    );
                }
            } else if (b.status === "adopted" && !bExtra && LORB.Data && LORB.Data.BabyBallers && LORB.Data.BabyBallers.randomAdoptionNote) {
                bExtra = LORB.Data.BabyBallers.randomAdoptionNote(
                    { name: b.babyName, nickname: b.nickname },
                    b.parentName
                );
            }
            if (bExtra) {
                LORB.View.line("  " + bExtra);
            }
        }
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
        return true;
    }
    
    /**
     * Lightweight baby projection helper (stats/appearance/cost) for legacy callers.
     */
    function projectBaby(ctx, pregnancy, isMonogamous) {
        var BabyBallers = LORB.Data && LORB.Data.BabyBallers;
        if (!BabyBallers) return null;
        var stats = BabyBallers.generateBabyStats(ctx.baseStats || {}, isMonogamous);
        var appearance = BabyBallers.rollBabyAppearance(ctx.appearance || {});
        var costPerBaby = BabyBallers.calculateChildSupportCost(stats, ctx, pregnancy ? pregnancy.npcName : null);
        return {
            stats: stats,
            appearance: appearance,
            costPerBaby: costPerBaby,
            totalCost: costPerBaby * (pregnancy && pregnancy.count ? pregnancy.count : 1),
            count: (pregnancy && pregnancy.count) || 1,
            isMonogamous: !!isMonogamous
        };
    }
    
    /**
     * Determine if player has been monogamous with current partner (legacy helper)
     */
    function checkMonogamy(ctx, currentNpcId) {
        if (!ctx || !ctx.babyMamas || ctx.babyMamas.length === 0) {
            return true;
        }
        for (var i = 0; i < ctx.babyMamas.length; i++) {
            if (ctx.babyMamas[i].id !== currentNpcId) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * Format a birthday string as MM/DayOfSeason/SeasonNumber
     */
    function formatBirthday(bn) {
        var bornMs = bn && bn.bornAtMs ? bn.bornAtMs : Date.now();
        var d = new Date(bornMs);
        var month = (d.getMonth() + 1);  // 1-12
        var dayOfSeason = bn && bn.bornOnDay ? bn.bornOnDay : (LORB.SharedState && LORB.SharedState.getGameDay ? LORB.SharedState.getGameDay() : 1);
        var seasonNum = bn && bn.seasonBorn ? bn.seasonBorn : (LORB.SharedState && LORB.SharedState.getInfo ? (LORB.SharedState.getInfo().seasonNumber || 1) : 1);
        return month + "/" + dayOfSeason + "/" + seasonNum;
    }
    
    // ========== MAIN DOCTOR VISIT FUNCTION ==========
    
    /**
     * Run the complete doctor visit flow
     * 
     * Phase 1: Initial reveal with ailment
     * Phase 2: Doc Vitale intro
     * Phase 3: Ultrasound scan reveals pregnancy
     * Phase 4: Baby scans (stats + sprite preview)
     * Phase 5: Birth event
     * Phase 6: Name baby (BEFORE payment)
     * Phase 7: Payment choice (AFTER naming)
     * Phase 8: Result and create babies
     */
    function runDoctorVisit(ctx, pregnancy) {
        if (!RichView) {
            log(LOG_WARNING, "[DOCTOR] RichView not available");
            return;
        }
        
        // Trace entry to doctor visit for debugging
        debugLog("[DOCTOR] runDoctorVisit start spouse=" + (ctx.romance && ctx.romance.spouseName ? ctx.romance.spouseName : "none") +
            " partner=" + (pregnancy.npcName || pregnancy.partnerName || "Partner"));
        
        // Generate projection if not already set (boot.js loads BabyBallers)
        if (!pregnancy.projectedStats) {
            var monogamyBonus = LORB.Data.BabyBallers.isChildBornInWedlock(ctx, pregnancy.npcName || pregnancy.partnerName);
            pregnancy.projectedStats = LORB.Data.BabyBallers.generateBabyStats(ctx.baseStats || {}, monogamyBonus);
            pregnancy.projectedAppearance = LORB.Data.BabyBallers.rollBabyAppearance(ctx.appearance || {});
            pregnancy.projectedCost = LORB.Data.BabyBallers.calculateChildSupportCost(
                pregnancy.projectedStats, 
                ctx, 
                pregnancy.npcName || "Partner"
            );
            pregnancy.monogamyBonus = monogamyBonus;
        }
        
        // Build projection object from pregnancy properties
        var projection = {
            count: pregnancy.count || 1,
            stats: pregnancy.projectedStats || {},
            appearance: pregnancy.projectedAppearance || {},
            baseCost: pregnancy.projectedCost || 1000,
            totalCost: (pregnancy.projectedCost || 1000) * (pregnancy.count || 1),
            wedlockDiscount: 0,
            monogamyBonus: pregnancy.monogamyBonus || false
        };
        
        var vars = {
            partner: pregnancy.npcName || pregnancy.partnerName || "Partner",
            baby: projection.count > 1 ? "babies" : "baby"
        };
        
        // Setup view with 2 zones: art (40x20) and content (40x24)
        var view = new RichView({
            zones: [
                { name: "art", x: 1, y: 1, width: 40, height: 20 },
                { name: "content", x: 41, y: 1, width: 40, height: 24 }
            ],
            theme: "lorb",
            art: {
                art: ART_DOC_VITALE
            }
        });
        
        var contentFrame = view.getZone("content");
        
        // ========== PHASE 1: INITIAL REVEAL (AILMENT) ==========
        
        var ailment = pick(AILMENTS);
        
        view.clear("content");
        showNarrative(view, [
            "\1h\1w" + vars.partner + " approaches you.\1n",
            "",
            "\1w\"I need to talk to you...\"\1n",
            "",
            "\1w\"I've been " + ailment.complaint + ".\"\1n",
            "",
            "\1y" + ailment.detail + "\1n",
            "",
            "\1w\"Maybe we should see a doctor?\"\1n"
        ], vars, 1000);
        
        contentFrame.putmsg("\r\n\1wPress any key...\1n");
        view.render();
        console.getkey();
        
        // ========== PHASE 2: DOC VITALE INTRO ==========
        
        view.clear("content");
        showNarrative(view, [
            "\1h\1yYou head to the clinic.\1n",
            "",
            "\1wA boisterous voice echoes down the hall:",
            ""
        ], vars, 800);
        
        var intro = pick(DOC_VITALE_INTRO);
        showNarrative(view, [intro], vars, 700);
        
        showNarrative(view, [
            "",
            "\1wDoc Vitale bursts into the room,",
            "\1wclipboard in hand, grinning ear to ear.\1n"
        ], vars, 900);
        
        contentFrame.putmsg("\r\n\1wPress any key...\1n");
        view.render();
        console.getkey();
        
        // ========== PHASE 3: ULTRASOUND SCAN (PREGNANCY REVEAL) ==========
        
        view.clear("content");
        
        var scanLine = pick(DOC_VITALE_SCAN);
        showNarrative(view, [
            "\1h\1cDoc Vitale:\1n " + scanLine,
            "",
            "\1wHe moves the ultrasound wand...\1n",
            "",
            "\1h\1g...a heartbeat appears on the monitor.\1n"
        ], vars, 1200);
        
        mswait(1500);
        
        // Twins/triplets reveal
        if (projection.count === 2) {
            var twinsLine = pick(DOC_VITALE_TWINS);
            showNarrative(view, [
                "",
                "\1h\1cDoc Vitale:\1n " + twinsLine,
                "",
                "\1h\1yTWINS!\1n"
            ], vars, 1000);
        } else if (projection.count === 3) {
            var tripletsLine = pick(DOC_VITALE_TRIPLETS);
            showNarrative(view, [
                "",
                "\1h\1cDoc Vitale:\1n " + tripletsLine,
                "",
                "\1h\1rTRIPLETS!\1n"
            ], vars, 1000);
        } else {
            showNarrative(view, [
                "",
                "\1h\1yYou're going to be a parent.\1n"
            ], vars, 1000);
        }
        
        contentFrame.putmsg("\r\n\1wPress any key...\1n");
        view.render();
        console.getkey();
        
        // ========== PHASE 4: BABY SCANS (STATS + SPRITE PREVIEW) ==========
        
        view.clear("content");
        drawStatsPreview(view, projection);
        drawCostBreakdown(view, projection, ctx);
        
        // Draw baby sprite preview
        drawBabySpritePreview(view, projection.appearance);
        
        view.render();
        mswait(2000);
        
        // Doc Vitale comments on stats
        contentFrame.gotoxy(1, 20);
        var statsLine = pick(DOC_VITALE_STATS);
        contentFrame.putmsg("\1h\1cDoc Vitale:\1n " + statsLine + "\r\n");
        view.render();
        
        contentFrame.putmsg("\r\n\1wPress any key...\1n");
        view.render();
        console.getkey();
        
        // ========== PHASE 5: BIRTH EVENT ==========
        
        view.clear("content");
        
        var birthLine = pick(DOC_VITALE_BIRTH);
        showNarrative(view, [
            "\1h\1y" + (projection.count > 1 ? "Months pass..." : "Nine months pass...") + "\1n",
            "",
            "\1h\1cDoc Vitale:\1n " + birthLine,
            "",
            "\1wThe room fills with sound...\1n",
            "",
            "\1h\1g" + (projection.count === 1 ? "A baby's cry." : "Babies crying.") + "\1n"
        ], vars, 1200);
        
        contentFrame.putmsg("\r\n\1wPress any key...\1n");
        view.render();
        console.getkey();
        
        // ========== PHASE 6: NAME BABY (BEFORE PAYMENT) ==========
        
        var babyNames = promptForBabyNames(view, pregnancy, projection.count);
        
        // ========== PHASE 7: PAYMENT CHOICE (AFTER NAMING) ==========
        
        view.clear("content");
        contentFrame.gotoxy(1, 1);
        contentFrame.putmsg("\1h\1wYou've named " + (projection.count === 1 ? "your baby" : "your babies") + ":\1n\r\n\r\n");
        for (var i = 0; i < babyNames.length; i++) {
            var fullName = babyNames[i].name || "(auto-generated)";
            var nickname = babyNames[i].nickname || "(auto-generated)";
            contentFrame.putmsg("\1c  • \1w" + fullName + " \1c(\1y" + nickname + "\1c)\1n\r\n");
        }
        contentFrame.putmsg("\r\n");
        
        // Show cost one more time
        contentFrame.putmsg("\1wTotal child support: \1h\1y$" + projection.totalCost + "\1n\r\n");
        contentFrame.putmsg("\1wYou have: \1h\1g$" + getCash(ctx) + "\1n\r\n\r\n");
        
        var choice = presentPaymentOptions(view, ctx, projection, vars);
        
        // ========== PHASE 8: RESULT & CREATE BABIES ==========
        
        view.clear("content");
        var resultLines = getResultLines(choice, projection.count, vars);
        showNarrative(view, resultLines, vars, 1000);
        
        contentFrame.putmsg("\r\n\1wPress any key...\1n");
        view.render();
        console.getkey();
        
        // Process payment and create babies
        var babies = [];
        var abandoned = (choice === "abandon");
        if (choice === "lump") {
            var remainingCash = getCash(ctx) - projection.totalCost;
            setCash(ctx, remainingCash);
        } else if (choice === "installments") {
            ctx.childSupportPayments = ctx.childSupportPayments || [];
            ctx.childSupportPayments.push({
                amount: Math.floor(projection.totalCost / 10),
                remaining: 10,
                partnerName: vars.partner
            });
        }
        
        babies = createBabies(ctx, pregnancy, babyNames, { abandoned: abandoned });
        
        // Show birth announcement (even for abandoned, to surface existence)
        showBirthAnnouncement(view, babies);
        
        // Flag spouse out-of-wedlock drama (shown after doctor visit closes)
        var shouldTriggerSpouseDrama = false;
        var mamaName = pregnancy.npcName || pregnancy.partnerName || "Partner";
        if (ctx.romance && ctx.romance.spouseName) {
            var spouseName = ctx.romance.spouseName;
            // Case-insensitive compare to avoid missing due to casing/spacing differences
            if ((spouseName || "").toLowerCase() !== (mamaName || "").toLowerCase()) {
                shouldTriggerSpouseDrama = true;
            }
        }
        // Explicit debug trace (will throw if debugLog is missing, by design)
        debugLog("[DOCTOR] Out-of-wedlock check spouse=" + (ctx.romance && ctx.romance.spouseName ? ctx.romance.spouseName : "none") +
            " mama=" + mamaName + " shouldTrigger=" + shouldTriggerSpouseDrama);
        
        // Remove completed pregnancy record so it doesn't retrigger
        if (pregnancy.phase >= 3 && LORB.Data && LORB.Data.Romance && LORB.Data.Romance.removeCompletedPregnancy) {
            LORB.Data.Romance.removeCompletedPregnancy(ctx, pregnancy.npcId || pregnancy.npcName || pregnancy.partnerName);
        }
        
        // Cleanup
        cleanupSprite(view);
        view.close();
        
        // Show deterministic angry spouse event after the doctor scene ends
        if (shouldTriggerSpouseDrama && LORB.Data && LORB.Data.SpouseEvents && LORB.Data.SpouseEvents.triggerOutOfWedlock) {
            LORB.Data.SpouseEvents.triggerOutOfWedlock(ctx, mamaName, babies);
        }
        
        return {
            babies: babies,
            choice: choice
        };
    }
    
    /**
     * Minimal birth event handler (non-doctor-flow) to keep exports intact.
     * Creates babies and shows a simple announcement when invoked directly.
     */
    function runBirthEvent(ctx, pregnancy) {
        if (!pregnancy) return [];
        
        // Auto-generate names (empty objects -> auto)
        var babyNames = [];
        var count = pregnancy.count || 1;
        for (var i = 0; i < count; i++) babyNames.push({});
        
        var babies = createBabies(ctx, pregnancy, babyNames);
        
        // Show a basic announcement if possible
        if (RichView) {
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 4 },
                    { name: "art", x: 1, y: 5, width: 40, height: 20 },
                    { name: "content", x: 41, y: 5, width: 40, height: 20 }
                ],
                theme: "lorb"
            });
            showBirthAnnouncement(view, babies);
            view.close();
        } else {
            LORB.View.init();
            LORB.View.clear();
            LORB.View.header("IT'S A BABY!");
            for (var j = 0; j < babies.length; j++) {
                LORB.View.line("Welcome " + babies[j].name + " (" + babies[j].nickname + ")!");
            }
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey();
        }
        
        return babies;
    }
    
    // ========== MODULE EXPORTS ==========
    
    if (typeof LORB === "undefined") {
        this.LORB = {};
    }
    if (typeof LORB.Locations === "undefined") {
        LORB.Locations = {};
    }
    
    LORB.Locations.Doctor = {
        runDoctorVisit: runDoctorVisit,
        runBirthEvent: runBirthEvent,
        showBirthAnnouncement: showBirthAnnouncement,
        projectBaby: projectBaby,
        checkMonogamy: checkMonogamy,
        showBirthNews: showBirthNews,
        
        // Expose helper functions for testing
        drawBabySpritePreview: drawBabySpritePreview,
        drawStatsPreview: drawStatsPreview,
        drawCostBreakdown: drawCostBreakdown,
        createBabies: createBabies,
        promptForBabyNames: promptForBabyNames,
        presentPaymentOptions: presentPaymentOptions,
        getResultLines: getResultLines
    };
    
}).call(this);
