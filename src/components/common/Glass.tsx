import { Platform, StyleSheet, View, processColor, requireNativeComponent, type StyleProp, type ViewStyle } from 'react-native'

/**
 * 真·高斯模糊玻璃层（自研实现，替代 @react-native-community/blur）。
 *
 * 背景：新架构下 RNN 8.6.2 自带 BlurView 3.0.0，community blur 4.4.1 的 Fabric 实现
 * 是按 2.0.4 API 编译的，setupWith 签名冲突。BlurView 3 的 BlurTarget 要求
 * 「被模糊内容」与「BlurView」是兄弟节点，意味着每个页面都要重排布局；
 * 这里改为原生自抽象：GlassBlurView 在 preDraw 时把窗口内容画进快照
 * （跳过所有玻璃层，避免递归），再用 RenderEffect（API 31+）做硬件模糊。
 *
 * - Android：原生 GlassBlurView（Fabric interop）；
 * - iOS / 原生缺失 / API < 31：退化为半透明纯色（由原生侧处理 tint）；
 * - 内部 pointerEvents='none'，不挡下层点击。
 */
interface NativeGlassBlurProps {
  blurRadius?: number
  overlayColor?: number
  enabled?: boolean
  pointerEvents?: 'none'
  style?: StyleProp<ViewStyle>
}

let NativeGlassBlur: React.ComponentType<NativeGlassBlurProps> | null = null
if (Platform.OS === 'android') {
  try {
    NativeGlassBlur = requireNativeComponent<NativeGlassBlurProps>('GlassBlurView')
  } catch {
    NativeGlassBlur = null
  }
}

export default ({
  blurRadius = 18,
  tint,
  radius = 0,
  style,
}: {
  /** 模糊半径，0~25（原生侧会夹紧） */
  blurRadius?: number
  /** 叠加在模糊层上的颜色，用来控制明暗与“牛奶感” */
  tint?: string
  /** 圆角（需要和父容器的圆角一致，父容器同时要 overflow: hidden） */
  radius?: number
  style?: StyleProp<ViewStyle>
}) => {
  const shape = radius ? { borderRadius: radius } : null
  if (NativeGlassBlur != null) {
    return (
      <NativeGlassBlur
        pointerEvents='none'
        blurRadius={Math.min(25, Math.max(0, blurRadius))}
        overlayColor={(processColor(tint) ?? 0) as number}
        enabled
        style={[styles.blur, shape, style]}
      />
    )
  }
  return <View pointerEvents='none' style={[styles.blur, shape, { backgroundColor: tint ?? 'rgba(255,255,255,0.6)' }, style]} />
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
