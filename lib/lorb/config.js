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

        // Enable live challenge polling/invites (JSON-DB).
        ENABLE_LIVE_CHALLENGES: true,
        
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
        }
    };
})();
