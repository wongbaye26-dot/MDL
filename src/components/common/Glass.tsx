import { Platform, StyleSheet, UIManager, View, type StyleProp, type ViewStyle } from 'react-native'
import { BlurView } from '@react-native-community/blur'

/**
 * 真·高斯模糊玻璃层。
 *
 * 用的是 @react-native-community/blur（Android 侧基于 Dimezis BlurView，
 * API 31+ 走 RenderEffect，低版本走 RenderScript）：它会把「背后」的内容
 * 抓成位图做一次真正的高斯模糊，再裁剪到自身范围内 —— 真正的磨砂玻璃，
 * 而不是「半透明色 + 阴影」的模拟。
 *
 * 注意：
 *  - Android 的 blurRadius 上限是 25，传更大值库会直接抛错（这里已夹紧）；
 *  - 内部已设 pointerEvents='none'，不会挡住下层点击；
 *  - 不要放进 RN Modal（Modal 是独立 window，抓到的是弹窗自己）；
 *  - 原生模块没链接上时自动退化成半透明纯色，不会崩。
 */
const blurAvailable = (() => {
  if (Platform.OS !== 'android') return true
  try {
    return !!UIManager.getViewManagerConfig?.('AndroidBlurView')
  } catch {
    return false
  }
})()

export default ({
  blurRadius = 18,
  tint,
  radius = 0,
  style,
}: {
  /** 模糊半径，0~25 */
  blurRadius?: number
  /** 叠加在模糊层上的颜色，用来控制明暗与“牛奶感” */
  tint?: string
  /** 圆角（需要和父容器的圆角一致，父容器同时要 overflow: hidden） */
  radius?: number
  style?: StyleProp<ViewStyle>
}) => {
  const shape = radius ? { borderRadius: radius } : null
  if (!blurAvailable) {
    return <View pointerEvents='none' style={[styles.blur, shape, { backgroundColor: tint ?? 'rgba(255,255,255,0.6)' }, style]} />
  }
  return (
    <BlurView
      blurRadius={Math.min(25, Math.max(0, blurRadius))}
      overlayColor={tint}
      autoUpdate
      style={[styles.blur, shape, style]}
    />
  )
}

const styles = StyleSheet.create({
  blur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
})
