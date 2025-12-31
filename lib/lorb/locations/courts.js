/**
 * courts.js - Hit the Courts (Streetball)
 * 
 * Layout:
 *   LEFT (content): Narrative text - tighter, efficient
 *   RIGHT TOP (art): 40x20 sprite zone - NBA player fills it, streetball gets dynamic sprite
 *   RIGHT BOTTOM: Stats + menu in banner area (overlaid on sprite bottom for NBA)
 * 
 * Court Selection:
 *   - Shows .bin art for selected court tier (when available)
 *   - SpriteWanderer shows city NBA players, baby ballers, street ballers
 *   - Dynamic art switching when menu selection changes
 */

var _courtsRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _courtsRichView = RichView;
} catch (e) {
}

// Load dependencies
if (typeof BinLoader === "undefined") {
    try { load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js"); } catch (e) {}
}
if (typeof LORB === "undefined" || typeof LORB.getRandomOpponent !== "function") {
    try { load("/sbbs/xtrn/nba_jam/lib/lorb/get_random_opponent.js"); } catch (e) {}
}
// Ensure roster lookup is available for court names
if (typeof LORB === "undefined" || !LORB.Data || !LORB.Data.Roster) {
    try { load("/sbbs/xtrn/nba_jam/lib/lorb/data/roster_lookup.js"); } catch (e) {}
}

// Ensure debug logger is available
if (typeof debugLog !== "function") {
    try { load("/sbbs/xtrn/nba_jam/lib/utils/debug-logger.js"); } catch (e) {}
}

// Sprite system for dynamic streetball players
var _spriteSystemLoaded = false;
function ensureSpriteSystem() {
    if (_spriteSystemLoaded) return true;
    try {
        load("sbbsdefs.js");
        load("frame.js");
        load("sprite.js");
        load("/sbbs/xtrn/nba_jam/lib/rendering/sprite-utils.js");
        _spriteSystemLoaded = true;
        return true;
    } catch (e) {
        return false;
    }
}

// SpriteWanderer and SpriteSelectors are loaded lazily at runtime
var _spriteWandererLoaded = false;
var _spriteWandererClass = null;
var _spriteSelectorsLoaded = false;
var _spriteSelectorsModule = null;

/**
 * Get SpriteWanderer class, loading it lazily if needed
 */
function getSpriteWanderer() {
    if (_spriteWandererLoaded) {
        return _spriteWandererClass;
    }
    _spriteWandererLoaded = true;
    try {
        load("/sbbs/xtrn/nba_jam/lib/lorb/ui/sprite-wanderer.js");
        if (typeof LORB !== "undefined" && LORB.UI && LORB.UI.SpriteWanderer) {
            _spriteWandererClass = LORB.UI.SpriteWanderer;
        }
    } catch (e) {
        // SpriteWanderer is optional - continue without it
    }
    return _spriteWandererClass;
}

/**
 * Get SpriteSelectors module, loading it lazily if needed
 */
function getSpriteSelectors() {
    if (_spriteSelectorsLoaded) {
        return _spriteSelectorsModule;
    }
    _spriteSelectorsLoaded = true;
    try {
        load("/sbbs/xtrn/nba_jam/lib/lorb/util/sprite-selectors.js");
        if (typeof LORB !== "undefined" && LORB.Util && LORB.Util.SpriteSelectors) {
            _spriteSelectorsModule = LORB.Util.SpriteSelectors;
        }
    } catch (e) {
        // SpriteSelectors is optional - continue without it
    }
    return _spriteSelectorsModule;
}

(function() {
    
    var RichView = _courtsRichView;
    var NBA_JAM_ROOT = "/sbbs/xtrn/nba_jam/";
    
    // Foreground color name to attribute mapping for nametags
    var FG_COLOR_MAP = {
        "BLACK": 0, "BLUE": 1, "GREEN": 2, "CYAN": 3, "RED": 4, "MAGENTA": 5,
        "BROWN": 6, "YELLOW": 14, "WHITE": 7, "LIGHTGRAY": 7, "DARKGRAY": 8,
        "LIGHTBLUE": 9, "LIGHTGREEN": 10, "LIGHTCYAN": 11, "LIGHTRED": 12,
        "LIGHTMAGENTA": 13, "LIGHTYELLOW": 14, "LIGHTWHITE": 15
    };
    
    // Background color name to attribute mapping
    var BG_COLOR_MAP = {
        "BLACK": 0, "BG_BLACK": 0, "BLUE": 16, "BG_BLUE": 16, "GREEN": 32, "BG_GREEN": 32,
        "CYAN": 48, "BG_CYAN": 48, "RED": 64, "BG_RED": 64, "MAGENTA": 80, "BG_MAGENTA": 80,
        "BROWN": 96, "BG_BROWN": 96, "YELLOW": 96, "BG_YELLOW": 96,
        "WHITE": 112, "BG_WHITE": 112, "LIGHTGRAY": 112, "BG_LIGHTGRAY": 112
    };
    
    function fgColorToAttr(name) {
        if (!name) return null;
        var upper = String(name).toUpperCase();
        return FG_COLOR_MAP[upper] !== undefined ? FG_COLOR_MAP[upper] : null;
    }
    
    function bgColorToAttr(name) {
        if (!name) return null;
        var upper = String(name).toUpperCase();
        return BG_COLOR_MAP[upper] !== undefined ? BG_COLOR_MAP[upper] : null;
    }
    
    // Map city IDs to team section names (from cities.js)
    var CITY_TO_TEAM = {
        "atl": "hawks", "bos": "celtics", "bkn": "nets", "cha": "hornets",
        "chi": "bulls", "cle": "cavaliers", "dal": "mavericks", "den": "nuggets",
        "det": "pistons", "gsw": "warriors", "hou": "rockets", "ind": "pacers",
        "lac": "clippers", "lal": "lakers", "mem": "grizzlies", "mia": "heat",
        "mil": "bucks", "min": "timberwolves", "nop": "pelicans", "nyk": "knicks",
        "okc": "thunder", "orl": "magic", "phi": "76ers", "phx": "suns",
        "por": "blazers", "sac": "kings", "sas": "spurs", "tor": "raptors",
        "uta": "jazz", "was": "wizards"
    };
    
    // School type labels for each court tier
    var COURT_SCHOOL_TYPES = {
        "middle_school": "Middle School",
        "high_school": "High School",
        "aau": "AAU",
        "college": "University"
    };
    
    // Mascot index for each tier (0=middle_school, 1=high_school, 2=aau, 3=college)
    var COURT_MASCOT_INDEX = {
        "middle_school": 0,
        "high_school": 1,
        "aau": 2,
        "college": 3
    };
    
    // Player index for each tier (best player = college, descending)
    // Using indices into roster sorted by total stats (descending)
    var COURT_PLAYER_INDEX = {
        "middle_school": 3,  // 4th best player
        "high_school": 2,    // 3rd best player
        "aau": 1,            // 2nd best player
        "college": 0         // Best player
    };
    
    /**
     * Get city roster players sorted by total stats (descending).
     * @param {Object} city - City object with id property
     * @returns {Array} Array of player objects sorted by total stats
     */
    function getCityPlayersByStats(city) {
        if (!city || !city.id) return [];
        
        var teamKey = CITY_TO_TEAM[city.id];
        if (!teamKey) return [];
        
        if (typeof LORB === "undefined" || !LORB.Data || !LORB.Data.Roster) {
            return [];
        }
        
        var team = LORB.Data.Roster.getTeam(teamKey);
        if (!team || !team.roster || team.roster.length === 0) {
            return [];
        }
        
        // Get all players with stats
        var players = [];
        for (var i = 0; i < team.roster.length; i++) {
            // roster already contains fully qualified keys like "pistons.cade_cunningham"
            var playerKey = team.roster[i];
            var player = LORB.Data.Roster.getPlayerByKey(playerKey);
            if (player && player.stats) {
                // Calculate total stats
                var total = (player.stats.speed || 0) + 
                           (player.stats.threePt || 0) + 
                           (player.stats.power || 0) + 
                           (player.stats.steal || 0) + 
                           (player.stats.block || 0) + 
                           (player.stats.dunk || 0);
                players.push({ player: player, totalStats: total });
            }
        }
        
        // Sort by total stats descending (best players first)
        players.sort(function(a, b) { return b.totalStats - a.totalStats; });
        
        return players.map(function(p) { return p.player; });
    }
    
    /**
     * Get the dynamic court name for a given tier.
     * Lower courts: "[Player Name] [School Type] [Mascot]"
     * NBA court: "[City Name] [Team Name]" (official team name)
     * 
     * @param {Object} city - City object from LORB.Cities
     * @param {string} courtId - Court ID (middle_school, high_school, aau, college, nba)
     * @returns {string} Dynamic court name
     */
    function getCourtName(city, courtId) {
        if (!city) return "";
        
        // NBA court uses official team name
        if (courtId === "nba") {
            return (city.cityName || "") + " " + (city.teamName || "");
        }
        
        // Get school type label
        var schoolType = COURT_SCHOOL_TYPES[courtId];
        if (!schoolType) return "";
        
        // Get player index for this tier
        var playerIndex = COURT_PLAYER_INDEX[courtId];
        if (playerIndex === undefined) playerIndex = 0;
        
        // Get mascot index for this tier
        var mascotIndex = COURT_MASCOT_INDEX[courtId];
        if (mascotIndex === undefined) mascotIndex = 0;
        
        // Get roster players sorted by stats
        var players = getCityPlayersByStats(city);
        var playerName = "";
        if (players.length > playerIndex && players[playerIndex]) {
            // Use just the last name for space
            var fullName = players[playerIndex].name || "";
            var nameParts = fullName.split(" ");
            playerName = nameParts[nameParts.length - 1];
        }
        
        // Get mascot from city's mascots array (loaded from cities.json)
        var mascot = "";
        if (city.mascots && city.mascots.length > mascotIndex) {
            mascot = city.mascots[mascotIndex];
        }
        
        // Build court name: "[Player] [School Type] [Mascot]"
        var parts = [];
        if (playerName) parts.push(playerName);
        parts.push(schoolType);
        if (mascot) parts.push(mascot);
        
        return parts.join(" ");
    }
    
    // Court definitions - progression from youth to pro
    var COURTS = {
        middle_school: {
            id: "middle_school",
            name: "Middle School",
            tagline: "Where Legends Begin",
            repRequired: 0,
            difficulty: 1,
            rewards: { cashBase: 50, repBase: 2, xpBase: 10 },
            nbaChance: 0.1
        },
        high_school: {
            id: "high_school",
            name: "High School",
            tagline: "Varsity Dreams",
            repRequired: 25,
            difficulty: 2,
            rewards: { cashBase: 100, repBase: 4, xpBase: 25 },
            nbaChance: 0.25
        },
        aau: {
            id: "aau",
            name: "AAU Circuit",
            tagline: "Elite Prospects",
            repRequired: 75,
            difficulty: 3,
            rewards: { cashBase: 200, repBase: 8, xpBase: 50 },
            nbaChance: 0.4
        },
        college: {
            id: "college",
            name: "College",
            tagline: "March Madness",
            repRequired: 150,
            difficulty: 4,
            rewards: { cashBase: 400, repBase: 15, xpBase: 100 },
            nbaChance: 0.6
        },
        nba: {
            id: "nba",
            name: "The League",
            tagline: "The Red Bull Waits",
            repRequired: 300,
            difficulty: 5,
            rewards: { cashBase: 1000, repBase: 50, xpBase: 500 },
            boss: true,
            nbaChance: 0.8
        }
    };
    
    // Streetball names by court tier
    var STREETBALL_NAMES = {
        1: ["Lil' Hoops", "Recess Ronnie", "Lunch Break Larry", "Playground Pete"],
        2: ["Varsity Vic", "JV Jimmy", "Letterman Lou", "Senior Sam"],
        3: ["Five-Star Freddy", "Showcase Shawn", "Elite Eddie", "Top Prospect"],
        4: ["March Mike", "Final Four Frank", "Bracket Buster", "Big Dance Dave"],
        5: ["The Red Bull", "His Airness", "The GOAT", "Phantom"]
    };
    
    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
    
    // Skin options for streetballers
    var SKINS = ["brown", "lightgray", "magenta"];
    
    // Nemesis encounter weight multiplier (nemesis gets this many times the weight of a normal opponent)
    var NEMESIS_WEIGHT_MULTIPLIER = 2;
    
    // Cooldown turns after dismissing a nemesis (they won't appear for this many encounter attempts)
    var NEMESIS_SKIP_COOLDOWN = 5;
    
    var NEMESIS_COOLDOWN_LINES = [
        "{name} storms off. You won't see them again today.",
        "{name} leaves fuming. They'll cool off by tomorrow.",
        "{name} disappears into the alley. They'll be back another day."
    ];
    
    function getAvailableCourts(ctx) {
        var available = [];
        var rep = ctx.rep || 0;
        for (var id in COURTS) {
            if (COURTS.hasOwnProperty(id)) {
                var court = COURTS[id];
                available.push({
                    court: court,
                    unlocked: rep >= court.repRequired,
                    repNeeded: court.repRequired - rep
                });
            }
        }
        return available;
    }
    
    /**
     * Get rep needed to unlock next court
     * Returns {needed: number, courtName: string} or null if all unlocked
     */
    function getRepToNextCourt(ctx) {
        var rep = ctx.rep || 0;
        var thresholds = [];
        for (var id in COURTS) {
            if (COURTS.hasOwnProperty(id)) {
                thresholds.push({ rep: COURTS[id].repRequired, name: COURTS[id].name });
            }
        }
        thresholds.sort(function(a, b) { return a.rep - b.rep; });
        
        for (var i = 0; i < thresholds.length; i++) {
            if (thresholds[i].rep > rep) {
                return { needed: thresholds[i].rep - rep, courtName: thresholds[i].name };
            }
        }
        return null; // All courts unlocked
    }
    
    // ========== BABY BALLER ENCOUNTER SYSTEM ==========
    
    /**
     * Map court ID to baby baller court tier number
     * Baby ballers use tier 1-5 (Middle School to NBA)
     */
    function courtIdToTier(courtId) {
        var tierMap = {
            "middle_school": 1,
            "high_school": 2,
            "aau": 3,
            "college": 4,
            "nba": 5
        };
        return tierMap[courtId] || 1;
    }
    
    function markNemesisCooldown(ctx, babyId) {
        if (!ctx.nemesisCooldown) ctx.nemesisCooldown = {};
        ctx.nemesisCooldown[babyId] = getSharedGameDay();
    }
    
    function getNemesisCooldownLine(name) {
        var template = pick(NEMESIS_COOLDOWN_LINES);
        return template.replace("{name}", name || "Your nemesis");
    }
    
    /**
     * Get baby baller chance based on court tier
     * Higher tiers have more baby ballers competing
     */
    function getBabyBallerChance(courtTier, ctx) {
        // Check if player has any active nemesis at this court tier (not defeated today, not on cooldown)
        var hasActiveNemesis = false;
        if (ctx.babyBallers && ctx.babyBallers.length > 0) {
            if (!ctx.defeatedNemesisToday) ctx.defeatedNemesisToday = [];
            if (!ctx.skipCounters) ctx.skipCounters = {};
            var gameDay = getSharedGameDay();
            
            for (var i = 0; i < ctx.babyBallers.length; i++) {
                var baby = ctx.babyBallers[i];
                if (baby.currentCourt === courtTier && 
                    baby.isNemesis && 
                    ctx.defeatedNemesisToday.indexOf(baby.id) === -1 &&
                    (!ctx.skipCounters[baby.id] || ctx.skipCounters[baby.id] <= 0) &&
                    (!ctx.nemesisCooldown || ctx.nemesisCooldown[baby.id] !== gameDay)) {
                    hasActiveNemesis = true;
                    break;
                }
            }
        }
        
        // If nemesis is hunting you, MUCH higher chance (60%)
        // Otherwise, base rate: 5% at tier 1, up to 15% at tier 5
        if (hasActiveNemesis) {
            return 0.6;
        }
        return 0.05 + (courtTier - 1) * 0.025;
    }
    
    /**
     * Try to get a baby baller opponent for the current court
     * Prioritizes player's own nemesis children, then world registry
     * 
     * @param {Object} court - Court object
     * @param {Object} ctx - Player context
     * @returns {Object|null} Baby baller opponent or null
     */
    function getBabyBallerOpponent(court, ctx) {
        var courtTier = courtIdToTier(court.id);
        var BB = LORB.Data && LORB.Data.BabyBallers;
        if (!BB) return null;
        var gameDay = getSharedGameDay();
        
        // Initialize daily nemesis tracking if not present
        if (!ctx.defeatedNemesisToday) {
            ctx.defeatedNemesisToday = [];
        }
        
        // First check: player's own nemesis children at this court tier
        // These have VERY HIGH priority - the abandoned child is hunting their parent!
        if (ctx.babyBallers && ctx.babyBallers.length > 0) {
            var nemesisAtCourt = [];
            for (var i = 0; i < ctx.babyBallers.length; i++) {
                var baby = ctx.babyBallers[i];
                // Skip nemesis already defeated today OR on cooldown from reroll
                if (baby.currentCourt === courtTier && 
                    baby.isNemesis && 
                    ctx.defeatedNemesisToday.indexOf(baby.id) === -1 &&
                    (!ctx.skipCounters[baby.id] || ctx.skipCounters[baby.id] <= 0) &&
                    (!ctx.nemesisCooldown || ctx.nemesisCooldown[baby.id] !== gameDay)) {
                    nemesisAtCourt.push(baby);
                }
            }
            // 80% chance for nemesis to appear if any exist at this tier (they're hunting you!)
            if (nemesisAtCourt.length > 0 && Math.random() < 0.8) {
                var nemesis = nemesisAtCourt[Math.floor(Math.random() * nemesisAtCourt.length)];
                return babyBallerToOpponent(nemesis, true, ctx);
            }
        }
        
        // Second check: world registry babies at this court tier
        var worldBabies = BB.getWorldBabyBallersForCourt(courtTier);
        if (worldBabies && worldBabies.length > 0) {
            // Filter out ALL player's own children (nemesis already handled above, good relations excluded)
            var otherBabies = [];
            for (var j = 0; j < worldBabies.length; j++) {
                var wb = worldBabies[j];
                var isOwn = false;
                if (ctx.babyBallers) {
                    for (var k = 0; k < ctx.babyBallers.length; k++) {
                        if (ctx.babyBallers[k].id === wb.id) {
                            isOwn = true;
                            break;
                        }
                    }
                }
                if (!isOwn) {
                    if (ctx.nemesisCooldown && ctx.nemesisCooldown[wb.id] === gameDay) {
                        continue;
                    }
                    otherBabies.push(wb);
                }
            }
            
            if (otherBabies.length > 0) {
                var worldBaby = otherBabies[Math.floor(Math.random() * otherBabies.length)];
                return babyBallerToOpponent(worldBaby, false, ctx);
            }
        }
        
        return null;
    }
    
    /**
     * Convert a baby baller to opponent format
     * Applies nemesis stat boosts if facing their deadbeat parent
     * 
     * @param {Object} baby - Baby baller object
     * @param {boolean} isNemesisMatchup - True if this baby is player's nemesis
     * @param {Object} ctx - Player context (for nemesis detection)
     * @returns {Object} Opponent object for game engine
     */
    function babyBallerToOpponent(baby, isNemesisMatchup, ctx) {
        var BB = LORB.Data && LORB.Data.BabyBallers;
        
        // Get base or nemesis-boosted stats
        var stats;
        if (isNemesisMatchup && BB && BB.getNemesisStats) {
            stats = BB.getNemesisStats(baby);
        }
        if (!stats) {
            stats = baby.stats;
        }
        
        // Generate shortNick from nickname
        var shortNick = (baby.nickname || baby.name || "KID").substring(0, 8).toUpperCase();
        
        // Determine display suffix
        var suffix = "";
        if (isNemesisMatchup) {
            suffix = " \1h\1r[NEMESIS]\1n";
        } else if (baby.parentId) {
            suffix = " \1c[Baby Baller]\1n";
        }
        
        return {
            id: baby.id,
            shortNick: shortNick,
            name: baby.name,
            displayName: baby.nickname + suffix,
            team: "Baby Ballers",
            teamAbbr: "BB",
            isNBA: false,
            isBabyBaller: true,
            isNemesis: isNemesisMatchup,
            babyBallerId: baby.id,
            parentId: baby.parentId,
            skin: baby.appearance ? baby.appearance.skin : "brown",
            jersey: baby.appearance ? baby.appearance.jersey : 1,
            stats: {
                speed: stats.speed || 5,
                "3point": stats.threePt || 5,
                dunk: stats.dunk || 5,
                power: stats.power || 5,
                steal: stats.steal || 5,
                block: stats.block || 5
            },
            // Store original baby reference for post-game processing
            _babyBaller: baby
        };
    }
    
    /**
     * Process post-game outcomes for baby baller matches
     * Handles XP/rep for baby, relationship changes, nemesis effects
     * 
     * @param {Object} ctx - Player context
     * @param {Object} opponent - Baby baller opponent
     * @param {boolean} playerWon - True if player won the match
     * @param {number} winnings - Cash won from the match (for streetball winnings processing)
     * @returns {Object} Result of baby baller processing
     */
    function processBabyBallerMatch(ctx, opponent, playerWon, winnings) {
        if (!opponent.isBabyBaller || !opponent._babyBaller) {
            return null;
        }
        
        var BB = LORB.Data && LORB.Data.BabyBallers;
        if (!BB) return null;
        
        var baby = opponent._babyBaller;
        var result = {
            babyName: baby.nickname || baby.name,
            isNemesis: opponent.isNemesis,
            isOwnChild: false,
            relationship: null,
            xpAwarded: 0,
            repAwarded: 0,
            message: null
        };
        
        // Check if this is the player's own child
        if (ctx.babyBallers) {
            for (var i = 0; i < ctx.babyBallers.length; i++) {
                if (ctx.babyBallers[i].id === baby.id) {
                    result.isOwnChild = true;
                    baby = ctx.babyBallers[i];  // Use the live reference
                    break;
                }
            }
        }
        
        if (playerWon) {
            // Player beat a baby baller
            if (result.isOwnChild) {
                // Beat your own child - slight relationship hit
                if (BB.adjustRelationship) {
                    var relResult = BB.adjustRelationship(ctx, baby.id, -5, "lost_to_parent");
                    result.relationship = relResult ? relResult.newRelationship : null;
                }
                
                if (result.isNemesis) {
                    result.message = baby.nickname + " glares at you with burning hatred...";
                    // Track Oedipus/Vader nemesis matchup
                    if (BB.recordNemesisMatch) {
                        result.nemesisRecord = BB.recordNemesisMatch(ctx, baby.id, true);
                    }
                    // Mark nemesis as defeated for today - they won't reappear
                    if (!ctx.defeatedNemesisToday) {
                        ctx.defeatedNemesisToday = [];
                    }
                    ctx.defeatedNemesisToday.push(baby.id);
                    markNemesisCooldown(ctx, baby.id);
                    result.cooldownMessage = getNemesisCooldownLine(baby.nickname || baby.name);
                } else {
                    result.message = baby.nickname + " takes the L gracefully.";
                }
            } else {
                // Beat someone else's kid - adoption prompt if they were abandoned
                var abandoned = (baby.childSupport && baby.childSupport.isAbandoned) || baby.isAbandoned || (baby.childSupport && baby.childSupport.isAbandoned);
                if (abandoned) {
                    result.adoptionCandidate = baby;
                    result.message = "You beat " + baby.nickname + " on the court!\nThey look lost... maybe you could adopt them.";
                } else {
                    result.message = "You beat " + baby.nickname + " on the court!";
                }
                if (opponent.isNemesis) {
                    markNemesisCooldown(ctx, baby.id);
                    result.cooldownMessage = getNemesisCooldownLine(baby.nickname || baby.name);
                }
            }
        } else {
            // Baby baller won
            // Award XP and rep to the baby
            var xpGain = 50;
            var repGain = 5;
            
            if (BB.awardXp && result.isOwnChild) {
                BB.awardXp(ctx, baby.id, xpGain);
                result.xpAwarded = xpGain;
            }
            if (BB.awardRep && result.isOwnChild) {
                BB.awardRep(ctx, baby.id, repGain);
                result.repAwarded = repGain;
            }
            
            if (result.isOwnChild) {
                // Your child beat you
                if (result.isNemesis) {
                    // Nemesis REVENGE - they take money from you!
                    var stolen = Math.floor(winnings * 0.25);
                    if (stolen > 0) {
                        ctx.cash = Math.max(0, (ctx.cash || 0) - stolen);
                        result.stolenCash = stolen;
                        result.message = "\1h\1r" + baby.nickname + " takes $" + stolen + " as revenge!\1n\n\"That's for abandoning me.\"";
                    } else {
                        result.message = "\1h\1r" + baby.nickname + " dominates you with furious anger!\1n";
                    }
                    
                    // Further relationship decay
                    if (BB.adjustRelationship) {
                        var relResult = BB.adjustRelationship(ctx, baby.id, -3, "beat_parent");
                        result.relationship = relResult ? relResult.newRelationship : null;
                    }
                    
                    // Track Oedipus/Vader nemesis matchup
                    if (BB.recordNemesisMatch) {
                        result.nemesisRecord = BB.recordNemesisMatch(ctx, baby.id, false);
                    }
                } else {
                    // Normal child beats parent - positive relationship boost
                    if (BB.adjustRelationship) {
                        var relResult = BB.adjustRelationship(ctx, baby.id, 5, "beat_parent");
                        result.relationship = relResult ? relResult.newRelationship : null;
                    }
                    result.message = baby.nickname + " is proud of their win! (+5 relationship)";
                }
                
                // Process streetball winnings for the baby
                if (winnings > 0 && BB.processStreetballWinnings) {
                    var winningsResult = BB.processStreetballWinnings(ctx, baby.id, winnings);
                    result.winningsProcessed = winningsResult;
                }
            } else {
                // Someone else's kid beat you
                // Add pending earnings for parent to collect later (pull model)
                result.message = baby.nickname + " shows you how it's done on the court!";
                
                if (BB.addPendingEarnings) {
                    var isPaidOff = baby.childSupport ? baby.childSupport.isPaidOff : false;
                    BB.addPendingEarnings(baby.id, winnings, isPaidOff);
                    result.message += "\n\1k(Earnings pending for parent collection)\1n";
                }
            }
        }
        
        return result;
    }
    
    /**
     * Convert a crew contact to a player object for use in games
     */
    function crewContactToPlayer(contact) {
        if (!contact || !contact.stats) return null;
        
        var stats = contact.stats;
        
        // Generate shortNick if not present
        var shortNick = contact.shortNick;
        if (!shortNick) {
            var nameParts = String(contact.name || "").split(" ");
            shortNick = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
            shortNick = shortNick.substring(0, 8).toUpperCase();
        }
        
        return {
            id: "crew_" + (contact.id || "member"),
            lorbId: contact.id,  // Used by substitution system to match active teammate
            name: contact.name || "Crew Member",
            displayName: contact.name || "Crew Member",
            team: contact.team || "Crew",
            teamAbbr: "CRW",
            isNBA: (contact.type === "nba"),
            skin: contact.skin || "brown",
            jersey: contact.jersey || Math.floor(Math.random() * 99) + 1,
            shortNick: shortNick,
            stats: {
                speed: stats.speed || 5,
                "3point": stats.threePt || stats["3point"] || 5,
                dunk: stats.dunk || 5,
                power: stats.power || 5,
                steal: stats.steal || 5,
                block: stats.block || 5
            }
        };
    }
    
    /**
     * Get a crew member to use as teammate, or null if none available
     * Uses the active teammate if set, otherwise first crew member
     */
    function getCrewTeammate(ctx) {
        if (typeof LORB === "undefined" || !LORB.Util || !LORB.Util.Contacts) return null;
        var crewMember = LORB.Util.Contacts.getActiveTeammate(ctx);
        if (!crewMember) return null;
        return crewContactToPlayer(crewMember);
    }
    
    function generateStreetballOpponent(court) {
        // Get stat range from config for this court tier
        var tierStats = null;
        if (typeof LORB !== "undefined" && LORB.Config && LORB.Config.STREETBALL_STATS_BY_TIER) {
            tierStats = LORB.Config.STREETBALL_STATS_BY_TIER[court.difficulty];
        }
        // Fallback if config not available
        var statMin = tierStats ? tierStats.min : (2 + court.difficulty);
        var statMax = tierStats ? tierStats.max : Math.min(10, 4 + court.difficulty * 2);
        
        var tierNames = STREETBALL_NAMES[court.difficulty] || STREETBALL_NAMES[1];
        var name = tierNames[Math.floor(Math.random() * tierNames.length)];
        if (court.boss) name = "The Red Bull";
        
        // Random skin and jersey
        var skin = SKINS[Math.floor(Math.random() * SKINS.length)];
        var jersey = Math.floor(Math.random() * 99) + 1;
        
        // Generate shortNick from name (first word, up to 8 chars)
        var shortNick = name.split(" ")[0].substring(0, 8).toUpperCase();
        
        // Helper to roll a stat within the tier's min-max range
        function rollStat() {
            return statMin + Math.floor(Math.random() * (statMax - statMin + 1));
        }
        
        // Helper to roll the weakness stat (1 to statMin, inclusive)
        function rollWeakness() {
            return 1 + Math.floor(Math.random() * statMin);
        }
        
        // Roll all 6 stats independently
        var statNames = ["speed", "3point", "dunk", "power", "steal", "block"];
        var stats = {};
        for (var i = 0; i < statNames.length; i++) {
            stats[statNames[i]] = rollStat();
        }
        
        // Pick one random stat to be the weakness and re-roll it
        var weaknessIndex = Math.floor(Math.random() * statNames.length);
        stats[statNames[weaknessIndex]] = rollWeakness();
        
        return {
            id: "street_" + court.difficulty + "_" + Date.now(),
            shortNick: shortNick,
            name: name,
            displayName: name,
            team: "Street",
            teamAbbr: "STR",
            isNBA: false,
            skin: skin,
            jersey: jersey,
            stats: stats
        };
    }
    
    function getNBAOpponent() {
        if (typeof LORB === "undefined") return null;
        
        // Get current city for city-filtered encounters
        var cityId = null;
        if (LORB.Cities && LORB.Cities.getToday) {
            var city = LORB.Cities.getToday();
            if (city && city.id) {
                cityId = city.id;
            }
        }
        
        try {
            var opp = null;
            
            // Use city-filtered opponent selection if available
            if (cityId && typeof LORB.getRandomOpponentForCity === "function") {
                opp = LORB.getRandomOpponentForCity(cityId);
            } else if (typeof LORB.getRandomOpponent === "function") {
                opp = LORB.getRandomOpponent();
            }
            
            if (opp && opp.name && opp.stats) {
                opp.displayName = opp.name;
                opp.isNBA = true;
                return opp;
            }
        } catch (e) {}
        return null;
    }
    
    function generateOpponent(court, ctx) {
        var courtTier = courtIdToTier(court.id);
        
        // Initialize skip counters if not present
        if (!ctx.skipCounters) {
            ctx.skipCounters = {};
        }
        
        // First: Check for NBA encounter (separate from streetball pool)
        if (Math.random() < (court.nbaChance || 0.2)) {
            var nba = getNBAOpponent();
            if (nba) return nba;
        }
        
        // Second: Build streetball pool (baby ballers + generic streetballers)
        var pool = [];
        
        // Determine how many streetballers are available for this tier
        var tierNames = STREETBALL_NAMES[court.difficulty] || STREETBALL_NAMES[1];
        var streetballCount = tierNames.length;
        
        // Add baby ballers to the pool
        var babyOpp = getBabyBallerOpponent(court, ctx);
        if (babyOpp) {
            // Nemesis get higher weight - they're aggressively hunting you down
            // Weight = streetballCount * NEMESIS_WEIGHT_MULTIPLIER
            // Example: 4 streetballers, 2x multiplier = 8 nemesis entries = 8/12 = 67% encounter rate
            var weight = babyOpp.isNemesis ? (streetballCount * NEMESIS_WEIGHT_MULTIPLIER) : 1;
            for (var i = 0; i < weight; i++) {
                pool.push({ type: "baby", opponent: babyOpp });
            }
        }
        
        // Add generic streetball opponents to the pool
        for (var i = 0; i < streetballCount; i++) {
            pool.push({ type: "streetball", opponent: generateStreetballOpponent(court) });
        }
        
        // Pick randomly from the streetball pool
        var pick = pool[Math.floor(Math.random() * pool.length)];
        
        // Decrement skip counters AFTER generation (so cooldown lasts full duration)
        for (var skipId in ctx.skipCounters) {
            if (ctx.skipCounters[skipId] > 0) {
                ctx.skipCounters[skipId]--;
            }
        }
        
        return pick.opponent;
    }
    
    function calculateRewards(court, ctx, scoreDiff) {
        var rewards = court.rewards;
        var mult = scoreDiff >= 20 ? 1.5 : (scoreDiff >= 10 ? 1.25 : 1.0);
        if (ctx.archetype === "UNDERDOG") mult *= 1.25;
        return {
            cash: Math.floor(rewards.cashBase * mult),
            rep: Math.floor(rewards.repBase * mult),
            xp: Math.floor(rewards.xpBase * mult)
        };
    }
    
    function formatStat(val) {
        if (val === undefined || val === null) return "\1k?\1n";
        var c = val >= 9 ? "\1h\1g" : (val >= 7 ? "\1g" : (val <= 3 ? "\1r" : (val <= 5 ? "\1y" : "\1w")));
        return c + val + "\1n";
    }
    
    function createView() {
        // Get city-specific theme for lightbars
        var city = null;
        if (LORB.Cities && LORB.Cities.getToday) {
            city = LORB.Cities.getToday();
        }
        var cityTheme = (LORB.Cities && LORB.Cities.getCityTheme && city) 
            ? LORB.Cities.getCityTheme(city) 
            : "lorb";
        
        // Layout matches hub.js: art LEFT, menu/content RIGHT with tooltip below
        return new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 43, y: 5, width: 38, height: 16 },
                { name: "tooltip", x: 43, y: 21, width: 38, height: 4 }
            ],
            theme: cityTheme
        });
    }
    
    /**
     * Path to court art assets
     */
    var COURT_ART_PATH = NBA_JAM_ROOT + "assets/lorb/";
    
    /**
     * Single court art file - text overlay will make it dynamic
     */
    var COURT_ART_FILE = "courts_art.bin";
    
    /**
     * Load court art into the art zone
     * Uses courts_art.bin, falls back to hub_art.bin
     * Overlays dynamic court name text based on selected court tier.
     * 
     * @param {Object} view - RichView instance
     * @param {string|null} courtId - Court ID for name overlay, or null for no overlay
     */
    function loadCourtArt(view, courtId) {
        var artFrame = view.getZone("art");
        if (!artFrame) return false;
        
        if (typeof BinLoader === "undefined") return false;
        
        var artLoaded = false;
        
        // Try courts_art.bin first
        var artPath = COURT_ART_PATH + COURT_ART_FILE;
        if (file_exists(artPath)) {
            try {
                BinLoader.loadIntoFrame(artFrame, artPath, 40, 20, 1, 1);
                artLoaded = true;
            } catch (e) {
            }
        }
        
        // Fallback to hub_art.bin
        if (!artLoaded) {
            var fallbackPath = COURT_ART_PATH + "hub_art.bin";
            if (file_exists(fallbackPath)) {
                try {
                    BinLoader.loadIntoFrame(artFrame, fallbackPath, 40, 20, 1, 1);
                    artLoaded = true;
                } catch (e) {
                }
            }
        }
        
        // Overlay court name text if we have a courtId
        if (artLoaded && courtId) {
            try {
                // Get current city
                var city = null;
                if (LORB.Cities && LORB.Cities.getToday) {
                    city = LORB.Cities.getToday();
                }
                
                if (city) {
                    var courtName = getCourtName(city, courtId);
                    if (courtName && courtName.length > 0) {
                        // Get team colors for styling - use accent color for court names
                        var fgAttr = 15; // WHITE by default
                        var bgAttr = 0;  // BLACK by default
                        try {
                            if (LORB.Cities && LORB.Cities.getTeamColors) {
                                var colors = LORB.Cities.getTeamColors(city);
                                if (colors) {
                                    fgAttr = colors.fgAccentAttr || colors.fgAttr || 15;
                                    bgAttr = colors.bgAttr || 0;
                                }
                            }
                        } catch (e) {
                            // Use defaults
                        }
                        
                        // Center the text (art frame is 40 wide, but has 1-char padding)
                        var maxWidth = 38;
                        var displayName = courtName;
                        if (displayName.length > maxWidth) {
                            displayName = displayName.substring(0, maxWidth);
                        }
                        var padding = Math.floor((maxWidth - displayName.length) / 2);
                        
                        // Write text on row 1 (maximize vertical space)
                        // Use Frame.setData to write with specific attributes
                        var attr = fgAttr | bgAttr;
                        var row = 1;
                        var startCol = padding + 1;
                        
                        for (var i = 0; i < displayName.length; i++) {
                            artFrame.setData(startCol + i, row, displayName.charAt(i), attr, true);
                        }
                    }
                }
            } catch (e) {
            }
        }
        
        return artLoaded;
    }

    /**
     * Load the header with city name figlet banner (like hub.js)
     */
    function loadHeader(view) {
        var headerFrame = view.getZone("header");
        if (!headerFrame) return;
        
        headerFrame.clear();
        
        // Get current city for figlet banner
        var city = null;
        if (LORB.Cities && LORB.Cities.getToday) {
            city = LORB.Cities.getToday();
        }
        var cityName = (city && city.cityName) ? city.cityName : "Courts";
        
        // Get team color attribute for this city
        var fgAttr = (typeof WHITE === "number") ? WHITE : 7;
        try {
            if (LORB.Cities && LORB.Cities.getTeamColors) {
                var colors = LORB.Cities.getTeamColors(city);
                if (colors && typeof colors.fgAttr === "number") {
                    fgAttr = colors.fgAttr;
                }
            }
        } catch (e) {
            // Use default color
        }
        
        // Try figlet rendering, falls back to plain text automatically
        if (LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
            LORB.Util.FigletBanner.renderToFrame(headerFrame, cityName, fgAttr);
        } else {
            // Fallback: plain centered text
            var padding = Math.floor((80 - cityName.length) / 2);
            headerFrame.gotoxy(padding + 1, 2);
            headerFrame.putmsg("\1h\1w" + cityName + "\1n");
        }
    }

    /**
     * Load NBA player 40x20 .bin art
     */
    function loadNBASprite(view, opponent) {
        if (typeof BinLoader === "undefined") return false;
        var artFrame = view.getZone("art");
        if (!artFrame || !opponent.path || !file_exists(opponent.path)) return false;
        
        BinLoader.loadIntoFrame(artFrame, opponent.path, 40, 20, 1, 1);
        return true;
    }
    
    /**
     * Clean up any sprite resources (placeholder for future sprite preview)
     */
    function cleanupSprite(view) {
        // No-op for now
    }
    
    /**
     * Draw a 5x4 streetball sprite preview in the art zone
     * Simple approach: load bin, parse pixels, apply jersey mask, render
     */
    function drawStreetballSprite(artFrame, opponent, x, y) {
        if (typeof BinLoader === "undefined") return false;
        
        var SPRITE_WIDTH = 5;
        var SPRITE_HEIGHT = 4;
        
        var skin = (opponent.skin || "brown").toLowerCase();
        var binPath = NBA_JAM_ROOT + "sprites/player-" + skin + ".bin";
        
        if (!file_exists(binPath)) return false;
        
        try {
            var binData = BinLoader.loadBinFile(binPath);
            if (!binData) return false;
            
            // Parse first 5x4 frame
            var pixels = [];
            var offset = 0;
            for (var py = 0; py < SPRITE_HEIGHT; py++) {
                pixels[py] = [];
                for (var px = 0; px < SPRITE_WIDTH; px++) {
                    if (offset + 1 < binData.length) {
                        var ch = binData.charAt(offset++);
                        var attr = binData.charCodeAt(offset++);
                        pixels[py][px] = { ch: ch, attr: attr };
                    } else {
                        pixels[py][px] = { ch: ' ', attr: 0 };
                    }
                }
            }
            
            // Get jersey colors from city theme
            var jerseyBg = BG_BLUE;
            var accentFg = WHITE;
            if (LORB && LORB.Cities && LORB.Cities.getToday && LORB.Cities.getTeamColors) {
                var city = LORB.Cities.getToday();
                if (city) {
                    var colors = LORB.Cities.getTeamColors(city);
                    if (colors && typeof colors.bgAltAttr === "number") {
                        jerseyBg = colors.bgAltAttr;
                    }
                    if (colors && typeof colors.fgAccentAttr === "number") {
                        accentFg = colors.fgAccentAttr;
                    }
                }
            }
            
            // Jersey number
            var jerseyNum = String(opponent.jersey || "");
            var digits = jerseyNum.replace(/[^0-9]/g, "");
            var leftDigit = digits.length >= 2 ? digits.charAt(0) : "#";
            var rightDigit = digits.length >= 1 ? digits.charAt(digits.length - 1) : "#";
            if (digits.length === 1) leftDigit = "#";
            
            var digitsAttr = accentFg | jerseyBg;
            
            // Apply jersey mask - row 2, cols 1,2,3
            pixels[2][1] = { ch: leftDigit, attr: digitsAttr };
            var neckCell = pixels[2][2];
            var skinFg = neckCell.attr & 0x0F;
            pixels[2][2] = { ch: String.fromCharCode(223), attr: skinFg | jerseyBg };
            pixels[2][3] = { ch: rightDigit, attr: digitsAttr };
            
            // Shorts - row 3, cols 1,3
            var shortsChar = String.fromCharCode(220);
            var leftLeg = pixels[3][1];
            var shoeFg = leftLeg.attr & 0x0F;
            pixels[3][1] = { ch: shortsChar, attr: shoeFg | jerseyBg };
            var rightLeg = pixels[3][3];
            shoeFg = rightLeg.attr & 0x0F;
            pixels[3][3] = { ch: shortsChar, attr: shoeFg | jerseyBg };
            
            // Render to frame
            for (var ry = 0; ry < SPRITE_HEIGHT; ry++) {
                for (var rx = 0; rx < SPRITE_WIDTH; rx++) {
                    var cell = pixels[ry][rx];
                    var ch = cell.ch;
                    var attr = cell.attr;
                    if (!ch || ch === '\0') ch = ' ';
                    try {
                        artFrame.setData(x + rx - 1, y + ry - 1, ch, attr, false);
                    } catch (e) {
                        artFrame.gotoxy(x + rx, y + ry);
                        artFrame.putmsg(ch);
                    }
                }
            }
            
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Draw the right panel for challenger encounter
     * NBA: Full 40x20 sprite with name/team overlaid at bottom, stats+menu in banner
     * Streetball: Dynamic 5x4 sprite top-right, stats+menu below
     */
    function drawChallengerPanel(view, opponent) {
        var artFrame = view.getZone("art");
        if (!artFrame) return;
        
        artFrame.clear();
        cleanupSprite(view);
        
        if (opponent.isNBA) {
            // Load full 40x20 NBA player art
            var loaded = loadNBASprite(view, opponent);
            
            // Overlay name/team at bottom of sprite (rows 17-18)
            artFrame.gotoxy(2, 17);
            artFrame.putmsg("\1h\1m" + opponent.displayName + "\1n");
            artFrame.gotoxy(2, 18);
            artFrame.putmsg("\1m" + (opponent.team || "NBA") + " #" + (opponent.jersey || "??") + "\1n");
            
        } else {
            // Streetball: Draw title area
            artFrame.gotoxy(2, 2);
            artFrame.putmsg("\1h\1y" + opponent.displayName + "\1n");
            artFrame.gotoxy(2, 3);
            artFrame.putmsg("\1k\1hStreetballer #" + (opponent.jersey || "?") + "\1n");
            
            // Draw sprite preview (centered, between name and stats)
            drawStreetballSprite(artFrame, opponent, 18, 6);
        }
        
        // Stats section (same position for both)
        var statsY = 12;
        artFrame.gotoxy(2, statsY);
        artFrame.putmsg("\1k" + repeatChar("\xC4", 36) + "\1n");
        
        var stats = opponent.stats || {};
        artFrame.gotoxy(2, statsY + 1);
        artFrame.putmsg("\1cSPD\1n " + formatStat(stats.speed) + "  \1c3PT\1n " + formatStat(stats["3point"]) + "  \1cDNK\1n " + formatStat(stats.dunk));
        
        artFrame.gotoxy(2, statsY + 2);
        artFrame.putmsg("\1cPWR\1n " + formatStat(stats.power) + "  \1cSTL\1n " + formatStat(stats.steal) + "  \1cBLK\1n " + formatStat(stats.block));
        
        view.render();
    }
    
    /**
     * Show challenger encounter
     */
    function showChallengerEncounter(view, court, opponent, ctx) {
        cleanupSprite(view);
        view.clearZone("content");
        view.clearZone("art");
        
        // LEFT: Narrative (tight, efficient)
        view.setContentZone("content");
        view.setCursorY(0);
        
        // Header with tagline
        view.header(court.name + " - " + court.tagline);
        view.blank();
        
        view.line("\1cA challenger approaches...\1n");
        view.blank();
        
        if (opponent.isNBA) {
            view.line("\1h\1m" + opponent.displayName + "\1n");
            view.line("\1msteps onto the court!\1n");
            view.blank();
            view.line("\1k\1hAn NBA player! Beat them\1n");
            view.line("\1k\1hfor serious bragging rights.\1n");
        } else if (opponent.isBabyBaller && opponent.isNemesis) {
            // NEMESIS CHILD - dramatic encounter!
            view.line("\1h\1r" + opponent.displayName + "\1n");
            view.line("\1rblocks your path!\1n");
            view.blank();
            view.line("\1h\1r\"You abandoned me...\"\1n");
            view.line("\1h\1r\"Now you'll pay.\"\1n");
            view.blank();
            view.line("\1r\1h⚠ NEMESIS MATCH ⚠\1n");
            view.line("\1yThey're powered by rage!\1n");
        } else if (opponent.isBabyBaller) {
            // Regular baby baller encounter
            view.line("\1h\1c" + opponent.displayName + "\1n");
            view.line("\1csteps onto the court.\1n");
            view.blank();
            view.line("\1k\1hA young baller making\1n");
            view.line("\1k\1htheir name on the streets.\1n");
        } else {
            view.line("\1h\1y" + opponent.displayName + "\1n");
            view.line("\1ysteps onto the court.\1n");
            view.blank();
            view.line("\1k\1hAnother baller looking to\1n");
            view.line("\1k\1hmake a name on the streets.\1n");
        }
        
        view.blank();
        view.line("Street Turns: " + (ctx.streetTurns > 0 ? "\1g" : "\1r") + ctx.streetTurns + "\1n");
        view.line("Your Rep: \1c" + (ctx.rep || 0) + "\1n");
        
        // Show active teammate if available
        if (typeof LORB !== "undefined" && LORB.Util && LORB.Util.Contacts) {
            var teammate = LORB.Util.Contacts.getActiveTeammate(ctx);
            if (teammate && teammate.name) {
                view.line("Teammate: \1h\1y" + teammate.name + "\1n");
            } else {
                view.line("Teammate: \1kNone (solo)\1n");
            }
        }
        
        // RIGHT: Sprite + Stats
        drawChallengerPanel(view, opponent);
        
        // Menu at bottom of art zone
        view.setContentZone("art");
        view.setCursorY(16);
        
        var items = [
            { text: "Accept Challenge", value: "play", hotkey: "P" },
            { text: "Find Another", value: "reroll", hotkey: "R" },
            { text: "Back Out", value: "back", hotkey: "Q" }
        ];
        
        return view.menu(items, { y: 17, width: 36 });
    }
    
    function buildCourtMenuItems(ctx) {
        var courts = getAvailableCourts(ctx);
        var items = [];
        var num = 1;
        
        for (var i = 0; i < courts.length; i++) {
            var c = courts[i];
            var court = c.court;
            
            // Simple text - tooltip provides details
            // NOT disabled so user can hover to see info even when locked
            var text = court.name;
            if (court.boss) text += " *";
            if (!c.unlocked) text += " [LOCKED]";
            
            items.push({
                text: text,
                value: court.id,
                hotkey: String(num),
                _court: court,
                _unlocked: c.unlocked
            });
            num++;
        }
        
        items.push({ text: "Back", value: "back", hotkey: "Q" });
        return items;
    }
    
    /**
     * Draw court info in the tooltip zone (below menu, right side)
     * Like hub.js tooltip pattern
     */
    function drawCourtTooltip(view, court, unlocked) {
        var tooltipFrame = view.getZone("tooltip");
        if (!tooltipFrame) return;
        
        tooltipFrame.clear();
        
        // Get city theme colors
        var city = LORB.Cities && LORB.Cities.getToday ? LORB.Cities.getToday() : null;
        var teamColors = (LORB.Cities && LORB.Cities.getTeamColors) 
            ? LORB.Cities.getTeamColors(city) 
            : { fgFromBg: "\1b", fgFromBgAlt: "\1y" };
        var borderColor = "\1h" + (teamColors.fgFromBgAlt || "\1y");
        var textColor = "\1h" + (teamColors.fgFromBg || "\1b");
        
        var innerWidth = 36;
        
        // Build tooltip content
        var stars = "";
        for (var i = 0; i < court.difficulty; i++) stars += "*";
        
        var line1 = court.name + (unlocked ? "" : " [LOCKED]");
        var line2 = stars + " - $" + court.rewards.cashBase + " / +" + court.rewards.repBase + " rep";
        
        // Center lines
        function pad(text, width) {
            var left = Math.floor((width - text.length) / 2);
            var right = width - text.length - left;
            return repeat(" ", left) + text + repeat(" ", right);
        }
        
        // Draw box
        tooltipFrame.gotoxy(1, 1);
        tooltipFrame.putmsg(borderColor + "\xDA" + repeat("\xC4", innerWidth) + "\xBF\1n");
        
        tooltipFrame.gotoxy(1, 2);
        tooltipFrame.putmsg(borderColor + "\xB3" + textColor + pad(line1, innerWidth) + borderColor + "\xB3\1n");
        
        tooltipFrame.gotoxy(1, 3);
        tooltipFrame.putmsg(borderColor + "\xB3" + textColor + pad(line2, innerWidth) + borderColor + "\xB3\1n");
        
        tooltipFrame.gotoxy(1, 4);
        tooltipFrame.putmsg(borderColor + "\xC0" + repeat("\xC4", innerWidth) + "\xD9\1n");
    }
    
    // Helper for repeating characters
    function repeat(ch, count) {
        var s = "";
        for (var i = 0; i < count; i++) s += ch;
        return s;
    }
    
    function ctxToPlayer(ctx) {
        // Start with base stats, then apply equipment/drink boosts, then city boosts
        var baseStats = ctx.stats || {};
        var stats;
        
        // Apply sneaker mods and drink buffs via Shop.getEffectiveStats
        if (LORB.Locations && LORB.Locations.Shop && LORB.Locations.Shop.getEffectiveStats) {
            stats = LORB.Locations.Shop.getEffectiveStats(ctx);
        } else {
            stats = {
                speed: baseStats.speed || 6,
                threePt: baseStats.threePt || baseStats["3point"] || 5,
                dunk: baseStats.dunk || 5,
                power: baseStats.power || 5,
                steal: baseStats.steal || 5,
                block: baseStats.block || 5
            };
        }
        
        // Apply city buffs on top of equipment/drink boosts
        if (LORB.Cities && LORB.Cities.getToday && LORB.Cities.applyBuffsToStats) {
            var city = LORB.Cities.getToday();
            if (city) {
                stats = LORB.Cities.applyBuffsToStats(stats, city);
            }
        }
        
        var app = ctx.appearance || {};
        return {
            name: ctx.name || ctx.alias || "Player",
            shortNick: ctx.nickname || null,
            speed: stats.speed || 6,
            threePt: stats.threePt || stats["3point"] || 5,
            dunks: stats.dunk || 5,
            power: stats.power || 5,
            defense: stats.steal || 5,
            blocks: stats.block || 5,
            skin: app.skin || ctx.skin || "brown",
            jersey: parseInt(app.jerseyNumber, 10) || ctx.jersey || 1,
            isHuman: true,
            lorbId: "player",
            lorbData: {
                isLorbPlayer: true,
                name: ctx.name,
                level: ctx.level || 1,
                archetype: ctx.archetype || null,
                // Nametag colors as numeric attributes for game engine
                nametagFg: fgColorToAttr(app.nametagFg),
                nametagBg: bgColorToAttr(app.nametagBg),
                nametagHiFg: fgColorToAttr(app.nametagHiFg),
                nametagHiBg: bgColorToAttr(app.nametagHiBg)
            }
        };
    }
    
    function opponentToPlayer(opp) {
        var stats = opp.stats || {};
        return {
            name: opp.name || "Opponent",
            shortNick: opp.shortNick || null,
            speed: stats.speed || 5,
            threePt: stats["3point"] || 5,
            dunks: stats.dunk || 5,
            power: stats.power || 5,
            defense: stats.steal || 5,
            blocks: stats.block || 5,
            skin: opp.skin || "brown",  // Default to brown, not lightgray
            jersey: opp.jersey ? parseInt(opp.jersey, 10) : Math.floor(Math.random() * 99),
            isHuman: false,
            lorbId: opp.lorbId || opp.id || "opp"
        };
    }
    
    function simulateGame(ctx, opponent) {
        var playerPower = 0, oppPower = 0;
        if (ctx.stats) for (var s in ctx.stats) if (ctx.stats.hasOwnProperty(s)) playerPower += ctx.stats[s] || 0;
        for (var s in opponent.stats) if (opponent.stats.hasOwnProperty(s)) oppPower += opponent.stats[s] || 0;
        var winChance = Math.max(0.1, Math.min(0.9, 0.5 + (playerPower - oppPower) * 0.02));
        return Math.random() < winChance;
    }
    
    // Character art dimensions
    var CHAR_ART_W = 40;
    var CHAR_ART_H = 20;
    var CHARACTERS_DIR = NBA_JAM_ROOT + "assets/characters/";
    
    /**
     * Get teammate commentary based on game outcome and stats
     */
    function getTeammateCommentary(won, scoreDiff, playerStats, teammate) {
        var name = teammate ? (teammate.shortNick || teammate.name || "Teammate") : "Teammate";
        var pts = playerStats ? (playerStats.points || 0) : 0;
        var ast = playerStats ? (playerStats.assists || 0) : 0;
        var stl = playerStats ? (playerStats.steals || 0) : 0;
        var blk = playerStats ? (playerStats.blocks || 0) : 0;
        var to = playerStats ? (playerStats.turnovers || 0) : 0;
        var dnk = playerStats ? (playerStats.dunks || 0) : 0;
        
        // Helper to pick random from array
        function pick(arr) {
            return arr[Math.floor(Math.random() * arr.length)];
        }
        
        if (won) {
            // Win commentary - varies by margin and performance
            if (scoreDiff >= 20) {
                return [
                    { speaker: name, text: pick(["We absolutely CRUSHED them!", "That was a MASSACRE!", "They didn't stand a chance!"]) },
                    { speaker: name, text: pick(["That's how we do it!", "Run it back any time!", "Too easy!"]) }
                ];
            } else if (dnk >= 3) {
                return [
                    { speaker: name, text: pick(["You were POSTERIZING fools out there!", "The rim is CRYING right now!", "Dunk contest material!"]) },
                    { speaker: name, text: pick(["Keep throwing it down!", "That's why they call you a highlight reel!"]) }
                ];
            } else if (pts >= 20) {
                return [
                    { speaker: name, text: pick(["You were ON FIRE!", "Couldn't miss today!", "Bucket after bucket!"]) },
                    { speaker: name, text: pick(["Keep dropping buckets like that!", "Scoring machine!", "They had no answer for you!"]) }
                ];
            } else if (ast >= 5) {
                return [
                    { speaker: name, text: pick(["Great dimes out there!", "You were dishing like crazy!", "Point god status!"]) },
                    { speaker: name, text: pick(["Keep finding the open man!", "Vision on point!"]) }
                ];
            } else if (stl + blk >= 4) {
                return [
                    { speaker: name, text: pick(["Defense wins championships!", "Lockdown mode activated!", "They couldn't get anything going!"]) },
                    { speaker: name, text: pick(["That's how you play D!", "Clamps all day!"]) }
                ];
            } else if (scoreDiff <= 3) {
                return [
                    { speaker: name, text: pick(["Whew! That was TOO close!", "Heart attack game!", "Down to the wire!"]) },
                    { speaker: name, text: pick(["A win's a win though!", "Ugly win still counts!", "Got it done when it mattered!"]) }
                ];
            } else {
                return [
                    { speaker: name, text: pick(["Good game! We got the W!", "Solid work out there!", "That's a dub!"]) },
                    { speaker: name, text: pick(["Stack that paper!", "Let's get paid!", "Money in the bank!"]) }
                ];
            }
        } else {
            // Loss commentary
            if (to >= 5) {
                return [
                    { speaker: name, text: pick(["Yo, you gotta take care of the rock!", "Too many turnovers, man...", "Can't give it away like that!"]) },
                    { speaker: name, text: pick(["Protect the ball next time.", "They feasted on those giveaways."]) }
                ];
            } else if (scoreDiff <= -20) {
                return [
                    { speaker: name, text: pick(["Man... we got embarrassed out there.", "That was rough...", "Let's never speak of this again."]) },
                    { speaker: name, text: pick(["We gotta hit the gym.", "Time to practice.", "Back to basics."]) }
                ];
            } else if (scoreDiff >= -3) {
                return [
                    { speaker: name, text: pick(["So close! We almost had 'em!", "Just needed one more bucket...", "That one stings."]) },
                    { speaker: name, text: pick(["We'll get 'em next time!", "Run it back!", "That's a learning experience."]) }
                ];
            } else {
                return [
                    { speaker: name, text: pick(["Tough loss.", "Not our day.", "They played well."]) },
                    { speaker: name, text: pick(["Shake it off, let's run it back!", "We'll bounce back.", "On to the next one."]) }
                ];
            }
        }
    }
    
    /**
     * Get the bin art path for a contact/teammate
     */
    function getTeammateBinPath(teammate) {
        if (!teammate) return null;
        
        // Contact id is like "allen_iverson" which matches the bin filename
        var id = teammate.id;
        if (!id && teammate.name) {
            // Generate from name if no id
            id = String(teammate.name).toLowerCase().replace(/[^a-z0-9]/g, "_");
        }
        if (!id) return null;
        
        var binPath = CHARACTERS_DIR + id + ".bin";
        
        // Check if file exists
        var f = new File(binPath);
        if (f.exists) {
            return binPath;
        }
        return null;
    }
    
    function showResult(view, won, scoreDiff, rewards, ctx, opponent, court) {
        cleanupSprite(view);
        
        // Get active teammate for commentary and art
        var teammate = null;
        if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getActiveTeammate) {
            teammate = LORB.Util.Contacts.getActiveTeammate(ctx);
        }
        
        // Load teammate art into the art zone (40x20)
        var artFrame = view.getZone("art");
        var artLoaded = false;
        if (artFrame && typeof BinLoader !== "undefined") {
            artFrame.clear();
            var binPath = getTeammateBinPath(teammate);
            if (binPath) {
                try {
                    BinLoader.loadIntoFrame(artFrame, binPath, CHAR_ART_W, CHAR_ART_H, 1, 1);
                    artLoaded = true;
                } catch (e) {
                    // Art load failed - that's ok
                }
            }
            
            // If no teammate art, show result banner in art zone
            if (!artLoaded) {
                artFrame.gotoxy(1, 8);
                if (won) {
                    artFrame.putmsg("\1h\1g         V I C T O R Y          \1n");
                    artFrame.gotoxy(1, 10);
                    artFrame.putmsg("\1h\1w           W I N !              \1n");
                } else {
                    artFrame.putmsg("\1h\1r          D E F E A T           \1n");
                    artFrame.gotoxy(1, 10);
                    artFrame.putmsg("\1h\1w          L O S S               \1n");
                }
            }
        }
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        // Get commentary lines (only if we have a real teammate with art)
        var commentary = [];
        if (teammate && artLoaded) {
            commentary = getTeammateCommentary(won, scoreDiff, rewards.playerStats, teammate);
        }
        
        // === HEADER SECTION (commentary banner - ~4 lines) ===
        view.line("\1h\1c" + (won ? "V I C T O R Y" : "D E F E A T") + "\1n  \1k(" + (won ? "+" : "") + scoreDiff + ")\1n");
        view.blank();
        
        // Teammate commentary (if we have a teammate with art)
        if (commentary.length > 0) {
            for (var c = 0; c < commentary.length && c < 2; c++) {
                var line = commentary[c];
                view.line("\1h\1y" + line.speaker + ":\1n \1w\"" + line.text + "\"\1n");
            }
            view.blank();
        }
        
        if (won) {
            // === LEDGER SECTION ===
            var hLine = "\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4";
            view.line("\1h\1y" + hLine + "\1n");
            view.line("\1h\1w         GAME EARNINGS LEDGER         \1n");
            view.line("\1h\1y" + hLine + "\1n");
            
            var ledgerLines = [];
            var runningTotal = 0;
            
            // Base win bonus
            var baseCash = rewards.grossCash || rewards.cash || 0;
            ledgerLines.push({ desc: "Win Bonus", amount: baseCash, positive: true });
            runningTotal += baseCash;
            
            // Crew cuts (if any)
            if (rewards.crewCuts && rewards.crewCuts.length > 0) {
                for (var i = 0; i < rewards.crewCuts.length; i++) {
                    var cut = rewards.crewCuts[i];
                    ledgerLines.push({ desc: cut.name + " cut (" + cut.percent + "%)", amount: -cut.amount, positive: false });
                    runningTotal -= cut.amount;
                }
            }
            
            // Stat bonuses
            if (rewards.statBreakdown && rewards.statBreakdown.length > 0) {
                for (var s = 0; s < rewards.statBreakdown.length; s++) {
                    var stat = rewards.statBreakdown[s];
                    if (stat.bonus !== 0) {
                        var desc = stat.stat + " x" + stat.count;
                        ledgerLines.push({ desc: desc, amount: stat.bonus, positive: stat.bonus >= 0 });
                        runningTotal += stat.bonus;
                    }
                }
            }
            
            // Print ledger lines
            for (var l = 0; l < ledgerLines.length; l++) {
                var entry = ledgerLines[l];
                var amtStr = entry.positive ? "+$" + Math.abs(entry.amount) : "-$" + Math.abs(entry.amount);
                var amtColor = entry.positive ? "\1g" : "\1r";
                // Right-align the amount
                var descPadded = entry.desc;
                while (descPadded.length < 26) descPadded += ".";
                view.line("  " + descPadded + " " + amtColor + amtStr + "\1n");
            }
            
            view.line("\1h\1y" + hLine + "\1n");
            view.line("  \1h\1wTOTAL CASH:             \1h\1g+$" + runningTotal + "\1n");
            view.line("  \1wRep:                    \1c+" + rewards.rep + "\1n");
            view.line("  \1wXP:                     \1w+" + rewards.xp + "\1n");
            view.line("\1h\1y" + hLine + "\1n");
            
            // Show new records if any
            if (rewards.newRecords && rewards.newRecords.length > 0) {
                view.blank();
                view.line("\1h\1m*** NEW PERSONAL RECORD! ***\1n");
                for (var r = 0; r < rewards.newRecords.length; r++) {
                    var rec = rewards.newRecords[r];
                    view.line("  \1c" + rec.name + ": " + rec.value + "\1n (prev: " + rec.previousRecord + ")");
                }
            }
            
            // Show new contact if acquired
            if (opponent.isNBA && rewards.newContact) {
                view.blank();
                view.line("\1h\1c" + rewards.newContact.name + " gave you their number!\1n");
            }
            
            // Show baby baller result (if applicable)
            if (rewards.babyBallerResult) {
                var bbr = rewards.babyBallerResult;
                if (bbr.message) {
                    view.blank();
                    view.line(bbr.message);
                }
                if (bbr.cooldownMessage) {
                    view.line(bbr.cooldownMessage);
                }
                
                // Adoption offer for abandoned baby ballers you beat
                if (bbr.adoptionCandidate && LORB.Data && LORB.Data.BabyBallers && LORB.Data.BabyBallers.adoptBaby) {
                    var adoption = bbr.adoptionCandidate;
                    view.blank();
                    view.line("\1h\1yADOPTION OFFER\1n");
                    view.line("\1w" + adoption.nickname + " has no guardian. Adopt them?\1n");
                    view.line("\1c[A]\1n Adopt   \1w/\1n   \1c[L]\1n Leave");
                    view.render();
                    var key = console.getkey(K_NOSPIN).toUpperCase();
                    if (key === "A") {
                        var adopted = LORB.Data.BabyBallers.adoptBaby(ctx, adoption);
                        view.blank();
                        if (adopted) {
                            view.line("\1h\1g" + adoption.nickname + " joins your family!\1n");
                            view.line("\1wNew support due Day " + adopted.childSupport.dueDate + ".\1n");
                        } else {
                            view.line("\1rAdoption failed.\1n");
                        }
                        view.line("\1wPress any key...\1n");
                        view.render();
                        console.getkey(K_NOSPIN);
                    }
                }
                
                // Show detailed winnings breakdown if available
                if (bbr.winningsProcessed && bbr.isOwnChild) {
                    var wp = bbr.winningsProcessed;
                    view.blank();
                    view.line("\1h\1c" + bbr.babyName + "'s Earnings:\1n");
                    
                    if (wp.toSupport > 0) {
                        view.line("  \1yApplied to child support: \1h\1g-$" + wp.toSupport + "\1n");
                        view.line("  \1kSpent by baby: $" + wp.babyKept + "\1n");
                    } else if (wp.parentCut > 0) {
                        view.line("  \1gYour cut: \1h\1g+$" + wp.parentCut + "\1n");
                        view.line("  \1kBaby kept: $" + wp.babyKept + "\1n");
                    } else if (wp.parentCut < 0) {
                        view.line("  \1rNemesis stole from you: \1h\1r$" + Math.abs(wp.parentCut) + "\1n");
                    }
                }
                
                if (bbr.xpAwarded > 0) {
                    view.line("  \1c+" + bbr.xpAwarded + " XP to " + bbr.babyName + "\1n");
                }
                if (bbr.repAwarded > 0) {
                    view.line("  \1m+" + bbr.repAwarded + " REP to " + bbr.babyName + "\1n");
                }
            }
        } else {
            // Loss - simpler display
            var hLine = "\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4";
            view.line("\1h\1y" + hLine + "\1n");
            
            if (rewards.playerStats) {
                var ps = rewards.playerStats;
                view.line("  \1wYour Stats:\1n");
                view.line("  PTS: " + (ps.points || 0) + "  REB: " + (ps.rebounds || 0) + "  AST: " + (ps.assists || 0));
                view.line("  STL: " + (ps.steals || 0) + "  BLK: " + (ps.blocks || 0) + "  TO: " + (ps.turnovers || 0));
            }
            
            view.blank();
            view.line("\1rNo rewards for losers.\1n");
            view.line("\1kThe streets are unforgiving.\1n");
            
            // Show baby baller result for losses
            if (rewards.babyBallerResult) {
                var bbr = rewards.babyBallerResult;
                view.blank();
                if (bbr.message) {
                    view.line(bbr.message);
                }
                
                // Show baby's earnings when they beat you
                if (bbr.winningsProcessed && bbr.isOwnChild) {
                    var wp = bbr.winningsProcessed;
                    view.blank();
                    view.line("\1h\1c" + bbr.babyName + " earned money:\1n");
                    
                    if (wp.toSupport > 0) {
                        view.line("  \1yApplied to child support: \1h\1g-$" + wp.toSupport + "\1n");
                        view.line("  \1kSpent by baby: $" + wp.babyKept + "\1n");
                    } else if (wp.parentCut > 0) {
                        view.line("  \1gYour cut: \1h\1g+$" + wp.parentCut + "\1n");
                        view.line("  \1kBaby kept: $" + wp.babyKept + "\1n");
                    }
                }
                
                if (bbr.stolenCash) {
                    view.blank();
                    view.line("\1h\1rYou lost $" + bbr.stolenCash + " to your nemesis child!\1n");
                }
                
                if (bbr.xpAwarded > 0) {
                    view.line("  \1c" + bbr.babyName + " gained +" + bbr.xpAwarded + " XP\1n");
                }
                if (bbr.repAwarded > 0) {
                    view.line("  \1m" + bbr.babyName + " gained +" + bbr.repAwarded + " REP\1n");
                }
            }
            view.line("\1h\1y" + hLine + "\1n");
            
            // Show baby baller result (nemesis revenge, etc.)
            if (rewards.babyBallerResult && rewards.babyBallerResult.message) {
                view.blank();
                view.line(rewards.babyBallerResult.message);
                if (rewards.babyBallerResult.stolenCash) {
                    view.line("\1r-$" + rewards.babyBallerResult.stolenCash + " stolen by your child!\1n");
                }
            }
        }
        
        view.blank();
        view.info("Press ENTER to continue...");
        view.render();
        
        // Wait specifically for ENTER key to prevent accidental dismissal
        var key;
        do {
            key = console.getkey(K_NOSPIN);
        } while (key !== "\r" && key !== "\n");
    }
    
    function checkLevelUp(ctx, view) {
        var xpTable = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000];
        var lvl = ctx.level || 1;
        var nextXP = xpTable[lvl] || (lvl * 5000);
        if ((ctx.xp || 0) >= nextXP && lvl < 10) {
            ctx.level = lvl + 1;
            ctx.attributePoints = (ctx.attributePoints || 0) + 2;
            view.blank();
            view.line("\1h\1y*** LEVEL UP! ***\1n");
            view.line("You are now level " + ctx.level + "!");
            view.line("+2 Attribute Points");
        }
    }
    
    /**
     * Get current shared game day
     */
    function getSharedGameDay() {
        if (LORB.SharedState && LORB.SharedState.getGameDay) {
            return LORB.SharedState.getGameDay();
        }
        return 1;
    }
    
    function playAtCourtRichView(view, court, ctx) {
        var opponent = generateOpponent(court, ctx);
        
        // NOTE: Anti-spam events now trigger on "Find Another" (reroll), not on court entry
        // This prevents players from spamming reroll to cherry-pick easy opponents
        // Narrative events (spouse retaliation) trigger elsewhere (town entry, login)
        
        while (true) {
            var choice = showChallengerEncounter(view, court, opponent, ctx);
            
            if (choice === "back" || choice === null) {
                cleanupSprite(view);
                return;
            }
            
            if (choice === "reroll") {
                // Nemesis encounters cannot be easily avoided - costs a turn to reroll
                if (opponent.isNemesis) {
                    if (ctx.streetTurns <= 0) {
                        view.setContentZone("content");
                        view.warn("You can't escape your past, and you have no turns left!");
                        view.render();
                        console.getkey(K_NOSPIN);
                        cleanupSprite(view);
                        return;
                    }
                    
                    ctx.streetTurns--;
                    
                    // Add this opponent to skip list
                    if (!ctx.skipCounters) ctx.skipCounters = {};
                    ctx.skipCounters[opponent.id] = NEMESIS_SKIP_COOLDOWN;
                    
                    view.setContentZone("content");
                    view.warn(opponent.name + " won't let you walk away that easily. (-1 turn)");
                    view.render();
                    console.getkey(K_NOSPIN);
                }
                
                // === ANTI-SPAM EVENT CHECK ===
                // This is the consequence for spamming "Find Another" to cherry-pick opponents
                // No daily limit - the point is to make rerolling have potential consequences
                if (LORB.Data && LORB.Data.BabyEvents && LORB.Data.BabyEvents.checkAntiSpamEvent) {
                    var eventResult = LORB.Data.BabyEvents.checkAntiSpamEvent(ctx, getSharedGameDay());
                    if (eventResult) {
                        // Event/talk show may have overwritten our view - force full redraw
                        console.clear(BG_BLACK);
                        loadHeader(view);
                        view.clearZone("art");
                        view.clearZone("content");
                        view.render();
                        
                        // Event was shown - if it triggered a match, use that opponent instead
                        if (eventResult.triggerMatch && eventResult.matchOpponent) {
                            cleanupSprite(view);
                            opponent = eventResult.matchOpponent;
                            continue;
                        }
                        // Otherwise continue to generate new opponent as normal
                    }
                }
                
                cleanupSprite(view);
                opponent = generateOpponent(court, ctx);
                continue;
            }
            
            if (choice === "play") {
                if (ctx.streetTurns <= 0) {
                    view.setContentZone("content");
                    view.warn("No street turns left!");
                    view.render();
                    console.getkey(K_NOSPIN);
                    cleanupSprite(view);
                    return;
                }
                
                ctx.streetTurns--;
                if (!ctx.dayStats) ctx.dayStats = { gamesPlayed: 0, wins: 0, losses: 0, cashEarned: 0, repGained: 0 };
                ctx.dayStats.gamesPlayed++;
                
                var won = false, scoreDiff = 0;
                var playerGameStats = null;  // Stats from this game
                var gameResult = null;       // Full result object
                var realEngine = (typeof runExternalGame === "function");
                
                if (realEngine) {
                    view.setContentZone("content");
                    view.clearZone("content");
                    view.setCursorY(0);
                    view.line("\1h\1cLoading game...\1n");
                    view.render();
                    
                    cleanupSprite(view);
                    
                    var player = ctxToPlayer(ctx);
                    var opp1 = opponentToPlayer(opponent);
                    
                    // Use crew member as teammate if available, otherwise generate Streetballer
                    var crewTeammate = getCrewTeammate(ctx);
                    var teammate;
                    if (crewTeammate) {
                        teammate = crewTeammate;
                    } else {
                        teammate = generateStreetballOpponent({ difficulty: Math.max(1, court.difficulty - 1) });
                        teammate.name = "Streetballer";
                    }
                    
                    // For nemesis matches, opponent's teammate is Darth Vader
                    var opp2;
                    if (opponent.isNemesis) {
                        opp2 = {
                            id: "vader",
                            shortNick: "VADER",
                            name: "Darth Vader",
                            displayName: "Darth Vader",
                            team: "Force",
                            teamAbbr: "SWR",
                            isNBA: false,
                            skin: "vader",
                            jersey: 1,
                            stats: {
                                speed: 10,
                                "3point": 10,
                                dunk: 10,
                                power: 10,
                                steal: 10,
                                block: 10
                            }
                        };
                    } else {
                        opp2 = generateStreetballOpponent(court);
                        opp2.name = opponent.displayName + " Jr";
                    }
                    
                    // Get city-appropriate team colors for opponent
                    // (e.g., Barkley in Philadelphia wears Sixers colors, not Suns)
                    var oppTeamColors = { fg: "WHITE", bg: "BG_BLUE", fg_accent: "WHITE", bg_alt: "BG_BLUE" };
                    if (LORB && LORB.Cities && LORB.Cities.getToday && LORB.Cities.getRawTeamColors) {
                        var city = LORB.Cities.getToday();
                        if (city) {
                            oppTeamColors = LORB.Cities.getRawTeamColors(city);
                        }
                    }
                    
                    // Get hydrated crew for substitution system
                    var hydratedCrew = [];
                    if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getCrewWithContacts) {
                        hydratedCrew = LORB.Util.Contacts.getCrewWithContacts(ctx);
                    }
                    if (typeof debugLog === "function") debugLog("[COURTS] hydratedCrew.length=" + hydratedCrew.length + ", ctx.crew=" + (ctx.crew ? ctx.crew.length : "null") + ", ctx.contacts=" + (ctx.contacts ? ctx.contacts.length : "null"));
                    
                    // Build player's team colors from their appearance settings
                    var playerTeamColors = { fg: "WHITE", bg: "BG_RED", fg_accent: "WHITE", bg_alt: "BG_RED" };
                    if (ctx.appearance && ctx.appearance.jerseyColor) {
                        playerTeamColors.bg = "BG_" + ctx.appearance.jerseyColor.toUpperCase();
                        playerTeamColors.bg_alt = playerTeamColors.bg;
                    }
                    if (ctx.appearance && ctx.appearance.jerseyLettering) {
                        playerTeamColors.fg_accent = ctx.appearance.jerseyLettering.toUpperCase();
                    }
                    
                    var config = {
                        teamA: { name: (ctx.name || "Player") + "'s Squad", abbr: "YOU", players: [player, opponentToPlayer(teammate)], colors: playerTeamColors },
                        teamB: { name: court.name + " Crew", abbr: "OPP", players: [opp1, opponentToPlayer(opp2)], colors: { fg: oppTeamColors.fg_accent, bg: oppTeamColors.bg_alt } },
                        options: { gameTime: 180, mode: "play", humanTeam: "teamA", humanPlayerIndex: 0, showMatchupScreen: true, showGameOverScreen: false },
                        lorbContext: { court: court.id, difficulty: court.difficulty, opponent: opponent, playerCtx: ctx, hydratedCrew: hydratedCrew }
                    };
                    
                    view.close();
                    var result = runExternalGame(config);
                    gameResult = result;
                    view = createView();
                    
                    if (result && result.completed) {
                        won = (result.winner === "teamA");
                        scoreDiff = result.score.teamA - result.score.teamB;
                        
                        // Extract player's stats from the game
                        // Look for stats with lorbId "player" or fallback to teamA_player1
                        if (result.playerStats) {
                            // First try the lorbId key
                            if (result.playerStats["player"]) {
                                playerGameStats = result.playerStats["player"];
                            } else if (result.playerStats["teamA_player1"]) {
                                playerGameStats = result.playerStats["teamA_player1"];
                            } else {
                                // Search through all stats for lorb player marker
                                for (var pid in result.playerStats) {
                                    if (result.playerStats.hasOwnProperty(pid)) {
                                        var ps = result.playerStats[pid];
                                        if (ps.lorbData && ps.lorbData.isLorbPlayer) {
                                            playerGameStats = ps;
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            // Normalize field goals format
                            if (playerGameStats) {
                                if (playerGameStats.fieldGoals) {
                                    playerGameStats.fgm = playerGameStats.fieldGoals.made || 0;
                                    playerGameStats.fga = playerGameStats.fieldGoals.attempted || 0;
                                }
                                if (playerGameStats.threePointers) {
                                    playerGameStats.tpm = playerGameStats.threePointers.made || 0;
                                    playerGameStats.tpa = playerGameStats.threePointers.attempted || 0;
                                }
                            }
                        }
                    } else if (result && result.exitReason === "quit") {
                        ctx.streetTurns++;
                        ctx.dayStats.gamesPlayed--;
                        view.setContentZone("content");
                        view.warn("Game abandoned.");
                        view.render();
                        console.getkey(K_NOSPIN);
                        return;
                    } else {
                        won = simulateGame(ctx, opponent);
                        scoreDiff = won ? 10 : -5;
                    }
                } else {
                    cleanupSprite(view);
                    view.setContentZone("content");
                    view.clearZone("content");
                    view.setCursorY(0);
                    view.line("\1k(Simulating...)\1n");
                    view.render();
                    mswait(1500);
                    won = simulateGame(ctx, opponent);
                    scoreDiff = won ? Math.floor(Math.random() * 15) + 5 : -(Math.floor(Math.random() * 10) + 3);
                }
                
                if (won) {
                    ctx.wins = (ctx.wins || 0) + 1;
                    ctx.dayStats.wins++;
                    // Track season wins
                    if (LORB.Util && LORB.Util.CareerStats && LORB.Util.CareerStats.recordWinLoss) {
                        LORB.Util.CareerStats.recordWinLoss(ctx, true);
                    }
                    var rewards = calculateRewards(court, ctx, scoreDiff);
                    
                    // Record career stats and check for records
                    var statResult = null;
                    var statBonuses = null;
                    if (playerGameStats && LORB.Util && LORB.Util.CareerStats) {
                        // Get current season for per-season tracking
                        var seasonNum = (LORB.SharedState && LORB.SharedState.getInfo) 
                            ? (LORB.SharedState.getInfo().seasonNumber || 1) : 1;
                        statResult = LORB.Util.CareerStats.recordGame(ctx, playerGameStats, {
                            opponentName: opponent.displayName || opponent.name,
                            courtName: court.name,
                            seasonNumber: seasonNum
                        });
                        
                        // Calculate stat bonuses
                        statBonuses = LORB.Util.CareerStats.calculateBonuses(
                            playerGameStats, 
                            court.difficulty
                        );
                        
                        // Add stat bonuses to cash rewards
                        if (statBonuses && statBonuses.total) {
                            rewards.statBonus = statBonuses.total;
                            rewards.statBreakdown = statBonuses.breakdown;
                        }
                    }
                    rewards.playerStats = playerGameStats;
                    rewards.newRecords = statResult ? statResult.newRecords : [];
                    
                    // Apply crew cuts if any temp members (on base cash, not stat bonuses)
                    var cutResult = null;
                    if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.applyCrewCut) {
                        cutResult = LORB.Util.Contacts.applyCrewCut(ctx, rewards.cash);
                        rewards.grossCash = cutResult.gross;
                        rewards.cash = cutResult.net;
                        rewards.crewCuts = cutResult.cuts;
                    }
                    
                    // Calculate total cash (base after cuts + stat bonuses)
                    var totalCash = rewards.cash + (rewards.statBonus || 0);
                    
                    ctx.cash = (ctx.cash || 0) + totalCash;
                    ctx.rep = (ctx.rep || 0) + rewards.rep;
                    ctx.xp = (ctx.xp || 0) + rewards.xp;
                    ctx.dayStats.cashEarned += totalCash;
                    ctx.dayStats.repGained += rewards.rep;
                    
                    // Award contact if defeated NBA player
                    var newContact = null;
                    if (opponent.isNBA && LORB.Util && LORB.Util.Contacts) {
                        newContact = LORB.Util.Contacts.awardContactFromVictory(ctx, opponent);
                    }
                    rewards.newContact = newContact;
                    
                    // Process baby baller match outcomes (if applicable)
                    var babyResult = null;
                    if (opponent.isBabyBaller) {
                        babyResult = processBabyBallerMatch(ctx, opponent, true, rewards.cash);
                        rewards.babyBallerResult = babyResult;
                    }
                    
                    showResult(view, true, scoreDiff, rewards, ctx, opponent, court);
                    checkLevelUp(ctx, view);
                    
                    // CHECKPOINT SAVE - Game results are significant, persist immediately
                    if (LORB.Persist && LORB.Persist.save) {
                        try {
                            LORB.Persist.save(ctx);
                        } catch (e) {}
                    }
                } else {
                    ctx.losses = (ctx.losses || 0) + 1;
                    ctx.dayStats.losses++;
                    // Track season losses
                    if (LORB.Util && LORB.Util.CareerStats && LORB.Util.CareerStats.recordWinLoss) {
                        LORB.Util.CareerStats.recordWinLoss(ctx, false);
                    }
                    
                    // Still record career stats even on loss
                    if (playerGameStats && LORB.Util && LORB.Util.CareerStats) {
                        // Get current season for per-season tracking
                        var seasonNum = (LORB.SharedState && LORB.SharedState.getInfo) 
                            ? (LORB.SharedState.getInfo().seasonNumber || 1) : 1;
                        LORB.Util.CareerStats.recordGame(ctx, playerGameStats, {
                            opponentName: opponent.displayName || opponent.name,
                            courtName: court.name,
                            seasonNumber: seasonNum
                        });
                    }
                    
                    // Process baby baller match outcomes (if applicable)
                    var lossResult = { playerStats: playerGameStats };
                    if (opponent.isBabyBaller) {
                        // Estimate winnings for baby (what they would have won)
                        var estimatedWinnings = court.rewards.cashBase || 100;
                        var babyResult = processBabyBallerMatch(ctx, opponent, false, estimatedWinnings);
                        lossResult.babyBallerResult = babyResult;
                    }
                    
                    showResult(view, false, scoreDiff, lossResult, ctx, opponent, court);
                    
                    // CHECKPOINT SAVE - Game results are significant, persist immediately
                    if (LORB.Persist && LORB.Persist.save) {
                        try {
                            LORB.Persist.save(ctx);
                        } catch (e) {}
                    }
                }
                
                ctx.gamesPlayed = (ctx.gamesPlayed || 0) + 1;
                return;
            }
        }
    }
    
    function runRichView(ctx) {
        var view = createView();
        loadHeader(view);
        
        // Load art into left panel (use hub_art.bin as fallback)
        loadCourtArt(view, null);
        
        // Sprite wanderer for ambient animation on art panel
        var wanderer = null;
        var SpriteWanderer = getSpriteWanderer();
        var SpriteSelectors = getSpriteSelectors();
        
        // Helper to create (or recreate) wanderer - needed after play destroys art frame children
        function createWanderer() {
            if (!SpriteWanderer) return null;
            try {
                var artFrame = view.getZone("art");
                if (!artFrame) return null;
                
                var courtSprites;
                
                // Court walkable zone - sprites are 5x4 so zone must be at least 4 tall
                var walkableZones = [
                    { x: 8, y: 12, width: 24, height: 9 }  // Main court area (rows 12-20)
                ];
                
                var primaryZone = walkableZones[0];
                
                if (SpriteSelectors) {
                    // Get city NBA players with art, baby ballers, street ballers
                    courtSprites = SpriteSelectors.getCourtSelectSprites(ctx);
                    SpriteSelectors.applyPositions(courtSprites, primaryZone);
                } else {
                    // Fallback: random skins
                    var availableSkins = ["brown", "lightgray", "magenta", "sonic"];
                    courtSprites = [];
                    for (var i = 0; i < 3; i++) {
                        courtSprites.push({
                            skin: availableSkins[Math.floor(Math.random() * availableSkins.length)],
                            x: 10 + (i * 8),
                            y: 16,
                            bearing: ["e", "w", "s"][Math.floor(Math.random() * 3)]
                        });
                    }
                }
                
                var w = new SpriteWanderer({
                    parentFrame: artFrame,
                    sprites: courtSprites,
                    walkableZones: walkableZones,
                    options: {
                        speed: 400,
                        pauseChance: 0.4,
                        showNametags: true
                    }
                });
                w.start();
                return w;
            } catch (e) {
                return null;
            }
        }
        
        // Initial wanderer creation
        wanderer = createWanderer();
        
        while (true) {
            view.clearZone("content");
            
            // Right panel: status info at top, then menu
            view.setContentZone("content");
            view.setCursorY(0);
            
            // Player status (compact)
            view.line("\1h\1cStreet Turns:\1n " + (ctx.streetTurns > 0 ? "\1g" : "\1r") + ctx.streetTurns + "\1n  \1h\1cRep:\1n \1w" + (ctx.rep || 0) + "\1n");
            
            var nextCourt = getRepToNextCourt(ctx);
            if (nextCourt) {
                view.line("\1kNext: " + nextCourt.courtName + " (" + nextCourt.needed + " rep)\1n");
            } else {
                view.blank();
            }
            
            view.blank();
            view.line("\1wPick your court:\1n");
            
            // Build menu items
            var items = buildCourtMenuItems(ctx);
            
            // Draw initial art and tooltip for first court (menu starts on first item)
            var firstCourt = null;
            for (var i = 0; i < items.length; i++) {
                if (items[i]._court) {
                    firstCourt = items[i];
                    break;
                }
            }
            if (firstCourt) {
                loadCourtArt(view, firstCourt._court.id);
                drawCourtTooltip(view, firstCourt._court, firstCourt._unlocked);
            }
            
            view.render();
            
            var choice = view.menu(items, {
                y: 5,
                onSelect: function(item, index, rv) {
                    if (item._court) {
                        // Reload art with this court's name overlay
                        loadCourtArt(rv, item._court.id);
                        drawCourtTooltip(rv, item._court, item._unlocked);
                    }
                    rv.render();
                },
                onIdle: function(rv, lightbar) {
                    // Animate wandering sprites during menu idle
                    if (wanderer && wanderer.isRunning()) {
                        wanderer.update();
                        wanderer.cycle();
                        rv.render();
                    }
                }
            });
            
            if (!choice || choice === "back") {
                if (wanderer) wanderer.stop();
                view.close();
                return;
            }
            
            var court = null;
            for (var id in COURTS) {
                if (COURTS.hasOwnProperty(id) && id === choice) {
                    court = COURTS[id];
                    break;
                }
            }
            
            if (court) {
                // Check if court is unlocked before playing
                var courtData = null;
                for (var j = 0; j < items.length; j++) {
                    if (items[j].value === choice) {
                        courtData = items[j];
                        break;
                    }
                }
                
                if (courtData && !courtData._unlocked) {
                    // Court is locked - show message but don't play
                    view.clearZone("tooltip");
                    var tooltipFrame = view.getZone("tooltip");
                    if (tooltipFrame) {
                        tooltipFrame.gotoxy(2, 2);
                        tooltipFrame.putmsg("\1r\1hLocked! Need more rep to unlock.\1n");
                        view.render();
                    }
                    continue;  // Stay in menu loop
                }
                
                if (wanderer) wanderer.stop();
                playAtCourtRichView(view, court, ctx);
                loadHeader(view);  // Reload header after returning
                loadCourtArt(view, court.id);  // Reload art with played court's name
                // Recreate wanderer - play view destroyed sprite child frames
                if (typeof debugLog === "function") debugLog("[COURTS] After play, recreating wanderer...");
                var artFrame = view.getZone("art");
                if (typeof debugLog === "function") debugLog("[COURTS] artFrame exists: " + !!artFrame + ", children: " + (artFrame ? artFrame.child_count : "N/A"));
                wanderer = createWanderer();
                if (typeof debugLog === "function") debugLog("[COURTS] createWanderer returned: " + !!wanderer);
            }
        }
    }
    
    // Legacy fallback
    function runLegacy(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("STREETBALL COURTS");
            LORB.View.line("");
            LORB.View.line("Street Turns: " + (ctx.streetTurns > 0 ? "\1g" : "\1r") + ctx.streetTurns + "\1n");
            LORB.View.line("");
            
            var courts = getAvailableCourts(ctx);
            var num = 1;
            for (var i = 0; i < courts.length; i++) {
                var c = courts[i];
                if (c.unlocked) {
                    LORB.View.line("\1w[\1h" + num + "\1n\1w]\1n " + c.court.name + (c.court.boss ? " \1r[BOSS]\1n" : ""));
                } else {
                    LORB.View.line("\1k[" + num + "] " + c.court.name + " (Need " + c.repNeeded + " rep)\1n");
                }
                num++;
            }
            
            LORB.View.line("");
            LORB.View.line("\1w[\1hQ\1n\1w]\1n Back");
            var choice = LORB.View.prompt("Choice: ");
            
            if (choice.toUpperCase() === "Q") return;
            
            var idx = parseInt(choice, 10) - 1;
            if (idx >= 0 && idx < courts.length && courts[idx].unlocked) {
                playAtCourtLegacy(courts[idx].court, ctx);
            }
        }
    }
    
    function playAtCourtLegacy(court, ctx) {
        if (ctx.streetTurns <= 0) {
            LORB.View.warn("No street turns left!");
            console.getkey(K_NOSPIN);
            return;
        }
        
        // Check for random baby mama/baller events when hitting the streets
        if (LORB.Data && LORB.Data.BabyEvents && LORB.Data.BabyEvents.checkAndShowEvent) {
            var eventResult = LORB.Data.BabyEvents.checkAndShowEvent(ctx, getSharedGameDay());
            // Event handled inline, continue to opponent
        }
        
        var opp = generateOpponent(court, ctx);
        LORB.View.clear();
        LORB.View.header(court.name + " - " + court.tagline);
        LORB.View.line("");
        LORB.View.line("A challenger approaches...");
        LORB.View.line("\1h\1y" + opp.displayName + "\1n" + (opp.isNBA ? " \1m[NBA]\1n" : ""));
        LORB.View.line("");
        LORB.View.line("\1w[P]\1nlay  \1w[B]\1nack");
        
        if (LORB.View.prompt("Choice: ").toUpperCase() !== "P") return;
        
        ctx.streetTurns--;
        LORB.View.line("\1k(Simulating...)\1n");
        mswait(1500);
        
        var won = simulateGame(ctx, opp);
        var diff = won ? Math.floor(Math.random() * 15) + 5 : -(Math.floor(Math.random() * 10) + 3);
        
        LORB.View.clear();
        LORB.View.header("GAME OVER");
        if (won) {
            var rewards = calculateRewards(court, ctx, diff);
            
            // Apply crew cuts
            if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.applyCrewCut) {
                var cutResult = LORB.Util.Contacts.applyCrewCut(ctx, rewards.cash);
                rewards.cash = cutResult.net;
            }
            
            ctx.wins = (ctx.wins || 0) + 1;
            // Track season wins
            if (LORB.Util && LORB.Util.CareerStats && LORB.Util.CareerStats.recordWinLoss) {
                LORB.Util.CareerStats.recordWinLoss(ctx, true);
            }
            ctx.cash = (ctx.cash || 0) + rewards.cash;
            ctx.rep = (ctx.rep || 0) + rewards.rep;
            ctx.xp = (ctx.xp || 0) + rewards.xp;
            
            // Award contact if NBA player
            if (opp.isNBA && LORB.Util && LORB.Util.Contacts) {
                var newContact = LORB.Util.Contacts.awardContactFromVictory(ctx, opp);
                if (newContact) {
                    LORB.View.line("\1c" + newContact.name + " gave you their number!\1n");
                }
            }
            
            LORB.View.line("\1h\1gYOU WIN!\1n +$" + rewards.cash + " / +" + rewards.rep + " rep");
        } else {
            ctx.losses = (ctx.losses || 0) + 1;
            // Track season losses
            if (LORB.Util && LORB.Util.CareerStats && LORB.Util.CareerStats.recordWinLoss) {
                LORB.Util.CareerStats.recordWinLoss(ctx, false);
            }
            LORB.View.line("\1h\1rYOU LOSE\1n");
        }
        ctx.gamesPlayed = (ctx.gamesPlayed || 0) + 1;
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey(K_NOSPIN);
    }
    
    function repeatChar(ch, n) {
        var s = "";
        for (var i = 0; i < n; i++) s += ch;
        return s;
    }
    
    function run(ctx) {
        return RichView ? runRichView(ctx) : runLegacy(ctx);
    }
    
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Courts = {
        run: run,
        COURTS: COURTS,
        getAvailableCourts: getAvailableCourts,
        generateOpponent: generateOpponent,
        getNBAOpponent: getNBAOpponent
    };
    
})();
