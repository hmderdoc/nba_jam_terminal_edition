/**
 * sprite-wanderer.js - Animated Sprite Wandering System for LORB
 * 
 * Creates ambient animation by having player sprites wander over background art.
 * Creates Frame children directly (bypasses Sprite.Aerial due to Frame class mismatch).
 * 
 * Usage:
 *   var wanderer = new SpriteWanderer({
 *       parentFrame: artFrame,           // Frame to render sprites on
 *       sprites: [                       // Array of sprite configs
 *           { skin: "sonic", x: 5, y: 10 },
 *           { skin: "brown", x: 20, y: 8, shortNick: "MJ", jerseyConfig: {...} }
 *       ],
 *       walkableZones: [                 // Where sprites CAN walk
 *           { x: 2, y: 8, width: 36, height: 10 }
 *       ],
 *       options: {
 *           speed: 300,                  // ms between moves
 *           pauseChance: 0.3,            // chance to pause vs move
 *           spriteWidth: 5,              // sprite dimensions
 *           spriteHeight: 4,
 *           showNametags: true           // show shortNick above sprites
 *       }
 *   });
 *   wanderer.start();
 *   // ... run menu loop ...
 *   wanderer.stop();
 * 
 * Sprite config options:
 *   - skin: string - skin name (brown, sonic, shrek, etc.)
 *   - shortNick: string - short nickname to display above sprite
 *   - jerseyConfig: object - { jerseyBg, accentFg, jerseyNumber } for mask
 *   - x, y: starting position
 *   - bearing: starting direction (n, ne, e, se, s, sw, w, nw)
 */

(function() {
    
    // Debug logging (disable for production)
    var DEBUG_WANDERER = false;
    function traceLog(msg) {
        if (!DEBUG_WANDERER) return;
        try {
            var f = new File("/sbbs/xtrn/nba_jam/data/wanderer_debug.log");
            if (f.open("a")) {
                f.writeln("[" + new Date().toISOString() + "] " + msg);
                f.close();
            }
        } catch (e) { /* ignore */ }
    }
    
    // Sprite dimensions (from game sprites)
    var DEFAULT_SPRITE_WIDTH = 5;
    var DEFAULT_SPRITE_HEIGHT = 4;
    
    // Default timing
    var DEFAULT_SPEED_MS = 300;
    var DEFAULT_PAUSE_CHANCE = 0.3;
    
    // Movement directions with corresponding bearings
    var DIRECTIONS = [
        { dx: 0, dy: -1, bearing: "n" },   // North
        { dx: 1, dy: -1, bearing: "ne" },  // Northeast
        { dx: 1, dy: 0, bearing: "e" },    // East
        { dx: 1, dy: 1, bearing: "se" },   // Southeast
        { dx: 0, dy: 1, bearing: "s" },    // South
        { dx: -1, dy: 1, bearing: "sw" },  // Southwest
        { dx: -1, dy: 0, bearing: "w" },   // West
        { dx: -1, dy: -1, bearing: "nw" }  // Northwest
    ];
    
    // Path to sprite files
    var SPRITE_DIR = "/sbbs/xtrn/nba_jam/sprites/";
    
    /**
     * SpriteWanderer - manages multiple sprites wandering on a frame
     */
    function SpriteWanderer(config) {
        config = config || {};
        
        this.parentFrame = config.parentFrame;
        this.spriteConfigs = config.sprites || [];
        this.walkableZones = config.walkableZones || [];
        this.avoidZones = config.avoidZones || [];
        
        var opts = config.options || {};
        this.speed = opts.speed || DEFAULT_SPEED_MS;
        this.pauseChance = opts.pauseChance || DEFAULT_PAUSE_CHANCE;
        this.spriteWidth = opts.spriteWidth || DEFAULT_SPRITE_WIDTH;
        this.spriteHeight = opts.spriteHeight || DEFAULT_SPRITE_HEIGHT;
        this.showNametags = opts.showNametags !== false;  // Default true
        
        this.sprites = [];
        this.nametagFrames = [];  // Separate frames for nametags
        this.running = false;
        this.lastUpdate = 0;
        this._initialized = false;
    }
    
    /**
     * Check if a position is within any walkable zone (accounting for sprite size)
     */
    SpriteWanderer.prototype.isWalkable = function(x, y) {
        // Sprite occupies x to x+width-1, y to y+height-1
        var right = x + this.spriteWidth - 1;
        var bottom = y + this.spriteHeight - 1;
        
        // Must be fully inside at least one walkable zone
        var inWalkable = false;
        for (var i = 0; i < this.walkableZones.length; i++) {
            var zone = this.walkableZones[i];
            if (x >= zone.x && right <= zone.x + zone.width - 1 &&
                y >= zone.y && bottom <= zone.y + zone.height - 1) {
                inWalkable = true;
                break;
            }
        }
        
        if (!inWalkable) return false;
        
        // Must not overlap any avoid zone
        for (var j = 0; j < this.avoidZones.length; j++) {
            var avoid = this.avoidZones[j];
            // Check for rectangle overlap
            if (x < avoid.x + avoid.width && right >= avoid.x &&
                y < avoid.y + avoid.height && bottom >= avoid.y) {
                return false;
            }
        }
        
        return true;
    };
    
    /**
     * Check if a position would overlap another sprite
     */
    SpriteWanderer.prototype.wouldOverlap = function(x, y, excludeIndex) {
        var right = x + this.spriteWidth - 1;
        var bottom = y + this.spriteHeight - 1;
        
        for (var i = 0; i < this.sprites.length; i++) {
            if (i === excludeIndex) continue;
            var other = this.sprites[i];
            var ox = other.x;
            var oy = other.y;
            var oright = ox + this.spriteWidth - 1;
            var obottom = oy + this.spriteHeight - 1;
            
            // Check overlap
            if (x <= oright && right >= ox && y <= obottom && bottom >= oy) {
                return true;
            }
        }
        return false;
    };
    
    /**
     * Get valid move directions for a sprite at given position
     */
    SpriteWanderer.prototype.getValidMoves = function(x, y, spriteIndex) {
        var valid = [];
        for (var i = 0; i < DIRECTIONS.length; i++) {
            var dir = DIRECTIONS[i];
            var nx = x + dir.dx;
            var ny = y + dir.dy;
            if (this.isWalkable(nx, ny) && !this.wouldOverlap(nx, ny, spriteIndex)) {
                valid.push(dir);
            }
        }
        return valid;
    };
    
    /**
     * Resolve skin name to sprite INI path
     */
    SpriteWanderer.prototype.resolveSpriteBase = function(skin) {
        skin = String(skin || "brown").toLowerCase();
        return SPRITE_DIR + "player-" + skin;
    };
    
    /**
     * Load sprite .bin file and parse bearings from .ini
     */
    SpriteWanderer.prototype.loadSpriteData = function(skin) {
        var basePath = this.resolveSpriteBase(skin);
        var iniPath = basePath + ".ini";
        var binPath = basePath + ".bin";
        
        if (!file_exists(iniPath) || !file_exists(binPath)) {
            traceLog("Sprite files not found: " + basePath);
            return null;
        }
        
        // Parse INI
        var iniFile = new File(iniPath);
        if (!iniFile.open("r")) {
            traceLog("Failed to open INI: " + iniPath);
            return null;
        }
        var ini = iniFile.iniGetObject();
        iniFile.close();
        
        var width = parseInt(ini.width) || this.spriteWidth;
        var height = parseInt(ini.height) || this.spriteHeight;
        var bearings = (ini.bearings || "s").split(",");
        var positions = (ini.positions || "normal").split(",");
        
        // Load BIN
        var binFile = new File(binPath);
        if (!binFile.open("rb")) {
            traceLog("Failed to open BIN: " + binPath);
            return null;
        }
        var binData = binFile.read();
        binFile.close();
        
        // Calculate bearing offsets (y offset = bearing_index * height)
        var bearingOffsets = {};
        for (var i = 0; i < bearings.length; i++) {
            bearingOffsets[bearings[i]] = height * i;
        }
        
        return {
            width: width,
            height: height,
            bearings: bearings,
            bearingOffsets: bearingOffsets,
            positions: positions,
            binData: binData,
            totalWidth: width * positions.length,
            totalHeight: height * bearings.length
        };
    };
    
    /**
     * Scroll frame to show the correct bearing (sprite sheet style)
     */
    SpriteWanderer.prototype.scrollToBearing = function(frame, spriteData, bearing) {
        var yOffset = spriteData.bearingOffsets[bearing] || 0;
        // scrollTo uses x, y offsets into the loaded sprite sheet
        // x = 0 (first position), y = bearing offset
        frame.scrollTo(0, yOffset);
    };
    
    /**
     * Apply jersey colors to a sprite frame (simplified version for ambient sprites)
     * Modifies: jersey background, jersey number digits, shorts
     * 
     * Sprite layout (5x4):
     *   Row 0: head top
     *   Row 1: face/eyes
     *   Row 2: jersey (cols 1,3 = number digits, col 2 = neck)
     *   Row 3: legs/shorts (cols 1,3 = shorts)
     * 
     * @param {Frame} frame - The sprite frame
     * @param {Object} jerseyConfig - { jerseyBg, accentFg, jerseyNumber }
     * @param {Object} spriteData - Parsed sprite data with dimensions
     */
    SpriteWanderer.prototype.applyJerseyMask = function(frame, jerseyConfig, spriteData) {
        if (!frame || !jerseyConfig) return;
        
        // Parse jersey background color
        var jerseyBg = this.parseColor(jerseyConfig.jerseyBg, "BG_");
        if (jerseyBg === null) return;  // No jersey color to apply
        
        // Parse accent color (for number digits)
        var accentFg = this.parseColor(jerseyConfig.accentFg, "");
        if (accentFg === null) accentFg = 15;  // Default to white
        
        // Parse jersey number
        var jerseyNumber = jerseyConfig.jerseyNumber;
        var leftDigit = "#";
        var rightDigit = "#";
        if (jerseyNumber !== null && jerseyNumber !== undefined) {
            var digits = String(jerseyNumber).replace(/[^0-9]/g, "");
            if (digits.length >= 2) {
                leftDigit = digits.charAt(0);
                rightDigit = digits.charAt(1);
            } else if (digits.length === 1) {
                rightDigit = digits.charAt(0);
            }
        }
        
        var digitsAttr = accentFg | jerseyBg;
        var width = spriteData.width || 5;
        
        // Get the scroll offset to find actual data position in sprite sheet
        var scrollY = frame.scroll ? frame.scroll.y || 0 : 0;
        
        // Apply to visible window (the current bearing)
        // Note: We're working with frame's internal data, not its display position
        
        // Row 2: jersey number
        // Left digit at x=1
        frame.setData(1, scrollY + 2, leftDigit, digitsAttr);
        // Neck stays as-is (preserves skin color)
        // Right digit at x=3
        frame.setData(3, scrollY + 2, rightDigit, digitsAttr);
        
        // Row 3: shorts (apply jersey background)
        var shortsChar = ascii(220);  // ▄
        // Get current foreground colors (shoe color) and apply jersey bg
        var leftLeg = frame.getData(1, scrollY + 3, false);
        var leftFg = (leftLeg && typeof leftLeg.attr === "number") ? (leftLeg.attr & 0x0F) : 7;
        frame.setData(1, scrollY + 3, shortsChar, leftFg | jerseyBg);
        
        var rightLeg = frame.getData(3, scrollY + 3, false);
        var rightFg = (rightLeg && typeof rightLeg.attr === "number") ? (rightLeg.attr & 0x0F) : 7;
        frame.setData(3, scrollY + 3, shortsChar, rightFg | jerseyBg);
    };
    
    /**
     * Parse a color string (like "RED", "BG_BLUE") to attribute value
     */
    SpriteWanderer.prototype.parseColor = function(colorStr, prefix) {
        if (colorStr === null || colorStr === undefined) return null;
        if (typeof colorStr === "number") return colorStr;
        
        var str = String(colorStr).toUpperCase();
        
        // Color name to value map
        var colors = {
            "BLACK": 0, "BLUE": 1, "GREEN": 2, "CYAN": 3,
            "RED": 4, "MAGENTA": 5, "BROWN": 6, "LIGHTGRAY": 7,
            "DARKGRAY": 8, "LIGHTBLUE": 9, "LIGHTGREEN": 10, "LIGHTCYAN": 11,
            "LIGHTRED": 12, "LIGHTMAGENTA": 13, "YELLOW": 14, "WHITE": 15
        };
        
        // Background versions
        var bgColors = {
            "BG_BLACK": 0, "BG_BLUE": 16, "BG_GREEN": 32, "BG_CYAN": 48,
            "BG_RED": 64, "BG_MAGENTA": 80, "BG_BROWN": 96, "BG_LIGHTGRAY": 112
        };
        
        // Try as bg color first
        if (bgColors[str] !== undefined) return bgColors[str];
        if (bgColors["BG_" + str] !== undefined) return bgColors["BG_" + str];
        
        // Try as fg color
        if (colors[str] !== undefined) {
            // If expecting background, convert
            if (prefix === "BG_") {
                return colors[str] << 4;  // Shift to background position
            }
            return colors[str];
        }
        
        return null;
    };
    
    /**
     * Initialize sprites by creating Frame children directly
     */
    SpriteWanderer.prototype.init = function() {
        traceLog("init() called, _initialized=" + this._initialized);
        if (this._initialized) return;
        if (!this.parentFrame) {
            traceLog("ERROR: No parentFrame provided");
            return;
        }
        
        // Get the Frame constructor from our parent (to avoid different Frame class issue)
        var FrameClass = this.parentFrame.constructor;
        traceLog("Using FrameClass from parentFrame.constructor");
        
        traceLog("Creating " + this.spriteConfigs.length + " sprites");
        for (var i = 0; i < this.spriteConfigs.length; i++) {
            var config = this.spriteConfigs[i];
            var skin = config.skin || "brown";
            var startX = config.x || 5;
            var startY = config.y || 10;
            var bearing = config.bearing || "s";
            
            traceLog("Sprite " + i + ": skin=" + skin + " pos=(" + startX + "," + startY + ") bearing=" + bearing);
            
            // Load sprite data
            var spriteData = this.loadSpriteData(skin);
            if (!spriteData) {
                traceLog("Failed to load sprite data for " + skin);
                continue;
            }
            traceLog("Loaded sprite: " + spriteData.width + "x" + spriteData.height + " bearings=" + spriteData.bearings.join(","));
            
            // Validate starting position
            if (!this.isWalkable(startX, startY)) {
                traceLog("Start pos not walkable, searching for valid position...");
                var found = false;
                for (var z = 0; z < this.walkableZones.length && !found; z++) {
                    var zone = this.walkableZones[z];
                    for (var ty = zone.y; ty <= zone.y + zone.height - this.spriteHeight && !found; ty++) {
                        for (var tx = zone.x; tx <= zone.x + zone.width - this.spriteWidth && !found; tx++) {
                            if (this.isWalkable(tx, ty) && !this.wouldOverlap(tx, ty, this.sprites.length)) {
                                startX = tx;
                                startY = ty;
                                found = true;
                            }
                        }
                    }
                }
                if (found) {
                    traceLog("Found valid position: (" + startX + "," + startY + ")");
                }
            }
            
            try {
                // Create frame as child of parent using SAME Frame class
                // Frame is sized to one bearing, but loads full sprite sheet for scrolling
                var spriteFrame = new FrameClass(
                    startX, startY,
                    spriteData.width, spriteData.height,
                    0,  // transparent background
                    this.parentFrame
                );
                spriteFrame.transparent = true;
                spriteFrame.v_scroll = true;  // Enable vertical scrolling
                spriteFrame.h_scroll = true;  // Enable horizontal scrolling
                
                // Load full sprite sheet into frame
                var binPath = this.resolveSpriteBase(skin) + ".bin";
                spriteFrame.load(binPath, spriteData.totalWidth, spriteData.totalHeight);
                spriteFrame.open();
                
                traceLog("Created child frame at (" + startX + "," + startY + "), parent=" + (spriteFrame.parent ? "exists" : "null"));
                
                // Scroll to initial bearing
                this.scrollToBearing(spriteFrame, spriteData, bearing);
                
                // Create nametag frame if shortNick provided and showNametags enabled
                var nametagFrame = null;
                var shortNick = config.shortNick || "";
                if (this.showNametags && shortNick) {
                    // Nametag appears above the sprite (y - 1)
                    // Width matches nickname length, centered over sprite
                    var tagWidth = shortNick.length;
                    var tagX = startX + Math.floor((spriteData.width - tagWidth) / 2);
                    var tagY = startY - 1;
                    
                    nametagFrame = new FrameClass(
                        tagX, tagY,
                        tagWidth, 1,
                        0,
                        this.parentFrame
                    );
                    nametagFrame.transparent = true;
                    nametagFrame.open();
                    
                    // Draw the nametag (white on transparent)
                    var WHITE = 7;
                    for (var c = 0; c < shortNick.length; c++) {
                        nametagFrame.setData(c, 0, shortNick.charAt(c), WHITE, false);
                    }
                }
                
                // Build jersey config from sprite config
                var jerseyConfig = null;
                if (config.jerseyBg) {
                    jerseyConfig = {
                        jerseyBg: config.jerseyBg,
                        accentFg: config.accentFg || null,
                        jerseyNumber: config.jerseyNumber || null
                    };
                    // Apply jersey mask to initial bearing
                    this.applyJerseyMask(spriteFrame, jerseyConfig, spriteData);
                }
                
                this.sprites.push({
                    frame: spriteFrame,
                    nametagFrame: nametagFrame,
                    shortNick: shortNick,
                    jerseyConfig: jerseyConfig,
                    spriteData: spriteData,
                    x: startX,
                    y: startY,
                    bearing: bearing,
                    skin: skin,
                    paused: false,
                    pauseFrames: 0
                });
                traceLog("Sprite '" + skin + "' added successfully, total sprites=" + this.sprites.length + (jerseyConfig ? " (with jersey)" : ""));
            } catch (e) {
                traceLog("ERROR creating sprite '" + skin + "': " + e + (e.stack ? "\n" + e.stack : ""));
            }
        }
        
        this._initialized = true;
        traceLog("init() complete, _initialized=" + this._initialized + " sprites.length=" + this.sprites.length);
    };
    
    /**
     * Move a single sprite one step
     */
    SpriteWanderer.prototype.moveSprite = function(index) {
        var s = this.sprites[index];
        if (!s || !s.frame) return;
        
        // Handle pause state
        if (s.paused) {
            s.pauseFrames--;
            if (s.pauseFrames <= 0) {
                s.paused = false;
            }
            return;
        }
        
        // Random pause chance
        if (Math.random() < this.pauseChance) {
            s.paused = true;
            s.pauseFrames = Math.floor(Math.random() * 5) + 2;  // Pause 2-6 ticks
            return;
        }
        
        // Get valid moves
        var validMoves = this.getValidMoves(s.x, s.y, index);
        if (validMoves.length === 0) return;
        
        // Prefer continuing in same direction 70% of the time
        var currentDir = null;
        for (var i = 0; i < DIRECTIONS.length; i++) {
            if (DIRECTIONS[i].bearing === s.bearing) {
                currentDir = DIRECTIONS[i];
                break;
            }
        }
        
        var chosenDir;
        if (currentDir && Math.random() < 0.7) {
            // Try to continue in same direction
            var canContinue = false;
            for (var j = 0; j < validMoves.length; j++) {
                if (validMoves[j].bearing === currentDir.bearing) {
                    canContinue = true;
                    chosenDir = currentDir;
                    break;
                }
            }
            if (!canContinue) {
                // Pick random valid direction
                chosenDir = validMoves[Math.floor(Math.random() * validMoves.length)];
            }
        } else {
            // Pick random valid direction
            chosenDir = validMoves[Math.floor(Math.random() * validMoves.length)];
        }
        
        // Move sprite
        var newX = s.x + chosenDir.dx;
        var newY = s.y + chosenDir.dy;
        
        // Update frame position
        s.frame.moveTo(newX, newY);
        
        // Move nametag with sprite (positioned above)
        if (s.nametagFrame && s.shortNick) {
            var tagWidth = s.shortNick.length;
            var tagX = newX + Math.floor((s.spriteData.width - tagWidth) / 2);
            var tagY = newY - 1;
            s.nametagFrame.moveTo(tagX, tagY);
        }
        
        // Update bearing if changed
        if (s.bearing !== chosenDir.bearing) {
            s.bearing = chosenDir.bearing;
            // Scroll to show the new bearing
            this.scrollToBearing(s.frame, s.spriteData, s.bearing);
            // Re-apply jersey mask (it affects the visible bearing area)
            if (s.jerseyConfig) {
                this.applyJerseyMask(s.frame, s.jerseyConfig, s.spriteData);
            }
        }
        
        s.x = newX;
        s.y = newY;
    };
    
    /**
     * Update all sprites (called from external frame loop)
     */
    SpriteWanderer.prototype.update = function() {
        if (!this.running || !this._initialized) return false;
        
        var now = Date.now();
        if (now - this.lastUpdate < this.speed) {
            return false;
        }
        this.lastUpdate = now;
        
        for (var i = 0; i < this.sprites.length; i++) {
            this.moveSprite(i);
        }
        
        return true;
    };
    
    /**
     * Cycle sprite frames (no-op now, parent.cycle() handles children)
     */
    SpriteWanderer.prototype.cycle = function() {
        // Parent frame's cycle() handles all children automatically
        // Nothing needed here
    };
    
    /**
     * Start the wandering animation
     */
    SpriteWanderer.prototype.start = function() {
        this.init();
        this.running = true;
        this.lastUpdate = Date.now();
    };
    
    /**
     * Stop and clean up
     */
    SpriteWanderer.prototype.stop = function() {
        this.running = false;
        
        // Close sprite frames and nametag frames
        for (var i = 0; i < this.sprites.length; i++) {
            var s = this.sprites[i];
            if (s && s.frame) {
                try {
                    s.frame.close();
                } catch (e) {
                    // Frame may already be cleaned up
                }
            }
            if (s && s.nametagFrame) {
                try {
                    s.nametagFrame.close();
                } catch (e) {
                    // Nametag frame may already be cleaned up
                }
            }
        }
        this.sprites = [];
        this.nametagFrames = [];
        this._initialized = false;
    };
    
    /**
     * Check if wanderer is running
     */
    SpriteWanderer.prototype.isRunning = function() {
        return this.running;
    };
    
    // Export
    if (typeof LORB === "undefined") LORB = {};
    if (!LORB.UI) LORB.UI = {};
    LORB.UI.SpriteWanderer = SpriteWanderer;
    
    // Also export globally for direct use
    if (typeof SpriteWanderer === "undefined") {
        this.SpriteWanderer = SpriteWanderer;
    }
    
})();
