/**
 * daily_matchups.js - Daily NBA Game Generation for Club 23 Betting
 * 
 * Generates a deterministic set of NBA games for each day using the day number
 * as a seed. Each game pairs two NBA teams with 2 players each.
 */
(function() {
    var ROOT = (typeof js !== "undefined" && js.exec_dir) ? js.exec_dir : "./";
    var ROSTERS_PATH = ROOT + "lib/config/rosters.ini";
    
    // Cached data
    var TEAMS_CACHE = null;
    var PLAYERS_BY_TEAM = null;
    
    // All 30 NBA team keys (must match rosters.ini section names)
    var NBA_TEAM_KEYS = [
        "hawks", "celtics", "nets", "hornets", "bulls",
        "cavaliers", "mavericks", "nuggets", "pistons", "warriors",
        "rockets", "pacers", "clippers", "lakers", "grizzlies",
        "heat", "bucks", "timberwolves", "pelicans", "knicks",
        "thunder", "magic", "sixers", "suns", "blazers",
        "kings", "spurs", "raptors", "jazz", "wizards"
    ];
    
    /**
     * Simple seeded random number generator (LCG)
     */
    function SeededRNG(seed) {
        this.seed = seed || 1;
        this.next = function() {
            this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
            return this.seed / 0x7fffffff;
        };
        this.nextInt = function(max) {
            return Math.floor(this.next() * max);
        };
    }
    
    /**
     * Shuffle array using seeded RNG (Fisher-Yates)
     */
    function shuffleWithSeed(arr, rng) {
        var result = arr.slice();
        for (var i = result.length - 1; i > 0; i--) {
            var j = rng.nextInt(i + 1);
            var temp = result[i];
            result[i] = result[j];
            result[j] = temp;
        }
        return result;
    }
    
    /**
     * Load all teams and players from rosters.ini
     */
    function loadTeamsAndPlayers() {
        if (TEAMS_CACHE && PLAYERS_BY_TEAM) {
            return { teams: TEAMS_CACHE, players: PLAYERS_BY_TEAM };
        }
        
        TEAMS_CACHE = {};
        PLAYERS_BY_TEAM = {};
        
        var f = new File(ROSTERS_PATH);
        if (!f.open("r")) {
            log(LOG_WARNING, "[DAILY_MATCHUPS] Cannot open rosters.ini");
            return { teams: TEAMS_CACHE, players: PLAYERS_BY_TEAM };
        }
        
        var teamSections = {};
        var playerSections = {};
        var currentSection = null;
        
        while (!f.eof) {
            var line = f.readln();
            if (line === null) break;
            line = line.trim();
            if (!line || line.charAt(0) === "#" || line.charAt(0) === ";") continue;
            
            if (line.charAt(0) === "[" && line.charAt(line.length - 1) === "]") {
                currentSection = line.substring(1, line.length - 1).trim().toLowerCase();
                continue;
            }
            
            var eq = line.indexOf("=");
            if (eq <= 0 || !currentSection) continue;
            
            var key = line.substring(0, eq).trim();
            var value = line.substring(eq + 1).trim();
            
            if (currentSection.indexOf(".") === -1) {
                // Team section
                if (!teamSections[currentSection]) teamSections[currentSection] = {};
                teamSections[currentSection][key] = value;
            } else {
                // Player section
                if (!playerSections[currentSection]) playerSections[currentSection] = {};
                playerSections[currentSection][key] = value;
            }
        }
        f.close();
        
        // Process teams
        for (var teamKey in teamSections) {
            if (!teamSections.hasOwnProperty(teamKey)) continue;
            var team = teamSections[teamKey];
            
            TEAMS_CACHE[teamKey] = {
                key: teamKey,
                name: team.team_name || teamKey,
                abbr: team.team_abbr || teamKey.substring(0, 3).toUpperCase(),
                roster: team.roster ? team.roster.split(",").map(function(s) { return s.trim(); }) : [],
                colors: {
                    fg: team.ansi_fg || "WHITE",
                    bg: team.ansi_bg || "BG_BLACK",
                    fgAccent: team.ansi_fg_accent || "WHITE",
                    bgAlt: team.ansi_bg_alt || "BG_BLACK"
                }
            };
            
            PLAYERS_BY_TEAM[teamKey] = [];
        }
        
        // Process players into teams
        for (var playerKey in playerSections) {
            if (!playerSections.hasOwnProperty(playerKey)) continue;
            var pdata = playerSections[playerKey];
            var parts = playerKey.split(".");
            if (parts.length !== 2) continue;
            
            var teamKey = parts[0];
            var playerSlug = parts[1];
            
            if (!PLAYERS_BY_TEAM[teamKey]) PLAYERS_BY_TEAM[teamKey] = [];
            
            var player = {
                slug: playerSlug,
                key: playerKey,
                name: pdata.player_name || playerSlug.replace(/_/g, " "),
                jersey: pdata.player_number || "00",
                position: pdata.position || "forward",
                stats: {
                    speed: parseInt(pdata.speed, 10) || 5,
                    threePt: parseInt(pdata["3point"], 10) || 5,
                    dunk: parseInt(pdata.dunk, 10) || 5,
                    power: parseInt(pdata.power, 10) || 5,
                    steal: parseInt(pdata.steal, 10) || 5,
                    block: parseInt(pdata.block, 10) || 5
                },
                shortNicks: pdata.short_nicks ? pdata.short_nicks.split(",").map(function(s) { return s.trim(); }) : [],
                skin: pdata.skin || "brown",
                // Rivals: list of player keys that this player can't be on same crew with
                rivals: pdata.rivals ? pdata.rivals.split(",").map(function(s) { return s.trim(); }) : []
            };
            
            // Calculate power rating for odds
            player.powerRating = calculatePlayerPower(player.stats);
            
            PLAYERS_BY_TEAM[teamKey].push(player);
        }
        
        return { teams: TEAMS_CACHE, players: PLAYERS_BY_TEAM };
    }
    
    /**
     * Calculate player power rating (weighted stats)
     */
    function calculatePlayerPower(stats) {
        var weights = {
            speed: 1.2,
            threePt: 1.1,
            dunk: 1.0,
            power: 0.9,
            steal: 0.8,
            block: 0.7
        };
        
        var total = 0;
        total += (stats.speed || 5) * weights.speed;
        total += (stats.threePt || 5) * weights.threePt;
        total += (stats.dunk || 5) * weights.dunk;
        total += (stats.power || 5) * weights.power;
        total += (stats.steal || 5) * weights.steal;
        total += (stats.block || 5) * weights.block;
        
        return total;
    }
    
    /**
     * Calculate team power from 2 players
     */
    function calculateTeamPower(players) {
        if (!players || players.length === 0) return 30; // Default
        var total = 0;
        for (var i = 0; i < players.length; i++) {
            total += players[i].powerRating || 30;
        }
        return total / players.length;
    }
    
    /**
     * Calculate betting odds based on power difference
     */
    function calculateOdds(team1Power, team2Power) {
        var config = (LORB.Config && LORB.Config.BETTING_ODDS) || {
            baseOdds: 110,
            diffScaleFactor: 8,
            minFavorite: -500,
            maxUnderdog: 500
        };
        
        var powerDiff = Math.abs(team1Power - team2Power);
        var totalPower = team1Power + team2Power;
        var diffPercent = (powerDiff / totalPower) * 100;
        
        // Even matchup
        if (diffPercent < 2) {
            return { team1: -105, team2: 105 };
        }
        
        var oddsIncrease = Math.floor(diffPercent * config.diffScaleFactor);
        var favoriteOdds = -(config.baseOdds + oddsIncrease);
        var underdogOdds = config.baseOdds + oddsIncrease;
        
        // Cap extremes
        if (favoriteOdds < config.minFavorite) favoriteOdds = config.minFavorite;
        if (underdogOdds > config.maxUnderdog) underdogOdds = config.maxUnderdog;
        
        if (team1Power > team2Power) {
            return { team1: favoriteOdds, team2: underdogOdds, favorite: "team1" };
        } else {
            return { team1: underdogOdds, team2: favoriteOdds, favorite: "team2" };
        }
    }
    
    /**
     * Calculate point spread
     */
    function calculateSpread(team1Power, team2Power) {
        var config = (LORB.Config && LORB.Config.BETTING_SPREAD) || {
            pointsPerPower: 1.5,
            minSpread: 0.5,
            maxSpread: 15
        };
        
        var powerDiff = Math.abs(team1Power - team2Power);
        var spread = powerDiff * config.pointsPerPower;
        spread = Math.round(spread * 2) / 2; // Round to 0.5
        
        if (spread < config.minSpread) spread = config.minSpread;
        if (spread > config.maxSpread) spread = config.maxSpread;
        
        return {
            spread: spread,
            favorite: team1Power > team2Power ? "team1" : "team2"
        };
    }
    
    /**
     * Calculate over/under total
     */
    function calculateTotal(team1Power, team2Power) {
        var config = (LORB.Config && LORB.Config.BETTING_TOTALS) || {
            basePerTeam: 35,
            powerScale: 3,
            minTotal: 70,
            maxTotal: 120
        };
        
        var avgPower = (team1Power + team2Power) / 2;
        var total = config.basePerTeam * 2 + (avgPower * config.powerScale / 10);
        total = Math.round(total * 2) / 2; // Round to 0.5
        
        if (total < config.minTotal) total = config.minTotal;
        if (total > config.maxTotal) total = config.maxTotal;
        
        return total;
    }
    
    /**
     * Generate daily matchups for a given day number
     * Returns consistent results for the same day number
     */
    function generateDailyMatchups(dayNumber) {
        var numGames = (LORB.Config && LORB.Config.BETTING_GAMES_PER_DAY) || 15;
        var data = loadTeamsAndPlayers();
        
        // Use day number as seed for consistent generation
        var rng = new SeededRNG(dayNumber * 31337);
        
        // Shuffle teams for this day
        var shuffledTeams = shuffleWithSeed(NBA_TEAM_KEYS, rng);
        
        var matchups = [];
        
        // Pair teams (0 vs 1, 2 vs 3, etc.)
        for (var i = 0; i < numGames * 2 && i < shuffledTeams.length; i += 2) {
            var team1Key = shuffledTeams[i];
            var team2Key = shuffledTeams[i + 1];
            
            if (!team1Key || !team2Key) break;
            
            var team1 = data.teams[team1Key];
            var team2 = data.teams[team2Key];
            
            if (!team1 || !team2) continue;
            
            // Select 2 random players per team using seeded RNG
            var team1Players = selectPlayers(team1Key, 2, rng, data.players);
            var team2Players = selectPlayers(team2Key, 2, rng, data.players);
            
            // Calculate betting lines
            var team1Power = calculateTeamPower(team1Players);
            var team2Power = calculateTeamPower(team2Players);
            
            var odds = calculateOdds(team1Power, team2Power);
            var spread = calculateSpread(team1Power, team2Power);
            var total = calculateTotal(team1Power, team2Power);
            
            matchups.push({
                id: "game_" + dayNumber + "_" + (matchups.length + 1),
                gameIndex: matchups.length,
                dayNumber: dayNumber,
                team1: {
                    key: team1Key,
                    name: team1.name,
                    abbr: team1.abbr,
                    colors: team1.colors,
                    players: team1Players,
                    power: team1Power
                },
                team2: {
                    key: team2Key,
                    name: team2.name,
                    abbr: team2.abbr,
                    colors: team2.colors,
                    players: team2Players,
                    power: team2Power
                },
                odds: odds,
                spread: spread,
                total: total,
                result: null,  // Will be set when game is simulated
                wager: null    // Will be set when player bets
            });
        }
        
        return matchups;
    }
    
    /**
     * Select N random players from a team
     */
    function selectPlayers(teamKey, count, rng, playersByTeam) {
        var teamPlayers = playersByTeam[teamKey] || [];
        if (teamPlayers.length === 0) {
            // Fallback: generate placeholder players
            return generatePlaceholderPlayers(teamKey, count);
        }
        
        var shuffled = shuffleWithSeed(teamPlayers, rng);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }
    
    /**
     * Generate placeholder players if team has no roster
     */
    function generatePlaceholderPlayers(teamKey, count) {
        var players = [];
        for (var i = 0; i < count; i++) {
            players.push({
                slug: teamKey + "_player" + (i + 1),
                name: teamKey.charAt(0).toUpperCase() + teamKey.slice(1) + " #" + (i + 1),
                jersey: String(i + 1),
                stats: { speed: 5, threePt: 5, dunk: 5, power: 5, steal: 5, block: 5 },
                shortNicks: [],
                powerRating: 30
            });
        }
        return players;
    }
    
    /**
     * Simulate a game result
     */
    function simulateGameResult(matchup, rng) {
        if (!rng) rng = new SeededRNG(Date.now());
        
        var team1Power = matchup.team1.power;
        var team2Power = matchup.team2.power;
        var totalPower = team1Power + team2Power;
        
        // Base scores influenced by power
        var baseScore = 40;
        var variance = 15;
        
        var score1 = baseScore + Math.floor(rng.next() * variance) + Math.floor((team1Power / totalPower) * 10);
        var score2 = baseScore + Math.floor(rng.next() * variance) + Math.floor((team2Power / totalPower) * 10);
        
        // Avoid ties
        while (score1 === score2) {
            if (rng.next() > 0.5) score1++; else score2++;
        }
        
        return {
            score1: score1,
            score2: score2,
            winner: score1 > score2 ? "team1" : "team2",
            margin: Math.abs(score1 - score2),
            totalPoints: score1 + score2
        };
    }
    
    /**
     * Grade a wager against a game result
     */
    function gradeWager(wager, result) {
        if (!wager || !result) return null;
        
        var won = false;
        var push = false;
        
        switch (wager.type) {
            case "moneyline":
                won = (wager.pick === result.winner);
                break;
                
            case "spread":
                // wager.pick is "team1" or "team2", wager.line is the spread
                if (wager.pick === result.winner) {
                    // Favorite won - did they cover?
                    won = result.margin > Math.abs(wager.line);
                    push = result.margin === Math.abs(wager.line);
                } else {
                    // Underdog - did they cover or win?
                    won = true; // Underdog covered if they won or lost by less than spread
                    if (result.margin > Math.abs(wager.line)) won = false;
                    push = result.margin === Math.abs(wager.line);
                }
                break;
                
            case "total":
                // wager.pick is "over" or "under", wager.line is the total
                if (wager.pick === "over") {
                    won = result.totalPoints > wager.line;
                    push = result.totalPoints === wager.line;
                } else {
                    won = result.totalPoints < wager.line;
                    push = result.totalPoints === wager.line;
                }
                break;
        }
        
        return {
            won: won,
            push: push,
            payout: push ? wager.amount : (won ? calculatePayout(wager.amount, wager.odds) : 0)
        };
    }
    
    /**
     * Calculate payout for a winning bet
     */
    function calculatePayout(amount, odds) {
        if (odds > 0) {
            // Underdog: +150 means win $150 on $100
            return amount + Math.floor(amount * (odds / 100));
        } else {
            // Favorite: -150 means win $100 on $150
            return amount + Math.floor(amount / (Math.abs(odds) / 100));
        }
    }
    
    /**
     * Format odds for display (American style)
     */
    function formatOdds(odds) {
        if (typeof odds !== "number") return "EVEN";
        if (odds === 0) return "EVEN";
        if (odds > 0) return "+" + odds;
        return String(odds);
    }
    
    /**
     * Format spread for display
     */
    function formatSpread(spread, isFavorite) {
        if (isFavorite) {
            return "-" + spread;
        } else {
            return "+" + spread;
        }
    }
    
    // Export functions
    if (!this.LORB) this.LORB = {};
    if (!this.LORB.Betting) this.LORB.Betting = {};
    
    this.LORB.Betting = {
        generateDailyMatchups: generateDailyMatchups,
        simulateGameResult: simulateGameResult,
        gradeWager: gradeWager,
        calculatePayout: calculatePayout,
        formatOdds: formatOdds,
        formatSpread: formatSpread,
        loadTeamsAndPlayers: loadTeamsAndPlayers,
        SeededRNG: SeededRNG
    };
    
})();
