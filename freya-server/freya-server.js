var serialport = require('serialport')
var Bacon = require("baconjs").Bacon
var SerialportSimulator = require('../testdata/serialport-simulator.js')

if(process.argv.length != 4) {
  console.log("Usage: node freya-server.js <serial-device-1> <serial-device-2>")
  process.exit(1)
}

var serialDevice1 = process.argv[2]
var serialDevice2 = process.argv[3]

console.log("Using devices:", serialDevice1, serialDevice2)

var serialPort1 = openSerialPort(serialDevice1)
var serialPort2 = openSerialPort(serialDevice2)
var nmeaStream1 = nmeaStreamFrom(serialPort1)
var nmeaStream2 = nmeaStreamFrom(serialPort2)


nmeaStream1.onValue(function(val) {
  serialPort2.write(val + '\r\n')
})

nmeaStream2.onValue(function(val) {
  serialPort1.write(val + '\r\n')
})


function openSerialPort(device) {
  return process.env.USE_SIMULATOR ? new SerialportSimulator(device) : new serialport.SerialPort(device, { baudrate: 4800, parser: serialport.parsers.readline("\r\n") })
}

function nmeaStreamFrom(serialport) {
  return Bacon.fromEvent(serialport, 'open')
    .flatMapLatest(function() { return Bacon.fromEvent(serialport, 'data') })
}