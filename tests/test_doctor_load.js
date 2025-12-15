// Test that doctor.js loads correctly
var result = { success: false, error: null };
try {
    load("/sbbs/xtrn/nba_jam/lib/lorb/locations/doctor.js");
    result.success = true;
    if (typeof LORB !== "undefined" && LORB.Locations && LORB.Locations.Doctor) {
        print("doctor.js loaded OK");
        var keys = [];
        for (var k in LORB.Locations.Doctor) keys.push(k);
        print("Functions available: " + keys.join(", "));
    } else {
        print("doctor.js loaded but LORB.Locations.Doctor not found");
    }
} catch(e) {
    result.error = e.message + " at Line " + e.lineNumber;
    print("ERROR loading doctor.js: " + result.error);
}
