/**
 * NBA JAM - Input Validation Utilities
 * 
 * Provides validation functions for external data (network, user input, etc.)
 * Created in Wave 21 to address security and stability concerns.
 * 
 * Key Functions:
 * - validatePlayerPosition: Validate x/y coordinates are within court bounds
 * - validatePlayerId: Validate player ID format and existence
 * - validateGameState: Validate game state data structure
 * - sanitizeString: Remove dangerous characters from strings
 * - isValidNumber: Check if value is a valid finite number
 */

/**
 * Validate player position coordinates
 * Ensures x/y are within court boundaries
 * 
 * @param {number} x - X coordinate to validate
 * @param {number} y - Y coordinate to validate
 * @param {object} [options] - Optional validation context
 * @param {boolean} [options.allowOffcourt] - Allow small off-court offsets (e.g. inbound setup)
 * @returns {object} { valid: boolean, x: number, y: number } - Clamped coordinates
 */
function validatePlayerPosition(x, y, options) {
    options = options || {};

    // Check if inputs are valid numbers
    if (!isValidNumber(x) || !isValidNumber(y)) {
        return {
            valid: false,
            x: COURT_WIDTH / 2,  // Default to center
            y: COURT_HEIGHT / 2,
            error: "Invalid coordinates (not numbers)"
        };
    }

    var allowOffcourt = options.allowOffcourt === true;
    var minX = 0;
    var maxX = COURT_WIDTH;
    var minY = allowOffcourt ? -6 : 0;
    var maxY = COURT_HEIGHT;

    // Clamp to court boundaries
    var clampedX = clamp(x, minX, maxX);
    var clampedY = clamp(y, minY, maxY);

    // Check if clamping was needed
    var wasClamped = (clampedX !== x || clampedY !== y);

    return {
        valid: !wasClamped,
        x: clampedX,
        y: clampedY,
        error: wasClamped ? "Coordinates out of bounds (clamped)" : null
    };
}

/**
 * Validate player ID format
 * Ensures ID is a non-empty string with safe characters
 * 
 * @param {string} playerId - Player ID to validate
 * @returns {object} { valid: boolean, playerId: string, error: string }
 */
function validatePlayerId(playerId) {
    // Check type
    if (typeof playerId !== "string") {
        return {
            valid: false,
            playerId: null,
            error: "Player ID must be a string"
        };
    }

    // Check length
    if (playerId.length === 0 || playerId.length > 50) {
        return {
            valid: false,
            playerId: null,
            error: "Player ID length invalid (0 or >50)"
        };
    }

    // Check for dangerous characters (allow only alphanumeric, dash, underscore)
    if (!/^[a-zA-Z0-9_-]+$/.test(playerId)) {
        return {
            valid: false,
            playerId: null,
            error: "Player ID contains invalid characters"
        };
    }

    return {
        valid: true,
        playerId: playerId,
        error: null
    };
}

/**
 * Check if value is a valid finite number
 * 
 * @param {*} value - Value to check
 * @returns {boolean} True if valid finite number
 */
function isValidNumber(value) {
    return typeof value === "number" && isFinite(value) && !isNaN(value);
}

/**
 * Validate attribute value (0-10 range)
 * 
 * @param {number} value - Attribute value to validate
 * @returns {object} { valid: boolean, value: number, error: string }
 */
function validateAttribute(value) {
    if (!isValidNumber(value)) {
        return {
            valid: false,
            value: 5,  // Default to middle
            error: "Attribute must be a number"
        };
    }

    var clamped = clamp(value, 0, 10);
    var wasClamped = (clamped !== value);

    return {
        valid: !wasClamped,
        value: clamped,
        error: wasClamped ? "Attribute out of range (clamped to 0-10)" : null
    };
}

/**
 * Validate velocity values
 * Ensures dx/dy are reasonable (not infinite or extreme)
 * 
 * @param {number} dx - Delta X velocity
 * @param {number} dy - Delta Y velocity
 * @returns {object} { valid: boolean, dx: number, dy: number, error: string }
 */
function validateVelocity(dx, dy) {
    if (!isValidNumber(dx) || !isValidNumber(dy)) {
        return {
            valid: false,
            dx: 0,
            dy: 0,
            error: "Velocity must be numbers"
        };
    }

    // Clamp to reasonable maximum (prevent teleporting)
    var maxVelocity = 5;  // Max 5 units per frame
    var clampedDx = clamp(dx, -maxVelocity, maxVelocity);
    var clampedDy = clamp(dy, -maxVelocity, maxVelocity);

    var wasClamped = (clampedDx !== dx || clampedDy !== dy);

    return {
        valid: !wasClamped,
        dx: clampedDx,
        dy: clampedDy,
        error: wasClamped ? "Velocity too high (clamped)" : null
    };
}

/**
 * Sanitize string input
 * Removes dangerous characters that could cause issues
 * 
 * @param {string} input - String to sanitize
 * @param {number} maxLength - Maximum allowed length (default 100)
 * @returns {string} Sanitized string
 */
function sanitizeString(input, maxLength) {
    if (typeof input !== "string") return "";

    maxLength = maxLength || 100;

    // Remove control characters and limit length
    var sanitized = input
        .replace(/[\x00-\x1F\x7F]/g, "")  // Remove control chars
        .substring(0, maxLength);

    return sanitized;
}

/**
 * Validate team name
 * Ensures team is "teamA" or "teamB"
 * 
 * @param {string} teamName - Team name to validate
 * @returns {object} { valid: boolean, teamName: string, error: string }
 */
function validateTeamName(teamName) {
    if (teamName !== "teamA" && teamName !== "teamB") {
        return {
            valid: false,
            teamName: "teamA",  // Default
            error: "Invalid team name (must be teamA or teamB)"
        };
    }

    return {
        valid: true,
        teamName: teamName,
        error: null
    };
}

/**
 * Validate network packet structure
 * Ensures packet has required fields
 * 
 * @param {object} packet - Network packet to validate
 * @param {array} requiredFields - Array of required field names
 * @returns {object} { valid: boolean, error: string }
 */
function validatePacket(packet, requiredFields) {
    // Check packet exists and is object
    if (!packet || typeof packet !== "object") {
        return {
            valid: false,
            error: "Packet must be an object"
        };
    }

    // Check required fields
    for (var i = 0; i < requiredFields.length; i++) {
        var field = requiredFields[i];
        if (!(field in packet)) {
            return {
                valid: false,
                error: "Missing required field: " + field
            };
        }
    }

    return {
        valid: true,
        error: null
    };
}

/**
 * Validate timestamp (prevent time travel exploits)
 * 
 * @param {number} timestamp - Timestamp to validate
 * @param {number} maxDriftMs - Maximum allowed time drift in ms (default 5000)
 * @returns {object} { valid: boolean, timestamp: number, error: string }
 */
function validateTimestamp(timestamp, maxDriftMs) {
    if (!isValidNumber(timestamp)) {
        return {
            valid: false,
            timestamp: Date.now(),
            error: "Timestamp must be a number"
        };
    }

    maxDriftMs = maxDriftMs || 5000;  // Default 5 second tolerance
    var now = Date.now();
    var diff = Math.abs(timestamp - now);

    if (diff > maxDriftMs) {
        return {
            valid: false,
            timestamp: now,
            error: "Timestamp drift too high: " + diff + "ms (max " + maxDriftMs + "ms)"
        };
    }

    return {
        valid: true,
        timestamp: timestamp,
        error: null
    };
}

/**
 * Validate player update packet from network
 * Comprehensive validation for multiplayer player state
 * 
 * @param {object} data - Player update packet
 * @returns {object} { valid: boolean, data: object, errors: array }
 */
function validatePlayerUpdate(data) {
    var errors = [];
    var validatedData = {};

    // Validate packet structure
    var packetCheck = validatePacket(data, ["playerId", "x", "y"]);
    if (!packetCheck.valid) {
        errors.push(packetCheck.error);
        return { valid: false, data: null, errors: errors };
    }

    // Validate player ID
    var idCheck = validatePlayerId(data.playerId);
    if (!idCheck.valid) {
        errors.push(idCheck.error);
    }
    validatedData.playerId = idCheck.playerId;

    // Validate position
    var posCheck = validatePlayerPosition(data.x, data.y, {
        allowOffcourt: !!data.allowOffcourt
    });
    if (!posCheck.valid) {
        errors.push(posCheck.error);
    }
    validatedData.x = posCheck.x;
    validatedData.y = posCheck.y;

    // Validate velocity if present
    if ("dx" in data || "dy" in data) {
        var velCheck = validateVelocity(data.dx || 0, data.dy || 0);
        if (!velCheck.valid) {
            errors.push(velCheck.error);
        }
        validatedData.dx = velCheck.dx;
        validatedData.dy = velCheck.dy;
    }

    // Validate timestamp if present
    if ("timestamp" in data) {
        var timeCheck = validateTimestamp(data.timestamp);
        if (!timeCheck.valid) {
            errors.push(timeCheck.error);
        }
        validatedData.timestamp = timeCheck.timestamp;
    }

    return {
        valid: errors.length === 0,
        data: validatedData,
        errors: errors
    };
}
