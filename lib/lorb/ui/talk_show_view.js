/**
 * talk_show_view.js - Talk Show styled event presenter
 *
 * Layout:
 * - 80x4 header with Figlet banner (show name)
 * - 40x20 left column for host art
 * - 40x20 right column for dialogue + lightbar choices
 *
 * Uses direct Frame management (not RichView) to ensure FrameLightbar renders correctly.
 *
 * Usage:
 *   var result = LORB.UI.TalkShowView.present({
 *     hostLines: ["Welcome back! Today we have...", "A real mess on our hands!"],
 *     dialogueLines: ["Your baby mama stands and points...", "What will you do?"],
 *     choices: [{ key: "A", text: "Apologize" }, { key: "B", text: "Walk away" }],
 *     guestArt: "/path/to/guest.bin"  // optional
 *   });
 *   // result.choiceKey has the selected key (uppercased) or null on cancel
 */

(function() {
    // Immediate log to confirm IIFE entry
    var _debugFile = new File("/sbbs/xtrn/nba_jam/data/debug.log");
    if (_debugFile.open("a")) {
        _debugFile.writeln("[" + new Date().toISOString() + "] [TALKSHOW] IIFE ENTRY - before any loads");
        _debugFile.close();
    }
    
    load("sbbsdefs.js");
    load("frame.js");
    load("/sbbs/xtrn/nba_jam/lib/utils/debug-logger.js");
    
    // Debug logging helper - writes to data/debug.log
    function tvLog(msg) {
        debugLog("[TALKSHOW] " + msg);
    }
    
    tvLog("talk_show_view.js loading - after loads");
    
    // Load FrameLightbar
    var LIB_PATH = "/sbbs/xtrn/nba_jam/lib/";
    var _frameLightbarLoaded = false;
    try {
        load(LIB_PATH + "ui/frame-lightbar.js");
        _frameLightbarLoaded = (typeof FrameLightbar === "function");
        tvLog("FrameLightbar loaded: " + _frameLightbarLoaded);
    } catch (e) {
        tvLog("FrameLightbar load FAILED: " + e);
    }
    
    function loadFiglet() {
        if (typeof LORB !== "undefined" && LORB.Util && LORB.Util.FigletBanner) return true;
        try {
            load(LIB_PATH + "lorb/util/figlet-banner.js");
            return true;
        } catch (e) {
            return false;
        }
    }
    
    function pick(arr) {
        if (!arr || arr.length === 0) return "";
        return arr[Math.floor(Math.random() * arr.length)];
    }
    
    // Load talk show host configuration - uses TalkShowConfig global directly (no IIFE)
    var _talkShowConfig = null;
    try {
        load(LIB_PATH + "lorb/config/talk-shows.js");
        // TalkShowConfig is now a plain global, not nested in LORB.Config
        if (typeof TalkShowConfig !== "undefined") {
            _talkShowConfig = TalkShowConfig;
        }
        tvLog("TalkShows config loaded: " + !!_talkShowConfig);
    } catch (e) {
        tvLog("TalkShows config load FAILED: " + e);
    }
    
    // Helper to get host config
    function getHostConfig(hostKey) {
        if (_talkShowConfig && _talkShowConfig.getHost) {
            return _talkShowConfig.getHost(hostKey);
        }
        return null;
    }
    
    // Helper to get host for event type
    function getHostForEvent(eventType, eventSubtype) {
        if (_talkShowConfig && _talkShowConfig.getHostForEvent) {
            return _talkShowConfig.getHostForEvent(eventType, eventSubtype);
        }
        return null;
    }
    
    // Fallback talk show configurations (if config doesn't load)
    var TALK_SHOWS = [
        { name: "DONNIE LIVE", host: "Donnie Q", art: "/sbbs/xtrn/nba_jam/assets/lorb/talkshow_donnie.bin" },
        { name: "RICKI REAL TALK", host: "Ricki Blaze", art: "/sbbs/xtrn/nba_jam/assets/lorb/talkshow_ricki.bin" },
        { name: "SPRUNG!", host: "Jerry S.", art: "/sbbs/xtrn/nba_jam/assets/lorb/talkshow_sprung.bin" },
        { name: "SALLY SCOOP", host: "Sally S.", art: "/sbbs/xtrn/nba_jam/assets/lorb/talkshow_sally.bin" },
        { name: "OPAL", host: "Opal Win", art: "/sbbs/xtrn/nba_jam/assets/lorb/talkshow_opal.bin" }
    ];
    var DEFAULT_TALKSHOW_ART = "/sbbs/xtrn/nba_jam/assets/lorb/talkshow_default.bin";
    
    /**
     * Show a dramatic full-screen Figlet splash before the talk show
     * @param {string} text - Text to display (e.g., "BABY MAMA DRAMA")
     * @param {number} color - ANSI color attribute
     * @param {number} delayMs - How long to show (default: 1500ms)
     */
    function showSplash(text, color, delayMs) {
        if (!text) return;
        delayMs = delayMs || 1500;
        color = color || (YELLOW | HIGH);
        
        tvLog("showSplash: " + text);
        
        var splashFrame = new Frame(1, 1, 80, 24, BG_BLACK);
        splashFrame.open();
        splashFrame.top();
        
        // Try to render Figlet banner centered
        if (typeof LORB !== "undefined" && LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
            // Render to a temp area then try to center vertically
            var bannerFrame = new Frame(1, 8, 80, 8, BG_BLACK, splashFrame);
            bannerFrame.open();
            LORB.Util.FigletBanner.renderToFrame(bannerFrame, text, color);
            bannerFrame.cycle();
        } else {
            // Fallback: simple centered text
            splashFrame.gotoxy(Math.max(1, Math.floor((80 - text.length) / 2)), 12);
            splashFrame.putmsg("\1h\1y" + text + "\1n");
        }
        
        splashFrame.cycle();
        
        // Brief pause for dramatic effect
        mswait(delayMs);
        
        // Close splash
        splashFrame.close();
    }
    
    // Word-wrap helper
    function wrapLines(lines, width) {
        var out = [];
        for (var i = 0; i < lines.length; i++) {
            var words = String(lines[i] || "").split(" ");
            var line = "";
            for (var w = 0; w < words.length; w++) {
                var word = words[w];
                if (line.length + word.length + 1 > width) {
                    if (line.length) out.push(line);
                    line = word;
                } else {
                    line += (line ? " " : "") + word;
                }
            }
            if (line.length) out.push(line);
        }
        return out;
    }
    
    // Render fallback art text when no .bin file exists
    function renderFallbackArt(frame) {
        tvLog("renderFallbackArt() called - using text fallback");
        frame.clear();
        frame.gotoxy(10, 8);
        frame.putmsg("\1h\1w[ LIVE STUDIO ]\1n");
        frame.gotoxy(12, 10);
        frame.putmsg("\1h\1c[ AUDIENCE ]\1n");
    }
    
    // Load art into a frame with fallback
    function loadArt(frame, artPath) {
        tvLog("loadArt() called with path: " + artPath);
        // Use File object for more reliable existence check
        var artFile = new File(artPath);
        tvLog("File.exists=" + artFile.exists);
        if (artFile.exists) {
            try {
                frame.clear(frame.attr);
                tvLog("Calling frame.load(" + artPath + ", 40, 20)");
                var loadResult = frame.load(artPath, 40, 20);
                tvLog("frame.load() returned: " + loadResult);
                if (loadResult === false) {
                    tvLog("frame.load() returned FALSE - file may not have opened");
                    renderFallbackArt(frame);
                    return false;
                }
                tvLog("frame.load() completed successfully");
                return true;
            } catch (e) {
                tvLog("frame.load() FAILED with exception: " + e);
                // Fall through to fallback
            }
        } else {
            tvLog("Art file does NOT exist, using fallback");
        }
        renderFallbackArt(frame);
        return false;
    }
    
    /**
     * Main presentation function
     * 
     * Enhanced options:
     *   - eventType: (string) Event type for host matching (e.g., "baby_mama", "spouse_retaliation")
     *   - eventSubtype: (string) Specific event (e.g., "revenge_baby", "money_demand")
     *   - splashText: (string) Override splash text (or auto-generates from event type)
     *   - showSplash: (boolean) Whether to show dramatic splash intro (default: true if eventType set)
     *   - hostKey: (string) Force specific host by key (e.g., "springer", "oprah")
     *   - show: (object) Legacy: direct show object
     *   - hostLines: (array) Host intro dialogue
     *   - dialogueLines: (array) Main dialogue/situation
     *   - choices: (array) Menu choices
     *   - guestArt: (string) Path to third party art (e.g., NBA player in revenge scenario)
     *   - guestName: (string) Name of guest for dialogue
     *   - dramaticReveal: (boolean) Add pauses and audience reactions
     */
    function present(opts) {
        var mainFrame, headerFrame, artFrame, contentFrame;
        try {
        opts = opts || {};
        tvLog("present() called");
        tvLog("  eventType: " + (opts.eventType || "none"));
        tvLog("  eventSubtype: " + (opts.eventSubtype || "none"));
        tvLog("  choices: " + (opts.choices ? opts.choices.length : 0));
        tvLog("  dialogueLines: " + (opts.dialogueLines ? opts.dialogueLines.length : 0));
        tvLog("  guestArt: " + (opts.guestArt || "none"));
        
        loadFiglet();
        
        // Determine the host based on event type or explicit specification
        var show = null;
        
        // Debug: Log why we're taking each path
        tvLog("  DEBUG: opts.eventType=" + (opts.eventType || "NONE") + 
              ", opts.eventSubtype=" + (opts.eventSubtype || "NONE") + 
              ", configLoaded=" + !!_talkShowConfig);
        
        if (opts.hostKey && _talkShowConfig) {
            // Explicit host key requested
            show = getHostConfig(opts.hostKey);
            tvLog("  explicit hostKey: " + opts.hostKey);
        } else if (opts.eventType && _talkShowConfig) {
            // Get host based on event type
            show = getHostForEvent(opts.eventType, opts.eventSubtype);
            tvLog("  host from event mapping: " + (show ? show.name : "null"));
        } else if (opts.show) {
            // Legacy: direct show object
            show = opts.show;
            tvLog("  legacy show object provided");
        } else {
            tvLog("  NO MATCH: eventType=" + opts.eventType + ", configLoaded=" + !!_talkShowConfig);
        }
        
        // Fallback to random show from old list
        if (!show) {
            show = pick(TALK_SHOWS);
            tvLog("  fallback to random show: " + show.name);
        }
        
        var title = show.name;
        tvLog("  show: " + title);
        
        // === DRAMATIC SPLASH SCREEN ===
        var shouldShowSplash = opts.showSplash !== false && (opts.eventType || opts.splashText);
        if (shouldShowSplash) {
            var splashText = opts.splashText;
            if (!splashText && _talkShowConfig && opts.eventType && _talkShowConfig.getSplashText) {
                splashText = _talkShowConfig.getSplashText(opts.eventType, opts.eventSubtype);
            }
            if (!splashText && opts.eventType) {
                // Generate from event type
                splashText = opts.eventType.toUpperCase().replace(/_/g, " ");
            }
            if (splashText) {
                showSplash(splashText, YELLOW | HIGH, 1500);
            }
        }
        
        var dialogueLines = wrapLines(opts.dialogueLines || [], 36);
        var choices = opts.choices || [];
        var hostLines = wrapLines(opts.hostLines || [], 36);
        
        // Get host-specific intro if not provided
        if (hostLines.length === 0 && show.catchphrases && show.catchphrases.intro) {
            var intro = pick(show.catchphrases.intro);
            if (intro) {
                hostLines = wrapLines([intro], 36);
            }
        }
        
        // Determine art paths
        var hostArt = show.art;
        tvLog("  hostArt before check: " + hostArt);
        if (!file_exists(hostArt)) {
            tvLog("  hostArt doesn't exist, using default: " + DEFAULT_TALKSHOW_ART);
            hostArt = DEFAULT_TALKSHOW_ART;
        }
        var guestArt = opts.guestArt || null;
        
        // Create root frame (full screen) and bring to front
        mainFrame = new Frame(1, 1, 80, 24, BG_BLACK);
        mainFrame.open();
        mainFrame.top();
        tvLog("  mainFrame created and opened");
        
        // Header zone: 80x4 at top
        headerFrame = new Frame(1, 1, 80, 4, BG_BLACK, mainFrame);
        headerFrame.open();
        
        // Art zone: 40x20 on left
        artFrame = new Frame(1, 5, 40, 20, BG_BLACK, mainFrame);
        artFrame.open();
        
        // Content zone: 40x20 on right
        contentFrame = new Frame(41, 5, 40, 20, BG_BLACK, mainFrame);
        contentFrame.open();
        
        // Render header with Figlet
        if (typeof LORB !== "undefined" && LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
            LORB.Util.FigletBanner.renderToFrame(headerFrame, title, WHITE);
        } else {
            headerFrame.gotoxy(2, 2);
            headerFrame.putmsg("\1h\1w" + title + "\1n");
        }
        
        // Load initial host art
        loadArt(artFrame, hostArt);
        
        // Helper to cycle all frames to terminal
        function render() {
            mainFrame.cycle();
        }
        
        // Helper for dramatic pause with optional audience reaction
        function dramaticPause(ms, reactionText) {
            if (reactionText) {
                var ry = 16;
                contentFrame.gotoxy(2, ry);
                contentFrame.putmsg(reactionText);
                render();
            }
            mswait(ms || 800);
        }
        
        // Stage 1: Host intro (if hostLines provided)
        if (hostLines.length > 0) {
            contentFrame.clear();
            var y = 1;
            for (var i = 0; i < hostLines.length && y < 17; i++) {
                contentFrame.gotoxy(2, y++);
                contentFrame.putmsg("\1w" + hostLines[i] + "\1n");
            }
            contentFrame.gotoxy(2, y + 1);
            contentFrame.putmsg("\1c[Press any key to continue]\1n");
            render();
            console.getkey();
            
            // Dramatic reveal transition (if enabled and guest art provided)
            if (opts.dramaticReveal && guestArt && file_exists(guestArt)) {
                // Show audience reaction before reveal
                if (show.catchphrases && show.catchphrases.reveal) {
                    var revealReaction = pick(show.catchphrases.reveal);
                    if (revealReaction) {
                        dramaticPause(600, revealReaction);
                    }
                }
            }
            
            // Swap to guest art if provided
            if (guestArt && file_exists(guestArt)) {
                loadArt(artFrame, guestArt);
                render();
                
                // If guest name provided, announce them
                if (opts.guestName) {
                    contentFrame.clear();
                    contentFrame.gotoxy(2, 1);
                    contentFrame.putmsg("\1h\1y" + opts.guestName + " enters!\1n");
                    render();
                    mswait(800);
                }
            }
        }
        
        // Stage 2: Dialogue + choices
        contentFrame.clear();
        var y = 1;
        for (var i = 0; i < dialogueLines.length && y < 12; i++) {
            contentFrame.gotoxy(2, y++);
            contentFrame.putmsg("\1w" + dialogueLines[i] + "\1n");
        }
        
        var selectedKey = null;
        
        if (choices.length > 0) {
            tvLog("Have " + choices.length + " choices to display");
            // Add spacing before menu
            y += 2;
            render();
            
            // Build menu items
            var menuItems = [];
            for (var i = 0; i < choices.length; i++) {
                var c = choices[i];
                menuItems.push({
                    text: c.text || "",
                    value: c.key,
                    hotkey: String(c.key || "").toUpperCase()
                });
                tvLog("  Choice " + i + ": key=" + c.key + " text=" + c.text);
            }
            
            // Check if FrameLightbar is available
            if (typeof FrameLightbar !== "function") {
                tvLog("ERROR: FrameLightbar is not defined! Cannot create lightbar menu.");
                // Fallback: display choices as text
                for (var fi = 0; fi < menuItems.length; fi++) {
                    contentFrame.gotoxy(2, y + fi);
                    contentFrame.putmsg("\1y[" + menuItems[fi].hotkey + "]\1w " + menuItems[fi].text + "\1n");
                }
                render();
                var fallbackKey = console.getkey().toUpperCase();
                for (var fk = 0; fk < menuItems.length; fk++) {
                    if (menuItems[fk].hotkey === fallbackKey) {
                        selectedKey = fallbackKey;
                        break;
                    }
                }
            } else {
                tvLog("Creating FrameLightbar at y=" + Math.min(y, 14) + " with " + menuItems.length + " items");
                
                // Create lightbar menu in content frame
                var lightbar = new FrameLightbar({
                    frame: contentFrame,
                    x: 2,
                    y: Math.min(y, 14),
                    width: 36,
                    items: menuItems,
                    theme: {
                        fg: LIGHTGRAY,
                        bg: BG_BLACK,
                        hfg: WHITE | HIGH,
                        hbg: BG_BLUE,
                        kfg: YELLOW,
                        khfg: YELLOW | HIGH
                    },
                    lpadding: "  ",
                    rpadding: "  ",
                    onIdle: function() {
                        // Keep rendering during idle to show changes
                        render();
                    }
                });
                
                tvLog("FrameLightbar created, calling draw()");
                
                // Initial draw and render
                lightbar.draw();
                render();
                
                tvLog("Calling lightbar.getval() for user input");
                
                // Get selection
                var choiceVal = lightbar.getval();
                
                tvLog("getval() returned: " + choiceVal);
                
                if (choiceVal) {
                    selectedKey = String(choiceVal).toUpperCase();
                }
            }
        } else {
            // No choices - just press any key
            contentFrame.gotoxy(2, y + 2);
            contentFrame.putmsg("\1c[Press any key]\1n");
            render();
            console.getkey();
        }
        
        // Cleanup
        contentFrame.close();
        artFrame.close();
        headerFrame.close();
        mainFrame.close();
        
        return { choiceKey: selectedKey, show: show };
        } catch (e) {
            // Log exception and cleanup frames if they exist
            log(LOG_ERR, "[TALKSHOW] EXCEPTION in present(): " + e);
            tvLog("EXCEPTION: " + e);
            if (contentFrame) try { contentFrame.close(); } catch(x) {}
            if (artFrame) try { artFrame.close(); } catch(x) {}
            if (headerFrame) try { headerFrame.close(); } catch(x) {}
            if (mainFrame) try { mainFrame.close(); } catch(x) {}
            throw e;  // Re-throw so caller knows it failed
        }
    }
    
    // Export
    if (typeof LORB === "undefined") this.LORB = {};
    if (!LORB.UI) LORB.UI = {};
    LORB.UI.TalkShowView = {
        present: present,
        showSplash: showSplash,
        getHostForEvent: getHostForEvent,
        getHostConfig: getHostConfig,
        shows: TALK_SHOWS
    };
})();
