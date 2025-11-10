load("lib/core/state-manager.js");

var testState = { ballCarrier: null, foo: "bar" };
print("Original state: " + JSON.stringify(testState));

var manager = createStateManager(testState);
print("After creating manager: " + JSON.stringify(testState));

manager.set('ballCarrier', 'PLAYER1', 'test');
print("After set via manager: " + JSON.stringify(testState));
print("ballCarrier from original: " + testState.ballCarrier);
print("ballCarrier via manager.get: " + manager.get('ballCarrier'));

exit();
