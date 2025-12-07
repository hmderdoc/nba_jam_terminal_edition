// xtrn/lorb/config.js
(function () {
    var ROOT = js.exec_dir + "lib/lorb/";
    LORB.Config = {
        ROOT: ROOT,
        EVENTS_INI: file_cfgname(ROOT, "data/events.ini"),
        SAVE_DIR: ROOT + "saves/",
        DEFAULT_TURNS: 5,
        DEFAULT_USER_TEAM: "RIM CITY",
        DEFAULT_USER_PLAYERS: ["rc_blaze", "rc_tower"],
        
        // ========== TIME/DAY CONFIGURATION ==========
        // These control how the game tracks "days" and daily resource resets.
        
        // Duration of one in-game "day" in milliseconds.
        // Default: 3600000 (1 hour) for testing
        // Production: 86400000 (24 hours)
        DAY_DURATION_MS: 3600000,
        
        // Hour of day (0-23 UTC) when daily reset occurs.
        // Only used if DAY_DURATION_MS equals 86400000 (24 hours).
        // Default: 0 (midnight UTC)
        DAILY_RESET_HOUR_UTC: 0,
        
        // Maximum number of days that can be "banked" when player is offline.
        // If player misses 5 days but max is 3, they get 3 days worth of resources.
        // Set to 0 to disable banking (always just 1 fresh day).
        // Set to 1 for standard LoRD behavior (1 day, no banking).
        MAX_BANKED_DAYS: 1,
        
        // Daily resource allocations (per day)
        DAILY_STREET_TURNS: 5,
        DAILY_GYM_SESSIONS: 3,
        DAILY_BAR_ACTIONS: 3,
        
        // Maximum resource caps (even with banking, can't exceed these)
        MAX_STREET_TURNS: 15,
        MAX_GYM_SESSIONS: 9,
        MAX_BAR_ACTIONS: 9,

        // Enable live challenge polling/invites (JSON-DB network service).
        // Disabled for now to avoid BBS stalls while challenge persistence is fixed.
            // Enable live challenge polling/invites (JSON-DB network service).
            ENABLE_LIVE_CHALLENGES: true,

            // JSONClient override: use nba_jam scope (lorb scope has issues)
            JSON_CLIENT: {
                addr: "localhost",
                port: 10088,
                scope: "nba_jam",
                timeoutMs: 30000,
                backoffMs: 10000
            },
        
        // ========== SEASON & PLAYOFF CONFIGURATION ==========
        
        // Season length in game days (triggers playoffs when reached)
        SEASON_LENGTH_DAYS: 30,
        
        // Number of players in playoff bracket (must be power of 2: 4, 8, 16)
        PLAYOFF_BRACKET_SIZE: 8,
        
        // Simulated match duration in minutes (for display/pacing)
        SIM_MATCH_DURATION_MINUTES: 3,
        
        // REP Score calculation weights
        REP_SCORE: {
            REP_MULTIPLIER: 3,           // reputation * 3
            WIN_MULTIPLIER: 2,           // wins * 2
            BOSS_VICTORY_BONUS: 10,      // per boss defeated
            RARE_ENCOUNTER_BONUS: 5,     // per rare event
            WIN_STREAK_BONUS_PER: 2,     // per win in current streak
            MAX_STREAK_BONUS: 20,        // cap on streak bonus
            COMPANION_SYNERGY_BONUS: 5   // if companion synergy active
        },
        
        // Ghost player names for incomplete brackets
        GHOST_PLAYER_NAMES: [
            "Rim City Legend",
            "Ghost of the Blacktop",
            "The Neon Gator",
            "Phantom Baller",
            "Street Echo",
            "Shadow Hooper",
            "Court Specter",
            "The Fadeaway"
        ],
        
        // ========== AI DIFFICULTY SCALING ==========
        // Difficulty multiplier affects AI decision quality and reaction times
        // 1.0 = baseline, higher = smarter/faster AI
        
        AI_DIFFICULTY: {
            // Base difficulty for street courts (scales with court tier)
            BASE_DIFFICULTY: 1.0,
            
            // Difficulty increment per court tier (Court 1 = base, Court 5 = base + 4*increment)
            TIER_INCREMENT: 0.15,
            
            // Special difficulty levels
            PLAYOFF_DIFFICULTY: 1.5,     // Playoff matches are tougher
            JORDAN_DIFFICULTY: 2.0,      // Jordan is the ultimate challenge
            
            // How difficulty affects AI behavior
            MODIFIERS: {
                // Multiplied into shot decision quality (higher = better shot selection)
                SHOT_QUALITY_SCALE: 1.0,
                // Reaction time divisor (higher difficulty = faster reactions)
                REACTION_SPEED_SCALE: 1.0,
                // Pass accuracy bonus (higher = fewer turnovers)
                PASS_ACCURACY_SCALE: 1.0,
                // Defense positioning bonus
                DEFENSE_IQ_SCALE: 1.0
            }
        },
        
        // ========== JORDAN BOSS CONFIGURATION ==========
        JORDAN_BOSS: {
            NAME: "Michael Jordan",
            TITLE: "The Red Bull",
            // Jordan uses standard NBA Jam stats but with difficulty modifier
            DIFFICULTY_OVERRIDE: 2.0,
            // Win probability modifier (makes Jordan harder to beat)
            WIN_PROBABILITY_PENALTY: 0.20,  // -20% win chance for challenger
            // Description for lore
            LORE_INTRO: "The Red Bull awaits. Six rings. Ten scoring titles. Legend incarnate.",
            LORE_WIN: "The Red Bull has fallen. Time loops, and a new generation rises...",
            LORE_LOSS: "Jordan remains undefeated. The legend grows stronger."
        },
        
        // ========== META REWARDS (Persist Across Resets) ==========
        META_REWARDS: {
            // Per Jordan victory rewards
            JORDAN_VICTORY: {
                STAT_CAP_INCREASE: 1,        // +1 to one stat cap
                TRAINING_EFFICIENCY: 0.10,   // +10% gym gains
                STARTING_CASH_BONUS: 500,    // +$500 each new season
                UNLOCK_SPECIAL_COMPANION: true
            }
        },
        
        // ========== CLUB 23 BETTING CONFIGURATION ==========
        
        // Minimum and maximum bet amounts
        BETTING_MIN_WAGER: 50,
        BETTING_MAX_WAGER: 1000,
        
        // Number of NBA games to generate per day (max 15 with 30 teams)
        BETTING_GAMES_PER_DAY: 15,
        
        // Odds configuration (American style)
        BETTING_ODDS: {
            baseOdds: 110,           // Base odds for even matchup
            diffScaleFactor: 8,      // How much power diff affects odds
            minFavorite: -500,       // Most favorable odds for heavy favorite
            maxUnderdog: 500         // Most favorable odds for heavy underdog
        },
        
        // Spread configuration
        BETTING_SPREAD: {
            pointsPerPower: 1.5,     // Power difference to point spread conversion
            minSpread: 0.5,
            maxSpread: 15
        },
        
        // Over/Under configuration
        BETTING_TOTALS: {
            basePerTeam: 35,         // Base expected score per team
            powerScale: 3,           // How team power affects total
            minTotal: 70,
            maxTotal: 120
        },
        
        // ========== GRAFFITI WALL CONFIGURATION ==========
        
        // Maximum entries stored in the graffiti wall
        MAX_GRAFFITI_ENTRIES: 100,
        
        // Maximum lines per graffiti entry (1-3)
        MAX_GRAFFITI_LINES: 3,
        
        // Maximum characters per line
        GRAFFITI_LINE_LENGTH: 60,
        
        // ========== CITY ROTATION CONFIGURATION ==========
        
        // Path to cities.json data file
        CITIES_JSON_PATH: js.exec_dir + "lib/lorb/design_docs/season_concept/cities.json",
        
        // Directory containing city art files
        CITY_ART_DIR: "/sbbs/xtrn/nba_jam/assets/lorb/cities/",
        
        // Art file dimensions
        CITY_BANNER_WIDTH: 80,
        CITY_BANNER_HEIGHT: 4,
        CITY_DETAIL_WIDTH: 40,
        CITY_DETAIL_HEIGHT: 20,
        
        // ========== ROMANCE CONFIGURATION ==========
        ROMANCE: {
            MAX_FLIRTS_PER_DAY: 3,
            RARITY_WEIGHTS: {
                common: 5,
                uncommon: 3,
                rare: 1
            }
        }
    };
})();
