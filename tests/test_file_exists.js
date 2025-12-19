print("Testing file_exists availability...");
print("typeof file_exists: " + typeof file_exists);

if (typeof file_exists === "function") {
    print("file_exists is available!");
    print("Test /sbbs/ctrl/sbbs.ini: " + file_exists("/sbbs/ctrl/sbbs.ini"));
} else {
    print("file_exists is NOT defined");
    print("Checking File object...");
    var f = new File("/sbbs/ctrl/sbbs.ini");
    print("File.exists: " + f.exists);
}
