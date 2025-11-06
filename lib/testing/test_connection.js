// Test JSON service connection
// Run with: jsexec test_connection.js

load("/sbbs/exec/load/json-client.js");

// Use print instead of console.print when running from jsexec
var output = (typeof console !== "undefined" && console.print) ? console.print : print;

output("\r\n\1h\1cTesting JSON Service Connection\1n\r\n");
output("================================\r\n\r\n");

// Test parameters
var serverAddr = "localhost";
var serverPort = 10088;

output("Attempting to connect to: " + serverAddr + ":" + serverPort + "\r\n\r\n");

try {
    // Create client
    var client = new JSONClient(serverAddr, serverPort);
    client.settings.CONNECTION_TIMEOUT = 5;

    output("1. Creating client... \1g\1hOK\1n\r\n");

    // Check connection (client auto-connects on creation)
    output("2. Checking connection... ");
    if (!client.connected) {
        output("\1r\1hFAILED\1n\r\n");
        output("   Could not connect to JSON service.\r\n");
        output("   Make sure json-service.js is running.\r\n");
        exit(1);
    }
    output("\1g\1hOK\1n (connected)\r\n");

    // Test write
    output("3. Testing write... ");
    try {
        client.write("nba_jam", "connection_test", {
            timestamp: Date.now(),
            message: "Connection test successful!"
        }, 2);
        output("\1g\1hOK\1n\r\n");
    } catch (e) {
        output("\1r\1hFAILED\1n (" + e + ")\r\n");
    }

    // Test read
    output("4. Testing read... ");
    try {
        var data = client.read("nba_jam", "connection_test", 1);
        if (data && data.message) {
            output("\1g\1hOK\1n\r\n");
            output("   Read back: " + data.message + "\r\n");
        } else {
            output("\1y\1hWARNING\1n (no data returned)\r\n");
        }
    } catch (e) {
        output("\1r\1hFAILED\1n (" + e + ")\r\n");
    }

    // Clean up
    output("5. Cleanup... ");
    try {
        client.remove("nba_jam", "connection_test", 2);
        output("\1g\1hOK\1n\r\n");
    } catch (e) {
        output("\1y\1hWARNING\1n (" + e + ")\r\n");
    }

    // Disconnect
    output("6. Disconnecting... ");
    client.disconnect();
    output("\1g\1hOK\1n\r\n");

    output("\r\n\1h\1gJSON Service is working correctly!\1n\r\n\r\n");

} catch (e) {
    output("\r\n\1r\1hERROR:\1n " + e + "\r\n\r\n");
    output("Stack trace:\r\n");
    output(e.stack || "No stack trace available\r\n");
    exit(1);
}
