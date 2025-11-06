// xtrn/lorb/ui/view.js
(function () {
    LORB.View = {
        clear: function () { console.clear(); },
        title: function (name, handle) {
            console.print("\1h\1y" + name + "\1n  —  " + handle + "\r\n");
        },
        header: function (label) {
            console.print("\r\n\1h\1w" + label + "\1n\r\n");
        },
        status: function (ctx) {
            console.print("Team: " + ctx.userTeam + "   Cash:$" + ctx.cash + "   XP:" + ctx.xp + "   Rep:" + ctx.rep + "\r\n");
        },
        info: function (s) { console.print(s + "\r\n"); },
        warn: function (s) { console.print("\1h\1r" + s + "\1n\r\n"); },
        line: function (s) { console.print(s + "\r\n"); },
        confirm: function (prompt) {
            console.print(prompt);
            var k = console.getkeys("YNyn", 0);
            console.crlf();
            return (k && k.toUpperCase() === "Y");
        },
        choose: function (labels) {
            var i;
            for (i = 0; i < labels.length; i++) console.print("  [" + (i + 1) + "] " + labels[i] + "\r\n");
            console.print("\r\nSelect: ");
            var ch = console.getkeys("123456789", 0);
            console.crlf();
            var idx = ch ? (parseInt(ch, 10) - 1) : 0;
            if (idx < 0 || idx >= labels.length) idx = 0;
            return idx;
        },
        prompt: function (text, keyMask) {
            console.print(text);
            if (keyMask) { var k = console.getkeys(keyMask, 0); console.crlf(); return k; }
            var s = console.getstr("", 32);
            console.crlf();
            return s;
        },
        promptNumber: function (text) {
            console.print(text);
            var s = console.getstr("", 8, K_NUMBER);
            console.crlf();
            return parseInt(s, 10);
        }
    };
})();