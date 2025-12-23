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
}

(function() {
    
    var RichView = _playoffRichView;
    
    // ========== PLAYOFF STATUS ASCII ART ==========
    // Each art piece is an array of 20 lines, 40 chars wide
    // Uses \x01 codes for colors (Synchronet format)
    
    var PLAYOFF_ART = {
        // Champion - trophy celebration
        champion: [
            "                                        ",
            "               \\\\\\|||///               ",
            "                \\\\|||//                ",
            "               .--------.               ",
            "              /   ___    \\              ",
            "             |   (___)    |             ",
            "             |   '   '    |             ",
            "              \\   ###   /              ",
            "               '-------'               ",
            "                  | |                  ",
            "                  | |                  ",
            "                 /| |\\                 ",
            "                /_| |_\\                ",
            "              |_________|              ",
            "                                        ",
            "         \x01y\x01h*** CHAMPION! ***\x01n         ",
            "                                        ",
            "       \x01gYou conquered Season \x01h#N\x01n       ",
            "                                        ",
            "                                        "
        ],
        
        // Eliminated - knocked out
        eliminated: [
            "                                        ",
            "                                        ",
            "              .-~~~~~~~-.              ",
            "            .'           '.            ",
            "           /   X       X   \\           ",
            "          |                 |          ",
            "          |                 |          ",
            "          |     .-----.     |          ",
            "           \\   (       )   /           ",
            "            '.  ~~~~~~~  .'            ",
            "              '---------'              ",
            "                                        ",
            "          \x01r\x01h** ELIMINATED **\x01n          ",
            "                                        ",
            "         You fought bravely but        ",
            "         fell in the playoffs.         ",
            "                                        ",
            "        Better luck next season!       ",
            "                                        ",
            "                                        "
        ],
        
        // Ghost match available - player vs shadow
        ghost_match: [
            "                                        ",
            "        YOU              GHOST         ",
            "                                        ",
            "       .---.            .---.          ",
            "      ( o o )    VS    ( ? ? )         ",
            "       \\ ^ /            \\ ~ /          ",
            "        |||              |||           ",
            "       /|||\\            /|||\\          ",
            "        / \\              / \\           ",
            "                                        ",
            "       \x01y\x01h*** GHOST MATCH ***\x01n          ",
            "                                        ",
            "      \x01rOpponent missed deadline!\x01n      ",
            "                                        ",
            "       Play against their AI to        ",
            "       secure your advancement.        ",
            "                                        ",
            "       \x01gThis match is free!\x01n           ",
            "                                        ",
            "                                        "
        ],
        
        // Waiting for opponent (offline, not past deadline)
        waiting_opponent: [
            "                                        ",
            "                                        ",
            "              .---.                    ",
            "             ( o o )                   ",
            "              \\ ? /                    ",
            "               |||                     ",
            "              /|||\\                    ",
            "               / \\                     ",
            "                                        ",
            "                         ???           ",
            "                        .---.          ",
            "                       ( ? ? )         ",
            "                                        ",
            "        \x01y** WAITING FOR OPPONENT **\x01n    ",
            "                                        ",
            "         Your opponent is offline.     ",
            "         Check back later or wait      ",
            "         for the deadline to pass.     ",
            "                                        ",
            "                                        "
        ],
        
        // Waiting for round to complete
        waiting_round: [
            "                                        ",
            "                                        ",
            "              .---------.              ",
            "             /   12:00   \\             ",
            "            |      |      |            ",
            "            |      *---   |            ",
            "             \\           /             ",
            "              '---------'              ",
            "                                        ",
            "                                        ",
            "         \x01g** ROUND COMPLETE **\x01n         ",
            "                                        ",
            "         You've won your match!        ",
            "                                        ",
            "         Waiting for other games       ",
            "         in this round to finish...    ",
            "                                        ",
            "        Press \x01hB\x01n to view bracket       ",
            "                                        ",
            "                                        "
        ],
        
        // PvP match available
        pvp_ready: [
            "                                        ",
            "        YOU              OPP           ",
            "                                        ",
            "       .---.            .---.          ",
            "      ( o o )    VS    ( o o )         ",
            "       \x01g\\ ^ /\x01n            \x01r\\ ^ /\x01n          ",
            "        |||              |||           ",
            "       /|||\\            /|||\\          ",
            "        / \\              / \\           ",
            "                                        ",
            "        \x01g\x01h*** PVP MATCH! ***\x01n           ",
            "                                        ",
            "        \x01wYour opponent is \x01g\x01hONLINE\x01n       ",
            "                                        ",
            "         Challenge them now for        ",
            "         a real player-vs-player       ",
            "         playoff showdown!             ",
            "                                        ",
            "                                        ",
            "                                        "
        ],
        
        // Not in playoffs
        not_qualified: [
            "                                        ",
            "                                        ",
            "              .---.                    ",
            "             ( . . )                   ",
            "              \\ _ /                    ",
            "               |||                     ",
            "              /|||\\                    ",
            "               / \\                     ",
            "                                        ",
            "                                        ",
            "       \x01y** NOT IN PLAYOFFS **\x01n         ",
            "                                        ",
            "        You didn't qualify for         ",
            "        this season's playoffs.        ",
            "                                        ",
            "         Keep playing to earn          ",
            "         your spot next time!          ",
            "                                        ",
            "                                        ",
            "                                        "
        ]
    };
    
    /**
     * Draw playoff art into the art zone frame
     * Uses TrophyArt utility with dynamic season number injection
     */
    function drawPlayoffArt(artFrame, artKey, seasonNumber) {
        if (!artFrame) return;
        
        // Use TrophyArt utility if available - renders trophy.bin with Roman numeral season
        if (LORB.Util && LORB.Util.TrophyArt && LORB.Util.TrophyArt.render) {
            LORB.Util.TrophyArt.render(artFrame, { seasonNumber: seasonNumber || 1 });
            return;
        }
        
        // Fallback to ASCII art
        var art = PLAYOFF_ART[artKey] || PLAYOFF_ART.waiting_round;
        
        // Clear the art zone
        try { artFrame.clear(); } catch (e) {}
        
        // Draw each line
        for (var row = 0; row < art.length && row < 20; row++) {
            var line = art[row];
            // Replace season placeholder
            if (seasonNumber && line.indexOf("#N") !== -1) {
                line = line.replace("#N", String(seasonNumber));
            }
            
            try {
                artFrame.gotoxy(1, row + 1);
                artFrame.putmsg(line);
            } catch (e) {}
        }
        
        try { if (artFrame.cycle) artFrame.cycle(); } catch (e) {}
    }
    
    /**
     * Load figlet header for playoff view using random font with gradient colorization
     * Falls back to plain centered text if figlet unavailable
     */
    function loadPlayoffFigletHeader(frame, text) {
        if (!frame) return;
        
        // Use yellow/gold for playoffs (14 = YELLOW)
        var fgAttr = (typeof YELLOW === "number") ? YELLOW : 14;
        
        // Try figlet rendering via LORB.Util.FigletBanner
        if (LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
            LORB.Util.FigletBanner.renderToFrame(frame, text, fgAttr);
        } else {
            // Fallback: plain centered text
            try {
                frame.clear();
                var padding = Math.floor((80 - text.length) / 2);
                frame.gotoxy(padding + 1, 2);
                frame.attr = fgAttr;
                frame.putmsg(text);
            } catch (e) {}
        }
    }

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
            // Show winner highlighted, score in white, loser in light red
            var winnerName = match.winner ? match.winner.name : "?";
            var loserName = match.loser ? match.loser.name : "?";
            
            if (match.score) {
                line += "\1h\1g" + winnerName + " \1h\1w" + match.score.winner + "-" + match.score.loser + " \1h\1r" + loserName + "\1n";
            } else {
                line += "\1h\1g" + winnerName + "\1h\1w def. \1h\1r" + loserName + "\1n";
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
    
    /**
     * Format round name for figlet header display (shorter, title case)
     * Uses tournament-style names that imply the round naturally
     */
    function formatRoundForFiglet(roundName) {
        if (!roundName) return "Playoffs";
        
        var names = {
            "finals": "Finals",
            "semifinals": "Final Four",
            "quarterfinals": "Elite Eight",
            "round_of_16": "Sweet Sixteen",
            "round_of_32": "Round of 32",
            "round_of_64": "Round of 64",
            "round_1": "First Round",
            "round_2": "Second Round",
            "round_3": "Third Round"
        };
        
        // Check for match in known names
        if (names[roundName]) {
            return names[roundName];
        }
        
        // Handle numeric round names like "round_4" -> "Round 4"
        if (roundName.indexOf("round_") === 0) {
            var num = roundName.replace("round_", "");
            return "Round " + num;
        }
        
        // Capitalize first letter as fallback
        return roundName.charAt(0).toUpperCase() + roundName.slice(1);
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
            console.getkey(K_NOSPIN);
            view.close();
        } else {
            LORB.View.clear();
            LORB.View.header("PLAYOFFS");
            LORB.View.line("");
            LORB.View.line("No active playoffs at this time.");
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey(K_NOSPIN);
        }
    }
    
    // ========== BRACKET RENDERING CONSTANTS ==========
    // CP437 box-drawing characters for bracket lines
    var BOX = {
        H:  "\xC4",   // ─ horizontal
        V:  "\xB3",   // │ vertical
        TL: "\xDA",   // ┌ top-left corner
        TR: "\xBF",   // ┐ top-right corner
        BL: "\xC0",   // └ bottom-left corner
        BR: "\xD9",   // ┘ bottom-right corner
        LT: "\xC3",   // ├ left tee
        RT: "\xB4",   // ┤ right tee
        TT: "\xC2",   // ┬ top tee
        BT: "\xC1"    // ┴ bottom tee
    };
    
    // Player name display width for bracket slots
    var SLOT_WIDTH = 14;
    
    /**
     * Truncate or pad a name to exact width
     */
    function fitName(name, width) {
        if (!name) name = "TBD";
        width = width || SLOT_WIDTH;
        if (name.length > width) {
            return name.substring(0, width - 1) + ".";
        }
        while (name.length < width) name += " ";
        return name;
    }
    
    /**
     * Get player name with color based on match result
     */
    function getPlayerDisplay(player, match, playerId, width) {
        width = width || SLOT_WIDTH;
        if (!player) return "\1h\1k" + fitName("TBD", width) + "\1n";
        if (player.isBye) return "\1h\1k" + fitName("BYE", width) + "\1n";
        
        var name = fitName(player.name || player.shortNick || "???", width);
        var isCurrentPlayer = playerId && (player.playerId === playerId);
        
        // Check if match is complete
        if (match && (match.status === "completed" || match.status === "bye")) {
            if (match.winner && match.winner.playerId === player.playerId) {
                return isCurrentPlayer ? "\1h\1y" + name + "\1n" : "\1h\1g" + name + "\1n";
            } else {
                return isCurrentPlayer ? "\1r" + name + "\1n" : "\1h\1r" + name + "\1n";
            }
        }
        
        if (isCurrentPlayer) {
            return "\1h\1y" + name + "\1n";
        }
        return "\1w" + name + "\1n";
    }
    
    /**
     * Draw a horizontal line of specified width
     */
    function hLine(width) {
        var s = "";
        for (var i = 0; i < width; i++) s += BOX.H;
        return s;
    }
    
    /**
     * Render a proper sports-style bracket visualization
     * 
     * New layout - each team takes 2 rows:
     * Row 1: Team name
     * Row 2: Bracket line underneath
     * 
     * Example for left side:
     * TEAM1
     * ──────────────┐
     * TEAM2         ├─── WINNER1
     * ──────────────┘    ─────────────┐
     *                                 │
     * TEAM3                           ├─── FINALIST
     * ──────────────┐    ─────────────┘
     * TEAM4         ├─── WINNER2
     * ──────────────┘
     */
    function showBracketRichView(bracket, ctx) {
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 2 },
                { name: "bracket", x: 1, y: 3, width: 80, height: 22 }
            ],
            theme: "lorb"
        });
        
        // Render header
        var headerFrame = view.getZone("header");
        var seasonNum = bracket.seasonNumber || "?";
        var bracketStatus = bracket.status || "active";
        var statusText = bracketStatus === "completed" ? "\1gCOMPLETE\1n" : "\1yIN PROGRESS\1n";
        
        headerFrame.gotoxy(1, 1);
        headerFrame.putmsg("\1h\1cSEASON " + seasonNum + " PLAYOFFS\1n  [" + statusText + "]" +
            (bracket.championName ? "  \1y\1h\xF0 CHAMPION: " + bracket.championName.toUpperCase() + " \xF0\1n" : ""));
        
        var bracketFrame = view.getZone("bracket");
        var playerId = ctx ? (ctx._globalId || ctx.name) : null;
        
        // Group matches by round
        var rounds = {};
        for (var i = 0; i < bracket.matches.length; i++) {
            var match = bracket.matches[i];
            var roundName = match.round || "unknown";
            if (!rounds[roundName]) rounds[roundName] = [];
            rounds[roundName].push(match);
        }
        
        var bracketSize = bracket.bracketSize || 8;
        
        if (bracketSize <= 4) {
            renderBracket4(bracketFrame, rounds, playerId, bracket);
        } else if (bracketSize <= 8) {
            renderBracket8(bracketFrame, rounds, playerId, bracket);
        } else {
            renderBracket16(bracketFrame, rounds, playerId, bracket);
        }
        
        bracketFrame.gotoxy(1, 21);
        bracketFrame.putmsg("\1h\1kPress any key to continue...\1n");
        
        view.render();
        console.getkey(K_NOSPIN);
        view.close();
    }
    
    /**
     * 4-team bracket (semifinals + finals)
     * 
     * Layout (20 rows available):
     *   1: SEMI1-P1
     *   2: ─────────────┐
     *   3: SEMI1-P2     ├──── FINALIST1
     *   4: ─────────────┘     ───────────┐
     *   5:                               │
     *   6:              FINALS           │
     *   7:              ═══════          │
     *   8:                               │
     *   9: SEMI2-P1           ───────────┘
     *  10: ─────────────┐     FINALIST2
     *  11: SEMI2-P2     ├────
     *  12: ─────────────┘
     */
    function renderBracket4(frame, rounds, playerId, bracket) {
        var semis = rounds["semifinals"] || [];
        var finals = rounds["finals"] || [];
        
        var col1 = 1;       // First round teams
        var col2 = 20;      // Semifinal winners
        var colF = 35;      // Finals
        
        // Left semifinal (top)
        if (semis.length >= 1) {
            var m = semis[0];
            // Player 1
            frame.gotoxy(col1, 1);
            frame.putmsg(getPlayerDisplay(m.player1, m, playerId));
            frame.gotoxy(col1, 2);
            frame.putmsg("\1h\1k" + hLine(14) + BOX.TR + "\1n");
            // Player 2
            frame.gotoxy(col1, 3);
            frame.putmsg(getPlayerDisplay(m.player2, m, playerId));
            frame.gotoxy(col1, 4);
            frame.putmsg("\1h\1k" + hLine(14) + BOX.BR + "\1n");
            // Connector
            frame.gotoxy(col1 + 15, 3);
            frame.putmsg("\1h\1k" + BOX.RT + hLine(3) + "\1n");
            // Winner slot
            frame.gotoxy(col2, 3);
            frame.putmsg(getPlayerDisplay(m.winner, m, playerId));
            frame.gotoxy(col2, 4);
            frame.putmsg("\1h\1k" + hLine(14) + BOX.TR + "\1n");
        }
        
        // Finals area (center)
        frame.gotoxy(colF, 6);
        frame.putmsg("\1h\1y\xDB FINALS \xDB\1n");
        
        if (finals.length >= 1) {
            var f = finals[0];
            // Vertical connectors
            for (var r = 5; r <= 9; r++) {
                frame.gotoxy(col2 + 14, r);
                frame.putmsg("\1h\1k" + BOX.V + "\1n");
            }
            // Finals matchup or result
            if (f.status === "completed" && f.winner) {
                frame.gotoxy(colF - 2, 8);
                frame.putmsg("\1h\1g" + f.winner.name + " WINS!\1n");
            } else {
                var n1 = f.player1 ? f.player1.name : "TBD";
                var n2 = f.player2 ? f.player2.name : "TBD";
                frame.gotoxy(colF - 4, 8);
                frame.putmsg("\1w" + n1 + " vs " + n2 + "\1n");
            }
        }
        
        // Right semifinal (bottom)
        if (semis.length >= 2) {
            var m = semis[1];
            // Winner slot (from bottom semi)
            frame.gotoxy(col2, 10);
            frame.putmsg("\1h\1k" + hLine(14) + BOX.BR + "\1n");
            frame.gotoxy(col2, 11);
            frame.putmsg(getPlayerDisplay(m.winner, m, playerId));
            // Player 1
            frame.gotoxy(col1, 13);
            frame.putmsg(getPlayerDisplay(m.player1, m, playerId));
            frame.gotoxy(col1, 14);
            frame.putmsg("\1h\1k" + hLine(14) + BOX.TR + "\1n");
            // Player 2
            frame.gotoxy(col1, 15);
            frame.putmsg(getPlayerDisplay(m.player2, m, playerId));
            frame.gotoxy(col1, 16);
            frame.putmsg("\1h\1k" + hLine(14) + BOX.BR + "\1n");
            // Connector
            frame.gotoxy(col1 + 15, 15);
            frame.putmsg("\1h\1k" + BOX.RT + hLine(3) + "\1n");
        }
    }
    
    /**
     * 8-team bracket (quarterfinals + semifinals + finals)
     * 
     * Layout concept - 80 cols total:
     * LEFT SIDE: QF names at col 1, winners at col 18, SF winner at col 34
     * RIGHT SIDE: SF winner at col 35, winners at col 50, QF names at col 65
     * FINALS: centered around col 40
     * 
     * Each matchup uses the pattern:
     *   Name1
     *   ─────────────┐
     *   Name2        ├── Winner
     *   ─────────────┘
     */
    function renderBracket8(frame, rounds, playerId, bracket) {
        var quarters = rounds["quarterfinals"] || [];
        var semis = rounds["semifinals"] || [];
        var finals = rounds["finals"] || [];
        
        // Column positions - carefully calculated for 80-col screen
        var L_QF = 1;      // Left QF teams start
        var L_WIN = 18;    // Left QF winners / SF players
        var R_WIN = 50;    // Right QF winners / SF players  
        var R_QF = 65;     // Right QF teams start
        var CENTER = 40;   // Center for finals
        
        var NAME_W = 14;   // Name display width
        
        // === LEFT SIDE QUARTERFINALS ===
        
        // QF Match 1 (rows 1-4): top-left matchup
        if (quarters.length >= 1) {
            var q = quarters[0];
            // Player 1 name, then line below with TR corner
            frame.gotoxy(L_QF, 1);
            frame.putmsg(getPlayerDisplay(q.player1, q, playerId));
            frame.gotoxy(L_QF, 2);
            frame.putmsg("\1h\1k" + hLine(NAME_W) + BOX.TR + "\1n");
            // Player 2 name, then line below with BR corner  
            frame.gotoxy(L_QF, 3);
            frame.putmsg(getPlayerDisplay(q.player2, q, playerId));
            frame.gotoxy(L_QF, 4);
            frame.putmsg("\1h\1k" + hLine(NAME_W) + BOX.BR + "\1n");
            // Tee connector between the two bracket lines (row 3, after name)
            frame.gotoxy(L_QF + NAME_W, 3);
            frame.putmsg("\1h\1k" + BOX.RT + hLine(2) + "\1n");
            // QF1 winner
            frame.gotoxy(L_WIN, 3);
            frame.putmsg(getPlayerDisplay(q.winner, q, playerId));
            frame.gotoxy(L_WIN, 4);
            frame.putmsg("\1h\1k" + hLine(NAME_W) + BOX.TR + "\1n");
        }
        
        // QF Match 2 (rows 7-10): bottom-left matchup
        if (quarters.length >= 2) {
            var q = quarters[1];
            frame.gotoxy(L_QF, 7);
            frame.putmsg(getPlayerDisplay(q.player1, q, playerId));
            frame.gotoxy(L_QF, 8);
            frame.putmsg("\1h\1k" + hLine(NAME_W) + BOX.TR + "\1n");
            frame.gotoxy(L_QF, 9);
            frame.putmsg(getPlayerDisplay(q.player2, q, playerId));
            frame.gotoxy(L_QF, 10);
            frame.putmsg("\1h\1k" + hLine(NAME_W) + BOX.BR + "\1n");
            frame.gotoxy(L_QF + NAME_W, 9);
            frame.putmsg("\1h\1k" + BOX.RT + hLine(2) + "\1n");
            // QF2 winner (line ABOVE name since we're coming from bottom)
            frame.gotoxy(L_WIN, 9);
            frame.putmsg(getPlayerDisplay(q.winner, q, playerId));
            frame.gotoxy(L_WIN, 10);
            frame.putmsg("\1h\1k" + hLine(NAME_W) + BOX.BR + "\1n");
        }
        
        // Left SF vertical connector: from QF1 winner line (row 4) down to QF2 winner line (row 10)
        // Output tee at row 7 (middle)
        var lsfCol = L_WIN + NAME_W;  // Column where vertical connector goes
        for (var r = 5; r <= 9; r++) {
            frame.gotoxy(lsfCol, r);
            if (r === 7) {
                frame.putmsg("\1h\1k" + BOX.RT + hLine(2) + "\1n");  // Tee pointing right
            } else {
                frame.putmsg("\1h\1k" + BOX.V + "\1n");
            }
        }
        
        // Left SF winner (positioned after the tee)
        if (semis.length >= 1) {
            var s = semis[0];
            frame.gotoxy(lsfCol + 3, 7);
            frame.putmsg(getPlayerDisplay(s.winner, s, playerId, 12));
            frame.gotoxy(lsfCol + 3, 8);
            frame.putmsg("\1h\1k" + hLine(12) + BOX.TR + "\1n");
        }
        
        // === RIGHT SIDE QUARTERFINALS ===
        // Mirror of left side - brackets go LEFT toward center
        
        // QF Match 3 (rows 1-4): top-right matchup
        if (quarters.length >= 3) {
            var q = quarters[2];
            // Player 1 name (right-aligned conceptually)
            frame.gotoxy(R_QF, 1);
            frame.putmsg(getPlayerDisplay(q.player1, q, playerId));
            // Line below: TL corner at start, then horizontal
            frame.gotoxy(R_QF - 1, 2);
            frame.putmsg("\1h\1k" + BOX.TL + hLine(NAME_W) + "\1n");
            // Player 2
            frame.gotoxy(R_QF, 3);
            frame.putmsg(getPlayerDisplay(q.player2, q, playerId));
            frame.gotoxy(R_QF - 1, 4);
            frame.putmsg("\1h\1k" + BOX.BL + hLine(NAME_W) + "\1n");
            // Tee connector (pointing left)
            frame.gotoxy(R_QF - 1, 3);
            frame.putmsg("\1h\1k" + BOX.LT + "\1n");
            // QF3 winner (to the left of the QF bracket)
            frame.gotoxy(R_WIN, 3);
            frame.putmsg(getPlayerDisplay(q.winner, q, playerId));
            frame.gotoxy(R_WIN - 1, 4);
            frame.putmsg("\1h\1k" + BOX.TL + hLine(NAME_W) + "\1n");
        }
        
        // QF Match 4 (rows 7-10): bottom-right matchup
        if (quarters.length >= 4) {
            var q = quarters[3];
            frame.gotoxy(R_QF, 7);
            frame.putmsg(getPlayerDisplay(q.player1, q, playerId));
            frame.gotoxy(R_QF - 1, 8);
            frame.putmsg("\1h\1k" + BOX.TL + hLine(NAME_W) + "\1n");
            frame.gotoxy(R_QF, 9);
            frame.putmsg(getPlayerDisplay(q.player2, q, playerId));
            frame.gotoxy(R_QF - 1, 10);
            frame.putmsg("\1h\1k" + BOX.BL + hLine(NAME_W) + "\1n");
            frame.gotoxy(R_QF - 1, 9);
            frame.putmsg("\1h\1k" + BOX.LT + "\1n");
            // QF4 winner
            frame.gotoxy(R_WIN, 9);
            frame.putmsg(getPlayerDisplay(q.winner, q, playerId));
            frame.gotoxy(R_WIN - 1, 10);
            frame.putmsg("\1h\1k" + BOX.BL + hLine(NAME_W) + "\1n");
        }
        
        // Right SF vertical connector
        var rsfCol = R_WIN - 1;  // Column where vertical connector goes (left edge of winner area)
        for (var r = 5; r <= 9; r++) {
            frame.gotoxy(rsfCol, r);
            if (r === 7) {
                frame.putmsg("\1h\1k" + BOX.LT + "\1n");  // Tee pointing left
            } else {
                frame.putmsg("\1h\1k" + BOX.V + "\1n");
            }
        }
        
        // Right SF winner (positioned before the tee, going left)
        if (semis.length >= 2) {
            var s = semis[1];
            frame.gotoxy(rsfCol - 14, 7);
            frame.putmsg(getPlayerDisplay(s.winner, s, playerId, 12));
            frame.gotoxy(rsfCol - 14, 8);
            frame.putmsg("\1h\1k" + BOX.TR + hLine(12) + "\1n");
        }
        
        // === FINALS ===
        // Vertical lines from SF winners down to finals area
        var leftFinalsCol = lsfCol + 3 + 12;   // End of left SF winner line
        var rightFinalsCol = rsfCol - 14;       // Start of right SF winner line
        
        for (var r = 9; r <= 13; r++) {
            frame.gotoxy(leftFinalsCol, r);
            frame.putmsg("\1h\1k" + BOX.V + "\1n");
            frame.gotoxy(rightFinalsCol, r);
            frame.putmsg("\1h\1k" + BOX.V + "\1n");
        }
        
        // Finals box - connect the two vertical lines
        frame.gotoxy(leftFinalsCol, 14);
        frame.putmsg("\1h\1k" + BOX.BL + hLine(rightFinalsCol - leftFinalsCol - 1) + BOX.BR + "\1n");
        
        // Finals label centered
        var finalsLabelCol = Math.floor((leftFinalsCol + rightFinalsCol) / 2) - 4;
        frame.gotoxy(finalsLabelCol, 14);
        frame.putmsg("\1h\1y FINALS \1n");
        
        // Finals result
        if (finals.length >= 1) {
            var f = finals[0];
            if (f.status === "completed" && f.winner) {
                frame.gotoxy(finalsLabelCol - 1, 16);
                frame.putmsg("\1h\1y\xF0 CHAMPION \xF0\1n");
                var champName = f.winner.name || "???";
                frame.gotoxy(finalsLabelCol + 5 - Math.floor(champName.length / 2), 17);
                frame.putmsg("\1h\1g" + champName + "\1n");
            } else {
                var n1 = f.player1 ? f.player1.name : "TBD";
                var n2 = f.player2 ? f.player2.name : "TBD";
                frame.gotoxy(finalsLabelCol - 4, 16);
                frame.putmsg("\1w" + fitName(n1, 10) + " vs " + fitName(n2, 10) + "\1n");
            }
        }
    }
    
    /**
     * 16-team bracket - show R16 results, then QF onwards
     */
    function renderBracket16(frame, rounds, playerId, bracket) {
        var r16 = rounds["round_of_16"] || [];
        var quarters = rounds["quarterfinals"] || [];
        var semis = rounds["semifinals"] || [];
        var finals = rounds["finals"] || [];
        
        // Show R16 results compactly at top
        frame.gotoxy(1, 1);
        frame.putmsg("\1h\1cROUND OF 16 RESULTS:\1n");
        
        // Left 4 R16 winners
        for (var i = 0; i < 4 && i < r16.length; i++) {
            var m = r16[i];
            var w = m.winner ? m.winner.name : "---";
            frame.gotoxy(1 + (i * 10), 2);
            frame.putmsg("\1w" + fitName(w, 9) + "\1n");
        }
        // Right 4 R16 winners
        for (var i = 4; i < 8 && i < r16.length; i++) {
            var m = r16[i];
            var w = m.winner ? m.winner.name : "---";
            frame.gotoxy(41 + ((i - 4) * 10), 2);
            frame.putmsg("\1w" + fitName(w, 9) + "\1n");
        }
        
        frame.gotoxy(1, 3);
        frame.putmsg("\1h\1k" + hLine(78) + "\1n");
        
        // Then render QF+ with offset
        renderBracket8Offset(frame, quarters, semis, finals, playerId, 4);
    }
    
    /**
     * Render 8-team bracket portion with Y offset
     */
    function renderBracket8Offset(frame, quarters, semis, finals, playerId, yOff) {
        var L1 = 1, L2 = 17, R2 = 49, R1 = 65, MID = 33;
        
        // Condensed: 2 rows per matchup instead of 4
        // QF1 at yOff+1, QF2 at yOff+4
        if (quarters.length >= 1) {
            var q = quarters[0];
            frame.gotoxy(L1, yOff + 1);
            frame.putmsg(getPlayerDisplay(q.player1, q, playerId, 12) + " " + getPlayerDisplay(q.player2, q, playerId, 12));
            frame.gotoxy(L1, yOff + 2);
            frame.putmsg("\1h\1k" + hLine(12) + BOX.TT + hLine(12) + BOX.TR + "\1n");
            frame.gotoxy(L2 + 10, yOff + 2);
            frame.putmsg(getPlayerDisplay(q.winner, q, playerId, 10));
        }
        
        if (quarters.length >= 2) {
            var q = quarters[1];
            frame.gotoxy(L1, yOff + 5);
            frame.putmsg(getPlayerDisplay(q.player1, q, playerId, 12) + " " + getPlayerDisplay(q.player2, q, playerId, 12));
            frame.gotoxy(L1, yOff + 6);
            frame.putmsg("\1h\1k" + hLine(12) + BOX.BT + hLine(12) + BOX.BR + "\1n");
            frame.gotoxy(L2 + 10, yOff + 6);
            frame.putmsg(getPlayerDisplay(q.winner, q, playerId, 10));
        }
        
        // Vertical to SF
        for (var r = yOff + 3; r <= yOff + 5; r++) {
            frame.gotoxy(L2 + 20, r);
            frame.putmsg("\1h\1k" + BOX.V + "\1n");
        }
        
        if (semis.length >= 1) {
            var s = semis[0];
            frame.gotoxy(L2 + 21, yOff + 4);
            frame.putmsg(getPlayerDisplay(s.winner, s, playerId, 10));
        }
        
        // Right side (mirrored)
        if (quarters.length >= 3) {
            var q = quarters[2];
            frame.gotoxy(R1 - 12, yOff + 1);
            frame.putmsg(getPlayerDisplay(q.player1, q, playerId, 12) + " " + getPlayerDisplay(q.player2, q, playerId, 12));
            frame.gotoxy(R1 - 14, yOff + 2);
            frame.putmsg("\1h\1k" + BOX.TL + hLine(12) + BOX.TT + hLine(12) + "\1n");
            frame.gotoxy(R2 - 4, yOff + 2);
            frame.putmsg(getPlayerDisplay(q.winner, q, playerId, 10));
        }
        
        if (quarters.length >= 4) {
            var q = quarters[3];
            frame.gotoxy(R1 - 12, yOff + 5);
            frame.putmsg(getPlayerDisplay(q.player1, q, playerId, 12) + " " + getPlayerDisplay(q.player2, q, playerId, 12));
            frame.gotoxy(R1 - 14, yOff + 6);
            frame.putmsg("\1h\1k" + BOX.BL + hLine(12) + BOX.BT + hLine(12) + "\1n");
            frame.gotoxy(R2 - 4, yOff + 6);
            frame.putmsg(getPlayerDisplay(q.winner, q, playerId, 10));
        }
        
        for (var r = yOff + 3; r <= yOff + 5; r++) {
            frame.gotoxy(R2 - 5, r);
            frame.putmsg("\1h\1k" + BOX.V + "\1n");
        }
        
        if (semis.length >= 2) {
            var s = semis[1];
            frame.gotoxy(R2 - 15, yOff + 4);
            frame.putmsg(getPlayerDisplay(s.winner, s, playerId, 10));
        }
        
        // Finals
        frame.gotoxy(MID - 3, yOff + 8);
        frame.putmsg("\1h\1y\xDB FINALS \xDB\1n");
        
        if (finals.length >= 1) {
            var f = finals[0];
            if (f.status === "completed" && f.winner) {
                frame.gotoxy(MID - 3, yOff + 10);
                frame.putmsg("\1h\1g" + f.winner.name + " WINS!\1n");
            } else {
                var n1 = f.player1 ? f.player1.name : "TBD";
                var n2 = f.player2 ? f.player2.name : "TBD";
                frame.gotoxy(MID - 6, yOff + 10);
                frame.putmsg("\1w" + n1 + " vs " + n2 + "\1n");
            }
        }
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
        console.getkey(K_NOSPIN);
    }
    
    // ========== PLAYER STATUS ==========
    
    /**
     * Show the player's playoff status
     * @param {Object} ctx - Player context
     * @param {number|null} selectedSeason - Specific season to show, or null for primary
     */
    function showPlayerStatus(ctx, selectedSeason) {
        if (!LORB.Playoffs) {
            logPlayoffUI("showStatus", "error", "playoffs_module_missing");
            return null;
        }
        
        var playerId = ctx._globalId || ctx.name;
        logPlayoffUI("showStatus", "start", "playerId=" + playerId + " selectedSeason=" + selectedSeason);
        var fullStatus = LORB.Playoffs.getPlayerPlayoffStatus(playerId);
        
        // If a specific season is selected and player is in multiple brackets,
        // build a status object focused on that bracket
        var status = fullStatus;
        if (selectedSeason && fullStatus.playerBrackets && fullStatus.playerBrackets.length > 1) {
            status = buildStatusForSeason(fullStatus, selectedSeason, playerId);
        }
        
        logPlayoffUI("showStatus", "status", "inPlayoffs=" + status.inPlayoffs + 
            " hasPending=" + status.hasPendingMatch + 
            " eliminated=" + status.eliminated +
            " pendingCount=" + (status.pendingMatches ? status.pendingMatches.length : 0) +
            " activeBrackets=" + (fullStatus.playerBrackets ? fullStatus.playerBrackets.length : 0));
        
        if (RichView) {
            return showPlayerStatusRichView(status, ctx, playerId, fullStatus.playerBrackets);
        } else {
            return showPlayerStatusLegacy(status, ctx);
        }
    }
    
    /**
     * Build a status object focused on a specific season's bracket
     */
    function buildStatusForSeason(fullStatus, seasonNumber, playerId) {
        // Find the bracket info for this season
        var bracketInfo = null;
        for (var i = 0; i < fullStatus.playerBrackets.length; i++) {
            if (fullStatus.playerBrackets[i].seasonNumber === seasonNumber) {
                bracketInfo = fullStatus.playerBrackets[i];
                break;
            }
        }
        
        if (!bracketInfo) {
            return fullStatus;  // Fall back to primary
        }
        
        // Load the actual bracket to get pending matches for this season
        var bracket = LORB.Playoffs.loadBracket ? LORB.Playoffs.loadBracket(seasonNumber) : null;
        var pendingMatches = [];
        
        if (bracket && LORB.Playoffs.getPlayerPendingMatches) {
            var allPending = LORB.Playoffs.getPlayerPendingMatches(playerId);
            for (var j = 0; j < allPending.length; j++) {
                if (allPending[j]._bracketSeasonNumber === seasonNumber) {
                    pendingMatches.push(allPending[j]);
                }
            }
        }
        
        return {
            inPlayoffs: true,
            seasonNumber: seasonNumber,
            currentRound: bracketInfo.currentRound,
            eliminated: bracketInfo.eliminated,
            champion: bracketInfo.champion,
            pendingMatches: pendingMatches,
            hasPendingMatch: pendingMatches.length > 0,
            activeBracketCount: fullStatus.activeBracketCount,
            playerBrackets: fullStatus.playerBrackets,
            championships: fullStatus.championships
        };
    }

    function showPlayerStatusRichView(status, ctx, playerId, allBrackets) {
        // Determine art key based on status
        var artKey = "not_qualified";
        var oppOnline = false;
        var isPastDeadline = false;
        var myPlayerId = playerId || ctx._globalId || ctx.name;
        var oppId = null;
        var oppName = null;
        
        if (status.champion) {
            artKey = "champion";
        } else if (status.eliminated) {
            artKey = "eliminated";
        } else if (status.inPlayoffs) {
            if (status.hasPendingMatch && status.pendingMatches[0]) {
                var pending = status.pendingMatches[0];
                oppId = pending.player1.playerId === myPlayerId 
                    ? pending.player2.playerId 
                    : pending.player1.playerId;
                oppName = pending.player1.playerId === myPlayerId
                    ? pending.player2.name
                    : pending.player1.name;
                
                if (LORB.Persist && LORB.Persist.isPlayerOnline) {
                    oppOnline = LORB.Persist.isPlayerOnline(oppId);
                }
                isPastDeadline = LORB.Playoffs && LORB.Playoffs.isMatchPastSoftDeadline 
                    ? LORB.Playoffs.isMatchPastSoftDeadline(pending) : false;
                
                if (oppOnline) {
                    artKey = "pvp_ready";
                } else if (isPastDeadline) {
                    artKey = "ghost_match";
                } else {
                    artKey = "waiting_opponent";
                }
            } else {
                artKey = "waiting_round";
            }
        }
        
        // Create RichView with zones - content/lightbar on left, trophy art on right
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "content", x: 1, y: 5, width: 40, height: 20 },
                { name: "art", x: 41, y: 5, width: 40, height: 20 }
            ]
        });
        
        view.setContentZone("content");
        
        // Build figlet header text - omit season number since not all fonts have numerics
        // Season info is shown in the content panel instead
        var figletText = "Playoffs";
        if (status.champion) {
            figletText = "Champion";
        } else if (status.eliminated) {
            figletText = "Eliminated";
        } else if (status.currentRound) {
            // Convert round name to display text (currentRound is a string like "finals", "semifinals")
            figletText = formatRoundForFiglet(status.currentRound);
        }
        
        // Render figlet to header zone
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            loadPlayoffFigletHeader(headerFrame, figletText);
        }
        
        // Draw art in art zone using getZone() API
        var artFrame = view.getZone("art");
        if (artFrame) {
            drawPlayoffArt(artFrame, artKey, status.seasonNumber);
        }
        
        // Content based on status
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
            console.getkey(K_NOSPIN);
            view.close();
            return null;
        }

        if (status.champion) {
            view.line("\1y\1h*** CHAMPION! ***\1n");
            view.blank();
        } else if (status.eliminated) {
            view.line("\1rEliminated.\1n");
            view.line("Better luck next season!");
            view.blank();
        } else if (status.hasPendingMatch) {
            view.line("\1yMatch waiting!\1n");
            view.line("Opponent: \1w" + (oppName || "Unknown") + "\1n");
            
            if (oppOnline) {
                view.line("\1g* Online\1n - PvP available");
            } else if (isPastDeadline) {
                view.line("\1r* PAST DEADLINE\1n");
            } else {
                view.line("\1yo Offline\1n - Waiting");
            }
            view.blank();
        }
        
        // Menu options
        var menuItems = [];
        
        if (status.hasPendingMatch && !status.eliminated && !status.champion) {
            // Show appropriate menu option based on status
            if (oppOnline) {
                menuItems.push({ text: "Challenge to PvP Match", value: "play", hotkey: "P" });
            } else if (isPastDeadline) {
                menuItems.push({ text: "\1yPlay Ghost Match (vs AI)\1n", value: "play", hotkey: "P" });
            } else {
                menuItems.push({ text: "Play Playoff Match", value: "play", hotkey: "P" });
            }
        }
        
        // Check if there are other matches past soft deadline that this player can force-sim
        // (player has completed their match in the same round and is waiting)
        if (!status.eliminated && !status.champion && !status.hasPendingMatch && LORB.Playoffs) {
            var matchesPastDeadline = LORB.Playoffs.getMatchesPastSoftDeadline();
            var canForceSimAny = false;
            
            for (var i = 0; i < matchesPastDeadline.length; i++) {
                if (LORB.Playoffs.canPlayerForceSimMatch(myPlayerId, matchesPastDeadline[i])) {
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
        
        // Champion Red Bull Challenge option - check both current bracket and completed championships
        var hasChampionshipChallenge = false;
        
        // First check the primary bracket (if champion there)
        if (status.champion && LORB.Playoffs && LORB.Playoffs.canChampionChallenge) {
            var challengeState = LORB.Playoffs.getChampionChallengeState(status.seasonNumber, myPlayerId);
            if (challengeState.redBullDefeated) {
                // Already beaten - show victory marker
                view.line("\1h\1r* \1gYou have conquered the Red Bull! \1r*\1n");
                view.blank();
            } else if (challengeState.triesRemaining > 0) {
                // Can still challenge
                var triesText = "(" + challengeState.triesRemaining + " " + 
                    (challengeState.triesRemaining === 1 ? "try" : "tries") + ")";
                menuItems.push({ 
                    text: "\1h\1rS" + status.seasonNumber + " Champions Challenge\1n \1w" + triesText + "\1n", 
                    value: "red_bull_challenge", 
                    hotkey: "R" 
                });
                hasChampionshipChallenge = true;
            } else {
                // No tries left
                view.line("\1h\1kNo challenge attempts remaining.\1n");
                view.blank();
            }
        }
        
        // Also check for championships in COMPLETED brackets (the key fix!)
        if (!hasChampionshipChallenge && status.championships && status.championships.length > 0) {
            for (var c = 0; c < status.championships.length; c++) {
                var champ = status.championships[c];
                view.line("\1y\1h*** Season " + champ.seasonNumber + " Champion! ***\1n");
                
                if (champ.challengeState.redBullDefeated) {
                    view.line("\1h\1r* \1gYou conquered the Red Bull! \1r*\1n");
                } else if (champ.challengeState.triesRemaining > 0) {
                    var triesTextC = "(" + champ.challengeState.triesRemaining + " " + 
                        (champ.challengeState.triesRemaining === 1 ? "try" : "tries") + ")";
                    menuItems.push({ 
                        text: "\1h\1rS" + champ.seasonNumber + " Champions Challenge\1n \1w" + triesTextC + "\1n", 
                        value: "red_bull_challenge_" + champ.seasonNumber, 
                        hotkey: "R" 
                    });
                    hasChampionshipChallenge = true;
                    break;  // Only show one championship challenge at a time
                }
                view.blank();
            }
        }
        
        // Availability settings - show for active playoff participants
        if (status.inPlayoffs && !status.eliminated && !status.champion) {
            menuItems.push({ text: "Set Availability", value: "availability", hotkey: "A" });
        }
        
        menuItems.push({ text: "View Full Bracket", value: "bracket", hotkey: "B" });
        
        // Multi-bracket navigation - show switch option if player is in multiple brackets
        if (allBrackets && allBrackets.length > 1) {
            // Build submenu for bracket switching
            for (var bi = 0; bi < allBrackets.length; bi++) {
                var b = allBrackets[bi];
                if (b.seasonNumber === status.seasonNumber) continue;  // Skip current
                
                var bracketStatus = b.eliminated ? "\1r(Eliminated)\1n" : 
                                   b.champion ? "\1g(Champion!)\1n" : 
                                   "\1y(" + formatRoundName(b.currentRound || "Active") + ")\1n";
                menuItems.push({
                    text: "\1wSeason " + b.seasonNumber + "\1n " + bracketStatus,
                    value: "switch_season_" + b.seasonNumber,
                    hotkey: String(bi + 1)
                });
            }
        }
        
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
            console.getkey(K_NOSPIN);
            return null;
        }
        
        LORB.View.line("Season " + status.seasonNumber + " Playoffs");
        LORB.View.line("");
        
        var playerId = ctx._globalId || ctx.name;
        var canChallenge = false;
        var challengeState = null;
        var championshipSeasonNumber = null;
        
        if (status.champion) {
            LORB.View.line("*** YOU ARE THE CHAMPION! ***");
            
            // Check for Red Bull challenge
            if (LORB.Playoffs && LORB.Playoffs.canChampionChallenge) {
                canChallenge = LORB.Playoffs.canChampionChallenge(status.seasonNumber, playerId);
                challengeState = LORB.Playoffs.getChampionChallengeState(status.seasonNumber, playerId);
                championshipSeasonNumber = status.seasonNumber;
                
                LORB.View.line("");
                if (challengeState.redBullDefeated) {
                    LORB.View.line("* You have conquered the Red Bull! *");
                } else if (canChallenge) {
                    LORB.View.line("[R] Challenge the Red Bull (" + challengeState.triesRemaining + " tries)");
                } else {
                    LORB.View.line("No challenge attempts remaining.");
                }
            }
        } else if (status.eliminated) {
            LORB.View.line("You have been eliminated.");
        } else {
            LORB.View.line("You are still in the tournament.");
            if (status.hasPendingMatch) {
                LORB.View.line("");
                LORB.View.line("[P] Play Playoff Match");
            }
        }
        
        // Also check for championships in COMPLETED brackets
        if (!canChallenge && status.championships && status.championships.length > 0) {
            for (var c = 0; c < status.championships.length; c++) {
                var champ = status.championships[c];
                LORB.View.line("");
                LORB.View.line("*** Season " + champ.seasonNumber + " Champion! ***");
                
                if (champ.challengeState.redBullDefeated) {
                    LORB.View.line("* You conquered the Red Bull! *");
                } else if (champ.challengeState.triesRemaining > 0) {
                    LORB.View.line("[R] Challenge the Red Bull (" + champ.challengeState.triesRemaining + " tries)");
                    canChallenge = true;
                    championshipSeasonNumber = champ.seasonNumber;
                    break;  // Only show one
                }
            }
        }
        
        LORB.View.line("[B] View Bracket");
        LORB.View.line("[Q] Back");
        LORB.View.line("");
        
        var key = LORB.View.prompt("Choice: ").toUpperCase();
        
        switch (key) {
            case "P": return "play";
            case "B": return "bracket";
            case "R": 
                if (canChallenge) {
                    // If it's from a completed bracket, return season-specific action
                    if (championshipSeasonNumber && championshipSeasonNumber !== status.seasonNumber) {
                        return "red_bull_challenge_" + championshipSeasonNumber;
                    }
                    return "red_bull_challenge";
                }
                return "back";
            default: return "back";
        }
    }
    
    // ========== PLAYOFF MATCH FLOW ==========
    
    /**
     * Start a playoff match for the player
     * Uses their Season N snapshot, not current Season N+1 build
     * @param {Object} ctx - Player context
     * @param {number} [selectedSeason] - Optional: season number to play match for (if user has multiple brackets)
     */
    function playPlayoffMatch(ctx, selectedSeason) {
        if (!LORB.Playoffs) {
            logPlayoffUI("playMatch", "error", "playoffs_module_missing");
            return null;
        }
        
        var playerId = ctx._globalId || ctx.name;
        var allPending = LORB.Playoffs.getPlayerPendingMatches(playerId);
        
        if (!allPending || allPending.length === 0) {
            showNoMatchAvailable();
            return null;
        }
        
        // Filter to selected season if specified
        var pending = allPending;
        if (selectedSeason) {
            pending = [];
            for (var i = 0; i < allPending.length; i++) {
                if (allPending[i]._bracketSeasonNumber === selectedSeason) {
                    pending.push(allPending[i]);
                }
            }
            if (pending.length === 0) {
                logPlayoffUI("playMatch", "no_match_for_season", "season=" + selectedSeason);
                showNoMatchAvailable();
                return null;
            }
        }
        
        // pending[0] is the oldest pending match (from selected/all brackets)
        var match = pending[0];
        
        // Get the correct bracket for this match (may not be the "primary" active bracket)
        var bracketSeasonNumber = match._bracketSeasonNumber;
        var bracket = bracketSeasonNumber 
            ? LORB.Playoffs.loadBracket(bracketSeasonNumber)
            : LORB.Playoffs.getActiveBracketForPlayer(playerId);
        
        if (!bracket) {
            bracket = LORB.Playoffs.getActiveBracket();
        }
        
        if (!bracket) {
            showNoMatchAvailable();
            return null;
        }
        
        logPlayoffUI("playMatch", "bracket", "season=" + bracket.seasonNumber);
        
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
        logPlayoffUI("playMatch", "confirm", "confirmed=" + confirm);
        if (!confirm) {
            logPlayoffUI("playMatch", "cancelled", "user_cancelled");
            return null;
        }
        
        // Determine resolution mode and run match
        var result = null;
        
        logPlayoffUI("playMatch", "mode", "oppOnline=" + oppOnline);
        
        if (oppOnline) {
            // PvP playoff match - use challenge system
            result = runPvpPlayoffMatch(bracket, match, mySnapshot, oppSnapshot, opponent, ctx);
        }
        
        // If PvP failed/declined or opponent offline, use ghost match
        if (!result) {
            logPlayoffUI("playMatch", "ghost", "running ghost match");
            var resolution = LORB.Playoffs.RESOLUTION.GHOST;
            result = runPlayoffMatch(bracket, match, mySnapshot, oppSnapshot, resolution, ctx);
            logPlayoffUI("playMatch", "ghost_result", "result=" + (result ? "ok" : "null"));
        }
        
        if (result) {
            showMatchResult(result, match);
        } else {
            logPlayoffUI("playMatch", "no_result", "match returned null");
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
    
    // ========== CHAMPION RED BULL CHALLENGE ==========
    
    /**
     * Launch the Champion's Red Bull Challenge (Jordan + Red Bull)
     * 
     * Flow:
     * 1. Show Jordan intro with rich view art
     * 2. Play Jordan match (using jordan difficulty)
     * 3. If lose: Show Jordan trash talk, use one try
     * 4. If win: Show Jordan reaction, proceed to Red Bull
     * 5. Show Red Bull intro with "CHALLENGER!" figlet
     * 6. Play Red Bull match (using red_bull difficulty)
     * 7. Record result (win or lose)
     */
    function launchChampionChallenge(ctx) {
        if (!LORB.Playoffs) {
            logPlayoffUI("championChallenge", "error", "playoffs_module_missing");
            return null;
        }
        
        var playerId = ctx._globalId || ctx.name;
        
        // Get the status to find which bracket they're champion of
        var status = LORB.Playoffs.getPlayerPlayoffStatus(playerId);
        if (!status.champion) {
            logPlayoffUI("championChallenge", "error", "not_champion");
            return null;
        }
        
        var seasonNumber = status.seasonNumber;
        
        // Check if they can still challenge
        if (!LORB.Playoffs.canChampionChallenge(seasonNumber, playerId)) {
            showNoTriesRemaining();
            return null;
        }
        
        var challengeState = LORB.Playoffs.getChampionChallengeState(seasonNumber, playerId);
        
        logPlayoffUI("championChallenge", "start", "season=" + seasonNumber + 
            " triesUsed=" + challengeState.triesUsed + " jordanDefeated=" + challengeState.jordanDefeated);
        
        // ===== JORDAN MATCH =====
        var jordanResult = runJordanMatch(ctx, seasonNumber);
        
        if (!jordanResult || jordanResult.quit) {
            // User quit - don't count as a try
            logPlayoffUI("championChallenge", "quit", "jordan_match_quit");
            return null;
        }
        
        if (!jordanResult.won) {
            // Lost to Jordan - record try and show trash talk
            LORB.Playoffs.recordChallengeAttempt(seasonNumber, playerId, {
                beatJordan: false,
                beatRedBull: false
            });
            showJordanTrashTalk(ctx);
            logPlayoffUI("championChallenge", "jordan_loss", "recorded attempt");
            return { phase: "jordan", won: false };
        }
        
        // Beat Jordan! Show victory reaction
        showJordanDefeat(ctx);
        
        logPlayoffUI("championChallenge", "jordan_victory", "proceeding to red bull");
        
        // ===== RED BULL MATCH =====
        var redBullResult = runRedBullMatch(ctx, seasonNumber);
        
        if (!redBullResult || redBullResult.quit) {
            // Quit Red Bull match - still record Jordan victory
            LORB.Playoffs.recordChallengeAttempt(seasonNumber, playerId, {
                beatJordan: true,
                beatRedBull: false
            });
            logPlayoffUI("championChallenge", "quit", "red_bull_match_quit");
            return { phase: "red_bull", won: false, beatJordan: true };
        }
        
        // Record the full attempt
        LORB.Playoffs.recordChallengeAttempt(seasonNumber, playerId, {
            beatJordan: true,
            beatRedBull: redBullResult.won
        });
        
        if (redBullResult.won) {
            // ULTIMATE VICTORY!
            showRedBullVictory(ctx, seasonNumber);
            updateHallOfFameDefeatedJordan(seasonNumber, playerId);
            logPlayoffUI("championChallenge", "red_bull_victory", "LEGENDARY!");
        } else {
            // Lost to Red Bull
            showRedBullDefeat(ctx);
            postRedBullLossNews(playerId, seasonNumber, redBullResult.score);
            logPlayoffUI("championChallenge", "red_bull_loss", "recorded attempt");
        }
        
        return {
            phase: "red_bull",
            beatJordan: true,
            won: redBullResult.won
        };
    }
    
    /**
     * Launch the Champion's Red Bull Challenge for a specific completed season.
     * Used when the player has championships from completed brackets.
     * 
     * @param {Object} ctx - Player context
     * @param {number} seasonNumber - The season number of the championship
     */
    function launchChampionChallengeForSeason(ctx, seasonNumber) {
        if (!LORB.Playoffs) {
            logPlayoffUI("championChallengeForSeason", "error", "playoffs_module_missing");
            return null;
        }
        
        var playerId = ctx._globalId || ctx.name;
        
        // Verify they are the champion for this specific season
        if (!LORB.Playoffs.canChampionChallenge(seasonNumber, playerId)) {
            showNoTriesRemaining();
            return null;
        }
        
        var challengeState = LORB.Playoffs.getChampionChallengeState(seasonNumber, playerId);
        
        logPlayoffUI("championChallengeForSeason", "start", "season=" + seasonNumber + 
            " triesUsed=" + challengeState.triesUsed + " jordanDefeated=" + challengeState.jordanDefeated);
        
        // ===== JORDAN MATCH =====
        var jordanResult = runJordanMatch(ctx, seasonNumber);
        
        if (!jordanResult || jordanResult.quit) {
            logPlayoffUI("championChallengeForSeason", "quit", "jordan_match_quit");
            return null;
        }
        
        if (!jordanResult.won) {
            LORB.Playoffs.recordChallengeAttempt(seasonNumber, playerId, {
                beatJordan: false,
                beatRedBull: false
            });
            showJordanTrashTalk(ctx);
            logPlayoffUI("championChallengeForSeason", "jordan_loss", "recorded attempt");
            return { phase: "jordan", won: false };
        }
        
        showJordanDefeat(ctx);
        logPlayoffUI("championChallengeForSeason", "jordan_victory", "proceeding to red bull");
        
        // ===== RED BULL MATCH =====
        var redBullResult = runRedBullMatch(ctx, seasonNumber);
        
        if (!redBullResult || redBullResult.quit) {
            LORB.Playoffs.recordChallengeAttempt(seasonNumber, playerId, {
                beatJordan: true,
                beatRedBull: false
            });
            logPlayoffUI("championChallengeForSeason", "quit", "red_bull_match_quit");
            return { phase: "red_bull", won: false, beatJordan: true };
        }
        
        LORB.Playoffs.recordChallengeAttempt(seasonNumber, playerId, {
            beatJordan: true,
            beatRedBull: redBullResult.won
        });
        
        if (redBullResult.won) {
            showRedBullVictory(ctx, seasonNumber);
            updateHallOfFameDefeatedJordan(seasonNumber, playerId);
            logPlayoffUI("championChallengeForSeason", "red_bull_victory", "LEGENDARY!");
        } else {
            showRedBullDefeat(ctx);
            postRedBullLossNews(playerId, seasonNumber, redBullResult.score);
            logPlayoffUI("championChallengeForSeason", "red_bull_loss", "recorded attempt");
        }
        
        return {
            phase: "red_bull",
            beatJordan: true,
            won: redBullResult.won
        };
    }
    
    function confirmChallengeStart(seasonNumber, challengeState) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("CHAMPIONS CHALLENGE");
            LORB.View.line("");
            LORB.View.line("Season " + seasonNumber + " Champion");
            LORB.View.line("");
            LORB.View.line("Attempts remaining: " + challengeState.triesRemaining);
            LORB.View.line("");
            LORB.View.line("Are you ready to face the gauntlet?");
            LORB.View.line("");
            var choice = LORB.View.prompt("Begin? (Y/N): ").toUpperCase();
            return choice === "Y";
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "content", x: 1, y: 5, width: 80, height: 20 }
            ]
        });
        
        view.setContentZone("content");
        view.header("CHAMPIONS CHALLENGE");
        
        view.blank();
        view.line("\1cSeason " + seasonNumber + " Champion\1n");
        view.blank();
        view.line("\1wAttempts remaining: \1h\1y" + challengeState.triesRemaining + "\1n");
        view.blank();
        view.line("\1wAre you ready to face the gauntlet?\1n");
        view.blank();
        
        var choice = view.menu([
            { text: "\1h\1yBring it on\1n", value: "start", hotkey: "Y" },
            { text: "Not yet", value: "cancel", hotkey: "N" }
        ]);
        
        view.close();
        return choice === "start";
    }
    
    function showNoTriesRemaining() {
        if (!RichView) {
            LORB.View.warn("You have no challenge attempts remaining for this season.");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var view = new RichView({ theme: "lorb" });
        view.setContentZone("content");
        view.line("\1rYou have used all your challenge attempts.\1n");
        view.blank();
        view.line("\1wWin another championship to challenge again!\1n");
        view.blank();
        view.line("\1h\1kPress any key...\1n");
        view.render();
        console.getkey(K_NOSPIN);
        view.close();
    }
    
    /**
     * Run the Jordan match with rich view intro
     */
    function runJordanMatch(ctx, seasonNumber) {
        // Show Jordan intro screen with art
        showJordanIntro(ctx);
        
        // Use the RedBullChallenge module if available
        if (LORB.Locations && LORB.Locations.RedBullChallenge && LORB.Locations.RedBullChallenge.launchJordanChallenge) {
            var result = LORB.Locations.RedBullChallenge.launchJordanChallenge(ctx, { skipIntro: true, skipOutro: true });
            return result;
        }
        
        // Fallback: simulate the match
        logPlayoffUI("jordanMatch", "fallback", "using simulation");
        return simulateBossMatch("jordan");
    }
    
    /**
     * Run the Red Bull match with rich view intro
     */
    function runRedBullMatch(ctx, seasonNumber) {
        // Show Red Bull intro screen with CHALLENGER! figlet
        showRedBullIntro(ctx);
        
        // Use the RedBullChallenge module if available
        if (LORB.Locations && LORB.Locations.RedBullChallenge && LORB.Locations.RedBullChallenge.launchRedBullChallenge) {
            var result = LORB.Locations.RedBullChallenge.launchRedBullChallenge(ctx, { skipIntro: true, skipOutro: true });
            return result;
        }
        
        // Fallback: simulate the match
        logPlayoffUI("redBullMatch", "fallback", "using simulation");
        return simulateBossMatch("red_bull");
    }
    
    function simulateBossMatch(bossType) {
        // Simple fallback simulation
        var difficulty = bossType === "red_bull" ? 2.0 : 1.5;
        var winChance = Math.max(0.1, 0.5 - (difficulty * 0.15));
        var won = Math.random() < winChance;
        
        return {
            completed: true,
            won: won,
            quit: false
        };
    }
    
    /**
     * Show Jordan intro with character art
     */
    function showJordanIntro(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("VS MICHAEL JORDAN");
            LORB.View.line("");
            LORB.View.line("His Airness awaits.");
            LORB.View.line("Six rings. Ten scoring titles. Legend incarnate.");
            LORB.View.line("");
            LORB.View.line("Press any key to begin...");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art_left", x: 1, y: 5, width: 40, height: 20 },
                { name: "art_right", x: 41, y: 5, width: 40, height: 20 }
            ]
        });
        
        // Draw Jordan on left, Pippen on right
        var leftZone = view.getZone("art_left");
        var rightZone = view.getZone("art_right");
        
        if (leftZone) {
            drawBossArt(leftZone, "michael_jordan");
        }
        if (rightZone) {
            drawBossArt(rightZone, "scottie_pippen");
        }
        
        // Header - red figlet style
        var headerZone = view.getZone("header");
        if (headerZone) {
            headerZone.clear();
            headerZone.gotoxy(1, 1);
            headerZone.putmsg("\1h\1r   __ __  ____    _  ___  ___   ___   ___   _  __\r\n");
            headerZone.putmsg("\1h\1r  / // / / __/   | |/ / / / /  / _ | / _ \\ | |/ /\r\n");
            headerZone.putmsg("\1h\1r / _  / _\\ \\    | _ / /_/ /  / __ |/  __/ |   / \r\n");
            headerZone.putmsg("\1h\1r/_//_/ /___/   |_/_/\\____/  /_/ |_/_/ \\_\\|_|\\_\\ \r\n");
        }
        
        view.render();
        mswait(1500);
        console.getkey(K_NOSPIN);
        view.close();
    }
    
    /**
     * Show Red Bull intro with CHALLENGER! figlet banner
     */
    function showRedBullIntro(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("VS THE RED BULL");
            LORB.View.line("");
            LORB.View.line("The court grows cold.");
            LORB.View.line("Flames lick the baseline.");
            LORB.View.line("The GOAT awaits...");
            LORB.View.line("");
            LORB.View.line("Press any key to begin...");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art_left", x: 1, y: 5, width: 40, height: 20 },
                { name: "art_right", x: 41, y: 5, width: 40, height: 20 }
            ]
        });
        
        // Draw Devil on left, Iceman on right
        var leftZone = view.getZone("art_left");
        var rightZone = view.getZone("art_right");
        
        if (leftZone) {
            drawBossArt(leftZone, "devil", "assets/lorb/bosses/");
        }
        if (rightZone) {
            drawBossArt(rightZone, "iceman", "assets/lorb/bosses/");
        }
        
        // Header - "CHALLENGER!" in red figlet
        var headerZone = view.getZone("header");
        if (headerZone) {
            headerZone.clear();
            headerZone.gotoxy(1, 1);
            headerZone.putmsg("\1h\1r  ___ _  _   _   _    _    ___ _  _  ___ ___ ___ _ \r\n");
            headerZone.putmsg("\1h\1r / __| || | /_\\ | |  | |  | __| \\| |/ __| __| _ \\ |\r\n");
            headerZone.putmsg("\1h\1r| (__| __ |/ _ \\| |__| |__| _|| .` | (_ | _||   /_|\r\n");
            headerZone.putmsg("\1h\1r \\___|_||_/_/ \\_\\____|____|___|_|\\_|\\___|___|_|_(_)\r\n");
        }
        
        view.render();
        mswait(1500);
        console.getkey(K_NOSPIN);
        view.close();
    }
    
    /**
     * Draw boss character art to a frame
     */
    function drawBossArt(frame, characterName, basePath) {
        basePath = basePath || "assets/characters/";
        var artPath = "/sbbs/xtrn/nba_jam/" + basePath + characterName + ".bin";
        
        try {
            if (file_exists(artPath)) {
                var Graphic = load({}, "graphic.js");
                var graphic = new Graphic(40, 20);
                graphic.load(artPath);
                graphic.draw(frame.x, frame.y);
            } else {
                // Fallback text
                frame.gotoxy(1, 10);
                frame.putmsg("\1h\1w  [" + characterName.toUpperCase() + "]\1n");
            }
        } catch (e) {
            logPlayoffUI("drawBossArt", "error", "failed to load " + artPath + ": " + e);
            frame.gotoxy(1, 10);
            frame.putmsg("\1h\1w  [" + characterName.toUpperCase() + "]\1n");
        }
    }
    
    /**
     * Show Jordan trash talk after losing
     */
    function showJordanTrashTalk(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("DEFEATED");
            LORB.View.line("");
            LORB.View.line("Jordan laughs as you walk off the court.");
            LORB.View.line("\"That's why I'm the GOAT, kid.\"");
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 43, y: 5, width: 38, height: 20 }
            ]
        });
        
        view.setContentZone("content");
        view.header("DEFEATED BY JORDAN");
        
        var artZone = view.getZone("art");
        if (artZone) {
            drawBossArt(artZone, "michael_jordan");
        }
        
        view.blank();
        view.line("\1rJordan laughs as you walk off.\1n");
        view.blank();
        view.line("\1w\"That's why I'm the GOAT, kid.\"\1n");
        view.blank();
        view.line("\1w\"Come back when you've got six rings.\"\1n");
        view.blank();
        view.blank();
        view.line("\1h\1kPress any key...\1n");
        view.render();
        console.getkey(K_NOSPIN);
        view.close();
    }
    
    /**
     * Show Jordan's reaction after being beaten
     */
    function showJordanDefeat(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("JORDAN DEFEATED!");
            LORB.View.line("");
            LORB.View.line("Pippen steps forward...");
            LORB.View.line("\"Mike won't speak to the media after this.\"");
            LORB.View.line("");
            LORB.View.line("But darker forces await...");
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 43, y: 5, width: 38, height: 20 }
            ]
        });
        
        view.setContentZone("content");
        view.header("JORDAN DEFEATED!");
        
        var artZone = view.getZone("art");
        if (artZone) {
            drawBossArt(artZone, "scottie_pippen");
        }
        
        view.blank();
        view.line("\1gPippen steps forward...\1n");
        view.blank();
        view.line("\1w\"Mike won't speak to the media\1n");
        view.line("\1wafter this one.\"\1n");
        view.blank();
        view.line("\1rBut darker forces await...\1n");
        view.blank();
        view.blank();
        view.line("\1h\1kPress any key...\1n");
        view.render();
        console.getkey(K_NOSPIN);
        view.close();
    }
    
    /**
     * Show Red Bull victory celebration
     */
    function showRedBullVictory(ctx, seasonNumber) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("LEGENDARY VICTORY!");
            LORB.View.line("");
            LORB.View.line("Hell freezes over.");
            LORB.View.line("The GOAT has been slain.");
            LORB.View.line("");
            LORB.View.line("You are the TRUE champion of Rim City!");
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "content", x: 1, y: 5, width: 80, height: 20 }
            ]
        });
        
        view.setContentZone("content");
        
        // Golden header
        var headerZone = view.getZone("header");
        if (headerZone) {
            headerZone.clear();
            headerZone.gotoxy(1, 1);
            headerZone.putmsg("\1h\1y _    ___ ___ ___ _  _ ___    _   _____   __\r\n");
            headerZone.putmsg("\1h\1y| |  | __/ __| __| \\| |   \\  /_\\ | _ \\ \\ / /\r\n");
            headerZone.putmsg("\1h\1y| |__| _| (_ | _|| .` | |) |/ _ \\|   /\\ V / \r\n");
            headerZone.putmsg("\1h\1y|____|___\\___|___|_|\\_|___//_/ \\_\\_|_\\ |_|  \r\n");
        }
        
        view.blank();
        view.blank();
        view.line("\1h\1y           * * *  HELL FREEZES OVER  * * *\1n");
        view.blank();
        view.line("\1h\1r           The GOAT has been slain!\1n");
        view.blank();
        view.line("\1h\1g    You are the TRUE champion of Rim City!\1n");
        view.blank();
        view.line("\1cSeason " + seasonNumber + " will remember your legend.\1n");
        view.blank();
        view.blank();
        view.line("\1h\1y    Your name now glows in the Hall of Fame!\1n");
        view.blank();
        view.line("\1h\1kPress any key...\1n");
        view.render();
        console.getkey(K_NOSPIN);
        view.close();
    }
    
    /**
     * Show Red Bull defeat
     */
    function showRedBullDefeat(ctx) {
        if (!RichView) {
            LORB.View.clear();
            LORB.View.header("DEFEATED");
            LORB.View.line("");
            LORB.View.line("Satan laughs as Iceman shatters your hopes.");
            LORB.View.line("The GOAT remains supreme.");
            LORB.View.line("");
            LORB.View.line("Press any key...");
            console.getkey(K_NOSPIN);
            return;
        }
        
        var view = new RichView({
            theme: "lorb",
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 43, y: 5, width: 38, height: 20 }
            ]
        });
        
        view.setContentZone("content");
        view.header("DEFEATED BY THE RED BULL");
        
        var artZone = view.getZone("art");
        if (artZone) {
            drawBossArt(artZone, "devil", "assets/lorb/bosses/");
        }
        
        view.blank();
        view.line("\1rSatan laughs as Iceman\1n");
        view.line("\1rshatters your hopes.\1n");
        view.blank();
        view.line("\1wThe GOAT remains supreme.\1n");
        view.blank();
        view.line("\1yMaybe next time, mortal...\1n");
        view.blank();
        view.blank();
        view.line("\1h\1kPress any key...\1n");
        view.render();
        console.getkey(K_NOSPIN);
        view.close();
    }
    
    /**
     * Update Hall of Fame to show Jordan/Red Bull victory
     * Also handles:
     * - Incrementing player's redBullDefeats counter
     * - Unlocking rewards (Barney skin on first defeat)
     * - Posting news to community feed
     */
    function updateHallOfFameDefeatedJordan(seasonNumber, playerId) {
        // Update the hallOfFame entry for this season to set defeatedJordan = true
        if (!LORB.SharedState) return;
        
        try {
            var state = LORB.SharedState.get();
            if (!state || !state.hallOfFame) return;
            
            for (var i = 0; i < state.hallOfFame.length; i++) {
                var entry = state.hallOfFame[i];
                if (entry.seasonNumber === seasonNumber && entry.championId === playerId) {
                    entry.defeatedJordan = true;
                    entry.defeatedRedBull = true;
                    entry.redBullVictoryDate = new Date().toISOString();
                    break;
                }
            }
            
            LORB.SharedState.save();
            logPlayoffUI("updateHallOfFame", "ok", "season=" + seasonNumber + " playerId=" + playerId);
        } catch (e) {
            logPlayoffUI("updateHallOfFame", "error", e);
        }
        
        // Update player's personal Red Bull defeat count and grant rewards
        grantRedBullVictoryRewards(playerId, seasonNumber);
        
        // Post news to community feed
        postRedBullVictoryNews(playerId, seasonNumber);
    }
    
    /**
     * Grant rewards for defeating the Red Bull
     * - Increment redBullDefeats counter
     * - First defeat: Unlock Barney skin
     * - Future: Additional tier rewards
     */
    function grantRedBullVictoryRewards(playerId, seasonNumber) {
        if (!LORB.Persist) return;
        
        try {
            // Load player data by ID
            var allPlayers = LORB.Persist.listPlayers();
            var playerData = null;
            
            for (var i = 0; i < allPlayers.length; i++) {
                if (allPlayers[i].globalId === playerId || allPlayers[i].name === playerId) {
                    playerData = allPlayers[i];
                    break;
                }
            }
            
            if (!playerData) {
                logPlayoffUI("grantRewards", "warn", "player_not_found=" + playerId);
                return;
            }
            
            // Initialize counters if needed
            if (typeof playerData.redBullDefeats !== "number") {
                playerData.redBullDefeats = 0;
            }
            if (!playerData.championshipWins) {
                playerData.championshipWins = 0;
            }
            if (!playerData.unlockedSkins) {
                playerData.unlockedSkins = [];
            }
            
            // Increment defeat counter
            playerData.redBullDefeats++;
            
            // First defeat: Unlock Barney skin
            if (playerData.redBullDefeats === 1) {
                if (playerData.unlockedSkins.indexOf("barney") === -1) {
                    playerData.unlockedSkins.push("barney");
                    logPlayoffUI("grantRewards", "unlock", "barney_skin for " + playerId);
                }
            }
            
            // Future tier rewards can be added here:
            // if (playerData.redBullDefeats === 3) { unlock another skin }
            // if (playerData.redBullDefeats === 5) { unlock special badge }
            
            // Save via persist writeShared (since we have the data, not ctx)
            var path = "players." + (playerData.globalId || playerId);
            LORB.Persist.writeShared(path, playerData);
            
            logPlayoffUI("grantRewards", "ok", "defeats=" + playerData.redBullDefeats + 
                " skins=" + playerData.unlockedSkins.length);
            
        } catch (e) {
            logPlayoffUI("grantRewards", "error", e);
        }
    }
    
    /**
     * Post news about Red Bull victory to community feed
     */
    function postRedBullVictoryNews(playerId, seasonNumber) {
        // Use PvP stats news system if available
        if (!LORB.Util || !LORB.Util.PvpStats || !LORB.Util.PvpStats.addNews) {
            logPlayoffUI("postNews", "skip", "pvp_stats_unavailable");
            return;
        }
        
        try {
            // Get player name for display
            var playerName = playerId;
            if (LORB.Persist && LORB.Persist.listPlayers) {
                var players = LORB.Persist.listPlayers();
                for (var i = 0; i < players.length; i++) {
                    if (players[i].globalId === playerId || players[i].name === playerId) {
                        playerName = players[i].name || playerId;
                        break;
                    }
                }
            }
            
            var newsEntry = {
                type: "red_bull_defeated",
                timestamp: Date.now(),
                playerName: playerName,
                playerId: playerId,
                seasonNumber: seasonNumber
            };
            
            LORB.Util.PvpStats.addNews(newsEntry);
            logPlayoffUI("postNews", "ok", "season=" + seasonNumber + " player=" + playerName);
            
        } catch (e) {
            logPlayoffUI("postNews", "error", e);
        }
    }
    
    /**
     * Post news about Red Bull loss to community feed (mysterious, just score)
     */
    function postRedBullLossNews(playerId, seasonNumber, score) {
        if (!LORB.Util || !LORB.Util.PvpStats || !LORB.Util.PvpStats.addNews) {
            return;
        }
        
        try {
            // Get player name for display
            var playerName = playerId;
            if (LORB.Persist && LORB.Persist.listPlayers) {
                var players = LORB.Persist.listPlayers();
                for (var i = 0; i < players.length; i++) {
                    if (players[i].globalId === playerId || players[i].name === playerId) {
                        playerName = players[i].name || playerId;
                        break;
                    }
                }
            }
            
            var newsEntry = {
                type: "red_bull_loss",
                timestamp: Date.now(),
                playerName: playerName,
                playerId: playerId,
                seasonNumber: seasonNumber
            };
            
            // Include score if available (without revealing opponent names)
            if (score) {
                newsEntry.playerScore = score.player || score.teamA || 0;
                newsEntry.bossScore = score.boss || score.teamB || 0;
            }
            
            LORB.Util.PvpStats.addNews(newsEntry);
            logPlayoffUI("postLossNews", "ok", "season=" + seasonNumber + " player=" + playerName);
            
        } catch (e) {
            logPlayoffUI("postLossNews", "error", e);
        }
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
            console.getkey(K_NOSPIN);
            view.close();
        } else {
            LORB.View.warn(reason);
            LORB.View.line("Falling back to Ghost Match...");
            console.getkey(K_NOSPIN);
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
            console.getkey(K_NOSPIN);
            view.close();
        } else {
            LORB.View.warn(oppName + " declined the playoff match.");
            LORB.View.line("Falling back to Ghost Match...");
            console.getkey(K_NOSPIN);
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
            console.getkey(K_NOSPIN);
            view.close();
        } else {
            LORB.View.warn(oppName + " did not respond in time.");
            LORB.View.line("Falling back to Ghost Match...");
            console.getkey(K_NOSPIN);
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
            console.getkey(K_NOSPIN);
            view.close();
        } else {
            LORB.View.line("No playoff match available.");
            LORB.View.line("Press any key...");
            console.getkey(K_NOSPIN);
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
            console.getkey(K_NOSPIN);
            view.close();
        } else {
            LORB.View.warn("Error: Could not load your playoff snapshot.");
            LORB.View.line("Press any key...");
            console.getkey(K_NOSPIN);
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
                console.getkey(K_NOSPIN);
                view.close();
            } else {
                LORB.View.line("You advance with a BYE!");
                LORB.View.line("Press any key...");
                console.getkey(K_NOSPIN);
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
        logPlayoffUI("runMatch", "start", "resolution=" + resolution + " matchId=" + match.id);
        
        // Convert snapshots to game player format
        var myPlayer = snapshotToPlayer(mySnapshot, true);
        var oppPlayer = snapshotToPlayer(oppSnapshot || match.player2, false);
        
        logPlayoffUI("runMatch", "players", "me=" + myPlayer.name + " opp=" + oppPlayer.name);
        
        // Get teammate from snapshot
        var myTeammate = getTeammateFromSnapshot(mySnapshot);
        var oppTeammate = getTeammateFromSnapshot(oppSnapshot);
        
        // Build teams
        var teamA = [myPlayer];
        if (myTeammate) teamA.push(myTeammate);
        
        var teamB = [oppPlayer];
        if (oppTeammate) teamB.push(oppTeammate);
        
        logPlayoffUI("runMatch", "teams", "teamA=" + teamA.length + " teamB=" + teamB.length);
        
        // Build player's team colors from their appearance settings
        var playerTeamColors = { fg: "WHITE", bg: "BG_RED", fg_accent: "WHITE", bg_alt: "BG_RED" };
        if (ctx.appearance && ctx.appearance.jerseyColor) {
            playerTeamColors.bg = "BG_" + ctx.appearance.jerseyColor.toUpperCase();
            playerTeamColors.bg_alt = playerTeamColors.bg;
        }
        if (ctx.appearance && ctx.appearance.jerseyLettering) {
            playerTeamColors.fg_accent = ctx.appearance.jerseyLettering.toUpperCase();
        }
        
        // Try to use real game engine
        var hasEngine = (typeof runExternalGame === "function");
        logPlayoffUI("runMatch", "engine_check", "hasEngine=" + hasEngine);
        
        if (hasEngine) {
            try {
                logPlayoffUI("runMatch", "launching", "calling runExternalGame");
                var gameResult = runExternalGame({
                    teamA: {
                        name: mySnapshot.name + "'s Team",
                        players: teamA,
                        colors: playerTeamColors
                    },
                    teamB: {
                        name: (oppSnapshot ? oppSnapshot.name : "Opponent") + "'s Team",
                        players: teamB,
                        colors: { fg: "WHITE", bg: "BG_BLUE", fg_accent: "WHITE", bg_alt: "BG_BLUE" }
                    },
                    options: {
                        mode: "play",
                        humanTeam: "teamA",
                        humanPlayerIndex: 0,
                        gameTime: 120,
                        showMatchupScreen: true,
                        showGameOverScreen: true
                    },
                    lorbContext: {
                        matchType: "playoff",
                        matchId: match.id,
                        resolution: resolution,
                        playerCtx: ctx,
                        hydratedCrew: (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getCrewWithContacts) ? LORB.Util.Contacts.getCrewWithContacts(ctx) : []
                    }
                });
                
                logPlayoffUI("runMatch", "returned", "result=" + JSON.stringify(gameResult ? {
                    winner: gameResult.winner,
                    scoreA: gameResult.score ? gameResult.score.teamA : undefined,
                    scoreB: gameResult.score ? gameResult.score.teamB : undefined,
                    completed: gameResult.completed
                } : null));
                
                if (gameResult && gameResult.completed && gameResult.score) {
                    var iWon = gameResult.score.teamA > gameResult.score.teamB;
                    var winnerId = iWon ? mySnapshot.playerId : (oppSnapshot ? oppSnapshot.playerId : match.player2.playerId);
                    var loserId = iWon ? (oppSnapshot ? oppSnapshot.playerId : match.player2.playerId) : mySnapshot.playerId;
                    
                    logPlayoffUI("runMatch", "finalizing", "winner=" + winnerId + " score=" + 
                        gameResult.score.teamA + "-" + gameResult.score.teamB);
                    
                    // Finalize through standard path
                    return LORB.Playoffs.finalizeMatch(bracket.seasonNumber, match.id, {
                        winnerId: winnerId,
                        loserId: loserId,
                        winnerScore: iWon ? gameResult.score.teamA : gameResult.score.teamB,
                        loserScore: iWon ? gameResult.score.teamB : gameResult.score.teamA,
                        resolution: resolution
                    });
                } else {
                    logPlayoffUI("runMatch", "no_result", "gameResult incomplete or invalid");
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
            console.getkey(K_NOSPIN);
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
            console.getkey(K_NOSPIN);
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
            // Use a muted color - caller can override with city theme if desired
            return "\1n\1bEliminated from Season " + status.seasonNumber + " Playoffs\1n";
        }
        
        if (status.hasPendingMatch) {
            // Check for scheduled time
            var scheduledInfo = "";
            if (LORB.Playoffs.Scheduling && status.pendingMatches && status.pendingMatches[0]) {
                var match = status.pendingMatches[0];
                if (match.scheduling && match.scheduling.scheduledStartUTC) {
                    var timeUntil = match.scheduling.scheduledStartUTC - Date.now();
                    if (timeUntil > 0) {
                        var timeStr = LORB.Playoffs.Scheduling.formatTimeUntil(timeUntil);
                        scheduledInfo = " \1c(in " + timeStr + ")\1n";
                    } else if (LORB.Playoffs.Scheduling.isInGraceWindow(match)) {
                        scheduledInfo = " \1r⚠ NOW!\1n";
                    }
                }
            }
            return "\1y\1hPlayoff Match Ready!" + scheduledInfo + " (Season " + status.seasonNumber + ")\1n";
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
        
        // Track selected season for multi-bracket navigation
        var selectedSeason = null;  // null = use primary bracket
        
        while (true) {
            var choice = showPlayerStatus(ctx, selectedSeason);
            
            switch (choice) {
                case "play":
                    playPlayoffMatch(ctx, selectedSeason);
                    break;
                    
                case "bracket":
                    // Show the bracket for the selected season (or primary if null)
                    var playerId = ctx._globalId || ctx.name;
                    var bracket = null;
                    if (selectedSeason && LORB.Playoffs && LORB.Playoffs.loadBracket) {
                        bracket = LORB.Playoffs.loadBracket(selectedSeason);
                    }
                    if (!bracket) {
                        bracket = LORB.Playoffs ? LORB.Playoffs.getActiveBracketForPlayer(playerId) : null;
                    }
                    if (!bracket) {
                        bracket = LORB.Playoffs ? LORB.Playoffs.getActiveBracket() : null;
                    }
                    showBracket(bracket, ctx);
                    break;
                    
                case "force_sim":
                    forceSimulateStalledMatches(ctx);
                    break;
                    
                case "red_bull_challenge":
                    launchChampionChallenge(ctx);
                    break;
                    
                case "availability":
                    showAvailabilitySettings(ctx);
                    break;
                    
                case "back":
                case null:
                    return;
                    
                default:
                    // Check for season-specific championship challenge (red_bull_challenge_N)
                    if (choice && choice.indexOf("red_bull_challenge_") === 0) {
                        var seasonNum = parseInt(choice.replace("red_bull_challenge_", ""), 10);
                        if (!isNaN(seasonNum)) {
                            launchChampionChallengeForSeason(ctx, seasonNum);
                        }
                    // Check for bracket switch (switch_season_N)
                    } else if (choice && choice.indexOf("switch_season_") === 0) {
                        var switchSeason = parseInt(choice.replace("switch_season_", ""), 10);
                        if (!isNaN(switchSeason)) {
                            selectedSeason = switchSeason;
                            logPlayoffUI("run", "switched_bracket", "season=" + selectedSeason);
                        }
                    } else {
                        return;
                    }
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
        
        // Simulate each match (may be from different brackets)
        var simulated = 0;
        
        for (var k = 0; k < simulatable.length; k++) {
            var match = simulatable[k];
            logPlayoffUI("forceSim", "simulating", "match=" + match.id + " season=" + match._bracketSeasonNumber);
            
            // Get the correct bracket for this match
            var bracket = match._bracketSeasonNumber 
                ? LORB.Playoffs.loadBracket(match._bracketSeasonNumber)
                : LORB.Playoffs.getActiveBracket();
            
            if (bracket) {
                LORB.Playoffs.simulateMatchCPU(bracket, match.id);
                simulated++;
            }
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
            console.getkey(K_NOSPIN);
            resultView.close();
        } else {
            LORB.View.line(simulated + " match(es) have been simulated!");
            LORB.View.line("Press any key...");
            console.getkey(K_NOSPIN);
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
            console.getkey(K_NOSPIN);
            view.close();
        } else {
            LORB.View.warn(message);
            console.getkey(K_NOSPIN);
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
            console.getkey(K_NOSPIN);
            view.close();
        } else {
            LORB.View.line(message);
            console.getkey(K_NOSPIN);
        }
    }
    
    // ========== AVAILABILITY UI ==========
    
    /**
     * Get user's timezone offset in minutes from UTC.
     * Uses Synchronet's user.settings.timezone if available, else JS Date offset.
     * @returns {number} Offset in minutes (positive = ahead of UTC, e.g., UTC+5 = 300)
     */
    function getUserTimezoneOffset() {
        // Synchronet stores timezone in user object
        if (typeof user !== "undefined" && user.settings && typeof user.settings.timezone !== "undefined") {
            // Synchronet stores as minutes from UTC
            return user.settings.timezone;
        }
        // Fallback: use JS Date (note: getTimezoneOffset returns opposite sign)
        return -(new Date().getTimezoneOffset());
    }
    
    /**
     * Format timezone offset for display (e.g., "UTC-5" or "UTC+2")
     * @param {number} offsetMinutes
     * @returns {string}
     */
    function formatTimezoneOffset(offsetMinutes) {
        var hours = Math.floor(Math.abs(offsetMinutes) / 60);
        var mins = Math.abs(offsetMinutes) % 60;
        var sign = offsetMinutes >= 0 ? "+" : "-";
        if (mins === 0) {
            return "UTC" + sign + hours;
        }
        return "UTC" + sign + hours + ":" + (mins < 10 ? "0" : "") + mins;
    }
    
    /**
     * Convert local hour to UTC hour
     * @param {number} localHour - Hour in local time (0-23)
     * @param {number} tzOffset - Timezone offset in minutes
     * @returns {number} Hour in UTC (0-23)
     */
    function localHourToUTC(localHour, tzOffset) {
        var utcHour = localHour - Math.floor(tzOffset / 60);
        while (utcHour < 0) utcHour += 24;
        while (utcHour >= 24) utcHour -= 24;
        return utcHour;
    }
    
    /**
     * Convert UTC hour to local hour
     * @param {number} utcHour - Hour in UTC (0-23)
     * @param {number} tzOffset - Timezone offset in minutes
     * @returns {number} Hour in local time (0-23)
     */
    function utcHourToLocal(utcHour, tzOffset) {
        var localHour = utcHour + Math.floor(tzOffset / 60);
        while (localHour < 0) localHour += 24;
        while (localHour >= 24) localHour -= 24;
        return localHour;
    }
    
    /**
     * Convert day when crossing midnight due to timezone
     * @param {number} day - Day of week (0=Sun, 6=Sat)
     * @param {number} hourShift - Hours shifted (can be negative)
     * @returns {number} Adjusted day of week
     */
    function adjustDayForTimezone(day, hourShift) {
        if (hourShift >= 24) {
            day = (day + 1) % 7;
        } else if (hourShift < 0) {
            day = (day + 6) % 7; // -1 mod 7
        }
        return day;
    }
    
    /**
     * Show the visual time grid for availability configuration.
     * Full 80-column view with 30-minute slots.
     * 
     * @param {Object} ctx - Player context
     * @returns {boolean} true if availability was changed
     */
    function showAvailabilitySettings(ctx) {
        if (!LORB.Playoffs || !LORB.Playoffs.Scheduling) {
            showError("Scheduling system not available.");
            return false;
        }
        
        var Scheduling = LORB.Playoffs.Scheduling;
        var tzOffset = getUserTimezoneOffset();
        var tzName = formatTimezoneOffset(tzOffset);
        
        // Initialize grid from current availability (48 slots per day, 7 days)
        // grid[day][slot] where day=0-6 (Mon-Sun for display), slot=0-47
        // Note: internally we use Mon=0 for display but store as dayOfWeek (0=Sun)
        var DISPLAY_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        var DISPLAY_TO_DOW = [1, 2, 3, 4, 5, 6, 0]; // Mon=1, Tue=2, ... Sun=0
        var DOW_TO_DISPLAY = [6, 0, 1, 2, 3, 4, 5]; // Sun=6, Mon=0, Tue=1, ...
        
        var grid = [];
        for (var d = 0; d < 7; d++) {
            grid[d] = [];
            for (var s = 0; s < 48; s++) {
                grid[d][s] = false;
            }
        }
        
        // Load existing availability into grid (converting from UTC to local)
        var currentBlocks = Scheduling.getPlayerAvailability(ctx) || [];
        for (var i = 0; i < currentBlocks.length; i++) {
            var block = currentBlocks[i];
            var utcMinute = block.startMinuteUTC;
            var utcHour = Math.floor(utcMinute / 60);
            var utcHalfHour = Math.floor((utcMinute % 60) / 30);
            var utcSlot = utcHour * 2 + utcHalfHour;
            
            // Convert to local time
            var localMinute = utcMinute + tzOffset;
            var dayShift = 0;
            while (localMinute < 0) { localMinute += 1440; dayShift--; }
            while (localMinute >= 1440) { localMinute -= 1440; dayShift++; }
            
            var localSlot = Math.floor(localMinute / 30);
            var displayDay = DOW_TO_DISPLAY[block.dayOfWeek];
            displayDay = (displayDay + dayShift + 7) % 7;
            
            if (displayDay >= 0 && displayDay < 7 && localSlot >= 0 && localSlot < 48) {
                grid[displayDay][localSlot] = true;
            }
        }
        
        // Template grids for weekday/weekend patterns (not persisted, used to apply)
        var weekdayTemplate = [];
        var weekendTemplate = [];
        for (var s = 0; s < 48; s++) {
            weekdayTemplate[s] = false;
            weekendTemplate[s] = false;
        }
        
        // Cursor position
        var cursorDay = 0;  // 0-8: 0-6=Mon-Sun, 7=weekday template, 8=weekend template
        var cursorSlot = 36; // Default to 18:00 (slot 36)
        
        // Range selection state
        var rangeSelecting = false;
        var rangeStartDay = -1;
        var rangeStartSlot = -1;
        
        var changed = false;
        var running = true;
        
        while (running) {
            // Clear screen and reset background to black
            console.print("\1n\1" + "0"); // Reset to normal, black background
            console.clear();
            
            // Header - use \r\n for proper CRLF line endings
            console.print("\1n\1h\1wPLAYOFF AVAILABILITY\1n\r\n");
            console.print("\1cSet times when you can play playoff matches.\1n\r\n");
            console.print("\1wTimes shown in your timezone: \1h\1y" + tzName + "\1n\r\n");
            if (rangeSelecting) {
                console.print("\1h\1y[RANGE MODE]\1n \1wArrows to extend, SPACE to apply, ESC to cancel\1n\r\n");
            } else {
                console.print("\1h\1kArrows: move | SPACE: select/range | ENTER: apply template | S: save | Q: quit\1n\r\n");
            }
            console.print("\r\n");
            
            // Time header row - show hours
            var headerLine = "      "; // 6 chars for day label column
            for (var h = 0; h < 24; h++) {
                if (h < 10) {
                    headerLine += "\1h\1k" + h + " \1n";
                } else {
                    headerLine += "\1h\1k" + h + "\1n";
                }
                headerLine += " "; // separator
            }
            console.print(headerLine + "\r\n");
            
            // Grid rows (Mon-Sun = 0-6)
            for (var day = 0; day < 7; day++) {
                var rowLine = "";
                
                // Day label
                if (cursorDay === day) {
                    rowLine += "\1h\1w" + DISPLAY_DAYS[day] + "  \1n";
                } else {
                    rowLine += "\1n\1c" + DISPLAY_DAYS[day] + "  \1n";
                }
                
                // Slots (48 per day, grouped by hour)
                for (var slot = 0; slot < 48; slot++) {
                    var isSelected = grid[day][slot];
                    var isCursor = (cursorDay === day && cursorSlot === slot);
                    var isInRange = false;
                    
                    // Check if this cell is in the current range selection
                    if (rangeSelecting) {
                        var minDay = Math.min(rangeStartDay, cursorDay);
                        var maxDay = Math.max(rangeStartDay, cursorDay);
                        var minSlot = Math.min(rangeStartSlot, cursorSlot);
                        var maxSlot = Math.max(rangeStartSlot, cursorSlot);
                        if (day >= minDay && day <= maxDay && slot >= minSlot && slot <= maxSlot) {
                            isInRange = true;
                        }
                    }
                    
                    rowLine += renderCell(isSelected, isCursor, isInRange);
                    
                    // Add separator between hours (after every 2 slots)
                    if (slot % 2 === 1) {
                        rowLine += "\1h\1k\xB3\1n";
                    }
                }
                
                console.print(rowLine + "\r\n");
            }
            
            // Separator
            console.print("\1h\1k\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\1n\r\n");
            
            // Weekday template row (day index 7)
            var wdRowLine = "";
            if (cursorDay === 7) {
                wdRowLine += "\1h\1wM-F   \1n";
            } else {
                wdRowLine += "\1n\1cM-F   \1n";
            }
            for (var slot = 0; slot < 48; slot++) {
                var isSelected = weekdayTemplate[slot];
                var isCursor = (cursorDay === 7 && cursorSlot === slot);
                var isInRange = false;
                if (rangeSelecting && cursorDay === 7) {
                    var minSlot = Math.min(rangeStartSlot, cursorSlot);
                    var maxSlot = Math.max(rangeStartSlot, cursorSlot);
                    if (rangeStartDay === 7 && slot >= minSlot && slot <= maxSlot) {
                        isInRange = true;
                    }
                }
                wdRowLine += renderCell(isSelected, isCursor, isInRange);
                if (slot % 2 === 1) {
                    wdRowLine += "\1h\1k\xB3\1n";
                }
            }
            console.print(wdRowLine + "\r\n");
            if (cursorDay === 7) {
                console.print("      \1h\1yPress ENTER to apply this pattern to Mon-Fri\1n\r\n");
            }
            
            // Weekend template row (day index 8)
            var weRowLine = "";
            if (cursorDay === 8) {
                weRowLine += "\1h\1wS-S   \1n";
            } else {
                weRowLine += "\1n\1cS-S   \1n";
            }
            for (var slot = 0; slot < 48; slot++) {
                var isSelected = weekendTemplate[slot];
                var isCursor = (cursorDay === 8 && cursorSlot === slot);
                var isInRange = false;
                if (rangeSelecting && cursorDay === 8) {
                    var minSlot = Math.min(rangeStartSlot, cursorSlot);
                    var maxSlot = Math.max(rangeStartSlot, cursorSlot);
                    if (rangeStartDay === 8 && slot >= minSlot && slot <= maxSlot) {
                        isInRange = true;
                    }
                }
                weRowLine += renderCell(isSelected, isCursor, isInRange);
                if (slot % 2 === 1) {
                    weRowLine += "\1h\1k\xB3\1n";
                }
            }
            console.print(weRowLine + "\r\n");
            if (cursorDay === 8) {
                console.print("      \1h\1yPress ENTER to apply this pattern to Sat-Sun\1n\r\n");
            }
            
            // Current slot info
            console.print("\r\n");
            var slotHour = Math.floor(cursorSlot / 2);
            var slotMin = (cursorSlot % 2) * 30;
            var timeStr = (slotHour < 10 ? "0" : "") + slotHour + ":" + (slotMin === 0 ? "00" : "30");
            var endMin = slotMin + 30;
            var endHour = slotHour;
            if (endMin >= 60) { endMin = 0; endHour = (endHour + 1) % 24; }
            var endStr = (endHour < 10 ? "0" : "") + endHour + ":" + (endMin === 0 ? "00" : "30");
            
            var dayLabel = cursorDay < 7 ? DISPLAY_DAYS[cursorDay] : (cursorDay === 7 ? "Weekdays" : "Weekends");
            console.print("\1wSelected: \1h\1y" + dayLabel + " " + timeStr + "-" + endStr + " " + tzName + "\1n");
            
            if (rangeSelecting) {
                var rangeMinSlot = Math.min(rangeStartSlot, cursorSlot);
                var rangeMaxSlot = Math.max(rangeStartSlot, cursorSlot);
                var rangeCount = rangeMaxSlot - rangeMinSlot + 1;
                console.print(" \1h\1c[" + rangeCount + " slots selected]\1n");
            } else if (cursorDay < 7) {
                if (grid[cursorDay][cursorSlot]) {
                    console.print(" \1h\1g[AVAILABLE]\1n");
                } else {
                    console.print(" \1h\1k[unavailable]\1n");
                }
            }
            
            // Get input
            var key = console.getkey(K_NOECHO | K_NOSPIN);
            
            if (rangeSelecting) {
                // Range selection mode
                switch (key) {
                    case KEY_UP:
                        if (cursorDay > 0) cursorDay--;
                        break;
                    case KEY_DOWN:
                        if (cursorDay < 8) cursorDay++;
                        break;
                    case KEY_LEFT:
                        if (cursorSlot > 0) cursorSlot--;
                        break;
                    case KEY_RIGHT:
                        if (cursorSlot < 47) cursorSlot++;
                        break;
                    case " ": // Space - apply range
                        applyRange(grid, weekdayTemplate, weekendTemplate, rangeStartDay, rangeStartSlot, cursorDay, cursorSlot);
                        changed = true;
                        rangeSelecting = false;
                        break;
                    case "\x1b": // ESC - cancel range
                        rangeSelecting = false;
                        break;
                }
            } else {
                // Normal mode
                switch (key) {
                    case KEY_UP:
                        if (cursorDay > 0) cursorDay--;
                        break;
                    case KEY_DOWN:
                        if (cursorDay < 8) cursorDay++;
                        break;
                    case KEY_LEFT:
                        if (cursorSlot > 0) cursorSlot--;
                        break;
                    case KEY_RIGHT:
                        if (cursorSlot < 47) cursorSlot++;
                        break;
                    case " ": // Space - start range selection
                        rangeSelecting = true;
                        rangeStartDay = cursorDay;
                        rangeStartSlot = cursorSlot;
                        break;
                    case "\r": // Enter - apply template
                    case "\n":
                        if (cursorDay === 7) {
                            // Apply weekday template to Mon-Fri
                            for (var d = 0; d < 5; d++) {
                                for (var s = 0; s < 48; s++) {
                                    grid[d][s] = weekdayTemplate[s];
                                }
                            }
                            changed = true;
                        } else if (cursorDay === 8) {
                            // Apply weekend template to Sat-Sun
                            for (var s = 0; s < 48; s++) {
                                grid[5][s] = weekendTemplate[s];
                                grid[6][s] = weekendTemplate[s];
                            }
                            changed = true;
                        }
                        break;
                    case "s":
                    case "S":
                        if (changed) {
                            saveGridToAvailability(ctx, grid, tzOffset, DISPLAY_TO_DOW, Scheduling);
                        }
                        running = false;
                        break;
                    case "q":
                    case "Q":
                    case "\x1b": // ESC
                        running = false;
                        changed = false;
                        break;
                }
            }
        }
        
        return changed;
    }
    
    /**
     * Render a single cell with appropriate colors
     * @param {boolean} isSelected - Is this slot selected/available
     * @param {boolean} isCursor - Is cursor on this cell
     * @param {boolean} isInRange - Is this cell in current range selection
     * @returns {string} Rendered cell character with color codes
     */
    function renderCell(isSelected, isCursor, isInRange) {
        // CP437: \xDB = solid block, \xB0 = light shade, \xB1 = medium shade
        if (isInRange) {
            // Range selection highlight - cyan background
            if (isSelected) {
                return "\1h\1w\1" + "6\xDB\1n"; // White on cyan
            } else {
                return "\1h\1k\1" + "6\xB1\1n"; // Dark on cyan
            }
        } else if (isCursor) {
            // Cursor position
            if (isSelected) {
                return "\1h\1w\1" + "2\xDB\1n"; // White on green
            } else {
                return "\1h\1w\1" + "0\xB1\1n"; // White shade on black
            }
        } else {
            // Normal cell
            if (isSelected) {
                return "\1n\1g\xDB\1n"; // Green block
            } else {
                return "\1h\1k\xB0\1n"; // Dark shade
            }
        }
    }
    
    /**
     * Apply a range selection to the grids
     * @param {Array} grid - Main 7x48 grid
     * @param {Array} weekdayTemplate - Weekday template (48 slots)
     * @param {Array} weekendTemplate - Weekend template (48 slots)
     * @param {number} startDay - Range start day (0-8)
     * @param {number} startSlot - Range start slot
     * @param {number} endDay - Range end day (0-8)
     * @param {number} endSlot - Range end slot
     */
    function applyRange(grid, weekdayTemplate, weekendTemplate, startDay, startSlot, endDay, endSlot) {
        var minDay = Math.min(startDay, endDay);
        var maxDay = Math.max(startDay, endDay);
        var minSlot = Math.min(startSlot, endSlot);
        var maxSlot = Math.max(startSlot, endSlot);
        
        for (var d = minDay; d <= maxDay; d++) {
            for (var s = minSlot; s <= maxSlot; s++) {
                if (d < 7) {
                    // Normal day grid - toggle
                    grid[d][s] = !grid[d][s];
                } else if (d === 7) {
                    // Weekday template
                    weekdayTemplate[s] = !weekdayTemplate[s];
                } else if (d === 8) {
                    // Weekend template
                    weekendTemplate[s] = !weekendTemplate[s];
                }
            }
        }
    }
    
    /**
     * Convert the visual grid back to UTC availability blocks and save.
     * @param {Object} ctx - Player context
     * @param {Array} grid - 7x48 grid of booleans (local time)
     * @param {number} tzOffset - Timezone offset in minutes
     * @param {Array} displayToDow - Mapping from display day (0=Mon) to dayOfWeek (0=Sun)
     * @param {Object} Scheduling - Reference to LORB.Playoffs.Scheduling
     */
    function saveGridToAvailability(ctx, grid, tzOffset, displayToDow, Scheduling) {
        var blocks = [];
        
        for (var displayDay = 0; displayDay < 7; displayDay++) {
            for (var slot = 0; slot < 48; slot++) {
                if (!grid[displayDay][slot]) continue;
                
                // Convert local slot to UTC
                var localMinute = slot * 30;
                var utcMinute = localMinute - tzOffset;
                var dayShift = 0;
                
                while (utcMinute < 0) { utcMinute += 1440; dayShift--; }
                while (utcMinute >= 1440) { utcMinute -= 1440; dayShift++; }
                
                var utcDow = displayToDow[displayDay];
                utcDow = (utcDow + dayShift + 7) % 7;
                
                blocks.push({
                    dayOfWeek: utcDow,
                    startMinuteUTC: utcMinute
                });
            }
        }
        
        // Sort blocks for consistency
        blocks.sort(function(a, b) {
            if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
            return a.startMinuteUTC - b.startMinuteUTC;
        });
        
        Scheduling.setAvailability(ctx, "custom", blocks);
    }
    
    /**
     * Show prompt to set availability if not set yet (for first-time playoff qualifiers)
     * @param {Object} ctx - Player context
     * @returns {boolean} true if user set availability or was already set
     */
    function promptInitialAvailability(ctx) {
        if (!LORB.Playoffs || !LORB.Playoffs.Scheduling) {
            return true; // Skip if scheduling not available
        }
        
        if (LORB.Playoffs.Scheduling.hasSetAvailability(ctx)) {
            return true; // Already set
        }
        
        var tzOffset = getUserTimezoneOffset();
        var tzName = formatTimezoneOffset(tzOffset);
        
        // Show welcome prompt - use \r\n for proper CRLF
        console.clear();
        console.print("\1n\1h\1wPLAYOFF SCHEDULING\1n\r\n\r\n");
        console.print("\1y\1hWelcome to the Playoffs!\1n\r\n\r\n");
        console.print("\1wTo help schedule matches with your opponent,\r\n");
        console.print("\1wplease set your availability.\1n\r\n\r\n");
        console.print("\1cMatches will be automatically scheduled during times\r\n");
        console.print("\1cwhen both you and your opponent are available.\1n\r\n\r\n");
        console.print("\1wYour timezone: \1h\1y" + tzName + "\1n\r\n\r\n");
        console.print("\1h\1kPress S to set availability, or D for default (evenings/weekends)\1n\r\n");
        
        var key = console.getkey(K_UPPER | K_NOSPIN);
        
        if (key === "S") {
            return showAvailabilitySettings(ctx);
        } else {
            // Apply reasonable default - evenings and weekends in user's local time
            applyDefaultAvailability(ctx, tzOffset);
            console.print("\r\n\1gUsing default availability (evenings & weekends).\1n\r\n");
            console.print("\1wYou can change this anytime from the Playoffs menu.\1n\r\n");
            console.print("\1h\1kPress any key...\1n");
            console.getkey(K_NOSPIN);
            return true;
        }
    }
    
    /**
     * Apply a sensible default availability pattern.
     * Weekday evenings (18:00-23:00 local) + Weekends (10:00-23:00 local)
     * @param {Object} ctx
     * @param {number} tzOffset
     */
    function applyDefaultAvailability(ctx, tzOffset) {
        var blocks = [];
        var DISPLAY_TO_DOW = [1, 2, 3, 4, 5, 6, 0];
        
        // Weekday evenings: 18:00-23:00 (slots 36-45)
        for (var displayDay = 0; displayDay < 5; displayDay++) {
            for (var slot = 36; slot < 46; slot++) {
                var localMinute = slot * 30;
                var utcMinute = localMinute - tzOffset;
                var dayShift = 0;
                while (utcMinute < 0) { utcMinute += 1440; dayShift--; }
                while (utcMinute >= 1440) { utcMinute -= 1440; dayShift++; }
                var utcDow = (DISPLAY_TO_DOW[displayDay] + dayShift + 7) % 7;
                blocks.push({ dayOfWeek: utcDow, startMinuteUTC: utcMinute });
            }
        }
        
        // Weekends: 10:00-23:00 (slots 20-45)
        for (var displayDay = 5; displayDay < 7; displayDay++) {
            for (var slot = 20; slot < 46; slot++) {
                var localMinute = slot * 30;
                var utcMinute = localMinute - tzOffset;
                var dayShift = 0;
                while (utcMinute < 0) { utcMinute += 1440; dayShift--; }
                while (utcMinute >= 1440) { utcMinute -= 1440; dayShift++; }
                var utcDow = (DISPLAY_TO_DOW[displayDay] + dayShift + 7) % 7;
                blocks.push({ dayOfWeek: utcDow, startMinuteUTC: utcMinute });
            }
        }
        
        LORB.Playoffs.Scheduling.setAvailability(ctx, "default", blocks);
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
        formatRoundName: formatRoundName,
        showAvailabilitySettings: showAvailabilitySettings,
        promptInitialAvailability: promptInitialAvailability
    };
    
})();
