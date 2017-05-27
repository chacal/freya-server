import mqtt = require('mqtt')
import Client = mqtt.Client
import Bacon = require('baconjs')
import EventStream = Bacon.EventStream
import ISensorEvent from "./ISensorEvent"

// Declare fromEvent() version thas is used with MQTT message handler
declare module 'baconjs' {
  function fromEvent<E, A>(target: EventTarget|NodeJS.EventEmitter|JQuery, eventName: string, eventTransformer: (t: string, m: string) => A): EventStream<E, A>;
}


export default {
  connectClient
}

function connectClient<E>(brokerUrl: string, mqttUsername?: string, mqttPassword?: string): EventStream<E, Client>  {
  const client = mqtt.connect(brokerUrl, { username: mqttUsername, password: mqttPassword })
  client.on('connect', () => console.log('Connected to MQTT server'))
  client.on('offline', () => console.log('Disconnected from MQTT server'))
  client.on('error', (e) => console.log('MQTT client error', e))

  return Bacon.fromEvent(client, 'connect').first()
    .map(() => client)
}


export function subscribeEvents<E>(mqttClient: Client, mqttPath: string): EventStream<E, ISensorEvent> {
  mqttClient.subscribe(mqttPath)
  return Bacon.fromEvent(mqttClient, 'message', sensorEventFromMQTTMessage)

  function sensorEventFromMQTTMessage(topic: string, message: string): ISensorEvent {
    return JSON.parse(message) as ISensorEvent
  }
}


