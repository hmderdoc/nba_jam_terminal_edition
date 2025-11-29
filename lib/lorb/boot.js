// xtrn/lorb/boot.js
(function () {
    var ROOT = js.exec_dir + "lib/lorb/";

    // global namespace
    if (!this.LORB) this.LORB = { Util: {}, Core: {}, Data: {}, Engines: {}, View: {} };

    // small helper: load path if it exists
    function loadSafe(path) {
        var f = new File(path);
        if (!f.exists) return false;
        load(path);
        return true;
    }

    // base config
    load(ROOT + "config.js");

    // utils (no logger)
    load(ROOT + "util/rng.js");
    load(ROOT + "util/persist.js");

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

    LORB.Engines.NBAJam = NBAJam;
    
    // Try to load real game adapter (optional - may fail if real game not loaded)
    loadSafe(ROOT + "engines/nba_jam_adapter.js");

    // data - character creation data first
    load(ROOT + "data/archetypes.js");
    load(ROOT + "data/backgrounds.js");
    load(ROOT + "data/cpu_teams.js");

    // core logic
    load(ROOT + "core/state.js");
    load(ROOT + "core/economy.js");
    load(ROOT + "core/rules.js");
    load(ROOT + "core/character_creation.js");
    load(ROOT + "core/battle_adapter.js");
    load(ROOT + "core/events.js");

    // ui
    load(ROOT + "ui/view.js");
    load(ROOT + "ui/stats_view.js");
    
    // locations (Rim City hub and sub-locations)
    load(ROOT + "locations/hub.js");
    load(ROOT + "locations/courts.js");
    load(ROOT + "locations/gym.js");
    load(ROOT + "locations/club23.js");
    load(ROOT + "locations/shop.js");

    // wire data registries
    LORB.Events.loadFromIni(LORB.Config.EVENTS_INI);
    LORB.Core.registerCpuTeams(LORB.Data.CPU_TEAMS);
})();