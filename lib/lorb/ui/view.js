// xtrn/lorb/ui/view.js
// Frame-based view system for LORB
// Provides consistent rendering with the rest of NBA JAM
(function () {
    
    // Ensure Frame is available (normally loaded by module-loader, but be safe)
    if (typeof Frame === "undefined") {
        load("frame.js");
    }
    
    // Screen dimensions
    var SCREEN_WIDTH = 80;
    var SCREEN_HEIGHT = 24;
    
    // Main frame for LORB UI (full screen)
    var mainFrame = null;
    var isOpen = false;
    
    // Current cursor Y position for line-based output
    var cursorY = 0;
    
    /**
     * Initialize the LORB view frame
     * Called automatically on first use
     */
    function ensureFrame() {
        if (mainFrame && isOpen) return;
        
        // Create main frame covering the full screen
        mainFrame = new Frame(1, 1, SCREEN_WIDTH, SCREEN_HEIGHT, BG_BLACK | LIGHTGRAY);
        mainFrame.open();
        isOpen = true;
        cursorY = 0;
    }
    
    /**
     * Close and cleanup the frame
     * Should be called when transitioning to actual game
     */
    function closeFrame() {
        if (mainFrame && isOpen) {
            mainFrame.close();
            isOpen = false;
        }
        mainFrame = null;
    }
    
    /**
     * Render the frame to screen
     */
    function render() {
        if (mainFrame && isOpen) {
            mainFrame.cycle();
        }
    }
    
    /**
     * Get the main frame (for sprite preview, etc.)
     */
    function getFrame() {
        ensureFrame();
        return mainFrame;
    }
    
    LORB.View = {
        // Frame management
        init: ensureFrame,
        close: closeFrame,
        render: render,
        getFrame: getFrame,
        
        // Clear the screen
        clear: function () {
            ensureFrame();
            mainFrame.clear();
            mainFrame.gotoxy(0, 0);
            cursorY = 0;
            render();
        },
        
        // Display title with player name and handle
        title: function (name, handle) {
            ensureFrame();
            mainFrame.putmsg("\1h\1y" + name + "\1n  \1k\1h-\1n  " + handle);
            mainFrame.crlf();
            cursorY++;
            render();
        },
        
        // Display a section header
        header: function (label) {
            ensureFrame();
            mainFrame.crlf();
            mainFrame.putmsg("\1h\1w" + label + "\1n");
            mainFrame.crlf();
            cursorY += 2;
            render();
        },
        
        // Display status bar
        status: function (ctx) {
            ensureFrame();
            mainFrame.putmsg("Team: " + (ctx.userTeam || "None") + 
                "   Cash:\1y$" + (ctx.cash || 0) + "\1n" +
                "   XP:\1c" + (ctx.xp || 0) + "\1n" +
                "   Rep:\1m" + (ctx.rep || 0) + "\1n");
            mainFrame.crlf();
            cursorY++;
            render();
        },
        
        // Display info message
        info: function (s) {
            ensureFrame();
            mainFrame.putmsg(s);
            mainFrame.crlf();
            cursorY++;
            render();
        },
        
        // Display warning message (red)
        warn: function (s) {
            ensureFrame();
            mainFrame.putmsg("\1h\1r" + s + "\1n");
            mainFrame.crlf();
            cursorY++;
            render();
        },
        
        // Display a line of text
        line: function (s) {
            ensureFrame();
            mainFrame.putmsg(s || "");
            mainFrame.crlf();
            cursorY++;
            render();
        },
        
        // Yes/No confirmation prompt
        // Note: Input still uses console for now (Frame doesn't handle input)
        confirm: function (promptText) {
            ensureFrame();
            mainFrame.putmsg(promptText);
            render();
            
            // Use console for input (Frame is display-only)
            var k = console.getkeys("YNyn", 0);
            
            // Echo the response
            mainFrame.putmsg(k || "");
            mainFrame.crlf();
            cursorY++;
            render();
            
            return (k && k.toUpperCase() === "Y");
        },
        
        // Multiple choice selection
        choose: function (labels) {
            ensureFrame();
            
            for (var i = 0; i < labels.length; i++) {
                mainFrame.putmsg("  \1w[\1h" + (i + 1) + "\1n\1w]\1n " + labels[i]);
                mainFrame.crlf();
                cursorY++;
            }
            mainFrame.crlf();
            mainFrame.putmsg("Select: ");
            cursorY++;
            render();
            
            var ch = console.getkeys("123456789", 0);
            
            mainFrame.putmsg(ch || "");
            mainFrame.crlf();
            cursorY++;
            render();
            
            var idx = ch ? (parseInt(ch, 10) - 1) : 0;
            if (idx < 0 || idx >= labels.length) idx = 0;
            return idx;
        },
        
        // Text prompt
        prompt: function (text, keyMask) {
            ensureFrame();
            mainFrame.putmsg(text);
            render();
            
            var result;
            if (keyMask) {
                result = console.getkeys(keyMask, 0);
            } else {
                result = console.getstr("", 32);
            }
            
            mainFrame.putmsg(result || "");
            mainFrame.crlf();
            cursorY++;
            render();
            
            return result;
        },
        
        // Numeric prompt
        promptNumber: function (text) {
            ensureFrame();
            mainFrame.putmsg(text);
            render();
            
            var s = console.getstr("", 8, K_NUMBER);
            
            mainFrame.putmsg(s || "");
            mainFrame.crlf();
            cursorY++;
            render();
            
            return parseInt(s, 10);
        },
        
        // Position cursor at specific location
        gotoxy: function (x, y) {
            ensureFrame();
            mainFrame.gotoxy(x, y);
            cursorY = y;
        },
        
        // Get current cursor position
        getxy: function () {
            ensureFrame();
            return mainFrame.getxy();
        },
        
        // Draw at specific position without moving cursor
        drawAt: function (x, y, text, attr) {
            ensureFrame();
            var pos = mainFrame.getxy();
            mainFrame.gotoxy(x, y);
            if (attr !== undefined) {
                mainFrame.attr = attr;
            }
            mainFrame.putmsg(text);
            mainFrame.gotoxy(pos.x, pos.y);
            render();
        },
        
        // Create a child frame (for sprite preview, etc.)
        createChildFrame: function (x, y, width, height, attr) {
            ensureFrame();
            var child = new Frame(x, y, width, height, attr || BG_BLACK, mainFrame);
            child.open();
            return child;
        }
    };
})();