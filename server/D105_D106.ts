import mqtt = require('mqtt')
import Client = mqtt.Client
import IThreadDisplayStatus = SensorEvents.IThreadDisplayStatus
import { SensorEvents, SensorEvents as SE } from '@chacal/js-utils'
import { ChronoUnit, LocalTime, nativeJs } from '@js-joda/core'
import { combineTemplate, EventStream, fromPromise, interval, once } from 'baconjs'
import { getContext, renderCenteredText, renderRightAdjustedText } from '@chacal/canvas-render-utils'
import {
  fetchLocationFromSignalK,
  FREYA_PIR_SENSORS,
  getNearestObservation, getRandomInt,
  jsonMessagesFrom,
  motionControlledInterval,
  Observation,
  secondsSince,
  sendImageToDisplay
} from './utils'
import { MqttClient } from 'mqtt'

export const D105_ADDRESS = 'fdcc:28cc:6dba:0000:ff0d:e379:e425:2c81'
export const D106_ADDRESS = 'fdcc:28cc:6dba:0000:cab2:5899:6be9:59c2'
const RENDERING_INTERVAL_MS = () => 5 * 60000 + getRandomInt(30000)
const ACTIVE_TIME_WITHOUT_MOTION_MS = 12 * 60 * 60 * 1000  // Suspend rendering if no motion is detected for 12h
const OBSERVATION_UPDATE_INTERVAL_MS = 60000
const OBSERVATION_AGE_WARNING_S = 1800 // 30 minutes
const MAX_RENDERED_OBSERVATION_AGE_S = 7200 // 2 hours

const REAL_DISPLAY_WIDTH = 128
const REAL_DISPLAY_HEIGHT = 250
const DISPLAY_WIDTH = 250
const DISPLAY_HEIGHT = 122


export default {
  start
}

function start<E>(mqttClient: Client) {
  mqttClient.subscribe('/sensor/+/+/state')
  const observations = nearestObservations()

  setupObservationRendering(mqttClient, 'D105', D105_ADDRESS, observations)
  setupObservationRendering(mqttClient, 'D106', D106_ADDRESS, observations)
}

function setupObservationRendering(mqttClient: Client, displayId: string, displayAddress: string, observations: EventStream<Observation>) {
  const combined = combineTemplate({
    displayStatus: displayStatuses(mqttClient, displayId),
    observation: observations
  })

  combined.first()
    .concat(combined.sampledBy(motionControlledRenderingInterval(mqttClient)))
    .map(({ observation, displayStatus }) => render(observation, displayStatus))
    .onValue(imageData => sendImageToDisplay(displayAddress, imageData))
}

function motionControlledRenderingInterval(mqttClient: MqttClient) {
  return motionControlledInterval(mqttClient, FREYA_PIR_SENSORS, RENDERING_INTERVAL_MS(), ACTIVE_TIME_WITHOUT_MOTION_MS)
}

export function render(obs: Observation, ds: IThreadDisplayStatus) {
  const ctx = getContext(REAL_DISPLAY_WIDTH, REAL_DISPLAY_HEIGHT, true)
  const observationAgeSeconds = secondsSince(obs.ts)

  //
  // Render observation station
  //
  ctx.font = '24px Roboto500'
  if (observationAgeSeconds > OBSERVATION_AGE_WARNING_S) {
    ctx.fillRect(0, 0, DISPLAY_WIDTH, 25)
    ctx.fillStyle = 'white'
  }
  renderCenteredText(ctx, obs.station, DISPLAY_WIDTH / 2, 19)
  ctx.fillStyle = 'black'


  //
  // Render wind data
  //
  const dataRowY = 78
  const leftStr = observationAgeSeconds < MAX_RENDERED_OBSERVATION_AGE_S ? `${Math.round(obs.windSpeedMs)}` : '-'
  const centerStr = observationAgeSeconds < MAX_RENDERED_OBSERVATION_AGE_S ? `${obs.windDir}` : '-'
  const rightStr = observationAgeSeconds < MAX_RENDERED_OBSERVATION_AGE_S ? `${Math.round(obs.windGustMs)}` : '-'

  ctx.font = (centerStr.length < 3) || (leftStr.length + rightStr.length < 3) ? '66px RobotoCondensed700' : '60px RobotoCondensed700'

  const leftX = leftStr.length === 1 ? 16 : -4
  const leftW = ctx.measureText(leftStr).width
  const rightX = DISPLAY_WIDTH - (rightStr.length === 1 ? 15 : -2)
  const rightW = ctx.measureText(rightStr).width

  ctx.fillText(leftStr, leftX, dataRowY)
  renderCenteredText(ctx, centerStr, DISPLAY_WIDTH / 2, dataRowY)
  renderRightAdjustedText(ctx, rightStr, rightX, dataRowY)


  //
  // Render labels
  //
  ctx.font = '21px Roboto400'
  const labelRowY = 99
  renderCenteredText(ctx, 'm/s', leftX + leftW / 2, labelRowY)
  renderCenteredText(ctx, '°T', DISPLAY_WIDTH / 2, labelRowY)
  renderCenteredText(ctx, `m/s`, rightX - rightW / 2, labelRowY)


  //
  // Render status row
  //
  ctx.font = '16px OpenSans400'
  const voltageStr = `${(ds.vcc / 1000).toFixed(2)}V`
  const timeStr = LocalTime.from(nativeJs(obs.ts)).truncatedTo(ChronoUnit.MINUTES).toString()

  ctx.fillText(voltageStr, 5, DISPLAY_HEIGHT - 1)
  renderCenteredText(ctx, timeStr, DISPLAY_WIDTH / 2, DISPLAY_HEIGHT - 1)
  renderRightAdjustedText(ctx, `${ds.parent.avgRssi} dBm`, DISPLAY_WIDTH - 1, DISPLAY_HEIGHT - 4)


  //
  // Return rendered image
  //
  return ctx.getImageData(0, 0, REAL_DISPLAY_WIDTH, REAL_DISPLAY_HEIGHT)
}


function nearestObservations() {
  return positions()
    .flatMapLatest(p => fromPromise(getNearestObservation(p)))
}

function positions() {
  return once('')
    .concat(interval(OBSERVATION_UPDATE_INTERVAL_MS, ''))
    .flatMapLatest(() => fromPromise(fetchLocationFromSignalK()))
}

function displayStatuses(mqttClient: Client, displayId: string) {
  const sensorEvents = jsonMessagesFrom(mqttClient) as EventStream<SE.ISensorEvent>
  return sensorEvents.filter(e => SE.isThreadDisplayStatus(e) && e.instance === displayId) as EventStream<SE.IThreadDisplayStatus>
}
