/**
 * FrameManager - central registry for UI frames.
 * Provides creation, reopening, teardown, and alias helpers so code
 * no longer relies on implicit global frame variables.
 */
(function () {
    function resolveGlobal() {
        if (typeof globalThis !== "undefined") return globalThis;
        if (typeof global !== "undefined") return global;
        if (typeof window !== "undefined") return window;
        if (typeof this !== "undefined") return this;
        try {
            return Function("return this")();
        } catch (e) {
            return {};
        }
    }

    var root = resolveGlobal();
    var entries = {};

    function ensureEntry(name) {
        if (!entries[name]) {
            entries[name] = { factory: null, frame: null };
        }
        return entries[name];
    }

    function createFrame(name) {
        var entry = entries[name];
        if (!entry || !entry.factory) return null;
        entry.frame = entry.factory();
        return entry.frame;
    }

    var FrameManager = {
        /**
         * Register (or update) the factory that creates the frame.
         * @param {string} name
         * @param {Function} factory - must return an opened Frame instance.
         */
        define: function (name, factory) {
            var entry = ensureEntry(name);
            entry.factory = factory;
            return entry;
        },

        /**
         * Ensure a frame exists and is opened.
         * @param {string} name
         * @returns {Frame|null}
         */
        ensure: function (name) {
            var entry = entries[name];
            if (!entry) return null;
            if (entry.frame && entry.frame.is_open) {
                return entry.frame;
            }
            return createFrame(name);
        },

        /**
         * Get a frame without forcing recreation (unless already defined).
         * @param {string} name
         * @returns {Frame|null}
         */
        get: function (name) {
            var entry = entries[name];
            if (!entry) return null;
            if (!entry.frame || entry.frame.is_open === false) {
                return this.ensure(name);
            }
            return entry.frame;
        },

        /**
         * Manually set a frame instance (used by legacy code / tests).
         * @param {string} name
         * @param {Frame|null} frame
         */
        set: function (name, frame) {
            var entry = ensureEntry(name);
            entry.frame = frame || null;
        },

        /**
         * Close and unregister a frame.
         * @param {string} name
         */
        close: function (name) {
            var entry = entries[name];
            if (!entry || !entry.frame) return;
            try {
                entry.frame.close();
            } catch (e) { }
            entry.frame = null;
        },

        /**
         * Close every registered frame.
         */
        closeAll: function () {
            for (var name in entries) {
                this.close(name);
            }
        },

        /**
         * Return a shallow status object for diagnostics.
         */
        status: function () {
            var result = {};
            for (var name in entries) {
                var entry = entries[name];
                result[name] = {
                    hasFactory: !!entry.factory,
                    isOpen: !!(entry.frame && entry.frame.is_open)
                };
            }
            return result;
        },

        /**
         * Expose a global property that proxies to the managed frame.
         * Allows legacy code to keep referencing e.g. `scoreFrame`.
         * @param {string} globalName
         * @param {string} frameName
         */
        alias: function (globalName, frameName) {
            Object.defineProperty(root, globalName, {
                configurable: true,
                enumerable: false,
                get: function () {
                    return FrameManager.get(frameName);
                },
                set: function (value) {
                    FrameManager.set(frameName, value);
                }
            });
        }
    };

    root.FrameManager = FrameManager;

    // Default aliases for core frames
    FrameManager.alias("announcerFrame", "announcer");
    FrameManager.alias("courtFrame", "court");
    FrameManager.alias("trailFrame", "trail");
    FrameManager.alias("leftHoopFrame", "leftHoop");
    FrameManager.alias("rightHoopFrame", "rightHoop");
    FrameManager.alias("scoreFrame", "scoreboard");
})();
