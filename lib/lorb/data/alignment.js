/**
 * alignment.js - Alignment/Karma System for LORB
 * 
 * Handles:
 * - Player moral alignment tracking (-100 to +100 scale)
 * - Alignment titles (Saint, Deadbeat, etc.)
 * - Alignment-based gameplay modifiers
 * - Parenting-specific alignment adjustments
 * 
 * Scale:
 *   +100 = "Saint" / max positive
 *   +50  = "Family Man" / good
 *   +25  = "Responsible" / slightly positive
 *     0  = "Neutral" / default
 *   -25  = "Sketchy" / slightly negative
 *   -50  = "Deadbeat" / bad
 *  -100  = "Monster" / max negative
 */
(function() {
    // NOTE: Do not use "use strict" - Synchronet color codes use octal-like \1 escapes
    
    // ========== CONSTANTS ==========
    
    /**
     * Get config value with fallback
     */
    function getConfig(key, defaultValue) {
        if (typeof LORB !== "undefined" && LORB.Config && LORB.Config.BABY_BALLERS) {
            var value = LORB.Config.BABY_BALLERS[key];
            if (value !== undefined) {
                return value;
            }
        }
        return defaultValue;
    }
    
    // Alignment thresholds for titles
    var ALIGNMENT_TITLES = [
        { min: 80, title: "Saint", color: "\1h\1w", icon: "\xF0" },          // ≡ or halo
        { min: 60, title: "Role Model", color: "\1h\1g", icon: "\x02" },     // smiley
        { min: 40, title: "Family Man", color: "\1g", icon: "\x03" },        // heart
        { min: 20, title: "Responsible", color: "\1c", icon: "\x1E" },       // up arrow
        { min: 1, title: "Decent", color: "\1w", icon: "\xF9" },             // dot
        { min: -19, title: "Neutral", color: "\1w", icon: "\xFA" },          // small dot
        { min: -39, title: "Sketchy", color: "\1y", icon: "?" },
        { min: -59, title: "Deadbeat", color: "\1r", icon: "!" },
        { min: -79, title: "Absent Father", color: "\1h\1r", icon: "\x1F" }, // down arrow
        { min: -100, title: "Monster", color: "\1h\1k\0011", icon: "\x0F" }  // skull/sun on red bg
    ];
    
    // Alignment modifiers for gameplay
    var ALIGNMENT_MODIFIERS = {
        // Highly positive (+60 and up)
        saint: {
            repMultiplier: 1.25,        // +25% rep gains
            flirtBonus: 15,             // +15% flirt success
            childEncounterRate: 0.5,    // 50% chance kids seek you out
            priceDiscount: 0.05,        // 5% shop discount
            description: "Your reputation precedes you. People trust you."
        },
        // Positive (+20 to +59)
        good: {
            repMultiplier: 1.10,        // +10% rep gains
            flirtBonus: 5,              // +5% flirt success
            childEncounterRate: 0.3,    // Kids want to meet you
            priceDiscount: 0.0,
            description: "You're known as a decent person."
        },
        // Neutral (-19 to +19)
        neutral: {
            repMultiplier: 1.0,
            flirtBonus: 0,
            childEncounterRate: 0.15,   // Normal encounter rate
            priceDiscount: 0.0,
            description: "You have no strong reputation either way."
        },
        // Negative (-20 to -59)
        bad: {
            repMultiplier: 0.90,        // -10% rep gains
            flirtBonus: -10,            // -10% flirt success (less trusted)
            childEncounterRate: 0.05,   // Kids avoid you
            priceDiscount: -0.05,       // 5% price increase (distrust)
            description: "People side-eye you. You're not trusted."
        },
        // Highly negative (-60 and below)
        monster: {
            repMultiplier: 0.75,        // -25% rep gains
            flirtBonus: -25,            // Much harder to romance
            childEncounterRate: 0.0,    // Kids refuse to meet you
            priceDiscount: -0.10,       // 10% price markup
            description: "You're feared and reviled. Everyone avoids you."
        }
    };
    
    // ========== CORE FUNCTIONS ==========
    
    /**
     * Ensure alignment field exists on player context
     * @param {Object} ctx - Player context
     */
    function ensureAlignment(ctx) {
        if (typeof ctx.alignment === "undefined") {
            ctx.alignment = 0;
        }
    }
    
    /**
     * Adjust alignment value
     * @param {Object} ctx - Player context
     * @param {string} action - Action causing adjustment (for logging/tracking)
     * @param {number} amount - Amount to adjust (positive or negative)
     * @returns {Object} - { oldValue, newValue, change, title }
     */
    function adjust(ctx, action, amount) {
        ensureAlignment(ctx);
        
        var oldValue = ctx.alignment;
        ctx.alignment += amount;
        
        // Clamp to valid range
        ctx.alignment = Math.max(-100, Math.min(100, ctx.alignment));
        
        var result = {
            oldValue: oldValue,
            newValue: ctx.alignment,
            change: ctx.alignment - oldValue,
            action: action,
            title: getTitle(ctx.alignment)
        };
        
        // Log significant changes
        if (typeof debugLog === "function" && Math.abs(result.change) > 0) {
            debugLog("[ALIGNMENT] " + action + ": " + oldValue + " -> " + ctx.alignment + 
                     " (" + (result.change >= 0 ? "+" : "") + result.change + ")");
        }
        
        // Track alignment history (optional - for analytics)
        if (!ctx.alignmentHistory) {
            ctx.alignmentHistory = [];
        }
        if (ctx.alignmentHistory.length < 50) {  // Cap history size
            ctx.alignmentHistory.push({
                action: action,
                change: result.change,
                newValue: ctx.alignment,
                timestamp: Date.now()
            });
        }
        
        return result;
    }
    
    /**
     * Get alignment title/label
     * @param {number} alignment - Alignment value (-100 to +100)
     * @returns {Object} - { title, color, icon }
     */
    function getTitle(alignment) {
        if (typeof alignment !== "number") {
            alignment = 0;
        }
        
        for (var i = 0; i < ALIGNMENT_TITLES.length; i++) {
            if (alignment >= ALIGNMENT_TITLES[i].min) {
                return {
                    title: ALIGNMENT_TITLES[i].title,
                    color: ALIGNMENT_TITLES[i].color,
                    icon: ALIGNMENT_TITLES[i].icon
                };
            }
        }
        
        // Fallback (should never reach)
        return { title: "Unknown", color: "\1w", icon: "?" };
    }
    
    /**
     * Get formatted title string with color codes
     * @param {number} alignment - Alignment value
     * @returns {string} - Formatted title string
     */
    function getFormattedTitle(alignment) {
        var info = getTitle(alignment);
        return info.color + info.icon + " " + info.title + "\1n";
    }
    
    /**
     * Get gameplay modifiers based on alignment
     * @param {number} alignment - Alignment value
     * @returns {Object} - Modifier values
     */
    function getModifiers(alignment) {
        if (typeof alignment !== "number") {
            alignment = 0;
        }
        
        if (alignment >= 60) {
            return ALIGNMENT_MODIFIERS.saint;
        } else if (alignment >= 20) {
            return ALIGNMENT_MODIFIERS.good;
        } else if (alignment >= -19) {
            return ALIGNMENT_MODIFIERS.neutral;
        } else if (alignment >= -59) {
            return ALIGNMENT_MODIFIERS.bad;
        } else {
            return ALIGNMENT_MODIFIERS.monster;
        }
    }
    
    /**
     * Get alignment bar visualization
     * @param {number} alignment - Alignment value (-100 to +100)
     * @returns {string} - ANSI bar representation
     */
    function getAlignmentBar(alignment) {
        if (typeof alignment !== "number") {
            alignment = 0;
        }
        
        // Convert -100..+100 to 0..20 segments
        var normalized = Math.floor((alignment + 100) / 10);  // 0-20
        normalized = Math.max(0, Math.min(20, normalized));
        
        var bar = "";
        for (var i = 0; i < 20; i++) {
            if (i < normalized) {
                if (i < 4) {
                    bar += "\1h\1r\xFE";     // Red for very negative
                } else if (i < 8) {
                    bar += "\1r\xFE";         // Dark red for negative
                } else if (i < 12) {
                    bar += "\1y\xFE";         // Yellow for neutral
                } else if (i < 16) {
                    bar += "\1g\xFE";         // Green for positive
                } else {
                    bar += "\1h\1g\xFE";     // Bright green for very positive
                }
            } else {
                bar += "\1h\1k\xFE";          // Dark for unfilled
            }
        }
        bar += "\1n";
        
        return bar;
    }
    
    /**
     * Get alignment display string with bar and title
     * @param {Object} ctx - Player context
     * @returns {string} - Full alignment display
     */
    function getAlignmentDisplay(ctx) {
        ensureAlignment(ctx);
        var alignment = ctx.alignment;
        var info = getTitle(alignment);
        var bar = getAlignmentBar(alignment);
        
        var signStr = alignment >= 0 ? "+" : "";
        return bar + " " + info.color + signStr + alignment + " " + info.title + "\1n";
    }
    
    // ========== PARENTING-SPECIFIC FUNCTIONS ==========
    
    /**
     * Apply birth decision alignment effect
     * @param {Object} ctx - Player context
     * @param {string} choice - "abandon", "installment", "lump_sum", "bill_me"
     * @returns {Object} - Result of adjustment
     */
    function applyBirthDecision(ctx, choice) {
        var action = "birth_decision_" + choice;
        var amount = 0;
        
        switch (choice) {
            case "abandon":
                amount = getConfig("ALIGNMENT_ABANDON", -25);
                break;
            case "installment":
                amount = Math.floor(getConfig("ALIGNMENT_NURTURE", 10) / 2);
                break;
            case "lump_sum":
                amount = getConfig("ALIGNMENT_LUMP_SUM", 15);
                break;
            case "bill_me":
            default:
                amount = 0;  // No change for deferring
                break;
        }
        
        if (amount !== 0) {
            return adjust(ctx, action, amount);
        }
        
        return { oldValue: ctx.alignment, newValue: ctx.alignment, change: 0 };
    }
    
    /**
     * Apply parenting mode alignment effect
     * @param {Object} ctx - Player context
     * @param {string} mode - "nurture", "neglect", "abandon"
     * @returns {Object} - Result of adjustment
     */
    function applyParentingMode(ctx, mode) {
        var action = "parenting_mode_" + mode;
        var amount = 0;
        
        switch (mode) {
            case "nurture":
                amount = getConfig("ALIGNMENT_NURTURE", 10);
                break;
            case "neglect":
                amount = getConfig("ALIGNMENT_NEGLECT", -5);
                break;
            case "abandon":
                amount = getConfig("ALIGNMENT_ABANDON", -25);
                break;
            default:
                break;
        }
        
        if (amount !== 0) {
            return adjust(ctx, action, amount);
        }
        
        return { oldValue: ctx.alignment, newValue: ctx.alignment, change: 0 };
    }
    
    /**
     * Apply child support payment alignment effect
     * @param {Object} ctx - Player context
     * @param {boolean} isFullPayoff - Whether this is a full lump sum payoff
     * @returns {Object} - Result of adjustment
     */
    function applyChildSupportPayment(ctx, isFullPayoff) {
        var action = isFullPayoff ? "lump_sum_payoff" : "child_support_payment";
        var amount = isFullPayoff ? 
            getConfig("ALIGNMENT_LUMP_SUM", 15) : 
            Math.floor(getConfig("ALIGNMENT_NURTURE", 10) / 5);  // Small bonus per payment
        
        return adjust(ctx, action, amount);
    }
    
    /**
     * Apply overdue penalty
     * @param {Object} ctx - Player context
     * @param {boolean} isInitialOverdue - First time going overdue (larger penalty)
     * @returns {Object} - Result of adjustment
     */
    function applyOverduePenalty(ctx, isInitialOverdue) {
        var action = isInitialOverdue ? "initial_overdue" : "daily_overdue_decay";
        var amount = isInitialOverdue ?
            getConfig("OVERDUE_ALIGNMENT_PENALTY", -30) :
            getConfig("DAILY_OVERDUE_ALIGNMENT_DECAY", -2);
        
        return adjust(ctx, action, amount);
    }
    
    // ========== MODIFIER APPLICATION HELPERS ==========
    
    /**
     * Apply rep multiplier based on alignment
     * @param {Object} ctx - Player context
     * @param {number} baseRep - Base reputation amount
     * @returns {number} - Modified reputation
     */
    function applyRepModifier(ctx, baseRep) {
        ensureAlignment(ctx);
        var mods = getModifiers(ctx.alignment);
        return Math.floor(baseRep * mods.repMultiplier);
    }
    
    /**
     * Apply flirt bonus based on alignment
     * @param {Object} ctx - Player context
     * @param {number} baseChance - Base flirt success chance (0-100)
     * @returns {number} - Modified chance
     */
    function applyFlirtModifier(ctx, baseChance) {
        ensureAlignment(ctx);
        var mods = getModifiers(ctx.alignment);
        return Math.max(5, Math.min(95, baseChance + mods.flirtBonus));
    }
    
    /**
     * Apply price modifier based on alignment
     * @param {Object} ctx - Player context
     * @param {number} basePrice - Base price
     * @returns {number} - Modified price
     */
    function applyPriceModifier(ctx, basePrice) {
        ensureAlignment(ctx);
        var mods = getModifiers(ctx.alignment);
        var discount = mods.priceDiscount;  // Negative means markup
        return Math.floor(basePrice * (1 - discount));
    }
    
    /**
     * Get child encounter rate modifier
     * @param {Object} ctx - Player context
     * @returns {number} - Encounter rate multiplier (0-1)
     */
    function getChildEncounterRate(ctx) {
        ensureAlignment(ctx);
        var mods = getModifiers(ctx.alignment);
        return mods.childEncounterRate;
    }
    
    // ========== EXPORT ==========
    
    LORB.Data = LORB.Data || {};
    LORB.Data.Alignment = {
        // Core functions
        ensureAlignment: ensureAlignment,
        adjust: adjust,
        getTitle: getTitle,
        getFormattedTitle: getFormattedTitle,
        getModifiers: getModifiers,
        getAlignmentBar: getAlignmentBar,
        getAlignmentDisplay: getAlignmentDisplay,
        
        // Parenting-specific
        applyBirthDecision: applyBirthDecision,
        applyParentingMode: applyParentingMode,
        applyChildSupportPayment: applyChildSupportPayment,
        applyOverduePenalty: applyOverduePenalty,
        
        // Modifier helpers
        applyRepModifier: applyRepModifier,
        applyFlirtModifier: applyFlirtModifier,
        applyPriceModifier: applyPriceModifier,
        getChildEncounterRate: getChildEncounterRate,
        
        // Constants (for external access)
        TITLES: ALIGNMENT_TITLES,
        MODIFIERS: ALIGNMENT_MODIFIERS
    };
    
})();
