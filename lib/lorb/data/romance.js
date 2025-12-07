/**
 * romance.js - Romance & Marriage System for LORB
 * 
 * Handles:
 * - Player romance state (affection per NPC, daily flirt count)
 * - Global marriage registry (NPCs can only marry one player)
 * - Flirt mechanics (success/fail/neutral outcomes)
 * - Status progression (stranger → spouse)
 * - Marriage perks
 * 
 * Based on Romance_System.md design spec.
 */
(function() {
    "use strict";
    
    // ========== CONSTANTS ==========
    // These use LORB.Config when available, with fallbacks for testing
    
    /**
     * Get max flirts per day from config or default
     */
    function getMaxFlirtsPerDay() {
        if (LORB.Config && LORB.Config.ROMANCE && LORB.Config.ROMANCE.MAX_FLIRTS_PER_DAY) {
            return LORB.Config.ROMANCE.MAX_FLIRTS_PER_DAY;
        }
        return 3; // Fallback default
    }
    
    /**
     * Get rarity weights from config or default
     */
    function getRarityWeights() {
        if (LORB.Config && LORB.Config.ROMANCE && LORB.Config.ROMANCE.RARITY_WEIGHTS) {
            return LORB.Config.ROMANCE.RARITY_WEIGHTS;
        }
        return { common: 5, uncommon: 3, rare: 1 }; // Fallback default
    }
    
    // Affection thresholds for status progression
    var STATUS_THRESHOLDS = {
        stranger: 0,
        acquaintance: 5,
        crush: 20,
        partner: 40,
        fiance: 70,
        spouse: 90  // Requires proposal after reaching this
    };
    
    // Status display names
    var STATUS_NAMES = {
        stranger: "Stranger",
        acquaintance: "Acquaintance",
        crush: "Crush",
        partner: "Partner",
        fiance: "Fiancé(e)",
        spouse: "Spouse"
    };
    
    // Flirt outcome affection changes
    var FLIRT_OUTCOMES = {
        success: { min: 8, max: 12 },
        neutral: { min: 1, max: 3 },
        fail: { min: -4, max: -2 }
    };
    
    // Marriage perks (v1: simple)
    var MARRIAGE_PERKS = {
        repMultiplier: 1.05,      // +5% rep gains
        dailyStaminaRestore: 1,   // Restore 1 stamina per day
        giftChance: 0.1           // 10% chance of gift event
    };
    
    // JSON-DB path for global marriage registry
    var MARRIAGE_REGISTRY_PATH = "lorb.marriages";
    
    // ========== PLAYER ROMANCE STATE ==========
    
    /**
     * Initialize romance state on a player context if not present.
     * Call this when loading a player.
     */
    function initPlayerRomance(ctx) {
        if (!ctx) return;
        
        if (!ctx.romance) {
            ctx.romance = {
                dailyFlirtCount: 0,
                lastFlirtDay: 0,
                relationships: {},
                spouseName: null,
                spouseCityId: null
            };
        }
        
        return ctx.romance;
    }
    
    /**
     * Reset daily flirt count if it's a new day.
     */
    function resetDailyFlirtsIfNeeded(ctx, currentDay) {
        if (!ctx || !ctx.romance) return;
        
        if (ctx.romance.lastFlirtDay !== currentDay) {
            ctx.romance.dailyFlirtCount = 0;
            ctx.romance.lastFlirtDay = currentDay;
        }
    }
    
    /**
     * Check if player can flirt today.
     */
    function canFlirt(ctx) {
        if (!ctx || !ctx.romance) return false;
        return ctx.romance.dailyFlirtCount < getMaxFlirtsPerDay();
    }
    
    /**
     * Get remaining flirts for today.
     */
    function getRemainingFlirts(ctx) {
        if (!ctx || !ctx.romance) return 0;
        return Math.max(0, getMaxFlirtsPerDay() - ctx.romance.dailyFlirtCount);
    }
    
    /**
     * Consume a flirt action.
     */
    function useFlirt(ctx) {
        if (!ctx || !ctx.romance) return;
        ctx.romance.dailyFlirtCount++;
    }
    
    /**
     * Get or create relationship with an NPC.
     */
    function getRelationship(ctx, npcName) {
        if (!ctx || !ctx.romance || !npcName) return null;
        
        if (!ctx.romance.relationships[npcName]) {
            ctx.romance.relationships[npcName] = {
                affection: 0,
                status: "stranger",
                cityId: null,
                lastInteractionDay: 0
            };
        }
        
        return ctx.romance.relationships[npcName];
    }
    
    /**
     * Get status based on affection level.
     */
    function getStatusFromAffection(affection) {
        if (affection >= STATUS_THRESHOLDS.fiance) return "fiance";
        if (affection >= STATUS_THRESHOLDS.partner) return "partner";
        if (affection >= STATUS_THRESHOLDS.crush) return "crush";
        if (affection >= STATUS_THRESHOLDS.acquaintance) return "acquaintance";
        return "stranger";
    }
    
    /**
     * Update relationship status based on current affection.
     * Note: "spouse" status is only set via marriage, not automatic.
     */
    function updateStatus(relationship) {
        if (!relationship) return;
        
        // Don't downgrade from spouse
        if (relationship.status === "spouse") return;
        
        relationship.status = getStatusFromAffection(relationship.affection);
    }
    
    /**
     * Check if player is married.
     */
    function isMarried(ctx) {
        return ctx && ctx.romance && ctx.romance.spouseName;
    }
    
    /**
     * Get spouse name.
     */
    function getSpouseName(ctx) {
        return (ctx && ctx.romance) ? ctx.romance.spouseName : null;
    }
    
    // ========== NPC SELECTION ==========
    
    /**
     * Get eligible NPCs for the current city.
     * Filters out globally married NPCs.
     */
    function getEligibleNPCs(city) {
        if (!city || !city.bachelorettes) return [];
        
        var eligible = [];
        var marriages = loadMarriageRegistry();
        
        for (var i = 0; i < city.bachelorettes.length; i++) {
            var npc = city.bachelorettes[i];
            if (!isNPCMarried(npc.name, marriages)) {
                eligible.push(npc);
            }
        }
        
        return eligible;
    }
    
    /**
     * Pick a random NPC using rarity weighting.
     */
    function pickRandomNPC(eligibleNPCs) {
        if (!eligibleNPCs || eligibleNPCs.length === 0) return null;
        
        var weights = getRarityWeights();
        
        // Build weighted pool
        var pool = [];
        for (var i = 0; i < eligibleNPCs.length; i++) {
            var npc = eligibleNPCs[i];
            var weight = weights[npc.rarity] || weights.common;
            for (var w = 0; w < weight; w++) {
                pool.push(npc);
            }
        }
        
        if (pool.length === 0) return eligibleNPCs[0];
        
        var idx = Math.floor(Math.random() * pool.length);
        return pool[idx];
    }
    
    // ========== FLIRT MECHANICS ==========
    
    /**
     * Calculate flirt success chance.
     * Returns 0.0 - 1.0
     */
    function calculateFlirtChance(ctx, relationship) {
        var base = 0.4;
        
        // Player rep bonus (assuming rep is 0-100 range)
        var rep = (ctx && ctx.rep) ? ctx.rep : 0;
        base += rep * 0.002;  // +0.2% per rep point
        
        // Status modifiers
        if (relationship) {
            switch (relationship.status) {
                case "partner":
                case "fiance":
                    base += 0.15;
                    break;
                case "crush":
                    base += 0.10;
                    break;
                case "acquaintance":
                    base += 0.05;
                    break;
                case "stranger":
                    base -= 0.05;
                    break;
            }
        }
        
        // City charm bonus (if implemented)
        // base += getCityCharmBonus(ctx);
        
        // Clamp to reasonable range
        return Math.max(0.1, Math.min(0.9, base));
    }
    
    /**
     * Resolve a flirt attempt.
     * Returns { outcome: "success"|"neutral"|"fail", affectionChange: N }
     */
    function resolveFlirt(ctx, relationship) {
        var chance = calculateFlirtChance(ctx, relationship);
        var roll = Math.random();
        
        var outcome;
        if (roll < chance * 0.7) {
            // Success (70% of success chance)
            outcome = "success";
        } else if (roll < chance) {
            // Neutral (remaining 30% of success chance)
            outcome = "neutral";
        } else {
            // Fail
            outcome = "fail";
        }
        
        // Calculate affection change
        var range = FLIRT_OUTCOMES[outcome];
        var change = range.min + Math.floor(Math.random() * (range.max - range.min + 1));
        
        return {
            outcome: outcome,
            affectionChange: change
        };
    }
    
    /**
     * Apply affection change to relationship.
     */
    function applyAffection(relationship, change) {
        if (!relationship) return;
        
        relationship.affection = Math.max(0, Math.min(100, relationship.affection + change));
        updateStatus(relationship);
    }
    
    // ========== MARRIAGE REGISTRY (Global State) ==========
    
    /**
     * Load the global marriage registry from JSON-DB.
     */
    function loadMarriageRegistry() {
        if (!LORB.Persist || !LORB.Persist.readShared) {
            return {};
        }
        
        try {
            var registry = LORB.Persist.readShared(MARRIAGE_REGISTRY_PATH);
            return registry || {};
        } catch (e) {
            log(LOG_WARNING, "[ROMANCE] Failed to load marriage registry: " + e);
            return {};
        }
    }
    
    /**
     * Save the global marriage registry to JSON-DB.
     */
    function saveMarriageRegistry(registry) {
        if (!LORB.Persist || !LORB.Persist.writeShared) {
            return false;
        }
        
        try {
            LORB.Persist.writeShared(MARRIAGE_REGISTRY_PATH, registry);
            return true;
        } catch (e) {
            log(LOG_ERR, "[ROMANCE] Failed to save marriage registry: " + e);
            return false;
        }
    }
    
    /**
     * Check if an NPC is already married globally.
     */
    function isNPCMarried(npcName, registry) {
        if (!registry) registry = loadMarriageRegistry();
        return registry && registry[npcName] && registry[npcName].spousePlayerId;
    }
    
    /**
     * Get who an NPC is married to.
     */
    function getNPCSpouse(npcName) {
        var registry = loadMarriageRegistry();
        if (registry && registry[npcName]) {
            return registry[npcName];
        }
        return null;
    }
    
    /**
     * Attempt to marry an NPC.
     * Returns { success: boolean, reason: string }
     */
    function proposeMarriage(ctx, npcName, cityId) {
        if (!ctx || !ctx.romance || !npcName) {
            return { success: false, reason: "Invalid state" };
        }
        
        // Check if player is already married
        if (ctx.romance.spouseName) {
            return { success: false, reason: "You are already married to " + ctx.romance.spouseName };
        }
        
        // Check relationship status
        var rel = getRelationship(ctx, npcName);
        if (!rel || rel.status !== "fiance") {
            return { success: false, reason: "Your bond is not strong enough yet" };
        }
        
        // Check global marriage lock
        var registry = loadMarriageRegistry();
        if (isNPCMarried(npcName, registry)) {
            var existingMarriage = registry[npcName];
            return { success: false, reason: npcName + " is already committed to someone else" };
        }
        
        // Get player ID for registry
        var playerId = "unknown";
        if (LORB.Persist && LORB.Persist.getGlobalPlayerId) {
            playerId = LORB.Persist.getGlobalPlayerId();
        } else if (ctx.playerId) {
            playerId = ctx.playerId;
        }
        
        // Get current game day
        var gameDay = 1;
        if (LORB.SharedState && LORB.SharedState.getGameDay) {
            gameDay = LORB.SharedState.getGameDay();
        }
        
        // Lock NPC globally
        registry[npcName] = {
            spousePlayerId: playerId,
            spousePlayerName: ctx.name || ctx.alias || "Unknown",
            cityId: cityId,
            marriedOnDay: gameDay
        };
        
        if (!saveMarriageRegistry(registry)) {
            return { success: false, reason: "Failed to save marriage (try again)" };
        }
        
        // Update player state
        ctx.romance.spouseName = npcName;
        ctx.romance.spouseCityId = cityId;
        rel.status = "spouse";
        
        return { success: true, reason: "accepted" };
    }
    
    // ========== MARRIAGE PERKS ==========
    
    /**
     * Apply daily spouse perks (call during daily reset).
     */
    function applyDailySpousePerks(ctx) {
        if (!isMarried(ctx)) return null;
        
        var perks = [];
        
        // Stamina restore
        if (MARRIAGE_PERKS.dailyStaminaRestore > 0) {
            // This would integrate with whatever stamina system exists
            perks.push("stamina_restore");
        }
        
        // Gift event chance
        if (Math.random() < MARRIAGE_PERKS.giftChance) {
            perks.push("gift_event");
        }
        
        return perks.length > 0 ? perks : null;
    }
    
    /**
     * Get rep multiplier for married players.
     */
    function getRepMultiplier(ctx) {
        if (!isMarried(ctx)) return 1.0;
        return MARRIAGE_PERKS.repMultiplier;
    }
    
    // ========== SEASON RESET ==========
    
    /**
     * Clear all romance state for season reset.
     * Called by season reset logic.
     */
    function clearPlayerRomance(ctx) {
        if (!ctx) return;
        
        ctx.romance = {
            dailyFlirtCount: 0,
            lastFlirtDay: 0,
            relationships: {},
            spouseName: null,
            spouseCityId: null
        };
    }
    
    /**
     * Clear global marriage registry for season reset.
     */
    function clearMarriageRegistry() {
        return saveMarriageRegistry({});
    }
    
    // ========== UTILITIES ==========
    
    /**
     * Get display status name.
     */
    function getStatusDisplayName(status) {
        return STATUS_NAMES[status] || "Unknown";
    }
    
    /**
     * Get affection as percentage for display.
     */
    function getAffectionPercent(relationship) {
        if (!relationship) return 0;
        return Math.floor(relationship.affection);
    }
    
    /**
     * Get all NPCs player has relationships with.
     */
    function getAllRelationships(ctx) {
        if (!ctx || !ctx.romance || !ctx.romance.relationships) return [];
        
        var list = [];
        var rels = ctx.romance.relationships;
        for (var name in rels) {
            if (rels.hasOwnProperty(name)) {
                list.push({
                    name: name,
                    affection: rels[name].affection,
                    status: rels[name].status,
                    cityId: rels[name].cityId
                });
            }
        }
        
        // Sort by affection descending
        list.sort(function(a, b) { return b.affection - a.affection; });
        
        return list;
    }
    
    // ========== EXPORT ==========
    
    if (typeof LORB === "undefined") {
        throw new Error("LORB namespace not defined - load boot.js first");
    }
    
    if (!LORB.Data) LORB.Data = {};
    
    LORB.Data.Romance = {
        // Constants (accessed via getters for config integration)
        STATUS_THRESHOLDS: STATUS_THRESHOLDS,
        STATUS_NAMES: STATUS_NAMES,
        getRarityWeights: getRarityWeights,
        getMaxFlirtsPerDay: getMaxFlirtsPerDay,
        MARRIAGE_PERKS: MARRIAGE_PERKS,
        
        // Player state
        initPlayerRomance: initPlayerRomance,
        resetDailyFlirtsIfNeeded: resetDailyFlirtsIfNeeded,
        canFlirt: canFlirt,
        getRemainingFlirts: getRemainingFlirts,
        useFlirt: useFlirt,
        getRelationship: getRelationship,
        updateStatus: updateStatus,
        isMarried: isMarried,
        getSpouseName: getSpouseName,
        clearPlayerRomance: clearPlayerRomance,
        
        // NPC selection
        getEligibleNPCs: getEligibleNPCs,
        pickRandomNPC: pickRandomNPC,
        
        // Flirt mechanics
        calculateFlirtChance: calculateFlirtChance,
        resolveFlirt: resolveFlirt,
        applyAffection: applyAffection,
        
        // Marriage
        isNPCMarried: isNPCMarried,
        getNPCSpouse: getNPCSpouse,
        proposeMarriage: proposeMarriage,
        clearMarriageRegistry: clearMarriageRegistry,
        
        // Perks
        applyDailySpousePerks: applyDailySpousePerks,
        getRepMultiplier: getRepMultiplier,
        
        // Utilities
        getStatusDisplayName: getStatusDisplayName,
        getAffectionPercent: getAffectionPercent,
        getAllRelationships: getAllRelationships
    };
    
})();
