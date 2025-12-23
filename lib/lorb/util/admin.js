/**
 * admin.js - Game Administrator Tools
 * 
 * Provides admin-only features for testing and management:
 * - Time advancement (skip days)
 * - Give money/rep
 * - Reset character
 * 
 * Access restricted to authorized users only.
 */

(function() {
    // NOTE: Do not use "use strict" - Synchronet color codes use octal-like \1 escapes
    
    // =========================================================================
    // ADMIN CONFIGURATION
    // =========================================================================
    
    /**
     * List of authorized admins.
     * Each entry can specify:
     * - username: Case-insensitive username/alias match
     * - userNumber: Synchronet user number (1-based)
     * - bbs: BBS identifier (system.qwk_id or system.name)
     * 
     * User must match BOTH the user criteria AND the bbs to be considered admin.
     */
    var AUTHORIZED_ADMINS = [
        { userNumber: 1, qwkId: "FUTURELD" }
    ];
    
    // =========================================================================
    // ADMIN CHECK
    // =========================================================================
    
    /**
     * Check if the current user is an authorized admin.
     * 
     * @param {Object} ctx - Player context (must have _user attached)
     * @returns {boolean} True if user is an admin
     */
    function isAdmin(ctx) {
        if (!ctx || !ctx._user) {
            return false;
        }
        
        var u = ctx._user;
        
        // Get current BBS identifiers
        var currentQwkId = "";
        var currentBbsName = "";
        if (typeof system !== "undefined") {
            currentQwkId = (system.qwk_id || "").toUpperCase();
            currentBbsName = (system.name || "").toLowerCase();
        }
        
        // Get user info
        var currentUsername = (u.alias || u.name || "").toLowerCase();
        var currentUserNumber = u.number || 0;
        
        // Check each authorized admin entry
        for (var i = 0; i < AUTHORIZED_ADMINS.length; i++) {
            var admin = AUTHORIZED_ADMINS[i];
            var bbsMatch = false;
            var userMatch = false;
            
            // Check BBS match - qwkId takes precedence (more unique)
            if (admin.qwkId) {
                bbsMatch = currentQwkId === admin.qwkId.toUpperCase();
            } else if (admin.bbsName) {
                bbsMatch = currentBbsName === admin.bbsName.toLowerCase();
            }
            
            if (!bbsMatch) {
                continue;
            }
            
            // Check user match (username OR userNumber)
            if (admin.username && currentUsername === admin.username.toLowerCase()) {
                userMatch = true;
            }
            if (admin.userNumber && currentUserNumber === admin.userNumber) {
                userMatch = true;
            }
            
            if (userMatch) {
                return true;
            }
        }
        
        return false;
    }
    
    // =========================================================================
    // ADMIN ACTIONS
    // =========================================================================
    
    /**
     * Advance game time by N days.
     * Affects the shared world state (all players see the time change).
     * 
     * @param {number} days - Number of days to advance
     * @returns {Object} Result with success flag and new game day
     */
    function advanceTime(days) {
        if (!days || days < 1) {
            days = 1;
        }
        
        var advanced = 0;
        for (var i = 0; i < days; i++) {
            if (LORB.SharedState && LORB.SharedState.forceAdvanceDay) {
                if (LORB.SharedState.forceAdvanceDay()) {
                    advanced++;
                }
            }
        }
        
        var newDay = 1;
        if (LORB.SharedState && LORB.SharedState.getGameDay) {
            newDay = LORB.SharedState.getGameDay();
        }
        
        return {
            success: advanced > 0,
            daysAdvanced: advanced,
            newGameDay: newDay
        };
    }
    
    /**
     * Give money to a player.
     * 
     * @param {Object} ctx - Player context
     * @param {number} amount - Amount of cash to give
     * @returns {Object} Result with success flag and new balance
     */
    function giveMoney(ctx, amount) {
        if (!ctx || !amount || amount < 0) {
            return { success: false, reason: "Invalid parameters" };
        }
        
        ctx.cash = (ctx.cash || 0) + amount;
        
        return {
            success: true,
            amountGiven: amount,
            newBalance: ctx.cash
        };
    }
    
    /**
     * Give rep to a player.
     * 
     * @param {Object} ctx - Player context
     * @param {number} amount - Amount of rep to give
     * @returns {Object} Result with success flag and new rep
     */
    function giveRep(ctx, amount) {
        if (!ctx || !amount || amount < 0) {
            return { success: false, reason: "Invalid parameters" };
        }
        
        ctx.rep = (ctx.rep || 0) + amount;
        
        return {
            success: true,
            amountGiven: amount,
            newRep: ctx.rep
        };
    }
    
    /**
     * Reset (delete) a player's character.
     * 
     * @param {Object} ctx - Player context
     * @returns {string|null} Returns "reset" if character was deleted, null otherwise
     */
    function resetCharacter(ctx) {
        if (!ctx || !ctx._user) {
            return null;
        }
        
        LORB.View.init();
        LORB.View.clear();
        LORB.View.line("");
        LORB.View.line("\1r\1h*** CHARACTER RESET ***\1n");
        LORB.View.line("");
        LORB.View.line("This will DELETE your character permanently.");
        LORB.View.line("You will need to create a new character next time.");
        LORB.View.line("");
        
        if (LORB.View.confirm("Are you sure? Type Y to confirm: ")) {
            var removeResult = LORB.Persist.remove(ctx._user);
            LORB.View.line("");
            if (removeResult) {
                LORB.View.line("\1gCharacter deleted successfully.\1n");
            } else {
                LORB.View.line("\1rFailed to delete from database, clearing locally.\1n");
            }
            ctx.archetype = null;
            ctx._deleted = true;
            LORB.View.line("\1yGoodbye. You'll start fresh next time.\1n");
            LORB.View.line("");
            console.getkey(K_NOSPIN);
            return "reset";
        }
        
        return null;
    }
    
    // =========================================================================
    // ADMIN MENU UI
    // =========================================================================
    
    /**
     * Show the admin menu with all available tools.
     * 
     * @param {Object} ctx - Player context
     * @returns {string|null} Returns "reset" if character was reset, null otherwise
     */
    function showAdminMenu(ctx) {
        var running = true;
        
        while (running) {
            LORB.View.init();
            LORB.View.clear();
            LORB.View.header("ADMIN TOOLS");
            LORB.View.line("");
            LORB.View.line("\1h\1r*** FOR TESTING PURPOSES ONLY ***\1n");
            LORB.View.line("");
            
            // Show current state
            var currentDay = 1;
            var seasonLength = LORB.Config.SEASON_LENGTH_DAYS || 30;
            if (LORB.SharedState && LORB.SharedState.getGameDay) {
                currentDay = LORB.SharedState.getGameDay();
            }
            var currentCity = LORB.Cities ? LORB.Cities.getToday() : null;
            var cityName = currentCity ? currentCity.cityName : "Unknown";
            
            LORB.View.line("\1wCurrent Game Day: \1c" + currentDay + "/" + seasonLength + "\1n");
            LORB.View.line("\1wCurrent City: \1c" + cityName + "\1n");
            LORB.View.line("\1wYour Cash: \1y$" + (ctx.cash || 0) + "\1n");
            LORB.View.line("\1wYour Rep: \1g" + (ctx.rep || 0) + "\1n");
            LORB.View.line("");
            
            LORB.View.line("\1h\1w1) \1nAdvance Time (skip days)");
            LORB.View.line("\1h\1w2) \1nGive Money");
            LORB.View.line("\1h\1w3) \1nGive Rep");
            LORB.View.line("\1h\1w4) \1nList Relationships");
            LORB.View.line("\1h\1w5) \1nSet Pregnancy");
            LORB.View.line("\1h\1w6) \1nClear Pregnancies");
            LORB.View.line("\1h\1r7) \1nReset Character");
            LORB.View.line("\1h\1w8) \1nRemove Baby Ballers");
            LORB.View.line("");
            LORB.View.line("\1h\1wQ) \1nBack");
            LORB.View.line("");
            LORB.View.line("\1h\1kChoice: \1n");
            
            var choice = console.getkey(K_NOSPIN).toUpperCase();
            
            switch (choice) {
                case "1":
                    showAdvanceTimeMenu(ctx);
                    break;
                    
                case "2":
                    showGiveMoneyMenu(ctx);
                    break;
                    
                case "3":
                    showGiveRepMenu(ctx);
                    break;
                    
                case "4":
                    showRelationshipsMenu(ctx);
                    break;
                    
                case "5":
                    showSetPregnancyMenu(ctx);
                    break;
                    
                case "6":
                    clearPregnancies(ctx);
                    break;
                    
                case "7":
                    var resetResult = resetCharacter(ctx);
                    if (resetResult === "reset") {
                        return "reset";
                    }
                    break;
                    
                case "8":
                    showRemoveBabyBallersMenu(ctx);
                    break;
                    
                case "Q":
                    running = false;
                    break;
            }
        }
        
        return null;
    }
    
    /**
     * Sub-menu for advancing time.
     */
    function showAdvanceTimeMenu(ctx) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("ADVANCE TIME");
        LORB.View.line("");
        
        var currentDay = LORB.SharedState ? LORB.SharedState.getGameDay() : 1;
        LORB.View.line("\1wCurrent Game Day: \1c" + currentDay + "\1n");
        LORB.View.line("");
        LORB.View.line("\1yHow many days to advance?\1n");
        LORB.View.line("\1h\1k(1-30, or Q to cancel): \1n");
        
        var input = console.getstr("", 3, K_UPPER);
        
        if (!input || input === "Q") {
            return;
        }
        
        var days = parseInt(input, 10);
        if (isNaN(days) || days < 1 || days > 30) {
            LORB.View.line("\1rInvalid number. Enter 1-30.\1n");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var result = advanceTime(days);
        
        LORB.View.line("");
        if (result.success) {
            LORB.View.line("\1gAdvanced " + result.daysAdvanced + " day(s).\1n");
            LORB.View.line("\1wNew Game Day: \1c" + result.newGameDay + "\1n");
            
            // Show new city
            var newCity = LORB.Cities ? LORB.Cities.getToday() : null;
            if (newCity) {
                LORB.View.line("\1wNew City: \1c" + newCity.cityName + "\1n");
            }
            
            // Refresh player's daily resources for the time skip
            if (LORB.Locations && LORB.Locations.Hub && LORB.Locations.Hub.initDailyResources) {
                // Update lastPlayedTimestamp to simulate time passage
                var dayDuration = LORB.Config.DAY_DURATION_MS || 86400000;
                ctx.lastPlayedTimestamp = (ctx.lastPlayedTimestamp || Date.now()) - (days * dayDuration);
                LORB.Locations.Hub.initDailyResources(ctx);
                LORB.View.line("\1yDaily resources refreshed!\1n");
            }
        } else {
            LORB.View.line("\1rFailed to advance time.\1n");
        }
        
        LORB.View.line("");
        LORB.View.line("\1h\1kPress any key...\1n");
        console.getkey(K_NOSPIN);
    }
    
    /**
     * Sub-menu for giving money.
     */
    function showGiveMoneyMenu(ctx) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("GIVE MONEY");
        LORB.View.line("");
        LORB.View.line("\1wCurrent Cash: \1y$" + (ctx.cash || 0) + "\1n");
        LORB.View.line("");
        LORB.View.line("\1yHow much money to give?\1n");
        LORB.View.line("\1h\1k(Amount, or Q to cancel): \1n");
        
        var input = console.getstr("", 10, K_UPPER);
        
        if (!input || input === "Q") {
            return;
        }
        
        var amount = parseInt(input, 10);
        if (isNaN(amount) || amount < 1) {
            LORB.View.line("\1rInvalid amount.\1n");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var result = giveMoney(ctx, amount);
        
        LORB.View.line("");
        if (result.success) {
            LORB.View.line("\1gGave $" + result.amountGiven + ".\1n");
            LORB.View.line("\1wNew Balance: \1y$" + result.newBalance + "\1n");
        } else {
            LORB.View.line("\1rFailed: " + (result.reason || "Unknown error") + "\1n");
        }
        
        LORB.View.line("");
        LORB.View.line("\1h\1kPress any key...\1n");
        console.getkey(K_NOSPIN);
    }
    
    /**
     * Sub-menu for giving rep.
     */
    function showGiveRepMenu(ctx) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("GIVE REP");
        LORB.View.line("");
        LORB.View.line("\1wCurrent Rep: \1g" + (ctx.rep || 0) + "\1n");
        LORB.View.line("");
        LORB.View.line("\1yHow much rep to give?\1n");
        LORB.View.line("\1h\1k(Amount, or Q to cancel): \1n");
        
        var input = console.getstr("", 10, K_UPPER);
        
        if (!input || input === "Q") {
            return;
        }
        
        var amount = parseInt(input, 10);
        if (isNaN(amount) || amount < 1) {
            LORB.View.line("\1rInvalid amount.\1n");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var result = giveRep(ctx, amount);
        
        LORB.View.line("");
        if (result.success) {
            LORB.View.line("\1gGave " + result.amountGiven + " rep.\1n");
            LORB.View.line("\1wNew Rep: \1g" + result.newRep + "\1n");
        } else {
            LORB.View.line("\1rFailed: " + (result.reason || "Unknown error") + "\1n");
        }
        
        LORB.View.line("");
        LORB.View.line("\1h\1kPress any key...\1n");
        console.getkey(K_NOSPIN);
    }
    
    /**
     * List all relationships with status and affection.
     */
    function showRelationshipsMenu(ctx) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("RELATIONSHIPS");
        LORB.View.line("");
        
        if (!ctx.romance || !ctx.romance.relationships) {
            LORB.View.line("\1rNo relationships found.\1n");
            LORB.View.line("");
            LORB.View.line("\1h\1kPress any key...\1n");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var hasAny = false;
        for (var npcName in ctx.romance.relationships) {
            if (ctx.romance.relationships.hasOwnProperty(npcName)) {
                hasAny = true;
                var rel = ctx.romance.relationships[npcName];
                var statusColor = rel.status === "spouse" ? "\1h\1m" : 
                                  rel.status === "partner" ? "\1g" : "\1w";
                LORB.View.line("\1c" + npcName + "\1n - " + statusColor + rel.status + "\1n (" + rel.affection + " affection)");
            }
        }
        
        if (!hasAny) {
            LORB.View.line("\1rNo relationships found.\1n");
        }
        
        LORB.View.line("");
        LORB.View.line("\1h\1kPress any key...\1n");
        console.getkey(K_NOSPIN);
    }
    
    /**
     * Set a pregnancy for an NPC.
     */
    function showSetPregnancyMenu(ctx) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("SET PREGNANCY");
        LORB.View.line("");
        
        if (!ctx.romance || !ctx.romance.relationships) {
            LORB.View.line("\1rNo relationships found. Flirt with someone first.\1n");
            LORB.View.line("");
            LORB.View.line("\1h\1kPress any key...\1n");
            console.getkey(K_NOSPIN);
            return;
        }
        
        // Show list of NPCs
        var npcs = [];
        for (var npcName in ctx.romance.relationships) {
            if (ctx.romance.relationships.hasOwnProperty(npcName)) {
                npcs.push({
                    name: npcName,
                    rel: ctx.romance.relationships[npcName]
                });
            }
        }
        
        if (npcs.length === 0) {
            LORB.View.line("\1rNo relationships found.\1n");
            LORB.View.line("");
            LORB.View.line("\1h\1kPress any key...\1n");
            console.getkey(K_NOSPIN);
            return;
        }
        
        LORB.View.line("\1wSelect NPC:\1n");
        LORB.View.line("");
        
        for (var i = 0; i < npcs.length && i < 9; i++) {
            var npc = npcs[i];
            LORB.View.line("\1h\1w" + (i + 1) + ") \1n\1c" + npc.name + "\1n (" + npc.rel.status + ", " + npc.rel.affection + " affection)");
        }
        
        LORB.View.line("");
        LORB.View.line("\1h\1kQ) Cancel\1n");
        LORB.View.line("");
        
        var choice = console.getkey(K_NOSPIN).toUpperCase();
        
        if (choice === "Q") return;
        
        var index = parseInt(choice, 10) - 1;
        if (isNaN(index) || index < 0 || index >= npcs.length) {
            LORB.View.line("\1rInvalid choice.\1n");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var selectedNpc = npcs[index];
        
        // Get game day
        var gameDay = 1;
        if (LORB.SharedState && LORB.SharedState.getGameDay) {
            gameDay = LORB.SharedState.getGameDay();
        }
        
        // Create pregnancy
        if (!ctx.pregnancies) {
            ctx.pregnancies = [];
        }
        
        // Check if already pregnant
        for (var i = 0; i < ctx.pregnancies.length; i++) {
            if (ctx.pregnancies[i].npcName === selectedNpc.name) {
                LORB.View.line("");
                LORB.View.line("\1r" + selectedNpc.name + " is already pregnant!\1n");
                LORB.View.line("");
                LORB.View.line("\1h\1kPress any key...\1n");
                console.getkey(K_NOSPIN);
                return;
            }
        }
        
        // Create pregnancy (Phase 1 - hidden)
        var pregnancy = {
            npcId: selectedNpc.name,
            npcName: selectedNpc.name,
            cityId: selectedNpc.rel.cityId || "bos",
            phase: 1,
            count: 1,
            conceivedOnDay: gameDay,
            discoveredOnDay: null,
            projectedStats: null,
            projectedAppearance: null,
            projectedCost: null,
            paymentChoice: null,
            isCompanionPregnancy: false
        };
        
        ctx.pregnancies.push(pregnancy);
        
        LORB.View.line("");
        LORB.View.line("\1g" + selectedNpc.name + " is now pregnant!\1n");
        LORB.View.line("\1wCity: \1c" + pregnancy.cityId + "\1n");
        LORB.View.line("\1wReveal will trigger on day " + (gameDay + 3) + "+ when visiting " + pregnancy.cityId + "\1n");
        LORB.View.line("");
        LORB.View.line("\1h\1kPress any key...\1n");
        console.getkey(K_NOSPIN);
    }
    
    /**
     * Clear all pregnancies.
     */
    function clearPregnancies(ctx) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("CLEAR PREGNANCIES");
        LORB.View.line("");
        
        if (!ctx.pregnancies || ctx.pregnancies.length === 0) {
            LORB.View.line("\1rNo pregnancies found.\1n");
            LORB.View.line("");
            LORB.View.line("\1h\1kPress any key...\1n");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var count = ctx.pregnancies.length;
        ctx.pregnancies = [];
        
        LORB.View.line("\1gCleared " + count + " pregnancy(ies).\1n");
        LORB.View.line("");
        LORB.View.line("\1h\1kPress any key...\1n");
        console.getkey(K_NOSPIN);
    }
    
    /**
     * Remove baby ballers from the player (testing/reset)
     */
    function showRemoveBabyBallersMenu(ctx) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("REMOVE BABY BALLERS");
        LORB.View.line("");
        
        if (!ctx.babyBallers || ctx.babyBallers.length === 0) {
            LORB.View.line("\1yYou have no baby ballers.\1n");
            LORB.View.line("\1wPress any key...\1n");
            console.getkey(K_NOSPIN);
            return;
        }
        
        LORB.View.line("\1wSelect a child to remove (\1c1-" + ctx.babyBallers.length + "\1n), \1hA\1n = All, \1hQ\1n = Cancel");
        LORB.View.line("");
        for (var i = 0; i < ctx.babyBallers.length; i++) {
            var bb = ctx.babyBallers[i];
            var label = (i + 1) + ") " + (bb.nickname || bb.name || "Baby");
            if (bb.motherName) label += " \1c[" + bb.motherName + "]\1n";
            LORB.View.line(label);
        }
        LORB.View.line("");
        LORB.View.line("\1h\1kChoice: \1n");
        
        var rawChoice = console.getstr("", 3, K_NUMBER | K_UPPER);
        if (!rawChoice) return;
        var choice = rawChoice.trim().toUpperCase();
        if (choice === "Q") return;
        
        if (choice === "A") {
            LORB.View.line("");
            LORB.View.line("\1h\1rRemove ALL baby ballers? (Y/N)\1n");
            LORB.View.render();
            if (console.getkey(K_NOSPIN).toUpperCase() !== "Y") return;
            removeBabyBallersByIndices(ctx, null);
            LORB.View.line("\1gAll baby ballers removed.\1n");
            LORB.View.line("\1wPress any key...\1n");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var idx = parseInt(choice, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= ctx.babyBallers.length) {
            return;
        }
        
        var target = ctx.babyBallers[idx];
        LORB.View.line("");
        LORB.View.line("\1h\1rRemove " + (target.nickname || target.name || "this child") + "? (Y/N)\1n");
        LORB.View.render();
        if (console.getkey(K_NOSPIN).toUpperCase() !== "Y") return;
        
        removeBabyBallersByIndices(ctx, [idx]);
        LORB.View.line("\1gRemoved.\1n");
        LORB.View.line("\1wPress any key...\1n");
        console.getkey(K_NOSPIN);
    }
    
    function removeBabyBallersByIndices(ctx, indices) {
        if (!ctx.babyBallers || ctx.babyBallers.length === 0) return;
        
        var idsToRemove = {};
        if (indices === null) {
            for (var i = 0; i < ctx.babyBallers.length; i++) {
                idsToRemove[ctx.babyBallers[i].id] = true;
            }
        } else {
            for (var j = 0; j < indices.length; j++) {
                var idx = indices[j];
                if (ctx.babyBallers[idx]) {
                    idsToRemove[ctx.babyBallers[idx].id] = true;
                }
            }
        }
        
        // Remove from world registry
        if (LORB.Data && LORB.Data.BabyBallers && LORB.Data.BabyBallers.removeFromWorldRegistry) {
            for (var id in idsToRemove) {
                LORB.Data.BabyBallers.removeFromWorldRegistry(id);
            }
        }
        
        // Remove from baby mamas
        if (ctx.babyMamas) {
            for (var m = 0; m < ctx.babyMamas.length; m++) {
                var bm = ctx.babyMamas[m];
                if (bm.childrenIds && bm.childrenIds.length > 0) {
                    bm.childrenIds = bm.childrenIds.filter(function(cid) { return !idsToRemove[cid]; });
                }
            }
        }
        
        // Remove from context
        ctx.babyBallers = ctx.babyBallers.filter(function(bb) { return !idsToRemove[bb.id]; });
        
        // Recompute parenting stats
        if (LORB.Data && LORB.Data.BabyBallers && LORB.Data.BabyBallers.updateParentingStats) {
            LORB.Data.BabyBallers.updateParentingStats(ctx);
        }
    }
    
    // =========================================================================
    // EXPORT
    // =========================================================================
    
    if (!LORB.Util) LORB.Util = {};
    LORB.Admin = {
        isAdmin: isAdmin,
        showAdminMenu: showAdminMenu,
        advanceTime: advanceTime,
        giveMoney: giveMoney,
        giveRep: giveRep,
        resetCharacter: resetCharacter
    };
    
})();
