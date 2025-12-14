/**
 * red_bull_challenge.js - The Red Bull Final Boss Challenge
 * 
 * This module handles the final boss battle against Satan (The GOAT) and Iceman.
 * The Jordan match serves as a "prep" warm-up before the true final boss.
 * 
 * Can be launched from:
 * - Season playoffs (after winning the championship)
 * - Crib menu (for testing)
 */

(function() {
    
    var Config = LORB.Config;
    
    // ========== BOSS PLAYER BUILDERS ==========
    
    /**
     * Build a player config for the game engine from boss config
     */
    function buildBossPlayer(bossPlayerConfig, teamColors) {
        return {
            name: bossPlayerConfig.name,
            shortNick: bossPlayerConfig.shortNick,
            jerseyNumber: bossPlayerConfig.jerseyNumber,
            skin: bossPlayerConfig.skin || "brown",
            position: bossPlayerConfig.position || "forward",
            speed: bossPlayerConfig.speed || 5,
            threePt: bossPlayerConfig.threePt || 5,
            dunks: bossPlayerConfig.dunks || 5,
            power: bossPlayerConfig.power || 5,
            defense: bossPlayerConfig.defense || 5,
            blocks: bossPlayerConfig.blocks || 5,
            // Nametag colors if specified
            nametagFg: bossPlayerConfig.nametagFg,
            nametagBg: bossPlayerConfig.nametagBg,
            nametagHiFg: bossPlayerConfig.nametagHiFg,
            nametagHiBg: bossPlayerConfig.nametagHiBg,
            // Buffs for special abilities (permanent fire, shove bonus, etc.)
            buffs: bossPlayerConfig.buffs || null
        };
    }
    
    /**
     * Build player team config (challenger's team)
     */
    function buildChallengerTeam(ctx) {
        // Convert LORB player context to game player config
        var player = {
            name: ctx.name || "Challenger",
            shortNick: ctx.nickname || (ctx.name || "CHAL").substring(0, 5).toUpperCase(),
            jerseyNumber: (ctx.appearance && ctx.appearance.jerseyNumber) || "1",
            skin: (ctx.appearance && ctx.appearance.skin) || "brown",
            position: "guard",
            speed: ctx.stats ? ctx.stats.speed || 5 : 5,
            threePt: ctx.stats ? ctx.stats.threePt || 5 : 5,
            dunks: ctx.stats ? ctx.stats.dunk || 5 : 5,
            power: ctx.stats ? ctx.stats.power || 5 : 5,
            defense: ctx.stats ? ctx.stats.steal || 5 : 5,
            blocks: ctx.stats ? ctx.stats.block || 5 : 5,
            lorbId: "player",
            isLorbPlayer: true
        };
        
        // Add nametag colors if set
        if (ctx.appearance) {
            if (ctx.appearance.nametagFg) player.nametagFg = ctx.appearance.nametagFg;
            if (ctx.appearance.nametagBg) player.nametagBg = ctx.appearance.nametagBg;
            if (ctx.appearance.nametagHiFg) player.nametagHiFg = ctx.appearance.nametagHiFg;
            if (ctx.appearance.nametagHiBg) player.nametagHiBg = ctx.appearance.nametagHiBg;
        }
        
        // Get teammate from crew if available
        var teammate = null;
        if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getActiveTeammate) {
            teammate = LORB.Util.Contacts.getActiveTeammate(ctx);
        }
        
        if (!teammate) {
            // Generate a default teammate
            teammate = {
                name: "Streetballer",
                shortNick: "BALL",
                jerseyNumber: "00",
                skin: "brown",
                position: "forward",
                speed: 6, threePt: 5, dunks: 6, power: 6, defense: 5, blocks: 5
            };
        }
        
        // Get team colors from player appearance or default
        var teamColors = { fg: "WHITE", bg: "BG_RED", fg_accent: "WHITE", bg_alt: "BG_RED" };
        if (ctx.appearance && ctx.appearance.jerseyColor) {
            teamColors.bg = "BG_" + ctx.appearance.jerseyColor;
            teamColors.bg_alt = teamColors.bg;
        }
        
        return {
            name: (ctx.name || "Challenger") + "'s Squad",
            abbr: "YOU",
            players: [player, teammate],
            colors: teamColors
        };
    }
    
    // ========== JORDAN CHALLENGE (PREP MATCH) ==========
    
    /**
     * Launch the Jordan prep match
     * 
     * @param {Object} ctx - LORB player context
     * @param {Object} options - Optional settings
     * @returns {Object} Result { completed, won, score, playerStats }
     */
    function launchJordanChallenge(ctx, options) {
        options = options || {};
        var jordanConfig = Config.JORDAN_BOSS;
        
        // Show intro lore if not skipped
        if (!options.skipIntro) {
            showIntroScreen("JORDAN CHALLENGE", jordanConfig.LORE_INTRO, {
                bossName: jordanConfig.NAME,
                bossTitle: jordanConfig.TITLE,
                teammateName: jordanConfig.TEAMMATE_NAME
            });
        }
        
        // Build teams
        var challengerTeam = buildChallengerTeam(ctx);
        
        var jordanTeam = {
            name: "Bulls Dynasty",
            abbr: "CHI",
            players: [
                buildBossPlayer(jordanConfig.JORDAN),
                buildBossPlayer(jordanConfig.PIPPEN)
            ],
            colors: jordanConfig.TEAM_COLORS
        };
        
        // Game config
        var gameConfig = {
            teamA: challengerTeam,
            teamB: jordanTeam,
            options: {
                gameTime: 90,
                mode: "play",
                humanTeam: "teamA",
                humanPlayerIndex: 0,
                showMatchupScreen: true,
                showGameOverScreen: true,
                difficulty: jordanConfig.DIFFICULTY_OVERRIDE
            },
            lorbContext: {
                challenge: "jordan",
                difficulty: jordanConfig.DIFFICULTY_OVERRIDE,
                bossName: jordanConfig.NAME
            }
        };
        
        // Launch game
        var result = runGame(gameConfig);
        
        // Process result
        var challengeResult = processResult(result, jordanConfig, ctx);
        
        // Show result screen
        if (!options.skipOutro) {
            showResultScreen(challengeResult, jordanConfig);
        }
        
        return challengeResult;
    }
    
    // ========== RED BULL CHALLENGE (TRUE FINAL BOSS) ==========
    
    /**
     * Launch the Red Bull final boss match (Satan + Iceman)
     * 
     * @param {Object} ctx - LORB player context
     * @param {Object} options - Optional settings
     * @returns {Object} Result { completed, won, score, playerStats }
     */
    function launchRedBullChallenge(ctx, options) {
        options = options || {};
        var bossConfig = Config.RED_BULL_BOSS;
        
        // Show intro lore if not skipped
        if (!options.skipIntro) {
            showIntroScreen("THE RED BULL", bossConfig.LORE_INTRO, {
                bossName: bossConfig.NAME,
                bossTitle: bossConfig.TITLE,
                teammateName: bossConfig.TEAMMATE_NAME
            });
        }
        
        // Build teams
        var challengerTeam = buildChallengerTeam(ctx);
        
        var redBullTeam = {
            name: "The Red Bull",
            abbr: "666",
            players: [
                buildBossPlayer(bossConfig.SATAN),
                buildBossPlayer(bossConfig.ICEMAN)
            ],
            colors: bossConfig.TEAM_COLORS
        };
        
        // Game config
        var gameConfig = {
            teamA: challengerTeam,
            teamB: redBullTeam,
            options: {
                gameTime: 120,  // Longer game for the final boss
                mode: "play",
                humanTeam: "teamA",
                humanPlayerIndex: 0,
                showMatchupScreen: true,
                showGameOverScreen: true,
                difficulty: bossConfig.DIFFICULTY_OVERRIDE
            },
            lorbContext: {
                challenge: "red_bull",
                difficulty: bossConfig.DIFFICULTY_OVERRIDE,
                bossName: bossConfig.NAME,
                isFinalBoss: true
            }
        };
        
        // Launch game
        var result = runGame(gameConfig);
        
        // Process result
        var challengeResult = processResult(result, bossConfig, ctx);
        
        // Show result screen
        if (!options.skipOutro) {
            showResultScreen(challengeResult, bossConfig);
        }
        
        return challengeResult;
    }
    
    // ========== GAME EXECUTION ==========
    
    /**
     * Run the game via runExternalGame or simulate
     */
    function runGame(config) {
        if (typeof runExternalGame === "function") {
            return runExternalGame(config);
        }
        
        // Fallback simulation if real engine not available
        log(LOG_WARNING, "[RED_BULL_CHALLENGE] Real game engine not available, simulating");
        return simulateGame(config);
    }
    
    /**
     * Simulate a game if real engine unavailable
     */
    function simulateGame(config) {
        var difficulty = config.lorbContext.difficulty || 1.5;
        
        // Base win chance decreases with difficulty
        var winChance = Math.max(0.1, 0.6 - (difficulty * 0.15));
        var won = Math.random() < winChance;
        
        var teamAScore = won ? (21 + Math.floor(Math.random() * 10)) : (15 + Math.floor(Math.random() * 8));
        var teamBScore = won ? (teamAScore - 3 - Math.floor(Math.random() * 8)) : (teamAScore + 3 + Math.floor(Math.random() * 8));
        
        return {
            completed: true,
            winner: won ? "teamA" : "teamB",
            score: { teamA: teamAScore, teamB: teamBScore },
            playerStats: {
                "player": {
                    points: won ? 15 + Math.floor(Math.random() * 10) : 8 + Math.floor(Math.random() * 8),
                    rebounds: Math.floor(Math.random() * 8),
                    steals: Math.floor(Math.random() * 4),
                    blocks: Math.floor(Math.random() * 3),
                    assists: Math.floor(Math.random() * 5)
                }
            }
        };
    }
    
    /**
     * Process game result into challenge result
     */
    function processResult(gameResult, bossConfig, ctx) {
        var result = {
            completed: false,
            won: false,
            quit: false,
            score: { player: 0, boss: 0 },
            playerStats: null,
            bossName: bossConfig.NAME
        };
        
        if (!gameResult) {
            return result;
        }
        
        if (gameResult.exitReason === "quit") {
            result.quit = true;
            return result;
        }
        
        if (gameResult.completed) {
            result.completed = true;
            result.won = (gameResult.winner === "teamA");
            result.score = {
                player: gameResult.score.teamA,
                boss: gameResult.score.teamB
            };
            
            // Extract player stats
            if (gameResult.playerStats) {
                if (gameResult.playerStats["player"]) {
                    result.playerStats = gameResult.playerStats["player"];
                } else if (gameResult.playerStats["teamA_player1"]) {
                    result.playerStats = gameResult.playerStats["teamA_player1"];
                }
            }
        }
        
        return result;
    }
    
    // ========== UI SCREENS ==========
    
    /**
     * Show the intro screen with lore
     */
    function showIntroScreen(title, loreText, info) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.line("");
        LORB.View.line("\1h\1r\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\1n");
        LORB.View.line("\1h\1r\xDB\1n\1h\1w                                      \1h\1r\xDB\1n");
        LORB.View.line("\1h\1r\xDB\1n     \1h\1r" + centerText(title, 28) + "\1n     \1h\1r\xDB\1n");
        LORB.View.line("\1h\1r\xDB\1n\1h\1w                                      \1h\1r\xDB\1n");
        LORB.View.line("\1h\1r\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\xDB\1n");
        LORB.View.line("");
        LORB.View.line("\1h\1c" + info.bossName + "\1n \1w- " + info.bossTitle + "\1n");
        if (info.teammateName) {
            LORB.View.line("\1cTeammate: \1w" + info.teammateName + "\1n");
        }
        LORB.View.line("");
        
        // Wrap lore text
        var words = loreText.split(" ");
        var line = "";
        for (var i = 0; i < words.length; i++) {
            if ((line + " " + words[i]).length > 50) {
                LORB.View.line("\1y" + line + "\1n");
                line = words[i];
            } else {
                line = line ? (line + " " + words[i]) : words[i];
            }
        }
        if (line) {
            LORB.View.line("\1y" + line + "\1n");
        }
        
        LORB.View.line("");
        LORB.View.line("\1wPress any key to begin the challenge...\1n");
        console.getkey();
    }
    
    /**
     * Show the result screen
     */
    function showResultScreen(result, bossConfig) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.line("");
        
        if (result.quit) {
            LORB.View.line("\1y--- CHALLENGE ABANDONED ---\1n");
            LORB.View.line("");
            LORB.View.line("\1wYou fled from " + bossConfig.NAME + ".\1n");
            LORB.View.line("\1kThe challenge awaits your return...\1n");
        } else if (result.won) {
            LORB.View.line("\1h\1g\xDB\xDB\xDB VICTORY! \xDB\xDB\xDB\1n");
            LORB.View.line("");
            LORB.View.line("\1wFinal Score: \1g" + result.score.player + "\1w - \1r" + result.score.boss + "\1n");
            LORB.View.line("");
            LORB.View.line("\1g" + bossConfig.LORE_WIN + "\1n");
        } else {
            LORB.View.line("\1h\1r\xDB\xDB\xDB DEFEAT \xDB\xDB\xDB\1n");
            LORB.View.line("");
            LORB.View.line("\1wFinal Score: \1r" + result.score.player + "\1w - \1g" + result.score.boss + "\1n");
            LORB.View.line("");
            LORB.View.line("\1r" + bossConfig.LORE_LOSS + "\1n");
        }
        
        // Show player stats if available
        if (result.playerStats) {
            LORB.View.line("");
            LORB.View.line("\1c--- Your Stats ---\1n");
            var ps = result.playerStats;
            LORB.View.line("\1wPTS: \1c" + (ps.points || 0) + 
                           "\1w  REB: \1c" + (ps.rebounds || 0) +
                           "\1w  STL: \1c" + (ps.steals || 0) +
                           "\1w  BLK: \1c" + (ps.blocks || 0) + "\1n");
        }
        
        LORB.View.line("");
        LORB.View.line("\1wPress any key to continue...\1n");
        console.getkey();
    }
    
    /**
     * Center text in a given width
     */
    function centerText(text, width) {
        if (text.length >= width) return text;
        var padding = Math.floor((width - text.length) / 2);
        var result = "";
        for (var i = 0; i < padding; i++) result += " ";
        result += text;
        return result;
    }
    
    // ========== TEST MENU (for Crib) ==========
    
    /**
     * Show test menu for boss challenges (for Crib)
     * 
     * @param {Object} ctx - LORB player context
     * @returns {Object|null} Result of challenge or null if cancelled
     */
    function showTestMenu(ctx) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.line("");
        LORB.View.line("\1h\1r=== BOSS CHALLENGE TEST MENU ===\1n");
        LORB.View.line("");
        LORB.View.line("\1y[WARNING]\1w This is a test/debug feature.\1n");
        LORB.View.line("\1wIn the full game, these unlock after playoffs.\1n");
        LORB.View.line("");
        LORB.View.line("\1w[\1c1\1w] Jordan Challenge (Prep Match)\1n");
        LORB.View.line("\1w    vs Michael Jordan & Scottie Pippen\1n");
        LORB.View.line("");
        LORB.View.line("\1w[\1r2\1w] Red Bull Challenge (FINAL BOSS)\1n");
        LORB.View.line("\1w    vs Satan (The GOAT) & Iceman\1n");
        LORB.View.line("");
        LORB.View.line("\1w[\1kQ\1w] Back\1n");
        LORB.View.line("");
        
        var choice = LORB.View.prompt("Choice: ").toUpperCase();
        
        if (choice === "1") {
            return launchJordanChallenge(ctx);
        } else if (choice === "2") {
            return launchRedBullChallenge(ctx);
        }
        
        return null;
    }
    
    // ========== EXPORT ==========
    
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.RedBullChallenge = {
        launchJordanChallenge: launchJordanChallenge,
        launchRedBullChallenge: launchRedBullChallenge,
        showTestMenu: showTestMenu
    };
    
})();
