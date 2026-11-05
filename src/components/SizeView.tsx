import { memo, useCallback, useRef, useEffect } from 'react'
import { type LayoutChangeEvent, StyleSheet, View, StatusBar, Dimensions } from 'react-native'
import commonState from '@/store/common/state'
import settingState from '@/store/setting/state'
import { setStatusbarHeight } from '@/core/common'
import { windowSizeTools, getWindowSize } from '@/utils/windowSizeTools'
import { onWindowSizeChange } from '@/utils/nativeModules/utils'

const getStatusbarHeight = (winHeight: number, layoutHeight: number) => {
  const height = (!settingState.setting['common.alwaysKeepStatusbarHeight'] &&
          parseFloat(winHeight.toFixed(2)) >= parseFloat(layoutHeight.toFixed(2)))
    ? 0
    : (StatusBar.currentHeight ?? 0)

  return height
}

export default memo(() => {
  const currentHeightRef = useRef(commonState.statusbarHeight)
  const sizeRef = useRef([0, 0])
  const dimensionsChangedRef = useRef(true)
  const viewRef = useRef<View>(null)
  const handleLayout = useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent | { nativeEvent: { layout: { width: number, height: number } } }) => {
    // console.log('handleLayout')
    if (!dimensionsChangedRef.current) return
    /*
      键盘弹起时窗口/根视图高度会临时变小（Android 15/16 edge-to-edge 下实测 891dp → 205dp），
      这不是窗口形态变化：
        - 用它重算 statusbarHeight 会让页头突然跳 36dp；
        - windowSizeTools 会把它当成「横屏/小窗」，Home 切到横屏树并卸载竖屏树，
          搜索框一聚焦整个搜索页就消失（targetSdk36 回归 P1）。
      键盘收起后原生会再推一次 screen-size-changed，这里再用真实尺寸重新量。
    */
    const knownSize = windowSizeTools.getSize()
    const insets = windowSizeTools.getInsets()
    const keyboardTransient = insets.ime.bottom > 0 ||
      (!insets.isInMultiWindowMode && knownSize.height > 0 &&
        layout.height < knownSize.height * 0.7 && layout.height < 500)
    if (keyboardTransient) return
    void getWindowSize().then(size => {
      dimensionsChangedRef.current = false
      // console.log(layout, size)
      sizeRef.current = [size.height, layout.height]
      const height = getStatusbarHeight(size.height, layout.height)

      if (currentHeightRef.current != height) {
        currentHeightRef.current = height
        setStatusbarHeight(height)
      }
      // console.log(layout, size)
      const currentSize = windowSizeTools.getSize()
      if (currentSize.width != layout.width || currentSize.height != layout.height) {
        windowSizeTools.setWindowSize(layout.width, layout.height)
      }
    })
  }, [])
  // 分屏 / 小窗 / 导航栏模式切换后重新量一次根视图：
  // Android 15/16 强制 edge-to-edge，这些场景 RN 的 Dimensions 不一定刷新，
  // 尺寸由原生 screen-size-changed 主动推（windowSizeTools 也会用同一事件刷窗口尺寸），
  // 这里负责让 statusbarHeight 跟着重算。
  const remeasure = useCallback(() => {
    dimensionsChangedRef.current = true
    viewRef.current?.measureInWindow((x, y, width, height) => {
      if (!width || !height) return
      handleLayout({ nativeEvent: { layout: { width, height } } })
    })
  }, [handleLayout])
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      dimensionsChangedRef.current = true
    })
    const removeWindowSizeListener = onWindowSizeChange(remeasure)

    const handleSettingUpdate = (keys: Array<keyof LX.AppSetting>) => {
      if (!keys.includes('common.alwaysKeepStatusbarHeight') || !sizeRef.current[1]) return
      const height = getStatusbarHeight(sizeRef.current[0], sizeRef.current[1])

      if (currentHeightRef.current != height) {
        currentHeightRef.current = height
        setStatusbarHeight(height)
      }
    }
    global.state_event.on('configUpdated', handleSettingUpdate)

    return () => {
      subscription.remove()
      removeWindowSizeListener()
      global.state_event.off('configUpdated', handleSettingUpdate)
    }
  }, [remeasure])
  return (<View ref={viewRef} style={StyleSheet.absoluteFill} onLayout={handleLayout} />)
}, () => true)
