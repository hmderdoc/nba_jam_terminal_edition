/**
 * LORB Parallel Playoffs System
 * 
 * Implements the V1 playoff spec from design_docs/playoffs/Parallel_Playoffs_Spec.md:
 * - Season N ends → immediately start Season N+1
 * - Season N playoffs run in parallel using frozen player snapshots
 * - Only one playoff bracket active at a time (most recent completed season)
 * - Match resolution: PvP > Ghost > CPU Sim
 * - Soft deadline (72h): eligible for CPU sim
 * - Hard deadline (168h): must be auto-resolved
 * 
 * Data structures:
 * - PlayoffBracket: stored in lorb.json under "playoffBrackets.<seasonNumber>"
 * - PlayerSeasonSnapshot: stored in lorb.json under "seasonSnapshots.<seasonNumber>.<playerId>"
 */
(function() {
    
    var Config = LORB.Config;
    var PlayoffConfig = Config.PLAYOFF || {};
    
    // Status constants (from config)
    var SEASON_STATUS = PlayoffConfig.SEASON_STATUS || {
        ACTIVE: "active",
        COMPLETED_REGULAR: "completed_regular",
        PLAYOFFS_ACTIVE: "playoffs_active",
        ARCHIVED: "archived"
    };
    
    var BRACKET_STATUS = PlayoffConfig.BRACKET_STATUS || {
        ACTIVE: "active",
        COMPLETED: "completed"
    };
    
    var MATCH_STATUS = PlayoffConfig.MATCH_STATUS || {
        PENDING: "pending",
        IN_PROGRESS: "in_progress",
        COMPLETED: "completed",
        BYE: "bye"
    };
    
    var RESOLUTION = PlayoffConfig.RESOLUTION || {
        PVP: "pvp",
        GHOST: "ghost",
        CPU_SIM: "cpu_sim"
    };
    
    // ========== HELPER FUNCTIONS ==========
    
    function nowMs() {
        return Date.now ? Date.now() : (time() * 1000);
    }
    
    function hoursToMs(hours) {
        return hours * 60 * 60 * 1000;
    }
    
    function daysToMs(days) {
        // Use configured day duration (default 1 hour for testing, 24h for production)
        var dayDurationMs = Config.DAY_DURATION_MS || 3600000;
        return days * dayDurationMs;
    }
    
    /**
     * Calculate round deadlines based on season length and number of rounds
     * 
     * Season time is divided evenly among rounds:
     * - 30 days, 2 rounds → Round 1 deadline: day 15, Round 2 deadline: day 30
     * - 30 days, 3 rounds → Round 1: day 10, Round 2: day 20, Round 3: day 30
     * 
     * Soft deadline = end of round period (one player can force ghost match)
     * Hard deadline = soft + grace period (both absent → CPU sim)
     * Grace period = half of round duration (for testing fairness)
     * 
     * @param {number} roundNumber - 1-indexed round number
     * @param {number} totalRounds - Total number of rounds in bracket
     * @param {number} bracketCreatedAt - Timestamp when bracket was created
     * @returns {Object} { softDeadline, hardDeadline } as timestamps
     */
    function calculateRoundDeadlines(roundNumber, totalRounds, bracketCreatedAt) {
        var seasonLengthDays = Config.SEASON_LENGTH_DAYS || 30;
        var seasonLengthMs = daysToMs(seasonLengthDays);
        
        // Round duration = season length / total rounds
        var roundDurationMs = seasonLengthMs / totalRounds;
        
        // Soft deadline = end of this round's time slot
        var softDeadline = bracketCreatedAt + (roundDurationMs * roundNumber);
        
        // Grace period = half of round duration (absent players get some buffer)
        var gracePeriodMs = roundDurationMs / 2;
        
        // Hard deadline = soft deadline + grace period
        var hardDeadline = softDeadline + gracePeriodMs;
        
        return {
            softDeadline: softDeadline,
            hardDeadline: hardDeadline
        };
    }
    
    /**
     * Get total number of rounds for a bracket size
     */
    function getTotalRounds(bracketSize) {
        return Math.floor(Math.log(bracketSize) / Math.log(2));
    }
    
    function logPlayoffs(op, status, extra) {
        if (typeof debugLog !== "function") return;
        var msg = "[LORB:PLAYOFFS] op=" + op + " status=" + status;
        if (extra !== undefined && extra !== null) {
            msg += " info=" + extra;
        }
        debugLog(msg);
    }
    
    /**
     * Deep clone a bracket for transactional safety.
     * Creates a snapshot that can be restored if modifications fail.
     */
    function cloneBracket(bracket) {
        if (!bracket) return null;
        try {
            return JSON.parse(JSON.stringify(bracket));
        } catch (e) {
            logPlayoffs("cloneBracket", "error", "clone_failed=" + e);
            return null;
        }
    }
    
    /**
     * Get the next power of 2 bracket size for a given player count
     */
    function getBracketSize(playerCount) {
        var sizes = PlayoffConfig.SUPPORTED_BRACKET_SIZES || [2, 4, 8, 16];
        var maxSize = PlayoffConfig.MAX_BRACKET_SIZE || 16;
        
        if (playerCount <= 1) return 0;
        if (playerCount === 2) return 2;
        if (playerCount <= 4) return 4;
        if (playerCount <= 8) return 8;
        if (playerCount <= maxSize) return 16;
        return maxSize;
    }
    
    /**
     * Calculate number of BYEs needed for a bracket
     */
    function calculateByes(playerCount, bracketSize) {
        return bracketSize - playerCount;
    }
    
    // ========== PLAYER SEASON SNAPSHOT ==========
    
    // ========== ELIGIBILITY ==========
    
    /**
     * Check if a player is eligible for playoffs based on season activity.
     * Player must meet at least one criterion (games played OR rep threshold).
     * 
     * @param {Object} player - Player object with wins, losses, rep
     * @returns {Object} { eligible, gamesPlayed, rep, reason }
     */
    function isPlayerEligible(player) {
        if (!player) {
            return { eligible: false, gamesPlayed: 0, rep: 0, reason: "No player data" };
        }
        
        if (player.deleted || player.inactive) {
            return { eligible: false, gamesPlayed: 0, rep: 0, reason: "Player inactive or deleted" };
        }
        
        var eligibility = PlayoffConfig.ELIGIBILITY || { MIN_GAMES_PLAYED: 1, MIN_REP: 0 };
        var gamesPlayed = (player.wins || 0) + (player.losses || 0);
        var playerRep = player.rep || 0;
        
        var minGames = eligibility.MIN_GAMES_PLAYED || 0;
        var minRep = eligibility.MIN_REP || 0;
        
        // If both requirements are disabled, player is eligible
        if (minGames <= 0 && minRep <= 0) {
            return { eligible: true, gamesPlayed: gamesPlayed, rep: playerRep, reason: "No requirements set" };
        }
        
        // Check if meets games requirement
        var meetsGamesReq = minGames > 0 && gamesPlayed >= minGames;
        
        // Check if meets rep requirement (alternative path)
        var meetsRepReq = minRep > 0 && playerRep >= minRep;
        
        if (meetsGamesReq || meetsRepReq) {
            return { 
                eligible: true, 
                gamesPlayed: gamesPlayed, 
                rep: playerRep, 
                reason: meetsGamesReq ? "Met games requirement" : "Met rep requirement"
            };
        }
        
        // Build helpful message
        var reason = "Need ";
        if (minGames > 0) {
            reason += minGames + " game(s) played (have " + gamesPlayed + ")";
        }
        if (minGames > 0 && minRep > 0) {
            reason += " OR ";
        }
        if (minRep > 0) {
            reason += minRep + " rep (have " + playerRep + ")";
        }
        
        return { eligible: false, gamesPlayed: gamesPlayed, rep: playerRep, reason: reason };
    }
    
    // ========== PLAYER SEASON SNAPSHOT ==========
    
    /**
     * Create a frozen snapshot of a player's state at end of season.
     * Freezes gameplay-relevant data only (per spec 9.3).
     * 
     * @param {Object} player - Full player context or summary
     * @param {number} seasonNumber - Season being snapshotted
     * @returns {Object} PlayerSeasonSnapshot
     */
    function createPlayerSnapshot(player, seasonNumber) {
        var snapshot = {
            playerId: player.globalId || player._globalId || player.name,
            seasonNumber: seasonNumber,
            createdAt: nowMs(),
            
            // Identity (for display)
            name: player.name || "Unknown",
            nickname: player.nickname || player.name || "Unknown",
            
            // Core stats (frozen)
            stats: {},
            
            // Equipment affecting gameplay
            equipment: {},
            
            // Active perks/meta modifiers
            perks: [],
            meta: null,
            
            // Companion data
            activeTeammate: null,
            teammateData: null,
            
            // Season performance (for seeding/display)
            wins: player.wins || 0,
            losses: player.losses || 0,
            rep: player.rep || 0,
            level: player.level || 1,
            repScore: 0  // Calculated below
        };
        
        // Copy stats
        if (player.stats) {
            for (var stat in player.stats) {
                if (player.stats.hasOwnProperty(stat)) {
                    snapshot.stats[stat] = player.stats[stat];
                }
            }
        }
        
        // Copy equipment
        if (player.equipment) {
            for (var slot in player.equipment) {
                if (player.equipment.hasOwnProperty(slot)) {
                    snapshot.equipment[slot] = player.equipment[slot];
                }
            }
        }
        
        // Copy perks
        if (player.perks && Array.isArray(player.perks)) {
            snapshot.perks = player.perks.slice();
        }
        
        // Copy meta progression
        if (player.meta) {
            snapshot.meta = JSON.parse(JSON.stringify(player.meta));
        }
        
        // Copy active teammate
        if (player.activeTeammate) {
            snapshot.activeTeammate = player.activeTeammate;
            
            // Find teammate data in contacts
            if (player.contacts && Array.isArray(player.contacts)) {
                for (var i = 0; i < player.contacts.length; i++) {
                    var contact = player.contacts[i];
                    if (contact.id === player.activeTeammate) {
                        snapshot.teammateData = {
                            id: contact.id,
                            name: contact.name,
                            stats: contact.stats ? JSON.parse(JSON.stringify(contact.stats)) : {},
                            skin: contact.skin,
                            shortNick: contact.shortNick
                        };
                        break;
                    }
                }
            }
        }
        
        // Calculate REP score using existing season.js logic if available
        if (LORB.Season && LORB.Season.calculateRepScore) {
            snapshot.repScore = LORB.Season.calculateRepScore(player);
        } else {
            // Fallback calculation
            snapshot.repScore = (player.rep || 0) * 3 + (player.wins || 0) * 2;
        }
        
        // Copy playoff availability for scheduling
        if (player.playoffAvailability) {
            snapshot.playoffAvailability = JSON.parse(JSON.stringify(player.playoffAvailability));
        }
        
        return snapshot;
    }
    
    /**
     * Save a player snapshot to persistence
     */
    function saveSnapshot(snapshot) {
        if (!LORB.Persist) return false;
        
        var path = "seasonSnapshots." + snapshot.seasonNumber + "." + snapshot.playerId;
        return LORB.Persist.writeShared(path, snapshot);
    }
    
    /**
     * Load a player snapshot
     */
    function loadSnapshot(seasonNumber, playerId) {
        if (!LORB.Persist) return null;
        
        var path = "seasonSnapshots." + seasonNumber + "." + playerId;
        return LORB.Persist.readShared(path);
    }
    
    /**
     * Load all snapshots for a season
     */
    function loadSeasonSnapshots(seasonNumber) {
        if (!LORB.Persist) return {};
        
        var path = "seasonSnapshots." + seasonNumber;
        return LORB.Persist.readShared(path) || {};
    }
    
    // ========== PLAYOFF BRACKET ==========
    
    /**
     * Create a new playoff bracket for a completed season.
     * 
     * @param {number} seasonNumber - The completed season
     * @param {Array} qualifiedPlayers - Array of player summaries/snapshots
     * @returns {Object} PlayoffBracket structure
     */
    function createBracket(seasonNumber, qualifiedPlayers) {
        var playerCount = qualifiedPlayers.length;
        var bracketSize = getBracketSize(playerCount);
        
        if (bracketSize === 0) {
            logPlayoffs("createBracket", "skip", "insufficient_players=" + playerCount);
            return null;
        }
        
        // Sort players by REP score (descending) for seeding
        var sorted = qualifiedPlayers.slice().sort(function(a, b) {
            // Primary: REP score
            var aScore = a.repScore || 0;
            var bScore = b.repScore || 0;
            if (bScore !== aScore) return bScore - aScore;
            
            // Secondary: wins
            var aWins = a.wins || 0;
            var bWins = b.wins || 0;
            if (bWins !== aWins) return bWins - aWins;
            
            // Tertiary: rep
            var aRep = a.rep || 0;
            var bRep = b.rep || 0;
            if (bRep !== aRep) return bRep - aRep;
            
            // Last resort: random
            return Math.random() - 0.5;
        });
        
        // Trim to bracket size if needed
        if (sorted.length > bracketSize) {
            sorted = sorted.slice(0, bracketSize);
        }
        
        // Assign seeds
        var seededPlayers = [];
        for (var i = 0; i < sorted.length; i++) {
            seededPlayers.push({
                seed: i + 1,
                playerId: sorted[i].playerId || sorted[i].globalId || sorted[i].name,
                name: sorted[i].name || sorted[i].nickname || "Unknown",
                repScore: sorted[i].repScore || 0,
                isBye: false
            });
        }
        
        // Add BYEs for empty slots
        var byeCount = calculateByes(seededPlayers.length, bracketSize);
        for (var j = 0; j < byeCount; j++) {
            seededPlayers.push({
                seed: seededPlayers.length + 1,
                playerId: null,
                name: "BYE",
                repScore: 0,
                isBye: true
            });
        }
        
        // Build initial round matchups (pass created timestamp for deadline calculation)
        var bracketCreatedAt = nowMs();
        var matches = buildFirstRoundMatches(seededPlayers, bracketSize, bracketCreatedAt);
        
        var bracket = {
            id: "playoff_s" + seasonNumber,
            seasonNumber: seasonNumber,
            status: BRACKET_STATUS.ACTIVE,
            bracketSize: bracketSize,
            createdAt: bracketCreatedAt,
            
            // Seeding info
            seeds: seededPlayers,
            
            // All matches (populated as rounds progress)
            matches: matches,
            
            // Current round tracking
            currentRound: getRoundName(bracketSize, 1),
            roundNumber: 1,
            
            // Completion info
            championPlayerId: null,
            championName: null,
            completedAt: null
        };
        
        logPlayoffs("createBracket", "ok", "season=" + seasonNumber + " size=" + bracketSize + " players=" + playerCount);
        
        return bracket;
    }
    
    /**
     * Build first round matches using standard bracket seeding
     * Standard seeding: 1v8, 4v5, 3v6, 2v7 (for 8-team)
     */
    function buildFirstRoundMatches(seededPlayers, bracketSize, bracketCreatedAt) {
        var matches = [];
        var pairings = getFirstRoundPairings(bracketSize);
        var roundName = getRoundName(bracketSize, 1);
        var totalRounds = getTotalRounds(bracketSize);
        
        // Calculate round-based deadlines
        var deadlines = calculateRoundDeadlines(1, totalRounds, bracketCreatedAt);
        
        for (var i = 0; i < pairings.length; i++) {
            var pair = pairings[i];
            var p1 = seededPlayers[pair[0]] || null;
            var p2 = seededPlayers[pair[1]] || null;
            
            var match = {
                id: roundName + "_" + (i + 1),
                round: roundName,
                roundNumber: 1,
                matchNumber: i + 1,
                
                player1: p1,
                player2: p2,
                
                status: MATCH_STATUS.PENDING,
                winner: null,
                loser: null,
                
                score: null,  // { winner: X, loser: Y }
                resolution: null,  // "pvp" | "ghost" | "cpu_sim"
                
                createdAt: nowMs(),
                softDeadline: deadlines.softDeadline,
                hardDeadline: deadlines.hardDeadline,
                completedAt: null
            };
            
            // Handle BYEs - auto-advance
            if (p1 && p1.isBye && p2 && !p2.isBye) {
                match.status = MATCH_STATUS.BYE;
                match.winner = p2;
                match.loser = p1;
                match.resolution = "bye";
                match.completedAt = nowMs();
            } else if (p2 && p2.isBye && p1 && !p1.isBye) {
                match.status = MATCH_STATUS.BYE;
                match.winner = p1;
                match.loser = p2;
                match.resolution = "bye";
                match.completedAt = nowMs();
            } else if (p1 && p1.isBye && p2 && p2.isBye) {
                // Double BYE (shouldn't happen with proper bracket sizing)
                match.status = MATCH_STATUS.BYE;
                match.resolution = "bye";
                match.completedAt = nowMs();
            }
            
            // Initialize scheduling for non-BYE matches
            if (match.status !== MATCH_STATUS.BYE && LORB.Playoffs.Scheduling) {
                LORB.Playoffs.Scheduling.initializeMatchScheduling(match, p1, p2);
            }
            
            matches.push(match);
        }
        
        return matches;
    }
    
    /**
     * Get standard first-round pairings for a bracket size
     * Returns array of [seed1Index, seed2Index] pairs
     */
    function getFirstRoundPairings(bracketSize) {
        switch (bracketSize) {
            case 2:
                return [[0, 1]];  // 1v2
            case 4:
                return [[0, 3], [1, 2]];  // 1v4, 2v3
            case 8:
                return [[0, 7], [3, 4], [2, 5], [1, 6]];  // 1v8, 4v5, 3v6, 2v7
            case 16:
                return [
                    [0, 15], [7, 8], [4, 11], [3, 12],
                    [2, 13], [5, 10], [6, 9], [1, 14]
                ];
            default:
                return [];
        }
    }
    
    /**
     * Get round name based on bracket size and round number
     */
    function getRoundName(bracketSize, roundNumber) {
        var totalRounds = Math.floor(Math.log(bracketSize) / Math.log(2));
        var roundsFromFinal = totalRounds - roundNumber + 1;
        
        switch (roundsFromFinal) {
            case 1: return "finals";
            case 2: return "semifinals";
            case 3: return "quarterfinals";
            case 4: return "round_of_16";
            default: return "round_" + roundNumber;
        }
    }
    
    /**
     * Get total number of rounds for a bracket size
     */
    function getTotalRounds(bracketSize) {
        return Math.floor(Math.log(bracketSize) / Math.log(2));
    }
    
    // ========== BRACKET PERSISTENCE ==========
    
    /**
     * Save a playoff bracket
     */
    function saveBracket(bracket) {
        if (!LORB.Persist) return false;
        
        var path = "playoffBrackets." + bracket.seasonNumber;
        var ok = LORB.Persist.writeShared(path, bracket);
        logPlayoffs("saveBracket", ok ? "ok" : "error", "season=" + bracket.seasonNumber);
        return ok;
    }
    
    /**
     * Load a playoff bracket by season number
     */
    function loadBracket(seasonNumber) {
        if (!LORB.Persist) return null;
        
        var path = "playoffBrackets." + seasonNumber;
        return LORB.Persist.readShared(path);
    }
    
    /**
     * Get the currently active playoff bracket (if any)
     * Returns the OLDEST active bracket (so older playoffs finish first)
     */
    function getActiveBracket() {
        var sharedState = LORB.SharedState ? LORB.SharedState.get() : null;
        if (!sharedState) return null;
        
        // Check for active playoff for previous seasons
        var currentSeason = sharedState.seasonNumber || 1;
        
        // Try to load bracket starting from oldest (season 1) to newest
        // This ensures older playoffs are prioritized for completion
        for (var s = 1; s < currentSeason; s++) {
            var bracket = loadBracket(s);
            if (bracket && bracket.status === BRACKET_STATUS.ACTIVE) {
                return bracket;
            }
        }
        
        return null;
    }
    
    /**
     * Get ALL currently active playoff brackets
     * Returns array sorted by season (oldest first)
     */
    function getAllActiveBrackets() {
        var sharedState = LORB.SharedState ? LORB.SharedState.get() : null;
        if (!sharedState) return [];
        
        var currentSeason = sharedState.seasonNumber || 1;
        var activeBrackets = [];
        
        for (var s = 1; s < currentSeason; s++) {
            var bracket = loadBracket(s);
            if (bracket && bracket.status === BRACKET_STATUS.ACTIVE) {
                activeBrackets.push(bracket);
            }
        }
        
        return activeBrackets;
    }
    
    /**
     * Get the active bracket where a specific player has a pending match
     * Prioritizes oldest bracket (so older playoffs finish first)
     */
    function getActiveBracketForPlayer(playerId) {
        var brackets = getAllActiveBrackets();
        
        for (var b = 0; b < brackets.length; b++) {
            var bracket = brackets[b];
            for (var i = 0; i < bracket.matches.length; i++) {
                var match = bracket.matches[i];
                if (match.status !== MATCH_STATUS.PENDING) continue;
                
                var p1Id = match.player1 ? match.player1.playerId : null;
                var p2Id = match.player2 ? match.player2.playerId : null;
                
                if (p1Id === playerId || p2Id === playerId) {
                    return bracket;
                }
            }
        }
        
        return null;
    }

    /**
     * Get all completed brackets where a player is the champion
     * and still has unclaimed Red Bull challenge attempts.
     * Used to show championship challenges even after playoffs complete.
     * 
     * @param {string} playerId - The player's global ID
     * @returns {Array} Array of { seasonNumber, challengeState } for each claimable championship
     */
    function getPlayerChampionships(playerId) {
        var sharedState = LORB.SharedState ? LORB.SharedState.get() : null;
        if (!sharedState) return [];
        
        var currentSeason = sharedState.seasonNumber || 1;
        var championships = [];
        
        // Check all brackets from season 1 to current
        for (var s = 1; s < currentSeason; s++) {
            var bracket = loadBracket(s);
            if (!bracket) continue;
            
            // Only care about completed brackets where this player is champion
            if (bracket.status !== BRACKET_STATUS.COMPLETED) continue;
            if (bracket.championPlayerId !== playerId) continue;
            
            // Get challenge state for this championship
            var challengeState = getChampionChallengeState(s, playerId);
            
            // Include if they haven't beaten Red Bull or still have tries
            if (!challengeState.redBullDefeated && challengeState.triesRemaining > 0) {
                championships.push({
                    seasonNumber: s,
                    championName: bracket.championName,
                    challengeState: challengeState
                });
            }
        }
        
        return championships;
    }

    // ========== MATCH RESOLUTION ==========
    
    /**
     * Finalize a playoff match result.
     * This is the single codepath for all resolution types (per spec 9.5).
     * 
     * Uses transactional safety: bracket is cloned before modification.
     * If any step fails, the original bracket state is preserved.
     * 
     * @param {string} bracketSeasonNumber - Season number of the bracket
     * @param {string} matchId - Match ID within bracket
     * @param {Object} result - { winnerId, loserId, winnerScore, loserScore, resolution }
     * @returns {Object} Updated bracket or null on error
     */
    function finalizeMatch(bracketSeasonNumber, matchId, result) {
        var originalBracket = loadBracket(bracketSeasonNumber);
        if (!originalBracket) {
            logPlayoffs("finalizeMatch", "error", "bracket_not_found=" + bracketSeasonNumber);
            return null;
        }
        
        // Create a deep clone for transactional safety
        var bracket = cloneBracket(originalBracket);
        if (!bracket) {
            logPlayoffs("finalizeMatch", "error", "clone_failed season=" + bracketSeasonNumber);
            return null;
        }
        
        // Find the match
        var match = null;
        var matchIndex = -1;
        for (var i = 0; i < bracket.matches.length; i++) {
            if (bracket.matches[i].id === matchId) {
                match = bracket.matches[i];
                matchIndex = i;
                break;
            }
        }
        
        if (!match) {
            logPlayoffs("finalizeMatch", "error", "match_not_found=" + matchId);
            return null;
        }
        
        if (match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.BYE) {
            logPlayoffs("finalizeMatch", "skip", "already_completed=" + matchId);
            return originalBracket;
        }
        
        // Determine winner/loser from player IDs
        var p1Id = match.player1 ? match.player1.playerId : null;
        var p2Id = match.player2 ? match.player2.playerId : null;
        
        var winner, loser;
        if (result.winnerId === p1Id) {
            winner = match.player1;
            loser = match.player2;
        } else if (result.winnerId === p2Id) {
            winner = match.player2;
            loser = match.player1;
        } else {
            logPlayoffs("finalizeMatch", "error", "winner_not_in_match=" + result.winnerId);
            return null;
        }
        
        // All modifications happen inside try block for transactional safety
        try {
            // Update match
            match.status = MATCH_STATUS.COMPLETED;
            match.winner = winner;
            match.loser = loser;
            match.score = {
                winner: result.winnerScore || 0,
                loser: result.loserScore || 0
            };
            match.resolution = result.resolution || RESOLUTION.CPU_SIM;
            match.completedAt = nowMs();
            
            bracket.matches[matchIndex] = match;
            
            logPlayoffs("finalizeMatch", "ok", "match=" + matchId + " winner=" + winner.name + " resolution=" + match.resolution);
            
            // Check if round is complete
            var roundComplete = isRoundComplete(bracket, match.roundNumber);
            
            if (roundComplete) {
                var totalRounds = getTotalRounds(bracket.bracketSize);
                
                if (match.roundNumber >= totalRounds) {
                    // Finals complete - we have a champion
                    bracket.status = BRACKET_STATUS.COMPLETED;
                    bracket.championPlayerId = winner.playerId;
                    bracket.championName = winner.name;
                    bracket.completedAt = nowMs();
                    
                    logPlayoffs("bracketComplete", "ok", "champion=" + winner.name);
                    
                    // Apply rewards
                    applyPlayoffRewards(bracket);
                } else {
                    // Advance to next round
                    advanceToNextRound(bracket);
                }
            }
            
            // Save bracket - this is the commit point
            var saved = saveBracket(bracket);
            if (!saved) {
                throw new Error("saveBracket failed");
            }
            
            return bracket;
            
        } catch (e) {
            // Rollback: restore original bracket state
            logPlayoffs("finalizeMatch", "rollback", "match=" + matchId + " error=" + e);
            saveBracket(originalBracket);
            return null;
        }
    }
    
    /**
     * Check if all matches in a round are complete
     */
    function isRoundComplete(bracket, roundNumber) {
        for (var i = 0; i < bracket.matches.length; i++) {
            var match = bracket.matches[i];
            if (match.roundNumber === roundNumber) {
                if (match.status !== MATCH_STATUS.COMPLETED && match.status !== MATCH_STATUS.BYE) {
                    return false;
                }
            }
        }
        return true;
    }
    
    /**
     * Advance bracket to next round, creating new matches from winners
     */
    function advanceToNextRound(bracket) {
        var currentRound = bracket.roundNumber;
        var nextRound = currentRound + 1;
        var nextRoundName = getRoundName(bracket.bracketSize, nextRound);
        
        // Get winners from current round
        var currentRoundMatches = [];
        for (var i = 0; i < bracket.matches.length; i++) {
            if (bracket.matches[i].roundNumber === currentRound) {
                currentRoundMatches.push(bracket.matches[i]);
            }
        }
        
        // Sort by match number to maintain bracket order
        currentRoundMatches.sort(function(a, b) {
            return a.matchNumber - b.matchNumber;
        });
        
        // Create next round matches (pair winners in order)
        var nextRoundMatches = [];
        for (var j = 0; j < currentRoundMatches.length; j += 2) {
            var m1 = currentRoundMatches[j];
            var m2 = currentRoundMatches[j + 1];
            
            if (!m2) break;  // Odd number of matches (shouldn't happen)
            // Calculate deadlines for this round based on bracket creation
            var totalRounds = getTotalRounds(bracket.bracketSize);
            var deadlines = calculateRoundDeadlines(nextRound, totalRounds, bracket.createdAt);
            
            var newMatch = {
                id: nextRoundName + "_" + (nextRoundMatches.length + 1),
                round: nextRoundName,
                roundNumber: nextRound,
                matchNumber: nextRoundMatches.length + 1,
                
                player1: m1.winner,
                player2: m2.winner,
                
                status: MATCH_STATUS.PENDING,
                winner: null,
                loser: null,
                score: null,
                resolution: null,
                
                createdAt: nowMs(),
                softDeadline: deadlines.softDeadline,
                hardDeadline: deadlines.hardDeadline,
                completedAt: null
            };
            
            // Initialize scheduling for the new match
            // Winners carry forward their playoffAvailability from the snapshot
            if (LORB.Playoffs.Scheduling) {
                LORB.Playoffs.Scheduling.initializeMatchScheduling(newMatch, m1.winner, m2.winner);
            }
            
            nextRoundMatches.push(newMatch);
        }
        
        // Add new matches to bracket
        for (var k = 0; k < nextRoundMatches.length; k++) {
            bracket.matches.push(nextRoundMatches[k]);
        }
        
        // Update bracket state
        bracket.currentRound = nextRoundName;
        bracket.roundNumber = nextRound;
        
        logPlayoffs("advanceRound", "ok", "round=" + nextRoundName + " matches=" + nextRoundMatches.length);
    }
    
    /**
     * Apply rewards when bracket completes (per spec 9.5)
     */
    function applyPlayoffRewards(bracket) {
        // Record in Hall of Fame
        if (LORB.Season && LORB.Season.recordHallOfFame) {
            LORB.Season.recordHallOfFame(
                { id: bracket.championPlayerId, name: bracket.championName },
                false,  // defeatedJordan (playoff champion, not Jordan challenger yet)
                bracket.seasonNumber
            );
        }
        
        // Increment the champion's championship counter
        incrementPlayerChampionshipCount(bracket.championPlayerId);
        
        // Post championship news
        postChampionshipNews(bracket.championPlayerId, bracket.championName, bracket.seasonNumber);
        
        logPlayoffs("applyRewards", "ok", "champion=" + bracket.championName);
    }
    
    /**
     * Increment a player's championship wins counter
     */
    function incrementPlayerChampionshipCount(playerId) {
        if (!LORB.Persist) return;
        
        try {
            var allPlayers = LORB.Persist.listPlayers ? LORB.Persist.listPlayers() : [];
            var playerData = null;
            
            for (var i = 0; i < allPlayers.length; i++) {
                if (allPlayers[i].globalId === playerId || allPlayers[i].name === playerId) {
                    playerData = allPlayers[i];
                    break;
                }
            }
            
            if (!playerData) {
                logPlayoffs("incrementChampCount", "warn", "player_not_found=" + playerId);
                return;
            }
            
            // Increment counter
            playerData.championshipWins = (playerData.championshipWins || 0) + 1;
            
            // Save back
            var path = "players." + (playerData.globalId || playerId);
            LORB.Persist.writeShared(path, playerData);
            
            logPlayoffs("incrementChampCount", "ok", "wins=" + playerData.championshipWins);
        } catch (e) {
            logPlayoffs("incrementChampCount", "error", e);
        }
    }
    
    /**
     * Post news about a new champion
     */
    function postChampionshipNews(playerId, playerName, seasonNumber) {
        if (!LORB.Util || !LORB.Util.PvpStats || !LORB.Util.PvpStats.addNews) {
            return;
        }
        
        try {
            var newsEntry = {
                type: "championship",
                timestamp: Date.now(),
                playerName: playerName,
                playerId: playerId,
                seasonNumber: seasonNumber
            };
            
            LORB.Util.PvpStats.addNews(newsEntry);
            logPlayoffs("postChampNews", "ok", "season=" + seasonNumber);
        } catch (e) {
            logPlayoffs("postChampNews", "error", e);
        }
    }

    // ========== MATCH RESOLUTION HELPERS ==========
    
    /**
     * Simulate a match using CPU sim (for deadline-based resolution)
     * Uses existing Season.simulateMatch if available
     */
    function simulateMatchCPU(bracket, matchId) {
        var match = null;
        for (var i = 0; i < bracket.matches.length; i++) {
            if (bracket.matches[i].id === matchId) {
                match = bracket.matches[i];
                break;
            }
        }
        
        if (!match || !match.player1 || !match.player2) {
            return null;
        }
        
        // Load snapshots for both players
        var snap1 = loadSnapshot(bracket.seasonNumber, match.player1.playerId);
        var snap2 = loadSnapshot(bracket.seasonNumber, match.player2.playerId);
        
        // Use Season.simulateMatch if available
        var result;
        if (LORB.Season && LORB.Season.simulateMatch) {
            result = LORB.Season.simulateMatch(
                { player: snap1 || match.player1, repScore: match.player1.repScore },
                { player: snap2 || match.player2, repScore: match.player2.repScore },
                { difficulty: 1.5 }
            );
        } else {
            // Fallback simple simulation
            var p1Prob = 0.5;
            if (match.player1.repScore && match.player2.repScore) {
                var total = match.player1.repScore + match.player2.repScore;
                p1Prob = total > 0 ? match.player1.repScore / total : 0.5;
            }
            p1Prob = (p1Prob * 0.4) + (Math.random() * 0.6);
            
            var p1Wins = Math.random() < p1Prob;
            var winnerScore = 21 + Math.floor(Math.random() * 15);
            var loserScore = Math.max(10, winnerScore - 5 - Math.floor(Math.random() * 10));
            
            result = {
                winnerId: p1Wins ? match.player1.playerId : match.player2.playerId,
                loserId: p1Wins ? match.player2.playerId : match.player1.playerId,
                boxScore: {
                    winnerScore: winnerScore,
                    loserScore: loserScore
                }
            };
        }
        
        // Determine which match player won based on simulation result
        // The simulation returns winnerId based on player.id or player.name,
        // but we need to map back to match.player1.playerId or match.player2.playerId
        var p1Won = false;
        if (result.winnerId) {
            // Check if winnerId matches player1 (by playerId, id, or name)
            p1Won = result.winnerId === match.player1.playerId ||
                    result.winnerId === (snap1 && snap1.id) ||
                    result.winnerId === match.player1.name;
        } else if (result.winner) {
            // Check winner object
            p1Won = result.winner === (snap1 || match.player1) ||
                    result.winner.id === (snap1 && snap1.id) ||
                    result.winner.name === match.player1.name;
        }
        
        var actualWinnerId = p1Won ? match.player1.playerId : match.player2.playerId;
        var actualLoserId = p1Won ? match.player2.playerId : match.player1.playerId;
        
        // Finalize through standard path
        return finalizeMatch(bracket.seasonNumber, matchId, {
            winnerId: actualWinnerId,
            loserId: actualLoserId,
            winnerScore: result.boxScore ? result.boxScore.winnerScore : 21,
            loserScore: result.boxScore ? result.boxScore.loserScore : 15,
            resolution: RESOLUTION.CPU_SIM
        });
    }
    
    /**
     * Check for matches past their deadline and auto-resolve them
     * Hard deadline only - soft deadline allows manual ghost match forcing
     * Checks ALL active brackets, not just the primary one
     */
    function checkAndResolveDeadlines() {
        var brackets = getAllActiveBrackets();
        if (!brackets || brackets.length === 0) return;
        
        var now = nowMs();
        var totalResolved = 0;
        
        for (var b = 0; b < brackets.length; b++) {
            var bracket = brackets[b];
            if (!bracket.matches) continue;
            
            var resolved = 0;
            
            for (var i = 0; i < bracket.matches.length; i++) {
                var match = bracket.matches[i];
                
                if (match.status !== MATCH_STATUS.PENDING) continue;
                
                // Only auto-resolve at hard deadline (CPU sim)
                // Soft deadline just enables the "Force Ghost Match" option
                if (match.hardDeadline && now >= match.hardDeadline) {
                    logPlayoffs("deadline", "hard", "match=" + match.id + " season=" + bracket.seasonNumber);
                    simulateMatchCPU(bracket, match.id);
                    resolved++;
                }
            }
            
            if (resolved > 0) {
                totalResolved += resolved;
                logPlayoffs("deadlineCheck", "resolved", "season=" + bracket.seasonNumber + " count=" + resolved);
            }
        }
        
        if (totalResolved > 0) {
            logPlayoffs("deadlineCheck", "total_resolved", "count=" + totalResolved);
        }
    }
    
    /**
     * Check if a match is past its soft deadline (ghost match can be forced)
     * @param {Object} match - The match to check
     * @returns {boolean} True if past soft deadline
     */
    function isMatchPastSoftDeadline(match) {
        if (!match || !match.softDeadline) return false;
        return nowMs() >= match.softDeadline;
    }
    
    /**
     * Check if a match is past its hard deadline (should be auto-simulated)
     * @param {Object} match - The match to check
     * @returns {boolean} True if past hard deadline
     */
    function isMatchPastHardDeadline(match) {
        if (!match || !match.hardDeadline) return false;
        return nowMs() >= match.hardDeadline;
    }
    
    /**
     * Get time remaining until soft deadline
     * @param {Object} match - The match to check
     * @returns {number} Milliseconds until soft deadline (negative if past)
     */
    function getTimeUntilSoftDeadline(match) {
        if (!match || !match.softDeadline) return 0;
        return match.softDeadline - nowMs();
    }
    
    /**
     * Get all matches in the bracket that are past their soft deadline
     * but not yet resolved - these can be force-resolved by an active player
     * Checks ALL active brackets for matches past soft deadline
     * @returns {Array} Array of unresolved matches past soft deadline (with _bracketSeasonNumber attached)
     */
    function getMatchesPastSoftDeadline() {
        var brackets = getAllActiveBrackets();
        var pastDeadline = [];
        var now = nowMs();
        
        for (var b = 0; b < brackets.length; b++) {
            var bracket = brackets[b];
            for (var i = 0; i < bracket.matches.length; i++) {
                var match = bracket.matches[i];
                if (match.status !== MATCH_STATUS.PENDING) continue;
                
                if (match.softDeadline && now >= match.softDeadline) {
                    match._bracketSeasonNumber = bracket.seasonNumber;
                    pastDeadline.push(match);
                }
            }
        }
        
        return pastDeadline;
    }
    
    /**
     * Check if a waiting player can force-resolve a match via CPU simulation
     * This happens when:
     * 1. Player is NOT in this match (they're waiting in the bracket)
     * 2. Match is past its soft deadline
     * 3. Neither participant has played yet
     * 
     * @param {string} playerId - The player asking
     * @param {Object} match - The match in question
     * @returns {boolean} True if player can force-sim this match
     */
    function canPlayerForceSimMatch(playerId, match) {
        if (!match || match.status !== MATCH_STATUS.PENDING) return false;
        
        // Player must NOT be a participant in this match
        var p1Id = match.player1 ? match.player1.playerId : null;
        var p2Id = match.player2 ? match.player2.playerId : null;
        
        if (p1Id === playerId || p2Id === playerId) return false;
        
        // Match must be past soft deadline
        if (!isMatchPastSoftDeadline(match)) return false;
        
        // The waiting player must have completed their current round
        // (to prevent gaming the system by force-simming opponents early)
        var bracket = getActiveBracket();
        if (!bracket) return false;
        
        // Check if player has a pending match in the same round
        var playerHasPendingInSameRound = false;
        for (var i = 0; i < bracket.matches.length; i++) {
            var m = bracket.matches[i];
            if (m.roundNumber !== match.roundNumber) continue;
            if (m.status !== MATCH_STATUS.PENDING) continue;
            
            var mp1 = m.player1 ? m.player1.playerId : null;
            var mp2 = m.player2 ? m.player2.playerId : null;
            
            if (mp1 === playerId || mp2 === playerId) {
                playerHasPendingInSameRound = true;
                break;
            }
        }
        
        // Can only force-sim if player has completed their match in this round
        return !playerHasPendingInSameRound;
    }
    
    /**
     * Get pending matches for a player across ALL active brackets
     * Returns matches sorted by bracket season (oldest first)
     */
    function getPlayerPendingMatches(playerId) {
        var brackets = getAllActiveBrackets();
        var pending = [];
        
        for (var b = 0; b < brackets.length; b++) {
            var bracket = brackets[b];
            for (var i = 0; i < bracket.matches.length; i++) {
                var match = bracket.matches[i];
                // Include any match that isn't completed or bye
                // This handles "pending", "scheduled", "in_progress", etc.
                if (match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.BYE) continue;
                
                var p1Id = match.player1 ? match.player1.playerId : null;
                var p2Id = match.player2 ? match.player2.playerId : null;
                
                if (p1Id === playerId || p2Id === playerId) {
                    // Attach bracket info to match for context
                    match._bracketSeasonNumber = bracket.seasonNumber;
                    pending.push(match);
                }
            }
        }
        
        return pending;
    }
    
    /**
     * Check if a player is in ANY active playoff bracket
     */
    function isPlayerInPlayoffs(playerId) {
        var brackets = getAllActiveBrackets();
        
        for (var b = 0; b < brackets.length; b++) {
            var bracket = brackets[b];
            for (var i = 0; i < bracket.seeds.length; i++) {
                if (bracket.seeds[i].playerId === playerId && !bracket.seeds[i].isBye) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Get a player's playoff status across all active brackets
     * Returns info about their oldest active playoff (the one they should finish first)
     */
    function getPlayerPlayoffStatus(playerId) {
        var brackets = getAllActiveBrackets();
        if (brackets.length === 0) {
            return { inPlayoffs: false, seasonNumber: null, activeBracketCount: 0 };
        }
        
        var inPlayoffs = isPlayerInPlayoffs(playerId);
        if (!inPlayoffs) {
            return { 
                inPlayoffs: false, 
                seasonNumber: brackets[0].seasonNumber,
                activeBracketCount: brackets.length 
            };
        }
        
        var pending = getPlayerPendingMatches(playerId);
        
        // Find all brackets where this player is active (not eliminated)
        var playerBrackets = [];
        for (var b = 0; b < brackets.length; b++) {
            var bracket = brackets[b];
            var inThisBracket = false;
            var eliminatedInThis = false;
            var championInThis = false;
            
            // Check if player is in this bracket
            for (var s = 0; s < bracket.seeds.length; s++) {
                if (bracket.seeds[s].playerId === playerId && !bracket.seeds[s].isBye) {
                    inThisBracket = true;
                    break;
                }
            }
            
            if (!inThisBracket) continue;
            
            // Check if eliminated in this bracket
            for (var i = 0; i < bracket.matches.length; i++) {
                var match = bracket.matches[i];
                if (match.status !== MATCH_STATUS.COMPLETED) continue;
                
                if (match.loser && match.loser.playerId === playerId) {
                    eliminatedInThis = true;
                    break;
                }
            }
            
            // Check if champion in this bracket
            if (bracket.status === BRACKET_STATUS.COMPLETED && bracket.championPlayerId === playerId) {
                championInThis = true;
            }
            
            playerBrackets.push({
                seasonNumber: bracket.seasonNumber,
                currentRound: bracket.currentRound,
                eliminated: eliminatedInThis,
                champion: championInThis
            });
        }
        
        // Primary bracket is the oldest one where player has a pending match
        var primaryBracket = brackets[0];
        var eliminated = false;
        var champion = false;
        
        for (var pb = 0; pb < playerBrackets.length; pb++) {
            if (!playerBrackets[pb].eliminated && !playerBrackets[pb].champion) {
                // Find the bracket object
                for (var bb = 0; bb < brackets.length; bb++) {
                    if (brackets[bb].seasonNumber === playerBrackets[pb].seasonNumber) {
                        primaryBracket = brackets[bb];
                        break;
                    }
                }
                break;
            }
        }
        
        // Check elimination/champion in primary bracket
        for (var pb2 = 0; pb2 < playerBrackets.length; pb2++) {
            if (playerBrackets[pb2].seasonNumber === primaryBracket.seasonNumber) {
                eliminated = playerBrackets[pb2].eliminated;
                champion = playerBrackets[pb2].champion;
                break;
            }
        }
        
        // Also check for championships in COMPLETED brackets (for Red Bull challenge)
        var championships = getPlayerChampionships(playerId);
        
        return {
            inPlayoffs: true,
            seasonNumber: primaryBracket.seasonNumber,
            currentRound: primaryBracket.currentRound,
            eliminated: eliminated,
            champion: champion,
            pendingMatches: pending,
            hasPendingMatch: pending.length > 0,
            activeBracketCount: brackets.length,
            playerBrackets: playerBrackets,  // All brackets this player is in
            championships: championships     // Completed brackets where player is champion with unclaimed challenges
        };
    }
    
    // ========== SEASON TRANSITION ==========
    
    /**
     * Trigger the parallel season transition (per spec 3.1)
     * Called when Season N regular season ends.
     * 
     * @returns {Object} { newSeasonNumber, bracket }
     */
    function transitionSeason() {
        var sharedState = LORB.SharedState ? LORB.SharedState.get() : null;
        if (!sharedState) {
            logPlayoffs("transitionSeason", "error", "no_shared_state");
            return null;
        }
        
        var endingSeasonNumber = sharedState.seasonNumber || 1;
        
        logPlayoffs("transitionSeason", "start", "endingSeason=" + endingSeasonNumber);
        
        // 1. Get all players and create snapshots for ELIGIBLE players only
        var allPlayers = LORB.Persist ? LORB.Persist.listPlayers() : [];
        var minPlayers = PlayoffConfig.MIN_PLAYERS_FOR_PLAYOFFS || 2;
        var eligibility = PlayoffConfig.ELIGIBILITY || { MIN_GAMES_PLAYED: 1, MIN_REP: 0 };
        
        var snapshots = [];
        var ineligibleCount = 0;
        
        for (var i = 0; i < allPlayers.length; i++) {
            var player = allPlayers[i];
            
            // Skip inactive/deleted players
            if (player.deleted || player.inactive) continue;
            
            // Check eligibility - must meet at least one criterion
            var gamesPlayed = (player.wins || 0) + (player.losses || 0);
            var playerRep = player.rep || 0;
            
            var meetsGamesReq = eligibility.MIN_GAMES_PLAYED > 0 && gamesPlayed >= eligibility.MIN_GAMES_PLAYED;
            var meetsRepReq = eligibility.MIN_REP > 0 && playerRep >= eligibility.MIN_REP;
            
            // If both requirements are disabled (set to 0), player is eligible
            var bothDisabled = eligibility.MIN_GAMES_PLAYED <= 0 && eligibility.MIN_REP <= 0;
            
            if (!meetsGamesReq && !meetsRepReq && !bothDisabled) {
                // Player didn't play enough this season
                logPlayoffs("transitionSeason", "ineligible", 
                    "player=" + (player.globalId || player.name) + 
                    " games=" + gamesPlayed + 
                    " rep=" + playerRep);
                ineligibleCount++;
                continue;
            }
            
            var snapshot = createPlayerSnapshot(player, endingSeasonNumber);
            saveSnapshot(snapshot);
            snapshots.push(snapshot);
        }
        
        logPlayoffs("transitionSeason", "snapshots_created", 
            "eligible=" + snapshots.length + " ineligible=" + ineligibleCount);
        
        // 2. Create playoff bracket if enough players
        var bracket = null;
        if (snapshots.length >= minPlayers) {
            bracket = createBracket(endingSeasonNumber, snapshots);
            if (bracket) {
                saveBracket(bracket);
            }
        } else {
            logPlayoffs("transitionSeason", "no_playoffs", "players=" + snapshots.length + " min=" + minPlayers);
        }
        
        // 3. Start new season (Season N+1)
        // Use SharedState.resetSeason to increment season number
        var resetInfo = { name: "Season " + endingSeasonNumber + " End", globalId: null };
        LORB.SharedState.resetSeason(resetInfo);
        
        var newSeasonNumber = (sharedState.seasonNumber || 1) + 1;
        
        logPlayoffs("transitionSeason", "complete", "newSeason=" + newSeasonNumber + " bracket=" + (bracket ? "created" : "none"));
        
        return {
            endedSeasonNumber: endingSeasonNumber,
            newSeasonNumber: newSeasonNumber,
            bracket: bracket,
            playerCount: snapshots.length,
            ineligibleCount: ineligibleCount
        };
    }
    
    /**
     * Migrate existing bracket to use round-based deadlines
     * Call this on brackets created before the deadline system change
     */
    function migrateDeadlines(bracket) {
        if (!bracket || !bracket.matches) return false;
        
        var totalRounds = getTotalRounds(bracket.bracketSize);
        var updated = 0;
        
        for (var i = 0; i < bracket.matches.length; i++) {
            var match = bracket.matches[i];
            
            // Only update pending matches
            if (match.status !== MATCH_STATUS.PENDING) continue;
            
            var deadlines = calculateRoundDeadlines(match.roundNumber, totalRounds, bracket.createdAt);
            match.softDeadline = deadlines.softDeadline;
            match.hardDeadline = deadlines.hardDeadline;
            updated++;
        }
        
        if (updated > 0) {
            saveBracket(bracket);
            logPlayoffs("migrateDeadlines", "ok", "updated=" + updated);
        }
        
        return updated > 0;
    }
    
    /**
     * Auto-migrate active bracket on load if deadlines look like old format
     * Old format used fixed hours (72/168), new format scales with season
     */
    function autoMigrateIfNeeded() {
        var bracket = getActiveBracket();
        if (!bracket || !bracket.matches || bracket.matches.length === 0) return;
        
        // Check if any pending match has the old-style deadline (way past season end)
        var seasonLengthMs = daysToMs(Config.SEASON_LENGTH_DAYS || 30);
        var maxReasonableDeadline = bracket.createdAt + (seasonLengthMs * 2); // 2x season length
        
        for (var i = 0; i < bracket.matches.length; i++) {
            var match = bracket.matches[i];
            if (match.status !== MATCH_STATUS.PENDING) continue;
            
            // If soft deadline is way past what round-based would give, migrate
            if (match.softDeadline && match.softDeadline > maxReasonableDeadline) {
                logPlayoffs("autoMigrate", "triggered", "old_deadline_detected");
                migrateDeadlines(bracket);
                return;
            }
        }
    }
    
    // ========== CHAMPION CHALLENGE STATE ==========
    
    /**
     * Get the challenge state for a champion in a completed bracket.
     * Returns tries used, victories, etc.
     * 
     * @param {number} seasonNumber - The season bracket number
     * @param {string} playerId - The champion's player ID
     * @returns {Object} Challenge state { triesUsed, maxTries, jordanDefeated, redBullDefeated }
     */
    function getChampionChallengeState(seasonNumber, playerId) {
        var bracket = loadBracket(seasonNumber);
        if (!bracket) {
            return { triesUsed: 0, maxTries: 3, jordanDefeated: false, redBullDefeated: false };
        }
        
        // Check if this player is the champion
        if (bracket.championPlayerId !== playerId) {
            return { triesUsed: 0, maxTries: 3, jordanDefeated: false, redBullDefeated: false, notChampion: true };
        }
        
        // Challenge state stored on bracket
        if (!bracket.challengeState) {
            bracket.challengeState = {};
        }
        
        var state = bracket.challengeState[playerId] || {
            triesUsed: 0,
            jordanDefeated: false,
            redBullDefeated: false,
            victories: []  // Array of { timestamp, beatJordan, beatRedBull }
        };
        
        return {
            triesUsed: state.triesUsed || 0,
            maxTries: 3,
            triesRemaining: 3 - (state.triesUsed || 0),
            jordanDefeated: state.jordanDefeated || false,
            redBullDefeated: state.redBullDefeated || false,
            victories: state.victories || []
        };
    }
    
    /**
     * Record a challenge attempt by the champion.
     * Uses transactional safety with clone and rollback on failure.
     * 
     * @param {number} seasonNumber - The season bracket number
     * @param {string} playerId - The champion's player ID
     * @param {Object} result - { beatJordan, beatRedBull }
     * @returns {boolean} Success
     */
    function recordChallengeAttempt(seasonNumber, playerId, result) {
        var originalBracket = loadBracket(seasonNumber);
        if (!originalBracket || originalBracket.championPlayerId !== playerId) {
            logPlayoffs("recordChallenge", "error", "not_champion_or_no_bracket");
            return false;
        }
        
        // Clone for transactional safety
        var bracket = cloneBracket(originalBracket);
        if (!bracket) {
            logPlayoffs("recordChallenge", "error", "clone_failed");
            return false;
        }
        
        try {
            if (!bracket.challengeState) {
                bracket.challengeState = {};
            }
            
            if (!bracket.challengeState[playerId]) {
                bracket.challengeState[playerId] = {
                    triesUsed: 0,
                    jordanDefeated: false,
                    redBullDefeated: false,
                    victories: []
                };
            }
            
            var state = bracket.challengeState[playerId];
            state.triesUsed = (state.triesUsed || 0) + 1;
            
            if (result.beatJordan) {
                state.jordanDefeated = true;
            }
            if (result.beatRedBull) {
                state.redBullDefeated = true;
                state.victories.push({
                    timestamp: nowMs(),
                    seasonNumber: seasonNumber
                });
            }
            
            var saved = saveBracket(bracket);
            if (!saved) {
                throw new Error("saveBracket failed");
            }
            
            logPlayoffs("recordChallenge", "ok", "season=" + seasonNumber + " tries=" + state.triesUsed + 
                " jordan=" + state.jordanDefeated + " redBull=" + state.redBullDefeated);
            
            return true;
            
        } catch (e) {
            logPlayoffs("recordChallenge", "rollback", "season=" + seasonNumber + " error=" + e);
            saveBracket(originalBracket);
            return false;
        }
    }
    
    /**
     * Check if a champion can still challenge (has tries remaining and hasn't beaten Red Bull).
     * 
     * @param {number} seasonNumber - The season bracket number
     * @param {string} playerId - The champion's player ID
     * @returns {boolean} Whether challenge is available
     */
    function canChampionChallenge(seasonNumber, playerId) {
        var state = getChampionChallengeState(seasonNumber, playerId);
        
        // Already beaten Red Bull - no need to challenge again (but allow for Hall of Fame tracking)
        if (state.redBullDefeated) {
            return false;
        }
        
        // Check tries remaining
        return state.triesRemaining > 0;
    }
    
    // ========== PUBLIC API ==========
    
    LORB.Playoffs = {
        // Snapshot management
        createPlayerSnapshot: createPlayerSnapshot,
        saveSnapshot: saveSnapshot,
        loadSnapshot: loadSnapshot,
        loadSeasonSnapshots: loadSeasonSnapshots,
        
        // Eligibility
        isPlayerEligible: isPlayerEligible,
        
        // Bracket management
        createBracket: createBracket,
        saveBracket: saveBracket,
        loadBracket: loadBracket,
        getActiveBracket: getActiveBracket,
        getAllActiveBrackets: getAllActiveBrackets,
        getActiveBracketForPlayer: getActiveBracketForPlayer,
        
        // Match resolution
        finalizeMatch: finalizeMatch,
        simulateMatchCPU: simulateMatchCPU,
        checkAndResolveDeadlines: checkAndResolveDeadlines,
        
        // Deadline helpers
        isMatchPastSoftDeadline: isMatchPastSoftDeadline,
        isMatchPastHardDeadline: isMatchPastHardDeadline,
        getTimeUntilSoftDeadline: getTimeUntilSoftDeadline,
        getMatchesPastSoftDeadline: getMatchesPastSoftDeadline,
        canPlayerForceSimMatch: canPlayerForceSimMatch,
        calculateRoundDeadlines: calculateRoundDeadlines,
        migrateDeadlines: migrateDeadlines,
        autoMigrateIfNeeded: autoMigrateIfNeeded,
        
        // Player queries
        isPlayerInPlayoffs: isPlayerInPlayoffs,
        getPlayerPlayoffStatus: getPlayerPlayoffStatus,
        getPlayerPendingMatches: getPlayerPendingMatches,
        getPlayerChampionships: getPlayerChampionships,
        
        // Champion challenge
        getChampionChallengeState: getChampionChallengeState,
        recordChallengeAttempt: recordChallengeAttempt,
        canChampionChallenge: canChampionChallenge,
        
        // Season transition
        transitionSeason: transitionSeason,
        
        // Utilities
        getBracketSize: getBracketSize,
        getRoundName: getRoundName,
        getTotalRounds: getTotalRounds,
        
        // Constants (for external use)
        SEASON_STATUS: SEASON_STATUS,
        BRACKET_STATUS: BRACKET_STATUS,
        MATCH_STATUS: MATCH_STATUS,
        RESOLUTION: RESOLUTION
    };
    
})();
