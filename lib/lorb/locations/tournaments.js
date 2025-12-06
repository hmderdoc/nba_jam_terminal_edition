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
        var stats = ctx.stats || {};
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
    
    /**
     * Main entry point
     */
    function run(ctx) {
        if (RichView) {
            return runRichView(ctx);
        } else {
            return runLegacy(ctx);
        }
    }
    
    /**
     * Calculate career averages for a player
     */
    function getPlayerAverages(player) {
        var career = player.careerStats;
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
    function getLeagueLeaders(players, statKey, limit) {
        limit = limit || 10;
        
        var playersWithStats = [];
        for (var i = 0; i < players.length; i++) {
            var avgs = getPlayerAverages(players[i]);
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
    function getSingleGameRecords(players, statKey, limit) {
        limit = limit || 10;
        
        var records = [];
        for (var i = 0; i < players.length; i++) {
            var playerRecords = players[i].records;
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
    
    /**
     * RichView leaderboard
     */
    function runRichView(ctx) {
        var viewMode = VIEW_RANKINGS;  // Current view: rankings, leaders, records, pvp_leaders
        var sortMode = "rep";          // For rankings: rep, wins, name
        var leaderStat = 0;            // Index into LEADER_CATEGORIES
        var recordStat = 0;            // Index into RECORD_CATEGORIES
        var pvpLeaderStat = 0;         // Index into PVP_LEADER_CATEGORIES
        
        while (true) {
            // Fetch player list
            var players = [];
            if (LORB.Persist && LORB.Persist.listPlayers) {
                players = LORB.Persist.listPlayers() || [];
            }
            
            // Get online players
            var onlinePlayers = {};
            if (LORB.Persist && LORB.Persist.getOnlinePlayers) {
                onlinePlayers = LORB.Persist.getOnlinePlayers() || {};
            }
            
            // Get my ID to mark self in list (but don't filter out)
            var myGlobalId = LORB.Persist.getGlobalPlayerId ? 
                LORB.Persist.getGlobalPlayerId(ctx._user) : null;
            
            // Dispatch to appropriate view
            var result;
            if (viewMode === VIEW_RANKINGS) {
                result = showRankingsView(ctx, players, onlinePlayers, myGlobalId, sortMode);
                if (result === "leaders") {
                    viewMode = VIEW_LEADERS;
                    continue;
                } else if (result === "records") {
                    viewMode = VIEW_RECORDS;
                    continue;
                } else if (result === "pvp_leaders") {
                    viewMode = VIEW_PVP_LEADERS;
                    continue;
                } else if (result && result.sortMode) {
                    sortMode = result.sortMode;
                    continue;
                }
            } else if (viewMode === VIEW_LEADERS) {
                result = showLeadersView(ctx, players, myGlobalId, leaderStat);
                if (result === "rankings") {
                    viewMode = VIEW_RANKINGS;
                    continue;
                } else if (result === "records") {
                    viewMode = VIEW_RECORDS;
                    continue;
                } else if (result === "pvp_leaders") {
                    viewMode = VIEW_PVP_LEADERS;
                    continue;
                } else if (result === "next") {
                    leaderStat = (leaderStat + 1) % LEADER_CATEGORIES.length;
                    continue;
                } else if (result === "prev") {
                    leaderStat = (leaderStat - 1 + LEADER_CATEGORIES.length) % LEADER_CATEGORIES.length;
                    continue;
                }
            } else if (viewMode === VIEW_RECORDS) {
                result = showRecordsView(ctx, players, myGlobalId, recordStat);
                if (result === "rankings") {
                    viewMode = VIEW_RANKINGS;
                    continue;
                } else if (result === "leaders") {
                    viewMode = VIEW_LEADERS;
                    continue;
                } else if (result === "pvp_leaders") {
                    viewMode = VIEW_PVP_LEADERS;
                    continue;
                } else if (result === "next") {
                    recordStat = (recordStat + 1) % RECORD_CATEGORIES.length;
                    continue;
                } else if (result === "prev") {
                    recordStat = (recordStat - 1 + RECORD_CATEGORIES.length) % RECORD_CATEGORIES.length;
                    continue;
                }
            } else if (viewMode === VIEW_PVP_LEADERS) {
                result = showPvpLeadersView(ctx, players, myGlobalId, pvpLeaderStat);
                if (result === "rankings") {
                    viewMode = VIEW_RANKINGS;
                    continue;
                } else if (result === "leaders") {
                    viewMode = VIEW_LEADERS;
                    continue;
                } else if (result === "records") {
                    viewMode = VIEW_RECORDS;
                    continue;
                } else if (result === "next") {
                    pvpLeaderStat = (pvpLeaderStat + 1) % PVP_LEADER_CATEGORIES.length;
                    continue;
                } else if (result === "prev") {
                    pvpLeaderStat = (pvpLeaderStat - 1 + PVP_LEADER_CATEGORIES.length) % PVP_LEADER_CATEGORIES.length;
                    continue;
                }
            }
            
            // Exit or other action
            if (result === "back" || result === null) {
                return;
            }
        }
    }
    
    /**
     * Show Rankings View (original leaderboard)
     */
    function showRankingsView(ctx, players, onlinePlayers, myGlobalId, sortMode) {
        // Sort based on current mode
        if (sortMode === "rep") {
            players.sort(function(a, b) { return (b.rep || 0) - (a.rep || 0); });
        } else if (sortMode === "wins") {
            players.sort(function(a, b) { return (b.wins || 0) - (a.wins || 0); });
        } else if (sortMode === "name") {
            players.sort(function(a, b) {
                var nameA = (a.name || a.globalId || "").toLowerCase();
                var nameB = (b.name || b.globalId || "").toLowerCase();
                return nameA < nameB ? -1 : (nameA > nameB ? 1 : 0);
            });
        }
        
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
            headerFrame.putmsg("\1h\1w  RANKINGS                              \1n\1k[1]Rankings [2]Leaders [3]Records\1n");
            headerFrame.gotoxy(1, 3);
            headerFrame.putmsg("\1h\1r" + hLine + "\1n");
            headerFrame.gotoxy(1, 4);
            headerFrame.putmsg("  \1cPlayer                       \1n\xB3\1c W-L   \1n\xB3\1c Rep  \1n\xB3\1c Last On    \1n\xB3\1c BBS\1n");
        }
        
        // Footer
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.gotoxy(1, 1);
            footerFrame.putmsg("\1h\1r" + hLine + "\1n");
            footerFrame.gotoxy(1, 2);
            footerFrame.putmsg("  \1h\1w[ENTER]\1n\1c View   \1h\1w[S]\1n\1c Sort   \1h\1w[2]\1n\1c Leaders   \1h\1w[3]\1n\1c Records   \1h\1w[P]\1n\1r PvP   \1h\1w[Q]\1n\1c Back");
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
            var wl = (p.wins || 0) + "-" + (p.losses || 0);
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
        
        view.setContentZone("table");
        var choice = view.menu(menuItems, { y: 1, hotkeys: "S23P" });
        view.close();
        
        // Handle hotkey returns
        if (choice === "S") {
            // Cycle sort mode
            var newSort;
            if (sortMode === "rep") newSort = "wins";
            else if (sortMode === "wins") newSort = "name";
            else newSort = "rep";
            return { sortMode: newSort };
        }
        
        if (choice === "2") {
            return "leaders";
        }
        
        if (choice === "3") {
            return "records";
        }
        
        if (choice === "4") {
            return "pvp_leaders";
        }
        
        if (choice === "P" || choice === "p") {
            return "pvp_leaders";
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
    function showLeadersView(ctx, players, myGlobalId, statIndex) {
        var category = LEADER_CATEGORIES[statIndex];
        var leaders = getLeagueLeaders(players, category.key, 15);
        
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
            headerFrame.putmsg("\1h\1c" + hLine + "\1n");
            headerFrame.gotoxy(1, 2);
            headerFrame.putmsg("\1h\1w  LEAGUE LEADERS: \1h\1y" + category.name + " Per Game (" + category.abbrev + ")\1n");
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
            footerFrame.putmsg("  \1h\1w[\x1B/\x1A]\1n\1c Stat   \1h\1w[1]\1n\1c Rankings   \1h\1w[3]\1n\1c Records   \1h\1w[P]\1n\1r PvP   \1h\1w[Q]\1n\1c Back");
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
        
        if (key === "1") return "rankings";
        if (key === "3") return "records";
        if (key === "p" || key === "P") return "pvp_leaders";
        if (key === "\x1B" || key === "q" || key === "Q") return "back";
        if (key === "\x1B[C" || key === "\x06" || key === "6" || key === KEY_RIGHT) return "next";  // Right arrow
        if (key === "\x1B[D" || key === "\x02" || key === "4" || key === KEY_LEFT) return "prev";   // Left arrow
        
        return null;  // Stay in leaders view
    }
    
    /**
     * Show Single Game Records View
     */
    function showRecordsView(ctx, players, myGlobalId, statIndex) {
        var category = RECORD_CATEGORIES[statIndex];
        var records = getSingleGameRecords(players, category.key, 15);
        
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
            headerFrame.putmsg("\1h\1w  SINGLE GAME RECORDS: \1h\1m" + category.name + " (" + category.abbrev + ")\1n");
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
            footerFrame.putmsg("  \1h\1w[\x1B/\x1A]\1n\1c Stat   \1h\1w[1]\1n\1c Rankings   \1h\1w[2]\1n\1c Leaders   \1h\1w[P]\1n\1r PvP   \1h\1w[Q]\1n\1c Back");
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
        
        if (key === "1") return "rankings";
        if (key === "2") return "leaders";
        if (key === "p" || key === "P") return "pvp_leaders";
        if (key === "\x1B" || key === "q" || key === "Q") return "back";
        if (key === "\x1B[C" || key === "\x06" || key === "6" || key === KEY_RIGHT) return "next";  // Right arrow
        if (key === "\x1B[D" || key === "\x02" || key === "4" || key === KEY_LEFT) return "prev";   // Left arrow
        
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
        
        // Footer
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.gotoxy(1, 1);
            footerFrame.putmsg("\1h\1r" + hLine + "\1n");
            footerFrame.gotoxy(1, 2);
            footerFrame.putmsg("  \1h\1w[\x1B/\x1A]\1n\1c Stat   \1h\1w[1]\1n\1c Rankings   \1h\1w[2]\1n\1c Leaders   \1h\1w[3]\1n\1c Records   \1h\1w[Q]\1n\1c Back");
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
        
        if (key === "1") return "rankings";
        if (key === "2") return "leaders";
        if (key === "3") return "records";
        if (key === "\x1B" || key === "q" || key === "Q") return "back";
        if (key === "\x1B[C" || key === "\x06" || key === "6" || key === KEY_RIGHT) return "next";  // Right arrow
        if (key === "\x1B[D" || key === "\x02" || key === "4" || key === KEY_LEFT) return "prev";   // Left arrow
        
        return null;  // Stay in PvP leaders view
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
        }
        
        var challenge = LORB.Multiplayer.Challenges.sendChallenge(ctx, targetPlayer, { mode: "live" });
        if (!challenge) {
            LORB.View.warn("Failed to send challenge.");
            console.getkey();
            return;
        }
        
        if (LORB.Multiplayer.ChallengeLobbyUI && LORB.Multiplayer.ChallengeLobbyUI.showLobbyWaiting) {
            LORB.Multiplayer.ChallengeLobbyUI.showLobbyWaiting(challenge, "Waiting for " + (player.name || "opponent") + " to accept...");
        } else {
            LORB.View.clear();
            LORB.View.header("LIVE CHALLENGE");
            LORB.View.line("Waiting for " + (player.name || "opponent") + " to accept...");
        }
        
        var result = null;
        if (LORB.Multiplayer.ChallengeLobby && LORB.Multiplayer.ChallengeLobby.waitForReady) {
            result = LORB.Multiplayer.ChallengeLobby.waitForReady(challenge.id, ctx, { tickMs: 1200 });
        } else {
            mswait(5000);
            result = { status: "timeout" };
        }
        
        if (LORB.Multiplayer.ChallengeLobbyUI && LORB.Multiplayer.ChallengeLobbyUI.showOutcome) {
            LORB.Multiplayer.ChallengeLobbyUI.showOutcome(result.status);
        } else {
            LORB.View.line("");
            if (result.status === "ready") {
                LORB.View.line("\1gOpponent accepted. Launching match...\1n");
            } else if (result.status === "declined") {
                LORB.View.warn("Challenge declined.");
            } else if (result.status === "timeout") {
                LORB.View.warn("Challenge timed out.");
            } else {
                LORB.View.warn("Challenge unavailable.");
            }
            LORB.View.line("");
            if (result.status !== "ready") {
                LORB.View.line("Press any key...");
                console.getkey();
            }
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
                    wager: wager
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
            
            LORB.View.line("\1g\1h*** YOU WIN! ***\1n");
            LORB.View.line("");
            LORB.View.line("You defeated " + opponent.name + "'s ghost!");
            LORB.View.line("Winnings: \1g+$" + winnings + "\1n");
            LORB.View.line("Rep: \1c+10\1n");
        } else {
            ctx.losses = (ctx.losses || 0) + 1;
            
            LORB.View.line("\1r\1h*** DEFEAT ***\1n");
            LORB.View.line("");
            LORB.View.line(opponent.name + "'s ghost was too strong!");
            LORB.View.line("Lost: \1r-$" + wager + "\1n");
        }
        
        ctx.gamesPlayed = (ctx.gamesPlayed || 0) + 1;
        
        // Record career stats if we have game stats
        if (playerGameStats && LORB.Util && LORB.Util.CareerStats && LORB.Util.CareerStats.recordGame) {
            try {
                LORB.Util.CareerStats.recordGame(ctx, playerGameStats, won);
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
