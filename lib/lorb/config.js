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
                timeoutMs: 5000,   // 5 second timeout - keep short to avoid blocking
                backoffMs: 10000
            },
        
        // ========== SEASON & PLAYOFF CONFIGURATION ==========
        
        // Season length in game days (triggers playoffs when reached)
        SEASON_LENGTH_DAYS: 30,
        
        // Number of players in playoff bracket (must be power of 2: 4, 8, 16)
        PLAYOFF_BRACKET_SIZE: 8,
        
        // Parallel playoffs configuration
        PLAYOFF: {
            // Deadline configuration (hours)
            ROUND_SOFT_DEADLINE_HOURS: 72,   // After this, unresolved matches eligible for CPU sim
            ROUND_HARD_DEADLINE_HOURS: 168,  // After this, matches MUST be auto-resolved (7 days)
            
            // Minimum qualifiers needed to run playoffs (1 = auto-champion, 0 = no playoffs)
            MIN_PLAYERS_FOR_PLAYOFFS: 2,
            
            // Bracket sizing limits
            MAX_BRACKET_SIZE: 16,
            SUPPORTED_BRACKET_SIZES: [2, 4, 8, 16],
            
            // Tie-breaking for standings (order of priority)
            TIEBREAKER_PRIORITY: ["wins", "rep", "random"],
            
            // Match resolution modes
            RESOLUTION: {
                PVP: "pvp",           // Both players online, real-time match
                GHOST: "ghost",       // One player vs AI snapshot
                CPU_SIM: "cpu_sim"    // Fully automated
            },
            
            // Status values for seasons
            SEASON_STATUS: {
                ACTIVE: "active",
                COMPLETED_REGULAR: "completed_regular",
                PLAYOFFS_ACTIVE: "playoffs_active",
                ARCHIVED: "archived"
            },
            
            // Status values for brackets
            BRACKET_STATUS: {
                ACTIVE: "active",
                COMPLETED: "completed"
            },
            
            // Status values for matches
            MATCH_STATUS: {
                PENDING: "pending",
                IN_PROGRESS: "in_progress",
                COMPLETED: "completed",
                BYE: "bye"
            }
        },
        
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
        // Jordan serves as a "prep match" before the true final boss
        JORDAN_BOSS: {
            NAME: "Michael Jordan",
            TITLE: "His Airness",
            TEAMMATE_NAME: "Scottie Pippen",
            TEAMMATE_TITLE: "No Tippin'",
            // Jordan uses standard NBA Jam stats but with difficulty modifier
            DIFFICULTY_OVERRIDE: 1.8,
            // Win probability modifier (makes Jordan harder to beat)
            WIN_PROBABILITY_PENALTY: 0.15,  // -15% win chance for challenger
            // Description for lore
            LORE_INTRO: "His Airness awaits. Six rings. Ten scoring titles. Legend incarnate.",
            LORE_WIN: "The dynasty crumbles. But darker forces await...",
            LORE_LOSS: "Jordan dunks on your dreams. Try again next season.",
            // Player configs for real game
            JORDAN: {
                name: "Michael Jordan",
                shortNick: "M.J.",
                jerseyNumber: "23",
                skin: "brown",
                position: "guard",
                speed: 9, threePt: 8, dunks: 10, power: 7, defense: 8, blocks: 7
            },
            PIPPEN: {
                name: "Scottie Pippen",
                shortNick: "PIP",
                jerseyNumber: "33",
                skin: "brown",
                position: "forward",
                speed: 8, threePt: 7, dunks: 9, power: 7, defense: 9, blocks: 8
            },
            TEAM_COLORS: { fg: "WHITE", bg: "BG_RED", fg_accent: "WHITE", bg_alt: "BG_RED" }
        },
        
        // ========== TRUE FINAL BOSS: THE RED BULL ==========
        // Satan (the GOAT 🐐) and Iceman - the TRUE Red Bull challenge
        RED_BULL_BOSS: {
            NAME: "Satan",
            TITLE: "The GOAT",
            TEAMMATE_NAME: "Iceman",
            TEAMMATE_TITLE: "Cold as Hell",
            // Red Bull is the ultimate challenge - higher than Jordan
            DIFFICULTY_OVERRIDE: 2.5,
            // Win probability penalty (brutal)
            WIN_PROBABILITY_PENALTY: 0.30,  // -30% win chance for challenger
            // Lore
            LORE_INTRO: "The court grows cold. Flames lick the baseline. The GOAT awaits... and he brought Iceman.",
            LORE_WIN: "Hell freezes over. The GOAT has been slain. You are the true champion of Rim City.",
            LORE_LOSS: "Satan laughs as Iceman shatters your hopes. The GOAT remains supreme.",
            // Player configs for real game engine
            SATAN: {
                name: "Satan",
                shortNick: "GOAT",
                jerseyNumber: "666",
                skin: "satan",           // Uses player-satan.bin sprite
                position: "forward",
                speed: 10, threePt: 10, dunks: 10, power: 10, defense: 10, blocks: 10,
                // Nametag colors (fiery)
                nametagFg: "LIGHTRED",
                nametagBg: "BLACK",
                nametagHiFg: "YELLOW",
                nametagHiBg: "RED",
                // Buffs: Always on fire, enhanced shooting
                buffs: {
                    permanentFire: true,
                    fireImmunity: true,
                    shotMultiplier: 1.15,
                    threePointBonus: 0.10
                }
            },
            ICEMAN: {
                name: "Iceman",
                shortNick: "ICE",
                jerseyNumber: "0",
                skin: "iceman",          // Uses player-iceman.bin sprite  
                position: "guard",
                speed: 10, threePt: 10, dunks: 10, power: 10, defense: 10, blocks: 10,
                // Nametag colors (icy)
                nametagFg: "LIGHTCYAN",
                nametagBg: "BLUE",
                nametagHiFg: "WHITE",
                nametagHiBg: "CYAN",
                // Buffs: Devastating shoves, steal/block master
                buffs: {
                    shoveBonus: 0.40,        // +40% shove success
                    stealBonus: 0.20,        // +20% steal chance
                    blockBonus: 0.25         // +25% block chance
                }
            },
            TEAM_COLORS: { fg: "RED", bg: "BG_BLACK", fg_accent: "LIGHTRED", bg_alt: "BG_BLACK" }
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
