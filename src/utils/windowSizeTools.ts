import { Dimensions, StatusBar } from 'react-native'
import { getWindowSize as getWindowSizeRaw } from './nativeModules/utils'
// import { log } from './log'

export type SizeHandler = (size: { width: number, height: number }) => void
export const getWindowSize = async() => {
  return getWindowSizeRaw().then((size) => {
    const scale = Dimensions.get('window').scale
    size.width = size.width / scale
    size.height = size.height / scale
    return size
  })
}

export const windowSizeTools = {
  size: {
    width: 0,
    height: 0,
  },
  listeners: [] as SizeHandler[],
  getSize() {
    return this.size
  },
  onSizeChanged(handler: SizeHandler) {
    this.listeners.push(handler)

    return () => {
      this.listeners.splice(this.listeners.indexOf(handler), 1)
    }
  },
  async init() {
    Dimensions.addEventListener('change', ({ window }) => {
      // 分屏、小窗、折叠屏切换都会走这里；用 window 而不是 screen，拿到的就是可用区域
      const next = {
        width: Math.round(window.width),
        height: Math.round(window.height) + (StatusBar.currentHeight ?? 0),
      }
      if (!next.width || (next.width === this.size.width && next.height === this.size.height)) return
      this.size = next
      for (const handler of this.listeners) handler(next)
    })
    // Dimensions.addEventListener('change', () => {
    //   void getWindowSize().then((size) => {
    //     if (!size.width) return
    //     const scale = Dimensions.get('screen').scale
    //     size.width = Math.round(size.width / scale)
    //     size.height = Math.round(size.height / scale) + (StatusBar.currentHeight ?? 0)
    //     this.size = size
    //     for (const handler of this.listeners) handler(size)
    //   })
    // })
    const size = await getWindowSize()
    // log.info('win size', size)
    if (size.width) {
      this.size = size
    } else {
      const window = Dimensions.get('window')
      // log.info('Dimensions window size', window)
      this.size = {
        width: Math.round(window.width),
        height: Math.round(window.height) + (StatusBar.currentHeight ?? 0),
      }
    }
    // console.log('init windowSizeTools')
    return size
  },
  setWindowSize(width: number, height: number) {
    this.size = {
      width: Math.round(width),
      height: Math.round(height),
    }
    for (const handler of this.listeners) handler(this.size)
  },
}
