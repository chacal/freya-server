import ReconnectingWebSocket from 'reconnecting-websocket'
import { fromEvent, interval } from 'baconjs'
import { SKDelta, SKPosition } from '@chacal/signalk-ts'
import R from 'ramda'
import { readFileSync, writeFileSync } from 'fs'

const POSITION_PERIOD_MS = 10000
const CACHE_TIME_MS = 8 * 60 * 60 * 1000  // 8 hours
const CACHE_SAVE_PERIOD_MS = 30000

const WebSocket = require('ws')
let positionCache: Position[] = []


interface Position {
  ts: Date,
  lat: number,
  lng: number
}


export default function start(cacheFile: string, signalKServer: string) {
  positionCache = loadCacheFromFile(cacheFile)

  positionsFromSignalK(signalKServer)
    .onValue(savePositionFromSKDelta)

  interval(CACHE_SAVE_PERIOD_MS, '')
    .onValue(() => cleanAndSaveCache(cacheFile))
}

export function getRecentPositions(): Position[] {
  return R.sortBy(R.prop('ts'), positionCache)
}

function savePositionFromSKDelta(delta: SKDelta) {
  const update = delta.updates[0]
  if (!isTooOld(update.timestamp)) {
    const skPos = update.values[0].value as SKPosition
    const pos = {
      ts: update.timestamp,
      lat: skPos.latitude,
      lng: skPos.longitude
    }

    const oldIndex = positionCache.findIndex(p => p.ts.getTime() === update.timestamp.getTime())
    if (oldIndex !== -1) {
      positionCache[oldIndex] = pos
    } else {
      positionCache.push(pos)
    }
  }
}

function cleanAndSaveCache(cacheFile: string) {
  while (positionCache.length > 0 && isTooOld(positionCache[0].ts)) {
    positionCache.shift()
  }
  writeFileSync(cacheFile, JSON.stringify(positionCache, null, 2))
}

function loadCacheFromFile(cacheFile: string): Position[] {
  try {
    const positions = JSON.parse(readFileSync(cacheFile).toString())
    console.log(`Loaded ${positions.length} cached positions.`)
    return positions.map((p: any) => Object.assign(p, { ts: new Date(p.ts) }))
  } catch (e) {
    console.log('Error loading position cache, defaulting to empty cache', e)
    return []
  }
}

function isTooOld(d: Date) {
  return new Date().getTime() - d.getTime() > CACHE_TIME_MS
}

function positionsFromSignalK(skServer: string) {
  const options = {
    WebSocket,
    maxReconnectionDelay: 30000
  }

  const ws = new ReconnectingWebSocket(`ws://${skServer}/signalk/v1/stream?subscribe=none`, [], options)

  ws.addEventListener('open', () => {
    console.log(`Connected to SignalK server ${skServer} via WebSocket`)
    ws.send(JSON.stringify({
      'context': 'vessels.self',
      'subscribe': [{
        'path': 'navigation.position',
        'policy': 'instant',
        'minPeriod': POSITION_PERIOD_MS
      }]
    }))
  })

  return fromEvent(ws, 'message')
    .map((event: MessageEvent) => {
      try {
        return SKDelta.fromJSON(event.data)
      } catch (e) {
        console.log('Parsing SK delta JSON failed! Data was:', event.data)
      }
    })
    .filter(d => !R.isNil(d))
}