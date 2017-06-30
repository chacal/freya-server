import fs = require('fs')
import path = require('path')
import Bacon = require("baconjs")
import {EventEmitter} from 'events'

const lines = fs.readFileSync(path.resolve(__dirname + "/../testdata/Freya_20140913_1638.log")).toString().split('\n')


export default class SerialportSimulator extends EventEmitter {
  device: string

  constructor(device: string) {
    super()
    console.log("Starting SerialportSimulator:", device)

    this.device = device
    setTimeout(() => this.emit('open'), 1000)
    setTimeout(() => this.startSendindData(), 2000)
  }

  write(data: any) {
    process.stdout.write('SerialportSimulator ' + this.device + ': ' + data)
  }

  private startSendindData() {
    Bacon.sequentially(30, lines).onValue(line => this.emit('data', line))
  }
}
