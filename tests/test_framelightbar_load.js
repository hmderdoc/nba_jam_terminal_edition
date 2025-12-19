// Test if FrameLightbar loads as a function
load("sbbsdefs.js");
load("frame.js");

var js_dir = js.exec_dir;
print("Script running from: " + js_dir);
load(js_dir + "../lib/ui/frame-lightbar.js");

print("FrameLightbar type: " + typeof FrameLightbar);
print("Is function: " + (typeof FrameLightbar === "function"));

// Try to create one with a mock frame
try {
    // Frame needs a parent console object in Synchronet
    // When run outside BBS, console is not defined
    // Let's see exactly where it fails
    print("Step 1: Creating Frame");
    var testFrame = new Frame(1, 1, 40, 20);
    print("Step 2: Frame created: " + (testFrame !== undefined));
    
    print("Step 3: About to create FrameLightbar");
    var lightbar = new FrameLightbar({
        frame: testFrame,
        x: 2,
        y: 2,
        width: 36,
        height: 10,
        items: [{ text: "Test", value: "test" }]
    });
    print("Step 4: FrameLightbar created: " + (lightbar !== undefined));
    print("Step 5: FrameLightbar.add type: " + typeof lightbar.add);
} catch (e) {
    print("ERROR creating FrameLightbar: " + e);
    if (e.stack) print("Stack: " + e.stack);
}

print("\n=== TEST COMPLETE ===");
