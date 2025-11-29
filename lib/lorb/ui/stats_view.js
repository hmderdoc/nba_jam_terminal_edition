/**
 * stats_view.js - Character Stats Display
 * 
 * Shows full character sheet with stats, equipment, and records.
 */
(function() {
    
    /**
     * Show full character stats
     */
    function show(ctx) {
        LORB.View.clear();
        LORB.View.header("PLAYER CARD: " + (ctx.name || ctx.userHandle || "Unknown"));
        LORB.View.line("");
        
        // Basic info
        var archetype = LORB.Data.ARCHETYPES ? LORB.Data.ARCHETYPES[ctx.archetype] : null;
        var background = LORB.Data.BACKGROUNDS ? LORB.Data.BACKGROUNDS[ctx.background] : null;
        
        if (archetype) {
            LORB.View.line("\1wArchetype:\1n " + archetype.name);
        }
        if (background) {
            LORB.View.line("\1wBackground:\1n " + background.name);
        }
        LORB.View.line("\1wLevel:\1n " + (ctx.level || 1) + "  \1wDay:\1n " + (ctx.day || 1));
        LORB.View.line("");
        
        // Stats with equipment mods
        LORB.View.line("\1h\1y═══ STATS ═══\1n");
        
        var baseStats = ctx.stats || {};
        var effectiveStats = (LORB.Locations && LORB.Locations.Shop) ? 
            LORB.Locations.Shop.getEffectiveStats(ctx) : baseStats;
        
        var statLabels = {
            speed: "Speed",
            threePt: "3-Point",
            power: "Power",
            steal: "Steal",
            block: "Block",
            dunk: "Dunk"
        };
        
        for (var stat in statLabels) {
            if (statLabels.hasOwnProperty(stat)) {
                var label = statLabels[stat];
                while (label.length < 8) label += " ";
                
                var base = baseStats[stat] || 4;
                var effective = effectiveStats[stat] || base;
                var diff = effective - base;
                
                // Build stat bar
                var bar = "";
                for (var b = 0; b < Math.min(effective, 10); b++) bar += "\1g█\1n";
                for (var b = Math.min(effective, 10); b < 10; b++) bar += "\1k░\1n";
                
                // Show mod if different
                var modStr = "";
                if (diff > 0) {
                    modStr = " \1c(+" + diff + ")\1n";
                } else if (diff < 0) {
                    modStr = " \1r(" + diff + ")\1n";
                }
                
                LORB.View.line("  " + label + " " + bar + " " + effective + modStr);
            }
        }
        
        LORB.View.line("");
        
        // Resources
        LORB.View.line("\1h\1y═══ RESOURCES ═══\1n");
        LORB.View.line("  Cash:  \1y$" + (ctx.cash || 0) + "\1n");
        LORB.View.line("  XP:    " + (ctx.xp || 0));
        LORB.View.line("  Rep:   \1c" + (ctx.rep || 0) + "\1n");
        
        if ((ctx.attributePoints || 0) > 0) {
            LORB.View.line("  \1h\1yAttribute Points: " + ctx.attributePoints + "\1n");
        }
        LORB.View.line("");
        
        // Record
        LORB.View.line("\1h\1y═══ RECORD ═══\1n");
        LORB.View.line("  Games Played: " + (ctx.gamesPlayed || 0));
        LORB.View.line("  Wins:         \1g" + (ctx.wins || 0) + "\1n");
        LORB.View.line("  Losses:       \1r" + (ctx.losses || 0) + "\1n");
        
        var winPct = ctx.gamesPlayed > 0 ? 
            Math.round((ctx.wins || 0) / ctx.gamesPlayed * 100) : 0;
        LORB.View.line("  Win Rate:     " + winPct + "%");
        LORB.View.line("");
        
        // Equipment
        LORB.View.line("\1h\1y═══ EQUIPMENT ═══\1n");
        
        if (ctx.equipment && ctx.equipment.feet) {
            var sneaker = (LORB.Locations && LORB.Locations.Shop) ? 
                LORB.Locations.Shop.SNEAKERS[ctx.equipment.feet] : null;
            if (sneaker) {
                LORB.View.line("  Sneakers: \1c" + sneaker.name + "\1n");
            }
        } else {
            LORB.View.line("  Sneakers: \1kNone\1n");
        }
        
        // Temp buffs
        if (ctx.tempBuffs) {
            var buffList = [];
            for (var b in ctx.tempBuffs) {
                if (ctx.tempBuffs.hasOwnProperty(b) && ctx.tempBuffs[b] > 0) {
                    buffList.push("+" + ctx.tempBuffs[b] + " " + b);
                }
            }
            if (buffList.length > 0) {
                LORB.View.line("  \1mActive Buffs: " + buffList.join(", ") + "\1n");
            }
        }
        
        LORB.View.line("");
        
        // Special ability
        if (archetype && archetype.special) {
            LORB.View.line("\1h\1y═══ SPECIAL ═══\1n");
            LORB.View.line("  \1h" + archetype.special.name + "\1n");
            LORB.View.line("  " + archetype.special.description);
            LORB.View.line("");
        }
        
        LORB.View.line("\1wPress any key to continue...\1n");
        console.getkey();
    }
    
    // Export to LORB namespace
    if (!LORB.UI) LORB.UI = {};
    LORB.UI.StatsView = {
        show: show
    };
    
})();
