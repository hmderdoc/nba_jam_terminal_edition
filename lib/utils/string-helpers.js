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
 * Center-align a string within a specified width
 * @param {string} str - String to center
 * @param {number} width - Total width
 * @param {string} padChar - Character to pad with (default: space)
 * @returns {string} Centered string
 */
function padCenter(str, width, padChar) {
    str = String(str);
    padChar = padChar || " ";
    if (str.length >= width) return str.substring(0, width);
    
    var leftPad = Math.floor((width - str.length) / 2);
    var rightPad = width - str.length - leftPad;
    
    return repeatChar(padChar, leftPad) + str + repeatChar(padChar, rightPad);
}

/**
 * Repeat a character a specified number of times
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
 * Format a number with leading zeros
 * @param {number} num - Number to format
 * @param {number} digits - Minimum number of digits
 * @returns {string} Zero-padded number
 */
function formatNumber(num, digits) {
    return padStart(String(num), digits || 2, "0");
}

/**
 * Format time in MM:SS format
 * @param {number} seconds - Total seconds
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
    var mins = Math.floor(seconds / 60);
    var secs = seconds % 60;
    return formatNumber(mins, 2) + ":" + formatNumber(secs, 2);
}

/**
 * Truncate string to max length with optional ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @param {boolean} useEllipsis - Add "..." if truncated (default: false)
 * @returns {string} Truncated string
 */
function truncateString(str, maxLength, useEllipsis) {
    str = String(str);
    if (str.length <= maxLength) return str;
    
    if (useEllipsis && maxLength > 3) {
        return str.substring(0, maxLength - 3) + "...";
    }
    return str.substring(0, maxLength);
}

/**
 * Create a horizontal line/border
 * @param {string} char - Character to use (default: "=")
 * @param {number} length - Length of line
 * @returns {string} Horizontal line
 */
function horizontalLine(char, length) {
    return repeatChar(char || "=", length);
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
