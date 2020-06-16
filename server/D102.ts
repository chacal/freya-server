import mqtt = require('mqtt')
import Client = mqtt.Client
import { SensorEvents as SE } from '@chacal/js-utils'
import { ChronoUnit, LocalTime } from '@js-joda/core'
import { combineTemplate, EventStream, Property } from 'baconjs'
import {
  cellularNetworkStr,
  FREYA_PIR_SENSORS,
  getRandomInt,
  jsonMessagesFrom,
  motionControlledInterval,
  sendImageToDisplay
} from './utils'
import { getContext, renderRightAdjustedText } from '@chacal/canvas-render-utils'

const DISPLAY_SELF_INSTANCE = 'D102'
const DISPLAY_WIDTH = 296
const DISPLAY_HEIGHT = 128
const WATER_TANK_SENSOR_INSTANCE = 'W100'
const HOUSE_BATTERY_SENSOR_INSTANCE = 'C400'
const HUAWEI_CONN_STATUS_INSTANCE = 'H100'
const HUAWEI_SIGNAL_STRENGTH_INSTANCE = 'H101'
const HUAWEI_NETWORK_TYPE_INSTANCE = 'H102'
export const D102_ADDRESS = 'fdcc:28cc:6dba:0000:4e45:710b:06fb:0894'
const RENDERING_INTERVAL_MS = 5 * 60000 + getRandomInt(30000)
const ACTIVE_TIME_WITHOUT_MOTION_MS = 12 * 60 * 60 * 1000  // Suspend rendering if no motion is detected for 12h


type TankLevelStream = EventStream<SE.ITankLevel>
type CombinedStream = Property<{
  waterTankLevel: SE.ITankLevel,
  displayStatus: SE.IThreadDisplayStatus,
  houseBatteryCurrent: SE.ICurrentEvent,
  houseBatteryEnergy: SE.IElectricEnergyEvent,
  connStatus: SE.ILevelReportEvent,
  signalStrength: SE.ILevelReportEvent,
  networkType: SE.ILevelReportEvent
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
  const waterLevelEvents = sensorEvents.filter(e => SE.isTankLevel(e) && e.instance === WATER_TANK_SENSOR_INSTANCE) as TankLevelStream
  const displayStatuses = sensorEvents.filter(e => SE.isThreadDisplayStatus(e) && e.instance === DISPLAY_SELF_INSTANCE) as EventStream<SE.IThreadDisplayStatus>
  const houseBatteryCurrentEvents = sensorEvents.filter(e => SE.isCurrent(e) && e.instance === HOUSE_BATTERY_SENSOR_INSTANCE) as EventStream<SE.ICurrentEvent>
  const houseBatteryEnergyEvents = sensorEvents.filter(e => SE.isElectricEnergy(e) && e.instance === HOUSE_BATTERY_SENSOR_INSTANCE) as EventStream<SE.IElectricEnergyEvent>
  const huaweiConnectionStatusEvents = sensorEvents.filter(e => SE.isLevelReport(e) && e.instance === HUAWEI_CONN_STATUS_INSTANCE) as EventStream<SE.ILevelReportEvent>
  const huaweiSignalStrengthEvents = sensorEvents.filter(e => SE.isLevelReport(e) && e.instance === HUAWEI_SIGNAL_STRENGTH_INSTANCE) as EventStream<SE.ILevelReportEvent>
  const huaweiNetworkTypeEvents = sensorEvents.filter(e => SE.isLevelReport(e) && e.instance === HUAWEI_NETWORK_TYPE_INSTANCE) as EventStream<SE.ILevelReportEvent>

  return combineTemplate({
    waterTankLevel: waterLevelEvents,
    displayStatus: displayStatuses,
    houseBatteryCurrent: houseBatteryCurrentEvents,
    houseBatteryEnergy: houseBatteryEnergyEvents,
    connStatus: huaweiConnectionStatusEvents,
    signalStrength: huaweiSignalStrengthEvents,
    networkType: huaweiNetworkTypeEvents
  })
}

function setupNetworkDisplay(combinedEvents: CombinedStream, samplingStream: EventStream<any>) {
  combinedEvents.first()
    .concat(combinedEvents.sampledBy(samplingStream))
    .map(v => renderData(
      v.waterTankLevel.tankLevel,
      v.houseBatteryCurrent.vcc,
      v.houseBatteryEnergy.ampHours,
      v.displayStatus.vcc,
      v.displayStatus.parent.latestRssi,
      v.connStatus.level,
      v.signalStrength.level,
      v.networkType.level
    ))
    .onValue(imageData => sendImageToDisplay(D102_ADDRESS, imageData))
}

export function renderData(waterTankLevel: number, houseBatteryVoltage: number, houseBatteryCapacity: number, vcc: number, rssi: number,
                           connStatus: number, signalStrength: number, networkType: number) {
  const ctx = getContext(DISPLAY_WIDTH, DISPLAY_HEIGHT)

  const labelFont = '16px Roboto500'
  const firstRowLabelY = 18
  const secondRowLabelY = 82
  const firstColumnX = 10
  const secondColumnX = 135

  ctx.font = labelFont
  ctx.fillText('Voltage', firstColumnX, firstRowLabelY)
  ctx.fillText('Capacity', secondColumnX, firstRowLabelY)
  ctx.fillText('Water', firstColumnX, secondRowLabelY)
  ctx.fillText('Cellular', secondColumnX, secondRowLabelY)

  const rowHeight = 37
  const firstRowValueY = firstRowLabelY + rowHeight
  const secondRowValueY = secondRowLabelY + rowHeight
  renderValueWithUnit(ctx, `${(houseBatteryVoltage / 1000).toFixed(1)}`, 'V', firstColumnX, firstRowValueY)
  renderValueWithUnit(ctx, `${houseBatteryCapacity.toFixed(0)}`, 'Ah', secondColumnX, firstRowValueY)
  renderValueWithUnit(ctx, `${waterTankLevel}`, '%', firstColumnX, secondRowValueY)

  const statusFont = '14px Roboto500'
  const thirdColumnMarginRight = 6
  ctx.font = statusFont
  renderRightAdjustedText(ctx, LocalTime.now().truncatedTo(ChronoUnit.MINUTES).toString(), DISPLAY_WIDTH - thirdColumnMarginRight, 16)
  renderRightAdjustedText(ctx, `${rssi} dBm`, DISPLAY_WIDTH - thirdColumnMarginRight, 68)
  renderRightAdjustedText(ctx, `${(vcc / 1000).toFixed(3)}V`, DISPLAY_WIDTH - thirdColumnMarginRight, 120)

  renderCellularSignalStrength(ctx, connStatus, signalStrength, networkType, secondColumnX, secondRowValueY)

  return ctx.getImageData(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT)
}

function renderValueWithUnit(ctx: CanvasRenderingContext2D, value: string, unit: string, x: number, y: number) {
  const valueFont = '42px RobotoCondensed700'
  const unitFont = '20px Roboto400'

  ctx.font = valueFont
  let meas = ctx.measureText(value)
  ctx.fillText(value, x, y)
  ctx.font = unitFont
  ctx.fillText(unit, x + meas.width + 2, y)
}

function renderCellularSignalStrength(ctx: CanvasRenderingContext2D, connStatus: number, signalStrength: number, networkType: number, x: number, y: number) {
  if (connStatus === 901) {
    ctx.font = '27px Roboto700'
    ctx.fillText(cellularNetworkStr(networkType), x, y - 10)
    for (let i = 0; i < signalStrength; i++) {
      ctx.fillRect(x + 28 + i * 7, y, 5, -5 - i * 6)
    }
  } else {
    ctx.font = '27px Roboto500'
    ctx.fillText('Offline', x, y - 5)
  }
}