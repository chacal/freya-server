var i2c = require('i2c-bus')
var i2c1 = i2c.openSync(1)

var data = new Buffer(8)

setInterval(function() {
  i2c1.i2cReadSync(8, 8, data)
  console.log(data.readInt32LE(0), data.readInt32LE(4))
}, 1000)
