import mqtt = require('mqtt')
import Client = mqtt.Client
import { SensorEvents as SE, NetworkDisplay } from '@chacal/js-utils'
import { fromArray } from 'baconjs'

const DISPLAY_ADDRESSES = [
  'fdcc:28cc:6dba:0000:e75e:5b5b:2569:c66a',  // D102
  'fdcc:28cc:6dba:0000:f80f:f30f:9a61:8755',  // D103
  'fdcc:28cc:6dba:0000:1304:3a28:8e24:6bed',  // D104
  'fdcc:28cc:6dba:0000:ff0d:e379:e425:2c81'   // D105
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
