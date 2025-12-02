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
     * Create the starter teammate (Barney Dinosaur)
     * Called during character creation to give new players a teammate
     * @param {Object} ctx - Player context
     * @returns {Object} The starter contact object
     */
    function createStarterTeammate(ctx) {
        // Initialize arrays if needed
        if (!ctx.contacts) ctx.contacts = [];
        if (!ctx.crew) ctx.crew = [];
        
        // Barney Dinosaur - the comedic starter teammate
        var barney = {
            id: "barney_dinosaur",
            type: "legend",
            name: "Barney Dinosaur",
            team: "Legends",
            status: "signed",           // Starts as signed (permanent)
            signCost: 0,                 // Free - he's your buddy
            cutPercent: 10,              // Takes a small cut
            tier: "rookie",             // Mechanically a rookie tier
            stats: {
                speed: 3,
                threePt: 3,
                dunk: 3,
                block: 3,
                power: 10,              // His one strong suit
                steal: 3
            },
            skin: "barney",
            jersey: 1,
            shortNick: "BARNY",
            dateAcquired: Date.now(),
            isStarter: true,              // Flag to identify starter teammate
            rivals: []                    // Barney has no rivals, he loves everyone
        };
        
        // Add to contacts
        ctx.contacts.push(barney);
        
        // Add to crew
        ctx.crew.push({ contactId: barney.id });
        
        // Set as active teammate
        ctx.activeTeammate = barney.id;
        
        return barney;
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
        areRivals: areRivals,
        checkCrewRivalConflict: checkCrewRivalConflict,
        getRivalsInRolodex: getRivalsInRolodex,
        getRivalSmackTalk: getRivalSmackTalk,
        TIER_CONFIG: TIER_CONFIG
    };
    
})();
