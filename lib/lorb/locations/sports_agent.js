/**
 * sports_agent.js - Larry Lalyre's Sports Agency
 * 
 * Larry Lalyre (inspired by Jerry Maguire) guides players on building their Ballerdex.
 * 
 * First-time players: Tutorial explaining the Ballerdex system
 * Returning players: Community news feed of recent contact acquisitions
 */

var _sportsAgentRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _sportsAgentRichView = RichView;
} catch (e) {
}

// Load BinLoader for .bin file loading
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
    }
}

(function() {
    
    var RichView = _sportsAgentRichView;
    
    // Art file paths
    var ART_PATH = "/sbbs/xtrn/nba_jam/assets/lorb/sports_agent.bin";
    var ART_W = 40;
    var ART_H = 20;
    
    // News display limits
    var MAX_NEWS_DISPLAY = 5;
    
    // Larry's personality - various phrases he uses
    var LARRY_GREETINGS = [
        "Show me the Ballerdex!",
        "Help me help YOU!",
        "You had me at 'dunk'.",
        "It's about the relationships, baby.",
        "Let's build your empire!"
    ];
    
    var LARRY_FIRST_TIME = [
        "\1h\1yHey there, rookie!\1n",
        "",
        "\1wI'm \1h\1cLarry Lalyre\1n\1w, sports agent",
        "\1wextraordinaire.\1n",
        "",
        "\1wLet me tell you about the",
        "\1h\1yBALLERDEX\1n\1w system.\1n",
        "",
        "\1cEvery NBA player you beat on the",
        "streets will give you their number.\1n",
        "",
        "\1wThey go into your \1h\1yBallerdex\1n\1w -",
        "your contact list of ballers.\1n",
        "",
        "\1gFrom there, you can recruit them",
        "to your CREW!\1n",
        "",
        "\1wCheck your Ballerdex at your \1h\1cCRIB\1n\1w.",
        "\1wThat's your home base.\1n"
    ];
    
    var LARRY_RETURNING = [
        // Greeting is shown separately via getRandomGreeting()
    ];
    
    var LARRY_NO_NEWS = [
        "",
        "\1n\1mIt's been quiet out there...\1n",
        "\1n\1mNo new contacts in the community.\1n",
        "",
        "\1yGet out there and show 'em",
        "what you got!\1n"
    ];
    
    /**
     * Get a random Larry greeting
     */
    function getRandomGreeting() {
        return LARRY_GREETINGS[Math.floor(Math.random() * LARRY_GREETINGS.length)];
    }
    
    /**
     * Main entry point - show the sports agent view on game entry
     * @param {Object} ctx - Player context
     * @returns {string|null} - Result or null
     */
    function show(ctx) {
        if (RichView) {
            return showRichView(ctx);
        } else {
            return showLegacy(ctx);
        }
    }
    
    /**
     * Check if player has seen the intro tutorial
     */
    function hasSeenIntro(ctx) {
        return !!(ctx.flags && ctx.flags.hasSeenSportsAgentIntro);
    }
    
    /**
     * Mark player as having seen the intro
     */
    function markIntroSeen(ctx) {
        if (!ctx.flags) ctx.flags = {};
        ctx.flags.hasSeenSportsAgentIntro = true;
    }
    
    /**
     * Get recent contact acquisition news from community
     * @param {number} limit - Max entries to return
     * @returns {Array} News entries
     */
    function getContactNews(limit) {
        limit = limit || MAX_NEWS_DISPLAY;
        var news = [];
        
        try {
            if (LORB && LORB.Persist && LORB.Persist.readShared) {
                var data = LORB.Persist.readShared("ballerdexNews");
                if (data && data.entries && Array.isArray(data.entries)) {
                    news = data.entries;
                }
            }
        } catch (e) {
            if (typeof debugLog === "function") {
                debugLog("[SPORTS_AGENT] Error reading news: " + e);
            }
        }
        
        // Sort by timestamp descending (newest first)
        news.sort(function(a, b) {
            return (b.timestamp || 0) - (a.timestamp || 0);
        });
        
        return news.slice(0, limit);
    }
    
    /**
     * Add a contact acquisition to the community news
     * Called when a player gets a new contact
     * @param {Object} entry - { playerName, contactName, contactTeam, timestamp }
     * @returns {boolean} Success
     */
    function addContactNews(entry) {
        var MAX_ENTRIES = 50;
        
        try {
            if (!LORB || !LORB.Persist || !LORB.Persist.readShared || !LORB.Persist.writeShared) {
                return false;
            }
            
            var data = LORB.Persist.readShared("ballerdexNews");
            if (!data || !data.entries) {
                data = { entries: [] };
            }
            
            // Add timestamp if not present
            if (!entry.timestamp) {
                entry.timestamp = Date.now();
            }
            
            data.entries.push(entry);
            
            // Trim to max entries (keep newest)
            if (data.entries.length > MAX_ENTRIES) {
                data.entries.sort(function(a, b) {
                    return (b.timestamp || 0) - (a.timestamp || 0);
                });
                data.entries = data.entries.slice(0, MAX_ENTRIES);
            }
            
            data.lastUpdated = Date.now();
            
            return LORB.Persist.writeShared("ballerdexNews", data);
        } catch (e) {
            if (typeof debugLog === "function") {
                debugLog("[SPORTS_AGENT] Error adding news: " + e);
            }
            return false;
        }
    }
    
    /**
     * Format a contact news entry for display
     */
    function formatNewsEntry(entry) {
        var lines = [];
        
        // Vary the phrasing randomly
        var phrases = [
            "\1c{contact}\1n\1w gave \1y{player}\1n\1w their number!",
            "\1y{player}\1n\1w got \1c{contact}\1n\1w's digits!",
            "\1c{contact}\1n\1w joined \1y{player}\1n\1w's Ballerdex!",
            "\1y{player}\1n\1w connected with \1c{contact}\1n\1w!"
        ];
        
        var phrase = phrases[Math.floor(Math.random() * phrases.length)];
        phrase = phrase.replace("{contact}", entry.contactName || "Unknown");
        phrase = phrase.replace("{player}", entry.playerName || "Someone");
        
        lines.push(phrase);
        
        // Add team info if available
        if (entry.contactTeam) {
            lines.push("  \1w(" + entry.contactTeam + ")\1n");
        }
        
        return lines;
    }
    
    /**
     * RichView display
     */
    function showRichView(ctx) {
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
            LORB.Util.FigletBanner.renderToFrame(headerFrame, "BALLERDEX", LIGHTRED | HIGH);
        } else {
            headerFrame.gotoxy(2, 2);
            headerFrame.putmsg("\1h\1r=== BALLERDEX ===\1n");
        }
        
        // Load Larry's art
        loadArt(view);
        
        // Draw light red border on content zone - returns inner frame
        var contentFrame = view.drawBorder("content", {
            color: LIGHTRED,
            padding: 1
        });
        
        // gotoxy is now relative to the inner frame
        var cy = 1;
        
        var isFirstTime = !hasSeenIntro(ctx);
        
        if (isFirstTime) {
            // First-time tutorial
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1h\1m" + getRandomGreeting() + "\1n");
            cy++;
            
            for (var i = 0; i < LARRY_FIRST_TIME.length; i++) {
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg(LARRY_FIRST_TIME[i]);
            }
            
            // Mark as seen
            markIntroSeen(ctx);
        } else {
            // Returning player - show news
            contentFrame.gotoxy(1, cy++);
            contentFrame.putmsg("\1h\1m" + getRandomGreeting() + "\1n");
            cy++;
            
            for (var j = 0; j < LARRY_RETURNING.length; j++) {
                contentFrame.gotoxy(1, cy++);
                contentFrame.putmsg(LARRY_RETURNING[j]);
            }
            
            var news = getContactNews(MAX_NEWS_DISPLAY);
            
            if (news.length === 0) {
                for (var k = 0; k < LARRY_NO_NEWS.length; k++) {
                    contentFrame.gotoxy(1, cy++);
                    contentFrame.putmsg(LARRY_NO_NEWS[k]);
                }
            } else {
                cy++;
                
                for (var n = 0; n < news.length; n++) {
                    var entryLines = formatNewsEntry(news[n]);
                    for (var el = 0; el < entryLines.length; el++) {
                        contentFrame.gotoxy(1, cy++);
                        contentFrame.putmsg(entryLines[el]);
                    }
                }
            }
        }
        
        // Press any key prompt at bottom of content area
        cy++;
        contentFrame.gotoxy(1, cy++);
        contentFrame.putmsg("\1h\1kPress any key to continue...\1n");
        
        view.render();
        console.getkey();
        view.close();
        
        return null;
    }
    
    /**
     * Load art into the view
     */
    function loadArt(view) {
        if (typeof BinLoader === "undefined") return;
        
        var artFrame = view.getZone("art");
        if (artFrame) {
            BinLoader.loadIntoFrame(artFrame, ART_PATH, ART_W, ART_H, 1, 1);
        }
        
        view.render();
    }
    
    /**
     * Legacy fallback display (no RichView)
     */
    function showLegacy(ctx) {
        LORB.View.clear();
        LORB.View.header("LARRY LALYRE - SPORTS AGENT");
        LORB.View.line("");
        LORB.View.line("\1h\1m" + getRandomGreeting() + "\1n");
        LORB.View.line("");
        
        var isFirstTime = !hasSeenIntro(ctx);
        
        if (isFirstTime) {
            LORB.View.line("I'm Larry Lalyre, sports agent extraordinaire.");
            LORB.View.line("");
            LORB.View.line("Let me tell you about the BALLERDEX system:");
            LORB.View.line("");
            LORB.View.line("- Beat NBA players on the streets");
            LORB.View.line("- They'll give you their number");
            LORB.View.line("- Collect them in your BALLERDEX");
            LORB.View.line("- Recruit them to your CREW!");
            LORB.View.line("");
            LORB.View.line("Check your Ballerdex at your CRIB.");
            
            markIntroSeen(ctx);
        } else {
            LORB.View.line("Here's what's happening in the community:");
            LORB.View.line("");
            
            var news = getContactNews(MAX_NEWS_DISPLAY);
            
            if (news.length === 0) {
                LORB.View.line("It's been quiet out there...");
                LORB.View.line("Get out there and show 'em what you got!");
            } else {
                for (var n = 0; n < news.length; n++) {
                    var entry = news[n];
                    LORB.View.line("- " + (entry.contactName || "Unknown") + 
                                  " gave " + (entry.playerName || "Someone") + 
                                  " their number!");
                }
            }
        }
        
        LORB.View.line("");
        LORB.View.line("\1h\1kPress any key...\1n");
        console.getkey();
        
        return null;
    }
    
    // ========== EXPORTS ==========
    
    // Register in LORB namespace
    if (typeof LORB !== "undefined") {
        if (!LORB.Locations) LORB.Locations = {};
        LORB.Locations.SportsAgent = {
            show: show,
            addContactNews: addContactNews,
            getContactNews: getContactNews,
            hasSeenIntro: hasSeenIntro
        };
    }
    
})();
