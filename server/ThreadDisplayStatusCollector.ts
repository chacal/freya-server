import mqtt = require('mqtt')
import Client = mqtt.Client
import { SensorEvents as SE, NetworkDisplay } from '@chacal/js-utils'
import { fromArray } from 'baconjs'

const DISPLAY_ADDRESSES = [
  'fdcc:28cc:6dba:0000:4e45:710b:06fb:0894',  // D102
  'fdcc:28cc:6dba:0000:4f2a:cc0f:383e:9440'   // D103
]

const STATUS_POLLING_INTERVAL_MS = 10 * 60000


export default {
  start
}

function start<E>(mqttClient: Client) {
  fromArray(DISPLAY_ADDRESSES)
    .flatMap(addr => NetworkDisplay.statusesWithInterval(addr, STATUS_POLLING_INTERVAL_MS))
    .onValue(publishThreadDisplayStatus)

  function publishThreadDisplayStatus(status: SE.IThreadDisplayStatus) {
    mqttClient.publish(`/sensor/${status.instance}/${status.tag}/state`, JSON.stringify(status))
  }
}
