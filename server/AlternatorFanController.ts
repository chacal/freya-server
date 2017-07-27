import mqtt = require('mqtt')
import Client = mqtt.Client
import Bacon = require('baconjs')
import EventStream = Bacon.EventStream
import Hysteresis = require('hysteresis')
import {subscribeEvents} from './MqttClientUtils'
import {SensorEvents as SE} from '@chacal/js-utils'

const RFM_GW_COMMAND_TAG       = 'g'
const DEVICE_LEVEL_COMMAND_TAG = 'l'
const PWM_CONTROLLER_NODE      = 100

enum FanState {OFF, ON}
interface ControlState {fan: FanState, pwm: number}

const config = {
  fanTurnOffTemp:    50,
  fanTurnOnTemp:     70,
  maxFanSpeedTemp:   75,
  lowTempPwm:       255,
  highTempPwm:      255
}
const pwmUnitsPerOneDegreeTemp = (config.highTempPwm - config.lowTempPwm) / (config.maxFanSpeedTemp - config.fanTurnOnTemp)
const hysteresisCheck = Hysteresis([config.fanTurnOffTemp, config.fanTurnOnTemp])

export default {
  start
}

function start<E>(mqttClient: Client) {
  mqttClient.queueQoSZero = false

  const alternatorTemperatures = subscribeEvents(mqttClient, ['/sensor/9/t/state']) as EventStream<E, SE.ITemperatureEvent>
  const latestAlternatorTemp = alternatorTemperatures.map(e => e.temperature).toProperty(0).sampledBy(Bacon.interval(5000, ''))
  const fanState = latestAlternatorTemp.map(hysteresisCheck).filter(v => v > 0).map(v => v === 1 ? FanState.OFF : FanState.ON)
  const pwmValue = latestAlternatorTemp.map(pwmValueForTemp)

  Bacon.combineTemplate<E, ControlState>({fan: fanState, pwm: pwmValue})
    .map(state => state.fan === FanState.ON ? state.pwm : 0)
    .slidingWindow(5)
    .filter(hasNotOnlyZeros)
    .map(takeLast)
    .onValue(pwmValueToSend => sendPwmCommand(mqttClient, pwmValueToSend))
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
  if(temperature < config.fanTurnOffTemp)
    return 0
  else if(temperature >= config.fanTurnOffTemp && temperature < config.fanTurnOnTemp)
    return config.lowTempPwm
  else if(temperature > config.maxFanSpeedTemp)
    return config.highTempPwm
  else
    return Math.round(config.lowTempPwm + (temperature - config.fanTurnOnTemp) * pwmUnitsPerOneDegreeTemp)
}


function hasNotOnlyZeros(numbers: number[]): boolean { return numbers.find(n => n !== 0) !== undefined }
function takeLast(numbers: number[]): number { return numbers[numbers.length - 1] }
