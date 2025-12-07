// Minimal UI helpers for live challenge prompts/lobbies.
(function () {
    var LORB = this.LORB;
    if (!LORB) return;
    if (!LORB.Multiplayer) LORB.Multiplayer = {};
    
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
        }
        LORB.View.line("");
        LORB.View.line("\1wPlease wait...\1n");
    }
    
    function showOutcome(status) {
        LORB.View.line("");
        if (status === "ready") {
            LORB.View.line("\1g\1hOpponent is ready! Launch your multiplayer game now.\1n");
        } else if (status === "declined") {
            LORB.View.line("\1r\1hChallenge declined.\1n");
        } else if (status === "timeout") {
            LORB.View.line("\1y\1hChallenge timed out.\1n");
        } else if (status === "cancelled") {
            LORB.View.line("\1y\1hChallenge cancelled.\1n");
        } else {
            LORB.View.line("\1y\1hChallenge ended (" + status + ").\1n");
        }
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
    }
    
    LORB.Multiplayer.ChallengeLobbyUI = {
        showIncomingPrompt: showIncomingPrompt,
        showLobbyWaiting: showLobbyWaiting,
        showOutcome: showOutcome
    };
    
})();
