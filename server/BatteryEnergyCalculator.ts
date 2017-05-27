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
  (subscribeEvents(mqttClient, '/sensor/+/c/state') as EventStream<E, ICurrentEvent>)
    .groupBy(event => event.instance)
    .flatMap(streamByInstance => streamByInstance.first()
      .flatMapFirst(firstEvent => streamByInstance.scan(createEnergyEvent(firstEvent, 0), calculateNewEnergyEvent))
    )
    .onValue(e => publishTo(mqttClient, e))
}

function calculateNewEnergyEvent(oldEvent: IElectricEnergyEvent, event: ICurrentEvent): IElectricEnergyEvent {
  const hoursSinceLastUpdate = (new Date().getTime() - new Date(oldEvent.ts).getTime()) / 1000 / 60 / 60
  const ampHoursDelta = event.current * hoursSinceLastUpdate

  return createEnergyEvent(event, oldEvent.ampHours + ampHoursDelta)
}

function createEnergyEvent(event: ICurrentEvent, ampHours: number): IElectricEnergyEvent {
  return {
    tag: 'e',
    instance: event.instance,
    ampHours,
    ts: new Date().toISOString()
  }
}

function publishTo(mqttClient: Client, event: IElectricEnergyEvent) {
  mqttClient.publish(`/sensor/${event.instance}/${event.tag}/state`, JSON.stringify(event), { retain: true, qos: 1 })
}
