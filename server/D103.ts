import mqtt = require('mqtt')
import Client = mqtt.Client
import { Coap, SensorEvents as SE } from '@chacal/js-utils'
import { ChronoUnit, LocalTime } from '@js-joda/core'
import { combineTemplate, EventStream, Property } from 'baconjs'
import { parse } from 'url'
import {
  FREYA_PIR_SENSORS,
  getRandomInt,
  jsonMessagesFrom,
  motionControlledInterval,
  sendImageToDisplay
} from './utils'
import { getContext, renderRightAdjustedText } from '@chacal/canvas-render-utils'
import { renderDisplayStatus, renderValueWithUnit } from './D102'

const DISPLAY_SELF_INSTANCE = 'D103'
const DISPLAY_WIDTH = 296
const DISPLAY_HEIGHT = 128
const AFT_SENSOR_INSTANCE = 'S205'
const SALOON_SENSOR_INSTANCE = 'S216'
const OUTSIDE_SENSOR_INSTANCE = 'S219'
const FORWARD_SENSOR_INSTANCE = 'S218'
export const D103_ADDRESS = 'fdcc:28cc:6dba:0000:4f2a:cc0f:383e:9440'
const RENDERING_INTERVAL_MS = 5 * 60000 + getRandomInt(30000)
const ACTIVE_TIME_WITHOUT_MOTION_MS = 12 * 60 * 60 * 1000  // Suspend rendering if no motion is detected for 12h


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
  const sensorEvents = jsonMessagesFrom(mqttClient) as EventStream<SE.ISensorEvent>

  setupNetworkDisplay(createCombinedStream(sensorEvents), motionControlledInterval(mqttClient, FREYA_PIR_SENSORS, RENDERING_INTERVAL_MS, ACTIVE_TIME_WITHOUT_MOTION_MS))
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

function setupNetworkDisplay(combinedEvents: CombinedStream, samplingStream: EventStream<any>) {
  combinedEvents.first()
    .concat(combinedEvents.sampledBy(samplingStream))
    .map(v => renderData(
      v.aftTemp.temperature,
      v.saloonTemp.temperature,
      v.outsideTemp.temperature,
      v.forwardTemp.temperature,
      v.displayStatus.vcc,
      v.displayStatus.parent.latestRssi
    ))
    .onValue(imageData => sendImageToDisplay(D103_ADDRESS, imageData))
}

export function renderData(aftTemp: number, saloonTemp: number, outsideTemp: number, forwardTemp: number, vcc: number, rssi: number) {
  const ctx = getContext(DISPLAY_WIDTH, DISPLAY_HEIGHT)

  const labelFont = '16px Roboto500'
  const firstRowLabelY = 18
  const secondRowLabelY = 82
  const firstColumnX = 10
  const secondColumnX = 135

  ctx.font = labelFont
  ctx.fillText('Aft Cabin', firstColumnX, firstRowLabelY)
  ctx.fillText('Saloon', secondColumnX, firstRowLabelY)
  ctx.fillText('Fwd Cabin', firstColumnX, secondRowLabelY)
  ctx.fillText('Outdoor', secondColumnX, secondRowLabelY)

  const rowHeight = 37
  const firstRowValueY = firstRowLabelY + rowHeight
  const secondRowValueY = secondRowLabelY + rowHeight
  renderValueWithUnit(ctx, `${aftTemp.toFixed(1)}`, '°C', firstColumnX, firstRowValueY)
  renderValueWithUnit(ctx, `${saloonTemp.toFixed(1)}`, '°C', secondColumnX, firstRowValueY)
  renderValueWithUnit(ctx, `${forwardTemp.toFixed(1)}`, '°C', firstColumnX, secondRowValueY)
  renderValueWithUnit(ctx, `${outsideTemp.toFixed(1)}`, '°C', secondColumnX, secondRowValueY)

  renderDisplayStatus(ctx, rssi, vcc)

  return ctx.getImageData(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT)
}
