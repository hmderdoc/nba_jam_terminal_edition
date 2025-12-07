/**
 * archetypes.js - Character Archetypes for LORB
 * 
 * Each archetype provides:
 * - Base stat modifiers
 * - A special passive ability
 * - Flavor text for character creation
 * - Position mapping (for companion selection and flavor)
 */
(function() {
    
    LORB.Data = LORB.Data || {};
    
    /**
     * Position types for display and companion matching
     * PG = Point Guard, SG = Shooting Guard, SF = Small Forward, PF = Power Forward, C = Center
     */
    LORB.Data.POSITIONS = {
        PG: { id: "PG", name: "Point Guard", category: "Guard" },
        SG: { id: "SG", name: "Shooting Guard", category: "Guard" },
        SF: { id: "SF", name: "Small Forward", category: "Forward" },
        PF: { id: "PF", name: "Power Forward", category: "Forward" },
        C:  { id: "C",  name: "Center", category: "Center" }
    };
    
    LORB.Data.ARCHETYPES = {
        // Position 1: Point Guard (PG) - floor general, court vision
        playmaker: {
            id: "playmaker",
            name: "The Playmaker",
            description: "Court vision. You see plays before they happen.",
            position: "PG",
            statMods: {
                steal: 2,
                speed: 1,
                dunk: -1
            },
            special: {
                id: "hype_assist",
                name: "Hype Assist",
                description: "10% chance to earn bonus $50-150 after each game"
            },
            flavorText: "You don't need to score to dominate.\nThe ball finds the open man. You are the ball."
        },
        
        // Position 2: Shooting Guard (SG) - perimeter scorer
        sniper: {
            id: "sniper",
            name: "The Sniper",
            description: "Ice in your veins. You live beyond the arc.",
            position: "SG",
            statMods: {
                threePt: 3,
                steal: 1,
                power: -2
            },
            special: {
                id: "heat_check",
                name: "Heat Check",
                description: "After 2 consecutive wins, +1 to all shots next game"
            },
            flavorText: "They say you can shoot the lights out.\nYou prefer to leave them on so they can watch."
        },
        
        // Position 3: Small Forward (SF) - athletic wing, attacks basket
        slasher: {
            id: "slasher",
            name: "The Slasher",
            description: "Attack the rim with reckless abandon. Speed and power over finesse.",
            position: "SF",
            statMods: {
                speed: 2,
                dunk: 2,
                threePt: -2
            },
            special: {
                id: "momentum",
                name: "Momentum",
                description: "+15% XP when defeating opponents with higher rep"
            },
            flavorText: "You learned the game in the park, driving hard to the hole.\nNo fancy jumpers. Just get to the rim and finish."
        },
        
        // Position 4: Power Forward (PF) - undersized but scrappy
        underdog: {
            id: "underdog",
            name: "The Underdog",
            description: "Nothing given. Everything earned. Prove them wrong.",
            position: "PF",
            statMods: {
                speed: -1,
                power: -1,
                threePt: -1
            },
            special: {
                id: "chip_on_shoulder",
                name: "Chip on Shoulder",
                description: "+25% XP from all sources"
            },
            flavorText: "They said you were too small. Too slow. Too weak.\nThey're about to eat those words."
        },
        
        // Position 5: Center (C) - paint presence, intimidation
        enforcer: {
            id: "enforcer",
            name: "The Enforcer",
            description: "Dominate the paint. Make them fear the lane.",
            position: "C",
            statMods: {
                power: 2,
                block: 2,
                speed: -2
            },
            special: {
                id: "intimidation",
                name: "Intimidation",
                description: "Opponents have -5% shooting accuracy against you"
            },
            flavorText: "The paint is yours. Always has been.\nAnyone who comes inside learns that lesson the hard way."
        }
    };
    
    // Helper to get archetype list for UI - returns in position order (PG, SG, SF, PF, C)
    LORB.Data.getArchetypeList = function() {
        var positionOrder = ["playmaker", "sniper", "slasher", "underdog", "enforcer"];
        var list = [];
        for (var i = 0; i < positionOrder.length; i++) {
            var key = positionOrder[i];
            if (LORB.Data.ARCHETYPES[key]) {
                list.push(LORB.Data.ARCHETYPES[key]);
            }
        }
        return list;
    };
    
    // Helper to get position info from archetype
    LORB.Data.getPositionFromArchetype = function(archetypeId) {
        var archetype = LORB.Data.ARCHETYPES[archetypeId];
        if (!archetype || !archetype.position) {
            return LORB.Data.POSITIONS.SF; // Default to SF if unknown
        }
        return LORB.Data.POSITIONS[archetype.position] || LORB.Data.POSITIONS.SF;
    };
    
})();
