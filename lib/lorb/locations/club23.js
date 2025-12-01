/**
 * club23.js - Club 23
 * 
 * The social hub of Rim City.
 * Rest, listen for rumors, and bet on AI vs AI games.
 * 
 * Uses RichView with dynamic content updates based on menu selection.
 */

var _club23RichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _club23RichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[CLUB23] Failed to load RichView: " + e);
}

// Load BinLoader for .bin art files
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js");
    } catch (e) {
        log(LOG_WARNING, "[CLUB23] Failed to load bin-loader.js: " + e);
    }
}

(function() {
    
    var RichView = _club23RichView;
    
    // Art file paths
    var ART_HEADER = "/sbbs/xtrn/nba_jam/assets/lorb/club23_header.bin";
    var ART_SIDE = "/sbbs/xtrn/nba_jam/assets/lorb/club23_art.bin";
    var ART_BOOKIE = "/sbbs/xtrn/nba_jam/assets/lorb/bookie.bin";
    var ART_HEADER_W = 80, ART_HEADER_H = 4;
    var ART_SIDE_W = 40, ART_SIDE_H = 20;
    
    var CHARACTERS_DIR = "/sbbs/xtrn/nba_jam/assets/characters/";
    var CHAR_ART_W = 40, CHAR_ART_H = 20;
    var ROSTERS_INI = "/sbbs/xtrn/nba_jam/lib/config/rosters.ini";
    
    // Cached player data from rosters.ini
    var PLAYER_CACHE = null;
    
    // Static rumor pool (fallback)
    var STATIC_RUMORS = [
        "I heard the Red Bull only plays when the moon is full...",
        "Court 9? The Rimkeeper doesn't let just anyone ball there.",
        "Some kid from Courtline Ave just dropped 50 on a Dunk District regular.",
        "They say Cloudwalkers are the only sneakers that work in the Court of Airness.",
        "The Arc? Pure shooters only. No dunkers allowed.",
        "I saw someone drink a Mystery Mix and play for three days straight.",
        "Fadeaway Prophet taught me the mid-range. Changed my life.",
        "Don't mess with Neon Gator. That dude brings chaos wherever he goes.",
        "The Red Bull? Six rings, man. Six rings forged into a spirit.",
        "Sole Collector's got cursed sneakers. Don't buy from him.",
        "Rep is everything in this city. Build yours or stay a nobody.",
        "I lost $500 betting on a sure thing. There are no sure things.",
        "The gym on 5th? Coach there trained legends.",
        "You want to face the Red Bull? You gotta earn it first.",
        "Rim City never sleeps. The courts are always open."
    ];
    
    // Dynamic rumor templates - use {name}, {nick}, {team}, {stat}, {statVal}, etc.
    // Solo templates: spoken by player1, no player2 reference
    var SOLO_TRASH_TALK = [
        "Nobody in this city can guard me.",
        "I dropped 40 last night. Didn't even break a sweat.",
        "My three-pointer is MONEY. Automatic.",
        "I run this city. Ask anybody.",
        "They keep doubling me. Still can't stop me.",
        "I'm the best in Rim City. Period.",
        "You want these hands? Come get 'em.",
        "My handles are sick. Can't be checked."
    ];
    
    // Versus templates: require both player1 and player2 to be different
    var VERSUS_TRASH_TALK = [
        "You seen {nick2}'s jumper? Broken!",
        "I'd cook {nick2} one on one, no question.",
        "I got {nick2} on my squad, we're taking the chip.",
        "{team2}? Please. {team1} runs this city.",
        "Heard {nick2} been hitting the gym. Still can't dunk though.",
        "Don't let {nick2} catch you slipping. That steal game is nasty.",
        "{nick2}? All hype, no game.",
        "{nick2} can't guard me on his best day!",
        "Me and {nick2} ran ones yesterday. I cooked him.",
        "{nick2}'s defense is soft. I score on him every time."
    ];
    
    // Solo compliments (self-hype that sounds natural)
    var SOLO_COMPLIMENTS = [
        "I been putting in work. You can tell.",
        "My game is on another level right now.",
        "Feeling good today. Real good.",
        "The grind never stops. That's how I stay on top."
    ];
    
    // Versus compliments (about player2)
    var VERSUS_COMPLIMENTS = [
        "{nick2} is the real deal. Respect.",
        "Watching {nick2} play is like poetry in motion.",
        "Me and {nick2} on the same squad? Game over.",
        "If I could play like {nick2}, I'd retire happy.",
        "{nick2}'s defense is suffocating. Can't get nothing easy.",
        "That {nick2} got ice in his veins. Clutch.",
        "{nick2} been putting in work. Gotta respect it."
    ];
    
    var STAT_BRAG_TEMPLATES = [
        { stat: "speed", text: "My speed's a {statVal}. Try to keep up." },
        { stat: "3point", text: "Three-point game? I'm sitting at {statVal}. Cash money." },
        { stat: "power", text: "Power rating {statVal}. I'm built different." },
        { stat: "block", text: "Defense at {statVal}. Nothing gets past me." },
        { stat: "dunk", text: "Dunk rating {statVal}. Poster city, baby." },
        { stat: "steal", text: "Steal rating {statVal}. Pickpocket supreme." }
    ];
    
    var STAT_ROAST_TEMPLATES = [
        { stat: "speed", text: "{nick2}'s speed is only {statVal}? I run circles around that." },
        { stat: "3point", text: "A {statVal} three-point rating? Keep {nick2} away from the arc." },
        { stat: "power", text: "{name2} got a {statVal} power rating. Soft." },
        { stat: "block", text: "Block rating of {statVal}? {nick2} can't protect the rim." },
        { stat: "dunk", text: "Dunk at {statVal}? {name2} scared of the rim." },
        { stat: "steal", text: "Steal at {statVal}? {nick2} couldn't take candy from a baby." }
    ];
    
    // Rest flavor text
    var REST_LINES = [
        "You grab a booth and rest your legs.",
        "The bartender slides you a water. \"On the house.\"",
        "You close your eyes for a moment. The crowd noise fades.",
        "A comfortable exhaustion settles over you.",
        "The bass thumps low as you recover your strength."
    ];
    
    // Menu item descriptions for hover effect
    var MENU_INFO = {
        rest: {
            title: "Rest & Recover",
            lines: [
                "Take a load off in a corner booth.",
                "Recover some street turns.",
                "",
                "Once per day."
            ]
        },
        rumors: {
            title: "Listen for Rumors",
            lines: [
                "The regulars always have something",
                "to say. Lean in and listen.",
                "",
                "Learn about Rim City's secrets."
            ]
        },
        bet: {
            title: "Bet on a Game",
            lines: [
                "Street games run all night.",
                "Put some cash on the line.",
                "",
                "Minimum bet: $50"
            ]
        },
        leave: {
            title: "Leave Club 23",
            lines: [
                "Head back out into Rim City.",
                "",
                "The night is still young..."
            ]
        }
    };
    
    /**
     * Get a random NBA player with art from the characters directory
     * Returns { name: "Allen Iverson", path: "/sbbs/.../allen_iverson.bin", slug: "allen_iverson" }
     */
    function getRandomNBAPlayer() {
        var files;
        try {
            files = directory(CHARACTERS_DIR + "*.bin");
        } catch (e) {
            return null;
        }
        
        if (!files || files.length === 0) return null;
        
        var file = files[Math.floor(Math.random() * files.length)];
        var basename = file_getname(file).replace(/\.bin$/i, "");
        var name = basename.split("_").map(function(word) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(" ");
        
        return { name: name, path: file, slug: basename };
    }
    
    /**
     * Load player data from rosters.ini (cached)
     */
    function ensurePlayerCache() {
        if (PLAYER_CACHE) return PLAYER_CACHE;
        
        PLAYER_CACHE = {};
        
        if (!file_exists(ROSTERS_INI)) return PLAYER_CACHE;
        
        var f = new File(ROSTERS_INI);
        if (!f.open("r")) return PLAYER_CACHE;
        
        var currentSection = null;
        var currentData = {};
        
        while (!f.eof) {
            var line = f.readln();
            if (!line) continue;
            line = line.trim();
            if (!line || line.charAt(0) === ";") continue;
            
            if (line.charAt(0) === "[" && line.charAt(line.length - 1) === "]") {
                // Save previous section
                if (currentSection && currentSection.indexOf(".") > 0) {
                    PLAYER_CACHE[currentSection] = currentData;
                }
                currentSection = line.substring(1, line.length - 1).toLowerCase();
                currentData = {};
                continue;
            }
            
            var eq = line.indexOf("=");
            if (eq > 0) {
                var key = line.substring(0, eq).trim();
                var val = line.substring(eq + 1).trim();
                currentData[key] = val;
            }
        }
        
        // Save last section
        if (currentSection && currentSection.indexOf(".") > 0) {
            PLAYER_CACHE[currentSection] = currentData;
        }
        
        f.close();
        return PLAYER_CACHE;
    }
    
    /**
     * Get player data by slug (e.g., "allen_iverson" -> full data object)
     */
    function getPlayerData(slug) {
        var cache = ensurePlayerCache();
        
        // Search all team.player keys for matching slug
        for (var key in cache) {
            if (!cache.hasOwnProperty(key)) continue;
            var parts = key.split(".");
            if (parts.length === 2 && parts[1] === slug) {
                var data = cache[key];
                data.teamKey = parts[0];
                data.slug = slug;
                return data;
            }
        }
        return null;
    }
    
    /**
     * Get a random player with full data (art path + stats + nicks)
     */
    function getRandomPlayerWithData() {
        var player = getRandomNBAPlayer();
        if (!player) return null;
        
        var data = getPlayerData(player.slug);
        if (data) {
            player.data = data;
            player.nick = getPlayerNick(data);
            player.team = data.player_team || data.teamKey || "Unknown";
        }
        return player;
    }
    
    /**
     * Get a short nickname for a player
     */
    function getPlayerNick(data) {
        if (!data) return "???";
        if (data.short_nicks) {
            var nicks = data.short_nicks.split(",");
            return nicks[0].trim();
        }
        if (data.player_name) {
            var parts = data.player_name.split(" ");
            return parts[parts.length - 1]; // Last name
        }
        return "???";
    }
    
    /**
     * Get a specific stat value from player data
     */
    function getPlayerStat(data, statName) {
        if (!data) return 5;
        var val = parseInt(data[statName], 10);
        return isNaN(val) ? 5 : val;
    }
    
    /**
     * Word-wrap text to fit within a given width, avoiding mid-word breaks
     */
    function wordWrap(text, maxWidth) {
        var words = text.split(" ");
        var lines = [];
        var currentLine = "";
        
        for (var i = 0; i < words.length; i++) {
            var word = words[i];
            if (currentLine.length === 0) {
                currentLine = word;
            } else if (currentLine.length + 1 + word.length <= maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }
        return lines;
    }
    
    /**
     * Find a stat-based template that matches the player's actual stats
     * For roasts: find a stat that's actually LOW (<=4)
     * For brags: find a stat that's actually HIGH (>=7)
     */
    function findAppropriateStatTemplate(templates, playerData, isRoast) {
        if (!playerData) return null;
        
        // Shuffle templates to add variety
        var shuffled = templates.slice().sort(function() { return Math.random() - 0.5; });
        
        for (var i = 0; i < shuffled.length; i++) {
            var tmpl = shuffled[i];
            var statVal = getPlayerStat(playerData, tmpl.stat);
            
            if (isRoast && statVal <= 4) {
                // Good roast - stat is actually low
                return { template: tmpl, statVal: statVal };
            } else if (!isRoast && statVal >= 7) {
                // Good brag - stat is actually high
                return { template: tmpl, statVal: statVal };
            }
        }
        return null; // No appropriate stat found
    }
    
    /**
     * Check if player2 is valid and different from player1
     */
    function hasValidPlayer2(player1, player2) {
        if (!player2) return false;
        if (!player1) return true;
        return player2.slug !== player1.slug;
    }
    
    /**
     * Generate a dynamic rumor using two players
     */
    function generateDynamicRumor(player1, player2) {
        var roll = Math.random();
        var templateText = null;
        var statVal = 5;
        var hasTwoPlayers = hasValidPlayer2(player1, player2);
        
        if (roll < 0.35) {
            // Trash talk
            if (hasTwoPlayers) {
                templateText = VERSUS_TRASH_TALK[Math.floor(Math.random() * VERSUS_TRASH_TALK.length)];
            } else {
                templateText = SOLO_TRASH_TALK[Math.floor(Math.random() * SOLO_TRASH_TALK.length)];
            }
        } else if (roll < 0.55) {
            // Compliments
            if (hasTwoPlayers) {
                templateText = VERSUS_COMPLIMENTS[Math.floor(Math.random() * VERSUS_COMPLIMENTS.length)];
            } else {
                templateText = SOLO_COMPLIMENTS[Math.floor(Math.random() * SOLO_COMPLIMENTS.length)];
            }
        } else if (roll < 0.75) {
            // Stat brag - find a HIGH stat for player1
            var bragMatch = findAppropriateStatTemplate(STAT_BRAG_TEMPLATES, player1.data, false);
            if (bragMatch) {
                templateText = bragMatch.template.text;
                statVal = bragMatch.statVal;
            } else {
                // No high stats, fall back to trash talk
                templateText = SOLO_TRASH_TALK[Math.floor(Math.random() * SOLO_TRASH_TALK.length)];
            }
        } else if (roll < 0.90) {
            // Stat roast - find a LOW stat for player2
            var roastMatch = findAppropriateStatTemplate(STAT_ROAST_TEMPLATES, player2 ? player2.data : null, true);
            if (roastMatch) {
                templateText = roastMatch.template.text;
                statVal = roastMatch.statVal;
            } else {
                // No low stats to roast, fall back to trash talk
                if (hasTwoPlayers) {
                    templateText = VERSUS_TRASH_TALK[Math.floor(Math.random() * VERSUS_TRASH_TALK.length)];
                } else {
                    templateText = SOLO_TRASH_TALK[Math.floor(Math.random() * SOLO_TRASH_TALK.length)];
                }
            }
        } else {
            // Fall back to static rumor
            return STATIC_RUMORS[Math.floor(Math.random() * STATIC_RUMORS.length)];
        }
        
        // Replace placeholders
        var rumor = templateText
            .replace(/\{name1\}/g, player1.name || "Someone")
            .replace(/\{nick1\}/g, player1.nick || player1.name || "Someone")
            .replace(/\{team1\}/g, player1.team || "their team")
            .replace(/\{name2\}/g, player2 ? (player2.name || "that guy") : "that guy")
            .replace(/\{nick2\}/g, player2 ? (player2.nick || player2.name || "that dude") : "that dude")
            .replace(/\{team2\}/g, player2 ? (player2.team || "their team") : "their team")
            .replace(/\{statVal\}/g, String(statVal));
        
        return rumor;
    }
    
    /**
     * Load art into zones (if .bin files exist)
     */
    function loadArt(view) {
        if (typeof BinLoader === "undefined") return;
        
        var headerFrame = view.getZone("header");
        if (headerFrame && file_exists(ART_HEADER)) {
            BinLoader.loadIntoFrame(headerFrame, ART_HEADER, ART_HEADER_W, ART_HEADER_H, 1, 1);
        }
        
        var artFrame = view.getZone("art");
        if (artFrame && file_exists(ART_SIDE)) {
            BinLoader.loadIntoFrame(artFrame, ART_SIDE, ART_SIDE_W, ART_SIDE_H, 1, 1);
        }
        
        view.render();
    }
    
    /**
     * Swap the art zone with a different image
     */
    function swapArt(view, artPath, width, height) {
        if (typeof BinLoader === "undefined") return;
        if (!file_exists(artPath)) return;
        
        var artFrame = view.getZone("art");
        if (artFrame) {
            artFrame.clear();
            BinLoader.loadIntoFrame(artFrame, artPath, width || ART_SIDE_W, height || ART_SIDE_H, 1, 1);
            view.render();
        }
    }
    
    /**
     * Draw info panel based on selected menu item (below menu in content zone)
     */
    function drawInfoPanel(view, itemValue) {
        var info = MENU_INFO[itemValue];
        if (!info) return;
        
        view.updateZone("content", function(frame) {
            // Draw info below menu area (starting at row 14)
            var infoStartY = 14;
            
            // Clear the info area first
            for (var y = infoStartY; y <= 19; y++) {
                frame.gotoxy(1, y);
                frame.putmsg("\1n" + repeatSpaces(38));
            }
            
            // Draw info
            frame.gotoxy(2, infoStartY);
            frame.putmsg("\1h\1c" + info.title + "\1n");
            
            for (var i = 0; i < info.lines.length && (infoStartY + 1 + i) <= 18; i++) {
                frame.gotoxy(2, infoStartY + 1 + i);
                frame.putmsg("\1w" + info.lines[i] + "\1n");
            }
        });
    }
    
    /**
     * Draw status panel in content zone
     */
    function drawStatus(view, ctx) {
        view.setContentZone("content");
        view.setCursorY(0);
        
        view.blank();
        view.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
        view.blank();
    }
    
    /**
     * Rest and recover
     */
    function rest(view, ctx) {
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        if (ctx.restUsedToday) {
            view.blank();
            view.warn("You've already rested today.");
            view.line("Come back tomorrow.");
            view.blank();
            view.info("Press any key...");
            view.render();
            console.getkey();
            return;
        }
        
        var restLine = REST_LINES[Math.floor(Math.random() * REST_LINES.length)];
        var turnsRecovered = 3;
        
        view.blank();
        view.info(restLine);
        view.blank();
        
        ctx.streetTurns = (ctx.streetTurns || 0) + turnsRecovered;
        ctx.restUsedToday = true;
        
        view.line("\1g+" + turnsRecovered + " Street Turns\1n");
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    /**
     * Display a single rumor panel with proper styling
     * @param {Object} view - RichView instance
     * @param {Object} player - Player delivering the rumor
     * @param {string} rumorText - The rumor text
     * @param {boolean} isResponse - If true, this is a response panel
     * @param {number} countdown - Optional countdown in seconds (0 = no countdown)
     */
    function showRumorPanel(view, player, rumorText, isResponse, countdown) {
        // Load player art
        if (player && player.path && typeof BinLoader !== "undefined") {
            var artFrame = view.getZone("art");
            if (artFrame) {
                artFrame.clear();
                BinLoader.loadIntoFrame(artFrame, player.path, CHAR_ART_W, CHAR_ART_H, 1, 1);
            }
        }
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        var PAD = "  ";
        var MAX_WIDTH = 34; // Leave room for padding
        
        // Header
        view.blank();
        if (player && player.name) {
            if (isResponse) {
                view.line(PAD + "\1h\1c" + player.name + "\1n \1kleans in...\1n");
            } else {
                view.line(PAD + "\1wYou spot \1h\1y" + player.name + "\1n");
                view.line(PAD + "\1wat the bar...\1n");
            }
        } else {
            view.line(PAD + "\1wYou overhear a conversation...\1n");
        }
        
        view.blank();
        view.blank();
        
        // Rumor text with word wrapping - styled as a quote
        var lines = wordWrap(rumorText, MAX_WIDTH);
        
        // Opening quote
        view.line(PAD + "\1h\1y\"\1n");
        
        // Wrapped lines
        for (var i = 0; i < lines.length; i++) {
            view.line(PAD + "\1h\1w" + lines[i] + "\1n");
        }
        
        // Closing quote  
        view.line(PAD + "\1h\1y\"\1n");
        
        view.blank();
        view.blank();
        
        // Footer with optional countdown
        if (countdown > 0) {
            view.line(PAD + "\1kPress any key or wait " + countdown + "s...\1n");
        } else {
            view.line(PAD + "\1kPress ENTER to continue...\1n");
        }
        
        view.render();
    }
    
    /**
     * Wait for keypress with optional timeout
     * @returns {boolean} true if key was pressed, false if timeout
     */
    function waitWithTimeout(seconds) {
        if (seconds <= 0) {
            // Just wait for ENTER
            var key;
            do {
                key = console.getkey();
            } while (key !== "\r" && key !== "\n");
            return true;
        }
        
        var endTime = Date.now() + (seconds * 1000);
        while (Date.now() < endTime) {
            if (console.inkey(100)) { // 100ms poll
                return true;
            }
        }
        return false;
    }
    
    /**
     * Listen for rumors - multi-panel conversation system
     */
    function listenRumors(view, ctx) {
        // Get 2-3 random players for potential conversation
        var player1 = getRandomPlayerWithData();
        var player2 = getRandomPlayerWithData();
        
        // Make sure we got at least one player
        if (!player1) {
            player1 = getRandomNBAPlayer();
        }
        
        // Avoid same player twice
        var attempts = 0;
        while (player2 && player1 && player2.slug === player1.slug && attempts < 5) {
            player2 = getRandomPlayerWithData();
            attempts++;
        }
        
        // Decide on conversation type (1-3 panels)
        var panelCount = 1;
        var roll = Math.random();
        if (roll < 0.25 && player2) {
            panelCount = 3; // Full back-and-forth
        } else if (roll < 0.50 && player2) {
            panelCount = 2; // Response
        }
        
        // Generate rumors
        var rumor1, rumor2, rumor3;
        
        if (panelCount >= 2 && player2) {
            // Dynamic conversation
            rumor1 = generateDynamicRumor(player1, player2);
            rumor2 = generateDynamicRumor(player2, player1);
            if (panelCount >= 3) {
                rumor3 = generateDynamicRumor(player1, player2);
            }
        } else {
            // Single panel - mix of static and dynamic
            if (Math.random() < 0.4 && player2) {
                rumor1 = generateDynamicRumor(player1, player2);
            } else {
                rumor1 = STATIC_RUMORS[Math.floor(Math.random() * STATIC_RUMORS.length)];
            }
        }
        
        // Panel 1
        showRumorPanel(view, player1, rumor1, false, panelCount > 1 ? 8 : 0);
        waitWithTimeout(panelCount > 1 ? 8 : 0);
        
        // Panel 2 (if applicable)
        if (panelCount >= 2 && player2 && rumor2) {
            showRumorPanel(view, player2, rumor2, true, panelCount > 2 ? 6 : 0);
            waitWithTimeout(panelCount > 2 ? 6 : 0);
        }
        
        // Panel 3 (if applicable)
        if (panelCount >= 3 && player1 && rumor3) {
            showRumorPanel(view, player1, rumor3, true, 0);
            waitWithTimeout(0);
        }
        
        // Restore the bar art
        loadArt(view);
    }
    
    /**
     * Generate a random street team for betting
     */
    function generateBettingTeam(teamName) {
        var baseStats = 5 + Math.floor(Math.random() * 3);
        
        function randStat() {
            return Math.max(3, Math.min(9, baseStats + Math.floor(Math.random() * 3) - 1));
        }
        
        return {
            name: teamName,
            abbr: teamName.substring(0, 4).toUpperCase(),
            players: [
                {
                    name: teamName.split(" ")[0] + " #1",
                    speed: randStat(), threePt: randStat(), dunks: randStat(),
                    power: randStat(), defense: randStat(), blocks: randStat(),
                    skin: ["brown", "lightgray"][Math.floor(Math.random() * 2)],
                    jersey: Math.floor(Math.random() * 99),
                    isHuman: false
                },
                {
                    name: teamName.split(" ")[0] + " #2",
                    speed: randStat(), threePt: randStat(), dunks: randStat(),
                    power: randStat(), defense: randStat(), blocks: randStat(),
                    skin: ["brown", "lightgray"][Math.floor(Math.random() * 2)],
                    jersey: Math.floor(Math.random() * 99),
                    isHuman: false
                }
            ],
            colors: null
        };
    }
    
    /**
     * Simulate a game result
     */
    function simulateGame(team1, team2) {
        var score1 = 35 + Math.floor(Math.random() * 21);
        var score2 = 35 + Math.floor(Math.random() * 21);
        while (score1 === score2) {
            score2 = 35 + Math.floor(Math.random() * 21);
        }
        return { team1: team1, team2: team2, score1: score1, score2: score2 };
    }
    
    /**
     * Betting flow - uses the same view, updates content zone
     */
    function placeBet(view, ctx) {
        // Swap to bookie art for betting view
        swapArt(view, ART_BOOKIE, ART_SIDE_W, ART_SIDE_H);
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        if ((ctx.cash || 0) < 50) {
            view.blank();
            view.warn("Minimum bet is $50.");
            view.line("You need more cash.");
            view.blank();
            view.info("Press any key...");
            view.render();
            console.getkey();
            return;
        }
        
        // Generate matchup
        var team1Names = ["Courtline Crew", "Dunk District", "Arc Angels", "Street Kings"];
        var team2Names = ["Uptown Ballers", "South Side", "West End", "Downtown Heat"];
        var team1Name = team1Names[Math.floor(Math.random() * team1Names.length)];
        var team2Name = team2Names[Math.floor(Math.random() * team2Names.length)];
        
        view.blank();
        view.header("TONIGHT'S GAME");
        view.blank();
        view.line("  \1r" + team1Name + "\1n");
        view.line("       vs");
        view.line("  \1b" + team2Name + "\1n");
        view.blank();
        view.line("Your cash: \1y$" + ctx.cash + "\1n");
        view.blank();
        
        // Team selection submenu
        var teamItems = [
            { text: "Bet on " + team1Name, value: "1", hotkey: "1" },
            { text: "Bet on " + team2Name, value: "2", hotkey: "2" },
            { text: "Back Out", value: "quit", hotkey: "Q" }
        ];
        
        var teamChoice = view.menu(teamItems, {
            y: 12,
            onSelect: function(item) {
                // Could update art zone with team info here
            }
        });
        
        if (!teamChoice || teamChoice === "quit") return;
        
        var pickedTeam = (teamChoice === "1") ? team1Name : team2Name;
        
        // Get bet amount
        view.clearZone("content");
        view.setCursorY(0);
        view.blank();
        view.header("PLACE YOUR BET");
        view.blank();
        view.line("You're backing \1h" + pickedTeam + "\1n");
        view.blank();
        view.line("Your cash: \1y$" + ctx.cash + "\1n");
        view.line("Min bet: \1y$50\1n");
        view.blank();
        
        var betStr = view.prompt("Bet amount: $");
        var betAmount = parseInt(betStr, 10);
        
        if (isNaN(betAmount) || betAmount < 50 || betAmount > ctx.cash) {
            view.warn("Invalid bet amount.");
            view.info("Press any key...");
            view.render();
            console.getkey();
            return;
        }
        
        ctx.cash -= betAmount;
        
        view.blank();
        view.line("\1yYou put $" + betAmount + " on " + pickedTeam + ".\1n");
        view.blank();
        view.info("Press any key to watch...");
        view.render();
        console.getkey();
        
        // Run or simulate game
        var gameResult = null;
        var realEngineAvailable = (typeof runExternalGame === "function");
        
        if (realEngineAvailable) {
            var team1 = generateBettingTeam(team1Name);
            var team2 = generateBettingTeam(team2Name);
            team1.colors = { fg: "WHITE", bg: "BG_RED" };
            team2.colors = { fg: "WHITE", bg: "BG_BLUE" };
            
            var config = {
                teamA: team1, teamB: team2,
                options: { gameTime: 60, mode: "spectate", showMatchupScreen: true, showGameOverScreen: false },
                lorbContext: { betting: true, betAmount: betAmount, pickedTeam: pickedTeam }
            };
            
            view.close();
            var result = runExternalGame(config);
            
            // Re-create view after game
            view = createView();
            loadArt(view);
            
            if (result && result.completed) {
                gameResult = { team1: team1Name, team2: team2Name, score1: result.score.teamA, score2: result.score.teamB };
            } else {
                gameResult = simulateGame(team1Name, team2Name);
            }
        } else {
            gameResult = simulateGame(team1Name, team2Name);
        }
        
        // Show result
        view.clearZone("content");
        view.setCursorY(0);
        view.blank();
        view.header("GAME OVER");
        view.blank();
        view.line("\1r" + team1Name + "\1n: " + gameResult.score1);
        view.line("\1b" + team2Name + "\1n: " + gameResult.score2);
        view.blank();
        
        var winner = (gameResult.score1 > gameResult.score2) ? team1Name : team2Name;
        
        if (winner === pickedTeam) {
            var winnings = betAmount * 2;
            ctx.cash += winnings;
            view.line("\1h\1g" + pickedTeam + " WINS!\1n");
            view.blank();
            view.line("You collect \1y$" + winnings + "\1n!");
        } else {
            view.line("\1h\1r" + winner + " wins.\1n");
            view.blank();
            view.line("Your $" + betAmount + " bet is gone.");
        }
        
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    /**
     * Create the Club 23 RichView
     */
    function createView() {
        return new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 41, y: 5, width: 40, height: 20 }
            ],
            theme: "lorb"
        });
    }
    
    /**
     * Run with RichView
     */
    function runRichView(ctx) {
        var view = createView();
        loadArt(view);
        
        while (true) {
            // Draw status
            view.clearZone("content");
            drawStatus(view, ctx);
            
            // Build menu
            var menuItems = [
                { text: "Rest & Recover", value: "rest", hotkey: "1", disabled: ctx.restUsedToday },
                { text: "Listen for Rumors", value: "rumors", hotkey: "2" },
                { text: "Bet on a Game", value: "bet", hotkey: "3", disabled: (ctx.cash || 0) < 50 },
                { text: "Leave", value: "leave", hotkey: "Q" }
            ];
            
            var choice = view.menu(menuItems, {
                y: 8,
                onSelect: function(item, index, richView) {
                    // Update info panel when hovering
                    drawInfoPanel(richView, item.value);
                    richView.render();
                }
            });
            
            switch (choice) {
                case "rest":
                    rest(view, ctx);
                    break;
                case "rumors":
                    listenRumors(view, ctx);
                    break;
                case "bet":
                    placeBet(view, ctx);
                    // Reload art after betting (in case we closed/recreated view)
                    loadArt(view);
                    break;
                case "leave":
                case null:
                    view.close();
                    return;
            }
        }
    }
    
    /**
     * Legacy fallback (no RichView)
     */
    function runLegacy(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("CLUB 23");
            LORB.View.line("");
            LORB.View.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
            LORB.View.line("");
            
            var restText = ctx.restUsedToday ? 
                "\1k[1] Rest (already rested)\1n" :
                "\1w[1]\1n Rest & Recover";
            
            LORB.View.line(restText);
            LORB.View.line("\1w[2]\1n Listen for Rumors");
            LORB.View.line("\1w[3]\1n Bet on a Game");
            LORB.View.line("\1w[Q]\1n Leave");
            LORB.View.line("");
            
            var choice = LORB.View.prompt("Choice: ").toUpperCase();
            
            switch (choice) {
                case "1":
                    if (!ctx.restUsedToday) {
                        var restLine = REST_LINES[Math.floor(Math.random() * REST_LINES.length)];
                        ctx.streetTurns = (ctx.streetTurns || 0) + 3;
                        ctx.restUsedToday = true;
                        LORB.View.line("\1c" + restLine + "\1n");
                        LORB.View.line("\1g+3 Street Turns\1n");
                    } else {
                        LORB.View.warn("Already rested today.");
                    }
                    console.getkey();
                    break;
                case "2":
                    var rumor = STATIC_RUMORS[Math.floor(Math.random() * STATIC_RUMORS.length)];
                    LORB.View.line("\1k\1h" + rumor + "\1n");
                    console.getkey();
                    break;
                case "3":
                    // Simplified betting for legacy
                    LORB.View.warn("Betting requires RichView.");
                    console.getkey();
                    break;
                case "Q":
                    return;
            }
        }
    }
    
    /**
     * Main entry point
     */
    function run(ctx) {
        if (RichView) {
            return runRichView(ctx);
        } else {
            return runLegacy(ctx);
        }
    }
    
    /**
     * Helper: repeat spaces
     */
    function repeatSpaces(n) {
        var s = "";
        for (var i = 0; i < n; i++) s += " ";
        return s;
    }
    
    // Export
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Club23 = {
        run: run,
        RUMORS: STATIC_RUMORS
    };
    
})();
