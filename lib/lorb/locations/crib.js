/**
 * crib.js - Player's Home (Your Crib)
 * 
 * Home base for managing crew and viewing personal stats.
 * Submenus: Contacts (Rolodex), Your Crew, Stats & Records
 */

var _cribRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _cribRichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[CRIB] Failed to load RichView: " + e);
}

// Load BinLoader for .bin file loading
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
        log(LOG_WARNING, "[CRIB] Failed to load bin-loader.js: " + e);
    }
}

(function() {
    
    var RichView = _cribRichView;
    
    // Art file paths
    var ART_HEADER = "/sbbs/xtrn/nba_jam/assets/lorb/crib_header.bin";
    var ART_HEADER_W = 80;
    var ART_HEADER_H = 4;
    
    var ART_SIDE = "/sbbs/xtrn/nba_jam/assets/lorb/crib_art.bin";
    var ART_SIDE_W = 40;
    var ART_SIDE_H = 20;
    
    var CHARACTERS_DIR = "/sbbs/xtrn/nba_jam/assets/characters/";
    var CHAR_ART_W = 40;
    var CHAR_ART_H = 20;
    
    // Crew constants
    var MAX_CREW_SIZE = 5;
    
    /**
     * Handle character reset - deletes character data and flags for restart
     */
    function handleReset(ctx) {
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
            console.getkey();
            return "reset";
        }
        return null;
    }
    
    /**
     * Main entry point
     */
    function run(ctx) {
        // Initialize contacts/crew arrays if missing
        if (!ctx.contacts) ctx.contacts = [];
        if (!ctx.crew) ctx.crew = [];
        
        if (RichView) {
            return runRichView(ctx);
        } else {
            return runLegacy(ctx);
        }
    }
    
    /**
     * RichView main menu
     */
    function runRichView(ctx) {
        while (true) {
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 4 },
                    { name: "art", x: 1, y: 5, width: 40, height: 20 },
                    { name: "content", x: 41, y: 5, width: 40, height: 20 }
                ],
                theme: "lorb"
            });
            
            loadArtWithBinLoader(view);
            
            view.setContentZone("content");
            view.setCursorY(0);
            
            view.blank();
            view.line("\1h\1cYOUR CRIB\1n");
            view.blank();
            view.line("Home sweet home.");
            view.line("Manage your crew and check stats.");
            view.blank();
            view.line("\1wCrew: \1c" + ctx.crew.length + "/" + MAX_CREW_SIZE + "\1n");
            view.line("\1wContacts: \1c" + ctx.contacts.length + "\1n");
            view.blank();
            view.info("[Arrows] Select [ENTER] Confirm");
            
            var menuItems = [
                { text: "Contacts (Rolodex)", value: "contacts", hotkey: "1" },
                { text: "Your Crew", value: "crew", hotkey: "2" },
                { text: "Stats & Records", value: "stats", hotkey: "3" },
                { text: "Back to Rim City", value: "back", hotkey: "Q" },
                { text: "\1r[Reset Character]\1n", value: "reset", hotkey: "R" }
            ];
            
            var choice = view.menu(menuItems, { y: 11 });
            view.close();
            
            switch (choice) {
                case "contacts":
                    runContacts(ctx);
                    break;
                case "crew":
                    runCrew(ctx);
                    break;
                case "stats":
                    if (LORB.UI && LORB.UI.StatsView) {
                        LORB.UI.StatsView.show(ctx);
                    }
                    break;
                case "reset":
                    var resetResult = handleReset(ctx);
                    if (resetResult === "reset") {
                        return "reset";
                    }
                    break;
                case "back":
                case null:
                    return;
            }
        }
    }
    
    /**
     * Contacts (Rolodex) view - NBA players you've defeated
     */
    function runContacts(ctx) {
        while (true) {
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 3 },
                    { name: "list", x: 1, y: 4, width: 80, height: 18 },
                    { name: "footer", x: 1, y: 22, width: 80, height: 3 }
                ],
                theme: "lorb"
            });
            
            // Header
            var headerFrame = view.getZone("header");
            if (headerFrame) {
                headerFrame.gotoxy(1, 1);
                headerFrame.putmsg("\1h\1c\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\1n");
                headerFrame.gotoxy(1, 2);
                headerFrame.putmsg("\1h\1w  CONTACTS                                                    [" + ctx.contacts.length + " contacts]\1n");
                headerFrame.gotoxy(1, 3);
                headerFrame.putmsg("\1h\1c\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\1n");
            }
            
            // Footer
            var footerFrame = view.getZone("footer");
            if (footerFrame) {
                footerFrame.gotoxy(1, 1);
                footerFrame.putmsg("\1h\1c\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\1n");
                footerFrame.gotoxy(1, 2);
                footerFrame.putmsg("  \1w[ENTER]\1n\1w Call Player    \1w[V]\1n\1w View Stats    \1w[ESC]\1n\1w Back");
            }
            
            view.render();
            
            if (ctx.contacts.length === 0) {
                // No contacts yet
                var listFrame = view.getZone("list");
                if (listFrame) {
                    listFrame.gotoxy(3, 5);
                    listFrame.putmsg("\1kNo contacts yet.\1n");
                    listFrame.gotoxy(3, 7);
                    listFrame.putmsg("\1wDefeat NBA players on the courts to get their number!\1n");
                }
                view.render();
                console.getkey();
                view.close();
                return;
            }
            
            // Build menu items for contacts
            var menuItems = [];
            for (var i = 0; i < ctx.contacts.length; i++) {
                var c = ctx.contacts[i];
                var statusStr = "";
                var costStr = "";
                
                if (c.status === "signed") {
                    statusStr = "\1gSIGNED\1n";
                    costStr = "--";
                } else if (c.status === "temp") {
                    statusStr = "\1yTEMP\1n";
                    costStr = "$" + c.signCost + " / " + c.cutPercent + "%";
                } else {
                    statusStr = "\1kNot signed\1n";
                    costStr = "$" + c.signCost + " / " + c.cutPercent + "%";
                }
                
                // Format: Name (padded) | Status | Cost/Cut
                var displayName = padRight(c.name, 20);
                var displayStatus = padRight(statusStr, 12);
                
                menuItems.push({
                    text: displayName + " | " + displayStatus + " | " + costStr,
                    value: i,
                    data: c
                });
            }
            
            menuItems.push({ text: "Back", value: "back", hotkey: "Q" });
            
            // Show lightbar in list zone
            view.setContentZone("list");
            var choice = view.menu(menuItems, { y: 1 });
            view.close();
            
            if (choice === "back" || choice === null) {
                return;
            }
            
            // Selected a contact - show call dialog
            var contact = ctx.contacts[choice];
            if (contact) {
                callPlayerDialog(ctx, contact, choice);
            }
        }
    }
    
    /**
     * Call player dialog - negotiate temp or permanent signing
     * Uses RichView with player art on left, dialog on right
     */
    function callPlayerDialog(ctx, contact, contactIndex) {
        var view = new RichView({
            zones: [
                { name: "art", x: 1, y: 1, width: 40, height: 24 },
                { name: "content", x: 41, y: 1, width: 40, height: 24 }
            ],
            theme: "lorb"
        });
        
        // Load player art if available
        var artPath = getCharacterArtPath(contact);
        if (artPath && typeof BinLoader !== "undefined") {
            var artFrame = view.getZone("art");
            if (artFrame) {
                BinLoader.loadIntoFrame(artFrame, artPath, CHAR_ART_W, CHAR_ART_H, 1, 1);
            }
        } else {
            var artFrame = view.getZone("art");
            if (artFrame) {
                artFrame.gotoxy(15, 10);
                artFrame.putmsg("\1k[No Art]\1n");
            }
        }
        
        // Content zone - dialog
        view.setContentZone("content");
        view.setCursorY(0);
        
        view.line("\1h\1wCALLING...\1n");
        view.line("\1h\1c" + contact.name.toUpperCase() + "\1n");
        view.blank();
        
        if (contact.status === "signed") {
            view.line("\1g" + contact.name + " is\1n");
            view.line("\1galready on your crew!\1n");
            view.blank();
            view.info("Press any key...");
            view.render();
            console.getkey();
            view.close();
            return;
        }
        
        view.line("\1c\"Yo, what's good?\"\1n");
        view.blank();
        
        // Check if already on crew (temp)
        var onCrew = isOnCrew(ctx, contact.id);
        var stats = contact.stats || {};
        
        // Show all 6 stats in a compact format
        view.line("\1wSPD:\1c" + (stats.speed || "?") + " \1w3PT:\1c" + (stats.threePt || "?") + " \1wPWR:\1c" + (stats.power || "?") + "\1n");
        view.line("\1wSTL:\1c" + (stats.steal || "?") + " \1wBLK:\1c" + (stats.block || "?") + " \1wDNK:\1c" + (stats.dunk || "?") + "\1n");
        view.blank();
        
        // Show cash/crew info
        view.line("\1wCash: \1g$" + (ctx.cash || 0) + "\1n  \1wCrew: \1c" + ctx.crew.length + "/" + MAX_CREW_SIZE + "\1n");
        view.blank();
        
        // Build menu items based on status
        var menuItems = [];
        
        if (contact.status === "temp" && onCrew) {
            view.line("\1yStatus: On crew (" + contact.cutPercent + "% cut)\1n");
            view.blank();
            
            menuItems.push({ text: "Sign Permanent ($" + contact.signCost + ")", value: "sign", hotkey: "1" });
            menuItems.push({ text: "Release from Crew", value: "release", hotkey: "2" });
            menuItems.push({ text: "Nevermind", value: "back", hotkey: "Q" });
        } else {
            view.line("\1kStatus: Contact (not on crew)\1n");
            view.blank();
            
            menuItems.push({ text: "Run with me (" + contact.cutPercent + "% cut)", value: "temp", hotkey: "1" });
            menuItems.push({ text: "Sign Permanent ($" + contact.signCost + ")", value: "sign", hotkey: "2" });
            menuItems.push({ text: "Nevermind", value: "back", hotkey: "Q" });
        }
        
        var choice = view.menu(menuItems, { y: 14 });
        view.close();
        
        if (choice === "sign") {
            signPermanent(ctx, contact, contactIndex);
        } else if (choice === "release") {
            releaseFromCrew(ctx, contact);
        } else if (choice === "temp") {
            addToCrew(ctx, contact, "temp");
        }
    }
    
    /**
     * Add contact to crew (temp deal)
     */
    function addToCrew(ctx, contact, status) {
        if (ctx.crew.length >= MAX_CREW_SIZE) {
            LORB.View.line("");
            LORB.View.warn("Crew is full! Release someone first.");
            console.getkey();
            return false;
        }
        
        if (isOnCrew(ctx, contact.id)) {
            LORB.View.line("");
            LORB.View.warn(contact.name + " is already on your crew!");
            console.getkey();
            return false;
        }
        
        contact.status = status || "temp";
        ctx.crew.push({ contactId: contact.id, slot: ctx.crew.length });
        
        LORB.View.line("");
        LORB.View.line("\1g" + contact.name + " joins your crew!\1n");
        if (status === "temp") {
            LORB.View.line("\1y(They'll take " + contact.cutPercent + "% of your winnings)\1n");
        }
        console.getkey();
        return true;
    }
    
    /**
     * Sign player permanently
     */
    function signPermanent(ctx, contact, contactIndex) {
        if ((ctx.cash || 0) < contact.signCost) {
            LORB.View.line("");
            LORB.View.warn("Not enough cash! Need $" + contact.signCost);
            console.getkey();
            return false;
        }
        
        ctx.cash -= contact.signCost;
        contact.status = "signed";
        
        // Add to crew if not already there
        if (!isOnCrew(ctx, contact.id)) {
            if (ctx.crew.length < MAX_CREW_SIZE) {
                ctx.crew.push({ contactId: contact.id, slot: ctx.crew.length });
            }
        }
        
        LORB.View.line("");
        LORB.View.line("\1g" + contact.name + " signed! (-$" + contact.signCost + ")\1n");
        LORB.View.line("No more cuts - they're permanent crew now!");
        console.getkey();
        return true;
    }
    
    /**
     * Release player from crew
     */
    function releaseFromCrew(ctx, contact) {
        for (var i = 0; i < ctx.crew.length; i++) {
            if (ctx.crew[i].contactId === contact.id) {
                ctx.crew.splice(i, 1);
                // Clear active teammate if this was them
                if (ctx.activeTeammate === contact.id) {
                    if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.clearActiveTeammate) {
                        LORB.Util.Contacts.clearActiveTeammate(ctx);
                    } else {
                        ctx.activeTeammate = null;
                    }
                }
                // Reindex slots
                for (var j = 0; j < ctx.crew.length; j++) {
                    ctx.crew[j].slot = j;
                }
                LORB.View.line("");
                LORB.View.line("\1y" + contact.name + " released from crew.\1n");
                console.getkey();
                return true;
            }
        }
        return false;
    }
    
    /**
     * Check if contact is on crew
     */
    function isOnCrew(ctx, contactId) {
        for (var i = 0; i < ctx.crew.length; i++) {
            if (ctx.crew[i].contactId === contactId) return true;
        }
        return false;
    }
    
    /**
     * Your Crew view - show active roster
     */
    function runCrew(ctx) {
        while (true) {
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 3 },
                    { name: "list", x: 1, y: 4, width: 80, height: 18 },
                    { name: "footer", x: 1, y: 22, width: 80, height: 3 }
                ],
                theme: "lorb"
            });
            
            // Header
            var headerFrame = view.getZone("header");
            if (headerFrame) {
                headerFrame.gotoxy(1, 1);
                headerFrame.putmsg("\1h\1c\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\1n");
                headerFrame.gotoxy(1, 2);
                headerFrame.putmsg("\1h\1w  YOUR CREW                                                        [" + ctx.crew.length + "/" + MAX_CREW_SIZE + "]\1n");
                headerFrame.gotoxy(1, 3);
                headerFrame.putmsg("\1h\1c\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\1n");
            }
            
            // Footer
            var footerFrame = view.getZone("footer");
            if (footerFrame) {
                footerFrame.gotoxy(1, 1);
                footerFrame.putmsg("\1h\1c\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\1n");
                footerFrame.gotoxy(1, 2);
                footerFrame.putmsg("  \1w[ENTER]\1n\1w Details  \1w[A]\1n\1w Set Active  \1w[R]\1n\1w Release  \1w[ESC]\1n\1w Back");
            }
            
            view.render();
            
            if (ctx.crew.length === 0) {
                var listFrame = view.getZone("list");
                if (listFrame) {
                    listFrame.gotoxy(3, 5);
                    listFrame.putmsg("\1kNo crew members yet.\1n");
                    listFrame.gotoxy(3, 7);
                    listFrame.putmsg("\1wCall your contacts to add them to your crew!\1n");
                }
                view.render();
                console.getkey();
                view.close();
                return;
            }
            
            // Build crew list with stats
            var menuItems = [];
            for (var i = 0; i < ctx.crew.length; i++) {
                var crewMember = ctx.crew[i];
                var contact = getContactById(ctx, crewMember.contactId);
                
                if (!contact) continue;
                
                var stats = contact.stats || {};
                var statLine = "SPD:" + (stats.speed || "?") + " 3PT:" + (stats.threePt || "?") + 
                               " PWR:" + (stats.power || "?") + " STL:" + (stats.steal || "?") + 
                               " BLK:" + (stats.block || "?") + " DNK:" + (stats.dunk || "?");
                
                var statusStr = contact.status === "signed" ? "\1gSIGNED\1n" : "\1yTEMP (" + contact.cutPercent + "%)\1n";
                
                // Check if this is the active teammate
                var isActive = (ctx.activeTeammate === contact.id) || (!ctx.activeTeammate && i === 0);
                var activeMarker = isActive ? "\1h\1g*\1n " : "  ";
                
                menuItems.push({
                    text: activeMarker + "\1w" + padRight(contact.name, 14) + " " + statLine + "\1n | " + statusStr,
                    value: i,
                    data: contact
                });
            }
            
            // Add empty slots
            for (var e = ctx.crew.length; e < MAX_CREW_SIZE; e++) {
                menuItems.push({
                    text: "\1k-- empty slot --\1n",
                    value: "empty",
                    disabled: true
                });
            }
            
            menuItems.push({ text: "Back", value: "back", hotkey: "Q" });
            
            view.setContentZone("list");
            var choice = view.menu(menuItems, { y: 1 });
            view.close();
            
            if (choice === "back" || choice === null || choice === "empty") {
                return;
            }
            
            // Show crew member detail
            var crewMember = ctx.crew[choice];
            if (crewMember) {
                var contact = getContactById(ctx, crewMember.contactId);
                if (contact) {
                    showCrewMemberDetail(ctx, contact, choice);
                }
            }
        }
    }
    
    /**
     * Show detail view for a crew member - RichView with player art
     */
    function showCrewMemberDetail(ctx, contact, crewIndex) {
        var view = new RichView({
            zones: [
                { name: "art", x: 1, y: 1, width: 40, height: 20 },
                { name: "content", x: 41, y: 1, width: 40, height: 20 },
                { name: "footer", x: 1, y: 21, width: 80, height: 4 }
            ],
            theme: "lorb"
        });
        
        // Load player art if available
        var artPath = getCharacterArtPath(contact);
        if (artPath && typeof BinLoader !== "undefined") {
            var artFrame = view.getZone("art");
            if (artFrame) {
                BinLoader.loadIntoFrame(artFrame, artPath, CHAR_ART_W, CHAR_ART_H, 1, 1);
            }
        } else {
            // No art available - show placeholder
            var artFrame = view.getZone("art");
            if (artFrame) {
                artFrame.gotoxy(15, 10);
                artFrame.putmsg("\1k[No Art]\1n");
            }
        }
        
        // Content zone - stats and info
        view.setContentZone("content");
        view.setCursorY(0);
        
        var stats = contact.stats || {};
        var isActive = (ctx.activeTeammate === contact.id) || (!ctx.activeTeammate && crewIndex === 0);
        
        view.line("\1h\1w" + contact.name + "\1n");
        if (contact.team) {
            view.line("\1k" + contact.team + "\1n");
        }
        view.blank();
        
        view.line("\1h\1y\xCD\xCD\xCD STATS \xCD\xCD\xCD\1n");
        view.line("  Speed:   " + formatStatBar(stats.speed || 5));
        view.line("  3-Point: " + formatStatBar(stats.threePt || 5));
        view.line("  Power:   " + formatStatBar(stats.power || 5));
        view.line("  Steal:   " + formatStatBar(stats.steal || 5));
        view.line("  Block:   " + formatStatBar(stats.block || 5));
        view.line("  Dunk:    " + formatStatBar(stats.dunk || 5));
        view.blank();
        
        view.line("\1h\1y\xCD\xCD\xCD STATUS \xCD\xCD\xCD\1n");
        if (contact.status === "signed") {
            view.line("  \1gPermanently signed\1n");
            view.line("  \1gNo cut taken\1n");
        } else {
            view.line("  \1yTemporary\1n");
            view.line("  \1yTakes " + contact.cutPercent + "% cut\1n");
            view.line("  Sign: \1w$" + contact.signCost + "\1n");
        }
        view.blank();
        
        view.line("\1h\1y\xCD\xCD\xCD TEAMMATE \xCD\xCD\xCD\1n");
        if (isActive) {
            view.line("  \1h\1g* ACTIVE *\1n");
        } else {
            view.line("  \1kReserve\1n");
        }
        
        // Footer with options
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.gotoxy(1, 1);
            footerFrame.putmsg("\1h\1c\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\xCD\1n");
            footerFrame.gotoxy(1, 2);
            var opts = "  \1w[R]\1n\1w Release  ";
            if (contact.status !== "signed") {
                opts += "\1w[S]\1n\1w Sign ($" + contact.signCost + ")  ";
            }
            if (!isActive) {
                opts += "\1w[A]\1n\1w Set Active  ";
            }
            opts += "\1w[Q]\1n\1w Back";
            footerFrame.putmsg(opts);
        }
        
        view.render();
        
        var choice = console.getkey().toUpperCase();
        view.close();
        
        if (choice === "R") {
            releaseFromCrew(ctx, contact);
        } else if (choice === "S" && contact.status !== "signed") {
            signPermanent(ctx, contact, null);
        } else if (choice === "A" && !isActive) {
            if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.setActiveTeammate) {
                LORB.Util.Contacts.setActiveTeammate(ctx, contact.id);
                LORB.View.clear();
                LORB.View.line("");
                LORB.View.line("\1h\1g" + contact.name + " is now your active teammate!\1n");
                console.getkey();
            }
        }
    }
    
    /**
     * Get contact by ID
     */
    function getContactById(ctx, contactId) {
        for (var i = 0; i < ctx.contacts.length; i++) {
            if (ctx.contacts[i].id === contactId) return ctx.contacts[i];
        }
        return null;
    }
    
    /**
     * Get character art file path from contact name
     * Converts "Tyrese Halliburton" -> "tyrese_halliburton.bin"
     */
    function getCharacterArtPath(contact) {
        if (!contact || !contact.name) return null;
        var filename = contact.name.toLowerCase().replace(/[^a-z0-9]+/g, "_") + ".bin";
        var path = CHARACTERS_DIR + filename;
        // Check if file exists
        if (file_exists(path)) {
            return path;
        }
        return null;
    }
    
    /**
     * Format a stat bar (1-10 scale)
     */
    function formatStatBar(value) {
        var bar = "";
        var v = Math.min(Math.max(value || 0, 0), 10);
        for (var i = 0; i < v; i++) bar += "\1g\xDB";
        bar += "\1n\1h\1k";
        for (var i = v; i < 10; i++) bar += "\xDB";
        return bar + "\1n \1w" + v + "\1n";
    }
    
    /**
     * Pad string to length
     */
    function padRight(str, len) {
        str = String(str || "");
        while (str.length < len) str += " ";
        return str.substring(0, len);
    }
    
    /**
     * Load art files
     */
    function loadArtWithBinLoader(view) {
        if (typeof BinLoader === "undefined") return;
        
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            BinLoader.loadIntoFrame(headerFrame, ART_HEADER, ART_HEADER_W, ART_HEADER_H, 1, 1);
        }
        
        var artFrame = view.getZone("art");
        if (artFrame) {
            BinLoader.loadIntoFrame(artFrame, ART_SIDE, ART_SIDE_W, ART_SIDE_H, 1, 1);
        }
        
        view.render();
    }
    
    /**
     * Legacy fallback
     */
    function runLegacy(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("YOUR CRIB");
            LORB.View.line("");
            LORB.View.line("Crew: " + ctx.crew.length + "/" + MAX_CREW_SIZE);
            LORB.View.line("Contacts: " + ctx.contacts.length);
            LORB.View.line("");
            LORB.View.line("[1] Contacts  [2] Your Crew  [3] Stats  [Q] Back");
            LORB.View.line("");
            
            var choice = LORB.View.prompt("Choice: ").toUpperCase();
            
            switch (choice) {
                case "1":
                    runContactsLegacy(ctx);
                    break;
                case "2":
                    runCrewLegacy(ctx);
                    break;
                case "3":
                    if (LORB.UI && LORB.UI.StatsView) {
                        LORB.UI.StatsView.show(ctx);
                    }
                    break;
                case "Q":
                    return;
            }
        }
    }
    
    function runContactsLegacy(ctx) {
        LORB.View.clear();
        LORB.View.header("CONTACTS");
        LORB.View.line("");
        
        if (ctx.contacts.length === 0) {
            LORB.View.line("No contacts yet.");
            LORB.View.line("Defeat NBA players to get their number!");
        } else {
            for (var i = 0; i < ctx.contacts.length; i++) {
                var c = ctx.contacts[i];
                var status = c.status === "signed" ? "[SIGNED]" : 
                             c.status === "temp" ? "[TEMP]" : "";
                LORB.View.line((i + 1) + ". " + c.name + " " + status);
            }
        }
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
    }
    
    function runCrewLegacy(ctx) {
        LORB.View.clear();
        LORB.View.header("YOUR CREW");
        LORB.View.line("");
        
        if (ctx.crew.length === 0) {
            LORB.View.line("No crew members yet.");
        } else {
            for (var i = 0; i < ctx.crew.length; i++) {
                var contact = getContactById(ctx, ctx.crew[i].contactId);
                if (contact) {
                    LORB.View.line((i + 1) + ". " + contact.name);
                }
            }
        }
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
    }
    
    // Export
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Crib = {
        run: run,
        MAX_CREW_SIZE: MAX_CREW_SIZE,
        getContactById: getContactById,
        isOnCrew: isOnCrew
    };
    
})();
