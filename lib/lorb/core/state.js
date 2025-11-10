// xtrn/lorb/core/state.js
(function () {
    var RNG = LORB.Util.RNG;
    LORB.State = {
        initForUser: function (u, systemObj) {
            var saved = LORB.Persist.load(u);
            if (saved) { saved._user = u; return saved; }

            var ctx = {
                _user: u,
                seed: (systemObj.timer ^ systemObj.timestr().length ^ (Date.now ? Date.now() : time())) & 0x7fffffff,
                userHandle: u && u.alias ? u.alias : "PLAYER",
                userTeam: LORB.Config.DEFAULT_USER_TEAM,
                userPlayerIds: LORB.Config.DEFAULT_USER_PLAYERS.slice(0),
                cash: 1000, xp: 0, rep: 0,
                dayTurns: LORB.Config.DEFAULT_TURNS,
                flags: {},
                // you can store roster here if you want; keeping hardcoded for brevity
            };
            return ctx;
        }
    };
})();