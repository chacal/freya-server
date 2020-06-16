import fetch from 'node-fetch'
import { gzipSync } from 'zlib'
import { toBinaryImage } from '@chacal/canvas-render-utils'
import { Coap, Mqtt } from '@chacal/js-utils'
import { parse } from 'url'
import { ChronoUnit, LocalDateTime, nativeJs } from '@js-joda/core'
import { SensorEvents as SE } from '@chacal/js-utils/built/ISensorEvent'
import { EventStream, interval } from 'baconjs'
import { MqttClient } from 'mqtt'

const SIGNALK_POSITION_ENDPOINT = 'http://freya-raspi.chacal.fi/signalk/v1/api/vessels/self/navigation/position'
export const FREYA_PIR_SENSORS = ['P311', 'P312']

interface Position {
  lat: number
  lng: number
  ts: Date
}

export interface Observation {
  station: string,
  windSpeedMs: number
  windGustMs: number,
  windDir: number,
  ts: Date
}

export function fetchLocationFromSignalK(): Promise<Position> {
  return fetch(SIGNALK_POSITION_ENDPOINT)
    .then(res => res.json())
    .then(json => ({
      lng: json.value.longitude,
      lat: json.value.latitude,
      ts: new Date(json.timestamp)
    }))
}

export function getNearestObservation(p: Position): Promise<Observation> {
  const url = `https://tuuleeko.fi/fmiproxy/nearest-observations?lat=${p.lat}&lon=${p.lng}&latest=true&marineOnly=true`
  return fetch(url)
    .then(res => res.json())
    .then(json => ({
      station: json.station.name,
      windSpeedMs: json.observations.windSpeedMs,
      windGustMs: json.observations.windGustMs,
      windDir: json.observations.windDir,
      ts: new Date(json.observations.time)
    }))
}

export function sendImageToDisplay(ipv6Destination: string, image: ImageData) {
  const payload = gzipSync(toBinaryImage(image))
  const url = `coap://[${ipv6Destination}]/api/image`
  console.log(`Sending ${payload.length} bytes to ${url}`)
  return Coap.postOctetStream(parse(url), payload, false)
}

export function secondsSince(d: Date) {
  return LocalDateTime.from(nativeJs(d)).until(LocalDateTime.now(), ChronoUnit.SECONDS)
}


function motionDetections(mqttClient: MqttClient, pirSensors: string[]) {
  const sensorEvents = jsonMessagesFrom(mqttClient) as EventStream<SE.ISensorEvent>
  return sensorEvents.filter(e => SE.isPirEvent(e) && pirSensors.includes(e.instance) && e.motionDetected === true) as EventStream<SE.IPirEvent>
}

export function motionControlledInterval(mqttClient: MqttClient, pirSensors: string[], intervalMs: number, activeTimeWithoutMotionMs: number): EventStream<any> {
  const timer = interval(intervalMs, '')
  const motions = motionDetections(mqttClient, pirSensors)

  return motions
    .map(e => new Date(e.ts)).toProperty(new Date())
    .sampledBy(timer.merge(motions))
    .filter(ts => new Date().getTime() - ts.getTime() < activeTimeWithoutMotionMs)
    .debounceImmediate(intervalMs)
}

export function jsonMessagesFrom(mqttClient: MqttClient): EventStream<object> {
  return Mqtt.messageStreamFrom(mqttClient)
    .map(msg => {
      try {
        return JSON.parse(msg.toString())
      } catch {
        console.error('Got invalid sensor event: ' + msg.toString())
        return null
      }
    })
    .filter(e => e !== null)
}

export function getRandomInt(max: number) {
  max = Math.floor(max)
  return Math.floor(Math.random() * (max + 1))
}

export function cellularNetworkStr(networkType: number) {
  switch (networkType) {
    case 0:
      return '-'
    case 1:
    case 2:
    case 3:
      return '2G'
    case 19:
      return '4G'
    default:
      return '3G'
  }
}