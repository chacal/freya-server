import { getContext } from '@chacal/canvas-render-utils'
import { sendBWRImageToDisplay } from './utils'


const REAL_DISPLAY_WIDTH = 128
const REAL_DISPLAY_HEIGHT = 296
const DISPLAY_WIDTH = REAL_DISPLAY_HEIGHT
const DISPLAY_HEIGHT = REAL_DISPLAY_WIDTH
const D104_ADDRESS = 'fddd:eeee:ffff:0061:4579:2df8:83c4:88fa'


const ctx = getContext(REAL_DISPLAY_WIDTH, REAL_DISPLAY_HEIGHT, true)
ctx.antialias = 'default'

ctx.font = '40px Roboto500'
ctx.fillText('Hello World!', 40, 60)

const imageData = ctx.getImageData(0, 0, REAL_DISPLAY_WIDTH, REAL_DISPLAY_HEIGHT)
sendBWRImageToDisplay(D104_ADDRESS, imageData)
  .then(() => console.log('Done!'))