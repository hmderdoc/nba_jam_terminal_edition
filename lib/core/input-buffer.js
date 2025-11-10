/**
 * NBA JAM - Input Buffer System
 * 
 * Captures all key presses between frames to prevent input loss
 * Solves: Rapid key presses can be dropped if they occur between console.inkey() calls
 */

/**
 * Global input buffer
 * Stores all key presses that occurred since last frame
 */
var inputBuffer = [];

/**
 * Maximum buffer size (prevent memory issues)
 */
var MAX_INPUT_BUFFER_SIZE = 20;

/**
 * Add a key press to the buffer
 * @param {string|number} key - Key code or character
 */
function bufferInput(key) {
    if (!key) return;

    // Prevent buffer overflow
    if (inputBuffer.length >= MAX_INPUT_BUFFER_SIZE) {
        // Drop oldest input if buffer is full
        inputBuffer.shift();
    }

    inputBuffer.push(key);
}

/**
 * Capture all available input into buffer
 * Call this frequently (ideally every few milliseconds)
 */
function captureInput() {
    var key;
    var captured = 0;

    // Capture all waiting keys (non-blocking)
    while ((key = console.inkey(K_NONE, 0)) && captured < MAX_INPUT_BUFFER_SIZE) {
        bufferInput(key);
        captured++;
    }

    return captured;
}

/**
 * Get next input from buffer (FIFO)
 * @returns {string|number|null} Next key or null if buffer empty
 */
function getBufferedInput() {
    if (inputBuffer.length === 0) {
        return null;
    }

    return inputBuffer.shift();
}

/**
 * Process all buffered inputs
 * @param {Function} handler - Function to call for each input
 * @returns {number} Number of inputs processed
 */
function processInputBuffer(handler) {
    if (typeof handler !== "function") {
        log(LOG_WARNING, "NBA JAM: processInputBuffer() - handler must be a function");
        return 0;
    }

    var processed = 0;
    var input;

    while ((input = getBufferedInput()) !== null) {
        try {
            handler(input);
            processed++;
        } catch (e) {
            log(LOG_ERROR, "NBA JAM: Error processing buffered input: " + e);
        }
    }

    return processed;
}

/**
 * Clear the input buffer
 */
function clearInputBuffer() {
    inputBuffer = [];
}

/**
 * Get current buffer size
 * @returns {number} Number of buffered inputs
 */
function getInputBufferSize() {
    return inputBuffer.length;
}

/**
 * Check if buffer has inputs waiting
 * @returns {boolean} True if buffer has inputs
 */
function hasBufferedInput() {
    return inputBuffer.length > 0;
}
