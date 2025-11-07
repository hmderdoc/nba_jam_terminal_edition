/**
 * NBA JAM - Sprite Registry
 * 
 * Centralized sprite management system to replace global variables.
 * Provides unified registry for both single-player and multiplayer.
 * 
 * Benefits:
 * - No hidden global dependencies
 * - Testable (can inject mock registry)
 * - Flexible (supports any team size/configuration)
 * - Encapsulated (controlled access to sprites)
 */

var spriteRegistry = {
    /**
     * Internal storage for sprites
     * Format: { "id": sprite }
     */
    sprites: {},
    
    /**
     * Predefined sprite IDs for standard 2v2 game
     */
    IDS: {
        TEAM_A_PLAYER_1: "teamAPlayer1",
        TEAM_A_PLAYER_2: "teamAPlayer2",
        TEAM_B_PLAYER_1: "teamBPlayer1",
        TEAM_B_PLAYER_2: "teamBPlayer2",
        BALL: "ball"
    },
    
    /**
     * Register a sprite with the given ID
     * @param {string} id - Unique identifier for the sprite
     * @param {object} sprite - Sprite object to register
     */
    register: function(id, sprite) {
        if (!id) {
            throw new Error("Sprite ID is required");
        }
        this.sprites[id] = sprite;
    },
    
    /**
     * Get a sprite by ID
     * @param {string} id - Sprite identifier
     * @returns {object|null} Sprite object or null if not found
     */
    get: function(id) {
        return this.sprites[id] || null;
    },
    
    /**
     * Check if a sprite exists
     * @param {string} id - Sprite identifier
     * @returns {boolean} True if sprite is registered
     */
    has: function(id) {
        return !!this.sprites[id];
    },
    
    /**
     * Get all sprites for a team
     * @param {string} teamName - "teamA" or "teamB"
     * @returns {array} Array of sprite objects for the team
     */
    getByTeam: function(teamName) {
        var result = [];
        for (var id in this.sprites) {
            var sprite = this.sprites[id];
            if (sprite && sprite.playerData && sprite.playerData.team === teamName) {
                result.push(sprite);
            }
        }
        return result;
    },
    
    /**
     * Get all player sprites (excludes ball)
     * @returns {array} Array of all player sprite objects
     */
    getAllPlayers: function() {
        var result = [];
        for (var id in this.sprites) {
            var sprite = this.sprites[id];
            if (sprite && sprite.playerData) {
                result.push(sprite);
            }
        }
        return result;
    },
    
    /**
     * Get all sprites (including ball)
     * @returns {array} Array of all sprite objects
     */
    getAll: function() {
        var result = [];
        for (var id in this.sprites) {
            result.push(this.sprites[id]);
        }
        return result;
    },
    
    /**
     * Get team A players (convenience method)
     * @returns {array} Array of team A player sprites
     */
    getTeamA: function() {
        return this.getByTeam("teamA");
    },
    
    /**
     * Get team B players (convenience method)
     * @returns {array} Array of team B player sprites
     */
    getTeamB: function() {
        return this.getByTeam("teamB");
    },
    
    /**
     * Get standard player sprites in fixed order [teamB1, teamB2, teamA1, teamA2]
     * For compatibility with code expecting specific array order
     * @returns {array} Array of 4 player sprites in standard order
     */
    getStandardPlayers: function() {
        return [
            this.get(this.IDS.TEAM_B_PLAYER_1),
            this.get(this.IDS.TEAM_B_PLAYER_2),
            this.get(this.IDS.TEAM_A_PLAYER_1),
            this.get(this.IDS.TEAM_A_PLAYER_2)
        ].filter(function(s) { return s !== null; });
    },
    
    /**
     * Unregister a sprite
     * @param {string} id - Sprite identifier to remove
     */
    unregister: function(id) {
        delete this.sprites[id];
    },
    
    /**
     * Clear all sprites from registry
     * Used for cleanup/reset
     */
    clear: function() {
        this.sprites = {};
    },
    
    /**
     * Get count of registered sprites
     * @returns {number} Number of sprites in registry
     */
    count: function() {
        var count = 0;
        for (var id in this.sprites) {
            count++;
        }
        return count;
    }
};

/**
 * Compatibility aliases for backward compatibility
 * These allow gradual migration from globals to registry
 */

/**
 * Get teamAPlayer1 sprite (compatibility)
 */
function getTeamAPlayer1() {
    return spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_1);
}

/**
 * Get teamAPlayer2 sprite (compatibility)
 */
function getTeamAPlayer2() {
    return spriteRegistry.get(spriteRegistry.IDS.TEAM_A_PLAYER_2);
}

/**
 * Get teamBPlayer1 sprite (compatibility)
 */
function getTeamBPlayer1() {
    return spriteRegistry.get(spriteRegistry.IDS.TEAM_B_PLAYER_1);
}

/**
 * Get teamBPlayer2 sprite (compatibility)
 */
function getTeamBPlayer2() {
    return spriteRegistry.get(spriteRegistry.IDS.TEAM_B_PLAYER_2);
}
