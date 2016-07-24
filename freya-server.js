var serialport = require('serialport')
var Bacon = require("baconjs").Bacon
var SerialportSimulator = require('./testdata/serialport-simulator.js')
var fs = require('fs')
var fsExtra = require('fs-extra')
var _ = require('lodash')
var winston = require('winston')

if(process.argv.length < 4) {
  console.log("Usage: node freya-server.js <serial-device-1> <serial-device-2> [logging-directory]")
  process.exit(1)
}

var serialDevice1 = process.argv[2]
var serialDevice2 = process.argv[3]
var loggingDirectory = process.argv[4]

console.log("Using devices:", serialDevice1, serialDevice2)

var portOpenings = openSerialPortS(serialDevice1)
  .zip(openSerialPortS(serialDevice2))

portOpenings.onValues(function(port1, port2) {
  var nmeaStream1 = nmeaStreamFrom(port1)
  var nmeaStream2 = nmeaStreamFrom(port2)
  pipeStreamTo(nmeaStream1, port2)
  pipeStreamTo(nmeaStream2, port1)
  logCombinedStreamWithTimestamp(nmeaStream1, nmeaStream2)
})
portOpenings.onError(function(e) {
  console.log("Couldn't open serial device!", e)
})

function openSerialPortS(device) {
  var port = process.env.USE_SIMULATOR ? new SerialportSimulator(device) : new serialport.SerialPort(device, { baudrate: 4800, parser: serialport.parsers.readline("\r\n"), platformOptions: { vmin: 255, vtime: 0 }})
  return Bacon.fromEvent(port, 'open').map(port)
    .merge(Bacon.fromEvent(port, 'error', Bacon.Error))
}

function nmeaStreamFrom(serialport) {
  return Bacon.fromEvent(serialport, 'data')
}

function pipeStreamTo(rawNmeaStream, destinationPort) {
  rawNmeaStream.onValue(function(val) {
    destinationPort.write(val + '\r\n')
  })
}

function logCombinedStreamWithTimestamp(stream1, stream2) {
  if(! loggingDirectory)
    return

  fsExtra.ensureDirSync(loggingDirectory)

  var logFile = loggingDirectory + '/freya_nmea.log'
  var fileTransportConfig = {
    timestamp: false,
    filename: logFile,
    json: false,
    maxsize: 10 * 1024 * 1024,  // 10MB
    showLevel: false
  }
  var fileLogger = new winston.Logger({ transports: [ new winston.transports.File(fileTransportConfig) ] })

  console.log("Logging to:", logFile)

  stream1.map(_.curry(appendWith)('-1- ')).merge(stream2.map(_.curry(appendWith)('-2- ')))
    .map(function(nmeaSentence) { return Date.now() + ': ' + nmeaSentence })
    .onValue(function(value) {
      fileLogger.info(value)
    })

  function appendWith(prefix, data) { return prefix + data}
}