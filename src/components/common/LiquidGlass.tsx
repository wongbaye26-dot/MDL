import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

import Glass from './Glass'
import { useReducedMotion } from '@/utils/hooks'

/**
 * 液态玻璃（Miuix / Lyrico「悬浮导航栏 → 液态玻璃」那档的 RN 实现）。
 *
 * 在原有真高斯模糊（Glass/BlurView）之上叠三层：
 *  1. 缓慢横扫的高光带（5.2s 一圈，斜向渐变，模拟玻璃表面的流动反光）；
 *  2. 统一的顶部软高光 + 底部内阴影（厚度感，不再用实线边光）；
 *  3. 0.5dp 极淡描边（定义边界，而不是一圈实线）。
 *
 * 三档：
 *  - liquid  液态玻璃（默认，动效层全开）
 *  - frosted 毛玻璃（只保留模糊，低端机/省电）
 *  - none    关闭（不模糊，由父级给半透明纯色底）
 *
 * 减少动态效果时：高光带静止在中线，不跑循环动画。
 */
export type LiquidGlassMode = 'liquid' | 'frosted' | 'none'

const SWEEP_DURATION = 5200

export default memo(({
  mode = 'liquid',
  radius = 0,
  blurRadius = 18,
  tint,
  isDark = true,
}: {
  mode?: LiquidGlassMode
  radius?: number
  blurRadius?: number
  tint?: string
  isDark?: boolean
}) => {
  const reduced = useReducedMotion()
  const [width, setWidth] = useState(0)
  const sweep = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (mode !== 'liquid') return
    if (reduced) {
      sweep.setValue(0.5)
      return
    }
    const loop = Animated.loop(Animated.timing(sweep, {
      toValue: 1,
      duration: SWEEP_DURATION,
      easing: Easing.linear,
      useNativeDriver: true,
    }))
    loop.start()
    return () => { loop.stop() }
  }, [mode, reduced, sweep])

  if (mode === 'none') return null

  const sweepWidth = Math.max(80, width * 0.42)
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-sweepWidth, width + sweepWidth],
  })

  return (
    <View
      pointerEvents='none'
      onLayout={e => { setWidth(e.nativeEvent.layout.width) }}
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
      <LinearGradient
        colors={isDark
          ? ['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']
          : ['rgba(150,140,170,0)', 'rgba(150,140,170,0.16)']}
        style={styles.innerShade}
        pointerEvents='none'
      />
      {
        mode === 'liquid' && width > 0
          ? (
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: sweepWidth,
                transform: [{ translateX }],
              }}
            >
              {/*
                高光带必须用「纯水平」渐变：
                之前 start(0,0)→end(1,1) 是对角线，导致光带左右两条竖边在
                胶囊/迷你播放器上留下明显的竖向隔断线（黑主题尤其明显）。
                水平渐变后左右两端始终是 alpha 0，扫过时只有一条柔光，没有边。
              */}
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
            )
          : null
      }
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
    </View>
  )
})

const styles = StyleSheet.create({
  gloss: { position: 'absolute', left: 0, right: 0, top: 0, height: '70%' },
  innerShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
})
