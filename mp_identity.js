// mp_identity.js - Multiplayer Identity System
// Handles player identification for same-BBS and inter-BBS play

// Create a globally unique player identifier
function createPlayerIdentifier(userNum, bbsInfo) {
    var bbs = bbsInfo || {
        name: system.name,
        qwkId: system.qwk_id || system.name.substr(0, 4).toUpperCase(),
        host: system.inet_addr || "localhost"
    };

    var usr = userNum ? new User(userNum) : user;

    return {
        // BBS identification
        bbsName: bbs.name,
        bbsQwkId: bbs.qwkId,
        bbsHost: bbs.host,

        // User identification
        userNum: usr.number,
        userName: usr.alias,
        userIp: usr.ip_address,

        // Global composite ID (used for lookups)
        globalId: bbs.qwkId + "_" + usr.number,

        // Display name for UI
        displayName: usr.alias,
        displayFull: usr.alias + "@" + bbs.name,

        // Timestamp
        created: Date.now()
    };
}

// Parse a global ID back into components
function parseGlobalId(globalId) {
    if (!globalId || typeof globalId !== "string") return null;

    var parts = globalId.split("_");
    if (parts.length !== 2) return null;

    return {
        bbsQwkId: parts[0],
        userNum: parseInt(parts[1])
    };
}

// Check if a player is local to this BBS
function isLocalPlayer(playerId) {
    var parsed = parseGlobalId(playerId.globalId || playerId);
    if (!parsed) return false;

    var myQwkId = system.qwk_id || system.name.substr(0, 4).toUpperCase();
    return parsed.bbsQwkId === myQwkId;
}

// Get short display name (for UI space constraints)
function getShortDisplayName(playerId, maxLength) {
    maxLength = maxLength || 12;
    var name = playerId.userName || playerId.displayName || "Unknown";

    if (name.length <= maxLength) {
        return name;
    }

    return name.substr(0, maxLength - 1) + ".";
}

// Get display name with BBS indicator
function getDisplayNameWithBBS(playerId, showBBSAlways) {
    var name = playerId.userName || playerId.displayName || "Unknown";

    // Only show BBS suffix for remote players (unless forced)
    if (!showBBSAlways && isLocalPlayer(playerId)) {
        return name;
    }

    var bbsTag = "@" + (playerId.bbsQwkId || playerId.bbsName || "???");
    return name + bbsTag;
}
