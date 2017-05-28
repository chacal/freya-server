import mqtt = require('mqtt')
import Client = mqtt.Client
import Bacon = require('baconjs')
import EventStream = Bacon.EventStream
import {subscribeEvents} from './MqttClientUtils'
import {ICurrentEvent, IElectricEnergyEvent} from "./ISensorEvent"

export default {
  start
}

function start<E>(mqttClient: Client) {
  const electricityEvents = subscribeEvents(mqttClient, ['/sensor/+/c/state', '/sensor/+/e/state'])
  const currentEvents = electricityEvents.filter(e => e.tag === 'c') as EventStream<E, ICurrentEvent>
  const energyEvents = electricityEvents.filter(e => e.tag === 'e') as EventStream<E, IElectricEnergyEvent>

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

  function currentEnergyEventOrZeroEvent(instance: string): EventStream<E, IElectricEnergyEvent> {
    return energyEvents.filter(e => e.instance === instance)    // Wait 2s for an energy event for instance or return an energy event with 0 amp hours
      .merge(Bacon.later(2000, createEnergyEvent(instance, 0)))
      .first()
  }
}

function calculateNewEnergyEvent(oldEvent: IElectricEnergyEvent, event: ICurrentEvent): IElectricEnergyEvent {
  const hoursSinceLastUpdate = (new Date().getTime() - new Date(oldEvent.ts).getTime()) / 1000 / 60 / 60
  const ampHoursDelta = event.current * hoursSinceLastUpdate

  return createEnergyEvent(event.instance, oldEvent.ampHours + ampHoursDelta)
}

function createEnergyEvent(instance: string, ampHours: number): IElectricEnergyEvent {
  return {
    tag: 'e',
    instance,
    ampHours,
    ts: new Date().toISOString()
  }
}

function toCurrentTime(event: IElectricEnergyEvent): IElectricEnergyEvent {
  return Object.assign({}, event, { ts: new Date().toISOString() })
}

function publishTo(mqttClient: Client, event: IElectricEnergyEvent) {
  mqttClient.publish(`/sensor/${event.instance}/${event.tag}/state`, JSON.stringify(event), { retain: true, qos: 1 })
}
