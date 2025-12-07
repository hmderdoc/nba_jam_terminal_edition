/**
 * json_client_helper.js - Shared JSONClient connector with backoff/short timeouts.
 *
 * Provides a single shared client for ephemeral operations (presence, challenges).
 * Callers are responsible for LOCK_READ/LOCK_WRITE usage around read/write/remove.
 * All timeouts are kept short to avoid stalling the BBS.
 *
 * Usage:
 *   var JCH = LORB.JsonClientHelper;
 *   var client = JCH.ensureClient();
 *   client.read(scope, path);
 *   JCH.disconnect();
 *
 * Supports test injection via LORB._JsonClientMock.
 * Includes version checking to prevent incompatible clients from connecting.
 */
(function () {
    if (!this.LORB) this.LORB = {};
    
    var DEFAULT_ADDR = "localhost";
    var DEFAULT_PORT = 10088;
    var DEFAULT_SCOPE = "lorb";
    var DEFAULT_BACKOFF_MS = 10000;
    var DEFAULT_TIMEOUT_MS = 30000;
    var VERSION_PATH = "server_info.version";
    var VERSION_CHECK_DONE = false;
    var VERSION_MISMATCH_ERROR = null;
    
    var client = null;
    var backoffUntil = 0;
    var currentCfg = null;
    
    function nowMs() { return Date.now ? Date.now() : (time() * 1000); }
    
    function logInfo(msg) { if (typeof debugLog === "function") debugLog("[LORB:JsonClient] " + msg); }
    function logWarn(msg) { if (typeof debugLog === "function") debugLog("[LORB:JsonClient][WARN] " + msg); }
    
    /**
     * Get local client version from NBA_JAM.Version module
     */
    function getLocalVersion() {
        if (typeof NBA_JAM !== "undefined" && NBA_JAM.Version && NBA_JAM.Version.getCommitHash) {
            return NBA_JAM.Version.getCommitHash();
        }
        return "unknown";
    }
    
    /**
     * Check version compatibility with server
     * Returns true if compatible, false if mismatch (sets VERSION_MISMATCH_ERROR)
     */
    function checkVersionCompatibility(jsonClient, scope, serverName) {
        if (VERSION_CHECK_DONE) {
            return VERSION_MISMATCH_ERROR === null;
        }
        
        var localVersion = getLocalVersion();
        logInfo("Version check: local=" + localVersion);
        
        // Skip version check if local version is unknown (development mode)
        if (localVersion === "unknown") {
            logInfo("Version check skipped: local version unknown (development mode)");
            VERSION_CHECK_DONE = true;
            return true;
        }
        
        try {
            // Read server version
            var serverInfo = jsonClient.read(scope, VERSION_PATH, 1);
            
            if (!serverInfo || !serverInfo.commit) {
                // No server version set - we are the first/primary, write our version
                logInfo("No server version found, publishing ours: " + localVersion);
                jsonClient.write(scope, VERSION_PATH, {
                    commit: localVersion,
                    publishedAt: nowMs(),
                    publishedBy: system.qwk_id || system.name || "unknown"
                }, 2);
                VERSION_CHECK_DONE = true;
                return true;
            }
            
            var serverVersion = serverInfo.commit;
            logInfo("Server version: " + serverVersion);
            
            // Check compatibility
            if (typeof NBA_JAM !== "undefined" && NBA_JAM.Version && NBA_JAM.Version.isCompatible) {
                if (!NBA_JAM.Version.isCompatible(localVersion, serverVersion)) {
                    VERSION_MISMATCH_ERROR = NBA_JAM.Version.formatMismatchError(
                        serverName || (currentCfg ? currentCfg.addr : "server"),
                        localVersion,
                        serverVersion
                    );
                    logWarn("Version mismatch! " + VERSION_MISMATCH_ERROR);
                    VERSION_CHECK_DONE = true;
                    return false;
                }
            } else if (localVersion !== serverVersion) {
                // Fallback: simple string comparison
                VERSION_MISMATCH_ERROR = "Version mismatch: your version " + localVersion + 
                    " does not match server version " + serverVersion + 
                    ". Tell your sysop to update.";
                logWarn(VERSION_MISMATCH_ERROR);
                VERSION_CHECK_DONE = true;
                return false;
            }
            
            logInfo("Version check passed");
            VERSION_CHECK_DONE = true;
            return true;
            
        } catch (e) {
            logWarn("Version check failed: " + e + " - allowing connection");
            VERSION_CHECK_DONE = true;
            return true; // Allow on error to not block if JSON service is flaky
        }
    }
    
    function resolveConfig() {
        var cfg = (typeof LORB !== "undefined" && LORB.Config && LORB.Config.JSON_CLIENT) || {};
        var serverCfg = (typeof LORB !== "undefined" && LORB.Persist && LORB.Persist.getServerConfig)
            ? (LORB.Persist.getServerConfig() || {})
            : {};
        return {
            addr: cfg.addr || serverCfg.addr || DEFAULT_ADDR,
            port: cfg.port || serverCfg.port || DEFAULT_PORT,
            scope: cfg.scope || serverCfg.scope || DEFAULT_SCOPE,
            timeoutMs: (cfg.timeoutMs !== undefined ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS),
            backoffMs: (cfg.backoffMs !== undefined ? cfg.backoffMs : DEFAULT_BACKOFF_MS)
        };
    }
    
    function ensureClient(opts) {
        opts = opts || {};
        var now = nowMs();
        
        // If we already detected a version mismatch, refuse to connect
        if (VERSION_MISMATCH_ERROR !== null) {
            return null;
        }
        
        if (!opts.force && backoffUntil && now < backoffUntil) return null;
        
        currentCfg = resolveConfig();

        // Short-circuit when live challenges are disabled to avoid JSON service timeouts.
        if (typeof LORB !== "undefined" && LORB.Config && LORB.Config.ENABLE_LIVE_CHALLENGES === false) {
            backoffUntil = now + (currentCfg.backoffMs || DEFAULT_BACKOFF_MS);
            return null;
        }
        
        // Allow tests to inject a mock
        if (typeof LORB !== "undefined" && LORB._JsonClientMock) {
            return LORB._JsonClientMock;
        }
        
        if (client && client.connected) return client;
        
        if (typeof JSONClient === "undefined") {
            try { load("/sbbs/exec/load/json-client.js"); } catch (e) {
                logWarn("load failed: " + e);
                backoffUntil = now + currentCfg.backoffMs;
                return null;
            }
        }
        
        try {
            client = new JSONClient(currentCfg.addr, currentCfg.port);
            if (client && client.settings) {
                client.settings.TIMEOUT = currentCfg.timeoutMs;
                client.settings.SOCK_TIMEOUT = currentCfg.timeoutMs;
                client.settings.PING_TIMEOUT = currentCfg.timeoutMs;
                client.settings.PING_INTERVAL = 30000;
            }
            if (client && client.connected) {
                logInfo("connected addr=" + currentCfg.addr + " port=" + currentCfg.port + " timeoutMs=" + currentCfg.timeoutMs);
                
                // Perform version check on first successful connection
                if (!opts.skipVersionCheck) {
                    var serverName = currentCfg.addr + ":" + currentCfg.port;
                    if (!checkVersionCompatibility(client, currentCfg.scope, serverName)) {
                        // Version mismatch - disconnect and return null
                        try { client.disconnect(); } catch (e) {}
                        client = null;
                        return null;
                    }
                }
                
                backoffUntil = 0;
                return client;
            }
        } catch (e) {
            logWarn("connect failed addr=" + currentCfg.addr + " port=" + currentCfg.port + " err=" + e);
        }
        backoffUntil = now + currentCfg.backoffMs;
        client = null;
        return null;
    }
    
    function disconnect() {
        if (client) {
            try { client.disconnect(); } catch (e) {}
        }
        client = null;
    }
    
    function markFailure() {
        var cfg = currentCfg || resolveConfig();
        backoffUntil = nowMs() + (cfg.backoffMs || DEFAULT_BACKOFF_MS);
        disconnect();
    }
    
    /**
     * Get version mismatch error message, if any
     * Returns null if no mismatch, or error string if version check failed
     */
    function getVersionMismatchError() {
        return VERSION_MISMATCH_ERROR;
    }
    
    /**
     * Check if version check has been performed
     */
    function isVersionChecked() {
        return VERSION_CHECK_DONE;
    }
    
    /**
     * Get local version string
     */
    function getLocalVersion() {
        if (typeof NBA_JAM !== "undefined" && NBA_JAM.Version && NBA_JAM.Version.getCommitHash) {
            return NBA_JAM.Version.getCommitHash();
        }
        return "unknown";
    }
    
    this.LORB.JsonClientHelper = {
        ensureClient: ensureClient,
        disconnect: disconnect,
        markFailure: markFailure,
        getVersionMismatchError: getVersionMismatchError,
        isVersionChecked: isVersionChecked,
        getLocalVersion: getLocalVersion
    };
})();
