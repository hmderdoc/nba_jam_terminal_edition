/**
 * playoff_view.js - UI for LORB Parallel Playoffs
 * 
 * Provides UI components for:
 * - Viewing playoff bracket
 * - Playing playoff matches (using frozen Season N snapshots)
 * - Status messages about playoff progress
 * 
 * Per spec: Players can access both Season N+1 (regular) and Season N playoffs
 * in the same session via the main menu.
 */

var _playoffRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _playoffRichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[PLAYOFF_VIEW] Failed to load RichView: " + e);
}

(function() {
    
    var RichView = _playoffRichView;
    
    // ========== HELPERS ==========
    
    function logPlayoffUI(op, status, extra) {
        if (typeof debugLog !== "function") return;
        var msg = "[LORB:PLAYOFF_UI] op=" + op + " status=" + status;
        if (extra) msg += " info=" + extra;
        debugLog(msg);
    }
    
    /**
     * Format a match for display
     */
    function formatMatch(match, showDetails) {
        if (!match) return "---";
        
        var p1Name = match.player1 ? match.player1.name : "BYE";
        var p2Name = match.player2 ? match.player2.name : "BYE";
        
        var status = match.status || "pending";
        var statusColor = "\1w";
        
        switch (status) {
            case "completed":
            case "bye":
                statusColor = "\1n\1g";
                break;
            case "in_progress":
                statusColor = "\1h\1y";
                break;
            case "pending":
                statusColor = "\1n\1w";
                break;
        }
        
        var line = statusColor;
        
        if (status === "completed" || status === "bye") {
            // Show winner highlighted
            var winnerName = match.winner ? match.winner.name : "?";
            var loserName = match.loser ? match.loser.name : "?";
            
            if (match.score) {
                line += "\1h" + winnerName + "\1n " + match.score.winner + "-" + match.score.loser + " " + loserName;
            } else {
                line += "\1h" + winnerName + "\1n def. " + loserName;
            }
            
            if (showDetails && match.resolution) {
                line += " \1h\1k(" + match.resolution + ")\1n";
            }
        } else {
            // Pending or in-progress
            line += p1Name + " vs " + p2Name + "\1n";
            
            // Add deadline indicator for pending matches
            if (showDetails && match.status === "pending" && LORB.Playoffs) {
                if (LORB.Playoffs.isMatchPastSoftDeadline(match)) {
                    line += " \1r[PAST DEADLINE]\1n";
                } else {
                    var timeLeft = LORB.Playoffs.getTimeUntilSoftDeadline(match);
                    if (timeLeft > 0) {
                        var daysLeft = Math.ceil(timeLeft / (LORB.Config.DAY_DURATION_MS || 3600000));
                        line += " \1h\1k[" + daysLeft + " day" + (daysLeft !== 1 ? "s" : "") + " left]\1n";
                    }
                }
            }
        }
        
        return line;
    }
    
    /**
     * Format a round name for display
     */
    function formatRoundName(roundName) {
        var names = {
            "finals": "FINALS",
            "semifinals": "SEMI-FINALS",
            "quarterfinals": "QUARTER-FINALS",
            "round_of_16": "ROUND OF 16",
            "round_1": "ROUND 1",
            "round_2": "ROUND 2"
        };
        return names[roundName] || roundName.toUpperCase();
    }
    
    // ========== BRACKET DISPLAY ==========
    
    /**
     * Show the playoff bracket in a simple ASCII format
     */
    function showBracket(bracket, ctx) {
        if (!bracket) {
            showNoBracket();
            return;
        }
        
        if (RichView) {
            showBracketRichView(bracket, ctx);
        } else {
            showBracketLegacy(bracket, ctx);
        }
    }
    
    function showNoBracket() {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.header("PLAYOFFS");
            view.blank();
            view.line("\1wNo active playoffs at this time.\1n");
            view.blank();
            view.line("Playoffs begin when a season ends.");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.clear();
            LORB.View.header("PLAYOFFS");
            LORB.View.line("");
            LORB.View.line("No active playoffs at this time.");
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey();
        }
    }
    
    function showBracketRichView(bracket, ctx) {
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 3 },
                { name: "content", x: 1, y: 4, width: 80, height: 20 }
            ],
            theme: "lorb"
        });
        
        view.setContentZone("content");
        
        var seasonNum = bracket.seasonNumber || "?";
        var bracketStatus = bracket.status || "active";
        var statusText = bracketStatus === "completed" ? "\1gCOMPLETE\1n" : "\1yIN PROGRESS\1n";
        
        view.line("\1h\1cSEASON " + seasonNum + " PLAYOFFS\1n  [" + statusText + "]");
        view.blank();
        
        // Show champion if bracket is complete
        if (bracket.championName) {
            view.line("\1y\1h*** CHAMPION: " + bracket.championName.toUpperCase() + " ***\1n");
            view.blank();
        }
        
        // Group matches by round
        var rounds = {};
        for (var i = 0; i < bracket.matches.length; i++) {
            var match = bracket.matches[i];
            var roundName = match.round || "unknown";
            if (!rounds[roundName]) {
                rounds[roundName] = [];
            }
            rounds[roundName].push(match);
        }
        
        // Display rounds in order (finals last)
        var roundOrder = ["round_of_16", "quarterfinals", "semifinals", "finals"];
        
        for (var r = 0; r < roundOrder.length; r++) {
            var roundName = roundOrder[r];
            if (!rounds[roundName]) continue;
            
            var roundMatches = rounds[roundName];
            
            view.line("\1h\1w" + formatRoundName(roundName) + "\1n");
            view.line("\1h\1k\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\1n");
            
            for (var m = 0; m < roundMatches.length; m++) {
                var matchLine = formatMatch(roundMatches[m], true);
                
                // Highlight player's match
                var p1Id = roundMatches[m].player1 ? roundMatches[m].player1.playerId : null;
                var p2Id = roundMatches[m].player2 ? roundMatches[m].player2.playerId : null;
                var playerId = ctx ? (ctx._globalId || ctx.name) : null;
                
                if (playerId && (p1Id === playerId || p2Id === playerId)) {
                    matchLine = "\1y>>> " + matchLine + " <<<\1n";
                }
                
                view.line("  " + matchLine);
            }
            
            view.blank();
        }
        
        view.line("\1h\1kPress any key...\1n");
        view.render();
        console.getkey();
        view.close();
    }

    function showBracketLegacy(bracket, ctx) {
        LORB.View.clear();
        LORB.View.header("SEASON " + bracket.seasonNumber + " PLAYOFFS");
        LORB.View.line("");
        
        if (bracket.championName) {
            LORB.View.line("*** CHAMPION: " + bracket.championName + " ***");
            LORB.View.line("");
        }
        
        // Simple list format
        for (var i = 0; i < bracket.matches.length; i++) {
            var match = bracket.matches[i];
            LORB.View.line(match.round + " - " + formatMatch(match, true));
        }
        
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
    }
    
    // ========== PLAYER STATUS ==========
    
    /**
     * Show the player's playoff status
     */
    function showPlayerStatus(ctx) {
        if (!LORB.Playoffs) {
            logPlayoffUI("showStatus", "error", "playoffs_module_missing");
            return null;
        }
        
        var playerId = ctx._globalId || ctx.name;
        var status = LORB.Playoffs.getPlayerPlayoffStatus(playerId);
        
        if (RichView) {
            return showPlayerStatusRichView(status, ctx);
        } else {
            return showPlayerStatusLegacy(status, ctx);
        }
    }
    
    function showPlayerStatusRichView(status, ctx) {
        var view = new RichView({ theme: "lorb" });
        view.setContentZone("content");
        
        view.header("YOUR PLAYOFF STATUS");
        view.blank();
        
        if (!status.inPlayoffs) {
            if (status.seasonNumber) {
                view.line("\1wYou did not qualify for Season " + status.seasonNumber + " playoffs.\1n");
            } else {
                view.line("\1wNo playoffs are currently active.\1n");
            }
            view.blank();
            view.line("Keep playing to qualify for next season!");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
            return null;
        }

        view.line("\1cSeason " + status.seasonNumber + " Playoffs\1n");
        view.blank();
        
        if (status.champion) {
            view.line("\1y\1h*** CONGRATULATIONS! ***\1n");
            view.line("\1gYou are the Season " + status.seasonNumber + " Champion!\1n");
            view.blank();
        } else if (status.eliminated) {
            view.line("\1rYou have been eliminated.\1n");
            view.line("Better luck next season!");
            view.blank();
        } else {
            view.line("\1gYou are still in the tournament!\1n");
            view.line("Current round: \1h" + formatRoundName(status.currentRound) + "\1n");
            view.blank();
            
            if (status.hasPendingMatch) {
                view.line("\1y\1hYou have a playoff match waiting!\1n");
                var pending = status.pendingMatches[0];
                var oppId = pending.player1.playerId === (ctx._globalId || ctx.name) 
                    ? pending.player2.playerId 
                    : pending.player1.playerId;
                var oppName = pending.player1.playerId === (ctx._globalId || ctx.name)
                    ? pending.player2.name
                    : pending.player1.name;
                
                view.line("Opponent: \1w" + oppName + "\1n");
                view.blank();
            }
        }
        
        // Menu options
        var menuItems = [];
        
        if (status.hasPendingMatch && !status.eliminated && !status.champion) {
            menuItems.push({ text: "Play Playoff Match", value: "play", hotkey: "P" });
        }
        
        // Check if there are other matches past soft deadline that this player can force-sim
        // (player has completed their match in the same round and is waiting)
        if (!status.eliminated && !status.champion && !status.hasPendingMatch && LORB.Playoffs) {
            var matchesPastDeadline = LORB.Playoffs.getMatchesPastSoftDeadline();
            var playerId = ctx._globalId || ctx.name;
            var canForceSimAny = false;
            
            for (var i = 0; i < matchesPastDeadline.length; i++) {
                if (LORB.Playoffs.canPlayerForceSimMatch(playerId, matchesPastDeadline[i])) {
                    canForceSimAny = true;
                    break;
                }
            }
            
            if (canForceSimAny) {
                view.line("\1y⚠ Other matches are past their deadline!\1n");
                view.line("\1wYou can force-simulate them to advance the bracket.\1n");
                view.blank();
                menuItems.push({ text: "\1yForce-Simulate Stalled Matches\1n", value: "force_sim", hotkey: "F" });
            }
        }
        
        menuItems.push({ text: "View Full Bracket", value: "bracket", hotkey: "B" });
        menuItems.push({ text: "Back", value: "back", hotkey: "Q" });
        
        var choice = view.menu(menuItems);
        view.close();
        
        return choice;
    }
    
    function showPlayerStatusLegacy(status, ctx) {
        LORB.View.clear();
        LORB.View.header("YOUR PLAYOFF STATUS");
        LORB.View.line("");
        
        if (!status.inPlayoffs) {
            LORB.View.line("You are not in the playoffs.");
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey();
            return null;
        }
        
        LORB.View.line("Season " + status.seasonNumber + " Playoffs");
        LORB.View.line("");
        
        if (status.champion) {
            LORB.View.line("*** YOU ARE THE CHAMPION! ***");
        } else if (status.eliminated) {
            LORB.View.line("You have been eliminated.");
        } else {
            LORB.View.line("You are still in the tournament.");
            if (status.hasPendingMatch) {
                LORB.View.line("");
                LORB.View.line("[P] Play Playoff Match");
            }
        }
        
        LORB.View.line("[B] View Bracket");
        LORB.View.line("[Q] Back");
        LORB.View.line("");
        
        var key = LORB.View.prompt("Choice: ").toUpperCase();
        
        switch (key) {
            case "P": return "play";
            case "B": return "bracket";
            default: return "back";
        }
    }
    
    // ========== PLAYOFF MATCH FLOW ==========
    
    /**
     * Start a playoff match for the player
     * Uses their Season N snapshot, not current Season N+1 build
     */
    function playPlayoffMatch(ctx) {
        if (!LORB.Playoffs) {
            logPlayoffUI("playMatch", "error", "playoffs_module_missing");
            return null;
        }
        
        var playerId = ctx._globalId || ctx.name;
        var pending = LORB.Playoffs.getPlayerPendingMatches(playerId);
        
        if (!pending || pending.length === 0) {
            showNoMatchAvailable();
            return null;
        }
        
        var match = pending[0];
        var bracket = LORB.Playoffs.getActiveBracket();
        
        if (!bracket) {
            showNoMatchAvailable();
            return null;
        }
        
        // Determine opponent
        var isPlayer1 = match.player1 && match.player1.playerId === playerId;
        var opponent = isPlayer1 ? match.player2 : match.player1;
        
        if (!opponent || opponent.isBye) {
            // Auto-advance for BYE
            logPlayoffUI("playMatch", "bye", "auto_advancing");
            return advanceByeMatch(bracket, match, playerId);
        }
        
        // Load snapshots for both players
        var mySnapshot = LORB.Playoffs.loadSnapshot(bracket.seasonNumber, playerId);
        var oppSnapshot = LORB.Playoffs.loadSnapshot(bracket.seasonNumber, opponent.playerId);
        
        if (!mySnapshot) {
            logPlayoffUI("playMatch", "error", "my_snapshot_missing");
            showSnapshotError();
            return null;
        }
        
        // Check if opponent is online (for PvP vs Ghost decision)
        var oppOnline = false;
        if (LORB.Persist && LORB.Persist.isPlayerOnline) {
            oppOnline = LORB.Persist.isPlayerOnline(opponent.playerId);
        }
        
        // Show pre-match screen
        showPreMatchScreen(match, mySnapshot, oppSnapshot, oppOnline);
        
        var confirm = confirmPlayMatch();
        if (!confirm) {
            return null;
        }
        
        // Determine resolution mode and run match
        var result = null;
        
        if (oppOnline) {
            // PvP playoff match - use challenge system
            result = runPvpPlayoffMatch(bracket, match, mySnapshot, oppSnapshot, opponent, ctx);
        }
        
        // If PvP failed/declined or opponent offline, use ghost match
        if (!result) {
            var resolution = LORB.Playoffs.RESOLUTION.GHOST;
            result = runPlayoffMatch(bracket, match, mySnapshot, oppSnapshot, resolution, ctx);
        }
        
        if (result) {
            showMatchResult(result, match);
        }
        
        return result;
    }
    
    /**
     * Run a PvP playoff match using the challenge system
     * Returns null if PvP was cancelled/failed (caller should fall back to ghost)
     */
    function runPvpPlayoffMatch(bracket, match, mySnapshot, oppSnapshot, opponent, ctx) {
        logPlayoffUI("runPvpPlayoff", "start", "matchId=" + match.id);
        
        // Check if challenge system is available
        if (!LORB.Multiplayer || !LORB.Multiplayer.Challenges || !LORB.Multiplayer.Challenges.sendChallenge) {
            logPlayoffUI("runPvpPlayoff", "error", "challenge_system_unavailable");
            showPvpUnavailable("Challenge system not available.");
            return null;
        }
        
        // Build target player object for challenge system
        var targetPlayer = {
            playerId: opponent.playerId,
            name: oppSnapshot ? oppSnapshot.name : opponent.name,
            globalId: opponent.playerId
        };
        
        // Playoff challenge metadata
        var challengeOptions = {
            mode: "playoff",
            playoffMatchId: match.id,
            playoffRound: match.round,
            seasonNumber: bracket.seasonNumber
        };
        
        var challenge = null;
        var lobbyResult = null;
        
        // Try the negotiation UI if available (handles wager input + waiting)
        if (LORB.Multiplayer.ChallengeNegotiation && LORB.Multiplayer.ChallengeNegotiation.showChallengerWagerInput) {
            // Pass playoff context to negotiation
            var negotiationResult = LORB.Multiplayer.ChallengeNegotiation.showChallengerWagerInput(ctx, targetPlayer, challengeOptions);
            
            if (!negotiationResult || negotiationResult.status === "cancelled") {
                logPlayoffUI("runPvpPlayoff", "cancelled", "user_cancelled_negotiation");
                return null;
            }
            
            challenge = negotiationResult.challenge;
            lobbyResult = negotiationResult;
        } else {
            // Legacy path - send challenge directly
            challenge = LORB.Multiplayer.Challenges.sendChallenge(ctx, targetPlayer, challengeOptions);
            
            if (!challenge) {
                logPlayoffUI("runPvpPlayoff", "error", "challenge_send_failed");
                showPvpUnavailable("Failed to send playoff challenge.");
                return null;
            }
            
            // Show waiting UI
            if (LORB.Multiplayer.ChallengeLobbyUI && LORB.Multiplayer.ChallengeLobbyUI.showLobbyWaiting) {
                LORB.Multiplayer.ChallengeLobbyUI.showLobbyWaiting(
                    challenge,
                    "Waiting for " + targetPlayer.name + " to accept playoff match..."
                );
            }
            
            // Wait for opponent to accept
            if (LORB.Multiplayer.ChallengeLobby && LORB.Multiplayer.ChallengeLobby.waitForReady) {
                lobbyResult = LORB.Multiplayer.ChallengeLobby.waitForReady(challenge.id, ctx, { tickMs: 1200 });
            } else {
                mswait(5000);
                lobbyResult = { status: "timeout" };
            }
        }
        
        // Handle non-ready outcomes
        if (!lobbyResult || lobbyResult.status !== "ready") {
            var status = lobbyResult ? lobbyResult.status : "error";
            logPlayoffUI("runPvpPlayoff", "not_ready", "status=" + status);
            
            if (status === "declined") {
                showPvpDeclined(targetPlayer.name);
            } else if (status === "timeout") {
                showPvpTimeout(targetPlayer.name);
            }
            // Return null to trigger ghost match fallback
            return null;
        }
        
        // Both players ready - launch the match!
        logPlayoffUI("runPvpPlayoff", "launching", "challengeId=" + challenge.id);
        
        if (!LORB.Multiplayer.Launcher || !LORB.Multiplayer.Launcher.launchLorbMatch) {
            logPlayoffUI("runPvpPlayoff", "error", "launcher_unavailable");
            showPvpUnavailable("Match launcher not available.");
            return null;
        }
        
        // Launch the multiplayer match
        var gameResult = LORB.Multiplayer.Launcher.launchLorbMatch(challenge, ctx, true);
        
        if (!gameResult || !gameResult.completed) {
            logPlayoffUI("runPvpPlayoff", "error", "match_incomplete");
            return null;
        }
        
        // Record the result to the playoff bracket
        var winnerId = gameResult.iWon ? (ctx._globalId || ctx.name) : opponent.playerId;
        var loserId = gameResult.iWon ? opponent.playerId : (ctx._globalId || ctx.name);
        
        var finalizeResult = LORB.Playoffs.finalizeMatch(bracket.seasonNumber, match.id, {
            winnerId: winnerId,
            loserId: loserId,
            winnerScore: gameResult.iWon ? gameResult.score.teamA : gameResult.score.teamB,
            loserScore: gameResult.iWon ? gameResult.score.teamB : gameResult.score.teamA,
            resolution: LORB.Playoffs.RESOLUTION.PVP
        });
        
        logPlayoffUI("runPvpPlayoff", "finalized", "winnerId=" + winnerId + " result=" + (finalizeResult ? "ok" : "failed"));
        
        return {
            winner: winnerId,
            score: gameResult.score,
            resolution: "pvp",
            iWon: gameResult.iWon
        };
    }
    
    function showPvpUnavailable(reason) {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.line("\1y" + reason + "\1n");
            view.line("\1wFalling back to Ghost Match...\1n");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.warn(reason);
            LORB.View.line("Falling back to Ghost Match...");
            console.getkey();
        }
    }
    
    function showPvpDeclined(oppName) {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.line("\1r" + oppName + " declined the playoff match.\1n");
            view.line("\1wFalling back to Ghost Match...\1n");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.warn(oppName + " declined the playoff match.");
            LORB.View.line("Falling back to Ghost Match...");
            console.getkey();
        }
    }
    
    function showPvpTimeout(oppName) {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.line("\1y" + oppName + " did not respond in time.\1n");
            view.line("\1wFalling back to Ghost Match...\1n");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.warn(oppName + " did not respond in time.");
            LORB.View.line("Falling back to Ghost Match...");
            console.getkey();
        }
    }
    
    function showNoMatchAvailable() {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.line("\1wNo playoff match available.\1n");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.line("No playoff match available.");
            LORB.View.line("Press any key...");
            console.getkey();
        }
    }
    
    function showSnapshotError() {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.line("\1rError: Could not load your playoff snapshot.\1n");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.warn("Error: Could not load your playoff snapshot.");
            LORB.View.line("Press any key...");
            console.getkey();
        }
    }
    
    function advanceByeMatch(bracket, match, playerId) {
        // Auto-advance the player
        var result = LORB.Playoffs.finalizeMatch(bracket.seasonNumber, match.id, {
            winnerId: playerId,
            loserId: null,
            winnerScore: 0,
            loserScore: 0,
            resolution: "bye"
        });
        
        if (result) {
            if (RichView) {
                var view = new RichView({ theme: "lorb" });
                view.setContentZone("content");
                view.line("\1gYou advance with a BYE!\1n");
                view.blank();
                view.line("\1h\1kPress any key...\1n");
                view.render();
                console.getkey();
                view.close();
            } else {
                LORB.View.line("You advance with a BYE!");
                LORB.View.line("Press any key...");
                console.getkey();
            }
        }
        
        return result;
    }
    
    function showPreMatchScreen(match, mySnapshot, oppSnapshot, oppOnline) {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            
            view.header("PLAYOFF MATCH");
            view.blank();
            view.line("\1h" + formatRoundName(match.round) + "\1n");
            view.blank();
            
            view.line("\1wYou:\1n " + mySnapshot.name);
            view.line("  Stats: SPD " + mySnapshot.stats.speed + " / 3PT " + mySnapshot.stats.threePt + " / PWR " + mySnapshot.stats.power);
            view.blank();
            
            var oppName = oppSnapshot ? oppSnapshot.name : (match.player2 ? match.player2.name : "Unknown");
            view.line("\1wOpponent:\1n " + oppName + (oppOnline ? " \1g(ONLINE)\1n" : " \1h\1k(OFFLINE)\1n"));
            if (oppSnapshot) {
                view.line("  Stats: SPD " + oppSnapshot.stats.speed + " / 3PT " + oppSnapshot.stats.threePt + " / PWR " + oppSnapshot.stats.power);
            }
            view.blank();
            
            if (!oppOnline) {
                view.line("\1yOpponent is offline - this will be a Ghost Match.\1n");
                view.line("\1yYou will play against an AI using their frozen stats.\1n");
            } else {
                view.line("\1gOpponent is online - PvP match will be initiated!\1n");
                view.line("\1gThey will receive a playoff challenge to accept.\1n");
            }
            view.blank();
            
            view.close();
        } else {
            LORB.View.clear();
            LORB.View.header("PLAYOFF MATCH - " + formatRoundName(match.round));
            LORB.View.line("");
            LORB.View.line("You: " + mySnapshot.name);
            var oppName = oppSnapshot ? oppSnapshot.name : "Unknown";
            LORB.View.line("Opponent: " + oppName + (oppOnline ? " (ONLINE)" : " (OFFLINE)"));
            LORB.View.line("");
        }
    }
    
    function confirmPlayMatch() {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            
            var choice = view.menu([
                { text: "Start Match", value: "yes", hotkey: "Y" },
                { text: "Cancel", value: "no", hotkey: "N" }
            ]);
            
            view.close();
            return choice === "yes";
        } else {
            return LORB.View.confirm("Start match? (Y/N) ");
        }
    }
    
    /**
     * Run the actual playoff match
     */
    function runPlayoffMatch(bracket, match, mySnapshot, oppSnapshot, resolution, ctx) {
        logPlayoffUI("runMatch", "start", "resolution=" + resolution);
        
        // Convert snapshots to game player format
        var myPlayer = snapshotToPlayer(mySnapshot, true);
        var oppPlayer = snapshotToPlayer(oppSnapshot || match.player2, false);
        
        // Get teammate from snapshot
        var myTeammate = getTeammateFromSnapshot(mySnapshot);
        var oppTeammate = getTeammateFromSnapshot(oppSnapshot);
        
        // Build teams
        var teamA = [myPlayer];
        if (myTeammate) teamA.push(myTeammate);
        
        var teamB = [oppPlayer];
        if (oppTeammate) teamB.push(oppTeammate);
        
        // Try to use real game engine
        if (typeof runExternalGame === "function") {
            try {
                var gameResult = runExternalGame({
                    teamA: teamA,
                    teamB: teamB,
                    quarters: 2,
                    quarterLength: 90,
                    courtType: "playoff"
                });
                
                if (gameResult && typeof gameResult.teamAScore !== "undefined") {
                    var iWon = gameResult.teamAScore > gameResult.teamBScore;
                    var winnerId = iWon ? mySnapshot.playerId : (oppSnapshot ? oppSnapshot.playerId : match.player2.playerId);
                    var loserId = iWon ? (oppSnapshot ? oppSnapshot.playerId : match.player2.playerId) : mySnapshot.playerId;
                    
                    // Finalize through standard path
                    return LORB.Playoffs.finalizeMatch(bracket.seasonNumber, match.id, {
                        winnerId: winnerId,
                        loserId: loserId,
                        winnerScore: iWon ? gameResult.teamAScore : gameResult.teamBScore,
                        loserScore: iWon ? gameResult.teamBScore : gameResult.teamAScore,
                        resolution: resolution
                    });
                }
            } catch (e) {
                logPlayoffUI("runMatch", "engine_error", e.toString());
            }
        }
        
        // Fallback: CPU simulation
        logPlayoffUI("runMatch", "fallback_sim", "using cpu sim");
        return LORB.Playoffs.simulateMatchCPU(bracket, match.id);
    }
    
    /**
     * Convert a snapshot to game player format
     */
    function snapshotToPlayer(snapshot, isHuman) {
        if (!snapshot) {
            return {
                name: "Unknown",
                shortNick: "UNK",
                speed: 5, threePt: 5, dunks: 5, power: 5, defense: 5, blocks: 5,
                skin: "lightgray",
                jersey: 0,
                isHuman: isHuman
            };
        }
        
        var stats = snapshot.stats || {};
        
        return {
            name: snapshot.name || "Player",
            shortNick: snapshot.nickname || null,
            speed: stats.speed || 5,
            threePt: stats.threePt || stats["3point"] || 5,
            dunks: stats.dunk || 5,
            power: stats.power || 5,
            defense: stats.steal || 5,
            blocks: stats.block || 5,
            skin: "lightgray",  // Could be stored in snapshot.appearance
            jersey: 1,
            isHuman: isHuman,
            lorbId: snapshot.playerId,
            lorbData: {
                isLorbPlayer: true,
                name: snapshot.name,
                level: snapshot.level || 1
            }
        };
    }
    
    /**
     * Get teammate player from snapshot
     */
    function getTeammateFromSnapshot(snapshot) {
        if (!snapshot || !snapshot.teammateData) {
            return null;
        }
        
        var tm = snapshot.teammateData;
        var stats = tm.stats || {};
        
        return {
            name: tm.name || "Teammate",
            shortNick: tm.shortNick || null,
            speed: stats.speed || 5,
            threePt: stats.threePt || 5,
            dunks: stats.dunk || 5,
            power: stats.power || 5,
            defense: stats.steal || 5,
            blocks: stats.block || 5,
            skin: tm.skin || "barney",
            jersey: 0,
            isHuman: false
        };
    }
    
    function showMatchResult(result, match) {
        if (!result) return;
        
        // Find the updated match in the result bracket
        var updatedMatch = null;
        if (result.matches) {
            for (var i = 0; i < result.matches.length; i++) {
                if (result.matches[i].id === match.id) {
                    updatedMatch = result.matches[i];
                    break;
                }
            }
        }
        
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            
            view.header("MATCH COMPLETE");
            view.blank();
            
            if (updatedMatch && updatedMatch.winner) {
                view.line("\1h\1w" + updatedMatch.winner.name + " WINS!\1n");
                if (updatedMatch.score) {
                    view.line("Final Score: " + updatedMatch.score.winner + " - " + updatedMatch.score.loser);
                }
            }
            
            view.blank();
            
            if (result.championPlayerId) {
                view.line("\1y\1h*** PLAYOFFS COMPLETE ***\1n");
                view.line("\1gSeason Champion: " + result.championName + "\1n");
            } else {
                view.line("You advance to the next round!");
            }
            
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.clear();
            LORB.View.header("MATCH COMPLETE");
            LORB.View.line("");
            
            if (updatedMatch && updatedMatch.winner) {
                LORB.View.line(updatedMatch.winner.name + " WINS!");
            }
            
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey();
        }
    }
    
    // ========== HUB INTEGRATION ==========
    
    /**
     * Get a status summary line for the hub menu
     * Returns null if no playoffs or player not involved
     */
    function getHubStatusLine(ctx) {
        if (!LORB.Playoffs) return null;
        
        var playerId = ctx._globalId || ctx.name;
        var status = LORB.Playoffs.getPlayerPlayoffStatus(playerId);
        
        if (!status.inPlayoffs) {
            // Check if playoffs exist at all
            var bracket = LORB.Playoffs.getActiveBracket();
            if (bracket) {
                return "\1h\1kSeason " + bracket.seasonNumber + " Playoffs in progress\1n";
            }
            return null;
        }
        
        if (status.champion) {
            return "\1y\1h*** Season " + status.seasonNumber + " Champion! ***\1n";
        }
        
        if (status.eliminated) {
            return "\1h\1kEliminated from Season " + status.seasonNumber + " Playoffs\1n";
        }
        
        if (status.hasPendingMatch) {
            return "\1y\1hPlayoff Match Ready! (Season " + status.seasonNumber + ")\1n";
        }
        
        return "\1gIn Season " + status.seasonNumber + " Playoffs - " + formatRoundName(status.currentRound) + "\1n";
    }
    
    /**
     * Check if player has an actionable playoff match
     */
    function hasPlayoffAction(ctx) {
        if (!LORB.Playoffs) return false;
        
        var playerId = ctx._globalId || ctx.name;
        var status = LORB.Playoffs.getPlayerPlayoffStatus(playerId);
        
        return status.inPlayoffs && status.hasPendingMatch && !status.eliminated && !status.champion;
    }
    
    // ========== MAIN ENTRY POINT ==========
    
    /**
     * Main playoff menu (called from hub or tournaments)
     */
    function run(ctx) {
        logPlayoffUI("run", "start");
        
        while (true) {
            var choice = showPlayerStatus(ctx);
            
            switch (choice) {
                case "play":
                    playPlayoffMatch(ctx);
                    break;
                    
                case "bracket":
                    var bracket = LORB.Playoffs ? LORB.Playoffs.getActiveBracket() : null;
                    showBracket(bracket, ctx);
                    break;
                    
                case "force_sim":
                    forceSimulateStalledMatches(ctx);
                    break;
                    
                case "back":
                case null:
                    return;
                    
                default:
                    return;
            }
        }
    }
    
    /**
     * Force-simulate matches that are past their soft deadline
     * This allows a waiting player to advance the bracket
     */
    function forceSimulateStalledMatches(ctx) {
        if (!LORB.Playoffs) {
            showError("Playoffs system not available.");
            return;
        }
        
        var playerId = ctx._globalId || ctx.name;
        var matchesPastDeadline = LORB.Playoffs.getMatchesPastSoftDeadline();
        
        // Filter to matches this player can force-sim
        var simulatable = [];
        for (var i = 0; i < matchesPastDeadline.length; i++) {
            if (LORB.Playoffs.canPlayerForceSimMatch(playerId, matchesPastDeadline[i])) {
                simulatable.push(matchesPastDeadline[i]);
            }
        }
        
        if (simulatable.length === 0) {
            showInfo("No matches can be force-simulated at this time.");
            return;
        }
        
        // Show confirmation
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            
            view.header("FORCE-SIMULATE MATCHES");
            view.blank();
            view.line("\1yThe following matches are past their deadline:\1n");
            view.blank();
            
            for (var j = 0; j < simulatable.length; j++) {
                var m = simulatable[j];
                var p1Name = m.player1 ? m.player1.name : "BYE";
                var p2Name = m.player2 ? m.player2.name : "BYE";
                view.line("  \1w" + formatRoundName(m.round) + ":\1n " + p1Name + " vs " + p2Name);
            }
            
            view.blank();
            view.line("\1rForce-simulating will use CPU simulation to determine winners.\1n");
            view.line("\1wThis allows the bracket to advance so you can continue.\1n");
            view.blank();
            
            var choice = view.menu([
                { text: "Simulate All Stalled Matches", value: "yes", hotkey: "Y" },
                { text: "Cancel", value: "no", hotkey: "N" }
            ]);
            
            view.close();
            
            if (choice !== "yes") return;
        } else {
            LORB.View.clear();
            LORB.View.header("FORCE-SIMULATE MATCHES");
            LORB.View.line("");
            LORB.View.line(simulatable.length + " match(es) can be force-simulated.");
            LORB.View.line("");
            if (!LORB.View.confirm("Force-simulate all stalled matches? (Y/N) ")) {
                return;
            }
        }
        
        // Simulate each match
        var bracket = LORB.Playoffs.getActiveBracket();
        var simulated = 0;
        
        for (var k = 0; k < simulatable.length; k++) {
            var match = simulatable[k];
            logPlayoffUI("forceSim", "simulating", "match=" + match.id);
            
            LORB.Playoffs.simulateMatchCPU(bracket, match.id);
            simulated++;
        }
        
        // Show result
        if (RichView) {
            var resultView = new RichView({ theme: "lorb" });
            resultView.setContentZone("content");
            resultView.line("\1g" + simulated + " match(es) have been simulated!\1n");
            resultView.blank();
            resultView.line("\1wThe bracket has been updated.\1n");
            resultView.blank();
            resultView.line("\1h\1kPress any key...\1n");
            resultView.render();
            console.getkey();
            resultView.close();
        } else {
            LORB.View.line(simulated + " match(es) have been simulated!");
            LORB.View.line("Press any key...");
            console.getkey();
        }
    }
    
    function showError(message) {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.line("\1r" + message + "\1n");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.warn(message);
            console.getkey();
        }
    }
    
    function showInfo(message) {
        if (RichView) {
            var view = new RichView({ theme: "lorb" });
            view.setContentZone("content");
            view.line("\1w" + message + "\1n");
            view.blank();
            view.line("\1h\1kPress any key...\1n");
            view.render();
            console.getkey();
            view.close();
        } else {
            LORB.View.line(message);
            console.getkey();
        }
    }
    
    // ========== EXPORTS ==========
    
    if (!LORB.UI) LORB.UI = {};
    LORB.UI.PlayoffView = {
        run: run,
        showBracket: showBracket,
        showPlayerStatus: showPlayerStatus,
        playPlayoffMatch: playPlayoffMatch,
        forceSimulateStalledMatches: forceSimulateStalledMatches,
        getHubStatusLine: getHubStatusLine,
        hasPlayoffAction: hasPlayoffAction,
        formatRoundName: formatRoundName
    };
    
})();
