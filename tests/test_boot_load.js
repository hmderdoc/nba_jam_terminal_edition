// Test that boot.js loads all modules correctly
var result = { success: false, error: null };
try {
    load("/sbbs/xtrn/nba_jam/lib/lorb/boot.js");
    result.success = true;
    
    print("LORB namespace loaded");
    
    // Check if BabyBallers loaded
    if (LORB.Data && LORB.Data.BabyBallers) {
        print("✓ LORB.Data.BabyBallers loaded");
        var keys = [];
        for (var k in LORB.Data.BabyBallers) {
            if (typeof LORB.Data.BabyBallers[k] === "function") keys.push(k);
        }
        print("  Functions: " + keys.slice(0, 10).join(", ") + (keys.length > 10 ? "... +" + (keys.length - 10) + " more" : ""));
    } else {
        print("✗ LORB.Data.BabyBallers NOT found");
    }
    
    // Check if Doctor loaded
    if (LORB.Locations && LORB.Locations.Doctor) {
        print("✓ LORB.Locations.Doctor loaded");
    } else {
        print("✗ LORB.Locations.Doctor NOT found");
    }
    
    // Check Romance (for pregnancy functions)
    if (LORB.Data && LORB.Data.Romance) {
        print("✓ LORB.Data.Romance loaded");
        if (LORB.Data.Romance.checkForPregnancy) {
            print("  ✓ checkForPregnancy function available");
        } else {
            print("  ✗ checkForPregnancy function NOT found");
        }
    } else {
        print("✗ LORB.Data.Romance NOT found");
    }
    
} catch(e) {
    result.error = e.message + " at Line " + e.lineNumber;
    print("ERROR loading boot.js: " + result.error);
}
