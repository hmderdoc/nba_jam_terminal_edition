// Scans assets/characters for a random opponent sprite and returns metadata.
(function () {
    var SAFE_NAME = /^[A-Za-z0-9_-]+\.bin$/;
    var ROOT = (typeof js !== "undefined" && js.exec_dir) ? js.exec_dir : "./";
    var CHAR_DIR = ensureTrailingSlash(ROOT) + "assets/characters/";

    function ensureTrailingSlash(dir) {
        if (!dir || dir === ".") return "./";
        return /[\/\\]$/.test(dir) ? dir : dir + "/";
    }

    function logError(message) {
        var prefix = "[LORB:get_random_opponent] ";
        if (typeof log === "function") {
            var level = (typeof LOG_ERR !== "undefined") ? LOG_ERR : 1;
            try { log(level, prefix + message); return; } catch (e) { /* ignore */ }
        }
        if (typeof console !== "undefined" && typeof console.print === "function") {
            console.print(prefix + message + "\r\n");
        }
    }

    function listCandidates() {
        var mask = CHAR_DIR + "*.bin";
        var flags = (typeof GLOB !== "undefined" && GLOB.NODOT) ? GLOB.NODOT : null;
        var files = (flags === null) ? directory(mask) : directory(mask, flags);
        files = files || [];
        var out = [];
        for (var i = 0; i < files.length; i++) {
            var path = files[i];
            var name = (typeof file_getname === "function")
                ? file_getname(path)
                : path.substring(path.lastIndexOf("/") + 1);
            if (SAFE_NAME.test(name)) out.push(name);
        }
        return out;
    }

    function validateAndBuild(name) {
        var filePath = CHAR_DIR + name;
        var f = new File(filePath);
        if (!f.open("r", true)) throw new Error("Unable to open opponent asset: " + name);
        var size = f.length;
        f.close();
        if (!size) throw new Error("Opponent asset is empty: " + name);
        return {
            id: name.replace(/\.bin$/i, ""),
            fileName: name,
            path: filePath,
            size: size
        };
    }

    function randomIndex(max) {
        if (!max || max <= 0) throw new Error("No opponents available");
        return max === 1 ? 0 : Math.floor(Math.random() * max);
    }

    function getRandomOpponent() {
        try {
            var candidates = listCandidates();
            if (!candidates.length) {
                throw new Error("No opponent .bin files found in " + CHAR_DIR);
            }
            return validateAndBuild(candidates[randomIndex(candidates.length)]);
        } catch (err) {
            logError(err && err.message ? err.message : String(err));
            throw err;
        }
    }

    if (typeof this.LORB !== "object") {
        this.LORB = {};
    }
    this.LORB.getRandomOpponent = getRandomOpponent;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = getRandomOpponent;
    }
})();
