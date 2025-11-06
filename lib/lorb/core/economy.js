// xtrn/lorb/core/economy.js
(function () {
    LORB.Core = LORB.Core || {};
    LORB.Core.Economy = {
        applySimple: function (ctx, delta) {
            if (delta.cash) ctx.cash += delta.cash;
            if (delta.money) ctx.cash += delta.money;
            if (delta.xp) ctx.xp += delta.xp;
            if (delta.rep) ctx.rep += delta.rep;
        }
    };
    // expose helper for CPU teams registration
    LORB.Core.registerCpuTeams = function (lib) {
        LORB.Data = LORB.Data || {};
        LORB.Data.CPU_TEAMS = lib || {};
    };
})();