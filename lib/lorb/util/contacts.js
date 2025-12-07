/**
 * contacts.js - NBA Player Contact Management
 * 
 * Handles adding defeated NBA players to contacts, managing crew,
 * and calculating temp player cuts.
 */

(function() {
    
    // Default signing costs and cut percentages by player tier
    var TIER_CONFIG = {
        superstar: { signCost: 10000, cutPercent: 45 },  // LeBron, Curry, etc.
        star:      { signCost: 5000,  cutPercent: 35 },  // Most starters
        role:      { signCost: 2000,  cutPercent: 25 },  // Role players
        rookie:    { signCost: 1000,  cutPercent: 20 }   // Rookies, legends past prime
    };
    
    // Known superstars (by name fragment for matching)
    var SUPERSTARS = [
        "jordan", "lebron", "curry", "durant", "kobe", "shaq", "bird", 
        "magic", "hakeem", "kareem", "wilt", "giannis", "jokic", "luka"
    ];
    
    /**
     * Starter companion definitions
     * Each companion has recognizable strengths/weaknesses
     * Assigned based on player's archetype/position
     */
    var STARTER_COMPANIONS = {
        // Barney (Center) - Strong inside, weak everywhere else
        // Paired with: Point Guards (PG) - they need a big man
        barney: {
            id: "barney_dinosaur",
            type: "legend",
            name: "Barney Dinosaur",
            team: "Legends",
            position: "C",
            positionName: "Center",
            status: "signed",
            signCost: 0,
            cutPercent: 10,
            tier: "rookie",
            stats: {
                speed: 3,
                threePt: 2,
                dunk: 5,
                block: 6,
                power: 9,   // Very strong - his signature
                steal: 2
            },
            skin: "barney",
            jersey: 1,
            shortNick: "BARNY",
            isStarter: true,
            rivals: [],
            intro: "You've been paired with \1m\1hBarney\1n, a lumbering \1wCenter\1n\nwho dominates the paint with sheer power.\nHe'll grab boards and protect the rim\nwhile you orchestrate from the perimeter."
        },
        
        // Shrek (Power Forward) - Bruiser, decent defense, not a shooter
        // Paired with: Shooting Guards (SG) - they need frontcourt muscle
        shrek: {
            id: "shrek_ogre",
            type: "legend",
            name: "Shrek",
            team: "Swamp Monsters",
            position: "PF",
            positionName: "Power Forward",
            status: "signed",
            signCost: 0,
            cutPercent: 10,
            tier: "rookie",
            stats: {
                speed: 4,
                threePt: 2,
                dunk: 6,
                block: 5,
                power: 8,   // Strong bruiser
                steal: 3
            },
            skin: "shrek",
            jersey: 22,
            shortNick: "SHREK",
            isStarter: true,
            rivals: [],
            intro: "You've been paired with \1g\1hShrek\1n, a bruising \1wPower Forward\1n\nfrom the swamp. He'll bang bodies in the post\nand clear the lane while you rain\nthrees from the outside."
        },
        
        // Air Bud (Shooting Guard) - Good shooter, decent speed, weak inside
        // Paired with: Power Forwards (PF) - they need perimeter help
        airbud: {
            id: "air_bud",
            type: "legend",
            name: "Air Bud",
            team: "Fernfield Timberwolves",
            position: "SG",
            positionName: "Shooting Guard",
            status: "signed",
            signCost: 0,
            cutPercent: 10,
            tier: "rookie",
            stats: {
                speed: 6,
                threePt: 7,   // Good shooter
                dunk: 3,
                block: 2,
                power: 3,     // Not very strong
                steal: 5
            },
            skin: "airbud",
            jersey: 7,
            shortNick: "AIRBUD",
            isStarter: true,
            rivals: [],
            intro: "You've been paired with \1y\1hAir Bud\1n, a scrappy \1wShooting Guard\1n\nwith a silky jumper. He'll stretch the floor\nand knock down open shots while you\nwork the paint."
        },
        
        // Sonic (Point Guard) - Very fast, good steals, can shoot, weak inside
        // Paired with: Centers (C) - they need a speedy ball handler
        sonic: {
            id: "sonic_hedgehog",
            type: "legend",
            name: "Sonic",
            team: "Green Hill Zone",
            position: "PG",
            positionName: "Point Guard",
            status: "signed",
            signCost: 0,
            cutPercent: 10,
            tier: "rookie",
            stats: {
                speed: 10,    // Lightning fast - his signature
                threePt: 5,
                dunk: 2,      // Not a finisher
                block: 2,
                power: 2,     // Very weak
                steal: 7      // Quick hands
            },
            skin: "sonic",
            jersey: 1,
            shortNick: "SONIC",
            isStarter: true,
            rivals: [],
            intro: "You've been paired with \1c\1hSonic\1n, a lightning-fast \1wPoint Guard\1n\nwho'll handle tempo and rack up steals.\nHe'll push the pace and find you\nfor easy buckets in the paint."
        },
        
        // Donatello (Small Forward) - Balanced wing, decent at everything
        // Paired with: Small Forwards (SF) - two-wing attack
        donatello: {
            id: "donatello_tmnt",
            type: "legend",
            name: "Donatello",
            team: "Ninja Turtles",
            position: "SF",
            positionName: "Small Forward",
            status: "signed",
            signCost: 0,
            cutPercent: 10,
            tier: "rookie",
            stats: {
                speed: 5,
                threePt: 5,
                dunk: 5,
                block: 5,
                power: 5,
                steal: 5      // Bo staff reach
            },
            skin: "donatello",
            jersey: 4,
            shortNick: "DONNIE",
            isStarter: true,
            rivals: [],
            intro: "You've been paired with \1m\1hDonatello\1n, a balanced \1wSmall Forward\1n\nwith the mind of a scientist and the reach of a bo staff.\nTogether you'll form a versatile wing duo\nthat can attack from anywhere."
        }
    };
    
    /**
     * Position to companion mapping
     * Guards get bigs, bigs get guards, SF gets another SF
     */
    var POSITION_COMPANION_MAP = {
        PG: "barney",      // Point Guard → Center (Barney)
        SG: "shrek",       // Shooting Guard → Power Forward (Shrek)
        SF: "donatello",   // Small Forward → Small Forward (Donatello)
        PF: "airbud",      // Power Forward → Shooting Guard (Air Bud)
        C:  "sonic"        // Center → Point Guard (Sonic)
    };
    
    /**
     * Create contact entry from defeated NBA player
     * @param {Object} nbaPlayer - Player data from rosters.ini or opponent
     * @param {Object} ctx - Player context (to check if already have contact)
     * @returns {Object|null} - Contact object or null if already exists
     */
    function createContact(nbaPlayer, ctx) {
        if (!nbaPlayer || !nbaPlayer.name) return null;
        
        // Generate unique ID
        var id = generateContactId(nbaPlayer);
        
        // Check if already exists
        if (hasContact(ctx, id)) return null;
        
        // Determine tier
        var tier = determineTier(nbaPlayer);
        var config = TIER_CONFIG[tier];
        
        // Build stats from player data - stats may be nested in nbaPlayer.stats object
        var srcStats = nbaPlayer.stats || {};
        var stats = {
            speed: srcStats.speed || nbaPlayer.speed || nbaPlayer.spd || 5,
            threePt: srcStats["3point"] || srcStats.threePt || nbaPlayer.three_pt || nbaPlayer.threePt || nbaPlayer.tpt || 5,
            dunk: srcStats.dunk || nbaPlayer.dunk || nbaPlayer.dnk || 5,
            block: srcStats.block || nbaPlayer.block || nbaPlayer.blk || 5,
            power: srcStats.power || nbaPlayer.power || nbaPlayer.pwr || 5,
            steal: srcStats.steal || nbaPlayer.steal || nbaPlayer.stl || 5
        };
        
        // Get shortNick from nbaPlayer.shortNicks array (from rosters.ini) or generate from name
        var shortNick;
        if (nbaPlayer.shortNicks && nbaPlayer.shortNicks.length > 0) {
            shortNick = nbaPlayer.shortNicks[0].substring(0, 8).toUpperCase();
        } else {
            var nameParts = String(nbaPlayer.name || "").split(" ");
            shortNick = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
            shortNick = shortNick.substring(0, 8).toUpperCase();
        }
        
        return {
            id: id,
            type: "nba",
            name: nbaPlayer.name,
            team: nbaPlayer.team || null,
            status: "contact",           // "contact" | "temp" | "signed"
            signCost: config.signCost,
            cutPercent: config.cutPercent,
            tier: tier,
            stats: stats,
            skin: nbaPlayer.skin || "brown",
            jersey: nbaPlayer.jersey || Math.floor(Math.random() * 99) + 1,
            shortNick: shortNick,
            dateAcquired: Date.now(),
            // Rivals: can't be on same crew with these player keys
            rivals: nbaPlayer.rivals || []
        };
    }
    
    /**
     * Generate unique contact ID from player name
     */
    function generateContactId(player) {
        var name = String(player.name || "unknown").toLowerCase();
        return name.replace(/[^a-z0-9]/g, "_");
    }
    
    /**
     * Determine player tier based on name/stats
     */
    function determineTier(player) {
        var name = String(player.name || "").toLowerCase();
        
        // Check superstar list
        for (var i = 0; i < SUPERSTARS.length; i++) {
            if (name.indexOf(SUPERSTARS[i]) !== -1) {
                return "superstar";
            }
        }
        
        // Check by stats if available
        var avgStat = 0;
        var statCount = 0;
        var statFields = ["speed", "spd", "three_pt", "threePt", "dunk", "dnk", "block", "blk"];
        
        for (var s = 0; s < statFields.length; s++) {
            if (typeof player[statFields[s]] === "number") {
                avgStat += player[statFields[s]];
                statCount++;
            }
        }
        
        if (statCount > 0) {
            avgStat = avgStat / statCount;
            if (avgStat >= 85) return "star";
            if (avgStat >= 70) return "role";
        }
        
        return "rookie";
    }
    
    /**
     * Check if player already has this contact
     */
    function hasContact(ctx, contactId) {
        if (!ctx.contacts) return false;
        for (var i = 0; i < ctx.contacts.length; i++) {
            if (ctx.contacts[i].id === contactId) return true;
        }
        return false;
    }
    
    /**
     * Add contact to player's contact list
     * @returns {boolean} true if added, false if already exists
     */
    function addContact(ctx, contact) {
        if (!contact || !contact.id) return false;
        if (!ctx.contacts) ctx.contacts = [];
        
        if (hasContact(ctx, contact.id)) return false;
        
        ctx.contacts.push(contact);
        return true;
    }
    
    /**
     * Get contact by ID
     */
    function getContact(ctx, contactId) {
        if (!ctx.contacts) return null;
        for (var i = 0; i < ctx.contacts.length; i++) {
            if (ctx.contacts[i].id === contactId) {
                return ctx.contacts[i];
            }
        }
        return null;
    }
    
    /**
     * Get all crew members with their contact data
     * @returns {Array} Array of contact objects for crew members
     */
    function getCrewWithContacts(ctx) {
        if (!ctx.crew || !ctx.contacts) return [];
        
        var result = [];
        for (var i = 0; i < ctx.crew.length; i++) {
            var contact = getContact(ctx, ctx.crew[i].contactId);
            if (contact) {
                result.push(contact);
            }
        }
        return result;
    }
    
    /**
     * Calculate cut percentage from the active teammate (who played in the game)
     * Only the active teammate takes a cut, reserves don't get paid for sitting
     * @returns {number} Cut percentage (0-100)
     */
    function calculateCrewCut(ctx) {
        var teammate = getActiveTeammate(ctx);
        if (!teammate || teammate.status !== "temp") {
            return 0;
        }
        return teammate.cutPercent || 0;
    }
    
    /**
     * Apply crew cut to winnings - only the active teammate gets paid
     * @param {Object} ctx - Player context
     * @param {number} grossWinnings - Amount won before cuts
     * @returns {Object} { net: number, cuts: Array<{name, amount}> }
     */
    function applyCrewCut(ctx, grossWinnings) {
        var cuts = [];
        var totalCut = 0;
        
        // Only the active teammate (who played) gets a cut
        var teammate = getActiveTeammate(ctx);
        if (teammate && teammate.status === "temp") {
            var cutAmount = Math.floor(grossWinnings * (teammate.cutPercent / 100));
            if (cutAmount > 0) {
                cuts.push({
                    name: teammate.name,
                    amount: cutAmount,
                    percent: teammate.cutPercent
                });
                totalCut += cutAmount;
            }
        }
        
        return {
            gross: grossWinnings,
            net: grossWinnings - totalCut,
            cuts: cuts,
            totalCut: totalCut
        };
    }
    
    /**
     * Get a random crew member for 2v2 games
     * @returns {Object|null} Contact object or null if no crew
     */
    function getRandomCrewMember(ctx) {
        var crew = getCrewWithContacts(ctx);
        if (crew.length === 0) return null;
        
        var index = Math.floor(Math.random() * crew.length);
        return crew[index];
    }
    
    /**
     * Get the active teammate for 2v2 games
     * If no active set, returns first crew member or null
     * @returns {Object|null} Contact object or null if no crew
     */
    function getActiveTeammate(ctx) {
        var crew = getCrewWithContacts(ctx);
        if (crew.length === 0) return null;
        
        // Check if we have an active teammate set
        if (ctx.activeTeammate) {
            for (var i = 0; i < crew.length; i++) {
                if (crew[i].id === ctx.activeTeammate) {
                    return crew[i];
                }
            }
        }
        
        // Default to first crew member if no active set or not found
        return crew[0];
    }
    
    /**
     * Set the active teammate for 2v2 games
     * @param {string} contactId - ID of the contact to set as active
     * @returns {boolean} True if set successfully
     */
    function setActiveTeammate(ctx, contactId) {
        // Verify the contact is in the crew
        var crew = getCrewWithContacts(ctx);
        for (var i = 0; i < crew.length; i++) {
            if (crew[i].id === contactId) {
                ctx.activeTeammate = contactId;
                return true;
            }
        }
        return false;
    }
    
    /**
     * Clear the active teammate (e.g., when they leave crew)
     */
    function clearActiveTeammate(ctx) {
        ctx.activeTeammate = null;
    }
    
    /**
     * Award contact after defeating NBA player
     * Called from courts.js after winning against NBA opponent
     * @param {Object} ctx - Player context
     * @param {Object} opponent - Defeated NBA player data
     * @returns {Object|null} - New contact if created, null if already had
     */
    function awardContactFromVictory(ctx, opponent) {
        // Only NBA players give contacts
        if (!opponent || opponent.type === "streetball") return null;
        
        var contact = createContact(opponent, ctx);
        if (contact && addContact(ctx, contact)) {
            return contact;
        }
        return null;
    }
    
    /**
     * Create the starter teammate based on player's archetype/position
     * Called during character creation to give new players a complementary teammate
     * 
     * Position mapping:
     * - PG (Point Guard) → Barney (Center) - needs a big man
     * - SG (Shooting Guard) → Shrek (Power Forward) - needs frontcourt muscle
     * - SF (Small Forward) → Donatello (Small Forward) - versatile wing duo
     * - PF (Power Forward) → Air Bud (Shooting Guard) - needs perimeter help
     * - C (Center) → Sonic (Point Guard) - needs a speedy ball handler
     * 
     * @param {Object} ctx - Player context (must have archetype set)
     * @returns {Object} The starter contact object with intro message
     */
    function createStarterTeammate(ctx) {
        // Initialize arrays if needed
        if (!ctx.contacts) ctx.contacts = [];
        if (!ctx.crew) ctx.crew = [];
        
        // Determine player's position from archetype
        var position = "SF"; // Default
        if (LORB.Data && LORB.Data.getPositionFromArchetype && ctx.archetype) {
            var posInfo = LORB.Data.getPositionFromArchetype(ctx.archetype);
            position = posInfo.id || "SF";
        }
        
        // Store position on context for display/AI hints
        ctx.position = position;
        if (LORB.Data && LORB.Data.POSITIONS && LORB.Data.POSITIONS[position]) {
            ctx.positionName = LORB.Data.POSITIONS[position].name;
            ctx.positionCategory = LORB.Data.POSITIONS[position].category;
        }
        
        // Get companion based on position
        var companionKey = POSITION_COMPANION_MAP[position] || "barney";
        var template = STARTER_COMPANIONS[companionKey];
        
        if (!template) {
            // Fallback to Barney if something goes wrong
            template = STARTER_COMPANIONS.barney;
        }
        
        // Create a copy of the companion template
        var companion = {
            id: template.id,
            type: template.type,
            name: template.name,
            team: template.team,
            position: template.position,
            positionName: template.positionName,
            status: template.status,
            signCost: template.signCost,
            cutPercent: template.cutPercent,
            tier: template.tier,
            stats: {},
            skin: template.skin,
            jersey: template.jersey,
            shortNick: template.shortNick,
            dateAcquired: Date.now(),
            isStarter: true,
            rivals: template.rivals.slice(),
            intro: template.intro
        };
        
        // Deep copy stats
        for (var stat in template.stats) {
            if (template.stats.hasOwnProperty(stat)) {
                companion.stats[stat] = template.stats[stat];
            }
        }
        
        // Add to contacts
        ctx.contacts.push(companion);
        
        // Add to crew
        ctx.crew.push({ contactId: companion.id });
        
        // Set as active teammate
        ctx.activeTeammate = companion.id;
        
        // Store intro for display during character creation
        ctx._starterCompanionIntro = companion.intro;
        ctx._starterCompanionName = companion.name;
        
        return companion;
    }
    
    /**
     * Get starter companion by key (for testing/debug)
     * @param {string} key - Companion key (barney, shrek, airbud, sonic, donatello)
     * @returns {Object|null} Companion template or null
     */
    function getStarterCompanionTemplate(key) {
        return STARTER_COMPANIONS[key] || null;
    }
    
    /**
     * Check if two players are rivals
     * Rivalry is bidirectional - if A has B as rival, they are rivals
     * even if B doesn't list A (though ideally both should list each other)
     * @param {Object} contact1 - First contact object
     * @param {Object} contact2 - Second contact object  
     * @returns {boolean} True if they are rivals
     */
    function areRivals(contact1, contact2) {
        if (!contact1 || !contact2) return false;
        
        // Check if contact1 has contact2 as rival
        if (contact1.rivals && contact1.rivals.length > 0) {
            for (var i = 0; i < contact1.rivals.length; i++) {
                var rivalKey = contact1.rivals[i];
                // Match by id (normalized name) or by original key
                if (contact2.id === rivalKey || 
                    contact2.id === rivalKey.split(".").pop() ||
                    (contact2.key && contact2.key === rivalKey)) {
                    return true;
                }
            }
        }
        
        // Check reverse - if contact2 has contact1 as rival
        if (contact2.rivals && contact2.rivals.length > 0) {
            for (var j = 0; j < contact2.rivals.length; j++) {
                var rivalKey2 = contact2.rivals[j];
                if (contact1.id === rivalKey2 || 
                    contact1.id === rivalKey2.split(".").pop() ||
                    (contact1.key && contact1.key === rivalKey2)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Check if adding a contact to crew would cause a rival conflict
     * @param {Object} ctx - Player context
     * @param {Object} newContact - Contact to potentially add
     * @returns {Object|null} - Conflicting crew member if found, null if no conflict
     */
    function checkCrewRivalConflict(ctx, newContact) {
        if (!newContact) return null;
        
        var crew = getCrewWithContacts(ctx);
        for (var i = 0; i < crew.length; i++) {
            if (areRivals(newContact, crew[i])) {
                return crew[i];  // Return the conflicting crew member
            }
        }
        return null;
    }
    
    /**
     * Get all rivals of a contact that are in the player's rolodex
     * @param {Object} ctx - Player context
     * @param {Object} contact - Contact to check
     * @returns {Array} Array of contact objects who are rivals
     */
    function getRivalsInRolodex(ctx, contact) {
        if (!contact || !contact.rivals || contact.rivals.length === 0) return [];
        if (!ctx.contacts) return [];
        
        var rivals = [];
        for (var i = 0; i < ctx.contacts.length; i++) {
            if (ctx.contacts[i].id !== contact.id && areRivals(contact, ctx.contacts[i])) {
                rivals.push(ctx.contacts[i]);
            }
        }
        return rivals;
    }
    
    /**
     * Get smack talk that a player might say about their rival
     * @param {Object} speaker - Contact who is speaking
     * @param {Object} target - Contact being talked about (their rival)
     * @returns {string} Smack talk string
     */
    function getRivalSmackTalk(speaker, target) {
        var smackTalk = [
            "{speaker} can't guard me, never could.",
            "Tell {speaker} I said hi... and goodbye.",
            "{speaker}? Please. I own that matchup.",
            "They still comparing me to {speaker}? That's cute.",
            "{speaker} knows the deal. Ask about our head-to-head.",
            "Every time I see {speaker}, it's buckets.",
            "{speaker} is good, but not {me} good.",
            "I respect {speaker}'s game... just not that much.",
            "{speaker} talks a lot for someone I always beat.",
            "Put {speaker} on me. I dare you."
        ];
        
        var line = smackTalk[Math.floor(Math.random() * smackTalk.length)];
        
        // Get first name or nickname for speaker reference
        var speakerName = target.shortNick || target.name.split(" ")[0];
        var myName = speaker.shortNick || speaker.name.split(" ")[0];
        
        line = line.replace(/\{speaker\}/g, speakerName);
        line = line.replace(/\{me\}/g, myName);
        
        return line;
    }

    // Export
    if (!LORB.Util) LORB.Util = {};
    LORB.Util.Contacts = {
        createContact: createContact,
        addContact: addContact,
        hasContact: hasContact,
        getContact: getContact,
        getCrewWithContacts: getCrewWithContacts,
        calculateCrewCut: calculateCrewCut,
        applyCrewCut: applyCrewCut,
        getRandomCrewMember: getRandomCrewMember,
        getActiveTeammate: getActiveTeammate,
        setActiveTeammate: setActiveTeammate,
        clearActiveTeammate: clearActiveTeammate,
        awardContactFromVictory: awardContactFromVictory,
        createStarterTeammate: createStarterTeammate,
        getStarterCompanionTemplate: getStarterCompanionTemplate,
        areRivals: areRivals,
        checkCrewRivalConflict: checkCrewRivalConflict,
        getRivalsInRolodex: getRivalsInRolodex,
        getRivalSmackTalk: getRivalSmackTalk,
        TIER_CONFIG: TIER_CONFIG,
        STARTER_COMPANIONS: STARTER_COMPANIONS,
        POSITION_COMPANION_MAP: POSITION_COMPANION_MAP
    };
    
})();
