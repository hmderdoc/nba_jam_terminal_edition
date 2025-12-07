/**
 * Test Runner for Wave 22A Bug Fixes
 * 
 * Runs all tests to demonstrate bugs before fixes are applied
 */

print("========================================");
print("  Wave 22A Critical Bug Test Suite");
print("========================================\n");

var testsPassed = 0;
var testsFailed = 0;

function runTest(testFile, description) {
    print("Running: " + description);
    print("File: " + testFile);
    print("----------------------------------------");

    try {
        load(testFile);
        testsPassed++;
        print("✅ TEST PASSED\n");
    } catch (e) {
        testsFailed++;
        print("❌ TEST FAILED: " + e + "\n");
    }
}

// Run all bug reproduction tests
runTest("test-rebound-flow.js", "Rebound Flow Unit Test");

print("========================================");
print("  Test Summary");
print("========================================");
print("Passed: " + testsPassed);
print("Failed: " + testsFailed);
print("\nThese tests demonstrate the bugs present");
print("in the current code. After applying fixes,");
print("re-run this suite to validate the repairs.");
