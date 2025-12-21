// xtrn/lorb/ui/sprite_preview.js
// Sprite preview for LORB character customization
// Uses Sprite.Aerial to show actual player sprite with uniform masking
(function () {
    
    // Preview box dimensions
    var PREVIEW_WIDTH = 14;
    var PREVIEW_HEIGHT = 10;
    
    // Preview position (right side of screen - absolute screen coords)
    var PREVIEW_X = 60;
    var PREVIEW_Y = 5;
    
    // Sprite dimensions (from player-*.ini: width=5, height=4)
    var SPRITE_WIDTH = 5;
    var SPRITE_HEIGHT = 4;
    
    // Current preview state
    var previewFrame = null;
    var spriteObj = null;
    var isActive = false;
    
    // Path to nba_jam root (LORB is in lib/lorb, sprites are in sprites/)
    var NBA_JAM_ROOT = js.exec_dir.replace(/lib[\/\\]lorb[\/\\]?$/, "");
    
    // Ensure required modules are loaded
    function ensureModulesLoaded() {
        if (typeof Sprite === "undefined" || typeof Sprite.Aerial === "undefined") {
            load("sbbsdefs.js");
            load("frame.js");
            load("sprite.js");
        }
        if (typeof applyUniformMask === "undefined") {
            load(NBA_JAM_ROOT + "lib/rendering/uniform-system.js");
        }
        if (typeof scrubSpriteTransparency === "undefined") {
            load(NBA_JAM_ROOT + "lib/rendering/sprite-utils.js");
        }
        if (typeof getColorValue === "undefined") {
            load(NBA_JAM_ROOT + "lib/utils/team-data.js");
        }
        if (typeof resolveSpriteBaseBySkin === "undefined") {
            load(NBA_JAM_ROOT + "lib/utils/skin-utils.js");
        }
    }
    
    /**
     * Create or update the sprite preview
     */
    function updatePreview(appearance, nickname) {
        var parentFrame = LORB.View.getFrame();
        if (!parentFrame) return false;
        
        ensureModulesLoaded();
        cleanup();
        
        try {
            // Create preview container frame
            previewFrame = new Frame(PREVIEW_X, PREVIEW_Y, PREVIEW_WIDTH, PREVIEW_HEIGHT, BG_BLACK, parentFrame);
            previewFrame.open();
            
            drawPreviewBorder(previewFrame, "PREVIEW");
            
            // Resolve sprite
            var skin = (appearance.skin || "brown").toLowerCase();
            var spriteBase = (typeof resolveSpriteBaseBySkin === "function") 
                ? resolveSpriteBaseBySkin(skin) 
                : "player-" + skin;
            
            var spritePath = NBA_JAM_ROOT + "sprites/" + spriteBase + ".bin";
            var testFile = new File(spritePath);
            if (!testFile.exists) spriteBase = "player-brown";
            
            // Calculate sprite position - ABSOLUTE screen coordinates
            // Preview box is at PREVIEW_X, PREVIEW_Y
            // Center the sprite horizontally within the box, offset down for title
            var spriteAbsX = PREVIEW_X + Math.floor((PREVIEW_WIDTH - SPRITE_WIDTH) / 2);
            var spriteAbsY = PREVIEW_Y + 2;
            
            var oldExecDir = js.exec_dir;
            js.exec_dir = NBA_JAM_ROOT;
            
            spriteObj = new Sprite.Aerial(
                spriteBase,
                previewFrame,
                spriteAbsX,    // Absolute X
                spriteAbsY,    // Absolute Y
                "s",
                "normal"
            );
            
            js.exec_dir = oldExecDir;
            
            // Apply uniform mask
            var jerseyBg = getJerseyBgColor(appearance.jerseyColor);
            var eyeColorAttr = null;
            if (appearance.eyeColor && typeof getColorValue === "function") {
                var eyeValue = getColorValue(appearance.eyeColor);
                if (typeof eyeValue === "number") eyeColorAttr = eyeValue & 0x0F;
            }
            
            var jerseyConfig = {
                jerseyBg: jerseyBg,
                accentFg: WHITE,
                jerseyNumber: appearance.jerseyNumber || "",
                eyeColor: eyeColorAttr
            };
            
            if (typeof applyUniformMask === "function") applyUniformMask(spriteObj, jerseyConfig);
            if (typeof scrubSpriteTransparency === "function") scrubSpriteTransparency(spriteObj);
            
            spriteObj.frame.open();
            
            // Labels
            if (nickname) {
                var displayNick = nickname.substring(0, PREVIEW_WIDTH - 4);
                var labelX = Math.floor((PREVIEW_WIDTH - displayNick.length) / 2);
                if (labelX < 1) labelX = 1;
                previewFrame.gotoxy(labelX, PREVIEW_HEIGHT - 2);
                previewFrame.putmsg("\1h\1c" + displayNick + "\1n");
            }
            
            if (appearance.jerseyNumber) {
                previewFrame.gotoxy(1, PREVIEW_HEIGHT - 3);
                previewFrame.putmsg("\1w#\1h" + appearance.jerseyNumber + "\1n");
            }
            
            isActive = true;
            LORB.View.render();
            
        } catch (e) {
            cleanup();
            isActive = false;
            return false;
        }
        
        return true;
    }
    
    function getJerseyBgColor(colorName) {
        if (!colorName) return BG_RED;
        var map = {
            "RED": BG_RED, "BLUE": BG_BLUE, "GREEN": BG_GREEN,
            "YELLOW": BG_BROWN, "CYAN": BG_CYAN, "MAGENTA": BG_MAGENTA,
            "WHITE": BG_LIGHTGRAY, "BLACK": BG_BLACK, "BROWN": BG_BROWN
        };
        return map[colorName.toUpperCase()] || BG_RED;
    }
    
    function drawPreviewBorder(frame, title) {
        if (!frame) return;
        var w = frame.width, h = frame.height;
        
        frame.gotoxy(0, 0);
        var titleStr = " " + title + " ";
        var dashCount = w - 2 - titleStr.length;
        var leftDash = Math.floor(dashCount / 2);
        var rightDash = dashCount - leftDash;
        frame.putmsg("\1n\1w\xDA" + repeatChar("\xC4", leftDash) + "\1h\1c" + titleStr + "\1n\1w" + repeatChar("\xC4", rightDash) + "\xBF");
        
        for (var y = 1; y < h - 1; y++) {
            frame.gotoxy(0, y);
            frame.putmsg("\1w\xB3");
            frame.gotoxy(w - 1, y);
            frame.putmsg("\1w\xB3");
        }
        
        frame.gotoxy(0, h - 1);
        frame.putmsg("\1w\xC0" + repeatChar("\xC4", w - 2) + "\xD9\1n");
    }
    
    function repeatChar(ch, n) {
        var result = "";
        for (var i = 0; i < n; i++) result += ch;
        return result;
    }
    
    function cleanup() {
        if (spriteObj) {
            try { if (spriteObj.frame) spriteObj.frame.close(); } catch (e) {}
            spriteObj = null;
        }
        if (previewFrame) {
            try { previewFrame.close(); } catch (e) {}
            previewFrame = null;
        }
    }
    
    function closePreview() {
        cleanup();
        isActive = false;
    }
    
    function isPreviewActive() {
        return isActive;
    }
    
    LORB.SpritePreview = {
        update: updatePreview,
        close: closePreview,
        isActive: isPreviewActive,
        PREVIEW_X: PREVIEW_X,
        PREVIEW_Y: PREVIEW_Y,
        PREVIEW_WIDTH: PREVIEW_WIDTH,
        PREVIEW_HEIGHT: PREVIEW_HEIGHT
    };
    
})();
