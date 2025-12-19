// Test that mimics talk_show_view.js frame hierarchy and art loading
load("sbbsdefs.js");
load("frame.js");

print("=== Testing Frame Hierarchy Art Loading ===");
print("");

function file_exists(path) {
    var f = new File(path);
    return f.exists;
}

var artPath = "/sbbs/xtrn/nba_jam/assets/lorb/talkshow_default.bin";

print("Art path: " + artPath);
print("File exists: " + file_exists(artPath));

// Create same frame hierarchy as talk_show_view.js
var mainFrame = new Frame(1, 1, 80, 24, BG_BLACK);
mainFrame.open();
mainFrame.top();
print("mainFrame created and opened");

// Header zone: 80x4 at top
var headerFrame = new Frame(1, 1, 80, 4, BG_BLACK, mainFrame);
headerFrame.open();
print("headerFrame created");

// Art zone: 40x20 on left
var artFrame = new Frame(1, 5, 40, 20, BG_BLACK, mainFrame);
artFrame.open();
print("artFrame created");

// Content zone: 40x20 on right
var contentFrame = new Frame(41, 5, 40, 20, BG_BLACK, mainFrame);
contentFrame.open();
print("contentFrame created");

// Write header
headerFrame.gotoxy(2, 2);
headerFrame.putmsg("\1h\1wOPAL\1n");
print("Header written");

// Try to load art
print("");
print("Attempting to load art...");
var artFile = new File(artPath);
print("  File.exists: " + artFile.exists);

if (artFile.exists) {
    artFrame.clear(artFrame.attr);
    print("  Frame cleared");
    
    var loadResult = artFrame.load(artPath, 40, 20);
    print("  frame.load() returned: " + loadResult);
    print("  artFrame.data exists: " + (artFrame.data !== undefined));
    print("  artFrame.data.length: " + (artFrame.data ? artFrame.data.length : "N/A"));
} else {
    print("  Art file does not exist!");
}

// Write some content
contentFrame.gotoxy(2, 1);
contentFrame.putmsg("\1wTest dialogue line\1n");
print("Content written");

// Cycle to render
print("");
print("Calling mainFrame.cycle()...");
try {
    mainFrame.cycle();
    print("Cycle complete - SUCCESS");
} catch (e) {
    print("Cycle FAILED: " + e);
}

// Check what's in artFrame now
print("");
print("artFrame state after cycle:");
print("  width: " + artFrame.width);
print("  height: " + artFrame.height);

// Skip wait for input in headless mode
print("");
// print("Press any key to close frames and exit...");
// console.getkey();

// Cleanup
contentFrame.close();
artFrame.close();
headerFrame.close();
mainFrame.close();

print("Frames closed, test complete.");
