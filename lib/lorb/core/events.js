// xtrn/lorb/core/events.js
(function () {
    var REG = []; // event objects

    function parseSection(f, s) {
        return {
            key: f.iniGetValue(s, "key", s),
            weight: parseInt(f.iniGetValue(s, "weight", 1), 10) || 1,
            type: f.iniGetValue(s, "type", "choice"),
            text: f.iniGetValue(s, "text", ""),
            battle_template: f.iniGetValue(s, "battle_template", ""),
            on_win: f.iniGetValue(s, "on_win", ""),
            on_loss: f.iniGetValue(s, "on_loss", ""),
            odds_model: f.iniGetValue(s, "odds_model", ""),
            min_bet: parseInt(f.iniGetValue(s, "min_bet", 0), 10) || 0,
            max_bet: parseInt(f.iniGetValue(s, "max_bet", 0), 10) || 0,
            teams: f.iniGetValue(s, "teams", ""),
            opt1: f.iniGetValue(s, "opt1", ""),
            opt2: f.iniGetValue(s, "opt2", ""),
            opt3: f.iniGetValue(s, "opt3", "")
        };
    }

    function pickWeighted() {
        var total = 0, i;
        for (i = 0; i < REG.length; i++) total += (REG[i].weight || 1);
        var r = Math.random() * total, acc = 0;
        for (i = 0; i < REG.length; i++) {
            acc += (REG[i].weight || 1);
            if (r <= acc) return REG[i];
        }
        return REG[0];
    }

    function applyEffectLine(ctx, line) {
        if (!line) return;
        var parts = line.split("|"), i;
        for (i = 0; i < parts.length; i++) {
            var t = parts[i];
            if (!t) continue;
            var kv = t.split(":");
            if (kv.length < 2) continue;
            var k = kv[0], v = kv.slice(1).join(":");
            if (k === "flag") { ctx.flags[v] = true; continue; }
            var n = parseInt(v, 10);
            if (!isNaN(n)) {
                if (k === "money" || k === "cash") ctx.cash += n;
                else if (k === "xp") ctx.xp += n;
                else if (k === "rep") ctx.rep += n;
            }
        }
    }

    function runChoice(ev, ctx) {
        LORB.View.info(ev.text);
        var opts = [ev.opt1, ev.opt2, ev.opt3];
        var labels = [], i;
        for (i = 0; i < opts.length; i++) if (opts[i]) labels.push(opts[i].split("|")[0]);
        var sel = LORB.View.choose(labels);
        var raw = opts[sel];
        var parts = raw.split("|");
        for (i = 1; i < parts.length; i++)
            if (parts[i].indexOf("effect:") !== 0) applyEffectLine(ctx, parts[i]);
    }

    function runGamble(ev, ctx) {
        // (placeholder) You can wire the real CPU-vs-CPU bet here later
        LORB.View.warn("Gamble event not implemented yet.");
    }

    LORB.Events = {
        loadFromIni: function (path) {
            var f = new File(path);
            if (!f.open("r", true)) { throw "events ini open fail: " + path; }
            var sections = f.iniGetSections(), i;
            for (i = 0; i < sections.length; i++)
                if (sections[i].indexOf("event.") === 0) REG.push(parseSection(f, sections[i]));
            f.close();
            // Optional: echo count if you want
            // console.print("\r\nLoaded events: " + REG.length + "\r\n");
        },
        pickRandom: function () { return pickWeighted(); },
        run: function (ev, ctx) {
            LORB.View.header(ev.key);
            if (ev.type === "choice") runChoice(ev, ctx);
            else if (ev.type === "battle") LORB.Core.Battle.runAndMap(ev.battle_template, ctx) || applyEffectLine(ctx, ev.on_win);
            else if (ev.type === "gamble") runGamble(ev, ctx);
            else LORB.View.warn("Unknown event type: " + ev.type);
        }
    };
})();