// xtrn/lorb/core/rules.js
(function () {
    function styleBonus(box) {
        var i, style = 1.0;
        for (i = 0; i < box.length; i++) {
            var s = box[i];
            style += ((s.dunks || 0) * 0.03 + (s.stl || 0) * 0.02 + (s.blk || 0) * 0.02);
        }
        if (style > 1.6) style = 1.6;
        return style;
    }
    LORB.Core.OutcomeRules = {
        map: function (gameResult, ctx) {
            var win = (gameResult.winnerTeam === ctx.userTeam);
            var margin = Math.abs(gameResult.score.home - gameResult.score.away);
            var mvpBoost = 1.0;
            var i;
            for (i = 0; i < gameResult.boxScore.length; i++) {
                if (gameResult.boxScore[i].playerId === gameResult.mvpPlayerId) { mvpBoost = 1.15; break; }
            }
            var sb = styleBonus(gameResult.boxScore);
            var xp = Math.floor((win ? 30 : 10) * (1 + margin / 20) * sb * mvpBoost);
            var rep = Math.floor((win ? 5 : 1) * sb);
            var money = Math.floor((win ? 200 : 80) * (ctx.flags.sponsored_ads ? 1.25 : 1));
            var drop = null;
            if (sb > 1.3 && Math.random() < (0.05 + 0.02 * (ctx.flags.independent_spirit ? 0 : 1))) {
                drop = { id: "rb_last_dance", name: "Red Bull: Last Dance" };
            }
            return { xp: xp, rep: rep, money: money, item: drop, note: (win ? "You dominated the blacktop." : "You learned from the loss.") };
        }
    };
})();