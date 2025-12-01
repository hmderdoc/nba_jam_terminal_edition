/**
 * backgrounds.js - Character Backgrounds for LORB
 * 
 * Backgrounds provide:
 * - Starting resource modifiers (cash, rep)
 * - Minor stat adjustments
 * - Unique flavor and unlock conditions
 */
(function() {
    
    LORB.Data = LORB.Data || {};
    
    LORB.Data.BACKGROUNDS = {
        streetball: {
            id: "streetball",
            name: "Streetball Prodigy",
            description: "Raised on blacktop courts. Style over substance... until you prove otherwise.",
            resourceMods: {
                cash: -300,     // Start with less ($700 instead of $1000)
                rep: 5          // Street cred
            },
            statMods: {
                speed: 1,
                dunk: 1
            },
            perks: ["blacktop_encounters"],
            flavorText: "The playground was your classroom.\nAND1 mixtapes were your textbooks."
        },
        
        city_league: {
            id: "city_league",
            name: "City League Standout",
            description: "Organized ball taught you fundamentals. Coaches noticed.",
            resourceMods: {
                cash: 200,      // Start with more ($1200)
                rep: 0
            },
            statMods: {},       // Balanced, no stat changes
            perks: ["reduced_injury_risk"],
            flavorText: "You played the right way. Box out. Set screens.\nNow it's time to show what else you've got."
        },
        
        sponsored: {
            id: "sponsored",
            name: "Sponsored Prospect",
            description: "A local shop saw potential. Money's good, but strings attached.",
            resourceMods: {
                cash: 500,      // Start rich ($1500)
                rep: -5         // Sellout reputation
            },
            statMods: {
                speed: -1       // Too comfortable
            },
            perks: ["sponsor_events"],
            flavorText: "Free gear. Free drinks. Nothing is free.\nThey'll want results. Soon."
        },
        
        juco: {
            id: "juco",
            name: "Junior College Grinder",
            description: "Took the long road. Every rep counts double.",
            resourceMods: {
                cash: -200,     // Start with less ($800)
                rep: 2
            },
            statMods: {},
            perks: ["xp_bonus_15"],  // +15% XP
            flavorText: "Two years in the desert. Anonymous gyms.\nYou've done the work. Now show them."
        },
        
        lab_creation: {
            id: "lab_creation",
            name: "Mystery Lab Creation",
            description: "Red Bull did something to you. What exactly... unclear.",
            resourceMods: {
                cash: 0,
                rep: 0
            },
            statMods: {
                // Will be randomized at creation time
                _random: true
            },
            perks: ["red_bull_affinity"],
            flavorText: "You woke up in a warehouse. Wings on your back.\nOr was that a dream? The can was empty."
        }
    };
    
    // Helper to get background list for UI
    LORB.Data.getBackgroundList = function() {
        var list = [];
        for (var key in LORB.Data.BACKGROUNDS) {
            if (LORB.Data.BACKGROUNDS.hasOwnProperty(key)) {
                list.push(LORB.Data.BACKGROUNDS[key]);
            }
        }
        return list;
    };
    
})();
