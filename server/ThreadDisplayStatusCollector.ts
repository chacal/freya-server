import mqtt = require('mqtt')
import Client = mqtt.Client
import { SensorEvents as SE, NetworkDisplay } from '@chacal/js-utils'
import { fromArray } from 'baconjs'
import { D102_ADDRESS } from './D102'
import { D103_ADDRESS } from './D103'
import { D105_ADDRESS, D106_ADDRESS } from './D105_D106'

const DISPLAY_ADDRESSES = [
  D102_ADDRESS,
  D103_ADDRESS,
  D105_ADDRESS,
  D106_ADDRESS
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
