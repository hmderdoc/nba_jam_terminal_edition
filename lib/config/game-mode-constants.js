/**
 * Game mode and meta-feature constants (bookie, menus, etc.).
 * Loaded by lib/utils/constants.js and exposed via GAME_MODE_CONSTANTS.
 */

var GAME_MODE_CONSTANTS = {
    BOOKIE: {
        ATTRIBUTE_WEIGHTS: {
            speed: 1.2,
            threePoint: 1.1,
            dunk: 1.0,
            power: 0.9,
            steal: 0.8,
            block: 0.7
        },
        ODDS: {
            invalidFavorite: -110,
            invalidUnderdog: 110,
            evenFavorite: -105,
            evenUnderdog: 105,
            evenDiffPercent: 2,
            baseOdds: 110,
            diffScaleFactor: 8,
            minFavorite: -500,
            maxUnderdog: 500
        },
        SPREAD: {
            pointsPerPower: 1.5,
            minSpread: 0.5,
            maxSpread: 20,
            roundingIncrement: 0.5
        },
        OVER_UNDER: {
            basePerTeam: 30,
            powerScale: 4,
            minTotal: 60,
            maxTotal: 140,
            roundingIncrement: 0.5
        }
    },
    BETTING: {
        defaultBankroll: 1000,
        defaultWager: 100,
        promptsEnabled: true,
        hotkeyEnabled: true
    },
    MENUS: {
        TEAM_SELECTION: {
            columnWidth: 32,
            blankFillWidth: 34,
            minPadding: 2
        },
        SPLASH: {
            minCols: 80,
            minRows: 24,
            graphicWidth: 80,
            graphicHeight: 25,
            waitTimeoutMs: 10000,
            coordinatorTimeoutMs: 10000,
            pollIntervalMs: 100
        },
        MATCHUP: {
            minCols: 80,
            minRows: 24,
            graphicWidth: 80,
            maxGraphicHeight: 25,
            frameOffsets: {
                left: { x: 1, y: 10 },
                right: { x: 58, y: 10 }
            },
            frame: {
                width: 21,
                height: 10,
                innerOffsetX: 2,
                innerOffsetY: 2,
                areaWidth: 9,
                oddsOffsetY: 1,
                promptOffsetY: 2
            },
            animation: {
                presentationDurationMs: 10000,
                previewInitialDelayMs: 500,
                previewInitialRandomMs: 800,
                previewUpdateDelayMs: 700,
                previewUpdateRandomMs: 900,
                pollIntervalMs: 100,
                idleSleepMs: 20
            },
            coordinatorTimeoutMs: 15000
        }
    },
    RULE_ENFORCEMENT: {
        BACKCOURT_VIOLATIONS_ENABLED: false
    },
    
    // ========== LORB PLAYOFF CONSTANTS ==========
    // Used by lib/lorb/core/playoffs.js for parallel playoff system
    LORB_PLAYOFFS: {
        // Deadline configuration (hours)
        ROUND_SOFT_DEADLINE_HOURS: 72,   // After this, unresolved matches are eligible for CPU sim
        ROUND_HARD_DEADLINE_HOURS: 168,  // After this, unresolved matches MUST be auto-resolved (7 days)
        
        // Bracket sizing
        MIN_PLAYERS_FOR_PLAYOFFS: 2,     // Minimum qualifiers to run playoffs
        MAX_BRACKET_SIZE: 16,            // Maximum bracket size
        
        // Tie-breaking priority (1 = highest)
        TIEBREAKER: {
            PRIMARY: "wins",             // Season record
            SECONDARY: "rep",            // Reputation
            TERTIARY: "random"           // Random as last resort
        },
        
        // Match resolution modes
        RESOLUTION_MODES: {
            PVP: "pvp",                  // Both players present, real-time match
            GHOST: "ghost",              // One player present vs AI-controlled snapshot
            CPU_SIM: "cpu_sim"           // Fully automated simulation
        },
        
        // ========== SCHEDULING (per Playoff_Scheduling_Spec.md) ==========
        SCHEDULING: {
            // PvP window: prioritize live matches during first N hours of a round
            PVP_WINDOW_HOURS: 72,
            
            // Hard deadline: matches must be auto-resolved after N hours (7 days)
            HARD_DEADLINE_HOURS: 168,
            
            // Availability block size in minutes (30-minute windows for finer granularity)
            BLOCK_MINUTES: 30,
            
            // Grace period: wait N minutes for both players to show after scheduled start
            GRACE_MINUTES: 20,
            
            // Max defer tokens per player per match
            MAX_DEFERS_PER_PLAYER: 1,
            
            // Minimum buffer before scheduling (don't schedule immediately)
            MIN_SCHEDULE_BUFFER_MINUTES: 15
        },
        
        // Default availability presets (UTC-based, 2-hour blocks)
        // Each preset is an array of { dayOfWeek: 0-6 (Sun-Sat), startMinuteUTC: 0-1439 }
        AVAILABILITY_PRESETS: {
            // Weekday evenings: Mon-Fri, 00:00-02:00 and 02:00-04:00 UTC (evenings in Americas)
            weeknights: [
                { dayOfWeek: 1, startMinuteUTC: 0 },    // Mon 00:00-02:00 UTC
                { dayOfWeek: 1, startMinuteUTC: 120 },  // Mon 02:00-04:00 UTC
                { dayOfWeek: 2, startMinuteUTC: 0 },    // Tue 00:00-02:00 UTC
                { dayOfWeek: 2, startMinuteUTC: 120 },  // Tue 02:00-04:00 UTC
                { dayOfWeek: 3, startMinuteUTC: 0 },    // Wed 00:00-02:00 UTC
                { dayOfWeek: 3, startMinuteUTC: 120 },  // Wed 02:00-04:00 UTC
                { dayOfWeek: 4, startMinuteUTC: 0 },    // Thu 00:00-02:00 UTC
                { dayOfWeek: 4, startMinuteUTC: 120 },  // Thu 02:00-04:00 UTC
                { dayOfWeek: 5, startMinuteUTC: 0 },    // Fri 00:00-02:00 UTC
                { dayOfWeek: 5, startMinuteUTC: 120 }   // Fri 02:00-04:00 UTC
            ],
            // Weekend daytime: Sat-Sun, 14:00-22:00 UTC (morning/afternoon in Americas)
            weekend_day: [
                { dayOfWeek: 6, startMinuteUTC: 840 },  // Sat 14:00-16:00 UTC
                { dayOfWeek: 6, startMinuteUTC: 960 },  // Sat 16:00-18:00 UTC
                { dayOfWeek: 6, startMinuteUTC: 1080 }, // Sat 18:00-20:00 UTC
                { dayOfWeek: 6, startMinuteUTC: 1200 }, // Sat 20:00-22:00 UTC
                { dayOfWeek: 0, startMinuteUTC: 840 },  // Sun 14:00-16:00 UTC
                { dayOfWeek: 0, startMinuteUTC: 960 },  // Sun 16:00-18:00 UTC
                { dayOfWeek: 0, startMinuteUTC: 1080 }, // Sun 18:00-20:00 UTC
                { dayOfWeek: 0, startMinuteUTC: 1200 }  // Sun 20:00-22:00 UTC
            ],
            // Weekend evenings: Sat-Sun, 22:00-04:00 UTC (evening in Americas)
            weekend_night: [
                { dayOfWeek: 6, startMinuteUTC: 1320 }, // Sat 22:00-00:00 UTC
                { dayOfWeek: 0, startMinuteUTC: 0 },    // Sun 00:00-02:00 UTC
                { dayOfWeek: 0, startMinuteUTC: 120 },  // Sun 02:00-04:00 UTC
                { dayOfWeek: 0, startMinuteUTC: 1320 }, // Sun 22:00-00:00 UTC
                { dayOfWeek: 1, startMinuteUTC: 0 },    // Mon 00:00-02:00 UTC
                { dayOfWeek: 1, startMinuteUTC: 120 }   // Mon 02:00-04:00 UTC
            ],
            // Flexible: all common hours (union of above - good default)
            flexible: [
                // Weeknights
                { dayOfWeek: 1, startMinuteUTC: 0 }, { dayOfWeek: 1, startMinuteUTC: 120 },
                { dayOfWeek: 2, startMinuteUTC: 0 }, { dayOfWeek: 2, startMinuteUTC: 120 },
                { dayOfWeek: 3, startMinuteUTC: 0 }, { dayOfWeek: 3, startMinuteUTC: 120 },
                { dayOfWeek: 4, startMinuteUTC: 0 }, { dayOfWeek: 4, startMinuteUTC: 120 },
                { dayOfWeek: 5, startMinuteUTC: 0 }, { dayOfWeek: 5, startMinuteUTC: 120 },
                // Weekend day
                { dayOfWeek: 6, startMinuteUTC: 840 }, { dayOfWeek: 6, startMinuteUTC: 960 },
                { dayOfWeek: 6, startMinuteUTC: 1080 }, { dayOfWeek: 6, startMinuteUTC: 1200 },
                { dayOfWeek: 0, startMinuteUTC: 840 }, { dayOfWeek: 0, startMinuteUTC: 960 },
                { dayOfWeek: 0, startMinuteUTC: 1080 }, { dayOfWeek: 0, startMinuteUTC: 1200 },
                // Weekend night
                { dayOfWeek: 6, startMinuteUTC: 1320 }, { dayOfWeek: 0, startMinuteUTC: 1320 }
            ]
        }
    },
    RUBBER_BANDING: {
        enabled: true,
        showCue: true,
        defaultProfile: "arcade_default",
        probabilityCaps: {
            tier_clutch_3: 0.99,
            tier_0: 0.95,
            tier_1: 0.97,
            tier_2: 0.99,
            tier_3: 1.0
        },
        profiles: {
            arcade_default: {
                tiers: [
                    {
                        id: "tier_0",
                        deficitMin: 5,
                        deficitMax: 7,
                        clockMaxSeconds: null,
                        shotMultiplier: 1.08,
                        stealBonus: 0.02,
                        blockBonus: 0.01,
                        reboundBonus: 0.03,
                        turnoverRelief: -0.03,
                        turboReserveBonus: 8
                    },
                    {
                        id: "tier_1",
                        deficitMin: 8,
                        deficitMax: 12,
                        clockMaxSeconds: null,
                        shotMultiplier: 1.15,
                        stealBonus: 0.04,
                        blockBonus: 0.03,
                        reboundBonus: 0.05,
                        turnoverRelief: -0.05,
                        turboReserveBonus: 16
                    },
                    {
                        id: "tier_2",
                        deficitMin: 13,
                        deficitMax: 20,
                        clockMaxSeconds: null,
                        shotMultiplier: 1.25,
                        stealBonus: 0.06,
                        blockBonus: 0.05,
                        reboundBonus: 0.07,
                        turnoverRelief: -0.07,
                        turboReserveBonus: 20
                    },
                    {
                        id: "tier_3",
                        deficitMin: 21,
                        deficitMax: null,
                        clockMaxSeconds: null,
                        shotMultiplier: 1.45,
                        stealBonus: 0.1,
                        blockBonus: 0.08,
                        reboundBonus: 0.12,
                        turnoverRelief: -0.12,
                        turboReserveBonus: 30
                    },
                    {
                        id: "tier_clutch_3",
                        deficitMin: 3,
                        deficitMax: 8,
                        clockMaxSeconds: 10,
                        shotMultiplier: 1.12,
                        stealBonus: 0.03,
                        blockBonus: 0.02,
                        reboundBonus: 0.04,
                        turnoverRelief: -0.04,
                        turboReserveBonus: 12
                    }
                ]
            },
            pure_skill: {
                tiers: []
            }
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = GAME_MODE_CONSTANTS;
}
