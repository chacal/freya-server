import mqtt = require('mqtt')
import Client = mqtt.Client
import { Mqtt, SensorEvents as SE, Coap } from '@chacal/js-utils'
import { ChronoUnit, LocalTime } from '@js-joda/core'
import { EventStream, combineTemplate, Property } from 'baconjs'
import { parse } from 'url'

const DISPLAY_SELF_INSTANCE = 'D102'
const WATER_TANK_SENSOR_INSTANCE = 'W100'
const HOUSE_BATTERY_SENSOR_INSTANCE = 'C400'
const D102_ADDRESS = 'fdcc:28cc:6dba:0000:e75e:5b5b:2569:c66a'
const RENDERING_INTERVAL_MS = 5 * 60000


type TankLevelStream = EventStream<SE.ITankLevel>
type CombinedStream = Property<{
  waterTankLevel: SE.ITankLevel,
  displayStatus: SE.IThreadDisplayStatus,
  houseBatteryCurrent: SE.ICurrentEvent,
  houseBatteryEnergy: SE.IElectricEnergyEvent
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
  const waterLevelEvents = sensorEvents.filter(e => SE.isTankLevel(e) && e.instance === WATER_TANK_SENSOR_INSTANCE) as TankLevelStream
  const displayStatuses = sensorEvents.filter(e => SE.isThreadDisplayStatus(e) && e.instance === DISPLAY_SELF_INSTANCE) as EventStream<SE.IThreadDisplayStatus>
  const houseBatteryCurrentEvents = sensorEvents.filter(e => SE.isCurrent(e) && e.instance === HOUSE_BATTERY_SENSOR_INSTANCE) as EventStream<SE.ICurrentEvent>
  const houseBatteryEnergyEvents = sensorEvents.filter(e => SE.isElectricEnergy(e) && e.instance === HOUSE_BATTERY_SENSOR_INSTANCE) as EventStream<SE.IElectricEnergyEvent>

  return combineTemplate({
    waterTankLevel: waterLevelEvents,
    displayStatus: displayStatuses,
    houseBatteryCurrent: houseBatteryCurrentEvents,
    houseBatteryEnergy: houseBatteryEnergyEvents
  })
}

function setupNetworkDisplay(combinedEvents: CombinedStream) {
  combinedEvents.first()
    .concat(combinedEvents.sample(RENDERING_INTERVAL_MS))
    .onValue(v => renderData(
      v.waterTankLevel.tankLevel,
      v.houseBatteryCurrent.vcc,
      v.houseBatteryEnergy.ampHours,
      v.displayStatus.vcc,
      v.displayStatus.parent.latestRssi
    ))
}

function renderData(waterTankLevel: number, houseBatteryVoltage: number, houseBatteryCapacity: number, vcc: number, rssi: number) {
  const displayData = [
    { c: 'c' },
    { c: 's', i: 1, x: 15, y: 17, font: 12, msg: 'Water' },
    { c: 's', i: 2, x: 10, y: 72, font: 35, msg: `${waterTankLevel}` },
    { c: 's', i: 3, x: 112, y: 17, font: 12, msg: 'Voltage' },
    { c: 's', i: 4, x: 90, y: 72, font: 35, msg: `${(houseBatteryVoltage / 1000).toFixed(1)}` },
    { c: 's', i: 5, x: 217, y: 17, font: 12, msg: 'Capacity' },
    { c: 's', i: 6, x: 223, y: 72, font: 35, msg: `${houseBatteryCapacity.toFixed(0)}` },

    { c: 's', i: 7, x: 5, y: 125, font: 12, msg: LocalTime.now().truncatedTo(ChronoUnit.MINUTES) },
    { c: 's', i: 8, x: 111, y: 125, font: 12, msg: `${rssi} dBm` },
    { c: 's', i: 9, x: 239, y: 125, font: 12, msg: `${(vcc / 1000).toFixed(3)}V` },

    { c: 's', i: 10, x: 31, y: 93, font: 14, msg: `%` },
    { c: 's', i: 11, x: 135, y: 93, font: 14, msg: `V` },
    { c: 's', i: 12, x: 238, y: 93, font: 14, msg: `Ah` },
  ]
  Coap.postJson(parse(`coap://[${D102_ADDRESS}]/api/display`), displayData, false)
}
