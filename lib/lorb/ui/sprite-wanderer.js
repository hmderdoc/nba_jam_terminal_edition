/**
 * sprite-wanderer.js - Animated Sprite Wandering System for LORB
 * 
 * Creates ambient animation by having player sprites wander over background art.
 * Uses the Synchronet Sprite library with zone-based walkability constraints.
 * 
 * Usage:
 *   var wanderer = new SpriteWanderer({
 *       parentFrame: artFrame,           // Frame to render sprites on
 *       sprites: [                       // Array of sprite configs
 *           { skin: "sonic", x: 5, y: 10 },
 *           { skin: "shrek", x: 20, y: 8 }
 *       ],
 *       walkableZones: [                 // Where sprites CAN walk
 *           { x: 2, y: 8, width: 36, height: 10 }
 *       ],
 *       options: {
 *           speed: 300,                  // ms between moves
 *           pauseChance: 0.3,            // chance to pause vs move
 *           spriteWidth: 5,              // sprite dimensions
 *           spriteHeight: 4
 *       }
 *   });
 *   wanderer.start();
 *   // ... run menu loop ...
 *   wanderer.stop();
 */

(function() {
    
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
        
        this.sprites = [];
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
     * Initialize sprites (create Sprite.Aerial objects)
     */
    SpriteWanderer.prototype.init = function() {
        if (this._initialized) return;
        if (!this.parentFrame) {
            log(LOG_WARNING, "[WANDERER] No parentFrame provided");
            return;
        }
        
        // Ensure Sprite library is loaded
        if (typeof Sprite === "undefined") {
            try {
                load("sprite.js");
            } catch (e) {
                log(LOG_WARNING, "[WANDERER] Failed to load sprite.js: " + e);
                return;
            }
        }
        
        for (var i = 0; i < this.spriteConfigs.length; i++) {
            var config = this.spriteConfigs[i];
            var skin = config.skin || "brown";
            var startX = config.x || 5;
            var startY = config.y || 10;
            var bearing = config.bearing || "s";
            
            // Validate starting position
            if (!this.isWalkable(startX, startY)) {
                // Try to find a valid position in walkable zones
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
            }
            
            try {
                var spriteBase = this.resolveSpriteBase(skin);
                log(LOG_DEBUG, "[WANDERER] Creating sprite: base=" + spriteBase + " at (" + startX + "," + startY + ")");
                var sprite = new Sprite.Aerial(
                    spriteBase,
                    this.parentFrame,
                    startX,
                    startY,
                    bearing,
                    "normal"
                );
                log(LOG_DEBUG, "[WANDERER] Sprite created, opening frame");
                sprite.frame.open();
                
                this.sprites.push({
                    sprite: sprite,
                    x: startX,
                    y: startY,
                    bearing: bearing,
                    skin: skin,
                    paused: false,
                    pauseFrames: 0
                });
                log(LOG_DEBUG, "[WANDERER] Sprite added successfully");
            } catch (e) {
                log(LOG_WARNING, "[WANDERER] Failed to create sprite for skin '" + skin + "': " + e);
            }
        }
        
        this._initialized = true;
    };
    
    /**
     * Move a single sprite one step
     */
    SpriteWanderer.prototype.moveSprite = function(index) {
        var s = this.sprites[index];
        if (!s || !s.sprite) return;
        
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
        
        s.sprite.moveTo(newX, newY);
        s.sprite.turn(chosenDir.bearing);
        s.x = newX;
        s.y = newY;
        s.bearing = chosenDir.bearing;
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
     * Cycle sprite frames (call this as part of your frame.cycle() loop)
     */
    SpriteWanderer.prototype.cycle = function() {
        if (!this._initialized) return;
        
        // Call Sprite.cycle() if sprites are managed globally
        if (typeof Sprite !== "undefined" && typeof Sprite.cycle === "function") {
            Sprite.cycle();
        }
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
        
        // Close sprite frames
        for (var i = 0; i < this.sprites.length; i++) {
            var s = this.sprites[i];
            if (s && s.sprite && s.sprite.frame) {
                try {
                    s.sprite.remove();
                } catch (e) {
                    // Sprite may already be cleaned up
                }
            }
        }
        this.sprites = [];
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
