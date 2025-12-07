/**
 * string-helpers.js
 * 
 * Centralized string manipulation and formatting utilities.
 * Consolidates padding, alignment, and formatting logic across the codebase.
 */

/**
 * Pad a string at the start with a specified character
 * @param {string} str - String to pad
 * @param {number} length - Desired total length
 * @param {string} padChar - Character to pad with (default: space)
 * @returns {string} Padded string
 */
function padStart(str, length, padChar) {
    str = String(str);
    padChar = padChar || " ";
    while (str.length < length) {
        str = padChar + str;
    }
    return str;
}

/**
 * Pad a string at the end with a specified character
 * @param {string} str - String to pad
 * @param {number} length - Desired total length
 * @param {string} padChar - Character to pad with (default: space)
 * @returns {string} Padded string
 */
function padEnd(str, length, padChar) {
    str = String(str);
    padChar = padChar || " ";
    while (str.length < length) {
        str = str + padChar;
    }
    return str;
}

/**
 * Repeat a character a specified number of times
 * Kept as a shared helper for UI code (menus, etc.)
 * @param {string} ch - Character to repeat
 * @param {number} count - Number of repetitions
 * @returns {string} Repeated character string
 */
function repeatChar(ch, count) {
    var out = "";
    for (var i = 0; i < count; i++) out += ch;
    return out;
}

/**
 * Get current time in milliseconds
 * Cross-platform compatible time function for Synchronet
 * @returns {number} Current time in milliseconds
 */
function getTimeMs() {
    if (typeof Date !== "undefined" && Date.now) {
        return Date.now();
    }
    if (typeof time === "function") {
        var t = time();
        if (typeof t === "number") {
            return t * 1000;
        }
    }
    if (typeof system !== "undefined" && typeof system.timer === "number") {
        return system.timer * 1000;
    }
    return 0;
}
