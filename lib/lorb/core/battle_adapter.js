// xtrn/lorb/core/battle_adapter.js
(function () {
    var NBA = LORB.Engines.NBAJam;

    // quick demo rosters (same as before)
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
        runAndMap: function (templateKey, ctx) {
            var pack = this.resolveTemplate(templateKey, ctx);
            var result = NBA.runLorbBattle(pack.rosters, pack.opts);

            // minimal summary to screen (UI responsibility ideally)
            LORB.View.info("\r\nBattle: " + pack.rosters.home.team + " " + result.score.home + " — "
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
        },
        odds: function (A, B) {
            var oa = teamOverall(A.players), ob = teamOverall(B.players);
            var qa = Math.exp(oa / 2), qb = Math.exp(ob / 2);
            var pa = qa / (qa + qb);
            return { pA: pa, pB: 1 - pa };
        }
    };
})();