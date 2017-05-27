import NmeaStreamer from './NmeaStreamer'

const NMEA_DEVICE_1 = process.env.NMEA_DEVICE_1 || ''
const NMEA_DEVICE_2 = process.env.NMEA_DEVICE_2 || ''
const NMEA_LOG_DIR = process.env.NMEA_LOG_DIR

NmeaStreamer.start(NMEA_DEVICE_1, NMEA_DEVICE_2, NMEA_LOG_DIR)
