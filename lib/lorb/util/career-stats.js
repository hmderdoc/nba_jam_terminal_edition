/**
 * career-stats.js - Career Statistics Tracking System
 * 
 * Tracks cumulative game statistics and calculates averages.
 * Maintains personal records (single-game bests).
 * Calculates post-game money bonuses based on performance.
 * 
 * Stats tracked:
 * - Points, Rebounds, Assists, Steals, Blocks, Turnovers
 * - Field Goals Made/Attempted, Three Pointers Made/Attempted
 * - Dunks, Injuries caused
 * 
 * All stats are stored in ctx.careerStats (cumulative) and ctx.records (bests)
 */
(function() {
    
    // All trackable stat keys
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
    
    /**
     * Base money bonus values per stat (Court 6 / difficulty 1)
     * Positive values are rewards, negative are penalties
     */
    var BASE_BONUSES = {
        points: 2,          // $2 per point
        rebounds: 2,        // $2 per rebound
        assists: 2,         // $2 per assist
        steals: 5,          // $5 per steal
        blocks: 5,          // $5 per block
        dunks: 2,           // $2 per dunk
        turnovers: -2,      // -$2 per turnover
        injuries: -2,       // -$2 per injury caused (optional penalty, could be +)
        fgMissed: -2        // -$2 per missed field goal (fga - fgm)
    };
    
    /**
     * Bonus multipliers by court difficulty
     * Higher difficulty courts pay better
     */
    var DIFFICULTY_MULTIPLIERS = {
        1: 1.0,   // Court 6 - base rate
        2: 1.5,   // Court 9
        3: 2.0,   // Dunk District
        4: 3.0,   // The Arc
        5: 5.0    // Court of Airness
    };
    
    /**
     * Initialize career stats structure if not present
     * @param {Object} ctx - Player context
     */
    function ensureCareerStats(ctx) {
        if (!ctx.careerStats) {
            ctx.careerStats = {
                gamesPlayed: 0,
                totals: {},
                // Per-stat totals
            };
            for (var i = 0; i < STAT_KEYS.length; i++) {
                ctx.careerStats.totals[STAT_KEYS[i]] = 0;
            }
        }
        return ctx.careerStats;
    }
    
    /**
     * Initialize records structure if not present
     * @param {Object} ctx - Player context
     */
    function ensureRecords(ctx) {
        if (!ctx.records) {
            ctx.records = {};
            for (var i = 0; i < STAT_KEYS.length; i++) {
                ctx.records[STAT_KEYS[i]] = {
                    value: 0,
                    date: null,
                    opponent: null,
                    court: null
                };
            }
        }
        return ctx.records;
    }
    
    /**
     * Get career averages (per game)
     * @param {Object} ctx - Player context
     * @returns {Object} Averages for each stat
     */
    function getAverages(ctx) {
        var career = ensureCareerStats(ctx);
        var games = career.gamesPlayed || 0;
        var averages = {};
        
        for (var i = 0; i < STAT_KEYS.length; i++) {
            var key = STAT_KEYS[i];
            var total = career.totals[key] || 0;
            averages[key] = games > 0 ? (total / games) : 0;
        }
        
        // Calculate FG% and 3PT%
        var fgm = career.totals.fgm || 0;
        var fga = career.totals.fga || 0;
        var tpm = career.totals.tpm || 0;
        var tpa = career.totals.tpa || 0;
        
        averages.fgPct = fga > 0 ? Math.round((fgm / fga) * 1000) / 10 : 0;
        averages.tpPct = tpa > 0 ? Math.round((tpm / tpa) * 1000) / 10 : 0;
        
        return averages;
    }
    
    /**
     * Record game stats and update career totals
     * Also checks for new records
     * 
     * @param {Object} ctx - Player context
     * @param {Object} gameStats - Stats from this game
     * @param {Object} gameInfo - Optional game context (opponent, court, etc.)
     * @returns {Object} Result with newRecords array listing any records broken
     */
    function recordGame(ctx, gameStats, gameInfo) {
        var career = ensureCareerStats(ctx);
        var records = ensureRecords(ctx);
        var info = gameInfo || {};
        
        career.gamesPlayed++;
        
        var newRecords = [];
        var now = Date.now();
        
        // Update totals and check records
        for (var i = 0; i < STAT_KEYS.length; i++) {
            var key = STAT_KEYS[i];
            var value = gameStats[key] || 0;
            
            // Add to career totals
            career.totals[key] = (career.totals[key] || 0) + value;
            
            // Check for new record (higher is better for most, lower for turnovers/injuries)
            var isNegativeStat = (key === "turnovers" || key === "injuries");
            var currentRecord = records[key].value || 0;
            
            // For negative stats, we still track the "high" as a record (most turnovers)
            // User might want to see worst game too
            if (value > currentRecord) {
                records[key] = {
                    value: value,
                    date: now,
                    opponent: info.opponentName || null,
                    court: info.courtName || null
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
        
        return {
            gamesPlayed: career.gamesPlayed,
            newRecords: newRecords
        };
    }
    
    /**
     * Calculate money bonuses for a game's stats
     * 
     * @param {Object} gameStats - Stats from this game
     * @param {number} difficulty - Court difficulty (1-5)
     * @param {Object} options - Optional overrides for bonus values
     * @returns {Object} Breakdown of bonuses
     */
    function calculateBonuses(gameStats, difficulty, options) {
        var opts = options || {};
        var multiplier = DIFFICULTY_MULTIPLIERS[difficulty] || 1.0;
        var bonuses = opts.bonuses || BASE_BONUSES;
        
        var breakdown = [];
        var total = 0;
        
        // Points
        if (gameStats.points && bonuses.points) {
            var pts = gameStats.points;
            var ptsBonus = Math.floor(pts * bonuses.points * multiplier);
            breakdown.push({ stat: "Points", count: pts, rate: bonuses.points, bonus: ptsBonus });
            total += ptsBonus;
        }
        
        // Rebounds
        if (gameStats.rebounds && bonuses.rebounds) {
            var reb = gameStats.rebounds;
            var rebBonus = Math.floor(reb * bonuses.rebounds * multiplier);
            breakdown.push({ stat: "Rebounds", count: reb, rate: bonuses.rebounds, bonus: rebBonus });
            total += rebBonus;
        }
        
        // Assists
        if (gameStats.assists && bonuses.assists) {
            var ast = gameStats.assists;
            var astBonus = Math.floor(ast * bonuses.assists * multiplier);
            breakdown.push({ stat: "Assists", count: ast, rate: bonuses.assists, bonus: astBonus });
            total += astBonus;
        }
        
        // Steals
        if (gameStats.steals && bonuses.steals) {
            var stl = gameStats.steals;
            var stlBonus = Math.floor(stl * bonuses.steals * multiplier);
            breakdown.push({ stat: "Steals", count: stl, rate: bonuses.steals, bonus: stlBonus });
            total += stlBonus;
        }
        
        // Blocks
        if (gameStats.blocks && bonuses.blocks) {
            var blk = gameStats.blocks;
            var blkBonus = Math.floor(blk * bonuses.blocks * multiplier);
            breakdown.push({ stat: "Blocks", count: blk, rate: bonuses.blocks, bonus: blkBonus });
            total += blkBonus;
        }
        
        // Dunks
        if (gameStats.dunks && bonuses.dunks) {
            var dnk = gameStats.dunks;
            var dnkBonus = Math.floor(dnk * bonuses.dunks * multiplier);
            breakdown.push({ stat: "Dunks", count: dnk, rate: bonuses.dunks, bonus: dnkBonus });
            total += dnkBonus;
        }
        
        // Turnovers (penalty)
        if (gameStats.turnovers && bonuses.turnovers) {
            var to = gameStats.turnovers;
            var toBonus = Math.floor(to * bonuses.turnovers * multiplier);
            breakdown.push({ stat: "Turnovers", count: to, rate: bonuses.turnovers, bonus: toBonus });
            total += toBonus;  // Will be negative
        }
        
        // Missed field goals (penalty)
        var fgMissed = (gameStats.fga || 0) - (gameStats.fgm || 0);
        if (fgMissed > 0 && bonuses.fgMissed) {
            var fgmBonus = Math.floor(fgMissed * bonuses.fgMissed * multiplier);
            breakdown.push({ stat: "FG Missed", count: fgMissed, rate: bonuses.fgMissed, bonus: fgmBonus });
            total += fgmBonus;  // Will be negative
        }
        
        // Injuries (can be + or - depending on game config)
        if (gameStats.injuries && bonuses.injuries) {
            var inj = gameStats.injuries;
            var injBonus = Math.floor(inj * bonuses.injuries * multiplier);
            breakdown.push({ stat: "Injuries", count: inj, rate: bonuses.injuries, bonus: injBonus });
            total += injBonus;
        }
        
        return {
            breakdown: breakdown,
            total: total,
            difficulty: difficulty,
            multiplier: multiplier
        };
    }
    
    /**
     * Format stats for display
     * @param {Object} stats - Game stats object
     * @param {string} format - "full", "compact", or "line"
     * @returns {string|Array} Formatted stat string(s)
     */
    function formatStats(stats, format) {
        format = format || "compact";
        
        if (format === "line") {
            // Single line: "12 PTS | 3 REB | 2 AST | 1 STL"
            var parts = [];
            if (stats.points) parts.push(stats.points + " PTS");
            if (stats.rebounds) parts.push(stats.rebounds + " REB");
            if (stats.assists) parts.push(stats.assists + " AST");
            if (stats.steals) parts.push(stats.steals + " STL");
            if (stats.blocks) parts.push(stats.blocks + " BLK");
            return parts.join(" | ");
        }
        
        if (format === "compact") {
            // Box score style
            return [
                "PTS: " + (stats.points || 0),
                "REB: " + (stats.rebounds || 0),
                "AST: " + (stats.assists || 0),
                "STL: " + (stats.steals || 0),
                "BLK: " + (stats.blocks || 0),
                "TO:  " + (stats.turnovers || 0)
            ];
        }
        
        // Full format with shooting
        var fgm = stats.fgm || 0;
        var fga = stats.fga || 0;
        var tpm = stats.tpm || 0;
        var tpa = stats.tpa || 0;
        var fgPct = fga > 0 ? Math.round((fgm / fga) * 100) : 0;
        var tpPct = tpa > 0 ? Math.round((tpm / tpa) * 100) : 0;
        
        return [
            "Points:     " + (stats.points || 0),
            "Rebounds:   " + (stats.rebounds || 0),
            "Assists:    " + (stats.assists || 0),
            "Steals:     " + (stats.steals || 0),
            "Blocks:     " + (stats.blocks || 0),
            "Turnovers:  " + (stats.turnovers || 0),
            "Dunks:      " + (stats.dunks || 0),
            "",
            "FG:   " + fgm + "/" + fga + " (" + fgPct + "%)",
            "3PT:  " + tpm + "/" + tpa + " (" + tpPct + "%)"
        ];
    }
    
    /**
     * Format career averages for display
     * @param {Object} ctx - Player context
     * @returns {Array} Lines of formatted averages
     */
    function formatAverages(ctx) {
        var avgs = getAverages(ctx);
        var career = ensureCareerStats(ctx);
        
        return [
            "Games Played: " + career.gamesPlayed,
            "",
            "PPG:  " + avgs.points.toFixed(1),
            "RPG:  " + avgs.rebounds.toFixed(1),
            "APG:  " + avgs.assists.toFixed(1),
            "SPG:  " + avgs.steals.toFixed(1),
            "BPG:  " + avgs.blocks.toFixed(1),
            "TPG:  " + avgs.turnovers.toFixed(1),
            "",
            "FG%:  " + avgs.fgPct.toFixed(1) + "%",
            "3P%:  " + avgs.tpPct.toFixed(1) + "%"
        ];
    }
    
    /**
     * Format records for display
     * @param {Object} ctx - Player context
     * @returns {Array} Lines of formatted records
     */
    function formatRecords(ctx) {
        var records = ensureRecords(ctx);
        var lines = [];
        
        // Only show positive stat records
        var displayKeys = ["points", "rebounds", "assists", "steals", "blocks", "dunks"];
        
        for (var i = 0; i < displayKeys.length; i++) {
            var key = displayKeys[i];
            var rec = records[key];
            var name = STAT_NAMES[key];
            var value = rec.value || 0;
            
            var line = name + ": " + value;
            if (rec.court) {
                line += " (" + rec.court + ")";
            }
            lines.push(line);
        }
        
        return lines;
    }
    
    // Export to LORB namespace
    if (typeof LORB === "undefined") {
        LORB = {};
    }
    if (!LORB.Util) {
        LORB.Util = {};
    }
    
    LORB.Util.CareerStats = {
        // Core functions
        ensureCareerStats: ensureCareerStats,
        ensureRecords: ensureRecords,
        recordGame: recordGame,
        getAverages: getAverages,
        calculateBonuses: calculateBonuses,
        
        // Display helpers
        formatStats: formatStats,
        formatAverages: formatAverages,
        formatRecords: formatRecords,
        
        // Constants (for UI/config access)
        STAT_KEYS: STAT_KEYS,
        STAT_NAMES: STAT_NAMES,
        STAT_ABBREVS: STAT_ABBREVS,
        BASE_BONUSES: BASE_BONUSES,
        DIFFICULTY_MULTIPLIERS: DIFFICULTY_MULTIPLIERS
    };
    
})();
