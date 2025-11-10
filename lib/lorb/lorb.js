// xtrn/lorb/lorb.js
load("sbbsdefs.js");
(function () {
    var ROOT = js.exec_dir + "lib/lorb/";
    load(ROOT + "boot.js");           // creates global LORB and loads modules
    load(ROOT + "get_random_opponent.js");
    load(js.exec_dir + "lib/lorb_shared/opponent-display.js");

    function scoutOpponent(ctx) {
        if (!LORB || typeof LORB.getRandomOpponent !== "function") return null;

        var opponent;
        try {
            opponent = LORB.getRandomOpponent();
        } catch (err) {
            if (LORB.View && LORB.View.warn) {
                LORB.View.warn("Unable to scout opponent: " + err);
            }
            return null;
        }
        if (!opponent) return null;

        var displayEntry = {
            id: opponent.id,
            name: opponent.id || opponent.fileName || "Unknown Opponent",
            team: opponent.team || "Street Circuit",
            fileName: opponent.fileName,
            path: opponent.path,
            size: opponent.size,
            status: "Spotted near the courts."
        };

        var opponentDisplay = (typeof LORBShared !== "undefined" && LORBShared.OpponentDisplay)
            ? LORBShared.OpponentDisplay
            : null;

        if (opponentDisplay && typeof opponentDisplay.render === "function") {
            var layout = null;
            try {
                layout = opponentDisplay.render([displayEntry], {
                    transitionMs: 0,
                    allowKeyAdvance: true,
                    emptySlotMessage: "Opponent intel unavailable"
                });
                if (console && typeof console.getkey === "function") {
                    console.print("\r\nPress any key to continue...\r\n");
                    console.getkey();
                }
            } catch (displayErr) {
                if (LORB.View && LORB.View.warn) {
                    LORB.View.warn("Opponent display failed: " + displayErr);
                }
            } finally {
                if (typeof opponentDisplay.destroy === "function") {
                    opponentDisplay.destroy();
                }
            }
        } else if (LORB.View && LORB.View.info) {
            LORB.View.info("Scouted opponent: " + displayEntry.name);
        }
        return opponent;
    }

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
        scoutOpponent(ctx);
        var ev = LORB.Events.pickRandom(ctx);
        LORB.Events.run(ev, ctx);       // resolves choice/battle/gamble with adapter
        LORB.View.status(ctx);
        LORB.Persist.save(ctx);
    }

    LORB.View.info("\r\n\1h\1gDay complete.\1n");
    LORB.View.status(ctx);
})();
