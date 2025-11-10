// xtrn/lorb/util/rng.js
(function () {
    LORB.Util.RNG = {
        make: function (seed) {
            var s = (typeof seed === 'number' ? seed : (Date.now ? Date.now() : time())) & 0x7fffffff;
            function next() { s = (1103515245 * s + 12345) & 0x7fffffff; return s / 0x7fffffff; }
            return { next: next, seed: s };
        }
    };
})();