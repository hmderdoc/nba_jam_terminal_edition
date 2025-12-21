/**
 * lorb_match.js - LORB Live Match Launcher
 * 
 * Converts LORB characters and their teammates into player definitions
 * compatible with initSpritesFromDynamic, then launches a multiplayer match.
 * 
 * Flow:
 * 1. Both players ready in challenge lobby
 * 2. buildLorbTeamDef() converts each player's character + teammate to team def
 * 3. launchLorbMultiplayerMatch() creates session and runs multiplayer game
 */
(function () {
    if (!this.LORB) return;
    if (!this.LORB.Multiplayer) this.LORB.Multiplayer = {};
    
    // Default attributes if LORB stats are missing
    var DEFAULT_STATS = {
        speed: 6,
        threePt: 5,
        dunk: 5,
        power: 5,
        steal: 5,
        block: 5
    };
    
    // Foreground color name to attribute mapping
    // YELLOW is HIGH | BROWN (14), not 6
    var FG_COLOR_MAP = {
        "BLACK": 0,
        "BLUE": 1,
        "GREEN": 2,
        "CYAN": 3,
        "RED": 4,
        "MAGENTA": 5,
        "BROWN": 6,
        "YELLOW": 14,       // HIGH | BROWN
        "WHITE": 7,
        "LIGHTGRAY": 7,
        "DARKGRAY": 8,
        "LIGHTBLUE": 9,
        "LIGHTGREEN": 10,
        "LIGHTCYAN": 11,
        "LIGHTRED": 12,
        "LIGHTMAGENTA": 13,
        "LIGHTYELLOW": 14,
        "LIGHTWHITE": 15
    };
    
    // Background color name to attribute mapping  
    var BG_COLOR_MAP = {
        "BLACK": 0,
        "BG_BLACK": 0,
        "BLUE": 16,
        "BG_BLUE": 16,
        "GREEN": 32,
        "BG_GREEN": 32,
        "CYAN": 48,
        "BG_CYAN": 48,
        "RED": 64,
        "BG_RED": 64,
        "MAGENTA": 80,
        "BG_MAGENTA": 80,
        "BROWN": 96,
        "BG_BROWN": 96,
        "YELLOW": 96,
        "BG_YELLOW": 96,
        "WHITE": 112,
        "BG_WHITE": 112,
        "LIGHTGRAY": 112,
        "BG_LIGHTGRAY": 112
    };
    
    /**
     * Convert foreground color name to attribute value
     */
    function fgColorToAttr(name) {
        if (!name) return null;
        var upper = String(name).toUpperCase();
        return FG_COLOR_MAP[upper] !== undefined ? FG_COLOR_MAP[upper] : null;
    }
    
    /**
     * Convert background color name to attribute value
     */
    function bgColorToAttr(name) {
        if (!name) return null;
        var upper = String(name).toUpperCase();
        return BG_COLOR_MAP[upper] !== undefined ? BG_COLOR_MAP[upper] : null;
    }
    
    function log(msg) {
        if (typeof debugLog === "function") debugLog("[LORB:Match] " + msg);
    }
    
    /**
     * Clamp attribute to valid range (1-10)
     */
    function clampAttr(val, def) {
        if (typeof val !== "number") return def || 6;
        if (val < 1) return 1;
        if (val > 10) return 10;
        return Math.round(val);
    }
    
    /**
     * Convert LORB stats object to attributes array
     * Array order: [speed, 3pt, dunk, power, steal, block]
     */
    function statsToAttributes(stats) {
        var s = stats || {};
        return [
            clampAttr(s.speed, DEFAULT_STATS.speed),
            clampAttr(s.threePt, DEFAULT_STATS.threePt),
            clampAttr(s.dunk, DEFAULT_STATS.dunk),
            clampAttr(s.power, DEFAULT_STATS.power),
            clampAttr(s.steal, DEFAULT_STATS.steal),
            clampAttr(s.block, DEFAULT_STATS.block)
        ];
    }
    
    /**
     * Convert LORB character context to player definition for sprites
     * @param {Object} ctx - LORB player context
     * @returns {Object} Player definition for initSpritesFromDynamic
     */
    function lorbCharacterToPlayerDef(ctx) {
        if (!ctx) return null;
        
        var appearance = ctx.appearance || {};
        var stats = ctx.stats || {};
        var gid = null;
        if (ctx._globalId) {
            gid = ctx._globalId;
        } else if (ctx.globalId) {
            gid = ctx.globalId;  // challenge.from/to uses globalId not _globalId
        } else if (ctx._user && LORB.Persist && LORB.Persist.getGlobalPlayerId) {
            gid = LORB.Persist.getGlobalPlayerId(ctx._user);
        }
        
        // shortNick: prefer explicit shortNick, then nickname, then derive from name
        var shortNick = ctx.shortNick || ctx.nickname || null;
        if (!shortNick && ctx.name) {
            shortNick = ctx.name.substring(0, 5).toUpperCase();
        }
        
        
        var playerDef = {
            name: ctx.name || ctx.nickname || "Player",
            jersey: parseInt(appearance.jerseyNumber, 10) || Math.floor(Math.random() * 99),
            jerseyString: appearance.jerseyNumber || null,
            skin: appearance.skin || "brown",
            shortNick: shortNick,
            attributes: statsToAttributes(stats),
            position: ctx.position || "",
            eyeColor: appearance.eyeColor || null,
            isHuman: true,  // LORB players are human-controlled
            lorbId: gid,
            lorbData: {
                name: ctx.name,
                level: ctx.level || 1,
                archetype: ctx.archetype || null,
                special: ctx.special || null,
                rep: ctx.rep || 0,
                // Nametag colors as numeric attributes for game engine
                nametagFg: fgColorToAttr(appearance.nametagFg),
                nametagBg: bgColorToAttr(appearance.nametagBg),
                nametagHiFg: fgColorToAttr(appearance.nametagHiFg),
                nametagHiBg: bgColorToAttr(appearance.nametagHiBg)
            }
        };
        
        return playerDef;
    }
    
    /**
     * Convert LORB teammate (from contacts) to player definition
     * @param {Object} teammate - Contact entry from ctx.contacts
     * @returns {Object} Player definition for initSpritesFromDynamic
     */
    function lorbTeammateToPlayerDef(teammate) {
        if (!teammate) return null;
        
        var stats = teammate.stats || {};
        
        // shortNick: prefer explicit, then derive from name
        var shortNick = teammate.shortNick || null;
        if (!shortNick && teammate.name) {
            shortNick = teammate.name.substring(0, 5).toUpperCase();
        }
        
        
        return {
            name: teammate.name || "Teammate",
            jersey: teammate.jersey || Math.floor(Math.random() * 99),
            jerseyString: teammate.jersey ? String(teammate.jersey) : null,
            skin: teammate.skin || "brown",
            shortNick: shortNick,
            attributes: statsToAttributes(stats),
            position: teammate.position || "",
            eyeColor: null,
            isHuman: false,  // Teammates are AI-controlled
            lorbId: teammate.id || null,
            lorbData: {
                name: teammate.name,
                type: teammate.type || "contact",
                tier: teammate.tier || "rookie"
            }
        };
    }
    
    /**
     * Find active teammate from player context
     * Supports both full context (with contacts array) and slim context (from challenge/presence)
     * @param {Object} ctx - LORB player context
     * @returns {Object|null} Teammate contact or null
     */
    function findActiveTeammate(ctx) {
        if (!ctx) return null;
        
        // Check for pre-extracted teammate (from challenge/presence data)
        // This is an object with name, skin, stats, etc. already flattened
        if (ctx.activeTeammate && typeof ctx.activeTeammate === "object") {
            return ctx.activeTeammate;
        }
        
        // Full context path: search contacts by activeTeammate ID
        if (!ctx.contacts || !ctx.activeTeammate) {
            return null;
        }
        
        // Use hydrated contact lookup
        if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getContact) {
            var contact = LORB.Util.Contacts.getContact(ctx, ctx.activeTeammate);
            if (contact && contact.status === "signed") {
                return contact;
            }
        }
        
        // Fallback: return first signed contact from hydrated list
        if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getAllContacts) {
            var allContacts = LORB.Util.Contacts.getAllContacts(ctx);
            for (var i = 0; i < allContacts.length; i++) {
                var c = allContacts[i];
                if (c && c.status === "signed") {
                    return c;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Build team definition from LORB player context
     * Creates a 2-player team: the player + their active teammate
     * @param {Object} ctx - LORB player context
     * @param {string} teamName - Display name for the team
     * @param {Object} colors - Optional team colors { bg, fg, fg_accent, bg_alt }
     * @returns {Object} Team definition for initSpritesFromDynamic
     */
    function buildLorbTeamDef(ctx, teamName, colors) {
        
        var playerDef = lorbCharacterToPlayerDef(ctx);
        var teammate = findActiveTeammate(ctx);
        var teammateDef = teammate ? lorbTeammateToPlayerDef(teammate) : null;
        
        
        // If no teammate, create a CPU partner
        if (!teammateDef) {
            teammateDef = {
                name: "Street Partner",
                jersey: 0,
                jerseyString: "0",
                skin: "brown",
                shortNick: "CPU",
                attributes: [6, 5, 5, 5, 5, 5],
                position: "SF",
                isHuman: false,
                lorbId: null,
                lorbData: null
            };
        }
        
        var players = playerDef ? [playerDef, teammateDef] : [teammateDef];
        
        // Ensure we have exactly 2 players
        while (players.length < 2) {
            players.push({
                name: "Partner",
                jersey: players.length,
                skin: "brown",
                shortNick: "CPU",
                attributes: [6, 5, 5, 5, 5, 5],
                position: "SF",
                isHuman: false
            });
        }
        
        return {
            name: teamName || (ctx && ctx.name ? ctx.name + "'s Crew" : "Street Crew"),
            abbr: teamName ? teamName.substring(0, 4).toUpperCase() : "CREW",
            players: players,
            colors: colors || null
        };
    }
    
    /**
     * Extract team colors from player appearance
     * Uses jerseyColor for background and jerseyLettering for foreground
     * Falls back to default red/blue if not specified
     * Returns color NAMES for compatibility with resolveTeamColors
     */
    function extractTeamColors(ctx, fallbackColorName) {
        var appearance = ctx && ctx.appearance ? ctx.appearance : {};
        
        // Default color names
        var fallback = fallbackColorName || "RED";
        var bgColorName = fallback;  // e.g., "RED", "BLUE"
        var fgColorName = "WHITE";
        
        // Try to get jersey color (background)
        if (appearance.jerseyColor) {
            bgColorName = appearance.jerseyColor.toUpperCase();
        }
        
        // Try to get jersey lettering (foreground/accent)
        if (appearance.jerseyLettering) {
            fgColorName = appearance.jerseyLettering.toUpperCase();
        }
        
        
        return {
            bg: "BG_" + bgColorName,
            fg: fgColorName,
            fg_accent: fgColorName,
            bg_alt: "BG_" + bgColorName
        };
    }
    
    /**
     * Build complete game config for LORB multiplayer match
     * @param {Object} challengerCtx - Challenger's LORB context
     * @param {Object} challengeeCtx - Challengee's LORB context
     * @param {Object} challenge - Challenge record with metadata
     * @returns {Object} Config for multiplayer game initialization
     */
    function buildLorbGameConfig(challengerCtx, challengeeCtx, challenge) {
        // Detailed logging for sprite debugging
        
        
        // Extract colors from each player's appearance (fallback to red/blue)
        var challengerColors = extractTeamColors(challengerCtx, "RED");
        var challengeeColors = extractTeamColors(challengeeCtx, "BLUE");
        
        // Challenger is Team A, Challengee is Team B
        var teamADef = buildLorbTeamDef(challengerCtx, 
            challengerCtx.name + "'s Crew",
            challengerColors
        );
        
        var teamBDef = buildLorbTeamDef(challengeeCtx,
            challengeeCtx.name + "'s Crew", 
            challengeeColors
        );
        
        
        // Get game time from challenge meta, default to 120 seconds (2 minutes)
        var gameTime = (challenge && challenge.meta && typeof challenge.meta.gameTime === "number") 
            ? challenge.meta.gameTime 
            : 120;
        
        // Get hydrated crews for substitution system
        var challengerHydratedCrew = [];
        var challengeeHydratedCrew = [];
        if (LORB.Util && LORB.Util.Contacts && LORB.Util.Contacts.getCrewWithContacts) {
            if (challengerCtx) {
                challengerHydratedCrew = LORB.Util.Contacts.getCrewWithContacts(challengerCtx);
            }
            if (challengeeCtx) {
                challengeeHydratedCrew = LORB.Util.Contacts.getCrewWithContacts(challengeeCtx);
            }
        }
        
        return {
            sessionId: challenge.id,
            teamA: teamADef,
            teamB: teamBDef,
            options: {
                gameTime: gameTime,
                shotClock: 24,
                mode: "play"
            },
            challenge: challenge,
            lorbContext: {
                challengeId: challenge.id,
                challengerGid: challenge.from && challenge.from.globalId,
                challengeeGid: challenge.to && challenge.to.globalId,
                timestamp: Date.now(),
                // Crew data for substitution system - each team's crew
                challengerCrew: challengerHydratedCrew,
                challengeeCrew: challengeeHydratedCrew,
                challengerCtx: challengerCtx,
                challengeeCtx: challengeeCtx
            }
        };
    }
    
    /**
     * Create multiplayer session structure from LORB game config
     * This mimics the session structure from mp_sessions.js
     */
    function createLorbSession(config, myGid, isChallenger) {
        var session = {
            id: config.sessionId,
            status: "playing",
            host: config.challenge.from.globalId,
            coordinator: config.challenge.from.globalId,  // Challenger coordinates
            playerList: [
                config.challenge.from.globalId,
                config.challenge.to.globalId
            ],
            teams: {
                teamA: {
                    name: config.teamA.name,
                    players: [config.challenge.from.globalId],
                    roster: {}
                },
                teamB: {
                    name: config.teamB.name,
                    players: [config.challenge.to.globalId],
                    roster: {}
                }
            },
            config: {
                maxPlayers: 2,
                minPlayers: 2,
                gameMode: "lorb_challenge"
            },
            lastActivity: Date.now()
        };
        
        // Set roster indices (each LORB player controls player 0 on their team)
        session.teams.teamA.roster[config.challenge.from.globalId] = { index: 0 };
        session.teams.teamB.roster[config.challenge.to.globalId] = { index: 0 };
        
        return session;
    }
    
    /**
     * Determine player assignments for multiplayer sprites
     * Maps globalId -> sprite slot
     */
    function buildLorbPlayerAssignments(config, myGid) {
        var challengerGid = config.challenge.from.globalId;
        var challengeeGid = config.challenge.to.globalId;
        
        return {
            teamAPlayer1: challengerGid,  // Challenger controls team A player 1
            teamAPlayer2: null,           // AI teammate
            teamBPlayer1: challengeeGid,  // Challengee controls team B player 1
            teamBPlayer2: null            // AI teammate
        };
    }
    
    // Export
    LORB.Multiplayer.LorbMatch = {
        lorbCharacterToPlayerDef: lorbCharacterToPlayerDef,
        lorbTeammateToPlayerDef: lorbTeammateToPlayerDef,
        findActiveTeammate: findActiveTeammate,
        buildLorbTeamDef: buildLorbTeamDef,
        buildLorbGameConfig: buildLorbGameConfig,
        createLorbSession: createLorbSession,
        buildLorbPlayerAssignments: buildLorbPlayerAssignments
    };
    
    
})();
