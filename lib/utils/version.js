/**
 * version.js - Game version management for client/server compatibility
 * 
 * Uses git commit hash as the version identifier.
 * Server publishes its version to JSON service; clients check on connect.
 */
(function() {
    var VERSION_CACHE = null;
    var GAME_ROOT = js.exec_dir.replace(/lib[\/\\]utils[\/\\]?$/, "");
    
    /**
     * Get the current git commit hash (short form)
     * Falls back to "unknown" if git not available or not a git repo
     */
    function getGitCommitHash() {
        if (VERSION_CACHE !== null) return VERSION_CACHE;
        
        try {
            // Try to read from .git/HEAD
            var headFile = new File(GAME_ROOT + ".git/HEAD");
            if (!headFile.exists) {
                VERSION_CACHE = "unknown";
                return VERSION_CACHE;
            }
            
            if (!headFile.open("r")) {
                VERSION_CACHE = "unknown";
                return VERSION_CACHE;
            }
            
            var headContent = headFile.read().trim();
            headFile.close();
            
            // Check if it's a ref or direct hash
            if (headContent.indexOf("ref: ") === 0) {
                // It's a reference like "ref: refs/heads/main"
                var refPath = headContent.substring(5);
                var refFile = new File(GAME_ROOT + ".git/" + refPath);
                if (refFile.exists && refFile.open("r")) {
                    var hash = refFile.read().trim();
                    refFile.close();
                    VERSION_CACHE = hash.substring(0, 8); // Short hash
                    return VERSION_CACHE;
                }
            } else {
                // Direct hash (detached HEAD)
                VERSION_CACHE = headContent.substring(0, 8);
                return VERSION_CACHE;
            }
        } catch (e) {
            if (typeof debugLog === "function") {
                debugLog("[VERSION] Failed to read git hash: " + e);
            }
        }
        
        VERSION_CACHE = "unknown";
        return VERSION_CACHE;
    }
    
    /**
     * Get full version info object
     */
    function getVersionInfo() {
        return {
            commit: getGitCommitHash(),
            timestamp: Date.now()
        };
    }
    
    /**
     * Check if two versions are compatible
     * Currently: exact match required
     */
    function isCompatible(clientVersion, serverVersion) {
        if (!clientVersion || !serverVersion) return false;
        if (clientVersion === "unknown" || serverVersion === "unknown") return true; // Skip check if unknown
        return clientVersion === serverVersion;
    }
    
    /**
     * Format version mismatch error message
     */
    function formatMismatchError(serverName, clientVersion, serverVersion) {
        return "Cannot connect to LORB at " + serverName + " due to version mismatch.\n" +
               "Your version: " + clientVersion + "\n" +
               "Server version: " + serverVersion + "\n\n" +
               "Tell your sysop to update to version " + serverVersion + " to connect to this game.";
    }
    
    // Export
    if (typeof this.NBA_JAM === "undefined") this.NBA_JAM = {};
    this.NBA_JAM.Version = {
        getCommitHash: getGitCommitHash,
        getVersionInfo: getVersionInfo,
        isCompatible: isCompatible,
        formatMismatchError: formatMismatchError
    };
})();
