/**
 * family_view.js - Family Tree Visualization
 * 
 * ASCII art display showing:
 * - Player at center/top
 * - Spouse (if married)
 * - Baby mamas with relationship lines
 * - Children with status indicators
 */

var _familyRichView = null;
try {
    load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");
    _familyRichView = RichView;
} catch (e) {
    log(LOG_WARNING, "[FAMILY_VIEW] Failed to load RichView: " + e);
}

(function() {
    
    var RichView = _familyRichView;
    
    // CP437 box drawing characters
    var HLINE = "\xC4";  // horizontal line ─
    var VLINE = "\xB3";  // vertical line │
    var TL = "\xDA";     // top-left corner ┌
    var TR = "\xBF";     // top-right corner ┐
    var BL = "\xC0";     // bottom-left corner └
    var BR = "\xD9";     // bottom-right corner ┘
    var T_DOWN = "\xC2"; // T pointing down ┬
    var T_UP = "\xC1";   // T pointing up ┴
    var T_LEFT = "\xB4"; // T pointing left ┤
    var T_RIGHT = "\xC3";// T pointing right ├
    var CROSS = "\xC5";  // Cross ┼
    var HEART = "\x03";  // Heart ♥
    var BROKEN = "\x04"; // Diamond (for broken heart) ♦
    
    /**
     * Repeat a character n times
     */
    function repeatChar(ch, n) {
        var s = "";
        for (var i = 0; i < n; i++) s += ch;
        return s;
    }
    
    /**
     * Truncate string to max length
     */
    function truncate(str, max) {
        if (!str) return "";
        if (str.length <= max) return str;
        return str.substring(0, max - 2) + "..";
    }
    
    /**
     * Get relationship status symbol
     */
    function getRelationshipSymbol(relationship) {
        if (relationship >= 75) return "\1g" + HEART + "\1n";
        if (relationship >= 50) return "\1c" + HEART + "\1n";
        if (relationship >= 25) return "\1y" + HEART + "\1n";
        if (relationship >= 0) return "\1r" + HEART + "\1n";
        return "\1r" + BROKEN + "\1n";
    }
    
    /**
     * Get child status indicator
     */
    function getChildStatus(child) {
        if (child.isNemesis) return "\1h\1r[NEM]\1n";
        if (child.adoptiveFatherName) return "\1h\1m[ADPT]\1n";
        if (child.childSupport && child.childSupport.isAbandoned) return "\1h\1k[ABD]\1n";  // Abandoned - dark gray
        if (child.childSupport && child.childSupport.isPaidOff) return "\1h\1g[IND]\1n";
        if (child.childSupport && child.childSupport.isOverdue) return "\1h\1r[$!]\1n";
        return "\1y[$]\1n";
    }
    
    /**
     * Build the family tree data structure
     */
    function buildFamilyTree(ctx) {
        var tree = {
            player: {
                name: ctx.name || ctx.nickname || "YOU",
                spouse: null,
                partners: []
            },
            totalChildren: 0,
            nemesisCount: 0,
            adoptedCount: 0
        };
        
        // Check for spouse
        if (ctx.romance && ctx.romance.spouseName) {
            tree.player.spouse = {
                name: ctx.romance.spouseName,
                cityId: ctx.romance.spouseCityId
            };
        }
        
        // Collect baby mamas and their children
        var babyMamas = ctx.babyMamas || [];
        var babies = ctx.babyBallers || [];
        
        for (var i = 0; i < babyMamas.length; i++) {
            var mama = babyMamas[i];
            var partner = {
                id: mama.id,
                name: mama.name,
                cityId: mama.cityId,
                relationship: mama.relationship || 0,
                isNemesis: mama.isNemesis || false,
                isSpouse: ctx.romance && ctx.romance.spouseName === mama.name,
                children: []
            };
            
            // Find children for this mama
            for (var j = 0; j < babies.length; j++) {
                var baby = babies[j];
                if (baby.motherId === mama.id || baby.motherName === mama.name) {
                    partner.children.push(baby);
                    tree.totalChildren++;
                    if (baby.isNemesis) tree.nemesisCount++;
                    if (baby.adoptiveFatherName) tree.adoptedCount++;
                }
            }
            
            tree.player.partners.push(partner);
        }
        
        return tree;
    }
    
    /**
     * Draw the family tree using RichView
     */
    function showRichView(ctx) {
        var tree = buildFamilyTree(ctx);
        
        var view = new RichView({
            zones: [
                { name: "header", x: 1, y: 1, width: 80, height: 4 },
                { name: "tree", x: 1, y: 5, width: 80, height: 18 },
                { name: "footer", x: 1, y: 23, width: 80, height: 2 }
            ],
            theme: "lorb"
        });
        
        // Header
        var headerFrame = view.getZone("header");
        if (headerFrame) {
            headerFrame.gotoxy(1, 1);
            headerFrame.putmsg("\1h\1y" + repeatChar(HLINE, 78) + "\1n");
            headerFrame.gotoxy(1, 2);
            headerFrame.putmsg("  \1h\1cFAMILY TREE: \1w" + tree.player.name + "\1n");
            headerFrame.gotoxy(1, 3);
            headerFrame.putmsg("  \1wChildren: \1c" + tree.totalChildren + 
                              "\1n  \1wNemeses: \1r" + tree.nemesisCount + 
                              "\1n  \1wAdopted: \1m" + tree.adoptedCount + "\1n");
            headerFrame.gotoxy(1, 4);
            headerFrame.putmsg("\1h\1y" + repeatChar(HLINE, 78) + "\1n");
        }
        
        // Tree content
        view.setContentZone("tree");
        
        // Draw player at top
        view.line("\1h\1c" + repeatChar(" ", 35) + TL + repeatChar(HLINE, 8) + TR + "\1n");
        view.line("\1h\1c" + repeatChar(" ", 35) + VLINE + " \1wYOU\1c    " + VLINE + "\1n");
        view.line("\1h\1c" + repeatChar(" ", 35) + BL + repeatChar(HLINE, 3) + T_DOWN + repeatChar(HLINE, 4) + BR + "\1n");
        
        // Draw spouse connection if married
        if (tree.player.spouse) {
            view.line("\1h\1g" + repeatChar(" ", 39) + VLINE + "\1n");
            view.line("\1h\1g" + repeatChar(" ", 35) + TL + repeatChar(HLINE, 3) + T_UP + repeatChar(HLINE, 3) + TR + "\1n");
            var spouseLine = "\1h\1g" + repeatChar(" ", 35) + VLINE + " " + HEART + " ";
            spouseLine += "\1w" + truncate(tree.player.spouse.name, 8);
            spouseLine += "\1g " + VLINE + "\1n";
            view.line(spouseLine);
            view.line("\1h\1g" + repeatChar(" ", 35) + BL + repeatChar(HLINE, 8) + BR + "\1n");
            view.blank();
        } else {
            view.line("\1h\1c" + repeatChar(" ", 39) + VLINE + "\1n");
            view.blank();
        }
        
        // Draw partners and children
        if (tree.player.partners.length === 0) {
            view.line("\1w" + repeatChar(" ", 30) + "No baby mamas yet...\1n");
            view.line("\1w" + repeatChar(" ", 30) + "(Try flirting at Club 23)\1n");
        } else {
            // Show partners in a horizontal layout
            var lineWidth = 0;
            var partnerLine = "  ";
            var childLines = [];
            
            for (var p = 0; p < tree.player.partners.length; p++) {
                var partner = tree.player.partners[p];
                var relSym = getRelationshipSymbol(partner.relationship);
                var spouseMarker = partner.isSpouse ? "\1h\1g*\1n" : "";
                
                // Partner box (simplified for horizontal layout)
                var partnerBox = relSym + " \1y" + truncate(partner.name, 12) + spouseMarker + "\1n";
                
                if (lineWidth + 20 > 78 && lineWidth > 0) {
                    view.line(partnerLine);
                    partnerLine = "  ";
                    lineWidth = 0;
                }
                
                partnerLine += partnerBox + "  ";
                lineWidth += 20;
                
                // Collect child info
                for (var c = 0; c < partner.children.length; c++) {
                    var child = partner.children[c];
                    var childInfo = {
                        name: child.nickname || child.name,
                        status: getChildStatus(child),
                        mother: partner.name
                    };
                    childLines.push(childInfo);
                }
            }
            
            if (partnerLine.trim().length > 0) {
                view.line(partnerLine);
            }
            
            view.blank();
            view.line("\1h\1y  CHILDREN:\1n");
            view.line("  " + repeatChar(HLINE, 50));
            
            // Display children in a grid
            if (childLines.length === 0) {
                view.line("  \1w(No children born yet)\1n");
            } else {
                var childLineStr = "  ";
                var cLineWidth = 0;
                for (var i = 0; i < childLines.length; i++) {
                    var cl = childLines[i];
                    var entry = cl.status + " \1c" + truncate(cl.name, 10) + "\1n";
                    
                    if (cLineWidth + 18 > 76 && cLineWidth > 0) {
                        view.line(childLineStr);
                        childLineStr = "  ";
                        cLineWidth = 0;
                    }
                    
                    childLineStr += entry + "  ";
                    cLineWidth += 18;
                }
                
                if (childLineStr.trim().length > 0) {
                    view.line(childLineStr);
                }
            }
        }
        
        // Footer with legend
        var footerFrame = view.getZone("footer");
        if (footerFrame) {
            footerFrame.gotoxy(1, 1);
            footerFrame.putmsg("  \1wLegend: \1g[IND]\1w=Independent \1y[$]\1w=Dependent \1r[$!]\1w=Overdue \1r[NEM]\1w=Nemesis \1k[ABD]\1w=Abandoned \1m[ADPT]\1w=Adopted\1n");
            footerFrame.gotoxy(1, 2);
            footerFrame.putmsg("  \1wPress any key to continue...\1n");
        }
        
        view.render();
        console.getkey();
        view.close();
    }
    
    /**
     * Legacy fallback display
     */
    function showLegacy(ctx) {
        var tree = buildFamilyTree(ctx);
        
        if (typeof LORB !== "undefined" && LORB.View) {
            LORB.View.init();
            LORB.View.clear();
            LORB.View.header("FAMILY TREE");
            LORB.View.line("");
            LORB.View.line("\1wPlayer: \1c" + tree.player.name + "\1n");
            
            if (tree.player.spouse) {
                LORB.View.line("\1gSpouse: \1w" + tree.player.spouse.name + "\1n");
            }
            
            LORB.View.line("");
            LORB.View.line("\1yBaby Mamas:\1n");
            
            if (tree.player.partners.length === 0) {
                LORB.View.line("  (none)");
            } else {
                for (var i = 0; i < tree.player.partners.length; i++) {
                    var p = tree.player.partners[i];
                    var sym = getRelationshipSymbol(p.relationship);
                    LORB.View.line("  " + sym + " " + p.name + " (" + p.children.length + " kids)");
                }
            }
            
            LORB.View.line("");
            LORB.View.line("\1yChildren:\1n");
            
            var babies = ctx.babyBallers || [];
            if (babies.length === 0) {
                LORB.View.line("  (none)");
            } else {
                for (var j = 0; j < babies.length; j++) {
                    var b = babies[j];
                    var status = getChildStatus(b);
                    LORB.View.line("  " + status + " " + (b.nickname || b.name) + " - " + (b.motherName || "Unknown"));
                }
            }
            
            LORB.View.line("");
            LORB.View.line("\1wPress any key to continue...\1n");
            console.getkey();
        }
    }
    
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
    
    // Export
    LORB = (typeof LORB !== "undefined") ? LORB : {};
    LORB.UI = LORB.UI || {};
    LORB.UI.FamilyView = {
        show: show,
        buildFamilyTree: buildFamilyTree
    };
    
})();
