import mqtt = require('mqtt')
import Client = mqtt.Client
import Bacon = require('baconjs')
import EventStream = Bacon.EventStream
import { SensorEvents } from '@chacal/js-utils'

// Declare fromEvent() version thas is used with MQTT message handler
declare module 'baconjs' {
  function fromEvent<E, A>(target: EventTarget|NodeJS.EventEmitter|JQuery, eventName: string, eventTransformer: (t: string, m: string) => A): EventStream<E, A>;
}

const MAX_DISCONNECT_COUNT = 20

export default {
  connectClient
}

function connectClient<E>(brokerUrl: string, mqttUsername?: string, mqttPassword?: string): EventStream<E, Client>  {
  let disconnectCount = 0

  const client = mqtt.connect(brokerUrl, { username: mqttUsername, password: mqttPassword })
  client.on('connect', () => console.log('Connected to MQTT server'))
  client.on('offline', () => {
    disconnectCount++
    console.log(`Disconnected from MQTT server. Disconnect count: ${disconnectCount}/${MAX_DISCONNECT_COUNT}`)
    if(disconnectCount === MAX_DISCONNECT_COUNT) {
      console.log("Exiting due to too many MQTT disconnects..")
      process.exit(1)
    }
  })
  client.on('error', (e) => console.log('MQTT client error', e))

  return Bacon.fromEvent<E, Client>(client, 'connect').first()
    .map(() => client)
}


export function subscribeEvents<E>(mqttClient: Client, mqttPath: string|string[]): EventStream<E, SensorEvents.ISensorEvent> {
  mqttClient.subscribe(mqttPath)
  return Bacon.fromEvent(mqttClient, 'message', sensorEventFromMQTTMessage)

  function sensorEventFromMQTTMessage(topic: string, message: string): SensorEvents.ISensorEvent {
    return JSON.parse(message) as SensorEvents.ISensorEvent
  }
}


