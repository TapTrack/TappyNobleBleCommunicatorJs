var BleComm = require('../src/tappynodeble.js');

var arrayEquals = function(a1,a2) {
    return a1.length == a2.length && a1.every(function(e,i){return e == a2[i];});
};

describe("Test breaking up packets", function() {
    it("should break up packets into 20 byte chunks by default", function() {
        var chunkOne = new Uint8Array(20);
        chunkOne.fill(1);
        var chunkTwo = new Uint8Array(20);
        chunkTwo.fill(2);
        var chunkThree = new Uint8Array(20);
        chunkThree.fill(3);
        var chunkFour = new Uint8Array(20);
        chunkFour.fill(4);

        var fullPacket = new Uint8Array(80);
        fullPacket.set(chunkOne);
        fullPacket.set(chunkTwo,20);
        fullPacket.set(chunkThree,40);
        fullPacket.set(chunkFour,60);
        
        var counter = 0;
        var fakeCharacteristic = {};
        fakeCharacteristic.write = function(dataBuffer, reply, cb) {
            counter++;
            var data = new Uint8Array(dataBuffer);
            if(counter == 1) {
                expect(arrayEquals(data,chunkOne)).toEqual(true);
            } else if (counter == 2) {
                expect(arrayEquals(data,chunkTwo)).toEqual(true);
            } else if (counter == 3) {
                expect(arrayEquals(data,chunkThree)).toEqual(true);
            } else if (counter == 4) {
                expect(arrayEquals(data,chunkFour)).toEqual(true);
            }
            cb();
        };

        var testComm = new BleComm({peripheral: {}});
        testComm.hasConnected = true;
        testComm.rxCharacteristic = fakeCharacteristic;

        testComm.send(fullPacket.buffer);
        expect(counter).toEqual(4);
    });
    it("should break up packets into correct chunks when custom amount specified", function() {
        var chunkOne = new Uint8Array(17);
        chunkOne.fill(1);
        var chunkTwo = new Uint8Array(17);
        chunkTwo.fill(2);
        var chunkThree = new Uint8Array(17);
        chunkThree.fill(3);
        var chunkFour = new Uint8Array(17);
        chunkFour.fill(4);

        var fullPacket = new Uint8Array(17*4);
        fullPacket.set(chunkOne);
        fullPacket.set(chunkTwo,chunkOne.length);
        fullPacket.set(chunkThree,chunkTwo.length+chunkOne.length);
        fullPacket.set(chunkFour,chunkTwo.length+chunkOne.length+chunkThree.length);
        
        var counter = 0;
        var fakeCharacteristic = {};
        fakeCharacteristic.write = function(dataBuffer, reply, cb) {
            counter++;
            var data = new Uint8Array(dataBuffer);
            if(counter == 1) {
                expect(arrayEquals(data,chunkOne)).toEqual(true);
            } else if (counter == 2) {
                expect(arrayEquals(data,chunkTwo)).toEqual(true);
            } else if (counter == 3) {
                expect(arrayEquals(data,chunkThree)).toEqual(true);
            } else if (counter == 4) {
                expect(arrayEquals(data,chunkFour)).toEqual(true);
            }
            cb();
        };

        var testComm = new BleComm({peripheral: {}, packetSize: 17});
        testComm.hasConnected = true;
        testComm.rxCharacteristic = fakeCharacteristic;

        testComm.send(fullPacket.buffer);
        expect(counter).toEqual(4);
    });
    
    it("should send final segment as abbreviated chunk when full packet not multiple of size", function() {
        var chunkOne = new Uint8Array(17);
        chunkOne.fill(1);
        var chunkTwo = new Uint8Array(17);
        chunkTwo.fill(2);
        var chunkThree = new Uint8Array(17);
        chunkThree.fill(3);
        var chunkFour = new Uint8Array(7);
        chunkFour.fill(4);

        var fullPacket = new Uint8Array(17*3+7);
        fullPacket.set(chunkOne);
        fullPacket.set(chunkTwo,chunkOne.length);
        fullPacket.set(chunkThree,chunkTwo.length+chunkOne.length);
        fullPacket.set(chunkFour,chunkTwo.length+chunkOne.length+chunkThree.length);
        
        var counter = 0;
        var fakeCharacteristic = {};
        fakeCharacteristic.write = function(dataBuffer, reply, cb) {
            counter++;
            var data = new Uint8Array(dataBuffer);
            if(counter == 1) {
                expect(arrayEquals(data,chunkOne)).toEqual(true);
            } else if (counter == 2) {
                expect(arrayEquals(data,chunkTwo)).toEqual(true);
            } else if (counter == 3) {
                expect(arrayEquals(data,chunkThree)).toEqual(true);
            } else if (counter == 4) {
                expect(arrayEquals(data,chunkFour)).toEqual(true);
            }
            cb();
        };

        var testComm = new BleComm({peripheral: {}, packetSize: 17});
        testComm.hasConnected = true;
        testComm.rxCharacteristic = fakeCharacteristic;

        testComm.send(fullPacket.buffer);
        expect(counter).toEqual(4);
    });
});

describe("Test scan report identification", function() {
    it("Should correctly identify a Tappy advertisement", function() {
        var fakeTappy = {
            localName: "TAPPY123"
        };

        expect(BleComm.isAdvertisementForTappy(fakeTappy)).toEqual(true);
    });
    
    it("Should correctly reject a non-Tappy advertisement", function() {
        var fakeTappy = {
            localName: "POWERMETER"
        };

        expect(BleComm.isAdvertisementForTappy(fakeTappy)).toEqual(false);
    });
});

