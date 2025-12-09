/**
 * buff-system.js - Player Buff/Effect System
 * 
 * Provides a structured way to apply temporary or permanent modifiers to players.
 * Buffs can affect:
 *   - Fire/hot streak status (permanently on fire)
 *   - Shove success chance (additive bonus)
 *   - Shot accuracy (multiplier)
 *   - Speed/turbo (multiplier)
 *   - Steal/block chance (additive bonus)
 *   - Immunity flags (can't be shoved, can't be stolen from, etc.)
 * 
 * Usage:
 *   // Define buffs in player config
 *   var playerConfig = {
 *       name: "Satan",
 *       buffs: {
 *           permanentFire: true,
 *           shoveBonus: 0.5  // +50% shove success
 *       }
 *   };
 *   
 *   // Apply buffs after sprite creation
 *   BuffSystem.applyBuffs(sprite, playerConfig.buffs);
 *   
 *   // Check buff in gameplay code
 *   var shoveBonus = BuffSystem.getShoveBonus(sprite);
 */

(function() {
    
    // ========== BUFF DEFINITIONS ==========
    
    /**
     * Standard buff types with default values and descriptions
     */
    var BUFF_TYPES = {
        // Fire/streak buffs
        permanentFire: { type: "boolean", default: false, description: "Player is always on fire" },
        fireImmunity: { type: "boolean", default: false, description: "Fire can't be extinguished by opponent plays" },
        
        // Physical play buffs
        shoveBonus: { type: "number", default: 0, description: "Additive bonus to shove success chance (0.0-1.0)" },
        shoveImmunity: { type: "boolean", default: false, description: "Cannot be shoved" },
        
        // Shooting buffs
        shotMultiplier: { type: "number", default: 1.0, description: "Multiplier for shot success" },
        threePointBonus: { type: "number", default: 0, description: "Additive bonus to 3pt percentage" },
        
        // Defense buffs
        stealBonus: { type: "number", default: 0, description: "Additive bonus to steal chance" },
        blockBonus: { type: "number", default: 0, description: "Additive bonus to block chance" },
        
        // Movement buffs
        speedMultiplier: { type: "number", default: 1.0, description: "Multiplier for movement speed" },
        infiniteTurbo: { type: "boolean", default: false, description: "Turbo never depletes" },
        
        // Attribute overrides (for boss fights, etc.)
        attributeOverrides: { type: "object", default: null, description: "Override specific attributes" }
    };
    
    // ========== BUFF APPLICATION ==========
    
    /**
     * Apply buffs to a player sprite
     * Should be called after sprite creation but before game starts
     * 
     * @param {Object} sprite - Player sprite with playerData
     * @param {Object} buffs - Buff configuration object
     */
    function applyBuffs(sprite, buffs) {
        if (!sprite || !sprite.playerData) {
            if (typeof debugLog === "function") {
                debugLog("[BUFF-SYSTEM] Cannot apply buffs - no playerData");
            }
            return;
        }
        
        if (!buffs || typeof buffs !== "object") {
            return;
        }
        
        // Initialize buffs container on playerData
        if (!sprite.playerData.buffs) {
            sprite.playerData.buffs = {};
        }
        
        // Copy buff values, validating against BUFF_TYPES
        for (var key in buffs) {
            if (buffs.hasOwnProperty(key)) {
                var buffDef = BUFF_TYPES[key];
                var value = buffs[key];
                
                if (buffDef) {
                    // Validate type
                    if (buffDef.type === "boolean") {
                        sprite.playerData.buffs[key] = !!value;
                    } else if (buffDef.type === "number") {
                        sprite.playerData.buffs[key] = typeof value === "number" ? value : buffDef.default;
                    } else if (buffDef.type === "object") {
                        sprite.playerData.buffs[key] = value;
                    }
                } else {
                    // Unknown buff - store anyway for extensibility
                    sprite.playerData.buffs[key] = value;
                    if (typeof debugLog === "function") {
                        debugLog("[BUFF-SYSTEM] Unknown buff type: " + key);
                    }
                }
            }
        }
        
        // Apply immediate effects
        applyImmediateEffects(sprite);
        
        if (typeof debugLog === "function") {
            debugLog("[BUFF-SYSTEM] Applied buffs to " + (sprite.playerData.name || "player") + 
                     ": " + JSON.stringify(sprite.playerData.buffs));
        }
    }
    
    /**
     * Apply effects that need to happen immediately (like permanent fire)
     */
    function applyImmediateEffects(sprite) {
        if (!sprite || !sprite.playerData || !sprite.playerData.buffs) return;
        
        var buffs = sprite.playerData.buffs;
        
        // Permanent fire - set player on fire immediately
        if (buffs.permanentFire) {
            sprite.playerData.onFire = true;
            sprite.playerData.fireMakeStreak = 99; // Keep streak high to prevent natural expiry
            sprite.playerData.heatStreak = 99;
        }
    }
    
    /**
     * Refresh buffs (call each frame for time-based effects)
     * Currently used to maintain permanent fire status
     */
    function refreshBuffs(sprite) {
        if (!sprite || !sprite.playerData || !sprite.playerData.buffs) return;
        
        var buffs = sprite.playerData.buffs;
        
        // Maintain permanent fire
        if (buffs.permanentFire) {
            sprite.playerData.onFire = true;
            // Keep streak high so normal fire-extinguishing logic doesn't clear it
            if (sprite.playerData.fireMakeStreak < 99) {
                sprite.playerData.fireMakeStreak = 99;
            }
        }
        
        // Fire immunity - prevent fire from being cleared
        if (buffs.fireImmunity && sprite.playerData.onFire) {
            // Will be checked in clearTeamOnFire
        }
    }
    
    // ========== BUFF QUERIES ==========
    
    /**
     * Check if player has a specific buff
     */
    function hasBuff(sprite, buffName) {
        if (!sprite || !sprite.playerData || !sprite.playerData.buffs) return false;
        return !!sprite.playerData.buffs[buffName];
    }
    
    /**
     * Get numeric buff value (returns default if not set)
     */
    function getBuffValue(sprite, buffName, defaultValue) {
        if (!sprite || !sprite.playerData || !sprite.playerData.buffs) {
            return defaultValue !== undefined ? defaultValue : 0;
        }
        var value = sprite.playerData.buffs[buffName];
        if (value === undefined || value === null) {
            var buffDef = BUFF_TYPES[buffName];
            return buffDef ? buffDef.default : (defaultValue !== undefined ? defaultValue : 0);
        }
        return value;
    }
    
    /**
     * Get shove bonus for a player (used by physical-play.js)
     */
    function getShoveBonus(sprite) {
        return getBuffValue(sprite, "shoveBonus", 0);
    }
    
    /**
     * Check if player is immune to shoves
     */
    function isShoveImmune(sprite) {
        return hasBuff(sprite, "shoveImmunity");
    }
    
    /**
     * Check if player has permanent fire
     */
    function hasPermanentFire(sprite) {
        return hasBuff(sprite, "permanentFire");
    }
    
    /**
     * Check if player has fire immunity (can't be extinguished)
     */
    function hasFireImmunity(sprite) {
        return hasBuff(sprite, "fireImmunity");
    }
    
    /**
     * Get shot multiplier
     */
    function getShotMultiplier(sprite) {
        return getBuffValue(sprite, "shotMultiplier", 1.0);
    }
    
    /**
     * Get steal bonus
     */
    function getStealBonus(sprite) {
        return getBuffValue(sprite, "stealBonus", 0);
    }
    
    /**
     * Get block bonus
     */
    function getBlockBonus(sprite) {
        return getBuffValue(sprite, "blockBonus", 0);
    }
    
    /**
     * Get three-point bonus
     */
    function getThreePointBonus(sprite) {
        return getBuffValue(sprite, "threePointBonus", 0);
    }
    
    /**
     * Check if player has infinite turbo
     */
    function hasInfiniteTurbo(sprite) {
        return hasBuff(sprite, "infiniteTurbo");
    }
    
    /**
     * Get speed multiplier
     */
    function getSpeedMultiplier(sprite) {
        return getBuffValue(sprite, "speedMultiplier", 1.0);
    }
    
    // ========== PRESET BUFF SETS ==========
    
    /**
     * Predefined buff sets for special characters
     */
    var BUFF_PRESETS = {
        // Satan - The GOAT: Always on fire, enhanced shooting
        SATAN: {
            permanentFire: true,
            fireImmunity: true,
            shotMultiplier: 1.15,
            threePointBonus: 0.10
        },
        
        // Iceman - Cold as Hell: Devastating shoves, steal master
        ICEMAN: {
            shoveBonus: 0.40,        // +40% shove success
            stealBonus: 0.15,        // +15% steal chance
            blockBonus: 0.20         // +20% block chance
        },
        
        // Jordan - His Airness: Enhanced overall
        JORDAN: {
            shotMultiplier: 1.10,
            speedMultiplier: 1.05
        },
        
        // Pippen - Defensive specialist
        PIPPEN: {
            stealBonus: 0.10,
            blockBonus: 0.10
        }
    };
    
    /**
     * Get a preset buff set by name
     */
    function getPreset(presetName) {
        return BUFF_PRESETS[presetName] || null;
    }
    
    // ========== EXPORT ==========
    
    // Make available globally for game code
    if (typeof BuffSystem === "undefined") {
        BuffSystem = {};
    }
    
    BuffSystem.BUFF_TYPES = BUFF_TYPES;
    BuffSystem.BUFF_PRESETS = BUFF_PRESETS;
    
    // Application
    BuffSystem.applyBuffs = applyBuffs;
    BuffSystem.refreshBuffs = refreshBuffs;
    
    // Queries
    BuffSystem.hasBuff = hasBuff;
    BuffSystem.getBuffValue = getBuffValue;
    BuffSystem.getShoveBonus = getShoveBonus;
    BuffSystem.isShoveImmune = isShoveImmune;
    BuffSystem.hasPermanentFire = hasPermanentFire;
    BuffSystem.hasFireImmunity = hasFireImmunity;
    BuffSystem.getShotMultiplier = getShotMultiplier;
    BuffSystem.getThreePointBonus = getThreePointBonus;
    BuffSystem.getStealBonus = getStealBonus;
    BuffSystem.getBlockBonus = getBlockBonus;
    BuffSystem.hasInfiniteTurbo = hasInfiniteTurbo;
    BuffSystem.getSpeedMultiplier = getSpeedMultiplier;
    
    // Presets
    BuffSystem.getPreset = getPreset;
    
})();
