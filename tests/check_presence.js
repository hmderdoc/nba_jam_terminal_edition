load("json-client.js");
var c = new JSONClient("localhost", 10088);
print("Current LORB_PRESENCE:");
var data = c.read("nba_jam", "LORB_PRESENCE", 1);
print(JSON.stringify(data, null, 2));
c.disconnect();
