import Bacon = require('baconjs')
import CANTranceiver from './CANTranceiver'
import R = require('ramda')
import Property = Bacon.Property
import EventStream = Bacon.EventStream
import mqtt = require('mqtt')
import Client = mqtt.Client
import {subscribeEvents} from './MqttClientUtils'
import {SensorEvents as SE} from '@chacal/js-utils'

const PGN_65360_FILTER = { id: 0xff5000, mask: 0x1ffff00 }    // Tracked course (magnetic)
const TRACKED_COURSE_PGN = 65360
const INSTANCE = '10'

export default {
  start
}

function start<E>(mqttClient: Client) {
  const autopilot = new AutopilotController()
  const autopilotCommands = subscribeEvents(mqttClient, [`/command/${INSTANCE}/a/state`]) as EventStream<E, SE.IAutopilotCommand>

  autopilotCommands.filter(e => e.buttonId === 1).onValue(() => autopilot.turnOn())
  autopilotCommands.filter(e => e.buttonId === 2).onValue(() => autopilot.turnOff())
  autopilotCommands.filter(e => e.buttonId === 3).onValue(() => autopilot.adjustCourse(degToRads(10)))
  autopilotCommands.filter(e => e.buttonId === 4).onValue(() => autopilot.adjustCourse(degToRads(1)))
  autopilotCommands.filter(e => e.buttonId === 5).onValue(() => autopilot.adjustCourse(degToRads(-1)))
  autopilotCommands.filter(e => e.buttonId === 6).onValue(() => autopilot.adjustCourse(degToRads(-10)))

  autopilot.status.onValue(status => mqttClient.publish(`/sensor/${INSTANCE}/b/state`, JSON.stringify(status), { retain: true, qos: 1 }))
}



interface AutopilotState {
  enabled: boolean,
  course: number
}

class AutopilotController<E> {
  private can: CANTranceiver<E>
  status: Property<ErrorEvent, SE.IAutopilotState>

  constructor() {
    this.can = new CANTranceiver('can0', [PGN_65360_FILTER])

    const trackedCourseFrames = this.can.rxFrames.filter(f => f.pgn === TRACKED_COURSE_PGN)

    const state = Bacon.interval(200, false)
      .merge(trackedCourseFrames.map(true))
      .slidingWindow(2)
      .map(R.contains(true))
      .skipDuplicates()

    const trackedCourse = trackedCourseFrames
      .map('.data')
      .map(parseTrackedCourse)
      .skipDuplicates()
      .toProperty(undefined)

    this.status = Bacon.combineWith((autopilotEnabled, course) => ({
      tag: 'b',
      instance: INSTANCE,
      ts: new Date().toISOString(),
      enabled: autopilotEnabled,
      course: autopilotEnabled ? course : null
    }), state, trackedCourse)
  }

  turnOn() {
    const frames = ['80110163ff00f804', '81013b0703040440', '820005ffffffffff']
    frames.forEach(frame => this.can.send({id: 233688064, data: new Buffer(frame, 'hex')}))
  }

  turnOff() {
    const frames = ['80110163ff00f804', '81013b0703040400', '820005ffffffffff']
    frames.forEach(frame => this.can.send({id: 233688064, data: new Buffer(frame, 'hex')}))
  }

  setCourse(courseRads: number) {
    const intRadians = Math.round(safeRadians(courseRads) * 10000)

    const lowerByte = intRadians & 0xff  // mask away upper bits
    const secondFrame = new Buffer('21013b0703040600', 'hex')
    secondFrame[7] = lowerByte

    const upperByte = intRadians >> 8  // shift away lower bits
    const thirdFrame = new Buffer('2200ffffffffffff', 'hex')
    thirdFrame[1] = upperByte

    const frames = [new Buffer('200e0150ff00f803', 'hex'), secondFrame, thirdFrame]
    frames.forEach(frame => this.can.send({id: 233688064, data: frame}))
  }

  adjustCourse(adjustmentRads: number) {
    this.status.first().filter(s => s.enabled).map(s => s.course).onValue(currentCourse => {
      const newCourse = currentCourse + adjustmentRads
      this.setCourse(newCourse)
    })
  }
}


function parseTrackedCourse(pgn65360Buffer): number {
  return pgn65360Buffer.readUInt16LE(5) / 10000
}

function safeRadians(rads: number): number {
  let newRads = rads % (2 * Math.PI)
  return newRads < 0 ? newRads + 2 * Math.PI : newRads
}

function degToRads(deg: number): number {
  return deg * Math.PI / 180
}
