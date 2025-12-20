/**
 * pvp-stats.js - PvP Statistics Tracking System
 * 
 * Tracks cumulative game statistics for player-vs-player matches separately
 * from street/career stats. Maintains personal PvP records (single-game bests).
 * Records match history for "sports news" headlines.
 * 
 * Stats tracked:
 * - Points, Rebounds, Assists, Steals, Blocks, Turnovers
 * - Field Goals Made/Attempted, Three Pointers Made/Attempted
 * - Dunks, Injuries caused
 * 
 * All PvP stats are stored in ctx.pvpStats (cumulative) and ctx.pvpRecords (bests)
 * Match history is stored globally in lorb.pvpNews namespace
 */
(function() {
    
    // All trackable stat keys (mirrors career-stats.js)
    var STAT_KEYS = [
        "points",
        "rebounds", 
        "assists",
        "steals",
        "blocks",
        "turnovers",
        "fgm",      // Field goals made
        "fga",      // Field goals attempted
        "tpm",      // Three pointers made
        "tpa",      // Three pointers attempted
        "dunks",
        "injuries"  // Injuries caused to opponents
    ];
    
    // Stat display names for UI
    var STAT_NAMES = {
        points: "Points",
        rebounds: "Rebounds",
        assists: "Assists",
        steals: "Steals",
        blocks: "Blocks",
        turnovers: "Turnovers",
        fgm: "FG Made",
        fga: "FG Attempted",
        tpm: "3PT Made",
        tpa: "3PT Attempted",
        dunks: "Dunks",
        injuries: "Injuries Caused"
    };
    
    // Stat abbreviations for compact display
    var STAT_ABBREVS = {
        points: "PTS",
        rebounds: "REB",
        assists: "AST",
        steals: "STL",
        blocks: "BLK",
        turnovers: "TO",
        fgm: "FGM",
        fga: "FGA",
        tpm: "3PM",
        tpa: "3PA",
        dunks: "DNK",
        injuries: "INJ"
    };
    
    // Maximum number of news entries to keep
    var MAX_NEWS_ENTRIES = 25;
    
    // Base PvP wager amount (static for now)
    var PVP_WAGER_AMOUNT = 50;
    
    // Rep stakes for PvP matches
    var REP_WIN_BONUS = 50;      // Winner gains
    var REP_LOSS_PENALTY = 10;   // Loser loses (small penalty)
    var REP_TIE_BONUS = 5;       // Both get small bonus for tie
    
    /**
     * Initialize PvP stats structure if not present
     * @param {Object} ctx - Player context
     */
    function ensurePvpStats(ctx) {
        if (!ctx.pvpStats) {
            ctx.pvpStats = {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                ties: 0,
                totals: {},
                currentStreak: 0,      // Positive = win streak, negative = loss streak
                longestWinStreak: 0,
                longestLossStreak: 0
            };
            for (var i = 0; i < STAT_KEYS.length; i++) {
                ctx.pvpStats.totals[STAT_KEYS[i]] = 0;
            }
        }
        return ctx.pvpStats;
    }
    
    /**
     * Initialize PvP records structure if not present
     * @param {Object} ctx - Player context
     */
    function ensurePvpRecords(ctx) {
        if (!ctx.pvpRecords) {
            ctx.pvpRecords = {};
            for (var i = 0; i < STAT_KEYS.length; i++) {
                ctx.pvpRecords[STAT_KEYS[i]] = {
                    value: 0,
                    date: null,
                    opponent: null
                };
            }
            // Also track biggest win margin
            ctx.pvpRecords.winMargin = {
                value: 0,
                date: null,
                opponent: null,
                score: null
            };
        }
        return ctx.pvpRecords;
    }
    
    /**
     * Get PvP averages (per game)
     * @param {Object} ctx - Player context
     * @returns {Object} Averages for each stat
     */
    function getAverages(ctx) {
        var stats = ensurePvpStats(ctx);
        var games = stats.gamesPlayed || 0;
        var averages = {};
        
        for (var i = 0; i < STAT_KEYS.length; i++) {
            var key = STAT_KEYS[i];
            var total = stats.totals[key] || 0;
            averages[key] = games > 0 ? (total / games) : 0;
        }
        
        // Calculate FG% and 3PT%
        var fgm = stats.totals.fgm || 0;
        var fga = stats.totals.fga || 0;
        var tpm = stats.totals.tpm || 0;
        var tpa = stats.totals.tpa || 0;
        
        averages.fgPct = fga > 0 ? Math.round((fgm / fga) * 1000) / 10 : 0;
        averages.tpPct = tpa > 0 ? Math.round((tpm / tpa) * 1000) / 10 : 0;
        
        // Win rate
        averages.winRate = games > 0 ? Math.round((stats.wins / games) * 1000) / 10 : 0;
        
        return averages;
    }
    
    /**
     * Record a PvP game and update stats
     * Also checks for new records
     * 
     * @param {Object} ctx - Player context
     * @param {Object} gameStats - Stats from this game (points, rebounds, etc.)
     * @param {Object} matchInfo - Match context { won, opponent, myScore, oppScore, tie }
     * @returns {Object} Result with newRecords array listing any records broken
     */
    function recordPvpGame(ctx, gameStats, matchInfo) {
        var stats = ensurePvpStats(ctx);
        var records = ensurePvpRecords(ctx);
        var info = matchInfo || {};
        
        stats.gamesPlayed++;
        
        // Update win/loss/tie counters
        if (info.tie) {
            stats.ties++;
            stats.currentStreak = 0;
        } else if (info.won) {
            stats.wins++;
            if (stats.currentStreak >= 0) {
                stats.currentStreak++;
            } else {
                stats.currentStreak = 1;
            }
            if (stats.currentStreak > stats.longestWinStreak) {
                stats.longestWinStreak = stats.currentStreak;
            }
        } else {
            stats.losses++;
            if (stats.currentStreak <= 0) {
                stats.currentStreak--;
            } else {
                stats.currentStreak = -1;
            }
            if (Math.abs(stats.currentStreak) > stats.longestLossStreak) {
                stats.longestLossStreak = Math.abs(stats.currentStreak);
            }
        }
        
        var newRecords = [];
        var now = Date.now();
        
        // Update totals and check records
        for (var i = 0; i < STAT_KEYS.length; i++) {
            var key = STAT_KEYS[i];
            var value = gameStats[key] || 0;
            
            // Add to totals
            stats.totals[key] = (stats.totals[key] || 0) + value;
            
            // Check for new record
            var isNegativeStat = (key === "turnovers" || key === "injuries");
            var currentRecord = records[key].value || 0;
            
            if (value > currentRecord) {
                records[key] = {
                    value: value,
                    date: now,
                    opponent: info.opponentName || null
                };
                
                // Only announce positive stat records
                if (!isNegativeStat && value > 0) {
                    newRecords.push({
                        stat: key,
                        name: STAT_NAMES[key],
                        abbrev: STAT_ABBREVS[key],
                        value: value,
                        previousRecord: currentRecord
                    });
                }
            }
        }
        
        // Check for win margin record
        if (info.won && typeof info.myScore === "number" && typeof info.oppScore === "number") {
            var margin = info.myScore - info.oppScore;
            if (margin > (records.winMargin.value || 0)) {
                records.winMargin = {
                    value: margin,
                    date: now,
                    opponent: info.opponentName || null,
                    score: info.myScore + "-" + info.oppScore
                };
                newRecords.push({
                    stat: "winMargin",
                    name: "Win Margin",
                    abbrev: "MARGIN",
                    value: margin,
                    previousRecord: records.winMargin.value || 0
                });
            }
        }
        
        return {
            gamesPlayed: stats.gamesPlayed,
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            currentStreak: stats.currentStreak,
            newRecords: newRecords
        };
    }
    
    /**
     * Calculate PvP match rewards/penalties
     * 
     * @param {boolean} won - Whether the player won
     * @param {boolean} tie - Whether the match was a tie
     * @param {Object} options - Optional overrides
     * @returns {Object} { cashChange, repChange, wager }
     */
    function calculatePvpRewards(won, tie, options) {
        var opts = options || {};
        var wager = opts.wager || PVP_WAGER_AMOUNT;
        
        var cashChange = 0;
        var repChange = 0;
        
        if (tie) {
            // Tie: return wager, small rep bonus
            cashChange = 0;
            repChange = REP_TIE_BONUS;
        } else if (won) {
            // Win: gain wager, gain rep
            cashChange = wager;
            repChange = REP_WIN_BONUS;
        } else {
            // Loss: lose wager, small rep penalty
            cashChange = -wager;
            repChange = -REP_LOSS_PENALTY;
        }
        
        return {
            cashChange: cashChange,
            repChange: repChange,
            wager: wager
        };
    }
    
    /**
     * Create a news entry from a completed match
     * 
     * @param {Object} matchData - {
     *   winnerName, loserName, winnerScore, loserScore,
     *   topScorer, topScorerPoints, topScorerTeam,
     *   timestamp, gameDay, city
     * }
     * @returns {Object} News entry object
     */
    function createNewsEntry(matchData) {
        var entry = {
            type: "pvp_match",
            timestamp: matchData.timestamp || Date.now(),
            gameDay: matchData.gameDay || 1,
            city: matchData.city || null,
            winnerName: matchData.winnerName,
            loserName: matchData.loserName,
            winnerScore: matchData.winnerScore,
            loserScore: matchData.loserScore,
            isTie: matchData.isTie || false
        };
        
        // Top scorer info
        if (matchData.topScorer) {
            entry.topScorer = matchData.topScorer;
            entry.topScorerPoints = matchData.topScorerPoints || 0;
            entry.topScorerTeam = matchData.topScorerTeam || null;
        }
        
        // Record-breaking achievements
        if (matchData.newRecords && matchData.newRecords.length > 0) {
            entry.newRecords = matchData.newRecords;
        }
        
        return entry;
    }
    
    /**
     * Format a news entry as a displayable headline
     * Supports types: pvp_match, red_bull_defeated, red_bull_loss, championship
     * 
     * @param {Object} entry - News entry object
     * @returns {string} Formatted headline string
     */
    function formatNewsHeadline(entry) {
        var lines = [];
        
        // Handle different news types
        if (entry.type === "red_bull_defeated") {
            lines.push("\1h\1r*** LEGENDARY VICTORY! ***\1n");
            lines.push("\1y" + entry.playerName + "\1w has \1gdefeated the Red Bull!\1n");
            if (entry.seasonNumber) {
                lines.push("  \1cSeason " + entry.seasonNumber + " Champion's Challenge\1n");
            }
            return lines.join("\n");
        }
        
        if (entry.type === "red_bull_loss") {
            var scoreText = entry.playerScore && entry.bossScore 
                ? " \1w(" + entry.playerScore + "-" + entry.bossScore + ")\1n" 
                : "";
            lines.push("\1y" + entry.playerName + "\1w fell to the \1h\1rRed Bull\1n" + scoreText);
            return lines.join("\n");
        }
        
        if (entry.type === "championship") {
            lines.push("\1h\1y*** NEW CHAMPION! ***\1n");
            lines.push("\1y" + entry.playerName + "\1w wins the \1cSeason " + entry.seasonNumber + "\1w championship!\1n");
            return lines.join("\n");
        }
        
        // Default: PvP match format
        if (entry.isTie) {
            lines.push("\1w" + entry.winnerName + "\1n \1wand \1w" + entry.loserName + "\1w played to a \1y" + 
                      entry.winnerScore + "-" + entry.loserScore + "\1w draw!\1n");
        } else {
            lines.push("\1c" + entry.winnerName + "\1w defeated \1r" + entry.loserName + 
                      "\1w " + entry.winnerScore + "-" + entry.loserScore + "\1n");
        }
        
        // Add top scorer callout
        if (entry.topScorer && entry.topScorerPoints > 0) {
            lines.push("  \1y" + entry.topScorer + "\1w led scoring with \1h\1w" + 
                      entry.topScorerPoints + " points\1n");
        }
        
        // Add any records broken
        if (entry.newRecords && entry.newRecords.length > 0) {
            for (var i = 0; i < entry.newRecords.length; i++) {
                var rec = entry.newRecords[i];
                lines.push("  \1g\1h* NEW PVP RECORD: \1w" + rec.name + ": " + rec.value + "\1n");
            }
        }
        
        return lines.join("\n");
    }
    
    /**
     * Get news entries from local JSONdb
     * 
     * @param {number} limit - Maximum entries to return (default: 10)
     * @returns {Array} Array of news entries, newest first
     */
    function getNews(limit) {
        limit = limit || 10;
        var news = [];
        
        try {
            if (LORB && LORB.Persist && LORB.Persist.readShared) {
                var data = LORB.Persist.readShared("pvpNews");
                if (data && data.entries && Array.isArray(data.entries)) {
                    news = data.entries;
                }
            }
        } catch (e) {
            if (typeof debugLog === "function") {
                debugLog("[PVP-STATS] Error reading news: " + e);
            }
        }
        
        // Sort by timestamp descending (newest first)
        news.sort(function(a, b) {
            return (b.timestamp || 0) - (a.timestamp || 0);
        });
        
        // Return limited entries
        return news.slice(0, limit);
    }
    
    /**
     * Add a news entry to the local news feed
     * 
     * @param {Object} entry - News entry object
     * @returns {boolean} Success
     */
    function addNews(entry) {
        try {
            if (!LORB || !LORB.Persist || !LORB.Persist.readShared || !LORB.Persist.writeShared) {
                if (typeof debugLog === "function") {
                    debugLog("[PVP-STATS] addNews: LORB.Persist not available");
                }
                return false;
            }
            
            // Read existing news from local db
            var data = LORB.Persist.readShared("pvpNews");
            if (!data || !data.entries) {
                data = { entries: [] };
            }
            
            // Add new entry
            data.entries.push(entry);
            
            // Trim to max entries (keep newest)
            if (data.entries.length > MAX_NEWS_ENTRIES) {
                // Sort by timestamp descending
                data.entries.sort(function(a, b) {
                    return (b.timestamp || 0) - (a.timestamp || 0);
                });
                data.entries = data.entries.slice(0, MAX_NEWS_ENTRIES);
            }
            
            data.lastUpdated = Date.now();
            
            // Write back to local db
            var success = LORB.Persist.writeShared("pvpNews", data);
            
            if (typeof debugLog === "function") {
                debugLog("[PVP-STATS] addNews: saved=" + success + " entries=" + data.entries.length);
            }
            
            return success;
        } catch (e) {
            if (typeof debugLog === "function") {
                debugLog("[PVP-STATS] Error adding news: " + e);
            }
            return false;
        }
    }
    
    /**
     * Format PvP stats for display
     * @param {Object} ctx - Player context
     * @param {string} format - "full", "compact", or "summary"
     * @returns {Array} Lines of formatted stats
     */
    function formatPvpStats(ctx, format) {
        var stats = ensurePvpStats(ctx);
        format = format || "compact";
        
        if (format === "summary") {
            // One-line summary
            var winPct = stats.gamesPlayed > 0 
                ? Math.round((stats.wins / stats.gamesPlayed) * 100) 
                : 0;
            return [
                "PvP Record: \1w" + stats.wins + "W-" + stats.losses + "L" + 
                (stats.ties > 0 ? "-" + stats.ties + "T" : "") + 
                "\1n (" + winPct + "%)"
            ];
        }
        
        var lines = [];
        lines.push("\1c\1h=== PvP Statistics ===\1n");
        lines.push("");
        lines.push("Games Played: " + stats.gamesPlayed);
        lines.push("Record: \1g" + stats.wins + "W\1n - \1r" + stats.losses + "L\1n" + 
                  (stats.ties > 0 ? " - \1y" + stats.ties + "T\1n" : ""));
        
        if (stats.gamesPlayed > 0) {
            var winPct = Math.round((stats.wins / stats.gamesPlayed) * 1000) / 10;
            lines.push("Win Rate: " + winPct + "%");
        }
        
        if (stats.currentStreak !== 0) {
            if (stats.currentStreak > 0) {
                lines.push("Current Streak: \1g" + stats.currentStreak + "W\1n");
            } else {
                lines.push("Current Streak: \1r" + Math.abs(stats.currentStreak) + "L\1n");
            }
        }
        
        if (stats.longestWinStreak > 0) {
            lines.push("Best Win Streak: " + stats.longestWinStreak);
        }
        
        if (format === "full") {
            var avgs = getAverages(ctx);
            lines.push("");
            lines.push("\1c--- Per-Game Averages ---\1n");
            lines.push("PPG:  " + avgs.points.toFixed(1));
            lines.push("RPG:  " + avgs.rebounds.toFixed(1));
            lines.push("APG:  " + avgs.assists.toFixed(1));
            lines.push("SPG:  " + avgs.steals.toFixed(1));
            lines.push("BPG:  " + avgs.blocks.toFixed(1));
            lines.push("");
            lines.push("FG%:  " + avgs.fgPct.toFixed(1) + "%");
            lines.push("3P%:  " + avgs.tpPct.toFixed(1) + "%");
        }
        
        return lines;
    }
    
    /**
     * Format PvP records for display
     * @param {Object} ctx - Player context
     * @returns {Array} Lines of formatted records
     */
    function formatPvpRecords(ctx) {
        var records = ensurePvpRecords(ctx);
        var lines = [];
        
        lines.push("\1y\1h=== PvP Records ===\1n");
        lines.push("");
        
        // Only show positive stat records
        var displayKeys = ["points", "rebounds", "assists", "steals", "blocks", "dunks"];
        
        for (var i = 0; i < displayKeys.length; i++) {
            var key = displayKeys[i];
            var rec = records[key];
            var name = STAT_NAMES[key];
            var value = rec.value || 0;
            
            var line = name + ": " + value;
            if (rec.opponent) {
                line += " (vs " + rec.opponent + ")";
            }
            lines.push(line);
        }
        
        // Win margin record
        if (records.winMargin && records.winMargin.value > 0) {
            lines.push("");
            lines.push("\1gBiggest Win: +" + records.winMargin.value + " pts\1n");
            if (records.winMargin.score) {
                lines.push("  Score: " + records.winMargin.score);
            }
            if (records.winMargin.opponent) {
                lines.push("  vs " + records.winMargin.opponent);
            }
        }
        
        return lines;
    }
    
    /**
     * Check if player can afford PvP wager
     * @param {Object} ctx - Player context
     * @param {number} wager - Optional custom wager amount
     * @returns {boolean}
     */
    function canAffordPvpWager(ctx, wager) {
        wager = wager || PVP_WAGER_AMOUNT;
        return (ctx.cash || 0) >= wager;
    }
    
    /**
     * Get the default PvP wager amount
     * @returns {number}
     */
    function getDefaultWager() {
        return PVP_WAGER_AMOUNT;
    }
    
    // Export to LORB namespace
    if (typeof LORB === "undefined") {
        LORB = {};
    }
    if (!LORB.Util) {
        LORB.Util = {};
    }
    
    LORB.Util.PvpStats = {
        // Core functions
        ensurePvpStats: ensurePvpStats,
        ensurePvpRecords: ensurePvpRecords,
        recordPvpGame: recordPvpGame,
        getAverages: getAverages,
        calculatePvpRewards: calculatePvpRewards,
        
        // News/history functions
        createNewsEntry: createNewsEntry,
        formatNewsHeadline: formatNewsHeadline,
        getNews: getNews,
        addNews: addNews,
        
        // Display helpers
        formatPvpStats: formatPvpStats,
        formatPvpRecords: formatPvpRecords,
        
        // Wager helpers
        canAffordPvpWager: canAffordPvpWager,
        getDefaultWager: getDefaultWager,
        
        // Constants
        STAT_KEYS: STAT_KEYS,
        STAT_NAMES: STAT_NAMES,
        STAT_ABBREVS: STAT_ABBREVS,
        PVP_WAGER_AMOUNT: PVP_WAGER_AMOUNT,
        REP_WIN_BONUS: REP_WIN_BONUS,
        REP_LOSS_PENALTY: REP_LOSS_PENALTY,
        MAX_NEWS_ENTRIES: MAX_NEWS_ENTRIES
    };
    
})();
