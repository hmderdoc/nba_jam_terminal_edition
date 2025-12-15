/**
 * stats_view.js - Character Stats & Records Display
 * 
 * Two-column RichView layout showing:
 * - Left: Player sprite preview with nametag
 * - Right: Stats, career averages, personal records
 */

var _statsRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _statsRichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[STATS_VIEW] Failed to load RichView: " + e);
}

// Ensure BinLoader is available
if (typeof BinLoader === "undefined") {
    try {
        load("/sbbs/xtrn/nba_jam/lib/lorb/util/bin_loader.js");
    } catch (e) {
        log(LOG_WARNING, "[STATS_VIEW] Failed to load BinLoader: " + e);
    }
}

(function() {
    
    var RichView = _statsRichView;
    var NBA_JAM_ROOT = "/sbbs/xtrn/nba_jam/";
    
    // Sprite dimensions
    var SPRITE_WIDTH = 5;
    var SPRITE_HEIGHT = 4;
    
    // CP437 box drawing characters
    var HLINE = "\xC4";  // horizontal line
    var VLINE = "\xB3";  // vertical line
    var TL = "\xDA";     // top-left corner
    var TR = "\xBF";     // top-right corner
    var BL = "\xC0";     // bottom-left corner
    var BR = "\xD9";     // bottom-right corner
    
    /**
     * Main show function
     */
    function show(ctx) {
        if (RichView) {
            return showRichView(ctx);
        } else {
            return showLegacy(ctx);
        }
    }
    
    /**
     * RichView two-column layout
     */
    function showRichView(ctx) {
        var showPvpStats = false;  // Toggle between career and PvP stats
        
        while (true) {
            var hLine = repeatChar(HLINE, 78);
            
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 3 },
                    { name: "left", x: 1, y: 4, width: 24, height: 20 },
                    { name: "right", x: 25, y: 4, width: 56, height: 20 },
                    { name: "footer", x: 1, y: 24, width: 80, height: 1 }
                ],
                theme: "lorb"
            });
            
            // Header
            var headerFrame = view.getZone("header");
            if (headerFrame) {
                headerFrame.gotoxy(1, 1);
                headerFrame.putmsg("\1h\1y" + hLine + "\1n");
                headerFrame.gotoxy(1, 2);
                var modeLabel = showPvpStats ? "\1h\1m[PVP STATS]\1n" : "\1h\1c[CAREER STATS]\1n";
                headerFrame.putmsg("  STATS & RECORDS: \1h\1c" + (ctx.name || ctx.nickname || ctx.userHandle || "Unknown") + "\1n  " + modeLabel);
                headerFrame.gotoxy(1, 3);
                headerFrame.putmsg("\1h\1y" + hLine + "\1n");
            }
            
            // Left panel: Player sprite preview
            var leftFrame = view.getZone("left");
            if (leftFrame) {
                drawPlayerPreview(leftFrame, ctx);
            }
            
            // Right panel: Career or PvP stats based on toggle
            var rightFrame = view.getZone("right");
            if (rightFrame) {
                if (showPvpStats) {
                    drawPvpStatsPanel(rightFrame, ctx);
                } else {
                    drawStatsPanel(rightFrame, ctx);
                }
            }
            
            // Footer
            var footerFrame = view.getZone("footer");
            if (footerFrame) {
                footerFrame.gotoxy(1, 1);
                var toggleLabel = showPvpStats ? "Career" : "PvP";
                footerFrame.putmsg("  \1h\1w[P]\1n\1c Toggle " + toggleLabel + " Stats   \1h\1w[Q]\1n\1c Back\1n");
            }
            
            view.render();
            
            var key = console.getkey();
            view.close();
            
            if (key === "p" || key === "P") {
                showPvpStats = !showPvpStats;
                continue;  // Redraw with new mode
            }
            
            // Any other key exits
            break;
        }
    }
    
    /**
     * Draw the player preview in the left panel
     */
    function drawPlayerPreview(frame, ctx) {
        var w = 22;
        
        // Title box
        frame.gotoxy(1, 1);
        frame.putmsg("\1n\1c" + TL + repeatChar(HLINE, w) + TR + "\1n");
        frame.gotoxy(1, 2);
        frame.putmsg("\1n\1c" + VLINE + "\1h\1w      PLAYER        \1n\1c" + VLINE + "\1n");
        frame.gotoxy(1, 3);
        frame.putmsg("\1n\1c" + VLINE + repeatChar(" ", w) + VLINE + "\1n");
        
        // Nametag position (above sprite)
        var spriteX = 9;
        var spriteY = 7;
        
        // Draw nametag
        if (ctx.nickname) {
            var nametagFg = getColorCtrlCode(ctx.appearance ? ctx.appearance.nametagFg : "WHITE");
            var nametagBg = getBgColorCtrlCode(ctx.appearance ? ctx.appearance.nametagBg : "BLACK");
            var nameLen = ctx.nickname.length;
            var nameX = Math.floor((w - nameLen) / 2) + 1;
            
            frame.gotoxy(nameX, spriteY - 1);
            frame.putmsg(nametagBg + nametagFg + ctx.nickname + "\1n");
        }
        
        // Load and render sprite using BinLoader
        var spriteLoaded = false;
        if (typeof BinLoader !== "undefined" && ctx.appearance) {
            try {
                var skin = (ctx.appearance.skin || "brown").toLowerCase();
                var binPath = NBA_JAM_ROOT + "sprites/player-" + skin + ".bin";
                
                var binData = BinLoader.loadBinFile(binPath);
                if (binData) {
                    var pixels = parseSprite(binData, SPRITE_WIDTH, SPRITE_HEIGHT);
                    applyJerseyMask(pixels, ctx.appearance);
                    renderSprite(frame, pixels, spriteX, spriteY);
                    spriteLoaded = true;
                }
            } catch (e) {
                log(LOG_WARNING, "[STATS_VIEW] Sprite load failed: " + e);
            }
        }
        
        if (!spriteLoaded) {
            // Fallback ASCII art
            frame.gotoxy(spriteX, spriteY);
            frame.putmsg("\1w o \1n");
            frame.gotoxy(spriteX, spriteY + 1);
            frame.putmsg("\1w/|\\\1n");
            frame.gotoxy(spriteX, spriteY + 2);
            frame.putmsg("\1w | \1n");
            frame.gotoxy(spriteX, spriteY + 3);
            frame.putmsg("\1w/ \\\1n");
        }
        
        // Jersey number
        var jerseyNum = ctx.appearance ? ctx.appearance.jerseyNumber : "";
        if (jerseyNum) {
            frame.gotoxy(spriteX, spriteY + 5);
            frame.putmsg("\1w#\1h\1y" + jerseyNum + "\1n");
        }
        
        // Archetype & Background info
        var archetype = LORB.Data.ARCHETYPES ? LORB.Data.ARCHETYPES[ctx.archetype] : null;
        var background = LORB.Data.BACKGROUNDS ? LORB.Data.BACKGROUNDS[ctx.background] : null;
        
        frame.gotoxy(2, 13);
        frame.putmsg("\1cArchetype:\1n");
        frame.gotoxy(2, 14);
        frame.putmsg(" \1w" + (archetype ? archetype.name : "Unknown") + "\1n");
        
        frame.gotoxy(2, 16);
        frame.putmsg("\1cBackground:\1n");
        frame.gotoxy(2, 17);
        frame.putmsg(" \1w" + (background ? background.name : "Unknown") + "\1n");
        
        // Close box
        for (var y = 4; y < 19; y++) {
            frame.gotoxy(1, y);
            frame.putmsg("\1n\1c" + VLINE + "\1n");
            frame.gotoxy(w + 2, y);
            frame.putmsg("\1n\1c" + VLINE + "\1n");
        }
        frame.gotoxy(1, 19);
        frame.putmsg("\1n\1c" + BL + repeatChar(HLINE, w) + BR + "\1n");
    }
    
    /**
     * Draw all stats in the right panel
     */
    function drawStatsPanel(frame, ctx) {
        var y = 1;
        var col1 = 1;
        var col2 = 28;
        
        // === RESOURCES ===
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1y[ RESOURCES ]\1n");
        y++;
        
        frame.gotoxy(col1, y);
        frame.putmsg("\1cCash:\1n  \1h\1y$" + (ctx.cash || 0) + "\1n");
        frame.gotoxy(col2, y);
        frame.putmsg("\1cRep:\1n   \1h\1c" + (ctx.rep || 0) + "\1n");
        y++;
        
        frame.gotoxy(col1, y);
        frame.putmsg("\1cXP:\1n    \1w" + (ctx.xp || 0) + "\1n");
        frame.gotoxy(col2, y);
        frame.putmsg("\1cLevel:\1n \1h\1w" + (ctx.level || 1) + "\1n   \1cDay:\1n \1w" + (ctx.day || 1) + "\1n");
        y++;
        
        if ((ctx.attributePoints || 0) > 0) {
            frame.gotoxy(col1, y);
            frame.putmsg("\1h\1mAttr Points: " + ctx.attributePoints + "\1n");
            y++;
        }
        
        // === ALIGNMENT (if player has any baby mama interactions) ===
        if (typeof ctx.alignment !== "undefined" || (ctx.babyMamas && Object.keys(ctx.babyMamas).length > 0)) {
            var Alignment = (LORB.Data && LORB.Data.Alignment) ? LORB.Data.Alignment : null;
            if (Alignment) {
                Alignment.ensureAlignment(ctx);
                frame.gotoxy(col1, y);
                frame.putmsg("\1cKarma:\1n " + Alignment.getAlignmentDisplay(ctx));
                y++;
            }
        }
        y++;
        
        // === ATTRIBUTES ===
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1y[ ATTRIBUTES ]\1n");
        y++;
        
        var baseStats = ctx.stats || {};
        var effectiveStats = (LORB.Locations && LORB.Locations.Shop) ? 
            LORB.Locations.Shop.getEffectiveStats(ctx) : baseStats;
        
        var statLabels = [
            { key: "speed", label: "SPD" },
            { key: "threePt", label: "3PT" },
            { key: "power", label: "PWR" },
            { key: "steal", label: "STL" },
            { key: "block", label: "BLK" },
            { key: "dunk", label: "DNK" }
        ];
        
        // Draw stats in 2 columns (3 per column)
        for (var si = 0; si < statLabels.length; si++) {
            var stat = statLabels[si];
            var base = baseStats[stat.key] || 4;
            var effective = effectiveStats[stat.key] || base;
            var diff = effective - base;
            
            var bar = "";
            for (var b = 0; b < Math.min(effective, 10); b++) bar += "\1h\1g\xFE";
            for (var b = Math.min(effective, 10); b < 10; b++) bar += "\1h\1k\xFE";
            
            var modStr = "";
            if (diff > 0) modStr = " \1c+" + diff + "\1n";
            else if (diff < 0) modStr = " \1r" + diff + "\1n";
            
            var colX = (si < 3) ? col1 : col2;
            var rowY = y + (si % 3);
            
            frame.gotoxy(colX, rowY);
            frame.putmsg("\1w" + stat.label + " " + bar + " \1w" + effective + "\1n" + modStr);
        }
        y += 4;
        
        // === RECORD ===
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1y[ RECORD ]\1n");
        y++;
        
        var wins = ctx.wins || 0;
        var losses = ctx.losses || 0;
        var gamesPlayed = ctx.gamesPlayed || (wins + losses);
        var winPct = gamesPlayed > 0 ? Math.round(wins / gamesPlayed * 100) : 0;
        
        frame.gotoxy(col1, y);
        frame.putmsg("\1cGames:\1n \1w" + gamesPlayed + "\1n");
        frame.gotoxy(col2, y);
        frame.putmsg("\1cWin%:\1n  \1w" + winPct + "%\1n");
        y++;
        
        frame.gotoxy(col1, y);
        frame.putmsg("\1cWins:\1n  \1h\1g" + wins + "\1n");
        frame.gotoxy(col2, y);
        frame.putmsg("\1cLosses:\1n \1h\1r" + losses + "\1n");
        y += 2;
        
        // === CAREER AVERAGES ===
        var hasCareer = ctx.careerStats && ctx.careerStats.gamesPlayed > 0;
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1y[ CAREER AVERAGES ]\1n");
        y++;
        
        if (hasCareer && LORB.Util && LORB.Util.CareerStats) {
            var avgs = LORB.Util.CareerStats.getAverages(ctx);
            
            frame.gotoxy(col1, y);
            frame.putmsg("\1cPPG:\1n \1h\1w" + avgs.points.toFixed(1) + "\1n");
            frame.gotoxy(col1 + 12, y);
            frame.putmsg("\1cRPG:\1n \1h\1w" + avgs.rebounds.toFixed(1) + "\1n");
            frame.gotoxy(col2, y);
            frame.putmsg("\1cAPG:\1n \1h\1w" + avgs.assists.toFixed(1) + "\1n");
            y++;
            
            frame.gotoxy(col1, y);
            frame.putmsg("\1cSPG:\1n \1h\1w" + avgs.steals.toFixed(1) + "\1n");
            frame.gotoxy(col1 + 12, y);
            frame.putmsg("\1cBPG:\1n \1h\1w" + avgs.blocks.toFixed(1) + "\1n");
            frame.gotoxy(col2, y);
            frame.putmsg("\1cTPG:\1n \1h\1w" + avgs.turnovers.toFixed(1) + "\1n");
            y++;
            
            frame.gotoxy(col1, y);
            frame.putmsg("\1cFG%:\1n \1h\1w" + avgs.fgPct.toFixed(1) + "%\1n");
            frame.gotoxy(col2, y);
            frame.putmsg("\1c3P%:\1n \1h\1w" + avgs.tpPct.toFixed(1) + "%\1n");
        } else {
            frame.gotoxy(col1, y);
            frame.putmsg("\1kNo games played yet\1n");
        }
        y += 2;
        
        // === PERSONAL BESTS ===
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1y[ PERSONAL BESTS ]\1n");
        y++;
        
        var hasRecords = false;
        var displayStats = ["points", "rebounds", "assists", "steals", "blocks", "dunks"];
        if (ctx.records) {
            for (var ri = 0; ri < displayStats.length; ri++) {
                if (ctx.records[displayStats[ri]] && ctx.records[displayStats[ri]].value > 0) {
                    hasRecords = true;
                    break;
                }
            }
        }
        
        if (hasRecords) {
            var recordLabels = {
                points: "PTS",
                rebounds: "REB", 
                assists: "AST",
                steals: "STL",
                blocks: "BLK",
                dunks: "DNK"
            };
            
            // 3 records per row
            for (var ri = 0; ri < displayStats.length; ri++) {
                var statKey = displayStats[ri];
                var rec = ctx.records[statKey];
                var val = (rec && rec.value) ? rec.value : 0;
                var label = recordLabels[statKey];
                
                var colX = col1 + (ri % 3) * 15;
                var rowY = y + Math.floor(ri / 3);
                
                frame.gotoxy(colX, rowY);
                frame.putmsg("\1c" + label + ":\1n \1h\1m" + val + "\1n");
            }
            y += 2;
        } else {
            frame.gotoxy(col1, y);
            frame.putmsg("\1kNo records set yet\1n");
            y++;
        }
        y++;
        
        // === EQUIPMENT ===
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1y[ EQUIPMENT ]\1n");
        y++;
        
        if (ctx.equipment && ctx.equipment.feet) {
            var sneaker = (LORB.Locations && LORB.Locations.Shop) ? 
                LORB.Locations.Shop.SNEAKERS[ctx.equipment.feet] : null;
            if (sneaker) {
                frame.gotoxy(col1, y);
                frame.putmsg("\1cSneakers:\1n \1w" + sneaker.name + "\1n");
            }
        } else {
            frame.gotoxy(col1, y);
            frame.putmsg("\1cSneakers:\1n \1kNone\1n");
        }
        
        // Active buffs
        if (ctx.tempBuffs) {
            var buffList = [];
            for (var b in ctx.tempBuffs) {
                if (ctx.tempBuffs.hasOwnProperty(b) && ctx.tempBuffs[b] > 0) {
                    buffList.push("+" + ctx.tempBuffs[b] + " " + b);
                }
            }
            if (buffList.length > 0) {
                frame.gotoxy(col2, y);
                frame.putmsg("\1mBuffs:\1n " + buffList.join(", "));
            }
        }
    }
    
    /**
     * Draw PvP stats in the right panel
     */
    function drawPvpStatsPanel(frame, ctx) {
        var y = 1;
        var col1 = 1;
        var col2 = 28;
        
        // Ensure we have pvpStats utility
        var PvpStats = (LORB.Util && LORB.Util.PvpStats) ? LORB.Util.PvpStats : null;
        if (PvpStats) {
            PvpStats.ensurePvpStats(ctx);
            PvpStats.ensurePvpRecords(ctx);
        }
        
        var pvp = ctx.pvpStats || {};
        var pvpRecords = ctx.pvpRecords || {};
        
        // === PVP RECORD ===
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1m[ PVP RECORD ]\1n");
        y++;
        
        var gamesPlayed = pvp.gamesPlayed || 0;
        var wins = pvp.wins || 0;
        var losses = pvp.losses || 0;
        var ties = pvp.ties || 0;
        var winPct = gamesPlayed > 0 ? Math.round(wins / gamesPlayed * 100) : 0;
        
        frame.gotoxy(col1, y);
        frame.putmsg("\1cGames:\1n \1w" + gamesPlayed + "\1n");
        frame.gotoxy(col2, y);
        frame.putmsg("\1cWin%:\1n  \1w" + winPct + "%\1n");
        y++;
        
        frame.gotoxy(col1, y);
        frame.putmsg("\1cWins:\1n  \1h\1g" + wins + "\1n");
        frame.gotoxy(col1 + 14, y);
        frame.putmsg("\1cLosses:\1n \1h\1r" + losses + "\1n");
        frame.gotoxy(col2, y);
        frame.putmsg("\1cTies:\1n   \1h\1w" + ties + "\1n");
        y += 2;
        
        // === STREAKS ===
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1m[ STREAKS ]\1n");
        y++;
        
        var currentStreak = pvp.currentStreak || 0;
        var streakType = currentStreak >= 0 ? "W" : "L";
        var streakVal = Math.abs(currentStreak);
        var streakColor = currentStreak >= 0 ? "\1h\1g" : "\1h\1r";
        
        frame.gotoxy(col1, y);
        frame.putmsg("\1cCurrent:\1n " + streakColor + streakVal + streakType + "\1n");
        frame.gotoxy(col2, y);
        frame.putmsg("\1cBest Win:\1n \1h\1g" + (pvp.longestWinStreak || 0) + "W\1n");
        y += 2;
        
        // === PVP AVERAGES ===
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1m[ PVP AVERAGES ]\1n");
        y++;
        
        if (gamesPlayed > 0 && PvpStats) {
            var avgs = PvpStats.getAverages(ctx);
            
            frame.gotoxy(col1, y);
            frame.putmsg("\1cPPG:\1n \1h\1w" + avgs.points.toFixed(1) + "\1n");
            frame.gotoxy(col1 + 12, y);
            frame.putmsg("\1cRPG:\1n \1h\1w" + avgs.rebounds.toFixed(1) + "\1n");
            frame.gotoxy(col2, y);
            frame.putmsg("\1cAPG:\1n \1h\1w" + avgs.assists.toFixed(1) + "\1n");
            y++;
            
            frame.gotoxy(col1, y);
            frame.putmsg("\1cSPG:\1n \1h\1w" + avgs.steals.toFixed(1) + "\1n");
            frame.gotoxy(col1 + 12, y);
            frame.putmsg("\1cBPG:\1n \1h\1w" + avgs.blocks.toFixed(1) + "\1n");
            frame.gotoxy(col2, y);
            frame.putmsg("\1cTPG:\1n \1h\1w" + avgs.turnovers.toFixed(1) + "\1n");
            y++;
            
            frame.gotoxy(col1, y);
            frame.putmsg("\1cFG%:\1n \1h\1w" + avgs.fgPct.toFixed(1) + "%\1n");
            frame.gotoxy(col2, y);
            frame.putmsg("\1c3P%:\1n \1h\1w" + avgs.tpPct.toFixed(1) + "%\1n");
        } else {
            frame.gotoxy(col1, y);
            frame.putmsg("\1kNo PvP games played yet\1n");
        }
        y += 2;
        
        // === PVP PERSONAL BESTS ===
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1m[ PVP PERSONAL BESTS ]\1n");
        y++;
        
        var displayStats = ["points", "rebounds", "assists", "steals", "blocks", "dunks"];
        var hasRecords = false;
        
        for (var ri = 0; ri < displayStats.length; ri++) {
            if (pvpRecords[displayStats[ri]] && pvpRecords[displayStats[ri]].value > 0) {
                hasRecords = true;
                break;
            }
        }
        
        if (hasRecords) {
            var recordLabels = {
                points: "PTS",
                rebounds: "REB",
                assists: "AST",
                steals: "STL",
                blocks: "BLK",
                dunks: "DNK"
            };
            
            for (var ri = 0; ri < displayStats.length; ri++) {
                var statKey = displayStats[ri];
                var rec = pvpRecords[statKey];
                var val = (rec && rec.value) ? rec.value : 0;
                var label = recordLabels[statKey];
                
                var colX = col1 + (ri % 3) * 15;
                var rowY = y + Math.floor(ri / 3);
                
                frame.gotoxy(colX, rowY);
                if (rec && rec.opponent) {
                    frame.putmsg("\1c" + label + ":\1n \1h\1m" + val + "\1n \1kvs " + rec.opponent.substr(0, 6) + "\1n");
                } else {
                    frame.putmsg("\1c" + label + ":\1n \1h\1m" + val + "\1n");
                }
            }
            y += 2;
        } else {
            frame.gotoxy(col1, y);
            frame.putmsg("\1kNo PvP records set yet\1n");
            y++;
        }
    }
    
    /**
     * Parse sprite from bin data
     */
    function parseSprite(binData, width, height) {
        var pixels = [];
        var offset = 0;
        for (var py = 0; py < height; py++) {
            pixels[py] = [];
            for (var px = 0; px < width; px++) {
                if (offset + 1 < binData.length) {
                    var ch = binData.charAt(offset++);
                    var attr = binData.charCodeAt(offset++);
                    pixels[py][px] = { ch: ch, attr: attr };
                } else {
                    pixels[py][px] = { ch: ' ', attr: BG_BLACK };
                }
            }
        }
        return pixels;
    }
    
    /**
     * Apply jersey color mask to sprite
     */
    function applyJerseyMask(pixels, appearance) {
        var jerseyBg = getJerseyBgColor(appearance.jerseyColor);
        var jerseyNum = appearance.jerseyNumber || "";
        var digits = jerseyNum.replace(/[^0-9]/g, "");
        var leftDigit = digits.length >= 2 ? digits.charAt(0) : "#";
        var rightDigit = digits.length >= 1 ? digits.charAt(digits.length - 1) : "#";
        if (digits.length === 1) leftDigit = "#";
        
        var letteringFg = getLetteringFgColor(appearance.jerseyLettering);
        var digitsAttr = letteringFg | jerseyBg;
        
        // Row 2, cols 1,2,3: jersey area
        if (pixels[2]) {
            pixels[2][1] = { ch: leftDigit, attr: digitsAttr };
            var neckCell = pixels[2][2];
            var skinFg = neckCell ? (neckCell.attr & 0x0F) : BROWN;
            pixels[2][2] = { ch: String.fromCharCode(223), attr: skinFg | jerseyBg };
            pixels[2][3] = { ch: rightDigit, attr: digitsAttr };
        }
        
        // Row 3, cols 1,3: shorts
        if (pixels[3]) {
            var shortsChar = String.fromCharCode(220);
            var leftLeg = pixels[3][1];
            var shoeFg = leftLeg ? (leftLeg.attr & 0x0F) : WHITE;
            pixels[3][1] = { ch: shortsChar, attr: shoeFg | jerseyBg };
            var rightLeg = pixels[3][3];
            shoeFg = rightLeg ? (rightLeg.attr & 0x0F) : WHITE;
            pixels[3][3] = { ch: shortsChar, attr: shoeFg | jerseyBg };
        }
        
        // Row 0: eye color
        var eyeFg = getEyeFgColor(appearance.eyeColor);
        if (pixels[0]) {
            for (var ex = 0; ex < pixels[0].length; ex++) {
                var eyeCell = pixels[0][ex];
                if (eyeCell) {
                    var eyeCh = eyeCell.ch;
                    if (eyeCh === 'O' || eyeCh === 'o' || eyeCh === '0') {
                        var eyeBg = eyeCell.attr & 0xF0;
                        pixels[0][ex] = { ch: eyeCh, attr: eyeFg | eyeBg };
                    }
                }
            }
        }
    }
    
    /**
     * Render sprite pixels to frame
     */
    function renderSprite(frame, pixels, startX, startY) {
        for (var ry = 0; ry < pixels.length; ry++) {
            for (var rx = 0; rx < pixels[ry].length; rx++) {
                var cell = pixels[ry][rx];
                var ch = cell.ch;
                var attr = cell.attr;
                if (!ch || ch === '\0' || ch === ' ') {
                    ch = ' ';
                    attr = BG_BLACK;
                }
                try {
                    frame.setData(startX + rx - 1, startY + ry - 1, ch, attr, false);
                } catch (e) {
                    frame.gotoxy(startX + rx, startY + ry);
                    frame.putmsg(ch);
                }
            }
        }
    }
    
    // Color helpers
    function getJerseyBgColor(colorName) {
        if (!colorName) return BG_RED;
        var map = {
            "RED": BG_RED, "BLUE": BG_BLUE, "GREEN": BG_GREEN,
            "YELLOW": BG_BROWN, "CYAN": BG_CYAN, "MAGENTA": BG_MAGENTA,
            "WHITE": BG_LIGHTGRAY, "BLACK": BG_BLACK, "BROWN": BG_BROWN
        };
        return map[colorName.toUpperCase()] || BG_RED;
    }
    
    function getLetteringFgColor(colorName) {
        if (!colorName) return WHITE | HIGH;
        var map = {
            "WHITE": WHITE | HIGH, "LIGHTGRAY": LIGHTGRAY, "DARKGRAY": DARKGRAY | HIGH,
            "BLACK": BLACK, "RED": RED, "LIGHTRED": RED | HIGH,
            "GREEN": GREEN, "LIGHTGREEN": GREEN | HIGH, "BLUE": BLUE,
            "LIGHTBLUE": BLUE | HIGH, "CYAN": CYAN, "LIGHTCYAN": CYAN | HIGH,
            "MAGENTA": MAGENTA, "LIGHTMAGENTA": MAGENTA | HIGH,
            "BROWN": BROWN, "YELLOW": YELLOW | HIGH
        };
        return map[colorName.toUpperCase()] || (WHITE | HIGH);
    }
    
    function getEyeFgColor(colorName) {
        if (!colorName) return BROWN;
        var map = {
            "BROWN": BROWN, "BLACK": BLACK, "BLUE": BLUE | HIGH,
            "GREEN": GREEN | HIGH, "LIGHTGRAY": LIGHTGRAY, "DARKGRAY": DARKGRAY | HIGH
        };
        return map[colorName.toUpperCase()] || BROWN;
    }
    
    function getColorCtrlCode(colorName) {
        if (!colorName) return "\1h\1w";
        var map = {
            "WHITE": "\1h\1w", "LIGHTGRAY": "\1w", "DARKGRAY": "\1h\1k",
            "BLACK": "\1k", "RED": "\1r", "LIGHTRED": "\1h\1r",
            "GREEN": "\1g", "LIGHTGREEN": "\1h\1g", "BLUE": "\1b",
            "LIGHTBLUE": "\1h\1b", "CYAN": "\1c", "LIGHTCYAN": "\1h\1c",
            "MAGENTA": "\1m", "LIGHTMAGENTA": "\1h\1m", "BROWN": "\1y", "YELLOW": "\1h\1y"
        };
        return map[colorName.toUpperCase()] || "\1h\1w";
    }
    
    function getBgColorCtrlCode(colorName) {
        if (!colorName) return "\0010";
        var map = {
            "BLACK": "\0010", "BLUE": "\0014", "GREEN": "\0012",
            "CYAN": "\0016", "RED": "\0011", "MAGENTA": "\0015",
            "BROWN": "\0013", "LIGHTGRAY": "\0017"
        };
        return map[colorName.toUpperCase()] || "\0010";
    }
    
    function repeatChar(ch, n) {
        var result = "";
        for (var i = 0; i < n; i++) result += ch;
        return result;
    }
    
    /**
     * Legacy fallback view (no RichView)
     */
    function showLegacy(ctx) {
        LORB.View.clear();
        LORB.View.header("PLAYER CARD: " + (ctx.name || ctx.userHandle || "Unknown"));
        LORB.View.line("");
        
        // Basic info
        var archetype = LORB.Data.ARCHETYPES ? LORB.Data.ARCHETYPES[ctx.archetype] : null;
        var background = LORB.Data.BACKGROUNDS ? LORB.Data.BACKGROUNDS[ctx.background] : null;
        
        if (archetype) LORB.View.line("\1wArchetype:\1n " + archetype.name);
        if (background) LORB.View.line("\1wBackground:\1n " + background.name);
        LORB.View.line("\1wLevel:\1n " + (ctx.level || 1) + "  \1wDay:\1n " + (ctx.day || 1));
        LORB.View.line("");
        
        // Stats
        LORB.View.line("\1h\1y[ STATS ]\1n");
        var baseStats = ctx.stats || {};
        var effectiveStats = (LORB.Locations && LORB.Locations.Shop) ? 
            LORB.Locations.Shop.getEffectiveStats(ctx) : baseStats;
        
        var statLabels = { speed: "Speed", threePt: "3-Point", power: "Power", 
                          steal: "Steal", block: "Block", dunk: "Dunk" };
        
        for (var stat in statLabels) {
            if (statLabels.hasOwnProperty(stat)) {
                var label = statLabels[stat];
                while (label.length < 8) label += " ";
                var base = baseStats[stat] || 4;
                var effective = effectiveStats[stat] || base;
                var diff = effective - base;
                var bar = "";
                for (var b = 0; b < Math.min(effective, 10); b++) bar += "\1g\xFE\1n";
                for (var b = Math.min(effective, 10); b < 10; b++) bar += "\1k\xFE\1n";
                var modStr = "";
                if (diff > 0) modStr = " \1c(+" + diff + ")\1n";
                else if (diff < 0) modStr = " \1r(" + diff + ")\1n";
                LORB.View.line("  " + label + " " + bar + " " + effective + modStr);
            }
        }
        LORB.View.line("");
        
        // Resources
        LORB.View.line("\1h\1y[ RESOURCES ]\1n");
        LORB.View.line("  Cash:  \1y$" + (ctx.cash || 0) + "\1n");
        LORB.View.line("  XP:    " + (ctx.xp || 0));
        LORB.View.line("  Rep:   \1c" + (ctx.rep || 0) + "\1n");
        
        // Alignment (if active)
        if (typeof ctx.alignment !== "undefined" || (ctx.babyMamas && Object.keys(ctx.babyMamas).length > 0)) {
            var Alignment = (LORB.Data && LORB.Data.Alignment) ? LORB.Data.Alignment : null;
            if (Alignment) {
                Alignment.ensureAlignment(ctx);
                LORB.View.line("  Karma: " + Alignment.getAlignmentDisplay(ctx));
            }
        }
        LORB.View.line("");
        
        // Record
        LORB.View.line("\1h\1y[ RECORD ]\1n");
        LORB.View.line("  Games: " + (ctx.gamesPlayed || 0) + "  Wins: \1g" + (ctx.wins || 0) + "\1n  Losses: \1r" + (ctx.losses || 0) + "\1n");
        LORB.View.line("");
        
        // Career Averages
        if (ctx.careerStats && ctx.careerStats.gamesPlayed > 0 && LORB.Util && LORB.Util.CareerStats) {
            var avgs = LORB.Util.CareerStats.getAverages(ctx);
            LORB.View.line("\1h\1y[ CAREER AVERAGES ]\1n");
            LORB.View.line("  PPG: " + avgs.points.toFixed(1) + "  RPG: " + avgs.rebounds.toFixed(1) + "  APG: " + avgs.assists.toFixed(1));
            LORB.View.line("  SPG: " + avgs.steals.toFixed(1) + "  BPG: " + avgs.blocks.toFixed(1) + "  TPG: " + avgs.turnovers.toFixed(1));
            LORB.View.line("  FG%: " + avgs.fgPct.toFixed(1) + "%  3P%: " + avgs.tpPct.toFixed(1) + "%");
            LORB.View.line("");
        }
        
        // Personal Bests
        if (ctx.records) {
            var hasRecords = false;
            var displayStats = ["points", "rebounds", "assists", "steals", "blocks", "dunks"];
            for (var ri = 0; ri < displayStats.length; ri++) {
                if (ctx.records[displayStats[ri]] && ctx.records[displayStats[ri]].value > 0) {
                    hasRecords = true;
                    break;
                }
            }
            if (hasRecords) {
                LORB.View.line("\1h\1y[ PERSONAL BESTS ]\1n");
                var line = "  ";
                for (var ri = 0; ri < displayStats.length; ri++) {
                    var rec = ctx.records[displayStats[ri]];
                    var val = (rec && rec.value) ? rec.value : 0;
                    line += displayStats[ri].substring(0,3).toUpperCase() + ":" + val + " ";
                }
                LORB.View.line(line);
                LORB.View.line("");
            }
        }
        
        LORB.View.line("\1wPress any key to continue...\1n");
        console.getkey();
    }
    
    /**
     * Show stats for another player (from tournament/leaderboard data)
     * Uses the same RichView layout but adapted for player summary fields
     * @param {Object} player - Player summary from listPlayers()
     * @param {Object} options - Optional settings:
     *   - canChallenge: boolean - whether to show challenge option
     *   - maxWager: number - maximum wager amount for ghost match
     *   - isSelf: boolean - whether this is the current player's own card
     * @returns {string|null} - "challenge" if user wants to challenge, null otherwise
     */
    function showForPlayer(player, options) {
        options = options || {};
        if (RichView) {
            return showForPlayerRichView(player, options);
        } else {
            return showForPlayerLegacy(player, options);
        }
    }
    
    /**
     * RichView layout for viewing another player's stats
     */
    function showForPlayerRichView(player, options) {
        options = options || {};
        var hLine = repeatChar(HLINE, 78);
        var showPvpStats = false;  // Toggle between career and PvP stats
        
        while (true) {
            var view = new RichView({
                zones: [
                    { name: "header", x: 1, y: 1, width: 80, height: 3 },
                    { name: "left", x: 1, y: 4, width: 24, height: 20 },
                    { name: "right", x: 25, y: 4, width: 56, height: 20 },
                    { name: "footer", x: 1, y: 24, width: 80, height: 1 }
                ],
                theme: "lorb"
            });
            
            // Header
            var headerFrame = view.getZone("header");
            if (headerFrame) {
                headerFrame.gotoxy(1, 1);
                headerFrame.putmsg("\1h\1y" + hLine + "\1n");
                headerFrame.gotoxy(1, 2);
                var modeLabel = showPvpStats ? "\1h\1m[PVP]\1n" : "\1h\1c[CAREER]\1n";
                var headerText = "  PLAYER CARD: \1h\1c" + (player.name || "Unknown") + "\1n " + modeLabel;
                if (player.bbsName) {
                    headerText += " \1kfrom \1y" + player.bbsName + "\1n";
                }
                headerFrame.putmsg(headerText);
                headerFrame.gotoxy(1, 3);
                headerFrame.putmsg("\1h\1y" + hLine + "\1n");
            }
            
            // Left panel: Player info card
            var leftFrame = view.getZone("left");
            if (leftFrame) {
                drawPlayerInfoCard(leftFrame, player);
            }
            
            // Right panel: Career or PvP stats based on toggle
            var rightFrame = view.getZone("right");
            if (rightFrame) {
                if (showPvpStats) {
                    drawPlayerPvpStatsPanel(rightFrame, player);
                } else {
                    drawPlayerStatsPanel(rightFrame, player);
                }
            }
            
            // Footer - show challenge option if available
            var footerFrame = view.getZone("footer");
            if (footerFrame) {
                footerFrame.gotoxy(1, 1);
                var toggleLabel = showPvpStats ? "Career" : "PvP";
                var showGhost = options.canChallenge && !options.isSelf && options.maxWager > 0;
                var showLive = options.canLiveChallenge && !options.isSelf;
                var pvpHint = "\1h\1w[P]\1n\1c " + toggleLabel + "   ";
                if (showGhost && showLive) {
                    footerFrame.putmsg("  " + pvpHint + "\1h\1y[L]\1n\1w Live   \1h\1y[C]\1n\1w Ghost ($" + options.maxWager + ")   \1h\1w[Q]\1n\1c Back\1n");
                } else if (showLive) {
                    footerFrame.putmsg("  " + pvpHint + "\1h\1y[L]\1n\1w Live Challenge   \1h\1w[Q]\1n\1c Back\1n");
                } else if (showGhost) {
                    footerFrame.putmsg("  " + pvpHint + "\1h\1y[C]\1n\1w Ghost Match ($" + options.maxWager + ")   \1h\1w[Q]\1n\1c Back\1n");
                } else if (options.isSelf) {
                    footerFrame.putmsg("  " + pvpHint + "\1kThis is you!   \1h\1w[Q]\1n\1c Back\1n");
                } else {
                    footerFrame.putmsg("  " + pvpHint + "\1h\1w[Q]\1n\1c Back\1n");
                }
            }
            
            view.render();
            
            // Handle input
            var result = null;
            var needsRedraw = false;
            while (true) {
                var key = console.getkey();
                if (key === "q" || key === "Q" || key === "\x1B") {
                    view.close();
                    return null;
                }
                if (key === "p" || key === "P") {
                    showPvpStats = !showPvpStats;
                    needsRedraw = true;
                    break;
                }
                if ((key === "l" || key === "L") && options.canLiveChallenge && !options.isSelf) {
                    view.close();
                    return "live_challenge";
                }
                if ((key === "c" || key === "C") && options.canChallenge && !options.isSelf && options.maxWager > 0) {
                    view.close();
                    return "challenge";
                }
            }
            
            view.close();
            
            if (!needsRedraw) {
                break;
            }
        }
        
        return null;
    }
    
    /**
     * Draw player info card in left panel (replacing sprite for other players)
     */
    function drawPlayerInfoCard(frame, player) {
        var w = 22;
        
        // Title box
        frame.gotoxy(1, 1);
        frame.putmsg("\1n\1c" + TL + repeatChar(HLINE, w) + TR + "\1n");
        frame.gotoxy(1, 2);
        frame.putmsg("\1n\1c" + VLINE + "\1h\1w      PLAYER        \1n\1c" + VLINE + "\1n");
        frame.gotoxy(1, 3);
        frame.putmsg("\1n\1c" + VLINE + repeatChar(" ", w) + VLINE + "\1n");
        
        // Sprite positioning
        var spriteX = 9;
        var spriteY = 6;
        
        // Draw nametag above sprite (use nickname if available, else name)
        var displayName = player.nickname || player.name || "???";
        if (displayName.length > 10) displayName = displayName.substring(0, 10);
        
        var nametagFg = "\1h\1w";
        var nametagBg = "\1" + "0";  // Black background
        
        if (player.appearance) {
            nametagFg = getColorCtrlCode(player.appearance.nametagFg || "WHITE");
            nametagBg = getBgColorCtrlCode(player.appearance.nametagBg || "BLACK");
        }
        
        var nameX = Math.floor((w - displayName.length) / 2) + 1;
        frame.gotoxy(nameX, spriteY - 1);
        frame.putmsg(nametagBg + nametagFg + displayName + "\1n");
        
        // Load and render sprite using BinLoader
        var spriteLoaded = false;
        if (typeof BinLoader !== "undefined" && player.appearance) {
            try {
                var skin = (player.appearance.skin || "brown").toLowerCase();
                var binPath = NBA_JAM_ROOT + "sprites/player-" + skin + ".bin";
                
                var binData = BinLoader.loadBinFile(binPath);
                if (binData) {
                    var pixels = parseSprite(binData, SPRITE_WIDTH, SPRITE_HEIGHT);
                    applyJerseyMask(pixels, player.appearance);
                    renderSprite(frame, pixels, spriteX, spriteY);
                    spriteLoaded = true;
                }
            } catch (e) {
                log(LOG_WARNING, "[STATS_VIEW] Sprite load failed for player: " + e);
            }
        }
        
        if (!spriteLoaded) {
            // Fallback ASCII art
            frame.gotoxy(spriteX, spriteY);
            frame.putmsg("\1w o \1n");
            frame.gotoxy(spriteX, spriteY + 1);
            frame.putmsg("\1w/|\\\1n");
            frame.gotoxy(spriteX, spriteY + 2);
            frame.putmsg("\1w | \1n");
            frame.gotoxy(spriteX, spriteY + 3);
            frame.putmsg("\1w/ \\\1n");
        }
        
        // Jersey number (if available)
        if (player.appearance && player.appearance.jerseyNumber) {
            frame.gotoxy(spriteX, spriteY + 5);
            frame.putmsg("\1w#\1h\1y" + player.appearance.jerseyNumber + "\1n");
        }
        
        // Player info below sprite
        frame.gotoxy(2, 12);
        frame.putmsg("\1cLevel:\1n \1h\1c" + (player.level || 1) + "\1n  \1cRep:\1n \1h\1m" + (player.rep || 0) + "\1n");
        
        frame.gotoxy(2, 13);
        frame.putmsg("\1cGames:\1n \1w" + (player.gamesPlayed || 0) + "\1n");
        
        frame.gotoxy(2, 14);
        frame.putmsg("\1cRecord:\1n \1g" + (player.wins || 0) + "\1n-\1r" + (player.losses || 0) + "\1n");
        
        var totalGames = (player.wins || 0) + (player.losses || 0);
        var winPct = totalGames > 0 ? Math.round((player.wins || 0) / totalGames * 100) : 0;
        frame.gotoxy(2, 15);
        frame.putmsg("\1cWin%:\1n  \1w" + winPct + "%\1n");
        
        // Championship and Red Bull stats
        var champWins = player.championshipWins || 0;
        var redBullDefeats = player.redBullDefeats || 0;
        
        if (champWins > 0 || redBullDefeats > 0) {
            frame.gotoxy(2, 16);
            frame.putmsg("\1y\1hChamp:\1n \1w" + champWins + "\1n  \1r\1hRB:\1n \1w" + redBullDefeats + "\1n");
        }
        
        // Close box - extend to row 18
        for (var y = 4; y < 18; y++) {
            frame.gotoxy(1, y);
            frame.putmsg("\1n\1c" + VLINE + "\1n");
            frame.gotoxy(w + 2, y);
            frame.putmsg("\1n\1c" + VLINE + "\1n");
        }
        frame.gotoxy(1, 18);
        frame.putmsg("\1n\1c" + BL + repeatChar(HLINE, w) + BR + "\1n");
    }
    
    /**
     * Helper to truncate a string
     */
    function truncateStr(str, maxLen) {
        if (!str) return "";
        if (str.length <= maxLen) return str;
        return str.substring(0, maxLen);
    }
    
    /**
     * Draw stats panel for another player (right panel)
     */
    function drawPlayerStatsPanel(frame, player) {
        var y = 1;
        var col1 = 1;
        var col2 = 28;
        
        // === ATTRIBUTES (if available) ===
        if (player.stats && Object.keys(player.stats).length > 0) {
            frame.gotoxy(col1, y);
            frame.putmsg("\1h\1y[ ATTRIBUTES ]\1n");
            y++;
            
            var statLabels = [
                { key: "speed", label: "SPD" },
                { key: "threePt", label: "3PT" },
                { key: "power", label: "PWR" },
                { key: "steal", label: "STL" },
                { key: "block", label: "BLK" },
                { key: "dunk", label: "DNK" }
            ];
            
            // Draw stats in 2 columns (3 per column)
            for (var si = 0; si < statLabels.length; si++) {
                var stat = statLabels[si];
                var val = player.stats[stat.key] || 4;
                
                var bar = "";
                for (var b = 0; b < Math.min(val, 10); b++) bar += "\1h\1g\xFE";
                for (var b = Math.min(val, 10); b < 10; b++) bar += "\1h\1k\xFE";
                
                var colX = (si < 3) ? col1 : col2;
                var rowY = y + (si % 3);
                
                frame.gotoxy(colX, rowY);
                frame.putmsg("\1w" + stat.label + " " + bar + " \1w" + val + "\1n");
            }
            y += 4;
        }
        
        // === CAREER AVERAGES ===
        var hasCareer = player.careerStats && player.careerStats.gamesPlayed > 0;
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1y[ CAREER AVERAGES ]\1n");
        y++;
        
        if (hasCareer) {
            var career = player.careerStats;
            var games = career.gamesPlayed;
            var totals = career.totals || {};
            
            var ppg = (totals.points || 0) / games;
            var rpg = (totals.rebounds || 0) / games;
            var apg = (totals.assists || 0) / games;
            var spg = (totals.steals || 0) / games;
            var bpg = (totals.blocks || 0) / games;
            var tpg = (totals.turnovers || 0) / games;
            
            var fgm = totals.fgm || 0;
            var fga = totals.fga || 0;
            var tpm = totals.tpm || 0;
            var tpa = totals.tpa || 0;
            var fgPct = fga > 0 ? (fgm / fga * 100) : 0;
            var tpPct = tpa > 0 ? (tpm / tpa * 100) : 0;
            
            frame.gotoxy(col1, y);
            frame.putmsg("\1cPPG:\1n \1h\1w" + ppg.toFixed(1) + "\1n");
            frame.gotoxy(col1 + 12, y);
            frame.putmsg("\1cRPG:\1n \1h\1w" + rpg.toFixed(1) + "\1n");
            frame.gotoxy(col2, y);
            frame.putmsg("\1cAPG:\1n \1h\1w" + apg.toFixed(1) + "\1n");
            y++;
            
            frame.gotoxy(col1, y);
            frame.putmsg("\1cSPG:\1n \1h\1w" + spg.toFixed(1) + "\1n");
            frame.gotoxy(col1 + 12, y);
            frame.putmsg("\1cBPG:\1n \1h\1w" + bpg.toFixed(1) + "\1n");
            frame.gotoxy(col2, y);
            frame.putmsg("\1cTPG:\1n \1h\1w" + tpg.toFixed(1) + "\1n");
            y++;
            
            frame.gotoxy(col1, y);
            frame.putmsg("\1cFG%:\1n \1h\1w" + fgPct.toFixed(1) + "%\1n");
            frame.gotoxy(col2, y);
            frame.putmsg("\1c3P%:\1n \1h\1w" + tpPct.toFixed(1) + "%\1n");
            y++;
            
            // Career totals
            y++;
            frame.gotoxy(col1, y);
            frame.putmsg("\1h\1y[ CAREER TOTALS ]\1n");
            y++;
            
            frame.gotoxy(col1, y);
            frame.putmsg("\1cPTS:\1n \1w" + (totals.points || 0) + "\1n");
            frame.gotoxy(col1 + 12, y);
            frame.putmsg("\1cREB:\1n \1w" + (totals.rebounds || 0) + "\1n");
            frame.gotoxy(col2, y);
            frame.putmsg("\1cAST:\1n \1w" + (totals.assists || 0) + "\1n");
            y++;
            
            frame.gotoxy(col1, y);
            frame.putmsg("\1cSTL:\1n \1w" + (totals.steals || 0) + "\1n");
            frame.gotoxy(col1 + 12, y);
            frame.putmsg("\1cBLK:\1n \1w" + (totals.blocks || 0) + "\1n");
            frame.gotoxy(col2, y);
            frame.putmsg("\1cDNK:\1n \1w" + (totals.dunks || 0) + "\1n");
        } else {
            frame.gotoxy(col1, y);
            frame.putmsg("\1kNo games played yet\1n");
        }
        y += 2;
        
        // === PERSONAL BESTS (Single Game Records) ===
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1y[ SINGLE GAME RECORDS ]\1n");
        y++;
        
        var hasRecords = false;
        var displayStats = ["points", "rebounds", "assists", "steals", "blocks", "dunks"];
        if (player.records) {
            for (var ri = 0; ri < displayStats.length; ri++) {
                if (player.records[displayStats[ri]] && player.records[displayStats[ri]].value > 0) {
                    hasRecords = true;
                    break;
                }
            }
        }
        
        if (hasRecords) {
            var recordLabels = {
                points: "PTS",
                rebounds: "REB", 
                assists: "AST",
                steals: "STL",
                blocks: "BLK",
                dunks: "DNK"
            };
            
            // 3 records per row
            for (var ri = 0; ri < displayStats.length; ri++) {
                var statKey = displayStats[ri];
                var rec = player.records[statKey];
                var val = (rec && rec.value) ? rec.value : 0;
                var label = recordLabels[statKey];
                
                var colX = col1 + (ri % 3) * 15;
                var rowY = y + Math.floor(ri / 3);
                
                frame.gotoxy(colX, rowY);
                frame.putmsg("\1c" + label + ":\1n \1h\1m" + val + "\1n");
            }
        } else {
            frame.gotoxy(col1, y);
            frame.putmsg("\1kNo records set yet\1n");
        }
    }
    
    /**
     * Draw PvP stats panel for another player (right panel)
     */
    function drawPlayerPvpStatsPanel(frame, player) {
        var y = 1;
        var col1 = 1;
        var col2 = 28;
        
        // Ensure we have pvpStats utility
        var PvpStats = (LORB.Util && LORB.Util.PvpStats) ? LORB.Util.PvpStats : null;
        
        var pvp = player.pvpStats || {};
        var pvpRecords = player.pvpRecords || {};
        
        // === PVP RECORD ===
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1m[ PVP RECORD ]\1n");
        y++;
        
        var gamesPlayed = pvp.gamesPlayed || 0;
        var wins = pvp.wins || 0;
        var losses = pvp.losses || 0;
        var ties = pvp.ties || 0;
        var winPct = gamesPlayed > 0 ? Math.round(wins / gamesPlayed * 100) : 0;
        
        frame.gotoxy(col1, y);
        frame.putmsg("\1cGames:\1n \1w" + gamesPlayed + "\1n");
        frame.gotoxy(col2, y);
        frame.putmsg("\1cWin%:\1n  \1w" + winPct + "%\1n");
        y++;
        
        frame.gotoxy(col1, y);
        frame.putmsg("\1cWins:\1n  \1h\1g" + wins + "\1n");
        frame.gotoxy(col1 + 14, y);
        frame.putmsg("\1cLosses:\1n \1h\1r" + losses + "\1n");
        frame.gotoxy(col2, y);
        frame.putmsg("\1cTies:\1n   \1h\1w" + ties + "\1n");
        y += 2;
        
        // === STREAKS ===
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1m[ STREAKS ]\1n");
        y++;
        
        var currentStreak = pvp.currentStreak || 0;
        var streakType = currentStreak >= 0 ? "W" : "L";
        var streakVal = Math.abs(currentStreak);
        var streakColor = currentStreak >= 0 ? "\1h\1g" : "\1h\1r";
        
        frame.gotoxy(col1, y);
        frame.putmsg("\1cCurrent:\1n " + streakColor + streakVal + streakType + "\1n");
        frame.gotoxy(col2, y);
        frame.putmsg("\1cBest Win:\1n \1h\1g" + (pvp.longestWinStreak || 0) + "W\1n");
        y += 2;
        
        // === PVP AVERAGES ===
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1m[ PVP AVERAGES ]\1n");
        y++;
        
        if (gamesPlayed > 0 && pvp.totals) {
            var totals = pvp.totals;
            var ppg = (totals.points || 0) / gamesPlayed;
            var rpg = (totals.rebounds || 0) / gamesPlayed;
            var apg = (totals.assists || 0) / gamesPlayed;
            var spg = (totals.steals || 0) / gamesPlayed;
            var bpg = (totals.blocks || 0) / gamesPlayed;
            var tpg = (totals.turnovers || 0) / gamesPlayed;
            
            var fgm = totals.fgm || 0;
            var fga = totals.fga || 0;
            var tpm = totals.tpm || 0;
            var tpa = totals.tpa || 0;
            var fgPct = fga > 0 ? (fgm / fga * 100) : 0;
            var tpPct = tpa > 0 ? (tpm / tpa * 100) : 0;
            
            frame.gotoxy(col1, y);
            frame.putmsg("\1cPPG:\1n \1h\1w" + ppg.toFixed(1) + "\1n");
            frame.gotoxy(col1 + 12, y);
            frame.putmsg("\1cRPG:\1n \1h\1w" + rpg.toFixed(1) + "\1n");
            frame.gotoxy(col2, y);
            frame.putmsg("\1cAPG:\1n \1h\1w" + apg.toFixed(1) + "\1n");
            y++;
            
            frame.gotoxy(col1, y);
            frame.putmsg("\1cSPG:\1n \1h\1w" + spg.toFixed(1) + "\1n");
            frame.gotoxy(col1 + 12, y);
            frame.putmsg("\1cBPG:\1n \1h\1w" + bpg.toFixed(1) + "\1n");
            frame.gotoxy(col2, y);
            frame.putmsg("\1cTPG:\1n \1h\1w" + tpg.toFixed(1) + "\1n");
            y++;
            
            frame.gotoxy(col1, y);
            frame.putmsg("\1cFG%:\1n \1h\1w" + fgPct.toFixed(1) + "%\1n");
            frame.gotoxy(col2, y);
            frame.putmsg("\1c3P%:\1n \1h\1w" + tpPct.toFixed(1) + "%\1n");
        } else {
            frame.gotoxy(col1, y);
            frame.putmsg("\1kNo PvP games played yet\1n");
        }
        y += 2;
        
        // === PVP PERSONAL BESTS ===
        frame.gotoxy(col1, y);
        frame.putmsg("\1h\1m[ PVP PERSONAL BESTS ]\1n");
        y++;
        
        var displayStats = ["points", "rebounds", "assists", "steals", "blocks", "dunks"];
        var hasRecords = false;
        
        for (var ri = 0; ri < displayStats.length; ri++) {
            if (pvpRecords[displayStats[ri]] && pvpRecords[displayStats[ri]].value > 0) {
                hasRecords = true;
                break;
            }
        }
        
        if (hasRecords) {
            var recordLabels = {
                points: "PTS",
                rebounds: "REB",
                assists: "AST",
                steals: "STL",
                blocks: "BLK",
                dunks: "DNK"
            };
            
            for (var ri = 0; ri < displayStats.length; ri++) {
                var statKey = displayStats[ri];
                var rec = pvpRecords[statKey];
                var val = (rec && rec.value) ? rec.value : 0;
                var label = recordLabels[statKey];
                
                var colX = col1 + (ri % 3) * 15;
                var rowY = y + Math.floor(ri / 3);
                
                frame.gotoxy(colX, rowY);
                if (rec && rec.opponent) {
                    frame.putmsg("\1c" + label + ":\1n \1h\1m" + val + "\1n \1kvs " + rec.opponent.substr(0, 6) + "\1n");
                } else {
                    frame.putmsg("\1c" + label + ":\1n \1h\1m" + val + "\1n");
                }
            }
        } else {
            frame.gotoxy(col1, y);
            frame.putmsg("\1kNo PvP records set yet\1n");
        }
    }
    
    /**
     * Legacy view for other player's stats (no RichView)
     */
    function showForPlayerLegacy(player, options) {
        options = options || {};
        LORB.View.clear();
        LORB.View.header("PLAYER CARD: " + (player.name || "Unknown"));
        LORB.View.line("");
        
        // Basic info
        LORB.View.line("\1h\1y[ INFO ]\1n");
        LORB.View.line("  From:  " + (player.bbsName || "Unknown BBS"));
        LORB.View.line("  Level: " + (player.level || 1));
        LORB.View.line("  Rep:   \1c" + (player.rep || 0) + "\1n");
        LORB.View.line("");
        
        // Attributes (if available)
        if (player.stats && Object.keys(player.stats).length > 0) {
            LORB.View.line("\1h\1y[ ATTRIBUTES ]\1n");
            var statLabels = [
                { key: "speed", label: "SPD" },
                { key: "threePt", label: "3PT" },
                { key: "power", label: "PWR" },
                { key: "steal", label: "STL" },
                { key: "block", label: "BLK" },
                { key: "dunk", label: "DNK" }
            ];
            for (var si = 0; si < statLabels.length; si++) {
                var stat = statLabels[si];
                var val = player.stats[stat.key] || 4;
                var bar = "";
                for (var b = 0; b < Math.min(val, 10); b++) bar += "\1g#";
                for (var b = Math.min(val, 10); b < 10; b++) bar += "\1k.";
                LORB.View.line("  " + stat.label + " " + bar + " " + val);
            }
            LORB.View.line("");
        }
        
        // Record
        LORB.View.line("\1h\1y[ RECORD ]\1n");
        LORB.View.line("  Games: " + (player.gamesPlayed || 0) + "  Wins: \1g" + (player.wins || 0) + "\1n  Losses: \1r" + (player.losses || 0) + "\1n");
        var totalGames = (player.wins || 0) + (player.losses || 0);
        var winPct = totalGames > 0 ? Math.round((player.wins || 0) / totalGames * 100) : 0;
        LORB.View.line("  Win%:  " + winPct + "%");
        LORB.View.line("");
        
        // Career Averages
        if (player.careerStats && player.careerStats.gamesPlayed > 0) {
            var career = player.careerStats;
            var games = career.gamesPlayed;
            var totals = career.totals || {};
            
            var ppg = (totals.points || 0) / games;
            var rpg = (totals.rebounds || 0) / games;
            var apg = (totals.assists || 0) / games;
            var spg = (totals.steals || 0) / games;
            var bpg = (totals.blocks || 0) / games;
            var tpg = (totals.turnovers || 0) / games;
            
            LORB.View.line("\1h\1y[ CAREER AVERAGES ]\1n");
            LORB.View.line("  PPG: " + ppg.toFixed(1) + "  RPG: " + rpg.toFixed(1) + "  APG: " + apg.toFixed(1));
            LORB.View.line("  SPG: " + spg.toFixed(1) + "  BPG: " + bpg.toFixed(1) + "  TPG: " + tpg.toFixed(1));
            
            var fgm = totals.fgm || 0;
            var fga = totals.fga || 0;
            var tpm = totals.tpm || 0;
            var tpa = totals.tpa || 0;
            var fgPct = fga > 0 ? (fgm / fga * 100) : 0;
            var tpPct = tpa > 0 ? (tpm / tpa * 100) : 0;
            LORB.View.line("  FG%: " + fgPct.toFixed(1) + "%  3P%: " + tpPct.toFixed(1) + "%");
            LORB.View.line("");
            
            // Career totals
            LORB.View.line("\1h\1y[ CAREER TOTALS ]\1n");
            LORB.View.line("  PTS: " + (totals.points || 0) + "  REB: " + (totals.rebounds || 0) + "  AST: " + (totals.assists || 0));
            LORB.View.line("  STL: " + (totals.steals || 0) + "  BLK: " + (totals.blocks || 0) + "  DNK: " + (totals.dunks || 0));
            LORB.View.line("");
        }
        
        // Personal Bests
        if (player.records) {
            var hasRecords = false;
            var displayStats = ["points", "rebounds", "assists", "steals", "blocks", "dunks"];
            for (var ri = 0; ri < displayStats.length; ri++) {
                if (player.records[displayStats[ri]] && player.records[displayStats[ri]].value > 0) {
                    hasRecords = true;
                    break;
                }
            }
            if (hasRecords) {
                LORB.View.line("\1h\1y[ SINGLE GAME RECORDS ]\1n");
                var line = "  ";
                for (var ri = 0; ri < displayStats.length; ri++) {
                    var rec = player.records[displayStats[ri]];
                    var val = (rec && rec.value) ? rec.value : 0;
                    line += displayStats[ri].substring(0,3).toUpperCase() + ":" + val + " ";
                }
                LORB.View.line(line);
                LORB.View.line("");
            }
        }
        
        // Show options
        LORB.View.line("");
        var showLive = options.canLiveChallenge && !options.isSelf;
        var showGhost = options.canChallenge && !options.isSelf && options.maxWager > 0;
        if (showLive) {
            LORB.View.line("\1h\1y[L]\1n Live Challenge");
        }
        if (showGhost) {
            LORB.View.line("\1h\1y[C]\1n Challenge to Ghost Match (wager up to $" + options.maxWager + ")");
        }
        if (options.isSelf) {
            LORB.View.line("\1kThis is you!\1n");
        }
        LORB.View.line("\1w[Q] Back\1n");
        LORB.View.line("");
        
        // Handle input
        while (true) {
            var key = console.getkey();
            if (key === "q" || key === "Q" || key === "\x1B") {
                return null;
            }
            if ((key === "l" || key === "L") && showLive) {
                return "live_challenge";
            }
            if ((key === "c" || key === "C") && showGhost) {
                return "challenge";
            }
        }
    }
    
    // Export to LORB namespace
    if (!LORB.UI) LORB.UI = {};
    LORB.UI.StatsView = {
        show: show,
        showForPlayer: showForPlayer
    };
    
})();
