import mqtt = require('mqtt')
import Client = mqtt.Client
import { Coap, Mqtt, SensorEvents as SE } from '@chacal/js-utils'
import { ChronoUnit, LocalTime } from '@js-joda/core'
import { combineTemplate, EventStream, Property } from 'baconjs'
import { parse } from 'url'

const DISPLAY_SELF_INSTANCE = 'D103'
const AFT_SENSOR_INSTANCE = 'S205'
const SALOON_SENSOR_INSTANCE = 'S216'
const OUTSIDE_SENSOR_INSTANCE = 'S219'
const FORWARD_SENSOR_INSTANCE = 'S218'
export const D103_ADDRESS = 'fdcc:28cc:6dba:0000:4f2a:cc0f:383e:9440'
const RENDERING_INTERVAL_MS = 5 * 60000


type EnvironmentStream = EventStream<SE.IEnvironmentEvent>
type CombinedStream = Property<{
  aftTemp: SE.IEnvironmentEvent,
  saloonTemp: SE.IEnvironmentEvent,
  outsideTemp: SE.IEnvironmentEvent,
  forwardTemp: SE.IEnvironmentEvent,
  displayStatus: SE.IThreadDisplayStatus,
}>

export default {
  start
}

function start<E>(mqttClient: Client) {
  mqttClient.subscribe('/sensor/+/+/state')
  const sensorEvents = Mqtt.messageStreamFrom(mqttClient).map(msg => JSON.parse(msg.toString()) as SE.ISensorEvent)

  setupNetworkDisplay(createCombinedStream(sensorEvents))
}

function createCombinedStream(sensorEvents: EventStream<SE.ISensorEvent>) {
  const displayStatuses = sensorEvents.filter(e => SE.isThreadDisplayStatus(e) && e.instance === DISPLAY_SELF_INSTANCE) as EventStream<SE.IThreadDisplayStatus>

  return combineTemplate({
    aftTemp: environmentEvents(sensorEvents, AFT_SENSOR_INSTANCE),
    saloonTemp: environmentEvents(sensorEvents, SALOON_SENSOR_INSTANCE),
    outsideTemp: environmentEvents(sensorEvents, OUTSIDE_SENSOR_INSTANCE),
    forwardTemp: environmentEvents(sensorEvents, FORWARD_SENSOR_INSTANCE),
    displayStatus: displayStatuses
  })
}

function environmentEvents(sensorEvents: EventStream<SE.ISensorEvent>, instance: string) {
  return sensorEvents.filter(e => SE.isEnvironment(e) && e.instance === instance) as EnvironmentStream
}

function setupNetworkDisplay(combinedEvents: CombinedStream) {
  combinedEvents.first()
    .concat(combinedEvents.sample(RENDERING_INTERVAL_MS))
    .onValue(v => renderData(
      v.aftTemp.temperature,
      v.saloonTemp.temperature,
      v.outsideTemp.temperature,
      v.forwardTemp.temperature,
      v.displayStatus.vcc,
      v.displayStatus.parent.latestRssi
    ))
}

function renderData(aftTemp: number, saloonTemp: number, outsideTemp: number, forwardTemp: number, vcc: number, rssi: number) {
  const displayData = [
    { c: 'c' },
    { c: 's', i: 1, x: 15, y: 19, font: 12, msg: 'Aft Cabin' },
    { c: 's', i: 2, x: 10, y: 56, font: 30, msg: `${aftTemp.toFixed(1)}` },
    { c: 's', i: 3, x: 135, y: 19, font: 12, msg: 'Saloon' },
    { c: 's', i: 4, x: 130, y: 56, font: 30, msg: `${saloonTemp.toFixed(1)}` },
    { c: 's', i: 5, x: 15, y: 85, font: 12, msg: 'Fwd Cabin' },
    { c: 's', i: 6, x: 10, y: 122, font: 30, msg: `${forwardTemp.toFixed(1)}` },
    { c: 's', i: 7, x: 135, y: 85, font: 12, msg: 'Outdoor' },
    { c: 's', i: 8, x: 130, y: 122, font: 30, msg: `${outsideTemp.toFixed(1)}` },
    { c: 's', i: 9, x: 252, y: 19, font: 12, msg: LocalTime.now().truncatedTo(ChronoUnit.MINUTES) },
    { c: 's', i: 10, x: 230, y: 71, font: 12, msg: `${rssi} dBm` },
    { c: 's', i: 11, x: 241, y: 122, font: 12, msg: `${(vcc / 1000).toFixed(3)}V` }
  ]
  Coap.postJson(parse(`coap://[${D103_ADDRESS}]/api/display`), displayData, false)
}
