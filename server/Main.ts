import NmeaStreamer from './NmeaStreamer'


if(process.argv.length < 4) {
  console.log("Usage: node built/Main.js <serial-device-1> <serial-device-2> [logging-directory]")
  process.exit(1)
}


const serialDevice1: string = process.argv[2]
const serialDevice2: string = process.argv[3]
const loggingDirectory: string = process.argv[4]

NmeaStreamer.start(serialDevice1, serialDevice2, loggingDirectory)
