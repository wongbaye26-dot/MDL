import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

import Glass from './Glass'

/**
 * 液态玻璃（Miuix / Lyrico「悬浮导航栏 → 液态玻璃」那档的 RN 实现）。
 *
 * 在原有真高斯模糊（Glass/BlurView）之上叠三层：
 *  1. 统一的顶部软高光 + 底部内阴影（厚度感，不再用实线边光）；
 *  2. 0.5dp 极淡描边（定义边界，而不是一圈实线）。
 *
 * 注：用户要求去掉「流光扫光」动态效果，因此不再画移动高光带。
 *
 * 三档：
 *  - liquid  液态玻璃（默认，动效层全开）
 *  - frosted 毛玻璃（只保留模糊，低端机/省电）
 *  - none    关闭（不模糊，由父级给半透明纯色底）
 *
 */
export type LiquidGlassMode = 'liquid' | 'frosted' | 'none'

export default memo(({
  mode = 'liquid',
  radius = 0,
  blurRadius = 18,
  tint,
  isDark = true,
  seamless = false,
}: {
  mode?: LiquidGlassMode
  radius?: number
  blurRadius?: number
  tint?: string
  isDark?: boolean
  /** 无缝表头：去掉底部内阴影和描边，只保留顶部高光，避免和页面之间出现一条线 */
  seamless?: boolean
}) => {
  if (mode === 'none') return null

  return (
    <View
      pointerEvents='none'
      style={[StyleSheet.absoluteFillObject, { borderRadius: radius, overflow: 'hidden' }]}
    >
      <Glass blurRadius={blurRadius} tint={tint} radius={radius} />

      {/*
        统一材质：胶囊 / 迷你播放器 / 子页播放条都只走这一份玻璃层。
        之前各页面自己再叠「顶部高光 + 底部内阴影」，参数不一致，
        深色下还会露出一条硬边光线（顶部 1.2dp / 底部 1dp 的实线）。
        现在把这些软渐变收进 LiquidGlass，并删掉两条实线，只留 0.5dp 极淡描边。
      */}
      <LinearGradient
        colors={isDark
          ? ['rgba(255,255,255,0.13)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']
          : ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0)']}
        locations={[0, 0.5, 1]}
        style={styles.gloss}
        pointerEvents='none'
      />
      {
        seamless
          ? null
          : (
            <LinearGradient
              colors={isDark
                ? ['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']
                : ['rgba(150,140,170,0)', 'rgba(150,140,170,0.16)']}
              style={styles.innerShade}
              pointerEvents='none'
            />
            )
      }
      {
        seamless
          ? null
          : (
            <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          borderRadius: radius,
          borderWidth: 0.5,
          borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.5)',
        }}
            />
            )
      }
    </View>
  )
})

const styles = StyleSheet.create({
  gloss: { position: 'absolute', left: 0, right: 0, top: 0, height: '70%' },
  innerShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
})
