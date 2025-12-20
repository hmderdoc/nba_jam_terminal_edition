/**
 * playoff_alert.js - Playoff Alert Views
 * 
 * Pre-hub alerts for playoff scheduling issues:
 * - Missed scheduled matches
 * - Reschedule confirmations
 * 
 * Uses RichView with trophy art and Figlet banners.
 */

var _playoffAlertRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _playoffAlertRichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[PLAYOFF_ALERT] Failed to load RichView: " + e);
}

(function() {
    load("sbbsdefs.js");
    
    var RichView = _playoffAlertRichView;
    
    /**
     * Handle a defer/reschedule request for a playoff match
     * @param {Object} match - The playoff match
     * @param {Object} ctx - Player context
     */
    function handleDeferRequest(match, ctx) {
        if (!LORB.Playoffs || !LORB.Playoffs.Scheduling) {
            return;
        }
        
        var playerId = ctx._globalId || ctx.name;
        var Scheduling = LORB.Playoffs.Scheduling;
        
        if (!Scheduling.canDefer(match, playerId)) {
            if (RichView) {
                var view = new RichView({ theme: "lorb" });
                view.setContentZone("content");
                view.line("\1rYou have already used your defer for this match.\1n");
                view.blank();
                view.line("\1h\1kPress any key...\1n");
                view.render();
                console.getkey();
                view.close();
            }
            return;
        }
        
        // Use the defer token
        Scheduling.useDefer(match, playerId);
        
        // Reschedule the match
        var result = Scheduling.rescheduleMatch(match, playerId, match.player1, match.player2);
        
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            
            if (result && result.scheduledStartUTC) {
                var newTimeStr = Scheduling.formatScheduleTime(result.scheduledStartUTC);
                view.header("MATCH RESCHEDULED");
                view.blank();
                view.line("\1gMatch has been rescheduled.\1n");
                view.blank();
                view.line("\1wNew time: \1c" + newTimeStr + "\1n");
                view.blank();
                view.line("\1yYou have used your defer token for this match.\1n");
            } else {
                view.header("RESCHEDULING FAILED");
                view.blank();
                view.line("\1rCould not find a new time slot.\1n");
                view.line("\1wThe match will need to be played or resolved by deadline.\1n");
            }
            
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        }
        
        // Save the updated match data
        if (LORB.Playoffs.saveBracket) {
            var bracket = LORB.Playoffs.getActiveBracket();
            if (bracket) {
                LORB.Playoffs.saveBracket(bracket);
            }
        }
    }
    
    /**
     * Show notification for a missed scheduled match
     * @param {Object} result - Missed match result from getMissedScheduledMatches
     * @param {Object} ctx - Player context
     * @returns {string} - User's choice: "reschedule", "playoffs", or "continue"
     */
    function showMissedMatchAlert(result, ctx) {
        var match = result.match;
        var Scheduling = LORB.Playoffs.Scheduling;
        var playerId = ctx._globalId || ctx.name;
        
        // Get opponent name
        var oppSnapshot = match.player1.playerId === playerId ? match.player2 : match.player1;
        var oppName = oppSnapshot.name || oppSnapshot.playerId;
        
        // Format the missed time
        var missedTimeStr = Scheduling.formatScheduleTime(result.missedAtMs);
        
        if (!RichView) {
            // Legacy fallback
            LORB.View.clear();
            LORB.View.header("MISSED PLAYOFF MATCH");
            LORB.View.line("");
            LORB.View.line("Your scheduled playoff match was missed!");
            LORB.View.line("");
            LORB.View.line("Opponent: " + oppName);
            LORB.View.line("Scheduled for: " + missedTimeStr);
            LORB.View.line("");
            if (result.canReschedule) {
                LORB.View.line("You can reschedule from the Playoffs menu.");
            } else {
                LORB.View.line("Wait for the next available time or play a ghost match.");
            }
            LORB.View.line("");
            LORB.View.line("Press any key to continue...");
            console.getkey();
            return "continue";
        }
        
        // Get season number from bracket
        var seasonNumber = result.bracket ? result.bracket.seasonNumber : 1;
        
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 41, y: 5, width: 40, height: 20 }
            ],
            theme: "lorb"
        });
        
        // Render Figlet banner in header
        var headerFrame = view.getZone("header");
        if (LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
            LORB.Util.FigletBanner.renderToFrame(headerFrame, "Playoffs", YELLOW | HIGH);
        } else {
            headerFrame.gotoxy(2, 2);
            headerFrame.putmsg("\1h\1y=== PLAYOFFS ===\1n");
        }
        
        // Render trophy art with season number
        var artFrame = view.getZone("art");
        if (LORB.Util && LORB.Util.TrophyArt && LORB.Util.TrophyArt.render) {
            LORB.Util.TrophyArt.render(artFrame, { seasonNumber: seasonNumber });
        }
        
        // Draw border on content zone - returns inner frame
        var contentFrame = view.drawBorder("content", {
            color: YELLOW,
            padding: 0
        });
        
        var cy = 1;
        contentFrame.gotoxy(1, cy++);
        contentFrame.putmsg("\1h\1r!! MISSED MATCH !!\1n");
        cy++;
        contentFrame.gotoxy(1, cy++);
        contentFrame.putmsg("\1yA scheduled match was missed.\1n");
        cy++;
        contentFrame.gotoxy(1, cy++);
        contentFrame.putmsg("\1wOpponent: \1h" + oppName + "\1n");
        contentFrame.gotoxy(1, cy++);
        contentFrame.putmsg("\1wScheduled: \1c" + missedTimeStr + "\1n");
        cy++;
        
        // Build menu options
        var menuItems = [];
        
        if (result.canReschedule) {
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1gYou can reschedule this match.\1n");
            cy++;
            menuItems.push({ text: "\1yReschedule Match\1n", value: "reschedule", hotkey: "R" });
        } else {
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1h\1kReschedule already used.\1n");
            cy++;
        }
        
        menuItems.push({ text: "View Playoffs", value: "playoffs", hotkey: "P" });
        menuItems.push({ text: "Continue", value: "continue", hotkey: "C" });
        
        view.render();
        var choice = view.menu(menuItems, { zone: "content", y: cy + 1 });
        view.close();
        
        return choice;
    }
    
    /**
     * Check for and show missed match notifications
     * Handles the full flow including reschedule actions
     * @param {Object} ctx - Player context
     */
    function checkMissedMatches(ctx) {
        if (!LORB.Playoffs || !LORB.Playoffs.Scheduling) {
            return;
        }
        
        var playerId = ctx._globalId || ctx.name;
        var missed = LORB.Playoffs.Scheduling.getMissedScheduledMatches(playerId);
        
        if (!missed || missed.length === 0) {
            return;
        }
        
        // Show notification for the first missed match
        var result = missed[0];
        var choice = showMissedMatchAlert(result, ctx);
        
        switch (choice) {
            case "reschedule":
                handleDeferRequest(result.match, ctx);
                break;
            case "playoffs":
                if (LORB.UI && LORB.UI.PlayoffView && LORB.UI.PlayoffView.run) {
                    LORB.UI.PlayoffView.run(ctx);
                }
                break;
            case "continue":
            default:
                break;
        }
    }
    
    // Export to LORB namespace
    if (!LORB.UI) LORB.UI = {};
    LORB.UI.PlayoffAlert = {
        checkMissedMatches: checkMissedMatches,
        showMissedMatchAlert: showMissedMatchAlert,
        handleDeferRequest: handleDeferRequest
    };
    
})();
