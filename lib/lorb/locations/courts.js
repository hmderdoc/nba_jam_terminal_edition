/**
 * courts.js - Hit the Courts (Streetball)
 * 
 * Layout:
 *   LEFT (content): Narrative text - tighter, efficient
 *   RIGHT TOP (art): 40x20 sprite zone - NBA player fills it, streetball gets dynamic sprite
 *   RIGHT BOTTOM: Stats + menu in banner area (overlaid on sprite bottom for NBA)
 */

var _courtsRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _courtsRichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[COURTS] Failed to load RichView: " + e);
}

// Load dependencies
if (typeof BinLoader === "undefined") {
    try { load("/sbbs/xtrn/nba_jam/lib/utils/bin-loader.js"); } catch (e) {}
}
if (typeof LORB === "undefined" || typeof LORB.getRandomOpponent !== "function") {
    try { load("/sbbs/xtrn/nba_jam/lib/lorb/get_random_opponent.js"); } catch (e) {}
}

// Sprite system for dynamic streetball players
var _spriteSystemLoaded = false;
function ensureSpriteSystem() {
    if (_spriteSystemLoaded) return true;
    try {
        load("sbbsdefs.js");
        load("frame.js");
        load("sprite.js");
        load("/sbbs/xtrn/nba_jam/lib/rendering/sprite-utils.js");
        _spriteSystemLoaded = true;
        return true;
    } catch (e) {
        log(LOG_WARNING, "[COURTS] Failed to load sprite system: " + e);
        return false;
    }
}

(function() {
    
    var RichView = _courtsRichView;
    var NBA_JAM_ROOT = "/sbbs/xtrn/nba_jam/";
    
    // Foreground color name to attribute mapping for nametags
    var FG_COLOR_MAP = {
        "BLACK": 0, "BLUE": 1, "GREEN": 2, "CYAN": 3, "RED": 4, "MAGENTA": 5,
        "BROWN": 6, "YELLOW": 14, "WHITE": 7, "LIGHTGRAY": 7, "DARKGRAY": 8,
        "LIGHTBLUE": 9, "LIGHTGREEN": 10, "LIGHTCYAN": 11, "LIGHTRED": 12,
        "LIGHTMAGENTA": 13, "LIGHTYELLOW": 14, "LIGHTWHITE": 15
    };
    
    // Background color name to attribute mapping
    var BG_COLOR_MAP = {
        "BLACK": 0, "BG_BLACK": 0, "BLUE": 16, "BG_BLUE": 16, "GREEN": 32, "BG_GREEN": 32,
        "CYAN": 48, "BG_CYAN": 48, "RED": 64, "BG_RED": 64, "MAGENTA": 80, "BG_MAGENTA": 80,
        "BROWN": 96, "BG_BROWN": 96, "YELLOW": 96, "BG_YELLOW": 96,
        "WHITE": 112, "BG_WHITE": 112, "LIGHTGRAY": 112, "BG_LIGHTGRAY": 112
    };
    
    function fgColorToAttr(name) {
        if (!name) return null;
        var upper = String(name).toUpperCase();
        return FG_COLOR_MAP[upper] !== undefined ? FG_COLOR_MAP[upper] : null;
    }
    
    function bgColorToAttr(name) {
        if (!name) return null;
        var upper = String(name).toUpperCase();
        return BG_COLOR_MAP[upper] !== undefined ? BG_COLOR_MAP[upper] : null;
    }
    
    // Court definitions
    var COURTS = {
        court6: {
            id: "court6",
            name: "Court 6",
            tagline: "Rookie Proving Grounds",
            repRequired: 0,
            difficulty: 1,
            rewards: { cashBase: 50, repBase: 2, xpBase: 10 },
            nbaChance: 0.1
        },
        court9: {
            id: "court9",
            name: "Court 9",
            tagline: "Regulars Only",
            repRequired: 25,
            difficulty: 2,
            rewards: { cashBase: 100, repBase: 4, xpBase: 25 },
            nbaChance: 0.25
        },
        dunk_district: {
            id: "dunk_district",
            name: "Dunk District",
            tagline: "Dunkers Rule Here",
            repRequired: 75,
            difficulty: 3,
            rewards: { cashBase: 200, repBase: 8, xpBase: 50 },
            nbaChance: 0.4
        },
        the_arc: {
            id: "the_arc",
            name: "The Arc",
            tagline: "Sniper's Haven",
            repRequired: 150,
            difficulty: 4,
            rewards: { cashBase: 400, repBase: 15, xpBase: 100 },
            nbaChance: 0.6
        },
        court_of_airness: {
            id: "court_of_airness",
            name: "Court of Airness",
            tagline: "The Red Bull Waits",
            repRequired: 300,
            difficulty: 5,
            rewards: { cashBase: 1000, repBase: 50, xpBase: 500 },
            boss: true,
            nbaChance: 0.8
        }
    };
    
    // Streetball names
    var STREETBALL_NAMES = {
        1: ["Rookie Ray", "Fresh Mike", "Young Blood", "Park Rat"],
        2: ["Street Sam", "Quick Pete", "Alley Al", "Downtown D"],
        3: ["Dunk Master D", "High Rise Harry", "Rim Wrecker", "Flight Club"],
        4: ["Sniper Steve", "Arc Angel", "Range Rider", "Deep Threat"],
        5: ["The Red Bull", "His Airness", "The GOAT", "Phantom"]
    };
    
    // Skin options for streetballers
    var SKINS = ["brown", "lightgray", "magenta"];
    
    function getAvailableCourts(ctx) {
        var available = [];
        var rep = ctx.rep || 0;
        for (var id in COURTS) {
            if (COURTS.hasOwnProperty(id)) {
                var court = COURTS[id];
                available.push({
                    court: court,
                    unlocked: rep >= court.repRequired,
                    repNeeded: court.repRequired - rep
                });
            }
        }
        return available;
    }
    
    /**
     * Get rep needed to unlock next court
     * Returns {needed: number, courtName: string} or null if all unlocked
     */
    function getRepToNextCourt(ctx) {
        var rep = ctx.rep || 0;
        var thresholds = [];
        for (var id in COURTS) {
            if (COURTS.hasOwnProperty(id)) {
                thresholds.push({ rep: COURTS[id].repRequired, name: COURTS[id].name });
            }
        }
        thresholds.sort(function(a, b) { return a.rep - b.rep; });
        
        for (var i = 0; i < thresholds.length; i++) {
            if (thresholds[i].rep > rep) {
                return { needed: thresholds[i].rep - rep, courtName: thresholds[i].name };
            }
        }
        return null; // All courts unlocked
    }
    
    /**
     * Convert a crew contact to a player object for use in games
     */
    function crewContactToPlayer(contact) {
        if (!contact || !contact.stats) return null;
        
        var stats = contact.stats;
        
        // Generate shortNick if not present
        var shortNick = contact.shortNick;
        if (!shortNick) {
            var nameParts = String(contact.name || "").split(" ");
            shortNick = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
            shortNick = shortNick.substring(0, 8).toUpperCase();
        }
        
        return {
            id: "crew_" + (contact.id || "member"),
            name: contact.name || "Crew Member",
            displayName: contact.name || "Crew Member",
            team: contact.team || "Crew",
            teamAbbr: "CRW",
            isNBA: (contact.type === "nba"),
            skin: contact.skin || "brown",
            jersey: contact.jersey || Math.floor(Math.random() * 99) + 1,
            shortNick: shortNick,
            stats: {
                speed: stats.speed || 5,
                "3point": stats.threePt || stats["3point"] || 5,
                dunk: stats.dunk || 5,
                power: stats.power || 5,
                steal: stats.steal || 5,
                block: stats.block || 5
            }
        };
    }
    
    /**
     * Get a crew member to use as teammate, or null if none available
     * Uses the active teammate if set, otherwise first crew member
     */
    function getCrewTeammate(ctx) {
        if (typeof LORB === "undefined" || !LORB.Util || !LORB.Util.Contacts) return null;
        var crewMember = LORB.Util.Contacts.getActiveTeammate(ctx);
        if (!crewMember) return null;
        return crewContactToPlayer(crewMember);
    }
    
    function generateStreetballOpponent(court) {
        var baseStats = 4 + (court.difficulty * 2);
        var variance = 2;
        var tierNames = STREETBALL_NAMES[court.difficulty] || STREETBALL_NAMES[1];
        var name = tierNames[Math.floor(Math.random() * tierNames.length)];
        if (court.boss) name = "The Red Bull";
        
        // Random skin and jersey
        var skin = SKINS[Math.floor(Math.random() * SKINS.length)];
        var jersey = Math.floor(Math.random() * 99) + 1;
        
        // Generate shortNick from name (first word, up to 8 chars)
        var shortNick = name.split(" ")[0].substring(0, 8).toUpperCase();
        
        return {
            id: "street_" + court.difficulty + "_" + Date.now(),
            shortNick: shortNick,
            name: name,
            displayName: name,
            team: "Street",
            teamAbbr: "STR",
            isNBA: false,
            skin: skin,
            jersey: jersey,
            stats: {
                speed: Math.min(10, baseStats + Math.floor(Math.random() * variance)),
                "3point": Math.min(10, baseStats + Math.floor(Math.random() * variance)),
                dunk: Math.min(10, baseStats + Math.floor(Math.random() * variance)),
                power: Math.min(10, baseStats + Math.floor(Math.random() * variance)),
                steal: Math.min(10, baseStats + Math.floor(Math.random() * variance) - 1),
                block: Math.min(10, baseStats + Math.floor(Math.random() * variance) - 1)
            }
        };
    }
    
    function getNBAOpponent() {
        if (typeof LORB === "undefined") return null;
        
        // Get current city for city-filtered encounters
        var cityId = null;
        if (LORB.Cities && LORB.Cities.getToday) {
            var city = LORB.Cities.getToday();
            if (city && city.id) {
                cityId = city.id;
            }
        }
        
        try {
            var opp = null;
            
            // Use city-filtered opponent selection if available
            if (cityId && typeof LORB.getRandomOpponentForCity === "function") {
                opp = LORB.getRandomOpponentForCity(cityId);
            } else if (typeof LORB.getRandomOpponent === "function") {
                opp = LORB.getRandomOpponent();
            }
            
            if (opp && opp.name && opp.stats) {
                opp.displayName = opp.name;
                opp.isNBA = true;
                return opp;
            }
        } catch (e) {}
        return null;
    }
    
    function generateOpponent(court, ctx) {
        if (Math.random() < (court.nbaChance || 0.2)) {
            var nba = getNBAOpponent();
            if (nba) return nba;
        }
        return generateStreetballOpponent(court);
    }
    
    function calculateRewards(court, ctx, scoreDiff) {
        var rewards = court.rewards;
        var mult = scoreDiff >= 20 ? 1.5 : (scoreDiff >= 10 ? 1.25 : 1.0);
        if (ctx.archetype === "UNDERDOG") mult *= 1.25;
        return {
            cash: Math.floor(rewards.cashBase * mult),
            rep: Math.floor(rewards.repBase * mult),
            xp: Math.floor(rewards.xpBase * mult)
        };
    }
    
    function formatStat(val) {
        if (val === undefined || val === null) return "\1k?\1n";
        var c = val >= 9 ? "\1h\1g" : (val >= 7 ? "\1g" : (val <= 3 ? "\1r" : (val <= 5 ? "\1y" : "\1w")));
        return c + val + "\1n";
    }
    
    function createView() {
        return new RichView({
            zones: [
                { name: "content", x: 1, y: 1, width: 40, height: 24 },
                { name: "art", x: 41, y: 1, width: 40, height: 24 }
            ],
            theme: "lorb"
        });
    }
    
    /**
     * Draw a dynamic 5x4 streetball sprite in the art zone
     * Creates a container frame and blits sprite data into it
     */
    function drawStreetballSprite(view, opponent) {
        if (!ensureSpriteSystem()) return false;
        
        var artFrame = view.getZone("art");
        if (!artFrame) return false;
        
        // Skins that should NOT have jersey masks applied (custom streetball sprites)
        var NO_JERSEY_SKINS = ["barney", "shrek", "airbud", "sonic", "donatello", "satan", "iceman"];
        
        try {
            var skin = opponent.skin || "brown";
            var spriteBase = "player-" + skin;
            
            var SPRITE_WIDTH = 5;
            var SPRITE_HEIGHT = 4;
            var containerX = 30;
            var containerY = 3;
            
            // Create container frame as child of artFrame - blue bg for debug
            var containerFrame = new Frame(containerX, containerY, SPRITE_WIDTH, SPRITE_HEIGHT, BG_BLUE, artFrame);
            containerFrame.open();
            
            // Create sprite to extract pixel data
            var oldExecDir = js.exec_dir;
            js.exec_dir = NBA_JAM_ROOT;
            
            var sprite = new Sprite.Aerial(
                spriteBase,
                containerFrame,
                0,
                0,
                "s",
                "normal"
            );
            
            js.exec_dir = oldExecDir;
            
            // Check if this skin should skip jersey application
            var skipJersey = NO_JERSEY_SKINS.indexOf(skin.toLowerCase()) !== -1;
            
            if (!skipJersey) {
                // Get current city for team-appropriate jersey colors
                // (e.g., Barkley in Philadelphia wears Sixers colors, not Suns)
                var jerseyBg = BG_BLUE;  // fallback
                var accentFg = WHITE;
                
                if (LORB && LORB.Cities && LORB.Cities.getToday && LORB.Cities.getTeamColors) {
                    var city = LORB.Cities.getToday();
                    if (city) {
                        var teamColors = LORB.Cities.getTeamColors(city);
                        // bgAltAttr is the numeric BG_* constant for the jersey background (ansi_bg_alt)
                        // fgAccentAttr is the numeric foreground for jersey numbers (ansi_fg_accent)
                        if (teamColors && typeof teamColors.bgAltAttr === "number") {
                            jerseyBg = teamColors.bgAltAttr;
                        }
                        if (teamColors && typeof teamColors.fgAccentAttr === "number") {
                            accentFg = teamColors.fgAccentAttr;
                        }
                    }
                }
                
                var jerseyConfig = {
                    jerseyBg: jerseyBg,
                    accentFg: accentFg,
                    jerseyNumber: String(opponent.jersey || "")
                };
                
                if (typeof applyUniformMask === "function") {
                    applyUniformMask(sprite, jerseyConfig);
                }
            }
            if (typeof scrubSpriteTransparency === "function") {
                scrubSpriteTransparency(sprite);
            }
            
            // Blit sprite data into container
            if (sprite.frame) {
                for (var sy = 0; sy < SPRITE_HEIGHT; sy++) {
                    for (var sx = 0; sx < SPRITE_WIDTH; sx++) {
                        var cell = sprite.frame.getData(sx, sy, false);
                        if (!cell) continue;
                        var ch = cell.ch;
                        var attr = cell.attr;
                        if (!ch || ch === '\0') ch = ' ';
                        if (attr === undefined || attr === null) attr = BG_BLUE;
                        containerFrame.gotoxy(sx, sy);
                        containerFrame.putmsg(ch, attr);
                    }
                }
                sprite.frame.close();
            }
            
            view._spriteContainer = containerFrame;
            return true;
        } catch (e) {
            log(LOG_WARNING, "[COURTS] Failed to create streetball sprite: " + e);
            return false;
        }
    }
    /**
     * Load NBA player 40x20 .bin art
     */
    function loadNBASprite(view, opponent) {
        if (typeof BinLoader === "undefined") return false;
        var artFrame = view.getZone("art");
        if (!artFrame || !opponent.path || !file_exists(opponent.path)) return false;
        
        BinLoader.loadIntoFrame(artFrame, opponent.path, 40, 20, 1, 1);
        return true;
    }
    
    /**
     * Clean up any sprite resources
     */
    function cleanupSprite(view) {
        if (view._streetballSprite) {
            try {
                if (view._streetballSprite.frame) {
                    view._streetballSprite.frame.close();
                }
            } catch (e) {}
            view._streetballSprite = null;
        }
        if (view._spriteContainer) {
            try {
                view._spriteContainer.close();
            } catch (e) {}
            view._spriteContainer = null;
        }
    }
    
    /**
     * Draw the right panel for challenger encounter
     * NBA: Full 40x20 sprite with name/team overlaid at bottom, stats+menu in banner
     * Streetball: Dynamic 5x4 sprite top-right, stats+menu below
     */
    function drawChallengerPanel(view, opponent) {
        var artFrame = view.getZone("art");
        if (!artFrame) return;
        
        artFrame.clear();
        cleanupSprite(view);
        
        if (opponent.isNBA) {
            // Load full 40x20 NBA player art
            var loaded = loadNBASprite(view, opponent);
            
            // Overlay name/team at bottom of sprite (rows 17-18)
            artFrame.gotoxy(2, 17);
            artFrame.putmsg("\1h\1m" + opponent.displayName + "\1n");
            artFrame.gotoxy(2, 18);
            artFrame.putmsg("\1m" + (opponent.team || "NBA") + " #" + (opponent.jersey || "??") + "\1n");
            
        } else {
            // Streetball: Draw title area
            artFrame.gotoxy(2, 2);
            artFrame.putmsg("\1h\1y" + opponent.displayName + "\1n");
            artFrame.gotoxy(2, 3);
            artFrame.putmsg("\1k\1hStreetballer #" + (opponent.jersey || "?") + "\1n");
            
            // Draw dynamic sprite (right-aligned)
            drawStreetballSprite(view, opponent);
        }
        
        // Stats section (same position for both)
        var statsY = 12;
        artFrame.gotoxy(2, statsY);
        artFrame.putmsg("\1k" + repeatChar("\xC4", 36) + "\1n");
        
        var stats = opponent.stats || {};
        artFrame.gotoxy(2, statsY + 1);
        artFrame.putmsg("\1cSPD\1n " + formatStat(stats.speed) + "  \1c3PT\1n " + formatStat(stats["3point"]) + "  \1cDNK\1n " + formatStat(stats.dunk));
        
        artFrame.gotoxy(2, statsY + 2);
        artFrame.putmsg("\1cPWR\1n " + formatStat(stats.power) + "  \1cSTL\1n " + formatStat(stats.steal) + "  \1cBLK\1n " + formatStat(stats.block));
        
        view.render();
    }
    
    /**
     * Show challenger encounter
     */
    function showChallengerEncounter(view, court, opponent, ctx) {
        cleanupSprite(view);
        view.clearZone("content");
        view.clearZone("art");
        
        // LEFT: Narrative (tight, efficient)
        view.setContentZone("content");
        view.setCursorY(0);
        
        // Header with tagline
        view.header(court.name + " - " + court.tagline);
        view.blank();
        
        view.line("\1cA challenger approaches...\1n");
        view.blank();
        
        if (opponent.isNBA) {
            view.line("\1h\1m" + opponent.displayName + "\1n");
            view.line("\1msteps onto the court!\1n");
            view.blank();
            view.line("\1k\1hAn NBA player! Beat them\1n");
            view.line("\1k\1hfor serious bragging rights.\1n");
        } else {
            view.line("\1h\1y" + opponent.displayName + "\1n");
            view.line("\1ysteps onto the court.\1n");
            view.blank();
            view.line("\1k\1hAnother baller looking to\1n");
            view.line("\1k\1hmake a name on the streets.\1n");
        }
        
        view.blank();
        view.line("Street Turns: " + (ctx.streetTurns > 0 ? "\1g" : "\1r") + ctx.streetTurns + "\1n");
        view.line("Your Rep: \1c" + (ctx.rep || 0) + "\1n");
        
        // Show active teammate if available
        if (typeof LORB !== "undefined" && LORB.Util && LORB.Util.Contacts) {
            var teammate = LORB.Util.Contacts.getActiveTeammate(ctx);
            if (teammate && teammate.name) {
                view.line("Teammate: \1h\1y" + teammate.name + "\1n");
            } else {
                view.line("Teammate: \1kNone (solo)\1n");
            }
        }
        
        // RIGHT: Sprite + Stats
        drawChallengerPanel(view, opponent);
        
        // Menu at bottom of art zone
        view.setContentZone("art");
        view.setCursorY(16);
        
        var items = [
            { text: "Accept Challenge", value: "play", hotkey: "P" },
            { text: "Find Another", value: "reroll", hotkey: "R" },
            { text: "Back Out", value: "back", hotkey: "Q" }
        ];
        
        return view.menu(items, { y: 17, width: 36 });
    }
    
    function buildCourtMenuItems(ctx) {
        var courts = getAvailableCourts(ctx);
        var items = [];
        var num = 1;
        
        for (var i = 0; i < courts.length; i++) {
            var c = courts[i];
            var court = c.court;
            var tag = court.boss ? " \1r[BOSS]\1n" : "";
            var detail = c.unlocked 
                ? "\1k\1h" + court.tagline + "\1n"
                : "\1r(Need " + c.repNeeded + " more rep)\1n";
            
            items.push({
                text: court.name + tag,
                detail: [detail],
                value: court.id,
                hotkey: String(num),
                disabled: !c.unlocked,
                _court: court,
                _unlocked: c.unlocked
            });
            num++;
        }
        
        items.push({ text: "Back to Rim City", value: "back", hotkey: "Q" });
        return items;
    }
    
    function drawCourtPreview(view, court, unlocked) {
        view.updateZone("art", function(frame) {
            frame.clear();
            frame.gotoxy(2, 2);
            frame.putmsg("\1h\1w" + court.name + "\1n");
            frame.gotoxy(2, 3);
            frame.putmsg(unlocked ? "\1g[UNLOCKED]\1n" : "\1r[LOCKED]\1n");
            
            var stars = "";
            for (var i = 0; i < court.difficulty; i++) stars += "*";
            frame.gotoxy(2, 5);
            frame.putmsg("\1wDifficulty: \1r" + stars + "\1n");
            
            frame.gotoxy(2, 7);
            frame.putmsg("\1wRewards:\1n");
            frame.gotoxy(2, 8);
            frame.putmsg("  \1y$" + court.rewards.cashBase + "\1n / \1c+" + court.rewards.repBase + " rep\1n");
            
            var nba = Math.floor((court.nbaChance || 0.2) * 100);
            frame.gotoxy(2, 10);
            frame.putmsg("\1wNBA Chance: \1m" + nba + "%\1n");
            
            frame.gotoxy(2, 12);
            frame.putmsg("\1c" + court.tagline + "\1n");
        });
    }
    
    function ctxToPlayer(ctx) {
        // Start with base stats, then apply equipment/drink boosts, then city boosts
        var baseStats = ctx.stats || {};
        var stats;
        
        // Apply sneaker mods and drink buffs via Shop.getEffectiveStats
        if (LORB.Locations && LORB.Locations.Shop && LORB.Locations.Shop.getEffectiveStats) {
            stats = LORB.Locations.Shop.getEffectiveStats(ctx);
        } else {
            stats = {
                speed: baseStats.speed || 6,
                threePt: baseStats.threePt || baseStats["3point"] || 5,
                dunk: baseStats.dunk || 5,
                power: baseStats.power || 5,
                steal: baseStats.steal || 5,
                block: baseStats.block || 5
            };
        }
        
        // Apply city buffs on top of equipment/drink boosts
        if (LORB.Cities && LORB.Cities.getToday && LORB.Cities.applyBuffsToStats) {
            var city = LORB.Cities.getToday();
            if (city) {
                stats = LORB.Cities.applyBuffsToStats(stats, city);
            }
        }
        
        var app = ctx.appearance || {};
        return {
            name: ctx.name || ctx.alias || "Player",
            shortNick: ctx.nickname || null,
            speed: stats.speed || 6,
            threePt: stats.threePt || stats["3point"] || 5,
            dunks: stats.dunk || 5,
            power: stats.power || 5,
            defense: stats.steal || 5,
            blocks: stats.block || 5,
            skin: app.skin || ctx.skin || "brown",
            jersey: parseInt(app.jerseyNumber, 10) || ctx.jersey || 1,
            isHuman: true,
            lorbId: "player",
            lorbData: {
                isLorbPlayer: true,
                name: ctx.name,
                level: ctx.level || 1,
                archetype: ctx.archetype || null,
                // Nametag colors as numeric attributes for game engine
                nametagFg: fgColorToAttr(app.nametagFg),
                nametagBg: bgColorToAttr(app.nametagBg),
                nametagHiFg: fgColorToAttr(app.nametagHiFg),
                nametagHiBg: bgColorToAttr(app.nametagHiBg)
            }
        };
    }
    
    function opponentToPlayer(opp) {
        var stats = opp.stats || {};
        return {
            name: opp.name || "Opponent",
            shortNick: opp.shortNick || null,
            speed: stats.speed || 5,
            threePt: stats["3point"] || 5,
            dunks: stats.dunk || 5,
            power: stats.power || 5,
            defense: stats.steal || 5,
            blocks: stats.block || 5,
            skin: opp.skin || "brown",  // Default to brown, not lightgray
            jersey: opp.jersey ? parseInt(opp.jersey, 10) : Math.floor(Math.random() * 99),
            isHuman: false,
            lorbId: opp.id || "opp"
        };
    }
    
    function simulateGame(ctx, opponent) {
        var playerPower = 0, oppPower = 0;
        if (ctx.stats) for (var s in ctx.stats) if (ctx.stats.hasOwnProperty(s)) playerPower += ctx.stats[s] || 0;
        for (var s in opponent.stats) if (opponent.stats.hasOwnProperty(s)) oppPower += opponent.stats[s] || 0;
        var winChance = Math.max(0.1, Math.min(0.9, 0.5 + (playerPower - oppPower) * 0.02));
        return Math.random() < winChance;
    }
    
    // Character art dimensions
    var CHAR_ART_W = 40;
    var CHAR_ART_H = 20;
    var CHARACTERS_DIR = NBA_JAM_ROOT + "assets/characters/";
    
    /**
     * Get teammate commentary based on game outcome and stats
     */
    function getTeammateCommentary(won, scoreDiff, playerStats, teammate) {
        var name = teammate ? (teammate.shortNick || teammate.name || "Teammate") : "Teammate";
        var pts = playerStats ? (playerStats.points || 0) : 0;
        var ast = playerStats ? (playerStats.assists || 0) : 0;
        var stl = playerStats ? (playerStats.steals || 0) : 0;
        var blk = playerStats ? (playerStats.blocks || 0) : 0;
        var to = playerStats ? (playerStats.turnovers || 0) : 0;
        var dnk = playerStats ? (playerStats.dunks || 0) : 0;
        
        // Helper to pick random from array
        function pick(arr) {
            return arr[Math.floor(Math.random() * arr.length)];
        }
        
        if (won) {
            // Win commentary - varies by margin and performance
            if (scoreDiff >= 20) {
                return [
                    { speaker: name, text: pick(["We absolutely CRUSHED them!", "That was a MASSACRE!", "They didn't stand a chance!"]) },
                    { speaker: name, text: pick(["That's how we do it!", "Run it back any time!", "Too easy!"]) }
                ];
            } else if (dnk >= 3) {
                return [
                    { speaker: name, text: pick(["You were POSTERIZING fools out there!", "The rim is CRYING right now!", "Dunk contest material!"]) },
                    { speaker: name, text: pick(["Keep throwing it down!", "That's why they call you a highlight reel!"]) }
                ];
            } else if (pts >= 20) {
                return [
                    { speaker: name, text: pick(["You were ON FIRE!", "Couldn't miss today!", "Bucket after bucket!"]) },
                    { speaker: name, text: pick(["Keep dropping buckets like that!", "Scoring machine!", "They had no answer for you!"]) }
                ];
            } else if (ast >= 5) {
                return [
                    { speaker: name, text: pick(["Great dimes out there!", "You were dishing like crazy!", "Point god status!"]) },
                    { speaker: name, text: pick(["Keep finding the open man!", "Vision on point!"]) }
                ];
            } else if (stl + blk >= 4) {
                return [
                    { speaker: name, text: pick(["Defense wins championships!", "Lockdown mode activated!", "They couldn't get anything going!"]) },
                    { speaker: name, text: pick(["That's how you play D!", "Clamps all day!"]) }
                ];
            } else if (scoreDiff <= 3) {
                return [
                    { speaker: name, text: pick(["Whew! That was TOO close!", "Heart attack game!", "Down to the wire!"]) },
                    { speaker: name, text: pick(["A win's a win though!", "Ugly win still counts!", "Got it done when it mattered!"]) }
                ];
            } else {
                return [
                    { speaker: name, text: pick(["Good game! We got the W!", "Solid work out there!", "That's a dub!"]) },
                    { speaker: name, text: pick(["Stack that paper!", "Let's get paid!", "Money in the bank!"]) }
                ];
            }
        } else {
            // Loss commentary
            if (to >= 5) {
                return [
                    { speaker: name, text: pick(["Yo, you gotta take care of the rock!", "Too many turnovers, man...", "Can't give it away like that!"]) },
                    { speaker: name, text: pick(["Protect the ball next time.", "They feasted on those giveaways."]) }
                ];
            } else if (scoreDiff <= -20) {
                return [
                    { speaker: name, text: pick(["Man... we got embarrassed out there.", "That was rough...", "Let's never speak of this again."]) },
                    { speaker: name, text: pick(["We gotta hit the gym.", "Time to practice.", "Back to basics."]) }
                ];
            } else if (scoreDiff >= -3) {
                return [
                    { speaker: name, text: pick(["So close! We almost had 'em!", "Just needed one more bucket...", "That one stings."]) },
                    { speaker: name, text: pick(["We'll get 'em next time!", "Run it back!", "That's a learning experience."]) }
                ];
            } else {
                return [
                    { speaker: name, text: pick(["Tough loss.", "Not our day.", "They played well."]) },
                    { speaker: name, text: pick(["Shake it off, let's run it back!", "We'll bounce back.", "On to the next one."]) }
                ];
            }
        }
    }
    
    /**
     * Get the bin art path for a contact/teammate
     */
    function getTeammateBinPath(teammate) {
        if (!teammate) return null;
        
        // Contact id is like "allen_iverson" which matches the bin filename
        var id = teammate.id;
        if (!id && teammate.name) {
            // Generate from name if no id
            id = String(teammate.name).toLowerCase().replace(/[^a-z0-9]/g, "_");
        }
        if (!id) return null;
        
        var binPath = CHARACTERS_DIR + id + ".bin";
        
        // Check if file exists
        var f = new File(binPath);
        if (f.exists) {
            return binPath;
        }
        return null;
    }
    
    function showResult(view, won, scoreDiff, rewards, ctx, opponent, court) {
        cleanupSprite(view);
        
        // Get active teammate for commentary and art
        var teammate = null;
        if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getActiveTeammate) {
            teammate = LORB.Util.Contacts.getActiveTeammate(ctx);
        }
        
        // Load teammate art into the art zone (40x20)
        var artFrame = view.getZone("art");
        var artLoaded = false;
        if (artFrame && typeof BinLoader !== "undefined") {
            artFrame.clear();
            var binPath = getTeammateBinPath(teammate);
            if (binPath) {
                try {
                    BinLoader.loadIntoFrame(artFrame, binPath, CHAR_ART_W, CHAR_ART_H, 1, 1);
                    artLoaded = true;
                } catch (e) {
                    // Art load failed - that's ok
                }
            }
            
            // If no teammate art, show result banner in art zone
            if (!artLoaded) {
                artFrame.gotoxy(1, 8);
                if (won) {
                    artFrame.putmsg("\1h\1g         V I C T O R Y          \1n");
                    artFrame.gotoxy(1, 10);
                    artFrame.putmsg("\1h\1w           W I N !              \1n");
                } else {
                    artFrame.putmsg("\1h\1r          D E F E A T           \1n");
                    artFrame.gotoxy(1, 10);
                    artFrame.putmsg("\1h\1w          L O S S               \1n");
                }
            }
        }
        
        view.clearZone("content");
        view.setContentZone("content");
        view.setCursorY(0);
        
        // Get commentary lines (only if we have a real teammate with art)
        var commentary = [];
        if (teammate && artLoaded) {
            commentary = getTeammateCommentary(won, scoreDiff, rewards.playerStats, teammate);
        }
        
        // === HEADER SECTION (commentary banner - ~4 lines) ===
        view.line("\1h\1c" + (won ? "V I C T O R Y" : "D E F E A T") + "\1n  \1k(" + (won ? "+" : "") + scoreDiff + ")\1n");
        view.blank();
        
        // Teammate commentary (if we have a teammate with art)
        if (commentary.length > 0) {
            for (var c = 0; c < commentary.length && c < 2; c++) {
                var line = commentary[c];
                view.line("\1h\1y" + line.speaker + ":\1n \1w\"" + line.text + "\"\1n");
            }
            view.blank();
        }
        
        if (won) {
            // === LEDGER SECTION ===
            var hLine = "\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4";
            view.line("\1h\1y" + hLine + "\1n");
            view.line("\1h\1w         GAME EARNINGS LEDGER         \1n");
            view.line("\1h\1y" + hLine + "\1n");
            
            var ledgerLines = [];
            var runningTotal = 0;
            
            // Base win bonus
            var baseCash = rewards.grossCash || rewards.cash || 0;
            ledgerLines.push({ desc: "Win Bonus", amount: baseCash, positive: true });
            runningTotal += baseCash;
            
            // Crew cuts (if any)
            if (rewards.crewCuts && rewards.crewCuts.length > 0) {
                for (var i = 0; i < rewards.crewCuts.length; i++) {
                    var cut = rewards.crewCuts[i];
                    ledgerLines.push({ desc: cut.name + " cut (" + cut.percent + "%)", amount: -cut.amount, positive: false });
                    runningTotal -= cut.amount;
                }
            }
            
            // Stat bonuses
            if (rewards.statBreakdown && rewards.statBreakdown.length > 0) {
                for (var s = 0; s < rewards.statBreakdown.length; s++) {
                    var stat = rewards.statBreakdown[s];
                    if (stat.bonus !== 0) {
                        var desc = stat.stat + " x" + stat.count;
                        ledgerLines.push({ desc: desc, amount: stat.bonus, positive: stat.bonus >= 0 });
                        runningTotal += stat.bonus;
                    }
                }
            }
            
            // Print ledger lines
            for (var l = 0; l < ledgerLines.length; l++) {
                var entry = ledgerLines[l];
                var amtStr = entry.positive ? "+$" + Math.abs(entry.amount) : "-$" + Math.abs(entry.amount);
                var amtColor = entry.positive ? "\1g" : "\1r";
                // Right-align the amount
                var descPadded = entry.desc;
                while (descPadded.length < 26) descPadded += ".";
                view.line("  " + descPadded + " " + amtColor + amtStr + "\1n");
            }
            
            view.line("\1h\1y" + hLine + "\1n");
            view.line("  \1h\1wTOTAL CASH:             \1h\1g+$" + runningTotal + "\1n");
            view.line("  \1wRep:                    \1c+" + rewards.rep + "\1n");
            view.line("  \1wXP:                     \1w+" + rewards.xp + "\1n");
            view.line("\1h\1y" + hLine + "\1n");
            
            // Show new records if any
            if (rewards.newRecords && rewards.newRecords.length > 0) {
                view.blank();
                view.line("\1h\1m*** NEW PERSONAL RECORD! ***\1n");
                for (var r = 0; r < rewards.newRecords.length; r++) {
                    var rec = rewards.newRecords[r];
                    view.line("  \1c" + rec.name + ": " + rec.value + "\1n (prev: " + rec.previousRecord + ")");
                }
            }
            
            // Show new contact if acquired
            if (opponent.isNBA && rewards.newContact) {
                view.blank();
                view.line("\1h\1c" + rewards.newContact.name + " gave you their number!\1n");
            }
        } else {
            // Loss - simpler display
            var hLine = "\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4\xC4";
            view.line("\1h\1y" + hLine + "\1n");
            
            if (rewards.playerStats) {
                var ps = rewards.playerStats;
                view.line("  \1wYour Stats:\1n");
                view.line("  PTS: " + (ps.points || 0) + "  REB: " + (ps.rebounds || 0) + "  AST: " + (ps.assists || 0));
                view.line("  STL: " + (ps.steals || 0) + "  BLK: " + (ps.blocks || 0) + "  TO: " + (ps.turnovers || 0));
            }
            
            view.blank();
            view.line("\1rNo rewards for losers.\1n");
            view.line("\1kThe streets are unforgiving.\1n");
            view.line("\1h\1y" + hLine + "\1n");
        }
        
        view.blank();
        view.info("Press ENTER to continue...");
        view.render();
        
        // Wait specifically for ENTER key to prevent accidental dismissal
        var key;
        do {
            key = console.getkey();
        } while (key !== "\r" && key !== "\n");
    }
    
    function checkLevelUp(ctx, view) {
        var xpTable = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000];
        var lvl = ctx.level || 1;
        var nextXP = xpTable[lvl] || (lvl * 5000);
        if ((ctx.xp || 0) >= nextXP && lvl < 10) {
            ctx.level = lvl + 1;
            ctx.attributePoints = (ctx.attributePoints || 0) + 2;
            view.blank();
            view.line("\1h\1y*** LEVEL UP! ***\1n");
            view.line("You are now level " + ctx.level + "!");
            view.line("+2 Attribute Points");
        }
    }
    
    function playAtCourtRichView(view, court, ctx) {
        var opponent = generateOpponent(court, ctx);
        
        while (true) {
            var choice = showChallengerEncounter(view, court, opponent, ctx);
            
            if (choice === "back" || choice === null) {
                cleanupSprite(view);
                return;
            }
            
            if (choice === "reroll") {
                cleanupSprite(view);
                opponent = generateOpponent(court, ctx);
                continue;
            }
            
            if (choice === "play") {
                if (ctx.streetTurns <= 0) {
                    view.setContentZone("content");
                    view.warn("No street turns left!");
                    view.render();
                    console.getkey();
                    cleanupSprite(view);
                    return;
                }
                
                ctx.streetTurns--;
                if (!ctx.dayStats) ctx.dayStats = { gamesPlayed: 0, wins: 0, losses: 0, cashEarned: 0, repGained: 0 };
                ctx.dayStats.gamesPlayed++;
                
                var won = false, scoreDiff = 0;
                var playerGameStats = null;  // Stats from this game
                var gameResult = null;       // Full result object
                var realEngine = (typeof runExternalGame === "function");
                
                if (realEngine) {
                    view.setContentZone("content");
                    view.clearZone("content");
                    view.setCursorY(0);
                    view.line("\1h\1cLoading game...\1n");
                    view.render();
                    
                    cleanupSprite(view);
                    
                    var player = ctxToPlayer(ctx);
                    var opp1 = opponentToPlayer(opponent);
                    
                    // Use crew member as teammate if available, otherwise generate Streetballer
                    var crewTeammate = getCrewTeammate(ctx);
                    var teammate;
                    if (crewTeammate) {
                        teammate = crewTeammate;
                    } else {
                        teammate = generateStreetballOpponent({ difficulty: Math.max(1, court.difficulty - 1) });
                        teammate.name = "Streetballer";
                    }
                    
                    var opp2 = generateStreetballOpponent(court);
                    opp2.name = opponent.displayName + " Jr";
                    
                    // Get city-appropriate team colors for opponent
                    // (e.g., Barkley in Philadelphia wears Sixers colors, not Suns)
                    var oppTeamColors = { fg: "WHITE", bg: "BG_BLUE", fg_accent: "WHITE", bg_alt: "BG_BLUE" };
                    if (LORB && LORB.Cities && LORB.Cities.getToday && LORB.Cities.getRawTeamColors) {
                        var city = LORB.Cities.getToday();
                        if (city) {
                            oppTeamColors = LORB.Cities.getRawTeamColors(city);
                        }
                    }
                    
                    // Get hydrated crew for substitution system
                    var hydratedCrew = [];
                    if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getCrewWithContacts) {
                        hydratedCrew = LORB.Util.Contacts.getCrewWithContacts(ctx);
                    }
                    
                    var config = {
                        teamA: { name: (ctx.name || "Player") + "'s Squad", abbr: "YOU", players: [player, opponentToPlayer(teammate)], colors: { fg: "WHITE", bg: "BG_RED" } },
                        teamB: { name: court.name + " Crew", abbr: "OPP", players: [opp1, opponentToPlayer(opp2)], colors: { fg: oppTeamColors.fg_accent, bg: oppTeamColors.bg_alt } },
                        options: { gameTime: 90, mode: "play", humanTeam: "teamA", humanPlayerIndex: 0, showMatchupScreen: true, showGameOverScreen: false },
                        lorbContext: { court: court.id, difficulty: court.difficulty, opponent: opponent, playerCtx: ctx, hydratedCrew: hydratedCrew }
                    };
                    
                    view.close();
                    var result = runExternalGame(config);
                    gameResult = result;
                    view = createView();
                    
                    if (result && result.completed) {
                        won = (result.winner === "teamA");
                        scoreDiff = result.score.teamA - result.score.teamB;
                        
                        // Extract player's stats from the game
                        // Look for stats with lorbId "player" or fallback to teamA_player1
                        if (result.playerStats) {
                            // First try the lorbId key
                            if (result.playerStats["player"]) {
                                playerGameStats = result.playerStats["player"];
                            } else if (result.playerStats["teamA_player1"]) {
                                playerGameStats = result.playerStats["teamA_player1"];
                            } else {
                                // Search through all stats for lorb player marker
                                for (var pid in result.playerStats) {
                                    if (result.playerStats.hasOwnProperty(pid)) {
                                        var ps = result.playerStats[pid];
                                        if (ps.lorbData && ps.lorbData.isLorbPlayer) {
                                            playerGameStats = ps;
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            // Normalize field goals format
                            if (playerGameStats) {
                                if (playerGameStats.fieldGoals) {
                                    playerGameStats.fgm = playerGameStats.fieldGoals.made || 0;
                                    playerGameStats.fga = playerGameStats.fieldGoals.attempted || 0;
                                }
                                if (playerGameStats.threePointers) {
                                    playerGameStats.tpm = playerGameStats.threePointers.made || 0;
                                    playerGameStats.tpa = playerGameStats.threePointers.attempted || 0;
                                }
                            }
                        }
                    } else if (result && result.exitReason === "quit") {
                        ctx.streetTurns++;
                        ctx.dayStats.gamesPlayed--;
                        view.setContentZone("content");
                        view.warn("Game abandoned.");
                        view.render();
                        console.getkey();
                        return;
                    } else {
                        won = simulateGame(ctx, opponent);
                        scoreDiff = won ? 10 : -5;
                    }
                } else {
                    cleanupSprite(view);
                    view.setContentZone("content");
                    view.clearZone("content");
                    view.setCursorY(0);
                    view.line("\1k(Simulating...)\1n");
                    view.render();
                    mswait(1500);
                    won = simulateGame(ctx, opponent);
                    scoreDiff = won ? Math.floor(Math.random() * 15) + 5 : -(Math.floor(Math.random() * 10) + 3);
                }
                
                if (won) {
                    ctx.wins = (ctx.wins || 0) + 1;
                    ctx.dayStats.wins++;
                    // Track season wins
                    if (LORB.Util && LORB.Util.CareerStats && LORB.Util.CareerStats.recordWinLoss) {
                        LORB.Util.CareerStats.recordWinLoss(ctx, true);
                    }
                    var rewards = calculateRewards(court, ctx, scoreDiff);
                    
                    // Record career stats and check for records
                    var statResult = null;
                    var statBonuses = null;
                    if (playerGameStats && LORB.Util && LORB.Util.CareerStats) {
                        // Get current season for per-season tracking
                        var seasonNum = (LORB.SharedState && LORB.SharedState.getInfo) 
                            ? (LORB.SharedState.getInfo().seasonNumber || 1) : 1;
                        statResult = LORB.Util.CareerStats.recordGame(ctx, playerGameStats, {
                            opponentName: opponent.displayName || opponent.name,
                            courtName: court.name,
                            seasonNumber: seasonNum
                        });
                        
                        // Calculate stat bonuses
                        statBonuses = LORB.Util.CareerStats.calculateBonuses(
                            playerGameStats, 
                            court.difficulty
                        );
                        
                        // Add stat bonuses to cash rewards
                        if (statBonuses && statBonuses.total) {
                            rewards.statBonus = statBonuses.total;
                            rewards.statBreakdown = statBonuses.breakdown;
                        }
                    }
                    rewards.playerStats = playerGameStats;
                    rewards.newRecords = statResult ? statResult.newRecords : [];
                    
                    // Apply crew cuts if any temp members (on base cash, not stat bonuses)
                    var cutResult = null;
                    if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.applyCrewCut) {
                        cutResult = LORB.Util.Contacts.applyCrewCut(ctx, rewards.cash);
                        rewards.grossCash = cutResult.gross;
                        rewards.cash = cutResult.net;
                        rewards.crewCuts = cutResult.cuts;
                    }
                    
                    // Calculate total cash (base after cuts + stat bonuses)
                    var totalCash = rewards.cash + (rewards.statBonus || 0);
                    
                    ctx.cash = (ctx.cash || 0) + totalCash;
                    ctx.rep = (ctx.rep || 0) + rewards.rep;
                    ctx.xp = (ctx.xp || 0) + rewards.xp;
                    ctx.dayStats.cashEarned += totalCash;
                    ctx.dayStats.repGained += rewards.rep;
                    
                    // Award contact if defeated NBA player
                    var newContact = null;
                    if (opponent.isNBA && LORB.Util && LORB.Util.Contacts) {
                        newContact = LORB.Util.Contacts.awardContactFromVictory(ctx, opponent);
                    }
                    rewards.newContact = newContact;
                    
                    showResult(view, true, scoreDiff, rewards, ctx, opponent, court);
                    checkLevelUp(ctx, view);
                } else {
                    ctx.losses = (ctx.losses || 0) + 1;
                    ctx.dayStats.losses++;
                    // Track season losses
                    if (LORB.Util && LORB.Util.CareerStats && LORB.Util.CareerStats.recordWinLoss) {
                        LORB.Util.CareerStats.recordWinLoss(ctx, false);
                    }
                    
                    // Still record career stats even on loss
                    if (playerGameStats && LORB.Util && LORB.Util.CareerStats) {
                        // Get current season for per-season tracking
                        var seasonNum = (LORB.SharedState && LORB.SharedState.getInfo) 
                            ? (LORB.SharedState.getInfo().seasonNumber || 1) : 1;
                        LORB.Util.CareerStats.recordGame(ctx, playerGameStats, {
                            opponentName: opponent.displayName || opponent.name,
                            courtName: court.name,
                            seasonNumber: seasonNum
                        });
                    }
                    
                    showResult(view, false, scoreDiff, { playerStats: playerGameStats }, ctx, opponent, court);
                }
                
                ctx.gamesPlayed = (ctx.gamesPlayed || 0) + 1;
                return;
            }
        }
    }
    
    function runRichView(ctx) {
        var view = createView();
        
        while (true) {
            view.clearZone("art");
            view.clearZone("content");
            
            view.setContentZone("content");
            view.setCursorY(0);
            view.header("HIT THE COURTS");
            view.blank();
            view.line("Choose your battleground.");
            view.blank();
            view.line("Higher courts = better rewards");
            view.line("and tougher opponents.");
            view.blank();
            view.line("NBA players can appear at any");
            view.line("court - higher courts have");
            view.line("better odds!");
            view.blank();
            view.line("Street Turns: " + (ctx.streetTurns > 0 ? "\1g" : "\1r") + ctx.streetTurns + "\1n");
            var nextCourt = getRepToNextCourt(ctx);
            if (nextCourt) {
                view.line("Rep: \1c" + (ctx.rep || 0) + "\1n \1m(\1h\1m" + nextCourt.needed + " to next court\1n\1m)\1n");
            } else {
                view.line("Rep: \1c" + (ctx.rep || 0) + "\1n \1m(\1h\1mMAX\1n\1m)\1n");
            }
            
            view.setContentZone("art");
            view.setCursorY(0);
            view.header("SELECT COURT");
            view.blank();
            
            var items = buildCourtMenuItems(ctx);
            var choice = view.menu(items, {
                y: 3,
                multiline: true,
                detailIndent: 2,
                onSelect: function(item, index, rv) {
                    if (item._court) drawCourtPreview(rv, item._court, item._unlocked);
                    rv.render();
                }
            });
            
            if (!choice || choice === "back") {
                view.close();
                return;
            }
            
            var court = null;
            for (var id in COURTS) {
                if (COURTS.hasOwnProperty(id) && id === choice) {
                    court = COURTS[id];
                    break;
                }
            }
            
            if (court) playAtCourtRichView(view, court, ctx);
        }
    }
    
    // Legacy fallback
    function runLegacy(ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("STREETBALL COURTS");
            LORB.View.line("");
            LORB.View.line("Street Turns: " + (ctx.streetTurns > 0 ? "\1g" : "\1r") + ctx.streetTurns + "\1n");
            LORB.View.line("");
            
            var courts = getAvailableCourts(ctx);
            var num = 1;
            for (var i = 0; i < courts.length; i++) {
                var c = courts[i];
                if (c.unlocked) {
                    LORB.View.line("\1w[\1h" + num + "\1n\1w]\1n " + c.court.name + (c.court.boss ? " \1r[BOSS]\1n" : ""));
                } else {
                    LORB.View.line("\1k[" + num + "] " + c.court.name + " (Need " + c.repNeeded + " rep)\1n");
                }
                num++;
            }
            
            LORB.View.line("");
            LORB.View.line("\1w[\1hQ\1n\1w]\1n Back");
            var choice = LORB.View.prompt("Choice: ");
            
            if (choice.toUpperCase() === "Q") return;
            
            var idx = parseInt(choice, 10) - 1;
            if (idx >= 0 && idx < courts.length && courts[idx].unlocked) {
                playAtCourtLegacy(courts[idx].court, ctx);
            }
        }
    }
    
    function playAtCourtLegacy(court, ctx) {
        if (ctx.streetTurns <= 0) {
            LORB.View.warn("No street turns left!");
            console.getkey();
            return;
        }
        
        var opp = generateOpponent(court, ctx);
        LORB.View.clear();
        LORB.View.header(court.name + " - " + court.tagline);
        LORB.View.line("");
        LORB.View.line("A challenger approaches...");
        LORB.View.line("\1h\1y" + opp.displayName + "\1n" + (opp.isNBA ? " \1m[NBA]\1n" : ""));
        LORB.View.line("");
        LORB.View.line("\1w[P]\1nlay  \1w[B]\1nack");
        
        if (LORB.View.prompt("Choice: ").toUpperCase() !== "P") return;
        
        ctx.streetTurns--;
        LORB.View.line("\1k(Simulating...)\1n");
        mswait(1500);
        
        var won = simulateGame(ctx, opp);
        var diff = won ? Math.floor(Math.random() * 15) + 5 : -(Math.floor(Math.random() * 10) + 3);
        
        LORB.View.clear();
        LORB.View.header("GAME OVER");
        if (won) {
            var rewards = calculateRewards(court, ctx, diff);
            
            // Apply crew cuts
            if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.applyCrewCut) {
                var cutResult = LORB.Util.Contacts.applyCrewCut(ctx, rewards.cash);
                rewards.cash = cutResult.net;
            }
            
            ctx.wins = (ctx.wins || 0) + 1;
            // Track season wins
            if (LORB.Util && LORB.Util.CareerStats && LORB.Util.CareerStats.recordWinLoss) {
                LORB.Util.CareerStats.recordWinLoss(ctx, true);
            }
            ctx.cash = (ctx.cash || 0) + rewards.cash;
            ctx.rep = (ctx.rep || 0) + rewards.rep;
            ctx.xp = (ctx.xp || 0) + rewards.xp;
            
            // Award contact if NBA player
            if (opp.isNBA && LORB.Util && LORB.Util.Contacts) {
                var newContact = LORB.Util.Contacts.awardContactFromVictory(ctx, opp);
                if (newContact) {
                    LORB.View.line("\1c" + newContact.name + " gave you their number!\1n");
                }
            }
            
            LORB.View.line("\1h\1gYOU WIN!\1n +$" + rewards.cash + " / +" + rewards.rep + " rep");
        } else {
            ctx.losses = (ctx.losses || 0) + 1;
            // Track season losses
            if (LORB.Util && LORB.Util.CareerStats && LORB.Util.CareerStats.recordWinLoss) {
                LORB.Util.CareerStats.recordWinLoss(ctx, false);
            }
            LORB.View.line("\1h\1rYOU LOSE\1n");
        }
        ctx.gamesPlayed = (ctx.gamesPlayed || 0) + 1;
        LORB.View.line("");
        LORB.View.line("Press any key...");
        console.getkey();
    }
    
    function repeatChar(ch, n) {
        var s = "";
        for (var i = 0; i < n; i++) s += ch;
        return s;
    }
    
    function run(ctx) {
        return RichView ? runRichView(ctx) : runLegacy(ctx);
    }
    
    if (!LORB.Locations) LORB.Locations = {};
    LORB.Locations.Courts = {
        run: run,
        COURTS: COURTS,
        getAvailableCourts: getAvailableCourts,
        generateOpponent: generateOpponent,
        getNBAOpponent: getNBAOpponent
    };
    
})();
