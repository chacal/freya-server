import {MqttClient} from 'mqtt'
import {Mqtt} from '@chacal/js-utils'
import NmeaStreamer from './NmeaStreamer'
import BatteryEnergyCalculator from './BatteryEnergyCalculator'
import AlternatorFanController from './AlternatorFanController'
import AutopilotController from './AutopilotController'
import D102NetworkDisplay from './D102'
import D103NetworkDisplay from './D103'
import D105_D106_NetworkDisplay from './D105_D106'
import ThreadDisplayStatusCollector from './ThreadDisplayStatusCollector'

import '@js-joda/timezone'

const NMEA_DEVICE_1 = process.env.NMEA_DEVICE_1 || ''
const NMEA_DEVICE_2 = process.env.NMEA_DEVICE_2 || ''
const NMEA_LOG_DIR = process.env.NMEA_LOG_DIR

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtts://sensor-backend.chacal.fi'
const MQTT_USERNAME = process.env.MQTT_USERNAME
const MQTT_PASSWORD = process.env.MQTT_PASSWORD


NmeaStreamer.start(NMEA_DEVICE_1, NMEA_DEVICE_2, NMEA_LOG_DIR)

startModule(BatteryEnergyCalculator.start)
startModule(AlternatorFanController.start)
startModule(AutopilotController.start)
startModule(D102NetworkDisplay.start)
startModule(D103NetworkDisplay.start)
startModule(D105_D106_NetworkDisplay.start)
startModule(ThreadDisplayStatusCollector.start)


function startModule(startFunc: (client: MqttClient) => void) {
  const client = Mqtt.startMqttClient(MQTT_BROKER, MQTT_USERNAME, MQTT_PASSWORD)
  client.on('connect', () => startFunc(client))
}
