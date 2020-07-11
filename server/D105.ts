import proj4 from 'proj4'
import { getContext, renderRightAdjustedText } from '@chacal/canvas-render-utils'
import { CanvasRenderingContext2D } from 'canvas'
import { getRecentPositions, Position } from './RecentPositionCache'
import {
  displayStatuses,
  FREYA_PIR_SENSORS,
  getRandomInt,
  motionControlledInterval,
  Observation,
  renderValueWithUnit,
  secondsSince,
  sendBWRImageToDisplay,
} from './utils'
import { Client } from 'mqtt'
import { SensorEvents } from '@chacal/js-utils'
import { combineTemplate, EventStream } from 'baconjs'
import { ChronoUnit, LocalTime, nativeJs } from '@js-joda/core'
import IThreadDisplayStatus = SensorEvents.IThreadDisplayStatus

const proj = proj4('WGS84', 'EPSG:3857')

export const D105_ADDRESS = 'fdcc:28cc:6dba:0000:ff0d:e379:e425:2c81'

const REAL_DISPLAY_WIDTH = 128
const REAL_DISPLAY_HEIGHT = 296
const DISPLAY_WIDTH = REAL_DISPLAY_HEIGHT
const DISPLAY_HEIGHT = REAL_DISPLAY_WIDTH
const RENDERING_INTERVAL_MS = 5 * 60000 + getRandomInt(30000)
const ACTIVE_TIME_WITHOUT_MOTION_MS = 12 * 60 * 60 * 1000  // Suspend rendering if no motion is detected for 12h
const MAX_RENDERED_OBSERVATION_AGE_S = 7200 // 2 hours
const OBSERVATION_AGE_WARNING_S = 1800 // 30 minutes

export default function start(mqttClient: Client, observations: EventStream<Observation>) {
  mqttClient.subscribe('/sensor/+/+/state')
  const combined = combineTemplate({
    displayStatus: displayStatuses(mqttClient, 'D105'),
    observation: observations
  })

  combined.first()
    .concat(combined.sampledBy(motionControlledInterval(mqttClient, FREYA_PIR_SENSORS, RENDERING_INTERVAL_MS, ACTIVE_TIME_WITHOUT_MOTION_MS)))
    .map(({ observation, displayStatus }) => render(observation, displayStatus))
    .onValue(imageData => sendBWRImageToDisplay(D105_ADDRESS, imageData))
}

function render(obs: Observation, displayStatus: IThreadDisplayStatus) {
  const ctx = getContext(REAL_DISPLAY_WIDTH, REAL_DISPLAY_HEIGHT, true)
  ctx.antialias = 'default'

  renderObservation(ctx, obs, displayStatus)
  renderRecentPositions(ctx)

  return ctx.getImageData(0, 0, REAL_DISPLAY_WIDTH, REAL_DISPLAY_HEIGHT)
}


function renderObservation(ctx: CanvasRenderingContext2D, obs: Observation, displayStatus: IThreadDisplayStatus) {
  const observationAgeSeconds = secondsSince(obs.ts)
  const startX = DISPLAY_WIDTH / 2
  const valueFontSize = 46
  const unitFontSize = 16
  ctx.font = '16px Roboto500'


  //
  // Render observation station
  //
  if (observationAgeSeconds > OBSERVATION_AGE_WARNING_S) {
    ctx.fillStyle = '#505050'
    ctx.fillRect(startX, 0, DISPLAY_WIDTH, 23)
    ctx.fillStyle = 'white'
  }
  let rowY = 17
  ctx.fillText(obs.station, startX, rowY)
  ctx.fillStyle = 'black'


  //
  // Render wind speed & gusts
  //
  const windStr = observationAgeSeconds < MAX_RENDERED_OBSERVATION_AGE_S ? `${Math.round(obs.windSpeedMs)}` : '-'
  const gustStr = observationAgeSeconds < MAX_RENDERED_OBSERVATION_AGE_S ? `${Math.round(obs.windGustMs)}` : '-'
  let txt = `${windStr}/${gustStr}`
  rowY = 60
  renderValueWithUnit(ctx, txt, 'm/s', startX, rowY, valueFontSize, unitFontSize)


  //
  // Render wind dir
  //
  txt = observationAgeSeconds < MAX_RENDERED_OBSERVATION_AGE_S ? `${obs.windDir}` : '-'
  rowY = 103
  renderValueWithUnit(ctx, txt, '°T', startX, rowY, valueFontSize, unitFontSize)


  //
  // Render status row
  //
  const timeStr = LocalTime.from(nativeJs(obs.ts)).truncatedTo(ChronoUnit.MINUTES).toString()
  const voltageStr = `${(displayStatus.vcc / 1000).toFixed(2)}V`

  ctx.font = '16px Roboto500'
  ctx.fillText(timeStr, startX, DISPLAY_HEIGHT - 4)
  renderRightAdjustedText(ctx, voltageStr, DISPLAY_WIDTH - 1, DISPLAY_HEIGHT - 4)
}


function renderRecentPositions(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)'

  const positions = getRecentPositions()
  if (positions.length > 0) {
    const centerWGS84 = positions[positions.length - 1]
    const center3857 = to3857(centerWGS84)

    positions.forEach(p => {
      const s = toScreen(center3857, to3857(p))
      ctx.fillRect(s[0], s[1], 1, 1)
    })
  }
}


function to3857(p: Position) {
  return proj.forward([p.lng, p.lat])
}

function toScreen([centerX, centerY]: number[], [x, y]: number[]) {
  const displayX = Math.round(64 + 2 * (x - centerX))
  const displayY = Math.round(64 + 2 * (centerY - y))
  return [displayX, displayY]
}