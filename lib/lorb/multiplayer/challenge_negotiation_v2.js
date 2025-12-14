/**
 * challenge_negotiation_v2.js - Integrated live challenge wager negotiation UI
 * 
 * Single-view approach with live updates:
 * - Shows opponent stats and wager input in one view
 * - Status updates in real-time without screen switching
 * - Live countdown timer
 * - Clear messaging about what we're waiting for
 */
(function () {
    if (!this.LORB) return;
    if (!this.LORB.Multiplayer) this.LORB.Multiplayer = {};
    
    var Challenges = null;
    
    function ensureChallenges() {
        if (!Challenges && LORB.Multiplayer && LORB.Multiplayer.Challenges) {
            Challenges = LORB.Multiplayer.Challenges;
        }
        return Challenges;
    }
    
    function logInfo(msg) {
        if (typeof debugLog === "function") {
            debugLog("[LORB:ChallengeNeg] " + msg);
        }
    }
    
    function getGlobalIdFromCtx(ctx) {
        if (!ctx || !ctx._user || !LORB.Persist || !LORB.Persist.getGlobalPlayerId) return null;
        return LORB.Persist.getGlobalPlayerId(ctx._user);
    }
    
    // =========================================================================
    // FORMATTING HELPERS
    // =========================================================================
    
    function formatWager(wager) {
        if (!wager || (wager.cash === 0 && wager.rep === 0)) {
            return "\1wHonor match (no stakes)\1n";
        }
        var parts = [];
        if (wager.cash > 0) parts.push("\1y$" + wager.cash + "\1n");
        if (wager.rep > 0) parts.push("\1c" + wager.rep + " rep\1n");
        return parts.join(" + ");
    }
    
    function formatTime(ms) {
        var secs = Math.max(0, Math.ceil(ms / 1000));
        var mins = Math.floor(secs / 60);
        secs = secs % 60;
        return mins + ":" + (secs < 10 ? "0" : "") + secs;
    }
    
    function centerPad(str, width) {
        var stripped = str.replace(/\x01[a-zA-Z0-9]/g, "").replace(/\1[a-zA-Z0-9]/g, "");
        var pad = Math.max(0, width - stripped.length);
        var left = Math.floor(pad / 2);
        var right = pad - left;
        return new Array(left + 1).join(" ") + str + new Array(right + 1).join(" ");
    }
    
    // =========================================================================
    // MAIN UI CLASS - Single integrated view for entire flow
    // =========================================================================
    
    /**
     * ChallengeUI - Manages the entire challenge negotiation in one view
     * @param {Object} ctx - Player context
     * @param {Object} opponent - Opponent info
     * @param {boolean} isChallenger - True if we're initiating the challenge
     * @param {Object} options - Optional challenge options (mode, playoffMatchId, etc.)
     */
    function ChallengeUI(ctx, opponent, isChallenger, options) {
        this.ctx = ctx;
        this.opponent = opponent;
        this.isChallenger = isChallenger;
        this.options = options || {};  // Store options for sendChallenge
        this.challenge = null;
        this.myGid = getGlobalIdFromCtx(ctx);
        this.startTime = Date.now();
        this.lastPollTime = 0;
        this.statusMessage = "";
        this.phase = "input";  // "input", "waiting", "counter", "done"
        
        // Calculate max wager
        ensureChallenges();
        this.absoluteMax = Challenges ? Challenges.calculateAbsoluteMax(ctx, opponent) : { cash: 0, rep: 0 };
    }
    
    /**
     * Draw the full UI
     */
    ChallengeUI.prototype.draw = function() {
        console.clear(7, false);  // 7=normal attr, false=disable autopause
        console.home();
        
        // Header - show PLAYOFF for playoff challenges
        var title;
        var isPlayoff = this.options && this.options.mode === "playoff";
        if (!isPlayoff && this.challenge && this.challenge.mode === "playoff") {
            isPlayoff = true;
        }
        
        if (isPlayoff) {
            title = this.isChallenger 
                ? "PLAYOFF MATCH: " + (this.opponent.name || "OPPONENT").toUpperCase() 
                : "PLAYOFF CHALLENGE";
        } else {
            title = this.isChallenger 
                ? "CHALLENGE: " + (this.opponent.name || "OPPONENT").toUpperCase() 
                : "INCOMING CHALLENGE";
        }
        console.print("\1n\1h\1c" + centerPad("=== " + title + " ===", 80) + "\1n\r\n");
        console.print("\r\n");
        
        // Opponent info section
        this.drawOpponentInfo();
        
        // Separator
        console.print("\1h\1k" + new Array(81).join("-") + "\1n\r\n");
        
        // Wager section
        this.drawWagerInfo();
        
        // Separator  
        console.print("\1h\1k" + new Array(81).join("-") + "\1n\r\n");
        
        // Status section (updates during waiting)
        this.drawStatusSection();
    };
    
    ChallengeUI.prototype.drawOpponentInfo = function() {
        var opp = this.opponent;
        var oppName = opp.name || opp.globalId || "Unknown";
        
        console.print("  \1h\1wOpponent:\1n " + oppName + "\r\n");
        
        var wins = opp.wins || 0;
        var losses = opp.losses || 0;
        var total = wins + losses;
        var winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
        
        console.print("  \1cRecord:\1n " + wins + "-" + losses + " (" + winPct + "%)");
        console.print("    \1cLevel:\1n " + (opp.level || 1));
        console.print("    \1cRep:\1n " + (opp.rep || 0) + "\r\n");
        
        console.print("  \1cCash:\1n \1y$" + (opp.cash || 0) + "\1n\r\n");
        console.print("\r\n");
    };
    
    ChallengeUI.prototype.drawWagerInfo = function() {
        console.print("  \1h\1wYour Resources:\1n  Cash: \1y$" + (this.ctx.cash || 0) + "\1n  Rep: \1c" + (this.ctx.rep || 0) + "\1n\r\n");
        console.print("  \1h\1wMax Possible:\1n    Cash: \1y$" + this.absoluteMax.cash + "\1n  Rep: \1c" + this.absoluteMax.rep + "\1n\r\n");
        console.print("\r\n");
        
        // Show current wager if we have one
        if (this.challenge && this.challenge.wager) {
            var w = this.challenge.wager;
            console.print("  \1h\1wCurrent Offer:\1n  " + formatWager(w) + "\r\n");
            if (w.ceiling && w.ceiling.locked) {
                console.print("  \1h\1kCeiling (locked):\1n \1y$" + w.ceiling.cash + "\1n / \1c" + w.ceiling.rep + " rep\1n\r\n");
            }
            console.print("  \1h\1kProposed by:\1n " + (w.proposedBy === "from" ? "Challenger" : "Challengee") + "\r\n");
        }
        console.print("\r\n");
    };
    
    ChallengeUI.prototype.drawStatusSection = function() {
        var elapsed = Date.now() - this.startTime;
        var remaining = Math.max(0, 120000 - elapsed);
        
        if (this.phase === "waiting") {
            // Live status with timer
            console.print("  \1h\1y" + this.statusMessage + "\1n\r\n");
            console.print("\r\n");
            console.print("  \1wTime remaining:\1n \1h" + formatTime(remaining) + "\1n\r\n");
            console.print("\r\n");
            console.print("  \1h\1k[Q] Cancel challenge\1n\r\n");
        } else if (this.phase === "input") {
            // Input prompt area - leave blank, we'll draw prompts below
            console.print("\r\n");
        } else if (this.phase === "counter") {
            console.print("  \1h\1gCounter-offer received!\1n\r\n");
            console.print("\r\n");
        }
    };
    
    /**
     * Update just the status message (not the timer)
     */
    ChallengeUI.prototype.updateStatus = function(message) {
        this.statusMessage = message;
        
        // Move to status line and update only the message
        var statusRow = 16;
        console.gotoxy(1, statusRow);
        console.cleartoeol();
        console.print("  \1h\1y" + message + "\1n");
    };
    
    /**
     * Run the challenger flow: get wager input, send challenge, wait for response
     */
    ChallengeUI.prototype.runChallengerFlow = function() {
        this.phase = "input";
        this.draw();
        
        // Get wager input
        console.print("  \1h\1wSet your MAXIMUM wager:\1n\r\n");
        console.print("  \1h\1k(Opponent can counter higher or lower, up to the max)\1n\r\n\r\n");
        
        console.print("  Cash to wager (0-" + this.absoluteMax.cash + "): $");
        var cashStr = console.getstr("", 10);
        if (cashStr.toUpperCase() === "Q") {
            return { status: "cancelled" };
        }
        var cashWager = parseInt(cashStr, 10) || 0;
        cashWager = Math.max(0, Math.min(cashWager, this.absoluteMax.cash));
        
        console.print("  Rep to wager (0-" + this.absoluteMax.rep + "): ");
        var repStr = console.getstr("", 10);
        if (repStr.toUpperCase() === "Q") {
            return { status: "cancelled" };
        }
        var repWager = parseInt(repStr, 10) || 0;
        repWager = Math.max(0, Math.min(repWager, this.absoluteMax.rep));
        
        console.print("\r\n  Your wager: " + formatWager({ cash: cashWager, rep: repWager }) + "\r\n\r\n");
        console.print("  Send challenge? (Y/N) ");
        var confirm = console.getkey();
        if (confirm.toUpperCase() !== "Y") {
            return { status: "cancelled" };
        }
        
        // Create the challenge with wager
        logInfo("Creating challenge with wager: $" + cashWager + " / " + repWager + " rep");
        
        // Build challenge options - merge in any passed options (e.g., playoff metadata)
        var challengeOpts = { mode: this.options.mode || "live" };
        if (this.options.playoffMatchId) challengeOpts.playoffMatchId = this.options.playoffMatchId;
        if (this.options.playoffRound) challengeOpts.playoffRound = this.options.playoffRound;
        if (this.options.seasonNumber) challengeOpts.seasonNumber = this.options.seasonNumber;
        
        this.challenge = Challenges.sendChallenge(this.ctx, this.opponent, challengeOpts, { cash: cashWager, rep: repWager });
        
        if (!this.challenge) {
            console.print("\r\n  \1rFailed to send challenge!\1n\r\n");
            console.getkey();
            return { status: "error" };
        }
        
        // Enter waiting phase
        return this.runWaitingLoop("Waiting for " + (this.opponent.name || "opponent") + " to respond...");
    };
    
    /**
     * Run the waiting loop - polls for updates with live timer
     */
    ChallengeUI.prototype.runWaitingLoop = function(initialMessage) {
        this.phase = "waiting";
        this.statusMessage = initialMessage;
        this.startTime = Date.now();
        var POLL_MS = 1500;        // Poll server every 1.5 seconds
        var TIMER_UPDATE_MS = 1000; // Update timer display every 1 second
        var TIMEOUT_MS = 120000;
        var markedReady = !!this._alreadyMarkedReady;
        var lastTimerUpdate = 0;
        var lastDisplayedSeconds = -1;
        
        this.draw();
        
        while (true) {
            var now = Date.now();
            var elapsed = now - this.startTime;
            
            // Check timeout
            if (elapsed > TIMEOUT_MS) {
                if (this.challenge) {
                    Challenges.cancelChallenge(this.challenge.id, this.ctx);
                }
                return { status: "timeout", challenge: this.challenge };
            }
            
            // Poll server for updates (every 1.5s)
            if (now - this.lastPollTime >= POLL_MS) {
                this.lastPollTime = now;
                
                if (this.challenge) {
                    var updated = Challenges.getChallenge(this.challenge.id, this.ctx);
                    if (!updated) {
                        return { status: "missing", challenge: null };
                    }
                    
                    this.challenge = updated;
                    
                    // Handle status changes
                    if (updated.status === "declined") {
                        this.updateStatus("Challenge declined!");
                        mswait(1500);
                        return { status: "declined", challenge: updated };
                    }
                    if (updated.status === "cancelled") {
                        this.updateStatus("Challenge cancelled.");
                        mswait(1500);
                        return { status: "cancelled", challenge: updated };
                    }
                    
                    // If status is accepted, mark ourselves ready (once) and wait for other
                    if (updated.status === "accepted") {
                        if (!markedReady) {
                            Challenges.markReady(updated.id, this.ctx, true);
                            markedReady = true;
                            logInfo("Marked self ready for " + updated.id);
                            this.statusMessage = "Waiting for opponent to be ready...";
                            lastDisplayedSeconds = -1;  // Force redraw
                        }
                        
                        // Re-fetch to get latest lobby state
                        updated = Challenges.getChallenge(this.challenge.id, this.ctx);
                        if (updated) this.challenge = updated;
                        
                        // Check if other is ready
                        if (Challenges.isOtherReady(this.challenge, this.myGid)) {
                            this.updateStatus("Both players ready! Launching...");
                            mswait(1000);
                            return { status: "ready", challenge: this.challenge };
                        }
                    }
                    
                    // Check for counter-offer (negotiating + their turn ended)
                    if (updated.status === "negotiating" && this.isChallenger) {
                        logInfo("Detected negotiating status, checking turn...");
                        if (Challenges.isMyTurnToRespond(updated, this.myGid)) {
                            logInfo("Counter-offer detected! wager.cash=" + (updated.wager ? updated.wager.cash : "null") + 
                                   " wager.rep=" + (updated.wager ? updated.wager.rep : "null") +
                                   " ceiling.cash=" + (updated.wager && updated.wager.ceiling ? updated.wager.ceiling.cash : "null"));
                            return this.handleCounterOffer(updated);
                        }
                    }
                }
            }
            
            // Update timer display only when seconds change (every 1s)
            var currentSeconds = Math.ceil((TIMEOUT_MS - elapsed) / 1000);
            if (currentSeconds !== lastDisplayedSeconds) {
                lastDisplayedSeconds = currentSeconds;
                this.updateTimer(currentSeconds);
            }
            
            // Check for cancel key - use shorter wait for responsiveness
            var key = console.inkey(100);
            if (key) {
                key = key.toUpperCase();
                if (key === "Q" || key === "X" || key === "\x1B") {
                    if (this.challenge) {
                        Challenges.cancelChallenge(this.challenge.id, this.ctx);
                    }
                    return { status: "cancelled", challenge: this.challenge };
                }
            }
        }
    };
    
    /**
     * Update only the timer line - simple approach, just redraw
     */
    ChallengeUI.prototype.updateTimer = function(seconds) {
        // Simple: just redraw the whole screen periodically
        // This avoids cursor positioning issues that might break input
        this.draw();
    };
    
    /**
     * Handle a counter-offer from opponent
     */
    ChallengeUI.prototype.handleCounterOffer = function(challenge) {
        this.challenge = challenge;
        this.phase = "counter";
        this.draw();
        
        var w = challenge.wager;
        console.print("\r\n  \1h\1gCounter-offer received!\1n\r\n\r\n");
        console.print("  They offer: " + formatWager(w) + "\r\n\r\n");
        
        if (w.ceiling && w.ceiling.locked) {
            console.print("  \1h\1kNegotiation ceiling is locked at:\1n $" + w.ceiling.cash + " / " + w.ceiling.rep + " rep\r\n\r\n");
        }
        
        console.print("  \1h\1w[A]\1n Accept this offer\r\n");
        console.print("  \1h\1w[C]\1n Counter-offer\r\n");
        console.print("  \1h\1w[X]\1n Cancel challenge\r\n\r\n");
        console.print("  Your choice: ");
        
        var key = console.getkey();
        if (key) key = key.toUpperCase();
        
        if (key === "A") {
            // Accept the wager
            Challenges.acceptWager(challenge.id, this.ctx);
            this.statusMessage = "Wager accepted! Waiting for match to start...";
            return this.runWaitingLoop(this.statusMessage);
        }
        
        if (key === "C") {
            // Counter-offer
            return this.getCounterOffer(challenge);
        }
        
        // Cancel
        Challenges.cancelChallenge(challenge.id, this.ctx);
        return { status: "cancelled", challenge: challenge };
    };
    
    /**
     * Get counter-offer input
     */
    ChallengeUI.prototype.getCounterOffer = function(challenge) {
        var w = challenge.wager;
        var maxCash = (w.ceiling && w.ceiling.locked) ? w.ceiling.cash : this.absoluteMax.cash;
        var maxRep = (w.ceiling && w.ceiling.locked) ? w.ceiling.rep : this.absoluteMax.rep;
        
        console.print("\r\n  \1h\1wYour counter-offer:\1n\r\n");
        console.print("  (Max: $" + maxCash + " cash, " + maxRep + " rep)\r\n\r\n");
        
        console.print("  Cash: $");
        var cashStr = console.getstr("", 10);
        if (cashStr.toUpperCase() === "Q" || cashStr.toUpperCase() === "X") {
            Challenges.cancelChallenge(challenge.id, this.ctx);
            return { status: "cancelled", challenge: challenge };
        }
        var cashOffer = parseInt(cashStr, 10) || 0;
        cashOffer = Math.max(0, Math.min(cashOffer, maxCash));
        
        console.print("  Rep: ");
        var repStr = console.getstr("", 10);
        if (repStr.toUpperCase() === "Q" || repStr.toUpperCase() === "X") {
            Challenges.cancelChallenge(challenge.id, this.ctx);
            return { status: "cancelled", challenge: challenge };
        }
        var repOffer = parseInt(repStr, 10) || 0;
        repOffer = Math.max(0, Math.min(repOffer, maxRep));
        
        // Submit counter
        Challenges.submitCounterOffer(challenge.id, this.ctx, { cash: cashOffer, rep: repOffer });
        
        this.statusMessage = "Counter sent! Waiting for response...";
        return this.runWaitingLoop(this.statusMessage);
    };
    
    /**
     * Run the challengee flow: see challenge, accept/counter/decline
     */
    ChallengeUI.prototype.runChallengeeFlow = function(challenge) {
        this.challenge = challenge;
        this.phase = "input";
        
        // Use the absoluteMax from the challenge wager if available
        // (the challenger already calculated it with full player data)
        if (challenge.wager && challenge.wager.absoluteMax) {
            this.absoluteMax = challenge.wager.absoluteMax;
        }
        
        this.draw();
        
        var w = challenge.wager;
        
        console.print("  \1h\1wTheir proposed wager:\1n " + (w ? formatWager(w) : "No wager (honor match)") + "\r\n\r\n");
        
        if (w && !w.ceiling.locked) {
            console.print("  \1h\1yNOTE:\1n This is your ONLY chance to raise the stakes!\r\n");
            console.print("  After your first response, the ceiling is locked.\r\n\r\n");
        }
        
        console.print("  \1h\1w[A]\1n Accept wager and play\r\n");
        console.print("  \1h\1w[C]\1n Counter-offer (propose different stakes)\r\n");
        console.print("  \1h\1w[D]\1n Decline challenge\r\n\r\n");
        console.print("  Your choice: ");
        
        var key = console.getkey();
        if (key) key = key.toUpperCase();
        
        if (key === "A") {
            // Accept
            Challenges.acceptWager(challenge.id, this.ctx);
            Challenges.markReady(challenge.id, this.ctx, true);
            this._alreadyMarkedReady = true;  // Flag for waiting loop
            this.statusMessage = "Accepted! Waiting for challenger...";
            return this.runWaitingLoop(this.statusMessage);
        }
        
        if (key === "C") {
            // Counter-offer (first counter can raise ceiling)
            return this.getFirstCounterOffer(challenge);
        }
        
        // Decline
        Challenges.declineChallenge(challenge.id, this.ctx);
        return { status: "declined", challenge: challenge };
    };
    
    /**
     * Get first counter-offer (can raise ceiling)
     */
    ChallengeUI.prototype.getFirstCounterOffer = function(challenge) {
        var w = challenge.wager || { cash: 0, rep: 0 };
        
        console.print("\r\n  \1h\1wYour counter-offer:\1n\r\n");
        console.print("  (You can go higher up to $" + this.absoluteMax.cash + " / " + this.absoluteMax.rep + " rep,\r\n");
        console.print("   or lower. This sets the negotiation ceiling.)\r\n\r\n");
        
        console.print("  Cash: $");
        var cashStr = console.getstr("", 10);
        logInfo("getFirstCounterOffer: cashStr='" + cashStr + "'");
        if (cashStr.toUpperCase() === "Q" || cashStr.toUpperCase() === "D") {
            Challenges.declineChallenge(challenge.id, this.ctx);
            return { status: "declined", challenge: challenge };
        }
        var cashOffer = parseInt(cashStr, 10) || 0;
        logInfo("getFirstCounterOffer: parsed cashOffer=" + cashOffer);
        cashOffer = Math.max(0, Math.min(cashOffer, this.absoluteMax.cash));
        
        console.print("  Rep: ");
        var repStr = console.getstr("", 10);
        logInfo("getFirstCounterOffer: repStr='" + repStr + "'");
        if (repStr.toUpperCase() === "Q" || repStr.toUpperCase() === "D") {
            Challenges.declineChallenge(challenge.id, this.ctx);
            return { status: "declined", challenge: challenge };
        }
        var repOffer = parseInt(repStr, 10) || 0;
        logInfo("getFirstCounterOffer: parsed repOffer=" + repOffer);
        repOffer = Math.max(0, Math.min(repOffer, this.absoluteMax.rep));
        
        logInfo("getFirstCounterOffer: final cashOffer=" + cashOffer + " repOffer=" + repOffer);
        
        // Submit counter (first counter - can raise ceiling)
        Challenges.submitCounterOffer(challenge.id, this.ctx, { cash: cashOffer, rep: repOffer });
        
        this.statusMessage = "Counter sent! Waiting for challenger's response...";
        return this.runWaitingLoop(this.statusMessage);
    };
    
    // =========================================================================
    // PUBLIC API
    // =========================================================================
    
    /**
     * Run the full challenger flow
     * @param {Object} ctx - Player context
     * @param {Object} opponent - Opponent info
     * @param {Object} options - Optional challenge options (mode, playoffMatchId, etc.)
     * @returns {Object} { cash, rep } wager or null if cancelled
     */
    function showChallengerWagerInput(ctx, opponent, options) {
        var ui = new ChallengeUI(ctx, opponent, true, options);
        var result = ui.runChallengerFlow();
        
        if (result.status === "ready") {
            return { 
                status: "ready", 
                challenge: result.challenge,
                wager: result.challenge ? result.challenge.wager : null 
            };
        }
        
        return result;
    }
    
    /**
     * Show incoming challenge (for challengee)
     */
    function showIncomingChallenge(challenge, ctx) {
        var opponent = challenge.from || {};
        var ui = new ChallengeUI(ctx, opponent, false);
        return ui.runChallengeeFlow(challenge);
    }
    
    // Export
    LORB.Multiplayer.ChallengeNegotiation = {
        showChallengerWagerInput: showChallengerWagerInput,
        showIncomingChallenge: showIncomingChallenge,
        formatWager: formatWager
    };
    
    logInfo("ChallengeNegotiation v2 module loaded");
    
})();
