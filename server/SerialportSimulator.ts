import fs = require('fs')
import path = require('path')
import Bacon = require('baconjs')
import { Readable } from 'stream'

export default class SerialportSimulator extends Readable {
  device: string
  lines = fs.readFileSync(path.resolve(__dirname + '/../testdata/Freya_20140913_1638.log')).toString().split('\n')

  constructor(device: string) {
    super()
    console.log('Starting SerialportSimulator:', device)

    this.device = device
    setTimeout(() => this.emit('open'), 1000)
    setTimeout(() => this.startSendindData(), 2000)
  }

  write(data: string | number[] | Buffer, callback?: (error: any, bytesWritten: number) => void): boolean {
    process.stdout.write('SerialportSimulator ' + this.device + ': ' + data)
    return true
  }

  _read(size: number): void {
  }

  private startSendindData() {
    Bacon.sequentially(30, this.lines).onValue(line => this.push(line + '\r\n'))
  }
}
