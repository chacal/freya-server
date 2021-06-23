import Bacon = require('baconjs')
import mqtt = require('mqtt')
import EventStream = Bacon.EventStream
import Client = mqtt.Client
import { subscribeEvents } from './MqttClientUtils'
import { SensorEvents as SE } from '@chacal/js-utils'
import { SIGNALK_BASE_URL } from './utils'
import fetch from 'node-fetch'

const INSTANCE = 'A100'
const AUTOPILOT_STATE_URL = SIGNALK_BASE_URL + '/signalk/v1/api/vessels/self/steering/autopilot/state'
const AUTOPILOT_ADJUST_URL = SIGNALK_BASE_URL + '/signalk/v1/api/vessels/self/steering/autopilot/actions/adjustHeading'
const AUTOPILOT_TACK_URL = SIGNALK_BASE_URL + '/signalk/v1/api/vessels/self/steering/autopilot/actions/tack'


export default {
  start
}

function start<E>(mqttClient: Client) {
  const autopilot = new AutopilotController()
  const autopilotCommands = subscribeEvents(mqttClient, [`/sensor/${INSTANCE}/a/state`]) as EventStream<SE.IAutopilotCommand>

  autopilotCommands.filter(e => e.buttonId === 1 && e.isLongPress === false).onValue(() => autopilot.turnOn())
  autopilotCommands.filter(e => e.buttonId === 1 && e.isLongPress === true).onValue(() => autopilot.turnOnWindMode())
  autopilotCommands.filter(e => e.buttonId === 2).onValue(() => autopilot.turnOff())
  autopilotCommands.filter(e => e.buttonId === 3 && e.isLongPress === false).onValue(() => autopilot.adjustCourse(10))
  autopilotCommands.filter(e => e.buttonId === 3 && e.isLongPress === true).onValue(() => autopilot.tack('starboard'))
  autopilotCommands.filter(e => e.buttonId === 4).onValue(() => autopilot.adjustCourse(1))
  autopilotCommands.filter(e => e.buttonId === 5).onValue(() => autopilot.adjustCourse(-1))
  autopilotCommands.filter(e => e.buttonId === 6 && e.isLongPress === false).onValue(() => autopilot.adjustCourse(-10))
  autopilotCommands.filter(e => e.buttonId === 6 && e.isLongPress === true).onValue(() => autopilot.tack('port'))
}


class AutopilotController<E> {
  turnOn() {
    putJSON(AUTOPILOT_STATE_URL, { value: 'auto' })
  }

  turnOnWindMode() {
    putJSON(AUTOPILOT_STATE_URL, { value: 'wind' })
  }

  turnOff() {
    putJSON(AUTOPILOT_STATE_URL, { value: 'standby' })
  }

  adjustCourse(adjustment: number) {
    putJSON(AUTOPILOT_ADJUST_URL, { value: adjustment })
  }

  tack(direction: string) {
    putJSON(AUTOPILOT_TACK_URL, { value: direction })
  }
}

function putJSON(url: string, json: object) {
  fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(json)
  })
    .catch(e => console.log('Failed to send command to autopilot plugin', e))
}