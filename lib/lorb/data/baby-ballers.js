/**
 * baby-ballers.js - Baby Baller System for LORB
 * 
 * Handles:
 * - Baby baller creation (stats, appearance, child support calculation)
 * - Child support economy (payment tracking, balance management)
 * - Baby baller progression (XP, leveling, court tier promotion)
 * - Parent-child relationship tracking
 * - Global world registry (for inter-player encounters)
 * 
 * Based on relationship_system_implementation_plan.md design spec.
 */
(function() {
    // NOTE: Do not use "use strict" - Synchronet color codes use octal-like \1 escapes
    
    // ========== CONSTANTS ==========
    // These use LORB.Config.BABY_BALLERS when available, with fallbacks
    
    function getConfig(key, fallback) {
        if (LORB.Config && LORB.Config.BABY_BALLERS && typeof LORB.Config.BABY_BALLERS[key] !== "undefined") {
            return LORB.Config.BABY_BALLERS[key];
        }
        return fallback;
    }
    
    // Stat names for generation
    var STAT_NAMES = ["speed", "threePt", "dunk", "block", "power", "steal"];
    
    // Court tier names (consistent with courts.js)
    var COURT_TIER_NAMES = {
        "1": "Middle School",
        "2": "High School",
        "3": "AAU",
        "4": "College",
        "5": "NBA"
    };
    
    // Parenting mode effects
    var PARENTING_EFFECTS = {
        nurture: { relationshipBonus: 5, earningsCut: 0.10 },
        neglect: { relationshipBonus: 0, earningsCut: 0.00 },
        abandon: { relationshipBonus: -10, earningsCut: -0.05 }  // Nemesis takes from you
    };
    
    // JSON-DB path for global baby baller registry
    var WORLD_BABY_BALLERS_PATH = "lorb.worldBabyBallers";
    
    // ========== ID GENERATION ==========
    
    /**
     * Generate a unique baby baller ID
     */
    function generateBabyId() {
        return "baby_" + Date.now().toString(36) + "_" + Math.random().toString(36).substr(2, 5);
    }
    
    // ========== BABY NAME GENERATION ==========
    
    var BABY_FIRST_NAMES = [
        // Boys - basketball themed
        "Dunk", "Swish", "Buckets", "Handles", "Dime",
        "Brick", "Clutch", "Hustle", "Flash", "Splash",
        "Shooter", "Slick", "Ace", "Cash", "Triple",
        // Girls - basketball themed  
        "Swoosh", "Bounce", "Finesse", "Star", "Spark",
        "Blaze", "Storm", "Nova", "Dash", "Phoenix"
    ];
    
    var BABY_NICKNAMES = [
        "LIL", "MINI", "BABY", "JR", "YOUNG",
        "TINY", "SHORTY", "KIDDO", "SON OF", "HEIR"
    ];
    
    /**
     * Generate a random baby name
     */
    function generateBabyName(parentName) {
        var firstName = BABY_FIRST_NAMES[Math.floor(Math.random() * BABY_FIRST_NAMES.length)];
        
        // 30% chance to be "Jr." version of parent name
        if (Math.random() < 0.30 && parentName) {
            var parts = parentName.split(" ");
            firstName = parts[parts.length - 1]; // Use parent's last name as first
        }
        
        return firstName;
    }
    
    /**
     * Generate a nickname for the baby baller
     */
    function generateNickname(babyName, parentNickname) {
        var prefix = BABY_NICKNAMES[Math.floor(Math.random() * BABY_NICKNAMES.length)];
        
        // Short version of name
        var shortName = babyName.substring(0, Math.min(5, babyName.length)).toUpperCase();
        
        // 25% chance to inherit part of parent's nickname
        if (Math.random() < 0.25 && parentNickname) {
            shortName = parentNickname.substring(0, 4) + " JR";
        }
        
        return prefix + " " + shortName;
    }
    
    // ========== STAT GENERATION ==========
    
    /**
     * Generate stats for a new baby baller
     * Uses inheritance + randomization + monogamy bonus
     * 
     * @param {Object} parentStats - Parent's stats (or null)
     * @param {boolean} monogamyBonus - Whether parent was monogamous
     * @returns {Object} Generated stats
     */
    function generateBabyStats(parentStats, monogamyBonus) {
        var baseMin = getConfig("BASE_STAT_MIN", 1);
        var baseMax = getConfig("BASE_STAT_MAX", 4);
        var inheritedWeight = getConfig("INHERITED_STAT_WEIGHT", 0.30);
        var monoBonus = monogamyBonus ? getConfig("MONOGAMY_STAT_BONUS", 2) : 0;
        
        var stats = {};
        
        for (var i = 0; i < STAT_NAMES.length; i++) {
            var statName = STAT_NAMES[i];
            
            // Base random stat
            var baseStat = baseMin + Math.floor(Math.random() * (baseMax - baseMin + 1));
            
            // Inherited component
            var inherited = 0;
            if (parentStats && parentStats[statName]) {
                inherited = Math.floor(parentStats[statName] * inheritedWeight);
            }
            
            // Final stat = base + inherited + monogamy bonus, capped at 1-10
            stats[statName] = Math.max(1, Math.min(10, baseStat + inherited + monoBonus));
        }
        
        return stats;
    }
    
    /**
     * Calculate total stat points for a baby baller (used for support cost calculation)
     */
    function calculateTotalStats(stats) {
        var total = 0;
        for (var i = 0; i < STAT_NAMES.length; i++) {
            total += (stats[STAT_NAMES[i]] || 0);
        }
        return total;
    }
    
    // ========== APPEARANCE GENERATION ==========
    
    var SKIN_TONES = ["brown", "lightgray", "magenta"];
    var JERSEY_COLORS = ["RED", "BLUE", "GREEN", "YELLOW", "PURPLE", "ORANGE", "WHITE", "BLACK"];
    
    /**
     * Generate appearance for a baby baller
     * Inherits some traits from parent
     * 
     * @param {Object} parentAppearance - Parent's appearance (or null)
     * @returns {Object} Generated appearance
     */
    function rollBabyAppearance(parentAppearance) {
        var appearance = {
            skin: SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)],
            jerseyColor: JERSEY_COLORS[Math.floor(Math.random() * JERSEY_COLORS.length)],
            jerseyNumber: String(Math.floor(Math.random() * 99) + 1)
        };
        
        // 70% chance to inherit parent's skin tone
        if (parentAppearance && parentAppearance.skin && Math.random() < 0.70) {
            appearance.skin = parentAppearance.skin;
        }
        
        return appearance;
    }
    
    // ========== CHILD SUPPORT CALCULATION ==========
    
    /**
     * Check if a child is born in wedlock (mother is current spouse)
     * Children born in wedlock with no other baby mamas = no child support
     * 
     * @param {Object} ctx - Player context
     * @param {string} motherName - Name of the mother
     * @returns {boolean} True if child is born in wedlock with monogamy
     */
    function isChildBornInWedlock(ctx, motherName) {
        if (!ctx || !ctx.romance || !ctx.romance.spouseName) {
            return false;
        }
        
        // Check if mother is current spouse
        if (ctx.romance.spouseName !== motherName) {
            return false;
        }
        
        // Check if player has no other baby mamas (exclusive relationship)
        var babyMamas = ctx.babyMamas || [];
        if (babyMamas.length === 0) {
            // No existing baby mamas - this will be first child in wedlock
            return true;
        }
        
        // Check if all existing baby mamas are the spouse
        for (var i = 0; i < babyMamas.length; i++) {
            if (babyMamas[i].name !== ctx.romance.spouseName) {
                // Has baby mama who is not spouse - polygamous situation
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Calculate child support cost for a baby baller
     * Higher stats = more expensive kids
     * Children born in wedlock (monogamous) = no child support
     * 
     * @param {Object} stats - Baby's stats
     * @param {Object} [ctx] - Player context (optional, for wedlock check)
     * @param {string} [motherName] - Name of the mother (optional, for wedlock check)
     * @returns {number} Total child support owed
     */
    function calculateChildSupportCost(stats, ctx, motherName) {
        // Check for wedlock exemption (monogamous marriage)
        if (ctx && motherName && isChildBornInWedlock(ctx, motherName)) {
            return 0;  // No child support for children born in wedlock
        }
        
        var baseAmount = getConfig("SUPPORT_BASE_AMOUNT", 2000);
        var perStatPoint = getConfig("SUPPORT_PER_STAT_POINT", 100);
        
        var totalStats = calculateTotalStats(stats);
        
        return baseAmount + (totalStats * perStatPoint);
    }
    
    /**
     * Calculate lump sum discount price
     */
    function calculateLumpSumPrice(totalCost) {
        var discount = getConfig("SUPPORT_LUMP_SUM_DISCOUNT", 0.25);
        return Math.floor(totalCost * (1 - discount));
    }
    
    // ========== BABY BALLER CREATION ==========
    
    /**
     * Create a new baby baller
     * 
     * @param {Object} ctx - Player context
     * @param {string} babyMamaId - NPC ID of the mother
     * @param {string} babyMamaName - Name of the mother
     * @param {boolean} monogamyBonus - Whether to apply monogamy stat bonus
     * @param {Object} projectedStats - Pre-generated stats (from doctor visit)
     * @param {Object} projectedAppearance - Pre-generated appearance (from doctor visit)
     * @returns {Object} The created baby baller
     */
    function createBabyBaller(ctx, babyMamaId, babyMamaName, monogamyBonus, projectedStats, projectedAppearance) {
        // Generate or use pre-generated data
        var stats = projectedStats || generateBabyStats(ctx.baseStats || {}, monogamyBonus);
        var appearance = projectedAppearance || rollBabyAppearance(ctx.appearance || {});
        // Pass ctx and motherName for wedlock check
        var supportCost = calculateChildSupportCost(stats, ctx, babyMamaName);
        
        var babyName = generateBabyName(ctx.name);
        var nickname = generateNickname(babyName, ctx.nickname);
        
        // Get current game day
        var gameDay = 1;
        var seasonNum = 1;
        if (LORB.SharedState && LORB.SharedState.getGameDay) {
            gameDay = LORB.SharedState.getGameDay();
        }
        if (LORB.SharedState && LORB.SharedState.getInfo) {
            var info = LORB.SharedState.getInfo();
            seasonNum = info.seasonNumber || 1;
        }
        
        var baby = {
            id: generateBabyId(),
            name: babyName,
            nickname: nickname,
            motherId: babyMamaId,
            motherName: babyMamaName,
            bornOnDay: gameDay,
            seasonBorn: seasonNum,
            
            // Stats
            stats: stats,
            
            // Progression
            level: 1,
            xp: 0,
            rep: 0,
            wins: 0,
            losses: 0,
            
            // Child Support Status
            childSupport: {
                totalOwed: supportCost,
                balance: supportCost,
                isPaidOff: false,
                dueDate: gameDay + getConfig("SUPPORT_DEADLINE_DAYS", 10),
                isOverdue: false,
                overdueDay: null  // Day when support became overdue
            },
            
            // Relationship with parent
            relationship: 75,  // Start positive
            isNemesis: false,
            adoptiveFatherId: null,
            adoptiveFatherName: null,
            
            // Appearance
            appearance: appearance,
            
            // Parenting
            parentingMode: "nurture",  // Default to good parenting
            monogamyBonus: monogamyBonus,
            
            // Streetball
            currentCourt: 1,  // Start at Middle School
            canChallenge: true,
            lastMatchDay: 0,
            streetballEarnings: 0,
            earningsToSupport: 0
        };
        
        return baby;
    }
    
    /**
     * Add baby baller to player's context
     */
    function addBabyToContext(ctx, baby) {
        if (!ctx.babyBallers) {
            ctx.babyBallers = [];
        }
        ctx.babyBallers.push(baby);
        
        // Update parenting stats
        updateParentingStats(ctx);
        
        return baby;
    }
    
    /**
     * Create or update baby mama entry
     */
    function ensureBabyMama(ctx, npcId, npcName, cityId, babyId) {
        if (!ctx.babyMamas) {
            ctx.babyMamas = [];
        }
        
        // Find existing baby mama entry
        var babyMama = null;
        for (var i = 0; i < ctx.babyMamas.length; i++) {
            if (ctx.babyMamas[i].id === npcId) {
                babyMama = ctx.babyMamas[i];
                break;
            }
        }
        
        if (!babyMama) {
            // Create new entry
            babyMama = {
                id: npcId,
                name: npcName,
                cityId: cityId,
                relationship: 50,  // Start neutral-positive
                childrenIds: [],
                childSupport: {
                    totalOwed: 0,
                    paidTotal: 0,
                    balance: 0
                },
                isNemesis: false,
                lastEventDay: 0
            };
            ctx.babyMamas.push(babyMama);
        }
        
        // Add child reference
        if (babyId && babyMama.childrenIds.indexOf(babyId) === -1) {
            babyMama.childrenIds.push(babyId);
        }
        
        return babyMama;
    }
    
    /**
     * Update parenting stats aggregate
     */
    function updateParentingStats(ctx) {
        if (!ctx.parentingStats) {
            ctx.parentingStats = {
                totalChildren: 0,
                independentChildren: 0,
                dependentChildren: 0,
                abandonedChildren: 0,
                nemesisChildren: 0,
                totalSupportPaid: 0,
                totalSupportOwed: 0,
                childrenDefeated: 0,
                defeatedByChildren: 0,
                // Oedipus/Vader nemesis matchup tracking
                nemesisMatchWins: 0,
                nemesisMatchLosses: 0
            };
        }
        
        var stats = ctx.parentingStats;
        var babies = ctx.babyBallers || [];
        
        stats.totalChildren = babies.length;
        stats.independentChildren = 0;
        stats.dependentChildren = 0;
        stats.abandonedChildren = 0;
        stats.nemesisChildren = 0;
        stats.totalSupportOwed = 0;
        
        for (var i = 0; i < babies.length; i++) {
            var baby = babies[i];
            
            if (baby.childSupport.isPaidOff) {
                stats.independentChildren++;
            } else {
                stats.dependentChildren++;
            }
            
            if (baby.parentingMode === "abandon") {
                stats.abandonedChildren++;
            }
            
            if (baby.isNemesis) {
                stats.nemesisChildren++;
            }
            
            stats.totalSupportOwed += baby.childSupport.balance;
        }
    }
    
    /**
     * Record the result of a nemesis matchup (Oedipus/Vader tracking)
     * Tracks when parent and nemesis child face off
     * 
     * @param {Object} ctx - Player context
     * @param {string} babyId - Baby baller ID
     * @param {boolean} playerWon - True if parent won
     * @returns {Object} Updated nemesis match record
     */
    function recordNemesisMatch(ctx, babyId, playerWon) {
        if (!ctx.parentingStats) updateParentingStats(ctx);
        
        // Ensure nemesis tracking fields exist (migration for old saves)
        if (typeof ctx.parentingStats.nemesisMatchWins === "undefined") {
            ctx.parentingStats.nemesisMatchWins = 0;
            ctx.parentingStats.nemesisMatchLosses = 0;
        }
        
        if (playerWon) {
            ctx.parentingStats.nemesisMatchWins++;
            ctx.parentingStats.childrenDefeated++;
        } else {
            ctx.parentingStats.nemesisMatchLosses++;
            ctx.parentingStats.defeatedByChildren++;
        }
        
        // Also track on the specific baby
        var baby = getBabyById(ctx, babyId);
        if (baby) {
            if (!baby.nemesisMatchRecord) {
                baby.nemesisMatchRecord = { wins: 0, losses: 0 };
            }
            if (playerWon) {
                baby.nemesisMatchRecord.losses++;  // Baby lost
            } else {
                baby.nemesisMatchRecord.wins++;    // Baby won
            }
        }
        
        return {
            playerRecord: {
                wins: ctx.parentingStats.nemesisMatchWins,
                losses: ctx.parentingStats.nemesisMatchLosses
            },
            babyRecord: baby ? baby.nemesisMatchRecord : null
        };
    }

    // ========== WORLD BABY BALLER REGISTRY ==========
    
    /**
     * Add baby baller to global world registry (for other players to encounter)
     */
    function addToWorldBabyBallers(baby, parentCtx) {
        if (!LORB.Persist || !LORB.Persist.readShared || !LORB.Persist.writeShared) {
            return false;
        }
        
        try {
            var registry = LORB.Persist.readShared(WORLD_BABY_BALLERS_PATH) || {};
            
            // Create snapshot for world registry
            var snapshot = {
                id: baby.id,
                parentId: parentCtx._globalId || parentCtx.name,
                parentName: parentCtx.name || "Unknown",
                name: baby.name,
                nickname: baby.nickname,
                stats: baby.stats,
                level: baby.level,
                currentCourt: baby.currentCourt,
                rep: baby.rep,
                wins: baby.wins,
                losses: baby.losses,
                appearance: baby.appearance,
                createdAt: Date.now()
            };
            
            registry[baby.id] = snapshot;
            LORB.Persist.writeShared(WORLD_BABY_BALLERS_PATH, registry);
            
            return true;
        } catch (e) {
            log(LOG_WARNING, "[BABY-BALLERS] Failed to add to world registry: " + e);
            return false;
        }
    }
    
    /**
     * Update baby baller in world registry (after level up, wins, etc.)
     */
    function updateWorldBabyBaller(baby, parentCtx) {
        return addToWorldBabyBallers(baby, parentCtx);  // Same logic, just overwrite
    }
    
    /**
     * Get baby ballers from world registry for a given court tier
     */
    function getWorldBabyBallersForCourt(courtTier) {
        if (!LORB.Persist || !LORB.Persist.readShared) {
            return [];
        }
        
        try {
            var registry = LORB.Persist.readShared(WORLD_BABY_BALLERS_PATH) || {};
            var result = [];
            
            for (var id in registry) {
                if (registry.hasOwnProperty(id)) {
                    var baby = registry[id];
                    if (baby.currentCourt === courtTier) {
                        result.push(baby);
                    }
                }
            }
            
            return result;
        } catch (e) {
            log(LOG_WARNING, "[BABY-BALLERS] Failed to read world registry: " + e);
            return [];
        }
    }
    
    // ========== CHILD SUPPORT PAYMENTS ==========
    
    /**
     * Make a child support payment for a specific baby baller
     * 
     * @param {Object} ctx - Player context
     * @param {string} babyId - Baby baller ID
     * @param {number} amount - Amount to pay
     * @returns {Object} Result { success, amountPaid, remaining, paidOff }
     */
    function makePayment(ctx, babyId, amount) {
        var baby = getBabyById(ctx, babyId);
        if (!baby) {
            return { success: false, reason: "Baby not found" };
        }
        
        // Cap payment at outstanding balance
        var actualPayment = Math.min(amount, baby.childSupport.balance);
        
        if (actualPayment <= 0) {
            return { success: false, reason: "Nothing owed" };
        }
        
        // Check if player has enough cash
        if ((ctx.cash || 0) < actualPayment) {
            return { success: false, reason: "Insufficient funds" };
        }
        
        // Process payment
        ctx.cash -= actualPayment;
        baby.childSupport.balance -= actualPayment;
        
        // Update parenting stats
        if (!ctx.parentingStats) updateParentingStats(ctx);
        ctx.parentingStats.totalSupportPaid += actualPayment;
        
        // Check if paid off
        var paidOff = false;
        var overdueResolved = false;
        if (baby.childSupport.balance <= 0) {
            baby.childSupport.balance = 0;
            baby.childSupport.isPaidOff = true;
            paidOff = true;
            
            // If was overdue, resolve it (but nemesis stays)
            if (baby.childSupport.isOverdue) {
                baby.childSupport.isOverdue = false;
                overdueResolved = true;
            }
            
            // Alignment bonus for paying off
            if (LORB.Data && LORB.Data.Alignment && LORB.Data.Alignment.adjust) {
                var alignBonus = getConfig("ALIGNMENT_LUMP_SUM", 15);
                LORB.Data.Alignment.adjust(ctx, "paid_off_support", alignBonus);
            }
        }
        
        // Update baby mama record
        var babyMama = getBabyMamaForChild(ctx, babyId);
        if (babyMama) {
            babyMama.childSupport.paidTotal += actualPayment;
            babyMama.childSupport.balance = calculateBabyMamaBalance(ctx, babyMama.id);
            
            // Improve relationship with payment
            babyMama.relationship = Math.min(100, babyMama.relationship + 2);
        }
        
        updateParentingStats(ctx);
        
        return {
            success: true,
            amountPaid: actualPayment,
            remaining: baby.childSupport.balance,
            paidOff: paidOff,
            overdueResolved: overdueResolved,
            stillNemesis: baby.isNemesis
        };
    }
    
    /**
     * Pay off entire balance for a baby baller (with lump sum discount)
     */
    function payLumpSum(ctx, babyId) {
        var baby = getBabyById(ctx, babyId);
        if (!baby) {
            return { success: false, reason: "Baby not found" };
        }
        
        var lumpSumPrice = calculateLumpSumPrice(baby.childSupport.balance);
        
        if ((ctx.cash || 0) < lumpSumPrice) {
            return { success: false, reason: "Need $" + lumpSumPrice + " for lump sum" };
        }
        
        // Track if was overdue before paying
        var wasOverdue = baby.childSupport.isOverdue;
        
        // Process lump sum payment
        ctx.cash -= lumpSumPrice;
        
        if (!ctx.parentingStats) updateParentingStats(ctx);
        ctx.parentingStats.totalSupportPaid += lumpSumPrice;
        
        baby.childSupport.balance = 0;
        baby.childSupport.isPaidOff = true;
        baby.childSupport.isOverdue = false;  // Clear overdue flag
        
        // Big alignment bonus
        if (LORB.Data && LORB.Data.Alignment && LORB.Data.Alignment.adjust) {
            var alignBonus = getConfig("ALIGNMENT_LUMP_SUM", 15);
            LORB.Data.Alignment.adjust(ctx, "lump_sum_payment", alignBonus);
        }
        
        // Update baby mama
        var babyMama = getBabyMamaForChild(ctx, babyId);
        if (babyMama) {
            babyMama.childSupport.paidTotal += lumpSumPrice;
            babyMama.childSupport.balance = calculateBabyMamaBalance(ctx, babyMama.id);
            babyMama.relationship = Math.min(100, babyMama.relationship + 10);
        }
        
        updateParentingStats(ctx);
        
        return {
            success: true,
            amountPaid: lumpSumPrice,
            savedAmount: baby.childSupport.balance - lumpSumPrice,
            paidOff: true,
            overdueResolved: wasOverdue,
            stillNemesis: baby.isNemesis
        };
    }
    
    /**
     * Process streetball winnings for a baby baller
     * While child support is owed, 50% goes to support, 50% is "spent"
     * After paid off, parent gets 10% cut (if nurturing)
     */
    function processStreetballWinnings(ctx, babyId, winnings) {
        var baby = getBabyById(ctx, babyId);
        if (!baby || winnings <= 0) {
            return { parentCut: 0, toSupport: 0, babyKept: winnings };
        }
        
        var result = {
            parentCut: 0,
            toSupport: 0,
            babyKept: 0
        };
        
        if (!baby.childSupport.isPaidOff) {
            // Still paying support: 50% to balance, 50% "spent by baby"
            var supportPct = getConfig("STREETBALL_WINNINGS_TO_SUPPORT", 0.50);
            result.toSupport = Math.floor(winnings * supportPct);
            result.babyKept = winnings - result.toSupport;
            
            // Apply to support balance
            baby.childSupport.balance = Math.max(0, baby.childSupport.balance - result.toSupport);
            baby.earningsToSupport += result.toSupport;
            
            // Check if this paid off the debt
            if (baby.childSupport.balance <= 0) {
                baby.childSupport.isPaidOff = true;
            }
        } else {
            // Child support paid off - parent gets cut based on parenting mode
            var effect = PARENTING_EFFECTS[baby.parentingMode] || PARENTING_EFFECTS.neglect;
            result.parentCut = Math.floor(winnings * effect.earningsCut);
            result.babyKept = winnings - result.parentCut;
            
            // Nemesis TAKES from you instead
            if (baby.isNemesis) {
                var penalty = getConfig("NEMESIS_EARNINGS_PENALTY", 0.05);
                var stolen = Math.floor(winnings * penalty);
                ctx.cash = Math.max(0, (ctx.cash || 0) - stolen);
                result.parentCut = -stolen;
            } else {
                ctx.cash = (ctx.cash || 0) + result.parentCut;
            }
        }
        
        baby.streetballEarnings += winnings;
        updateParentingStats(ctx);
        
        return result;
    }
    
    // ========== LOOKUP HELPERS ==========
    
    /**
     * Get baby baller by ID
     */
    function getBabyById(ctx, babyId) {
        if (!ctx.babyBallers) return null;
        for (var i = 0; i < ctx.babyBallers.length; i++) {
            if (ctx.babyBallers[i].id === babyId) {
                return ctx.babyBallers[i];
            }
        }
        return null;
    }
    
    /**
     * Get all babies for a specific baby mama
     */
    function getBabiesForMother(ctx, motherId) {
        if (!ctx.babyBallers) return [];
        var result = [];
        for (var i = 0; i < ctx.babyBallers.length; i++) {
            if (ctx.babyBallers[i].motherId === motherId) {
                result.push(ctx.babyBallers[i]);
            }
        }
        return result;
    }
    
    /**
     * Get baby mama record for a child
     */
    function getBabyMamaForChild(ctx, babyId) {
        var baby = getBabyById(ctx, babyId);
        if (!baby || !ctx.babyMamas) return null;
        
        for (var i = 0; i < ctx.babyMamas.length; i++) {
            if (ctx.babyMamas[i].id === baby.motherId) {
                return ctx.babyMamas[i];
            }
        }
        return null;
    }
    
    /**
     * Calculate total outstanding balance for a baby mama
     */
    function calculateBabyMamaBalance(ctx, babyMamaId) {
        var babies = getBabiesForMother(ctx, babyMamaId);
        var total = 0;
        for (var i = 0; i < babies.length; i++) {
            total += babies[i].childSupport.balance;
        }
        return total;
    }
    
    /**
     * Get baby mama by NPC ID
     */
    function getBabyMamaById(ctx, npcId) {
        if (!ctx.babyMamas) return null;
        for (var i = 0; i < ctx.babyMamas.length; i++) {
            if (ctx.babyMamas[i].id === npcId) {
                return ctx.babyMamas[i];
            }
        }
        return null;
    }
    
    // ========== PROGRESSION ==========
    
    /**
     * Award XP to a baby baller
     */
    function awardXp(ctx, babyId, xpAmount) {
        var baby = getBabyById(ctx, babyId);
        if (!baby) return null;
        
        baby.xp += xpAmount;
        
        // Check for level up
        var levelThresholds = getConfig("CHILD_LEVEL_XP", [0, 100, 250, 500, 1000, 2000, 4000, 7500, 12500, 20000]);
        var newLevel = 1;
        for (var i = 1; i < levelThresholds.length; i++) {
            if (baby.xp >= levelThresholds[i]) {
                newLevel = i + 1;
            }
        }
        
        var leveledUp = newLevel > baby.level;
        if (leveledUp) {
            baby.level = newLevel;
            
            // Boost a random stat on level up
            var statToBoost = STAT_NAMES[Math.floor(Math.random() * STAT_NAMES.length)];
            baby.stats[statToBoost] = Math.min(10, baby.stats[statToBoost] + 1);
        }
        
        // Update world registry
        updateWorldBabyBaller(baby, ctx);
        
        return { leveledUp: leveledUp, newLevel: baby.level, xpTotal: baby.xp };
    }
    
    /**
     * Add rep to baby baller and check for court tier promotion
     */
    function awardRep(ctx, babyId, repAmount) {
        var baby = getBabyById(ctx, babyId);
        if (!baby) return null;
        
        baby.rep += repAmount;
        
        // Check for court tier promotion
        var tierByRep = getConfig("COURT_TIER_BY_REP", { 0: 1, 100: 2, 300: 3, 600: 4, 1000: 5 });
        var newTier = 1;
        for (var threshold in tierByRep) {
            if (tierByRep.hasOwnProperty(threshold) && baby.rep >= parseInt(threshold)) {
                newTier = tierByRep[threshold];
            }
        }
        
        var promoted = newTier > baby.currentCourt;
        if (promoted) {
            baby.currentCourt = newTier;
        }
        
        // Update world registry
        updateWorldBabyBaller(baby, ctx);
        
        return { promoted: promoted, newCourt: baby.currentCourt, repTotal: baby.rep };
    }
    
    // ========== RELATIONSHIP MANAGEMENT ==========
    
    /**
     * Adjust relationship with a baby baller
     */
    function adjustRelationship(ctx, babyId, change, reason) {
        var baby = getBabyById(ctx, babyId);
        if (!baby) return null;
        
        baby.relationship = Math.max(-100, Math.min(100, baby.relationship + change));
        
        // Check for nemesis threshold
        var nemesisThreshold = getConfig("NEMESIS_THRESHOLD", -50);
        if (baby.relationship <= nemesisThreshold && !baby.isNemesis) {
            baby.isNemesis = true;
            if (!ctx.parentingStats) updateParentingStats(ctx);
            ctx.parentingStats.nemesisChildren++;
        }
        
        // Check for adoption threshold (NPC "steals" your kid)
        var adoptionThreshold = getConfig("ADOPTION_THRESHOLD", -75);
        if (baby.relationship <= adoptionThreshold && !baby.adoptiveFatherId) {
            // This will be handled by random events
        }
        
        return { newRelationship: baby.relationship, isNemesis: baby.isNemesis };
    }
    
    /**
     * Set parenting mode for a baby baller
     */
    function setParentingMode(ctx, babyId, mode) {
        var baby = getBabyById(ctx, babyId);
        if (!baby) return false;
        
        if (mode !== "nurture" && mode !== "neglect" && mode !== "abandon") {
            return false;
        }
        
        var oldMode = baby.parentingMode;
        baby.parentingMode = mode;
        
        // Alignment impact
        if (LORB.Data && LORB.Data.Alignment && LORB.Data.Alignment.adjust) {
            if (mode === "abandon" && oldMode !== "abandon") {
                LORB.Data.Alignment.adjust(ctx, "abandon_child", getConfig("ALIGNMENT_ABANDON", -25));
            } else if (mode === "neglect" && oldMode === "nurture") {
                LORB.Data.Alignment.adjust(ctx, "neglect_child", getConfig("ALIGNMENT_NEGLECT", -5));
            } else if (mode === "nurture" && oldMode !== "nurture") {
                LORB.Data.Alignment.adjust(ctx, "nurture_child", getConfig("ALIGNMENT_NURTURE", 10));
            }
        }
        
        updateParentingStats(ctx);
        return true;
    }
    
    // ========== DEADLINE / OVERDUE SYSTEM ==========
    
    /**
     * Check if a baby's child support is approaching deadline
     * @param {Object} baby - Baby baller object
     * @param {number} currentDay - Current game day
     * @returns {Object} Deadline status info
     */
    function getDeadlineStatus(baby, currentDay) {
        if (!baby || !baby.childSupport) {
            return { status: "unknown", daysRemaining: 0 };
        }
        
        if (baby.childSupport.isPaidOff) {
            return { status: "paid", daysRemaining: 0 };
        }
        
        if (baby.childSupport.isOverdue) {
            var daysOverdue = currentDay - baby.childSupport.dueDate;
            return { status: "overdue", daysOverdue: daysOverdue, daysRemaining: 0 };
        }
        
        var daysRemaining = baby.childSupport.dueDate - currentDay;
        var warningDays = getConfig("SUPPORT_WARNING_DAYS", 3);
        
        if (daysRemaining <= 0) {
            return { status: "due_today", daysRemaining: 0 };
        } else if (daysRemaining <= warningDays) {
            return { status: "warning", daysRemaining: daysRemaining };
        } else {
            return { status: "ok", daysRemaining: daysRemaining };
        }
    }
    
    /**
     * Process daily deadline checks for all babies
     * Called from hub.js on each game day
     * @param {Object} ctx - Player context
     * @param {number} currentDay - Current game day
     * @returns {Object} Results of daily processing
     */
    function processDeadlineChecks(ctx, currentDay) {
        if (!ctx.babyBallers || ctx.babyBallers.length === 0) {
            return { processed: 0, newOverdue: [], dailyDecay: [] };
        }
        
        var results = {
            processed: 0,
            newOverdue: [],     // Babies that just became overdue
            dailyDecay: [],     // Babies with ongoing overdue decay
            warnings: [],       // Babies approaching deadline
            newNemeses: []      // Babies that just became nemeses
        };
        
        for (var i = 0; i < ctx.babyBallers.length; i++) {
            var baby = ctx.babyBallers[i];
            results.processed++;
            
            // Skip paid off children
            if (baby.childSupport.isPaidOff) {
                continue;
            }
            
            var deadlineStatus = getDeadlineStatus(baby, currentDay);
            
            if (deadlineStatus.status === "warning") {
                results.warnings.push({
                    baby: baby,
                    daysRemaining: deadlineStatus.daysRemaining
                });
            } else if (deadlineStatus.status === "due_today" || 
                      (deadlineStatus.status === "ok" && deadlineStatus.daysRemaining <= 0)) {
                // Deadline just passed - trigger overdue
                if (!baby.childSupport.isOverdue) {
                    var overdueResult = triggerOverdue(ctx, baby.id, currentDay);
                    if (overdueResult.success) {
                        results.newOverdue.push({
                            baby: baby,
                            relationshipHit: overdueResult.relationshipHit,
                            alignmentHit: overdueResult.alignmentHit
                        });
                        if (overdueResult.becameNemesis) {
                            results.newNemeses.push(baby);
                        }
                    }
                }
            } else if (deadlineStatus.status === "overdue") {
                // Already overdue - apply daily decay
                var decayResult = applyDailyOverdueDecay(ctx, baby.id);
                if (decayResult.success) {
                    results.dailyDecay.push({
                        baby: baby,
                        relationshipDecay: decayResult.relationshipDecay,
                        alignmentDecay: decayResult.alignmentDecay
                    });
                    if (decayResult.becameNemesis) {
                        results.newNemeses.push(baby);
                    }
                }
            }
        }
        
        return results;
    }
    
    /**
     * Trigger overdue status for a baby
     * Called when deadline passes without full payment
     * @param {Object} ctx - Player context
     * @param {string} babyId - Baby baller ID
     * @param {number} currentDay - Current game day
     * @returns {Object} Result of triggering overdue
     */
    function triggerOverdue(ctx, babyId, currentDay) {
        var baby = getBabyById(ctx, babyId);
        if (!baby) {
            return { success: false, reason: "Baby not found" };
        }
        
        if (baby.childSupport.isPaidOff) {
            return { success: false, reason: "Already paid off" };
        }
        
        if (baby.childSupport.isOverdue) {
            return { success: false, reason: "Already overdue" };
        }
        
        // Mark as overdue
        baby.childSupport.isOverdue = true;
        baby.childSupport.overdueDay = currentDay;
        
        // Apply massive relationship penalty
        var relationshipPenalty = getConfig("OVERDUE_RELATIONSHIP_PENALTY", -50);
        var oldRelationship = baby.relationship;
        baby.relationship = Math.max(-100, baby.relationship + relationshipPenalty);
        
        // Apply alignment penalty
        var alignmentPenalty = getConfig("OVERDUE_ALIGNMENT_PENALTY", -30);
        if (LORB.Data && LORB.Data.Alignment && LORB.Data.Alignment.adjust) {
            LORB.Data.Alignment.adjust(ctx, "child_support_overdue", alignmentPenalty);
        }
        
        // Check for nemesis conversion
        var becameNemesis = false;
        var nemesisThreshold = getConfig("NEMESIS_THRESHOLD", -50);
        if (baby.relationship <= nemesisThreshold && !baby.isNemesis) {
            baby.isNemesis = true;
            becameNemesis = true;
            if (!ctx.parentingStats) updateParentingStats(ctx);
            ctx.parentingStats.nemesisChildren = (ctx.parentingStats.nemesisChildren || 0) + 1;
        }
        
        // Update baby mama relationship too
        var babyMama = getBabyMamaForChild(ctx, babyId);
        if (babyMama) {
            babyMama.relationship = Math.max(-100, babyMama.relationship + Math.floor(relationshipPenalty / 2));
        }
        
        updateParentingStats(ctx);
        
        return {
            success: true,
            relationshipHit: relationshipPenalty,
            alignmentHit: alignmentPenalty,
            newRelationship: baby.relationship,
            becameNemesis: becameNemesis
        };
    }
    
    /**
     * Apply daily decay for babies with overdue support
     * @param {Object} ctx - Player context
     * @param {string} babyId - Baby baller ID
     * @returns {Object} Result of decay application
     */
    function applyDailyOverdueDecay(ctx, babyId) {
        var baby = getBabyById(ctx, babyId);
        if (!baby || !baby.childSupport.isOverdue) {
            return { success: false, reason: "Not overdue" };
        }
        
        // Daily relationship decay
        var relationshipDecay = getConfig("DAILY_OVERDUE_RELATIONSHIP_DECAY", -5);
        baby.relationship = Math.max(-100, baby.relationship + relationshipDecay);
        
        // Daily alignment decay
        var alignmentDecay = getConfig("DAILY_OVERDUE_ALIGNMENT_DECAY", -2);
        if (LORB.Data && LORB.Data.Alignment && LORB.Data.Alignment.adjust) {
            LORB.Data.Alignment.adjust(ctx, "overdue_daily_decay", alignmentDecay);
        }
        
        // Check for nemesis conversion
        var becameNemesis = false;
        var nemesisThreshold = getConfig("NEMESIS_THRESHOLD", -50);
        if (baby.relationship <= nemesisThreshold && !baby.isNemesis) {
            baby.isNemesis = true;
            becameNemesis = true;
            if (!ctx.parentingStats) updateParentingStats(ctx);
            ctx.parentingStats.nemesisChildren = (ctx.parentingStats.nemesisChildren || 0) + 1;
        }
        
        return {
            success: true,
            relationshipDecay: relationshipDecay,
            alignmentDecay: alignmentDecay,
            newRelationship: baby.relationship,
            becameNemesis: becameNemesis
        };
    }
    
    /**
     * Calculate nemesis stats for a baby when facing their deadbeat parent
     * @param {Object} baby - Baby baller object
     * @returns {Object} Enhanced stats for nemesis matchup
     */
    function getNemesisStats(baby) {
        if (!baby || !baby.isNemesis) {
            return baby ? baby.stats : null;
        }
        
        var multiplier = getConfig("NEMESIS_STAT_MULTIPLIER", 1.75);
        var flatBonus = getConfig("NEMESIS_RAGE_BONUS", 20);
        
        var boostedStats = {};
        for (var i = 0; i < STAT_NAMES.length; i++) {
            var statName = STAT_NAMES[i];
            var baseStat = baby.stats[statName] || 5;
            // Apply multiplier and flat bonus, cap at 10 (or 15 for nemesis)
            boostedStats[statName] = Math.min(15, Math.floor(baseStat * multiplier) + Math.floor(flatBonus / 10));
        }
        
        return boostedStats;
    }
    
    /**
     * Check if a matchup is a nemesis vs parent situation
     * @param {Object} ctx - Player context
     * @param {string} opponentBabyId - The baby baller being faced
     * @returns {boolean} True if this is a nemesis matchup
     */
    function isNemesisMatchup(ctx, opponentBabyId) {
        if (!ctx.babyBallers) return false;
        
        for (var i = 0; i < ctx.babyBallers.length; i++) {
            if (ctx.babyBallers[i].id === opponentBabyId && ctx.babyBallers[i].isNemesis) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Get all babies with overdue support
     * @param {Object} ctx - Player context
     * @returns {Array} Array of overdue babies
     */
    function getOverdueBabies(ctx) {
        if (!ctx.babyBallers) return [];
        
        var overdue = [];
        for (var i = 0; i < ctx.babyBallers.length; i++) {
            if (ctx.babyBallers[i].childSupport.isOverdue) {
                overdue.push(ctx.babyBallers[i]);
            }
        }
        return overdue;
    }
    
    /**
     * Get all babies approaching deadline
     * @param {Object} ctx - Player context
     * @param {number} currentDay - Current game day
     * @returns {Array} Array of babies with warnings
     */
    function getWarningBabies(ctx, currentDay) {
        if (!ctx.babyBallers) return [];
        
        var warnings = [];
        for (var i = 0; i < ctx.babyBallers.length; i++) {
            var baby = ctx.babyBallers[i];
            var status = getDeadlineStatus(baby, currentDay);
            if (status.status === "warning") {
                warnings.push({
                    baby: baby,
                    daysRemaining: status.daysRemaining
                });
            }
        }
        return warnings;
    }
    
    /**
     * Resolve overdue status by paying off
     * Called when player pays off an overdue baby's support
     * @param {Object} ctx - Player context
     * @param {string} babyId - Baby baller ID
     * @returns {Object} Result of resolution
     */
    function resolveOverdue(ctx, babyId) {
        var baby = getBabyById(ctx, babyId);
        if (!baby) {
            return { success: false, reason: "Baby not found" };
        }
        
        // Note: Nemesis status is PERMANENT - paying off doesn't fix the relationship
        // The child remembers being abandoned
        baby.childSupport.isOverdue = false;
        
        // Small relationship recovery for finally paying
        var recovery = 10;  // Much smaller than the penalty
        baby.relationship = Math.min(100, baby.relationship + recovery);
        
        return {
            success: true,
            stillNemesis: baby.isNemesis,
            newRelationship: baby.relationship,
            message: baby.isNemesis 
                ? "Paid off, but " + baby.name + " hasn't forgotten being abandoned..."
                : "Child support resolved. Relationship improving."
        };
    }
    
    // ========== DISPLAY HELPERS ==========
    
    /**
     * Get court tier display name
     */
    function getCourtTierName(tier) {
        return COURT_TIER_NAMES[tier] || "Unknown";
    }
    
    /**
     * Get child support status string
     */
    function getSupportStatusString(baby, currentDay) {
        if (baby.childSupport.isPaidOff) {
            return "\1gINDEPENDENT\1n";
        }
        
        var balance = "$" + baby.childSupport.balance;
        
        if (baby.childSupport.isOverdue) {
            return "\1h\1r" + balance + " PAST DUE!\1n";
        }
        
        // Check deadline status if currentDay provided
        if (currentDay !== undefined) {
            var status = getDeadlineStatus(baby, currentDay);
            if (status.status === "warning") {
                return "\1h\1y" + balance + " (" + status.daysRemaining + " days left!)\1n";
            } else if (status.status === "due_today") {
                return "\1h\1r" + balance + " DUE TODAY!\1n";
            }
        }
        
        return "\1y" + balance + " owed\1n";
    }
    
    /**
     * Get relationship status string
     */
    function getRelationshipString(baby) {
        if (baby.isNemesis) {
            return "\1h\1rNEMESIS\1n";
        }
        if (baby.relationship >= 75) {
            return "\1gLoving\1n";
        }
        if (baby.relationship >= 50) {
            return "\1cFriendly\1n";
        }
        if (baby.relationship >= 25) {
            return "\1yNeutral\1n";
        }
        if (baby.relationship >= 0) {
            return "\1yDistant\1n";
        }
        return "\1rHostile\1n";
    }
    
    // ========== EXPORT ==========
    
    if (typeof LORB === "undefined") {
        throw new Error("LORB namespace not defined - load boot.js first");
    }
    
    if (!LORB.Data) LORB.Data = {};
    
    LORB.Data.BabyBallers = {
        // Constants
        STAT_NAMES: STAT_NAMES,
        COURT_TIER_NAMES: COURT_TIER_NAMES,
        PARENTING_EFFECTS: PARENTING_EFFECTS,
        
        // Stat generation
        generateBabyStats: generateBabyStats,
        calculateTotalStats: calculateTotalStats,
        
        // Appearance
        rollBabyAppearance: rollBabyAppearance,
        
        // Name generation
        generateBabyName: generateBabyName,
        generateNickname: generateNickname,
        
        // Child support
        calculateChildSupportCost: calculateChildSupportCost,
        calculateLumpSumPrice: calculateLumpSumPrice,
        isChildBornInWedlock: isChildBornInWedlock,
        makePayment: makePayment,
        payLumpSum: payLumpSum,
        processStreetballWinnings: processStreetballWinnings,
        
        // Creation
        createBabyBaller: createBabyBaller,
        addBabyToContext: addBabyToContext,
        ensureBabyMama: ensureBabyMama,
        updateParentingStats: updateParentingStats,
        recordNemesisMatch: recordNemesisMatch,
        
        // World registry
        addToWorldBabyBallers: addToWorldBabyBallers,
        updateWorldBabyBaller: updateWorldBabyBaller,
        getWorldBabyBallersForCourt: getWorldBabyBallersForCourt,
        
        // Lookups
        getBabyById: getBabyById,
        getBabiesForMother: getBabiesForMother,
        getBabyMamaForChild: getBabyMamaForChild,
        getBabyMamaById: getBabyMamaById,
        calculateBabyMamaBalance: calculateBabyMamaBalance,
        
        // Progression
        awardXp: awardXp,
        awardRep: awardRep,
        
        // Relationships
        adjustRelationship: adjustRelationship,
        setParentingMode: setParentingMode,
        
        // Deadline / Overdue system
        getDeadlineStatus: getDeadlineStatus,
        processDeadlineChecks: processDeadlineChecks,
        triggerOverdue: triggerOverdue,
        applyDailyOverdueDecay: applyDailyOverdueDecay,
        getNemesisStats: getNemesisStats,
        isNemesisMatchup: isNemesisMatchup,
        getOverdueBabies: getOverdueBabies,
        getWarningBabies: getWarningBabies,
        resolveOverdue: resolveOverdue,
        
        // Display helpers
        getCourtTierName: getCourtTierName,
        getSupportStatusString: getSupportStatusString,
        getRelationshipString: getRelationshipString
    };
    
})();
