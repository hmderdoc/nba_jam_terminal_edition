/**
 * challenge_negotiation.js - Live challenge wager negotiation UI using RichView
 * 
 * Provides UI screens for:
 * - Challenger: Setting initial max wager and viewing stats
 * - Challengee: Viewing incoming challenge with stats, accept/counter/decline
 * - Both: Counter-offer input and negotiation loop
 */
(function () {
    if (!this.LORB) return;
    if (!this.LORB.Multiplayer) this.LORB.Multiplayer = {};
    
    var Challenges = null;  // Lazy loaded
    
    function ensureChallenges() {
        if (!Challenges && LORB.Multiplayer && LORB.Multiplayer.Challenges) {
            Challenges = LORB.Multiplayer.Challenges;
        }
        return Challenges;
    }
    
    function logInfo(msg) {
        if (typeof debugLog === "function") {
            debugLog("[LORB:ChallengeNegotiation] " + msg);
        }
    }
    
    function getGlobalIdFromCtx(ctx) {
        if (!ctx || !ctx._user || !LORB.Persist || !LORB.Persist.getGlobalPlayerId) return null;
        return LORB.Persist.getGlobalPlayerId(ctx._user);
    }
    
    // =========================================================================
    // UI HELPERS
    // =========================================================================
    
    /**
     * Format a player's stats for display
     */
    function formatPlayerStats(player) {
        var lines = [];
        var name = player.name || player.globalId || "Unknown";
        
        lines.push("\1h\1w" + name + "\1n");
        
        var wins = player.wins || 0;
        var losses = player.losses || 0;
        var total = wins + losses;
        var winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
        
        lines.push("\1cRecord:\1n " + wins + "-" + losses + " (" + winPct + "%)");
        lines.push("\1cRep:\1n " + (player.rep || 0) + "  \1cLevel:\1n " + (player.level || 1));
        
        // Show averages if available
        if (player.stats) {
            var ppg = player.stats.ppg || player.stats.avgPoints || 0;
            var apg = player.stats.apg || player.stats.avgAssists || 0;
            var spg = player.stats.spg || player.stats.avgSteals || 0;
            if (ppg > 0 || apg > 0 || spg > 0) {
                lines.push("\1cPPG:\1n " + ppg.toFixed(1) + "  \1cAPG:\1n " + apg.toFixed(1) + "  \1cSPG:\1n " + spg.toFixed(1));
            }
        }
        
        lines.push("\1cCash:\1n \1y$" + (player.cash || 0) + "\1n");
        
        return lines;
    }
    
    /**
     * Format wager for display
     */
    function formatWager(wager, prefix) {
        if (!wager) return (prefix || "") + "No wager";
        var parts = [];
        if (wager.cash > 0) parts.push("\1y$" + wager.cash + "\1n");
        if (wager.rep > 0) parts.push("\1c" + wager.rep + " rep\1n");
        if (parts.length === 0) return (prefix || "") + "Honor match (no stakes)";
        return (prefix || "") + parts.join(" + ");
    }
    
    /**
     * Create a RichView for challenge screens
     */
    function createChallengeView(theme) {
        if (typeof RichView === "undefined") {
            try { load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js"); } catch (e) {}
        }
        
        return new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 3 },
                { name: "art", x: 1, y: 4, width: 30, height: 18 },
                { name: "content", x: 32, y: 4, width: 48, height: 18 },
                { name: "footer", x: 1, y: 22, width: 80, height: 3 }
            ],
            theme: theme || "lorb",
            art: {
                art: "assets/lorb/hub_art.bin"  // Fallback art
            }
        });
    }
    
    /**
     * Draw header banner
     */
    function drawHeader(view, title) {
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            headerFrame.clear();
            headerFrame.gotoxy(1, 2);
            headerFrame.putmsg("\1h\1c" + centerText(title, 80) + "\1n");
        }
        view.render();
    }
    
    /**
     * Center text helper
     */
    function centerText(text, width) {
        var stripped = stripColors(text);
        var pad = Math.max(0, Math.floor((width - stripped.length) / 2));
        return new Array(pad + 1).join(" ") + text;
    }
    
    function stripColors(str) {
        return str.replace(/\x01[a-zA-Z0-9]/g, "").replace(/\1[a-zA-Z0-9]/g, "");
    }
    
    // =========================================================================
    // CHALLENGER FLOW
    // =========================================================================
    
    /**
     * Show wager input screen for challenger
     * @param {Object} ctx - Player context
     * @param {Object} opponent - Opponent player data
     * @returns {Object|null} { cash, rep } or null if cancelled
     */
    function showChallengerWagerInput(ctx, opponent) {
        ensureChallenges();
        
        var view = createChallengeView();
        drawHeader(view, "=== CHALLENGE: " + (opponent.name || "OPPONENT").toUpperCase() + " ===");
        
        view.setContentZone("content");
        view.setCursorY(0);
        
        // Show opponent stats
        view.line("\1h\1wOpponent Stats:\1n");
        view.line("\1h\1k─────────────────────────────\1n");
        var oppStats = formatPlayerStats(opponent);
        for (var i = 0; i < oppStats.length; i++) {
            view.line("  " + oppStats[i]);
        }
        
        view.blank();
        
        // Calculate absolute max
        var absoluteMax = Challenges.calculateAbsoluteMax(ctx, opponent);
        
        // Show limits
        view.line("\1h\1wYour Resources:\1n");
        view.line("  Cash: \1y$" + (ctx.cash || 0) + "\1n  Rep: \1c" + (ctx.rep || 0) + "\1n");
        view.blank();
        view.line("\1h\1wMax Wager Possible:\1n");
        view.line("  \1y$" + absoluteMax.cash + "\1n cash, \1c" + absoluteMax.rep + "\1n rep");
        view.line("  \1h\1k(Limited by what both players can afford)\1n");
        
        view.blank();
        view.line("\1h\1wSet Your MAXIMUM Wager:\1n");
        view.line("\1h\1k(Opponent may counter higher or lower)\1n");
        
        // Draw footer with instructions
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.clear();
            footerFrame.gotoxy(1, 2);
            footerFrame.putmsg("\1h\1k[\1h\1wENTER\1h\1k]\1w Send Challenge    \1h\1k[\1h\1wQ\1h\1k]\1w Cancel\1n");
        }
        view.render();
        
        // Get cash input
        view.blank();
        var cashStr = view.prompt("Cash to wager (0-" + absoluteMax.cash + "): $");
        var cashWager = parseInt(cashStr, 10);
        if (isNaN(cashWager) || cashWager < 0) cashWager = 0;
        cashWager = Math.min(cashWager, absoluteMax.cash);
        
        // Get rep input
        var repStr = view.prompt("Rep to wager (0-" + absoluteMax.rep + "): ");
        var repWager = parseInt(repStr, 10);
        if (isNaN(repWager) || repWager < 0) repWager = 0;
        repWager = Math.min(repWager, absoluteMax.rep);
        
        // Confirm
        view.blank();
        view.line("Proposed wager: " + formatWager({ cash: cashWager, rep: repWager }));
        view.blank();
        
        var confirmed = view.confirm("Send challenge? (Y/N) ");
        
        view.close();
        
        if (!confirmed) {
            return null;
        }
        
        return { cash: cashWager, rep: repWager };
    }
    
    /**
     * Show waiting screen while challenger waits for response
     * Uses cycle() for network updates instead of polling reads
     * @returns {Object} { status, challenge } - status is "accepted", "declined", "cancelled", "timeout"
     */
    function showChallengerWaiting(challenge, ctx) {
        ensureChallenges();
        
        var POLL_MS = 2000;
        var TIMEOUT_MS = 120000;  // 2 minutes
        var startTime = Date.now();
        var lastPollTime = 0;
        var myGid = getGlobalIdFromCtx(ctx);
        
        while (true) {
            // Process network updates via cycle() - non-blocking
            if (Challenges.cycle) {
                try { Challenges.cycle(); } catch (e) {}
            }
            
            var now = Date.now();
            
            // Check timeout
            if (now - startTime > TIMEOUT_MS) {
                return { status: "timeout", challenge: challenge };
            }
            
            // Poll for updates
            if (now - lastPollTime >= POLL_MS) {
                lastPollTime = now;
                
                var updated = Challenges.getChallenge(challenge.id, ctx);
                if (!updated) {
                    return { status: "missing", challenge: null };
                }
                
                challenge = updated;
                
                // Check status changes
                if (updated.status === "declined") {
                    return { status: "declined", challenge: updated };
                }
                if (updated.status === "cancelled") {
                    return { status: "cancelled", challenge: updated };
                }
                if (updated.status === "accepted") {
                    // Check if other is ready
                    if (Challenges.isOtherReady(updated, myGid)) {
                        return { status: "ready", challenge: updated };
                    }
                    // Mark ourselves ready
                    Challenges.markReady(updated.id, ctx, true);
                }
                
                // Check if counter-offer received (it's our turn to respond)
                if (updated.status === "negotiating" && Challenges.isMyTurnToRespond(updated, myGid)) {
                    var counterResult = showCounterOfferReceived(updated, ctx, true);
                    if (counterResult.action === "cancel") {
                        Challenges.cancelChallenge(updated.id, ctx);
                        return { status: "cancelled", challenge: updated };
                    }
                    if (counterResult.action === "accept") {
                        Challenges.acceptWager(updated.id, ctx);
                        // Continue waiting for opponent ready
                    }
                    // If countered, continue waiting
                }
                
                // Redraw waiting screen
                drawWaitingScreen(challenge, ctx, now - startTime);
            }
            
            // Check for cancel key (non-blocking)
            var key = console.inkey(100);  // 100ms timeout
            if (key) {
                key = key.toUpperCase();
                if (key === "Q" || key === "X" || key === "\x1B") {
                    Challenges.cancelChallenge(challenge.id, ctx);
                    return { status: "cancelled", challenge: challenge };
                }
            }
        }
    }
    
    function drawWaitingScreen(challenge, ctx, elapsedMs) {
        console.clear();
        console.gotoxy(1, 5);
        console.print("\1h\1c=== WAITING FOR RESPONSE ===\1n\r\n\r\n");
        
        var oppName = (challenge.to && challenge.to.name) || "Opponent";
        console.print("  Challenge to: \1h\1w" + oppName + "\1n\r\n");
        
        if (challenge.wager) {
            console.print("  Your Offer: " + formatWager(challenge.wager) + "\r\n");
            if (challenge.wager.ceiling) {
                console.print("  Ceiling: \1y$" + challenge.wager.ceiling.cash + "\1n / \1c" + challenge.wager.ceiling.rep + " rep\1n\r\n");
            }
        }
        
        console.print("\r\n");
        var elapsed = Math.floor(elapsedMs / 1000);
        var remaining = Math.max(0, 120 - elapsed);
        console.print("  Waiting... (" + remaining + "s remaining)\r\n");
        console.print("\r\n");
        console.print("  \1h\1k[\1h\1wQ\1h\1k]\1w Cancel Challenge\1n\r\n");
    }
    
    // =========================================================================
    // CHALLENGEE FLOW
    // =========================================================================
    
    /**
     * Show incoming challenge screen for challengee
     * @param {Object} challenge - The challenge record
     * @param {Object} ctx - Player context
     * @returns {Object} { action: "accept"|"counter"|"decline", offer?: { cash, rep } }
     */
    function showIncomingChallenge(challenge, ctx) {
        ensureChallenges();
        
        var view = createChallengeView();
        drawHeader(view, "=== INCOMING CHALLENGE! ===");
        
        view.setContentZone("content");
        view.setCursorY(0);
        
        var fromPlayer = challenge.from || {};
        
        // Show challenger stats
        view.line("\1h\1wFrom:\1n " + (fromPlayer.name || fromPlayer.globalId || "Unknown"));
        view.line("\1h\1k─────────────────────────────\1n");
        var fromStats = formatPlayerStats(fromPlayer);
        for (var i = 0; i < fromStats.length; i++) {
            view.line("  " + fromStats[i]);
        }
        
        view.blank();
        
        // Show wager if present
        if (challenge.wager) {
            view.line("\1h\1wTheir Proposed MAX Wager:\1n");
            view.line("  " + formatWager(challenge.wager));
            view.blank();
            
            // Show your resources
            view.line("\1h\1wYour Resources:\1n");
            view.line("  Cash: \1y$" + (ctx.cash || 0) + "\1n  Rep: \1c" + (ctx.rep || 0) + "\1n");
            
            // Show absolute max
            if (challenge.wager.absoluteMax) {
                view.line("\1h\1wMax Possible:\1n \1y$" + challenge.wager.absoluteMax.cash + 
                         "\1n / \1c" + challenge.wager.absoluteMax.rep + " rep\1n");
            }
            
            view.blank();
            view.line("\1h\1y>>> This is your ONLY chance to raise stakes! <<<\1n");
        } else {
            view.line("\1h\1wNo wager proposed (honor match)\1n");
        }
        
        // Draw footer
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.clear();
            footerFrame.gotoxy(1, 2);
            footerFrame.putmsg("\1h\1k[\1h\1wA\1h\1k]\1w Accept    \1h\1k[\1h\1wC\1h\1k]\1w Counter    \1h\1k[\1h\1wD\1h\1k]\1w Decline\1n");
        }
        view.render();
        
        // Wait for input
        while (true) {
            var key = console.getkey();
            if (key) key = key.toUpperCase();
            
            if (key === "A") {
                view.close();
                return { action: "accept" };
            }
            if (key === "C") {
                view.close();
                // Show counter-offer input
                return showFirstCounterInput(challenge, ctx);
            }
            if (key === "D" || key === "Q" || key === "\x1B") {
                view.close();
                return { action: "decline" };
            }
        }
    }
    
    /**
     * Show first counter-offer input (can raise ceiling)
     */
    function showFirstCounterInput(challenge, ctx) {
        ensureChallenges();
        
        var view = createChallengeView();
        drawHeader(view, "=== COUNTER-OFFER (First) ===");
        
        view.setContentZone("content");
        view.setCursorY(0);
        
        var currentOffer = challenge.wager || { cash: 0, rep: 0, absoluteMax: { cash: 0, rep: 0 } };
        var absoluteMax = currentOffer.absoluteMax || { cash: 0, rep: 0 };
        
        view.line("\1h\1wTheir Proposed MAX:\1n " + formatWager(currentOffer));
        view.line("\1h\1wAbsolute Max:\1n \1y$" + absoluteMax.cash + "\1n / \1c" + absoluteMax.rep + " rep\1n");
        view.line("\1h\1k(Capped by what both players can afford)\1n");
        
        view.blank();
        view.line("\1h\1wYour Counter:\1n");
        view.line("\1h\1y>>> You can go HIGHER (up to max) or lower <<<\1n");
        view.line("\1h\1kThis is your ONLY chance to raise the stakes!\1n");
        
        view.blank();
        
        // Draw footer
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.clear();
            footerFrame.gotoxy(1, 2);
            footerFrame.putmsg("\1h\1k[\1h\1wENTER\1h\1k]\1w Send Counter    \1h\1k[\1h\1wQ\1h\1k]\1w Decline\1n");
        }
        view.render();
        
        // Get counter inputs
        var cashStr = view.prompt("Cash (0-" + absoluteMax.cash + "): $");
        if (cashStr.toUpperCase() === "Q") {
            view.close();
            return { action: "decline" };
        }
        var counterCash = parseInt(cashStr, 10);
        if (isNaN(counterCash) || counterCash < 0) counterCash = 0;
        counterCash = Math.min(counterCash, absoluteMax.cash);
        
        var repStr = view.prompt("Rep (0-" + absoluteMax.rep + "): ");
        if (repStr.toUpperCase() === "Q") {
            view.close();
            return { action: "decline" };
        }
        var counterRep = parseInt(repStr, 10);
        if (isNaN(counterRep) || counterRep < 0) counterRep = 0;
        counterRep = Math.min(counterRep, absoluteMax.rep);
        
        view.blank();
        view.line("Your counter: " + formatWager({ cash: counterCash, rep: counterRep }));
        
        var confirmed = view.confirm("Send counter-offer? (Y/N) ");
        
        view.close();
        
        if (!confirmed) {
            return { action: "decline" };
        }
        
        return { action: "counter", offer: { cash: counterCash, rep: counterRep } };
    }
    
    /**
     * Show counter-offer received screen
     * @param {boolean} isChallenger - True if I'm the challenger
     */
    function showCounterOfferReceived(challenge, ctx, isChallenger) {
        ensureChallenges();
        
        var view = createChallengeView();
        drawHeader(view, "=== COUNTER-OFFER RECEIVED ===");
        
        view.setContentZone("content");
        view.setCursorY(0);
        
        var wager = challenge.wager || {};
        var oppName = isChallenger ? (challenge.to && challenge.to.name) : (challenge.from && challenge.from.name);
        oppName = oppName || "Opponent";
        
        view.line("\1h\1w" + oppName + " countered:\1n");
        view.blank();
        
        // Show history
        if (wager.history && wager.history.length > 0) {
            view.line("\1h\1wNegotiation History:\1n");
            for (var i = 0; i < wager.history.length; i++) {
                var h = wager.history[i];
                var who = h.by === "from" ? (challenge.from && challenge.from.name) : (challenge.to && challenge.to.name);
                who = who || h.by;
                view.line("  " + who + ": " + formatWager(h));
            }
            view.blank();
        }
        
        view.line("\1h\1wCurrent Offer:\1n " + formatWager(wager));
        
        if (wager.ceiling && wager.ceiling.locked) {
            view.line("\1h\1wCeiling (locked):\1n \1y$" + wager.ceiling.cash + "\1n / \1c" + wager.ceiling.rep + " rep\1n");
        }
        
        view.blank();
        
        // Draw footer
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.clear();
            footerFrame.gotoxy(1, 2);
            if (isChallenger) {
                footerFrame.putmsg("\1h\1k[\1h\1wA\1h\1k]\1w Accept    \1h\1k[\1h\1wC\1h\1k]\1w Counter    \1h\1k[\1h\1wX\1h\1k]\1w Cancel\1n");
            } else {
                footerFrame.putmsg("\1h\1k[\1h\1wA\1h\1k]\1w Accept    \1h\1k[\1h\1wC\1h\1k]\1w Counter    \1h\1k[\1h\1wD\1h\1k]\1w Decline\1n");
            }
        }
        view.render();
        
        // Wait for input
        while (true) {
            var key = console.getkey();
            if (key) key = key.toUpperCase();
            
            if (key === "A") {
                view.close();
                return { action: "accept" };
            }
            if (key === "C") {
                view.close();
                return showLockedCounterInput(challenge, ctx);
            }
            if (key === "D" || key === "X" || key === "Q" || key === "\x1B") {
                view.close();
                return { action: "cancel" };
            }
        }
    }
    
    /**
     * Show counter input when ceiling is locked (can only go equal or lower)
     */
    function showLockedCounterInput(challenge, ctx) {
        ensureChallenges();
        
        var view = createChallengeView();
        drawHeader(view, "=== COUNTER-OFFER ===");
        
        view.setContentZone("content");
        view.setCursorY(0);
        
        var wager = challenge.wager || { ceiling: { cash: 0, rep: 0 } };
        var ceiling = wager.ceiling || { cash: 0, rep: 0 };
        
        view.line("\1h\1wCeiling (locked):\1n \1y$" + ceiling.cash + "\1n / \1c" + ceiling.rep + " rep\1n");
        view.line("\1h\1wCurrent Offer:\1n " + formatWager(wager));
        
        view.blank();
        view.line("\1h\1wYour Counter:\1n");
        view.line("\1h\1k(Must be at or below ceiling)\1n");
        
        view.blank();
        
        // Draw footer
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.clear();
            footerFrame.gotoxy(1, 2);
            footerFrame.putmsg("\1h\1k[\1h\1wENTER\1h\1k]\1w Send    \1h\1k[\1h\1wA\1h\1k]\1w Accept Current    \1h\1k[\1h\1wX\1h\1k]\1w Cancel\1n");
        }
        view.render();
        
        // Get inputs
        var cashStr = view.prompt("Cash (0-" + ceiling.cash + "): $");
        if (cashStr.toUpperCase() === "A") {
            view.close();
            return { action: "accept" };
        }
        if (cashStr.toUpperCase() === "X" || cashStr.toUpperCase() === "Q") {
            view.close();
            return { action: "cancel" };
        }
        var counterCash = parseInt(cashStr, 10);
        if (isNaN(counterCash) || counterCash < 0) counterCash = 0;
        counterCash = Math.min(counterCash, ceiling.cash);
        
        var repStr = view.prompt("Rep (0-" + ceiling.rep + "): ");
        if (repStr.toUpperCase() === "A") {
            view.close();
            return { action: "accept" };
        }
        if (repStr.toUpperCase() === "X" || repStr.toUpperCase() === "Q") {
            view.close();
            return { action: "cancel" };
        }
        var counterRep = parseInt(repStr, 10);
        if (isNaN(counterRep) || counterRep < 0) counterRep = 0;
        counterRep = Math.min(counterRep, ceiling.rep);
        
        view.blank();
        view.line("Your counter: " + formatWager({ cash: counterCash, rep: counterRep }));
        
        var confirmed = view.confirm("Send? (Y/N) ");
        
        view.close();
        
        if (!confirmed) {
            return { action: "cancel" };
        }
        
        return { action: "counter", offer: { cash: counterCash, rep: counterRep } };
    }
    
    /**
     * Challengee negotiation loop
     * Uses cycle() for network updates instead of polling reads
     */
    function runChallengeeNegotiation(challenge, ctx) {
        ensureChallenges();
        
        var POLL_MS = 2000;
        var TIMEOUT_MS = 120000;
        var startTime = Date.now();
        var lastPollTime = 0;
        var myGid = getGlobalIdFromCtx(ctx);
        
        while (true) {
            // Process network updates via cycle() - non-blocking
            if (Challenges.cycle) {
                try { Challenges.cycle(); } catch (e) {}
            }
            
            var now = Date.now();
            
            if (now - startTime > TIMEOUT_MS) {
                return { status: "timeout", challenge: challenge };
            }
            
            if (now - lastPollTime >= POLL_MS) {
                lastPollTime = now;
                
                var updated = Challenges.getChallenge(challenge.id, ctx);
                if (!updated) {
                    return { status: "missing", challenge: null };
                }
                
                challenge = updated;
                
                if (updated.status === "cancelled") {
                    return { status: "cancelled", challenge: updated };
                }
                if (updated.status === "accepted") {
                    if (Challenges.isOtherReady(updated, myGid)) {
                        return { status: "ready", challenge: updated };
                    }
                    Challenges.markReady(updated.id, ctx, true);
                }
                
                // Check if it's my turn
                if (updated.status === "negotiating" && Challenges.isMyTurnToRespond(updated, myGid)) {
                    var counterResult = showCounterOfferReceived(updated, ctx, false);
                    
                    if (counterResult.action === "cancel") {
                        Challenges.declineChallenge(updated.id, ctx);
                        return { status: "declined", challenge: updated };
                    }
                    if (counterResult.action === "accept") {
                        Challenges.acceptWager(updated.id, ctx);
                    }
                    if (counterResult.action === "counter" && counterResult.offer) {
                        var submitResult = Challenges.submitCounterOffer(updated.id, ctx, counterResult.offer);
                        if (!submitResult.success) {
                            // Show error and retry
                            console.print("\r\n\1r" + (submitResult.error || "Counter failed") + "\1n\r\n");
                            console.print("Press any key...");
                            console.getkey();
                        }
                    }
                }
                
                // Redraw waiting screen
                if (updated.status !== "accepted" || !Challenges.isOtherReady(updated, myGid)) {
                    drawChallengeeWaitingScreen(updated, ctx, now - startTime);
                }
            }
            
            // Check for cancel key (non-blocking)
            var key = console.inkey(100);  // 100ms timeout
            if (key) {
                key = key.toUpperCase();
                if (key === "Q" || key === "X" || key === "\x1B") {
                    Challenges.declineChallenge(challenge.id, ctx);
                    return { status: "declined", challenge: challenge };
                }
            }
        }
    }
    
    function drawChallengeeWaitingScreen(challenge, ctx, elapsedMs) {
        console.clear();
        console.gotoxy(1, 5);
        console.print("\1h\1c=== WAITING FOR OPPONENT ===\1n\r\n\r\n");
        
        var oppName = (challenge.from && challenge.from.name) || "Challenger";
        console.print("  Challenge from: \1h\1w" + oppName + "\1n\r\n");
        
        if (challenge.wager) {
            console.print("  Current Offer: " + formatWager(challenge.wager) + "\r\n");
        }
        
        console.print("\r\n");
        var elapsed = Math.floor(elapsedMs / 1000);
        var remaining = Math.max(0, 120 - elapsed);
        console.print("  Waiting... (" + remaining + "s remaining)\r\n");
        console.print("\r\n");
        console.print("  \1h\1k[\1h\1wQ\1h\1k]\1w Decline Challenge\1n\r\n");
    }
    
    // =========================================================================
    // EXPORTS
    // =========================================================================
    
    LORB.Multiplayer.ChallengeNegotiation = {
        // Challenger flow
        showChallengerWagerInput: showChallengerWagerInput,
        showChallengerWaiting: showChallengerWaiting,
        
        // Challengee flow
        showIncomingChallenge: showIncomingChallenge,
        runChallengeeNegotiation: runChallengeeNegotiation,
        
        // Shared utilities
        formatWager: formatWager,
        formatPlayerStats: formatPlayerStats
    };
    
    logInfo("ChallengeNegotiation module loaded");
    
})();
