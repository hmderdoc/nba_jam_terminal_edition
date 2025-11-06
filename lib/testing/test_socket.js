// Direct socket test
var output = (typeof console !== "undefined" && console.print) ? console.print : print;

output("Testing direct socket connection to localhost:10088...\r\n");

try {
    var sock = new Socket();
    output("1. Socket created\r\n");

    output("2. Connecting...\r\n");
    var result = sock.connect("localhost", 10088, 5);

    if (result) {
        output("\1g\1hSUCCESS!\1n Socket connected\r\n");
        output("   is_connected: " + sock.is_connected + "\r\n");
        sock.close();
    } else {
        output("\1r\1hFAILED\1n\r\n");
        output("   Error code: " + sock.error + "\r\n");
        output("   Error string: " + sock.error_str + "\r\n");
    }
} catch (e) {
    output("\1r\1hEXCEPTION:\1n " + e + "\r\n");
    if (e.stack) output(e.stack + "\r\n");
}
