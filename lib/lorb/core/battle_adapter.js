// xtrn/lorb/core/battle_adapter.js
// Routes battles to real NBA JAM when available, mock engine as fallback
(function () {
    var MockEngine = LORB.Engines.NBAJam;      // Mock (always available)
    var RealEngine = LORB.Engines.NBAJamReal;  // Real (may not be loaded)

    // quick demo rosters for mock engine
    var USER_ROSTER = {
        team: "RIM CITY",
        players: [
            { player_id: "rc_blaze", player_name: "Blaze", player_team: "RIM CITY", position: "G", speed: 8, "3point": 7, power: 5, steal: 6, block: 4, dunk: 9 },
            { player_id: "rc_tower", player_name: "Tower", player_team: "RIM CITY", position: "F", speed: 6, "3point": 4, power: 9, steal: 4, block: 8, dunk: 8 }
        ]
    };
    var CPU_NETTOWN = {
        team: "NETTOWN",
        players: [
            { player_id: "nt_flash", player_name: "Flash", player_team: "NETTOWN", position: "G", speed: 9, "3point": 8, power: 4, steal: 7, block: 3, dunk: 7 },
            { player_id: "nt_brick", player_name: "Brick", player_team: "NETTOWN", position: "F", speed: 5, "3point": 3, power: 9, steal: 3, block: 9, dunk: 7 }
        ]
    };

    function teamOverall(players) {
        var i, sum = 0;
        for (i = 0; i < players.length; i++) {
            var p = players[i];
            sum += (p.speed + p["3point"] + p.power + p.steal + p.block + p.dunk) / 6;
        }
        return sum / Math.max(1, players.length);
    }

    /**
     * Check if we should use real game engine
     * Real engine used when: available AND battle is player-involved (not pure spectate)
     */
    function shouldUseRealEngine(templateKey) {
        if (!RealEngine || typeof RealEngine.isAvailable !== "function") return false;
        if (!RealEngine.isAvailable()) return false;
        // Use real engine for player battles
        return (templateKey === "alley_1v1" || templateKey === "dream_2v2" || templateKey === "street_challenge");
    }

    LORB.Core.Battle = {
        resolveTemplate: function (key, ctx) {
            var possessions = 36, home = USER_ROSTER, away = CPU_NETTOWN;
            if (key === "alley_1v1") {
                home = { team: USER_ROSTER.team, players: [USER_ROSTER.players[0]] };
                away = LORB.Data.CPU_TEAMS.CPU_HUSTLER || away;
                possessions = 24;
            } else if (key === "dream_2v2") {
                home = USER_ROSTER;
                away = LORB.Data.CPU_TEAMS.DREAM_GUARDS || away;
            }
            return { rosters: { home: home, away: away }, opts: { seed: ctx.seed, possessions: possessions, pace: 1.0 } };
        },
        
        /**
         * Run a battle with scouted opponent (uses real game if available)
         */
        runWithOpponent: function(opponent, ctx) {
            // Try real engine first
            if (RealEngine && RealEngine.isAvailable && RealEngine.isAvailable()) {
                var result = RealEngine.runStreetBattle(ctx, opponent, {
                    gameTime: 60,
                    difficulty: ctx.difficulty || 5
                });
                
                if (result && result.completed) {
                    // Map real game result to LORB format
                    var playerWon = (result.winner === "teamA");
                    
                    LORB.View.info("\r\n" + (playerWon ? "\1g\1hVICTORY!" : "\1r\1hDEFEAT") + "\1n");
                    LORB.View.info("Final Score: " + result.score.teamA + " - " + result.score.teamB);
                    
                    // Apply rewards/penalties
                    var delta = {
                        money: playerWon ? 500 : 50,
                        xp: playerWon ? 25 : 10,
                        rep: playerWon ? 3 : 1
                    };
                    LORB.Core.Economy.applySimple(ctx, delta);
                    
                    // Show player stats if available
                    if (result.playerStats) {
                        LORB.View.line("\r\n\1cYour Stats:\1n");
                        for (var pid in result.playerStats) {
                            if (result.playerStats.hasOwnProperty(pid)) {
                                var s = result.playerStats[pid];
                                LORB.View.line("  " + s.name + ": " + s.points + " PTS, " + 
                                    s.rebounds + " REB, " + s.assists + " AST");
                            }
                        }
                    }
                    
                    return playerWon;
                }
            }
            
            // Fallback to mock engine
            LORB.View.info("\1k\1h(Simulating battle...)\1n");
            return this.runAndMap("alley_1v1", ctx);
        },
        
        runAndMap: function (templateKey, ctx) {
            var pack = this.resolveTemplate(templateKey, ctx);
            var result = MockEngine.runLorbBattle(pack.rosters, pack.opts);

            // minimal summary to screen
            LORB.View.info("\r\nBattle: " + pack.rosters.home.team + " " + result.score.home + " -- "
                + pack.rosters.away.team + " " + result.score.away + "  |  Winner: " + result.winnerTeam);

            // economy mapping
            var delta = LORB.Core.OutcomeRules.map(result, ctx);
            LORB.Core.Economy.applySimple(ctx, { money: delta.money, xp: delta.xp, rep: delta.rep });
            if (delta.item) LORB.View.info("Loot: " + delta.item.name);
            if (delta.note) LORB.View.info(delta.note);

            // tiny box lines
            var i;
            for (i = 0; i < result.boxScore.length; i++) {
                var s = result.boxScore[i];
                LORB.View.line("  " + s.team + " :: " + s.playerId + "  PTS:" + s.pts + " REB:" + (s.reb || 0) + " AST:" + (s.ast || 0) + " STL:" + (s.stl || 0) + " BLK:" + (s.blk || 0));
            }
            
            return (result.winnerTeam === pack.rosters.home.team);
        },
        odds: function (A, B) {
            var oa = teamOverall(A.players), ob = teamOverall(B.players);
            var qa = Math.exp(oa / 2), qb = Math.exp(ob / 2);
            var pa = qa / (qa + qb);
            return { pA: pa, pB: 1 - pa };
        }
    };
})();