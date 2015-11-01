var serialport = require('serialport');

var serial = new serialport.SerialPort('/dev/ttyAMA0', { baudrate: 115200, parser: serialport.parsers.readline("\r\n") })

serial.on('open', function() {
  console.log('Opened serial port')
  serial.on('data', function(values) {
    console.log(JSON.parse(values))
  })
})

setInterval(function() {
  serial.write('1')
}, 2000)
