// xtrn/lorb/lorb.js
load("sbbsdefs.js");
(function () {
    var ROOT = js.exec_dir + "lib/lorb/";
    load(ROOT + "boot.js");           // creates global LORB and loads modules

    LORB.View.clear();
    LORB.View.title("Legend of the Red Bull", user.alias || "PLAYER");

    // initialize player/world state
    var ctx = LORB.State.initForUser(user, system);
    LORB.View.status(ctx);

    // main day loop (small, readable)
    var turns = ctx.dayTurns;
    var t;
    for (t = 0; t < turns; t++) {
        if (!LORB.View.confirm("\1h\1c[Turn " + (t + 1) + "] Explore streets? (Y/N) ")) break;
        var ev = LORB.Events.pickRandom(ctx);
        LORB.Events.run(ev, ctx);       // resolves choice/battle/gamble with adapter
        LORB.View.status(ctx);
        LORB.Persist.save(ctx);
    }

    LORB.View.info("\r\n\1h\1gDay complete.\1n");
    LORB.View.status(ctx);
})();