/**
 * club23.js - Club 23
 * 
 * The social hub of Rim City.
 * Rest, listen for rumors, and bet on AI vs AI games.
 * 
 * Uses RichView with dynamic content updates based on menu selection.
 */

// Key constants for navigation
if (typeof KEY_UP === 'undefined') var KEY_UP = '\x1e';
if (typeof KEY_DOWN === 'undefined') var KEY_DOWN = '\x1f';
if (typeof KEY_LEFT === 'undefined') var KEY_LEFT = '\x1d';
if (typeof KEY_RIGHT === 'undefined') var KEY_RIGHT = '\x1c';

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

// SpriteWanderer is loaded lazily at runtime (see getSpriteWanderer below)

(function() {
    
    var RichView = _club23RichView;
    
    // Lazy-loaded SpriteWanderer reference
    var _spriteWandererLoaded = false;
    var _spriteWandererClass = null;
    
    /**
     * Get SpriteWanderer class, loading it lazily if needed
     */
    function getSpriteWanderer() {
        if (_spriteWandererLoaded) {
            return _spriteWandererClass;
        }
        _spriteWandererLoaded = true;
        
        try {
            load("/sbbs/xtrn/nba_jam/lib/lorb/ui/sprite-wanderer.js");
            if (typeof LORB !== "undefined" && LORB.UI && LORB.UI.SpriteWanderer) {
                _spriteWandererClass = LORB.UI.SpriteWanderer;
            }
        } catch (e) {
            // SpriteWanderer is optional - continue without it
        }
        
        return _spriteWandererClass;
    }
    
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
    
    // RIVAL-specific smack talk - used when player1 and player2 are rivals
    // These are more personal/heated than regular trash talk
    var RIVAL_SMACK_TALK = [
        "{nick2} can't guard me. Never could. Never will.",
        "Tell {nick2} I said hi... and goodbye.",
        "{nick2}? Please. I OWN that matchup.",
        "They still comparing me to {nick2}? That's cute.",
        "{nick2} knows the deal. Ask about our head-to-head.",
        "Every time I see {nick2}, it's buckets. Money.",
        "{nick2} is good... but not {nick1} good.",
        "I respect {nick2}'s game... just not that much.",
        "{nick2} talks a lot for someone I always beat.",
        "Put {nick2} on me. I dare you. I BEG you.",
        "{nick2} knows what time it is. Ring check.",
        "Me and {nick2}? That rivalry made me legendary.",
        "{nick2}'s whole career is being second to me.",
        "Don't bring up {nick2}. We're not the same.",
        "{nick2} ducking me. Been ducking me for years."
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
    
    // =========================================================================
    // HUMAN PLAYER RUMORS - Based on persisted career stats from the league
    // Uses {playerName}, {statName}, {value} placeholders
    // =========================================================================
    
    // Personal record rumors - celebrating a specific player's single-game record
    var PLAYER_RECORD_RUMORS = [
        "Word on the streets is {playerName} once dropped {value} {statName} in a single game.",
        "I heard {playerName} went off for {value} {statName}. Nobody saw that coming.",
        "They still talk about that game where {playerName} got {value} {statName}.",
        "{playerName} put up {value} {statName} one night. The streets remember.",
        "Did you catch {playerName}'s {value} {statName} performance? Legendary.",
        "{playerName}'s record of {value} {statName}? That's still standing.",
        "Nobody's touched {playerName}'s {value} {statName} game yet.",
        "My boy {playerName} went nuclear - {value} {statName} in one game!"
    ];
    
    // League leader rumors - the player who leads the league in a stat
    var PLAYER_LEADER_RUMORS = [
        "Legend has it {playerName} averages {value} {statName} per game. Nobody's matched it.",
        "{playerName} is the {statName} king. {value} per game, best in the city.",
        "You want {statName}? Talk to {playerName}. {value} a game, top of the league.",
        "The {statName} leader? {playerName}, {value} per game. Not even close.",
        "{playerName} runs this city in {statName}. {value} every night.",
        "When it comes to {statName}, {playerName}'s the one to beat. {value} average.",
        "{playerName}'s got the {statName} crown locked down - {value} a game."
    ];
    
    // Career milestone rumors - impressive career totals
    var PLAYER_MILESTONE_RUMORS = [
        "{playerName} got {value} career {statName}. That's real work.",
        "They say {playerName} racked up {value} {statName} over their career.",
        "{playerName}'s been grinding - {value} total {statName} and counting.",
        "You don't get to {value} {statName} by accident. {playerName}'s legit.",
        "{playerName}'s career {statName}: {value}. Put some respect on that name."
    ];
    
    // Win/loss record rumors
    var PLAYER_RECORD_WL_RUMORS = [
        "{playerName}'s got a {value} record. That's real.",
        "Don't sleep on {playerName}. {value} wins and losses says it all.",
        "{playerName} been putting in work - {value} on the year.",
        "You seen {playerName}'s record? {value}. The streets know.",
        "{playerName} running a {value} clip. Respect."
    ];
    
    // Reputation rumors
    var PLAYER_REP_RUMORS = [
        "{playerName}'s rep is at {value}. They've earned every point.",
        "With {value} rep, {playerName}'s a known name in these streets.",
        "{playerName} built their name up to {value} rep. That's no joke.",
        "You don't get {value} rep without putting in work. Ask {playerName}."
    ];
    
    // Stat name mappings for display
    var PLAYER_STAT_DISPLAY = {
        points: "points",
        rebounds: "boards",
        assists: "dimes",
        steals: "steals",
        blocks: "blocks",
        dunks: "dunks",
        turnovers: "turnovers",
        tpm: "threes"
    };
    
    // Rest flavor text
    var REST_LINES = [
        "You grab a booth and rest your legs.",
        "The bartender slides you a water. \"On the house.\"",
        "You close your eyes for a moment. The crowd noise fades.",
        "A comfortable exhaustion settles over you.",
        "The bass thumps low as you recover your strength."
    ];
    
    /**
     * Get current club name from city data
     */
    function getCurrentClubName() {
        if (LORB.Cities && LORB.Cities.getToday) {
            var city = LORB.Cities.getToday();
            return LORB.Cities.getClubName(city);
        }
        return "Club 23"; // Fallback
    }
    
    /**
     * Get current city name for display
     */
    function getCurrentCityName() {
        if (LORB.Cities && LORB.Cities.getToday) {
            var city = LORB.Cities.getToday();
            return city ? city.cityName : "Rim City";
        }
        return "Rim City"; // Fallback
    }
    
    /**
     * Build menu info dynamically based on current city
     */
    function getMenuInfo() {
        var clubName = getCurrentClubName();
        var cityName = getCurrentCityName();
        
        return {
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
                    "Learn about the city's secrets."
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
            flirt: {
                title: "Flirt / Socialize",
                lines: [
                    "See who's hanging at the bar.",
                    "Maybe find someone special...",
                    "",
                    "3 flirt attempts per day."
                ]
            },
            restroom: {
                title: "Visit the Restroom",
                lines: [
                    "The walls are covered in years",
                    "of scribbled wisdom and insults.",
                    "",
                    "Maybe leave your mark..."
                ]
            },
            hallOfFame: {
                title: "Hall of Fame",
                lines: [
                    "The legends who conquered",
                    "Rim City and defeated",
                    "the Red Bull himself.",
                    ""
                ]
            },
            leave: {
                title: "Leave " + clubName,
                lines: [
                    "Head back out into " + cityName + ".",
                    "",
                    "The night is still young..."
                ]
            }
        };
    }
    
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
     * Check if two players are rivals based on their data.rivals array
     * Rivalry is bidirectional - if A has B listed OR B has A listed
     */
    function arePlayersRivals(player1, player2) {
        if (!player1 || !player2 || !player1.data || !player2.data) return false;
        
        // Check if player1 has player2 as a rival
        if (player1.data.rivals && player1.data.rivals.length > 0) {
            for (var i = 0; i < player1.data.rivals.length; i++) {
                var rivalKey = player1.data.rivals[i];
                // Match by slug or normalized name
                if (player2.slug === rivalKey || 
                    player2.slug.indexOf(rivalKey.split(".").pop()) !== -1) {
                    return true;
                }
            }
        }
        
        // Check if player2 has player1 as a rival (reverse)
        if (player2.data.rivals && player2.data.rivals.length > 0) {
            for (var j = 0; j < player2.data.rivals.length; j++) {
                var rivalKey2 = player2.data.rivals[j];
                if (player1.slug === rivalKey2 || 
                    player1.slug.indexOf(rivalKey2.split(".").pop()) !== -1) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Generate a dynamic rumor using two players
     * If the two players are rivals, there's a high chance of using rival-specific smack talk
     */
    function generateDynamicRumor(player1, player2) {
        var roll = Math.random();
        var templateText = null;
        var statVal = 5;
        var hasTwoPlayers = hasValidPlayer2(player1, player2);
        var isRivalMatchup = hasTwoPlayers && arePlayersRivals(player1, player2);
        
        // If these are rivals, 70% chance of using rival-specific smack talk
        if (isRivalMatchup && roll < 0.70) {
            templateText = RIVAL_SMACK_TALK[Math.floor(Math.random() * RIVAL_SMACK_TALK.length)];
        } else if (roll < 0.35) {
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
     * Generate a rumor about a real human player using their career stats.
     * Fetches player data from LORB.Persist.listPlayers() and picks an interesting stat.
     * @returns {string|null} A rumor string, or null if no eligible players found
     */
    function generatePlayerRumor() {
        // Fetch all human players from persistence
        if (!LORB.Persist || !LORB.Persist.listPlayers) {
            return null;
        }
        
        var players = LORB.Persist.listPlayers();
        if (!players || players.length === 0) {
            return null;
        }
        
        // Filter to players with at least 1 game played
        var eligible = [];
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            if (p.gamesPlayed >= 1 && p.name) {
                eligible.push(p);
            }
        }
        
        if (eligible.length === 0) {
            return null;
        }
        
        // Pick a random rumor type
        var rumorType = Math.random();
        var template, playerName, statName, value;
        
        if (rumorType < 0.30) {
            // Single-game record rumor
            var recordResult = findBestRecord(eligible);
            if (recordResult) {
                template = PLAYER_RECORD_RUMORS[Math.floor(Math.random() * PLAYER_RECORD_RUMORS.length)];
                playerName = recordResult.player.name;
                statName = PLAYER_STAT_DISPLAY[recordResult.stat] || recordResult.stat;
                value = recordResult.value;
            }
        } else if (rumorType < 0.55) {
            // League leader (per-game average) rumor
            var leaderResult = findLeagueLeader(eligible);
            if (leaderResult) {
                template = PLAYER_LEADER_RUMORS[Math.floor(Math.random() * PLAYER_LEADER_RUMORS.length)];
                playerName = leaderResult.player.name;
                statName = PLAYER_STAT_DISPLAY[leaderResult.stat] || leaderResult.stat;
                // Format to one decimal for averages
                value = leaderResult.value.toFixed(1);
            }
        } else if (rumorType < 0.70) {
            // Career milestone (total stats) rumor
            var milestoneResult = findMilestone(eligible);
            if (milestoneResult) {
                template = PLAYER_MILESTONE_RUMORS[Math.floor(Math.random() * PLAYER_MILESTONE_RUMORS.length)];
                playerName = milestoneResult.player.name;
                statName = PLAYER_STAT_DISPLAY[milestoneResult.stat] || milestoneResult.stat;
                value = milestoneResult.value;
            }
        } else if (rumorType < 0.85) {
            // Win/loss record rumor
            var wlResult = findWinLossLeader(eligible);
            if (wlResult) {
                template = PLAYER_RECORD_WL_RUMORS[Math.floor(Math.random() * PLAYER_RECORD_WL_RUMORS.length)];
                playerName = wlResult.player.name;
                statName = ""; // Not used in W/L templates
                value = wlResult.wins + "-" + wlResult.losses;
            }
        } else {
            // Rep rumor
            var repResult = findRepLeader(eligible);
            if (repResult) {
                template = PLAYER_REP_RUMORS[Math.floor(Math.random() * PLAYER_REP_RUMORS.length)];
                playerName = repResult.player.name;
                statName = ""; // Not used in rep templates
                value = repResult.rep;
            }
        }
        
        // If we couldn't find data for the selected type, fall back to any available
        if (!template || !playerName) {
            // Try W/L as a reliable fallback
            var fallback = findWinLossLeader(eligible);
            if (fallback) {
                template = PLAYER_RECORD_WL_RUMORS[Math.floor(Math.random() * PLAYER_RECORD_WL_RUMORS.length)];
                playerName = fallback.player.name;
                value = fallback.wins + "-" + fallback.losses;
            } else {
                return null;
            }
        }
        
        // Replace placeholders
        return template
            .replace(/\{playerName\}/g, playerName)
            .replace(/\{statName\}/g, statName)
            .replace(/\{value\}/g, String(value));
    }
    
    /**
     * Find the best single-game record among all players
     * Returns { player, stat, value } or null
     */
    function findBestRecord(players) {
        var statsToCheck = ["points", "rebounds", "assists", "steals", "blocks", "dunks"];
        var candidates = [];
        
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            if (!p.records) continue;
            
            for (var j = 0; j < statsToCheck.length; j++) {
                var stat = statsToCheck[j];
                if (p.records[stat] && p.records[stat].value > 0) {
                    candidates.push({
                        player: p,
                        stat: stat,
                        value: p.records[stat].value
                    });
                }
            }
        }
        
        if (candidates.length === 0) return null;
        
        // Randomly pick one (weighted towards higher values)
        candidates.sort(function(a, b) { return b.value - a.value; });
        
        // 50% chance to pick the top record, otherwise random
        if (Math.random() < 0.5 || candidates.length === 1) {
            return candidates[0];
        } else {
            return candidates[Math.floor(Math.random() * candidates.length)];
        }
    }
    
    /**
     * Find the league leader in a random stat category (per-game average)
     * Returns { player, stat, value } or null
     */
    function findLeagueLeader(players) {
        var statsToCheck = ["points", "rebounds", "assists", "steals", "blocks"];
        var stat = statsToCheck[Math.floor(Math.random() * statsToCheck.length)];
        
        var bestPlayer = null;
        var bestAvg = 0;
        
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            if (!p.careerStats || !p.careerStats.totals || p.gamesPlayed < 1) continue;
            
            var total = p.careerStats.totals[stat] || 0;
            var avg = total / p.gamesPlayed;
            
            if (avg > bestAvg) {
                bestAvg = avg;
                bestPlayer = p;
            }
        }
        
        if (!bestPlayer || bestAvg === 0) return null;
        
        return {
            player: bestPlayer,
            stat: stat,
            value: bestAvg
        };
    }
    
    /**
     * Find a player with a notable career milestone (high totals)
     * Returns { player, stat, value } or null
     */
    function findMilestone(players) {
        var statsToCheck = ["points", "rebounds", "assists", "steals", "blocks", "dunks"];
        var candidates = [];
        
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            if (!p.careerStats || !p.careerStats.totals) continue;
            
            for (var j = 0; j < statsToCheck.length; j++) {
                var stat = statsToCheck[j];
                var total = p.careerStats.totals[stat] || 0;
                
                // Only include if it's a notable amount (at least 10)
                if (total >= 10) {
                    candidates.push({
                        player: p,
                        stat: stat,
                        value: total
                    });
                }
            }
        }
        
        if (candidates.length === 0) return null;
        
        // Sort by value descending, pick from top half
        candidates.sort(function(a, b) { return b.value - a.value; });
        var topHalf = candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 2)));
        return topHalf[Math.floor(Math.random() * topHalf.length)];
    }
    
    /**
     * Find the player with the best win record
     * Returns { player, wins, losses } or null
     */
    function findWinLossLeader(players) {
        var best = null;
        var bestWins = -1;
        
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var wins = p.wins || 0;
            if (wins > bestWins) {
                bestWins = wins;
                best = p;
            }
        }
        
        if (!best || bestWins === 0) return null;
        
        return {
            player: best,
            wins: best.wins || 0,
            losses: best.losses || 0
        };
    }
    
    /**
     * Find the player with the highest rep
     * Returns { player, rep } or null
     */
    function findRepLeader(players) {
        var best = null;
        var bestRep = -1;
        
        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            var rep = p.rep || 0;
            if (rep > bestRep) {
                bestRep = rep;
                best = p;
            }
        }
        
        if (!best || bestRep === 0) return null;
        
        return {
            player: best,
            rep: bestRep
        };
    }
    
    /**
     * Load art into zones (if .bin files exist)
     * Header now uses dynamic figlet rendering based on current city's club name
     */
    function loadArt(view) {
        // Load header with dynamic figlet club name
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            loadClubHeader(headerFrame);
        }
        
        // Load side art (static for now)
        if (typeof BinLoader !== "undefined") {
            var artFrame = view.getZone("art");
            if (artFrame && file_exists(ART_SIDE)) {
                BinLoader.loadIntoFrame(artFrame, ART_SIDE, ART_SIDE_W, ART_SIDE_H, 1, 1);
            }
        }
        
        view.render();
    }
    
    /**
     * Load the club header with dynamic figlet text
     */
    function loadClubHeader(frame) {
        var clubName = getCurrentClubName();
        
        // Get team color attribute for this city
        var fgAttr = (typeof WHITE === "number") ? WHITE : 7;
        try {
            if (LORB.Cities && LORB.Cities.getToday && LORB.Cities.getTeamColors) {
                var city = LORB.Cities.getToday();
                var colors = LORB.Cities.getTeamColors(city);
                if (colors && typeof colors.fgAttr === "number") {
                    fgAttr = colors.fgAttr;
                }
            }
        } catch (e) {
            // Use default color
        }
        
        // Try figlet rendering, falls back to plain text automatically
        if (LORB.Util && LORB.Util.FigletBanner && LORB.Util.FigletBanner.renderToFrame) {
            LORB.Util.FigletBanner.renderToFrame(frame, clubName, fgAttr);
        } else {
            // Fallback: plain centered text
            frame.clear();
            var padding = Math.floor((ART_HEADER_W - clubName.length) / 2);
            frame.gotoxy(padding + 1, 2);
            frame.attr = fgAttr;
            frame.putmsg(clubName);
        }
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
        var MENU_INFO = getMenuInfo(); // Get dynamically based on current city
        var info = MENU_INFO[itemValue];
        if (!info) return;
        
        view.updateZone("content", function(frame) {
            // Draw info below menu area (menu at y=4 with 6 items means rows 4-9)
            var infoStartY = 11;
            
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
    
    // ========== ROMANCE / FLIRT SYSTEM ==========
    
    // Flirt event text templates (from Romance_Event_Text.md)
    var FLIRT_INTRO_LINES = [
        "The bass thumps through the floor as neon lights flicker overhead.",
        "{clubName} is packed and buzzing tonight.",
        "A DJ scratches something vaguely resembling music."
    ];
    
    var FLIRT_FIRST_ENCOUNTER = [
        "You spot {npcName} leaning against the bar, swirling a drink.",
        "{npcName} is here tonight--no big deal, just one of the most iconic people on the planet.",
        "You awkwardly sidle up to {npcName}. She doesn't look annoyed yet."
    ];
    
    var FLIRT_SUCCESS_LINES = [
        "You deliver the smoothest line you've managed all year.",
        "Your charm is on fire tonight. {npcName} leans closer, impressed.",
        "You and {npcName} fall into easy conversation about hoops and nightlife.",
        "You tell a story about dropping 28 in streetball. She smirks: \"Maybe you're not just talk.\""
    ];
    
    var FLIRT_NEUTRAL_LINES = [
        "You talk about basketball for a few minutes. It's fine. Not amazing.",
        "{npcName} seems mildly entertained but checks her phone once or twice.",
        "Conversation goes... okay. You didn't embarrass yourself."
    ];
    
    var FLIRT_FAIL_LINES = [
        "You attempt a joke. {npcName} blinks twice and says, \"Anyway...\"",
        "You try a pickup line you definitely shouldn't have. She grimaces.",
        "You talk for a bit, but it's clunky. Very clunky."
    ];
    
    var STATUS_ADVANCE_LINES = {
        acquaintance: ["{npcName} smiles when she sees you now. Things are warming up."],
        crush: ["She remembers your name. That's progress worth celebrating."],
        partner: ["There's a spark between you and {npcName}. Everyone else fades out."]
    };
    
    var PROPOSAL_SUCCESS_LINES = [
        "You kneel (or something vaguely like kneeling in a crowded club).\n{npcName}'s eyes widen... then soften.\n\"Yes,\" she says simply.",
        "The DJ notices and cuts the music. A spotlight hits you.\nShe accepts your proposal, and the crowd erupts in cheers."
    ];
    
    var PROPOSAL_FAIL_LINES = [
        "{npcName} looks away, conflicted.\n\"I... I'm not ready for that,\" she says quietly.",
        "{npcName} gently places a hand on your shoulder.\n\"I care about you, but not like that. Not yet.\""
    ];
    
    // Crib visit text (for pregnancy trigger scenario)
    var CRIB_OFFER_LINES = [
        "{npcName} leans close and whispers, \"Want to get out of here?\"",
        "She glances toward the exit. \"My place isn't far...\"",
        "{npcName} squeezes your hand. \"Let's go somewhere more... private.\""
    ];
    
    var CRIB_SCENE_LINES = [
        "The night passes in a blur of warmth and connection.",
        "Hours later, you're both staring at the ceiling, smiling.",
        "You wake up to sunlight and the smell of coffee brewing."
    ];
    
    var CRIB_EXIT_LINES = [
        "{npcName} walks you to the door. \"Last night was...\" She doesn't finish, just smiles.",
        "\"Come back soon,\" she says, a hint of promise in her voice.",
        "You leave feeling like something has shifted between you."
    ];
    
    /**
     * Pick a random line from an array and substitute variables
     */
    function pickLine(lines, vars) {
        if (!lines || lines.length === 0) return "";
        var line = lines[Math.floor(Math.random() * lines.length)];
        if (vars) {
            for (var key in vars) {
                if (vars.hasOwnProperty(key)) {
                    line = line.replace(new RegExp("\\{" + key + "\\}", "g"), vars[key]);
                }
            }
        }
        return line;
    }
    
    /**
     * Main flirt menu/flow
     */
    function flirt(view, ctx) {
        var Romance = LORB.Data.Romance;
        if (!Romance) {
            view.clearZone("content");
            view.setContentZone("content");
            view.warn("Romance system not loaded.");
            view.render();
            console.getkey();
            return;
        }
        
        // Initialize romance state
        Romance.initPlayerRomance(ctx);
        
        // Get current game day and reset daily flirts if needed
        var gameDay = 1;
        if (LORB.SharedState && LORB.SharedState.getGameDay) {
            gameDay = LORB.SharedState.getGameDay();
        }
        Romance.resetDailyFlirtsIfNeeded(ctx, gameDay);
        
        // Get current city
        var city = null;
        if (LORB.Cities && LORB.Cities.getToday) {
            city = LORB.Cities.getToday();
        }
        
        var clubName = getCurrentClubName();
        var vars = { clubName: clubName };
        
        while (true) {
            view.clearZone("content");
            view.setContentZone("content");
            view.setCursorY(0);
            
            var remaining = Romance.getRemainingFlirts(ctx);
            var isMarried = Romance.isMarried(ctx);
            
            // Header
            view.blank();
            view.line("\1h\1m=== Flirt / Socialize ===\1n");
            view.blank();
            view.line(pickLine(FLIRT_INTRO_LINES, vars));
            view.blank();
            
            // Status
            if (isMarried) {
                view.line("\1h\1rMarried to: \1w" + Romance.getSpouseName(ctx) + "\1n");
            }
            view.line("Flirts remaining today: \1c" + remaining + "\1n");
            view.blank();
            
            // Check for traveling companion
            var Companion = LORB.Data && LORB.Data.Companion;
            var hasCompanion = Companion && Companion.hasCompanion(ctx);
            var companionData = hasCompanion ? Companion.getCurrentCompanion(ctx) : null;
            
            // Menu
            var menuItems = [];
            
            // Companion date options at the top if they have a companion
            if (hasCompanion && companionData) {
                menuItems.push({ text: "Date " + companionData.name, value: "companion_date", hotkey: "D" });
            }
            
            menuItems.push({ text: "Look Around", value: "look", hotkey: "L" });
            
            // Can flirt if: have flirts remaining AND (not married OR no companion OR companion is not spouse)
            var canFlirtNow = remaining > 0;
            if (canFlirtNow && isMarried && hasCompanion) {
                // Married with companion - can only flirt if companion is NOT the spouse
                var spouseName = Romance.getSpouseName(ctx);
                canFlirtNow = (companionData.name !== spouseName);
            }
            
            if (canFlirtNow) {
                menuItems.push({ text: "Flirt with Someone", value: "flirt", hotkey: "F" });
            }
            
            if (isMarried) {
                menuItems.push({ text: "Think of " + Romance.getSpouseName(ctx), value: "spouse", hotkey: "T" });
            }
            menuItems.push({ text: "View Relationships", value: "rels", hotkey: "R" });
            menuItems.push({ text: "Back", value: "back", hotkey: "Q" });
            
            var choice = view.menu(menuItems, { y: 10 });
            
            switch (choice) {
                case "companion_date":
                    companionDateMenu(view, ctx, companionData);
                    break;
                case "look":
                    flirtLookAround(view, ctx, city, vars);
                    break;
                case "flirt":
                    flirtWithSomeone(view, ctx, city, vars, gameDay);
                    break;
                case "spouse":
                    flirtSpouseMessage(view, ctx);
                    break;
                case "rels":
                    flirtViewRelationships(view, ctx);
                    break;
                case "back":
                case null:
                    return;
            }
        }
    }
    
    /**
     * Look around to see who's at the club
     */
    function flirtLookAround(view, ctx, city, vars) {
        var Romance = LORB.Data.Romance;
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        view.blank();
        view.line("\1wYou scan the room...\1n");
        view.blank();
        
        if (!city || !city.bachelorettes || city.bachelorettes.length === 0) {
            view.line("The club seems empty tonight. No one catches your eye.");
        } else {
            var eligible = Romance.getEligibleNPCs(city);
            if (eligible.length === 0) {
                view.line("Everyone interesting seems to be... taken.");
            } else {
                view.line("You notice a few people:");
                view.blank();
                for (var i = 0; i < Math.min(5, eligible.length); i++) {
                    var npc = eligible[i];
                    var rel = Romance.getRelationship(ctx, npc.name);
                    var statusStr = rel ? " \1n\1w(" + Romance.getStatusDisplayName(rel.status) + ")\1n" : "";
                    var rarityColor = npc.rarity === "rare" ? "\1h\1y" : (npc.rarity === "uncommon" ? "\1h\1c" : "\1w");
                    view.line("  " + rarityColor + npc.name + "\1n" + statusStr);
                }
            }
        }
        
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    /**
     * Attempt to flirt with someone
     */
    function flirtWithSomeone(view, ctx, city, vars, gameDay) {
        var Romance = LORB.Data.Romance;
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        // Check if flirting in spouse's hometown - BUSTED!
        if (LORB.Data && LORB.Data.SpouseEvents) {
            var spouseEvent = LORB.Data.SpouseEvents.checkFlirtingEvent(ctx, city);
            if (spouseEvent) {
                // Switch to legacy view for event display
                view.close();
                LORB.Data.SpouseEvents.showEvent(spouseEvent, ctx);
                // Re-initialize RichView after event
                view = LORB.RichView.create(ctx);
                view.addZone("header", { y: 0, height: 3 });
                view.addZone("content", { y: 3, height: view.screenHeight - 3 });
                return;
            }
        }
        
        if (!city || !city.bachelorettes) {
            view.blank();
            view.warn("No one interesting is here tonight.");
            view.render();
            console.getkey();
            return;
        }
        
        var eligible = Romance.getEligibleNPCs(city);
        if (eligible.length === 0) {
            view.blank();
            view.warn("Everyone here is already spoken for.");
            view.render();
            console.getkey();
            return;
        }
        
        // Pick a random NPC weighted by rarity
        var npc = Romance.pickRandomNPC(eligible);
        vars.npcName = npc.name;
        
        // Get or create relationship
        var rel = Romance.getRelationship(ctx, npc.name);
        rel.cityId = city.id;
        rel.lastInteractionDay = gameDay;
        
        view.blank();
        
        // First encounter?
        if (rel.affection === 0) {
            view.line(pickLine(FLIRT_FIRST_ENCOUNTER, vars));
        } else {
            view.line("\1c" + npc.name + "\1n is here again. She nods in your direction.");
        }
        view.blank();
        
        // Resolve the flirt
        var result = Romance.resolveFlirt(ctx, rel);
        var oldStatus = rel.status;
        Romance.applyAffection(rel, result.affectionChange);
        var newStatus = rel.status;
        
        // Consume the flirt
        Romance.useFlirt(ctx);
        
        // Display outcome
        switch (result.outcome) {
            case "success":
                view.line("\1g" + pickLine(FLIRT_SUCCESS_LINES, vars) + "\1n");
                view.line("\1h\1g(+" + result.affectionChange + " affection)\1n");
                break;
            case "neutral":
                view.line("\1y" + pickLine(FLIRT_NEUTRAL_LINES, vars) + "\1n");
                view.line("\1y(+" + result.affectionChange + " affection)\1n");
                break;
            case "fail":
                view.line("\1r" + pickLine(FLIRT_FAIL_LINES, vars) + "\1n");
                view.line("\1h\1r(" + result.affectionChange + " affection)\1n");
                break;
        }
        
        // Status advancement?
        if (newStatus !== oldStatus && STATUS_ADVANCE_LINES[newStatus]) {
            view.blank();
            view.line("\1h\1m" + pickLine(STATUS_ADVANCE_LINES[newStatus], vars) + "\1n");
            view.line("\1mRelationship status: " + Romance.getStatusDisplayName(newStatus) + "\1n");
        }
        
        // Check for crib visit opportunity (partner+ status, successful flirt)
        // This is the pregnancy trigger point - hidden conception (Phase 1)
        // Made more noticeable with distinct visual
        if (result.outcome === "success" && Romance.shouldOfferCribVisit(rel)) {
            view.blank();
            view.line("\1h\1m--- A spark in the air ---\1n");
            view.blank();
            view.line(pickLine(CRIB_OFFER_LINES, vars));
            view.blank();
            view.line("\1h\1yY) Go with her    N) Not tonight\1n");
            view.render();
            
            var cribKey = console.getkey().toUpperCase();
            if (cribKey === "Y") {
                flirtCribVisit(view, ctx, npc, city, vars);
                return;
            } else {
                view.blank();
                view.line("\1w\"Maybe next time,\" she says with a smile.\1n");
            }
        }
        
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    /**
     * Propose marriage
     */
    function flirtPropose(view, ctx, npc, cityId, vars) {
        var Romance = LORB.Data.Romance;
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        view.blank();
        
        var result = Romance.proposeMarriage(ctx, npc.name, cityId);
        
        if (result.success) {
            view.line("\1h\1m" + pickLine(PROPOSAL_SUCCESS_LINES, vars) + "\1n");
            view.blank();
            view.line("\1h\1y*** You are now married to " + npc.name + "! ***\1n");
        } else {
            view.line("\1r" + pickLine(PROPOSAL_FAIL_LINES, vars) + "\1n");
            view.blank();
            view.line("\1w" + result.reason + "\1n");
        }
        
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    /**
     * Crib visit scene - intimate encounter that can trigger pregnancy
     * Called when a partner+ relationship has a successful flirt and agrees to "go to their place"
     * 
     * @param {Object} view - RichView instance
     * @param {Object} ctx - Player context
     * @param {Object} npc - NPC data object
     * @param {Object} city - Current city object
     * @param {Object} vars - Template variables
     */
    function flirtCribVisit(view, ctx, npc, city, vars) {
        var Romance = LORB.Data.Romance;
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        view.blank();
        
        // Scene intro
        view.line("\1h\1mYou leave " + getCurrentClubName() + " together...\1n");
        view.blank();
        view.line(pickLine(CRIB_SCENE_LINES, vars));
        view.blank();
        
        // Check for pregnancy (hidden to player - Phase 1)
        var pregnancyResult = Romance.checkForPregnancy(ctx, npc, city.id, false);
        
        // Exit scene
        view.line(pickLine(CRIB_EXIT_LINES, vars));
        view.blank();
        
        // Boost affection for the intimate moment (hidden bonus)
        var rel = Romance.getRelationship(ctx, npc.name);
        if (rel) {
            Romance.applyAffection(rel, 5); // Bonus affection
        }
        
        // Log for debugging (player doesn't see this)
        if (pregnancyResult.pregnant) {
            log(LOG_DEBUG, "[CLUB23] Pregnancy triggered for " + npc.name + " in " + city.id);
        }
        
        view.line("\1h\1g(+5 affection)\1n");
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    /**
     * View all relationships - interactive version with proposal option
     */
    function flirtViewRelationships(view, ctx) {
        var Romance = LORB.Data.Romance;
        var city = (LORB.Cities && LORB.Cities.getToday) ? LORB.Cities.getToday() : null;
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        view.blank();
        view.line("\1h\1c=== Your Relationships ===\1n");
        view.blank();
        
        var rels = Romance.getAllRelationships(ctx);
        
        if (rels.length === 0) {
            view.line("\1wYou haven't met anyone special yet.\1n");
            view.blank();
            view.info("Press any key...");
            view.render();
            console.getkey();
            return;
        }
        
        // Show relationships with numbers for selection
        var displayedRels = [];
        for (var i = 0; i < Math.min(8, rels.length); i++) {
            var r = rels[i];
            var statusColor = r.status === "spouse" ? "\1h\1m" : 
                              r.status === "partner" ? "\1h\1y" : "\1w";
            var canPropose = r.status !== "spouse" && !Romance.isMarried(ctx) && r.affection >= 50;
            var proposeHint = canPropose ? " \1h\1g[Can Propose]\1n" : "";
            view.line("  \1h" + (i + 1) + ") \1n" + statusColor + r.name + "\1n - " + 
                     Romance.getStatusDisplayName(r.status) + 
                     " (\1c" + r.affection + " affection\1n)" + proposeHint);
            displayedRels.push(r);
        }
        
        view.blank();
        
        // Check if player can propose to anyone
        var isUnmarried = !Romance.isMarried(ctx);
        if (isUnmarried) {
            view.line("\1wSelect a number to propose, or Q to go back\1n");
        } else {
            view.line("\1wYou are married to \1m" + Romance.getSpouseName(ctx) + "\1n");
            view.blank();
            view.info("Press any key...");
            view.render();
            console.getkey();
            return;
        }
        
        view.render();
        
        var key = console.getkey().toUpperCase();
        if (key === "Q" || key === "\x1b") {
            return;
        }
        
        var idx = parseInt(key, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= displayedRels.length) {
            return;
        }
        
        var selectedRel = displayedRels[idx];
        
        // Attempt proposal
        flirtAttemptProposal(view, ctx, selectedRel.name, city ? city.id : null);
    }
    
    /**
     * Attempt to propose marriage to an NPC
     */
    function flirtAttemptProposal(view, ctx, npcName, cityId) {
        var Romance = LORB.Data.Romance;
        var vars = { npcName: npcName };
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        view.blank();
        
        view.line("\1h\1mYou decide to take the leap...\1n");
        view.blank();
        
        var result = Romance.proposeMarriage(ctx, npcName, cityId);
        
        if (!result.success) {
            // Couldn't even attempt (already married, not enough affection, etc.)
            view.line("\1r" + result.reason + "\1n");
        } else if (result.accepted) {
            // Proposal accepted!
            view.line("\1h\1g" + pickLine(PROPOSAL_SUCCESS_LINES, vars) + "\1n");
            view.blank();
            view.line("\1h\1y*** You are now married to " + npcName + "! ***\1n");
        } else {
            // Proposal rejected
            view.line("\1y" + pickLine(PROPOSAL_FAIL_LINES, vars) + "\1n");
            view.blank();
            view.line("\1r(-" + result.affectionLoss + " affection)\1n");
        }
        
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    /**
     * Think of spouse (married players)
     */
    function flirtSpouseMessage(view, ctx) {
        var Romance = LORB.Data.Romance;
        var spouseName = Romance.getSpouseName(ctx);
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        view.blank();
        
        var messages = [
            "You think of " + spouseName + " and smile.",
            "A supportive message from " + spouseName + " hits your phone:\n\"Go dominate tonight.\"",
            "Before you leave, your spouse " + spouseName + " gives you a confidence boost.",
            "You check your phone--a heart emoji from " + spouseName + "."
        ];
        
        view.line("\1m" + messages[Math.floor(Math.random() * messages.length)] + "\1n");
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    // ========== TRAVELING COMPANION DATES ==========
    
    /**
     * Companion date menu - take your companion out on a date
     */
    function companionDateMenu(view, ctx, companionData) {
        var Companion = LORB.Data.Companion;
        var Config = LORB.Config;
        
        var dinnerCost = Config.TRAVELING_COMPANION.DINNER_COST;
        var clubCost = Config.TRAVELING_COMPANION.CLUB_DATE_COST;
        
        while (true) {
            view.clearZone("content");
            view.setContentZone("content");
            view.setCursorY(0);
            
            view.blank();
            view.line("\1h\1m=== Date with " + companionData.name + " ===\1n");
            view.blank();
            view.line("\1wYour special someone is here from \1y" + companionData.city + "\1n");
            view.line("\1wAffection: \1m" + companionData.affection + "%\1n");
            view.blank();
            view.line("\1wYour Cash: \1y$" + (ctx.cash || 0) + "\1n");
            view.blank();
            
            var menuItems = [
                { 
                    text: "Dinner ($" + dinnerCost + ")", 
                    value: "dinner", 
                    hotkey: "1",
                    disabled: (ctx.cash || 0) < dinnerCost
                },
                { 
                    text: "Dance at the Club ($" + clubCost + ")", 
                    value: "club", 
                    hotkey: "2",
                    disabled: (ctx.cash || 0) < clubCost
                },
                { text: "Back", value: "back", hotkey: "Q" }
            ];
            
            var choice = view.menu(menuItems, { y: 10 });
            
            switch (choice) {
                case "dinner":
                    doCompanionDinner(view, ctx, companionData);
                    // Refresh companion data after date
                    companionData = Companion.getCurrentCompanion(ctx);
                    if (!companionData) return; // Companion may have left
                    break;
                case "club":
                    doCompanionClubDate(view, ctx, companionData);
                    // Refresh companion data after date
                    companionData = Companion.getCurrentCompanion(ctx);
                    if (!companionData) return;
                    break;
                case "back":
                case null:
                    return;
            }
        }
    }
    
    /**
     * Take companion to dinner
     */
    function doCompanionDinner(view, ctx, companionData) {
        var Companion = LORB.Data.Companion;
        
        // Get current game day
        var gameDay = 1;
        if (LORB.SharedState && LORB.SharedState.getGameDay) {
            gameDay = LORB.SharedState.getGameDay();
        }
        
        var result = Companion.takeToDinner(ctx, gameDay);
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        view.blank();
        
        if (!result.success) {
            view.warn(result.message);
            view.blank();
            view.info("Press any key...");
            view.render();
            console.getkey();
            return;
        }
        
        var displayName = companionData.npcName || companionData.name || "Your companion";
        view.line("\1h\1gDinner with " + displayName + "\1n");
        view.blank();
        
        // Random dinner scenarios
        var dinnerScenes = [
            "You share a romantic candlelit dinner...",
            "The two of you laugh over appetizers and drinks.",
            "Deep conversation over a fancy meal brings you closer.",
            "You order the most expensive thing on the menu. " + displayName + " is impressed."
        ];
        view.line("\1w" + dinnerScenes[Math.floor(Math.random() * dinnerScenes.length)] + "\1n");
        view.blank();
        view.line("\1m+" + result.affectionGain + " Affection!\1n");
        view.render();
        mswait(800);
        
        // Check if intimate encounter is offered
        if (result.offersIntimacy) {
            showIntimacyOffer(view, ctx, displayName, gameDay);
        } else {
            view.blank();
            view.info("Press any key...");
            view.render();
            console.getkey();
        }
    }
    
    /**
     * Take companion dancing at the club
     */
    function doCompanionClubDate(view, ctx, companionData) {
        var Companion = LORB.Data.Companion;
        
        // Get current game day
        var gameDay = 1;
        if (LORB.SharedState && LORB.SharedState.getGameDay) {
            gameDay = LORB.SharedState.getGameDay();
        }
        
        var result = Companion.takeToClub(ctx, gameDay);
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        view.blank();
        
        if (!result.success) {
            view.warn(result.message);
            view.blank();
            view.info("Press any key...");
            view.render();
            console.getkey();
            return;
        }
        
        var displayName = companionData.npcName || companionData.name || "Your companion";
        view.line("\1h\1gDancing with " + displayName + "\1n");
        view.blank();
        
        // Random club scenarios
        var clubScenes = [
            "You tear up the dance floor together!",
            "The DJ plays your song. Perfect timing.",
            "Other patrons are jealous of your moves.",
            "You hold " + displayName + " close as a slow jam plays.",
            "VIP section opens up for you and your date."
        ];
        view.line("\1w" + clubScenes[Math.floor(Math.random() * clubScenes.length)] + "\1n");
        view.blank();
        view.line("\1m+" + result.affectionGain + " Affection!\1n");
        view.render();
        mswait(800);
        
        // Check if intimate encounter is offered (higher chance at club)
        if (result.offersIntimacy) {
            showIntimacyOffer(view, ctx, displayName, gameDay);
        } else {
            view.blank();
            view.info("Press any key...");
            view.render();
            console.getkey();
        }
    }
    
    /**
     * Show the intimacy offer prompt and handle consent
     * This is the consent step before a potential (hidden) pregnancy
     * 
     * @param {Object} view - RichView instance
     * @param {Object} ctx - Player context
     * @param {string} displayName - Companion's display name
     * @param {number} gameDay - Current game day
     */
    function showIntimacyOffer(view, ctx, displayName, gameDay) {
        var Companion = LORB.Data.Companion;
        
        view.blank();
        view.line("\1h\1m" + displayName + " leans in close...\1n");
        view.blank();
        
        // Random romantic prompts
        var intimacyPrompts = [
            "\"Want to come back to my place?\"",
            "\"The night doesn't have to end here...\"",
            "\"I'm not ready to say goodnight yet.\"",
            "\"My hotel isn't far from here...\""
        ];
        view.line("\1m" + intimacyPrompts[Math.floor(Math.random() * intimacyPrompts.length)] + "\1n");
        view.blank();
        view.line("\1h\1yY) Yes, let's go    N) Not tonight\1n");
        view.render();
        
        var key = console.getkey().toUpperCase();
        
        if (key === "Y") {
            // Player consents - show intimate scene and potentially create hidden pregnancy
            view.clearZone("content");
            view.setContentZone("content");
            view.setCursorY(0);
            view.blank();
            
            view.line("\1h\1mYou leave together...\1n");
            view.blank();
            
            // Romantic scene (tasteful, not explicit)
            var sceneLines = [
                "The city lights blur as you drive away.",
                "A bottle of wine, soft music, and good company.",
                "You spend the night together..."
            ];
            for (var i = 0; i < sceneLines.length; i++) {
                view.line("\1w" + sceneLines[i] + "\1n");
                view.render();
                mswait(600);
            }
            
            // Perform the intimate encounter (may create hidden pregnancy)
            var intimacyResult = Companion.performIntimateEncounter(ctx, gameDay);
            
            view.blank();
            view.line("\1m+" + intimacyResult.affectionGain + " Affection!\1n");
            
            // Exit scene (player doesn't know if pregnancy occurred!)
            view.blank();
            var exitLines = [
                "Morning comes too soon.",
                "\"I had a great time,\" " + displayName + " says with a smile."
            ];
            view.line("\1w" + exitLines[0] + "\1n");
            view.line("\1w" + exitLines[1] + "\1n");
            
        } else {
            // Player declines
            view.blank();
            view.line("\1w\"That's okay,\" " + displayName + " says understandingly.\1n");
            view.line("\1w\"Maybe another time.\"\1n");
        }
        
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    // ========== END ROMANCE SYSTEM ==========

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
     * Show the Hall of Fame - Interactive season-by-season champion display
     * Navigate with left/right arrows, Q to exit
     */
    function showHallOfFame(view, ctx) {
        // Load avatar library for cross-BBS avatars
        var avatar_lib = null;
        try {
            avatar_lib = load({}, 'avatar_lib.js');
        } catch (e) {
            log(LOG_DEBUG, "[CLUB23] avatar_lib not available: " + e);
        }
        
        // Read hall of fame data from persistence
        var hallOfFame = [];
        var seasonChampions = [];
        var allPlayers = [];
        var playoffBrackets = {};
        
        try {
            var lorbState = LORB.Persist.readShared("lorb.sharedState");
            if (lorbState && lorbState.hallOfFame) {
                hallOfFame = lorbState.hallOfFame;
            }
            
            var sharedState = LORB.Persist.readShared("sharedState");
            if (sharedState && sharedState.seasonChampions) {
                seasonChampions = sharedState.seasonChampions;
            }
            
            // Get all players for stats lookup
            if (LORB.Persist && LORB.Persist.listPlayers) {
                allPlayers = LORB.Persist.listPlayers() || [];
            }
            
            // Get playoff brackets for additional season data
            playoffBrackets = LORB.Persist.readShared("playoffBrackets") || {};
        } catch (e) {
            log(LOG_WARNING, "[CLUB23] Error reading hall of fame: " + e);
        }
        
        // Build enriched display entries
        var displayEntries = buildHallOfFameEntries(hallOfFame, seasonChampions, allPlayers, playoffBrackets);
        
        // No champions yet
        if (displayEntries.length === 0) {
            showEmptyHallOfFame(view);
            return;
        }
        
        // Interactive navigation
        var currentIndex = 0;
        
        while (true) {
            var entry = displayEntries[currentIndex];
            
            // Render the current champion
            renderHallOfFameChampion(view, entry, currentIndex, displayEntries.length, avatar_lib);
            
            // Get user input
            var key = console.getkey();
            
            if (key === "q" || key === "Q" || key === "\x1B") {
                // Exit
                break;
            } else if (key === KEY_LEFT || key === "[" || key === ",") {
                // Previous champion
                currentIndex--;
                if (currentIndex < 0) currentIndex = displayEntries.length - 1;
            } else if (key === KEY_RIGHT || key === "]" || key === ".") {
                // Next champion
                currentIndex++;
                if (currentIndex >= displayEntries.length) currentIndex = 0;
            }
        }
    }
    
    /**
     * Build enriched hall of fame entries with player stats
     */
    function buildHallOfFameEntries(hallOfFame, seasonChampions, allPlayers, playoffBrackets) {
        var displayEntries = [];
        var seenSeasons = {};
        
        // Create a lookup map for players by globalId or name
        var playerLookup = {};
        for (var pi = 0; pi < allPlayers.length; pi++) {
            var p = allPlayers[pi];
            if (p.globalId) playerLookup[p.globalId] = p;
            if (p.name) playerLookup[p.name.toLowerCase()] = p;
        }
        
        // Process hall of fame entries (playoff champions)
        for (var i = 0; i < hallOfFame.length; i++) {
            var hof = hallOfFame[i];
            if (!hof.championName || !hof.championId) continue;
            
            // Look up player data
            var playerData = playerLookup[hof.championId] || 
                             playerLookup[(hof.championName || "").toLowerCase()] || null;
            
            // Try to get season stats from playoff bracket
            var bracketData = playoffBrackets[hof.seasonNumber] || null;
            var seedData = null;
            if (bracketData && bracketData.seeds) {
                for (var si = 0; si < bracketData.seeds.length; si++) {
                    if (bracketData.seeds[si].playerId === hof.championId) {
                        seedData = bracketData.seeds[si];
                        break;
                    }
                }
            }
            
            displayEntries.push({
                seasonNumber: hof.seasonNumber || 0,
                name: hof.championName,
                championId: hof.championId,
                defeatedJordan: hof.defeatedJordan || false,
                timestamp: hof.timestamp,
                date: hof.date || null,
                playerData: playerData,
                seedData: seedData,
                bracketData: bracketData
            });
            seenSeasons[hof.seasonNumber] = true;
        }
        
        // Add season champions not already in hall of fame
        for (var j = 0; j < seasonChampions.length; j++) {
            var sc = seasonChampions[j];
            if (seenSeasons[sc.seasonNumber]) continue;
            if (!sc.championId || !sc.championName) continue;
            if (sc.championName.indexOf("Season") === 0 || sc.championName.indexOf("Reset") !== -1) continue;
            if (sc.championName.indexOf("End") !== -1) continue;
            
            var playerData2 = playerLookup[sc.championId] || 
                              playerLookup[(sc.championName || "").toLowerCase()] || null;
            
            var bracketData2 = playoffBrackets[sc.seasonNumber] || null;
            
            displayEntries.push({
                seasonNumber: sc.seasonNumber || 0,
                name: sc.championName,
                championId: sc.championId,
                defeatedJordan: false,
                timestamp: sc.timestamp,
                date: null,
                playerData: playerData2,
                seedData: null,
                bracketData: bracketData2
            });
            seenSeasons[sc.seasonNumber] = true;
        }
        
        // Sort by season descending (newest first)
        displayEntries.sort(function(a, b) {
            return (b.seasonNumber || 0) - (a.seasonNumber || 0);
        });
        
        return displayEntries;
    }
    
    /**
     * Show empty hall of fame message
     */
    function showEmptyHallOfFame(view) {
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        view.line("  \1h\1y=== HALL OF FAME ===\1n");
        view.blank();
        view.blank();
        view.line("  \1wNo champions yet...\1n");
        view.blank();
        view.line("  \1wWill YOU be the first to\1n");
        view.line("  \1wdefeat the Red Bull?\1n");
        view.blank();
        view.blank();
        view.line("  \1kThe legends of Rim City\1n");
        view.line("  \1kawait their first hero.\1n");
        view.blank();
        view.blank();
        view.info("[Q] Back");
        view.render();
        
        while (true) {
            var key = console.getkey();
            if (key === "q" || key === "Q" || key === "\x1B") break;
        }
    }
    
    /**
     * Render a single champion in the Hall of Fame view
     */
    function renderHallOfFameChampion(view, entry, index, total, avatar_lib) {
        var contentFrame = view.getZone("content");
        if (!contentFrame) return;
        
        view.clearZone("content");
        contentFrame.gotoxy(1, 1);
        
        var w = 38; // Content zone width
        var NBA_JAM_ROOT = "/sbbs/xtrn/nba_jam/";
        
        // === HEADER ===
        contentFrame.putmsg(" \1h\1y=== HALL OF FAME ===\1n\r\n");
        
        // Champion title line
        var titleColor = entry.defeatedJordan ? "\1h\1r" : "\1h\1y";
        contentFrame.putmsg(" " + titleColor + entry.name + "\1n\r\n");
        contentFrame.putmsg(" \1cSeason " + entry.seasonNumber + " Champion\1n\r\n");
        
        // Show Red Bull defeat status
        if (entry.defeatedJordan) {
            contentFrame.putmsg(" \1h\1r* \1gDefeated the Red Bull! \1r*\1n\r\n");
        } else {
            contentFrame.putmsg("\r\n");
        }
        
        // === BODY: Avatar and/or Sprite ===
        var avatarRendered = false;
        var spriteRendered = false;
        
        // Try to render Synchronet avatar first
        if (avatar_lib && entry.playerData) {
            try {
                avatarRendered = renderChampionAvatar(contentFrame, entry, avatar_lib, 2, 5);
            } catch (e) {
                log(LOG_DEBUG, "[CLUB23] Avatar render error: " + e);
            }
        }
        
        // Render player sprite (to the right of avatar, or centered if no avatar)
        if (entry.playerData && entry.playerData.appearance) {
            var spriteX = avatarRendered ? 16 : 6;
            var spriteY = 5;
            try {
                spriteRendered = renderChampionSprite(contentFrame, entry.playerData, spriteX, spriteY);
            } catch (e) {
                log(LOG_DEBUG, "[CLUB23] Sprite render error: " + e);
            }
        }
        
        // Fallback if neither rendered
        if (!avatarRendered && !spriteRendered) {
            contentFrame.gotoxy(3, 6);
            contentFrame.putmsg("\1h\1y*\1n \1wChampion\1n \1h\1y*\1n");
            contentFrame.gotoxy(3, 7);
            contentFrame.putmsg("   \1c" + entry.name + "\1n");
        }
        
        // === STATS SECTION (bottom of frame) ===
        var statsY = 11;
        contentFrame.gotoxy(1, statsY);
        contentFrame.putmsg(" \1h\1c--- Season Stats ---\1n\r\n");
        statsY++;
        
        if (entry.playerData) {
            var pd = entry.playerData;
            
            // W-L Record
            var wins = pd.wins || 0;
            var losses = pd.losses || 0;
            contentFrame.gotoxy(2, statsY);
            contentFrame.putmsg("\1wRecord:\1n \1g" + wins + "W\1n-\1r" + losses + "L\1n");
            statsY++;
            
            // Rep earned
            var rep = pd.rep || 0;
            contentFrame.gotoxy(2, statsY);
            contentFrame.putmsg("\1wRep:\1n \1c" + rep + "\1n");
            
            // Seed if available
            if (entry.seedData && entry.seedData.seed) {
                contentFrame.putmsg("  \1wSeed:\1n #\1y" + entry.seedData.seed + "\1n");
            }
            statsY++;
            
            // Career averages if available
            if (pd.careerStats && pd.careerStats.gamesPlayed > 0) {
                var games = pd.careerStats.gamesPlayed;
                var totals = pd.careerStats.totals || {};
                var ppg = ((totals.points || 0) / games).toFixed(1);
                var rpg = ((totals.rebounds || 0) / games).toFixed(1);
                var apg = ((totals.assists || 0) / games).toFixed(1);
                
                statsY++;
                contentFrame.gotoxy(2, statsY);
                contentFrame.putmsg("\1wPPG:\1n \1h\1w" + ppg + "\1n");
                contentFrame.gotoxy(14, statsY);
                contentFrame.putmsg("\1wRPG:\1n \1h\1w" + rpg + "\1n");
                contentFrame.gotoxy(26, statsY);
                contentFrame.putmsg("\1wAPG:\1n \1h\1w" + apg + "\1n");
                statsY++;
                
                var spg = ((totals.steals || 0) / games).toFixed(1);
                var bpg = ((totals.blocks || 0) / games).toFixed(1);
                var dpg = ((totals.dunks || 0) / games).toFixed(1);
                
                contentFrame.gotoxy(2, statsY);
                contentFrame.putmsg("\1wSPG:\1n \1h\1w" + spg + "\1n");
                contentFrame.gotoxy(14, statsY);
                contentFrame.putmsg("\1wBPG:\1n \1h\1w" + bpg + "\1n");
                contentFrame.gotoxy(26, statsY);
                contentFrame.putmsg("\1wDNK:\1n \1h\1w" + dpg + "\1n");
            } else {
                statsY++;
                contentFrame.gotoxy(2, statsY);
                contentFrame.putmsg("\1k(Stats from this era lost)\1n");
            }
        } else {
            contentFrame.gotoxy(2, statsY);
            contentFrame.putmsg("\1k(Champion data unavailable)\1n");
        }
        
        // === FOOTER ===
        var footerY = 17;
        
        // Defeated Jordan banner
        if (entry.defeatedJordan) {
            contentFrame.gotoxy(1, footerY);
            contentFrame.putmsg("\r\n");
            contentFrame.putmsg(" \1h\1r*** DEFEATED THE RED BULL! ***\1n\r\n");
        } else {
            contentFrame.gotoxy(1, footerY);
            contentFrame.putmsg("\r\n");
            contentFrame.putmsg(" \1kFaced the Red Bull...\1n\r\n");
        }
        
        // Navigation hint
        contentFrame.putmsg("\r\n");
        var navHint = " \1w[\1h\1c<\1n\1w/\1h\1c>\1n\1w] Prev/Next";
        if (total > 1) {
            navHint += "  \1k(" + (index + 1) + "/" + total + ")";
        }
        navHint += "  \1w[\1h\1cQ\1n\1w] Back\1n";
        contentFrame.putmsg(navHint);
        
        view.render();
    }
    
    /**
     * Render Synchronet avatar for a champion (cross-BBS support via QWK ID)
     * Returns true if avatar was rendered
     */
    function renderChampionAvatar(frame, entry, avatar_lib, x, y) {
        if (!avatar_lib || !avatar_lib.read) return false;
        
        var playerData = entry.playerData;
        if (!playerData) return false;
        
        // Use the Synchronet user handle (not the LORB character name) for avatar lookup
        var userHandle = playerData.userHandle || null;
        if (!userHandle) {
            log(LOG_DEBUG, "[CLUB23] No userHandle for avatar lookup: " + entry.name);
            return false;
        }
        
        // Get QWK ID directly from player data, or try to derive from bbsName
        var qwkId = playerData.bbsId || null;
        if (!qwkId && playerData.bbsName) {
            qwkId = getQwkIdFromBbsName(playerData.bbsName);
        }
        
        var avatar = null;
        
        try {
            // Try local first (usernum 0 means check by name)
            avatar = avatar_lib.read(0, userHandle, null, null);
            
            // If no local avatar and we have a QWK ID, try network lookup
            if ((!avatar || !avatar.data) && qwkId) {
                avatar = avatar_lib.read(0, userHandle, qwkId, null);
            }
            
            // Also try with the LORB character name as fallback
            if ((!avatar || !avatar.data) && entry.name && entry.name !== userHandle) {
                avatar = avatar_lib.read(0, entry.name, qwkId, null);
            }
        } catch (e) {
            log(LOG_DEBUG, "[CLUB23] Avatar lookup error for " + userHandle + ": " + e);
            return false;
        }
        
        if (!avatar || !avatar.data || avatar.disabled) {
            log(LOG_DEBUG, "[CLUB23] No avatar found for " + userHandle + " (qwkId=" + qwkId + ")");
            return false;
        }
        
        // Decode and render
        try {
            var binData = base64_decode(avatar.data);
            if (!binData || binData.length < 120) return false; // 10x6x2 = 120 bytes
            
            var avatarW = avatar_lib.defs ? avatar_lib.defs.width : 10;
            var avatarH = avatar_lib.defs ? avatar_lib.defs.height : 6;
            
            // Blit avatar to frame
            var offset = 0;
            for (var row = 0; row < avatarH; row++) {
                for (var col = 0; col < avatarW; col++) {
                    if (offset + 1 >= binData.length) break;
                    var ch = binData.substr(offset, 1);
                    var attr = binData.charCodeAt(offset + 1);
                    frame.setData(x + col - 1, y + row - 1, ch, attr, false);
                    offset += 2;
                }
            }
            log(LOG_DEBUG, "[CLUB23] Avatar rendered for " + userHandle);
            return true;
        } catch (e) {
            log(LOG_DEBUG, "[CLUB23] Avatar blit error: " + e);
            return false;
        }
    }
    
    /**
     * Map BBS name to QWK ID for network avatar lookup
     * This is a fallback - prefer using _bbsId directly from player data
     */
    function getQwkIdFromBbsName(bbsName) {
        if (!bbsName) return null;
        var name = bbsName.toUpperCase();
        
        // Common dovenet/QWK IDs and their variations
        var knownBbses = {
            "VERT": "VERT",
            "VERTRAUEN": "VERT",
            "DOVE": "DOVE",
            "DOVENET": "DOVE",
            "FUTURE": "FUTURELD",
            "FUTURELAND": "FUTURELD",
            "FUTURELD": "FUTURELD",
            "AGENCY": "AGENCY",
            "THEAGENCY": "AGENCY",
            "SYNCHRONET": "SYNC",
            "SBBS": "SBBS"
        };
        
        for (var key in knownBbses) {
            if (name.indexOf(key) !== -1) {
                return knownBbses[key];
            }
        }
        
        // Try extracting from domain name (e.g., "futureland.today" -> "FUTURELAND")
        var domainMatch = bbsName.match(/^([a-zA-Z0-9]+)\./);
        if (domainMatch && domainMatch[1].length <= 8) {
            return domainMatch[1].toUpperCase();
        }
        
        // Try using the first word as QWK ID (common pattern)
        var words = bbsName.split(/\s+/);
        if (words[0] && words[0].length <= 8) {
            return words[0].toUpperCase();
        }
        
        return null;
    }
    
    /**
     * Render player sprite for a champion
     * Returns true if sprite was rendered
     */
    function renderChampionSprite(frame, playerData, x, y) {
        if (!playerData || !playerData.appearance) return false;
        if (typeof BinLoader === "undefined") return false;
        
        var NBA_JAM_ROOT = "/sbbs/xtrn/nba_jam/";
        var SPRITE_WIDTH = 5;
        var SPRITE_HEIGHT = 4;
        
        try {
            var skin = (playerData.appearance.skin || "brown").toLowerCase();
            var binPath = NBA_JAM_ROOT + "sprites/player-" + skin + ".bin";
            
            var binData = BinLoader.loadBinFile(binPath);
            if (!binData) return false;
            
            // Parse and render sprite
            var offset = 0;
            for (var row = 0; row < SPRITE_HEIGHT; row++) {
                for (var col = 0; col < SPRITE_WIDTH; col++) {
                    if (offset + 1 >= binData.length) break;
                    var ch = binData.substr(offset, 1);
                    var attr = ascii(binData.substr(offset + 1, 1));
                    
                    // Apply jersey color mask if needed
                    frame.setData(x + col - 1, y + row - 1, ch, attr, false);
                    offset += 2;
                }
            }
            
            // Render nametag below sprite
            var nickname = playerData.nickname || playerData.name || "";
            if (nickname) {
                var nameLen = Math.min(nickname.length, 8);
                var nameX = x + Math.floor((SPRITE_WIDTH - nameLen) / 2);
                
                var nametagFg = "\1h\1w";
                if (playerData.appearance.nametagFg) {
                    nametagFg = getNametagColor(playerData.appearance.nametagFg);
                }
                
                frame.gotoxy(nameX, y + SPRITE_HEIGHT);
                frame.putmsg(nametagFg + nickname.substring(0, 8) + "\1n");
            }
            
            return true;
        } catch (e) {
            log(LOG_DEBUG, "[CLUB23] Sprite render error: " + e);
            return false;
        }
    }
    
    /**
     * Get ANSI color code from color name for nametags
     */
    function getNametagColor(colorName) {
        if (!colorName) return "\1h\1w";
        var map = {
            "WHITE": "\1h\1w", "BLACK": "\1k", "RED": "\1r", "LIGHTRED": "\1h\1r",
            "GREEN": "\1g", "LIGHTGREEN": "\1h\1g", "BLUE": "\1b", "LIGHTBLUE": "\1h\1b",
            "CYAN": "\1c", "LIGHTCYAN": "\1h\1c", "MAGENTA": "\1m", "LIGHTMAGENTA": "\1h\1m",
            "BROWN": "\1y", "YELLOW": "\1h\1y", "LIGHTGRAY": "\1w", "DARKGRAY": "\1h\1k"
        };
        return map[colorName.toUpperCase()] || "\1h\1w";
    }
    
    /**
     * Visit the restroom - view and write graffiti
     */
    function visitRestroom(view, ctx) {
        var maxLines = (LORB.Config && LORB.Config.MAX_GRAFFITI_LINES) || 3;
        var maxLineLen = (LORB.Config && LORB.Config.GRAFFITI_LINE_LENGTH) || 60;
        var pageSize = 5; // Entries per page
        var currentPage = 0;
        
        while (true) {
            // Read graffiti entries
            var entries = LORB.Persist.readGraffiti();
            var totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
            if (currentPage >= totalPages) currentPage = totalPages - 1;
            
            view.clearZone("content");
            view.setContentZone("content");
            view.setCursorY(0);
            
            view.line("  \1h\1c=== RESTROOM GRAFFITI ===\1n");
            view.blank();
            
            if (entries.length === 0) {
                view.line("  \1wThe walls are surprisingly clean...\1n");
                view.line("  \1wBe the first to leave your mark.\1n");
            } else {
                // Display entries for current page
                var startIdx = currentPage * pageSize;
                var endIdx = Math.min(startIdx + pageSize, entries.length);
                
                for (var i = startIdx; i < endIdx; i++) {
                    var entry = entries[i];
                    // Author line with date
                    var dateStr = formatGraffitiDate(entry.timestamp);
                    view.line("  \1n\1m" + (entry.author || "Anonymous") + "\1n \1w(" + dateStr + ")\1n");
                    
                    // Graffiti lines
                    for (var j = 0; j < entry.lines.length; j++) {
                        var color = getGraffitiColor(i + j); // Vary colors
                        view.line("  " + color + entry.lines[j] + "\1n");
                    }
                    view.blank();
                }
                
                // Page indicator
                view.line("  \1wPage " + (currentPage + 1) + "/" + totalPages + "\1n");
            }
            
            // Navigation footer
            view.setCursorY(18);
            var navLine = "\1c[\1hW\1n\1c]\1wWrite";
            if (currentPage > 0) navLine += " \1c[\1h<\1n\1c]\1wPrev";
            if (currentPage < totalPages - 1) navLine += " \1c[\1h>\1n\1c]\1wNext";
            navLine += " \1c[\1hQ\1n\1c]\1wLeave\1n";
            view.line(navLine);
            
            view.render();
            
            // Get input
            var key = console.getkey(K_NOECHO);
            
            if (key === KEY_LEFT || key === "," || key === "<" || key === "[") {
                if (currentPage > 0) currentPage--;
            } else if (key === KEY_RIGHT || key === "." || key === ">" || key === "]") {
                if (currentPage < totalPages - 1) currentPage++;
            } else if (key === "w" || key === "W") {
                writeGraffiti(view, ctx, maxLines, maxLineLen);
            } else if (key === "q" || key === "Q" || key === "\x1b") {
                break;
            }
        }
    }
    
    /**
     * Write graffiti on the wall
     */
    function writeGraffiti(view, ctx, maxLines, maxLineLen) {
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        view.line("  \1h\1cSCRAWL YOUR MESSAGE\1n");
        view.blank();
        view.line("  \1wYou find a marker and an empty spot.\1n");
        view.line("  \1wUp to " + maxLines + " lines, " + maxLineLen + " chars each.\1n");
        view.line("  \1wLeave a line empty to finish.\1n");
        view.blank();
        
        var lines = [];
        
        for (var i = 0; i < maxLines; i++) {
            view.line("  \1yLine " + (i + 1) + ":\1n ");
            view.render();
            
            // Use console.getstr for input - set fg color to cyan for visibility
            console.cleartoeol();
            console.print("\1h\1c");
            var line = console.getstr(maxLineLen);
            console.print("\1n");
            
            if (!line || line.length === 0) {
                break; // Empty line = done
            }
            lines.push(line);
            
            // Redraw to show the line
            view.clearZone("content");
            view.setContentZone("content");
            view.setCursorY(0);
            
            view.line("  \1h\1cSCRAWL YOUR MESSAGE\1n");
            view.blank();
            view.line("  \1wYou find a marker and an empty spot.\1n");
            view.line("  \1wUp to " + maxLines + " lines, " + maxLineLen + " chars each.\1n");
            view.line("  \1wLeave a line empty to finish.\1n");
            view.blank();
            
            // Show what's been written so far
            for (var j = 0; j <= i; j++) {
                view.line("  \1g" + lines[j] + "\1n");
            }
        }
        
        if (lines.length === 0) {
            view.blank();
            view.warn("Nothing written. The marker was dry anyway.");
            view.info("Press any key...");
            view.render();
            console.getkey();
            return;
        }
        
        // Confirm
        view.blank();
        view.line("  \1wLeave this on the wall?\1n");
        view.line("  \1c[\1hY\1n\1c]\1wYes  \1c[\1hN\1n\1c]\1wNo\1n");
        view.render();
        
        var confirm = console.getkey(K_NOECHO);
        if (confirm === "y" || confirm === "Y") {
            if (LORB.Persist.addGraffiti(ctx, lines)) {
                view.blank();
                view.line("  \1gYour mark is left on the wall.\1n");
            } else {
                view.blank();
                view.warn("Someone wiped it off. Try again later.");
            }
        } else {
            view.blank();
            view.line("  \1wYou put the marker back.\1n");
        }
        
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    /**
     * Format timestamp for graffiti display
     */
    function formatGraffitiDate(timestamp) {
        if (!timestamp) return "???";
        var d = new Date(timestamp);
        var month = d.getMonth() + 1;
        var day = d.getDate();
        return month + "/" + day;
    }
    
    /**
     * Get a color code for graffiti variety
     */
    function getGraffitiColor(index) {
        var colors = [
            "\1h\1r", // bright red
            "\1h\1g", // bright green
            "\1h\1y", // bright yellow
            "\1h\1b", // bright blue
            "\1h\1m", // bright magenta
            "\1h\1c", // bright cyan
            "\1h\1w", // bright white
            "\1n\1r", // red
            "\1n\1g", // green
            "\1n\1y"  // yellow/brown
        ];
        return colors[index % colors.length];
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
                view.line(PAD + "\1h\1c" + player.name + "\1n \1wleans in...\1n");
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
            view.line(PAD + "\1wPress any key or wait " + countdown + "s...\1n");
        } else {
            view.line(PAD + "\1wPress ENTER to continue...\1n");
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
            // Single panel - mix of player rumors, dynamic, and static
            var rumorRoll = Math.random();
            
            // 35% chance: Human player rumor (career stats, records, etc.)
            if (rumorRoll < 0.35) {
                rumor1 = generatePlayerRumor();
            }
            
            // 30% chance (or fallback): Dynamic NBA player rumor
            if (!rumor1 && rumorRoll < 0.65 && player2) {
                rumor1 = generateDynamicRumor(player1, player2);
            }
            
            // Remaining: Static rumor (fallback)
            if (!rumor1) {
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
     * Ensure daily matchups are generated for current day
     */
    function ensureDailyMatchups(ctx) {
        var currentDay = ctx.day || 1;
        
        // Check if we need to generate new matchups
        if (!ctx.dailyBetting || ctx.dailyBetting.day !== currentDay) {
            ctx.dailyBetting = {
                day: currentDay,
                matchups: LORB.Betting.generateDailyMatchups(currentDay),
                wagers: [],    // Array of wagers placed today
                resolved: false
            };
        }
        
        return ctx.dailyBetting;
    }
    
    /**
     * Count wagers placed today
     */
    function countTodaysWagers(ctx) {
        if (!ctx.dailyBetting || !ctx.dailyBetting.wagers) return 0;
        return ctx.dailyBetting.wagers.length;
    }
    
    /**
     * Check if player has already bet on a specific game
     */
    function hasWageredOnGame(ctx, gameId) {
        if (!ctx.dailyBetting || !ctx.dailyBetting.wagers) return false;
        for (var i = 0; i < ctx.dailyBetting.wagers.length; i++) {
            if (ctx.dailyBetting.wagers[i].gameId === gameId) return true;
        }
        return false;
    }
    
    /**
     * Get player's wager on a specific game
     */
    function getWagerOnGame(ctx, gameId) {
        if (!ctx.dailyBetting || !ctx.dailyBetting.wagers) return null;
        for (var i = 0; i < ctx.dailyBetting.wagers.length; i++) {
            if (ctx.dailyBetting.wagers[i].gameId === gameId) {
                return ctx.dailyBetting.wagers[i];
            }
        }
        return null;
    }
    
    /**
     * Betting flow - browse games and place bets
     */
    function placeBet(view, ctx) {
        // Swap to bookie art for betting view
        swapArt(view, ART_BOOKIE, ART_SIDE_W, ART_SIDE_H);
        
        var minWager = (LORB.Config && LORB.Config.BETTING_MIN_WAGER) || 50;
        var maxWager = (LORB.Config && LORB.Config.BETTING_MAX_WAGER) || 1000;
        
        // Check minimum cash
        if ((ctx.cash || 0) < minWager) {
            view.clearZone("content");
            view.setContentZone("content");
            view.setCursorY(0);
            view.blank();
            view.warn("Minimum bet is $" + minWager + ".");
            view.line("You need more cash.");
            view.blank();
            view.info("Press any key...");
            view.render();
            console.getkey();
            return;
        }
        
        // Ensure matchups exist for today
        var betting = ensureDailyMatchups(ctx);
        var matchups = betting.matchups;
        
        if (!matchups || matchups.length === 0) {
            view.clearZone("content");
            view.setContentZone("content");
            view.setCursorY(0);
            view.blank();
            view.warn("No games scheduled today.");
            view.info("Press any key...");
            view.render();
            console.getkey();
            return;
        }
        
        // Game browser loop
        var currentIndex = 0;
        // Column widths: 40 char zone, split into 19 + 2 gap + 19
        var COL_WIDTH = 19;
        
        while (true) {
            var game = matchups[currentIndex];
            var alreadyBet = hasWageredOnGame(ctx, game.id);
            
            // Get team color codes from game data
            var team1Color = getTeamColorCode(game.team1.colors);
            var team2Color = getTeamColorCode(game.team2.colors);
            
            // Draw game info
            view.clearZone("content");
            view.setContentZone("content");
            view.setCursorY(0);
            
            // Header line 1: Title and game count
            view.line("\1h\1cTONIGHT'S GAMES\1n  \1w(" + (currentIndex + 1) + "/" + matchups.length + ")\1n");
            // Header line 2: Cash display (green label, light green value)
            view.line("\1gCash:\1n \1h\1g$" + (ctx.cash || 0) + "\1n");
            view.blank();
            
            // Centered matchup line: "DET vs PHX"
            var matchupLine = team1Color + game.team1.abbr + "\1n \1h\1kvs\1n " + team2Color + game.team2.abbr + "\1n";
            view.line("              " + matchupLine);
            view.blank();
            
            // Two-column player display (19 chars each with 2 char gap)
            var t1p1 = truncateName(game.team1.players[0].name, COL_WIDTH);
            var t1p2 = truncateName(game.team1.players[1].name, COL_WIDTH);
            var t2p1 = truncateName(game.team2.players[0].name, COL_WIDTH);
            var t2p2 = truncateName(game.team2.players[1].name, COL_WIDTH);
            
            // Player rows with proper column spacing
            view.line(team1Color + padRight(t1p1, COL_WIDTH) + "\1n " + team2Color + t2p1 + "\1n");
            view.line(team1Color + padRight(t1p2, COL_WIDTH) + "\1n " + team2Color + t2p2 + "\1n");
            view.blank();
            
            // Betting lines in two columns under each team
            var odds = game.odds;
            var spread = game.spread;
            var favLine = "-" + spread.spread;
            var dogLine = "+" + spread.spread;
            
            // Moneyline row
            var ml1 = LORB.Betting.formatOdds(odds.team1);
            var ml2 = LORB.Betting.formatOdds(odds.team2);
            view.line(team1Color + padRight("ML " + ml1, COL_WIDTH) + "\1n " + team2Color + "ML " + ml2 + "\1n");
            
            // Spread row
            var sp1 = spread.favorite === "team1" ? favLine : dogLine;
            var sp2 = spread.favorite === "team2" ? favLine : dogLine;
            view.line(team1Color + padRight("Spread " + sp1, COL_WIDTH) + "\1n " + team2Color + "Spread " + sp2 + "\1n");
            view.blank();
            
            // Over/Under centered
            view.line("         \1wO/U:\1n \1h\1y" + game.total + "\1n \1wpoints\1n");
            view.blank();
            
            // Status line
            if (alreadyBet) {
                var existingWager = getWagerOnGame(ctx, game.id);
                view.line("\1h\1y* Already wagered on this game\1n");
                if (existingWager) {
                    view.line("\1w  $" + existingWager.amount + " on " + existingWager.type + "\1n");
                }
            } else {
                view.line("\1h\1yPress B to bet on this game\1n");
            }
            
            // Navigation footer at bottom of content zone (line 18 of 20)
            view.setCursorY(18);
            view.line("\1c[\1h<\1n\1c]\1wPrev \1c[\1h>\1n\1c]\1wNext \1c[\1hB\1n\1c]\1wBet \1c[\1hQ\1n\1c]\1wExit\1n");
            
            view.render();
            
            // Get input
            var key = console.getkey(K_NOECHO);
            
            if (key === KEY_LEFT || key === "," || key === "<" || key === "[") {
                currentIndex--;
                if (currentIndex < 0) currentIndex = matchups.length - 1;
            } else if (key === KEY_RIGHT || key === "." || key === ">" || key === "]") {
                currentIndex++;
                if (currentIndex >= matchups.length) currentIndex = 0;
            } else if ((key === "b" || key === "B") && !alreadyBet) {
                var wagerResult = showBettingDetail(view, ctx, game);
                if (wagerResult && wagerResult.placed) {
                    // View was re-created after game, use the new one
                    view = wagerResult.view;
                    // Refresh matchups data
                    betting = ensureDailyMatchups(ctx);
                    matchups = betting.matchups;
                }
            } else if (key === "q" || key === "Q" || key === "\x1b") {
                break;
            }
        }
    }
    
    /**
     * Convert team colors from rosters.ini format to Ctrl-A code
     */
    function getTeamColorCode(colors) {
        if (!colors || !colors.fg) return "\1w";
        
        var colorMap = {
            "WHITE": "\1h\1w",
            "LIGHTGRAY": "\1w",
            "DARKGRAY": "\1n\1w",
            "BLACK": "\1n\1k",
            "RED": "\1n\1r",
            "LIGHTRED": "\1h\1r",
            "GREEN": "\1n\1g",
            "LIGHTGREEN": "\1h\1g",
            "BLUE": "\1n\1b",
            "LIGHTBLUE": "\1h\1b",
            "CYAN": "\1n\1c",
            "LIGHTCYAN": "\1h\1c",
            "MAGENTA": "\1n\1m",
            "LIGHTMAGENTA": "\1h\1m",
            "YELLOW": "\1h\1y",
            "BROWN": "\1n\1y"
        };
        
        return colorMap[colors.fg] || "\1w";
    }
    
    /**
     * Format a player line with name and key stats
     */
    function formatPlayerLine(player) {
        if (!player) return "???";
        var name = player.name || "Unknown";
        if (name.length > 16) name = name.substring(0, 16);
        var stats = player.stats || {};
        return name + " " + (stats.speed || 5) + "/" + (stats.threePt || 5) + "/" + (stats.dunk || 5);
    }
    
    /**
     * Show detailed betting options for a game
     */
    function showBettingDetail(view, ctx, game) {
        var minWager = (LORB.Config && LORB.Config.BETTING_MIN_WAGER) || 50;
        var maxWager = (LORB.Config && LORB.Config.BETTING_MAX_WAGER) || 1000;
        
        // Get team colors
        var team1Color = getTeamColorCode(game.team1.colors);
        var team2Color = getTeamColorCode(game.team2.colors);
        
        while (true) {
            view.clearZone("content");
            view.setContentZone("content");
            view.setCursorY(0);
            
            view.header("PLACE YOUR BET");
            view.blank();
            view.line(team1Color + game.team1.name + "\1n \1h\1kvs\1n " + team2Color + game.team2.name + "\1n");
            view.blank();
            
            // Bet type selection
            var betItems = [
                { text: "Moneyline: " + game.team1.abbr + " " + LORB.Betting.formatOdds(game.odds.team1), value: "ml1", hotkey: "1" },
                { text: "Moneyline: " + game.team2.abbr + " " + LORB.Betting.formatOdds(game.odds.team2), value: "ml2", hotkey: "2" },
                { text: "Spread: " + (game.spread.favorite === "team1" ? game.team1.abbr : game.team2.abbr) + " -" + game.spread.spread, value: "spread_fav", hotkey: "3" },
                { text: "Spread: " + (game.spread.favorite === "team1" ? game.team2.abbr : game.team1.abbr) + " +" + game.spread.spread, value: "spread_dog", hotkey: "4" },
                { text: "Over " + game.total + " points", value: "over", hotkey: "5" },
                { text: "Under " + game.total + " points", value: "under", hotkey: "6" },
                { text: "Back", value: "back", hotkey: "Q" }
            ];
            
            var betChoice = view.menu(betItems, { y: 5 });
            
            if (!betChoice || betChoice === "back") {
                return false;
            }
            
            // Determine bet details
            var betType, betPick, betOdds, betLine;
            
            switch (betChoice) {
                case "ml1":
                    betType = "moneyline";
                    betPick = "team1";
                    betOdds = game.odds.team1;
                    break;
                case "ml2":
                    betType = "moneyline";
                    betPick = "team2";
                    betOdds = game.odds.team2;
                    break;
                case "spread_fav":
                    betType = "spread";
                    betPick = game.spread.favorite;
                    betOdds = -110;
                    betLine = -game.spread.spread;
                    break;
                case "spread_dog":
                    betType = "spread";
                    betPick = game.spread.favorite === "team1" ? "team2" : "team1";
                    betOdds = -110;
                    betLine = game.spread.spread;
                    break;
                case "over":
                    betType = "total";
                    betPick = "over";
                    betOdds = -110;
                    betLine = game.total;
                    break;
                case "under":
                    betType = "total";
                    betPick = "under";
                    betOdds = -110;
                    betLine = game.total;
                    break;
            }
            
            // Get wager amount
            view.clearZone("content");
            view.setCursorY(0);
            view.blank();
            view.header("WAGER AMOUNT");
            view.blank();
            
            var pickDesc = describeBet(betType, betPick, betOdds, betLine, game);
            view.line("Bet: \1h" + pickDesc + "\1n");
            view.line("Odds: \1y" + LORB.Betting.formatOdds(betOdds) + "\1n");
            view.blank();
            view.line("Your cash: \1y$" + (ctx.cash || 0) + "\1n");
            view.line("Min: $" + minWager + "  Max: $" + Math.min(maxWager, ctx.cash || 0));
            view.blank();
            
            var betStr = view.prompt("Bet amount: $");
            var betAmount = parseInt(betStr, 10);
            
            if (isNaN(betAmount) || betAmount < minWager || betAmount > ctx.cash || betAmount > maxWager) {
                view.warn("Invalid bet amount.");
                view.info("Press any key...");
                view.render();
                console.getkey();
                continue;
            }
            
            // Deduct bet amount
            ctx.cash -= betAmount;
            
            // Store wager info
            var wager = {
                gameId: game.id,
                gameIndex: game.gameIndex,
                type: betType,
                pick: betPick,
                odds: betOdds,
                line: betLine,
                amount: betAmount,
                team1: game.team1.name,
                team2: game.team2.name,
                placedAt: Date.now()
            };
            
            if (!ctx.dailyBetting.wagers) ctx.dailyBetting.wagers = [];
            ctx.dailyBetting.wagers.push(wager);
            game.wager = wager;
            
            view.blank();
            view.line("\1g* Bet placed!\1n");
            view.line("$" + betAmount + " on " + pickDesc);
            view.blank();
            view.line("Potential payout: \1y$" + LORB.Betting.calculatePayout(betAmount, betOdds) + "\1n");
            view.blank();
            view.info("Press any key to watch the game...");
            view.render();
            console.getkey();
            
            // Close view and run the actual CPU demo game
            view.close();
            
            var gameResult = runBettingGame(game, ctx);
            
            // Re-create view after game - return it so caller can use it
            var newView = createView();
            swapArt(newView, ART_BOOKIE, ART_SIDE_W, ART_SIDE_H);
            
            // Show result and grade the bet
            showBetResult(newView, ctx, game, wager, gameResult);
            
            // Return the new view object so placeBet can continue using it
            return { placed: true, view: newView };
        }
    }
    
    /**
     * Run the actual CPU demo game for betting
     */
    function runBettingGame(game, ctx) {
        // Build team configs for the game engine
        var team1 = buildGameTeam(game.team1);
        var team2 = buildGameTeam(game.team2);
        
        var gameResult = null;
        
        // Check if real game engine is available
        if (typeof runExternalGame === "function") {
            var config = {
                teamA: team1,
                teamB: team2,
                options: {
                    gameTime: 60,
                    mode: "spectate",
                    showMatchupScreen: true,
                    showGameOverScreen: false
                },
                lorbContext: {
                    betting: true,
                    game: game
                }
            };
            
            var result = runExternalGame(config);
            
            if (result && result.completed) {
                gameResult = {
                    score1: result.score.teamA,
                    score2: result.score.teamB,
                    winner: result.score.teamA > result.score.teamB ? "team1" : "team2",
                    margin: Math.abs(result.score.teamA - result.score.teamB),
                    totalPoints: result.score.teamA + result.score.teamB
                };
            }
        }
        
        // Fallback simulation if real engine unavailable or failed
        if (!gameResult) {
            var rng = new LORB.Betting.SeededRNG(Date.now());
            gameResult = LORB.Betting.simulateGameResult(game, rng);
        }
        
        // Store result on game
        game.result = gameResult;
        
        return gameResult;
    }
    
    /**
     * Build a game team config from matchup data
     */
    function buildGameTeam(teamData) {
        var players = [];
        for (var i = 0; i < teamData.players.length && i < 2; i++) {
            var p = teamData.players[i];
            // Get shortNick from the player's shortNicks array
            var shortNick = (p.shortNicks && p.shortNicks.length > 0) ? p.shortNicks[0] : null;
            if (!shortNick) {
                // Fallback: last name, up to 8 chars
                var nameParts = (p.name || "").split(" ");
                shortNick = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
                shortNick = shortNick.substring(0, 8).toUpperCase();
            }
            
            players.push({
                name: p.name,
                shortNick: shortNick,
                position: p.position || "forward",
                speed: p.stats.speed || 5,
                threePt: p.stats.threePt || 5,
                dunks: p.stats.dunk || 5,
                power: p.stats.power || 5,
                defense: p.stats.steal || 5,
                blocks: p.stats.block || 5,
                skin: p.skin || "brown",
                jersey: parseInt(p.jersey, 10) || 0,
                isHuman: false
            });
        }
        
        return {
            name: teamData.name,
            abbr: teamData.abbr,
            players: players,
            colors: teamData.colors ? {
                fg: teamData.colors.fg || "WHITE",
                bg: teamData.colors.bg || "BG_BLACK",
                fg_accent: teamData.colors.fg_accent || "WHITE",
                bg_alt: teamData.colors.bg_alt || "BG_BLACK"
            } : null
        };
    }
    
    /**
     * Show bet result after game completes
     */
    function showBetResult(view, ctx, game, wager, gameResult) {
        var team1Color = getTeamColorCode(game.team1.colors);
        var team2Color = getTeamColorCode(game.team2.colors);
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        view.header("GAME OVER");
        view.blank();
        
        // Show final score with team colors
        view.line(team1Color + game.team1.name + "\1n: " + gameResult.score1);
        view.line(team2Color + game.team2.name + "\1n: " + gameResult.score2);
        view.blank();
        
        // Grade the wager
        var grade = LORB.Betting.gradeWager(wager, gameResult);
        
        if (grade.won) {
            var payout = grade.payout;
            ctx.cash += payout;
            view.line("\1h\1gYOU WIN!\1n");
            view.blank();
            view.line("You collect \1y$" + payout + "\1n!");
        } else if (grade.push) {
            ctx.cash += wager.amount;
            view.line("\1h\1yPUSH\1n");
            view.blank();
            view.line("Your $" + wager.amount + " bet is returned.");
        } else {
            view.line("\1h\1rYOU LOSE\1n");
            view.blank();
            view.line("Your $" + wager.amount + " bet is gone.");
        }
        
        // Mark wager as resolved so it doesn't get double-counted
        wager.resolved = true;
        wager.result = grade;
        
        view.blank();
        view.line("\1wCash: $" + (ctx.cash || 0) + "\1n");
        view.blank();
        view.info("Press any key...");
        view.render();
        console.getkey();
    }
    
    /**
     * Describe a bet in human-readable form
     */
    function describeBet(type, pick, odds, line, game) {
        var teamName = pick === "team1" ? game.team1.abbr : (pick === "team2" ? game.team2.abbr : pick);
        
        switch (type) {
            case "moneyline":
                return teamName + " to win";
            case "spread":
                var sign = line >= 0 ? "+" : "";
                return teamName + " " + sign + line;
            case "total":
                return pick.charAt(0).toUpperCase() + pick.slice(1) + " " + line + " points";
            default:
                return pick;
        }
    }
    
    /**
     * Resolve all pending wagers (called on day change or when viewing results)
     */
    function resolveWagers(ctx) {
        if (!ctx.dailyBetting || !ctx.dailyBetting.wagers || ctx.dailyBetting.wagers.length === 0) {
            return null;
        }
        
        if (ctx.dailyBetting.resolved) {
            return ctx.dailyBetting.results;
        }
        
        var rng = new LORB.Betting.SeededRNG(ctx.dailyBetting.day * 99991 + Date.now());
        var results = [];
        var totalWon = 0;
        var totalLost = 0;
        
        for (var i = 0; i < ctx.dailyBetting.wagers.length; i++) {
            var wager = ctx.dailyBetting.wagers[i];
            var game = ctx.dailyBetting.matchups[wager.gameIndex];
            
            // Simulate game if not already done
            if (!game.result) {
                game.result = LORB.Betting.simulateGameResult(game, rng);
            }
            
            // Grade the wager
            var grade = LORB.Betting.gradeWager(wager, game.result);
            
            results.push({
                wager: wager,
                game: game,
                result: game.result,
                grade: grade
            });
            
            if (grade.won) {
                totalWon += grade.payout;
                ctx.cash = (ctx.cash || 0) + grade.payout;
            } else if (grade.push) {
                ctx.cash = (ctx.cash || 0) + wager.amount; // Return stake
            } else {
                totalLost += wager.amount;
            }
        }
        
        ctx.dailyBetting.resolved = true;
        ctx.dailyBetting.results = {
            bets: results,
            totalWon: totalWon,
            totalLost: totalLost,
            netProfit: totalWon - totalLost
        };
        
        return ctx.dailyBetting.results;
    }
    
    /**
     * Create the Club 23 RichView with city-themed colors
     */
    function createView() {
        // Get city-specific theme for lightbars
        var city = null;
        if (LORB.Cities && LORB.Cities.getToday) {
            city = LORB.Cities.getToday();
        }
        var cityTheme = (LORB.Cities && LORB.Cities.getCityTheme && city) 
            ? LORB.Cities.getCityTheme(city) 
            : "lorb";
        
        return new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "art", x: 1, y: 5, width: 40, height: 20 },
                { name: "content", x: 41, y: 5, width: 40, height: 20 }
            ],
            theme: cityTheme
        });
    }
    
    /**
     * Run with RichView
     */
    function runRichView(ctx) {
        var view = createView();
        loadArt(view);
        
        // Create sprite wanderer for ambient animation in the art zone
        var wanderer = null;
        var SpriteWanderer = getSpriteWanderer();
        
        if (SpriteWanderer) {
            try {
                var artFrame = view.getZone("art");
                if (artFrame) {
                    // Pick 2-3 random skins for bar patrons
                    var availableSkins = ["brown", "lightgray", "magenta", "sonic", "shrek", "barney"];
                    var patronCount = 2 + Math.floor(Math.random() * 2);  // 2-3 patrons
                    var patronSprites = [];
                    for (var i = 0; i < patronCount; i++) {
                        var skin = availableSkins[Math.floor(Math.random() * availableSkins.length)];
                        // Stagger starting positions along the bottom of the art
                        patronSprites.push({
                            skin: skin,
                            x: 5 + (i * 12),
                            y: 14,
                            bearing: ["e", "w", "s"][Math.floor(Math.random() * 3)]
                        });
                    }
                    
                    wanderer = new SpriteWanderer({
                        parentFrame: artFrame,
                        sprites: patronSprites,
                        walkableZones: [
                            // Bar floor area - bottom portion of the 40x20 art
                            { x: 2, y: 12, width: 36, height: 7 }
                        ],
                        options: {
                            speed: 400,        // Move every 400ms
                            pauseChance: 0.4   // 40% chance to idle
                        }
                    });
                    wanderer.start();
                    view.render();
                }
            } catch (e) {
                // Wanderer is optional - continue without it
                wanderer = null;
            }
        }
        
        while (true) {
            // Draw status
            view.clearZone("content");
            drawStatus(view, ctx);
            
            // Build menu
            var menuItems = [
                { text: "Rest & Recover", value: "rest", hotkey: "1", disabled: ctx.restUsedToday },
                { text: "Listen for Rumors", value: "rumors", hotkey: "2" },
                { text: "Bet on a Game", value: "bet", hotkey: "3", disabled: (ctx.cash || 0) < 50 },
                { text: "Flirt / Socialize", value: "flirt", hotkey: "5" },
                { text: "Visit the Restroom", value: "restroom", hotkey: "4" },
                { text: "Hall of Fame", value: "hallOfFame", hotkey: "6" },
                { text: "Leave", value: "leave", hotkey: "Q" }
            ];
            
            var choice = view.menu(menuItems, {
                y: 4,
                onSelect: function(item, index, richView) {
                    // Update info panel when hovering
                    drawInfoPanel(richView, item.value);
                    richView.render();
                },
                onIdle: function(richView, lightbar) {
                    // Animate wandering sprites during menu idle
                    if (wanderer && wanderer.isRunning()) {
                        wanderer.update();
                        wanderer.cycle();
                        richView.render();
                    }
                }
            });
            
            switch (choice) {
                case "rest":
                    if (wanderer) wanderer.stop();
                    rest(view, ctx);
                    loadArt(view);
                    if (wanderer) { wanderer.start(); view.render(); }
                    break;
                case "rumors":
                    if (wanderer) wanderer.stop();
                    listenRumors(view, ctx);
                    loadArt(view);
                    if (wanderer) { wanderer.start(); view.render(); }
                    break;
                case "bet":
                    if (wanderer) wanderer.stop();
                    placeBet(view, ctx);
                    loadArt(view);
                    if (wanderer) { wanderer.start(); view.render(); }
                    break;
                case "flirt":
                    if (wanderer) wanderer.stop();
                    flirt(view, ctx);
                    loadArt(view);
                    if (wanderer) { wanderer.start(); view.render(); }
                    break;
                case "restroom":
                    if (wanderer) wanderer.stop();
                    visitRestroom(view, ctx);
                    loadArt(view);
                    if (wanderer) { wanderer.start(); view.render(); }
                    break;
                case "hallOfFame":
                    if (wanderer) wanderer.stop();
                    showHallOfFame(view, ctx);
                    loadArt(view);
                    if (wanderer) { wanderer.start(); view.render(); }
                    break;
                case "leave":
                case null:
                    // Clean up wanderer before leaving
                    if (wanderer) {
                        wanderer.stop();
                    }
                    view.close();
                    return;
            }
        }
    }
    
    /**
     * Legacy fallback (no RichView)
     */
    function runLegacy(ctx) {
        var clubName = getCurrentClubName();
        
        while (true) {
            LORB.View.clear();
            LORB.View.header(clubName.toUpperCase());
            LORB.View.line("");
            LORB.View.line("Cash: \1y$" + (ctx.cash || 0) + "\1n");
            LORB.View.line("");
            
            var restText = ctx.restUsedToday ? 
                "\1n\1w[1] Rest (already rested)\1n" :
                "\1w[1]\1n Rest & Recover";
            
            LORB.View.line(restText);
            LORB.View.line("\1w[2]\1n Listen for Rumors");
            LORB.View.line("\1w[3]\1n Bet on a Game");
            LORB.View.line("\1w[4]\1n Visit the Restroom");
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
                    LORB.View.line("\1w" + rumor + "\1n");
                    console.getkey();
                    break;
                case "3":
                    // Simplified betting for legacy
                    LORB.View.warn("Betting requires RichView.");
                    console.getkey();
                    break;
                case "4":
                    // Simplified graffiti for legacy
                    runLegacyGraffiti(ctx);
                    break;
                case "Q":
                    return;
            }
        }
    }
    
    /**
     * Legacy graffiti view (no RichView)
     */
    function runLegacyGraffiti(ctx) {
        var maxLines = (LORB.Config && LORB.Config.MAX_GRAFFITI_LINES) || 3;
        var maxLineLen = (LORB.Config && LORB.Config.GRAFFITI_LINE_LENGTH) || 60;
        
        while (true) {
            LORB.View.clear();
            LORB.View.header("RESTROOM GRAFFITI");
            LORB.View.line("");
            
            var entries = LORB.Persist.readGraffiti();
            
            if (entries.length === 0) {
                LORB.View.line("\1wThe walls are surprisingly clean...\1n");
            } else {
                // Show first 5 entries
                for (var i = 0; i < Math.min(5, entries.length); i++) {
                    var entry = entries[i];
                    LORB.View.line("\1m" + (entry.author || "Anonymous") + ":\1n");
                    for (var j = 0; j < entry.lines.length; j++) {
                        LORB.View.line("  \1c" + entry.lines[j] + "\1n");
                    }
                }
            }
            
            LORB.View.line("");
            LORB.View.line("\1w[W]\1n Write on wall  \1w[Q]\1n Leave");
            
            var choice = LORB.View.prompt("Choice: ").toUpperCase();
            
            if (choice === "W") {
                LORB.View.line("");
                LORB.View.line("\1wUp to " + maxLines + " lines (" + maxLineLen + " chars each).\1n");
                LORB.View.line("\1wEmpty line to finish.\1n");
                
                var lines = [];
                for (var k = 0; k < maxLines; k++) {
                    var line = LORB.View.prompt("Line " + (k + 1) + ": ");
                    if (!line || line.length === 0) break;
                    lines.push(line.substring(0, maxLineLen));
                }
                
                if (lines.length > 0) {
                    if (LORB.Persist.addGraffiti(ctx, lines)) {
                        LORB.View.line("\1gYour mark is left on the wall.\1n");
                    } else {
                        LORB.View.warn("Couldn't write. Try again later.");
                    }
                    console.getkey();
                }
            } else if (choice === "Q") {
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
    
    /**
     * Helper: pad string to the right
     */
    function padRight(str, len) {
        str = String(str || "");
        while (str.length < len) str += " ";
        return str;
    }
    
    /**
     * Helper: truncate name to max length
     */
    function truncateName(name, maxLen) {
        name = String(name || "");
        if (name.length <= maxLen) return name;
        return name.substring(0, maxLen - 1) + ".";
    }
    
    // Export
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Club23 = {
        run: run,
        RUMORS: STATIC_RUMORS
    };
    
})();
