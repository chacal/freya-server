var serialport = require('serialport')

if(process.argv.length != 4) {
  console.log("Useage: node freya-server.js <serial-device-1> <serial-device-2>")
  process.exit(1)
}

var serialDevice1 = process.argv[2]
var serialDevice2 = process.argv[3]

console.log("Using devices:", serialDevice1, serialDevice2)

var serialPort1 = openSerialPort(serialDevice1)
var serialPort2 = openSerialPort(serialDevice2)

serialPort1.on("open", function () {
  serialPort1.on('data', function(data) {
    serialPort2.write(data + '\r\n')
  })
})

serialPort2.on("open", function () {
  serialPort2.on('data', function(data) {
    serialPort1.write(data + '\r\n')
  })
})


function openSerialPort(device) {
    return new serialport.SerialPort(device, { baudrate: 4800, parser: serialport.parsers.readline("\r\n") })
}