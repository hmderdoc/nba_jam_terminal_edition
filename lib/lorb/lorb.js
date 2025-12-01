// xtrn/lorb/lorb.js
load("sbbsdefs.js");
(function () {
    // ROOT is the directory where lorb.js lives (relative to main script exec_dir)
    var ROOT = js.exec_dir + "lib/lorb/";
    
    load(ROOT + "boot.js");           // creates global LORB and loads modules
    
    // Optional: load opponent display for ANSI art viewing
    try {
        load(ROOT + "get_random_opponent.js");
        load(js.exec_dir + "lib/lorb_shared/opponent-display.js");
    } catch (e) {
        // Opponent display not critical
    }

    // ========== MAIN ENTRY POINT ==========
    
    // Try to load existing character
    var ctx = LORB.Persist.load(user);
    
    if (!ctx || !ctx.archetype) {
        // New player - run character creation
        ctx = LORB.CharacterCreation.run(user, system);
        if (!ctx) {
            // User quit during creation - clean up and exit
            LORB.Persist.disconnect();
            return;
        }
    } else {
        // Existing player - welcome back
        ctx._user = user;  // Re-attach user object (not persisted)
        
        LORB.View.clear();
        LORB.View.header("LEGEND OF THE RED BULL");
        LORB.View.line("");
        LORB.View.line("\1cWelcome back, \1h" + (ctx.name || ctx.userHandle) + "\1n\1c.\1n");
        LORB.View.line("Day " + (ctx.day || 1) + " in Rim City.");
        LORB.View.line("");
        LORB.View.line("Record: \1g" + (ctx.wins || 0) + "W\1n - \1r" + (ctx.losses || 0) + "L\1n");
        LORB.View.line("Rep: \1c" + (ctx.rep || 0) + "\1n  |  Cash: \1y$" + (ctx.cash || 0) + "\1n");
        LORB.View.line("");
        LORB.View.line("\1wPress any key to enter Rim City...\1n");
        console.getkey();
    }

    // Initialize daily resources if this is a new day
    LORB.Locations.Hub.initDailyResources(ctx);
    
    // Reset day stats for tracking
    ctx.dayStats = { gamesPlayed: 0, wins: 0, losses: 0, cashEarned: 0, repGained: 0 };

    // Set presence (mark as online)
    LORB.Persist.setPresence(user);
    
    // Start heartbeat to keep presence alive
    var presenceInterval = js.setInterval(function() {
        LORB.Persist.setPresence(user);
    }, 30000);  // Every 30 seconds

    // Run the main Rim City hub loop
    var hubResult = LORB.Locations.Hub.run(ctx);
    
    // Stop heartbeat
    js.clearInterval(presenceInterval);
    
    // Clear presence (mark as offline)
    LORB.Persist.clearPresence(user);
    
    // Handle exit - don't save if character was reset
    if (hubResult === "reset") {
        LORB.View.close();
        LORB.Persist.disconnect();
        return;
    }
    
    // Save on exit
    LORB.Persist.save(ctx);
    LORB.Persist.disconnect();
    
    // Close the LORB view frame
    LORB.View.close();
    
    console.print("\r\nSee you tomorrow in Rim City...\r\n");
    mswait(1500);
})();
