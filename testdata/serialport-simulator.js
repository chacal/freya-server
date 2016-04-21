var fs = require('fs')
var path = require('path')
var util = require('util')
var Bacon = require("baconjs").Bacon
var EventEmitter = require('events').EventEmitter
var _ = require('lodash')

var lines = fs.readFileSync(path.resolve(__dirname + "/Freya_20140913_1638.log")).toString().split('\n')


var SerialportSimulator = function(device, options) {
  console.log("Starting SerialportSimulator:", device)

  this.device = device
  setTimeout(_.bind(emitOpen, this), 100)
  setTimeout(_.bind(startSendindData, this), 200)
}
util.inherits(SerialportSimulator, EventEmitter)

SerialportSimulator.prototype.write = function(data) {
  process.stdout.write('Out - ' + this.device + ': ' + data)
}


function emitOpen() { this.emit('open') }

function startSendindData() {
  Bacon.sequentially(3, lines).onValue(_.bind(function(line) {
    this.emit('data', line)
  }, this))
}



module.exports = SerialportSimulator