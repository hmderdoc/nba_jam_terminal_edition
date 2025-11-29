/**
 * club23.js - Club 23
 * 
 * The social hub of Rim City.
 * Rest, listen for rumors, and bet on AI vs AI games.
 */
(function() {
    
    // Rumor pool - hints about the game world
    var RUMORS = [
        "\"I heard the Red Bull only plays when the moon is full...\"",
        "\"Court 9? The Rimkeeper doesn't let just anyone ball there.\"",
        "\"Some kid from Courtline Ave just dropped 50 on a Dunk District regular.\"",
        "\"They say Cloudwalkers are the only sneakers that work in the Court of Airness.\"",
        "\"The Arc? Pure shooters only. No dunkers allowed.\"",
        "\"I saw someone drink a Mystery Mix and play for three days straight.\"",
        "\"Fadeaway Prophet taught me the mid-range. Changed my life.\"",
        "\"Don't mess with Neon Gator. That dude brings chaos wherever he goes.\"",
        "\"The Red Bull? Six rings, man. Six rings forged into a spirit.\"",
        "\"Sole Collector's got cursed sneakers. Don't buy from him.\"",
        "\"Rep is everything in this city. Build yours or stay a nobody.\"",
        "\"I lost $500 betting on a sure thing. There are no sure things.\"",
        "\"The gym on 5th? Coach there trained legends.\"",
        "\"You want to face the Red Bull? You gotta earn it first.\"",
        "\"Rim City never sleeps. The courts are always open.\""
    ];
    
    // Rest flavor text
    var REST_LINES = [
        "You grab a booth and rest your legs.",
        "The bartender slides you a water. \"On the house.\"",
        "You close your eyes for a moment. The crowd noise fades.",
        "A comfortable exhaustion settles over you.",
        "The bass thumps low as you recover your strength."
    ];
    
    /**
     * Rest and recover street turns
     */
    function rest(ctx) {
        if (ctx.restUsedToday) {
            LORB.View.line("");
            LORB.View.warn("You've already rested today. Come back tomorrow.");
            return;
        }
        
        var restLine = REST_LINES[Math.floor(Math.random() * REST_LINES.length)];
        var turnsRecovered = 3;
        
        LORB.View.line("");
        LORB.View.line("\1c" + restLine + "\1n");
        LORB.View.line("");
        
        ctx.streetTurns = (ctx.streetTurns || 0) + turnsRecovered;
        ctx.restUsedToday = true;
        
        LORB.View.line("\1g+" + turnsRecovered + " Street Turns\1n");
    }
    
    /**
     * Listen for rumors
     */
    function listenRumors(ctx) {
        var rumor = RUMORS[Math.floor(Math.random() * RUMORS.length)];
        
        LORB.View.line("");
        LORB.View.line("You lean in close to a conversation at the bar...");
        LORB.View.line("");
        LORB.View.line("\1k\1h" + rumor + "\1n");
    }
    
    /**
     * Generate a random street team for betting games
     */
    function generateBettingTeam(teamName) {
        var baseStats = 5 + Math.floor(Math.random() * 3);  // 5-7 base
        
        function randStat() {
            return Math.max(3, Math.min(9, baseStats + Math.floor(Math.random() * 3) - 1));
        }
        
        return {
            name: teamName,
            abbr: teamName.substring(0, 4).toUpperCase(),
            players: [
                {
                    name: teamName.split(" ")[0] + " #1",
                    speed: randStat(),
                    threePt: randStat(),
                    dunks: randStat(),
                    power: randStat(),
                    defense: randStat(),
                    blocks: randStat(),
                    skin: ["brown", "lightgray"][Math.floor(Math.random() * 2)],
                    jersey: Math.floor(Math.random() * 99),
                    isHuman: false
                },
                {
                    name: teamName.split(" ")[0] + " #2",
                    speed: randStat(),
                    threePt: randStat(),
                    dunks: randStat(),
                    power: randStat(),
                    defense: randStat(),
                    blocks: randStat(),
                    skin: ["brown", "lightgray"][Math.floor(Math.random() * 2)],
                    jersey: Math.floor(Math.random() * 99),
                    isHuman: false
                }
            ],
            colors: null  // Will use defaults
        };
    }
    
    /**
     * Bet on an AI vs AI game
     */
    function placeBet(ctx) {
        LORB.View.clear();
        LORB.View.header("CLUB 23 - BETTING WINDOW");
        LORB.View.line("");
        
        if ((ctx.cash || 0) < 50) {
            LORB.View.warn("Minimum bet is $50. You need more cash.");
            return;
        }
        
        LORB.View.line("A game is about to start...");
        LORB.View.line("");
        
        // Generate two random teams
        var team1Names = ["Courtline Crew", "Dunk District", "Arc Angels", "Street Kings"];
        var team2Names = ["Uptown Ballers", "South Side", "West End", "Downtown Heat"];
        
        var team1Name = team1Names[Math.floor(Math.random() * team1Names.length)];
        var team2Name = team2Names[Math.floor(Math.random() * team2Names.length)];
        
        LORB.View.line("  \1r" + team1Name + "\1n  vs  \1b" + team2Name + "\1n");
        LORB.View.line("");
        LORB.View.line("Your cash: \1y$" + ctx.cash + "\1n");
        LORB.View.line("");
        LORB.View.line("\1w[1]\1n Bet on \1r" + team1Name + "\1n");
        LORB.View.line("\1w[2]\1n Bet on \1b" + team2Name + "\1n");
        LORB.View.line("\1w[Q]\1n Back out");
        LORB.View.line("");
        
        var teamChoice = LORB.View.prompt("Pick your team: ").toUpperCase();
        
        if (teamChoice !== "1" && teamChoice !== "2") {
            return;
        }
        
        var pickedTeam = (teamChoice === "1") ? team1Name : team2Name;
        
        LORB.View.line("");
        var betStr = LORB.View.prompt("Bet amount (50-" + ctx.cash + "): $");
        var betAmount = parseInt(betStr, 10);
        
        if (isNaN(betAmount) || betAmount < 50 || betAmount > ctx.cash) {
            LORB.View.warn("Invalid bet amount.");
            return;
        }
        
        // Deduct bet
        ctx.cash -= betAmount;
        
        LORB.View.line("");
        LORB.View.line("\1yYou put $" + betAmount + " on " + pickedTeam + ".\1n");
        LORB.View.line("");
        
        // Check if real game engine is available
        var realEngineAvailable = (typeof runExternalGame === "function");
        var gameResult = null;
        
        if (realEngineAvailable) {
            LORB.View.line("The game is about to begin...");
            LORB.View.line("\1wPress any key to watch...\1n");
            console.getkey();
            
            // Build game config for AI vs AI spectate mode
            var team1 = generateBettingTeam(team1Name);
            var team2 = generateBettingTeam(team2Name);
            
            // Set team colors
            team1.colors = { fg: "WHITE", bg: "BG_RED" };
            team2.colors = { fg: "WHITE", bg: "BG_BLUE" };
            
            var config = {
                teamA: team1,
                teamB: team2,
                options: {
                    gameTime: 60,  // Quick 60-second game for betting
                    mode: "spectate",  // AI vs AI
                    showMatchupScreen: true,
                    showGameOverScreen: false  // We show our own results
                },
                lorbContext: {
                    betting: true,
                    betAmount: betAmount,
                    pickedTeam: pickedTeam
                }
            };
            
            var result = runExternalGame(config);
            
            if (result && result.completed) {
                gameResult = {
                    team1: team1Name,
                    team2: team2Name,
                    score1: result.score.teamA,
                    score2: result.score.teamB
                };
            } else {
                // Fall back to simulation if game failed
                gameResult = simulateGame(team1Name, team2Name);
            }
        } else {
            LORB.View.line("The game begins...");
            LORB.View.line("\1wPress any key to watch...\1n");
            console.getkey();
            gameResult = simulateGame(team1Name, team2Name);
        }
        
        // Show result
        LORB.View.clear();
        LORB.View.header("GAME OVER");
        LORB.View.line("");
        LORB.View.line("\1r" + team1Name + "\1n: " + gameResult.score1);
        LORB.View.line("\1b" + team2Name + "\1n: " + gameResult.score2);
        LORB.View.line("");
        
        var winner = (gameResult.score1 > gameResult.score2) ? team1Name : team2Name;
        
        if (winner === pickedTeam) {
            var winnings = betAmount * 2;
            ctx.cash += winnings;
            
            LORB.View.line("\1h\1g" + pickedTeam + " WINS!\1n");
            LORB.View.line("");
            LORB.View.line("You collect \1y$" + winnings + "\1n!");
        } else {
            LORB.View.line("\1h\1r" + winner + " wins.\1n");
            LORB.View.line("");
            LORB.View.line("Your $" + betAmount + " bet is gone.");
            LORB.View.line("Better luck next time.");
        }
    }
    
    /**
     * Simulate a game (when real AI vs AI not available)
     */
    function simulateGame(team1, team2) {
        // Random scores between 35-55 for arcade feel
        var score1 = 35 + Math.floor(Math.random() * 21);
        var score2 = 35 + Math.floor(Math.random() * 21);
        
        // Avoid ties
        while (score1 === score2) {
            score2 = 35 + Math.floor(Math.random() * 21);
        }
        
        return {
            team1: team1,
            team2: team2,
            score1: score1,
            score2: score2
        };
    }
    
    /**
     * Draw main Club 23 menu
     */
    function drawMenu(ctx) {
        LORB.View.clear();
        LORB.View.header("CLUB 23");
        LORB.View.line("");
        LORB.View.line("The bass hits you as you walk in.");
        LORB.View.line("Smoke curls through neon light.");
        LORB.View.line("");
        LORB.View.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
        LORB.View.line("");
        
        var restText = ctx.restUsedToday ? 
            "\1k[1] Rest & Recover (already rested)\1n" :
            "\1w[1]\1n Rest & Recover (+3 street turns)";
        
        LORB.View.line(restText);
        LORB.View.line("\1w[2]\1n Listen for Rumors");
        LORB.View.line("\1w[3]\1n Bet on a Game");
        LORB.View.line("\1w[Q]\1n Leave");
        LORB.View.line("");
    }
    
    /**
     * Main Club 23 loop
     */
    function run(ctx) {
        while (true) {
            drawMenu(ctx);
            
            var choice = LORB.View.prompt("Choice: ").toUpperCase();
            
            switch (choice) {
                case "1":
                    rest(ctx);
                    console.getkey();
                    break;
                    
                case "2":
                    listenRumors(ctx);
                    console.getkey();
                    break;
                    
                case "3":
                    placeBet(ctx);
                    console.getkey();
                    break;
                    
                case "Q":
                    return;
            }
        }
    }
    
    // Export to LORB namespace
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Club23 = {
        run: run,
        RUMORS: RUMORS
    };
    
})();
