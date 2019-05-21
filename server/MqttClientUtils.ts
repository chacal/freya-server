import mqtt = require('mqtt')
import Client = mqtt.Client
import Bacon = require('baconjs')
import EventStream = Bacon.EventStream
import {SensorEvents} from '@chacal/js-utils'

// Declare fromEvent() version that is used with MQTT message handler
declare module 'baconjs' {
  function fromEvent<E, A>(target: EventTarget | NodeJS.EventEmitter | JQuery, eventName: string, eventTransformer: (t: string, m: string) => A): EventStream<E, A>;
}


export function subscribeEvents<E>(mqttClient: Client, mqttPath: string | string[]): EventStream<E, SensorEvents.ISensorEvent> {
  mqttClient.subscribe(mqttPath)
  return Bacon.fromEvent(mqttClient, 'message', sensorEventFromMQTTMessage)

  function sensorEventFromMQTTMessage(topic: string, message: string): SensorEvents.ISensorEvent {
    return JSON.parse(message) as SensorEvents.ISensorEvent
  }
}
