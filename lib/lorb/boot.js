// xtrn/lorb/boot.js
(function () {
    var ROOT = js.exec_dir + "lib/lorb/";
    var UTILS_ROOT = js.exec_dir + "lib/utils/";

    // Load shared debug logger (writes to data/debug.log)
    load(UTILS_ROOT + "debug-logger.js");

    // global namespace
    if (!this.LORB) this.LORB = { Util: {}, Core: {}, Data: {}, Engines: {}, View: {} };

    // Define debugLog for LORB context if not already defined
    if (typeof debugLog !== "function") {
        this.debugLog = function(message) {
            try {
                var logFile = new File("/sbbs/xtrn/nba_jam/data/debug.log");
                if (logFile.open("a")) {
                    var timestamp = new Date().toISOString();
                    logFile.writeln(timestamp + " [Node " + (typeof bbs !== "undefined" && bbs.node_num ? bbs.node_num : "?") + "] " + message);
                    logFile.close();
                }
            } catch (e) {
                // Silently fail
            }
        };
        // Test that it works immediately
        this.debugLog("[LORB:BOOT] debugLog initialized");
    }

    // small helper: load path if it exists
    function loadSafe(path) {
        var f = new File(path);
        if (!f.exists) return false;
        load(path);
        return true;
    }

    // Load version module first (for compatibility checking)
    loadSafe(UTILS_ROOT + "version.js");

    // base config
    load(ROOT + "config.js");

    // utils (no logger)
    load(ROOT + "util/rng.js");
    load(ROOT + "util/persist.js");
    load(ROOT + "util/shared-state.js");
    load(ROOT + "util/contacts.js");
    load(ROOT + "util/daily_matchups.js");
    load(ROOT + "util/career-stats.js");
    load(ROOT + "util/pvp-stats.js");
    load(ROOT + "util/figlet-banner.js");
    load(ROOT + "util/bus-art.js");                // Baller bus art with dynamic route sign
    load(ROOT + "util/trophy-art.js");             // Trophy art with season Roman numerals
    load(ROOT + "util/json_client_helper.js");  // Shared JSONClient - must load before multiplayer
    load(ROOT + "util/admin.js");                  // Admin tools (time advance, give money/rep, reset)

    // multiplayer helpers (live challenges) - pub/sub version (non-blocking with fresh reads)
    load(ROOT + "multiplayer/challenges_pubsub.js");
    load(ROOT + "multiplayer/challenge_service.js");
    load(ROOT + "multiplayer/challenge_lobby.js");
    
    // New class-based network service (Wave 24)
    // Single instance per session, injected into views, handles all JSONClient operations
    load(ROOT + "services/network-service.js");
    load(ROOT + "multiplayer/challenge_lobby_ui.js");
    load(ROOT + "multiplayer/challenge_negotiation_v2.js");
    load(ROOT + "multiplayer/lorb_match.js");
    load(ROOT + "multiplayer/lorb_multiplayer_launcher.js");

    // engines - load mock first (always available)
    var mockLoaded =
        loadSafe(ROOT + "engines/nba_jam_mock.js")
        || loadSafe(ROOT + "../engines/nba_jam_mock.js")
        || loadSafe(ROOT + "../../engines/nba_jam_mock.js")
        || loadSafe(ROOT + "nba_jam_mock.js")
        || loadSafe("/sbbs/xtrn/nba_jam/engines/nba_jam_mock.js")
        || loadSafe("/sbbs/xtrn/nba_jam/nba_jam_mock.js");
    
    if (!mockLoaded || typeof NBAJam === "undefined" || !NBAJam.runLorbBattle)
        throw "NBAJam mock engine missing (runLorbBattle)";

    // Ensure LORB.Engines exists before assignment
    if (!LORB.Engines) LORB.Engines = {};
    LORB.Engines.NBAJam = NBAJam;
    
    // Try to load real game adapter (optional - may fail if real game not loaded)
    loadSafe(ROOT + "engines/nba_jam_adapter.js");

    // data - character creation data first
    load(ROOT + "data/archetypes.js");
    load(ROOT + "data/backgrounds.js");
    load(ROOT + "data/cpu_teams.js");
    load(ROOT + "data/cities.js");
    load(ROOT + "data/romance.js");
    load(ROOT + "data/roster_lookup.js");  // NBA roster lookup for contact hydration
    load(ROOT + "data/alignment.js");      // Alignment/karma system (parenting effects)
    load(ROOT + "data/baby-ballers.js");   // Baby baller management (relationship system)
    load(ROOT + "data/baby-events.js");    // Random baby mama/baller events
    load(ROOT + "data/spouse-events.js");  // Angry spouse events (caught cheating, etc.)
    load(ROOT + "data/companion.js");      // Traveling companion system

    // core logic
    load(ROOT + "core/state.js");
    load(ROOT + "core/economy.js");
    load(ROOT + "core/rules.js");
    load(ROOT + "core/character_creation.js");
    load(ROOT + "core/battle_adapter.js");
    load(ROOT + "core/events.js");
    load(ROOT + "core/season.js");
    load(ROOT + "core/playoffs.js");
    load(ROOT + "core/playoff-scheduling.js");  // Availability-based scheduling

    // ui
    load(ROOT + "ui/view.js");
    load(ROOT + "ui/stats_view.js");
    load(ROOT + "ui/sprite_preview.js");
    load(ROOT + "ui/playoff_view.js");
    load(ROOT + "ui/playoff_alert.js");  // Playoff scheduling alerts (pre-hub)
    
    // locations (Rim City hub and sub-locations)
    load(ROOT + "locations/hub.js");
    load(ROOT + "locations/courts.js");
    load(ROOT + "locations/gym.js");
    load(ROOT + "locations/club23.js");
    load(ROOT + "locations/shop.js");
    load(ROOT + "locations/mall.js");    // Consolidated Gym/Shop/Appearance hub
    load(ROOT + "locations/crib.js");
    load(ROOT + "locations/tournaments.js");
    load(ROOT + "locations/stats_records.js");  // Stats/Records/Leaderboards (info-focused)
    load(ROOT + "locations/red_bull_challenge.js");
    load(ROOT + "locations/sports_agent.js");
    load(ROOT + "locations/doctor.js");  // Pregnancy/birth events

    // wire data registries
    LORB.Events.loadFromIni(LORB.Config.EVENTS_INI);
    LORB.Core.registerCpuTeams(LORB.Data.CPU_TEAMS);
})();
