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
            dateAcquired: Date.now()
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
            isStarter: true              // Flag to identify starter teammate
        };
        
        // Add to contacts
        ctx.contacts.push(barney);
        
        // Add to crew
        ctx.crew.push({ contactId: barney.id });
        
        // Set as active teammate
        ctx.activeTeammate = barney.id;
        
        return barney;
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
        TIER_CONFIG: TIER_CONFIG
    };
    
})();
