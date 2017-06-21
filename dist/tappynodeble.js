(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define([], factory);
    } else {
        // Node, CommonJS-like
        module.exports = factory();
    } 
}(this, function () {

    NobleBleCommunicator = function(params) {
        var self = this;

        if(typeof params !== "undefined" &&
                params !== null &&
                typeof params.peripheral === "object") {
            this.peripheral = params.peripheral;
        } else {
            throw new Error("Must specify a noble peripheral");
        }

        /**
         * This is here to control how big the packet sent over
         * the BLE characteristic is. Default is 20 bytes as per
         * a BLE 4.0 characteristic max size
         */
        if(typeof params !== "undefined" &&
                params !== null &&
                typeof params.packetSize === "number") {
            this.packetSize = params.packetSize;
        } else {
            this.packetSize = 20;
        }

        
        this.isConnecting = false;
        this.hasConnected = false;
        this.isSending = false;

        this.rxCharacteristic = null;
        this.txCharacteristic = null;

        this.disconnectImmediately = false;

        this.disconnectCb = function() {};
        this.sendBufferArray = new Uint8Array();

        this.dataReceivedCallback = function(bytes) {

        };
        this.errorCallback = function(data) {

        };
        this.readCallback = function(buff) {
            self.dataReceivedCallback(new Uint8Array(buff));
        };

        this.bleDisconnectCallback = function() {
            self.errorCallback({error:"Tappy disconnected"});
            self.disconnect();
        };
        
    };
    NobleBleCommunicator.SERIAL_SERVICE_UUID = "175f8f23a57049bd9627815a6a27de2a";
    // The characteristics are named from the Tappy's perspective 
    NobleBleCommunicator.TX_CHAR_UUID = "cacc07ffffff4c488faea9ef71b75e26";
    NobleBleCommunicator.RX_CHAR_UUID = "1cce1ea8bd344813a00ac76e028fadcb";
    NobleBleCommunicator.isAdvertisementForTappy = function(advertisement) {
        if(typeof advertisement.localName == "undefined" || advertisement.localName === null) {
            return false;
        }

        if(advertisement.localName.indexOf("TAPPY") !== -1) {
            return true;
        }

        return false;
    };


    NobleBleCommunicator.prototype = {

        connect: function(cb) {
            var self = this;
            if(!self.isConnecting && !self.isConnected()) {
                self.isConnecting = true;
                var fail = function(msg) {
                    self.isConnecting = false;
                    cb(msg);
                };
                peripheral = self.peripheral;
                peripheral.connect(function(err) {
                    if(typeof err !== 'undefined' && err !== null) {
                        fail({message: "Failed to connect",error: err});
                    } else {
                        peripheral.discoverSomeServicesAndCharacteristics(
                            [NobleBleCommunicator.SERIAL_SERVICE_UUID],
                            [NobleBleCommunicator.RX_CHAR_UUID,NobleBleCommunicator.TX_CHAR_UUID],
                            function(err, services, chars) {
                                if(err !== null) {
                                    peripheral.disconnect();
                                    fail({message:"Failed to discover characteristics",error: err});
                                } else if (chars.length >= 2) {
                                    var rxCharacteristic = null;
                                    var txCharacteristic = null;

                                    chars.forEach(function(characteristic) {
                                        if(characteristic.uuid === NobleBleCommunicator.RX_CHAR_UUID) {
                                            rxCharacteristic = characteristic;
                                        } else if(characteristic.uuid === NobleBleCommunicator.TX_CHAR_UUID){
                                            txCharacteristic = characteristic;
                                        }
                                    });

                                    if(rxCharacteristic === null || txCharacteristic === null) {
                                       fail({message: "Missing required characteristic"});
                                       return;
                                    }

                                    self.rxCharacteristic = rxCharacteristic;
                                    self.txCharacteristic = txCharacteristic;
                                    txCharacteristic.on('data',function(data,isNotification) {
                                        self.readCallback(data);
                                    });
                                    txCharacteristic.subscribe(function(err) {
                                        if(typeof err !== "undefined" && err !== null) {
                                            fail({message: "Failed to enable notification", error: err});
                                        } else {
                                            // we should now be connected!
                                            self.hasConnected = true;
                                            self.isConnecting = false;
                                            self.peripheral.on('disconnect',self.bleDisconnectCallback);
                                            
                                            cb();
                                            if(self.disconnectImmediately) {
                                                disconnectUnsafe();
                                            }
                                        }
                                    });

                                } else {
                                    peripheral.disconnect();
                                    fail({message: "Failed to discover characteristics"});
                                }
                            }
                        );
                    }
                });
            }
        },

        flush: function(cb) {
            var self = this;
            // not implemented for BLE communciator
        }, 

        isConnected: function() {
            var self = this;
            return self.hasConnected;
        },
 
        disconnectUnsafe: function() {
            var self = this;
            if(self.isConnecting) {
                throw "Connection still in the process of being established";
            }
            if(self.isConnected()) {
                self.peripheral.disconnect(function(err) {
                    if(typeof self.disconnectCb === "function") {
                        if(typeof err !== "undefined" && err !== null) {
                            self.disconnectCb({error: err});
                        } else {
                            self.disconnectCb();
                        }
                    }
                    self.disconnectImmediately = false;
                    self.isSending = false;
                    self.hasConnected = false;
                });
            }
        },

        disconnect: function(cb) {
            var self = this;
            self.disconnectImmediately = true;
            self.peripheral.removeListener('disconnect',self.bleDisconnectCallback);
            if(typeof cb === "function") {
                self.disconnectCb = cb;
            }
            if(!self.isConnecting && self.isConnected()) {
                self.disconnectUnsafe();
            }
        },

        sendCb: function(err) {
            var self = this;
            if(typeof err !== "undefined" && err !== null) {
                self.sendBufferArray = new Uint8Array();
                self.isSending = false;
                self.errorCallback({error: err}); 
            } else if(!self.isSendBufferEmpty()) {
                var chunk = self.stripNextChunkFromSendBuffer();
                self.rxCharacteristic.write(new Buffer(chunk),false,self.sendCb.bind(self));
            } else {
                self.isSending = false;
            }
        },

        stripNextChunkFromSendBuffer: function() {
            var self = this;
            if(self.sendBufferArray.length > self.packetSize) {
                var chunkToSend = self.sendBufferArray.slice(0,self.packetSize);
                var newBuff = self.sendBufferArray.slice(self.packetSize);
                self.sendBufferArray = newBuff;
                return chunkToSend;
            } else {
                var buf = self.sendBufferArray;
                self.sendBufferArray = new Uint8Array();
                return buf;
            }
        },

        isSendBufferEmpty: function() {
            var self = this;
            return self.sendBufferArray.length === 0;
        },

        initiateSendIfNecessary: function() {
            var self = this;
            if(!self.isSending && !self.isSendBufferEmpty()) {
                self.isSending = true;

                var chunk = self.stripNextChunkFromSendBuffer();
                self.rxCharacteristic.write(new Buffer(chunk),false,self.sendCb.bind(self));
            }
        },

        send: function(buffer) {
            var self = this;
            var sendArray = new Uint8Array(buffer);
            var newBufferArray = new Uint8Array(sendArray.length+self.sendBufferArray.length);
            newBufferArray.set(self.sendBufferArray);
            newBufferArray.set(sendArray,self.sendBufferArray.length);
            self.sendBufferArray = newBufferArray;
            
            self.initiateSendIfNecessary();
        },

        setDataCallback: function(cb) {
            var self = this;
            self.dataReceivedCallback = cb;
        },

        setErrorCallback: function(cb) {
            var self = this;
            self.errorCallback = cb;
        },
    };

    return NobleBleCommunicator;
}));
