/**
 * roster_lookup.js - NBA Player Roster Lookup for LORB
 * 
 * Provides efficient lookup of NBA player data by normalized ID.
 * Loads from rosters.ini once and caches the results.
 * 
 * Usage:
 *   var player = LORB.Data.Roster.getPlayer("carmelo_anthony");
 *   var allPlayers = LORB.Data.Roster.getAllPlayers();
 *   var team = LORB.Data.Roster.getTeam("nuggets");
 */

(function() {
    if (!this.LORB) this.LORB = {};
    if (!LORB.Data) LORB.Data = {};
    
    // Use absolute path for rosters.ini - works from any context
    var ROSTERS_INI_PATH = "/sbbs/xtrn/nba_jam/lib/config/rosters.ini";
    
    // Cached data
    var playersById = null;      // { carmelo_anthony: {...}, ... }
    var playersByKey = null;     // { "nuggets.carmelo_anthony": {...}, ... }
    var teamsById = null;        // { nuggets: {...}, ... }
    var loaded = false;
    
    // Position mapping (from rosters.ini position values)
    var POSITION_MAP = {
        "guard": { id: "PG", name: "Point Guard", category: "Guard" },
        "point guard": { id: "PG", name: "Point Guard", category: "Guard" },
        "pg": { id: "PG", name: "Point Guard", category: "Guard" },
        "shooting guard": { id: "SG", name: "Shooting Guard", category: "Guard" },
        "sg": { id: "SG", name: "Shooting Guard", category: "Guard" },
        "forward": { id: "SF", name: "Small Forward", category: "Forward" },
        "small forward": { id: "SF", name: "Small Forward", category: "Forward" },
        "sf": { id: "SF", name: "Small Forward", category: "Forward" },
        "power forward": { id: "PF", name: "Power Forward", category: "Forward" },
        "pf": { id: "PF", name: "Power Forward", category: "Forward" },
        "center": { id: "C", name: "Center", category: "Center" },
        "c": { id: "C", name: "Center", category: "Center" }
    };
    
    /**
     * Normalize player name to ID format
     * "Carmelo Anthony" -> "carmelo_anthony"
     * "LeBron James (2016)" -> "lebron_james__2016_"
     */
    function normalizeId(name) {
        if (!name) return null;
        return String(name).toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/__+/g, "_");
    }
    
    /**
     * Parse position string to structured position data
     */
    function parsePosition(posStr) {
        if (!posStr) return { id: "SF", name: "Small Forward", category: "Forward" };
        var key = String(posStr).toLowerCase().trim();
        return POSITION_MAP[key] || { id: "SF", name: "Small Forward", category: "Forward" };
    }
    
    /**
     * Load and parse rosters.ini
     */
    function loadRosters() {
        if (loaded) return;
        
        playersById = {};
        playersByKey = {};
        teamsById = {};
        
        var file = new File(ROSTERS_INI_PATH);
        if (!file.open("r")) {
            loaded = true;
            return;
        }
        
        var currentSection = null;
        var teamData = {};
        var playerData = {};
        
        while (!file.eof) {
            var line = file.readln();
            if (line === null) break;
            line = line.trim();
            
            // Skip empty lines and comments
            if (line === "" || line[0] === "#") continue;
            
            // Section header
            if (line[0] === "[" && line[line.length - 1] === "]") {
                currentSection = line.substring(1, line.length - 1);
                continue;
            }
            
            // Key=value
            var eq = line.indexOf("=");
            if (eq > 0 && currentSection) {
                var key = line.substring(0, eq).trim();
                var value = line.substring(eq + 1).trim();
                
                if (currentSection.indexOf(".") === -1) {
                    // Team section
                    if (!teamData[currentSection]) teamData[currentSection] = {};
                    teamData[currentSection][key] = value;
                } else {
                    // Player section
                    if (!playerData[currentSection]) playerData[currentSection] = {};
                    playerData[currentSection][key] = value;
                }
            }
        }
        file.close();
        
        // Build team index
        for (var teamKey in teamData) {
            if (!teamData.hasOwnProperty(teamKey)) continue;
            var t = teamData[teamKey];
            
            teamsById[teamKey] = {
                id: teamKey,
                name: t.team_name || teamKey,
                abbr: t.team_abbr || teamKey.substring(0, 3).toUpperCase(),
                roster: t.roster ? t.roster.split(",").map(function(s) { return s.trim(); }) : [],
                colors: {
                    fg: t.ansi_fg || "WHITE",
                    bg: t.ansi_bg || "BG_BLACK",
                    fgAccent: t.ansi_fg_accent || "WHITE",
                    bgAlt: t.ansi_bg_alt || "BG_BLACK"
                }
            };
        }
        
        // Build player index
        for (var playerKey in playerData) {
            if (!playerData.hasOwnProperty(playerKey)) continue;
            var p = playerData[playerKey];
            
            // Parse short_nicks - comma separated, take first
            var shortNicks = [];
            if (p.short_nicks && p.short_nicks.trim()) {
                shortNicks = p.short_nicks.split(",").map(function(s) { return s.trim(); });
            }
            var shortNick = shortNicks.length > 0 ? shortNicks[0] : null;
            if (!shortNick && p.player_name) {
                var parts = p.player_name.split(" ");
                shortNick = parts[parts.length - 1].substring(0, 8).toUpperCase();
            }
            
            // Parse rivals
            var rivals = [];
            if (p.rivals && p.rivals.trim()) {
                rivals = p.rivals.split(",").map(function(s) { return s.trim(); });
            }
            
            // Parse position
            var pos = parsePosition(p.position);
            
            // Build player object
            var player = {
                key: playerKey,                           // Original key: "nuggets.carmelo_anthony"
                id: normalizeId(p.player_name),           // Normalized: "carmelo_anthony"
                name: p.player_name || "Unknown",
                team: p.player_team || playerKey.split(".")[0],
                teamKey: playerKey.split(".")[0],
                jersey: String(p.player_number || "0"),
                position: pos.id,
                positionName: pos.name,
                positionCategory: pos.category,
                stats: {
                    speed: parseInt(p.speed, 10) || 5,
                    threePt: parseInt(p["3point"], 10) || 5,
                    dunk: parseInt(p.dunk, 10) || 5,
                    block: parseInt(p.block, 10) || 5,
                    power: parseInt(p.power, 10) || 5,
                    steal: parseInt(p.steal, 10) || 5
                },
                skin: p.skin || "brown",
                shortNick: shortNick,
                shortNicks: shortNicks,
                longNicks: p.long_nicks || null,
                rivals: rivals,
                eyeColor: p.eye_color || null,
                eyebrowChar: p.eyebrow_char || null,
                eyebrowColor: p.eyebrow_color || null,
                customSprite: p.custom_sprite || null
            };
            
            // Index by normalized ID (carmelo_anthony)
            playersById[player.id] = player;
            
            // Also index by full key (nuggets.carmelo_anthony)
            playersByKey[playerKey] = player;
        }
        
        loaded = true;
        
        var playerCount = Object.keys(playersById).length;
        var teamCount = Object.keys(teamsById).length;
        if (typeof debugLog === "function") {
            debugLog("[LORB:Roster] Loaded " + playerCount + " players from " + teamCount + " teams");
        }
    }
    
    /**
     * Get player by normalized ID
     * @param {string} id - Normalized player ID (e.g., "carmelo_anthony")
     * @returns {Object|null} Player data or null if not found
     */
    function getPlayer(id) {
        if (!loaded) loadRosters();
        if (!id) return null;
        
        // Try direct lookup
        var normalized = normalizeId(id);
        if (playersById[normalized]) return playersById[normalized];
        
        // Try by key
        if (playersByKey[id]) return playersByKey[id];
        
        return null;
    }
    
    /**
     * Get player by full roster key
     * @param {string} key - Full roster key (e.g., "nuggets.carmelo_anthony")
     * @returns {Object|null} Player data or null
     */
    function getPlayerByKey(key) {
        if (!loaded) loadRosters();
        return playersByKey[key] || null;
    }
    
    /**
     * Get team by ID
     * @param {string} id - Team ID (e.g., "nuggets")
     * @returns {Object|null} Team data or null
     */
    function getTeam(id) {
        if (!loaded) loadRosters();
        return teamsById[id] || null;
    }
    
    /**
     * Get all players
     * @returns {Object} Map of id -> player
     */
    function getAllPlayers() {
        if (!loaded) loadRosters();
        return playersById;
    }
    
    /**
     * Get all teams
     * @returns {Object} Map of id -> team
     */
    function getAllTeams() {
        if (!loaded) loadRosters();
        return teamsById;
    }
    
    /**
     * Get random NBA players (for encounters, etc.)
     * @param {number} count - Number of players to return
     * @param {Array} excludeIds - IDs to exclude
     * @returns {Array} Array of player objects
     */
    function getRandomPlayers(count, excludeIds) {
        if (!loaded) loadRosters();
        
        excludeIds = excludeIds || [];
        var excludeSet = {};
        for (var i = 0; i < excludeIds.length; i++) {
            excludeSet[normalizeId(excludeIds[i])] = true;
        }
        
        var available = [];
        for (var id in playersById) {
            if (playersById.hasOwnProperty(id) && !excludeSet[id]) {
                available.push(playersById[id]);
            }
        }
        
        // Shuffle
        for (var j = available.length - 1; j > 0; j--) {
            var k = Math.floor(Math.random() * (j + 1));
            var temp = available[j];
            available[j] = available[k];
            available[k] = temp;
        }
        
        return available.slice(0, count);
    }
    
    /**
     * Check if a player ID exists in the roster
     * @param {string} id - Player ID to check
     * @returns {boolean} True if player exists
     */
    function hasPlayer(id) {
        if (!loaded) loadRosters();
        var normalized = normalizeId(id);
        return !!playersById[normalized] || !!playersByKey[id];
    }
    
    /**
     * Force reload of rosters (for testing/hot reload)
     */
    function reload() {
        loaded = false;
        playersById = null;
        playersByKey = null;
        teamsById = null;
        loadRosters();
    }
    
    // Export
    LORB.Data.Roster = {
        getPlayer: getPlayer,
        getPlayerByKey: getPlayerByKey,
        getTeam: getTeam,
        getAllPlayers: getAllPlayers,
        getAllTeams: getAllTeams,
        getRandomPlayers: getRandomPlayers,
        hasPlayer: hasPlayer,
        reload: reload,
        normalizeId: normalizeId,
        parsePosition: parsePosition
    };
    
})();
