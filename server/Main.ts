import { MqttClient } from 'mqtt'
import { Mqtt } from '@chacal/js-utils'
import BatteryEnergyCalculator from './BatteryEnergyCalculator'
import AutopilotController from './AutopilotController'
import D102NetworkDisplay from './D102'
import D103NetworkDisplay from './D103'
import D105_D106_NetworkDisplay from './D105_D106'
import ThreadDisplayStatusCollector from './ThreadDisplayStatusCollector'
import Huawei4GModemStatusPoller from './Huawei4GModemStatusPoller'

import '@js-joda/timezone'

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtts://sensor-backend.chacal.fi'
const MQTT_USERNAME = process.env.MQTT_USERNAME
const MQTT_PASSWORD = process.env.MQTT_PASSWORD


startModule(BatteryEnergyCalculator.start)
startModule(AutopilotController.start)
startModule(D102NetworkDisplay.start)
startModule(D103NetworkDisplay.start)
startModule(D105_D106_NetworkDisplay.start)
startModule(ThreadDisplayStatusCollector.start)
startModule(Huawei4GModemStatusPoller.start)


function startModule(startFunc: (client: MqttClient) => void) {
  const client = Mqtt.startMqttClient(MQTT_BROKER, MQTT_USERNAME, MQTT_PASSWORD)
  client.on('connect', () => startFunc(client))
}
