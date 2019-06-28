import SerialPort = require('serialport')
import SerialportSimulator from './SerialportSimulator'
import fsExtra = require('fs-extra')
import winston = require('winston')
import DailyRotateFile = require('winston-daily-rotate-file')
import { EventStream, combineAsArray, fromEvent, Error } from 'baconjs'

export default {
  start
}

function start(serialDevice1: string, serialDevice2: string, loggingDirectory?: string) {
  console.log('Using devices:', serialDevice1, serialDevice2)

  const portOpenings = combineAsArray(openSerialPort(serialDevice1), openSerialPort(serialDevice2))

  portOpenings.onValue(([port1, port2]) => {
    const nmeaStream1 = nmeaStreamFrom(port1)
    const nmeaStream2 = nmeaStreamFrom(port2)
    pipeStreamTo(nmeaStream1, port2)
    pipeStreamTo(nmeaStream2, port1)
    logCombinedStreamWithTimestamp(nmeaStream1, nmeaStream2, loggingDirectory)

    function nmeaStreamFrom(serialport: SerialPort | SerialportSimulator): EventStream<string> {
      const parser = new SerialPort.parsers.Readline({ delimiter: '\r\n' })
      serialport.pipe(parser)
      return fromEvent(parser, 'data')
    }

    function pipeStreamTo(rawNmeaStream: EventStream<string>, destinationPort: SerialPort | SerialportSimulator) {
      rawNmeaStream.onValue(val => destinationPort.write(val + '\r\n'))
    }
  })

  portOpenings.onError(function (e) {
    console.log('Couldn\'t open serial device!', e)
  })
}


function openSerialPort(device: string): EventStream<SerialPort | SerialportSimulator> {
  const port = process.env.USE_SIMULATOR ? new SerialportSimulator(device) : new SerialPort(device, {
    baudRate: 4800,
    bindingOptions: { vmin: 255, vtime: 0 }
  })
  return fromEvent(port, 'open').map(port)
    .merge(fromEvent(port, 'error', e => new Error(e)))
}


function logCombinedStreamWithTimestamp(stream1: EventStream<string>, stream2: EventStream<string>, loggingDirectory?: string) {
  if (!loggingDirectory)
    return

  fsExtra.ensureDirSync(loggingDirectory)

  const logFile = loggingDirectory + '/freya_nmea.log'

  const transportConfig = {
    filename: logFile,
    maxsize: 10 * 1024 * 1024  // 10MB
  }

  const fileLogger = winston.createLogger({
    format: winston.format.printf(info => `${info.message}`),
    transports: [new DailyRotateFile(transportConfig)]
  })

  console.log('Logging to:', logFile)

  stream1.map(line => '-1- ' + line)
    .merge(stream2.map(line => '-2- ' + line))
    .map(nmeaSentence => Date.now() + ': ' + nmeaSentence)
    .onValue(logRow => fileLogger.info(logRow))
}
