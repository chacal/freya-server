import NmeaStreamer from './NmeaStreamer'
import MqttClientUtils from './MqttClientUtils'
import BatteryEnergyCalculator from './BatteryEnergyCalculator'
import AlternatorFanController from './AlternatorFanController'

const NMEA_DEVICE_1 = process.env.NMEA_DEVICE_1 || ''
const NMEA_DEVICE_2 = process.env.NMEA_DEVICE_2 || ''
const NMEA_LOG_DIR = process.env.NMEA_LOG_DIR

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtts://mqtt.netserver.chacal.fi'
const MQTT_USERNAME = process.env.MQTT_USERNAME
const MQTT_PASSWORD = process.env.MQTT_PASSWORD


NmeaStreamer.start(NMEA_DEVICE_1, NMEA_DEVICE_2, NMEA_LOG_DIR)

MqttClientUtils.connectClient(MQTT_BROKER, MQTT_USERNAME, MQTT_PASSWORD)
  .onValue(client => BatteryEnergyCalculator.start(client))

MqttClientUtils.connectClient(MQTT_BROKER, MQTT_USERNAME, MQTT_PASSWORD)
  .onValue(client => AlternatorFanController.start(client))
