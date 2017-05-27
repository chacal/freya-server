import SerialPort = require('serialport')
import Bacon = require("baconjs")
import SerialportSimulator from './SerialportSimulator'
import fs = require('fs')
import fsExtra = require('fs-extra')
import winston = require('winston')
import EventStream = Bacon.EventStream
import EventEmitter = NodeJS.EventEmitter


export default {
  start
}

function start(serialDevice1: string, serialDevice2: string, loggingDirectory?: string) {
  console.log("Using devices:", serialDevice1, serialDevice2)

  const portOpenings = Bacon.combineAsArray(openSerialPortS(serialDevice1), openSerialPortS(serialDevice2))

  portOpenings.onValues((port1: EventEmitter, port2: EventEmitter) => {
    const nmeaStream1 = nmeaStreamFrom(port1)
    const nmeaStream2 = nmeaStreamFrom(port2)
    pipeStreamTo(nmeaStream1, port2)
    pipeStreamTo(nmeaStream2, port1)
    logCombinedStreamWithTimestamp(nmeaStream1, nmeaStream2, loggingDirectory)

    function nmeaStreamFrom(serialport) { return Bacon.fromEvent(serialport, 'data') }

    function pipeStreamTo(rawNmeaStream, destinationPort) { rawNmeaStream.onValue(val => destinationPort.write(val + '\r\n')) }
  })

  portOpenings.onError(function(e) {
    console.log("Couldn't open serial device!", e)
  })
}


function openSerialPortS(device: string): EventStream<any, EventEmitter> {
  const port = process.env.USE_SIMULATOR ? new SerialportSimulator(device) : new SerialPort(device, { baudrate: 4800, parser: SerialPort.parsers.readline("\r\n"), platformOptions: { vmin: 255, vtime: 0 }})
  return Bacon.fromEvent(port, 'open').map(port)
    .merge(Bacon.fromEvent(port, 'error', e => new Bacon.Error(e)))
}


function logCombinedStreamWithTimestamp(stream1: EventStream<any, string>, stream2: EventStream<any, string>, loggingDirectory?: string) {
  if(! loggingDirectory)
    return

  fsExtra.ensureDirSync(loggingDirectory)

  const logFile = loggingDirectory + '/freya_nmea.log'
  const fileTransportConfig = {
    timestamp: false,
    filename: logFile,
    json: false,
    maxsize: 10 * 1024 * 1024,  // 10MB
    showLevel: false
  }
  const fileLogger = new winston.Logger({ transports: [ new winston.transports.File(fileTransportConfig) ] })

  console.log("Logging to:", logFile)

  stream1.map(line => '-1- ' + line)
    .merge(stream2.map(line => '-2- ' + line))
    .map(nmeaSentence => Date.now() + ': ' + nmeaSentence)
    .onValue(fileLogger.info)
}
