/**
 * json-client-factory.js - Unified JSONClient Singleton Factory
 * 
 * Provides a shared JSONClient instance for all NBA Jam components (LORB, multiplayer lobbies).
 * This prevents multiple connections from the same user and ensures consistent cleanup.
 * 
 * Architecture:
 * - Single instance per user session
 * - Lazy instantiation on first get()
 * - Fire-and-forget mode by default (TIMEOUT=-1)
 * - All consumers use NBA_JAM.JsonClient.get() instead of new JSONClient()
 * 
 * Usage:
 *   var client = NBA_JAM.JsonClient.get();
 *   client.write("nba_jam", path, data, 2);
 *   // At session end:
 *   NBA_JAM.JsonClient.disconnect();
 */
(function() {
    // Ensure namespace exists
    if (typeof NBA_JAM === "undefined") {
        this.NBA_JAM = {};
    }
    
    // Load JSONClient class if not available
    if (typeof JSONClient === "undefined") {
        try {
            load("json-client.js");
        } catch (e) {
            // Will fail gracefully on get()
        }
    }
    
    // Configuration defaults
    var DEFAULT_ADDR = "localhost";
    var DEFAULT_PORT = 10088;
    var DEFAULT_TIMEOUT = -1;           // Fire-and-forget (non-blocking writes)
    var DEFAULT_SOCK_TIMEOUT = 2000;    // 2 second socket timeout for reads
    var BACKOFF_MS = 10000;             // 10 second backoff on connection failure
    
    // Singleton state
    var _client = null;
    var _config = null;
    var _backoffUntil = 0;
    var _subscriptions = [];  // Track subscriptions for cleanup
    
    function nowMs() {
        return Date.now ? Date.now() : (time() * 1000);
    }
    
    function log(msg) {
        if (typeof debugLog === "function") {
            debugLog("[NBA_JAM:JsonClient] " + msg);
        }
    }
    
    function logError(msg) {
        if (typeof debugLog === "function") {
            debugLog("[NBA_JAM:JsonClient][ERROR] " + msg);
        }
    }
    
    /**
     * Resolve connection configuration
     * Checks multiple sources: explicit config, LORB config, server.ini
     */
    function resolveConfig() {
        if (_config) return _config;
        
        var addr = DEFAULT_ADDR;
        var port = DEFAULT_PORT;
        
        // Try LORB.Persist.getServerConfig if available
        if (typeof LORB !== "undefined" && LORB.Persist && LORB.Persist.getServerConfig) {
            var serverCfg = LORB.Persist.getServerConfig();
            if (serverCfg) {
                addr = serverCfg.addr || addr;
                port = serverCfg.port || port;
            }
        }
        
        // Try mpConfig if available (multiplayer)
        if (typeof mpConfig !== "undefined" && mpConfig) {
            addr = mpConfig.addr || addr;
            port = mpConfig.port || port;
        }
        
        _config = {
            addr: addr,
            port: port,
            timeout: DEFAULT_TIMEOUT,
            sockTimeout: DEFAULT_SOCK_TIMEOUT
        };
        
        return _config;
    }
    
    /**
     * Get the shared JSONClient instance
     * Creates connection on first call, returns cached instance thereafter
     * 
     * @param {Object} opts - Optional configuration
     * @param {boolean} opts.force - Force reconnection even during backoff
     * @returns {Object|null} JSONClient instance or null if connection failed
     */
    function get(opts) {
        opts = opts || {};
        var now = nowMs();
        
        // Check backoff period (unless forced)
        if (!opts.force && _backoffUntil && now < _backoffUntil) {
            return null;
        }
        
        // Return existing connected client
        if (_client && _client.connected) {
            return _client;
        }
        
        // Need to create new connection
        if (typeof JSONClient === "undefined") {
            try {
                load("json-client.js");
            } catch (e) {
                logError("JSONClient class not available: " + e);
                _backoffUntil = now + BACKOFF_MS;
                return null;
            }
        }
        
        var cfg = resolveConfig();
        
        try {
            _client = new JSONClient(cfg.addr, cfg.port);
            
            if (_client && _client.settings) {
                // Fire-and-forget mode: writes don't block waiting for response
                _client.settings.TIMEOUT = cfg.timeout;
                _client.settings.SOCK_TIMEOUT = cfg.sockTimeout;
                _client.settings.PING_TIMEOUT = cfg.sockTimeout;
                _client.settings.PING_INTERVAL = 30000;  // 30 second ping interval
            }
            
            if (_client && _client.connected) {
                log("connected to " + cfg.addr + ":" + cfg.port);
                _backoffUntil = 0;
                return _client;
            } else {
                logError("connection failed to " + cfg.addr + ":" + cfg.port);
                _client = null;
            }
        } catch (e) {
            logError("connection error: " + e);
            _client = null;
        }
        
        // Enter backoff period
        _backoffUntil = now + BACKOFF_MS;
        return null;
    }
    
    /**
     * Check if client is currently connected
     * @returns {boolean}
     */
    function isConnected() {
        return _client && _client.connected;
    }
    
    /**
     * Track a subscription for cleanup on disconnect
     * Call this after client.subscribe() to ensure proper cleanup
     * 
     * @param {string} scope - Subscription scope (e.g., "nba_jam", "chat")
     * @param {string} path - Subscription path
     */
    function trackSubscription(scope, path) {
        // Avoid duplicates
        for (var i = 0; i < _subscriptions.length; i++) {
            if (_subscriptions[i].scope === scope && _subscriptions[i].path === path) {
                return;
            }
        }
        _subscriptions.push({ scope: scope, path: path });
    }
    
    /**
     * Untrack a subscription (call after manual unsubscribe)
     * 
     * @param {string} scope - Subscription scope
     * @param {string} path - Subscription path
     */
    function untrackSubscription(scope, path) {
        for (var i = _subscriptions.length - 1; i >= 0; i--) {
            if (_subscriptions[i].scope === scope && _subscriptions[i].path === path) {
                _subscriptions.splice(i, 1);
                return;
            }
        }
    }
    
    /**
     * Disconnect the shared client and clean up
     * Safe to call multiple times (idempotent)
     */
    function disconnect() {
        if (_client) {
            // Unsubscribe from all tracked subscriptions
            for (var i = 0; i < _subscriptions.length; i++) {
                try {
                    var sub = _subscriptions[i];
                    _client.unsubscribe(sub.scope, sub.path);
                    log("unsubscribed: " + sub.scope + "." + sub.path);
                } catch (e) {
                    // Ignore unsubscribe errors during cleanup
                }
            }
            _subscriptions = [];
            
            // Disconnect the socket
            try {
                _client.disconnect();
                log("disconnected");
            } catch (e) {
                // Ignore disconnect errors
            }
        }
        
        _client = null;
    }
    
    /**
     * Mark connection as failed (enters backoff period)
     * Call this when operations fail to prevent rapid reconnection attempts
     */
    function markFailure() {
        _backoffUntil = nowMs() + BACKOFF_MS;
        disconnect();
    }
    
    /**
     * Override configuration (useful for testing or custom servers)
     * Must be called BEFORE first get() call
     * 
     * @param {Object} cfg - Configuration object
     * @param {string} cfg.addr - Server address
     * @param {number} cfg.port - Server port
     * @param {number} cfg.timeout - Operation timeout (-1 for fire-and-forget)
     * @param {number} cfg.sockTimeout - Socket timeout in ms
     */
    function configure(cfg) {
        if (_client) {
            logError("configure() called after client already created - ignored");
            return;
        }
        
        _config = {
            addr: cfg.addr || DEFAULT_ADDR,
            port: cfg.port || DEFAULT_PORT,
            timeout: (cfg.timeout !== undefined) ? cfg.timeout : DEFAULT_TIMEOUT,
            sockTimeout: cfg.sockTimeout || DEFAULT_SOCK_TIMEOUT
        };
        
        log("configured: " + _config.addr + ":" + _config.port);
    }
    
    // Export to NBA_JAM namespace
    NBA_JAM.JsonClient = {
        get: get,
        isConnected: isConnected,
        disconnect: disconnect,
        configure: configure,
        markFailure: markFailure,
        trackSubscription: trackSubscription,
        untrackSubscription: untrackSubscription
    };
    
})();
