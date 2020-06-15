import mqtt = require('mqtt')
import Client = mqtt.Client
import ILevelReportEvent = SensorEvents.ILevelReportEvent
import fetch from 'node-fetch'
import { parseStringPromise, processors } from 'xml2js'
import { SensorEvents } from '@chacal/js-utils'
import { MqttClient } from 'mqtt'
import { getRandomInt } from './utils'
import { interval, once } from 'baconjs'

const POLLING_INTERVAL_MS = 2 * 60000 + getRandomInt(15000)

const BASE_URL = 'http://192.168.8.1'
const INDEX_URL = BASE_URL + '/html/index.html'
const STATUS_URL = BASE_URL + '/api/monitoring/status'


interface Huawei4GStatus {
  connectionStatus: number
  signalStrength: number
  networkType: number
  networkTypeEx: number
}


export default {
  start
}

function start<E>(mqttClient: Client) {
  once('')
    .concat(interval(POLLING_INTERVAL_MS, ''))
    .onValue(() => {
      fetchHuaweiStatusXML()
        .then(parseStatusXML)
        .then(s => publishHuaweiStatus(mqttClient, s))
    })
}

function publishHuaweiStatus(mqttClient: Client, status: Huawei4GStatus) {
  const now = new Date()
  publishLevelReport(mqttClient, levelReportEvent('H100', now, status.connectionStatus))
  publishLevelReport(mqttClient, levelReportEvent('H101', now, status.signalStrength))
  publishLevelReport(mqttClient, levelReportEvent('H102', now, status.networkType))
  publishLevelReport(mqttClient, levelReportEvent('H103', now, status.networkTypeEx))
}

function publishLevelReport(mqttClient: MqttClient, report: ILevelReportEvent) {
  mqttClient.publish(`/sensor/${report.instance}/${report.tag}/state`, JSON.stringify(report), {
    retain: true,
    qos: 1
  })
}

function levelReportEvent(instance: string, ts: Date, level: number): ILevelReportEvent {
  return {
    tag: 'r',
    instance: instance,
    ts: ts.toISOString(),
    level
  }
}

async function parseStatusXML(xml: string): Promise<Huawei4GStatus> {
  const status = await parseStringPromise(xml, { explicitArray: false, valueProcessors: [processors.parseNumbers] })
  return {
    connectionStatus: status.response.ConnectionStatus,
    signalStrength: status.response.SignalIcon,
    networkType: status.response.CurrentNetworkType,
    networkTypeEx: status.response.CurrentNetworkTypeEx
  }
}

async function fetchHuaweiStatusXML() {
  const res = await fetch(INDEX_URL)
  const cookie = res.headers.raw()['set-cookie'][0].split(';')[0]

  const res2 = await fetch(STATUS_URL, {
    headers: {
      Cookie: cookie
    }
  })
  return await res2.text()
}