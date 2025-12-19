// Test that mimics talk_show_view.js loading pattern
load("sbbsdefs.js");
load("frame.js");

print("=== Testing FrameLightbar load pattern ===");
print("");

// Mimic the IIFE pattern from talk_show_view.js
(function() {
    var LIB_PATH = "/sbbs/xtrn/nba_jam/lib/";
    var _frameLightbarLoaded = false;
    
    print("Inside IIFE...");
    print("Before load: typeof FrameLightbar = " + typeof FrameLightbar);
    
    try {
        load(LIB_PATH + "ui/frame-lightbar.js");
        _frameLightbarLoaded = (typeof FrameLightbar === "function");
        print("After load: typeof FrameLightbar = " + typeof FrameLightbar);
        print("_frameLightbarLoaded = " + _frameLightbarLoaded);
    } catch (e) {
        print("ERROR loading: " + e);
    }
    
    // Now check again (as would happen in present())
    print("");
    print("Later check: typeof FrameLightbar = " + typeof FrameLightbar);
    
    if (typeof FrameLightbar === "function") {
        print("SUCCESS - FrameLightbar is a function!");
        print("Attempting to create instance...");
        try {
            // This needs a console, which jsexec doesn't have
            // But at least we know the function is available
            print("FrameLightbar.prototype exists: " + (FrameLightbar.prototype !== undefined));
        } catch (e) {
            print("Instance creation error (expected without console): " + e);
        }
    } else {
        print("FAILURE - FrameLightbar is NOT a function");
    }
})();

print("");
print("=== Test Complete ===");
