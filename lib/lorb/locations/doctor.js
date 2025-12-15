/**
 * doctor.js - Doctor Visit Location for LORB
 * 
 * Handles Phase 2 of the pregnancy system: the discovery/ultrasound scene.
 * Uses RichView with:
 * - Left side: Ultrasound art (or baby preview)
 * - Right side: Stats preview, payment options
 * 
 * Called when player enters a city where a Phase 1 (hidden) pregnancy exists.
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

(function() {
    // NOTE: Do not use "use strict" - Synchronet color codes use octal-like \1 escapes
    
    var RichView = _doctorRichView;
    
    // Art paths
    var ART_ULTRASOUND = "/sbbs/xtrn/nba_jam/assets/lorb/ultrasound.bin";
    var ART_BABY_PREVIEW = "/sbbs/xtrn/nba_jam/assets/lorb/baby_preview.bin";
    var ART_WIDTH = 40;
    var ART_HEIGHT = 20;
    
    // Skin tone to sprite mapping (for preview)
    var SPRITES_DIR = "/sbbs/xtrn/nba_jam/sprites/";
    var SPRITE_WIDTH = 5;
    var SPRITE_HEIGHT = 4;
    
    // ========== INTRO/NARRATIVE TEXT ==========
    
    var INTRO_LINES = [
        "Your phone buzzes. A familiar name on the screen.",
        "\"{npcName} found you at the hotel.\"",
        "She looks nervous. Something's different.",
        "",
        "\"We need to talk,\" she says.",
        "\"I'm... pregnant.\""
    ];
    
    var DISCOVERY_LINES_SINGLE = [
        "At the clinic, the ultrasound confirms it.",
        "One heartbeat. One baby.",
        "",
        "The doctor hands you a printout."
    ];
    
    var DISCOVERY_LINES_TWINS = [
        "At the clinic, the ultrasound shows... two heartbeats!",
        "TWINS.",
        "",
        "The doctor looks impressed. And a little concerned."
    ];
    
    var DISCOVERY_LINES_TRIPLETS = [
        "At the clinic, the ultrasound shows... THREE heartbeats!",
        "TRIPLETS!",
        "",
        "The doctor whistles. \"This is gonna be expensive.\""
    ];
    
    var PAYMENT_OPTION_LINES = {
        abandon: [
            "You could walk away. Ghost her.",
            "Nobody would know... except you.",
            "And the universe keeps score."
        ],
        installment: [
            "Set up a payment plan.",
            "Pay it off over time with wins.",
            "50% of the baby's streetball earnings go to support."
        ],
        lump_sum: [
            "Pay it all now and be done with it.",
            "25% discount for full payment.",
            "You'll have full parental rights immediately."
        ],
        bill_me: [
            "\"Just bill me,\" you say.",
            "The balance accrues. Interest may apply.",
            "Pay it off later... if you remember."
        ]
    };
    
    var RESULT_LINES = {
        abandon: [
            "{npcName} stares at you in disbelief.",
            "\"You're really just going to leave?\"",
            "",
            "Your reputation takes a hit. The streets remember."
        ],
        installment: [
            "\"We'll figure this out,\" she says.",
            "The payment plan is set up.",
            "Every win, every game - part of it goes to the kid."
        ],
        lump_sum: [
            "{npcName} looks relieved.",
            "\"Thank you for stepping up.\"",
            "",
            "The baby will know who their dad is."
        ],
        bill_me: [
            "The paperwork is filed.",
            "You'll get reminders. Probably.",
            "",
            "For now, the balance hangs over your head."
        ]
    };
    
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
     * Replace {npcName} placeholder in text
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
     * Display narrative lines with pacing
     */
    function showNarrative(view, lines, vars, pauseMs) {
        pauseMs = pauseMs || 800;
        
        for (var i = 0; i < lines.length; i++) {
            var line = formatText(lines[i], vars);
            if (line === "") {
                view.blank();
            } else {
                view.line("\1w" + line + "\1n");
            }
            view.render();
            mswait(pauseMs);
        }
    }
    
    // ========== PREVIEW GENERATION ==========
    
    /**
     * Project what the baby will look like (stats, appearance, cost)
     */
    function projectBaby(ctx, pregnancy, isMonogamous) {
        var BabyBallers = LORB.Data.BabyBallers;
        
        // Generate projected stats
        var projectedStats = BabyBallers.generateBabyStats(ctx.baseStats || {}, isMonogamous);
        
        // Generate projected appearance
        var projectedAppearance = BabyBallers.rollBabyAppearance(ctx.appearance || {});
        
        // Calculate cost per baby (pass ctx and motherName for wedlock check)
        var costPerBaby = BabyBallers.calculateChildSupportCost(projectedStats, ctx, pregnancy.npcName);
        var totalCost = costPerBaby * (pregnancy.count || 1);
        var lumpSumPrice = BabyBallers.calculateLumpSumPrice(totalCost);
        
        return {
            stats: projectedStats,
            appearance: projectedAppearance,
            costPerBaby: costPerBaby,
            totalCost: totalCost,
            lumpSumPrice: lumpSumPrice,
            count: pregnancy.count || 1,
            isMonogamous: isMonogamous,
            isWedlock: costPerBaby === 0  // Flag for UI display
        };
    }
    
    /**
     * Draw baby stats preview in content zone
     */
    function drawStatsPreview(view, projection) {
        var stats = projection.stats;
        var STAT_NAMES = LORB.Data.BabyBallers.STAT_NAMES;
        
        view.line("\1h\1c=== PROJECTED BABY STATS ===\1n");
        view.blank();
        
        // Stats display
        for (var i = 0; i < STAT_NAMES.length; i++) {
            var statName = STAT_NAMES[i];
            var statVal = stats[statName] || 1;
            var barLength = Math.min(statVal, 10);
            var bar = "";
            for (var j = 0; j < barLength; j++) bar += "█";
            for (var k = barLength; k < 10; k++) bar += "░";
            
            var displayName = statName.charAt(0).toUpperCase() + statName.slice(1);
            if (displayName === "ThreePt") displayName = "3-Point";
            
            view.line("\1w" + padRight(displayName, 8) + " \1c" + bar + " \1h\1y" + statVal + "\1n");
        }
        
        view.blank();
        
        // Monogamy bonus indicator
        if (projection.isMonogamous) {
            view.line("\1h\1g★ MONOGAMY BONUS APPLIED (+2 all stats)\1n");
        }
        
        view.blank();
        view.line("\1wTotal Stat Points: \1h\1c" + LORB.Data.BabyBallers.calculateTotalStats(stats) + "\1n");
    }
    
    /**
     * Draw cost breakdown
     */
    function drawCostBreakdown(view, projection, ctx) {
        view.blank();
        view.line("\1h\1y=== CHILD SUPPORT COST ===\1n");
        view.blank();
        
        // Check for wedlock exemption
        if (projection.isWedlock) {
            view.line("\1h\1g★ BORN IN WEDLOCK ★\1n");
            view.line("\1gNo child support required!\1n");
            view.line("\1wMarriage has its benefits.\1n");
            view.blank();
            view.line("\1wYour cash: \1h\1y$" + (ctx.cash || 0) + "\1n");
            return;
        }
        
        if (projection.count > 1) {
            view.line("Babies: \1h\1c" + projection.count + "\1n");
            view.line("Cost per baby: \1y$" + projection.costPerBaby + "\1n");
        }
        
        view.line("\1wTotal owed: \1h\1y$" + projection.totalCost + "\1n");
        view.line("\1wLump sum price: \1h\1g$" + projection.lumpSumPrice + " \1n\1g(25% off)\1n");
        view.blank();
        view.line("\1wYour cash: \1h\1y$" + (ctx.cash || 0) + "\1n");
    }
    
    /**
     * Draw appearance preview (ASCII baby sprite representation)
     */
    function drawAppearancePreview(artFrame, projection) {
        if (!artFrame) return;
        
        artFrame.clear();
        
        // Try to load ultrasound art first
        if (typeof BinLoader !== "undefined" && file_exists(ART_ULTRASOUND)) {
            BinLoader.loadIntoFrame(artFrame, ART_ULTRASOUND, ART_WIDTH, ART_HEIGHT, 1, 1);
            return;
        }
        
        // Fallback: ASCII art representation
        var skin = projection.appearance.skin || "brown";
        var jersey = projection.appearance.jerseyColor || "WHITE";
        
        // Draw a simple baby silhouette
        artFrame.gotoxy(15, 8);
        artFrame.putmsg("\1h\1c┌───────┐\1n");
        artFrame.gotoxy(15, 9);
        artFrame.putmsg("\1h\1c│ \1w●   ● \1c│\1n");
        artFrame.gotoxy(15, 10);
        artFrame.putmsg("\1h\1c│   ▼   │\1n");
        artFrame.gotoxy(15, 11);
        artFrame.putmsg("\1h\1c│  ───  │\1n");
        artFrame.gotoxy(15, 12);
        artFrame.putmsg("\1h\1c└───────┘\1n");
        
        // Baby info below
        artFrame.gotoxy(12, 14);
        artFrame.putmsg("\1wSkin: \1c" + skin + "\1n");
        artFrame.gotoxy(12, 15);
        artFrame.putmsg("\1wJersey: \1c" + jersey + "\1n");
        artFrame.gotoxy(12, 16);
        artFrame.putmsg("\1wNumber: \1c#" + projection.appearance.jerseyNumber + "\1n");
        
        if (projection.count > 1) {
            artFrame.gotoxy(12, 18);
            artFrame.putmsg("\1h\1y" + getCountWord(projection.count) + " INCOMING!\1n");
        }
    }
    
    /**
     * Get word for baby count
     */
    function getCountWord(count) {
        if (count === 2) return "TWINS";
        if (count === 3) return "TRIPLETS";
        return "";
    }
    
    /**
     * Pad string to the right
     */
    function padRight(str, len) {
        str = String(str || "");
        while (str.length < len) str += " ";
        return str;
    }
    
    // ========== PAYMENT OPTIONS FLOW ==========
    
    /**
     * Present payment options and handle choice
     */
    function presentPaymentOptions(view, ctx, projection, vars) {
        var canLumpSum = (ctx.cash || 0) >= projection.lumpSumPrice;
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        view.line("\1h\1y=== WHAT DO YOU DO? ===\1n");
        view.blank();
        
        var menuItems = [
            {
                text: "Accept & Set Up Payments",
                value: "installment",
                hotkey: "1"
            },
            {
                text: canLumpSum 
                    ? "Pay Lump Sum ($" + projection.lumpSumPrice + ")"
                    : "\1w(Need $" + projection.lumpSumPrice + " for lump sum)\1n",
                value: canLumpSum ? "lump_sum" : null,
                hotkey: "2",
                disabled: !canLumpSum
            },
            {
                text: "Bill Me Later",
                value: "bill_me",
                hotkey: "3"
            },
            {
                text: "\1rWalk Away (Abandon)\1n",
                value: "abandon",
                hotkey: "4"
            }
        ];
        
        view.blank();
        
        var choice = view.menu(menuItems, { y: 4 });
        
        // Show explanation for choice
        if (choice && PAYMENT_OPTION_LINES[choice]) {
            view.clearZone("content");
            view.setContentZone("content");
            view.setCursorY(0);
            showNarrative(view, PAYMENT_OPTION_LINES[choice], vars, 600);
            view.blank();
            view.line("\1h\1wPress any key to confirm...\1n");
            view.render();
            console.getkey();
        }
        
        return choice || "bill_me";  // Default to bill_me if cancelled
    }
    
    // ========== MAIN DOCTOR VISIT FLOW ==========
    
    /**
     * Run the doctor visit scene for a Phase 1 pregnancy
     * 
     * @param {Object} ctx - Player context
     * @param {Object} pregnancy - The pregnancy object from ctx.pregnancies
     * @returns {Object} Result { choice, babies, projection }
     */
    function runDoctorVisit(ctx, pregnancy) {
        if (!RichView) {
            return runLegacyDoctorVisit(ctx, pregnancy);
        }
        
        // Get city theme for styling
        var city = null;
        if (LORB.Cities && LORB.Cities.getToday) {
            city = LORB.Cities.getToday();
        }
        var cityTheme = (LORB.Cities && LORB.Cities.getCityTheme && city) 
            ? LORB.Cities.getCityTheme(city) 
            : "lorb";
        
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 41, y: 5, width: 40, height: 20 }
            ],
            theme: cityTheme
        });
        
        // Template variables
        var vars = {
            npcName: pregnancy.npcName || "Someone"
        };
        
        // Check if this is a monogamous situation
        var isMonogamous = checkMonogamy(ctx, pregnancy.npcId);
        
        // Project baby stats/appearance/cost
        var projection = projectBaby(ctx, pregnancy, isMonogamous);
        
        // Store projection in pregnancy for later use
        pregnancy.projectedStats = projection.stats;
        pregnancy.projectedAppearance = projection.appearance;
        pregnancy.projectedCost = projection.totalCost;
        
        // === INTRO SCENE ===
        
        // Draw header
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            headerFrame.clear();
            headerFrame.gotoxy(30, 2);
            headerFrame.putmsg("\1h\1m=== THE CLINIC ===\1n");
        }
        
        // Initial art (can be blank or placeholder)
        drawAppearancePreview(view.getZone("art"), projection);
        
        view.setContentZone("content");
        view.setCursorY(0);
        
        showNarrative(view, INTRO_LINES, vars, 1000);
        
        view.blank();
        view.line("\1h\1wPress any key to continue...\1n");
        view.render();
        console.getkey();
        
        // === ULTRASOUND DISCOVERY ===
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        // Show discovery lines based on count
        var discoveryLines = DISCOVERY_LINES_SINGLE;
        if (pregnancy.count === 2) discoveryLines = DISCOVERY_LINES_TWINS;
        if (pregnancy.count >= 3) discoveryLines = DISCOVERY_LINES_TRIPLETS;
        
        showNarrative(view, discoveryLines, vars, 800);
        
        view.blank();
        view.line("\1h\1wPress any key...\1n");
        view.render();
        console.getkey();
        
        // === STATS PREVIEW ===
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        drawStatsPreview(view, projection);
        drawCostBreakdown(view, projection, ctx);
        
        view.render();
        mswait(1500);
        
        view.line("\1h\1wPress any key...\1n");
        view.render();
        console.getkey();
        
        // === PAYMENT OPTIONS ===
        
        var choice = presentPaymentOptions(view, ctx, projection, vars);
        
        // Store choice in pregnancy
        pregnancy.paymentChoice = choice;
        
        // Process the choice
        var result = processPaymentChoice(ctx, pregnancy, projection, choice);
        
        // === RESULT SCENE ===
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        showNarrative(view, RESULT_LINES[choice], vars, 800);
        
        // Show alignment change
        if (result.alignmentChange !== 0) {
            view.blank();
            var alignColor = result.alignmentChange > 0 ? "\1g" : "\1r";
            view.line(alignColor + "Alignment: " + (result.alignmentChange > 0 ? "+" : "") + result.alignmentChange + "\1n");
        }
        
        // If lump sum, show cash deduction
        if (choice === "lump_sum") {
            view.line("\1y-$" + projection.lumpSumPrice + " cash\1n");
        }
        
        view.blank();
        view.line("\1h\1wPress any key to continue...\1n");
        view.render();
        console.getkey();
        
        view.close();
        
        // Mark pregnancy as discovered (phase 2)
        pregnancy.phase = 2;
        pregnancy.discoveredOnDay = LORB.SharedState ? LORB.SharedState.getGameDay() : 1;
        
        return {
            choice: choice,
            projection: projection,
            result: result
        };
    }
    
    /**
     * Check if player has been monogamous (only one partner with children)
     */
    function checkMonogamy(ctx, currentNpcId) {
        if (!ctx.babyMamas || ctx.babyMamas.length === 0) {
            // First baby = monogamous
            return true;
        }
        
        // Check if all existing baby mamas are the same person
        for (var i = 0; i < ctx.babyMamas.length; i++) {
            if (ctx.babyMamas[i].id !== currentNpcId) {
                // Different baby mama exists = not monogamous
                return false;
            }
        }
        
        return true;  // All babies with same partner
    }
    
    /**
     * Process the payment choice
     */
    function processPaymentChoice(ctx, pregnancy, projection, choice) {
        var result = {
            alignmentChange: 0,
            cashChange: 0,
            supportSetup: null
        };
        
        // Initialize alignment if not present
        if (typeof ctx.alignment === "undefined") {
            ctx.alignment = 0;
        }
        
        switch (choice) {
            case "abandon":
                // Big negative alignment hit
                var abandonPenalty = getConfig("ALIGNMENT_ABANDON", -25);
                ctx.alignment += abandonPenalty;
                result.alignmentChange = abandonPenalty;
                
                // Mark pregnancy for later random event (adoption by NPC)
                pregnancy.abandoned = true;
                break;
                
            case "installment":
                // Neutral/slight positive - accepting responsibility
                var installmentBonus = getConfig("ALIGNMENT_NURTURE", 10) / 2;  // Half bonus
                ctx.alignment += Math.floor(installmentBonus);
                result.alignmentChange = Math.floor(installmentBonus);
                break;
                
            case "lump_sum":
                // Positive alignment - stepping up fully
                var lumpBonus = getConfig("ALIGNMENT_LUMP_SUM", 15);
                ctx.alignment += lumpBonus;
                result.alignmentChange = lumpBonus;
                
                // Deduct cash
                ctx.cash = (ctx.cash || 0) - projection.lumpSumPrice;
                result.cashChange = -projection.lumpSumPrice;
                
                // Mark as pre-paid
                pregnancy.prepaid = true;
                pregnancy.prepaidAmount = projection.lumpSumPrice;
                break;
                
            case "bill_me":
            default:
                // No immediate impact, balance will accrue
                break;
        }
        
        // Cap alignment
        ctx.alignment = Math.max(-100, Math.min(100, ctx.alignment));
        
        return result;
    }
    
    /**
     * Legacy fallback (no RichView)
     */
    function runLegacyDoctorVisit(ctx, pregnancy) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("THE CLINIC");
        LORB.View.line("");
        LORB.View.line(pregnancy.npcName + " found you.");
        LORB.View.line("\"I'm pregnant.\"");
        LORB.View.line("");
        
        var isMonogamous = checkMonogamy(ctx, pregnancy.npcId);
        var projection = projectBaby(ctx, pregnancy, isMonogamous);
        
        // Store projection
        pregnancy.projectedStats = projection.stats;
        pregnancy.projectedAppearance = projection.appearance;
        pregnancy.projectedCost = projection.totalCost;
        
        LORB.View.line("Child support cost: $" + projection.totalCost);
        LORB.View.line("Lump sum discount: $" + projection.lumpSumPrice);
        LORB.View.line("Your cash: $" + (ctx.cash || 0));
        LORB.View.line("");
        LORB.View.line("[1] Accept payments  [2] Lump sum  [3] Bill me  [4] Walk away");
        
        var choiceMap = { "1": "installment", "2": "lump_sum", "3": "bill_me", "4": "abandon" };
        var key = LORB.View.prompt("Choice: ");
        var choice = choiceMap[key] || "bill_me";
        
        if (choice === "lump_sum" && (ctx.cash || 0) < projection.lumpSumPrice) {
            LORB.View.warn("Not enough cash for lump sum.");
            choice = "bill_me";
        }
        
        pregnancy.paymentChoice = choice;
        processPaymentChoice(ctx, pregnancy, projection, choice);
        
        pregnancy.phase = 2;
        pregnancy.discoveredOnDay = LORB.SharedState ? LORB.SharedState.getGameDay() : 1;
        
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
        
        return {
            choice: choice,
            projection: projection
        };
    }
    
    /**
     * Run the birth event for a Phase 2 pregnancy
     * Creates the actual baby baller(s)
     * 
     * @param {Object} ctx - Player context
     * @param {Object} pregnancy - The pregnancy object (phase 2)
     * @returns {Array} Array of created baby ballers
     */
    function runBirthEvent(ctx, pregnancy) {
        var babies = [];
        var BabyBallers = LORB.Data.BabyBallers;
        var count = pregnancy.count || 1;
        
        // Create each baby
        for (var i = 0; i < count; i++) {
            // Determine if support was prepaid
            var isPrepaid = pregnancy.prepaid || false;
            
            var baby = BabyBallers.createBabyBaller(
                ctx,
                pregnancy.npcId,
                pregnancy.npcName,
                pregnancy.projectedStats ? true : checkMonogamy(ctx, pregnancy.npcId),
                pregnancy.projectedStats,
                pregnancy.projectedAppearance
            );
            
            // If prepaid, mark as paid off
            if (isPrepaid) {
                baby.childSupport.balance = 0;
                baby.childSupport.isPaidOff = true;
            }
            
            // If abandoned, set parenting mode
            if (pregnancy.abandoned) {
                baby.parentingMode = "abandon";
                baby.relationship = -25;  // Start hostile
            }
            
            // Add to context
            BabyBallers.addBabyToContext(ctx, baby);
            
            // Add to world registry for other players
            BabyBallers.addToWorldBabyBallers(baby, ctx);
            
            babies.push(baby);
        }
        
        // Ensure baby mama record exists
        var babyMama = BabyBallers.ensureBabyMama(
            ctx,
            pregnancy.npcId,
            pregnancy.npcName,
            pregnancy.cityId,
            babies[0].id
        );
        
        // Add all children to baby mama
        for (var j = 1; j < babies.length; j++) {
            if (babyMama.childrenIds.indexOf(babies[j].id) === -1) {
                babyMama.childrenIds.push(babies[j].id);
            }
        }
        
        // Calculate total support for baby mama
        babyMama.childSupport.totalOwed = BabyBallers.calculateBabyMamaBalance(ctx, pregnancy.npcId);
        babyMama.childSupport.balance = babyMama.childSupport.totalOwed;
        
        // Update parenting stats
        BabyBallers.updateParentingStats(ctx);
        
        // Mark pregnancy as complete (phase 3)
        pregnancy.phase = 3;
        pregnancy.bornOnDay = LORB.SharedState ? LORB.SharedState.getGameDay() : 1;
        
        return babies;
    }
    
    /**
     * Show the birth announcement scene
     */
    function showBirthAnnouncement(ctx, babies) {
        if (!RichView || !babies || babies.length === 0) {
            // Legacy fallback
            LORB.View.init();
            LORB.View.clear();
            LORB.View.header("IT'S A BABY!");
            LORB.View.line("");
            for (var i = 0; i < babies.length; i++) {
                LORB.View.line("Welcome " + babies[i].name + " (" + babies[i].nickname + ")!");
            }
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey();
            return;
        }
        
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 41, y: 5, width: 40, height: 20 }
            ],
            theme: "lorb"
        });
        
        // Header
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            headerFrame.clear();
            var title = babies.length > 1 ? "IT'S " + getCountWord(babies.length) + "!" : "IT'S A BABY!";
            var padding = Math.floor((80 - title.length) / 2);
            headerFrame.gotoxy(padding, 2);
            headerFrame.putmsg("\1h\1m" + title + "\1n");
        }
        
        // Art: baby sprite(s)
        var artFrame = view.getZone("art");
        if (artFrame) {
            artFrame.clear();
            // Draw simple celebration
            artFrame.gotoxy(15, 8);
            artFrame.putmsg("\1h\1y★ ★ ★ ★ ★\1n");
            artFrame.gotoxy(12, 10);
            artFrame.putmsg("\1h\1m♥ BABY BALLER ♥\1n");
            artFrame.gotoxy(15, 12);
            artFrame.putmsg("\1h\1y★ ★ ★ ★ ★\1n");
        }
        
        view.setContentZone("content");
        view.setCursorY(0);
        
        for (var i = 0; i < babies.length; i++) {
            var baby = babies[i];
            view.line("\1h\1cWelcome to the world!\1n");
            view.blank();
            view.line("\1wName: \1h\1y" + baby.name + "\1n");
            view.line("\1wNickname: \1c" + baby.nickname + "\1n");
            view.line("\1wMother: \1m" + baby.motherName + "\1n");
            view.blank();
            
            // Stats summary
            var totalStats = LORB.Data.BabyBallers.calculateTotalStats(baby.stats);
            view.line("\1wTotal Stats: \1h\1c" + totalStats + "\1n");
            view.line("\1wStarting Court: \1g" + LORB.Data.BabyBallers.getCourtTierName(1) + "\1n");
            view.blank();
            
            // Support status
            if (baby.childSupport.isPaidOff) {
                view.line("\1gChild Support: PAID IN FULL\1n");
            } else {
                view.line("\1yChild Support: $" + baby.childSupport.balance + " owed\1n");
            }
            
            if (babies.length > 1 && i < babies.length - 1) {
                view.blank();
                view.line("\1h\1w--- AND ---\1n");
                view.blank();
            }
        }
        
        view.blank();
        view.line("\1h\1wPress any key to continue...\1n");
        view.render();
        console.getkey();
        
        view.close();
    }
    
    // ========== EXPORT ==========
    
    if (typeof LORB === "undefined") {
        throw new Error("LORB namespace not defined - load boot.js first");
    }
    
    if (!LORB.Locations) LORB.Locations = {};
    
    LORB.Locations.Doctor = {
        runDoctorVisit: runDoctorVisit,
        runBirthEvent: runBirthEvent,
        showBirthAnnouncement: showBirthAnnouncement,
        projectBaby: projectBaby,
        checkMonogamy: checkMonogamy
    };
    
})();
