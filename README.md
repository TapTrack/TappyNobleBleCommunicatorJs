Communicator for using a Noble peripheral to communicate with a 
TappyBLE device in node.

## Installation
NPM
```
npm install @taptrack/tappy-nobleblecommunicator
```

## Usage
Note that this communicator is not intended to be used directly, rather
it is to be used to back a Tappy object in order to provide an 
abstraction from the underlying communication method.

```javascript
var NobleBleCommunicator = require("@taptrack/tappy-nobleblecommunicator");
var Tappy = require("@taptrack/tappy");
var SystemFamily = require("@taptrack/tappy-systemfamily");
var noble = require("noble");

/**
 * First, we have to scan for the Tappy, see 
 * Noble's documentation for additional details on 
 * this process
 */
noble.on('stateChange',function(state) {
    console.log(state);
    if(state === 'poweredOn') {
        noble.startScanning([NobleBleCommunicator.SERIAL_SERVICE_UUID]);
    } else {
        noble.stopScanning();
    }
});

noble.on('discover', function(peripheral) {
    if(NobleBleCommunicator.isAdvertisementForTappy(peripheral.advertisement)) {
        noble.stopScanning();
        connectToTappy(peripheral);
    }
});

function connectToTappy(peripheral) {
    var comm = new NobleBleCommunicator({peripheral: peripheral});
    var tappy = new Tappy({communicator: comm});

    tappy.setMessageListener(function(msg) {
        console.log("Received Message:");
        console.log("Command Family: "+msg.getCommandFamily());
        console.log("Command Code: "+msg.getCommandCode().toString());
        console.log("Payload: "+msg.getPayload().toString()+"\n");
    });

    tappy.connect(function() {
        var cmd = new SystemFamily.Commands.Ping();
        tappy.sendMessage(cmd);
    });
}
```
