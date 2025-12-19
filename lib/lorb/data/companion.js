/**
 * companion.js - Traveling Companion System for LORB
 * 
 * Handles:
 * - Flying relationships to your current city (buy plane tickets)
 * - Setting/clearing traveling companion
 * - Companion date activities (dinner, club)
 * - Higher pregnancy chance with companions
 * - Twins/triplets only possible with companions
 * 
 * A traveling companion travels with you to any city, allowing
 * you to build the relationship regardless of their home city.
 */
(function() {
    // NOTE: Do not use "use strict" - Synchronet color codes use octal-like \1 escapes
    
    // ========== CONFIG HELPERS ==========
    
    function getConfig(section, key, defaultValue) {
        if (typeof LORB !== "undefined" && LORB.Config) {
            if (section && LORB.Config[section]) {
                var value = LORB.Config[section][key];
                if (value !== undefined) return value;
            } else if (!section) {
                var value = LORB.Config[key];
                if (value !== undefined) return value;
            }
        }
        return defaultValue;
    }
    
    function getTravelConfig(key, defaultValue) {
        return getConfig("TRAVELING_COMPANION", key, defaultValue);
    }
    
    function getBabyConfig(key, defaultValue) {
        return getConfig("BABY_BALLERS", key, defaultValue);
    }
    
    // ========== CORE FUNCTIONS ==========
    
    /**
     * Ensure companion data structure exists on context
     * @param {Object} ctx - Player context
     */
    function ensureCompanionData(ctx) {
        if (!ctx.travelingCompanion) {
            ctx.travelingCompanion = {
                npcId: null,
                npcName: null,
                flightPurchasedDay: null,
                datesThisDay: 0,
                lastDateDay: null
            };
        }
    }
    
    /**
     * Check if player can invite someone as traveling companion
     * @param {Object} ctx - Player context
     * @param {Object} relationship - Relationship data from romance system
     * @returns {Object} - { canInvite, reason }
     */
    function canInviteCompanion(ctx, relationship) {
        var minRelationship = getTravelConfig("MIN_RELATIONSHIP_TO_INVITE", 1);
        
        if (!relationship) {
            return { canInvite: false, reason: "No relationship data" };
        }
        
        // Check affection level
        var affection = relationship.affection || 0;
        if (affection < minRelationship) {
            return { 
                canInvite: false, 
                reason: "Need at least " + minRelationship + " affection (you have " + affection + ")" 
            };
        }
        
        // Check if they're already someone else's companion (would need global registry)
        // For now, allow anyone with sufficient affection
        
        return { canInvite: true, reason: null };
    }
    
    /**
     * Calculate flight cost based on relationship and factors
     * @param {Object} ctx - Player context
     * @param {Object} relationship - Relationship data
     * @returns {number} - Flight cost
     */
    function calculateFlightCost(ctx, relationship) {
        var baseCost = getTravelConfig("FLIGHT_BASE_COST", 500);
        
        // Discount for higher affection (up to 25% off at max affection)
        var affection = relationship ? (relationship.affection || 0) : 0;
        var discountPercent = Math.min(25, Math.floor(affection / 4));
        
        // Spouse gets 50% discount
        if (relationship && relationship.status === "spouse") {
            discountPercent = 50;
        }
        
        var discount = Math.floor(baseCost * discountPercent / 100);
        return baseCost - discount;
    }
    
    /**
     * Purchase a flight ticket and set traveling companion
     * @param {Object} ctx - Player context
     * @param {string} npcId - NPC identifier
     * @param {string} npcName - NPC display name
     * @param {Object} relationship - Relationship data
     * @param {number} gameDay - Current game day
     * @returns {Object} - { success, cost, message }
     */
    function purchaseFlightTicket(ctx, npcId, npcName, relationship, gameDay) {
        ensureCompanionData(ctx);
        
        // Check if can invite
        var check = canInviteCompanion(ctx, relationship);
        if (!check.canInvite) {
            return { success: false, cost: 0, message: check.reason };
        }
        
        // Calculate cost
        var cost = calculateFlightCost(ctx, relationship);
        
        // Check if player has enough cash
        if ((ctx.cash || 0) < cost) {
            return { 
                success: false, 
                cost: cost, 
                message: "Not enough cash. Need $" + cost + ", have $" + (ctx.cash || 0) 
            };
        }
        
        // Clear existing companion if any
        if (ctx.travelingCompanion.npcId) {
            clearCompanion(ctx);
        }
        
        // Deduct cash and set companion
        ctx.cash -= cost;
        ctx.travelingCompanion = {
            npcId: npcId,
            npcName: npcName,
            flightPurchasedDay: gameDay,
            datesThisDay: 0,
            lastDateDay: null
        };
        
        if (typeof debugLog === "function") {
            debugLog("[COMPANION] " + npcName + " set as traveling companion (cost: $" + cost + ")");
        }
        
        return { 
            success: true, 
            cost: cost, 
            message: npcName + " is now traveling with you! (Cost: $" + cost + ")" 
        };
    }
    
    /**
     * Clear the current traveling companion
     * @param {Object} ctx - Player context
     * @returns {Object} - { hadCompanion, name }
     */
    function clearCompanion(ctx) {
        ensureCompanionData(ctx);
        
        var hadCompanion = !!ctx.travelingCompanion.npcId;
        var name = ctx.travelingCompanion.npcName;
        
        ctx.travelingCompanion = {
            npcId: null,
            npcName: null,
            flightPurchasedDay: null,
            datesThisDay: 0,
            lastDateDay: null
        };
        
        if (hadCompanion && typeof debugLog === "function") {
            debugLog("[COMPANION] Cleared traveling companion: " + name);
        }
        
        return { hadCompanion: hadCompanion, name: name };
    }
    
    /**
     * Get current traveling companion info
     * @param {Object} ctx - Player context
     * @returns {Object|null} - Companion info or null
     */
    function getCompanion(ctx) {
        ensureCompanionData(ctx);
        
        if (!ctx.travelingCompanion.npcId) {
            return null;
        }
        
        // Look up relationship data for full info
        // Relationships are stored in ctx.romance.relationships (object keyed by npcName)
        var relationship = null;
        var npcName = ctx.travelingCompanion.npcName;
        
        if (ctx.romance && ctx.romance.relationships) {
            // Try by npcName first (primary key)
            if (ctx.romance.relationships[npcName]) {
                relationship = ctx.romance.relationships[npcName];
            } else {
                // Fallback: search by npcId
                for (var name in ctx.romance.relationships) {
                    if (ctx.romance.relationships.hasOwnProperty(name)) {
                        var rel = ctx.romance.relationships[name];
                        if (rel.npcId === ctx.travelingCompanion.npcId || name === npcName) {
                            relationship = rel;
                            break;
                        }
                    }
                }
            }
        }
        
        return {
            npcId: ctx.travelingCompanion.npcId,
            npcName: npcName,
            name: npcName,  // Alias for compatibility
            flightPurchasedDay: ctx.travelingCompanion.flightPurchasedDay,
            datesThisDay: ctx.travelingCompanion.datesThisDay || 0,
            city: relationship ? (relationship.cityId || relationship.city || "Unknown") : "Unknown",
            affection: relationship ? (relationship.affection || 0) : 0
        };
    }
    
    /**
     * Check if player has a traveling companion
     * @param {Object} ctx - Player context
     * @returns {boolean}
     */
    function hasCompanion(ctx) {
        ensureCompanionData(ctx);
        return !!ctx.travelingCompanion.npcId;
    }
    
    // ========== DATE ACTIVITIES ==========
    
    /**
     * Take companion to dinner
     * Dates DON'T trigger pregnancy directly - they increase affection and may offer intimate encounter
     * @param {Object} ctx - Player context
     * @param {number} gameDay - Current game day
     * @returns {Object} - { success, cost, affectionGain, offersIntimacy, message }
     */
    function takeToDinner(ctx, gameDay) {
        ensureCompanionData(ctx);
        
        if (!ctx.travelingCompanion.npcId) {
            return { success: false, cost: 0, affectionGain: 0, offersIntimacy: false, message: "No traveling companion" };
        }
        
        var cost = getTravelConfig("DINNER_COST", 100);
        
        if ((ctx.cash || 0) < cost) {
            return { 
                success: false, 
                cost: cost, 
                affectionGain: 0,
                offersIntimacy: false,
                message: "Not enough cash. Need $" + cost 
            };
        }
        
        // Reset daily count if new day
        if (ctx.travelingCompanion.lastDateDay !== gameDay) {
            ctx.travelingCompanion.datesThisDay = 0;
            ctx.travelingCompanion.lastDateDay = gameDay;
        }
        
        // Deduct cost
        ctx.cash -= cost;
        ctx.travelingCompanion.datesThisDay++;
        
        // Calculate affection gain (diminishing returns)
        var baseGain = getTravelConfig("AFFECTION_PER_DINNER", 5);
        var timesToday = ctx.travelingCompanion.datesThisDay;
        var actualGain = Math.max(1, Math.floor(baseGain / timesToday));
        
        // Apply affection to relationship
        var affectionResult = applyAffectionToCompanion(ctx, actualGain);
        
        // Check if intimate encounter should be offered
        var offersIntimacy = shouldOfferIntimacy(ctx);
        
        var message = "Dinner with " + ctx.travelingCompanion.npcName + "! (+" + actualGain + " affection)";
        
        return { 
            success: true, 
            cost: cost, 
            affectionGain: actualGain,
            offersIntimacy: offersIntimacy,
            message: message
        };
    }
    
    /**
     * Take companion to the club
     * Dates DON'T trigger pregnancy directly - they increase affection and may offer intimate encounter
     * @param {Object} ctx - Player context
     * @param {number} gameDay - Current game day
     * @returns {Object} - { success, cost, affectionGain, offersIntimacy, message }
     */
    function takeToClub(ctx, gameDay) {
        ensureCompanionData(ctx);
        
        if (!ctx.travelingCompanion.npcId) {
            return { success: false, cost: 0, affectionGain: 0, offersIntimacy: false, message: "No traveling companion" };
        }
        
        var cost = getTravelConfig("CLUB_DATE_COST", 200);
        
        if ((ctx.cash || 0) < cost) {
            return { 
                success: false, 
                cost: cost, 
                affectionGain: 0,
                offersIntimacy: false,
                message: "Not enough cash. Need $" + cost 
            };
        }
        
        // Reset daily count if new day
        if (ctx.travelingCompanion.lastDateDay !== gameDay) {
            ctx.travelingCompanion.datesThisDay = 0;
            ctx.travelingCompanion.lastDateDay = gameDay;
        }
        
        // Deduct cost
        ctx.cash -= cost;
        ctx.travelingCompanion.datesThisDay++;
        
        // Calculate affection gain (diminishing returns)
        var baseGain = getTravelConfig("AFFECTION_PER_CLUB", 8);
        var timesToday = ctx.travelingCompanion.datesThisDay;
        var actualGain = Math.max(1, Math.floor(baseGain / timesToday));
        
        // Apply affection to relationship
        var affectionResult = applyAffectionToCompanion(ctx, actualGain);
        
        // Check if intimate encounter should be offered
        var offersIntimacy = shouldOfferIntimacy(ctx);
        
        var message = "Dancing with " + ctx.travelingCompanion.npcName + "! (+" + actualGain + " affection)";
        
        return { 
            success: true, 
            cost: cost, 
            affectionGain: actualGain,
            offersIntimacy: offersIntimacy,
            message: message
        };
    }
    
    /**
     * Apply affection gain to companion's relationship
     * @param {Object} ctx - Player context
     * @param {number} amount - Affection to add
     * @returns {Object} - { success, newAffection }
     */
    function applyAffectionToCompanion(ctx, amount) {
        if (!ctx.travelingCompanion || !ctx.travelingCompanion.npcId) {
            return { success: false, newAffection: 0 };
        }
        
        var npcName = ctx.travelingCompanion.npcName;
        
        // Find relationship in romance system - stored in ctx.romance.relationships
        if (ctx.romance && ctx.romance.relationships && ctx.romance.relationships[npcName]) {
            var rel = ctx.romance.relationships[npcName];
            rel.affection = (rel.affection || 0) + amount;
            rel.affection = Math.min(100, rel.affection);
            
            // Update status based on affection thresholds
            if (LORB.Data && LORB.Data.Romance) {
                LORB.Data.Romance.updateStatus(rel);
            }
            
            return { success: true, newAffection: rel.affection };
        }
        
        return { success: false, newAffection: 0 };
    }
    
    // ========== INTIMACY SYSTEM ==========
    // Intimate encounters are the consent step before potential pregnancy
    
    /**
     * Check if an intimate encounter should be offered after a date
     * @param {Object} ctx - Player context
     * @returns {boolean} - Whether intimacy should be offered
     */
    function shouldOfferIntimacy(ctx) {
        // TODO: Improve this logic - currently just 60% roll for testing
        // Should scale with relationship status/affection, but DON'T check pregnancy
        // here (that would spoil the reveal - player shouldn't know they're pregnant yet)
        if (!ctx.travelingCompanion || !ctx.travelingCompanion.npcId) {
            return false;
        }
        
        return Math.random() < 0.60;
    }
    
    /**
     * Perform an intimate encounter with the traveling companion
     * Called when user consents to intimacy after a date
     * This may result in a HIDDEN pregnancy (Phase 1) - player won't know until later
     * 
     * @param {Object} ctx - Player context
     * @param {number} gameDay - Current game day
     * @returns {Object} - { success, affectionGain, potentialPregnancy, message }
     */
    function performIntimateEncounter(ctx, gameDay) {
        if (!ctx.travelingCompanion || !ctx.travelingCompanion.npcId) {
            return { success: false, affectionGain: 0, potentialPregnancy: false, message: "No traveling companion" };
        }
        
        var npcName = ctx.travelingCompanion.npcName;
        
        // Bonus affection for intimacy
        var affectionGain = 10;
        applyAffectionToCompanion(ctx, affectionGain);
        
        // Get relationship for pregnancy odds calculation
        var relationship = null;
        if (ctx.romance && ctx.romance.relationships && ctx.romance.relationships[npcName]) {
            relationship = ctx.romance.relationships[npcName];
        }
        
        // Calculate pregnancy chance based on relationship
        var pregnancyChance = getBabyConfig("PREGNANCY_CHANCE_INTIMATE", 0.35);
        if (relationship) {
            // Higher affection = higher chance
            pregnancyChance += (relationship.affection || 0) / 500;  // up to +20% at 100 affection
            
            // Spouse has higher chance
            if (relationship.status === "spouse") {
                pregnancyChance += 0.15;
            }
        }
        
        // Roll for pregnancy (hidden from player!)
        var potentialPregnancy = false;
        if (Math.random() < pregnancyChance) {
            potentialPregnancy = createHiddenPregnancy(ctx, gameDay);
        }
        
        // Player sees a vague message (doesn't know if pregnant)
        var message = "A special night with " + npcName + "...";
        
        if (typeof debugLog === "function") {
            debugLog("[COMPANION] Intimate encounter with " + npcName + " (pregnancy: " + potentialPregnancy + ")");
        }
        
        return {
            success: true,
            affectionGain: affectionGain,
            potentialPregnancy: potentialPregnancy,  // For internal tracking, not shown to player
            message: message
        };
    }
    
    /**
     * Create a hidden pregnancy (Phase 1)
     * Player won't know about this until they enter the companion's home city
     * after sufficient game days have elapsed
     * 
     * @param {Object} ctx - Player context
     * @param {number} gameDay - Current game day
     * @returns {boolean} - Whether pregnancy was created
     */
    function createHiddenPregnancy(ctx, gameDay) {
        if (!ctx.travelingCompanion || !ctx.travelingCompanion.npcId) {
            return false;
        }
        
        var npcId = ctx.travelingCompanion.npcId;
        var npcName = ctx.travelingCompanion.npcName;
        
        // Check if already pregnant by this companion
        if (ctx.pregnancies) {
            for (var i = 0; i < ctx.pregnancies.length; i++) {
                if (ctx.pregnancies[i].npcId === npcId || ctx.pregnancies[i].npcName === npcName) {
                    return false;  // Already pregnant
                }
            }
        }
        
        // Initialize pregnancies array if needed
        if (!ctx.pregnancies) {
            ctx.pregnancies = [];
        }
        
        // Get companion's HOME city (not current city!)
        // This is stored in the relationship data
        var homeCity = "unknown";
        if (ctx.romance && ctx.romance.relationships && ctx.romance.relationships[npcName]) {
            homeCity = ctx.romance.relationships[npcName].cityId || "unknown";
        }
        
        // Roll for twins/triplets (traveling companion exclusive!)
        var count = rollForMultiples();
        
        // Create hidden pregnancy record
        var pregnancy = {
            npcId: npcId,
            npcName: npcName,
            cityId: homeCity,  // Pregnancy reveal happens in companion's HOME city
            phase: 1,  // Hidden - player doesn't know yet
            count: count,
            conceivedOnDay: gameDay,
            revealAfterDay: gameDay + getBabyConfig("PREGNANCY_REVEAL_DELAY", 3),  // Days until reveal is possible
            discoveredOnDay: null,
            projectedStats: null,
            projectedAppearance: null,
            projectedCost: null,
            paymentChoice: null,
            isCompanionPregnancy: true
        };
        
        ctx.pregnancies.push(pregnancy);
        
        if (typeof debugLog === "function") {
            debugLog("[COMPANION] Hidden pregnancy created: " + npcName + " x" + count + " (reveal after day " + pregnancy.revealAfterDay + " in " + homeCity + ")");
        }
        
        return true;
    }
    
    /**
     * Check for pending pregnancy reveals when entering a city
     * Called when player enters a city - if it's the companion's home city
     * and enough days have elapsed, the pregnancy should be revealed
     * 
     * @param {Object} ctx - Player context
     * @param {string} cityId - The city being entered
     * @param {number} gameDay - Current game day
     * @returns {Object|null} - Pregnancy to reveal, or null
     */
    function checkForPregnancyReveal(ctx, cityId, gameDay) {
        if (!ctx.pregnancies || ctx.pregnancies.length === 0) {
            return null;
        }
        
        // Look for hidden pregnancies (phase 1) that should be revealed
        for (var i = 0; i < ctx.pregnancies.length; i++) {
            var pregnancy = ctx.pregnancies[i];
            
            // Must be phase 1 (hidden)
            if (pregnancy.phase !== 1) continue;
            
            // Check if enough days have elapsed
            var revealDay = pregnancy.revealAfterDay || (pregnancy.conceivedOnDay + 3);
            if (gameDay < revealDay) continue;
            
            // Check if we're in the right city (companion's home city)
            // OR if the pregnancy is overdue (player hasn't visited the city)
            var isHomeCity = (cityId && cityId.toLowerCase() === (pregnancy.cityId || "").toLowerCase());
            var isOverdue = (gameDay >= revealDay + 5);  // 5 days overdue = reveal anywhere
            
            if (isHomeCity || isOverdue) {
                if (typeof debugLog === "function") {
                    debugLog("[COMPANION] Pregnancy reveal triggered for " + pregnancy.npcName + " in city " + cityId);
                }
                return pregnancy;
            }
        }
        
        return null;
    }
    
    /**
     * Roll for twins/triplets (traveling companion exclusive)
     * @returns {number} - 1, 2, or 3
     */
    function rollForMultiples() {
        var twinChance = getBabyConfig("TWINS_CHANCE", 0.08);
        var tripletChance = getBabyConfig("TRIPLETS_CHANCE", 0.01);
        
        var roll = Math.random();
        
        if (roll < tripletChance) {
            return 3;  // Triplets!
        } else if (roll < twinChance) {
            return 2;  // Twins!
        }
        
        return 1;  // Single
    }
    
    // ========== RELATIONSHIP LOOKUP ==========
    
    /**
     * Get list of eligible companions from relationships
     * @param {Object} ctx - Player context
     * @returns {Array} - Array of { npcId, npcName, affection, status, canInvite, reason, flightCost }
     */
    function getEligibleCompanions(ctx) {
        var eligible = [];
        
        // Relationships are stored in ctx.romance.relationships (object keyed by npcName)
        var relationships = null;
        if (ctx.romance && ctx.romance.relationships) {
            relationships = ctx.romance.relationships;
        } else if (ctx.relationships) {
            // Fallback for legacy/test contexts
            relationships = ctx.relationships;
        }
        
        if (!relationships) {
            return eligible;
        }
        
        for (var npcName in relationships) {
            if (relationships.hasOwnProperty(npcName)) {
                var rel = relationships[npcName];
                var check = canInviteCompanion(ctx, rel);
                
                // Only include if they can actually be invited
                if (check.canInvite) {
                    eligible.push({
                        npcId: npcName,
                        npcName: rel.name || npcName,
                        name: rel.name || npcName,  // Alias for UI compatibility
                        affection: rel.affection || 0,
                        status: rel.status || "stranger",
                        city: rel.cityId || rel.city || "Unknown",
                        canInvite: true,
                        reason: check.reason,
                        flightCost: calculateFlightCost(ctx, rel)
                    });
                }
            }
        }
        
        // Sort by affection (highest first)
        eligible.sort(function(a, b) {
            return (b.affection || 0) - (a.affection || 0);
        });
        
        return eligible;
    }
    
    // ========== EXPORT ==========
    
    LORB.Data = LORB.Data || {};
    LORB.Data.Companion = {
        // Core functions
        ensureCompanionData: ensureCompanionData,
        canInviteCompanion: canInviteCompanion,
        calculateFlightCost: calculateFlightCost,
        purchaseFlightTicket: purchaseFlightTicket,
        clearCompanion: clearCompanion,
        getCompanion: getCompanion,
        getCurrentCompanion: getCompanion,  // Alias
        hasCompanion: hasCompanion,
        
        // Date activities
        takeToDinner: takeToDinner,
        takeToClub: takeToClub,
        applyAffectionToCompanion: applyAffectionToCompanion,
        
        // Intimacy system (consent-based pregnancy trigger)
        shouldOfferIntimacy: shouldOfferIntimacy,
        performIntimateEncounter: performIntimateEncounter,
        
        // Pregnancy
        createHiddenPregnancy: createHiddenPregnancy,
        checkForPregnancyReveal: checkForPregnancyReveal,
        rollForMultiples: rollForMultiples,
        
        // Relationship lookup
        getEligibleCompanions: getEligibleCompanions
    };
    
})();
