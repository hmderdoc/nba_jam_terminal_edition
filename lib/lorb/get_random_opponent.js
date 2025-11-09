/**
 * Utility for selecting a random opponent asset.
 *
 * Looks inside the assets/characters directory, selects a random `.ans` file,
 * and validates the selection before returning metadata about the opponent.
 * Works in both the Synchronet runtime and in Node (for testing).
 */
(function (global) {
    var SAFE_NAME_PATTERN = /^[A-Za-z0-9_-]+\.ans$/;
    var isNode = typeof module !== "undefined" && module.exports && typeof require === "function";
    var characterDir = resolveCharacterDir();
    var env = createEnv();

    function resolveCharacterDir() {
        if (isNode) {
            var path = require("path");
            return path.resolve(__dirname, "../../assets/characters");
        }
        if (typeof js !== "undefined" && js.exec_dir) {
            return ensureTrailingSlash(js.exec_dir) + "assets/characters/";
        }
        throw new Error("Unable to resolve assets/characters directory");
    }

    function ensureTrailingSlash(dir) {
        if (!dir) return "./";
        var last = dir.charAt(dir.length - 1);
        if (last === "/" || last === "\\") return dir;
        return dir + "/";
    }

    function createEnv() {
        if (isNode) {
            var fs = require("fs");
            var path = require("path");
            var crypto = require("crypto");
            var randomInt = crypto.randomInt
                ? function (max) { return crypto.randomInt(max); }
                : function (max) {
                    var buf = crypto.randomBytes(4);
                    return Math.floor((buf.readUInt32BE(0) / 0x100000000) * max);
                };
            return {
                listCandidates: function () {
                    var entries = fs.readdirSync(characterDir, { withFileTypes: true });
                    var out = [];
                    for (var i = 0; i < entries.length; i++) {
                        var entry = entries[i];
                        if (!entry.isFile()) continue;
                        if (!SAFE_NAME_PATTERN.test(entry.name)) continue;
                        out.push(entry.name);
                    }
                    return out;
                },
                validateFile: function (fileName) {
                    var filePath = path.join(characterDir, fileName);
                    var stats = fs.statSync(filePath);
                    if (!stats.isFile()) {
                        throw new Error("Opponent asset is not a file: " + fileName);
                    }
                    if (stats.size <= 0) {
                        throw new Error("Opponent asset is empty: " + fileName);
                    }
                    return { path: filePath, size: stats.size };
                },
                randomIndex: function (max) {
                    if (max <= 0) throw new Error("No opponents available");
                    return randomInt(max);
                }
            };
        }

        if (typeof directory !== "function" || typeof File === "undefined") {
            throw new Error("Synchronet file APIs are unavailable");
        }

        return {
            listCandidates: function () {
                var mask = characterDir + "*.ans";
                var flag = (typeof GLOB !== "undefined" && GLOB.NODOT) ? GLOB.NODOT : null;
                var files = flag !== null ? directory(mask, flag) : directory(mask);
                files = files || [];
                var out = [];
                for (var i = 0; i < files.length; i++) {
                    var fullPath = files[i];
                    var name = (typeof file_getname === "function")
                        ? file_getname(fullPath)
                        : fullPath.substring(fullPath.lastIndexOf("/") + 1);
                    if (SAFE_NAME_PATTERN.test(name)) out.push(name);
                }
                return out;
            },
            validateFile: function (fileName) {
                var filePath = characterDir + fileName;
                var f = new File(filePath);
                if (!f.exists || !f.open("r", true)) {
                    throw new Error("Unable to open opponent asset: " + fileName);
                }
                var len = f.length;
                f.close();
                if (!len || len <= 0) {
                    throw new Error("Opponent asset is empty: " + fileName);
                }
                return { path: filePath, size: len };
            },
            randomIndex: function (max) {
                if (max <= 0) throw new Error("No opponents available");
                return Math.floor(Math.random() * max);
            }
        };
    }

    function stripExtension(fileName) {
        return fileName.replace(/\.ans$/i, "");
    }

    function getRandomOpponent() {
        var candidates = env.listCandidates();
        if (!candidates || !candidates.length) {
            throw new Error("No valid opponent assets found in " + characterDir);
        }
        var fileName = candidates[env.randomIndex(candidates.length)];
        var fileInfo = env.validateFile(fileName);
        return {
            id: stripExtension(fileName),
            fileName: fileName,
            path: fileInfo.path,
            size: fileInfo.size
        };
    }

    if (typeof global !== "undefined" && global.LORB) {
        global.LORB.getRandomOpponent = getRandomOpponent;
    }

    if (isNode) {
        module.exports = getRandomOpponent;
        module.exports.CHARACTER_DIR = characterDir;
    }
})(this);
