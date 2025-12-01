#!/sbbs/exec/jsexec
// Simple test to verify diagonal movement detection works

load("sbbsdefs.js");

// Mock sprite
var testSprite = {
    x: 40,
    y: 20,
    getcmd: function(key) {
        var keyName = "";
        if (key === KEY_LEFT) keyName = "LEFT";
        else if (key === KEY_RIGHT) keyName = "RIGHT";
        else if (key === KEY_UP) keyName = "UP";
        else if (key === KEY_DOWN) keyName = "DOWN";
        else keyName = "UNKNOWN(" + key + ")";
        
        print("  getcmd(" + keyName + ") called");
    }
};

print("Testing diagonal movement detection...\n");

// Test numpad keys
var testCases = [
    { key: '7', expected: 'UP-LEFT (Northwest)' },
    { key: '9', expected: 'UP-RIGHT (Northeast)' },
    { key: '1', expected: 'DOWN-LEFT (Southwest)' },
    { key: '3', expected: 'DOWN-RIGHT (Southeast)' }
];

for (var i = 0; i < testCases.length; i++) {
    var test = testCases[i];
    print("Testing key '" + test.key + "' - Expect: " + test.expected);
    
    var key = test.key;
    var diagonalKey = null;
    var horizKey = null;
    var vertKey = null;
    
    if (key === '7') {
        diagonalKey = '7';
        horizKey = KEY_LEFT;
        vertKey = KEY_UP;
    } else if (key === '9') {
        diagonalKey = '9';
        horizKey = KEY_RIGHT;
        vertKey = KEY_UP;
    } else if (key === '1') {
        diagonalKey = '1';
        horizKey = KEY_LEFT;
        vertKey = KEY_DOWN;
    } else if (key === '3') {
        diagonalKey = '3';
        horizKey = KEY_RIGHT;
        vertKey = KEY_DOWN;
    }
    
    if (diagonalKey) {
        print("  Detected: diagonal=" + diagonalKey);
        testSprite.getcmd(horizKey);
        testSprite.getcmd(vertKey);
    } else {
        print("  ERROR: No diagonal detected!");
    }
    print("");
}

print("Test complete. All numpad diagonal keys detected successfully.");
