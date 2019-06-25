import mqtt = require('mqtt')
import Client = mqtt.Client
import Bacon = require('baconjs')
import EventStream = Bacon.EventStream
import {SensorEvents} from '@chacal/js-utils'

export function subscribeEvents<E>(mqttClient: Client, mqttPath: string | string[]): EventStream<SensorEvents.ISensorEvent> {
  mqttClient.subscribe(mqttPath)
  return Bacon.fromEvent(mqttClient, 'message', sensorEventFromMQTTMessage)

  function sensorEventFromMQTTMessage(topic: string, message: string): SensorEvents.ISensorEvent {
    return JSON.parse(message) as SensorEvents.ISensorEvent
  }
}
