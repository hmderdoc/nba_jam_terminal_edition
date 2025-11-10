// xtrn/lorb/util/persist.js
(function () {
    function ensureDir(path) {
        // Synchronet makes dirs automatically when writing files; guard not essential.
    }
    function pathForUser(u) {
        return LORB.Config.SAVE_DIR + "u" + (u && u.number ? u.number : 0) + ".json";
    }
    LORB.Persist = {
        load: function (u) {
            var p = pathForUser(u), f = new File(p);
            if (!f.exists) return null;
            if (!f.open("r", true)) return null;
            var txt = f.readAll().join("");
            f.close();
            try { return JSON.parse(txt); } catch (e) { return null; }
        },
        save: function (ctx) {
            var p = pathForUser(ctx._user);
            var f = new File(p);
            if (!f.open("w")) return;
            f.write(JSON.stringify(ctx));
            f.close();
        }
    };
})();