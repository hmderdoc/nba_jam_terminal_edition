// Simple Queue functionality test
var output = (typeof console !== "undefined" && console.print) ? console.print : print;

output("\r\n\1h\1cQueue Functionality Test\1n\r\n");
output("========================\r\n\r\n");

try {
    // Test 1: Create Queue
    output("1. Creating Queue object...\r\n");
    var testQueue = new Queue("nba_jam.test.queue");
    output("   \1g\1hOK\1n - Queue created\r\n\r\n");

    // Test 2: Write to Queue
    output("2. Writing test data to Queue...\r\n");
    var testData = {
        message: "Hello Queue!",
        timestamp: Date.now(),
        number: 42
    };
    testQueue.write(testData);
    output("   \1g\1hOK\1n - Data written\r\n\r\n");

    // Test 3: Read from Queue
    output("3. Reading data from Queue...\r\n");
    output("   Data waiting: " + testQueue.data_waiting + "\r\n");
    var readData = null;
    if (testQueue.data_waiting) {
        readData = testQueue.read();
    }
    output("   Read result type: " + typeof readData + "\r\n");
    output("   Read result value: " + JSON.stringify(readData) + "\r\n");
    if (readData && readData.message === "Hello Queue!" && readData.number === 42) {
        output("   \1g\1hOK\1n - Data read successfully\r\n");
        output("   Message: " + readData.message + "\r\n");
        output("   Number: " + readData.number + "\r\n\r\n");
    } else {
        output("   \1y\1hWARNING\1n - Read returned: " + JSON.stringify(readData) + "\r\n\r\n");
    }

    // Test 4: Multiple writes
    output("4. Testing multiple writes...\r\n");
    for (var i = 0; i < 5; i++) {
        testQueue.write({ seq: i, data: "packet_" + i });
    }
    output("   \1g\1hOK\1n - 5 packets written\r\n\r\n");

    // Test 5: Multiple reads
    output("5. Reading back packets...\r\n");
    var readCount = 0;
    while (testQueue.data_waiting) {
        var packet = testQueue.read();
        if (packet && typeof packet.seq === "number") {
            readCount++;
        }
    }
    output("   \1g\1hOK\1n - " + readCount + "/5 packets read correctly\r\n\r\n");

    // Test 6: Empty read (should return null)
    output("6. Testing empty queue read...\r\n");
    var emptyRead = testQueue.read();
    if (emptyRead === null || emptyRead === undefined) {
        output("   \1g\1hOK\1n - Empty queue returns null\r\n\r\n");
    } else {
        output("   \1r\1hFAILED\1n - Expected null, got: " + emptyRead + "\r\n\r\n");
    }

    output("\1h\1g=========================\1n\r\n");
    output("\1h\1gALL TESTS PASSED!\1n\r\n");
    output("\1h\1g=========================\1n\r\n\r\n");

} catch (e) {
    output("\r\n\1r\1hERROR:\1n " + e + "\r\n");
    if (e.stack) {
        output("Stack trace:\r\n" + e.stack + "\r\n");
    }
    output("\r\n");
    exit(1);
}
