/**
 * stats_records.js - Stats, Records & Leaderboards Hub
 * 
 * Information-focused view showing:
 * - Season Leaders (PPG, RPG, APG, etc.)
 * - Single-Game Records
 * - PvP Stats
 * - Ballerdex Leaders (contact collection)
 * - Crew Strength
 * 
 * No action capability (challenges) - that's in tournaments.js
 * Uses RichView with figlet banner, art zone, and lightbar menu.
 */

var _statsRecordsRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _statsRecordsRichView = RichView;
} catch (e) {
}

// Load BinLoader for .bin art files
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
    }
}

(function() {
    
    var RichView = _statsRecordsRichView;
    
    // Key constants for arrow navigation
    if (typeof KEY_LEFT === 'undefined') var KEY_LEFT = '\x1d';
    if (typeof KEY_RIGHT === 'undefined') var KEY_RIGHT = '\x1c';
    
    // View modes
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
    
    // Hub menu items with tooltips
    var HUB_MENU_ITEMS = [
        { text: "My Player Card", value: "player_card", hotkey: "1", tooltip: "View your personal stats and appearance" },
        { text: "Hall of Fame", value: "hall_of_fame", hotkey: "2", tooltip: "Champions who conquered Rim City" },
        { text: "Standings", value: "standings", hotkey: "3", tooltip: "Player rankings by rep, wins, and more" },
        { text: "Season Leaders", value: "leaders", hotkey: "4", tooltip: "League leaders in points, rebounds, and more" },
        { text: "Record Holders", value: "records", hotkey: "5", tooltip: "Single-game records by category" },
        { text: "PvP Stats", value: "pvp", hotkey: "6", tooltip: "Player vs Player win leaders" },
        { text: "Ballerdex Leaders", value: "ballerdex", hotkey: "7", tooltip: "Most contacts collected - gotta catch 'em all!" },
        { text: "Crew Strength", value: "crew_strength", hotkey: "8", tooltip: "Total power of your collected contacts" },
        { text: "Back to Hub", value: "quit", hotkey: "Q", tooltip: "Return to Rim City" }
    ];
    
    // Art constants
    var ART_WIDTH = 40;
    var ART_HEIGHT = 20;
    var ART_PATH = "/sbbs/xtrn/nba_jam/assets/lorb/stats_art.bin";
    var FALLBACK_ART = "/sbbs/xtrn/nba_jam/assets/lorb/hub_art.bin";
    
    /**
     * Load art into the art zone
     */
    function loadStatsArt(view) {
        if (typeof BinLoader === "undefined") return;
        
        var artFrame = view.getZone("art");
        if (!artFrame) return;
        
        var artPath = file_exists(ART_PATH) ? ART_PATH : FALLBACK_ART;
        
        if (file_exists(artPath)) {
            BinLoader.loadIntoFrame(artFrame, artPath, ART_WIDTH, ART_HEIGHT, 1, 1);
        }
        
        view.render();
    }
    
    /**
     * Render the figlet banner
     */
    function renderStatsBanner(view, title) {
        var headerFrame = view.getZone("header");
        if (!headerFrame) return;
        
        // Use FigletBanner if available
        if (LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
            // Use bright cyan for stats title
            var fgAttr = 11; // LIGHTCYAN
            LORB.Util.FigletBanner.renderToFrame(headerFrame, title, fgAttr);
        } else {
            // Fallback: plain centered text
            headerFrame.clear();
            var padding = Math.floor((80 - title.length) / 2);
            headerFrame.gotoxy(padding + 1, 2);
            headerFrame.attr = 11; // LIGHTCYAN
            headerFrame.putmsg(title);
        }
    }
    
    /**
     * Helper to repeat a character
     */
    function repeatChar(ch, count) {
        var s = "";
        for (var i = 0; i < count; i++) s += ch;
        return s;
    }
    
    /**
     * Draw tooltip box
     */
    function drawTooltip(view, text) {
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
        var borderColor = "\1h\1c";
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
    
    /**
     * Main entry point
     */
    function run(ctx) {
        if (RichView) {
            return runStatsHub(ctx);
        } else {
            return runLegacy(ctx);
        }
    }
    
    /**
     * Stats & Records Hub - RichView menu
     */
    function runStatsHub(ctx) {
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
            renderStatsBanner(view, "STATS");
            
            // Load art
            loadStatsArt(view);
            
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
            
            // onSelect callback to update tooltip
            var onSelectCallback = function(item, index, richView, lb) {
                drawTooltip(richView, item.tooltip || "");
            };
            
            // Draw initial tooltip
            drawTooltip(view, HUB_MENU_ITEMS[0].tooltip || "");
            
            var choice = view.menu(HUB_MENU_ITEMS, { y: 3, onSelect: onSelectCallback });
            view.close();
            
            // Handle choice
            switch (choice) {
                case "player_card":
                    if (LORB.UI && LORB.UI.StatsView) {
                        LORB.UI.StatsView.show(ctx);
                    }
                    break;
                    
                case "hall_of_fame":
                    showHallOfFame(ctx);
                    break;
                    
                case "standings":
                    runStandingsView(ctx);
                    break;
                    
                case "leaders":
                    runLeadersView(ctx);
                    break;
                    
                case "records":
                    runRecordsView(ctx);
                    break;
                    
                case "pvp":
                    runPvpLeadersView(ctx);
                    break;
                    
                case "ballerdex":
                    showBallerdexLeaders(ctx);
                    break;
                    
                case "crew_strength":
                    showCrewStrengthLeaders(ctx);
                    break;
                    
                case "quit":
                case "Q":
                case null:
                case undefined:
                    return;
            }
        }
    }
    
    // =====================================================
    // STANDINGS VIEW - Player rankings with challenge capability
    // =====================================================
    
    /**
     * Run the standings view loop
     */
    function runStandingsView(ctx) {
        var sortMode = "rep";  // rep, wins, name
        
        // Get current season
        var currentSeason = 1;
        if (LORB.SharedState && LORB.SharedState.getInfo) {
            var info = LORB.SharedState.getInfo();
            currentSeason = info.seasonNumber || 1;
        }
        var selectedSeason = currentSeason;
        
        var players = [];
        if (LORB.Persist && LORB.Persist.listPlayers) {
            players = LORB.Persist.listPlayers() || [];
        }
        var availableSeasons = buildSeasonList(players, currentSeason);
        
        var myGlobalId = LORB.Persist.getGlobalPlayerId ? 
            LORB.Persist.getGlobalPlayerId(ctx._user) : null;
        
        // Get online players (cached, non-blocking)
        var onlinePlayers = {};
        if (ctx._networkService && ctx._networkService.isActive()) {
            onlinePlayers = ctx._networkService.getOnlinePlayers() || {};
        } else if (LORB.Persist && LORB.Persist.getOnlinePlayers) {
            onlinePlayers = LORB.Persist.getOnlinePlayers() || {};
        }
        
        while (true) {
            var result = showStandingsView(ctx, players, onlinePlayers, myGlobalId, sortMode, selectedSeason);
            
            if (result && result.sortMode) {
                sortMode = result.sortMode;
            } else if (result === "season_next") {
                var idx = availableSeasons.indexOf(selectedSeason);
                if (idx === -1) idx = 0;
                idx = (idx + 1) % availableSeasons.length;
                selectedSeason = availableSeasons[idx];
            } else if (result === "season_prev") {
                var idx = availableSeasons.indexOf(selectedSeason);
                if (idx === -1) idx = 0;
                idx = (idx - 1 + availableSeasons.length) % availableSeasons.length;
                selectedSeason = availableSeasons[idx];
            } else if (result === "back" || result === null) {
                return;
            }
            // Otherwise loop to refresh view
        }
    }
    
    /**
     * Show the standings table
     */
    function showStandingsView(ctx, players, onlinePlayers, myGlobalId, sortMode, seasonFilter) {
        var seasonLabel = formatSeasonLabel(seasonFilter);
        
        // Get W-L for each player based on season filter
        function getPlayerWL(p) {
            if (seasonFilter && seasonFilter !== "all") {
                if (p.seasonStats && p.seasonStats[seasonFilter]) {
                    var ss = p.seasonStats[seasonFilter];
                    return { wins: ss.wins || 0, losses: ss.losses || 0 };
                }
                return { wins: 0, losses: 0 };
            } else {
                return { wins: p.wins || 0, losses: p.losses || 0 };
            }
        }
        
        // Sort based on current mode
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
        
        var hLine = repeatChar("\xC4", 79);
        
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
            headerFrame.putmsg("\1h\1y" + hLine + "\1n");
            headerFrame.gotoxy(1, 2);
            headerFrame.putmsg("\1h\1w  STANDINGS: \1h\1y" + seasonLabel + "                   \1n\1c[\x1B/\x1A] Season\1n");
            headerFrame.gotoxy(1, 3);
            headerFrame.putmsg("\1h\1y" + hLine + "\1n");
            headerFrame.gotoxy(1, 4);
            headerFrame.putmsg("  \1cPlayer                       \1n\xB3\1c W-L   \1n\xB3\1c Rep  \1n\xB3\1c Last On    \1n\xB3\1c BBS\1n");
        }
        
        // Footer
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.gotoxy(1, 1);
            footerFrame.putmsg("\1h\1y" + hLine + "\1n");
            footerFrame.gotoxy(1, 2);
            footerFrame.putmsg(" \1h\1w[ENTER]\1n\1c Challenge \1h\1w[S]\1n\1c Sort \1h\1w[\x1B/\x1A]\1n\1c Season \1h\1w[Q]\1n\1c Back");
        }
        
        view.render();
        
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
            
            var lastOn = isOnline ? "\1g\1hONLINE\1n" : formatLastPlayed(p.lastSave);
            var bbsName = truncate(p.bbsName || "Unknown", 10);
            
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
        
        menuItems.push({ text: "Back", value: "back", hotkey: "Q" });
        
        // onIdle to cycle network service
        var onIdleCallback = null;
        if (ctx._networkService) {
            onIdleCallback = function() {
                ctx._networkService.cycle();
            };
        }
        
        view.setContentZone("table");
        var choice = view.menu(menuItems, { y: 1, hotkeys: "S" + KEY_LEFT + KEY_RIGHT, onIdle: onIdleCallback });
        view.close();
        
        // Handle navigation keys
        if (choice === KEY_LEFT || choice === "\x1B[D" || choice === "\x02" || choice === "4") {
            return "season_prev";
        }
        if (choice === KEY_RIGHT || choice === "\x1B[C" || choice === "\x06" || choice === "6") {
            return "season_next";
        }
        
        if (choice === "S") {
            var newSort;
            if (sortMode === "rep") newSort = "wins";
            else if (sortMode === "wins") newSort = "name";
            else newSort = "rep";
            return { sortMode: newSort };
        }
        
        if (choice === "back" || choice === null) {
            return "back";
        }
        
        // Selected a player - show challenge options via Tournaments module
        var player = players[choice];
        var isSelf = (player && player.globalId === myGlobalId);
        if (player && !isSelf && LORB.Locations && LORB.Locations.Tournaments) {
            // Use tournaments module's challenge flow
            if (LORB.Locations.Tournaments.showPlayerChallenge) {
                LORB.Locations.Tournaments.showPlayerChallenge(ctx, player);
            } else {
                // Fallback: show basic challenge info
                showChallengeOptions(ctx, player);
            }
        } else if (player && isSelf) {
            // Selected self - could show own stats
            if (LORB.UI && LORB.UI.StatsView && LORB.UI.StatsView.showForPlayer) {
                LORB.UI.StatsView.showForPlayer(player, { isSelf: true });
            }
        }
        
        return null;  // Stay in view
    }
    
    /**
     * Basic challenge options (fallback if Tournaments.showPlayerChallenge not available)
     */
    function showChallengeOptions(ctx, player) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("CHALLENGE " + (player.name || player.globalId).toUpperCase());
        LORB.View.line("");
        LORB.View.line("Record: " + (player.wins || 0) + "W - " + (player.losses || 0) + "L");
        LORB.View.line("Rep: " + (player.rep || 0));
        LORB.View.line("");
        
        var isOnline = !!player.isOnline;
        if (isOnline) {
            LORB.View.line("\1g[L]\1n Live Challenge (player is online)");
        }
        LORB.View.line("\1w[G]\1n Ghost Match");
        LORB.View.line("\1w[Q]\1n Cancel");
        
        while (true) {
            var key = console.getkey();
            if (key === "q" || key === "Q" || key === "\x1B") return;
            if ((key === "l" || key === "L") && isOnline) {
                if (LORB.Locations.Tournaments && LORB.Locations.Tournaments.startLiveChallenge) {
                    LORB.Locations.Tournaments.startLiveChallenge(ctx, player);
                }
                return;
            }
            if (key === "g" || key === "G") {
                if (LORB.Locations.Tournaments && LORB.Locations.Tournaments.challengePlayer) {
                    LORB.Locations.Tournaments.challengePlayer(ctx, player);
                }
                return;
            }
        }
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
        
        var d = new Date(timestamp);
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return months[d.getMonth()] + " " + d.getDate();
    }
    
    // =====================================================
    // SHARED HELPERS
    // =====================================================
    
    /**
     * Calculate career averages for a player
     */
    function getPlayerAverages(player, seasonNumber) {
        var career;
        if (seasonNumber && seasonNumber !== "all") {
            if (player.seasonStats && player.seasonStats[seasonNumber]) {
                career = player.seasonStats[seasonNumber];
            } else {
                return null;
            }
        } else {
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
            if (avgs && avgs.gamesPlayed >= 3) {
                playersWithStats.push({
                    player: players[i],
                    value: avgs[statKey] || 0,
                    gamesPlayed: avgs.gamesPlayed
                });
            }
        }
        
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
        
        playersWithStats.sort(function(a, b) {
            return b.value - a.value;
        });
        
        return playersWithStats.slice(0, limit);
    }
    
    /**
     * Build list of available seasons from player data
     */
    function buildSeasonList(players, currentSeason) {
        var seasonSet = {};
        seasonSet["all"] = true;
        seasonSet[currentSeason] = true;
        
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
        nums.sort(function(a, b) { return b - a; });
        seasons.push("all");
        for (var j = 0; j < nums.length; j++) {
            seasons.push(nums[j]);
        }
        return seasons;
    }
    
    /**
     * Format season label for display
     */
    function formatSeasonLabel(season) {
        if (season === "all") return "ALL-TIME";
        return "SEASON " + season;
    }
    
    /**
     * Strip color codes for length measurement
     */
    function stripColors(str) {
        return String(str || "").replace(/\x01./g, "");
    }
    
    /**
     * Pad string to visual length
     */
    function padRight(str, len) {
        str = String(str || "");
        var visualLen = stripColors(str).length;
        while (visualLen < len) {
            str += " ";
            visualLen++;
        }
        return str;
    }
    
    /**
     * Truncate string (color-aware)
     */
    function truncate(str, len) {
        str = String(str || "");
        var visualLen = stripColors(str).length;
        if (visualLen <= len) return str;
        var plain = stripColors(str);
        return plain.substring(0, len - 3) + "...";
    }
    
    // =====================================================
    // LEAGUE LEADERS VIEW
    // =====================================================
    
    function runLeadersView(ctx) {
        var leaderStat = 0;
        
        // Get current season
        var currentSeason = 1;
        if (LORB.SharedState && LORB.SharedState.getInfo) {
            var info = LORB.SharedState.getInfo();
            currentSeason = info.seasonNumber || 1;
        }
        var selectedSeason = currentSeason;
        
        var players = [];
        if (LORB.Persist && LORB.Persist.listPlayers) {
            players = LORB.Persist.listPlayers() || [];
        }
        var availableSeasons = buildSeasonList(players, currentSeason);
        
        var myGlobalId = LORB.Persist.getGlobalPlayerId ? 
            LORB.Persist.getGlobalPlayerId(ctx._user) : null;
        
        while (true) {
            var result = showLeadersView(ctx, players, myGlobalId, leaderStat, selectedSeason);
            
            if (result === "next") {
                leaderStat = (leaderStat + 1) % LEADER_CATEGORIES.length;
            } else if (result === "prev") {
                leaderStat = (leaderStat - 1 + LEADER_CATEGORIES.length) % LEADER_CATEGORIES.length;
            } else if (result === "season_next") {
                var idx = availableSeasons.indexOf(selectedSeason);
                if (idx === -1) idx = 0;
                idx = (idx + 1) % availableSeasons.length;
                selectedSeason = availableSeasons[idx];
            } else if (result === "season_prev") {
                var idx = availableSeasons.indexOf(selectedSeason);
                if (idx === -1) idx = 0;
                idx = (idx - 1 + availableSeasons.length) % availableSeasons.length;
                selectedSeason = availableSeasons[idx];
            } else {
                return;
            }
        }
    }
    
    function showLeadersView(ctx, players, myGlobalId, statIndex, seasonFilter) {
        var category = LEADER_CATEGORIES[statIndex];
        var leaders = getLeagueLeaders(players, category.key, 15, seasonFilter);
        var seasonLabel = formatSeasonLabel(seasonFilter);
        
        var hLine = repeatChar("\xC4", 79);
        
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
            headerFrame.putmsg("\1h\1c" + hLine + "\1n");
            headerFrame.gotoxy(1, 2);
            headerFrame.putmsg("\1h\1w  LEAGUE LEADERS: \1h\1y" + category.name + " (" + category.abbrev + ")        \1n\1c[\x1B/\x1A] \1h\1m" + seasonLabel + "\1n");
            headerFrame.gotoxy(1, 3);
            headerFrame.putmsg("\1h\1c" + hLine + "\1n");
            headerFrame.gotoxy(1, 4);
            headerFrame.putmsg("  \1cRank  Player                          " + category.abbrev + "     Games   BBS\1n");
        }
        
        // Footer
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
        
        var key = console.getkey();
        view.close();
        
        if (key === "\x1B" || key === "q" || key === "Q") return "back";
        if (key === "\x1B[C" || key === "\x06" || key === "6" || key === KEY_RIGHT) return "season_next";
        if (key === "\x1B[D" || key === "\x02" || key === "4" || key === KEY_LEFT) return "season_prev";
        if (key === "+" || key === "=") return "next";
        if (key === "-" || key === "_") return "prev";
        
        return null;
    }
    
    // =====================================================
    // RECORDS VIEW
    // =====================================================
    
    function runRecordsView(ctx) {
        var recordStat = 0;
        
        var currentSeason = 1;
        if (LORB.SharedState && LORB.SharedState.getInfo) {
            var info = LORB.SharedState.getInfo();
            currentSeason = info.seasonNumber || 1;
        }
        var selectedSeason = currentSeason;
        
        var players = [];
        if (LORB.Persist && LORB.Persist.listPlayers) {
            players = LORB.Persist.listPlayers() || [];
        }
        var availableSeasons = buildSeasonList(players, currentSeason);
        
        var myGlobalId = LORB.Persist.getGlobalPlayerId ? 
            LORB.Persist.getGlobalPlayerId(ctx._user) : null;
        
        while (true) {
            var result = showRecordsView(ctx, players, myGlobalId, recordStat, selectedSeason);
            
            if (result === "next") {
                recordStat = (recordStat + 1) % RECORD_CATEGORIES.length;
            } else if (result === "prev") {
                recordStat = (recordStat - 1 + RECORD_CATEGORIES.length) % RECORD_CATEGORIES.length;
            } else if (result === "season_next") {
                var idx = availableSeasons.indexOf(selectedSeason);
                if (idx === -1) idx = 0;
                idx = (idx + 1) % availableSeasons.length;
                selectedSeason = availableSeasons[idx];
            } else if (result === "season_prev") {
                var idx = availableSeasons.indexOf(selectedSeason);
                if (idx === -1) idx = 0;
                idx = (idx - 1 + availableSeasons.length) % availableSeasons.length;
                selectedSeason = availableSeasons[idx];
            } else {
                return;
            }
        }
    }
    
    function showRecordsView(ctx, players, myGlobalId, statIndex, seasonFilter) {
        var category = RECORD_CATEGORIES[statIndex];
        var records = getSingleGameRecords(players, category.key, 15, seasonFilter);
        var seasonLabel = formatSeasonLabel(seasonFilter);
        
        var hLine = repeatChar("\xC4", 79);
        
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
            headerFrame.putmsg("\1h\1w  SINGLE GAME RECORDS: \1h\1m" + category.name + " (" + category.abbrev + ")    \1n\1c[\x1B/\x1A] \1h\1y" + seasonLabel + "\1n");
            headerFrame.gotoxy(1, 3);
            headerFrame.putmsg("\1h\1m" + hLine + "\1n");
            headerFrame.gotoxy(1, 4);
            headerFrame.putmsg("  \1cRank  Player                          " + category.abbrev + "    Court            BBS\1n");
        }
        
        // Footer
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
        
        var key = console.getkey();
        view.close();
        
        if (key === "\x1B" || key === "q" || key === "Q") return "back";
        if (key === "\x1B[C" || key === "\x06" || key === "6" || key === KEY_RIGHT) return "season_next";
        if (key === "\x1B[D" || key === "\x02" || key === "4" || key === KEY_LEFT) return "season_prev";
        if (key === "+" || key === "=") return "next";
        if (key === "-" || key === "_") return "prev";
        
        return null;
    }
    
    // =====================================================
    // PVP LEADERS VIEW
    // =====================================================
    
    function runPvpLeadersView(ctx) {
        var pvpStat = 0;
        
        var players = [];
        if (LORB.Persist && LORB.Persist.listPlayers) {
            players = LORB.Persist.listPlayers() || [];
        }
        
        var myGlobalId = LORB.Persist.getGlobalPlayerId ? 
            LORB.Persist.getGlobalPlayerId(ctx._user) : null;
        
        while (true) {
            var result = showPvpLeadersView(ctx, players, myGlobalId, pvpStat);
            
            if (result === "next") {
                pvpStat = (pvpStat + 1) % PVP_LEADER_CATEGORIES.length;
            } else if (result === "prev") {
                pvpStat = (pvpStat - 1 + PVP_LEADER_CATEGORIES.length) % PVP_LEADER_CATEGORIES.length;
            } else {
                return;
            }
        }
    }
    
    function showPvpLeadersView(ctx, players, myGlobalId, statIndex) {
        var category = PVP_LEADER_CATEGORIES[statIndex];
        var leaders = getPvpLeaders(players, category.key, 15);
        
        var hLine = repeatChar("\xC4", 79);
        
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
        
        // Footer
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
        
        var key = console.getkey();
        view.close();
        
        if (key === "\x1B" || key === "q" || key === "Q") return "back";
        if (key === "\x1B[C" || key === "\x06" || key === "6" || key === KEY_RIGHT) return "next";
        if (key === "\x1B[D" || key === "\x02" || key === "4" || key === KEY_LEFT) return "prev";
        
        return null;
    }
    
    // =====================================================
    // BALLERDEX LEADERS
    // =====================================================
    
    function getBallerdexLeaders(players, limit) {
        limit = limit || 15;
        
        var playersWithContacts = [];
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var contacts = (p.contacts && Array.isArray(p.contacts)) ? p.contacts : [];
            var contactCount = contacts.length;
            
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
        
        playersWithContacts.sort(function(a, b) {
            return b.contactCount - a.contactCount;
        });
        
        return playersWithContacts.slice(0, limit);
    }
    
    function getTotalAvailableContacts() {
        if (LORB.Data && LORB.Data.Roster && LORB.Data.Roster.getAllPlayers) {
            var allPlayers = LORB.Data.Roster.getAllPlayers();
            return allPlayers ? allPlayers.length : 0;
        }
        return 0;
    }
    
    function showBallerdexLeaders(ctx) {
        var players = [];
        if (LORB.Persist && LORB.Persist.listPlayers) {
            players = LORB.Persist.listPlayers() || [];
        }
        
        var myGlobalId = LORB.Persist.getGlobalPlayerId ? 
            LORB.Persist.getGlobalPlayerId(ctx._user) : null;
        
        var leaders = getBallerdexLeaders(players, 15);
        var totalAvailable = getTotalAvailableContacts();
        
        var hLine = repeatChar("\xC4", 79);
        
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
            footerFrame.putmsg(" \1h\1w[Q]\1n\1c Back to Stats\1n");
        }
        
        // Table
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
                    
                    var caughtStr = String(entry.contactCount);
                    if (totalAvailable > 0) {
                        caughtStr += "/" + totalAvailable;
                    }
                    while (caughtStr.length < 7) caughtStr = " " + caughtStr;
                    
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
        console.getkey();
        view.close();
    }
    
    // =====================================================
    // CREW STRENGTH LEADERS
    // =====================================================
    
    function calculateCrewStrength(contacts) {
        if (!contacts || !Array.isArray(contacts)) return 0;
        
        var totalStrength = 0;
        for (var i = 0; i < contacts.length; i++) {
            var c = contacts[i];
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
        
        playersWithStrength.sort(function(a, b) {
            return b.strength - a.strength;
        });
        
        return playersWithStrength.slice(0, limit);
    }
    
    function showCrewStrengthLeaders(ctx) {
        var players = [];
        if (LORB.Persist && LORB.Persist.listPlayers) {
            players = LORB.Persist.listPlayers() || [];
        }
        
        var myGlobalId = LORB.Persist.getGlobalPlayerId ? 
            LORB.Persist.getGlobalPlayerId(ctx._user) : null;
        
        var leaders = getCrewStrengthLeaders(players, 15);
        
        var hLine = repeatChar("\xC4", 79);
        
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
            footerFrame.putmsg(" \1h\1w[Q]\1n\1c Back to Stats\1n");
        }
        
        // Table
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
        console.getkey();
        view.close();
    }
    
    // =====================================================
    // HALL OF FAME - Season Champions Display
    // =====================================================
    
    // Arrow key codes for navigation
    var KEY_LEFT = "";
    var KEY_RIGHT = "";
    
    /**
     * Show the Hall of Fame - creates its own view for display
     */
    function showHallOfFame(ctx) {
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 43, y: 5, width: 38, height: 20 }
            ],
            theme: "lorb"
        });
        
        // Render banner
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            if (LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
                LORB.Util.FigletBanner.renderToFrame(headerFrame, "LEGENDS", 14); // YELLOW
            } else {
                headerFrame.gotoxy(1, 2);
                headerFrame.putmsg("\1h\1y=== HALL OF FAME ===\1n");
            }
        }
        
        // Load art
        loadStatsArt(view);
        
        showHallOfFameInView(view, ctx);
        view.close();
    }
    
    /**
     * Show the Hall of Fame - Interactive season-by-season champion display
     * Navigate with left/right arrows, Q to exit
     */
    function showHallOfFameInView(view, ctx) {
        // Load avatar library for cross-BBS avatars
        var avatar_lib = null;
        try {
            avatar_lib = load({}, 'avatar_lib.js');
        } catch (e) {
        }
        
        // Read hall of fame data from persistence
        var hallOfFame = [];
        var seasonChampions = [];
        var allPlayers = [];
        var playoffBrackets = {};
        
        try {
            var lorbState = LORB.Persist.readShared("lorb.sharedState");
            if (lorbState && lorbState.hallOfFame) {
                hallOfFame = lorbState.hallOfFame;
            }
            
            var sharedState = LORB.Persist.readShared("sharedState");
            if (sharedState && sharedState.seasonChampions) {
                seasonChampions = sharedState.seasonChampions;
            }
            
            // Get all players for stats lookup
            if (LORB.Persist && LORB.Persist.listPlayers) {
                allPlayers = LORB.Persist.listPlayers() || [];
            }
            
            // Get playoff brackets for additional season data
            playoffBrackets = LORB.Persist.readShared("playoffBrackets") || {};
        } catch (e) {
        }
        
        // Build enriched display entries
        var displayEntries = buildHallOfFameEntries(hallOfFame, seasonChampions, allPlayers, playoffBrackets);
        
        // No champions yet
        if (displayEntries.length === 0) {
            showEmptyHallOfFame(view);
            return;
        }
        
        // Interactive navigation
        var currentIndex = 0;
        
        while (true) {
            var entry = displayEntries[currentIndex];
            
            // Render the current champion
            renderHallOfFameChampion(view, entry, currentIndex, displayEntries.length, avatar_lib);
            
            // Get user input
            var key = console.getkey();
            
            if (key === "q" || key === "Q" || key === "\x1B") {
                // Exit
                break;
            } else if (key === KEY_LEFT || key === "[" || key === ",") {
                // Previous champion
                currentIndex--;
                if (currentIndex < 0) currentIndex = displayEntries.length - 1;
            } else if (key === KEY_RIGHT || key === "]" || key === ".") {
                // Next champion
                currentIndex++;
                if (currentIndex >= displayEntries.length) currentIndex = 0;
            }
        }
    }
    
    /**
     * Build enriched hall of fame entries with player stats
     */
    function buildHallOfFameEntries(hallOfFame, seasonChampions, allPlayers, playoffBrackets) {
        var displayEntries = [];
        var seenSeasons = {};
        
        // Create a lookup map for players by globalId or name
        var playerLookup = {};
        for (var pi = 0; pi < allPlayers.length; pi++) {
            var p = allPlayers[pi];
            if (p.globalId) playerLookup[p.globalId] = p;
            if (p.name) playerLookup[p.name.toLowerCase()] = p;
        }
        
        // Process hall of fame entries (playoff champions)
        for (var i = 0; i < hallOfFame.length; i++) {
            var hof = hallOfFame[i];
            if (!hof.championName || !hof.championId) continue;
            
            // Look up player data
            var playerData = playerLookup[hof.championId] || 
                             playerLookup[(hof.championName || "").toLowerCase()] || null;
            
            // Try to get season stats from playoff bracket
            var bracketData = playoffBrackets[hof.seasonNumber] || null;
            var seedData = null;
            if (bracketData && bracketData.seeds) {
                for (var si = 0; si < bracketData.seeds.length; si++) {
                    if (bracketData.seeds[si].playerId === hof.championId) {
                        seedData = bracketData.seeds[si];
                        break;
                    }
                }
            }
            
            displayEntries.push({
                seasonNumber: hof.seasonNumber || 0,
                name: hof.championName,
                championId: hof.championId,
                defeatedJordan: hof.defeatedJordan || false,
                timestamp: hof.timestamp,
                date: hof.date || null,
                playerData: playerData,
                seedData: seedData,
                bracketData: bracketData
            });
            seenSeasons[hof.seasonNumber] = true;
        }
        
        // Add season champions not already in hall of fame
        for (var j = 0; j < seasonChampions.length; j++) {
            var sc = seasonChampions[j];
            if (seenSeasons[sc.seasonNumber]) continue;
            if (!sc.championId || !sc.championName) continue;
            if (sc.championName.indexOf("Season") === 0 || sc.championName.indexOf("Reset") !== -1) continue;
            if (sc.championName.indexOf("End") !== -1) continue;
            
            var playerData2 = playerLookup[sc.championId] || 
                              playerLookup[(sc.championName || "").toLowerCase()] || null;
            
            var bracketData2 = playoffBrackets[sc.seasonNumber] || null;
            
            displayEntries.push({
                seasonNumber: sc.seasonNumber || 0,
                name: sc.championName,
                championId: sc.championId,
                defeatedJordan: false,
                timestamp: sc.timestamp,
                date: null,
                playerData: playerData2,
                seedData: null,
                bracketData: bracketData2
            });
            seenSeasons[sc.seasonNumber] = true;
        }
        
        // Sort by season descending (newest first)
        displayEntries.sort(function(a, b) {
            return (b.seasonNumber || 0) - (a.seasonNumber || 0);
        });
        
        return displayEntries;
    }
    
    /**
     * Show empty hall of fame message
     */
    function showEmptyHallOfFame(view) {
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        view.line("  \1h\1y=== HALL OF FAME ===\1n");
        view.blank();
        view.blank();
        view.line("  \1wNo champions yet...\1n");
        view.blank();
        view.line("  \1wWill YOU be the first to\1n");
        view.line("  \1wdefeat the Red Bull?\1n");
        view.blank();
        view.blank();
        view.line("  \1kThe legends of Rim City\1n");
        view.line("  \1kawait their first hero.\1n");
        view.blank();
        view.blank();
        view.info("[Q] Back");
        view.render();
        
        while (true) {
            var key = console.getkey();
            if (key === "q" || key === "Q" || key === "\x1B") break;
        }
    }
    
    /**
     * Render a single champion in the Hall of Fame view
     */
    function renderHallOfFameChampion(view, entry, index, total, avatar_lib) {
        var contentFrame = view.getZone("content");
        if (!contentFrame) return;
        
        view.clearZone("content");
        contentFrame.gotoxy(1, 1);
        
        var w = 38; // Content zone width
        var NBA_JAM_ROOT = "/sbbs/xtrn/nba_jam/";
        
        // === HEADER ===
        contentFrame.putmsg(" \1h\1y=== HALL OF FAME ===\1n\r\n");
        
        // Champion title line
        var titleColor = entry.defeatedJordan ? "\1h\1r" : "\1h\1y";
        contentFrame.putmsg(" " + titleColor + entry.name + "\1n\r\n");
        contentFrame.putmsg(" \1cSeason " + entry.seasonNumber + " Champion\1n\r\n");
        
        // Show Red Bull defeat status
        if (entry.defeatedJordan) {
            contentFrame.putmsg(" \1h\1r* \1gDefeated the Red Bull! \1r*\1n\r\n");
        } else {
            contentFrame.putmsg("\r\n");
        }
        
        // === BODY: Avatar and/or Sprite ===
        var avatarRendered = false;
        var spriteRendered = false;
        
        // Try to render Synchronet avatar first
        if (avatar_lib && entry.playerData) {
            try {
                avatarRendered = renderChampionAvatar(contentFrame, entry, avatar_lib, 2, 5);
            } catch (e) {
            }
        }
        
        // Render player sprite (to the right of avatar, or centered if no avatar)
        if (entry.playerData && entry.playerData.appearance) {
            var spriteX = avatarRendered ? 16 : 6;
            var spriteY = 5;
            try {
                spriteRendered = renderChampionSprite(contentFrame, entry.playerData, spriteX, spriteY);
            } catch (e) {
            }
        }
        
        // Fallback if neither rendered
        if (!avatarRendered && !spriteRendered) {
            contentFrame.gotoxy(3, 6);
            contentFrame.putmsg("\1h\1y*\1n \1wChampion\1n \1h\1y*\1n");
            contentFrame.gotoxy(3, 7);
            contentFrame.putmsg("   \1c" + entry.name + "\1n");
        }
        
        // === STATS SECTION (bottom of frame) ===
        var statsY = 11;
        contentFrame.gotoxy(1, statsY);
        contentFrame.putmsg(" \1h\1c--- Season Stats ---\1n\r\n");
        statsY++;
        
        if (entry.playerData) {
            var pd = entry.playerData;
            
            // W-L Record
            var wins = pd.wins || 0;
            var losses = pd.losses || 0;
            contentFrame.gotoxy(2, statsY);
            contentFrame.putmsg("\1wRecord:\1n \1g" + wins + "W\1n-\1r" + losses + "L\1n");
            statsY++;
            
            // Rep earned
            var rep = pd.rep || 0;
            contentFrame.gotoxy(2, statsY);
            contentFrame.putmsg("\1wRep:\1n \1c" + rep + "\1n");
            
            // Seed if available
            if (entry.seedData && entry.seedData.seed) {
                contentFrame.putmsg("  \1wSeed:\1n #\1y" + entry.seedData.seed + "\1n");
            }
            statsY++;
            
            // Career averages if available
            if (pd.careerStats && pd.careerStats.gamesPlayed > 0) {
                var games = pd.careerStats.gamesPlayed;
                var totals = pd.careerStats.totals || {};
                var ppg = ((totals.points || 0) / games).toFixed(1);
                var rpg = ((totals.rebounds || 0) / games).toFixed(1);
                var apg = ((totals.assists || 0) / games).toFixed(1);
                
                statsY++;
                contentFrame.gotoxy(2, statsY);
                contentFrame.putmsg("\1wPPG:\1n \1h\1w" + ppg + "\1n");
                contentFrame.gotoxy(14, statsY);
                contentFrame.putmsg("\1wRPG:\1n \1h\1w" + rpg + "\1n");
                contentFrame.gotoxy(26, statsY);
                contentFrame.putmsg("\1wAPG:\1n \1h\1w" + apg + "\1n");
                statsY++;
                
                var spg = ((totals.steals || 0) / games).toFixed(1);
                var bpg = ((totals.blocks || 0) / games).toFixed(1);
                var dpg = ((totals.dunks || 0) / games).toFixed(1);
                
                contentFrame.gotoxy(2, statsY);
                contentFrame.putmsg("\1wSPG:\1n \1h\1w" + spg + "\1n");
                contentFrame.gotoxy(14, statsY);
                contentFrame.putmsg("\1wBPG:\1n \1h\1w" + bpg + "\1n");
                contentFrame.gotoxy(26, statsY);
                contentFrame.putmsg("\1wDNK:\1n \1h\1w" + dpg + "\1n");
            } else {
                statsY++;
                contentFrame.gotoxy(2, statsY);
                contentFrame.putmsg("\1k(Stats from this era lost)\1n");
            }
        } else {
            contentFrame.gotoxy(2, statsY);
            contentFrame.putmsg("\1k(Champion data unavailable)\1n");
        }
        
        // === FOOTER ===
        var footerY = 17;
        
        // Defeated Jordan banner
        if (entry.defeatedJordan) {
            contentFrame.gotoxy(1, footerY);
            contentFrame.putmsg("\r\n");
            contentFrame.putmsg(" \1h\1r*** DEFEATED THE RED BULL! ***\1n\r\n");
        } else {
            contentFrame.gotoxy(1, footerY);
            contentFrame.putmsg("\r\n");
            contentFrame.putmsg(" \1kFaced the Red Bull...\1n\r\n");
        }
        
        // Navigation hint
        contentFrame.putmsg("\r\n");
        var navHint = " \1w[\1h\1c<\1n\1w/\1h\1c>\1n\1w] Prev/Next";
        if (total > 1) {
            navHint += "  \1k(" + (index + 1) + "/" + total + ")";
        }
        navHint += "  \1w[\1h\1cQ\1n\1w] Back\1n";
        contentFrame.putmsg(navHint);
        
        view.render();
    }
    
    /**
     * Render Synchronet avatar for a champion (cross-BBS support via QWK ID)
     * Returns true if avatar was rendered
     */
    function renderChampionAvatar(frame, entry, avatar_lib, x, y) {
        if (!avatar_lib || !avatar_lib.read) return false;
        
        var playerData = entry.playerData;
        if (!playerData) return false;
        
        // Use the Synchronet user handle (not the LORB character name) for avatar lookup
        var userHandle = playerData.userHandle || null;
        if (!userHandle) {
            return false;
        }
        
        // Get QWK ID directly from player data, or try to derive from bbsName
        var qwkId = playerData.bbsId || null;
        if (!qwkId && playerData.bbsName) {
            qwkId = getQwkIdFromBbsName(playerData.bbsName);
        }
        
        var avatar = null;
        
        try {
            // Try local first (usernum 0 means check by name)
            avatar = avatar_lib.read(0, userHandle, null, null);
            
            // If no local avatar and we have a QWK ID, try network lookup
            if ((!avatar || !avatar.data) && qwkId) {
                avatar = avatar_lib.read(0, userHandle, qwkId, null);
            }
            
            // Also try with the LORB character name as fallback
            if ((!avatar || !avatar.data) && entry.name && entry.name !== userHandle) {
                avatar = avatar_lib.read(0, entry.name, qwkId, null);
            }
        } catch (e) {
            return false;
        }
        
        if (!avatar || !avatar.data || avatar.disabled) {
            return false;
        }
        
        // Decode and render
        try {
            var binData = base64_decode(avatar.data);
            if (!binData || binData.length < 120) return false; // 10x6x2 = 120 bytes
            
            var avatarW = avatar_lib.defs ? avatar_lib.defs.width : 10;
            var avatarH = avatar_lib.defs ? avatar_lib.defs.height : 6;
            
            // Blit avatar to frame
            var offset = 0;
            for (var row = 0; row < avatarH; row++) {
                for (var col = 0; col < avatarW; col++) {
                    if (offset + 1 >= binData.length) break;
                    var ch = binData.substr(offset, 1);
                    var attr = binData.charCodeAt(offset + 1);
                    frame.setData(x + col - 1, y + row - 1, ch, attr, false);
                    offset += 2;
                }
            }
            return true;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Map BBS name to QWK ID for network avatar lookup
     */
    function getQwkIdFromBbsName(bbsName) {
        if (!bbsName) return null;
        var name = bbsName.toUpperCase();
        
        var knownBbses = {
            "VERT": "VERT",
            "VERTRAUEN": "VERT",
            "DOVE": "DOVE",
            "DOVENET": "DOVE",
            "FUTURE": "FUTURELD",
            "FUTURELAND": "FUTURELD",
            "FUTURELD": "FUTURELD",
            "AGENCY": "AGENCY",
            "THEAGENCY": "AGENCY",
            "SYNCHRONET": "SYNC",
            "SBBS": "SBBS"
        };
        
        for (var key in knownBbses) {
            if (name.indexOf(key) !== -1) {
                return knownBbses[key];
            }
        }
        
        var domainMatch = bbsName.match(/^([a-zA-Z0-9]+)\./);
        if (domainMatch && domainMatch[1].length <= 8) {
            return domainMatch[1].toUpperCase();
        }
        
        var words = bbsName.split(/\s+/);
        if (words[0] && words[0].length <= 8) {
            return words[0].toUpperCase();
        }
        
        return null;
    }
    
    /**
     * Render player sprite for a champion
     */
    function renderChampionSprite(frame, playerData, x, y) {
        if (!playerData || !playerData.appearance) return false;
        if (typeof BinLoader === "undefined") return false;
        
        var NBA_JAM_ROOT = "/sbbs/xtrn/nba_jam/";
        var SPRITE_WIDTH = 5;
        var SPRITE_HEIGHT = 4;
        
        try {
            var skin = (playerData.appearance.skin || "brown").toLowerCase();
            var binPath = NBA_JAM_ROOT + "sprites/player-" + skin + ".bin";
            
            var binData = BinLoader.loadBinFile(binPath);
            if (!binData) return false;
            
            var offset = 0;
            for (var row = 0; row < SPRITE_HEIGHT; row++) {
                for (var col = 0; col < SPRITE_WIDTH; col++) {
                    if (offset + 1 >= binData.length) break;
                    var ch = binData.substr(offset, 1);
                    var attr = ascii(binData.substr(offset + 1, 1));
                    frame.setData(x + col - 1, y + row - 1, ch, attr, false);
                    offset += 2;
                }
            }
            
            var nickname = playerData.nickname || playerData.name || "";
            if (nickname) {
                var nameLen = Math.min(nickname.length, 8);
                var nameX = x + Math.floor((SPRITE_WIDTH - nameLen) / 2);
                var nametagFg = "\1h\1w";
                if (playerData.appearance.nametagFg) {
                    nametagFg = getNametagColorHoF(playerData.appearance.nametagFg);
                }
                frame.gotoxy(nameX, y + SPRITE_HEIGHT);
                frame.putmsg(nametagFg + nickname.substring(0, 8) + "\1n");
            }
            
            return true;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Get ANSI color code from color name for nametags
     */
    function getNametagColorHoF(colorName) {
        if (!colorName) return "\1h\1w";
        var map = {
            "WHITE": "\1h\1w", "BLACK": "\1k", "RED": "\1r", "LIGHTRED": "\1h\1r",
            "GREEN": "\1g", "LIGHTGREEN": "\1h\1g", "BLUE": "\1b", "LIGHTBLUE": "\1h\1b",
            "CYAN": "\1c", "LIGHTCYAN": "\1h\1c", "MAGENTA": "\1m", "LIGHTMAGENTA": "\1h\1m",
            "BROWN": "\1y", "YELLOW": "\1h\1y", "LIGHTGRAY": "\1w", "DARKGRAY": "\1h\1k"
        };
        return map[colorName.toUpperCase()] || "\1h\1w";
    }
    
    // =====================================================
    // LEGACY FALLBACK
    // =====================================================
    
    function runLegacy(ctx) {
        LORB.View.clear();
        LORB.View.header("STATS & RECORDS");
        LORB.View.line("");
        LORB.View.line("Stats viewing requires RichView.");
        LORB.View.line("Press any key...");
        console.getkey();
    }
    
    // Export to LORB namespace
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.StatsRecords = {
        run: run
    };
    
})();
