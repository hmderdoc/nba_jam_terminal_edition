// xtrn/lorb/config.js
(function () {
    var ROOT = js.exec_dir + "lib/lorb/";
    LORB.Config = {
        ROOT: ROOT,
        EVENTS_INI: file_cfgname(ROOT, "data/events.ini"),
        SAVE_DIR: ROOT + "saves/",
        DEFAULT_TURNS: 5,
        DEFAULT_USER_TEAM: "RIM CITY",
        DEFAULT_USER_PLAYERS: ["rc_blaze", "rc_tower"]
    };
})();