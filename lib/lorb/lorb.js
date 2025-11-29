// xtrn/lorb/lorb.js
load("sbbsdefs.js");
(function () {
    var ROOT = js.exec_dir + "lib/lorb/";
    load(ROOT + "boot.js");           // creates global LORB and loads modules
    load(ROOT + "get_random_opponent.js");
    load(js.exec_dir + "lib/lorb_shared/opponent-display.js");

    /**
     * Scout an opponent - display their ANSI art and stats
     * Returns the opponent data if found, null otherwise
     */
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
            name: opponent.displayName || opponent.name || opponent.id || "Unknown Opponent",
            team: opponent.team || "Street Circuit",
            fileName: opponent.fileName,
            path: opponent.path,
            size: opponent.size,
            status: "Spotted near the courts.",
            stats: opponent.stats
        };

        var opponentDisplay = (typeof LORBShared !== "undefined" && LORBShared.OpponentDisplay)
            ? LORBShared.OpponentDisplay
            : null;

        if (opponentDisplay && typeof opponentDisplay.render === "function") {
            try {
                opponentDisplay.render([displayEntry], {
                    transitionMs: 0,
                    allowKeyAdvance: true,
                    emptySlotMessage: "Opponent intel unavailable"
                });
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
            if (opponent.stats) {
                LORB.View.line("  SPD:" + (opponent.stats.speed || "?") + 
                    " 3PT:" + (opponent.stats["3point"] || "?") +
                    " DNK:" + (opponent.stats.dunk || "?") +
                    " PWR:" + (opponent.stats.power || "?"));
            }
        }
        return opponent;
    }
    
    /**
     * Challenge the scouted opponent to a street game
     */
    function challengeOpponent(opponent, ctx) {
        if (!opponent) {
            LORB.View.warn("No opponent to challenge!");
            return false;
        }
        
        LORB.View.info("\r\n\1h\1y" + (opponent.displayName || opponent.name || "The challenger") + 
            " accepts your challenge!\1n\r\n");
        
        // Use real game engine if available
        if (LORB.Core.Battle && typeof LORB.Core.Battle.runWithOpponent === "function") {
            var won = LORB.Core.Battle.runWithOpponent(opponent, ctx);
            return won;
        }
        
        // Fallback to mock
        LORB.View.info("\1k\1h(Simulating...)\1n");
        return LORB.Core.Battle.runAndMap("alley_1v1", ctx);
    }

    LORB.View.clear();
    LORB.View.title("Legend of the Red Bull", user.alias || "PLAYER");

    // initialize player/world state
    var ctx = LORB.State.initForUser(user, system);
    LORB.View.status(ctx);

    // main day loop
    var turns = ctx.dayTurns;
    var lastOpponent = null;
    
    for (var t = 0; t < turns; t++) {
        LORB.View.line("\r\n\1h\1c=== Turn " + (t + 1) + " of " + turns + " ===\1n\r\n");
        
        // Menu of actions
        LORB.View.line("\1w1\1n) Scout the streets");
        LORB.View.line("\1w2\1n) Challenge opponent" + (lastOpponent ? " (" + (lastOpponent.displayName || lastOpponent.name) + ")" : " (none scouted)"));
        LORB.View.line("\1w3\1n) Random encounter");
        LORB.View.line("\1wQ\1n) End day early\r\n");
        
        var choice = LORB.View.prompt("Choice: ");
        
        if (choice === "Q" || choice === "q") {
            break;
        } else if (choice === "1") {
            // Scout for opponent
            lastOpponent = scoutOpponent(ctx);
        } else if (choice === "2") {
            // Challenge scouted opponent
            if (lastOpponent) {
                challengeOpponent(lastOpponent, ctx);
                lastOpponent = null;  // Can't challenge same person twice
            } else {
                LORB.View.warn("Scout an opponent first! (Option 1)");
                t--;  // Don't consume turn
            }
        } else if (choice === "3") {
            // Random event from events.ini
            var ev = LORB.Events.pickRandom(ctx);
            LORB.Events.run(ev, ctx);
        } else {
            LORB.View.warn("Invalid choice");
            t--;  // Don't consume turn
        }
        
        LORB.View.status(ctx);
        LORB.Persist.save(ctx);
    }

    LORB.View.info("\r\n\1h\1gDay complete.\1n");
    LORB.View.status(ctx);
    
    console.print("\r\nPress any key to exit LORB...\r\n");
    console.getkey();
})();
