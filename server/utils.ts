import fetch from 'node-fetch'
import { gzipSync } from 'zlib'
import { toBinaryImage } from '@chacal/canvas-render-utils'
import { Coap } from '@chacal/js-utils'
import { parse } from 'url'
import { ChronoUnit, LocalDateTime, nativeJs } from '@js-joda/core'

const SIGNALK_POSITION_ENDPOINT = 'http://freya-raspi.chacal.fi/signalk/v1/api/vessels/self/navigation/position'

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
