import mqtt = require('mqtt')
import Client = mqtt.Client
import { EventStream, later } from 'baconjs'
import { subscribeEvents } from './MqttClientUtils'
import { SensorEvents as SE } from '@chacal/js-utils'

// Exponential constant that is used to undervalue battery charging and overvalue discharging as the charge/discharge current increases
const BATTERY_CHARGE_CONSTANT = 1.02

export default {
  start
}

function start<E>(mqttClient: Client) {
  const electricityEvents = subscribeEvents(mqttClient, ['/sensor/+/c/state', '/sensor/+/e/state'])
  const currentEvents = electricityEvents.filter(e => e.tag === 'c') as EventStream<SE.ICurrentEvent>
  const energyEvents = electricityEvents.filter(e => e.tag === 'e') as EventStream<SE.IElectricEnergyEvent>

  currentEvents
    .groupBy(event => event.instance)
    .flatMap(streamByInstance => streamByInstance.first()
      .flatMapFirst(firstEvent => {
        return currentEnergyEventOrZeroEvent(firstEvent.instance)
          .map(toCurrentTime)
          .flatMapFirst(initialEnergyEvent => streamByInstance.scan(initialEnergyEvent, calculateNewEnergyEvent))
      })
    )
    .onValue(e => publishTo(mqttClient, e))

  function currentEnergyEventOrZeroEvent(instance: string): EventStream<SE.IElectricEnergyEvent> {
    return energyEvents.filter(e => e.instance === instance)    // Wait 2s for an energy event for instance or return an energy event with 0 amp hours
      .merge(later(2000, createEnergyEvent(instance, 0)))
      .first()
  }
}

function calculateNewEnergyEvent(oldEvent: SE.IElectricEnergyEvent, event: SE.ICurrentEvent): SE.IElectricEnergyEvent {
  const hoursSinceLastUpdate = (new Date().getTime() - new Date(oldEvent.ts).getTime()) / 1000 / 60 / 60
  const ampHoursDelta = calculateUsedAmpHours()

  return createEnergyEvent(event.instance, oldEvent.ampHours + ampHoursDelta)

  function calculateUsedAmpHours(): number {
    if (Math.abs(event.current) <= 1) {                   // Charge/discharge is < 1A => use the value directly
      return event.current * hoursSinceLastUpdate
    } else if (event.current > 0) {                       // Battery is charging -> energy is stored exponentially slower as the current increases
      return Math.pow(event.current, 1 / BATTERY_CHARGE_CONSTANT) * hoursSinceLastUpdate
    } else {                                             // Battery is discharging -> energy is consumed exponentially faster as the current increases
      return -Math.pow(Math.abs(event.current), BATTERY_CHARGE_CONSTANT) * hoursSinceLastUpdate
    }
  }
}

function createEnergyEvent(instance: string, ampHours: number): SE.IElectricEnergyEvent {
  return {
    tag: 'e',
    instance,
    ampHours,
    ts: new Date().toISOString()
  }
}

function toCurrentTime(event: SE.IElectricEnergyEvent): SE.IElectricEnergyEvent {
  return Object.assign({}, event, { ts: new Date().toISOString() })
}

function publishTo(mqttClient: Client, event: SE.IElectricEnergyEvent) {
  mqttClient.publish(`/sensor/${event.instance}/${event.tag}/state`, JSON.stringify(event), { retain: true, qos: 1 })
}
