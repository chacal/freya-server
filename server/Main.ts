import {MqttClient} from 'mqtt'
import {Mqtt} from '@chacal/js-utils'
import NmeaStreamer from './NmeaStreamer'
import BatteryEnergyCalculator from './BatteryEnergyCalculator'
import AlternatorFanController from './AlternatorFanController'
import AutopilotController from './AutopilotController'
import D102NetworkDisplay from './D102'

require('js-joda-timezone')

const NMEA_DEVICE_1 = process.env.NMEA_DEVICE_1 || ''
const NMEA_DEVICE_2 = process.env.NMEA_DEVICE_2 || ''
const NMEA_LOG_DIR = process.env.NMEA_LOG_DIR

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtts://mqtt.netserver.chacal.fi'
const MQTT_USERNAME = process.env.MQTT_USERNAME
const MQTT_PASSWORD = process.env.MQTT_PASSWORD


NmeaStreamer.start(NMEA_DEVICE_1, NMEA_DEVICE_2, NMEA_LOG_DIR)

startModule(BatteryEnergyCalculator.start)
startModule(AlternatorFanController.start)
startModule(AutopilotController.start)
startModule(D102NetworkDisplay.start)


function startModule(startFunc: (client: MqttClient) => void) {
  const client = Mqtt.startMqttClient(MQTT_BROKER, MQTT_USERNAME, MQTT_PASSWORD)
  client.on('connect', () => startFunc(client))
}
