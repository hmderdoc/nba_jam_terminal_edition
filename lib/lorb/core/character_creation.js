/**
 * character_creation.js - LORB Character Creation Flow
 * 
 * LoRD-style character creation for Legend of the Red Bull.
 * Handles: intro, archetype selection, stat allocation, background, and finalization.
 */
(function() {
    
    // Base stats before any modifications
    var BASE_STATS = {
        speed: 4,
        threePt: 4,
        power: 4,
        steal: 4,
        block: 4,
        dunk: 4
    };
    
    var STARTING_POINTS = 12;
    var MAX_STAT = 10;
    var MIN_STAT = 1;
    var BASE_CASH = 1000;
    var BASE_REP = 0;
    
    // Appearance options for character customization
    var APPEARANCE_OPTIONS = {
        skinColors: [
            { id: "brown", name: "Brown", preview: "\1" + String.fromCharCode(2) + "█\1n" },
            { id: "lightgray", name: "Light", preview: "\1w█\1n" },
            { id: "magenta", name: "Dark", preview: "\1m█\1n" }
        ],
        eyeColors: [
            { id: "BROWN", name: "Brown", preview: "\1" + String.fromCharCode(2) + "●\1n" },
            { id: "BLUE", name: "Blue", preview: "\1b●\1n" },
            { id: "GREEN", name: "Green", preview: "\1g●\1n" },
            { id: "LIGHTGRAY", name: "Gray", preview: "\1w●\1n" },
            { id: "BLACK", name: "Black", preview: "\1k\1h●\1n" }
        ],
        jerseyColors: [
            { id: "RED", name: "Red", preview: "\1r█\1n" },
            { id: "BLUE", name: "Blue", preview: "\1b█\1n" },
            { id: "GREEN", name: "Green", preview: "\1g█\1n" },
            { id: "YELLOW", name: "Yellow", preview: "\1y█\1n" },
            { id: "CYAN", name: "Cyan", preview: "\1c█\1n" },
            { id: "MAGENTA", name: "Purple", preview: "\1m█\1n" },
            { id: "WHITE", name: "White", preview: "\1h\1w█\1n" },
            { id: "BLACK", name: "Black", preview: "\1k\1h█\1n" }
        ]
    };
    
    /**
     * Display the intro narrative
     */
    function showIntro() {
        LORB.View.clear();
        
        var lines = [
            "",
            "\1h\1rL E G E N D   O F   T H E   R E D   B U L L\1n",
            "",
            "\1cThe city never sleeps. Neither do its courts.\1n",
            "",
            "They say there's a place where ballers go to become legends.",
            "Where the concrete burns and the rims never rust.",
            "Where a can of Red Bull can change your fate.",
            "",
            "\1yRim City.\1n",
            "",
            "The courts here have seen everything. Ankle-breakers.",
            "Poster dunks. Careers made and ended in a single possession.",
            "",
            "And at the center of it all... \1rThe Court of Airness.\1n",
            "Where \1rThe Red Bull\1n waits.",
            "",
            "No one has beaten it. Not yet.",
            "",
            "\1wBut first, you need to prove you belong here.\1n",
            ""
        ];
        
        for (var i = 0; i < lines.length; i++) {
            LORB.View.line(lines[i]);
        }
        
        LORB.View.line("\1h\1wPress any key to begin your journey...\1n");
        console.getkey();
    }
    
    /**
     * Get player name
     */
    function getPlayerName(defaultName) {
        LORB.View.clear();
        LORB.View.header("WHAT DO THEY CALL YOU?");
        LORB.View.line("");
        LORB.View.line("Every legend needs a name. What's yours?");
        LORB.View.line("");
        LORB.View.line("\1kDefault: " + defaultName + "\1n");
        LORB.View.line("");
        
        var name = LORB.View.prompt("Your name (or Enter for default): ");
        if (!name || name.trim() === "") {
            name = defaultName;
        }
        
        // Sanitize: max 20 chars, alphanumeric and spaces only
        name = name.substring(0, 20).replace(/[^a-zA-Z0-9 _-]/g, "");
        if (!name || name.trim() === "") {
            name = defaultName;
        }
        
        return name.trim();
    }
    
    /**
     * Choose archetype
     */
    function chooseArchetype() {
        var archetypes = LORB.Data.getArchetypeList();
        
        while (true) {
            LORB.View.clear();
            LORB.View.header("CHOOSE YOUR PLAYSTYLE");
            LORB.View.line("");
            LORB.View.line("How do you dominate on the court?");
            LORB.View.line("");
            
            for (var i = 0; i < archetypes.length; i++) {
                var arch = archetypes[i];
                LORB.View.line("\1h\1w" + (i + 1) + ")\1n \1y" + arch.name + "\1n");
                LORB.View.line("   " + arch.description);
                
                // Show stat mods
                var mods = [];
                for (var stat in arch.statMods) {
                    if (arch.statMods.hasOwnProperty(stat)) {
                        var val = arch.statMods[stat];
                        var prefix = val > 0 ? "\1g+" : "\1r";
                        mods.push(prefix + val + " " + stat.toUpperCase() + "\1n");
                    }
                }
                if (mods.length > 0) {
                    LORB.View.line("   " + mods.join(", "));
                }
                
                LORB.View.line("   \1cSpecial:\1n " + arch.special.name + " - " + arch.special.description);
                LORB.View.line("");
            }
            
            var choice = LORB.View.prompt("Choose (1-" + archetypes.length + "): ");
            var idx = parseInt(choice, 10) - 1;
            
            if (idx >= 0 && idx < archetypes.length) {
                // Confirm selection
                LORB.View.clear();
                var selected = archetypes[idx];
                LORB.View.header(selected.name.toUpperCase());
                LORB.View.line("");
                LORB.View.line(selected.flavorText);
                LORB.View.line("");
                
                if (LORB.View.confirm("Choose " + selected.name + "? (Y/N) ")) {
                    return selected;
                }
            }
        }
    }
    
    /**
     * Allocate stat points
     */
    function allocateStats(archetype) {
        // Start with base stats + archetype mods
        var stats = {};
        for (var stat in BASE_STATS) {
            if (BASE_STATS.hasOwnProperty(stat)) {
                stats[stat] = BASE_STATS[stat];
                if (archetype.statMods && archetype.statMods[stat]) {
                    stats[stat] += archetype.statMods[stat];
                }
                // Clamp to valid range
                stats[stat] = Math.max(MIN_STAT, Math.min(MAX_STAT, stats[stat]));
            }
        }
        
        var pointsRemaining = STARTING_POINTS;
        var statKeys = ["speed", "threePt", "power", "steal", "block", "dunk"];
        var statLabels = {
            speed: "Speed",
            threePt: "3PT Shooting",
            power: "Power",
            steal: "Steal",
            block: "Block",
            dunk: "Dunk"
        };
        var statHotkeys = {
            "S": "speed",
            "3": "threePt",
            "P": "power",
            "T": "steal",
            "B": "block",
            "D": "dunk"
        };
        
        while (true) {
            LORB.View.clear();
            LORB.View.header("ALLOCATE YOUR ATTRIBUTES");
            LORB.View.line("");
            LORB.View.line("Distribute " + STARTING_POINTS + " points among your stats.");
            LORB.View.line("Stats range from " + MIN_STAT + " to " + MAX_STAT + ".");
            LORB.View.line("");
            LORB.View.line("\1h\1yPoints Remaining: " + pointsRemaining + "\1n");
            LORB.View.line("");
            
            for (var i = 0; i < statKeys.length; i++) {
                var key = statKeys[i];
                var hotkey = Object.keys(statHotkeys).find(function(k) { 
                    return statHotkeys[k] === key; 
                }) || key[0].toUpperCase();
                
                var bar = "";
                for (var b = 0; b < stats[key]; b++) bar += "\1g█\1n";
                for (var b = stats[key]; b < MAX_STAT; b++) bar += "\1k░\1n";
                
                var label = statLabels[key];
                while (label.length < 14) label += " ";
                
                LORB.View.line("[\1w" + hotkey + "\1n] " + label + " " + bar + " " + stats[key]);
            }
            
            LORB.View.line("");
            LORB.View.line("[\1wR\1n] Reset all points");
            LORB.View.line("[\1wQ\1n] Finish allocation");
            LORB.View.line("");
            
            var input = LORB.View.prompt("Add point to (S/3/P/T/B/D) or command: ");
            if (!input) continue;
            
            var cmd = input.toUpperCase();
            
            if (cmd === "Q") {
                if (pointsRemaining > 0) {
                    LORB.View.warn("You still have " + pointsRemaining + " points to spend!");
                    if (!LORB.View.confirm("Continue anyway? (Y/N) ")) {
                        continue;
                    }
                }
                return stats;
            }
            
            if (cmd === "R") {
                // Reset to base + archetype
                pointsRemaining = STARTING_POINTS;
                for (var stat in BASE_STATS) {
                    if (BASE_STATS.hasOwnProperty(stat)) {
                        stats[stat] = BASE_STATS[stat];
                        if (archetype.statMods && archetype.statMods[stat]) {
                            stats[stat] += archetype.statMods[stat];
                        }
                        stats[stat] = Math.max(MIN_STAT, Math.min(MAX_STAT, stats[stat]));
                    }
                }
                continue;
            }
            
            // Check if it's a stat hotkey
            if (statHotkeys[cmd]) {
                var targetStat = statHotkeys[cmd];
                
                if (pointsRemaining <= 0) {
                    LORB.View.warn("No points remaining! Press R to reset.");
                    console.getkey();
                    continue;
                }
                
                if (stats[targetStat] >= MAX_STAT) {
                    LORB.View.warn(statLabels[targetStat] + " is already at maximum!");
                    console.getkey();
                    continue;
                }
                
                stats[targetStat]++;
                pointsRemaining--;
            }
            
            // Allow minus with shift (lowercase letter followed by -)
            if (cmd.length === 2 && cmd[1] === "-") {
                var minusKey = cmd[0];
                if (statHotkeys[minusKey]) {
                    var targetStat = statHotkeys[minusKey];
                    var baseVal = BASE_STATS[targetStat] + (archetype.statMods[targetStat] || 0);
                    baseVal = Math.max(MIN_STAT, Math.min(MAX_STAT, baseVal));
                    
                    if (stats[targetStat] <= baseVal) {
                        LORB.View.warn("Can't reduce below base value!");
                        console.getkey();
                        continue;
                    }
                    
                    stats[targetStat]--;
                    pointsRemaining++;
                }
            }
        }
    }
    
    /**
     * Choose background
     */
    function chooseBackground() {
        var backgrounds = LORB.Data.getBackgroundList();
        
        while (true) {
            LORB.View.clear();
            LORB.View.header("WHERE DID YOU COME FROM?");
            LORB.View.line("");
            LORB.View.line("Every legend has an origin story.");
            LORB.View.line("");
            
            for (var i = 0; i < backgrounds.length; i++) {
                var bg = backgrounds[i];
                LORB.View.line("\1h\1w" + (i + 1) + ")\1n \1y" + bg.name + "\1n");
                LORB.View.line("   " + bg.description);
                
                // Show resource mods
                var mods = [];
                if (bg.resourceMods.cash !== 0) {
                    var prefix = bg.resourceMods.cash > 0 ? "\1g+" : "\1r";
                    mods.push(prefix + "$" + bg.resourceMods.cash + "\1n");
                }
                if (bg.resourceMods.rep !== 0) {
                    var prefix = bg.resourceMods.rep > 0 ? "\1g+" : "\1r";
                    mods.push(prefix + bg.resourceMods.rep + " Rep\1n");
                }
                
                // Show stat mods if any
                if (bg.statMods && !bg.statMods._random) {
                    for (var stat in bg.statMods) {
                        if (bg.statMods.hasOwnProperty(stat)) {
                            var val = bg.statMods[stat];
                            var prefix = val > 0 ? "\1g+" : "\1r";
                            mods.push(prefix + val + " " + stat.toUpperCase() + "\1n");
                        }
                    }
                }
                if (bg.statMods && bg.statMods._random) {
                    mods.push("\1m?? Random stats\1n");
                }
                
                if (mods.length > 0) {
                    LORB.View.line("   " + mods.join(", "));
                }
                LORB.View.line("");
            }
            
            var choice = LORB.View.prompt("Choose (1-" + backgrounds.length + "): ");
            var idx = parseInt(choice, 10) - 1;
            
            if (idx >= 0 && idx < backgrounds.length) {
                // Confirm selection
                LORB.View.clear();
                var selected = backgrounds[idx];
                LORB.View.header(selected.name.toUpperCase());
                LORB.View.line("");
                LORB.View.line(selected.flavorText);
                LORB.View.line("");
                
                if (LORB.View.confirm("Choose " + selected.name + "? (Y/N) ")) {
                    return selected;
                }
            }
        }
    }
    
    /**
     * Apply background modifications and randomize if needed
     */
    function applyBackground(stats, background, ctx) {
        // Apply resource mods
        ctx.cash = BASE_CASH + (background.resourceMods.cash || 0);
        ctx.rep = BASE_REP + (background.resourceMods.rep || 0);
        
        // Apply stat mods
        if (background.statMods) {
            if (background.statMods._random) {
                // Mystery lab creation: random spike and dump
                var statKeys = Object.keys(stats);
                var spike = statKeys[Math.floor(Math.random() * statKeys.length)];
                var dump = statKeys[Math.floor(Math.random() * statKeys.length)];
                while (dump === spike) {
                    dump = statKeys[Math.floor(Math.random() * statKeys.length)];
                }
                
                stats[spike] = Math.min(MAX_STAT, stats[spike] + 3);
                stats[dump] = Math.max(MIN_STAT, stats[dump] - 2);
                
                LORB.View.line("");
                LORB.View.line("\1mThe Red Bull surges through you...\1n");
                LORB.View.line("\1g+" + 3 + " " + spike.toUpperCase() + "\1n");
                LORB.View.line("\1r-" + 2 + " " + dump.toUpperCase() + "\1n");
                console.getkey();
            } else {
                for (var stat in background.statMods) {
                    if (background.statMods.hasOwnProperty(stat) && stats[stat] !== undefined) {
                        stats[stat] += background.statMods[stat];
                        stats[stat] = Math.max(MIN_STAT, Math.min(MAX_STAT, stats[stat]));
                    }
                }
            }
        }
        
        // Store perks
        ctx.perks = background.perks || [];
    }
    
    /**
     * Customize character appearance
     * Sets: skin, eyeColor, jerseyColor, jerseyNumber, nickname
     */
    function customizeAppearance(ctx) {
        // Initialize appearance with defaults
        ctx.appearance = ctx.appearance || {};
        ctx.appearance.skin = ctx.appearance.skin || "brown";
        ctx.appearance.eyeColor = ctx.appearance.eyeColor || "BROWN";
        ctx.appearance.jerseyColor = ctx.appearance.jerseyColor || "RED";
        ctx.appearance.jerseyNumber = ctx.appearance.jerseyNumber || String(Math.floor(Math.random() * 99) + 1);
        ctx.nickname = ctx.nickname || "";
        
        var currentOption = 0;
        var options = ["skin", "eyes", "jersey", "number", "nickname", "done"];
        
        while (true) {
            LORB.View.clear();
            LORB.View.header("CUSTOMIZE YOUR LOOK");
            LORB.View.line("");
            LORB.View.line("Stand out on the court. Make them remember you.");
            LORB.View.line("");
            
            // Show current appearance
            var skinOpt = findOption(APPEARANCE_OPTIONS.skinColors, ctx.appearance.skin);
            var eyeOpt = findOption(APPEARANCE_OPTIONS.eyeColors, ctx.appearance.eyeColor);
            var jerseyOpt = findOption(APPEARANCE_OPTIONS.jerseyColors, ctx.appearance.jerseyColor);
            
            LORB.View.line((currentOption === 0 ? "\1h\1y>\1n " : "  ") + 
                "\1w1)\1n Skin Tone:    " + (skinOpt ? skinOpt.preview + " " + skinOpt.name : ctx.appearance.skin));
            LORB.View.line((currentOption === 1 ? "\1h\1y>\1n " : "  ") + 
                "\1w2)\1n Eye Color:    " + (eyeOpt ? eyeOpt.preview + " " + eyeOpt.name : ctx.appearance.eyeColor));
            LORB.View.line((currentOption === 2 ? "\1h\1y>\1n " : "  ") + 
                "\1w3)\1n Jersey Color: " + (jerseyOpt ? jerseyOpt.preview + " " + jerseyOpt.name : ctx.appearance.jerseyColor));
            LORB.View.line((currentOption === 3 ? "\1h\1y>\1n " : "  ") + 
                "\1w4)\1n Jersey #:     \1h" + ctx.appearance.jerseyNumber + "\1n");
            LORB.View.line((currentOption === 4 ? "\1h\1y>\1n " : "  ") + 
                "\1w5)\1n Nickname:     \1c" + (ctx.nickname || "(none)") + "\1n");
            LORB.View.line("");
            LORB.View.line((currentOption === 5 ? "\1h\1y>\1n " : "  ") + 
                "\1w6)\1n \1gDone - Continue\1n");
            LORB.View.line("");
            
            var input = LORB.View.prompt("Choose option (1-6): ");
            if (!input) continue;
            
            var choice = parseInt(input, 10);
            
            if (choice === 1) {
                ctx.appearance.skin = cycleOption(APPEARANCE_OPTIONS.skinColors, ctx.appearance.skin);
            } else if (choice === 2) {
                ctx.appearance.eyeColor = cycleOption(APPEARANCE_OPTIONS.eyeColors, ctx.appearance.eyeColor);
            } else if (choice === 3) {
                ctx.appearance.jerseyColor = cycleOption(APPEARANCE_OPTIONS.jerseyColors, ctx.appearance.jerseyColor);
            } else if (choice === 4) {
                LORB.View.line("");
                var numInput = LORB.View.prompt("Enter jersey number/text (1-2 chars): ");
                if (numInput && numInput.length > 0) {
                    // Sanitize: max 2 chars, alphanumeric
                    ctx.appearance.jerseyNumber = numInput.substring(0, 2).replace(/[^a-zA-Z0-9]/g, "");
                    if (!ctx.appearance.jerseyNumber) {
                        ctx.appearance.jerseyNumber = String(Math.floor(Math.random() * 99) + 1);
                    }
                }
            } else if (choice === 5) {
                LORB.View.line("");
                LORB.View.line("Your nickname appears above your player on the court.");
                LORB.View.line("Keep it short (8 chars max) for best display.");
                var nickInput = LORB.View.prompt("Enter nickname: ");
                if (nickInput) {
                    // Sanitize: max 8 chars, alphanumeric and some special chars
                    ctx.nickname = nickInput.substring(0, 8).replace(/[^a-zA-Z0-9_\-!]/g, "").toUpperCase();
                }
            } else if (choice === 6) {
                // Ensure nickname defaults to something if not set
                if (!ctx.nickname || ctx.nickname.trim() === "") {
                    // Use first part of name as fallback nickname
                    var nameParts = (ctx.name || "PLAYER").toUpperCase().split(" ");
                    ctx.nickname = nameParts[0].substring(0, 8);
                }
                return;
            }
        }
    }
    
    /**
     * Find an option in a list by ID
     */
    function findOption(optionList, id) {
        for (var i = 0; i < optionList.length; i++) {
            if (optionList[i].id === id) return optionList[i];
        }
        return null;
    }
    
    /**
     * Cycle to the next option in a list
     */
    function cycleOption(optionList, currentId) {
        for (var i = 0; i < optionList.length; i++) {
            if (optionList[i].id === currentId) {
                var nextIdx = (i + 1) % optionList.length;
                return optionList[nextIdx].id;
            }
        }
        return optionList[0].id;
    }
    
    /**
     * Show final character summary and confirm
     */
    function showSummary(name, archetype, background, stats, ctx) {
        while (true) {
            LORB.View.clear();
            LORB.View.header("YOUR LEGEND BEGINS");
            LORB.View.line("");
            LORB.View.line("\1wName:\1n        " + name);
            LORB.View.line("\1wArchetype:\1n   " + archetype.name);
            LORB.View.line("\1wBackground:\1n  " + background.name);
            LORB.View.line("");
            LORB.View.line("\1h\1ySTATS:\1n");
            
            var statLabels = {
                speed: "Speed",
                threePt: "3PT",
                power: "Power",
                steal: "Steal",
                block: "Block",
                dunk: "Dunk"
            };
            
            for (var stat in stats) {
                if (stats.hasOwnProperty(stat) && statLabels[stat]) {
                    var label = statLabels[stat];
                    while (label.length < 8) label += " ";
                    
                    var bar = "";
                    for (var b = 0; b < stats[stat]; b++) bar += "\1g█\1n";
                    for (var b = stats[stat]; b < MAX_STAT; b++) bar += "\1k░\1n";
                    
                    LORB.View.line("  " + label + " " + bar + " " + stats[stat]);
                }
            }
            
            LORB.View.line("");
            LORB.View.line("\1h\1yRESOURCES:\1n");
            LORB.View.line("  Cash:  \1g$" + ctx.cash + "\1n");
            LORB.View.line("  Rep:   " + ctx.rep);
            LORB.View.line("");
            
            // Show appearance
            LORB.View.line("\1h\1yAPPEARANCE:\1n");
            if (ctx.appearance) {
                var skinOpt = findOption(APPEARANCE_OPTIONS.skinColors, ctx.appearance.skin);
                var eyeOpt = findOption(APPEARANCE_OPTIONS.eyeColors, ctx.appearance.eyeColor);
                var jerseyOpt = findOption(APPEARANCE_OPTIONS.jerseyColors, ctx.appearance.jerseyColor);
                LORB.View.line("  Skin: " + (skinOpt ? skinOpt.preview + " " + skinOpt.name : ctx.appearance.skin) +
                    "  Eyes: " + (eyeOpt ? eyeOpt.preview + " " + eyeOpt.name : ctx.appearance.eyeColor));
                LORB.View.line("  Jersey: " + (jerseyOpt ? jerseyOpt.preview : "") + " #" + ctx.appearance.jerseyNumber);
            }
            LORB.View.line("  Nickname: \1c" + (ctx.nickname || "none") + "\1n");
            LORB.View.line("");
            
            LORB.View.line("\1h\1ySPECIAL:\1n " + archetype.special.name);
            LORB.View.line("  " + archetype.special.description);
            LORB.View.line("");
            
            if (ctx.perks && ctx.perks.length > 0) {
                LORB.View.line("\1h\1yPERKS:\1n " + ctx.perks.join(", "));
                LORB.View.line("");
            }
            
            LORB.View.line("\1wProceed into Rim City? (Y/N/R=Restart)\1n");
            var choice = LORB.View.prompt("");
            
            if (!choice) continue;
            choice = choice.toUpperCase();
            
            if (choice === "Y") {
                return true;
            } else if (choice === "R") {
                return false;  // Signal to restart creation
            }
        }
    }
    
    /**
     * Main character creation flow
     * Returns a fully initialized character context, or null if user quits
     */
    function runCharacterCreation(user, systemObj) {
        while (true) {
            // Initialize a fresh context
            var ctx = {
                _user: user,
                seed: (systemObj.timer ^ (Date.now ? Date.now() : time())) & 0x7fffffff,
                userHandle: user && user.alias ? user.alias : "PLAYER",
                dayTurns: LORB.Config.DEFAULT_TURNS,
                flags: {},
                xp: 0,
                level: 1,
                gamesPlayed: 0,
                wins: 0,
                losses: 0
            };
            
            // Show intro
            showIntro();
            
            // Get player name
            var defaultName = ctx.userHandle;
            var name = getPlayerName(defaultName);
            ctx.name = name;
            
            // Choose archetype
            var archetype = chooseArchetype();
            ctx.archetype = archetype.id;
            ctx.special = archetype.special.id;
            
            // Allocate stats
            var stats = allocateStats(archetype);
            
            // Choose background
            var background = chooseBackground();
            ctx.background = background.id;
            
            // Apply background effects
            applyBackground(stats, background, ctx);
            
            // Store final stats
            ctx.stats = stats;
            
            // Customize appearance (skin, eyes, jersey, nickname)
            customizeAppearance(ctx);
            
            // Show summary
            var confirmed = showSummary(name, archetype, background, stats, ctx);
            
            if (confirmed) {
                // Save the new character
                LORB.Persist.save(ctx);
                
                // Show welcome message
                LORB.View.clear();
                LORB.View.line("");
                LORB.View.line("\1h\1y" + name + " enters Rim City.\1n");
                LORB.View.line("");
                LORB.View.line("The courts await. The legends are watching.");
                LORB.View.line("");
                LORB.View.line("\1wPress any key to begin...\1n");
                console.getkey();
                
                return ctx;
            }
            // If not confirmed (user chose restart), loop continues
        }
    }
    
    // Export to LORB namespace
    LORB.CharacterCreation = {
        run: runCharacterCreation,
        BASE_STATS: BASE_STATS,
        STARTING_POINTS: STARTING_POINTS,
        MAX_STAT: MAX_STAT,
        MIN_STAT: MIN_STAT
    };
    
})();
