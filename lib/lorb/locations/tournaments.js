/**
 * tournaments.js - Multiplayer Rankings & Ghost Match Challenge
 * 
 * Shows leaderboard of all players, allows challenging for ghost matches.
 */

var _tourneyRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _tourneyRichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[TOURNAMENTS] Failed to load RichView: " + e);
}

// Load BinLoader for .bin file loading
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
        log(LOG_WARNING, "[TOURNAMENTS] Failed to load bin-loader.js: " + e);
    }
}

(function() {
    
    var RichView = _tourneyRichView;
    
    // Key constants for arrow navigation
    if (typeof KEY_LEFT === 'undefined') var KEY_LEFT = '\x1d';
    if (typeof KEY_RIGHT === 'undefined') var KEY_RIGHT = '\x1c';
    
    // Wager calculation constants
    var MAX_WAGER_PERCENT = 10;  // Max 10% of offline player's balance
    
    // View modes
    var VIEW_RANKINGS = "rankings";
    var VIEW_LEADERS = "leaders";
    var VIEW_RECORDS = "records";
    var VIEW_PVP_LEADERS = "pvp_leaders";
    
    // Stat categories for league leaders
    var LEADER_CATEGORIES = [
        { key: "ppg", name: "Points", abbrev: "PPG" },
        { key: "rpg", name: "Rebounds", abbrev: "RPG" },
        { key: "apg", name: "Assists", abbrev: "APG" },
        { key: "spg", name: "Steals", abbrev: "SPG" },
        { key: "bpg", name: "Blocks", abbrev: "BPG" }
    ];
    
    // Stat categories for single game records
    var RECORD_CATEGORIES = [
        { key: "points", name: "Points", abbrev: "PTS" },
        { key: "rebounds", name: "Rebounds", abbrev: "REB" },
        { key: "assists", name: "Assists", abbrev: "AST" },
        { key: "steals", name: "Steals", abbrev: "STL" },
        { key: "blocks", name: "Blocks", abbrev: "BLK" },
        { key: "dunks", name: "Dunks", abbrev: "DNK" }
    ];
    
    // Stat categories for PvP leaders
    var PVP_LEADER_CATEGORIES = [
        { key: "wins", name: "PvP Wins", abbrev: "WINS" },
        { key: "winPct", name: "Win %", abbrev: "WIN%" },
        { key: "ppg", name: "PvP Points", abbrev: "PPG" },
        { key: "streak", name: "Win Streak", abbrev: "STRK" }
    ];
    
    // =====================================================
    // GHOST MATCH HELPERS - Convert stored player data to game format
    // =====================================================
    
    /**
     * Convert player's LORB context to game engine player definition
     * Used for the human player's character
     */
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
                archetype: ctx.archetype || null
            }
        };
    }
    
    /**
     * Convert a ghost opponent (from Persist.listPlayers) to game player definition
     * This is AI-controlled - represents the offline player's character
     */
    function ghostOpponentToPlayer(opponent) {
        var stats = opponent.stats || {};
        var app = opponent.appearance || {};
        
        // Extract skin from appearance or fall back to defaults
        var skin = "lightgray";
        if (app.skin) {
            skin = app.skin;
        } else if (opponent.skin) {
            skin = opponent.skin;
        }
        
        // Extract jersey number
        var jersey = 0;
        if (app.jerseyNumber) {
            jersey = parseInt(app.jerseyNumber, 10) || 0;
        }
        if (!jersey) {
            jersey = Math.floor(Math.random() * 99) + 1;
        }
        
        return {
            name: opponent.name || "Ghost",
            shortNick: opponent.nickname || null,
            speed: stats.speed || 5,
            threePt: stats.threePt || stats["3point"] || 5,
            dunks: stats.dunk || 5,
            power: stats.power || 5,
            defense: stats.steal || 5,
            blocks: stats.block || 5,
            skin: skin,
            jersey: jersey,
            isHuman: false,
            lorbId: "ghost_main",
            lorbData: {
                isGhost: true,
                name: opponent.name,
                level: opponent.level || 1
            }
        };
    }
    
    /**
     * Get the ghost opponent's active teammate from their data
     * Returns a player definition, or null if none found
     */
    function getGhostTeammate(opponent) {
        // Check if they have an activeTeammate set
        var activeId = opponent.activeTeammate;
        if (!activeId) return null;
        
        // If activeTeammate is already an object (from presence data), use it directly
        if (typeof activeId === "object" && activeId.name) {
            return contactToPlayer(activeId);
        }
        
        // Otherwise, search their contacts array for the matching ID
        var contacts = opponent.contacts;
        if (!contacts || !Array.isArray(contacts)) return null;
        
        for (var i = 0; i < contacts.length; i++) {
            var c = contacts[i];
            if (c && c.id === activeId && c.status === "signed") {
                return contactToPlayer(c);
            }
        }
        
        // Fallback: use first signed contact
        for (var i = 0; i < contacts.length; i++) {
            var c = contacts[i];
            if (c && c.status === "signed") {
                return contactToPlayer(c);
            }
        }
        
        return null;
    }
    
    /**
     * Convert a contact (crew member) to player definition
     */
    function contactToPlayer(contact) {
        if (!contact) return null;
        var stats = contact.stats || {};
        
        // Generate shortNick if not present
        var shortNick = contact.shortNick;
        if (!shortNick) {
            var nameParts = String(contact.name || "").split(" ");
            shortNick = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
            shortNick = shortNick.substring(0, 8).toUpperCase();
        }
        
        return {
            name: contact.name || "Teammate",
            shortNick: shortNick,
            speed: stats.speed || 5,
            threePt: stats.threePt || stats["3point"] || 5,
            dunks: stats.dunk || 5,
            power: stats.power || 5,
            defense: stats.steal || 5,
            blocks: stats.block || 5,
            skin: contact.skin || "brown",
            jersey: contact.jersey || Math.floor(Math.random() * 99),
            isHuman: false,
            lorbId: "ghost_teammate"
        };
    }
    
    /**
     * Get the human player's active teammate
     */
    function getMyTeammate(ctx) {
        if (typeof LORB === "undefined" || !LORB.Util || !LORB.Util.Contacts) return null;
        var crewMember = LORB.Util.Contacts.getActiveTeammate(ctx);
        if (!crewMember) return null;
        return contactToPlayer(crewMember);
    }
    
    /**
     * Generate a default CPU teammate when none available
     */
    function generateDefaultTeammate(teamName) {
        return {
            name: teamName || "Streetballer",
            shortNick: "CPU",
            speed: 5,
            threePt: 5,
            dunks: 5,
            power: 5,
            defense: 5,
            blocks: 5,
            skin: "brown",
            jersey: Math.floor(Math.random() * 99),
            isHuman: false,
            lorbId: "cpu_partner"
        };
    }
    
    // =====================================================
    // TOURNAMENTS HUB - Intermediate navigation menu
    // =====================================================
    
    // Hub menu items with tooltips and art references
    var HUB_MENU_ITEMS = [
        { text: "Standings", value: "standings", tooltip: "View player rankings and challenge opponents" },
        { text: "Playoffs", value: "playoffs", tooltip: "Season playoffs bracket and matches" },
        { text: "Season Leaders", value: "leaders", tooltip: "League leaders in points, rebounds, and more" },
        { text: "Record Holders", value: "records", tooltip: "Single-game records by category" },
        { text: "PvP Stats", value: "pvp", tooltip: "Player vs Player win leaders" },
        { text: "Ballerdex", value: "ballerdex", tooltip: "Most contacts collected - gotta catch 'em all!" },
        { text: "Crew Strength", value: "crew_strength", tooltip: "Total power of your collected contacts" },
        { text: "Set Availability", value: "availability", tooltip: "Set your playoff match availability" },
        { text: "Back to Hub", value: "quit", tooltip: "Return to Rim City" }
    ];
    
    // Art constants for hub
    var HUB_ART_WIDTH = 40;
    var HUB_ART_HEIGHT = 20;
    
    /**
     * Load the Tournaments Hub art based on current selection
     * For now, uses a generic art path - can be expanded per-menu-item
     */
    function loadHubArt(view, menuItem) {
        if (typeof BinLoader === "undefined") return;
        
        var artFrame = view.getZone("art");
        if (!artFrame) return;
        
        // For now use the hub art as fallback
        // TODO: Add per-menu-item art files (e.g., tournaments_standings.bin, tournaments_playoffs.bin)
        var artPath = "/sbbs/xtrn/nba_jam/assets/lorb/hub_art.bin";
        
        if (file_exists(artPath)) {
            BinLoader.loadIntoFrame(artFrame, artPath, HUB_ART_WIDTH, HUB_ART_HEIGHT, 1, 1);
        }
        
        view.render();
    }
    
    /**
     * Render the figlet banner for the Tournaments Hub
     */
    function renderHubBanner(view, title) {
        var headerFrame = view.getZone("header");
        if (!headerFrame) return;
        
        // Use FigletBanner if available
        if (LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
            // Use bright yellow for "TOURNAMENTS" title
            var fgAttr = (typeof YELLOW === "number") ? (YELLOW | HIGH) : 14;
            LORB.Util.FigletBanner.renderToFrame(headerFrame, title, fgAttr);
        } else {
            // Fallback: plain centered text
            headerFrame.clear();
            var padding = Math.floor((80 - title.length) / 2);
            headerFrame.gotoxy(padding + 1, 2);
            headerFrame.attr = (typeof YELLOW === "number") ? (YELLOW | HIGH) : 14;
            headerFrame.putmsg(title);
        }
    }
    
    /**
     * Tournaments Hub - Intermediate navigation view
     * Shows a lightbar menu for selecting different tournament views
     */
    function runTournamentsHub(ctx) {
        while (true) {
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 4 },
                    { name: "art", x: 1, y: 5, width: 40, height: 20 },
                    { name: "content", x: 43, y: 5, width: 38, height: 16 },
                    { name: "tooltip", x: 43, y: 21, width: 38, height: 4 }
                ],
                theme: "lorb"
            });
            
            // Render the figlet banner
            renderHubBanner(view, "TOURNAMENTS");
            
            // Load initial art
            loadHubArt(view, HUB_MENU_ITEMS[0]);
            
            // Build menu content
            view.setContentZone("content");
            view.setCursorY(0);
            
            // Get current season info for display
            var seasonNum = 1;
            var gameDay = 1;
            if (LORB.SharedState) {
                if (LORB.SharedState.getGameDay) {
                    gameDay = LORB.SharedState.getGameDay();
                }
                if (LORB.SharedState.getInfo) {
                    var info = LORB.SharedState.getInfo();
                    seasonNum = info.seasonNumber || 1;
                }
            }
            
            var seasonLength = (LORB.Config && LORB.Config.SEASON_LENGTH_DAYS) || 30;
            view.line("\1wSeason " + seasonNum + " Day " + gameDay + "/" + seasonLength + "\1n");
            view.blank();
            
            // Tooltip drawing helper
            function drawTooltip(text) {
                var tooltipFrame = view.getZone("tooltip");
                if (!tooltipFrame) return;
                
                tooltipFrame.clear();
                var innerWidth = 36;
                
                // Word wrap into 2 lines if needed
                var words = (text || "").split(" ");
                var line1 = "", line2 = "";
                var onLine1 = true;
                
                for (var i = 0; i < words.length; i++) {
                    var word = words[i];
                    if (onLine1) {
                        if ((line1 + " " + word).trim().length <= innerWidth) {
                            line1 = (line1 + " " + word).trim();
                        } else {
                            onLine1 = false;
                            line2 = word;
                        }
                    } else {
                        if ((line2 + " " + word).trim().length <= innerWidth) {
                            line2 = (line2 + " " + word).trim();
                        }
                    }
                }
                
                // Center each line
                var pad1 = Math.floor((innerWidth - line1.length) / 2);
                var pad2 = Math.floor((innerWidth - line2.length) / 2);
                
                // Draw box
                var borderColor = "\1h\1r";
                var textColor = "\1n\1w";
                
                tooltipFrame.gotoxy(1, 1);
                tooltipFrame.putmsg(borderColor + "\xDA" + repeatChar("\xC4", innerWidth) + "\xBF\1n");
                
                tooltipFrame.gotoxy(1, 2);
                tooltipFrame.putmsg(borderColor + "\xB3" + textColor + repeatChar(" ", pad1) + line1 + repeatChar(" ", innerWidth - pad1 - line1.length) + borderColor + "\xB3\1n");
                
                tooltipFrame.gotoxy(1, 3);
                tooltipFrame.putmsg(borderColor + "\xB3" + textColor + repeatChar(" ", pad2) + line2 + repeatChar(" ", innerWidth - pad2 - line2.length) + borderColor + "\xB3\1n");
                
                tooltipFrame.gotoxy(1, 4);
                tooltipFrame.putmsg(borderColor + "\xC0" + repeatChar("\xC4", innerWidth) + "\xD9\1n");
                
                view.render();
            }
            
            // Character repeat helper
            function repeatChar(ch, count) {
                var s = "";
                for (var i = 0; i < count; i++) s += ch;
                return s;
            }
            
            // onSelect callback to update tooltip and art when selection changes
            var onSelectCallback = function(item, index, richView, lb) {
                drawTooltip(item.tooltip || "");
                loadHubArt(richView, item);
            };
            
            // Draw initial tooltip for first item
            drawTooltip(HUB_MENU_ITEMS[0].tooltip || "");
            
            var choice = view.menu(HUB_MENU_ITEMS, { y: 3, onSelect: onSelectCallback, hotkeys: "Q" });
            view.close();
            
            // Handle choice
            switch (choice) {
                case "standings":
                    runRichView(ctx, VIEW_RANKINGS);
                    break;
                    
                case "playoffs":
                    if (LORB.UI && LORB.UI.PlayoffView) {
                        LORB.UI.PlayoffView.run(ctx);
                    }
                    break;
                    
                case "leaders":
                    runRichView(ctx, VIEW_LEADERS);
                    break;
                    
                case "records":
                    runRichView(ctx, VIEW_RECORDS);
                    break;
                    
                case "pvp":
                    runRichView(ctx, VIEW_PVP_LEADERS);
                    break;
                    
                case "ballerdex":
                    showBallerdexLeaders(ctx);
                    break;
                    
                case "crew_strength":
                    showCrewStrengthLeaders(ctx);
                    break;
                    
                case "availability":
                    if (LORB.UI && LORB.UI.PlayoffView && LORB.UI.PlayoffView.showAvailabilitySettings) {
                        LORB.UI.PlayoffView.showAvailabilitySettings(ctx);
                    }
                    break;
                    
                case "quit":
                case "Q":
                case null:
                case undefined:
                    return;
                    
                default:
                    // Unknown choice, stay in hub
                    break;
            }
        }
    }
    
    /**
     * Main entry point
     */
    function run(ctx) {
        if (RichView) {
            return runTournamentsHub(ctx);
        } else {
            return runLegacy(ctx);
        }
    }
    
    /**
     * Calculate career averages for a player
     */
    function getPlayerAverages(player, seasonNumber) {
        // If seasonNumber is provided and not "all", use season-specific stats
        var career;
        if (seasonNumber && seasonNumber !== "all") {
            // Try to get season-specific stats
            if (player.seasonStats && player.seasonStats[seasonNumber]) {
                career = player.seasonStats[seasonNumber];
            } else {
                // No data for this season
                return null;
            }
        } else {
            // Use career (all-time) stats
            career = player.careerStats;
        }
        
        if (!career || !career.gamesPlayed || career.gamesPlayed === 0) {
            return null;
        }
        
        var games = career.gamesPlayed;
        var totals = career.totals || {};
        
        return {
            ppg: (totals.points || 0) / games,
            rpg: (totals.rebounds || 0) / games,
            apg: (totals.assists || 0) / games,
            spg: (totals.steals || 0) / games,
            bpg: (totals.blocks || 0) / games,
            tpg: (totals.turnovers || 0) / games,
            gamesPlayed: games
        };
    }
    
    /**
     * Get all league leaders for a stat category
     */
    function getLeagueLeaders(players, statKey, limit, seasonNumber) {
        limit = limit || 10;
        
        var playersWithStats = [];
        for (var i = 0; i < players.length; i++) {
            var avgs = getPlayerAverages(players[i], seasonNumber);
            if (avgs && avgs.gamesPlayed >= 3) {  // Minimum 3 games to qualify
                playersWithStats.push({
                    player: players[i],
                    value: avgs[statKey] || 0,
                    gamesPlayed: avgs.gamesPlayed
                });
            }
        }
        
        // Sort descending by value
        playersWithStats.sort(function(a, b) {
            return b.value - a.value;
        });
        
        return playersWithStats.slice(0, limit);
    }
    
    /**
     * Get single game records for a stat category
     */
    function getSingleGameRecords(players, statKey, limit, seasonNumber) {
        limit = limit || 10;
        
        var records = [];
        for (var i = 0; i < players.length; i++) {
            var playerRecords;
            // If seasonNumber is provided and not "all", use season-specific records
            if (seasonNumber && seasonNumber !== "all") {
                playerRecords = players[i].seasonRecords && players[i].seasonRecords[seasonNumber];
            } else {
                playerRecords = players[i].records;
            }
            
            if (playerRecords && playerRecords[statKey] && playerRecords[statKey].value > 0) {
                records.push({
                    player: players[i],
                    value: playerRecords[statKey].value,
                    court: playerRecords[statKey].court || null,
                    date: playerRecords[statKey].date || null
                });
            }
        }
        
        // Sort descending by value
        records.sort(function(a, b) {
            return b.value - a.value;
        });
        
        return records.slice(0, limit);
    }
    
    /**
     * Get PvP leaders for a stat category
     */
    function getPvpLeaders(players, statKey, limit) {
        limit = limit || 10;
        
        var playersWithStats = [];
        for (var i = 0; i < players.length; i++) {
            var pvp = players[i].pvpStats;
            if (!pvp || !pvp.gamesPlayed || pvp.gamesPlayed < 1) continue;
            
            var value = 0;
            var totals = pvp.totals || {};
            
            if (statKey === "wins") {
                value = pvp.wins || 0;
            } else if (statKey === "winPct") {
                value = pvp.gamesPlayed > 0 ? (pvp.wins / pvp.gamesPlayed * 100) : 0;
            } else if (statKey === "streak") {
                value = pvp.longestWinStreak || 0;
            } else if (statKey === "ppg") {
                value = pvp.gamesPlayed > 0 ? ((totals.points || 0) / pvp.gamesPlayed) : 0;
            }
            
            playersWithStats.push({
                player: players[i],
                value: value,
                gamesPlayed: pvp.gamesPlayed,
                wins: pvp.wins || 0,
                losses: pvp.losses || 0
            });
        }
        
        // Sort descending by value
        playersWithStats.sort(function(a, b) {
            return b.value - a.value;
        });
        
        return playersWithStats.slice(0, limit);
    }
    
    function logTiming(msg) {
        if (typeof debugLog === "function") {
            debugLog("[TOURNAMENTS] " + msg);
        }
    }
    
    /**
     * RichView leaderboard
     * @param {Object} ctx - Player context
     * @param {string} initialViewMode - Optional initial view mode (VIEW_RANKINGS, VIEW_LEADERS, etc.)
     */
    function runRichView(ctx, initialViewMode) {
        var runStart = Date.now();
        logTiming("runRichView START, initialViewMode=" + initialViewMode);
        
        var viewMode = initialViewMode || VIEW_RANKINGS;  // Current view: rankings, leaders, records, pvp_leaders
        var sortMode = "rep";          // For rankings: rep, wins, name
        var leaderStat = 0;            // Index into LEADER_CATEGORIES
        var recordStat = 0;            // Index into RECORD_CATEGORIES
        var pvpLeaderStat = 0;         // Index into PVP_LEADER_CATEGORIES
        
        // Season selection: null/"all" = all-time, number = specific season
        // Default to current season
        var currentSeason = 1;
        if (LORB.SharedState && LORB.SharedState.getInfo) {
            var info = LORB.SharedState.getInfo();
            currentSeason = info.seasonNumber || 1;
        }
        var selectedSeason = currentSeason;  // Start on current season
        
        // Build list of available seasons for navigation (will be populated from data)
        var availableSeasons = ["all"];  // Always have "all" option
        
        // Cache online players - uses subscription-based cache (non-blocking)
        var onlinePlayers = {};
        
        /**
         * Get online players - FULLY NON-BLOCKING.
         * Uses cached data from subscription callbacks.
         * No network calls, no locks, no cycle calls - instant return.
         */
        function refreshOnlinePlayers() {
            var t0 = Date.now();
            // DO NOT call ChallengeService.cycle() here - that triggers blocking poll()
            
            // Get cached online players (no network call)
            if (LORB.Multiplayer && LORB.Multiplayer.Challenges && 
                LORB.Multiplayer.Challenges.getOnlinePlayers) {
                var t1 = Date.now();
                onlinePlayers = LORB.Multiplayer.Challenges.getOnlinePlayers() || {};
                logTiming("refreshOnlinePlayers: pubsub path took " + (Date.now() - t1) + "ms, result count=" + Object.keys(onlinePlayers).length);
            } else if (LORB.Persist && LORB.Persist.getOnlinePlayers) {
                var t2 = Date.now();
                onlinePlayers = LORB.Persist.getOnlinePlayers() || {};
                logTiming("refreshOnlinePlayers: persist fallback took " + (Date.now() - t2) + "ms");
            } else {
                logTiming("refreshOnlinePlayers: NO PATH AVAILABLE");
            }
            logTiming("refreshOnlinePlayers INTERNAL total=" + (Date.now() - t0) + "ms");
            
            return onlinePlayers;
        }
        
        /**
         * Build list of available seasons from player data
         */
        function buildSeasonList(players) {
            var seasonSet = {};
            // Always include current season and "all"
            seasonSet["all"] = true;
            seasonSet[currentSeason] = true;
            
            // Scan players for seasons they have data in
            for (var i = 0; i < players.length; i++) {
                var p = players[i];
                if (p.seasonStats) {
                    for (var sn in p.seasonStats) {
                        if (p.seasonStats.hasOwnProperty(sn)) {
                            seasonSet[sn] = true;
                        }
                    }
                }
            }
            
            // Build sorted array: "all" first, then season numbers descending
            var seasons = [];
            var nums = [];
            for (var key in seasonSet) {
                if (key === "all") {
                    // Will add at start
                } else {
                    var n = parseInt(key, 10);
                    if (!isNaN(n)) nums.push(n);
                }
            }
            nums.sort(function(a, b) { return b - a; });  // Descending (newest first)
            seasons.push("all");  // "all" is first option
            for (var j = 0; j < nums.length; j++) {
                seasons.push(nums[j]);
            }
            return seasons;
        }
        
        /**
         * Navigate to next/prev season
         */
        function navigateSeason(direction) {
            var idx = -1;
            for (var i = 0; i < availableSeasons.length; i++) {
                if (availableSeasons[i] === selectedSeason || 
                    (availableSeasons[i] === "all" && selectedSeason === "all")) {
                    idx = i;
                    break;
                }
            }
            if (idx === -1) {
                // Current selection not found, default to first
                selectedSeason = availableSeasons[0];
                return;
            }
            
            if (direction === "next") {
                idx = (idx + 1) % availableSeasons.length;
            } else {
                idx = (idx - 1 + availableSeasons.length) % availableSeasons.length;
            }
            selectedSeason = availableSeasons[idx];
        }
        
        /**
         * Format season label for display
         */
        function formatSeasonLabel(season) {
            if (season === "all") return "ALL-TIME";
            return "SEASON " + season;
        }
        
        while (true) {
            var loopStart = Date.now();
            logTiming("loop iteration START, runElapsed=" + (loopStart - runStart) + "ms");
            
            // Fetch player list (local file, fast)
            var players = [];
            if (LORB.Persist && LORB.Persist.listPlayers) {
                players = LORB.Persist.listPlayers() || [];
            }
            logTiming("listPlayers done, count=" + players.length + ", elapsed=" + (Date.now() - loopStart) + "ms");
            
            // Build available seasons list from player data
            availableSeasons = buildSeasonList(players);
            logTiming("buildSeasonList done, seasons=" + availableSeasons.join(",") + ", elapsed=" + (Date.now() - loopStart) + "ms");
            
            // Use cached online players (network call, slow - only refresh on TTL)
            refreshOnlinePlayers();
            logTiming("refreshOnlinePlayers done, elapsed=" + (Date.now() - loopStart) + "ms");
            
            // Get my ID to mark self in list (but don't filter out)
            var myGlobalId = LORB.Persist.getGlobalPlayerId ? 
                LORB.Persist.getGlobalPlayerId(ctx._user) : null;
            logTiming("got myGlobalId, elapsed=" + (Date.now() - loopStart) + "ms");
            
            logTiming("dispatching to view, viewMode=" + viewMode + ", elapsed=" + (Date.now() - loopStart) + "ms");
            
            // Dispatch to appropriate view
            // Mode switching is now handled by the hub menu, so each view just handles
            // its own navigation (stat cycling, season navigation) and returns on exit
            var result;
            if (viewMode === VIEW_RANKINGS) {
                logTiming("showRankingsView START");
                result = showRankingsView(ctx, players, onlinePlayers, myGlobalId, sortMode, selectedSeason, formatSeasonLabel);
                logTiming("showRankingsView DONE, result=" + (typeof result === 'object' ? JSON.stringify(result) : result));
                if (result && result.sortMode) {
                    sortMode = result.sortMode;
                    continue;
                } else if (result === "season_next") {
                    navigateSeason("next");
                    continue;
                } else if (result === "season_prev") {
                    navigateSeason("prev");
                    continue;
                }
            } else if (viewMode === VIEW_LEADERS) {
                result = showLeadersView(ctx, players, myGlobalId, leaderStat, selectedSeason, formatSeasonLabel);
                if (result === "next") {
                    leaderStat = (leaderStat + 1) % LEADER_CATEGORIES.length;
                    continue;
                } else if (result === "prev") {
                    leaderStat = (leaderStat - 1 + LEADER_CATEGORIES.length) % LEADER_CATEGORIES.length;
                    continue;
                } else if (result === "season_next") {
                    navigateSeason("next");
                    continue;
                } else if (result === "season_prev") {
                    navigateSeason("prev");
                    continue;
                }
            } else if (viewMode === VIEW_RECORDS) {
                result = showRecordsView(ctx, players, myGlobalId, recordStat, selectedSeason, formatSeasonLabel);
                if (result === "next") {
                    recordStat = (recordStat + 1) % RECORD_CATEGORIES.length;
                    continue;
                } else if (result === "prev") {
                    recordStat = (recordStat - 1 + RECORD_CATEGORIES.length) % RECORD_CATEGORIES.length;
                    continue;
                } else if (result === "season_next") {
                    navigateSeason("next");
                    continue;
                } else if (result === "season_prev") {
                    navigateSeason("prev");
                    continue;
                }
            } else if (viewMode === VIEW_PVP_LEADERS) {
                result = showPvpLeadersView(ctx, players, myGlobalId, pvpLeaderStat);
                if (result === "next") {
                    pvpLeaderStat = (pvpLeaderStat + 1) % PVP_LEADER_CATEGORIES.length;
                    continue;
                } else if (result === "prev") {
                    pvpLeaderStat = (pvpLeaderStat - 1 + PVP_LEADER_CATEGORIES.length) % PVP_LEADER_CATEGORIES.length;
                    continue;
                }
            }
            
            // Exit or other action - return to hub
            return;
        }
    }
    
    /**
     * Show Rankings View (original leaderboard)
     * Now season-aware: shows W-L for the selected season
     */
    function showRankingsView(ctx, players, onlinePlayers, myGlobalId, sortMode, seasonFilter, formatSeasonLabel) {
        var viewStart = Date.now();
        logTiming("showRankingsView ENTER, players=" + players.length);
        var seasonLabel = formatSeasonLabel(seasonFilter);
        
        // Get W-L for each player based on season filter
        // For season view, use seasonStats. For "all", use career wins/losses
        function getPlayerWL(p) {
            if (seasonFilter && seasonFilter !== "all") {
                // Season-specific W-L
                if (p.seasonStats && p.seasonStats[seasonFilter]) {
                    var ss = p.seasonStats[seasonFilter];
                    return { wins: ss.wins || 0, losses: ss.losses || 0 };
                }
                return { wins: 0, losses: 0 };  // No data for this season
            } else {
                // All-time career W-L
                return { wins: p.wins || 0, losses: p.losses || 0 };
            }
        }
        
        // Sort based on current mode, using season-appropriate data
        if (sortMode === "rep") {
            players.sort(function(a, b) { return (b.rep || 0) - (a.rep || 0); });
        } else if (sortMode === "wins") {
            players.sort(function(a, b) { 
                var aWL = getPlayerWL(a);
                var bWL = getPlayerWL(b);
                return bWL.wins - aWL.wins; 
            });
        } else if (sortMode === "name") {
            players.sort(function(a, b) {
                var nameA = (a.name || a.globalId || "").toLowerCase();
                var nameB = (b.name || b.globalId || "").toLowerCase();
                return nameA < nameB ? -1 : (nameA > nameB ? 1 : 0);
            });
        }
        logTiming("sorted players, elapsed=" + (Date.now() - viewStart) + "ms");
        
        var hLine = "\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4";
        
        logTiming("creating RichView...");
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "table", x: 1, y: 5, width: 80, height: 17 },
                { name: "footer", x: 1, y: 22, width: 80, height: 3 }
            ],
            theme: "lorb"
        });
        logTiming("RichView created, elapsed=" + (Date.now() - viewStart) + "ms");
        
        // Header - show season in title
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            headerFrame.gotoxy(1, 1);
            headerFrame.putmsg("\1h\1r" + hLine + "\1n");
            headerFrame.gotoxy(1, 2);
            headerFrame.putmsg("\1h\1w  STANDINGS: \1h\1y" + seasonLabel + "                   \1n\1c[\x1B/\x1A] Season\1n");
            headerFrame.gotoxy(1, 3);
            headerFrame.putmsg("\1h\1r" + hLine + "\1n");
            headerFrame.gotoxy(1, 4);
            headerFrame.putmsg("  \1cPlayer                       \1n\xB3\1c W-L   \1n\xB3\1c Rep  \1n\xB3\1c Last On    \1n\xB3\1c BBS\1n");
        }
        
        // Footer - simplified (mode switching now in hub menu)
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.gotoxy(1, 1);
            footerFrame.putmsg("\1h\1r" + hLine + "\1n");
            footerFrame.gotoxy(1, 2);
            footerFrame.putmsg(" \1h\1w[ENTER]\1n\1c Challenge \1h\1w[S]\1n\1c Sort \1h\1w[\x1B/\x1A]\1n\1c Season \1h\1w[Q]\1n\1c Back");
        }
        logTiming("header/footer built, elapsed=" + (Date.now() - viewStart) + "ms");
        
        logTiming("calling view.render()...");
        view.render();
        logTiming("view.render() DONE, elapsed=" + (Date.now() - viewStart) + "ms");
        
        if (players.length === 0) {
            var tableFrame = view.getZone("table");
            if (tableFrame) {
                tableFrame.gotoxy(3, 5);
                tableFrame.putmsg("\1kNo players found.\1n");
                tableFrame.gotoxy(3, 7);
                tableFrame.putmsg("\1wBe the first to make a name in Rim City!\1n");
            }
            view.render();
            console.getkey();
            view.close();
            return "back";
        }
        
        // Build table rows as menu items
        var menuItems = [];
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var isSelf = (p.globalId === myGlobalId);
            var isOnline = !!onlinePlayers[p.globalId];
            var playerWL = getPlayerWL(p);
            var wl = playerWL.wins + "-" + playerWL.losses;
            p.isOnline = isOnline;
            
            // Show "ONLINE" if player is online, otherwise show last played
            var lastOn = isOnline ? "\1g\1hONLINE\1n" : formatLastPlayed(p.lastSave);
            var bbsName = truncate(p.bbsName || "Unknown", 10);
            
            // Format row: Name | W-L | Rep | Last On | BBS
            // Mark self with (YOU)
            var displayName = p.name || p.globalId;
            if (isSelf) displayName += " \1c(YOU)\1n";
            
            var row = " \1w" + padRight(truncate(displayName, 26), 26) + "\1n \xB3\1c " +
                      padRight(wl, 5) + "\1n \xB3\1c " +
                      padRight(String(p.rep || 0), 4) + "\1n \xB3\1c " +
                      padRight(lastOn, 10) + "\1n \xB3 \1w" +
                      bbsName + "\1n";
            
            menuItems.push({
                text: row,
                value: i,
                data: p,
                _isSelf: isSelf,
                _isOnline: isOnline
            });
        }
        
        menuItems.push({ text: "Back to Rim City", value: "back", hotkey: "Q" });
        logTiming("menuItems built, count=" + menuItems.length + ", elapsed=" + (Date.now() - viewStart) + "ms");
        
        // Create onIdle callback to cycle challenge service while waiting for input
        var onIdleCallback = null;
        if (LORB.Multiplayer && LORB.Multiplayer.ChallengeService && LORB.Multiplayer.ChallengeService.cycle) {
            onIdleCallback = function() {
                LORB.Multiplayer.ChallengeService.cycle();
            };
        }
        
        view.setContentZone("table");
        logTiming("calling view.menu()...");
        var choice = view.menu(menuItems, { y: 1, hotkeys: "S23PO" + KEY_LEFT + KEY_RIGHT, onIdle: onIdleCallback });
        logTiming("view.menu() returned choice=" + choice + ", elapsed=" + (Date.now() - viewStart) + "ms");
        view.close();
        
        // Handle season navigation (arrow keys)
        if (choice === KEY_LEFT || choice === "\x1B[D" || choice === "\x02" || choice === "4") {
            return "season_prev";
        }
        if (choice === KEY_RIGHT || choice === "\x1B[C" || choice === "\x06" || choice === "6") {
            return "season_next";
        }
        
        // Handle hotkey returns
        if (choice === "S") {
            // Cycle sort mode
            var newSort;
            if (sortMode === "rep") newSort = "wins";
            else if (sortMode === "wins") newSort = "name";
            else newSort = "rep";
            return { sortMode: newSort };
        }
        
        if (choice === "back" || choice === null) {
            return "back";
        }
        
        // Selected a player - show options (but can't challenge self)
        var player = players[choice];
        var isSelf = (player && player.globalId === myGlobalId);
        if (player) {
            var action = showPlayerOptions(ctx, player, isSelf);
            if (action === "live_challenge" && !isSelf) {
                startLiveChallenge(ctx, player);
            } else if (action === "challenge" && !isSelf) {
                challengePlayer(ctx, player);
            }
        }
        
        return null;  // Stay in rankings view
    }
    
    /**
     * Show League Leaders View
     */
    function showLeadersView(ctx, players, myGlobalId, statIndex, seasonFilter, formatSeasonLabel) {
        var category = LEADER_CATEGORIES[statIndex];
        var leaders = getLeagueLeaders(players, category.key, 15, seasonFilter);
        var seasonLabel = formatSeasonLabel(seasonFilter);
        
        var hLine = "\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4";
        
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "table", x: 1, y: 5, width: 80, height: 17 },
                { name: "footer", x: 1, y: 22, width: 80, height: 3 }
            ],
            theme: "lorb"
        });
        
        // Header - show season and stat category
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            headerFrame.gotoxy(1, 1);
            headerFrame.putmsg("\1h\1c" + hLine + "\1n");
            headerFrame.gotoxy(1, 2);
            headerFrame.putmsg("\1h\1w  LEAGUE LEADERS: \1h\1y" + category.name + " (" + category.abbrev + ")        \1n\1c[\x1B/\x1A] \1h\1m" + seasonLabel + "\1n");
            headerFrame.gotoxy(1, 3);
            headerFrame.putmsg("\1h\1c" + hLine + "\1n");
            headerFrame.gotoxy(1, 4);
            headerFrame.putmsg("  \1cRank  Player                          " + category.abbrev + "     Games   BBS\1n");
        }
        
        // Footer - simplified (mode switching now in hub menu)
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.gotoxy(1, 1);
            footerFrame.putmsg("\1h\1c" + hLine + "\1n");
            footerFrame.gotoxy(1, 2);
            footerFrame.putmsg(" \1h\1w[+/-]\1n\1c Stat \1h\1w[\x1B/\x1A]\1n\1c Season \1h\1w[Q]\1n\1c Back");
        }
        
        // Table content
        var tableFrame = view.getZone("table");
        if (tableFrame) {
            if (leaders.length === 0) {
                tableFrame.gotoxy(3, 3);
                tableFrame.putmsg("\1kNo qualifying players (min 3 games).\1n");
            } else {
                for (var i = 0; i < leaders.length; i++) {
                    var entry = leaders[i];
                    var p = entry.player;
                    var isSelf = (p.globalId === myGlobalId);
                    var rank = String(i + 1);
                    while (rank.length < 2) rank = " " + rank;
                    
                    var displayName = p.name || p.globalId;
                    if (isSelf) displayName += " \1c(YOU)\1n";
                    
                    var valueStr = entry.value.toFixed(1);
                    while (valueStr.length < 6) valueStr = " " + valueStr;
                    
                    var gamesStr = String(entry.gamesPlayed);
                    while (gamesStr.length < 5) gamesStr = " " + gamesStr;
                    
                    var bbsName = truncate(p.bbsName || "Unknown", 12);
                    
                    var rowColor = isSelf ? "\1h\1y" : "\1w";
                    tableFrame.gotoxy(1, i + 1);
                    tableFrame.putmsg("  " + rowColor + rank + ".  " + padRight(truncate(displayName, 28), 28) + 
                                     "\1h\1g" + valueStr + "\1n     " + gamesStr + "   " + bbsName + "\1n");
                }
            }
        }
        
        view.render();
        
        // Wait for input
        var key = console.getkey();
        view.close();
        
        if (key === "\x1B" || key === "q" || key === "Q") return "back";
        // Arrow keys for season navigation
        if (key === "\x1B[C" || key === "\x06" || key === "6" || key === KEY_RIGHT) return "season_next";
        if (key === "\x1B[D" || key === "\x02" || key === "4" || key === KEY_LEFT) return "season_prev";
        // +/- for stat category cycling
        if (key === "+" || key === "=") return "next";
        if (key === "-" || key === "_") return "prev";
        
        return null;  // Stay in leaders view
    }
    
    /**
     * Show Single Game Records View
     */
    function showRecordsView(ctx, players, myGlobalId, statIndex, seasonFilter, formatSeasonLabel) {
        var category = RECORD_CATEGORIES[statIndex];
        var records = getSingleGameRecords(players, category.key, 15, seasonFilter);
        var seasonLabel = formatSeasonLabel(seasonFilter);
        
        var hLine = "\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4";
        
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "table", x: 1, y: 5, width: 80, height: 17 },
                { name: "footer", x: 1, y: 22, width: 80, height: 3 }
            ],
            theme: "lorb"
        });
        
        // Header - show season and stat category
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            headerFrame.gotoxy(1, 1);
            headerFrame.putmsg("\1h\1m" + hLine + "\1n");
            headerFrame.gotoxy(1, 2);
            headerFrame.putmsg("\1h\1w  SINGLE GAME RECORDS: \1h\1m" + category.name + " (" + category.abbrev + ")    \1n\1c[\x1B/\x1A] \1h\1y" + seasonLabel + "\1n");
            headerFrame.gotoxy(1, 3);
            headerFrame.putmsg("\1h\1m" + hLine + "\1n");
            headerFrame.gotoxy(1, 4);
            headerFrame.putmsg("  \1cRank  Player                          " + category.abbrev + "    Court            BBS\1n");
        }
        
        // Footer - simplified (mode switching now in hub menu)
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.gotoxy(1, 1);
            footerFrame.putmsg("\1h\1m" + hLine + "\1n");
            footerFrame.gotoxy(1, 2);
            footerFrame.putmsg(" \1h\1w[+/-]\1n\1c Stat \1h\1w[\x1B/\x1A]\1n\1c Season \1h\1w[Q]\1n\1c Back");
        }
        
        // Table content
        var tableFrame = view.getZone("table");
        if (tableFrame) {
            if (records.length === 0) {
                tableFrame.gotoxy(3, 3);
                tableFrame.putmsg("\1kNo records set yet.\1n");
            } else {
                for (var i = 0; i < records.length; i++) {
                    var entry = records[i];
                    var p = entry.player;
                    var isSelf = (p.globalId === myGlobalId);
                    var rank = String(i + 1);
                    while (rank.length < 2) rank = " " + rank;
                    
                    var displayName = p.name || p.globalId;
                    if (isSelf) displayName += " \1c(YOU)\1n";
                    
                    var valueStr = String(entry.value);
                    while (valueStr.length < 4) valueStr = " " + valueStr;
                    
                    var courtStr = truncate(entry.court || "Unknown", 14);
                    var bbsName = truncate(p.bbsName || "Unknown", 10);
                    
                    var rowColor = isSelf ? "\1h\1y" : "\1w";
                    tableFrame.gotoxy(1, i + 1);
                    tableFrame.putmsg("  " + rowColor + rank + ".  " + padRight(truncate(displayName, 28), 28) + 
                                     "\1h\1m" + valueStr + "\1n    " + padRight(courtStr, 14) + "  " + bbsName + "\1n");
                }
            }
        }
        
        view.render();
        
        // Wait for input
        var key = console.getkey();
        view.close();
        
        if (key === "\x1B" || key === "q" || key === "Q") return "back";
        // Arrow keys for season navigation
        if (key === "\x1B[C" || key === "\x06" || key === "6" || key === KEY_RIGHT) return "season_next";
        if (key === "\x1B[D" || key === "\x02" || key === "4" || key === KEY_LEFT) return "season_prev";
        // +/- for stat category cycling
        if (key === "+" || key === "=") return "next";
        if (key === "-" || key === "_") return "prev";
        
        return null;  // Stay in records view
    }
    
    /**
     * Show PvP Leaders View
     */
    function showPvpLeadersView(ctx, players, myGlobalId, statIndex) {
        var category = PVP_LEADER_CATEGORIES[statIndex];
        var leaders = getPvpLeaders(players, category.key, 15);
        
        var hLine = "\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4";
        
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "table", x: 1, y: 5, width: 80, height: 17 },
                { name: "footer", x: 1, y: 22, width: 80, height: 3 }
            ],
            theme: "lorb"
        });
        
        // Header
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            headerFrame.gotoxy(1, 1);
            headerFrame.putmsg("\1h\1r" + hLine + "\1n");
            headerFrame.gotoxy(1, 2);
            headerFrame.putmsg("\1h\1w  PVP LEADERS: \1h\1r" + category.name + " (" + category.abbrev + ")\1n");
            headerFrame.gotoxy(1, 3);
            headerFrame.putmsg("\1h\1r" + hLine + "\1n");
            headerFrame.gotoxy(1, 4);
            headerFrame.putmsg("  \1cRank  Player                          " + padRight(category.abbrev, 6) + " W-L        BBS\1n");
        }
        
        // Footer - simplified (mode switching now in hub menu)
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.gotoxy(1, 1);
            footerFrame.putmsg("\1h\1r" + hLine + "\1n");
            footerFrame.gotoxy(1, 2);
            footerFrame.putmsg(" \1h\1w[\x1B/\x1A]\1n\1c Stat \1h\1w[Q]\1n\1c Back");
        }
        
        // Table content
        var tableFrame = view.getZone("table");
        if (tableFrame) {
            if (leaders.length === 0) {
                tableFrame.gotoxy(3, 3);
                tableFrame.putmsg("\1kNo players with PvP games yet.\1n");
            } else {
                for (var i = 0; i < leaders.length; i++) {
                    var entry = leaders[i];
                    var p = entry.player;
                    var isSelf = (p.globalId === myGlobalId);
                    var rank = String(i + 1);
                    while (rank.length < 2) rank = " " + rank;
                    
                    var displayName = p.name || p.globalId;
                    if (isSelf) displayName += " \1c(YOU)\1n";
                    
                    // Format value based on stat type
                    var valueStr;
                    if (category.key === "winPct") {
                        valueStr = entry.value.toFixed(1) + "%";
                    } else if (category.key === "ppg") {
                        valueStr = entry.value.toFixed(1);
                    } else {
                        valueStr = String(Math.floor(entry.value));
                    }
                    while (valueStr.length < 6) valueStr = " " + valueStr;
                    
                    var wlStr = entry.wins + "-" + entry.losses;
                    while (wlStr.length < 8) wlStr = wlStr + " ";
                    
                    var bbsName = truncate(p.bbsName || "Unknown", 10);
                    
                    var rowColor = isSelf ? "\1h\1y" : "\1w";
                    tableFrame.gotoxy(1, i + 1);
                    tableFrame.putmsg("  " + rowColor + rank + ".  " + padRight(truncate(displayName, 28), 28) + 
                                     "\1h\1r" + valueStr + "\1n " + wlStr + "   " + bbsName + "\1n");
                }
            }
        }
        
        view.render();
        
        // Wait for input
        var key = console.getkey();
        view.close();
        
        if (key === "\x1B" || key === "q" || key === "Q") return "back";
        if (key === "\x1B[C" || key === "\x06" || key === "6" || key === KEY_RIGHT) return "next";  // Right arrow
        if (key === "\x1B[D" || key === "\x02" || key === "4" || key === KEY_LEFT) return "prev";   // Left arrow
        
        return null;  // Stay in PvP leaders view
    }
    
    // =====================================================
    // BALLERDEX LEADERS - Contact collection leaderboard
    // =====================================================
    
    /**
     * Get players sorted by contact count
     */
    function getBallerdexLeaders(players, limit) {
        limit = limit || 15;
        
        var playersWithContacts = [];
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var contacts = (p.contacts && Array.isArray(p.contacts)) ? p.contacts : [];
            var contactCount = contacts.length;
            
            // Count signed contacts (status === "signed")
            var signedCount = 0;
            for (var j = 0; j < contacts.length; j++) {
                if (contacts[j].status === "signed") {
                    signedCount++;
                }
            }
            
            playersWithContacts.push({
                player: p,
                contactCount: contactCount,
                signedCount: signedCount
            });
        }
        
        // Sort by contact count descending
        playersWithContacts.sort(function(a, b) {
            return b.contactCount - a.contactCount;
        });
        
        return playersWithContacts.slice(0, limit);
    }
    
    /**
     * Calculate total stat points for a player's contacts (crew strength)
     */
    function calculateCrewStrength(contacts) {
        if (!contacts || !Array.isArray(contacts)) return 0;
        
        var totalStrength = 0;
        for (var i = 0; i < contacts.length; i++) {
            var c = contacts[i];
            // Contacts store stats directly or need hydration
            var stats = c.stats;
            if (stats) {
                totalStrength += (stats.speed || 0);
                totalStrength += (stats.threePt || 0);
                totalStrength += (stats.dunk || 0);
                totalStrength += (stats.block || 0);
                totalStrength += (stats.power || 0);
                totalStrength += (stats.steal || 0);
            }
        }
        return totalStrength;
    }
    
    /**
     * Get players sorted by crew strength (total contact stats)
     */
    function getCrewStrengthLeaders(players, limit) {
        limit = limit || 15;
        
        var playersWithStrength = [];
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var strength = calculateCrewStrength(p.contacts);
            var contactCount = (p.contacts && Array.isArray(p.contacts)) ? p.contacts.length : 0;
            playersWithStrength.push({
                player: p,
                strength: strength,
                contactCount: contactCount
            });
        }
        
        // Sort by strength descending
        playersWithStrength.sort(function(a, b) {
            return b.strength - a.strength;
        });
        
        return playersWithStrength.slice(0, limit);
    }
    
    /**
     * Get total number of available contacts in the game
     * Used to show "X of Y" collection progress
     */
    function getTotalAvailableContacts() {
        // Check if roster data is available
        if (LORB.Data && LORB.Data.Roster && LORB.Data.Roster.getAllPlayers) {
            var allPlayers = LORB.Data.Roster.getAllPlayers();
            return allPlayers ? allPlayers.length : 0;
        }
        // Fallback - estimate based on known roster size
        return 0;  // Will show just count without "of X"
    }
    
    /**
     * Show Ballerdex Leaders View
     */
    function showBallerdexLeaders(ctx) {
        // Fetch player list
        var players = [];
        if (LORB.Persist && LORB.Persist.listPlayers) {
            players = LORB.Persist.listPlayers() || [];
        }
        
        var myGlobalId = LORB.Persist.getGlobalPlayerId ? 
            LORB.Persist.getGlobalPlayerId(ctx._user) : null;
        
        var leaders = getBallerdexLeaders(players, 15);
        var totalAvailable = getTotalAvailableContacts();
        
        var hLine = "\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4";
        
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "table", x: 1, y: 5, width: 80, height: 17 },
                { name: "footer", x: 1, y: 22, width: 80, height: 3 }
            ],
            theme: "lorb"
        });
        
        // Header
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            headerFrame.gotoxy(1, 1);
            headerFrame.putmsg("\1h\1g" + hLine + "\1n");
            headerFrame.gotoxy(1, 2);
            var titleText = "  BALLERDEX LEADERS - Gotta Catch 'Em All!";
            if (totalAvailable > 0) {
                titleText += "  (" + totalAvailable + " available)";
            }
            headerFrame.putmsg("\1h\1w" + titleText + "\1n");
            headerFrame.gotoxy(1, 3);
            headerFrame.putmsg("\1h\1g" + hLine + "\1n");
            headerFrame.gotoxy(1, 4);
            headerFrame.putmsg("  \1h\1cPlayer                     \1n\xB3\1h\1c Caught \1n\xB3\1h\1c Signed \1n\xB3\1h\1c W-L   \1n\xB3\1h\1c BBS\1n");
        }
        
        // Footer
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.gotoxy(1, 1);
            footerFrame.putmsg("\1h\1g" + hLine + "\1n");
            footerFrame.gotoxy(1, 2);
            footerFrame.putmsg(" \1h\1w[Q]\1n\1c Back to Tournaments\1n");
        }
        
        // Table content
        var tableFrame = view.getZone("table");
        if (tableFrame) {
            if (leaders.length === 0) {
                tableFrame.gotoxy(3, 3);
                tableFrame.putmsg("\1h\1wNo players with contacts yet.\1n");
            } else {
                for (var i = 0; i < leaders.length; i++) {
                    var entry = leaders[i];
                    var p = entry.player;
                    var isSelf = (p.globalId === myGlobalId);
                    var rank = String(i + 1);
                    while (rank.length < 2) rank = " " + rank;
                    
                    var displayName = p.name || p.globalId;
                    if (isSelf) displayName += " \1c(YOU)\1n";
                    
                    // Caught count
                    var caughtStr = String(entry.contactCount);
                    if (totalAvailable > 0) {
                        caughtStr += "/" + totalAvailable;
                    }
                    while (caughtStr.length < 7) caughtStr = " " + caughtStr;
                    
                    // Signed count
                    var signedStr = String(entry.signedCount);
                    while (signedStr.length < 7) signedStr = " " + signedStr;
                    
                    var wlStr = (p.wins || 0) + "-" + (p.losses || 0);
                    while (wlStr.length < 6) wlStr = wlStr + " ";
                    
                    var bbsName = truncate(p.bbsName || "Unknown", 10);
                    
                    var rowColor = isSelf ? "\1h\1y" : "\1w";
                    var nameColor = isSelf ? "\1h\1y" : "\1h\1w";
                    tableFrame.gotoxy(1, i + 1);
                    tableFrame.putmsg("  " + rowColor + rank + ".  " + nameColor + padRight(truncate(displayName, 25), 25) + 
                                     "\1n \1h\1g" + caughtStr + "\1n \1h\1y" + signedStr + "\1n \1w" + wlStr + " " + bbsName + "\1n");
                }
            }
        }
        
        view.render();
        
        // Wait for input
        var key = console.getkey();
        view.close();
        
        return null;  // Always return to hub
    }
    
    /**
     * Show Crew Strength Leaders View
     */
    function showCrewStrengthLeaders(ctx) {
        // Fetch player list
        var players = [];
        if (LORB.Persist && LORB.Persist.listPlayers) {
            players = LORB.Persist.listPlayers() || [];
        }
        
        var myGlobalId = LORB.Persist.getGlobalPlayerId ? 
            LORB.Persist.getGlobalPlayerId(ctx._user) : null;
        
        var leaders = getCrewStrengthLeaders(players, 15);
        
        var hLine = "\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4";
        
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "table", x: 1, y: 5, width: 80, height: 17 },
                { name: "footer", x: 1, y: 22, width: 80, height: 3 }
            ],
            theme: "lorb"
        });
        
        // Header
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            headerFrame.gotoxy(1, 1);
            headerFrame.putmsg("\1h\1m" + hLine + "\1n");
            headerFrame.gotoxy(1, 2);
            headerFrame.putmsg("\1h\1w  CREW STRENGTH - Total Contact Power Rankings\1n");
            headerFrame.gotoxy(1, 3);
            headerFrame.putmsg("\1h\1m" + hLine + "\1n");
            headerFrame.gotoxy(1, 4);
            headerFrame.putmsg("  \1cPlayer                       \1n\xB3\1c Strength \1n\xB3\1c # Crew \1n\xB3\1c Avg  \1n\xB3\1c BBS\1n");
        }
        
        // Footer
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.gotoxy(1, 1);
            footerFrame.putmsg("\1h\1m" + hLine + "\1n");
            footerFrame.gotoxy(1, 2);
            footerFrame.putmsg(" \1h\1w[Q]\1n\1c Back to Tournaments\1n");
        }
        
        // Table content
        var tableFrame = view.getZone("table");
        if (tableFrame) {
            if (leaders.length === 0) {
                tableFrame.gotoxy(3, 3);
                tableFrame.putmsg("\1kNo players with contacts yet.\1n");
            } else {
                for (var i = 0; i < leaders.length; i++) {
                    var entry = leaders[i];
                    var p = entry.player;
                    var isSelf = (p.globalId === myGlobalId);
                    var rank = String(i + 1);
                    while (rank.length < 2) rank = " " + rank;
                    
                    var displayName = p.name || p.globalId;
                    if (isSelf) displayName += " \1c(YOU)\1n";
                    
                    var strengthStr = String(entry.strength);
                    while (strengthStr.length < 9) strengthStr = " " + strengthStr;
                    
                    var crewStr = String(entry.contactCount);
                    while (crewStr.length < 7) crewStr = " " + crewStr;
                    
                    // Average strength per contact
                    var avgStr = entry.contactCount > 0 
                        ? (entry.strength / entry.contactCount).toFixed(1)
                        : "0.0";
                    while (avgStr.length < 5) avgStr = " " + avgStr;
                    
                    var bbsName = truncate(p.bbsName || "Unknown", 10);
                    
                    var rowColor = isSelf ? "\1h\1y" : "\1w";
                    tableFrame.gotoxy(1, i + 1);
                    tableFrame.putmsg("  " + rowColor + rank + ".  " + padRight(truncate(displayName, 28), 28) + 
                                     "\1h\1m" + strengthStr + "\1n " + crewStr + " " + avgStr + " " + bbsName + "\1n");
                }
            }
        }
        
        view.render();
        
        // Wait for input
        var key = console.getkey();
        view.close();
        
        return null;  // Always return to hub
    }
    
    /**
     * Show options for selected player - goes directly to full stats view
     * with challenge option integrated
     */
    function showPlayerOptions(ctx, player, isSelf) {
        // Calculate max wager
        var theirCash = player.cash || 0;
        var myCash = ctx.cash || 0;
        var isOnline = !!player.isOnline;
        var maxWager = Math.max(
            Math.floor(theirCash * MAX_WAGER_PERCENT / 100),
            myCash
        );
        maxWager = Math.min(maxWager, myCash);  // Can't bet more than you have
        
        // Go directly to full stats view with challenge option
        if (LORB.UI && LORB.UI.StatsView && LORB.UI.StatsView.showForPlayer) {
            var result = LORB.UI.StatsView.showForPlayer(player, {
                canChallenge: true,
                canLiveChallenge: isOnline && !isSelf,
                maxWager: maxWager,
                isSelf: isSelf
            });
            return result;  // Returns "challenge" or null
        } else {
            // Fallback to legacy view with options
            return showPlayerOptionsLegacy(ctx, player, isSelf, maxWager);
        }
    }
    
    /**
     * Legacy fallback for player options (no RichView)
     */
    function showPlayerOptionsLegacy(ctx, player, isSelf, maxWager) {
        LORB.View.clear();
        LORB.View.header("PLAYER CARD: " + (player.name || player.globalId));
        LORB.View.line("");
        
        LORB.View.line("\1wRecord:\1n " + (player.wins || 0) + "W - " + (player.losses || 0) + "L");
        LORB.View.line("\1wRep:\1n " + (player.rep || 0));
        LORB.View.line("\1wLast Played:\1n " + formatLastPlayed(player.lastSave));
        LORB.View.line("\1wFrom:\1n " + (player.bbsName || "Unknown BBS"));
        LORB.View.line("");
        
        var isOnline = !!player.isOnline;
        if (isSelf) {
            LORB.View.line("\1kThis is you!\1n");
        } else {
            if (isOnline) {
                LORB.View.line("\1h\1y[L]\1n Live Challenge (player is online)");
            }
            if (maxWager > 0) {
                LORB.View.line("\1h\1y[C]\1n Challenge to Ghost Match (wager up to $" + maxWager + ")");
            }
        }
        LORB.View.line("\1w[Q] Back\1n");
        LORB.View.line("");
        
        while (true) {
            var key = console.getkey();
            if (key === "q" || key === "Q" || key === "\x1B") {
                return null;
            }
            if ((key === "l" || key === "L") && !isSelf && isOnline) {
                return "live_challenge";
            }
            if ((key === "c" || key === "C") && !isSelf && maxWager > 0) {
                return "challenge";
            }
        }
    }
    
    /**
     * Live challenge flow (online opponent)
     */
    function startLiveChallenge(ctx, player) {
        if (!LORB.Config || !LORB.Config.ENABLE_LIVE_CHALLENGES) {
            LORB.View.warn("Live challenges are currently disabled.");
            console.getkey();
            return;
        }
        if (!player || !player.globalId) {
            LORB.View.warn("Opponent is missing an ID.");
            console.getkey();
            return;
        }
        if (!LORB.Multiplayer || !LORB.Multiplayer.Challenges) {
            LORB.View.warn("Live challenges are unavailable.");
            console.getkey();
            return;
        }
        
        // Merge presence data into player to get activeTeammate and live appearance
        // This ensures the challenge contains the opponent's current sprite config
        var presenceData = null;
        if (LORB.Multiplayer.Challenges.getOnlinePlayers) {
            var onlinePlayers = LORB.Multiplayer.Challenges.getOnlinePlayers() || {};
            presenceData = onlinePlayers[player.globalId];
        }
        
        // Create merged player object with presence data taking priority
        var targetPlayer = {};
        for (var k in player) {
            if (player.hasOwnProperty(k)) {
                targetPlayer[k] = player[k];
            }
        }
        if (presenceData) {
            // Copy presence-specific fields that may be missing from static player data
            if (presenceData.activeTeammate) targetPlayer.activeTeammate = presenceData.activeTeammate;
            if (presenceData.appearance) targetPlayer.appearance = presenceData.appearance;
            if (presenceData.stats) targetPlayer.stats = presenceData.stats;
            if (presenceData.nickname) targetPlayer.nickname = presenceData.nickname;
            if (presenceData.position) targetPlayer.position = presenceData.position;
            if (presenceData.level) targetPlayer.level = presenceData.level;
            if (presenceData.archetype) targetPlayer.archetype = presenceData.archetype;
            // Ensure cash/rep from presence are available for max bet calculation
                    if (typeof presenceData.cash === "number") targetPlayer.cash = presenceData.cash;
            if (typeof presenceData.rep === "number") targetPlayer.rep = presenceData.rep;
        }
        
        // Use new integrated negotiation UI (handles wager input + waiting + counter-offers)
        var result = null;
        var challenge = null;
        if (LORB.Multiplayer.ChallengeNegotiation && LORB.Multiplayer.ChallengeNegotiation.showChallengerWagerInput) {
            result = LORB.Multiplayer.ChallengeNegotiation.showChallengerWagerInput(ctx, targetPlayer);
            if (!result || result.status === "cancelled") {
                // User cancelled - return silently (UI already handled)
                return;
            }
            challenge = result.challenge;
        }
        
        // Fallback legacy UI path (if negotiation module not available)
        if (!challenge && !result) {
            // Old path: create challenge without negotiation
            challenge = LORB.Multiplayer.Challenges.sendChallenge(ctx, targetPlayer, { mode: "live" });
            if (!challenge) {
                LORB.View.warn("Failed to send challenge.");
                console.getkey();
                return;
            }
            
            // Old waiting UI
            if (LORB.Multiplayer.ChallengeLobby && LORB.Multiplayer.ChallengeLobby.waitForReady) {
                if (LORB.Multiplayer.ChallengeLobbyUI && LORB.Multiplayer.ChallengeLobbyUI.showLobbyWaiting) {
                    LORB.Multiplayer.ChallengeLobbyUI.showLobbyWaiting(challenge, "Waiting for " + (player.name || "opponent") + " to accept...");
                } else {
                    LORB.View.clear();
                    LORB.View.header("LIVE CHALLENGE");
                    LORB.View.line("Waiting for " + (player.name || "opponent") + " to accept...");
                }
                result = LORB.Multiplayer.ChallengeLobby.waitForReady(challenge.id, ctx, { tickMs: 1200 });
            } else {
                mswait(5000);
                result = { status: "timeout" };
            }
        }
        
        // Handle non-ready outcomes
        if (!result) {
            result = { status: "cancelled" };
        }
        if (result.status !== "ready") {
            if (LORB.Multiplayer.ChallengeLobbyUI && LORB.Multiplayer.ChallengeLobbyUI.showOutcome) {
                LORB.Multiplayer.ChallengeLobbyUI.showOutcome(result.status);
            } else if (result.status !== "cancelled") {
                // Only show message for non-cancelled outcomes (cancelled is intentional)
                LORB.View.line("");
                if (result.status === "declined") {
                    LORB.View.warn("Challenge declined.");
                } else if (result.status === "timeout") {
                    LORB.View.warn("Challenge timed out.");
                } else {
                    LORB.View.warn("Challenge unavailable.");
                }
                LORB.View.line("");
                LORB.View.line("Press any key...");
                console.getkey();
            }
            return;
        }
        
        // If both players are ready, launch the multiplayer match
        if (result.status === "ready") {
            if (LORB.Multiplayer.Launcher && LORB.Multiplayer.Launcher.launchLorbMatch) {
                LORB.View.line("\1c*** Launching LORB Multiplayer Match ***\1n");
                mswait(1000);
                
                var gameResult = LORB.Multiplayer.Launcher.launchLorbMatch(challenge, ctx, true);
                
                if (gameResult && gameResult.completed) {
                    // Process PvP match results using hub's helper (stats, rewards, news)
                    var pvpProcessed = null;
                    if (LORB.Locations && LORB.Locations.Hub && LORB.Locations.Hub.processPvpMatchResults) {
                        pvpProcessed = LORB.Locations.Hub.processPvpMatchResults(ctx, gameResult, challenge, true);
                    }
                    
                    // Display results
                    LORB.View.clear();
                    LORB.View.header("MATCH COMPLETE");
                    LORB.View.line("");
                    LORB.View.line("Final Score: " + (gameResult.score ? (gameResult.score.teamA + " - " + gameResult.score.teamB) : "Unknown"));
                    LORB.View.line("");
                    
                    if (gameResult.iWon) {
                        LORB.View.line("\1g*** VICTORY! ***\1n");
                    } else if (gameResult.winner === "tie") {
                        LORB.View.line("\1yTie game!\1n");
                    } else {
                        LORB.View.line("\1rDefeat\1n");
                    }
                    
                    // Show rewards from PvP processing
                    if (pvpProcessed && pvpProcessed.rewards) {
                        LORB.View.line("");
                        var cashChange = pvpProcessed.rewards.cashChange;
                        var repChange = pvpProcessed.rewards.repChange;
                        if (cashChange !== 0) {
                            var cashColor = cashChange > 0 ? "\1g" : "\1r";
                            LORB.View.line(cashColor + "Cash: " + (cashChange > 0 ? "+" : "") + cashChange + "\1n");
                        }
                        if (repChange !== 0) {
                            var repColor = repChange > 0 ? "\1c" : "\1r";
                            LORB.View.line(repColor + "Rep: " + (repChange > 0 ? "+" : "") + repChange + "\1n");
                        }
                    }
                    
                    // Show any new records broken
                    if (pvpProcessed && pvpProcessed.newRecords && pvpProcessed.newRecords.length > 0) {
                        LORB.View.line("");
                        LORB.View.line("\1y\1h*** NEW PVP RECORDS! ***\1n");
                        for (var ri = 0; ri < pvpProcessed.newRecords.length; ri++) {
                            var rec = pvpProcessed.newRecords[ri];
                            LORB.View.line("\1g" + rec.name + ": " + rec.value + "\1n");
                        }
                    }
                    
                    // Show updated PvP record
                    if (pvpProcessed && pvpProcessed.pvpResult) {
                        LORB.View.line("");
                        LORB.View.line("PvP Record: \1w" + pvpProcessed.pvpResult.wins + "W-" + 
                                      pvpProcessed.pvpResult.losses + "L" + 
                                      (pvpProcessed.pvpResult.ties > 0 ? "-" + pvpProcessed.pvpResult.ties + "T" : "") + "\1n");
                        if (pvpProcessed.pvpResult.currentStreak > 1) {
                            LORB.View.line("\1g" + pvpProcessed.pvpResult.currentStreak + " game win streak!\1n");
                        }
                    }
                    
                    LORB.View.line("");
                    LORB.View.line("Press any key...");
                    console.getkey();
                    
                    // Save updated context
                    if (LORB.Persist && LORB.Persist.saveContext) {
                        LORB.Persist.saveContext(ctx);
                    }
                } else if (gameResult && gameResult.error) {
                    LORB.View.warn("Match error: " + gameResult.error);
                    LORB.View.line("Press any key...");
                    console.getkey();
                }
            } else {
                // Fallback if launcher not available
                LORB.View.line("\1yMultiplayer launcher not available.\1n");
                LORB.View.line("Press any key...");
                console.getkey();
            }
        }
        
        if (result.status !== "ready" && LORB.Multiplayer.Challenges && LORB.Multiplayer.Challenges.cancelChallenge) {
            LORB.Multiplayer.Challenges.cancelChallenge(challenge.id, ctx);
        }
    }
    
    /**
     * Ghost challenge flow
     */
    function challengePlayer(ctx, player) {
        LORB.View.clear();
        LORB.View.header("CHALLENGE " + (player.name || player.globalId).toUpperCase());
        LORB.View.line("");
        
        var theirCash = player.cash || 0;
        var myCash = ctx.cash || 0;
        
        // Max wager: 10% of their balance OR all of your cash, whichever is higher
        // But capped at what you actually have
        var maxWager = Math.max(
            Math.floor(theirCash * MAX_WAGER_PERCENT / 100),
            myCash
        );
        maxWager = Math.min(maxWager, myCash);
        
        if (maxWager <= 0) {
            LORB.View.warn("You don't have any cash to wager!");
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey();
            return;
        }
        
        LORB.View.line("Their record: " + (player.wins || 0) + "-" + (player.losses || 0) + " (Rep: " + (player.rep || 0) + ")");
        LORB.View.line("Your cash: $" + myCash);
        LORB.View.line("Max wager: $" + maxWager);
        LORB.View.line("");
        
        var wagerInput = LORB.View.prompt("Enter wager amount (0 to cancel): $");
        var wager = parseInt(wagerInput, 10);
        
        if (isNaN(wager) || wager <= 0) {
            LORB.View.line("Challenge cancelled.");
            console.getkey();
            return;
        }
        
        if (wager > maxWager) {
            LORB.View.warn("Wager too high! Max is $" + maxWager);
            console.getkey();
            return;
        }
        
        if (wager > myCash) {
            LORB.View.warn("You don't have that much cash!");
            console.getkey();
            return;
        }
        
        // Confirm
        LORB.View.line("");
        LORB.View.line("Challenge " + player.name + " for $" + wager + "?");
        LORB.View.line("");
        
        if (LORB.View.confirm("Confirm (Y/N): ")) {
            runGhostMatch(ctx, player, wager);
        } else {
            LORB.View.line("Challenge cancelled.");
            console.getkey();
        }
    }
    
    /**
     * Run ghost match - plays against opponent's ghost using real game engine
     */
    function runGhostMatch(ctx, opponent, wager) {
        LORB.View.clear();
        LORB.View.header("GHOST MATCH");
        LORB.View.line("");
        LORB.View.line("vs " + (opponent.name || opponent.globalId));
        LORB.View.line("Wager: $" + wager);
        LORB.View.line("");
        
        // Deduct wager upfront
        ctx.cash -= wager;
        
        // Check if real engine is available
        var realEngine = (typeof runExternalGame === "function");
        
        var won = false;
        var playerScore = 0;
        var opponentScore = 0;
        var playerGameStats = null;
        
        if (realEngine) {
            LORB.View.line("\1hLoading game...\1n");
            
            // Build player team (Team A - human controlled)
            var player = ctxToPlayer(ctx);
            var myTeammate = getMyTeammate(ctx);
            if (!myTeammate) {
                myTeammate = generateDefaultTeammate("Streetballer");
            }
            
            // Build ghost team (Team B - AI controlled)
            var ghostPlayer = ghostOpponentToPlayer(opponent);
            var ghostTeammate = getGhostTeammate(opponent);
            if (!ghostTeammate) {
                ghostTeammate = generateDefaultTeammate("Ghost Crew");
            }
            
            var config = {
                teamA: {
                    name: (ctx.name || "Player") + "'s Squad",
                    abbr: "YOU",
                    players: [player, myTeammate],
                    colors: { fg: "WHITE", bg: "BG_RED" }
                },
                teamB: {
                    name: (opponent.name || "Ghost") + "'s Ghost",
                    abbr: "GHO",
                    players: [ghostPlayer, ghostTeammate],
                    colors: { fg: "WHITE", bg: "BG_BLUE" }
                },
                options: {
                    gameTime: 90,
                    mode: "play",
                    humanTeam: "teamA",
                    humanPlayerIndex: 0,
                    showMatchupScreen: true,
                    showGameOverScreen: false
                },
                lorbContext: {
                    matchType: "ghost",
                    opponent: opponent,
                    wager: wager,
                    playerCtx: ctx,
                    hydratedCrew: (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getCrewWithContacts) ? LORB.Util.Contacts.getCrewWithContacts(ctx) : []
                }
            };
            
            // Run the real game
            var result = runExternalGame(config);
            
            if (result && result.completed) {
                won = (result.winner === "teamA");
                playerScore = result.score.teamA;
                opponentScore = result.score.teamB;
                
                // Extract player's stats
                if (result.playerStats) {
                    if (result.playerStats["player"]) {
                        playerGameStats = result.playerStats["player"];
                    } else if (result.playerStats["teamA_player1"]) {
                        playerGameStats = result.playerStats["teamA_player1"];
                    } else {
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
                }
            } else if (result && result.exitReason === "quit") {
                // Player quit - refund wager, don't count as loss
                ctx.cash += wager;
                LORB.View.clear();
                LORB.View.header("MATCH ABANDONED");
                LORB.View.line("");
                LORB.View.warn("You quit the match. Wager refunded.");
                LORB.View.line("");
                LORB.View.line("Press any key...");
                console.getkey();
                return;
            } else {
                // Engine failed or errored - fall back to simulation
                won = Math.random() > 0.5;
                playerScore = won ? 21 : Math.floor(Math.random() * 18) + 3;
                opponentScore = won ? Math.floor(Math.random() * 18) + 3 : 21;
            }
        } else {
            // No real engine - use mock simulation
            LORB.View.line("\1k(Simulating match...)\1n");
            mswait(1500);
            won = Math.random() > 0.5;
            playerScore = won ? 21 : Math.floor(Math.random() * 18) + 3;
            opponentScore = won ? Math.floor(Math.random() * 18) + 3 : 21;
        }
        
        // Display result
        LORB.View.clear();
        LORB.View.header("MATCH RESULT");
        LORB.View.line("");
        LORB.View.line("Final Score: \1h" + playerScore + " - " + opponentScore + "\1n");
        LORB.View.line("");
        
        if (won) {
            var winnings = wager * 2;
            ctx.cash += winnings;
            ctx.wins = (ctx.wins || 0) + 1;
            ctx.rep = (ctx.rep || 0) + 10;
            // Track season wins
            if (LORB.Util && LORB.Util.CareerStats && LORB.Util.CareerStats.recordWinLoss) {
                LORB.Util.CareerStats.recordWinLoss(ctx, true);
            }
            
            LORB.View.line("\1g\1h*** YOU WIN! ***\1n");
            LORB.View.line("");
            LORB.View.line("You defeated " + opponent.name + "'s ghost!");
            LORB.View.line("Winnings: \1g+$" + winnings + "\1n");
            LORB.View.line("Rep: \1c+10\1n");
        } else {
            ctx.losses = (ctx.losses || 0) + 1;
            // Track season losses
            if (LORB.Util && LORB.Util.CareerStats && LORB.Util.CareerStats.recordWinLoss) {
                LORB.Util.CareerStats.recordWinLoss(ctx, false);
            }
            
            LORB.View.line("\1r\1h*** DEFEAT ***\1n");
            LORB.View.line("");
            LORB.View.line(opponent.name + "'s ghost was too strong!");
            LORB.View.line("Lost: \1r-$" + wager + "\1n");
        }
        
        ctx.gamesPlayed = (ctx.gamesPlayed || 0) + 1;
        
        // Record career stats if we have game stats
        if (playerGameStats && LORB.Util && LORB.Util.CareerStats && LORB.Util.CareerStats.recordGame) {
            try {
                // Get current season for per-season tracking
                var seasonNum = (LORB.SharedState && LORB.SharedState.getInfo) 
                    ? (LORB.SharedState.getInfo().seasonNumber || 1) : 1;
                LORB.Util.CareerStats.recordGame(ctx, playerGameStats, {
                    opponentName: opponent ? (opponent.name || "Ghost") : "Ghost",
                    courtName: "Tournament",
                    seasonNumber: seasonNum
                });
            } catch (e) {
                log(LOG_WARNING, "[TOURNAMENTS] Failed to record career stats: " + e);
            }
        }
        
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
        
        // Save after ghost match
        if (LORB.Persist && LORB.Persist.save) {
            LORB.Persist.save(ctx);
        }
    }
    
    /**
     * Create ghost team from opponent data (legacy fallback)
     * @deprecated Use ghostOpponentToPlayer and getGhostTeammate instead
     */
    function createGhostTeam(opponent) {
        // Return a team object for legacy battle adapter
        return {
            name: opponent.name + "'s Ghost",
            difficulty: Math.min(5, Math.max(1, Math.floor((opponent.rep || 0) / 100) + 1)),
            players: [
                {
                    name: opponent.name || "Ghost",
                    stats: opponent.stats || { speed: 5, threePt: 5, dunk: 5, block: 5 }
                }
            ]
        };
    }
    
    /**
     * Format last played timestamp
     */
    function formatLastPlayed(timestamp) {
        if (!timestamp) return "Unknown";
        
        var now = Date.now();
        var diff = now - timestamp;
        var days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        if (days < 7) return days + " days ago";
        if (days < 30) return Math.floor(days / 7) + "w ago";
        
        // Format as date
        var d = new Date(timestamp);
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return months[d.getMonth()] + " " + d.getDate();
    }
    
    /**
     * Strip Synchronet color codes for length measurement
     */
    function stripColors(str) {
        // Remove \1X color codes (where X is any character)
        return String(str || "").replace(/\x01./g, "");
    }
    
    /**
     * Pad string to visual length (ignoring color codes)
     */
    function padRight(str, len) {
        str = String(str || "");
        var visualLen = stripColors(str).length;
        while (visualLen < len) {
            str += " ";
            visualLen++;
        }
        // If visual length exceeds, we need to truncate carefully
        // For now just return - truncate should be called first
        return str;
    }
    
    /**
     * Truncate string (color-aware)
     */
    function truncate(str, len) {
        str = String(str || "");
        var visualLen = stripColors(str).length;
        if (visualLen <= len) return str;
        // Need to truncate - but preserve color codes
        // Simple approach: strip colors, truncate, lose colors in truncated part
        var plain = stripColors(str);
        return plain.substring(0, len - 3) + "...";
    }
    
    /**
     * Legacy fallback
     */
    function runLegacy(ctx) {
        var players = [];
        if (LORB.Persist && LORB.Persist.listPlayers) {
            players = LORB.Persist.listPlayers() || [];
        }
        
        LORB.View.clear();
        LORB.View.header("TOURNAMENTS");
        LORB.View.line("");
        
        if (players.length === 0) {
            LORB.View.line("No other players found.");
        } else {
            LORB.View.line("Players:");
            for (var i = 0; i < Math.min(players.length, 10); i++) {
                var p = players[i];
                LORB.View.line((i + 1) + ". " + (p.name || p.globalId) + 
                    " - " + (p.wins || 0) + "W/" + (p.losses || 0) + "L" +
                    " (Rep: " + (p.rep || 0) + ")");
            }
        }
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
    }
    
    // Export
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Tournaments = {
        run: run,
        MAX_WAGER_PERCENT: MAX_WAGER_PERCENT
    };
    
})();
