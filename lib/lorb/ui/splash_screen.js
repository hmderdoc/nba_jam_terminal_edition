/**
 * splash_screen.js - LORB Splash Screen with Red Bull graphic
 * 
 * Displays the Red Bull ANSI art for 10 seconds or until user presses Enter.
 * Pressing "?" shows a help/tutorial screen before continuing.
 */

load("sbbsdefs.js");
load("frame.js");

// Load BinLoader for .bin file loading
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
        log(LOG_WARNING, "[SPLASH] Failed to load bin-loader.js: " + e);
    }
}

(function() {
    
    var SPLASH_TIMEOUT_MS = 10000;  // 10 seconds
    var SPLASH_ART_PATH = "/sbbs/xtrn/nba_jam/assets/red_bull.bin";
    var SPLASH_ANS_PATH = "/sbbs/xtrn/nba_jam/assets/red_bull.ans";
    
    var SCREEN_WIDTH = 80;
    var SCREEN_HEIGHT = 24;
    
    /**
     * Show the LORB splash screen
     * Returns: "continue" (normal entry), "help" (show help first), or null (cancelled)
     */
    function showSplash() {
        console.clear();
        
        // Create main frame - full 80x24 for the .bin art
        var mainFrame = new Frame(1, 1, SCREEN_WIDTH, SCREEN_HEIGHT, BG_BLACK);
        mainFrame.open();
        
        // Try to load the splash art
        var artLoaded = false;
        
        // Try .bin first - the red_bull.bin is 80x24 (with SAUCE record)
        if (typeof BinLoader !== "undefined" && file_exists(SPLASH_ART_PATH)) {
            try {
                // Load directly into frame at position 1,1 - full 80x24
                artLoaded = BinLoader.loadIntoFrame(mainFrame, SPLASH_ART_PATH, SCREEN_WIDTH, SCREEN_HEIGHT, 1, 1);
            } catch (e) {
                log(LOG_WARNING, "[SPLASH] Failed to load .bin: " + e);
                artLoaded = false;
            }
        }
        
        // Fallback to .ans
        if (!artLoaded && file_exists(SPLASH_ANS_PATH)) {
            try {
                mainFrame.load(SPLASH_ANS_PATH);
                artLoaded = true;
            } catch (e) {
                log(LOG_WARNING, "[SPLASH] Failed to load .ans: " + e);
            }
        }
        
        // Fallback to text if no art loaded
        if (!artLoaded) {
            mainFrame.gotoxy(1, 8);
            mainFrame.putmsg("\1r\1h" + centerText("LEGEND OF THE RED BULL", SCREEN_WIDTH) + "\1n");
            mainFrame.gotoxy(1, 10);
            mainFrame.putmsg("\1w" + centerText("An NBA Jam RPG Experience", SCREEN_WIDTH) + "\1n");
        }
        
        // Draw prompt at bottom (on top of art)
        var promptY = SCREEN_HEIGHT;
        mainFrame.gotoxy(1, promptY);
        mainFrame.putmsg("\1n\1h\1k" + centerText("Press ENTER to continue, ? for help", SCREEN_WIDTH) + "\1n");
        
        mainFrame.cycle();
        
        // Wait for input with timeout
        var startTime = Date.now ? Date.now() : (time() * 1000);
        var result = "continue";
        
        while (true) {
            var elapsed = (Date.now ? Date.now() : (time() * 1000)) - startTime;
            
            if (elapsed >= SPLASH_TIMEOUT_MS) {
                // Timeout - auto-continue
                break;
            }
            
            // Check for input (non-blocking)
            var key = console.inkey(K_NONE, 100);  // 100ms poll
            
            if (key) {
                if (key === "\r" || key === "\n" || key === " ") {
                    // Enter/space - continue
                    result = "continue";
                    break;
                } else if (key === "?") {
                    // Help requested
                    result = "help";
                    break;
                } else if (key === "\x1b" || key.toUpperCase() === "Q") {
                    // ESC or Q - cancel (go back to main menu)
                    result = null;
                    break;
                }
            }
            
            // Update countdown display (optional)
            var remaining = Math.ceil((SPLASH_TIMEOUT_MS - elapsed) / 1000);
            mainFrame.gotoxy(SCREEN_WIDTH - 3, promptY);
            mainFrame.putmsg("\1h\1k" + (remaining < 10 ? " " : "") + remaining + "\1n");
            mainFrame.cycle();
        }
        
        mainFrame.close();
        console.clear();
        
        return result;
    }
    
    /**
     * Show the LORB help/tutorial screen
     * Scrollable text-based tutorial
     */
    function showHelp() {
        console.clear();
        
        var helpText = [
            "\1h\1c=== LEGEND OF THE RED BULL ===\1n",
            "",
            "\1wWelcome to LORB, an RPG mode for NBA Jam!\1n",
            "",
            "\1h\1y--- GETTING STARTED ---\1n",
            "",
            "When you first enter LORB, you'll create a character by choosing:",
            "  \1c*\1n Name - Your player's display name",
            "  \1c*\1n Archetype - Your play style (Sharpshooter, Slasher, etc.)",
            "  \1c*\1n Background - Affects starting stats and perks",
            "",
            "After creation, you'll be dropped into the current city where you",
            "can explore, train, and compete against other players.",
            "",
            "\1h\1y--- THE HUB ---\1n",
            "",
            "The Hub is your home base in each city. From here you can:",
            "",
            "  \1g[S]\1n \1wStreet Courts\1n - Play pickup games for cash and XP",
            "  \1g[G]\1n \1wGym\1n - Train your stats (costs a turn)",
            "  \1g[B]\1n \1wBar/Club\1n - Meet contacts, recruit teammates",
            "  \1g[H]\1n \1wCrib\1n - View your stats, equipment, contacts",
            "  \1g[T]\1n \1wTournaments\1n - Challenge other players, view rankings",
            "  \1g[P]\1n \1wPlayoffs\1n - Compete in end-of-season tournament",
            "",
            "\1h\1y--- DAILY TURNS ---\1n",
            "",
            "Each real-world day, you get a limited number of turns to spend.",
            "Turns reset at midnight. Activities that cost turns:",
            "",
            "  \1c*\1n Playing games on Street Courts",
            "  \1c*\1n Training at the Gym",
            "  \1c*\1n Certain Bar/Club actions",
            "",
            "\1h\1y--- PROGRESSION ---\1n",
            "",
            "\1wXP & Levels:\1n Win games to earn XP. Level up to unlock new",
            "abilities and increase your attribute cap.",
            "",
            "\1wCash:\1n Earned from winning games. Use it at the Shop to buy",
            "equipment that boosts your stats.",
            "",
            "\1wREP:\1n Your reputation score. High REP gets you better rankings",
            "and determines playoff seeding.",
            "",
            "\1h\1y--- MULTIPLAYER ---\1n",
            "",
            "LORB supports live PvP challenges against other online players!",
            "",
            "  \1c*\1n See who's online from the Hub or Tournaments menu",
            "  \1c*\1n Send challenges with optional wager",
            "  \1c*\1n Win to take your opponent's cash!",
            "",
            "If your opponent is offline, you can play a 'Ghost Match' against",
            "their AI-controlled character.",
            "",
            "\1h\1y--- SEASONS & PLAYOFFS ---\1n",
            "",
            "The game runs in seasons. At the end of each season:",
            "",
            "  \1c*\1n Top players qualify for the Playoffs",
            "  \1c*\1n Playoff matches use your frozen end-of-season stats",
            "  \1c*\1n Win the playoffs to become Season Champion!",
            "",
            "A new season starts immediately, so you can keep playing while",
            "the playoffs run in parallel.",
            "",
            "\1h\1y--- CITIES ---\1n",
            "",
            "The game cycles through 30 NBA cities. Each day the whole server",
            "moves to a new city. City artwork appears in the Hub.",
            "",
            "\1h\1y--- TIPS ---\1n",
            "",
            "  \1c*\1n Focus on your archetype's strengths when training",
            "  \1c*\1n Recruit a strong teammate from the Bar",
            "  \1c*\1n Check the rankings to find worthy opponents",
            "  \1c*\1n Save some cash for playoff wagers!",
            "  \1c*\1n Visit daily to maximize your turns",
            "",
            "\1h\1c=== GOOD LUCK! ===\1n",
            ""
        ];
        
        // Simple scrolling display
        var linesPerPage = SCREEN_HEIGHT - 3;
        var currentLine = 0;
        var totalLines = helpText.length;
        
        while (true) {
            console.clear();
            console.print("\1h\1w LORB HELP \1n\1h\1k (Page " + (Math.floor(currentLine / linesPerPage) + 1) + 
                         "/" + Math.ceil(totalLines / linesPerPage) + ")\1n\r\n");
            console.print("\1h\1k" + repeat("\xC4", 78) + "\1n\r\n");
            
            // Display current page of text
            for (var i = 0; i < linesPerPage && (currentLine + i) < totalLines; i++) {
                console.print(" " + helpText[currentLine + i] + "\r\n");
            }
            
            // Navigation prompt
            console.print("\r\n\1h\1k" + repeat("\xC4", 78) + "\1n");
            
            if (currentLine + linesPerPage >= totalLines) {
                console.print("\r\n\1h\1w[ENTER]\1n Continue to game  \1h\1k|\1n  \1h\1w[UP/PGUP]\1n Scroll up  \1h\1k|\1n  \1h\1w[Q]\1n Back");
            } else {
                console.print("\r\n\1h\1w[DOWN/PGDN/SPACE]\1n Next  \1h\1k|\1n  \1h\1w[UP/PGUP]\1n Prev  \1h\1k|\1n  \1h\1w[Q]\1n Back  \1h\1k|\1n  \1h\1w[ENTER]\1n Skip to game");
            }
            
            var key = console.getkey(K_NOECHO);
            
            // Handle navigation
            if (key === "\r" || key === "\n") {
                // Enter - continue to game
                break;
            } else if (key === "q" || key === "Q" || key === "\x1b") {
                // Q/ESC - go back (to splash, which will timeout to game anyway)
                break;
            } else if (key === " " || key === KEY_DOWN || key === KEY_PAGEDN || 
                       key.charCodeAt(0) === 31 || key.charCodeAt(0) === 14) {  // Down arrow variants
                // Next page
                if (currentLine + linesPerPage < totalLines) {
                    currentLine += linesPerPage;
                }
            } else if (key === KEY_UP || key === KEY_PAGEUP || 
                       key.charCodeAt(0) === 30 || key.charCodeAt(0) === 16) {  // Up arrow variants
                // Previous page
                if (currentLine >= linesPerPage) {
                    currentLine -= linesPerPage;
                } else {
                    currentLine = 0;
                }
            }
        }
        
        console.clear();
    }
    
    /**
     * Main entry point - show splash, optionally help, then return
     * Returns: true to continue to LORB, false to go back to main menu
     */
    function run() {
        var result = showSplash();
        
        if (result === null) {
            // User cancelled
            return false;
        }
        
        if (result === "help") {
            showHelp();
        }
        
        // Continue to LORB
        return true;
    }
    
    // Helper functions
    function centerText(text, width) {
        var padding = Math.floor((width - text.length) / 2);
        if (padding < 0) padding = 0;
        return repeat(" ", padding) + text;
    }
    
    function repeat(char, count) {
        var result = "";
        for (var i = 0; i < count; i++) {
            result += char;
        }
        return result;
    }
    
    // Key constants if not defined
    if (typeof KEY_UP === "undefined") var KEY_UP = "\x1b[A";
    if (typeof KEY_DOWN === "undefined") var KEY_DOWN = "\x1b[B";
    if (typeof KEY_PAGEUP === "undefined") var KEY_PAGEUP = "\x1b[5~";
    if (typeof KEY_PAGEDN === "undefined") var KEY_PAGEDN = "\x1b[6~";
    
    // Export
    if (!this.LORB) this.LORB = {};
    if (!LORB.UI) LORB.UI = {};
    
    LORB.UI.SplashScreen = {
        run: run,
        showSplash: showSplash,
        showHelp: showHelp
    };
    
})();
