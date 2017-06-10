import mqtt = require('mqtt')
import Client = mqtt.Client
import Bacon = require('baconjs')
import EventStream = Bacon.EventStream
import {subscribeEvents} from './MqttClientUtils'
import {SensorEvents as SE} from '@chacal/js-utils'

const RFM_GW_COMMAND_TAG       = 'g'
const DEVICE_LEVEL_COMMAND_TAG = 'l'
const PWM_CONTROLLER_NODE      = 100

const config = {
  lowTempLimit:   70,
  highTempLimit:  95,
  lowTempPwm:     50,
  highTempPwm:    255
}
const pwmUnitsPerOneDegreeTemp = (config.highTempPwm - config.lowTempPwm) / (config.highTempLimit - config.lowTempLimit)

export default {
  start
}

function start<E>(mqttClient: Client) {
  mqttClient.queueQoSZero = false

  const alternatorTemperatures = subscribeEvents(mqttClient, ['/sensor/9/t/state']) as EventStream<E, SE.ITemperatureEvent>
  const latestAlternatorTemp = alternatorTemperatures.map(e => e.temperature).toProperty(0)

  latestAlternatorTemp.sampledBy(Bacon.interval(10000, ''))
    .onValue(temperature => sendPwmCommand(mqttClient, pwmValueForTemp(temperature)))
}


function sendPwmCommand(mqttClient: Client, pwmValue: number) {
  if(pwmValue < 0 || pwmValue > 255) {
    console.error(`Invalid PWM value: ${pwmValue}`)
    return
  }

  const cmdBuf = Buffer.alloc(4)
  cmdBuf.write(RFM_GW_COMMAND_TAG, 0, 1, 'ascii')
  cmdBuf.writeUInt8(PWM_CONTROLLER_NODE, 1)
  cmdBuf.write(DEVICE_LEVEL_COMMAND_TAG, 2, 1, 'ascii')
  cmdBuf.writeUInt8(pwmValue, 3)

  mqttClient.publish(`/nrf-command`, cmdBuf)
}


function pwmValueForTemp(temperature: number): number {
  if(temperature < config.lowTempLimit)
    return 0
  else if(temperature > config.highTempLimit)
    return config.highTempPwm
  else
    return Math.round(config.lowTempPwm + (temperature - config.lowTempLimit) * pwmUnitsPerOneDegreeTemp)
}
