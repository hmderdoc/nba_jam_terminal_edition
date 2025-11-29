/**
 * courts.js - Streetball Courts
 * 
 * Where players compete in NBA JAM games against AI opponents.
 * Courts are rep-gated with escalating difficulty.
 */
(function() {
    
    // Court definitions with rep requirements and difficulty
    var COURTS = {
        court6: {
            id: "court6",
            name: "Court 6",
            description: "The rookie proving grounds. Everyone starts here.",
            repRequired: 0,
            difficulty: 1,
            rewards: { cashBase: 50, repBase: 2, xpBase: 10 }
        },
        court9: {
            id: "court9",
            name: "Court 9",
            description: "Regulars only. The Rimkeeper watches from the shadows.",
            repRequired: 25,
            difficulty: 2,
            rewards: { cashBase: 100, repBase: 4, xpBase: 25 }
        },
        dunk_district: {
            id: "dunk_district",
            name: "Dunk District",
            description: "Neon lights, high stakes. Dunkers rule here.",
            repRequired: 75,
            difficulty: 3,
            rewards: { cashBase: 200, repBase: 8, xpBase: 50 }
        },
        the_arc: {
            id: "the_arc",
            name: "The Arc",
            description: "Sniper's haven. Only deadly shooters survive.",
            repRequired: 150,
            difficulty: 4,
            rewards: { cashBase: 400, repBase: 15, xpBase: 100 }
        },
        court_of_airness: {
            id: "court_of_airness",
            name: "Court of Airness",
            description: "The final court. Where the Red Bull waits.",
            repRequired: 300,
            difficulty: 5,
            rewards: { cashBase: 1000, repBase: 50, xpBase: 500 },
            boss: true
        }
    };
    
    /**
     * Get available courts for player's rep level
     */
    function getAvailableCourts(ctx) {
        var available = [];
        var rep = ctx.rep || 0;
        
        for (var id in COURTS) {
            if (COURTS.hasOwnProperty(id)) {
                var court = COURTS[id];
                available.push({
                    court: court,
                    unlocked: rep >= court.repRequired,
                    repNeeded: court.repRequired - rep
                });
            }
        }
        
        return available;
    }
    
    /**
     * Generate an opponent scaled to court difficulty
     */
    function generateOpponent(court, ctx) {
        var baseStats = 4 + (court.difficulty * 2);  // 6, 8, 10, 12, 14
        var variance = 2;
        
        // Opponent names by difficulty tier
        var names = {
            1: ["Rookie Ray", "Fresh Mike", "Court Newbie", "Young Blood"],
            2: ["Street Sam", "Quick Pete", "Alley Al", "Courtside Chris"],
            3: ["Dunk Master D", "High Rise Harry", "Rim Wrecker", "Sky Walker"],
            4: ["Sniper Steve", "Arc Angel", "Three-Point Tony", "Range Rider"],
            5: ["The Red Bull", "His Airness", "Court Legend", "The GOAT"]
        };
        
        var tierNames = names[court.difficulty] || names[1];
        var name = tierNames[Math.floor(Math.random() * tierNames.length)];
        
        // Special case for final boss
        if (court.boss) {
            name = "The Red Bull";
        }
        
        return {
            id: "opponent_" + court.difficulty + "_" + Date.now(),
            name: name,
            displayName: name,
            team: court.name,
            stats: {
                speed: Math.min(10, baseStats + Math.floor(Math.random() * variance)),
                "3point": Math.min(10, baseStats + Math.floor(Math.random() * variance)),
                dunk: Math.min(10, baseStats + Math.floor(Math.random() * variance)),
                power: Math.min(10, baseStats + Math.floor(Math.random() * variance)),
                steal: Math.min(10, baseStats + Math.floor(Math.random() * variance) - 1),
                block: Math.min(10, baseStats + Math.floor(Math.random() * variance) - 1)
            }
        };
    }
    
    /**
     * Calculate rewards for winning
     */
    function calculateRewards(court, ctx, scoreDiff) {
        var rewards = court.rewards;
        var multiplier = 1.0;
        
        // Bonus for blowout
        if (scoreDiff >= 20) {
            multiplier = 1.5;
        } else if (scoreDiff >= 10) {
            multiplier = 1.25;
        }
        
        // Underdog archetype bonus
        if (ctx.archetype === "UNDERDOG") {
            multiplier *= 1.25;
        }
        
        return {
            cash: Math.floor(rewards.cashBase * multiplier),
            rep: Math.floor(rewards.repBase * multiplier),
            xp: Math.floor(rewards.xpBase * multiplier)
        };
    }
    
    /**
     * Simulate a game (fallback when real game not available)
     */
    function simulateGame(ctx, opponent) {
        LORB.View.line("");
        LORB.View.line("\1k(Simulating game...)\1n");
        mswait(1500);
        
        // Calculate win probability based on stats
        var playerPower = 0;
        var oppPower = 0;
        
        if (ctx.stats) {
            for (var s in ctx.stats) {
                if (ctx.stats.hasOwnProperty(s)) {
                    playerPower += ctx.stats[s] || 0;
                }
            }
        }
        for (var s in opponent.stats) {
            if (opponent.stats.hasOwnProperty(s)) {
                oppPower += opponent.stats[s] || 0;
            }
        }
        
        var winChance = 0.5 + (playerPower - oppPower) * 0.02;
        winChance = Math.max(0.1, Math.min(0.9, winChance));
        
        return Math.random() < winChance;
    }
    
    /**
     * Convert LORB player context to NBA JAM player format
     */
    function ctxToPlayer(ctx) {
        var stats = ctx.stats || {};
        return {
            name: ctx.name || ctx.alias || "Player",
            speed: stats.speed || 6,
            threePt: stats["3point"] || stats.shooting || 5,
            dunks: stats.dunk || 5,
            power: stats.power || 5,
            defense: stats.steal || 5,
            blocks: stats.block || 5,
            skin: ctx.skin || "brown",
            jersey: ctx.jersey || 1,
            isHuman: true,
            lorbId: "player",
            lorbData: ctx
        };
    }
    
    /**
     * Convert opponent to NBA JAM player format
     */
    function opponentToPlayer(opp) {
        var stats = opp.stats || {};
        return {
            name: opp.name || "Opponent",
            speed: stats.speed || 5,
            threePt: stats["3point"] || 5,
            dunks: stats.dunk || 5,
            power: stats.power || 5,
            defense: stats.steal || 5,
            blocks: stats.block || 5,
            skin: "lightgray",
            jersey: Math.floor(Math.random() * 99),
            isHuman: false,
            lorbId: opp.id || "opp_" + Date.now()
        };
    }
    
    /**
     * Run a game at a specific court
     */
    function playAtCourt(court, ctx) {
        // Check street turns
        if (ctx.streetTurns <= 0) {
            LORB.View.warn("No street turns left today!");
            console.getkey();
            return;
        }
        
        // Generate opponent
        var opponent = generateOpponent(court, ctx);
        
        LORB.View.clear();
        LORB.View.header(court.name);
        LORB.View.line("");
        LORB.View.line(court.description);
        LORB.View.line("");
        LORB.View.line("A challenger approaches...");
        LORB.View.line("");
        LORB.View.line("\1h\1y" + opponent.name + "\1n steps onto the court.");
        LORB.View.line("");
        
        // Show opponent stats
        LORB.View.line("\1wOpponent Stats:\1n");
        LORB.View.line("  SPD: " + opponent.stats.speed + "  3PT: " + opponent.stats["3point"]);
        LORB.View.line("  DNK: " + opponent.stats.dunk + "  PWR: " + opponent.stats.power);
        LORB.View.line("");
        
        LORB.View.line("\1w[P]\1nlay  \1w[B]\1nack out");
        var choice = LORB.View.prompt("Choice: ");
        
        if (choice.toUpperCase() !== "P") {
            return;
        }
        
        // Consume street turn
        ctx.streetTurns--;
        
        // Track daily stats
        if (!ctx.dayStats) {
            ctx.dayStats = { gamesPlayed: 0, wins: 0, losses: 0, cashEarned: 0, repGained: 0 };
        }
        ctx.dayStats.gamesPlayed++;
        
        // Run the actual game
        var won = false;
        var scoreDiff = 0;
        
        // Check if real game engine is available
        var realEngineAvailable = (typeof runExternalGame === "function");
        
        if (realEngineAvailable) {
            // Build game config for real NBA JAM
            LORB.View.line("");
            LORB.View.line("\1h\1cLoading game...\1n");
            
            var player = ctxToPlayer(ctx);
            var opp1 = opponentToPlayer(opponent);
            
            // Generate teammate and second opponent scaled to difficulty
            var teammate = generateOpponent({ difficulty: Math.max(1, court.difficulty - 1) }, ctx);
            teammate.name = "Streetballer";
            var opp2 = generateOpponent(court, ctx);
            opp2.name = opponent.name + " Jr";
            
            var config = {
                teamA: {
                    name: (ctx.name || "Player") + "'s Squad",
                    abbr: "YOU",
                    players: [player, opponentToPlayer(teammate)],
                    colors: { fg: "WHITE", bg: "BG_RED" }
                },
                teamB: {
                    name: court.name + " Crew",
                    abbr: "OPP", 
                    players: [opp1, opponentToPlayer(opp2)],
                    colors: { fg: "WHITE", bg: "BG_BLUE" }
                },
                options: {
                    gameTime: 90,  // 90 seconds for street games
                    mode: "play",
                    humanTeam: "teamA",
                    humanPlayerIndex: 0,
                    showMatchupScreen: true,
                    showGameOverScreen: false  // We show our own results
                },
                lorbContext: {
                    court: court.id,
                    difficulty: court.difficulty,
                    opponent: opponent
                }
            };
            
            // Run the actual game
            var result = runExternalGame(config);
            
            if (result && result.completed) {
                won = (result.winner === "teamA");
                scoreDiff = result.score.teamA - result.score.teamB;
            } else if (result && result.exitReason === "quit") {
                // Player quit - count as loss but refund street turn
                won = false;
                scoreDiff = 0;
                ctx.streetTurns++;
                ctx.dayStats.gamesPlayed--;
                LORB.View.line("");
                LORB.View.warn("Game abandoned.");
                console.getkey();
                return;
            } else {
                // Error or other issue - fall back to simulation
                won = simulateGame(ctx, opponent);
                scoreDiff = won ? 10 : -5;
            }
        } else {
            // Fallback simulation when real game not available
            won = simulateGame(ctx, opponent);
            scoreDiff = won ? Math.floor(Math.random() * 15) + 5 : -(Math.floor(Math.random() * 10) + 3);
        }
        
        // Show result
        LORB.View.clear();
        LORB.View.header("GAME OVER");
        LORB.View.line("");
        
        if (won) {
            ctx.wins = (ctx.wins || 0) + 1;
            ctx.dayStats.wins++;
            
            var rewards = calculateRewards(court, ctx, scoreDiff);
            
            LORB.View.line("\1h\1gYOU WIN!\1n");
            LORB.View.line("");
            LORB.View.line("Final Score: You win by " + Math.abs(scoreDiff));
            LORB.View.line("");
            LORB.View.line("\1yRewards:\1n");
            LORB.View.line("  Cash: \1g+$" + rewards.cash + "\1n");
            LORB.View.line("  Rep:  \1c+" + rewards.rep + "\1n");
            LORB.View.line("  XP:   +" + rewards.xp);
            
            ctx.cash = (ctx.cash || 0) + rewards.cash;
            ctx.rep = (ctx.rep || 0) + rewards.rep;
            ctx.xp = (ctx.xp || 0) + rewards.xp;
            
            ctx.dayStats.cashEarned += rewards.cash;
            ctx.dayStats.repGained += rewards.rep;
            
            // Check for level up
            checkLevelUp(ctx);
            
        } else {
            ctx.losses = (ctx.losses || 0) + 1;
            ctx.dayStats.losses++;
            
            LORB.View.line("\1h\1rYOU LOSE\1n");
            LORB.View.line("");
            LORB.View.line("Final Score: Lost by " + Math.abs(scoreDiff));
            LORB.View.line("");
            LORB.View.line("The streets are unforgiving.");
            LORB.View.line("But tomorrow's another day.");
        }
        
        ctx.gamesPlayed = (ctx.gamesPlayed || 0) + 1;
        
        LORB.View.line("");
        LORB.View.line("\1wPress any key to continue...\1n");
        console.getkey();
    }
    
    /**
     * Check and handle level up
     */
    function checkLevelUp(ctx) {
        var xpTable = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000];
        var currentLevel = ctx.level || 1;
        var currentXP = ctx.xp || 0;
        
        var nextLevelXP = xpTable[currentLevel] || (currentLevel * 5000);
        
        if (currentXP >= nextLevelXP && currentLevel < 10) {
            ctx.level = currentLevel + 1;
            ctx.attributePoints = (ctx.attributePoints || 0) + 2;
            
            LORB.View.line("");
            LORB.View.line("\1h\1y*** LEVEL UP! ***\1n");
            LORB.View.line("You are now level " + ctx.level + "!");
            LORB.View.line("+2 Attribute Points (spend at the Gym)");
        }
    }
    
    /**
     * Main courts menu
     */
    function run(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("STREETBALL COURTS");
            LORB.View.line("");
            LORB.View.line("Street Turns: " + (ctx.streetTurns > 0 ? "\1g" : "\1r") + 
                           ctx.streetTurns + "\1n");
            LORB.View.line("");
            
            var courts = getAvailableCourts(ctx);
            var menuNum = 1;
            
            for (var i = 0; i < courts.length; i++) {
                var c = courts[i];
                if (c.unlocked) {
                    LORB.View.line("\1w[\1h" + menuNum + "\1n\1w]\1n " + c.court.name + 
                        (c.court.boss ? " \1r[BOSS]\1n" : ""));
                } else {
                    LORB.View.line("\1k[" + menuNum + "] " + c.court.name + 
                        " (Need " + c.repNeeded + " more rep)\1n");
                }
                menuNum++;
            }
            
            LORB.View.line("");
            LORB.View.line("\1w[\1hQ\1n\1w]\1n Back to Rim City");
            LORB.View.line("");
            
            var choice = LORB.View.prompt("Choice: ");
            
            if (choice.toUpperCase() === "Q") {
                return;
            }
            
            var idx = parseInt(choice, 10) - 1;
            if (idx >= 0 && idx < courts.length) {
                if (courts[idx].unlocked) {
                    playAtCourt(courts[idx].court, ctx);
                } else {
                    LORB.View.warn("You need more rep to play here!");
                    console.getkey();
                }
            }
        }
    }
    
    // Export to LORB namespace
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Courts = {
        run: run,
        COURTS: COURTS,
        getAvailableCourts: getAvailableCourts,
        generateOpponent: generateOpponent
    };
    
})();
