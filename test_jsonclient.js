// Direct JSONClient test
load("/sbbs/exec/load/json-client.js");

var output = (typeof console !== "undefined" && console.print) ? console.print : print;

output("Testing JSONClient...\r\n");

try {
    output("1. Creating JSONClient...\r\n");
    var client = new JSONClient("localhost", 10088);
    output("   Created\r\n");

    output("2. Checking initial socket state...\r\n");
    output("   socket exists: " + (client.socket !== undefined) + "\r\n");
    if (client.socket) {
        output("   socket.is_connected: " + client.socket.is_connected + "\r\n");
    }

    output("3. Calling connect()...\r\n");
    var result = client.connect();
    output("   connect() returned: " + result + "\r\n");

    output("4. Checking connected property...\r\n");
    output("   client.connected: " + client.connected + "\r\n");
    output("   client.socket.is_connected: " + client.socket.is_connected + "\r\n");

    if (client.connected) {
        output("\r\n\1g\1hSUCCESS!\1n JSONClient connected\r\n");

        output("\r\n5. Testing write...\r\n");
        client.write("nba_jam", "test_data", {message: "Hello!"}, 2);
        output("   Write OK\r\n");

        output("6. Testing read...\r\n");
        var data = client.read("nba_jam", "test_data", 1);
        output("   Read result: " + JSON.stringify(data) + "\r\n");

        client.disconnect();
    } else {
        output("\r\n\1r\1hFAILED\1n - Not connected\r\n");
    }
} catch (e) {
    output("\r\n\1r\1hEXCEPTION:\1n " + e + "\r\n");
    if (e.stack) output(e.stack + "\r\n");
}
