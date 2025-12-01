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
    
    // Wager calculation constants
    var MAX_WAGER_PERCENT = 10;  // Max 10% of offline player's balance
    
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
     * RichView leaderboard
     */
    function runRichView(ctx) {
        var sortMode = "rep";  // rep, wins, name
        
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
                headerFrame.putmsg("\1h\1rอออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออ\1n");
                headerFrame.gotoxy(1, 2);
                headerFrame.putmsg("\1h\1w  TOURNAMENTS                                                  [" + players.length + " ballers]\1n");
                headerFrame.gotoxy(1, 3);
                headerFrame.putmsg("\1h\1rอออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออ\1n");
                headerFrame.gotoxy(1, 4);
                headerFrame.putmsg("  \1cPlayer                       \1nณ\1c W-L   \1nณ\1c Rep  \1nณ\1c Last On    \1nณ\1c BBS\1n");
            }
            
            // Footer
            var footerFrame = view.getZone("footer");
            if (footerFrame) {
                footerFrame.gotoxy(1, 1);
                footerFrame.putmsg("\1h\1rอออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออออ\1n");
                footerFrame.gotoxy(1, 2);
                footerFrame.putmsg("  \1h\1w[ENTER]\1n\1c View Stats & Challenge    \1h\1w[S]\1n\1c Sort    \1h\1w[ESC]\1n\1c Back");
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
                return;
            }
            
            // Build table rows as menu items
            var menuItems = [];
            for (var i = 0; i < players.length; i++) {
                var p = players[i];
                var isSelf = (p.globalId === myGlobalId);
                var isOnline = !!onlinePlayers[p.globalId];
                var wl = (p.wins || 0) + "-" + (p.losses || 0);
                
                // Show "ONLINE" if player is online, otherwise show last played
                var lastOn = isOnline ? "\1g\1hONLINE\1n" : formatLastPlayed(p.lastSave);
                var bbsName = truncate(p.bbsName || "Unknown", 10);
                
                // Format row: Name | W-L | Rep | Last On | BBS
                // Mark self with (YOU)
                var displayName = p.name || p.globalId;
                if (isSelf) displayName += " \1c(YOU)\1n";
                
                var row = " \1w" + padRight(truncate(displayName, 26), 26) + "\1n ณ\1c " +
                          padRight(wl, 5) + "\1n ณ\1c " +
                          padRight(String(p.rep || 0), 4) + "\1n ณ\1c " +
                          padRight(lastOn, 10) + "\1n ณ \1w" +
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
            var choice = view.menu(menuItems, { y: 1, hotkeys: "VS" });
            view.close();
            
            // Handle hotkey returns
            if (choice === "V") {
                // View stats of currently highlighted player - need selected index
                // For now just show message
                continue;
            }
            
            if (choice === "S") {
                // Cycle sort mode
                if (sortMode === "rep") sortMode = "wins";
                else if (sortMode === "wins") sortMode = "name";
                else sortMode = "rep";
                continue;
            }
            
            if (choice === "back" || choice === null) {
                return;
            }
            
            // Selected a player - show options (but can't challenge self)
            var player = players[choice];
            var isSelf = (player && player.globalId === myGlobalId);
            if (player) {
                var action = showPlayerOptions(ctx, player, isSelf);
                if (action === "challenge" && !isSelf) {
                    challengePlayer(ctx, player);
                }
            }
        }
    }
    
    /**
     * Show options for selected player
     */
    function showPlayerOptions(ctx, player, isSelf) {
        LORB.View.clear();
        LORB.View.header(player.name || player.globalId);
        LORB.View.line("");
        
        LORB.View.line("\1wRecord:\1n " + (player.wins || 0) + "W - " + (player.losses || 0) + "L");
        LORB.View.line("\1wRep:\1n " + (player.rep || 0));
        LORB.View.line("\1wLast Played:\1n " + formatLastPlayed(player.lastSave));
        LORB.View.line("\1wFrom:\1n " + (player.bbsName || "Unknown BBS"));
        LORB.View.line("");
        
        // Calculate max wager
        var theirCash = player.cash || 0;
        var myCash = ctx.cash || 0;
        var maxWager = Math.max(
            Math.floor(theirCash * MAX_WAGER_PERCENT / 100),
            myCash
        );
        maxWager = Math.min(maxWager, myCash);  // Can't bet more than you have
        
        LORB.View.line("\1h\1yณณณ OPTIONS ณณณ\1n");
        
        if (isSelf) {
            LORB.View.line("\1kThis is you!\1n");
            LORB.View.line("");
            LORB.View.line("[1] View Full Stats");
            LORB.View.line("[Q] Back");
        } else {
            LORB.View.line("[1] Challenge to Ghost Match (wager up to $" + maxWager + ")");
            LORB.View.line("[2] View Full Stats");
            LORB.View.line("[Q] Back");
        }
        LORB.View.line("");
        
        var choice = LORB.View.prompt("Choice: ").toUpperCase();
        
        if (isSelf) {
            if (choice === "1") {
                showPlayerStats(player);
                return null;
            }
        } else {
            if (choice === "1") {
                return "challenge";
            } else if (choice === "2") {
                showPlayerStats(player);
                return null;
            }
        }
        return null;
    }
    
    /**
     * Show detailed stats for another player
     */
    function showPlayerStats(player) {
        LORB.View.clear();
        LORB.View.header("PLAYER CARD: " + (player.name || player.globalId));
        LORB.View.line("");
        
        LORB.View.line("\1h\1yณณณ RECORD ณณณ\1n");
        LORB.View.line("  Games Played: " + (player.gamesPlayed || (player.wins || 0) + (player.losses || 0)));
        LORB.View.line("  Wins:         \1g" + (player.wins || 0) + "\1n");
        LORB.View.line("  Losses:       \1r" + (player.losses || 0) + "\1n");
        
        var totalGames = (player.wins || 0) + (player.losses || 0);
        var winPct = totalGames > 0 ? Math.round((player.wins || 0) / totalGames * 100) : 0;
        LORB.View.line("  Win Rate:     " + winPct + "%");
        LORB.View.line("");
        
        LORB.View.line("\1h\1yณณณ STATUS ณณณ\1n");
        LORB.View.line("  Level: " + (player.level || 1));
        LORB.View.line("  Rep:   \1c" + (player.rep || 0) + "\1n");
        LORB.View.line("  From:  " + (player.bbsName || "Unknown"));
        LORB.View.line("");
        
        LORB.View.line("\1wPress any key to continue...\1n");
        console.getkey();
    }
    
    /**
     * Challenge flow
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
     * Run ghost match - plays against opponent's ghost
     */
    function runGhostMatch(ctx, opponent, wager) {
        LORB.View.clear();
        LORB.View.header("GHOST MATCH");
        LORB.View.line("");
        LORB.View.line("vs " + (opponent.name || opponent.globalId));
        LORB.View.line("Wager: $" + wager);
        LORB.View.line("");
        LORB.View.line("Loading ghost data...");
        
        // Deduct wager
        ctx.cash -= wager;
        
        // For now, use mock battle system
        // Ghost match uses opponent's stats to create a CPU team
        var ghostTeam = createGhostTeam(opponent);
        
        // Run battle
        var battleResult = null;
        if (LORB.Core && LORB.Core.BattleAdapter) {
            battleResult = LORB.Core.BattleAdapter.runBattle(ctx, ghostTeam);
        } else {
            // Mock result
            battleResult = {
                won: Math.random() > 0.5,
                finalScore: { player: 21, opponent: Math.floor(Math.random() * 21) }
            };
        }
        
        LORB.View.clear();
        LORB.View.header("MATCH RESULT");
        LORB.View.line("");
        
        if (battleResult.won) {
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
        
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
        
        // Save after ghost match
        if (LORB.Persist && LORB.Persist.save) {
            LORB.Persist.save(ctx);
        }
    }
    
    /**
     * Create ghost team from opponent data
     */
    function createGhostTeam(opponent) {
        // Return a team object that battle adapter can use
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
