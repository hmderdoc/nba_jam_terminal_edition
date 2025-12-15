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

        // Debug/development toggles
        DEBUG_ENABLE_BOSS_TEST: false,   // Show [Boss Challenge TEST] in crib menu

        // Enable live challenge polling/invites (JSON-DB network service).
        // Disabled for now to avoid BBS stalls while challenge persistence is fixed.
            // Enable live challenge polling/invites (JSON-DB network service).
            ENABLE_LIVE_CHALLENGES: true,
            
            // Use pub/sub subscriptions for real-time updates.
            // DANGER: Subscriptions cause json-db server to block on sendJSON() when
            // clients don't read fast enough. This can block the ENTIRE BBS.
            // Set to false to use polling instead (safer but less real-time).
            USE_SUBSCRIPTIONS: false,

            // JSONClient override: use nba_jam scope (lorb scope has issues)
            JSON_CLIENT: {
                addr: "localhost",
                port: 10088,
                scope: "nba_jam",
                timeoutMs: 5000,   // 5 second timeout - keep short to avoid blocking
                backoffMs: 10000
            },
        
        // ========== CHALLENGE SYSTEM CONFIGURATION ==========
        // Timing constants for PvP challenge coordination
        CHALLENGES: {
            TTL_MS: 5 * 60 * 1000,           // Challenge expires after 5 minutes
            READY_STALE_MS: 90 * 1000,       // Ready state stale after 90 seconds
            CYCLE_INTERVAL_MS: 250,          // How often to check for updates
            INITIAL_FETCH_TIMEOUT_MS: 2000,  // Timeout for initial data fetch
            WRITE_TIMEOUT_MS: 500,           // Timeout for challenge writes
            UPDATE_READ_TIMEOUT_MS: 1000,    // Timeout for update reads
            MAX_PACKETS_PER_CYCLE: 10,       // Max packets to process per cycle
            ROOT_PATH: "rimcity.challenges",
            PRESENCE_PATH: "rimcity.presence"
        },
        
        // ========== PRESENCE CONFIGURATION ==========
        // Player online status tracking
        PRESENCE: {
            TIMEOUT_MS: 60000,               // Consider offline after 60 seconds
            PING_INTERVAL_MS: 30000          // How often to ping presence
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
            
            // Eligibility requirements - player must meet at least one to qualify
            // Set to 0 to disable a requirement
            ELIGIBILITY: {
                MIN_GAMES_PLAYED: 1,  // Must have played at least this many games (wins + losses)
                MIN_REP: 0            // Alternative: must have at least this much rep (0 = disabled)
            },
            
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
                SCHEDULED: "scheduled",   // Has a scheduled time
                IN_PROGRESS: "in_progress",
                COMPLETED: "completed",
                BYE: "bye"
            },
            
            // ========== SCHEDULING (per Playoff_Scheduling_Spec.md) ==========
            SCHEDULING: {
                // PvP window: prioritize live matches during first N hours
                PVP_WINDOW_HOURS: 72,
                
                // Hard deadline: matches must be auto-resolved after N hours
                HARD_DEADLINE_HOURS: 168,
                
                // Availability block size in minutes (30-minute windows for finer granularity)
                BLOCK_MINUTES: 30,
                
                // Grace period: wait N minutes for both players after scheduled start
                GRACE_MINUTES: 20,
                
                // Max defer tokens per player per match
                MAX_DEFERS_PER_PLAYER: 1,
                
                // Minimum buffer before scheduling (don't schedule for next 15 min)
                MIN_SCHEDULE_BUFFER_MINUTES: 15,
                
                // Availability presets - pulled from game-mode-constants.js
                // Reference: GAME_MODE_CONSTANTS.LORB_PLAYOFFS.SCHEDULING.AVAILABILITY_PRESETS
                get PRESETS() {
                    if (typeof GAME_MODE_CONSTANTS !== "undefined" && 
                        GAME_MODE_CONSTANTS.LORB_PLAYOFFS && 
                        GAME_MODE_CONSTANTS.LORB_PLAYOFFS.SCHEDULING) {
                        return GAME_MODE_CONSTANTS.LORB_PLAYOFFS.SCHEDULING.AVAILABILITY_PRESETS;
                    }
                    // Fallback flexible preset
                    return {
                        flexible: [
                            { dayOfWeek: 1, startMinuteUTC: 0 }, { dayOfWeek: 1, startMinuteUTC: 120 },
                            { dayOfWeek: 2, startMinuteUTC: 0 }, { dayOfWeek: 2, startMinuteUTC: 120 },
                            { dayOfWeek: 3, startMinuteUTC: 0 }, { dayOfWeek: 3, startMinuteUTC: 120 },
                            { dayOfWeek: 4, startMinuteUTC: 0 }, { dayOfWeek: 4, startMinuteUTC: 120 },
                            { dayOfWeek: 5, startMinuteUTC: 0 }, { dayOfWeek: 5, startMinuteUTC: 120 }
                        ]
                    };
                }
            },
            
            // Default availability (used if player hasn't set preferences)
            // Array of { dayOfWeek: 0-6, startMinuteUTC: 0-1439 }
            // Default: weeknights + weekend evenings (common overlap times)
            DEFAULT_AVAILABILITY: [
                // Mon-Fri evenings UTC (evening in Americas)
                { dayOfWeek: 1, startMinuteUTC: 0 },   { dayOfWeek: 1, startMinuteUTC: 120 },
                { dayOfWeek: 2, startMinuteUTC: 0 },   { dayOfWeek: 2, startMinuteUTC: 120 },
                { dayOfWeek: 3, startMinuteUTC: 0 },   { dayOfWeek: 3, startMinuteUTC: 120 },
                { dayOfWeek: 4, startMinuteUTC: 0 },   { dayOfWeek: 4, startMinuteUTC: 120 },
                { dayOfWeek: 5, startMinuteUTC: 0 },   { dayOfWeek: 5, startMinuteUTC: 120 },
                // Weekend
                { dayOfWeek: 6, startMinuteUTC: 960 }, { dayOfWeek: 6, startMinuteUTC: 1080 },
                { dayOfWeek: 0, startMinuteUTC: 960 }, { dayOfWeek: 0, startMinuteUTC: 1080 }
            ]
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
            // Jordan uses special 'jordan' difficulty preset
            DIFFICULTY_OVERRIDE: "jordan",
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
            // Red Bull uses special 'red_bull' difficulty preset - ultimate challenge
            DIFFICULTY_OVERRIDE: "red_bull",
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
                // Buffs: Devastating on both ends - offensive AND defensive threat
                buffs: {
                    // Offensive: Cold-blooded scorer
                    shotMultiplier: 1.20,    // +20% shot success (clutch ice in his veins)
                    threePointBonus: 0.15,   // +15% from 3pt (ice cold from deep)
                    // Defensive: Steal/block master with crushing shoves
                    shoveBonus: 0.40,        // +40% shove success
                    stealBonus: 0.25,        // +25% steal chance (frozen fingers)
                    blockBonus: 0.30         // +30% block chance (ice wall)
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
        },
        
        // ========== COURT TIERS ==========
        // Maps difficulty level to display name (used by baby ballers system)
        COURT_TIERS: {
            1: { id: "middle_school", name: "Middle School", tagline: "Where Legends Begin" },
            2: { id: "high_school", name: "High School", tagline: "Varsity Dreams" },
            3: { id: "aau", name: "AAU Circuit", tagline: "Elite Prospects" },
            4: { id: "college", name: "College", tagline: "March Madness" },
            5: { id: "nba", name: "The League", tagline: "The Red Bull Waits" }
        },
        
        // ========== BABY BALLERS SYSTEM ==========
        // Pregnancy, children, child support economy
        BABY_BALLERS: {
            // === Pregnancy Configuration ===
            // 3-phase city visit cycle: (1) Hidden conception, (2) Doctor discovery, (3) Birth
            
            // Pregnancy chances by relationship status (for regular flirts)
            PREGNANCY_CHANCE_FLIRT: 0.15,           // 15% per "crib visit" outcome
            PREGNANCY_CHANCE_PARTNER: 0.25,         // Higher if already partner+
            
            // Intimate encounter system (traveling companions)
            PREGNANCY_CHANCE_INTIMATE: 0.35,        // Base 35% per intimate encounter
            PREGNANCY_REVEAL_DELAY: 3,              // Days after conception before reveal is possible
            
            // Twins/Triplets (traveling companions ONLY)
            TWINS_CHANCE: 0.08,                     // 8% chance of twins
            TRIPLETS_CHANCE: 0.01,                  // 1% chance of triplets
            
            // === Baby Stat Generation ===
            BASE_STAT_MIN: 1,                       // Minimum base stat roll
            BASE_STAT_MAX: 4,                       // Maximum base stat roll
            INHERITED_STAT_WEIGHT: 0.30,            // 30% of parent stats inherited
            MONOGAMY_STAT_BONUS: 2,                 // +2 to all base stats if monogamous
            
            // === Child Support Economy ===
            SUPPORT_BASE_AMOUNT: 2000,              // Base child support cost
            SUPPORT_PER_STAT_POINT: 100,            // Higher stat kids cost more
            SUPPORT_LUMP_SUM_DISCOUNT: 0.25,        // 25% discount for lump sum payment
            STREETBALL_WINNINGS_TO_SUPPORT: 0.50,   // 50% of baby's wins → support while owed
            STREETBALL_WINNINGS_KEPT: 0.50,         // 50% "spent by baby"
            
            // === Child Support Deadline System ===
            SUPPORT_DEADLINE_DAYS: 10,              // Days after birth to pay off child support
            SUPPORT_WARNING_DAYS: 3,                // Warning message starts X days before deadline
            OVERDUE_RELATIONSHIP_PENALTY: -50,      // Relationship hit when going overdue
            OVERDUE_ALIGNMENT_PENALTY: -30,         // Alignment hit when going overdue
            DAILY_OVERDUE_RELATIONSHIP_DECAY: -5,   // Additional daily relationship decay while overdue
            DAILY_OVERDUE_ALIGNMENT_DECAY: -2,      // Additional daily alignment decay while overdue
            
            // === Nemesis System ===
            NEMESIS_STAT_MULTIPLIER: 1.75,          // 75% stat boost when nemesis faces parent
            NEMESIS_RAGE_BONUS: 20,                 // Flat stat bonus across all stats vs parent
            
            // === Paid-Off Benefits ===
            TEAMMATE_XP_SPLIT: 0.50,                // 50/50 XP when using as teammate
            GYM_UPGRADE_COST_MULTIPLIER: 1.5,       // 1.5x gym cost to train baby
            
            // === Alignment System ===
            ALIGNMENT_NURTURE: 10,                  // Per positive parenting action
            ALIGNMENT_NEGLECT: -5,                  // Per missed payment/neglect
            ALIGNMENT_ABANDON: -25,                 // Full abandonment
            ALIGNMENT_LUMP_SUM: 15,                 // Big bonus for paying it all off
            
            // === Nemesis System ===
            NEMESIS_THRESHOLD: -50,                 // Relationship below this = nemesis
            ADOPTION_THRESHOLD: -75,                // Below this, NPC can "adopt" your kid
            
            // === Random Encounters ===
            MAX_RANDOM_EVENTS_PER_DAY: 1,           // Cap on daily events
            BABY_MAMA_EVENT_CHANCE: 0.20,           // 20% per baby mama per city visit
            CHILD_CHALLENGE_CHANCE: 0.15,           // 15% chance to encounter own child
            SPOUSE_RETALIATION_CHANCE: 0.20,        // 20% chance for angry spouse event when cheating
            
            // === Parenting Mode Cuts (when child support PAID OFF) ===
            NURTURE_EARNINGS_CUT: 0.10,             // 10% of child's winnings to you
            NEGLECT_EARNINGS_CUT: 0.00,             // No cut for neglect mode
            NEMESIS_EARNINGS_PENALTY: 0.05,         // Nemesis takes 5% FROM you
            
            // === Progression ===
            // XP thresholds for baby baller levels 1-10
            CHILD_LEVEL_XP: [0, 100, 250, 500, 1000, 2000, 4000, 7500, 12500, 20000],
            
            // Rep thresholds for court tier promotion
            // { repThreshold: courtTier }
            COURT_TIER_BY_REP: { 0: 1, 100: 2, 300: 3, 600: 4, 1000: 5 },
            
            // === Court Tier Names (consistent with COURT_TIERS) ===
            COURT_TIER_NAMES: {
                1: "Middle School",
                2: "High School",
                3: "AAU",
                4: "College",
                5: "NBA"
            }
        },
        
        // ========== TRAVELING COMPANION SYSTEM ==========
        TRAVELING_COMPANION: {
            FLIGHT_BASE_COST: 500,                  // Cost to fly someone to your city
            DINNER_COST: 100,                       // Cost per dinner date
            CLUB_DATE_COST: 200,                    // Cost per club date
            AFFECTION_PER_DINNER: 5,                // Affection gained per dinner
            AFFECTION_PER_CLUB: 8,                  // Affection gained per club date
            MIN_RELATIONSHIP_TO_INVITE: 1           // Anyone with non-zero affection
        }
    };
})();
