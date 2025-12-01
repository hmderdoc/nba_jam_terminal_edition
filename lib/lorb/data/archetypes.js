/**
 * archetypes.js - Character Archetypes for LORB
 * 
 * Each archetype provides:
 * - Base stat modifiers
 * - A special passive ability
 * - Flavor text for character creation
 */
(function() {
    
    LORB.Data = LORB.Data || {};
    
    LORB.Data.ARCHETYPES = {
        slasher: {
            id: "slasher",
            name: "The Slasher",
            description: "Attack the rim with reckless abandon. Speed and power over finesse.",
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
        
        sniper: {
            id: "sniper",
            name: "The Sniper",
            description: "Ice in your veins. You live beyond the arc.",
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
        
        enforcer: {
            id: "enforcer",
            name: "The Enforcer",
            description: "Dominate the paint. Make them fear the lane.",
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
        },
        
        playmaker: {
            id: "playmaker",
            name: "The Playmaker",
            description: "Court vision. You see plays before they happen.",
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
        
        underdog: {
            id: "underdog",
            name: "The Underdog",
            description: "Nothing given. Everything earned. Prove them wrong.",
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
        }
    };
    
    // Helper to get archetype list for UI
    LORB.Data.getArchetypeList = function() {
        var list = [];
        for (var key in LORB.Data.ARCHETYPES) {
            if (LORB.Data.ARCHETYPES.hasOwnProperty(key)) {
                list.push(LORB.Data.ARCHETYPES[key]);
            }
        }
        return list;
    };
    
})();
