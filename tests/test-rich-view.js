/**
 * Test script for RichView system
 * Run with: /sbbs/exec/jsexec /sbbs/xtrn/nba_jam/tests/test-rich-view.js
 */

load("sbbsdefs.js");
load("frame.js");

// Load RichView from nba_jam lib
load("/sbbs/xtrn/nba_jam/lib/ui/rich-view.js");

console.clear();

// Test 1: artLeft preset with debug colors
print("Test 1: 'artLeft' preset - DEBUG mode");
print("Art=BLUE, Content=GREEN, Footer=RED");
print("Press any key...");
console.getkey();

var view1 = new RichView({
    preset: "artLeft",
    theme: "lorb",
    debug: true
});

view1.header("MAIN MENU");
view1.blank();
view1.line("Content zone is on the right.");
view1.line("Art zone (blue) is on the left.");
view1.line("Footer (red) is at bottom.");
view1.blank();

var choice1 = view1.menu([
    { text: "Option One", value: "1", hotkey: "O" },
    { text: "Second Choice", value: "2", hotkey: "S" },
    { text: "Quit", value: "Q", hotkey: "Q" }
]);

view1.close();
console.clear();
print("Selected: " + choice1);
print("");

// Test 2: artRight preset
print("Test 2: 'artRight' preset - Content LEFT, Art RIGHT");
print("Press any key...");
console.getkey();

var view2 = new RichView({
    preset: "artRight",
    theme: "fire",
    debug: true
});

view2.header("ART ON RIGHT");
view2.line("Content is now on the LEFT.");
view2.blank();

var choice2 = view2.menu([
    { text: "Play", value: "play", hotkey: "P" },
    { text: "Exit", value: "exit", hotkey: "E" }
]);

view2.close();
console.clear();
print("Selected: " + choice2);
print("");

// Test 3: artLeftHeaderRight - header banner above content
print("Test 3: 'artLeftHeaderRight' - Header above content");
print("Header=MAGENTA, Content=GREEN, Art=BLUE, Footer=RED");
print("Press any key...");
console.getkey();

var view3 = new RichView({
    preset: "artLeftHeaderRight",
    theme: "ice",
    debug: true
});

// Draw something in header zone
view3.drawAt("header", 1, 1, "\1h\1cHEADER BANNER ZONE\1n");

view3.header("MENU TITLE");
view3.line("Content zone is smaller (16 rows).");
view3.line("Header is above it (4 rows).");
view3.blank();

var choice3 = view3.menu([
    { text: "Continue", value: "c", hotkey: "C" },
    { text: "Back", value: "b", hotkey: "B" }
]);

view3.close();
console.clear();
print("Selected: " + choice3);
print("");

// Test 4: headerTop - full width header
print("Test 4: 'headerTop' - Full width header at top");
print("Press any key...");
console.getkey();

var view4 = new RichView({
    preset: "headerTop",
    theme: "matrix",
    debug: true
});

view4.drawAt("header", 30, 1, "\1h\1gFULL WIDTH HEADER\1n");

view4.header("CONTENT AREA");
view4.line("Header spans full 80 columns.");
view4.line("Art and content are below it.");
view4.blank();

var choice4 = view4.menu([
    { text: "OK", value: "ok", hotkey: "O" }
]);

view4.close();
console.clear();
print("Selected: " + choice4);
print("");

// Test 5: Custom zones
print("Test 5: Custom zone layout");
print("Press any key...");
console.getkey();

var view5 = new RichView({
    zones: [
        { name: "topBanner", x: 1, y: 1, width: 80, height: 3 },
        { name: "leftArt", x: 1, y: 4, width: 30, height: 18 },
        { name: "content", x: 31, y: 4, width: 50, height: 18 },
        { name: "bottomBanner", x: 1, y: 22, width: 80, height: 3 }
    ],
    theme: "lorb",
    debug: true
});

view5.drawAt("topBanner", 30, 1, "\1h\1yTOP BANNER\1n");
view5.drawAt("bottomBanner", 30, 1, "\1h\1rBOTTOM BANNER\1n");

view5.header("CUSTOM LAYOUT");
view5.line("This uses custom zone definitions.");
view5.line("Art zone is 30 wide, content is 50.");
view5.blank();

var choice5 = view5.menu([
    { text: "Nice!", value: "nice", hotkey: "N" },
    { text: "Done", value: "done", hotkey: "D" }
]);

view5.close();
console.clear();
print("Selected: " + choice5);
print("");

// Test 6: No debug - normal appearance
print("Test 6: Normal mode (no debug colors)");
print("Press any key...");
console.getkey();

var view6 = new RichView({
    preset: "artLeft",
    theme: "default",
    debug: false
});

view6.header("NORMAL VIEW");
view6.blank();
view6.line("This is how it looks in production.");
view6.line("No colored zone backgrounds.");
view6.blank();
view6.info("Info text is cyan.");
view6.warn("Warning text is red.");
view6.blank();

var choice6 = view6.menu([
    { text: "Finish Tests", value: "done", hotkey: "F" }
]);

view6.close();
console.clear();

print("All tests complete!");
print("");
print("Available presets: " + RichView.getPresets().join(", "));
print("");
print("Press any key to exit...");
console.getkey();
