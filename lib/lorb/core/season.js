/**
 * LORB Season System
 * 
 * Handles the complete season cycle:
 * - Regular Season (leveling, battles, rep accumulation)
 * - Playoff Qualification (top players by REP SCORE)
 * - Playoff Bracket (CPU-sim matches)
 * - Finals (determine Season Champion)
 * - Jordan Challenge (Champion vs The Red Bull)
 * - Season Reset (world wipe + meta progression)
 * 
 * All playoff matches run as CPU simulations using the NBA Jam engine.
 */
(function() {
    
    var Config = LORB.Config;
    
    // ========== REP SCORE CALCULATION ==========
    
    /**
     * Calculate a player's REP SCORE for playoff seeding
     * Higher score = better seed
     * 
     * @param {Object} player - Player context object
     * @returns {number} REP SCORE
     */
    function calculateRepScore(player) {
        var weights = Config.REP_SCORE;
        
        var reputation = player.rep || 0;
        var wins = player.wins || 0;
        var bossVictories = player.bossVictories || 0;
        var rareEncounters = player.rareEncounters || 0;
        var winStreak = player.winStreak || 0;
        var hasCompanionSynergy = player.companionSynergy || false;
        
        var score = 0;
        
        // Base components
        score += reputation * weights.REP_MULTIPLIER;
        score += wins * weights.WIN_MULTIPLIER;
        score += bossVictories * weights.BOSS_VICTORY_BONUS;
        score += rareEncounters * weights.RARE_ENCOUNTER_BONUS;
        
        // Streak bonus (capped)
        var streakBonus = Math.min(winStreak * weights.WIN_STREAK_BONUS_PER, weights.MAX_STREAK_BONUS);
        score += streakBonus;
        
        // Companion synergy
        if (hasCompanionSynergy) {
            score += weights.COMPANION_SYNERGY_BONUS;
        }
        
        return Math.floor(score);
    }
    
    /**
     * Get top N players by REP SCORE
     * 
     * @param {number} count - Number of players to return
     * @returns {Array} Array of { player, repScore } sorted descending
     */
    function getTopPlayersByRepScore(count) {
        count = count || Config.PLAYOFF_BRACKET_SIZE;
        
        var allPlayers = LORB.Persist.listPlayers();
        
        // Calculate REP SCORE for each
        var scored = [];
        for (var i = 0; i < allPlayers.length; i++) {
            var p = allPlayers[i];
            // Skip inactive or deleted players
            if (p.deleted || p.inactive) continue;
            
            scored.push({
                player: p,
                repScore: calculateRepScore(p)
            });
        }
        
        // Sort by REP SCORE descending
        scored.sort(function(a, b) {
            return b.repScore - a.repScore;
        });
        
        // Return top N
        return scored.slice(0, count);
    }
    
    // ========== GHOST PLAYERS ==========
    
    /**
     * Create a ghost player to fill an empty bracket slot
     * Ghost players are CPU-controlled with generated stats
     * 
     * @param {number} seed - Seed position (1-8)
     * @param {number} avgRepScore - Average rep score of human players (for scaling)
     * @returns {Object} Ghost player object
     */
    function createGhostPlayer(seed, avgRepScore) {
        var names = Config.GHOST_PLAYER_NAMES;
        var name = names[(seed - 1) % names.length];
        
        // Ghost difficulty scales inversely with seed (lower seed = tougher)
        var difficultyScale = 1.0 - ((seed - 1) * 0.08); // Seed 1 = 1.0, Seed 8 = 0.44
        
        // Generate stats based on average player level
        var baseStats = {
            speed: 5,
            power: 5,
            threePoint: 5,
            dunk: 5,
            steal: 5,
            block: 5
        };
        
        // Scale stats by difficulty
        for (var stat in baseStats) {
            if (baseStats.hasOwnProperty(stat)) {
                baseStats[stat] = Math.floor(baseStats[stat] * difficultyScale * 1.5);
                if (baseStats[stat] < 3) baseStats[stat] = 3;
                if (baseStats[stat] > 10) baseStats[stat] = 10;
            }
        }
        
        return {
            id: "ghost_" + seed,
            isGhost: true,
            name: name,
            displayName: name,
            stats: baseStats,
            repScore: Math.floor(avgRepScore * difficultyScale),
            seed: seed,
            aiProfile: selectGhostAiProfile(seed)
        };
    }
    
    /**
     * Select an AI profile for a ghost player
     */
    function selectGhostAiProfile(seed) {
        var profiles = ["balanced", "aggressive_shooter", "defensive", "slasher"];
        return profiles[(seed - 1) % profiles.length];
    }
    
    /**
     * Fill bracket with ghost players if not enough humans
     * 
     * @param {Array} humanPlayers - Array of { player, repScore }
     * @param {number} bracketSize - Target bracket size
     * @returns {Array} Full bracket with humans and ghosts
     */
    function fillBracketWithGhosts(humanPlayers, bracketSize) {
        bracketSize = bracketSize || Config.PLAYOFF_BRACKET_SIZE;
        
        // Calculate average rep score for ghost scaling
        var totalRep = 0;
        for (var i = 0; i < humanPlayers.length; i++) {
            totalRep += humanPlayers[i].repScore;
        }
        var avgRep = humanPlayers.length > 0 ? Math.floor(totalRep / humanPlayers.length) : 100;
        
        // Start with human players
        var bracket = humanPlayers.slice(0, bracketSize);
        
        // Fill remaining slots with ghosts
        var nextSeed = bracket.length + 1;
        while (bracket.length < bracketSize) {
            bracket.push({
                player: createGhostPlayer(nextSeed, avgRep),
                repScore: createGhostPlayer(nextSeed, avgRep).repScore,
                isGhost: true
            });
            nextSeed++;
        }
        
        return bracket;
    }
    
    // ========== BRACKET SYSTEM ==========
    
    /**
     * Build a single-elimination bracket from seeded players
     * Standard 8-seed format:
     *   QF: 1v8, 4v5, 3v6, 2v7
     *   SF: Winner(1v8) vs Winner(4v5), Winner(3v6) vs Winner(2v7)
     *   Finals: SF winners
     * 
     * @param {Array} seededPlayers - Array of { player, repScore } in seed order
     * @returns {Object} Bracket structure
     */
    function buildBracket(seededPlayers) {
        var bracket = {
            round: "quarterfinals",
            matches: [],
            results: [],
            champion: null,
            jordanResult: null
        };
        
        // Standard 8-seed matchups
        var qfMatchups = [
            [0, 7],  // 1 vs 8
            [3, 4],  // 4 vs 5
            [2, 5],  // 3 vs 6
            [1, 6]   // 2 vs 7
        ];
        
        for (var i = 0; i < qfMatchups.length; i++) {
            var matchup = qfMatchups[i];
            bracket.matches.push({
                id: "QF" + (i + 1),
                round: "quarterfinals",
                player1: seededPlayers[matchup[0]],
                player2: seededPlayers[matchup[1]],
                winner: null,
                boxScore: null
            });
        }
        
        return bracket;
    }
    
    /**
     * Simulate a single playoff match using the NBA Jam engine
     * 
     * @param {Object} player1 - First player/ghost
     * @param {Object} player2 - Second player/ghost
     * @param {Object} options - Simulation options
     * @returns {Object} Match result { winnerId, loserId, boxScore }
     */
    function simulateMatch(player1, player2, options) {
        options = options || {};
        var difficulty = options.difficulty || Config.AI_DIFFICULTY.PLAYOFF_DIFFICULTY;
        
        // Get actual player objects
        var p1 = player1.player || player1;
        var p2 = player2.player || player2;
        
        // Calculate win probability based on REP scores and stats
        var p1Score = player1.repScore || calculateRepScore(p1);
        var p2Score = player2.repScore || calculateRepScore(p2);
        
        // Base probability from rep score difference
        var totalScore = p1Score + p2Score;
        var p1WinProb = totalScore > 0 ? (p1Score / totalScore) : 0.5;
        
        // Add some randomness (40% skill, 60% random for exciting upsets)
        p1WinProb = (p1WinProb * 0.4) + (Math.random() * 0.6);
        
        // Apply any difficulty modifiers
        if (options.winProbabilityPenalty && options.challengerIsP1) {
            p1WinProb -= options.winProbabilityPenalty;
        } else if (options.winProbabilityPenalty && !options.challengerIsP1) {
            p1WinProb += options.winProbabilityPenalty;
        }
        
        // Clamp probability
        if (p1WinProb < 0.1) p1WinProb = 0.1;
        if (p1WinProb > 0.9) p1WinProb = 0.9;
        
        // Determine winner
        var p1Wins = Math.random() < p1WinProb;
        
        // Generate box score (simplified)
        var winnerScore = 21 + Math.floor(Math.random() * 15); // 21-35
        var loserScore = Math.max(10, winnerScore - 5 - Math.floor(Math.random() * 10)); // Winner by 5-15
        
        return {
            winnerId: p1Wins ? (p1.id || p1.name) : (p2.id || p2.name),
            loserId: p1Wins ? (p2.id || p2.name) : (p1.id || p1.name),
            winner: p1Wins ? p1 : p2,
            loser: p1Wins ? p2 : p1,
            boxScore: {
                winnerScore: winnerScore,
                loserScore: loserScore,
                winnerName: p1Wins ? (p1.name || p1.displayName) : (p2.name || p2.displayName),
                loserName: p1Wins ? (p2.name || p2.displayName) : (p1.name || p1.displayName)
            }
        };
    }
    
    /**
     * Run all matches in a bracket round
     * 
     * @param {Object} bracket - Bracket structure
     * @param {string} round - Round name (quarterfinals, semifinals, finals)
     * @returns {Array} Winners of this round
     */
    function runBracketRound(bracket, round) {
        var roundMatches = [];
        for (var i = 0; i < bracket.matches.length; i++) {
            if (bracket.matches[i].round === round && !bracket.matches[i].winner) {
                roundMatches.push(bracket.matches[i]);
            }
        }
        
        var winners = [];
        for (var j = 0; j < roundMatches.length; j++) {
            var match = roundMatches[j];
            var result = simulateMatch(match.player1, match.player2, {
                difficulty: Config.AI_DIFFICULTY.PLAYOFF_DIFFICULTY
            });
            
            match.winner = result.winner;
            match.boxScore = result.boxScore;
            bracket.results.push({
                matchId: match.id,
                round: round,
                result: result
            });
            
            winners.push({
                player: result.winner,
                repScore: match.player1.player === result.winner ? match.player1.repScore : match.player2.repScore
            });
        }
        
        return winners;
    }
    
    /**
     * Run the entire playoff bracket (QF → SF → Finals)
     * 
     * @param {Object} bracket - Initial bracket from buildBracket()
     * @returns {Object} Completed bracket with champion
     */
    function runFullBracket(bracket) {
        // Quarterfinals
        var qfWinners = runBracketRound(bracket, "quarterfinals");
        
        // Build semifinals
        bracket.matches.push({
            id: "SF1",
            round: "semifinals",
            player1: qfWinners[0],
            player2: qfWinners[1],
            winner: null,
            boxScore: null
        });
        bracket.matches.push({
            id: "SF2",
            round: "semifinals",
            player1: qfWinners[2],
            player2: qfWinners[3],
            winner: null,
            boxScore: null
        });
        
        // Semifinals
        var sfWinners = runBracketRound(bracket, "semifinals");
        
        // Build finals
        bracket.matches.push({
            id: "FINALS",
            round: "finals",
            player1: sfWinners[0],
            player2: sfWinners[1],
            winner: null,
            boxScore: null
        });
        
        // Finals
        var finalsWinners = runBracketRound(bracket, "finals");
        bracket.champion = finalsWinners[0].player;
        
        return bracket;
    }
    
    // ========== JORDAN CHALLENGE ==========
    
    /**
     * Create the Jordan boss opponent
     * 
     * @returns {Object} Jordan boss player object
     */
    function createJordanBoss() {
        var jordanConfig = Config.JORDAN_BOSS;
        
        return {
            id: "jordan_boss",
            isJordan: true,
            name: jordanConfig.NAME,
            displayName: jordanConfig.NAME + " - " + jordanConfig.TITLE,
            stats: {
                // Jordan's stats are all maxed
                speed: 10,
                power: 9,
                threePoint: 9,
                dunk: 10,
                steal: 9,
                block: 8
            },
            difficulty: jordanConfig.DIFFICULTY_OVERRIDE,
            loreIntro: jordanConfig.LORE_INTRO,
            loreWin: jordanConfig.LORE_WIN,
            loreLoss: jordanConfig.LORE_LOSS
        };
    }
    
    /**
     * Run the Jordan Challenge - Champion vs The Red Bull
     * 
     * @param {Object} champion - Season champion player
     * @returns {Object} Challenge result
     */
    function runJordanChallenge(champion) {
        var jordan = createJordanBoss();
        var jordanConfig = Config.JORDAN_BOSS;
        
        var result = simulateMatch(
            { player: champion, repScore: calculateRepScore(champion) },
            { player: jordan, repScore: 9999 },  // Jordan has "infinite" rep
            {
                difficulty: jordanConfig.DIFFICULTY_OVERRIDE,
                winProbabilityPenalty: jordanConfig.WIN_PROBABILITY_PENALTY,
                challengerIsP1: true
            }
        );
        
        return {
            champion: champion,
            jordan: jordan,
            championWon: result.winner === champion,
            boxScore: result.boxScore,
            lore: result.winner === champion ? jordan.loreWin : jordan.loreLoss
        };
    }
    
    // ========== HALL OF FAME ==========
    
    /**
     * Record a Hall of Fame entry
     * 
     * @param {Object} champion - Champion player
     * @param {boolean} defeatedJordan - Whether they beat Jordan
     * @param {number} seasonNumber - Season number
     */
    function recordHallOfFame(champion, defeatedJordan, seasonNumber) {
        var entry = {
            seasonNumber: seasonNumber,
            championId: champion.id || champion.name,
            championName: champion.name || champion.displayName,
            defeatedJordan: defeatedJordan,
            timestamp: Date.now(),
            date: new Date().toISOString()
        };
        
        // Load existing hall of fame from shared state
        var sharedState = LORB.SharedState.get() || {};
        var hallOfFame = sharedState.hallOfFame || [];
        
        // Append entry
        hallOfFame.push(entry);
        
        // Save via SharedState (write directly to the shared state object)
        sharedState.hallOfFame = hallOfFame;
        if (LORB.Persist && LORB.Persist.writeShared) {
            LORB.Persist.writeShared("lorb.sharedState", sharedState);
        }
        
        return entry;
    }
    
    /**
     * Get all Hall of Fame entries
     * 
     * @returns {Array} Hall of Fame entries
     */
    function getHallOfFame() {
        var sharedState = LORB.SharedState.get() || {};
        return sharedState.hallOfFame || [];
    }
    
    // ========== SEASON RESET ==========
    
    /**
     * Apply meta rewards to a player who beat Jordan
     * 
     * @param {Object} player - Player to reward
     */
    function applyJordanVictoryRewards(player) {
        var rewards = Config.META_REWARDS.JORDAN_VICTORY;
        
        // Initialize meta progression if needed
        if (!player.meta) {
            player.meta = {
                statCapBonus: 0,
                trainingEfficiency: 1.0,
                startingCashBonus: 0,
                titles: [],
                jordanVictories: 0
            };
        }
        
        // Apply rewards
        player.meta.statCapBonus += rewards.STAT_CAP_INCREASE;
        player.meta.trainingEfficiency += rewards.TRAINING_EFFICIENCY;
        player.meta.startingCashBonus += rewards.STARTING_CASH_BONUS;
        player.meta.jordanVictories += 1;
        
        // Add Bull-Slayer title
        if (player.meta.titles.indexOf("Bull-Slayer") === -1) {
            player.meta.titles.push("Bull-Slayer");
        }
        
        // Save player
        LORB.Persist.save(player);
    }
    
    /**
     * Reset the season world state
     * Preserves meta progression and Hall of Fame
     */
    function resetSeasonWorldState() {
        // Get current season info from SharedState
        var sharedState = LORB.SharedState.get() || {};
        var currentSeason = sharedState.seasonNumber || 1;
        
        // Get all players using listPlayers
        var allPlayers = LORB.Persist.listPlayers();
        
        // Note: We can't directly reset players from listPlayers results
        // because we don't have the full context with _user
        // The reset will happen when each player next logs in
        // For now, we update the shared state to indicate reset needed
        
        // Reset shared state using SharedState.resetSeason
        var championInfo = {
            name: "Season Reset",
            globalId: null
        };
        LORB.SharedState.resetSeason(championInfo);
        
        // NOTE: Romance, marriages, baby mamas, and baby ballers persist across seasons.
        // Do NOT clear lorb.marriages or call clearMarriageRegistry() here.
        // Family/relationship data is permanent progression.
        
        // Log the reset
        if (typeof log === "function") {
            log(LOG_INFO, "[SEASON] World reset complete. Now entering Season " + (currentSeason + 1));
        }
    }
    
    // ========== MAIN SEASON FLOW ==========
    
    /**
     * Check if the regular season has ended
     * 
     * @returns {boolean} True if season length reached
     */
    function isSeasonComplete() {
        var currentDay = LORB.SharedState.getGameDay ? LORB.SharedState.getGameDay() : 1;
        return currentDay >= Config.SEASON_LENGTH_DAYS;
    }
    
    /**
     * Get current season number
     * 
     * @returns {number} Season number
     */
    function getSeasonNumber() {
        var sharedState = LORB.SharedState.get() || {};
        return sharedState.seasonNumber || 1;
    }
    
    /**
     * Run the complete end-of-season flow
     * 
     * @returns {Object} Season results
     */
    function runEndOfSeason() {
        var seasonNumber = getSeasonNumber();
        
        // Get top players
        var topPlayers = getTopPlayersByRepScore(Config.PLAYOFF_BRACKET_SIZE);
        
        // Fill with ghosts if needed
        var fullBracket = fillBracketWithGhosts(topPlayers, Config.PLAYOFF_BRACKET_SIZE);
        
        // Build bracket
        var bracket = buildBracket(fullBracket);
        
        // Run playoffs
        bracket = runFullBracket(bracket);
        
        // Jordan Challenge
        var jordanResult = runJordanChallenge(bracket.champion);
        bracket.jordanResult = jordanResult;
        
        // Record Hall of Fame
        var hofEntry = recordHallOfFame(
            bracket.champion,
            jordanResult.championWon,
            seasonNumber
        );
        
        // Apply Jordan victory rewards if champion won
        if (jordanResult.championWon) {
            applyJordanVictoryRewards(bracket.champion);
        }
        
        // Reset world state
        resetSeasonWorldState();
        
        return {
            seasonNumber: seasonNumber,
            bracket: bracket,
            champion: bracket.champion,
            jordanResult: jordanResult,
            hofEntry: hofEntry
        };
    }
    
    // ========== AI DIFFICULTY HELPERS ==========
    
    /**
     * Get AI difficulty for a given court tier
     * Delegates to the main DifficultyScaling module if available
     * 
     * @param {number} tier - Court tier (1-5+)
     * @returns {number} Difficulty tier (for use with DifficultyScaling)
     */
    function getCourtDifficulty(tier) {
        tier = tier || 1;
        if (tier < 1) tier = 1;
        if (tier > 5) tier = 5;
        return tier;
    }
    
    /**
     * Get difficulty modifiers for a tier
     * Delegates to DifficultyScaling module if available
     * 
     * @param {number} tier - Difficulty tier (1-5 or "playoff" or "jordan")
     * @returns {Object} Difficulty modifiers
     */
    function getDifficultyModifiers(tier) {
        // Use the main DifficultyScaling module if available
        if (typeof DifficultyScaling !== "undefined" && DifficultyScaling.getDifficultyModifiers) {
            return DifficultyScaling.getDifficultyModifiers(tier);
        }
        
        // Fallback to simple multiplier-based system
        var config = Config.AI_DIFFICULTY;
        var multiplier = config.BASE_DIFFICULTY + ((tier - 1) * config.TIER_INCREMENT);
        var baseModifiers = config.MODIFIERS;
        return {
            shotQuality: baseModifiers.SHOT_QUALITY_SCALE * multiplier,
            reactionSpeed: baseModifiers.REACTION_SPEED_SCALE * multiplier,
            passAccuracy: baseModifiers.PASS_ACCURACY_SCALE * multiplier,
            defenseIQ: baseModifiers.DEFENSE_IQ_SCALE * multiplier
        };
    }
    
    // ========== PUBLIC API ==========
    
    LORB.Season = {
        // REP Score
        calculateRepScore: calculateRepScore,
        getTopPlayersByRepScore: getTopPlayersByRepScore,
        
        // Bracket
        buildBracket: buildBracket,
        runBracketRound: runBracketRound,
        runFullBracket: runFullBracket,
        simulateMatch: simulateMatch,
        
        // Ghosts
        createGhostPlayer: createGhostPlayer,
        fillBracketWithGhosts: fillBracketWithGhosts,
        
        // Jordan
        createJordanBoss: createJordanBoss,
        runJordanChallenge: runJordanChallenge,
        
        // Hall of Fame
        recordHallOfFame: recordHallOfFame,
        getHallOfFame: getHallOfFame,
        
        // Season Management
        isSeasonComplete: isSeasonComplete,
        getSeasonNumber: getSeasonNumber,
        runEndOfSeason: runEndOfSeason,
        resetSeasonWorldState: resetSeasonWorldState,
        applyJordanVictoryRewards: applyJordanVictoryRewards,
        
        // AI Difficulty
        getCourtDifficulty: getCourtDifficulty,
        getDifficultyModifiers: getDifficultyModifiers
    };
    
})();
