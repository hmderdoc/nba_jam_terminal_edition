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
            
            // Update player record
            ctx.gamesPlayed = (ctx.gamesPlayed || 0) + 1;
            if (won) {
                ctx.wins = (ctx.wins || 0) + 1;
            } else {
                ctx.losses = (ctx.losses || 0) + 1;
            }
            
            return won;
        }
        
        // Fallback to mock
        LORB.View.info("\1k\1h(Simulating...)\1n");
        return LORB.Core.Battle.runAndMap("alley_1v1", ctx);
    }
    
    /**
     * Show character status
     */
    function showStatus(ctx) {
        LORB.View.clear();
        LORB.View.header(ctx.name || ctx.userHandle);
        LORB.View.line("");
        
        // Archetype and background
        var archetype = LORB.Data.ARCHETYPES[ctx.archetype];
        var background = LORB.Data.BACKGROUNDS[ctx.background];
        
        if (archetype) {
            LORB.View.line("\1wArchetype:\1n " + archetype.name);
        }
        if (background) {
            LORB.View.line("\1wBackground:\1n " + background.name);
        }
        LORB.View.line("\1wLevel:\1n " + (ctx.level || 1));
        LORB.View.line("");
        
        // Stats
        LORB.View.line("\1h\1ySTATS:\1n");
        if (ctx.stats) {
            var statLabels = {
                speed: "Speed",
                threePt: "3PT",
                power: "Power",
                steal: "Steal",
                block: "Block",
                dunk: "Dunk"
            };
            
            for (var stat in ctx.stats) {
                if (ctx.stats.hasOwnProperty(stat) && statLabels[stat]) {
                    var label = statLabels[stat];
                    while (label.length < 8) label += " ";
                    
                    var bar = "";
                    for (var b = 0; b < ctx.stats[stat]; b++) bar += "\1g█\1n";
                    for (var b = ctx.stats[stat]; b < 10; b++) bar += "\1k░\1n";
                    
                    LORB.View.line("  " + label + " " + bar + " " + ctx.stats[stat]);
                }
            }
        }
        
        LORB.View.line("");
        LORB.View.line("\1h\1yRESOURCES:\1n");
        LORB.View.line("  Cash:  \1g$" + (ctx.cash || 0) + "\1n");
        LORB.View.line("  XP:    " + (ctx.xp || 0));
        LORB.View.line("  Rep:   " + (ctx.rep || 0));
        
        LORB.View.line("");
        LORB.View.line("\1h\1yRECORD:\1n");
        LORB.View.line("  Games: " + (ctx.gamesPlayed || 0));
        LORB.View.line("  Wins:  " + (ctx.wins || 0));
        LORB.View.line("  Losses: " + (ctx.losses || 0));
        
        if (archetype && archetype.special) {
            LORB.View.line("");
            LORB.View.line("\1h\1ySPECIAL:\1n " + archetype.special.name);
            LORB.View.line("  " + archetype.special.description);
        }
        
        LORB.View.line("");
        LORB.View.line("\1wPress any key to continue...\1n");
        console.getkey();
    }

    // ========== MAIN ENTRY POINT ==========
    
    // Try to load existing character
    var ctx = LORB.Persist.load(user);
    
    if (!ctx || !ctx.archetype) {
        // New player - run character creation
        ctx = LORB.CharacterCreation.run(user, system);
        if (!ctx) {
            // User quit during creation
            return;
        }
    } else {
        // Existing player - welcome back
        ctx._user = user;  // Re-attach user object (not persisted)
        
        LORB.View.clear();
        LORB.View.title("Legend of the Red Bull", ctx.name || ctx.userHandle);
        LORB.View.line("");
        LORB.View.line("\1cWelcome back, " + (ctx.name || ctx.userHandle) + ".\1n");
        LORB.View.line("The courts of Rim City await.");
        LORB.View.line("");
        LORB.View.status(ctx);
        LORB.View.line("");
        LORB.View.line("\1wPress any key to continue...\1n");
        console.getkey();
    }

    // Main day loop
    var turns = ctx.dayTurns || LORB.Config.DEFAULT_TURNS;
    var lastOpponent = null;
    
    for (var t = 0; t < turns; t++) {
        LORB.View.clear();
        LORB.View.title("RIM CITY", ctx.name || ctx.userHandle);
        LORB.View.line("");
        LORB.View.line("Cash: \1g$" + (ctx.cash || 0) + "\1n  |  XP: " + (ctx.xp || 0) + "  |  Rep: " + (ctx.rep || 0));
        LORB.View.line("");
        LORB.View.line("\1h\1c=== Turn " + (t + 1) + " of " + turns + " ===\1n");
        LORB.View.line("");
        
        // Menu of actions
        LORB.View.line("\1w1\1n) Scout the streets");
        if (lastOpponent) {
            LORB.View.line("\1w2\1n) Challenge \1y" + (lastOpponent.displayName || lastOpponent.name) + "\1n");
        } else {
            LORB.View.line("\1k2) Challenge opponent (none scouted)\1n");
        }
        LORB.View.line("\1w3\1n) Random encounter");
        LORB.View.line("\1w4\1n) View stats");
        LORB.View.line("\1wQ\1n) End day early");
        LORB.View.line("");
        
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
                console.getkey();
            }
        } else if (choice === "3") {
            // Random event from events.ini
            var ev = LORB.Events.pickRandom(ctx);
            LORB.Events.run(ev, ctx);
        } else if (choice === "4") {
            // View stats
            showStatus(ctx);
            t--;  // Don't consume turn for viewing stats
        } else {
            LORB.View.warn("Invalid choice");
            t--;  // Don't consume turn
            console.getkey();
        }
        
        LORB.Persist.save(ctx);
    }

    LORB.View.clear();
    LORB.View.info("\r\n\1h\1gDay complete.\1n");
    LORB.View.line("");
    LORB.View.line("Record: " + (ctx.wins || 0) + "W - " + (ctx.losses || 0) + "L");
    LORB.View.line("Cash: $" + (ctx.cash || 0) + "  |  XP: " + (ctx.xp || 0) + "  |  Rep: " + (ctx.rep || 0));
    LORB.View.line("");
    
    LORB.Persist.save(ctx);
    
    console.print("\r\nPress any key to exit LORB...\r\n");
    console.getkey();
})();
