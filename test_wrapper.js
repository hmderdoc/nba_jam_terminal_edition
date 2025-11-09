/**
 * NBA JAM Test Wrapper for jsexec
 * 
 * This wrapper sets up a test environment for running the game in jsexec
 * without modifying the main game file.
 * 
 * Usage: jsexec test_wrapper.js
 */

// Mock console object for jsexec environment
if (typeof console === 'undefined' || typeof console.print !== 'function') {
    var console = {
        print: function (msg) { print(msg); },
        write: function (msg) { write(msg); },
        pause: function () { /* no-op in test mode */ },
        getkey: function (mode) { return ''; },
        inkey: function (mode, timeout) { return ''; },
        gotoxy: function (x, y) { /* no-op */ },
        clear: function () { print('\n'); },
        strlen: function (str) { return str ? str.length : 0; },
        putmsg: function (msg) { print(msg); },
        attributes: 7,
        screen_rows: 24,
        screen_columns: 80
    };
}

// Set test mode flag
var TEST_MODE = true;

// Override showSplashScreen to skip in test mode
var originalShowSplashScreen = null;
function mockShowSplashScreen() {
    print("=== TEST MODE: Skipping splash screen ===\n");
}

// Override mainMenu to auto-select demo mode
var originalMainMenu = null;
function mockMainMenu() {
    print("=== TEST MODE: Auto-selecting demo mode ===\n");
    return "demo";
}

// Override showIntro to skip in test mode
var originalShowIntro = null;
function mockShowIntro() {
    print("=== TEST MODE: Skipping intro ===\n");
}

// Store original functions and install mocks after game loads
function setupTestMocks() {
    if (typeof showSplashScreen !== 'undefined') {
        originalShowSplashScreen = showSplashScreen;
        showSplashScreen = mockShowSplashScreen;
    }
    if (typeof mainMenu !== 'undefined') {
        originalMainMenu = mainMenu;
        mainMenu = mockMainMenu;
    }
    if (typeof showIntro !== 'undefined') {
        originalShowIntro = showIntro;
        showIntro = mockShowIntro;
    }
}

print("===========================================\n");
print("NBA JAM - Test Mode (jsexec)\n");
print("===========================================\n");

// Load the main game
load(js.exec_dir + "nba_jam.js");

// Note: Mocks are installed, but main() hasn't run yet
// The game's main() will be called by the wrapper's wrappedMain()
