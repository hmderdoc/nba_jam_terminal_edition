// Minimal UI helpers for live challenge prompts/lobbies.
(function () {
    if (!this.LORB) return;
    if (!this.LORB.Multiplayer) this.LORB.Multiplayer = {};
    
    function showIncomingPrompt(challenge) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("LIVE CHALLENGE");
        LORB.View.line("");
        LORB.View.line("\1cFrom:\1n " + (challenge.from && challenge.from.name ? challenge.from.name : "Unknown"));
        if (challenge.from && challenge.from.bbsName) {
            LORB.View.line("\1cBBS:\1n " + challenge.from.bbsName);
        }
        LORB.View.line("");
        LORB.View.line("Do you want to play now?");
        LORB.View.line("");
        return LORB.View.confirm("Accept (Y/N)? ");
    }
    
    function showLobbyWaiting(challenge, message) {
        LORB.View.init();
        LORB.View.clear();
        LORB.View.header("CHALLENGE LOBBY");
        LORB.View.line("");
        LORB.View.line(message || "Waiting for the other player to confirm...");
        LORB.View.line("");
        var opp = challenge ? (challenge.from || challenge.to) : null;
        if (challenge && challenge.from && challenge.to) {
            LORB.View.line("\1cYou:\1n " + (challenge.from.name || "Player"));
            LORB.View.line("\1cOpponent:\1n " + (challenge.to.name || "Player"));
        } else if (opp) {
            LORB.View.line("\1cOpponent:\1n " + (opp.name || "Player"));
        }
        LORB.View.line("");
        LORB.View.line("\1kPress CTRL+C to cancel/exit lobby\1n");
    }
    
    function showOutcome(status) {
        LORB.View.line("");
        if (status === "ready") {
            LORB.View.line("\1gOpponent is ready. Launch your multiplayer game now.\1n");
        } else if (status === "declined") {
            LORB.View.warn("Challenge was declined.");
        } else if (status === "timeout") {
            LORB.View.warn("Challenge timed out.");
        } else if (status === "cancelled") {
            LORB.View.warn("Challenge was cancelled.");
        } else if (status === "expired") {
            LORB.View.warn("Challenge expired.");
        } else {
            LORB.View.warn("Challenge unavailable.");
        }
        LORB.View.line("Press any key...");
        console.getkey();
    }
    
    this.LORB.Multiplayer.ChallengeLobbyUI = {
        showIncomingPrompt: showIncomingPrompt,
        showLobbyWaiting: showLobbyWaiting,
        showOutcome: showOutcome
    };
    
})();
