/**
 * sprite-selectors.js - Get sprite configs for different LORB locations
 * 
 * These functions return arrays of sprite configs ready for SpriteWanderer,
 * selecting appropriate players/characters for ambient animations.
 * 
 * Sprite config format:
 * {
 *     skin: "brown",      // Required: sprite skin name
 *     shortNick: "BARNY", // Optional: nametag text (if showNametags enabled)
 *     x: 5,               // Optional: starting X position
 *     y: 14,              // Optional: starting Y position
 *     bearing: "s"        // Optional: starting bearing (n/s/e/w)
 * }
 */

(function() {
    
    // Debug logging to file
    var DEBUG_SELECTORS = false;
    function traceLog(msg) {
        if (!DEBUG_SELECTORS) return;
        try {
            var f = new File("/sbbs/xtrn/nba_jam/data/sprite_selector_debug.log");
            if (f.open("a")) {
                f.writeln("[" + new Date().toISOString() + "] " + msg);
                f.close();
            }
        } catch (e) { /* ignore */ }
    }
    
    // Available skin colors for random fallback
    var DEFAULT_SKINS = ["brown", "lightgray", "magenta", "sonic", "shrek", "barney"];
    
    /**
     * Get random element from array
     */
    function randomChoice(arr) {
        if (!arr || arr.length === 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    }
    
    /**
     * Shuffle array in place (Fisher-Yates)
     */
    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }
        return arr;
    }
    
    /**
     * Generate a random starting position within walkable area
     */
    function randomPosition(zone, index, count) {
        // Stagger sprites horizontally to avoid overlap
        var spacing = Math.floor(zone.width / (count + 1));
        var x = zone.x + spacing * (index + 1);
        var y = zone.y + Math.floor(Math.random() * Math.max(1, zone.height - 2));
        return { x: x, y: y };
    }
    
    /**
     * Get random bearing
     */
    function randomBearing() {
        var bearings = ["n", "s", "e", "w"];
        return bearings[Math.floor(Math.random() * bearings.length)];
    }
    
    /**
     * Get the current player as a sprite config
     */
    function getPlayerSprite(ctx) {
        if (!ctx || !ctx.appearance) return null;
        
        return {
            skin: ctx.appearance.skin || "brown",
            shortNick: ctx.shortNick || ctx.name || null,
            jerseyBg: ctx.appearance.jerseyColor || null,
            jerseyNumber: ctx.appearance.jerseyNumber || null,
            accentFg: ctx.appearance.jerseyLettering || null
        };
    }
    
    /**
     * Get active teammate as a sprite config
     */
    function getTeammateSprite(ctx) {
        if (!ctx || !ctx.activeTeammate) return null;
        
        // Try to get contact data via LORB.Util.Contacts
        if (typeof LORB !== "undefined" && LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getContact) {
            var contact = LORB.Util.Contacts.getContact(ctx, ctx.activeTeammate);
            if (contact) {
                return {
                    skin: contact.skin || "brown",
                    shortNick: contact.shortNick || contact.name || null,
                    jerseyBg: contact.jerseyColor || null,
                    jerseyNumber: contact.jersey || null,
                    accentFg: contact.accentFg || null
                };
            }
        }
        
        return null;
    }
    
    /**
     * Get all crew members as sprite configs
     */
    function getCrewSprites(ctx) {
        var sprites = [];
        
        if (!ctx || !ctx.crew) return sprites;
        
        // Try to get contact data via LORB.Util.Contacts
        if (typeof LORB !== "undefined" && LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getCrewWithContacts) {
            var crewContacts = LORB.Util.Contacts.getCrewWithContacts(ctx);
            for (var i = 0; i < crewContacts.length; i++) {
                var contact = crewContacts[i];
                sprites.push({
                    skin: contact.skin || "brown",
                    shortNick: contact.shortNick || contact.name || null,
                    jerseyBg: contact.jerseyColor || null,
                    jerseyNumber: contact.jersey || null,
                    accentFg: contact.accentFg || null
                });
            }
        }
        
        return sprites;
    }
    
    /**
     * Get sprites from the current city's NBA roster
     * Uses LORB.Cities to get today's city, then LORB.Data.Roster to get team players
     * 
     * @param {number} count - Max number of players to return
     * @returns {Array} Array of sprite configs for city roster players
     */
    function getCityRosterSprites(count) {
        var sprites = [];
        count = count || 2;
        
        // Get current city
        var city = null;
        if (typeof LORB !== "undefined" && LORB.Cities && LORB.Cities.getToday) {
            city = LORB.Cities.getToday();
        }
        if (!city || !city.id) {
            traceLog("[SPRITE-SEL] getCityRosterSprites: No city or city.id (city=" + JSON.stringify(city) + ")");
            return sprites;
        }
        traceLog("[SPRITE-SEL] getCityRosterSprites: city.id=" + city.id);
        
        // Map city ID to team key
        var cityToTeam = {
            "atl": "hawks", "bos": "celtics", "bkn": "nets", "cha": "hornets",
            "chi": "bulls", "cle": "cavaliers", "dal": "mavericks", "den": "nuggets",
            "det": "pistons", "gsw": "warriors", "hou": "rockets", "ind": "pacers",
            "lac": "clippers", "lal": "lakers", "mem": "grizzlies", "mia": "heat",
            "mil": "bucks", "min": "timberwolves", "nop": "pelicans", "nyk": "knicks",
            "okc": "thunder", "orl": "magic", "phi": "76ers", "phx": "suns",
            "por": "blazers", "sac": "kings", "sas": "spurs", "tor": "raptors",
            "uta": "jazz", "was": "wizards"
        };
        
        var teamKey = cityToTeam[city.id];
        if (!teamKey) {
            traceLog("[SPRITE-SEL] getCityRosterSprites: No teamKey for city.id=" + city.id);
            return sprites;
        }
        traceLog("[SPRITE-SEL] getCityRosterSprites: teamKey=" + teamKey);
        
        // Get team data from roster
        if (typeof LORB === "undefined" || !LORB.Data || !LORB.Data.Roster) {
            traceLog("[SPRITE-SEL] getCityRosterSprites: LORB.Data.Roster not available");
            return sprites;
        }
        
        var team = LORB.Data.Roster.getTeam(teamKey);
        if (!team || !team.roster || team.roster.length === 0) {
            traceLog("[SPRITE-SEL] getCityRosterSprites: No team roster for " + teamKey + " (team=" + JSON.stringify(team) + ")");
            return sprites;
        }
        traceLog("[SPRITE-SEL] getCityRosterSprites: team " + teamKey + " has " + team.roster.length + " players");
        
        // Shuffle roster and pick players
        var rosterCopy = team.roster.slice();
        shuffle(rosterCopy);
        
        for (var i = 0; i < Math.min(count, rosterCopy.length); i++) {
            // roster entries are player IDs without team prefix, so prepend team
            var playerId = rosterCopy[i];
            var playerKey = teamKey + "." + playerId;
            var player = LORB.Data.Roster.getPlayerByKey(playerKey);
            
            // If not found with prefix, try the roster entry as-is (might already have prefix)
            if (!player) {
                player = LORB.Data.Roster.getPlayerByKey(playerId);
            }
            // Also try by normalized ID
            if (!player) {
                player = LORB.Data.Roster.getPlayer(playerId);
            }
            
            if (!player) {
                traceLog("[SPRITE-SEL] getCityRosterSprites: Player not found: " + playerKey + " or " + playerId);
                continue;
            }
            
            traceLog("[SPRITE-SEL] getCityRosterSprites: Adding " + player.shortNick + " from " + teamKey + 
                " (jerseyBg=" + team.colors.bgAlt + ", accentFg=" + team.colors.fgAccent + ")");
            sprites.push({
                skin: player.skin || "brown",
                shortNick: player.shortNick || null,
                jerseyBg: team.colors.bgAlt || null,    // Jersey background (ansi_bg_alt)
                jerseyNumber: player.jersey || null,
                accentFg: team.colors.fgAccent || null  // Jersey lettering (ansi_fg_accent, contrasts with bgAlt)
            });
        }
        
        traceLog("[SPRITE-SEL] getCityRosterSprites: returning " + sprites.length + " sprites");
        return sprites;
    }
    
    /**
     * Get sprites for Mall wandering
     * Uses Club 23 logic for now - can customize later
     * Total: 2-4 sprites
     */
    function getMallSprites(ctx) {
        // For now, reuse Club 23 logic - random patrons shopping
        // Can customize later with mall-specific behavior
        return getClub23Sprites(ctx);
    }
    
    /**
     * Get sprites for Club 23
     * Mix of: current player (always), maybe crew, city roster player, plus randoms
     * Total: 2-4 sprites
     */
    function getClub23Sprites(ctx) {
        var sprites = [];
        
        // Always include current player - this is their hangout
        var playerSprite = getPlayerSprite(ctx);
        if (playerSprite) {
            sprites.push(playerSprite);
        }
        
        // 40% chance to include a crew member (if they have any)
        if (Math.random() < 0.4) {
            var crewSprites = getCrewSprites(ctx);
            if (crewSprites.length > 0) {
                sprites.push(randomChoice(crewSprites));
            }
        }
        
        // 60% chance to include a city roster player (local NBA star at the club)
        var cityRoll = Math.random();
        traceLog("[SPRITE-SEL] getClub23Sprites: cityRoll=" + cityRoll.toFixed(2) + " (need < 0.6)");
        if (cityRoll < 0.6) {
            var citySprites = getCityRosterSprites(1);
            traceLog("[SPRITE-SEL] getClub23Sprites: got " + citySprites.length + " city sprites");
            if (citySprites.length > 0) {
                sprites.push(citySprites[0]);
            }
        }
        
        // Fill remainder with random patrons if needed (target 2-3 total)
        var targetCount = 2 + Math.floor(Math.random() * 2); // 2-3 total
        while (sprites.length < targetCount) {
            sprites.push({
                skin: randomChoice(DEFAULT_SKINS),
                shortNick: null,  // Random patrons don't get nametags
                jerseyBg: null,
                jerseyNumber: null,
                accentFg: null
            });
        }
        
        return sprites;
    }
    
    /**
     * Get sprites for Crib (player's home)
     * Mix of: current player, teammate, crew members
     * Total: 1-3 sprites
     */
    function getCribSprites(ctx) {
        var sprites = [];
        
        // Always show current player at home
        var playerSprite = getPlayerSprite(ctx);
        if (playerSprite) sprites.push(playerSprite);
        
        // Show teammate if active
        var teammateSprite = getTeammateSprite(ctx);
        if (teammateSprite) sprites.push(teammateSprite);
        
        // 50% chance to include one crew member (if available)
        if (Math.random() < 0.5) {
            var crewSprites = getCrewSprites(ctx);
            if (crewSprites.length > 0) {
                sprites.push(randomChoice(crewSprites));
            }
        }
        
        return sprites;
    }
    
    /**
     * Get baby baller sprites
     * Uses baby baller data from ctx.babyBallers
     * Total: up to 5 sprites
     */
    function getBabySprites(ctx) {
        var sprites = [];
        
        // Check both ctx.babies and ctx.babyBallers for compatibility
        var babies = ctx.babyBallers || ctx.babies;
        if (!babies || babies.length === 0) return sprites;
        
        var babiesCopy = shuffle(babies.slice());  // Shuffle a copy
        var count = Math.min(5, babiesCopy.length);
        
        for (var i = 0; i < count; i++) {
            var baby = babiesCopy[i];
            var appearance = baby.appearance || {};
            sprites.push({
                skin: appearance.skin || baby.skin || "brown",
                shortNick: baby.shortNick || baby.nickname || baby.name || null,
                jerseyBg: null,  // Baby ballers don't have team jerseys
                jerseyNumber: appearance.jersey || baby.jersey || null,
                accentFg: null
            });
        }
        
        return sprites;
    }
    
    /**
     * Check if a player has .bin art available
     * @param {string} playerId - Player ID like "allen_iverson" or "76ers.allen_iverson"
     * @returns {boolean} True if .bin file exists
     */
    function playerHasBinArt(playerId) {
        if (!playerId) return false;
        
        // Strip team prefix if present (e.g., "76ers.allen_iverson" -> "allen_iverson")
        var id = String(playerId);
        var dotIndex = id.indexOf(".");
        if (dotIndex !== -1) {
            id = id.substring(dotIndex + 1);
        }
        
        // Remove year suffixes like "_2021"
        id = id.replace(/_\d{4}$/, "");
        
        var binPath = "/sbbs/xtrn/nba_jam/assets/characters/" + id + ".bin";
        
        try {
            var f = new File(binPath);
            return f.exists;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Get city NBA players that have .bin art files
     * These represent players you can encounter and add to your ballerdex
     * 
     * @param {number} count - Max number of players to return
     * @returns {Array} Array of sprite configs for city roster players with art
     */
    function getCityPlayersWithArt(count) {
        var sprites = [];
        count = count || 3;
        
        // Get current city
        var city = null;
        if (typeof LORB !== "undefined" && LORB.Cities && LORB.Cities.getToday) {
            city = LORB.Cities.getToday();
        }
        if (!city || !city.id) {
            traceLog("[SPRITE-SEL] getCityPlayersWithArt: No city");
            return sprites;
        }
        
        // Map city ID to team key
        var cityToTeam = {
            "atl": "hawks", "bos": "celtics", "bkn": "nets", "cha": "hornets",
            "chi": "bulls", "cle": "cavaliers", "dal": "mavericks", "den": "nuggets",
            "det": "pistons", "gsw": "warriors", "hou": "rockets", "ind": "pacers",
            "lac": "clippers", "lal": "lakers", "mem": "grizzlies", "mia": "heat",
            "mil": "bucks", "min": "timberwolves", "nop": "pelicans", "nyk": "knicks",
            "okc": "thunder", "orl": "magic", "phi": "76ers", "phx": "suns",
            "por": "blazers", "sac": "kings", "sas": "spurs", "tor": "raptors",
            "uta": "jazz", "was": "wizards"
        };
        
        var teamKey = cityToTeam[city.id];
        if (!teamKey) {
            traceLog("[SPRITE-SEL] getCityPlayersWithArt: No teamKey for " + city.id);
            return sprites;
        }
        
        // Get team data from roster
        if (typeof LORB === "undefined" || !LORB.Data || !LORB.Data.Roster) {
            traceLog("[SPRITE-SEL] getCityPlayersWithArt: No roster data");
            return sprites;
        }
        
        var team = LORB.Data.Roster.getTeam(teamKey);
        if (!team || !team.roster || team.roster.length === 0) {
            traceLog("[SPRITE-SEL] getCityPlayersWithArt: No roster for " + teamKey);
            return sprites;
        }
        
        // Filter to players with .bin art
        var playersWithArt = [];
        for (var i = 0; i < team.roster.length; i++) {
            var playerId = team.roster[i];
            var playerKey = teamKey + "." + playerId;
            
            // Check if player has art
            if (playerHasBinArt(playerId)) {
                var player = LORB.Data.Roster.getPlayerByKey(playerKey);
                if (!player) player = LORB.Data.Roster.getPlayerByKey(playerId);
                if (!player) player = LORB.Data.Roster.getPlayer(playerId);
                
                if (player) {
                    playersWithArt.push({
                        player: player,
                        team: team,
                        playerId: playerId
                    });
                }
            }
        }
        
        traceLog("[SPRITE-SEL] getCityPlayersWithArt: " + playersWithArt.length + " players with art for " + teamKey);
        
        if (playersWithArt.length === 0) return sprites;
        
        // Shuffle and pick
        shuffle(playersWithArt);
        
        for (var j = 0; j < Math.min(count, playersWithArt.length); j++) {
            var p = playersWithArt[j];
            sprites.push({
                skin: p.player.skin || "brown",
                shortNick: p.player.shortNick || null,
                jerseyBg: p.team.colors.bgAlt || null,
                jerseyNumber: p.player.jersey || null,
                accentFg: p.team.colors.fgAccent || null,
                isNBA: true,
                playerId: p.playerId
            });
        }
        
        return sprites;
    }
    
    /**
     * Get sprites for the court SELECTION screen (not gameplay encounters)
     * Prioritizes: city NBA players with art > baby ballers > street ballers
     * These represent who's "hanging around" the courts in this city
     * 
     * @param {Object} ctx - Player context
     * @param {string} courtTier - Optional court tier to filter baby ballers
     * @returns {Array} Array of sprite configs
     */
    function getCourtSelectSprites(ctx, courtTier) {
        var sprites = [];
        var targetCount = 3;  // Target 3 sprites for court selection
        
        // Priority 1: City NBA players with art (represent who you might encounter)
        var cityPlayers = getCityPlayersWithArt(2);
        for (var i = 0; i < cityPlayers.length && sprites.length < targetCount; i++) {
            sprites.push(cityPlayers[i]);
        }
        traceLog("[SPRITE-SEL] getCourtSelectSprites: added " + cityPlayers.length + " city players");
        
        // Priority 2: One baby baller if player has any
        if (sprites.length < targetCount && ctx) {
            var babySprites = getBabySprites(ctx);
            if (babySprites.length > 0) {
                sprites.push(babySprites[0]);
                traceLog("[SPRITE-SEL] getCourtSelectSprites: added 1 baby baller");
            }
        }
        
        // Priority 3: Fill remainder with street ballers
        while (sprites.length < targetCount) {
            sprites.push({
                skin: randomChoice(DEFAULT_SKINS),
                shortNick: null,
                jerseyBg: null,
                jerseyNumber: null,
                accentFg: null
            });
        }
        traceLog("[SPRITE-SEL] getCourtSelectSprites: total " + sprites.length + " sprites");
        
        return sprites;
    }
    
    /**
     * Get sprites for a street court (legacy, used for gameplay)
     * Mix of: city players, baby ballers, street ballers
     * Total: 2-5 sprites
     */
    function getCourtSprites(ctx) {
        var sprites = [];
        
        // Start with baby ballers if available (1-2)
        var babySprites = getBabySprites(ctx);
        if (babySprites.length > 0) {
            var babyCount = Math.min(2, babySprites.length);
            for (var i = 0; i < babyCount; i++) {
                sprites.push(babySprites[i]);
            }
        }
        
        // Add some random street ballers
        var targetCount = 2 + Math.floor(Math.random() * 3); // 2-4 total
        while (sprites.length < targetCount) {
            sprites.push({
                skin: randomChoice(DEFAULT_SKINS),
                shortNick: null  // Street ballers don't get nametags
            });
        }
        
        return sprites;
    }
    
    /**
     * Apply positions to sprites for a given walkable zone
     * Mutates sprites in place with x, y, bearing
     */
    function applyPositions(sprites, zone) {
        for (var i = 0; i < sprites.length; i++) {
            var pos = randomPosition(zone, i, sprites.length);
            sprites[i].x = pos.x;
            sprites[i].y = pos.y;
            sprites[i].bearing = randomBearing();
        }
        return sprites;
    }
    
    // Export
    if (typeof LORB === "undefined") LORB = {};
    if (!LORB.Util) LORB.Util = {};
    
    LORB.Util.SpriteSelectors = {
        getPlayerSprite: getPlayerSprite,
        getTeammateSprite: getTeammateSprite,
        getCrewSprites: getCrewSprites,
        getCityRosterSprites: getCityRosterSprites,
        getCityPlayersWithArt: getCityPlayersWithArt,
        getCourtSelectSprites: getCourtSelectSprites,
        getClub23Sprites: getClub23Sprites,
        getMallSprites: getMallSprites,
        getCribSprites: getCribSprites,
        getBabySprites: getBabySprites,
        getCourtSprites: getCourtSprites,
        applyPositions: applyPositions,
        randomChoice: randomChoice,
        shuffle: shuffle,
        playerHasBinArt: playerHasBinArt
    };
    
})();
