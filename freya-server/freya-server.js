var serialport = require('serialport')
var Bacon = require("baconjs").Bacon
var SerialportSimulator = require('../testdata/serialport-simulator.js')
var fs = require('fs')
var TargetCalculator = require('./target-calculator.js')
var nmea = require('nmea')
var _ = require('lodash')

if(process.argv.length < 4) {
  console.log("Usage: node freya-server.js <serial-device-1> <serial-device-2> [logging-directory]")
  process.exit(1)
}

var serialDevice1 = process.argv[2]
var serialDevice2 = process.argv[3]
var loggingDirectory = process.argv[4]

console.log("Using devices:", serialDevice1, serialDevice2)

var serialPort1 = openSerialPort(serialDevice1)
var serialPort2 = openSerialPort(serialDevice2)
var rawNmeaStream1 = nmeaStreamFrom(serialPort1)
var rawNmeaStream2 = nmeaStreamFrom(serialPort2)
var richNmeaStream2 = parsedStreamFrom(rawNmeaStream2)

pipeStreamTo(rawNmeaStream1, serialPort2)
pipeStreamTo(rawNmeaStream2, serialPort1)
logCombinedStreamWithTimestamp(rawNmeaStream1, rawNmeaStream2)
startTargetCalculator()

function startTargetCalculator() {
  var targetCalculator = new TargetCalculator(twStreamFrom(richNmeaStream2).map('.speed'), twStreamFrom(richNmeaStream2).map('.angle'))
  targetCalculator.targets.onValue(function(targets) {
    console.log(targets)
  })

  function twStreamFrom(richNmeaStream) {
    return richNmeaStream.filter(function(datum) { return datum.sentence === 'MWV' && datum.reference === 'T' })
  }
}

var checksum = 0;
for(var i = 0; i < 'PTAK,FFP1,TARGET,SPEED'.length; i++) {
  checksum = checksum ^ 'PTAK,FFP1,TARGET,SPEED'.charCodeAt(i);
}
console.log(checksum)

function openSerialPort(device) {
  return process.env.USE_SIMULATOR ? new SerialportSimulator(device) : new serialport.SerialPort(device, { baudrate: 4800, parser: serialport.parsers.readline("\r\n"), platformOptions: { vmin: 255, vtime: 0 }})
}

function nmeaStreamFrom(serialport) {
  return Bacon.fromEvent(serialport, 'open')
    .flatMapLatest(function() { return Bacon.fromEvent(serialport, 'data') })
}

function parsedStreamFrom(rawNmeaStream) {
  return rawNmeaStream.map(function(sentence) {
    try {
      return nmea.parse(sentence)
    } catch (e) {}
  }).filter(_.identity)
}

function pipeStreamTo(rawNmeaStream, destinationPort) {
  rawNmeaStream.onValue(function(val) {
    destinationPort.write(val + '\r\n')
  })
}

function logCombinedStreamWithTimestamp(stream1, stream2) {
  if(! loggingDirectory)
    return

  var outputFile = loggingDirectory + '/' + randomString(8) + '.log'
  console.log("Logging to:", outputFile)

  var outputFileStream = fs.createWriteStream(outputFile, {flags: 'a'})
  stream1.map(_.curry(appendWith)('-1- ')).merge(stream2.map(_.curry(appendWith)('-2- ')))
    .map(function(nmeaSentence) { return Date.now() + ': ' + nmeaSentence + '\n'})
    .onValue(function(value) {
      outputFileStream.write(value)
    })

  function appendWith(prefix, data) { return prefix + data}

  function randomString(length)
  {
    var possible = "abcdefghijklmnopqrstuvwxyz0123456789"
    var text = ''
    for( var i = 0; i < length; i++ )
      text += possible.charAt(Math.floor(Math.random() * possible.length))
    return text
  }
}