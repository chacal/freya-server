import can = require('socketcan')
import Bacon = require('baconjs')
import EventStream = Bacon.EventStream

export interface CANFilter {
  id: number,
  mask: number
}

export interface CANFrame {
  id: number,
  data: Buffer
}

export interface PGNFrame extends CANFrame {
  pgn: number
}


export default class CANTranceiver<E> {
  private channel: any
  rxFrames: EventStream<E, PGNFrame>

  constructor(canDevice: string, rxFilters: CANFilter[]) {
    this.channel = can.createRawChannel(canDevice)
    if(rxFilters) {
      this.channel.setRxFilters(rxFilters)
    }
    this.rxFrames = pgnFramesFromChannel(this.channel)
    this.channel.start()
  }

  send({id, data}: CANFrame) {
    this.channel.send({id, length: data.length, data, ext: true })
  }
}



function pgnFramesFromChannel<E>(channel: any): EventStream<E, PGNFrame> {
  const frames: EventStream<E, CANFrame> = Bacon.fromBinder(sink => {
    channel.addListener('onMessage', sink)
    return () => {}
  })

  return frames.map(frame => Object.assign(frame, {pgn: extractPgn(frame)}))

  function extractPgn(frame): number { return (frame.id >> 8) & 0x1ffff }
}
